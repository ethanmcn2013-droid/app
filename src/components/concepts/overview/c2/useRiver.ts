"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import {
  type Item,
  type ScopeId,
  ITEMS,
  PERSON,
  PROJECTS,
  SCOPE,
  fullDay,
  long,
  mondayOf,
  on,
  short,
  withDay,
} from "./data";
import {
  type Lens,
  type SpreadMove,
  allDownstream,
  applyShifts,
  cascade,
  clashes as findClashes,
  inScope,
  lateAt,
  listJoin,
  openAt,
  plural,
  spreadWeek,
  topOwner,
  weeklyLoad,
} from "./model";

export type Toast = { id: number; text: string; undo?: Item[] };

export type Placing = { kind: "milestone" } | { kind: "item"; id: string };

/** Will this open item have missed its date by `day`, at the current pace? */
export function lateBy(item: Item, day: number): boolean {
  if (item.due === undefined || item.terminal || !openAt(item, 0) || item.due >= day) return false;
  if (item.due < 0) return true;
  return (item.eta ?? item.due) > item.due;
}

export function useRiver() {
  const [scope, setScopeRaw] = useState<ScopeId>("orchard");
  const [lensPref, setLensPref] = useState<"streams" | "people">("streams");
  const [items, setItems] = useState<Item[]>(ITEMS);
  const [probe, setProbe] = useState<number | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [focusWeek, setFocusWeek] = useState<number>(mondayOf(0));
  const [toast, setToast] = useState<Toast | null>(null);
  const [spread, setSpread] = useState<{ week: number; moves: SpreadMove[] } | null>(null);
  const [placing, setPlacing] = useState<Placing | null>(null);
  const toastTimer = useRef<number | undefined>(undefined);
  const toastSeq = useRef(0);

  const lens: Lens = scope === "all" ? "projects" : lensPref;
  const scopeDef = SCOPE[scope];
  const [r0, r1] = scopeDef.range;

  const scoped = useMemo(() => items.filter((it) => inScope(it, scope)), [items, scope]);
  /** The day the river is drawn as of: today, or a replayed day in the past. */
  const asOf = probe !== null && probe < 0 ? probe : 0;
  const forecast = probe !== null && probe > 0 ? probe : null;

  const destination = scope === "all" ? undefined : scoped.find((it) => it.terminal && it.due !== undefined);
  const loads = useMemo(() => weeklyLoad(scoped, asOf, r0, r1), [scoped, asOf, r0, r1]);
  const lateNow = useMemo(() => scoped.filter((it) => !it.terminal && lateAt(it, 0)), [scoped]);
  const forecastLate = useMemo(
    () => (forecast === null ? [] : scoped.filter((it) => lateBy(it, forecast))),
    [scoped, forecast],
  );
  const replaySettled = useMemo(
    () =>
      asOf >= 0
        ? []
        : scoped.filter((it) => it.doneOn !== undefined && it.doneOn > asOf && it.doneOn <= 0 && !it.terminal),
    [scoped, asOf],
  );
  const clashes = useMemo(() => (scope === "all" ? findClashes(scoped) : []), [scope, scoped]);
  const undated = useMemo(() => scoped.filter((it) => it.due === undefined), [scoped]);
  const selected = selectedId ? (items.find((it) => it.id === selectedId) ?? null) : null;

  const sentence = useMemo(() => {
    if (forecast !== null) {
      const n = forecastLate.length;
      const when = withDay(forecast);
      if (!n) return `Nothing will be late by ${when} at the current pace.`;
      // The biggest knock-on: the open milestone that the most late things lead into.
      const hits = new Map<string, number>();
      for (const it of forecastLate) {
        for (const d of allDownstream(scoped, it.id)) {
          if (d.kind === "milestone" && !d.terminal && openAt(d, 0)) hits.set(d.id, (hits.get(d.id) ?? 0) + 1);
        }
      }
      const hinge = [...hits.entries()]
        .map(([id, count]) => ({ item: scoped.find((x) => x.id === id)!, count }))
        .sort((a, b) => b.count - a.count || a.item.due! - b.item.due!)[0]?.item;
      const base = `${plural(n, "thing")} will be late by ${when} at the current pace.`;
      return hinge ? `${base} The biggest knock-on is ${hinge.ref ?? `the ${hinge.title.toLowerCase()}`}.` : base;
    }
    if (asOf < 0) {
      const openThen = scoped.filter(
        (it) => it.due !== undefined && !it.terminal && openAt(it, asOf) && (it.start ?? it.due) <= asOf + 7,
      );
      const lateThen = openThen.filter((it) => lateAt(it, asOf)).length;
      const settled = replaySettled.length;
      return `On ${withDay(asOf)}, ${plural(openThen.length, "thing")} ${openThen.length === 1 ? "was" : "were"} in motion. ${
        settled ? `${settled} ${settled === 1 ? "has" : "have"} settled since` : "Nothing has settled since"
      }${lateThen ? `, and ${lateThen} ${lateThen === 1 ? "was" : "were"} already late` : ""}.`;
    }
    if (scope === "all") {
      const first = clashes[0];
      return `5 projects on one river. ${plural(clashes.length, "clash", "clashes")}${
        first ? `, the sharpest on ${long(clashes.find((c) => c.items.length === 2)?.day ?? first.day)}` : ""
      }.`;
    }
    if (scope === "lunch") {
      const done = scoped.filter((it) => !it.terminal);
      const slipped = done.filter((it) => (it.doneOn ?? 0) > (it.due ?? 0)).length;
      return `The lunch was yesterday. All ${done.length} things got done, ${slipped} of them a day or two late.`;
    }
    if (!destination) {
      return undated.length
        ? `No dates yet. Set the first milestone and the river starts to move.`
        : `No dates yet.`;
    }
    const days = destination.due! - 0;
    const name = scope === "orchard" ? "Mara and Finn" : destination.title;
    const soon = loads.filter((l) => l.week >= mondayOf(0) && l.week <= mondayOf(0) + 14);
    const crowded = soon.some((l) => l.count >= 4);
    const parts = [`${days} days to ${name}.`];
    if (crowded) parts.push("The next two weeks are crowded.");
    if (undated.length) parts.push(`${plural(undated.length, "thing")} still ${undated.length === 1 ? "needs" : "need"} a date.`);
    else if (lateNow.length) parts.push(`${plural(lateNow.length, "thing")} ${lateNow.length === 1 ? "is" : "are"} already late.`);
    return parts.join(" ");
  }, [forecast, forecastLate, asOf, scope, clashes, scoped, destination, loads, lateNow, undated, replaySettled]);

  // ── Actions ─────────────────────────────────────────────────────────

  const showToast = useCallback((text: string, undo?: Item[]) => {
    window.clearTimeout(toastTimer.current);
    toastSeq.current += 1;
    setToast({ id: toastSeq.current, text, undo });
    toastTimer.current = window.setTimeout(() => setToast(null), 6500);
  }, []);

  const undo = useCallback(() => {
    setToast((t) => {
      if (t?.undo) setItems(t.undo);
      return null;
    });
  }, []);

  const setScope = useCallback((s: ScopeId) => {
    setScopeRaw(s);
    setSelectedId(null);
    setSpread(null);
    setPlacing(null);
    setProbe(null);
    setFocusWeek(s === "lunch" ? mondayOf(on(7, 13)) : mondayOf(0));
  }, []);

  const setLens = useCallback(
    (l: Lens) => {
      if (l === "projects") {
        if (scope !== "all") setScope("all");
        return;
      }
      setLensPref(l);
      if (scope === "all") setScope("orchard");
    },
    [scope, setScope],
  );

  const moveItem = useCallback(
    (id: string, delta: number) => {
      if (!delta) return;
      const before = items;
      const shifts = cascade(items, id, delta);
      const moved = before.find((it) => it.id === id)!;
      setItems(applyShifts(items, shifts));
      const others = [...shifts.keys()].filter((k) => k !== id).map((k) => before.find((it) => it.id === k)!.title);
      const to = short((moved.due ?? 0) + delta);
      showToast(
        others.length
          ? `Moved ${moved.title.toLowerCase()} to ${to}. ${listJoin(others)} moved with it.`
          : `Moved ${moved.title.toLowerCase()} to ${to}.`,
        before,
      );
    },
    [items, showToast],
  );

  const markDone = useCallback(
    (id: string) => {
      const before = items;
      const it = items.find((x) => x.id === id);
      if (!it) return;
      setItems(items.map((x) => (x.id === id ? { ...x, status: "done", doneOn: 0 } : x)));
      setSelectedId(null);
      showToast(`${it.title} settled.`, before);
    },
    [items, showToast],
  );

  const previewSpread = useCallback(
    (week: number) => {
      const moves = spreadWeek(scoped, week, 0);
      setSpread({ week, moves });
    },
    [scoped],
  );

  const applySpread = useCallback(() => {
    if (!spread) return;
    const before = items;
    const shifts = new Map(spread.moves.map((m) => [m.id, m.delta]));
    setItems(applyShifts(items, shifts));
    const weekItems = loads.find((l) => l.week === spread.week)?.items ?? [];
    const remaining = weekItems.length - spread.moves.length;
    setSpread(null);
    showToast(`Spread the week of ${long(spread.week)}. ${remaining} stay, ${spread.moves.length} moved on.`, before);
  }, [spread, items, loads, showToast]);

  const place = useCallback(
    (day: number) => {
      if (!placing) return;
      const before = items;
      if (placing.kind === "milestone") {
        const m: Item = {
          id: `sp${day}`,
          project: "spring",
          title: "Spring open day",
          lane: "admin",
          owner: "dara",
          kind: "milestone",
          due: day,
          status: "todo",
          terminal: true,
        };
        setItems([...items.filter((it) => !(it.project === "spring" && it.terminal)), m]);
        showToast(`Spring open day set for ${fullDay(day)}. The river has somewhere to go.`, before);
      } else {
        const it = items.find((x) => x.id === placing.id);
        setItems(items.map((x) => (x.id === placing.id ? { ...x, start: day, due: day + 4 } : x)));
        if (it) showToast(`${it.title} runs ${short(day)} to ${short(day + 4)}.`, before);
      }
      setPlacing(null);
    },
    [placing, items, showToast],
  );

  const downstreamOf = useCallback((id: string) => allDownstream(scoped, id), [scoped]);

  const weekSummary = useCallback(
    (week: number) => {
      const load = loads.find((l) => l.week === week);
      const due = load?.items ?? [];
      const top = topOwner(due);
      const settled = scoped.filter(
        (it) => it.doneOn !== undefined && it.doneOn >= week && it.doneOn < week + 7 && it.doneOn <= asOf,
      );
      const isThis = week === mondayOf(0);
      const label = isThis ? "This week" : `Week of ${long(week)}`;
      let line: string;
      if (!due.length && !settled.length) line = `${label}: nothing due.`;
      else if (!due.length) line = `${label}: ${plural(settled.length, "thing")} settled.`;
      else line = `${label}: ${plural(due.length, "thing")} due${top ? `, ${top.count} on ${PERSON[top.person].name}` : ""}.`;
      return { label, line, due, settled, count: due.length };
    },
    [loads, scoped, asOf],
  );

  return {
    scope,
    scopeDef,
    setScope,
    lens,
    setLens,
    items,
    scoped,
    r0,
    r1,
    asOf,
    probe,
    setProbe,
    forecast,
    forecastLate,
    replaySettled,
    destination,
    loads,
    lateNow,
    clashes,
    undated,
    sentence,
    selected,
    setSelectedId,
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
    downstreamOf,
    weekSummary,
    projectName: PROJECTS,
  };
}

export type River = ReturnType<typeof useRiver>;
