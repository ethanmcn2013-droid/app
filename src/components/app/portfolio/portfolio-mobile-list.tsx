"use client";

/**
 * All projects on a phone (spec 3.3): one card per Project, and every card's
 * strip shares ONE window, from two weeks ago out to 3, 6 or 12 months, so
 * the bars stay comparable down the list. The window maps to `?zoom`
 * (Weeks, Months, Quarters), so desktop and phone share state.
 *
 * The whole card is one link, 112px or taller. A 44px ⓘ in its corner opens
 * the same facts as the desktop card, as a bottom sheet with a focus trap.
 * Sample cards open the sheet only. Group and Sort live in one Arrange sheet.
 * Nothing in the window is said in words, never shown as an empty strip.
 */

import { useId, useState } from "react";
import Link from "next/link";
import { progressPercent, taskProgressLabel } from "@/lib/projects/project-hub";
import {
  barGeometry,
  GROUP_OPTIONS,
  milestoneTone,
  rowAccessibleLabel,
  SORT_OPTIONS,
  type PortfolioGroup,
  type PortfolioGroupBy,
  type PortfolioRow as Row,
  type PortfolioSort,
} from "@/lib/projects/project-portfolio";
import {
  addDays,
  addMonths,
  diffDays,
  formatShortDay,
  relativeDayPhrase,
  SHORT_MONTHS,
  startOfMonth,
  stripExtent,
  stripPct,
  type StripWindow,
  type Zoom,
} from "@/lib/projects/project-portfolio-scale";
import { projectColor } from "@/components/shell/app-sidebar";
import { ProjectFacts, StatusPill } from "./portfolio-hover-card";
import { ChevronDown, ChevronRight, InfoIcon, Sheet } from "./timeline-ui";
import styles from "./portfolio-mobile.module.css";

const WINDOWS: readonly { zoom: Zoom; label: string; months: number }[] = [
  { zoom: "weeks", label: "Next 3 months", months: 3 },
  { zoom: "months", label: "Next 6 months", months: 6 },
  { zoom: "quarters", label: "Next year", months: 12 },
];

type Window = StripWindow;

function windowFor(zoom: Zoom, todayIso: string): Window {
  const months = WINDOWS.find((option) => option.zoom === zoom)?.months ?? 6;
  const start = addDays(todayIso, -14);
  const end = addMonths(todayIso, months);
  return { start, end, days: diffDays(start, end) + 1 };
}

const pct = stripPct;

function MiniStrip({ row, w, todayIso, showMilestones }: { row: Row; w: Window; todayIso: string; showMilestones: boolean }) {
  const clipId = `strip-${useId().replace(/:/g, "")}`;
  const g = barGeometry(row, todayIso);
  const months: string[] = [];
  for (let day = startOfMonth(addMonths(w.start, 1)); day <= w.end; day = addMonths(day, 1)) months.push(day);
  const stepEvery = months.length > 7 ? 2 : 1;

  if (!g.from || !g.to) {
    return <p className={styles.windowWords}>No dates yet</p>;
  }
  const drawnTo = g.pastTarget ? (todayIso > g.to ? todayIso : g.to) : g.to;
  if (drawnTo < w.start) {
    return <p className={styles.windowWords}>Ended {formatShortDay(g.to, todayIso)}, before this window</p>;
  }
  if (g.from > w.end) {
    return <p className={styles.windowWords}>Starts {formatShortDay(g.from, todayIso)}, after this window</p>;
  }
  const extent = stripExtent({ from: g.from, to: g.to, percent: g.percent }, w);
  const from = extent.barFrom;
  const to = extent.barTo;
  // A bar cut by the window edge runs on past it and is clipped there, so
  // its end is square and never reads as a start or a finish.
  const drawFrom = extent.clippedStart ? -4 : from;
  const drawTo = extent.clippedEnd ? 104 : to;
  const today = pct(todayIso, w);
  const tone = !row.statsKnown ? "unknown" : row.status === "paused" ? "paused" : row.statusTone;
  const marks = showMilestones ? row.milestones.filter((m) => m.date >= w.start && m.date <= w.end) : [];

  return (
    <div className={styles.strip} aria-hidden="true">
      <svg className={styles.stripSvg} width="100%" height="36">
        <defs>
          <clipPath id={clipId}>
            <rect x="0" y="0" width="100%" height="36" />
          </clipPath>
        </defs>
        {months.map((day, index) =>
          index % stepEvery === 0 ? <line key={day} x1={`${pct(day, w)}%`} x2={`${pct(day, w)}%`} y1="0" y2="22" className={styles.stripTick} /> : null,
        )}
        {g.kind === "target-only" ? (
          <line x1={`${Math.min(today, to)}%`} x2={`${Math.max(today, to)}%`} y1="11" y2="11" className={styles.stripHair} />
        ) : (
          <>
            <g clipPath={`url(#${clipId})`}>
              <rect x={`${drawFrom}%`} y="5" width={`${Math.max(1.2, drawTo - drawFrom)}%`} height="12" rx="3" className={styles.stripBar} data-tone={tone} />
              {tone !== "unknown" && tone !== "paused" && tone !== "accent" && extent.doneTo !== null && extent.doneTo > from ? (
                <rect x={`${drawFrom}%`} y="5" width={`${extent.doneTo - drawFrom}%`} height="12" rx="3" className={styles.stripDone} data-tone={tone} />
              ) : null}
            </g>
            {g.pastTarget ? (
              <rect x={`${to}%`} y="5" width={`${Math.max(0.8, today - to)}%`} height="12" className={styles.stripPast} />
            ) : null}
          </>
        )}
        {marks.map((m) => (
          <svg key={m.id} x={`${pct(m.date, w)}%`} y="11" width="1" height="1" overflow="visible">
            <rect x="-4" y="-4" width="8" height="8" rx="1.2" transform="rotate(45)" className={styles.stripDiamond} data-tone={milestoneTone(row, m, todayIso)} />
          </svg>
        ))}
        <line x1={`${today}%`} x2={`${today}%`} y1="0" y2="22" className={styles.stripToday} />
      </svg>
      <span className={styles.stripLabels}>
        {months.map((day, index) =>
          index % stepEvery === 0 ? (
            <span key={day} style={{ left: `${pct(day, w)}%` }}>
              {SHORT_MONTHS[Number(day.slice(5, 7)) - 1]}
            </span>
          ) : null,
        )}
      </span>
    </div>
  );
}

function TargetLine({ row, todayIso }: { row: Row; todayIso: string }) {
  const g = barGeometry(row, todayIso);
  if (!row.statsKnown) return <p className={styles.line}>Progress and dates couldn&apos;t be loaded</p>;
  if (g.pastTarget) {
    return (
      <p className={styles.line} data-tone="danger">
        {g.daysPast === 1 ? "1 day past target" : `${g.daysPast} days past target`} · {formatShortDay(row.target!, todayIso)}
      </p>
    );
  }
  if (row.status === "complete") return <p className={styles.line}>Done{row.target ? ` ${formatShortDay(row.target, todayIso)}` : ""}</p>;
  if (!row.target) return <p className={styles.line}>No target date</p>;
  return (
    <p className={styles.line}>
      Target {formatShortDay(row.target, todayIso)} · {relativeDayPhrase(row.target, todayIso)}
    </p>
  );
}

export function PortfolioMobileList({
  groups,
  groupBy,
  sort,
  zoom,
  todayIso,
  openProjectId,
  showMilestones,
  collapsed,
  onToggleGroup,
  onZoom,
  onGroup,
  onSort,
  onActivate,
  onShowAll,
}: {
  groups: readonly PortfolioGroup[];
  groupBy: PortfolioGroupBy;
  sort: PortfolioSort;
  zoom: Zoom;
  todayIso: string;
  openProjectId: string | null;
  showMilestones: boolean;
  collapsed: ReadonlySet<string>;
  onToggleGroup: (key: string) => void;
  onZoom: (zoom: Zoom) => void;
  onGroup: (group: PortfolioGroupBy) => void;
  onSort: (sort: PortfolioSort) => void;
  onActivate: (row: Row) => void;
  onShowAll: () => void;
}) {
  const [arrangeOpen, setArrangeOpen] = useState(false);
  const [factsFor, setFactsFor] = useState<Row | null>(null);
  const w = windowFor(zoom, todayIso);

  return (
    <>
      <div className={styles.bar}>
        <label className={styles.window}>
          <span className={styles.windowLabel}>Showing</span>
          <select className={styles.windowSelect} value={zoom} onChange={(event) => onZoom(event.target.value as Zoom)}>
            {WINDOWS.map((option) => (
              <option key={option.zoom} value={option.zoom}>
                {option.label}
              </option>
            ))}
          </select>
          <ChevronDown size={13} className={styles.windowChevron} />
        </label>
        <button type="button" className={styles.arrange} onClick={() => setArrangeOpen(true)}>
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M3 4.5h10M5 8h6M7 11.5h2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          Arrange
        </button>
      </div>

      {groups.length === 0 ? (
        <div className={styles.empty}>
          <p>No projects match these filters.</p>
          <button type="button" className={styles.arrange} onClick={onShowAll}>
            Show all
          </button>
        </div>
      ) : null}

      <div className={styles.list}>
        {groups.map((group) => {
          const folded = groupBy === "status" && collapsed.has(group.key);
          return (
            <section key={group.key} className={styles.group} aria-label={group.label}>
              {groupBy === "status" ? (
                <button type="button" className={styles.groupHead} aria-expanded={!folded} onClick={() => onToggleGroup(group.key)}>
                  <ChevronRight size={12} className={styles.groupChevron} />
                  {group.label} · {group.rows.length}
                </button>
              ) : null}
              {folded ? null : (
                <ul className={styles.cards}>
                  {group.rows.map((row) => {
                    const pctDone = row.status === "complete" ? 100 : progressPercent(row.complete, row.total);
                    const body = (
                      <>
                        <span className={styles.head}>
                          <span className={styles.tile} style={{ background: projectColor(row.id) }} aria-hidden="true">
                            {row.monogram}
                          </span>
                          <span className={styles.name}>{row.name}</span>
                          {row.sample ? <span className={styles.sample}>Sample</span> : null}
                          {row.id === openProjectId ? <span className={styles.openNow}>Open now</span> : null}
                        </span>
                        <span className={styles.status}>
                          <StatusPill row={row} />
                        </span>
                        <TargetLine row={row} todayIso={todayIso} />
                        {row.statsKnown && row.total > 0 ? (
                          <span className={styles.progress}>
                            <span className={styles.progressBar} data-tone={row.statusTone} aria-hidden="true">
                              <span style={{ width: `${pctDone}%` }} />
                            </span>
                            {taskProgressLabel(row.complete, row.total)}
                            {row.overdue > 0 ? <span className={styles.late}> · {row.overdue} late</span> : null}
                          </span>
                        ) : null}
                        <MiniStrip row={row} w={w} todayIso={todayIso} showMilestones={showMilestones && row.statsKnown} />
                      </>
                    );
                    return (
                      <li key={row.id} className={styles.cardItem}>
                        {row.href ? (
                          <Link href={row.href} className={styles.card} aria-label={rowAccessibleLabel(row, todayIso)} data-open-now={row.id === openProjectId ? "" : undefined}>
                            {body}
                          </Link>
                        ) : (
                          <button
                            type="button"
                            className={styles.card}
                            aria-label={`${rowAccessibleLabel(row, todayIso)}. Show details`}
                            onClick={() => (row.sample ? setFactsFor(row) : onActivate(row))}
                          >
                            {body}
                          </button>
                        )}
                        <button type="button" className={styles.info} aria-label={`Details for ${row.name}`} onClick={() => setFactsFor(row)}>
                          <InfoIcon size={17} />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          );
        })}
      </div>

      <Sheet
        open={factsFor !== null}
        onClose={() => setFactsFor(null)}
        title={factsFor?.name ?? "Project"}
        subtitle={factsFor ? <StatusPill row={factsFor} /> : null}
        footer={
          factsFor && !factsFor.sample ? (
            <div className={styles.sheetActions}>
              {factsFor.href ? (
                <Link href={factsFor.href} className={styles.primary}>
                  Open timeline
                </Link>
              ) : null}
              {factsFor.overviewHref ? (
                <Link href={factsFor.overviewHref} className={styles.arrange}>
                  Project overview
                </Link>
              ) : null}
            </div>
          ) : undefined
        }
      >
        {factsFor ? (
          <div className={styles.facts}>
            {factsFor.purpose ? <p className={styles.purpose}>{factsFor.purpose}</p> : null}
            <ProjectFacts row={factsFor} todayIso={todayIso} />
            {factsFor.sample ? <p className={styles.sampleNote}>Made up to show how this works. Opens nothing.</p> : null}
            {!factsFor.selectable ? <p className={styles.sampleNote}>{factsFor.blockedReason ?? "This project can't be opened from here."}</p> : null}
          </div>
        ) : null}
      </Sheet>

      <Sheet open={arrangeOpen} onClose={() => setArrangeOpen(false)} title="Arrange" width={420}>
        <fieldset className={styles.fieldset}>
          <legend className={styles.legend}>Group by</legend>
          {GROUP_OPTIONS.map((option) => (
            <label key={option.value} className={styles.option}>
              <input type="radio" name="portfolio-group" value={option.value} checked={groupBy === option.value} onChange={() => onGroup(option.value)} />
              {option.label}
            </label>
          ))}
        </fieldset>
        <fieldset className={styles.fieldset}>
          <legend className={styles.legend}>Sort by</legend>
          {SORT_OPTIONS.map((option) => (
            <label key={option.value} className={styles.option}>
              <input type="radio" name="portfolio-sort" value={option.value} checked={sort === option.value} onChange={() => onSort(option.value)} />
              {option.label}
            </label>
          ))}
        </fieldset>
        <button type="button" className={`${styles.primary} ${styles.done}`} onClick={() => setArrangeOpen(false)}>
          Done
        </button>
      </Sheet>
    </>
  );
}
