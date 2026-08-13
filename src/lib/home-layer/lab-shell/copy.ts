/**
 * Every shared word in the lab, written once.
 *
 * The fairness rule this file exists to enforce: four directions, identical
 * copy. A director comparing Editorial and Desk should be comparing
 * composition, rhythm, hierarchy, navigation, detail behaviour, disclosure and
 * motion — never two people's phrasing of the same fact.
 *
 * VOICE. `studio/BRAND.md` governs and does not bend: plain English, active
 * verbs, no exclamation marks, no em dashes, no marketing vocabulary. It also
 * has to survive `scripts/check-first-contact-language.mjs`, which bans
 * triage, backlog, sprint, wip, blocker, blocked by, iteration, throughput,
 * cycle time, config, schema, payload, endpoint and null among others. That is
 * why nothing below says "blocked by" and everything says "waiting on".
 */

import type { HomeMode, MyWorkGroup } from "../fixtures";
import type {
  FirstRunView,
  HomeCopy,
  HomeStateName,
  TodaySectionId,
} from "./contract";

export const MODE_NAMES: Readonly<Record<HomeMode, string>> = Object.freeze({
  today: "Today",
  inbox: "Inbox",
  "my-work": "My work",
  analytics: "Analytics",
  briefing: "Full briefing",
});

/** HOME_EXPERIENCE §2. Mode first, then Home, then Signal Studio. */
export const DOCUMENT_TITLES: Readonly<Record<HomeMode, string>> = Object.freeze({
  today: "Home · Signal Studio",
  inbox: "Inbox · Home · Signal Studio",
  "my-work": "My work · Home · Signal Studio",
  analytics: "Analytics · Home · Signal Studio",
  briefing: "Full briefing · Home · Signal Studio",
});

export const SECTION_HEADINGS: Readonly<Record<TodaySectionId, string>> =
  Object.freeze({
    todaysSignal: "Today's signal",
    comingUp: "Coming up",
    needsReview: "Needs review",
    movingWell: "Moving well",
  });

export const MY_WORK_GROUP_HEADINGS: Readonly<Record<MyWorkGroup, string>> =
  Object.freeze({
    waiting: "Waiting",
    now: "Now",
    next: "Next",
    later: "Later",
  });

export const MY_WORK_GROUP_NOTES: Readonly<Record<MyWorkGroup, string | null>> =
  Object.freeze({
    waiting: "Held up, or parked in a waiting column.",
    now: "Late, or due today.",
    next: "Due in the next seven days.",
    later: "Further out, or without a date.",
  });

export const INBOX_KIND_LABELS: Readonly<Record<string, string>> = Object.freeze({
  mention: "Mentioned you",
  reply: "Replied to you",
  "review-requested": "Asked you to review",
  "approval-requested": "Asked you to approve",
  handoff: "Handed work to you",
  "explicit-block": "Flagged something in your way",
});

/** HOME_EXPERIENCE §10.1. One name per state, everywhere. */
export const STATE_NAMES: Readonly<Record<HomeStateName, string>> = Object.freeze({
  ready: "Read",
  loading: "Opening",
  refreshing: "Reading again",
  updated: "Updated",
  partial: "Partly read",
  stale: "Last read a while ago",
  "insufficient-history": "Not enough history",
  "permission-limited": "Limited by your access",
  unavailable: "Could not be read",
  archived: "Archived",
  empty: "Nothing in it",
  // Three different facts, three different words. "Could not be read" is a
  // read that failed, "Nothing in it" is a read that came back holding
  // nothing, and this is a reader who has not started.
  "first-run": "Nothing set up yet",
  failed: "Did not load",
  offline: "No connection",
  "all-clear": "Nothing needs you",
});

export const HOME_LAB_COPY: HomeCopy = Object.freeze({
  modeNames: MODE_NAMES,
  sectionHeadings: SECTION_HEADINGS,
  myWorkGroupHeadings: MY_WORK_GROUP_HEADINGS,
  actions: Object.freeze({
    openBriefing: "Open the full briefing",
    backToToday: "Back to Today",
    openEvent: "Open",
    markRead: "Mark as read",
    snooze: "Snooze",
    clear: "Clear from Inbox",
    approve: "Approve at the source",
    retry: "Try again",
    openSource: "Open in the product",
    complete: "Mark as done",
    reassign: "Change who owns it",
    openEvidence: "See the records behind this",
    openProject: "Open this project",
    changeScope: "Change what Home reads",
    resetScope: "Read one project again",
    closeLens: "Close this project view",
    showMore: "See the rest",
  }),
  states: STATE_NAMES,
  empty: Object.freeze({
    today: "Nothing crossed a rule today.",
    inbox: "Nothing is waiting for you here.",
    myWork: "Nothing is assigned to you right now.",
    analytics: "There are no records in this window yet.",
  }),
  unreadableCount: "Could not be counted",
  noBaseline: "No accepted baseline",
});

/**
 * The `h1` line per mode. Expressive, and it never stands in for the mode
 * name: HOME_EXPERIENCE D-HX02 requires the mode name to reach the accessible
 * text of the `h1`, which is what `chrome.modeEyebrow` is for.
 */
export const MODE_HEADLINES: Readonly<Record<HomeMode, string>> = Object.freeze({
  today: "What is asking for you now.",
  inbox: "What changed, and what it wants.",
  "my-work": "What you are carrying.",
  analytics: "What the records support.",
  briefing: "The whole day, in order.",
});

// ── The first screen ────────────────────────────────────────────────────────

/**
 * A PERSON'S FIRST EVER SCREEN, written once so four directions get it without
 * improvising it.
 *
 * Editorial Line improvised this well under round-1 review and a director
 * called it the single best decision anyone made in the lab. It should not
 * have had to: the shell was telling all four that the read had failed. So the
 * words move here, unchanged in substance, and every direction is handed them.
 *
 * The rule they follow, LAB_BRIEF Amendment 2: one plain sentence saying what
 * is missing, and at least one thing the reader can actually do. Nothing here
 * apologises, nothing here says a read failed, and nothing here calls an
 * absence of setup an absence of work.
 */
export const FIRST_RUN: FirstRunView = Object.freeze({
  heading: "Where to start",
  line: "There is no project yet, so Home has nothing to read.",
  nextLine:
    "Work lives in a project. Make one in Tasks, and Home reads it from the next read.",
  actions: Object.freeze([
    Object.freeze({ id: "open-tasks", label: "Open Tasks", href: "/app/tasks" }),
  ]),
});

/**
 * The disclosure that carries the state, for a direction that shows its
 * disclosures as a run. It says the fact and then refuses the two wrong
 * readings of it in the same breath.
 */
export const FIRST_RUN_DISCLOSURE =
  "There is no project yet. Nothing failed, and nothing here counts as zero.";

/**
 * Today's own line when there is nothing to read. Without it a first screen
 * borrows the failed-read sentence and opens on "This is not an all clear",
 * which tells a new reader that something went wrong on their first morning.
 */
export const FIRST_RUN_QUIET_LINE =
  "Nothing has been set up yet, so there was nothing to read. This is not a failed read, and it is not an all clear either.";

/**
 * Replaces the withheld-accounting sentence, which otherwise blames a source
 * that did not answer. There is no source. There is nothing connected.
 */
export const FIRST_RUN_ACCOUNTING_LINE =
  "There is nothing connected yet, so there is no read to account for.";

/** The lead sentence Analytics opens on. Prose first, never a chart wall. */
export const ANALYTICS_LEAD =
  "Every number here names the records it counted, the window it read, and what it could not see.";

export const SUPPRESSED_BY_CAP = (count: number, section: string): string =>
  count === 1
    ? `One more qualified for ${section} and is not shown here.`
    : `${count} more qualified for ${section} and are not shown here.`;

export const CLAIMED_ABOVE = (count: number): string =>
  count === 1
    ? "One of them is already shown further up."
    : `${count} of them are already shown further up.`;

export const COMING_UP_WINDOW = "Looking fourteen days ahead.";

export const MY_WORK_WINDOW_NOTE = "Grouped over the next seven days.";
