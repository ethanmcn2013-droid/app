/**
 * prose/dependency-stall.ts, Phrasings for the `dependency-stall` trigger.
 *
 * Locked Cycle 6.4 (signoff 2026-05-10).
 * Cycle 6.5a.1 added focusPhrasings.
 *
 * Variables: ${task}, ${blocker}, ${project}, ${days}.
 */

import type { ProseLibrary } from "./types";

export const dependencyStallProse: ProseLibrary = {
  triggerId: "dependency-stall",
  phrasings: [
    "${task} is waiting on ${blocker}, which hasn't moved in ${days} days.",
    "${blocker} has been quiet for ${days} days, and ${task} is held up by it.",
    "${task} can't move until ${blocker} does. ${days} days of quiet.",
    "${task} on ${project} is waiting on ${blocker}. Nothing has happened in ${days} days.",
    "${blocker} is stalled (${days} days), and ${task} is sitting behind it.",
  ],
  focusPhrasings: [
    "Chase ${blocker} today, ${task} is waiting on it.",
    "Nudge ${blocker} today. ${task} can't move until it does.",
    "Push on ${blocker} today, it's been quiet ${days} days.",
  ],
};
