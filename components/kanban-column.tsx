// components/kanban-column.tsx
"use client";

import { Task, TaskStatus, STATUS_CONFIG } from "@/lib/types";
import { TaskCard } from "@/components/task-card";

interface KanbanColumnProps {
  status: TaskStatus;
  tasks: Task[];
  onTaskClick?: (task: Task) => void;
  onDrop?: (taskId: string, newStatus: TaskStatus) => void;
}

export function KanbanColumn({ status, tasks, onTaskClick, onDrop }: KanbanColumnProps) {
  const config = STATUS_CONFIG[status];
  const isRecurring = status === "oscar_delta";

  function handleDragOver(e: React.DragEvent) {
    if (isRecurring) return;
    e.preventDefault();
  }

  function handleDrop(e: React.DragEvent) {
    if (isRecurring) return;
    e.preventDefault();
    const taskId = e.dataTransfer.getData("taskId");
    const fromStatus = e.dataTransfer.getData("fromStatus");
    if (fromStatus === "oscar_delta") return; // OD tasks never move
    if (taskId) onDrop?.(taskId, status);
  }

  function handleDragStart(e: React.DragEvent, task: Task) {
    e.dataTransfer.setData("taskId", task.id);
    e.dataTransfer.setData("fromStatus", task.status);
  }

  return (
    <div
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      className="flex flex-col flex-1 min-w-[280px] max-w-[340px] rounded-xl"
      style={{ backgroundColor: "#1E1E1E" }}
    >
      <div className="px-3 pt-3 pb-2 sticky top-0" style={{ backgroundColor: "#1E1E1E" }}>
        <div className="flex items-baseline justify-between">
          <h3 className="text-sm font-semibold tracking-wide" style={{ color: "#FFFFFF" }}>
            {config.label}
            <span className="ml-2 text-xs font-normal text-zinc-500">{config.code}</span>
          </h3>
          <span className="text-xs text-zinc-500">{tasks.length}</span>
        </div>
        <p className="text-[11px] text-zinc-500 mt-0.5">{config.subtitle}</p>
      </div>

      <div className="flex flex-col gap-2 px-2 pb-3 overflow-y-auto flex-1 min-h-[120px]">
        {tasks.map((task) => (
          <TaskCard
            key={task.id}
            task={task}
            onClick={onTaskClick}
            draggable={!isRecurring}
            onDragStart={handleDragStart}
          />
        ))}
        {tasks.length === 0 && (
          <div className="text-center text-xs text-zinc-600 py-8 border border-dashed border-zinc-700 rounded-lg">
            No tasks
          </div>
        )}
      </div>
    </div>
  );
}
