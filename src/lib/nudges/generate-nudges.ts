import type { Task, UserId } from "@/lib/data";
import { isTaskDone } from "@/lib/board-columns";
import type { ColumnConfig } from "@/lib/board-config";
import type { CalendarFrame } from "@/lib/calendar-frame";
import {
  calendarDateInTimeZone,
  calendarDaysBetween as projectCalendarDaysBetween,
} from "@/lib/planning/dates";

export type NudgeKind =
  | "idle-doing"
  | "idle-review"
  | "past-due"
  | "blocker-cleared"
  | "review-pile"
  | "doing-empty"
  /**
   * LLM-authored nudge. NOT produced by `generateNudges`, kept pure
   * rules here on purpose. The kind exists in the union so the inbox
   * (and any future renderer) can format an LLM-sourced nudge with
   * the same shape and animations as a rules-based one. AI assist
   * lives in `src/server/actions/ai.ts`; rendering is in the inbox.
   */
  | "llm-narration";

export type Nudge = {
  /** Stable id derived from {kind, taskId, severity bucket} so the
   *  client-side dismiss list stays meaningful across renders. */
  id: string;
  kind: NudgeKind;
  /** Optional anchoring task for click-through. */
  taskId?: string;
  /** Punchy one-liner. */
  headline: string;
  /** The plain "here's what we noticed" sub-line. */
  body: string;
  /** Higher = more urgent. Used for ordering. */
  severity: number;
};

const DAY_MS = 24 * 60 * 60 * 1000;

function pickRand<T>(arr: T[], seed: string): T {
  // Deterministic so the same nudge id always picks the same flavor.
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = (h << 5) - h + seed.charCodeAt(i);
    h |= 0;
  }
  return arr[Math.abs(h) % arr.length];
}

// ────────────────────────────────────────────────────────────────────
// Copy banks. Each rule has a few variants so the inbox doesn't read
// identical week-over-week. Tone: dry, observational, never preachy —
// and plain. We notice; we don't lecture, and we don't do bits.
// ────────────────────────────────────────────────────────────────────

const IDLE_DOING_4: string[] = [
  "In progress, but quiet for {days}.",
  "Started, then nothing for {days}.",
  "No movement in {days}. A small push would do it.",
];

const IDLE_DOING_7: string[] = [
  "Quiet for {days} now.",
  "Untouched for {days}. Still worth doing?",
  "In progress for {days} without a change.",
];

const IDLE_REVIEW_4: string[] = [
  "Waiting on a look for {days}.",
  "In review for {days}. One decision moves it.",
  "Ready for a yes or no. {days} waiting.",
];

const PAST_DUE_NEAR: string[] = [
  "Past due by {days}. Still very recoverable.",
  "Due {days} ago. A small push lands it.",
  "Slipped by {days}. Today works.",
];

const PAST_DUE_FAR: string[] = [
  "{days} past due. Reschedule it or let it go.",
  "Due {days} ago. Worth one honest decision.",
  "Open and {days} past due. Pick a new date or drop it.",
];

const BLOCKER_CLEARED: string[] = [
  "What this was waiting on is done. It can move now.",
  "Everything upstream is finished. Nothing is holding this.",
  "The wait is over. This is free to start.",
];

const REVIEW_PILE: string[] = [
  "{n} tasks waiting on a look. Most need one decision.",
  "{n} waiting for review. A short pass would clear most of it.",
  "The review queue is {n} deep. Worth ten minutes.",
];

const DOING_EMPTY: string[] = [
  "{todo} to do, nothing in progress. Start one.",
  "Nothing in flight. Pick one and begin.",
  "{todo} ready to go. One at a time works.",
];

/** "1 day" / "6 days" — templates use {days} so singulars read correctly. */
function formatDays(n: number): string {
  return `${n} ${n === 1 ? "day" : "days"}`;
}

/**
 * Whole calendar days between two instants (UTC midnights), so a task due
 * on the 14th reads "2 days" past due on the 16th regardless of the time
 * of day either instant carries. Millisecond flooring made the nudge say
 * "1 day" while the board (calendar-date maths) said "2 days overdue" for
 * the same task.
 */
function utcCalendarDaysBetween(from: Date, to: Date): number {
  const a = Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate());
  const b = Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), to.getUTCDate());
  return Math.round((b - a) / DAY_MS);
}

// ────────────────────────────────────────────────────────────────────
// Rule engine
// ────────────────────────────────────────────────────────────────────

export function generateNudges(
  tasks: Task[],
  currentUser: UserId,
  /** Threaded from the caller's useColumnConfig() / readWorkspaceColumnConfig
   *  (T·122); defaults to null (["done"]) for callers that haven't wired it. */
  columnConfig: ColumnConfig | null = null,
  now: Date = new Date(),
  /** MyWork supplies its project frame; other consumers retain UTC due rules. */
  calendar?: Pick<CalendarFrame, "today" | "timeZone">,
): Nudge[] {
  const out: Nudge[] = [];

  const myOpen = tasks.filter(
    (t) => t.assignees.includes(currentUser) && !isTaskDone(t, columnConfig),
  );

  // Rule 1, idle in_progress
  for (const t of myOpen.filter((t) => t.lane === "doing")) {
    const days = idleDaysFor(t, now);
    if (days >= 7) {
      const tpl = pickRand(IDLE_DOING_7, t.id + "doing7");
      out.push({
        id: `idle-doing-${t.id}-7`,
        kind: "idle-doing",
        taskId: t.id,
        headline: t.title,
        body: tpl.replaceAll("{days}", formatDays(days)),
        severity: 80,
      });
    } else if (days >= 4) {
      const tpl = pickRand(IDLE_DOING_4, t.id + "doing4");
      out.push({
        id: `idle-doing-${t.id}-4`,
        kind: "idle-doing",
        taskId: t.id,
        headline: t.title,
        body: tpl.replaceAll("{days}", formatDays(days)),
        severity: 60,
      });
    }
  }

  // Rule 2, idle in_review (any reviewer; the bottleneck shows for all)
  for (const t of tasks.filter((t) => t.lane === "review")) {
    const days = idleDaysFor(t, now);
    if (days >= 4) {
      const tpl = pickRand(IDLE_REVIEW_4, t.id + "review4");
      out.push({
        id: `idle-review-${t.id}`,
        kind: "idle-review",
        taskId: t.id,
        headline: t.title,
        body: tpl.replaceAll("{days}", formatDays(days)),
        severity: 50,
      });
    }
  }

  // Rule 3, past due (mine)
  for (const t of myOpen) {
    if (!t.dueAt || Number.isNaN(t.dueAt.getTime())) continue;
    const dDays = calendar
      ? projectCalendarDaysBetween(calendarDateInTimeZone(t.dueAt, calendar.timeZone), calendar.today)
      : utcCalendarDaysBetween(t.dueAt, now);
    if (dDays > 0 && dDays <= 3) {
      const tpl = pickRand(PAST_DUE_NEAR, t.id + "due-near");
      out.push({
        id: `past-due-${t.id}-near`,
        kind: "past-due",
        taskId: t.id,
        headline: t.title,
        body: tpl.replaceAll("{days}", formatDays(dDays)),
        severity: 75,
      });
    } else if (dDays > 3) {
      const tpl = pickRand(PAST_DUE_FAR, t.id + "due-far");
      out.push({
        id: `past-due-${t.id}-far`,
        kind: "past-due",
        taskId: t.id,
        headline: t.title,
        body: tpl.replaceAll("{days}", formatDays(dDays)),
        severity: 90,
      });
    }
  }

  // Rule 4, blocker cleared (every blocker is done, but task is still
  // todo). Only fire for tasks the current user owns.
  for (const t of myOpen.filter(
    (t) => t.lane === "todo" && t.blockedBy && t.blockedBy.length > 0,
  )) {
    const blockers = (t.blockedBy ?? []).map((id) =>
      tasks.find((x) => x.id === id),
    );
    const allDone =
      blockers.length > 0 &&
      blockers.every((b) => b && isTaskDone(b, columnConfig));
    if (!allDone) continue;
    const tpl = pickRand(BLOCKER_CLEARED, t.id + "blocker");
    out.push({
      id: `blocker-cleared-${t.id}`,
      kind: "blocker-cleared",
      taskId: t.id,
      headline: t.title,
      body: tpl,
      severity: 70,
    });
  }

  // Rule 5, review pile (>= 4 tasks in review)
  const reviewCount = tasks.filter((t) => t.lane === "review").length;
  if (reviewCount >= 4) {
    const tpl = pickRand(REVIEW_PILE, "review-pile-" + reviewCount);
    out.push({
      id: `review-pile-${reviewCount}`,
      kind: "review-pile",
      headline: "The review queue is backing up",
      body: tpl.replace("{n}", String(reviewCount)),
      severity: 40,
    });
  }

  // Rule 6, doing-empty (>= 5 todo, 0 in progress)
  const todoCount = myOpen.filter((t) => t.lane === "todo").length;
  const doingCount = myOpen.filter((t) => t.lane === "doing").length;
  if (todoCount >= 5 && doingCount === 0) {
    const tpl = pickRand(DOING_EMPTY, "doing-empty-" + todoCount);
    out.push({
      id: `doing-empty-${todoCount}`,
      kind: "doing-empty",
      headline: "Pick something",
      body: tpl.replace("{todo}", String(todoCount)),
      severity: 30,
    });
  }

  // Sort high → low severity, keep one nudge per task (the most urgent
  // reason wins — a task that is both past due and idle is one problem,
  // not two), cap to 6 to avoid spam.
  out.sort((a, b) => b.severity - a.severity);
  const seenTasks = new Set<string>();
  const deduped = out.filter((n) => {
    if (!n.taskId) return true;
    if (seenTasks.has(n.taskId)) return false;
    seenTasks.add(n.taskId);
    return true;
  });
  return deduped.slice(0, 6);
}

/** Approximate idle days from `idleDays` field if present, else from
 *  `updatedAt`. Floors fractional days to whole days. */
function idleDaysFor(t: Task, now: Date): number {
  if (typeof t.idleDays === "number") return t.idleDays;
  return Math.floor((now.getTime() - t.updatedAt.getTime()) / DAY_MS);
}
