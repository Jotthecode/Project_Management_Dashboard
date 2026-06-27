// components/ai-task-agent.tsx
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, Wand2, X, CalendarIcon, Check } from "lucide-react";
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
import { createTask } from "@/actions/tasks";
import {
  type Profile,
  type PriorityLevel,
  type DecoLevel,
  type LabelCategory,
  PRIORITY_CONFIG,
  DECO_CONFIG,
  LABEL_CONFIG,
} from "@/lib/types";

const ALL_LABELS = Object.keys(LABEL_CONFIG) as LabelCategory[];
const ALL_PRIORITIES = Object.keys(PRIORITY_CONFIG) as PriorityLevel[];
const ALL_DECOS = Object.keys(DECO_CONFIG) as DecoLevel[];

interface AITaskAgentProps {
  profiles: Profile[];
}

export function AITaskAgent({ profiles }: AITaskAgentProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isPending, startTransition] = useTransition();

  // Preview form state
  const [showPreview, setShowPreview] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [ownerId, setOwnerId] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [priority, setPriority] = useState<PriorityLevel | "">("");
  const [deco, setDeco] = useState<DecoLevel | "">("");
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

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
    if (!prompt.trim()) {
      return toast.error("Please describe your task first.");
    }

    setIsGenerating(true);
    try {
      const today = new Date().toISOString().split("T")[0];
      const res = await fetch("/api/ai-agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: prompt,
          profiles,
          currentDate: today,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to generate task");
      }

      const data = await res.json();

      // Pre-fill parsed fields
      setName(data.name || "");
      setDescription(data.description || "");

      // Match ownerName to profiles
      if (data.ownerName) {
        const matchedProfile = profiles.find(
          (p) => p.full_name.toLowerCase() === data.ownerName.toLowerCase()
        );
        setOwnerId(matchedProfile ? matchedProfile.id : "");
      } else {
        setOwnerId("");
      }

      setDueDate(data.dueDate || "");
      setPriority(data.priority || "");
      setDeco(data.deco || "");
      setLabels(data.labels || []);

      setShowPreview(true);
      toast.success("Task details parsed successfully!");
    } catch (err: any) {
      toast.error("AI Parsing Failed", {
        description: err.message || "Please check your network or api key.",
      });
    } finally {
      setIsGenerating(false);
    }
  }

  function handleCreateTask() {
    if (!name.trim()) return toast.error("Task name is required.");
    if (!ownerId) return toast.error("Please select an owner.");
    if (!dueDate) return toast.error("Please select a due date.");
    if (!priority) return toast.error("Please select a priority.");
    if (!deco) return toast.error("Please select a DECO level.");
    if (labels.length < 1) return toast.error("Please select at least one label.");

    startTransition(async () => {
      try {
        await createTask({
          name: name.trim(),
          description: description.trim(),
          ownerId,
          wingmenIds: [],
          dueDate,
          priority,
          deco,
          complexity: deco,
          labels,
          status: "sierra_bravo",
        });

        toast.success("Task created!", {
          description: `"${name}" was successfully added to Sierra Bravo.`,
        });

        // Reset
        setPrompt("");
        setShowPreview(false);
        setIsOpen(false);
        router.refresh();
      } catch (err: any) {
        toast.error("Couldn't create task", {
          description: err.message || "Something went wrong.",
        });
      }
    });
  }

  return (
    <>
      {/* Floating Sparkle Button */}
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 h-14 w-14 rounded-full bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center shadow-xl hover:scale-105 active:scale-95 transition-all z-50 group border border-blue-500/20"
      >
        <Sparkles className="h-6 w-6 group-hover:rotate-12 transition-transform" />
      </button>

      {/* Dialog Overlay */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm transition-opacity">
          {/* Modal Content */}
          <div
            className="w-full max-w-lg rounded-xl border border-zinc-800 p-6 flex flex-col max-h-[90vh] overflow-y-auto"
            style={{ backgroundColor: "#1E1E1E", color: "#FFFFFF" }}
          >
            {/* Header */}
            <div className="flex items-center justify-between pb-4 border-b border-zinc-800">
              <div className="flex items-center gap-2 text-blue-400 font-bold">
                <Wand2 className="h-5 w-5" />
                <span>AI Task Agent</span>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  setIsOpen(false);
                  setShowPreview(false);
                }}
                className="h-8 w-8 text-zinc-400 hover:text-white"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            {!showPreview ? (
              /* Step 1: Prompt Input */
              <form onSubmit={handleGenerate} className="mt-4 flex flex-col gap-4">
                <div className="space-y-1">
                  <Label htmlFor="ai-prompt" className="text-zinc-300">
                    Describe the task in plain English
                  </Label>
                  <Textarea
                    id="ai-prompt"
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder="e.g. Akash needs to finish the operations meeting notes by tomorrow"
                    className="bg-[#2D2D2D] border-zinc-700 text-white placeholder:text-zinc-500 min-h-[120px]"
                  />
                  <p className="text-xs text-zinc-500 leading-normal">
                    Tip: Mention who, when, the priority (e.g. "very important"), and complexity (e.g. "takes 1-3 days") to help Claude set parameters.
                  </p>
                </div>
                <Button
                  type="submit"
                  disabled={isGenerating}
                  className="w-full bg-blue-600 hover:bg-blue-700"
                >
                  {isGenerating ? "Parsing text with Claude..." : "Parse Task with AI"}
                </Button>
              </form>
            ) : (
              /* Step 2: Editable Preview Form */
              <div className="mt-4 space-y-4 text-sm">
                <p className="text-xs text-blue-400 bg-blue-600/10 border border-blue-500/20 rounded px-2.5 py-1.5 font-medium">
                  Review and adjust the extracted task details below.
                </p>

                {/* Task Name */}
                <div className="space-y-1.5">
                  <Label htmlFor="preview-name" className="text-zinc-300">
                    Task Name
                  </Label>
                  <Input
                    id="preview-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="bg-[#2D2D2D] border-zinc-700 text-white"
                  />
                </div>

                {/* Description */}
                <div className="space-y-1.5">
                  <Label htmlFor="preview-description" className="text-zinc-300">
                    Description
                  </Label>
                  <Textarea
                    id="preview-description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="bg-[#2D2D2D] border-zinc-700 text-white min-h-[60px]"
                  />
                </div>

                {/* Owner */}
                <div className="space-y-1.5">
                  <Label className="text-zinc-300">Owner</Label>
                  <Select value={ownerId} onValueChange={setOwnerId}>
                    <SelectTrigger className="bg-[#2D2D2D] border-zinc-700 text-white">
                      <SelectValue placeholder="Select Owner" />
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

                {/* Due Date */}
                <div className="space-y-1.5">
                  <Label className="text-zinc-300">Due Date</Label>
                  <Input
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="bg-[#2D2D2D] border-zinc-700 text-white focus:outline-none block w-full px-3 py-2 text-sm"
                  />
                </div>

                {/* Priority */}
                <div className="space-y-1.5">
                  <Label className="text-zinc-300">Priority</Label>
                  <Select
                    value={priority}
                    onValueChange={(v) => setPriority(v as PriorityLevel)}
                  >
                    <SelectTrigger className="bg-[#2D2D2D] border-zinc-700 text-white">
                      <SelectValue placeholder="Select Priority" />
                    </SelectTrigger>
                    <SelectContent className="bg-[#2D2D2D] border-zinc-700 text-white">
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

                {/* DECO */}
                <div className="space-y-1.5">
                  <Label className="text-zinc-300">DECO</Label>
                  <Select value={deco} onValueChange={(v) => setDeco(v as DecoLevel)}>
                    <SelectTrigger className="bg-[#2D2D2D] border-zinc-700 text-white">
                      <SelectValue placeholder="Select DECO" />
                    </SelectTrigger>
                    <SelectContent className="bg-[#2D2D2D] border-zinc-700 text-white">
                      {ALL_DECOS.map((d) => (
                        <SelectItem key={d} value={d}>
                          <span className="flex items-center gap-2">
                            <span
                              className="h-2.5 w-2.5 rounded-full"
                              style={{ backgroundColor: DECO_CONFIG[d].color }}
                            />
                            {DECO_CONFIG[d].label} · {DECO_CONFIG[d].duration}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Labels */}
                <div className="space-y-1.5">
                  <Label className="text-zinc-300">Labels (choose 1–2)</Label>
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

                {/* Actions */}
                <div className="flex gap-2 pt-4 border-t border-zinc-800">
                  <Button
                    variant="outline"
                    onClick={() => setShowPreview(false)}
                    className="flex-1 border-zinc-700 text-zinc-300 hover:text-white"
                  >
                    Back to text
                  </Button>
                  <Button
                    onClick={handleCreateTask}
                    disabled={isPending}
                    className="flex-1 bg-blue-600 hover:bg-blue-700"
                  >
                    {isPending ? "Saving..." : "Confirm & Save"}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
