// components/kanban-column.tsx
"use client";

import { Task, TaskStatus, STATUS_CONFIG, type Profile } from "@/lib/types";
import { TaskCard } from "@/components/task-card";
import { CreateTaskSheet } from "@/components/create-task-sheet";
import { Plus } from "lucide-react";

interface KanbanColumnProps {
  status: TaskStatus;
  tasks: Task[];
  profiles: Profile[];
  onTaskClick?: (task: Task) => void;
  onDrop?: (taskId: string, newStatus: TaskStatus) => void;
}

export function KanbanColumn({ status, tasks, profiles, onTaskClick, onDrop }: KanbanColumnProps) {
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
      className="flex flex-col flex-1 min-w-[280px] max-w-[340px] rounded-xl border border-zinc-800/80 shadow-md"
      style={{ backgroundColor: "#141414" }}
    >
      <div className="px-3 pt-3 pb-2 sticky top-0 rounded-t-xl" style={{ backgroundColor: "#141414" }}>
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

      <div className="px-2 pb-3 pt-1 border-t border-zinc-800/40">
        <CreateTaskSheet
          profiles={profiles}
          defaultStatus={status}
          trigger={
            <button className="w-full flex items-center justify-center gap-1.5 py-2 text-xs font-medium text-zinc-400 hover:text-white hover:bg-zinc-800/60 border border-dashed border-zinc-850 hover:border-zinc-700 rounded-lg transition-all">
              <Plus className="h-3.5 w-3.5" />
              Add task to {config.code}
            </button>
          }
        />
      </div>
    </div>
  );
}

