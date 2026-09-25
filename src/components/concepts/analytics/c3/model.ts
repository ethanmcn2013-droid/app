/* Pure calculation for "Who needs a hand". No React in here. */

import {
  EMPTY,
  HISTORY_STARTS,
  PERIOD_END,
  PROJECTS,
  SOLO,
  TEAM,
  TODAY,
  WEEK_STARTS,
  projectById,
  type Person,
  type ProjectId,
  type Scenario,
  type Task,
} from "./data";

export type Mode = "week" | "three";
export type ScenarioId = Scenario["id"];
export type ProjectFilter = "all" | ProjectId;
export type Assign = Record<string, (string | null)[]>;

export const SCENARIOS: Record<ScenarioId, Scenario> = { team: TEAM, solo: SOLO, empty: EMPTY };

/* ── dates ─────────────────────────────────────────────────────────── */

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function parts(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}
export function addDays(iso: string, n: number) {
  const dt = parts(iso);
  dt.setUTCDate(dt.getUTCDate() + n);
  return dt.toISOString().slice(0, 10);
}
export const weekday = (iso: string) => DAYS[parts(iso).getUTCDay()];
export const dayMonth = (iso: string) => {
  const dt = parts(iso);
  return `${dt.getUTCDate()} ${MONTHS[dt.getUTCMonth()]}`;
};
export const longDay = (iso: string) => `${weekday(iso)} ${dayMonth(iso)}`;
export function weekIndex(iso: string) {
  if (iso < WEEK_STARTS[1]) return 0;
  if (iso < WEEK_STARTS[2]) return 1;
  return 2;
}
export const isOverdue = (iso: string) => iso < TODAY;
export function daysLate(iso: string) {
  return Math.round((parts(TODAY).getTime() - parts(iso).getTime()) / 86_400_000);
}
export const historyLabel = (i: number) => dayMonth(HISTORY_STARTS[i]);
export const WEEK_NAMES = ["This week", "Next week", "Week of 5 Oct"];
export const WEEK_RANGES = ["21–27 Sep", "28 Sep–4 Oct", "5–11 Oct"];

/* ── usual pace: each person's own median ─────────────────────────── */

function median(xs: number[]) {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const mid = s.length >> 1;
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

export function usualWeek(p: Person): number | null {
  if (p.history.length < 4) return null;
  return Math.round(median(p.history));
}

export function usualThree(p: Person): number | null {
  if (p.history.length < 4) return null;
  const sums: number[] = [];
  for (let i = 0; i + 2 < p.history.length; i++) sums.push(p.history[i] + p.history[i + 1] + p.history[i + 2]);
  return Math.round(median(sums));
}

/** Usual for the period, and the lower figure once time away is taken out. */
export function usualFor(p: Person, mode: Mode): { full: number | null; effective: number | null } {
  const full = mode === "week" ? usualWeek(p) : usualThree(p);
  if (full === null) return { full, effective: null };
  if (!p.away) return { full, effective: full };
  const inView = mode === "three" || p.away.week === 0;
  if (!inView) return { full, effective: full };
  const lost = usualWeek(p) ?? 0;
  return { full, effective: Math.max(0, full - lost) };
}

/* ── the view model ────────────────────────────────────────────────── */

export type TileVM = {
  key: string;
  task: Task;
  slot: number;
  due: string;
  muted: boolean;
  overdue: boolean;
  others: string[];
};

export type ColumnVM = {
  id: string;
  title: string;
  sub: string;
  initials: string;
  person: Person | null;
  usual: number | null;
  usualFull: number | null;
  away: string | null;
  tiles: TileVM[];
  count: number;
  over: number;
  room: number;
  isYou: boolean;
};

export type View = {
  columns: ColumnVM[];
  tray: TileVM[];
  projectsInView: ProjectId[];
};

const initials = (name: string) =>
  name
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

export function peopleFor(scenario: Scenario, project: ProjectFilter): Person[] {
  if (scenario.id !== "team") return scenario.people;
  const home: ProjectId[] = project === "all" ? ["orchard", "marafinn"] : [project];
  return scenario.people.filter((p) => p.projects.some((id) => home.includes(id)));
}

function projectsFor(scenario: Scenario, project: ProjectFilter): ProjectId[] {
  if (scenario.id === "solo") return ["marafinn"];
  if (project !== "all") return [project];
  return ["orchard", "marafinn"];
}

export function baseAssign(scenario: Scenario): Assign {
  const out: Assign = {};
  for (const t of scenario.tasks) {
    out[t.id] = scenario.id === "solo" ? [`w${weekIndex(t.due)}`] : [...t.owners];
  }
  return out;
}

/** In the solo view a task's column is its week, so moving it moves its date. */
function effectiveDue(task: Task, owner: string | null, scenario: Scenario) {
  if (scenario.id !== "solo" || !owner) return task.due;
  const to = Number(owner.slice(1));
  const from = weekIndex(task.due);
  if (to === from) return task.due;
  const moved = addDays(task.due, (to - from) * 7);
  return moved < TODAY ? TODAY : moved;
}

export function buildView(scenario: Scenario, assign: Assign, mode: Mode, project: ProjectFilter): View {
  const end = PERIOD_END[mode];
  const home = projectsFor(scenario, project);
  const nameOf = (id: string) => scenario.people.find((p) => p.id === id)?.name ?? id;

  if (scenario.id === "solo") {
    const you = scenario.people[0];
    const u = usualWeek(you);
    const columns: ColumnVM[] = WEEK_NAMES.map((title, i) => ({
      id: `w${i}`,
      title,
      sub: WEEK_RANGES[i],
      initials: "",
      person: you,
      usual: u,
      usualFull: u,
      away: null,
      tiles: [],
      count: 0,
      over: 0,
      room: 0,
      isYou: true,
    }));
    for (const t of scenario.tasks) {
      const owner = assign[t.id]?.[0] ?? null;
      const col = columns.find((c) => c.id === owner);
      if (!col) continue;
      const due = effectiveDue(t, owner, scenario);
      col.tiles.push({ key: `${t.id}:0`, task: t, slot: 0, due, muted: false, overdue: isOverdue(due), others: [] });
    }
    for (const c of columns) finish(c);
    return { columns, tray: [], projectsInView: home };
  }

  const people = peopleFor(scenario, project);
  const columns: ColumnVM[] = people.map((p) => {
    const u = usualFor(p, mode);
    return {
      id: p.id,
      title: p.name,
      sub: p.role,
      initials: initials(p.name),
      person: p,
      usual: u.effective,
      usualFull: u.full,
      away: p.away && u.effective !== u.full ? p.away.label : null,
      tiles: [],
      count: 0,
      over: 0,
      room: 0,
      isYou: !!p.isYou,
    };
  });
  const tray: TileVM[] = [];

  for (const t of scenario.tasks) {
    if (t.due > end) continue;
    const owners = assign[t.id] ?? t.owners;
    const named = owners.filter((o): o is string => !!o);
    const muted = !home.includes(t.project);
    if (!named.length) {
      if (!muted) tray.push({ key: `${t.id}:0`, task: t, slot: 0, due: t.due, muted: false, overdue: isOverdue(t.due), others: [] });
      continue;
    }
    owners.forEach((o, slot) => {
      if (!o) return;
      const col = columns.find((c) => c.id === o);
      if (!col) return;
      col.tiles.push({
        key: `${t.id}:${slot}`,
        task: t,
        slot,
        due: t.due,
        muted,
        overdue: isOverdue(t.due),
        others: named.filter((n) => n !== o).map(nameOf),
      });
    });
  }
  for (const c of columns) finish(c);
  tray.sort((a, b) => a.due.localeCompare(b.due));
  return { columns, tray, projectsInView: home };
}

function finish(c: ColumnVM) {
  c.tiles.sort((a, b) => a.due.localeCompare(b.due) || a.task.id.localeCompare(b.task.id));
  c.count = c.tiles.length;
  c.over = c.usual === null ? 0 : Math.max(0, c.count - c.usual);
  c.room = c.usual === null ? 0 : Math.max(0, c.usual - c.count);
}

export const allUnder = (v: View) => {
  const judged = v.columns.filter((c) => c.usual !== null);
  return judged.length > 0 && judged.every((c) => c.count <= (c.usual ?? 0));
};

/* ── who can take what ─────────────────────────────────────────────── */

export function canTake(
  scenario: Scenario,
  assign: Assign,
  task: Task,
  slot: number,
  target: string | null,
): { ok: boolean; reason?: string } {
  const owners = assign[task.id] ?? task.owners;
  if (target !== null && owners[slot] === target) return { ok: false, reason: "Has it now" };
  if (target !== null && owners.includes(target)) return { ok: false, reason: "Already shares it" };
  if (scenario.id === "solo" || target === null) return { ok: true };
  const person = scenario.people.find((p) => p.id === target);
  if (!person) return { ok: false };
  if (!person.projects.includes(task.project)) {
    return { ok: false, reason: `Not on ${projectById(task.project).name}` };
  }
  return { ok: true };
}

/* ── balance it for me ─────────────────────────────────────────────── */

export type Proposal = { key: string; taskId: string; slot: number; from: string | null; to: string };

/** The fewest moves that bring people under their line: each move takes one
    thing off someone who is over, so the count equals the total overflow when
    there is room. Latest-due work moves first; people only get work from
    Projects they are on; nobody is pushed over their own line. */
export function proposeBalance(
  scenario: Scenario,
  view: View,
  assign: Assign,
): { proposals: Proposal[]; leftover: { name: string; over: number }[]; skippedNew: string[] } {
  const counts = new Map(view.columns.map((c) => [c.id, c.count]));
  const room = (c: ColumnVM) => (c.usual === null ? -1 : c.usual - (counts.get(c.id) ?? 0));
  const proposals: Proposal[] = [];
  const skippedNew = view.columns.filter((c) => c.usual === null && c.person).map((c) => c.title);

  const pick = (task: Task, slot: number, exclude: string | null) => {
    const options = view.columns
      .filter((c) => c.id !== exclude && room(c) > 0 && canTake(scenario, assign, task, slot, c.id).ok)
      .sort((a, b) => room(b) - room(a) || (counts.get(a.id) ?? 0) - (counts.get(b.id) ?? 0));
    return options[0] ?? null;
  };

  // Hand out the tray first when most things have no owner.
  if (scenario.id === "empty") {
    for (const t of view.tray) {
      const to = pick(t.task, t.slot, null);
      if (!to) continue;
      proposals.push({ key: t.key, taskId: t.task.id, slot: t.slot, from: null, to: to.id });
      counts.set(to.id, (counts.get(to.id) ?? 0) + 1);
    }
    return { proposals, leftover: [], skippedNew };
  }

  const over = [...view.columns].filter((c) => c.usual !== null && c.count > c.usual).sort((a, b) => b.over - a.over);
  for (const col of over) {
    const movable = [...col.tiles].reverse().filter((t) => !t.muted);
    for (const tile of movable) {
      if ((counts.get(col.id) ?? 0) <= (col.usual ?? 0)) break;
      const to = pick(tile.task, tile.slot, col.id);
      if (!to) continue;
      proposals.push({ key: tile.key, taskId: tile.task.id, slot: tile.slot, from: col.id, to: to.id });
      counts.set(col.id, (counts.get(col.id) ?? 0) - 1);
      counts.set(to.id, (counts.get(to.id) ?? 0) + 1);
    }
  }
  const leftover = over
    .map((c) => ({ name: c.title, over: (counts.get(c.id) ?? 0) - (c.usual ?? 0) }))
    .filter((l) => l.over > 0);
  return { proposals, leftover, skippedNew };
}

/* ── moves waiting to be applied ───────────────────────────────────── */

export type Move = { taskId: string; slot: number; title: string; from: string | null; to: string | null };

export function diffMoves(scenario: Scenario, base: Assign, cur: Assign): Move[] {
  const out: Move[] = [];
  for (const t of scenario.tasks) {
    const a = base[t.id] ?? [];
    const b = cur[t.id] ?? [];
    for (let i = 0; i < Math.max(a.length, b.length); i++) {
      if ((a[i] ?? null) !== (b[i] ?? null)) out.push({ taskId: t.id, slot: i, title: t.title, from: a[i] ?? null, to: b[i] ?? null });
    }
  }
  return out;
}

export function columnName(scenario: Scenario, id: string | null) {
  if (id === null) return "Nobody";
  if (scenario.id === "solo") return WEEK_NAMES[Number(id.slice(1))] ?? id;
  return scenario.people.find((p) => p.id === id)?.name ?? id;
}

/* ── the sentence at the top ───────────────────────────────────────── */

const verb = (p: Person | null) => (p?.pronoun === "they" ? "finish" : "finishes");
const pro = (p: Person | null) => p?.pronoun ?? "they";
const possessive = (p: Person | null) => (p?.pronoun === "he" ? "his" : p?.pronoun === "she" ? "her" : "their");

function ratioWords(count: number, usual: number) {
  const r = usual ? count / usual : 3;
  if (r >= 2.6) return "about three times what";
  if (r >= 1.75) return "about twice what";
  if (r >= 1.35) return "about half as much again as";
  return "a little more than";
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function list(names: string[]) {
  if (names.length <= 1) return names.join("");
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

export type Summary = { lead: string; rest: string };

export function summarize(scenario: Scenario, view: View, mode: Mode, moved: number): Summary {
  const span = mode === "week" ? "this week" : "over the next 3 weeks";
  const cols = view.columns;

  if (scenario.id === "empty") {
    const assigned = cols.reduce((n, c) => n + c.count, 0);
    if (view.tray.length > assigned) {
      return { lead: "Most tasks have no owner yet.", rest: "Hand them out to see who has what." };
    }
  }

  if (scenario.id === "solo") {
    const overs = cols.filter((c) => c.over > 0);
    const inSentence = (t: string) => (t.startsWith("Week of") ? `the ${t.toLowerCase().replace(" oct", " Oct")}` : t.toLowerCase());
    const roomy = cols.filter((c) => c.room >= 2).map((c) => inSentence(c.title));
    if (!overs.length) {
      return {
        lead: moved ? "Now every week is within your usual pace." : "Every week is within your usual pace.",
        rest: roomy.length ? `There is still room ${list(roomy)}.` : "",
      };
    }
    const top = [...overs].sort((a, b) => b.over - a.over)[0];
    return {
      lead: `${top.title} is fuller than usual: ${top.count} things against the ${top.usual} you usually finish in a week.`,
      rest: roomy.length ? `${cap(list(roomy))} ${roomy.length > 1 ? "have" : "has"} room.` : "",
    };
  }

  const overs = cols.filter((c) => c.over > 0).sort((a, b) => b.over - a.over);
  const roomy = cols.filter((c) => c.room >= (mode === "week" ? 1 : 2)).map((c) => c.title);
  const roomLine = roomy.length ? `${list(roomy)} ${roomy.length > 1 ? "have" : "has"} room.` : "Nobody has much room to take more.";

  if (!overs.length) {
    const lead = moved ? "Now nobody is over their usual pace." : "Nobody is over their usual pace.";
    return { lead, rest: roomy.length ? roomLine : "" };
  }
  const top = overs[0];
  if (top.away && mode === "three") {
    const lead = `${top.title} is away ${top.away.replace("Away ", "")}, so ${possessive(top.person)} ${top.count} things are ${top.over} more than ${pro(top.person)} usually ${verb(top.person)} in two weeks.`;
    return { lead, rest: roomLine };
  }
  const lead = `${top.title} has the most on: ${top.count} things ${span}, ${ratioWords(top.count, top.usual ?? 0)} ${pro(top.person)} usually ${verb(top.person)}.`;
  const others = overs.slice(1).map((c) => c.title);
  const also = others.length ? `${list(others)} ${others.length > 1 ? "are" : "is"} over too. ` : "";
  const awayNote = overs.find((c) => c.away);
  const away = awayNote && awayNote !== top ? ` ${awayNote.title} is away ${awayNote.away?.replace("Away ", "")}, so ${possessive(awayNote.person)} usual is lower.` : "";
  return { lead, rest: `${also}${roomLine}${away}`.trim() };
}

/** One line for another team's card. */
export function teamLine(scenario: Scenario, project: ProjectId) {
  const v = buildView(scenario, baseAssign(scenario), "three", project);
  const overs = v.columns.filter((c) => c.over > 0).sort((a, b) => b.over - a.over);
  if (!overs.length) return { view: v, line: "Everyone is within their usual pace." };
  const top = overs[0];
  if (top.away) return { view: v, line: `${top.title} is ${top.over} over, because ${pro(top.person)} is away ${top.away.replace("Away ", "")}.` };
  return { view: v, line: `${top.title} has ${ratioWords(top.count, top.usual ?? 0)} ${pro(top.person)} usually ${verb(top.person)}.` };
}

export const OTHER_TEAMS: ProjectId[] = ["riverside", "brightwater"];
export const projectName = (id: ProjectFilter) => (id === "all" ? "All Projects" : projectById(id).name);
export const PROJECT_OPTIONS: ProjectFilter[] = ["all", ...PROJECTS.map((p) => p.id)];
export { possessive, pro, verb };
