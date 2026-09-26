import {
  AMBIGUITIES,
  ANSWERS,
  LOCKED_HINTS,
  NEAR,
  PEOPLE,
  PROJECTS,
  TODAY,
  type Ambiguity,
  type Answer,
  type FileItem,
  type Kind,
  type PersonId,
  type ProjectId,
} from "./data";

/* ── Tokens ─────────────────────────────────────────────────────── */

export type PillKey =
  "person" | "state" | "project" | "type" | "source" | "flag" | "task" | "has";
export type Pill = { key: PillKey; value: string };

export const PILL_NAMES: Record<PillKey, string> = {
  person: "Person",
  state: "State",
  project: "Project",
  type: "Type",
  source: "Source",
  flag: "Only",
  task: "Task",
  has: "Reads",
};

const STATE_LABEL: Record<string, string> = {
  approved: "Approved",
  signed: "Signed",
  draft: "Draft",
  awaiting: "Waiting for approval",
};
const TYPE_LABEL: Record<string, string> = {
  doc: "Documents",
  pdf: "PDFs",
  sheet: "Sheets",
  image: "Images",
  design: "Designs",
  link: "Links",
};
const SOURCE_LABEL: Record<string, string> = {
  drive: "Google Drive",
  upload: "Uploaded",
  link: "Links",
};
const FLAG_LABEL: Record<string, string> = {
  week: "Needed this week",
  shared: "Shared with clients",
};
const TASK_LABEL: Record<string, string> = {
  linked: "On a task",
  missing: "Missing a task",
};

export function pillLabel(p: Pill): string {
  switch (p.key) {
    case "person":
      return PEOPLE.find((x) => x.id === p.value)?.first ?? p.value;
    case "project":
      return PROJECTS.find((x) => x.id === p.value)?.short ?? p.value;
    case "state":
      return STATE_LABEL[p.value] ?? p.value;
    case "type":
      return TYPE_LABEL[p.value] ?? p.value;
    case "source":
      return SOURCE_LABEL[p.value] ?? p.value;
    case "flag":
      return FLAG_LABEL[p.value] ?? p.value;
    case "task":
      return TASK_LABEL[p.value] ?? p.value;
    case "has":
      return "Text in images";
  }
}

export const samePill = (a: Pill, b: Pill) =>
  a.key === b.key && a.value === b.value;

function findPerson(word: string): PersonId | null {
  const w = word.toLowerCase();
  if (w.length < 2) return null;
  const hit = PEOPLE.find(
    (p) =>
      p.id === w ||
      p.first.toLowerCase() === w ||
      p.name.toLowerCase().startsWith(w),
  );
  return hit && hit.id !== "you"
    ? hit.id
    : w === "me" || w === "you"
      ? "you"
      : null;
}

function findProject(word: string): ProjectId | null {
  const w = word.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (w.length < 2) return null;
  const hit = PROJECTS.find(
    (p) =>
      p.id === w ||
      p.name
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "")
        .includes(w),
  );
  return hit?.id ?? null;
}

const TYPE_WORDS: Record<string, string> = {
  doc: "doc",
  docs: "doc",
  document: "doc",
  documents: "doc",
  pdf: "pdf",
  pdfs: "pdf",
  sheet: "sheet",
  sheets: "sheet",
  spreadsheet: "sheet",
  spreadsheets: "sheet",
  image: "image",
  images: "image",
  photo: "image",
  photos: "image",
  pictures: "image",
  design: "design",
  designs: "design",
  figma: "design",
  link: "link",
  links: "link",
};
const BARE_TYPE = new Set([
  "images",
  "photos",
  "pictures",
  "sheets",
  "spreadsheets",
  "pdfs",
  "designs",
]);

const STATE_WORDS: Record<string, string> = {
  approved: "approved",
  signed: "signed",
  draft: "draft",
  drafts: "draft",
  awaiting: "awaiting",
  waiting: "awaiting",
  pending: "awaiting",
};
const BARE_STATE = new Set(["approved", "signed", "drafts", "unapproved"]);

function readOperator(op: string, val: string): Pill | null {
  const v = val.toLowerCase();
  switch (op) {
    case "from":
    case "by":
    case "who":
    case "person": {
      const p = findPerson(v);
      return p ? { key: "person", value: p } : null;
    }
    case "in":
    case "project": {
      const p = findProject(v);
      return p ? { key: "project", value: p } : null;
    }
    case "type":
    case "kind":
      return TYPE_WORDS[v] ? { key: "type", value: TYPE_WORDS[v] } : null;
    case "source":
      if (v.startsWith("drive") || v === "google")
        return { key: "source", value: "drive" };
      if (v.startsWith("upload")) return { key: "source", value: "upload" };
      if (v.startsWith("link")) return { key: "source", value: "link" };
      return null;
    case "is":
    case "state":
      if (STATE_WORDS[v]) return { key: "state", value: STATE_WORDS[v] };
      if (["this-week", "week", "due", "soon"].includes(v))
        return { key: "flag", value: "week" };
      if (["shared", "clients", "client"].includes(v))
        return { key: "flag", value: "shared" };
      if (["no-task", "notask", "untasked", "loose"].includes(v))
        return { key: "task", value: "missing" };
      if (["tasked", "on-task", "linked"].includes(v))
        return { key: "task", value: "linked" };
      return null;
    case "has":
      return /^(text|ocr|image|words)/.test(v)
        ? { key: "has", value: "ocr" }
        : null;
  }
  return null;
}

/** Operator keys we understand. A word like "from:" or "in:orc" is a filter being typed, never a search word. */
const OPERATOR_WORD =
  /^(from|by|who|person|in|project|type|kind|is|state|source|has):\S*$/i;

export const OPERATORS = ["from", "in", "type", "is", "source"] as const;

/** Completion suggestions for the word being typed, when it starts with an operator. */
export function completions(
  word: string,
): { token: string; pill: Pill; hint: string }[] {
  const m = /^(from|by|in|type|is|source|has):(.*)$/i.exec(word);
  if (!m) return [];
  const op = m[1].toLowerCase();
  const v = m[2].toLowerCase();
  const out: { token: string; pill: Pill; hint: string }[] = [];
  if (op === "from" || op === "by") {
    for (const p of PEOPLE) {
      if (p.id === "you") continue;
      if (
        !v ||
        p.first.toLowerCase().startsWith(v) ||
        p.name.toLowerCase().includes(v)
      )
        out.push({
          token: `from:${p.first.toLowerCase()}`,
          pill: { key: "person", value: p.id },
          hint: p.role,
        });
    }
  } else if (op === "in") {
    for (const p of PROJECTS) {
      if (!v || p.name.toLowerCase().includes(v))
        out.push({
          token: `in:${p.id}`,
          pill: { key: "project", value: p.id },
          hint: p.name,
        });
    }
  } else if (op === "type") {
    for (const k of Object.keys(TYPE_LABEL)) {
      if (!v || k.startsWith(v))
        out.push({
          token: `type:${k}`,
          pill: { key: "type", value: k },
          hint: TYPE_LABEL[k],
        });
    }
  } else if (op === "is") {
    const opts: [string, Pill][] = [
      ["approved", { key: "state", value: "approved" }],
      ["signed", { key: "state", value: "signed" }],
      ["draft", { key: "state", value: "draft" }],
      ["awaiting", { key: "state", value: "awaiting" }],
      ["this-week", { key: "flag", value: "week" }],
      ["shared", { key: "flag", value: "shared" }],
      ["no-task", { key: "task", value: "missing" }],
    ];
    for (const [t, pill] of opts)
      if (!v || t.startsWith(v))
        out.push({ token: `is:${t}`, pill, hint: pillLabel(pill) });
  } else if (op === "has") {
    if (!v || "text-in-images".startsWith(v) || "ocr".startsWith(v))
      out.push({
        token: "has:text-in-images",
        pill: { key: "has", value: "ocr" },
        hint: "Also read the words in photos, sketches and scans",
      });
  } else if (op === "source") {
    for (const k of Object.keys(SOURCE_LABEL)) {
      if (!v || k.startsWith(v))
        out.push({
          token: `source:${k}`,
          pill: { key: "source", value: k },
          hint: SOURCE_LABEL[k],
        });
    }
  }
  return out.slice(0, 7);
}

/**
 * Turns finished words into pills. The word still being typed stays text
 * unless `finalize` is set (a pasted or clicked query).
 */
export function parse(
  raw: string,
  finalize = false,
): { pills: Pill[]; text: string } {
  const endsOpen = !finalize && !/\s$/.test(raw);
  const words = raw.split(/\s+/).filter(Boolean);
  const pills: Pill[] = [];
  const keep: string[] = [];
  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    const isLast = i === words.length - 1;
    if (isLast && endsOpen) {
      keep.push(w);
      break;
    }
    const lw = w.toLowerCase().replace(/[?,.]+$/, "");
    const op = /^([a-z]+):(.+)$/.exec(lw);
    if (op) {
      const pill = readOperator(op[1], op[2]);
      if (pill) {
        pills.push(pill);
        continue;
      }
    }
    // "from Mara", "by Dev": natural phrasing, once the name is finished.
    if ((lw === "from" || lw === "by") && i + 1 < words.length) {
      const nextIsOpen = i + 1 === words.length - 1 && endsOpen;
      const p = nextIsOpen
        ? null
        : findPerson(words[i + 1].replace(/[?,.]+$/, ""));
      if (p && p !== "you") {
        pills.push({ key: "person", value: p });
        i++;
        continue;
      }
    }
    if (BARE_STATE.has(lw) && STATE_WORDS[lw]) {
      pills.push({ key: "state", value: STATE_WORDS[lw] });
      continue;
    }
    if (BARE_TYPE.has(lw)) {
      pills.push({ key: "type", value: TYPE_WORDS[lw] });
      continue;
    }
    keep.push(w);
  }
  const text = keep.join(" ") + (endsOpen || keep.length === 0 ? "" : " ");
  return { pills, text: finalize ? keep.join(" ") : text };
}

export function tokenFor(p: Pill): string {
  switch (p.key) {
    case "person":
      return `from:${pillLabel(p).toLowerCase()}`;
    case "project":
      return `in:${p.value}`;
    case "type":
      return `type:${p.value}`;
    case "source":
      return `source:${p.value}`;
    case "state":
      return `is:${p.value}`;
    case "flag":
      return p.value === "week" ? "is:this-week" : "is:shared";
    case "task":
      return p.value === "missing" ? "is:no-task" : "is:tasked";
    case "has":
      return "has:text-in-images";
  }
}

/* ── Matching ───────────────────────────────────────────────────── */

const STOP = new Set(
  "a an the of is are was were what whats how much many when where who which does do did for to in on at and or me my i we our it its now latest newest newer show find get file files any there with about can could will would that this has have been be should they them their us please".split(
    " ",
  ),
);

export function words(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/[’']/g, "")
    .split(/[^\p{L}\p{N}#]+/u)
    .filter(Boolean);
}

export type Query = {
  raw: string;
  text: string;
  pills: Pill[];
  terms: string[];
  all: string[];
  question: boolean;
  wantsLatest: boolean;
};

export function makeQuery(text: string, pills: Pill[]): Query {
  // Half-typed or unknown operators ("from:", "in:orc") are filters in progress, not words to match.
  const plain = text
    .split(/\s+/)
    .filter((w) => !OPERATOR_WORD.test(w))
    .join(" ");
  const all = words(plain);
  const terms = all.filter(
    (w) => !STOP.has(w) && (w.length > 1 || /\d/.test(w)),
  );
  const first = all[0] ?? "";
  const question =
    /\?\s*$/.test(text) ||
    [
      "how",
      "what",
      "whats",
      "when",
      "where",
      "who",
      "which",
      "does",
      "did",
      "can",
      "is",
      "are",
    ].includes(first);
  return {
    raw: text,
    text: text.trim(),
    pills,
    terms,
    all: [...all, ...pills.map((p) => pillLabel(p).toLowerCase())],
    question,
    wantsLatest:
      all.includes("latest") ||
      all.includes("newest") ||
      all.includes("current"),
  };
}

const wordMatches = (w: string, t: string) =>
  w === t || (t.length >= 2 && w.startsWith(t));

function fieldHas(text: string, t: string) {
  return words(text).some((w) => wordMatches(w, t));
}

export function passes(f: FileItem, pills: Pill[]): boolean {
  const groups = new Map<PillKey, string[]>();
  for (const p of pills)
    groups.set(p.key, [...(groups.get(p.key) ?? []), p.value]);
  for (const [key, vals] of groups) {
    if (key === "has") continue;
    const ok = vals.some((v) => {
      switch (key) {
        case "person":
          return f.by === v || f.approvedBy === v;
        case "project":
          return f.project === v;
        case "state":
          return f.state === v;
        case "type":
          return v === "doc"
            ? f.kind === "doc" || f.kind === "pdf"
            : f.kind === (v as Kind);
        case "source":
          return f.source === v;
        case "flag":
          return v === "week" ? !!f.due : !!f.shared;
        case "task":
          return v === "missing" ? !f.task : !!f.task;
        default:
          return true;
      }
    });
    if (!ok) return false;
  }
  return true;
}

export type Hit = {
  file: FileItem;
  score: number;
  inName: boolean;
  para: number;
  inOcr: boolean;
  matched: string[];
};

export function latestIn(files: FileItem[], f: FileItem): FileItem {
  if (!f.series) return f;
  return (
    files
      .filter((x) => x.series === f.series)
      .sort((a, b) => (b.v ?? 0) - (a.v ?? 0))[0] ?? f
  );
}

export function isLatest(files: FileItem[], f: FileItem) {
  return latestIn(files, f).id === f.id;
}

export function search(
  files: FileItem[],
  q: Query,
  opts: { ocr: boolean },
): Hit[] {
  const out: Hit[] = [];
  for (const f of files) {
    if (!passes(f, q.pills)) continue;
    if (q.terms.length === 0) {
      out.push({
        file: f,
        score: 0,
        inName: false,
        para: -1,
        inOcr: false,
        matched: [],
      });
      continue;
    }
    let score = 0;
    let inName = false;
    let inOcr = false;
    const matched: string[] = [];
    const paraScore = f.body.map(() => 0);
    const projectName = PROJECTS.find((p) => p.id === f.project)?.name ?? "";
    for (const t of q.terms) {
      let hit = false;
      if (fieldHas(f.name, t)) {
        score += 6;
        inName = true;
        hit = true;
      }
      f.body.forEach((para, i) => {
        if (fieldHas(para, t)) {
          paraScore[i] += 1;
          hit = true;
        }
      });
      if (opts.ocr && f.ocr && fieldHas(f.ocr, t)) {
        score += 3;
        inOcr = true;
        hit = true;
      }
      if (
        !hit &&
        (fieldHas(projectName, t) || (f.task && fieldHas(f.task, t)))
      ) {
        score += 1;
        hit = true;
      }
      if (hit) matched.push(t);
    }
    const need =
      q.terms.length <= 2 ? q.terms.length : Math.ceil(q.terms.length * 0.6);
    if (matched.length < need) continue;
    const best = paraScore.reduce((bi, s, i, arr) => (s > arr[bi] ? i : bi), 0);
    score += paraScore.reduce((a, s) => a + s * 2, 0);
    if (isLatest(files, f)) score += 1.5;
    score += recency(f.date);
    out.push({
      file: f,
      score,
      inName,
      para: paraScore[best] > 0 ? best : -1,
      inOcr,
      matched,
    });
  }
  out.sort(
    (a, b) => b.score - a.score || b.file.date.localeCompare(a.file.date),
  );
  if (q.terms.length === 0)
    out.sort((a, b) => b.file.date.localeCompare(a.file.date));
  return out;
}

function recency(date: string) {
  const days = (Date.parse(TODAY) - Date.parse(date)) / 864e5;
  return Math.max(0, 1 - days / 60);
}

export type Group = { id: string; title: string; hits: Hit[] };

export function groupHits(files: FileItem[], hits: Hit[], q: Query): Group[] {
  const older = hits.filter((h) => !isLatest(files, h.file));
  const current = hits.filter((h) => isLatest(files, h.file));
  const groups: Group[] = [];
  if (q.terms.length === 0) {
    const week = current.filter((h) => h.file.date >= "2026-09-21");
    const month = current.filter(
      (h) => h.file.date < "2026-09-21" && h.file.date >= "2026-09-01",
    );
    const before = current.filter((h) => h.file.date < "2026-09-01");
    if (week.length)
      groups.push({ id: "week", title: "This week", hits: week });
    if (month.length)
      groups.push({ id: "month", title: "Earlier in September", hits: month });
    if (before.length)
      groups.push({ id: "before", title: "Before that", hits: before });
  } else {
    let best = current.filter((h) => h.inName);
    if (best.length === 0) best = current.slice(0, Math.min(2, current.length));
    best = best.slice(0, 4);
    const rest = current.filter((h) => !best.includes(h));
    if (best.length)
      groups.push({ id: "best", title: "Best match", hits: best });
    if (rest.length)
      groups.push({ id: "also", title: "Also mentions", hits: rest });
  }
  if (older.length)
    groups.push({ id: "older", title: "Older versions", hits: older });
  return groups;
}

/* ── Answers ────────────────────────────────────────────────────── */

const loose = (u: string, g: string) =>
  u === g ||
  (u.length >= 3 && g.startsWith(u)) ||
  (g.length >= 4 && u.startsWith(g));

function ruleMatches(when: string[][], all: string[]) {
  return when.every((group) => group.some((g) => all.some((u) => loose(u, g))));
}

export type Resolution =
  | {
      kind: "answer";
      answer: Answer;
      file: FileItem;
      other?: { amb: string; i: number; label: string };
    }
  | { kind: "ambiguous"; amb: Ambiguity }
  | { kind: "locked"; file: FileItem; sentence: string }
  | { kind: "passage"; hit: Hit }
  | { kind: "none" };

export function resolve(
  files: FileItem[],
  q: Query,
  hits: Hit[],
  picked: Record<string, number>,
): Resolution {
  if (q.terms.length === 0) return { kind: "none" };
  for (const amb of AMBIGUITIES) {
    if (!ruleMatches(amb.when, q.all)) continue;
    const projectPills = q.pills
      .filter((p) => p.key === "project")
      .map((p) => p.value);
    const viable = amb.options
      .map((o, i) => ({ o, i }))
      .filter(
        ({ o }) =>
          projectPills.length === 0 || projectPills.includes(o.project),
      );
    const choice = picked[amb.id];
    const chosen =
      choice !== undefined
        ? amb.options[choice]
        : viable.length === 1
          ? viable[0].o
          : null;
    if (chosen) {
      const file = files.find((f) => f.id === chosen.file);
      // Picked by hand: keep the other reading one click away.
      const otherIdx =
        choice !== undefined ? amb.options.findIndex((o) => o !== chosen) : -1;
      if (file)
        return {
          kind: "answer",
          answer: {
            id: `${amb.id}-${chosen.project}`,
            when: [],
            sentence: chosen.sentence,
            strong: chosen.strong,
            file: chosen.file,
            passage: chosen.passage,
            marks: chosen.marks,
          },
          file,
          other:
            otherIdx >= 0
              ? { amb: amb.id, i: otherIdx, label: amb.options[otherIdx].label }
              : undefined,
        };
    }
    if (viable.length > 1) return { kind: "ambiguous", amb };
  }
  for (const hint of LOCKED_HINTS) {
    if (ruleMatches(hint.when, q.all)) {
      const file = files.find((f) => f.id === hint.file);
      if (file && passes(file, q.pills))
        return { kind: "locked", file, sentence: hint.sentence };
    }
  }
  for (const a of ANSWERS) {
    if (!ruleMatches(a.when, q.all)) continue;
    const file = files.find((f) => f.id === a.file);
    if (file && passes(file, q.pills))
      return { kind: "answer", answer: a, file };
  }
  const top = hits[0];
  if (top && top.para >= 0 && isLatest(files, top.file) && !top.file.lockedIn)
    return { kind: "passage", hit: top };
  return { kind: "none" };
}

/* ── Recovery for empty results ─────────────────────────────────── */

function lev(a: string, b: string) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [
    i,
    ...Array(b.length).fill(0),
  ]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      d[i][j] = Math.min(
        d[i - 1][j] + 1,
        d[i][j - 1] + 1,
        d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
  return d[a.length][b.length];
}

export function nearMiss(files: FileItem[], q: Query): FileItem | null {
  for (const t of q.terms) {
    const id = NEAR[t];
    if (id) return files.find((f) => f.id === id) ?? null;
  }
  let best: { f: FileItem; d: number } | null = null;
  for (const f of files) {
    if (!isLatest(files, f)) continue;
    for (const w of words(f.name)) {
      for (const t of q.terms) {
        if (t.length < 4) continue;
        const d = lev(t, w);
        if (d <= 2 && (!best || d < best.d)) best = { f, d };
      }
    }
  }
  return best?.f ?? null;
}

/* ── Text helpers ───────────────────────────────────────────────── */

export type Seg = { t: string; m: boolean };

function escape(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Splits text into marked and unmarked runs. Phrases match exactly; single words match as prefixes. */
export function marksIn(text: string, marks: string[]): Seg[] {
  const parts = marks
    .filter((m) => m.trim().length > 0)
    .sort((a, b) => b.length - a.length)
    .map((m) =>
      /\s|\d/.test(m) || m.length > 12
        ? escape(m)
        : `${escape(m)}[\\p{L}\\p{N}]*`,
    );
  if (parts.length === 0) return [{ t: text, m: false }];
  const re = new RegExp(`(?<![\\p{L}\\p{N}])(${parts.join("|")})`, "giu");
  const out: Seg[] = [];
  let last = 0;
  for (const match of text.matchAll(re)) {
    const i = match.index ?? 0;
    if (i > last) out.push({ t: text.slice(last, i), m: false });
    out.push({ t: match[0], m: true });
    last = i + match[0].length;
  }
  if (last < text.length) out.push({ t: text.slice(last), m: false });
  return out;
}

/** A window of the text around the first mark, so every snippet shows its reason. */
export function clip(text: string, marks: string[], max = 150): string {
  if (text.length <= max) return text;
  const segs = marksIn(text, marks);
  let idx = 0;
  const hasMark = segs.some((x) => x.m);
  for (const s of segs) {
    if (s.m || !hasMark) break;
    idx += s.t.length;
  }
  if (idx < max - 60) return text.slice(0, max).replace(/\s+\S*$/, "") + "…";
  let start = Math.max(0, idx - 48);
  start = text.indexOf(" ", start) + 1 || start;
  const end = Math.min(text.length, start + max);
  return (
    "…" +
    text.slice(start, end).replace(/\s+\S*$/, "") +
    (end < text.length ? "…" : "")
  );
}

export function pageOf(f: FileItem, para: number) {
  const per = Math.max(1, Math.ceil(f.body.length / f.pages));
  return Math.min(f.pages, Math.floor(Math.max(0, para) / per) + 1);
}

export function when(date: string) {
  if (date === TODAY) return "Today";
  if (date === "2026-09-24") return "Yesterday";
  const [, m, d] = date.split("-").map(Number);
  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  return `${d} ${months[m - 1]}`;
}
