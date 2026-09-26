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
import {
  type Item,
  PERSON,
  PROJECTS,
  SCOPES,
  dateOf,
  isFirstOfMonth,
  long,
  mondayOf,
  monthShort,
  short,
  weekday,
  weekdayShort,
  withDay,
} from "./data";
import {
  type Lens,
  type Placed,
  cascade,
  dependentsOf,
  geometry,
  heatColor,
  heatOf,
  isDated,
  itemColor,
  laneKey,
  lanesFor,
  lateAt,
  openAt,
  ownerBreakdown,
  packLane,
  plural,
  textWidth,
  WS_COLOR,
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
const LANES_TOP = AXIS_H + RIBBON_H;
const SED_EMPTY = 54;
const ROW_H = 24;
const PILL_H = 20;
/** Most rows a lane may ask for before its extras share a "+N". */
const MAX_ROWS = 10;
/** Where today sits across the stage at the widest zoom. */
const NOW_AT = 0.22;

/** Short screens fold the tray to one line so the river keeps its height. */
const SHORT = "(max-height: 820px)";
function subscribeShort(cb: () => void) {
  const mq = window.matchMedia(SHORT);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
}

const LENSES: { id: Lens; label: string; key: string }[] = [
  { id: "streams", label: "Workstreams", key: "1" },
  { id: "people", label: "People", key: "2" },
  { id: "projects", label: "Projects", key: "3" },
];

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

  const [size, setSize] = useState({ w: 1180, h: 540 });
  /** Null until someone zooms: the stage then picks a zoom that suits its width. */
  const [zoomSet, setZoomSet] = useState<number | null>(null);
  const [scrollLeft, setScrollLeft] = useState(0);
  const [scrub, setScrub] = useState<number | null>(null);
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [hotWeek, setHotWeek] = useState<number | null>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  const [probing, setProbing] = useState(false);
  const [scopeOpen, setScopeOpen] = useState(false);
  const [sliderFocus, setSliderFocus] = useState(false);
  const [trayPref, setTrayPref] = useState<"open" | "closed" | null>(null);
  /** The mark that holds its lane's tab stop. */
  const [rove, setRove] = useState<string | null>(null);
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
  const [w0, w1] = r.scopeDef.window;
  const fit = viewW / (w1 - w0 + 1);
  // Narrow stages open on about eight weeks, so labels keep their words.
  const zoom = zoomSet ?? (size.w <= 1100 ? Math.min(7, Math.max(1, (w1 - w0 + 1) / 56)) : 1);
  const ppd = fit * zoom;
  const canvasW = (r.r1 - r.r0 + 1) * ppd;
  const xAt = (day: number) => (day - r.r0 + 0.5) * ppd;
  const dayAt = (x: number) => Math.floor(x / ppd) + r.r0;

  const lanes = lanesFor(r.lens);
  const nowX = xAt(0);
  const lineDay = r.probe ?? 0;
  const lineX = xAt(lineDay);

  // Keep the day under the pointer (or the now line) still while zooming;
  // land a new scope at the start of its window.
  useLayoutEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
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
  }, [ppd, r.scope]);

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
    r.lens !== "projects" && it.status !== "done" && !it.terminal && it.due !== undefined && r.asOf === 0 && r.probe === null;

  const goToday = () => {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollTo({ left: Math.max(0, nowX - viewW * NOW_AT), behavior: "smooth" });
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
      else if (e.key === "3") r.setLens("projects");
      else if (e.key === "t" || e.key === "T") goToday();
      else if (e.key === "+" || e.key === "=") zoomTo(zoom * 1.6);
      else if (e.key === "-" || e.key === "_") zoomTo(zoom / 1.6);
      else if (e.key === "Escape") {
        r.setSelectedId(null);
        r.setSpread(null);
        r.setPlacing(null);
        setScopeOpen(false);
      } else if (e.key === "ArrowRight" && !r.selected) r.setFocusWeek(Math.min(r.focusWeek + 7, mondayOf(r.r1)));
      else if (e.key === "ArrowLeft" && !r.selected) r.setFocusWeek(Math.max(r.focusWeek - 7, mondayOf(r.r0)));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  // ── What is drawn ──────────────────────────────────────────────────
  const dragShifts = useMemo(
    () => (drag && drag.delta ? cascade(r.scoped, drag.id, drag.delta) : null),
    [drag, r.scoped],
  );
  const spreadShifts = useMemo(
    () => (r.spread ? new Map(r.spread.moves.map((m) => [m.id, m.delta])) : null),
    [r.spread],
  );

  const onRiver = useMemo(
    () =>
      r.scoped
        .filter(isDated)
        .filter((it) => !(it.terminal && r.lens !== "projects"))
        .filter((it) => openAt(it, r.asOf) || (r.lens === "projects" && it.kind === "milestone"))
        .filter((it) => r.lens !== "projects" || it.kind === "milestone"),
    [r.scoped, r.lens, r.asOf],
  );

  // Finished work sinks into the settled strip as labelled chips. Each chip
  // hangs as close to the day it settled as it can, the newest on top, with a
  // hairline back to its bead on that day.
  const tallStage = size.h > 900;
  const settledAll = useMemo(() => {
    const done = r.scoped
      .filter((it) => it.doneOn !== undefined && it.doneOn <= r.asOf && !it.terminal)
      .sort((a, b) => b.doneOn! - a.doneOn!);
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
  const showOwner = r.lens !== "people";
  // Where the stage opens: the left edge of the first view of the river.
  const landX = Math.max(0, zoom === 1 ? (w0 - r.r0) * ppd : nowX - viewW * NOW_AT);
  const layout = useMemo(() => {
    const sed0 = settledAll.variants[0].h;
    const avail = size.h - LANES_TOP - sed0 - 10;
    const byLane = lanes.map((lane) => onRiver.filter((it) => laneKey(it, r.lens) === lane.id));
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
      packLane(list, ppd, r.r0, n, badge, showOwner, landX + 8);
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
      // Only give up a row when it costs almost nothing; past that the stage scrolls.
      if (best < 0 || cost >= 2) break;
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
    let acc = AXIS_H + ribbonH;
    for (const h of heights) {
      tops.push(acc);
      acc += h;
    }
    return { heights, tops, packed, bottom: acc, ribbonH, sed };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onRiver, ppd, r.r0, r.lens, size.h, r.asOf, r.forecastLate, r.forecast, settledAll, showOwner, landX]);
  const settled = { beads: settledAll.beads, ...settledAll.variants[layout.sed] };
  const { packed, tops, heights, ribbonH } = layout;
  const lanesTop = AXIS_H + ribbonH;
  /** The ribbon's centre line, where the now handle rides. */
  const ribbonMid = AXIS_H + 30 + (ribbonH - RIBBON_H) / 2;
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

  const rugs = useMemo(
    () =>
      r.lens === "projects"
        ? r.scoped.filter((it) => isDated(it) && it.kind === "task" && openAt(it, r.asOf))
        : [],
    [r.lens, r.scoped, r.asOf],
  );

  const late = (it: Item) => lateAt(it, r.asOf) && !it.terminal;
  const clashLevels: number[] = [];
  r.clashes.forEach((c, ci) => {
    const prev = r.clashes[ci - 1];
    const near = prev && Math.abs(xAt(c.day) - xAt(prev.day)) < 140;
    clashLevels.push(near ? 1 - clashLevels[ci - 1] : 0);
  });
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
  const settledSince = new Set(r.replaySettled.map((it) => it.id));

  // One river: behind the now line it carries what settled each week and
  // thins out; ahead of it, it swells with what is due.
  const flow = useMemo(
    () =>
      r.loads.map((l) => {
        const past = l.week + 7 <= r.asOf;
        const count = past
          ? r.scoped.filter(
              (it) => it.doneOn !== undefined && !it.terminal && it.doneOn >= l.week && it.doneOn < l.week + 7 && it.doneOn <= r.asOf,
            ).length
          : l.count;
        return { week: l.week, past, count };
      }),
    [r.loads, r.scoped, r.asOf],
  );
  const ribbon = useMemo(() => {
    const cy = ribbonMid - AXIS_H;
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
      c: p.past ? "var(--rv-ribbon-settled)" : heatColor(heatOf(p.count)),
    }));
    return { d, stops };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flow, ppd, canvasW, ribbonH]);

  // ── Pointer handling ───────────────────────────────────────────────
  const canvasX = (clientX: number) => clientX - (canvasRef.current?.getBoundingClientRect().left ?? 0);

  const onCanvasMove = (e: ReactPointerEvent) => {
    if (dragRef.current || probeDrag.current) return;
    const day = dayAt(canvasX(e.clientX));
    setScrub(day);
    if (!r.selected && !r.spread && r.probe === null) {
      const wk = mondayOf(day);
      if (wk !== r.focusWeek) r.setFocusWeek(wk);
    }
  };

  const onCanvasClick = (e: ReactMouseEvent) => {
    if ((e.target as HTMLElement).closest("[data-stop]")) return;
    const day = dayAt(canvasX(e.clientX));
    if (r.placing) {
      r.place(day);
      return;
    }
    r.setSelectedId(null);
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
    if (r.lens === "projects" || it.status === "done" || r.asOf < 0) return;
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
  // Mouse, Enter and Space all arrive here.
  const pillClick = (it: Item) => {
    if (justDragged.current) {
      justDragged.current = false;
      return;
    }
    setRove(it.id);
    r.setSelectedId(r.selected?.id === it.id ? null : it.id);
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
  const scopeLabel = SCOPES.find((x) => x.id === r.scope)!;
  const probeMode = r.probe === null ? null : r.probe > 0 ? "forecast" : "replay";
  const hoverItem = hoverId ? r.scoped.find((it) => it.id === hoverId) : undefined;
  const hotLoad = hotWeek !== null ? r.loads.find((l) => l.week === hotWeek) : undefined;
  const dest = r.destination;

  // Selection: the chosen item, what it waits on and what it holds up.
  const sel = r.selected && r.probe === null && r.selected.due !== undefined ? r.selected : null;
  const selLinks: [string, string][] = sel
    ? [
        ...(sel.after ?? []).map((id) => [id, sel.id] as [string, string]),
        ...dependentsOf(r.scoped, sel.id).map((d) => [sel.id, d.id] as [string, string]),
      ]
    : [];
  const related = sel ? new Set<string>([sel.id, ...selLinks.flat()]) : null;

  // The now handle keeps clear of the pinned lane headers and the right edge.
  const handleText =
    probeMode === "forecast"
      ? `${withDay(lineDay)} · ${r.forecastLate.length} late`
      : probeMode === "replay"
        ? `${withDay(lineDay)} · as it was`
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

  // The destination names itself at the top of its line, in the axis row.
  const destMeta = dest ? `${withDay(dest.due!)}${dest.due! > 0 ? `, ${plural(dest.due!, "day")}` : dest.due === -1 ? ", yesterday" : ""}` : "";
  const destW = dest ? textWidth(dest.title, 12.5) + textWidth(destMeta, 12) + 44 : 0;

  // Axis labels never collide: month starts claim their place first, then
  // weeks fill in where there is room. Labels also step aside for the
  // destination and for the line while it is away from today.
  const shownTicks = new Set<number>();
  {
    const boxes: [number, number][] = [];
    if (dest) boxes.push([xAt(dest.due!) - destW, xAt(dest.due!) + 4]);
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

  const minimapW = 120;
  // On a narrow stage the floating dock would sit on work, so zoom joins the header.
  const dockInHeader = viewW < 880;
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
  const mmScale = minimapW / canvasW;

  return (
    <div
      className={cx(s.root, probing && s.isProbing, drag && s.isDragging, r.placing && s.isPlacing)}
      data-mode={probeMode ?? "now"}
    >
      <header className={s.top}>
        <div className={s.topRow}>
          <div className={s.titleWrap}>
            <h1 className={s.h1}>Overview</h1>
            <div className={s.scopeWrap}>
              <button
                type="button"
                className={s.scopeBtn}
                aria-haspopup="listbox"
                aria-expanded={scopeOpen}
                onClick={() => setScopeOpen((o) => !o)}
              >
                <span className={s.scopeDot} style={{ background: r.scope === "all" ? "var(--v3-text-2)" : `var(--rv-pj-${r.scope})` }} />
                <span className={s.scopeName}>{scopeLabel.label}</span>
                <span className={s.scopeHint}>{scopeLabel.hint}</span>
                <Icon name="chevron-down" size={14} />
              </button>
              {scopeOpen ? (
                <>
                  <div className={s.scrimClear} onClick={() => setScopeOpen(false)} />
                  <ul className={s.scopeMenu} role="listbox" aria-label="Choose what the river shows">
                    {SCOPES.map((sc) => (
                      <li key={sc.id}>
                        <button
                          type="button"
                          role="option"
                          aria-selected={sc.id === r.scope}
                          className={cx(s.scopeOption, sc.id === r.scope && s.scopeOptionOn)}
                          onClick={() => {
                            r.setScope(sc.id);
                            setScopeOpen(false);
                          }}
                        >
                          <span className={s.scopeDot} style={{ background: sc.id === "all" ? "var(--v3-text-2)" : `var(--rv-pj-${sc.id})` }} />
                          <span className={s.scopeOptionText}>
                            <span>{sc.label}</span>
                            <span className={s.scopeOptionHint}>{sc.hint}</span>
                          </span>
                          {sc.id === r.scope ? <Icon name="check" size={14} /> : null}
                        </button>
                      </li>
                    ))}
                  </ul>
                </>
              ) : null}
            </div>
          </div>
          <div className={s.controls}>
            <div className={s.segmented} role="radiogroup" aria-label="Lanes">
              {LENSES.map((l) => (
                <button
                  key={l.id}
                  type="button"
                  role="radio"
                  aria-checked={r.lens === l.id}
                  className={cx(s.seg, r.lens === l.id && s.segOn)}
                  onClick={() => r.setLens(l.id)}
                  title={`${l.label} (${l.key})`}
                >
                  {l.label}
                </button>
              ))}
            </div>
            {dockInHeader ? <div className={s.zoomInline}>{zoomGroup}</div> : null}
            <button type="button" className={s.todayBtn} onClick={goToday} title="Back to today (T)">
              <Icon name="target" size={14} />
              Today
            </button>
          </div>
        </div>
        <div className={s.stateRow}>
          <p className={cx(s.sentence, probeMode === "forecast" && s.sentenceForecast, probeMode === "replay" && s.sentenceReplay)} aria-live="polite">
            {probeMode ? <span className={s.sentenceTag}>{probeMode === "forecast" ? "Forecast" : "Replay"}</span> : null}
            {r.sentence}
          </p>
        </div>
      </header>

      <section className={s.stage} ref={stageRef} aria-label="River of time">
        <p id="rv-mark-help" className={s.srOnly}>
          Enter opens it below the river. Alt with the left or right arrow moves it a day, with Shift a week.
        </p>
        <div
          className={s.scroller}
          ref={scrollerRef}
          onScroll={(e) => setScrollLeft(e.currentTarget.scrollLeft)}
        >
          <div className={s.track} style={{ width: HEADER_W + canvasW, height: canvasH }}>
            {/* Lane headers stay pinned at the left edge as time scrolls. */}
            <div className={s.heads} style={{ width: HEADER_W, height: canvasH }}>
              <div className={s.headRibbon} style={{ top: AXIS_H, height: ribbonH }}>
                <span className={s.headTitle}>Pressure</span>
                <span className={s.headSub}>Settled behind, due ahead</span>
              </div>
              {lanes.map((lane, i) => {
                const laneItems = r.scoped.filter(
                  (it) => laneKey(it, r.lens) === lane.id && it.due !== undefined && openAt(it, r.asOf) && !it.terminal,
                );
                const lateCount = laneItems.filter(late).length;
                const next = laneItems.filter((it) => it.due! >= r.asOf).sort((a, b) => a.due! - b.due!)[0];
                // Say the whole next step, or just its date; never a clipped half.
                const nextFull = next ? `Next: ${next.title}, ${short(next.due!)}` : "";
                const twoLines = heights[i] >= 100;
                const nextText =
                  next && (twoLines || textWidth(nextFull, 12) <= HEADER_W - 60)
                    ? nextFull
                    : next
                      ? `Next due ${short(next.due!)}`
                      : "";
                return (
                  <div key={lane.id} className={s.head} style={{ top: tops[i], height: heights[i] }}>
                    <div className={s.headName}>
                      {lane.person ? (
                        <Avatar person={lane.person} size={20} />
                      ) : (
                        <span className={s.laneSwatch} style={{ background: lane.color }} />
                      )}
                      <span className={s.headLabel}>{lane.name}</span>
                    </div>
                    <div className={s.headMeta}>
                      {lane.person ? `${PERSON[lane.person].role} · ` : ""}
                      {laneItems.length
                        ? plural(laneItems.length, "open", "open")
                        : r.scoped.some((it) => laneKey(it, r.lens) === lane.id && it.doneOn !== undefined && !it.terminal)
                          ? "All settled"
                          : r.scoped.some((it) => laneKey(it, r.lens) === lane.id)
                            ? "Nothing dated yet"
                            : "Nothing here yet"}
                      {lateCount ? <span className={s.headLate}> · {lateCount} late</span> : null}
                    </div>
                    {next && heights[i] >= 78 ? (
                      <div className={cx(s.headNext, twoLines && s.headNextTwo)}>{nextText}</div>
                    ) : null}
                  </div>
                );
              })}
              <div className={s.headSed} style={{ top: sedTop, height: sedH }}>
                <span className={s.headTitle}>Settled</span>
                <span className={s.headSub}>
                  {settled.beads.length
                    ? `${plural(settled.beads.length, "thing")} done${settled.hidden ? `, ${settled.hidden} as dots` : ""}`
                    : "Nothing finished yet"}
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
              {/* Its handle rides the ribbon's centre line, above everything. It comes
                  first in the tab order: the river's main control should not sit
                  behind every mark. */}
              <div
                className={cx(s.nowTop, probing && s.nowDragging, probeMode === "forecast" && s.nowForecast, probeMode === "replay" && s.nowReplay)}
                style={{ transform: `translateX(${lineX}px)`, top: ribbonMid - 12 }}
              >
                <button
                  type="button"
                  data-stop
                  role="slider"
                  aria-label="Now line. Drag or use the arrow keys to look ahead or back"
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
                {!probeMode && !probed && r.scope !== "lunch" && !sel ? (
                  // The future is to the right, and so is the way to drag.
                  <span className={s.nowHint} style={{ left: handleW / 2 + 10 + handleShift }} aria-hidden="true">
                    Drag to look ahead
                    <span className={s.nowHintArrow}>
                      <Icon name="arrow-right" size={12} />
                    </span>
                  </span>
                ) : null}
              </div>

              {/* Past wash: settled time is quieter than the time ahead. */}
              <div className={s.past} style={{ width: Math.min(nowX, lineX) }} />
              {probeMode === "forecast" ? (
                <div className={s.forecastWash} style={{ left: nowX, width: lineX - nowX }} />
              ) : null}
              {dest ? (
                <div className={s.after} style={{ left: xAt(dest.due!) + ppd / 2, width: Math.max(0, canvasW - xAt(dest.due!) - ppd / 2) }} />
              ) : null}

              {/* Focused week column, linked to the tray. */}
              {!r.selected && r.probe === null ? (
                <div className={s.focusCol} style={{ left: (r.focusWeek - r.r0) * ppd, width: 7 * ppd }} />
              ) : null}

              {/* Axis */}
              <div className={s.axis} style={{ height: AXIS_H }}>
                {ticks.map((t) => {
                  const x = (t.day - r.r0) * ppd;
                  const label = shownTicks.has(t.day) ? tickText(t) : "";
                  const w = textWidth(label, 11.5);
                  const covered = scrubChip !== null && x + 6 < scrubChip + 46 && x + 6 + w > scrubChip - 46;
                  return (
                    <div
                      key={t.day}
                      className={cx(s.tick, t.major && s.tickMajor, t.day < 0 && s.tickPast)}
                      style={{ left: x }}
                    >
                      <span
                        className={cx(
                          s.tickLabel,
                          mondayOf(t.day) === r.focusWeek && t.week && s.tickFocus,
                          covered && s.tickCovered,
                        )}
                      >
                        {label}
                      </span>
                    </div>
                  );
                })}
              </div>
              {ticks
                .filter((t) => t.week)
                .map((t) => (
                  <div
                    key={`g${t.day}`}
                    className={cx(s.grid, t.major && s.gridMajor, t.day <= 0 && s.gridPast)}
                    style={{ left: (t.day - r.r0) * ppd, top: AXIS_H, height: canvasH - AXIS_H - sedH }}
                  />
                ))}

              {/* Pressure ribbon */}
              <svg className={s.ribbon} width={canvasW} height={ribbonH} style={{ top: AXIS_H }} aria-hidden="true">
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
                const heat = heatOf(f.count);
                return (
                  <div
                    key={f.week}
                    data-stop
                    className={cx(s.ribbonHit, hotWeek === f.week && s.ribbonHitOn, f.past && s.ribbonHitPast)}
                    style={{ left: (f.week - r.r0) * ppd, width: 7 * ppd, top: AXIS_H, height: ribbonH }}
                    onPointerEnter={() => {
                      if (!f.past) enterHot(f.week);
                    }}
                    onPointerLeave={leaveHot}
                  >
                    {f.count >= 3 ? (
                      <span
                        className={cx(
                          s.heatLabel,
                          f.past && s.heatSettled,
                          !f.past && heat === "busy" && s.heatBusy,
                          !f.past && heat === "hot" && s.heatHot,
                        )}
                      >
                        {!f.past && heat === "hot" ? (
                          <span className={s.heatMark} aria-hidden="true">
                            ▲
                          </span>
                        ) : null}
                        {f.count} {f.past ? "settled" : "due"}
                      </span>
                    ) : null}
                  </div>
                );
              })}

              {/* Lanes */}
              {lanes.map((lane, i) => (
                <div
                  key={lane.id}
                  className={s.lane}
                  style={{ top: tops[i], height: heights[i] }}
                />
              ))}

              {/* Project threads in the Projects lens */}
              {r.lens === "projects"
                ? lanes.map((lane, i) => {
                    const own = r.scoped.filter((it) => it.project === lane.project && it.due !== undefined);
                    if (!own.length) return null;
                    const first = Math.min(...own.map((it) => it.start ?? it.due!));
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
                    className={s.rug}
                    style={{ left: xAt(it.due!) - 1, top: tops[i] + heights[i] - 19, background: itemColor(it, "projects") }}
                  />
                );
              })}

              {/* Silt: finished work leaves a low mark in its own lane, on the day it
                  settled, so the past reads as sediment rather than empty water. */}
              {r.lens !== "projects"
                ? settled.beads.map((b) => {
                    const i = lanes.findIndex((l) => l.id === laneKey(b.item, r.lens));
                    if (i < 0) return null;
                    return (
                      <span
                        key={`silt${b.item.id}`}
                        className={s.silt}
                        aria-hidden="true"
                        style={{ left: b.x - 6, top: tops[i] + heights[i] - 14, "--c": itemColor(b.item, r.lens) } as CSSProperties}
                      >
                        <Icon name="check" size={9} />
                      </span>
                    );
                  })
                : null}

              {/* Clashes across projects */}
              {r.clashes.map((c, ci) => {
                const last = c.items[c.items.length - 1].due!;
                // Lift a tag when it would sit on top of the one before it.
                const lift = clashLevels[ci] === 1;
                return (
                  <div
                    key={`clash${c.day}`}
                    className={s.clash}
                    style={{ left: (c.day - r.r0) * ppd, width: (last - c.day + 1) * ppd, top: lanesTop, height: lanesH }}
                  >
                    <span className={s.clashTag} data-stop style={lift ? { bottom: 34 } : undefined}>
                      <span aria-hidden="true">⚑</span> Clash, {c.people.map((p) => PERSON[p].name).join(" and ")}
                      <span className={s.clashTip} role="tooltip">
                        {c.sentence}
                      </span>
                    </span>
                  </div>
                );
              })}

              {/* Tethers: late work hangs behind the line and is pulled toward it. */}
              <svg className={s.tethers} width={canvasW} height={canvasH} aria-hidden="true">
                {packed.flatMap((lp, li) =>
                  lp.placed
                    .filter((p) => late(p.item) && !settledSince.has(p.item.id))
                    .map((p) => {
                      const y = rowY(li, p.row) + PILL_H / 2;
                      const x1 = p.item.kind === "milestone" ? p.x + 6 : p.x + p.w;
                      // The tether pulls toward the day the river is drawn as of, not a forecast.
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
                {/* Rubber bands while dragging */}
                {drag && dragShifts
                  ? [...dragShifts.keys()]
                      .filter((id) => id !== drag.id)
                      .map((id) => {
                        const src = findPlaced(packed, drag.id);
                        const dst = findPlaced(packed, id);
                        if (!src || !dst) return null;
                        const sy = rowY(src.lane, src.p.row) + PILL_H / 2;
                        const dy = rowY(dst.lane, dst.p.row) + PILL_H / 2;
                        const sx = src.p.x + (src.p.item.kind === "milestone" ? 6 : src.p.w) + drag.delta * ppd;
                        const dx = dst.p.x + (dragShifts.get(id) ?? 0) * ppd;
                        const bend = Math.max(24, Math.abs(dx - sx) / 2);
                        return (
                          <path
                            key={`band${id}`}
                            className={s.band}
                            d={`M${sx},${sy} C${sx + bend},${sy} ${dx - bend},${dy} ${dx},${dy}`}
                          />
                        );
                      })
                  : null}
                {/* The selected item's links: what it waits on, and what it holds up */}
                {!drag
                  ? selLinks.map(([a, b]) => {
                      const src = findPlaced(packed, a);
                      const dst = findPlaced(packed, b);
                      if (!src || !dst) return null;
                      const sy = rowY(src.lane, src.p.row) + PILL_H / 2;
                      const dy = rowY(dst.lane, dst.p.row) + PILL_H / 2;
                      const sx = src.p.x + (src.p.item.kind === "milestone" ? 6 : src.p.w);
                      const dx = dst.p.x - (dst.p.item.kind === "milestone" ? 8 : 0);
                      const bend = Math.max(24, Math.abs(dx - sx) / 2);
                      return (
                        <g key={`link${a}-${b}`} className={s.link}>
                          <path d={`M${sx},${sy} C${sx + bend},${sy} ${dx - bend},${dy} ${dx - 3},${dy}`} />
                          <circle cx={dx - 1} cy={dy} r={3} />
                        </g>
                      );
                    })
                  : null}
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
                    aria-label={`${lanes[li].name}: ${plural(lp.placed.length + lp.clusters.reduce((n, c) => n + c.items.length, 0), "item")}. Arrow keys move between items.`}
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
                          color={itemColor(it, r.lens)}
                          state={state}
                          selected={r.selected?.id === it.id}
                          dim={related !== null && !related.has(it.id)}
                          asOf={r.asOf}
                          etaW={
                            lateForecast.has(it.id) && it.eta && it.eta > it.due! ? (it.eta - it.due!) * ppd : 0
                          }
                          showOwner={showOwner}
                          labelFrom={state === "late" ? xAt(r.asOf) - (p.x + shift * ppd) + 10 : 0}
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
                        className={cx(
                          s.cluster,
                          c.items.some((it) => lateForecast.has(it.id) || late(it)) && s.clusterLate,
                          related && s.markDim,
                        )}
                        style={{ transform: `translate(${c.x}px, ${rowY(li, c.row)}px)` }}
                        onClick={() => r.setFocusWeek(c.week)}
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
              {(r.spread || drag)
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

              {/* Sediment: finished work settles here, labelled, newest on top */}
              <div className={s.sediment} style={{ top: sedTop, height: sedH }}>
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
                  const labelled = settled.chips.some((c) => c.item.id === b.item.id);
                  const cls = cx(
                    s.bead,
                    !labelled && s.beadHit,
                    b.item.doneOn! > (b.item.due ?? 0) && s.beadLate,
                    hoverId === b.item.id && s.beadOn,
                  );
                  const style = {
                    left: b.x - 4,
                    top: 8 + b.level * 10,
                    "--c": itemColor(b.item, r.lens),
                    animationDelay: `${Math.min(i * 45, 900)}ms`,
                  } as CSSProperties;
                  // Beads with a chip are only markers; the rest can be hovered for their story.
                  return labelled ? (
                    <span key={b.item.id} className={cls} style={style} aria-hidden="true" />
                  ) : (
                    <button
                      key={b.item.id}
                      type="button"
                      data-stop
                      className={cls}
                      style={style}
                      aria-label={`${b.item.title}, done ${long(b.item.doneOn!)}`}
                      onPointerEnter={() => setHoverId(b.item.id)}
                      onPointerLeave={() => setHoverId((h) => (h === b.item.id ? null : h))}
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
                    className={cx(
                      s.settledChip,
                      r.selected?.id === c.item.id && s.settledChipOn,
                      related && !related.has(c.item.id) && s.markDim,
                    )}
                    style={
                      {
                        left: x,
                        top: 22 + c.row * 26,
                        width: c.w,
                        "--c": itemColor(c.item, r.lens),
                        animationDelay: `${Math.min(120 + i * 60, 900)}ms`,
                      } as CSSProperties
                    }
                    aria-label={`${c.item.title}, done ${long(c.item.doneOn!)}`}
                    onPointerEnter={() => setHoverId(c.item.id)}
                    onPointerLeave={() => setHoverId((h) => (h === c.item.id ? null : h))}
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

              {/* Destination */}
              {dest ? (
                <div className={s.dest} style={{ left: xAt(dest.due!), height: canvasH }}>
                  <div className={s.destFlag} data-stop>
                    <FlagGlyph size={13} />
                    <span className={s.destTitle}>{dest.title}</span>
                    <span className={s.destMeta}>{destMeta}</span>
                  </div>
                </div>
              ) : null}

              {/* Scrub hairline */}
              {scrub !== null && !probing && !drag && r.probe === null ? (
                <div className={s.scrub} style={{ left: xAt(scrub), height: canvasH }}>
                  {scrubChip !== null ? <span className={s.scrubChip}>{withDay(scrub)}</span> : null}
                </div>
              ) : null}

              {/* Placing ghost for undated work or a first milestone */}
              {r.placing && scrub !== null ? (
                <div className={s.placeGhost} style={{ left: xAt(scrub), top: lanesTop, height: lanesH }}>
                  <span className={s.placeChip}>
                    {r.placing.kind === "milestone" ? "Set Spring open day on" : "Start on"} {withDay(scrub)}
                  </span>
                </div>
              ) : null}

              {/* Today's resting place while the line is away */}
              {r.probe !== null ? <div className={s.nowGhost} style={{ left: nowX, top: AXIS_H, height: canvasH - AXIS_H }} /> : null}

              {/* The now line runs beneath the marks, so labels knock it out */}
              <div
                className={cx(s.now, probing && s.nowDragging, probeMode === "forecast" && s.nowForecast, probeMode === "replay" && s.nowReplay)}
                style={{ transform: `translateX(${lineX}px)`, height: canvasH }}
              >
                <div className={s.nowLine} />
              </div>
              {/* Hover card for an item or a settled bead */}
              {hoverItem && hoverItem.id !== r.selected?.id && !drag && !probing && !hotLoad ? (
                <HoverCard item={hoverItem} r={r} x={hoverX(hoverItem, xAt, ppd, r.r0)} canvasW={canvasW} canvasH={canvasH} y={hoverY(hoverItem, packed, rowY, sedTop)} />
              ) : null}

              {/* Crowded week card */}
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
                    <span className={cx(s.hotHeat, s[`heat_${heatOf(hotLoad.count)}`])}>
                      {heatOf(hotLoad.count) === "hot" ? "Crowded" : heatOf(hotLoad.count) === "warm" ? "Busy" : "Clear"}
                    </span>
                    <span className={s.hotTitle}>Week of {long(hotLoad.week)}</span>
                    <span className={s.hotCount}>{plural(hotLoad.count, "thing")} due</span>
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
                            <span className={s.laneSwatchSm} style={{ background: itemColor(it, r.lens) }} />
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
                        {PERSON[o.person].name} {o.count}
                      </span>
                    ))}
                  </div>
                  {hotLoad.count >= 4 && r.asOf === 0 && r.lens !== "projects" ? (
                    r.spread?.week === hotLoad.week ? (
                      <div className={s.hotActions}>
                        <p className={s.hotSuggest}>
                          {r.spread.moves.length
                            ? `Moving ${plural(r.spread.moves.length, "thing")} a week on leaves ${hotLoad.count - r.spread.moves.length} here. Nothing waiting on them slips.`
                            : "Everything here is fixed or holds something up, so there is nothing safe to move."}
                        </p>
                        <div className={s.hotBtns}>
                          <button type="button" className={s.btnGhost} onClick={() => { r.setSpread(null); setHotWeek(null); }}>
                            Not now
                          </button>
                          {r.spread.moves.length ? (
                            <button type="button" className={s.btnPrimary} onClick={() => { r.applySpread(); setHotWeek(null); }}>
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

        {/* Zoom and the whole-project map sit with the river they control, like a canvas tool. */}
        {!dockInHeader ? (
        <div className={s.dock}>
          {viewW >= 880 ? (
          <button
            type="button"
            className={s.minimap}
            style={{ width: minimapW }}
            aria-label={`Whole project, ${short(r.r0)} to ${short(r.r1)}. Click to jump there.`}
            title={`Whole project, ${short(r.r0)} to ${short(r.r1)}. Taller marks are busier weeks. Click to jump.`}
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const x = (e.clientX - rect.left) / mmScale;
              scrollerRef.current?.scrollTo({ left: Math.max(0, x - viewW / 2), behavior: "smooth" });
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
                  style={{ fill: heatColor(heatOf(l.count)) }}
                />
              ))}
              <rect x={nowX * mmScale - 1} y={0} width={2} height={22} className={s.mmNow} />
              {dest ? <rect x={xAt(dest.due!) * mmScale - 1} y={0} width={2} height={22} className={s.mmDest} /> : null}
            </svg>
            <span className={s.mmWindow} style={{ left: scrollLeft * mmScale, width: Math.min(minimapW, viewW * mmScale) }} />
          </button>
          ) : null}
          {zoomGroup}
        </div>
        ) : null}

        {r.toast ? (
          <div className={s.toast} role="status" key={r.toast.id}>
            <span>{r.toast.text}</span>
            {r.toast.undo ? (
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

        {/* Undated eddy */}
        {r.undated.length ? (
          <div className={s.eddy} style={{ left: HEADER_W + 12, top: lanesTop + 8 }}>
            <div className={s.eddyHead}>
              <span className={s.eddyTitle}>No date yet</span>
              <span className={s.eddyCount}>{r.undated.length}</span>
            </div>
            <ul className={s.eddyList}>
              {r.undated.map((it) => {
                const armed = r.placing?.kind === "item" && r.placing.id === it.id;
                return (
                  <li key={it.id}>
                    <button
                      type="button"
                      className={cx(s.eddyItem, armed && s.eddyItemOn)}
                      onClick={() => r.setPlacing(armed ? null : { kind: "item", id: it.id })}
                    >
                      <span className={s.laneSwatchSm} style={{ background: WS_COLOR(it.lane) }} />
                      <span className={s.eddyName}>{it.title}</span>
                      <Avatar person={it.owner} size={16} />
                    </button>
                  </li>
                );
              })}
            </ul>
            <p className={s.eddyHint}>{r.placing?.kind === "item" ? "Now click the river where it starts." : "Pick one, then click the river to date it."}</p>
          </div>
        ) : null}

        {/* No dates at all: a calm river asking for its first milestone */}
        {r.scope === "spring" && !dest ? (
          <div className={s.emptyPrompt}>
            <span className={s.emptyIcon}>
              <FlagGlyph size={18} />
            </span>
            <h2 className={s.emptyTitle}>This river has nowhere to go yet</h2>
            <p className={s.emptyBody}>Give the open day a date and everything else can find its place around it.</p>
            <button
              type="button"
              className={cx(s.btnPrimary, r.placing?.kind === "milestone" && s.btnArmed)}
              onClick={() => r.setPlacing(r.placing?.kind === "milestone" ? null : { kind: "milestone" })}
            >
              <Icon name="calendar" size={14} />
              {r.placing?.kind === "milestone" ? "Click the river to set it" : "Set the first milestone"}
            </button>
          </div>
        ) : null}

        {/* The day after: a completion moment */}
        {r.scope === "lunch" && r.asOf === 0 ? (
          <div className={s.complete}>
            <span className={s.completeRing} aria-hidden="true">
              <Icon name="check" size={20} />
            </span>
            <div>
              <h2 className={s.completeTitle}>Everything settled</h2>
              <p className={s.completeBody}>
                {r.scoped.filter((it) => !it.terminal).length} of {r.scoped.filter((it) => !it.terminal).length} done, 46 guests
                fed. Drag the today line back to watch it come together.
              </p>
            </div>
            <div className={s.completeBtns}>
              <button type="button" className={s.btnGhost}>
                <Icon name="pen" size={14} />
                Write the wrap-up
              </button>
              <button type="button" className={s.btnGhost}>
                <Icon name="archive" size={14} />
                Archive project
              </button>
            </div>
          </div>
        ) : null}
      </section>

      <Tray
        river={r}
        rows={trayRows}
        collapsed={trayCollapsed}
        onToggle={() => setTrayPref(trayCollapsed ? "open" : "closed")}
      />
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
    "aria-label": `${it.title}, ${PERSON[it.owner].name}, ${dueText(it, props.asOf)}${badge ? `, ${badge.toLowerCase()}` : ""}`,
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
      <span className={s.pillBody} />
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
  const deps = r.downstreamOf(item.id);
  const done = item.doneOn !== undefined && item.doneOn <= r.asOf;
  const left = Math.min(Math.max(8, x), canvasW - 300);
  const above = y > canvasH - 170;
  return (
    <div
      className={s.hover}
      style={{ left, top: above ? undefined : y, bottom: above ? canvasH - y + 34 : undefined }}
      role="tooltip"
    >
      <div className={s.hoverTop}>
        <span className={s.laneSwatchSm} style={{ background: WS_COLOR(item.lane) }} />
        <span className={s.hoverLane}>
          {r.scope === "all" ? PROJECTS[item.project].short : laneName(item)}
        </span>
        <StatusChip item={item} asOf={r.asOf} />
      </div>
      <div className={s.hoverTitle}>{item.title}</div>
      <div className={s.hoverMeta}>
        <Avatar person={item.owner} size={16} /> {PERSON[item.owner].name}
        <span className={s.dotSep} aria-hidden="true" />
        {done ? `Done ${long(item.doneOn!)}` : dueText(item, r.asOf)}
      </div>
      {!done && item.eta && item.eta > (item.due ?? 0) ? (
        <div className={s.hoverWarn}>
          <Icon name="clock" size={13} /> At this pace it lands {short(item.eta)}, {plural(item.eta - item.due!, "day")} after its date.
        </div>
      ) : null}
      {item.note ? <p className={s.hoverNote}>{item.note}</p> : null}
      {deps.length && !done ? (
        <div className={s.hoverDeps}>Holds up {deps.map((d) => d.title.toLowerCase()).join(", ")}</div>
      ) : null}
      {!done && r.lens !== "projects" && r.asOf === 0 ? <div className={s.hoverHint}>Drag to move it, or select it and press Alt with an arrow. Click for more.</div> : null}
    </div>
  );
}

function hoverX(item: Item, xAt: (d: number) => number, ppd: number, r0: number) {
  if (item.doneOn !== undefined && item.doneOn <= 0 && item.status === "done") return xAt(item.doneOn) - 20;
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


