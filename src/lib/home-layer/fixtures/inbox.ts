/**
 * Home fixture universe · Inbox events, states, receipts and the badge.
 *
 * THE TWO AXES ARE THE POINT. `INBOX_EVENT.md` §8 makes visibility
 * (`new | read`) and disposition (`open | snoozed | acknowledged | cleared`)
 * INDEPENDENT, and all eight cells legal. Reading never resolves. So this
 * universe carries all eight cells explicitly — a fixture that only ever
 * pairs `new` with `open` and `read` with `cleared` would let a surface
 * collapse the two axes into one and still look correct.
 *
 * WHAT THE ROWS DO NOT CARRY. D-INBOX-14: store identifiers and state, never
 * copied source content. No title, no snippet, no display name, no email, no
 * avatar URL appears on any event row below. Display is hydrated live, after
 * authorization, on every request — which is why the display projection is a
 * SEPARATE table here, keyed by source object and by recipient, and why two
 * recipients of one event can legitimately get different answers from it.
 */

import type {
  BadgeCount,
  BadgeDisplay,
  Disposition,
  InboxEventState,
  InboxKind,
  InboxSourceActionAttempt,
  SourceProduct,
  SourceVisibility,
  StoredInboxEvent,
  Visibility,
} from "../inbox/contract";
import { STORED_EVENT_FIELDS } from "../inbox/contract";
import { HOME_FIXTURE_DST, HOME_FIXTURE_NOW, HOME_FIXTURE_TIME_ZONE } from "./clock";
import { HOME_FIXTURE_PROJECT_IDS } from "./projects";

const MF = HOME_FIXTURE_PROJECT_IDS.maraFinn;
const NC = HOME_FIXTURE_PROJECT_IDS.noraCian;
const AT = HOME_FIXTURE_PROJECT_IDS.aislingTom;
const SR = HOME_FIXTURE_PROJECT_IDS.sineadRuairi;

const ACTOR = "truth-user";
const EABHA = "collab-user-eabha";
const NIAMH = "collab-user-niamh";

const ms = (iso: string) => Date.parse(iso);

// ── Events ──────────────────────────────────────────────────────────────────

function event(
  id: string,
  fields: Omit<StoredInboxEvent, "id" | "emitterVersion"> &
    Partial<Pick<StoredInboxEvent, "emitterVersion">>,
): StoredInboxEvent {
  return Object.freeze({ id, emitterVersion: 1, ...fields });
}

/**
 * `threadKey` groups; `episodeKey` says which ASK a row belongs to. Two rows
 * in one thread under two episodes are two asks and never merge. Grouping
 * never merges state (§4.4) — every grouped row keeps its own
 * `InboxEventState`.
 */
export const HOME_INBOX_EVENTS: readonly StoredInboxEvent[] = Object.freeze([
  event("home-evt-01", {
    sourceProduct: "tasks",
    sourceEventId: "comment:home-cmt-0001",
    kind: "mention",
    workspaceId: MF,
    actorUserId: EABHA,
    sourceObjectType: "comment",
    sourceObjectId: "home-cmt-0001",
    sourceRevisionAtEmit: "rev-mf-0091",
    threadKey: "tasks:task:home-task-mf-kitchen-numbers",
    episodeKey: "tasks:task:home-task-mf-kitchen-numbers:mention:1",
    occurredAt: ms("2026-07-16T06:02:00.000Z"),
    recordedAt: ms("2026-07-16T06:02:01.000Z"),
    withdrawnAt: null,
  }),
  event("home-evt-02", {
    // Same thread as 01. A different ask, so a different episode.
    sourceProduct: "tasks",
    sourceEventId: "comment:home-cmt-0002",
    kind: "reply",
    workspaceId: MF,
    actorUserId: NIAMH,
    sourceObjectType: "comment",
    sourceObjectId: "home-cmt-0002",
    sourceRevisionAtEmit: "rev-mf-0092",
    threadKey: "tasks:task:home-task-mf-kitchen-numbers",
    episodeKey: "tasks:task:home-task-mf-kitchen-numbers:reply:1",
    occurredAt: ms("2026-07-16T06:41:00.000Z"),
    recordedAt: ms("2026-07-16T06:41:02.000Z"),
    withdrawnAt: null,
  }),
  event("home-evt-03", {
    sourceProduct: "tasks",
    sourceEventId: "comment:home-cmt-0003",
    kind: "reply",
    workspaceId: MF,
    actorUserId: EABHA,
    sourceObjectType: "comment",
    sourceObjectId: "home-cmt-0003",
    sourceRevisionAtEmit: "rev-mf-0093",
    threadKey: "tasks:task:home-task-mf-seating-plan",
    episodeKey: "tasks:task:home-task-mf-seating-plan:reply:1",
    occurredAt: ms("2026-07-15T16:20:00.000Z"),
    recordedAt: ms("2026-07-15T16:20:01.000Z"),
    withdrawnAt: null,
  }),
  event("home-evt-04", {
    sourceProduct: "tasks",
    sourceEventId: "comment:home-cmt-0004",
    kind: "reply",
    workspaceId: NC,
    actorUserId: NIAMH,
    sourceObjectType: "comment",
    sourceObjectId: "home-cmt-0004",
    sourceRevisionAtEmit: "rev-nc-0044",
    threadKey: "tasks:task:home-task-nc-musicians",
    episodeKey: "tasks:task:home-task-nc-musicians:reply:1",
    occurredAt: ms("2026-07-14T11:05:00.000Z"),
    recordedAt: ms("2026-07-14T11:05:01.000Z"),
    withdrawnAt: null,
  }),
  event("home-evt-05", {
    sourceProduct: "timeline",
    sourceEventId: "review:home-rev-0005",
    kind: "review-requested",
    workspaceId: NC,
    actorUserId: EABHA,
    sourceObjectType: "milestone",
    sourceObjectId: "home-ms-nc-running-order",
    sourceRevisionAtEmit: "rev-nc-0045",
    threadKey: "timeline:milestone:home-ms-nc-running-order",
    episodeKey: "timeline:milestone:home-ms-nc-running-order:review:1",
    occurredAt: ms("2026-07-13T09:30:00.000Z"),
    recordedAt: ms("2026-07-13T09:30:01.000Z"),
    withdrawnAt: null,
  }),
  event("home-evt-06", {
    sourceProduct: "tasks",
    sourceEventId: "review:home-rev-0006",
    kind: "review-requested",
    workspaceId: AT,
    actorUserId: NIAMH,
    sourceObjectType: "task",
    sourceObjectId: "home-task-at-running-order",
    sourceRevisionAtEmit: "rev-at-0018",
    threadKey: "tasks:task:home-task-at-running-order",
    episodeKey: "tasks:task:home-task-at-running-order:review:1",
    occurredAt: ms("2026-07-12T14:12:00.000Z"),
    recordedAt: ms("2026-07-12T14:12:01.000Z"),
    withdrawnAt: null,
  }),
  event("home-evt-07", {
    sourceProduct: "tasks",
    sourceEventId: "approval:home-apr-0007",
    kind: "approval-requested",
    workspaceId: AT,
    actorUserId: EABHA,
    sourceObjectType: "task",
    sourceObjectId: "home-task-at-florist-quote",
    sourceRevisionAtEmit: "rev-at-0019",
    threadKey: "tasks:task:home-task-at-florist-quote",
    episodeKey: "tasks:task:home-task-at-florist-quote:approval:1",
    occurredAt: ms("2026-07-11T10:00:00.000Z"),
    recordedAt: ms("2026-07-11T10:00:01.000Z"),
    withdrawnAt: null,
  }),
  event("home-evt-08", {
    sourceProduct: "tasks",
    sourceEventId: "handoff:home-hnd-0008",
    kind: "handoff",
    workspaceId: MF,
    actorUserId: NIAMH,
    sourceObjectType: "task",
    sourceObjectId: "home-task-mf-transport",
    sourceRevisionAtEmit: "rev-mf-0094",
    threadKey: "tasks:task:home-task-mf-transport",
    episodeKey: "tasks:task:home-task-mf-transport:handoff:1",
    occurredAt: ms("2026-07-10T08:45:00.000Z"),
    recordedAt: ms("2026-07-10T08:45:01.000Z"),
    withdrawnAt: null,
  }),
  event("home-evt-09", {
    // Its source could not be reached this request. `undetermined` is named
    // as undetermined — not as gone, and not as empty.
    sourceProduct: "tasks",
    sourceEventId: "block:home-blk-0009",
    kind: "explicit-block",
    workspaceId: NC,
    actorUserId: EABHA,
    sourceObjectType: "task",
    sourceObjectId: "home-task-nc-marquee-lighting",
    sourceRevisionAtEmit: "rev-nc-0046",
    threadKey: "tasks:task:home-task-nc-marquee-lighting",
    episodeKey: "tasks:task:home-task-nc-marquee-lighting:block:1",
    occurredAt: ms("2026-07-09T15:30:00.000Z"),
    recordedAt: ms("2026-07-09T15:30:01.000Z"),
    withdrawnAt: null,
  }),
  event("home-evt-10", {
    // Membership revoked between list and detail. The row SURVIVES; the badge
    // drops it; no content renders. Deleting it would destroy the audit of
    // what was asked.
    sourceProduct: "tasks",
    sourceEventId: "comment:home-cmt-0010",
    kind: "mention",
    workspaceId: SR,
    actorUserId: EABHA,
    sourceObjectType: "comment",
    sourceObjectId: "home-cmt-0010",
    sourceRevisionAtEmit: "rev-sr-0021",
    threadKey: "tasks:task:home-task-sr-cars",
    episodeKey: "tasks:task:home-task-sr-cars:mention:1",
    occurredAt: ms("2026-07-08T12:00:00.000Z"),
    recordedAt: ms("2026-07-08T12:00:01.000Z"),
    withdrawnAt: null,
  }),
  event("home-evt-11", {
    // The ask was withdrawn at source. Withdrawal is not deletion and is not
    // `cleared` — `cleared` is the recipient's word.
    sourceProduct: "tasks",
    sourceEventId: "handoff:home-hnd-0011",
    kind: "handoff",
    workspaceId: MF,
    actorUserId: EABHA,
    sourceObjectType: "task",
    sourceObjectId: "home-task-mf-guest-book",
    sourceRevisionAtEmit: "rev-mf-0095",
    threadKey: "tasks:task:home-task-mf-guest-book",
    episodeKey: "tasks:task:home-task-mf-guest-book:handoff:1",
    occurredAt: ms("2026-07-07T09:00:00.000Z"),
    recordedAt: ms("2026-07-07T09:00:01.000Z"),
    withdrawnAt: ms("2026-07-15T13:10:00.000Z"),
  }),
  event("home-evt-13", {
    // A second Sinéad & Ruairí event. The guest seat needs a real inbox, not
    // a one-row one whose single row happens to be unavailable — a badge of
    // zero derived from a thin fixture is the same lie as a badge of zero
    // derived from a broken read.
    sourceProduct: "tasks",
    sourceEventId: "review:home-rev-0013",
    kind: "review-requested",
    workspaceId: SR,
    actorUserId: NIAMH,
    sourceObjectType: "task",
    sourceObjectId: "home-task-sr-cars",
    sourceRevisionAtEmit: "rev-sr-0022",
    threadKey: "tasks:task:home-task-sr-cars",
    episodeKey: "tasks:task:home-task-sr-cars:review:1",
    occurredAt: ms("2026-07-15T11:00:00.000Z"),
    recordedAt: ms("2026-07-15T11:00:01.000Z"),
    withdrawnAt: null,
  }),
  event("home-evt-14", {
    sourceProduct: "tasks",
    sourceEventId: "handoff:home-hnd-0014",
    kind: "handoff",
    workspaceId: SR,
    actorUserId: EABHA,
    sourceObjectType: "task",
    sourceObjectId: "home-task-sr-flowers",
    sourceRevisionAtEmit: "rev-sr-0023",
    threadKey: "tasks:task:home-task-sr-flowers",
    episodeKey: "tasks:task:home-task-sr-flowers:handoff:1",
    occurredAt: ms("2026-07-14T15:30:00.000Z"),
    recordedAt: ms("2026-07-14T15:30:01.000Z"),
    withdrawnAt: null,
  }),
  event("home-evt-12", {
    // The `action_failure` target. Its source mutation is refused.
    sourceProduct: "tasks",
    sourceEventId: "approval:home-apr-0012",
    kind: "approval-requested",
    workspaceId: MF,
    actorUserId: NIAMH,
    sourceObjectType: "task",
    sourceObjectId: "home-task-mf-final-invoice",
    sourceRevisionAtEmit: "rev-mf-0096",
    threadKey: "tasks:task:home-task-mf-final-invoice",
    episodeKey: "tasks:task:home-task-mf-final-invoice:approval:1",
    occurredAt: ms("2026-07-16T05:15:00.000Z"),
    recordedAt: ms("2026-07-16T05:15:01.000Z"),
    withdrawnAt: null,
  }),
]);

// ── States: all eight (visibility, disposition) cells ───────────────────────

function state(
  eventId: string,
  visibility: Visibility,
  disposition: Disposition,
  fields: Partial<InboxEventState> = {},
): InboxEventState {
  return Object.freeze({
    eventId,
    recipientUserId: ACTOR,
    visibility,
    disposition,
    readAt: visibility === "read" ? (fields.readAt ?? ms("2026-07-16T06:50:00.000Z")) : null,
    readReason: visibility === "read" ? (fields.readReason ?? "detail-open") : null,
    dispositionAt: fields.dispositionAt ?? ms("2026-07-16T06:00:00.000Z"),
    dispositionReason: fields.dispositionReason ?? "arrival",
    snoozedUntil: fields.snoozedUntil ?? null,
    snoozeZone: fields.snoozeZone ?? null,
    resolvingAttemptId: fields.resolvingAttemptId ?? null,
  });
}

/**
 * Every cell of the 2 × 4 matrix appears at least once. `EIGHT_CELLS` below
 * is derived from these rows, so the coverage claim is checked rather than
 * asserted.
 */
export const HOME_INBOX_STATES: readonly InboxEventState[] = Object.freeze([
  state("home-evt-01", "new", "open"),
  state("home-evt-02", "read", "open"),
  state("home-evt-03", "new", "snoozed", {
    // Snoozed to this evening. Still snoozed at the pinned `asOf`.
    snoozedUntil: ms("2026-07-16T17:00:00.000Z"),
    snoozeZone: HOME_FIXTURE_TIME_ZONE,
    dispositionReason: "user",
    dispositionAt: ms("2026-07-15T16:25:00.000Z"),
  }),
  state("home-evt-04", "read", "snoozed", {
    // Snoozed to yesterday morning. Already resurfaced: it reads as OPEN
    // without any job having run, and the stored disposition is unchanged.
    snoozedUntil: ms("2026-07-15T08:00:00.000Z"),
    snoozeZone: HOME_FIXTURE_TIME_ZONE,
    dispositionReason: "user",
    dispositionAt: ms("2026-07-14T11:30:00.000Z"),
  }),
  state("home-evt-05", "new", "acknowledged", {
    // Acknowledged by a COMMITTED source receipt, never optimistically.
    dispositionReason: "source-receipt",
    dispositionAt: ms("2026-07-13T10:02:00.000Z"),
    resolvingAttemptId: "home-att-0005",
  }),
  state("home-evt-06", "read", "acknowledged", {
    dispositionReason: "reconciliation",
    dispositionAt: ms("2026-07-14T07:00:00.000Z"),
    readAt: ms("2026-07-12T14:40:00.000Z"),
    readReason: "explicit-mark-read",
  }),
  state("home-evt-07", "new", "cleared", {
    // Cleared is personal and touches no source work: the approval is still
    // outstanding at source. `new` + `cleared` is the cell that proves the
    // two axes are genuinely independent.
    dispositionReason: "user",
    dispositionAt: ms("2026-07-11T18:00:00.000Z"),
  }),
  state("home-evt-08", "read", "cleared", {
    dispositionReason: "user",
    dispositionAt: ms("2026-07-10T09:15:00.000Z"),
    readAt: ms("2026-07-10T09:14:00.000Z"),
  }),
  state("home-evt-09", "new", "open"),
  state("home-evt-10", "new", "open"),
  state("home-evt-11", "new", "open"),
  state("home-evt-12", "new", "open"),
  state("home-evt-13", "read", "open"),
  state("home-evt-14", "new", "open"),
]);

// ── Display, hydrated live and stored nowhere ───────────────────────────────

export type InboxDisplayProjection = Readonly<{
  sourceObjectId: string;
  /** What the SOURCE returns for this actor on this request. */
  title: string;
  actorName: string;
  /** The live revision, compared against `sourceRevisionAtEmit` (§12). */
  liveRevision: string;
  visibility: SourceVisibility;
}>;

/**
 * The live projection. Not a store: a fixture stand-in for step 2 of §11.3,
 * "ask the source for the minimum display projection for that object, as that
 * actor, now". An entry absent here is `undetermined`, not empty.
 */
export const HOME_INBOX_DISPLAY: readonly InboxDisplayProjection[] =
  Object.freeze([
    display("home-cmt-0001", "Confirm final numbers with the Orchard kitchen", "Éabha", "rev-mf-0091"),
    display("home-cmt-0002", "Confirm final numbers with the Orchard kitchen", "Niamh", "rev-mf-0099"),
    display("home-cmt-0003", "Send the Orchard seating plan to the venue", "Éabha", "rev-mf-0093"),
    display("home-cmt-0004", "Book the Ballyhoura ceremony musicians", "Niamh", "rev-nc-0044"),
    display("home-ms-nc-running-order", "Ballyhoura running order", "Éabha", "rev-nc-0045"),
    display("home-task-at-running-order", "Draft the Adare running order", "Niamh", "rev-at-0018"),
    display("home-task-at-florist-quote", "Chase the Adare florist for a written quote", "Éabha", "rev-at-0019"),
    display("home-task-mf-transport", "Hold the Orchard shuttle for the late guests", "Niamh", "rev-mf-0094"),
    // The source could not be reached. NOT gone, NOT empty.
    Object.freeze({
      sourceObjectId: "home-task-nc-marquee-lighting",
      title: "",
      actorName: "",
      liveRevision: "",
      visibility: "undetermined" as const,
    }),
    // Membership revoked. A definitive negative, with NO stale content.
    Object.freeze({
      sourceObjectId: "home-cmt-0010",
      title: "",
      actorName: "",
      liveRevision: "",
      visibility: "unavailable" as const,
    }),
    display("home-task-mf-guest-book", "Choose the Orchard guest book", "Éabha", "rev-mf-0095"),
    display("home-task-mf-final-invoice", "Review the Orchard final invoice", "Niamh", "rev-mf-0096"),
    display("home-task-sr-cars", "Check the Dromoland car list", "Niamh", "rev-sr-0022"),
    display("home-task-sr-flowers", "Confirm the Dromoland flowers", "Éabha", "rev-sr-0023"),
  ]);

/**
 * SOURCE VISIBILITY IS PER ACTOR, and this is the fixture that proves it.
 * `home-cmt-0010` is `unavailable` to the owner in `permission_changed`
 * because the owner's membership was revoked. It is `available` to the guest,
 * who is still a member. §11.3: "two recipients of the same event may
 * legitimately get different display availability, and neither one's result
 * may be used to render the other's row."
 */
export const HOME_INBOX_GUEST_DISPLAY: readonly InboxDisplayProjection[] =
  Object.freeze([
    display("home-cmt-0010", "Agree the Dromoland car list", "Éabha", "rev-sr-0021"),
    display("home-task-sr-cars", "Check the Dromoland car list", "Niamh", "rev-sr-0022"),
    // Deliberately absent: `home-task-sr-flowers`. The guest's read of that
    // source did not come back, so the guest's badge carries a real
    // undetermined count and a real disclosure.
  ]);

function display(
  sourceObjectId: string,
  title: string,
  actorName: string,
  liveRevision: string,
): InboxDisplayProjection {
  return Object.freeze({
    sourceObjectId,
    title,
    actorName,
    liveRevision,
    visibility: "available",
  });
}

export function sourceVisibilityFor(sourceObjectId: string): SourceVisibility {
  return (
    HOME_INBOX_DISPLAY.find((row) => row.sourceObjectId === sourceObjectId)
      ?.visibility ?? "undetermined"
  );
}

// ── Source-action attempts, receipts and the failure ────────────────────────

/**
 * §9. Nothing is optimistic in the STORE. A disposition moves only on a
 * settled receipt: `committed` carries `sourceRevisionAfter`, `refused`
 * carries `refusalCode`, and `undetermined` is a third outcome that is NOT a
 * failure and must not be rendered as one.
 */
export const HOME_INBOX_ATTEMPTS: readonly InboxSourceActionAttempt[] =
  Object.freeze([
    Object.freeze({
      attemptId: "home-att-0005",
      eventId: "home-evt-05",
      recipientUserId: ACTOR,
      action: "approve-review",
      idempotencyKey: "home-idem-0005",
      sourceProduct: "timeline" as SourceProduct,
      sourceObjectRef: "timeline:milestone:home-ms-nc-running-order",
      outcome: "committed" as const,
      refusalCode: null,
      sourceRevisionAfter: "rev-nc-0047",
      settledAt: ms("2026-07-13T10:02:00.000Z"),
    }),
    Object.freeze({
      // `action_failure`. The source refused; the event STAYS open; the UI
      // rolls back visibly and offers recovery. Never a success toast.
      attemptId: "home-att-0012",
      eventId: "home-evt-12",
      recipientUserId: ACTOR,
      action: "approve-invoice",
      idempotencyKey: "home-idem-0012",
      sourceProduct: "tasks" as SourceProduct,
      sourceObjectRef: "tasks:task:home-task-mf-final-invoice",
      outcome: "refused" as const,
      refusalCode: "source_revision_moved",
      sourceRevisionAfter: null,
      settledAt: ms("2026-07-16T07:31:00.000Z"),
    }),
    Object.freeze({
      // The third outcome. The write may or may not have landed. Rendering
      // this as either success or failure is the defect.
      attemptId: "home-att-0009",
      eventId: "home-evt-09",
      recipientUserId: ACTOR,
      action: "unblock",
      idempotencyKey: "home-idem-0009",
      sourceProduct: "tasks" as SourceProduct,
      sourceObjectRef: "tasks:task:home-task-nc-marquee-lighting",
      outcome: "undetermined" as const,
      refusalCode: null,
      sourceRevisionAfter: null,
      settledAt: null,
    }),
  ]);

// ── Snooze ──────────────────────────────────────────────────────────────────

export type SnoozeCase = Readonly<{
  id: string;
  target: "later-today" | "tomorrow-morning" | "next-week" | "custom-datetime";
  /** The instant the snooze is taken from. */
  fromIso: string;
  timeZone: string;
  /** The resolved UTC instant it must produce. */
  expectedResurfaceIso: string;
  /** Which DST rule fired, if any. */
  adjustment: "none" | "forward-from-gap" | "earlier-of-ambiguous";
  why: string;
}>;

/**
 * §10.3. The zone is an explicit argument; there is no ambient default. Both
 * irregular days are exercised, and both expectations were MEASURED with
 * `Intl.DateTimeFormat` rather than reasoned about.
 */
export const HOME_INBOX_SNOOZE_CASES: readonly SnoozeCase[] = Object.freeze([
  Object.freeze({
    id: "snooze-later-today",
    target: "later-today" as const,
    fromIso: "2026-07-16T07:40:00.000Z",
    timeZone: HOME_FIXTURE_TIME_ZONE,
    // 18:00 local on an ordinary BST day.
    expectedResurfaceIso: "2026-07-16T17:00:00.000Z",
    adjustment: "none" as const,
    why: "An ordinary day. 18:00 in Europe/London is 17:00Z during British Summer Time.",
  }),
  Object.freeze({
    id: "snooze-ambiguous-autumn",
    target: "custom-datetime" as const,
    fromIso: "2026-10-24T20:15:00.000Z",
    timeZone: HOME_FIXTURE_TIME_ZONE,
    // 01:30 local happens twice on 25 October. The EARLIER one wins.
    expectedResurfaceIso: HOME_FIXTURE_DST.autumn.earlierInstantIso,
    adjustment: "earlier-of-ambiguous" as const,
    why: "The clocks go back at 02:00. 01:30 exists twice; the contract takes the first.",
  }),
  Object.freeze({
    id: "snooze-gap-spring",
    target: "custom-datetime" as const,
    fromIso: "2027-03-27T20:15:00.000Z",
    timeZone: HOME_FIXTURE_TIME_ZONE,
    // 01:30 local does not exist on 28 March. Resolve FORWARD.
    expectedResurfaceIso: HOME_FIXTURE_DST.spring.forwardInstantIso,
    adjustment: "forward-from-gap" as const,
    why: "The clocks go forward at 01:00. 01:30 never happens; the contract moves to the first real instant.",
  }),
]);

// ── Derivations ─────────────────────────────────────────────────────────────

/** §10.5 — a READ-TIME predicate, not a job. The stored value never changes. */
export function effectiveDisposition(
  state: InboxEventState,
  now: number,
): Disposition {
  if (state.disposition !== "snoozed") return state.disposition;
  if (state.snoozedUntil === null || state.snoozeZone === null) {
    throw new Error(
      `home-fixtures/inbox: ${state.eventId} is snoozed with no resurface instant, which is not a snooze`,
    );
  }
  return state.snoozedUntil <= now ? "open" : "snoozed";
}

export type BadgeInput = Readonly<{
  events: readonly StoredInboxEvent[];
  states: readonly InboxEventState[];
  /** Whose badge this is. State rows are personal, never shared. */
  recipientUserId: string;
  now: number;
  /** Projects the recipient holds LIVE membership of, and not archived. */
  liveProjectIds: readonly string[];
  /** Projects in the membership set that did not resolve this request. */
  unreadableProjectCount: number;
  visibilityOf: (sourceObjectId: string) => SourceVisibility;
}>;

/**
 * §17. The badge counts `open`, not `new`. Visibility is not an input — if
 * the badge counted unread items, reading would empty it, which is exactly
 * "reading resolves", the thing §8.1 forbids.
 */
export function deriveBadge(input: BadgeInput): BadgeCount {
  const live = new Set(input.liveProjectIds);
  let count = 0;
  let undeterminedCount = 0;

  for (const state of input.states) {
    if (state.recipientUserId !== input.recipientUserId) continue;
    const event = input.events.find((row) => row.id === state.eventId);
    if (!event) continue;
    if (event.withdrawnAt !== null) continue;
    if (!live.has(event.workspaceId)) continue;
    if (effectiveDisposition(state, input.now) !== "open") continue;
    const visibility = input.visibilityOf(event.sourceObjectId);
    if (visibility === "unavailable") continue;
    if (visibility === "undetermined") undeterminedCount += 1;
    count += 1;
  }

  const coverage: BadgeCount["coverage"] =
    input.liveProjectIds.length === 0 && input.unreadableProjectCount > 0
      ? "unavailable"
      : undeterminedCount > 0 || input.unreadableProjectCount > 0
        ? "partial"
        : "complete";

  return Object.freeze({
    count,
    coverage,
    undeterminedCount,
    unreadableProjectCount: input.unreadableProjectCount,
  });
}

/**
 * §17.2. `unavailable` renders NO count at all — not `0`, because zero is a
 * claim. Above 99 the glyph may truncate; the accessible name never does.
 */
export function badgeDisplay(badge: BadgeCount): BadgeDisplay {
  if (badge.coverage === "unavailable") {
    return Object.freeze({
      glyph: null,
      accessibleName: "Inbox. The count could not be read.",
    });
  }
  const glyph = badge.count > 99 ? "99+" : String(badge.count);
  const base = `Inbox. ${badge.count} open.`;
  const disclosure =
    badge.coverage === "partial"
      ? ` ${badge.undeterminedCount} could not be verified. ${badge.unreadableProjectCount} projects could not be read.`
      : "";
  return Object.freeze({ glyph, accessibleName: `${base}${disclosure}` });
}

/** The 2 × 4 matrix, derived from the rows rather than claimed. */
export function occupiedStateCells(
  states: readonly InboxEventState[],
): readonly string[] {
  return Object.freeze(
    [...new Set(states.map((s) => `${s.visibility}/${s.disposition}`))].sort(),
  );
}

export const ALL_STATE_CELLS: readonly string[] = Object.freeze(
  (["new", "read"] as Visibility[])
    .flatMap((visibility) =>
      (["open", "snoozed", "acknowledged", "cleared"] as Disposition[]).map(
        (disposition) => `${visibility}/${disposition}`,
      ),
    )
    .sort(),
);

/**
 * D-INBOX-14, asserted structurally. A stored row may carry exactly the
 * fields `STORED_EVENT_FIELDS` names and nothing else — no title, no snippet,
 * no display name.
 */
export function assertNoContentOnRows(
  events: readonly StoredInboxEvent[],
): void {
  const allowed = new Set<string>(STORED_EVENT_FIELDS as readonly string[]);
  for (const event of events) {
    for (const key of Object.keys(event)) {
      if (!allowed.has(key)) {
        throw new Error(
          `home-fixtures/inbox: ${event.id} carries the non-contract field "${key}". D-INBOX-14 stores identifiers and state only.`,
        );
      }
    }
  }
}

// ── Scale ───────────────────────────────────────────────────────────────────

const SCALE_KINDS: readonly InboxKind[] = [
  "mention",
  "reply",
  "review-requested",
  "approval-requested",
  "handoff",
  "explicit-block",
];
const SCALE_PROJECTS = [MF, NC, AT, SR] as const;

/**
 * Fifty events across ten threads, so the `scale` scenario exercises real
 * grouping and stable pagination rather than a flat list of fifty rows.
 * Generated by index, never by `Math.random()`: the same fifty rows, in the
 * same order, on every machine.
 */
export const HOME_INBOX_SCALE_EVENTS: readonly StoredInboxEvent[] =
  Object.freeze(
    Array.from({ length: 50 }, (_, index) => {
      const thread = index % 10;
      const project = SCALE_PROJECTS[thread % SCALE_PROJECTS.length];
      const key = String(index + 1).padStart(4, "0");
      const base = ms("2026-07-01T09:00:00.000Z") + index * 3_600_000;
      return event(`home-evt-scale-${key}`, {
        sourceProduct: "tasks" as SourceProduct,
        sourceEventId: `comment:home-scale-cmt-${key}`,
        kind: SCALE_KINDS[index % SCALE_KINDS.length],
        workspaceId: project,
        actorUserId: index % 3 === 0 ? EABHA : NIAMH,
        sourceObjectType: "comment",
        sourceObjectId: `home-scale-cmt-${key}`,
        sourceRevisionAtEmit: `rev-scale-${key}`,
        threadKey: `tasks:task:home-scale-task-${thread}`,
        episodeKey: `tasks:task:home-scale-task-${thread}:${SCALE_KINDS[index % SCALE_KINDS.length]}:${Math.floor(index / 10) + 1}`,
        occurredAt: base,
        recordedAt: base + 1_000,
        withdrawnAt: null,
      });
    }),
  );

export const HOME_INBOX_SCALE_STATES: readonly InboxEventState[] =
  Object.freeze(
    HOME_INBOX_SCALE_EVENTS.map((row, index) =>
      state(
        row.id,
        index % 3 === 0 ? "read" : "new",
        index % 7 === 0 ? "cleared" : "open",
        { dispositionAt: row.recordedAt },
      ),
    ),
  );

/**
 * Display projections for the scale set. Without these every scale row would
 * resolve `undetermined` and the badge would read `partial` for fifty rows —
 * a true statement about the fixture and a false one about the scenario.
 * Two rows are left out deliberately, so `scale` still carries a real, small
 * undetermined count rather than a suspiciously clean one.
 */
export const HOME_INBOX_SCALE_DISPLAY: readonly InboxDisplayProjection[] =
  Object.freeze(
    HOME_INBOX_SCALE_EVENTS.slice(0, 48).map((row, index) =>
      display(
        row.sourceObjectId,
        `Scale thread ${row.threadKey.slice(-1)}, message ${index + 1}`,
        index % 3 === 0 ? "Éabha" : "Niamh",
        row.sourceRevisionAtEmit,
      ),
    ),
  );

/**
 * One resolver per world. An id the world does not carry is `undetermined` —
 * "the source could not be reached" — never `available` and never absent.
 */
export function visibilityResolver(
  projections: readonly InboxDisplayProjection[],
): (sourceObjectId: string) => SourceVisibility {
  const index = new Map(
    projections.map((row) => [row.sourceObjectId, row.visibility] as const),
  );
  return (sourceObjectId: string) => index.get(sourceObjectId) ?? "undetermined";
}

/** Recipients other than the actor, so a collaborator seat has its own rows. */
export const HOME_INBOX_COLLABORATOR_STATES: readonly InboxEventState[] =
  Object.freeze(
    HOME_INBOX_EVENTS.filter((row) => row.workspaceId === NC).map((row) =>
      Object.freeze({
        ...state(row.id, "new", "open"),
        recipientUserId: EABHA,
      }),
    ),
  );

export const HOME_INBOX_GUEST_STATES: readonly InboxEventState[] =
  Object.freeze(
    HOME_INBOX_EVENTS.filter((row) => row.workspaceId === SR).map((row) =>
      Object.freeze({
        ...state(row.id, "new", "open"),
        recipientUserId: "guest-user-dara",
      }),
    ),
  );

/** The pinned instant every derivation above is taken at. */
export const HOME_INBOX_NOW = HOME_FIXTURE_NOW;
