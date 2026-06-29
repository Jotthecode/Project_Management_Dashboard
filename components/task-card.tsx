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
  const duration = DECO_CONFIG[task.deco || "medium"];
  const complexity = DECO_CONFIG[task.complexity || "medium"];
  const isCompleted = task.status === "tango_charlie";

  // PRD: "Dependency on:: User Name" — render for each dependency this task has
  const dependencyNames = task.dependencies?.map((d) => d.depends_on_user?.full_name).filter(Boolean);
  
  const allOwners = [
    task.owner?.full_name,
    ...(task.wingmen?.map((w) => w.full_name) || [])
  ].filter(Boolean);
  const ownerNames = allOwners.join(", ");

  return (
    <div
      draggable={draggable}
      onDragStart={(e) => onDragStart?.(e, task)}
      onClick={() => onClick?.(task)}
      className={cn(
        "rounded-lg p-3 cursor-pointer border transition-colors",
        isCompleted 
          ? "border-emerald-300 dark:border-emerald-800/80 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-900 dark:text-emerald-100 hover:border-emerald-450 dark:hover:border-emerald-700/80" 
          : "border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-50 hover:border-zinc-300 dark:hover:border-zinc-700",
        task.is_blocked && "ring-1 ring-red-500/60"
      )}
    >
      {/* Priority + Duration + Complexity badges */}
      <div className="flex flex-wrap items-center gap-1.5 mb-2">
        <span
          className="inline-flex items-center rounded-full px-2 py-0.5 text-[9px] font-semibold border transition-all"
          style={{
            borderColor: `${priority.color}40`,
            backgroundColor: `${priority.color}15`,
            color: priority.color,
          }}
          title={`Priority: ${priority.label}`}
        >
          {task.priority}
        </span>
        <span
          className="inline-flex items-center rounded-full px-2 py-0.5 text-[9px] font-semibold border transition-all"
          style={{
            borderColor: `${duration.color}40`,
            backgroundColor: `${duration.color}15`,
            color: duration.color,
          }}
          title={`Duration: ${duration.label} (${duration.duration})`}
        >
          ⏱️ {duration.label}
        </span>
        <span
          className="inline-flex items-center rounded-full px-2 py-0.5 text-[9px] font-semibold border transition-all"
          style={{
            borderColor: `${complexity.color}40`,
            backgroundColor: `${complexity.color}15`,
            color: complexity.color,
          }}
          title={`Complexity: ${complexity.label}`}
        >
          🧠 {complexity.label}
        </span>
      </div>

      {/* External Dependency and Blocking visibility */}
      {(task.is_blocked || task.parent_task_id) && (
        <div className="flex flex-wrap gap-1 mb-2">
          {task.is_blocked && (
            <Badge className="bg-red-950/60 hover:bg-red-950/60 border border-red-500/40 text-red-400 text-[9px] font-bold px-1.5 py-0 rounded flex items-center gap-0.5">
              ⚠️ Waiting on Dep
            </Badge>
          )}
          {task.parent_task_id && (
            <Badge className="bg-purple-950/60 hover:bg-purple-950/60 border border-purple-500/40 text-purple-400 text-[9px] font-bold px-1.5 py-0 rounded flex items-center gap-0.5">
              🛑 Blocking Task
            </Badge>
          )}
        </div>
      )}

      {/* Name */}
      <h4 className={cn(
        "text-sm font-medium leading-snug mb-1",
        isCompleted && "text-emerald-950 dark:text-emerald-50 line-through decoration-emerald-500/30"
      )}>
        {task.name}
      </h4>

      {/* Description preview */}
      {task.description && (
        <p className={cn(
          "text-xs line-clamp-2 mb-2",
          isCompleted ? "text-emerald-800/90 dark:text-emerald-400" : "text-zinc-400"
        )}>
          {task.description}
        </p>
      )}

      {/* Labels */}
      {task.labels?.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {task.labels?.map((label) => (
            <Badge
              key={label}
              variant="outline"
              className="text-[9px] px-1.5 py-0 border-zinc-650 text-zinc-300"
            >
              {LABEL_CONFIG[label]?.label ?? label}
            </Badge>
          ))}
        </div>
      )}

      {/* Blocked reason */}
      {task.is_blocked && task.blocked_reason && (
        <p className="text-[11px] text-red-400 mb-2 font-medium">Waiting for: {task.blocked_reason}</p>
      )}

      {/* Dependency Info */}
      {task.dependencies && task.dependencies.length > 0 && (
        <div className="flex flex-col gap-1.5 mb-2 pt-2 border-t border-zinc-800/60 animate-in fade-in text-[10px] text-zinc-400">
          <div className="text-[10px] font-bold text-blue-400 flex items-center gap-1 uppercase tracking-wider">
            <Link2 className="h-3 w-3" />
            <span>Dependency Details</span>
          </div>
          {task.dependencies.map((dep) => (
            <div key={dep.id} className="flex flex-col pl-2 border-l border-zinc-700/60 leading-normal">
              <div>
                To Whom: <strong className="text-zinc-300">{dep.depends_on_user?.full_name || "Unknown"}</strong>
              </div>
              <div className="text-zinc-400 mt-0.5">
                For: <span className="text-blue-300 italic">"{dep.reason}"</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Score badge for completed tasks */}
      {task.score != null && (
        <div className="flex items-center gap-1 text-[11px] text-yellow-400 mb-2">
          <Trophy className="h-3 w-3" />
          <span>{task.score} pts</span>
        </div>
      )}

      {/* Footer: owner(s) + due date */}
      <div className="flex items-center justify-between text-[11px] text-zinc-400 mt-1">
        <span className="truncate max-w-[65%]" title={ownerNames}>
          {ownerNames || "Unassigned"}
        </span>
        <span>{task.due_date ? new Date(task.due_date).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" }) : "No due date"}</span>
      </div>
    </div>
  );
}
