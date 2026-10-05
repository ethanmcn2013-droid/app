"use client";

/**
 * List: every task as a row in one calm table.
 *
 * Grouped by status by default (or assignee, priority, due date, none),
 * with sticky, foldable group headers. Each property cell opens its picker
 * without opening the task; the row itself opens the task. Selecting rows
 * brings up the bulk bar. On a phone each row becomes two lines.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLabStore } from "@/components/hybrid/store";
import { useCalendarFrame } from "@/components/app/room/room-brief-context";
import { useRoomTools } from "@/components/app/room/room-tools-context";
import { useWorkspaceMembers } from "@/lib/domain-context";
import { useTaskPanel } from "@/lib/tasks/use-task-panel";
import { AvatarStack } from "@/components/app/presence/avatar-stack";
import type { NewTaskDefaults } from "@/components/app/add-task/add-task-context";
import { PRIORITY_LABELS, TASK_PRIORITIES, type LabTask, type TaskPriority } from "@/components/hybrid/types";
import type { BoardColumn } from "@/lib/board-columns";
import { useSurface } from "./surface";
import { timeOf, type TimeFact } from "./time";
import { CompleteToggle, DueChip, LabelChips, PriorityMark, StatusGlyph, srOnly } from "./atoms";
import { Highlight, describeTask, labelsOf, usePeople, useTaskNumberOf } from "./task-bits";
import { useListColumns, useListGroup, useTaskNumbers, type ListGroup } from "./display-prefs";
import { TIcon } from "./icons";
import { setVisibleTaskOrder } from "./sheet-bridge";
import { MenuCheckboxItem, MenuContent, MenuLabel, MenuRoot, MenuTrigger } from "./ui";
import styles from "./list.module.css";

type SortKey = "title" | "status" | "assignee" | "due" | "priority";
type Sort = { key: SortKey; dir: 1 | -1 } | null;

type Group = { key: string; title: string; icon: React.ReactNode; tasks: LabTask[]; columnKey?: string; defaults?: Partial<NewTaskDefaults> };

/** Optional columns people can add; the core four are always shown. */
export const OPTIONAL_LIST_COLUMNS: { id: string; label: string }[] = [
  { id: "labels", label: "Labels" },
  { id: "subtasks", label: "Subtasks" },
  { id: "amount", label: "Amount" },
];

const PRIORITY_RANK: Record<TaskPriority, number> = { urgent: 0, high: 1, normal: 2, low: 3 };

function dueKey(task: LabTask): string {
  const s = task.schedule;
  return s.kind === "unscheduled" ? "9999-12-31" : s.kind === "milestone" ? s.on : s.dueOn;
}

export function ListView({ onCompose }: { onCompose: (extra: Partial<NewTaskDefaults>, anchor: HTMLElement | null) => void }) {
  const surface = useSurface();
  const store = useLabStore();
  const calendar = useCalendarFrame();
  const tools = useRoomTools();
  const members = useWorkspaceMembers();
  const people = usePeople();
  const [group] = useListGroup();
  const [extras, setExtras] = useListColumns();
  const [numbersPref] = useTaskNumbers();
  const numberOf = useTaskNumberOf();
  const [sort, setSort] = useState<Sort>(null);
  const [folded, setFolded] = useState<Record<string, boolean>>({});
  const [adding, setAdding] = useState<string | null>(null);
  const { taskId: openId } = useTaskPanel();
  const gridRef = useRef<HTMLDivElement | null>(null);

  const sorted = useMemo(() => {
    const list = [...surface.visible];
    if (!sort) return tools.sort === "manual" ? list.sort((a, b) => surface.columns.findIndex((c) => c.key === a.status) - surface.columns.findIndex((c) => c.key === b.status) || a.order - b.order) : list;
    const statusRank = (task: LabTask) => surface.columns.findIndex((c) => c.key === task.status);
    const name = (task: LabTask) => members.find((m) => m.id === task.assigneeIds[0])?.name ?? "~";
    const compare: Record<SortKey, (a: LabTask, b: LabTask) => number> = {
      title: (a, b) => a.title.localeCompare(b.title, "en-GB"),
      status: (a, b) => statusRank(a) - statusRank(b),
      assignee: (a, b) => name(a).localeCompare(name(b), "en-GB"),
      due: (a, b) => dueKey(a).localeCompare(dueKey(b)),
      priority: (a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority],
    };
    return list.sort((a, b) => compare[sort.key](a, b) * sort.dir);
  }, [members, sort, surface.columns, surface.visible, tools.sort]);

  const groups = useMemo<Group[]>(() => buildGroups(group, sorted, surface.columns, members, calendar.today), [group, sorted, surface.columns, members, calendar.today]);
  const ordered = useMemo(() => groups.flatMap((g) => (folded[g.key] ?? defaultFolded(g, group) ? [] : g.tasks.map((t) => t.id))), [folded, group, groups]);
  useEffect(() => setVisibleTaskOrder(ordered), [ordered]);
  const selecting = store.selectedIds.length > 0;

  const toggleSort = (key: SortKey) =>
    setSort((current) => (current?.key !== key ? { key, dir: 1 } : current.dir === 1 ? { key, dir: -1 } : null));

  const focusRow = useCallback((id: string) => {
    window.requestAnimationFrame(() => gridRef.current?.querySelector<HTMLElement>(`[data-id="${CSS.escape(id)}"]`)?.focus());
  }, []);

  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement;
    if (target.closest("input, textarea")) return;
    const row = target.closest<HTMLElement>("[data-id]");
    if (!row) return;
    const id = row.dataset.id!;
    const at = ordered.indexOf(id);
    const step = event.key === "ArrowDown" || event.key === "j" ? 1 : event.key === "ArrowUp" || event.key === "k" ? -1 : 0;
    if (step && !event.metaKey && !event.ctrlKey && !event.altKey) {
      event.preventDefault();
      const next = ordered[at + step];
      if (!next) return;
      if (event.shiftKey && !surface.readOnly) store.toggleSelected(next, ordered, true);
      surface.setFocusedId(next);
      focusRow(next);
    }
  };

  const showLabels = extras.includes("labels");
  const showSubtasks = extras.includes("subtasks");
  const showAmount = extras.includes("amount");
  // Grouped by status, the group row already names each row's status.
  const showStatus = group !== "status";
  const showPriority = group !== "priority";
  // Wide: every column at its comfortable width. Mid (the list narrower
  // than ~900px, e.g. 1024 with the sidebar, or beside the docked sheet):
  // Assignee shows faces only, Priority its mark, Labels one chip and +N,
  // and Subtasks and Amount step aside before anything clips. Narrower
  // still (~700px) the rows stack, as on a phone. list.module.css picks.
  const track = (wide: boolean) =>
    [
      "36px",
      "minmax(200px, 1fr)",
      showStatus ? (wide ? "136px" : "120px") : null,
      wide ? "144px" : "44px",
      wide ? "150px" : "128px",
      showPriority ? (wide ? "104px" : "44px") : null,
      showLabels ? (wide ? "150px" : "112px") : null,
      wide && showSubtasks ? "84px" : null,
      wide && showAmount ? "88px" : null,
      "36px",
    ]
      .filter(Boolean)
      .join(" ");
  const template = track(true);
  const templateMid = track(false);

  const sortOf = (key: SortKey) => (sort?.key === key ? (sort.dir === 1 ? "ascending" : "descending") : "none");
  const header = (key: SortKey, label: string) => (
    <button
      type="button"
      className={styles.headButton}
      data-sorted={sort?.key === key ? "" : undefined}
      aria-label={`${label}, sort ${sortOf(key) === "ascending" ? "descending" : "ascending"}`}
      onClick={() => toggleSort(key)}
    >
      {label}
      {sort?.key === key ? (sort.dir === 1 ? <TIcon.chevronUp size={12} /> : <TIcon.chevronDown size={12} />) : null}
    </button>
  );

  if (surface.all.length === 0) {
    return (
      <div className={styles.wrap}>
        <div className={styles.firstRun}>
          <span className={styles.firstIcon} aria-hidden="true"><TIcon.list size={18} /></span>
          <h2>Nothing on the list yet</h2>
          <p>Every task in this project shows up here as a row you can sort, group and change in place.</p>
          {surface.readOnly ? null : (
            <button type="button" className={styles.firstButton} onClick={(event) => onCompose({}, event.currentTarget)}>
              <TIcon.plus size={14} /> Add the first task
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={styles.wrap} data-selecting={selecting ? "" : undefined}>
      <div className={styles.grid} role="grid" aria-label="Tasks" aria-rowcount={sorted.length + 1} ref={gridRef} onKeyDown={onKeyDown} style={{ "--cols": template, "--cols-mid": templateMid } as React.CSSProperties}>
        <div className={styles.headRow} role="row">
          <span role="columnheader" className={styles.checkHead}>
            <span className={srOnly}>Select</span>
          </span>
          <span role="columnheader" aria-sort={sortOf("title")} className={styles.titleHead}>{header("title", "Task")}</span>
          {showStatus ? <span role="columnheader" data-col="status" aria-sort={sortOf("status")}>{header("status", "Status")}</span> : null}
          <span role="columnheader" data-col="assignee" className={styles.assigneeHead} aria-sort={sortOf("assignee")}>{header("assignee", "Assignee")}</span>
          <span role="columnheader" aria-sort={sortOf("due")}>{header("due", "Due date")}</span>
          {showPriority ? <span role="columnheader" data-col="priority" className={styles.priorityHead} aria-sort={sortOf("priority")}>{header("priority", "Priority")}</span> : null}
          {showLabels ? <span role="columnheader" className={styles.plainHead}>Labels</span> : null}
          {showSubtasks ? <span role="columnheader" data-col="subtasks" className={`${styles.plainHead} ${styles.wideOnly}`}>Subtasks</span> : null}
          {showAmount ? <span role="columnheader" data-col="amount" className={`${styles.plainHead} ${styles.wideOnly}`}>Amount</span> : null}
          <span role="columnheader" className={styles.pickHead}>
            <MenuRoot>
              <MenuTrigger asChild>
                <button type="button" className={styles.iconButton} aria-label="Choose columns">
                  <TIcon.display size={14} />
                </button>
              </MenuTrigger>
              <MenuContent align="end" width={220} label="Choose columns">
                <MenuLabel>Show columns</MenuLabel>
                {OPTIONAL_LIST_COLUMNS.map((column) => (
                  <MenuCheckboxItem
                    key={column.id}
                    checked={extras.includes(column.id)}
                    onCheckedChange={(on) => setExtras(on ? [...extras, column.id] : extras.filter((x) => x !== column.id))}
                  >
                    {column.label}
                  </MenuCheckboxItem>
                ))}
              </MenuContent>
            </MenuRoot>
          </span>
        </div>

        {groups.map((g) => {
          const isFolded = folded[g.key] ?? defaultFolded(g, group);
          const done = g.tasks.filter((t) => surface.isDone(t)).length;
          return (
            <div key={g.key} role="rowgroup" className={styles.group}>
              {group !== "none" ? (
                <div className={styles.groupHead} role="row">
                  <span role="gridcell" className={styles.groupCell}>
                    <button
                      type="button"
                      className={styles.groupToggle}
                      aria-expanded={!isFolded}
                      onClick={() => setFolded((f) => ({ ...f, [g.key]: !isFolded }))}
                    >
                      <span className={styles.chevron} data-open={!isFolded ? "" : undefined} aria-hidden="true"><TIcon.chevronRight size={14} /></span>
                      {g.icon}
                      <span className={styles.groupTitle}>{g.title}</span>
                      <span className={styles.groupCount}>{g.tasks.length}</span>
                      {done > 0 && done < g.tasks.length ? <span className={styles.groupDone}>{done} of {g.tasks.length} done</span> : null}
                    </button>
                    {surface.readOnly ? null : (
                      <button
                        type="button"
                        className={styles.groupAdd}
                        onClick={(event) => {
                          if (g.columnKey) {
                            setFolded((f) => ({ ...f, [g.key]: false }));
                            setAdding(g.key);
                          } else onCompose(g.defaults ?? {}, event.currentTarget);
                        }}
                      >
                        <TIcon.plus size={14} />
                        Add a task
                      </button>
                    )}
                  </span>
                </div>
              ) : null}
              {isFolded
                ? null
                : g.tasks.map((task) => (
                    <ListRow
                      key={task.id}
                      task={task}
                      column={surface.columnOf(task.status)}
                      time={timeOf(task, surface.isDone(task), calendar)}
                      people={people(task.assigneeIds)}
                      selected={store.selectedIds.includes(task.id)}
                      open={openId === task.id}
                      ordered={ordered}
                      number={numbersPref === "on" ? numberOf(task.id) : null}
                      stop={(surface.focusedId && ordered.includes(surface.focusedId) ? surface.focusedId : ordered[0]) === task.id}
                      extras={{ status: showStatus, priority: showPriority, labels: showLabels, subtasks: showSubtasks, amount: showAmount }}
                    />
                  ))}
              {adding === g.key && g.columnKey ? (
                <InlineRow
                  columnKey={g.columnKey}
                  onDone={() => setAdding(null)}
                />
              ) : null}
            </div>
          );
        })}
      </div>
      {surface.filtering && surface.visible.length === 0 ? (
        <div className={styles.empty} role="status">
          <TIcon.filter size={16} />
          <span>{tools.query.trim() && tools.activeFilterCount === 0 ? `Nothing matches “${tools.query.trim()}” in titles or descriptions.` : "No tasks match these filters."}</span>
          {tools.query ? <button type="button" onClick={() => tools.setQuery("")}>Clear search</button> : null}
          {tools.activeFilterCount ? <button type="button" onClick={tools.clearFilters}>Clear filters</button> : null}
        </div>
      ) : null}
    </div>
  );
}

function defaultFolded(g: Group, group: ListGroup): boolean {
  return group === "status" && g.key === "status:done" && g.tasks.length > 0;
}

function buildGroups(
  group: ListGroup,
  tasks: LabTask[],
  columns: BoardColumn[],
  members: { id: string; name: string; initials: string }[],
  today: string,
): Group[] {
  if (group === "none") return [{ key: "all", title: "All tasks", icon: null, tasks }];
  if (group === "status") {
    return columns.map((column) => ({
      key: `status:${column.isDone ? "done" : column.key}`,
      title: column.name,
      icon: <StatusGlyph column={column} size={15} />,
      tasks: tasks.filter((t) => t.status === column.key),
      columnKey: column.key,
    }));
  }
  if (group === "priority") {
    return [...TASK_PRIORITIES].map((priority) => ({
      key: `priority:${priority}`,
      title: PRIORITY_LABELS[priority],
      icon: <span className={styles.groupIcon}><PriorityMark priority={priority} /></span>,
      tasks: tasks.filter((t) => t.priority === priority),
      defaults: { priority },
    })).filter((g) => g.tasks.length > 0);
  }
  if (group === "assignee") {
    const groups: Group[] = members.map((member) => ({
      key: `assignee:${member.id}`,
      title: member.name,
      icon: <AvatarStack members={[{ id: member.id, name: member.name, initials: member.initials }]} size="sm" max={1} label={member.name} />,
      tasks: tasks.filter((t) => t.assigneeIds.includes(member.id)),
      defaults: { assigneeIds: [member.id] },
    }));
    groups.push({ key: "assignee:none", title: "No one yet", icon: <TIcon.person size={15} />, tasks: tasks.filter((t) => t.assigneeIds.length === 0), defaults: {} });
    return groups.filter((g) => g.tasks.length > 0);
  }
  // Due date
  const buckets: { key: string; title: string; icon: React.ReactNode; test: (t: LabTask) => boolean }[] = [
    { key: "overdue", title: "Overdue", icon: <TIcon.alert size={15} />, test: (t) => !t.completed && dueKey(t) < today },
    { key: "today", title: "Today", icon: <TIcon.sun size={15} />, test: (t) => dueKey(t) === today },
    { key: "later", title: "Coming up", icon: <TIcon.calendar size={15} />, test: (t) => dueKey(t) > today && dueKey(t) !== "9999-12-31" },
    { key: "none", title: "No date", icon: <TIcon.noDate size={15} />, test: (t) => dueKey(t) === "9999-12-31" },
    { key: "past", title: "Earlier, finished", icon: <TIcon.check size={15} />, test: (t) => t.completed && dueKey(t) < today },
  ];
  return buckets
    .map((b) => ({ key: `due:${b.key}`, title: b.title, icon: b.icon, tasks: tasks.filter(b.test), defaults: b.key === "today" ? { dueOn: today } : {} }))
    .filter((g) => g.tasks.length > 0);
}

function ListRow({
  task,
  column,
  time,
  people,
  selected,
  open,
  ordered,
  number,
  stop,
  extras,
}: {
  task: LabTask;
  column: BoardColumn | undefined;
  time: TimeFact;
  people: ReturnType<ReturnType<typeof usePeople>>;
  selected: boolean;
  open: boolean;
  ordered: string[];
  number: string | null;
  stop: boolean;
  extras: { status: boolean; priority: boolean; labels: boolean; subtasks: boolean; amount: boolean };
}) {
  const surface = useSurface();
  const store = useLabStore();
  const tools = useRoomTools();
  const done = surface.isDone(task);
  const labels = labelsOf(task);
  const subDone = task.subtasks.filter((s) => s.completed).length;
  const ro = surface.readOnly;
  const cell = (kind: "status" | "assignee" | "due" | "priority" | "labels", children: React.ReactNode, label: string) => (
    <span role="gridcell" className={styles.cell} data-col={kind}>
      <button
        type="button"
        data-act={kind}
        className={styles.cellButton}
        tabIndex={-1}
        disabled={ro}
        aria-label={label}
        onClick={(event) => {
          event.stopPropagation();
          surface.openPicker(kind, selected && store.selectedIds.length > 1 ? store.selectedIds : [task.id], event.currentTarget);
        }}
      >
        {children}
      </button>
    </span>
  );
  return (
    <div
      role="row"
      className={styles.row}
      data-id={task.id}
      data-selected={selected ? "" : undefined}
      data-open={open ? "" : undefined}
      data-done={done ? "" : undefined}
      data-density={tools.density}
      aria-selected={selected}
      tabIndex={stop ? 0 : -1}
      aria-label={task.title}
      aria-describedby={`row-d-${task.id}`}
      onFocus={() => surface.setFocusedId(task.id)}
      onClick={(event) => {
        if ((event.target as HTMLElement).closest("[data-act]")) return;
        if (event.shiftKey && !ro) return store.toggleSelected(task.id, ordered, true);
        if ((event.metaKey || event.ctrlKey) && !ro) return store.toggleSelected(task.id);
        store.openTask(task.id);
      }}
      onContextMenu={(event) => {
        event.preventDefault();
        surface.openMenu(task.id, event.clientX, event.clientY);
      }}
    >
      <span role="gridcell" className={styles.checkCell}>
        {ro ? null : (
          <input
            type="checkbox"
            data-act="select"
            className={styles.check}
            checked={selected}
            tabIndex={-1}
            aria-label={`Select ${task.title}`}
            onClick={(event) => event.stopPropagation()}
            onChange={(event) => store.toggleSelected(task.id, ordered, (event.nativeEvent as MouseEvent).shiftKey)}
          />
        )}
      </span>
      <span role="gridcell" className={styles.titleCell}>
        <CompleteToggle title={task.title} done={done} column={column} readOnly={ro} tabIndex={-1} onToggle={() => surface.complete(task.id)} />
        <span className={styles.titleText}>
          <span className={styles.title}>
            {number ? <span className={styles.number}>{number}</span> : null}
            <Highlight text={task.title} />
          </span>
          {tools.density === "comfortable" && task.description ? (
            <span className={styles.desc}>
              <Highlight text={task.description} />
            </span>
          ) : null}
          <span className={styles.phoneMeta} aria-hidden="true">
            {time.kind !== "none" ? <DueChip time={time} compact /> : null}
            {task.priority === "high" || task.priority === "urgent" ? <PriorityMark priority={task.priority} /> : null}
            {labels[0] ? <span>{labels[0].name}</span> : null}
            {people.length ? <AvatarStack members={people} size="sm" max={2} label="" /> : null}
          </span>
        </span>
      </span>
      {extras.status
        ? cell(
            "status",
            <span className={styles.status}>
              <StatusGlyph column={column} size={14} />
              <span>{column?.name ?? task.status}</span>
            </span>,
            `Status: ${column?.name ?? task.status}. Change status`,
          )
        : null}
      {cell(
        "assignee",
        people.length ? (
          <span className={styles.person}>
            <AvatarStack members={people} size="sm" max={2} label={people.map((p) => p.name).join(", ")} />
            <span className={styles.personName}>{people.length === 1 ? people[0].name.split(" ")[0] : `${people.length} people`}</span>
          </span>
        ) : (
          <span className={styles.none}>No one</span>
        ),
        people.length ? `Assigned to ${people.map((p) => p.name).join(", ")}. Change assignees` : "No one assigned. Assign someone",
      )}
      {cell(
        "due",
        time.kind !== "none" ? <DueChip time={time} /> : <span className={styles.none}>No date</span>,
        time.said ? `${time.said}. Change due date` : "No due date. Set one",
      )}
      {extras.priority ? cell("priority", <PriorityMark priority={task.priority} withWord />, `${PRIORITY_LABELS[task.priority]} priority. Change priority`) : null}
      {extras.labels
        ? cell(
            "labels",
            labels.length ? (
              <>
                <span className={`${styles.labels} ${styles.labelsWide}`}><LabelChips labels={labels} /></span>
                <span className={`${styles.labels} ${styles.labelsMid}`}><LabelChips labels={labels} max={1} /></span>
              </>
            ) : (
              <span className={styles.none}>None</span>
            ),
            labels.length ? `Labels: ${labels.map((l) => l.name).join(", ")}. Change labels` : "No labels. Add labels",
          )
        : null}
      {extras.subtasks ? (
        <span role="gridcell" className={`${styles.plainCell} ${styles.wideOnly}`}>{task.subtasks.length ? `${subDone} of ${task.subtasks.length}` : <span className={styles.none}>None</span>}</span>
      ) : null}
      {extras.amount ? (
        <span role="gridcell" className={`${styles.plainCell} ${styles.wideOnly}`}>{typeof task.cents === "number" && task.cents > 0 ? (task.cents / 100).toLocaleString("en-GB", { minimumFractionDigits: 2 }) : <span className={styles.none}>None</span>}</span>
      ) : null}
      <span role="gridcell" className={styles.menuCell}>
        <button
          type="button"
          data-act="menu"
          className={styles.iconButton}
          tabIndex={-1}
          aria-haspopup="menu"
          aria-label={`Actions for ${task.title}`}
          onClick={(event) => {
            event.stopPropagation();
            const rect = event.currentTarget.getBoundingClientRect();
            surface.openMenu(task.id, rect.right, rect.bottom + 4);
          }}
        >
          <TIcon.more size={14} />
        </button>
      </span>
      <span className={srOnly} id={`row-d-${task.id}`}>{describeTask(task, column?.name ?? "", time, people)}.</span>
    </div>
  );
}

function InlineRow({ columnKey, onDone }: { columnKey: string; onDone: () => void }) {
  const surface = useSurface();
  const [value, setValue] = useState("");
  return (
    <div className={styles.inline} role="row">
      <span role="gridcell" className={styles.inlineCell}>
        <StatusGlyph column={surface.columnOf(columnKey)} size={16} />
        <input
          autoFocus
          className={styles.inlineInput}
          value={value}
          placeholder="What needs doing? Enter adds it, Esc closes"
          aria-label={`New task in ${surface.columnOf(columnKey)?.name ?? "this group"}`}
          onChange={(event) => setValue(event.target.value)}
          onBlur={() => {
            if (!value.trim()) onDone();
          }}
          onKeyDown={(event) => {
            event.stopPropagation();
            if (event.key === "Enter" && !event.nativeEvent.isComposing) {
              event.preventDefault();
              if (!value.trim()) return onDone();
              surface.addInline(columnKey, value);
              setValue("");
            } else if (event.key === "Escape") {
              event.preventDefault();
              onDone();
            }
          }}
        />
      </span>
    </div>
  );
}
