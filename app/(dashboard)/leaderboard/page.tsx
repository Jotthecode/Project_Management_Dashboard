import { createClient } from "@/lib/supabase-server";
import { getLeaderboard } from "@/actions/tasks";
import { redirect } from "next/navigation";
import { LeaderboardTabs } from "./leaderboard-tabs";

export const dynamic = "force-dynamic";

export default async function LeaderboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Fetch all leaderboard ranges in parallel
  const [weekly, monthly, allTime] = await Promise.all([
    getLeaderboard("weekly"),
    getLeaderboard("monthly"),
    getLeaderboard("all_time"),
  ]);

  return (
    <main className="h-screen w-full overflow-y-auto flex flex-col p-6 space-y-6" style={{ backgroundColor: "#1E1E1E" }}>
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight">Leaderboard</h1>
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
