/**
 * A combined timeline: several Projects' big dates on one strip, and the
 * week where the most of them fall (sprint item 8, 6 Oct 2026).
 *
 * The choice lives in the address as `?with=<id>,<id>` so a view can be
 * linked and survives a reload. Pure and client-safe: no clock, database or
 * network. Every date comes from the portfolio rows the page already read.
 */

import type { PortfolioRow } from "@/lib/projects/project-portfolio";
import { addDays, isIsoDay, startOfWeek } from "@/lib/projects/project-portfolio-scale";

/** More than this and the strip stops being readable as one line. */
export const COMBINED_LIMIT = 6;

export const COMBINED_PARAM = "with";

/** `?with=` → the chosen ids, in order, unique, at most the limit. */
export function parseCombined(raw: string | null | undefined): string[] {
  if (!raw) return [];
  const ids: string[] = [];
  for (const part of raw.split(",")) {
    const id = part.trim();
    if (id && !ids.includes(id) && ids.length < COMBINED_LIMIT) ids.push(id);
  }
  return ids;
}

export function serializeCombined(ids: readonly string[]): string | null {
  return ids.length ? ids.slice(0, COMBINED_LIMIT).join(",") : null;
}

/** Adds or removes one id; a full selection refuses an addition. */
export function toggleCombined(ids: readonly string[], id: string): string[] {
  if (ids.includes(id)) return ids.filter((x) => x !== id);
  return ids.length >= COMBINED_LIMIT ? [...ids] : [...ids, id];
}

export type CombinedMark = Readonly<{
  projectId: string;
  projectName: string;
  id: string;
  title: string;
  date: string;
}>;

/**
 * The chosen Projects' big dates still to come (today counts), oldest first.
 * Ids the reader cannot see are simply absent: the rows decide.
 */
export function combinedMarks(rows: readonly PortfolioRow[], ids: readonly string[], todayIso: string): CombinedMark[] {
  const marks: CombinedMark[] = [];
  for (const id of ids) {
    const row = rows.find((r) => r.id === id);
    if (!row) continue;
    for (const m of row.milestones) {
      if (m.done || !isIsoDay(m.date) || m.date < todayIso) continue;
      marks.push({ projectId: row.id, projectName: row.name, id: m.id, title: m.title, date: m.date });
    }
  }
  return marks.sort((a, b) => a.date.localeCompare(b.date) || a.projectName.localeCompare(b.projectName, "en-GB"));
}

export type TightestWeek = Readonly<{
  /** Monday, `YYYY-MM-DD`. */
  start: string;
  /** Sunday. */
  end: string;
  count: number;
  projectIds: readonly string[];
}>;

/**
 * The Monday-to-Sunday week holding the most big dates, counting only weeks
 * with at least two. Ties go to the earliest week, because that is the one
 * to prepare for first. Null when no week holds two.
 */
export function tightestWeek(marks: readonly CombinedMark[]): TightestWeek | null {
  const weeks = new Map<string, CombinedMark[]>();
  for (const mark of marks) {
    const monday = startOfWeek(mark.date);
    weeks.set(monday, [...(weeks.get(monday) ?? []), mark]);
  }
  let best: TightestWeek | null = null;
  for (const [start, inWeek] of [...weeks.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    if (inWeek.length < 2) continue;
    if (!best || inWeek.length > best.count) {
      best = {
        start,
        end: addDays(start, 6),
        count: inWeek.length,
        projectIds: [...new Set(inWeek.map((m) => m.projectId))],
      };
    }
  }
  return best;
}
