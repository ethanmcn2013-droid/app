"use client";

/**
 * One Project's bar (spec 5.2). Every case has its own drawing and its own
 * words, so colour is never the only signal:
 *
 *   span          start → target, the done share filled, "12 Nov · 40%"
 *   at risk       the same in warning tones, with a warning ring
 *   paused        a 45° hatch, "Paused"
 *   complete      solid accent with a check, "Done 30 Jun"
 *   open-ended    solid to today, then a dotted tail, "No target date"
 *   target only   a flag on the target and a hairline from today
 *   none          no bar; "No dates yet" at today
 *   past target   stops at the target; a hatched danger run to today
 *   clipped       a chevron with the true date inside the visible edge
 *   no tasks      ring only, "No tasks yet"
 *   stats unknown a neutral ring-only track and the status word
 *
 * Every bar has a 1px inset ring so its extent reads at 3:1 on both the
 * canvas and the past wash. Milestones are 10px diamonds on the bar, merged
 * with `clusterMarks(…, 14)` where they would overlap.
 *
 * The row carries the accessible sentence; everything here is decoration to
 * assistive tech. Positions are px on the page's scale.
 */

import { memo } from "react";
import Link from "next/link";
import {
  barEndLabel,
  barGeometry,
  milestoneTone,
  type MilestoneTone,
  type PortfolioRow,
} from "@/lib/projects/project-portfolio";
import {
  addDays,
  clusterMarks,
  dayToX,
  diffDays,
  formatDayMonthYear,
  formatShortDay,
  SHORT_MONTHS,
  type TimeRange,
} from "@/lib/projects/project-portfolio-scale";
import styles from "./portfolio.module.css";

const CLUSTER_GAP_PX = 14;
const OPEN_STUB_PX = 18;

function clusterTone(tones: readonly MilestoneTone[]): MilestoneTone {
  if (tones.includes("overdue")) return "overdue";
  if (tones.includes("next")) return "next";
  if (tones.every((tone) => tone === "done")) return "done";
  return "upcoming";
}

/** "from 2 Mar", or "from 6 Mar 2023" when the year differs. */
function fromWords(iso: string, todayIso: string): string {
  return `from ${formatShortDay(iso, todayIso)}`;
}

/** "to Mar 2027": the month is enough at the far edge. */
function toWords(iso: string, todayIso: string): string {
  const month = SHORT_MONTHS[Number(iso.slice(5, 7)) - 1];
  return iso.slice(0, 4) === todayIso.slice(0, 4) ? `to ${formatShortDay(iso)}` : `to ${month} ${iso.slice(0, 4)}`;
}

export const PortfolioBar = memo(function PortfolioBar({
  row,
  range,
  ppd,
  width,
  todayIso,
  showMilestones = true,
  clipLeft,
  clipRight,
  viewLeft,
  viewRight,
  steppedId,
  onEdge,
}: {
  row: PortfolioRow;
  range: TimeRange;
  ppd: number;
  /** Canvas width, for the end label's inside-or-outside choice. */
  width: number;
  todayIso: string;
  showMilestones?: boolean;
  /** The bar runs off the visible left or right edge. */
  clipLeft: boolean;
  clipRight: boolean;
  viewLeft: number;
  viewRight: number;
  /** The milestone ←/→ stepped to, ringed. */
  steppedId?: string | null;
  /** An edge chevron was pressed: scroll to that end of the bar. */
  onEdge?: (day: string) => void;
}) {
  const geometry = barGeometry(row, todayIso);
  const x = (day: string) => dayToX(day, range, ppd);
  const centre = (day: string) => x(day) + ppd / 2;
  const label = barEndLabel(row, todayIso);

  if (!geometry.from || !geometry.to) {
    const canSet = row.statsKnown && !row.sample && row.role !== "member" && row.overviewHref;
    return (
      <span className={styles.barWords} style={{ left: centre(todayIso) + 10 }}>
        No dates yet
        {canSet ? (
          <>
            {" · "}
            <Link href={row.overviewHref!} tabIndex={-1} className={styles.setOne} onClick={(event) => event.stopPropagation()}>
              Set a target date →
            </Link>
          </>
        ) : null}
      </span>
    );
  }

  const tone = !row.statsKnown ? "unknown" : row.status === "paused" ? "paused" : row.statusTone;
  const empty = row.statsKnown && row.total === 0 && row.status !== "complete";
  const rangeClippedBefore = geometry.from < range.start;
  const rangeClippedAfter = geometry.to > range.end;
  const from = rangeClippedBefore ? range.start : geometry.from;
  const to = rangeClippedAfter ? range.end : geometry.to;

  // ── Target only: a flag on the target and a hairline from today ─────────
  if (geometry.kind === "target-only") {
    const target = centre(to);
    const today = centre(todayIso);
    const [a, b] = today < target ? [today, target] : [target, today];
    return (
      <>
        <span className={styles.hairline} style={{ left: a, width: Math.max(0, b - a) }} />
        <span className={styles.flag} data-tone={geometry.pastTarget ? "danger" : undefined} style={{ left: target }}>
          <svg width="12" height="14" viewBox="0 0 12 14" fill="none" aria-hidden="true">
            <path d="M1.5 13V1.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            <path d="M1.5 1.75h8l-2 2.75 2 2.75h-8" fill="currentColor" />
          </svg>
        </span>
        <span className={styles.barWords} data-tone={label.tone === "default" ? undefined : label.tone} style={{ left: target + 12 }}>
          {label.text}
        </span>
      </>
    );
  }

  const left = x(from);
  const barWidth = Math.max(8, (diffDays(from, to) + 1) * ppd);
  let right = left + barWidth;

  // ── Open-ended: solid to today, then a dotted tail ──────────────────────
  const openEnded = geometry.kind === "open-ended";
  const solidTo = openEnded ? Math.min(right, Math.max(left + 8, centre(todayIso))) : right;

  // ── Past target: a hatched danger run from the day after to today ───────
  let tail: { left: number; width: number } | null = null;
  if (geometry.pastTarget && row.target && row.target >= range.start) {
    const tailFrom = addDays(row.target, 1);
    const tailTo = todayIso > range.end ? range.end : todayIso;
    if (tailFrom <= tailTo) {
      tail = { left: x(tailFrom), width: (diffDays(tailFrom, tailTo) + 1) * ppd };
      right = Math.max(right, tail.left + tail.width);
    }
  }

  const groups =
    showMilestones && row.statsKnown
      ? clusterMarks(
          row.milestones
            .filter((m) => m.date >= range.start && m.date <= range.end)
            .map((m) => ({ x: centre(m.date), item: m })),
          CLUSTER_GAP_PX,
        )
      : [];
  const lastMark = groups.reduce((max, group) => Math.max(max, group.x + (group.kind === "single" ? 7 : 12)), 0);
  // Open-ended: "No target date" must never read as a milestone's label. When
  // the dotted run ends at (or before) a diamond, carry it a fixed stub past
  // that diamond, then leave a clear gap before the words.
  if (openEnded && lastMark > 0 && lastMark >= right - 12) right = lastMark + OPEN_STUB_PX;
  const labelLeft = Math.max(right, lastMark) + (row.status === "complete" && row.statsKnown ? 20 : openEnded ? 12 : 8);
  const labelText = `${label.text}${row.milestoneOverflow > 0 ? ` · +${row.milestoneOverflow} more` : ""}`;
  const labelWidth = labelText.length * 6.9 + 4;
  // Outside the bar's end when it fits in the canvas, otherwise inside it.
  const inside = labelText !== "" && labelLeft + labelWidth > width - 8 && barWidth > labelWidth + 24;

  // Edge chevrons: where the bar runs off the visible window, or off the
  // drawn range itself, a chevron inside the edge carries the true date.
  const showFrom = rangeClippedBefore || (clipLeft && left < viewLeft);
  const showTo = rangeClippedAfter || (clipRight && right > viewRight);
  const fromLeft = Math.max(left, viewLeft) + 4;
  const toRight = Math.min(right, viewRight) - 4;

  return (
    <>
      <span
        className={styles.bar}
        data-tone={tone}
        data-empty={empty ? "" : undefined}
        data-open-ended={openEnded ? "" : undefined}
        data-past={geometry.pastTarget ? "" : undefined}
        style={{ left, width: (openEnded ? solidTo : left + barWidth) - left }}
      >
        {tone !== "unknown" && tone !== "accent" && tone !== "paused" && !empty ? (
          <span className={styles.barDone} style={{ width: `${geometry.percent}%` }} />
        ) : null}
        {row.status === "complete" && row.statsKnown ? (
          <span className={styles.barCheck} aria-hidden="true">
            <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
              <path d="m2.5 6.2 2.3 2.3 4.7-4.9" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
        ) : null}
      </span>
      {openEnded && right > solidTo ? (
        <span className={styles.barTail} style={{ left: solidTo, width: right - solidTo }} />
      ) : null}
      {tail ? <span className={styles.pastRun} style={{ left: tail.left, width: tail.width }} /> : null}

      {groups.map((group) => {
        if (group.kind === "single") {
          const stepped = steppedId === group.item.id;
          return (
            <span
              key={group.item.id}
              className={styles.diamond}
              data-tone={milestoneTone(row, group.item, todayIso)}
              data-stepped={stepped ? "" : undefined}
              style={{ left: group.x }}
            />
          );
        }
        const tones = group.items.map((m) => milestoneTone(row, m, todayIso));
        const stepped = group.items.some((m) => m.id === steppedId);
        return (
          <span
            key={group.items[0].id}
            className={styles.cluster}
            data-tone={clusterTone(tones)}
            data-stepped={stepped ? "" : undefined}
            style={{ left: group.x }}
          >
            {group.items.length}
          </span>
        );
      })}

      {showFrom ? (
        <button
          type="button"
          tabIndex={-1}
          className={styles.edge}
          data-side="left"
          style={{ left: fromLeft }}
          onClick={(event) => {
            event.stopPropagation();
            if (!rangeClippedBefore) onEdge?.(geometry.from!);
            else onEdge?.(range.start);
          }}
          onPointerDown={(event) => event.stopPropagation()}
          title={rangeClippedBefore ? `Started ${formatDayMonthYear(geometry.from)}` : `Scroll to the start, ${formatDayMonthYear(geometry.from)}`}
        >
          <svg width="10" height="10" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M10 3.5 5.5 8l4.5 4.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          {fromWords(geometry.from, todayIso)}
        </button>
      ) : null}
      {showTo ? (
        <button
          type="button"
          tabIndex={-1}
          className={styles.edge}
          data-side="right"
          style={{ left: toRight }}
          onClick={(event) => {
            event.stopPropagation();
            onEdge?.(rangeClippedAfter ? range.end : geometry.to!);
          }}
          onPointerDown={(event) => event.stopPropagation()}
          title={`Runs to ${formatDayMonthYear(geometry.to)}`}
        >
          {toWords(geometry.to, todayIso)}
          <svg width="10" height="10" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M6 3.5 10.5 8 6 12.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      ) : null}

      {labelText && !showTo ? (
        inside ? (
          <span
            className={styles.barLabel}
            data-inside=""
            data-on={tone === "accent" ? "accent" : undefined}
            style={{ left: right - 8, transform: "translateX(-100%)" }}
          >
            {labelText}
          </span>
        ) : (
          <span className={styles.barLabel} data-tone={label.tone === "default" ? undefined : label.tone} style={{ left: labelLeft }}>
            {labelText}
            {row.statsKnown && !row.target && !row.sample && row.role !== "member" && row.status !== "paused" && row.status !== "complete" && row.overviewHref ? (
              <>
                {" · "}
                <Link href={row.overviewHref} tabIndex={-1} className={styles.setOne} onClick={(event) => event.stopPropagation()}>
                  Set one →
                </Link>
              </>
            ) : null}
          </span>
        )
      ) : null}
    </>
  );
});
