import { fmtDate, fmtDay } from "../../demo/store";
import { lateWords } from "../../tasks/words";
import { TODAY, type Priority, type Task } from "./data";

const DAY = 86_400_000;
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function toDate(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

export function daysFromToday(iso: string, asOf: string = TODAY) {
  return Math.round((toDate(iso).getTime() - toDate(asOf).getTime()) / DAY);
}

/** "Fri 25 Sep", with the year outside 2026: "Sun 14 Mar 2027". */
export const shortDate = (iso: string) => fmtDay(iso);

export type DueTone = "late" | "today" | "soon" | "later";

export type DueFact = { tone: DueTone; label: string; spoken: string };

/** How a date reads on a card, from today or, in the replay, from the day being shown. */
export function dueFact(iso: string, asOf: string = TODAY): DueFact {
  const diff = daysFromToday(iso, asOf);
  const d = toDate(iso);
  if (diff < 0) {
    const n = -diff;
    // Late is always counted: "1 day late", never "Yesterday".
    return { tone: "late", label: lateWords(n), spoken: `${lateWords(n)}, was due ${shortDate(iso)}` };
  }
  if (diff === 0) return { tone: "today", label: "Today", spoken: "Due today" };
  if (diff === 1) return { tone: "soon", label: "Tomorrow", spoken: "Due tomorrow" };
  if (diff < 7) return { tone: "soon", label: WEEKDAYS[d.getUTCDay()], spoken: `Due ${shortDate(iso)}` };
  return { tone: "later", label: fmtDate(iso), spoken: `Due ${shortDate(iso)}` };
}

export function isLate(task: Task) {
  return task.stage !== "done" && !!task.due && daysFromToday(task.due) < 0;
}

export const PRIORITY_WORDS: Record<Priority, string> = { 0: "No priority", 1: "Low priority", 2: "Medium priority", 3: "High priority", 4: "Urgent" };
