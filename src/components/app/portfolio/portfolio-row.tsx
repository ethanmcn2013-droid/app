"use client";

/**
 * One Project on the All projects grid: a `role="row"` holding the sticky
 * name cell and the canvas cell with its bar. The row's accessible name is
 * one whole sentence (`rowAccessibleLabel`); the bar is decoration to
 * assistive tech. Focus is roving: only the active row is in the Tab order.
 *
 * The name cell: an identity tile (with a lock when the row cannot be
 * opened from here), the name, a Sample chip, "Open now" for the Project you
 * came from, the meta line, and a ⋯ button that shows on hover or focus.
 */

import { memo } from "react";
import Link from "next/link";
import { barGeometry, rowAccessibleLabel, rowMetaLine, type PortfolioRow as Row } from "@/lib/projects/project-portfolio";
import type { TimeRange } from "@/lib/projects/project-portfolio-scale";
import { projectColor } from "@/components/shell/app-sidebar";
import { PortfolioBar } from "./portfolio-bar";
import { RowMenuButton } from "./row-menu";
import styles from "./portfolio.module.css";

export type RowHandlers = Readonly<{
  onActivate: (row: Row) => void;
  onFocusRow: (key: string, row: Row, element: HTMLElement) => void;
  onHover: (row: Row, element: HTMLElement, clientX: number) => void;
  onLeave: () => void;
  onPin: (row: Row, element: HTMLElement, clientX: number) => void;
  onMenu: (row: Row, anchor: DOMRect | { x: number; y: number }, returnTo: HTMLElement) => void;
  onEdge: (day: string) => void;
}>;

export const PortfolioRow = memo(function PortfolioRow({
  row,
  focusKey,
  active,
  openNow,
  hovered,
  flash,
  pinned,
  describedBy,
  range,
  ppd,
  width,
  todayIso,
  showMilestones,
  clipLeft,
  clipRight,
  viewLeft,
  viewRight,
  steppedId,
  handlers,
}: {
  row: Row;
  focusKey: string;
  active: boolean;
  openNow: boolean;
  hovered: boolean;
  flash: boolean;
  pinned: boolean;
  describedBy?: string;
  range: TimeRange;
  ppd: number;
  width: number;
  todayIso: string;
  showMilestones: boolean;
  clipLeft: boolean;
  clipRight: boolean;
  viewLeft: number;
  viewRight: number;
  steppedId: string | null;
  handlers: RowHandlers;
}) {
  const locked = !row.sample && !row.href;
  const pastTarget = barGeometry(row, todayIso).pastTarget;
  const label = `${rowAccessibleLabel(row, todayIso)}${openNow ? ", open now" : ""}`;

  return (
    <div
      role="row"
      tabIndex={active ? 0 : -1}
      aria-label={label}
      aria-describedby={describedBy}
      data-focus-key={focusKey}
      data-row-id={row.id}
      className={styles.row}
      data-locked={locked ? "" : undefined}
      data-sample={row.sample ? "" : undefined}
      data-open-now={openNow ? "" : undefined}
      data-hovered={hovered ? "" : undefined}
      data-flash={flash ? "" : undefined}
      data-pinned={pinned ? "" : undefined}
      onFocus={(event) => {
        if (event.target === event.currentTarget) handlers.onFocusRow(focusKey, row, event.currentTarget);
      }}
      onPointerEnter={(event) => {
        if (event.pointerType === "mouse") handlers.onHover(row, event.currentTarget, event.clientX);
      }}
      onPointerMove={(event) => {
        if (event.pointerType === "mouse") handlers.onHover(row, event.currentTarget, event.clientX);
      }}
      onPointerLeave={handlers.onLeave}
      onContextMenu={(event) => {
        event.preventDefault();
        handlers.onMenu(row, { x: event.clientX, y: event.clientY }, event.currentTarget);
      }}
    >
      <div role="rowheader" className={styles.nameCell}>
        <span className={styles.tile} style={{ background: projectColor(row.id) }} aria-hidden="true">
          {row.monogram}
          {locked ? (
            <span className={styles.tileLock}>
              <svg width="9" height="9" viewBox="0 0 16 16" fill="none">
                <rect x="3" y="7" width="10" height="7.5" rx="1.6" fill="currentColor" />
                <path d="M5.25 7V5.25a2.75 2.75 0 0 1 5.5 0V7" stroke="currentColor" strokeWidth="1.8" />
              </svg>
            </span>
          ) : null}
        </span>
        <span className={styles.nameText}>
          <span className={styles.nameLine}>
            {row.href ? (
              <Link href={row.href} tabIndex={-1} className={styles.name} title={row.name} onClick={(event) => event.stopPropagation()}>
                {row.name}
              </Link>
            ) : (
              <span
                className={styles.name}
                data-sample-name={row.sample ? "" : undefined}
                title={row.name}
                onClick={(event) => {
                  event.stopPropagation();
                  handlers.onActivate(row);
                }}
              >
                {row.name}
              </span>
            )}
          </span>
          <span className={styles.meta} data-tone={pastTarget ? "danger" : undefined}>
            {rowMetaLine(row, todayIso)}
          </span>
        </span>
        <RowMenuButton
          className={styles.rowMore}
          label={`Actions for ${row.name}`}
          tabIndex={-1}
          onOpen={(anchor, button) => handlers.onMenu(row, anchor, button)}
        />
      </div>
      <div
        role="gridcell"
        className={styles.canvasCell}
        style={{ width }}
        aria-hidden="true"
        data-canvas-layer=""
        onClick={(event) => handlers.onPin(row, event.currentTarget.parentElement as HTMLElement, event.clientX)}
      >
        <PortfolioBar
          row={row}
          range={range}
          ppd={ppd}
          width={width}
          todayIso={todayIso}
          showMilestones={showMilestones}
          clipLeft={clipLeft}
          clipRight={clipRight}
          viewLeft={viewLeft}
          viewRight={viewRight}
          steppedId={steppedId}
          onEdge={handlers.onEdge}
        />
      </div>
    </div>
  );
});
