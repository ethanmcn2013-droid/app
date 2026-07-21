/**
 * prose/streak.ts, Phrasings for the `streak` trigger.
 *
 * Locked Cycle 6.4 (signoff 2026-05-10).
 * Cycle 6.5a.1: items→things; added selfPhrasings.
 *
 * Variables: ${count}.
 *
 * Voice note: name-suppressed default ("Someone"). selfPhrasings used
 * when the streaking assignee IS the reader, "You closed 5 things
 * this week" reads as warm acknowledgement, not a leaderboard entry.
 * No focusPhrasings, streaks rarely surface in Suggested Focus given
 * the low rank weights, and "celebrate yourself today" doesn't read as
 * an action.
 */

import type { ProseLibrary } from "./types";

export const streakProse: ProseLibrary = {
  triggerId: "streak",
  phrasings: [
    "Someone closed ${count} things this week.",
    "One person has shipped ${count} things in the last week.",
    "${count} things closed by one person this week.",
    "Someone is on a roll. ${count} things closed in seven days.",
    "${count} done by one person this week.",
  ],
  selfPhrasings: [
    "You closed ${count} things this week.",
    "You've shipped ${count} things in the last week.",
    "${count} things closed this week. Yours.",
    "You're on a roll, ${count} closed in seven days.",
    "${count} done by you this week.",
  ],
};
