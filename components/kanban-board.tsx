// components/kanban-board.tsx
"use client";
 
import { useState, useTransition } from "react";
import { Task, TaskStatus, COLUMN_ORDER, type Profile } from "@/lib/types";
import { KanbanColumn } from "@/components/kanban-column";
import { TaskDetailSheet } from "@/components/task-detail-sheet";
import { moveTask } from "@/actions/tasks";
import { toast } from "sonner";
 
interface KanbanBoardProps {
  initialTasks: Task[];
  profiles: Profile[];
}
 
export function KanbanBoard({ initialTasks, profiles }: KanbanBoardProps) {
  const [tasks, setTasks] = useState<Task[]>(initialTasks);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [isPending, startTransition] = useTransition();
 
  const tasksByStatus = (status: TaskStatus) => tasks.filter((t) => t.status === status);
 
  function handleDrop(taskId: string, newStatus: TaskStatus) {
    const task = tasks.find((t) => t.id === taskId);
    if (!task || task.status === newStatus) return;
 
    // Optimistic update
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, status: newStatus } : t))
    );
 
    startTransition(async () => {
      try {
        const updated = await moveTask(taskId, newStatus);
        setTasks((prev) => prev.map((t) => (t.id === taskId ? updated : t)));
 
        if (newStatus === "tango_charlie" && updated.score != null) {
          toast.success("Task completed 🎉", {
            description: `${updated.name} scored ${updated.score} points.`,
          });
        }
      } catch (err: any) {
        // Revert on failure
        setTasks((prev) =>
          prev.map((t) => (t.id === taskId ? { ...t, status: task.status } : t))
        );
        toast.error("Couldn't move task", {
          description: err.message ?? "Something went wrong.",
        });
      }
    });
  }
 
  return (
    <div className="h-full w-full" style={{ backgroundColor: "#1E1E1E" }}>
      <div className="flex gap-3 overflow-x-auto h-full p-4">
        {COLUMN_ORDER.map((status) => (
          <KanbanColumn
            key={status}
            status={status}
            tasks={tasksByStatus(status)}
            profiles={profiles}
            onTaskClick={setSelectedTask}
            onDrop={handleDrop}
          />
        ))}
      </div>
 
      <TaskDetailSheet
        task={selectedTask}
        allTasks={tasks}
        open={!!selectedTask}
        onOpenChange={(open) => !open && setSelectedTask(null)}
        onUpdated={(updated) =>
          setTasks((prev) => prev.map((t) => (t.id === updated.id ? updated : t)))
        }
      />
    </div>
  );
}
 