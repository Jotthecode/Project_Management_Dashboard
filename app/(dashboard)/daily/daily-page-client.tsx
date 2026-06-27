// app/(dashboard)/daily/daily-page-client.tsx
"use client";

import { useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Plus, Check, Calendar, User, Tag, Clock, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { format } from "date-fns";
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
import { createTask, markDailyDone, getDailyNotes, saveDailyNote } from "@/actions/tasks";
import {
  type Profile,
  type LabelCategory,
  LABEL_CONFIG,
} from "@/lib/types";

const ALL_LABELS = Object.keys(LABEL_CONFIG) as LabelCategory[];

interface DailyPageClientProps {
  initialTasks: any[];
  profiles: Profile[];
  currentUserId: string;
}

export function DailyPageClient({ initialTasks, profiles, currentUserId }: DailyPageClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isAddOpen, setIsAddOpen] = useState(false);

  // Synchronized state for tasks
  const [tasks, setTasks] = useState<any[]>(initialTasks);
  
  // Date tracking state
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const selectedDateStr = format(selectedDate, "yyyy-MM-dd");

  // Daily notes state
  const [notes, setNotes] = useState<any[]>([]);
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});

  // Form State for creating new Daily Task
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [ownerId, setOwnerId] = useState("");
  const [labels, setLabels] = useState<LabelCategory[]>([]);

  useEffect(() => {
    setTasks(initialTasks);
  }, [initialTasks]);

  // Load notes whenever selected date changes
  useEffect(() => {
    async function loadNotes() {
      try {
        const fetched = await getDailyNotes(selectedDateStr);
        setNotes(fetched);
      } catch (err) {
        console.error("Failed to load daily notes:", err);
      }
    }
    loadNotes();
  }, [selectedDateStr]);

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
    // Optimistic local state update
    setTasks((prev) =>
      prev.map((t) => {
        if (t.id === taskId) {
          return {
            ...t,
            daily_completions: [
              ...(t.daily_completions || []),
              {
                id: Math.random().toString(),
                completed_at: new Date().toISOString(),
                completed_by: currentUserId,
              },
            ],
          };
        }
        return t;
      })
    );

    startTransition(async () => {
      try {
        await markDailyDone(taskId);
        toast.success(`Completed "${taskName}" for today! 🎉`);
        router.refresh();
      } catch (err: any) {
        // Revert local state update on failure
        setTasks(initialTasks);
        toast.error("Failed to log completion", {
          description: err.message || "Something went wrong.",
        });
      }
    });
  }

  async function handleSaveNote(taskId: string) {
    const content = noteDrafts[taskId]?.trim();
    if (!content) return;
    if (content.length <= 10) {
      toast.error("Note content must exceed 10 characters.");
      return;
    }

    try {
      const saved = await saveDailyNote(taskId, content, selectedDateStr);
      toast.success("Note saved successfully!");
      setNoteDrafts((prev) => ({ ...prev, [taskId]: "" }));
      
      // Update local notes state
      setNotes((prev) => {
        const existingIdx = prev.findIndex(
          (n) => n.task_id === taskId && n.author_id === currentUserId && n.note_date === selectedDateStr
        );
        if (existingIdx !== -1) {
          return prev.map((n, idx) => (idx === existingIdx ? { ...n, content } : n));
        } else {
          const authorProfile = profiles.find((p) => p.id === currentUserId);
          return [...prev, { ...saved, author: authorProfile }];
        }
      });
    } catch (err: any) {
      toast.error("Failed to save note", {
        description: err.message || "Something went wrong.",
      });
    }
  }

  function handleAddDaily(e: React.FormEvent) {
    e.preventDefault();

    if (!name.trim()) return toast.error("Task name is required.");
    if (!ownerId) return toast.error("Please select an owner.");
    if (labels.length < 1) return toast.error("Please select at least one label.");

    startTransition(async () => {
      try {
        const todayStr = new Date().toISOString().split("T")[0];
        const newTask = await createTask({
          name: name.trim(),
          description: description.trim(),
          ownerId,
          dueDate: todayStr,
          priority: "P3",
          deco: "medium",
          labels,
          status: "oscar_delta",
        });

        toast.success("Daily task created!");
        
        // Optimistic append to local tasks state
        setTasks((prev) => [
          {
            ...newTask,
            owner: profiles.find((p) => p.id === ownerId),
            daily_completions: [],
          },
          ...prev,
        ]);

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
      {/* Date Selector Header & Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#262626]/40 p-4 rounded-xl border border-zinc-800/80">
        <div className="flex items-center gap-2 bg-[#2D2D2D] px-3 py-2 rounded-lg border border-zinc-700 w-fit">
          <Calendar className="h-4 w-4 text-blue-400" />
          <span className="text-xs text-zinc-300 font-semibold">Active Date:</span>
          <input
            type="date"
            value={selectedDateStr}
            onChange={(e) => {
              if (e.target.value) {
                setSelectedDate(new Date(e.target.value));
              }
            }}
            className="bg-transparent text-white text-xs border-none focus:outline-none focus:ring-0 cursor-pointer font-bold"
          />
        </div>
        <Button onClick={() => setIsAddOpen(true)} className="bg-blue-600 hover:bg-blue-700 gap-1.5 h-9 shrink-0">
          <Plus className="h-4 w-4" />
          Add Daily Task
        </Button>
      </div>

      {/* Grid List */}
      {tasks.length === 0 ? (
        <div className="rounded-xl border border-zinc-800 p-12 text-center text-zinc-500 bg-[#161616]/40">
          No recurring daily tasks configured yet. Add one to track daily operations checklist!
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {tasks.map((task) => {
            // Find latest completion timestamp
            const latestCompletion = (task.daily_completions ?? []).reduce(
              (latest: any, current: any) => {
                return !latest || new Date(current.completed_at) > new Date(latest.completed_at)
                  ? current
                  : latest;
              },
              null
            );

            // Determine if completed on selected date
            const completedOnDate = (task.daily_completions ?? []).some(
              (c: any) => new Date(c.completed_at).toDateString() === selectedDate.toDateString()
            );

            const lastCompletedText = latestCompletion
              ? new Date(latestCompletion.completed_at).toLocaleString("en-US", {
                  month: "short",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })
              : "Never";

            // Filter notes for this task
            const taskNotes = notes.filter((n) => n.task_id === task.id);

            return (
              <div
                key={task.id}
                className={cn(
                  "rounded-lg border border-zinc-800/80 p-5 flex flex-col justify-between space-y-4 transition-all relative overflow-hidden",
                  completedOnDate ? "border-green-500/30 bg-green-500/5" : "bg-[#141414]"
                )}
              >
                {/* Status Indicator Bar */}
                <div
                  className={cn(
                    "absolute top-0 left-0 right-0 h-1",
                    completedOnDate ? "bg-green-500" : "bg-blue-600/30"
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
                        {LABEL_CONFIG[label]?.label ?? label}
                      </Badge>
                    ))}
                  </div>
                </div>

                <div className="space-y-4 pt-2 border-t border-zinc-850">
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

                  {completedOnDate ? (
                    <Button
                      disabled
                      className="w-full bg-green-500/10 text-green-400 border border-green-500/20 gap-1.5 h-9 hover:bg-green-500/10"
                    >
                      <Check className="h-4 w-4" />
                      Completed
                    </Button>
                  ) : (
                    <Button
                      onClick={() => handleMarkDone(task.id, task.name)}
                      disabled={isPending}
                      className="w-full bg-blue-600 hover:bg-blue-700 text-white h-9"
                    >
                      Mark Done
                    </Button>
                  )}

                  {/* Daily Notes section */}
                  <div className="pt-3 border-t border-zinc-800/80 space-y-3">
                    <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider flex items-center gap-1">
                      📝 Notes ({taskNotes.length})
                    </p>

                    {taskNotes.length > 0 && (
                      <div className="space-y-1.5 max-h-[120px] overflow-y-auto pr-1">
                        {taskNotes.map((n) => (
                          <div key={n.id} className="text-xs bg-zinc-900/60 p-2 rounded border border-zinc-850">
                            <div className="flex justify-between text-[9px] text-zinc-500 font-semibold mb-0.5">
                              <span>{n.author?.full_name}</span>
                              <span>{new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                            </div>
                            <p className="text-zinc-300 leading-relaxed font-normal">{n.content}</p>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Save Note Input */}
                    <div className="flex gap-1.5 items-center">
                      <input
                        placeholder="Add a note... (min 11 chars)"
                        value={noteDrafts[task.id] || ""}
                        onChange={(e) => setNoteDrafts((prev) => ({ ...prev, [task.id]: e.target.value }))}
                        onKeyDown={(e) => e.key === 'Enter' && handleSaveNote(task.id)}
                        className="flex-1 bg-zinc-900 border border-zinc-800 rounded text-xs px-2 py-1.5 text-white placeholder:text-zinc-600 focus:outline-none focus:border-zinc-600 h-8"
                      />
                      <Button
                        onClick={() => handleSaveNote(task.id)}
                        disabled={!noteDrafts[task.id] || noteDrafts[task.id].trim().length <= 10}
                        className="h-8 text-xs bg-blue-600 hover:bg-blue-700 text-white px-2.5 rounded shrink-0 disabled:opacity-50"
                      >
                        Save
                      </Button>
                    </div>
                  </div>
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
                    if (label === "blocking_task") return null; // do not manually assign this special label
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
                        {LABEL_CONFIG[label]?.label ?? label}
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
