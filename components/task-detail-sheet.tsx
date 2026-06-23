// components/task-detail-sheet.tsx
"use client";

import { useState, useTransition } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Task,
  PRIORITY_CONFIG,
  DECO_CONFIG,
  LABEL_CONFIG,
  STATUS_CONFIG,
  calculateScore,
} from "@/lib/types";
import { setBlocked, resolveDependency, deleteTask } from "@/actions/tasks";
import { Link2, Trophy, AlertTriangle, Users, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

interface TaskDetailSheetProps {
  task: Task | null;
  allTasks: Task[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdated: (task: Task) => void;
  onDeleted?: (taskId: string) => void;
}

export function TaskDetailSheet({
  task,
  allTasks,
  open,
  onOpenChange,
  onUpdated,
  onDeleted,
}: TaskDetailSheetProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [reasonDraft, setReasonDraft] = useState(task?.blocked_reason ?? "");

  function handleResolveDependency(dependencyId: string) {
    startTransition(async () => {
      try {
        await resolveDependency(dependencyId);
        toast.success("Dependency resolved successfully!");
        router.refresh();
        onOpenChange(false);
      } catch (err: any) {
        toast.error("Failed to resolve dependency", {
          description: err.message || "Something went wrong.",
        });
      }
    });
  }

  function renderDependencyNode(dep: any, depth = 0) {
    const linkedTask = dep.linked_task_id
      ? allTasks.find((t) => t.id === dep.linked_task_id)
      : null;
    const statusLabel = linkedTask
      ? STATUS_CONFIG[linkedTask.status].label
      : "Unknown";

    return (
      <div key={dep.id} style={{ marginLeft: `${depth * 10}px` }} className="space-y-1 mt-2 border-l border-zinc-700/60 pl-3 py-1 animate-in fade-in">
        <div className="flex items-center justify-between text-xs font-semibold text-zinc-200">
          <span className="flex items-center gap-1.5 truncate max-w-[70%]">
            <span className="text-zinc-500">↳</span>
            {dep.depends_on_user?.full_name}
          </span>
          <Badge variant="outline" className="text-[9px] border-zinc-700 bg-zinc-800 text-zinc-400 px-1 py-0 h-4 uppercase">
            {statusLabel}
          </Badge>
        </div>
        <p className="text-[11px] text-zinc-500 italic pl-3 leading-normal">For: {dep.reason}</p>
        
        <Button
          size="sm"
          variant="link"
          disabled={isPending}
          onClick={() => handleResolveDependency(dep.id)}
          className="h-5 text-[10px] text-red-400 hover:text-red-300 p-0 pl-3 flex justify-start underline decoration-red-400/30"
        >
          Mark dependency resolved
        </Button>

        {/* Nested child dependencies */}
        {linkedTask?.dependencies && linkedTask.dependencies.length > 0 && (
          <div className="space-y-1 mt-1 pl-1">
            {linkedTask.dependencies.map((childDep: any) => renderDependencyNode(childDep, depth + 1))}
          </div>
        )}
      </div>
    );
  }

  if (!task) return null;

  const taskId = task.id;

  const priority = PRIORITY_CONFIG[task.priority];
  const deco = DECO_CONFIG[task.deco];

  // Projected score if completed today (for in-progress visibility)
  const projectedScore =
    task.status !== "tango_charlie"
      ? calculateScore(task.priority, task.deco, task.due_date, new Date().toISOString().split("T")[0])
      : task.score;

  const due = new Date(task.due_date);
  const completed = task.completed_at ? new Date(task.completed_at.split('T')[0]) : new Date(new Date().toISOString().split("T")[0]);
  const msPerDay = 1000 * 60 * 60 * 24;
  const daysEarly = Math.round((due.getTime() - completed.getTime()) / msPerDay);

  let bonus = 0;
  if (daysEarly > 10) bonus = 10;
  else if (daysEarly > 0) bonus = daysEarly;
  else if (daysEarly === 0) bonus = 1;
  else bonus = 0;

  // Find the parent task (if this task was auto-created via dependency automation)
  const parentTask = task.parent_task_id
    ? allTasks.find((t) => t.id === task.parent_task_id)
    : null;

  function toggleBlocked(nextBlocked: boolean) {
    startTransition(async () => {
      const updated = await setBlocked(taskId, nextBlocked, nextBlocked ? reasonDraft : undefined);
      onUpdated(updated);
    });
  }

  function handleDelete() {
    if (!window.confirm("Are you sure you want to delete this task? This action cannot be undone.")) {
      return;
    }

    startTransition(async () => {
      try {
        await deleteTask(taskId);
        toast.success("Task deleted successfully");
        onDeleted?.(taskId);
        onOpenChange(false);
      } catch (err: any) {
        toast.error("Failed to delete task", {
          description: err.message || "Something went wrong.",
        });
      }
    });
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-md border-zinc-800"
        style={{ backgroundColor: "#1E1E1E", color: "#FFFFFF" }}
      >
        <SheetHeader>
          <SheetTitle className="text-white">{task.name}</SheetTitle>
          <SheetDescription className="text-zinc-400">{task.description}</SheetDescription>
        </SheetHeader>

        <div className="mt-4 space-y-5 text-sm">
          {/* Owner & due date */}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Owner" value={task.owner?.full_name ?? "Unassigned"} />
            <Field
              label="Due Date"
              value={new Date(task.due_date).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            />
          </div>

          {/* Priority & DECO */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg p-3" style={{ backgroundColor: "#2D2D2D" }}>
              <p className="text-xs text-zinc-400 mb-1">Priority</p>
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: priority.color }} />
                <span>{task.priority} · {priority.label}</span>
              </div>
              <p className="text-[11px] text-zinc-500 mt-1">Weight {priority.weight}</p>
            </div>
            <div className="rounded-lg p-3" style={{ backgroundColor: "#2D2D2D" }}>
              <p className="text-xs text-zinc-400 mb-1">DECO</p>
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: deco.color }} />
                <span>{deco.label}</span>
              </div>
              <p className="text-[11px] text-zinc-500 mt-1">{deco.duration} · Weight {deco.weight}</p>
            </div>
          </div>

          {/* Labels */}
          {task.labels?.length > 0 && (
            <div>
              <p className="text-xs text-zinc-400 mb-1.5">Labels</p>
              <div className="flex flex-wrap gap-1.5">
                {task.labels.map((label) => (
                  <Badge key={label} variant="outline" className="border-zinc-600 text-zinc-300">
                    {LABEL_CONFIG[label].label}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Contributors */}
          {task.contributors && task.contributors.length > 0 && (
            <div>
              <p className="text-xs text-zinc-400 mb-1.5 flex items-center gap-1">
                <Users className="h-3 w-3" /> Contributors
              </p>
              <div className="flex flex-wrap gap-1.5">
                {task.contributors.map((c) => (
                  <Badge key={c.id} variant="secondary" className="bg-zinc-700 text-white">
                    {c.full_name}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Dependency Automation: "Dependency on:: User Name" */}
          {task.dependencies && task.dependencies.length > 0 && (
            <div className="rounded-lg p-3 border border-blue-500/30 bg-blue-500/5">
              <p className="text-xs text-blue-400 mb-1 flex items-center gap-1">
                <Link2 className="h-3 w-3" /> Dependency Tree
              </p>
              <div className="space-y-2 mt-2">
                {task.dependencies.map((dep) => renderDependencyNode(dep, 0))}
              </div>
            </div>
          )}

          {/* If this task was auto-created because someone depends on its owner */}
          {parentTask && (
            <div className="rounded-lg p-3 border border-purple-500/30 bg-purple-500/5 text-sm">
              <p className="text-xs text-purple-400 mb-1.5">Linked Dependency Task</p>
              <p>Requested By: <span className="font-medium">{parentTask.owner?.full_name}</span></p>
              <p>Parent Task: <span className="font-medium">{parentTask.name}</span></p>
              {task.dependency_reason && (
                <p className="text-zinc-400 mt-1">Reason: {task.dependency_reason}</p>
              )}
            </div>
          )}

          {/* Blocked badge */}
          <div className="rounded-lg p-3" style={{ backgroundColor: "#2D2D2D" }}>
            <div className="flex items-center justify-between">
              <p className="text-xs text-zinc-400 flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" /> Blocked Badge
              </p>
              <Button
                size="sm"
                variant={task.is_blocked ? "destructive" : "outline"}
                disabled={isPending}
                onClick={() => toggleBlocked(!task.is_blocked)}
                className={!task.is_blocked ? "border-zinc-600 text-zinc-300" : ""}
              >
                {task.is_blocked ? "Unblock" : "Mark Blocked"}
              </Button>
            </div>
            {task.is_blocked && (
              <input
                className="mt-2 w-full rounded bg-zinc-800 text-sm px-2 py-1.5 text-white placeholder:text-zinc-500 border border-zinc-700"
                placeholder="Reason (e.g. Waiting for API from Aashal)"
                value={reasonDraft}
                onChange={(e) => setReasonDraft(e.target.value)}
                onBlur={() => toggleBlocked(true)}
              />
            )}
          </div>

          {/* Score breakdown card */}
          <div className="rounded-lg p-4 border border-yellow-500/20 bg-yellow-500/5 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-yellow-400 flex items-center gap-1.5">
                <Trophy className="h-4 w-4" />
                {task.status === "tango_charlie" ? "Final Score" : "Projected Score (If Completed Today)"}
              </p>
              <span className="text-xl font-bold text-yellow-400">
                {projectedScore != null ? `${projectedScore} pts` : "0 pts"}
              </span>
            </div>

            <div className="text-xs text-zinc-400 border-t border-zinc-800 pt-2 space-y-2">
              <div>
                <p className="text-[10px] uppercase font-bold text-zinc-500 tracking-wide mb-1">Scoring Formula</p>
                <code className="block bg-zinc-950 p-2 rounded text-zinc-300 font-mono text-[11px] overflow-x-auto whitespace-pre">
                  Priority Weight ({priority.weight}) × DECO Weight ({deco.weight}) × 100 × Bonus ({bonus})
                </code>
              </div>

              <div className="flex flex-col gap-1 text-[11px] bg-zinc-950/40 p-2 rounded border border-zinc-850">
                <div className="flex justify-between">
                  <span className="text-zinc-500">Priority Weight ({task.priority}):</span>
                  <span className="font-semibold text-zinc-300">{priority.weight}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500">DECO Weight ({deco.label}):</span>
                  <span className="font-semibold text-zinc-300">{deco.weight}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500">Days Early:</span>
                  <span className="font-semibold text-zinc-300">
                    {daysEarly > 0 ? `${daysEarly} days early` : daysEarly === 0 ? "On due date" : `${Math.abs(daysEarly)} days late`}
                  </span>
                </div>
                <div className="flex justify-between border-t border-zinc-800 pt-1 mt-1">
                  <span className="text-zinc-400 font-medium">Completion Bonus:</span>
                  <span className="font-bold text-zinc-200">{bonus}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Delete Option */}
          <div className="pt-4 border-t border-zinc-800 flex justify-end">
            <Button
              variant="destructive"
              disabled={isPending}
              onClick={handleDelete}
              className="w-full flex items-center justify-center gap-1.5 py-2 text-xs font-semibold bg-red-650 hover:bg-red-700 text-white rounded-lg transition-colors"
            >
              <Trash2 className="h-4 w-4" />
              Delete Task
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg p-3" style={{ backgroundColor: "#2D2D2D" }}>
      <p className="text-xs text-zinc-400 mb-1">{label}</p>
      <p className="text-sm">{value}</p>
    </div>
  );
}
