"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { eventOf, eventIds, PEOPLE, PERSON_IDS, PRIORITIES, ROOMS, ROOM_IDS, STATUSES, eur, fmtDate, num, type CellValue, type EventId, type Row } from "./data";
import { DatePicker } from "./Editors";
import { cellWarning, fromText, type Column } from "./model";
import { Avatar, Icon, PriorityGlyph, StatusGlyph } from "./icons";
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
  priority: "priority",
};

/* The same typed fields as the grid, as large tappable controls. On a
   phone it fills the screen. On a desk it docks beside the sheet and
   follows the selected row, so moving through the grid reads each task. */
export function RecordForm({
  row,
  columns,
  index,
  total,
  onChange,
  onPrev,
  onNext,
  onClose,
  docked,
}: {
  row: Row;
  columns: Column[];
  index: number;
  total: number;
  onChange: (col: string, v: CellValue) => void;
  onPrev?: () => void;
  onNext?: () => void;
  onClose: () => void;
  docked?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const close = useRef(onClose);
  useEffect(() => {
    close.current = onClose;
  });
  useEffect(() => {
    // Docked, focus stays in the grid so the arrows keep moving the panel.
    if (docked) return;
    ref.current?.focus();
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") close.current();
    };
    document.addEventListener("keydown", key);
    return () => document.removeEventListener("keydown", key);
  }, [docked]);

  const ev = row.cells.event ? eventOf(row.cells.event as EventId) : null;
  const fields = columns.filter((c) => c.key !== "title");

  return (
    <>
      {!docked && <div className={s.recordScrim} onPointerDown={onClose} aria-hidden />}
      <div
        ref={ref}
        className={docked ? s.recordDocked : s.record}
        role={docked ? "complementary" : "dialog"}
        aria-modal={docked ? undefined : true}
        aria-labelledby="tl-record-title"
        tabIndex={-1}
        onKeyDown={(e) => {
          if (docked && e.key === "Escape") {
            e.stopPropagation();
            onClose();
          }
        }}
      >
        <div className={s.recordBar}>
          <button type="button" className={s.recordClose} onClick={onClose}>
            <Icon name="back" size={16} className={s.phoneOnlyIcon} />
            <span className={s.phoneOnlyText}>Back</span>
            <Icon name="close" size={15} className={s.deskOnlyIcon} />
            <span className={s.srOnly}>{docked ? "Close the details" : "Close the task"}</span>
          </button>
          <span className={s.recordPos}>{index >= 0 ? `Task ${index + 1} of ${total}` : "Hidden by a filter"}</span>
          <span className={s.recordNav}>
            <button type="button" className={s.iconBtn} disabled={!onPrev} onClick={onPrev} aria-label="Previous task">
              <Icon name="chevronUp" size={15} />
            </button>
            <button type="button" className={s.iconBtn} disabled={!onNext} onClick={onNext} aria-label="Next task">
              <Icon name="chevron" size={15} />
            </button>
          </span>
        </div>

        <div className={s.recordBody} key={row.id}>
          {ev && (
            <span className={s.eventChip} style={{ "--dot": ev.tone } as CSSProperties}>
              {ev.name}
            </span>
          )}
          <textarea
            id="tl-record-title"
            className={s.recordTitle}
            defaultValue={String(row.cells.title ?? "")}
            placeholder="Name this task"
            rows={2}
            aria-label="Task"
            onBlur={(e) => e.target.value.trim() && e.target.value !== row.cells.title && onChange("title", e.target.value.trim())}
          />

          <dl className={s.fields}>
            {fields.map((c) => (
              <div key={c.key} className={s.field} data-wide={c.type === "longtext" || c.type === "status" || c.type === "room" || c.type === "priority" || undefined}>
                <dt className={s.fieldLabel}>
                  <Icon name={TYPE_ICON[c.type]} size={15} />
                  <label htmlFor={`tl-f-${c.key}`}>{c.name}</label>
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

/** One typed field as a large control. The board's quick look uses these too. */
export function FieldControl({ c, row, onChange }: { c: Column; row: Row; onChange: (col: string, v: CellValue) => void }) {
  const v = row.cells[c.key] ?? null;
  const id = `tl-f-${c.key}`;
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
    case "priority":
      return (
        <div className={s.choiceRow} role="radiogroup" id={id} aria-label={c.name}>
          {PRIORITIES.map((x) => (
            <button key={x.id} type="button" role="radio" aria-checked={v === x.id} className={s.choice} onClick={() => onChange(c.key, v === x.id ? null : x.id)}>
              <PriorityGlyph p={x.id} size={14} />
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
          <select id={id} className={s.fieldSelect} value={String(v ?? "")} onChange={(e) => e.target.value && onChange(c.key, e.target.value)}>
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
          <span className={s.optTile} style={{ background: eventOf(v as EventId | null)?.tone ?? "transparent" }} data-empty={!v || undefined} />
          <select id={id} className={s.fieldSelect} value={String(v ?? "")} onChange={(e) => e.target.value && onChange(c.key, e.target.value)}>
            {eventIds().map((x) => (
              <option key={x} value={x}>
                {eventOf(x)?.name ?? x}
              </option>
            ))}
          </select>
          <Icon name="chevron" size={14} className={s.selectChevron} />
        </span>
      );
    case "date":
      return <DateField id={id} value={typeof v === "string" ? v : null} onChange={(d) => onChange(c.key, d)} />;
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
            className={`${s.fieldInput} ${c.type === "currency" ? s.fieldNum : s.fieldPlain}`}
            inputMode="decimal"
            key={String(v)}
            defaultValue={typeof v === "number" ? (c.type === "currency" ? eur(v).replace("€", "") : num(v)) : ""}
            placeholder={c.type === "currency" ? "0" : "Empty"}
            onFocus={(e) => {
              // Plain digits while typing, formatted again on the way out.
              if (typeof v === "number") e.currentTarget.value = String(v);
            }}
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

/** The grid's own date picker, so a date reads "Fri 18 Sep" everywhere. */
function DateField({ id, value, onChange }: { id: string; value: string | null; onChange: (v: string | null) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!open) return;
    const down = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", down, true);
    return () => document.removeEventListener("pointerdown", down, true);
  }, [open]);
  return (
    <span ref={ref} className={s.dateField}>
      <button type="button" id={id} className={`${s.fieldInput} ${s.dateButton}`} aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        {value ? fmtDate(value) : <span className={s.datePlaceholder}>No date</span>}
        <Icon name="date" size={15} />
      </button>
      {open ? (
        <span className={s.dateDrop}>
          <DatePicker
            value={value}
            onPick={(d) => {
              onChange(d);
              setOpen(false);
            }}
            onCancel={() => setOpen(false)}
          />
        </span>
      ) : null}
    </span>
  );
}
