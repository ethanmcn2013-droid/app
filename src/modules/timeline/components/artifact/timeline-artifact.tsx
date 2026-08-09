"use client";

import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type Ref,
} from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import type { AudienceTimelineDto } from "@/modules/timeline/lib/audience-timeline";
import { useHydrated } from "@/lib/use-hydrated";
import { PRODUCT_MARKETING_URLS } from "@/lib/product-urls";
import {
  MILESTONE_RAIL_LABELS,
  NO_TIMING_LABEL,
  PLACE_IN_PLAN_LABEL,
  milestonePlace,
  timelineNouns,
} from "@/modules/timeline/lib/vocabulary";
import {
  artifactTitleLength,
  buildTimelineArtifactModel,
  buildTimelineCountdown,
  extraLabelIndices,
  formatTimelineDate,
  labelShifts,
  metricValueScale,
  timelineAxisDescription,
  timelineAxisNote,
  timelinePointStatus,
  timelinePresentation,
  timelineRailCaps,
  type MetricValueScale,
  type TimelineArtifactModel,
  type TimelineArtifactPoint,
} from "./timeline-artifact-model";
import styles from "./timeline-artifact.module.css";

type MetricMode = "progress" | "countdown";

/**
 * Outcome of the share affordance. "shared" means the platform share sheet
 * took it from here (the sheet is its own feedback); "dismissed" means the
 * viewer closed the sheet; "copied" means the URL is on the clipboard and
 * the artifact owes the viewer a visible receipt.
 */
export type TimelineShareOutcome = "shared" | "copied" | "dismissed";

type MetricFact = Readonly<{
  label: string;
  value: string;
  unit: string;
  receipt?: string;
  spoken: string;
  alternate: string;
  /** Which sized treatment the value takes. See `metricValueScale`. */
  scale: MetricValueScale;
}>;

type StageStyle = CSSProperties & {
  "--timeline-point-count": number;
  "--timeline-completion": string;
};

type PositionStyle = CSSProperties & {
  "--timeline-position": string;
  "--timeline-position-stack"?: string;
  "--timeline-point-delay"?: string;
  /** Rail-percent the LABEL is nudged by to clear its neighbour. The mark
   *  never moves; see `labelShifts`. */
  "--timeline-label-shift"?: string;
};

const METRIC_EASE = [0.23, 1, 0.32, 1] as const;

/**
 * Motion's media-query hook can know the browser preference on the first
 * client render while the server cannot. Gate that value behind React's
 * hydration snapshot so SSR and the first hydration pass always choose the
 * same motion props and subtree. The real preference takes effect immediately
 * after hydration.
 */
function useArtifactReducedMotion(): boolean {
  const hydrated = useHydrated();
  const prefersReducedMotion = useReducedMotion();
  return hydrated && Boolean(prefersReducedMotion);
}

export type TimelineArtifactProps = Readonly<{
  timeline: AudienceTimelineDto;
  compact?: boolean;
  embedded?: boolean;
  /**
   * The artifact's own product header (wordmark + shared-by row). On the
   * standalone shared page and in exhibit frames (artifact studio, phone
   * preview) it IS the page chrome and stays. Inside the owner's app shell
   * the suite chrome already provides identity, so the owner view suppresses
   * it rather than stacking two wordmarks.
   */
  showProductHeader?: boolean;
  className?: string;
  onShare?: () => Promise<TimelineShareOutcome>;
  shareLabel?: string;
}>;

/**
 * Progress, stated once.
 *
 * The face used to say the same thing three ways — a giant percentage, a `%`
 * severed from its own number, and a receipt reading "N of N settled". None of
 * the three was the fact a viewer wants: a couple does not think in percent,
 * and `settled` was never a concept in this product (no column, no state, no
 * meaning outside a drag animation elsewhere in the codebase).
 *
 * So the count IS the value. "0 of 1 complete" is one expression, it needs no
 * unit glyph beside it, and it is the same sentence the rail's progressbar
 * speaks in `aria-valuetext`, so the screen and the screen reader agree.
 */
function progressFact(model: TimelineArtifactModel): MetricFact {
  const counted = `${model.completedCount} of ${model.totalCount} complete`;
  return {
    label: "Milestones",
    value: counted,
    unit: "",
    spoken: `${model.completedCount} of ${model.totalCount} milestones complete`,
    alternate: counted,
    scale: "count",
  };
}

function countdownFact(
  countdown: Exclude<ReturnType<typeof buildTimelineCountdown>, null | { kind: "past" }>,
  eventLabel: string,
  model: TimelineArtifactModel,
): MetricFact {
  // The countdown face carries the plan's other fact too, so whichever face
  // the artifact opens on states both. Paper already prints both; the screen
  // owed the same completeness — a couple leading with the countdown should
  // not have to press to learn how much is done.
  const receipt = `${model.completedCount} of ${model.totalCount} complete`;

  if (countdown.kind === "today") {
    return {
      label: `Until ${eventLabel.toLowerCase()}`,
      value: "Today",
      unit: "",
      receipt,
      spoken: `${eventLabel} is today`,
      alternate: `${eventLabel} today`,
      scale: metricValueScale("Today"),
    };
  }

  const value = String(countdown.days);
  return {
    label: `Until ${eventLabel.toLowerCase()}`,
    value,
    unit: countdown.days === 1 ? "day" : "days",
    receipt,
    spoken: `${countdown.days} ${countdown.days === 1 ? "day" : "days"} remaining`,
    alternate: `${countdown.days} ${countdown.days === 1 ? "day" : "days"} left`,
    scale: metricValueScale(value),
  };
}

function MetricFace({
  fact,
  receiptIsAffordance = false,
}: {
  fact: MetricFact;
  /**
   * True when the receipt is the only line the alternate would have printed,
   * so the receipt carries the pressable underline the alternate used to wear
   * and the fact is stated once instead of twice.
   */
  receiptIsAffordance?: boolean;
}) {
  return (
    <span className={styles.metricFace} aria-hidden="true">
      <span className={styles.metricLabel}>{fact.label}</span>
      <span className={styles.metricPrimary}>
        <strong data-timeline-metric-value>{fact.value}</strong>
        {fact.unit ? <small>{fact.unit}</small> : null}
      </span>
      {fact.receipt ? (
        <span
          className={styles.metricReceipt}
          data-metric-receipt-affordance={receiptIsAffordance ? "true" : undefined}
        >
          {fact.receipt}
        </span>
      ) : null}
    </span>
  );
}

function TimeLens({
  timeline,
  model,
}: {
  timeline: AudienceTimelineDto;
  model: TimelineArtifactModel;
}) {
  const reduceMotion = useArtifactReducedMotion();
  const countdown = buildTimelineCountdown(timeline.primaryDate?.date, timeline.today);
  const canCountDown = countdown?.kind === "future" || countdown?.kind === "today";
  // A couple's artifact leads with its heart: days until the day. Progress
  // percent is the working view, one press away. Other kinds keep progress
  // first — for a class or a project the completion story is the headline.
  const defaultMode: MetricMode = timeline.audienceKind === "couple" && canCountDown
    ? "countdown"
    : "progress";
  const [requestedMode, setRequestedMode] = useState<MetricMode>(defaultMode);
  const [announcement, setAnnouncement] = useState("");
  const mode: MetricMode = canCountDown ? requestedMode : "progress";
  const completion = progressFact(model);
  const remaining = canCountDown && timeline.primaryDate
    ? countdownFact(countdown, timeline.primaryDate.label, model)
    : null;
  const active = mode === "countdown" && remaining ? remaining : completion;
  const otherFace = mode === "progress" ? remaining : completion;
  // The countdown face carries the completion count as its receipt, and the
  // alternate line offered to "Show" the identical sentence directly beneath
  // it — "2 of 9 complete" printed twice, one line apart, in the artifact's
  // quietest voice. The fact is stated once now; when the two strings match,
  // the receipt becomes the pressable line and the alternate stands down.
  const receiptIsAffordance = otherFace !== null && otherFace.alternate === active.receipt;
  const alternate = receiptIsAffordance ? null : otherFace;
  const direction = mode === "countdown" ? 1 : -1;
  const dateSpoken = timeline.primaryDate
    ? `${timeline.primaryDate.label}, ${formatTimelineDate(timeline.primaryDate.date, "long")}`
    : null;
  // Paper carries no toggle: both facts print as one static line instead of
  // a click instruction ("Show 79 days left") that means nothing on a page.
  const printFacts = [completion.alternate, remaining?.alternate]
    .filter(Boolean)
    .join(" · ");

  const face = (
    <>
      <span className={styles.metricViewport}>
        <AnimatePresence initial={false} mode="wait" custom={direction}>
          <motion.span
            className={styles.metricMotion}
            key={mode}
            custom={direction}
            initial={reduceMotion ? false : { opacity: 0, x: direction * 14 }}
            animate={{ opacity: 1, x: 0 }}
            exit={reduceMotion ? undefined : { opacity: 0, x: direction * -10 }}
            transition={{ duration: reduceMotion ? 0 : 0.14, ease: METRIC_EASE }}
          >
            <MetricFace fact={active} receiptIsAffordance={receiptIsAffordance} />
          </motion.span>
        </AnimatePresence>
        <motion.span
          className={styles.metricSweep}
          data-direction={direction > 0 ? "forward" : "back"}
          key={`sweep-${mode}`}
          initial={reduceMotion ? false : { opacity: 0.32, scaleX: 0 }}
          animate={
            reduceMotion
              ? { opacity: 0, scaleX: 1 }
              : { opacity: [0.32, 0.18, 0], scaleX: [0, 1, 1] }
          }
          transition={{
            duration: reduceMotion ? 0 : 0.22,
            ease: METRIC_EASE,
            times: reduceMotion ? undefined : [0, 0.72, 1],
          }}
          aria-hidden="true"
        />
      </span>
      {/* The row is always here; only its line comes and goes. Withholding the
          box as well would move the rail 29px up and down every time the
          metric was pressed, which is the same class of fault the reserved
          metric box exists to prevent. */}
      {otherFace ? (
        <span className={styles.metricAlternateViewport} aria-hidden="true">
          {alternate ? (
            <AnimatePresence initial={false} mode="wait">
              <motion.span
                className={styles.metricAlternate}
                key={`alternate-${mode}`}
                initial={reduceMotion ? false : { opacity: 0, x: direction * -6 }}
                animate={{ opacity: 1, x: 0 }}
                exit={reduceMotion ? undefined : { opacity: 0, x: direction * 6 }}
                transition={{ duration: reduceMotion ? 0 : 0.14, ease: METRIC_EASE }}
              >
                Show {alternate.alternate}
              </motion.span>
            </AnimatePresence>
          ) : null}
        </span>
      ) : null}
      {timeline.primaryDate ? (
        <span className={styles.metricDate} aria-hidden="true">
          <span>{timeline.primaryDate.label}</span>
          <time dateTime={timeline.primaryDate.date}>
            {formatTimelineDate(timeline.primaryDate.date)}
          </time>
        </span>
      ) : null}
    </>
  );

  if (!remaining) {
    return (
      <div className={styles.timeLensShell}>
        <div
          className={`${styles.timeLens} ${styles.timeLensStatic}`}
          data-timeline-metric
          data-metric-mode="progress"
          data-metric-scale={completion.scale}
          role="group"
          aria-label={`${completion.spoken}${dateSpoken ? `. ${dateSpoken}` : ""}`}
        >
          {face}
        </div>
        <span className={styles.printFacts} aria-hidden="true">{printFacts}</span>
      </div>
    );
  }

  const nextMode: MetricMode = mode === "progress" ? "countdown" : "progress";
  const nextFact = nextMode === "countdown" ? remaining : completion;
  const controlLabel = mode === "progress"
    ? `Show days remaining. Currently showing ${completion.spoken}.${dateSpoken ? ` ${dateSpoken}.` : ""}`
    : `Show milestone completion. Currently showing ${remaining.spoken}.${dateSpoken ? ` ${dateSpoken}.` : ""}`;

  return (
    <div className={styles.timeLensShell}>
      <button
        className={styles.timeLens}
        data-timeline-metric
        data-timeline-metric-toggle
        data-metric-mode={mode}
        data-metric-scale={active.scale}
        type="button"
        aria-label={controlLabel}
        onClick={() => {
          setRequestedMode(nextMode);
          setAnnouncement(`Now showing ${nextFact.spoken}.`);
        }}
      >
        {face}
      </button>
      <span className={styles.printFacts} aria-hidden="true">{printFacts}</span>
      <span className={styles.screenReaderOnly} aria-live="polite" aria-atomic="true">
        {announcement}
      </span>
    </div>
  );
}

function ProductIdentity({
  timeline,
  onShare,
  shareLabel,
}: Pick<TimelineArtifactProps, "timeline" | "onShare" | "shareLabel">) {
  const [shareState, setShareState] = useState<"idle" | "working" | "copied" | "error">("idle");
  const revertTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sharedBy = timeline.ownerDisplayLabel ?? "Shared timeline";

  useEffect(() => () => {
    if (revertTimer.current) clearTimeout(revertTimer.current);
  }, []);

  const settle = (state: "idle" | "copied" | "error") => {
    setShareState(state);
    if (revertTimer.current) clearTimeout(revertTimer.current);
    if (state === "copied" || state === "error") {
      // Receipts rest: the label returns to its verb once the moment passes,
      // failure lingering a little longer than success.
      revertTimer.current = setTimeout(
        () => setShareState("idle"),
        state === "copied" ? 2000 : 5000,
      );
    }
  };

  return (
    <div className={styles.productHeader}>
      <span className={styles.productMark} aria-label="timeline" data-timeline-wordmark>
        timeline<span aria-hidden="true" />
      </span>
      <div className={styles.productMeta}>
        <span>{sharedBy}</span>
        {onShare ? (
          <button
            type="button"
            data-share-state={shareState}
            disabled={shareState === "working"}
            onClick={async () => {
              setShareState("working");
              try {
                const outcome = await onShare();
                settle(outcome === "copied" ? "copied" : "idle");
              } catch {
                settle("error");
              }
            }}
          >
            {shareState === "copied"
              ? "Link copied"
              : shareState === "error"
                ? "Copy from the address bar"
                : shareLabel ?? "Share this timeline"}
          </button>
        ) : null}
        <span className={styles.screenReaderOnly} aria-live="polite" aria-atomic="true">
          {shareState === "copied" ? "Timeline link copied." : null}
          {shareState === "error"
            ? "The link could not be shared. Copy it from the address bar."
            : null}
        </span>
      </div>
    </div>
  );
}

function MilestoneLabel({ point }: { point: TimelineArtifactPoint }) {
  return (
    <span className={styles.milestoneLabel} data-timeline-milestone-label aria-hidden="true">
      <span>{timelinePointStatus(point)}</span>
      <strong>{point.item.title}</strong>
      <small>{point.item.date ? formatTimelineDate(point.item.date) : NO_TIMING_LABEL}</small>
    </span>
  );
}

/**
 * The one line of prose under a milestone title. Rewritten 2026-08-03 (E06.04):
 * two of the three sentences used "journey" as a noun, which the brand voice
 * bans, and this is front-facing copy on a couple's wedding page rather than an
 * internal string. Kept short and plain, and kept deliberately rather than
 * removed, because it is the slot a real milestone story lands in once the
 * published DTO can carry one (E06.02 and E06.03).
 *
 * The next milestone gets no line at all. Its status sits three lines above in
 * the module's own words ("Our next milestone"), the mark it opened from is
 * `aria-current="step"`, and the rail draws it as the one indigo object on the
 * page — so "This one is next." was the fourth statement of the same fact
 * inside one panel. Saying nothing is more honest than saying it again.
 */
function detailNote(point: TimelineArtifactPoint): string | null {
  if (point.state === "complete") return "This one is already behind you.";
  if (point.isNext) return null;
  return "This one comes later.";
}

function detailTiming(point: TimelineArtifactPoint, today: string): string | null {
  if (!point.item.date || point.state === "complete") return null;
  const countdown = buildTimelineCountdown(point.item.date, today);
  if (!countdown) return null;
  if (countdown.kind === "today") return "today";
  if (countdown.kind === "future") {
    return `in ${countdown.days} ${countdown.days === 1 ? "day" : "days"}`;
  }
  return `${countdown.days} ${countdown.days === 1 ? "day" : "days"} ago`;
}

function MilestoneDetail({
  point,
  ordinal,
  total,
  today,
  detailId,
  titleId,
  sectionRef,
}: {
  point: TimelineArtifactPoint;
  ordinal: number;
  total: number;
  today: string;
  detailId: string;
  titleId: string;
  sectionRef?: Ref<HTMLElement>;
}) {
  const relative = detailTiming(point, today);
  const note = detailNote(point);

  return (
    <section
      className={styles.detail}
      data-detail-state={point.state}
      data-selected-milestone={point.item.publicId}
      id={detailId}
      aria-labelledby={titleId}
      ref={sectionRef}
    >
      <div
          className={styles.detailInner}
          key={point.item.publicId}
        >
          <div className={styles.detailLead}>
            <p className={styles.detailStatus}>{timelinePointStatus(point)}</p>
            <h3 id={titleId}>{point.item.title}</h3>
            {note ? <p>{note}</p> : null}
          </div>
          <dl className={styles.detailFacts}>
            <div>
              <dt>Timing</dt>
              <dd>
                {point.item.date ? (
                  <>
                    <time dateTime={point.item.date}>
                      {formatTimelineDate(point.item.date, "long")}
                    </time>
                    {relative ? ` · ${relative}` : null}
                  </>
                ) : NO_TIMING_LABEL}
              </dd>
            </div>
            <div>
              <dt>{PLACE_IN_PLAN_LABEL}</dt>
              <dd>{milestonePlace(ordinal, total)}</dd>
            </div>
          </dl>
      </div>
    </section>
  );
}

/**
 * One milestone with no usable timing. A rail would have to place its single
 * dot somewhere, and every somewhere on a time axis is a claim about time —
 * dead centre most of all. So this plan is stated as what it actually is: a
 * place in a sequence, with the timing named honestly underneath.
 */
function SequenceState({
  heading,
  model,
  idPrefix,
}: {
  heading: string;
  model: TimelineArtifactModel;
  idPrefix: string;
}) {
  const point = model.points[0];
  const sectionId = `${idPrefix}-timeline`;

  return (
    <section className={styles.journey} id={sectionId} aria-labelledby={`${sectionId}-title`}>
      <h2 className={styles.screenReaderOnly} id={`${sectionId}-title`}>{heading}</h2>
      <div className={styles.sequenceCard} data-state={point.state} data-sequence-card>
        <p className={styles.sequenceStep}>
          {milestonePlace(1, model.points.length)}
        </p>
        <p className={styles.sequenceStatus}>{timelinePointStatus(point)}</p>
        <h3 className={styles.sequenceTitle}>{point.item.title}</h3>
        <p className={styles.sequenceTiming}>
          {point.item.date ? (
            <time dateTime={point.item.date}>
              {formatTimelineDate(point.item.date, "long")}
            </time>
          ) : NO_TIMING_LABEL}
        </p>
      </div>
    </section>
  );
}

function Journey({
  heading,
  timeline,
  model,
  idPrefix,
}: {
  heading: string;
  timeline: AudienceTimelineDto;
  model: TimelineArtifactModel;
  idPrefix: string;
}) {
  const reduceMotion = useArtifactReducedMotion();
  const [selectedId, setSelectedId] = useState(model.defaultSelectedId);
  const [focusIndex, setFocusIndex] = useState(() => Math.max(
    0,
    model.points.findIndex((point) => point.item.publicId === model.defaultSelectedId),
  ));
  const [detailOpen, setDetailOpen] = useState(Boolean(model.defaultSelectedId));
  // Hidden scrollbars owe the viewer an affordance: edge fades appear only
  // while content is actually cut off on that side.
  const [overflowStart, setOverflowStart] = useState(false);
  const [overflowEnd, setOverflowEnd] = useState(false);
  const pointRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const detailRef = useRef<HTMLElement | null>(null);
  // How much of the rail one label box actually occupies, in rail-percent.
  // Null until the rail has been measured; see the geometry effect below for
  // why this cannot be a constant.
  const [labelSpan, setLabelSpan] = useState<number | null>(null);
  const selectedPoint = model.points.find((point) => point.item.publicId === selectedId)
    ?? model.points.find((point) => point.item.publicId === model.defaultSelectedId)
    ?? null;
  const boundedFocusIndex = Math.min(
    Math.max(focusIndex, 0),
    Math.max(0, model.points.length - 1),
  );
  const sectionId = `${idPrefix}-timeline`;
  const instructionsId = `${idPrefix}-instructions`;
  const detailId = `${idPrefix}-detail`;
  const detailTitleId = `${idPrefix}-detail-title`;

  const scrollPointIntoView = (index: number, behavior: ScrollBehavior) => {
    const viewport = viewportRef.current;
    const point = model.points[index];
    if (!viewport || !point) return;
    if (viewport.scrollWidth <= viewport.clientWidth) return;
    const target = (point.position / 100) * viewport.scrollWidth - viewport.clientWidth / 2;
    viewport.scrollTo({ left: Math.max(0, target), behavior });
  };

  /**
   * Selecting a milestone has to produce something the viewer can see, and on
   * a phone the detail sits a full stacked rail below the mark that was
   * tapped — far enough that the tap read as doing nothing at all. `nearest`
   * means a detail already on screen is left exactly where it is, so this
   * costs desktop nothing and rescues the phone.
   */
  const revealDetail = () => {
    if (typeof window === "undefined") return;
    requestAnimationFrame(() => {
      detailRef.current?.scrollIntoView({
        block: "nearest",
        behavior: reduceMotion ? "auto" : "smooth",
      });
    });
  };

  useEffect(() => {
    const index = model.points.findIndex((point) => point.item.publicId === model.defaultSelectedId);
    if (index < 0) return;
    const frame = requestAnimationFrame(() => scrollPointIntoView(index, "auto"));
    return () => cancelAnimationFrame(frame);
    // The initial centring belongs to the publication, not later focus movement.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [model.defaultSelectedId, model.points]);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const update = () => {
      const max = viewport.scrollWidth - viewport.clientWidth;
      const scrollable = max > 1;
      setOverflowStart(scrollable && viewport.scrollLeft > 8);
      setOverflowEnd(scrollable && viewport.scrollLeft < max - 8);
    };
    update();
    viewport.addEventListener("scroll", update, { passive: true });
    const observer = new ResizeObserver(update);
    observer.observe(viewport);
    return () => {
      viewport.removeEventListener("scroll", update);
      observer.disconnect();
    };
  }, [model.points.length]);

  /**
   * Rail geometry, read off the rail rather than assumed.
   *
   * Two numbers were previously guessed, and both guesses were wrong in a way
   * only a rendered page could show.
   *
   * The stage's height is a calculation from `--x-timeline-label-block`, which
   * budgets a fixed 4.5rem for "a status line, a title and a date". A milestone
   * whose title runs to three or four lines needs half as much again, and the
   * stage's `overflow: clip` cut the difference off — a real milestone losing
   * its date at every desktop width. The tallest label measured here feeds that
   * budget back, so spacing follows content instead of the other way round.
   *
   * The label's width in rail-percent was the constant 16 in
   * `extraLabelIndices`. The rail is a scroll canvas at least
   * `count x --x-timeline-pitch` wide, so on a twenty-two-milestone plan it is
   * ~1848px at every desktop width and one 136-200px label occupies 7-11
   * percent of it, not 16. The constant refused labels that had ample room, and
   * refused the same ones at 1920 as at 768 because it could not see either.
   *
   * Both readings are stable under their own effect: labels are absolutely
   * positioned at a fixed width, so neither a taller stage nor a newly revealed
   * label changes what is measured here.
   */
  useEffect(() => {
    const viewport = viewportRef.current;
    const stage = stageRef.current;
    if (!viewport || !stage) return;
    const measure = () => {
      const labels = Array.from(
        stage.querySelectorAll<HTMLElement>("[data-timeline-milestone-label]"),
      );
      if (!labels.length) return;
      let tallest = 0;
      let widest = 0;
      for (const label of labels) {
        const rect = label.getBoundingClientRect();
        if (rect.height > tallest) tallest = rect.height;
        if (rect.width > widest) widest = rect.width;
      }
      const previous = stage.style.getPropertyValue("--x-timeline-label-measured");
      const next = `${Math.ceil(tallest)}px`;
      if (previous !== next) stage.style.setProperty("--x-timeline-label-measured", next);

      const railWidth = stage.getBoundingClientRect().width;
      if (railWidth <= 0 || widest <= 0) return;
      // The rail's own width, published to CSS so a label nudge expressed in
      // rail-percent can be drawn in pixels. Nothing else can do this
      // conversion: the label's containing block is its 3rem hit target, so a
      // percentage there would resolve against the wrong box.
      const railWidthPx = `${Math.round(railWidth)}px`;
      if (stage.style.getPropertyValue("--x-timeline-rail-width") !== railWidthPx) {
        stage.style.setProperty("--x-timeline-rail-width", railWidthPx);
      }
      const span = (widest / railWidth) * 100;
      setLabelSpan((current) =>
        current !== null && Math.abs(current - span) < 0.25 ? current : span,
      );
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(stage);
    observer.observe(viewport);
    return () => observer.disconnect();
  }, [model.points]);

  const focusPoint = (nextIndex: number) => {
    const bounded = Math.min(Math.max(nextIndex, 0), model.points.length - 1);
    setFocusIndex(bounded);
    pointRefs.current[bounded]?.focus();
    scrollPointIntoView(bounded, reduceMotion ? "auto" : "smooth");
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (event.key === "ArrowRight") {
      event.preventDefault();
      focusPoint(index + 1);
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      focusPoint(index - 1);
    } else if (event.key === "Home") {
      event.preventDefault();
      focusPoint(0);
    } else if (event.key === "End") {
      event.preventDefault();
      focusPoint(model.points.length - 1);
    } else if (event.key === "Escape") {
      event.preventDefault();
      setDetailOpen(false);
    }
  };

  const stageStyle: StageStyle = {
    "--timeline-point-count": Math.max(1, model.points.length),
    "--timeline-completion": `${model.percent}%`,
  };
  // Collision-aware extra labels: beyond the mandatory titles (next, the
  // completed point before it, the last point) any point whose same-side
  // neighbours leave room earns its label on wide rails. Selection is
  // excluded from the mandatory set here because it is transient — a
  // selected label always shows and z-raises regardless.
  const mandatoryLabels = useMemo(() => {
    const firstUnfinished = model.points.findIndex((point) => point.state !== "complete");
    return new Set<number>([
      Math.max(0, firstUnfinished - 1),
      model.points.length - 1,
      ...model.points.flatMap((point, index) => (point.isNext ? [index] : [])),
    ]);
  }, [model.points]);
  const extraLabels = useMemo(
    () => extraLabelIndices(
      model.points.map((point) => point.position),
      mandatoryLabels,
      labelSpan ?? undefined,
    ),
    [model.points, mandatoryLabels, labelSpan],
  );
  // Marks are where their dates are. When two visible labels would overlap it
  // is the LABEL that gives way — never the mark, which is the whole of the
  // proportionality repair. Held back until the rail has been measured, so the
  // server and the first client render agree on an unshifted layout.
  const labelNudges = useMemo(
    () => (labelSpan === null
      ? new Map<number, number>()
      : labelShifts(
          model.points.map((point) => point.position),
          new Set([...mandatoryLabels, ...extraLabels]),
          labelSpan,
        )),
    [model.points, mandatoryLabels, extraLabels, labelSpan],
  );
  // The Today chip negotiates for space like every label does: when an
  // above-side labelled point sits within its band, the chip yields to the
  // rail's underside; on the stacked axis it nudges clear instead.
  const todayCollides = (
    positionOf: (point: TimelineArtifactPoint, index: number) => number | null,
    today: number | null,
    threshold: number,
  ) => {
    if (today === null) return false;
    return model.points.some((point, index) => {
      const position = positionOf(point, index);
      return position !== null && Math.abs(position - today) < threshold;
    });
  };
  const todaySide = todayCollides(
    (point, index) =>
      index % 2 === 0 && (mandatoryLabels.has(index) || extraLabels.has(index))
        ? point.position
        : null,
    model.todayPosition,
    7,
  )
    ? "below"
    : "above";
  const todayNudged = todayCollides(
    (point) => point.stackPosition,
    model.todayStackPosition,
    4,
  );
  const todayStyle: PositionStyle | undefined = model.todayPosition === null
    ? undefined
    : {
        "--timeline-position": `${model.todayPosition}%`,
        "--timeline-position-stack": `${model.todayStackPosition ?? model.todayPosition}%`,
      };
  const nextMilestone = model.points.find((point) => point.isNext) ?? null;
  // The caps under the rail's ends come from the model, because what they may
  // say depends on whether the rail is a calendar at all: real dates when it
  // is, sequence words when it is not. "Start"/"Finish" on an ordered rail
  // would re-assert the temporal reading the ordered mode exists to refuse.
  const caps = timelineRailCaps(model);
  const axisNote = timelineAxisNote(model);
  // One name for this milestone, spoken the same way on the mark, in the Today
  // marker and in the keyboard instructions. The instructions used to call it
  // "the project's next milestone" on a page that had already introduced
  // itself as a wedding.
  const todayLabel = model.todayPosition === null
    ? null
    : `Today, ${formatTimelineDate(timeline.today, "long")}.${nextMilestone ? ` ${MILESTONE_RAIL_LABELS.current} is ${nextMilestone.item.title}.` : ""}`;
  // The rail's span, stated in words. The month ticks and the Today dash are
  // aria-hidden decoration, so without this sentence the axis was invisible to
  // low vision and absent from assistive technology at once.
  const axisDescription = timelineAxisDescription(model);
  const instructions = model.axis.mode === "ordered"
    ? `${axisDescription} Use Left and Right Arrow to move between milestones, Home and End to jump, Enter or Space to select, and Escape to close milestone detail.`
    : `${axisDescription} The highlighted point is ${MILESTONE_RAIL_LABELS.current.toLowerCase()}. The Today dash shows the calendar position. Use Left and Right Arrow to move between milestones, Home and End to jump, Enter or Space to select, and Escape to close milestone detail.`;

  return (
    <section className={styles.journey} id={sectionId} aria-labelledby={`${sectionId}-title`}>
      <h2 className={styles.screenReaderOnly} id={`${sectionId}-title`}>{heading}</h2>
      <p className={styles.screenReaderOnly} id={instructionsId}>
        {instructions}
      </p>
      <div
        className={styles.railFrame}
        data-overflow-start={overflowStart ? "true" : undefined}
        data-overflow-end={overflowEnd ? "true" : undefined}
        role="group"
        aria-roledescription="timeline axis"
        aria-label={axisDescription}
      >
        <div className={styles.stageViewport} ref={viewportRef} data-timeline-scroll-viewport>
          <div className={styles.stage} ref={stageRef} style={stageStyle}>
            {/* One statement, one number.
                The ink is drawn to the furthest completed dot, because the
                rail is a date axis and a fill that stopped anywhere else
                would end at a date that means nothing — two coordinate
                systems sharing one line, which is exactly what the dots and
                the fill exist not to be. That decision stands.
                What did not stand was this element claiming a different
                number from the one it paints: `aria-valuenow` carried the
                count percentage (40 on a plan whose ink reaches 0.34 of the
                rail), so the bar's machine value and its drawing disagreed.
                The value now tracks the drawing. The sentence a screen
                reader actually announces is `aria-valuetext`, and that is
                unchanged and still the honest count — the same words the
                metric prints, so screen and screen reader agree. */}
            <div
              className={styles.progressGeometry}
              role="progressbar"
              aria-label="Milestone completion"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(model.completedFrontier ?? 0)}
              aria-valuetext={`${model.completedCount} of ${model.totalCount} milestones complete`}
            >
              <span className={styles.baseRail} aria-hidden="true" />
              {/* The ink is drawn to the furthest completed dot — the fill
                  and the dots are one statement, never two coordinate
                  systems sharing a line. The count percentage lives in the
                  metric and in this progressbar's spoken value only. */}
              <span
                className={styles.completedRail}
                style={{ transform: `scaleX(${(model.completedFrontier ?? 0) / 100})` }}
                aria-hidden="true"
              />
              <span
                className={styles.completedRailVertical}
                style={{ transform: `scaleY(${(model.completedStackFrontier ?? 0) / 100})` }}
                aria-hidden="true"
              />
            </div>

            {/* The rail's cartography: month boundaries riding the same
                distortion mapping as the points, so the calendar's rhythm —
                why some gaps run long and others short — is visible truth.
                Labels yield to the Today chip and the rail's edge caps;
                decoration never outranks information. */}
            {model.monthTicks.length ? (
              <span className={styles.monthTicks} aria-hidden="true">
                {(() => {
                  // Greedy label thinning: a label that would sit within 4
                  // rail-percent of the previous labelled tick is "tight" —
                  // it keeps its label on wide rails and yields it below
                  // 980px (and in print), where four percent stops being
                  // enough paper for a month's name.
                  let lastLabelled = Number.NEGATIVE_INFINITY;
                  return model.monthTicks.map((tick) => {
                    const nearToday = model.todayPosition !== null
                      && Math.abs(tick.position - model.todayPosition) < 3;
                    const nearEdge = tick.position < 4 || tick.position > 96;
                    const quiet = nearToday || nearEdge;
                    const tight = !quiet && tick.position - lastLabelled < 4;
                    if (!quiet && !tight) lastLabelled = tick.position;
                    const tickStyle: PositionStyle = {
                      "--timeline-position": `${tick.position}%`,
                      "--timeline-position-stack": `${tick.stackPosition}%`,
                    };
                    return (
                      <span
                        className={styles.monthTick}
                        data-quiet={quiet ? "true" : undefined}
                        data-tight={tight ? "true" : undefined}
                        key={`${tick.label}-${tick.position}`}
                        style={tickStyle}
                      >
                        <span>{tick.label}</span>
                      </span>
                    );
                  });
                })()}
              </span>
            ) : null}

            {todayLabel && todayStyle ? (
              <span
                className={styles.todayMarker}
                data-today-marker
                data-today-side={todaySide}
                data-today-nudged={todayNudged ? "true" : undefined}
                style={todayStyle}
                role="img"
                aria-label={todayLabel}
              >
                <span aria-hidden="true">Today</span>
              </span>
            ) : null}

            {model.points.length ? (
              <ol className={styles.milestones} aria-describedby={instructionsId}>
                {model.points.map((point, index) => {
                  const selected = point.item.publicId === selectedPoint?.item.publicId;
                  const firstUnfinished = model.points.findIndex((candidate) => candidate.state !== "complete");
                  const persistentLabel = selected
                    || point.isNext
                    || index === Math.max(0, firstUnfinished - 1)
                    || index === model.points.length - 1;
                  const extraLabel = !persistentLabel && extraLabels.has(index);
                  const nudge = labelNudges.get(index) ?? 0;
                  const pointStyle: PositionStyle = {
                    "--timeline-position": `${point.position}%`,
                    "--timeline-position-stack": `${point.stackPosition}%`,
                    "--timeline-point-delay": `${Math.min(0.08 + index * 0.012, 0.24)}s`,
                    ...(nudge === 0 ? {} : { "--timeline-label-shift": String(nudge) }),
                  };
                  const timing = point.item.date ? formatTimelineDate(point.item.date, "long") : NO_TIMING_LABEL;

                  return (
                    <li
                      className={styles.milestone}
                      data-state={point.state}
                      data-selected={selected ? "true" : undefined}
                      data-labelled={persistentLabel ? "true" : extraLabel ? "extra" : "false"}
                      data-label-shifted={nudge === 0 ? undefined : "true"}
                      data-side={index % 2 === 0 ? "above" : "below"}
                      data-edge={index === 0 ? "start" : index === model.points.length - 1 ? "end" : undefined}
                      key={point.item.publicId}
                      style={pointStyle}
                    >
                      <button
                        className={styles.milestoneButton}
                        type="button"
                        tabIndex={index === boundedFocusIndex ? 0 : -1}
                        aria-current={point.isNext ? "step" : undefined}
                        aria-pressed={selected}
                        aria-expanded={selected ? detailOpen : false}
                        aria-controls={selected ? detailId : undefined}
                        aria-label={`${point.item.title}. ${timelinePointStatus(point)}. ${timing}. ${milestonePlace(index + 1, model.points.length)}.`}
                        ref={(node) => { pointRefs.current[index] = node; }}
                        onFocus={() => setFocusIndex(index)}
                        onKeyDown={(event) => handleKeyDown(event, index)}
                        onClick={() => {
                          setFocusIndex(index);
                          setSelectedId(point.item.publicId);
                          setDetailOpen(true);
                          revealDetail();
                        }}
                      >
                        <span className={styles.point} aria-hidden="true" />
                        <MilestoneLabel point={point} />
                      </button>
                    </li>
                  );
                })}
              </ol>
            ) : (
              <p className={styles.empty}>
                <strong>No milestones shared yet.</strong>
                <span>Milestones will appear here when they are ready.</span>
              </p>
            )}

            {caps.start ? (
              <span className={styles.startCap} aria-hidden="true">{caps.start}</span>
            ) : null}
            {caps.finish ? (
              <span className={styles.finishCap} aria-hidden="true">{caps.finish}</span>
            ) : null}
          </div>
        </div>
      </div>

      {/* An ordered rail looks exactly like a time axis and is not one, so it
          says so where the viewer is looking. A dated rail already declares
          itself with month names and the Today dash and stays quiet. */}
      {axisNote ? <p className={styles.axisNote}>{axisNote}</p> : null}

      {/* Paper has no hover, and it used to be handed a second copy of every
          milestone as a ruled index under the rail — the same plan rendered
          twice into one document. The list above is now the only one: print
          stands it up as the stacked rail, where every label is visible and
          nothing collides, so the keepsake keeps its content without the
          artifact saying anything twice. */}

      <p className={styles.screenReaderOnly} aria-live="polite" aria-atomic="true">
        {detailOpen && selectedPoint
          ? `${selectedPoint.item.title} selected. ${timelinePointStatus(selectedPoint)}.`
          : "Milestone detail closed."}
      </p>
      {detailOpen && selectedPoint ? (
        <MilestoneDetail
          sectionRef={detailRef}
          point={selectedPoint}
          ordinal={model.points.findIndex(
            (candidate) => candidate.item.publicId === selectedPoint.item.publicId,
          ) + 1}
          total={model.points.length}
          today={timeline.today}
          detailId={detailId}
          titleId={detailTitleId}
        />
      ) : null}
    </section>
  );
}

function PlanningDecisions({ timeline, model }: { timeline: AudienceTimelineDto; model: TimelineArtifactModel }) {
  if (!model.cancelled.length) return null;
  return (
    <details className={styles.decisions}>
      <summary>
        {model.cancelled.length} planning {model.cancelled.length === 1 ? "decision" : "decisions"}
      </summary>
      <div>
        {model.cancelled.map((item) => (
          <span key={item.publicId}>
            {item.title}
            {item.date ? <time dateTime={item.date}>{formatTimelineDate(item.date)}</time> : null}
          </span>
        ))}
      </div>
      <span className={styles.screenReaderOnly}>{timeline.label}</span>
    </details>
  );
}

export function TimelineArtifact({
  timeline,
  compact = false,
  embedded = false,
  showProductHeader = true,
  className,
  onShare,
  shareLabel,
}: TimelineArtifactProps) {
  const reactId = useId().replaceAll(":", "");
  const model = useMemo(() => buildTimelineArtifactModel(timeline), [timeline]);
  const presentation = timelinePresentation(model);
  // The artifact's own nouns, read from the module's one vocabulary rather
  // than decided here. The kicker, the section heading and the purpose line
  // used to be two local functions and a hard-coded heading, and only the
  // heading was not audience-aware — so a wedding page introduced itself as a
  // wedding timeline and then announced "Project timeline" to a screen reader
  // six lines later.
  const nouns = timelineNouns(timeline.audienceKind);

  return (
    <article
      className={[styles.artifact, className].filter(Boolean).join(" ")}
      data-timeline-artifact
      data-compact={compact ? "true" : undefined}
      data-embedded={embedded ? "true" : undefined}
      data-density={model.density}
      data-axis={model.axis.mode}
      data-title-length={artifactTitleLength(timeline.label)}
    >
      <a className={styles.skipLink} href={`#${reactId}-timeline`}>Skip to timeline</a>
      <header className={styles.header}>
        {showProductHeader ? (
          <ProductIdentity
            timeline={timeline}
            onShare={onShare}
            shareLabel={shareLabel}
          />
        ) : null}
        <div className={styles.titleRow}>
          <div className={styles.headerCopy}>
            <p className={styles.heroKicker}>{nouns.kicker}</p>
            <h1>{timeline.label}</h1>
            <p className={styles.purpose}>{nouns.purpose}</p>
          </div>
          <TimeLens timeline={timeline} model={model} />
        </div>
      </header>

      {presentation === "sequence-card" ? (
        <SequenceState heading={nouns.heading} model={model} idPrefix={reactId} />
      ) : (
        <Journey
          heading={nouns.heading}
          timeline={timeline}
          model={model}
          idPrefix={reactId}
        />
      )}
      <PlanningDecisions timeline={timeline} model={model} />

      <footer className={styles.footer}>
        <span>Updated {formatTimelineDate(timeline.lastUpdatedAt.slice(0, 10))}</span>
        {/* The loop's last step is a door, not a full stop: the artifact is
            the product's own advertisement, and the attribution walks. The
            /s tree already sends no-referrer, so the bearer URL stays put. */}
        <a
          className={styles.footerLink}
          href={`${PRODUCT_MARKETING_URLS.timeline}?src=shared-timeline`}
          target="_blank"
          rel="noopener"
        >
          Made with Signal Timeline
        </a>
      </footer>
    </article>
  );
}
