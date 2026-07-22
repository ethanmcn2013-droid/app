/**
 * prose/types.ts, The Phrasing contract.
 *
 * Per analytics/docs/PRODUCT.md §5.2 + §9 LOCKED DECISION C:
 * each Trigger has a hand-written set of 4–8 phrasings. When a
 * trigger fires, one phrasing is selected (rotated to avoid
 * repetition) and slot-filled with the Insight's variables.
 *
 * NO LLM IN THE PATH. Every phrasing is hand-curated by Ethan.
 * Voice rules per phrasing are enforced at code review time
 * (see PRODUCT.md §5.2 "Voice rules per phrasing").
 *
 * Defined revisit trigger (PRODUCT.md §9): expand library or
 * reconsider option B if (a) any user describes the briefing as
 * "templated/robotic" unprompted, or (b) the same phrasing fires
 * twice within 14d for the same user/trigger, or (c) we onboard
 * the 100th active user. NOT calendar-driven.
 *
 * Cycle 6.5a.1 added two phrasing variants per library:
 *   - `selfPhrasings`, used when the insight's subject is the
 *     reader themselves (entityType="user" && entityId === reader's
 *     clerk userId). Switches the briefing voice from third-person
 *     ("Someone holds 6 items") to second-person ("You hold 6
 *     things") for the personal moment.
 *   - `focusPhrasings`, used when the insight surfaces in the
 *     Suggested Focus block. Reframes "what's happening" as a
 *     "do this today" sentence. PRODUCT.md §4: Suggested Focus is
 *     an action read, not a restatement.
 *
 * Both variants fall back to `phrasings` when absent.
 */

import type { TriggerId } from "../triggers/types";

/**
 * A single phrasing template. Variables are substituted using
 * `${name}` syntax against the Insight's variables record.
 */
export type Phrasing = string;

/**
 * Per-trigger prose library. Default phrasings (4–8 per trigger
 * per PRODUCT.md §5.2) plus optional self/focus variants.
 */
export interface ProseLibrary {
  triggerId: TriggerId;
  phrasings: Phrasing[];
  /** Used when the insight subject is the reader themselves.
   *  Authored for triggers whose entityType is "user" (overload, streak). */
  selfPhrasings?: Phrasing[];
  /** Action-register variants for the Suggested Focus block. Authored
   *  for triggers that read sensibly as "do this today" actions
   *  (everything except moving-well triggers, those rarely surface
   *  in focus given their low rank weights). */
  focusPhrasings?: Phrasing[];
}

/**
 * Render a phrasing by substituting `${name}` slots.
 * Variables not present in `vars` are left as the literal `${name}`
 * string, caller's bug, surface it loudly rather than silently
 * dropping data.
 */
export function renderPhrasing(
  phrasing: Phrasing,
  vars: Record<string, string | number>,
): string {
  return phrasing.replace(/\$\{(\w+)\}/g, (_match, name: string) => {
    const v = vars[name];
    return v === undefined ? `\${${name}}` : String(v);
  });
}
