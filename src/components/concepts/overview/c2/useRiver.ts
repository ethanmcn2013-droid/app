"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { type Counts, type DemoState, boardOn, countsFor, forecast, lateTasks, statusOn } from "../../demo/store";
import { undo as storeUndo, updateTask, useDemoStore } from "../../demo/store/client";
import {
  type Item,
  type ScopeId,
  dayOf,
  destinationOf,
  isoOf,
  long,
  milestonesOf,
  mondayOf,
  personName,
  scopeDef as findScope,
  short,
  taskItem,
  withDay,
} from "./data";
import { type Lens, type SpreadMove, lateAt, openAt, plural, spreadWeek, topOwner, weeklyLoad } from "./model";

export type Toast = { id: number; text: string; /** Store changes the Undo button steps back. */ undoSteps?: number };

export type Placing = { kind: "item"; id: string };

const whole = (s: DemoState) => s;
const byDue = (a: Item, b: Item) => (a.due ?? Number.MAX_SAFE_INTEGER) - (b.due ?? Number.MAX_SAFE_INTEGER) || a.id.localeCompare(b.id);

/** Will this open item have missed its date by `day`, at the project's recent pace? */
/** The date an item had at the end of `day`, from its history of date moves. */
export function dueOnDay(item: Item, day: number): number | undefined {
  let due = item.due;
  for (const m of [...(item.dueMoves ?? [])].reverse()) if (m.on > day) due = m.from;
  return due;
}

export function lateBy(item: Item, day: number): boolean {
  if (item.due === undefined || item.terminal || item.kind !== "task" || !openAt(item, 0) || item.due >= day) return false;
  if (item.due < 0) return true;
  return (item.eta ?? item.due) > item.due;
}

function addCounts(list: Counts[]): Counts {
  const sum = list.reduce(
    (a, c) => ({
      total: a.total + c.total,
      done: a.done + c.done,
      open: a.open + c.open,
      late: a.late + c.late,
      stuck: a.stuck + c.stuck,
      waiting: a.waiting + c.waiting,
      review: a.review + c.review,
      pct: 0,
    }),
    { total: 0, done: 0, open: 0, late: 0, stuck: 0, waiting: 0, review: 0, pct: 0 },
  );
  return { ...sum, pct: sum.total ? Math.round((sum.done / sum.total) * 100) : 0 };
}

export function useRiver() {
  const state = useDemoStore(whole);
  const [scope, setScopeRaw] = useState<ScopeId>("mara-finn");
  const [lensPref, setLensPref] = useState<Lens>("streams");
  const [probe, setProbe] = useState<number | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [focusWeek, setFocusWeek] = useState<number>(mondayOf(0));
  const [lateOpen, setLateOpen] = useState(false);
  const [toast, setToast] = useState<Toast | null>(null);
  const [spread, setSpread] = useState<{ week: number; moves: SpreadMove[] } | null>(null);
  const [placing, setPlacing] = useState<Placing | null>(null);
  const toastTimer = useRef<number | undefined>(undefined);
  const toastSeq = useRef(0);

  // Projects are live: a health, date or name change on Projects shows here too.
  const scopeDef = useMemo(() => findScope(scope, state), [scope, state]);
  const allProjects = scope === "all";
  const projects = scopeDef.projects;
  const lens: Lens = lensPref;

  // Every bar is a store task. Open work that has to be done by the project's
  // date also carries when it lands at the recent pace (the store's forecast),
  // so looking ahead can say what will be late.
  const items = useMemo(() => {
    const mapped = state.tasks.map((t) => taskItem(t, state));
    const etas = new Map<string, number>();
    for (const p of projects) {
      const f = forecast(state, p.id);
      if (!f.pacePerDay || p.tooEarly) continue;
      const date = dayOf(p.date);
      mapped
        .filter((it) => it.project === p.id && it.status !== "done" && !it.afterEvent && (it.due === undefined || it.due <= date))
        .sort(byDue)
        .forEach((it, k) => {
          const eta = Math.ceil((k + 1) / f.pacePerDay - 1e-9);
          if (it.due !== undefined && eta > it.due) etas.set(it.id, eta);
        });
    }
    return mapped.map((it) => (etas.has(it.id) ? { ...it, eta: etas.get(it.id) } : it));
  }, [state, projects]);

  const ids = useMemo(() => new Set<string>(projects.map((p) => p.id)), [projects]);
  /** The scope's work as it stands today. */
  const scopedNow = useMemo(() => items.filter((it) => ids.has(it.project)), [items, ids]);
  /** Milestones and each project's own date: flags, never counted as tasks. */
  const marks = useMemo(() => projects.flatMap((p) => [...milestonesOf(p), destinationOf(p)]), [projects]);
  const destination = allProjects ? undefined : destinationOf(projects[0]);

  // The counts are the store's own, so they match Projects, Tasks and Analytics.
  const counts = useMemo(() => addCounts(projects.map((p) => countsFor(state, p.id))), [state, projects]);
  /** What the team can do in a week: what it finished in the last seven days (the store's pace). */
  const capacity = useMemo(
    () => Math.round(projects.reduce((n, p) => n + forecast(state, p.id).pacePerDay * 7, 0)),
    [state, projects],
  );

  // The canvas: from a week before the first work to four weeks past the last date.
  // It starts where the work starts: a milestone months before the first task
  // (the venue booked in March) does not stretch the river back to it.
  const [r0, r1] = useMemo(() => {
    const at = (list: Item[]) => list.flatMap((it) => [it.start, it.due, it.doneOn]).filter((d): d is number => d !== undefined);
    const work = at(scopedNow);
    const ends = projects.map((p) => dayOf(p.end ?? p.date));
    const first = Math.min(-35, ...(work.length ? work : at(marks)));
    const last = Math.max(35, ...work, ...at(marks), ...ends);
    return [mondayOf(first) - 7, last + 28];
  }, [scopedNow, marks, projects]);
  /** The view the river opens on at its widest zoom: four weeks back to two past the date. */
  const openWindow = useMemo<[number, number]>(() => {
    const last = Math.max(...projects.map((p) => dayOf(p.date)));
    return [-28, Math.max(28, last + 15)];
  }, [projects]);

  /** The day the river is drawn as of: today, or a replayed day in the past. */
  const asOf = probe !== null && probe < 0 ? probe : 0;
  const forecastDay = probe !== null && probe > 0 ? probe : null;

  /*
   * Looking back replays the task history: only work that existed that day,
   * in the status the log says it had, at the date it had then. A task whose
   * date slipped later shows its old date before the move.
   */
  const scoped = useMemo(() => {
    if (asOf >= 0) return scopedNow;
    const iso = isoOf(asOf);
    const byId = new Map(state.tasks.map((t) => [t.id, t]));
    const out: Item[] = [];
    for (const it of scopedNow) {
      const t = byId.get(it.id);
      const then = t ? statusOn(state, t, iso) : undefined;
      if (!t || !then) continue;
      const due = dueOnDay(it, asOf);
      const start = due === undefined ? undefined : t.start ? Math.min(dayOf(t.start), due) : due;
      const moved = (it.dueMoves ?? []).filter((m) => m.on <= asOf);
      const first = moved.find((m) => m.from !== undefined)?.from;
      const doneOn =
        then === "done" ? Math.min(it.doneOn ?? asOf, asOf) : it.doneOn !== undefined && it.doneOn > asOf ? it.doneOn : undefined;
      out.push({
        ...it,
        status: then,
        due,
        start,
        doneOn,
        eta: undefined,
        slip: due !== undefined && first !== undefined && first < due ? { from: first, on: moved[moved.length - 1].on } : undefined,
      });
    }
    return out;
  }, [asOf, scopedNow, state]);

  const loads = useMemo(() => weeklyLoad(scoped, asOf, r0, r1), [scoped, asOf, r0, r1]);
  // Late work, in the store's order (most overdue first).
  const lateNow = useMemo(() => {
    const byId = new Map(scopedNow.map((it) => [it.id, it]));
    return lateTasks(state)
      .filter((t) => ids.has(t.project))
      .map((t) => byId.get(t.id))
      .filter((it): it is Item => !!it);
  }, [state, ids, scopedNow]);
  const forecastLate = useMemo(
    () => (forecastDay === null ? [] : scoped.filter((it) => lateBy(it, forecastDay))),
    [scoped, forecastDay],
  );
  /** Work that was still open on the replayed day and is done now, by the log. */
  const replayDone = useMemo(
    () => (asOf >= 0 ? [] : scoped.filter((it) => it.status !== "done" && it.doneOn !== undefined && it.doneOn > asOf && it.doneOn <= 0)),
    [scoped, asOf],
  );
  const undated = useMemo(() => scopedNow.filter((it) => it.due === undefined && openAt(it, 0)), [scopedNow]);
  const selected = selectedId ? (items.find((it) => it.id === selectedId) ?? marks.find((m) => m.id === selectedId) ?? null) : null;

  /** The lead of the summary: how far off the day is. The counts follow it. */
  const lead = useMemo(() => {
    if (allProjects) return `${projects.length} active projects.`;
    const p = projects[0];
    const days = dayOf(p.date);
    if (days > 1) return `${days} days to ${p.name}.`;
    if (days === 1) return `1 day to ${p.name}.`;
    if (days === 0) return `${p.name} is today.`;
    return `${p.name} was on ${withDay(days)}.`;
  }, [allProjects, projects]);

  /** While the line is away from today: what it would look like then. */
  const probeSentence = useMemo(() => {
    if (forecastDay !== null) {
      const n = forecastLate.length;
      const when = withDay(forecastDay);
      return n ? `${plural(n, "task")} will be late by ${when} at the current pace.` : `Nothing will be late by ${when} at the current pace.`;
    }
    if (asOf < 0) {
      // In motion: In progress, Waiting or Review at the end of that day, by the task history.
      const iso = isoOf(asOf);
      const moving = projects.reduce((n, p) => {
        const b = boardOn(state, iso, { project: p.id });
        return n + b.doing.length + b.waiting.length + b.review.length;
      }, 0);
      const lateThen = scoped.filter((it) => it.kind === "task" && lateAt(it, asOf)).length;
      const since = replayDone.length;
      return `On ${withDay(asOf)}, ${plural(moving, "task")} ${moving === 1 ? "was" : "were"} in motion${
        lateThen ? ` and ${lateThen} ${lateThen === 1 ? "was" : "were"} late` : ""
      }. ${since ? `${since} ${since === 1 ? "has" : "have"} been done since.` : "Nothing has been done since."}`;
    }
    return null;
  }, [forecastDay, forecastLate, asOf, scoped, replayDone, projects, state]);

  // ── Actions ─────────────────────────────────────────────────────────

  const showToast = useCallback((text: string, undoSteps?: number) => {
    window.clearTimeout(toastTimer.current);
    toastSeq.current += 1;
    setToast({ id: toastSeq.current, text, undoSteps });
    toastTimer.current = window.setTimeout(() => setToast(null), 6500);
  }, []);

  // Step the store back outside any state updater: the store tells every surface, and
  // React must not hear about it while it renders this one.
  const undo = useCallback(() => {
    for (let i = 0; i < (toast?.undoSteps ?? 0); i++) storeUndo();
    window.clearTimeout(toastTimer.current);
    setToast(null);
  }, [toast]);

  const setScope = useCallback((sc: ScopeId) => {
    setScopeRaw(sc);
    setSelectedId(null);
    setSpread(null);
    setPlacing(null);
    setProbe(null);
    setLateOpen(false);
    setFocusWeek(mondayOf(0));
  }, []);

  const setLens = useCallback((l: Lens) => setLensPref(l), []);

  const select = useCallback((id: string | null) => {
    setSelectedId(id);
    if (id) setLateOpen(false);
  }, []);

  /** Move a task's start and due by whole days, through the store. */
  const moveItem = useCallback(
    (id: string, delta: number) => {
      const t = state.tasks.find((x) => x.id === id);
      if (!delta || !t?.due) return;
      const due = dayOf(t.due) + delta;
      updateTask(id, { due: isoOf(due), ...(t.start ? { start: isoOf(dayOf(t.start) + delta) } : {}) });
      showToast(`Moved “${t.title}” to ${withDay(due)}.`, 1);
    },
    [state, showToast],
  );

  const markDone = useCallback(
    (id: string) => {
      const t = state.tasks.find((x) => x.id === id);
      if (!t) return;
      updateTask(id, { status: "done" });
      setSelectedId(null);
      showToast(`“${t.title}” is done.`, 1);
    },
    [state, showToast],
  );

  const dateOfProject = useCallback(
    (project: string) => {
      const p = projects.find((x) => x.id === project);
      return p ? dayOf(p.date) : undefined;
    },
    [projects],
  );

  const previewSpread = useCallback(
    (week: number) => setSpread({ week, moves: spreadWeek(scoped, week, 0, dateOfProject, Math.max(3, Math.min(capacity, 4))) }),
    [scoped, dateOfProject, capacity],
  );

  const applySpread = useCallback(() => {
    if (!spread) return;
    for (const m of spread.moves) {
      const t = state.tasks.find((x) => x.id === m.id);
      if (!t?.due) continue;
      updateTask(m.id, { due: isoOf(dayOf(t.due) + m.delta), ...(t.start ? { start: isoOf(dayOf(t.start) + m.delta) } : {}) });
    }
    const weekItems = loads.find((l) => l.week === spread.week)?.items ?? [];
    const stay = weekItems.length - spread.moves.length;
    setSpread(null);
    showToast(`Spread the week of ${long(spread.week)}: ${stay} stay, ${spread.moves.length} moved a week or more later.`, spread.moves.length);
  }, [spread, state, loads, showToast]);

  /** Give undated work its dates: it runs five days from the day clicked. */
  const place = useCallback(
    (day: number) => {
      if (!placing) return;
      const t = state.tasks.find((x) => x.id === placing.id);
      if (t) {
        updateTask(placing.id, { start: isoOf(day), due: isoOf(day + 4) });
        showToast(`“${t.title}” runs ${short(day)} to ${short(day + 4)}.`, 1);
      }
      setPlacing(null);
    },
    [placing, state, showToast],
  );

  const weekSummary = useCallback(
    (week: number) => {
      const load = loads.find((l) => l.week === week);
      const due = load?.items ?? [];
      const top = topOwner(due);
      const done = scoped.filter((it) => it.doneOn !== undefined && it.doneOn >= week && it.doneOn < week + 7 && it.doneOn <= asOf);
      const isThis = week === mondayOf(0);
      const label = isThis ? "This week" : `Week of ${long(week)}`;
      let line: string;
      if (!due.length && !done.length) line = "Nothing due.";
      else if (!due.length) line = `${plural(done.length, "task")} done.`;
      else line = `${plural(due.length, "task")} due${top ? `, ${top.count} on ${personName(top.person)}` : ""}.`;
      return { label, line, due, done, count: due.length };
    },
    [loads, scoped, asOf],
  );

  return {
    state,
    scope,
    scopeDef,
    setScope,
    allProjects,
    projects,
    lens,
    setLens,
    items,
    scoped,
    scopedNow,
    marks,
    r0,
    r1,
    openWindow,
    asOf,
    probe,
    setProbe,
    forecast: forecastDay,
    forecastLate,
    replayDone,
    destination,
    counts,
    capacity,
    loads,
    lateNow,
    lateOpen,
    setLateOpen,
    undated,
    lead,
    probeSentence,
    selected,
    setSelectedId: select,
    focusWeek,
    setFocusWeek,
    toast,
    setToast,
    undo,
    moveItem,
    markDone,
    spread,
    setSpread,
    previewSpread,
    applySpread,
    placing,
    setPlacing,
    place,
    weekSummary,
  };
}

export type River = ReturnType<typeof useRiver>;
