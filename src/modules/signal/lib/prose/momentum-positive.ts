/**
 * prose/momentum-positive.ts, Phrasings for the `momentum-positive` trigger.
 *
 * Locked Cycle 6.4 (signoff 2026-05-10).
 * Cycle 6.5a.1: items→things. No focusPhrasings, moving-well triggers
 * almost never surface in Suggested Focus given their low rank weights;
 * adding action-register copy here would be unused authoring.
 *
 * Variables: ${project}, ${count}.
 */

import type { ProseLibrary } from "./types";

export const momentumPositiveProse: ProseLibrary = {
  triggerId: "momentum-positive",
  phrasings: [
    "${project} has shipped ${count} things this week.",
    "${project} is moving, ${count} closed in the last week.",
    "${count} things closed on ${project} this week. More than usual.",
    "${project} picked up the pace this week. ${count} done.",
    "${project} is having a good week. ${count} things closed.",
  ],
};
