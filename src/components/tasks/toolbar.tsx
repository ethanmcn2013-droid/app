"use client";

/**
 * The toolbar: view switch, search, Filter and Display, then the active
 * filter chips and the one-time hint. Filters live in the room tools, so
 * the facts in the header, the Filter menu, the chips and saved views are
 * one model.
 */

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PRIORITY_LABEL, type Priority } from "@/lib/data";
import { useRoomTools, type RoomDueFilter, type RoomSortMode } from "@/components/app/room/room-tools-context";
import { useWorkspaceMembers } from "@/lib/domain-context";
import { useLabelNames } from "./task-bits";
import { useTaskPanel } from "@/lib/tasks/use-task-panel";
import { floorViewHref } from "@/lib/projects/floor-view-href";
import { useActiveProject } from "@/components/app/active-project-provider";
import { tagDisplayName } from "@/lib/tags";
import { useFitColumns, useShowStatusDescriptions } from "@/components/hybrid/view-prefs";
import type { TasksViewId } from "@/lib/product-urls";
import { priorityToLab } from "@/components/hybrid/adapter";
import { useSurface } from "./surface";
import { useProjectIdentity } from "./header";
import { TIcon } from "./icons";
import { Kbd, PriorityIcon, StatusGlyph } from "./atoms";
import {
  Button,
  MenuCheckboxItem,
  MenuContent,
  MenuItem,
  MenuLabel,
  MenuRadioGroup,
  MenuRadioItem,
  MenuRoot,
  MenuSeparator,
  MenuSub,
  MenuSubContent,
  MenuSubTrigger,
  MenuTrigger,
} from "./ui";
import {
  useCalendarDone,
  useCalendarWeekends,
  useDoneMode,
  useFirstRunHint,
  useListGroup,
  useTaskNumbers,
  type DoneMode,
  type ListGroup,
} from "./display-prefs";
import styles from "./workspace.module.css";

const VIEWS: { id: TasksViewId; label: string; icon: (p: { size?: number }) => React.ReactElement; key: string }[] = [
  { id: "board", label: "Board", icon: TIcon.board, key: "1" },
  { id: "list", label: "List", icon: TIcon.list, key: "2" },
  { id: "calendar", label: "Calendar", icon: TIcon.calendar, key: "3" },
];

export function useViewHref() {
  const project = useProjectIdentity();
  const active = useActiveProject();
  const { taskId } = useTaskPanel();
  // V3 supplies only a verified Project. While it is pending, a view switch
  // must not fall back to a stale ambient Project.
  const verified = active?.enabled
    ? active.chrome.kind === "verified"
      ? active.chrome.project.id
      : null
    : project.projectId;
  const blocked = Boolean(active?.enabled && !verified);
  return {
    blocked,
    href: (view: TasksViewId) => floorViewHref(view, verified, taskId),
  };
}

export function TasksToolbar({ searchRef }: { searchRef: React.RefObject<HTMLInputElement | null> }) {
  return (
    <div className={styles.toolbar} role="toolbar" aria-label="Tasks tools">
      <ViewSwitch />
      <div className={styles.toolbarRight}>
        <SearchField inputRef={searchRef} />
        <FilterMenu />
        <DisplayMenu />
      </div>
    </div>
  );
}

/* ── View switch ──────────────────────────────────────────────────── */

function ViewSwitch() {
  const surface = useSurface();
  const router = useRouter();
  const { blocked, href } = useViewHref();
  return (
    <nav className={styles.viewSwitch} aria-label="Task views">
      {VIEWS.map((view) => {
        const Icon = view.icon;
        const current = surface.view === view.id;
        if (blocked) {
          return (
            <span key={view.id} className={styles.viewItem} aria-disabled="true" data-current={current ? "" : undefined}>
              <Icon size={15} />
              <span className={styles.viewLabel}>{view.label}</span>
            </span>
          );
        }
        return (
          <Link
            key={view.id}
            href={href(view.id)}
            className={styles.viewItem}
            aria-current={current ? "page" : undefined}
            aria-keyshortcuts={view.key}
            title={`${view.label} (${view.key})`}
            onClick={(event) => {
              event.preventDefault();
              router.push(href(view.id));
            }}
          >
            <Icon size={15} />
            <span className={styles.viewLabel}>{view.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

/* ── Search ───────────────────────────────────────────────────────── */

function SearchField({ inputRef }: { inputRef: React.RefObject<HTMLInputElement | null> }) {
  const { query, setQuery } = useRoomTools();
  return (
    <label className={styles.search} data-filled={query ? "" : undefined}>
      <TIcon.search size={15} />
      <input
        ref={inputRef}
        type="search"
        value={query}
        placeholder="Find a task"
        aria-label="Find a task"
        aria-keyshortcuts="/"
        className={styles.searchInput}
        onChange={(event) => setQuery(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.preventDefault();
            if (query) setQuery("");
            else event.currentTarget.blur();
          }
        }}
      />
      {query ? (
        <button type="button" className={styles.searchClear} aria-label="Clear search" onClick={() => setQuery("")}>
          <TIcon.close size={12} />
        </button>
      ) : (
        <span className={styles.searchKey} aria-hidden="true"><Kbd>/</Kbd></span>
      )}
    </label>
  );
}

/* ── Filter ───────────────────────────────────────────────────────── */

const DUE_OPTIONS: [RoomDueFilter, string][] = [
  ["all", "Any date"],
  ["overdue", "Overdue"],
  ["today", "Due today"],
  ["week", "Due in the next 7 days"],
  ["unscheduled", "No date"],
];

const PRIORITIES: Priority[] = ["p0", "p1", "p2", "p3"];

export function FilterMenu({ compact = false }: { compact?: boolean }) {
  const surface = useSurface();
  const tools = useRoomTools();
  const members = useWorkspaceMembers();
  const tags = useLabelNames(surface.all);
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState("");
  const count = tools.activeFilterCount;

  const saveView = () => {
    const clean = name.trim();
    if (!clean) return;
    tools.saveCurrentView(clean, surface.view);
    setName("");
    setNaming(false);
  };

  return (
    <MenuRoot onOpenChange={(open) => { if (!open) setNaming(false); }}>
      <MenuTrigger asChild>
        <Button
          variant={count ? "default" : "ghost"}
          icon={<TIcon.filter />}
          iconOnly={compact && !count}
          aria-label={count ? `Filter, ${count} on` : "Filter"}
          aria-keyshortcuts="F"
          className={styles.toolButton}
          data-active={count ? "" : undefined}
        >
          {compact && !count ? null : <span className={styles.toolLabel}>Filter</span>}
          {count ? <span className={styles.toolCount}>{count}</span> : null}
        </Button>
      </MenuTrigger>
      <MenuContent align="end" width={260} label="Filter tasks">
        <MenuSub>
          <MenuSubTrigger icon={<StatusGlyph column={surface.columns[1]} size={14} />} hint={tools.column === "all" ? null : surface.columnOf(tools.column)?.name}>
            Status
          </MenuSubTrigger>
          <MenuSubContent width={220}>
            <MenuRadioGroup value={tools.column} onValueChange={tools.setColumn}>
              <MenuRadioItem value="all">Any status</MenuRadioItem>
              {surface.columns.map((column) => (
                <MenuRadioItem key={column.key} value={column.key} icon={<StatusGlyph column={column} size={14} />}>
                  {column.name}
                </MenuRadioItem>
              ))}
            </MenuRadioGroup>
          </MenuSubContent>
        </MenuSub>
        <MenuSub>
          <MenuSubTrigger
            icon={<TIcon.person />}
            hint={
              tools.owner === "all"
                ? null
                : tools.owner === "unassigned"
                  ? "No one"
                  : tools.owner === "assigned"
                    ? "Anyone"
                    : members.find((m) => m.id === tools.owner)?.name
            }
          >
            Assignee
          </MenuSubTrigger>
          <MenuSubContent width={240}>
            <MenuRadioGroup value={tools.owner} onValueChange={tools.setOwner}>
              <MenuRadioItem value="all">Anyone or no one</MenuRadioItem>
              <MenuRadioItem value="unassigned">No one yet</MenuRadioItem>
              {members.map((member) => (
                <MenuRadioItem key={member.id} value={member.id}>{member.name}</MenuRadioItem>
              ))}
            </MenuRadioGroup>
          </MenuSubContent>
        </MenuSub>
        <MenuSub>
          <MenuSubTrigger icon={<PriorityIcon priority="high" />} hint={tools.priority === "all" ? null : PRIORITY_LABEL[tools.priority].label}>
            Priority
          </MenuSubTrigger>
          <MenuSubContent width={200}>
            <MenuRadioGroup value={tools.priority} onValueChange={(value) => tools.setPriority(value as Priority | "all")}>
              <MenuRadioItem value="all">Any priority</MenuRadioItem>
              {PRIORITIES.map((priority) => (
                <MenuRadioItem key={priority} value={priority} icon={<PriorityIcon priority={priorityToLab(priority)} />}>
                  {PRIORITY_LABEL[priority].label}
                </MenuRadioItem>
              ))}
            </MenuRadioGroup>
          </MenuSubContent>
        </MenuSub>
        <MenuSub>
          <MenuSubTrigger icon={<TIcon.calendar />} hint={tools.due === "all" ? null : DUE_OPTIONS.find(([v]) => v === tools.due)?.[1]}>
            Due date
          </MenuSubTrigger>
          <MenuSubContent width={220}>
            <MenuRadioGroup value={tools.due} onValueChange={(value) => tools.setDue(value as RoomDueFilter)}>
              {DUE_OPTIONS.map(([value, label]) => (
                <MenuRadioItem key={value} value={value}>{label}</MenuRadioItem>
              ))}
            </MenuRadioGroup>
          </MenuSubContent>
        </MenuSub>
        {tags.length > 0 ? (
          <MenuSub>
            <MenuSubTrigger icon={<TIcon.tag />} hint={tools.label === "all" ? null : tagDisplayName(tools.label)}>
              Label
            </MenuSubTrigger>
            <MenuSubContent width={220}>
              <MenuRadioGroup value={tools.label} onValueChange={tools.setLabel}>
                <MenuRadioItem value="all">Any label</MenuRadioItem>
                {tags.map((tag) => (
                  <MenuRadioItem key={tag} value={tag}>{tagDisplayName(tag)}</MenuRadioItem>
                ))}
              </MenuRadioGroup>
            </MenuSubContent>
          </MenuSub>
        ) : null}
        {count ? (
          <>
            <MenuSeparator />
            <MenuItem icon={<TIcon.close />} hint={<Kbd>⇧F</Kbd>} onSelect={tools.clearFilters}>Clear filters</MenuItem>
          </>
        ) : null}
        <MenuSeparator />
        <MenuLabel>Saved views</MenuLabel>
        {tools.savedViews.length === 0 ? (
          <p className={styles.menuNote}>Save the filters you use often and come back to them in one click.</p>
        ) : (
          tools.savedViews.map((view) => (
            <SavedViewRow key={view.id} id={view.id} name={view.name} />
          ))
        )}
        {naming ? (
          <form
            className={styles.saveForm}
            onSubmit={(event) => {
              event.preventDefault();
              saveView();
            }}
            onKeyDown={(event) => event.stopPropagation()}
          >
            <input
              className={styles.saveInput}
              value={name}
              autoFocus
              maxLength={60}
              placeholder="Name this view"
              aria-label="Name this view"
              onChange={(event) => setName(event.target.value)}
            />
            <Button type="submit" size="sm" variant="primary" disabled={!name.trim()}>Save</Button>
          </form>
        ) : (
          <MenuItem icon={<TIcon.bookmark />} keepOpen onSelect={() => setNaming(true)}>Save this view…</MenuItem>
        )}
      </MenuContent>
    </MenuRoot>
  );
}

function SavedViewRow({ id, name }: { id: string; name: string }) {
  const tools = useRoomTools();
  return (
    <div className={styles.savedRow}>
      <MenuItem icon={<TIcon.bookmark />} onSelect={() => tools.applySavedView(id)}>{name}</MenuItem>
      <button
        type="button"
        className={styles.savedDelete}
        aria-label={`Delete the saved view ${name}`}
        onClick={(event) => {
          event.stopPropagation();
          tools.deleteSavedView(id);
        }}
      >
        <TIcon.trash size={14} />
      </button>
    </div>
  );
}

/* ── Display ──────────────────────────────────────────────────────── */

const SORTS: [RoomSortMode | "priority", string][] = [
  ["manual", "Manual"],
  ["date", "Due date"],
  ["title", "Title"],
];

export function DisplayMenu({ compact = false }: { compact?: boolean }) {
  const surface = useSurface();
  const tools = useRoomTools();
  const [fit, toggleFit] = useFitColumns();
  const [notes, toggleNotes] = useShowStatusDescriptions();
  const [doneMode, setDoneMode] = useDoneMode();
  const [numbers, setNumbers] = useTaskNumbers();
  const [group, setGroup] = useListGroup();
  const [weekends, setWeekends] = useCalendarWeekends();
  const [calendarDone, setCalendarDone] = useCalendarDone();

  return (
    <MenuRoot>
      <MenuTrigger asChild>
        <Button variant="ghost" icon={<TIcon.display />} iconOnly={compact} aria-label="Display options" className={styles.toolButton}>
          {compact ? null : <span className={styles.toolLabel}>Display</span>}
        </Button>
      </MenuTrigger>
      <MenuContent align="end" width={250} label="Display options">
        <MenuLabel>Density</MenuLabel>
        <MenuRadioGroup value={tools.density} onValueChange={(value) => tools.setDensity(value as "compact" | "comfortable")}>
          <MenuRadioItem value="comfortable" keepOpen>Comfortable</MenuRadioItem>
          <MenuRadioItem value="compact" keepOpen>Compact</MenuRadioItem>
        </MenuRadioGroup>
        {surface.view === "board" ? (
          <>
            <MenuSeparator />
            <MenuLabel>Board</MenuLabel>
            <MenuCheckboxItem checked={fit} onCheckedChange={toggleFit}>Fit columns to the page</MenuCheckboxItem>
            <MenuCheckboxItem checked={notes} onCheckedChange={toggleNotes}>Show column notes</MenuCheckboxItem>
            <MenuCheckboxItem checked={numbers === "on"} onCheckedChange={(on) => setNumbers(on ? "on" : "off")}>Show task numbers</MenuCheckboxItem>
            <MenuSub>
              <MenuSubTrigger hint={doneMode === "compact" ? "Compact" : doneMode === "full" ? "Full" : "Collapsed"}>Done column</MenuSubTrigger>
              <MenuSubContent width={200}>
                <MenuRadioGroup value={doneMode} onValueChange={(value) => setDoneMode(value as DoneMode)}>
                  <MenuRadioItem value="compact">Compact rows</MenuRadioItem>
                  <MenuRadioItem value="full">Full cards</MenuRadioItem>
                  <MenuRadioItem value="collapsed">Collapsed</MenuRadioItem>
                </MenuRadioGroup>
              </MenuSubContent>
            </MenuSub>
          </>
        ) : null}
        {surface.view === "list" ? (
          <>
            <MenuSeparator />
            <MenuLabel>List</MenuLabel>
            <MenuSub>
              <MenuSubTrigger hint={GROUP_LABEL[group]}>Group by</MenuSubTrigger>
              <MenuSubContent width={200}>
                <MenuRadioGroup value={group} onValueChange={(value) => setGroup(value as ListGroup)}>
                  {(Object.keys(GROUP_LABEL) as ListGroup[]).map((value) => (
                    <MenuRadioItem key={value} value={value}>{GROUP_LABEL[value]}</MenuRadioItem>
                  ))}
                </MenuRadioGroup>
              </MenuSubContent>
            </MenuSub>
          </>
        ) : null}
        {surface.view !== "calendar" ? (
          <MenuSub>
            <MenuSubTrigger hint={SORTS.find(([value]) => value === tools.sort)?.[1]}>Order</MenuSubTrigger>
            <MenuSubContent width={200}>
              <MenuRadioGroup value={tools.sort} onValueChange={(value) => tools.setSort(value as RoomSortMode)}>
                {SORTS.map(([value, label]) => (
                  <MenuRadioItem key={value} value={value}>{label}</MenuRadioItem>
                ))}
              </MenuRadioGroup>
            </MenuSubContent>
          </MenuSub>
        ) : (
          <>
            <MenuSeparator />
            <MenuLabel>Calendar</MenuLabel>
            <MenuCheckboxItem checked={weekends === "on"} onCheckedChange={(on) => setWeekends(on ? "on" : "off")}>Show weekends</MenuCheckboxItem>
            <MenuCheckboxItem checked={calendarDone === "on"} onCheckedChange={(on) => setCalendarDone(on ? "on" : "off")}>Show finished tasks</MenuCheckboxItem>
          </>
        )}
      </MenuContent>
    </MenuRoot>
  );
}

export const GROUP_LABEL: Record<ListGroup, string> = {
  status: "Status",
  assignee: "Assignee",
  priority: "Priority",
  due: "Due date",
  none: "No grouping",
};

/* ── Active filter chips ──────────────────────────────────────────── */

const DUE_CHIP: Record<Exclude<RoomDueFilter, "all">, string> = {
  overdue: "Overdue",
  today: "Due today",
  week: "Due in the next 7 days",
  unscheduled: "No date",
};

export function describeFilters(
  tools: ReturnType<typeof useRoomTools>,
  names: { member: (id: string) => string; column: (key: string) => string },
): { key: string; label: string; clear: () => void }[] {
  const chips: { key: string; label: string; clear: () => void }[] = [];
  if (tools.due !== "all") chips.push({ key: "due", label: DUE_CHIP[tools.due], clear: () => tools.setDue("all") });
  if (tools.column !== "all") chips.push({ key: "status", label: `Status: ${names.column(tools.column)}`, clear: () => tools.setColumn("all") });
  if (tools.owner !== "all") {
    const who = tools.owner === "unassigned" ? "no one" : tools.owner === "assigned" ? "anyone" : names.member(tools.owner);
    chips.push({ key: "owner", label: `Assignee: ${who}`, clear: () => tools.setOwner("all") });
  }
  if (tools.priority !== "all") chips.push({ key: "priority", label: `Priority: ${PRIORITY_LABEL[tools.priority].label}`, clear: () => tools.setPriority("all") });
  if (tools.label !== "all") chips.push({ key: "label", label: `Label: ${tagDisplayName(tools.label)}`, clear: () => tools.setLabel("all") });
  return chips;
}

export function FilterChips({ shown, total }: { shown: number; total: number }) {
  const tools = useRoomTools();
  const surface = useSurface();
  const members = useWorkspaceMembers();
  const chips = describeFilters(tools, {
    member: (id) => members.find((m) => m.id === id)?.name ?? "someone",
    column: (key) => surface.columnOf(key)?.name ?? key,
  });
  if (chips.length === 0 && !tools.query) return null;
  return (
    <div className={styles.chips} role="group" aria-label="Active filters">
      {chips.map((chip) => (
        <button key={chip.key} type="button" className={styles.chip} onClick={chip.clear} aria-label={`Remove filter ${chip.label}`}>
          {chip.label}
          <TIcon.close size={12} />
        </button>
      ))}
      {tools.query ? (
        <button type="button" className={styles.chip} onClick={() => tools.setQuery("")} aria-label={`Clear search for ${tools.query}`}>
          Matching “{tools.query}”
          <TIcon.close size={12} />
        </button>
      ) : null}
      <span className={styles.chipCount} aria-live="polite">
        Showing {shown} of {total} {total === 1 ? "task" : "tasks"}
      </span>
      {chips.length > 0 ? (
        <button type="button" className={styles.clearAll} onClick={tools.clearFilters}>Clear filters</button>
      ) : null}
    </div>
  );
}

/* ── First-run hint ───────────────────────────────────────────────── */

export function FirstRunHint() {
  const surface = useSurface();
  const [hint, setHint] = useFirstRunHint();
  if (hint !== "on" || surface.readOnly || surface.all.length === 0) return null;
  const line =
    surface.view === "board"
      ? "Drag a card to the right as work moves along. Press ? for shortcuts."
      : surface.view === "list"
        ? "Click any cell to change it. Select rows to act on several at once. Press ? for shortcuts."
        : "Drag a task onto a day to give it a date. Drag it back to the tray to clear it.";
  return (
    <div className={styles.hint}>
      <TIcon.sparkle size={14} />
      <span className={styles.hintText} title={line}>{line}</span>
      <button type="button" className={styles.hintClose} aria-label="Dismiss this tip" onClick={() => setHint("off")}>
        <TIcon.close size={12} />
      </button>
    </div>
  );
}
