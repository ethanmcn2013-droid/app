"use client";

import { type PointerEvent as RPointerEvent, type RefObject, useEffect, useLayoutEffect, useRef } from "react";
import { Check } from "./icons";
import { cx, dayNum, isMonday, monthName, short, TODAY_DAY, type KitView } from "./model";
import r from "./ribbon.module.css";

type Pt = [number, number];

/** Column offsets in the kit track paired with their dates. */
function anchors(sc: HTMLElement, start: number, end: number): Pt[] {
  const cols = Array.from(sc.querySelectorAll<HTMLElement>("[data-col-day]"));
  const pts: Pt[] = [[0, start]];
  for (const c of cols) {
    const x = c.offsetLeft;
    const d = Number(c.dataset.colDay);
    const last = pts[pts.length - 1];
    if (x > last[0] && d > last[1]) pts.push([x, d]);
  }
  pts.push([Math.max(sc.scrollWidth, pts[pts.length - 1][0] + 1), end]);
  return pts;
}

function dayAt(pts: Pt[], x: number) {
  for (let i = 1; i < pts.length; i++) {
    const [x0, d0] = pts[i - 1];
    const [x1, d1] = pts[i];
    if (x <= x1) return d0 + ((x - x0) / (x1 - x0 || 1)) * (d1 - d0);
  }
  return pts[pts.length - 1][1];
}

function xAt(pts: Pt[], d: number) {
  for (let i = 1; i < pts.length; i++) {
    const [x0, d0] = pts[i - 1];
    const [x1, d1] = pts[i];
    if (d <= d1) return x0 + ((d - d0) / (d1 - d0 || 1)) * (x1 - x0);
  }
  return pts[pts.length - 1][0];
}

function PinMark({ kit, major }: { kit: KitView; major?: boolean }) {
  const frac = kit.r.total ? kit.r.ready / kit.r.total : 0;
  const size = major ? 20 : 16;
  const rad = size / 2 - 2;
  const circ = 2 * Math.PI * rad;
  if (kit.tone === "set" || kit.tone === "done") {
    return (
      <span className={cx(r.pinDot, major && r.pinMajor)} data-tone={kit.tone}>
        <Check size={major ? 12 : 10} strokeWidth={2.4} />
      </span>
    );
  }
  return (
    <svg className={cx(r.pinRing, major && r.pinMajor)} data-tone={kit.tone} width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
      <circle cx={size / 2} cy={size / 2} r={rad} className={r.ringTrack} />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={rad}
        className={r.ringArc}
        strokeDasharray={`${circ * frac} ${circ}`}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
    </svg>
  );
}

/* ── Label layout ─────────────────────────────────────────────────────
   Labels sit in up to three rows above the axis. Each goes in the lowest
   row where it clears its neighbours, where no other stem runs through it
   and where its own stem clears the labels below. If nothing fits, it
   takes the widest free slot and truncates, showing in full on hover.
   Written straight to the DOM: it reruns on every resize. */

const ROW_H = 41;
const GAP = 14;
const PAD = 18; // the ribbon's side padding, which labels may use
const MIN_W = 76;
const MAX_ROWS = 3;

type Placed = { row: number; x0: number; x1: number; pin: number };
type Option = { row: number; x0: number; x1: number; full: boolean; width: number };

function place(pin: number, w: number, W: number, placed: Placed[], avoid: number[]): Option | null {
  const options: Option[] = [];
  for (let row = 0; row < MAX_ROWS; row++) {
    // My stem must clear every label in a lower row.
    if (placed.some((p) => p.row < row && pin >= p.x0 - 3 && pin <= p.x1 + 3)) continue;
    const same = placed.filter((p) => p.row === row);
    // Stems of higher labels, and the Today line, must not run through me.
    const lines = [...placed.filter((p) => p.row > row).map((p) => p.pin), ...avoid];
    for (const align of ["left", "right"] as const) {
      if (align === "left") {
        const x0 = pin - 12;
        if (x0 < -PAD) continue;
        if (same.some((p) => p.x0 <= x0 && p.x1 + GAP > x0)) continue;
        if (lines.some((s) => Math.abs(s - x0) < 6)) continue;
        let limit = W + PAD;
        for (const p of same) if (p.x0 > x0) limit = Math.min(limit, p.x0 - GAP);
        for (const s of lines) if (s > x0) limit = Math.min(limit, s - 8);
        const width = Math.min(w, limit - x0);
        if (width >= MIN_W) options.push({ row, x0, x1: x0 + width, full: width >= w, width });
      } else {
        const x1 = pin + 12;
        if (x1 > W + PAD) continue;
        if (same.some((p) => p.x1 >= x1 && p.x0 - GAP < x1)) continue;
        if (lines.some((s) => Math.abs(s - x1) < 6)) continue;
        let limit = -PAD;
        for (const p of same) if (p.x1 < x1) limit = Math.max(limit, p.x1 + GAP);
        for (const s of lines) if (s < x1) limit = Math.max(limit, s + 8);
        const width = Math.min(w, x1 - limit);
        if (width >= MIN_W) options.push({ row, x0: x1 - width, x1, full: width >= w, width });
      }
    }
  }
  // Lowest row that shows the whole label, left-aligned first; else the widest slot.
  const full = options.find((o) => o.full);
  if (full) return full;
  const best = [...options].sort((a, b) => b.width - a.width)[0];
  return best ?? null;
}

/** Places a label; if every slot is blocked by a lower label under its stem, trims that label and tries again. */
function placeOrTrim(pin: number, w: number, W: number, placed: (Placed & { truncated: boolean })[], avoid: number[]): Option {
  for (let attempt = 0; attempt < 3; attempt++) {
    const o = place(pin, w, W, placed, avoid);
    if (o) return o;
    const blocker = placed
      .filter((p) => pin >= p.x0 - 3 && pin <= p.x1 + 3 && p.x1 - p.pin >= 20 && pin - 10 - p.x0 >= MIN_W)
      .sort((a, b) => a.row - b.row)[0];
    if (!blocker) break;
    blocker.x1 = pin - 10;
    blocker.truncated = true;
  }
  const width = Math.min(w, 120);
  const x0 = Math.min(pin - 12, W + PAD - width);
  return { row: MAX_ROWS - 1, x0, x1: x0 + width, full: false, width };
}

type Props = {
  kits: KitView[];
  scrollerRef: RefObject<HTMLDivElement | null>;
  onJump: (id: string) => void;
  hovered: string | null;
  onHover: (id: string | null) => void;
  dimmed: Set<string>;
  nextId: string | null;
  tone: number;
  reduced: boolean;
};

export function Ribbon({ kits, scrollerRef, onJump, hovered, onHover, dimmed, nextId, tone, reduced }: Props) {
  const first = kits[0].day;
  const last = kits[kits.length - 1].day;
  const start = Math.min(first, TODAY_DAY) - 3;
  const end = Math.max(last, TODAY_DAY) + 4;
  const span = end - start;
  const pct = (d: number) => ((d - start) / span) * 100;

  const trackRef = useRef<HTMLDivElement>(null);
  const lensRef = useRef<HTMLDivElement>(null);
  const lensLabel = useRef<HTMLSpanElement>(null);
  const drag = useRef<{ grab: number; id: number } | null>(null);
  const dragged = useRef(false);

  // Lay the labels out before paint, and again whenever the ribbon resizes or fonts land.
  useLayoutEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    const layout = () => {
      const W = track.clientWidth;
      if (!W) return;
      const today = ((TODAY_DAY - start) / span) * W;
      const placed: (Placed & { id: string; truncated: boolean })[] = [];
      for (const kit of kits) {
        const label = track.querySelector<HTMLElement>(`[data-label="${kit.id}"]`);
        if (!label) continue;
        label.style.maxWidth = "none";
        label.style.left = "0px";
        label.style.right = "auto";
        const w = label.offsetWidth;
        const pin = ((kit.day - start) / span) * W;
        const o = placeOrTrim(pin, w, W, placed, [today]);
        placed.push({ id: kit.id, row: o.row, x0: o.x0, x1: o.x1, pin, truncated: !o.full });
      }
      const rows = Math.max(1, ...placed.map((p) => p.row + 1));
      const axis = 14 + rows * ROW_H;
      track.style.setProperty("--axis", `${axis}px`);
      for (const p of placed) {
        const label = track.querySelector<HTMLElement>(`[data-label="${p.id}"]`);
        const stem = track.querySelector<HTMLElement>(`[data-stem="${p.id}"]`);
        if (!label || !stem) continue;
        const bottom = axis - 12 - p.row * ROW_H;
        const right = p.x1 - p.pin < 20;
        // Anchor on the pin's side so a truncated label opens away from it on hover.
        label.style.left = right ? "auto" : `${p.x0}px`;
        label.style.right = right ? `${W - p.x1}px` : "auto";
        label.style.maxWidth = p.truncated ? `${p.x1 - p.x0}px` : "none";
        label.style.top = `${bottom - label.offsetHeight}px`;
        label.dataset.truncated = p.truncated ? "true" : "false";
        label.dataset.align = right ? "right" : "left";
        label.dataset.ready = "true";
        stem.style.left = `${p.pin}px`;
        stem.style.top = `${bottom}px`;
        stem.style.height = `${Math.max(0, axis - bottom - 9)}px`;
      }
    };
    layout();
    const ro = new ResizeObserver(layout);
    ro.observe(track);
    let live = true;
    document.fonts?.ready.then(() => live && layout()).catch(() => {});
    return () => {
      live = false;
      ro.disconnect();
    };
  }, [kits, start, span]);

  // Keep the lens in step with the kit track. Direct DOM writes: this runs on every scroll frame.
  useEffect(() => {
    const sc = scrollerRef.current;
    const lens = lensRef.current;
    if (!sc || !lens) return;
    const sync = () => {
      const fits = sc.scrollWidth <= sc.clientWidth + 2;
      lens.dataset.hidden = fits ? "true" : "false";
      if (fits) return;
      const pts = anchors(sc, start, end);
      const a = Math.max(start, dayAt(pts, sc.scrollLeft));
      const b = Math.min(end, dayAt(pts, sc.scrollLeft + sc.clientWidth));
      lens.style.left = `${((a - start) / span) * 100}%`;
      lens.style.width = `${((b - a) / span) * 100}%`;
      if (lensLabel.current) {
        const from = Math.max(Math.round(a), start);
        lensLabel.current.textContent = `${dayNum(from)} ${monthName(from)} to ${dayNum(Math.round(b))} ${monthName(Math.round(b))}`;
      }
    };
    sync();
    sc.addEventListener("scroll", sync, { passive: true });
    const ro = new ResizeObserver(sync);
    ro.observe(sc);
    if (sc.firstElementChild) ro.observe(sc.firstElementChild);
    return () => {
      sc.removeEventListener("scroll", sync);
      ro.disconnect();
    };
  }, [scrollerRef, start, end, span, kits]);

  const dayFromPointer = (clientX: number) => {
    const t = trackRef.current!.getBoundingClientRect();
    return start + ((clientX - t.left) / t.width) * span;
  };

  const scrubTo = (leftDay: number, smooth: boolean) => {
    const sc = scrollerRef.current;
    if (!sc) return;
    const pts = anchors(sc, start, end);
    const x = xAt(pts, leftDay);
    sc.scrollTo({ left: x, behavior: smooth && !reduced ? "smooth" : "auto" });
  };

  const lensDays = () => {
    const sc = scrollerRef.current!;
    const pts = anchors(sc, start, end);
    return [dayAt(pts, sc.scrollLeft), dayAt(pts, sc.scrollLeft + sc.clientWidth)];
  };

  // A press starts a scrub only once the pointer travels, so pins stay clickable.
  const press = useRef<{ x: number; id: number; onPin: boolean } | null>(null);

  const beginDrag = (e: RPointerEvent<HTMLDivElement>) => {
    const sc = scrollerRef.current;
    if (!sc || !press.current) return;
    const d = dayFromPointer(press.current.x);
    const [a, b] = lensDays();
    const inside = d >= a && d <= b;
    drag.current = { grab: inside ? d - a : (b - a) / 2, id: e.pointerId };
    e.currentTarget.setPointerCapture(e.pointerId);
    sc.style.scrollSnapType = "none";
    lensRef.current!.dataset.dragging = "true";
  };

  const onDown = (e: RPointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 || lensRef.current?.dataset.hidden === "true") return;
    const onPin = !!(e.target as HTMLElement).closest("button, [data-label]");
    press.current = { x: e.clientX, id: e.pointerId, onPin };
  };
  const onMove = (e: RPointerEvent<HTMLDivElement>) => {
    if (!drag.current) {
      if (press.current && Math.abs(e.clientX - press.current.x) > 4) beginDrag(e);
      else return;
    }
    scrubTo(dayFromPointer(e.clientX) - drag.current!.grab, false);
  };
  const onUp = () => {
    const p = press.current;
    const wasDrag = !!drag.current;
    dragged.current = wasDrag;
    press.current = null;
    drag.current = null;
    const sc = scrollerRef.current;
    if (sc) sc.style.scrollSnapType = "";
    if (lensRef.current) lensRef.current.dataset.dragging = "false";
    // A plain click on the empty ribbon centres the lens there.
    if (p && !wasDrag && !p.onPin && lensRef.current?.dataset.hidden !== "true") {
      const d = dayFromPointer(p.x);
      const [a, b] = lensDays();
      if (d < a || d > b) scrubTo(d - (b - a) / 2, true);
    }
  };

  const days = Array.from({ length: span + 1 }, (_, i) => start + i);
  const state = (kit: KitView) => cx(hovered === kit.id && r.isHovered, dimmed.has(kit.id) && r.isDim, kit.id === nextId && r.isNext);

  return (
    <div className={r.ribbon} style={{ ["--pj" as string]: `var(--v3-project-${tone})` }}>
      <div
        ref={trackRef}
        className={r.track}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        onClickCapture={(e) => {
          if (dragged.current) {
            e.stopPropagation();
            e.preventDefault();
            dragged.current = false;
          }
        }}
        role="group"
        aria-label="Countdown to each date. Drag to move through the kits."
      >
        <div className={r.past} style={{ width: `${pct(TODAY_DAY)}%` }} aria-hidden="true" />
        <div ref={lensRef} className={r.lens} data-hidden="true" aria-hidden="true">
          <span ref={lensLabel} className={r.lensLabel} />
        </div>

        <div className={r.axis} aria-hidden="true" />
        {days.map((d) => {
          const mon = isMonday(d);
          const first = dayNum(d) === 1;
          // The Today pill is wide; keep dates clear of it on either side.
          const nearToday = Math.abs(d - TODAY_DAY) < 4;
          return (
            <span key={d} className={cx(r.tick, mon && r.tickMon, first && r.tickMonth)} style={{ left: `${pct(d)}%` }} aria-hidden="true">
              {(mon || first) && !nearToday && (
                <span className={cx(r.tickLabel, first && r.tickLabelMonth)}>{first ? `1 ${monthName(d)}` : `${dayNum(d)} ${monthName(d)}`}</span>
              )}
            </span>
          );
        })}

        <div className={r.today} style={{ left: `${pct(TODAY_DAY)}%` }} aria-hidden="true">
          <span className={r.todayLine} />
          <span className={r.todayPill}>Today</span>
        </div>

        {kits.map((kit) => (
          <span key={`s-${kit.id}`} className={cx(r.stem, state(kit))} data-stem={kit.id} aria-hidden="true" />
        ))}

        {kits.map((kit) => {
          const open = kit.tone !== "done" && kit.tone !== "set";
          return (
            <span
              key={`l-${kit.id}`}
              className={cx(r.label, state(kit))}
              data-label={kit.id}
              data-tone={kit.tone}
              aria-hidden="true"
              onClick={() => onJump(kit.id)}
              onMouseEnter={() => onHover(kit.id)}
              onMouseLeave={() => onHover(null)}
            >
              <span className={r.labelTitle}>{kit.title}</span>
              <span className={r.labelDate}>
                {short(kit.day)}
                {open && (
                  <span className={r.labelCount}>
                    {" "}
                    · {kit.r.ready} of {kit.r.total}
                  </span>
                )}
              </span>
            </span>
          );
        })}

        {kits.map((kit) => (
          <button
            key={kit.id}
            type="button"
            className={cx(r.pin, state(kit))}
            data-tone={kit.tone}
            style={{ left: `${pct(kit.day)}%` }}
            onClick={() => onJump(kit.id)}
            onMouseEnter={() => onHover(kit.id)}
            onMouseLeave={() => onHover(null)}
            onFocus={() => onHover(kit.id)}
            onBlur={() => onHover(null)}
            aria-label={`${kit.title}, ${short(kit.day)}, ${kit.r.ready} of ${kit.r.total} ready`}
          >
            <PinMark kit={kit} major={kit.major} />
          </button>
        ))}
      </div>
    </div>
  );
}
