"use client";

/**
 * The Project card (spec 5.1). It opens after 250ms of hover, at once on
 * keyboard focus, and swaps at once to the next row while one is open, so a
 * reader can scan down the page. Pressing the bar or Space pins it.
 *
 * Placement is the point: it sits BELOW the row when the card fits there,
 * otherwise ABOVE it, and never over the row being compared. It follows the
 * pointer's x, clamped to the canvas, and flips at the viewport's edges. It
 * is measured and placed before paint, so it never flashes in the wrong
 * spot.
 *
 * Unpinned, it is a tooltip the focused row points at (`aria-describedby`);
 * pinned, it is a dialog. It never takes focus.
 */

import { forwardRef, useLayoutEffect, useRef, type CSSProperties } from "react";
import Link from "next/link";
import { projectStatusOption, progressPercent, taskProgressLabel } from "@/lib/projects/project-hub";
import {
  barGeometry,
  lateMilestones,
  nextMilestone,
  type PortfolioRow,
} from "@/lib/projects/project-portfolio";
import { formatShortDay, relativeDayPhrase } from "@/lib/projects/project-portfolio-scale";
import { projectColor } from "@/components/shell/app-sidebar";
import styles from "./portfolio.module.css";

export function StatusPill({ row }: { row: Pick<PortfolioRow, "status" | "statusTone"> }) {
  return (
    <span className={styles.statusPill} data-tone={row.status === "paused" ? "paused" : row.statusTone}>
      <span className={styles.dot} data-tone={row.status === "paused" ? "paused" : row.statusTone} aria-hidden="true" />
      {projectStatusOption(row.status).label}
    </span>
  );
}

export function tileStyle(row: Pick<PortfolioRow, "id">): CSSProperties {
  return { background: projectColor(row.id) };
}

/** Where the card may go: the row it describes and the canvas it may not leave. */
export type CardAnchor = Readonly<{
  rowTop: number;
  rowBottom: number;
  /** The pointer's x (or the bar's visible start when opened from the keyboard). */
  x: number;
  minX: number;
  maxX: number;
}>;

const CARD_WIDTH = 344;
const GAP = 8;

/** The card's words, shared with the phone's facts sheet. */
export function ProjectFacts({ row, todayIso }: { row: PortfolioRow; todayIso: string }) {
  const geometry = barGeometry(row, todayIso);
  const next = nextMilestone(row, todayIso);
  const late = lateMilestones(row, todayIso);
  const pct = row.status === "complete" ? 100 : progressPercent(row.complete, row.total);
  const upcoming = row.milestones.filter((m) => !m.done && m.date >= todayIso).slice(0, 3);

  if (!row.statsKnown) {
    return <p className={styles.cardNote}>Progress and dates couldn&apos;t be loaded for this project.</p>;
  }

  return (
    <>
      <dl className={styles.cardFacts}>
        <div className={styles.cardFact}>
          <dt>Target</dt>
          {row.target ? (
            <dd data-tone={geometry.pastTarget ? "danger" : undefined}>
              {formatShortDay(row.target, todayIso)}
              <span className={styles.cardQuiet}>
                {" · "}
                {geometry.pastTarget
                  ? `${geometry.daysPast === 1 ? "1 day" : `${geometry.daysPast} days`} past target`
                  : row.status === "complete"
                    ? "done"
                    : relativeDayPhrase(row.target, todayIso)}
              </span>
            </dd>
          ) : (
            <dd className={styles.cardQuiet}>No target date</dd>
          )}
        </div>
        <div className={styles.cardFact}>
          <dt>Progress</dt>
          <dd>
            <span>{taskProgressLabel(row.complete, row.total)}</span>
            {row.total > 0 ? (
              <span className={styles.cardProgress} data-tone={row.statusTone} aria-hidden="true">
                <span style={{ width: `${pct}%` }} />
              </span>
            ) : null}
          </dd>
        </div>
        {row.overdue > 0 ? (
          <div className={styles.cardFact}>
            <dt>Late</dt>
            <dd data-tone="danger">{row.overdue === 1 ? "1 task is late" : `${row.overdue} tasks are late`}</dd>
          </div>
        ) : null}
        <div className={styles.cardFact}>
          <dt>Started</dt>
          <dd>{row.start ? (row.startSource === "created" ? `${formatShortDay(row.start, todayIso)}, when the project was made` : formatShortDay(row.start, todayIso)) : "Not yet"}</dd>
        </div>
        {row.timelineName ? (
          <div className={styles.cardFact}>
            <dt>Timeline</dt>
            <dd>{row.timelineName}</dd>
          </div>
        ) : null}
      </dl>

      {late.length > 0 || upcoming.length > 0 ? (
        <div className={styles.cardMilestones}>
          <p className={styles.cardSub}>{next ? `Next milestone: ${next.title} · ${formatShortDay(next.date, todayIso)}` : "Milestones"}</p>
          <ul className={styles.cardList}>
            {late.map((m) => (
              <li key={m.id} data-tone="danger">
                <span className={styles.cardDiamond} data-tone="overdue" aria-hidden="true" />
                <span className={styles.cardListTitle}>{m.title}</span>
                <span className={styles.cardListDate}>{formatShortDay(m.date, todayIso)} · missed</span>
              </li>
            ))}
            {upcoming.map((m) => (
              <li key={m.id}>
                <span className={styles.cardDiamond} data-tone={m.id === next?.id ? "next" : "upcoming"} aria-hidden="true" />
                <span className={styles.cardListTitle}>{m.title}</span>
                <span className={styles.cardListDate}>{formatShortDay(m.date, todayIso)}</span>
              </li>
            ))}
          </ul>
          {row.milestoneOverflow > 0 ? <p className={styles.cardQuietLine}>+{row.milestoneOverflow} more</p> : null}
        </div>
      ) : null}
    </>
  );
}

export const PortfolioHoverCard = forwardRef<
  HTMLDivElement,
  {
    id: string;
    row: PortfolioRow;
    todayIso: string;
    anchor: CardAnchor;
    pinned: boolean;
    onPointerEnter: () => void;
    onPointerLeave: () => void;
    onClose: () => void;
  }
>(function PortfolioHoverCard({ id, row, todayIso, anchor, pinned, onPointerEnter, onPointerLeave, onClose }, ref) {
  const localRef = useRef<HTMLDivElement | null>(null);

  // Measure, then place before paint: below the row, else above it; never over it.
  useLayoutEffect(() => {
    const card = localRef.current;
    if (!card) return;
    const height = card.offsetHeight;
    const vh = window.innerHeight;
    const vw = window.innerWidth;
    const below = vh - anchor.rowBottom - GAP;
    const above = anchor.rowTop - GAP;
    let top: number;
    let side: "below" | "above";
    card.style.maxHeight = "";
    if (height <= below - 8) {
      top = anchor.rowBottom + GAP;
      side = "below";
    } else if (height <= above - 8) {
      top = anchor.rowTop - GAP - height;
      side = "above";
    } else if (below >= above) {
      // Neither side fits whole: take the roomier one and scroll inside it,
      // rather than cover the row being read.
      top = anchor.rowBottom + GAP;
      side = "below";
      card.style.maxHeight = `${Math.max(160, below - 8)}px`;
    } else {
      const max = Math.max(160, above - 8);
      card.style.maxHeight = `${max}px`;
      top = Math.max(8, anchor.rowTop - GAP - Math.min(height, max));
      side = "above";
    }
    const maxLeft = Math.min(anchor.maxX, vw - 8) - CARD_WIDTH;
    const left = Math.max(Math.max(anchor.minX, 8), Math.min(maxLeft, anchor.x - 48));
    card.style.top = `${Math.round(top)}px`;
    card.style.left = `${Math.round(left)}px`;
    card.dataset.side = side;
    card.style.visibility = "visible";
  }, [anchor, row.id]);

  const status = projectStatusOption(row.status);

  return (
    <div
      ref={(node) => {
        localRef.current = node;
        if (typeof ref === "function") ref(node);
        else if (ref) ref.current = node;
      }}
      id={id}
      role={pinned ? "dialog" : "tooltip"}
      aria-label={pinned ? `${row.name}, ${status.label.toLowerCase()}` : undefined}
      className={styles.card}
      data-pinned={pinned ? "" : undefined}
      style={{ visibility: "hidden", top: 0, left: 0, width: CARD_WIDTH }}
      onPointerEnter={onPointerEnter}
      onPointerLeave={onPointerLeave}
      data-portfolio-card=""
    >
      <div className={styles.cardHead}>
        <span className={styles.tile} style={tileStyle(row)} aria-hidden="true">
          {row.monogram}
        </span>
        <span className={styles.cardName} title={row.name}>
          {row.name}
        </span>
        <StatusPill row={row} />
        {pinned ? (
          <button type="button" className={styles.cardClose} onClick={onClose} aria-label="Close the card">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="m4 4 8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        ) : null}
      </div>
      {row.purpose ? <p className={styles.cardPurpose}>{row.purpose}</p> : null}

      <ProjectFacts row={row} todayIso={todayIso} />

      {!row.selectable ? (
        <p className={styles.cardNote}>{row.blockedReason ?? "This project can't be opened from here."}</p>
      ) : null}
      {row.statsKnown && !row.target && !row.sample && row.role !== "member" && row.overviewHref && row.status !== "complete" ? (
        <p className={styles.cardNote}>
          <Link href={row.overviewHref} className={styles.cardLink}>
            Set a target date
          </Link>{" "}
          to see where it should end.
        </p>
      ) : null}

      {row.sample ? (
        <p className={styles.cardSample}>
          <span className={styles.sampleChip}>Sample</span>
          Made up to show how this works. Opens nothing.
        </p>
      ) : (
        <div className={styles.cardActions}>
          {row.href ? (
            <Link href={row.href} className={styles.buttonPrimary}>
              Open timeline
            </Link>
          ) : null}
          {row.overviewHref ? (
            <Link href={row.overviewHref} className={styles.button}>
              Project overview
            </Link>
          ) : null}
          {!pinned ? <span className={styles.cardHint}>Click the bar to keep this open</span> : null}
        </div>
      )}
    </div>
  );
});
