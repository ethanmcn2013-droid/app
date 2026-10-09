"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  EVENTS,
  EVENT_IDS,
  PEOPLE,
  PERSON_IDS,
  ROOMS,
  ROOM_IDS,
  STATUSES,
  TODAY,
  addDays,
  fmtDate,
  monthName,
  parseIso,
  toIso,
  type CellValue,
  type Row,
  type StatusId,
} from "./data";
import type { Column } from "./model";
import { Avatar, Icon, Kbd, StatusGlyph } from "./icons";
import s from "./sheet.module.css";

export type EditTarget = { row: string; col: string; draft: string; rect: { x: number; y: number; w: number; h: number } };

type Option = { value: CellValue; label: string; icon?: ReactNode; hint?: string };

function optionsFor(col: Column, row: Row): Option[] {
  switch (col.type) {
    case "status":
      return STATUSES.map((x) => ({ value: x.id, label: x.name, icon: <StatusGlyph status={x.id as StatusId} size={15} /> }));
    case "person":
      return [
        ...PERSON_IDS.map((p) => ({ value: p, label: PEOPLE[p].name, icon: <Avatar person={p} size={18} /> })),
        { value: null, label: "No one", icon: <Avatar person={null} size={18} /> },
      ];
    case "event":
      return [
        ...EVENT_IDS.map((e) => ({ value: e, label: EVENTS[e].name, hint: fmtDate(EVENTS[e].date), icon: <span className={s.optTile} style={{ background: EVENTS[e].tone }} /> })),
        { value: null, label: "No event", icon: <span className={s.optTileEmpty} /> },
      ];
    case "room": {
      const g = typeof row.cells.guests === "number" ? row.cells.guests : null;
      return [
        ...ROOM_IDS.map((r) => ({
          value: r,
          label: ROOMS[r].name,
          hint: g != null && g > ROOMS[r].seats ? `Seats ${ROOMS[r].seats}, too small` : `Seats ${ROOMS[r].seats}`,
          icon: <Icon name="room" size={15} />,
        })),
        { value: null, label: "No room", icon: <span className={s.optTileEmpty} /> },
      ];
    }
    default:
      return [];
  }
}

export function Editor({ target, row, col, onDone }: { target: EditTarget; row: Row; col: Column; onDone: (v: CellValue | undefined, then?: "down") => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const down = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onDone(undefined);
    };
    document.addEventListener("pointerdown", down, true);
    return () => document.removeEventListener("pointerdown", down, true);
  }, [onDone]);

  const width = col.type === "date" ? 300 : Math.max(target.rect.w, 232);
  const left = Math.min(target.rect.x, (typeof window === "undefined" ? 1440 : window.innerWidth) - width - 12);
  const below = target.rect.y + target.rect.h + 4;
  const tooLow = typeof window !== "undefined" && below + 340 > window.innerHeight;
  const style = tooLow ? { left, bottom: window.innerHeight - target.rect.y + 4, width } : { left, top: below, width };

  return (
    <div ref={ref} className={s.editorPop} style={style} role="dialog" aria-label={`Edit ${col.name.toLowerCase()}`}>
      {col.type === "date" ? (
        <DatePicker value={typeof row.cells[col.key] === "string" ? (row.cells[col.key] as string) : null} onPick={(v) => onDone(v, "down")} onCancel={() => onDone(undefined)} />
      ) : (
        <SelectList options={optionsFor(col, row)} value={row.cells[col.key] ?? null} name={col.name} onPick={(v) => onDone(v, "down")} onCancel={() => onDone(undefined)} />
      )}
    </div>
  );
}

function SelectList({ options, value, name, onPick, onCancel }: { options: Option[]; value: CellValue; name: string; onPick: (v: CellValue) => void; onCancel: () => void }) {
  const [q, setQ] = useState("");
  const list = useMemo(() => options.filter((o) => o.label.toLowerCase().includes(q.toLowerCase())), [options, q]);
  const [hi, setHi] = useState(() => Math.max(0, options.findIndex((o) => o.value === value)));
  const cur = Math.min(hi, Math.max(0, list.length - 1));
  return (
    <div>
      <div className={s.popSearch}>
        <Icon name="search" size={14} />
        <input
          autoFocus
          value={q}
          placeholder={`Find ${name.toLowerCase()}`}
          aria-label={`Find ${name.toLowerCase()}`}
          aria-controls="c3-options"
          aria-activedescendant={list[cur] ? `c3-opt-${cur}` : undefined}
          onChange={(e) => {
            setQ(e.target.value);
            setHi(0);
          }}
          onKeyDown={(e) => {
            e.stopPropagation();
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setHi((h) => Math.min(list.length - 1, Math.min(h, list.length - 1) + 1));
            }
            if (e.key === "ArrowUp") {
              e.preventDefault();
              setHi((h) => Math.max(0, Math.min(h, list.length - 1) - 1));
            }
            if (e.key === "Enter" && list[cur]) {
              e.preventDefault();
              onPick(list[cur].value);
            }
            if (e.key === "Escape") onCancel();
          }}
        />
      </div>
      <ul className={s.optList} role="listbox" id="c3-options" aria-label={name}>
        {list.map((o, i) => (
          <li
            key={String(o.value)}
            id={`c3-opt-${i}`}
            role="option"
            aria-selected={o.value === value}
            className={s.opt}
            data-hi={i === cur || undefined}
            onPointerEnter={() => setHi(i)}
            onClick={() => onPick(o.value)}
          >
            <span className={s.optIcon}>{o.icon}</span>
            <span className={s.optLabel}>{o.label}</span>
            {o.hint && <span className={s.optHint}>{o.hint}</span>}
            {o.value === value && <Icon name="check" size={14} className={s.optTick} />}
          </li>
        ))}
        {!list.length && <li className={s.optNone}>Nothing called “{q}”</li>}
      </ul>
    </div>
  );
}

function DatePicker({ value, onPick, onCancel }: { value: string | null; onPick: (v: string | null) => void; onCancel: () => void }) {
  const start = new Date(parseIso(value ?? TODAY));
  const [view, setView] = useState({ y: start.getUTCFullYear(), m: start.getUTCMonth() });
  const [hi, setHi] = useState(value ?? TODAY);
  const first = Date.UTC(view.y, view.m, 1);
  const lead = (new Date(first).getUTCDay() + 6) % 7; // Monday first
  const days = new Date(Date.UTC(view.y, view.m + 1, 0)).getUTCDate();
  const cells = Array.from({ length: Math.ceil((lead + days) / 7) * 7 }, (_, i) => toIso(first + (i - lead) * 86_400_000));
  const shift = (n: number) => setView((v) => ({ y: v.m + n < 0 ? v.y - 1 : v.m + n > 11 ? v.y + 1 : v.y, m: (v.m + n + 12) % 12 }));
  const nextFri = addDays(TODAY, ((5 - new Date(parseIso(TODAY)).getUTCDay() + 7) % 7) || 7);
  const quick = [
    { label: "Today", v: TODAY },
    { label: "Tomorrow", v: addDays(TODAY, 1) },
    { label: "Next Fri", v: nextFri },
    { label: "In 2 weeks", v: addDays(TODAY, 14) },
  ];
  const onKey = (e: React.KeyboardEvent) => {
    const step: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
    if (step[e.key]) {
      e.preventDefault();
      e.stopPropagation();
      const n = addDays(hi, step[e.key]);
      setHi(n);
      const d = new Date(parseIso(n));
      setView({ y: d.getUTCFullYear(), m: d.getUTCMonth() });
    }
    if (e.key === "Enter") {
      e.preventDefault();
      e.stopPropagation();
      onPick(hi);
    }
    if (e.key === "Escape") {
      e.stopPropagation();
      onCancel();
    }
  };
  return (
    <div className={s.datePop} onKeyDown={onKey}>
      <div className={s.quickRow}>
        {quick.map((q) => (
          <button key={q.label} type="button" className={s.quick} data-on={q.v === value || undefined} onClick={() => onPick(q.v)}>
            {q.label}
          </button>
        ))}
      </div>
      <div className={s.calHead}>
        <button type="button" className={s.iconBtn} onClick={() => shift(-1)} aria-label="Previous month">
          <Icon name="chevronLeft" size={15} />
        </button>
        <span className={s.calMonth}>{monthName(view.y, view.m)}</span>
        <button type="button" className={s.iconBtn} onClick={() => shift(1)} aria-label="Next month">
          <Icon name="chevronRight" size={15} />
        </button>
      </div>
      <div className={s.calGrid} role="grid" aria-label={monthName(view.y, view.m)}>
        {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
          <span key={i} className={s.calDow} aria-hidden>
            {d}
          </span>
        ))}
        {cells.map((iso, i) => {
          const d = new Date(parseIso(iso));
          const out = d.getUTCMonth() !== view.m;
          return (
            <button
              key={iso}
              type="button"
              autoFocus={iso === hi && i >= 0}
              className={s.calDay}
              data-out={out || undefined}
              data-today={iso === TODAY || undefined}
              data-on={iso === value || undefined}
              data-hi={iso === hi || undefined}
              aria-label={fmtDate(iso)}
              aria-pressed={iso === value}
              onClick={() => onPick(iso)}
              tabIndex={iso === hi ? 0 : -1}
            >
              {d.getUTCDate()}
            </button>
          );
        })}
      </div>
      <div className={s.calFoot}>
        <button type="button" className={s.linkBtn} onClick={() => onPick(null)}>
          Clear date
        </button>
        <span className={s.calHint}>
          <Kbd>↵</Kbd> to pick
        </span>
      </div>
    </div>
  );
}
