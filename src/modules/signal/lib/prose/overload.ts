/**
 * prose/overload.ts, Phrasings for the `overload` trigger.
 *
 * Locked Cycle 6.4 (signoff 2026-05-10).
 * Cycle 6.5a.1: items→things; added selfPhrasings + focusPhrasings.
 *
 * Variables: ${count}, ${share}.
 *
 * Voice note: name-suppressed by default (PRODUCT.md §7 bans
 * leaderboards). The selfPhrasings variant is used only when the
 * loaded person IS the briefing's reader, matched by clerk userId.
 * In that case "You" reads naturally; for others, the "Someone /
 * One person" register stays.
 */

import type { ProseLibrary } from "./types";

export const overloadProse: ProseLibrary = {
  triggerId: "overload",
  phrasings: [
    "One person is carrying ${count} active things.",
    "Someone is holding ${count} open things at once.",
    "${count} things are sitting on one person.",
    "One person has ${count} open things. That's a lot to carry.",
    "Someone is running ${share}% of the open work.",
    "${count} active things on one person.",
  ],
  selfPhrasings: [
    "You're carrying ${count} active things.",
    "You have ${count} open things at once.",
    "You're holding ${count} active things, that's a lot.",
    "You're running ${share}% of the open work.",
    "${count} things on you right now.",
  ],
  focusPhrasings: [
    "Hand off some of the load today, you're holding ${count}.",
    "Pass some of these ${count} things to someone today.",
    "Spread the work today, ${count} on one person is too much.",
  ],
};
