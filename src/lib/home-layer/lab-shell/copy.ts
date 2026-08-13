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
import type { HomeCopy, HomeStateName, TodaySectionId } from "./contract";

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
