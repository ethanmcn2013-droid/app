/**
 * The briefing, Analytics' product surface.
 *
 * One short read. Six sections. Hard cap of 3 items per bucket.
 * Plain language. Always "from {source}" provenance. Voice locked
 * by docs/COLLABORATION_LOOP.md: speaks like a person, not a
 * dashboard.
 */

import type { Deadline } from "../data/deadline";
import type { KnownPriority } from "../data/types";

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
  priority: KnownPriority | null; // 0 = P0 (highest); null = not known
  dueAt: number | null; // legacy instant; date-only values use deadline
  deadline?: Deadline;
  idleDays: number | null; // null when activity history is incomplete
  activityCoverage?: "complete" | "partial";
  /** Positive saved title-edit evidence; false/absent never proves no activity. */
  hasRecordedTitleEdit?: boolean;
  commentCount: number;
  blockedBy: string[]; // task ids
  dependencyCoverage?: "complete" | "partial";
  /** Current terminal evidence for a listed prerequisite; no identity leaves this read model. */
  hasCompletedListedPrerequisite?: boolean;
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
  /** The task title, sentence-cased and otherwise verbatim. Nothing is
   *  appended: titles are imperatives, questions, and shouts, and any
   *  observation glued onto one reads as broken English ("Approve the
   *  final seating plan is 2 days overdue"). */
  text: string;
  /** The observation about `text`, written with a pronoun or implicit
   *  subject so it stays grammatical under any title ("Two days past
   *  its date."). Renderers show it as the line under the headline. */
  detail: string;
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
  | "blocked-too-long"
  | "blocking-due-work"
  | "prerequisites-complete"
  | "prerequisites-unverified";

export type FocusItem = {
  id: string;
  text: string;
  due: string; // own saved-date phrase or an explicit no-confirmed-date state
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
  /** A partial read may surface known facts but cannot assert all-clear. */
  coverageStatus?: "complete" | "partial";
  /** Specific non-actionable limitation from the same authorized source read. */
  activityCoverageNote?: string;
  /** Total signals the engine examined in scope on this run, surfaced
   *  or not. The product's claim is that it filters, so a count of what
   *  it showed without a count of what it read is an assertion rather
   *  than a receipt. Threaded to the ledger as `readCount`. */
  readCount: number;
  /** How many distinct signals crossed a rule, counted BEFORE the
   *  three-per-bucket cap. Without it the ledger cannot tell "cleared"
   *  (crossed nothing) from "held back" (crossed a rule but lost its
   *  slot), and would describe held-back work as clear. */
  triggeredCount: number;
  /** Segment-aware copy when isEmpty, from Tasks primary_use_case. */
  emptyStateHeadline?: string;
  emptyStateBody?: string;
};
