// actions/tasks.ts
"use server";

import { createClient } from "@/lib/supabase-server";
import {
  calculateScore,
  type Task,
  type TaskStatus,
  type PriorityLevel,
  type DecoLevel,
  type LabelCategory,
} from "@/lib/types";
import { revalidatePath } from "next/cache";
import { sendEmail } from "@/lib/email";

// =====================================================================
// CREATE TASK
// =====================================================================

export interface CreateTaskInput {
  name: string;
  description: string;
  ownerId: string;
  dueDate: string; // ISO date
  priority: PriorityLevel;
  deco: DecoLevel;
  labels: LabelCategory[];
  status?: TaskStatus;
  contributorIds?: string[];
  dependencies?: { dependsOnUserId: string; reason: string }[];
}

export async function createTask(input: CreateTaskInput) {
  const supabase = await createClient();

  if (input.labels.length < 1 || input.labels.length > 2) {
    throw new Error("A task must have 1 or 2 labels.");
  }

  const { data: task, error } = await supabase
    .from("tasks")
    .insert({
      name: input.name,
      description: input.description,
      owner_id: input.ownerId,
      due_date: input.dueDate,
      priority: input.priority,
      deco: input.deco,
      labels: input.labels,
      status: input.status ?? "sierra_bravo",
    })
    .select()
    .single();

  if (error) throw error;

  // Contributors
  if (input.contributorIds?.length) {
    await supabase.from("task_contributors").insert(
      input.contributorIds.map((userId) => ({ task_id: task.id, user_id: userId }))
    );
  }

  // Dependencies + V2 automation
  if (input.dependencies?.length) {
    for (const dep of input.dependencies) {
      await createDependency(task.id, dep.dependsOnUserId, dep.reason);
    }
  }

  revalidatePath("/");
  return task as Task;
}

// =====================================================================
// DEPENDENCY AUTOMATION (V2)
//
// When Task A (owned by user A) depends on User B for reason R:
//   1. Create a linked task for B (Sierra Bravo, same Due Date /
//      Priority / DECO as A's task).
//   2. B's task carries: requested_by = A, parent_task_id = A's task,
//      dependency_reason = R.
//   3. A row is written to task_dependencies linking A's task -> B's
//      new task (so A's task can render "Dependency on:: B's Name").
//   4. Trigger 4 (immediate notification) is logged for B.
// =====================================================================

export async function createDependency(
  taskId: string,
  dependsOnUserId: string,
  reason: string
) {
  const supabase = await createClient();

  const { data: parentTask, error: parentErr } = await supabase
    .from("tasks")
    .select("*")
    .eq("id", taskId)
    .single();
  if (parentErr) throw parentErr;

  // Create B's linked task — same Due Date, Priority, DECO as parent.
  const { data: linkedTask, error: linkedErr } = await supabase
    .from("tasks")
    .insert({
      name: `[Dependency] ${parentTask.name}`,
      description: `Requested by ${parentTask.owner_id}: ${reason}`,
      owner_id: dependsOnUserId,
      due_date: parentTask.due_date,
      priority: parentTask.priority,
      deco: parentTask.deco,
      labels: parentTask.labels,
      status: "sierra_bravo",
      parent_task_id: parentTask.id,
      requested_by: parentTask.owner_id,
      dependency_reason: reason,
    })
    .select()
    .single();
  if (linkedErr) throw linkedErr;

  // Record the dependency edge on A's task, pointing at B's new task.
  const { error: depErr } = await supabase.from("task_dependencies").insert({
    task_id: taskId,
    depends_on_user_id: dependsOnUserId,
    reason,
    linked_task_id: linkedTask.id,
  });
  if (depErr) throw depErr;

  // Make sure both parties can see contributors (PRD: "All users
  // involved can see the dependency" + contributors visibility).
  await supabase
    .from("task_contributors")
    .upsert(
      [
        { task_id: taskId, user_id: dependsOnUserId },
        { task_id: linkedTask.id, user_id: parentTask.owner_id },
      ],
      { onConflict: "task_id,user_id" }
    );

  // Trigger 4: immediate notification log entry.
  await supabase.from("email_trigger_log").insert({
    task_id: linkedTask.id,
    recipient_id: dependsOnUserId,
    trigger_type: "dependency_assigned",
  });

  // Dispatch immediate email notification
  try {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name, email")
      .in("id", [parentTask.owner_id, dependsOnUserId]);

    const requester = profiles?.find((p) => p.id === parentTask.owner_id);
    const recipient = profiles?.find((p) => p.id === dependsOnUserId);

    if (recipient && requester) {
      const subject = `${requester.full_name} is waiting on you for: ${parentTask.name}`;
      const body = `
        <p>Hey ${recipient.full_name},</p>
        <p><strong>${requester.full_name}</strong> is waiting on you for: '<strong>${parentTask.name}</strong>'.</p>
        <p><strong>Reason:</strong> ${reason}</p>
        <p>Please take it up immediately or deactivate if required.</p>
      `;
      await sendEmail({
        to: recipient.email,
        subject,
        html: body,
      });
    }
  } catch (emailErr) {
    console.error("Failed to send immediate dependency email:", emailErr);
  }

  revalidatePath("/");
  return linkedTask as Task;
}

// =====================================================================
// RESOLVE/DELETE DEPENDENCY
// =====================================================================

export async function resolveDependency(dependencyId: string) {
  const supabase = await createClient();

  // Fetch dependency to get the associated parent task ID
  const { data: dep, error: fetchErr } = await supabase
    .from("task_dependencies")
    .select("task_id")
    .eq("id", dependencyId)
    .single();

  if (fetchErr) throw fetchErr;

  const { error } = await supabase
    .from("task_dependencies")
    .delete()
    .eq("id", dependencyId);

  if (error) throw error;

  // Check if there are other dependencies remaining for this parent task.
  // If none, automatically clear the blocked state.
  const { data: remaining } = await supabase
    .from("task_dependencies")
    .select("id")
    .eq("task_id", dep.task_id);

  if (!remaining || remaining.length === 0) {
    await supabase
      .from("tasks")
      .update({ is_blocked: false, blocked_reason: null })
      .eq("id", dep.task_id);
  }

  revalidatePath("/");
}

// =====================================================================
// STATUS TRANSITIONS
//
// Moving a task between Kanban columns. Oscar Delta tasks are excluded
// from normal drag/drop transitions per PRD ("do not move through the
// normal workflow"). Scoring on Tango Charlie is handled by the DB
// trigger (handle_task_completion), but we also compute it here for
// immediate UI feedback.
// =====================================================================

export async function moveTask(taskId: string, newStatus: TaskStatus) {
  const supabase = await createClient();

  const { data: task, error: fetchErr } = await supabase
    .from("tasks")
    .select("*")
    .eq("id", taskId)
    .single();
  if (fetchErr) throw fetchErr;

  if (task.status === "oscar_delta" || newStatus === "oscar_delta") {
    if (task.status !== newStatus) {
      throw new Error(
        "Oscar Delta tasks are recurring and do not move through the normal workflow."
      );
    }
  }

  const update: Partial<Task> = { status: newStatus };

  // Pre-compute score for immediate response; DB trigger also enforces this.
  if (newStatus === "tango_charlie" && task.status !== "tango_charlie") {
    const today = new Date().toISOString().split("T")[0];
    update.score = calculateScore(task.priority, task.deco, task.due_date, today);
    update.completed_at = new Date().toISOString();
  }

  const { data: updated, error } = await supabase
    .from("tasks")
    .update(update)
    .eq("id", taskId)
    .select()
    .single();
  if (error) throw error;

  revalidatePath("/");
  return updated as Task;
}

// =====================================================================
// BLOCKED BADGE
// =====================================================================

export async function setBlocked(taskId: string, isBlocked: boolean, reason?: string) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("tasks")
    .update({
      is_blocked: isBlocked,
      blocked_reason: isBlocked ? reason ?? null : null,
    })
    .eq("id", taskId)
    .select()
    .single();

  if (error) throw error;
  revalidatePath("/");
  return data as Task;
}

// =====================================================================
// FETCH BOARD DATA
// =====================================================================

export async function getBoardTasks() {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("tasks")
    .select(
      `
      *,
      owner:profiles!tasks_owner_id_fkey(id, full_name, email, avatar_url),
      dependencies:task_dependencies!task_dependencies_task_id_fkey(
        id, reason, linked_task_id,
        depends_on_user:profiles!task_dependencies_depends_on_user_id_fkey(id, full_name)
      ),
      contributors:task_contributors(
        profile:profiles(id, full_name, email, avatar_url)
      )
    `
    )
    .order("created_at", { ascending: true });

  if (error) throw error;

  // Flatten contributors join shape
  return (data ?? []).map((t: any) => ({
    ...t,
    contributors: (t.contributors ?? []).map((c: any) => c.profile),
  })) as Task[];
}

// =====================================================================
// LEADERBOARD (Weekly / Monthly / All Time)
// =====================================================================

export async function getLeaderboard(range: "weekly" | "monthly" | "all_time") {
  const supabase = await createClient();

  let query = supabase
    .from("leaderboard")
    .select("*")
    .order("completed_at", { ascending: false });

  if (range === "weekly") {
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    query = query.gte("completed_at", weekAgo.toISOString());
  } else if (range === "monthly") {
    const monthAgo = new Date();
    monthAgo.setMonth(monthAgo.getMonth() - 1);
    query = query.gte("completed_at", monthAgo.toISOString());
  }

  const { data, error } = await query;
  if (error) throw error;

  // Aggregate by user
  const byUser = new Map<string, { full_name: string; totalPoints: number; tasksCompleted: number }>();
  for (const row of data ?? []) {
    const existing = byUser.get(row.user_id) ?? {
      full_name: row.full_name,
      totalPoints: 0,
      tasksCompleted: 0,
    };
    existing.totalPoints += row.score ?? 0;
    existing.tasksCompleted += 1;
    byUser.set(row.user_id, existing);
  }

  return Array.from(byUser.entries())
    .map(([userId, v]) => ({ userId, ...v }))
    .sort((a, b) => b.totalPoints - a.totalPoints);
}

// =====================================================================
// DAILY TASKS (Oscar Delta)
// =====================================================================

export async function getDailyTasks() {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("tasks")
    .select(`
      *,
      owner:profiles!tasks_owner_id_fkey(id, full_name, email, avatar_url),
      daily_completions(id, completed_at, completed_by)
    `)
    .eq("status", "oscar_delta")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching daily tasks with completions. Running fallback query. Error detail:", error.message);
    
    // Fetch daily tasks without querying daily_completions relation if it is missing
    const { data: fallbackData, error: fallbackError } = await supabase
      .from("tasks")
      .select(`
        *,
        owner:profiles!tasks_owner_id_fkey(id, full_name, email, avatar_url)
      `)
      .eq("status", "oscar_delta")
      .order("created_at", { ascending: false });

    if (fallbackError) throw fallbackError;
    return (fallbackData ?? []).map((t) => ({ ...t, daily_completions: [] })) as any[];
  }
  return data as any[];
}

export async function markDailyDone(taskId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new Error("Not authenticated");

  const { error } = await supabase.from("daily_completions").insert({
    task_id: taskId,
    completed_by: user.id,
    completed_at: new Date().toISOString(),
  });

  if (error) throw error;
  revalidatePath("/");
}