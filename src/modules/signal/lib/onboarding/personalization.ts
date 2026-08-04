/**
 * Briefing empty-state copy keyed by Tasks `primary_use_case`.
 * Sister to tasks/src/lib/onboarding/segments.ts, analytics voice only.
 */

import { readCountSentence } from "../briefing/voice";

export type PrimaryUseCase =
  | "venue"
  | "wedding"
  | "student"
  | "small-business"
  | "event-management"
  | "creative-studio"
  | "internal-team"
  | "other";

const SEGMENT_IDS = new Set<string>([
  "venue",
  "wedding",
  "student",
  "small-business",
  "event-management",
  "creative-studio",
  "internal-team",
  "other",
]);

export function isPrimaryUseCase(v: string): v is PrimaryUseCase {
  return SEGMENT_IDS.has(v);
}

type BriefingEmptyCopy = { headline: string; body: string };

/**
 * The modifier on "work", not a noun standing in for the work itself.
 *
 * Two rounds of this. First the segment id was used as an adjective on
 * "item", which produced "No small business item in this scope crossed
 * Signal's attention rules". The repair swapped in a domain noun and
 * produced a category error instead: "No team in this scope crossed
 * Signal's attention rules", "No wedding…", "No client…". A team does not
 * cross an attention rule and neither does a wedding; their work does. So
 * the noun modifies "work" and the sentence is about the work.
 *
 * Each value is chosen to read as written in "No {value} work in this
 * scope…": "team" would collide with "teamwork" and "job work" is not
 * English, so those segments take the modifier that survives the
 * sentence. A segment with no honest modifier falls back to "No item…".
 */
const SEGMENT_NOUNS: Record<PrimaryUseCase, string | null> = {
  venue: "event",
  wedding: "wedding",
  student: "course",
  "small-business": "business",
  "event-management": "event",
  "creative-studio": "client",
  "internal-team": "shared",
  other: null,
};

// The all-clear is a designed destination (briefing-view AllClear),
// so every line here is a headline in display type. Rules: plain
// English, no "board" (banned vocabulary), no repeating the "next
// briefing builds tomorrow" mechanics, the footnote under the
// headline already carries that, once.
export function getBriefingEmptyCopy(input: {
  primaryUseCase: string | null | undefined;
  /** Signals examined in scope on this run. Present → the all-clear
   *  states its denominator instead of asserting a clear day. */
  readCount?: number | null;
  /** How many of those crossed a rule. Threaded through so the sentence
   *  cannot claim nothing crossed on a day when something did. */
  triggeredCount?: number | null;
}): BriefingEmptyCopy {
  const noun =
    input.primaryUseCase && isPrimaryUseCase(input.primaryUseCase)
      ? SEGMENT_NOUNS[input.primaryUseCase]
      : null;

  return {
    headline: "Nothing needs your attention right now.",
    // With a denominator the all-clear is a receipt, so it wins over
    // the segment phrasing. Without one it stays a plain statement.
    body:
      readCountSentence(input.readCount, input.triggeredCount) ??
      `No ${noun ? `${noun} work` : "item"} in this scope crossed Signal’s attention rules.`,
  };
}
