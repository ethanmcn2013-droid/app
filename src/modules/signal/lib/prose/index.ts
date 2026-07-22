/**
 * prose/index.ts, Registry of all prose libraries (one per trigger).
 *
 * Cycle 6.4 populated this with phrasings for the 10 v1 triggers.
 * Locked 2026-05-10, Ethan signed off on the curated prose library.
 * Cycle 6.5a.1 added two phrasing variants (`self`, `focus`) per
 * the in-situ eval push: self-personalization for user-subject
 * insights, action-register for Suggested Focus.
 *
 * The PRODUCT.md §9 revisit-trigger still applies: any user calling
 * the prose "templated/robotic" unprompted, or the same phrasing
 * firing twice within 14d for the same user/trigger, reopens this.
 */

import type { TriggerId } from "../triggers/types";
import type { Phrasing, ProseLibrary } from "./types";
import { blockedProse } from "./blocked";
import { overdueProse } from "./overdue";
import { overloadProse } from "./overload";
import { dependencyStallProse } from "./dependency-stall";
import { momentumPositiveProse } from "./momentum-positive";
import { streakProse } from "./streak";
import { inactiveProjectProse } from "./inactive-project";
import { singlePointOfFailureProse } from "./single-point-of-failure";
import { slowBurnDeadlineProse } from "./slow-burn-deadline";
import { unresolvedRecurringBlockProse } from "./unresolved-recurring-block";

export const PROSE_LIBRARIES: Record<TriggerId, ProseLibrary> = {
  "blocked": blockedProse,
  "overdue": overdueProse,
  "overload": overloadProse,
  "dependency-stall": dependencyStallProse,
  "momentum-positive": momentumPositiveProse,
  "streak": streakProse,
  "inactive-project": inactiveProjectProse,
  "single-point-of-failure": singlePointOfFailureProse,
  "slow-burn-deadline": slowBurnDeadlineProse,
  "unresolved-recurring-block": unresolvedRecurringBlockProse,
};

/** Phrasing register selected by the renderer. */
export type ProseVariant = "default" | "self" | "focus";

/**
 * Pick a phrasing for a trigger.
 *
 * Variant selection (in priority order):
 *   - `focus` → use `focusPhrasings` if authored; else fall back to default
 *   - `self`  → use `selfPhrasings` if authored; else fall back to default
 *   - `default` → use `phrasings`
 *
 * Round-robin within the chosen array via the caller-provided
 * rotationIndex. Returns null if no phrasing exists in the chosen
 * array (a trigger fired without prose to render is a code-review miss).
 */
export function pickPhrasing(
  triggerId: TriggerId,
  rotationIndex: number,
  variant: ProseVariant = "default",
): Phrasing | null {
  const lib = PROSE_LIBRARIES[triggerId];
  if (!lib) return null;

  let candidates: Phrasing[] | undefined;
  if (variant === "focus") candidates = lib.focusPhrasings;
  else if (variant === "self") candidates = lib.selfPhrasings;
  if (!candidates || candidates.length === 0) candidates = lib.phrasings;
  if (candidates.length === 0) return null;

  const safeIndex = ((rotationIndex % candidates.length) + candidates.length) % candidates.length;
  return candidates[safeIndex] ?? null;
}
