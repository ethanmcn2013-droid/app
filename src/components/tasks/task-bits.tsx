"use client";

/**
 * Small shared pieces for drawing a task: search highlighting, the people
 * on a task, labels resolved from the runtime registry, and the one-line
 * accessible description a card or row carries.
 */

import { Fragment, useMemo } from "react";
import { useRoomTools } from "@/components/app/room/room-tools-context";
import { useTagDefs, useWorkspaceMembers } from "@/lib/domain-context";
import { useTasksState } from "@/lib/tasks/tasks-context";
import { labelById } from "@/components/hybrid/fixtures";
import { PRIORITY_LABELS, type LabLabel, type LabTask } from "@/components/hybrid/types";
import type { PresenceMember } from "@/components/app/presence/avatar-stack";
import type { TimeFact } from "./time";
import styles from "./atoms.module.css";

/** Wraps matches of the current search in <mark>. */
export function Highlight({ text }: { text: string }) {
  const { query } = useRoomTools();
  const q = query.trim();
  if (!q) return <>{text}</>;
  const lower = text.toLocaleLowerCase("en-GB");
  const needle = q.toLocaleLowerCase("en-GB");
  const parts: { text: string; hit: boolean }[] = [];
  let at = 0;
  while (at < text.length) {
    const found = lower.indexOf(needle, at);
    if (found === -1) {
      parts.push({ text: text.slice(at), hit: false });
      break;
    }
    if (found > at) parts.push({ text: text.slice(at, found), hit: false });
    parts.push({ text: text.slice(found, found + needle.length), hit: true });
    at = found + needle.length;
  }
  return (
    <>
      {parts.map((part, index) => (
        <Fragment key={index}>{part.hit ? <mark className={styles.mark}>{part.text}</mark> : part.text}</Fragment>
      ))}
    </>
  );
}

/** Member lookup that turns assignee ids into faces. */
export function usePeople() {
  const members = useWorkspaceMembers();
  return useMemo(() => {
    const byId = new Map(members.map((m) => [m.id, m]));
    return (ids: string[]): PresenceMember[] =>
      ids.map((id) => {
        const member = byId.get(id);
        return { id, name: member?.name ?? "Someone", initials: member?.initials };
      });
  }, [members]);
}

/**
 * Every label this project uses: its saved label definitions plus any label
 * already on a task (a label typed as #name exists before it is saved).
 */
export function useLabelNames(tasks: readonly LabTask[]): string[] {
  const tags = useTagDefs();
  return useMemo(() => {
    const names = new Set(tags.map((tag) => tag.name));
    for (const task of tasks) for (const id of task.labelIds) names.add(id);
    return [...names].sort((a, b) => a.localeCompare(b, "en-GB"));
  }, [tags, tasks]);
}

export function labelsOf(task: LabTask): LabLabel[] {
  return task.labelIds.map((id) => labelById(id) ?? { id, name: id, tone: "neutral" as const });
}

/** The per-project task number ("T-5") for the Display toggle and the sheet. */
export function useTaskNumberOf(): (id: string) => string | null {
  const { tasks } = useTasksState();
  return useMemo(() => {
    const map = new Map(tasks.map((task) => [task.id, task.seq ?? null]));
    return (id: string) => {
      const seq = map.get(id);
      return typeof seq === "number" ? `T-${seq}` : null;
    };
  }, [tasks]);
}

/** One sentence for assistive tech: status, time, priority, people, counts. */
export function describeTask(task: LabTask, statusName: string, time: TimeFact, people: PresenceMember[]): string {
  const parts = [statusName];
  if (time.said) parts.push(time.said);
  if (task.priority === "high" || task.priority === "urgent") parts.push(`${PRIORITY_LABELS[task.priority]} priority`);
  if (people.length) parts.push(`Assigned to ${people.map((p) => p.name).join(" and ")}`);
  if (task.subtasks.length) parts.push(`${task.subtasks.filter((s) => s.completed).length} of ${task.subtasks.length} subtasks done`);
  if (task.comments.length) parts.push(`${task.comments.length} ${task.comments.length === 1 ? "comment" : "comments"}`);
  if (task.blockedByIds.length) parts.push("Held up by another task");
  return parts.join(". ");
}
