// components/task-card.tsx
"use client";

import { Task, PRIORITY_CONFIG, DECO_CONFIG, LABEL_CONFIG } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Link2, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";

interface TaskCardProps {
  task: Task;
  onClick?: (task: Task) => void;
  draggable?: boolean;
  onDragStart?: (e: React.DragEvent, task: Task) => void;
}

export function TaskCard({ task, onClick, draggable = true, onDragStart }: TaskCardProps) {
  const priority = PRIORITY_CONFIG[task.priority];
  const deco = DECO_CONFIG[task.deco];

  // PRD: "Dependency on:: User Name" — render for each dependency this task has
  const dependencyNames = task.dependencies?.map((d) => d.depends_on_user?.full_name).filter(Boolean);

  return (
    <div
      draggable={draggable}
      onDragStart={(e) => onDragStart?.(e, task)}
      onClick={() => onClick?.(task)}
      className={cn(
        "rounded-lg p-3 cursor-pointer border border-transparent transition-colors",
        "hover:border-zinc-600",
        task.is_blocked && "ring-1 ring-red-500/60"
      )}
      style={{ backgroundColor: "#2D2D2D", color: "#FFFFFF" }}
    >
      {/* Priority + DECO strip */}
      <div className="flex items-center gap-1.5 mb-2">
        <span
          className="h-2 w-2 rounded-full"
          style={{ backgroundColor: priority.color }}
          title={`Priority: ${priority.label}`}
        />
        <span
          className="h-2 w-2 rounded-full"
          style={{ backgroundColor: deco.color }}
          title={`DECO: ${deco.label} (${deco.duration})`}
        />
        {task.is_blocked && (
          <span className="ml-auto flex items-center gap-1 text-xs text-red-400">
            <AlertTriangle className="h-3 w-3" />
            Dependency
          </span>
        )}
      </div>

      {/* Name */}
      <h4 className="text-sm font-medium leading-snug mb-1">{task.name}</h4>

      {/* Description preview */}
      {task.description && (
        <p className="text-xs text-zinc-400 line-clamp-2 mb-2">{task.description}</p>
      )}

      {/* Labels & Linked task */}
      {(task.parent_task_id || task.labels?.length > 0) && (
        <div className="flex flex-wrap gap-1 mb-2">
          {task.parent_task_id && (
            <Badge className="text-[10px] px-1.5 py-0 bg-purple-600 hover:bg-purple-600 text-white font-bold">
              ⬆ Linked task
            </Badge>
          )}
          {task.labels?.map((label) => (
            <Badge
              key={label}
              variant="outline"
              className="text-[10px] px-1.5 py-0 border-zinc-600 text-zinc-300"
            >
              {LABEL_CONFIG[label].label}
            </Badge>
          ))}
        </div>
      )}

      {/* Blocked reason */}
      {task.is_blocked && task.blocked_reason && (
        <p className="text-[11px] text-red-400 mb-2">Waiting for: {task.blocked_reason}</p>
      )}

      {/* Dependency Info */}
      {task.dependencies && task.dependencies.length > 0 && (
        <div className="flex flex-col gap-0.5 mb-2 animate-in fade-in">
          {dependencyNames && dependencyNames.length > 0 && (
            <div className="flex items-center gap-1 text-[11px] text-blue-400">
              <Link2 className="h-3 w-3" />
              <span>Dependency on:: {dependencyNames.join(", ")}</span>
            </div>
          )}
          <div className="text-[10px] text-zinc-400 font-semibold flex items-center gap-1">
            <span>🔗 Waiting on {task.dependencies.length}</span>
          </div>
        </div>
      )}

      {/* Score badge for completed tasks */}
      {task.score != null && (
        <div className="flex items-center gap-1 text-[11px] text-yellow-400 mb-2">
          <Trophy className="h-3 w-3" />
          <span>{task.score} pts</span>
        </div>
      )}

      {/* Footer: owner + due date */}
      <div className="flex items-center justify-between text-[11px] text-zinc-400 mt-1">
        <span className="truncate max-w-[60%]">{task.owner?.full_name ?? "Unassigned"}</span>
        <span>{new Date(task.due_date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
      </div>
    </div>
  );
}
