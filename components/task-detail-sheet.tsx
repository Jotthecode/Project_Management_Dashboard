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
import { setBlocked, resolveDependency } from "@/actions/tasks";
import { Link2, Trophy, AlertTriangle, Users } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

interface TaskDetailSheetProps {
  task: Task | null;
  allTasks: Task[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdated: (task: Task) => void;
}

export function TaskDetailSheet({ task, allTasks, open, onOpenChange, onUpdated }: TaskDetailSheetProps) {
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

          {/* Score */}
          <div className="rounded-lg p-3 flex items-center justify-between" style={{ backgroundColor: "#2D2D2D" }}>
            <p className="text-xs text-zinc-400 flex items-center gap-1">
              <Trophy className="h-3 w-3 text-yellow-400" />
              {task.status === "tango_charlie" ? "Final Score" : "Projected Score (if completed today)"}
            </p>
            <span className="text-lg font-semibold text-yellow-400">
              {projectedScore != null ? `${projectedScore} pts` : "—"}
            </span>
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
