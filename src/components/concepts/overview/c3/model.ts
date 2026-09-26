import {
  CAUSES,
  DIMENSIONS,
  ORCHARD_STREAMS,
  PEOPLE,
  PROJECTS,
  trendFor,
  type Cell,
  type CellState,
  type DimId,
  type Fact,
  type Remedy,
  type Row,
  type Tone,
} from "./data";

export type Scope = "all" | "orchard";
export type Mark = "attention" | "watch" | "steady" | "new";

export type Selection = { kind: "cell"; key: string } | { kind: "person"; id: string } | null;

export type ViewCell = {
  key: string;
  rowId: string;
  dim: DimId;
  base: Cell;
  /** What the cell shows right now (after applied remedies, compare or preview). */
  tone: Tone;
  label: string;
  /** Today's state after applied remedies, before compare or preview. */
  now: CellState;
  /** Direction since last week: 1 worse, -1 better, 0 same. */
  moved: -1 | 0 | 1;
  previewing: boolean;
  changed: boolean;
  trend: number[] | null;
  /** The causes that apply today, after any applied remedy. */
  causes: string[];
};

export const keyOf = (rowId: string, dim: DimId) => `${rowId}:${dim}`;

export const level = (t: Tone) => (t === "early" ? 0 : t);

const CALM: Record<DimId, { label: string; why: string; facts: Fact[] }> = {
  schedule: {
    label: "On time",
    why: "Everything due in the next week has started, and nothing is past its date.",
    facts: [
      { kind: "metric", title: "Tasks due this week", meta: "All moving", status: "On time", tone: "good" },
      { kind: "metric", title: "Past their date", meta: "None", status: "Clear", tone: "good" },
      { kind: "metric", title: "Since Monday", meta: "No change of colour", status: "Steady", tone: "good" },
    ],
  },
  decisions: {
    label: "None waiting",
    why: "No one is waiting on a choice.",
    facts: [
      { kind: "metric", title: "Open questions", meta: "None", status: "Clear", tone: "good" },
      { kind: "decision", title: "Last choice made", meta: "Tuesday", status: "Settled", tone: "good" },
      { kind: "metric", title: "Since Monday", meta: "No change of colour", status: "Steady", tone: "good" },
    ],
  },
  workload: {
    label: "Even",
    why: "Work is spread evenly and everyone has room.",
    facts: [
      { kind: "metric", title: "Above their room", meta: "No one", status: "Clear", tone: "good" },
      { kind: "metric", title: "Unassigned", meta: "None", status: "Clear", tone: "good" },
      { kind: "metric", title: "Since Monday", meta: "No change of colour", status: "Steady", tone: "good" },
    ],
  },
  replies: {
    label: "All answered",
    why: "Clients and suppliers have answered everything sent this week.",
    facts: [
      { kind: "metric", title: "Waiting on a reply", meta: "None", status: "Clear", tone: "good" },
      { kind: "metric", title: "Quotes out", meta: "None over two days", status: "Clear", tone: "good" },
      { kind: "metric", title: "Since Monday", meta: "No change of colour", status: "Steady", tone: "good" },
    ],
  },
  momentum: {
    label: "Moving",
    why: "Tasks and files moved in the last seven days.",
    facts: [
      { kind: "metric", title: "Finished this week", meta: "Several tasks", status: "Moving", tone: "good" },
      { kind: "metric", title: "Longest wait", meta: "Under three days", status: "Fine", tone: "good" },
      { kind: "metric", title: "Since Monday", meta: "No change of colour", status: "Steady", tone: "good" },
    ],
  },
  files: {
    label: "All signed",
    why: "Nothing is waiting on sign-off.",
    facts: [
      { kind: "metric", title: "Waiting on sign-off", meta: "None", status: "Clear", tone: "good" },
      { kind: "metric", title: "Latest file", meta: "Updated this week", status: "Current", tone: "good" },
      { kind: "metric", title: "Since Monday", meta: "No change of colour", status: "Steady", tone: "good" },
    ],
  },
};

export function calmCell(base: Cell, dim: DimId): Cell {
  if (base.tone === "early") return base;
  const c = CALM[dim];
  return { ...base, tone: 0, label: c.label, why: c.why, facts: c.facts, last: { tone: 0, label: c.label }, causes: [], remedies: [] };
}

export const rowsFor = (scope: Scope) => (scope === "all" ? PROJECTS : ORCHARD_STREAMS);

const ALL_REMEDIES: Record<string, Remedy> = {};
for (const row of [...PROJECTS, ...ORCHARD_STREAMS]) {
  for (const dim of DIMENSIONS) for (const r of row.cells[dim.id].remedies) ALL_REMEDIES[r.id] = r;
}
export const remedyById = (id: string) => ALL_REMEDIES[id];

export function appliedCellStates(applied: string[]) {
  const out: Record<string, CellState> = {};
  for (const id of applied) Object.assign(out, ALL_REMEDIES[id]?.effect.cells ?? {});
  return out;
}

export function buildView(opts: {
  rows: Row[];
  calm: boolean;
  applied: string[];
  compare: boolean;
  preview: string | null;
}): ViewCell[][] {
  const appliedStates = appliedCellStates(opts.applied);
  const previewStates = opts.preview ? (ALL_REMEDIES[opts.preview]?.effect.cells ?? {}) : {};
  return opts.rows.map((row) =>
    DIMENSIONS.map((d) => {
      const key = keyOf(row.id, d.id);
      const base = opts.calm ? calmCell(row.cells[d.id], d.id) : row.cells[d.id];
      const now: CellState = appliedStates[key] ?? { tone: base.tone, label: base.label };
      const delta = level(now.tone) - level(base.last.tone);
      const moved = (delta > 0 ? 1 : delta < 0 ? -1 : 0) as -1 | 0 | 1;
      const prev = previewStates[key];
      const shown = opts.compare ? base.last : prev ?? now;
      return {
        key,
        rowId: row.id,
        dim: d.id,
        base,
        tone: shown.tone,
        label: shown.label,
        now,
        moved,
        previewing: !opts.compare && Boolean(prev),
        changed: Boolean(appliedStates[key]),
        trend: trendFor(key, base.last.tone, now.tone),
        causes: now.causes ?? base.causes,
      };
    }),
  );
}

export function markFor(cells: { tone: Tone }[]): Mark {
  const early = cells.filter((c) => c.tone === "early").length;
  if (early >= 4) return "new";
  const max = Math.max(...cells.map((c) => level(c.tone)));
  if (max >= 3) return "attention";
  if (max >= 2) return "watch";
  return "steady";
}

export { word };

export const MARK_LABEL: Record<Mark, string> = {
  attention: "Needs attention",
  watch: "Watch",
  steady: "Steady",
  new: "Just started",
};

export const TONE_LABEL = (t: Tone) =>
  t === "early" ? "Too early to say" : ["Steady", "Worth a look", "Watch", "Needs attention"][t];

const WORDS = ["No", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten"];
const word = (n: number, cap = false) => {
  const w = WORDS[n] ?? String(n);
  return cap ? w : w.toLowerCase();
};

export type VerdictPart = { text: string } | { dim: DimId; text: string } | { person: string; text: string };

/**
 * One scoring model for the verdict and "Where to look first", so the
 * sentence and the list can never disagree.
 * Pressure counts only cells at "watch" or warmer.
 */
export type Pressure = {
  dimSum: Partial<Record<DimId, number>>;
  topDim: DimId | undefined;
  topPerson: string | undefined;
  /** Cells worth a look, grouped by row, the verdict's subject first. */
  groups: { rowId: string; items: ViewCell[]; score: number }[];
};

export function pressure(view: ViewCell[][], toneOf: (c: ViewCell) => Tone = (c) => c.tone): Pressure {
  const dimSum: Partial<Record<DimId, number>> = {};
  const personSum: Record<string, number> = {};
  for (const row of view) {
    for (const c of row) {
      const l = level(toneOf(c));
      if (l < 2) continue;
      dimSum[c.dim] = (dimSum[c.dim] ?? 0) + l;
      for (const cause of c.causes) {
        const p = CAUSES[cause]?.person;
        if (p) personSum[p] = (personSum[p] ?? 0) + l;
      }
    }
  }
  const topDim = (Object.entries(dimSum) as [DimId, number][]).sort((x, y) => y[1] - x[1])[0]?.[0];
  const topPerson = Object.entries(personSum).sort((x, y) => y[1] - x[1])[0]?.[0];

  const score = (c: ViewCell) => level(toneOf(c)) * 100 + (c.dim === topDim ? 50 : 0) + (dimSum[c.dim] ?? 0) + c.moved;
  const groups = view
    .map((row) => {
      const items = row.filter((c) => level(toneOf(c)) >= 2).sort((a, b) => score(b) - score(a));
      return { rowId: row[0].rowId, items, score: items.reduce((n, c) => n + level(toneOf(c)), 0) };
    })
    .filter((g) => g.items.length);
  // The row holding the verdict's worst cell leads; the rest by total pressure.
  const lead = groups
    .flatMap((g) => g.items.filter((c) => c.dim === topDim).map((c) => ({ g, l: level(toneOf(c)) })))
    .sort((a, b) => b.l - a.l)[0]?.g;
  groups.sort((a, b) => (b === lead ? 1 : 0) - (a === lead ? 1 : 0) || b.score - a.score);
  return { dimSum, topDim, topPerson, groups };
}

/** The portfolio verdict as a sentence with a few interactive words. */
export function verdict(view: ViewCell[][], scope: Scope, compare: boolean): { parts: VerdictPart[]; calm: boolean; topDim?: DimId; attention: number } {
  const marks = view.map((row) => markFor(row.map((c) => ({ tone: c.tone }))));
  const count = (m: Mark) => marks.filter((x) => x === m).length;
  const noun = scope === "all" ? "project" : "workstream";
  const a = count("attention");
  const w = count("watch");
  const s = count("steady");
  const n = count("new");
  if (a === 0 && w === 0) {
    return {
      calm: true,
      attention: 0,
      parts: [
        { text: compare ? "Last week everything was steady." : "Everything is steady. Nothing has changed colour since Monday." },
      ],
    };
  }
  const bits: string[] = [];
  let first = true;
  const push = (k: number, one: string, many: string) => {
    if (!k) return;
    bits.push(`${word(k, first)} ${k === 1 ? one : many}`);
    first = false;
  };
  push(a, `${noun} needs attention`, `${noun}s need attention`);
  push(w, "to watch", "to watch");
  push(s, "steady", "steady");
  push(n, "just started", "just started");
  const joined = bits.length > 1 ? `${bits.slice(0, -1).join(", ")} and ${bits[bits.length - 1]}.` : `${bits[0]}.`;

  const { topDim, topPerson } = pressure(view);
  const parts: VerdictPart[] = [{ text: `${compare ? "Last week: " : ""}${compare ? joined.charAt(0).toLowerCase() + joined.slice(1) : joined} ` }];
  if (topDim) {
    parts.push({ text: compare ? "Most pressure was on " : "Most pressure is on " });
    parts.push({ dim: topDim, text: DIMENSIONS.find((d) => d.id === topDim)!.name.toLowerCase() });
    if (topPerson) {
      const person = PEOPLE.find((p) => p.id === topPerson)!;
      parts.push({ text: " and on " });
      parts.push({ person: topPerson, text: person.isYou ? "you" : person.name });
    }
    parts.push({ text: "." });
  }
  return { parts, calm: false, topDim, attention: a };
}

/** What a previewed remedy would change about the verdict, in one short line for the caption. */
export function previewClause(before: ReturnType<typeof verdict>, after: ReturnType<typeof verdict>, scope: Scope): string | null {
  const noun = scope === "all" ? "project" : "workstream";
  if (after.calm && !before.calm) return "everything would be steady.";
  if (after.attention !== before.attention) {
    const k = after.attention;
    return `${k === 0 ? "no" : word(k)} ${k === 1 ? `${noun} would need` : `${noun}s would need`} attention, down from ${word(before.attention)}.`;
  }
  if (after.topDim && after.topDim !== before.topDim) {
    return `${DIMENSIONS.find((d) => d.id === after.topDim)!.name.toLowerCase()} would become the main pressure.`;
  }
  return "the main pressure stays where it is.";
}

/** The one thing to look at first: the person behind the most pressure, and where it shows. */
export type Lead = {
  person: string;
  cause: string;
  cells: ViewCell[];
  projects: number;
};

export function leadDiagnosis(view: ViewCell[][]): Lead | null {
  const { topPerson } = pressure(view, (c) => c.now.tone);
  if (!topPerson) return null;
  const causeIds = Object.values(CAUSES)
    .filter((c) => c.person === topPerson)
    .map((c) => c.id);
  const cells = view
    .flat()
    .filter((c) => level(c.now.tone) >= 1 && c.causes.some((x) => causeIds.includes(x)))
    .sort((a, b) => level(b.now.tone) - level(a.now.tone));
  if (!cells.length) return null;
  return {
    person: topPerson,
    cause: CAUSES[causeIds[0]]?.label ?? topPerson,
    cells,
    projects: new Set(cells.map((c) => c.rowId)).size,
  };
}

/** How a cell moved between two states, judged on colour first and the number second. */
export function describeMove(last: CellState, now: CellState): { dir: -1 | 0 | 1; text: string } {
  const d = level(now.tone) - level(last.tone);
  if (last.tone === "early" || now.tone === "early") return { dir: 0, text: "Too early to compare" };
  if (d > 0) return { dir: 1, text: "Worse" };
  if (d < 0) return { dir: -1, text: "Better" };
  const num = (x: string) => {
    const m = x.match(/\d+/);
    return m ? { n: Number(m[0]), shape: x.replace(m[0], "#") } : null;
  };
  const a = num(last.label);
  const b = num(now.label);
  if (a && b && a.shape === b.shape && a.n !== b.n) {
    const diff = Math.abs(b.n - a.n);
    const unit = a.shape.includes("#%") ? (diff === 1 ? " point" : " points") : "";
    return { dir: 0, text: `${b.n > a.n ? "Up" : "Down"} ${diff}${unit}, same colour` };
  }
  return { dir: 0, text: last.label === now.label ? "No change" : "Same colour" };
}

/** Cells that share a cause with the selection. */
export function relatedKeys(view: ViewCell[][], selection: Selection): Set<string> {
  const out = new Set<string>();
  if (!selection) return out;
  let causes: string[] = [];
  if (selection.kind === "cell") {
    const cell = view.flat().find((c) => c.key === selection.key);
    causes = cell?.causes ?? [];
  } else {
    causes = Object.values(CAUSES)
      .filter((c) => c.person === selection.id)
      .map((c) => c.id);
  }
  if (!causes.length) return out;
  for (const c of view.flat()) {
    if (selection.kind === "cell" && c.key === selection.key) continue;
    if (level(c.now.tone) < 1) continue;
    if (c.causes.some((x) => causes.includes(x))) out.add(c.key);
  }
  return out;
}

export function sharedCauses(a: Cell, b: Cell) {
  return a.causes.filter((c) => b.causes.includes(c)).map((c) => CAUSES[c]?.label ?? c);
}

export function peopleFor(causes: string[]) {
  return new Set(causes.map((c) => CAUSES[c]?.person).filter(Boolean) as string[]);
}
