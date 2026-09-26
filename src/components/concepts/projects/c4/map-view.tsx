"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Icon } from "./icons";
import { HealthDot, IdTile, NodeGlyph, StatusPill, Avatar } from "./parts";
import { HubCard, hubCamera } from "./hub";
import {
  HEALTH_COLOR,
  HEALTH_LABEL,
  KIND_LABEL,
  KIND_LANES,
  MAP_START,
  PEOPLE,
  PEOPLE_ORDER,
  RELATIONS,
  countLine,
  crunchLabel,
  crunchRange,
  crunchSentence,
  crunches,
  joinNames,
  sameCrunch,
  statusWord,
  dated,
  fmtDayMonth,
  fmtIn,
  fmtLong,
  fmtShort,
  fmtUntil,
  fullLabel,
  load,
  monthName,
  monthShort,
  nextMilestone,
  parts,
  soon,
  weekStart,
  weeks,
  type Crunch,
  type Health,
  type Kind,
  type Project,
} from "./data";
import {
  DEFAULT_SCALE,
  LEFT_FREE,
  LOAD_H,
  MAX_SCALE,
  MIN_SCALE,
  NARROW_W,
  RULER_H,
  TOOLBAR_SPACE,
  anchorOf,
  cx,
  dayAt,
  dayUnder,
  defaultCamera,
  labelRects,
  layout,
  radiusFor,
  sx,
  textW,
  type Camera,
  type Lens,
  type Placed,
  type Rect,
  type RelTags,
} from "./layout";
import s from "./map.module.css";

type Hub = { id: string; prev: Camera; phase: "flying" | "open" | "closing" };
type Drag = { id: string; from: number | undefined; day: number; startX: number; startDay: number; moved: boolean; tray?: boolean; px?: number; py?: number };
type Pending = { id: string; from: number | undefined; to: number };
type Create = { day: number; lane: string; x: number; y: number };
type Toast = { text: string; undo?: () => void; key: number };

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

/** cubic-bezier(0.2, 0.8, 0.2, 1), the v3 ease, for camera moves driven by rAF. */
function easeV3(t: number) {
  const [x1, y1, x2, y2] = [0.2, 0.8, 0.2, 1];
  const bx = (u: number) => 3 * (1 - u) * (1 - u) * u * x1 + 3 * (1 - u) * u * u * x2 + u * u * u;
  const by = (u: number) => 3 * (1 - u) * (1 - u) * u * y1 + 3 * (1 - u) * u * u * y2 + u * u * u;
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 24; i++) {
    const mid = (lo + hi) / 2;
    if (bx(mid) < t) lo = mid;
    else hi = mid;
  }
  return by((lo + hi) / 2);
}

export type MapViewProps = {
  projects: Project[];
  setProjects: (fn: (list: Project[]) => Project[]) => void;
  lens: Lens;
  setLens: (l: Lens) => void;
  onList: () => void;
  isEmptyPreview: boolean;
  setEmptyPreview: (v: boolean) => void;
};

function reading(projects: Project[], crunch: Crunch[]) {
  const list = soon(projects);
  if (!list.length) return { count: countLine(projects), week: null };
  const next = crunch.find((c) => c.end > 0);
  if (next) return { count: countLine(projects), week: crunchSentence(next) };
  const byWeek = new Map<number, number>();
  for (const p of list) byWeek.set(weekStart(p.day ?? 0), (byWeek.get(weekStart(p.day ?? 0)) ?? 0) + 1);
  let most = 0;
  let mostWeek = 0;
  for (const [w, n] of byWeek) if (n > most) [most, mostWeek] = [n, w];
  return { count: countLine(projects), week: most >= 2 ? `${most} land in the week of ${fmtDayMonth(mostWeek)}.` : "No two land in the same week." };
}

function names(ids: string[], all: Project[]) {
  const n = ids.map((id) => all.find((p) => p.id === id)?.short ?? id);
  return n.length <= 1 ? n.join("") : `${n.slice(0, -1).join(", ")} and ${n[n.length - 1]}`;
}

/**
 * What a move does to crunch weeks, in words that name the cause: which of
 * the project's milestones (or its final fortnight) lands in the week, and
 * what the same people already have there.
 */
function consequences(before: Crunch[], after: Crunch[], orig: Project | undefined, to: number, all: Project[]) {
  const out: { tone: "bad" | "good" | "calm"; text: string }[] = [];
  const id = orig?.id ?? "";
  const name = orig?.short ?? "Project";
  // Milestones move with the project; undated projects keep theirs.
  const shift = orig?.day !== undefined ? to - orig.day : 0;
  const cause = (c: Crunch) => {
    if (!orig) return "";
    const m = orig.milestones.find((ms) => !ms.done && ms.day !== orig.day && ms.day + shift >= c.start && ms.day + shift < c.end);
    const others = c.projects.filter((pid) => pid !== id);
    const who = joinNames(c.people.map((pid) => PEOPLE[pid].first));
    const also = others.length ? `, where ${who} already ${c.people.length > 1 ? "have" : "has"} ${names(others, all)}` : "";
    return `${m ? `Its ${m.label.toLowerCase()}` : "Its final fortnight"} moves into ${crunchRange(c)}${also}`;
  };
  for (const c of after) {
    if (!c.projects.includes(id)) continue;
    const prev = before.find((b) => sameCrunch(b, c));
    if (!prev) out.push({ tone: "bad", text: `${cause(c)}. New crunch: ${crunchLabel(c)}.` });
    else if (c.count > prev.count || c.people.length > prev.people.length) out.push({ tone: "bad", text: `${cause(c)}. The crunch gets heavier: ${crunchLabel(c)}.` });
    else if (c.start < prev.start || c.end > prev.end)
      out.push({ tone: "bad", text: `${cause(c)}. The crunch grows: it now ${c.start < prev.start ? `starts ${fmtDayMonth(c.start)}` : `ends ${fmtDayMonth(c.end - 1)}`}.` });
  }
  for (const b of before) {
    if (!after.find((c) => sameCrunch(c, b)) && b.projects.includes(id)) out.push({ tone: "good", text: `Clears the crunch from ${crunchRange(b)}` });
  }
  if (!out.length) out.push({ tone: "calm", text: `No new crunch for ${name}'s team` });
  return out;
}

/** Colour carries one meaning per lens: who owns it (People) or how it is going. */
function glyphColours(p: Project, lens: Lens) {
  if (lens === "people") return { ring: PEOPLE[p.owner].color, fill: PEOPLE[p.owner].color };
  return { ring: "var(--v3-text-3)", fill: HEALTH_COLOR[p.health] };
}
const fillFor = (p: Project, lens: Lens) => glyphColours(p, lens).fill;

export function MapView({ projects, setProjects, lens, setLens, onList, isEmptyPreview, setEmptyPreview }: MapViewProps) {
  const reduce = useReducedMotion();
  const canvasRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 1184, h: 836 });
  // Nothing on the canvas shows until it has been measured once: a wrong
  // first frame (desktop map at a guessed size) never reaches the screen.
  const [ready, setReady] = useState(false);
  const [cam, setCam] = useState<Camera>(() => defaultCamera(1184));
  const [chrome, setChrome] = useState<{ panel: Rect | null }>({ panel: null });
  const [hub, setHub] = useState<Hub | null>(null);
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [hoverLink, setHoverLink] = useState<number | null>(null);
  const [clusterOpen, setClusterOpen] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string>("mara-finn");
  const [drag, setDrag] = useState<Drag | null>(null);
  const [pending, setPending] = useState<Pending | null>(null);
  const [create, setCreate] = useState<Create | null>(null);
  const [toast, setToast] = useState<Toast | null>(null);
  const [spot, setSpot] = useState<"help" | "past" | "crunch" | null>(null);
  const [crunchHot, setCrunchHot] = useState<number | null>(null);
  const [focusId, setFocusId] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [keyOpen, setKeyOpen] = useState(false);
  const [noDateOpen, setNoDateOpen] = useState(false);
  const [panning, setPanning] = useState(false);

  const camRef = useRef(cam);
  const sizeRef = useRef(size);
  const hubRef = useRef(hub);
  const animRef = useRef<number | null>(null);
  const panRef = useRef<{ x: number; x0: number; id: number } | null>(null);
  const suppressClick = useRef(false);
  const hoverTimer = useRef<number | null>(null);
  const clusterTimer = useRef<number | null>(null);
  const closeHubRef = useRef<() => void>(() => {});
  const seq = useRef(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    camRef.current = cam;
  }, [cam]);
  useEffect(() => {
    sizeRef.current = size;
  }, [size]);
  useEffect(() => {
    hubRef.current = hub;
  }, [hub]);

  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    let first = true;
    const ro = new ResizeObserver((entries) => {
      const r = entries[0].contentRect;
      const next = { w: Math.round(r.width), h: Math.round(r.height) };
      if (next.w < 10 || next.h < 10) return;
      sizeRef.current = next;
      setSize(next);
      if (first) {
        first = false;
        const c = defaultCamera(next.w);
        camRef.current = c;
        setCam(c);
        setReady(true);
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Floating chrome is reserved space: labels are placed around it.
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const measure = () => {
      const base = root.getBoundingClientRect();
      // The panel animates its size with a transform (layout animation), so
      // the on-screen box lags the real one. Measure the layout box instead,
      // or a collapsed panel keeps pushing labels away as if it were open.
      const rect = (el: HTMLElement | null): Rect | null => {
        if (!el) return null;
        if (el.offsetParent === root) {
          if (!el.offsetWidth) return null;
          const l = el.offsetLeft;
          const t = el.offsetTop;
          return { x1: l - 10, x2: l + el.offsetWidth + 10, y1: t - 8, y2: t + el.offsetHeight + 8 };
        }
        const b = el.getBoundingClientRect();
        if (!b.width) return null;
        return { x1: b.left - base.left - 10, x2: b.right - base.left + 10, y1: b.top - base.top - 8, y2: b.bottom - base.top + 8 };
      };
      const next = { panel: rect(panelRef.current) };
      setChrome((prev) =>
        JSON.stringify(prev) === JSON.stringify(next) ? prev : next,
      );
    };
    const ro = new ResizeObserver(measure);
    ro.observe(root);
    if (panelRef.current) ro.observe(panelRef.current);
    const mo = new MutationObserver(() => {
      ro.disconnect();
      ro.observe(root);
      if (panelRef.current) ro.observe(panelRef.current);
      measure();
    });
    mo.observe(root, { childList: true });
    return () => {
      ro.disconnect();
      mo.disconnect();
    };
  }, []);

  /* ── camera ─────────────────────────────────────────────────────── */

  const flyTo = useCallback(
    (target: Camera, dur = 640, done?: () => void, easing: (t: number) => number = easeInOut) => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
      if (reduce) {
        setCam(target);
        done?.();
        return;
      }
      const from = camRef.current;
      const w = sizeRef.current.w;
      const fc = from.x0 + w / 2 / from.scale;
      const tc = target.x0 + w / 2 / target.scale;
      const t0 = performance.now();
      const step = (now: number) => {
        const t = Math.min(1, (now - t0) / dur);
        const k = easing(t);
        const scale = Math.exp(Math.log(from.scale) + (Math.log(target.scale) - Math.log(from.scale)) * k);
        const c = fc + (tc - fc) * k;
        // One camera value per frame drives the ruler, lanes, nodes and links.
        const next = { scale, x0: c - w / 2 / scale };
        camRef.current = next;
        setCam(next);
        if (t < 1) animRef.current = requestAnimationFrame(step);
        else {
          animRef.current = null;
          done?.();
        }
      };
      animRef.current = requestAnimationFrame(step);
    },
    [reduce],
  );

  const clampCam = (c: Camera): Camera => {
    const w = sizeRef.current.w;
    const minX0 = MAP_START - 30 - LEFT_FREE / c.scale;
    const maxX0 = 240 - w / c.scale;
    return { ...c, x0: clamp(c.x0, minX0, Math.max(minX0, maxX0)) };
  };

  const fit = useCallback(() => {
    const w = sizeRef.current.w;
    const list = dated(projects);
    const maxDay = Math.max(120, ...list.map((p) => p.endDay ?? p.day ?? 0)) + 14;
    const minDay = -24;
    const scale = clamp((w - LEFT_FREE - 40) / (maxDay - minDay), MIN_SCALE, MAX_SCALE);
    flyTo({ scale, x0: minDay - (LEFT_FREE - 10) / scale });
  }, [projects, flyTo]);

  const goToday = useCallback(() => {
    const scale = hubRef.current ? DEFAULT_SCALE : camRef.current.scale;
    flyTo(defaultCamera(sizeRef.current.w, scale));
  }, [flyTo]);

  const zoomButtons = (dir: 1 | -1) => {
    const w = sizeRef.current.w;
    const c = camRef.current;
    const px = clamp(cx(c, 0), LEFT_FREE, w - 40);
    const scale = clamp(c.scale * (dir > 0 ? 1.5 : 1 / 1.5), MIN_SCALE, MAX_SCALE);
    const d = dayAt(c, px);
    flyTo({ scale, x0: d - px / scale }, 280);
  };

  /* ── hub ────────────────────────────────────────────────────────── */

  const openHub = useCallback(
    (id: string) => {
      const p = projects.find((x) => x.id === id);
      if (!p || p.day === undefined) return;
      setHoverId(null);
      setClusterOpen(null);
      setActiveId(id);
      const prev = hubRef.current?.prev ?? camRef.current;
      setHub({ id, prev, phase: "flying" });
      flyTo(hubCamera(p, sizeRef.current.w), 700, () => setHub((h) => (h && h.id === id ? { ...h, phase: "open" } : h)));
    },
    [projects, flyTo],
  );

  const closeHub = useCallback(() => {
    const h = hubRef.current;
    if (!h || h.phase === "closing") return;
    setHub({ ...h, phase: "closing" });
    const back = () =>
      flyTo(
        h.prev,
        420,
        () => {
          setHub(null);
          requestAnimationFrame(() => {
            const el = canvasRef.current?.querySelector<HTMLElement>(`[data-node="${h.id}"]`);
            el?.focus({ preventScroll: true });
          });
        },
        easeV3,
      );
    if (reduce) back();
    else window.setTimeout(back, 120);
  }, [flyTo, reduce]);

  useEffect(() => {
    closeHubRef.current = closeHub;
  }, [closeHub]);

  /* ── wheel: vertical zooms, horizontal pans ─────────────────────── */

  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest("[data-scrollable]")) return;
      e.preventDefault();
      if (hubRef.current) {
        if (e.deltaY > 8) closeHubRef.current();
        return;
      }
      if (animRef.current) {
        cancelAnimationFrame(animRef.current);
        animRef.current = null;
      }
      const rect = el.getBoundingClientRect();
      const px = e.clientX - rect.left;
      const horizontal = Math.abs(e.deltaX) > Math.abs(e.deltaY) || e.shiftKey;
      if (horizontal) {
        const dx = e.deltaX || e.deltaY;
        setCam((c) => clampCam({ ...c, x0: c.x0 + dx / c.scale }));
      } else {
        const factor = Math.exp(-e.deltaY * (e.ctrlKey ? 0.012 : 0.0024));
        setCam((c) => {
          const scale = clamp(c.scale * factor, MIN_SCALE, MAX_SCALE);
          const d = dayAt(c, px);
          return clampCam({ scale, x0: d - px / scale });
        });
      }
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  /* ── derived ────────────────────────────────────────────────────── */

  const effective = useMemo(() => {
    const move = drag?.moved ? { id: drag.id, day: drag.day } : pending ? { id: pending.id, day: pending.to } : null;
    if (!move) return projects;
    return projects.map((p) => {
      if (p.id !== move.id) return p;
      const len = p.endDay !== undefined && p.day !== undefined ? p.endDay - p.day : undefined;
      return { ...p, day: move.day, endDay: len !== undefined ? move.day + len : undefined };
    });
  }, [projects, drag, pending]);

  const undated = projects.filter((p) => p.day === undefined);
  const baseCrunch = useMemo(() => crunches(projects), [projects]);
  const liveCrunch = useMemo(() => crunches(effective), [effective]);
  const previewing = !!(drag?.moved || pending);

  const extraBottom = lens === "people" ? LOAD_H : 0;
  const todayX = cx(cam, 0);

  // Past, not wrapped: one chip at the foot of the margin, clear of the
  // panel in every lens, when the margin is on screen.
  const pastCount = projects.filter((p) => p.unwrapped).length;
  const pastChipW = textW(`Past, not wrapped · ${pastCount}`, 12) + 22;
  const pastFoot = size.h - TOOLBAR_SPACE - (lens === "people" ? LOAD_H : 0) - 34;
  const pastChip: Rect | null =
    pastCount && !hub && todayX - 12 - pastChipW > 8
      ? { x1: todayX - 10 - pastChipW, x2: todayX - 10, y1: pastFoot, y2: pastFoot + 24 }
      : null;
  const pastChipClear = pastChip && (!chrome.panel || pastChip.y1 > chrome.panel.y2 || pastChip.x1 > chrome.panel.x2) ? pastChip : null;

  const baseKeep: Rect[] = [];
  if (chrome.panel) baseKeep.push(chrome.panel);
  if (pastChipClear) baseKeep.push({ ...pastChipClear, x1: pastChipClear.x1 - 8, x2: pastChipClear.x2 + 8 });

  // Pass one finds what falls off the edges and which links are long; pass
  // two reserves room for the edge chips and the "linked to" tags.
  const first = layout(effective, cam, size, lens, { extraBottom, keepOut: baseKeep });
  const longLinks = new Set<number>();
  const tags: RelTags = new Map();
  RELATIONS.forEach((r, i) => {
    const a = anchorOf(first.items, r.a);
    const b = anchorOf(first.items, r.b);
    if (!a || !b || Math.hypot(a.x - b.x, a.y - b.y) < 240) return;
    longLinks.add(i);
    const pa = effective.find((p) => p.id === r.a);
    const pb = effective.find((p) => p.id === r.b);
    if (pa && pb) {
      tags.set(r.a, pb.short);
      tags.set(r.b, pa.short);
    }
  });
  const edgeChip = (list: Project[]) => {
    const title = list.length === 1 ? list[0].name : `${list[0].short} and ${list.length - 1} more`;
    const d = list[0].day ?? 0;
    const e = list[0].endDay;
    const sub = e !== undefined ? `${fmtDayMonth(d)} to ${fmtDayMonth(e)}` : fmtIn(d);
    return { title, sub, w: Math.max(textW(title, 12.5), textW(sub, 11.5)) + 44 };
  };
  const chipKeep: Rect[] = [];
  for (const lane of first.lanes) {
    const list = first.offRight.get(lane.id);
    if (!list?.length) continue;
    const c = edgeChip(list);
    chipKeep.push({ x1: size.w - 12 - c.w - 10, x2: size.w, y1: lane.bottom - 30 - 22 - 8, y2: lane.bottom - 30 + 22 + 6 });
  }
  const main = layout(effective, cam, size, lens, { extraBottom, keepOut: [...baseKeep, ...chipKeep], tags });
  const { lanes, items, level, offRight, offLeft, lanesBottom } = main;
  // Each edge chip takes the first spot in its lane that no label covers.
  const chipY = new Map<string, number>();
  {
    const boxes = labelRects(items, level);
    const taken: Rect[] = [];
    for (const lane of lanes) {
      const list = offRight.get(lane.id);
      if (!list?.length) continue;
      const c = edgeChip(list);
      const x1 = size.w - 12 - c.w;
      const mid = (lane.top + lane.bottom) / 2;
      const tries = [lane.bottom - 30, mid, lane.top + 50, mid + 26, mid - 26];
      const clearAt = (y: number) =>
        y - 22 > lane.top && y + 22 < lane.bottom + 4 && [...boxes, ...taken].every((b) => b.x2 < x1 - 6 || b.y2 < y - 22 || b.y1 > y + 22);
      const y = tries.find(clearAt) ?? lane.bottom - 30;
      taken.push({ x1, x2: size.w, y1: y - 30, y2: y + 30 });
      chipY.set(lane.id, y);
    }
  }
  const baseLayout = previewing ? layout(projects, cam, size, lens, { extraBottom, keepOut: baseKeep }) : null;

  const timeOrder = useMemo(() => dated(effective), [effective]);
  const hubProject = hub ? effective.find((p) => p.id === hub.id) ?? null : null;
  const hubAnchor = hub ? anchorOf(items, hub.id) : null;

  const spotIds = useMemo(() => {
    if (!spot) return null;
    if (spot === "help") return new Set(projects.filter((p) => p.health === "help").map((p) => p.id));
    if (spot === "past") return new Set(projects.filter((p) => p.unwrapped).map((p) => p.id));
    return new Set(baseCrunch.flatMap((c) => c.projects));
  }, [spot, projects, baseCrunch]);

  // Hovering or focusing a crunch lights the projects that make it.
  const hotCrunch = crunchHot !== null ? liveCrunch.find((c) => c.start <= crunchHot && crunchHot < c.end) ?? null : null;
  const hotIds = hotCrunch ? new Set(hotCrunch.projects) : null;

  /* ── focus and keyboard ─────────────────────────────────────────── */

  const focusNode = useCallback(
    (id: string) => {
      setActiveId(id);
      const p = projects.find((x) => x.id === id);
      if (p?.day !== undefined) {
        const c = camRef.current;
        const x = cx(c, p.day);
        const w = sizeRef.current.w;
        if (x < LEFT_FREE - 20 || x > w - 80) {
          flyTo({ ...c, x0: p.day - (w * 0.5) / c.scale }, 380);
        }
      }
      const cluster = items.find((it) => it.type === "cluster" && it.members.some((m) => m.id === id));
      if (cluster && cluster.type === "cluster") setClusterOpen(cluster.key);
      const tryFocus = (n: number) =>
        requestAnimationFrame(() => {
          const el = canvasRef.current?.querySelector<HTMLElement>(`[data-node="${id}"]`);
          if (el) el.focus({ preventScroll: true });
          else if (n > 0) tryFocus(n - 1);
        });
      tryFocus(6);
    },
    [projects, items, flyTo],
  );

  const onNodeKey = (e: ReactKeyboardEvent, p: Project) => {
    const idx = timeOrder.findIndex((x) => x.id === p.id);
    if (e.shiftKey && (e.key === "ArrowRight" || e.key === "ArrowLeft")) {
      e.preventDefault();
      const step = (e.key === "ArrowRight" ? 1 : -1) * (e.altKey ? 1 : 7);
      setDrag((d) => {
        const from = d?.id === p.id ? d.from : p.day;
        const cur = d?.id === p.id ? d.day : p.day ?? 0;
        return { id: p.id, from, day: Math.max(0, cur + step), startX: 0, startDay: p.day ?? 0, moved: true };
      });
      return;
    }
    if (drag?.id === p.id && drag.moved && e.key === "Enter") {
      e.preventDefault();
      setPending({ id: p.id, from: drag.from, to: drag.day });
      setDrag(null);
      return;
    }
    if (e.key === "ArrowRight" || e.key === "ArrowDown") {
      e.preventDefault();
      const next = timeOrder[Math.min(timeOrder.length - 1, idx + 1)];
      if (next) focusNode(next.id);
    } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
      e.preventDefault();
      const prev = timeOrder[Math.max(0, idx - 1)];
      if (prev) focusNode(prev.id);
    } else if (e.key === "Home") {
      e.preventDefault();
      if (timeOrder[0]) focusNode(timeOrder[0].id);
    } else if (e.key === "End") {
      e.preventDefault();
      const last = timeOrder[timeOrder.length - 1];
      if (last) focusNode(last.id);
    }
  };

  const onRootKey = (e: ReactKeyboardEvent) => {
    const t = e.target as HTMLElement;
    if (t.closest("input, textarea, select, [contenteditable]")) {
      if (e.key === "Escape") setCreate(null);
      return;
    }
    if (e.key === "Escape") {
      if (drag) setDrag(null);
      else if (pending) setPending(null);
      else if (create) setCreate(null);
      else if (menuOpen) setMenuOpen(false);
      else if (noDateOpen) setNoDateOpen(false);
      else if (keyOpen) setKeyOpen(false);
      else if (hub) closeHub();
      else if (clusterOpen) setClusterOpen(null);
      else if (spot) setSpot(null);
      return;
    }
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key === "+" || e.key === "=") zoomButtons(1);
    else if (e.key === "-" || e.key === "_") zoomButtons(-1);
    else if (e.key === "0") fit();
    else if (e.key.toLowerCase() === "t" && !hub) goToday();
    else if (e.key === "1") setLens("health");
    else if (e.key === "2") setLens("people");
    else if (e.key === "3") setLens("kind");
    else if (e.key.toLowerCase() === "l") onList();
    else if (e.key.toLowerCase() === "n") startCreateAt(14);
    else return;
    e.preventDefault();
  };

  /* ── pointer: pan the background, drag nodes ────────────────────── */

  const onBgPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 || hub) return;
    const target = e.target as HTMLElement;
    if (!target.hasAttribute("data-bg")) return;
    if (animRef.current) {
      cancelAnimationFrame(animRef.current);
      animRef.current = null;
    }
    panRef.current = { x: e.clientX, x0: camRef.current.x0, id: e.pointerId };
    setPanning(true);
    e.currentTarget.setPointerCapture(e.pointerId);
    setClusterOpen(null);
    setMenuOpen(false);
    setNoDateOpen(false);
  };

  const onBgPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const pan = panRef.current;
    if (pan && pan.id === e.pointerId) {
      const dx = e.clientX - pan.x;
      setCam((c) => clampCam({ ...c, x0: pan.x0 - dx / c.scale }));
      return;
    }
    if (drag?.tray) {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;
      const px = e.clientX - rect.left;
      const py = e.clientY - rect.top;
      setDrag({ ...drag, px, py, day: Math.max(0, dayUnder(camRef.current, px)), moved: true });
    }
  };

  const onBgPointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (panRef.current?.id === e.pointerId) {
      panRef.current = null;
      setPanning(false);
    }
    if (drag?.tray) {
      const rect = canvasRef.current?.getBoundingClientRect();
      const px = rect ? e.clientX - rect.left : 0;
      if (drag.moved && px > LEFT_FREE - 20) setPending({ id: drag.id, from: undefined, to: drag.day });
      setDrag(null);
    }
  };

  const onBgDoubleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    if (!target.hasAttribute("data-bg") || hub) return;
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;
    const day = dayUnder(cam, px);
    if (day < 0) {
      setToast({ text: "Pick a date from today on to start a project", key: ++seq.current });
      return;
    }
    const lane = lanes.find((l) => py >= l.top && py < l.bottom) ?? lanes[0];
    setCreate({ day, lane: lane.id, x: px, y: py });
  };

  function startCreateAt(day: number) {
    const x = cx(camRef.current, day);
    const lane = lanes[0];
    setCreate({ day, lane: lane.id, x: clamp(x, LEFT_FREE + 20, size.w - 340), y: (lane.top + lane.bottom) / 2 });
  }

  const onNodePointerDown = (e: ReactPointerEvent<HTMLElement>, p: Project) => {
    if (e.button !== 0 || hub || p.unwrapped) return;
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    setDrag({ id: p.id, from: p.day, day: p.day ?? 0, startX: e.clientX, startDay: p.day ?? 0, moved: false });
  };

  const onNodePointerMove = (e: ReactPointerEvent<HTMLElement>) => {
    if (!drag || drag.tray) return;
    const dx = e.clientX - drag.startX;
    if (!drag.moved && Math.abs(dx) < 5) return;
    const day = Math.max(0, Math.round(drag.startDay + dx / camRef.current.scale));
    if (day !== drag.day || !drag.moved) setDrag({ ...drag, day, moved: true });
    setHoverId(null);
  };

  const onNodePointerUp = (e: ReactPointerEvent<HTMLElement>) => {
    if (!drag || drag.tray) return;
    (e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId);
    if (drag.moved) {
      suppressClick.current = true;
      if (drag.day !== drag.from) setPending({ id: drag.id, from: drag.from, to: drag.day });
    }
    setDrag(null);
  };

  const onNodeClick = (p: Project) => {
    if (suppressClick.current) {
      suppressClick.current = false;
      return;
    }
    if (drag?.moved) return;
    openHub(p.id);
  };

  const onTrayPointerDown = (e: ReactPointerEvent<HTMLElement>, p: Project) => {
    if (e.button !== 0) return;
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    canvasRef.current?.setPointerCapture(e.pointerId);
    setDrag({ id: p.id, from: undefined, day: 0, startX: e.clientX, startDay: 0, moved: false, tray: true, px: e.clientX - rect.left, py: e.clientY - rect.top });
  };

  const showHover = (id: string) => {
    if (hoverTimer.current) window.clearTimeout(hoverTimer.current);
    hoverTimer.current = window.setTimeout(() => setHoverId(id), 160);
  };
  const hideHover = () => {
    if (hoverTimer.current) window.clearTimeout(hoverTimer.current);
    hoverTimer.current = window.setTimeout(() => setHoverId(null), 80);
  };

  /* ── confirm, create, undo ──────────────────────────────────────── */

  const applyMove = (id: string, to: number | undefined) =>
    setProjects((list) =>
      list.map((p) => {
        if (p.id !== id) return p;
        if (to === undefined) return { ...p, day: undefined, endDay: undefined, status: "No date" };
        const len = p.endDay !== undefined && p.day !== undefined ? p.endDay - p.day : undefined;
        const status = p.status === "No date" ? (p.health === "good" ? "On track" : "Slipping") : p.status;
        return { ...p, day: to, endDay: len !== undefined ? to + len : undefined, status };
      }),
    );

  const confirmMove = () => {
    if (!pending) return;
    const { id, from, to } = pending;
    const p = projects.find((x) => x.id === id);
    applyMove(id, to);
    setPending(null);
    setToast({
      text: `${p?.short ?? "Project"} moved to ${fmtShort(to)}`,
      undo: () => applyMove(id, from),
      key: ++seq.current,
    });
    focusNode(id);
  };

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 6000);
    return () => window.clearTimeout(t);
  }, [toast]);

  const createProject = (name: string, kind: Kind, day: number, lane: string) => {
    const health: Health = "good";
    const id = `new-${++seq.current}`;
    const colors = ["var(--v3-project-1)", "var(--v3-project-3)", "var(--v3-project-6)", "var(--v3-project-8)"];
    const kindFromLane = lens === "kind" ? (lane as Kind) : kind;
    const proj: Project = {
      id,
      name,
      short: name.length > 16 ? `${name.slice(0, 15)}…` : name,
      kind: kindFromLane,
      day,
      health,
      status: health === "good" ? "On track" : health === "watch" ? "Slipping" : "Off track",
      progress: 0,
      open: 0,
      overdue: 0,
      owner: "orla",
      team: ["orla"],
      color: colors[name.length % colors.length],
      signal: "Just created, nothing to report yet",
      milestones: [{ day, label: "Target date" }],
      tasks: [],
      links: [],
      activity: [{ who: "orla", text: "created the project", ago: "Just now" }],
      isNew: true,
    };
    setProjects((list) => [...list, proj]);
    setCreate(null);
    setToast({ text: `${name} added on ${fmtShort(day)}`, undo: () => setProjects((list) => list.filter((p) => p.id !== id)), key: ++seq.current });
    focusNode(id);
  };

  /* ── render helpers ─────────────────────────────────────────────── */

  const dim = (id: string) => {
    if (hub) return hub.id !== id;
    if (hotIds) return !hotIds.has(id);
    if (spotIds) return !spotIds.has(id);
    if (hoverLink !== null) {
      const r = RELATIONS[hoverLink];
      return r.a !== id && r.b !== id;
    }
    return false;
  };


  const months: number[] = [];
  const firstVisible = Math.floor(dayAt(cam, 0)) - 40;
  const lastVisible = Math.ceil(dayAt(cam, size.w)) + 1;
  for (let d = firstVisible; d <= lastVisible; d++) if (parts(d).d === 1) months.push(d);
  const weekLines: number[] = [];
  for (let d = weekStart(firstVisible); d <= lastVisible; d += 7) weekLines.push(d);
  const showDays = cam.scale >= 26;
  const days: number[] = [];
  if (showDays) for (let d = Math.floor(dayAt(cam, 0)); d <= lastVisible; d++) days.push(d);

  const pastX = sx(cam, MAP_START);
  const laneLabelX = clamp(todayX + 12, LEFT_FREE + 4, size.w - 220);


  const edge = lanes.map((lane) => ({ lane, later: offRight.get(lane.id) ?? [] }));

  const panToProject = (p: Project) => {
    const c = camRef.current;
    const w = sizeRef.current.w;
    const target = (p.endDay ?? p.day ?? 0) as number;
    flyTo({ ...c, x0: target - (w * 0.62) / c.scale }, 520);
  };

  const hovered = hoverId && !drag && !hub ? effective.find((p) => p.id === hoverId) : null;
  const hoverCluster = hovered
    ? items.find((it) => it.type === "cluster" && it.key === clusterOpen && it.members.some((m) => m.id === hovered.id))
    : undefined;
  const hoverAnchorRaw = hovered ? anchorOf(items, hovered.id) : null;
  const hoverAnchor = hoverAnchorRaw;
  const hoverAvoid = hoverAnchorRaw && hoverCluster ? { l: hoverAnchorRaw.x - 34, r: hoverAnchorRaw.x - 34 + 316 } : undefined;

  const renderNode = (p: Project, x: number, y: number, r: number, labelW: number, compact: boolean, extra?: { inFan?: boolean; flip?: boolean; bare?: boolean }) => {
    const isDrag = (drag?.moved && drag.id === p.id) || pending?.id === p.id;
    const nm = nextMilestone(p);
    const showMid = level !== "far" && !compact;
    const past = !!p.unwrapped;
    const gc = glyphColours(p, lens);
    return (
      <button
        key={p.id}
        type="button"
        data-node={p.id}
        className={s.node}
        data-level={level}
        data-past={past ? "" : undefined}
        data-dim={dim(p.id) ? "" : undefined}
        data-drag={isDrag ? "" : undefined}
        data-new={p.isNew ? "" : undefined}
        data-hover={hoverId === p.id ? "" : undefined}
        data-fan={extra?.inFan ? "" : undefined}
        data-flip={extra?.flip ? "" : undefined}
        style={{ left: x - r, top: y - r, "--r": `${r}px` } as CSSProperties}
        tabIndex={activeId === p.id ? 0 : -1}
        aria-label={fullLabel(p)}
        aria-describedby="c4-map-help"
        onClick={() => onNodeClick(p)}
        onKeyDown={(e) => onNodeKey(e, p)}
        onFocus={() => {
          setActiveId(p.id);
          setFocusId(p.id);
        }}
        onBlur={() => setFocusId((f) => (f === p.id ? null : f))}
        onPointerDown={(e) => onNodePointerDown(e, p)}
        onPointerMove={onNodePointerMove}
        onPointerUp={onNodePointerUp}
        onPointerEnter={() => (extra?.inFan ? undefined : showHover(p.id))}
        onPointerLeave={hideHover}
      >
        <span className={s.nodeGlyphWrap}>
          <NodeGlyph p={p} r={r} ring={gc.ring} fill={gc.fill} muted={past} />
          {p.overdue > 0 && !past ? (
            <span className={s.overdueBadge} title={`${p.overdue} overdue ${p.overdue === 1 ? "task" : "tasks"}`} aria-hidden="true">
              {p.overdue}
            </span>
          ) : null}
          {hotIds?.has(p.id) ? <span className={s.hotRing} aria-hidden="true" /> : null}
        </span>
        {extra?.bare ? null : (
        <span className={s.nodeLabel} style={{ maxWidth: labelW + 14 }}>
          <span className={s.nodeLine1}>
            {lens !== "health" && !extra?.inFan ? <HealthDot health={p.health} /> : null}
            <span className={s.nodeName}>{level === "far" || compact ? p.short : p.name}</span>
            <span className={s.nodeDays} data-past={past ? "" : undefined}>
              {past ? `${-(p.day ?? 0)} days over` : fmtUntil(p.day ?? 0)}
            </span>
          </span>
          {extra?.inFan ? (
            <span className={s.nodeLine2}>
              <span className={s.fanStatus} data-health={p.unwrapped ? "past" : p.health}>
                {statusWord(p)}
              </span>
              <span className={s.nodeNext}>
                {p.progress}% done{p.overdue ? ` · ${p.overdue} overdue` : ""}
              </span>
            </span>
          ) : showMid ? (
            <span className={s.nodeLine2}>
              <LeadAvatar p={p} />
              <span className={s.nodeNext}>
                {past ? p.unwrapped : nm ? `Next: ${nm.label} · ${fmtDayMonth(nm.day)}` : statusWord(p)}
              </span>
              {tags.get(p.id) ? (
                <span className={s.relTag}>
                  <Icon name="link" size={11} />
                  {tags.get(p.id)}
                </span>
              ) : null}
            </span>
          ) : null}
          {level === "near" && !compact ? (
            <span className={s.nodeLine3}>
              <span className={s.miniBar} aria-hidden="true">
                <span style={{ width: `${p.progress}%`, background: gc.fill }} />
              </span>
              {p.progress}% · {p.open} open
            </span>
          ) : null}
        </span>
        )}
      </button>
    );
  };

  const renderItem = (it: Placed) => {
    if (it.type === "node") return renderNode(it.p, it.x, it.y, it.r, it.labelW, it.compact, { flip: it.flip, bare: it.bare });
    if (it.type === "pill") {
      const p = it.p;
      const isDrag = (drag?.moved && drag.id === p.id) || pending?.id === p.id;
      const width = Math.max(28, it.x2 - it.x1);
      const shown = it.bleed ? Math.max(28, size.w - it.x1) : width;
      return (
        <button
          key={p.id}
          type="button"
          data-node={p.id}
          className={s.pill}
          data-level={level}
          data-dim={dim(p.id) ? "" : undefined}
          data-drag={isDrag ? "" : undefined}
          data-inside={it.labelInside ? "" : undefined}
          data-bleed={it.bleed ? "" : undefined}
          data-flip={it.flipLabel ? "" : undefined}
          data-hot={hotIds?.has(p.id) ? "" : undefined}
          style={{ left: it.x1, top: it.y - it.h / 2, width: shown, height: it.h, "--ring": fillFor(p, lens) } as CSSProperties}
          tabIndex={activeId === p.id ? 0 : -1}
          aria-label={fullLabel(p)}
          aria-describedby="c4-map-help"
          onClick={() => onNodeClick(p)}
          onKeyDown={(e) => onNodeKey(e, p)}
          onFocus={() => setActiveId(p.id)}
          onPointerDown={(e) => onNodePointerDown(e, p)}
          onPointerMove={onNodePointerMove}
          onPointerUp={onNodePointerUp}
          onPointerEnter={() => showHover(p.id)}
          onPointerLeave={hideHover}
        >
          <span className={s.pillTrack} aria-hidden="true">
            <span className={s.pillFill} style={{ width: (p.progress / 100) * width }} />
          </span>
          {p.overdue > 0 ? (
            <span className={s.overdueBadge} data-pill="" title={`${p.overdue} overdue ${p.overdue === 1 ? "task" : "tasks"}`} aria-hidden="true">
              {p.overdue}
            </span>
          ) : null}
          <span className={s.pillLabel} style={it.labelInside || it.flipLabel ? undefined : { left: width + 10 }}>
            <span className={s.nodeLine1}>
              {lens !== "health" ? <HealthDot health={p.health} /> : null}
              <span className={s.nodeName}>{level === "far" ? p.short : p.name}</span>
              <span className={s.nodeDays}>{(p.day ?? 0) > 0 ? fmtUntil(p.day ?? 0) : "Running now"}</span>
              {it.bleed && p.endDay !== undefined ? (
                <span className={s.pillEnd}>
                  <Icon name="arrow-right" size={11} />
                  {fmtDayMonth(p.endDay)}
                </span>
              ) : null}
            </span>
          </span>
          {level !== "far" ? (
            <span className={s.pillBelow}>
              <span className={s.nodeLine2}>
                <LeadAvatar p={p} />
                <span className={s.nodeNext}>{nextMilestone(p) ? `Next: ${nextMilestone(p)?.label} · ${fmtDayMonth(nextMilestone(p)?.day ?? 0)}` : statusWord(p)}</span>
                {tags.get(p.id) ? (
                  <span className={s.relTag}>
                    <Icon name="link" size={11} />
                    {tags.get(p.id)}
                  </span>
                ) : null}
              </span>
            </span>
          ) : null}
        </button>
      );
    }
    // cluster
    const open = clusterOpen === it.key;
    const ids = it.members.map((m) => m.id);
    const containsActive = ids.includes(activeId);
    const first = it.members[0].day ?? 0;
    const last = it.members[it.members.length - 1].day ?? 0;
    const allDim = it.members.every((m) => dim(m.id));
    const hot = it.members.some((m) => hotIds?.has(m.id));
    // The fan opens beside the cluster, on the side facing the middle of the
    // free canvas, 12px clear of it, and below the crunch tags.
    const FAN_W = 316;
    const fanH = it.members.length * 56 + 12;
    const toLeft = it.x > (LEFT_FREE + size.w) / 2;
    const fanLeft = toLeft ? -(it.r + 2 + 12 + FAN_W) : it.r + 2 + 12;
    const fanTop = clamp(it.y - fanH / 2, RULER_H + 48, size.h - 96 - fanH) - it.y;
    const enterCluster = () => {
      if (clusterTimer.current) window.clearTimeout(clusterTimer.current);
      if (hoverTimer.current) window.clearTimeout(hoverTimer.current);
      setHoverId(null);
      setClusterOpen(it.key);
    };
    const leaveCluster = () => {
      if (clusterTimer.current) window.clearTimeout(clusterTimer.current);
      clusterTimer.current = window.setTimeout(() => setClusterOpen((k) => (k === it.key ? null : k)), 140);
    };
    return (
      <div key={it.key} className={s.clusterWrap} style={{ left: it.x, top: it.y }} onPointerEnter={enterCluster} onPointerLeave={leaveCluster}>
        <button
          type="button"
          className={s.cluster}
          data-open={open ? "" : undefined}
          data-dim={allDim ? "" : undefined}
          data-hot={hot ? "" : undefined}
          tabIndex={containsActive && !open ? 0 : -1}
          aria-expanded={open}
          aria-label={`${it.members.length} projects between ${fmtDayMonth(first)} and ${fmtDayMonth(last)}: ${it.members.map((m) => m.name).join(", ")}`}
          onClick={() => setClusterOpen(open ? null : it.key)}
          onKeyDown={(e) => {
            if (e.key === "ArrowRight" || e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              focusNode(it.members[0].id);
            }
          }}
        >
          {it.members.slice(0, 3).map((m, i) => (
            <span key={m.id} className={s.clusterDisc} style={{ background: fillFor(m, lens), transform: `translate(${(i - 1) * 7}px, ${(i - 1) * -3}px)` }} aria-hidden="true" />
          ))}
          <span className={s.clusterCount} aria-hidden="true">
            {it.members.length}
          </span>
        </button>
        {!open && !it.bare ? (
          <span className={s.clusterLabel} data-dim={allDim ? "" : undefined} data-flip={it.flip ? "" : undefined} aria-hidden="true">
            <span className={s.nodeName}>{it.members.length} projects</span>
            <span className={s.nodeDays}>
              {fmtDayMonth(first)}
              {first !== last ? ` to ${fmtDayMonth(last)}` : ""}
            </span>
          </span>
        ) : null}
        <AnimatePresence>
          {open ? (
            <motion.div
              className={s.fan}
              data-side={toLeft ? "left" : "right"}
              initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.94, x: toLeft ? 8 : -8 }}
              animate={{ opacity: 1, scale: 1, x: 0 }}
              exit={{ opacity: 0, scale: reduce ? 1 : 0.97, transition: { duration: 0.12 } }}
              transition={{ duration: 0.2, ease: [0.2, 0.8, 0.2, 1] }}
              style={{ width: FAN_W, height: fanH, top: fanTop, left: fanLeft, transformOrigin: `${toLeft ? FAN_W : 0}px ${-fanTop}px` }}
            >
              {it.members.map((m, i) => {
                const r = Math.min(16, radiusFor(m.open));
                return (
                  <motion.div
                    key={m.id}
                    className={s.fanRow}
                    initial={reduce ? false : { opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2, delay: 0.04 + i * 0.03, ease: [0.2, 0.8, 0.2, 1] }}
                    style={{ top: 6 + i * 56 }}
                  >
                    {renderNode(m, 28, 28, r, 236, false, { inFan: true })}
                  </motion.div>
                );
              })}
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    );
  };

  const nodePos = (id: string) => anchorOf(items, id);
  const linkPaths = RELATIONS.map((r, i) => {
    const a = nodePos(r.a);
    const b = nodePos(r.b);
    if (!a || !b) return null;
    const mx = (a.x + b.x) / 2;
    const bend = Math.min(80, Math.abs(b.x - a.x) * 0.25 + 20);
    const my = (a.y + b.y) / 2 - bend;
    const active = hoverLink === i || hoverId === r.a || hoverId === r.b || focusId === r.a || focusId === r.b || (hub && (hub.id === r.a || hub.id === r.b));
    // Long links cross the map and cut through labels, so they only draw
    // while one end is hovered or focused; a small tag on each node says so.
    const hidden = longLinks.has(i) && !active;
    // The hover card already names the link, so its tag on the map only shows
    // for the line itself or a keyboard focus with no card open.
    const tag = hoverLink === i || (!hovered && (focusId === r.a || focusId === r.b));
    return { i, r, d: `M ${a.x} ${a.y} Q ${mx} ${my} ${b.x} ${b.y}`, mx, my: (a.y + b.y) / 2 - bend / 2, active, hidden, tag };
  });

  // How a previewed move changes each crunch: new, heavier, longer, or not at all.
  const crunchChange = (c: Crunch): "new" | "heavier" | "longer" | null => {
    if (!previewing) return null;
    const b = baseCrunch.find((x) => sameCrunch(x, c));
    if (!b) return "new";
    if (c.count > b.count || c.people.length > b.people.length) return "heavier";
    if (c.start < b.start || c.end > b.end) return "longer";
    return null;
  };
  const CHANGE_WORD = { new: "New crunch", heavier: "Heavier crunch", longer: "Longer crunch" } as const;
  // Neighbouring crunch tags stack instead of overlapping.
  const crunchRows: number[] = [];
  {
    const ends: number[] = [];
    liveCrunch.forEach((c, ci) => {
      const w = crunchTagW(c);
      const mid = (sx(cam, c.start) + sx(cam, c.end)) / 2;
      const a = mid - w / 2;
      let row = 0;
      while (ends[row] !== undefined && ends[row] > a - 8) row++;
      ends[row] = mid + w / 2;
      crunchRows[ci] = row;
    });
  }

  const crunchTagRects = liveCrunch.map((c) => {
    const tw = crunchTagW(c);
    const mid = clamp((sx(cam, c.start) + sx(cam, c.end)) / 2, LEFT_FREE + tw / 2, size.w - tw / 2 - 12);
    return { x1: mid - tw / 2, x2: mid + tw / 2 };
  });

  // Lane names sit just right of today. When a disc or a label already holds
  // that spot (a short lane on a narrow screen), the name moves left of
  // today, then lower, so it never hides under a project.
  const laneLabelPos = (() => {
    const boxes: Rect[] = labelRects(items, level).map((b) => ({ x1: b.x1 - 4, x2: b.x2 + 4, y1: b.y1 - 4, y2: b.y2 + 4 }));
    for (const it of items) {
      if (it.type === "node" || it.type === "cluster") boxes.push({ x1: it.x - it.r - 6, x2: it.x + it.r + 12, y1: it.y - it.r - 10, y2: it.y + it.r + 4 });
    }
    if (chrome.panel) boxes.push(chrome.panel);
    const out = new Map<string, { x: number; y: number }>();
    for (const lane of lanes) {
      const w = textW(lane.label, 12) + (lens === "health" ? 14 : lens === "people" ? 24 : 0) + 34;
      const baseTop =
        lane.top + (lane === lanes[0] && crunchTagRects.some((r) => laneLabelX < r.x2 + 8 && laneLabelX + w > r.x1 - 8) ? 44 : 10);
      const leftX = todayX - 12 - w;
      const tries: { x: number; y: number }[] = [
        { x: laneLabelX, y: baseTop },
        ...(leftX > 8 ? [{ x: leftX, y: baseTop }] : []),
        { x: laneLabelX, y: lane.top + 10 },
        ...(leftX > 8 ? [{ x: leftX, y: lane.top + 10 }] : []),
      ];
      const clear = (t: { x: number; y: number }) =>
        t.y + 24 <= lane.bottom &&
        boxes.every((b) => t.x + w < b.x1 || t.x > b.x2 || t.y + 24 < b.y1 || t.y > b.y2) &&
        (lane !== lanes[0] || t.y > 40 || crunchTagRects.every((r) => t.x + w < r.x1 - 8 || t.x > r.x2 + 8));
      out.set(lane.id, tries.find(clear) ?? tries[0]);
    }
    return out;
  })();

  const clearedCrunch = previewing ? baseCrunch.filter((b) => !liveCrunch.find((c) => sameCrunch(c, b))) : [];

  const pendingProject = pending ? effective.find((p) => p.id === pending.id) : null;
  const pendingAnchor = pending ? anchorOf(items, pending.id) : null;
  const cons = pending && pendingProject ? consequences(baseCrunch, liveCrunch, projects.find((p) => p.id === pending.id), pending.to, projects) : [];
  const dragConsequence = drag?.moved && !drag.tray ? consequences(baseCrunch, liveCrunch, projects.find((p) => p.id === drag.id), drag.day, projects) : [];

  const helpCount = projects.filter((p) => p.health === "help" && p.day !== undefined).length;
  const read = reading(projects, baseCrunch);

  // In a project, the toolbar steps through projects in date order.
  const hubIdx = hub ? timeOrder.findIndex((p) => p.id === hub.id) : -1;
  const hubPrev = hubIdx > 0 ? timeOrder[hubIdx - 1] : null;
  const hubNext = hubIdx >= 0 && hubIdx < timeOrder.length - 1 ? timeOrder[hubIdx + 1] : null;

  const addMilestone = () => {
    if (!hubProject || hubProject.day === undefined) return;
    const id = hubProject.id;
    const end = hubProject.day;
    const taken = new Set(hubProject.milestones.map((m) => m.day));
    let day = Math.max(1, Math.round(end / 2));
    while (taken.has(day) && day < end - 1) day++;
    const ms = { day, label: "New milestone" };
    setProjects((list) => list.map((p) => (p.id === id ? { ...p, milestones: [...p.milestones, ms].sort((a, b) => a.day - b.day) } : p)));
    setToast({
      text: `Milestone added on ${fmtShort(day)}`,
      undo: () => setProjects((list) => list.map((p) => (p.id === id ? { ...p, milestones: p.milestones.filter((m) => m !== ms) } : p))),
      key: ++seq.current,
    });
  };

  // Where the crunch glow peaks: the height of the projects that make it.
  const crunchPeak = (c: Crunch) => {
    const ys = c.projects.map((id) => anchorOf(items, id)?.y).filter((y): y is number => y !== undefined);
    if (!ys.length) return 42;
    const mean = ys.reduce((a, b) => a + b, 0) / ys.length;
    return clamp(((mean - RULER_H) / Math.max(1, lanesBottom - RULER_H)) * 100, 12, 88);
  };
  const isEmpty = projects.length === 0;

  return (
    <div ref={rootRef} className={s.mapRoot} onKeyDown={onRootKey} data-panning={panning ? "" : undefined} data-lens={lens}>
      <p id="c4-map-help" className={s.srOnly}>
        Enter opens the project. Arrow keys move between projects in date order. Shift and arrow keys try a new date a week at a time; press Enter to review the move.
      </p>
      <div
        ref={canvasRef}
        className={s.canvas}
        data-bg=""
        data-ready={ready ? "" : undefined}
        data-hub={hub ? "" : undefined}
        onPointerDown={onBgPointerDown}
        onPointerMove={onBgPointerMove}
        onPointerUp={onBgPointerUp}
        onPointerCancel={onBgPointerUp}
        onDoubleClick={onBgDoubleClick}
        role="application"
        aria-roledescription="project map"
        aria-label="Project map. Time runs left to right from today; rows show how each project is going."
      >
        {/* lanes */}
        {lanes.map((lane) => (
          <div
            key={lane.id}
            data-bg=""
            className={s.lane}
            data-lane={lane.id}
            data-lens={lens}
            style={{ top: lane.top, height: lane.bottom - lane.top }}
          />
        ))}

        {/* past margin */}
        <div className={s.pastMargin} data-bg="" style={{ left: pastX, width: Math.max(0, todayX - pastX), top: RULER_H, bottom: 0 }} />
        {pastChipClear ? (
          <button
            type="button"
            className={s.pastChip}
            style={{ left: pastChipClear.x1, top: pastChipClear.y1 }}
            aria-pressed={spot === "past"}
            onClick={() => setSpot(spot === "past" ? null : "past")}
            title="Past its date and not wrapped up. Click to pick it out."
          >
            Past, not wrapped <span className={s.laneCount}>· {pastCount}</span>
          </button>
        ) : null}

        {/* grid */}
        {weekLines.map((d) => (
          <span key={`w${d}`} className={s.weekLine} style={{ left: sx(cam, d) }} aria-hidden="true" />
        ))}
        {months.map((d) => (
          <span key={`m${d}`} className={s.monthLine} style={{ left: sx(cam, d) }} aria-hidden="true" />
        ))}

        {/* crunch zones */}
        {liveCrunch.map((c) => {
          const x1 = sx(cam, c.start);
          const x2 = sx(cam, c.end);
          const isNew = !!crunchChange(c);
          const lit = spot === "crunch" || crunchHot === c.start;
          return (
            <div
              key={`c${c.start}`}
              className={s.crunch}
              data-new={isNew ? "" : undefined}
              data-lit={lit ? "" : undefined}
              data-hidden={hub ? "" : undefined}
              style={{ left: x1, width: x2 - x1, top: RULER_H, height: Math.max(0, lanesBottom - RULER_H), "--peak": `${crunchPeak(c)}%` } as CSSProperties}
              aria-hidden="true"
            >
              <span className={s.crunchGlow} />
            </div>
          );
        })}
        {/* the final fortnight of each project in the lit crunch, so the cause is visible */}
        {hotCrunch && !hub
          ? hotCrunch.projects.map((id) => {
              const p = effective.find((x) => x.id === id);
              const a = anchorOf(items, id);
              if (!p || !a || p.day === undefined) return null;
              const from = sx(cam, Math.max(p.day - 13, 0));
              return <span key={`ff${id}`} className={s.runUp} style={{ left: from, width: Math.max(0, a.x - from), top: a.y - 2 }} aria-hidden="true" />;
            })
          : null}
        {clearedCrunch.map((c) => {
          const x1 = sx(cam, c.start);
          const x2 = sx(cam, c.end);
          return (
            <div key={`cc${c.start}`} className={s.crunchCleared} style={{ left: x1, width: x2 - x1, top: RULER_H, height: Math.max(0, lanesBottom - RULER_H) }} aria-hidden="true">
              <span className={s.crunchTag} data-cleared="">
                <Icon name="check" size={13} />
                Crunch clears
              </span>
            </div>
          );
        })}

        {/* today */}
        <div className={s.todayLine} style={{ left: todayX }} aria-hidden="true" />

        {/* lane labels */}
        {!hub
          ? lanes.map((lane) => (
              <div
                key={`l${lane.id}`}
                className={s.laneLabel}
                data-lane={lane.id}
                data-lens={lens}
                style={{
                  left: laneLabelPos.get(lane.id)?.x ?? laneLabelX,
                  top: laneLabelPos.get(lane.id)?.y ?? lane.top + 10,
                }}
              >
                {lens === "health" ? <HealthDot health={lane.id as Health} /> : null}
                {lens === "people" && lane.person ? <Avatar id={lane.person} size={18} /> : null}
                {lane.label}
                <span className={s.laneCount}>{lane.count}</span>
              </div>
            ))
          : null}

        {/* relation lines */}
        <svg className={s.links} width={size.w} height={size.h} aria-hidden="true">
          {linkPaths.map((l) =>
            l ? (
              <path
                key={l.i}
                d={l.d}
                className={s.linkPath}
                data-active={l.active ? "" : undefined}
                data-dim={(hub && !l.active) || l.hidden ? "" : undefined}
                onPointerEnter={() => setHoverLink(l.i)}
                onPointerLeave={() => setHoverLink(null)}
              />
            ) : null,
          )}
        </svg>
        {linkPaths.map((l) =>
          l && l.tag && !hub && !drag?.moved ? (
            <span key={`lt${l.i}`} className={s.linkTag} style={{ left: l.mx, top: l.my }}>
              {l.r.reason}
            </span>
          ) : null,
        )}

        {/* drag ghost */}
        {previewing && baseLayout
          ? (() => {
              const id = drag?.id ?? pending?.id;
              const from = drag?.from ?? pending?.from;
              if (!id || from === undefined) return null;
              const it = baseLayout.items.find((x) => (x.type === "cluster" ? x.members.some((m) => m.id === id) : x.p.id === id));
              if (!it) return null;
              const gx = it.type === "pill" ? it.x1 : it.x;
              const p = projects.find((x) => x.id === id);
              const r = it.type === "node" ? it.r : 14;
              return (
                <div className={s.ghost} style={{ left: gx - r, top: it.y - r, width: r * 2, height: r * 2 }} aria-hidden="true">
                  <span className={s.ghostTag}>Was {p?.day !== undefined ? fmtShort(from) : ""}</span>
                </div>
              );
            })()
          : null}

        {/* nodes */}
        <div className={s.items}>{items.map(renderItem)}</div>

        {/* crunch tags: hover or focus lights the projects that make the week */}
        {!hub
          ? liveCrunch.map((c, ci) => {
              const change = crunchChange(c);
              const isNew = !!change;
              const word = change ? CHANGE_WORD[change] : "Crunch";
              const tw = crunchTagW(c);
              const mid = clamp((sx(cam, c.start) + sx(cam, c.end)) / 2, LEFT_FREE + tw / 2, size.w - tw / 2 - 12);
              const row = crunchRows[ci] ?? 0;
              const label = `${word} ${crunchRange(c)}: ${crunchLabel(c)}: ${c.projects.map((id) => projects.find((p) => p.id === id)?.name).filter(Boolean).join(", ")}.`;
              return (
                <button
                  key={`ct${c.start}`}
                  type="button"
                  className={s.crunchTag}
                  data-new={isNew ? "" : undefined}
                  aria-pressed={spot === "crunch"}
                  aria-label={label}
                  style={{ left: mid, top: RULER_H + 10 + row * 34 }}
                  onPointerEnter={() => setCrunchHot(c.start)}
                  onPointerLeave={() => setCrunchHot((h) => (h === c.start ? null : h))}
                  onFocus={() => setCrunchHot(c.start)}
                  onBlur={() => setCrunchHot((h) => (h === c.start ? null : h))}
                  onClick={() => setSpot(spot === "crunch" ? null : "crunch")}
                >
                  <Icon name="alert" size={13} />
                  <span>{word}</span>
                  <span className={s.crunchPeople} aria-hidden="true">
                    {c.people.map((id) => (
                      <Avatar key={id} id={id} size={20} />
                    ))}
                  </span>
                  <span>{crunchLabel(c).replace(/^.*?(each finish|finishes)/, "$1")}</span>
                </button>
              );
            })
          : null}

        {/* empty map */}
        {isEmpty ? (
          <div className={s.emptyGhost} style={{ left: sx(cam, 14) - 22, top: (lanes[0].top + lanes[lanes.length - 1].bottom) / 2 - 22 }}>
            <span className={s.emptyDisc} aria-hidden="true" />
            <span className={s.emptyText}>
              <strong>Double-click a date to start a project</strong>
              <span>It lands where you click. You can move it later.</span>
            </span>
          </div>
        ) : null}

        {/* edge indicators: only for projects wholly off screen */}
        {!hub
          ? edge.map(({ lane, later }) => {
              if (!later.length) return null;
              const c = edgeChip(later);
              return (
                <button
                  key={`e${lane.id}`}
                  type="button"
                  className={s.edgeChip}
                  data-side="right"
                  style={{ top: chipY.get(lane.id) ?? lane.bottom - 30 }}
                  onClick={() => panToProject(later[0])}
                  aria-label={`${later.length} later in ${lane.label}: ${later.map((p) => `${p.name}, ${fmtIn(p.day ?? 0)}`).join("; ")}. Show`}
                >
                  <span className={s.edgeText}>
                    {c.title}
                    <span className={s.edgeSub}>{c.sub}</span>
                  </span>
                  <Icon name="chevron-right" size={14} />
                </button>
              );
            })
          : null}
        {!hub && offLeft.length && todayX < LEFT_FREE - 40 ? (
          <button
            type="button"
            className={s.edgeChip}
            data-side="left"
            style={{ top: lanes[0].top + 28, left: LEFT_FREE }}
            onClick={goToday}
            aria-label={`${offLeft.length} earlier. Back to today`}
          >
            <Icon name="chevron-left" size={14} />
            <span className={s.edgeText} data-left="">
              Back to today
              <span className={s.edgeSub}>{offLeft.length} earlier</span>
            </span>
          </button>
        ) : null}

        {/* hub */}
        <AnimatePresence>
          {hub ? (
            <motion.div
              key="scrim"
              className={s.hubScrim}
              initial={{ opacity: 0 }}
              animate={{ opacity: hub.phase === "closing" ? 0 : 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              onClick={closeHub}
              aria-hidden="true"
            />
          ) : null}
        </AnimatePresence>
        <AnimatePresence>
          {hub && hub.phase === "open" && hubProject ? (
            <HubCard key={hubProject.id} p={hubProject} cam={cam} size={size} crunch={baseCrunch} all={projects} origin={hubAnchor} onClose={closeHub} />
          ) : null}
        </AnimatePresence>

        {/* people lens: load strips */}
        <AnimatePresence>
          {lens === "people" && !hub ? (
            <motion.div
              className={s.loadPanel}
              style={{ height: LOAD_H - 12 }}
              initial={reduce ? { opacity: 0 } : { opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: reduce ? 0 : 16 }}
              transition={{ duration: 0.24, ease: [0.2, 0.8, 0.2, 1] }}
              aria-label="Who is stretched when"
              role="group"
            >
              <LoadStrips projects={effective} cam={cam} width={size.w - 32} todayX={todayX} />
            </motion.div>
          ) : null}
        </AnimatePresence>

        {/* ruler */}
        <div className={s.ruler} aria-hidden="true">
          {months.map((d, i) => {
            const x = sx(cam, d);
            const next = months[i + 1];
            if (x < 0 && next !== undefined && sx(cam, next) <= 0) return null;
            const left = x < 0 ? Math.min(0, (next !== undefined ? sx(cam, next) : Infinity) - 110) : x;
            const p = parts(d);
            const roomy = cam.scale * 30 > 96;
            return (
              <span key={`rm${d}`} className={s.rulerMonth} style={{ left }}>
                {roomy ? monthName(p.m) : monthShort(p.m)}
                {p.m === 0 ? <span className={s.rulerYear}> {p.y}</span> : null}
              </span>
            );
          })}
          {weekLines.map((d) => (
            <span key={`rw${d}`} className={s.rulerWeek} style={{ left: sx(cam, d) }}>
              {cam.scale * 7 > 34 && !showDays ? <span>{parts(d).d}</span> : null}
            </span>
          ))}
          {days.map((d) => (
            <span key={`rd${d}`} className={s.rulerDay} data-weekend={parts(d).wd % 6 === 0 ? "" : undefined} style={{ left: sx(cam, d) + cam.scale / 2 }}>
              {parts(d).d}
            </span>
          ))}
          {!hub
            ? liveCrunch.map((c) => (
                <span key={`rc${c.start}`} className={s.rulerCrunch} style={{ left: sx(cam, c.start), width: (c.end - c.start) * cam.scale }} />
              ))
            : null}
          <span className={s.rulerToday} style={{ left: todayX }}>
            Today · {fmtShort(0)}
          </span>
        </div>

        {/* hover card */}
        <AnimatePresence>
          {hovered && hoverAnchor ? (
            <HoverCard key={hovered.id} p={hovered} x={hoverAnchor.x} y={hoverAnchor.y} size={size} projects={projects} avoid={hoverAvoid} crunch={baseCrunch} />
          ) : null}
        </AnimatePresence>

        {/* drag readout: pinned above the dragged node, nudged off neighbouring labels */}
        {drag?.moved && !drag.tray ? (
          (() => {
            const a = anchorOf(items, drag.id);
            const it = items.find((x) => (x.type === "cluster" ? x.members.some((m) => m.id === drag.id) : x.p.id === drag.id));
            if (!a || !it) return null;
            const delta = drag.from !== undefined ? drag.day - drag.from : 0;
            const warn = dragConsequence[0] && dragConsequence[0].tone !== "calm" ? dragConsequence[0] : null;
            const w = 150 + (warn ? 110 : 0);
            const r = it.type === "node" ? it.r : 16;
            const boxes = labelRects(items, level).filter((b) => b.id !== drag.id);
            const hits = (y1: number) => boxes.some((b) => !(a.x + w / 2 < b.x1 || a.x - w / 2 > b.x2 || y1 + 30 < b.y1 || y1 > b.y2));
            const above = a.y - r - 40;
            const below = a.y + r + 10;
            const canAbove = above > RULER_H + 6;
            const top = canAbove && (!hits(above) || hits(below)) ? above : below;
            return (
              <div className={s.dragReadout} style={{ left: clamp(a.x, w / 2 + 8, size.w - w / 2 - 8), top }} role="status">
                <strong>{fmtShort(drag.day)}</strong>
                <span>{delta === 0 ? "same day" : `${Math.abs(delta)} ${Math.abs(delta) === 1 ? "day" : "days"} ${delta > 0 ? "later" : "earlier"}`}</span>
                {warn ? (
                  <span className={s.dragWarn} data-tone={warn.tone}>
                    {warn.tone === "bad" ? (warn.text.includes("heavier") ? "Heavier crunch" : warn.text.includes("grows") ? "Longer crunch" : "Makes a crunch") : "Clears a crunch"}
                  </span>
                ) : null}
              </div>
            );
          })()
        ) : null}

        {/* tray drag avatar */}
        {drag?.tray && drag.px !== undefined && drag.py !== undefined ? (
          <div className={s.trayGhost} style={{ left: drag.px, top: drag.py }} aria-hidden="true">
            <IdTile p={projects.find((p) => p.id === drag.id) as Project} size={22} />
            <span>{projects.find((p) => p.id === drag.id)?.short}</span>
            {drag.moved && drag.px > LEFT_FREE - 20 ? <em>{fmtShort(drag.day)}</em> : <em>Drop on a date</em>}
          </div>
        ) : null}

        {/* confirm move */}
        <AnimatePresence>
          {pending && pendingProject && pendingAnchor ? (
            <motion.div
              key="confirm"
              className={s.confirm}
              style={{ left: clamp(pendingAnchor.x - 170, LEFT_FREE, size.w - 356), top: clamp(pendingAnchor.y + 30, RULER_H + 8, size.h - 300) }}
              initial={reduce ? { opacity: 0 } : { opacity: 0, y: -6, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, transition: { duration: 0.12 } }}
              transition={{ duration: 0.2, ease: [0.2, 0.8, 0.2, 1] }}
              role="dialog"
              aria-label={`Move ${pendingProject.name}`}
            >
              <p className={s.confirmTitle}>
                {pending.from === undefined ? "Give" : "Move"} {pendingProject.name} {pending.from === undefined ? "a date:" : "to"} {fmtLong(pending.to)}?
              </p>
              <p className={s.confirmSub}>
                {pending.from !== undefined
                  ? `${Math.abs(pending.to - pending.from)} days ${pending.to > pending.from ? "later" : "earlier"} than ${fmtShort(pending.from)}.`
                  : "It leaves the No date tray and joins the map."}{" "}
                Milestones shift with it.
              </p>
              <ul className={s.consList}>
                {cons.map((c) => (
                  <li key={c.text} data-tone={c.tone}>
                    <Icon name={c.tone === "bad" ? "alert" : "check"} size={14} />
                    {c.text}
                  </li>
                ))}
              </ul>
              <div className={s.confirmActions}>
                <button type="button" className={s.btn} onClick={() => setPending(null)}>
                  Put it back
                </button>
                <button type="button" className={s.btnPrimary} onClick={confirmMove} autoFocus>
                  {pending.from === undefined ? "Set date" : "Move it"}
                </button>
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>

        {/* create card */}
        <AnimatePresence>
          {create ? (
            <CreateCard
              key={`${create.day}-${create.lane}`}
              create={create}
              lens={lens}
              size={size}
              onCancel={() => setCreate(null)}
              onCreate={createProject}
              onShift={(d) => setCreate({ ...create, day: Math.max(0, create.day + d), x: cx(cam, Math.max(0, create.day + d)) })}
            />
          ) : null}
        </AnimatePresence>
      </div>

      {/* floating panel: the title, one reading, three spotlights; the key waits behind a disclosure */}
      <motion.div
        ref={panelRef}
        className={s.panel}
        data-compact={hub || lens === "people" ? "" : undefined}
        layout={!reduce}
        transition={{ duration: 0.28, ease: [0.2, 0.8, 0.2, 1] }}
      >
        <div className={s.panelHead}>
          <AnimatePresence initial={false} mode="wait">
            {hub && hubProject ? (
              <motion.nav
                key="crumb"
                className={s.crumb}
                aria-label="Breadcrumb"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.12 }}
              >
                <button type="button" className={s.crumbBack} onClick={closeHub}>
                  <Icon name="arrow-left" size={14} />
                  Map
                </button>
                <span className={s.crumbSep} aria-hidden="true">
                  /
                </span>
                <span className={s.crumbHere} aria-current="page">
                  {hubProject.name}
                </span>
              </motion.nav>
            ) : (
              <motion.h1 key="title" className={s.h1} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.12 }}>
                Projects
              </motion.h1>
            )}
          </AnimatePresence>
          {hub ? <h1 className={s.srOnly}>Projects</h1> : null}
          <div className={s.panelTools}>
            <div className={s.segmented} role="group" aria-label="View">
              <button type="button" aria-pressed="true" className={s.segBtn} aria-label="Map" title="Map">
                <Icon name="map" size={15} />
              </button>
              <button type="button" aria-pressed="false" className={s.segBtn} onClick={onList} aria-label="View as list" title="View as list (L)">
                <Icon name="list" size={15} />
              </button>
            </div>
            <div className={s.menuWrap}>
              <button type="button" className={s.iconBtnFloat} aria-label="More" aria-expanded={menuOpen} onClick={() => setMenuOpen((v) => !v)}>
                <Icon name="more" />
              </button>
            </div>
          </div>
        </div>
        {!hub && lens !== "people" ? (
          <div className={s.panelBody}>
            {isEmpty ? (
              <p className={s.reading}>Nothing on the map yet. Double-click any date to add your first project.</p>
            ) : (
              <p className={s.reading}>
                {read.count}
                {read.week && size.w >= NARROW_W ? <span className={s.readingSub}>{read.week}</span> : null}
              </p>
            )}
            {!isEmpty ? (
              <div className={s.chips} role="group" aria-label="Spotlight">
                {baseCrunch.length ? (
                  <button
                    type="button"
                    className={s.chip}
                    data-tone="crunch"
                    aria-pressed={spot === "crunch"}
                    onClick={() => setSpot(spot === "crunch" ? null : "crunch")}
                    onPointerEnter={() => setCrunchHot(baseCrunch[0].start)}
                    onPointerLeave={() => setCrunchHot(null)}
                  >
                    <Icon name="alert" size={13} />
                    {baseCrunch.length} crunch
                  </button>
                ) : null}
                {helpCount ? (
                  <button type="button" className={s.chip} data-tone="help" aria-pressed={spot === "help"} onClick={() => setSpot(spot === "help" ? null : "help")}>
                    <HealthDot health="help" />
                    {helpCount} need help
                  </button>
                ) : null}
                {pastCount && !pastChipClear ? (
                  <button type="button" className={s.chip} data-tone="past" aria-pressed={spot === "past"} onClick={() => setSpot(spot === "past" ? null : "past")}>
                    <span className={s.pastDot} aria-hidden="true" />
                    {pastCount} not wrapped
                  </button>
                ) : null}
              </div>
            ) : null}
            <button type="button" className={s.keyToggle} aria-expanded={keyOpen} aria-controls="c4-key" onClick={() => setKeyOpen((v) => !v)}>
              <Icon name="help" size={14} />
              How to read the map
              <Icon name="chevron-down" size={14} className={s.keyChevron} />
            </button>
            <AnimatePresence initial={false}>
              {keyOpen ? (
                <motion.div
                  id="c4-key"
                  key="key"
                  className={s.keyWrap}
                  initial={reduce ? { opacity: 0 } : { height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={reduce ? { opacity: 0 } : { height: 0, opacity: 0 }}
                  transition={{ duration: 0.22, ease: [0.2, 0.8, 0.2, 1] }}
                >
                  <Legend lens={lens} />
                </motion.div>
              ) : null}
            </AnimatePresence>
          </div>
        ) : null}
      </motion.div>

      {/* overflow menu: a popover beside the panel, never inside it */}
      <AnimatePresence>
        {menuOpen ? (
          <motion.div
            className={s.menu}
            role="menu"
            aria-label="More"
            style={{ left: (chrome.panel ? chrome.panel.x2 - 10 : 308) + 8, top: 60 }}
            initial={{ opacity: 0, x: -4 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -4, transition: { duration: 0.1 } }}
            transition={{ duration: 0.16 }}
          >
            <button
              type="button"
              role="menuitemcheckbox"
              aria-checked={isEmptyPreview}
              className={s.menuItem}
              onClick={() => {
                setEmptyPreview(!isEmptyPreview);
                setMenuOpen(false);
              }}
            >
              {isEmptyPreview ? "Show the sample projects" : "Preview an empty map"}
            </button>
            <div className={s.menuKeys}>
              <span>
                <kbd>+</kbd> <kbd>−</kbd> zoom
              </span>
              <span>
                <kbd>0</kbd> fit · <kbd>T</kbd> today
              </span>
              <span>
                <kbd>1</kbd> <kbd>2</kbd> <kbd>3</kbd> lenses
              </span>
              <span>
                <kbd>N</kbd> new · <kbd>L</kbd> list
              </span>
              <span>
                <kbd>⇧</kbd> <kbd>←</kbd> <kbd>→</kbd> try a new date
              </span>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      {/* no date: its own corner, bottom left, opening upward */}
      {!hub ? (
        <div className={s.noDateDock}>
            {undated.length ? (
              <div className={s.noDateWrap}>
                <button type="button" className={s.dockBtn} aria-expanded={noDateOpen} aria-controls="c4-nodate" onClick={() => setNoDateOpen((v) => !v)} title="Projects without a date">
                  <Icon name="calendar" size={14} />
                  <span className={s.toolLabel}>No date</span>
                  <span className={s.count}>{undated.length}</span>
                </button>
                <AnimatePresence>
                  {noDateOpen ? (
                    <motion.section
                      id="c4-nodate"
                      className={s.noDatePop}
                      data-away={drag?.tray && drag.moved ? "" : undefined}
                      aria-labelledby="c4-nodate-title"
                      initial={reduce ? { opacity: 0 } : { opacity: 0, y: 6, scale: 0.98 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: reduce ? 0 : 4, transition: { duration: 0.12 } }}
                      transition={{ duration: 0.18, ease: [0.2, 0.8, 0.2, 1] }}
                    >
                      <h2 id="c4-nodate-title" className={s.trayTitle}>
                        No date <span className={s.count}>{undated.length}</span>
                      </h2>
                      <ul className={s.trayList}>
                        {undated.map((p) => (
                          <li key={p.id}>
                            <button
                              type="button"
                              className={s.trayChip}
                              data-dragging={drag?.tray && drag.id === p.id ? "" : undefined}
                              onPointerDown={(e) => onTrayPointerDown(e, p)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter" || e.key === " ") {
                                  e.preventDefault();
                                  setNoDateOpen(false);
                                  setPending({ id: p.id, from: undefined, to: 28 });
                                }
                              }}
                              aria-label={`${p.name}, no date yet, ${p.open} open. Drag onto the map, or press Enter to try ${fmtPlain28()}`}
                            >
                              <Icon name="drag" size={13} className={s.trayGrip} />
                              <IdTile p={p} size={22} />
                              <span className={s.trayName}>{p.name}</span>
                              <span className={s.trayMeta}>{p.open} open</span>
                            </button>
                          </li>
                        ))}
                      </ul>
                      <p className={s.trayHint}>Drag one onto a date to plan it.</p>
                    </motion.section>
                  ) : null}
                </AnimatePresence>
              </div>
            ) : null}
        </div>
      ) : null}

      {/* toolbar: bottom right, clear of anything the app shows at bottom centre */}
      <div className={s.toolbar} role="toolbar" aria-label={hub ? "Project controls" : "Map controls"} data-hub={hub ? "" : undefined}>
        {hub && hubProject ? (
          <>
            <button type="button" className={s.toolBtn} data-wide="" onClick={closeHub} title="Back to the map (Esc)">
              <Icon name="arrow-left" size={14} />
              <span className={s.toolLabel}>Back to map</span>
            </button>
            <span className={s.toolSep} aria-hidden="true" />
            <button type="button" className={s.toolBtn} onClick={() => hubPrev && openHub(hubPrev.id)} disabled={!hubPrev} aria-label={hubPrev ? `Previous by date: ${hubPrev.name}` : "No earlier project"} title={hubPrev ? `Previous: ${hubPrev.name}` : undefined}>
              <Icon name="chevron-left" />
            </button>
            <span className={s.toolStep} aria-live="polite">
              {hubIdx + 1} of {timeOrder.length}
            </span>
            <button type="button" className={s.toolBtn} onClick={() => hubNext && openHub(hubNext.id)} disabled={!hubNext} aria-label={hubNext ? `Next by date: ${hubNext.name}` : "No later project"} title={hubNext ? `Next: ${hubNext.name}` : undefined}>
              <Icon name="chevron-right" />
            </button>
            <span className={s.toolSep} aria-hidden="true" />
            <button type="button" className={s.toolBtn} data-wide="" onClick={addMilestone}>
              <Icon name="flag" size={14} />
              <span className={s.toolLabel}>Add milestone</span>
            </button>
            <button type="button" className={s.toolPrimary} aria-label={`Open ${hubProject.name}`}>
              <span className={s.toolLabel}>Open project</span>
              <Icon name="arrow-right" size={14} />
            </button>
          </>
        ) : (
          <>
            <div className={s.toolGroup}>
              <button type="button" className={s.toolBtn} onClick={() => zoomButtons(-1)} aria-label="Zoom out">
                <Icon name="minus" />
              </button>
              <button type="button" className={s.toolBtn} data-wide="" onClick={fit} aria-label="Fit all projects">
                <Icon name="fit" size={14} />
                <span className={s.toolLabel}>Fit</span>
              </button>
              <button type="button" className={s.toolBtn} onClick={() => zoomButtons(1)} aria-label="Zoom in">
                <Icon name="plus" />
              </button>
            </div>
            <span className={s.toolSep} aria-hidden="true" />
            <div className={s.lensGroup} role="radiogroup" aria-label="Lens">
              {(
                [
                  ["health", "Health", "health"],
                  ["people", "People", "people"],
                  ["kind", "Kind", "kind"],
                ] as const
              ).map(([id, label, icon]) => (
                <button key={id} type="button" role="radio" aria-checked={lens === id} className={s.lensBtn} onClick={() => setLens(id)} aria-label={label} title={label + " lens"}>
                  {lens === id ? <motion.span layoutId="c4-lens" className={s.lensThumb} transition={{ duration: reduce ? 0 : 0.24, ease: [0.2, 0.8, 0.2, 1] }} /> : null}
                  <span className={s.lensInner}>
                    <Icon name={icon} size={14} />
                    <span className={s.lensLabel}>{label}</span>
                  </span>
                </button>
              ))}
            </div>
            <span className={s.toolSep} aria-hidden="true" />
            <button type="button" className={s.toolBtn} data-wide="" onClick={goToday} aria-label="Today" title="Today (T)">
              <Icon name="today" size={14} />
              <span className={s.toolLabel}>Today</span>
            </button>
            <button type="button" className={s.toolPrimary} onClick={() => startCreateAt(14)} aria-label="New project" title="New project (N)">
              <Icon name="plus" size={14} />
              <span className={s.toolLabel}>New project</span>
            </button>
          </>
        )}
      </div>

      {/* toast */}
      <AnimatePresence>
        {toast ? (
          <motion.div
            key={toast.key}
            className={s.toast}
            role="status"
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: reduce ? 0 : 10 }}
            transition={{ duration: 0.2 }}
          >
            <span>{toast.text}</span>
            {toast.undo ? (
              <button
                type="button"
                className={s.toastUndo}
                onClick={() => {
                  toast.undo?.();
                  setToast(null);
                }}
              >
                <Icon name="undo" size={13} />
                Undo
              </button>
            ) : null}
          </motion.div>
        ) : null}
      </AnimatePresence>

      {/* screen reader mirror */}
      <section className={s.srOnly} aria-label="Projects in date order">
        <ul>
          {dated(projects).map((p) => (
            <li key={p.id}>{fullLabel(p)}</li>
          ))}
          {undated.map((p) => (
            <li key={p.id}>{fullLabel(p)}</li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function fmtPlain28() {
  return fmtShort(28);
}

/** Lead owner at a readable size, with a count for the rest of the team. */
function LeadAvatar({ p }: { p: Project }) {
  const rest = p.team.filter((id) => id !== p.owner).length;
  return (
    <span className={s.lead} title={p.team.map((id) => PEOPLE[id].name).join(", ")}>
      <Avatar id={p.owner} size={18} />
      {rest ? <span className={s.leadMore}>+{rest}</span> : null}
    </span>
  );
}

function crunchTagW(c: Crunch) {
  return textW("Crunch", 12) + c.people.length * 17 + 4 + textW(`each finish ${c.count} projects`, 12) + 56;
}

function Legend({ lens }: { lens: Lens }) {
  return (
    <div className={s.legend}>
      <p className={s.keyColour}>
        {lens === "people" ? (
          <>
            <strong>Colour: who owns it.</strong>
            <span className={s.keyPeople}>
              {PEOPLE_ORDER.map((id) => (
                <span key={id} className={s.legendItem}>
                  <Avatar id={id} size={16} />
                  {PEOPLE[id].first}
                </span>
              ))}
            </span>
            <span>The dot beside a name is how it is going.</span>
          </>
        ) : (
          <>
            <strong>Colour: how it is going.</strong>
            <span className={s.keyPeople}>
              {(["good", "watch", "help"] as Health[]).map((h) => (
                <span key={h} className={s.legendItem}>
                  <HealthDot health={h} />
                  {HEALTH_LABEL[h]}
                </span>
              ))}
            </span>
          </>
        )}
      </p>
      <ul className={s.key} aria-label="Shapes on the map">
        <li>
          <svg width="18" height="14" viewBox="0 0 18 14" aria-hidden="true">
            <circle cx="4" cy="9" r="3.2" className={s.keyStroke} />
            <circle cx="12.5" cy="7" r="5.2" className={s.keyStroke} />
          </svg>
          Size: open work
        </li>
        <li>
          <svg width="18" height="14" viewBox="0 0 18 14" aria-hidden="true">
            <circle cx="9" cy="7" r="5.6" className={s.keyStroke} />
            <path d="M9 7 L9 2.4 A4.6 4.6 0 0 1 13.4 8.3 Z" className={s.keyFill} />
          </svg>
          Wedge: progress
        </li>
        <li>
          <span className={s.keyBadge} aria-hidden="true">
            2
          </span>
          Overdue tasks
        </li>
        <li>
          <svg width="18" height="14" viewBox="0 0 18 14" aria-hidden="true">
            <path d="M1 11 Q9 1 17 11" className={s.keyDash} />
          </svg>
          Linked projects
        </li>
      </ul>
      <p className={s.keyNote}>
        <span className={s.keyGlow} aria-hidden="true" />
        <span>Crunch: one person finishing 3 or more projects in the same fortnight.</span>
      </p>
      <p className={s.keyNote}>
        <span className={s.keyPast} aria-hidden="true" />
        <span>Hatched margin: past its date and not wrapped up.</span>
      </p>
    </div>
  );
}

function HoverCard({
  p,
  x,
  y,
  size,
  projects,
  avoid,
  crunch,
}: {
  p: Project;
  x: number;
  y: number;
  size: { w: number; h: number };
  projects: Project[];
  avoid?: { l: number; r: number };
  crunch: Crunch[];
}) {
  const reduce = useReducedMotion();
  const w = 300;
  // Inside an open cluster the card sits beside the fan, never on top of it.
  const flip = avoid ? avoid.r + 12 + w > size.w - 12 : x + 40 + w > size.w - 12;
  const left = avoid ? (flip ? avoid.l - w - 12 : avoid.r + 12) : flip ? x - w - 28 : x + 28;
  const estH = 250 + (crunch.some((c) => c.projects.includes(p.id)) ? 54 : 0) + RELATIONS.filter((r) => r.a === p.id || r.b === p.id).length * 22;
  const top = clamp(y - 60, RULER_H + 8, size.h - 84 - estH);
  const rel = RELATIONS.filter((r) => r.a === p.id || r.b === p.id).map((r) => ({
    reason: r.reason,
    other: projects.find((x) => x.id === (r.a === p.id ? r.b : r.a)),
  }));
  const nm = nextMilestone(p);
  const inCrunch = crunch.find((c) => c.projects.includes(p.id));
  return (
    <motion.div
      className={s.hover}
      style={{ left, top, width: w }}
      initial={reduce ? { opacity: 0 } : { opacity: 0, x: flip ? 6 : -6 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, transition: { duration: 0.08 } }}
      transition={{ duration: 0.16, ease: [0.2, 0.8, 0.2, 1] }}
      aria-hidden="true"
    >
      <div className={s.hoverHead}>
        <IdTile p={p} size={28} />
        <div className={s.hoverTitleBlock}>
          <span className={s.hoverTitle}>{p.name}</span>
          <span className={s.hoverSub}>
            {KIND_LABEL[p.kind]} · {p.endDay !== undefined ? `${fmtShort(p.day ?? 0)} to ${fmtShort(p.endDay)}` : fmtShort(p.day ?? 0)}
          </span>
        </div>
      </div>
      <div className={s.hoverRow}>
        <StatusPill p={p} />
        <span className={s.hoverMeta}>
          {p.progress}% done · {p.open} open
          {p.overdue ? <span className={s.overdueText}> · {p.overdue} overdue</span> : null}
        </span>
      </div>
      <div className={s.hoverBar} aria-hidden="true">
        <span style={{ width: `${p.progress}%`, background: HEALTH_COLOR[p.health] }} />
      </div>
      <p className={s.hoverSignal}>{p.unwrapped ? `${p.unwrapped}. Wrap it up to clear it from the margin.` : p.signal}</p>
      {nm ? (
        <p className={s.hoverNext}>
          <span>Next</span> {nm.label} · {fmtShort(nm.day)}
        </p>
      ) : null}
      {inCrunch ? (
        <p className={s.hoverCrunch}>
          <Icon name="alert" size={13} />
          {crunchSentence(inCrunch)}
        </p>
      ) : null}
      {rel.length ? (
        <ul className={s.hoverRel}>
          {rel.map((r) => (
            <li key={r.reason}>
              <Icon name="link" size={13} />
              {r.reason}
            </li>
          ))}
        </ul>
      ) : null}
      <div className={s.hoverFoot}>
        <span className={s.hoverPeople}>
          {p.team.map((id) => (
            <Avatar key={id} id={id} size={20} />
          ))}
        </span>
        <span className={s.hoverHint}>{p.unwrapped ? "Click to wrap up" : "Click to open · drag to try a date"}</span>
      </div>
    </motion.div>
  );
}

function LoadStrips({ projects, cam, width, todayX }: { projects: Project[]; cam: Camera; width: number; todayX: number }) {
  // The track starts at the panel's inner edge plus the name column, so each
  // cell's edges land exactly on the week lines of the map above.
  const nameW = 112;
  const trackLeft = 16 + 1 + nameW;
  const ws = weeks();
  return (
    <div className={s.loadInner}>
      <div className={s.loadHead}>
        <span className={s.loadTitle}>Who is stretched when</span>
        <span className={s.loadKey}>
          <span className={s.loadKeyCell} aria-hidden="true" /> Booked
          <span className={s.loadKeyCell} data-over="" aria-hidden="true" /> Stretched, over a full week
        </span>
      </div>
      {PEOPLE_ORDER.map((id) => {
        const person = PEOPLE[id];
        return (
          <div key={id} className={s.loadRow}>
            <span className={s.loadName} style={{ width: nameW }}>
              <Avatar id={id} size={20} />
              {person.first}
            </span>
            <div className={s.loadTrack}>
              <span className={s.loadToday} style={{ left: todayX - trackLeft }} aria-hidden="true" />
              {ws.map((w) => {
                const x1 = sx(cam, w) - trackLeft;
                const x2 = sx(cam, w + 7) - trackLeft;
                if (x2 < 0 || x1 > width - nameW) return null;
                const l = load(projects, id, w);
                if (l.share <= 0.01) return null;
                const pct = Math.round(l.share * 100);
                const over = pct >= 100;
                const cellW = x2 - x1 - 2;
                return (
                  <span
                    key={w}
                    className={s.loadCell}
                    data-over={over ? "" : undefined}
                    style={{ left: x1 + 1, width: cellW, "--c": person.color, "--a": `${Math.min(70, 14 + pct * 0.5)}%` } as CSSProperties}
                    title={`${person.first}, week of ${fmtDayMonth(w)}: ${pct}% booked${l.on.length ? ` (${l.on.join(", ")})` : ""}`}
                  >
                    {over && cellW > 34 ? <span className={s.loadPct}>{pct}%</span> : null}
                  </span>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function CreateCard({
  create,
  lens,
  size,
  onCancel,
  onCreate,
  onShift,
}: {
  create: Create;
  lens: Lens;
  size: { w: number; h: number };
  onCancel: () => void;
  onCreate: (name: string, kind: Kind, day: number, lane: string) => void;
  onShift: (d: number) => void;
}) {
  const reduce = useReducedMotion();
  const [name, setName] = useState("");
  const [kind, setKind] = useState<Kind>(lens === "kind" ? (create.lane as Kind) : "event");
  const w = 320;
  const left = clamp(create.x - 20, LEFT_FREE, size.w - w - 16);
  const top = clamp(create.y - 24, RULER_H + 12, size.h - 300);
  const laneName = lens === "kind" ? KIND_LANES.find((k) => k.id === create.lane)?.label : HEALTH_LABEL[create.lane as Health];
  const submit = () => {
    const n = name.trim();
    if (!n) return;
    onCreate(n, kind, create.day, create.lane);
  };
  return (
    <>
      <span className={s.createPin} style={{ left: sx({ x0: 0, scale: 1 }, create.x), top: create.y }} aria-hidden="true" />
      <motion.form
        className={s.create}
        style={{ left, top, width: w }}
        initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.92, y: 6 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: reduce ? 1 : 0.96, transition: { duration: 0.12 } }}
        transition={{ duration: 0.2, ease: [0.2, 0.8, 0.2, 1] }}
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        aria-label="New project"
      >
        <label className={s.createLabel} htmlFor="c4-new-name">
          New project
        </label>
        <input
          id="c4-new-name"
          className={s.createInput}
          placeholder="Name it"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoFocus
          autoComplete="off"
        />
        <div className={s.createKinds} role="radiogroup" aria-label="Kind">
          {KIND_LANES.map((k) => (
            <button key={k.id} type="button" role="radio" aria-checked={kind === k.id} className={s.kindChip} onClick={() => setKind(k.id)}>
              {KIND_LABEL[k.id]}
            </button>
          ))}
        </div>
        <div className={s.createDate}>
          <Icon name="calendar" size={14} />
          <span className={s.createDateText}>
            {fmtLong(create.day)}
            <span className={s.createDateSub}>
              {fmtUntil(create.day)} from today{lens === "kind" && laneName ? ` · ${laneName}` : " · starts in Going well"}
            </span>
          </span>
          <button type="button" className={s.iconBtnSm} aria-label="One day earlier" onClick={() => onShift(-1)}>
            <Icon name="chevron-left" size={14} />
          </button>
          <button type="button" className={s.iconBtnSm} aria-label="One day later" onClick={() => onShift(1)}>
            <Icon name="chevron-right" size={14} />
          </button>
        </div>
        <div className={s.confirmActions}>
          <button type="button" className={s.btn} onClick={onCancel}>
            Cancel
          </button>
          <button type="submit" className={s.btnPrimary} disabled={!name.trim()}>
            Add to map
          </button>
        </div>
      </motion.form>
    </>
  );
}
