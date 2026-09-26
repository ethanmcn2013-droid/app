"use client";

import { useState, type CSSProperties } from "react";
import { motion, useReducedMotion } from "motion/react";
import { Icon } from "./icons";
import { Avatar, FileIcon, IdTile, NodeGlyph, StatusPill } from "./parts";
import {
  HEALTH_COLOR,
  KIND_LABEL,
  PEOPLE,
  crunchRange,
  fmtDayMonth,
  fmtIn,
  fmtLong,
  fmtShort,
  load,
  parts,
  monthShort,
  weekStart,
  type Crunch,
  type Project,
} from "./data";
import { cx, sx, type Camera } from "./layout";
import s from "./map.module.css";

export const HUB_PAD_L = 96;
export const HUB_PAD_R = 88;
export const HUB_TOP = 112;
/** The card's 1px border: stations are drawn inside it, in page space. */
const HUB_BORDER = 1;

/**
 * The useful stretch of a project: from just before its first open milestone
 * (or a couple of days before today, so "now" is always in view) to just
 * after it lands. Milestones already done before that fold into one marker.
 */
export function hubRange(p: Project) {
  const land = p.day ?? 0;
  const end = Math.max((p.endDay ?? land) + 2, 2);
  const open = p.milestones.filter((m) => !m.done).map((m) => m.day);
  const firstOpen = open.length ? Math.min(...open) : land;
  let start = Math.min(firstOpen - 3, -2, land < 0 ? land - 2 : Infinity);
  if (end - start < 10) start = end - 10;
  return { start, end };
}

/** Camera that lays the project's useful stretch across the viewport. */
export function hubCamera(p: Project, w: number): Camera {
  const { start, end } = hubRange(p);
  const cardL = 20;
  const cardR = w - 20;
  const scale = Math.min(96, (cardR - cardL - HUB_PAD_L - HUB_PAD_R) / Math.max(4, end - start));
  return { scale, x0: start - (cardL + HUB_PAD_L) / scale };
}

function weekTicks(start: number, end: number) {
  const out: number[] = [];
  for (let d = weekStart(start) + 7; d <= end + 1; d += 7) out.push(d);
  return out;
}

type Placed = { day: number; label: string; done?: boolean; final?: boolean; next?: boolean; up: boolean; far: boolean; flip: boolean };

/**
 * Labels alternate above and below the rail; a label that would touch its
 * neighbour on the same side moves one step further out.
 */
function placeStations(
  list: { day: number; label: string; done?: boolean }[],
  p: Project,
  cam: Camera,
  rightLimit: number,
  reserved: [number, number][],
  boxes: [number, number][],
) {
  const end = p.endDay ?? p.day ?? 0;
  const nextIdx = list.findIndex((m) => !m.done && m.day !== end && m.day !== p.day);
  // The top band also carries the Today and crunch labels: far-above labels keep clear of them.
  const taken: [number, number][][] = [[], [], [...reserved], []];
  const out: Placed[] = [];
  list.forEach((m, i) => {
    const x = cx(cam, m.day);
    const date = `${fmtShort(m.day)}${m.done ? " · done" : i === nextIdx ? " · next" : ""}`;
    // Station labels are short and set tight: a closer estimate than the map's.
    const w = Math.ceil(Math.max(m.label.length * 12.5 * 0.52 + 4, date.length * 11.5 * 0.52)) + 14;
    let flip = x + w > rightLimit;
    // A label never straddles a crunch box edge: it stays inside the box or
    // turns to face away from it.
    for (const [l, r] of boxes) {
      const inside = x >= l && x <= r;
      if (!flip && !inside && x < l && x + w > l) flip = true;
      if (flip && inside && x - w < l && x + w <= rightLimit + 20) flip = false;
      if (!flip && inside && x + w > r && x - w >= l) flip = true;
    }
    const a = flip ? x - w : x - 2;
    const b = flip ? x + 2 : x + w;
    // Slots: 0 above near, 1 below near, 2 above far, 3 below far.
    const prefer = i % 2 === 0 ? [0, 1, 2, 3] : [1, 0, 3, 2];
    const fits = (l: number) => taken[l].every(([x1, x2]) => b + 12 < x1 || a - 12 > x2);
    const slot = prefer.find(fits) ?? prefer[prefer.length - 1];
    taken[slot].push([a, b]);
    out.push({
      day: m.day,
      label: m.label,
      done: m.done,
      final: m.day === end || m.day === p.day,
      next: i === nextIdx,
      up: slot % 2 === 0,
      far: slot >= 2,
      flip,
    });
  });
  return out;
}

export function HubCard({
  p,
  cam,
  size,
  crunch,
  all,
  origin,
  onClose,
}: {
  p: Project;
  cam: Camera;
  size: { w: number; h: number };
  crunch: Crunch[];
  all: Project[];
  origin: { x: number; y: number } | null;
  onClose: () => void;
}) {
  const reduce = useReducedMotion();
  const { start, end } = hubRange(p);
  const left = sx(cam, start) - HUB_PAD_L;
  const right = sx(cam, end) + HUB_PAD_R;
  const top = HUB_TOP;
  const bottom = size.h - 88;
  const width = right - left;
  const height = bottom - top;
  // Page space to card space: every tick and dot sits exactly under the ruler.
  const rel = (x: number) => x - left - HUB_BORDER;
  const inRange = [...p.milestones].filter((m) => m.day >= start).sort((a, b) => a.day - b.day);
  const folded = p.milestones.filter((m) => m.day < start);
  const myCrunch = crunch.filter((c) => c.projects.includes(p.id));
  const reserved: [number, number][] = [
    [cx(cam, 0) - 4, cx(cam, 0) + 52],
    ...myCrunch.map((c): [number, number] => [sx(cam, c.start), sx(cam, c.start) + 150]),
  ];
  const boxes = myCrunch.map((c): [number, number] => [sx(cam, c.start), sx(cam, c.end)]);
  const stations = placeStations(inRange, p, cam, right - 16, reserved, boxes);
  const todayX = rel(cx(cam, 0));
  const narrow = width < 980;
  const health = HEALTH_COLOR[p.health];
  const ox = origin ? origin.x - left : width;
  const oy = origin ? origin.y - top : 60;
  const railFrom = folded.length ? rel(sx(cam, start)) - 40 : rel(cx(cam, inRange[0]?.day ?? start));
  const railTo = rel(cx(cam, p.endDay ?? p.day ?? end));
  const foldText = folded.map((m) => `${m.label}, ${fmtShort(m.day)}`);

  return (
    <motion.section
      className={s.hub}
      style={{ left, top, width, maxHeight: height, transformOrigin: `${ox}px ${oy}px` } as CSSProperties}
      initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.12 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.12, transition: { duration: 0.24, ease: [0.4, 0, 0.2, 1] } }}
      transition={{ duration: 0.42, ease: [0.2, 0.8, 0.2, 1] }}
      aria-labelledby={`hub-${p.id}`}
      role="region"
      data-narrow={narrow ? "" : undefined}
      data-scrollable=""
    >
      <header className={s.hubHead}>
        <IdTile p={p} size={40} />
        <div className={s.hubTitleBlock}>
          <h2 id={`hub-${p.id}`} className={s.hubTitle}>
            {p.name}
          </h2>
          <p className={s.hubSub}>
            {KIND_LABEL[p.kind]} ·{" "}
            {p.endDay !== undefined ? `${fmtShort(p.day ?? 0)} to ${fmtShort(p.endDay)}` : fmtLong(p.day ?? 0)} ·{" "}
            {p.unwrapped ? `${-(p.day ?? 0)} days past, not wrapped` : p.endDay !== undefined ? `starts ${fmtIn(p.day ?? 0)}` : fmtIn(p.day ?? 0)}
          </p>
        </div>
        <div className={s.hubMeta}>
          <StatusPill p={p} />
          <div className={s.hubStats}>
            <NodeGlyph p={p} r={15} ring="var(--v3-text-3)" fill={health} />
            <div>
              <div className={s.hubStatBig}>{p.progress}% done</div>
              <div className={s.hubStatSmall}>
                {p.open} open{p.overdue ? <span className={s.overdueText}> · {p.overdue} overdue</span> : null}
              </div>
            </div>
          </div>
        </div>
        <button type="button" className={s.iconBtn} data-close="" onClick={onClose} aria-label="Back to the map">
          <Icon name="close" />
        </button>
      </header>

      <div className={s.hubSignal}>
        <Icon name={p.health === "good" ? "check" : "alert"} size={14} />
        <span>{p.signal}</span>
      </div>

      <div className={s.stations} aria-label="Milestones, on the same dates as the ruler above" role="list">
        {myCrunch.map((c) => {
          // A crunch that runs on past the card fades out at its edge instead
          // of being cut square by the card's border.
          const l = Math.max(0, rel(sx(cam, c.start)));
          const full = rel(sx(cam, c.end)) - l;
          const room = width - 2 - l;
          return (
            <div
              key={c.start}
              className={s.stationCrunch}
              data-runs-on={full > room ? "" : undefined}
              style={{ left: l, width: Math.min(full, room) }}
              aria-hidden="true"
            >
              <span>Crunch {crunchRange(c)}</span>
            </div>
          );
        })}
        {weekTicks(start, end).map((d) => (
          <span key={d} className={s.stationTick} style={{ left: rel(sx(cam, d)) }} aria-hidden="true" />
        ))}
        <span className={s.stationRail} style={{ left: railFrom, width: Math.max(0, railTo - railFrom) }} aria-hidden="true" />
        <span className={s.stationDone} style={{ left: railFrom, width: Math.max(0, Math.min(todayX, railTo) - railFrom) }} aria-hidden="true" />
        {todayX >= 0 && todayX <= width ? (
          <span className={s.stationToday} style={{ left: todayX }} aria-hidden="true">
            <span>Today</span>
          </span>
        ) : null}
        {folded.length ? (
          <div role="listitem" className={s.stationFold} style={{ left: railFrom, "--station": "var(--v3-text-3)" } as CSSProperties} title={foldText.join("\n")}>
            <span className={s.stationFoldDots} aria-hidden="true">
              {folded.slice(0, 3).map((m) => (
                <span key={m.label} />
              ))}
            </span>
            <span className={s.stationFoldText}>
              {folded.length} done
              <span className={s.srOnly}>: {foldText.join("; ")}</span>
            </span>
          </div>
        ) : null}
        {stations.map((st) => (
          <div
            key={`${st.day}-${st.label}`}
            role="listitem"
            className={s.station}
            data-done={st.done ? "" : undefined}
            data-final={st.final ? "" : undefined}
            data-next={st.next ? "" : undefined}
            data-up={st.up ? "" : undefined}
            data-far={st.far ? "" : undefined}
            data-flip={st.flip ? "" : undefined}
            style={{ left: rel(cx(cam, st.day)), "--station": st.final ? health : "var(--v3-text-3)" } as CSSProperties}
          >
            <span className={s.stationDot} aria-hidden="true" />
            <span className={s.stationLabel}>
              <span className={s.stationName}>{st.label}</span>
              <span className={s.stationDate}>
                {fmtShort(st.day)}
                {st.done ? " · done" : st.next ? " · next" : ""}
              </span>
            </span>
          </div>
        ))}
      </div>

      <div className={s.hubScroll} data-scrollable="">
        <HubBody p={p} all={all} />
      </div>
    </motion.section>
  );
}

export function HubBody({ p, all, compact }: { p: Project; all: Project[]; compact?: boolean }) {
  const [done, setDone] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(p.tasks.map((t) => [t.title, !!t.done])),
  );
  const ws = weekStart(0);
  return (
    <div className={s.hubGrid} data-compact={compact ? "" : undefined}>
      <section className={s.hubCol} aria-label="This week">
        <h3 className={s.hubColTitle}>
          This week <span className={s.count}>{p.tasks.filter((t) => !done[t.title]).length}</span>
        </h3>
        <ul className={s.taskList}>
          {p.tasks.map((t) => {
            const isDone = done[t.title];
            const late = !isDone && t.due < 0;
            return (
              <li key={t.title} className={s.task} data-done={isDone ? "" : undefined}>
                <button
                  type="button"
                  className={s.check}
                  aria-pressed={isDone}
                  aria-label={`${isDone ? "Reopen" : "Complete"} ${t.title}`}
                  onClick={() => setDone((d) => ({ ...d, [t.title]: !d[t.title] }))}
                >
                  {isDone ? <Icon name="check" size={12} /> : null}
                </button>
                <span className={s.taskTitle}>{t.title}</span>
                <span className={s.taskMeta} data-late={late ? "" : undefined}>
                  {late ? `${-t.due}d late` : t.due === 0 ? "Today" : t.due === 1 ? "Tomorrow" : fmtShort(t.due).slice(0, 3)}
                </span>
                <Avatar id={t.who} size={20} />
              </li>
            );
          })}
        </ul>
      </section>
      <section className={s.hubCol} aria-label="People">
        <h3 className={s.hubColTitle}>
          People <span className={s.count}>{p.team.length}</span>
          <span className={s.loadHeading} title="How full each person's week is, across all their projects. 100% is a full week; over 100% means they are stretched.">
            This week&rsquo;s load
          </span>
        </h3>
        <ul className={s.peopleList}>
          {p.team.map((id) => {
            const l = load(all, id, ws);
            const person = PEOPLE[id];
            const pct = Math.round(l.share * 100);
            return (
              <li key={id} className={s.person}>
                <Avatar id={id} size={28} />
                <span className={s.personText}>
                  <span className={s.personName}>
                    {person.first}
                    {id === p.owner ? <span className={s.ownerTag}>Owner</span> : null}
                  </span>
                  <span className={s.personRole}>{person.role}</span>
                </span>
                <span className={s.personLoad} data-over={pct >= 100 ? "" : undefined} title={`${person.first} this week: ${pct}% of a full week, across all their projects`}>
                  <span className={s.personLoadBar} aria-hidden="true">
                    <span style={{ width: `${Math.min(100, pct)}%` }} />
                  </span>
                  <span className={s.personLoadText}>{pct}%</span>
                </span>
              </li>
            );
          })}
        </ul>
      </section>
      <section className={s.hubCol} aria-label="Key links">
        <h3 className={s.hubColTitle}>
          Key links <span className={s.count}>{p.links.length}</span>
        </h3>
        <ul className={s.linkList}>
          {p.links.map((l) => (
            <li key={l.title}>
              <a className={s.linkRow} href="#" onClick={(e) => e.preventDefault()}>
                <FileIcon kind={l.kind} />
                <span className={s.linkText}>
                  <span className={s.linkTitle}>{l.title}</span>
                  <span className={s.linkMeta}>{l.meta}</span>
                </span>
              </a>
            </li>
          ))}
        </ul>
      </section>
      {!compact ? (
        <section className={s.hubCol} aria-label="Recent activity">
          <h3 className={s.hubColTitle}>Recent activity</h3>
          <ul className={s.activityList}>
            {p.activity.map((a) => (
              <li key={a.text} className={s.activity}>
                <Avatar id={a.who} size={20} />
                <span>
                  <strong>{PEOPLE[a.who].first}</strong> {a.text}
                  <span className={s.activityAgo}>{a.ago}</span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

/** Phone: milestones as stations down a short vertical rail. */
export function StationsVertical({ p }: { p: Project }) {
  const end = p.endDay ?? p.day ?? 0;
  const list = [...p.milestones].sort((a, b) => a.day - b.day);
  const nextIdx = list.findIndex((m) => !m.done && m.day !== end);
  const todayIdx = list.findIndex((m) => m.day >= 0);
  return (
    <ol className={s.vStations} style={{ "--station": "var(--v3-text-3)", "--final": HEALTH_COLOR[p.health] } as CSSProperties}>
      {list.map((m, i) => {
        const showToday = i === todayIdx;
        return (
          <li key={`${m.day}-${m.label}`} className={s.vStationWrap}>
            {showToday ? (
              <div className={s.vToday} aria-hidden="true">
                <span>Today · {fmtDayMonth(0)}</span>
              </div>
            ) : null}
            <div
              className={s.vStation}
              data-done={m.done ? "" : undefined}
              data-next={i === nextIdx ? "" : undefined}
              data-final={m.day === end ? "" : undefined}
            >
              <span className={s.stationDot} aria-hidden="true" />
              <span className={s.vStationName}>{m.label}</span>
              <span className={s.vStationDate}>
                {parts(m.day).d} {monthShort(parts(m.day).m)}
                {m.done ? " · done" : i === nextIdx ? " · next" : ""}
              </span>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
