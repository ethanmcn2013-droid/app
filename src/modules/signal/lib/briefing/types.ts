/**
 * The briefing, Analytics' product surface.
 *
 * One short read. Six sections. Hard cap of 3 items per bucket.
 * Plain language. Always "from {source}" provenance. Voice locked
 * by docs/COLLABORATION_LOOP.md: speaks like a person, not a
 * dashboard.
 */

export type Lane = "next" | "in-flight" | "review" | "shipped";

/**
 * A single task as seen by the engine. Sourced from the user's
 * connected Tasks workspace; sourceLabel surfaces in the brief as
 * "from Tasks · {workspaceName}".
 */
export type TaskSignal = {
  id: string;
  title: string;
  lane: Lane;
  priority: 0 | 1 | 2 | 3; // 0 = P0 (highest)
  dueAt: number | null; // unix ms; null = no due date
  idleDays: number; // days since last activity
  commentCount: number;
  blockedBy: string[]; // task ids
  sourceLabel: string; // e.g. "Tasks · Wedding 2026"
  // Recent shipped detection
  movedToShippedAt: number | null;
  /** Canonical scope ids stay internal, provenance copy uses sourceLabel. */
  workspaceId?: string;
  planningPeriodId?: string | null;
};

/**
 * Engine output. Each item carries the trigger that surfaced it so
 * the renderer can attach the right "Why this" reasoning on the web
 * view. Email render ignores reasoning by design.
 */
export type BriefItem = {
  id: string;
  text: string;
  sourceLabel: string;
  trigger: TriggerKind;
  reasons: string[]; // for /app/brief web view; emails skip these
  /** Consecutive days (≥ 2) this item has surfaced for this reader.
   *  Present only on carry-overs, renderers show an honest age note
   *  ("still waiting, day 3") and the engine sorts carry-overs to
   *  the bottom of their block (PRODUCT.md §5.3 de-emphasis). */
  ageDays?: number;
  workspaceId?: string;
  planningPeriodId?: string | null;
};

export type TriggerKind =
  | "stuck-work"
  | "due-soon"
  | "just-shipped"
  | "overload"
  | "crowded-week"
  | "blocked-too-long";

export type FocusItem = {
  id: string;
  text: string;
  due: string; // "today" | "by Friday" | "this week" | ISO-ish
  trigger: TriggerKind;
};

export type Briefing = {
  userId: string;
  generatedAt: number;
  greetingHour: number; // 0–23 in user-local time (UTC for v1)
  // Three-cap per bucket is enforced by buildBriefing().
  needsAttention: BriefItem[];
  movingWell: BriefItem[];
  quietRisks: BriefItem[];
  suggestedFocus: FocusItem[];
  // The brief is "empty" when no bucket has anything. Renderer
  // shows a quiet "Nothing to flag today" state, no email is sent.
  isEmpty: boolean;
  /** Segment-aware copy when isEmpty, from Tasks primary_use_case. */
  emptyStateHeadline?: string;
  emptyStateBody?: string;
};
