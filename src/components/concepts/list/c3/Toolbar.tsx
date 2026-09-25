"use client";

import { useState } from "react";
import { PEOPLE, PERSON_IDS, STATUSES, type PersonId, type StatusId } from "./data";
import { NO_FILTER, filterCount, type Column, type Filter, type GroupBy, type Sheet } from "./model";
import { Avatar, Icon, Kbd, StatusGlyph } from "./icons";
import { Popover } from "./Overlays";
import s from "./sheet.module.css";

export function Header({ rowsCount, sheetName, onNewRow }: { rowsCount: number; sheetName: string; onNewRow: () => void }) {
  return (
    <header className={s.head}>
      <div className={s.titleGroup}>
        <h1 className={s.h1}>Tasks</h1>
        <span className={s.project}>
          <span className={s.projectTile} aria-hidden>
            T
          </span>
          The Orchard, events
        </span>
      </div>
      <div className={s.headRight}>
        <span className={s.saved}>
          <span className={s.savedDot} aria-hidden />
          {sheetName} · {rowsCount} {rowsCount === 1 ? "row" : "rows"} · saved
        </span>
        <span className={s.team} aria-label="Aoife, Orla, Dara and Tomás are on this project">
          {PERSON_IDS.map((p) => (
            <Avatar key={p} person={p} size={24} />
          ))}
        </span>
        <button type="button" className={`${s.btnSolid} ${s.deskOnly}`} onClick={onNewRow}>
          <Icon name="plus" size={14} />
          New row
        </button>
      </div>
    </header>
  );
}

type ToolbarProps = {
  sheets: Sheet[];
  sheet: Sheet;
  counts: Record<string, number>;
  columns: Column[];
  density: "compact" | "comfy";
  checked: number;
  onSheet: (id: string) => void;
  onNewSheet: () => void;
  onGroup: (g: GroupBy) => void;
  onFilter: (f: Filter) => void;
  onHidden: (h: string[]) => void;
  onDensity: (d: "compact" | "comfy") => void;
  onClearSort: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onMarkPaid: () => void;
  onClearChecked: () => void;
};

export const GROUP_NAMES: Record<GroupBy, string> = { event: "Event", status: "Status", owner: "Owner", none: "Nothing" };

export function Toolbar(p: ToolbarProps) {
  const [open, setOpen] = useState<null | "group" | "filter" | "hide" | "keys">(null);
  const toggle = (k: typeof open) => setOpen((o) => (o === k ? null : k));
  const close = () => setOpen(null);
  const hiddenCount = p.sheet.hidden.length;
  const fc = filterCount(p.sheet.filter);
  const sortCol = p.sheet.sort ? p.columns.find((c) => c.key === p.sheet.sort!.key) : null;

  return (
    <div className={s.toolbar}>
      <div className={s.tabs} role="tablist" aria-label="Sheets">
        {p.sheets.map((x) => (
          <button key={x.id} type="button" role="tab" aria-selected={x.id === p.sheet.id} className={s.tab} onClick={() => p.onSheet(x.id)}>
            {x.name}
            <span className={s.tabCount}>{p.counts[x.id]}</span>
          </button>
        ))}
        <button type="button" className={`${s.tab} ${s.tabNew}`} onClick={p.onNewSheet}>
          <Icon name="plus" size={13} />
          New sheet
        </button>
      </div>

      {p.checked > 0 ? (
        <div className={s.bulk} role="toolbar" aria-label="Selected rows">
          <span className={s.bulkCount}>{p.checked} selected</span>
          <button type="button" className={s.tool} onClick={p.onMarkPaid}>
            <Icon name="checkbox" size={15} />
            Mark paid
          </button>
          <button type="button" className={s.tool} onClick={p.onDuplicate}>
            <Icon name="copy" size={15} />
            Duplicate
          </button>
          <button type="button" className={`${s.tool} ${s.toolDanger}`} onClick={p.onDelete}>
            <Icon name="trash" size={15} />
            Delete
          </button>
          <button type="button" className={s.iconBtn} onClick={p.onClearChecked} aria-label="Clear selection">
            <Icon name="close" size={14} />
          </button>
        </div>
      ) : (
        <div className={s.tools} role="toolbar" aria-label="Sheet options">
          {sortCol && (
            <span className={s.sortChip}>
              <Icon name={p.sheet.sort!.dir === "asc" ? "sortAsc" : "sortDesc"} size={13} />
              {sortCol.name}
              <button type="button" className={s.chipX} onClick={p.onClearSort} aria-label={`Stop sorting by ${sortCol.name.toLowerCase()}`}>
                <Icon name="close" size={11} />
              </button>
            </span>
          )}
          <div className={s.anchor}>
            <button type="button" className={s.tool} aria-expanded={open === "group"} onClick={() => toggle("group")}>
              <Icon name="group" size={15} />
              <span className={s.toolLabel}>Group by</span>
              <strong>{GROUP_NAMES[p.sheet.groupBy]}</strong>
            </button>
            {open === "group" && (
              <Popover onClose={close} align="right">
                <GroupMenu value={p.sheet.groupBy} onPick={(g) => (p.onGroup(g), close())} />
              </Popover>
            )}
          </div>
          <div className={s.anchor}>
            <button type="button" className={s.tool} data-on={fc > 0 || undefined} aria-expanded={open === "filter"} onClick={() => toggle("filter")}>
              <Icon name="filter" size={15} />
              Filter
              {fc > 0 && <span className={s.toolBadge}>{fc}</span>}
            </button>
            {open === "filter" && (
              <Popover onClose={close} align="right" className={s.filterPop}>
                <FilterMenu value={p.sheet.filter} onChange={p.onFilter} />
              </Popover>
            )}
          </div>
          <div className={s.anchor}>
            <button type="button" className={s.tool} data-on={hiddenCount > 0 || undefined} aria-expanded={open === "hide"} onClick={() => toggle("hide")}>
              <Icon name="hide" size={15} />
              {hiddenCount ? `${hiddenCount} hidden` : "Hide fields"}
            </button>
            {open === "hide" && (
              <Popover onClose={close} align="right">
                <HideMenu columns={p.columns} hidden={p.sheet.hidden} onChange={p.onHidden} />
              </Popover>
            )}
          </div>
          <div className={s.segment} role="group" aria-label="Row height">
            <button type="button" aria-pressed={p.density === "compact"} className={s.segBtn} onClick={() => p.onDensity("compact")} title="Compact rows">
              <Icon name="compact" size={15} />
              <span className={s.srOnly}>Compact rows</span>
            </button>
            <button type="button" aria-pressed={p.density === "comfy"} className={s.segBtn} onClick={() => p.onDensity("comfy")} title="Roomy rows">
              <Icon name="comfy" size={15} />
              <span className={s.srOnly}>Roomy rows</span>
            </button>
          </div>
          <div className={s.anchor}>
            <button type="button" className={s.iconBtn} aria-expanded={open === "keys"} onClick={() => toggle("keys")} aria-label="Keyboard shortcuts">
              <Icon name="keyboard" size={16} />
            </button>
            {open === "keys" && (
              <Popover onClose={close} align="right" className={s.keysPop}>
                <KeysMenu />
              </Popover>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function GroupMenu({ value, onPick }: { value: GroupBy; onPick: (g: GroupBy) => void }) {
  return (
    <>
      <p className={s.menuLabel}>Group rows by</p>
      <ul className={s.menuList} role="menu">
        {(["event", "status", "owner", "none"] as GroupBy[]).map((g) => (
          <li key={g}>
            <button type="button" role="menuitemradio" aria-checked={value === g} className={s.menuRow} onClick={() => onPick(g)}>
              <Icon name={g === "event" ? "event" : g === "status" ? "status" : g === "owner" ? "person" : "sheet"} size={15} className={s.menuRowIcon} />
              <span>{g === "none" ? "No groups" : GROUP_NAMES[g]}</span>
              {value === g && <Icon name="check" size={14} className={s.menuTick} />}
            </button>
          </li>
        ))}
      </ul>
      <p className={s.keysTip}>
        <span className={s.keysHandle} aria-hidden />
        Drag the square on a cell&apos;s corner to fill down. Dates step a day at a time; hold ⌥ to copy instead.
      </p>
    </>
  );
}

export function FilterMenu({ value, onChange }: { value: Filter; onChange: (f: Filter) => void }) {
  const flip = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
  return (
    <div className={s.filterBody}>
      <p className={s.menuLabel}>Quick filters</p>
      <div className={s.chipRow}>
        <button type="button" className={s.fchip} aria-pressed={value.unpaid} onClick={() => onChange({ ...value, unpaid: !value.unpaid })}>
          Not paid yet
        </button>
        <button type="button" className={s.fchip} aria-pressed={value.late} onClick={() => onChange({ ...value, late: !value.late })}>
          Late
        </button>
      </div>
      <p className={s.menuLabel}>Status</p>
      <div className={s.chipRow}>
        {STATUSES.map((x) => (
          <button key={x.id} type="button" className={s.fchip} aria-pressed={value.statuses.includes(x.id)} onClick={() => onChange({ ...value, statuses: flip<StatusId>(value.statuses, x.id) })}>
            <StatusGlyph status={x.id} size={13} />
            {x.name}
          </button>
        ))}
      </div>
      <p className={s.menuLabel}>Owner</p>
      <div className={s.chipRow}>
        {PERSON_IDS.map((x) => (
          <button key={x} type="button" className={s.fchip} aria-pressed={value.owners.includes(x)} onClick={() => onChange({ ...value, owners: flip<PersonId>(value.owners, x) })}>
            <Avatar person={x} size={16} />
            {PEOPLE[x].name}
          </button>
        ))}
      </div>
      <div className={s.menuFoot}>
        <button type="button" className={s.linkBtn} disabled={!filterCount(value)} onClick={() => onChange(NO_FILTER)}>
          Clear filters
        </button>
      </div>
    </div>
  );
}

function HideMenu({ columns, hidden, onChange }: { columns: Column[]; hidden: string[]; onChange: (h: string[]) => void }) {
  return (
    <>
      <p className={s.menuLabel}>Fields on this sheet</p>
      <ul className={s.menuList}>
        {columns
          .filter((c) => c.key !== "title")
          .map((c) => {
            const on = !hidden.includes(c.key);
            return (
              <li key={c.key}>
                <button
                  type="button"
                  role="switch"
                  aria-checked={on}
                  className={s.menuRow}
                  onClick={() => onChange(on ? [...hidden, c.key] : hidden.filter((k) => k !== c.key))}
                >
                  <span>{c.name}</span>
                  <span className={s.switch} data-on={on || undefined} aria-hidden />
                </button>
              </li>
            );
          })}
      </ul>
      <div className={s.menuFoot}>
        <button type="button" className={s.linkBtn} disabled={!hidden.length} onClick={() => onChange([])}>
          Show every field
        </button>
      </div>
    </>
  );
}

const KEYS: [string[], string][] = [
  [["↑", "↓", "←", "→"], "Move between cells"],
  [["⇧", "↓"], "Select a range"],
  [["↵"], "Edit the cell"],
  [["⌘", "D"], "Fill down from the top cell"],
  [["⌘", "C"], "Copy as spreadsheet rows"],
  [["⌘", "V"], "Paste into cells"],
  [["⌫"], "Clear the cells"],
  [["Space"], "Tick or untick paid"],
  [["⇧", "Space"], "Open the full record"],
  [["⌘", "Z"], "Undo"],
];

function KeysMenu() {
  return (
    <>
      <p className={s.menuLabel}>Keyboard</p>
      <ul className={s.keysList}>
        {KEYS.map(([k, d]) => (
          <li key={d}>
            <span>{d}</span>
            <span className={s.keysCombo}>
              {k.map((x) => (
                <Kbd key={x}>{x}</Kbd>
              ))}
            </span>
          </li>
        ))}
      </ul>
    </>
  );
}
