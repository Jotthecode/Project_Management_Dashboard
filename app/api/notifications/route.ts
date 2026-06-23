// app/api/notifications/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendEmail } from "@/lib/email";

// Initialize a direct Supabase client for background cron execution
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

export async function GET() {
  try {
    // 1. Fetch all profiles, active tasks, and deco weights
    const [tasksRes, profilesRes, decoRes] = await Promise.all([
      supabase
        .from("tasks")
        .select(`
          *,
          owner:profiles!tasks_owner_id_fkey(id, full_name, email)
        `),
      supabase.from("profiles").select("*"),
      supabase.from("deco_weights").select("*"),
    ]);

    if (tasksRes.error) throw tasksRes.error;
    if (profilesRes.error) throw profilesRes.error;
    if (decoRes.error) throw decoRes.error;

    const tasks = tasksRes.data || [];
    const profiles = profilesRes.data || [];
    const decoWeights = decoRes.data || [];

    // Map deco weights for fast lookup
    const decoMaxDaysLookup = decoWeights.reduce((acc: any, curr: any) => {
      acc[curr.deco] = curr.max_days_in_progress;
      return acc;
    }, {});

    const now = new Date();
    const todayStr = now.toISOString().split("T")[0];
    
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split("T")[0];

    const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString();

    let emailsSentCount = 0;

    for (const task of tasks) {
      if (!task.owner?.email) continue;

      const ownerName = task.owner.full_name;
      const ownerEmail = task.owner.email;
      const ownerId = task.owner.id;

      // -------------------------------------------------------------
      // TRIGGER 1: Due Tomorrow
      // -------------------------------------------------------------
      if (task.due_date === tomorrowStr && task.status !== "tango_charlie") {
        await handleEmailTrigger({
          taskId: task.id,
          recipientId: ownerId,
          triggerType: "due_tomorrow",
          toEmail: ownerEmail,
          subject: `Task Due Tomorrow: ${task.name}`,
          html: `<p>Hey ${ownerName},</p><p>'<strong>${task.name}</strong>' is due tomorrow. Please take it up immediately or deactivate if required.</p>`,
          twoHoursAgo,
        });
      }

      // -------------------------------------------------------------
      // TRIGGER 2: Overdue
      // -------------------------------------------------------------
      if (task.due_date < todayStr && task.status !== "tango_charlie" && task.status !== "oscar_delta") {
        const dueTime = new Date(task.due_date).getTime();
        const todayTime = new Date(todayStr).getTime();
        const daysOverdue = Math.max(1, Math.floor((todayTime - dueTime) / (1000 * 60 * 60 * 24)));

        await handleEmailTrigger({
          taskId: task.id,
          recipientId: ownerId,
          triggerType: "overdue",
          toEmail: ownerEmail,
          subject: `Overdue Task: ${task.name}`,
          html: `<p>Hey ${ownerName},</p><p>'<strong>${task.name}</strong>' is overdue by ${daysOverdue} days. Please take it up immediately or deactivate if required.</p>`,
          twoHoursAgo,
        });
      }

      // -------------------------------------------------------------
      // TRIGGER 3: Stuck in Progress (DECO exceeded)
      // -------------------------------------------------------------
      if (task.status === "oscar_mike") {
        const maxDays = decoMaxDaysLookup[task.deco] || 5; // fallback to 5 days
        const updatedTime = new Date(task.updated_at).getTime();
        const nowTime = now.getTime();
        const daysInProgress = Math.floor((nowTime - updatedTime) / (1000 * 60 * 60 * 24));

        if (daysInProgress > maxDays) {
          await handleEmailTrigger({
            taskId: task.id,
            recipientId: ownerId,
            triggerType: "deco_exceeded",
            toEmail: ownerEmail,
            subject: `Task Stalled: ${task.name}`,
            html: `<p>Hey ${ownerName},</p><p>'<strong>${task.name}</strong>' has been in progress (Oscar Mike) for ${daysInProgress} days, which exceeds its DECO duration limit of ${maxDays} days.</p>`,
            twoHoursAgo,
          });
        }
      }

      // -------------------------------------------------------------
      // TRIGGER 5: Review Pending 48h
      // -------------------------------------------------------------
      if (task.status === "india_romeo") {
        const updatedTime = new Date(task.updated_at).getTime();
        const nowTime = now.getTime();
        const hoursInReview = (nowTime - updatedTime) / (1000 * 60 * 60);

        if (hoursInReview > 48) {
          await handleEmailTrigger({
            taskId: task.id,
            recipientId: ownerId,
            triggerType: "review_pending_48h",
            toEmail: ownerEmail,
            subject: `Task Awaiting Review: ${task.name}`,
            html: `<p>Hey ${ownerName},</p><p>'<strong>${task.name}</strong>' has been in review (India Romeo) for more than 48 hours. Please review and complete it.</p>`,
            twoHoursAgo,
          });
        }
      }
    }

    async function handleEmailTrigger({
      taskId,
      recipientId,
      triggerType,
      toEmail,
      subject,
      html,
      twoHoursAgo,
    }: {
      taskId: string;
      recipientId: string;
      triggerType: string;
      toEmail: string;
      subject: string;
      html: string;
      twoHoursAgo: string;
    }) {
      // 1. Check if email of the same type for this task was sent in the last 2 hours
      const { data: logs, error: logErr } = await supabase
        .from("email_trigger_log")
        .select("id")
        .eq("task_id", taskId)
        .eq("trigger_type", triggerType)
        .gte("sent_at", twoHoursAgo)
        .limit(1);

      if (logErr) {
        console.error("Deduplication select error:", logErr);
        return;
      }

      if (logs && logs.length > 0) {
        // Skip - already sent recently
        return;
      }

      // 2. Dispatch email
      const emailResult = await sendEmail({ to: toEmail, subject, html });

      if (emailResult.success) {
        emailsSentCount++;
        // 3. Log execution
        const { error: insertErr } = await supabase.from("email_trigger_log").insert({
          task_id: taskId,
          recipient_id: recipientId,
          trigger_type: triggerType,
          sent_at: new Date().toISOString(),
        });
        if (insertErr) {
          console.error("Failed to write to email_trigger_log:", insertErr);
        }
      }
    }

    return NextResponse.json({
      success: true,
      processed: tasks.length,
      emailsSent: emailsSentCount,
    });
  } catch (err: any) {
    console.error("Cron notification execution error:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Internal server error" },
      { status: 500 }
    );
  }
}
