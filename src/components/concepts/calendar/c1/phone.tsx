"use client";

import { useRef, useState, type CSSProperties, type ReactNode, type RefObject } from "react";
import {
  PROJECT,
  STATUS_LABEL,
  TODAY,
  WEEKDAYS,
  covers,
  dayLoad,
  dayMonth,
  isOverdue,
  isSpan,
  monthWeeks,
  parseIso,
  relativeDay,
  shortDay,
  taskOrder,
  weekday,
  type Task,
  type YM,
} from "./data";
import { AvatarStack, loadSentence, loadTone } from "./bits";
import { Check, ClockAlert, Diamond, StatusGlyph } from "./icons";
import { GHOST_ID } from "./layout";
import type { Parsed } from "./parse";
import { QuickAdd } from "./quickadd";
import styles from "./cal.module.css";

type Props = {
  ym: YM;
  tasks: Task[];
  selected: string;
  pulse: { date: string; key: number } | null;
  settleId: string | null;
  query: string;
  parsed: Parsed;
  inputRef: RefObject<HTMLInputElement | null>;
  undatedCount: number;
  filters: ReactNode;
  header: ReactNode;
  emptyNote: ReactNode;
  onStep: (dir: number) => void;
  onSelect: (iso: string) => void;
  onQuery: (v: string) => void;
  onSubmit: () => void;
  onToggle: (id: string) => void;
};

export function PhoneCalendar(p: Props) {
  const [expanded, setExpanded] = useState(false);
  const [dragDy, setDragDy] = useState(0);
  const swipe = useRef<{ x: number; y: number } | null>(null);
  const handle = useRef<{ y: number; moved: boolean } | null>(null);

  const weeks = monthWeeks(p.ym);
  const selWeek = weeks.find((w) => w.includes(p.selected)) ?? weeks[0];
  const shownWeeks = expanded ? [selWeek] : weeks;
  const dayTasks = p.tasks.filter((t) => covers(t, p.selected));
  const milestones = dayTasks.filter((t) => t.milestone);
  const list = dayTasks.filter((t) => !t.milestone).sort((a, b) => (a.id === GHOST_ID ? -1 : b.id === GHOST_ID ? 1 : taskOrder(a, b)));
  const load = dayLoad(dayTasks.filter((t) => t.id !== GHOST_ID), p.selected);
  const rel = relativeDay(p.selected);

  return (
    <div className={styles.phone}>
      {p.header}
      <div className={styles.phoneFilters}>{p.filters}</div>
      <div
        className={styles.phoneMonth}
        data-expanded={expanded ? "" : undefined}
        onPointerDown={(e) => {
          swipe.current = { x: e.clientX, y: e.clientY };
        }}
        onPointerUp={(e) => {
          const s = swipe.current;
          swipe.current = null;
          if (!s || expanded) return;
          const dx = e.clientX - s.x;
          const dy = e.clientY - s.y;
          if (Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(dy) * 1.4) p.onStep(dx < 0 ? 1 : -1);
        }}
      >
        <div className={styles.phoneDow} aria-hidden>
          {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
            <span key={i} data-weekend={i >= 5 ? "" : undefined}>
              {d}
            </span>
          ))}
        </div>
        <div className={styles.phoneGrid} role="grid" aria-label="Month">
          {shownWeeks.map((week) => (
            <div role="row" key={week[0]} className={styles.phoneWeek}>
              {week.map((iso) => {
                const here = p.tasks.filter((t) => covers(t, iso));
                const l = dayLoad(here.filter((t) => t.id !== GHOST_ID), iso);
                const projects = [...new Set(here.filter((t) => t.status !== "done").map((t) => t.project))].slice(0, 3);
                const out = parseIso(iso).getUTCMonth() !== p.ym.m;
                const ms = here.some((t) => t.milestone);
                return (
                  <button
                    key={iso}
                    type="button"
                    role="gridcell"
                    className={styles.phoneDay}
                    data-tone={loadTone(l.open)}
                    data-out={out ? "" : undefined}
                    data-today={iso === TODAY ? "" : undefined}
                    data-selected={iso === p.selected ? "" : undefined}
                    data-ghost={here.some((t) => t.id === GHOST_ID) ? "" : undefined}
                    aria-selected={iso === p.selected}
                    aria-label={`${shortDay(iso)}. ${loadSentence(l.open, l.done, l.people)}${ms ? ". Milestone" : ""}`}
                    onClick={() => p.onSelect(iso)}
                  >
                    {p.pulse?.date === iso ? <span key={p.pulse.key} className={styles.pulse} aria-hidden /> : null}
                    <span className={styles.phoneNum}>{parseIso(iso).getUTCDate()}</span>
                    <span className={styles.phoneDots} aria-hidden>
                      {ms ? <Diamond size={6} color="var(--v3-text-2)" /> : null}
                      {projects.map((id) => (
                        <i key={id} style={{ "--p": PROJECT[id].color } as CSSProperties} />
                      ))}
                    </span>
                  </button>
                );
              })}
            </div>
          ))}
        </div>
        {p.emptyNote}
      </div>

      <section
        className={styles.sheet}
        data-expanded={expanded ? "" : undefined}
        style={{ "--dy": `${dragDy}px` } as CSSProperties}
        aria-label={`${WEEKDAYS[weekday(p.selected)]} ${dayMonth(p.selected)}`}
      >
        <button
          type="button"
          className={styles.sheetHandle}
          aria-label={expanded ? "Show the whole month" : "Show more of this day"}
          aria-expanded={expanded}
          onPointerDown={(e) => {
            handle.current = { y: e.clientY, moved: false };
            e.currentTarget.setPointerCapture(e.pointerId);
          }}
          onPointerMove={(e) => {
            if (!handle.current) return;
            const dy = e.clientY - handle.current.y;
            if (Math.abs(dy) > 4) handle.current.moved = true;
            setDragDy(Math.max(-160, Math.min(160, dy)));
          }}
          onPointerUp={(e) => {
            const h = handle.current;
            handle.current = null;
            setDragDy(0);
            if (!h) return;
            const dy = e.clientY - h.y;
            if (!h.moved) setExpanded((x) => !x);
            else if (dy < -30) setExpanded(true);
            else if (dy > 30) setExpanded(false);
          }}
          onPointerCancel={() => {
            handle.current = null;
            setDragDy(0);
          }}
        >
          <span />
        </button>
        <header className={styles.sheetHead}>
          <div>
            <h2>
              {WEEKDAYS[weekday(p.selected)]} {dayMonth(p.selected)}
            </h2>
            <p>
              {rel ? `${rel} · ` : ""}
              {loadSentence(load.open, load.done, load.people)}
            </p>
          </div>
        </header>
        {milestones.map((m) => (
          <div key={m.id} className={styles.peekMilestone} style={{ "--p": PROJECT[m.project].color } as CSSProperties}>
            <Diamond size={12} color="var(--p)" />
            <div>
              <strong>{m.title}</strong>
              <span>Milestone · {PROJECT[m.project].short}</span>
            </div>
          </div>
        ))}
        {list.length === 0 && milestones.length === 0 ? (
          <p className={styles.sheetEmpty}>Nothing on this day. Type below to add something.</p>
        ) : null}
        <ul className={styles.sheetList}>
          {list.map((t) => {
            const ghost = t.id === GHOST_ID;
            return (
              <li
                key={t.id}
                className={styles.sheetRow}
                data-done={t.status === "done" ? "" : undefined}
                data-ghost={ghost ? "" : undefined}
                data-settle={p.settleId === t.id ? "" : undefined}
                style={{ "--p": PROJECT[t.project].color } as CSSProperties}
              >
                {ghost ? (
                  <span className={styles.ghostDot} aria-hidden>
                    +
                  </span>
                ) : (
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={t.status === "done"}
                    aria-label={`Done: ${t.title}`}
                    className={styles.check}
                    onClick={() => p.onToggle(t.id)}
                  >
                    <Check size={12} />
                  </button>
                )}
                <div className={styles.sheetMain}>
                  <span className={styles.sheetTitle}>{t.title || "New task"}</span>
                  <span className={styles.peekMeta}>
                    <span className={styles.projDot} aria-hidden />
                    {PROJECT[t.project].short}
                    {ghost ? <span>· Press return to add</span> : null}
                    {!ghost && isOverdue(t) ? (
                      <span className={styles.lateTag}>
                        <ClockAlert /> Late
                      </span>
                    ) : null}
                    {!ghost && isSpan(t) ? <span>· Until {shortDay(t.end as string)}</span> : null}
                  </span>
                </div>
                {!ghost ? (
                  <span className={styles.peekSide}>
                    <span className={styles.srOnly}>{STATUS_LABEL[t.status]}</span>
                    <StatusGlyph status={t.status} />
                    <AvatarStack people={t.people} guests={t.guests} size={22} max={2} />
                  </span>
                ) : null}
              </li>
            );
          })}
        </ul>
        <p className={styles.sheetFoot}>{p.undatedCount} tasks still need a date.</p>
      </section>

      <div className={styles.phoneQuick}>
        <QuickAdd value={p.query} parsed={p.parsed} inputRef={p.inputRef} onChange={p.onQuery} onSubmit={p.onSubmit} compact />
      </div>
    </div>
  );
}
