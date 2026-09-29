/** Internal deadline evidence. A calendar date is never represented as an instant. */
export type Deadline =
  | Readonly<{ kind: "date-only"; date: string }>
  | Readonly<{ kind: "instant"; at: number }>
  | Readonly<{ kind: "unknown" }>
  | null;

/** Strict canonical YYYY-MM-DD only; human labels cannot establish a date. */
export function canonicalDate(value: unknown): string | null {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
    ? value : null;
}

/**
 * The Tasks picker's ISO label plus same-day 09:00 UTC encoding identifies a
 * date-only choice. A 09:00 instant by itself does not. A different valid
 * same-day instant remains timed; a conflicting ISO label is ambiguous.
 */
export function storedDeadline(due: unknown, dueAt: Date | null): Deadline {
  const date = canonicalDate(due);
  const at = dueAt?.getTime();
  if (dueAt !== null && (at === undefined || !Number.isFinite(at))) return { kind: "unknown" };
  if (date) {
    if (at === undefined) return { kind: "date-only", date };
    if (new Date(at).toISOString().slice(0, 10) !== date) return { kind: "unknown" };
    if (at === Date.parse(`${date}T09:00:00.000Z`)) return { kind: "date-only", date };
    return { kind: "instant", at };
  }
  if (at !== undefined) return { kind: "instant", at };
  return typeof due === "string" && due.trim() !== "" ? { kind: "unknown" } : null;
}
