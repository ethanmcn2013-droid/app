"use client";

/**
 * All projects: the answer and the chart (v3, round 2).
 *
 *   answer      one sentence and "Show it"
 *   chips       the status split in words, which also filter
 *   toolbar     Group, Sort, Find a project (above 12 rows), How to read
 *               this, the zoom and Today
 *   legend      drawn with the real marks, open on a first visit
 *   grid        one sticky name column beside one time canvas, a bar per
 *               Project, on the shared `TimelineCanvas`
 *
 * View state lives in the URL (`?zoom=&group=&sort=&status=`), written with
 * the History API so a view can be linked and survives a reload without a
 * server round trip; defaults are left out. The time scale is built from
 * every row, not the filtered ones, so filtering never moves a bar.
 *
 * Keyboard: the grid is one Tab stop with a roving row. ↑ ↓ or J K move
 * (group headers included), ← → step through the row's milestones and say
 * each one, Home and End jump, Enter opens (or folds a group), Space pins the
 * card, "." or Shift+F10 opens the row menu, Esc closes. Page keys: W M Q
 * and [ ] zoom, T today, / find, ? every key. Each has a visible control.
 */

import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  barGeometry,
  DEFAULT_PORTFOLIO_VIEW,
  filterRows,
  GROUP_OPTIONS,
  groupRows,
  milestoneTone,
  OPEN_ENDED_DAYS,
  SORT_OPTIONS,
  sortRows,
  statusFilterParam,
  statusKeyOf,
  type PortfolioGroupBy,
  type PortfolioRow as Row,
  type PortfolioSort,
  type PortfolioViewState,
  type ProjectPortfolio,
  type StatusGroupKey,
} from "@/lib/projects/project-portfolio";
import {
  addDays,
  dayToX,
  formatLongDay,
  pxPerDay,
  timeRange,
  ZOOM_LABELS,
  ZOOMS,
  type Zoom,
} from "@/lib/projects/project-portfolio-scale";
import { PortfolioHoverCard, type CardAnchor } from "./portfolio-hover-card";
import { LEGEND_SCRIPT, PortfolioLegend, useLegendOpen } from "./portfolio-legend";
import { PortfolioMobileList } from "./portfolio-mobile-list";
import { PortfolioRow, type RowHandlers } from "./portfolio-row";
import { PortfolioAnswer, SampleNote, StatusFilterChips } from "./portfolio-summary";
import { PortfolioFilterEmpty } from "./portfolio-empty";
import { RowMenu, type RowMenuEntry, type RowMenuState } from "./row-menu";
import { TimelineCanvas, type TimelineCanvasHandle } from "./timeline-canvas";
import {
  ChevronDown,
  ChevronRight,
  Kbd,
  ShortcutSheet,
  TimelineToasts,
  useHydrated,
  useTimelineKeys,
  useTimelineToasts,
  type ShortcutGroup,
} from "./timeline-ui";
import styles from "./portfolio.module.css";

const SAMPLE_MESSAGE = "Sample project, nothing to open.";
const FIND_THRESHOLD = 12;
const HOVER_INTENT_MS = 250;

const SHORTCUTS: readonly ShortcutGroup[] = [
  {
    title: "Moving around",
    keys: [
      ["Move between rows", ["↑", "↓"]],
      ["Move between rows", ["J", "K"]],
      ["Step through a row's milestones", ["←", "→"]],
      ["First or last row", ["Home", "End"]],
      ["Open the project's timeline", ["Enter"]],
      ["Keep the card open", ["Space"]],
      ["Row actions", ["."]],
      ["Close the card or menu", ["Esc"]],
    ],
  },
  {
    title: "The view",
    keys: [
      ["Weeks, months or quarters", ["W", "M", "Q"]],
      ["Zoom out or in", ["[", "]"]],
      ["Jump to today", ["T"]],
      ["Zoom around the pointer", ["Ctrl", "Scroll"]],
      ["Show these shortcuts", ["?"]],
    ],
  },
];

type Readied = Extract<ProjectPortfolio, { kind: "ready" }>;

type CardState = Readonly<{ rowId: string; anchor: CardAnchor; pinned: boolean }>;

const TONE_WORDS = { done: "done", overdue: "missed", next: "next", upcoming: "coming up" } as const;

function sortedMilestones(row: Row) {
  return [...row.milestones].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

export function PortfolioGantt({
  portfolio,
  openProjectId,
  initialView,
}: {
  portfolio: Readied;
  openProjectId: string | null;
  initialView: PortfolioViewState;
}) {
  const router = useRouter();
  const hydrated = useHydrated();
  const { rows, todayIso } = portfolio;
  const [zoom, setZoom] = useState<Zoom>(initialView.zoom);
  const [group, setGroup] = useState<PortfolioGroupBy>(initialView.group);
  const [sort, setSort] = useState<PortfolioSort>(initialView.sort);
  const [statuses, setStatuses] = useState<ReadonlySet<StatusGroupKey>>(() => new Set(initialView.status));
  const [find, setFind] = useState("");
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(() => new Set(["complete"]));
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [card, setCard] = useState<CardState | null>(null);
  const [menu, setMenu] = useState<RowMenuState | null>(null);
  const [flashId, setFlashId] = useState<string | null>(null);
  const [stepped, setStepped] = useState<{ rowId: string; id: string } | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [canvasW, setCanvasW] = useState(0);
  const [view, setView] = useState<{ left: number; right: number }>({ left: 0, right: 0 });
  const [legendOpen, setLegendOpen] = useLegendOpen();
  const { toasts, show, dismiss } = useTimelineToasts();

  const canvasRef = useRef<TimelineCanvasHandle>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const findRef = useRef<HTMLInputElement>(null);
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pointerX = useRef(0);
  const pendingCentre = useRef<{ day: string; align: number } | null>(null);
  const drag = useRef<{ x: number; left: number; moved: boolean; id: number } | null>(null);
  const suppressClick = useRef(false);
  const wheelAt = useRef(0);
  const cardId = useId();
  const legendId = useId();

  // ── Scale: built from every row, so filters never move a bar ────────────
  const range = useMemo(() => {
    const dates = rows.flatMap((row) => [row.start, row.target, ...row.milestones.map((m) => m.date)]);
    if (rows.some((row) => row.start && !row.target)) dates.push(addDays(todayIso, OPEN_ENDED_DAYS));
    return timeRange(dates, todayIso, zoom);
  }, [rows, todayIso, zoom]);
  // At any zoom the canvas at least fills the frame.
  const ppd = useMemo(() => {
    const base = pxPerDay(zoom);
    return canvasW > 0 ? Math.max(base, canvasW / range.days) : base;
  }, [zoom, canvasW, range.days]);
  const width = range.days * ppd;

  const extents = useMemo(() => {
    const map = new Map<string, { left: number; right: number }>();
    for (const row of rows) {
      const g = barGeometry(row, todayIso);
      if (!g.from || !g.to || g.kind === "target-only") continue;
      const from = g.from < range.start ? range.start : g.from;
      const to = g.to > range.end ? range.end : g.to;
      let right = dayToX(to, range, ppd) + ppd;
      if (g.pastTarget) right = Math.max(right, dayToX(todayIso > range.end ? range.end : todayIso, range, ppd) + ppd);
      map.set(row.id, { left: dayToX(from, range, ppd), right });
    }
    return map;
  }, [ppd, range, rows, todayIso]);

  // ── View state in the URL ────────────────────────────────────────────────
  const syncUrl = useCallback((next: PortfolioViewState) => {
    const url = new URL(window.location.href);
    for (const key of ["zoom", "group", "sort"] as const) {
      if (next[key] === DEFAULT_PORTFOLIO_VIEW[key]) url.searchParams.delete(key);
      else url.searchParams.set(key, next[key]);
    }
    const status = statusFilterParam(next.status);
    if (status) url.searchParams.set("status", status);
    else url.searchParams.delete("status");
    window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
  }, []);
  const viewState = (patch: Partial<PortfolioViewState>): PortfolioViewState => ({
    zoom,
    group,
    sort,
    status: [...statuses],
    ...patch,
  });

  const changeZoom = useCallback(
    (next: Zoom, around?: { day: string; align: number }) => {
      if (next === zoom) return;
      pendingCentre.current = around ?? { day: canvasRef.current?.centreDay() ?? todayIso, align: 0.5 };
      setZoom(next);
      syncUrl({ zoom: next, group, sort, status: [...statuses] });
    },
    [group, sort, statuses, syncUrl, todayIso, zoom],
  );

  const stepZoom = useCallback(
    (direction: -1 | 1, around?: { day: string; align: number }) => {
      const index = ZOOMS.indexOf(zoom);
      // "[" zooms out (towards quarters), "]" zooms in (towards weeks).
      const next = ZOOMS[Math.min(ZOOMS.length - 1, Math.max(0, index - direction))];
      changeZoom(next, around);
    },
    [changeZoom, zoom],
  );

  // After a zoom, the date that was at the centre (or under the pointer) stays put.
  useLayoutEffect(() => {
    const centre = pendingCentre.current;
    if (!centre) return;
    pendingCentre.current = null;
    canvasRef.current?.scrollToDay(centre.day, { align: centre.align });
  }, [ppd]);

  function changeGroup(next: PortfolioGroupBy) {
    setGroup(next);
    syncUrl(viewState({ group: next }));
  }

  function changeSort(next: PortfolioSort) {
    setSort(next);
    syncUrl(viewState({ sort: next }));
  }

  function changeStatuses(next: ReadonlySet<StatusGroupKey>) {
    setStatuses(next);
    syncUrl(viewState({ status: [...next] }));
  }

  function toggleStatus(key: StatusGroupKey) {
    const next = new Set(statuses);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    changeStatuses(next);
  }

  function showAll() {
    setFind("");
    changeStatuses(new Set());
  }

  // ── Rows, groups and focus order ─────────────────────────────────────────
  const filtered = useMemo(() => filterRows(rows, statuses, find), [rows, statuses, find]);
  const groups = useMemo(() => groupRows(sortRows(filtered, sort), group), [filtered, sort, group]);
  const hiddenCount = rows.length - filtered.length;
  const focusKeys = useMemo(() => {
    const keys: string[] = [];
    for (const g of groups) {
      if (group === "status") keys.push(`g:${g.key}`);
      if (group === "none" || !collapsed.has(g.key)) for (const row of g.rows) keys.push(`r:${row.id}`);
    }
    return keys;
  }, [collapsed, group, groups]);
  const defaultKey =
    openProjectId && focusKeys.includes(`r:${openProjectId}`)
      ? `r:${openProjectId}`
      : (focusKeys.find((key) => key.startsWith("r:")) ?? focusKeys[0] ?? null);
  const currentKey = activeKey && focusKeys.includes(activeKey) ? activeKey : defaultKey;
  const rowsById = useMemo(() => new Map(rows.map((row) => [row.id, row])), [rows]);

  // ── Card ─────────────────────────────────────────────────────────────────
  const clearTimers = useCallback(() => {
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    if (closeTimer.current) clearTimeout(closeTimer.current);
    hoverTimer.current = null;
    closeTimer.current = null;
  }, []);

  const anchorFor = useCallback((element: HTMLElement, clientX: number | null, row: Row): CardAnchor => {
    const scroller = canvasRef.current?.element();
    const bounds = scroller?.getBoundingClientRect() ?? element.getBoundingClientRect();
    const left = scroller?.querySelector<HTMLElement>("[data-canvas-left]")?.offsetWidth ?? 0;
    const rect = element.getBoundingClientRect();
    let x = clientX;
    if (x === null) {
      // From the keyboard: the bar's visible start.
      const extent = extents.get(row.id);
      const scrollLeft = scroller?.scrollLeft ?? 0;
      x = extent ? bounds.left + left + Math.max(0, extent.left - scrollLeft) + 24 : bounds.left + left + 24;
    }
    return { rowTop: rect.top, rowBottom: rect.bottom, x, minX: bounds.left + left + 8, maxX: bounds.right - 8 };
  }, [extents]);

  const openCard = useCallback(
    (row: Row, element: HTMLElement, clientX: number | null, pinned = false) => {
      setCard({ rowId: row.id, anchor: anchorFor(element, clientX, row), pinned });
    },
    [anchorFor],
  );

  const closeCard = useCallback(() => {
    clearTimers();
    setCard(null);
  }, [clearTimers]);

  const scheduleClose = useCallback(() => {
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    hoverTimer.current = null;
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => {
      setCard((current) => (current?.pinned ? current : null));
      setHoveredId(null);
    }, 160);
  }, []);

  useEffect(() => clearTimers, [clearTimers]);

  // A pinned card closes on a press anywhere else.
  useEffect(() => {
    if (!card?.pinned) return;
    function onDown(event: PointerEvent) {
      const target = event.target as HTMLElement;
      if (cardRef.current?.contains(target)) return;
      if (target.closest?.(`[data-row-id="${CSS.escape(card!.rowId)}"] [data-canvas-layer]`)) return;
      setCard(null);
    }
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [card]);

  // ── Activation ───────────────────────────────────────────────────────────
  const activate = useCallback(
    (row: Row) => {
      if (suppressClick.current) return;
      if (row.sample) {
        show(SAMPLE_MESSAGE);
        return;
      }
      if (row.href) router.push(row.href);
    },
    [router, show],
  );

  const focusKey = useCallback((key: string) => {
    const el = gridRef.current?.querySelector<HTMLElement>(`[data-focus-key="${CSS.escape(key)}"]`);
    if (!el) return;
    el.focus({ preventScroll: true });
    el.scrollIntoView({ block: "nearest" });
  }, []);

  const rowElement = (id: string) => gridRef.current?.querySelector<HTMLElement>(`[data-row-id="${CSS.escape(id)}"]`) ?? null;

  /** "Show it": reveal, focus and pin one row. */
  const showRow = useCallback(
    (row: Row) => {
      const key = statusKeyOf(row);
      if (!filterRows([row], statuses, find).length) {
        setFind("");
        changeStatuses(new Set());
      }
      if (group === "status" && collapsed.has(key)) {
        setCollapsed((set) => {
          const next = new Set(set);
          next.delete(key);
          return next;
        });
      }
      setActiveKey(`r:${row.id}`);
      setFlashId(row.id);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          focusKey(`r:${row.id}`);
          const extent = extents.get(row.id);
          const scroller = canvasRef.current?.element();
          if (extent && scroller && (extent.right < scroller.scrollLeft || extent.left > scroller.scrollLeft + canvasW)) {
            canvasRef.current?.scrollToDay(todayIso);
          }
          const el = rowElement(row.id);
          if (el) setTimeout(() => openCard(row, el, null, true), 60);
          setTimeout(() => setFlashId(null), 1400);
        });
      });
    },
    // `changeStatuses` reads the current view; it is recreated with it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [canvasW, collapsed, extents, find, focusKey, group, openCard, statuses, todayIso],
  );

  function toggleGroup(key: string) {
    setCollapsed((set) => {
      const next = new Set(set);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  // ── Row menu ─────────────────────────────────────────────────────────────
  const openMenu = useCallback(
    (row: Row, anchor: DOMRect | { x: number; y: number }, returnTo: HTMLElement) => {
      closeCard();
      const items: RowMenuEntry[] = [
        {
          id: "open",
          label: "Open timeline",
          hint: ["Enter"],
          disabled: !row.href,
          onSelect: () => activate(row),
        },
        {
          id: "overview",
          label: "Project overview",
          disabled: !row.overviewHref,
          onSelect: () => row.overviewHref && router.push(row.overviewHref),
        },
        {
          id: "copy",
          label: "Copy link to this view",
          disabled: !row.href,
          onSelect: () => {
            const href = row.href ? new URL(row.href, window.location.origin).toString() : "";
            void navigator.clipboard?.writeText(href).then(
              () => show("Link copied."),
              () => show("Couldn't copy the link. Open the timeline and copy it from the address bar."),
            );
          },
        },
        { id: "sep", separator: true },
        {
          id: "card",
          label: "Keep the card open",
          hint: ["Space"],
          onSelect: () => {
            const el = rowElement(row.id);
            if (el) openCard(row, el, null, true);
          },
        },
      ];
      setMenu({ anchor, items, label: `Actions for ${row.name}`, returnTo });
    },
    [activate, closeCard, openCard, router, show],
  );

  // ── Milestone stepping (← →) ─────────────────────────────────────────────
  function stepMilestone(row: Row, direction: -1 | 1) {
    const list = sortedMilestones(row).filter((m) => m.date >= range.start && m.date <= range.end);
    if (list.length === 0) {
      setAnnouncement(`${row.name} has no milestones on the line.`);
      return;
    }
    const index = stepped?.rowId === row.id ? list.findIndex((m) => m.id === stepped.id) : -1;
    let nextIndex: number;
    if (index === -1) {
      const firstAhead = list.findIndex((m) => m.date >= todayIso);
      nextIndex = direction === 1 ? (firstAhead === -1 ? list.length - 1 : firstAhead) : firstAhead === -1 ? list.length - 1 : Math.max(0, firstAhead - 1);
    } else {
      nextIndex = Math.max(0, Math.min(list.length - 1, index + direction));
    }
    const milestone = list[nextIndex];
    setStepped({ rowId: row.id, id: milestone.id });
    const tone = milestoneTone(row, milestone, todayIso);
    setAnnouncement(`${milestone.title}, ${formatLongDay(milestone.date, todayIso)}, ${TONE_WORDS[tone]}. ${nextIndex + 1} of ${list.length}.`);
    const scroller = canvasRef.current?.element();
    const x = dayToX(milestone.date, range, ppd);
    if (scroller && (x < scroller.scrollLeft + 24 || x > scroller.scrollLeft + canvasW - 24)) {
      canvasRef.current?.scrollToDay(milestone.date, { align: 0.5, smooth: true });
    }
  }

  // ── Grid keys ────────────────────────────────────────────────────────────
  function onGridKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (!currentKey || event.metaKey || event.ctrlKey) return;
    if ((event.target as HTMLElement).closest?.('[role="menu"]')) return;
    const index = focusKeys.indexOf(currentKey);
    const row = currentKey.startsWith("r:") ? rowsById.get(currentKey.slice(2)) : undefined;
    const move = (to: number) => {
      const key = focusKeys[Math.max(0, Math.min(focusKeys.length - 1, to))];
      if (!key) return;
      event.preventDefault();
      setActiveKey(key);
      setStepped(null);
      focusKey(key);
    };
    if (event.key === "F10" && event.shiftKey) {
      if (!row) return;
      event.preventDefault();
      const el = rowElement(row.id);
      if (el) openMenu(row, el.querySelector("[aria-haspopup]")!.getBoundingClientRect(), el);
      return;
    }
    if (event.altKey) return;
    switch (event.key) {
      case "ArrowDown":
      case "j":
      case "J":
        move(index + 1);
        return;
      case "ArrowUp":
      case "k":
      case "K":
        move(index - 1);
        return;
      case "Home":
        move(0);
        return;
      case "End":
        move(focusKeys.length - 1);
        return;
      case "ArrowRight":
      case "ArrowLeft":
        if (!row) return;
        event.preventDefault();
        stepMilestone(row, event.key === "ArrowRight" ? 1 : -1);
        return;
      case "Enter":
        event.preventDefault();
        if (currentKey.startsWith("g:")) toggleGroup(currentKey.slice(2));
        else if (row) activate(row);
        return;
      case " ": {
        event.preventDefault();
        if (currentKey.startsWith("g:")) {
          toggleGroup(currentKey.slice(2));
          return;
        }
        if (!row) return;
        if (card?.rowId === row.id && card.pinned) closeCard();
        else {
          const el = rowElement(row.id);
          if (el) openCard(row, el, null, true);
        }
        return;
      }
      case ".": {
        if (!row) return;
        event.preventDefault();
        const el = rowElement(row.id);
        const button = el?.querySelector<HTMLElement>("[aria-haspopup]");
        if (el && button) openMenu(row, button.getBoundingClientRect(), el);
        return;
      }
      case "Escape":
        if (card) {
          event.preventDefault();
          closeCard();
        }
        return;
    }
  }

  // ── Page keys ────────────────────────────────────────────────────────────
  const showFind = rows.length > FIND_THRESHOLD;
  useTimelineKeys({
    "?": () => setShortcutsOpen(true),
    "[": () => stepZoom(-1),
    "]": () => stepZoom(1),
    w: () => changeZoom("weeks"),
    m: () => changeZoom("months"),
    q: () => changeZoom("quarters"),
    t: () => canvasRef.current?.scrollToDay(todayIso, { smooth: true }),
    "/": showFind ? () => findRef.current?.focus() : undefined,
    Escape: card ? () => closeCard() : undefined,
  });

  // Ctrl or ⌘ plus the wheel zooms around the date under the pointer.
  useEffect(() => {
    const scroller = canvasRef.current?.element();
    if (!scroller) return;
    function onWheel(event: WheelEvent) {
      if (!(event.ctrlKey || event.metaKey)) return;
      event.preventDefault();
      const now = Date.now();
      if (now - wheelAt.current < 220 || Math.abs(event.deltaY) < 2) return;
      wheelAt.current = now;
      const day = canvasRef.current?.dayAtClientX(event.clientX);
      const box = scroller!.getBoundingClientRect();
      const left = scroller!.querySelector<HTMLElement>("[data-canvas-left]")?.offsetWidth ?? 0;
      const span = box.width - left;
      const align = span > 0 ? Math.max(0, Math.min(1, (event.clientX - box.left - left) / span)) : 0.5;
      stepZoom(event.deltaY < 0 ? 1 : -1, day ? { day, align } : undefined);
    }
    scroller.addEventListener("wheel", onWheel, { passive: false });
    return () => scroller.removeEventListener("wheel", onWheel);
  }, [stepZoom]);

  // ── Scroll: which part of time is visible (for the edge chevrons) ───────
  const measureView = useCallback(() => {
    const scroller = canvasRef.current?.element();
    if (!scroller) return;
    const left = scroller.querySelector<HTMLElement>("[data-canvas-left]")?.offsetWidth ?? 0;
    const next = { left: Math.round(scroller.scrollLeft / 4) * 4, right: Math.round((scroller.scrollLeft + scroller.clientWidth - left) / 4) * 4 };
    setView((current) => (current.left === next.left && current.right === next.right ? current : next));
  }, []);

  const onCanvasScroll = useCallback(() => {
    if (card && !card.pinned) setCard(null);
    else if (card?.pinned) {
      const el = rowElement(card.rowId);
      const row = rowsById.get(card.rowId);
      if (el && row) setCard({ ...card, anchor: { ...anchorFor(el, card.anchor.x, row) } });
    }
    requestAnimationFrame(measureView);
  }, [anchorFor, card, measureView, rowsById]);

  const onResize = useCallback(
    (w: number) => {
      setCanvasW(w);
      requestAnimationFrame(measureView);
    },
    [measureView],
  );

  // Arriving from a Project: bring its row into view once, vertically only.
  const didReveal = useRef(false);
  useLayoutEffect(() => {
    if (didReveal.current) return;
    didReveal.current = true;
    const scroller = canvasRef.current?.element();
    const row = scroller?.querySelector<HTMLElement>("[data-open-now]");
    if (scroller && row && row.offsetTop + row.offsetHeight > scroller.clientHeight) {
      scroller.scrollTop = Math.max(0, row.offsetTop - 120);
    }
  }, []);

  // ── Drag to pan ──────────────────────────────────────────────────────────
  function onPointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (event.pointerType !== "mouse" || event.button !== 0) return;
    const target = event.target as HTMLElement;
    if (target.closest('[role="rowheader"], [data-canvas-left], [data-group-cell], button, a')) return;
    const el = canvasRef.current?.element();
    if (!el) return;
    drag.current = { x: event.clientX, left: el.scrollLeft, moved: false, id: event.pointerId };
  }

  function onPointerMove(event: React.PointerEvent<HTMLDivElement>) {
    const state = drag.current;
    const el = canvasRef.current?.element();
    if (!state || !el) return;
    const dx = event.clientX - state.x;
    if (!state.moved && Math.abs(dx) > 4) {
      state.moved = true;
      el.setPointerCapture(state.id);
      el.setAttribute("data-dragging", "");
      clearTimers();
      setCard((current) => (current?.pinned ? current : null));
    }
    if (state.moved) el.scrollLeft = state.left - dx;
  }

  function onPointerUp() {
    const state = drag.current;
    const el = canvasRef.current?.element();
    drag.current = null;
    if (!state?.moved || !el) return;
    el.removeAttribute("data-dragging");
    if (el.hasPointerCapture(state.id)) el.releasePointerCapture(state.id);
    suppressClick.current = true;
    setTimeout(() => {
      suppressClick.current = false;
    }, 0);
  }

  // ── Row handlers (stable for memoised rows) ──────────────────────────────
  const cardRefState = useRef(card);
  useEffect(() => {
    cardRefState.current = card;
  });
  const handlers = useMemo<RowHandlers>(
    () => ({
      onActivate: activate,
      onFocusRow: (key, row, element) => {
        setActiveKey(key);
        if (element.matches(":focus-visible")) {
          clearTimers();
          setHoveredId(row.id);
          if (!cardRefState.current?.pinned) openCard(row, element, null);
        }
      },
      onHover: (row, element, clientX) => {
        pointerX.current = clientX;
        if (drag.current?.moved || menu) return;
        setHoveredId((id) => (id === row.id ? id : row.id));
        const current = cardRefState.current;
        if (current?.pinned) return;
        if (closeTimer.current) {
          clearTimeout(closeTimer.current);
          closeTimer.current = null;
        }
        if (current) {
          if (current.rowId !== row.id) openCard(row, element, clientX);
          return;
        }
        if (hoverTimer.current) return;
        hoverTimer.current = setTimeout(() => {
          hoverTimer.current = null;
          if (!element.isConnected || !element.matches(":hover")) return;
          openCard(row, element, pointerX.current);
        }, HOVER_INTENT_MS);
      },
      onLeave: scheduleClose,
      onPin: (row, element, clientX) => {
        if (suppressClick.current) return;
        const current = cardRefState.current;
        if (current?.pinned && current.rowId === row.id) {
          closeCard();
          return;
        }
        clearTimers();
        openCard(row, element, clientX, true);
      },
      onMenu: openMenu,
      onEdge: (day) => canvasRef.current?.scrollToDay(day, { align: 0.15, smooth: true }),
    }),
    [activate, clearTimers, closeCard, menu, openCard, openMenu, scheduleClose],
  );

  // ── Derived words ────────────────────────────────────────────────────────
  const cardRow = card ? rowsById.get(card.rowId) : undefined;
  const sampleCount = rows.filter((row) => row.sample).length;
  const showMilestones = !portfolio.milestonesUnavailable;
  const statsKnown = !portfolio.statsUnavailable;
  const zoomSegment = (
    <div className={styles.segmented} role="group" aria-label="Zoom">
      {ZOOMS.map((option) => (
        <button
          key={option}
          type="button"
          className={styles.segment}
          aria-pressed={zoom === option}
          onClick={() => changeZoom(option)}
          title={`${ZOOM_LABELS[option]} (${option[0].toUpperCase()})`}
        >
          {ZOOM_LABELS[option]}
        </button>
      ))}
    </div>
  );

  function menuButton(label: string, value: string, options: readonly { value: string; label: string }[], onPick: (value: string) => void) {
    return (
      <button
        type="button"
        className={styles.menuButton}
        aria-haspopup="menu"
        onClick={(event) => {
          const button = event.currentTarget;
          setMenu({
            anchor: button.getBoundingClientRect(),
            label,
            returnTo: button,
            items: options.map((option) => ({
              id: option.value,
              label: option.label,
              current: option.value === value,
              onSelect: () => onPick(option.value),
            })),
          });
        }}
      >
        <span className={styles.menuButtonLabel}>{label}</span>
        {options.find((option) => option.value === value)?.label}
        <ChevronDown size={13} className={styles.menuButtonChevron} />
      </button>
    );
  }

  return (
    <>
      <div className={styles.column}>
        <PortfolioAnswer rows={rows} todayIso={todayIso} statsKnown={statsKnown} onShow={showRow} />

        <div className={styles.chipRow}>
          {statsKnown ? <StatusFilterChips rows={rows} selected={statuses} onToggle={toggleStatus} /> : <span />}
          {portfolio.sample ? <SampleNote count={sampleCount} /> : null}
        </div>

        {!statsKnown ? (
          <p className={styles.notice} role="status">
            Progress and dates couldn&apos;t be loaded, so bars show as plain tracks.
            <button type="button" className={styles.linkButton} onClick={() => router.refresh()}>
              Try again
            </button>
          </p>
        ) : null}

        <div className={`${styles.toolbar} ${styles.desktopOnly}`} role="toolbar" aria-label="View">
          <div className={styles.toolbarGroup}>
            {menuButton("Group", group, GROUP_OPTIONS, (value) => changeGroup(value as PortfolioGroupBy))}
            {menuButton("Sort", sort, SORT_OPTIONS, (value) => changeSort(value as PortfolioSort))}
            {showFind ? (
              <label className={styles.find}>
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                  <circle cx="7" cy="7" r="4.5" stroke="currentColor" strokeWidth="1.5" />
                  <path d="m10.5 10.5 3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
                <span className="sr-only">Find a project</span>
                <input
                  ref={findRef}
                  className={styles.findInput}
                  value={find}
                  placeholder="Find a project"
                  onChange={(event) => setFind(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Escape") {
                      event.preventDefault();
                      if (find) setFind("");
                      else event.currentTarget.blur();
                    }
                  }}
                />
                <Kbd>/</Kbd>
              </label>
            ) : null}
            {portfolio.milestonesUnavailable ? <span className={styles.toolbarNote}>Milestones couldn&apos;t be loaded.</span> : null}
          </div>
          <div className={styles.toolbarGroup}>
            <button
              type="button"
              className={styles.quiet}
              aria-expanded={legendOpen}
              aria-controls={legendId}
              aria-label="How to read this"
              onClick={() => setLegendOpen(!legendOpen)}
              data-legend-toggle=""
            >
              <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <circle cx="8" cy="8" r="6.25" stroke="currentColor" strokeWidth="1.4" />
                <path d="M6.3 6.2a1.8 1.8 0 1 1 2.5 1.7c-.5.2-.8.6-.8 1.1v.4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                <circle cx="8" cy="11.4" r="0.85" fill="currentColor" />
              </svg>
              <span className={styles.quietLabel}>How to read this</span>
            </button>
            <button type="button" className={styles.iconButton} onClick={() => setShortcutsOpen(true)} aria-label="Keyboard shortcuts" title="Keyboard shortcuts (?)">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <rect x="1.75" y="3.75" width="12.5" height="8.5" rx="1.75" stroke="currentColor" strokeWidth="1.3" />
                <path d="M4.5 6.5h.01M7 6.5h.01M9.5 6.5h.01M12 6.5h.01M5.5 9.5h5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
              </svg>
            </button>
            {zoomSegment}
            <button type="button" className={styles.button} onClick={() => canvasRef.current?.scrollToDay(todayIso, { smooth: true })} title="Today (T)">
              Today
            </button>
          </div>
        </div>

        {!hydrated ? <script dangerouslySetInnerHTML={{ __html: LEGEND_SCRIPT }} /> : null}
        <div className={`${styles.legendWrap} ${styles.desktopOnly}`} data-open={legendOpen ? "" : undefined}>
          {legendOpen ? <PortfolioLegend id={legendId} milestonesUnavailable={portfolio.milestonesUnavailable} /> : null}
        </div>
      </div>

      {/* Desktop and tablet: the grid on the shared canvas. */}
      <div className={`${styles.gridFrame} ${styles.desktopOnly}`}>
        {groups.length === 0 ? (
          <PortfolioFilterEmpty find={find} onShowAll={showAll} onClear={() => setFind("")} />
        ) : (
          <TimelineCanvas
            ref={canvasRef}
            range={range}
            ppd={ppd}
            zoom={zoom}
            todayIso={todayIso}
            className={styles.canvasFrame}
            scrollerClassName={styles.scroller}
            headLeft={<span className={styles.headLeftLabel}>Project</span>}
            onScroll={onCanvasScroll}
            onResize={onResize}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
          >
            <div
              ref={gridRef}
              role="grid"
              aria-label="All projects on one time scale"
              aria-rowcount={focusKeys.length}
              className={styles.grid}
              onKeyDown={onGridKeyDown}
              onBlur={(event) => {
                const next = event.relatedTarget as Node | null;
                if (next && (gridRef.current?.contains(next) || cardRef.current?.contains(next))) return;
                if (!card?.pinned) setCard(null);
                setStepped(null);
              }}
            >
              {groups.map((g) => {
                const isCollapsed = group === "status" && collapsed.has(g.key);
                return (
                  <div key={g.key} role="rowgroup" className={styles.rowGroup}>
                    {group === "status" ? (
                      <div
                        role="row"
                        tabIndex={currentKey === `g:${g.key}` ? 0 : -1}
                        aria-expanded={!isCollapsed}
                        aria-label={`${g.label}, ${g.rows.length === 1 ? "1 project" : `${g.rows.length} projects`}`}
                        data-focus-key={`g:${g.key}`}
                        className={styles.groupRow}
                        onFocus={(event) => {
                          if (event.target !== event.currentTarget) return;
                          setActiveKey(`g:${g.key}`);
                          if (!card?.pinned) setCard(null);
                        }}
                      >
                        <div role="gridcell" className={styles.groupCell} data-group-cell="">
                          <button type="button" tabIndex={-1} className={styles.groupToggle} aria-expanded={!isCollapsed} onClick={() => toggleGroup(g.key)}>
                            <ChevronRight size={12} className={styles.groupChevron} />
                            {g.label}
                            <span className={styles.groupCount}>· {g.rows.length}</span>
                          </button>
                        </div>
                      </div>
                    ) : null}
                    <div className={styles.groupBody} data-collapsed={isCollapsed ? "" : undefined} inert={isCollapsed}>
                      <div className={styles.groupBodyInner}>
                        {g.rows.map((row) => {
                          const key = `r:${row.id}`;
                          const extent = extents.get(row.id);
                          const clipLeft = Boolean(extent && extent.left < view.left - 1 && extent.right > view.left + 24);
                          const clipRight = Boolean(extent && extent.right > view.right + 1 && extent.left < view.right - 24);
                          return (
                            <PortfolioRow
                              key={row.id}
                              row={row}
                              focusKey={key}
                              active={currentKey === key}
                              openNow={row.id === openProjectId}
                              hovered={hoveredId === row.id}
                              flash={flashId === row.id}
                              pinned={card?.pinned === true && card.rowId === row.id}
                              describedBy={card && !card.pinned && card.rowId === row.id ? cardId : undefined}
                              range={range}
                              ppd={ppd}
                              width={width}
                              todayIso={todayIso}
                              showMilestones={showMilestones}
                              clipLeft={clipLeft}
                              clipRight={clipRight}
                              viewLeft={clipLeft || clipRight ? view.left : 0}
                              viewRight={clipLeft || clipRight ? view.right : 0}
                              steppedId={stepped?.rowId === row.id ? stepped.id : null}
                              handlers={handlers}
                            />
                          );
                        })}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </TimelineCanvas>
        )}
      </div>

      {/* Phone: cards on one shared window. */}
      <div className={styles.phoneOnly}>
        <PortfolioMobileList
          groups={groups}
          groupBy={group}
          sort={sort}
          zoom={zoom}
          todayIso={todayIso}
          openProjectId={openProjectId}
          showMilestones={showMilestones}
          onZoom={changeZoom}
          onGroup={changeGroup}
          onSort={changeSort}
          onActivate={activate}
          onShowAll={showAll}
          collapsed={collapsed}
          onToggleGroup={toggleGroup}
        />
      </div>

      <div className={`${styles.column} ${styles.footer}`}>
        {hiddenCount > 0 && groups.length > 0 ? (
          <p className={styles.footLine}>
            {hiddenCount === 1 ? "1 project hidden by filters." : `${hiddenCount} projects hidden by filters.`}
            <button type="button" className={styles.linkButton} onClick={showAll}>
              Show all
            </button>
          </p>
        ) : null}
        {rows.length === 1 && !portfolio.sample ? (
          <div className={styles.guide}>
            <p>Add another project to see them side by side.</p>
            <Link href="/app/project" className={styles.button}>
              Create a project
            </Link>
          </div>
        ) : null}
        {portfolio.truncated ? (
          <p className={styles.footLine}>
            Showing the first 200 projects.
            <Link href="/app/project" className={styles.linkButton}>
              Open Projects
            </Link>
          </p>
        ) : null}
        {portfolio.archived.length > 0 ? (
          <details className={styles.archived}>
            <summary className={styles.archivedSummary}>
              <ChevronRight size={12} className={styles.archivedChevron} />
              {portfolio.archived.length === 1 ? "1 archived project" : `${portfolio.archived.length} archived projects`}
            </summary>
            <ul className={styles.archivedList}>
              {portfolio.archived.map((row) =>
                row.overviewHref ? (
                  <li key={row.id}>
                    <Link href={row.overviewHref} className={styles.archivedRow}>
                      <span className={styles.tile} data-archived="" aria-hidden="true">
                        {row.monogram}
                      </span>
                      <span className={styles.archivedName}>{row.name}</span>
                      <span className={styles.archivedNote}>Read only</span>
                    </Link>
                  </li>
                ) : null,
              )}
            </ul>
          </details>
        ) : null}
        {portfolio.sample ? (
          <p className={`${styles.footLine} ${styles.phoneOnly}`}>
            <SampleNote count={sampleCount} />
          </p>
        ) : null}
      </div>

      {cardRow && card && typeof document !== "undefined"
        ? createPortal(
          <PortfolioHoverCard
            ref={cardRef}
            id={cardId}
            row={cardRow}
            todayIso={todayIso}
            anchor={card.anchor}
            pinned={card.pinned}
            onPointerEnter={clearTimers}
            onPointerLeave={() => {
              if (!card.pinned) scheduleClose();
            }}
            onClose={closeCard}
          />,
          document.body,
        )
        : null}

      <p className="sr-only" role="status" aria-live="polite">
        {announcement}
      </p>
      <RowMenu state={menu} onClose={() => setMenu(null)} />
      <ShortcutSheet
        open={shortcutsOpen}
        onClose={() => setShortcutsOpen(false)}
        groups={
          showFind
            ? [SHORTCUTS[0], { ...SHORTCUTS[1], keys: [...SHORTCUTS[1].keys.slice(0, 3), ["Find a project", ["/"]], ...SHORTCUTS[1].keys.slice(3)] }]
            : SHORTCUTS
        }
      />
      <TimelineToasts toasts={toasts} onDismiss={dismiss} />
    </>
  );
}
