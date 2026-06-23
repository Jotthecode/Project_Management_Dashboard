// app/(dashboard)/leaderboard/leaderboard-tabs.tsx
"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { Trophy, Target, Star, Award } from "lucide-react";

interface LeaderboardEntry {
  userId: string;
  full_name: string;
  totalPoints: number;
  tasksCompleted: number;
}

interface LeaderboardTabsProps {
  currentUserId: string;
  weekly: LeaderboardEntry[];
  monthly: LeaderboardEntry[];
  allTime: LeaderboardEntry[];
}

export function LeaderboardTabs({
  currentUserId,
  weekly,
  monthly,
  allTime,
}: LeaderboardTabsProps) {
  const [activeTab, setActiveTab] = useState<"weekly" | "monthly" | "all_time">("weekly");

  const dataMap = {
    weekly,
    monthly,
    all_time: allTime,
  };

  const currentData = dataMap[activeTab];

  // Calculate My Stats
  const myAllTimeEntry = allTime.find((e) => e.userId === currentUserId);
  const myWeeklyEntry = weekly.find((e) => e.userId === currentUserId);
  const myCurrentRankIndex = currentData.findIndex((e) => e.userId === currentUserId);

  const myStats = {
    totalPoints: myAllTimeEntry ? Math.round(myAllTimeEntry.totalPoints * 100) / 100 : 0,
    tasksCompletedThisWeek: myWeeklyEntry ? myWeeklyEntry.tasksCompleted : 0,
    currentRank: myCurrentRankIndex !== -1 ? myCurrentRankIndex + 1 : "N/A",
  };

  const tabs = [
    { id: "weekly", label: "Weekly" },
    { id: "monthly", label: "Monthly" },
    { id: "all_time", label: "All Time" },
  ] as const;

  return (
    <div className="space-y-6">
      {/* My Stats Card */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div
          className="rounded-xl border border-zinc-800 p-5 flex items-center justify-between shadow-lg"
          style={{ backgroundColor: "#2D2D2D" }}
        >
          <div className="space-y-1">
            <p className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Total Points</p>
            <p className="text-2xl font-bold text-yellow-400">{myStats.totalPoints} pts</p>
          </div>
          <div className="h-10 w-10 rounded-full bg-yellow-500/10 flex items-center justify-center text-yellow-500">
            <Trophy className="h-5 w-5" />
          </div>
        </div>

        <div
          className="rounded-xl border border-zinc-800 p-5 flex items-center justify-between shadow-lg"
          style={{ backgroundColor: "#2D2D2D" }}
        >
          <div className="space-y-1">
            <p className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Completed This Week</p>
            <p className="text-2xl font-bold text-blue-400">{myStats.tasksCompletedThisWeek} tasks</p>
          </div>
          <div className="h-10 w-10 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-500">
            <Target className="h-5 w-5" />
          </div>
        </div>

        <div
          className="rounded-xl border border-zinc-800 p-5 flex items-center justify-between shadow-lg"
          style={{ backgroundColor: "#2D2D2D" }}
        >
          <div className="space-y-1">
            <p className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Current Rank ({activeTab === "all_time" ? "All Time" : activeTab})</p>
            <p className="text-2xl font-bold text-purple-400">
              {myStats.currentRank !== "N/A" ? `#${myStats.currentRank}` : "N/A"}
            </p>
          </div>
          <div className="h-10 w-10 rounded-full bg-purple-500/10 flex items-center justify-center text-purple-500">
            <Award className="h-5 w-5" />
          </div>
        </div>
      </div>

      {/* Tabs Trigger */}
      <div className="flex border-b border-zinc-800">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "px-4 py-2 text-sm font-semibold border-b-2 transition-colors -mb-px",
              activeTab === tab.id
                ? "border-blue-600 text-blue-400"
                : "border-transparent text-zinc-400 hover:text-zinc-200"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Leaderboard Table */}
      <div className="rounded-xl border border-zinc-800 overflow-hidden shadow-lg" style={{ backgroundColor: "#2D2D2D" }}>
        {currentData.length === 0 ? (
          <div className="p-8 text-center text-zinc-500">
            No tasks completed in this time range yet. Complete tasks on the board to earn points!
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left text-zinc-300">
              <thead className="bg-[#1A1A1A]/80 text-zinc-400 text-xs uppercase tracking-wider">
                <tr>
                  <th className="px-6 py-4 font-semibold text-center w-20">Rank</th>
                  <th className="px-6 py-4 font-semibold">Name</th>
                  <th className="px-6 py-4 font-semibold text-right">Total Points</th>
                  <th className="px-6 py-4 font-semibold text-right">Tasks Completed</th>
                  <th className="px-6 py-4 font-semibold text-right">Avg Score / Task</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800">
                {currentData.map((entry, index) => {
                  const rank = index + 1;
                  const isCurrentUser = entry.userId === currentUserId;
                  const avgScore = entry.tasksCompleted > 0
                    ? Math.round((entry.totalPoints / entry.tasksCompleted) * 100) / 100
                    : 0;

                  return (
                    <tr
                      key={entry.userId}
                      className={cn(
                        "transition-colors hover:bg-zinc-800/40",
                        isCurrentUser && "bg-blue-600/10 border-l-4 border-l-blue-600 text-white font-medium"
                      )}
                    >
                      <td className="px-6 py-4 text-center">
                        <span className="flex items-center justify-center">
                          {rank === 1 && <span className="text-xl" title="1st Place">🥇</span>}
                          {rank === 2 && <span className="text-xl" title="2nd Place">🥈</span>}
                          {rank === 3 && <span className="text-xl" title="3rd Place">🥉</span>}
                          {rank > 3 && <span className="text-sm font-semibold text-zinc-400">#{rank}</span>}
                        </span>
                      </td>
                      <td className="px-6 py-4 flex items-center gap-3">
                        <div className="h-7 w-7 rounded-full bg-zinc-700 flex items-center justify-center text-xs font-semibold text-zinc-200">
                          {entry.full_name.substring(0, 2).toUpperCase()}
                        </div>
                        <span>{entry.full_name}</span>
                        {isCurrentUser && (
                          <span className="text-[10px] bg-blue-600 text-white px-1.5 py-0.5 rounded font-bold uppercase">
                            You
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right font-bold text-yellow-400">
                        {Math.round(entry.totalPoints * 100) / 100}
                      </td>
                      <td className="px-6 py-4 text-right text-zinc-200">
                        {entry.tasksCompleted}
                      </td>
                      <td className="px-6 py-4 text-right text-zinc-400">
                        {avgScore}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
