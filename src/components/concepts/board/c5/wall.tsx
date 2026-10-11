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
  type ReactNode,
} from "react";
import { NOTE, STAGES, STAGE_INDEX, type Note, type Person, type StageKey, type Tone, type Wall } from "./data";
import {
  clamp,
  connectorPath,
  dueInfo,
  readingOrder,
  tidyLayout,
  union,
  wallBounds,
  type Mode,
  type Rect,
} from "./geometry";
import { Icon } from "./icons";
import { Face, StickyNote, toneVar } from "./note";
import { clusterTarget, TONE_NAMES } from "./ops";
import s from "./wall.module.css";

export type Tool = "select" | "hand" | "note" | "label" | "arrow";
type View = { x: number; y: number; s: number };

export type ZoomApi = {
  scale: number;
  zoomIn: () => void;
  zoomOut: () => void;
  zoomReset: () => void;
  fit: () => void;
};

type Gesture =
  | { kind: "pan"; cx: number; cy: number; vx: number; vy: number }
  | { kind: "notes"; ids: string[]; primary: string; wx: number; wy: number; cx: number; cy: number; moved: boolean; shift: boolean }
  | { kind: "scribble"; id: string; wx: number; wy: number; cx: number; cy: number; moved: boolean }
  | { kind: "resize"; stage: StageKey; wx: number; wy: number; w: number; h: number }
  | { kind: "marquee"; wx: number; wy: number; shift: boolean; base: string[] }
  | { kind: "pinch" };

type Cursor = { id: string; noteId: string | null; fx: number; fy: number; wx: number; wy: number };

export type CanvasProps = {
  wall: Wall;
  mode: Mode;
  morphing: boolean;
  tool: Tool;
  setTool: (t: Tool) => void;
  selected: string[];
  setSelected: (ids: string[]) => void;
  matches: (n: Note) => boolean;
  filtering: boolean;
  stamped: string[];
  peeled: string | null;
  freshCluster: string | null;
  editingId: string | null;
  setEditingId: (id: string | null) => void;
  editingScribble: string | null;
  setEditingScribble: (id: string | null) => void;
  readOnly?: boolean;
  initialScale?: number;
  minScale?: number;
  maxScale?: number;
  showMiniMap?: boolean;
  onDropNotes?: (ids: string[], dx: number, dy: number) => void;
  onTidyDrop?: (id: string, stage: StageKey) => void;
  onCreateNote?: (x: number, y: number) => void;
  onCreateScribble?: (x: number, y: number) => void;
  onMoveScribble?: (id: string, dx: number, dy: number) => void;
  onEditScribble?: (id: string, text: string) => void;
  onConnect?: (from: string, to: string) => void;
  onRemoveConnector?: (id: string) => void;
  onResizeZone?: (stage: StageKey, w: number, h: number) => void;
  onNudge?: (ids: string[], dx: number, dy: number) => void;
  onDelete?: (ids: string[]) => void;
  onOpen: (id: string) => void;
  onCommitTitle?: (id: string, title: string) => void;
  onCancelEdit?: (id: string) => void;
  onRenameCluster?: (id: string, name: string) => void;
  onTone?: (ids: string[], tone: Tone) => void;
  onPeelStarter?: () => void;
  onAddToStage?: (stage: StageKey) => void;
  openId?: string | null;
  renderChrome?: (zoom: ZoomApi) => ReactNode;
};

const isField = (el: EventTarget | null) =>
  el instanceof HTMLElement && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable);

export function WallCanvas(p: CanvasProps) {
  const { wall, mode, readOnly } = p;
  const minS = p.minScale ?? 0.5;
  const maxS = p.maxScale ?? 1.5;
  const vpRef = useRef<HTMLDivElement>(null);
  const [view, setView] = useState<View>(() => {
    const sc = p.initialScale ?? 0.8;
    return { x: 20 - 40 * sc, y: 18 - 40 * sc, s: sc };
  });
  const [size, setSize] = useState({ w: 1200, h: 800 });
  const [space, setSpace] = useState(false);
  const [gesture, setGesture] = useState<Gesture | null>(null);
  const [delta, setDelta] = useState({ dx: 0, dy: 0 });
  const [marquee, setMarquee] = useState<Rect | null>(null);
  const [pointer, setPointer] = useState<{ x: number; y: number } | null>(null);
  const [connectFrom, setConnectFrom] = useState<string | null>(null);
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [cursors, setCursors] = useState<Cursor[]>(() => initialCursors(wall));
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinchRef = useRef<{ d: number; mx: number; my: number } | null>(null);
  const notesRef = useRef(wall.notes);

  useEffect(() => {
    notesRef.current = wall.notes;
  }, [wall.notes]);

  /* Viewport size */
  useEffect(() => {
    const el = vpRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setSize({ w: entry.contentRect.width, h: entry.contentRect.height }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  /* Wheel: pan, and pinch or ctrl-wheel to zoom around the pointer */
  useEffect(() => {
    const el = vpRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (isField(e.target) && !(e.ctrlKey || e.metaKey)) return;
      e.preventDefault();
      const r = el.getBoundingClientRect();
      const cx = e.clientX - r.left;
      const cy = e.clientY - r.top;
      if (e.ctrlKey || e.metaKey) {
        const f = Math.exp(-e.deltaY * 0.01);
        setView((v) => zoomed(v, v.s * f, cx, cy, minS, maxS));
      } else {
        const dx = e.shiftKey && !e.deltaX ? e.deltaY : e.deltaX;
        const dy = e.shiftKey && !e.deltaX ? 0 : e.deltaY;
        setView((v) => ({ ...v, x: v.x - dx, y: v.y - dy }));
      }
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [minS, maxS]);

  /* Space to pan */
  useEffect(() => {
    if (readOnly) return;
    const down = (e: KeyboardEvent) => {
      if (e.code !== "Space" || isField(e.target) || (e.target as HTMLElement)?.closest?.("[data-note],button")) return;
      e.preventDefault();
      setSpace(true);
    };
    const up = (e: KeyboardEvent) => {
      if (e.code === "Space") setSpace(false);
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, [readOnly]);

  /* Presence: two teammates drifting between notes */
  useEffect(() => {
    if (readOnly || wall.presence.length === 0) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timers = wall.presence.map((id, i) =>
      window.setInterval(
        () => setCursors((prev) => prev.map((c) => (c.id === id ? wander(c, notesRef.current) : c))),
        2900 + i * 1300,
      ),
    );
    return () => timers.forEach((t) => window.clearInterval(t));
  }, [readOnly, wall.presence]);

  /* Zoom shortcuts */
  const zoomBy = useCallback(
    (f: number) => setView((v) => zoomed(v, v.s * f, size.w / 2, size.h / 2, minS, maxS)),
    [size, minS, maxS],
  );

  const tidy = useMemo(() => tidyLayout(wall), [wall]);
  const bounds = useMemo(() => {
    if (mode === "wall") return wallBounds(wall);
    const r = union(Object.values(tidy.zones), 40);
    return { x: 0, y: 0, w: r.x + r.w, h: r.y + r.h };
  }, [mode, wall, tidy]);

  const fit = useCallback(() => {
    const sc = clamp(Math.min(size.w / bounds.w, (size.h - 80) / bounds.h), minS, maxS);
    setView({ s: sc, x: (size.w - bounds.w * sc) / 2, y: Math.max(12, (size.h - 80 - bounds.h * sc) / 2) });
  }, [size, bounds, minS, maxS]);

  useEffect(() => {
    if (readOnly) return;
    const onKey = (e: KeyboardEvent) => {
      if (isField(e.target) || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "=" || e.key === "+") zoomBy(1.2);
      else if (e.key === "-") zoomBy(1 / 1.2);
      else if (e.key === "0") setView((v) => zoomed(v, 1, size.w / 2, size.h / 2, minS, maxS));
      else if (e.key === "1" && e.shiftKey) fit();
      else if (e.key === "!") fit();
      else if (e.key === "Escape") setConnectFrom(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [readOnly, zoomBy, fit, size, minS, maxS]);

  /* ── Geometry of what is on screen ───────────────────────────────── */

  const dragIds = gesture?.kind === "notes" && gesture.moved ? gesture.ids : [];
  const dragSet = new Set(dragIds);
  const people = useMemo(() => new Map(wall.people.map((pp) => [pp.id, pp])), [wall.people]);

  const baseRect = useCallback(
    (n: Note): Rect => (mode === "wall" ? { x: n.x, y: n.y, w: NOTE, h: NOTE } : tidy.notes[n.id] ?? { x: n.x, y: n.y, w: NOTE, h: NOTE }),
    [mode, tidy],
  );
  const rectOf = (n: Note): Rect => {
    const r = baseRect(n);
    return dragSet.has(n.id) ? { ...r, x: r.x + delta.dx, y: r.y + delta.dy } : r;
  };

  const ordered = useMemo(() => {
    if (mode === "wall") return readingOrder(wall.notes);
    return [...wall.notes].sort((a, b) => {
      const ra = tidy.notes[a.id];
      const rb = tidy.notes[b.id];
      return ra.x - rb.x || ra.y - rb.y;
    });
  }, [mode, wall.notes, tidy]);
  const orderIndex = new Map(ordered.map((n, i) => [n.id, i]));

  const zoneRect = (stage: StageKey): Rect => {
    if (mode === "tidy") return tidy.zones[stage];
    const z = wall.zones.find((zz) => zz.stage === stage)!;
    if (gesture?.kind === "resize" && gesture.stage === stage) {
      return { x: z.x, y: z.y, w: Math.max(260, gesture.w + delta.dx), h: Math.max(320, gesture.h + delta.dy) };
    }
    return z;
  };

  /* Drop preview */
  let hotStage: StageKey | null = null;
  let preview: { kind: "join"; clusterId: string } | { kind: "new"; rect: Rect } | null = null;
  if (gesture?.kind === "notes" && gesture.moved) {
    const primary = wall.notes.find((n) => n.id === gesture.primary);
    if (primary) {
      const r = rectOf(primary);
      if (mode === "tidy") {
        const cx = r.x + r.w / 2;
        hotStage = STAGES.find((st) => cx >= tidy.zones[st.key].x - 12 && cx <= tidy.zones[st.key].x + COLW + 12)?.key ?? null;
      } else {
        const cx = r.x + NOTE / 2;
        const cy = r.y + NOTE / 2;
        hotStage = wall.zones.find((z) => cx >= z.x && cx <= z.x + z.w && cy >= z.y && cy <= z.y + z.h)?.stage ?? null;
        if (gesture.ids.length === 1) {
          const t = clusterTarget(wall, primary.id, r.x, r.y);
          if (t?.kind === "join") preview = t;
          else if (t?.kind === "new") {
            const other = wall.notes.find((n) => n.id === t.withId)!;
            preview = { kind: "new", rect: union([r, baseRect(other)], 14) };
          }
        }
      }
    }
  }

  const clusterRects = useMemo(() => {
    if (mode === "tidy") return [];
    return wall.clusters
      .map((c) => {
        const members = wall.notes.filter((n) => n.clusterId === c.id);
        if (members.length < 2) return null;
        const rects = members.map((n) => (dragSet.has(n.id) ? { x: n.x + delta.dx, y: n.y + delta.dy, w: NOTE, h: NOTE } : { x: n.x, y: n.y, w: NOTE, h: NOTE }));
        return { cluster: c, rect: union(rects, 14), count: members.length };
      })
      .filter(Boolean) as { cluster: Wall["clusters"][number]; rect: Rect; count: number }[];
    // dragSet is derived from gesture; delta covers the live offset.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, wall.clusters, wall.notes, delta, gesture]);

  /* ── Coordinates ─────────────────────────────────────────────────── */

  const toWall = (clientX: number, clientY: number) => {
    const r = vpRef.current!.getBoundingClientRect();
    return { x: (clientX - r.left - view.x) / view.s, y: (clientY - r.top - view.y) / view.s };
  };

  const ensureVisible = (r: Rect) => {
    const sx = r.x * view.s + view.x;
    const sy = r.y * view.s + view.y;
    const sw = r.w * view.s;
    const sh = r.h * view.s;
    const m = 48;
    let nx = view.x;
    let ny = view.y;
    if (sx < m) nx += m - sx;
    else if (sx + sw > size.w - m) nx -= sx + sw - (size.w - m);
    if (sy < m) ny += m - sy;
    else if (sy + sh > size.h - 96) ny -= sy + sh - (size.h - 96);
    if (nx !== view.x || ny !== view.y) setView({ ...view, x: nx, y: ny });
  };

  /* Opening details slides a panel over the right edge: keep the note in sight. */
  const openNote = (id: string) => {
    p.onOpen(id);
    if (readOnly) return;
    const n = wall.notes.find((nn) => nn.id === id);
    if (!n) return;
    const r = rectOf(n);
    const right = (r.x + r.w) * view.s + view.x;
    const limit = size.w - 420;
    if (right > limit) setView({ ...view, x: view.x - (right - limit) });
  };

  /* ── Pointer handling ────────────────────────────────────────────── */

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    const el = vpRef.current!;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      pinchRef.current = { d: Math.hypot(a.x - b.x, a.y - b.y), mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2 };
      setGesture({ kind: "pinch" });
      setDelta({ dx: 0, dy: 0 });
      return;
    }
    if (e.button === 2) return;
    const target = e.target as HTMLElement;
    if (target.closest("[data-chrome]") || isField(target)) return;
    const w = toWall(e.clientX, e.clientY);
    const noteEl = target.closest<HTMLElement>("[data-note]");
    const pan = readOnly || space || p.tool === "hand" || e.button === 1;

    el.setPointerCapture(e.pointerId);

    if (pan && !(readOnly && noteEl)) {
      setGesture({ kind: "pan", cx: e.clientX, cy: e.clientY, vx: view.x, vy: view.y });
      return;
    }
    if (readOnly && noteEl) {
      setGesture({ kind: "pan", cx: e.clientX, cy: e.clientY, vx: view.x, vy: view.y });
      return;
    }
    if ((p.tool === "note" || p.tool === "label") && mode === "wall") e.preventDefault();
    if (p.tool === "note" && mode === "wall") {
      p.onCreateNote?.(w.x - NOTE / 2, w.y - NOTE / 2);
      p.setTool("select");
      return;
    }
    if (p.tool === "label" && mode === "wall") {
      p.onCreateScribble?.(w.x - 8, w.y - 12);
      p.setTool("select");
      return;
    }
    if (p.tool === "arrow") {
      if (noteEl) {
        const id = noteEl.dataset.note!;
        if (!connectFrom) setConnectFrom(id);
        else if (connectFrom !== id) {
          p.onConnect?.(connectFrom, id);
          setConnectFrom(null);
          p.setTool("select");
        }
      } else setConnectFrom(null);
      return;
    }
    const resizeEl = target.closest<HTMLElement>("[data-resize]");
    if (resizeEl && mode === "wall") {
      const stage = resizeEl.dataset.resize as StageKey;
      const z = wall.zones.find((zz) => zz.stage === stage)!;
      setGesture({ kind: "resize", stage, wx: w.x, wy: w.y, w: z.w, h: z.h });
      setDelta({ dx: 0, dy: 0 });
      return;
    }
    const scribbleEl = target.closest<HTMLElement>("[data-scribble]");
    if (scribbleEl && mode === "wall") {
      setGesture({ kind: "scribble", id: scribbleEl.dataset.scribble!, wx: w.x, wy: w.y, cx: e.clientX, cy: e.clientY, moved: false });
      setDelta({ dx: 0, dy: 0 });
      return;
    }
    if (noteEl) {
      const id = noteEl.dataset.note!;
      if (p.editingId === id) return;
      const already = p.selected.includes(id);
      let ids: string[];
      if (e.shiftKey) ids = already ? p.selected : [...p.selected, id];
      else ids = already ? p.selected : [id];
      if (mode === "tidy") ids = [id];
      if (!already || e.shiftKey) p.setSelected(ids);
      setGesture({ kind: "notes", ids, primary: id, wx: w.x, wy: w.y, cx: e.clientX, cy: e.clientY, moved: false, shift: e.shiftKey });
      setDelta({ dx: 0, dy: 0 });
      return;
    }
    // Empty canvas: marquee
    setGesture({ kind: "marquee", wx: w.x, wy: w.y, shift: e.shiftKey, base: e.shiftKey ? p.selected : [] });
    if (!e.shiftKey) p.setSelected([]);
    (document.activeElement as HTMLElement | null)?.blur?.();
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (pointers.current.has(e.pointerId)) pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (gesture?.kind === "pinch" && pointers.current.size >= 2 && pinchRef.current) {
      const [a, b] = [...pointers.current.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      const mx = (a.x + b.x) / 2;
      const my = (a.y + b.y) / 2;
      const prev = pinchRef.current;
      const r = vpRef.current!.getBoundingClientRect();
      setView((v) => {
        const z = zoomed(v, v.s * (d / prev.d), mx - r.left, my - r.top, minS, maxS);
        return { ...z, x: z.x + (mx - prev.mx), y: z.y + (my - prev.my) };
      });
      pinchRef.current = { d, mx, my };
      return;
    }
    const w = toWall(e.clientX, e.clientY);
    if (p.tool === "note" || p.tool === "arrow") setPointer(w);
    if (!gesture) return;
    switch (gesture.kind) {
      case "pan":
        setView((v) => ({ ...v, x: gesture.vx + (e.clientX - gesture.cx), y: gesture.vy + (e.clientY - gesture.cy) }));
        break;
      case "notes":
      case "scribble": {
        const moved = gesture.moved || Math.hypot(e.clientX - gesture.cx, e.clientY - gesture.cy) > 3;
        if (moved && !gesture.moved) setGesture({ ...gesture, moved: true });
        if (moved) setDelta({ dx: w.x - gesture.wx, dy: w.y - gesture.wy });
        break;
      }
      case "resize":
        setDelta({ dx: w.x - gesture.wx, dy: w.y - gesture.wy });
        break;
      case "marquee": {
        const r = { x: Math.min(gesture.wx, w.x), y: Math.min(gesture.wy, w.y), w: Math.abs(w.x - gesture.wx), h: Math.abs(w.y - gesture.wy) };
        setMarquee(r);
        const hit = wall.notes
          .filter((n) => {
            const nr = baseRect(n);
            return nr.x < r.x + r.w && nr.x + nr.w > r.x && nr.y < r.y + r.h && nr.y + nr.h > r.y;
          })
          .map((n) => n.id);
        p.setSelected([...new Set([...gesture.base, ...hit])]);
        break;
      }
    }
  };

  const onPointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    pointers.current.delete(e.pointerId);
    if (gesture?.kind === "pinch") {
      if (pointers.current.size < 2) {
        pinchRef.current = null;
        setGesture(null);
      }
      return;
    }
    const g = gesture;
    setGesture(null);
    setMarquee(null);
    setDelta({ dx: 0, dy: 0 });
    if (!g) return;
    if (g.kind === "pan" && readOnly) {
      const noteEl = (e.target as HTMLElement).closest<HTMLElement>("[data-note]");
      if (noteEl && Math.hypot(e.clientX - g.cx, e.clientY - g.cy) < 6) p.onOpen(noteEl.dataset.note!);
      return;
    }
    if (g.kind === "notes") {
      if (!g.moved) {
        if (!g.shift) p.setSelected([g.primary]);
        return;
      }
      if (mode === "tidy") {
        if (hotStage) p.onTidyDrop?.(g.primary, hotStage);
      } else p.onDropNotes?.(g.ids, delta.dx, delta.dy);
    } else if (g.kind === "scribble") {
      if (g.moved) p.onMoveScribble?.(g.id, delta.dx, delta.dy);
    } else if (g.kind === "resize") {
      p.onResizeZone?.(g.stage, Math.max(260, g.w + delta.dx), Math.max(320, g.h + delta.dy));
    }
  };

  const onDoubleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (readOnly || mode !== "wall" || p.tool !== "select") return;
    const target = e.target as HTMLElement;
    if (target.closest("[data-chrome]") || isField(target)) return;
    const noteEl = target.closest<HTMLElement>("[data-note]");
    if (noteEl) {
      p.setEditingId(noteEl.dataset.note!);
      return;
    }
    const scribbleEl = target.closest<HTMLElement>("[data-scribble]");
    if (scribbleEl) {
      p.setEditingScribble(scribbleEl.dataset.scribble!);
      return;
    }
    if (target.closest("[data-cluster-name]")) return;
    const w = toWall(e.clientX, e.clientY);
    p.onCreateNote?.(w.x - NOTE / 2, w.y - NOTE / 2);
  };

  /* ── Note keyboard ───────────────────────────────────────────────── */

  const onNoteKey = (n: Note) => (e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (readOnly) {
      if (e.key === "Enter") p.onOpen(n.id);
      return;
    }
    const ids = p.selected.includes(n.id) ? p.selected : [n.id];
    const step = e.shiftKey ? 40 : 8;
    const arrows: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
    if (arrows[e.key]) {
      e.preventDefault();
      const [ax, ay] = arrows[e.key];
      if (mode === "wall") p.onNudge?.(ids, ax * step, ay * step);
      else if (ax !== 0) {
        const i = STAGE_INDEX[n.stage] + ax;
        if (i >= 0 && i < STAGES.length) p.onTidyDrop?.(n.id, STAGES[i].key);
      }
    } else if (e.key === "Enter") {
      e.preventDefault();
      openNote(n.id);
    } else if (e.key === "F2" || e.key === "e") {
      e.preventDefault();
      p.setEditingId(n.id);
    } else if (e.key === " ") {
      e.preventDefault();
      p.setSelected(p.selected.includes(n.id) ? p.selected.filter((x) => x !== n.id) : [...p.selected, n.id]);
    } else if (e.key === "Delete" || e.key === "Backspace") {
      e.preventDefault();
      p.onDelete?.(ids);
    } else if (e.key === "Escape") {
      p.setSelected([]);
      e.currentTarget.blur();
    }
  };

  /* ── Render ──────────────────────────────────────────────────────── */

  const zoomApi: ZoomApi = {
    scale: view.s,
    zoomIn: () => zoomBy(1.2),
    zoomOut: () => zoomBy(1 / 1.2),
    zoomReset: () => setView((v) => zoomed(v, 1, size.w / 2, size.h / 2, minS, maxS)),
    fit,
  };

  const hovered = hoverId && !gesture && !readOnly && view.s < 0.8 ? wall.notes.find((n) => n.id === hoverId) : undefined;
  const single = p.selected.length === 1 && !gesture && !p.editingId && !p.freshCluster && !p.openId && !readOnly ? wall.notes.find((n) => n.id === p.selected[0]) : undefined;
  const connectNote = connectFrom ? wall.notes.find((n) => n.id === connectFrom) : undefined;
  const cursorClass =
    readOnly || space || p.tool === "hand"
      ? gesture?.kind === "pan"
        ? s.grabbing
        : s.grab
      : p.tool === "note" || p.tool === "label" || p.tool === "arrow"
        ? s.crosshair
        : "";
  const dot = 24 * view.s;
  const waitsOn = (id: string) =>
    wall.connectors.filter((k) => k.to === id).map((k) => wall.notes.find((n) => n.id === k.from)?.title ?? "another note");

  return (
    <div
      ref={vpRef}
      className={`${s.viewport} ${cursorClass} ${mode === "tidy" ? s.viewportTidy : ""} ${p.morphing ? s.morphing : ""}`}
      style={{ backgroundSize: `${dot}px ${dot}px`, backgroundPosition: `${view.x}px ${view.y}px` } as CSSProperties}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onPointerLeave={() => setPointer(null)}
      onDoubleClick={onDoubleClick}
      onScroll={(e) => {
        // Focus inside the wall must never scroll the clipped viewport.
        e.currentTarget.scrollTop = 0;
        e.currentTarget.scrollLeft = 0;
      }}
      onContextMenu={(e) => e.preventDefault()}
    >
      <div
        className={s.layer}
        style={{ transform: `translate3d(${view.x}px, ${view.y}px, 0) scale(${view.s})`, width: bounds.w, height: bounds.h }}
      >
        {/* Zones */}
        {STAGES.map((st) => {
          const r = zoneRect(st.key);
          const count = wall.notes.filter((n) => n.stage === st.key).length;
          return (
            <section
              key={st.key}
              className={`${s.zone} ${s[`zone_${st.key}`]} ${hotStage === st.key ? s.zoneHot : ""} ${gesture?.kind === "resize" ? s.zoneResizing : ""}`}
              style={{ transform: `translate3d(${r.x}px, ${r.y}px, 0)`, width: r.w, height: r.h }}
              aria-label={`${st.name}, ${count} ${count === 1 ? "note" : "notes"}`}
            >
              <header className={s.zoneHead}>
                <span className={s.zoneGlyph}>
                  <Icon.stageDot stage={st.key} size={18} />
                </span>
                <h2 className={s.zoneName}>{st.name}</h2>
                <span className={s.zoneCount}>{count}</span>
                {!readOnly && p.onAddToStage ? (
                  <button
                    type="button"
                    className={s.zoneAdd}
                    data-chrome=""
                    aria-label={`Add a note to ${st.name}`}
                    onClick={() => p.onAddToStage?.(st.key)}
                  >
                    <Icon.plus size={16} />
                  </button>
                ) : null}
              </header>
              {count === 0 && !(wall.starterPad && st.key === "ideas") ? <p className={s.zoneEmpty}>{st.hint}</p> : null}
              {mode === "wall" && !readOnly ? (
                <span className={s.resize} data-resize={st.key} role="presentation" title="Drag to resize">
                  <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
                    <path d="M11 4 4 11M11 8 8 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                </span>
              ) : null}
            </section>
          );
        })}

        {/* Tidy sub-group headings */}
        {mode === "tidy"
          ? tidy.heads.map((h) => (
              <div key={h.key} className={s.tidyHead} style={{ transform: `translate3d(${h.x}px, ${h.y}px, 0)` }}>
                <span className={s.tidyDot} style={{ background: h.tone ? toneVar(h.tone) : "var(--v3-text-3)" }} />
                {h.label}
                <span className={s.tidyCount}>{h.count}</span>
              </div>
            ))
          : null}

        {/* Clusters */}
        {clusterRects.map(({ cluster, rect, count }) => (
          <div
            key={cluster.id}
            className={`${s.cluster} ${p.freshCluster === cluster.id ? s.clusterFresh : ""} ${preview?.kind === "join" && preview.clusterId === cluster.id ? s.clusterHot : ""}`}
            style={{ transform: `translate3d(${rect.x}px, ${rect.y}px, 0)`, width: rect.w, height: rect.h, "--tone": toneVar(cluster.tone) } as CSSProperties}
          >
            <label className={s.clusterName} data-cluster-name="" data-chrome="">
              <span className={s.srOnly}>Group name</span>
              <input
                value={cluster.name}
                placeholder="Name this group"
                autoFocus={p.freshCluster === cluster.id}
                readOnly={readOnly}
                size={Math.max(8, (cluster.name || "Name this group").length)}
                onChange={(e) => p.onRenameCluster?.(cluster.id, e.target.value)}
                onKeyDown={(e) => {
                  e.stopPropagation();
                  if (e.key === "Enter" || e.key === "Escape") e.currentTarget.blur();
                }}
              />
              <span className={s.clusterCount} aria-label={`${count} notes`}>{count}</span>
            </label>
          </div>
        ))}
        {preview?.kind === "new" ? (
          <div className={s.clusterGhost} style={{ transform: `translate3d(${preview.rect.x}px, ${preview.rect.y}px, 0)`, width: preview.rect.w, height: preview.rect.h }}>
            <span className={s.clusterGhostLabel}>Drop to group</span>
          </div>
        ) : null}

        {/* Connectors */}
        <svg className={s.links} width={bounds.w} height={bounds.h} aria-hidden={mode === "tidy"}>
          <defs>
            <marker id="c5-arrow" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
              <path d="M1 1 8 5 1 9" fill="none" stroke="context-stroke" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </marker>
          </defs>
          {mode === "wall"
            ? wall.connectors.map((k) => {
                const a = wall.notes.find((n) => n.id === k.from);
                const b = wall.notes.find((n) => n.id === k.to);
                if (!a || !b) return null;
                const path = connectorPath(rectOf(a), rectOf(b));
                return (
                  <g key={k.id} className={s.link}>
                    <path d={path.d} className={s.linkHit} />
                    <path d={path.d} className={s.linkLine} markerEnd="url(#c5-arrow)" />
                    <foreignObject x={path.mid.x - 60} y={path.mid.y - 13} width={120} height={26} className={s.linkFo}>
                      <div className={s.linkChip} data-chrome="">
                        <span>depends on</span>
                        {!readOnly ? (
                          <button
                            type="button"
                            className={s.linkRemove}
                            aria-label={`Remove link: ${b.title} depends on ${a.title}`}
                            onClick={() => p.onRemoveConnector?.(k.id)}
                          >
                            <Icon.close size={10} />
                          </button>
                        ) : null}
                      </div>
                    </foreignObject>
                  </g>
                );
              })
            : null}
          {connectNote && pointer ? (
            <path d={connectorPath(rectOf(connectNote), { x: pointer.x - 1, y: pointer.y - 1, w: 2, h: 2 }).d} className={s.linkRubber} markerEnd="url(#c5-arrow)" />
          ) : null}
        </svg>

        {/* Scribbles */}
        {mode === "wall"
          ? wall.scribbles.map((sc) => {
              const moving = gesture?.kind === "scribble" && gesture.id === sc.id && gesture.moved;
              const x = sc.x + (moving ? delta.dx : 0);
              const y = sc.y + (moving ? delta.dy : 0);
              return (
                <div key={sc.id} className={s.scribble} data-scribble={sc.id} style={{ transform: `translate3d(${x}px, ${y}px, 0)` }}>
                  {p.editingScribble === sc.id ? (
                    <input
                      className={s.scribbleInput}
                      defaultValue={sc.text}
                      autoFocus
                      placeholder="Type a label"
                      aria-label="Label text"
                      size={Math.max(12, sc.text.length)}
                      onPointerDown={(e) => e.stopPropagation()}
                      onBlur={(e) => {
                        p.onEditScribble?.(sc.id, e.target.value.trim());
                        p.setEditingScribble(null);
                      }}
                      onKeyDown={(e) => {
                        e.stopPropagation();
                        if (e.key === "Enter" || e.key === "Escape") e.currentTarget.blur();
                      }}
                    />
                  ) : (
                    <span>{sc.text}</span>
                  )}
                </div>
              );
            })
          : null}

        {/* Starter pad on an empty wall */}
        {wall.starterPad && mode === "wall" ? (
          <StarterPad count={wall.starterPad} zone={wall.zones[0]} onPeel={() => p.onPeelStarter?.()} />
        ) : null}

        {/* Notes, in reading order so Tab follows the wall */}
        {ordered.map((n) => {
          const owner = n.owner ? people.get(n.owner) : undefined;
          const presence = readOnly ? undefined : cursors.find((c) => c.noteId === n.id);
          return (
            <StickyNote
              key={n.id}
              note={n}
              owner={owner}
              rect={rectOf(n)}
              mode={mode}
              delay={p.morphing ? Math.min((orderIndex.get(n.id) ?? 0) * 14, 320) : 0}
              dragging={dragSet.has(n.id)}
              lifted={dragSet.has(n.id)}
              selected={p.selected.includes(n.id)}
              dimmed={p.filtering && !p.matches(n)}
              stamp={p.stamped.includes(n.id)}
              peel={p.peeled === n.id}
              editing={p.editingId === n.id}
              connectFrom={connectFrom === n.id}
              presence={presence ? people.get(presence.id) : undefined}
              waitsOn={waitsOn(n.id)}
              readOnly={readOnly}
              onCommitTitle={(t) => p.onCommitTitle?.(n.id, t)}
              onCancelEdit={() => p.onCancelEdit?.(n.id)}
              onKeyDown={onNoteKey(n)}
              onFocus={() => ensureVisible(rectOf(n))}
              onOpen={() => openNote(n.id)}
              onHover={(on) => setHoverId((cur) => (on ? n.id : cur === n.id ? null : cur))}
            />
          );
        })}

        {/* Ghost note under the note tool */}
        {p.tool === "note" && pointer && mode === "wall" ? (
          <div className={s.ghost} style={{ transform: `translate3d(${pointer.x - NOTE / 2}px, ${pointer.y - NOTE / 2}px, 0)` }} aria-hidden="true">
            <span>Click to stick</span>
          </div>
        ) : null}

        {marquee ? <div className={s.marquee} style={{ transform: `translate3d(${marquee.x}px, ${marquee.y}px, 0)`, width: marquee.w, height: marquee.h }} /> : null}

        {/* Presence cursors */}
        {!readOnly
          ? cursors.map((c) => {
              const person = people.get(c.id);
              if (!person) return null;
              const n = c.noteId ? wall.notes.find((nn) => nn.id === c.noteId) : undefined;
              const r = n ? baseRect(n) : null;
              const x = r ? r.x + c.fx * r.w : c.wx;
              const y = r ? r.y + c.fy * r.h : c.wy;
              return (
                <div key={c.id} className={s.cursor} style={{ transform: `translate3d(${x}px, ${y}px, 0)`, "--who": toneVar(person.tone) } as CSSProperties} aria-hidden="true">
                  <div style={{ transform: `scale(${1 / view.s})`, transformOrigin: "0 0" }}>
                    <svg width="18" height="18" viewBox="0 0 18 18" className={s.cursorArrow}>
                      <path d="M2.5 1.8 15 8.2l-5.6 1.5-2.4 5.5Z" />
                    </svg>
                    <span className={s.cursorName}>{person.first}</span>
                  </div>
                </div>
              );
            })
          : null}
      </div>

      {/* Hover card at low zoom keeps a crowded wall readable */}
      {hovered ? <HoverCard note={hovered} owner={hovered.owner ? people.get(hovered.owner) : undefined} rect={rectOf(hovered)} view={view} vw={size.w} /> : null}

      {/* Selection bar */}
      {single ? (
        <SelectionBar
          note={single}
          rect={rectOf(single)}
          view={view}
          onTone={(t) => p.onTone?.([single.id], t)}
          onOpen={() => openNote(single.id)}
          onDelete={() => p.onDelete?.([single.id])}
          onEdit={() => p.setEditingId(single.id)}
          vw={size.w}
        />
      ) : null}
      {p.selected.length > 1 && !gesture ? (
        <div className={s.multiBar} data-chrome="">
          <span>{p.selected.length} selected</span>
          <button type="button" onClick={() => p.onDelete?.(p.selected)}>
            <Icon.trash size={14} /> Delete
          </button>
          <button type="button" onClick={() => p.setSelected([])}>
            Clear
          </button>
        </div>
      ) : null}

      {p.tool === "arrow" && !readOnly ? (
        <div className={s.toolHint} data-chrome="">
          {connectFrom ? "Now click the note that waits on it" : "Click the note that has to happen first"}
        </div>
      ) : null}

      {p.showMiniMap !== false ? (
        <MiniMap wall={wall} mode={mode} tidy={tidy.notes} tidyZones={tidy.zones} bounds={bounds} view={view} size={size} onCenter={(wx, wy) => setView((v) => ({ ...v, x: size.w / 2 - wx * v.s, y: size.h / 2 - wy * v.s }))} />
      ) : null}

      {p.renderChrome?.(zoomApi)}
    </div>
  );
}

const COLW = 272;

function zoomed(v: View, next: number, cx: number, cy: number, lo: number, hi: number): View {
  const sc = clamp(next, lo, hi);
  const k = sc / v.s;
  return { s: sc, x: cx - (cx - v.x) * k, y: cy - (cy - v.y) * k };
}

function initialCursors(wall: Wall): Cursor[] {
  return wall.presence.map((id, i) => {
    const pool = wall.notes.filter((n) => n.stage !== "done");
    const n = pool[(i * 5 + 3) % Math.max(1, pool.length)];
    return { id, noteId: i === 0 && n ? n.id : null, fx: 0.72, fy: 0.62, wx: n ? n.x + 190 : 900, wy: n ? n.y + 60 : 400 };
  });
}

function wander(c: Cursor, notes: Note[]): Cursor {
  const pool = notes.filter((n) => n.stage !== "done");
  if (!pool.length) return c;
  const n = pool[Math.floor(Math.random() * pool.length)];
  if (Math.random() < 0.55) return { ...c, noteId: n.id, fx: 0.35 + Math.random() * 0.5, fy: 0.3 + Math.random() * 0.5 };
  return { ...c, noteId: null, wx: n.x + 150 + Math.random() * 60, wy: n.y + Math.random() * 120 };
}

/* ── Pieces ─────────────────────────────────────────────────────────── */

function HoverCard({ note, owner, rect, view, vw }: { note: Note; owner?: Person; rect: Rect; view: View; vw: number }) {
  const sx = (rect.x + rect.w) * view.s + view.x + 10;
  const left = sx + 260 > vw ? rect.x * view.s + view.x - 270 : sx;
  const top = rect.y * view.s + view.y;
  const stage = STAGES.find((st) => st.key === note.stage)!;
  return (
    <div className={s.hoverCard} style={{ left, top }} data-chrome="" role="tooltip">
      <p className={s.hoverTitle}>{note.title || "Untitled note"}</p>
      <dl className={s.hoverMeta}>
        <div>
          <dt>Stage</dt>
          <dd>{stage.name}</dd>
        </div>
        <div>
          <dt>Owner</dt>
          <dd>{owner ? owner.name : "No one yet"}</dd>
        </div>
        {note.due ? (
          <div>
            <dt>Due</dt>
            <dd>
              {dueInfo(note.due, note.stage === "done").long}
              {dueInfo(note.due, note.stage === "done").state === "late" ? `, ${dueInfo(note.due, false).label}` : ""}
            </dd>
          </div>
        ) : null}
      </dl>
    </div>
  );
}

function SelectionBar({
  note,
  rect,
  view,
  onTone,
  onOpen,
  onDelete,
  onEdit,
  vw,
}: {
  note: Note;
  rect: Rect;
  view: View;
  vw: number;
  onTone: (t: Tone) => void;
  onOpen: () => void;
  onDelete: () => void;
  onEdit: () => void;
}) {
  const left = clamp((rect.x + rect.w / 2) * view.s + view.x, 200, vw - 200);
  const top = Math.max(64, rect.y * view.s + view.y - 12 - (note.clusterId ? 20 : 0));
  const tones: Tone[] = [5, 8, 7, 6, 4, 3, 2, 1];
  return (
    <div className={s.selBar} style={{ left, top }} data-chrome="" role="toolbar" aria-label="Note actions">
      <div className={s.selTones}>
        {tones.map((t) => (
          <button
            key={t}
            type="button"
            className={`${s.swatch} ${note.tone === t ? s.swatchOn : ""}`}
            style={{ "--tone": toneVar(t) } as CSSProperties}
            aria-label={`${TONE_NAMES[t]} note`}
            aria-pressed={note.tone === t}
            onClick={() => onTone(t)}
          />
        ))}
      </div>
      <span className={s.selDivider} />
      <button type="button" className={s.selBtn} onClick={onEdit}>
        Edit text
      </button>
      <button type="button" className={s.selBtn} onClick={onOpen}>
        Details
      </button>
      <button type="button" className={s.selIcon} onClick={onDelete} aria-label="Delete note">
        <Icon.trash size={14} />
      </button>
    </div>
  );
}

function StarterPad({ count, zone, onPeel }: { count: number; zone: Wall["zones"][number]; onPeel: () => void }) {
  const x = zone.x + zone.w / 2 - NOTE / 2;
  const y = zone.y + 150;
  return (
    <div className={s.pad} style={{ transform: `translate3d(${x}px, ${y}px, 0)` }} data-chrome="">
      {Array.from({ length: count }).map((_, i) => (
        <span key={i} className={s.padSheet} style={{ "--i": count - 1 - i } as CSSProperties} aria-hidden="true" />
      ))}
      <button type="button" className={s.padTop} onClick={onPeel}>
        <span className={s.padTitle}>Write your first idea</span>
        <span className={s.padHint}>Click to peel a note off, or press N</span>
      </button>
      <p className={s.padCaption}>
        {count} starter {count === 1 ? "note" : "notes"} left on the pad
      </p>
    </div>
  );
}

function MiniMap({
  wall,
  mode,
  tidy,
  tidyZones,
  bounds,
  view,
  size,
  onCenter,
}: {
  wall: Wall;
  mode: Mode;
  tidy: Record<string, Rect>;
  tidyZones: Record<StageKey, Rect>;
  bounds: Rect;
  view: View;
  size: { w: number; h: number };
  onCenter: (x: number, y: number) => void;
}) {
  const W = 184;
  const k = W / bounds.w;
  const H = Math.round(bounds.h * k);
  const [drag, setDrag] = useState(false);
  const jump = (e: ReactPointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    onCenter((e.clientX - r.left) / k, (e.clientY - r.top) / k);
  };
  const vx = -view.x / view.s;
  const vy = -view.y / view.s;
  const vw = size.w / view.s;
  const vh = size.h / view.s;
  return (
    <div className={s.minimap} data-chrome="">
      <svg
        width={W}
        height={H}
        viewBox={`0 0 ${bounds.w} ${bounds.h}`}
        role="img"
        aria-label="Map of the whole wall. Click to jump."
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          setDrag(true);
          jump(e);
        }}
        onPointerMove={(e) => drag && jump(e)}
        onPointerUp={() => setDrag(false)}
      >
        {STAGES.map((st) => {
          const z = mode === "tidy" ? tidyZones[st.key] : wall.zones.find((zz) => zz.stage === st.key)!;
          return <rect key={st.key} x={z.x} y={z.y} width={z.w} height={z.h} rx={18} className={s.miniZone} />;
        })}
        {wall.notes.map((n) => {
          const r = mode === "tidy" ? tidy[n.id] : { x: n.x, y: n.y, w: NOTE, h: NOTE };
          if (!r) return null;
          return <rect key={n.id} x={r.x} y={r.y} width={r.w} height={r.h} rx={8} style={{ fill: toneVar(n.tone) }} className={s.miniNote} />;
        })}
        <rect x={vx} y={vy} width={vw} height={vh} rx={10} className={s.miniView} />
      </svg>
    </div>
  );
}

export { Face };
