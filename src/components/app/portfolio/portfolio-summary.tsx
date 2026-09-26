"use client";

/**
 * The answer, first (spec 3.1). One sentence says how many projects there
 * are and which one needs a look, with one quiet way to show it. Under it,
 * the status filter chips say the same split in words, and filter the grid.
 * The colour strip and the separate "Needs a look" band are gone.
 */

import { projectStatusOption } from "@/lib/projects/project-hub";
import {
  needsALook,
  needsALookAll,
  STATUS_FILTER_ORDER,
  STATUS_GROUP_LABELS,
  summaryCounts,
  type PortfolioRow,
  type StatusGroupKey,
} from "@/lib/projects/project-portfolio";
import { InfoPopover } from "./timeline-ui";
import styles from "./portfolio.module.css";

function toneOf(key: StatusGroupKey): string {
  if (key === "paused") return "paused";
  return projectStatusOption(key === "none" ? null : key).tone;
}

function projectsWord(count: number): string {
  return count === 1 ? "1 project" : `${count} projects`;
}

/** The sentence the page opens with. */
export function answerFor(
  rows: readonly PortfolioRow[],
  todayIso: string,
  statsKnown: boolean,
): { lead: string; name: string | null; rest: string; row: PortfolioRow | null } {
  const count = projectsWord(rows.length);
  if (!statsKnown) return { lead: `${count}.`, name: null, rest: "", row: null };
  if (rows.length > 0 && rows.every((row) => !row.target && row.status !== "complete")) {
    return { lead: `${count}.`, name: null, rest: " None of your projects has a target date yet.", row: null };
  }
  const look = needsALook(rows, todayIso);
  if (look) {
    const tail = look.sentence.startsWith(look.row.name) ? look.sentence.slice(look.row.name.length) : ` ${look.sentence}`;
    const more = needsALookAll(rows, todayIso).length - 1;
    const rest = more > 0 ? `${tail.replace(/\.$/, "")}, and ${more} more ${more === 1 ? "needs" : "need"} a look.` : tail;
    return { lead: `${count}. `, name: look.row.name, rest, row: look.row };
  }
  const counts = summaryCounts(rows).byStatus;
  const calm = counts["on-track"] + counts.paused + counts.complete === rows.length;
  return {
    lead: `${count}`,
    name: null,
    rest: calm ? ", all on track, paused or done." : ". Nothing needs a look today.",
    row: null,
  };
}

export function PortfolioAnswer({
  rows,
  todayIso,
  statsKnown,
  onShow,
}: {
  rows: readonly PortfolioRow[];
  todayIso: string;
  statsKnown: boolean;
  onShow: (row: PortfolioRow) => void;
}) {
  const answer = answerFor(rows, todayIso, statsKnown);
  return (
    <p className={styles.answer} data-portfolio-answer="">
      <span>
        {answer.lead}
        {answer.name ? <strong className={styles.answerName}>{answer.name}</strong> : null}
        {answer.rest}
      </span>
      {answer.row ? (
        <button type="button" className={styles.linkButton} onClick={() => onShow(answer.row!)}>
          Show it
        </button>
      ) : null}
    </p>
  );
}

export function StatusFilterChips({
  rows,
  selected,
  onToggle,
}: {
  rows: readonly PortfolioRow[];
  selected: ReadonlySet<StatusGroupKey>;
  onToggle: (key: StatusGroupKey) => void;
}) {
  const counts = summaryCounts(rows).byStatus;
  const present = STATUS_FILTER_ORDER.filter((key) => counts[key] > 0);
  if (present.length === 0) return null;
  return (
    <div className={styles.chips} role="group" aria-label="Show projects by status">
      {present.map((key) => {
        const on = selected.has(key);
        return (
          <button
            key={key}
            type="button"
            className={styles.chip}
            aria-pressed={on}
            data-tone={toneOf(key)}
            onClick={() => onToggle(key)}
          >
            <span className={styles.chipDot} data-tone={toneOf(key)} aria-hidden="true" />
            {counts[key]} {STATUS_GROUP_LABELS[key].toLowerCase()}
            {on ? (
              <svg className={styles.chipCheck} width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path d="m3.5 8.5 3 3 6-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

/** "6 sample rows · review only ⓘ": review only, one line, never a banner. */
export function SampleNote({ count }: { count: number }) {
  if (count <= 0) return null;
  const word = count === 1 ? "One of these projects is" : `${count === 6 ? "Six" : count === 5 ? "Five" : count} of these projects are`;
  return (
    <span className={styles.sampleNote}>
      {count === 1 ? "1 sample row" : `${count} sample rows`} · review only
      <InfoPopover label="About the sample rows">
        {word} made up to show how this works. They are not saved anywhere and open nothing.
      </InfoPopover>
    </span>
  );
}
