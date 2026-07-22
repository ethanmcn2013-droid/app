import type { TaskSignal, TriggerKind } from "./types";

/**
 * Prose phrasings, three per trigger for v1. Rotation by index is
 * applied per (user, day) via a stable hash in build.ts so users
 * don't get the same phrasing two days running.
 *
 * Voice rules (from docs/COLLABORATION_LOOP.md):
 *  - Plain English.
 *  - Never chart language.
 *  - Always has a clear "so what".
 *  - No percentages without an action.
 */

type Phrasing = (
  task: TaskSignal,
  days?: number,
  /** Resolved upstream blocker titles in order. Empty → no
   *  named blocker (generic fallback prose). One title → "X". Two
   *  titles → "X and Y" (both named, conversational). Three+ →
   *  "X and N more" (named lead + count). */
  byTitles?: string[],
) => string;

const STUCK: Phrasing[] = [
  (t, days = 0) => `${t.title} has been held up since ${ago(days)}`,
  (t, days = 0) => `${t.title} hasn't moved in ${plural(days, "day", "days")}`,
  (t, days = 0) => `${t.title} is sitting open, ${ago(days)}`,
];

const DUE_SOON: Phrasing[] = [
  (t, daysOut = 0) =>
    daysOut < 0
      ? `${t.title} is ${plural(Math.abs(daysOut), "day", "days")} overdue`
      : daysOut < 1
        ? `${t.title} is due today`
        : `${t.title} needs to land ${byWhen(daysOut)}`,
  (t, daysOut = 0) =>
    daysOut < 0
      ? `${t.title} slipped past its date ${plural(Math.abs(daysOut), "day", "days")} ago`
      : `${t.title} comes due ${byWhen(daysOut)}`,
  (t, daysOut = 0) =>
    daysOut < 0
      ? `${t.title} is overdue by ${plural(Math.abs(daysOut), "day", "days")}`
      : daysOut < 1
        ? `${t.title} closes today`
        : `${t.title} is up ${byWhen(daysOut)}`,
];

const JUST_SHIPPED: Phrasing[] = [
  (t) => `${t.title} landed`,
  (t) => `${t.title}, done`,
  (t) => `${t.title} closed out`,
];

const OVERLOAD: Phrasing[] = [
  (t) => `Too much in flight, ${t.title.toLowerCase()}`,
  (t) => `${t.title.toLowerCase()}, that's heavy for one person`,
  (t) => `Cognitive load is high, ${t.title.toLowerCase()}`,
];

const CROWDED_WEEK: Phrasing[] = [
  (t) => `Heavy week, ${t.title.toLowerCase()}`,
  (t) => `${t.title.toLowerCase()}, plan the week early`,
  (t) => `A pile-up is forming, ${t.title.toLowerCase()}`,
];

// Build the blocker subject string. Centralised so all three
// phrasings produce consistent multi-blocker form.
//   0 titles  → null (generic fallback)
//   1 title   → "X"
//   2 titles  → "X and Y"            (both named, conversational)
//   3+ titles → "X and 2 more"       (lead + count)
function blockerSubject(titles: string[]): string | null {
  if (titles.length === 0) return null;
  if (titles.length === 1) return titles[0];
  if (titles.length === 2) return `${titles[0]} and ${titles[1]}`;
  return `${titles[0]} and ${titles.length - 1} more`;
}

const BLOCKED_TOO_LONG: Phrasing[] = [
  (t, days = 0, byTitles = []) => {
    const subject = blockerSubject(byTitles);
    return subject
      ? `${t.title} has been blocked by ${subject} for ${plural(days, "day", "days")}`
      : `${t.title} has been waiting for ${plural(days, "day", "days")}`;
  },
  (t, days = 0, byTitles = []) => {
    const subject = blockerSubject(byTitles);
    return subject
      ? `${t.title} is waiting on ${subject}, ${plural(days, "day", "days")} now`
      : `${t.title} is waiting on something, ${plural(days, "day", "days")} now`;
  },
  (t, days = 0, byTitles = []) => {
    const subject = blockerSubject(byTitles);
    return subject
      ? `${t.title} hasn't cleared ${subject} in ${plural(days, "day", "days")}`
      : `${t.title} hasn't cleared its blocker in ${plural(days, "day", "days")}`;
  },
];

const LIBRARY: Record<TriggerKind, Phrasing[]> = {
  "stuck-work": STUCK,
  "due-soon": DUE_SOON,
  "just-shipped": JUST_SHIPPED,
  overload: OVERLOAD,
  "crowded-week": CROWDED_WEEK,
  "blocked-too-long": BLOCKED_TOO_LONG,
};

export function phraseFor(
  trigger: TriggerKind,
  task: TaskSignal,
  rotationIndex: number,
  context?: {
    idleDays?: number;
    daysOut?: number;
    /** Resolved titles of upstream blocker tasks (in order). Only
     *  the first is used today; future phrasings may enumerate. */
    blockedByTitles?: string[];
  },
): string {
  const options = LIBRARY[trigger];
  const phrasing = options[rotationIndex % options.length];
  if (trigger === "stuck-work")
    return phrasing(task, context?.idleDays ?? task.idleDays);
  if (trigger === "due-soon") return phrasing(task, context?.daysOut ?? 0);
  if (trigger === "blocked-too-long") {
    return phrasing(
      task,
      context?.idleDays ?? task.idleDays,
      context?.blockedByTitles ?? [],
    );
  }
  return phrasing(task);
}

// ─────────────────────────────────────────────────────────────
// helpers, kept terse, prose lives in the phrasings themselves
// ─────────────────────────────────────────────────────────────

function plural(n: number, single: string, many: string): string {
  return `${Math.round(n)} ${Math.round(n) === 1 ? single : many}`;
}

function ago(days: number): string {
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 7) return `${days} days ago`;
  if (days < 14) return "over a week ago";
  if (days < 30) return `${Math.round(days / 7)} weeks ago`;
  return `${Math.round(days / 30)} months ago`;
}

function byWhen(daysOut: number): string {
  if (daysOut < 1) return "today";
  if (daysOut < 2) return "tomorrow";
  if (daysOut < 5) return `in ${Math.round(daysOut)} days`;
  if (daysOut < 8) return "this week";
  if (daysOut < 15) return "next week";
  return `in ${Math.round(daysOut / 7)} weeks`;
}
