"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AUTOMATIONS_APP_PATH, AUTOMATIONS_LABEL, automationPath } from "@/lib/product-urls";
import { KIND_ORDER, stepType, type StepKind } from "@/lib/automations/catalogue";
import {
  deleteDraft,
  getDraftsSnapshot,
  getServerDraftsSnapshot,
  saveDraft,
  subscribeDrafts,
} from "@/lib/automations/draft-store";
import {
  GRID,
  INPUT_Y,
  STEP_W,
  addStep,
  boundsOf,
  canConnect,
  connect,
  copyAutomation,
  duplicateSteps,
  findStep,
  fitView,
  freePort,
  inputPoint,
  linkMidpoint,
  linkPath,
  moveSteps,
  outputPoint,
  removeLinks,
  removeSteps,
  renameAutomation,
  revealRect,
  setConditions,
  snap,
  stepAt,
  stepCountLabel,
  stepHeight,
  stepRect,
  stepsInRect,
  tidy,
  toScreen,
  toWorld,
  updateStep,
  zoomAt,
  zoomStep,
  type Automation,
  type Condition,
  type Insets,
  type Placement,
  type Point,
  type Rect,
  type Size,
  type Step,
  type StepPatch,
  type View,
} from "@/lib/automations/graph";
import { AutoIcon } from "./automation-icons";
import { AutoMenu, Minimap, Soon, StepCard, StepPicker, type MenuItem } from "./editor-parts";
import { initEditor, reduceEditor } from "./editor-state";
import { StepPanel, type PanelFocus } from "./step-panel";
import styles from "./automations.module.css";

/**
 * /app/automations/[id]: one automation on a canvas.
 *
 * A preview. The canvas is a real editor (pan, zoom, drag, connect, edit,
 * undo) and the draft is kept in this browser. Nothing here runs: there is
 * no service behind it, so Live, Publish, Share and "Run from here" are shown
 * but cannot be used, and each says so.
 */
export function AutomationEditor({ id }: { id: string }) {
  const drafts = useSyncExternalStore(subscribeDrafts, getDraftsSnapshot, getServerDraftsSnapshot);
  const [leaving, setLeaving] = useState(false);
  const leave = useCallback(() => setLeaving(true), []);

  if (!drafts || leaving) return <EditorWaiting />;
  const stored = drafts.drafts.find((draft) => draft.id === id);
  if (!stored) return <DraftMissing />;
  return <Editor key={id} initial={stored} kept={drafts.kept} onLeave={leave} />;
}

/** The frame before the browser's drafts are read: no invented content. */
function EditorWaiting() {
  return (
    <main id="app-main-content" tabIndex={-1} className={styles.editor} aria-busy="true">
      <header className={styles.bar}>
        <nav className={styles.crumbs} aria-label="Automation">
          <Link href={AUTOMATIONS_APP_PATH}>{AUTOMATIONS_LABEL}</Link>
          <span aria-hidden="true">/</span>
          <span className={styles.barGhost} />
        </nav>
      </header>
      <div className={styles.stage}>
        <div className={styles.canvas}>
          <div className={styles.surface} style={{ "--grid": "24px" } as CSSProperties} />
        </div>
      </div>
      <footer className={styles.status}>
        <span />
        <span>Opening the draft</span>
        <span />
      </footer>
    </main>
  );
}

function DraftMissing() {
  return (
    <main id="app-main-content" tabIndex={-1} className={styles.editor}>
      <div className={styles.missing}>
        <span className={styles.missingIcon} aria-hidden="true">
          <AutoIcon name="storageOff" size={20} />
        </span>
        <h1>This draft is not in this browser</h1>
        <p>
          Automations are a preview, and each draft is kept only in the browser it was made in. It may have been made
          somewhere else, or deleted here.
        </p>
        <Link href={AUTOMATIONS_APP_PATH} className={styles.button}>
          <AutoIcon name="back" size={14} />
          Back to {AUTOMATIONS_LABEL}
        </Link>
      </div>
    </main>
  );
}

// ── The editor ─────────────────────────────────────────────────────────

type Tool = "select" | "pan";

type PickerState = Readonly<{
  where:
    | Readonly<{ kind: "free" }>
    | Readonly<{ kind: "after"; id: string; port?: string }>
    | Readonly<{ kind: "before"; id: string }>
    | Readonly<{ kind: "drop"; from: string; port: string; point: Point }>;
  kinds: readonly StepKind[];
  heading: string;
  /** Where on the canvas it opens; none means above the bottom toolbar. */
  at: Point | null;
}>;

type Wire = Readonly<{ from: string; port: string; to: Point; target: string | null; ok: boolean }>;

type Gesture =
  | { kind: "pan"; start: Point; origin: View; moved: boolean; clear: boolean }
  | { kind: "pinch"; d0: number; k0: number; mid: Point }
  | { kind: "move"; id: string; ids: readonly string[]; start: Point; moved: boolean; shift: boolean; wasSelected: boolean }
  | { kind: "wire"; from: string; port: string; start: Point }
  | { kind: "marquee"; start: Point; base: readonly string[] };

const NEXT_KINDS: readonly StepKind[] = ["action", "branch"];
const BRANCH_ONLY: readonly StepKind[] = ["branch"];
const TRIGGER_ONLY: readonly StepKind[] = ["trigger"];
const PICKER_W = 304;
const PICKER_H = 380;

function insetsFor(size: Size): Insets {
  return size.w < 700 ? { top: 68, right: 20, bottom: 92, left: 20 } : { top: 76, right: 72, bottom: 104, left: 88 };
}

function subscribeFullscreen(onChange: () => void) {
  document.addEventListener("fullscreenchange", onChange);
  return () => document.removeEventListener("fullscreenchange", onChange);
}
const never = () => () => {};

function Editor({ initial, kept, onLeave }: { initial: Automation; kept: boolean; onLeave: () => void }) {
  const router = useRouter();
  const [state, dispatch] = useReducer(reduceEditor, initial, initEditor);
  const doc = state.history.present;
  const { selection } = state;

  const [view, setView] = useState<View>({ x: 0, y: 0, k: 1 });
  const [size, setSize] = useState<Size>({ w: 0, h: 0 });
  const [phase, setPhase] = useState<"measuring" | "entering" | "ready">("measuring");
  const [tool, setTool] = useState<Tool>("select");
  const [space, setSpace] = useState(false);
  const [panning, setPanning] = useState(false);
  const [drag, setDrag] = useState<Readonly<{ ids: readonly string[]; dx: number; dy: number }> | null>(null);
  const [wire, setWire] = useState<Wire | null>(null);
  const [marquee, setMarquee] = useState<Rect | null>(null);
  const [picker, setPicker] = useState<PickerState | null>(null);
  const [naming, setNaming] = useState<string | null>(null);
  const [panelFocus, setPanelFocus] = useState<Readonly<{ at: PanelFocus; n: number }>>({ at: "first", n: 0 });
  const [focusAsk, setFocusAsk] = useState<Readonly<{ id: string | null; n: number }>>({ id: null, n: 0 });

  const rootRef = useRef<HTMLElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const surfaceRef = useRef<HTMLDivElement>(null);
  const gesture = useRef<Gesture | null>(null);
  const pointers = useRef(new Map<number, Point>());
  const lastTap = useRef<{ id: string; at: number } | null>(null);
  const fitted = useRef(false);
  const pending = useRef<Automation | null>(null);
  const gone = useRef(false);

  // Handlers read the latest values from here, so the cards they are handed
  // to never re-render just because a handler was rebuilt.
  const live = useRef({ doc, view, size, selection, link: state.link, panel: state.panel, tool, space, picker });
  useLayoutEffect(() => {
    live.current = { doc, view, size, selection, link: state.link, panel: state.panel, tool, space, picker };
  });

  const isFull = useSyncExternalStore(subscribeFullscreen, () => document.fullscreenElement !== null, () => false);
  const canFull = useSyncExternalStore(never, () => document.fullscreenEnabled === true, () => false);

  // ── Keeping the draft ────────────────────────────────────────────────
  useEffect(() => {
    if (doc === initial) return;
    pending.current = doc;
    const timer = window.setTimeout(() => {
      pending.current = null;
      saveDraft(doc);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [doc, initial]);

  useEffect(() => {
    const flush = () => {
      if (pending.current && !gone.current) saveDraft(pending.current);
      pending.current = null;
    };
    window.addEventListener("pagehide", flush);
    return () => {
      window.removeEventListener("pagehide", flush);
      flush();
    };
  }, []);

  // ── Size, first fit, entrance ────────────────────────────────────────
  useEffect(() => {
    const element = canvasRef.current;
    if (!element) return;
    const observer = new ResizeObserver((entries) => {
      const box = entries[0]?.contentRect;
      if (!box) return;
      const next = { w: Math.round(box.width), h: Math.round(box.height) };
      setSize(next);
      if (!fitted.current && next.w > 0 && next.h > 0) {
        fitted.current = true;
        setView(fitView(boundsOf(live.current.doc.steps), next, insetsFor(next)));
        setPhase("entering");
      }
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (phase !== "entering") return;
    const timer = window.setTimeout(() => setPhase("ready"), 700);
    return () => window.clearTimeout(timer);
  }, [phase]);

  useEffect(() => {
    if (state.fresh.length === 0) return;
    const timer = window.setTimeout(() => dispatch({ type: "settled" }), 520);
    return () => window.clearTimeout(timer);
  }, [state.fresh]);

  useEffect(() => {
    const hint = state.hint;
    if (!hint) return;
    const timer = window.setTimeout(() => dispatch({ type: "hintDone", n: hint.n }), 3600);
    return () => window.clearTimeout(timer);
  }, [state.hint]);

  useEffect(() => {
    if (focusAsk.n === 0) return;
    const target = focusAsk.id
      ? canvasRef.current?.querySelector<HTMLElement>(`[data-step-id="${focusAsk.id}"]`)
      : canvasRef.current;
    target?.focus({ preventScroll: true });
  }, [focusAsk]);

  // When the edit panel opens, bring the step it edits clear of it: beside
  // the panel on a wide canvas, above the sheet on a phone.
  const panelFor = state.panel && selection.length === 1 ? selection[0]! : null;
  useEffect(() => {
    if (!panelFor) return;
    const timer = window.setTimeout(() => {
      const { doc: current, size: box } = live.current;
      const step = findStep(current, panelFor);
      if (!step || box.w === 0) return;
      const sheet = window.matchMedia("(max-width: 760px)").matches;
      const overlay = !sheet && window.matchMedia("(max-width: 1100px)").matches;
      setView((value) =>
        revealRect(value, stepRect(step), box, {
          top: 68,
          left: 20,
          right: overlay ? 348 : 20,
          bottom: sheet ? Math.round(box.h * 0.58) + 20 : 92,
        }),
      );
    }, 0);
    return () => window.clearTimeout(timer);
  }, [panelFor, size.w, size.h]);

  // ── Wheel: scroll pans, Ctrl or ⌘ with the wheel (and pinch) zooms ───
  useEffect(() => {
    const element = canvasRef.current;
    if (!element) return;
    const onWheel = (event: WheelEvent) => {
      if ((event.target as Element | null)?.closest?.("[data-scrolls]")) return;
      event.preventDefault();
      const box = element.getBoundingClientRect();
      const point = { x: event.clientX - box.left, y: event.clientY - box.top };
      const unit = event.deltaMode === 1 ? 16 : 1;
      if (event.ctrlKey || event.metaKey) {
        // A pinch on a trackpad arrives as many small steps; a mouse wheel as
        // a few large ones. Each is scaled so one notch is about a fifth.
        const travel = event.deltaY * unit;
        const factor = Math.exp(Math.max(-0.3, Math.min(0.3, -travel * (Math.abs(travel) < 40 ? 0.01 : 0.002))));
        setView((current) => zoomAt(current, point, current.k * factor));
      } else {
        setView((current) => ({ ...current, x: current.x - event.deltaX * unit, y: current.y - event.deltaY * unit }));
      }
    };
    element.addEventListener("wheel", onWheel, { passive: false });
    return () => element.removeEventListener("wheel", onWheel);
  }, []);

  useEffect(() => {
    const up = (event: KeyboardEvent) => {
      if (event.key === " ") setSpace(false);
    };
    const blur = () => setSpace(false);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", blur);
    return () => {
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", blur);
    };
  }, []);

  // ── Changes ──────────────────────────────────────────────────────────
  const apply = useCallback(
    (next: Automation, options: { tag?: string; select?: readonly string[]; fresh?: readonly string[]; say?: string; panel?: boolean } = {}) => {
      dispatch({ type: "apply", doc: next, now: Date.now(), ...options });
    },
    [],
  );
  const say = useCallback((text: string, show = false) => dispatch({ type: "say", text, show }), []);
  const askFocus = useCallback((id: string | null) => setFocusAsk((current) => ({ id, n: current.n + 1 })), []);
  const closePicker = useCallback(() => setPicker(null), []);

  const reveal = useCallback((step: Step) => {
    setView((current) => revealRect(current, stepRect(step), live.current.size, insetsFor(live.current.size)));
  }, []);

  const openPanel = useCallback((id?: string, at: PanelFocus = "first") => {
    if (id) dispatch({ type: "select", ids: [id], panel: true });
    else dispatch({ type: "panel", open: true });
    setPanelFocus((current) => ({ at, n: current.n + 1 }));
  }, []);

  const closePanel = useCallback(() => {
    const only = live.current.selection.length === 1 ? live.current.selection[0]! : null;
    dispatch({ type: "panel", open: false });
    askFocus(only);
  }, [askFocus]);

  const removeSelected = useCallback(() => {
    const { doc: current, selection: ids, link } = live.current;
    if (link) {
      apply(removeLinks(current, [link]), { say: "Connection removed" });
      askFocus(null);
      return;
    }
    if (ids.length === 0) return;
    const name = ids.length === 1 ? findStep(current, ids[0]!)?.title : null;
    apply(removeSteps(current, ids), { select: [], say: name ? `Removed ${name}` : `Removed ${ids.length} steps` });
    askFocus(null);
  }, [apply, askFocus]);

  const duplicateSelected = useCallback(() => {
    const { doc: current, selection: ids } = live.current;
    if (ids.length === 0) return;
    const copy = duplicateSteps(current, ids);
    apply(copy.doc, { select: copy.ids, fresh: copy.ids, say: copy.ids.length === 1 ? "Step duplicated" : `${copy.ids.length} steps duplicated` });
    const first = copy.ids[0] ? findStep(copy.doc, copy.ids[0]) : null;
    if (first) {
      reveal(first);
      askFocus(first.id);
    }
  }, [apply, askFocus, reveal]);

  const linkUp = useCallback(
    (from: string, port: string, to: string) => {
      const current = live.current.doc;
      const verdict = canConnect(current, from, port, to);
      if (!verdict.ok) {
        say(verdict.why, true);
        return;
      }
      const next = connect(current, from, port, to);
      const made = next.links[next.links.length - 1];
      apply(next, { fresh: made ? [made.id] : [], say: `Connected ${findStep(current, from)?.title} to ${findStep(current, to)?.title}` });
    },
    [apply, say],
  );

  const pick = useCallback(
    (typeId: string) => {
      const { doc: current, view: at, size: box, selection: ids, picker: open } = live.current;
      const type = stepType(typeId);
      if (!type || !open) return;
      const centre = toWorld(at, { x: box.w / 2, y: box.h / 2 });
      let where: Placement = { at: { x: centre.x - STEP_W / 2, y: centre.y - INPUT_Y } };
      if (open.where.kind === "after") where = { after: open.where.id, port: open.where.port };
      else if (open.where.kind === "before") where = { before: open.where.id };
      else if (open.where.kind === "drop") where = { at: { x: open.where.point.x, y: open.where.point.y - INPUT_Y } };
      else if (ids.length === 1 && type.kind !== "trigger") where = { after: ids[0]! };

      const placed = addStep(current, typeId, where);
      const addedId = placed.stepId;
      if (!addedId) return;
      const next = open.where.kind === "drop" ? connect(placed.doc, open.where.from, open.where.port, addedId) : placed.doc;
      const added = findStep(next, addedId)!;
      const joined = next.links.filter((link) => !current.links.includes(link));
      apply(next, {
        select: [added.id],
        fresh: [added.id, ...joined.map((link) => link.id)],
        say: joined.length > 0 ? `Added ${added.title}, connected` : `Added ${added.title}`,
      });
      setPicker(null);
      reveal(added);
      askFocus(added.id);
    },
    [apply, askFocus, reveal],
  );

  const zoomBy = useCallback((direction: 1 | -1) => {
    setView((current) => zoomAt(current, { x: live.current.size.w / 2, y: live.current.size.h / 2 }, zoomStep(current.k, direction)));
  }, []);
  const fit = useCallback(() => {
    const { doc: current, size: box } = live.current;
    setView(fitView(boundsOf(current.steps), box, insetsFor(box)));
  }, []);
  const tidyUp = useCallback(() => {
    const current = live.current.doc;
    const neat = tidy(current);
    apply(neat, { say: neat === current ? "Already tidy" : "Steps tidied" });
    setView(fitView(boundsOf(neat.steps), live.current.size, insetsFor(live.current.size)));
  }, [apply]);

  // ── Pointer: pan, pinch, drag steps, draw lines, drag a selection box ─
  const local = (event: { clientX: number; clientY: number }): Point => {
    const box = canvasRef.current!.getBoundingClientRect();
    return { x: event.clientX - box.left, y: event.clientY - box.top };
  };

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    const target = event.target as Element;
    if (event.button === 2 || target.closest("button, a, input, select, textarea")) return;
    const point = local(event);
    // A first finger or the mouse starts afresh: a press whose release never
    // arrived must not turn the next press into a two-finger pinch.
    if (event.isPrimary) pointers.current.clear();
    pointers.current.set(event.pointerId, point);
    surfaceRef.current?.setPointerCapture(event.pointerId);
    const { doc: current, view: at, selection: ids, tool: mode, space: held } = live.current;

    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()] as [Point, Point];
      gesture.current = { kind: "pinch", d0: Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)), k0: at.k, mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 } };
      setDrag(null);
      setWire(null);
      setMarquee(null);
      return;
    }
    if (pointers.current.size > 2) return;

    const world = toWorld(at, point);
    const stepElement = target.closest<HTMLElement>("[data-step-id]");
    const portElement = target.closest<HTMLElement>("[data-port]");
    const linkElement = target.closest<SVGElement>("[data-link-id]");
    const wantsPan = event.button === 1 || mode === "pan" || held;
    const onNothing = !stepElement && !linkElement;

    if (wantsPan || (onNothing && !(event.shiftKey && event.pointerType === "mouse"))) {
      gesture.current = { kind: "pan", start: point, origin: at, moved: false, clear: onNothing && !wantsPan };
      setPanning(true);
      if (onNothing) canvasRef.current?.focus({ preventScroll: true });
      return;
    }
    if (stepElement && portElement) {
      event.preventDefault();
      const from = stepElement.dataset.stepId!;
      const port = portElement.dataset.port!;
      gesture.current = { kind: "wire", from, port, start: point };
      setWire({ from, port, to: world, target: null, ok: false });
      return;
    }
    if (stepElement) {
      const id = stepElement.dataset.stepId!;
      const wasSelected = ids.includes(id);
      const moving = wasSelected ? ids : event.shiftKey ? [...ids, id] : [id];
      gesture.current = { kind: "move", id, ids: moving, start: world, moved: false, shift: event.shiftKey, wasSelected };
      if (!wasSelected) dispatch({ type: "select", ids: moving });
      return;
    }
    if (linkElement) {
      dispatch({ type: "selectLink", id: linkElement.dataset.linkId ?? null });
      canvasRef.current?.focus({ preventScroll: true });
      return;
    }
    gesture.current = { kind: "marquee", start: world, base: ids };
    setMarquee({ x: world.x, y: world.y, w: 0, h: 0 });
    void current;
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!pointers.current.has(event.pointerId)) return;
    const point = local(event);
    pointers.current.set(event.pointerId, point);
    const active = gesture.current;
    if (!active) return;
    const { doc: current, view: at } = live.current;

    if (active.kind === "pinch") {
      if (pointers.current.size < 2) return;
      const [a, b] = [...pointers.current.values()] as [Point, Point];
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      const shift = { x: mid.x - active.mid.x, y: mid.y - active.mid.y };
      const k = (active.k0 * Math.hypot(a.x - b.x, a.y - b.y)) / active.d0;
      active.mid = mid;
      setView((value) => zoomAt({ ...value, x: value.x + shift.x, y: value.y + shift.y }, mid, k));
      return;
    }
    if (active.kind === "pan") {
      const dx = point.x - active.start.x;
      const dy = point.y - active.start.y;
      if (!active.moved && Math.hypot(dx, dy) < 4) return;
      active.moved = true;
      setView({ ...active.origin, x: active.origin.x + dx, y: active.origin.y + dy });
      return;
    }
    const world = toWorld(at, point);
    if (active.kind === "move") {
      const dx = world.x - active.start.x;
      const dy = world.y - active.start.y;
      if (!active.moved && Math.hypot(dx, dy) * at.k < 4) return;
      active.moved = true;
      setDrag({ ids: active.ids, dx: snap(dx), dy: snap(dy) });
      return;
    }
    if (active.kind === "wire") {
      const hit = stepAt(current, world);
      const target = hit && hit.id !== active.from ? hit : null;
      const ok = target ? canConnect(current, active.from, active.port, target.id).ok : false;
      setWire({ from: active.from, port: active.port, to: target && ok ? inputPoint(target) : world, target: target?.id ?? null, ok });
      return;
    }
    setMarquee({ x: active.start.x, y: active.start.y, w: world.x - active.start.x, h: world.y - active.start.y });
  };

  const onPointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!pointers.current.has(event.pointerId)) return;
    const point = local(event);
    pointers.current.delete(event.pointerId);
    const active = gesture.current;
    if (!active) return;
    if (active.kind === "pinch") {
      if (pointers.current.size < 2) gesture.current = null;
      return;
    }
    gesture.current = null;
    setPanning(false);
    const { doc: current, view: at, selection: ids } = live.current;
    const world = toWorld(at, point);
    const cancelled = event.type === "pointercancel";

    if (active.kind === "pan") {
      if (!active.moved && active.clear && !cancelled) dispatch({ type: "select", ids: [] });
      return;
    }
    if (active.kind === "move") {
      setDrag(null);
      if (active.moved) {
        if (!cancelled) apply(moveSteps(current, active.ids, snap(world.x - active.start.x), snap(world.y - active.start.y)));
        return;
      }
      if (active.shift && active.wasSelected) {
        dispatch({ type: "select", ids: ids.filter((id) => id !== active.id) });
        return;
      }
      if (!active.shift && ids.length > 1) dispatch({ type: "select", ids: [active.id] });
      const now = event.timeStamp;
      if (lastTap.current && lastTap.current.id === active.id && now - lastTap.current.at < 400) {
        lastTap.current = null;
        openPanel(active.id);
      } else {
        lastTap.current = { id: active.id, at: now };
      }
      return;
    }
    if (active.kind === "wire") {
      setWire(null);
      if (cancelled) return;
      const hit = stepAt(current, world);
      if (hit && hit.id !== active.from) {
        linkUp(active.from, active.port, hit.id);
      } else if (!hit && Math.hypot(point.x - active.start.x, point.y - active.start.y) > 28) {
        setPicker({
          where: { kind: "drop", from: active.from, port: active.port, point: world },
          kinds: NEXT_KINDS,
          heading: "Add the next step",
          at: point,
        });
      }
      return;
    }
    setMarquee(null);
    if (cancelled) return;
    const boxed = stepsInRect(current, { x: active.start.x, y: active.start.y, w: world.x - active.start.x, h: world.y - active.start.y });
    dispatch({ type: "select", ids: [...new Set([...active.base, ...boxed])] });
  };

  // ── Keyboard ─────────────────────────────────────────────────────────
  const onKeyDown = (event: ReactKeyboardEvent<HTMLElement>) => {
    const target = event.target as HTMLElement;
    if (target.closest("input, textarea, select, [data-own-keys]")) return;
    const { doc: current, selection: ids, link, panel } = live.current;
    const mod = event.ctrlKey || event.metaKey;
    const key = event.key;
    const onControl = target.closest("button, a") !== null;

    if (mod && key.toLowerCase() === "z") {
      event.preventDefault();
      dispatch({ type: event.shiftKey ? "redo" : "undo" });
    } else if (mod && key.toLowerCase() === "y") {
      event.preventDefault();
      dispatch({ type: "redo" });
    } else if (mod && key.toLowerCase() === "d") {
      event.preventDefault();
      duplicateSelected();
    } else if (mod && key.toLowerCase() === "a") {
      event.preventDefault();
      dispatch({ type: "select", ids: current.steps.map((step) => step.id) });
    } else if (mod || event.altKey) {
      return;
    } else if (key === "Escape") {
      if (picker) setPicker(null);
      else if (panel) closePanel();
      else if (ids.length > 0 || link) dispatch({ type: "select", ids: [] });
      else return;
      event.preventDefault();
    } else if (onControl) {
      return;
    } else if (key === " ") {
      event.preventDefault();
      setSpace(true);
    } else if (key === "Delete" || key === "Backspace") {
      if (ids.length === 0 && !link) return;
      event.preventDefault();
      removeSelected();
    } else if (key === "Enter") {
      if (ids.length === 0) return;
      event.preventDefault();
      openPanel();
    } else if (key.startsWith("Arrow")) {
      event.preventDefault();
      const far = event.shiftKey ? 5 : 1;
      const dx = key === "ArrowLeft" ? -1 : key === "ArrowRight" ? 1 : 0;
      const dy = key === "ArrowUp" ? -1 : key === "ArrowDown" ? 1 : 0;
      if (ids.length > 0) {
        const moved = moveSteps(current, ids, dx * GRID * far, dy * GRID * far);
        apply(moved, { tag: `nudge:${ids.join(",")}` });
        const first = findStep(moved, ids[0]!);
        if (first) reveal(first);
      } else {
        setView((value) => ({ ...value, x: value.x - dx * 48 * far, y: value.y - dy * 48 * far }));
      }
    } else if (key === "+" || key === "=") {
      event.preventDefault();
      zoomBy(1);
    } else if (key === "-" || key === "_") {
      event.preventDefault();
      zoomBy(-1);
    } else if (key === "!" || (event.shiftKey && key === "1")) {
      event.preventDefault();
      fit();
    }
  };

  const onFocusStep = useCallback(
    (id: string, keyboard: boolean) => {
      if (!keyboard) return;
      const { doc: current, selection: ids } = live.current;
      if (!ids.includes(id)) dispatch({ type: "select", ids: [id] });
      const step = findStep(current, id);
      if (step) reveal(step);
    },
    [reveal],
  );
  const onEditStep = useCallback((id: string) => openPanel(id), [openPanel]);

  // ── What is drawn ────────────────────────────────────────────────────
  const shown = useMemo(() => {
    if (!drag) return doc.steps;
    const moving = new Set(drag.ids);
    return doc.steps.map((step) => (moving.has(step.id) ? { ...step, x: step.x + drag.dx, y: step.y + drag.dy } : step));
  }, [doc.steps, drag]);
  const byId = useMemo(() => new Map(shown.map((step) => [step.id, step])), [shown]);
  const counts = useMemo(() => {
    const map = new Map<string, number>();
    for (const link of doc.links) map.set(link.from, (map.get(link.from) ?? 0) + 1);
    return map;
  }, [doc.links]);

  const bounds = boundsOf(shown);
  const sheet: Rect = bounds
    ? { x: bounds.x - 800, y: bounds.y - 800, w: bounds.w + 1600, h: bounds.h + 1600 }
    : { x: -800, y: -800, w: 1600, h: 1600 };
  const single = selection.length === 1 ? byId.get(selection[0]!) ?? null : null;
  const quiet = drag !== null || wire !== null || panning;
  const narrow = size.w > 0 && size.w < 560;
  const selectedLink = state.link ? doc.links.find((link) => link.id === state.link) ?? null : null;
  const fresh = new Set(state.fresh);

  let grid = 24 * view.k;
  while (grid < 14) grid *= 2;
  const surfaceStyle = {
    "--grid": `${grid}px`,
    "--grid-x": `${view.x}px`,
    "--grid-y": `${view.y}px`,
  } as CSSProperties;

  // The floating toolbar and the two round handles ride above the selected
  // step in screen space, so they stay the same size at any zoom.
  let toolbarStyle: CSSProperties | null = null;
  let handleAfter: CSSProperties | null = null;
  let handleBefore: CSSProperties | null = null;
  if (single && !quiet && size.w > 0) {
    const top = toScreen(view, { x: single.x + STEP_W / 2, y: single.y });
    const bottom = toScreen(view, { x: single.x, y: single.y + stepHeight(single) });
    const above = top.y - 52 >= 8;
    toolbarStyle = {
      left: Math.min(Math.max(top.x, 132), Math.max(132, size.w - 132)),
      top: above ? top.y - 52 : bottom.y + 12,
    };
    const out = toScreen(view, outputPoint(single, freePort(doc, single)));
    handleAfter = { left: out.x + 22, top: out.y };
    if (single.kind !== "trigger") {
      const into = toScreen(view, inputPoint(single));
      handleBefore = { left: into.x - 22, top: into.y };
    }
  }

  let linkButton: CSSProperties | null = null;
  if (selectedLink && !quiet) {
    const from = byId.get(selectedLink.from);
    const to = byId.get(selectedLink.to);
    if (from && to) {
      const mid = toScreen(view, linkMidpoint(outputPoint(from, selectedLink.port), inputPoint(to)));
      linkButton = { left: mid.x, top: mid.y };
    }
  }

  const pickerStyle: CSSProperties | undefined =
    picker?.at && !narrow
      ? {
          left: Math.min(Math.max(12, picker.at.x), Math.max(12, size.w - PICKER_W - 12)),
          top: Math.min(Math.max(12, picker.at.y), Math.max(12, size.h - PICKER_H - 12)),
        }
      : undefined;

  const openPickerFree = () =>
    setPicker(
      live.current.picker
        ? null
        : { where: { kind: "free" }, kinds: KIND_ORDER, heading: single && single.kind !== "trigger" ? `Add a step after ${single.title}` : "Add a step", at: null },
    );
  const openPickerAfter = (kinds: readonly StepKind[]) => {
    if (!single || !handleAfter) return;
    setPicker({
      where: { kind: "after", id: single.id },
      kinds,
      heading: kinds === BRANCH_ONLY ? `Split the path after ${single.title}` : `Add a step after ${single.title}`,
      at: { x: Number(handleAfter.left) + 18, y: Number(handleAfter.top) - 24 },
    });
  };
  const openPickerBefore = () => {
    if (!single || !handleBefore) return;
    setPicker({
      where: { kind: "before", id: single.id },
      kinds: KIND_ORDER,
      heading: `Add a step before ${single.title}`,
      at: { x: Number(handleBefore.left) - PICKER_W - 18, y: Number(handleBefore.top) - 24 },
    });
  };

  const menu: MenuItem[] = [
    { id: "rename", label: "Rename", icon: "edit", onSelect: () => setNaming(doc.name) },
    {
      id: "copy",
      label: "Make a copy",
      icon: "duplicate",
      onSelect: () => {
        const copy = copyAutomation(doc);
        saveDraft(doc);
        saveDraft(copy);
        router.push(automationPath(copy.id));
      },
    },
    { id: "tidy", label: "Tidy up the steps", icon: "tidy", onSelect: tidyUp },
    {
      id: "delete",
      label: "Delete this draft",
      icon: "trash",
      danger: true,
      confirm: "Delete this draft for good?",
      onSelect: () => {
        gone.current = true;
        onLeave();
        deleteDraft(doc.id);
        router.push(AUTOMATIONS_APP_PATH);
      },
    },
  ];

  const commitName = (value: string | null) => {
    if (value !== null) apply(renameAutomation(doc, value), { say: "Renamed" });
    setNaming(null);
  };

  const panelSteps = selection.map((id) => byId.get(id)).filter((step): step is Step => step !== undefined);
  const panelOpen = state.panel && panelSteps.length > 0;
  const cursor = panning ? "grabbing" : tool === "pan" || space ? "grab" : undefined;

  return (
    <main
      ref={rootRef}
      id="app-main-content"
      tabIndex={-1}
      className={styles.editor}
      data-full={isFull ? "" : undefined}
      onKeyDown={onKeyDown}
    >
      <header className={styles.bar}>
        <nav className={styles.crumbs} aria-label="Automation">
          <Link href={AUTOMATIONS_APP_PATH} className={styles.crumbBack} aria-label={`Back to ${AUTOMATIONS_LABEL}`}>
            <AutoIcon name="back" />
          </Link>
          <Link href={AUTOMATIONS_APP_PATH} className={styles.crumbRoot}>{AUTOMATIONS_LABEL}</Link>
          <span className={styles.crumbSep} aria-hidden="true">/</span>
          {naming !== null ? (
            <input
              className={styles.nameInput}
              value={naming}
              maxLength={80}
              aria-label="Name of this automation"
              autoFocus
              onFocus={(event) => event.currentTarget.select()}
              onChange={(event) => setNaming(event.target.value)}
              onBlur={() => commitName(naming)}
              onKeyDown={(event) => {
                if (event.key === "Enter") commitName(naming);
                else if (event.key === "Escape") {
                  event.stopPropagation();
                  commitName(null);
                }
              }}
            />
          ) : (
            <h1 className={styles.nameWrap}>
              <button type="button" className={styles.name} title="Rename" aria-label={`${doc.name}. Rename`} onClick={() => setNaming(doc.name)}>
                {doc.name}
              </button>
            </h1>
          )}
          <span className={styles.pill}>Draft</span>
        </nav>
        <div className={styles.barActions}>
          <div className={styles.mode} role="group" aria-label="Draft or live">
            <span className={styles.modeOn} aria-current="true">Draft</span>
            <Soon why="Automations cannot go live yet, so nothing runs." className={styles.modeOff}>Live</Soon>
          </div>
          <Soon why="Drafts stay in this browser for now." className={styles.button} label="Share">
            <AutoIcon name="share" size={14} />
            <span className={styles.wideOnly}>Share</span>
          </Soon>
          <AutoMenu label="More" items={menu} className={styles.iconButton} />
          <Soon why="Nothing runs yet, so there is nothing to publish." className={styles.primary} align="end">Publish</Soon>
        </div>
      </header>

      <div className={styles.stage}>
        <div
          ref={canvasRef}
          className={styles.canvas}
          tabIndex={-1}
          role="region"
          aria-label={`Canvas for ${doc.name}. ${stepCountLabel(doc.steps.length)}.`}
          data-phase={phase}
          data-quiet={quiet ? "" : undefined}
          data-wiring={wire ? "" : undefined}
        >
          <div
            ref={surfaceRef}
            className={styles.surface}
            style={{ ...surfaceStyle, cursor }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            onLostPointerCapture={onPointerUp}
          >
            <div className={styles.world} style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.k})` }}>
              <svg
                className={styles.links}
                style={{ left: sheet.x, top: sheet.y }}
                width={sheet.w}
                height={sheet.h}
                viewBox={`${sheet.x} ${sheet.y} ${sheet.w} ${sheet.h}`}
                aria-hidden="true"
                focusable="false"
              >
                {doc.links.map((link) => {
                  const from = byId.get(link.from);
                  const to = byId.get(link.to);
                  if (!from || !to) return null;
                  const a = outputPoint(from, link.port);
                  const b = inputPoint(to);
                  const d = linkPath(a, b);
                  return (
                    <g
                      key={link.id}
                      className={styles.link}
                      data-link-id={link.id}
                      data-selected={state.link === link.id ? "" : undefined}
                      data-near={selection.includes(link.from) || selection.includes(link.to) ? "" : undefined}
                      data-fresh={fresh.has(link.id) ? "" : undefined}
                    >
                      <path className={styles.linkHit} d={d} />
                      <path className={styles.linkLine} d={d} pathLength={1} />
                      <circle className={styles.linkDot} cx={a.x} cy={a.y} r={3.5} />
                      <circle className={styles.linkDot} cx={b.x} cy={b.y} r={3.5} />
                    </g>
                  );
                })}
                {wire && byId.get(wire.from) ? (
                  <g className={styles.link} data-draft="" data-ok={wire.ok ? "" : undefined}>
                    <path className={styles.linkLine} d={linkPath(outputPoint(byId.get(wire.from)!, wire.port), wire.to)} />
                    <circle className={styles.linkDot} cx={wire.to.x} cy={wire.to.y} r={4} />
                  </g>
                ) : null}
              </svg>
              {shown.map((step) => (
                <StepCard
                  key={step.id}
                  step={doc.steps.find((entry) => entry.id === step.id) ?? step}
                  x={step.x}
                  y={step.y}
                  selected={selection.includes(step.id)}
                  fresh={fresh.has(step.id)}
                  lifted={drag?.ids.includes(step.id) ?? false}
                  wire={!wire || wire.from === step.id ? null : wire.target === step.id ? (wire.ok ? "aim" : "no") : canConnect(doc, wire.from, wire.port, step.id).ok ? "yes" : "no"}
                  nexts={counts.get(step.id) ?? 0}
                  onEdit={onEditStep}
                  onFocusStep={onFocusStep}
                />
              ))}
            </div>
            {marquee ? (
              <span
                className={styles.marquee}
                style={{
                  left: Math.min(marquee.x, marquee.x + marquee.w) * view.k + view.x,
                  top: Math.min(marquee.y, marquee.y + marquee.h) * view.k + view.y,
                  width: Math.abs(marquee.w) * view.k,
                  height: Math.abs(marquee.h) * view.k,
                }}
              />
            ) : null}
          </div>

          {doc.steps.length === 0 && phase !== "measuring" ? (
            <div className={styles.blank}>
              <span className={styles.tile} data-kind="trigger" aria-hidden="true">
                <AutoIcon name="taskNew" />
              </span>
              <h2>Start with a trigger</h2>
              <p>A trigger is what sets things off, like a task becoming late. Then add what should happen next.</p>
              <button
                type="button"
                className={styles.button}
                onClick={() => setPicker({ where: { kind: "free" }, kinds: TRIGGER_ONLY, heading: "Choose a trigger", at: null })}
              >
                <AutoIcon name="plus" size={14} />
                Choose a trigger
              </button>
            </div>
          ) : null}

          {toolbarStyle && single ? (
            <div className={styles.stepBar} style={toolbarStyle} role="toolbar" aria-label={`Actions for ${single.title}`}>
              <Soon why="Nothing runs yet." className={styles.barButton} label="Run from here" side="top">
                <AutoIcon name="play" />
              </Soon>
              <span className={styles.barRule} aria-hidden="true" />
              <button type="button" className={styles.barButton} aria-label="Split the path after this step" title="Split the path" onClick={() => openPickerAfter(BRANCH_ONLY)}>
                <AutoIcon name="split" />
              </button>
              <button type="button" className={styles.barButton} aria-label="Edit this step" title="Edit" onClick={() => openPanel(single.id)}>
                <AutoIcon name="edit" />
              </button>
              <button type="button" className={styles.barButton} aria-label="Add a note to this step" title="Note" onClick={() => openPanel(single.id, "note")}>
                <AutoIcon name="note" />
              </button>
              <button type="button" className={styles.barButton} aria-label="Duplicate this step" title="Duplicate" onClick={duplicateSelected}>
                <AutoIcon name="duplicate" />
              </button>
              <button type="button" className={styles.barButton} data-danger="" aria-label="Delete this step" title="Delete" onClick={removeSelected}>
                <AutoIcon name="trash" />
              </button>
            </div>
          ) : null}
          {handleAfter && single ? (
            <button type="button" className={styles.handle} style={handleAfter} aria-label={`Add a step after ${single.title}`} onClick={() => openPickerAfter(NEXT_KINDS)}>
              <AutoIcon name="plus" size={14} />
            </button>
          ) : null}
          {handleBefore && single ? (
            <button type="button" className={styles.handle} style={handleBefore} aria-label={`Add a step before ${single.title}`} onClick={openPickerBefore}>
              <AutoIcon name="plus" size={14} />
            </button>
          ) : null}
          {linkButton ? (
            <button type="button" className={styles.handle} data-danger="" style={linkButton} aria-label="Remove this connection" onClick={removeSelected}>
              <AutoIcon name="close" size={14} />
            </button>
          ) : null}

          <div className={styles.tools} role="toolbar" aria-label="Canvas tools" aria-orientation="vertical">
            <button type="button" className={styles.toolButton} aria-pressed={tool === "select"} aria-label="Select and move steps" title="Select" onClick={() => setTool("select")}>
              <AutoIcon name="pointer" />
            </button>
            <button type="button" className={styles.toolButton} aria-pressed={tool === "pan"} aria-label="Move around the canvas" title="Move around (hold Space)" onClick={() => setTool("pan")}>
              <AutoIcon name="pan" />
            </button>
            <span className={styles.toolRule} aria-hidden="true" />
            <button type="button" className={styles.toolButton} aria-label="Tidy up the steps" title="Tidy up" onClick={tidyUp}>
              <AutoIcon name="tidy" />
            </button>
          </div>

          <div className={styles.dock} role="toolbar" aria-label="Steps and history" data-signal-bottom-nav="automations">
            <button type="button" className={styles.dockAdd} aria-haspopup="dialog" aria-expanded={picker?.at === null} onClick={openPickerFree}>
              <AutoIcon name="plus" />
              Step
            </button>
            <span className={styles.barRule} aria-hidden="true" />
            <button type="button" className={styles.barButton} aria-label="Undo" title="Undo" disabled={state.history.past.length === 0} onClick={() => dispatch({ type: "undo" })}>
              <AutoIcon name="undo" />
            </button>
            <button type="button" className={styles.barButton} aria-label="Redo" title="Redo" disabled={state.history.future.length === 0} onClick={() => dispatch({ type: "redo" })}>
              <AutoIcon name="redo" />
            </button>
          </div>

          <div className={styles.corner}>
            {size.w > 0 ? (
              <Minimap
                steps={shown}
                selection={selection}
                view={view}
                size={size}
                onLook={(centre) => setView((value) => ({ ...value, x: Math.round(size.w / 2 - centre.x * value.k), y: Math.round(size.h / 2 - centre.y * value.k) }))}
              />
            ) : null}
            <div className={styles.zoom} role="toolbar" aria-label="Zoom">
              <button type="button" className={styles.barButton} aria-label="Fit everything on screen" title="Fit to view" onClick={fit}>
                <AutoIcon name="fit" />
              </button>
              <button type="button" className={styles.barButton} aria-label="Zoom out" title="Zoom out" disabled={view.k <= 0.2501} onClick={() => zoomBy(-1)}>
                <AutoIcon name="minus" />
              </button>
              <button
                type="button"
                className={styles.zoomValue}
                aria-label={`Zoom ${Math.round(view.k * 100)} percent. Set to 100 percent`}
                title="Back to 100 percent"
                onClick={() => setView((value) => zoomAt(value, { x: size.w / 2, y: size.h / 2 }, 1))}
              >
                {Math.round(view.k * 100)}%
              </button>
              <button type="button" className={styles.barButton} aria-label="Zoom in" title="Zoom in" disabled={view.k >= 1.9999} onClick={() => zoomBy(1)}>
                <AutoIcon name="plus" />
              </button>
              {canFull ? (
                <button
                  type="button"
                  className={`${styles.barButton} ${styles.wideOnly}`}
                  aria-label={isFull ? "Leave full screen" : "Fill the screen"}
                  title={isFull ? "Leave full screen" : "Full screen"}
                  onClick={() => {
                    if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
                    else void rootRef.current?.requestFullscreen().catch(() => {});
                  }}
                >
                  <AutoIcon name={isFull ? "exitFullscreen" : "fullscreen"} />
                </button>
              ) : null}
            </div>
          </div>

          {state.hint ? (
            <div className={styles.hint} aria-hidden="true">
              <AutoIcon name="info" size={14} />
              {state.hint.text}
            </div>
          ) : null}

          {picker ? (
            <StepPicker
              key={`${picker.heading}:${picker.at?.x ?? "dock"}`}
              heading={picker.heading}
              kinds={picker.kinds}
              style={pickerStyle}
              onPick={pick}
              onClose={closePicker}
            />
          ) : null}
        </div>

        {panelOpen ? (
          <StepPanel
            doc={doc}
            steps={panelSteps}
            focus={panelFocus}
            onPatch={(id: string, patch: StepPatch, tag: string) => apply(updateStep(doc, id, patch), { tag })}
            onConditions={(id: string, conditions: readonly Condition[], tag: string | null) =>
              apply(setConditions(doc, id, conditions), tag ? { tag } : { say: "Paths changed" })
            }
            onConnect={linkUp}
            onDisconnect={(linkId) => apply(removeLinks(doc, [linkId]), { say: "Connection removed" })}
            onDuplicate={duplicateSelected}
            onDelete={removeSelected}
            onClose={closePanel}
          />
        ) : null}
      </div>

      <footer className={styles.status}>
        <span className={styles.statusCount}>
          {stepCountLabel(doc.steps.length)}
          {doc.links.length > 0 ? ` · ${doc.links.length === 1 ? "1 connection" : `${doc.links.length} connections`}` : ""}
        </span>
        <span className={styles.statusNote}>Automations are a preview. Nothing runs yet.</span>
        <span className={styles.statusSaved} data-kept={kept ? "" : undefined}>
          <AutoIcon name={kept ? "check" : "storageOff"} size={12} />
          {kept ? "Saved in this browser" : "Not saved: this browser is not keeping drafts"}
        </span>
      </footer>

      <p id="automation-step-keys" hidden>
        Press Enter to edit, the arrow keys to move it, Delete to remove it.
      </p>
      <div className={styles.srOnly} role="status" aria-live="polite">
        {state.said.text}
        {state.said.n % 2 === 1 ? " " : ""}
      </div>
    </main>
  );
}
