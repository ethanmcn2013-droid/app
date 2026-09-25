"use client";

/**
 * The plan's runway (spec 3.2): the plan on one line, on the same canvas as
 * All projects, with its own scale.
 *
 *   Earlier ⋯ │ Jul     ┃Today        Aug              Sep            Oct
 *   ◇ ◇ 2 done│         ┃  Menu tasting 1 Aug     Final dress fitting 22 Aug
 *             │─────────┃───◆──────◇────────────◇──────◇──────◇────────⚑
 *             │         ┃        Invitations 8 Aug     Evening music    Wedding
 *
 * - Finished work before the fold folds into an 88px "Earlier" segment;
 *   pressing it shows the true past, pressing "Fold earlier" folds it again.
 * - The scale runs from the fold to two weeks past the key date and fits the
 *   width, so today to the key date takes most of it. Today is always in.
 * - Labels sit on two lanes, above and below the line, and each belongs to
 *   its own diamond: centred on it, or starting or ending at it near an
 *   edge. The next milestone and the key date are placed first. A diamond
 *   whose label fits nowhere folds with its neighbour into a "2" bubble
 *   that lists them, so every diamond is labelled or counted
 *   (lib/runway-labels.ts).
 * - On desktop an owner can drag a diamond to change its date: it snaps to a
 *   day, a ghost chip reads "8 Aug → 15 Aug (+7 days)", Esc or dropping
 *   outside the runway cancels, and letting go writes one date (with Undo).
 *   The list and the panel stay the complete path, keyboard included.
 * - On a phone the runway scrolls sideways with today 24px from the left,
 *   labels go below only, and every diamond has a 44px hit area.
 */

import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { createPortal } from "react-dom";
import type { EffectiveNode } from "@/modules/timeline/server/db/timeline-queries";
import { clusterLabel, diamondLabel, isLate, runwayRange } from "@/modules/timeline/lib/plan-view";
import { layoutRunway, type RunwayGroup } from "@/modules/timeline/lib/runway-labels";
import {
  dayToX,
  diffDays,
  formatShortDay,
  xToDay,
} from "@/lib/projects/project-portfolio-scale";
import { TimelineCanvas, type TimelineCanvasHandle } from "@/components/app/portfolio/timeline-canvas";
import { FlagGlyph } from "@/components/app/portfolio/timeline-ui";
import styles from "./plan.module.css";

type Tone = "done" | "next" | "late" | "key" | "upcoming";

function toneOf(node: EffectiveNode, todayIso: string, nextId: string | null, keyId: string | null): Tone {
  if (node.audienceState === "covered") return "done";
  if (node.id === nextId) return "next";
  if (isLate(node, todayIso)) return "late";
  if (node.id === keyId) return "key";
  return "upcoming";
}

/** Nominal width the fit-mode scale is computed at; positions are percentages of it. */
const NOMINAL = 1000;
const PHONE_PPD = 5;
const CLUSTER_PX = 18;

export type PlanRunwayHandle = Readonly<{ showToday: () => void }>;

export const PlanRunway = forwardRef<
  PlanRunwayHandle,
  {
    nodes: readonly EffectiveNode[];
    todayIso: string;
    selectedId: string | null;
    hoverId: string | null;
    nextId: string | null;
    keyId: string | null;
    canEdit: boolean;
    phone: boolean;
    counts: { done: number; active: number; hidden: number };
    next: EffectiveNode | null;
    onSelect: (id: string) => void;
    onHover: (id: string | null) => void;
    onRedate: (node: EffectiveNode, day: string) => void;
  }
>(function PlanRunway(
  { nodes, todayIso, selectedId, hoverId, nextId, keyId, canEdit, phone, counts, next, onSelect, onHover, onRedate },
  ref,
) {
  const canvasRef = useRef<TimelineCanvasHandle>(null);
  const layerRef = useRef<HTMLDivElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [layerW, setLayerW] = useState(0);
  const [openCluster, setOpenCluster] = useState<{ key: string; left: number; top: number } | null>(null);
  const [pulse, setPulse] = useState(0);
  const [drag, setDrag] = useState<{ id: string; from: string; day: string; startX: number; moved: boolean } | null>(null);
  const suppressClick = useRef(false);

  const { range, folded, foldable } = runwayRange(nodes, todayIso, expanded);
  const fit = !phone;
  const ppd = fit ? NOMINAL / range.days : PHONE_PPD;
  const W = range.days * ppd;
  const pxWidth = fit ? layerW || 960 : W;
  const at = (px: number) => (fit ? `${(px / W) * 100}%` : `${px}px`);
  const x = (day: string) => dayToX(day, range, ppd) + ppd / 2;
  // Label maths needs real pixels: convert scale px to on-screen px.
  const toScreen = (px: number) => (fit ? (px / W) * pxWidth : px);

  useImperativeHandle(ref, () => ({
    showToday: () => {
      if (phone) canvasRef.current?.scrollToDay(todayIso, { smooth: true });
      setPulse((n) => n + 1);
    },
  }));

  useEffect(() => {
    const el = layerRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => setLayerW(el.clientWidth));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!openCluster) return;
    function onDown(event: PointerEvent) {
      if (!(event.target as HTMLElement).closest("[data-cluster-menu], [data-cluster-button]")) setOpenCluster(null);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        setOpenCluster(null);
      }
    }
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [openCluster]);

  // Esc cancels a drag in progress.
  const cancelDrag = useCallback(() => {
    setDrag(null);
    suppressClick.current = true;
    setTimeout(() => {
      suppressClick.current = false;
    }, 0);
  }, []);
  useEffect(() => {
    if (!drag?.moved) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        cancelDrag();
      }
    }
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [cancelDrag, drag?.moved]);

  const foldedIds = new Set(folded.map((node) => node.id));
  const dated = nodes.filter((node) => node.targetDate && node.audienceState !== "cancelled" && !foldedIds.has(node.id));
  const effectiveDay = (node: EffectiveNode) => (drag?.id === node.id && drag.moved ? drag.day : node.targetDate!);
  const marks = dated.map((node) => ({ x: x(effectiveDay(node)), item: node }));
  const dragged = drag?.moved ? marks.find((mark) => mark.item.id === drag.id) : undefined;
  // Lay out in screen pixels, so gaps and edge insets hold at every width.
  const lanes: ("above" | "below")[] = phone ? ["below"] : ["above", "below"];
  const labelText = (node: EffectiveNode) => `${node.title} ${formatShortDay(node.targetDate!, todayIso)}`;
  const layout = layoutRunway(
    marks.filter((mark) => mark !== dragged).map((mark) => ({ x: toScreen(mark.x), item: mark.item })),
    {
      widthPx: pxWidth,
      lanes,
      idOf: (node) => node.id,
      // 12.5px text is about 6.6px a character, plus the 3px knockout each side.
      widthOf: (node) => labelText(node).length * 6.6 + 6,
      isPriority: (node) => node.id === nextId || node.id === keyId || node.id === selectedId,
      clusterPx: CLUSTER_PX,
      inset: 12,
    },
  );
  const fromScreen = (px: number) => (fit ? (px / pxWidth) * W : px);
  const groups: RunwayGroup<EffectiveNode>[] = layout.groups.map((group) => ({ ...group, x: fromScreen(group.x) }));
  if (dragged) groups.push({ kind: "single", x: dragged.x, item: dragged.item });
  const byId = new Map(dated.map((node) => [node.id, node]));

  const keyNode = dated.find((node) => node.id === keyId) ?? null;
  const todayX = x(todayIso);
  const labels = drag?.moved ? [] : layout.labels;
  const firstX = marks.length ? Math.min(...marks.map((m) => m.x)) : null;
  const lastX = marks.length ? Math.max(...marks.map((m) => m.x)) : null;

  // ── Drag ────────────────────────────────────────────────────────────────
  function startDrag(event: ReactPointerEvent<HTMLButtonElement>, node: EffectiveNode) {
    if (!canEdit || phone || event.pointerType !== "mouse" || event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    setDrag({ id: node.id, from: node.targetDate!, day: node.targetDate!, startX: event.clientX, moved: false });
  }

  function moveDrag(event: ReactPointerEvent<HTMLButtonElement>) {
    if (!drag) return;
    const dx = event.clientX - drag.startX;
    if (!drag.moved && Math.abs(dx) < 4) return;
    const scaleDx = fit ? (dx / pxWidth) * W : dx;
    const day = xToDay(x(drag.from) - ppd / 2 + scaleDx, range, ppd);
    if (day !== drag.day || !drag.moved) setDrag({ ...drag, day, moved: true });
  }

  function endDrag(event: ReactPointerEvent<HTMLButtonElement>, node: EffectiveNode) {
    if (!drag) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    const { moved, day, from } = drag;
    setDrag(null);
    if (!moved) return;
    suppressClick.current = true;
    setTimeout(() => {
      suppressClick.current = false;
    }, 0);
    // Dropping outside the runway cancels.
    const box = layerRef.current?.closest("[data-plan-runway]")?.getBoundingClientRect();
    const inside = box && event.clientX >= box.left && event.clientX <= box.right && event.clientY >= box.top - 24 && event.clientY <= box.bottom + 24;
    if (inside && day !== from) onRedate(node, day);
  }

  const delta = drag?.moved ? diffDays(drag.from, drag.day) : 0;

  return (
    <section className={styles.runway} aria-label="The plan on one line" data-plan-runway="" data-phone={phone ? "" : undefined}>
      <TimelineCanvas
        ref={canvasRef}
        range={range}
        ppd={ppd}
        zoom="months"
        tickZoom={range.days > 400 ? "quarters" : "months"}
        todayIso={todayIso}
        fit={fit}
        alignPx={phone ? 24 : undefined}
        className={styles.runwayCanvas}
        scrollerClassName={styles.runwayScroller}
        style={{ ["--tl-left-w" as string]: fit && folded.length > 0 ? "88px" : "0px", ["--tl-axis-h" as string]: "34px" }}
        headLeft={
          fit && folded.length > 0 ? (
            <span className={styles.earlierHead}>Earlier</span>
          ) : undefined
        }
      >
        {fit && folded.length > 0 ? (
          <button
            type="button"
            className={styles.earlier}
            onClick={() => setExpanded(true)}
            aria-label={`Show the earlier part of the plan: ${folded.length === 1 ? "1 milestone" : `${folded.length} milestones`} done`}
          >
            <span className={styles.earlierMarks} aria-hidden="true">
              {folded.slice(-4).map((node) => (
                <span key={node.id} className={styles.earlierDiamond} />
              ))}
            </span>
            <span className={styles.earlierCount}>{folded.length} done earlier</span>
          </button>
        ) : null}

        <div ref={layerRef} className={styles.runwayLayer} style={fit ? undefined : { width: W }}>
          {firstX !== null && lastX !== null ? (
            <>
              <span className={styles.line} style={{ left: at(Math.min(firstX, todayX)), width: at(Math.max(lastX, todayX) - Math.min(firstX, todayX)) }} aria-hidden="true" />
              <span className={styles.lineTravelled} style={{ left: at(Math.min(firstX, todayX)), width: at(Math.max(0, todayX - Math.min(firstX, todayX))) }} aria-hidden="true" />
            </>
          ) : null}
          <span key={pulse} className={styles.todayPulse} data-pulse={pulse > 0 ? "" : undefined} style={{ left: at(todayX) }} aria-hidden="true" />

          {keyNode ? (
            <span className={styles.keyFlagMark} style={{ left: at(x(effectiveDay(keyNode))) }} aria-hidden="true">
              <FlagGlyph size={13} />
            </span>
          ) : null}

          {labels.map((label) => {
            const node = byId.get(label.id);
            if (!node) return null;
            // Anchor at the diamond side the label belongs to, so a width
            // estimate that is slightly off never pulls it off its diamond.
            const anchor = label.align === "center" ? label.x : label.align === "start" ? label.from : label.to;
            return (
              <span
                key={label.id}
                className={styles.runwayLabel}
                data-lane={label.lane}
                data-align={label.align}
                data-strong={label.strong ? "" : undefined}
                data-hover={hoverId === label.id || selectedId === label.id ? "" : undefined}
                style={{ left: fit ? `${(anchor / pxWidth) * 100}%` : `${anchor}px` }}
                aria-hidden="true"
              >
                {node.title} <span className={styles.runwayLabelDate}>{formatShortDay(node.targetDate!, todayIso)}</span>
              </span>
            );
          })}

          {groups.map((group) => {
            if (group.kind === "single") {
              const node = group.item;
              const tone = toneOf(node, todayIso, nextId, keyId);
              const dragging = drag?.id === node.id && drag.moved;
              return (
                <button
                  key={node.id}
                  type="button"
                  className={styles.diamondButton}
                  style={{ left: at(group.x) }}
                  aria-label={diamondLabel(node, todayIso)}
                  aria-pressed={selectedId === node.id}
                  data-draggable={canEdit && !phone ? "" : undefined}
                  data-dragging={dragging ? "" : undefined}
                  data-hover={hoverId === node.id ? "" : undefined}
                  title={canEdit && !phone ? `${node.title}. Drag to change its date.` : node.title}
                  onClick={() => {
                    if (suppressClick.current) return;
                    onSelect(node.id);
                  }}
                  onPointerEnter={() => onHover(node.id)}
                  onPointerLeave={() => onHover(null)}
                  onPointerDown={(event) => startDrag(event, node)}
                  onPointerMove={moveDrag}
                  onPointerUp={(event) => endDrag(event, node)}
                  onPointerCancel={() => setDrag(null)}
                >
                  <span
                    className={styles.diamond}
                    data-tone={tone}
                    data-hidden={node.hidden ? "" : undefined}
                    data-selected={selectedId === node.id ? "" : undefined}
                  />
                  {dragging && drag ? (
                    <span className={styles.ghost} role="status">
                      {formatShortDay(drag.from, todayIso)} → {formatShortDay(drag.day, todayIso)}
                      <span className={styles.ghostDelta}>
                        {delta === 0 ? "" : ` (${delta > 0 ? "+" : "−"}${Math.abs(delta)} ${Math.abs(delta) === 1 ? "day" : "days"})`}
                      </span>
                    </span>
                  ) : null}
                </button>
              );
            }
            const key = group.items.map((node) => node.id).join("|");
            const tones = group.items.map((node) => toneOf(node, todayIso, nextId, keyId));
            const tone = tones.includes("next") ? "next" : tones.includes("late") ? "late" : tones.every((t) => t === "done") ? "done" : undefined;
            const open = openCluster?.key === key;
            const label = clusterLabel(group.items, todayIso);
            return (
              <span key={key}>
                <button
                  type="button"
                  className={styles.clusterButton}
                  style={{ left: at(group.x) }}
                  data-tone={tone}
                  data-cluster-button=""
                  aria-label={label}
                  aria-expanded={open}
                  aria-haspopup="true"
                  onClick={(event) => {
                    if (open) {
                      setOpenCluster(null);
                      return;
                    }
                    const rect = event.currentTarget.getBoundingClientRect();
                    const left = Math.max(8, Math.min(window.innerWidth - 288, rect.left + rect.width / 2 - 140));
                    setOpenCluster({ key, left, top: rect.bottom + 6 });
                  }}
                >
                  <span className={styles.clusterBubble}>{group.items.length}</span>
                </button>
                {open && openCluster && typeof document !== "undefined" ? createPortal(
                  <div
                    className={styles.clusterMenu}
                    style={{ left: openCluster.left, top: openCluster.top }}
                    data-cluster-menu=""
                    role="group"
                    aria-label={label}
                  >
                    <p className={styles.clusterMenuTitle}>{label}</p>
                    {group.items.map((node, index) => (
                      <button
                        key={node.id}
                        type="button"
                        className={styles.clusterItem}
                        ref={(el) => {
                          if (el && index === 0 && document.activeElement?.hasAttribute("data-cluster-button")) el.focus({ preventScroll: true });
                        }}
                        onClick={() => {
                          setOpenCluster(null);
                          onSelect(node.id);
                        }}
                      >
                        <span className={styles.clusterDiamond} data-tone={toneOf(node, todayIso, nextId, keyId)} aria-hidden="true" />
                        <span className={styles.clusterItemTitle}>{node.title}</span>
                        <span className={styles.clusterItemDate}>{formatShortDay(node.targetDate!, todayIso)}</span>
                      </button>
                    ))}
                  </div>,
                  document.body,
                ) : null}
              </span>
            );
          })}
        </div>
      </TimelineCanvas>

      <div className={styles.runwayFoot}>
        <span className={styles.progressWrap}>
          <span className={styles.progress} aria-hidden="true">
            <span style={{ width: `${counts.active ? Math.round((counts.done / counts.active) * 100) : 0}%` }} />
          </span>
          {counts.done} of {counts.active} done
          {counts.hidden > 0 ? <span className={styles.quiet}> · {counts.hidden} hidden</span> : null}
          {expanded && foldable && fit ? (
            <button type="button" className={styles.textButton} onClick={() => setExpanded(false)}>
              Fold earlier
            </button>
          ) : null}
        </span>
        {next?.targetDate ? (
          <span className={styles.runwayNext}>
            Next: <span className={styles.strong}>{next.title}</span> · {formatShortDay(next.targetDate, todayIso)} ·{" "}
            {diffDays(todayIso, next.targetDate) === 0 ? "today" : diffDays(todayIso, next.targetDate) === 1 ? "tomorrow" : `in ${diffDays(todayIso, next.targetDate)} days`}
          </span>
        ) : canEdit && marks.length === 1 && keyNode ? (
          <span className={styles.quiet}>Add the steps in between.</span>
        ) : canEdit && !phone ? (
          <span className={styles.quiet}>Drag a diamond to change its date.</span>
        ) : null}
      </div>
    </section>
  );
});
