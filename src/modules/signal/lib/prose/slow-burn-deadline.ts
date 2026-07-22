/**
 * prose/slow-burn-deadline.ts, Phrasings for the `slow-burn-deadline` trigger.
 *
 * Locked Cycle 6.4 (signoff 2026-05-10).
 * Cycle 6.5a.1 added focusPhrasings.
 *
 * Variables: ${project}, ${days}, ${done}.
 *
 * Trigger inert in v1 (Tasks doesn't model project deadlines per
 * PRODUCT.md §6). Phrasings drafted so the library is complete and
 * the trigger lights up the moment a deadline source exists.
 */

import type { ProseLibrary } from "./types";

export const slowBurnDeadlineProse: ProseLibrary = {
  triggerId: "slow-burn-deadline",
  phrasings: [
    "${project} is due in ${days} days, and most of it is still open.",
    "${days} days to ${project}'s deadline. Only ${done}% closed.",
    "${project}'s date is coming up (${days} days) and the work hasn't.",
    "${project} is ${days} days from its deadline. Mostly still open.",
    "${days} days left on ${project}, and only ${done}% is done.",
  ],
  focusPhrasings: [
    "Push on ${project} today, only ${days} days left.",
    "Close something on ${project} today. ${days} days to go.",
    "Spend today on ${project}, ${days} days, and ${done}% done.",
  ],
};
