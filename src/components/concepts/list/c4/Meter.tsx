"use client";

import { useState } from "react";
import { DAY_CHOICES, fmt, PROJECTS, type ProjectId } from "./data";
import { I } from "./icons";
import s from "./c4.module.css";

export type MeterItem = { id: string; title: string; project: ProjectId; min: number; done?: boolean; guessed?: boolean };

type Piece = { key: string; id: string; left: number; width: number; kind: "open" | "done" | "over" | "pending"; title: string };

function pieces(items: MeterItem[], pending: MeterItem | null, day: number): { list: Piece[]; scale: number } {
  const all = pending ? [...items, pending] : items;
  const total = all.reduce((n, i) => n + i.min, 0);
  const scale = Math.max(day, total);
  const list: Piece[] = [];
  let at = 0;
  for (const item of all) {
    const start = at;
    const end = at + item.min;
    at = end;
    const label = `${item.title}, ${fmt(item.min)}${item.guessed ? " (no estimate, counted as 15m)" : ""}`;
    const base = item === pending ? "pending" : item.done ? "done" : "open";
    const push = (a: number, b: number, kind: Piece["kind"], suffix: string) =>
      b > a && list.push({ key: item.id + suffix, id: item.id, left: (a / scale) * 100, width: ((b - a) / scale) * 100, kind, title: label });
    if (base === "open" && end > day) {
      push(start, Math.min(end, day), "open", "");
      push(Math.max(start, day), end, "over", ":over");
    } else push(start, end, base, "");
  }
  return { list, scale };
}

export function CapacityMeter({
  items,
  day,
  onDay,
  pending = null,
  hot,
  onHot,
  size = "lg",
  label = "planned",
  overAction,
  marks,
}: {
  items: MeterItem[];
  day: number;
  onDay?: (min: number) => void;
  pending?: MeterItem | null;
  hot?: string | null;
  onHot?: (id: string | null) => void;
  size?: "lg" | "sm";
  label?: string;
  overAction?: React.ReactNode;
  /** Parts of the day, in minutes from the start of the plan. */
  marks?: { label: string; start: number; end: number }[];
}) {
  const [menu, setMenu] = useState(false);
  const { list, scale } = pieces(items, pending, day);
  const planned = items.reduce((n, i) => n + i.min, 0) + (pending?.min ?? 0);
  const done = items.filter((i) => i.done).reduce((n, i) => n + i.min, 0);
  const over = planned - day;
  const guessed = items.filter((i) => i.guessed && !i.done).length + (pending?.guessed ? 1 : 0);
  const dayPct = (day / scale) * 100;

  return (
    <div className={s.meter} data-size={size} data-over={over > 0 || undefined}>
      <div className={s.meterTop}>
        <p className={s.meterSum}>
          <strong>{fmt(planned)}</strong> {label} of{" "}
          {onDay ? (
            <span className={s.dayWrap}>
              <button type="button" className={s.dayBtn} aria-haspopup="menu" aria-expanded={menu} onClick={() => setMenu((m) => !m)}>
                {fmt(day)}
                <I.down size={12} />
              </button>
              {menu && (
                <span className={s.dayMenu} role="menu">
                  <span className={s.dayMenuHead}>How long is your day?</span>
                  {DAY_CHOICES.map((d) => (
                    <button
                      key={d}
                      type="button"
                      role="menuitemradio"
                      aria-checked={d === day}
                      className={s.dayOpt}
                      onClick={() => {
                        onDay(d);
                        setMenu(false);
                      }}
                    >
                      {fmt(d)} of focused work
                    </button>
                  ))}
                </span>
              )}
            </span>
          ) : (
            <span>{fmt(day)}</span>
          )}
        </p>
        <p className={s.meterSide}>
          {done > 0 && (
            <span className={s.meterDone}>
              <span className={s.legendDone} aria-hidden />
              {fmt(done)} done
            </span>
          )}
          {over > 0 ? (
            <span className={s.meterOverPill}>{fmt(over)} over</span>
          ) : (
            <span className={s.meterSpare}>{over === 0 ? "Exactly full" : `${fmt(-over)} spare`}</span>
          )}
        </p>
      </div>

      <div
        className={s.track}
        role="meter"
        aria-valuemin={0}
        aria-valuemax={day}
        aria-valuenow={planned}
        aria-valuetext={`${fmt(planned)} planned of ${fmt(day)}${over > 0 ? `, ${fmt(over)} over` : ""}`}
        aria-label="Today's capacity"
      >
        {list.map((p) => (
          <span
            key={p.key}
            className={s.seg}
            data-kind={p.kind}
            data-hot={hot === p.id || undefined}
            title={p.title}
            style={{ left: `${p.left}%`, width: `${p.width}%` }}
            onMouseEnter={() => onHot?.(p.id)}
            onMouseLeave={() => onHot?.(null)}
          />
        ))}
        {over > 0 && <span className={s.dayLine} style={{ left: `${dayPct}%` }} aria-hidden />}
      </div>

      {marks && marks.length > 0 && (
        <div className={s.marks} aria-hidden>
          {marks.map((m) => (
            <span key={m.label} className={s.mark} style={{ left: `${(m.start / scale) * 100}%`, width: `${((m.end - m.start) / scale) * 100}%` }}>
              {m.label}
            </span>
          ))}
          {over > 0 && (
            <span className={s.markDay} style={{ left: `${dayPct}%` }}>
              End of your day
            </span>
          )}
        </div>
      )}

      {size === "lg" && (over <= 0 || hot) && (
        <p className={s.meterFoot} aria-live="polite">
          {(() => {
            const it = hot ? [...items, ...(pending ? [pending] : [])].find((i) => i.id === hot) : null;
            if (it)
              return (
                <span className={s.meterHot}>
                  <span className={s.dot} style={{ background: PROJECTS[it.project].color }} aria-hidden /> {it.title}
                  <span className={s.meterHotEst}>
                    {fmt(it.min)}
                    {it.guessed ? ", a guess" : ""}
                    {it.done ? ", done" : ""}
                  </span>
                </span>
              );
            if (guessed > 0 && over <= 0)
              return `${guessed === 1 ? "One task has" : `${guessed} tasks have`} no estimate yet, so ${guessed === 1 ? "it counts" : "each counts"} as 15m.`;
            return null;
          })()}
        </p>
      )}

      {over > 0 && (
        <div className={s.overNote} role="status">
          <I.warn size={15} />
          <span>
            That is {fmt(planned)}. Your day is {fmt(day)}.
          </span>
          {overAction}
        </div>
      )}
    </div>
  );
}
