"use client";

import {
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import Link from "next/link";
import { byWorkstream, isLate, isOpen, peopleLoad } from "../../demo/store";
import { HealthMark, HealthPill, HEALTH_WORDS } from "../../demo/health";
import { useDemoLinks } from "../../demo/links";
import { PageHeader } from "../../tasks/header";
import {
  type Item,
  type ScopeId,
  dateOf,
  relative,
  isFirstOfMonth,
  laneColor,
  long,
  mondayOf,
  monthShort,
  personColor,
  personFull,
  personName,
  personRole,
  projectColor,
  scopeList,
  short,
  weekday,
  weekdayShort,
  withDay,
} from "./data";
import {
  type LaneDef,
  type Lens,
  type Placed,
  HEAT_WORD,
  geometry,
  heatColor,
  heatOf,
  isDated,
  itemColor,
  lateAt,
  openAt,
  ownerBreakdown,
  packLane,
  plural,
  textWidth,
  AVATAR_W,
} from "./model";
import { Avatar, cx, dueText, FlagGlyph, Icon, laneName, StatusChip } from "./parts";
import { Tray } from "./Tray";
import type { River } from "./useRiver";
import s from "./river.module.css";

const HEADER_W = 212;
const AXIS_H = 30;
/** The ribbon's resting height; spare room on tall screens deepens it. */
const RIBBON_H = 54;
const RIBBON_MAX = 92;
/** The lane under the dates that holds the milestone flags, when a project has any. */
const FLAG_LANE_H = 18;
const SED_EMPTY = 54;
const ROW_H = 24;
const PILL_H = 20;
/** Most rows a lane may ask for before its extras share a "+N". */
const MAX_ROWS = 10;
/** Where today sits across the stage at the widest zoom. */
const NOW_AT = 0.22;

/** Short screens fold the tray to one line so the river keeps its height. */
const SHORT = "(max-height: 820px)";
/** Scrolls glide, unless the person has asked for less motion: then they jump. */
const glide = (): ScrollBehavior => (window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth");
function subscribeShort(cb: () => void) {
  const mq = window.matchMedia(SHORT);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
}

export const LENSES: { id: Lens; label: string; key: string }[] = [
  { id: "streams", label: "Areas", key: "1" },
  { id: "people", label: "People", key: "2" },
];

/** The lanes for the scope and lens: workstreams, people, or one lane a project. */
function useLanes(r: River): LaneDef[] {
  return useMemo(() => {
    if (r.allProjects) return r.projects.map((p) => ({ id: p.id, name: p.short, color: projectColor(p.id), project: p.id }));
    const p = r.projects[0];
    if (r.lens === "people") {
      return peopleLoad(r.state, { project: p.id })
        .filter((l) => r.scopedNow.some((it) => it.owner === l.person))
        .map((l) => ({ id: l.person, name: personFull(l.person), color: personColor(l.person), person: l.person }));
    }
    return p.workstreams.map((w) => ({ id: w.id, name: w.name, color: laneColor(p.id, w.id) }));
  }, [r.allProjects, r.projects, r.lens, r.state, r.scopedNow]);
}

/** Which lane an item belongs in. */
function laneOf(it: Item, r: River): string {
  if (r.allProjects) return it.project;
  return r.lens === "people" ? it.owner : it.lane;
}

type Drag = { id: string; delta: number };

export function Desktop({ river }: { river: River }) {
  const r = river;
  const stageRef = useRef<HTMLDivElement>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const anchorRef = useRef<{ day: number; screenX: number } | null>(null);
  const ppdSeen = useRef<number | null>(null);
  const scopeSeen = useRef<string | null>(null);
  const dragRef = useRef<{ id: string; x0: number; moved: boolean } | null>(null);
  const probeDrag = useRef(false);
  const justDragged = useRef(false);
  const hoverTimer = useRef<number | undefined>(undefined);

  /** Null until the stage has been measured: the river lands on today only once it knows its width. */
  const [measured, setSize] = useState<{ w: number; h: number } | null>(null);
  const size = measured ?? { w: 1180, h: 540 };
  /** Null until someone zooms: the stage then picks a zoom that suits its width. */
  const [zoomSet, setZoomSet] = useState<number | null>(null);
  const [scrollLeft, setScrollLeft] = useState(0);
  const [scrub, setScrub] = useState<number | null>(null);
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [hotWeek, setHotWeek] = useState<number | null>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  const [probing, setProbing] = useState(false);
  const [sliderFocus, setSliderFocus] = useState(false);
  const [trayPref, setTrayPref] = useState<"open" | "closed" | null>(null);
  /** The mark that holds its lane's tab stop. */
  const [rove, setRove] = useState<string | null>(null);
  /** The finished item that holds the done strip's one tab stop. */
  const [sedRove, setSedRove] = useState<string | null>(null);
  /** The milestone flag that holds the date row's one tab stop. */
  const [flagRove, setFlagRove] = useState<string | null>(null);
  /** The "No date yet" row under the header: open unless someone folds it, or the screen is short. */
  const [eddyPref, setEddyPref] = useState<boolean | null>(null);
  /** Has the now line been moved yet? The first probe retires the hint. */
  const [probed, setProbed] = useState(false);
  const shortView = useSyncExternalStore(subscribeShort, () => window.matchMedia(SHORT).matches, () => false);
  const trayCollapsed = (trayPref ?? (shortView ? "closed" : "open")) === "closed";

  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      setSize({ w: entry.contentRect.width, h: entry.contentRect.height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const viewW = Math.max(320, size.w - HEADER_W);
  const [w0, w1] = r.openWindow;
  const fit = viewW / (w1 - w0 + 1);
  // Narrow stages open on about eight weeks, so labels keep their words.
  const zoom = zoomSet ?? (size.w <= 1100 ? Math.min(7, Math.max(1, (w1 - w0 + 1) / 56)) : 1);
  const ppd = fit * zoom;
  const canvasW = (r.r1 - r.r0 + 1) * ppd;
  const xAt = (day: number) => (day - r.r0 + 0.5) * ppd;
  const dayAt = (x: number) => Math.floor(x / ppd) + r.r0;

  const lanes = useLanes(r);
  const links = useDemoLinks();
  const nowX = xAt(0);
  const lineDay = r.probe ?? 0;
  const lineX = xAt(lineDay);

  // Keep the day under the pointer (or the now line) still while zooming;
  // land a new scope at the start of its window.
  useLayoutEffect(() => {
    const el = scrollerRef.current;
    if (!el || !measured) return;
    if (scopeSeen.current !== r.scope) {
      scopeSeen.current = r.scope;
      ppdSeen.current = ppd;
      const target = zoom === 1 ? (w0 - r.r0) * ppd : xAt(0) - viewW * NOW_AT;
      el.scrollLeft = Math.max(0, target);
      setScrollLeft(el.scrollLeft);
      return;
    }
    const anchor = anchorRef.current;
    const prevPpd = ppdSeen.current;
    ppdSeen.current = ppd;
    if (anchor) {
      anchorRef.current = null;
      el.scrollLeft = Math.max(0, (anchor.day - r.r0 + 0.5) * ppd - anchor.screenX);
      setScrollLeft(el.scrollLeft);
    } else if (prevPpd && prevPpd !== ppd) {
      // The stage was resized: keep the same day at the left edge.
      el.scrollLeft = Math.max(0, (el.scrollLeft / prevPpd) * ppd);
      setScrollLeft(el.scrollLeft);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ppd, r.scope, measured]);

  const zoomTo = (next: number, screenX?: number) => {
    const el = scrollerRef.current;
    const clamped = Math.min(7, Math.max(1, next));
    if (el) {
      const sx = screenX ?? Math.min(Math.max(nowX - el.scrollLeft, 0), viewW);
      const day = (el.scrollLeft + sx) / ppd + r.r0 - 0.5;
      anchorRef.current = { day, screenX: sx };
    }
    setZoomSet(clamped);
  };

  // Ctrl + wheel (and trackpad pinch) zooms; a plain wheel pans through time.
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const rect = el.getBoundingClientRect();
        const sx = e.clientX - rect.left - HEADER_W;
        const day = (el.scrollLeft + sx) / ppd + r.r0 - 0.5;
        anchorRef.current = { day, screenX: sx };
        setZoomSet(Math.min(7, Math.max(1, zoom * Math.exp(-e.deltaY * 0.004))));
        return;
      }
      if (Math.abs(e.deltaY) > Math.abs(e.deltaX) && el.scrollWidth > el.clientWidth + 2) {
        e.preventDefault();
        el.scrollLeft += e.deltaY;
      }
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [ppd, r.r0, zoom]);

  const canMove = (it: Item) =>
    !r.allProjects && it.kind === "task" && it.status !== "done" && it.due !== undefined && r.asOf === 0 && r.probe === null;

  const goToday = () => {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollTo({ left: Math.max(0, nowX - viewW * NOW_AT), behavior: glide() });
  };

  // Keyboard: 1 2 3 lenses, + and − zoom, T today, arrows step the tray week,
  // Alt with an arrow moves the selected item a day (Shift for a week).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      if (t?.getAttribute("role") === "slider") return;
      if (e.altKey && !e.metaKey && !e.ctrlKey && (e.key === "ArrowRight" || e.key === "ArrowLeft")) {
        const it = r.selected;
        if (it && canMove(it)) {
          e.preventDefault();
          r.moveItem(it.id, (e.key === "ArrowRight" ? 1 : -1) * (e.shiftKey ? 7 : 1));
        }
        return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "1") r.setLens("streams");
      else if (e.key === "2") r.setLens("people");
      else if (e.key === "t" || e.key === "T") goToday();
      else if (e.key === "+" || e.key === "=") zoomTo(zoom * 1.6);
      else if (e.key === "-" || e.key === "_") zoomTo(zoom / 1.6);
      else if (e.key === "Escape") {
        r.setSelectedId(null);
        r.setSpread(null);
        r.setPlacing(null);
        r.setLateOpen(false);
      } else if (e.key === "ArrowRight" && !r.selected) r.setFocusWeek(Math.min(r.focusWeek + 7, mondayOf(r.r1)));
      else if (e.key === "ArrowLeft" && !r.selected) r.setFocusWeek(Math.max(r.focusWeek - 7, mondayOf(r.r0)));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  // ── What is drawn ──────────────────────────────────────────────────
  const dragShifts = useMemo(() => (drag && drag.delta ? new Map([[drag.id, drag.delta]]) : null), [drag]);
  const spreadShifts = useMemo(
    () => (r.spread ? new Map(r.spread.moves.map((m) => [m.id, m.delta])) : null),
    [r.spread],
  );

  // One project: its open tasks as bars. Every project: each one's milestones and date as flags.
  const onRiver = useMemo(
    () => (r.allProjects ? r.marks.filter(isDated) : r.scoped.filter(isDated).filter((it) => openAt(it, r.asOf))),
    [r.allProjects, r.marks, r.scoped, r.asOf],
  );

  // Finished work sinks into the settled strip as labelled chips. Each chip
  // hangs as close to the day it settled as it can, the newest on top, with a
  // hairline back to its bead on that day.
  const tallStage = size.h > 900;
  const settledAll = useMemo(() => {
    const done = r.scoped
      .filter((it) => it.doneOn !== undefined && it.doneOn <= r.asOf)
      .sort((a, b) => b.doneOn! - a.doneOn! || a.id.localeCompare(b.id));
    const beadsAt = new Map<number, number>();
    const beads = done.map((it) => {
      const level = beadsAt.get(it.doneOn!) ?? 0;
      beadsAt.set(it.doneOn!, level + 1);
      return { item: it, x: xAt(it.doneOn!), level };
    });
    type Variant = { chips: { item: Item; x: number; w: number; row: number; bead: number }[]; hidden: number; rows: number; h: number };
    if (!done.length) return { beads, variants: [{ chips: [], hidden: 0, rows: 0, h: SED_EMPTY }] as Variant[] };
    const right0 = xAt(r.asOf) - ppd / 2 - 8;
    const attempt = (n: number) => {
      const cursor = Array.from({ length: n }, () => right0);
      const chips: { item: Item; x: number; w: number; row: number; bead: number }[] = [];
      let hidden = 0;
      for (const it of done) {
        const bead = xAt(it.doneOn!);
        const w = Math.min(196, Math.ceil(textWidth(it.title, 11.5) * 1.08) + 32);
        let row = 0;
        let right = -Infinity;
        cursor.forEach((c, k) => {
          const rr = Math.min(c, bead + w / 2);
          if (rr > right + 0.5) {
            right = rr;
            row = k;
          }
        });
        if (right - w < 4) {
          hidden += 1;
          continue;
        }
        cursor[row] = right - w - 6;
        chips.push({ item: it, x: right - w, w, row, bead });
      }
      return { chips, hidden };
    };
    // One row of labels, then more while some are still dots. The layout
    // picks the deepest one the stage has room for.
    const variants: Variant[] = [{ ...attempt(1), rows: 1, h: 22 + 26 + 4 }];
    while (variants[variants.length - 1].hidden && variants.length < (tallStage ? 3 : 2)) {
      const n = variants.length + 1;
      variants.push({ ...attempt(n), rows: n, h: 22 + n * 26 + 4 });
    }
    return { beads, variants };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [r.scoped, r.asOf, ppd, r.r0, tallStage]);

  // Lanes take the height their work needs. When the stage runs short, rows
  // come first from the lanes with the most slack, and no lane drops below
  // two rows: past that point the stage scrolls rather than hide work.
  const showOwner = r.lens !== "people" && !r.allProjects;
  // Milestone flags get a lane of their own under the dates, so a flag never sits on a date.
  const flagLane = !r.allProjects && r.marks.some((m) => !m.terminal && m.due !== undefined && m.due >= r.r0);
  const axisH = flagLane ? AXIS_H + FLAG_LANE_H : AXIS_H;
  // Where the stage opens: the left edge of the first view of the river.
  const landX = Math.max(0, zoom === 1 ? (w0 - r.r0) * ppd : nowX - viewW * NOW_AT);
  const layout = useMemo(() => {
    const sed0 = settledAll.variants[0].h;
    const avail = size.h - (axisH + RIBBON_H) - sed0 - 10;
    const byLane = lanes.map((lane) => onRiver.filter((it) => laneOf(it, r) === lane.id));
    // Late work labels sit just past the now line, so reserve that run too.
    const nowPx = (r.asOf - r.r0 + 0.5) * ppd;
    const restBadge = (it: Item) => {
      if (lateAt(it, r.asOf) && !it.terminal && isDated(it)) {
        const g = geometry(it, ppd, r.r0);
        return 74 + Math.max(0, nowPx + 10 - (g.x + g.w + 4));
      }
      return it.due === r.asOf ? 66 : 0;
    };
    // While forecasting, work that will be late wears its landing tail and a "Late" badge.
    const lateSoon = new Set(r.forecastLate.map((it) => it.id));
    const probeBadge = (it: Item) => {
      const base = restBadge(it);
      if (base || !lateSoon.has(it.id) || !isDated(it)) return base;
      const tail = it.eta && it.eta > it.due ? (it.eta - it.due) * ppd : 0;
      return tail + 4 + 42;
    };
    const pack = (list: (Item & { due: number })[], n: number, badge: (it: Item) => number) =>
      packLane(list, ppd, r.r0, n, badge, showOwner, landX + 8, Math.min(canvasW, landX + viewW) - 10);
    const memo = new Map<string, ReturnType<typeof pack>>();
    const at = (i: number, n: number) => {
      const key = `${i}:${n}`;
      if (!memo.has(key)) memo.set(key, pack(byLane[i], n, restBadge));
      return memo.get(key)!;
    };
    const rows = byLane.map((_, i) => at(i, MAX_ROWS).rowsUsed);
    const floor = rows.map((n) => Math.min(2, n));
    // Rows, plus a strip at the foot of the lane where finished work settles.
    const hOf = (n: number) => Math.max(62, 20 + n * ROW_H);
    const sum = () => rows.reduce((a, n) => a + hOf(n), 0);
    // Take each row from wherever giving it up costs the fewest words. Stop
    // before anything would lose its place: the stage scrolls instead.
    while (sum() > avail) {
      let best = -1;
      let cost = Infinity;
      rows.forEach((n, i) => {
        if (n <= floor[i]) return;
        const c = at(i, n - 1).loss - at(i, n).loss;
        if (c < cost || (c === cost && n > rows[best])) {
          cost = c;
          best = i;
        }
      });
      // Only give up a row when it costs no words at all; past that the stage scrolls.
      if (best < 0 || cost >= 1) break;
      rows[best] -= 1;
    }
    const badge = r.forecast !== null ? probeBadge : restBadge;
    const packed = byLane.map((list, i) => {
      let p = pack(list, rows[i], badge);
      // A forecast may need one more row to keep every label; it never takes one away.
      for (let n = rows[i] + 1; p.overflowed && n <= MAX_ROWS; n++) {
        p = pack(list, n, badge);
        rows[i] = n;
      }
      return p;
    });
    // Lanes keep the height their rows need. Spare room on a tall screen
    // deepens the pressure ribbon first; what is left becomes calm canvas below.
    const heights = rows.map((n) => hOf(n));
    let spare = Math.max(0, avail - heights.reduce((a, h) => a + h, 0));
    // Finished work gets more labelled rows only when the lanes leave room for them.
    let sed = 0;
    settledAll.variants.forEach((v, k) => {
      if (v.h - sed0 <= spare) sed = k;
    });
    spare -= settledAll.variants[sed].h - sed0;
    const ribbonH = Math.round(Math.min(RIBBON_MAX, RIBBON_H + spare * 0.5));
    const tops: number[] = [];
    let acc = axisH + ribbonH;
    for (const h of heights) {
      tops.push(acc);
      acc += h;
    }
    return { heights, tops, packed, bottom: acc, ribbonH, sed };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onRiver, ppd, r.r0, lanes, size.h, axisH, r.asOf, r.forecastLate, r.forecast, settledAll, showOwner, landX, viewW, canvasW]);
  const settled = { beads: settledAll.beads, ...settledAll.variants[layout.sed] };
  const { packed, tops, heights, ribbonH } = layout;
  const lanesTop = axisH + ribbonH;
  /** The ribbon's centre line, where the now handle rides. */
  const ribbonMid = axisH + 30 + (ribbonH - RIBBON_H) / 2;
  const lanesH = layout.bottom - lanesTop;
  // Finished work rests on the riverbed at the foot of the stage. A sliver of
  // spare height joins the bed; more stays as open water between the lanes and it.
  const fillH = size.h - 10 - layout.bottom;
  const sedH = fillH - (settled.h + 14) < 56 ? Math.max(settled.h, fillH) : settled.h + 14;
  const sedTop = layout.bottom + Math.max(0, fillH - sedH);
  // A tall screen spends its spare height on a second row of cards below,
  // not on empty water. The test adds back what that row takes, so it holds steady.
  const TRAY_ROW = 188;
  const [trayRows, setTrayRows] = useState<1 | 2>(1);
  const wantRows: 1 | 2 = size.h + (trayRows === 2 ? TRAY_ROW : 0) - (layout.bottom + settled.h + 10) > TRAY_ROW + 90 ? 2 : 1;
  if (wantRows !== trayRows) setTrayRows(wantRows);
  const canvasH = sedTop + sedH;
  const rowY = (li: number, row: number) => tops[li] + 7 + row * ROW_H;

  // A settled chip half behind the pinned lane names slides into view, as
  // long as it does not run into its neighbour.
  const chipX = (c: (typeof settled.chips)[number]) => {
    const edge = scrollLeft + 6;
    if (!(c.x < edge && c.x + c.w > scrollLeft)) return c.x;
    const next = settled.chips.filter((o) => o.row === c.row && o.x > c.x).reduce((m, o) => Math.min(m, o.x), Infinity);
    // No room to slide clear: step out of the way, the bead still marks it.
    return next - c.w - 6 >= edge ? edge : null;
  };

  // With every project in view, open tasks show as small ticks under their project's flags.
  const rugs = useMemo(
    () => (r.allProjects ? r.scoped.filter((it) => isDated(it) && openAt(it, r.asOf)) : []),
    [r.allProjects, r.scoped, r.asOf],
  );

  const late = (it: Item) => lateAt(it, r.asOf) && !it.terminal && it.kind === "task";
  const lateForecast = new Set(r.forecastLate.map((it) => it.id));
  // Vertical rules a label may cross: today, the moving line and the destination.
  // A label that crosses one gets a plate of canvas so the rule never cuts a word.
  const rules = [nowX, lineX, ...(r.destination ? [xAt(r.destination.due!)] : [])];
  const crossesRule = (p: Placed, shift: number) => {
    if (p.inside || p.bare) return false;
    const x = p.x + shift;
    const span = p.labelMax + (p.item.kind === "milestone" ? 56 : AVATAR_W) + p.badge;
    const [a, b] = p.item.kind === "milestone"
      ? p.left ? [x - span - 10, x - 8] : [x + 8, x + 12 + span]
      : p.left ? [x - span - 8, x - 2] : [x + p.w + 4, x + p.w + 8 + span];
    return rules.some((rx) => rx > a && rx < b);
  };
  const settledSince = new Set(r.replayDone.map((it) => it.id));

  // One river: behind the now line it carries what settled each week and
  // thins out; ahead of it, it swells with what is due.
  const flow = useMemo(
    () =>
      r.loads.map((l) => {
        const past = l.week + 7 <= r.asOf;
        const count = past
          ? r.scoped.filter((it) => it.doneOn !== undefined && it.doneOn >= l.week && it.doneOn < l.week + 7 && it.doneOn <= r.asOf).length
          : l.count;
        return { week: l.week, past, count };
      }),
    [r.loads, r.scoped, r.asOf],
  );
  const ribbon = useMemo(() => {
    const cy = ribbonMid - axisH;
    // A deeper ribbon swells further, so the shape of the weeks reads from across the room.
    const k = (ribbonH - 12) / (RIBBON_H - 12);
    const pts = flow.map((f) => ({
      x: xAt(f.week + 3),
      t: f.past ? Math.min(16 * k, (2 + f.count * 3) * k) : Math.min(42 * k, (2 + f.count * 5.6) * k),
      count: f.count,
      past: f.past,
    }));
    if (!pts.length) return { d: "", stops: [] as { o: number; c: string }[] };
    const top = [{ x: 0, t: pts[0].t }, ...pts, { x: canvasW, t: pts[pts.length - 1].t }];
    const seg = (arr: { x: number; t: number }[], sign: 1 | -1) =>
      arr
        .map((p, i) => {
          const y = cy - (sign * p.t) / 2;
          if (i === 0) return `${sign === 1 ? "M" : "L"}${p.x.toFixed(1)},${y.toFixed(1)}`;
          const prev = arr[i - 1];
          const py = cy - (sign * prev.t) / 2;
          const mx = (prev.x + p.x) / 2;
          return `C${mx.toFixed(1)},${py.toFixed(1)} ${mx.toFixed(1)},${y.toFixed(1)} ${p.x.toFixed(1)},${y.toFixed(1)}`;
        })
        .join(" ");
    const d = `${seg(top, 1)} ${seg([...top].reverse(), -1)} Z`;
    const stops = pts.map((p) => ({
      o: Math.min(1, Math.max(0, p.x / canvasW)),
      c: p.past ? "var(--rv-ribbon-settled)" : heatColor(p.count, r.capacity),
    }));
    return { d, stops };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flow, ppd, canvasW, ribbonH, r.capacity]);

  // ── Pointer handling ───────────────────────────────────────────────
  const canvasX = (clientX: number) => clientX - (canvasRef.current?.getBoundingClientRect().left ?? 0);

  const onCanvasMove = (e: ReactPointerEvent) => {
    if (dragRef.current || probeDrag.current) return;
    // Hover only points: the date follows the pointer, the tray changes on click.
    setScrub(dayAt(canvasX(e.clientX)));
  };

  const onCanvasClick = (e: ReactMouseEvent) => {
    if ((e.target as HTMLElement).closest("[data-stop]")) return;
    const day = dayAt(canvasX(e.clientX));
    if (r.placing) {
      r.place(day);
      return;
    }
    r.setSelectedId(null);
    r.setLateOpen(false);
    r.setFocusWeek(mondayOf(day));
  };

  const probeStart = (e: ReactPointerEvent<HTMLElement>) => {
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    probeDrag.current = true;
    setProbing(true);
    setProbed(true);
    setScrub(null);
    setHoverId(null);
  };
  const probeMove = (e: ReactPointerEvent<HTMLElement>) => {
    if (!probeDrag.current) return;
    const day = Math.round(canvasX(e.clientX) / ppd - 0.5) + r.r0;
    const clamped = Math.min(r.r1, Math.max(r.r0, day));
    r.setProbe(clamped === 0 ? null : clamped);
    // Keep the probe in view while dragging past an edge.
    const el = scrollerRef.current;
    if (el) {
      const rect = el.getBoundingClientRect();
      if (e.clientX > rect.right - 40) el.scrollLeft += 14;
      else if (e.clientX < rect.left + HEADER_W + 40) el.scrollLeft -= 14;
    }
  };
  const probeEnd = () => {
    if (!probeDrag.current) return;
    probeDrag.current = false;
    setProbing(false);
    r.setProbe(null);
  };
  const probeKey = (e: ReactKeyboardEvent) => {
    const step = e.shiftKey ? 7 : 1;
    const cur = r.probe ?? 0;
    if (e.key === "ArrowRight" || e.key === "ArrowLeft") setProbed(true);
    if (e.key === "ArrowRight") r.setProbe(Math.min(r.r1, cur + step) || null);
    else if (e.key === "ArrowLeft") r.setProbe(Math.max(r.r0, cur - step) || null);
    else if (e.key === "Escape" || e.key === "Enter" || e.key === " ") r.setProbe(null);
    else return;
    e.preventDefault();
  };

  const pillDown = (e: ReactPointerEvent<HTMLElement>, it: Item) => {
    if (!canMove(it)) return;
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = { id: it.id, x0: e.clientX, moved: false };
  };
  const pillMove = (e: ReactPointerEvent<HTMLElement>) => {
    const d = dragRef.current;
    if (!d) return;
    const dx = e.clientX - d.x0;
    if (!d.moved && Math.abs(dx) < 4) return;
    d.moved = true;
    setHoverId(null);
    const delta = Math.round(dx / ppd);
    if (!drag || drag.delta !== delta || drag.id !== d.id) setDrag({ id: d.id, delta });
  };
  const pillUp = (it: Item) => {
    const d = dragRef.current;
    dragRef.current = null;
    if (d?.moved) {
      // The click that follows a drag must not also toggle the selection.
      justDragged.current = true;
      if (drag?.delta) r.moveItem(it.id, drag.delta);
      setDrag(null);
    }
  };
  /** The summary's late action: list every late task in the tray and bring them into view. */
  const toggleLate = () => {
    const opening = !r.lateOpen;
    r.setSelectedId(null);
    r.setLateOpen(opening);
    const first = r.lateNow[0];
    if (!opening || !first?.due) return;
    const el = scrollerRef.current;
    const x = xAt(first.start ?? first.due);
    if (el && (x < el.scrollLeft || x > el.scrollLeft + viewW - 120)) el.scrollTo({ left: Math.max(0, x - 80), behavior: glide() });
  };
  const pillClick = (it: Item) => {
    if (justDragged.current) {
      justDragged.current = false;
      return;
    }
    setRove(it.id);
    r.setSelectedId(r.selected?.id === it.id ? null : it.id);
  };
  /** The done strip is one tab stop: the arrows walk through finished work. */
  const sedKey = (e: ReactKeyboardEvent, id: string) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft" && e.key !== "Home" && e.key !== "End") return;
    e.preventDefault();
    const at = sedOrder.indexOf(id);
    const next =
      e.key === "Home" ? sedOrder[0] : e.key === "End" ? sedOrder[sedOrder.length - 1] : sedOrder[at + (e.key === "ArrowRight" ? 1 : -1)];
    if (!next) return;
    setSedRove(next);
    canvasRef.current?.querySelector<HTMLElement>(`[data-done="${next}"]`)?.focus();
  };
  // Tab reaches each lane once; the arrows walk along a lane and between lanes.
  const markKey = (e: ReactKeyboardEvent, li: number, it: Item) => {
    if (e.altKey || e.metaKey || e.ctrlKey) return;
    const along = (lane: number) =>
      packed[lane].placed.slice().sort((a, b) => a.x - b.x || a.row - b.row);
    let target: Item | undefined;
    if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
      const list = along(li);
      const at = list.findIndex((p) => p.item.id === it.id);
      target = list[at + (e.key === "ArrowRight" ? 1 : -1)]?.item;
    } else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      const here = findPlaced(packed, it.id)?.p.x ?? 0;
      const dir = e.key === "ArrowDown" ? 1 : -1;
      for (let l = li + dir; l >= 0 && l < packed.length && !target; l += dir) {
        const list = along(l);
        if (list.length) target = list.reduce((a, b) => (Math.abs(b.x - here) < Math.abs(a.x - here) ? b : a)).item;
      }
    } else return;
    e.preventDefault();
    if (!target) return;
    setRove(target.id);
    canvasRef.current?.querySelector<HTMLElement>(`[data-mark="${target.id}"]`)?.focus();
  };

  const enterHot = (week: number) => {
    window.clearTimeout(hoverTimer.current);
    setHotWeek(week);
  };
  const leaveHot = () => {
    window.clearTimeout(hoverTimer.current);
    hoverTimer.current = window.setTimeout(() => {
      if (!r.spread) setHotWeek(null);
    }, 160);
  };

  // ── Header pieces ─────────────────────────────────────────────────
  const probeMode = r.probe === null ? null : r.probe > 0 ? "forecast" : "replay";
  const hoverItem = hoverId ? (r.scoped.find((it) => it.id === hoverId) ?? r.marks.find((it) => it.id === hoverId)) : undefined;
  const hotLoad = hotWeek !== null ? r.loads.find((l) => l.week === hotWeek) : undefined;
  const dest = r.destination;

  const sel = r.selected && r.probe === null && r.selected.due !== undefined ? r.selected : null;
  // While the late list is open, the late work stands out and everything else steps back.
  const related = r.lateOpen && r.lateNow.length ? new Set(r.lateNow.map((it) => it.id)) : null;
  // The done strip's keyboard order: left to right as drawn.
  const sedOrder = settled.beads
    .map((b) => ({ id: b.item.id, x: settled.chips.find((c) => c.item.id === b.item.id)?.x ?? b.x }))
    .sort((a, b) => a.x - b.x)
    .map((b) => b.id);
  const sedStop = sedRove && sedOrder.includes(sedRove) ? sedRove : sedOrder[sedOrder.length - 1];

  // The now handle keeps clear of the pinned lane headers and the right edge.
  const handleText =
    probeMode === "forecast"
      ? `${withDay(lineDay)}, ${r.forecastLate.length} late`
      : probeMode === "replay"
        ? `${withDay(lineDay)}, as it was`
        : `Today ${short(0)}`;
  const handleW = textWidth(handleText, 12) + 34;
  const minLeft = scrollLeft + 8;
  const maxRight = scrollLeft + viewW - 8;
  const handleShift =
    lineX - handleW / 2 < minLeft
      ? minLeft - (lineX - handleW / 2)
      : lineX + handleW / 2 > maxRight
        ? maxRight - (lineX + handleW / 2)
        : 0;

  // The pointer's date chip, only while nothing else is speaking for the line.
  const scrubChip =
    scrub !== null && !probing && !drag && r.probe === null && !sliderFocus && Math.abs(xAt(scrub) - lineX) > 84
      ? xAt(scrub)
      : null;
  const ticks = axisTicks(r.r0, r.r1, ppd);
  const firstTick = ticks.find((t) => t.week && (t.day - r.r0) * ppd >= scrollLeft - 1);
  // The first week in view always says which month it is.
  const tickText = (t: (typeof ticks)[number]) => (t === firstTick && /^[0-9]+$/.test(t.label) ? short(t.day) : t.label);

  // The destination names itself at the top of its line, in the date row. It
  // hangs to the left of its line, unless today's line would run through it.
  const destMeta = dest ? `${withDay(dest.due!)}${dest.due! > 0 ? `, ${relativeDays(dest.due!)}` : ""}` : "";
  const destW = dest ? textWidth(dest.title, 12.5) + textWidth(destMeta, 12) + 44 : 0;
  const destX = dest ? xAt(dest.due!) : 0;
  const destRight = dest ? [nowX, lineX].some((x) => x > destX - destW - 8 && x < destX + 4) : false;
  const destBox: [number, number] | null = dest ? (destRight ? [destX - 2, destX + destW] : [destX - destW, destX + 4]) : null;

  // Milestones sit as small flags on the date row; the tray lists them by week.
  // They are one tab stop: the arrows walk along them, Enter opens one below.
  const axisMarks = r.allProjects
    ? []
    : r.marks.filter((m) => !m.terminal && m.due !== undefined && m.due >= r.r0).sort((a, b) => a.due! - b.due!);
  const flagStop = flagRove && axisMarks.some((m) => m.id === flagRove) ? flagRove : (axisMarks.find((m) => m.due! >= 0) ?? axisMarks[0])?.id;
  const flagKey = (e: ReactKeyboardEvent, id: string) => {
    if (!["ArrowRight", "ArrowLeft", "Home", "End"].includes(e.key)) return;
    e.preventDefault();
    e.stopPropagation();
    const at = axisMarks.findIndex((m) => m.id === id);
    const next =
      e.key === "Home" ? axisMarks[0] : e.key === "End" ? axisMarks[axisMarks.length - 1] : axisMarks[at + (e.key === "ArrowRight" ? 1 : -1)];
    if (!next) return;
    setFlagRove(next.id);
    canvasRef.current?.querySelector<HTMLElement>(`[data-flag="${next.id}"]`)?.focus();
  };

  // Axis labels never collide: month starts claim their place first, then
  // weeks fill in where there is room. Labels also step aside for the
  // destination and for the line while it is away from today.
  const shownTicks = new Set<number>();
  {
    const boxes: [number, number][] = [];
    if (destBox) boxes.push(destBox);
    if (r.probe !== null) boxes.push([lineX - 28, lineX + 28]);
    const order = ticks
      .filter((t) => tickText(t))
      .sort((a, b) => Number(b === firstTick) - Number(a === firstTick) || Number(b.major) - Number(a.major) || a.day - b.day);
    for (const t of order) {
      const x0 = (t.day - r.r0) * ppd + 6;
      const x1 = x0 + textWidth(tickText(t), 11.5);
      if (boxes.every(([a, b]) => x1 + 10 <= a || x0 >= b + 10)) {
        shownTicks.add(t.day);
        boxes.push([x0, x1]);
      }
    }
  }

  const eddyOpen = !!r.placing || (eddyPref ?? !shortView);
  const minimapW = 120;
  const showMinimap = viewW >= 640;
  const mmScale = minimapW / canvasW;
  const zoomGroup = (
    <div className={s.zoomGroup} role="group" aria-label="Zoom">
      <button type="button" className={s.zoomBtn} aria-label="Zoom out" title="Zoom out (−)" disabled={zoom <= 1.01} onClick={() => zoomTo(zoom / 1.6)}>
        <Icon name="minus" size={14} />
      </button>
      <span className={s.zoomLabel} aria-live="polite">
        {zoom < 1.6 ? "Months" : zoom < 3.4 ? "Weeks" : "Days"}
      </span>
      <button type="button" className={s.zoomBtn} aria-label="Zoom in" title="Zoom in (+)" disabled={zoom >= 6.99} onClick={() => zoomTo(zoom * 1.6)}>
        <Icon name="plus" size={14} />
      </button>
    </div>
  );
  // The whole project at a glance, docked in the header so it never sits on work.
  // It starts where the work starts, so its window is a fair share of the bar.
  const minimap = showMinimap ? (
    <button
      type="button"
      className={s.minimap}
      style={{ width: minimapW }}
      aria-label={`Whole river, ${short(r.r0)} to ${short(r.r1)}. Click to jump there.`}
      title={`Whole river, ${short(r.r0)} to ${short(r.r1)}. Taller marks are fuller weeks. Click to jump.`}
      onClick={(e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const x = (e.clientX - rect.left) / mmScale;
        scrollerRef.current?.scrollTo({ left: Math.max(0, x - viewW / 2), behavior: glide() });
      }}
    >
      <svg width={minimapW} height={22} aria-hidden="true">
        {r.loads.map((l) => (
          <rect
            key={l.week}
            x={xAt(l.week) * mmScale}
            y={11 - Math.min(9, 1 + l.count * 1.3)}
            width={Math.max(1, 7 * ppd * mmScale - 1)}
            height={Math.min(18, 2 + l.count * 2.6)}
            rx={1}
            style={{ fill: heatColor(l.count, r.capacity) }}
          />
        ))}
        <rect x={nowX * mmScale - 1} y={0} width={2} height={22} className={s.mmNow} />
        {dest ? <rect x={destX * mmScale - 1} y={0} width={2} height={22} className={s.mmDest} /> : null}
      </svg>
      <span className={s.mmWindow} style={{ left: scrollLeft * mmScale, width: Math.min(minimapW, viewW * mmScale) }} />
    </button>
  ) : null;

  // Lane headers count from the store's selectors, so they add up to the summary.
  const project = r.allProjects ? null : r.projects[0];
  const streams = project ? byWorkstream(r.state, project.id) : [];
  const people = project ? peopleLoad(r.state, { project: project.id }) : [];
  const laneCounts = (lane: LaneDef): { open: number; late: number; done: number } => {
    // Looking back, the lanes count what the history says stood that day.
    if (r.asOf < 0) {
      const list = r.scoped.filter((it) => laneOf(it, r) === lane.id);
      return {
        open: list.filter((it) => it.status !== "done").length,
        late: list.filter((it) => lateAt(it, r.asOf)).length,
        done: list.filter((it) => it.status === "done").length,
      };
    }
    if (r.allProjects) {
      const list = r.state.tasks.filter((t) => t.project === lane.id);
      return { open: list.filter(isOpen).length, late: list.filter((t) => isLate(t)).length, done: list.filter((t) => !isOpen(t)).length };
    }
    if (lane.person) {
      const l = people.find((x) => x.person === lane.person);
      const done = r.scoped.filter((it) => it.owner === lane.person && it.status === "done").length;
      return { open: l?.open ?? 0, late: l?.late ?? 0, done };
    }
    const list = streams.find((w) => w.id === lane.id)?.tasks ?? [];
    return { open: list.filter(isOpen).length, late: list.filter((t) => isLate(t)).length, done: list.filter((t) => !isOpen(t)).length };
  };

  const health = r.scopeDef.health;
  const summary = probeMode ? (
    <p className={cx(s.summary, s.summaryProbe)} aria-live="polite">
      <span className={cx(s.sentenceTag, probeMode === "replay" && s.sentenceTagReplay)}>{probeMode === "forecast" ? "Looking ahead" : "Looking back"}</span>
      {r.probeSentence}
    </p>
  ) : (
    <p className={s.summary} aria-live="polite">
      {health ? <HealthPill health={health} /> : null}
      <span>
        {r.lead} <strong className={s.strong}>{r.counts.open}</strong> open,{" "}
        {r.counts.late ? (
          <button
            type="button"
            className={s.sentenceAction}
            aria-expanded={r.lateOpen}
            aria-controls="rv-tray"
            title={r.lateOpen ? "Back to the week" : `List the ${plural(r.counts.late, "late task")}`}
            onClick={toggleLate}
          >
            {r.counts.late} late
          </button>
        ) : (
          "none late"
        )}
        .
      </span>
    </p>
  );

  const undatedChip = r.undated.length ? (
    <button type="button" className={s.undatedChip} aria-expanded={eddyOpen} aria-controls="rv-undated" onClick={() => setEddyPref(!eddyOpen)}>
      No date yet
      <span className={s.eddyCount}>{r.undated.length}</span>
    </button>
  ) : null;
  // Work with no date yet is docked under the header, above the river: it pushes
  // the river down a row and never sits on a lane.
  const undatedDock =
    r.undated.length && eddyOpen ? (
      <div id="rv-undated" className={s.eddyDock} role="group" aria-label={`No date yet: ${plural(r.undated.length, "task")}`}>
        <ul className={s.eddyList}>
          {r.undated.map((it) => {
            const armed = r.placing?.id === it.id;
            return (
              <li key={it.id}>
                <button
                  type="button"
                  className={cx(s.eddyItem, armed && s.eddyItemOn)}
                  aria-pressed={armed}
                  onClick={() => r.setPlacing(armed ? null : { kind: "item", id: it.id })}
                >
                  <span className={s.laneSwatchSm} style={{ background: itemColor(it, r.allProjects) }} />
                  <span className={s.eddyName}>{it.title}</span>
                  <Avatar person={it.owner} size={16} />
                </button>
              </li>
            );
          })}
          <li className={s.eddyHint}>{r.placing ? "Now click the day it starts." : "Pick one, then click the day it starts."}</li>
        </ul>
      </div>
    ) : null;
  const lensRow = r.allProjects ? (
    <div className={s.lensRow}>
      <p className={s.lensNote}>One lane for each of the {r.projects.length} active projects, with their milestones.</p>
      {undatedChip}
    </div>
  ) : (
    <div className={s.lensRow}>
      <div className={s.segmented} role="radiogroup" aria-label="Lanes">
        {LENSES.map((l, i) => (
          <button
            key={l.id}
            type="button"
            role="radio"
            aria-checked={r.lens === l.id}
            tabIndex={r.lens === l.id ? 0 : -1}
            className={cx(s.seg, r.lens === l.id && s.segOn)}
            onClick={() => r.setLens(l.id)}
            onKeyDown={(e) => {
              if (!["ArrowRight", "ArrowLeft", "ArrowUp", "ArrowDown"].includes(e.key)) return;
              e.preventDefault();
              const next = LENSES[(i + (e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : LENSES.length - 1)) % LENSES.length];
              r.setLens(next.id);
              const group = e.currentTarget.parentElement;
              requestAnimationFrame(() => group?.querySelector<HTMLElement>('[aria-checked="true"]')?.focus());
            }}
            title={`${l.label} (${l.key})`}
          >
            {l.label}
          </button>
        ))}
      </div>
      {undatedChip}
    </div>
  );

  const bandH = axisH + ribbonH;

  return (
    <div
      className={cx(s.root, probing && s.isProbing, drag && s.isDragging, r.placing && s.isPlacing)}
      data-mode={probeMode ?? "now"}
    >
      <div className={s.top}>
        <PageHeader
          title="Overview"
          project={<ScopePicker value={r.scope} onPick={r.setScope} state={r.state} />}
          summary={summary}
          health={
            <>
              {lensRow}
              {undatedDock}
            </>
          }
          actions={
            <>
              {minimap}
              {zoomGroup}
              <button type="button" className={s.todayBtn} onClick={goToday} title="Back to today (T)">
                <Icon name="target" size={14} />
                Today
              </button>
            </>
          }
        />
      </div>

      <section className={s.stage} ref={stageRef} aria-label="River of time">
        <p id="rv-mark-help" className={s.srOnly}>
          Enter opens it below the river. Alt with the left or right arrow moves it a day, with Shift a week.
        </p>
        <div className={s.scroller} ref={scrollerRef} onScroll={(e) => setScrollLeft(e.currentTarget.scrollLeft)}>
          <div className={s.track} style={{ width: HEADER_W + canvasW, height: canvasH }}>
            {/* Lane headers stay pinned at the left edge as time scrolls. */}
            <div className={s.heads} style={{ width: HEADER_W, height: canvasH }}>
              {/* The corner stays put as the lanes scroll under it, like the band beside it. */}
              <div className={s.headBand} style={{ height: bandH }}>
                <div className={s.headRibbon} style={{ top: axisH, height: ribbonH }}>
                  <span className={s.headTitle}>How full each week is</span>
                  <span className={s.headSub}>
                    {r.capacity ? `The team finished ${r.capacity} in the last 7 days` : "Tasks due each week"}
                  </span>
                </div>
              </div>
              {lanes.map((lane, i) => {
                const laneItems = r.scoped.filter((it) => laneOf(it, r) === lane.id && it.due !== undefined && openAt(it, r.asOf));
                const c = laneCounts(lane);
                const next = laneItems.filter((it) => it.due! >= r.asOf).sort((a, b) => a.due! - b.due!)[0];
                // Say the whole next step, or just its date; never a clipped half.
                const nextFull = next ? `Next: ${next.title}, ${short(next.due!)}` : "";
                const twoLines = heights[i] >= 100;
                const nextText =
                  next && (twoLines || textWidth(nextFull, 12) <= HEADER_W - 60) ? nextFull : next ? `Next due ${short(next.due!)}` : "";
                return (
                  <div key={lane.id} className={s.head} style={{ top: tops[i], height: heights[i] }}>
                    <div className={s.headName}>
                      {lane.person ? <Avatar person={lane.person} size={20} /> : <span className={s.laneSwatch} style={{ background: lane.color }} />}
                      {lane.project ? (
                        <Link href={links.project(lane.project)} className={cx(s.headLabel, s.headLink)} prefetch={false}>
                          {lane.name}
                        </Link>
                      ) : (
                        <span className={s.headLabel}>{lane.name}</span>
                      )}
                    </div>
                    <div className={s.headMeta}>
                      {lane.person ? `${personRole(lane.person)} · ` : ""}
                      {c.open ? `${c.open} open` : c.done ? "All done" : "Nothing here yet"}
                      {c.late ? <span className={s.headLate}> · {c.late} late</span> : null}
                    </div>
                    {next && heights[i] >= 78 && !r.allProjects ? <div className={cx(s.headNext, twoLines && s.headNextTwo)}>{nextText}</div> : null}
                  </div>
                );
              })}
              <div className={s.headSed} style={{ top: sedTop, height: sedH }}>
                <span className={s.headTitle}>{r.asOf < 0 ? `Done by ${withDay(r.asOf)}` : "Done before today"}</span>
                <span className={s.headSub}>
                  {settled.beads.length ? `${plural(settled.beads.length, "task")} done` : "Nothing done yet"}
                </span>
              </div>
            </div>

            <div
              className={s.canvas}
              ref={canvasRef}
              style={{ width: canvasW, height: canvasH }}
              onPointerMove={onCanvasMove}
              onPointerLeave={() => setScrub(null)}
              onClick={onCanvasClick}
            >
              {/* The date row, the weekly band and today's handle stay at the top
                  of the river while the lanes scroll beneath them. */}
              <div className={s.band} style={{ width: canvasW, height: bandH }}>
                <div className={s.bandPast} style={{ width: Math.min(nowX, lineX) }} />
                {!r.selected && r.probe === null && !r.lateOpen ? (
                  <div className={s.focusCol} style={{ left: (r.focusWeek - r.r0) * ppd, width: 7 * ppd }} />
                ) : null}
                <div className={s.axis} style={{ height: axisH }}>
                  {ticks.map((t) => {
                    const x = (t.day - r.r0) * ppd;
                    const label = shownTicks.has(t.day) ? tickText(t) : "";
                    const w = textWidth(label, 11.5);
                    const covered = scrubChip !== null && x + 6 < scrubChip + 46 && x + 6 + w > scrubChip - 46;
                    return (
                      <div key={t.day} className={cx(s.tick, t.major && s.tickMajor)} style={{ left: x }}>
                        <span className={cx(s.tickLabel, mondayOf(t.day) === r.focusWeek && t.week && s.tickFocus, covered && s.tickCovered)}>
                          {label}
                        </span>
                      </div>
                    );
                  })}
                  {axisMarks.length ? (
                    <div className={s.flagLane} style={{ height: FLAG_LANE_H }} role="group" aria-label={`Big dates: ${axisMarks.length}. Arrow keys move between them.`}>
                      {axisMarks.map((m, k) => (
                        <button
                          key={m.id}
                          type="button"
                          data-stop
                          data-flag={m.id}
                          tabIndex={flagStop === m.id ? 0 : -1}
                          className={cx(s.axisMark, m.status === "done" && s.axisMarkDone, r.selected?.id === m.id && s.axisMarkOn)}
                          // Two milestones on one day sit side by side, not on top of each other.
                          style={{ left: xAt(m.due!) - 8 + axisMarks.slice(0, k).filter((o) => o.due === m.due).length * 13 }}
                          aria-label={`Big date: ${m.title}, ${withDay(m.due!)}, ${m.status === "done" ? "done" : relative(m.due!, r.asOf)}`}
                          aria-pressed={r.selected?.id === m.id}
                          title={`${m.title}, ${withDay(m.due!)}${m.status === "done" ? ", done" : ""}`}
                          onFocus={() => setFlagRove(m.id)}
                          onKeyDown={(e) => flagKey(e, m.id)}
                          onClick={() => {
                            setFlagRove(m.id);
                            r.setSelectedId(r.selected?.id === m.id ? null : m.id);
                          }}
                        >
                          <FlagGlyph size={9} />
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
                <svg className={s.ribbon} width={canvasW} height={ribbonH} style={{ top: axisH }} aria-hidden="true">
                  <defs>
                    <linearGradient id="rv-heat" x1="0" x2={canvasW} y1="0" y2="0" gradientUnits="userSpaceOnUse">
                      {ribbon.stops.map((st, i) => (
                        <stop key={i} offset={st.o} style={{ stopColor: st.c }} />
                      ))}
                    </linearGradient>
                  </defs>
                  <path d={ribbon.d} fill="url(#rv-heat)" className={s.ribbonPath} />
                </svg>
                {flow.map((f) => {
                  const over = !f.past && heatOf(f.count, r.capacity) === "over";
                  return (
                    <div
                      key={f.week}
                      data-stop
                      className={cx(s.ribbonHit, hotWeek === f.week && s.ribbonHitOn, f.past && s.ribbonHitPast)}
                      style={{ left: (f.week - r.r0) * ppd, width: 7 * ppd, top: axisH, height: ribbonH }}
                      onPointerEnter={() => {
                        if (!f.past) enterHot(f.week);
                      }}
                      onPointerLeave={leaveHot}
                      onClick={() => {
                        r.setSelectedId(null);
                        r.setLateOpen(false);
                        r.setFocusWeek(f.week);
                      }}
                    >
                      {/* A week too narrow for "14 due" shows the number alone; narrower still, nothing: a label is never cut. */}
                      {f.count >= 3 && 7 * ppd >= 26 ? (
                        <span
                          className={cx(s.heatLabel, f.past && s.heatSettled, over && s.heatOver)}
                          title={`${f.count} ${f.past ? "done" : "due"}, week of ${short(f.week)}`}
                        >
                          {f.count}
                          {7 * ppd >= 54 ? ` ${f.past ? "done" : "due"}` : ""}
                        </span>
                      ) : null}
                    </div>
                  );
                })}
                {/* Today's line, the destination and the scrubbed day carry on through the band. */}
                {r.probe !== null ? <div className={s.nowGhost} style={{ left: nowX, top: axisH, height: ribbonH }} /> : null}
                {dest ? <div className={s.destRule} style={{ left: destX, height: bandH }} /> : null}
                <div className={cx(s.now, probing && s.nowDragging, probeMode === "forecast" && s.nowForecast, probeMode === "replay" && s.nowReplay)} style={{ transform: `translateX(${lineX}px)`, height: bandH }}>
                  <div className={s.nowLine} />
                </div>
                {dest ? (
                  <div className={cx(s.destFlag, destRight && s.destFlagRight)} style={destRight ? { left: destX + 2 } : { right: canvasW - destX - 1 }}>
                    <FlagGlyph size={13} />
                    <span className={s.destTitle}>{dest.title}</span>
                    <span className={s.destMeta}>{destMeta}</span>
                  </div>
                ) : null}
                {scrubChip !== null ? (
                  <span className={s.scrubChip} style={{ left: scrubChip }}>
                    {withDay(scrub!)}
                  </span>
                ) : null}
                {/* The handle comes first in the tab order: the river's main control
                    should not sit behind every mark. */}
                <div
                  className={cx(s.nowTop, probing && s.nowDragging, probeMode === "forecast" && s.nowForecast, probeMode === "replay" && s.nowReplay)}
                  style={{ transform: `translateX(${lineX}px)`, top: ribbonMid - 12 }}
                >
                  <button
                    type="button"
                    data-stop
                    role="slider"
                    aria-label="Today line. Drag it, or use the arrow keys, to see later or earlier weeks"
                    aria-valuemin={r.r0}
                    aria-valuemax={r.r1}
                    aria-valuenow={lineDay}
                    aria-valuetext={withDay(lineDay)}
                    className={s.nowHandle}
                    style={{ "--shift": `${handleShift}px` } as CSSProperties}
                    onPointerDown={probeStart}
                    onPointerMove={probeMove}
                    onPointerUp={probeEnd}
                    onPointerCancel={probeEnd}
                    onKeyDown={probeKey}
                    onFocus={() => setSliderFocus(true)}
                    onBlur={() => {
                      setSliderFocus(false);
                      r.setProbe(null);
                    }}
                  >
                    <span className={s.nowGrip} aria-hidden="true" />
                    {handleText}
                  </button>
                  {!probeMode && !probed && !sel ? (
                    // The future is to the right, and so is the way to drag.
                    <span className={s.nowHint} style={{ left: handleW / 2 + 10 + handleShift }} aria-hidden="true">
                      Drag to see later weeks
                      <span className={s.nowHintArrow}>
                        <Icon name="arrow-right" size={12} />
                      </span>
                    </span>
                  ) : null}
                </div>
              </div>

              {/* Past wash: time already gone is quieter than the time ahead. */}
              <div className={s.past} style={{ width: Math.min(nowX, lineX) }} />
              {probeMode === "forecast" ? <div className={s.forecastWash} style={{ left: nowX, width: lineX - nowX }} /> : null}
              {dest ? (
                <div className={s.after} style={{ left: destX + ppd / 2, width: Math.max(0, canvasW - destX - ppd / 2) }} />
              ) : null}

              {/* The week the tray is showing. */}
              {!r.selected && r.probe === null && !r.lateOpen ? (
                <div className={s.focusCol} style={{ left: (r.focusWeek - r.r0) * ppd, width: 7 * ppd }} />
              ) : null}

              {ticks
                .filter((t) => t.week)
                .map((t) => (
                  <div
                    key={`g${t.day}`}
                    className={cx(s.grid, t.major && s.gridMajor, t.day <= 0 && s.gridPast)}
                    style={{ left: (t.day - r.r0) * ppd, top: bandH, height: canvasH - bandH - sedH }}
                  />
                ))}

              {/* Lanes */}
              {lanes.map((lane, i) => (
                <div key={lane.id} className={s.lane} style={{ top: tops[i], height: heights[i] }} />
              ))}

              {/* Each project's thread, with every project in view */}
              {r.allProjects
                ? lanes.map((lane, i) => {
                    const own = [...r.scoped, ...r.marks].filter((it) => it.project === lane.project && it.due !== undefined);
                    if (!own.length) return null;
                    const first = Math.max(r.r0, Math.min(...own.map((it) => it.start ?? it.due!)));
                    const last = Math.max(...own.map((it) => it.due!));
                    const y = tops[i] + heights[i] - 14;
                    return (
                      <div
                        key={`t${lane.id}`}
                        className={s.thread}
                        style={{ left: xAt(first), width: xAt(last) - xAt(first), top: y, background: lane.color }}
                      />
                    );
                  })
                : null}
              {rugs.map((it) => {
                const i = lanes.findIndex((l) => l.id === it.project);
                if (i < 0) return null;
                return (
                  <span
                    key={`rug${it.id}`}
                    className={cx(s.rug, late(it) && s.rugLate)}
                    style={{ left: xAt(it.due!) - 1, top: tops[i] + heights[i] - 19, background: itemColor(it, true) }}
                  />
                );
              })}

              {/* Finished work leaves a low mark in its own lane, on the day it was done. */}
              {!r.allProjects
                ? settled.beads.map((b) => {
                    const i = lanes.findIndex((l) => l.id === laneOf(b.item, r));
                    if (i < 0) return null;
                    return (
                      <span
                        key={`silt${b.item.id}`}
                        className={s.silt}
                        aria-hidden="true"
                        style={{ left: b.x - 6, top: tops[i] + heights[i] - 14, "--c": itemColor(b.item) } as CSSProperties}
                      >
                        <Icon name="check" size={9} />
                      </span>
                    );
                  })
                : null}

              {/* Tethers: late work hangs behind the line and is pulled toward it. */}
              <svg className={s.tethers} width={canvasW} height={canvasH} aria-hidden="true">
                {packed.flatMap((lp, li) =>
                  lp.placed
                    .filter((p) => late(p.item) && !settledSince.has(p.item.id))
                    .map((p) => {
                      const y = rowY(li, p.row) + PILL_H / 2;
                      const x1 = p.item.kind === "milestone" ? p.x + 6 : p.x + p.w;
                      const x2 = xAt(r.asOf);
                      if (x2 <= x1) return null;
                      const mid = (x1 + x2) / 2;
                      return (
                        <g key={`tether${p.item.id}`} className={s.tether}>
                          <path d={`M${x1},${y} Q${mid},${y + 10} ${x2 - 3},${y}`} />
                          <circle cx={x2} cy={y} r={3.5} />
                        </g>
                      );
                    }),
                )}
              </svg>

              {/* Items */}
              {packed.map((lp, li) => {
                const first = lp.placed.reduce<Placed | null>((a, b) => (!a || b.x < a.x ? b : a), null);
                const stop = lp.placed.some((p) => p.item.id === rove) ? rove : first?.item.id;
                return (
                  <div
                    key={`items${li}`}
                    className={s.laneItems}
                    role="group"
                    aria-label={`${lanes[li].name}: ${plural(lp.placed.length + lp.clusters.reduce((n, c) => n + c.items.length, 0), r.allProjects ? "big date" : "task")}. Arrow keys move between them.`}
                  >
                    {lp.placed.map((p) => {
                      const it = p.item;
                      const y = rowY(li, p.row);
                      const shift = (dragShifts?.get(it.id) ?? 0) + (spreadShifts?.get(it.id) ?? 0);
                      const isDragged = drag?.id === it.id;
                      const state = pillState(it, r.asOf, lateForecast.has(it.id), settledSince.has(it.id));
                      return (
                        <ItemMark
                          key={it.id}
                          p={p}
                          y={y}
                          shift={shift * ppd}
                          ghost={shift !== 0 && !isDragged}
                          dragged={isDragged}
                          color={itemColor(it, r.allProjects)}
                          state={state}
                          selected={r.selected?.id === it.id}
                          dim={related !== null && !related.has(it.id)}
                          asOf={r.asOf}
                          etaW={lateForecast.has(it.id) && it.eta && it.eta > it.due! ? (it.eta - it.due!) * ppd : 0}
                          showOwner={showOwner}
                          labelFrom={state === "late" ? xAt(r.asOf) - (p.x + shift * ppd) + 10 : 0}
                          slip={
                            it.slip && it.kind === "task" && !shift
                              ? { left: (it.slip.from - r.r0) * ppd - p.x, right: (it.slip.from - r.r0 + 1) * ppd - p.x }
                              : null
                          }
                          stick={p.inside ? Math.min(Math.max(0, scrollLeft - (p.x + shift * ppd) + 6), Math.max(0, p.w - 150)) : 0}
                          tabbable={stop === it.id}
                          knock={crossesRule(p, shift * ppd)}
                          onDown={(e) => pillDown(e, it)}
                          onMove={pillMove}
                          onUp={() => pillUp(it)}
                          onClick={() => pillClick(it)}
                          onKey={(e) => markKey(e, li, it)}
                          onFocus={() => setRove(it.id)}
                          onEnter={() => {
                            if (!dragRef.current && !probeDrag.current) setHoverId(it.id);
                          }}
                          onLeave={() => setHoverId((h) => (h === it.id ? null : h))}
                        />
                      );
                    })}
                    {lp.clusters.map((c) => (
                      <button
                        key={c.key}
                        type="button"
                        data-stop
                        tabIndex={-1}
                        className={cx(s.cluster, c.items.some((it) => lateForecast.has(it.id) || late(it)) && s.clusterLate, related && s.markDim)}
                        style={{ transform: `translate(${c.x}px, ${rowY(li, c.row)}px)` }}
                        onClick={() => {
                          r.setSelectedId(null);
                          r.setLateOpen(false);
                          r.setFocusWeek(c.week);
                        }}
                        title={c.items.map((it) => it.title).join(", ")}
                        aria-label={`${c.items.length} more in the week of ${long(c.week)}: ${c.items.map((it) => it.title).join(", ")}`}
                      >
                        +{c.items.length}
                      </button>
                    ))}
                  </div>
                );
              })}

              {/* Ghost origins while spreading a week or dragging */}
              {r.spread || drag
                ? packed.flatMap((lp, li) =>
                    lp.placed
                      .filter((p) => (spreadShifts?.get(p.item.id) ?? 0) + (dragShifts?.get(p.item.id) ?? 0) !== 0)
                      .map((p) => (
                        <div
                          key={`origin${p.item.id}`}
                          className={s.origin}
                          style={{
                            transform: `translate(${p.item.kind === "milestone" ? p.x - 7 : p.x}px, ${rowY(li, p.row)}px)`,
                            width: p.item.kind === "milestone" ? 14 : p.w,
                          }}
                        />
                      )),
                  )
                : null}

              {/* Finished work rests here, labelled, newest on the right. One tab stop for all of it. */}
              <div className={s.sediment} style={{ top: sedTop, height: sedH }} role="group" aria-label={`${r.asOf < 0 ? `Done by ${withDay(r.asOf)}` : "Done before today"}: ${plural(settled.beads.length, "task")}. Arrow keys move between them.`}>
                <svg className={s.leaders} width={canvasW} height={sedH} aria-hidden="true">
                  {settled.chips.map((c) => {
                    const y1 = 22 + c.row * 26;
                    const cx0 = chipX(c);
                    if (cx0 === null) return null;
                    const ax = Math.min(Math.max(c.bead, cx0 + 12), cx0 + c.w - 12);
                    return <path key={c.item.id} d={`M${c.bead},12 C${c.bead},${y1 - 6} ${ax},${14} ${ax},${y1}`} />;
                  })}
                </svg>
                {settled.beads.map((b, i) => {
                  const labelled = settled.chips.some((c) => c.item.id === b.item.id && chipX(c) !== null);
                  const cls = cx(s.bead, !labelled && s.beadHit, b.item.doneOn! > (b.item.due ?? 0) && s.beadLate, hoverId === b.item.id && s.beadOn);
                  const style = {
                    left: b.x - 4,
                    top: 8 + b.level * 10,
                    "--c": itemColor(b.item, r.allProjects),
                    animationDelay: `${Math.min(i * 45, 900)}ms`,
                  } as CSSProperties;
                  // Beads with a chip are only markers; the rest can be hovered or reached by the arrows.
                  return labelled ? (
                    <span key={b.item.id} className={cls} style={style} aria-hidden="true" />
                  ) : (
                    <button
                      key={b.item.id}
                      type="button"
                      data-stop
                      data-done={b.item.id}
                      tabIndex={sedStop === b.item.id ? 0 : -1}
                      className={cls}
                      style={style}
                      aria-label={`${b.item.title}, done ${long(b.item.doneOn!)}`}
                      onPointerEnter={() => setHoverId(b.item.id)}
                      onPointerLeave={() => setHoverId((h) => (h === b.item.id ? null : h))}
                      onFocus={() => setSedRove(b.item.id)}
                      onKeyDown={(e) => sedKey(e, b.item.id)}
                      onClick={() => r.setSelectedId(b.item.id)}
                    />
                  );
                })}
                {settled.chips.map((c, i) => {
                  const x = chipX(c);
                  if (x === null) return null;
                  return (
                    <button
                      key={c.item.id}
                      type="button"
                      data-stop
                      data-done={c.item.id}
                      tabIndex={sedStop === c.item.id ? 0 : -1}
                      className={cx(s.settledChip, r.selected?.id === c.item.id && s.settledChipOn, related && !related.has(c.item.id) && s.markDim)}
                      style={
                        {
                          left: x,
                          top: 22 + c.row * 26,
                          width: c.w,
                          "--c": itemColor(c.item, r.allProjects),
                          animationDelay: `${Math.min(120 + i * 60, 900)}ms`,
                        } as CSSProperties
                      }
                      aria-label={`${c.item.title}, done ${long(c.item.doneOn!)}`}
                      onPointerEnter={() => setHoverId(c.item.id)}
                      onPointerLeave={() => setHoverId((h) => (h === c.item.id ? null : h))}
                      onFocus={() => setSedRove(c.item.id)}
                      onKeyDown={(e) => sedKey(e, c.item.id)}
                      onClick={() => r.setSelectedId(r.selected?.id === c.item.id ? null : c.item.id)}
                    >
                      <span className={s.settledTick} aria-hidden="true">
                        <Icon name="check" size={11} />
                      </span>
                      <span className={s.settledName}>{c.item.title}</span>
                    </button>
                  );
                })}
              </div>

              {/* Destination line */}
              {dest ? <div className={s.dest} style={{ left: destX, top: bandH, height: canvasH - bandH }} /> : null}

              {/* Scrub hairline */}
              {scrub !== null && !probing && !drag && r.probe === null ? (
                <div className={s.scrub} style={{ left: xAt(scrub), top: bandH, height: canvasH - bandH }} />
              ) : null}

              {/* Placing ghost for undated work */}
              {r.placing && scrub !== null ? (
                <div className={s.placeGhost} style={{ left: xAt(scrub), top: lanesTop, height: lanesH }}>
                  <span className={s.placeChip}>Start on {withDay(scrub)}</span>
                </div>
              ) : null}

              {/* Today's resting place while the line is away */}
              {r.probe !== null ? <div className={s.nowGhost} style={{ left: nowX, top: bandH, height: canvasH - bandH }} /> : null}

              {/* The now line runs beneath the marks, so labels knock it out */}
              <div
                className={cx(s.now, probing && s.nowDragging, probeMode === "forecast" && s.nowForecast, probeMode === "replay" && s.nowReplay)}
                style={{ transform: `translateX(${lineX}px)`, height: canvasH }}
              >
                <div className={s.nowLine} />
              </div>
              {/* Hover is a tooltip only: what it is, whose it is and when. */}
              {hoverItem && hoverItem.id !== r.selected?.id && !drag && !probing && !hotLoad ? (
                <HoverCard
                  item={hoverItem}
                  r={r}
                  x={hoverX(hoverItem, xAt, ppd, r.r0)}
                  canvasW={canvasW}
                  canvasH={canvasH}
                  y={hoverY(hoverItem, packed, rowY, sedTop)}
                />
              ) : null}

              {/* A week's load, on hover over the band */}
              {hotLoad && hotLoad.count > 0 && !probing && !drag ? (
                <div
                  className={s.hotCard}
                  data-stop
                  style={{
                    // While previewing a spread, step aside so the ghost positions to the right stay visible.
                    left:
                      r.spread?.week === hotLoad.week
                        ? Math.max(8, xAt(hotLoad.week) - ppd / 2 - 352)
                        : Math.min(Math.max(8, xAt(hotLoad.week + 3) - 170), canvasW - 348),
                    top: lanesTop - 4,
                  }}
                  onPointerEnter={() => enterHot(hotLoad.week)}
                  onPointerLeave={leaveHot}
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className={s.hotHead}>
                    <span className={cx(s.hotHeat, heatOf(hotLoad.count, r.capacity) === "over" && s.heatOverChip)}>
                      {HEAT_WORD[heatOf(hotLoad.count, r.capacity)]}
                    </span>
                    <span className={s.hotTitle}>{hotLoad.week === mondayOf(0) ? "This week" : `Week of ${long(hotLoad.week)}`}</span>
                    <span className={s.hotCount}>{plural(hotLoad.count, "task")} due</span>
                  </div>
                  <ul className={s.hotList}>
                    {hotLoad.items
                      .slice()
                      .sort((a, b) => a.due! - b.due!)
                      .map((it) => {
                        const mv = r.spread?.moves.find((m) => m.id === it.id);
                        return (
                          <li key={it.id} className={cx(s.hotItem, mv && s.hotItemMoving)}>
                            <span className={s.hotDay}>{weekdayShort(it.due!)}</span>
                            <span className={s.laneSwatchSm} style={{ background: itemColor(it, r.allProjects) }} />
                            <span className={s.hotName}>{it.title}</span>
                            {mv ? (
                              <span className={s.hotMove}>
                                <Icon name="arrow-right" size={12} /> {short(it.due! + mv.delta)}
                              </span>
                            ) : (
                              <Avatar person={it.owner} size={18} />
                            )}
                          </li>
                        );
                      })}
                  </ul>
                  <div className={s.hotOwners}>
                    {ownerBreakdown(hotLoad.items).map((o) => (
                      <span key={o.person} className={s.hotOwner}>
                        <Avatar person={o.person} size={16} />
                        {personName(o.person)} {o.count}
                      </span>
                    ))}
                  </div>
                  {hotLoad.count >= 4 && r.asOf === 0 && !r.allProjects ? (
                    r.spread?.week === hotLoad.week ? (
                      <div className={s.hotActions}>
                        <p className={s.hotSuggest}>
                          {r.spread.moves.length
                            ? `Moving ${plural(r.spread.moves.length, "task")} a week or more later leaves ${hotLoad.count - r.spread.moves.length} here. Nothing moves past the day itself.`
                            : "Everything here is under way or has to happen before the day, so there is nothing safe to move."}
                        </p>
                        <div className={s.hotBtns}>
                          <button
                            type="button"
                            className={s.btnGhost}
                            onClick={() => {
                              r.setSpread(null);
                              setHotWeek(null);
                            }}
                          >
                            Not now
                          </button>
                          {r.spread.moves.length ? (
                            <button
                              type="button"
                              className={s.btnPrimary}
                              onClick={() => {
                                r.applySpread();
                                setHotWeek(null);
                              }}
                            >
                              Spread it
                            </button>
                          ) : null}
                        </div>
                      </div>
                    ) : (
                      <button type="button" className={s.spreadBtn} onClick={() => r.previewSpread(hotLoad.week)}>
                        <Icon name="spread" size={14} />
                        Spread this week
                        <span className={s.spreadHint}>Preview first</span>
                      </button>
                    )
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>
        </div>

        {/* A project with no tasks yet: say so, and say where tasks come from. */}
        {!r.allProjects && r.scopedNow.length === 0 ? (
          <div className={s.emptyRiver}>
            <p className={s.emptyTitle}>{r.projects[0].name} has no tasks yet</p>
            <p className={s.emptyBody}>
              Add a task with a date and it appears here as a bar on that date. Big dates show as flags on the date row.
            </p>
            <Link href={links.surface("tasks/board", undefined, { project: r.projects[0].id })} className={s.btnPrimary} prefetch={false}>
              Add tasks on the board
              <Icon name="arrow-right" size={14} />
            </Link>
          </div>
        ) : null}

        {r.toast ? (
          <div className={s.toast} role="status" key={r.toast.id}>
            <span>{r.toast.text}</span>
            {r.toast.undoSteps ? (
              <button type="button" className={s.toastUndo} onClick={r.undo}>
                <Icon name="undo" size={14} />
                Undo
              </button>
            ) : null}
            <button type="button" className={s.toastClose} aria-label="Dismiss" onClick={() => r.setToast(null)}>
              <Icon name="close" size={14} />
            </button>
          </div>
        ) : null}

      </section>

      <Tray river={r} rows={trayRows} collapsed={trayCollapsed} onToggle={() => setTrayPref(trayCollapsed ? "open" : "closed")} />
    </div>
  );
}

/** "in 8 days", "tomorrow". */
function relativeDays(day: number) {
  return day === 1 ? "tomorrow" : `in ${day} days`;
}

/** The project picker: the store's projects, the main seven first, each with its health. */
function ScopePicker({ value, onPick, state }: { value: ScopeId; onPick: (id: ScopeId) => void; state: River["state"] }) {
  const [open, setOpen] = useState(false);
  // Live: a health or date changed on Projects shows in the picker too.
  const list = useMemo(() => scopeList(state), [state]);
  const current = list.find((x) => x.id === value) ?? list[1];
  const menuRef = useRef<HTMLUListElement>(null);
  useEffect(() => {
    if (!open) return;
    menuRef.current?.querySelector<HTMLElement>('[aria-selected="true"]')?.focus();
  }, [open]);
  const onMenuKey = (e: ReactKeyboardEvent) => {
    const items = Array.from(menuRef.current?.querySelectorAll<HTMLElement>('[role="option"]') ?? []);
    const at = items.indexOf(document.activeElement as HTMLElement);
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      items[(at + (e.key === "ArrowDown" ? 1 : items.length - 1)) % items.length]?.focus();
    } else if (e.key === "Escape" || e.key === "Tab") {
      setOpen(false);
    }
  };
  return (
    <div className={s.scopeWrap}>
      <button type="button" className={s.scopeBtn} aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <span className={s.scopeDot} style={{ background: current.color }} />
        <span className={s.scopeName}>{current.label}</span>
        <span className={s.scopeHint}>{current.hint}</span>
        <Icon name="chevron-down" size={14} />
      </button>
      {open ? (
        <>
          <div className={s.scrimClear} onClick={() => setOpen(false)} />
          <ul className={s.scopeMenu} role="listbox" aria-label="Project" ref={menuRef} onKeyDown={onMenuKey}>
            {list.map((sc) => (
              <li key={sc.id} className={cx(sc.split && s.scopeSplit)}>
                <button
                  type="button"
                  role="option"
                  aria-selected={sc.id === value}
                  className={cx(s.scopeOption, sc.id === value && s.scopeOptionOn)}
                  onClick={() => {
                    onPick(sc.id);
                    setOpen(false);
                  }}
                >
                  <span className={s.scopeDot} style={{ background: sc.color }} />
                  <span className={s.scopeOptionText}>
                    <span>{sc.label}</span>
                    <span className={s.scopeOptionHint}>
                      {sc.health ? (
                        <>
                          <HealthMark health={sc.health} size={12} />
                          {HEALTH_WORDS[sc.health]} · {sc.hint}
                        </>
                      ) : (
                        sc.hint
                      )}
                    </span>
                  </span>
                  {sc.id === value ? <Icon name="check" size={14} /> : null}
                </button>
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </div>
  );
}

// ── Item marks ──────────────────────────────────────────────────────────

type PillState = "open" | "late" | "today" | "forecastLate" | "replay";

function pillState(it: Item, asOf: number, forecastLate: boolean, settledSince: boolean): PillState {
  if (lateAt(it, asOf)) return "late";
  if (forecastLate) return "forecastLate";
  if (settledSince) return "replay";
  if (it.due === asOf) return "today";
  return "open";
}

function ItemMark(props: {
  p: Placed;
  y: number;
  shift: number;
  ghost: boolean;
  dragged: boolean;
  color: string;
  state: PillState;
  selected: boolean;
  /** Another item is selected and this one is not linked to it. */
  dim: boolean;
  asOf: number;
  etaW: number;
  showOwner: boolean;
  /** Push an outside label past this x (relative to the pill), e.g. past the now line. */
  labelFrom: number;
  /** Slide an inside label right so it stays readable when the pill starts off screen. */
  stick: number;
  /** Holds its lane's single tab stop. */
  tabbable: boolean;
  /** The label crosses a vertical rule, so it sits on a plate of canvas. */
  knock: boolean;
  /** Where its date was before it slipped later, in px from the bar's left edge. */
  slip: { left: number; right: number } | null;
  onDown: (e: ReactPointerEvent<HTMLElement>) => void;
  onMove: (e: ReactPointerEvent<HTMLElement>) => void;
  onUp: () => void;
  onClick: () => void;
  onKey: (e: ReactKeyboardEvent) => void;
  onFocus: () => void;
  onEnter: () => void;
  onLeave: () => void;
}) {
  const { p, y, shift, color, state } = props;
  const it = p.item;
  const lateDays = state === "late" ? props.asOf - it.due! : 0;
  const badge =
    state === "late" ? `${lateDays} ${lateDays === 1 ? "day" : "days"} late` : state === "today" ? "Due today" : state === "forecastLate" ? "Late" : null;
  const common = {
    "data-stop": true,
    "data-mark": it.id,
    type: "button" as const,
    tabIndex: props.tabbable ? 0 : -1,
    onPointerDown: props.onDown,
    onPointerMove: props.onMove,
    onPointerUp: props.onUp,
    onClick: props.onClick,
    onKeyDown: props.onKey,
    onFocus: props.onFocus,
    onPointerEnter: props.onEnter,
    onPointerLeave: props.onLeave,
    "aria-label": `${it.title}, ${it.kind === "milestone" ? "big date" : personName(it.owner)}, ${dueText(it, props.asOf)}${
      it.slip ? `, moved from ${short(it.slip.from)}` : ""
    }${badge ? `, ${badge.toLowerCase()}` : ""}`,
    "aria-pressed": props.selected,
    "aria-describedby": "rv-mark-help",
  };
  const cls = cx(
    s.mark,
    s[`st_${state}`],
    props.selected && s.markSelected,
    props.dim && s.markDim,
    props.dragged && s.markDragged,
    props.ghost && s.markMoving,
    it.status === "review" && s.markReview,
    it.status === "doing" && s.markDoing,
  );
  if (it.kind === "milestone") {
    return (
      <button
        {...common}
        className={cx(cls, s.flag, p.left && s.flagLeft, props.knock && s.knock)}
        style={
          {
            transform: p.left ? `translate(calc(${p.x + 7 + shift}px - 100%), ${y}px)` : `translate(${p.x - 7 + shift}px, ${y}px)`,
            "--c": color,
          } as CSSProperties
        }
      >
        <span className={s.flagIcon}>
          <FlagGlyph size={12} />
        </span>
        {!p.bare ? (
          <>
            <span className={s.flagText} style={{ maxWidth: p.labelMax }}>
              <span className={s.flagTitle}>{it.title}</span>
              <span className={s.flagDate}>{short(it.due!)}</span>
            </span>
            {badge ? <span className={s.badge}>{badge}</span> : null}
          </>
        ) : null}
      </button>
    );
  }
  return (
    <button
      {...common}
      className={cx(cls, s.pill, props.knock && s.knock)}
      style={{ transform: `translate(${p.x + shift}px, ${y}px)`, width: p.w, "--c": color } as CSSProperties}
    >
      {/* A date that slipped keeps a faint ghost where it was: an outline on the old
          day when that is clear of the bar, a dashed end mark when it falls inside it. */}
      {props.slip && props.slip.right <= 0 && !p.left ? (
        <>
          <span className={s.slipGhost} style={{ left: props.slip.left, width: Math.max(6, props.slip.right - props.slip.left) }} aria-hidden="true" />
          <span className={s.slipLink} style={{ left: props.slip.right, width: -props.slip.right }} aria-hidden="true" />
        </>
      ) : null}
      <span className={s.pillBody} />
      {props.slip && props.slip.right > 6 && props.slip.right < p.w - 4 ? (
        <span className={s.slipTick} style={{ left: props.slip.right }} aria-hidden="true" />
      ) : null}
      {props.etaW ? <span className={s.etaTail} style={{ width: props.etaW }} /> : null}
      {p.bare ? (
        // No room for words: the bar and its owner, with the title on hover.
        props.showOwner ? (
          <span className={s.pillAvatarIn} style={p.w < 22 ? { left: p.w + 4 } : undefined}>
            <Avatar person={it.owner} size={16} />
          </span>
        ) : null
      ) : (
        <span
          className={cx(s.pillContent, !p.inside && s.pillContentOut, p.left && s.pillContentLeft)}
          style={
            p.inside
              ? props.stick
                ? { transform: `translateX(${props.stick}px)` }
                : undefined
              : p.left
                ? undefined
                : ({ left: Math.max(p.w + 6 + props.etaW, props.labelFrom) } as CSSProperties)
          }
        >
          {props.showOwner ? <Avatar person={it.owner} size={16} /> : null}
          <span className={s.pillLabel} style={{ maxWidth: p.labelMax }}>
            {it.title}
          </span>
          {badge ? <span className={s.badge}>{badge}</span> : null}
        </span>
      )}
    </button>
  );
}

function HoverCard({ item, r, x, y, canvasW, canvasH }: { item: Item; r: River; x: number; y: number; canvasW: number; canvasH: number }) {
  const done = item.doneOn !== undefined && item.doneOn <= r.asOf;
  const left = Math.min(Math.max(8, x), canvasW - 300);
  const above = y > canvasH - 170;
  const project = r.projects.find((p) => p.id === item.project);
  return (
    <div className={s.hover} style={{ left, top: above ? undefined : y, bottom: above ? canvasH - y + 34 : undefined }} role="tooltip">
      <div className={s.hoverTop}>
        <span className={s.laneSwatchSm} style={{ background: itemColor(item, r.allProjects) }} />
        <span className={s.hoverLane}>{r.allProjects || !item.lane ? project?.short : laneName(item)}</span>
        <StatusChip item={item} asOf={r.asOf} />
      </div>
      <div className={s.hoverTitle}>{item.title}</div>
      <div className={s.hoverMeta}>
        {item.kind === "task" ? (
          <>
            <Avatar person={item.owner} size={16} /> {personName(item.owner)}
            <span className={s.dotSep} aria-hidden="true" />
          </>
        ) : null}
        {done ? `Done ${long(item.doneOn!)}` : dueText(item, r.asOf)}
      </div>
      {item.waitingOn && !done ? <div className={s.hoverDeps}>Waiting on {item.waitingOn}</div> : null}
      {item.slip && !done ? (
        <div className={s.hoverDeps}>
          Moved from {short(item.slip.from)} on {withDay(item.slip.on)}.
        </div>
      ) : null}
      {!done && item.eta && item.due !== undefined && item.eta > item.due && r.forecast !== null ? (
        <div className={s.hoverWarn}>
          <Icon name="clock" size={13} /> At the recent pace it lands {short(item.eta)}, {plural(item.eta - item.due, "day")} after its date.
        </div>
      ) : null}
      {item.note ? <p className={s.hoverNote}>{item.note}</p> : null}
      {item.kind === "task" ? (
        <div className={s.hoverHint}>{!done && !r.allProjects && r.asOf === 0 ? "Click to open it below. Drag to move it." : "Click to open it below."}</div>
      ) : null}
    </div>
  );
}

function hoverX(item: Item, xAt: (d: number) => number, ppd: number, r0: number) {
  if (item.doneOn !== undefined && item.doneOn <= 0 && item.status === "done" && item.kind === "task") return xAt(item.doneOn) - 20;
  if (item.due === undefined) return 0;
  const g = geometry(item as Item & { due: number }, ppd, r0);
  return g.x;
}

function hoverY(item: Item, packed: { placed: Placed[] }[], rowY: (li: number, row: number) => number, bottom: number) {
  for (let li = 0; li < packed.length; li++) {
    const p = packed[li].placed.find((x) => x.item.id === item.id);
    if (p) return rowY(li, p.row) + PILL_H + 6;
  }
  return bottom;
}

function findPlaced(packed: { placed: Placed[] }[], id: string) {
  for (let lane = 0; lane < packed.length; lane++) {
    const p = packed[lane].placed.find((x) => x.item.id === id);
    if (p) return { lane, p };
  }
  return null;
}

function axisTicks(r0: number, r1: number, ppd: number) {
  const out: { day: number; label: string; major: boolean; week: boolean }[] = [];
  const daily = ppd >= 26;
  for (let d = r0; d <= r1; d++) {
    const isMon = weekday(d) === 0;
    const first = isFirstOfMonth(d);
    if (daily) {
      out.push({
        day: d,
        label: first || d === r0 ? `${dateOf(d)} ${monthShort(d)}` : `${weekdayShort(d).charAt(0)} ${dateOf(d)}`,
        major: isMon,
        week: isMon,
      });
    } else if (isMon) {
      const monthChanged = dateOf(d) <= 7;
      // Too tight for every week: label month starts only.
      const sparse = ppd * 7 < 34;
      const label = sparse ? (monthChanged ? monthShort(d) : "") : monthChanged || ppd * 7 > 90 ? short(d) : String(dateOf(d));
      out.push({ day: d, label, major: monthChanged, week: true });
    }
  }
  return out;
}


