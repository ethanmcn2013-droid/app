"use client";

import { useState } from "react";
import { PEOPLE, PERSON_IDS, STATUSES, type PersonId, type StatusId } from "./data";
import { NO_FILTER, filterCount, type Column, type Filter, type GroupBy, type Sheet } from "./model";
import { ViewSwitch } from "../../tasks/view-switch";
import { useModKeys } from "./keys";
import { Avatar, Icon, Kbd, StatusGlyph } from "./icons";
import { Popover } from "./Overlays";
import s from "./sheet.module.css";

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
  onClearQuery: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onMarkPaid: () => void;
  onClearChecked: () => void;
};

export const GROUP_NAMES: Record<GroupBy, string> = { event: "Event", status: "Status", owner: "Owner", room: "Room", none: "Nothing" };

export function Toolbar(p: ToolbarProps) {
  const [open, setOpen] = useState<null | "group" | "filter" | "hide" | "keys">(null);
  const toggle = (k: typeof open) => setOpen((o) => (o === k ? null : k));
  const close = () => setOpen(null);
  const hiddenCount = p.sheet.hidden.length;
  const fc = filterCount(p.sheet.filter);
  const sortCol = p.sheet.sort ? p.columns.find((c) => c.key === p.sheet.sort!.key) : null;

  return (
    <div className={s.toolbar}>
      <div className={s.toolbarLead}>
      <ViewSwitch current="list" row />
      <div
        className={s.tabs}
        role="tablist"
        aria-label="Sheets"
        onKeyDown={(e) => {
          // One tab stop for the sheets; the arrows move between them.
          const i = p.sheets.findIndex((x) => x.id === p.sheet.id);
          const step = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
          const to = e.key === "Home" ? 0 : e.key === "End" ? p.sheets.length - 1 : step ? (i + step + p.sheets.length) % p.sheets.length : -1;
          if (to < 0) return;
          e.preventDefault();
          const list = e.currentTarget;
          p.onSheet(p.sheets[to].id);
          requestAnimationFrame(() => list.querySelector<HTMLElement>(`[data-sheet="${p.sheets[to].id}"]`)?.focus());
        }}
      >
        {p.sheets.map((x) => (
          <button
            key={x.id}
            type="button"
            role="tab"
            data-sheet={x.id}
            tabIndex={x.id === p.sheet.id ? 0 : -1}
            aria-selected={x.id === p.sheet.id}
            className={s.tab}
            onClick={() => p.onSheet(x.id)}
          >
            {x.name}
            <span className={s.tabCount}>{p.counts[x.id]}</span>
          </button>
        ))}
        <button type="button" className={`${s.tab} ${s.tabNew}`} onClick={p.onNewSheet}>
          <Icon name="plus" size={13} />
          New sheet
        </button>
      </div>
      </div>

      {p.checked > 0 ? (
        <div className={s.bulk} role="toolbar" aria-label="Selected tasks">
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
          {p.sheet.query && (
            <span className={s.sortChip} title="Filtered by the command line">
              <Icon name="search" size={13} />
              <span className={s.queryText}>“{p.sheet.query}”</span>
              <button type="button" className={s.chipX} onClick={p.onClearQuery} aria-label={`Stop filtering by ${p.sheet.query}`}>
                <Icon name="close" size={11} />
              </button>
            </span>
          )}
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
            <button type="button" className={s.tool} aria-expanded={open === "group"} onClick={() => toggle("group")} title="Group by" aria-label={`Group by ${GROUP_NAMES[p.sheet.groupBy]}`}>
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
            <button
              type="button"
              className={s.tool}
              data-on={hiddenCount > 0 || undefined}
              aria-expanded={open === "hide"}
              onClick={() => toggle("hide")}
              title="Columns"
              aria-label={hiddenCount ? `Columns, ${hiddenCount} hidden` : "Columns"}
            >
              <Icon name="hide" size={15} />
              {hiddenCount ? (
                <>
                  <span className={s.toolLabel}>Columns ·</span>
                  {hiddenCount} hidden
                </>
              ) : (
                "Columns"
              )}
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
  const keys = useModKeys();
  return (
    <>
      <p className={s.menuLabel}>Group tasks by</p>
      <ul className={s.menuList} role="menu">
        {(["event", "status", "owner", "room", "none"] as GroupBy[]).map((g) => (
          <li key={g}>
            <button type="button" role="menuitemradio" aria-checked={value === g} className={s.menuRow} onClick={() => onPick(g)}>
              <Icon name={g === "event" ? "event" : g === "status" ? "status" : g === "owner" ? "person" : g === "room" ? "room" : "sheet"} size={15} className={s.menuRowIcon} />
              <span>{g === "none" ? "No groups" : GROUP_NAMES[g]}</span>
              {value === g && <Icon name="check" size={14} className={s.menuTick} />}
            </button>
          </li>
        ))}
      </ul>
      <p className={s.keysTip}>
        <span className={s.keysHandle} aria-hidden />
        Drag the square on a cell&apos;s corner to fill down. Dates step a day at a time; hold {keys.alt} to copy instead.
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
        <button type="button" className={s.fchip} aria-pressed={value.stuck} onClick={() => onChange({ ...value, stuck: !value.stuck })}>
          Stuck
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
      <p className={s.menuLabel}>Columns on this sheet</p>
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
          Show every column
        </button>
      </div>
    </>
  );
}

const keyList = (mod: string): [string[], string][] => [
  [["N"], "New task, in plain words"],
  [["/"], "Type a change for the selection"],
  [["Tab"], "Leave the sheet; the arrows move between cells"],
  [["↑", "↓", "←", "→"], "Move between cells"],
  [["⇧", "↓"], "Select a range"],
  [["↵"], "Edit the cell. Typing starts it too, except N and /"],
  [[mod, "D"], "Copy the top cell down"],
  [[mod, "C"], "Copy, ready for a spreadsheet"],
  [[mod, "V"], "Paste into cells"],
  [["⌫"], "Clear the cells"],
  [["Space"], "Tick or untick paid"],
  [["⇧", "Space"], "Show details beside the sheet"],
  [[mod, "Z"], "Undo"],
];

function KeysMenu() {
  const KEYS = keyList(useModKeys().mod);
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
