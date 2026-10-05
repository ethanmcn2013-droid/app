import { createHash } from "node:crypto";
import { phraseFor } from "./prose";
import type { BriefingContext, BriefingSource } from "./source";
import {
  detectBlockedTooLong,
  detectBlockingDueWork,
  detectCrowdedWeek,
  detectDueSoon,
  detectJustShipped,
  detectOverload,
  detectPrerequisitesComplete,
  detectPrerequisitesUnverified,
  detectStuckWork,
  type Triggered,
} from "./triggers";
import type { BriefItem, Briefing, FocusItem, TriggerKind } from "./types";
import {
  deadlineDayDifference,
  deadlineIsOverdue,
  deadlineShortDate,
  deadlineWeekday,
  localHour,
  signalDeadline,
} from "./calendar-time";

const BUCKET_CAP = 3;
const DAY = 86_400_000;

/**
 * Per-user read state the orchestrator threads into the pure engine.
 *
 * `suppressed`, keys the reader has dismissed ("Not really" tap).
 *   Keys are `${trigger}:${taskId}`; a `*:${taskId}` key dismisses the
 *   item under every trigger (feedback rows without a trigger id).
 *   A dismissal sticks for that reason, the same task can still
 *   surface under a *different* trigger if its situation changes.
 *
 * `ages`, consecutive-day surfacing counts keyed `${trigger}:${taskId}`,
 *   including today. Items at day ≥ 2 are carry-overs: they keep their
 *   place inside the block's cap but move to the bottom and carry an
 *   honest age note (PRODUCT.md §5.3 de-emphasis).
 */
export type ReadState = {
  suppressed?: ReadonlySet<string>;
  ages?: ReadonlyMap<string, number>;
  timezone?: string;
};

/**
 * The engine. Pure function over a BriefingSource. Same inputs →
 * same brief on the same day; rotation index advances per day so
 * prose phrasings don't repeat two days in a row.
 */
export async function buildBriefing(
  source: BriefingSource,
  ctx: BriefingContext,
  now: number = Date.now(),
  readState: ReadState = {},
): Promise<Briefing> {
  const signals = await source.getSignalsForUser(ctx);
  const readTaskIds = [...new Set(signals.flatMap(task =>
    [task.id, ...(task.prerequisiteEvidence ?? [])
      .filter(record => task.workspaceId && record.workspaceId === task.workspaceId)
      .map(record => record.id)]))].sort();
  const inspected = new Set(readTaskIds);
  const userId = ctx.userId;

  const suppressed = readState.suppressed ?? new Set<string>();
  const timezone = readState.timezone ?? "UTC";
  const notDismissed = (t: Triggered) =>
    !suppressed.has(`${t.trigger}:${t.task.id}`) &&
    !suppressed.has(`*:${t.task.id}`);

  const stuck = detectStuckWork(signals).filter(notDismissed);
  const dueSoon = detectDueSoon(signals, now, timezone).filter(notDismissed);
  const shipped = detectJustShipped(signals, now).filter(notDismissed);
  const overload = detectOverload(signals).filter(notDismissed);
  const crowded = detectCrowdedWeek(signals, now, timezone).filter(notDismissed);
  const blocked = detectBlockedTooLong(signals).filter(notDismissed);
  const blockingDueWork = detectBlockingDueWork(signals, now, timezone).filter(notDismissed);
  const prerequisitesComplete = detectPrerequisitesComplete(signals, now, timezone).filter(notDismissed);
  const prerequisitesUnverified = detectPrerequisitesUnverified(signals, now, timezone).filter(notDismissed);

  // Build a {taskId → title} map once so blocked-too-long prose can
  // name the upstream blocker ("blocked by Music supplier") instead
  // of saying "blocked for 9 days" without context.
  const titlesById = new Map<string, string>();
  for (const s of signals) titlesById.set(s.id, s.title);
  const visibleById = new Map(signals.map(signal => [signal.id, signal]));
  const openPrerequisitesByTask = new Map(signals.map(signal => [signal.id,
    [...new Set(signal.blockedBy)].flatMap(id => {
      const prerequisite = visibleById.get(id);
      return prerequisite && prerequisite.id !== signal.id && signal.workspaceId &&
        prerequisite.workspaceId === signal.workspaceId && prerequisite.lane !== "shipped"
        ? [prerequisite.id] : [];
    }),
  ]));

  const rotationIndex = dayRotation(userId, now);

  // ─ Needs attention: due-soon (incl. overdue) + overload + crowded-week,
  // ordered by severity. The week-cluster signal lands here because it's
  // load-this-week, not background.
  const bestByObservation = new Map<string, Triggered>();
  for (const candidate of [
    ...dueSoon,
    ...blockingDueWork,
    ...overload,
    ...crowded,
    ...stuck,
    ...blocked,
    ...prerequisitesComplete,
    ...prerequisitesUnverified,
    ...shipped,
  ]) {
    // Primary task pressure still has one winning rule. Relationships and
    // readiness are different observations, even when they navigate to the
    // same task. Never join their source sets into a deadline-only row.
    const sources = candidate.representedTaskIds ?? (candidate.trigger === "prerequisites-complete"
      ? [candidate.task.id, ...(candidate.task.verifiedPrerequisiteIds ?? [])]
      : candidate.trigger === "blocked-too-long"
        ? [candidate.task.id, ...(openPrerequisitesByTask.get(candidate.task.id) ?? [])]
        : [candidate.task.id]);
    candidate.representedTaskIds = [...new Set(sources)].filter(id => inspected.has(id)).sort();
    const scope = [candidate.task.workspaceId ?? "", candidate.task.planningPeriodId ?? ""];
    // A saved blocked predicate without another inspected same-scope source
    // is primary task pressure, not an independently established relationship.
    const relation = (candidate.trigger === "blocking-due-work" || candidate.trigger === "blocked-too-long") &&
      Boolean(candidate.task.workspaceId) && candidate.representedTaskIds.length > 1;
    const separate = relation || candidate.trigger === "prerequisites-complete" || candidate.trigger === "prerequisites-unverified" ||
      candidate.trigger === "overload" || candidate.trigger === "crowded-week";
    const key = JSON.stringify([scope, relation ? "dependency" : separate ? candidate.trigger : "task",
      candidate.representedTaskIds,
      relation ? candidate.relatedTaskId ?? candidate.task.id : ""]);
    const current = bestByObservation.get(key);
    if (!current || compareCandidates(candidate, current) < 0) {
      bestByObservation.set(key, candidate);
    }
  }
  const selected = Array.from(bestByObservation.values())
    .sort(compareCandidates)
    .slice(0, BUCKET_CAP);
  const triggeredTaskIds = [...new Set([...bestByObservation.values()]
    .flatMap(item => item.representedTaskIds ?? []))].sort();
  const attentionKinds = new Set<TriggerKind>([
    "due-soon",
    "blocking-due-work",
    "prerequisites-complete",
    "overload",
    "crowded-week",
  ]);
  const attention = selected.filter((item) => attentionKinds.has(item.trigger));

  // ─ Moving well: just-shipped, ordered by recency.
  //
  // Standing call on just-shipped (kept deliberately, not by omission):
  // `movingWell` and `suggestedFocus` render in no component today, so a
  // just-shipped item is invisible to the reader. It is NOT dropped from
  // the engine, because it is real and the surface for it is a design
  // decision, not an engine one. Two guards keep it from lying in the
  // meantime:
  //   1. It can never take a slot from work that is asking for the
  //      reader. Its focus weight (100) is an order below every other
  //      trigger, so it only enters `selected` when fewer than three
  //      other candidates exist and it displaces nothing.
  //   2. It stays inside `triggeredCount`, because it genuinely crossed
  //      a rule and removing it would make the ledger's
  //      read = flagged + cleared arithmetic false. Instead the all-clear
  //      copy names it: voice.ts readCountSentence takes the triggered
  //      count and refuses to say "nothing crossed" over a day where a
  //      shipped item did.
  const moving = selected.filter((item) => item.trigger === "just-shipped");

  // ─ Quiet risks: stuck-work, ordered by severity, EXCLUDING items
  // already in attention (so a stuck-work item that's also overdue
  // appears once, in attention, not twice).
  // Quiet risks: stuck-work + blocked-too-long, severity-sorted,
  // excluding anything already in attention or moving. blocked-too-long
  // lives here because it's about a long-tail issue, not today's load.
  const risks = selected.filter(
    (item) => item.trigger === "stuck-work" || item.trigger === "blocked-too-long" || item.trigger === "prerequisites-unverified",
  );

  // ─ Suggested focus: top 3 across attention + risks. due-soon
  // outranks stuck-work outranks overload. Already capped at 3.
  const focusSource = [...attention, ...risks]
    .sort((a, b) => focusWeight(b) - focusWeight(a))
    .slice(0, BUCKET_CAP);

  // Carry-over de-emphasis (PRODUCT.md §5.3): an item surfacing for a
  // second-plus consecutive day keeps its slot but moves below fresh
  // items and carries its age so the read stays honest about how long
  // it has been asking. Applied after the cap, age demotes within the
  // block, it never changes what qualifies.
  const ages = readState.ages ?? new Map<string, number>();
  const ageOf = (t: Triggered) => ages.get(`${t.trigger}:${t.task.id}`) ?? 1;
  const freshFirst = (list: Triggered[]): Triggered[] => [
    ...list.filter((t) => ageOf(t) < 2),
    ...list.filter((t) => ageOf(t) >= 2),
  ];

  const withAge = (t: Triggered, item: BriefItem): BriefItem =>
    ageOf(t) >= 2 ? { ...item, ageDays: ageOf(t) } : item;

  const needsAttention: BriefItem[] = freshFirst(attention).map((t) =>
    withAge(t, toItem(t, rotationIndex, now, titlesById, timezone)),
  );
  const movingWell: BriefItem[] = moving.map((t) =>
    toItem(t, rotationIndex, now, titlesById, timezone),
  );
  const quietRisks: BriefItem[] = freshFirst(risks).map((t) =>
    withAge(t, toItem(t, rotationIndex, now, titlesById, timezone)),
  );
  const suggestedFocus: FocusItem[] = focusSource.map((t) =>
    toFocus(t, rotationIndex, now, timezone),
  );

  const isEmpty =
    needsAttention.length === 0 &&
    movingWell.length === 0 &&
    quietRisks.length === 0;

  return {
    userId,
    generatedAt: now,
    greetingHour: localHour(now, timezone),
    needsAttention,
    movingWell,
    quietRisks,
    suggestedFocus,
    isEmpty,
    ...(signals.some(signal => signal.activityCoverage === "partial") ? {
      activityCoverageNote: signals.some(signal => signal.activityCoverage === "partial" && signal.hasRecordedTitleEdit === true)
        ? "A recorded title edit does not establish meaningful work progress. Activity history is incomplete."
        : "Activity history is incomplete. Task update timestamps do not establish meaningful progress or inactivity.",
    } : {}),
    // Records actually inspected, not dangling references or repeated reads.
    // Completed prerequisite evidence may be outside the visible task list.
    readCount: readTaskIds.length,
    readTaskIds,
    triggeredTaskIds,
    // Counted before `selected` applies BUCKET_CAP, so the ledger can keep
    // "cleared" honest: work that crossed a rule but lost its slot to the
    // cap is held back, not clear, and must never be counted as clear.
    //
    // Synthetic observation IDs never add task records. Their actual members
    // contribute once, even when another observation uses the same sources.
    triggeredCount: triggeredTaskIds.length,
  };
}

function toItem(
  t: Triggered,
  rotation: number,
  now: number,
  titlesById: Map<string, string>,
  timezone: string,
): BriefItem {
  const deadline = signalDeadline(t.task);
  const daysOut = deadlineDayDifference(deadline, now, timezone) ?? undefined;
  const blockedByTitles = t.task.blockedBy
    .map((id) => titlesById.get(id))
    .filter((title): title is string => Boolean(title));
  // The split the whole engine turns on: the title is the headline, the
  // phrasing is the observation about it. Rotation moves the
  // observation, never the title, so a reader who returns tomorrow
  // still recognises the same row.
  const primaryDetail = phraseFor(t.trigger, t.task, rotation, {
    idleDays: t.task.idleDays ?? undefined,
    daysOut,
    pastToday: t.trigger === "due-soon" && daysOut === 0 && deadlineIsOverdue(deadline, now, timezone),
    instantRemainingMs: t.trigger === "due-soon" && deadline?.kind === "instant" && deadline.at > now
      ? deadline.at - now : undefined,
    blockedByTitles,
    relatedTaskTitle: t.relatedTaskTitle,
    savedDateLabel: t.trigger === "prerequisites-complete" ? deadlineShortDate(signalDeadline(t.task), timezone) ?? undefined : undefined,
  });
  return {
    id: t.task.id,
    observationId: observationId(t),
    evidenceTaskIds: t.representedTaskIds,
    text: headline(t),
    detail: primaryDetail,
    sourceLabel: t.task.sourceLabel,
    trigger: t.trigger,
    reasons: t.reasons,
    workspaceId: t.task.workspaceId,
    planningPeriodId: t.task.planningPeriodId,
  };
}

function toFocus(t: Triggered, rotation: number, now: number, timezone: string): FocusItem {
  return {
    id: t.task.id,
    observationId: observationId(t),
    text: headline(t),
    due: focusDue(t, now, timezone),
    trigger: t.trigger,
  };
}

function observationId(t: Triggered): string {
  // Hash private evidence identities: no resolved historical prerequisite id
  // is exposed in a public row key. Anchor changes do not rename a relationship.
  return `observation:${createHash("sha256").update(JSON.stringify([
    t.trigger === "blocking-due-work" || t.trigger === "blocked-too-long" ? "dependency" : t.trigger,
    t.task.workspaceId ?? "", t.task.planningPeriodId ?? "",
    t.representedTaskIds ?? [t.task.id],
    t.trigger === "blocking-due-work" ? t.relatedTaskId ?? "" : t.trigger === "blocked-too-long" ? t.task.id : "",
  ])).digest("hex")}`;
}

/**
 * The row's headline: the title the reader wrote, sentence-cased and
 * otherwise untouched. Nothing is appended, so a title that already
 * ends in a full stop, a question mark, or a colon survives intact
 * ("Send the invitations.", "Do we need a marquee?", "URGENT: confirm
 * the band"). Only the first character is touched, so proper nouns and
 * deliberate capitals are never flattened.
 *
 * BRAND.md §3: "'Suggested focus' is the strongest verb the briefing
 * uses." The engine names, it does not command, so this is also the
 * focus line. The old focus copy for the synthetic triggers ("Drop two
 * in-flight items by end of day") issued an order, which DESIGN.md §11
 * refuses; the synthetic titles read as headlines on their own.
 */
function headline(t: Triggered): string {
  const title = t.task.title.trim();
  return title.length ? title[0].toUpperCase() + title.slice(1) : title;
}

function focusDue(t: Triggered, now: number, timezone: string): string {
  if (t.trigger === "blocking-due-work" || t.trigger === "prerequisites-complete" || t.trigger === "prerequisites-unverified") {
    // Never borrow a dependent's deadline for its blocker. The completed-
    // prerequisite window can cross a calendar week, so name its own date.
    return deadlineShortDate(signalDeadline(t.task), timezone) ?? "No confirmed date";
  }
  if (t.trigger === "due-soon") {
    const deadline = signalDeadline(t.task);
    const daysOut = deadlineDayDifference(deadline, now, timezone);
    if (daysOut === null) return "this week";
    if (deadlineIsOverdue(deadline, now, timezone)) return "overdue";
    if (daysOut < 1) return "today";
    if (daysOut < 2) return "tomorrow";
    if (daysOut < 5) return `by ${deadlineWeekday(deadline, timezone)}`;
    return "this week";
  }
  if (t.trigger === "overload") return "today";
  if (t.trigger === "crowded-week") return "this week";
  if (t.trigger === "blocked-too-long") return "this week";
  return "this week";
}

/** Focus ranking, locked weights for the six v1 triggers.
 *  due-soon outranks everything (real deadline pressure).
 *  crowded-week sits between due-soon and stuck-work, it's a
 *  cluster signal but not yet a per-task deadline.
 *  blocked-too-long ranks below stuck-work because the action
 *  ("chase the blocker") is upstream, not the user's own work.
 *  just-shipped is celebration-only, never the lead of focus. */
function focusWeight(t: Triggered): number {
  const base: Record<TriggerKind, number> = {
    "due-soon": 1000,
    "blocking-due-work": 900,
    "crowded-week": 800,
    "stuck-work": 700,
    "blocked-too-long": 600,
    "prerequisites-complete": 600,
    "prerequisites-unverified": 600,
    overload: 500,
    "just-shipped": 100,
  };
  return base[t.trigger] + t.severity;
}

function compareCandidates(a: Triggered, b: Triggered): number {
  const byWeight = focusWeight(b) - focusWeight(a);
  if (byWeight !== 0) return byWeight;
  const bySeverity = b.severity - a.severity;
  if (bySeverity !== 0) return bySeverity;
  const byTrigger = a.trigger.localeCompare(b.trigger);
  if (byTrigger !== 0) return byTrigger;
  // A unary key preserves transitivity when known and unknown priorities
  // mingle. Only real open work uses the declared P0..P3 order; synthetic
  // aggregates and terminal observations stay in the inapplicable bucket.
  const priorityRank = (item: Triggered): number => {
    if (item.task.lane === "shipped" || item.task.id.startsWith("synthetic:")) return 4;
    const priority = item.task.priority;
    return priority === 0 || priority === 1 || priority === 2 || priority === 3 ? priority : 4;
  };
  const byPriority = priorityRank(a) - priorityRank(b);
  if (byPriority !== 0) return byPriority;
  return a.task.id.localeCompare(b.task.id);
}

/** Stable per-day rotation index so the same user gets a different
 *  phrasing each day, but the same phrasing if they reload the
 *  brief twice on the same day. */
function dayRotation(userId: string, now: number): number {
  const day = Math.floor(now / DAY);
  let h = 0;
  for (let i = 0; i < userId.length; i++) {
    h = ((h << 5) - h + userId.charCodeAt(i)) | 0;
  }
  return Math.abs(h + day);
}
