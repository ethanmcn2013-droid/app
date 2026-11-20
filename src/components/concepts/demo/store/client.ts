"use client";

/**
 * The live demo store: the canonical state in memory, with edits, undo and a
 * copy in sessionStorage so a change made on the board shows on the list and
 * the calendar after navigating, and survives a reload during a review.
 *
 *   const late = useDemoStore((s) => lateTasks(s, { project: "mara-finn" }));
 *   updateTask("mf-12", { status: "done" });
 *   updateProject("harvest", { health: "at_risk", healthReason: "Tickets are slow." });
 *
 * Every edit, to a task or a project, goes through one undo stack and writes
 * its event to the history with today's date and the viewer's name.
 *
 * The server renders from INITIAL_STATE (getServerSnapshot), and the browser
 * switches to the saved state after hydration, so there is no mismatch.
 */

import { useMemo, useSyncExternalStore } from "react";

import { CALENDAR_OWNER, DATA_VERSION, INITIAL_STATE, VIEWER } from "./data";
import { TODAY } from "./dates";
import { seedProject, type NewProject } from "./templates";
import type { Block, DemoState, Health, Milestone, Project, ProjectEvent, ProjectId, ProjectUpdate, Task, TaskEvent } from "./types";

const STORAGE_KEY = "signal-demo-store";
const UNDO_LIMIT = 40;

/** The state's lists, in the order they are packed for storage. */
const KEYS = ["tasks", "blocks", "history", "projects", "projectEvents", "updates"] as const;
type Key = (typeof KEYS)[number];

/**
 * Saved form. Snapshots share most of their records, so each record is
 * stored once in `pool` and each snapshot is a list of indices per key.
 * Negative indices point into the canonical state, which is never stored.
 */
type Saved = { version: string; pool: unknown[]; snaps: number[][][] };

let state: DemoState | null = null;
let past: DemoState[] = [];
const listeners = new Set<() => void>();

/** Every canonical record, with its negative index. */
let canonical: { list: unknown[]; index: Map<unknown, number> } | null = null;
function canon() {
  if (!canonical) {
    const list: unknown[] = KEYS.flatMap((k) => INITIAL_STATE[k] as unknown[]);
    canonical = { list, index: new Map(list.map((x, i) => [x, -(i + 1)])) };
  }
  return canonical;
}

function pack(states: DemoState[]): Saved {
  const { index: fixed } = canon();
  const index = new Map<unknown, number>();
  const pool: unknown[] = [];
  const snaps = states.map((st) =>
    KEYS.map((k) =>
      (st[k] as unknown[]).map((x) => {
        const c = fixed.get(x);
        if (c !== undefined) return c;
        let i = index.get(x);
        if (i === undefined) {
          i = pool.length;
          pool.push(x);
          index.set(x, i);
        }
        return i;
      }),
    ),
  );
  return { version: DATA_VERSION, pool, snaps };
}

function unpack(saved: Saved): DemoState[] | null {
  const { list } = canon();
  if (!Array.isArray(saved.pool) || !Array.isArray(saved.snaps) || saved.snaps.length === 0) return null;
  const at = (i: number) => (i < 0 ? list[-i - 1] : saved.pool[i]);
  const out: DemoState[] = [];
  for (const snap of saved.snaps) {
    if (!Array.isArray(snap) || snap.length !== KEYS.length) return null;
    const st = {} as Record<Key, unknown[]>;
    KEYS.forEach((k, n) => {
      st[k] = (snap[n] as number[]).map(at);
    });
    if (KEYS.some((k) => st[k].some((x) => x === undefined))) return null;
    out.push(st as unknown as DemoState);
  }
  return out;
}

function load(): void {
  state = INITIAL_STATE;
  past = [];
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const saved = JSON.parse(raw) as Saved;
    if (saved?.version !== DATA_VERSION) return;
    const states = unpack(saved);
    if (!states) return;
    state = states[states.length - 1];
    past = states.slice(0, -1);
  } catch {
    // Private windows and blocked storage: start from the canonical state.
  }
}

function current(): DemoState {
  if (state === null) {
    if (typeof window === "undefined") return INITIAL_STATE;
    load();
  }
  return state as DemoState;
}

function persist(): void {
  try {
    if (state === INITIAL_STATE && past.length === 0) window.sessionStorage.removeItem(STORAGE_KEY);
    else window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(pack([...past, current()])));
  } catch {
    // Storage full or blocked: the change still holds for this page.
  }
}

function emit(): void {
  for (const l of listeners) l();
}

function commit(next: DemoState): void {
  const prev = current();
  if (next === prev) return;
  past = [...past, prev].slice(-UNDO_LIMIT);
  state = next;
  persist();
  emit();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

const getServerSnapshot = () => INITIAL_STATE;

/* ── Hooks ──────────────────────────────────────────────────────────── */

/**
 * Read the live state through a selector. The selector may build new arrays
 * or objects: it reruns only when the state or the selector changes.
 */
export function useDemoStore<T>(selector: (s: DemoState) => T): T {
  const snapshot = useSyncExternalStore(subscribe, current, getServerSnapshot);
  return useMemo(() => selector(snapshot), [snapshot, selector]);
}

/** Whether there is anything to undo, for an Undo button or toast. */
export function useCanUndo(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => {
      current();
      return past.length > 0;
    },
    () => false,
  );
}

/** Read the live state outside React, e.g. in an event handler. */
export function getDemoState(): DemoState {
  return current();
}

/* ── Task mutations ─────────────────────────────────────────────────── */

export type TaskPatch = Partial<Omit<Task, "id">>;

const ev = (taskId: string, kind: TaskEvent["kind"], extra: Partial<TaskEvent> = {}): TaskEvent => ({ taskId, on: TODAY, kind, by: VIEWER, ...extra });

/** The events one edit writes, in the order they happened. */
function eventsFor(prev: Task, next: Task): TaskEvent[] {
  const out: TaskEvent[] = [];
  if (next.status !== prev.status) out.push(ev(prev.id, "status", { from: prev.status, to: next.status }));
  if (next.status === "waiting" && next.waitingOn && next.waitingOn.who !== (prev.status === "waiting" ? prev.waitingOn?.who : undefined))
    out.push(ev(prev.id, "waiting", { to: next.waitingOn.who }));
  if (next.owner !== prev.owner) out.push(ev(prev.id, "owner", { from: prev.owner, to: next.owner }));
  if (next.due !== prev.due) out.push(ev(prev.id, "due", { from: prev.due, to: next.due }));
  if (next.priority !== prev.priority) out.push(ev(prev.id, "priority", { from: prev.priority, to: next.priority }));
  if ((next.notes ?? "") !== (prev.notes ?? "")) out.push(ev(prev.id, "note", { note: next.notes }));
  return out;
}

/**
 * Change a task. Keeps the record honest: a status change stamps `since`
 * with today, Done stamps `doneOn`, leaving Done clears it, and leaving
 * Waiting clears `waitingOn` unless the patch sets them. Each change writes
 * its event to the history (status, owner, due, priority, waiting, note).
 */
export function updateTask(id: string, patch: TaskPatch): void {
  const s = current();
  const prev = s.tasks.find((t) => t.id === id);
  if (!prev) return;
  const next: Task = { ...prev, ...patch };
  if (patch.status && patch.status !== prev.status) {
    if (!("since" in patch)) next.since = TODAY;
    if (patch.status === "done" && !patch.doneOn) next.doneOn = TODAY;
    if (patch.status !== "done" && !("doneOn" in patch)) delete next.doneOn;
    if (patch.status !== "waiting" && !("waitingOn" in patch)) delete next.waitingOn;
  }
  const events = eventsFor(prev, next);
  commit({ ...s, tasks: s.tasks.map((t) => (t.id === id ? next : t)), history: events.length ? [...s.history, ...events] : s.history });
}

export type NewTask = Pick<Task, "title" | "project"> & Partial<Omit<Task, "title" | "project">>;

const projectOf = (s: DemoState, id: string): Project | undefined => s.projects.find((p) => p.id === id);

/** The next free id in a project: "mf-45". */
function nextId(s: DemoState, project: ProjectId): string {
  const prefix = projectOf(s, project)?.prefix ?? project;
  const max = s.tasks
    .filter((t) => t.id.startsWith(`${prefix}-`))
    .reduce((m, t) => Math.max(m, Number(t.id.slice(prefix.length + 1)) || 0), 0);
  return `${prefix}-${max + 1}`;
}

/**
 * Add a task. Only a title and a project are needed: it lands in To do,
 * owned by the viewer, in the project's first workstream, created today.
 * Returns the new id.
 */
export function addTask(input: NewTask): string {
  const s = current();
  const p = projectOf(s, input.project);
  const id = input.id && !s.tasks.some((t) => t.id === input.id) ? input.id : nextId(s, input.project);
  const task: Task = {
    status: "todo",
    owner: VIEWER,
    workstream: p?.workstreams[0]?.id ?? "plan",
    priority: "none",
    created: TODAY,
    since: TODAY,
    ...input,
    id,
  };
  if (task.status === "done" && !task.doneOn) task.doneOn = TODAY;
  const events = [ev(id, "created", { to: task.status })];
  if (task.status === "waiting" && task.waitingOn) events.push(ev(id, "waiting", { to: task.waitingOn.who }));
  commit({ ...s, tasks: [...s.tasks, task], history: [...s.history, ...events] });
  return id;
}

/** Remove a task and any calendar blocks for it. The history keeps its events and a "removed" one. */
export function removeTask(id: string): void {
  const s = current();
  if (!s.tasks.some((t) => t.id === id)) return;
  commit({
    ...s,
    tasks: s.tasks.filter((t) => t.id !== id),
    blocks: s.blocks.filter((b) => b.taskId !== id),
    history: [...s.history, ev(id, "removed")],
  });
}

/** Record a nudge on a task: to who it waits on, or its owner. */
export function nudgeTask(id: string, note?: string): void {
  const s = current();
  const t = s.tasks.find((x) => x.id === id);
  if (!t) return;
  const to = t.status === "waiting" && t.waitingOn ? t.waitingOn.who : t.owner;
  commit({ ...s, history: [...s.history, ev(id, "nudged", { to, ...(note ? { note } : {}) })] });
}

/** Add a note to a task's history without changing the task. */
export function noteTask(id: string, note: string): void {
  const s = current();
  if (!note.trim() || !s.tasks.some((t) => t.id === id)) return;
  commit({ ...s, history: [...s.history, ev(id, "note", { note: note.trim() })] });
}

export type BlockInput = Omit<Block, "id" | "person"> & Partial<Pick<Block, "id" | "person">>;

/**
 * Place one block, or several as one undo step (Make Friday fit). A block
 * with an existing id moves; one without gets a new id. Returns the ids.
 */
export function scheduleBlock(input: BlockInput | BlockInput[]): string[] {
  const s = current();
  const list = Array.isArray(input) ? input : [input];
  const blocks = s.blocks.slice();
  const ids: string[] = [];
  let seq = blocks.length;
  for (const b of list) {
    if (!s.tasks.some((t) => t.id === b.taskId)) continue;
    let id = b.id;
    if (!id || !blocks.some((x) => x.id === id)) {
      do {
        seq += 1;
        id = `blk-${b.taskId}-${seq}`;
      } while (blocks.some((x) => x.id === id));
    }
    const block: Block = { person: CALENDAR_OWNER, ...b, id };
    const at = blocks.findIndex((x) => x.id === id);
    if (at >= 0) blocks[at] = block;
    else blocks.push(block);
    ids.push(id);
  }
  if (ids.length) commit({ ...s, blocks });
  return ids;
}

/** Take one block, or several, off the calendar as one undo step. */
export function unscheduleBlock(id: string | string[]): void {
  const s = current();
  const drop = new Set(Array.isArray(id) ? id : [id]);
  if (!s.blocks.some((b) => drop.has(b.id))) return;
  commit({ ...s, blocks: s.blocks.filter((b) => !drop.has(b.id)) });
}

/* ── Project mutations ──────────────────────────────────────────────── */

export type ProjectPatch = Partial<Pick<Project, "health" | "healthReason" | "lead" | "date" | "end" | "note" | "name" | "short">>;

const pev = (projectId: ProjectId, kind: ProjectEvent["kind"], extra: Partial<ProjectEvent> = {}): ProjectEvent => ({
  projectId,
  on: TODAY,
  kind,
  by: VIEWER,
  ...extra,
});

let updateSeq = 0;
function newUpdate(s: DemoState, projectId: ProjectId, text: string, kind: ProjectUpdate["kind"]): ProjectUpdate {
  let id: string;
  do {
    updateSeq += 1;
    id = `upd-${s.updates.length + updateSeq}`;
  } while (s.updates.some((u) => u.id === id));
  return { id, projectId, on: TODAY, by: VIEWER, text, kind };
}

function replaceProject(s: DemoState, next: Project): Project[] {
  return s.projects.map((p) => (p.id === next.id ? next : p));
}

/**
 * Change a project: health, reason, lead, date, end, note, name. At risk and
 * Off track need a reason: a move to either without one (in the patch, or
 * already stored for that same health) is refused and returns false. On
 * track clears the reason. Health changes and reason changes write a
 * "health" event and post the reason to the updates feed; lead, date and
 * note changes write their own events. One undo step.
 */
export function updateProject(id: string, patch: ProjectPatch): boolean {
  const s = current();
  const prev = projectOf(s, id);
  if (!prev) return false;
  const next: Project = { ...prev, ...patch };
  const events: ProjectEvent[] = [];
  const updates: ProjectUpdate[] = [];
  const pid = prev.id;

  const health: Health = next.health;
  if (health === "on_track") {
    delete next.healthReason;
    if (prev.health !== "on_track") {
      const reason = patch.healthReason?.trim() || "Back on track.";
      events.push(pev(pid, "health", { from: prev.health, to: health, reason }));
      updates.push(newUpdate(s, pid, reason, "health"));
    }
  } else {
    const given = patch.healthReason?.trim();
    const reason = given || (health === prev.health ? prev.healthReason : undefined);
    if (!reason) return false;
    next.healthReason = reason;
    if (health !== prev.health || reason !== prev.healthReason) {
      events.push(pev(pid, "health", { from: prev.health, to: health, reason }));
      updates.push(newUpdate(s, pid, reason, "health"));
    }
  }
  if (next.lead !== prev.lead) {
    events.push(pev(pid, "lead", { from: prev.lead, to: next.lead }));
    if (!next.people.includes(next.lead)) next.people = [...next.people, next.lead];
  }
  if (next.date !== prev.date) events.push(pev(pid, "date", { from: prev.date, to: next.date }));
  if (next.end !== prev.end) events.push(pev(pid, "date", { from: prev.end, to: next.end, reason: "end" }));
  if (next.note !== prev.note) events.push(pev(pid, "note", { from: prev.note, to: next.note }));

  const changed = (Object.keys(patch) as (keyof ProjectPatch)[]).some((k) => next[k] !== prev[k]) || events.length > 0;
  if (!changed) return true;
  commit({
    ...s,
    projects: replaceProject(s, next),
    projectEvents: events.length ? [...s.projectEvents, ...events] : s.projectEvents,
    updates: updates.length ? [...s.updates, ...updates] : s.updates,
  });
  return true;
}

/** Tick or untick a milestone. */
export function setMilestone(projectId: string, milestoneId: string, done: boolean): void {
  const s = current();
  const p = projectOf(s, projectId);
  const m = p?.milestones.find((x) => x.id === milestoneId);
  if (!p || !m || m.done === done) return;
  const next: Project = { ...p, milestones: p.milestones.map((x) => (x.id === milestoneId ? { ...x, done } : x)) };
  commit({
    ...s,
    projects: replaceProject(s, next),
    projectEvents: [...s.projectEvents, pev(p.id, "milestone", { to: m.id, reason: done ? "done" : "open", text: m.title })],
  });
}

/** Add a milestone. Returns its id, or "" when the project does not exist. */
export function addMilestone(projectId: string, input: { title: string; date: string; done?: boolean }): string {
  const s = current();
  const p = projectOf(s, projectId);
  if (!p) return "";
  let n = p.milestones.length + 1;
  while (p.milestones.some((m) => m.id === `${p.prefix}-m${n}`) || s.projects.some((x) => x.milestones.some((m) => m.id === `${p.prefix}-m${n}`))) n += 1;
  const m: Milestone = { id: `${p.prefix}-m${n}`, title: input.title, date: input.date, done: !!input.done };
  const milestones = [...p.milestones, m].sort((a, b) => a.date.localeCompare(b.date));
  commit({
    ...s,
    projects: replaceProject(s, { ...p, milestones }),
    projectEvents: [...s.projectEvents, pev(p.id, "milestone", { to: m.id, reason: "added", text: m.title })],
  });
  return m.id;
}

/** Post to a project's updates feed, as the viewer, today. Returns the update's id. */
export function postUpdate(projectId: string, text: string): string {
  const s = current();
  const p = projectOf(s, projectId);
  const body = text.trim();
  if (!p || !body) return "";
  const u = newUpdate(s, p.id, body, "update");
  commit({
    ...s,
    updates: [...s.updates, u],
    projectEvents: [...s.projectEvents, pev(p.id, "update", { to: u.id, text: body })],
  });
  return u.id;
}

/** Wrap a project up: it leaves the active list; its task records stay and still count for it. */
export function wrapProject(id: string, stat?: string): void {
  const s = current();
  const p = projectOf(s, id);
  if (!p || p.wrapped) return;
  const tasks = s.tasks.filter((t) => t.project === p.id);
  const done = tasks.filter((t) => t.status === "done").length;
  const line = stat ?? `${done} of ${tasks.length} tasks`;
  const u = newUpdate(s, p.id, `Wrapped: ${line}.`, "wrapped");
  commit({
    ...s,
    projects: replaceProject(s, { ...p, wrapped: { on: TODAY, tasks: tasks.length, stat: line } }),
    projectEvents: [...s.projectEvents, pev(p.id, "wrapped", { text: line })],
    updates: [...s.updates, u],
  });
}

/** Bring a wrapped project back to the active list. */
export function unwrapProject(id: string): void {
  const s = current();
  const p = projectOf(s, id);
  if (!p || !p.wrapped) return;
  const next: Project = { ...p };
  delete next.wrapped;
  commit({ ...s, projects: replaceProject(s, next), projectEvents: [...s.projectEvents, pev(p.id, "unwrapped")] });
}

export type { NewProject };

/**
 * Create a project and seed it from a template ("wedding", "party",
 * "corporate", "works", "school", "campaign"; "tpl-" ids work too) with real
 * starter tasks, owners and due dates counted back from its date. One undo
 * step. Returns the new project's id.
 */
export function addProject(input: NewProject): ProjectId {
  const s = current();
  const { project, tasks } = seedProject(input, s, VIEWER, TODAY);
  const created = tasks.map((t) => ev(t.id, "created", { to: t.status }));
  commit({
    ...s,
    projects: [...s.projects, project],
    tasks: [...s.tasks, ...tasks],
    history: [...s.history, ...created],
    projectEvents: [...s.projectEvents, pev(project.id, "created", project.template ? { text: project.template } : {})],
  });
  return project.id;
}

/* ── Undo and reset ─────────────────────────────────────────────────── */

/** Step back one change, to a task or a project. Returns false when there is nothing to undo. */
export function undo(): boolean {
  current();
  const prev = past[past.length - 1];
  if (!prev) return false;
  past = past.slice(0, -1);
  state = prev;
  persist();
  emit();
  return true;
}

/** Back to the canonical world, as a fresh review starts: tasks, blocks, history, projects and updates. Clears undo. */
export function resetDemo(): void {
  state = INITIAL_STATE;
  past = [];
  persist();
  emit();
}
