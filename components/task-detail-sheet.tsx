// components/task-detail-sheet.tsx
"use client";

import { useState, useTransition, useEffect } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Task,
  PRIORITY_CONFIG,
  DECO_CONFIG,
  LABEL_CONFIG,
  STATUS_CONFIG,
  calculateScore,
  type PriorityLevel,
  type DecoLevel,
  type LabelCategory,
  type Profile,
} from "@/lib/types";
import { setBlocked, resolveDependency, deleteTask, updateTask } from "@/actions/tasks";
import { Link2, Trophy, AlertTriangle, Users, Trash2, Edit, Save, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface TaskDetailSheetProps {
  task: Task | null;
  allTasks: Task[];
  profiles: Profile[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdated: (task: Task) => void;
  onDeleted?: (taskId: string) => void;
  currentUserId?: string;
}

export function TaskDetailSheet({
  task,
  allTasks,
  profiles,
  open,
  onOpenChange,
  onUpdated,
  onDeleted,
  currentUserId,
}: TaskDetailSheetProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [reasonDraft, setReasonDraft] = useState("");
  const [showBlockedInput, setShowBlockedInput] = useState(false);

  // Edit fields state
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editOwnerId, setEditOwnerId] = useState("");
  const [editOwner2Id, setEditOwner2Id] = useState("");
  const [editDueDate, setEditDueDate] = useState<Date | undefined>(undefined);
  const [editPriority, setEditPriority] = useState<PriorityLevel | "">("");
  const [editDeco, setEditDeco] = useState<DecoLevel | "">("");
  const [editLabels, setEditLabels] = useState<LabelCategory[]>([]);

  useEffect(() => {
    if (task) {
      setReasonDraft(task.blocked_reason || "");
      setShowBlockedInput(false);

      // Initialize edit fields
      setEditName(task.name);
      setEditDesc(task.description || "");
      setEditOwnerId(task.owner_id);
      setEditOwner2Id(task.owner2_id || "");
      setEditDueDate(task.due_date ? new Date(task.due_date) : undefined);
      setEditPriority(task.priority);
      setEditDeco(task.deco);
      setEditLabels(task.labels || []);
      setIsEditing(false);
    } else {
      setReasonDraft("");
      setShowBlockedInput(false);
      setIsEditing(false);
    }
  }, [task]);

  function handleResolveDependency(dependencyId: string) {
    startTransition(async () => {
      try {
        await resolveDependency(dependencyId);
        toast.success("Dependency resolved successfully!");
        router.refresh();
        onOpenChange(false);
      } catch (err: any) {
        toast.error("Failed to resolve dependency", {
          description: err.message || "Something went wrong.",
        });
      }
    });
  }

  function renderDependencyNode(dep: any, depth = 0) {
    const linkedTask = dep.linked_task_id
      ? allTasks.find((t) => t.id === dep.linked_task_id)
      : null;
    const statusLabel = linkedTask
      ? STATUS_CONFIG[linkedTask.status].label
      : "Unknown";

    return (
      <div key={dep.id} style={{ marginLeft: `${depth * 10}px` }} className="space-y-1 mt-2 border-l border-zinc-700/60 pl-3 py-1 animate-in fade-in">
        <div className="flex items-center justify-between text-xs font-semibold text-zinc-200">
          <span className="flex items-center gap-1.5 truncate max-w-[70%]">
            <span className="text-zinc-500">↳</span>
            {dep.depends_on_user?.full_name}
          </span>
          <Badge variant="outline" className="text-[9px] border-zinc-700 bg-zinc-800 text-zinc-400 px-1 py-0 h-4 uppercase">
            {statusLabel}
          </Badge>
        </div>
        <p className="text-[11px] text-zinc-500 italic pl-3 leading-normal">For: {dep.reason}</p>
        
        <Button
          size="sm"
          variant="link"
          disabled={isPending || (!!currentUserId && task?.owner_id !== currentUserId)}
          onClick={() => handleResolveDependency(dep.id)}
          className="h-5 text-[10px] text-red-400 hover:text-red-300 p-0 pl-3 flex justify-start underline decoration-red-400/30 disabled:opacity-40 disabled:no-underline"
          title={!!currentUserId && task?.owner_id !== currentUserId ? "Only the owner of the original blocked task can resolve dependencies" : ""}
        >
          Mark dependency resolved
        </Button>

        {/* Nested child dependencies */}
        {linkedTask?.dependencies && linkedTask.dependencies.length > 0 && (
          <div className="space-y-1 mt-1 pl-1">
            {linkedTask.dependencies.map((childDep: any) => renderDependencyNode(childDep, depth + 1))}
          </div>
        )}
      </div>
    );
  }

  if (!task) return null;

  const taskId = task.id;

  const priority = PRIORITY_CONFIG[task.priority];
  const deco = DECO_CONFIG[task.deco];

  // Projected score if completed today (for in-progress visibility)
  const projectedScore =
    task.status !== "tango_charlie"
      ? calculateScore(task.priority, task.deco, task.due_date, new Date().toISOString().split("T")[0])
      : task.score;

  const due = new Date(task.due_date);
  const completed = task.completed_at ? new Date(task.completed_at.split('T')[0]) : new Date(new Date().toISOString().split("T")[0]);
  const msPerDay = 1000 * 60 * 60 * 24;
  const daysEarly = Math.round((due.getTime() - completed.getTime()) / msPerDay);

  let bonus = 0;
  if (daysEarly > 10) bonus = 10;
  else if (daysEarly > 0) bonus = daysEarly;
  else if (daysEarly === 0) bonus = 1;
  else bonus = 0;

  // Find the parent task (if this task was auto-created via dependency automation)
  const parentTask = task.parent_task_id
    ? allTasks.find((t) => t.id === task.parent_task_id)
    : null;

  // Restrict ability to delete a dependency task solely to owner of original blocked task
  const canDelete = !task.parent_task_id || !currentUserId || parentTask?.owner_id === currentUserId;

  function toggleBlocked(nextBlocked: boolean) {
    if (nextBlocked && reasonDraft.trim().length <= 10) {
      toast.error("Please enter a blocking reason exceeding 10 characters.");
      return;
    }
    startTransition(async () => {
      try {
        const updated = await setBlocked(taskId, nextBlocked, nextBlocked ? reasonDraft.trim() : undefined);
        onUpdated(updated);
        if (nextBlocked) {
          toast.success("Task marked as blocked");
          setShowBlockedInput(false);
        } else {
          toast.success("Task unblocked");
          setReasonDraft("");
          setShowBlockedInput(false);
        }
      } catch (err: any) {
        toast.error(err.message || "Failed to update blocked status");
      }
    });
  }

  function handleSaveEdit() {
    if (!editName.trim()) return toast.error("Task name is required.");
    if (!editOwnerId) return toast.error("Please select a primary owner.");
    if (editLabels.length < 1) return toast.error("Please select at least one label.");
    if (!editDueDate) return toast.error("Due date is required.");

    startTransition(async () => {
      try {
        const updated = await updateTask({
          id: taskId,
          name: editName.trim(),
          description: editDesc.trim(),
          ownerId: editOwnerId,
          owner2Id: editOwner2Id && editOwner2Id !== "unassigned" ? editOwner2Id : null,
          dueDate: editDueDate.toISOString().split("T")[0],
          priority: editPriority as PriorityLevel,
          deco: editDeco as DecoLevel,
          labels: editLabels,
        });

        toast.success("Task updated successfully!");
        setIsEditing(false);
        onUpdated(updated);
        router.refresh();
      } catch (err: any) {
        toast.error(err.message || "Failed to update task");
      }
    });
  }

  function toggleLabel(label: LabelCategory) {
    setEditLabels((prev) => {
      if (prev.includes(label)) return prev.filter((l) => l !== label);
      if (prev.length >= 2) {
        toast.warning("A task can have at most 2 labels.");
        return prev;
      }
      return [...prev, label];
    });
  }

  function handleDelete() {
    if (!window.confirm("Are you sure you want to delete this task? This action cannot be undone.")) {
      return;
    }

    startTransition(async () => {
      try {
        await deleteTask(taskId);
        toast.success("Task deleted successfully");
        onDeleted?.(taskId);
        onOpenChange(false);
      } catch (err: any) {
        toast.error("Failed to delete task", {
          description: err.message || "Something went wrong.",
        });
      }
    });
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-md border-zinc-800"
        style={{ backgroundColor: "#1E1E1E", color: "#FFFFFF" }}
      >
        <SheetHeader>
          <SheetTitle className="text-white">{task.name}</SheetTitle>
          <SheetDescription className="text-zinc-400">{task.description}</SheetDescription>
        </SheetHeader>

        <div className="mt-4 space-y-5 text-sm">
          {isEditing ? (
            <div className="space-y-4">
              {/* Owners (Up to 2) */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-zinc-300 text-xs">Primary Owner</Label>
                  <Select value={editOwnerId} onValueChange={setEditOwnerId}>
                    <SelectTrigger className="bg-[#2D2D2D] border-zinc-700 text-white text-xs mt-1">
                      <SelectValue placeholder="Primary Owner" />
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
                  <Label className="text-zinc-300 text-xs">Secondary Owner</Label>
                  <Select value={editOwner2Id || "unassigned"} onValueChange={setEditOwner2Id}>
                    <SelectTrigger className="bg-[#2D2D2D] border-zinc-700 text-white text-xs mt-1">
                      <SelectValue placeholder="None" />
                    </SelectTrigger>
                    <SelectContent className="bg-[#2D2D2D] border-zinc-700 text-white">
                      <SelectItem value="unassigned">None</SelectItem>
                      {profiles.map((p) => (
                        <SelectItem key={p.id} value={p.id} disabled={p.id === editOwnerId}>
                          {p.full_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Due Date */}
              <div className="space-y-1.5">
                <Label className="text-zinc-300 text-xs">Due Date</Label>
                <input
                  type="date"
                  value={editDueDate ? editDueDate.toISOString().split("T")[0] : ""}
                  onChange={(e) => setEditDueDate(e.target.value ? new Date(e.target.value) : undefined)}
                  className="w-full bg-[#2D2D2D] border border-zinc-700 rounded p-2 text-xs text-white focus:outline-none"
                />
              </div>

              {/* Priority & DECO */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-zinc-300 text-xs">Priority</Label>
                  <Select value={editPriority} onValueChange={(v) => setEditPriority(v as PriorityLevel)}>
                    <SelectTrigger className="bg-[#2D2D2D] border-zinc-700 text-white text-xs mt-1">
                      <SelectValue placeholder="Priority" />
                    </SelectTrigger>
                    <SelectContent className="bg-[#2D2D2D] border-zinc-700 text-white">
                      {Object.keys(PRIORITY_CONFIG).map((pKey) => (
                        <SelectItem key={pKey} value={pKey}>
                          {pKey}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-zinc-300 text-xs font-semibold">Complexity (DECO)</Label>
                  <Select value={editDeco} onValueChange={(v) => setEditDeco(v as DecoLevel)}>
                    <SelectTrigger className="bg-[#2D2D2D] border-zinc-700 text-white text-xs mt-1">
                      <SelectValue placeholder="DECO Level" />
                    </SelectTrigger>
                    <SelectContent className="bg-[#2D2D2D] border-zinc-700 text-white">
                      {(Object.keys(DECO_CONFIG) as DecoLevel[]).map((dKey) => (
                        <SelectItem key={dKey} value={dKey}>
                          {DECO_CONFIG[dKey].label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Labels (choose 1-2) */}
              <div className="space-y-1.5">
                <Label className="text-zinc-300 text-xs">Labels (choose 1-2)</Label>
                <div className="flex flex-wrap gap-1.5">
                  {(Object.keys(LABEL_CONFIG) as LabelCategory[]).map((label) => {
                    const selected = editLabels.includes(label);
                    if (label === "blocking_task") return null;
                    return (
                      <Badge
                        key={label}
                        onClick={() => toggleLabel(label)}
                        variant={selected ? "default" : "outline"}
                        className={cn(
                          "cursor-pointer select-none transition-colors text-[10px] px-2 py-0.5",
                          selected
                            ? "bg-blue-600 hover:bg-blue-750 text-white border-blue-600"
                            : "border-zinc-700 text-zinc-350 hover:border-zinc-550"
                        )}
                      >
                        {LABEL_CONFIG[label].label}
                      </Badge>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : (
            <>
              {/* Owners & due date */}
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Primary Owner" value={task.owner?.full_name ?? "Unassigned"} />
                  <Field label="Secondary Owner" value={task.owner2?.full_name ?? "None"} />
                </div>
                <div className="grid grid-cols-1">
                  <Field
                    label="Due Date"
                    value={new Date(task.due_date).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  />
                </div>
              </div>
            </>
          )}

          {/* Priority & DECO */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg p-3" style={{ backgroundColor: "#2D2D2D" }}>
              <p className="text-xs text-zinc-400 mb-1">Priority</p>
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: priority.color }} />
                <span>{task.priority} · {priority.label}</span>
              </div>
              <p className="text-[11px] text-zinc-500 mt-1">Weight {priority.weight}</p>
            </div>
            <div className="rounded-lg p-3" style={{ backgroundColor: "#2D2D2D" }}>
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs text-zinc-400">DECO</p>
                <span className="relative group inline-flex items-center cursor-pointer text-zinc-400 hover:text-white transition-colors">
                  <span className="text-[10px] bg-zinc-800 text-zinc-450 font-bold h-3.5 w-3.5 rounded-full flex items-center justify-center border border-zinc-700">i</span>
                  <span className="absolute bottom-full right-0 mb-2 w-48 hidden group-hover:block bg-zinc-950 text-zinc-200 text-[10px] font-normal p-2 rounded-md shadow-lg border border-zinc-800 z-50 text-center leading-normal">
                    DECO: Duration, Effort, COmplexity
                  </span>
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: deco.color }} />
                <span>{deco.label}</span>
              </div>
              <p className="text-[11px] text-zinc-500 mt-1">{deco.duration} · Weight {deco.weight}</p>
            </div>
          </div>

          {/* Labels */}
          {task.labels?.length > 0 && (
            <div>
              <p className="text-xs text-zinc-400 mb-1.5">Labels</p>
              <div className="flex flex-wrap gap-1.5">
                {task.labels.map((label) => (
                  <Badge key={label} variant="outline" className="border-zinc-600 text-zinc-300">
                    {LABEL_CONFIG[label].label}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Contributors */}
          {task.contributors && task.contributors.length > 0 && (
            <div>
              <p className="text-xs text-zinc-400 mb-1.5 flex items-center gap-1">
                <Users className="h-3 w-3" /> Contributors
              </p>
              <div className="flex flex-wrap gap-1.5">
                {task.contributors.map((c) => (
                  <Badge key={c.id} variant="secondary" className="bg-zinc-700 text-white">
                    {c.full_name}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Dependency Automation: "Dependency on:: User Name" */}
          {task.dependencies && task.dependencies.length > 0 && (
            <div className="rounded-lg p-3 border border-blue-500/30 bg-blue-500/5">
              <p className="text-xs text-blue-400 mb-1 flex items-center gap-1">
                <Link2 className="h-3 w-3" /> Dependency Tree
              </p>
              <div className="space-y-2 mt-2">
                {task.dependencies.map((dep) => renderDependencyNode(dep, 0))}
              </div>
            </div>
          )}

          {/* If this task was auto-created because someone depends on its owner */}
          {parentTask && (
            <div className="rounded-lg p-3 border border-purple-500/30 bg-purple-500/5 text-sm">
              <p className="text-xs text-purple-400 mb-1.5">Linked Dependency Task</p>
              <p>Requested By: <span className="font-medium">{parentTask.owner?.full_name}</span></p>
              <p>Parent Task: <span className="font-medium">{parentTask.name}</span></p>
              {task.dependency_reason && (
                <p className="text-zinc-400 mt-1">Reason: {task.dependency_reason}</p>
              )}
            </div>
          )}

          {/* Blocked badge */}
          <div className="rounded-lg p-3" style={{ backgroundColor: "#2D2D2D" }}>
            <div className="flex items-center justify-between">
              <p className="text-xs text-zinc-400 flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" /> Blocked Badge
              </p>
              {task.is_blocked ? (
                <Button
                  size="sm"
                  variant="destructive"
                  disabled={isPending}
                  onClick={() => toggleBlocked(false)}
                >
                  Unblock
                </Button>
              ) : !showBlockedInput ? (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShowBlockedInput(true)}
                  className="border-zinc-600 text-zinc-300 hover:text-white"
                >
                  Mark Blocked
                </Button>
              ) : (
                <div className="flex gap-1.5">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setShowBlockedInput(false);
                      setReasonDraft("");
                    }}
                    className="text-xs text-zinc-400 hover:text-white h-7 px-2"
                  >
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    variant="default"
                    disabled={isPending || reasonDraft.trim().length <= 10}
                    onClick={() => toggleBlocked(true)}
                    className="bg-red-650 hover:bg-red-750 text-white text-xs h-7 px-2 disabled:opacity-50"
                  >
                    Block
                  </Button>
                </div>
              )}
            </div>
            {(task.is_blocked || showBlockedInput) && (
              <div className="mt-2.5 space-y-1">
                <input
                  className="w-full rounded bg-zinc-800 text-sm px-2 py-1.5 text-white placeholder:text-zinc-500 border border-zinc-700 focus:outline-none focus:border-zinc-500"
                  placeholder="Reason (e.g. Waiting for API design, min 11 chars)"
                  value={reasonDraft}
                  onChange={(e) => setReasonDraft(e.target.value)}
                  disabled={task.is_blocked}
                />
                {!task.is_blocked && reasonDraft.trim().length <= 10 && (
                  <p className="text-[10px] text-red-400 mt-1">Reason must exceed 10 characters.</p>
                )}
              </div>
            )}
          </div>

          {/* Score breakdown card */}
          <div className="rounded-lg p-4 border border-yellow-500/20 bg-yellow-500/5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <p className="text-sm font-semibold text-yellow-400 flex items-center gap-1.5">
                  <Trophy className="h-4 w-4" />
                  {task.status === "tango_charlie" ? "Final Score" : "Projected Score"}
                </p>
                <span className="relative group inline-flex items-center cursor-pointer text-yellow-400 hover:text-white transition-colors">
                  <span className="text-[10px] bg-yellow-950/30 text-yellow-500 font-bold h-3.5 w-3.5 rounded-full flex items-center justify-center border border-yellow-500/30 hover:border-yellow-500/60">i</span>
                  <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 hidden group-hover:block bg-zinc-950 text-zinc-200 text-[10px] font-normal p-3 rounded-md shadow-lg border border-zinc-800/80 z-50 text-left leading-normal space-y-1.5">
                    <p className="font-bold text-yellow-400 border-b border-zinc-800/80 pb-1 mb-1">Scoring Breakdown</p>
                    <p className="font-mono text-zinc-400 bg-zinc-900/60 p-1.5 rounded text-[9px] mb-1.5 text-center">
                      Priority × DECO × 100 × Bonus
                    </p>
                    <div className="flex justify-between text-zinc-450">
                      <span>Priority Weight ({task.priority}):</span>
                      <span className="font-semibold text-zinc-300">{priority.weight}</span>
                    </div>
                    <div className="flex justify-between text-zinc-450">
                      <span>DECO Weight ({deco.label}):</span>
                      <span className="font-semibold text-zinc-300">{deco.weight}</span>
                    </div>
                    <div className="flex justify-between text-zinc-450">
                      <span>Days Early:</span>
                      <span className="font-semibold text-zinc-300">
                        {daysEarly > 0 ? `+${daysEarly}d early` : daysEarly === 0 ? "0d (on due date)" : `${daysEarly}d late`}
                      </span>
                    </div>
                    <div className="flex justify-between border-t border-zinc-800/80 pt-1 mt-1 text-zinc-300 font-semibold">
                      <span>Completion Bonus:</span>
                      <span>{bonus}</span>
                    </div>
                  </span>
                </span>
              </div>
              <span className="text-xl font-bold text-yellow-400">
                {projectedScore != null ? `${projectedScore} pts` : "0 pts"}
              </span>
            </div>
          </div>

          {/* Action Options Footer */}
          <div className="pt-4 border-t border-zinc-800">
            {isEditing ? (
              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant="outline"
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="flex items-center justify-center gap-1.5 py-2 text-xs font-semibold border-zinc-700 text-zinc-300 hover:text-white rounded-lg transition-colors"
                >
                  <X className="h-4 w-4" />
                  Cancel
                </Button>
                <Button
                  type="button"
                  onClick={handleSaveEdit}
                  disabled={isPending || !editName.trim() || editLabels.length < 1}
                  className="flex items-center justify-center gap-1.5 py-2 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50"
                >
                  <Save className="h-4 w-4" />
                  Save Changes
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {canDelete ? (
                  <Button
                    variant="destructive"
                    disabled={isPending}
                    onClick={handleDelete}
                    className="flex items-center justify-center gap-1.5 py-2 text-xs font-semibold bg-red-650 hover:bg-red-700 text-white rounded-lg transition-colors"
                  >
                    <Trash2 className="h-4 w-4" />
                    Delete
                  </Button>
                ) : (
                  <p className="text-xs text-zinc-500 text-center w-full bg-zinc-900/50 py-2.5 px-3 rounded-lg border border-zinc-800/80">
                    Dependency (unauthorized)
                  </p>
                )}
                <Button
                  variant="outline"
                  onClick={() => setIsEditing(true)}
                  className="flex items-center justify-center gap-1.5 py-2 text-xs font-semibold border-zinc-700 text-zinc-300 hover:text-white rounded-lg transition-colors"
                >
                  <Edit className="h-4 w-4" />
                  Edit Task
                </Button>
              </div>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg p-3" style={{ backgroundColor: "#2D2D2D" }}>
      <p className="text-xs text-zinc-400 mb-1">{label}</p>
      <p className="text-sm">{value}</p>
    </div>
  );
}
