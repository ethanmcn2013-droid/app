"use client";

/**
 * Nudges, backed by the demo store's event log. A nudge is a `nudged` event
 * on the task (so it is one step on the shared undo stack and shows in the
 * task's history), and "Nudged today" is any such event dated today. A nudge
 * from the board therefore reads "Nudged today" on the list and the calendar.
 */

import { TODAY, nameOf, personById, waitingOnName, type DemoState, type Task } from "../demo/store";
import { nudgeTask, useDemoStore } from "../demo/store/client";

/** Ids of tasks nudged today, from the event log. */
export function nudgedToday(s: DemoState): Set<string> {
  const out = new Set<string>();
  for (const e of s.history) if (e.kind === "nudged" && e.on === TODAY) out.add(e.taskId);
  return out;
}

const sameSet = (a: ReadonlySet<string>, b: ReadonlySet<string>) => a.size === b.size && [...a].every((x) => b.has(x));

let last: ReadonlySet<string> = new Set();
const stable = (s: DemoState) => {
  const next = nudgedToday(s);
  if (!sameSet(next, last)) last = next;
  return last;
};

export function useNudged(): ReadonlySet<string> {
  return useDemoStore(stable);
}

/** Who a nudge for this task goes to: who it waits on, or its owner. */
export function nudgeWho(t: Task): string {
  if (t.status === "waiting" && t.waitingOn) return waitingOnName(t) ?? nameOf(t.waitingOn.who);
  return personById(t.owner)?.first ?? "them";
}

/** Nudge through the store and return the confirmation for a toast. */
export function nudge(t: Task): string {
  nudgeTask(t.id);
  return `Nudge sent to ${nudgeWho(t)}. We will not nudge again before Monday.`;
}
