export type LaneId = "todo" | "doing" | "review" | "done";

export type Priority = "p0" | "p1" | "p2" | "p3";

export type UserId = "chloe" | "david" | "alex" | "ada" | "marcus";

export const USERS: Record<
  UserId,
  { id: UserId; name: string; color: string; initials: string }
> = {
  chloe: {
    id: "chloe",
    name: "Chloe",
    color: "var(--user-chloe)",
    initials: "CL",
  },
  david: {
    id: "david",
    name: "David",
    color: "var(--user-david)",
    initials: "DV",
  },
  alex: {
    id: "alex",
    name: "Alex",
    color: "var(--user-alex)",
    initials: "AX",
  },
  ada: {
    id: "ada",
    name: "Ada",
    color: "#f59e0b",
    initials: "AD",
  },
  marcus: {
    id: "marcus",
    name: "Marcus",
    color: "#10b981",
    initials: "MR",
  },
};

export const LANES: Record<
  LaneId,
  { id: LaneId; name: string; ink: string; bg: string; dot: string }
> = {
  todo: {
    id: "todo",
    name: "To do",
    ink: "var(--lane-todo-ink)",
    bg: "var(--lane-todo)",
    dot: "var(--lane-todo-dot)",
  },
  doing: {
    id: "doing",
    name: "In progress",
    ink: "var(--lane-doing-ink)",
    bg: "var(--lane-doing)",
    dot: "var(--lane-doing-dot)",
  },
  review: {
    id: "review",
    name: "In review",
    ink: "var(--lane-review-ink)",
    bg: "var(--lane-review)",
    dot: "var(--lane-review-dot)",
  },
  done: {
    id: "done",
    name: "Done",
    ink: "var(--lane-done-ink)",
    bg: "var(--lane-done)",
    dot: "var(--lane-done-dot)",
  },
};

export const LANE_ORDER: LaneId[] = ["todo", "doing", "review", "done"];

export type Task = {
  id: string;
  title: string;
  description?: string;
  lane: LaneId;
  priority: Priority;
  assignees: UserId[];
  due?: string;
  estimate?: number; // hours
  tags?: string[];
  comments?: number;
  idleDays?: number;
  blockedBy?: string[];
  startDay?: number; // 0-13 for timeline
  durationDays?: number; // for timeline
  /** Last time any field was mutated. Drives "edited Xh ago" copy. */
  updatedAt: Date;
};

// Stagger seed updatedAt timestamps so the panel renders a realistic
// "edited Nh ago" gradient on first boot. Each subsequent task is 1h
// older than the previous.
const _seedNow = Date.now();
const _seedTaskInputs: Omit<Task, "updatedAt">[] = [
  // To do
  {
    id: "t-101",
    title: "Audit pricing page conversion funnel",
    lane: "todo",
    priority: "p1",
    assignees: ["chloe"],
    due: "Fri",
    estimate: 6,
    tags: ["growth"],
    startDay: 1,
    durationDays: 3,
  },
  {
    id: "t-102",
    title: "Review beta feedback themes",
    lane: "todo",
    priority: "p2",
    assignees: ["alex"],
    estimate: 3,
    tags: ["research"],
    startDay: 2,
    durationDays: 2,
  },
  {
    id: "t-103",
    title: "Sprint planning · Q3 themes",
    lane: "todo",
    priority: "p1",
    assignees: ["david", "chloe"],
    due: "Mon",
    estimate: 4,
    tags: ["planning"],
    startDay: 3,
    durationDays: 2,
  },
  {
    id: "t-104",
    title: "Refresh component color tokens",
    lane: "todo",
    priority: "p3",
    assignees: ["alex"],
    estimate: 2,
    tags: ["design-system"],
    startDay: 4,
    durationDays: 2,
  },
  {
    id: "t-105",
    title: "Customer success — quarterly stories",
    lane: "todo",
    priority: "p2",
    assignees: ["ada"],
    estimate: 4,
    tags: ["marketing"],
    startDay: 5,
    durationDays: 3,
  },

  // Doing
  {
    id: "t-201",
    title: "Sales demo sync",
    lane: "doing",
    priority: "p1",
    assignees: ["chloe"],
    due: "Today",
    estimate: 1,
    tags: ["meeting"],
    startDay: 0,
    durationDays: 1,
  },
  {
    id: "t-202",
    title: "Launch demo video — final cut",
    lane: "doing",
    priority: "p0",
    assignees: ["david"],
    due: "Tomorrow",
    estimate: 8,
    tags: ["launch"],
    idleDays: 4,
    startDay: 0,
    durationDays: 4,
    blockedBy: ["t-201"],
  },
  {
    id: "t-203",
    title: "Headcount planning · engineering",
    lane: "doing",
    priority: "p2",
    assignees: ["marcus"],
    estimate: 5,
    tags: ["ops"],
    startDay: 2,
    durationDays: 4,
  },
  {
    id: "t-204",
    title: "Engineering sync · roadmap",
    lane: "doing",
    priority: "p2",
    assignees: ["david", "marcus"],
    estimate: 2,
    tags: ["meeting"],
    startDay: 3,
    durationDays: 1,
  },

  // Review
  {
    id: "t-301",
    title: "Weekly sales status report",
    lane: "review",
    priority: "p2",
    assignees: ["chloe"],
    estimate: 2,
    tags: ["report"],
    idleDays: 6,
    startDay: 5,
    durationDays: 2,
  },
  {
    id: "t-302",
    title: "Marketing campaign · banner set",
    lane: "review",
    priority: "p1",
    assignees: ["ada"],
    estimate: 6,
    tags: ["marketing"],
    startDay: 6,
    durationDays: 2,
  },
  {
    id: "t-303",
    title: "Latest features · customer email",
    lane: "review",
    priority: "p2",
    assignees: ["chloe", "ada"],
    estimate: 3,
    tags: ["lifecycle"],
    startDay: 7,
    durationDays: 1,
  },

  // Done
  {
    id: "t-401",
    title: "Project onboarding deck",
    lane: "done",
    priority: "p2",
    assignees: ["alex"],
    estimate: 4,
    tags: ["onboarding"],
    startDay: 0,
    durationDays: 2,
  },
  {
    id: "t-402",
    title: "Finalize launch timeline",
    lane: "done",
    priority: "p1",
    assignees: ["david"],
    estimate: 3,
    tags: ["launch"],
    startDay: 1,
    durationDays: 1,
  },
  {
    id: "t-403",
    title: "All-hands alignment",
    lane: "done",
    priority: "p3",
    assignees: ["marcus"],
    estimate: 1,
    tags: ["meeting"],
    startDay: 2,
    durationDays: 1,
  },
  {
    id: "t-404",
    title: "Press release · draft v2",
    lane: "done",
    priority: "p1",
    assignees: ["ada"],
    estimate: 2,
    tags: ["pr"],
    startDay: 3,
    durationDays: 1,
  },
];

export const SEED_TASKS: Task[] = _seedTaskInputs.map((t, i) => ({
  ...t,
  updatedAt: new Date(_seedNow - i * 3_600_000),
}));

export const PRIORITY_LABEL: Record<Priority, { label: string; color: string }> =
  {
    p0: { label: "Urgent", color: "#dc2626" },
    p1: { label: "High", color: "#ea580c" },
    p2: { label: "Medium", color: "#0284c7" },
    p3: { label: "Low", color: "#64748b" },
  };

// ────────────────────────────────────────────────────────────────────
// Comments
// ────────────────────────────────────────────────────────────────────

export type Comment = {
  id: string;
  taskId: string;
  userId: UserId;
  body: string;
  createdAt: Date;
};

/** Hard-coded "logged-in user" until auth lands. Used by the composer
 *  avatar, ownership check for delete affordance, and the server
 *  action that records `userId` on insert. */
export const CURRENT_USER: UserId = "david";

// ────────────────────────────────────────────────────────────────────
// Activity log
// ────────────────────────────────────────────────────────────────────

export type ActivityKind =
  | "taskAdd"
  | "move"
  | "toggleComplete"
  | "update"
  | "commentAdd"
  | "commentRemove";

export type UpdateField =
  | "title"
  | "description"
  | "priority"
  | "due"
  | "assignees"
  | "tags"
  | "estimate";

export type ActivityPayload =
  | { kind: "taskAdd"; lane: LaneId }
  | { kind: "move"; from: LaneId; to: LaneId }
  | { kind: "toggleComplete"; to: "done" | "open" }
  | { kind: "update"; field: UpdateField }
  | { kind: "commentAdd"; commentId: string; snippet: string }
  | { kind: "commentRemove"; commentId: string };

export type Activity = {
  id: string;
  taskId: string;
  userId: UserId;
  kind: ActivityKind;
  payload: ActivityPayload;
  createdAt: Date;
};

/** Body strings used for deterministic seed comments. Lifted from
 *  the previous static comment thread so server seed and any future
 *  fixtures share one source of truth. */
export const SEED_COMMENT_BODIES: string[] = [
  "Hero animation looks great in the latest cut 🎯",
  "Pinged finance — they'll review by EOW.",
  "Bumped this to P1 after the demo sync. Keep moving.",
  "Linking the brief — let me know if anything's unclear.",
  "Marketing has the assets. We just need the copy review.",
  "Spec is locked, building now. ETA Tuesday.",
  "Two design tweaks left, then ready for review.",
];
