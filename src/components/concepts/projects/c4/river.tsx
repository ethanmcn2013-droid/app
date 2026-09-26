"use client";

import { Fragment, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Icon } from "./icons";
import { AvatarStack, HealthDot, IdTile, NodeGlyph, StatusPill } from "./parts";
import { HubBody, StationsVertical } from "./hub";
import {
  HEALTH_COLOR,
  HEALTH_LANES,
  countLine,
  crunchLabel,
  crunchRange,
  crunchSentence,
  crunches,
  dated,
  fmtDayMonth,
  fmtShort,
  fmtUntil,
  fullLabel,
  monthName,
  nextMilestone,
  parts,
  weekStart,
  type Crunch,
  type Health,
  type Project,
} from "./data";
import { radiusFor } from "./layout";
import s from "./river.module.css";

type Item =
  | { type: "today"; day: number }
  | { type: "month"; day: number; label: string }
  | { type: "crunch"; day: number; c: Crunch }
  | { type: "project"; day: number; p: Project };

const COL: Record<Health, number> = { good: 0, watch: 1, help: 2 };
const EST: Record<Item["type"], number> = { today: 30, month: 30, crunch: 44, project: 74 };

export function River({ projects, onList }: { projects: Project[]; onList: () => void }) {
  const reduce = useReducedMotion();
  const [scale, setScale] = useState(9);
  const [open, setOpen] = useState<string | null>(null);
  const pointers = useRef(new Map<number, number>());
  const pinch = useRef<{ dist: number; scale: number } | null>(null);

  const list = dated(projects);
  const past = list.filter((p) => p.unwrapped);
  const upcoming = list.filter((p) => !p.unwrapped);
  const undated = projects.filter((p) => p.day === undefined);
  const crunch = crunches(projects);
  const inCrunch = (p: Project) => crunch.find((c) => c.projects.includes(p.id));
  const months = scale < 8;

  // Months is an overview: tap a month to read it week by week.
  const showMonth = (key: string) => {
    setScale(12);
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        const el = document.querySelector<HTMLElement>(`[data-river-month="${key}"]`);
        el?.scrollIntoView({ block: "start", behavior: reduce ? "auto" : "smooth" });
      }),
    );
  };

  const items: Item[] = [{ type: "today", day: 0 }];
  const last = Math.max(0, ...upcoming.map((p) => p.day ?? 0));
  for (let d = 1; d <= last; d++) if (parts(d).d === 1) items.push({ type: "month", day: d, label: `${monthName(parts(d).m)}${parts(d).m === 0 ? ` ${parts(d).y}` : ""}` });
  // The river's month rows, for the Months overview.
  const monthRows: { key: string; label: string; first: number; days: number; list: Project[] }[] = [];
  for (let d = 0; d <= last; d++) {
    const pt = parts(d);
    if (d !== 0 && pt.d !== 1) continue;
    const first = d - (pt.d - 1);
    let days = 28;
    while (parts(first + days).m === pt.m) days++;
    monthRows.push({
      key: `${pt.y}-${pt.m}`,
      label: `${monthName(pt.m)}${pt.y !== 2026 ? ` ${pt.y}` : ""}`,
      first,
      days,
      list: upcoming.filter((p) => (p.day ?? 0) >= Math.max(first, 0) && (p.day ?? 0) < first + days),
    });
  }
  for (const c of crunch) items.push({ type: "crunch", day: c.start, c });
  for (const p of upcoming) items.push({ type: "project", day: p.day ?? 0, p });
  const rank = { today: 0, month: 1, crunch: 2, project: 3 };
  items.sort((a, b) => a.day - b.day || rank[a.type] - rank[b.type]);

  const onDown = (e: ReactPointerEvent) => {
    if (e.pointerType !== "touch") return;
    pointers.current.set(e.pointerId, e.clientY);
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      pinch.current = { dist: Math.abs(a - b) || 1, scale };
    }
  };
  const onMove = (e: ReactPointerEvent) => {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, e.clientY);
    if (pinch.current && pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      const next = Math.max(3, Math.min(26, (pinch.current.scale * Math.abs(a - b)) / pinch.current.dist));
      setScale(next);
    }
  };
  const onUp = (e: ReactPointerEvent) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) pinch.current = null;
  };

  const spacers: number[] = [];
  for (let i = 0; i < items.length; i++) {
    const prev = items[i - 1];
    if (!prev) {
      spacers.push(0);
      continue;
    }
    if (prev.type === "project" && open === prev.p.id) {
      spacers.push(12);
      continue;
    }
    const gap = (items[i].day - prev.day) * scale - EST[prev.type];
    spacers.push(Math.min(Math.max(6, gap), 360));
  }

  return (
    <div className={s.river}>
      <header className={s.head}>
        <h1 className={s.h1}>Projects</h1>
        <p className={s.reading}>
          {countLine(projects)}
          {crunch.length ? <span className={s.crunchLine}>{crunchSentence(crunch[0])}</span> : null}
        </p>
        <div className={s.controls}>
          <div className={s.segmented} role="group" aria-label="Time scale">
            <button type="button" aria-pressed={!months} className={s.seg} onClick={() => setScale(12)}>
              Weeks
            </button>
            <button type="button" aria-pressed={months} className={s.seg} onClick={() => setScale(4)}>
              Months
            </button>
          </div>
          <button type="button" className={s.listBtn} onClick={onList}>
            <Icon name="list" size={14} />
            View as list
          </button>
        </div>
        <div className={s.key} aria-hidden="true">
          {HEALTH_LANES.map((l) => (
            <span key={l.id} className={s.keyItem}>
              <HealthDot health={l.id} />
              {l.label}
            </span>
          ))}
        </div>
      </header>

      {past.length ? (
        <section className={s.past} aria-label="Past, not wrapped">
          <h2 className={s.pastTitle}>Past, not wrapped</h2>
          {past.map((p) => (
            <button key={p.id} type="button" className={s.pastRow} aria-label={fullLabel(p)} onClick={() => setOpen(open === p.id ? null : p.id)}>
              <NodeGlyph p={p} r={11} ring="var(--v3-text-3)" fill={HEALTH_COLOR[p.health]} muted />
              <span className={s.pastName}>{p.name}</span>
              <span className={s.pastMeta}>{-(p.day ?? 0)} days over</span>
            </button>
          ))}
        </section>
      ) : null}

      {months ? (
        <ol className={s.months} aria-label="Months ahead">
          {monthRows.map((m) => (
            <li key={m.key}>
              <MonthRow m={m} crunch={crunch} onOpen={() => showMonth(m.key)} />
            </li>
          ))}
        </ol>
      ) : (
      <div
        className={s.flow}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        style={{ "--scale": scale } as CSSProperties}
      >
        <div className={s.track} aria-hidden="true">
          <span data-col="0" />
          <span data-col="1" />
          <span data-col="2" />
        </div>
        {items.map((it, i) => {
          const spacer = spacers[i];
          const key = `${it.type}-${it.day}-${it.type === "project" ? it.p.id : ""}`;
          return (
            <Fragment key={key}>
              <div style={{ height: spacer }} aria-hidden="true" />
              {it.type === "today" ? (
                <div className={s.today}>
                  <span className={s.todayDot} aria-hidden="true" />
                  <span className={s.todayText}>Today · {fmtShort(0)}</span>
                </div>
              ) : it.type === "month" ? (
                <div className={s.month} data-river-month={`${parts(it.day).y}-${parts(it.day).m}`}>
                  <span>{it.label}</span>
                </div>
              ) : it.type === "crunch" ? (
                <div className={s.crunch}>
                  <Icon name="alert" size={14} />
                  <span>
                    <strong>Crunch {crunchRange(it.c)}</strong>
                    {crunchLabel(it.c)}
                  </span>
                </div>
              ) : (
                <RiverRow
                  p={it.p}
                  scale={scale}
                  crunch={!!inCrunch(it.p)}
                  open={open === it.p.id}
                  onToggle={() => setOpen(open === it.p.id ? null : it.p.id)}
                  all={projects}
                  reduce={!!reduce}
                />
              )}
            </Fragment>
          );
        })}
      </div>
      )}

      {undated.length ? (
        <section className={s.undated} aria-labelledby="c4-river-nodate">
          <h2 id="c4-river-nodate" className={s.pastTitle}>
            No date · {undated.length}
          </h2>
          {undated.map((p) => (
            <div key={p.id} className={s.undatedRow}>
              <IdTile p={p} size={24} />
              <span className={s.pastName}>{p.name}</span>
              <span className={s.pastMeta}>{p.open} open</span>
            </div>
          ))}
        </section>
      ) : null}
      <p className={s.pinchHint}>{months ? "Tap a month to see it week by week." : "Pinch to stretch or squeeze time."}</p>
    </div>
  );
}

function RiverRow({
  p,
  scale,
  crunch,
  open,
  onToggle,
  all,
  reduce,
}: {
  p: Project;
  scale: number;
  crunch: boolean;
  open: boolean;
  onToggle: () => void;
  all: Project[];
  reduce: boolean;
}) {
  const r = Math.min(16, radiusFor(p.open) * 0.72);
  const nm = nextMilestone(p);
  const col = COL[p.health];
  const span = p.endDay !== undefined ? (p.endDay - (p.day ?? 0)) * scale : 0;
  return (
    <div className={s.row} data-open={open ? "" : undefined} data-crunch={crunch ? "" : undefined}>
      {open ? (
        <span className={s.openSpines} aria-hidden="true">
          <span data-col="0" data-own={col === 0 ? "" : undefined} />
          <span data-col="1" data-own={col === 1 ? "" : undefined} />
          <span data-col="2" data-own={col === 2 ? "" : undefined} />
        </span>
      ) : null}
      <button type="button" className={s.rowBtn} aria-expanded={open} aria-label={fullLabel(p)} onClick={onToggle}>
        <span className={s.marker} style={{ left: 18 + col * 16 - r, "--r": `${r}px` } as CSSProperties} aria-hidden="true">
          {span ? <span className={s.spanBar} style={{ height: Math.min(span, 280), background: HEALTH_COLOR[p.health] }} /> : null}
          <NodeGlyph p={p} r={r} ring="var(--v3-text-3)" fill={HEALTH_COLOR[p.health]} />
        </span>
        <span className={s.rowText}>
          <span className={s.rowLine1}>
            <span className={s.rowName}>{p.name}</span>
          </span>
          <span className={s.rowLine2}>
            <strong>{fmtUntil(p.day ?? 0)}</strong> · {p.endDay !== undefined ? `${fmtDayMonth(p.day ?? 0)} to ${fmtDayMonth(p.endDay)}` : fmtShort(p.day ?? 0)}
            {p.overdue ? <span className={s.overdue}> · {p.overdue} overdue</span> : null}
          </span>
          {nm && !open ? <span className={s.rowLine3}>Next: {nm.label}</span> : null}
        </span>
        <span className={s.rowEnd}>
          <AvatarStack ids={p.team} size={20} />
          <Icon name="chevron-right" size={14} className={s.chev} />
        </span>
      </button>
      <AnimatePresence initial={false}>
        {open ? (
          <motion.div
            className={s.expand}
            initial={reduce ? { opacity: 0 } : { height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={reduce ? { opacity: 0 } : { height: 0, opacity: 0 }}
            transition={{ duration: 0.28, ease: [0.2, 0.8, 0.2, 1] }}
          >
            <div className={s.expandInner}>
              <div className={s.expandHead}>
                <StatusPill p={p} />
                <span className={s.signal}>{p.signal}</span>
              </div>
              <StationsVertical p={p} />
              <HubBody p={p} all={all} compact />
              <button type="button" className={s.openBtn}>
                Open project
                <Icon name="arrow-right" size={14} />
              </button>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

/** One month at a glance: its weeks as cells, each project a dot on its day. */
function MonthRow({
  m,
  crunch,
  onOpen,
}: {
  m: { key: string; label: string; first: number; days: number; list: Project[] };
  crunch: Crunch[];
  onOpen: () => void;
}) {
  const wks: number[] = [];
  for (let w = weekStart(m.first); w < m.first + m.days; w += 7) wks.push(w);
  const span = wks.length * 7;
  const origin = wks[0];
  const hot = crunch.filter((c) => c.start < m.first + m.days && c.end > m.first);
  const names = m.list.map((p) => p.short);
  const summary = names.length ? (names.length <= 2 ? names.join(" and ") : `${names.slice(0, 2).join(", ")} and ${names.length - 2} more`) : "Nothing lands";
  return (
    <button
      type="button"
      className={s.monthRow}
      onClick={onOpen}
      aria-label={`${m.label}: ${m.list.length} ${m.list.length === 1 ? "project" : "projects"}${m.list.length ? `, ${m.list.map((p) => p.name).join(", ")}` : ""}${hot.length ? `. ${crunchSentence(hot[0])}` : ""}. Show it week by week`}
    >
      <span className={s.monthHead}>
        <span className={s.monthName}>{m.label}</span>
        <span className={s.monthCount}>{m.list.length}</span>
        <Icon name="chevron-right" size={14} className={s.chev} />
      </span>
      <span className={s.strip} aria-hidden="true">
        {wks.map((w) => {
          const inHot = hot.some((c) => w >= c.start && w < c.end);
          return <span key={w} className={s.stripWeek} data-hot={inHot ? "" : undefined} style={{ left: `${((w - origin) / span) * 100}%`, width: `${(7 / span) * 100}%` }} />;
        })}
        {m.first >= 0 ? null : <span className={s.stripPast} style={{ width: `${((0 - origin) / span) * 100}%` }} />}
        {m.list.map((p, i) => {
          const sameDay = m.list.slice(0, i).filter((q) => q.day === p.day).length;
          return (
            <span
              key={p.id}
              className={s.stripDot}
              style={{ left: `${(((p.day ?? 0) - origin + 0.5) / span) * 100}%`, "--dot": HEALTH_COLOR[p.health], "--lift": `${sameDay * -9}px` } as CSSProperties}
            />
          );
        })}
      </span>
      <span className={s.monthSummary}>
        {summary}
        {hot.length ? <span className={s.monthCrunch}> · crunch</span> : null}
      </span>
    </button>
  );
}
