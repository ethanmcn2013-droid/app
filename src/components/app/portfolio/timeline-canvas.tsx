"use client";

/**
 * The one canvas both Timeline altitudes draw on (v3, round 2).
 *
 * All projects (a bar per Project) and a plan's runway (a diamond per
 * milestone) are the same instrument at two zoom levels, so they share one
 * renderer: a scroll container with a sticky axis, a past wash up to today,
 * weekend shading at Weeks, tick lines, and the Today line. Rows and marks
 * are children, absolutely positioned on the same scale.
 *
 * FIRST PAINT, WITHOUT A JUMP (spec 5.6). The server renders the full range
 * and a tiny inline script right after the scroller. Before the browser
 * paints, the script reads numbers the server computed (the x of today, the
 * width of the range, the alignment) from `data-` attributes and sets
 * `scrollLeft`, so the first frame already has the Today line 30% from the
 * left (or 24px from it on a phone). A layout effect repeats the same
 * assignment after hydration, which also covers client navigations, where
 * no script runs. If the script were ever removed, the canvas layers stay at
 * opacity 0 until the effect marks the scroller ready, so nobody ever sees
 * the wrong months. The script embeds no request input: only numbers.
 *
 * In `fit` mode (the plan runway on desktop) nothing scrolls: the range fits
 * the width and every position is a percentage, so the server's first paint
 * is right at any width.
 */

import {
  forwardRef,
  useCallback,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import {
  dayToX,
  diffDays,
  formatShortDay,
  initialScrollLeft,
  rangeWidth,
  ticks as axisTicks,
  weekendSpans,
  xToDay,
  type TimeRange,
  type Zoom,
} from "@/lib/projects/project-portfolio-scale";
import { prefersReducedMotion, useHydrated } from "./timeline-ui";
import styles from "./timeline-canvas.module.css";

export type TimelineCanvasHandle = Readonly<{
  /** Scroll so the day sits `align` of the way across (default 0.3). */
  scrollToDay: (iso: string, options?: { align?: number; smooth?: boolean }) => void;
  /** The day at the centre of what is visible now. */
  centreDay: () => string;
  /** The day under a viewport x, or null outside the canvas. */
  dayAtClientX: (clientX: number) => string | null;
  element: () => HTMLDivElement | null;
}>;

type Props = Readonly<{
  range: TimeRange;
  ppd: number;
  zoom: Zoom;
  todayIso: string;
  /** The sticky left cell of the axis row (the name column's heading). */
  headLeft?: ReactNode;
  /** Where today lands on first paint: a share of the visible width… */
  align?: number;
  /** …or a fixed distance from the left edge, in px (phones). */
  alignPx?: number;
  /** Fit the range to the width: no horizontal scroll, positions in %. */
  fit?: boolean;
  /** Axis ticks: defaults to the zoom's own. */
  tickZoom?: Zoom;
  /** Draw the axis row. */
  axis?: boolean;
  className?: string;
  scrollerClassName?: string;
  style?: CSSProperties;
  /** Layers drawn above the background, inside the scrolled content. */
  children?: ReactNode;
  /** Overlays that do not scroll (docked controls, a pinned card). */
  overlay?: ReactNode;
  onScroll?: () => void;
  onPointerDown?: React.PointerEventHandler<HTMLDivElement>;
  onPointerMove?: React.PointerEventHandler<HTMLDivElement>;
  onPointerUp?: React.PointerEventHandler<HTMLDivElement>;
  onPointerCancel?: React.PointerEventHandler<HTMLDivElement>;
  onWheel?: React.WheelEventHandler<HTMLDivElement>;
  onResize?: (canvasWidth: number) => void;
}>;

/**
 * One line, inlined verbatim; reads only the scroller's own data attributes.
 * A streamed page arrives inside a hidden boundary and is swapped in later,
 * so the script waits (one animation frame at a time, before each paint)
 * until the scroller has a width, then places today and marks it ready.
 */
const FIRST_PAINT_SCRIPT =
  "(function(){var s=document.currentScript,e=s&&s.previousElementSibling;if(!e)return;var n=0;function go(){if(e.hasAttribute('data-ready'))return;try{var l=e.querySelector('[data-canvas-left]'),L=l?l.offsetWidth:0,w=e.clientWidth-L;if(!(w>0)){if(n++<300)requestAnimationFrame(go);return}var x=+e.getAttribute('data-today-x'),t=+e.getAttribute('data-total'),p=e.getAttribute('data-align-px'),a=p?+p:+e.getAttribute('data-align')*w;if(x===x)e.scrollLeft=Math.max(0,Math.min(t-w,Math.round(x-a)))}catch(_){}e.setAttribute('data-ready','')}go()})()";

export const TimelineCanvas = forwardRef<TimelineCanvasHandle, Props>(function TimelineCanvas(
  {
    range,
    ppd,
    zoom,
    todayIso,
    headLeft,
    align = 0.3,
    alignPx,
    fit = false,
    tickZoom,
    axis = true,
    className,
    scrollerClassName,
    style,
    children,
    overlay,
    onScroll,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerCancel,
    onWheel,
    onResize,
  },
  ref,
) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const hydrated = useHydrated();
  const width = rangeWidth(range, ppd);
  const todayInRange = diffDays(range.start, todayIso) >= 0 && todayIso <= range.end;
  const todayX = dayToX(todayIso, range, ppd) + ppd / 2;
  const at = (px: number) => (fit ? `${(px / width) * 100}%` : `${px}px`);
  const [dock, setDock] = useState<"left" | "right" | null>(null);
  const [measured, setMeasured] = useState(0);
  // How far the canvas is scrolled, so an axis label whose text would start
  // under the sticky name column is left out rather than shown clipped.
  const [scrollX, setScrollX] = useState(0);

  const leftWidth = useCallback(
    () => scrollerRef.current?.querySelector<HTMLElement>("[data-canvas-left]")?.offsetWidth ?? 0,
    [],
  );
  const canvasWidth = useCallback(() => {
    const el = scrollerRef.current;
    return el ? el.clientWidth - leftWidth() : 0;
  }, [leftWidth]);

  const alignFor = useCallback(
    (w: number, fraction?: number) => (fraction !== undefined ? fraction : alignPx !== undefined && w > 0 ? alignPx / w : align),
    [align, alignPx],
  );

  const updateDock = useCallback(() => {
    const el = scrollerRef.current;
    if (!el || fit || !todayInRange) return;
    const w = canvasWidth();
    const next = todayX < el.scrollLeft + 6 ? "left" : todayX > el.scrollLeft + w - 6 ? "right" : null;
    setDock((current) => (current === next ? current : next));
  }, [canvasWidth, fit, todayInRange, todayX]);

  const scrollToDay = useCallback(
    (iso: string, options?: { align?: number; smooth?: boolean }) => {
      const el = scrollerRef.current;
      if (!el || fit) return;
      const w = canvasWidth();
      el.scrollTo({
        left: initialScrollLeft(range, ppd, iso, w, alignFor(w, options?.align)),
        behavior: options?.smooth && !prefersReducedMotion() ? "smooth" : "auto",
      });
    },
    [alignFor, canvasWidth, fit, ppd, range],
  );

  useImperativeHandle(
    ref,
    () => ({
      scrollToDay,
      centreDay: () => {
        const el = scrollerRef.current;
        if (!el) return todayIso;
        return xToDay(el.scrollLeft + canvasWidth() / 2, range, ppd);
      },
      dayAtClientX: (clientX: number) => {
        const el = scrollerRef.current;
        if (!el) return null;
        const box = el.getBoundingClientRect();
        const x = clientX - box.left - leftWidth() + el.scrollLeft;
        if (x < 0 || x > width) return null;
        return xToDay(fit ? (x / el.clientWidth) * width : x, range, ppd);
      },
      element: () => scrollerRef.current,
    }),
    [canvasWidth, fit, leftWidth, ppd, range, scrollToDay, todayIso, width],
  );

  // After hydration (and on every client navigation, where no inline script
  // runs), place today exactly as the script did, then mark the canvas ready.
  // It runs again only if the canvas switches between fitting and scrolling
  // (the plan runway becomes a scroller on a phone).
  const placedMode = useRef<boolean | null>(null);
  useLayoutEffect(() => {
    const el = scrollerRef.current;
    if (!el || placedMode.current === fit) return;
    placedMode.current = fit;
    if (!fit) {
      const w = canvasWidth();
      el.scrollLeft = initialScrollLeft(range, ppd, todayIso, w, alignFor(w));
    }
    el.setAttribute("data-ready", "");
    // Only placement belongs here; later scrolls are the page's.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fit]);

  // Width changes: report the canvas width (All projects stretches a short
  // range to fill it) and re-check whether today is in view.
  useLayoutEffect(() => {
    const el = scrollerRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => {
      const w = canvasWidth();
      setMeasured(w);
      setScrollX(el.scrollLeft);
      onResize?.(w);
      updateDock();
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [canvasWidth, onResize, updateDock]);

  const scrollFrame = useRef(0);
  function handleScroll() {
    onScroll?.();
    if (scrollFrame.current) return;
    scrollFrame.current = requestAnimationFrame(() => {
      scrollFrame.current = 0;
      if (!fit && scrollerRef.current) setScrollX(scrollerRef.current.scrollLeft);
      updateDock();
    });
  }

  const tickList = axisTicks(range, tickZoom ?? zoom);
  // On screen, the Today pill owns the few pixels around it: a month label
  // that would sit under it is left out rather than half covered.
  const screenScale = fit ? (measured || 1000) / width : 1;
  const underPill = (x: number) =>
    (todayInRange && (todayX - x) * screenScale < 78 && (x - todayX) * screenScale < 40) ||
    // Scrolled under the sticky name column: hidden, never half shown.
    (!fit && headLeft !== undefined && scrollX > 0 && x + 6 < scrollX);
  const showWeekends = (tickZoom ?? zoom) === "weeks";
  const todayLabel = `Today ${formatShortDay(todayIso)}`;

  return (
    <div className={className ? `${styles.frame} ${className}` : styles.frame} style={style} data-fit={fit ? "" : undefined}>
      <div
        ref={scrollerRef}
        className={scrollerClassName ? `${styles.scroller} ${scrollerClassName}` : styles.scroller}
        data-timeline-canvas=""
        data-today-x={Math.round(todayX)}
        data-total={Math.round(width)}
        data-align={alignPx === undefined ? align : undefined}
        data-align-px={alignPx}
        data-ready={fit ? "" : undefined}
        suppressHydrationWarning
        onScroll={handleScroll}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
        onWheel={onWheel}
      >
        <div className={styles.inner} style={{ width: fit ? "100%" : `calc(var(--tl-left-w, 0px) + ${width}px)` }}>
          {axis ? (
            <div className={styles.head}>
              {headLeft !== undefined ? (
                <div className={styles.headLeft} data-canvas-left="">
                  {headLeft}
                </div>
              ) : null}
              <div className={styles.axis} aria-hidden="true" style={{ width: fit ? undefined : width }}>
                {tickList.map((tick) =>
                  tick.kind === "major" ? (
                    <span key={tick.day} className={styles.tick} style={{ left: at(dayToX(tick.day, range, ppd)) }}>
                      <span className={styles.tickYear}>{underPill(dayToX(tick.day, range, ppd)) ? "" : (tick.year ?? "")}</span>
                      <span className={styles.tickLabel}>{underPill(dayToX(tick.day, range, ppd)) ? "" : tick.label}</span>
                    </span>
                  ) : (
                    <span key={tick.day} className={styles.tickMinor} style={{ left: at(dayToX(tick.day, range, ppd)) }}>
                      {underPill(dayToX(tick.day, range, ppd)) ? "" : tick.label}
                    </span>
                  ),
                )}
                {todayInRange ? (
                  <span className={styles.todayPill} data-edge={alignPx !== undefined && alignPx < 80 ? "" : undefined} style={{ left: at(todayX) }}>
                    {todayLabel}
                  </span>
                ) : null}
              </div>
            </div>
          ) : headLeft !== undefined ? (
            <div className={styles.headLeftOnly} data-canvas-left="">
              {headLeft}
            </div>
          ) : null}

          <div className={styles.layer} aria-hidden="true" style={{ width: fit ? undefined : width }} data-canvas-layer="">
            {todayInRange ? <span className={styles.wash} style={{ width: at(todayX) }} /> : null}
            {showWeekends
              ? weekendSpans(range).map((span) => (
                  <span
                    key={span.start}
                    className={styles.weekend}
                    style={{ left: at(dayToX(span.start, range, ppd)), width: at(span.days * ppd) }}
                  />
                ))
              : null}
            {tickList.map((tick) => (
              <span
                key={tick.day}
                className={styles.line}
                data-minor={tick.kind === "minor" ? "" : undefined}
                style={{ left: at(dayToX(tick.day, range, ppd)) }}
              />
            ))}
            {todayInRange ? <span className={styles.todayLine} style={{ left: at(todayX) }} /> : null}
          </div>

          {children}
        </div>
      </div>
      {/* Server render and hydration only: a client navigation renders no
          script (it would never run), and the layout effect places it. */}
      {!hydrated ? <script dangerouslySetInnerHTML={{ __html: FIRST_PAINT_SCRIPT }} /> : null}
      {dock ? (
        <button
          type="button"
          className={styles.dock}
          data-side={dock}
          onClick={() => scrollToDay(todayIso, { smooth: true })}
          aria-label={`Scroll back to today, ${formatShortDay(todayIso)}`}
        >
          {dock === "left" ? (
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M12.5 8h-9m3.5-3.5L3.5 8 7 11.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          ) : null}
          {todayLabel}
          {dock === "right" ? (
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M3.5 8h9m-3.5-3.5L12.5 8 9 11.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          ) : null}
        </button>
      ) : null}
      {overlay}
    </div>
  );
});
