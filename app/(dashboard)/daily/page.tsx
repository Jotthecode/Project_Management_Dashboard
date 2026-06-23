// app/(dashboard)/daily/page.tsx
import { createClient } from "@/lib/supabase-server";
import { getProfiles } from "@/actions/profiles";
import { getDailyTasks } from "@/actions/tasks";
import { redirect } from "next/navigation";
import { DailyPageClient } from "./daily-page-client";

export default async function DailyTasksPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const [profiles, dailyTasks] = await Promise.all([
    getProfiles(),
    getDailyTasks(),
  ]);

  return (
    <main className="h-screen w-full overflow-y-auto flex flex-col p-6 space-y-6" style={{ backgroundColor: "#1E1E1E" }}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Daily Tasks</h1>
          <p className="text-sm text-zinc-400">Oscar Delta — recurring tasks completed daily</p>
        </div>
      </div>

      <DailyPageClient initialTasks={dailyTasks} profiles={profiles} />
    </main>
  );
}
