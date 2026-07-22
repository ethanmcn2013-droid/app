/**
 * prose/blocked.ts, Phrasings for the `blocked` trigger.
 *
 * Locked Cycle 6.4 (signoff 2026-05-10).
 * Cycle 6.5a.1 added focusPhrasings (action register for Suggested Focus).
 *
 * Variables: ${task}, ${project}, ${days}, ${blocker}.
 */

import type { ProseLibrary } from "./types";

export const blockedProse: ProseLibrary = {
  triggerId: "blocked",
  phrasings: [
    "${task} has been waiting for ${days} days.",
    "${task} hasn't moved in ${days} days. Still waiting.",
    "${task} is blocked by ${blocker}.",
    "${task} on ${project} has been stuck ${days} days.",
    "${task} is waiting on ${blocker}. ${days} days now.",
    "Nothing has happened on ${task} in ${days} days. Still waiting.",
  ],
  focusPhrasings: [
    "Unblock ${task} today, it's been stuck ${days} days.",
    "Move ${task} today. It's been blocked ${days} days.",
    "Clear whatever's blocking ${task} today.",
    "Get ${task} unstuck today. ${days} days now.",
  ],
};
