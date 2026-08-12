import type {
  AudienceItemState,
  AudienceTimelineDto,
  AudienceTimelineItemDto,
} from "@/modules/timeline/lib/audience-timeline";
import {
  MILESTONE_RAIL_LABELS,
  MILESTONE_STATE_LABELS,
} from "@/modules/timeline/lib/vocabulary";

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
  | "no-range"
  /**
   * Every plotted milestone is dated and the span is real, but two of them
   * fall so close together that proportional spacing would draw one mark on
   * top of another. The rail states the sequence instead of distorting the
   * scale to pull them apart.
   */
  | "too-crowded";

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
  /** Rail-percent on the horizontal axis, from the same proportional
      mapping the points use — the cartography cannot disagree with the
      dots it annotates. */
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

/**
 * Physical facts about the rail, needed here because legibility is a question
 * about pixels and the model answers in rail-percent.
 *
 * `RAIL_PITCH_PX` mirrors `--x-timeline-pitch` (5.25rem) and `RAIL_FLOOR_PX`
 * the container width below which the rail stops being horizontal at all and
 * stacks (620px, the artifact's own container breakpoint). Between them they
 * give the narrowest a horizontal rail can ever be for a given count.
 * `MARK_DIAMETER_PX` is the largest mark drawn on it (0.88rem, the current and
 * overdue states). Two marks closer than one diameter are one blot.
 */
const RAIL_PITCH_PX = 84;
const RAIL_FLOOR_PX = 620;
const MARK_DIAMETER_PX = 14;
/**
 * The month tick's own two footprints, in px: its 1px hairline, and the box a
 * three-letter month name occupies at the caption step (~34px, plus the paper
 * padding either side of it). Both are measured against the same narrowest
 * rail as `legibleGap`, so a tick's right to be drawn is decided in the same
 * physical terms as a mark's right to be told apart from its neighbour.
 */
const TICK_STROKE_PX = 1;
const TICK_NAME_PX = 40;

/**
 * How far the first and last marks sit in from the rail's ends, in
 * rail-percent. A mark drawn at 0 is a half-circle clipped by the stage, and
 * its label has nothing to grow into.
 *
 * This is the ONLY adjustment a dated position receives, and it is affine —
 * every position is scaled and shifted by the same two numbers — so the ratio
 * between any two calendar distances survives it exactly. Ordered rails take
 * the same inset for the same reason, which is what stops their end marks
 * being drawn as half-circles.
 */
function railEdge(count: number): number {
  return Math.min(6, Math.max(3, 36 / Math.max(1, count)));
}

/**
 * The rail-percent below which two marks cannot be told apart, derived rather
 * than guessed: one mark diameter measured against the narrowest this rail can
 * ever be for this many milestones.
 */
function legibleGap(count: number): number {
  return (MARK_DIAMETER_PX / narrowestRail(count)) * 100;
}

/** The narrowest a horizontal rail can be for this many milestones, in px. */
function narrowestRail(count: number): number {
  return Math.max(RAIL_FLOOR_PX, count * RAIL_PITCH_PX);
}

/**
 * How close, in rail-percent, a month tick's hairline may come to a milestone
 * mark before the two are drawn on top of each other.
 *
 * The atlas and the marks share one line and one mapping, which is the point
 * of the cartography — but it also means a milestone that falls on the first
 * of the month has its dot painted straight through the tick that names that
 * month. Decoration never outranks information (the module's own rule for the
 * Today chip), so the tick yields. Derived, not chosen: half a mark plus half
 * a hairline, over the narrowest this rail can ever be for this many points.
 */
export function markCollisionGap(count: number): number {
  return ((MARK_DIAMETER_PX / 2 + TICK_STROKE_PX / 2) / narrowestRail(count)) * 100;
}

/**
 * The same question for the tick's NAME, which is forty times wider than its
 * hairline. A month name landing under a mark collides with that mark's own
 * status line and date, so it stands down well before the hairline has to.
 */
export function markLabelGap(count: number): number {
  return ((MARK_DIAMETER_PX / 2 + TICK_NAME_PX / 2) / narrowestRail(count)) * 100;
}

/** Raw 0-100 positions mapped into the rail's drawable span. Affine only. */
function insetPositions(rawPositions: readonly number[]): number[] {
  const edge = railEdge(rawPositions.length);
  const available = 100 - edge * 2;
  return rawPositions.map((position) => clampPercent(edge + (position / 100) * available));
}

/**
 * Positions that mean sequence, never time. Evenly spaced, because order is
 * the only fact being drawn, and inset from the rail's ends like the dated
 * ones — an ordered rail used to draw its first and last milestones at 0 and
 * 100, where the stage clips them into half-circles.
 *
 * A lone milestone sits at the start of its own sequence rather than at the
 * centre of the rail. Dead centre of a time axis is a claim — "roughly
 * halfway through the plan" — that undated content cannot support, and it was
 * the halfway-placement defect. The view renders a single ordered milestone
 * as a compact sequence state rather than as a rail at all.
 */
function sequencePositions(count: number): number[] {
  if (count === 0) return [];
  if (count === 1) return insetPositions([0]);
  return insetPositions(
    Array.from({ length: count }, (_, index) => (index / (count - 1)) * 100),
  );
}

function artifactDensity(count: number): TimelineArtifactDensity {
  if (count === 0) return "empty";
  if (count === 1) return "single";
  if (count <= 3) return "sparse";
  return "standard";
}

/**
 * Map a position through a remap the points have already taken.
 *
 * The horizontal rail no longer needs this: its points are proportional, so
 * the Today dash and the month ticks are read off the same straight line the
 * marks are. The STACKED axis still does, because `capStackGaps` deliberately
 * shortens long quiet stretches there, and anything else drawn on that axis
 * must ride the identical remap or it would sit between the wrong two
 * milestones. Piecewise-linear between each point's (raw, adjusted) pair,
 * with the rail's own ends as anchors.
 */
function mapThroughAnchors(
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

/**
 * The artifact's one short-month vocabulary, fixed at three letters.
 *
 * `Intl.DateTimeFormat("en-GB", { month: "short" })` returns "Sept" for
 * September and three letters for the other eleven, so the rail's atlas read
 * `Jul · Aug · Sept · Oct` — one month a letter wider than its neighbours in a
 * row whose whole job is even rhythm, and the same string turning up as
 * "3 Sept 2026" in the milestone labels directly beneath it. A repo QA script
 * already had to `replace("Sept", "Sep")` before it could parse those dates,
 * which is the tell that the locale's answer was never the intended one here.
 *
 * Fixed rather than formatted, because this is a typographic decision about a
 * fixed-width row, not a localisation one: every tick is three letters, the
 * milestone dates under them are the same three letters, and the axis and its
 * labels can no longer disagree about the name of a month.
 */
const SHORT_MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
] as const;

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
        : SHORT_MONTHS[month],
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
 *
 * 3. **Proportional spacing has to be readable.** Distance on a dated rail is
 *    calendar distance and nothing may move a mark off its day, so a plan
 *    whose milestones fall closer together than one mark's diameter cannot be
 *    drawn on a calendar at all — two dots would occupy the same spot. Such a
 *    plan states its sequence instead. The alternative, and the defect this
 *    replaces, was to shove the marks apart until the labels fitted, which
 *    made rail distance mean neither time nor order.
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
  const axisStart = todayDay === null ? planStart : Math.min(planStart, todayDay);
  const axisEnd = todayDay === null ? planEnd : Math.max(planEnd, todayDay);

  const ordered = [...milestoneDays].sort((left, right) => left - right);
  const available = 100 - railEdge(ordered.length) * 2;
  const floor = legibleGap(ordered.length);
  for (let index = 1; index < ordered.length; index += 1) {
    const gap = ((ordered[index] - ordered[index - 1]) / (axisEnd - axisStart)) * available;
    if (gap < floor) return { mode: "ordered", reason: "too-crowded" };
  }

  return {
    mode: "dated",
    startDate: isoDay(axisStart),
    endDate: isoDay(axisEnd),
  };
}

/**
 * Rail positions for the plotted milestones, plus everything else that rides
 * the same axis. Ordered mode returns sequence positions and no calendar
 * furniture at all: no Today marker, no month ticks. There is no path here
 * that derives a position for an undated milestone.
 *
 * In dated mode there is exactly ONE mapping from a day to a rail position,
 * and it is a straight line: the marks, the Today dash and the month ticks all
 * take it. That is what makes the spacing readable as calendar distance. It
 * used to be two mappings — the marks were pushed apart until their labels
 * stopped colliding, and everything else was then bent through that same
 * distortion to stay consistent with them — which left a nine-milestone plan
 * drawing its last nine weeks across half the rail and its first four months
 * across a third of it, a scale error of fifteen to one, with the Today dash
 * thirty points of the rail away from today.
 *
 * Labels collide on a proportional rail; that is a labelling problem and it is
 * solved where labels are chosen and placed (`extraLabelIndices` and
 * `labelShifts`), never by moving a mark off its day.
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

  const edge = railEdge(items.length);
  const available = 100 - edge * 2;
  const railPercent = (day: number): number =>
    clampPercent(edge + ((day - axisStart) / (axisEnd - axisStart)) * available);

  const todayDay = calendarDay(today);
  return {
    pointPositions: itemDays.map(railPercent),
    todayPosition: todayDay === null ? null : railPercent(todayDay),
    monthTicks: monthBoundaries(axisStart, axisEnd).map(({ day, label }) => ({
      position: railPercent(day),
      label,
    })),
  };
}

/**
 * The stacked (vertical) rail's own height, in px, as the stylesheet computes
 * it below 620px: `count x 6.5rem` with a `42rem` floor, and a shorter
 * dedicated figure for the two- and three-milestone tiers. Duplicated here
 * because the minimum readable gap below is a question about pixels and this
 * function answers in percent; if those rules move, this moves with them.
 */
const STACK_PITCH_PX = 104;
const STACK_FLOOR_PX = 672;
const STACK_SPARSE_PAD_PX = 112;
/** One stacked label: a status line, a title and a date. The same 4.5rem the
 *  stylesheet budgets in `--x-timeline-label-block`. */
const STACK_LABEL_PX = 72;

function stackHeight(count: number): number {
  if (count <= 3) return count * STACK_PITCH_PX + STACK_SPARSE_PAD_PX;
  return Math.max(STACK_FLOOR_PX, count * STACK_PITCH_PX);
}

/** The smallest stacked gap that still fits a label, in rail-percent. */
export function stackMinimumGap(count: number): number {
  if (count < 2) return 0;
  return (STACK_LABEL_PX / stackHeight(count)) * 100;
}

/**
 * Reshape the stacked (vertical) axis so it can be read.
 *
 * Horizontal whitespace reads as time; vertical whitespace reads as a broken
 * page, and vertical crowding reads as two milestones printed on top of each
 * other. So this axis, and ONLY this axis, is allowed to depart from strict
 * proportion — a decision that predates the proportionality repair and is kept
 * deliberately. The horizontal rail is untouched by any of it.
 *
 * Two bounds, applied in order and then solved exactly onto the original span:
 *
 * - `capRatio` x the mean gap is the most a quiet stretch may occupy, so a
 *   phone never spends a screen on one empty season.
 * - `minGap` is the least any gap may occupy, because below it two labels
 *   overlap. This is new, and it is the cost of drawing marks at their real
 *   dates: once the marks stopped being spread out to make room, a cluster of
 *   five milestones inside four weeks stacked into a single illegible block on
 *   a phone. Every gap gets its floor first, and the room left over is shared
 *   between the gaps that had more than the floor to begin with, in proportion
 *   to how much more — so the long stretches still read as long, the tight
 *   ones are still the tight ones, and nothing lands on top of anything.
 *
 * Order and both endpoints survive exactly. Returns the input unchanged when
 * neither bound binds.
 */
export function capStackGaps(
  positions: readonly number[],
  capRatio = 1.9,
  minGap = 0,
): number[] {
  if (positions.length < 3) return [...positions];
  const first = positions[0];
  const last = positions[positions.length - 1];
  const span = last - first;
  if (span <= 0) return [...positions];

  const count = positions.length - 1;
  const mean = span / count;
  const cap = mean * capRatio;
  // A floor that cannot fit is not a floor. When even the minimum would
  // overflow the span the axis has more milestones than it has room for, and
  // even spacing is the least dishonest thing left.
  const floor = Math.min(minGap, span / count);
  const gaps = positions.slice(1).map((position, index) =>
    Math.max(floor, Math.min(position - positions[index], cap)),
  );
  const total = gaps.reduce((sum, gap) => sum + gap, 0);
  if (total <= 0 || Math.abs(total - span) < 1e-9) return [...positions];

  const slack = gaps.map((gap) => gap - floor);
  const slackTotal = slack.reduce((sum, value) => sum + value, 0);
  const slackTarget = span - floor * count;
  const scale = slackTotal > 0 ? slackTarget / slackTotal : 0;
  const stacked = [first];
  gaps.forEach((_, index) => {
    const share = slackTotal > 0 ? slack[index] * scale : slackTarget / count;
    stacked.push(stacked[stacked.length - 1] + floor + share);
  });
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
  const flattened = allItems.filter((item) => item.state !== "cancelled");
  const completedCount = flattened.filter((item) => item.state === "covered").length;
  const totalCount = flattened.length;
  const percent = totalCount === 0 ? 0 : Math.round((completedCount / totalCount) * 100);
  // Read off the state-ordered list, before the calendar has any say, so which
  // milestone is "next" cannot change with the rail's mode.
  const next = nextMilestone(flattened);
  const axis = resolveTimelineAxis(dto);
  // On a calendar rail, index order IS calendar order. `flattenTimeline` sorts
  // by state first, so a milestone completed ahead of schedule used to be
  // listed before dots that are drawn to its left. That was invisible only
  // because the old spacing forced positions to increase with the index; with
  // real dates the list has to agree with the drawing, or "milestone 3 of 9"
  // names the fifth mark along.
  const activeItems = axis.mode === "dated"
    ? [...flattened].sort((left, right) => (left.date ?? "").localeCompare(right.date ?? ""))
    : flattened;
  const schedule = railPositions(activeItems, dto.today, axis);
  const todayDay = calendarDay(dto.today);

  const stackPositions = capStackGaps(
    schedule.pointPositions,
    undefined,
    stackMinimumGap(schedule.pointPositions.length),
  );
  const stackAnchors = schedule.pointPositions.map((position, index) => ({
    raw: position,
    adjusted: stackPositions[index],
  }));
  const mapStack = (position: number): number =>
    mapThroughAnchors(position, stackAnchors, 0);
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
  if (model.axis.mode === "ordered" && model.axis.reason === "too-crowded") {
    // Every one of these milestones has a date, so "some do not have a date
    // yet" would be a plain untruth here. The reason this rail shows order is
    // that the dates sit too close together to draw apart.
    return "These milestones are in order, not spaced by date. Some of them fall too close together to space apart on a calendar.";
  }
  const dated = model.points.filter((point) => Boolean(point.item.date)).length;
  return dated === 0
    ? "These milestones are in order, not spaced by date. No dates are set yet."
    : "These milestones are in order, not spaced by date. Some do not have a date yet.";
}

/**
 * What the rail's spacing means, in one sentence, for anyone who cannot see
 * it. The month ticks and the Today dash are decoration to a screen reader —
 * they are `aria-hidden`, correctly, because reading nine month names aloud is
 * noise — so without this the axis was invisible to low vision and absent from
 * assistive technology at the same time: the span the rail covers was stated
 * nowhere at all.
 */
export function timelineAxisDescription(model: TimelineArtifactModel): string {
  if (model.axis.mode === "dated") {
    return `This timeline runs from ${formatTimelineDate(model.axis.startDate, "long")} to ${formatTimelineDate(model.axis.endDate, "long")}. Distance along it is calendar distance.`;
  }
  return `These ${model.points.length} milestones are shown in the order they happen. Distance along the timeline means sequence, not time.`;
}

/**
 * Where each visible label sits relative to its own mark, in rail-percent.
 *
 * A dated mark may not move: its position IS its date. Its label may, and this
 * is the whole of the collision policy that used to be run on the marks
 * themselves. Labels alternate sides by index, so each side is resolved on its
 * own: walk the visible labels left to right and push any that would overlap
 * its predecessor far enough right to clear it, then, if the run has spilled
 * past the rail, walk back leftward from the end. Both passes are the same
 * spacing algorithm the marks used to suffer — applied to the thing that is
 * allowed to move.
 *
 * `labelWidth` is one label box as a share of the rail; the view measures it,
 * because it depends on the rail's rendered width. Shifts are capped at one
 * label width so a label can never travel far enough to read as belonging to a
 * different mark, and the view draws a connector on any label that moved.
 */
export function labelShifts(
  positions: readonly number[],
  visible: ReadonlySet<number>,
  labelWidth: number,
): Map<number, number> {
  const shifts = new Map<number, number>();
  if (labelWidth <= 0 || positions.length < 2) return shifts;
  const last = positions.length - 1;
  // The two end labels are anchored to the rail's ends by the CSS (the first
  // grows rightward, the last leftward) and are not moved. They still occupy
  // room, so they enter the pass as fixed obstacles at the centre of the box
  // they actually cover.
  const centre = (index: number): number => {
    if (index === 0) return positions[index] + labelWidth / 2;
    if (index === last) return positions[index] - labelWidth / 2;
    return positions[index];
  };

  for (const side of [0, 1]) {
    const indices = [...visible]
      .filter((index) => index % 2 === side && positions[index] !== undefined)
      .sort((left, right) => positions[left] - positions[right]);
    if (indices.length < 2) continue;

    const pinned = indices.map((index) => index === 0 || index === last);
    const placed = indices.map(centre);
    for (let step = 1; step < placed.length; step += 1) {
      if (pinned[step]) continue;
      placed[step] = Math.max(placed[step], placed[step - 1] + labelWidth);
    }
    for (let step = placed.length - 2; step >= 0; step -= 1) {
      if (pinned[step]) continue;
      placed[step] = Math.min(placed[step], placed[step + 1] - labelWidth);
    }

    indices.forEach((index, step) => {
      if (pinned[step]) return;
      // Bounded at half a label: past that the title stops reading as this
      // mark's title, and an unplaceable label is better dropped by
      // `extraLabelIndices` than dragged across the rail.
      const limit = labelWidth / 2;
      const shift = Math.max(-limit, Math.min(limit, placed[step] - centre(index)));
      if (Math.abs(shift) >= 0.25) shifts.set(index, shift);
    });
  }

  return shifts;
}

/**
 * Indices that may carry a persistent label beyond the mandatory set (the
 * next milestone, the completed point before it, the final point). Greedy
 * left-to-right: a point earns its label when every labelled neighbour on
 * the SAME side of the rail (sides alternate by index) is at least `minGap`
 * rail-percent away — the same collision thinking the point positions use,
 * applied to their titles. Wide rails label everything that fits instead of
 * defaulting to three titles and six anonymous dots.
 *
 * `labelWidth` is how much of the rail one label box occupies, in rail-percent.
 * The caller measures it (see the geometry effect in timeline-artifact.tsx),
 * because it cannot be known from the positions alone: the rail is a scroll
 * canvas at least `count x --x-timeline-pitch` wide, so a label's share of it
 * falls as the plan grows and rises as the viewport does. The default below is
 * a conservative guess for the first render and for callers with no layout —
 * a rendered rail should always pass the measured value.
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

export type TimelineLabelCluster = Readonly<{
  /** The consecutive rail indices this caption speaks for. */
  indices: readonly number[];
  /** Rail-percent of the run's first and last mark, on each axis. */
  start: number;
  end: number;
  startStack: number;
  endStack: number;
  /** What the run is called. A count, never one title standing in for four. */
  label: string;
}>;

/**
 * The other half of the density rule.
 *
 * `extraLabelIndices` decides who gets a title when there is room for one. In a
 * genuinely crowded span there is no room for any, and the rail's answer used
 * to be silence: five dots inside four weeks, no titles, nothing saying they
 * were milestones at all — a sighted viewer could hover them one at a time and
 * a low-vision one had to probe each dot to find out what it was.
 *
 * So a run of adjacent unlabelled marks gets ONE caption between them, naming
 * how many are in the run. It is a count and not a borrowed title on purpose:
 * no single milestone in a cluster speaks for the others, and picking one to
 * print would be the same error as picking one date to draw them all at.
 *
 * Runs of one are not clustered — a lone unlabelled dot between two labelled
 * ones is already located by its neighbours, and a caption reading
 * "1 milestone" beside a dot is noise.
 *
 * Pure and index-based, so it can be checked without a rail: `labelled` is the
 * persistent set the view actually draws (mandatory titles plus the extras the
 * measured collision pass granted), never the transient hover/selection state.
 */
export function labelClusters(
  points: readonly TimelineArtifactPoint[],
  labelled: ReadonlySet<number>,
): TimelineLabelCluster[] {
  const clusters: TimelineLabelCluster[] = [];
  let run: number[] = [];

  const close = () => {
    if (run.length >= 2) {
      const first = run[0];
      const last = run[run.length - 1];
      clusters.push({
        indices: [...run],
        start: points[first].position,
        end: points[last].position,
        startStack: points[first].stackPosition,
        endStack: points[last].stackPosition,
        label: `${run.length} milestones`,
      });
    }
    run = [];
  };

  points.forEach((_point, index) => {
    if (labelled.has(index)) close();
    else run.push(index);
  });
  close();

  return clusters;
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

const LONG_DATE_FORMATTER = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

/**
 * A date in the artifact's own voice. The short form is composed from
 * `SHORT_MONTHS` rather than from the locale, so "3 Sep 2026" under the rail
 * uses the same three letters the "Sep" tick above it does. The long form —
 * "3 September 2026", the reading-panel and screen-reader register — keeps the
 * locale's full month name, which has no such ambiguity.
 */
export function formatTimelineDate(value: string, style: "short" | "long" = "short"): string {
  const day = calendarDay(value);
  if (day === null) return value;
  const date = new Date(day);
  if (style === "long") return LONG_DATE_FORMATTER.format(date);
  return `${date.getUTCDate()} ${SHORT_MONTHS[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
}

export type MetricValueScale = "base" | "three" | "four" | "word" | "count";

/**
 * The metric face must fit its column by construction, not by hoping the
 * value stays short. Tabular numerals make digit width deterministic, so the
 * face declares its width class and the CSS sizes each class to fit: one or
 * two digits ride the display size, longer counts step down, and word values
 * ("Today") take a size measured to clear the column on the day it matters.
 *
 * `count` is not derived here: it belongs to the progress face, whose value is
 * a whole sentence ("3 of 8 complete") rather than a number with a unit, and
 * which therefore reads at sentence scale and is allowed to wrap.
 */
export function metricValueScale(value: string): MetricValueScale {
  if (!/^\d+$/.test(value)) return "word";
  if (value.length >= 4) return "four";
  if (value.length === 3) return "three";
  return "base";
}

export type TimelineTitleLength = "short" | "long" | "epic";

/**
 * How much room the project's own name needs.
 *
 * The artifact's display register is set once in `--x-artifact-display`, and
 * that size is right for a name a person can say in one breath — "Glenmara
 * House". A name three times that long at the same size is not bolder, it is
 * four lines of headline pushing the plan off the screen, and the exhibition
 * tokens' own comment forbids inventing a parallel clamp to escape it.
 *
 * So the length picks between the sizes that already exist:
 * `--x-artifact-display` for a name that fits the display measure, and the
 * compact step for one that does not. The threshold is the display measure
 * itself — 16ch — with one line of tolerance, because a name that wraps once
 * is still a headline and a name that wraps three times is a paragraph.
 *
 * Two steps were not enough. A committee that writes its full legal name into
 * the field — "The Ballyneety and District Community Hall Renovation, Roof
 * Repair and Accessibility Upgrade Committee", 101 characters — still took
 * four lines of headline at 1920 and eleven on a phone, where it stood 695px
 * tall and left nothing of the plan on screen. Past three lines of the compact
 * measure (22ch, so 64 characters) the name has stopped being display type
 * whatever size it is set at, and it takes the ramp's own title step instead.
 * Still nothing truncated: every character the owner typed is on the page.
 */
export function artifactTitleLength(label: string): TimelineTitleLength {
  const length = label.trim().length;
  if (length > 64) return "epic";
  return length > 32 ? "long" : "short";
}

/**
 * What a mark's status line says. Two of these are derived — the milestone a
 * plan is standing on, and the same one running late — and both take the
 * rail's own words, "Our next milestone". The rest are the milestone's own
 * stored state, so a milestone somebody flagged `next` reads "Coming up".
 *
 * Those two were one word until recently, and a mark could be flagged "Next"
 * three flags away from the one the rail announced as next. Every label here
 * comes from the module's one vocabulary, which is what keeps them apart now:
 * the milestone the rail derives and the milestone the owner flagged are
 * usually not the same milestone, and they no longer answer to the same name.
 */
export function timelinePointStatus(point: TimelineArtifactPoint): string {
  if (point.state === "complete") return MILESTONE_STATE_LABELS.covered;
  if (point.state === "overdue") return MILESTONE_RAIL_LABELS.overdue;
  if (point.state === "current") return MILESTONE_RAIL_LABELS.current;
  return MILESTONE_STATE_LABELS[point.item.state] ?? MILESTONE_STATE_LABELS.later;
}
