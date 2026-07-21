/**
 * prose/unresolved-recurring-block.ts, Phrasings for the `unresolved-recurring-block` trigger.
 *
 * Locked Cycle 6.4 (signoff 2026-05-10).
 * Cycle 6.5a.1: items→things; added focusPhrasings.
 *
 * Variables: ${blocker}, ${count}.
 */

import type { ProseLibrary } from "./types";

export const unresolvedRecurringBlockProse: ProseLibrary = {
  triggerId: "unresolved-recurring-block",
  phrasings: [
    "${blocker} is in the way of ${count} other things.",
    "${count} things are waiting on ${blocker}.",
    "${blocker} keeps coming up, it's blocking ${count} other things.",
    "${count} things can't move until ${blocker} does.",
    "${blocker} is the one thing holding up ${count} others.",
  ],
  focusPhrasings: [
    "Resolve ${blocker} today, ${count} things depend on it.",
    "Clear ${blocker} today. It's holding up ${count} other things.",
    "Get ${blocker} sorted today. ${count} things can't move until it does.",
  ],
};
