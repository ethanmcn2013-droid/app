/**
 * All projects: the presentation model (v3 redesign, 24 Sep 2026).
 *
 * `/app/timeline` opens on every Project the reader can open, one bar each on
 * one time scale. This module turns the server's facts into rows, groups,
 * sorts, bar geometry and the sentences the page speaks. Pure and client-safe;
 * the read lives in `src/server/projects/project-portfolio.ts`, which only ever
 * passes facts for Projects the chooser catalog already authorized.
 *
 * Status vocabulary and progress arithmetic come from the Projects hub
 * (`project-hub.ts`), so a Project reads the same on its card, its overview
 * and its bar.
 */

import {
  progressPercent,
  projectStatusOption,
  targetDatePassed,
  type ProjectCardStats,
  type ProjectStatus,
  type ProjectStatusTone,
} from "@/lib/projects/project-hub";
import {
  addDays,
  diffDays,
  formatLongDay,
  formatShortDay,
  isIsoDay,
  parseZoom,
  type Zoom,
} from "@/lib/projects/project-portfolio-scale";

// ── Rows ───────────────────────────────────────────────────────────────────

export type PortfolioMilestone = Readonly<{
  id: string;
  title: string;
  /** `YYYY-MM-DD`. Undated milestones are not drawn on a bar. */
  date: string;
  done: boolean;
}>;

export type PortfolioRole = "primary-owner" | "owner" | "member";

export type PortfolioRow = Readonly<{
  id: string;
  name: string;
  monogram: string;
  role: PortfolioRole;
  /** False for an ambiguous Project: shown, never opened from here. */
  selectable: boolean;
  blockedReason: string | null;
  archived: boolean;
  status: ProjectStatus;
  statusTone: ProjectStatusTone;
  purpose: string | null;
  /** When work began: the earliest task (created or due), else the Project's creation. */
  start: string | null;
  startSource: "first-task" | "created" | null;
  target: string | null;
  complete: number;
  total: number;
  overdue: number;
  /** False when the stats read failed; the bar becomes a neutral track. */
  statsKnown: boolean;
  milestones: readonly PortfolioMilestone[];
  /** Dated milestones beyond the per-row cap, counted not drawn. */
  milestoneOverflow: number;
  /** The Timeline plan this Project opens into, when known. */
  timelineName: string | null;
  /** Opens this Project's timeline. Null for samples and blocked rows. */
  href: string | null;
  /** Opens this Project's overview. Null for samples. */
  overviewHref: string | null;
  /** A made-up review row. Never navigates. */
  sample: boolean;
}>;

/** What the server hands All projects. Plain data; it crosses to the client. */
export type ProjectPortfolio =
  | Readonly<{
      kind: "ready";
      /** Active Projects in catalog order (review: the real one, then samples). */
      rows: readonly PortfolioRow[];
      /** Archived Projects: names only, opened read-only on their overview. */
      archived: readonly PortfolioRow[];
      /** The catalog, or the stats read, stopped at its limit. */
      truncated: boolean;
      statsUnavailable: boolean;
      milestonesUnavailable: boolean;
      /** Review: five of these rows are made up. */
      sample: boolean;
      /** The one "today" every bar and phrase on the page uses. */
      todayIso: string;
    }>
  | Readonly<{ kind: "unavailable"; todayIso: string }>;

/** Milestones drawn per bar; the rest are counted. */
export const MILESTONES_PER_ROW = 12;

export const PORTFOLIO_ROW_LIMIT = 200;

/** Where a row opens: the index resolves and authorizes it (spec §2). */
export function portfolioRowHref(projectId: string): string {
  const query = new URLSearchParams({ workspaceId: projectId, open: "project" });
  return `/app/timeline?${query.toString()}`;
}

export type CatalogRowInput = Readonly<{
  id: string;
  name: string;
  monogram: string;
  role: PortfolioRole;
  selectable: boolean;
  blockedReason: string | null;
  archived: boolean;
}>;

export type StartFacts = Readonly<{
  firstTaskCreated: string | null;
  firstTaskDue: string | null;
  projectCreated: string | null;
}>;

/** The earlier of the first task's creation or due date wins; creation of the Project is the fallback. */
export function resolveStart(facts: StartFacts | undefined): Pick<PortfolioRow, "start" | "startSource"> {
  if (!facts) return { start: null, startSource: null };
  const taskDays = [facts.firstTaskCreated, facts.firstTaskDue].filter(isIsoDay).map((d) => d.slice(0, 10)).sort();
  if (taskDays.length > 0) return { start: taskDays[0], startSource: "first-task" };
  if (isIsoDay(facts.projectCreated)) return { start: facts.projectCreated.slice(0, 10), startSource: "created" };
  return { start: null, startSource: null };
}

/**
 * Build rows for exactly the catalog's Projects, in the catalog's order.
 *
 * Facts keyed by any other id are ignored: a stats map can never add a row,
 * and a row can never borrow another Project's figures. This is the pure half
 * of "the portfolio read summarizes catalog ids only".
 */
export function assemblePortfolioRows(
  catalog: readonly CatalogRowInput[],
  facts: Readonly<{
    stats: ReadonlyMap<string, ProjectCardStats>;
    starts: ReadonlyMap<string, StartFacts>;
    milestones: ReadonlyMap<string, readonly PortfolioMilestone[]>;
    timelineNames?: ReadonlyMap<string, string>;
    statsAvailable: boolean;
  }>,
): PortfolioRow[] {
  return catalog.map((entry) => {
    const stats = facts.stats.get(entry.id);
    const status = stats?.status ?? null;
    const dated = (facts.milestones.get(entry.id) ?? []).filter((m) => isIsoDay(m.date));
    const openable = entry.selectable && !entry.archived;
    return {
      ...entry,
      status,
      statusTone: projectStatusOption(status).tone,
      purpose: stats?.purpose ?? null,
      ...resolveStart(facts.starts.get(entry.id)),
      target: stats?.targetDate && isIsoDay(stats.targetDate) ? stats.targetDate.slice(0, 10) : null,
      complete: stats?.complete ?? 0,
      total: stats?.total ?? 0,
      overdue: stats?.overdue ?? 0,
      statsKnown: facts.statsAvailable && stats !== undefined,
      milestones: dated.slice(0, MILESTONES_PER_ROW),
      milestoneOverflow: Math.max(0, dated.length - MILESTONES_PER_ROW),
      timelineName: facts.timelineNames?.get(entry.id) ?? null,
      href: openable ? portfolioRowHref(entry.id) : null,
      overviewHref: `/app/project?${new URLSearchParams({ workspaceId: entry.id }).toString()}`,
      sample: false,
    };
  });
}

// ── Grouping and sorting ───────────────────────────────────────────────────

export type PortfolioGroupBy = "status" | "none";
export type PortfolioSort = "target" | "start" | "name" | "progress";

export const GROUP_OPTIONS: readonly { value: PortfolioGroupBy; label: string }[] = [
  { value: "status", label: "Status" },
  { value: "none", label: "None" },
];

export const SORT_OPTIONS: readonly { value: PortfolioSort; label: string }[] = [
  { value: "target", label: "Target date" },
  { value: "start", label: "Start date" },
  { value: "name", label: "Name" },
  { value: "progress", label: "Progress" },
];

/**
 * The view a URL can carry: `?zoom=&group=&sort=&status=`. Defaults stay out
 * of the URL. `status` is the status filter, in chip order; empty means all.
 */
export type PortfolioViewState = Readonly<{
  zoom: Zoom;
  group: PortfolioGroupBy;
  sort: PortfolioSort;
  status: readonly StatusGroupKey[];
}>;

export const DEFAULT_PORTFOLIO_VIEW: PortfolioViewState = { zoom: "months", group: "status", sort: "target", status: [] };

export function portfolioViewFromSearch(
  search: Readonly<{ zoom?: string; group?: string; sort?: string; status?: string }>,
): PortfolioViewState {
  return {
    zoom: parseZoom(search.zoom) ?? DEFAULT_PORTFOLIO_VIEW.zoom,
    group: parseGroupBy(search.group) ?? DEFAULT_PORTFOLIO_VIEW.group,
    sort: parseSort(search.sort) ?? DEFAULT_PORTFOLIO_VIEW.sort,
    status: [...parseStatusFilter(search.status)],
  };
}

/** The status filter chips, in the order the page shows them. */
export const STATUS_FILTER_ORDER: readonly StatusGroupKey[] = ["on-track", "at-risk", "paused", "complete", "none"];

/** The key a row's status files under ("none" when it has no status). */
export function statusKeyOf(row: Pick<PortfolioRow, "status">): StatusGroupKey {
  return row.status ?? "none";
}

/**
 * `?status=at-risk,on-track` → the statuses to show, in chip order. Unknown
 * words are dropped, repeats collapse, and an empty set means "show all".
 * Accepts a string or the array Next hands over for a repeated param.
 */
export function parseStatusFilter(value: unknown): Set<StatusGroupKey> {
  const words = (Array.isArray(value) ? value : [value])
    .filter((part): part is string => typeof part === "string")
    .flatMap((part) => part.split(","))
    .map((part) => part.trim().toLowerCase());
  return new Set(STATUS_FILTER_ORDER.filter((key) => words.includes(key)));
}

/** The `?status=` value for a filter, or null when it shows everything. */
export function statusFilterParam(statuses: Iterable<StatusGroupKey>): string | null {
  const set = new Set(statuses);
  const ordered = STATUS_FILTER_ORDER.filter((key) => set.has(key));
  return ordered.length === 0 || ordered.length === STATUS_FILTER_ORDER.length ? null : ordered.join(",");
}

/**
 * The rows a filter keeps, in their order. An empty status set keeps every
 * status; the text matches anywhere in the name, ignoring case and accents.
 */
export function filterRows<T extends Pick<PortfolioRow, "status" | "name">>(
  rows: readonly T[],
  statuses: ReadonlySet<StatusGroupKey>,
  text = "",
): T[] {
  const needle = foldText(text.trim());
  return rows.filter(
    (row) => (statuses.size === 0 || statuses.has(statusKeyOf(row))) && (!needle || foldText(row.name).includes(needle)),
  );
}

function foldText(value: string): string {
  return value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

export function parseGroupBy(value: unknown): PortfolioGroupBy | null {
  return value === "status" || value === "none" ? value : null;
}

export function parseSort(value: unknown): PortfolioSort | null {
  return value === "target" || value === "start" || value === "name" || value === "progress" ? value : null;
}

export type StatusGroupKey = "at-risk" | "on-track" | "none" | "paused" | "complete";

const GROUP_ORDER: readonly StatusGroupKey[] = ["at-risk", "on-track", "none", "paused", "complete"];

export const STATUS_GROUP_LABELS: Readonly<Record<StatusGroupKey, string>> = {
  "at-risk": "At risk",
  "on-track": "On track",
  none: "No status",
  paused: "Paused",
  complete: "Complete",
};

export type PortfolioGroup = Readonly<{
  key: StatusGroupKey | "all";
  label: string;
  rows: readonly PortfolioRow[];
  /** Complete starts folded away: finished work is not what this page is for. */
  collapsedByDefault: boolean;
}>;

function groupKey(status: ProjectStatus): StatusGroupKey {
  return status ?? "none";
}

/** Status groups in the order that matters most: at risk first, complete last. Empty groups are dropped. */
export function groupRows(rows: readonly PortfolioRow[], by: PortfolioGroupBy): PortfolioGroup[] {
  if (by === "none") {
    return rows.length > 0 ? [{ key: "all", label: "All projects", rows, collapsedByDefault: false }] : [];
  }
  return GROUP_ORDER.map((key) => ({
    key,
    label: STATUS_GROUP_LABELS[key],
    rows: rows.filter((row) => groupKey(row.status) === key),
    collapsedByDefault: key === "complete",
  })).filter((group) => group.rows.length > 0);
}

const collator = new Intl.Collator("en", { sensitivity: "base", numeric: true });

function compareOptionalDay(a: string | null, b: string | null): number {
  if (a && b) return a < b ? -1 : a > b ? 1 : 0;
  if (a) return -1; // undated last
  if (b) return 1;
  return 0;
}

/**
 * Sort within a group. Undated rows go last whatever the key; the name breaks
 * every tie. Progress sorts the furthest along first. Samples never jump
 * ahead of the real Project (it is first within its group in review).
 */
export function sortRows(rows: readonly PortfolioRow[], sort: PortfolioSort): PortfolioRow[] {
  const byName = (a: PortfolioRow, b: PortfolioRow) => collator.compare(a.name, b.name);
  const primary = (a: PortfolioRow, b: PortfolioRow): number => {
    switch (sort) {
      case "target":
        return compareOptionalDay(a.target, b.target);
      case "start":
        return compareOptionalDay(a.start, b.start);
      case "progress":
        return progressPercent(b.complete, b.total) - progressPercent(a.complete, a.total);
      case "name":
        return 0;
    }
  };
  return [...rows].sort(
    (a, b) => Number(a.sample) - Number(b.sample) || primary(a, b) || byName(a, b),
  );
}

// ── Bars ───────────────────────────────────────────────────────────────────

/** How far an open-ended bar runs past today before it fades out. */
export const OPEN_ENDED_DAYS = 28;

export type BarGeometry = Readonly<{
  kind: "span" | "open-ended" | "target-only" | "none";
  /** First day drawn. */
  from: string | null;
  /** Last day drawn (target, or today + 4 weeks when open-ended). */
  to: string | null;
  pastTarget: boolean;
  daysPast: number;
  /** Share of the bar that is done, 0–100. */
  percent: number;
}>;

export function barGeometry(row: PortfolioRow, todayIso: string): BarGeometry {
  const percent = row.status === "complete" ? 100 : progressPercent(row.complete, row.total);
  const pastTarget = row.statsKnown && targetDatePassed(row.target, row.status, todayIso);
  const daysPast = pastTarget && row.target ? diffDays(row.target, todayIso) : 0;

  if (row.start && row.target) {
    const [from, to] = row.start <= row.target ? [row.start, row.target] : [row.target, row.start];
    return { kind: "span", from, to, pastTarget, daysPast, percent };
  }
  if (row.start) {
    const horizon = addDays(todayIso, OPEN_ENDED_DAYS);
    return { kind: "open-ended", from: row.start, to: row.start > horizon ? addDays(row.start, OPEN_ENDED_DAYS) : horizon, pastTarget: false, daysPast: 0, percent };
  }
  if (row.target) {
    return { kind: "target-only", from: row.target, to: row.target, pastTarget, daysPast, percent };
  }
  return { kind: "none", from: null, to: null, pastTarget: false, daysPast: 0, percent };
}

/**
 * The words after a bar's end (spec 5.2). Every bar carries words, so colour
 * is never the only signal: "12 Nov · 40%", "Paused", "Done 30 Jun",
 * "No target date", "Target 12 Nov", "No tasks yet", "9 days past target".
 */
export function barEndLabel(row: PortfolioRow, todayIso: string): { text: string; tone: "danger" | "quiet" | "default" } {
  // Stats unavailable: the track is neutral and the status word is all we know.
  if (!row.statsKnown) return { text: projectStatusOption(row.status).label, tone: "quiet" };
  const geometry = barGeometry(row, todayIso);
  if (geometry.pastTarget) {
    return { text: geometry.daysPast === 1 ? "1 day past target" : `${geometry.daysPast} days past target`, tone: "danger" };
  }
  if (row.status === "paused") return { text: "Paused", tone: "quiet" };
  if (row.status === "complete") {
    return { text: row.target ? `Done ${formatShortDay(row.target, todayIso)}` : "Done", tone: "default" };
  }
  if (geometry.kind === "none") return { text: "No dates yet", tone: "quiet" };
  if (row.total === 0) {
    return { text: row.target ? `${formatShortDay(row.target, todayIso)} · No tasks yet` : "No tasks yet", tone: "quiet" };
  }
  if (geometry.kind === "target-only") return { text: `Target ${formatShortDay(row.target!, todayIso)}`, tone: "default" };
  if (!row.target) return { text: "No target date", tone: "quiet" };
  return { text: `${formatShortDay(row.target, todayIso)} · ${geometry.percent}%`, tone: "default" };
}

// ── Milestones ─────────────────────────────────────────────────────────────

export type MilestoneTone = "done" | "upcoming" | "overdue" | "next";

/** The next milestone that is still ahead (today counts). */
export function nextMilestone(row: PortfolioRow, todayIso: string): PortfolioMilestone | null {
  return row.milestones.find((m) => !m.done && m.date >= todayIso) ?? null;
}

/** Open milestones whose day has passed, oldest first. */
export function lateMilestones(
  row: Pick<PortfolioRow, "milestones">,
  todayIso: string,
): PortfolioMilestone[] {
  return row.milestones
    .filter((m) => !m.done && isIsoDay(m.date) && m.date.slice(0, 10) < todayIso)
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

export function milestoneTone(row: PortfolioRow, milestone: PortfolioMilestone, todayIso: string): MilestoneTone {
  if (milestone.done) return "done";
  if (milestone.date < todayIso) return "overdue";
  return nextMilestone(row, todayIso)?.id === milestone.id ? "next" : "upcoming";
}

// ── Summary ────────────────────────────────────────────────────────────────

export type SummaryCounts = Readonly<{
  total: number;
  byStatus: Readonly<Record<StatusGroupKey, number>>;
}>;

export function summaryCounts(rows: readonly PortfolioRow[]): SummaryCounts {
  const byStatus: Record<StatusGroupKey, number> = { "at-risk": 0, "on-track": 0, none: 0, paused: 0, complete: 0 };
  for (const row of rows) byStatus[groupKey(row.status)] += 1;
  return { total: rows.length, byStatus };
}

function lateTasks(count: number): string {
  return count === 1 ? "1 late task" : `${count} late tasks`;
}

/**
 * The one Project worth a look today, or null. At risk comes first (most late
 * tasks breaks a tie), then the most days past its target, then the most late
 * tasks. Complete and paused Projects are never named.
 */
export function needsALook(
  rows: readonly PortfolioRow[],
  todayIso: string,
): Readonly<{ row: PortfolioRow; sentence: string }> | null {
  const live = rows.filter((row) => !row.archived && row.statsKnown && row.status !== "complete" && row.status !== "paused");
  const byName = (a: PortfolioRow, b: PortfolioRow) => collator.compare(a.name, b.name);

  const atRisk = live.filter((row) => row.status === "at-risk").sort((a, b) => b.overdue - a.overdue || byName(a, b))[0];
  if (atRisk) {
    return {
      row: atRisk,
      sentence: atRisk.overdue > 0 ? `${atRisk.name} is at risk, with ${lateTasks(atRisk.overdue)}.` : `${atRisk.name} is at risk.`,
    };
  }

  const past = live
    .map((row) => ({ row, days: barGeometry(row, todayIso).daysPast }))
    .filter((entry) => entry.days > 0)
    .sort((a, b) => b.days - a.days || byName(a.row, b.row))[0];
  if (past) {
    return {
      row: past.row,
      sentence: `${past.row.name} is ${past.days === 1 ? "1 day" : `${past.days} days`} past its target date.`,
    };
  }

  const late = live.filter((row) => row.overdue > 0).sort((a, b) => b.overdue - a.overdue || byName(a, b))[0];
  if (late) return { row: late, sentence: `${late.name} has ${lateTasks(late.overdue)}.` };
  return null;
}

/**
 * Every live Project worth a look: at risk, past its target date, or with
 * late tasks, whatever its stated status. The first is the one needsALook
 * names; the page says how many more there are, so a Project marked "On
 * track" that is in fact late is never skimmed past.
 */
export function needsALookAll(rows: readonly PortfolioRow[], todayIso: string): PortfolioRow[] {
  const first = needsALook(rows, todayIso)?.row ?? null;
  const flagged = rows.filter(
    (row) =>
      !row.archived &&
      row.statsKnown &&
      row.status !== "complete" &&
      row.status !== "paused" &&
      (row.status === "at-risk" || row.overdue > 0 || barGeometry(row, todayIso).daysPast > 0),
  );
  return first ? [first, ...flagged.filter((row) => row !== first)] : flagged;
}

// ── Words ──────────────────────────────────────────────────────────────────

/** The quiet line under a row's name: "At risk · 40% · 2 late", "On track · Past target · 88% · 1 late · Sample". */
export function rowMetaLine(row: PortfolioRow, todayIso: string): string {
  const parts = [projectStatusOption(row.status).label];
  // "Sample" goes last, so a narrow column cuts it before the facts.
  if (!row.statsKnown) return [...parts, ...(row.sample ? ["Sample"] : [])].join(" · ");
  const geometry = barGeometry(row, todayIso);
  // The stated status can say "On track" on a Project that is late; say so.
  if (geometry.daysPast > 0) parts.push("Past target");
  if (row.total > 0 || row.status === "complete") parts.push(`${geometry.percent}%`);
  else parts.push("No tasks yet");
  if (row.overdue > 0) parts.push(`${row.overdue} late`);
  if (row.sample) parts.push("Sample");
  return parts.join(" · ");
}

/**
 * The row's full accessible name, one sentence a screen reader can read
 * whole: "Kavanagh wedding, at risk, 40% done, target 12 November, 2 tasks
 * late, next milestone Final fitting on 4 October".
 */
export function rowAccessibleLabel(row: PortfolioRow, todayIso: string): string {
  const parts = [row.name, projectStatusOption(row.status).label.toLowerCase()];
  if (row.sample) parts.push("sample project");
  if (!row.statsKnown) {
    parts.push("dates and progress could not be loaded");
    return parts.join(", ");
  }
  const geometry = barGeometry(row, todayIso);
  parts.push(row.total === 0 && row.status !== "complete" ? "no tasks yet" : `${geometry.percent}% done`);
  if (row.target) {
    parts.push(
      geometry.pastTarget
        ? `${geometry.daysPast === 1 ? "1 day" : `${geometry.daysPast} days`} past its target of ${formatLongDay(row.target, todayIso)}`
        : `target ${formatLongDay(row.target, todayIso)}`,
    );
  } else {
    parts.push("no target date");
  }
  if (row.overdue > 0) parts.push(row.overdue === 1 ? "1 task late" : `${row.overdue} tasks late`);
  const next = nextMilestone(row, todayIso);
  if (next) parts.push(`next milestone ${next.title} on ${formatLongDay(next.date, todayIso)}`);
  if (!row.selectable) parts.push(row.blockedReason ?? "cannot be opened from here");
  return parts.join(", ");
}
