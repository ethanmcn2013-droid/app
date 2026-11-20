/* The command line, on the shared Tasks grammar (tasks/grammar.ts). Plain
   words in any order become tokens: a person, a date, a priority, a status,
   a project, paid or not, a cost, a headcount, a supplier. This file turns
   them into sheet edits and filters. Pure functions, so the bar, the ghost
   preview and the apply step read the same answer. */

import { eventOf, PEOPLE, PRIORITIES, STATUSES, addDays, daysFromToday, eur, fmtDate, type CellValue, type EventId, type Row } from "./data";
import { isLate, isStuck } from "./model";
import { parse, prettyWord, type Parsed, type Token } from "../../tasks/grammar";

export { parse, prettyWord };
export type { Parsed, Token };

/* ── Edits ─────────────────────────────────────────────────────────── */

/** The cells a sentence sets, plus relative date shifts and deletion. */
export type Change = { cells: Record<string, CellValue>; shift?: number; remove?: boolean };

export function toChange(tokens: Token[]): Change {
  const c: Change = { cells: {} };
  for (const t of tokens) {
    if (t.kind === "owner") c.cells.owner = t.person;
    else if (t.kind === "due") c.cells.due = t.date;
    else if (t.kind === "shift") c.shift = (c.shift ?? 0) + t.days;
    else if (t.kind === "priority") c.cells.priority = t.p;
    else if (t.kind === "status") c.cells.status = t.s;
    else if (t.kind === "event") c.cells.event = t.e;
    else if (t.kind === "paid") c.cells.paid = t.on;
    else if (t.kind === "cost") c.cells.cost = t.n;
    else if (t.kind === "guests") c.cells.guests = t.n;
    else if (t.kind === "supplier") c.cells.supplier = t.text;
    else if (t.kind === "delete") c.remove = true;
  }
  return c;
}

export const hasChange = (c: Change) => Object.keys(c.cells).length > 0 || !!c.shift || !!c.remove;

/** Every cell the change would actually alter, row by row. */
export function planChange(rows: Row[], c: Change) {
  const cells: { row: string; col: string; value: CellValue }[] = [];
  const touched = new Set<string>();
  for (const r of rows) {
    const patch: Record<string, CellValue> = { ...c.cells };
    if (c.shift && !("due" in patch) && typeof r.cells.due === "string") patch.due = addDays(r.cells.due, c.shift);
    for (const [col, value] of Object.entries(patch)) {
      if ((r.cells[col] ?? null) === value) continue;
      cells.push({ row: r.id, col, value });
      touched.add(r.id);
    }
  }
  return { cells, rows: touched.size };
}

/* ── Filters ───────────────────────────────────────────────────────── */

/** Every token must hold; loose words search the title, supplier and notes. */
export function matches(r: Row, tokens: Token[]) {
  const c = r.cells;
  return tokens.every((t) => {
    switch (t.kind) {
      case "owner":
        return (c.owner ?? null) === t.person;
      case "due":
        return (c.due ?? null) === t.date;
      case "priority":
        return (c.priority ?? null) === t.p;
      case "status":
        return c.status === t.s;
      case "event":
        return (c.event ?? null) === t.e;
      case "paid":
        return c.cost != null && !!c.paid === t.on;
      case "cost":
        return t.n == null ? c.cost == null : typeof c.cost === "number" && c.cost >= t.n;
      case "guests":
        return t.n == null ? c.guests == null : typeof c.guests === "number" && c.guests >= t.n;
      case "supplier":
        return t.text == null ? !c.supplier : String(c.supplier ?? "").toLowerCase().includes(t.text.toLowerCase());
      case "late":
        return isLate(r);
      case "stuck":
        return isStuck(r);
      case "shift":
      case "delete":
        return true;
      case "word":
        return `${c.title ?? ""} ${c.supplier ?? ""} ${c.notes ?? ""}`.toLowerCase().includes(t.word.toLowerCase());
    }
  });
}

/* ── Words for chips ───────────────────────────────────────────────── */

export type Chip = { key: string; label: string; value: string; icon: "person" | "date" | "priority" | "status" | "event" | "checkbox" | "currency" | "number" | "text" | "late" | "delete"; ref?: string; danger?: boolean };

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** One chip per token, phrased for an edit ("Assign Orla") or a filter ("Owner Orla"). */
export function chipFor(t: Token, filter: boolean): Chip | null {
  switch (t.kind) {
    case "owner":
      return { key: "owner", icon: "person", ref: t.person ?? undefined, label: filter ? "Owner" : t.person ? "Assign" : "Owner", value: t.person ? PEOPLE[t.person].name : "No one" };
    case "due":
      return { key: "due", icon: "date", label: "Due", value: t.date ? `${fmtDate(t.date)}${daysFromToday(t.date) === 0 ? ", today" : ""}` : "No date" };
    case "shift":
      return { key: "shift", icon: "date", label: t.days > 0 ? "Push" : "Pull in", value: plural(Math.abs(t.days), "day") };
    case "priority":
      return { key: "priority", icon: "priority", ref: t.p ?? undefined, label: "Priority", value: PRIORITIES.find((x) => x.id === t.p)?.name.toLowerCase() ?? "none" };
    case "status":
      return { key: "status", icon: "status", ref: t.s, label: filter ? "Status" : "Move to", value: STATUSES.find((x) => x.id === t.s)!.name };
    case "event":
      return { key: "event", icon: "event", ref: t.e ?? undefined, label: "Project", value: t.e ? (eventOf(t.e as EventId)?.short ?? t.e) : "No project" };
    case "paid":
      return { key: "paid", icon: "checkbox", label: filter ? "Payment" : "Mark", value: t.on ? "paid" : "not paid" };
    case "cost":
      return { key: "cost", icon: "currency", label: filter && t.n != null ? "Cost from" : "Cost", value: t.n == null ? "none" : eur(t.n) };
    case "guests":
      return { key: "guests", icon: "number", label: filter && t.n != null ? "Guests from" : "Guests", value: t.n == null ? "none" : String(t.n) };
    case "supplier":
      return { key: "supplier", icon: "text", label: "Supplier", value: t.text ?? "none" };
    case "late":
      return { key: "late", icon: "late", label: "Only", value: "late" };
    case "stuck":
      return { key: "stuck", icon: "late", label: "Only", value: "stuck" };
    case "delete":
      return { key: "delete", icon: "delete", label: "Delete", value: filter ? "" : "the tasks", danger: true };
    default:
      return null;
  }
}
