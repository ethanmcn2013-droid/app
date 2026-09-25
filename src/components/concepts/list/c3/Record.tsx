"use client";

import { useEffect, useRef } from "react";
import { EVENTS, EVENT_IDS, PEOPLE, PERSON_IDS, ROOMS, ROOM_IDS, STATUSES, type CellValue, type EventId, type Row } from "./data";
import { cellWarning, fromText, type Column } from "./model";
import { Avatar, Icon, StatusGlyph } from "./icons";
import s from "./sheet.module.css";

const TYPE_ICON: Record<string, string> = {
  status: "status",
  date: "date",
  person: "person",
  event: "event",
  currency: "currency",
  checkbox: "checkbox",
  number: "number",
  room: "room",
  text: "text",
  longtext: "longtext",
};

/* The same typed fields as the grid, as large tappable controls. On a
   phone it fills the screen; on a desk it slides in from the right. */
export function RecordForm({
  row,
  columns,
  index,
  total,
  onChange,
  onPrev,
  onNext,
  onClose,
}: {
  row: Row;
  columns: Column[];
  index: number;
  total: number;
  onChange: (col: string, v: CellValue) => void;
  onPrev?: () => void;
  onNext?: () => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.focus();
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", key);
    return () => document.removeEventListener("keydown", key);
  }, [onClose]);

  const ev = row.cells.event ? EVENTS[row.cells.event as EventId] : null;
  const fields = columns.filter((c) => c.key !== "title");

  return (
    <>
      <div className={s.recordScrim} onPointerDown={onClose} aria-hidden />
      <div ref={ref} className={s.record} role="dialog" aria-modal aria-labelledby="c3-record-title" tabIndex={-1}>
        <div className={s.recordBar}>
          <button type="button" className={s.recordClose} onClick={onClose}>
            <Icon name="back" size={16} className={s.phoneOnlyIcon} />
            <span className={s.phoneOnlyText}>Back</span>
            <Icon name="close" size={15} className={s.deskOnlyIcon} />
            <span className={s.srOnly}>Close the record</span>
          </button>
          <span className={s.recordPos}>{index >= 0 ? `Row ${index + 1} of ${total}` : "Hidden by a filter"}</span>
          <span className={s.recordNav}>
            <button type="button" className={s.iconBtn} disabled={!onPrev} onClick={onPrev} aria-label="Previous row">
              <Icon name="chevronUp" size={15} />
            </button>
            <button type="button" className={s.iconBtn} disabled={!onNext} onClick={onNext} aria-label="Next row">
              <Icon name="chevron" size={15} />
            </button>
          </span>
        </div>

        <div className={s.recordBody} key={row.id}>
          {ev && (
            <span className={s.eventChip} style={{ background: ev.tone }}>
              {ev.name}
            </span>
          )}
          <textarea
            id="c3-record-title"
            className={s.recordTitle}
            defaultValue={String(row.cells.title ?? "")}
            placeholder="Name this task"
            rows={2}
            aria-label="Task"
            onBlur={(e) => e.target.value.trim() && e.target.value !== row.cells.title && onChange("title", e.target.value.trim())}
          />

          <dl className={s.fields}>
            {fields.map((c) => (
              <div key={c.key} className={s.field} data-wide={c.type === "longtext" || c.type === "status" || c.type === "room" || undefined}>
                <dt className={s.fieldLabel}>
                  <Icon name={TYPE_ICON[c.type]} size={15} />
                  <label htmlFor={`c3-f-${c.key}`}>{c.name}</label>
                </dt>
                <dd className={s.fieldValue}>
                  <FieldControl c={c} row={row} onChange={onChange} />
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </>
  );
}

function FieldControl({ c, row, onChange }: { c: Column; row: Row; onChange: (col: string, v: CellValue) => void }) {
  const v = row.cells[c.key] ?? null;
  const id = `c3-f-${c.key}`;
  const warn = cellWarning(row, c.key);
  switch (c.type) {
    case "status":
      return (
        <div className={s.choiceRow} role="radiogroup" id={id} aria-label={c.name}>
          {STATUSES.map((x) => (
            <button key={x.id} type="button" role="radio" aria-checked={v === x.id} className={s.choice} onClick={() => onChange(c.key, x.id)}>
              <StatusGlyph status={x.id} size={14} />
              {x.name}
            </button>
          ))}
        </div>
      );
    case "room":
      return (
        <div className={s.choiceRow} role="radiogroup" id={id} aria-label={c.name}>
          {ROOM_IDS.map((x) => (
            <button key={x} type="button" role="radio" aria-checked={v === x} className={s.choice} onClick={() => onChange(c.key, v === x ? null : x)}>
              {ROOMS[x].name}
              <span className={s.choiceHint}>{ROOMS[x].seats}</span>
            </button>
          ))}
        </div>
      );
    case "person":
      return (
        <span className={s.selectWrap}>
          <Avatar person={(v as keyof typeof PEOPLE) ?? null} size={20} />
          <select id={id} className={s.fieldSelect} value={String(v ?? "")} onChange={(e) => onChange(c.key, e.target.value || null)}>
            <option value="">No one</option>
            {PERSON_IDS.map((p) => (
              <option key={p} value={p}>
                {PEOPLE[p].name}
              </option>
            ))}
          </select>
          <Icon name="chevron" size={14} className={s.selectChevron} />
        </span>
      );
    case "event":
      return (
        <span className={s.selectWrap}>
          <span className={s.optTile} style={{ background: v ? EVENTS[v as EventId].tone : "transparent" }} data-empty={!v || undefined} />
          <select id={id} className={s.fieldSelect} value={String(v ?? "")} onChange={(e) => onChange(c.key, e.target.value || null)}>
            <option value="">No event</option>
            {EVENT_IDS.map((x) => (
              <option key={x} value={x}>
                {EVENTS[x].name}
              </option>
            ))}
          </select>
          <Icon name="chevron" size={14} className={s.selectChevron} />
        </span>
      );
    case "date":
      return <input id={id} type="date" className={s.fieldInput} value={String(v ?? "")} onChange={(e) => onChange(c.key, e.target.value || null)} />;
    case "checkbox":
      return (
        <button type="button" id={id} role="switch" aria-checked={v === true} className={s.bigSwitch} onClick={() => onChange(c.key, !v)}>
          <span className={s.switch} data-on={v === true || undefined} aria-hidden />
          {v ? "Yes" : "No"}
        </button>
      );
    case "currency":
    case "number":
      return (
        <span className={s.numWrap}>
          {c.type === "currency" && <span className={s.numPrefix}>€</span>}
          <input
            id={id}
            className={`${s.fieldInput} ${s.fieldNum}`}
            inputMode="decimal"
            defaultValue={typeof v === "number" ? String(v) : ""}
            placeholder={c.type === "currency" ? "0" : "Empty"}
            aria-invalid={warn ? true : undefined}
            aria-describedby={warn ? `${id}-warn` : undefined}
            onBlur={(e) => {
              const parsed = fromText(e.target.value, c);
              if (parsed.ok && parsed.value !== v) onChange(c.key, parsed.value);
            }}
          />
          {warn && (
            <span id={`${id}-warn`} className={s.fieldWarn}>
              <Icon name="warning" size={13} />
              {warn}
            </span>
          )}
        </span>
      );
    case "longtext":
      return (
        <textarea
          id={id}
          className={`${s.fieldInput} ${s.fieldArea}`}
          defaultValue={String(v ?? "")}
          placeholder="Add a note"
          rows={3}
          onBlur={(e) => e.target.value !== (v ?? "") && onChange(c.key, e.target.value || null)}
        />
      );
    default:
      return (
        <input
          id={id}
          className={s.fieldInput}
          defaultValue={String(v ?? "")}
          placeholder="Empty"
          onBlur={(e) => e.target.value !== (v ?? "") && onChange(c.key, e.target.value || null)}
        />
      );
  }
}
