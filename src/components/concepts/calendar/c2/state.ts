"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import {
  autoFit,
  dayLong,
  firstGap,
  INITIAL_TASKS,
  NOW,
  TODAY,
  clock,
  type Plan,
  type Status,
  type Task,
} from "./data";

export type Toast = { id: number; msg: string; undo?: Task[] };

export function usePlanner() {
  const [tasks, setTasks] = useState<Task[]>(INITIAL_TASKS);
  const [toast, setToast] = useState<Toast | null>(null);
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

  const say = useCallback(
    (msg: string, undo?: Task[]) => {
      const id = Date.now();
      setToast({ id, msg, undo });
      later(() => setToast((t) => (t && t.id === id ? null : t)), 6500);
    },
    [later],
  );

  const patch = useCallback((id: string, change: Partial<Task>) => {
    setTasks((all) => all.map((x) => (x.id === id ? { ...x, ...change } : x)));
  }, []);

  const place = useCallback(
    (id: string, plan: Plan, announce = true) => {
      const before = tasks;
      const task = tasks.find((x) => x.id === id);
      setTasks((all) => all.map((x) => (x.id === id ? { ...x, plan } : x)));
      setFresh([id]);
      if (announce && task)
        say(`${task.plan ? "Moved" : "Planned"} for ${dayLong(plan.day)} at ${clock(plan.start)}`, before);
    },
    [tasks, say],
  );

  const unplan = useCallback(
    (id: string) => {
      const before = tasks;
      setTasks((all) => all.map((x) => (x.id === id ? { ...x, plan: undefined } : x)));
      say("Back in the tray, ready to plan", before);
    },
    [tasks, say],
  );

  const setStatus = useCallback(
    (id: string, status: Status) => {
      const before = tasks;
      setTasks((all) => all.map((x) => (x.id === id ? { ...x, status } : x)));
      if (status === "done") say("Marked done", before);
    },
    [tasks, say],
  );

  /** Flow tasks into free time one at a time. One undo reverts them all. */
  const fit = useCallback(
    (ids: string[], onDone?: () => void) => {
      clearTimers();
      const before = tasks;
      const result = autoFit(tasks, ids);
      result.placed.forEach((step, i) => {
        later(() => {
          setTasks((all) => all.map((x) => (x.id === step.id ? { ...x, plan: step.plan } : x)));
          setFresh((f) => [...f.slice(-8), step.id]);
        }, 140 + i * 220);
      });
      later(
        () => {
          const n = result.placed.length;
          const missed = result.unplaced.length;
          let msg = n ? `Fitted ${n} ${n === 1 ? "task" : "tasks"} into free time` : "Nothing fitted: there is no free time before these are due";
          if (n && missed) msg += `. ${missed} did not fit before ${missed === 1 ? "it is" : "they are"} due`;
          say(msg, before);
          onDone?.();
        },
        140 + result.placed.length * 220,
      );
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
      const last = Math.max(task.due ?? 4, TODAY);
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

  const restore = useCallback(
    (snapshot: Task[]) => {
      clearTimers();
      setTasks(snapshot);
      setFresh([]);
      setToast(null);
    },
    [clearTimers],
  );

  return { tasks, setTasks, toast, setToast, fresh, setFresh, patch, place, unplan, setStatus, fit, pullEarlier, restore, say, later };
}

export type Planner = ReturnType<typeof usePlanner>;

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
