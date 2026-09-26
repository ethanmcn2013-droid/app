"use client";

/* The phone map: the same line turned upright. Time runs top to bottom,
   lines run side by side and merge near the day, and every label sits to
   the right in one column, spread so none overlap. */

import { motion } from "motion/react";
import { useRef, useState } from "react";
import { StopDot, StopPill, cssVar } from "./glyphs";
import { Train, stationAria, type MapProps } from "./map-h";
import { dateLabel, ghostLabel, type Pt, type VLayout } from "./layout";
import { fullDate, stopState } from "./data";
import s from "./c6.module.css";

const d = (pts: Pt[]) => pts.map((p, i) => `${i ? "L" : "M"}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");

export function MapV({ V, sc, nextId, followId, openId, reduced, onOpen }: MapProps & { V: VLayout }) {
  const [introDone, setIntroDone] = useState(reduced);
  const count = useRef(0);
  const trains = V.lines.filter((l) => l.train).length;
  const dim = (ids: string[]) => (followId && !ids.includes(followId) ? s.dimmed : "");
  const colEdge = V.lineX[V.lineX.length - 1] + 11;
  const drawDur = reduced ? 0 : 1.2;
  const total = Math.max(1, V.terminus.y - Math.min(...V.lines.map((l) => l.startY)));
  const y0 = Math.min(...V.lines.map((l) => l.startY));

  return (
    <svg className={s.mapSvgV} width={V.width} height={V.height} viewBox={`0 0 ${V.width} ${V.height}`} role="group" aria-label={`Map of ${sc.h1}. Time runs top to bottom.`}>
      <g aria-hidden="true">
        {V.months.map((m) =>
          Math.abs(m.y - V.today.y) < 16 ? null : (
            <g key={m.y}>
              <line x1={46} x2={V.width - 12} y1={m.y} y2={m.y} className={s.grid} />
              <text x={12} y={m.y + 4} className={s.monthText}>
                {m.label}
              </text>
            </g>
          ),
        )}
      </g>

      <g aria-hidden="true">
        <line x1={46} x2={colEdge + 6} y1={V.today.y} y2={V.today.y} className={s.todayLine} />
        <rect x={4} y={V.today.y - 10} width={42} height={20} rx={10} className={s.todayTag} />
        <text x={25} y={V.today.y + 4} textAnchor="middle" className={s.todayTextSm}>
          Today
        </text>
      </g>

      <g aria-hidden="true">
        {V.lines.map((l) => (
          <g key={l.id} className={`${s.lineGroup} ${dim([l.id])}`}>
            <line x1={l.path[0].x - 8} x2={l.path[0].x + 8} y1={l.path[0].y} y2={l.path[0].y} className={s.trackEnd} style={{ stroke: cssVar(l.color) }} />
            {l.segments.map((g, k) => {
              if (g.pts.length < 2) return null;
              const a = g.pts[0].y;
              const b = g.pts[g.pts.length - 1].y;
              const delay = (reduced ? 0 : 0.1 + l.index * 0.1) + ((a - y0) / total) * drawDur;
              const dur = Math.max(0.05, ((b - a) / total) * drawDur);
              return g.kind === "plan" ? (
                <motion.path key={k} d={d(g.pts)} className={s.trackPlan} style={{ stroke: cssVar(l.color) }} initial={reduced ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay, duration: 0.5 }} />
              ) : (
                <motion.path
                  key={k}
                  d={d(g.pts)}
                  className={g.kind === "passed" ? s.trackPassed : s.trackFirm}
                  style={{ stroke: cssVar(l.color) }}
                  initial={reduced ? false : { pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{ delay, duration: dur, ease: "linear" }}
                />
              );
            })}
          </g>
        ))}
      </g>

      {V.ghosts.map((g) => (
        <g key={`ghost-${g.station.id}`} className={`${s.ghost} ${dim(g.station.lines)}`} aria-hidden="true">
          <circle cx={g.x} cy={g.y} r={5.5} className={s.ghostDot} />
          <path d={`M${colEdge} ${g.y} L${V.labelX - 14} ${g.label.y + g.label.h / 2} L${V.labelX - 5} ${g.label.y + g.label.h / 2}`} className={s.leader} />
          <text x={V.labelX} y={g.label.y + 13} className={s.ghostDate}>
            {ghostLabel(g.station)}
          </text>
        </g>
      ))}

      <g role="img" aria-label={`${sc.terminus.title}, ${fullDate(sc.terminus.date)}`}>
        <rect x={V.terminus.x1 - 12} y={V.terminus.y - 10} width={V.terminus.x2 - V.terminus.x1 + 24} height={20} rx={10} className={sc.today >= sc.terminus.date ? s.termDone : s.termOpen} />
        <rect x={V.terminus.x1 - 6} y={V.terminus.y - 4} width={V.terminus.x2 - V.terminus.x1 + 12} height={8} rx={4} className={s.termInner} />
        <path
          d={`M${colEdge} ${V.terminus.y} L${V.labelX - 14} ${V.terminus.label.y + 16} L${V.labelX - 5} ${V.terminus.label.y + 16}`}
          className={s.leader}
          aria-hidden="true"
        />
        <text x={V.labelX} y={V.terminus.label.y + 21} className={s.termTitleSm}>
          {sc.terminus.title}
        </text>
        <text x={V.labelX} y={V.terminus.label.y + 40} className={s.termDate}>
          {fullDate(sc.terminus.date)}
        </text>
      </g>

      {V.stations.map((v) => {
        const st = v.station;
        const state = stopState(sc, st, nextId);
        const colors = st.lines.map((id) => sc.lines.find((l) => l.id === id)?.color ?? "--v3-text");
        const ly = v.label.y;
        const mid = ly + 12;
        const active = openId === st.id;
        const words = st.title.split(" ");
        let first = st.title;
        let second = "";
        if (v.label.lines === 2) {
          const half = Math.ceil(words.length / 2);
          first = words.slice(0, half).join(" ");
          second = words.slice(half).join(" ");
        }
        return (
          <g
            key={st.id}
            role="button"
            tabIndex={0}
            aria-label={stationAria(sc, st, nextId)}
            aria-haspopup="dialog"
            data-vstation={st.id}
            className={`${s.station} ${active ? s.stationActive : ""} ${dim(st.lines)}`}
            style={{ animationDelay: reduced ? "0s" : `${0.3 + (v.y / V.height) * 1.1}s` }}
            onClick={() => onOpen(st.id)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onOpen(st.id);
              }
            }}
          >
            <rect x={V.labelX - 8} y={ly - 5} width={V.width - V.labelX} height={v.label.h + 6} rx={8} className={s.labelHit} />
            <path d={`M${colEdge} ${v.y} L${V.labelX - 14} ${mid} L${V.labelX - 5} ${mid}`} className={s.leader} />
            {v.pill ? (
              <StopPill x1={v.pill.x1} y1={v.y} x2={v.pill.x2} y2={v.y} state={state} focus={active} />
            ) : (
              <StopDot x={v.points[0].x} y={v.y} state={state} color={colors[0]} r={6.5} focus={active} />
            )}
            <text x={V.labelX} y={ly + 13} className={s.stTitle}>
              {first}
            </text>
            {second ? (
              <text x={V.labelX} y={ly + 29} className={s.stTitle}>
                {second}
              </text>
            ) : null}
            <text x={V.labelX} y={ly + (second ? 45 : 29)} className={s.stDate}>
              {state === "next" ? (
                <>
                  <tspan className={s.stNext}>Next stop</tspan>
                  <tspan> · {dateLabel(st)}</tspan>
                </>
              ) : (
                dateLabel(st)
              )}
            </text>
          </g>
        );
      })}

      {V.lines.map((l) =>
        l.train ? (
          <Train
            key={`train-${l.id}`}
            route={l.train.route}
            at={l.train.at}
            color={l.color}
            vertical
            small
            delay={(reduced ? 0 : 0.1 + l.index * 0.1) + 0.3}
            instant={introDone || reduced}
            className={dim([l.id])}
            onDone={() => {
              count.current += 1;
              if (count.current >= trains) setIntroDone(true);
            }}
          />
        ) : null,
      )}
    </svg>
  );
}
