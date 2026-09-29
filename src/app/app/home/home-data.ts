import "server-only";
import { BRIEFING_APP_PATH } from "@/lib/product-urls";

/**
 * Signal's narrow entry point, not its barrel. The barrel also re-exports
 * the three briefing route components, so importing the data surface
 * through it put that client tree in Home's chunk group and the build
 * emitted a near-duplicate of it for a page that renders none of it.
 */
import {
  buildBriefingForUser,
  deadlineDayDifference,
  deadlineIsOverdue,
  deadlineShortDate,
  compareDeadlines,
  deadlineWeekday,
  signalDeadline,
  type BriefItem,
  type TaskSignal,
  type SignalScope,
} from "@/modules/signal/home";

/**
 * Home view model — assembled from ONE briefing build (D5): the same
 * orchestrator, authorization path and ranking engine as the Full
 * Briefing. Home is a glance, so the build is a pure read
 * (recordReadState: false); the Full Briefing remains the read of
 * record for carry-over ages and dismissals.
 *
 * Permission safety is inherited, not re-implemented: every row below
 * derives from the signals the authorized scope returned. Nothing here
 * reaches around the module's scope check.
 */

export type HomeSignalRow = {
  id: string;
  destination: "task" | "briefing";
  /** The reader's own task title, sentence-cased by the engine. */
  title: string;
  /** Why it surfaced — the engine's observation prose. */
  why: string;
  /** Provenance, e.g. "Tasks · The Orchard, events". */
  source: string;
  /** Honest timing phrase ("today", "by Friday") or null. */
  due: string | null;
  trigger: string;
  href: string;
};

export type HomeComingRow = {
  id: string;
  title: string;
  source: string;
  due: string;
  href: string;
};

export type HomeReviewRow = {
  id: string;
  title: string;
  source: string;
  idleDays: number | null;
  href: string;
};

export type HomeStats = {
  open: number;
  dueToday: number;
  overdue: number;
  inReview: number;
  doneThisWeek: number;
};

export type HomeTaskRow = {
  id: string;
  title: string;
  source: string;
  lane: TaskSignal["lane"];
  priority: TaskSignal["priority"];
  /** Short timing label ("Today", "Tomorrow", "Fri", "3 Oct") or null. */
  due: string | null;
  overdue: boolean;
  href: string;
};

export type HomeDeadlineGroup = {
  label: string;
  rows: HomeTaskRow[];
};

export type HomeData =
  | { kind: "new-user" }
  | {
      kind: "ok";
      /** The scope Signal actually authorized and read, never a route guess. */
      scope: SignalScope;
      dateLabel: string;
      greeting: string;
      scopeLabel: string;
      briefingHref: string;
      signalRows: HomeSignalRow[];
      /** Set only when nothing is asking for the reader. */
      allClear: {
        headline: string;
        body: string;
        /** Honest arithmetic ("Read 8 items — nothing crossed a line."). */
        readLine: string | null;
      } | null;
      comingUp: HomeComingRow[];
      needsReview: HomeReviewRow[];
      stats: HomeStats;
      /** Open scoped tasks all have interpretable saved deadlines; empty open scope is complete. */
      dateCoverageComplete: boolean;
      myTasks: HomeTaskRow[];
      deadlines: HomeDeadlineGroup[];
    };

const COMING_UP_WINDOW_DAYS = 14;
const COMING_UP_CAP = 4;
const REVIEW_CAP = 3;
const MY_TASKS_CAP = 8;
const DEADLINE_CAP = 8;
const DAY_MS = 86_400_000;

function taskHref(id: string): string {
  return `/app/task/${encodeURIComponent(id)}`;
}

function greetingFor(hour: number): string {
  if (hour < 5) return "Still up.";
  if (hour < 12) return "Good morning.";
  if (hour < 17) return "Good afternoon.";
  return "Good evening.";
}

function dueFromDays(daysOut: number, signal: TaskSignal, timezone: string): string {
  if (daysOut < 0) return "overdue";
  if (daysOut < 1) return "today";
  if (daysOut < 2) return "tomorrow";
  if (daysOut < 7) return `by ${deadlineWeekday(signalDeadline(signal), timezone)}`;
  return "in the next two weeks";
}

export async function loadHomeData(opts: {
  clerkId: string;
  scope?: SignalScope;
}): Promise<HomeData> {
  const result = await buildBriefingForUser({
    clerkId: opts.clerkId,
    cadence: "daily",
    recordReadState: false,
    ...(opts.scope ? { scope: opts.scope } : {}),
  });
  if (result.kind === "no-workspace") return { kind: "new-user" };

  const { briefing, authorizedScope, signals } = result;
  const timezone = authorizedScope.timezone;
  const now = briefing.generatedAt;

  const dueById = new Map(
    briefing.suggestedFocus.map((item) => [item.id, item.due]),
  );
  const signalById = new Map(signals.map(signal => [signal.id, signal]));
  // An aggregate describes the authorized reading scope, not one task or the
  // first project that happened to contribute. Its destination rebuilds and
  // authorizes that same scope; no synthetic ID enters an object route.
  const scopeParams = new URLSearchParams({ contextVersion: "2" });
  if (authorizedScope.scope.kind === "workspace") {
    scopeParams.set("workspaceId", authorizedScope.scope.workspaceId);
  } else {
    scopeParams.set("planningPeriodId", authorizedScope.scope.planningPeriodId);
  }
  const aggregateHref = `${BRIEFING_APP_PATH}?${scopeParams.toString()}`;
  const toSignalRow = (item: BriefItem): HomeSignalRow => {
    const aggregate = item.trigger === "overload" || item.trigger === "crowded-week";
    const source = signalById.get(item.id);
    const ownDeadline = source ? signalDeadline(source) : null;
    const blockerWithoutDate = item.trigger === "blocking-due-work" &&
      (!ownDeadline || ownDeadline.kind === "unknown");
    return {
      id: item.id,
      destination: aggregate ? "briefing" : "task",
      title: item.text,
      why: item.detail,
      source: aggregate ? `Tasks · ${authorizedScope.label}` : item.sourceLabel,
      due: blockerWithoutDate ? null : dueById.get(item.id) ?? null,
      trigger: item.trigger,
      href: aggregate ? aggregateHref : taskHref(item.id),
    };
  };

  // The engine already selected and capped (≤3 across attention +
  // risks); Home renders that selection in the engine's own order.
  const signalRows = [
    ...briefing.needsAttention.map(toSignalRow),
    ...briefing.quietRisks.map(toSignalRow),
  ];

  const surfacedIds = new Set(signalRows.map((row) => row.id));

  const daysOutOf = (signal: TaskSignal) => deadlineDayDifference(signalDeadline(signal), now, timezone);
  const overdue = (signal: TaskSignal) => deadlineIsOverdue(signalDeadline(signal), now, timezone);
  const sortDue = (a: TaskSignal, b: TaskSignal) => compareDeadlines(signalDeadline(a), signalDeadline(b), timezone, now);
  const comingUp: HomeComingRow[] = signals
    .filter(
      (signal) =>
        daysOutOf(signal) !== null &&
        signal.lane !== "shipped" &&
        !surfacedIds.has(signal.id),
    )
    .map((signal) => ({
      signal,
      daysOut: daysOutOf(signal)!,
    }))
    .filter(({ signal, daysOut }) => !overdue(signal) && daysOut >= 0 && daysOut <= COMING_UP_WINDOW_DAYS)
    .sort((a, b) => sortDue(a.signal, b.signal))
    .slice(0, COMING_UP_CAP)
    .map(({ signal, daysOut }) => ({
      id: signal.id,
      title: signal.title,
      source: signal.sourceLabel,
      due: dueFromDays(daysOut, signal, timezone),
      href: taskHref(signal.id),
    }));

  const needsReview: HomeReviewRow[] = signals
    .filter(
      (signal) => signal.lane === "review" && !surfacedIds.has(signal.id),
    )
    .sort((a, b) => (b.idleDays ?? -1) - (a.idleDays ?? -1))
    .slice(0, REVIEW_CAP)
    .map((signal) => ({
      id: signal.id,
      title: signal.title,
      source: signal.sourceLabel,
      idleDays: signal.idleDays,
      href: taskHref(signal.id),
    }));

  const openSignals = signals.filter((signal) => signal.lane !== "shipped");
  // This is reassurance coverage for open scoped Tasks, not a statement
  // about dates outside the authorized read.
  const dateCoverageComplete = openSignals.every(signal => {
    const deadline = signalDeadline(signal);
    return deadline !== null && deadline.kind !== "unknown";
  });

  // All-clear only when nothing is asking. The engine's honesty guard
  // carries over: when something shipped recently, the quiet state
  // names it instead of claiming nothing happened.
  const shippedCount = briefing.movingWell.length;
  const allClear =
    signalRows.length === 0 && briefing.coverageStatus !== "partial" && dateCoverageComplete
      ? {
          headline:
            briefing.emptyStateHeadline ?? "Nothing needs you right now.",
          body:
            shippedCount > 0
              ? `${shippedCount === 1 ? "One thing" : `${shippedCount} things`} shipped recently — the rest can wait.`
              : (briefing.emptyStateBody ??
                "The system read your work and nothing crossed a line. A good day to move something forward."),
          readLine:
            briefing.readCount > 0
              ? `Read ${briefing.readCount} ${briefing.readCount === 1 ? "item" : "items"} across your workspace.`
              : null,
        }
      : null;

  const shortDue = (signal: TaskSignal): string | null => {
    const days = daysOutOf(signal);
    if (days === null) return null;
    if (days === 0) return "Today";
    if (days === 1) return "Tomorrow";
    if (days === -1) return "Yesterday";
    if (days > 1 && days < 7) return deadlineWeekday(signalDeadline(signal), timezone)?.slice(0, 3) ?? null;
    return deadlineShortDate(signalDeadline(signal), timezone);
  };
  const toTaskRow = (signal: TaskSignal): HomeTaskRow => ({
    id: signal.id,
    title: signal.title,
    source: signal.sourceLabel,
    lane: signal.lane,
    priority: signal.priority,
    due: shortDue(signal),
    overdue: overdue(signal),
    href: taskHref(signal.id),
  });

  const stats: HomeStats = {
    open: openSignals.length,
    dueToday: openSignals.filter((signal) => daysOutOf(signal) === 0).length,
    overdue: openSignals.filter(overdue).length,
    inReview: openSignals.filter((signal) => signal.lane === "review").length,
    doneThisWeek: signals.filter(
      (signal) => signal.lane === "shipped" && signal.movedToShippedAt != null && now - signal.movedToShippedAt <= 7 * DAY_MS,
    ).length,
  };

  // My tasks: what is in motion first, then by urgency (overdue, due soon,
  // priority), so the list reads as "what to pick up next".
  const laneRank: Record<string, number> = { "in-flight": 0, review: 1, next: 2 };
  const myTasks = [...openSignals]
    .sort((a, b) => {
      const lane = (laneRank[a.lane] ?? 3) - (laneRank[b.lane] ?? 3);
      if (lane !== 0) return lane;
      const due = sortDue(a, b);
      if (due !== 0) return due;
      return (a.priority ?? Number.MAX_SAFE_INTEGER) - (b.priority ?? Number.MAX_SAFE_INTEGER);
    })
    .slice(0, MY_TASKS_CAP)
    .map(toTaskRow);

  const dated = openSignals
    .filter((signal) => daysOutOf(signal) !== null)
    .map((signal) => ({ signal, days: daysOutOf(signal)! }))
    .filter(({ days }) => days <= COMING_UP_WINDOW_DAYS)
    .sort((a, b) => sortDue(a.signal, b.signal))
    .slice(0, DEADLINE_CAP);
  const groupOrder = ["Overdue", "Today", "Tomorrow", "This week", "Later"] as const;
  const groupFor = (signal: TaskSignal, days: number) =>
    overdue(signal) ? "Overdue" : days === 0 ? "Today" : days === 1 ? "Tomorrow" : days < 7 ? "This week" : "Later";
  const deadlines: HomeDeadlineGroup[] = groupOrder
    .map((label) => ({
      label,
      rows: dated.filter(({ signal, days }) => groupFor(signal, days) === label).map(({ signal }) => toTaskRow(signal)),
    }))
    .filter((group) => group.rows.length > 0);

  const dateLabel = new Date(now)
    .toLocaleDateString("en-GB", {
      timeZone: timezone,
      weekday: "long",
      day: "numeric",
      month: "long",
    })
    .toUpperCase();

  return {
    kind: "ok",
    scope: authorizedScope.scope,
    dateLabel,
    greeting: greetingFor(briefing.greetingHour),
    scopeLabel: authorizedScope.label,
    briefingHref: aggregateHref,
    signalRows,
    allClear,
    comingUp,
    needsReview,
    stats,
    dateCoverageComplete,
    myTasks,
    deadlines,
  };
}
