import { DAY_END, type Busy, type Task } from "./data";

export const HAND_LIMIT = 3;

export function clock(mins: number): string {
  const h = Math.floor(mins / 60) % 24;
  const m = Math.round(mins % 60);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function dur(mins: number): string {
  const m = Math.max(0, Math.round(mins));
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  const r = m % 60;
  return r ? `${h}h ${r}m` : `${h}h`;
}

/** Plain-words duration for sentences: "about 1h 30m". */
export function roughly(mins: number): string {
  const rounded = Math.max(5, Math.round(mins / 5) * 5);
  return dur(rounded);
}

export function remaining(task: Task): number {
  return Math.max(5, task.est - (task.spent ?? 0));
}

export function checklistCount(task: Task): { done: number; total: number } {
  const list = task.checklist ?? [];
  return { done: list.filter((i) => i.done).length, total: list.length };
}

export type Segment = {
  id: string;
  kind: "done" | "hand" | "queue" | "busy";
  start: number;
  end: number;
  title: string;
};

/**
 * Lay today's work out on the clock: finished work before now (placed at the
 * time it was finished), then in-hand and queued work from now onwards,
 * flowing around calendar commitments. Anything past the end of the day is
 * overflow.
 */
export function planDay(now: number, hand: Task[], queue: Task[], done: Task[], busy: Busy[]): {
  segments: Segment[];
  end: number;
  over: number;
  free: number;
} {
  const segments: Segment[] = [];
  for (const task of done) {
    if (task.doneAt == null) continue;
    segments.push({ id: task.id, kind: "done", start: task.doneAt - task.est, end: task.doneAt, title: task.title });
  }
  const blocks = busy.filter((b) => b.end > now).sort((a, b) => a.start - b.start);
  for (const b of busy) segments.push({ id: `busy-${b.start}`, kind: "busy", start: b.start, end: b.end, title: b.title });

  let cursor = now;
  const place = (task: Task, kind: "hand" | "queue") => {
    let left = remaining(task);
    while (left > 0) {
      const block = blocks.find((b) => b.end > cursor && b.start < cursor + left);
      if (block && block.start <= cursor) {
        cursor = block.end;
        continue;
      }
      const stop = block ? block.start : cursor + left;
      const piece = stop - cursor;
      segments.push({ id: `${task.id}-${cursor}`, kind, start: cursor, end: stop, title: task.title });
      left -= piece;
      cursor = stop;
    }
  };
  hand.forEach((t) => place(t, "hand"));
  queue.forEach((t) => place(t, "queue"));

  const busyLeft = blocks.reduce((sum, b) => sum + Math.max(0, Math.min(b.end, DAY_END) - Math.max(b.start, now)), 0);
  const free = Math.max(0, DAY_END - now - busyLeft);
  return { segments, end: cursor, over: Math.max(0, cursor - DAY_END), free };
}

export function projectVar(hue: number): string {
  return `var(--v3-project-${hue})`;
}
