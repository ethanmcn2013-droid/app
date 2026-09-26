/**
 * The Projects hub's presentation model (v3 redesign, 24 Sep 2026).
 *
 * `/app/project` opens with an index of every Project the caller can open,
 * each as a card with the same facts that Project's own overview shows:
 * declared status, target date and task progress. This module holds the rules
 * those cards and the overview share, so the two can never read differently:
 *
 *   - the meta keys the declared status and target date live under,
 *   - the status allow-list and its labels,
 *   - how grouped task counts become "x of y tasks" (the board's own done
 *     predicate, per Project column settings, T·122),
 *   - how a card phrases its date and counts.
 *
 * Pure and client-safe. The database read lives in
 * `src/server/projects/project-hub.ts`; it only ever passes rows for Projects
 * the chooser catalog already authorized.
 */

import { isDoneColumnKey } from "@/lib/board-columns";
import { parseColumnConfig, type ColumnConfig } from "@/lib/board-config";
import type { ChooserRow } from "@/lib/projects/project-chooser";

// ── Declared status ─────────────────────────────────────────────────────────

export type ProjectStatus = "on-track" | "at-risk" | "paused" | "complete" | null;

/** Colour role of a status. Resolved to v3 tokens by the component. */
export type ProjectStatusTone = "success" | "warning" | "neutral" | "accent" | "none";

export type ProjectStatusOption = Readonly<{
  value: ProjectStatus;
  label: string;
  tone: ProjectStatusTone;
}>;

export const PROJECT_STATUS_OPTIONS: readonly ProjectStatusOption[] = [
  { value: "on-track", label: "On track", tone: "success" },
  { value: "at-risk", label: "At risk", tone: "warning" },
  { value: "paused", label: "Paused", tone: "neutral" },
  { value: "complete", label: "Complete", tone: "accent" },
];

export const PROJECT_STATUS_NOT_SET: ProjectStatusOption = {
  value: null,
  label: "No status",
  tone: "none",
};

export function projectStatusOption(status: ProjectStatus): ProjectStatusOption {
  return PROJECT_STATUS_OPTIONS.find((option) => option.value === status) ?? PROJECT_STATUS_NOT_SET;
}

/** Server-side allow-list: anything else stored under the key reads as unset. */
export function parseProjectStatus(raw: string | null | undefined): ProjectStatus {
  if (raw === "on-track" || raw === "at-risk" || raw === "paused" || raw === "complete") {
    return raw;
  }
  return null;
}

// ── Meta keys (one definition for the overview and the hub) ─────────────────

export function projectStatusMetaKey(projectId: string): string {
  return `project-status:${projectId}`;
}

export function projectTargetDateMetaKey(projectId: string): string {
  return `project-target-date:${projectId}`;
}

export function projectPurposeMetaKey(projectId: string): string {
  return `room:${projectId}:purpose`;
}

export function projectColumnsMetaKey(projectId: string): string {
  return `board:${projectId}:columns`;
}

// ── Card stats ──────────────────────────────────────────────────────────────

export type ProjectCardStats = Readonly<{
  status: ProjectStatus;
  /** Plain `YYYY-MM-DD`, or null when the owner has not set one. */
  targetDate: string | null;
  /** One line the owner wrote about the Project, or null. */
  purpose: string | null;
  /** Top-level, unarchived tasks: the overview's own definition. */
  total: number;
  complete: number;
  /** Not done and past their due time. */
  overdue: number;
}>;

// ── The hub payload (server → page) ─────────────────────────────────────────

export type ProjectHubCard = Readonly<{
  row: ChooserRow;
  /** Null when not read: the open Project (the page has it) or past the limit. */
  stats: ProjectCardStats | null;
}>;

export type ProjectHub =
  | Readonly<{
      kind: "ready";
      /** Active Projects, in the catalog's own order. */
      cards: readonly ProjectHubCard[];
      /** Archived Projects: listed, opened read-only by link, never switched to. */
      archived: readonly ChooserRow[];
      /** The catalog is a bounded page of the caller's memberships. */
      truncated: boolean;
      /** Stats could not be read; cards fall back to their open counts. */
      statsUnavailable: boolean;
    }>
  | Readonly<{ kind: "unavailable" }>;

/**
 * One grouped row from the task count read: every top-level, unarchived task
 * in a Project that shares a lane and column claim. `overdue` counts the ones
 * already past due, whether or not the group turns out to be done.
 */
export type ProjectTaskGroup = Readonly<{
  workspaceId: string | null;
  lane: string;
  boardColumnKey: string | null;
  total: number | string | bigint;
  overdue: number | string | bigint | null;
}>;

export type ProjectMetaRow = Readonly<{ key: string; value: string | null }>;

function count(value: number | string | bigint | null | undefined): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 0;
}

/**
 * Fold grouped task counts and meta rows into one stats record per Project.
 *
 * A group is done exactly when the board would call its column done
 * (`isDoneColumnKey`, with that Project's own column settings), so a renamed
 * or extra done column moves the card and the overview together.
 */
export function summarizeProjectCards(
  projectIds: readonly string[],
  metaRows: readonly ProjectMetaRow[],
  groups: readonly ProjectTaskGroup[],
): Map<string, ProjectCardStats> {
  const metaByKey = new Map(metaRows.map((row) => [row.key, row.value]));
  const configs = new Map<string, ColumnConfig | null>();
  for (const id of projectIds) {
    const raw = metaByKey.get(projectColumnsMetaKey(id));
    configs.set(id, raw ? parseColumnConfig(raw) : null);
  }

  const totals = new Map<string, { total: number; complete: number; overdue: number }>();
  for (const id of projectIds) totals.set(id, { total: 0, complete: 0, overdue: 0 });

  for (const group of groups) {
    if (!group.workspaceId) continue;
    const bucket = totals.get(group.workspaceId);
    if (!bucket) continue; // Never report a Project the caller did not ask about.
    const size = count(group.total);
    const done = isDoneColumnKey(group.boardColumnKey || group.lane, configs.get(group.workspaceId) ?? null);
    bucket.total += size;
    if (done) bucket.complete += size;
    else bucket.overdue += Math.min(size, count(group.overdue));
  }

  const out = new Map<string, ProjectCardStats>();
  for (const id of projectIds) {
    const bucket = totals.get(id)!;
    out.set(id, {
      status: parseProjectStatus(metaByKey.get(projectStatusMetaKey(id))),
      targetDate: metaByKey.get(projectTargetDateMetaKey(id))?.trim() || null,
      purpose: metaByKey.get(projectPurposeMetaKey(id))?.trim() || null,
      total: bucket.total,
      complete: bucket.complete,
      overdue: bucket.overdue,
    });
  }
  return out;
}

// ── Card copy ───────────────────────────────────────────────────────────────

/** Same rounding as the overview's progress figure. */
export function progressPercent(complete: number, total: number): number {
  return total === 0 ? 0 : Math.round((complete / total) * 100);
}

export function openTaskLabel(open: number): string {
  if (open === 0) return "Nothing open";
  return open === 1 ? "1 open" : `${open} open`;
}

export function taskProgressLabel(complete: number, total: number): string {
  if (total === 0) return "No tasks yet";
  return `${complete} of ${total} ${total === 1 ? "task" : "tasks"} done`;
}

const SHORT_DATE = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

/** `2026-10-03` → `3 Oct 2026`. Anything unparseable is shown as written. */
export function formatProjectDate(isoDate: string): string {
  const date = new Date(isoDate.length === 10 ? `${isoDate}T00:00:00Z` : isoDate);
  return Number.isNaN(date.getTime()) ? isoDate : SHORT_DATE.format(date);
}

const DATE_TIME = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "UTC",
  timeZoneName: "short",
});

/**
 * An instant as `22 Sep 2026, 15:16 UTC`. Fixed locale and zone on purpose:
 * the server render and the browser must produce the same string, or the
 * page fails hydration (the old `toLocaleString()` title did).
 */
export function formatProjectDateTime(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? iso : DATE_TIME.format(date);
}

/**
 * A target date is behind only while the work is not declared complete: a
 * finished Project whose date has passed is simply finished.
 */
export function targetDatePassed(
  isoDate: string | null,
  status: ProjectStatus,
  todayIso: string,
): boolean {
  if (!isoDate || status === "complete") return false;
  return isoDate.slice(0, 10) < todayIso.slice(0, 10);
}

/**
 * How the "New project" tile fills the last row of the grid: the columns left
 * over after the cards, or the whole row when the cards fill it exactly.
 */
export function trailingSpan(cardCount: number, columns: number): number {
  const remainder = cardCount % columns;
  return remainder === 0 ? columns : columns - remainder;
}
