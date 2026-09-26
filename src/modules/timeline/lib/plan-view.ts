/**
 * One plan, read as a working list (v3 redesign, 24 Sep 2026).
 *
 * The owner's plan page groups milestones by what a guest will see — Now,
 * Coming up, Later — with the undated ones in their own group and the settled
 * ones folded away. This module is the pure half of that page: grouping and
 * order, what "up next" and the key date are, the strip's time range, the
 * sentences a row and a panel speak, and the move-up/move-down arithmetic
 * that keeps order meaningful when dates tie.
 *
 * Plain functions over the effective node shape, no clock reads: `todayIso`
 * is always passed in so server and client agree.
 */

import type { AudienceItemState } from "@/modules/timeline/server/db/timeline-schema";
import { anchorMilestone, type AnchorCandidate } from "@/modules/timeline/lib/roadmap/anchor";
import {
  addDays,
  diffDays,
  formatLongDay,
  formatShortDay,
  relativeDayPhrase,
  startOfMonth,
  type TimeRange,
} from "@/lib/projects/project-portfolio-scale";

/** The fields of an effective node this module reads. */
export type PlanNode = AnchorCandidate & {
  id: string;
  title: string;
  targetDate: string | null;
  sourceTargetDate: string | null;
  sortOrder: number;
  audienceState: AudienceItemState;
  sourceAudienceState: AudienceItemState;
  audienceStateOverride: AudienceItemState | null;
  hidden: boolean;
  labelOverride: string | null;
  dateOverrideMode: "inherit" | "date" | "undated";
  source: "synced" | "manual";
  driftDetected: boolean;
};

export type PlanGroupKey = "now" | "next" | "later" | "undated" | "done" | "cancelled";

export const PLAN_GROUP_ORDER: readonly PlanGroupKey[] = ["now", "next", "later", "undated", "done", "cancelled"];

export const PLAN_GROUP_LABELS: Readonly<Record<PlanGroupKey, string>> = {
  now: "Now",
  next: "Coming up",
  later: "Later",
  undated: "No date yet",
  done: "Done",
  cancelled: "Not going ahead",
};

/** Where guests see a milestone, in the panel's words. */
export const AUDIENCE_STATE_WORDS: Readonly<Record<AudienceItemState, string>> = {
  now: "Now",
  next: "Coming up",
  later: "Later",
  covered: "Done",
  cancelled: "Not going ahead",
};

export const AUDIENCE_STATE_CHOICES: readonly AudienceItemState[] = ["covered", "now", "next", "later", "cancelled"];

export function planGroupKey(node: Pick<PlanNode, "audienceState" | "targetDate">): PlanGroupKey {
  if (node.audienceState === "covered") return "done";
  if (node.audienceState === "cancelled") return "cancelled";
  if (!node.targetDate) return "undated";
  if (node.audienceState === "now") return "now";
  if (node.audienceState === "later") return "later";
  return "next";
}

export type PlanGroup<T extends PlanNode> = Readonly<{
  key: PlanGroupKey;
  label: string;
  nodes: readonly T[];
  /** Settled groups start folded. */
  collapsedByDefault: boolean;
}>;

function byDateThenOrder(a: PlanNode, b: PlanNode): number {
  if (a.targetDate && b.targetDate && a.targetDate !== b.targetDate) return a.targetDate < b.targetDate ? -1 : 1;
  if (a.targetDate && !b.targetDate) return -1;
  if (!a.targetDate && b.targetDate) return 1;
  return a.sortOrder - b.sortOrder;
}

/** Groups in reading order, each sorted by date then by the owner's order. Empty groups are dropped. */
export function groupPlanNodes<T extends PlanNode>(nodes: readonly T[]): PlanGroup<T>[] {
  return PLAN_GROUP_ORDER.map((key) => ({
    key,
    label: PLAN_GROUP_LABELS[key],
    nodes: nodes.filter((node) => planGroupKey(node) === key).sort(byDateThenOrder),
    collapsedByDefault: key === "done" || key === "cancelled",
  })).filter((group) => group.nodes.length > 0);
}

/** Every node in the order the page shows them. */
export function displayOrder<T extends PlanNode>(nodes: readonly T[]): T[] {
  return groupPlanNodes(nodes).flatMap((group) => group.nodes);
}

/**
 * The nodes a milestone can trade places with: same group, same day (or both
 * undated). Order only means something between milestones that tie.
 */
export function moveRun<T extends PlanNode>(nodes: readonly T[], id: string): T[] {
  const node = nodes.find((candidate) => candidate.id === id);
  if (!node) return [];
  const key = planGroupKey(node);
  return displayOrder(nodes).filter(
    (candidate) => planGroupKey(candidate) === key && candidate.targetDate === node.targetDate,
  );
}

/**
 * Splice a reordered run back into the full display order and number every
 * node, so what is saved is exactly what is shown.
 */
export function applyRunOrder<T extends PlanNode>(nodes: readonly T[], runIds: readonly string[]): T[] {
  const ordered = displayOrder(nodes);
  const runSet = new Set(runIds);
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const queue = [...runIds];
  return ordered
    .map((node) => (runSet.has(node.id) ? byId.get(queue.shift()!)! : node))
    .map((node, index) => ({ ...node, sortOrder: index }));
}

/** The milestone the plan is standing on next: the soonest open, shown, dated one from today. */
export function upNext<T extends PlanNode>(nodes: readonly T[], todayIso: string): T | null {
  return (
    nodes
      .filter(
        (node) =>
          !node.hidden &&
          node.targetDate &&
          node.targetDate >= todayIso &&
          node.audienceState !== "covered" &&
          node.audienceState !== "cancelled",
      )
      .sort(byDateThenOrder)[0] ?? null
  );
}

/** The day the plan builds toward (the wedding day, the go-live). */
export function keyDate<T extends PlanNode>(nodes: readonly T[]): T | null {
  return anchorMilestone(nodes.filter((node) => !node.hidden && node.audienceState !== "cancelled"));
}

/**
 * The whole plan's range: from the first dated milestone (or the start of this
 * month) to two weeks past the key date, always holding today, with a week of
 * air either side. No zoom here; the strip fits its width.
 */
export function stripRange(nodes: readonly PlanNode[], todayIso: string): TimeRange {
  const dates = nodes.map((node) => node.targetDate).filter((date): date is string => Boolean(date)).sort();
  const key = keyDate(nodes)?.targetDate ?? null;
  const first = [dates[0] ?? startOfMonth(todayIso), todayIso].sort()[0];
  const lastCandidates = [dates[dates.length - 1] ?? todayIso, todayIso, key ? addDays(key, 14) : todayIso].sort();
  const last = lastCandidates[lastCandidates.length - 1];
  const start = addDays(first, -7);
  const end = addDays(last, 10);
  return { start, end, days: diffDays(start, end) + 1, clippedBefore: false, clippedAfter: null };
}

export type RunwayRange<T extends PlanNode> = Readonly<{
  range: TimeRange;
  /** Settled milestones before the fold, drawn in the Earlier segment. */
  folded: readonly T[];
  /** A fold is possible: there is finished past worth folding away. */
  foldable: boolean;
}>;

/**
 * The plan runway's range (spec 3.2). Folded, it starts a week before
 * today, or a week before the earliest milestone still open if that is
 * sooner (so a late milestone is never folded away), and runs to two weeks
 * past the key date. Everything dated before that start is finished work,
 * and folds into the Earlier segment. Unfolded, it is the whole plan.
 */
export function runwayRange<T extends PlanNode>(nodes: readonly T[], todayIso: string, expanded: boolean): RunwayRange<T> {
  const dated = nodes.filter((node) => node.targetDate && node.audienceState !== "cancelled");
  const full = stripRange(dated, todayIso);
  const open = dated
    .filter((node) => node.audienceState !== "covered")
    .map((node) => node.targetDate as string)
    .sort();
  const foldAt = [addDays(todayIso, -7), open[0] ? addDays(open[0], -7) : todayIso].sort()[0];
  const folded = dated.filter((node) => (node.targetDate as string) < foldAt);
  const foldable = folded.length > 0 && foldAt > full.start;
  if (expanded || !foldable) return { range: full, folded: [], foldable };
  // Folded, the far end is two weeks past the key date (or a week past the
  // last milestone, or two weeks past today), with no extra air.
  const key = keyDate(dated)?.targetDate ?? null;
  const last = dated.map((node) => node.targetDate as string).sort().pop() ?? todayIso;
  const end = [key ? addDays(key, 14) : todayIso, addDays(last, 7), addDays(todayIso, 14)].sort().pop()!;
  return {
    range: { start: foldAt, end, days: diffDays(foldAt, end) + 1, clippedBefore: true, clippedAfter: null },
    folded,
    foldable,
  };
}

/** "Menu tasting, 1 August, coming up": the strip diamond's name. */
export function diamondLabel(node: PlanNode, todayIso: string): string {
  const date = node.targetDate ? formatLongDay(node.targetDate, todayIso) : "no date yet";
  return `${node.title}, ${date}, ${AUDIENCE_STATE_WORDS[node.audienceState].toLowerCase()}${node.hidden ? ", hidden from the shared page" : ""}`;
}

/** "3 milestones between 8 and 12 August". */
export function clusterLabel(nodes: readonly PlanNode[], todayIso: string): string {
  const dates = nodes.map((node) => node.targetDate).filter((d): d is string => Boolean(d)).sort();
  const from = dates[0];
  const to = dates[dates.length - 1];
  const count = `${nodes.length} milestones`;
  if (!from || !to) return count;
  if (from === to) return `${count} on ${formatLongDay(from, todayIso)}`;
  const [fromDay, fromMonth] = formatLongDay(from, todayIso).split(" ");
  const toLong = formatLongDay(to, todayIso);
  return from.slice(0, 7) === to.slice(0, 7)
    ? `${count} between ${fromDay} and ${toLong}`
    : `${count} between ${fromDay} ${fromMonth} and ${toLong}`;
}

/** The short date a row shows, and for Now and Coming up the relative phrase. */
export function rowDate(node: PlanNode, todayIso: string): { date: string | null; relative: string | null } {
  if (!node.targetDate) return { date: null, relative: null };
  const key = planGroupKey(node);
  const relative = key === "now" || key === "next" ? relativeDayPhrase(node.targetDate, todayIso) : null;
  return { date: formatShortDay(node.targetDate, todayIso), relative };
}

/** A dated, open milestone whose day has passed. */
export function isLate(node: PlanNode, todayIso: string): boolean {
  return Boolean(
    node.targetDate &&
      node.targetDate < todayIso &&
      node.audienceState !== "covered" &&
      node.audienceState !== "cancelled",
  );
}

/** What the drift note says, when Tasks moved something the owner had changed. */
export function driftSentence(node: PlanNode, todayIso: string): string | null {
  if (!node.driftDetected) return null;
  if (node.dateOverrideMode === "date" && node.sourceTargetDate && node.sourceTargetDate !== node.targetDate) {
    return `Tasks changed this date to ${formatShortDay(node.sourceTargetDate, todayIso)} after you edited it.`;
  }
  return "Tasks changed this milestone after you edited it.";
}

/**
 * Counts the header and the strip speak from. "Active" leaves out hidden
 * milestones and the ones not going ahead: progress is "2 of 9 done".
 */
export function planCounts(nodes: readonly PlanNode[]): {
  total: number;
  done: number;
  hidden: number;
  shown: number;
  active: number;
} {
  const shown = nodes.filter((node) => !node.hidden);
  const active = shown.filter((node) => node.audienceState !== "cancelled");
  return {
    total: nodes.length,
    done: active.filter((node) => node.audienceState === "covered").length,
    hidden: nodes.length - shown.length,
    shown: shown.length,
    active: active.length,
  };
}
