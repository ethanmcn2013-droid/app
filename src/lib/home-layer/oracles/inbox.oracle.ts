/**
 * Golden oracle · Inbox badge membership and the two state axes.
 *
 * WRITTEN FROM `contracts/INBOX_EVENT.md` §8, §8.1–§8.3, §10.5 and §17 —
 * deliberately NOT from `src/lib/home-layer/fixtures/inbox.ts`'s `deriveBadge`
 * or `effectiveDisposition`, which are the derivations this oracle exists to
 * certify.
 *
 * THE SIX MEMBERSHIP CONDITIONS of §17 are transcribed one per predicate
 * below, each named after its clause number, so a badge that is right for the
 * wrong reason still fails. The contract's own sentence is the specification:
 * an event contributes 1 for recipient R if and only if ALL SIX hold, and
 * "nothing else. Not visibility. Not kind weighting. Not recency. Not an AI
 * score."
 */

import type {
  Disposition,
  InboxEventState,
  InboxKind,
  SourceVisibility,
  StoredInboxEvent,
  Visibility,
} from "../inbox/contract";

/** §3.1 — the six V1 kinds, transcribed. Condition 4 checks against this. */
export const ORACLE_INBOX_KINDS: readonly InboxKind[] = Object.freeze([
  "mention",
  "reply",
  "review-requested",
  "approval-requested",
  "handoff",
  "explicit-block",
]);

/** §8.3 — the only two reasons that may set `visibility = "read"`. */
export const ORACLE_READ_REASONS_ALLOWED = Object.freeze([
  "detail-open",
  "explicit-mark-read",
]);

/** §8 — the two axes, and every one of the eight legal cells. */
export const ORACLE_VISIBILITIES: readonly Visibility[] = Object.freeze([
  "new",
  "read",
]);
export const ORACLE_DISPOSITIONS: readonly Disposition[] = Object.freeze([
  "open",
  "snoozed",
  "acknowledged",
  "cleared",
]);

export const ORACLE_EIGHT_CELLS: readonly string[] = Object.freeze(
  ORACLE_VISIBILITIES.flatMap((visibility) =>
    ORACLE_DISPOSITIONS.map((disposition) => `${visibility}/${disposition}`),
  ).sort(),
);

/**
 * §10.5 — resurface is a READ-TIME predicate, not a job. A snoozed row whose
 * `resurfaceAt` has passed reads as `open` with the stored value untouched.
 */
export function oracleEffectiveDisposition(
  state: InboxEventState,
  nowMs: number,
): Disposition {
  if (state.disposition !== "snoozed") return state.disposition;
  if (state.snoozedUntil === null || state.snoozeZone === null) {
    // §10.2: the zone is an explicit argument, and a snooze with no resolved
    // instant is not a snooze. Refusing here rather than defaulting is the
    // point — a default would invent an answer.
    throw new Error(
      `inbox.oracle: ${state.eventId} is snoozed with no resolved resurface instant`,
    );
  }
  return state.snoozedUntil <= nowMs ? "open" : "snoozed";
}

export type OracleBadgeInput = Readonly<{
  events: readonly StoredInboxEvent[];
  states: readonly InboxEventState[];
  recipientUserId: string;
  nowMs: number;
  /** Projects the recipient holds LIVE membership of, and not archived. */
  liveProjectIds: readonly string[];
  /** Projects in the membership set that did not resolve this request. */
  unreadableProjectCount: number;
  sourceVisibilityOf: (sourceObjectId: string) => SourceVisibility;
}>;

export type OracleBadge = Readonly<{
  count: number;
  coverage: "complete" | "partial" | "unavailable";
  undeterminedCount: number;
  unreadableProjectCount: number;
  /** The event ids that contributed, for evidence rather than a bare integer. */
  memberEventIds: readonly string[];
  /** Which of the six conditions excluded each non-member. */
  excludedBy: Readonly<Record<string, string>>;
}>;

/**
 * §17, the six conditions, evaluated in the contract's own order so the
 * exclusion reason recorded for each row is the FIRST clause it failed.
 */
export function oracleBadge(input: OracleBadgeInput): OracleBadge {
  const live = new Set(input.liveProjectIds);
  const memberEventIds: string[] = [];
  const excludedBy: Record<string, string> = {};
  let undeterminedCount = 0;

  for (const state of input.states) {
    // Clause 1 — an `inbox_event_states` row exists for (event, R).
    if (state.recipientUserId !== input.recipientUserId) continue;
    const event = input.events.find((row) => row.id === state.eventId);
    if (!event) {
      excludedBy[state.eventId] = "1:no-event-for-state-row";
      continue;
    }

    // Clause 2 — the EFFECTIVE disposition is `open`.
    if (oracleEffectiveDisposition(state, input.nowMs) !== "open") {
      excludedBy[event.id] = "2:effective-disposition-not-open";
      continue;
    }

    // Clause 3 — the event is not withdrawn.
    if (event.withdrawnAt !== null) {
      excludedBy[event.id] = "3:withdrawn";
      continue;
    }

    // Clause 4 — the kind is one of the six.
    if (!ORACLE_INBOX_KINDS.includes(event.kind)) {
      excludedBy[event.id] = "4:kind-not-in-v1-six";
      continue;
    }

    // Clause 5 — live membership of the event's Project, and not archived.
    if (!live.has(event.workspaceId)) {
      excludedBy[event.id] = "5:no-live-membership";
      continue;
    }

    // Clause 6 — source visibility is `available` or `undetermined`, never
    // `unavailable`. §11.4: the three states are not interchangeable.
    const visibility = input.sourceVisibilityOf(event.sourceObjectId);
    if (visibility === "unavailable") {
      excludedBy[event.id] = "6:source-unavailable";
      continue;
    }
    if (visibility === "undetermined") undeterminedCount += 1;

    memberEventIds.push(event.id);
  }

  /**
   * §17.2 — one unresolvable Project makes the badge `partial`; it never makes
   * it `0` and never makes it disappear. `unavailable` renders NO count at
   * all, which is only honest when nothing at all could be read.
   */
  const coverage: OracleBadge["coverage"] =
    input.liveProjectIds.length === 0 && input.unreadableProjectCount > 0
      ? "unavailable"
      : undeterminedCount > 0 || input.unreadableProjectCount > 0
        ? "partial"
        : "complete";

  return Object.freeze({
    count: memberEventIds.length,
    coverage,
    undeterminedCount,
    unreadableProjectCount: input.unreadableProjectCount,
    memberEventIds: Object.freeze([...memberEventIds].sort()),
    excludedBy: Object.freeze(excludedBy),
  });
}

/**
 * §8 axis independence, proved rather than asserted: flip EVERY row's
 * visibility and the badge must not move by one. If it does, visibility is an
 * input to the badge, which is "reading resolves" — the thing §8.1 forbids.
 */
export function oracleBadgeIgnoresVisibility(input: OracleBadgeInput): boolean {
  const flipped = input.states.map((state) => ({
    ...state,
    visibility: (state.visibility === "new" ? "read" : "new") as Visibility,
    // Flipping to `read` without a reason would be an illegal row (§2.2), so
    // the pair is written together exactly as the contract requires.
    readAt: state.visibility === "new" ? input.nowMs : null,
    readReason: (state.visibility === "new" ? "detail-open" : null) as
      | "detail-open"
      | null,
  }));
  const before = oracleBadge(input);
  const after = oracleBadge({ ...input, states: flipped });
  return (
    before.count === after.count &&
    before.coverage === after.coverage &&
    before.undeterminedCount === after.undeterminedCount
  );
}

/** The occupied cells of the 2 × 4 matrix, derived from rows. */
export function oracleOccupiedCells(
  states: readonly InboxEventState[],
): readonly string[] {
  return Object.freeze(
    [...new Set(states.map((s) => `${s.visibility}/${s.disposition}`))].sort(),
  );
}

/**
 * §2.2 and §8.3 — a `read` row carries both `readAt` and an allowlisted
 * `readReason`; a `new` row carries neither. Returns the offending event ids.
 */
export function oracleIllegalReadRows(
  states: readonly InboxEventState[],
): readonly string[] {
  const bad: string[] = [];
  for (const state of states) {
    if (state.visibility === "read") {
      if (state.readAt === null || state.readReason === null) {
        bad.push(`${state.eventId}:read-without-record`);
      } else if (!ORACLE_READ_REASONS_ALLOWED.includes(state.readReason)) {
        bad.push(`${state.eventId}:read-reason-not-allowlisted`);
      }
    } else if (state.readAt !== null || state.readReason !== null) {
      bad.push(`${state.eventId}:new-with-read-record`);
    }
  }
  return Object.freeze(bad);
}

/**
 * §8.5 — every disposition change records a reason, and `arrival` is only
 * legal on `open`. A disposition with no reason is not writable.
 */
export function oracleIllegalDispositionRows(
  states: readonly InboxEventState[],
): readonly string[] {
  const bad: string[] = [];
  for (const state of states) {
    if (!state.dispositionReason) {
      bad.push(`${state.eventId}:disposition-without-reason`);
      continue;
    }
    if (state.dispositionReason === "arrival" && state.disposition !== "open") {
      bad.push(`${state.eventId}:arrival-on-${state.disposition}`);
    }
    if (state.disposition === "snoozed" && state.snoozedUntil === null) {
      bad.push(`${state.eventId}:snoozed-without-instant`);
    }
    if (state.disposition === "snoozed" && state.snoozeZone === null) {
      bad.push(`${state.eventId}:snoozed-without-zone`);
    }
  }
  return Object.freeze(bad);
}
