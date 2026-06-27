// lib/types.ts

export type TaskStatus =
  | "sierra_bravo"
  | "oscar_mike"
  | "india_romeo"
  | "tango_charlie"
  | "oscar_delta";

export type PriorityLevel = "P1" | "P2" | "P3" | "P4" | "P5";

export type DecoLevel = "high" | "medium_high" | "medium" | "medium_low" | "low";

export type LabelCategory =
  | "revenue"
  | "fundraise"
  | "customer_delivery"
  | "ops"
  | "tech"
  | "product";

export type ComplexityLevel = "high" | "medium_high" | "medium" | "medium_low" | "low";

export interface Profile {
  id: string;
  full_name: string;
  email: string;
  avatar_url?: string | null;
}

export interface TaskDependency {
  id: string;
  task_id: string;
  depends_on_user_id: string;
  reason: string;
  linked_task_id: string | null;
  // joined
  depends_on_user?: Profile;
}

export interface Task {
  id: string;
  name: string;
  description: string;
  owner_id: string;
  owner2_id?: string | null;
  wingmen_ids?: string[];
  due_date: string; // ISO date
  priority: PriorityLevel;
  deco: DecoLevel; // Duration
  complexity: ComplexityLevel; // Complexity
  status: TaskStatus;
  labels: LabelCategory[];
  is_blocked: boolean;
  blocked_reason?: string | null;
  parent_task_id?: string | null;
  requested_by?: string | null;
  dependency_reason?: string | null;
  score?: number | null;
  completed_at?: string | null;
  created_at: string;
  updated_at: string;

  // joined relations (populated by queries)
  owner?: Profile;
  owner2?: Profile;
  wingmen?: Profile[];
  contributors?: Profile[];
  dependencies?: TaskDependency[];
  requested_by_user?: Profile;
}

export const STATUS_CONFIG: Record<
  TaskStatus,
  { label: string; subtitle: string; code: string }
> = {
  sierra_bravo: { label: "Sierra Bravo", subtitle: "Tasks that are on standby", code: "SB" },
  oscar_mike: { label: "Oscar Mike", subtitle: "Tasks on the move", code: "OM" },
  india_romeo: { label: "India Romeo", subtitle: "Tasks in review", code: "IR" },
  tango_charlie: { label: "Tango Charlie", subtitle: "Tasks completed successfully", code: "TC" },
  oscar_delta: { label: "Oscar Delta", subtitle: "On the daily — recurring tasks", code: "OD" },
};

export const PRIORITY_CONFIG: Record<
  PriorityLevel,
  { label: string; weight: number; color: string }
> = {
  P1: { label: "Very Important", weight: 0.5, color: "#EF4444" },
  P2: { label: "Important", weight: 0.4, color: "#F97316" },
  P3: { label: "Kind Of Important", weight: 0.3, color: "#EAB308" },
  P4: { label: "Not Important", weight: 0.2, color: "#86EFAC" },
  P5: { label: "Least Important", weight: 0.1, color: "#22C55E" },
};

export const DECO_CONFIG: Record<
  DecoLevel,
  { label: string; duration: string; weight: number; color: string; maxDaysInProgress: number }
> = {
  high: { label: "Very High", duration: "More than 7 Days", weight: 0.5, color: "#EF4444", maxDaysInProgress: 10 },
  medium_high: { label: "High", duration: "5 to 7 Days", weight: 0.4, color: "#F97316", maxDaysInProgress: 7 },
  medium: { label: "Medium", duration: "3 to 5 Days", weight: 0.3, color: "#EAB308", maxDaysInProgress: 5 },
  medium_low: { label: "Low", duration: "1 to 3 Days", weight: 0.2, color: "#86EFAC", maxDaysInProgress: 3 },
  low: { label: "Very Low", duration: "Less than 1 Day", weight: 0.1, color: "#22C55E", maxDaysInProgress: 1 },
};

export const LABEL_CONFIG: Record<LabelCategory, { label: string }> = {
  revenue: { label: "Revenue" },
  fundraise: { label: "Fundraise" },
  customer_delivery: { label: "Customer Delivery" },
  ops: { label: "Ops" },
  tech: { label: "Tech" },
  product: { label: "Product" },
};

export const COLUMN_ORDER: TaskStatus[] = [
  "sierra_bravo",
  "oscar_mike",
  "india_romeo",
  "tango_charlie",
  "oscar_delta",
];

/**
 * Final Score Formula:
 * Score = Priority Weight x DECO Weight x 100 x Early Completion Bonus
 * Bonus: capped at 10, =1 if on due date, =0 if late.
 */
export function calculateScore(
  priority: PriorityLevel,
  deco: DecoLevel,
  complexity: ComplexityLevel,
  dueDate: string,
  completedDate: string
): number {
  const priorityWeight = PRIORITY_CONFIG[priority].weight;
  const durationWeight = DECO_CONFIG[deco].weight;
  const complexityWeight = DECO_CONFIG[complexity].weight;

  const due = new Date(dueDate);
  const completed = new Date(completedDate);
  const msPerDay = 1000 * 60 * 60 * 24;
  const daysEarly = Math.round((due.getTime() - completed.getTime()) / msPerDay);

  let bonus: number;
  if (daysEarly > 10) bonus = 10;
  else if (daysEarly > 0) bonus = daysEarly;
  else if (daysEarly === 0) bonus = 1;
  else bonus = 0;

  return Math.round(priorityWeight * durationWeight * complexityWeight * 100 * bonus * 100) / 100;
}
