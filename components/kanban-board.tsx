// components/kanban-board.tsx
"use client";
 
import { useState, useTransition, useEffect } from "react";
import { Task, TaskStatus, COLUMN_ORDER, type Profile, calculateScore } from "@/lib/types";
import { KanbanColumn } from "@/components/kanban-column";
import { TaskDetailSheet } from "@/components/task-detail-sheet";
import { moveTask } from "@/actions/tasks";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
 
interface KanbanBoardProps {
  initialTasks: Task[];
  profiles: Profile[];
  currentUserId?: string;
}
 
export function KanbanBoard({ initialTasks, profiles, currentUserId }: KanbanBoardProps) {
  const [tasks, setTasks] = useState<Task[]>(initialTasks);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    setTasks(initialTasks);
  }, [initialTasks]);
 
  const tasksByStatus = (status: TaskStatus) => tasks.filter((t) => t.status === status);
 
  function handleDrop(taskId: string, newStatus: TaskStatus) {
    const task = tasks.find((t) => t.id === taskId);
    if (!task || task.status === newStatus) return;
 
    // Optimistic update
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, status: newStatus } : t))
    );
 
    if (newStatus === "tango_charlie" && task.status !== "tango_charlie") {
      const today = new Date().toISOString().split("T")[0];
      const score = calculateScore(task.priority, task.deco, task.complexity || "medium", task.due_date, today);
      toast.success("Task completed! 🎉", {
        description: `You earned ${score} points for "${task.name}"`,
      });
    }

    startTransition(async () => {
      try {
        const updated = await moveTask(taskId, newStatus);
        setTasks((prev) => prev.map((t) => (t.id === taskId ? updated : t)));
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
    <div className="h-full w-full bg-background text-foreground">
      <div className="flex gap-4 overflow-x-auto h-full p-4">
        {COLUMN_ORDER.map((status) => {
          const isDaily = status === "oscar_delta";
          return (
            <div 
              key={status} 
              className={cn(
                "flex h-full", 
                isDaily && "pl-6 ml-3 border-l border-zinc-800/80"
              )}
            >
              <KanbanColumn
                status={status}
                tasks={tasksByStatus(status)}
                profiles={profiles}
                onTaskClick={setSelectedTask}
                onDrop={handleDrop}
              />
            </div>
          );
        })}
      </div>
 
      <TaskDetailSheet
        task={selectedTask}
        allTasks={tasks}
        profiles={profiles}
        open={!!selectedTask}
        onOpenChange={(open) => !open && setSelectedTask(null)}
        onUpdated={(updated) =>
          setTasks((prev) => prev.map((t) => (t.id === updated.id ? updated : t)))
        }
        onDeleted={(deletedId) =>
          setTasks((prev) => prev.filter((t) => t.id !== deletedId))
        }
        currentUserId={currentUserId}
      />
    </div>
  );
}
 