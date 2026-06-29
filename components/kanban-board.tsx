"use client";

import { useState, useTransition, useEffect } from "react";
import { Task, TaskStatus, COLUMN_ORDER, type Profile, calculateScore } from "@/lib/types";
import { KanbanColumn } from "@/components/kanban-column";
import { TaskDetailSheet } from "@/components/task-detail-sheet";
import { moveTask } from "@/actions/tasks";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Filter, X } from "lucide-react";

const PRIORITIES = ["P1", "P2", "P3", "P4", "P5"];
const LABELS = ["revenue", "fundraise", "customer_delivery", "ops", "tech", "product"];
const DECOS = ["high", "medium_high", "medium", "medium_low", "low"];
 
interface KanbanBoardProps {
  initialTasks: Task[];
  profiles: Profile[];
  currentUserId?: string;
}
 
export function KanbanBoard({ initialTasks, profiles, currentUserId }: KanbanBoardProps) {
  const [tasks, setTasks] = useState<Task[]>(initialTasks);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [isPending, startTransition] = useTransition();

  // Filters State
  const [filterUser, setFilterUser] = useState<string>("all");
  const [filterLabel, setFilterLabel] = useState<string>("all");
  const [filterPriority, setFilterPriority] = useState<string>("all");
  const [filterDuration, setFilterDuration] = useState<string>("all");
  const [filterComplexity, setFilterComplexity] = useState<string>("all");
  const [filterDependency, setFilterDependency] = useState<string>("all");

  useEffect(() => {
    setTasks(initialTasks);
  }, [initialTasks]);

  const filteredTasks = tasks.filter((t) => {
    if (filterUser !== "all") {
      const isOwner = t.owner_id === filterUser;
      const isWingman = t.wingmen_ids?.includes(filterUser);
      if (!isOwner && !isWingman) return false;
    }
    if (filterLabel !== "all" && !t.labels?.includes(filterLabel as any)) {
      return false;
    }
    if (filterPriority !== "all" && t.priority !== filterPriority) {
      return false;
    }
    if (filterDuration !== "all") {
      const taskDeco = t.deco || "medium";
      if (taskDeco !== filterDuration) return false;
    }
    if (filterComplexity !== "all") {
      const taskComplexity = t.complexity || "medium";
      if (taskComplexity !== filterComplexity) return false;
    }
    if (filterDependency !== "all") {
      const isBlocked = !!t.is_blocked;
      const hasDeps = !!(t.dependencies && t.dependencies.length > 0);
      if (filterDependency === "blocked" && !isBlocked) return false;
      if (filterDependency === "dependencies" && !hasDeps) return false;
      if (filterDependency === "none" && (isBlocked || hasDeps)) return false;
    }
    return true;
  });
 
  const tasksByStatus = (status: TaskStatus) => filteredTasks.filter((t) => t.status === status);

  const isFiltered =
    filterUser !== "all" ||
    filterLabel !== "all" ||
    filterPriority !== "all" ||
    filterDuration !== "all" ||
    filterComplexity !== "all" ||
    filterDependency !== "all";

  const clearFilters = () => {
    setFilterUser("all");
    setFilterLabel("all");
    setFilterPriority("all");
    setFilterDuration("all");
    setFilterComplexity("all");
    setFilterDependency("all");
  };
 
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
    <div className="h-full w-full bg-background text-foreground flex flex-col">
      {/* Filtering Controls Bar */}
      <div className="px-6 py-3 border-b border-zinc-200 dark:border-zinc-800/80 bg-zinc-50/50 dark:bg-zinc-900/10 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-zinc-500 uppercase tracking-wider mr-2">
            <Filter className="h-3.5 w-3.5" />
            <span>Filters</span>
          </div>

          <Select value={filterUser} onValueChange={setFilterUser}>
            <SelectTrigger className="w-[140px] h-8 text-xs bg-zinc-50 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-850 text-zinc-900 dark:text-zinc-100">
              <SelectValue placeholder="Filter Owner" />
            </SelectTrigger>
            <SelectContent className="bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100">
              <SelectItem value="all">All Users</SelectItem>
              {profiles.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.full_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={filterLabel} onValueChange={setFilterLabel}>
            <SelectTrigger className="w-[130px] h-8 text-xs bg-zinc-50 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-855 text-zinc-900 dark:text-zinc-100">
              <SelectValue placeholder="Filter Label" />
            </SelectTrigger>
            <SelectContent className="bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100">
              <SelectItem value="all">All Labels</SelectItem>
              {LABELS.map((lbl) => (
                <SelectItem key={lbl} value={lbl}>
                  {lbl.replace("_", " ")}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={filterPriority} onValueChange={setFilterPriority}>
            <SelectTrigger className="w-[120px] h-8 text-xs bg-zinc-50 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-855 text-zinc-900 dark:text-zinc-100">
              <SelectValue placeholder="Priority" />
            </SelectTrigger>
            <SelectContent className="bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100">
              <SelectItem value="all">All Priorities</SelectItem>
              {PRIORITIES.map((p) => (
                <SelectItem key={p} value={p}>
                  {p}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={filterDuration} onValueChange={setFilterDuration}>
            <SelectTrigger className="w-[120px] h-8 text-xs bg-zinc-50 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-855 text-zinc-900 dark:text-zinc-100">
              <SelectValue placeholder="Duration" />
            </SelectTrigger>
            <SelectContent className="bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100">
              <SelectItem value="all">All Durations</SelectItem>
              {DECOS.map((d) => (
                <SelectItem key={d} value={d}>
                  {d.replace("_", " ")}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={filterComplexity} onValueChange={setFilterComplexity}>
            <SelectTrigger className="w-[125px] h-8 text-xs bg-zinc-50 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-855 text-zinc-900 dark:text-zinc-100">
              <SelectValue placeholder="Complexity" />
            </SelectTrigger>
            <SelectContent className="bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100">
              <SelectItem value="all">All Complexities</SelectItem>
              {DECOS.map((d) => (
                <SelectItem key={d} value={d}>
                  {d.replace("_", " ")}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={filterDependency} onValueChange={setFilterDependency}>
            <SelectTrigger className="w-[140px] h-8 text-xs bg-zinc-50 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-855 text-zinc-900 dark:text-zinc-100">
              <SelectValue placeholder="Dependencies" />
            </SelectTrigger>
            <SelectContent className="bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100">
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="blocked">Blocked Tasks</SelectItem>
              <SelectItem value="dependencies">Has Dependencies</SelectItem>
              <SelectItem value="none">No Dependencies</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {isFiltered && (
          <button
            onClick={clearFilters}
            className="flex items-center gap-1 text-xs text-red-500 hover:text-red-400 font-medium transition-colors"
          >
            <X className="h-3.5 w-3.5" />
            <span>Clear Filters</span>
          </button>
        )}
      </div>

      <div className="flex gap-4 overflow-x-auto flex-1 p-4">
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
 