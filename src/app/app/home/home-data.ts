import "server-only";

/**
 * Signal's narrow entry point, not its barrel. The barrel also re-exports
 * the three briefing route components, so importing the data surface
 * through it put that client tree in Home's chunk group and the build
 * emitted a near-duplicate of it for a page that renders none of it.
 */
import {
  buildBriefingForUser,
  calendarDayDifference,
  localWeekday,
  type BriefItem,
  type TaskSignal,
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
  idleDays: number;
  href: string;
};

export type HomeData =
  | { kind: "new-user" }
  | {
      kind: "ok";
      dateLabel: string;
      greeting: string;
      scopeLabel: string;
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
    };

const COMING_UP_WINDOW_DAYS = 14;
const COMING_UP_CAP = 4;
const REVIEW_CAP = 3;

function taskHref(id: string): string {
  return `/app/task/${id}`;
}

function greetingFor(hour: number): string {
  if (hour < 5) return "Still up.";
  if (hour < 12) return "Good morning.";
  if (hour < 17) return "Good afternoon.";
  return "Good evening.";
}

function dueFromDays(daysOut: number, dueAt: number, timezone: string): string {
  if (daysOut < 0) return "overdue";
  if (daysOut < 1) return "today";
  if (daysOut < 2) return "tomorrow";
  if (daysOut < 7) return `by ${localWeekday(dueAt, timezone)}`;
  return "in the next two weeks";
}

export async function loadHomeData(opts: {
  clerkId: string;
}): Promise<HomeData> {
  const result = await buildBriefingForUser({
    clerkId: opts.clerkId,
    cadence: "daily",
    recordReadState: false,
  });
  if (result.kind === "no-workspace") return { kind: "new-user" };

  const { briefing, authorizedScope, signals } = result;
  const timezone = authorizedScope.timezone;
  const now = briefing.generatedAt;

  const dueById = new Map(
    briefing.suggestedFocus.map((item) => [item.id, item.due]),
  );
  const toSignalRow = (item: BriefItem): HomeSignalRow => ({
    id: item.id,
    title: item.text,
    why: item.detail,
    source: item.sourceLabel,
    due: dueById.get(item.id) ?? null,
    trigger: item.trigger,
    href: taskHref(item.id),
  });

  // The engine already selected and capped (≤3 across attention +
  // risks); Home renders that selection in the engine's own order.
  const signalRows = [
    ...briefing.needsAttention.map(toSignalRow),
    ...briefing.quietRisks.map(toSignalRow),
  ];

  const surfacedIds = new Set(signalRows.map((row) => row.id));

  const comingUp: HomeComingRow[] = signals
    .filter(
      (signal): signal is TaskSignal & { dueAt: number } =>
        signal.dueAt != null &&
        signal.lane !== "shipped" &&
        !surfacedIds.has(signal.id),
    )
    .map((signal) => ({
      signal,
      daysOut: calendarDayDifference(signal.dueAt, now, timezone),
    }))
    .filter(({ daysOut }) => daysOut >= 0 && daysOut <= COMING_UP_WINDOW_DAYS)
    .sort((a, b) => a.signal.dueAt - b.signal.dueAt)
    .slice(0, COMING_UP_CAP)
    .map(({ signal, daysOut }) => ({
      id: signal.id,
      title: signal.title,
      source: signal.sourceLabel,
      due: dueFromDays(daysOut, signal.dueAt, timezone),
      href: taskHref(signal.id),
    }));

  const needsReview: HomeReviewRow[] = signals
    .filter(
      (signal) => signal.lane === "review" && !surfacedIds.has(signal.id),
    )
    .sort((a, b) => b.idleDays - a.idleDays)
    .slice(0, REVIEW_CAP)
    .map((signal) => ({
      id: signal.id,
      title: signal.title,
      source: signal.sourceLabel,
      idleDays: signal.idleDays,
      href: taskHref(signal.id),
    }));

  // All-clear only when nothing is asking. The engine's honesty guard
  // carries over: when something shipped recently, the quiet state
  // names it instead of claiming nothing happened.
  const shippedCount = briefing.movingWell.length;
  const allClear =
    signalRows.length === 0
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
    dateLabel,
    greeting: greetingFor(briefing.greetingHour),
    scopeLabel: authorizedScope.label,
    signalRows,
    allClear,
    comingUp,
    needsReview,
  };
}
