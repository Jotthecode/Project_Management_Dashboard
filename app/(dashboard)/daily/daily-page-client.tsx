// app/(dashboard)/daily/daily-page-client.tsx
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Check, Calendar, User, Tag, Clock, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { createTask, markDailyDone } from "@/actions/tasks";
import {
  type Profile,
  type LabelCategory,
  LABEL_CONFIG,
} from "@/lib/types";

const ALL_LABELS = Object.keys(LABEL_CONFIG) as LabelCategory[];

interface DailyPageClientProps {
  initialTasks: any[];
  profiles: Profile[];
}

export function DailyPageClient({ initialTasks, profiles }: DailyPageClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isAddOpen, setIsAddOpen] = useState(false);

  // Form State
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [ownerId, setOwnerId] = useState("");
  const [labels, setLabels] = useState<LabelCategory[]>([]);

  function toggleLabel(label: LabelCategory) {
    setLabels((prev) => {
      if (prev.includes(label)) {
        return prev.filter((l) => l !== label);
      }
      if (prev.length >= 2) {
        toast.warning("A task can have at most 2 labels.");
        return prev;
      }
      return [...prev, label];
    });
  }

  function handleMarkDone(taskId: string, taskName: string) {
    startTransition(async () => {
      try {
        await markDailyDone(taskId);
        toast.success(`Completed "${taskName}" for today! 🎉`);
        router.refresh();
      } catch (err: any) {
        toast.error("Failed to log completion", {
          description: err.message || "Something went wrong.",
        });
      }
    });
  }

  function handleAddDaily(e: React.FormEvent) {
    e.preventDefault();

    if (!name.trim()) return toast.error("Task name is required.");
    if (!ownerId) return toast.error("Please select an owner.");
    if (labels.length < 1) return toast.error("Please select at least one label.");

    startTransition(async () => {
      try {
        const todayStr = new Date().toISOString().split("T")[0];
        await createTask({
          name: name.trim(),
          description: description.trim(),
          ownerId,
          dueDate: todayStr,
          priority: "P3", // default
          deco: "medium", // default / skips selection
          labels,
          status: "oscar_delta",
        });

        toast.success("Daily task created!");
        
        // Reset Form
        setName("");
        setDescription("");
        setOwnerId("");
        setLabels([]);
        setIsAddOpen(false);
        router.refresh();
      } catch (err: any) {
        toast.error("Failed to create daily task", {
          description: err.message || "Something went wrong.",
        });
      }
    });
  }

  return (
    <div className="space-y-6">
      {/* Action Bar */}
      <div className="flex justify-end">
        <Button onClick={() => setIsAddOpen(true)} className="bg-blue-600 hover:bg-blue-700 gap-1.5">
          <Plus className="h-4 w-4" />
          Add Daily Task
        </Button>
      </div>

      {/* Grid List */}
      {initialTasks.length === 0 ? (
        <div className="rounded-xl border border-zinc-800 p-12 text-center text-zinc-500" style={{ backgroundColor: "#2D2D2D" }}>
          No recurring daily tasks configured yet. Add one to track daily operations checklist!
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {initialTasks.map((task) => {
            // Find latest completion timestamp
            const latestCompletion = (task.daily_completions ?? []).reduce(
              (latest: any, current: any) => {
                return !latest || new Date(current.completed_at) > new Date(latest.completed_at)
                  ? current
                  : latest;
              },
              null
            );

            // Determine if completed today in browser's local timezone
            const completedToday =
              latestCompletion &&
              new Date(latestCompletion.completed_at).toDateString() === new Date().toDateString();

            const lastCompletedText = latestCompletion
              ? new Date(latestCompletion.completed_at).toLocaleString("en-US", {
                  month: "short",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })
              : "Never";

            return (
              <div
                key={task.id}
                className={cn(
                  "rounded-lg border border-zinc-800 p-5 flex flex-col justify-between space-y-4 transition-all relative overflow-hidden",
                  completedToday ? "border-green-500/30 bg-green-500/5" : "bg-[#2D2D2D]"
                )}
              >
                {/* Status Indicator Bar */}
                <div
                  className={cn(
                    "absolute top-0 left-0 right-0 h-1",
                    completedToday ? "bg-green-500" : "bg-blue-600/30"
                  )}
                />

                <div className="space-y-2">
                  <div className="flex items-start justify-between">
                    <h3 className="text-base font-semibold text-white leading-snug line-clamp-1">
                      {task.name}
                    </h3>
                  </div>

                  {task.description && (
                    <p className="text-xs text-zinc-400 line-clamp-2">{task.description}</p>
                  )}

                  {/* Badges / Labels */}
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {task.labels?.map((label: LabelCategory) => (
                      <Badge
                        key={label}
                        variant="outline"
                        className="text-[10px] px-2 py-0 border-zinc-700 text-zinc-300 bg-zinc-800/40"
                      >
                        {LABEL_CONFIG[label].label}
                      </Badge>
                    ))}
                  </div>
                </div>

                <div className="space-y-4 pt-2 border-t border-zinc-800/50">
                  <div className="grid grid-cols-2 gap-2 text-[11px] text-zinc-400">
                    <div className="flex items-center gap-1.5">
                      <User className="h-3.5 w-3.5 text-zinc-500" />
                      <span className="truncate">{task.owner?.full_name || "Unassigned"}</span>
                    </div>
                    <div className="flex items-center gap-1.5 justify-end">
                      <Clock className="h-3.5 w-3.5 text-zinc-500" />
                      <span>Last: {lastCompletedText}</span>
                    </div>
                  </div>

                  {completedToday ? (
                    <Button
                      disabled
                      className="w-full bg-green-500/10 text-green-400 border border-green-500/20 gap-1.5 h-10 hover:bg-green-500/10"
                    >
                      <Check className="h-4 w-4" />
                      Completed Today
                    </Button>
                  ) : (
                    <Button
                      onClick={() => handleMarkDone(task.id, task.name)}
                      disabled={isPending}
                      className="w-full bg-blue-600 hover:bg-blue-700 text-white h-10"
                    >
                      Mark Done Today
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add Daily Task Dialog */}
      {isAddOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div
            className="w-full max-w-md rounded-xl border border-zinc-800 p-6 flex flex-col max-h-[90vh] overflow-y-auto"
            style={{ backgroundColor: "#1E1E1E", color: "#FFFFFF" }}
          >
            {/* Header */}
            <div className="flex items-center justify-between pb-4 border-b border-zinc-800">
              <h2 className="text-lg font-bold text-white">Add Daily Task</h2>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsAddOpen(false)}
                className="h-8 w-8 text-zinc-400 hover:text-white"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            {/* Form */}
            <form onSubmit={handleAddDaily} className="mt-4 space-y-4 text-sm">
              <div className="space-y-1.5">
                <Label htmlFor="daily-name" className="text-zinc-300">
                  Task Name
                </Label>
                <Input
                  id="daily-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Sync marketing analytics report"
                  className="bg-[#2D2D2D] border-zinc-700 text-white placeholder:text-zinc-500"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="daily-desc" className="text-zinc-300">
                  Description
                </Label>
                <Textarea
                  id="daily-desc"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="What is the operational standard?"
                  className="bg-[#2D2D2D] border-zinc-700 text-white placeholder:text-zinc-500 min-h-[80px]"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-zinc-300">Owner</Label>
                <Select value={ownerId} onValueChange={setOwnerId}>
                  <SelectTrigger className="bg-[#2D2D2D] border-zinc-700 text-white">
                    <SelectValue placeholder="Assign Owner" />
                  </SelectTrigger>
                  <SelectContent className="bg-[#2D2D2D] border-zinc-700 text-white">
                    {profiles.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.full_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-zinc-300 font-medium">Labels (choose 1-2)</Label>
                <div className="flex flex-wrap gap-1.5">
                  {ALL_LABELS.map((label) => {
                    const selected = labels.includes(label);
                    return (
                      <Badge
                        key={label}
                        onClick={() => toggleLabel(label)}
                        variant={selected ? "default" : "outline"}
                        className={cn(
                          "cursor-pointer select-none transition-colors",
                          selected
                            ? "bg-blue-600 hover:bg-blue-700 text-white border-blue-600"
                            : "border-zinc-600 text-zinc-300 hover:border-zinc-400"
                        )}
                      >
                        {LABEL_CONFIG[label].label}
                      </Badge>
                    );
                  })}
                </div>
              </div>

              <div className="flex gap-2 pt-4 border-t border-zinc-800">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsAddOpen(false)}
                  className="flex-1 border-zinc-700 text-zinc-300 hover:text-white"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isPending}
                  className="flex-1 bg-blue-600 hover:bg-blue-700"
                >
                  {isPending ? "Creating..." : "Add Daily Task"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
