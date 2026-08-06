import type { AudienceItemState, AudienceKind } from "./audience-timeline";

/**
 * One vocabulary for one state machine.
 *
 * A shared milestone has five states and they were named three different ways
 * by three files that all read the same column: the Milestones editor offered
 * "Complete / Now / Next / Later / Not going ahead", the publish step offered
 * "Covered / Now / Next / Later / Cancelled", the published payload carried a
 * fourth copy of the second set, and the artifact's rail spoke a fifth
 * ("Coming up"). An owner could set a milestone to "Not going ahead" in one
 * screen, see it as "Cancelled" in the next, and hand a guest a page that said
 * something else again. Nothing was out of sync technically; the product was
 * simply speaking about itself in more than one language.
 *
 * So the words live here, once, and every surface imports them: the editor,
 * the publish step, the frozen payload and the artifact. Adding a state means
 * adding a word here — `Record<AudienceItemState, string>` will not compile
 * without one.
 *
 * The register is the reader's, not the schema's. "Covered" is a storage word
 * that means nothing to a person reading their own wedding plan; "Complete"
 * is the word they would use. Sentence case throughout, because these are read
 * as short sentences on pages ordinary people receive and not as column
 * headings in a console.
 *
 * Kept deliberately small. Turbopack inlines a module this size into every
 * route tree that reaches it rather than hoisting one copy — the behaviour
 * already recorded for `app/audience/share-controls.tsx` — so every string
 * here is paid for five times over. Type-only imports for the same class of
 * reason: `audience-timeline.ts` reaches for node:crypto to hash frozen items,
 * and this module is imported by client components.
 */

/** The five states a shared milestone can be in, in the reader's words. */
export const MILESTONE_STATE_LABELS: Readonly<Record<AudienceItemState, string>> = {
  covered: "Complete",
  now: "Happening now",
  next: "Next",
  later: "Later",
  cancelled: "Not going ahead",
};

/**
 * The same five, shaped for a lane list or a select, in publishing order.
 * The order is the labels' own key order, so a plan cannot be grouped one way
 * for the owner and another way for a guest.
 */
export const MILESTONE_STATE_OPTIONS: ReadonlyArray<
  Readonly<{ value: AudienceItemState; label: string }>
> = (Object.keys(MILESTONE_STATE_LABELS) as AudienceItemState[]).map((value) => ({
  value,
  label: MILESTONE_STATE_LABELS[value],
}));

/**
 * The two states the rail derives rather than stores: the milestone a plan is
 * standing on, and the same milestone when its date has passed. Lateness
 * changes what the sentence says, never which milestone it is about.
 *
 * "Our next milestone" is the shared page's voice — a guest is being shown a
 * plan somebody is keeping, and the artifact says so in the first person
 * plural everywhere it names this milestone: on the rail, in the Today
 * marker's spoken label, and in the keyboard instructions.
 */
export const MILESTONE_RAIL_LABELS = {
  current: "Our next milestone",
  overdue: "Our next milestone, overdue",
} as const;

/**
 * The one word each audience uses for the thing being planned. "module" is the
 * storage enum, never viewer vocabulary — a bakery's plan must not introduce
 * itself with campus wording.
 */
const TIMELINE_SUBJECTS: Readonly<Record<AudienceKind, string>> = {
  couple: "wedding",
  class: "class",
  module: "project",
};

const COUPLE_PURPOSE = "Every decision, visit and small moment on the way to the day.";
const PLAN_PURPOSE = "A clear view of what is complete and what comes next.";

/**
 * How the artifact names itself. The kicker, the section heading a screen
 * reader announces and the purpose line under the name all derive from one
 * subject word, so the artifact cannot call itself a wedding timeline in the
 * headline and a project timeline six lines later — which is exactly what it
 * did, because the heading was the only one of the three that was not
 * audience-aware.
 */
export function timelineNouns(kind: AudienceKind): Readonly<{
  kicker: string;
  heading: string;
  purpose: string;
}> {
  const subject = TIMELINE_SUBJECTS[kind] ?? TIMELINE_SUBJECTS.module;
  return {
    kicker: `A shared ${subject} timeline`,
    heading: `${subject[0].toUpperCase()}${subject.slice(1)} timeline`,
    purpose: kind === "couple" ? COUPLE_PURPOSE : PLAN_PURPOSE,
  };
}

/** The structural noun for the container: milestones sit in a plan. */
export const PLACE_IN_PLAN_LABEL = "Place in the plan";

/** What a milestone with no date says, everywhere it has to say it. */
export const NO_TIMING_LABEL = "Timing not set";

/**
 * "Milestone 3 of 9", written once. The sequence card, the reading panel and
 * every mark's accessible name all state a milestone's place in the plan, and
 * they used to build that sentence separately.
 */
export function milestonePlace(ordinal: number, total: number): string {
  return `Milestone ${ordinal} of ${total}`;
}

/** "1 of 10 milestones", agreeing with its own count. */
export function milestoneCountPhrase(count: number, total: number): string {
  return `${count} of ${total} ${total === 1 ? "milestone" : "milestones"}`;
}
