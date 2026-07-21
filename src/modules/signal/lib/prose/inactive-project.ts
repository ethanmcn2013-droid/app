/**
 * prose/inactive-project.ts, Phrasings for the `inactive-project` trigger.
 *
 * Locked Cycle 6.4 (signoff 2026-05-10).
 * Cycle 6.5a.1 added focusPhrasings.
 *
 * Variables: ${project}, ${days}.
 */

import type { ProseLibrary } from "./types";

export const inactiveProjectProse: ProseLibrary = {
  triggerId: "inactive-project",
  phrasings: [
    "${project} has had no activity in ${days} days.",
    "Nothing has moved on ${project} in over a week.",
    "${project} has gone quiet, last touched ${days} days ago.",
    "${project} is still open but hasn't moved in ${days} days.",
    "${project} has been silent for ${days} days.",
    "No movement on ${project} in ${days} days.",
  ],
  focusPhrasings: [
    "Touch ${project} today, nothing has happened in ${days} days.",
    "Pick something on ${project} and move it today. It's been ${days} days.",
    "Spend some time on ${project} today, silent for ${days} days.",
  ],
};
