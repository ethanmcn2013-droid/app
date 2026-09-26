import {
  CLEAN_STANDING,
  HARVEST_TASKS,
  MILESTONES,
  STANDING,
  TASKS,
  TODAY,
  type Choice,
  type Decision,
  type PersonId,
  type ProjectId,
  type ProjectTask,
  type Track,
} from "./data";

export type Outcome =
  | { type: "decided"; choice: number; at: string }
  | { type: "deferred"; option: number; at: string }
  | { type: "moot"; at: string; by: PersonId; text: string };

export type Outcomes = Record<string, Outcome>;

export type Loads = Partial<Record<PersonId, number>>;

export type ResolvedTrack = Track & {
  baseStart: number;
  baseEnd: number;
  baseOwner: PersonId;
  moved: boolean;
  reassigned: boolean;
  added: boolean;
  /** Where the track could slip to if the risk this call leaves open lands. */
  riskEnd?: number;
};

export type LoadRow = { person: PersonId; before: number; after: number };

const ALL_TASKS = [...TASKS, ...HARVEST_TASKS];

/* Change in open tasks per person for one choice, including the tasks it finishes. */
export function loadDelta(choice: Choice | undefined): Loads {
  const out: Loads = { ...(choice?.load ?? {}) };
  for (const id of choice?.completes ?? []) {
    const t = ALL_TASKS.find((x) => x.id === id);
    if (t) out[t.owner] = (out[t.owner] ?? 0) - 1;
  }
  return out;
}

/* The future a choice produces, relative to the decision's current state. */
export function project(decision: Decision, choice: Choice | undefined, loads: Loads) {
  const tracks: ResolvedTrack[] = decision.tracks.map((t) => {
    const end = choice?.moves?.[t.id] ?? t.end;
    const shift = end - t.end;
    const owner = choice?.owners?.[t.id] ?? t.owner;
    // Work already under way keeps its start; only the finish moves.
    const start = t.start < TODAY && !t.milestone ? t.start : t.start + shift;
    return {
      ...t,
      start,
      end,
      owner,
      baseStart: t.start,
      baseEnd: t.end,
      baseOwner: t.owner,
      moved: shift !== 0,
      reassigned: owner !== t.owner,
      added: false,
      riskEnd: choice?.risk?.[t.id],
    };
  });
  for (const a of choice?.adds ?? []) {
    tracks.push({ ...a, baseStart: a.start, baseEnd: a.end, baseOwner: a.owner, moved: false, reassigned: false, added: true });
  }
  const delta = loadDelta(choice);
  const people = [...decision.people];
  for (const k of Object.keys(delta) as PersonId[]) if (!people.includes(k)) people.push(k);
  const load: LoadRow[] = people.map((p) => {
    const before = loads[p] ?? 0;
    return { person: p, before, after: before + (delta[p] ?? 0) };
  });
  return { tracks, load };
}

/* ── the date a choice protects ─────────────────────────────────────── */

export type VerdictKind = "holds" | "tight" | "miss" | "moved";

export type Verdict = {
  kind: VerdictKind;
  /** Short state, for chips: "Kitchen trial holds". */
  chip: string;
  /** The distance, for the chart and the choice rows: "5 days to spare". */
  gap: string;
  slack?: number;
  /** The worst-case day the driver finishes, where the gap starts. */
  from?: number;
  guardDay: number;
  guardBase: number;
  driver: string | null;
  risky: boolean;
};

export function verdictFor(decision: Decision, choice: Choice, tracks?: ResolvedTrack[]): Verdict {
  const g = decision.guard;
  const ts = tracks ?? project(decision, choice, {}).tracks;
  const guard = ts.find((t) => t.id === g.track)!;
  const driverId = choice.driver === undefined ? g.driver : choice.driver;
  const base = { guardDay: guard.end, guardBase: guard.baseEnd, driver: driverId };
  if (guard.moved) {
    const n = guard.end - guard.baseEnd;
    return {
      ...base,
      kind: "moved",
      chip: `${g.short} moves`,
      gap: `${g.short} moves ${n > 0 ? `${n} days later` : `${-n} days earlier`}`,
      risky: false,
    };
  }
  const d = driverId ? ts.find((t) => t.id === driverId) : undefined;
  if (!d) {
    return { ...base, kind: "holds", chip: `${g.short} holds`, gap: "Nothing blocks it now", risky: false };
  }
  const risky = d.riskEnd !== undefined && d.riskEnd > d.end;
  const worst = risky ? (d.riskEnd as number) : d.end;
  const slack = guard.end - worst;
  const word = g.word ?? "to spare";
  const days = `${slack} ${Math.abs(slack) === 1 ? "day" : "days"}`;
  if (slack <= 0) {
    const late = slack === 0 ? "No days to spare" : `${-slack} ${slack === -1 ? "day" : "days"} too late`;
    return { ...base, kind: "miss", chip: `${g.short} would slip`, gap: late, slack, from: worst, risky };
  }
  const kind: VerdictKind = slack >= g.comfortable ? "holds" : "tight";
  return {
    ...base,
    kind,
    chip: kind === "holds" ? `${g.short} holds` : `${g.short} is tight`,
    gap: `${days} ${word}${risky ? " if it slips" : ""}`,
    slack,
    from: worst,
    risky,
  };
}

/*
 * The date axis runs from just before today to just past the protected date,
 * the same window for every choice on a card, so arrowing between choices
 * never rescales it. Anything later is listed under the chart.
 */
export function fitAxis(decision: Decision): [number, number] {
  const lo = TODAY - 3;
  let hi = TODAY;
  for (const c of decision.choices) {
    const g = c.moves?.[decision.guard.track] ?? decision.tracks.find((t) => t.id === decision.guard.track)!.end;
    hi = Math.max(hi, g);
  }
  hi += 2;
  if (hi - lo < 11) hi = lo + 11;
  return [lo, hi];
}

/* ── the whole picture ─────────────────────────────────────────────── */

export type ProjectState = {
  done: number;
  review: number;
  progress: number;
  todo: number;
  open: number;
  total: number;
  pct: number;
  load: Loads;
};

/* Every decided call, folded into each project's counts and each person's open tasks. */
export function standing(decisions: Decision[], outcomes: Outcomes, clean: boolean) {
  const base = clean ? CLEAN_STANDING : STANDING;
  const out = {} as Record<ProjectId, ProjectState>;
  for (const id of Object.keys(base) as ProjectId[]) {
    const b = base[id];
    let done = b.done;
    let review = b.review;
    let progress = b.progress;
    const load: Loads = { ...b.load };
    for (const d of decisions) {
      const o = outcomes[d.id];
      if (d.project !== id || o?.type !== "decided") continue;
      const c = d.choices[o.choice];
      for (const [p, n] of Object.entries(loadDelta(c)) as [PersonId, number][]) load[p] = (load[p] ?? 0) + n;
      for (const tid of c.completes ?? []) {
        const t = ALL_TASKS.find((x) => x.id === tid);
        done += 1;
        if (t?.status === "review") review -= 1;
        else progress -= 1;
      }
    }
    const open = Object.values(load).reduce((a, n) => a + (n ?? 0), 0);
    const total = done + open;
    out[id] = { done, review, progress, todo: open - review - progress, open, total, pct: Math.round((done / total) * 100), load };
  }
  return out;
}

/* Open tasks per person across the projects in view. */
export function loadsFor(state: Record<ProjectId, ProjectState>, projects: ProjectId[]): Loads {
  const out: Loads = {};
  for (const p of projects)
    for (const [k, n] of Object.entries(state[p].load) as [PersonId, number][]) out[k] = (out[k] ?? 0) + n;
  return out;
}

export type OverviewItem = {
  id: string;
  title: string;
  due: number;
  owner?: PersonId;
  baseDue: number;
  moved: boolean;
  newOwner: boolean;
  added: boolean;
  milestone: boolean;
  project: ProjectId;
};

/* Fold every decided call into the dated task list. */
export function applyOutcomes(decisions: Decision[], outcomes: Outcomes, tasks: ProjectTask[] = TASKS) {
  const moves: Record<string, number> = {};
  const owners: Record<string, PersonId> = {};
  const adds: (Track & { project: ProjectId })[] = [];
  const completed = new Set<string>();
  for (const d of decisions) {
    const o = outcomes[d.id];
    if (!o || o.type !== "decided") continue;
    const c = d.choices[o.choice];
    Object.assign(moves, c.moves ?? {});
    Object.assign(owners, c.owners ?? {});
    adds.push(...(c.adds ?? []).map((a) => ({ ...a, project: d.project })));
    for (const id of c.completes ?? []) completed.add(id);
  }
  // A track and a task can share an id (the olive order, the tasting); the call's new date applies to both.
  const taskDue = (t: ProjectTask) => moves[t.id] ?? t.due;
  const items: OverviewItem[] = [
    ...tasks.filter((t) => t.status !== "done" && !completed.has(t.id)).map((t) => ({
      id: t.id,
      title: t.title,
      due: taskDue(t),
      baseDue: t.due,
      owner: owners[t.id] ?? t.owner,
      moved: taskDue(t) !== t.due,
      newOwner: owners[t.id] !== undefined && owners[t.id] !== t.owner,
      added: false,
      milestone: false,
      project: t.project ?? ("orchard" as ProjectId),
    })),
    ...MILESTONES.map((m) => ({
      id: m.id,
      title: m.title,
      due: m.due,
      baseDue: m.due,
      moved: false,
      newOwner: false,
      added: false,
      milestone: true,
      project: "orchard" as ProjectId,
    })),
    ...adds.map((a) => ({
      id: a.id,
      title: a.label,
      due: a.end,
      baseDue: a.end,
      owner: a.owner,
      moved: false,
      newOwner: false,
      added: true,
      milestone: !!a.milestone,
      project: a.project,
    })),
  ];
  items.sort((a, b) => a.due - b.due || a.title.localeCompare(b.title));
  const tasting = moves.tasting ?? 32;
  return {
    soon: items.filter((i) => i.due < TODAY + 14),
    later: items.filter((i) => i.due >= TODAY + 14),
    tasting,
    completed,
  };
}

export function clockAt(n: number) {
  const m = 4 + n * 1;
  return `09:${String(m).padStart(2, "0")}`;
}
