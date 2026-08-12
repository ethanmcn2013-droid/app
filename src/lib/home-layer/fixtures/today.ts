/**
 * Home fixture universe · Today's candidate sets.
 *
 * Records only. Not one count in this file is typed by hand — every number
 * Today renders is produced by `./derive.ts` from these records, so a fixture
 * cannot claim a total its own data does not support. That is the whole
 * discipline: `TODAY_RANKING.md` §6's identity
 * `read = shown + cappedOut + dismissed + cleared` has to BALANCE, and it can
 * only balance if nobody is allowed to write the terms down.
 *
 * `WorkSignal` mirrors `TODAY_RANKING.md` §3 field for field, with the four
 * sealed requirements on it honoured in the data:
 *   1. `lane` is a real per-Project lane, never a fixed mapping.
 *   2. `sourceLabel` carries a RESOLVED Project name. The literal "Workspace"
 *      appears nowhere, and neither does the word "workspace".
 *   3. `priority` is on the record. It is never a constant 2.
 *   4. `projectId` is canonical, or explicitly null for Unprojectable work.
 */

import { fixtureInstantAt, HOME_FIXTURE_NOW_ISO } from "./clock";
import { HOME_FIXTURE_PROJECT_IDS } from "./projects";
import { sourceKey, taskRef, type SourceRef } from "./source-ref";

/** `src/modules/signal/lib/briefing/types.ts:10`, unchanged. */
export type Lane = "next" | "in-flight" | "review" | "shipped";

export type WorkSignal = Readonly<{
  ref: SourceRef;
  title: string;
  lane: Lane;
  /** 0 is P0. `(3 - priority)` is the severity bonus in three triggers. */
  priority: 0 | 1 | 2 | 3;
  dueAtIso: string | null;
  idleDays: number;
  blockedBy: readonly SourceRef[];
  movedToDoneAtIso: string | null;
  /** Resolved from the record. Product plus real Project name. */
  sourceLabel: Readonly<{ product: "Tasks" | "Notes" | "Timeline"; projectName: string }>;
  projectId: string | null;
  /** Only assigned work counts toward `doing-empty`. */
  assignedToActor: boolean;
  /** The reader silenced it. Silence chosen is not absence (Q5). */
  dismissedByReader: boolean;
}>;

const MF = HOME_FIXTURE_PROJECT_IDS.maraFinn;
const NC = HOME_FIXTURE_PROJECT_IDS.noraCian;
const AT = HOME_FIXTURE_PROJECT_IDS.aislingTom;

const SR = HOME_FIXTURE_PROJECT_IDS.sineadRuairi;

const NAME = {
  [MF]: "Mara & Finn",
  [NC]: "Nora & Cian",
  [AT]: "Aisling & Tom",
  [SR]: "Sinéad & Ruairí",
} as const;

function task(
  id: string,
  projectId: string,
  title: string,
  fields: Partial<Omit<WorkSignal, "ref" | "title" | "projectId" | "sourceLabel">>,
): WorkSignal {
  return Object.freeze({
    ref: taskRef(id, projectId),
    title,
    lane: fields.lane ?? "next",
    priority: fields.priority ?? 2,
    dueAtIso: fields.dueAtIso ?? null,
    idleDays: fields.idleDays ?? 0,
    blockedBy: Object.freeze(fields.blockedBy ?? []),
    movedToDoneAtIso: fields.movedToDoneAtIso ?? null,
    sourceLabel: Object.freeze({
      product: "Tasks" as const,
      projectName: NAME[projectId as keyof typeof NAME] ?? "Unresolved",
    }),
    projectId,
    assignedToActor: fields.assignedToActor ?? true,
    dismissedByReader: fields.dismissedByReader ?? false,
  });
}

// ── owner_signature ─────────────────────────────────────────────────────────

/**
 * The complete owner view. Real attention, real events, real responsibility,
 * earned analytics. Every one of the eight triggers in §4.2 is either fired
 * here or fired in a named sibling world below, and none is fired by accident.
 */
export const TODAY_SIGNATURE_CANDIDATES: readonly WorkSignal[] = Object.freeze([
  // — crossed a rule ——————————————————————————————————————————————
  task("home-task-mf-kitchen-numbers", MF, "Confirm final numbers with the Orchard kitchen", {
    lane: "in-flight",
    priority: 0,
    dueAtIso: fixtureInstantAt(-2, 17),
    idleDays: 2,
  }),
  task("home-task-mf-seating-plan", MF, "Send the Orchard seating plan to the venue", {
    lane: "next",
    priority: 1,
    dueAtIso: fixtureInstantAt(0, 17),
    idleDays: 1,
  }),
  task("home-task-nc-musicians", NC, "Book the Ballyhoura ceremony musicians", {
    lane: "next",
    priority: 1,
    dueAtIso: fixtureInstantAt(4, 12),
    idleDays: 1,
  }),
  // Nobody is assigned to this one. `assignedToActor: false` is the reader's
  // side of that fact; Analytics A3 counts the other side, and the two may
  // never disagree — an unowned row the reader is assigned to is a lie in
  // one of the two modes.
  task("home-task-at-florist-quote", AT, "Chase the Adare florist for a written quote", {
    lane: "next",
    priority: 2,
    dueAtIso: fixtureInstantAt(5, 12),
    idleDays: 3,
    assignedToActor: false,
  }),
  task("home-task-mf-corkage", MF, "Agree the Orchard corkage rate", {
    lane: "in-flight",
    priority: 1,
    idleDays: 9,
  }),
  task("home-task-nc-marquee-lighting", NC, "Confirm the Ballyhoura marquee lighting", {
    lane: "in-flight",
    priority: 1,
    idleDays: 7,
    blockedBy: [taskRef("home-task-nc-generator", NC)],
  }),
  task("home-task-mf-table-linen", MF, "Order the Orchard table linen", {
    lane: "next",
    priority: 2,
    idleDays: 1,
    // Its only blocker is done, so the way is clear. Good news, and it is
    // never more urgent than something carrying a date.
    blockedBy: [taskRef("home-task-mf-cake-supplier", MF)],
  }),
  task("home-task-mf-cake-supplier", MF, "Confirm the Orchard cake supplier", {
    lane: "shipped",
    priority: 1,
    movedToDoneAtIso: "2026-07-16T01:20:00.000Z",
    idleDays: 0,
  }),

  // — in flight and in review, enough of them to cross `overload` ————
  task("home-task-mf-final-invoice", MF, "Review the Orchard final invoice", {
    lane: "review",
    priority: 2,
    idleDays: 6,
  }),
  task("home-task-nc-supplier-contract", NC, "Review the Ballyhoura supplier contract", {
    lane: "review",
    priority: 2,
    idleDays: 4,
  }),
  task("home-task-mf-transport", MF, "Hold the Orchard shuttle for the late guests", {
    lane: "in-flight",
    priority: 2,
    idleDays: 1,
  }),
  task("home-task-at-ceremony-time", AT, "Fix the Adare ceremony start time", {
    lane: "in-flight",
    priority: 2,
    idleDays: 2,
  }),

  // — dated, inside the 14-day horizon, crossed nothing ————————————
  task("home-task-at-running-order", AT, "Draft the Adare running order", {
    lane: "next",
    priority: 2,
    dueAtIso: fixtureInstantAt(9, 12),
  }),
  task("home-task-at-hair-trial", AT, "Book the Adare hair trial", {
    lane: "next",
    priority: 3,
    dueAtIso: fixtureInstantAt(12, 10),
  }),

  // — the reader silenced this one. Q5. ————————————————————————————
  task("home-task-nc-parking", NC, "Ask about Ballyhoura parking", {
    lane: "next",
    priority: 3,
    dueAtIso: fixtureInstantAt(-1, 12),
    idleDays: 4,
    dismissedByReader: true,
  }),

  // — crossed nothing, and that is a true statement about them ——————
  task("home-task-mf-guest-book", MF, "Choose the Orchard guest book", {
    lane: "next",
    priority: 3,
    assignedToActor: false,
  }),
  task("home-task-nc-favours", NC, "Decide on Ballyhoura favours", {
    lane: "next",
    priority: 3,
  }),
  task("home-task-at-confetti", AT, "Confirm the Adare confetti rule", {
    lane: "next",
    priority: 3,
  }),
  task("home-task-mf-thank-you", MF, "Draft the Orchard thank-you wording", {
    lane: "next",
    priority: 3,
  }),
  task("home-task-nc-generator", NC, "Hire the Ballyhoura generator", {
    lane: "next",
    priority: 2,
    idleDays: 2,
    assignedToActor: false,
  }),
]);

// ── owner_quiet ─────────────────────────────────────────────────────────────

/**
 * A DELIBERATELY quiet day. Nothing crosses a rule, nothing is dismissed,
 * nothing is capped, every provider answered, and every Project resolved —
 * so Q1 to Q9 are all false and this is the ONE world in which Today is
 * permitted to say that nothing crossed a rule.
 *
 * That is the point of the world: it exists so the honest quiet state has a
 * fixture, and so no other scenario can borrow its language.
 */
export const TODAY_QUIET_CANDIDATES: readonly WorkSignal[] = Object.freeze([
  task("home-task-mf-playlist", MF, "Finish the Orchard evening playlist", {
    lane: "next",
    priority: 3,
    dueAtIso: fixtureInstantAt(21, 12),
  }),
  task("home-task-nc-readings", NC, "Choose the Ballyhoura readings", {
    lane: "next",
    priority: 3,
    dueAtIso: fixtureInstantAt(26, 12),
  }),
  task("home-task-at-favours", AT, "Pick the Adare favours", {
    lane: "next",
    priority: 3,
  }),
  task("home-task-mf-signage", MF, "Order the Orchard signage", {
    lane: "next",
    priority: 3,
  }),
]);

// ── new_user ────────────────────────────────────────────────────────────────

/**
 * No Project, no history, no candidates. This is NOT the quiet day: with the
 * authorized set genuinely empty, Q9 fires and quiet language is refused.
 * Today renders setup and unsupported states instead.
 */
export const TODAY_NEW_USER_CANDIDATES: readonly WorkSignal[] = Object.freeze([]);

// ── doing_empty, the trigger that needs its own world ───────────────────────

/**
 * `doing-empty` fires only when the reader has five or more assigned objects
 * in `next` and ZERO in `in-flight`. The signature world has in-flight work,
 * so the trigger cannot fire there. It gets its own set rather than being
 * bent into one that would not produce it.
 */
export const TODAY_DOING_EMPTY_CANDIDATES: readonly WorkSignal[] = Object.freeze([
  task("home-task-mf-de-1", MF, "Confirm the Orchard arrival time", { lane: "next" }),
  task("home-task-mf-de-2", MF, "Send the Orchard menu choices", { lane: "next" }),
  task("home-task-nc-de-3", NC, "Order the Ballyhoura stationery", { lane: "next" }),
  task("home-task-nc-de-4", NC, "Confirm the Ballyhoura celebrant", { lane: "next" }),
  task("home-task-at-de-5", AT, "Book the Adare tasting", { lane: "next" }),
]);

// ── The clock change ────────────────────────────────────────────────────────

/**
 * `dst_boundary` reads on the evening of 24 October 2026, the night the
 * clocks go back. Dates are authored as INSTANTS at known local wall times
 * either side of the transition, so a ranking that computes "days out" by
 * dividing elapsed milliseconds by 86,400,000 puts at least one of these in
 * the wrong bucket, and a ranking that compares calendar ordinals does not.
 *
 * `home-task-dst-sunday` is the load-bearing one: 12:00 GMT on Sunday 25
 * October is 25 hours after 12:00 BST on Saturday 24 October.
 */
export const TODAY_DST_CANDIDATES: readonly WorkSignal[] = Object.freeze([
  task("home-task-dst-keys", MF, "Collect the Orchard keys", {
    lane: "in-flight",
    priority: 1,
    dueAtIso: "2026-10-24T21:30:00.000Z", // 22:30 BST, still today
    idleDays: 4,
  }),
  task("home-task-dst-sunday", MF, "Open up on Sunday morning", {
    lane: "next",
    priority: 0,
    dueAtIso: "2026-10-25T12:00:00.000Z", // 12:00 GMT, tomorrow, 25 h later
  }),
  task("home-task-dst-monday", NC, "Ballyhoura walk-through", {
    lane: "next",
    priority: 2,
    dueAtIso: "2026-10-26T12:00:00.000Z",
  }),
  task("home-task-dst-late", AT, "Adare final numbers", {
    lane: "next",
    priority: 2,
    dueAtIso: "2026-11-01T12:00:00.000Z",
  }),
  task("home-task-dst-quiet", AT, "Confirm the Adare cake", {
    lane: "next",
    priority: 3,
    assignedToActor: false,
  }),
]);

// ── The shared Project, from the guest seat ─────────────────────────────────

/**
 * `guest_limited` reads ONE Project the actor shares, and it reads the same
 * record My work lists and Analytics counts, under the same id. An empty
 * Today for a Project that holds work would publish `read 0` beside an open
 * count of one, which is the two-worlds defect this universe exists to make
 * impossible rather than a statement about the guest's day.
 */
export const TODAY_GUEST_CANDIDATES: readonly WorkSignal[] = Object.freeze([
  task("home-task-sr-cars", SR, "Check the Dromoland car list", {
    lane: "next",
    priority: 2,
    dueAtIso: fixtureInstantAt(2, 12),
    idleDays: 1,
  }),
]);

// ── Unprojectable and Unlabelled work ───────────────────────────────────────

/**
 * PROJECT_SCOPE §6, D-H05. `workspace_id IS NULL` rows are excluded from
 * every Project-scoped count AND THE EXCLUSION IS DISCLOSED. They are never
 * folded into a Project to tidy a number.
 */
export const TODAY_UNPROJECTABLE_CANDIDATES: readonly WorkSignal[] =
  Object.freeze([
    Object.freeze({
      ref: taskRef("home-task-orphan-insurance", null),
      title: "Check whether the public liability cover renewed",
      lane: "next" as const,
      priority: 1 as const,
      dueAtIso: fixtureInstantAt(1, 12),
      idleDays: 5,
      blockedBy: Object.freeze([]),
      movedToDoneAtIso: null,
      sourceLabel: Object.freeze({
        product: "Tasks" as const,
        projectName: "Unprojected",
      }),
      projectId: null,
      assignedToActor: true,
      dismissedByReader: false,
    }),
  ]);

// ── The kinds with no producer ──────────────────────────────────────────────

/**
 * TODAY_RANKING §2, as corrected 2026-08-12 and decided at `TR-7` / `TR-9`.
 * `calendar-event` is an ELIGIBLE kind with NO PRODUCER in V1 —
 * `WorkRead.events` is hardcoded `[]` — so it contributes zero rows and a
 * coverage statement, and it renders `unsupported`. Eligibility is not
 * availability, and the difference is the whole point: an ineligible kind
 * renders nothing at all, while this one has to say it cannot see.
 * Never an empty calendar, never "nothing scheduled", never a blank section.
 *
 * This constant is the fixture's way of making that difference testable: a
 * surface that renders `calendar-event` as an empty section rather than as
 * `unsupported` fails against this list.
 */
export const TODAY_UNSUPPORTED_KINDS = Object.freeze([
  Object.freeze({
    kind: "calendar-event" as const,
    status: "unsupported" as const,
    reason: "No calendar is connected.",
    prohibitedRenderings: Object.freeze([
      "0",
      "No events today",
      "Nothing scheduled",
      "All clear",
      "an empty section",
    ]),
  }),
  Object.freeze({
    kind: "decision" as const,
    status: "unsupported" as const,
    reason: "Notes does not publish structured decisions yet.",
    prohibitedRenderings: Object.freeze(["0", "No decisions", "All clear"]),
  }),
]);

/** Every candidate set, by the world that selects it. */
export const TODAY_CANDIDATE_SETS = Object.freeze({
  signature: TODAY_SIGNATURE_CANDIDATES,
  quiet: TODAY_QUIET_CANDIDATES,
  newUser: TODAY_NEW_USER_CANDIDATES,
  doingEmpty: TODAY_DOING_EMPTY_CANDIDATES,
  dst: TODAY_DST_CANDIDATES,
  guest: TODAY_GUEST_CANDIDATES,
  unprojectable: TODAY_UNPROJECTABLE_CANDIDATES,
});

/** The pinned instant every one of the above is ranked against. */
export const TODAY_AS_OF_ISO = HOME_FIXTURE_NOW_ISO;

/** Guard: two candidates may never share a `sourceKey`. */
export function assertDistinctSourceKeys(
  candidates: readonly WorkSignal[],
): void {
  const seen = new Set<string>();
  for (const candidate of candidates) {
    const key = sourceKey(candidate.ref);
    if (seen.has(key)) {
      throw new Error(`home-fixtures/today: duplicate sourceKey ${key}`);
    }
    seen.add(key);
  }
}
