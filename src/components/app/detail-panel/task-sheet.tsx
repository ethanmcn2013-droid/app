"use client";

/**
 * TaskSheet: one task, read and edited in place.
 *
 * Three framings share one body:
 * - docked: at 1280px and wider the sheet sits beside the board with no
 *   backdrop, so the board stays visible and usable next to the task;
 * - modal: below 1280px it slides over a scrim and traps focus;
 * - page: /app/task/[id] lays the same sections out in two columns.
 *
 * The header walks the current view's visible order (up, down, j, k), E
 * opens the full page, and Escape closes. Properties are rows you can press;
 * description, subtasks, files and links and activity follow.
 */

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { Task } from "@/lib/data";
import { useTasksDispatch, useTasksState } from "@/lib/tasks/tasks-context";
import { useColumnConfig, useDomain, useTagDefs, useWorkspaceAnchor, useWorkspaceMembers } from "@/lib/domain-context";
import { effectiveColumnKey, isTaskDone, resolveBoardColumns } from "@/lib/board-columns";
import { useCalendarFrame } from "@/components/app/room/room-brief-context";
import { tagDisplayName } from "@/lib/tags";
import { hasOpenLayer } from "@/components/primitives/open-layer";
import { ActionsDropdown } from "@/components/primitives/context-actions";
import { AvatarStack } from "@/components/app/presence/avatar-stack";
import { priorityToLab, labToPriority } from "@/components/hybrid/adapter";
import { PRIORITY_LABELS, TASK_PRIORITIES, type TaskPriority } from "@/components/hybrid/types";
import { StatusGlyph, PriorityIcon } from "@/components/tasks/atoms";
import { TIcon } from "@/components/tasks/icons";
import { PickerList, Popover } from "@/components/tasks/ui";
import { SheetSkeleton } from "@/components/tasks/skeletons";
import { dayLabel, shortDate } from "@/components/tasks/time";
import { buildTaskDetailActions } from "@/components/app/task-detail/task-detail-actions";
import { ExistingTaskHistory } from "@/components/app/task-detail/existing-task-history";
import { calendarDateInTimeZone } from "@/lib/planning/dates";
import { EditedStamp } from "./panel-header";
import sx from "./sheet-sections.module.css";
import { DescriptionEditor } from "./description-editor";
import { SubtasksSection } from "./subtasks-section";
import { ResourcesSection } from "./resources-section";
import { ConversationFeed } from "./conversation-feed";
import { RecurrenceRow } from "./field-rows";
import { CentsEditor } from "./cents-editor";
import { ContactEditor } from "./contact-editor";
import { RepeatButton } from "./repeat-button";
import { DueCalendar } from "./due-calendar";
import { useTaskConversation } from "./use-task-conversation";
import styles from "./task-sheet.module.css";

export type SheetMode = "docked" | "modal" | "page";

export type TaskSheetProps = {
  task: Task;
  mode: SheetMode;
  onClose: () => void;
  onNavigate?: (direction: "prev" | "next") => void;
  /** Absent when the layout is fixed (the wide two-column task view). */
  onExpand?: () => void;
  /** "3 of 13" in the current view, when known. */
  position?: string | null;
  /** The page layout shown over the app (expanded from the sheet) keeps a close button. */
  overlay?: boolean;
};

function isoFromLocal(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function TaskSheet({ task, mode, onClose, onNavigate, onExpand, position, overlay = false }: TaskSheetProps) {
  const dispatchers = useTasksDispatch();
  const columnConfig = useColumnConfig();
  const done = isTaskDone(task, columnConfig);
  const conversation = useTaskConversation(task);
  const rootRef = useRef<HTMLDivElement | null>(null);

  // Keys inside the sheet: walk the view's order, open the full page, close.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      const inside = rootRef.current?.contains(target) || target === document.body;
      if (!inside) return;
      if (target.matches("input, textarea, select, [contenteditable], [contenteditable='true']")) return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (hasOpenLayer(rootRef.current)) return;
      if ((event.key === "j" || event.key === "ArrowDown") && onNavigate) {
        event.preventDefault();
        onNavigate("next");
      } else if ((event.key === "k" || event.key === "ArrowUp") && onNavigate) {
        event.preventDefault();
        onNavigate("prev");
      } else if (event.key === "e" && onExpand && (mode !== "page" || overlay)) {
        event.preventDefault();
        onExpand?.();
      } else if (event.key === "Escape" && mode === "page") {
        event.preventDefault();
        onClose();
      }
    };
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [mode, onClose, onExpand, onNavigate, overlay]);

  const [activityOpen, setActivityOpen] = useState(true);

  const actions = buildTaskDetailActions(task, {
    dispatchers,
    isFocus: mode === "page",
    onOpenFocus: onExpand ?? (() => {}),
    onClosePanel: onClose,
    columnConfig,
  });

  const header = (
    <SheetHeader
      task={task}
      mode={mode}
      activityOpen={mode === "page" ? activityOpen : undefined}
      onToggleActivity={mode === "page" ? () => setActivityOpen((open) => !open) : undefined}
      position={position}
      overlay={overlay}
      onClose={onClose}
      onNavigate={onNavigate}
      onExpand={onExpand}
      menu={
        <ActionsDropdown
          items={actions}
          triggerLabel="More actions"
          triggerClassName={styles.headButton}
          trigger={<TIcon.more size={16} />}
        />
      }
    />
  );

  const title = (
    <div className={styles.titleBlock}>
      <TitleEditor task={task} />
      <button
        type="button"
        className={styles.doneButton}
        data-done={done ? "" : undefined}
        aria-keyshortcuts="Control+Enter Meta+Enter"
        onClick={() => dispatchers.toggleComplete(task.id)}
      >
        {done ? <TIcon.undo size={14} /> : <TIcon.check size={14} />}
        {done ? "Reopen" : "Mark done"}
      </button>
    </div>
  );

  const main = (
    <>
      <section className={styles.section} aria-label="Description">
        <DescriptionEditor key={task.id} task={task} />
      </section>
      <div className={styles.legacySection}>
        <SubtasksSection key={`subtasks-${task.id}`} task={task} />
      </div>
      <div className={styles.legacySection}>
        <ResourcesSection key={`resources-${task.id}`} task={task} />
      </div>
    </>
  );

  const activity = (
      <section className={`${sx.section} ${styles.activity}`} aria-labelledby={`activity-${task.id}`}>
        <div className={sx.head}>
          <h2 className={sx.title} id={`activity-${task.id}`}>Activity</h2>
        </div>
        {conversation.loading ? (
          <div className={styles.activitySkeleton} aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
        ) : conversation.timedOut ? (
          <p className={sx.quiet} role="status">
            Comments are taking a while to load.
            <button type="button" className={sx.noteAction} onClick={conversation.retry}>Try again</button>
          </p>
        ) : conversation.surface?.mode === "discussion" ? (
          <ConversationFeed key={task.id} taskId={task.id} initialDiscussion={conversation.surface.discussion} />
        ) : conversation.surface?.mode === "existing_history" ? (
          <ExistingTaskHistory history={conversation.surface.history} />
        ) : (
          <>
            <p className={sx.quiet} role="status">
              Comments aren&rsquo;t available right now.
              <button type="button" className={sx.noteAction} onClick={conversation.retry}>Try again</button>
            </p>
            {mode === "page" ? (
              <div className={styles.commentBox} data-comment-composer="" data-unavailable="">
                <textarea disabled rows={2} placeholder="Write a comment…" aria-label="Write a comment (comments are unavailable right now)" />
              </div>
            ) : null}
          </>
        )}
      </section>
  );

  // Two columns, ClickUp-style: the task (title, properties in a grid,
  // description, subtasks, files) scrolls on the left, and Activity owns the
  // full height on the right with its comment box pinned to the bottom.
  if (mode === "page") {
    return (
      <div className={styles.page} ref={rootRef} role={overlay ? undefined : "main"} aria-label={`Task: ${task.title}`}>
        {header}
        <div className={styles.split} data-activity={activityOpen ? "" : undefined}>
          <div className={styles.splitMain}>
            <div className={styles.splitInner}>
              <div className={styles.kindRow}>
                <span className={styles.kindChip}><span className={styles.kindDot} aria-hidden="true" />Task</span>
              </div>
              {title}
              <Properties task={task} grid />
              <div className={styles.divider} />
              {main}
            </div>
          </div>
          {activityOpen ? (
            <aside className={styles.activityColumn} aria-label="Activity">
              {activity}
            </aside>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div className={styles.sheet} data-mode={mode} ref={rootRef}>
      {header}
      <div className={styles.scroll}>
        {title}
        <Properties task={task} />
        <div className={styles.divider} />
        {main}
        {activity}
      </div>
    </div>
  );
}

/* ── Header ───────────────────────────────────────────────────────── */

function SheetHeader({
  task,
  mode,
  position,
  overlay,
  onClose,
  onNavigate,
  onExpand,
  menu,
  activityOpen,
  onToggleActivity,
}: {
  activityOpen?: boolean;
  onToggleActivity?: () => void;
  task: Task;
  mode: SheetMode;
  position?: string | null;
  onClose: () => void;
  onNavigate?: (direction: "prev" | "next") => void;
  onExpand?: () => void;
  menu: ReactNode;
  overlay?: boolean;
}) {
  const { boardName, workspaceName } = useDomain();
  const columnConfig = useColumnConfig();
  const columns = useMemo(() => resolveBoardColumns(columnConfig), [columnConfig]);
  const column = columns.find((c) => c.key === effectiveColumnKey(task));
  const project = (workspaceName?.trim() || boardName || "Project").trim();
  const number = typeof task.seq === "number" ? `T-${task.seq}` : null;
  return (
    <header className={styles.head}>
      {mode === "page" && onNavigate ? (
        <div className={styles.headNav}>
          <button type="button" className={styles.headButton} aria-label="Previous task (K)" title="Previous task (K)" onClick={() => onNavigate("prev")}>
            <TIcon.chevronUp size={16} />
          </button>
          <button type="button" className={styles.headButton} aria-label="Next task (J)" title="Next task (J)" onClick={() => onNavigate("next")}>
            <TIcon.chevronDown size={16} />
          </button>
        </div>
      ) : null}
      <nav className={styles.crumbs} aria-label="Where this task lives">
        <span className={styles.crumbProject} title={project}>{project}</span>
        <TIcon.chevronRight size={12} />
        <span className={styles.crumbStatus}>
          <StatusGlyph column={column} size={12} />
          {column?.name}
        </span>
        {number ? (
          <>
            <TIcon.chevronRight size={12} />
            <span className={styles.crumbNumber}>{number}</span>
          </>
        ) : null}
        {mode === "page" ? null : (
          <span className={styles.stamp}>
            <EditedStamp updatedAt={task.updatedAt} />
          </span>
        )}
      </nav>
      <div className={styles.headActions}>
        {mode === "page" ? (
          <span className={styles.stamp}>
            <EditedStamp updatedAt={task.updatedAt} />
          </span>
        ) : null}
        {onNavigate && mode !== "page" ? (
          <>
            {position ? <span className={styles.position}>{position}</span> : null}
            <button type="button" className={styles.headButton} aria-label="Previous task (K)" title="Previous task (K)" onClick={() => onNavigate("prev")}>
              <TIcon.chevronUp size={16} />
            </button>
            <button type="button" className={styles.headButton} aria-label="Next task (J)" title="Next task (J)" onClick={() => onNavigate("next")}>
              <TIcon.chevronDown size={16} />
            </button>
          </>
        ) : null}
        {onExpand ? (
          <button
            type="button"
            className={styles.headButton}
            aria-label={mode === "page" ? "Back to the board (E)" : "Open full page (E)"}
            title={mode === "page" ? "Back to the board" : "Open full page (E)"}
            onClick={onExpand}
          >
            {mode === "page" ? <TIcon.collapse size={16} /> : <TIcon.expand size={16} />}
          </button>
        ) : null}
        {menu}
        {onToggleActivity ? (
          <button
            type="button"
            className={styles.headButton}
            aria-label={activityOpen ? "Hide activity" : "Show activity"}
            aria-pressed={Boolean(activityOpen)}
            title={activityOpen ? "Hide activity" : "Show activity"}
            onClick={onToggleActivity}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><rect x="2" y="2.75" width="12" height="10.5" rx="2" /><path d="M9.75 2.75v10.5" /></svg>
          </button>
        ) : null}
        {mode === "page" && !overlay ? null : (
          <button type="button" className={styles.headButton} aria-label="Close" title="Close (Esc)" onClick={onClose}>
            <TIcon.close size={16} />
          </button>
        )}
      </div>
    </header>
  );
}

/* ── Title ────────────────────────────────────────────────────────── */

function TitleEditor({ task }: { task: Task }) {
  const { updateTask } = useTasksDispatch();
  const [draft, setDraft] = useState(task.title);
  const [prev, setPrev] = useState(task.title);
  if (prev !== task.title) {
    setPrev(task.title);
    setDraft(task.title);
  }
  const commit = () => {
    const clean = draft.trim();
    if (!clean) {
      setDraft(task.title);
      return;
    }
    if (clean !== task.title) updateTask(task.id, { title: clean });
  };
  return (
    <textarea
      id="task-panel-title"
      className={styles.title}
      rows={1}
      value={draft}
      aria-label="Task title"
      placeholder="Untitled task"
      onChange={(event) => setDraft(event.target.value.replace(/\n/g, " "))}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          event.currentTarget.blur();
        }
        if (event.key === "Escape") {
          event.stopPropagation();
          setDraft(task.title);
          event.currentTarget.blur();
        }
      }}
    />
  );
}

/* ── Properties ───────────────────────────────────────────────────── */

type Picker = "status" | "assignee" | "due" | "priority" | "labels" | null;

const ROW_ICONS: Record<string, (props: { size?: number }) => ReactNode> = {
  Status: (props) => <TIcon.check {...props} />,
  Assignees: (props) => <TIcon.person {...props} />,
  "Due date": (props) => <TIcon.calendar {...props} />,
  Priority: (props) => <TIcon.flag {...props} />,
  Labels: (props) => <TIcon.tag {...props} />,
  Contact: (props) => <TIcon.person {...props} />,
  Amount: (props) => <TIcon.diamond {...props} />,
};

function Row({ label, children }: { label: string; children: ReactNode }) {
  const Icon = ROW_ICONS[label];
  return (
    <div className={styles.row}>
      <dt className={styles.rowLabel}>{Icon ? <span className={styles.rowIcon} aria-hidden="true"><Icon size={14} /></span> : null}{label}</dt>
      <dd className={styles.rowValue}>{children}</dd>
    </div>
  );
}

function Properties({ task, grid = false }: { task: Task; grid?: boolean }) {
  const dispatchers = useTasksDispatch();
  const columnConfig = useColumnConfig();
  const columns = useMemo(() => resolveBoardColumns(columnConfig), [columnConfig]);
  const members = useWorkspaceMembers();
  const tagDefs = useTagDefs();
  const { tasks: projectTasks } = useTasksState();
  // Saved label definitions plus any label already on a task.
  const tags = useMemo(() => {
    const names = new Set(tagDefs.map((tag) => tag.name));
    for (const item of projectTasks) for (const tag of item.tags ?? []) names.add(tag);
    return [...names].sort((a, b) => a.localeCompare(b, "en-GB")).map((name) => ({ name }));
  }, [projectTasks, tagDefs]);
  const anchor = useWorkspaceAnchor();
  const calendar = useCalendarFrame();
  const [picker, setPicker] = useState<Picker>(null);
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const [revealed, setRevealed] = useState({ amount: false, contact: false, copies: false });
  const open = (kind: Picker) => (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
    setPicker((current) => (current === kind ? null : kind));
  };
  const close = useCallback(() => setPicker(null), []);

  const key = effectiveColumnKey(task);
  const column = columns.find((c) => c.key === key);
  const columnIndex = columns.findIndex((c) => c.key === key);
  const nextColumn = columnIndex >= 0 && columnIndex < columns.length - 1 ? columns[columnIndex + 1] : null;
  const isDone = isTaskDone(task, columnConfig);
  const assigned = task.assignees ?? [];
  const faces = assigned.map((id) => {
    const member = members.find((m) => m.id === id);
    return { id, name: member?.name ?? "Someone", initials: member?.initials };
  });
  const priority = priorityToLab(task.priority);
  const dueIso = task.dueAt ? calendarDateInTimeZone(task.dueAt, calendar.timeZone) : null;
  const overdue = dueIso && !isTaskDone(task, columnConfig) && dueIso < calendar.today;
  const labels = task.tags ?? [];
  const hasAmount = (task.cents ?? 0) > 0;
  const hasContact = Boolean(task.externalContactName?.trim() || task.externalContactEmail?.trim());
  const showAmount = hasAmount || revealed.amount;
  const showContact = hasContact || revealed.contact;

  const setDue = (iso: string | null) => {
    if (!iso) dispatchers.updateTask(task.id, { dueAt: null as unknown as undefined, due: undefined });
    else dispatchers.updateTask(task.id, { dueAt: new Date(`${iso}T09:00:00.000Z`), due: iso });
    close();
  };

  return (
    <>
      <dl className={styles.props} data-grid={grid ? "" : undefined}>
        <Row label="Status">
          {grid ? (
            <span className={styles.statusControl}>
              <button type="button" className={styles.statusPill} onClick={open("status")} aria-haspopup="dialog" aria-expanded={picker === "status"} aria-label={`Status: ${column?.name ?? "To do"}. Change status`}>
                <StatusGlyph column={column} size={12} />
                {column?.name ?? "To do"}
              </button>
              {nextColumn ? (
                <button type="button" className={styles.statusStep} onClick={() => dispatchers.moveTaskToColumn(task.id, nextColumn.key)} aria-label={`Move to ${nextColumn.name}`} title={`Move to ${nextColumn.name}`}>
                  <TIcon.chevronRight size={12} />
                </button>
              ) : null}
              <button type="button" className={styles.statusDone} data-done={isDone ? "" : undefined} onClick={() => dispatchers.toggleComplete(task.id)} aria-label={isDone ? "Reopen" : "Mark done"} title={isDone ? "Reopen" : "Mark done"}>
                <TIcon.check size={14} />
              </button>
            </span>
          ) : (
            <button type="button" className={styles.value} onClick={open("status")} aria-haspopup="dialog" aria-expanded={picker === "status"}>
              <StatusGlyph column={column} size={14} />
              {column?.name ?? "To do"}
            </button>
          )}
        </Row>
        <Row label="Assignees">
          <button type="button" className={styles.value} onClick={open("assignee")} aria-haspopup="dialog" aria-expanded={picker === "assignee"}>
            {faces.length ? (
              <>
                <AvatarStack members={faces} size="sm" max={3} label={`Assigned to ${faces.map((f) => f.name).join(", ")}`} />
                <span>{faces.length === 1 ? faces[0].name : `${faces.length} people`}</span>
              </>
            ) : (
              <span className={styles.empty}>{grid ? "Empty" : "No one yet"}</span>
            )}
          </button>
        </Row>
        <Row label="Due date">
          <span className={styles.valueGroup}>
            <button type="button" className={styles.value} data-overdue={overdue ? "" : undefined} onClick={open("due")} aria-haspopup="dialog" aria-expanded={picker === "due"}>
              {task.isMilestone ? <TIcon.diamond size={14} /> : <TIcon.calendar size={14} />}
              {dueIso ? `${dayLabel(dueIso, calendar.today)}${dayLabel(dueIso, calendar.today) === shortDate(dueIso) ? "" : `, ${shortDate(dueIso)}`}` : <span className={styles.empty}>{grid ? "Empty" : "No date"}</span>}
            </button>
            <span className={styles.repeat}>
              <RecurrenceRow task={task} />
            </span>
          </span>
        </Row>
        <Row label="Priority">
          <button type="button" className={styles.value} onClick={open("priority")} aria-haspopup="dialog" aria-expanded={picker === "priority"}>
            <PriorityIcon priority={priority} />
            {PRIORITY_LABELS[priority]}
          </button>
        </Row>
        <Row label="Labels">
          <button type="button" className={styles.value} onClick={open("labels")} aria-haspopup="dialog" aria-expanded={picker === "labels"}>
            {labels.length ? (
              <span className={styles.labelList}>
                {labels.map((tag) => (
                  <span key={tag} className={styles.labelChip}>{tagDisplayName(tag)}</span>
                ))}
              </span>
            ) : (
              <span className={styles.empty}>{grid ? "Empty" : "None"}</span>
            )}
          </button>
        </Row>
        {task.blockedBy && task.blockedBy.length ? (
          <Row label="Held up by">
            <span className={styles.blocked}>
              <TIcon.blocked size={14} />
              {task.blockedBy.length} {task.blockedBy.length === 1 ? "task" : "tasks"}
            </span>
          </Row>
        ) : null}
        {showAmount ? (
          <Row label="Amount">
            <CentsEditor key={task.id} task={task} />
          </Row>
        ) : null}
        {showContact ? (
          <Row label="Contact">
            <ContactEditor key={task.id} task={task} />
          </Row>
        ) : null}
        {revealed.copies ? (
          <Row label="Copies">
            <RepeatButton task={task} />
          </Row>
        ) : null}
      </dl>
      <div className={styles.adders} data-list={grid ? "" : undefined}>
        {showAmount ? null : (
          <button type="button" className={styles.adder} onClick={() => setRevealed((r) => ({ ...r, amount: true }))}>
            {grid ? <><TIcon.pencil size={14} /> Add an amount</> : <><TIcon.plus size={12} /> Amount</>}
          </button>
        )}
        {showContact ? null : (
          <button type="button" className={styles.adder} onClick={() => setRevealed((r) => ({ ...r, contact: true }))}>
            {grid ? <><TIcon.person size={14} /> Add a contact</> : <><TIcon.plus size={12} /> Contact</>}
          </button>
        )}
        <button
          type="button"
          className={styles.adder}
          aria-pressed={Boolean(task.isMilestone)}
          onClick={() => dispatchers.setMilestone(task.id, !task.isMilestone)}
        >
          <TIcon.diamond size={grid ? 14 : 12} /> {task.isMilestone ? "Milestone" : "Make it a milestone"}
        </button>
        {revealed.copies ? null : (
          <button type="button" className={styles.adder} onClick={() => setRevealed((r) => ({ ...r, copies: true }))}>
            <TIcon.duplicate size={grid ? 14 : 12} /> Make copies
          </button>
        )}
      </div>

      <Popover open={picker === "status"} anchor={anchorEl} onClose={close} label="Status" width={240}>
        <PickerList
          options={columns.map((c) => ({ id: c.key, label: c.name, icon: <StatusGlyph column={c} size={14} />, selected: c.key === key }))}
          onPick={(next) => {
            if (next !== key) dispatchers.moveTaskToColumn(task.id, next);
            close();
          }}
        />
      </Popover>
      <Popover open={picker === "assignee"} anchor={anchorEl} onClose={close} label="Assignees" width={260}>
        <PickerList
          multi
          placeholder="Find a person"
          empty="No one else is in this project yet. Invite someone from Settings, then assign the task to them."
          options={members.map((m) => ({
            id: m.id,
            label: m.name,
            icon: <AvatarStack members={[{ id: m.id, name: m.name, initials: m.initials }]} size="sm" max={1} label={m.name} />,
            selected: assigned.includes(m.id),
          }))}
          onPick={(id) => dispatchers.updateTask(task.id, { assignees: assigned.includes(id) ? assigned.filter((x) => x !== id) : [...assigned, id] })}
        />
      </Popover>
      <Popover open={picker === "due"} anchor={anchorEl} onClose={close} label="Due date" width={296}>
        <div className={styles.duePicker}>
          <DueCalendar
            today={new Date(`${calendar.today}T12:00:00`)}
            value={task.dueAt ?? null}
            anchorDate={anchor.date}
            anchorNote={anchor.date && anchor.label ? `${anchor.label}: ${shortDate(anchor.date)}` : null}
            onSelect={(date) => setDue(isoFromLocal(date))}
            onClear={() => setDue(null)}
          />
        </div>
      </Popover>
      <Popover open={picker === "priority"} anchor={anchorEl} onClose={close} label="Priority" width={220}>
        <PickerList
          options={[...TASK_PRIORITIES].map((p) => ({ id: p, label: PRIORITY_LABELS[p], icon: <PriorityIcon priority={p} />, selected: p === priority }))}
          onPick={(p) => {
            dispatchers.updateTask(task.id, { priority: labToPriority(p as TaskPriority) });
            close();
          }}
        />
      </Popover>
      <Popover open={picker === "labels"} anchor={anchorEl} onClose={close} label="Labels" width={260}>
        <PickerList
          multi
          placeholder="Find a label"
          empty="No labels yet. Type #name in a new task's title to make one."
          options={tags.map((tag) => ({ id: tag.name, label: tagDisplayName(tag.name), selected: labels.includes(tag.name) }))}
          onPick={(name) => dispatchers.updateTask(task.id, { tags: labels.includes(name) ? labels.filter((x) => x !== name) : [...labels, name] })}
        />
      </Popover>
    </>
  );
}

/* ── States ───────────────────────────────────────────────────────── */

export function StaleTask({ onClose }: { onClose: () => void }) {
  return (
    <div className={styles.stale} role="status">
      <span className={styles.staleIcon} aria-hidden="true"><TIcon.alert size={18} /></span>
      <h2 className={styles.staleTitle}>This task was deleted or moved to another project.</h2>
      <p className={styles.staleBody}>If someone moved it, it is in that project&rsquo;s tasks now.</p>
      <button type="button" className={styles.staleButton} onClick={onClose} autoFocus>
        Close
      </button>
    </div>
  );
}

export function SheetLoading() {
  return <SheetSkeleton />;
}
