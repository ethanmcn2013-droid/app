import type {
  AudienceItemState,
  AudienceTimelineDto,
  AudienceTimelineItemDto,
} from "@/modules/timeline/lib/audience-timeline";

const CALENDAR_DATE = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 86_400_000;

export type TimelineArtifactPointState =
  | "complete"
  | "current"
  | "upcoming"
  | "overdue";

export type TimelineArtifactDensity =
  | "empty"
  | "single"
  | "sparse"
  | "standard";

export type TimelineOrderedReason =
  /** Nothing is plotted, so there is neither a sequence nor a calendar. */
  | "no-milestones"
  /** At least one plotted milestone has no date. Mixed data is ordered. */
  | "missing-timing"
  /** Every plotted milestone is dated, but they all land on one day. */
  | "no-range";

/**
 * How the rail's spacing is allowed to be read.
 *
 * `dated` — every plotted milestone carries a real date and the plan covers
 * more than one day, so distance along the rail is calendar distance and the
 * caps can state real dates.
 *
 * `ordered` — distance means sequence only. Nothing on this axis may be
 * derived from a date, because at least one milestone has none.
 */
export type TimelineAxis =
  | Readonly<{ mode: "dated"; startDate: string; endDate: string }>
  | Readonly<{ mode: "ordered"; reason: TimelineOrderedReason }>;

/** What the artifact draws. The view switches on this; nothing else decides. */
export type TimelineArtifactPresentation =
  | "empty"
  | "sequence-card"
  | "sequence-rail"
  | "calendar-rail";

export type TimelineRailCaps = Readonly<{ start: string | null; finish: string | null }>;

export type TimelineArtifactPoint = Readonly<{
  item: AudienceTimelineItemDto;
  position: number;
  /**
   * Position on the vertical (stacked) axis. Identical to `position` except
   * that long empty calendar stretches are capped, so a phone never spends a
   * full screen on one quiet gap. Today rides the same remap.
   */
  stackPosition: number;
  state: TimelineArtifactPointState;
  isNext: boolean;
}>;

export type TimelineMonthTick = Readonly<{
  /** Rail-percent on the horizontal axis, ridden through the same
      distortion as the points — the cartography cannot disagree with
      the dots it annotates. */
  position: number;
  /** The stacked (vertical) axis position, capped like everything else. */
  stackPosition: number;
  /** Short month name, e.g. "Feb"; January carries its year: "Jan ’27". */
  label: string;
}>;

export type TimelineArtifactModel = Readonly<{
  density: TimelineArtifactDensity;
  /**
   * Whether rail distance is allowed to mean calendar distance. Every other
   * temporal field on this model (`todayPosition`, `monthTicks`) is empty
   * unless this is `dated`.
   */
  axis: TimelineAxis;
  points: readonly TimelineArtifactPoint[];
  cancelled: readonly AudienceTimelineItemDto[];
  completedCount: number;
  totalCount: number;
  remainingCount: number;
  percent: number;
  todayPosition: number | null;
  todayStackPosition: number | null;
  /**
   * Month boundaries inside the plan's span, for the rail's cartography.
   * Empty when the timeline has no usable calendar axis, or when the span
   * is so long the ticks would become noise (they thin to quarters first).
   */
  monthTicks: readonly TimelineMonthTick[];
  /**
   * The rail-percent of the furthest completed milestone, or null when
   * nothing is complete. The completed ink is drawn to THIS, never to the
   * abstract count-percentage, so the fill and the dots are one statement.
   */
  completedFrontier: number | null;
  completedStackFrontier: number | null;
  nextMilestoneId: string | null;
  defaultSelectedId: string | null;
}>;

export type TimelineCountdown =
  | Readonly<{ kind: "future"; days: number }>
  | Readonly<{ kind: "today" }>
  | Readonly<{ kind: "past"; days: number }>;

const STATE_ORDER: Readonly<Record<AudienceItemState, number>> = {
  covered: 0,
  now: 1,
  next: 2,
  later: 3,
  cancelled: 4,
};

function calendarDay(value: string | null | undefined): number | null {
  if (!value || !CALENDAR_DATE.test(value)) return null;
  const parsed = Date.parse(`${value}T00:00:00.000Z`);
  if (!Number.isFinite(parsed)) return null;
  if (new Date(parsed).toISOString().slice(0, 10) !== value) return null;
  return parsed;
}

function clampPercent(value: number): number {
  return Math.max(0, Math.min(100, value));
}

function flattenTimeline(dto: AudienceTimelineDto): AudienceTimelineItemDto[] {
  return dto.sections
    .flatMap((section) => section.items)
    .map((item, sourceIndex) => ({ item, sourceIndex }))
    .sort((left, right) => {
      const stateDifference = STATE_ORDER[left.item.state] - STATE_ORDER[right.item.state];
      if (stateDifference !== 0) return stateDifference;
      if (left.item.date && right.item.date && left.item.date !== right.item.date) {
        return left.item.date.localeCompare(right.item.date);
      }
      if (left.item.date && !right.item.date) return -1;
      if (!left.item.date && right.item.date) return 1;
      return left.sourceIndex - right.sourceIndex;
    })
    .map(({ item }) => item);
}

function collisionSafePositions(rawPositions: readonly number[]): number[] {
  if (rawPositions.length === 0) return [];
  if (rawPositions.length === 1) return [50];

  const edge = Math.min(6, Math.max(3, 36 / rawPositions.length));
  const available = 100 - edge * 2;
  const minimumGap = Math.min(9, 80 / (rawPositions.length - 1));
  const resolved = rawPositions.map((position) => edge + (position / 100) * available);

  for (let index = 1; index < resolved.length; index += 1) {
    resolved[index] = Math.max(resolved[index], resolved[index - 1] + minimumGap);
  }

  const upper = 100 - edge;
  if (resolved.at(-1)! > upper) {
    resolved[resolved.length - 1] = upper;
    for (let index = resolved.length - 2; index >= 0; index -= 1) {
      resolved[index] = Math.min(resolved[index], resolved[index + 1] - minimumGap);
    }
  }

  return resolved.map(clampPercent);
}

/**
 * Positions that mean sequence, never time. Evenly spaced, because order is
 * the only fact being drawn.
 *
 * A lone milestone sits at the start of its own sequence rather than at the
 * centre of the rail. Dead centre of a time axis is a claim — "roughly
 * halfway through the plan" — that undated content cannot support, and it was
 * the halfway-placement defect. The view renders a single ordered milestone
 * as a compact sequence state rather than as a rail at all.
 */
function sequencePositions(count: number): number[] {
  if (count === 0) return [];
  if (count === 1) return [0];
  return Array.from({ length: count }, (_, index) => (index / (count - 1)) * 100);
}

function artifactDensity(count: number): TimelineArtifactDensity {
  if (count === 0) return "empty";
  if (count === 1) return "single";
  if (count <= 3) return "sparse";
  return "standard";
}

/**
 * Map a raw calendar percentage through the same distortion the points
 * received. `collisionSafePositions` may move clustered points a long way
 * from their raw calendar spots; anything else placed on the rail (the Today
 * dash) must ride the identical mapping or the artifact lies about order.
 * Piecewise-linear between each dated point's (raw, adjusted) pair, with the
 * rail's own edges as end anchors, keeps "between those two milestones"
 * truthful even when spacing is no longer calendar-proportional.
 */
function mapThroughPointDistortion(
  rawValue: number,
  anchors: ReadonlyArray<{ raw: number; adjusted: number }>,
  edge: number,
): number {
  const sorted = [...anchors].sort((left, right) => left.raw - right.raw);
  const full = [
    { raw: 0, adjusted: edge },
    ...sorted,
    { raw: 100, adjusted: 100 - edge },
  ];
  for (let index = 1; index < full.length; index += 1) {
    const lower = full[index - 1];
    const upper = full[index];
    if (rawValue > upper.raw) continue;
    if (upper.raw === lower.raw) return upper.adjusted;
    const ratio = (rawValue - lower.raw) / (upper.raw - lower.raw);
    return clampPercent(lower.adjusted + ratio * (upper.adjusted - lower.adjusted));
  }
  return clampPercent(100 - edge);
}

const MONTH_FORMATTER = new Intl.DateTimeFormat("en-GB", {
  month: "short",
  timeZone: "UTC",
});

/**
 * First-of-month instants strictly inside (axisStart, axisEnd). When a plan
 * spans years the ticks thin to quarters, then to Januarys, so cartography
 * never becomes noise. January ticks carry their year.
 */
function monthBoundaries(axisStart: number, axisEnd: number): Array<{ day: number; label: string }> {
  const boundaries: Array<{ day: number; label: string }> = [];
  const cursor = new Date(axisStart);
  cursor.setUTCDate(1);
  cursor.setUTCHours(0, 0, 0, 0);
  cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  while (cursor.getTime() < axisEnd) {
    const month = cursor.getUTCMonth();
    boundaries.push({
      day: cursor.getTime(),
      label: month === 0
        ? `Jan ’${String(cursor.getUTCFullYear() % 100).padStart(2, "0")}`
        : MONTH_FORMATTER.format(cursor),
    });
    cursor.setUTCMonth(month + 1);
  }
  if (boundaries.length > 14) {
    const quarters = boundaries.filter(({ day }) => new Date(day).getUTCMonth() % 3 === 0);
    return quarters.length > 14
      ? quarters.filter(({ day }) => new Date(day).getUTCMonth() === 0)
      : quarters;
  }
  return boundaries;
}

function isoDay(day: number): string {
  return new Date(day).toISOString().slice(0, 10);
}

/**
 * Decide whether this publication can honestly be drawn on a time axis.
 *
 * Pure, and taken from the DTO alone so the decision can be tested without
 * rendering anything.
 *
 * There are no project start or finish date columns in this schema, so the
 * domain is derived from the plan's own facts: the earliest dated milestone
 * to the latest, extended to `primaryDate` when that falls later.
 *
 * Dated mode needs both of these to hold:
 *
 * 1. **Every plotted milestone carries real timing.** Cancelled milestones are
 *    not plotted, so their dates neither qualify nor disqualify the axis;
 *    hidden ones are filtered upstream before the model sees them. Mixed data
 *    — some dated, some not — is ordered, because the only way to place the
 *    undated ones on a calendar is to invent a date for them.
 * 2. **At least two distinct dates, so the range is real.** A plan whose
 *    milestones all land on one day has no span to be proportional to.
 *
 * `today` cannot create a range: a one-day plan is not a span just because
 * the viewer opened it a week earlier. Once a real range exists, the returned
 * domain is widened to include today so the Today marker lands at a true
 * calendar position rather than being clamped onto the nearest milestone —
 * the caps then state the rail's actual ends, which is what they claim.
 */
export function resolveTimelineAxis(dto: AudienceTimelineDto): TimelineAxis {
  const plotted = dto.sections
    .flatMap((section) => section.items)
    .filter((item) => item.state !== "cancelled");
  if (plotted.length === 0) return { mode: "ordered", reason: "no-milestones" };

  const milestoneDays: number[] = [];
  for (const item of plotted) {
    const day = calendarDay(item.date);
    if (day === null) return { mode: "ordered", reason: "missing-timing" };
    milestoneDays.push(day);
  }

  const primaryDay = calendarDay(dto.primaryDate?.date);
  const planStart = Math.min(...milestoneDays);
  const planEnd = Math.max(...milestoneDays, ...(primaryDay === null ? [] : [primaryDay]));
  if (planEnd <= planStart) return { mode: "ordered", reason: "no-range" };

  const todayDay = calendarDay(dto.today);
  return {
    mode: "dated",
    startDate: isoDay(todayDay === null ? planStart : Math.min(planStart, todayDay)),
    endDate: isoDay(todayDay === null ? planEnd : Math.max(planEnd, todayDay)),
  };
}

/**
 * Rail positions for the plotted milestones, plus everything else that rides
 * the same axis. Ordered mode returns sequence positions and no calendar
 * furniture at all: no Today marker, no month ticks. There is no path here
 * that derives a position for an undated milestone.
 */
function railPositions(
  items: readonly AudienceTimelineItemDto[],
  today: string,
  axis: TimelineAxis,
): {
  pointPositions: number[];
  todayPosition: number | null;
  monthTicks: Array<{ position: number; label: string }>;
} {
  const sequenceOnly = {
    pointPositions: sequencePositions(items.length),
    todayPosition: null,
    monthTicks: [],
  };
  if (axis.mode !== "dated") return sequenceOnly;

  const axisStart = calendarDay(axis.startDate);
  const axisEnd = calendarDay(axis.endDate);
  if (axisStart === null || axisEnd === null || axisEnd <= axisStart) return sequenceOnly;

  // Dated mode guarantees every plotted milestone is dated. The loop keeps
  // that a structural fact rather than a comment: one missing date and the
  // whole axis falls back to sequence instead of fabricating a position.
  const itemDays: number[] = [];
  for (const item of items) {
    const day = calendarDay(item.date);
    if (day === null) return sequenceOnly;
    itemDays.push(day);
  }

  const rawPosition = (day: number): number => ((day - axisStart) / (axisEnd - axisStart)) * 100;
  const rawPointPositions = itemDays.map(rawPosition);
  const safePointPositions = collisionSafePositions(rawPointPositions);
  const edge = Math.min(6, Math.max(3, 36 / rawPointPositions.length));
  const datedAnchors = rawPointPositions.map((raw, index) => ({
    raw,
    adjusted: safePointPositions[index],
  }));
  const mapDay = (day: number): number => mapThroughPointDistortion(
    rawPosition(day),
    datedAnchors,
    edge,
  );
  const todayDay = calendarDay(today);
  const todayPosition = todayDay === null ? null : mapDay(todayDay);
  const monthTicks = monthBoundaries(axisStart, axisEnd).map(({ day, label }) => ({
    position: mapDay(day),
    label,
  }));

  return { pointPositions: safePointPositions, todayPosition, monthTicks };
}

/**
 * Cap long empty stretches for the stacked (vertical) axis. Horizontal
 * whitespace reads as time; vertical whitespace reads as a broken page. Gaps
 * are limited to `capRatio` × the mean gap and the sequence is rescaled back
 * onto the original span, so order and edge padding are preserved exactly.
 * Returns the input unchanged when nothing exceeds the cap.
 */
export function capStackGaps(
  positions: readonly number[],
  capRatio = 1.9,
): number[] {
  if (positions.length < 3) return [...positions];
  const first = positions[0];
  const last = positions[positions.length - 1];
  const span = last - first;
  if (span <= 0) return [...positions];

  const mean = span / (positions.length - 1);
  const cap = mean * capRatio;
  const gaps = positions.slice(1).map((position, index) =>
    Math.min(position - positions[index], cap),
  );
  const total = gaps.reduce((sum, gap) => sum + gap, 0);
  if (total <= 0 || Math.abs(total - span) < 1e-9) return [...positions];

  const scale = span / total;
  const stacked = [first];
  for (const gap of gaps) {
    stacked.push(stacked[stacked.length - 1] + gap * scale);
  }
  return stacked.map(clampPercent);
}

function nextMilestone(items: readonly AudienceTimelineItemDto[]): AudienceTimelineItemDto | null {
  return items.find((item) => item.state === "now")
    ?? items.find((item) => item.state === "next")
    ?? items.find((item) => item.state === "later")
    ?? null;
}

export function buildTimelineArtifactModel(dto: AudienceTimelineDto): TimelineArtifactModel {
  const allItems = flattenTimeline(dto);
  const cancelled = allItems.filter((item) => item.state === "cancelled");
  const activeItems = allItems.filter((item) => item.state !== "cancelled");
  const completedCount = activeItems.filter((item) => item.state === "covered").length;
  const totalCount = activeItems.length;
  const percent = totalCount === 0 ? 0 : Math.round((completedCount / totalCount) * 100);
  const next = nextMilestone(activeItems);
  const axis = resolveTimelineAxis(dto);
  const schedule = railPositions(activeItems, dto.today, axis);
  const todayDay = calendarDay(dto.today);

  const stackPositions = capStackGaps(schedule.pointPositions);
  const stackAnchors = schedule.pointPositions.map((position, index) => ({
    raw: position,
    adjusted: stackPositions[index],
  }));
  const mapStack = (position: number): number =>
    mapThroughPointDistortion(position, stackAnchors, 0);
  const todayStackPosition = schedule.todayPosition === null
    ? null
    : mapStack(schedule.todayPosition);
  const monthTicks: TimelineMonthTick[] = schedule.monthTicks.map((tick) => ({
    position: tick.position,
    stackPosition: mapStack(tick.position),
    label: tick.label,
  }));

  const points = activeItems.map((item, index): TimelineArtifactPoint => {
    const itemDay = calendarDay(item.date);
    const isNext = item.publicId === next?.publicId;
    const isOverdue = isNext
      && itemDay !== null
      && todayDay !== null
      && itemDay < todayDay;
    return {
      item,
      position: schedule.pointPositions[index] ?? 50,
      stackPosition: stackPositions[index] ?? 50,
      isNext,
      state: item.state === "covered"
        ? "complete"
        : isOverdue
          ? "overdue"
          : isNext
            ? "current"
            : "upcoming",
    };
  });
  const defaultPoint = points.find((point) => point.isNext) ?? points.at(-1) ?? null;
  const completedPoints = points.filter((point) => point.state === "complete");
  const completedFrontier = completedPoints.length
    ? Math.max(...completedPoints.map((point) => point.position))
    : null;
  const completedStackFrontier = completedPoints.length
    ? Math.max(...completedPoints.map((point) => point.stackPosition))
    : null;

  return {
    density: artifactDensity(totalCount),
    axis,
    points,
    cancelled,
    completedCount,
    totalCount,
    remainingCount: Math.max(0, totalCount - completedCount),
    percent,
    todayPosition: schedule.todayPosition,
    todayStackPosition,
    monthTicks,
    completedFrontier,
    completedStackFrontier,
    nextMilestoneId: next?.publicId ?? null,
    defaultSelectedId: defaultPoint?.item.publicId ?? null,
  };
}

/**
 * What the artifact draws for this plan.
 *
 * `sequence-card` is the answer to the halfway-placement defect's worst case:
 * one milestone, no usable timing. A single dot on a long rail has to sit
 * somewhere, and wherever it sits is a claim about time. So that plan does not
 * get a rail — it gets a compact state that says where the milestone sits in
 * the sequence and nothing more.
 */
export function timelinePresentation(
  model: TimelineArtifactModel,
): TimelineArtifactPresentation {
  if (model.points.length === 0) return "empty";
  if (model.axis.mode === "dated") return "calendar-rail";
  return model.points.length === 1 ? "sequence-card" : "sequence-rail";
}

/**
 * The two labels under the rail's ends.
 *
 * Dated: real dates, because the ends are real days. The finish cap yields
 * when the last milestone already states that date in its own label — the
 * same "don't stack the same fact in one corner" rule the cap has always had.
 *
 * Ordered: sequence words only. "Start" and "Finish" are the vocabulary of a
 * time axis and must not appear where distance means order, or the caps
 * reintroduce exactly the claim the ordered mode exists to refuse.
 */
export function timelineRailCaps(model: TimelineArtifactModel): TimelineRailCaps {
  const presentation = timelinePresentation(model);
  if (presentation === "empty" || presentation === "sequence-card") {
    return { start: null, finish: null };
  }
  if (model.axis.mode !== "dated") {
    return { start: "Milestone 1", finish: `Milestone ${model.points.length}` };
  }
  return {
    start: formatTimelineDate(model.axis.startDate),
    finish: model.points.at(-1)?.item.date === model.axis.endDate
      ? null
      : formatTimelineDate(model.axis.endDate),
  };
}

/**
 * The one visible line that tells a viewer what the spacing means, shown only
 * where it could otherwise be misread. A dated rail declares itself already —
 * it carries month names and a Today marker. An ordered rail looks exactly
 * like a time axis and is not one, so it says so in plain words.
 */
export function timelineAxisNote(model: TimelineArtifactModel): string | null {
  if (timelinePresentation(model) !== "sequence-rail") return null;
  const dated = model.points.filter((point) => Boolean(point.item.date)).length;
  return dated === 0
    ? "These milestones are in order, not spaced by date. No dates are set yet."
    : "These milestones are in order, not spaced by date. Some do not have a date yet.";
}

/**
 * Indices that may carry a persistent label beyond the mandatory set (the
 * next milestone, the completed point before it, the final point). Greedy
 * left-to-right: a point earns its label when every labelled neighbour on
 * the SAME side of the rail (sides alternate by index) is at least `minGap`
 * rail-percent away — the same collision thinking the point positions use,
 * applied to their titles. Wide rails label everything that fits instead of
 * defaulting to three titles and six anonymous dots; the CSS gates these to
 * containers wide enough for the label boxes.
 */
export function extraLabelIndices(
  positions: readonly number[],
  mandatory: ReadonlySet<number>,
  labelWidth = 16,
): Set<number> {
  // Labels are centred on their point except at the rail's edges, where the
  // CSS anchors them inward (start label grows right, end label grows left).
  // Compare occupied INTERVALS, not centre distances, or the end-anchored
  // label collides with its inboard neighbour on mid-width rails.
  const interval = (index: number): [number, number] => {
    const position = positions[index];
    if (index === 0) return [position, position + labelWidth];
    if (index === positions.length - 1) return [position - labelWidth, position];
    return [position - labelWidth / 2, position + labelWidth / 2];
  };
  const granted = new Set(mandatory);
  for (let index = 0; index < positions.length; index += 1) {
    if (granted.has(index)) continue;
    const [start, end] = interval(index);
    let fits = true;
    for (const other of granted) {
      if ((other - index) % 2 !== 0) continue;
      const [otherStart, otherEnd] = interval(other);
      if (start < otherEnd && otherStart < end) {
        fits = false;
        break;
      }
    }
    if (fits) granted.add(index);
  }
  for (const index of mandatory) granted.delete(index);
  return granted;
}

export function buildTimelineCountdown(
  targetDate: string | null | undefined,
  today: string | null | undefined,
): TimelineCountdown | null {
  const targetDay = calendarDay(targetDate);
  const todayDay = calendarDay(today);
  if (targetDay === null || todayDay === null) return null;

  const difference = Math.round((targetDay - todayDay) / DAY_MS);
  if (difference > 0) return { kind: "future", days: difference };
  if (difference < 0) return { kind: "past", days: Math.abs(difference) };
  return { kind: "today" };
}

const SHORT_DATE_FORMATTER = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

const LONG_DATE_FORMATTER = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

export function formatTimelineDate(value: string, style: "short" | "long" = "short"): string {
  const day = calendarDay(value);
  if (day === null) return value;
  return (style === "long" ? LONG_DATE_FORMATTER : SHORT_DATE_FORMATTER).format(new Date(day));
}

export type MetricValueScale = "base" | "three" | "four" | "word";

/**
 * The metric face must fit its column by construction, not by hoping the
 * value stays short. Tabular numerals make digit width deterministic, so the
 * face declares its width class and the CSS sizes each class to fit: one or
 * two digits ride the display size, longer counts step down, and word values
 * ("Today") take a size measured to clear the column on the day it matters.
 */
export function metricValueScale(value: string): MetricValueScale {
  if (!/^\d+$/.test(value)) return "word";
  if (value.length >= 4) return "four";
  if (value.length === 3) return "three";
  return "base";
}

export function timelinePointStatus(point: TimelineArtifactPoint): string {
  if (point.state === "complete") return "Complete";
  if (point.state === "overdue") return "Our next milestone, overdue";
  if (point.state === "current") return "Our next milestone";
  if (point.item.state === "now") return "Coming up";
  if (point.item.state === "next") return "Next";
  return "Later";
}
