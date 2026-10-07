import { canonicalDate } from "../data/deadline";
import type { TaskSignal } from "./types";
import type { Triggered } from "./triggers";

/** Positive occurrences and current inventory; neither establishes progress or inactivity. */
export function contextObservations(signals: TaskSignal[], now: number, timezone: string): {
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
  for (const task of [...signals].sort((a, b) => a.id.localeCompare(b.id))) {
    if (task.workspaceId) {
      let group = groups.get(task.workspaceId);
      if (!group) { group = []; groups.set(task.workspaceId, group); }
      group.push(task);
    }
    const events = [
      task.latestValidatedTitleEdit?.kind === "update" && task.latestValidatedTitleEdit.field === "title"
        ? { at: validTime(task.latestValidatedTitleEdit.at), label: "Title edited" } : null,
      task.latestValidatedComment?.kind === "commentAdd"
        ? { at: validTime(task.latestValidatedComment.at), label: "Comment added" } : null,
    ].filter((event): event is { at: number; label: string } => event !== null && event.at !== null)
      .sort((a, b) => b.at - a.at || a.label.localeCompare(b.label));
    if (events[0]) {
      const detail = `${events[0].label} on ${occurrence(events[0].at)}.`;
      candidates.push({ task, trigger: "recorded-activity", severity: 0, representedTaskIds: [task.id],
        detailOverride: detail, reasons: ["A saved activity record establishes this occurrence; it does not establish progress."] });
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
  }
  for (const [workspaceId, tasks] of [...groups].sort(([a], [b]) => a.localeCompare(b))) {
    if (!tasks.every(task => task.taskCoverage === "complete")) continue;
    const open = tasks.filter(task => task.stage ? !task.stage.complete : task.lane !== "shipped");
    if (!open.length) continue;
    const count = open.length;
    notes.add(`${count} ${count === 1 ? "task is" : "tasks are"} currently open in this project (${tasks[0]!.sourceLabel}).`);
  }
  return { candidates, coverageNotes: [...notes] };
}
