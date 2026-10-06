/**
 * The board's view of the demo store. Every card is a store task, mapped to
 * the board's own shape here; nothing is copied or kept apart. The board adds
 * only what is its own: the drawn covers on a few cards, and where each card
 * has been (read from the store's event log, for the column lines and the replay).
 */

import {
  TODAY as STORE_TODAY,
  daysBetween,
  lastMoved,
  personById,
  waitingOnName,
  type ProjectId,
  type TaskEvent,
  type Task as StoreTask,
} from "../../demo/store";

import { liveProject } from "../../tasks/projects";

export const TODAY = STORE_TODAY;

export type StageKey = "todo" | "doing" | "review" | "waiting" | "done";

export type Stage = {
  key: StageKey;
  name: string;
  /** One quiet line for the empty column. */
  empty: string;
};

export const STAGES: Stage[] = [
  { key: "todo", name: "To do", empty: "Nothing queued. Add the next thing the team should pick up." },
  { key: "doing", name: "In progress", empty: "No one is working on anything yet. Drag a task here when you start it." },
  { key: "waiting", name: "Waiting", empty: "Nothing is held up. Drop a task here when it is waiting on a reply or delivery." },
  { key: "review", name: "To check", empty: "Nothing to check. Move a task here when it needs a second pair of eyes." },
  { key: "done", name: "Done", empty: "Finished work lands here." },
];

export type Person = {
  id: string;
  name: string;
  first: string;
  initials: string;
  /** Avatar ground: a v3 project identity token (white initials pass AA). */
  tone: string;
  role: string;
  guest?: boolean;
};

/** 0 none, 1 low, 2 medium, 3 high, 4 urgent. */
export type Priority = 0 | 1 | 2 | 3 | 4;

export type CoverKind = "plan" | "sheet" | "menu" | "poster" | "map";

export type Cover = { kind: CoverKind; caption: string; from: string; to: string };

export type Subtask = { id: string; text: string; done: boolean };

export type Label = { name: string; tone: string };

/** A stage the task entered, and when: days from today (0 = today, -1 = yesterday). */
export type Move = { stage: StageKey; day: number };

export type Task = {
  id: string;
  title: string;
  stage: StageKey;
  due?: string;
  priority: Priority;
  /** The project, as a label. */
  label?: Label;
  project: ProjectId;
  /** The owner first, then anyone helping. */
  people: string[];
  subtasks?: Subtask[];
  cover?: Cover;
  heldBy?: string;
  description?: string;
  doneAt?: string;
  /** Every stage the task has been in. Drives the flow strip, ages and replay. */
  history?: Move[];
  /** The store task this card shows. */
  src: StoreTask;
};

const tone = (hue?: number) => `var(--v3-project-${hue ?? 2})`;

/** Anyone in the store, as an avatar. Clients are guests. */
export function boardPerson(id: string): Person | undefined {
  const p = personById(id);
  if (!p) return undefined;
  return { id: p.id, name: p.name, first: p.first, initials: p.initials, tone: tone(p.hue), role: p.role, guest: !!p.external };
}

const PRIORITY: Record<StoreTask["priority"], Priority> = { none: 0, low: 1, medium: 2, high: 3, urgent: 4 };

/** The few cards that carry drawn art, by task id. */
const COVERS: Record<string, Omit<Cover, "from" | "to"> & { hues: [number, number] }> = {
  "mf-4": { kind: "menu", caption: "Tasting menu, draft 2", hues: [9, 4] },
  "mf-41": { kind: "sheet", caption: "Run-sheet v2", hues: [1, 2] },
  "mf-21": { kind: "plan", caption: "Seating plan v4", hues: [3, 4] },
  "wl-5": { kind: "poster", caption: "Winter brochure v2", hues: [4, 3] },
  "br-8": { kind: "map", caption: "Underfloor heating plan", hues: [2, 1] },
};

/**
 * Where a task has been, from the store's event log: the status it was
 * created in, then every status change, one per day (the last move of a day
 * wins, like the store's replay). Without events it falls back to the task's
 * own dates.
 */
function historyOf(t: StoreTask, events?: readonly TaskEvent[]): Move[] {
  if (events?.length) {
    const out: Move[] = [];
    for (const e of events) {
      if ((e.kind !== "created" && e.kind !== "status") || !e.to) continue;
      const day = Math.min(daysBetween(TODAY, e.on), 0);
      const stage = e.to as StageKey;
      if (out.length && out[out.length - 1].day === day) out[out.length - 1] = { stage, day };
      else out.push({ stage, day });
    }
    if (out.length) return out;
  }
  const born = daysBetween(TODAY, t.created);
  if (t.status === "todo") return [{ stage: "todo", day: Math.min(born, 0) }];
  const moved = daysBetween(TODAY, t.status === "done" && t.doneOn ? t.doneOn : lastMoved(t));
  if (moved <= born) return [{ stage: t.status, day: Math.min(moved, 0) }];
  return [
    { stage: "todo", day: born },
    { stage: t.status, day: Math.min(moved, 0) },
  ];
}

/** A store task as a card. Pass its events (`historyFor`) so the replay and the column lines follow what really happened. */
export function toBoardTask(t: StoreTask, events?: readonly TaskEvent[]): Task {
  const p = liveProject(t.project);
  const cover = COVERS[t.id];
  return {
    id: t.id,
    title: t.title,
    stage: t.status,
    due: t.due,
    priority: PRIORITY[t.priority],
    label: p ? { name: p.short, tone: tone(p.hue) } : undefined,
    project: t.project,
    people: [t.owner, ...(t.helpers ?? []).filter((h) => h !== t.owner)],
    subtasks: t.subtasks?.map((s) => ({ id: s.id, text: s.title, done: s.done })),
    cover: cover ? { kind: cover.kind, caption: cover.caption, from: tone(cover.hues[0]), to: tone(cover.hues[1]) } : undefined,
    heldBy: t.status === "waiting" ? waitingOnName(t) : undefined,
    description: t.notes,
    doneAt: t.doneOn,
    history: historyOf(t, events),
    src: t,
  };
}
