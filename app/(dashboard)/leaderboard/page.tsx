import { createClient } from "@/lib/supabase-server";
import { getLeaderboardData } from "@/actions/tasks";
import { redirect } from "next/navigation";
import { LeaderboardTabs } from "./leaderboard-tabs";

export const dynamic = "force-dynamic";

export default async function LeaderboardPage() {
  const supabase = await createClient();
  
  const [userResult, leaderboardData] = await Promise.all([
    supabase.auth.getUser(),
    getLeaderboardData()
  ]);

  const user = userResult.data.user;

  if (!user) {
    redirect("/login");
  }

  const { weekly, monthly, allTime } = leaderboardData;

  return (
    <main className="h-screen w-full overflow-y-auto flex flex-col p-6 space-y-6 bg-background text-foreground">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50 tracking-tight">Leaderboard</h1>
        <p className="text-sm text-zinc-400">Track operations performance and points across the team</p>
      </div>

      <LeaderboardTabs
        currentUserId={user.id}
        weekly={weekly}
        monthly={monthly}
        allTime={allTime}
      />
    </main>
  );
}
