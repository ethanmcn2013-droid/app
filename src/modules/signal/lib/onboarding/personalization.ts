/**
 * Briefing empty-state copy keyed by Tasks `primary_use_case`.
 * Sister to tasks/src/lib/onboarding/segments.ts, analytics voice only.
 */

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

// The all-clear is a designed destination (briefing-view AllClear),
// so every line here is a headline in display type. Rules: plain
// English, no "board" (banned vocabulary), no repeating the "next
// briefing builds tomorrow" mechanics, the footnote under the
// headline already carries that, once.
export function getBriefingEmptyCopy(input: {
  primaryUseCase: string | null | undefined;
}): BriefingEmptyCopy {
  const context = input.primaryUseCase && isPrimaryUseCase(input.primaryUseCase)
    ? input.primaryUseCase.replaceAll("-", " ")
    : "work";
  return {
    headline: "Nothing needs your attention right now.",
    body: `No ${context} item in this scope crossed Signal's attention rules.`,
  };
}
