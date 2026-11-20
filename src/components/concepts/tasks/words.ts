/**
 * The words Board, List and Calendar share for a task: how late it is, how
 * long it has sat, and the sentence a toast says after an edit. One place, so
 * a late task is never "Yesterday" in one view and "1 day late" in another.
 *
 * Server-safe and pure.
 */

import { fmtDay, fmtDays, fmtDuration, fmtEuro, personById, projectById, type Task, type TaskStatus } from "../demo/store";
import { liveProject } from "./projects";
import { statusName } from "./status";

/** "1 day late", "3 days late". Late is always counted in days. */
export const lateWords = (days: number): string => `${fmtDays(Math.abs(days))} late`;

/** "7 days": how long a task has sat in its stage. Never "7d". */
export const ageWords = (days: number): string => fmtDays(days);

/** The fields an edit can change. The store's `TaskPatch`, without importing the client. */
type Patch = Partial<Omit<Task, "id">>;

const PRIORITY_NAME: Record<string, string> = { urgent: "urgent", high: "high priority", medium: "medium priority", low: "low priority", none: "no priority" };

const cap = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);

/**
 * What an edit did, for the toast: "Marked done", "Sent to be checked",
 * "Moved to Aoife, due Mon 28 Sep". `was` is the task before the edit, so
 * reopening a finished task reads "Marked not done".
 */
export function editSentence(patch: Patch, was?: { status?: TaskStatus }): string {
  const parts: string[] = [];
  const has = (k: keyof Patch) => Object.prototype.hasOwnProperty.call(patch, k);
  if (patch.owner) parts.push(`moved to ${personById(patch.owner)?.first ?? patch.owner}`);
  if (patch.status) {
    if (patch.status === "done") parts.unshift("marked done");
    else if (was?.status === "done" && patch.status === "todo") parts.unshift("marked not done");
    // "To check" is a label, not a place: "Moved to To check" reads badly.
    else if (patch.status === "review") parts.push(patch.owner ? "now to be checked" : "sent to be checked");
    else parts.push(patch.owner ? `now in ${statusName(patch.status)}` : `moved to ${statusName(patch.status)}`);
  }
  if (has("due")) parts.push(patch.due ? `due ${fmtDay(patch.due)}` : "date cleared");
  if (patch.priority) parts.push(PRIORITY_NAME[patch.priority] ?? patch.priority);
  if (patch.project) parts.push(`in ${(liveProject(patch.project) ?? projectById(patch.project))?.short ?? patch.project}`);
  if (patch.title) parts.push("renamed");
  if (has("paid")) parts.push(patch.paid ? "marked paid" : "marked not paid");
  if (has("cost")) parts.push(patch.cost != null ? `cost ${fmtEuro(patch.cost)}` : "cost cleared");
  if (has("guests")) parts.push(patch.guests != null ? `${patch.guests} guests` : "guests cleared");
  if (has("room")) parts.push(patch.room ? `in the ${patch.room.toLowerCase()}` : "room cleared");
  if (has("supplier")) parts.push(patch.supplier ? "supplier set" : "supplier cleared");
  if (has("notes")) parts.push(patch.notes ? "note saved" : "note cleared");
  if (has("estimate") && patch.estimate != null) parts.push(`now ${fmtDuration(patch.estimate)}`);
  if (has("subtasks")) parts.push("steps updated");
  if (!parts.length) return "Updated";
  return cap(parts.join(", "));
}
