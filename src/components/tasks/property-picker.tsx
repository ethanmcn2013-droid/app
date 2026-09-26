"use client";

/**
 * One picker for every task property: status, assignees, due date,
 * priority and labels. Opened by a letter key (S, A, D, P, L), a card chip,
 * a list cell, the task menu or the bulk bar. With several tasks selected it
 * applies the choice to each of them through the store's own dispatchers.
 */

import { useLabStore } from "@/components/hybrid/store";
import { useCalendarFrame } from "@/components/app/room/room-brief-context";
import { useWorkspaceMembers } from "@/lib/domain-context";
import { useLabelNames } from "./task-bits";
import { tagDisplayName } from "@/lib/tags";
import { addDays, startOfWeek } from "@/components/hybrid/dates";
import { PRIORITY_LABELS, TASK_PRIORITIES, type CalendarDate, type LabTask, type TaskPriority, type TaskSchedule } from "@/components/hybrid/types";
import { AvatarStack } from "@/components/app/presence/avatar-stack";
import { DueCalendar } from "@/components/app/detail-panel/due-calendar";
import { useSurface, type PickerKind } from "./surface";
import { PriorityIcon, StatusGlyph } from "./atoms";
import { PickerList, Popover } from "./ui";
import { TIcon } from "./icons";
import { shortDate } from "./time";
import styles from "./workspace.module.css";

const LABEL: Record<PickerKind, string> = {
  status: "Status",
  assignee: "Assignees",
  due: "Due date",
  priority: "Priority",
  labels: "Labels",
};

function isoFromLocal(date: Date): CalendarDate {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}` as CalendarDate;
}

export function PropertyPicker() {
  const surface = useSurface();
  const picker = surface.picker;
  return (
    <Popover
      open={Boolean(picker)}
      anchor={picker?.anchor ?? null}
      onClose={surface.closePicker}
      label={picker ? `${LABEL[picker.kind]}${picker.ids.length > 1 ? ` for ${picker.ids.length} tasks` : ""}` : "Picker"}
      width={picker?.kind === "due" ? 296 : 260}
    >
      {picker ? <PickerBody kind={picker.kind} ids={picker.ids} /> : null}
    </Popover>
  );
}

function PickerBody({ kind, ids }: { kind: PickerKind; ids: string[] }) {
  const surface = useSurface();
  const store = useLabStore();
  const calendar = useCalendarFrame();
  const members = useWorkspaceMembers();
  const tags = useLabelNames(surface.all);
  const tasks = ids.map((id) => surface.all.find((t) => t.id === id)).filter((t): t is LabTask => Boolean(t));
  const first = tasks[0];
  const close = surface.closePicker;
  const many = tasks.length > 1;

  const header = many ? <p className={styles.pickerHead}>{LABEL[kind]} for {tasks.length} tasks</p> : null;

  if (kind === "status") {
    return (
      <>
        {header}
        <PickerList
          placeholder="Move to…"
          options={surface.columns.map((column) => ({
            id: column.key,
            label: column.name,
            icon: <StatusGlyph column={column} size={14} />,
            selected: !many && first?.status === column.key,
          }))}
          onPick={(key) => {
            tasks.forEach((task) => surface.move(task.id, key));
            close();
          }}
        />
      </>
    );
  }

  if (kind === "assignee") {
    const shared = (id: string) => tasks.every((task) => task.assigneeIds.includes(id));
    return (
      <>
        {header}
        <PickerList
          multi
          placeholder="Find a person"
          empty="No one else is in this project yet. Invite someone from Settings, then assign the task to them."
          options={members.map((member) => ({
            id: member.id,
            label: member.name,
            icon: <AvatarStack members={[{ id: member.id, name: member.name, initials: member.initials }]} size="sm" max={1} label={member.name} />,
            hint: member.role === "owner" ? "Owner" : undefined,
            selected: shared(member.id),
          }))}
          onPick={(id) => {
            const adding = !shared(id);
            tasks.forEach((task) => {
              const next = adding ? [...new Set([...task.assigneeIds, id])] : task.assigneeIds.filter((x) => x !== id);
              store.updateAssignees(task.id, next);
            });
          }}
        />
      </>
    );
  }

  if (kind === "priority") {
    return (
      <>
        {header}
        <PickerList
          options={[...TASK_PRIORITIES].map((priority) => ({
            id: priority,
            label: PRIORITY_LABELS[priority],
            icon: <PriorityIcon priority={priority} />,
            selected: !many && first?.priority === priority,
          }))}
          onPick={(value) => {
            tasks.forEach((task) => store.updatePriority(task.id, value as TaskPriority));
            close();
          }}
        />
      </>
    );
  }

  if (kind === "labels") {
    const shared = (name: string) => tasks.every((task) => task.labelIds.includes(name));
    return (
      <>
        {header}
        <PickerList
          multi
          placeholder="Find a label"
          empty="No labels yet. Type #name in a new task's title to make one."
          options={tags.map((tag) => ({ id: tag, label: tagDisplayName(tag), selected: shared(tag) }))}
          onPick={(name) => {
            const adding = !shared(name);
            tasks.forEach((task) => {
              const next = adding ? [...new Set([...task.labelIds, name])] : task.labelIds.filter((x) => x !== name);
              store.updateTask(task.id, { labelIds: next }, "Labels updated");
            });
          }}
        />
      </>
    );
  }

  // Due date
  const today = calendar.today as CalendarDate;
  const nextMonday = addDays(startOfWeek(today), 7);
  const quick: { id: string; label: string; date: CalendarDate | null }[] = [
    { id: "today", label: "Today", date: today },
    { id: "tomorrow", label: "Tomorrow", date: addDays(today, 1) },
    { id: "monday", label: "Next Monday", date: nextMonday },
    { id: "week", label: "In a week", date: addDays(today, 7) },
    { id: "none", label: "No date", date: null },
  ];
  const apply = (date: CalendarDate | null) => {
    tasks.forEach((task) => {
      if (!date) store.unscheduleTask(task.id);
      else if (task.schedule.kind === "milestone") store.scheduleTask(task.id, { kind: "milestone", on: date } as TaskSchedule);
      else store.scheduleOn(task.id, date);
    });
    close();
  };
  const current = !many && first && first.schedule.kind !== "unscheduled"
    ? first.schedule.kind === "milestone" ? first.schedule.on : first.schedule.dueOn
    : null;
  return (
    <>
      {header}
      <div className={styles.dueQuick}>
        {quick.map((option) => (
          <button key={option.id} type="button" className={styles.dueQuickItem} onClick={() => apply(option.date)} data-autofocus={option.id === "today" ? "" : undefined}>
            {option.date ? <TIcon.calendar size={14} /> : <TIcon.noDate size={14} />}
            <span>{option.label}</span>
            {option.date ? <span className={styles.dueQuickHint}>{shortDate(option.date)}</span> : null}
          </button>
        ))}
      </div>
      <div className={styles.dueCalendar}>
        <DueCalendar
          today={new Date(`${today}T12:00:00`)}
          showQuickPicks={false}
          value={current ? new Date(`${current}T12:00:00`) : null}
          onSelect={(date) => apply(isoFromLocal(date))}
          onClear={() => apply(null)}
        />
      </div>
    </>
  );
}
