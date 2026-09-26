import {
  KIND_LABEL,
  ME,
  PEOPLE,
  STATUS_LABEL,
  daysFromToday,
  isPastDue,
  monthKey,
  netOpen,
  nextMilestone,
  toTime,
  type KindId,
  type PersonId,
  type Project,
  type StatusId,
} from "./data";

/* ── Columns ────────────────────────────────────────────────────────── */

export type ColId = "name" | "status" | "health" | "progress" | "milestone" | "date" | "owner" | "people" | "updated";

export const COL_META: Record<ColId, { label: string; def: number; min: number; sortable: boolean; hint?: string }> = {
  // Project takes the leftover width; `def` is its floor at desktop widths, `min` the floor when space runs out.
  name: { label: "Project", def: 258, min: 226, sortable: true },
  status: { label: "Status", def: 108, min: 106, sortable: true, hint: "S" },
  health: { label: "Open tasks", def: 130, min: 130, sortable: true, hint: "Change in open tasks over the last 14 days" },
  progress: { label: "Progress", def: 112, min: 104, sortable: true },
  milestone: { label: "Next milestone", def: 202, min: 170, sortable: true },
  date: { label: "Date", def: 184, min: 156, sortable: true, hint: "D" },
  owner: { label: "Owner", def: 60, min: 56, sortable: true, hint: "O" },
  people: { label: "People", def: 92, min: 80, sortable: false },
  updated: { label: "Updated", def: 96, min: 88, sortable: true },
};

export type ColState = { id: ColId; width: number; hidden: boolean };

export const DEFAULT_COLS: ColState[] = (
  ["name", "status", "health", "progress", "milestone", "date", "owner", "people", "updated"] as ColId[]
).map((id) => ({ id, width: COL_META[id].def, hidden: id === "people" }));

export type Sort = { col: ColId; dir: 1 | -1 };

/**
 * Column priority for narrow content areas. The ledger never scrolls sideways at laptop widths:
 * secondary columns step aside first, then the rest squeeze to their floors. Next milestone is
 * never squeezed below 170px; below that it leaves, and lives on in the name card and the peek.
 * Late tasks always sit in Progress ("5/21 · 5 late"), so nothing urgent is lost.
 */
const SQUEEZE_ORDER: ColId[] = ["date", "progress", "status", "health", "milestone", "updated", "owner", "people"];
const STEPS: { drop: ColId[]; squeeze: boolean }[] = [
  { drop: [], squeeze: false },
  { drop: ["people"], squeeze: false },
  { drop: ["people", "updated"], squeeze: false },
  { drop: ["people", "updated"], squeeze: true },
  { drop: ["people", "updated", "milestone"], squeeze: false },
  { drop: ["people", "updated", "milestone"], squeeze: true },
  // Open tasks is the ledger's live signal, so Owner (also in the name card, the peek and "4 yours") steps aside first.
  { drop: ["people", "updated", "milestone", "owner"], squeeze: true },
  { drop: ["people", "updated", "milestone", "owner", "health"], squeeze: true },
];

/** Returns the columns that fit. The Project column's `width` is its floor for this width (it grows with 1fr). */
export function fitColumns(cols: ColState[], avail: number): { cols: ColState[]; folded: ColId[] } {
  const base = cols.filter((c) => !c.hidden);
  const nameDef = base.find((c) => c.id === "name")?.width ?? COL_META.name.def;
  const width = (cs: ColState[]) => cs.reduce((a, c) => a + c.width, 0);
  let shown = base;
  search: for (const step of STEPS) {
    for (const nameW of step.squeeze ? [nameDef, COL_META.name.min] : [nameDef]) {
      shown = base.filter((c) => !step.drop.includes(c.id)).map((c) => (c.id === "name" ? { ...c, width: nameW } : { ...c }));
      if (step.squeeze) {
        for (const id of SQUEEZE_ORDER) {
          const over = width(shown) - avail;
          if (over <= 0) break;
          const c = shown.find((x) => x.id === id);
          if (c) c.width = Math.max(COL_META[id].min, c.width - over);
        }
      }
      if (width(shown) <= avail) break search;
    }
  }
  return { cols: shown, folded: base.filter((c) => !shown.some((x) => x.id === c.id)).map((c) => c.id) };
}

/* ── Saved views ────────────────────────────────────────────────────── */

export type ViewId = "active" | "quarter" | "risk" | "mine" | "wrapped";

export const VIEWS: { id: ViewId; label: string; test: (p: Project) => boolean }[] = [
  { id: "active", label: "All active", test: (p) => p.status !== "wrapped" },
  {
    id: "quarter",
    label: "Events this quarter",
    test: (p) =>
      p.status !== "wrapped" &&
      (p.kind === "wedding" || p.kind === "event") &&
      toTime(p.date) >= toTime("2026-10-01") &&
      toTime(p.date) <= toTime("2026-12-31"),
  },
  { id: "risk", label: "Needs attention", test: (p) => p.status === "at_risk" || p.status === "off_track" },
  { id: "mine", label: "Mine", test: (p) => p.status !== "wrapped" && p.owner === ME },
  { id: "wrapped", label: "Wrapped", test: (p) => p.status === "wrapped" },
];

/* ── Filters ────────────────────────────────────────────────────────── */

export type FilterField = "status" | "kind" | "owner" | "overdue" | "within" | "past";
export type Filter = { field: FilterField; value: string; negate?: boolean };

export function filterKey(f: Filter) {
  return `${f.field}:${f.value}`;
}

export function filterParts(f: Filter): { field: string; op: string; value: string } {
  switch (f.field) {
    case "status":
      return { field: "Status", op: f.negate ? "is not" : "is", value: STATUS_LABEL[f.value as StatusId].toLowerCase() };
    case "kind":
      return { field: "Kind", op: f.negate ? "is not" : "is", value: KIND_LABEL[f.value as KindId].toLowerCase() };
    case "owner":
      return { field: "Owner", op: f.negate ? "is not" : "is", value: PEOPLE[f.value as PersonId].short };
    case "overdue":
      return { field: "Overdue tasks", op: f.negate ? "none" : "any", value: "" };
    case "within":
      return { field: "Date", op: f.negate ? "after" : "within", value: `${f.value} days` };
    case "past":
      return { field: "Date", op: f.negate ? "still ahead" : "has passed", value: "" };
  }
}

export function filterLabel(f: Filter) {
  const p = filterParts(f);
  return [p.field, p.op, p.value].filter(Boolean).join(" ");
}

function testFilter(p: Project, f: Filter): boolean {
  let r: boolean;
  switch (f.field) {
    case "status":
      r = p.status === f.value;
      break;
    case "kind":
      r = p.kind === f.value;
      break;
    case "owner":
      r = p.owner === f.value;
      break;
    case "overdue":
      r = p.overdue > 0;
      break;
    case "within": {
      const d = daysFromToday(p.date);
      r = d >= 0 && d <= Number(f.value);
      break;
    }
    case "past":
      r = isPastDue(p);
      break;
  }
  return f.negate ? !r : r;
}

/** Filters on the same field OR together; different fields AND. */
export function applyFilters(list: Project[], filters: Filter[]): Project[] {
  if (!filters.length) return list;
  const byField = new Map<FilterField, Filter[]>();
  for (const f of filters) byField.set(f.field, [...(byField.get(f.field) ?? []), f]);
  return list.filter((p) =>
    [...byField.values()].every((fs) => (fs[0].negate ? fs.every((f) => testFilter(p, f)) : fs.some((f) => testFilter(p, f)))),
  );
}

export function emptyMessage(filters: Filter[], view: ViewId): string {
  if (filters.length === 1) {
    const f = filters[0];
    if (f.field === "status" && !f.negate) return `No projects ${STATUS_LABEL[f.value as StatusId].toLowerCase()}.`;
    if (f.field === "kind" && !f.negate) return `No ${KIND_LABEL[f.value as KindId].toLowerCase()} projects here.`;
    if (f.field === "owner" && !f.negate) return `${PEOPLE[f.value as PersonId].short} owns nothing in this view.`;
    if (f.field === "overdue" && !f.negate) return "Nothing overdue. Good week.";
    if (f.field === "past" && !f.negate) return "No project is past its date.";
  }
  if (filters.length) return "No projects match these filters.";
  if (view === "risk") return "Nothing needs attention right now.";
  return "No projects in this view.";
}

/* ── Sorting ────────────────────────────────────────────────────────── */

const STATUS_ORDER: Record<StatusId, number> = { off_track: 0, at_risk: 1, on_track: 2, wrapped: 3 };

function sortValue(p: Project, col: ColId): number | string {
  switch (col) {
    case "name":
      return p.name.toLowerCase();
    case "status":
      return STATUS_ORDER[p.status];
    case "health":
      // Most growth in open work first when ascending.
      return -netOpen(p);
    case "progress":
      return p.total ? p.done / p.total : 0;
    case "milestone": {
      const m = nextMilestone(p);
      return m ? toTime(m.date) : Number.MAX_SAFE_INTEGER;
    }
    case "date":
      return toTime(p.date);
    case "owner":
      return PEOPLE[p.owner].short;
    case "people":
      return p.people.length;
    case "updated":
      return p.updatedMins;
  }
}

export function sortProjects(list: Project[], sort: Sort): Project[] {
  return [...list].sort((a, b) => {
    const va = sortValue(a, sort.col);
    const vb = sortValue(b, sort.col);
    if (va < vb) return -1 * sort.dir;
    if (va > vb) return 1 * sort.dir;
    return toTime(a.date) - toTime(b.date);
  });
}

/* ── Grouping ───────────────────────────────────────────────────────── */

export type GroupId = "none" | "status" | "kind" | "owner" | "month";

export const GROUPS: { id: GroupId; label: string }[] = [
  { id: "none", label: "None" },
  { id: "status", label: "Status" },
  { id: "kind", label: "Kind" },
  { id: "owner", label: "Owner" },
  { id: "month", label: "Month of date" },
];

export type Group = { key: string; label: string; projects: Project[]; status?: StatusId; owner?: PersonId; kind?: KindId };

export function groupProjects(list: Project[], by: GroupId): Group[] {
  if (by === "none") return [{ key: "all", label: "All", projects: list }];
  const map = new Map<string, Group>();
  for (const p of list) {
    let key: string;
    let g: Omit<Group, "projects">;
    if (by === "status") {
      key = p.status;
      g = { key, label: STATUS_LABEL[p.status], status: p.status };
    } else if (by === "kind") {
      key = p.kind;
      g = { key, label: KIND_LABEL[p.kind], kind: p.kind };
    } else if (by === "owner") {
      key = p.owner;
      g = { key, label: PEOPLE[p.owner].short, owner: p.owner };
    } else {
      key = monthKey(p.date);
      g = { key, label: key };
    }
    if (!map.has(key)) map.set(key, { ...g, projects: [] });
    map.get(key)!.projects.push(p);
  }
  const groups = [...map.values()];
  if (by === "status") groups.sort((a, b) => STATUS_ORDER[a.status!] - STATUS_ORDER[b.status!]);
  if (by === "month") groups.sort((a, b) => toTime(a.projects[0].date) - toTime(b.projects[0].date));
  if (by === "owner") groups.sort((a, b) => b.projects.length - a.projects.length);
  return groups;
}

export function rollup(g: Group): string {
  const n = g.projects.length;
  const risk = g.projects.filter((p) => p.status === "at_risk" || p.status === "off_track").length;
  const open = g.projects.reduce((a, p) => a + (p.total - p.done), 0);
  const parts = [`${n} project${n === 1 ? "" : "s"}`];
  if (risk && g.status !== "at_risk" && g.status !== "off_track") parts.push(`${risk} at risk`);
  parts.push(`${open} open task${open === 1 ? "" : "s"}`);
  return parts.join(", ");
}
