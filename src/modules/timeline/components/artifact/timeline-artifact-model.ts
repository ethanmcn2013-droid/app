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

export type TimelineArtifactPoint = Readonly<{
  item: AudienceTimelineItemDto;
  position: number;
  state: TimelineArtifactPointState;
  isNext: boolean;
}>;

export type TimelineArtifactModel = Readonly<{
  points: readonly TimelineArtifactPoint[];
  cancelled: readonly AudienceTimelineItemDto[];
  completedCount: number;
  totalCount: number;
  remainingCount: number;
  percent: number;
  todayPosition: number | null;
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

function calendarPositions(
  items: readonly AudienceTimelineItemDto[],
  today: string,
  primaryDate: string | undefined,
): { pointPositions: number[]; todayPosition: number | null } {
  const todayDay = calendarDay(today);
  const primaryDay = calendarDay(primaryDate);
  const itemDays = items.map((item) => calendarDay(item.date));
  const datedItemDays = itemDays.filter((day): day is number => day !== null);
  const axisDays = [
    ...datedItemDays,
    ...(todayDay === null ? [] : [todayDay]),
    ...(primaryDay === null ? [] : [primaryDay]),
  ];

  if (axisDays.length < 2) {
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
  const todayPosition = todayDay === null
    ? null
    : clampPercent(4 + (((todayDay - axisStart) / (axisEnd - axisStart)) * 92));

  return { pointPositions: safePointPositions, todayPosition };
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

  return {
    points,
    cancelled,
    completedCount,
    totalCount,
    remainingCount: Math.max(0, totalCount - completedCount),
    percent,
    todayPosition: schedule.todayPosition,
    nextMilestoneId: next?.publicId ?? null,
    defaultSelectedId: defaultPoint?.item.publicId ?? null,
  };
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

export function timelinePointStatus(point: TimelineArtifactPoint): string {
  if (point.state === "complete") return "Complete";
  if (point.state === "overdue") return "Our next milestone, overdue";
  if (point.state === "current") return "Our next milestone";
  if (point.item.state === "now") return "Coming up";
  if (point.item.state === "next") return "Next";
  return "Later";
}
