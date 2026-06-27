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
    task.owner2?.full_name,
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
          ? "border-emerald-800/40 hover:border-emerald-500/60" 
          : "border-transparent hover:border-zinc-600",
        task.is_blocked && "ring-1 ring-red-500/60"
      )}
      style={{ 
        backgroundColor: isCompleted ? "#1b4332" : "#2D2D2D", 
        color: "#FFFFFF" 
      }}
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
      <h4 className="text-sm font-medium leading-snug mb-1">{task.name}</h4>

      {/* Description preview */}
      {task.description && (
        <p className="text-xs text-zinc-400 line-clamp-2 mb-2">{task.description}</p>
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
        <div className="flex flex-col gap-0.5 mb-2 animate-in fade-in">
          {dependencyNames && dependencyNames.length > 0 && (
            <div className="flex items-center gap-1 text-[11px] text-blue-400">
              <Link2 className="h-3 w-3" />
              <span>Dependency on:: {dependencyNames.join(", ")}</span>
            </div>
          )}
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
        <span>{new Date(task.due_date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
      </div>
    </div>
  );
}
