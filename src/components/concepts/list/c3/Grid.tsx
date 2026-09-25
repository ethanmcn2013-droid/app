"use client";

import { useEffect, useRef, useState, type CSSProperties, type ReactNode, type RefObject } from "react";
import { EVENTS, PEOPLE, ROOMS, STATUSES, daysFromToday, eur, fmtDate, type CellValue, type EventId, type PersonId, type RoomId, type Row, type StatusId } from "./data";
import {
  AGG_NAMES,
  FIELD_TYPES,
  aggregate,
  alignRight,
  cellWarning,
  fmtNumber,
  isLate,
  isNumeric,
  numbers,
  paidCount,
  statusMix,
  sumCost,
  fromText,
  type Agg,
  type ColType,
  type Column,
  type Group,
  type Sheet,
} from "./model";
import { Avatar, Icon, StatusGlyph } from "./icons";
import { Popover } from "./Overlays";
import type { EditTarget } from "./Editors";
import type { FillDrag, Pos } from "./index";
import s from "./sheet.module.css";

export type Range = { r0: number; r1: number; c0: number; c1: number; ar: number; ac: number };

export const cellDomId = (row: string, col: string) => `c3-${row}-${col}`;

const TYPE_ICON: Record<ColType, string> = {
  title: "title",
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

type Props = {
  gridRef: RefObject<HTMLDivElement | null>;
  sheet: Sheet;
  cols: Column[];
  allRows: Row[];
  shown: Row[];
  groups: Group[];
  flat: Row[];
  range: Range | null;
  density: "compact" | "comfy";
  checked: Set<string>;
  editing: EditTarget | null;
  fill: FillDrag | null;
  fillPreview: Map<string, CellValue>;
  flash: { keys: Set<string>; n: number };
  aggs: Record<string, Agg>;
  isCollapsed: (key: string) => boolean;
  onKeyDown: (e: React.KeyboardEvent) => void;
  onPaste: (e: React.ClipboardEvent) => void;
  onToggleGroup: (key: string) => void;
  onCellDown: (pos: Pos, e: React.PointerEvent) => void;
  onCellEnter: (pos: Pos) => void;
  onCellDouble: (pos: Pos) => void;
  onToggleCheck: (pos: Pos) => void;
  onStatusCycle: (row: string) => void;
  onCheckRow: (id: string, on: boolean) => void;
  onCheckAll: (on: boolean) => void;
  onOpen: (row: string) => void;
  onInlineCommit: (value: CellValue | undefined, then?: "down" | "right" | "left") => void;
  onDraft: (draft: string) => void;
  onFillStart: (e: React.PointerEvent) => void;
  onFillMove: (e: React.PointerEvent) => void;
  onFillEnd: () => void;
  onSort: (key: string) => void;
  onResize: (key: string, width: number) => void;
  onAddColumn: (type: ColType, name: string) => void;
  onAgg: (key: string, a: Agg) => void;
  onAddRow: (groupKey: string, title: string) => void;
  onOfferPaste: (text: string, groupKey: string, at: { x: number; y: number }) => void;
  onExamplePaste: () => void;
};

type Inner = Omit<Props, "gridRef">;

export function Grid({ gridRef, ...p }: Props) {
  const { cols, range, flat } = p;
  const [edges, setEdges] = useState({ left: false, right: false });
  const measure = (el: HTMLElement) => {
    const left = el.scrollLeft > 2;
    const right = el.scrollLeft + el.clientWidth < el.scrollWidth - 2;
    setEdges((e) => (e.left === left && e.right === right ? e : { left, right }));
  };
  useEffect(() => {
    const el = gridRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => measure(el));
    ro.observe(el);
    return () => ro.disconnect();
  }, [gridRef, cols.length]);

  const total = cols.reduce((a, c) => a + c.width, 0) + 44;
  const gridStyle = {
    "--cols": `${cols.map((c) => `${c.width}px`).join(" ")} 44px minmax(0, 1fr)`,
    "--grid-w": `${total}px`,
    "--frozen-w": `${cols[0].width}px`,
  } as CSSProperties;

  const rowNumber = new Map(flat.map((r, i) => [r.id, i]));
  const newSheet = p.allRows.length === 0;
  const activeId = range ? cellDomId(flat[range.ar].id, cols[range.ac].key) : undefined;
  const allChecked = flat.length > 0 && flat.every((r) => p.checked.has(r.id));
  const someChecked = !allChecked && flat.some((r) => p.checked.has(r.id));

  return (
    <section className={s.gridWrap} data-density={p.density} aria-label={`${p.sheet.name} sheet`}>
      <div
        ref={gridRef}
        className={`${s.scroller} ${edges.left ? s.scrolledX : ""}`}
        style={gridStyle}
        role="grid"
        aria-label={`${p.sheet.name}, ${flat.length} rows`}
        aria-rowcount={flat.length + 2}
        aria-colcount={cols.length}
        aria-multiselectable
        aria-activedescendant={activeId}
        tabIndex={0}
        onKeyDown={p.onKeyDown}
        onPaste={p.onPaste}
        onScroll={(e) => measure(e.currentTarget)}
      >
        <HeaderRow {...p} allChecked={allChecked} someChecked={someChecked} />

        {newSheet ? (
          <EmptySheet cols={cols} onAddRow={() => p.onAddRow("all", "")} onExamplePaste={p.onExamplePaste} />
        ) : (
          p.groups.map((g) => {
            const collapsed = p.isCollapsed(g.key);
            const filteredOut = g.rows.length === 0;
            if (filteredOut && g.total === 0 && g.kind !== "none") return null;
            return (
              <div key={g.key} role="rowgroup" className={s.group}>
                {g.kind !== "none" && <GroupRow g={g} cols={cols} collapsed={collapsed || filteredOut} filteredOut={filteredOut} onToggle={() => p.onToggleGroup(g.key)} />}
                {!collapsed &&
                  g.rows.map((r) => (
                    <GridRow key={r.id} row={r} index={rowNumber.get(r.id) ?? 0} {...p} />
                  ))}
                {!collapsed && !filteredOut && <AddRowLine groupKey={g.key} label={g.kind === "none" ? "New row" : `New row in ${g.name}`} onAddRow={p.onAddRow} onOfferPaste={p.onOfferPaste} />}
              </div>
            );
          })
        )}

        {!newSheet && flat.length === 0 && <div className={s.noMatch}>No rows match this filter. Clear a filter to see them again.</div>}

        <FooterRow {...p} />
      </div>
      <div className={s.fadeRight} data-on={edges.right || undefined} aria-hidden />
    </section>
  );
}

/* ── Header ────────────────────────────────────────────────────────── */

function HeaderRow(p: Inner & { allChecked: boolean; someChecked: boolean }) {
  const [adding, setAdding] = useState(false);
  return (
    <div role="row" className={`${s.row} ${s.headRow}`} aria-rowindex={1}>
      {p.cols.map((c, j) => {
        const sorted = p.sheet.sort?.key === c.key ? p.sheet.sort.dir : null;
        return (
          <div
            key={c.key}
            role="columnheader"
            aria-sort={sorted === "asc" ? "ascending" : sorted === "desc" ? "descending" : "none"}
            className={`${s.hcell} ${j === 0 ? s.frozen : ""} ${alignRight(c) ? s.right : ""} ${p.range && j >= p.range.c0 && j <= p.range.c1 ? s.hcellOn : ""}`}
          >
            {j === 0 && (
              <span className={s.lead}>
                <Check
                  checked={p.allChecked}
                  mixed={p.someChecked}
                  label={p.allChecked ? "Clear the row selection" : "Select every row"}
                  onChange={(on) => p.onCheckAll(on)}
                  quiet={!p.allChecked && !p.someChecked}
                />
              </span>
            )}
            <button type="button" className={s.hbtn} onClick={() => p.onSort(c.key)} title={`Sort by ${c.name.toLowerCase()}`}>
              <Icon name={TYPE_ICON[c.type]} size={14} className={s.hicon} />
              <span className={s.hname}>{c.name}</span>
              {sorted && <Icon name={sorted === "asc" ? "sortAsc" : "sortDesc"} size={13} className={s.sortIcon} />}
            </button>
            <Resizer col={c} onResize={p.onResize} />
          </div>
        );
      })}
      <div role="columnheader" className={`${s.hcell} ${s.addCol}`}>
        <button type="button" className={s.addColBtn} aria-label="Add a field" aria-expanded={adding} onClick={() => setAdding((a) => !a)}>
          <Icon name="plus" size={15} />
        </button>
        {adding && (
          <Popover className={s.addFieldMenu} onClose={() => setAdding(false)} align="right">
            <AddField
              onPick={(t, n) => {
                p.onAddColumn(t, n);
                setAdding(false);
              }}
            />
          </Popover>
        )}
      </div>
      <div className={s.hfill} aria-hidden />
    </div>
  );
}

function AddField({ onPick }: { onPick: (t: ColType, name: string) => void }) {
  const [name, setName] = useState("");
  return (
    <div>
      <label className={s.menuLabel} htmlFor="c3-field-name">
        Field name
      </label>
      <input
        id="c3-field-name"
        className={s.menuInput}
        placeholder="Deposit due, dietary needs, table…"
        value={name}
        autoFocus
        onChange={(e) => setName(e.target.value)}
      />
      <p className={s.menuLabel}>Type</p>
      <ul className={s.menuList}>
        {FIELD_TYPES.map((f) => (
          <li key={f.type}>
            <button type="button" className={s.menuItem} onClick={() => onPick(f.type, name)}>
              <span className={s.menuIcon}>
                <Icon name={TYPE_ICON[f.type]} size={15} />
              </span>
              <span className={s.menuText}>
                <strong>{f.name}</strong>
                <span>{f.hint}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Resizer({ col, onResize }: { col: Column; onResize: (key: string, w: number) => void }) {
  const start = useRef<{ x: number; w: number } | null>(null);
  return (
    <span
      className={s.resizer}
      role="separator"
      aria-orientation="vertical"
      aria-label={`Resize ${col.name}`}
      onPointerDown={(e) => {
        e.stopPropagation();
        e.currentTarget.setPointerCapture(e.pointerId);
        start.current = { x: e.clientX, w: col.width };
      }}
      onPointerMove={(e) => {
        if (!start.current) return;
        onResize(col.key, Math.max(col.type === "title" ? 200 : 64, Math.min(520, start.current.w + e.clientX - start.current.x)));
      }}
      onPointerUp={() => (start.current = null)}
    />
  );
}

/* ── Group header with aligned subtotals ───────────────────────────── */

function GroupRow({ g, cols, collapsed, filteredOut, onToggle }: { g: Group; cols: Column[]; collapsed: boolean; filteredOut: boolean; onToggle: () => void }) {
  const cost = sumCost(g.rows);
  const withCost = g.rows.filter((r) => r.cells.cost != null).length;
  const mix = statusMix(g.rows);
  const owners = [...new Set(g.rows.map((r) => r.cells.owner).filter(Boolean))] as PersonId[];
  return (
    <div role="row" className={`${s.row} ${s.groupRow}`} data-collapsed={collapsed || undefined}>
      {cols.map((c, j) => {
        let body: ReactNode = null;
        if (j === 0)
          body = (
            <button type="button" className={s.groupToggle} onClick={onToggle} aria-expanded={!collapsed} disabled={filteredOut}>
              <Icon name="chevron" size={14} className={s.groupChevron} />
              {g.tone ? <span className={s.groupTile} style={{ background: g.tone }} aria-hidden /> : <span className={s.groupTileEmpty} aria-hidden />}
              <span className={s.groupName}>{g.name}</span>
              <span className={s.groupCount}>{filteredOut ? `None of ${g.total} match the filter` : `${g.rows.length} ${g.rows.length === 1 ? "task" : "tasks"}`}</span>
            </button>
          );
        else if (filteredOut) body = null;
        else if (c.type === "status") body = <MixBar mix={mix} />;
        else if (c.key === "due" && g.kind === "event" && g.value) body = <span className={s.groupMeta}>{fmtDate(EVENTS[g.value as EventId].date)}</span>;
        else if (c.key === "due" && g.kind === "event") body = <span className={s.groupMeta}>{g.meta}</span>;
        else if (c.type === "person" && c.key === "owner")
          body = (
            <span className={s.stack} aria-label={owners.map((o) => PEOPLE[o].name).join(", ")}>
              {owners.slice(0, 4).map((o) => (
                <Avatar key={o} person={o} size={18} />
              ))}
            </span>
          );
        else if (c.key === "cost") body = cost ? <span className={s.subtotal}>{eur(cost)}</span> : null;
        else if (c.key === "paid") body = withCost ? <span className={s.groupMeta}>{paidCount(g.rows)} paid</span> : null;
        else if (c.key === "guests" && g.kind === "event" && g.value) body = <span className={s.groupMeta}>{EVENTS[g.value as EventId].guests} expected</span>;
        else if (c.custom && isNumeric(c)) {
          const n = aggregate(g.rows, c, "sum");
          body = n != null ? <span className={s.subtotal}>{fmtNumber(n, c)}</span> : null;
        }
        return (
          <div key={c.key} role={j === 0 ? "rowheader" : "gridcell"} className={`${s.gcell} ${j === 0 ? s.frozen : ""} ${alignRight(c) ? s.right : ""}`}>
            {body}
          </div>
        );
      })}
      <div className={s.gcell} aria-hidden />
      <div className={s.gcell} aria-hidden />
    </div>
  );
}

function MixBar({ mix, wide }: { mix: { id: StatusId; name: string; count: number }[]; wide?: boolean }) {
  const total = mix.reduce((a, b) => a + b.count, 0);
  if (!total) return null;
  const label = mix.filter((m) => m.count).map((m) => `${m.count} ${m.name.toLowerCase()}`).join(", ");
  return (
    <span className={`${s.mix} ${wide ? s.mixWide : ""}`} role="img" aria-label={label} title={label}>
      {mix.map((m) =>
        m.count ? <span key={m.id} className={s.mixSeg} data-status={m.id} style={{ flexGrow: m.count }} /> : null,
      )}
    </span>
  );
}

/* ── Body rows ─────────────────────────────────────────────────────── */

function GridRow(p: Inner & { row: Row; index: number }) {
  const { row, index, cols, range } = p;
  const inRows = range && index >= range.r0 && index <= range.r1;
  const isChecked = p.checked.has(row.id);
  const done = row.cells.status === "done";
  return (
    <div role="row" className={`${s.row} ${s.bodyRow}`} data-row={row.id} data-checked={isChecked || undefined} data-done={done || undefined} aria-rowindex={index + 2} aria-selected={isChecked}>
      {cols.map((c, j) => {
        const key = `${row.id}|${c.key}`;
        const inRange = !!inRows && j >= range!.c0 && j <= range!.c1;
        const active = !!range && index === range.ar && j === range.ac;
        const multi = !!range && (range.r0 !== range.r1 || range.c0 !== range.c1);
        const corner = !!range && index === range.r1 && j === range.c1;
        const preview = p.fillPreview.has(key);
        const editingHere = p.editing?.row === row.id && p.editing.col === c.key;
        const warn = cellWarning(row, c.key);
        const cls = [
          s.cell,
          j === 0 ? s.frozen : "",
          alignRight(c) ? s.right : "",
          inRange && multi ? s.inRange : "",
          inRange && multi && index === range!.r0 ? s.rT : "",
          inRange && multi && index === range!.r1 ? s.rB : "",
          inRange && multi && j === range!.c0 ? s.rL : "",
          inRange && multi && j === range!.c1 ? s.rR : "",
          active ? s.active : "",
          preview ? s.ghost : "",
          warn ? s.warn : "",
          p.flash.keys.has(key) ? (p.flash.n % 2 ? s.flashA : s.flashB) : "",
        ].join(" ");
        const pos = { row: row.id, col: c.key };
        return (
          <div
            key={c.key}
            id={cellDomId(row.id, c.key)}
            role="gridcell"
            aria-selected={inRange}
            aria-invalid={warn ? true : undefined}
            aria-colindex={j + 1}
            className={cls}
            data-row={row.id}
            data-col={c.key}
            onPointerDown={(e) => p.onCellDown(pos, e)}
            onPointerEnter={() => p.onCellEnter(pos)}
            onDoubleClick={() => p.onCellDouble(pos)}
          >
            {j === 0 && (
              <span className={s.lead} onPointerDown={(e) => e.stopPropagation()}>
                <span className={s.rowNum} aria-hidden>
                  {index + 1}
                </span>
                <Check checked={isChecked} label={`Select ${String(row.cells.title) || "this row"}`} onChange={(on) => p.onCheckRow(row.id, on)} />
              </span>
            )}
            {j === 0 && (
              <button
                type="button"
                className={s.glyphBtn}
                onPointerDown={(e) => e.stopPropagation()}
                onClick={() => p.onStatusCycle(row.id)}
                aria-label={done ? "Mark as not done" : "Mark as done"}
              >
                <StatusGlyph status={(row.cells.status as StatusId) ?? null} size={15} />
              </button>
            )}
            {editingHere && (c.type === "title" || c.type === "text" || c.type === "longtext" || isNumeric(c)) ? (
              <InlineEditor col={c} draft={p.editing!.draft} onDraft={p.onDraft} onCommit={p.onInlineCommit} />
            ) : preview ? (
              <CellValueView col={c} row={row} value={p.fillPreview.get(key)!} />
            ) : (
              <CellValueView col={c} row={row} value={row.cells[c.key] ?? null} onToggle={() => p.onToggleCheck(pos)} />
            )}
            {j === 0 && (
              <button type="button" className={s.openBtn} onPointerDown={(e) => e.stopPropagation()} onClick={() => p.onOpen(row.id)} aria-label={`Open ${String(row.cells.title)}`} title="Open the full record  ⇧ Space">
                <Icon name="expand" size={13} />
              </button>
            )}
            {warn && <Icon name="warning" size={13} className={s.warnIcon} />}
            {active && warn && !editingHere && (
              <span className={s.callout} role="status">
                <Icon name="warning" size={13} />
                {warn}
              </span>
            )}
            {active && !multi && c.type === "longtext" && typeof row.cells[c.key] === "string" && String(row.cells[c.key]).length > 36 && !editingHere && (
              <span className={s.noteCard}>{String(row.cells[c.key])}</span>
            )}
            {corner && !p.editing && c.type !== "title" && (
              <span
                className={s.handle}
                role="button"
                aria-label="Drag to fill down"
                title="Drag to fill down, hold ⌥ to copy"
                onPointerDown={(e) => {
                  e.stopPropagation();
                  p.onFillStart(e);
                }}
                onPointerMove={p.onFillMove}
                onPointerUp={p.onFillEnd}
              />
            )}
          </div>
        );
      })}
      <div className={s.cell} aria-hidden />
      <div className={s.cell} aria-hidden />
    </div>
  );
}

export function CellValueView({ col, row, value, onToggle }: { col: Column; row: Row; value: CellValue; onToggle?: () => void }) {
  if (col.type === "checkbox")
    return (
      <span className={s.checkWrap}>
        <button
          type="button"
          className={s.box}
          data-on={value === true || undefined}
          role="checkbox"
          aria-checked={value === true}
          aria-label={`${col.name}: ${value ? "yes" : "no"}`}
          tabIndex={-1}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={onToggle}
        >
          {value === true && <Icon name="check" size={12} />}
        </button>
      </span>
    );
  if (value == null || value === "") return <span className={s.empty} />;
  switch (col.type) {
    case "title":
      return <span className={s.title}>{String(value)}</span>;
    case "status": {
      const st = STATUSES.find((x) => x.id === value);
      return st ? (
        <span className={s.pill} data-status={st.id}>
          {st.name}
        </span>
      ) : null;
    }
    case "date": {
      const n = daysFromToday(String(value));
      const late = n < 0 && row.cells.status !== "done";
      return (
        <span className={s.date} data-tone={late ? "late" : n === 0 ? "today" : undefined}>
          {n === 0 ? "Today" : fmtDate(String(value))}
        </span>
      );
    }
    case "person": {
      const pp = PEOPLE[value as PersonId];
      return pp ? (
        <span className={s.person}>
          <Avatar person={value as PersonId} size={18} />
          {pp.name}
        </span>
      ) : null;
    }
    case "event": {
      const ev = EVENTS[value as EventId];
      return ev ? (
        <span className={s.eventChip} style={{ background: ev.tone }}>
          {ev.short}
        </span>
      ) : null;
    }
    case "room": {
      const rm = ROOMS[value as RoomId];
      return rm ? <span className={s.room}>{rm.name}</span> : null;
    }
    case "currency":
    case "number":
      return <span className={s.num}>{typeof value === "number" ? fmtNumber(value, col) : String(value)}</span>;
    case "longtext":
      return <span className={s.note}>{String(value)}</span>;
    default:
      return <span className={s.text}>{String(value)}</span>;
  }
}

function InlineEditor({ col, draft, onDraft, onCommit }: { col: Column; draft: string; onDraft: (d: string) => void; onCommit: Props["onInlineCommit"] }) {
  const done = useRef(false);
  const finish = (then?: "down" | "right" | "left", cancel?: boolean) => {
    if (done.current) return;
    done.current = true;
    if (cancel) return onCommit(undefined);
    const parsed = fromText(draft, col);
    onCommit(parsed.ok ? (col.type === "title" && !draft.trim() ? undefined : parsed.value) : undefined, then);
  };
  const keys = (e: React.KeyboardEvent) => {
    e.stopPropagation();
    if (e.key === "Enter" && !(col.type === "longtext" && e.shiftKey)) {
      e.preventDefault();
      finish("down");
    } else if (e.key === "Tab") {
      e.preventDefault();
      finish(e.shiftKey ? "left" : "right");
    } else if (e.key === "Escape") finish(undefined, true);
  };
  const invalid = draft.trim() !== "" && !fromText(draft, col).ok;
  if (col.type === "longtext")
    return (
      <textarea
        className={s.noteEditor}
        value={draft}
        autoFocus
        rows={4}
        aria-label={col.name}
        onChange={(e) => onDraft(e.target.value)}
        onKeyDown={keys}
        onBlur={() => finish()}
        onFocus={(e) => e.currentTarget.setSelectionRange(draft.length, draft.length)}
      />
    );
  return (
    <>
      <input
        className={`${s.cellInput} ${isNumeric(col) ? s.right : ""}`}
        value={draft}
        autoFocus
        inputMode={isNumeric(col) ? "decimal" : undefined}
        aria-label={col.name}
        aria-invalid={invalid || undefined}
        onChange={(e) => onDraft(e.target.value)}
        onKeyDown={keys}
        onBlur={() => finish()}
        onPointerDown={(e) => e.stopPropagation()}
      />
      {invalid && <span className={s.callout}>Numbers only, like 640 or 1,200</span>}
    </>
  );
}

/* ── New row line: type a title, or paste rows from a spreadsheet ─── */

function AddRowLine({ groupKey, label, onAddRow, onOfferPaste }: { groupKey: string; label: string; onAddRow: Props["onAddRow"]; onOfferPaste: Props["onOfferPaste"] }) {
  const [v, setV] = useState("");
  return (
    <div role="row" className={`${s.row} ${s.addRow}`}>
      <div role="gridcell" className={`${s.cell} ${s.frozen} ${s.addCell}`}>
        <Icon name="plus" size={14} className={s.addIcon} />
        <input
          className={s.addInput}
          value={v}
          placeholder={label}
          aria-label={label}
          onChange={(e) => setV(e.target.value)}
          onKeyDown={(e) => {
            e.stopPropagation();
            if (e.key === "Enter" && v.trim()) {
              onAddRow(groupKey, v.trim());
              setV("");
            }
            if (e.key === "Escape") e.currentTarget.blur();
          }}
          onPaste={(e) => {
            const text = e.clipboardData.getData("text/plain");
            if (!/[\t\n]/.test(text.trim())) return;
            e.preventDefault();
            e.stopPropagation();
            const r = e.currentTarget.getBoundingClientRect();
            onOfferPaste(text, groupKey, { x: r.left, y: r.bottom + 6 });
          }}
        />
        <span className={s.addHint} aria-hidden>
          Type, or paste rows
        </span>
      </div>
    </div>
  );
}

/* ── Footer: live totals, or the selection's numbers ───────────────── */

function FooterRow(p: Inner) {
  const { cols, range, flat, shown } = p;
  const [menu, setMenu] = useState<string | null>(null);
  const multi = !!range && (range.r0 !== range.r1 || range.c0 !== range.c1);
  const selRows = range ? flat.slice(range.r0, range.r1 + 1) : [];
  const selCols = range ? cols.slice(range.c0, range.c1 + 1) : [];
  const selNumeric = selCols.filter(isNumeric);
  const selNums = selNumeric.flatMap((c) => numbers(selRows, c.key));
  const selCount = range ? selRows.length * selCols.length : 0;
  const selCurrency = selNumeric.length > 0 && selNumeric.every((c) => c.type === "currency");
  const fmtSel = (n: number) => (selCurrency ? eur(Math.round(n * 100) / 100) : new Intl.NumberFormat("en-IE", { maximumFractionDigits: 2 }).format(n));
  const late = shown.filter(isLate).length;
  const selWide = multi && selCount > 1;
  const selDates = selCols.filter((c) => c.type === "date").flatMap((c) => selRows.map((r) => r.cells[c.key]).filter((v): v is string => typeof v === "string")).sort();

  return (
    <div role="row" className={`${s.row} ${s.footRow}`} aria-rowindex={flat.length + 2}>
      {cols.map((c, j) => {
        let body: ReactNode = null;
        if (j === 0) {
          body =
            selWide ? (
              <span className={s.selSummary} aria-live="polite">
                <Icon name="sheet" size={14} className={s.selIcon} />
                <strong>{selCount} cells</strong>
                {selNums.length > 0 && (
                  <>
                    <span>Sum {fmtSel(selNums.reduce((a, b) => a + b, 0))}</span>
                    <span>Average {fmtSel(selNums.reduce((a, b) => a + b, 0) / selNums.length)}</span>
                  </>
                )}
                {!selNums.length && selDates.length > 1 && (
                  <span>
                    {fmtDate(selDates[0])} to {fmtDate(selDates[selDates.length - 1])}
                  </span>
                )}
              </span>
            ) : (
              <span className={s.footLead}>
                <strong>{shown.length}</strong> {shown.length === 1 ? "task" : "tasks"}
                {late > 0 && <span className={s.footLate}>{late} late</span>}
              </span>
            );
        } else if (c.type === "status") body = <MixBar mix={statusMix(shown)} wide />;
        else if (c.key === "paid") {
          const withCost = shown.filter((r) => r.cells.cost != null).length;
          body = withCost ? (
            <span className={s.footSmall} title={`${paidCount(shown)} of ${withCost} costs paid`}>
              {paidCount(shown)} of {withCost}
            </span>
          ) : null;
        } else if (isNumeric(c)) {
          const inSel = multi && selNumeric.some((x) => x.key === c.key);
          const agg = p.aggs[c.key] ?? "sum";
          const v = inSel ? numbers(selRows, c.key).reduce((a, b) => a + b, 0) : aggregate(shown, c, agg);
          const guestWarn = !inSel && c.key === "guests" && agg === "max" && v != null && v > 180;
          body = (
            <>
              <button
                type="button"
                className={`${s.aggBtn} ${inSel ? s.aggSel : ""} ${guestWarn ? s.aggWarn : ""}`}
                onClick={() => setMenu(menu === c.key ? null : c.key)}
                aria-expanded={menu === c.key}
                aria-label={`${c.name} total, ${inSel ? "selection sum" : AGG_NAMES[agg].toLowerCase()}. Change how it adds up`}
              >
                <span className={s.aggName}>{inSel ? "Selected" : AGG_NAMES[agg]}</span>
                <span className={s.aggVal}>{v == null ? "–" : agg === "filled" && !inSel ? v : fmtNumber(v, c)}</span>
              </button>
              {menu === c.key && (
                <Popover className={s.aggMenu} onClose={() => setMenu(null)} align="right" up>
                  <p className={s.menuLabel}>Show for {c.name.toLowerCase()}</p>
                  <ul className={s.menuList} role="menu">
                    {(["sum", "average", "min", "max", "filled", "none"] as Agg[]).map((a) => {
                      const val = aggregate(shown, c, a);
                      return (
                        <li key={a}>
                          <button
                            type="button"
                            role="menuitemradio"
                            aria-checked={agg === a}
                            className={s.menuRow}
                            onClick={() => {
                              p.onAgg(c.key, a);
                              setMenu(null);
                            }}
                          >
                            <span>{AGG_NAMES[a]}</span>
                            <span className={s.menuRowVal}>{a === "none" || val == null ? "" : a === "filled" ? `${val} of ${shown.length}` : fmtNumber(val, c)}</span>
                            {agg === a && <Icon name="check" size={14} className={s.menuTick} />}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </Popover>
              )}
            </>
          );
        }
        if (j === 1 && selWide) return null;
        return (
          <div
            key={c.key}
            role="gridcell"
            className={`${s.fcell} ${j === 0 ? s.frozen : ""} ${alignRight(c) ? s.right : ""} ${j === 0 && selWide ? s.fcellSel : ""}`}
            style={j === 0 && selWide && cols.length > 1 ? { gridColumn: "span 2" } : undefined}
          >
            {body}
          </div>
        );
      })}
      <div className={s.fcell} aria-hidden />
      <div className={s.fcell} aria-hidden />
    </div>
  );
}

/* ── Empty: a brand-new sheet ──────────────────────────────────────── */

function EmptySheet({ cols, onAddRow, onExamplePaste }: { cols: Column[]; onAddRow: () => void; onExamplePaste: Props["onExamplePaste"] }) {
  return (
    <div className={s.emptyWrap}>
      {[0, 1, 2].map((i) => (
        <div key={i} className={`${s.row} ${s.ghostRow}`} aria-hidden style={{ opacity: 1 - i * 0.28 }}>
          {cols.map((c, j) => (
            <div key={c.key} className={`${s.ghostCell} ${j === 0 ? s.frozen : ""}`}>
              <span className={s.ghostBar} style={{ width: j === 0 ? `${62 - i * 14}%` : isNumeric(c) ? "40%" : `${48 + ((i + j) % 3) * 12}%`, marginLeft: isNumeric(c) ? "auto" : undefined }} />
            </div>
          ))}
          <div className={s.ghostCell} />
          <div className={s.ghostCell} />
        </div>
      ))}
      <div className={s.emptyCard}>
        <span className={s.emptyIcon}>
          <Icon name="paste" size={20} />
        </span>
        <h2 className={s.emptyTitle}>Paste from a spreadsheet or start typing</h2>
        <p className={s.emptyBody}>Copy rows from Excel, Google Sheets or Numbers and press ⌘V here. Columns are matched by name, so a supplier list lands in the right place.</p>
        <div className={s.emptyActions}>
          <button type="button" className={s.btnSolid} onClick={onAddRow}>
            <Icon name="plus" size={14} />
            Start typing
          </button>
          <button
            type="button"
            className={s.btnGhost}
            onClick={onExamplePaste}
          >
            Try an example paste
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Small checkbox ────────────────────────────────────────────────── */

function Check({ checked, mixed, label, onChange, quiet }: { checked: boolean; mixed?: boolean; label: string; onChange: (on: boolean) => void; quiet?: boolean }) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={mixed ? "mixed" : checked}
      aria-label={label}
      className={`${s.rowCheck} ${quiet ? s.rowCheckQuiet : ""}`}
      data-on={checked || mixed || undefined}
      onClick={() => onChange(!checked)}
    >
      {checked && <Icon name="check" size={11} />}
      {mixed && !checked && <span className={s.dash} />}
    </button>
  );
}
