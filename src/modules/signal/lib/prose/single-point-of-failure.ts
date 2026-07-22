/**
 * prose/single-point-of-failure.ts, Phrasings for the `single-point-of-failure` trigger.
 *
 * Locked Cycle 6.4 (signoff 2026-05-10).
 * Cycle 6.5a.1 added focusPhrasings.
 *
 * Variables: ${project}, ${share}.
 */

import type { ProseLibrary } from "./types";

export const singlePointOfFailureProse: ProseLibrary = {
  triggerId: "single-point-of-failure",
  phrasings: [
    "Most of ${project} is sitting on one person.",
    "${share}% of the open work on ${project} is on one person.",
    "${project} is mostly on one person right now.",
    "If one person is out, ${project} stops. ${share}% on them.",
    "One person is carrying most of ${project}.",
  ],
  focusPhrasings: [
    "Spread ${project} today, too much of it is on one person.",
    "Hand off a piece of ${project} today. ${share}% on one person.",
    "Move some of ${project} to someone else today.",
  ],
};
