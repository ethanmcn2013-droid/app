"use client";

/**
 * The visible task list: the store's tasks filtered and ordered by the room
 * tools (search, facts, Filter menu). Board, List and Calendar all render
 * this list, so a filter reads the same in every view and a saved view
 * captures exactly what is on screen. Counts in the header keep reading the
 * whole project, so progress never quietly shrinks to a filtered subset.
 */

import { useMemo } from "react";
import { useRoomTools, type RoomDueFilter, type RoomSortMode } from "@/components/app/room/room-tools-context";
import { useCalendarFrame } from "@/components/app/room/room-brief-context";
import { priorityToLab } from "@/components/hybrid/adapter";
import { addDays, compareDates, isTaskDueToday, isTaskOverdue, scheduleEnd } from "@/components/hybrid/dates";
import type { CalendarDate, LabTask, TaskPriority } from "@/components/hybrid/types";

export function matchesQuery(task: LabTask, query: string): boolean {
  const q = query.trim().toLocaleLowerCase("en-GB");
  if (!q) return true;
  return task.title.toLocaleLowerCase("en-GB").includes(q) || task.description.toLocaleLowerCase("en-GB").includes(q);
}

export function matchesDue(task: LabTask, due: RoomDueFilter, today: CalendarDate): boolean {
  switch (due) {
    case "all":
      return true;
    case "overdue":
      return isTaskOverdue(task, today);
    case "today":
      return isTaskDueToday(task, today);
    case "week": {
      const end = scheduleEnd(task.schedule);
      return end !== null && compareDates(end, today) >= 0 && compareDates(end, addDays(today, 6)) <= 0;
    }
    case "unscheduled":
      return task.schedule.kind === "unscheduled" && !task.completed;
  }
}

const PRIORITY_RANK: Record<TaskPriority, number> = { urgent: 0, high: 1, normal: 2, low: 3 };

export function sortVisible(tasks: LabTask[], sort: RoomSortMode | "priority"): LabTask[] {
  if (sort === "manual") return tasks;
  const list = [...tasks];
  if (sort === "title") list.sort((a, b) => a.title.localeCompare(b.title, "en-GB"));
  else if (sort === "priority") list.sort((a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority]);
  else {
    list.sort((a, b) => {
      const ae = scheduleEnd(a.schedule);
      const be = scheduleEnd(b.schedule);
      if (ae === null && be === null) return 0;
      if (ae === null) return 1;
      if (be === null) return -1;
      return compareDates(ae, be);
    });
  }
  return list;
}

export function useVisibleLabTasks(tasks: LabTask[]): LabTask[] {
  const { query, priority, owner, due, column, label, sort } = useRoomTools();
  const calendar = useCalendarFrame();
  return useMemo(() => {
    const labPriority = priority === "all" ? null : priorityToLab(priority);
    const filtered = tasks.filter((task) => {
      if (!matchesQuery(task, query)) return false;
      if (labPriority !== null && task.priority !== labPriority) return false;
      if (owner === "assigned" && task.assigneeIds.length === 0) return false;
      if (owner === "unassigned" && task.assigneeIds.length > 0) return false;
      if (owner !== "all" && owner !== "assigned" && owner !== "unassigned" && !task.assigneeIds.includes(owner)) return false;
      if (column !== "all" && task.status !== column) return false;
      if (label !== "all" && !task.labelIds.includes(label)) return false;
      if (!matchesDue(task, due, calendar.today as CalendarDate)) return false;
      return true;
    });
    return sortVisible(filtered, sort);
  }, [calendar.today, column, due, label, owner, priority, query, sort, tasks]);
}
