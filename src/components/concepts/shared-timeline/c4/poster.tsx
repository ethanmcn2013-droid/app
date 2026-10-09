"use client";

/* The poster as drawn on screen: an SVG of the composed scene, plus the
   one thing a picture cannot do, touching a day to hear what it held. */

import { useMemo, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent } from "react";
import { cellAt, stepRow, type DotItem, type Face, type Role, type Scene } from "./compose";
import { describeDay, fmtWDM, type Model } from "./data";
import s from "./c4.module.css";

const col = (role: Role) => `var(--pz-${role})`;
const face = (f: Face) => `var(--pz-${f})`;

type Props = { scene: Scene; model: Model };

export function PosterArt({ scene, model }: Props) {
  const { W, H, grid } = scene;
  const startActive = Math.max(0, Math.min(model.days.length - 1, model.todayIdx));
  const [active, setActive] = useState(startActive);
  const [hover, setHover] = useState<number | null>(null);
  const [focused, setFocused] = useState(false);
  const [pinned, setPinned] = useState(false);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const gridRef = useRef<SVGGElement | null>(null);

  const byIndex = useMemo(() => new Map(scene.dots.map((d) => [d.i, d])), [scene.dots]);

  /* Visual rows, for the grid role. */
  const weeks = useMemo(() => {
    const rows: DotItem[][] = [];
    for (const d of scene.dots) {
      const w = Math.floor(grid.unitOf[d.i] / grid.G);
      (rows[w] ??= []).push(d);
    }
    return rows.filter(Boolean);
  }, [scene.dots, grid]);

  const toLocal = (e: PointerEvent<SVGSVGElement>) => {
    const svg = svgRef.current;
    if (!svg) return null;
    const rect = svg.getBoundingClientRect();
    return { x: ((e.clientX - rect.left) * W) / rect.width, y: ((e.clientY - rect.top) * H) / rect.height };
  };

  const onMove = (e: PointerEvent<SVGSVGElement>) => {
    if (e.pointerType !== "mouse") return;
    const pt = toLocal(e);
    if (!pt) return;
    setHover(cellAt(grid, pt.x, pt.y));
  };

  const onDown = (e: PointerEvent<SVGSVGElement>) => {
    const pt = toLocal(e);
    if (!pt) return;
    const i = cellAt(grid, pt.x, pt.y);
    if (i === null) {
      setPinned(false);
      setHover(null);
      return;
    }
    setActive(i);
    setHover(i);
    setPinned(e.pointerType !== "mouse");
  };

  const move = (next: number) => {
    const n = Math.max(0, Math.min(model.days.length - 1, next));
    setActive(n);
    setHover(null);
    gridRef.current?.querySelector<SVGGElement>(`[data-i="${n}"]`)?.focus();
  };

  const onKey = (e: KeyboardEvent<SVGGElement>) => {
    const unit = grid.unitOf[active];
    const unitStart = grid.unitStart[unit];
    const map: Record<string, number | undefined> = {
      ArrowRight: active + 1,
      ArrowLeft: active - 1,
      ArrowDown: stepRow(grid, active, 1),
      ArrowUp: stepRow(grid, active, -1),
      PageDown: active + 28,
      PageUp: active - 28,
      Home: e.ctrlKey ? 0 : Math.max(0, unitStart),
      End: e.ctrlKey ? model.days.length - 1 : Math.min(model.days.length - 1, unitStart + grid.L - 1),
      t: model.todayIdx,
    };
    const next = map[e.key];
    if (next === undefined) {
      if (e.key === "Escape") setHover(null);
      return;
    }
    e.preventDefault();
    move(next);
  };

  const shown = hover ?? (focused || pinned ? active : null);
  const shownDot = shown !== null ? byIndex.get(shown) : undefined;
  const shownDay = shown !== null ? model.days[shown] : undefined;
  const tip = shownDay ? describeDay(model, shownDay) : null;
  const tipBelow = shownDot ? shownDot.cy < H * 0.2 : false;
  const tipX = shownDot ? Math.max(90, Math.min(W - 90, shownDot.cx)) : 0;

  return (
    <div className={s.art} onPointerLeave={() => !pinned && setHover(null)}>
      <svg
        ref={svgRef}
        className={s.svg}
        width={W}
        height={H}
        viewBox={`0 0 ${W} ${H}`}
        style={{ "--pz-hw": `${scene.hollowW}px` } as CSSProperties}
        role="group"
        aria-label={`${model.world.plainTitle}, every day as one mark`}
        onPointerMove={onMove}
        onPointerDown={onDown}
      >
        <g aria-hidden="true">
          {scene.rects.map((r) => (
            <rect
              key={r.key}
              className={s.geo}
              style={{ x: r.x, y: r.y, width: r.w, height: r.h, rx: r.rx ?? 0, fill: col(r.role) } as CSSProperties}
            />
          ))}
          {scene.paths.map((p) => (
            <path
              key={p.key}
              className={s.lead}
              d={p.d}
              style={{ d: `path("${p.d}")`, stroke: col(p.role), strokeWidth: p.w, opacity: p.opacity ?? 1, fill: "none" } as CSSProperties}
            />
          ))}
        </g>

        <g
          ref={gridRef}
          role="grid"
          aria-label={`Every day, ${model.spanLabel}. Use the arrow keys to walk the days.`}
          onKeyDown={onKey}
          onFocus={() => setFocused(true)}
          onBlur={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setFocused(false);
          }}
        >
          {weeks.map((row) => (
            <g role="row" key={`row-${grid.unitOf[row[0].i]}`} aria-label={`From ${fmtWDM(model.days[row[0].i].n)}`}>
              {row.map((d) => {
                const day = model.days[d.i];
                const info = describeDay(model, day);
                return (
                  <g
                    key={d.i}
                    data-i={d.i}
                    role="gridcell"
                    tabIndex={d.i === active ? 0 : -1}
                    aria-label={`${info.title}, ${info.line}. ${info.sub}.`}
                    aria-current={d.today ? "date" : undefined}
                    className={s.cell}
                  >
                    <Dot d={d} />
                  </g>
                );
              })}
            </g>
          ))}
        </g>

        {scene.todayRing ? (
          <circle
            className={`${s.geo} ${s.ring}`}
            pathLength={100}
            aria-hidden="true"
            style={{ cx: scene.todayRing.cx, cy: scene.todayRing.cy, r: scene.todayRing.r, stroke: col("accent"), strokeWidth: scene.todayRing.sw, fill: "none" } as CSSProperties}
          />
        ) : null}

        <g aria-hidden="true">
          {scene.texts.map((t) => (
            <text
              key={t.key}
              className={s.txt}
              textAnchor={t.anchor}
              style={{
                transform: `translate(${t.x}px, ${t.y}px)`,
                fontSize: t.size,
                fontWeight: t.weight,
                fontFamily: face(t.face),
                fontStyle: t.italic ? "italic" : "normal",
                letterSpacing: `${t.track ?? 0}em`,
                fill: col(t.role),
                opacity: t.opacity ?? 1,
              }}
            >
              {t.text}
            </text>
          ))}
          <circle className={s.geo} style={{ cx: scene.mark.cx, cy: scene.mark.cy, r: scene.mark.r - scene.mark.sw / 2, stroke: col("muted"), strokeWidth: scene.mark.sw, fill: "none" } as CSSProperties} />
          <circle className={s.geo} style={{ cx: scene.mark.cx, cy: scene.mark.cy, r: scene.mark.r * 0.34, fill: col("muted") } as CSSProperties} />
        </g>

        {shownDot ? (
          <circle
            aria-hidden="true"
            className={s.focusRing}
            cx={shownDot.cx}
            cy={shownDot.cy}
            r={(shownDot.target ? shownDot.target.ring : shownDot.star ? shownDot.r * 1.1 : shownDot.r + (shownDot.sw ?? 0) / 2) + Math.max(3, grid.p * 0.16)}
          />
        ) : null}
      </svg>

      {tip && shownDot ? (
        <div
          className={s.tip}
          data-below={tipBelow ? "true" : undefined}
          style={{ left: tipX, top: tipBelow ? shownDot.cy + grid.p * 0.8 : shownDot.cy - grid.p * 0.8 }}
          role="status"
          aria-live="polite"
        >
          <span className={s.tipTitle}>
            {tip.title} · <span className={s.tipLine}>{tip.line}</span>
          </span>
          <span className={s.tipSub}>{tip.sub}</span>
        </div>
      ) : null}
    </div>
  );
}

function Dot({ d }: { d: DotItem }) {
  const wave = d.wave !== undefined ? { animationDelay: `${d.wave}ms` } : null;
  if (d.star) {
    return (
      <path
        className={`${s.lead} ${wave ? s.wave : ""}`}
        d={d.star}
        style={{ d: `path("${d.star}")`, fill: col(d.fill), ...wave } as CSSProperties}
      />
    );
  }
  return (
    <>
      {d.target ? (
        <circle
          className={s.geo}
          style={{ cx: d.cx, cy: d.cy, r: d.target.ring - d.target.sw / 2, fill: col("paper"), stroke: col("accent"), strokeWidth: d.target.sw } as CSSProperties}
        />
      ) : null}
      <circle
        className={`${s.geo} ${d.pulse ? s.pulse : ""} ${wave ? s.wave : ""}`}
        style={{
          ...wave,
          cx: d.cx,
          cy: d.cy,
          r: Math.max(0.1, d.r),
          fill: col(d.fill),
          stroke: d.stroke ? col(d.stroke) : "none",
          strokeWidth: d.sw ?? 0,
          opacity: d.opacity ?? 1,
        } as CSSProperties}
      />
      {d.num ? (
        <text
          className={`${s.txt} ${wave ? s.waveText : ""}`}
          textAnchor="middle"
          style={{
            ...wave,
            transform: `translate(${d.cx}px, ${d.cy + d.num.size * 0.36}px)`,
            fontSize: d.num.size,
            fontWeight: 700,
            fontFamily: face("round"),
            fill: col(d.num.role),
          }}
        >
          {d.num.text}
        </text>
      ) : null}
    </>
  );
}
