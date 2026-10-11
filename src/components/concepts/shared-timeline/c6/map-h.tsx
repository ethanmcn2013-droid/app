"use client";

/* The horizontal map: time runs left to right on one scale. */

import { motion } from "motion/react";
import { useRef, useState, type KeyboardEvent } from "react";
import { StopDot, StopPill, TrainShape, cssVar } from "./glyphs";
import { dateLabel, ghostLabel, type HLayout, type Pt, type SegKind } from "./layout";
import { fullDate, longDate, stopState, type Scenario, type Station } from "./data";
import s from "./c6.module.css";

const d = (pts: Pt[]) => pts.map((p, i) => `${i ? "L" : "M"}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");

export type MapProps = {
  sc: Scenario;
  nextId: string | null;
  followId: string | null;
  hoverId: string | null;
  openId: string | null;
  reduced: boolean;
  onHover: (id: string | null) => void;
  onOpen: (id: string) => void;
};

export function stationAria(sc: Scenario, st: Station, nextId: string | null) {
  const state = stopState(sc, st, nextId);
  const lines = st.lines.map((id) => sc.lines.find((l) => l.id === id)?.name).filter(Boolean).join(" and ");
  const word = state === "done" ? "done" : state === "next" ? "next stop" : "planned";
  return `${st.title}, ${fullDate(st.date)}, ${word}, on ${lines}`;
}

function onKey(e: KeyboardEvent, fn: () => void) {
  if (e.key === "Enter" || e.key === " ") {
    e.preventDefault();
    fn();
  }
}

export function MapH({ L, sc, nextId, followId, hoverId, openId, reduced, onHover, onOpen }: MapProps & { L: HLayout }) {
  const [introDone, setIntroDone] = useState(reduced);
  const arrivedTrains = useRef(0);
  const trainCount = L.lines.filter((l) => l.train).length;
  const trainDone = () => {
    arrivedTrains.current += 1;
    if (arrivedTrains.current >= trainCount) setIntroDone(true);
  };
  const dim = (ids: string[]) => (followId && !ids.includes(followId) ? s.dimmed : "");
  const total = Math.max(1, L.terminus.x - Math.min(...L.lines.map((l) => l.startX)));
  const drawDur = reduced ? 0 : 1.0;
  const lineDelay = (i: number) => (reduced ? 0 : 0.15 + i * 0.12);

  return (
    <svg
      className={s.mapSvg}
      width={L.width}
      height={L.height}
      viewBox={`0 0 ${L.width} ${L.height}`}
      role="group"
      aria-label={`Map of ${sc.h1}. Time runs left to right.`}
    >
      {/* Months: faint marks along the bottom, one scale for everything. */}
      <g aria-hidden="true">
        {L.months.map((m) => (
          <g key={m.x}>
            <line x1={m.x} x2={m.x} y1={30} y2={L.axisY - 12} className={m.major ? s.gridMajor : s.grid} />
            <text x={m.x + 6} y={L.axisY + 4} className={s.monthText}>
              {m.label}
            </text>
          </g>
        ))}
      </g>

      {/* Today. */}
      <g aria-hidden="true" className={s.todayGroup} display={sc.today > sc.terminus.date ? "none" : undefined}>
        <line x1={L.today.x} x2={L.today.x} y1={L.today.top + 18} y2={L.today.bottom} className={s.todayLine} />
        <rect x={L.today.x - 50} y={L.today.top - 2} width={100} height={22} rx={11} className={s.todayTag} />
        <text x={L.today.x} y={L.today.top + 13} textAnchor="middle" className={s.todayText}>
          Today · {shortLabel(sc.today)}
        </text>
      </g>

      {/* Track. */}
      <g aria-hidden="true">
        {L.lines.map((l) => {
          const x0 = l.startX;
          return (
            <g key={l.id} className={`${s.lineGroup} ${dim([l.id])}`}>
              {/* Line start: a short bar across the track. */}
              <motion.line
                x1={l.path[0].x}
                x2={l.path[0].x}
                y1={l.path[0].y - 8}
                y2={l.path[0].y + 8}
                className={s.trackEnd}
                style={{ stroke: cssVar(l.color) }}
                initial={reduced ? false : { opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: lineDelay(l.index), duration: 0.2 }}
              />
              {l.segments.map((g, k) => {
                if (g.pts.length < 2) return null;
                const a = g.pts[0].x;
                const b = g.pts[g.pts.length - 1].x;
                const delay = lineDelay(l.index) + ((a - x0) / total) * drawDur;
                const dur = Math.max(0.05, ((b - a) / total) * drawDur);
                return (
                  <Segment key={k} kind={g.kind} dPath={d(g.pts)} color={l.color} delay={delay} dur={dur} reduced={reduced} />
                );
              })}
              {l.plannedTags.map((p, k) => (
                <text key={k} x={p.x} y={p.y - 11} className={s.plannedTag}>
                  Planned
                </text>
              ))}
            </g>
          );
        })}
      </g>

      {/* Ghost stops where something used to be. */}
      {L.ghosts.map((g) => (
        <g key={`ghost-${g.station.id}`} className={`${s.ghost} ${dim(g.station.lines)}`} aria-hidden="true">
          <circle cx={g.x} cy={g.y} r={6.5} className={s.ghostDot} />
          <line x1={g.label.leader[0].x} y1={g.label.leader[0].y} x2={g.label.leader[1].x} y2={g.label.leader[1].y} className={s.leader} />
          <text
            x={g.label.anchor === "start" ? g.label.box.x : g.label.box.x + g.label.box.w}
            y={g.label.box.y + 13}
            textAnchor={g.label.anchor}
            className={s.ghostTitle}
          >
            Was here
          </text>
          <text
            x={g.label.anchor === "start" ? g.label.box.x : g.label.box.x + g.label.box.w}
            y={g.label.box.y + 29}
            textAnchor={g.label.anchor}
            className={s.ghostDate}
          >
            {ghostLabel(g.station)}
          </text>
        </g>
      ))}

      {/* Terminus. */}
      <g className={s.terminus} aria-label={`${sc.terminus.title}, ${fullDate(sc.terminus.date)}`} role="img">
        <rect
          x={L.terminus.x - 11}
          y={L.terminus.y1 - 12}
          width={22}
          height={L.terminus.y2 - L.terminus.y1 + 24}
          rx={11}
          className={sc.today >= sc.terminus.date ? s.termDone : s.termOpen}
        />
        <rect
          x={L.terminus.x - 5}
          y={L.terminus.y1 - 6}
          width={10}
          height={L.terminus.y2 - L.terminus.y1 + 12}
          rx={5}
          className={s.termInner}
        />
        <text x={L.terminus.label.x} y={L.terminus.label.y + 20} className={s.termTitle}>
          {sc.terminus.title}
        </text>
        <text x={L.terminus.label.x} y={L.terminus.label.y + 39} className={s.termDate}>
          {fullDate(sc.terminus.date)}
        </text>
      </g>

      {/* Stops and their labels. */}
      {L.stations.map((h) => {
        const st = h.station;
        const state = stopState(sc, st, nextId);
        const colors = st.lines.map((id) => sc.lines.find((l) => l.id === id)?.color ?? "--v3-text");
        const lab = h.label;
        const tx = lab.anchor === "start" ? lab.box.x : lab.box.x + lab.box.w;
        const active = hoverId === st.id || openId === st.id;
        const delay = reduced ? 0 : 0.35 + ((h.x - 40) / Math.max(1, L.width)) * 1.1;
        const crowded = L.stations.some((o) => o !== h && o.station.lines.some((id) => st.lines.includes(id)) && Math.abs(o.x - h.x) < 16);
        const r = crowded ? 5.5 : h.x >= L.mergeX ? 6.5 : 7.5;
        return (
          <g
            key={st.id}
            role="button"
            tabIndex={0}
            aria-label={stationAria(sc, st, nextId)}
            aria-expanded={openId === st.id}
            data-station={st.id}
            className={`${s.station} ${active ? s.stationActive : ""} ${dim(st.lines)}`}
            style={{ animationDelay: `${delay}s` }}
            onMouseEnter={() => onHover(st.id)}
            onMouseLeave={() => onHover(null)}
            onFocus={() => onHover(st.id)}
            onBlur={() => onHover(null)}
            onClick={() => onOpen(st.id)}
            onKeyDown={(e) => onKey(e, () => onOpen(st.id))}
          >
            <rect x={lab.box.x - 6} y={lab.box.y - 4} width={lab.box.w + 12} height={lab.box.h + 8} rx={8} className={s.labelHit} />
            <line x1={lab.leader[0].x} y1={lab.leader[0].y} x2={lab.leader[1].x} y2={lab.leader[1].y} className={s.leader} />
            {h.pill ? (
              <StopPill x1={h.pill.x} y1={h.pill.y1} x2={h.pill.x} y2={h.pill.y2} state={state} focus={active} />
            ) : (
              <StopDot x={h.x} y={h.points[0].y} state={state} color={colors[0]} r={r} focus={active} />
            )}
            <circle cx={h.x} cy={h.points[0].y} r={15} className={s.hit} />
            <text x={tx} y={lab.box.y + 13} textAnchor={lab.anchor} className={s.stTitle}>
              {st.title}
            </text>
            <text x={tx} y={lab.box.y + 29} textAnchor={lab.anchor} className={s.stDate}>
              {state === "next" ? (
                <>
                  <tspan className={s.stNext}>Next stop</tspan>
                  <tspan> · {dateLabel(st)}</tspan>
                </>
              ) : (
                dateLabel(st)
              )}
            </text>
            <title>{`${st.title} · ${longDate(st.date)}`}</title>
          </g>
        );
      })}

      {/* Trains glide from the start of their line to today. */}
      {L.lines.map((l) =>
        l.train ? (
          <Train
            key={`train-${l.id}`}
            route={l.train.route}
            at={l.train.at}
            color={l.color}
            small={l.train.at.x >= L.mergeX}
            delay={lineDelay(l.index) + 0.2}
            instant={introDone || reduced}
            className={dim([l.id])}
            onDone={trainDone}
          />
        ) : null,
      )}
    </svg>
  );
}

function shortLabel(iso: string) {
  const [, m, dd] = iso.split("-").map(Number);
  return `${dd} ${["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][m - 1]}`;
}

function Segment({ kind, dPath, color, delay, dur, reduced }: { kind: SegKind; dPath: string; color: string; delay: number; dur: number; reduced: boolean }) {
  if (kind === "plan") {
    return (
      <motion.path
        d={dPath}
        className={s.trackPlan}
        style={{ stroke: cssVar(color) }}
        initial={reduced ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: delay + dur * 0.5, duration: 0.5 }}
      />
    );
  }
  return (
    <motion.path
      d={dPath}
      className={kind === "passed" ? s.trackPassed : s.trackFirm}
      style={{ stroke: cssVar(color) }}
      initial={reduced ? false : { pathLength: 0 }}
      animate={{ pathLength: 1 }}
      transition={{ delay, duration: dur, ease: "linear" }}
    />
  );
}

export function Train({
  route,
  at,
  color,
  delay,
  instant,
  vertical = false,
  small = false,
  className,
  onDone,
}: {
  small?: boolean;
  route: Pt[];
  at: Pt;
  color: string;
  delay: number;
  instant: boolean;
  vertical?: boolean;
  className?: string;
  onDone?: () => void;
}) {
  if (instant || route.length < 2) {
    return (
      <g className={`${s.train} ${className ?? ""}`} transform={`translate(${at.x} ${at.y})`} aria-hidden="true">
        <g transform={small ? "scale(0.72)" : undefined}>
          <TrainShape color={color} vertical={vertical} />
        </g>
      </g>
    );
  }
  // Keyframes along the track, timed by distance so the speed is even.
  const lens = [0];
  for (let i = 1; i < route.length; i++) lens.push(lens[i - 1] + Math.hypot(route[i].x - route[i - 1].x, route[i].y - route[i - 1].y));
  const total = lens[lens.length - 1] || 1;
  const times = lens.map((v) => v / total);
  const duration = Math.min(1.5, 0.7 + total / 1200);
  return (
    <motion.g
      className={`${s.train} ${className ?? ""}`}
      aria-hidden="true"
      initial={{ x: route[0].x, y: route[0].y, opacity: 0 }}
      animate={{ x: route.map((p) => p.x), y: route.map((p) => p.y), opacity: [0, 1, 1] }}
      transition={{
        x: { delay, duration, times, ease: route.length === 2 ? [0.3, 0.1, 0.2, 1] : "linear" },
        y: { delay, duration, times, ease: route.length === 2 ? [0.3, 0.1, 0.2, 1] : "linear" },
        opacity: { delay, duration: 0.3 },
      }}
      onAnimationComplete={onDone}
    >
      <g transform={small ? "scale(0.72)" : undefined}>
        <TrainShape color={color} vertical={vertical} />
      </g>
    </motion.g>
  );
}
