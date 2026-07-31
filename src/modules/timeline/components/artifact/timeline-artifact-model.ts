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

export type TimelineArtifactModel = Readonly<{
  density: TimelineArtifactDensity;
  points: readonly TimelineArtifactPoint[];
  cancelled: readonly AudienceTimelineItemDto[];
  completedCount: number;
  totalCount: number;
  remainingCount: number;
  percent: number;
  todayPosition: number | null;
  todayStackPosition: number | null;
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

function interpolateUndatedPositions(positions: Array<number | null>): number[] {
  const resolved = [...positions];
  let index = 0;

  while (index < resolved.length) {
    if (resolved[index] !== null) {
      index += 1;
      continue;
    }

    const start = index;
    while (index < resolved.length && resolved[index] === null) index += 1;
    const end = index;
    const lower = start > 0 ? (resolved[start - 1] ?? 0) : 0;
    const upper = end < resolved.length ? (resolved[end] ?? 100) : 100;
    const count = end - start;

    for (let offset = 0; offset < count; offset += 1) {
      resolved[start + offset] = lower + ((upper - lower) * (offset + 1)) / (count + 1);
    }
  }

  return resolved.map((position) => clampPercent(position ?? 0));
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

function ordinalPositions(count: number): number[] {
  if (count === 0) return [];
  if (count === 1) return [50];
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

function calendarPositions(
  items: readonly AudienceTimelineItemDto[],
  today: string,
  primaryDate: string | undefined,
): { pointPositions: number[]; todayPosition: number | null } {
  const todayDay = calendarDay(today);
  const primaryDay = calendarDay(primaryDate);
  const itemDays = items.map((item) => calendarDay(item.date));
  const datedItemDays = itemDays.filter((day): day is number => day !== null);
  if (datedItemDays.length === 0) {
    return { pointPositions: ordinalPositions(items.length), todayPosition: null };
  }

  const axisDays = [
    ...datedItemDays,
    ...(todayDay === null ? [] : [todayDay]),
    ...(primaryDay === null ? [] : [primaryDay]),
  ];
  const distinctAxisDays = new Set(axisDays);

  if (distinctAxisDays.size < 2) {
    return { pointPositions: ordinalPositions(items.length), todayPosition: null };
  }

  const axisStart = Math.min(...axisDays);
  const axisEnd = Math.max(...axisDays);
  if (axisEnd <= axisStart) {
    return { pointPositions: ordinalPositions(items.length), todayPosition: null };
  }

  const rawPointPositions = interpolateUndatedPositions(
    itemDays.map((day) => day === null
      ? null
      : ((day - axisStart) / (axisEnd - axisStart)) * 100),
  );
  const safePointPositions = collisionSafePositions(rawPointPositions);
  const edge = Math.min(6, Math.max(3, 36 / rawPointPositions.length));
  const datedAnchors = itemDays.flatMap((day, index) =>
    day === null
      ? []
      : [{
          raw: ((day - axisStart) / (axisEnd - axisStart)) * 100,
          adjusted: safePointPositions[index],
        }],
  );
  const todayPosition = todayDay === null
    ? null
    : mapThroughPointDistortion(
        ((todayDay - axisStart) / (axisEnd - axisStart)) * 100,
        datedAnchors,
        edge,
      );

  return { pointPositions: safePointPositions, todayPosition };
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
  const schedule = calendarPositions(activeItems, dto.today, dto.primaryDate?.date);
  const todayDay = calendarDay(dto.today);

  const stackPositions = capStackGaps(schedule.pointPositions);
  const stackAnchors = schedule.pointPositions.map((position, index) => ({
    raw: position,
    adjusted: stackPositions[index],
  }));
  const todayStackPosition = schedule.todayPosition === null
    ? null
    : mapThroughPointDistortion(schedule.todayPosition, stackAnchors, 0);

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
    points,
    cancelled,
    completedCount,
    totalCount,
    remainingCount: Math.max(0, totalCount - completedCount),
    percent,
    todayPosition: schedule.todayPosition,
    todayStackPosition,
    completedFrontier,
    completedStackFrontier,
    nextMilestoneId: next?.publicId ?? null,
    defaultSelectedId: defaultPoint?.item.publicId ?? null,
  };
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
