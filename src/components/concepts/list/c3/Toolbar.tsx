"use client";

import { useState } from "react";
import { PEOPLE, PERSON_IDS, STATUSES, type PersonId, type Row, type StatusId } from "./data";
import { NO_FILTER, ageOf, filterCount, type Column, type Filter, type GroupBy, type Sheet } from "./model";
import { HealthSentence, PrimaryButton, ProjectPill, StuckButton, SummaryLine, TasksHeader, TeamFaces } from "../../tasks/header";
import { ViewSwitch } from "../../tasks/view-switch";
import { useModKeys } from "./keys";
import { Avatar, Icon, Kbd, StatusGlyph } from "./icons";
import { Popover } from "./Overlays";
import s from "./sheet.module.css";

export type HeaderProps = {
  doneWeek: number;
  open: number;
  late: number;
  donePct: number;
  lateOnly: boolean;
  onLate: () => void;
  /** Stuck tasks, longest first. */
  stuck: Row[];
  stuckOnly: boolean;
  onStuck: (on: boolean) => void;
  nudged: Set<string>;
  onNudge: (row: Row) => void;
  onNewTask: () => void;
};

/** Who a nudge for this task goes to. */
export function nudgeTarget(r: Row) {
  if (r.cells.status === "waiting" && r.waitingOn) return r.waitingOn;
  const owner = r.cells.owner as PersonId | null;
  return owner ? PEOPLE[owner].name : null;
}

export function Header(p: HeaderProps) {
  const oldest = p.stuck[0];
  const who = oldest ? nudgeTarget(oldest) : null;
  const age = oldest ? ageOf(oldest) ?? 0 : 0;
  const more = p.stuck.length - 1;
  return (
    <TasksHeader
      project={<ProjectPill name="The Orchard" kind="events" tone="var(--v3-project-4)" />}
      summary={<SummaryLine doneWeek={p.doneWeek} open={p.open} late={p.late} donePct={p.donePct} lateOnly={p.lateOnly} onLate={p.onLate} />}
      health={
        oldest ? (
          <HealthSentence
            kind="stuck"
            action={who ? `Nudge ${who}` : undefined}
            onAction={() => p.onNudge(oldest)}
            actionDone={p.nudged.has(oldest.id) ? "Nudged" : undefined}
            more={more > 0 ? `${more} more stuck` : undefined}
            onMore={() => p.onStuck(true)}
          >
            <strong>{String(oldest.cells.title)}</strong>{" "}
            {oldest.cells.status === "waiting" && oldest.waitingOn
              ? `has waited ${age} days on ${oldest.waitingOn}.`
              : `has sat ${age} days in ${STATUSES.find((x) => x.id === oldest.cells.status)?.name ?? "its stage"}.`}
          </HealthSentence>
        ) : (
          <HealthSentence kind="healthy">
            <strong>Nothing is stuck.</strong> Work is moving at its usual pace.
          </HealthSentence>
        )
      }
      actions={
        <>
          <TeamFaces people={PERSON_IDS.map((id) => ({ id, name: PEOPLE[id].name, initials: PEOPLE[id].initial, tone: PEOPLE[id].tone }))} />
          {p.stuck.length > 0 || p.stuckOnly ? <StuckButton count={p.stuck.length} pressed={p.stuckOnly} onToggle={() => p.onStuck(!p.stuckOnly)} /> : null}
          <PrimaryButton onClick={p.onNewTask}>New task</PrimaryButton>
        </>
      }
    />
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
      <div className={s.toolbarLead}>
      <ViewSwitch current="list" className={s.viewSwitch} />
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
              {hiddenCount ? `Columns · ${hiddenCount} hidden` : "Columns"}
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
  [["↑", "↓", "←", "→"], "Move between cells"],
  [["⇧", "↓"], "Select a range"],
  [["↵"], "Edit the cell"],
  [[mod, "D"], "Copy the top cell down"],
  [[mod, "C"], "Copy, ready for a spreadsheet"],
  [[mod, "V"], "Paste into cells"],
  [["⌫"], "Clear the cells"],
  [["Space"], "Tick or untick paid"],
  [["⇧", "Space"], "Open the task"],
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
