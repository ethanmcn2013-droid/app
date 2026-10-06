"use client";

/**
 * Combined timeline: the chosen Projects' big dates on one strip, above the
 * chart (sprint item 8, 6 Oct 2026).
 *
 * People choose Projects from a row's menu ("Add to combined timeline"); the
 * choice is kept in the address (`?with=`). One chosen shows the chip and a
 * line asking for a second. Two or more draw one strip from the first date
 * still to come to the last, a dot per date in its Project's own colour, the
 * tightest week shaded and named in a sentence with "Show that week", and the
 * dates in order underneath for anyone not reading the strip.
 */

import type { CSSProperties } from "react";
import { projectColor } from "@/components/shell/app-sidebar";
import type { PortfolioRow } from "@/lib/projects/project-portfolio";
import { diffDays, formatShortDay, formatWeekdayDate } from "@/lib/projects/project-portfolio-scale";
import { COMBINED_LIMIT, combinedMarks, tightestWeek } from "@/lib/projects/combined-timeline";
import styles from "./combined-timeline.module.css";

export function CombinedTimeline({
  rows,
  ids,
  todayIso,
  onRemove,
  onClear,
  onShowWeek,
}: {
  rows: readonly PortfolioRow[];
  ids: readonly string[];
  todayIso: string;
  onRemove: (id: string) => void;
  onClear: () => void;
  onShowWeek: (mondayIso: string) => void;
}) {
  const chosen = ids.map((id) => rows.find((row) => row.id === id)).filter((row): row is PortfolioRow => Boolean(row));
  if (chosen.length === 0) return null;
  const marks = combinedMarks(rows, ids, todayIso);
  const week = tightestWeek(marks);
  const first = marks[0]?.date;
  const last = marks.at(-1)?.date;
  const span = first && last ? Math.max(1, diffDays(first, last)) : 1;
  const at = (iso: string) => (first ? (diffDays(first, iso) / span) * 100 : 0);
  const nameOf = (id: string) => chosen.find((row) => row.id === id)?.name ?? "";

  return (
    <section className={styles.panel} aria-labelledby="combined-timeline-title" data-combined-timeline="">
      <div className={styles.head}>
        <h2 className={styles.title} id="combined-timeline-title">
          Combined timeline
        </h2>
        <ul className={styles.chips} aria-label="Projects in the combined timeline">
          {chosen.map((row) => (
            <li key={row.id} className={styles.chip}>
              <span className={styles.tile} style={{ backgroundColor: projectColor(row.id) }} aria-hidden="true">
                {row.name.trim().slice(0, 1).toUpperCase()}
              </span>
              <span className={styles.chipName}>{row.name}</span>
              <button type="button" className={styles.remove} aria-label={`Take ${row.name} out of the combined timeline`} onClick={() => onRemove(row.id)}>
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
                  <path d="M3 3l6 6M9 3l-6 6" />
                </svg>
              </button>
            </li>
          ))}
        </ul>
        <button type="button" className={styles.clear} onClick={onClear}>
          Clear
        </button>
      </div>

      {chosen.length < 2 ? (
        <p className={styles.hint}>Add one more project from its menu to see their dates together. Up to {COMBINED_LIMIT}.</p>
      ) : marks.length === 0 ? (
        <p className={styles.hint}>None of these projects has a big date still to come.</p>
      ) : (
        <>
          {week ? (
            <p className={styles.callout}>
              <strong>
                Tightest week: {formatWeekdayDate(week.start)} to {formatShortDay(week.end, todayIso)}
              </strong>
              <span>
                {week.count} big dates
                {week.projectIds.length > 1 ? ` across ${week.projectIds.map(nameOf).join(" and ")}` : ` in ${nameOf(week.projectIds[0]!)}`}.
              </span>
              <button type="button" className={styles.show} onClick={() => onShowWeek(week.start)}>
                Show that week
              </button>
            </p>
          ) : (
            <p className={styles.hint}>No week has more than one big date. Nothing bunches up.</p>
          )}
          <div className={styles.strip} aria-hidden="true">
            {week ? (
              <span
                className={styles.week}
                style={{ left: `${Math.max(0, at(week.start))}%`, width: `${Math.max(1.5, Math.min(100, at(week.end)) - Math.max(0, at(week.start)))}%` }}
              />
            ) : null}
            <span className={styles.line} />
            {marks.map((mark) => (
              <span
                key={`${mark.projectId}-${mark.id}`}
                className={styles.dot}
                style={{ left: `${at(mark.date)}%`, "--dot": projectColor(mark.projectId) } as CSSProperties}
                title={`${mark.title}, ${mark.projectName}, ${formatShortDay(mark.date, todayIso)}`}
              />
            ))}
            <span className={styles.edge} data-side="start">{formatShortDay(first!, todayIso)}</span>
            <span className={styles.edge} data-side="end">{formatShortDay(last!, todayIso)}</span>
          </div>
          <ol className={styles.list} aria-label="Big dates still to come, in order">
            {marks.map((mark) => (
              <li key={`${mark.projectId}-${mark.id}`} data-in-week={week && mark.date >= week.start && mark.date <= week.end ? "" : undefined}>
                <time dateTime={mark.date}>{formatShortDay(mark.date, todayIso)}</time>
                <span className={styles.markTitle}>{mark.title}</span>
                <span className={styles.markProject}>
                  <span className={styles.swatch} style={{ backgroundColor: projectColor(mark.projectId) }} aria-hidden="true" />
                  {mark.projectName}
                </span>
              </li>
            ))}
          </ol>
        </>
      )}
    </section>
  );
}
