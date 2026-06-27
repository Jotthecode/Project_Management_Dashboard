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
  type ComplexityLevel,
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
  owner2Id?: string;
  wingmenIds?: string[];
  dueDate: string; // ISO date
  priority: PriorityLevel;
  deco: DecoLevel; // Duration
  complexity: ComplexityLevel; // Complexity
  labels: LabelCategory[];
  status?: TaskStatus;
  contributorIds?: string[];
  dependencies?: { dependsOnUserId: string; reason: string }[];
}

export async function createTask(input: CreateTaskInput) {
  const supabase = await createClient();

  const { data: task, error } = await supabase
    .from("tasks")
    .insert({
      name: input.name,
      description: input.description,
      owner_id: input.ownerId,
      owner2_id: input.owner2Id || null,
      wingmen_ids: input.wingmenIds || [],
      due_date: input.dueDate,
      priority: input.priority,
      deco: input.deco,
      complexity: input.complexity || "medium",
      labels: input.labels || [],
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

  revalidatePath("/", "layout");
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
  if (reason.trim().length <= 10) {
    throw new Error("Dependency reason must exceed 10 characters.");
  }

  const supabase = await createClient();

  const { data: parentTask, error: parentErr } = await supabase
    .from("tasks")
    .select("*")
    .eq("id", taskId)
    .single();
  if (parentErr) throw parentErr;

  // Create B's linked task — same Due Date, Priority, DECO/Complexity as parent.
  const { data: linkedTask, error: linkedErr } = await supabase
    .from("tasks")
    .insert({
      name: `[DEPENDENCY] ${reason}`,
      description: `Requested by ${parentTask.owner_id}: ${reason}`,
      owner_id: dependsOnUserId,
      due_date: parentTask.due_date,
      priority: parentTask.priority,
      deco: parentTask.deco,
      complexity: parentTask.complexity || "medium",
      labels: [],
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

  revalidatePath("/", "layout");
  return linkedTask as Task;
}

// =====================================================================
// RESOLVE/DELETE DEPENDENCY
// =====================================================================

export async function resolveDependency(dependencyId: string) {
  const supabase = await createClient();

  // Fetch logged in user
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  // Fetch dependency to get the associated parent task ID and owner
  const { data: dep, error: fetchErr } = await supabase
    .from("task_dependencies")
    .select(`
      task_id,
      task:tasks(owner_id)
    `)
    .eq("id", dependencyId)
    .single();

  if (fetchErr) throw fetchErr;

  // Restrict resolving dependency solely to original blocked task owner
  const blockedTaskOwnerId = (dep.task as any)?.owner_id;
  if (blockedTaskOwnerId && blockedTaskOwnerId !== user.id) {
    throw new Error("Only the owner of the original blocked task can resolve this dependency.");
  }

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

  revalidatePath("/", "layout");
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
    update.score = calculateScore(task.priority, task.deco, task.complexity, task.due_date, today);
    update.completed_at = new Date().toISOString();
  }

  const { data: updated, error } = await supabase
    .from("tasks")
    .update(update)
    .eq("id", taskId)
    .select()
    .single();
  if (error) throw error;

  revalidatePath("/", "layout");
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
  revalidatePath("/", "layout");
  return data as Task;
}

// =====================================================================
// FETCH BOARD DATA
// =====================================================================

export async function getBoardTasks() {
  const supabase = await createClient();

  const query = supabase
    .from("tasks")
    .select(
      `
      *,
      owner:profiles!tasks_owner_id_fkey(id, full_name, email, avatar_url),
      owner2:profiles!tasks_owner2_id_fkey(id, full_name, email, avatar_url),
      requested_by_user:profiles!tasks_requested_by_fkey(id, full_name, email, avatar_url),
      dependencies:task_dependencies!task_dependencies_task_id_fkey(
        id, reason, linked_task_id,
        depends_on_user:profiles!task_dependencies_depends_on_user_id_fkey(id, full_name)
      ),
      contributors:task_contributors(
        profile:profiles(id, full_name, email, avatar_url)
      )
    `
    );

  let { data, error } = await query
    .eq("is_archived", false)
    .order("created_at", { ascending: true });

  if (error && error.code === "42703") {
    console.warn("Falling back getBoardTasks fetch to ignore is_archived filter since column is missing:", error.message);
    const { data: fallbackData, error: fallbackError } = await query
      .order("created_at", { ascending: true });
    if (fallbackError) throw fallbackError;
    data = fallbackData;
  } else if (error) {
    throw error;
  }

  // Fetch profiles to resolve wingmen in memory
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, full_name, email, avatar_url");

  // Flatten contributors join shape and resolve wingmen
  return (data ?? []).map((t: any) => ({
    ...t,
    contributors: (t.contributors ?? []).map((c: any) => c.profile),
    wingmen: (t.wingmen_ids || [])
      .map((id: string) => profiles?.find((p) => p.id === id))
      .filter(Boolean),
  })) as Task[];
}

// =====================================================================
// LEADERBOARD (Weekly / Monthly / All Time)
// =====================================================================

// =====================================================================
// LEADERBOARD (Weekly / Monthly / All Time)
// =====================================================================

export async function getLeaderboardData() {
  const supabase = await createClient();

  // Fetch all profiles so that everyone shows up in the leaderboard
  const { data: profiles, error: profilesErr } = await supabase
    .from("profiles")
    .select("id, full_name");
  if (profilesErr) throw profilesErr;

  // Query the tasks table directly for completed tasks with scores
  let tasks: any[] = [];
  
  const { data: mainTasks, error: tasksErr } = await supabase
    .from("tasks")
    .select(`
      id,
      name,
      score,
      priority,
      deco,
      complexity,
      completed_at,
      due_date,
      owner_id,
      owner:profiles!tasks_owner_id_fkey(id, full_name)
    `)
    .eq("status", "tango_charlie")
    .not("score", "is", null)
    .order("completed_at", { ascending: false });

  if (tasksErr) {
    console.warn("Falling back leaderboard fetch to ignore complexity column if missing:", tasksErr.message);
    const { data: fallbackTasks, error: fallbackErr } = await supabase
      .from("tasks")
      .select(`
        id,
        name,
        score,
        priority,
        deco,
        completed_at,
        due_date,
        owner_id,
        owner:profiles!tasks_owner_id_fkey(id, full_name)
      `)
      .eq("status", "tango_charlie")
      .not("score", "is", null)
      .order("completed_at", { ascending: false });

    if (fallbackErr) throw fallbackErr;
    tasks = fallbackTasks ?? [];
  } else {
    tasks = mainTasks ?? [];
  }

  const now = new Date();
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);
  const monthAgo = new Date();
  monthAgo.setMonth(monthAgo.getMonth() - 1);

  // Helper function to build leaderboard aggregations
  const buildLeaderboard = (filteredTasks: any[]) => {
    const byUser = new Map<string, {
      full_name: string;
      totalPoints: number;
      tasksCompleted: number;
      bestScore: number;
      tasks: any[];
    }>();

    for (const profile of profiles ?? []) {
      byUser.set(profile.id, {
        full_name: profile.full_name,
        totalPoints: 0,
        tasksCompleted: 0,
        bestScore: 0,
        tasks: [],
      });
    }

    const getDaysEarly = (dueDateStr: string, completedDateStr: string): number => {
      if (!dueDateStr || !completedDateStr) return 0;
      const due = new Date(dueDateStr);
      const completed = new Date(completedDateStr.split("T")[0]);
      const diffTime = due.getTime() - completed.getTime();
      return Math.round(diffTime / (1000 * 60 * 60 * 24));
    };

    for (const row of filteredTasks) {
      const existing = byUser.get(row.owner_id);
      const scoreVal = Number(row.score) || 0;

      const taskObj = {
        task_id: row.id,
        task_name: row.name,
        priority: row.priority || "P3",
        deco: row.deco || "medium",
        complexity: row.complexity || "medium",
        score: scoreVal,
        completed_at: row.completed_at,
        due_date: row.due_date,
        days_early: getDaysEarly(row.due_date, row.completed_at),
      };

      if (existing) {
        existing.totalPoints += scoreVal;
        existing.tasksCompleted += 1;
        if (scoreVal > existing.bestScore) {
          existing.bestScore = scoreVal;
        }
        existing.tasks.push(taskObj);
      } else {
        byUser.set(row.owner_id, {
          full_name: row.owner?.full_name ?? "Unknown",
          totalPoints: scoreVal,
          tasksCompleted: 1,
          bestScore: scoreVal,
          tasks: [taskObj],
        });
      }
    }

    return Array.from(byUser.entries())
      .map(([userId, v]) => ({
        userId,
        full_name: v.full_name,
        totalPoints: Math.round(v.totalPoints * 100) / 100,
        tasksCompleted: v.tasksCompleted,
        bestScore: Math.round(v.bestScore * 100) / 100,
        avgScore: v.tasksCompleted > 0 ? Math.round((v.totalPoints / v.tasksCompleted) * 100) / 100 : 0,
        tasks: v.tasks,
      }))
      .sort((a, b) => b.totalPoints - a.totalPoints);
  };

  const weeklyTasks = (tasks ?? []).filter(
    (t: any) => t.completed_at && new Date(t.completed_at) >= weekAgo
  );
  const monthlyTasks = (tasks ?? []).filter(
    (t: any) => t.completed_at && new Date(t.completed_at) >= monthAgo
  );

  return {
    weekly: buildLeaderboard(weeklyTasks),
    monthly: buildLeaderboard(monthlyTasks),
    allTime: buildLeaderboard(tasks ?? []),
  };
}

// =====================================================================
// DAILY TASKS (Oscar Delta)
// =====================================================================

export async function getDailyTasks() {
  const supabase = await createClient();

  let { data, error } = await supabase
    .from("tasks")
    .select(`
      *,
      owner:profiles!tasks_owner_id_fkey(id, full_name, email, avatar_url),
      owner2:profiles!tasks_owner2_id_fkey(id, full_name, email, avatar_url),
      requested_by_user:profiles!tasks_requested_by_fkey(id, full_name, email, avatar_url),
      daily_completions(id, completed_at, completed_by)
    `)
    .eq("status", "oscar_delta")
    .eq("is_archived", false)
    .order("created_at", { ascending: false });

  // Fetch profiles to resolve wingmen in memory
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, full_name, email, avatar_url");

  // Fallback if is_archived column is missing
  if (error && error.code === "42703") {
    console.warn("Falling back getDailyTasks fetch to ignore is_archived filter since column is missing:", error.message);
    const { data: fallbackData, error: fallbackError } = await supabase
      .from("tasks")
      .select(`
        *,
        owner:profiles!tasks_owner_id_fkey(id, full_name, email, avatar_url),
        owner2:profiles!tasks_owner2_id_fkey(id, full_name, email, avatar_url),
        requested_by_user:profiles!tasks_requested_by_fkey(id, full_name, email, avatar_url),
        daily_completions(id, completed_at, completed_by)
      `)
      .eq("status", "oscar_delta")
      .order("created_at", { ascending: false });

    if (fallbackError) {
      console.warn("Error fetching daily tasks with completions in fallback. Running second fallback query. Error detail:", fallbackError.message);
      const { data: secondFallback, error: secondError } = await supabase
        .from("tasks")
        .select(`
          *,
          owner:profiles!tasks_owner_id_fkey(id, full_name, email, avatar_url),
          owner2:profiles!tasks_owner2_id_fkey(id, full_name, email, avatar_url)
        `)
        .eq("status", "oscar_delta")
        .order("created_at", { ascending: false });

      if (secondError) throw secondError;
      data = secondFallback ?? [];
    } else {
      data = fallbackData;
    }

    return (data ?? []).map((t: any) => ({
      ...t,
      daily_completions: t.daily_completions || [],
      wingmen: (t.wingmen_ids || [])
        .map((id: string) => profiles?.find((p) => p.id === id))
        .filter(Boolean),
    })) as any[];
  }

  if (error) {
    console.error("Error fetching daily tasks with completions. Running fallback query. Error detail:", error.message);
    
    // Fetch daily tasks without querying daily_completions relation if it is missing
    const { data: fallbackData, error: fallbackError } = await supabase
      .from("tasks")
      .select(`
        *,
        owner:profiles!tasks_owner_id_fkey(id, full_name, email, avatar_url),
        owner2:profiles!tasks_owner2_id_fkey(id, full_name, email, avatar_url)
      `)
      .eq("status", "oscar_delta")
      .eq("is_archived", false)
      .order("created_at", { ascending: false });

    if (fallbackError) throw fallbackError;
    return (fallbackData ?? []).map((t: any) => ({
      ...t,
      daily_completions: [],
      wingmen: (t.wingmen_ids || [])
        .map((id: string) => profiles?.find((p) => p.id === id))
        .filter(Boolean),
    })) as any[];
  }

  return (data ?? []).map((t: any) => ({
    ...t,
    wingmen: (t.wingmen_ids || [])
      .map((id: string) => profiles?.find((p) => p.id === id))
      .filter(Boolean),
  })) as any[];
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
  revalidatePath("/", "layout");
}

// =====================================================================
// DELETE TASK
// =====================================================================
export async function deleteTask(taskId: string) {
  const supabase = await createClient();

  // Fetch logged in user
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  // Fetch task details to check parent task ownership
  const { data: task, error: fetchErr } = await supabase
    .from("tasks")
    .select("*")
    .eq("id", taskId)
    .single();
  if (fetchErr) throw fetchErr;

  // Restrict deletion of dependency tasks to owner of original task
  if (task.parent_task_id) {
    const { data: parentTask } = await supabase
      .from("tasks")
      .select("owner_id")
      .eq("id", task.parent_task_id)
      .single();

    if (parentTask && parentTask.owner_id !== user.id) {
      throw new Error("Only the owner of the original blocked task can delete this dependency task.");
    }
  }

  const { error } = await supabase
    .from("tasks")
    .delete()
    .eq("id", taskId);

  if (error) throw error;
  revalidatePath("/", "layout");
}

// =====================================================================
// DAILY NOTES
// =====================================================================

export async function saveDailyNote(taskId: string, content: string, dateStr: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data, error } = await supabase
    .from("daily_notes")
    .upsert({
      task_id: taskId,
      author_id: user.id,
      note_date: dateStr,
      content: content.trim()
    }, { onConflict: "task_id,author_id,note_date" })
    .select()
    .single();

  if (error) throw error;
  revalidatePath("/daily");
  return data;
}

export async function getDailyNotes(dateStr: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("daily_notes")
    .select(`
      *,
      author:profiles(id, full_name, avatar_url)
    `)
    .eq("note_date", dateStr);

  if (error) throw error;
  return data;
}

export interface UpdateTaskInput {
  id: string;
  name: string;
  description: string;
  ownerId: string;
  owner2Id?: string | null;
  wingmenIds?: string[];
  dueDate: string;
  priority: PriorityLevel;
  deco: DecoLevel;
  complexity: ComplexityLevel;
  labels: LabelCategory[];
}

export async function updateTask(input: UpdateTaskInput) {
  const supabase = await createClient();

  const { data: updated, error } = await supabase
    .from("tasks")
    .update({
      name: input.name,
      description: input.description,
      owner_id: input.ownerId,
      owner2_id: input.owner2Id || null,
      wingmen_ids: input.wingmenIds || [],
      due_date: input.dueDate,
      priority: input.priority,
      deco: input.deco,
      complexity: input.complexity,
      labels: input.labels,
    })
    .eq("id", input.id)
    .select(`
      *,
      owner:profiles!tasks_owner_id_fkey(id, full_name),
      owner2:profiles!tasks_owner2_id_fkey(id, full_name),
      requested_by_user:profiles!tasks_requested_by_fkey(id, full_name),
      dependencies:task_dependencies(
        id,
        reason,
        depends_on_user:profiles!task_dependencies_depends_on_user_id_fkey(id, full_name),
        linked_task_id
      )
    `)
    .single();

  if (error) throw error;

  // Resolve wingmen profiles in memory
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, full_name, email, avatar_url");

  const updatedWithWingmen = {
    ...updated,
    wingmen: (updated.wingmen_ids || [])
      .map((id: string) => profiles?.find((p) => p.id === id))
      .filter(Boolean),
  };

  revalidatePath("/", "layout");
  return updatedWithWingmen as Task;
}

export async function saveTaskNote(taskId: string, content: string) {
  if (content.trim().length <= 10) {
    throw new Error("Note content must exceed 10 characters.");
  }
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data, error } = await supabase
    .from("task_notes")
    .insert({
      task_id: taskId,
      author_id: user.id,
      content: content.trim(),
    })
    .select(`
      *,
      author:profiles(id, full_name, avatar_url)
    `)
    .single();

  if (error) throw error;
  return data;
}

export async function getTaskNotes(taskId: string) {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("task_notes")
      .select(`
        *,
        author:profiles(id, full_name, avatar_url)
      `)
      .eq("task_id", taskId)
      .order("created_at", { ascending: false });

    if (error) {
      console.warn("Returning empty array as fallback for getTaskNotes due to API/Schema cache error:", error.message);
      return [];
    }
    return data || [];
  } catch (err) {
    console.warn("Fallback getTaskNotes due to missing table task_notes:", err);
    return [];
  }
}

export async function archiveTask(taskId: string, isArchived: boolean = true) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tasks")
    .update({ is_archived: isArchived })
    .eq("id", taskId)
    .select()
    .single();

  if (error) throw error;
  revalidatePath("/", "layout");
  return data as Task;
}

export async function getArchivedTasks() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tasks")
    .select(`
      *,
      owner:profiles!tasks_owner_id_fkey(id, full_name, email, avatar_url),
      owner2:profiles!tasks_owner2_id_fkey(id, full_name, email, avatar_url),
      requested_by_user:profiles!tasks_requested_by_fkey(id, full_name, email, avatar_url)
    `)
    .eq("is_archived", true)
    .order("updated_at", { ascending: false });

  if (error) throw error;

  // Fetch profiles to resolve wingmen in memory
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, full_name, email, avatar_url");

  return (data ?? []).map((t: any) => ({
    ...t,
    wingmen: (t.wingmen_ids || [])
      .map((id: string) => profiles?.find((p) => p.id === id))
      .filter(Boolean),
  })) as Task[];
}