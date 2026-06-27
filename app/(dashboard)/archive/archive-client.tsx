"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2, RotateCcw, AlertCircle, Trophy, Link2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { archiveTask, deleteTask } from "@/actions/tasks";
import {
  type Task,
  PRIORITY_CONFIG,
  DECO_CONFIG,
  LABEL_CONFIG,
} from "@/lib/types";

interface ArchiveClientProps {
  initialTasks: Task[];
}

export function ArchiveClient({ initialTasks }: ArchiveClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [tasks, setTasks] = useState<Task[]>(initialTasks);

  function handleRestore(taskId: string, taskName: string) {
    // Optimistic UI update
    setTasks((prev) => prev.filter((t) => t.id !== taskId));

    startTransition(async () => {
      try {
        await archiveTask(taskId, false);
        toast.success(`Restored "${taskName}" to active board!`);
        router.refresh();
      } catch (err: any) {
        setTasks(initialTasks);
        toast.error(err.message || "Failed to restore task");
      }
    });
  }

  function handleDelete(taskId: string, taskName: string) {
    if (!window.confirm(`Are you sure you want to permanently delete "${taskName}"? This action is irreversible.`)) {
      return;
    }

    // Optimistic UI update
    setTasks((prev) => prev.filter((t) => t.id !== taskId));

    startTransition(async () => {
      try {
        await deleteTask(taskId);
        toast.success(`Deleted "${taskName}" permanently.`);
        router.refresh();
      } catch (err: any) {
        setTasks(initialTasks);
        toast.error(err.message || "Failed to delete task");
      }
    });
  }

  return (
    <main className="h-screen w-full overflow-y-auto flex flex-col p-6 space-y-6" style={{ backgroundColor: "#1E1E1E" }}>
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight">Archive</h1>
        <p className="text-sm text-zinc-400">View and permanently delete or restore tasks that were archived</p>
      </div>

      {tasks.length === 0 ? (
        <div className="rounded-xl border border-zinc-800 p-12 text-center text-zinc-500 flex flex-col items-center justify-center space-y-3" style={{ backgroundColor: "#2D2D2D" }}>
          <AlertCircle className="h-10 w-10 text-zinc-650" />
          <p className="text-zinc-400 font-medium">No archived tasks found</p>
          <p className="text-xs text-zinc-500">Tasks you archive from the details sheet will appear here.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {tasks.map((task) => {
            const priority = PRIORITY_CONFIG[task.priority];
            const duration = DECO_CONFIG[task.deco || "medium"];
            const complexity = DECO_CONFIG[task.complexity || "medium"];
            
            const owners = [
              task.owner?.full_name,
              task.owner2?.full_name,
              ...(task.wingmen?.map((w) => w.full_name) || [])
            ].filter(Boolean).join(", ");

            return (
              <div
                key={task.id}
                className="rounded-lg p-4 border border-zinc-800 hover:border-zinc-700 transition-colors flex flex-col justify-between"
                style={{ backgroundColor: "#2D2D2D", color: "#FFFFFF" }}
              >
                <div>
                  {/* Badges row */}
                  <div className="flex flex-wrap items-center gap-1.5 mb-3">
                    <span
                      className="inline-flex items-center rounded-full px-2 py-0.5 text-[9px] font-semibold border"
                      style={{
                        borderColor: `${priority.color}40`,
                        backgroundColor: `${priority.color}15`,
                        color: priority.color,
                      }}
                    >
                      {task.priority}
                    </span>
                    <span
                      className="inline-flex items-center rounded-full px-2 py-0.5 text-[9px] font-semibold border"
                      style={{
                        borderColor: `${duration.color}40`,
                        backgroundColor: `${duration.color}15`,
                        color: duration.color,
                      }}
                    >
                      ⏱️ {duration.label}
                    </span>
                    <span
                      className="inline-flex items-center rounded-full px-2 py-0.5 text-[9px] font-semibold border"
                      style={{
                        borderColor: `${complexity.color}40`,
                        backgroundColor: `${complexity.color}15`,
                        color: complexity.color,
                      }}
                    >
                      🧠 {complexity.label}
                    </span>
                  </div>

                  <h3 className="text-sm font-semibold mb-1 leading-snug">{task.name}</h3>
                  {task.description && (
                    <p className="text-xs text-zinc-400 line-clamp-3 mb-3 leading-normal">{task.description}</p>
                  )}

                  {/* Labels row */}
                  {task.labels && task.labels.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-3">
                      {task.labels.map((lbl) => (
                        <Badge key={lbl} variant="outline" className="text-[9px] border-zinc-700 text-zinc-400 px-1 py-0">
                          {LABEL_CONFIG[lbl]?.label ?? lbl}
                        </Badge>
                      ))}
                    </div>
                  )}

                  {/* Details */}
                  <div className="text-[11px] text-zinc-400 space-y-1 mb-4 pt-2 border-t border-zinc-800">
                    <p>Owners: <span className="text-zinc-300 font-medium">{owners || "None"}</span></p>
                    <p>Due Date: <span className="text-zinc-300 font-medium">{new Date(task.due_date).toLocaleDateString()}</span></p>
                  </div>
                </div>

                {/* Card Actions */}
                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-zinc-800/80 mt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={isPending}
                    onClick={() => handleRestore(task.id, task.name)}
                    className="flex items-center justify-center gap-1.5 text-xs border-zinc-700 text-zinc-300 hover:text-white"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    Restore
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    disabled={isPending}
                    onClick={() => handleDelete(task.id, task.name)}
                    className="flex items-center justify-center gap-1.5 text-xs bg-red-650 hover:bg-red-750"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Delete
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}
