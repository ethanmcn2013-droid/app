import { canonicalDate } from "../data/deadline";
import type { TaskSignal } from "./types";
import type { Triggered } from "./triggers";

/** Positive occurrences and current inventory; neither establishes progress or inactivity. */
export function contextObservations(signals: TaskSignal[], now: number, timezone: string,
  options: { canonicalUserId?: string; suppressed?: ReadonlySet<string> } = {}): {
  candidates: Triggered[]; coverageNotes: string[];
} {
  const candidates: Triggered[] = [];
  const notes = new Set<string>();
  const validTime = (value: unknown): number | null => {
    if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value) || !canonicalDate(value.slice(0, 10))) return null;
    if (Number(value.slice(11, 13)) > 23 || Number(value.slice(14, 16)) > 59 || Number(value.slice(17, 19)) > 59) return null;
    const offset = value.match(/[+-](\d{2}):(\d{2})$/);
    if (offset && (Number(offset[1]) > 23 || Number(offset[2]) > 59)) return null;
    const at = Date.parse(value);
    return Number.isFinite(at) && at >= 0 && at <= now ? at : null;
  };
  const dateFormatter = new Intl.DateTimeFormat("en-IE", {
    day: "numeric", month: "long", year: "numeric", timeZone: timezone,
  });
  const timeFormatter = new Intl.DateTimeFormat("en-IE", {
    hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23", timeZone: timezone,
  });
  const date = (at: number): string => dateFormatter.format(at);
  const occurrence = (at: number): string => `${date(at)} at ${timeFormatter.format(at)} (${timezone})`;
  const groups = new Map<string, TaskSignal[]>();
  const unique = [...new Map(signals.map(task => [task.id, task])).values()].sort((a, b) => a.id.localeCompare(b.id));
  const visible = new Map(unique.map(task => [task.id, task]));
  const dismissed = (task: TaskSignal, trigger: string) => options.suppressed?.has(`${trigger}:${task.id}`) || options.suppressed?.has(`*:${task.id}`);
  const completion = (task: TaskSignal): number | null => {
    const at = task.movedToShippedAt;
    return (task.stage ? task.stage.complete : task.lane === "shipped") && typeof at === "number" &&
      Number.isFinite(at) && at >= 0 && at <= now && now - at <= 86_400_000 && !dismissed(task, "just-shipped") ? at : null;
  };
  const digest = (tasks: TaskSignal[], source: string) => {
    const members = tasks.flatMap(task => completion(task) === null ? [] : [{ task, at: completion(task)! }]);
    if (!members.length) return;
    notes.add(`${members.length} ${members.length === 1 ? "task has" : "tasks have"} a saved completion in the past 24 hours (${source}). Recorded completions shown: ${members.map(({ task, at }) => `“${task.title}” on ${occurrence(at)} [${new Date(at).toISOString()}]`).join("; ")}. This covers the saved completion records included in this read.`);
  };
  for (const task of unique) {
    const completedAt = completion(task);
    if (completedAt !== null) {
      candidates.push({ task, trigger: "just-shipped", severity: 0, representedTaskIds: [task.id],
        detailOverride: `Saved completion on ${occurrence(completedAt)} [${new Date(completedAt).toISOString()}], within the past 24 hours.`,
        reasons: ["The current saved stage is complete and its durable completion time is within the past 24 hours."] });
    }
    if (task.workspaceId) {
      let group = groups.get(task.workspaceId);
      if (!group) { group = []; groups.set(task.workspaceId, group); }
      group.push(task);
    } else digest([task], task.sourceLabel);
    const titleEdit = task.latestValidatedTitleEdit?.kind === "update" && task.latestValidatedTitleEdit.field === "title"
      ? validTime(task.latestValidatedTitleEdit.at) : null;
    if (titleEdit !== null && !dismissed(task, "recorded-activity")) {
      notes.add(`Title edited for “${task.title}” on ${occurrence(titleEdit)}; this does not establish meaningful work progress.`);
    }
    const commentAt = task.latestValidatedComment?.kind === "commentAdd"
      ? validTime(task.latestValidatedComment.at) : null;
    if (commentAt !== null) {
      candidates.push({ task, trigger: "recorded-activity", severity: 0, representedTaskIds: [task.id],
        detailOverride: `Comment added on ${occurrence(commentAt)}.`,
        reasons: ["A saved activity record establishes this occurrence; it does not establish progress."] });
    }
    const isOpen = task.stage ? !task.stage.complete : task.lane !== "shipped";
    if (task.deadline === null && isOpen) notes.add(`“${task.title}” has no saved date.`);
    else if (task.deadline?.kind === "unknown" ||
      (task.deadline?.kind === "date-only" && !canonicalDate(task.deadline.date)) ||
      (task.deadline?.kind === "instant" && (!Number.isFinite(task.deadline.at) || task.deadline.at < 0))) {
      notes.add(`The saved deadline for “${task.title}” could not be established.`);
    }
    const tags = task.latestValidatedMetadataEdit;
    const tagsAt = tags?.field === "tags" ? validTime(tags.at) : null;
    if (tagsAt !== null) notes.add(`Tags edited on “${task.title}” on ${occurrence(tagsAt)}; this does not establish progress.`);
    if (task.activityCoverage === "partial" && task.hasRecordedTitleEdit === true) {
      notes.add(`A recorded title edit does not establish meaningful work progress for “${task.title}”.`);
    }
    if (task.activityCoverage === "partial" || task.activityHistoryStartAt !== undefined) {
      const start = validTime(task.activityHistoryStartAt);
      const prefix = task.activityCoverage === "partial" ? "Activity history is incomplete. " : "";
      notes.add(start === null
        ? `${prefix}Activity history for “${task.title}” is partial; earlier activity is not established.`
        : `${prefix}The earliest available inspected activity record for “${task.title}” is dated ${date(start)}; earlier activity is not established.`);
    }
    // Whole-list context is distinct from the chosen current open edge. Unknown
    // references remain unnamed; only the authorized inspected task is identified.
    const listed = [...new Set(task.blockedBy.filter(id => id !== task.id))];
    if (isOpen && (listed.length || task.prerequisiteEvidence?.length || task.dependencyCoverage === "partial") && !options.suppressed?.has(`*:${task.id}`)) {
      const records = new Map((task.prerequisiteEvidence ?? [])
        .filter(record => task.workspaceId && record.workspaceId === task.workspaceId && record.id !== task.id)
        .map(record => [record.id, record.complete]));
      for (const id of listed) {
        const known = visible.get(id);
        if (!records.has(id) && known && task.workspaceId && known.workspaceId === task.workspaceId) {
          records.set(id, known.stage ? known.stage.complete : known.lane === "shipped");
        }
      }
      const unknown = listed.filter(id => !records.has(id)).length;
      const partial = task.dependencyCoverage === "partial" || unknown > 0;
      if (partial && dismissed(task, "prerequisites-unverified")) continue;
      if (task.dependencyCoverage === "partial") {
        notes.add(`Readiness for “${task.title}” could not be fully verified from its listed prerequisites.`);
      }
      const open = [...records].filter(([, complete]) => !complete);
      const complete = [...records].filter(([, complete]) => complete);
      const named = [...records].flatMap(([id, done]) => {
        const known = visible.get(id);
        return known && known.workspaceId === task.workspaceId ? [`“${known.title}” (${done ? "complete" : "open"})`] : [];
      });
      notes.add(`Inspected listed prerequisite state for “${task.title}”: ${open.length} open, ${complete.length} complete${partial ? `, ${unknown ? `${unknown} unverified` : "further state unverified"}` : ""}.${named.length ? ` Inspected task names: ${named.join("; ")}.` : ""}${partial ? ` Its prerequisites could not be fully verified. The unverified prerequisites' state is unknown. It is not confirmed clear to move ahead on that work.${task.activityCoverage === "partial" ? " Activity history for this task is incomplete; earlier meaningful activity is not established." : ""}` : ""}`);
    }
  }
  for (const [, tasks] of [...groups].sort(([a], [b]) => a.localeCompare(b))) {
    digest(tasks, tasks[0]!.sourceLabel);
    if (!tasks.every(task => task.taskCoverage === "complete")) continue;
    const open = tasks.filter(task => task.stage ? !task.stage.complete : task.lane !== "shipped");
    if (!open.length) continue;
    const count = open.length;
    notes.add(`${count} ${count === 1 ? "task is" : "tasks are"} currently open in this project (${tasks[0]!.sourceLabel}). Open tasks: ${open.map(task => `“${task.title}”`).join("; ")}.`);
    if (options.canonicalUserId && open.every(task => task.assignees !== undefined)) {
      const assigned = open.filter(task => task.assignees!.some(user => user.id === options.canonicalUserId));
      notes.add(`${assigned.length} open ${assigned.length === 1 ? "task is" : "tasks are"} assigned to you in this project (${tasks[0]!.sourceLabel}).${assigned.length ? ` Assigned open tasks: ${assigned.map(task => `“${task.title}”`).join("; ")}.` : ""}`);
    }
  }
  return { candidates, coverageNotes: [...notes] };
}
