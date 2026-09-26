"use client";

import { useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import type { Clock } from "./clock";
import { useNow } from "./clock";
import type { World } from "./data";
import type { DialNode, Model } from "./model";
import { dShort, daysBetween, dLong, relDays } from "./time";
import s from "./c2.module.css";

const C = 300;
const R = 250;
const LABEL_R = 274;
const LABEL_GAP = 17;

const rad = (deg: number) => (deg * Math.PI) / 180;
const pt = (deg: number, r: number) => [C + r * Math.sin(rad(deg)), C - r * Math.cos(rad(deg))] as const;
const f = (n: number) => Math.round(n * 100) / 100;

function arc(a0: number, a1: number, r: number): string {
  if (a1 - a0 >= 359.99) {
    const [x0, y0] = pt(0, r);
    const [x1, y1] = pt(180, r);
    return `M ${f(x0)} ${f(y0)} A ${r} ${r} 0 1 1 ${f(x1)} ${f(y1)} A ${r} ${r} 0 1 1 ${f(x0)} ${f(y0)}`;
  }
  if (a1 - a0 <= 0.01) return "";
  const [x0, y0] = pt(a0, r);
  const [x1, y1] = pt(a1, r);
  return `M ${f(x0)} ${f(y0)} A ${r} ${r} 0 ${a1 - a0 > 180 ? 1 : 0} 1 ${f(x1)} ${f(y1)}`;
}

/**
 * Spread rim labels so they never collide; the marks themselves never move.
 * 12 o'clock is kept clear for the event (or the open end), so the first
 * label steps right of it and the last ones step left.
 */
function layoutLabels(nodes: DialNode[]): number[] {
  const la = nodes.map((n) => n.angle);
  if (la.length === 0) return la;
  const last = nodes.length - 1;
  const eventAtTop = nodes[last].isEvent && nodes[last].angle > 359;
  la[0] = Math.max(la[0], 19);
  for (let i = 1; i < la.length; i++) la[i] = Math.max(la[i], la[i - 1] + LABEL_GAP);
  let from = last;
  if (eventAtTop) {
    la[last] = 360;
    from = last - 1;
  }
  if (from >= 0) la[from] = Math.min(la[from], 341);
  for (let i = from - 1; i >= 0; i--) la[i] = Math.min(la[i], la[i + 1] - LABEL_GAP);
  return la;
}

export type Scrub = { angle: number; id?: string; keyboard?: boolean } | null;

type Props = {
  world: World;
  model: Model;
  clock: Clock;
  scrub: Scrub;
  onScrub: (next: Scrub) => void;
  onHover: (id: string | null) => void;
};

export function Dial({ world, model, clock, scrub, onScrub, onHover }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [hover, setHoverLocal] = useState<string | null>(null);
  const setHover = (next: string | null | ((h: string | null) => string | null)) => {
    const value = typeof next === "function" ? next(hover) : next;
    setHoverLocal(value);
    onHover(value);
  };
  const [dragging, setDragging] = useState(false);
  const lastAngle = useRef(0);

  const { nodes, todayAngle, start, end, hasDate } = model;
  const labelAngles = useMemo(() => layoutLabels(nodes), [nodes]);

  const monthTicks = useMemo(() => {
    const out: { angle: number; label: string; t: number }[] = [];
    const d = new Date(start);
    let t = Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1);
    while (t < end) {
      const month = new Date(t).getUTCMonth();
      out.push({ angle: model.angleOf(t), label: month === 0 ? String(new Date(t).getUTCFullYear()) : dShort(t).split(" ")[1], t });
      const n = new Date(t);
      t = Date.UTC(n.getUTCFullYear(), n.getUTCMonth() + 1, 1);
    }
    return out;
  }, [start, end, model]);

  const weekTicks = useMemo(() => {
    const out: number[] = [];
    for (let t = start; t < end; t += 7 * 86_400_000) out.push(model.angleOf(t));
    return out;
  }, [start, end, model]);

  const handAngle = scrub ? scrub.angle : todayAngle;
  const eventNode = nodes.find((n) => n.isEvent);

  function angleFromPointer(e: PointerEvent<SVGSVGElement>) {
    const rect = svgRef.current!.getBoundingClientRect();
    const k = 600 / rect.width;
    const x = (e.clientX - rect.left) * k - C;
    const y = (e.clientY - rect.top) * k - C;
    let a = (Math.atan2(x, -y) * 180) / Math.PI;
    if (a < 0) a += 360;
    return { a, dist: Math.hypot(x, y) };
  }

  function scrubTo(raw: number, keyboard = false) {
    let a = raw;
    // Crossing 12 o'clock would jump from the end of the project to its start.
    if (!keyboard && lastAngle.current > 270 && a < 90) a = 360;
    if (!keyboard && lastAngle.current < 90 && a > 270) a = 0;
    lastAngle.current = a;
    let best: DialNode | undefined;
    let bestD = 6;
    for (const n of nodes) {
      const d = Math.abs(n.angle - a);
      if (d < bestD) {
        bestD = d;
        best = n;
      }
    }
    onScrub(best ? { angle: best.angle, id: best.id, keyboard } : { angle: a, keyboard });
  }

  function onPointerDown(e: PointerEvent<SVGSVGElement>) {
    const { a, dist } = angleFromPointer(e);
    if (dist < 185 || dist > 330) return;
    e.preventDefault();
    svgRef.current?.setPointerCapture(e.pointerId);
    lastAngle.current = Math.abs(a - todayAngle) < 30 ? todayAngle : a;
    setDragging(true);
    setHover(null);
    scrubTo(a);
  }
  function onPointerMove(e: PointerEvent<SVGSVGElement>) {
    if (!dragging) return;
    scrubTo(angleFromPointer(e).a);
  }
  function endDrag() {
    if (!dragging) return;
    setDragging(false);
    onScrub(null);
  }

  function onKey(e: KeyboardEvent<SVGGElement>) {
    const cur = scrub ? scrub.angle : todayAngle;
    const angles = nodes.map((n) => n.angle);
    let target: number | undefined;
    if (e.key === "ArrowRight" || e.key === "ArrowUp") target = angles.find((a) => a > cur + 0.01);
    else if (e.key === "ArrowLeft" || e.key === "ArrowDown") target = [...angles].reverse().find((a) => a < cur - 0.01);
    else if (e.key === "Home") target = angles[0];
    else if (e.key === "End") target = angles[angles.length - 1];
    else if (e.key === "Escape") {
      onScrub(null);
      return;
    } else return;
    e.preventDefault();
    if (target === undefined) return;
    const n = nodes.find((x) => x.angle === target);
    onScrub({ angle: target, id: n?.id, keyboard: true });
  }

  const scrubNode = scrub?.id ? nodes.find((n) => n.id === scrub.id) : undefined;
  const scrubTime = scrubNode ? scrubNode.at : model.timeAt(handAngle);
  const valueText = scrubNode
    ? `${scrubNode.name}, ${dLong(scrubNode.at)}, ${relDays(model.now, scrubNode.at)}`
    : scrub
      ? `${dLong(scrubTime)}, ${relDays(model.now, scrubTime)}`
      : `Today, ${dLong(model.now)}`;

  const hovered = hover ? nodes.find((n) => n.id === hover) : undefined;
  const [tx, ty] = pt(todayAngle, R);

  return (
    <svg
      ref={svgRef}
      className={`${s.dial} ${dragging ? s.dialDragging : ""}`}
      viewBox="0 0 600 600"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      aria-labelledby="c2-dial-title"
    >
      <title id="c2-dial-title">
        {`The whole project as one turn of the dial, from ${dLong(model.start)} to ${dLong(model.end)}. Today is ${Math.round((todayAngle / 360) * 100)}% of the way round.`}
      </title>

      {/* Face */}
      <circle className={s.face} cx={C} cy={C} r={R + 36} />
      <circle className={s.faceInner} cx={C} cy={C} r={R - 34} />

      {/* Week and month ticks, one scale with the rim */}
      <g className={s.weekTicks} aria-hidden>
        {weekTicks.map((a, i) => {
          const [x0, y0] = pt(a, R - 8);
          const [x1, y1] = pt(a, R - 14);
          return <line key={i} x1={f(x0)} y1={f(y0)} x2={f(x1)} y2={f(y1)} />;
        })}
      </g>
      <g className={s.monthTicks} aria-hidden>
        {monthTicks.map((m) => {
          const [x0, y0] = pt(m.angle, R - 8);
          const [x1, y1] = pt(m.angle, R - 22);
          const [lx, ly] = pt(m.angle, R - 36);
          return (
            <g key={m.t}>
              <line x1={f(x0)} y1={f(y0)} x2={f(x1)} y2={f(y1)} />
              <text
                className={`${s.monthLabel} ${m.angle < 7 || m.angle > 353 || Math.abs(m.angle - handAngle) < 11 ? s.monthLabelHidden : ""}`} x={f(lx)} y={f(ly)} textAnchor="middle"
                dominantBaseline="central"
              >
                {m.label}
              </text>
            </g>
          );
        })}
      </g>

      {/* The rim: time left is a soft band, time gone is solid ink */}
      <circle className={s.rimBase} cx={C} cy={C} r={R} />
      {model.openFrom !== undefined ? <path className={s.openArc} d={arc(model.openFrom, 360, R)} /> : null}
      {hasDate ? <path className={s.remainBand} d={arc(todayAngle, 360, R)} /> : null}
      <path className={s.rimDone} d={arc(0, todayAngle, R)} pathLength={1} />

      {/* Moved milestones keep a ghost where they used to be */}
      {nodes.map((n) =>
        n.ghostAngle !== undefined ? (
          <g key={`ghost-${n.id}`} className={s.ghost} aria-hidden>
            <path className={s.ghostArc} d={arc(Math.min(n.ghostAngle, n.angle), Math.max(n.ghostAngle, n.angle), R + 14)} />
            <circle className={s.ghostDot} cx={f(pt(n.ghostAngle, R)[0])} cy={f(pt(n.ghostAngle, R)[1])} r={5} />
          </g>
        ) : null,
      )}

      {/* Chord from today to a hovered milestone */}
      {hovered && !scrub ? (
        <g className={s.chord} aria-hidden>
          <path d={arc(Math.min(todayAngle, hovered.angle), Math.max(todayAngle, hovered.angle), R)} className={s.chordArc} />
          {[todayAngle, hovered.angle].map((a, i) => {
            const [x0, y0] = pt(a, R - 12);
            const [x1, y1] = pt(a, R + 12);
            return <line key={i} className={s.chordTick} x1={f(x0)} y1={f(y0)} x2={f(x1)} y2={f(y1)} />;
          })}
          {Math.abs(todayAngle - hovered.angle) <= 90 ? (
            <line className={s.chordLine} x1={f(tx)} y1={f(ty)} x2={f(pt(hovered.angle, R)[0])} y2={f(pt(hovered.angle, R)[1])} />
          ) : null}
        </g>
      ) : null}

      {/* Milestones */}
      <g>
        {nodes.map((n) => {
          const [x, y] = pt(n.angle, R);
          const cls = n.isEvent
            ? `${s.node} ${s.nodeEvent} ${n.state === "done" ? s.nodeEventDone : ""}`
            : `${s.node} ${n.state === "done" ? s.nodeDone : n.state === "next" ? s.nodeNext : s.nodeUpcoming}`;
          return (
            <g
              key={n.id}
              className={cls}
              onPointerEnter={() => !dragging && setHover(n.id)}
              onPointerLeave={() => setHover((h) => (h === n.id ? null : h))}
            >
              <circle className={s.nodeHit} cx={f(x)} cy={f(y)} r={n.isEvent ? 20 : 14} />
              {n.state === "next" ? <circle className={s.nodeHalo} cx={f(x)} cy={f(y)} r={7} /> : null}
              <circle className={n.isEvent ? s.eventRing : s.nodeDot} cx={f(x)} cy={f(y)} r={n.isEvent ? 13 : 6} />
              {!n.isEvent ? (
                <text className={s.nodeNum} x={f(x)} y={f(y)} textAnchor="middle" dominantBaseline="central">
                  {n.n}
                </text>
              ) : null}
            </g>
          );
        })}
      </g>

      {/* Rim labels (hidden on phones, where the numbered list takes over) */}
      <g className={s.rimLabels} aria-hidden>
        {nodes.map((n, i) => {
          const la = labelAngles[i];
          const isTop = n.isEvent && la >= 359.9;
          const [lx, ly] = pt(la, isTop ? LABEL_R + 8 : LABEL_R);
          const sin = Math.sin(rad(la));
          const cos = Math.cos(rad(la));
          const anchor = isTop ? "middle" : sin > 0.25 ? "start" : sin < -0.25 ? "end" : "middle";
          // Upper half grows upward, lower half downward, the sides sit centred.
          const dy = cos > 0.35 ? -20 : cos < -0.35 ? 14 : -3;
          const moved = n.movedFrom !== undefined;
          const leader = Math.abs(la - n.angle) > 2 && !isTop;
          const [ax, ay] = pt(n.angle, R + 10);
          const [bx, by] = pt(la, LABEL_R - 8);
          const active = hover === n.id || scrub?.id === n.id;
          return (
            <g key={n.id} className={`${s.rimLabel} ${n.state === "done" ? s.rimLabelDone : ""} ${active ? s.rimLabelActive : ""}`}>
              {leader ? <line className={s.leader} x1={f(ax)} y1={f(ay)} x2={f(bx)} y2={f(by)} /> : null}
              <text x={f(lx)} y={f(ly + dy)} textAnchor={anchor}>
                <tspan className={s.rimName}>{n.short}</tspan>
                <tspan className={moved ? s.rimDateMoved : s.rimDate} x={f(lx)} dy={17}>
                  {moved ? `Moved to ${dShort(n.at)}` : n.isEvent ? `${dShort(n.at)} · ${world.timeShort}` : dShort(n.at)}
                </tspan>
              </text>
            </g>
          );
        })}
      </g>

      {eventNode ? null : (
        <g className={s.openEnd} aria-hidden>
          <circle className={s.openEndDot} cx={C} cy={C - R} r={9} />
          <text x={C} y={C - R - 40} textAnchor="middle">
            <tspan className={s.rimName}>{world.eventName}</tspan>
            <tspan className={s.rimDate} x={C} dy={17}>
              Date coming soon
            </tspan>
          </text>
        </g>
      )}

      <Bloom clock={clock} world={world} hasDate={hasDate} />

      {/* The hand: today, or wherever it has been dragged */}
      <g
        className={`${s.hand} ${scrub ? s.handScrub : ""}`}
        style={{ transform: `rotate(${f(handAngle)}deg)`, ["--a" as string]: `${f(handAngle)}deg` }}
      >
        <line className={s.handNeedle} x1={C} y1={C - R + 26} x2={C} y2={C - R - 18} />
        <g
          className={s.knob}
          role="slider"
          tabIndex={0}
          aria-label="Move through the project"
          aria-valuemin={0}
          aria-valuemax={model.spanDays}
          aria-valuenow={Math.max(0, daysBetween(model.start, scrubTime))}
          aria-valuetext={valueText}
          onKeyDown={onKey}
          onBlur={() => scrub?.keyboard && onScrub(null)}
        >
          <circle className={s.knobHit} cx={C} cy={C - R} r={22} />
          <circle className={s.knobFocus} cx={C} cy={C - R} r={17} />
          <circle className={s.knobDot} cx={C} cy={C - R} r={9} />
        </g>
        <g transform={`translate(${C} ${C - R + 52})`}>
          <text
            className={s.handLabel}
            textAnchor="middle"
            dominantBaseline="central"
            style={{ transform: `rotate(${f(-handAngle)}deg)` }}
          >
            {scrub ? dShort(scrubTime) : "Today"}
          </text>
        </g>
      </g>
    </svg>
  );
}

/** The finale: when the clock crosses zero the rim fills with the accent. */
function Bloom({ clock, world, hasDate }: { clock: Clock; world: World; hasDate: boolean }) {
  const now = useNow(clock, 1000);
  const since = now - world.target;
  if (!hasDate || since < 0 || since > 90_000) return null;
  return (
    <g className={s.bloom} aria-hidden>
      <circle className={s.bloomWash} cx={C} cy={C} r={R - 34} />
      <circle className={s.bloomRing} cx={C} cy={C} r={R} pathLength={1} transform={`rotate(-90 ${C} ${C})`} />
    </g>
  );
}
