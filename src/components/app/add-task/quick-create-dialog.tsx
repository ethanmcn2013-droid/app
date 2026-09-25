"use client";

/**
 * NewTaskComposer: the one place a task is written from scratch.
 *
 * Opened by "New task", the C key, the shell's New menu or ?create=task. On
 * desktop it hangs under the New task button; on a phone it rises as a
 * bottom sheet. The title parses as you type ("Call florist Friday #venue"
 * shows "Due Fri" and "Venue"), each parsed chip can be removed, and the
 * pill row sets status, people, date, priority and labels before the task
 * exists. "!high" and "@orla" set priority and people the same way
 * (quick-tokens.ts), so a whole task can be written in one line.
 * Defaults come from the column whose "+" was pressed and from the active
 * filters.
 *
 * Creation runs through the same dispatcher as before
 * (useTasksDispatch().addTask), so it is optimistic, persisted and synced.
 * Enter creates; Cmd/Ctrl+Enter creates and opens the task; Escape closes,
 * asking first only when something has been written.
 */

import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { LANE_ORDER, type LaneId } from "@/lib/data";
import { useTasksDispatch, useTasksState } from "@/lib/tasks/tasks-context";
import { useTaskPanel } from "@/lib/tasks/use-task-panel";
import { useColumnConfig, useDomain, useTagDefs, useWorkspaceMembers } from "@/lib/domain-context";
import { resolveBoardColumns } from "@/lib/board-columns";
import { useToast } from "@/components/primitives/toast";
import { useCalendarFrame } from "@/components/app/room/room-brief-context";
import { parseTaskInput } from "@/lib/nlp/parse-task-input";
import { formatRecurrenceLabel, looksLikeUnsupportedRecurrence } from "@/lib/nlp/parse-recurrence";
import { tagDisplayName } from "@/lib/tags";
import { labToPriority } from "@/components/hybrid/adapter";
import { PRIORITY_LABELS, TASK_PRIORITIES, type TaskPriority } from "@/components/hybrid/types";
import { DueCalendar } from "@/components/app/detail-panel/due-calendar";
import { AvatarStack } from "@/components/app/presence/avatar-stack";
import { PriorityIcon, StatusGlyph, Kbd } from "@/components/tasks/atoms";
import { TIcon } from "@/components/tasks/icons";
import { PickerList, Popover } from "@/components/tasks/ui";
import { shortDate } from "@/components/tasks/time";
import { TASK_CREATED_EVENT, type TaskCreatedDetail } from "@/components/tasks/sheet-bridge";
import type { NewTaskDefaults } from "./add-task-context";
import { parseQuickTokens } from "./quick-tokens";
import styles from "./composer.module.css";

type Pill = "status" | "assignee" | "due" | "priority" | "labels" | null;

const WIDTH = 520;

/** The composer only renders on the client, so the platform is known. */
const MOD = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent) ? "⌘" : "Ctrl ";

function isoFromLocal(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function NewTaskComposer({
  open,
  defaults,
  onClose,
}: {
  open: boolean;
  defaults: NewTaskDefaults;
  onClose: () => void;
}) {
  if (!open) return null;
  return <Composer key={JSON.stringify({ ...defaults, anchor: null })} defaults={defaults} onClose={onClose} />;
}

function Composer({ defaults, onClose }: { defaults: NewTaskDefaults; onClose: () => void }) {
  const { addTask, moveTaskToColumn } = useTasksDispatch();
  const { openTask } = useTaskPanel();
  const { toast } = useToast();
  const pack = useDomain();
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
  const calendar = useCalendarFrame();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [showDetails, setShowDetails] = useState(false);
  const [columnKey, setColumnKey] = useState(() => (defaults.columnKey && columns.some((c) => c.key === defaults.columnKey) ? defaults.columnKey : columns[0]?.key ?? "todo"));
  const [assignees, setAssignees] = useState<string[]>(defaults.assigneeIds ?? []);
  const [dueOn, setDueOn] = useState<string | null>(defaults.dueOn ?? null);
  const [priority, setPriority] = useState<TaskPriority>(defaults.priority ?? "normal");
  const [labels, setLabels] = useState<string[]>(defaults.labelIds ?? []);
  const [ignored, setIgnored] = useState<{ date: boolean; recurrence: boolean; tags: string[]; priority: boolean; people: string[] }>({
    date: false,
    recurrence: false,
    tags: [],
    priority: false,
    people: [],
  });
  const [priorityPicked, setPriorityPicked] = useState(false);
  const [createMore, setCreateMore] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [pill, setPill] = useState<Pill>(null);
  const [pillAnchor, setPillAnchor] = useState<HTMLElement | null>(null);
  const [made, setMade] = useState(0);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const [place, setPlace] = useState<{ left: number; top: number } | null>(null);
  const [phone, setPhone] = useState(false);

  // "!high" and "@orla" first, then dates, repeats and #labels on the rest.
  const quick = useMemo(
    () => parseQuickTokens(title, members, { priority: ignored.priority, people: ignored.people }),
    [ignored.people, ignored.priority, members, title],
  );
  const parsed = useMemo(() => parseTaskInput(quick.title), [quick.title]);
  const parsedPriority = !priorityPicked && quick.priority ? quick.priority : null;
  const parsedPeople = quick.people.filter((person) => !assignees.includes(person.id));
  const effectivePriority: TaskPriority = parsedPriority?.value ?? priority;
  const effectiveAssignees = [...assignees, ...parsedPeople.map((person) => person.id)];
  const parsedTags = (parsed.tags ?? []).filter((tag) => !ignored.tags.includes(tag));
  const parsedDate = !ignored.date && parsed.dueAt && parsed.dueLabel ? parsed : null;
  const parsedRecurrence = !ignored.recurrence ? parsed.recurrence : undefined;
  const refusal = !parsed.recurrence && looksLikeUnsupportedRecurrence(title);
  // Removing a parsed chip keeps its words in the title.
  const cleanTitle = (ignored.date || ignored.recurrence ? quick.title.replace(/(^|\s)#[\w-]+/g, " ").replace(/\s+/g, " ").trim() : parsed.title).trim();
  const dirty = Boolean(title.trim() || description.trim());
  const column = columns.find((c) => c.key === columnKey) ?? columns[0];

  useLayoutEffect(() => {
    const placeIt = () => {
      const narrow = window.matchMedia("(max-width: 767px)").matches;
      setPhone(narrow);
      if (narrow) return;
      const anchor = defaults.anchor && defaults.anchor.isConnected ? defaults.anchor : null;
      if (!anchor) {
        setPlace({ left: Math.max(16, window.innerWidth / 2 - WIDTH / 2), top: Math.max(72, window.innerHeight * 0.14) });
        return;
      }
      const rect = anchor.getBoundingClientRect();
      const left = Math.max(16, Math.min(rect.right - WIDTH, window.innerWidth - WIDTH - 16));
      setPlace({ left, top: Math.min(rect.bottom + 8, window.innerHeight - 320) });
    };
    const frame = requestAnimationFrame(placeIt);
    window.addEventListener("resize", placeIt);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", placeIt);
    };
  }, [defaults.anchor]);

  useEffect(() => {
    const frame = requestAnimationFrame(() => inputRef.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, []);

  const requestClose = () => {
    if (dirty) setConfirming(true);
    else onClose();
  };

  const submit = (openAfter: boolean) => {
    const name = cleanTitle || title.trim();
    if (!name) return;
    const isLane = (LANE_ORDER as string[]).includes(columnKey);
    const lane: LaneId = isLane ? (columnKey as LaneId) : "doing";
    const date = dueOn ? new Date(`${dueOn}T09:00:00.000Z`) : parsedDate?.dueAt;
    const created = addTask({
      title: name,
      description: description.trim() || undefined,
      lane,
      priority: labToPriority(effectivePriority),
      assignees: effectiveAssignees,
      dueAt: date,
      due: dueOn ?? parsedDate?.dueLabel,
      tags: [...new Set([...labels, ...parsedTags])],
      recurrence: refusal ? undefined : parsedRecurrence,
    });
    if (!isLane) moveTaskToColumn(created.id, columnKey);
    const detail: TaskCreatedDetail = { id: created.id, title: name, columnKey, open: openAfter };
    window.dispatchEvent(new CustomEvent(TASK_CREATED_EVENT, { detail }));
    if (refusal) {
      toast("Task added without the repeat", {
        body: "That repeat phrasing isn't supported. Try “every Tuesday”, or set Repeats in the task.",
        tone: "info",
        duration: 5200,
      });
    }
    if (openAfter) {
      onClose();
      openTask(created.id);
      return;
    }
    if (createMore) {
      setTitle("");
      setDescription("");
      setIgnored({ date: false, recurrence: false, tags: [], priority: false, people: [] });
      setMade((count) => count + 1);
      inputRef.current?.focus();
      return;
    }
    onClose();
  };

  const openPill = (next: Pill, anchor: HTMLElement) => {
    setPill((current) => (current === next ? null : next));
    setPillAnchor(anchor);
  };

  const member = (id: string) => members.find((m) => m.id === id);
  const assigneeFaces = effectiveAssignees.map((id) => ({ id, name: member(id)?.name ?? "Someone", initials: member(id)?.initials }));
  const dueLabel = dueOn ? shortDate(dueOn) : parsedDate ? `${parsedDate.dueLabel}` : null;

  const panelStyle: CSSProperties | undefined = phone
    ? undefined
    : { width: WIDTH, left: place?.left ?? -9999, top: place?.top ?? -9999 };

  return createPortal(
    <>
      <div className={styles.backdrop} data-phone={phone ? "" : undefined} onPointerDown={requestClose} aria-hidden="true" />
      <div
        ref={panelRef}
        className={styles.panel}
        data-phone={phone ? "" : undefined}
        role="dialog"
        aria-modal="true"
        aria-label="New task"
        style={panelStyle}
        onKeyDown={(event) => {
          if (event.key === "Escape" && !pill) {
            event.preventDefault();
            event.stopPropagation();
            if (confirming) setConfirming(false);
            else requestClose();
          }
        }}
      >
        {phone ? <span className={styles.grabber} aria-hidden="true" /> : null}
        <div className={styles.top}>
          <span className={styles.where}>
            <StatusGlyph column={column} size={14} />
            New task in {column?.name ?? "To do"}
          </span>
          <span className={styles.project}>{pack.boardName || pack.workspaceTitle}</span>
        </div>
        <textarea
          ref={inputRef}
          id="quick-create-input"
          className={styles.title}
          rows={1}
          value={title}
          placeholder="What needs doing?"
          aria-label="Task name"
          aria-describedby="quick-create-hint"
          autoComplete="off"
          spellCheck
          onChange={(event) => {
            setTitle(event.target.value.replace(/\n/g, " "));
            setConfirming(false);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.nativeEvent.isComposing) {
              event.preventDefault();
              submit(event.metaKey || event.ctrlKey);
            }
          }}
        />
        {/* Once the title yields chips, the chips take the hint's place. */}
        <p id="quick-create-hint" className={styles.hint} hidden={Boolean(parsedDate || parsedRecurrence || parsedTags.length || parsedPriority || parsedPeople.length) && made === 0}>
          {made > 0 ? (
            `${made} added. Keep going, or press Escape when you are done.`
          ) : (
            <>Try “{pack.firstTaskExample}”. Type a day like Friday, @name for a person, !high for priority or #label, and they are picked up as you type.</>
          )}
        </p>

        {parsedDate || parsedRecurrence || parsedTags.length || parsedPriority || parsedPeople.length ? (
          <div className={styles.parsed} aria-label="Picked up from the title">
            {parsedPeople.map((person) => (
              <ParsedChip
                key={person.id}
                icon={<TIcon.person size={12} />}
                onRemove={() => setIgnored((v) => ({ ...v, people: [...v.people, person.id] }))}
                label={member(person.id)?.name ?? person.token}
              />
            ))}
            {parsedPriority ? (
              <ParsedChip
                icon={<PriorityIcon priority={parsedPriority.value} size={12} />}
                onRemove={() => setIgnored((v) => ({ ...v, priority: true }))}
                label={`${PRIORITY_LABELS[parsedPriority.value]} priority`}
              />
            ) : null}
            {parsedDate ? (
              <ParsedChip icon={<TIcon.calendar size={12} />} onRemove={() => setIgnored((v) => ({ ...v, date: true }))} label={`Due ${sentenceDay(parsedDate.dueLabel!)}`} />
            ) : null}
            {parsedRecurrence ? (
              <ParsedChip icon={<TIcon.undo size={12} />} onRemove={() => setIgnored((v) => ({ ...v, recurrence: true }))} label={`Repeats ${formatRecurrenceLabel(parsedRecurrence)}`} />
            ) : null}
            {parsedTags.map((tag) => (
              <ParsedChip key={tag} icon={<TIcon.tag size={12} />} onRemove={() => setIgnored((v) => ({ ...v, tags: [...v.tags, tag] }))} label={tagDisplayName(tag)} />
            ))}
          </div>
        ) : null}
        {refusal ? (
          <p className={styles.refusal}>That repeat phrasing isn&rsquo;t supported. Try &ldquo;every Tuesday&rdquo;, or set Repeats in the task.</p>
        ) : null}
        <span aria-live="polite" className={styles.srOnly} role="status">
          {[
            parsedPeople.length ? `For ${parsedPeople.map((person) => member(person.id)?.name ?? person.token).join(", ")}.` : "",
            parsedPriority ? `${PRIORITY_LABELS[parsedPriority.value]} priority.` : "",
            parsedDate ? `Due ${sentenceDay(parsedDate.dueLabel!)}.` : "",
            parsedRecurrence ? `Repeats ${formatRecurrenceLabel(parsedRecurrence)}.` : "",
            parsedTags.length ? `Labels: ${parsedTags.join(", ")}.` : "",
          ].join(" ")}
        </span>

        {showDetails ? (
          <textarea
            className={styles.details}
            value={description}
            rows={3}
            placeholder="Add a description"
            aria-label="Description"
            autoFocus
            onChange={(event) => setDescription(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
                event.preventDefault();
                submit(true);
              }
            }}
          />
        ) : null}

        <div className={styles.pills}>
          <button type="button" className={styles.pill} aria-haspopup="dialog" aria-expanded={pill === "status"} onClick={(event) => openPill("status", event.currentTarget)}>
            <StatusGlyph column={column} size={14} />
            {column?.name ?? "To do"}
          </button>
          <button type="button" className={styles.pill} data-set={effectiveAssignees.length ? "" : undefined} aria-haspopup="dialog" aria-expanded={pill === "assignee"} onClick={(event) => openPill("assignee", event.currentTarget)}>
            {effectiveAssignees.length ? <AvatarStack members={assigneeFaces} size="sm" max={2} label={`Assigned to ${assigneeFaces.map((f) => f.name).join(", ")}`} /> : <TIcon.person size={14} />}
            {effectiveAssignees.length === 1 ? member(effectiveAssignees[0])?.name ?? "Someone" : effectiveAssignees.length > 1 ? `${effectiveAssignees.length} people` : "Assignee"}
          </button>
          <button type="button" className={styles.pill} data-set={dueLabel ? "" : undefined} aria-haspopup="dialog" aria-expanded={pill === "due"} onClick={(event) => openPill("due", event.currentTarget)}>
            <TIcon.calendar size={14} />
            {dueLabel ?? "Due date"}
          </button>
          <button type="button" className={styles.pill} data-set={effectivePriority !== "normal" ? "" : undefined} aria-haspopup="dialog" aria-expanded={pill === "priority"} onClick={(event) => openPill("priority", event.currentTarget)}>
            <PriorityIcon priority={effectivePriority} />
            {effectivePriority === "normal" ? "Priority" : PRIORITY_LABELS[effectivePriority]}
          </button>
          <button type="button" className={styles.pill} data-set={labels.length ? "" : undefined} aria-haspopup="dialog" aria-expanded={pill === "labels"} onClick={(event) => openPill("labels", event.currentTarget)}>
            <TIcon.tag size={14} />
            {labels.length === 1 ? tagDisplayName(labels[0]) : labels.length > 1 ? `${labels.length} labels` : "Labels"}
          </button>
          {!showDetails ? (
            <button type="button" className={styles.pill} data-quiet="" onClick={() => setShowDetails(true)}>
              <TIcon.pencil size={14} />
              Add details
            </button>
          ) : null}
        </div>

        {confirming ? (
          <div className={styles.confirm} role="alert">
            <span>Discard this task?</span>
            <button type="button" className={styles.ghost} onClick={() => { setConfirming(false); inputRef.current?.focus(); }}>Keep writing</button>
            <button type="button" className={styles.danger} onClick={onClose} autoFocus>Discard</button>
          </div>
        ) : (
          <div className={styles.footer}>
            <label className={styles.more}>
              <input type="checkbox" checked={createMore} onChange={(event) => setCreateMore(event.target.checked)} />
              <span className={styles.switch} aria-hidden="true" />
              Create more
            </label>
            <span className={styles.footerHint}>
              <Kbd>{MOD}↵</Kbd> create and open
            </span>
            <button type="button" className={styles.cancel} onClick={requestClose}>Cancel</button>
            <button type="button" className={styles.create} disabled={!(cleanTitle || title.trim())} onClick={() => submit(false)}>
              Create task
              <Kbd>↵</Kbd>
            </button>
          </div>
        )}
      </div>

      <Popover open={pill === "status"} anchor={pillAnchor} onClose={() => setPill(null)} label="Status" width={240}>
        <PickerList
          options={columns.map((c) => ({ id: c.key, label: c.name, icon: <StatusGlyph column={c} size={14} />, selected: c.key === columnKey }))}
          onPick={(id) => { setColumnKey(id); setPill(null); }}
        />
      </Popover>
      <Popover open={pill === "assignee"} anchor={pillAnchor} onClose={() => setPill(null)} label="Assignee" width={260}>
        <PickerList
          multi
          placeholder="Find a person"
          empty="No one else is in this project yet. Invite someone from Settings."
          options={members.map((m) => ({ id: m.id, label: m.name, icon: <AvatarStack members={[{ id: m.id, name: m.name, initials: m.initials }]} size="sm" max={1} label={m.name} />, selected: effectiveAssignees.includes(m.id) }))}
          onPick={(id) => {
            // Unpicking someone named with @ gives their @name back to the title.
            if (parsedPeople.some((person) => person.id === id)) {
              setIgnored((v) => ({ ...v, people: [...v.people, id] }));
              return;
            }
            setAssignees((current) => (current.includes(id) ? current.filter((x) => x !== id) : [...current, id]));
          }}
        />
      </Popover>
      <Popover open={pill === "due"} anchor={pillAnchor} onClose={() => setPill(null)} label="Due date" width={300}>
        <div className={styles.duePanel}>
          <DueCalendar
            today={new Date(`${calendar.today}T12:00:00`)}
            value={dueOn ? new Date(`${dueOn}T12:00:00`) : parsedDate?.dueAt ?? null}
            onSelect={(date) => { setDueOn(isoFromLocal(date)); setIgnored((v) => ({ ...v, date: true })); setPill(null); }}
            onClear={() => { setDueOn(null); setIgnored((v) => ({ ...v, date: true })); setPill(null); }}
          />
        </div>
      </Popover>
      <Popover open={pill === "priority"} anchor={pillAnchor} onClose={() => setPill(null)} label="Priority" width={220}>
        <PickerList
          options={[...TASK_PRIORITIES].map((p) => ({ id: p, label: PRIORITY_LABELS[p], icon: <PriorityIcon priority={p} />, selected: p === effectivePriority }))}
          onPick={(id) => {
            // A picked priority wins; a typed one gives its words back.
            if (parsedPriority) setIgnored((v) => ({ ...v, priority: true }));
            setPriority(id as TaskPriority);
            setPriorityPicked(true);
            setPill(null);
          }}
        />
      </Popover>
      <Popover open={pill === "labels"} anchor={pillAnchor} onClose={() => setPill(null)} label="Labels" width={260}>
        <PickerList
          multi
          placeholder="Find a label"
          empty="No labels yet. Type #name in the title to make one."
          options={tags.map((tag) => ({ id: tag.name, label: tagDisplayName(tag.name), selected: labels.includes(tag.name) }))}
          onPick={(id) => setLabels((current) => (current.includes(id) ? current.filter((x) => x !== id) : [...current, id]))}
        />
      </Popover>
    </>,
    document.body,
  );
}

function ParsedChip({ icon, label, onRemove }: { icon: React.ReactNode; label: string; onRemove: () => void }) {
  return (
    <span className={styles.parsedChip}>
      {icon}
      {label}
      <button type="button" className={styles.parsedRemove} aria-label={`Remove ${label}`} onClick={onRemove}>
        <TIcon.close size={10} />
      </button>
    </span>
  );
}

/** "Today" and "Tomorrow" read mid-sentence in lower case: "Due today". */
function sentenceDay(label: string): string {
  return /^(Today|Tomorrow|Tonight)\b/.test(label) ? label.charAt(0).toLowerCase() + label.slice(1) : label;
}
