// components/create-task-sheet.tsx
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { CalendarIcon, Plus, X } from "lucide-react";
import { toast } from "sonner";

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
  SheetTrigger,
} from "@/components/ui/sheet";
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

import { createTask } from "@/actions/tasks";
import {
  type Profile,
  type PriorityLevel,
  type DecoLevel,
  type ComplexityLevel,
  type LabelCategory,
  type TaskStatus,
  PRIORITY_CONFIG,
  DECO_CONFIG,
  LABEL_CONFIG,
  STATUS_CONFIG,
} from "@/lib/types";

const ALL_LABELS = Object.keys(LABEL_CONFIG) as LabelCategory[];
const ALL_PRIORITIES = Object.keys(PRIORITY_CONFIG) as PriorityLevel[];
const ALL_DECOS = Object.keys(DECO_CONFIG) as DecoLevel[];

interface CreateTaskSheetProps {
  profiles: Profile[];
  /** Optional: render a custom trigger. Defaults to a "New Task" button. */
  trigger?: React.ReactNode;
  defaultStatus?: TaskStatus;
}

export function CreateTaskSheet({ profiles, trigger, defaultStatus }: CreateTaskSheetProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  // Form state
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [ownerId, setOwnerId] = useState<string>("");
  const [owner2Id, setOwner2Id] = useState<string>("");
  const [wingmenIds, setWingmenIds] = useState<string[]>([]);
  const [selectedWingmanToAdd, setSelectedWingmanToAdd] = useState("");
  const [dueDate, setDueDate] = useState<Date | undefined>(undefined);
  const [priority, setPriority] = useState<PriorityLevel | "">("");
  const [deco, setDeco] = useState<DecoLevel | "">("medium"); // Duration
  const [complexity, setComplexity] = useState<ComplexityLevel | "">("medium"); // Complexity
  const [labels, setLabels] = useState<LabelCategory[]>([]);
  const [dependencies, setDependencies] = useState<{ dependsOnUserId: string; reason: string }[]>([]);
  const [depUserId, setDepUserId] = useState("");
  const [depReason, setDepReason] = useState("");

  function resetForm() {
    setName("");
    setDescription("");
    setOwnerId("");
    setOwner2Id("");
    setWingmenIds([]);
    setSelectedWingmanToAdd("");
    setDueDate(undefined);
    setPriority("");
    setDeco("medium");
    setComplexity("medium");
    setLabels([]);
    setDependencies([]);
    setDepUserId("");
    setDepReason("");
  }

  function handleAddWingman() {
    if (!selectedWingmanToAdd) return;
    if (wingmenIds.includes(selectedWingmanToAdd)) return;
    setWingmenIds(prev => [...prev, selectedWingmanToAdd]);
    setSelectedWingmanToAdd("");
  }

  function handleRemoveWingman(id: string) {
    setWingmenIds(prev => prev.filter(wId => wId !== id));
  }

  function addDependency() {
    if (!depUserId) return toast.error("Please select a user.");
    if (depReason.trim().length <= 10) return toast.error("Dependency reason must exceed 10 characters.");
    
    if (dependencies.some(d => d.dependsOnUserId === depUserId)) {
      return toast.error("A dependency on this user already exists.");
    }

    setDependencies(prev => [...prev, { dependsOnUserId: depUserId, reason: depReason.trim() }]);
    setDepUserId("");
    setDepReason("");
  }

  function removeDependency(index: number) {
    setDependencies(prev => prev.filter((_, idx) => idx !== index));
  }

  function toggleLabel(label: LabelCategory) {
    setLabels((prev) => {
      if (prev.includes(label)) {
        return prev.filter((l) => l !== label);
      }
      return [...prev, label];
    });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!name.trim()) return toast.error("Task name is required.");
    if (!ownerId) return toast.error("Please select an owner.");
    if (!dueDate) return toast.error("Please select a due date.");
    if (!priority) return toast.error("Please select a priority.");
    if (!deco) return toast.error("Please select a DECO level.");
    if (labels.length < 1) return toast.error("Please select at least one label.");

    startTransition(async () => {
      try {
        const targetStatus = defaultStatus ?? "sierra_bravo";
        await createTask({
          name: name.trim(),
          description: description.trim(),
          ownerId,
          owner2Id: owner2Id && owner2Id !== "unassigned" ? owner2Id : undefined,
          wingmenIds,
          dueDate: format(dueDate, "yyyy-MM-dd"),
          priority,
          deco: deco || "medium",
          complexity: complexity || "medium",
          labels,
          status: targetStatus,
          dependencies,
        });

        toast.success("Task created", {
          description: `"${name}" was added to ${STATUS_CONFIG[targetStatus].label}.`,
        });

        resetForm();
        setOpen(false);
        router.refresh();
      } catch (err: any) {
        toast.error("Couldn't create task", {
          description: err.message ?? "Something went wrong.",
        });
      }
    });
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        {trigger ?? (
          <Button size="sm" className="gap-1.5">
            <Plus className="h-4 w-4" />
            New Task
          </Button>
        )}
      </SheetTrigger>

      <SheetContent
        side="right"
        className="w-full sm:max-w-xl border-l border-zinc-200 dark:border-zinc-800 p-6 sm:p-10 overflow-y-auto bg-white dark:bg-[#1E1E1E] text-zinc-900 dark:text-white"
      >
        <SheetHeader className="pb-5 border-b border-zinc-200 dark:border-zinc-800/85">
          <SheetTitle className="text-zinc-900 dark:text-zinc-50 text-2xl font-bold leading-tight">New Task</SheetTitle>
          <SheetDescription className="text-zinc-550 dark:text-zinc-400 text-sm mt-2 leading-relaxed">Create a task on the SmartScore board. New tasks start in {STATUS_CONFIG[defaultStatus ?? "sierra_bravo"].label}.
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4 text-sm">
          {/* Task Name */}
          <div className="space-y-1.5">
            <Label htmlFor="task-name" className="text-zinc-700 dark:text-zinc-300">
              Task Name
            </Label>
            <Input
              id="task-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Deploy Student Dashboard"
              className="bg-zinc-50 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-600"
            />
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label htmlFor="task-description" className="text-zinc-700 dark:text-zinc-300">
              Description
            </Label>
            <Textarea
              id="task-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What needs to happen?"
              className="bg-zinc-50 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-600 min-h-[80px]"
            />
          </div>

          {/* Owners (Up to 2) */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-zinc-700 dark:text-zinc-300">Primary Owner</Label>
              <Select value={ownerId} onValueChange={setOwnerId}>
                <SelectTrigger className="bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 text-xs">
                  <SelectValue placeholder="Primary Owner" />
                </SelectTrigger>
                <SelectContent className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100">
                  {profiles.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-zinc-700 dark:text-zinc-300">Secondary Owner</Label>
              <Select value={owner2Id} onValueChange={setOwner2Id}>
                <SelectTrigger className="bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 text-xs">
                  <SelectValue placeholder="Optional" />
                </SelectTrigger>
                <SelectContent className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100">
                  <SelectItem value="unassigned">None</SelectItem>
                  {profiles.map((p) => (
                    <SelectItem key={p.id} value={p.id} disabled={p.id === ownerId}>
                      {p.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Wingmen (Collaborators) */}
          <div className="space-y-2">
            <Label className="text-zinc-700 dark:text-zinc-300 text-xs">Wingmen (Additional Owners)</Label>
            <div className="flex gap-2">
              <Select
                value={selectedWingmanToAdd}
                onValueChange={setSelectedWingmanToAdd}
              >
                <SelectTrigger className="bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 text-xs flex-1">
                  <SelectValue placeholder="Add wingman..." />
                </SelectTrigger>
                <SelectContent className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100">
                  {profiles
                    .filter(
                      (p) =>
                        p.id !== ownerId &&
                        p.id !== owner2Id &&
                        !wingmenIds.includes(p.id)
                    )
                    .map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.full_name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
              <Button
                type="button"
                onClick={handleAddWingman}
                className="bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-750 text-zinc-900 dark:text-white text-xs border border-zinc-200 dark:border-zinc-700 px-3 shrink-0 h-9"
              >
                Add
              </Button>
            </div>
            {wingmenIds.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {wingmenIds.map((wId) => {
                  const profile = profiles.find((p) => p.id === wId);
                  return (
                    <Badge
                      key={wId}
                      variant="secondary"
                      className="bg-zinc-800 border border-zinc-700 text-zinc-300 text-[10px] pl-2 pr-1 py-0.5 flex items-center gap-1"
                    >
                      <span>{profile?.full_name}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveWingman(wId)}
                        className="text-zinc-500 hover:text-white rounded-full p-0.5"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  );
                })}
              </div>
            )}
          </div>

          {/* Due Date */}
          <div className="space-y-1.5">
            <Label className="text-zinc-700 dark:text-zinc-300">Due Date</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  type="button"
                  className={cn(
                    "w-full justify-start text-left font-normal bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800",
                    !dueDate && "text-zinc-500"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4 text-zinc-500" />
                  {dueDate ? format(dueDate, "PPP") : "Pick a date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100">
                <Calendar
                  mode="single"
                  selected={dueDate}
                  onSelect={setDueDate}
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Priority */}
          <div className="space-y-1.5">
            <Label className="text-zinc-700 dark:text-zinc-300">Priority</Label>
            <Select value={priority} onValueChange={(v) => setPriority(v as PriorityLevel)}>
              <SelectTrigger className="bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100">
                <SelectValue placeholder="Select priority" />
              </SelectTrigger>
              <SelectContent className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100">
                {ALL_PRIORITIES.map((p) => (
                  <SelectItem key={p} value={p}>
                    <span className="flex items-center gap-2">
                      <span
                        className="h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: PRIORITY_CONFIG[p].color }}
                      />
                      {p} · {PRIORITY_CONFIG[p].label}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {/* Duration & Complexity Decoupled */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5">
                <Label className="text-zinc-300 text-xs">Duration</Label>
                <span className="relative group inline-flex items-center cursor-pointer text-zinc-400 hover:text-white transition-colors">
                  <span className="text-[10px] bg-zinc-800 text-zinc-450 font-bold h-4 w-4 rounded-full flex items-center justify-center border border-zinc-700 hover:border-zinc-500">i</span>
                  <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 hidden group-hover:block bg-zinc-950 text-zinc-200 text-[10px] font-normal p-2 rounded-md shadow-lg border border-zinc-800 z-50 text-center leading-normal">
                    Duration: How long the task will take to complete.
                  </span>
                </span>
              </div>
              <Select value={deco} onValueChange={(v) => setDeco(v as DecoLevel)}>
                <SelectTrigger className="bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 text-xs">
                  <SelectValue placeholder="Duration" />
                </SelectTrigger>
                <SelectContent className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100">
                  {Object.keys(DECO_CONFIG).map((dKey) => (
                    <SelectItem key={dKey} value={dKey} className="text-xs">
                      {DECO_CONFIG[dKey as DecoLevel].label} ({DECO_CONFIG[dKey as DecoLevel].duration})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5">
                <Label className="text-zinc-300 text-xs">Complexity</Label>
                <span className="relative group inline-flex items-center cursor-pointer text-zinc-400 hover:text-white transition-colors">
                  <span className="text-[10px] bg-zinc-800 text-zinc-450 font-bold h-4 w-4 rounded-full flex items-center justify-center border border-zinc-700 hover:border-zinc-500">i</span>
                  <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 hidden group-hover:block bg-zinc-950 text-zinc-200 text-[10px] font-normal p-2 rounded-md shadow-lg border border-zinc-800 z-50 text-center leading-normal">
                    Complexity: The cognitive or technical difficulty.
                  </span>
                </span>
              </div>
              <Select value={complexity} onValueChange={(v) => setComplexity(v as ComplexityLevel)}>
                <SelectTrigger className="bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 text-xs">
                  <SelectValue placeholder="Complexity" />
                </SelectTrigger>
                <SelectContent className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100">
                  {Object.keys(DECO_CONFIG).map((dKey) => (
                    <SelectItem key={dKey} value={dKey} className="text-xs">
                      {DECO_CONFIG[dKey as DecoLevel].label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Labels (multi-select, max 2) */}
          <div className="space-y-1.5">
            <Label className="text-zinc-700 dark:text-zinc-300">
              Labels <span className="text-zinc-500">(choose 1–2)</span>
            </Label>
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

          {/* Dependencies (PRD) */}
          <div className="space-y-3 pt-3 border-t border-zinc-250 dark:border-zinc-800">
            <Label className="text-zinc-750 dark:text-zinc-300 font-semibold block text-xs uppercase tracking-wider">
              Dependencies
            </Label>

            {dependencies.length > 0 && (
              <div className="flex flex-col gap-1.5 p-2 bg-zinc-50/70 dark:bg-[#2D2D2D]/50 rounded-lg border border-zinc-200 dark:border-zinc-800">
                {dependencies.map((dep, idx) => {
                  const user = profiles.find((p) => p.id === dep.dependsOnUserId);
                  return (
                    <div
                      key={idx}
                      className="flex items-center justify-between text-xs bg-zinc-800 p-2 rounded border border-zinc-700 text-zinc-300 animate-in fade-in"
                    >
                      <span className="truncate max-w-[85%]">
                        <strong>{user?.full_name}</strong>: {dep.reason}
                      </span>
                      <button
                        type="button"
                        onClick={() => removeDependency(idx)}
                        className="text-zinc-500 hover:text-red-400 font-bold ml-2 transition-colors"
                      >
                        ✕
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="space-y-2 bg-zinc-50/40 dark:bg-zinc-900/30 p-3 rounded-lg border border-zinc-200 dark:border-zinc-800/85">
              <div className="space-y-1">
                <Label className="text-zinc-550 dark:text-zinc-400 text-xs">Depends on</Label>
                <Select value={depUserId} onValueChange={setDepUserId}>
                  <SelectTrigger className="bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 text-xs h-9">
                    <SelectValue placeholder="Select user" />
                  </SelectTrigger>
                  <SelectContent className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100">
                    {profiles.map((p) => (
                      <SelectItem key={p.id} value={p.id} disabled={p.id === ownerId}>
                        {p.full_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-zinc-550 dark:text-zinc-400 text-xs">For</Label>
                <Input
                  value={depReason}
                  onChange={(e) => setDepReason(e.target.value)}
                  placeholder="e.g. Needs backend API design completed"
                  className="bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 text-xs h-9 placeholder:text-zinc-400 dark:placeholder:text-zinc-600"
                />
                {depReason && depReason.trim().length <= 10 && (
                  <p className="text-[10px] text-red-400 mt-1">Reason must exceed 10 characters.</p>
                )}
              </div>

              <Button
                type="button"
                onClick={addDependency}
                disabled={depReason.trim().length <= 10}
                variant="outline"
                className="w-full text-xs h-8 border-zinc-650 hover:bg-zinc-800 text-zinc-300 hover:text-white disabled:opacity-50 disabled:pointer-events-none"
              >
                Add Dependency
              </Button>
            </div>
          </div>

          <SheetFooter className="mt-6 px-0">
            <Button
              type="submit"
              disabled={isPending}
              className="w-full bg-blue-600 hover:bg-blue-700"
            >
              {isPending ? "Creating..." : "Create Task"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}