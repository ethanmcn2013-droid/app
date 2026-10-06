/**
 * Analytics, "Every project": the wall of cards, as a pure model.
 *
 * The rows are the Projects console's own (`buildConsole`): how each Project
 * is doing, done of total, the late count, the next big date and the lead all
 * follow the rules written there, so this page and Projects cannot disagree.
 * The wall adds only the finished-work days the same read already carries.
 *
 * Nothing is forecast. A figure the read did not give is absent from its
 * card. Pure and client-safe; pinned by `project-analytics-wall.test.ts`.
 */

import {
  CONSOLE_DAYS,
  buildConsole,
  consoleGroups,
  type ConsoleMark,
  type ConsoleProjectInput,
  type ConsoleRow,
} from "@/lib/projects/project-console";

export type WallSort = "look" | "late" | "date" | "name";

export const WALL_SORTS: ReadonlyArray<Readonly<{ id: WallSort; label: string }>> = [
  { id: "look", label: "Needs a look" },
  { id: "late", label: "Most late" },
  { id: "date", label: "Next date" },
  { id: "name", label: "Name" },
];

export function parseWallSort(raw: unknown): WallSort {
  return WALL_SORTS.find((sort) => sort.id === raw)?.id ?? "look";
}

export type WallCard = Readonly<{
  id: string;
  name: string;
  mark: ConsoleMark;
  markLabel: string;
  tone: "late" | "risk" | "calm";
  /** "Aoife Brennan leads", "You lead", or null when the owner was not read. */
  lead: string | null;
  /** "in 12 days" and what the date is, or null when no date is set. */
  next: Readonly<{ when: string; what: string; late: boolean }> | null;
  open: number;
  late: number;
  /** "23 of 44", or null when task counts were not read. */
  done: Readonly<{ complete: number; total: number; share: number }> | null;
  /** Finished in the last seven days and the seven before; null when not read. */
  week: Readonly<{ done: number; before: number; days: readonly number[]; top: number }> | null;
  /** The oldest late task, named under the late count. */
  oldestLate: string | null;
  selectable: boolean;
  blockedReason: string | null;
}>;

export type WallModel = Readonly<{
  today: string;
  cards: readonly WallCard[];
  /** Projects marked complete; listed on Projects, not here. */
  wrapped: number;
  summary: ReadonlyArray<Readonly<{ text: string; tone?: "late" | "risk" }>>;
  /** One line about last week across every card, or null without the read. */
  weekLine: string | null;
}>;

function toCard(row: ConsoleRow, input: ConsoleProjectInput): WallCard {
  const days = input.facts && input.facts.doneByDay.length === CONSOLE_DAYS ? input.facts.doneByDay : null;
  const stats = input.stats;
  return {
    id: row.id,
    name: row.name,
    mark: row.mark,
    markLabel: row.markLabel,
    tone: row.mark === "past_date" ? "late" : row.mark === "at_risk" ? "risk" : "calm",
    lead: row.ledByYou ? "You lead" : input.facts?.lead ? `${input.facts.lead.name} leads` : null,
    next: row.next.quiet ? null : { when: row.next.value, what: row.next.caption, late: row.next.tone === "late" },
    open: row.open,
    late: row.late,
    done: stats ? { complete: stats.complete, total: stats.total, share: stats.total === 0 ? 0 : stats.complete / stats.total } : null,
    week: days
      ? {
          done: days.slice(7).reduce((sum, n) => sum + n, 0),
          before: days.slice(0, 7).reduce((sum, n) => sum + n, 0),
          days,
          top: Math.max(1, ...days),
        }
      : null,
    oldestLate: row.late > 0 && input.facts?.oldestLate ? input.facts.oldestLate.title : null,
    selectable: row.selectable,
    blockedReason: row.blockedReason,
  };
}

function compare(sort: WallSort): ((a: WallCard, b: WallCard) => number) | null {
  const byName = (a: WallCard, b: WallCard) => a.name.localeCompare(b.name, "en") || a.id.localeCompare(b.id);
  if (sort === "name") return byName;
  if (sort === "late") return (a, b) => b.late - a.late || byName(a, b);
  return null;
}

export function buildWall(projects: readonly ConsoleProjectInput[], today: string, sort: WallSort = "look"): WallModel {
  const model = buildConsole(projects, today);
  const inputs = new Map(projects.map((project) => [project.id, project]));
  // The console's own order: needs a look first, then on track, paused, unset.
  const ordered = consoleGroups(model, "all").flatMap((group) => group.rows);
  let cards = ordered.map((row) => toCard(row, inputs.get(row.id)!));

  if (sort === "date") {
    const dated = new Map(ordered.map((row) => [row.id, row.nextDate]));
    cards = [...cards].sort((a, b) => {
      const x = dated.get(a.id) ?? null;
      const y = dated.get(b.id) ?? null;
      if (x !== y) {
        if (x === null) return 1;
        if (y === null) return -1;
        return x.localeCompare(y);
      }
      return a.name.localeCompare(b.name, "en");
    });
  } else {
    const order = compare(sort);
    if (order) cards = [...cards].sort(order);
  }

  const withWeek = cards.filter((card) => card.week !== null);
  let weekLine: string | null = null;
  if (cards.length > 0 && withWeek.length === cards.length) {
    const done = withWeek.reduce((sum, card) => sum + card.week!.done, 0);
    const before = withWeek.reduce((sum, card) => sum + card.week!.before, 0);
    const busiest = [...withWeek].sort((a, b) => b.week!.done - a.week!.done || a.name.localeCompare(b.name, "en"))[0]!;
    const lead = `${done} ${done === 1 ? "task" : "tasks"} finished across ${cards.length === 1 ? "this project" : "these projects"} in the last 7 days`;
    const most = cards.length > 1 && busiest.week!.done > 0 ? `, most in ${busiest.name} (${busiest.week!.done})` : "";
    weekLine = `${lead}${most}. The week before: ${before}.`;
  }

  return {
    today,
    cards,
    wrapped: model.counts.wrapped,
    summary: model.summary,
    weekLine,
  };
}
