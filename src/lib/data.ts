export type LaneId = "todo" | "doing" | "review" | "done";

export type Priority = "p0" | "p1" | "p2" | "p3";

/**
 * UserId is a plain string post-Clerk. The literal union we used pre-
 * Clerk (`"chloe" | "david" | …`) couldn't accept Clerk's `user_2abc…`
 * format, and gradual migration would have meant two coexisting
 * meanings across 29 files for a week. Day-1 widening, one diff.
 *
 * Showcase fiction (`src/components/showcase/*`) keeps its own
 * narrow `DemoUserId` literal — that surface is a closed cinematic
 * system, not real auth.
 */
export type UserId = string;

export type UserMeta = {
  id: string;
  name: string;
  color: string;
  initials: string;
};

/** Seeded identities used by the legacy single-workspace fixture +
 *  the cinematic landing demo. Real users are minted by the Clerk
 *  webhook into the `users` DB table, then resolved at request time
 *  via `getWorkspaceMembers()` — that path doesn't go through here. */
const SEEDED: Record<string, UserMeta> = {
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

/** Synthesize a `UserMeta` for ids the seeded map doesn't know — i.e.
 *  every real Clerk-issued user id post-Phase-A. Avatar shows two-
 *  letter initials from the id tail; color stays neutral until the
 *  webhook hydrates a real avatar. */
function fallbackUserMeta(id: string): UserMeta {
  // Strip the `user_` prefix Clerk uses; show the last 2 chars as
  // initials so two unknown users at least look distinct.
  const tail = id.replace(/^user_/, "").toUpperCase();
  return {
    id,
    name: id,
    color: "#94a3b8", // ink-quiet neutral
    initials: tail.slice(-2) || "??",
  };
}

/**
 * USERS is a `Proxy` over `SEEDED`. Known-seed lookups return their
 * canonical row; anything else (a Clerk id, a guest, an old comment
 * by a now-deleted user) gets a synthesized fallback so render code
 * never has to null-check `USERS[someId]`.
 */
export const USERS: Record<string, UserMeta> = new Proxy(SEEDED, {
  get(target, prop: string | symbol): UserMeta | undefined {
    if (typeof prop !== "string") return undefined;
    return target[prop] ?? fallbackUserMeta(prop);
  },
});

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
  /** Owning workspace. Set on every persisted task; absent only on
   *  the in-file seed fixtures and on legacy rows pre-Phase-A backfill.
   *  Server actions guard writes on this column to keep updates and
   *  deletes inside the caller's active workspace. */
  workspaceId?: string | null;
  title: string;
  description?: string;
  lane: LaneId;
  priority: Priority;
  assignees: UserId[];
  due?: string;
  /** Structured datetime parsed from `due` or the natural-language
   *  quick-add. Powers date-aware features: digest cron, overdue
   *  highlighting, calendar pinning. */
  dueAt?: Date;
  estimate?: number; // hours
  tags?: string[];
  comments?: number;
  idleDays?: number;
  blockedBy?: string[];
  startDay?: number; // 0-13 for timeline
  durationDays?: number; // for timeline
  /** Optional recurrence rule. When set, completing the task spawns
   *  a new instance in `todo` with the due date advanced by one
   *  interval. Mirrors RFC 5545 RRULE in spirit, vastly simplified. */
  recurrence?: Recurrence;
  /** Float gap-numbering for stable in-lane ordering. Server-set
   *  on insert and on cross-lane move. Drops between siblings will
   *  later compute (prev + next) / 2 so neighbors never renumber. */
  position?: number;
  /** Optional parent task id. Null on every top-level task; non-null
   *  marks the row as a subtask of the referenced parent. v1 caps
   *  nesting at one level — subtasks don't themselves have subtasks.
   *  The detail panel surfaces children inline; `getTasks` filters
   *  parented rows out of the main board / list / timeline / calendar. */
  parentTaskId: string | null;
  /** Optional outside person attached to the task — wedding vendor,
   *  freelance client invoice contact, anyone outside the workspace
   *  the work involves. Both nullable; the panel renders whichever
   *  are present. */
  externalContactName: string | null;
  externalContactEmail: string | null;
  /** Optional dollar amount attached to the task, stored as integer
   *  cents. Wedding planner's outstanding vendor invoice, freelancer's
   *  billable amount, anyone who'd otherwise stash the number in a
   *  separate sheet. Null when no amount is set. */
  cents: number | null;
  /** Last time any field was mutated. Drives "edited Xh ago" copy. */
  updatedAt: Date;
};

/**
 * Natural-language recurrence spec. Three patterns only — no RRULE,
 * no exception editor. Parsed from quick-add input by
 * `parseRecurrence()` in `src/lib/nlp/parse-recurrence.ts`.
 *
 *   weekly            — "every Tuesday"
 *   monthly-day       — "first of the month", "15th of the month"
 *   monthly-first-weekday — "every first Monday of the month"
 *
 * If the user wants something outside these three, `parseRecurrence`
 * returns null and they make a copy. Restraint is the feature.
 *
 * Weekday integers follow JS Date.getDay(): 0=Sun … 6=Sat.
 */
export type RecurrenceSpec =
  | { kind: "weekly"; weekday: 0 | 1 | 2 | 3 | 4 | 5 | 6 }
  | { kind: "monthly-day"; day: number }
  | { kind: "monthly-first-weekday"; weekday: 0 | 1 | 2 | 3 | 4 | 5 | 6 };

/** Alias kept for the schema type-column reference. */
export type Recurrence = RecurrenceSpec;

// Stagger seed updatedAt timestamps so the panel renders a realistic
// "edited Nh ago" gradient on first boot. Each subsequent task is 1h
// older than the previous.
const _seedNow = Date.now();
const _seedTaskInputs: Omit<
  Task,
  | "updatedAt"
  | "externalContactName"
  | "externalContactEmail"
  | "cents"
  | "parentTaskId"
>[] = [
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
    title: "Quarterly themes · Q3",
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
  externalContactName: null,
  externalContactEmail: null,
  cents: null,
  parentTaskId: null,
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

// ────────────────────────────────────────────────────────────────────
// Attachments
// ────────────────────────────────────────────────────────────────────

/**
 * One uploaded file bound to a task. Bytes live on disk under
 * `<repo>/.data/uploads/...` (outside `public/` — never served by the
 * static handler); this metadata row is what the panel renders and
 * what the authenticated `/api/attachments/[id]` route consults
 * before streaming the file. `storedPath` is server-private and is
 * intentionally never serialized to the client.
 */
export type Attachment = {
  id: string;
  workspaceId: string | null;
  taskId: string;
  uploaderUserId: UserId;
  filename: string;
  storedPath: string;
  mimeType: string;
  /** Bytes. Hard-cap 25 MB enforced server-side. */
  sizeBytes: number;
  createdAt: Date;
};

/** Default identity used as a fallback before the tasks_user cookie
 *  is set. Real "current user" resolution lives in `@/server/auth`
 *  (server) and `@/lib/auth-context` (client). Kept here as a single
 *  source of truth for the default. */
export const DEFAULT_USER: UserId = "david";

// ────────────────────────────────────────────────────────────────────
// Activity log
// ────────────────────────────────────────────────────────────────────

export type ActivityKind =
  | "taskAdd"
  | "move"
  | "toggleComplete"
  | "update"
  | "commentAdd"
  | "commentRemove"
  | "attach"
  | "detach";

export type UpdateField =
  | "title"
  | "description"
  | "priority"
  | "due"
  | "assignees"
  | "tags"
  | "estimate"
  | "recurrence";

export type ActivityPayload =
  | { kind: "taskAdd"; lane: LaneId }
  | { kind: "move"; from: LaneId; to: LaneId }
  | { kind: "toggleComplete"; to: "done" | "open" }
  | { kind: "update"; field: UpdateField }
  | { kind: "commentAdd"; commentId: string; snippet: string }
  | { kind: "commentRemove"; commentId: string }
  | {
      kind: "attach";
      attachmentId: string;
      filename: string;
      sizeBytes: number;
    }
  | {
      kind: "detach";
      attachmentId: string;
      filename: string;
    };

export type Activity = {
  id: string;
  taskId: string;
  userId: UserId;
  kind: ActivityKind;
  payload: ActivityPayload;
  createdAt: Date;
};

// ────────────────────────────────────────────────────────────────────
// Notifications
// ────────────────────────────────────────────────────────────────────

export type NotificationKind = "mention" | "blocked" | "dueToday";

export type NotificationPayload =
  | {
      kind: "mention";
      commentId: string;
      taskId: string;
      snippet: string;
      from: UserId;
      taskTitle: string;
    }
  | {
      kind: "blocked";
      taskId: string;
      blockerTaskId: string;
      blockerTitle: string;
      taskTitle: string;
    }
  | {
      kind: "dueToday";
      taskId: string;
      taskTitle: string;
    };

export type Notification = {
  id: string;
  userId: UserId;
  kind: NotificationKind;
  taskId: string | null;
  payload: NotificationPayload;
  createdAt: Date;
  readAt: Date | null;
};

// ────────────────────────────────────────────────────────────────────
// Entitlements / Comp licenses
// ────────────────────────────────────────────────────────────────────

/**
 * The five tiers, in capability order:
 *
 *   - `free`    — 1 workspace, all four views, daily digest, 3 editors
 *   - `pro`     — unlimited workspaces (per-user)
 *   - `team`    — full feature set + unlimited members (per-workspace)
 *   - `studio`  — Team-equivalent across every workspace the user owns
 *                 (per-user; Phase 4)
 *   - `wedding` — Team-equivalent for one workspace, lifetime, $79 once
 *
 * For tier-rank gating, `studio` ranks equal to `team` — they unlock
 * the same feature set, just with different scope (per-user vs
 * per-workspace).
 */
/**
 * Tier vocabulary. Canonical names track the marketing pricing
 * surface (signalstudio.ie/pricing). Renamed 2026-05-14 in E-3.1 of
 * the entitlements sprint: `pro` and `team` collapsed into
 * `workspace`; `event` added for the one-workspace-one-event tier.
 * No data migration needed — Tasks had no pro/team rows in the wild.
 */
export type EntitlementTier =
  | "free"
  | "event"
  | "wedding"
  | "workspace"
  | "studio";

export type EntitlementSource =
  | "default" // baseline free tier
  | "purchase" // paid via Stripe
  | "comp" // redeemed a comp code
  | "edu"; // verified .edu address

export type Entitlement = {
  id: string;
  userId: UserId;
  tier: EntitlementTier;
  source: EntitlementSource;
  /** When this entitlement starts (e.g. now for redemptions). */
  startedAt: Date;
  /** When it lapses. Null = perpetual (default-free, lifetime wedding). */
  expiresAt: Date | null;
  /** Free-form note — e.g. the comp code id, the .edu domain. */
  notes: string | null;
  /** First time the user reached /app/board after this entitlement
   *  activated. Null until they actually land. Powers the Venue
   *  Editions "did the next person finish?" signal on /hq/partners
   *  without a separate event-log table. Set idempotently from the
   *  board page render — see markVenueEntitlementReached. */
  reachedBoardAt: Date | null;
};

export type CompCode = {
  /** URL-safe slug. The actual gift token. */
  code: string;
  tier: EntitlementTier;
  /** How long each redemption grants the tier. */
  durationDays: number;
  /** Total available redemptions. */
  quantity: number;
  /** Counter incremented on each redemption. */
  redeemed: number;
  /** Free-form admin note ("Yale CS senior class 2026"). */
  notes: string | null;
  createdAt: Date;
  /** Optional expiry on the code itself. After this, redemptions fail. */
  expiresAt: Date | null;
};

/** Body strings used for deterministic seed comments. These seed real
 *  fresh-user conversation threads, so they stay audience-neutral and
 *  in voice (BRAND.md §3): declarative, plain, no jargon, no emoji,
 *  true whether you plan weddings, wire houses, shoot galleries, or
 *  sit exams. The old set was tech-team dogfood ("Pinged finance",
 *  "Bumped this to P1") — the §2.2 vocabulary alienation this product
 *  refuses to ship into a first run. */
export const SEED_COMMENT_BODIES: string[] = [
  "Looks good. Moving this forward today.",
  "Asked them — they'll have an answer by end of week.",
  "Bumped this up. It needs doing first.",
  "Linked the details. Say if anything's unclear.",
  "Everything's in. It just needs a final look.",
  "Locked in. Underway now.",
  "Two small things left, then it's done.",
];
