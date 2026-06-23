// app/(dashboard)/leaderboard/leaderboard-tabs.tsx
"use client";

import { useState, Fragment } from "react";
import { cn } from "@/lib/utils";
import { Trophy, Target, Award, Star, ChevronDown, ChevronUp } from "lucide-react";
import { PRIORITY_CONFIG, DECO_CONFIG, type PriorityLevel, type DecoLevel } from "@/lib/types";

interface ContributedTask {
  task_id: string;
  task_name: string;
  priority: PriorityLevel;
  deco: DecoLevel;
  score: number;
  completed_at: string;
  due_date: string;
  days_early: number;
}

interface LeaderboardEntry {
  userId: string;
  full_name: string;
  totalPoints: number;
  tasksCompleted: number;
  bestScore: number;
  avgScore: number;
  tasks: ContributedTask[];
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
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);

  const dataMap = {
    weekly,
    monthly,
    all_time: allTime,
  };

  const currentData = dataMap[activeTab];

  // Calculate My Stats
  const myAllTimeEntry = allTime.find((e) => e.userId === currentUserId);
  const myWeeklyEntry = weekly.find((e) => e.userId === currentUserId);
  const myWeeklyRankIndex = weekly.findIndex((e) => e.userId === currentUserId);

  const myStats = {
    totalPoints: myAllTimeEntry ? Math.round(myAllTimeEntry.totalPoints * 100) / 100 : 0,
    tasksCompletedThisWeek: myWeeklyEntry ? myWeeklyEntry.tasksCompleted : 0,
    rankThisWeek: myWeeklyRankIndex !== -1 ? myWeeklyRankIndex + 1 : "N/A",
    bestScoreEver: myAllTimeEntry ? myAllTimeEntry.bestScore : 0,
  };

  const tabs = [
    { id: "weekly", label: "This Week" },
    { id: "monthly", label: "This Month" },
    { id: "all_time", label: "All Time" },
  ] as const;

  return (
    <div className="space-y-6">
      {/* My Stats Card Dashboard */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Total Points (All Time) */}
        <div
          className="rounded-xl border border-zinc-800 p-5 flex items-center justify-between shadow-lg"
          style={{ backgroundColor: "#2D2D2D" }}
        >
          <div className="space-y-1">
            <p className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Total Points (All Time)</p>
            <p className="text-2xl font-bold text-yellow-400">{myStats.totalPoints} pts</p>
          </div>
          <div className="h-10 w-10 rounded-full bg-yellow-500/10 flex items-center justify-center text-yellow-500">
            <Trophy className="h-5 w-5" />
          </div>
        </div>

        {/* My Rank This Week */}
        <div
          className="rounded-xl border border-zinc-800 p-5 flex items-center justify-between shadow-lg"
          style={{ backgroundColor: "#2D2D2D" }}
        >
          <div className="space-y-1">
            <p className="text-xs font-medium text-zinc-400 uppercase tracking-wider">My Rank (This Week)</p>
            <p className="text-2xl font-bold text-purple-400">
              {myStats.rankThisWeek !== "N/A" ? `#${myStats.rankThisWeek}` : "N/A"}
            </p>
          </div>
          <div className="h-10 w-10 rounded-full bg-purple-500/10 flex items-center justify-center text-purple-500">
            <Award className="h-5 w-5" />
          </div>
        </div>

        {/* Completed This Week */}
        <div
          className="rounded-xl border border-zinc-800 p-5 flex items-center justify-between shadow-lg"
          style={{ backgroundColor: "#2D2D2D" }}
        >
          <div className="space-y-1">
            <p className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Completed (This Week)</p>
            <p className="text-2xl font-bold text-blue-400">{myStats.tasksCompletedThisWeek} tasks</p>
          </div>
          <div className="h-10 w-10 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-500">
            <Target className="h-5 w-5" />
          </div>
        </div>

        {/* Best Single Score Ever */}
        <div
          className="rounded-xl border border-zinc-800 p-5 flex items-center justify-between shadow-lg"
          style={{ backgroundColor: "#2D2D2D" }}
        >
          <div className="space-y-1">
            <p className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Best Score Ever</p>
            <p className="text-2xl font-bold text-green-400">{myStats.bestScoreEver} pts</p>
          </div>
          <div className="h-10 w-10 rounded-full bg-green-500/10 flex items-center justify-center text-green-400">
            <Star className="h-5 w-5" />
          </div>
        </div>
      </div>

      {/* Tabs Trigger */}
      <div className="flex border-b border-zinc-800">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => {
              setActiveTab(tab.id);
              setExpandedUserId(null);
            }}
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
                  <th className="px-6 py-4 font-semibold text-right">Best Single Score</th>
                  <th className="px-6 py-4 font-semibold text-right">Avg Score / Task</th>
                  <th className="px-6 py-4 text-center w-12"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800">
                {currentData.map((entry, index) => {
                  const rank = index + 1;
                  const isCurrentUser = entry.userId === currentUserId;
                  const isExpanded = expandedUserId === entry.userId;

                  return (
                    <Fragment key={entry.userId}>
                      <tr
                        onClick={() => setExpandedUserId(isExpanded ? null : entry.userId)}
                        className={cn(
                          "transition-colors hover:bg-zinc-800/40 cursor-pointer select-none border-b border-zinc-800/50",
                          isCurrentUser && "bg-blue-600/10 hover:bg-blue-600/20 text-white font-medium border-l-4 border-l-blue-600"
                        )}
                      >
                        <td className="px-6 py-4 text-center font-medium">
                          <span className="flex items-center justify-center">
                            {rank === 1 && <span className="text-xl" title="1st Place">🥇</span>}
                            {rank === 2 && <span className="text-xl" title="2nd Place">🥈</span>}
                            {rank === 3 && <span className="text-xl" title="3rd Place">🥉</span>}
                            {rank > 3 && <span className="text-sm font-semibold text-zinc-400">#{rank}</span>}
                          </span>
                        </td>
                        <td className="px-6 py-4 flex items-center gap-3">
                          <div className="h-7 w-7 rounded-full bg-zinc-750 flex items-center justify-center text-xs font-semibold text-zinc-200 border border-zinc-700">
                            {entry.full_name.substring(0, 2).toUpperCase()}
                          </div>
                          <span className={cn(isCurrentUser && "font-bold text-blue-400")}>{entry.full_name}</span>
                          {isCurrentUser && (
                            <span className="text-[9px] bg-blue-600 text-white px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">
                              You
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-right font-bold text-yellow-400">
                          {entry.totalPoints}
                        </td>
                        <td className="px-6 py-4 text-right text-zinc-200">
                          {entry.tasksCompleted}
                        </td>
                        <td className="px-6 py-4 text-right text-green-400 font-semibold">
                          {entry.bestScore}
                        </td>
                        <td className="px-6 py-4 text-right text-zinc-400">
                          {entry.avgScore}
                        </td>
                        <td className="px-6 py-4 text-center">
                          {isExpanded ? (
                            <ChevronUp className="h-4 w-4 text-zinc-500" />
                          ) : (
                            <ChevronDown className="h-4 w-4 text-zinc-500" />
                          )}
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr className="bg-zinc-900/60">
                          <td colSpan={7} className="px-8 py-4">
                            <div className="border border-zinc-800 rounded-lg overflow-hidden shadow-inner">
                              {entry.tasks.length === 0 ? (
                                <div className="p-4 text-center text-xs text-zinc-500">
                                  No completed tasks in this period.
                                </div>
                              ) : (
                                <table className="w-full text-xs text-left text-zinc-300">
                                  <thead className="bg-[#1A1A1A] text-zinc-400 text-[10px] uppercase tracking-wider border-b border-zinc-800">
                                    <tr>
                                      <th className="px-4 py-2 font-semibold">Task Name</th>
                                      <th className="px-4 py-2 font-semibold w-24">Priority</th>
                                      <th className="px-4 py-2 font-semibold w-28">DECO</th>
                                      <th className="px-4 py-2 font-semibold text-right w-20">Score</th>
                                      <th className="px-4 py-2 font-semibold text-right w-36">Completed Date</th>
                                      <th className="px-4 py-2 font-semibold text-right w-28">Days Early</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-zinc-850">
                                    {entry.tasks.map((task) => {
                                      const pConfig = PRIORITY_CONFIG[task.priority];
                                      const dConfig = DECO_CONFIG[task.deco];

                                      return (
                                        <tr key={task.task_id} className="hover:bg-zinc-800/20">
                                          <td className="px-4 py-2.5 font-medium text-zinc-200">
                                            {task.task_name}
                                          </td>
                                          <td className="px-4 py-2.5">
                                            <span
                                              className="inline-flex items-center rounded-full px-2 py-0.5 text-[9px] font-semibold border"
                                              style={{
                                                borderColor: `${pConfig?.color}40`,
                                                backgroundColor: `${pConfig?.color}15`,
                                                color: pConfig?.color,
                                              }}
                                            >
                                              {task.priority}
                                            </span>
                                          </td>
                                          <td className="px-4 py-2.5">
                                            <span
                                              className="inline-flex items-center rounded-full px-2 py-0.5 text-[9px] font-semibold border"
                                              style={{
                                                borderColor: `${dConfig?.color}40`,
                                                backgroundColor: `${dConfig?.color}15`,
                                                color: dConfig?.color,
                                              }}
                                            >
                                              {dConfig?.label}
                                            </span>
                                          </td>
                                          <td className="px-4 py-2.5 text-right font-bold text-yellow-400">
                                            {task.score} pts
                                          </td>
                                          <td className="px-4 py-2.5 text-right text-zinc-400">
                                            {task.completed_at
                                              ? new Date(task.completed_at).toLocaleDateString("en-US", {
                                                  month: "short",
                                                  day: "numeric",
                                                  year: "numeric",
                                                })
                                              : "—"}
                                          </td>
                                          <td className="px-4 py-2.5 text-right font-medium">
                                            {task.days_early > 0 ? (
                                              <span className="text-green-400">+{task.days_early}d early</span>
                                            ) : task.days_early === 0 ? (
                                              <span className="text-zinc-400">On due date</span>
                                            ) : (
                                              <span className="text-red-400">{Math.abs(task.days_early)}d late</span>
                                            )}
                                          </td>
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
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
