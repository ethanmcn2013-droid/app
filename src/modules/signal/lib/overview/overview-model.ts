import {
  stableSignalLedgerId,
  type SignalLedgerDTO,
  type SignalLedgerCoverageStatus,
  type SignalLedgerEmptyState,
  type SignalLedgerEntry,
} from "../analytics/ledger-contract";
import { groupLegacyBriefItems } from "../analytics/ledger-adapters";
import {
  calendarDayDifference,
  deadlineDayDifference,
  deadlineIsOverdue,
  deadlineShortDate,
  compareDeadlines,
  deadlineWeekday,
  signalDeadline,
} from "../briefing/calendar-time";
import { canonicalDate } from "../data/deadline";
import type { Briefing, BriefItem, TaskSignal, TriggerKind } from "../briefing/types";
import type { AuthorizedSignalScope } from "../planning-periods/scope";

/**
 * The Overview view model: the full read across one authorized scope.
 *
 * Per project (founder direction, 24 Sep 2026: "no need for program views"):
 * nothing here offers or labels a planning-period view. A planning-period
 * read requested by URL still renders honestly, since the server authorizes
 * it as before, but as one read with no cross-project breakdown.
 *
 * Pure presentation. Every figure here is derived from inputs the briefing
 * build already produced — the protected ledger DTO, the engine's buckets,
 * and the authorization-scoped signals it read — so nothing is invented and
 * nothing reaches around the scope check. The engine's ranking is untouched:
 * attention and risk rows arrive in the ledger's own order.
 *
 * Two boundaries are kept deliberately:
 *   - Signal rows (attention, risks) carry only the ledger's opaque entry id.
 *     Opening one goes through the server action that rebuilds the briefing,
 *     exactly as before; no source id is added to them here.
 *   - Rows derived from the signals list (dates, recently finished) link to
 *     the task route the way Home does, with the id path-encoded.
 */

export type OverviewTone = "danger" | "warning" | "review" | "success" | "neutral";

export type OverviewChip = { label: string; tone: OverviewTone };

export type OverviewSignal = {
  entry: SignalLedgerEntry;
  chip: OverviewChip;
  /** Carry-over age, sentence-cased ("Still open, day 3"). */
  age: string | null;
};

export type OverviewLaneCounts = {
  todo: number;
  inProgress: number;
  review: number;
  done: number;
  total: number;
  /** Finished in the seven days before the read. */
  doneThisWeek: number;
  /** Open work with no date on it. */
  undated: number;
};

export type OverviewDateRow = {
  key: string;
  title: string;
  href: string;
  /** "Today", "Tomorrow", "14 Jul". */
  day: string;
  /** "2 days late", "Past its time today", "In 16 days", or null. */
  relative: string | null;
  tone: OverviewTone;
};

export type OverviewRunwayMark = {
  /** 0–1 along the track, measured from today to the end of the window. */
  at: number;
  tone: OverviewTone;
};

export type OverviewRunway = {
  dateCoverageComplete: boolean;
  keyDate: {
    label: string;
    /** Named only when the scope spans several projects. */
    project: string | null;
    dateLabel: string;
    shortLabel: string;
    daysAway: number;
  } | null;
  windowDays: number;
  endLabel: string;
  overdue: number;
  marks: OverviewRunwayMark[];
  /** Month starts inside the window, for scale. Only on windows long enough
   *  to need them, and never crowding the today or end labels. */
  ticks: { at: number; label: string }[];
  rows: OverviewDateRow[];
  /** Dated rows beyond the list's cap, so the list never pretends to be all. */
  more: number;
};

export type OverviewFinishedRow = {
  key: string;
  title: string;
  href: string;
  source: string;
  when: string;
};

export type OverviewVerdict = {
  tone: OverviewTone;
  sentence: string;
};

export type OverviewModel = {
  dateLabel: string;
  timeLabel: string;
  scopeLabel: string | null;
  verdict: OverviewVerdict;
  coverage: { note: string; tone: OverviewTone } | null;
  attention: OverviewSignal[];
  risks: OverviewSignal[];
  activity: OverviewSignal[];
  emptyState: SignalLedgerEmptyState | null;
  lanes: OverviewLaneCounts | null;
  runway: OverviewRunway | null;
  finished: OverviewFinishedRow[] | null;
  finishedCoverageComplete: boolean;
  readNote: string | null;
};

export type OverviewLegacyInput = {
  briefing: Briefing;
  signals: readonly TaskSignal[];
  authorizedScope: AuthorizedSignalScope;
};

const DAY_MS = 86_400_000;
const WINDOW_DAYS = 14;
const DATE_ROW_CAP = 5;
const FINISHED_CAP = 5;

export function buildOverviewModel(input: {
  ledger: SignalLedgerDTO;
  timezone: string;
  legacy?: OverviewLegacyInput | null;
}): OverviewModel {
  const { ledger, legacy } = input;
  const timezone = safeTimezone(input.timezone);
  const generatedAt = Date.parse(ledger.generatedAt);
  const now = legacy?.briefing.generatedAt ?? (Number.isNaN(generatedAt) ? 0 : generatedAt);

  const chips = legacy ? legacyChips(legacy, timezone) : new Map<string, OverviewChip>();
  const toSignal = (entry: SignalLedgerEntry): OverviewSignal => ({
    entry,
    chip: chips.get(entry.id) ?? stateChip(entry),
    age: entry.receipt.ageLabel ? sentenceCase(entry.receipt.ageLabel) : null,
  });
  const attention = ledger.entries.filter((entry) => entry.section === "attention").map(toSignal);
  const risks = ledger.entries.filter((entry) => entry.section === "risks").map(toSignal);
  const activity = ledger.entries.filter((entry) => entry.section === "activity").map(toSignal);
  const coverageStatus = coverageStatusFor(ledger);

  const lanes = legacy ? laneCounts(legacy.signals, now) : null;
  const coverageNote = ledger.coverageNote ?? (coverageStatus === "complete" ? null : coverageLimitation(coverageStatus));
  const coverage = coverageNote
    ? { note: coverageNote, tone: (coverageStatus === "complete" ? "neutral"
        : coverageStatus === "unavailable" ? "danger" : "warning") as OverviewTone }
    : null;

  return {
    dateLabel: formatDate(now, timezone, { weekday: "long", day: "numeric", month: "long" }),
    timeLabel: formatTime(now, timezone),
    scopeLabel: ledger.scopeLabel,
    verdict: verdictFor(attention.length, risks.length, activity.length, ledger, lanes, coverageStatus),
    coverage,
    attention,
    risks,
    activity,
    emptyState: coverageStatus === "complete" || ledger.emptyState?.kind === "coverage" ? ledger.emptyState : null,
    lanes,
    runway: legacy ? runwayFor(legacy, now, timezone) : null,
    finished: legacy ? finishedFor(legacy.signals, now, timezone) : null,
    finishedCoverageComplete: legacy?.signals.every((signal) => signal.lane !== "shipped" || signal.movedToShippedAt != null) ?? false,
    readNote: readNoteFor(ledger, legacy ? "task" : "item", formatTime(now, timezone)),
  };
}

/* ── Signal rows ─────────────────────────────────────────────────────── */

function legacyChips(legacy: OverviewLegacyInput, timezone: string): Map<string, OverviewChip> {
  const byId = new Map(legacy.signals.map((signal) => [signal.id, signal]));
  const chips = new Map<string, OverviewChip>();
  for (const group of groupLegacyBriefItems(legacy.briefing)) {
    const lead = group.items[0];
    if (!lead) continue;
    chips.set(
      stableSignalLedgerId(`legacy:${group.key}`),
      triggerChip(lead, byId.get(lead.id), legacy.briefing.generatedAt, timezone),
    );
  }
  return chips;
}

function triggerChip(
  item: BriefItem,
  signal: TaskSignal | undefined,
  now: number,
  timezone: string,
): OverviewChip {
  const byTrigger: Record<Exclude<TriggerKind, "due-soon">, OverviewChip> = {
    "stuck-work": { label: "Stalled", tone: "warning" },
    "blocked-too-long": { label: "Waiting on other work", tone: "warning" },
    "blocking-due-work": { label: "Holding up due work", tone: "warning" },
    "prerequisites-complete": { label: "Earlier work done", tone: "neutral" },
    "prerequisites-unverified": { label: "Prerequisites unconfirmed", tone: "warning" },
    overload: { label: "Workload", tone: "warning" },
    "crowded-week": { label: "Busy week", tone: "warning" },
    "just-shipped": { label: "Finished", tone: "neutral" },
    "recorded-activity": { label: "Recorded activity", tone: "neutral" },
  };
  if (item.trigger !== "due-soon") return byTrigger[item.trigger];
  const days = signal ? deadlineDayDifference(signalDeadline(signal), now, timezone) : null;
  if (days === null) return { label: "Due soon", tone: "warning" };
  if (deadlineIsOverdue(signalDeadline(signal!), now, timezone)) return { label: "Overdue", tone: "danger" };
  if (days === 0) return { label: "Due today", tone: "warning" };
  if (days === 1) return { label: "Due tomorrow", tone: "warning" };
  return {
    label: `Due ${deadlineWeekday(signalDeadline(signal!), timezone)}`,
    tone: "neutral",
  };
}

/** The progressive engine carries a state, not a trigger. */
function stateChip(entry: SignalLedgerEntry): OverviewChip {
  if (entry.state === "recorded") return { label: "Recorded work", tone: "neutral" };
  return entry.state === "needs_attention"
    ? { label: "Needs you", tone: "danger" }
    : { label: "Worth watching", tone: "warning" };
}

/* ── Work in scope ───────────────────────────────────────────────────── */

export function laneCounts(signals: readonly TaskSignal[], now: number): OverviewLaneCounts {
  const counts: OverviewLaneCounts = {
    todo: 0,
    inProgress: 0,
    review: 0,
    done: 0,
    total: signals.length,
    doneThisWeek: 0,
    undated: 0,
  };
  for (const signal of signals) {
    const phase = signal.stage?.phase ?? signal.lane;
    if (phase !== "shipped" && !signalDeadline(signal)) counts.undated += 1;
    if (phase === "next") counts.todo += 1;
    else if (phase === "in-flight") counts.inProgress += 1;
    else if (phase === "review") counts.review += 1;
    else if (phase === "shipped") {
      counts.done += 1;
      if (signal.movedToShippedAt != null && now - signal.movedToShippedAt <= 7 * DAY_MS) {
        counts.doneThisWeek += 1;
      }
    }
  }
  return counts;
}

/* ── Dates ahead ─────────────────────────────────────────────────────── */

function runwayFor(legacy: OverviewLegacyInput, now: number, timezone: string): OverviewRunway {
  const { authorizedScope } = legacy;
  const multiple = authorizedScope.workspaces.length > 1;

  const keyDate =
    authorizedScope.workspaces
      .map((workspace) => {
        const date = canonicalDate(workspace.primaryDate);
        if (!date) return null;
        const deadline = { kind: "date-only" as const, date };
        const daysAway = deadlineDayDifference(deadline, now, timezone)!;
        if (daysAway < 0) return null;
        return {
          label: workspace.primaryDateLabel?.trim() || "Key date",
          project: multiple ? workspace.name : null,
          dateLabel: new Intl.DateTimeFormat("en-IE", { timeZone: "UTC", weekday: "long", day: "numeric", month: "long" }).format(new Date(`${date}T00:00:00.000Z`)),
          shortLabel: deadlineShortDate(deadline, timezone)!,
          daysAway,
        };
      })
      .filter((value): value is NonNullable<typeof value> => value !== null)
      .sort((a, b) => a.daysAway - b.daysAway)[0] ?? null;

  const windowDays = keyDate ? Math.max(keyDate.daysAway, 1) : WINDOW_DAYS;
  const dated = legacy.signals
    .filter(
      (signal) =>
        signal.lane !== "shipped" && deadlineDayDifference(signalDeadline(signal), now, timezone) !== null,
    )
    .map((signal) => ({ signal, days: deadlineDayDifference(signalDeadline(signal), now, timezone)! }))
    .filter(({ days }) => days <= windowDays)
    .sort((a, b) => compareDeadlines(signalDeadline(a.signal), signalDeadline(b.signal), timezone, now) || a.signal.title.localeCompare(b.signal.title));

  const overdue = dated.filter(({ signal }) => deadlineIsOverdue(signalDeadline(signal), now, timezone)).length;
  const marks: OverviewRunwayMark[] = dated
    .filter(({ signal }) => !deadlineIsOverdue(signalDeadline(signal), now, timezone))
    .map(({ days }) => ({ at: Math.min(1, days / windowDays), tone: days <= 1 ? "warning" : "review" }));

  const rows = dated.slice(0, DATE_ROW_CAP).map(({ signal, days }): OverviewDateRow => ({
    key: signal.id,
    title: signal.title,
    href: taskHref(signal.id),
    day:
      days === 0
        ? "Today"
        : days === 1
          ? "Tomorrow"
          : deadlineShortDate(signalDeadline(signal), timezone) ?? "Date unavailable",
    relative:
      deadlineIsOverdue(signalDeadline(signal), now, timezone) && days === 0
        ? "Past its time today"
        : days < 0
        ? `${-days} ${-days === 1 ? "day" : "days"} late`
        : days > 1
          ? `In ${days} days`
          : null,
    tone: deadlineIsOverdue(signalDeadline(signal), now, timezone) ? "danger" : days <= 1 ? "warning" : "neutral",
  }));

  const end = now + windowDays * DAY_MS;
  return {
    keyDate,
    dateCoverageComplete: legacy.signals.every((signal) => signalDeadline(signal)?.kind !== "unknown"),
    windowDays,
    endLabel: keyDate ? keyDate.shortLabel : formatDate(end, timezone, { day: "numeric", month: "short" }),
    overdue,
    marks,
    ticks: monthTicks(now, windowDays, timezone),
    rows,
    more: Math.max(0, dated.length - rows.length),
  };
}

function monthTicks(now: number, windowDays: number, timezone: string) {
  if (windowDays < 45) return [];
  const ticks: { at: number; label: string }[] = [];
  for (let day = 1; day < windowDays; day += 1) {
    const at = now + day * DAY_MS;
    if (formatDate(at, timezone, { day: "numeric" }) !== "1") continue;
    const position = calendarDayDifference(at, now, timezone) / windowDays;
    if (position < 0.12 || position > 0.86) continue;
    ticks.push({ at: position, label: formatDate(at, timezone, { month: "short" }) });
  }
  return ticks;
}

/* ── Recently finished ───────────────────────────────────────────────── */

function finishedFor(
  signals: readonly TaskSignal[],
  now: number,
  timezone: string,
): OverviewFinishedRow[] {
  return signals
    .filter(
      (signal): signal is TaskSignal & { movedToShippedAt: number } =>
        signal.lane === "shipped" &&
        signal.movedToShippedAt != null &&
        now - signal.movedToShippedAt <= 7 * DAY_MS,
    )
    .sort((a, b) => b.movedToShippedAt - a.movedToShippedAt)
    .slice(0, FINISHED_CAP)
    .map((signal) => {
      const days = calendarDayDifference(signal.movedToShippedAt, now, timezone);
      return {
        key: signal.id,
        title: signal.title,
        href: taskHref(signal.id),
        source: signal.sourceLabel,
        when: days >= 0 ? "Today" : days === -1 ? "Yesterday" : `${-days} days ago`,
      };
    });
}

/* ── Sentences ───────────────────────────────────────────────────────── */

type OverviewCoverageStatus = SignalLedgerCoverageStatus | "unknown";

function coverageStatusFor(ledger: SignalLedgerDTO): OverviewCoverageStatus {
  if (["complete", "partial", "stale", "unavailable"].includes(ledger.coverageStatus ?? "")) return ledger.coverageStatus!;
  // A missing historical DTO field never establishes complete coverage.
  if (ledger.freshness !== "fresh") return ledger.freshness;
  return "unknown";
}

function coverageLimitation(status: OverviewCoverageStatus): string {
  if (status === "partial") return "Some work could not be checked.";
  if (status === "stale") return "This is an older read.";
  if (status === "unavailable") return "Signal cannot reach the work right now.";
  return "Coverage could not be established for this read.";
}

function verdictFor(
  attention: number,
  risks: number,
  activity: number,
  ledger: SignalLedgerDTO,
  lanes: OverviewLaneCounts | null,
  coverageStatus: OverviewCoverageStatus,
): OverviewVerdict {
  if (attention > 0) {
    const lead = `${attention} ${attention === 1 ? "thing needs" : "things need"} attention`;
    return { tone: "danger", sentence: risks > 0 ? `${lead} and ${risks} ${risks === 1 ? "is" : "are"} at risk.` : `${lead}.` };
  }
  if (risks > 0) {
    return { tone: "warning", sentence: coverageStatus !== "complete"
      ? `${risks} ${risks === 1 ? "thing is" : "things are"} at risk. ${coverageLimitation(coverageStatus)}`
      : `Nothing is urgent. ${risks} ${risks === 1 ? "thing is" : "things are"} at risk.` };
  }
  if (coverageStatus !== "complete") {
    const finished = lanes?.doneThisWeek ?? 0;
    return { tone: coverageStatus === "unavailable" ? "danger" : "warning", sentence: finished > 0
      ? `${finished} finished this week. ${coverageLimitation(coverageStatus)}`
      : coverageStatus === "partial" ? (ledger.emptyState?.kind === "coverage" ? ledger.emptyState.headline : "Signal has only part of the picture.")
      : coverageLimitation(coverageStatus) };
  }
  if (activity > 0) return { tone: "neutral", sentence: `${activity} recorded ${activity === 1 ? "observation" : "observations"}.` };
  const finished = lanes?.doneThisWeek ?? 0;
  return { tone: "success", sentence: finished > 0
    ? `On track. ${finished} finished this week.`
    : "On track. Nothing needs attention right now." };
}

/**
 * How this was read, as one plain paragraph. The arithmetic closes in front
 * of the reader: read = crossed a rule + clear, and what is shown is a subset
 * of what crossed. Withheld entirely when the engine could not report a
 * denominator, rather than guessed.
 */
export function readNoteFor(
  ledger: SignalLedgerDTO,
  noun: "task" | "item",
  timeLabel: string,
): string | null {
  const counts = ledger.readCounts;
  if (!counts || counts.read <= 0) return null;
  const plural = (n: number) => `${n} ${n === 1 ? noun : `${noun}s`}`;
  const where = ledger.scopeLabel ? ` in ${ledger.scopeLabel}` : "";
  const parts = [`Signal read ${plural(counts.read)}${where} at ${timeLabel}.`];
  if (counts.flagged === 0) {
    parts.push(
      counts.read === 1
        ? "It did not cross any of Signal’s attention rules."
        : "None of them crossed Signal’s attention rules.",
    );
    return parts.join(" ");
  }
  if (counts.shown === 0) {
    parts.push(`${counts.flagged} crossed a rule without asking anything of you.`);
  } else if (counts.shown >= counts.flagged) {
    parts.push(
      counts.flagged === 1
        ? "1 crossed a rule and is shown above."
        : `${counts.flagged} crossed a rule and all of them are shown above.`,
    );
  } else {
    parts.push(
      `${counts.flagged} crossed a rule, and ${counts.shown} ${counts.shown === 1 ? "is" : "are"} shown above.`,
    );
  }
  if (counts.cleared > 0) {
    parts.push(`The other ${counts.cleared} ${counts.cleared === 1 ? "was" : "were"} clear.`);
  }
  return parts.join(" ");
}

/* ── Formatting ──────────────────────────────────────────────────────── */

function taskHref(id: string): string {
  return `/app/task/${encodeURIComponent(id)}`;
}

function sentenceCase(value: string): string {
  const trimmed = value.trim();
  return trimmed ? trimmed[0].toUpperCase() + trimmed.slice(1) : trimmed;
}

function safeTimezone(timezone: string): string {
  try {
    new Intl.DateTimeFormat("en-GB", { timeZone: timezone });
    return timezone;
  } catch {
    return "UTC";
  }
}

function formatDate(
  timestamp: number,
  timezone: string,
  options: Intl.DateTimeFormatOptions,
): string {
  return new Intl.DateTimeFormat("en-GB", { ...options, timeZone: timezone }).format(
    new Date(timestamp),
  );
}

function formatTime(timestamp: number, timezone: string): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(timestamp));
  const hour = parts.find((part) => part.type === "hour")?.value ?? "00";
  const minute = parts.find((part) => part.type === "minute")?.value ?? "00";
  return `${hour}:${minute}`;
}
