/**
 * InboxEvent · shared contract types and constants.
 *
 * This module is the sealed contract expressed in code. Every type and
 * constant here is derived from
 * `docs/projects/home-operating-layer/contracts/INBOX_EVENT.md` and must not
 * drift from it without a new founder-approved ADR or a lead-owned amendment
 * (see the contract's header).
 *
 * This module holds identity/state/badge SHAPE only. It has no behaviour —
 * every function that acts on these shapes lives in the sibling modules
 * (`./identity`, `./state`, `./badge`, `./snooze`, `./privacy`) and is
 * unimplemented until Wave 6.
 */

// ── §2.1 InboxEvent — sourceProduct is one of three products ───────────────

export type SourceProduct = "tasks" | "notes" | "timeline";

// ── §3.1 the six V1 kinds, in contract order ────────────────────────────────

export type InboxKind =
  | "mention"
  | "reply"
  | "review-requested"
  | "approval-requested"
  | "handoff"
  | "explicit-block";

/** D-INBOX-01 / §3.1. Closed union, in the order §18/§19 assert on. */
export const INBOX_KINDS: readonly InboxKind[] = [
  "mention",
  "reply",
  "review-requested",
  "approval-requested",
  "handoff",
  "explicit-block",
] as const;

// ── §8 the two independent axes ─────────────────────────────────────────────

/** D-INBOX-08. `new -> read` only (§8.2) — there is no "mark unread". */
export type Visibility = "new" | "read";

/** D-INBOX-08. All eight (visibility, disposition) cells are legal. */
export type Disposition = "open" | "snoozed" | "acknowledged" | "cleared";

/** §2.2 / §8.5. Every disposition change records who moved it. */
export type DispositionReason =
  | "arrival"
  | "user"
  | "source-receipt"
  | "reconciliation";

// ── §8.3 the read-reason allowlist — never a denylist ───────────────────────

export type ReadReasonAllowed = "detail-open" | "explicit-mark-read";

/** D-INBOX-09. Only these two reasons may set `visibility = "read"`. */
export const READ_REASONS_ALLOWED: readonly ReadReasonAllowed[] = [
  "detail-open",
  "explicit-mark-read",
] as const;

export type ReadReasonRefused =
  | "hover"
  | "prefetch"
  | "viewport"
  | "list-render"
  | "auto-select"
  | "keyboard-roving-focus"
  | "bulk-select"
  | "group-expand"
  | "badge-open"
  | "route-visit";

/** §8.3. Named by name, so a caller cannot claim it did not know. */
export const READ_REASONS_REFUSED: readonly ReadReasonRefused[] = [
  "hover",
  "prefetch",
  "viewport",
  "list-render",
  "auto-select",
  "keyboard-roving-focus",
  "bulk-select",
  "group-expand",
  "badge-open",
  "route-visit",
] as const;

// ── §11.4 source visibility — three states, not interchangeable ────────────

export type SourceVisibility = "available" | "unavailable" | "undetermined";

// ── §9.2 source-action attempt outcomes ─────────────────────────────────────

export type SourceActionOutcome =
  | "pending"
  | "committed"
  | "refused"
  | "undetermined";

// ── §2.1 InboxEvent — the durable event record, one row per source event ───

export interface InboxEvent {
  /** Home's own key. Never derived from, nor equal to, any source id. */
  id: string;
  sourceProduct: SourceProduct;
  /** The dedup key (§4). Opaque to Home. */
  sourceEventId: string;
  kind: InboxKind;
  /** The canonical Project — Tasks `workspaces.id`. Not nullable (§6 rule 1). */
  workspaceId: string;
  /** `null` = system-originated. */
  actorUserId: string | null;
  sourceObjectType: string;
  sourceObjectId: string;
  /** The source's own version at the moment of emission (§12). */
  sourceRevisionAtEmit: string;
  /** Grouping (§5). */
  threadKey: string;
  /** Which ask this belongs to (§4.3). */
  episodeKey: string;
  /** The SOURCE event time, never the insert time (§7). */
  occurredAt: number;
  /** When Home wrote the row. Differs from `occurredAt` on a retried delivery. */
  recordedAt: number;
}

/**
 * §14 schema sketch adds two fields the object model (§2.1) does not name:
 * `withdrawn_at` (§11.5 withdrawal) and `emitter_version`. The stored record
 * is the object model plus these two — this is the exact field list §19's
 * `privacy.test.ts` (I17) checks the store against.
 */
export interface StoredInboxEvent extends InboxEvent {
  withdrawnAt: number | null;
  emitterVersion: number;
}

/** The exact field list of a storable `InboxEvent` row (§2.1, §14). */
export const STORED_EVENT_FIELDS: readonly (keyof StoredInboxEvent)[] = [
  "id",
  "sourceProduct",
  "sourceEventId",
  "kind",
  "workspaceId",
  "actorUserId",
  "sourceObjectType",
  "sourceObjectId",
  "sourceRevisionAtEmit",
  "threadKey",
  "episodeKey",
  "occurredAt",
  "recordedAt",
  "withdrawnAt",
  "emitterVersion",
] as const;

// ── §2.2 InboxEventState — one row per (event, recipient), personal ────────

export interface InboxEventState {
  eventId: string;
  recipientUserId: string;
  visibility: Visibility;
  disposition: Disposition;
  /** Written together with `readReason`, or not at all (§2.2). */
  readAt: number | null;
  readReason: ReadReasonAllowed | null;
  dispositionAt: number;
  dispositionReason: DispositionReason;
  /** The resolved UTC instant (§10). */
  snoozedUntil: number | null;
  /** The IANA zone used to resolve `snoozedUntil` (§10.2). */
  snoozeZone: string | null;
  /** Set only when `disposition = "acknowledged"` and the cause was a receipt. */
  resolvingAttemptId: string | null;
}

// ── §9.1 the receipt a durable source action must carry ────────────────────

export interface InboxSourceActionAttempt {
  attemptId: string;
  eventId: string;
  recipientUserId: string;
  action: string;
  idempotencyKey: string;
  sourceProduct: SourceProduct;
  sourceObjectRef: string;
  outcome: SourceActionOutcome;
  refusalCode: string | null;
  /** Present iff `outcome = "committed"` (§9.1). */
  sourceRevisionAfter: string | null;
  settledAt: number | null;
}

// ── §17.2 the badge count is never a bare integer ───────────────────────────

export interface BadgeCount {
  count: number;
  coverage: "complete" | "partial" | "unavailable";
  /** Sources that could not be verified this request (§11.4). */
  undeterminedCount: number;
  /** Projects in the membership set that did not resolve (§17.2). */
  unreadableProjectCount: number;
}

export interface BadgeDisplay {
  /** `null` when coverage is `"unavailable"` — zero is a claim (§17.2). */
  glyph: string | null;
  /** Carries the exact integer even when the glyph truncates at `99+`. */
  accessibleName: string;
}
