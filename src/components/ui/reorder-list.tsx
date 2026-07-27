"use client";

/**
 * ReorderList — the suite's drag-to-reorder primitive (Delight Layer Phase 2).
 *
 * Adapted from the component-lab Drag-to-Reorder List and re-skinned to the
 * Signal Studio design system: light-locked (paper + ink + one indigo),
 * Geist, DS tokens, calm springs that honour prefers-reduced-motion.
 *
 * Three motion systems, all driven through motion values so they never fight
 * over a transform:
 *   1. the dragged row follows the pointer RAW (jump(), no easing — any easing
 *      reads as lag);
 *   2. displaced siblings glide exactly one slot (animate(), retargetable);
 *   3. the drop is a FLIP — capture First rects, let React reflow, invert to
 *      the old pixels, then animate home. Nothing jumps.
 *
 * Plus rubber-banding past the ends, pointer capture, and a full keyboard path
 * (grip → Space grabs → arrows move → Escape cancels) narrated to a live
 * region. Controlled only: the parent owns `items` and persists `onReorder`.
 * Each row owns its own y MotionValue (registered up to the list), so nothing
 * touches a ref during render. The row's content is a render prop.
 */

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  MotionConfig,
  animate,
  motion,
  useReducedMotion,
  motionValue,
  type MotionValue,
} from "motion/react";

const DRAG_THRESHOLD = 4;
const EASE = [0.22, 1, 0.36, 1] as const;
const MOVE = { duration: 0.2, ease: EASE } as const;
const LIFT = { duration: 0.16, ease: EASE } as const;

export interface ReorderRow {
  id: string;
  /** Plain-text label for the accessible grip + live-region narration. */
  label: string;
}

interface DragData {
  row: HTMLLIElement;
  pointerId: number;
  index: number;
  startY: number;
  active: boolean;
  slot: number;
  to: number;
  rows?: HTMLLIElement[];
}

export function ReorderList<T extends ReorderRow>({
  items,
  onReorder,
  renderItem,
  ariaLabel,
  className = "",
}: {
  items: T[];
  /** Called with the settled order after a drag or keyboard move. */
  onReorder: (next: T[], moved: { id: string; from: number; to: number }) => void;
  renderItem: (item: T, index: number) => ReactNode;
  ariaLabel: string;
  className?: string;
}) {
  const [dragging, setDragging] = useState<{ id: string; from: number } | null>(null);
  const [grabbed, setGrabbed] = useState<{ id: string; from: number } | null>(null);
  const [announce, setAnnounce] = useState("");

  const listRef = useRef<HTMLUListElement>(null);
  const flipRectsRef = useRef<Map<string, DOMRect> | null>(null);
  const dragRef = useRef<DragData | null>(null);
  const grabSnapshotRef = useRef<T[] | null>(null);
  const justDraggedRef = useRef(false);
  // Each Row registers its own y MotionValue here; the list only reads this
  // map inside effects and handlers, never during render.
  const yMapRef = useRef(new Map<string, MotionValue<number>>());
  const reduced = useReducedMotion();

  const registerY = (id: string, mv: MotionValue<number>) => yMapRef.current.set(id, mv);
  const unregisterY = (id: string) => yMapRef.current.delete(id);
  const yFor = (id: string) => yMapRef.current.get(id);

  const rowNodes = () => [
    ...(listRef.current?.querySelectorAll<HTMLLIElement>("[data-reorder-item]") ?? []),
  ];
  const glide = (id: string, to: number) => {
    const mv = yFor(id);
    if (!mv) return;
    if (!reduced) animate(mv, to, MOVE);
    else mv.jump(to);
  };

  // FLIP after any commit that captured First rects.
  useLayoutEffect(() => {
    const prev = flipRectsRef.current;
    flipRectsRef.current = null;
    const list = listRef.current;
    if (!prev || !list) return;
    const rows = rowNodes();
    for (const row of rows) yFor(row.dataset.id!)?.jump(0);
    void list.offsetWidth;
    if (!reduced) {
      for (const row of rows) {
        const before = prev.get(row.dataset.id!);
        if (!before) continue;
        const dy = before.top - row.getBoundingClientRect().top;
        if (dy) {
          const mv = yFor(row.dataset.id!);
          if (!mv) continue;
          mv.jump(dy);
          animate(mv, 0, MOVE);
        }
      }
    }
  }, [items, reduced]);

  function moveItem(list: T[], from: number, to: number) {
    const next = [...list];
    const [picked] = next.splice(from, 1);
    next.splice(to, 0, picked);
    return next;
  }

  function commitOrder(from: number, to: number) {
    const list = listRef.current;
    if (!list) return;
    const rects = new Map<string, DOMRect>();
    for (const row of rowNodes()) rects.set(row.dataset.id!, row.getBoundingClientRect());
    flipRectsRef.current = rects;
    const moved = items[from];
    onReorder(moveItem(items, from, to), { id: moved.id, from, to });
  }

  function handlePointerDown(event: React.PointerEvent<HTMLLIElement>, index: number) {
    if (dragRef.current) return;
    if (event.button !== undefined && event.button !== 0) return;
    const row = event.currentTarget;
    row.setPointerCapture(event.pointerId);
    dragRef.current = { row, pointerId: event.pointerId, index, startY: event.clientY, active: false, slot: 0, to: index };
  }

  function handlePointerMove(event: React.PointerEvent<HTMLLIElement>) {
    const drag = dragRef.current;
    if (!drag || event.pointerId !== drag.pointerId) return;
    const dy = event.clientY - drag.startY;
    if (!drag.active) {
      if (Math.abs(dy) < DRAG_THRESHOLD) return;
      const rows = rowNodes();
      drag.active = true;
      drag.slot =
        rows.length > 1
          ? rows[1].getBoundingClientRect().top - rows[0].getBoundingClientRect().top
          : rows[0].offsetHeight;
      drag.rows = rows;
      setDragging({ id: drag.row.dataset.id!, from: drag.index });
    }
    const max = (items.length - 1 - drag.index) * drag.slot;
    const min = -drag.index * drag.slot;
    let offset = dy;
    if (offset > max) offset = max + (offset - max) / 4;
    if (offset < min) offset = min + (offset - min) / 4;
    yFor(drag.row.dataset.id!)?.jump(offset);

    const to = Math.max(
      0,
      Math.min(
        items.length - 1,
        Math.round((drag.index * drag.slot + Math.max(min, Math.min(max, dy))) / drag.slot),
      ),
    );
    if (to !== drag.to) {
      drag.to = to;
      drag.rows!.forEach((row, j) => {
        if (row === drag.row) return;
        let shift = 0;
        if (drag.index < j && j <= to) shift = -drag.slot;
        if (to <= j && j < drag.index) shift = drag.slot;
        glide(row.dataset.id!, shift);
      });
    }
  }

  function settleAll(drag: DragData) {
    glide(drag.row.dataset.id!, 0);
    drag.rows?.forEach((row) => {
      if (row !== drag.row) glide(row.dataset.id!, 0);
    });
  }

  function handlePointerUp(event: React.PointerEvent<HTMLLIElement>) {
    const drag = dragRef.current;
    if (!drag || event.pointerId !== drag.pointerId) return;
    dragRef.current = null;
    if (!drag.active) return;
    justDraggedRef.current = true;
    setDragging(null);
    if (drag.to !== drag.index) commitOrder(drag.index, drag.to);
    else settleAll(drag);
  }

  function cancelPointerDrag() {
    const drag = dragRef.current;
    if (!drag) return;
    dragRef.current = null;
    if (!drag.active) return;
    justDraggedRef.current = true;
    setDragging(null);
    settleAll(drag);
  }

  useEffect(() => {
    if (!dragging) return undefined;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") cancelPointerDrag();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dragging]);

  function handleGripKeyDown(
    event: { key: string; preventDefault: () => void },
    index: number,
  ) {
    const item = items[index];
    const isGrabbed = grabbed?.id === item.id;
    if (event.key === " " || event.key === "Enter") {
      event.preventDefault();
      if (isGrabbed) {
        setGrabbed(null);
        grabSnapshotRef.current = null;
        setAnnounce(`${item.label} dropped at position ${index + 1} of ${items.length}.`);
      } else {
        setGrabbed({ id: item.id, from: index });
        grabSnapshotRef.current = items;
        setAnnounce(
          `${item.label} grabbed at position ${index + 1} of ${items.length}. Use arrow keys to move, Space to drop, Escape to cancel.`,
        );
      }
    } else if (isGrabbed && (event.key === "ArrowUp" || event.key === "ArrowDown")) {
      event.preventDefault();
      const to = event.key === "ArrowUp" ? index - 1 : index + 1;
      if (to < 0 || to >= items.length) return;
      commitOrder(index, to);
      setAnnounce(`${item.label} moved to position ${to + 1} of ${items.length}.`);
      requestAnimationFrame(() => {
        listRef.current?.querySelectorAll<HTMLButtonElement>("[data-reorder-grip]")[to]?.focus();
      });
    } else if (isGrabbed && event.key === "Escape") {
      event.preventDefault();
      const snapshot = grabSnapshotRef.current;
      grabSnapshotRef.current = null;
      setGrabbed(null);
      if (snapshot && snapshot !== items) {
        const from = items.findIndex((entry) => entry.id === item.id);
        const to = snapshot.findIndex((entry) => entry.id === item.id);
        if (from !== -1 && to !== -1 && from !== to) commitOrder(from, to);
      }
      setAnnounce(`Reorder cancelled. ${item.label} is back at its original position.`);
    }
  }

  return (
    <MotionConfig reducedMotion="user">
      <ul ref={listRef} role="list" aria-label={ariaLabel} className={`relative flex flex-col ${className}`}>
        {items.map((item, index) => (
          <Row
            key={item.id}
            item={item}
            index={index}
            count={items.length}
            lifted={dragging?.id === item.id || grabbed?.id === item.id}
            grabbed={grabbed?.id === item.id}
            registerY={registerY}
            unregisterY={unregisterY}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={cancelPointerDrag}
            onGripKeyDown={handleGripKeyDown}
            justDraggedRef={justDraggedRef}
          >
            {renderItem(item, index)}
          </Row>
        ))}
      </ul>
      <span className="sr-only" aria-live="polite">
        {announce}
      </span>
    </MotionConfig>
  );
}

function Row<T extends ReorderRow>({
  item,
  index,
  count,
  lifted,
  grabbed,
  registerY,
  unregisterY,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onPointerCancel,
  onGripKeyDown,
  justDraggedRef,
  children,
}: {
  item: T;
  index: number;
  count: number;
  lifted: boolean;
  grabbed: boolean;
  registerY: (id: string, mv: MotionValue<number>) => void;
  unregisterY: (id: string) => void;
  onPointerDown: (event: React.PointerEvent<HTMLLIElement>, index: number) => void;
  onPointerMove: (event: React.PointerEvent<HTMLLIElement>) => void;
  onPointerUp: (event: React.PointerEvent<HTMLLIElement>) => void;
  onPointerCancel: () => void;
  onGripKeyDown: (event: { key: string; preventDefault: () => void }, index: number) => void;
  justDraggedRef: React.MutableRefObject<boolean>;
  children: ReactNode;
}) {
  // The row owns its transform channel. State initialiser runs once, so no
  // ref is touched during render.
  const [y] = useState(() => motionValue(0));
  useLayoutEffect(() => {
    registerY(item.id, y);
    return () => unregisterY(item.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.id]);

  return (
    <motion.li
      data-id={item.id}
      data-reorder-item
      className={`relative touch-none select-none ${lifted ? "z-10" : ""}`}
      style={{ y }}
      onPointerDown={(event) => onPointerDown(event, index)}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
    >
      <motion.div
        className="flex items-center gap-2"
        initial={false}
        animate={
          lifted
            ? { scale: 1.01, boxShadow: "0 0 0 1px rgba(20,21,26,0.08), 0 12px 28px -12px rgba(20,21,26,0.28)" }
            : { scale: 1, boxShadow: "0 0 0 0 rgba(0,0,0,0)" }
        }
        transition={LIFT}
        style={{ borderRadius: 10 }}
      >
        <button
          type="button"
          data-reorder-grip
          className={
            "grid h-7 w-6 flex-none place-items-center rounded text-ink-faint transition-colors " +
            "hover:bg-bg-sunken hover:text-ink-quiet focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand " +
            (lifted ? "cursor-grabbing" : "cursor-grab") +
            (grabbed ? " bg-brand text-white hover:bg-brand hover:text-white" : "")
          }
          aria-label={`Reorder ${item.label}, position ${index + 1} of ${count}${grabbed ? ", grabbed" : ""}`}
          aria-pressed={grabbed}
          onKeyDown={(event) => onGripKeyDown(event, index)}
          onClick={(event) => {
            if (justDraggedRef.current) {
              justDraggedRef.current = false;
              return;
            }
            if (event.detail > 0) onGripKeyDown({ key: " ", preventDefault: () => {} }, index);
          }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <circle cx="9" cy="5" r="1.6" />
            <circle cx="15" cy="5" r="1.6" />
            <circle cx="9" cy="12" r="1.6" />
            <circle cx="15" cy="12" r="1.6" />
            <circle cx="9" cy="19" r="1.6" />
            <circle cx="15" cy="19" r="1.6" />
          </svg>
        </button>
        <div className="min-w-0 flex-1">{children}</div>
      </motion.div>
    </motion.li>
  );
}

/**
 * Gap-numbered float position for a drop between neighbours — the same
 * contract the board uses (COALESCE(position, createdAt) ascending). The
 * caller passes the sibling positions in their NEW visual order and the
 * target index; returns a finite position to persist for the moved row.
 */
export function positionForDrop(
  orderedPositions: (number | null | undefined)[],
  toIndex: number,
): number {
  const STEP = 1000;
  const nums = orderedPositions.map((p, i) => (typeof p === "number" ? p : (i + 1) * STEP));
  const before = toIndex - 1 >= 0 ? nums[toIndex - 1] : undefined;
  const after = toIndex + 1 < nums.length ? nums[toIndex + 1] : undefined;
  if (before === undefined && after === undefined) return STEP;
  if (before === undefined) return after! - STEP;
  if (after === undefined) return before + STEP;
  return (before + after) / 2;
}
