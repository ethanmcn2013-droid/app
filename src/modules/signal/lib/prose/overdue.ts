/**
 * prose/overdue.ts, Phrasings for the `overdue` trigger.
 *
 * Locked Cycle 6.4 (signoff 2026-05-10).
 * Cycle 6.5a.1 added focusPhrasings.
 *
 * Variables: ${task}, ${project}, ${days}.
 */

import type { ProseLibrary } from "./types";

export const overdueProse: ProseLibrary = {
  triggerId: "overdue",
  phrasings: [
    "${task} was due ${days} days ago.",
    "${task} on ${project} is past its date.",
    "${task} has been overdue for ${days} days.",
    "${task} should have closed ${days} days ago.",
    "${project}: ${task} is sitting past its date by ${days} days.",
    "${task} missed its date. ${days} days now.",
  ],
  focusPhrasings: [
    "Close out ${task} today, it was due ${days} days ago.",
    "Finish ${task} today. It was due ${days} days back.",
    "Get ${task} closed today. It's ${days} days late.",
  ],
};
