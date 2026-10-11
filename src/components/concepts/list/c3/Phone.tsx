"use client";

import { useState } from "react";
import { ROOMS, eur, fmtRelative, daysFromToday, type RoomId, type Row, type StatusId, type PersonId } from "./data";
import { filterCount, isLate, paidCount, sumCost, type Filter, type Group, type GroupBy, type Sheet } from "./model";
import { Avatar, Icon, StatusGlyph } from "./icons";
import { Popover } from "./Overlays";
import { FilterMenu, GroupMenu, GROUP_NAMES } from "./Toolbar";
import s from "./sheet.module.css";

/* On a phone the grid becomes a record list: a two-line row with the
   title held still and a peek at who owns it and whether it's paid. */
export function PhoneList(p: {
  sheets: Sheet[];
  sheet: Sheet;
  groups: Group[];
  shown: Row[];
  allRows: Row[];
  isCollapsed: (k: string) => boolean;
  onSheet: (id: string) => void;
  onGroup: (g: GroupBy) => void;
  onFilter: (f: Filter) => void;
  onOpen: (id: string) => void;
  onNewRow: () => void;
  onExamplePaste: () => void;
  onToggleDone: (id: string) => void;
}) {
  const [open, setOpen] = useState<null | "group" | "filter">(null);
  const fc = filterCount(p.sheet.filter);
  const total = sumCost(p.shown);
  const late = p.shown.filter(isLate).length;

  return (
    <section className={s.phone} aria-label={`${p.sheet.name}, as a list`}>
      <div className={s.phoneBar}>
        <label className={s.sheetSelect}>
          <Icon name="sheet" size={15} />
          <span className={s.srOnly}>Sheet</span>
          <select value={p.sheet.id} onChange={(e) => p.onSheet(e.target.value)}>
            {p.sheets.map((x) => (
              <option key={x.id} value={x.id}>
                {x.name}
              </option>
            ))}
          </select>
          <Icon name="chevron" size={14} />
        </label>
        <div className={s.anchor}>
          <button type="button" className={s.tool} aria-expanded={open === "group"} onClick={() => setOpen(open === "group" ? null : "group")}>
            <Icon name="group" size={15} />
            {GROUP_NAMES[p.sheet.groupBy]}
          </button>
          {open === "group" && (
            <Popover onClose={() => setOpen(null)} align="right">
              <GroupMenu value={p.sheet.groupBy} onPick={(g) => (p.onGroup(g), setOpen(null))} />
            </Popover>
          )}
        </div>
        <div className={s.anchor}>
          <button type="button" className={s.tool} data-on={fc > 0 || undefined} aria-expanded={open === "filter"} onClick={() => setOpen(open === "filter" ? null : "filter")}>
            <Icon name="filter" size={15} />
            Filter
            {fc > 0 && <span className={s.toolBadge}>{fc}</span>}
          </button>
          {open === "filter" && (
            <Popover onClose={() => setOpen(null)} align="right" className={s.filterPop}>
              <FilterMenu value={p.sheet.filter} onChange={p.onFilter} />
            </Popover>
          )}
        </div>
      </div>

      {p.allRows.length === 0 ? (
        <div className={s.phoneEmpty}>
          <span className={s.emptyIcon}>
            <Icon name="paste" size={20} />
          </span>
          <h2 className={s.emptyTitle}>Paste from a spreadsheet or start typing</h2>
          <p className={s.emptyBody}>Copy rows from any spreadsheet app and paste them here. Columns are matched by name.</p>
          <div className={s.emptyActions}>
            <button type="button" className={s.btnSolid} onClick={p.onNewRow}>
              <Icon name="plus" size={14} />
              New row
            </button>
            <button type="button" className={s.btnGhost} onClick={p.onExamplePaste}>
              Try an example paste
            </button>
          </div>
        </div>
      ) : (
        <div className={s.phoneGroups}>
          {p.groups.map((g) => {
            if (!g.rows.length && (g.total === 0 || g.kind === "none")) return null;
            const cost = sumCost(g.rows);
            return (
              <section key={g.key} className={s.phoneGroup} aria-label={g.name}>
                {g.kind !== "none" && (
                  <h2 className={s.phoneGroupHead}>
                    {g.tone ? <span className={s.groupTile} style={{ background: g.tone }} aria-hidden /> : <span className={s.groupTileEmpty} aria-hidden />}
                    <span className={s.groupName}>{g.name}</span>
                    <span className={s.groupCount}>{g.rows.length ? g.rows.length : `None of ${g.total} match`}</span>
                    {cost > 0 && (
                      <span className={s.phoneGroupSum}>
                        {eur(cost)}
                        <span className={s.phoneGroupPaid}> · {paidCount(g.rows)} paid</span>
                      </span>
                    )}
                  </h2>
                )}
                <ul className={s.phoneRows}>
                  {g.rows.map((r) => (
                    <PhoneRow key={r.id} row={r} onOpen={p.onOpen} onToggleDone={p.onToggleDone} />
                  ))}
                </ul>
              </section>
            );
          })}
          {!p.shown.length && <p className={s.noMatch}>No rows match this filter.</p>}
        </div>
      )}

      <div className={s.phoneSum}>
        <span className={s.phoneSumText}>
          <strong>{eur(total)}</strong> across {p.shown.length} {p.shown.length === 1 ? "task" : "tasks"}
          {late > 0 && <span className={s.footLate}>{late} late</span>}
        </span>
        <button type="button" className={s.btnSolid} onClick={p.onNewRow}>
          <Icon name="plus" size={14} />
          New
        </button>
      </div>
    </section>
  );
}

function PhoneRow({ row, onOpen, onToggleDone }: { row: Row; onOpen: (id: string) => void; onToggleDone: (id: string) => void }) {
  const c = row.cells;
  const done = c.status === "done";
  const late = isLate(row);
  const parts: { text: string; tone?: "late" }[] = [];
  if (typeof c.due === "string") parts.push({ text: late ? `${Math.abs(daysFromToday(c.due))}d late` : `Due ${fmtRelative(c.due)}`, tone: late ? "late" : undefined });
  if (typeof c.cost === "number") parts.push({ text: eur(c.cost) });
  if (c.room) parts.push({ text: ROOMS[c.room as RoomId].name });
  if (!parts.length && c.supplier) parts.push({ text: String(c.supplier) });
  return (
    <li className={s.phoneRow} data-done={done || undefined}>
      <button type="button" className={s.phoneGlyph} onClick={() => onToggleDone(row.id)} aria-label={done ? "Mark as not done" : "Mark as done"}>
        <StatusGlyph status={c.status as StatusId} size={20} />
      </button>
      <button type="button" className={s.phoneMain} onClick={() => onOpen(row.id)}>
        <span className={s.phoneTitle}>{String(c.title || "Untitled row")}</span>
        <span className={s.phoneMeta}>
          {parts.map((x, i) => (
            <span key={i} data-tone={x.tone}>
              {i > 0 && <span className={s.dot} aria-hidden> · </span>}
              {x.text}
            </span>
          ))}
          {!parts.length && <span>No details yet</span>}
        </span>
        <span className={s.peek} aria-hidden>
          <Avatar person={(c.owner as PersonId) ?? null} size={22} />
          {typeof c.cost === "number" && (
            <span className={s.peekPaid} data-on={c.paid === true || undefined}>
              {c.paid ? "Paid" : "Unpaid"}
            </span>
          )}
        </span>
      </button>
    </li>
  );
}
