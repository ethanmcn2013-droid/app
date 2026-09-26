"use client";

/**
 * Pointer drag for the board, with no dependency.
 *
 * - Mouse: the card lifts after 4px of movement. Touch: after a 300ms press
 *   and hold; a finger that moves first is scrolling, never hijacked.
 * - At lift every lane and card is measured once into a cache. A pointer
 *   move reads only the cache and writes one transform per frame; the cache
 *   follows the track and lane scroll offsets from their scroll events, so
 *   there are no layout reads while the card is moving.
 * - Siblings slide aside with transforms in the source and target columns
 *   only; a placeholder the size of the card shows where it will land.
 * - Near an edge (64px) the board and the column scroll, faster the deeper
 *   the pointer goes. On a phone, holding a card at the screen edge for
 *   400ms pages to the next column.
 * - Dropping where it started is a non-event. Everything is removed under
 *   reduced motion except the placeholder and the shadow.
 */

import { useEffect, useState } from "react";

export type DropTarget = { lane: string; index: number };

type CardCache = { id: string; el: HTMLElement; top: number; height: number; collapsedTop: number };
type LaneCache = {
  key: string;
  el: HTMLElement;
  body: HTMLElement;
  layer: HTMLElement | null;
  left: number;
  right: number;
  top: number;
  bottom: number;
  bodyTop: number;
  bodyBottom: number;
  scroll: number;
  padTop: number;
  cards: CardCache[];
  collapsed: boolean;
};

type Session = {
  id: string;
  pointerId: number;
  touch: boolean;
  startX: number;
  startY: number;
  lifted: boolean;
  timer: number;
  card: HTMLElement;
  cardRect: DOMRect;
  offsetX: number;
  offsetY: number;
  ghost: HTMLElement | null;
  lanes: LaneCache[];
  track: HTMLElement | null;
  trackLeft: number;
  trackRight: number;
  trackScroll0: number;
  trackScroll: number;
  sourceLane: string;
  sourceIndex: number;
  height: number;
  gap: number;
  target: DropTarget | null;
  x: number;
  y: number;
  vx: number;
  tilt: number;
  frame: number;
  dwellSince: number;
  placeholder: HTMLElement | null;
  shifted: Set<HTMLElement>;
  scrollHandlers: Array<() => void>;
  touchBlock: ((event: TouchEvent) => void) | null;
};

const REDUCED = () => typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
const EDGE = 64;

/** Where a placeholder at `index` starts, in the column's content space. */
function slotTop(s: Session, lane: LaneCache, index: number): number {
  const before = lane.cards[index];
  if (before) return before.collapsedTop;
  const last = lane.cards[lane.cards.length - 1];
  return last ? last.collapsedTop + last.height + s.gap : lane.padTop;
}

type DragOptions = {
  root: React.RefObject<HTMLElement | null>;
  enabled: boolean;
  ghostClass: string;
  slotClass: string;
  onLift: (id: string) => void;
  /** Called with where the card was dropped and where its ghost is. */
  onDrop: (id: string, target: DropTarget, ghost: DOMRect) => void;
  onCancel: () => void;
};

/**
 * The controller lives outside React: it is created once per board and
 * reads the latest options at event time, so a pointer move never waits on
 * a render and no callback identity churns while a card is in the air.
 */
function createDragController(initial: DragOptions) {
  let current = initial;
  const opts = () => current;
  const session: { current: Session | null } = { current: null };
  const suppressClickUntil = { current: 0 };

  /* ── measuring (only at lift and on scroll) ───────────────────────── */
  const measure = (s: Session) => {
    const node = opts().root.current;
    if (!node) return;
    const track = node.querySelector<HTMLElement>("[data-board]");
    s.track = track;
    if (track) {
      const box = track.getBoundingClientRect();
      s.trackLeft = box.left;
      s.trackRight = box.right;
      s.trackScroll0 = track.scrollLeft;
      s.trackScroll = track.scrollLeft;
    }
    s.lanes = [...node.querySelectorAll<HTMLElement>("[data-lane]")].map((lane) => {
      const body = lane.querySelector<HTMLElement>("[data-tray-body]") ?? lane;
      const laneBox = lane.getBoundingClientRect();
      const bodyBox = body.getBoundingClientRect();
      const scroll = body.scrollTop;
      const cards: CardCache[] = [];
      let passedSource = false;
      body.querySelectorAll<HTMLElement>(":scope > [data-id], :scope > [data-card-wrap] > [data-id]").forEach((card) => {
        if (card.dataset.id === s.id) {
          passedSource = true;
          return;
        }
        const box = card.getBoundingClientRect();
        const top = box.top - bodyBox.top + scroll;
        cards.push({
          id: card.dataset.id!,
          el: card,
          top,
          height: box.height,
          collapsedTop: passedSource && lane.dataset.lane === s.sourceLane ? top - (s.height + s.gap) : top,
        });
      });
      const padTop = parseFloat(getComputedStyle(body).paddingTop) || 0;
      return {
        key: lane.dataset.lane!,
        el: lane,
        body,
        layer: lane.querySelector<HTMLElement>("[data-drop-layer]"),
        left: laneBox.left,
        right: laneBox.right,
        top: laneBox.top,
        bottom: laneBox.bottom,
        bodyTop: bodyBox.top,
        bodyBottom: bodyBox.bottom,
        scroll,
        padTop,
        cards,
        collapsed: lane.hasAttribute("data-collapsed"),
      };
    });
  };

  /* ── where would it land ──────────────────────────────────────────── */
  const hitTest = (s: Session): DropTarget | null => {
    const dx = s.trackScroll - s.trackScroll0;
    const lane = s.lanes.find((l) => s.x >= l.left - dx && s.x <= l.right - dx && s.y >= l.top - 24 && s.y <= l.bottom + 400);
    if (!lane) return null;
    if (lane.collapsed) return { lane: lane.key, index: lane.cards.length };
    // Where the carried card's centre is, in the column's content space. The
    // landing slot is the one whose centre is nearest: robust to cards of
    // different heights, and exact at the origin, so a card put back where
    // it started is recognised as not moved.
    const centre = s.y - s.offsetY + s.height / 2 - lane.bodyTop + lane.scroll;
    let index = 0;
    let best = Number.POSITIVE_INFINITY;
    for (let i = 0; i <= lane.cards.length; i += 1) {
      const top = slotTop(s, lane, i);
      const distance = Math.abs(centre - (top + s.height / 2));
      if (distance < best) {
        best = distance;
        index = i;
      }
    }
    return { lane: lane.key, index };
  };

  /* ── paint the target: siblings aside, placeholder in place ───────── */
  const paintTarget = (s: Session) => {
    const reduced = REDUCED();
    const next = new Set<HTMLElement>();
    const shift = s.height + s.gap;
    for (const lane of s.lanes) {
      const isSource = lane.key === s.sourceLane;
      const isTarget = s.target?.lane === lane.key;
      if (!isSource && !isTarget) continue;
      lane.cards.forEach((card, index) => {
        const push = isTarget && s.target && index >= s.target.index ? shift : 0;
        const offset = card.collapsedTop + push - card.top;
        if (Math.abs(offset) < 0.5) return;
        next.add(card.el);
        card.el.style.transition = reduced ? "none" : "transform 160ms var(--v3-ease)";
        card.el.style.transform = `translate3d(0, ${offset}px, 0)`;
      });
    }
    s.shifted.forEach((el) => {
      if (next.has(el)) return;
      el.style.transition = REDUCED() ? "none" : "transform 160ms var(--v3-ease)";
      el.style.transform = "";
    });
    s.shifted = next;

    s.placeholder?.remove();
    s.placeholder = null;
    // The target lane grows by one card so the slid-down siblings stay in
    // view; a write only when the target lane changes, never per move.
    s.lanes.forEach((lane) => {
      const isTarget = lane.key === s.target?.lane && lane.key !== s.sourceLane;
      lane.el.toggleAttribute("data-drop-target", lane.key === s.target?.lane);
      lane.body.style.paddingBottom = isTarget ? `calc(4px + ${shift}px)` : "";
    });
    if (!s.target) return;
    const lane = s.lanes.find((l) => l.key === s.target!.lane);
    if (!lane || lane.collapsed || !lane.layer) return;
    const top = slotTop(s, lane, s.target.index);
    const slot = document.createElement("div");
    slot.className = opts().slotClass;
    slot.setAttribute("aria-hidden", "true");
    slot.style.top = `${top}px`;
    slot.style.height = `${s.height}px`;
    lane.layer.appendChild(slot);
    s.placeholder = slot;
  };

  /* ── the frame loop: ghost, edge scroll, dwell ────────────────────── */
  const tick = () => {
    const s = session.current;
    if (!s || !s.lifted) return;
    const reduced = REDUCED();
    if (s.ghost) {
      const x = s.x - s.offsetX - s.cardRect.left;
      const y = s.y - s.offsetY - s.cardRect.top;
      s.tilt += (Math.max(-1, Math.min(1, s.vx * 0.08)) - s.tilt) * 0.2;
      s.ghost.style.transform = reduced
        ? `translate3d(${x}px, ${y}px, 0)`
        : `translate3d(${x}px, ${y}px, 0) rotate(${s.tilt.toFixed(2)}deg) scale(1.02)`;
    }
    // Horizontal edge scroll on the board track.
    const track = s.track;
    if (track) {
      const leftDepth = s.trackLeft + EDGE - s.x;
      const rightDepth = s.x - (s.trackRight - EDGE);
      const speed = leftDepth > 0 ? -Math.min(1, leftDepth / EDGE) * 18 : rightDepth > 0 ? Math.min(1, rightDepth / EDGE) * 18 : 0;
      if (speed) track.scrollLeft += speed;
      // Phone: hold at the very edge to page one column over.
      if (s.touch && (s.x < 24 || s.x > window.innerWidth - 24)) {
        if (!s.dwellSince) s.dwellSince = performance.now();
        else if (performance.now() - s.dwellSince > 400) {
          const width = s.lanes[0] ? s.lanes[0].right - s.lanes[0].left : 280;
          track.scrollBy({ left: s.x < 24 ? -width : width, behavior: reduced ? "auto" : "smooth" });
          s.dwellSince = performance.now() + 400;
        }
      } else {
        s.dwellSince = 0;
      }
    }
    // Vertical edge scroll inside the column under the pointer.
    const dx = s.trackScroll - s.trackScroll0;
    const lane = s.lanes.find((l) => s.x >= l.left - dx && s.x <= l.right - dx);
    if (lane && !lane.collapsed) {
      const upDepth = lane.bodyTop + EDGE - s.y;
      const downDepth = s.y - (lane.bodyBottom - EDGE);
      const speed = upDepth > 0 ? -Math.min(1, upDepth / EDGE) * 14 : downDepth > 0 ? Math.min(1, downDepth / EDGE) * 14 : 0;
      if (speed) lane.body.scrollTop += speed;
    }
    const next = hitTest(s);
    if (next?.lane !== s.target?.lane || next?.index !== s.target?.index) {
      s.target = next;
      paintTarget(s);
    }
    s.frame = requestAnimationFrame(tick);
  };

  const cleanup = (s: Session, keepGhost = false) => {
    cancelAnimationFrame(s.frame);
    window.clearTimeout(s.timer);
    s.scrollHandlers.forEach((off) => off());
    if (s.touchBlock) document.removeEventListener("touchmove", s.touchBlock);
    s.placeholder?.remove();
    s.shifted.forEach((el) => {
      el.style.transition = "none";
      el.style.transform = "";
    });
    s.lanes.forEach((lane) => {
      lane.el.removeAttribute("data-drop-target");
      lane.body.style.paddingBottom = "";
    });
    s.card.removeAttribute("data-dragging");
    if (!keepGhost) s.ghost?.remove();
    if (s.track) s.track.style.scrollSnapType = "";
    opts().root.current?.removeAttribute("data-dragging");
    session.current = null;
  };

  const lift = (s: Session) => {
    s.lifted = true;
    const rect = s.card.getBoundingClientRect();
    s.cardRect = rect;
    s.height = rect.height;
    const body = s.card.parentElement;
    s.gap = body ? parseFloat(getComputedStyle(body).rowGap || "0") || 8 : 8;
    const lane = s.card.closest<HTMLElement>("[data-lane]");
    s.sourceLane = lane?.dataset.lane ?? "";
    const siblings = lane ? [...lane.querySelectorAll<HTMLElement>("[data-tray-body] [data-id]")] : [];
    s.sourceIndex = Math.max(0, siblings.indexOf(s.card));
    measure(s);
    s.target = { lane: s.sourceLane, index: s.sourceIndex };

    const ghost = s.card.cloneNode(true) as HTMLElement;
    ghost.classList.add(opts().ghostClass);
    ghost.removeAttribute("id");
    ghost.removeAttribute("data-id");
    ghost.setAttribute("aria-hidden", "true");
    ghost.style.left = `${rect.left}px`;
    ghost.style.top = `${rect.top}px`;
    ghost.style.width = `${rect.width}px`;
    ghost.style.height = `${rect.height}px`;
    document.body.appendChild(ghost);
    s.ghost = ghost;
    s.card.setAttribute("data-dragging", "");
    opts().root.current?.setAttribute("data-dragging", "");
    // Snap re-snaps every nudge, so it stands down for the gesture.
    if (s.track) s.track.style.scrollSnapType = "none";

    // Scroll only moves the cache, it never re-reads layout per move.
    const onTrackScroll = () => {
      if (s.track) s.trackScroll = s.track.scrollLeft;
    };
    s.track?.addEventListener("scroll", onTrackScroll, { passive: true });
    s.scrollHandlers.push(() => s.track?.removeEventListener("scroll", onTrackScroll));
    s.lanes.forEach((lane) => {
      const onScroll = () => {
        lane.scroll = lane.body.scrollTop;
      };
      lane.body.addEventListener("scroll", onScroll, { passive: true });
      s.scrollHandlers.push(() => lane.body.removeEventListener("scroll", onScroll));
    });
    if (s.touch) {
      s.touchBlock = (event: TouchEvent) => event.preventDefault();
      document.addEventListener("touchmove", s.touchBlock, { passive: false });
    }
    paintTarget(s);
    opts().onLift(s.id);
    s.frame = requestAnimationFrame(tick);
  };

  const onPointerDown = (event: React.PointerEvent<HTMLElement>, id: string) => {
      if (!opts().enabled || event.button !== 0 || session.current) return;
      const target = event.target as HTMLElement;
      if (target.closest("[data-act], input, textarea, a, [contenteditable='true']")) return;
      const card = event.currentTarget;
      const touch = event.pointerType === "touch";
      const s: Session = {
        id,
        pointerId: event.pointerId,
        touch,
        startX: event.clientX,
        startY: event.clientY,
        lifted: false,
        timer: 0,
        card,
        cardRect: card.getBoundingClientRect(),
        offsetX: 0,
        offsetY: 0,
        ghost: null,
        lanes: [],
        track: null,
        trackLeft: 0,
        trackRight: 0,
        trackScroll0: 0,
        trackScroll: 0,
        sourceLane: "",
        sourceIndex: 0,
        height: 0,
        gap: 8,
        target: null,
        x: event.clientX,
        y: event.clientY,
        vx: 0,
        tilt: 0,
        frame: 0,
        dwellSince: 0,
        placeholder: null,
        shifted: new Set(),
        scrollHandlers: [],
        touchBlock: null,
      };
      s.offsetX = event.clientX - s.cardRect.left;
      s.offsetY = event.clientY - s.cardRect.top;
      session.current = s;
      if (touch) {
        s.timer = window.setTimeout(() => {
          if (session.current !== s) return;
          lift(s);
        }, 300);
      }

      const onMove = (move: PointerEvent) => {
        if (move.pointerId !== s.pointerId || session.current !== s) return;
        s.vx = move.clientX - s.x;
        s.x = move.clientX;
        s.y = move.clientY;
        if (!s.lifted) {
          const distance = Math.hypot(move.clientX - s.startX, move.clientY - s.startY);
          if (touch) {
            if (distance > 8) {
              window.clearTimeout(s.timer);
              end();
            }
            return;
          }
          if (distance > 4) {
            try {
              card.setPointerCapture(s.pointerId);
            } catch {
              /* capture is a nicety */
            }
            lift(s);
          }
        }
      };
      const onUp = (up: PointerEvent) => {
        if (up.pointerId !== s.pointerId || session.current !== s) return;
        if (!s.lifted) {
          end();
          return;
        }
        suppressClickUntil.current = performance.now() + 400;
        const origin = { lane: s.sourceLane, index: s.sourceIndex };
        const target = s.target;
        const ghostRect = s.ghost?.getBoundingClientRect() ?? s.cardRect;
        if (!target || (target.lane === origin.lane && target.index === origin.index)) {
          settleBack(s);
          end();
          return;
        }
        const ghost = s.ghost;
        // The move measures the siblings where they visibly are (still
        // shifted), then the shift is cleared before React paints, so the
        // settle is one continuous movement rather than a jump back.
        session.current = null;
        opts().onDrop(s.id, target, ghostRect);
        session.current = s;
        cleanup(s, true);
        ghost?.remove();
        detach();
      };
      const onCancel = (cancel: PointerEvent) => {
        if (cancel.pointerId !== s.pointerId || session.current !== s) return;
        if (s.lifted) settleBack(s);
        end();
      };
      const onKey = (key: KeyboardEvent) => {
        if (key.key !== "Escape" || session.current !== s || !s.lifted) return;
        key.preventDefault();
        key.stopPropagation();
        settleBack(s);
        end();
      };
      const detach = () => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        window.removeEventListener("pointercancel", onCancel);
        window.removeEventListener("keydown", onKey, true);
      };
      const end = () => {
        const wasLifted = s.lifted;
        if (session.current === s) cleanup(s);
        detach();
        if (wasLifted) opts().onCancel();
      };
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
      window.addEventListener("pointercancel", onCancel);
      window.addEventListener("keydown", onKey, true);
  };

  /** Put the ghost back where the card came from, then let it go. */
  const settleBack = (s: Session) => {
    const ghost = s.ghost;
    if (!ghost) return;
    s.ghost = null;
    if (REDUCED()) {
      ghost.remove();
      return;
    }
    ghost.style.transition = "transform 180ms var(--v3-ease)";
    ghost.style.transform = "translate3d(0, 0, 0)";
    window.setTimeout(() => ghost.remove(), 200);
  };

  return {
    onPointerDown,
    /** True for a moment after a drag, so the drop does not also open the card. */
    justDragged: () => performance.now() < suppressClickUntil.current,
    dragging: () => Boolean(session.current?.lifted),
    /** The board's latest options, handed over after each render. */
    setOptions: (next: DragOptions) => {
      current = next;
    },
    dispose: () => {
      if (session.current) cleanup(session.current);
    },
  };
}

export function useBoardDrag(options: DragOptions) {
  const [controller] = useState(() => createDragController(options));
  useEffect(() => {
    controller.setOptions(options);
  });
  useEffect(() => () => controller.dispose(), [controller]);
  return controller;
}
