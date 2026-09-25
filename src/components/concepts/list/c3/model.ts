/* The sheet's model: typed columns, sheets, grouping, aggregates, fill-down
   and paste mapping. Pure functions only, so the grid, the phone list and
   the record form all read the same numbers. */

import {
  EVENTS,
  EVENT_IDS,
  PEOPLE,
  PERSON_IDS,
  ROOMS,
  ROOM_IDS,
  STATUSES,
  addDays,
  daysFromToday,
  eur,
  fmtDate,
  num,
  parseIso,
  parseLooseDate,
  type CellValue,
  type EventId,
  type PersonId,
  type RoomId,
  type Row,
  type StatusId,
} from "./data";

export type ColType = "title" | "status" | "person" | "date" | "event" | "text" | "currency" | "checkbox" | "number" | "room" | "longtext";
export type IconName =
  | "title"
  | "status"
  | "person"
  | "date"
  | "event"
  | "text"
  | "currency"
  | "checkbox"
  | "number"
  | "room"
  | "longtext";

export type Column = { key: string; name: string; type: ColType; width: number; custom?: boolean };

export const BASE_COLUMNS: Column[] = [
  { key: "title", name: "Task", type: "title", width: 356 },
  { key: "status", name: "Status", type: "status", width: 128 },
  { key: "due", name: "Due", type: "date", width: 116 },
  { key: "owner", name: "Owner", type: "person", width: 128 },
  { key: "event", name: "Event", type: "event", width: 148 },
  { key: "cost", name: "Cost", type: "currency", width: 128 },
  { key: "paid", name: "Paid", type: "checkbox", width: 88 },
  { key: "supplier", name: "Supplier", type: "text", width: 190 },
  { key: "guests", name: "Guests", type: "number", width: 116 },
  { key: "room", name: "Room", type: "room", width: 140 },
  { key: "notes", name: "Notes", type: "longtext", width: 280 },
];

export const FIELD_TYPES: { type: ColType; name: string; hint: string }[] = [
  { type: "text", name: "Text", hint: "A name, a phone number, a short note" },
  { type: "currency", name: "Money", hint: "Euro amounts, summed in the footer" },
  { type: "number", name: "Number", hint: "Headcounts, quantities, hours" },
  { type: "date", name: "Date", hint: "A deadline or a delivery day" },
  { type: "checkbox", name: "Checkbox", hint: "Yes or no, like paid or signed" },
  { type: "person", name: "Person", hint: "Someone on the team" },
];

export const isNumeric = (c: Column) => c.type === "currency" || c.type === "number";
export const alignRight = (c: Column) => isNumeric(c);

/* ── Sheets ────────────────────────────────────────────────────────── */

export type GroupBy = "event" | "status" | "owner" | "none";
export type Filter = { statuses: StatusId[]; owners: PersonId[]; unpaid: boolean; late: boolean };
export const NO_FILTER: Filter = { statuses: [], owners: [], unpaid: false, late: false };
export const filterCount = (f: Filter) => f.statuses.length + f.owners.length + (f.unpaid ? 1 : 0) + (f.late ? 1 : 0);

export type Sheet = {
  id: string;
  name: string;
  table: string;
  base?: "supplier" | "cost";
  hidden: string[];
  groupBy: GroupBy;
  filter: Filter;
  sort: { key: string; dir: "asc" | "desc" } | null;
};

export const START_SHEETS: Sheet[] = [
  { id: "all", name: "All tasks", table: "main", hidden: [], groupBy: "event", filter: NO_FILTER, sort: null },
  {
    id: "suppliers",
    name: "Suppliers",
    table: "main",
    base: "supplier",
    hidden: ["status", "guests", "room"],
    groupBy: "none",
    filter: NO_FILTER,
    sort: { key: "supplier", dir: "asc" },
  },
  {
    id: "budget",
    name: "Budget",
    table: "main",
    base: "cost",
    hidden: ["owner", "guests", "room", "notes"],
    groupBy: "event",
    filter: NO_FILTER,
    sort: { key: "cost", dir: "desc" },
  },
];

export function sheetRows(rows: Row[], sheet: Sheet) {
  return rows.filter((r) => {
    if (r.table !== sheet.table) return false;
    if (sheet.base === "supplier" && !r.cells.supplier) return false;
    if (sheet.base === "cost" && r.cells.cost == null) return false;
    return true;
  });
}

export const isLate = (r: Row) => typeof r.cells.due === "string" && r.cells.status !== "done" && daysFromToday(r.cells.due) < 0;

export function applyFilter(rows: Row[], f: Filter) {
  return rows.filter(
    (r) =>
      (!f.statuses.length || f.statuses.includes(r.cells.status as StatusId)) &&
      (!f.owners.length || f.owners.includes(r.cells.owner as PersonId)) &&
      (!f.unpaid || (r.cells.cost != null && !r.cells.paid)) &&
      (!f.late || isLate(r)),
  );
}

/* ── Sorting ───────────────────────────────────────────────────────── */

function sortKey(v: CellValue, c: Column): string | number | null {
  if (v == null || v === "") return null;
  switch (c.type) {
    case "date":
      return parseIso(String(v));
    case "status":
      return STATUSES.findIndex((s) => s.id === v);
    case "person":
      return PEOPLE[v as PersonId]?.name ?? String(v);
    case "event":
      return EVENTS[v as EventId]?.name ?? String(v);
    case "room":
      return ROOMS[v as RoomId]?.name ?? String(v);
    case "checkbox":
      return v ? 1 : 0;
    default:
      return typeof v === "number" ? v : String(v).toLowerCase();
  }
}

export function sortRows(rows: Row[], sort: Sheet["sort"], cols: Column[]) {
  if (!sort) return rows;
  const c = cols.find((x) => x.key === sort.key);
  if (!c) return rows;
  const dir = sort.dir === "asc" ? 1 : -1;
  return [...rows].sort((a, b) => {
    const ka = sortKey(a.cells[c.key], c);
    const kb = sortKey(b.cells[c.key], c);
    if (ka == null && kb == null) return 0;
    if (ka == null) return 1; // empties always sink
    if (kb == null) return -1;
    return (ka < kb ? -1 : ka > kb ? 1 : 0) * dir;
  });
}

/* ── Grouping ──────────────────────────────────────────────────────── */

export type Group = {
  key: string;
  name: string;
  tone: string | null;
  kind: GroupBy;
  value: CellValue;
  meta: string | null;
  rows: Row[];
  /** Rows before the filter: lets an empty group say why it is empty. */
  total: number;
};

export function buildGroups(all: Row[], shown: Row[], by: GroupBy): Group[] {
  if (by === "none") return [{ key: "all", name: "All rows", tone: null, kind: "none", value: null, meta: null, rows: shown, total: all.length }];
  const defs: { key: string; name: string; tone: string | null; value: CellValue; meta: string | null }[] =
    by === "event"
      ? [
          ...EVENT_IDS.map((e) => ({
            key: e,
            name: EVENTS[e].name,
            tone: EVENTS[e].tone,
            value: e,
            meta: `${fmtDate(EVENTS[e].date)} · ${EVENTS[e].guests} guests`,
          })),
          { key: "none", name: "No event", tone: null, value: null, meta: "Venue upkeep" },
        ]
      : by === "status"
        ? STATUSES.map((s) => ({ key: s.id, name: s.name, tone: null, value: s.id, meta: null }))
        : [
            ...PERSON_IDS.map((p) => ({ key: p, name: PEOPLE[p].name, tone: PEOPLE[p].tone, value: p, meta: null })),
            { key: "none", name: "No owner", tone: null, value: null, meta: null },
          ];
  const field = by === "event" ? "event" : by === "status" ? "status" : "owner";
  return defs.map((d) => ({
    ...d,
    kind: by,
    rows: shown.filter((r) => (r.cells[field] ?? null) === d.value),
    total: all.filter((r) => (r.cells[field] ?? null) === d.value).length,
  }));
}

/* ── Aggregates ────────────────────────────────────────────────────── */

export type Agg = "sum" | "average" | "min" | "max" | "filled" | "none";
export const AGG_NAMES: Record<Agg, string> = { sum: "Sum", average: "Average", min: "Smallest", max: "Largest", filled: "Filled", none: "None" };

export const numbers = (rows: Row[], key: string) =>
  rows.map((r) => r.cells[key]).filter((v): v is number => typeof v === "number" && !Number.isNaN(v));

export function aggregate(rows: Row[], c: Column, agg: Agg): number | null {
  const ns = numbers(rows, c.key);
  if (agg === "filled") return ns.length;
  if (!ns.length || agg === "none") return null;
  if (agg === "sum") return ns.reduce((a, b) => a + b, 0);
  if (agg === "average") return Math.round((ns.reduce((a, b) => a + b, 0) / ns.length) * 100) / 100;
  if (agg === "min") return Math.min(...ns);
  return Math.max(...ns);
}

export function fmtNumber(n: number, c: Column) {
  return c.type === "currency" ? eur(n) : num(n);
}

export const sumCost = (rows: Row[]) => numbers(rows, "cost").reduce((a, b) => a + b, 0);
export const paidCount = (rows: Row[]) => rows.filter((r) => r.cells.paid === true).length;

export function statusMix(rows: Row[]) {
  return STATUSES.map((s) => ({ ...s, count: rows.filter((r) => r.cells.status === s.id).length }));
}

/* ── Validation ────────────────────────────────────────────────────── */

export function cellWarning(row: Row, key: string): string | null {
  if (key === "guests") {
    const g = row.cells.guests;
    const room = row.cells.room as RoomId | null;
    if (typeof g === "number" && room && g > ROOMS[room].seats) return `More than the ${ROOMS[room].name} seats (${ROOMS[room].seats})`;
  }
  if (key === "cost" && typeof row.cells.cost === "number" && row.cells.cost < 0) return "Costs can't be negative";
  return null;
}

/* ── Text in and out (copy, paste, fill) ───────────────────────────── */

export function toText(v: CellValue, c: Column): string {
  if (v == null || v === "") return "";
  switch (c.type) {
    case "status":
      return STATUSES.find((s) => s.id === v)?.name ?? "";
    case "person":
      return PEOPLE[v as PersonId]?.name ?? "";
    case "event":
      return EVENTS[v as EventId]?.name ?? "";
    case "room":
      return ROOMS[v as RoomId]?.name ?? "";
    case "date":
      return fmtDate(String(v));
    case "currency":
      return typeof v === "number" ? eur(v) : "";
    case "checkbox":
      return v ? "Yes" : "No";
    default:
      return String(v);
  }
}

const norm = (s: string) => s.trim().toLowerCase();

export function fromText(raw: string, c: Column): { ok: boolean; value: CellValue } {
  const t = raw.trim();
  if (!t) return { ok: true, value: c.type === "checkbox" ? false : null };
  switch (c.type) {
    case "currency":
    case "number": {
      const n = Number(t.replace(/[€,\s]/g, ""));
      return Number.isFinite(n) ? { ok: true, value: n } : { ok: false, value: null };
    }
    case "date": {
      const d = parseLooseDate(t);
      return d ? { ok: true, value: d } : { ok: false, value: null };
    }
    case "checkbox":
      return { ok: true, value: ["yes", "y", "true", "paid", "1", "x", "✓"].includes(norm(t)) };
    case "status": {
      const s = STATUSES.find((x) => norm(x.name) === norm(t) || x.id === norm(t));
      return s ? { ok: true, value: s.id } : { ok: false, value: null };
    }
    case "person": {
      const p = PERSON_IDS.find((x) => norm(PEOPLE[x].name) === norm(t) || x === norm(t));
      return p ? { ok: true, value: p } : { ok: false, value: null };
    }
    case "event": {
      const e = EVENT_IDS.find((x) => norm(EVENTS[x].name) === norm(t) || norm(EVENTS[x].short) === norm(t));
      return e ? { ok: true, value: e } : { ok: false, value: null };
    }
    case "room": {
      const r = ROOM_IDS.find((x) => norm(ROOMS[x].name) === norm(t));
      return r ? { ok: true, value: r } : { ok: false, value: null };
    }
    default:
      return { ok: true, value: t };
  }
}

/* ── Fill-down ─────────────────────────────────────────────────────── */

/** Values for `count` cells below `sources`. "series" steps dates by a day
    (or by the gap between the last two) and numbers by their step;
    "copy" repeats the pattern as it is. */
export function fillValues(sources: CellValue[], c: Column, count: number, mode: "series" | "copy"): CellValue[] {
  const out: CellValue[] = [];
  const last = sources[sources.length - 1];
  if (mode === "series" && c.type === "date" && typeof last === "string") {
    const prev = sources.length > 1 ? sources[sources.length - 2] : null;
    const step = typeof prev === "string" ? Math.round((parseIso(last) - parseIso(prev)) / 86_400_000) || 1 : 1;
    for (let i = 1; i <= count; i++) out.push(addDays(last, step * i));
    return out;
  }
  if (mode === "series" && isNumeric(c) && sources.length > 1) {
    const ns = sources.filter((v): v is number => typeof v === "number");
    if (ns.length > 1) {
      const step = ns[ns.length - 1] - ns[ns.length - 2];
      for (let i = 1; i <= count; i++) out.push(ns[ns.length - 1] + step * i);
      return out;
    }
  }
  for (let i = 0; i < count; i++) out.push(sources[i % sources.length] ?? null);
  return out;
}

/* ── Paste mapping ─────────────────────────────────────────────────── */

const SYNONYMS: Record<string, string[]> = {
  title: ["task", "item", "title", "name", "what", "description"],
  supplier: ["supplier", "vendor", "company", "who"],
  cost: ["cost", "price", "amount", "quote", "total", "€"],
  due: ["due", "date", "deadline", "when", "by"],
  paid: ["paid", "settled"],
  guests: ["guests", "headcount", "pax", "people", "numbers"],
  owner: ["owner", "assignee", "person", "lead"],
  status: ["status", "state"],
  room: ["room", "space", "where"],
  notes: ["notes", "note", "comments"],
  event: ["event"],
};

export type PastePlan = { header: string[] | null; map: (string | null)[]; body: string[][] };

export function planPaste(text: string, cols: Column[]): PastePlan | null {
  const lines = text.replace(/\r/g, "").split("\n").filter((l) => l.trim());
  if (!lines.length) return null;
  const grid = lines.map((l) => l.split("\t"));
  const first = grid[0];
  const byName = first.map((h) => {
    const n = norm(h);
    const direct = cols.find((c) => norm(c.name) === n);
    if (direct) return direct.key;
    const syn = Object.entries(SYNONYMS).find(([, words]) => words.includes(n));
    return syn && cols.some((c) => c.key === syn[0]) ? syn[0] : null;
  });
  const matched = byName.filter(Boolean).length;
  if (matched >= Math.max(1, Math.ceil(first.length / 2))) return { header: first, map: byName, body: grid.slice(1) };
  const width = Math.max(...grid.map((r) => r.length));
  return { header: null, map: cols.slice(0, width).map((c) => c.key), body: grid };
}

export function rowsFromPlan(plan: PastePlan, cols: Column[], base: Record<string, CellValue>, table: string, seed: number): Row[] {
  return plan.body.map((line, i) => {
    const cells: Record<string, CellValue> = { title: "", status: "todo", paid: false, ...base };
    plan.map.forEach((key, j) => {
      const c = cols.find((x) => x.key === key);
      if (!c || line[j] == null) return;
      const parsed = fromText(line[j], c);
      if (parsed.ok) cells[c.key] = parsed.value;
      else if (c.type === "title" || c.type === "text" || c.type === "longtext") cells[c.key] = line[j];
    });
    return { id: `p${seed}-${i}`, table, cells };
  });
}
