"use client";

import { motion } from "motion/react";
import { BUSY_PER_DAY, DAYS, PROJECTS, nodeById, type Conn, type Filter, type ProjectId } from "./data";
import { pointAt, type Route } from "./layout";
import type { Tone } from "./model";
import { Icon } from "./glyphs";
import s from "./c6.module.css";

export const cx = (...c: (string | false | undefined | null)[]) => c.filter(Boolean).join(" ");

export const PC: Record<ProjectId | "shared", string> = {
  orchard: s.pcOrchard,
  mara: s.pcMara,
  riverside: s.pcRiverside,
  hollis: s.pcHollis,
  shared: s.pcShared,
};

export const pc = (p: ProjectId | null) => PC[p ?? "shared"];

export function Swatch({ project, size = "sm" }: { project: ProjectId | null; size?: "sm" | "md" }) {
  return <span className={cx(s.swatch, size === "md" && s.swatchMd, pc(project), project === null && s.swatchShared)} aria-hidden="true" />;
}

/* ── one line on the map ─────────────────────────────────────────────── */

function hash(str: string) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) % 997;
  return h;
}

export function dotCount(c: Conn) {
  if (c.status !== "live") return 0;
  if (c.today === 0) return c.fresh ? 1 : 0;
  return Math.min(3, Math.ceil(c.today / 4));
}

export function Wire({
  route,
  conn,
  tone,
  pathId,
  reduced,
  thin,
  onHover,
  onOpen,
}: {
  route: Route;
  conn: Conn;
  tone: Tone;
  pathId: string;
  reduced: boolean;
  thin?: boolean;
  onHover: (id: string | null) => void;
  onOpen: (id: string) => void;
}) {
  const busy = conn.week.reduce((a, b) => a + b, 0) / 7 >= BUSY_PER_DAY;
  const st = conn.status;
  const gapAt = 0.5;
  const mid = pointAt(route, gapAt);
  const dash =
    st === "broken"
      ? `${Math.max(1, route.len * gapAt - 7)} 14 ${route.len}`
      : st === "paused"
        ? "0.01 6"
        : st === "waiting"
          ? "6 5"
          : undefined;
  const dots = reduced ? 0 : dotCount(conn);
  const speed = 46; // px per second: a walk, not a race
  const travel = route.len / speed;
  const from = nodeById(conn.from).name;
  const to = nodeById(conn.to).name;
  const first = route.segs[0];
  const last = route.segs[route.segs.length - 1];

  return (
    <g
      className={cx(s.wire, pc(conn.project), s[`tone_${tone}`], s[`st_${st}`], busy && s.busy, thin && s.wireThin)}
      onPointerEnter={() => onHover(conn.id)}
      onPointerLeave={() => onHover(null)}
      onClick={() => onOpen(conn.id)}
    >
      <title>{`${conn.label}. ${from} to ${to}`}</title>
      <path className={s.wireHit} d={route.d} />
      <path className={s.wireCasing} d={route.d} />
      <motion.path
        id={pathId}
        className={s.wireLine}
        initial={false}
        animate={{ d: route.d }}
        transition={{ duration: reduced ? 0 : 0.5, ease: [0.2, 0.8, 0.2, 1] }}
        strokeDasharray={dash}
      />
      <circle className={s.port} cx={first.x1} cy={first.y1} r={3.5} />
      <circle className={s.port} cx={last.x2} cy={last.y2} r={3.5} />
      {st !== "live" && (
        <g className={s.midMark} transform={`translate(${mid.x} ${mid.y})`}>
          <circle r={9} />
          <g transform="translate(-6 -6)">
            <Icon name={st === "broken" ? "warn" : st === "paused" ? "pause" : "wait"} size={12} />
          </g>
        </g>
      )}
      {Array.from({ length: dots }, (_, i) => {
        const rest = conn.fresh && conn.today === 0 ? 2.4 : 5 + (hash(conn.id) % 5);
        const cycle = travel + rest;
        const k = travel / cycle;
        const offset = ((hash(conn.id + i) % 100) / 100) * cycle + i * (cycle / Math.max(1, dots));
        return (
          <circle key={i} className={s.dot} r={busy ? 3 : 2.6} opacity={0}>
            <animateMotion dur={`${cycle.toFixed(2)}s`} begin={`${(-offset).toFixed(2)}s`} repeatCount="indefinite" keyPoints="0;1;1" keyTimes={`0;${k.toFixed(3)};1`} calcMode="linear">
              <mpath href={`#${pathId}`} />
            </animateMotion>
            <animate
              attributeName="opacity"
              dur={`${cycle.toFixed(2)}s`}
              begin={`${(-offset).toFixed(2)}s`}
              repeatCount="indefinite"
              values="0;1;1;0;0"
              keyTimes={`0;${(k * 0.08).toFixed(3)};${(k * 0.94).toFixed(3)};${k.toFixed(3)};1`}
            />
          </circle>
        );
      })}
    </g>
  );
}

/* ── Project filter ──────────────────────────────────────────────────── */

export function ProjectFilter({ value, onChange, counts }: { value: Filter; onChange: (f: Filter) => void; counts: Record<string, number> }) {
  const items: { id: Filter; name: string }[] = [{ id: "all", name: "All" }, ...PROJECTS.map((p) => ({ id: p.id as Filter, name: p.name }))];
  return (
    <div className={s.filter} role="group" aria-label="Show connections for">
      {items.map((it) => (
        <button key={it.id} type="button" className={cx(s.chip, it.id !== "all" && PC[it.id as ProjectId])} aria-pressed={value === it.id} onClick={() => onChange(it.id)}>
          {it.id !== "all" && <Swatch project={it.id as ProjectId} />}
          <span>{it.name}</span>
          <span className={cx(s.chipCount, s.num)}>{counts[it.id] ?? 0}</span>
        </button>
      ))}
    </div>
  );
}

/* ── a switch ────────────────────────────────────────────────────────── */

export function Toggle({ on, onChange, label }: { on: boolean; onChange: () => void; label: string }) {
  return (
    <button type="button" role="switch" aria-checked={on} className={s.rule} onClick={onChange}>
      <span className={s.ruleText}>{label}</span>
      <span className={s.switch} aria-hidden="true">
        <span className={s.knob} />
      </span>
    </button>
  );
}

/* ── last seven days, one scale ──────────────────────────────────────── */

export function WeekBars({ conn }: { conn: Conn }) {
  const max = Math.max(1, ...conn.week);
  const W = 300;
  const H = 88;
  const base = H - 20;
  const bw = 26;
  const step = W / 7;
  const total = conn.week.reduce((a, b) => a + b, 0);
  return (
    <figure className={s.week}>
      <figcaption className={s.weekCap}>
        <span>Last 7 days</span>
        <span className={s.num}>
          {total} {total === 1 ? conn.unit[0] : conn.unit[1]}
        </span>
      </figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} className={cx(s.weekSvg, pc(conn.project))} role="img" aria-label={`Last 7 days: ${conn.week.map((v, i) => `${DAYS[i]} ${v}`).join(", ")}`}>
        <line x1={0} x2={W} y1={base + 0.5} y2={base + 0.5} className={s.weekBase} />
        {conn.week.map((v, i) => {
          const h = (v / max) * (base - 16);
          const x = i * step + (step - bw) / 2;
          return (
            <g key={i}>
              {v > 0 ? <rect x={x} y={base - h} width={bw} height={h} rx={3} className={cx(s.weekBar, i === 6 && s.weekToday)} /> : <rect x={x} y={base - 2} width={bw} height={2} rx={1} className={s.weekZero} />}
              <text x={x + bw / 2} y={base - h - 5} textAnchor="middle" className={cx(s.weekVal, s.num)}>
                {v}
              </text>
              <text x={x + bw / 2} y={H - 4} textAnchor="middle" className={cx(s.weekDay, i === 6 && s.weekDayToday)}>
                {DAYS[i]}
              </text>
            </g>
          );
        })}
      </svg>
    </figure>
  );
}

/* ── what needs you ──────────────────────────────────────────────────── */

export function HealthNote({ conns, onAct, onOpen, onHover, compact }: { compact?: boolean; conns: Conn[]; onAct: (c: Conn) => void; onOpen: (id: string) => void; onHover: (id: string | null) => void }) {
  const needs = conns.filter((c) => c.status === "broken" || c.status === "waiting");
  if (!needs.length) return null;
  return (
    <section className={cx(s.health, compact && s.healthCompact)} aria-label="Needs you">
      {needs.map((c) => {
        const from = nodeById(c.from);
        const broken = c.status === "broken";
        return (
          <div key={c.id} className={cx(s.healthRow, broken ? s.healthBroken : s.healthWaiting)} onPointerEnter={() => onHover(c.id)} onPointerLeave={() => onHover(null)} onFocus={() => onHover(c.id)} onBlur={() => onHover(null)}>
            <span className={s.healthIcon}>
              <Icon name={broken ? "warn" : "wait"} size={15} />
            </span>
            <div className={s.healthBody}>
              <p className={s.healthText}>{broken ? `${from.name} stopped sending on 23 September.` : `${from.name} is waiting for you to allow access`}</p>
              {!compact && <p className={s.healthSub}>{c.label}</p>}
              <div className={s.healthActs}>
                <button type="button" className={cx(s.btn, s.btnSm, broken ? s.btnWarn : s.btnQuiet)} onClick={() => onAct(c)}>
                  {broken ? "Sign in again" : "Allow access"}
                </button>
                <button type="button" className={s.linkBtn} onClick={() => onOpen(c.id)}>
                  Details
                </button>
              </div>
            </div>
          </div>
        );
      })}
    </section>
  );
}
