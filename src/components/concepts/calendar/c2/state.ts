"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { stuckTasks, toClock, type DemoState, type TeamPersonId } from "../../demo/store";
import { scheduleBlock, unscheduleBlock, updateTask, useDemoStore } from "../../demo/store/client";
import type { TaskLine } from "../../tasks/grammar";
import { storeScope, useTaskScope } from "../../tasks/scope";
import { addFromLine } from "../../tasks/task-line";
import { useTaskToast } from "../../tasks/toast";
import { batch, undoLast, useUndoKey } from "../../tasks/undo";
import { editSentence } from "../../tasks/words";
import {
  autoFit,
  CAPACITY,
  plannedOn,
  dayLong,
  firstGap,
  isoOf,
  lastWorkDay,
  NOW,
  TODAY,
  clock,
  dur,
  estimateLabel,
  setWeekOwner,
  trayTab,
  weekOwner,
  weekTasks,
  type Plan,
  type Status,
  type Task,
} from "./data";

/** One store block for a planned task, on the week owner's calendar. */
const blockFor = (t: Task, plan: Plan) => ({ id: t.blockId, taskId: t.id, day: isoOf(plan.day), start: toClock(plan.start), minutes: plan.dur, person: weekOwner() });

/**
 * The planner on the demo store. Reads one person's week through `weekTasks`
 * (the signed-in person's, or the one `?owner=` names), and every change (a
 * place, a move, Make Friday fit, a new task) is a store mutation, so the
 * board and the list see it, and Ctrl/⌘ Z takes it back. Every change says
 * what happened in the one Tasks toast, with Undo.
 */
export function usePlanner(owner: TeamPersonId, extraTaskId?: string) {
  // The week's hours and fixed events become this person's before anything reads them.
  setWeekOwner(owner);
  const select = useCallback((s: DemoState) => weekTasks(s, extraTaskId, owner), [extraTaskId, owner]);
  const tasks = useDemoStore(select);
  const { toast, say: sayToast, close: closeToast } = useTaskToast();
  const [fresh, setFresh] = useState<string[]>([]);
  const timers = useRef<number[]>([]);

  useEffect(() => {
    const list = timers.current;
    return () => list.forEach((x) => window.clearTimeout(x));
  }, []);

  const later = useCallback((fn: () => void, ms: number) => {
    timers.current.push(window.setTimeout(fn, ms));
  }, []);

  const clearTimers = useCallback(() => {
    timers.current.forEach((x) => window.clearTimeout(x));
    timers.current = [];
  }, []);

  const say = useCallback((msg: string, undo = false) => sayToast(msg, undo), [sayToast]);

  /** Write the plans, titles, estimates and statuses in `next` that differ from now. One undo step. */
  const apply = useCallback(
    (next: Task[]) => {
      const cur = new Map(tasks.map((t) => [t.id, t]));
      const place: ReturnType<typeof blockFor>[] = [];
      const drop: string[] = [];
      const edits: (() => void)[] = [];
      for (const t of next) {
        const was = cur.get(t.id);
        if (!was) continue;
        const a = was.plan;
        const b = t.plan;
        if (b && (!a || a.day !== b.day || a.start !== b.start || a.dur !== b.dur)) place.push(blockFor(was, b));
        else if (!b && a && was.blockId) drop.push(was.blockId);
        const patch: { title?: string; estimate?: number; status?: Status } = {};
        if (t.title !== was.title) patch.title = t.title;
        if (t.estimate !== was.estimate) patch.estimate = t.estimate;
        if (t.status !== was.status) patch.status = t.status;
        if (Object.keys(patch).length) edits.push(() => updateTask(t.id, patch));
      }
      return batch([...(place.length ? [() => void scheduleBlock(place)] : []), ...(drop.length ? [() => unscheduleBlock(drop)] : []), ...edits]);
    },
    [tasks],
  );

  /** Change one task. With no words given, a rename, a new estimate or a move says itself. */
  const patch = useCallback(
    (id: string, change: Partial<Task>, words?: string) => {
      const was = tasks.find((x) => x.id === id);
      if (!was) return;
      const changed = apply(tasks.map((x) => (x.id === id ? { ...x, ...change } : x)));
      if (!changed) return;
      const a = was.plan;
      const b = change.plan;
      const said =
        words ??
        (change.title !== undefined && change.title !== was.title
          ? "Renamed"
          : change.estimate !== undefined && change.estimate !== was.estimate
            ? `Now ${estimateLabel(change.estimate)}`
            : a && b && (a.day !== b.day || a.start !== b.start)
              ? `Moved to ${dayLong(b.day)} at ${clock(b.start)}`
              : a && b && a.dur !== b.dur
                ? `Now ${dur(b.dur)}`
                : "Updated");
      say(said, true);
    },
    [tasks, apply, say],
  );

  const place = useCallback(
    (id: string, plan: Plan, announce = true) => {
      const task = tasks.find((x) => x.id === id);
      if (!task) return;
      scheduleBlock(blockFor(task, plan));
      setFresh([id]);
      if (announce) say(`${task.plan ? "Moved to" : "Planned for"} ${dayLong(plan.day)} at ${clock(plan.start)}`, true);
    },
    [tasks, say],
  );

  const unplan = useCallback(
    (id: string) => {
      const task = tasks.find((x) => x.id === id);
      if (!task?.blockId) return;
      unscheduleBlock(task.blockId);
      say("Back in the tray, ready to plan", true);
    },
    [tasks, say],
  );

  const setStatus = useCallback(
    (id: string, status: Status) => {
      const was = tasks.find((x) => x.id === id);
      if (!was || was.status === status) return;
      updateTask(id, { status });
      // The same words as the board and the list: "Marked done", "Sent to be checked".
      say(editSentence({ status }, { status: was.status }), true);
    },
    [tasks, say],
  );

  /** Flow tasks into free time as one change; they land one after another. One undo reverts them all. */
  const fit = useCallback(
    (ids: string[], onDone?: () => void) => {
      clearTimers();
      const result = autoFit(tasks, ids);
      const byId = new Map(tasks.map((t) => [t.id, t]));
      if (result.placed.length) scheduleBlock(result.placed.map((p) => blockFor(byId.get(p.id)!, p.plan)));
      result.placed.forEach((step, i) => later(() => setFresh((f) => [...f.slice(-8), step.id]), 60 + i * 120));
      const n = result.placed.length;
      const missed = result.unplaced.length;
      let msg = n ? `Fitted ${n} ${n === 1 ? "task" : "tasks"} into free time` : "Nothing fitted: there is no free time before these are due";
      if (n && missed) msg += `. ${missed} did not fit before ${missed === 1 ? "it is" : "they are"} due`;
      say(msg, n > 0);
      later(() => onDone?.(), 60 + n * 120);
      return result;
    },
    [tasks, clearTimers, later, say],
  );

  /** Earliest free time on or before the due day, from now. */
  const pullEarlier = useCallback(
    (id: string) => {
      const task = tasks.find((x) => x.id === id);
      if (!task) return false;
      const length = task.plan?.dur ?? task.estimate;
      const last = Math.min(lastWorkDay(), Math.max(task.due ?? lastWorkDay(), TODAY));
      for (let day = TODAY; day <= last; day++) {
        const start = firstGap(tasks, day, length, day === TODAY ? NOW : 0, id);
        if (start !== null) {
          place(id, { day, start, dur: length });
          return true;
        }
      }
      say("No free time before it is due. Something else has to move first.");
      return false;
    },
    [tasks, place, say],
  );

  /** Take the smallest late-day block that covers the overflow off a day, and fit it into free time elsewhere. */
  const makeFit = useCallback(
    (day: number) => {
      let over = plannedOn(tasks, day) - CAPACITY[day];
      if (over <= 0) return;
      const movable = tasks
        .filter((x) => x.plan && x.plan.day === day && x.status !== "done")
        .sort((a, b) => b.plan!.start - a.plan!.start);
      const single = movable.filter((x) => x.plan!.dur >= over).sort((a, b) => a.plan!.dur - b.plan!.dur || b.plan!.start - a.plan!.start)[0];
      const moving: Task[] = [];
      if (single) moving.push(single);
      else
        for (const x of movable) {
          if (over <= 0) break;
          moving.push(x);
          over -= x.plan!.dur;
        }
      const ids = moving.map((x) => x.id);
      const working = tasks.map((x) => (ids.includes(x.id) ? { ...x, plan: undefined } : x));
      const result = autoFit(working, ids);
      const next = working.map((x) => {
        const step = result.placed.find((p) => p.id === x.id);
        return step ? { ...x, plan: step.plan } : x;
      });
      apply(next);
      setFresh(result.placed.map((p) => p.id));
      const first = result.placed[0];
      const name = (id: string) => tasks.find((x) => x.id === id)!.title;
      let msg = first
        ? `Moved ${name(first.id)} to ${dayLong(first.plan.day)} at ${clock(first.plan.start)}`
        : `Took ${name(ids[0])} off ${dayLong(day)}, back to the tray`;
      if (result.placed.length > 1) msg += ` and ${result.placed.length - 1} more`;
      if (first && result.unplaced.length) msg += `. ${result.unplaced.length} went back to the tray`;
      say(`${msg}. ${dayLong(day)} now fits.`, true);
    },
    [tasks, apply, say],
  );

  /** A plain-words line lands in the week owner's tray, ready to place. */
  const add = useCallback(
    (line: TaskLine, project?: Task["project"]) => {
      const id = addFromLine(line, { owner: weekOwner(), helper: weekOwner(), project });
      if (!id) return null;
      setFresh([id]);
      say(`Added “${line.title}” to the tray. Choose it, then a time`, true);
      return id;
    },
    [say],
  );

  const restore = useCallback(() => {
    clearTimers();
    const ok = undoLast();
    setFresh([]);
    say(ok ? "Undone" : "Nothing to undo");
  }, [clearTimers, say]);

  // Ctrl/⌘ Z, as everywhere in Tasks.
  useUndoKey(
    useCallback(
      (ok: boolean) => {
        clearTimers();
        setFresh([]);
        say(ok ? "Undone" : "Nothing to undo");
      },
      [clearTimers, say],
    ),
  );

  return { tasks, setTasks: apply, toast, closeToast, fresh, setFresh, patch, place, unplan, setStatus, fit, pullEarlier, makeFit, add, restore, say, later };
}

export type Planner = ReturnType<typeof usePlanner>;

/**
 * `?owner=` chooses whose week this is, so on the calendar it is not a filter:
 * the week holds everything that person owns or helps with. `?project=` and
 * Stuck narrow it, and one test (`inScope`) feeds the tray, its counts, the
 * Due row, the footer and which blocks the grid draws quiet.
 */
export function useWeekFilter(stuckOnly: boolean) {
  const scope = useTaskScope();
  const { project } = scope;
  const stuck = useDemoStore(useCallback((st: DemoState) => new Set(stuckTasks(st, storeScope({ project })).map((t) => t.id)), [project]));
  const inScope = useCallback((t: Task) => (!project || t.project === project) && (!stuckOnly || stuck.has(t.id)), [project, stuckOnly, stuck]);
  return { scope, inScope, filtered: !!(project || stuckOnly) };
}

/** The week through the filter: what the tray lists, and how many due soon have no time yet. */
export function scopedWeek(tasks: Task[], inScope: (t: Task) => boolean) {
  const scoped = tasks.filter((t) => inScope(t) || t.visiting);
  return { scoped, toPlan: scoped.filter((t) => trayTab(t) === "week") };
}

/** "3 tasks due soon have no time yet": the footer, from the same list as the tray's count. */
export const footerWords = (n: number) => `${n} ${n === 1 ? "task" : "tasks"} due soon ${n === 1 ? "has" : "have"} no time yet`;

const PHONE_QUERY = "(max-width: 700px)";
function subscribe(cb: () => void) {
  const mq = window.matchMedia(PHONE_QUERY);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
}
export function useIsPhone() {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(PHONE_QUERY).matches,
    () => false,
  );
}

/** Lay out overlapping items side by side. */
export function lanes<T extends { key: string; start: number; end: number }>(items: T[]) {
  const sorted = [...items].sort((a, b) => a.start - b.start || b.end - a.end);
  const out = new Map<string, { lane: number; of: number }>();
  let cluster: T[] = [];
  let clusterEnd = -1;
  const laneEnds: number[] = [];
  const flush = () => {
    const n = Math.max(1, laneEnds.length);
    for (const c of cluster) out.set(c.key, { lane: out.get(c.key)!.lane, of: n });
    cluster = [];
    laneEnds.length = 0;
  };
  for (const it of sorted) {
    if (it.start >= clusterEnd && cluster.length) flush();
    let lane = laneEnds.findIndex((e) => e <= it.start);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(it.end);
    } else laneEnds[lane] = it.end;
    out.set(it.key, { lane, of: 1 });
    cluster.push(it);
    clusterEnd = Math.max(clusterEnd, it.end);
  }
  if (cluster.length) flush();
  return out;
}
