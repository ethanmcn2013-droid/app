"use client";

import {
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import type { AudienceTimelineDto } from "@/modules/timeline/lib/audience-timeline";
import { PRODUCT_MARKETING_URLS } from "@/lib/product-urls";
import {
  NO_TIMING_LABEL,
  milestonePlace,
  timelineNouns,
} from "@/modules/timeline/lib/vocabulary";
import {
  artifactTitleLength,
  buildTimelineArtifactModel,
  buildTimelineCountdown,
  formatTimelineDate,
  timelineAxisDescription,
  timelinePointStatus,
  type TimelineArtifactModel,
  type TimelineArtifactPoint,
} from "./timeline-artifact-model";
import styles from "./timeline-artifact.module.css";

/**
 * The shared timeline, as a countdown.
 *
 * Direction picked by the founder on 28 September 2026 from four concepts
 * (remote-redesign `work/2026-09-28-timeline-artifact`): B, The Countdown, as
 * the core, with A's to-scale strip on wide screens and D's finale. It
 * replaces the Option D rail.
 *
 * The page reads top to bottom the way a guest thinks about the day: how long
 * until it, what is next, then every moment in order with its own number, and
 * the day itself last. The layout is chosen by the width it has; the reader
 * never picks one. Every fact comes from the published DTO and the model built
 * from it, so nothing private can reach this page.
 */

/**
 * Outcome of the share affordance. "shared" means the platform share sheet
 * took it from here (the sheet is its own feedback); "dismissed" means the
 * viewer closed the sheet; "copied" means the URL is on the clipboard and
 * the artifact owes the viewer a visible receipt.
 */
export type TimelineShareOutcome = "shared" | "copied" | "dismissed";

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

type PositionStyle = CSSProperties & { "--at": string };
type RowStyle = CSSProperties & { "--row-delay": string };

/**
 * The entrance, once per session. The hero rises, the strip draws and the
 * rows settle in the first time a tab opens a timeline; after that every
 * arrival lands in its final state. The inline script runs during parse on a
 * server-streamed page, so a returning viewer never sees a frame of motion;
 * the layout effect covers client navigation, where React never runs it. The
 * guard can only remove motion, so a viewer without JavaScript loses nothing.
 */
const ENTRANCE_SESSION_KEY = "signal:timeline-entrance";
const ENTRANCE_GUARD = `(function(){var s=document.currentScript,a=s&&s.parentElement;if(!a)return;a.setAttribute("data-entrance-guard","1");try{var k="${ENTRANCE_SESSION_KEY}";if(sessionStorage.getItem(k))a.setAttribute("data-entrance","seen");else sessionStorage.setItem(k,"1")}catch(e){}})();`;

function markEntranceSeen(article: HTMLElement | null): void {
  if (!article) return;
  // Exactly one path decides; the script's mark is the handshake.
  if (article.hasAttribute("data-entrance-guard")) return;
  try {
    if (sessionStorage.getItem(ENTRANCE_SESSION_KEY)) {
      article.setAttribute("data-entrance", "seen");
    } else {
      sessionStorage.setItem(ENTRANCE_SESSION_KEY, "1");
    }
  } catch {
    /* Private modes refuse storage; an entrance that replays is not a fault. */
  }
}

const WEEKDAY_DATE = new Intl.DateTimeFormat("en-GB", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

/** "Saturday 3 October 2026", for the day itself. */
function weekdayDate(value: string): string {
  const parsed = Date.parse(`${value}T00:00:00.000Z`);
  if (!Number.isFinite(parsed)) return formatTimelineDate(value, "long");
  return WEEKDAY_DATE.format(new Date(parsed)).replace(",", "");
}

const plural = (count: number, one: string, many: string) => (count === 1 ? one : many);

/** Days from `from` to `to`, both calendar dates; null when either is missing. */
function daysBetween(from: string | undefined, to: string | undefined): number | null {
  if (!from || !to) return null;
  const a = Date.parse(`${from}T00:00:00.000Z`);
  const b = Date.parse(`${to}T00:00:00.000Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.round((b - a) / 86_400_000);
}

/* ── Add to my calendar ───────────────────────────────────────────────────── */

const icsText = (value: string) => value.replace(/[\\;,]/g, (c) => `\\${c}`).replace(/\r?\n/g, "\\n");

/**
 * An all-day event for the day itself, built in the browser from facts the
 * page already shows. Nothing is requested from a server, so the public page
 * still cannot report who looked at it.
 */
function calendarFile(timeline: AudienceTimelineDto): string | null {
  const day = timeline.primaryDate;
  if (!day) return null;
  const start = day.date.replaceAll("-", "");
  const next = new Date(Date.parse(`${day.date}T00:00:00.000Z`) + 86_400_000).toISOString().slice(0, 10).replaceAll("-", "");
  const stamp = new Date(Date.parse(timeline.lastUpdatedAt) || 0).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Signal Studio//Timeline//EN",
    "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    `UID:${timeline.publicationId}-${start}@timeline.signalstudio.ie`,
    `DTSTAMP:${stamp}`,
    `DTSTART;VALUE=DATE:${start}`,
    `DTEND;VALUE=DATE:${next}`,
    `SUMMARY:${icsText(`${timeline.label}: ${day.label}`)}`,
    "END:VEVENT",
    "END:VCALENDAR",
    "",
  ].join("\r\n");
}

function CalendarButton({ timeline, className }: { timeline: AudienceTimelineDto; className?: string }) {
  const file = calendarFile(timeline);
  if (!file) return null;
  return (
    <button
      type="button"
      className={[styles.pillButton, className].filter(Boolean).join(" ")}
      onClick={() => {
        const url = URL.createObjectURL(new Blob([file], { type: "text/calendar;charset=utf-8" }));
        const link = document.createElement("a");
        link.href = url;
        link.download = `${timeline.label.replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-|-$/g, "").toLowerCase() || "timeline"}.ics`;
        document.body.append(link);
        link.click();
        link.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      }}
    >
      <svg viewBox="0 0 16 16" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
        <rect x="2.25" y="3.25" width="11.5" height="10.5" rx="1.75" />
        <path d="M2.25 6.5h11.5M5.5 2v2.5M10.5 2v2.5" />
      </svg>
      Add to my calendar
    </button>
  );
}

/* ── Product header ───────────────────────────────────────────────────────── */

function useShare(onShare: TimelineArtifactProps["onShare"]) {
  const [state, setState] = useState<"idle" | "working" | "copied" | "error">("idle");
  const revertTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (revertTimer.current) clearTimeout(revertTimer.current);
  }, []);
  const settle = (next: "idle" | "copied" | "error") => {
    setState(next);
    if (revertTimer.current) clearTimeout(revertTimer.current);
    if (next === "copied" || next === "error") {
      // Receipts rest: the label returns to its verb once the moment passes,
      // failure lingering a little longer than success.
      revertTimer.current = setTimeout(() => setState("idle"), next === "copied" ? 2000 : 5000);
    }
  };
  const run = async () => {
    if (!onShare) return;
    setState("working");
    try {
      const outcome = await onShare();
      settle(outcome === "copied" ? "copied" : "idle");
    } catch {
      settle("error");
    }
  };
  return { state, run };
}

function ShareButton({
  onShare,
  shareLabel,
  className,
}: Pick<TimelineArtifactProps, "onShare" | "shareLabel"> & { className?: string }) {
  const share = useShare(onShare);
  if (!onShare) return null;
  return (
    <>
      <button
        type="button"
        className={className}
        data-share-state={share.state}
        disabled={share.state === "working"}
        onClick={share.run}
      >
        {share.state === "copied"
          ? "Link copied"
          : share.state === "error"
            ? "Copy from the address bar"
            : shareLabel ?? "Share this timeline"}
      </button>
      <span className={styles.screenReaderOnly} aria-live="polite" aria-atomic="true">
        {share.state === "copied" ? "Timeline link copied." : null}
        {share.state === "error" ? "The link could not be shared. Copy it from the address bar." : null}
      </span>
    </>
  );
}

function ProductIdentity({
  timeline,
  onShare,
  shareLabel,
}: Pick<TimelineArtifactProps, "timeline" | "onShare" | "shareLabel">) {
  return (
    <div className={styles.productHeader}>
      <span className={styles.productMark} aria-label="timeline" data-timeline-wordmark>
        timeline<span aria-hidden="true" />
      </span>
      <div className={styles.productMeta}>
        <span>{timeline.ownerDisplayLabel ?? "Shared timeline"}</span>
        <ShareButton onShare={onShare} shareLabel={shareLabel} className={styles.textButton} />
      </div>
    </div>
  );
}

/* ── Hero: the count, the day, what is next ───────────────────────────────── */

function Hero({ timeline, model, nouns }: { timeline: AudienceTimelineDto; model: TimelineArtifactModel; nouns: ReturnType<typeof timelineNouns> }) {
  const day = timeline.primaryDate;
  const countdown = buildTimelineCountdown(day?.date, timeline.today);
  const next = model.points.find((point) => point.isNext) ?? null;
  const nextIn = next?.item.date ? daysBetween(timeline.today, next.item.date) : null;
  const dayName = day?.label.toLowerCase() ?? "";
  const completion = `${model.completedCount} of ${model.totalCount} complete`;

  // A plan with a day counts down to it. A plan without one leads with what is
  // done, stated as one count rather than a percentage.
  let value: string;
  let unit: string;
  let spoken: string;
  if (day && countdown?.kind === "future") {
    value = String(countdown.days);
    unit = `${plural(countdown.days, "day", "days")} until the ${dayName}`;
    spoken = `${countdown.days} ${plural(countdown.days, "day", "days")} until the ${dayName}`;
  } else if (day && countdown?.kind === "today") {
    value = "Today";
    unit = `is the ${dayName}`;
    spoken = `Today is the ${dayName}`;
  } else if (day && countdown?.kind === "past") {
    value = String(countdown.days);
    unit = `${plural(countdown.days, "day", "days")} since the ${dayName}`;
    spoken = `${countdown.days} ${plural(countdown.days, "day", "days")} since the ${dayName}`;
  } else {
    value = String(model.completedCount);
    unit = `of ${model.totalCount} ${plural(model.totalCount, "milestone", "milestones")} complete`;
    spoken = `${model.completedCount} of ${model.totalCount} milestones complete`;
  }

  return (
    <div className={styles.hero}>
      <p className={styles.heroKicker}>{nouns.kicker}</p>
      <h1>{timeline.label}</h1>
      <div className={styles.count} data-timeline-metric data-count-kind={countdown?.kind ?? "progress"} role="group" aria-label={spoken}>
        <strong className={styles.countValue} data-scale={value.length >= 4 ? "long" : undefined} aria-hidden="true" data-timeline-metric-value>
          {value}
        </strong>
        <span className={styles.countUnit} aria-hidden="true">{unit}</span>
      </div>
      <div className={styles.heroLine}>
        <p className={styles.heroFacts}>
          {day ? (
            <>
              <time dateTime={day.date}>{weekdayDate(day.date)}</time>
              <span aria-hidden="true"> · </span>
            </>
          ) : null}
          <span>{completion}</span>
        </p>
        <CalendarButton timeline={timeline} />
      </div>
      {next ? (
        <p className={styles.nextUp} data-state={next.state}>
          <span className={styles.nextLabel}>{timelinePointStatus(next)}</span>
          <a href={`#m-${next.item.publicId}`} className={styles.nextTitle}>{next.item.title}</a>
          <span className={styles.nextWhen}>
            {next.item.date ? formatTimelineDate(next.item.date, "long") : NO_TIMING_LABEL}
            {nextIn !== null && nextIn > 0 ? `, in ${nextIn} ${plural(nextIn, "day", "days")}` : nextIn === 0 ? ", today" : ""}
          </span>
        </p>
      ) : null}
    </div>
  );
}

/* ── A · the strip: the whole run of time, to scale ───────────────────────── */

function Strip({ timeline, model, finaleId }: { timeline: AudienceTimelineDto; model: TimelineArtifactModel; finaleId: string }) {
  if (model.axis.mode !== "dated" || model.points.length < 2) return null;
  const next = model.points.find((point) => point.isNext);
  const last = model.points[model.points.length - 1];
  const align = (position: number) => (position < 14 ? "start" : position > 86 ? "end" : "middle");
  const destination = timeline.primaryDate && last.item.date === timeline.primaryDate.date ? last : null;
  const at = (position: number): PositionStyle => ({ "--at": `${position}%` });

  return (
    <figure className={styles.strip} aria-label={timelineAxisDescription(model)}>
      <div className={styles.stripTrack}>
        <div
          className={styles.stripLine}
          role="progressbar"
          aria-label="Milestone completion"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(model.completedFrontier ?? 0)}
          aria-valuetext={`${model.completedCount} of ${model.totalCount} milestones complete`}
        >
          {/* The ink runs to the furthest completed dot, never to a count
              percentage, so the line and the dots make one statement. */}
          <span className={styles.stripInk} style={{ transform: `scaleX(${(model.completedFrontier ?? 0) / 100})` }} aria-hidden="true" />
        </div>
        {model.monthTicks.map((tick) => (
          <span className={styles.stripMonth} key={`${tick.label}-${tick.position}`} style={at(tick.position)} aria-hidden="true">
            <span>{tick.label}</span>
          </span>
        ))}
        {model.todayPosition !== null ? (
          <span className={styles.stripToday} data-today-marker style={at(model.todayPosition)} role="img" aria-label={`Today, ${formatTimelineDate(timeline.today, "long")}`}>
            <span aria-hidden="true">Today</span>
          </span>
        ) : null}
        {model.points.map((point) => {
          const isDestination = point === destination;
          return (
            <a
              key={point.item.publicId}
              className={styles.stripDot}
              href={isDestination ? `#${finaleId}` : `#m-${point.item.publicId}`}
              data-state={point.state}
              data-next={point.isNext ? "true" : undefined}
              data-destination={isDestination ? "true" : undefined}
              style={at(point.position)}
              aria-label={`${point.item.title}, ${point.item.date ? formatTimelineDate(point.item.date, "long") : NO_TIMING_LABEL}`}
            />
          );
        })}
        {next ? (
          <span className={styles.stripLabel} data-align={align(next.position)} data-kind="next" style={at(next.position)} aria-hidden="true">
            <small>Next</small>
            {next.item.title}
          </span>
        ) : null}
        {destination && destination !== next ? (
          <span className={styles.stripLabel} data-align="end" data-kind="destination" style={at(destination.position)} aria-hidden="true">
            <small>{formatTimelineDate(destination.item.date ?? "")}</small>
            {destination.item.title}
          </span>
        ) : null}
      </div>
    </figure>
  );
}

/* ── B · the rows: every moment with its own number ───────────────────────── */

function RowFigure({ point, today }: { point: TimelineArtifactPoint; today: string }) {
  if (point.state === "complete") {
    return (
      <span className={styles.rowFigure} data-kind="done">
        <small>Done</small>
      </span>
    );
  }
  const days = point.item.date ? daysBetween(today, point.item.date) : null;
  if (days === null) {
    return (
      <span className={styles.rowFigure} data-kind="undated">
        <strong aria-hidden="true">–</strong>
        <small>{NO_TIMING_LABEL}</small>
      </span>
    );
  }
  if (days === 0) {
    return (
      <span className={styles.rowFigure} data-kind="today">
        <strong>Today</strong>
      </span>
    );
  }
  if (days < 0) {
    return (
      <span className={styles.rowFigure} data-kind="late">
        <strong>{-days}</strong>
        <small>{plural(-days, "day late", "days late")}</small>
      </span>
    );
  }
  return (
    <span className={styles.rowFigure} data-kind="ahead">
      <strong>{days}</strong>
      <small>{plural(days, "day", "days")}</small>
    </span>
  );
}

/** "2 weeks later", said between two moments when the wait is worth noticing. */
function gapWords(from: string | undefined, to: string | undefined): string | null {
  const gap = daysBetween(from, to);
  if (gap === null || gap < 10) return null;
  const weeks = Math.round(gap / 7);
  return `${weeks} ${plural(weeks, "week", "weeks")} later`;
}

function Rows({
  heading,
  timeline,
  model,
  sectionId,
  destinationId,
}: {
  heading: string;
  timeline: AudienceTimelineDto;
  model: TimelineArtifactModel;
  sectionId: string;
  destinationId: string | null;
}) {
  const points = model.points.filter((point) => point.item.publicId !== destinationId);
  const done = points.filter((point) => point.state === "complete");
  const ahead = points.filter((point) => point.state !== "complete");
  const total = model.points.length;
  const ordinal = (point: TimelineArtifactPoint) => model.points.indexOf(point) + 1;

  const row = (point: TimelineArtifactPoint, index: number, previous: TimelineArtifactPoint | null) => {
    const status = timelinePointStatus(point);
    const gap = previous && point.state !== "complete" ? gapWords(previous.item.date, point.item.date) : null;
    const rowStyle: RowStyle = { "--row-delay": `${Math.min(80 + index * 40, 440)}ms` };
    const timing = point.item.date ? formatTimelineDate(point.item.date, "long") : NO_TIMING_LABEL;
    return (
      <li
        key={point.item.publicId}
        id={`m-${point.item.publicId}`}
        className={styles.row}
        data-state={point.state}
        data-next={point.isNext ? "true" : undefined}
        style={rowStyle}
        aria-current={point.isNext ? "step" : undefined}
        aria-label={`${point.item.title}. ${status}. ${timing}. ${milestonePlace(ordinal(point), total)}.`}
      >
        {gap ? <span className={styles.gap} aria-hidden="true">{gap}</span> : null}
        <span className={styles.pin} aria-hidden="true">
          {point.state === "complete" ? (
            <svg viewBox="0 0 16 16" width="16" height="16">
              <circle cx="8" cy="8" r="7" fill="currentColor" />
              <path d="M5 8.3 7.1 10.4 11 6" fill="none" stroke="var(--paper)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          ) : null}
        </span>
        <span aria-hidden="true" className={styles.rowFigureCell}>
          <RowFigure point={point} today={timeline.today} />
        </span>
        <span className={styles.rowText} aria-hidden="true">
          {point.isNext || point.state === "overdue" ? <span className={styles.rowStatus}>{status}</span> : null}
          <span className={styles.rowTitle}>{point.item.title}</span>
        </span>
        <span className={styles.rowDate} aria-hidden="true">
          {point.item.date ? <time dateTime={point.item.date}>{formatTimelineDate(point.item.date, "long")}</time> : NO_TIMING_LABEL}
        </span>
      </li>
    );
  };

  return (
    <section className={styles.moments} id={sectionId} aria-labelledby={`${sectionId}-title`}>
      <h2 className={styles.screenReaderOnly} id={`${sectionId}-title`}>{heading}</h2>
      {points.length === 0 ? (
        <p className={styles.empty}>
          <strong>No milestones shared yet.</strong>
          <span>Milestones will appear here when they are ready.</span>
        </p>
      ) : (
        <>
          {done.length ? (
            <ol className={styles.list} data-part="done" aria-label="Complete">
              {done.map((point, index) => row(point, index, null))}
            </ol>
          ) : null}
          {model.todayPosition !== null || done.length ? (
            <p className={styles.todayRule} data-today-marker>
              <span className={styles.todayDot} aria-hidden="true" />
              <span>Today</span>
              <time dateTime={timeline.today}>{weekdayDate(timeline.today)}</time>
            </p>
          ) : null}
          {ahead.length ? (
            <ol className={styles.list} data-part="ahead" aria-label="Still to come">
              {ahead.map((point, index) => row(point, done.length + index, index ? ahead[index - 1] : null))}
            </ol>
          ) : null}
        </>
      )}
      {model.axis.mode === "ordered" && points.length > 1 ? (
        <p className={styles.axisNote}>Shown in order. Some timings are not set yet.</p>
      ) : null}
    </section>
  );
}

/* ── D · the finale: the day itself ───────────────────────────────────────── */

function Finale({
  timeline,
  id,
  onShare,
  shareLabel,
}: Pick<TimelineArtifactProps, "timeline" | "onShare" | "shareLabel"> & { id: string }) {
  const day = timeline.primaryDate;
  if (!day) return null;
  const countdown = buildTimelineCountdown(day.date, timeline.today);
  const line = countdown?.kind === "future"
    ? `${countdown.days} ${plural(countdown.days, "day", "days")} to go.`
    : countdown?.kind === "today"
      ? "It is today."
      : countdown?.kind === "past"
        ? `${countdown.days} ${plural(countdown.days, "day", "days")} ago.`
        : null;
  return (
    <section className={styles.finale} id={id} aria-labelledby={`${id}-title`}>
      <p className={styles.finaleDate}>
        <time dateTime={day.date}>{weekdayDate(day.date)}</time>
      </p>
      <h2 className={styles.finaleTitle} id={`${id}-title`}>The {day.label.toLowerCase()}</h2>
      {line ? <p className={styles.finaleLine}>{line}</p> : null}
      <div className={styles.finaleActions}>
        {countdown?.kind !== "past" ? <CalendarButton timeline={timeline} /> : null}
        <ShareButton onShare={onShare} shareLabel={shareLabel} className={styles.pillButton} />
      </div>
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
  const nouns = timelineNouns(timeline.audienceKind);
  const sectionId = `${reactId}-timeline`;
  const finaleId = `${reactId}-day`;
  // The day itself closes the page as the finale, so when it is also published
  // as a milestone it is not listed a second time among the rows.
  const last = model.points[model.points.length - 1];
  const destinationId = timeline.primaryDate && last?.item.date === timeline.primaryDate.date ? last.item.publicId : null;

  const artifactRef = useRef<HTMLElement | null>(null);
  useLayoutEffect(() => markEntranceSeen(artifactRef.current), []);

  return (
    <article
      ref={artifactRef}
      // ENTRANCE_GUARD writes data-entrance and data-entrance-guard onto this
      // element before hydration; CSS reads them, so they cannot move to a
      // property, and React is told not to report the difference.
      suppressHydrationWarning
      className={[styles.artifact, className].filter(Boolean).join(" ")}
      data-timeline-artifact
      data-compact={compact ? "true" : undefined}
      data-embedded={embedded ? "true" : undefined}
      data-density={model.density}
      data-axis={model.axis.mode}
      data-title-length={artifactTitleLength(timeline.label)}
    >
      <script dangerouslySetInnerHTML={{ __html: ENTRANCE_GUARD }} />
      <a className={styles.skipLink} href={`#${sectionId}`}>Skip to timeline</a>
      <header className={styles.header}>
        {showProductHeader ? <ProductIdentity timeline={timeline} onShare={onShare} shareLabel={shareLabel} /> : null}
        <Hero timeline={timeline} model={model} nouns={nouns} />
      </header>

      <Strip timeline={timeline} model={model} finaleId={finaleId} />
      <Rows heading={nouns.heading} timeline={timeline} model={model} sectionId={sectionId} destinationId={destinationId} />
      <Finale timeline={timeline} id={finaleId} onShare={onShare} shareLabel={shareLabel} />
      <PlanningDecisions timeline={timeline} model={model} />

      <footer className={styles.footer}>
        <span>Updated {formatTimelineDate(timeline.lastUpdatedAt.slice(0, 10))}</span>
        {/* The artifact is the product's own advertisement, and the
            attribution walks. The /s tree already sends no-referrer, so the
            bearer URL stays put. */}
        <a className={styles.footerLink} href={`${PRODUCT_MARKETING_URLS.timeline}?src=shared-timeline`} target="_blank" rel="noopener">
          <span className={styles.footerMark} aria-hidden="true">timeline<span /></span>
          Made with Signal Timeline · Make one for your day
        </a>
      </footer>
    </article>
  );
}

