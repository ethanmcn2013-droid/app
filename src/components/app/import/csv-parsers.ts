import * as chrono from "chrono-node";
import type { LaneId, Priority } from "@/lib/data";

/**
 * CSV import — per-source parsing.
 *
 * Each external tool (Trello, Asana, Notion) exports a CSV with its own
 * column names and conventions. This module normalizes any of them into
 * a single canonical `ImportRow` the wizard previews and the server
 * action persists. Pure: no DB, no I/O — easy to test.
 */

export const CANONICAL_FIELDS = [
  "title",
  "lane",
  "priority",
  "due",
  "dueAt",
  "assignees",
  "tags",
] as const;

export type CanonicalField = (typeof CANONICAL_FIELDS)[number];

/** One row's worth of imported task data, post-normalization. */
export type ImportRow = {
  title: string;
  lane: LaneId;
  priority: Priority;
  due?: string;
  dueAt?: Date;
  assignees: string[];
  tags: string[];
};

export type SourceId = "trello" | "asana" | "notion" | "auto";

/** Result of parsing a CSV string against a chosen (or detected) source. */
export type ParseResult = {
  /** Source actually used to interpret the rows. `auto` collapses to one. */
  source: Exclude<SourceId, "auto">;
  /** The header row of the CSV, verbatim. */
  headers: string[];
  /** Detected mapping: canonical field → header name (or null when missing). */
  mapping: Record<CanonicalField, string | null>;
  /** Number of canonical fields the detector matched against this source. */
  matchScore: number;
  /** Parsed rows — index aligned to the original CSV (header excluded). */
  rows: ImportRow[];
  /** The raw, unnormalized rows in case the user wants to re-map columns. */
  raw: Record<string, string>[];
};

const LANE_KEYWORDS: Record<LaneId, string[]> = {
  todo: [
    "todo",
    "to do",
    "to-do",
    "backlog",
    "open",
    "not started",
    "new",
    "inbox",
    "ideas",
  ],
  doing: [
    "doing",
    "in progress",
    "in-progress",
    "wip",
    "working",
    "started",
    "active",
  ],
  review: [
    "review",
    "in review",
    "qa",
    "testing",
    "ready for review",
    "blocked",
    "waiting",
  ],
  done: ["done", "complete", "completed", "shipped", "closed", "archived"],
};

/** Normalize a string for fuzzy comparisons. */
function n(s: string): string {
  return s.trim().toLowerCase();
}

/** Map any free-text status/list/section into one of the four lanes. */
export function laneFromText(value: string | undefined | null): LaneId {
  if (!value) return "todo";
  const v = n(value);
  for (const lane of ["done", "review", "doing", "todo"] as LaneId[]) {
    for (const kw of LANE_KEYWORDS[lane]) {
      if (v === kw || v.includes(kw)) return lane;
    }
  }
  return "todo";
}

/** Parse Trello / Asana / Notion priority labels into our p0-p3 scale. */
export function priorityFromText(value: string | undefined | null): Priority {
  if (!value) return "p2";
  const v = n(value);
  if (/(p0|critical|urgent|highest|blocker)/.test(v)) return "p0";
  if (/(p1|high)/.test(v)) return "p1";
  if (/(p3|low|trivial|minor)/.test(v)) return "p3";
  return "p2";
}

/** Split a comma- (or semicolon-) separated string into clean tokens. */
function splitList(value: string | undefined | null): string[] {
  if (!value) return [];
  return value
    .split(/[,;]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Best-effort date parse — chrono is forgiving across Trello/Asana/Notion exports. */
function parseDate(value: string | undefined | null): {
  due?: string;
  dueAt?: Date;
} {
  if (!value) return {};
  const trimmed = value.trim();
  if (!trimmed) return {};
  const parsed = chrono.parseDate(trimmed, new Date(), { forwardDate: true });
  if (parsed && !Number.isNaN(parsed.getTime())) {
    return { due: trimmed, dueAt: parsed };
  }
  return { due: trimmed };
}

// ---------------------------------------------------------------------------
// Source heuristics — which canonical field maps to which header.
// ---------------------------------------------------------------------------

type Heuristic = {
  source: Exclude<SourceId, "auto">;
  match: Partial<Record<CanonicalField, RegExp[]>>;
};

const HEURISTICS: Heuristic[] = [
  {
    source: "trello",
    match: {
      title: [/^card name$/i, /^name$/i],
      lane: [/^list name$/i, /^list$/i],
      tags: [/^labels$/i],
      due: [/^due date$/i, /^due$/i],
      dueAt: [/^due date$/i, /^due$/i],
      assignees: [/^members$/i, /^assignees?$/i],
      priority: [/^priority$/i],
    },
  },
  {
    source: "asana",
    match: {
      title: [/^name$/i, /^task name$/i],
      lane: [/^section\/?\s*column$/i, /^section$/i, /^column$/i, /^status$/i],
      tags: [/^tags$/i],
      due: [/^due date$/i, /^due$/i],
      dueAt: [/^due date$/i, /^due$/i],
      assignees: [/^assignees?$/i, /^assigned to$/i],
      priority: [/^priority$/i],
    },
  },
  {
    source: "notion",
    match: {
      title: [/^name$/i, /^title$/i],
      lane: [/^status$/i, /^state$/i],
      tags: [/^tags$/i, /^labels$/i, /^categor(y|ies)$/i],
      due: [/^due$/i, /^due date$/i, /^date$/i],
      dueAt: [/^due$/i, /^due date$/i, /^date$/i],
      assignees: [/^persons?$/i, /^assigned to$/i, /^owner$/i, /^assignees?$/i],
      priority: [/^priority$/i],
    },
  },
];

function detectMapping(
  headers: string[],
  source: Exclude<SourceId, "auto">,
): { mapping: Record<CanonicalField, string | null>; score: number } {
  const heuristic = HEURISTICS.find((h) => h.source === source);
  const mapping: Record<CanonicalField, string | null> = {
    title: null,
    lane: null,
    priority: null,
    due: null,
    dueAt: null,
    assignees: null,
    tags: null,
  };
  if (!heuristic) return { mapping, score: 0 };
  let score = 0;
  for (const field of CANONICAL_FIELDS) {
    const patterns = heuristic.match[field] ?? [];
    const found = headers.find((h) => patterns.some((p) => p.test(h.trim())));
    if (found) {
      mapping[field] = found;
      score++;
    }
  }
  return { mapping, score };
}

/** Choose the source whose heuristics match the most headers. Ties go to the source order Trello → Asana → Notion. */
export function autoDetectSource(headers: string[]): {
  source: Exclude<SourceId, "auto">;
  score: number;
  mapping: Record<CanonicalField, string | null>;
} {
  let best:
    | {
        source: Exclude<SourceId, "auto">;
        score: number;
        mapping: Record<CanonicalField, string | null>;
      }
    | null = null;
  for (const candidate of ["trello", "asana", "notion"] as const) {
    const { mapping, score } = detectMapping(headers, candidate);
    if (!best || score > best.score) {
      best = { source: candidate, score, mapping };
    }
  }
  // `best` is guaranteed defined because HEURISTICS has entries.
  return best!;
}

/** Build an ImportRow from a raw CSV row + a column mapping. */
export function buildRow(
  raw: Record<string, string>,
  mapping: Record<CanonicalField, string | null>,
): ImportRow {
  const get = (field: CanonicalField): string | undefined => {
    const col = mapping[field];
    if (!col) return undefined;
    const v = raw[col];
    return typeof v === "string" ? v : undefined;
  };
  const title = (get("title") ?? "").trim();
  const lane = laneFromText(get("lane"));
  const priority = priorityFromText(get("priority"));
  const date = parseDate(get("dueAt") ?? get("due"));
  return {
    title,
    lane,
    priority,
    due: date.due,
    dueAt: date.dueAt,
    assignees: splitList(get("assignees")),
    tags: splitList(get("tags")),
  };
}

/**
 * High-level entry: hand it the CSV string, the user's source choice
 * (or "auto"), and get back the parsed rows ready for preview. Uses
 * papaparse under the hood; throws on malformed CSV so the wizard can
 * surface a useful error.
 */
export async function parseCsv(
  csv: string,
  source: SourceId,
): Promise<ParseResult> {
  // Lazy-import so this module is still safe to import in server components
  // that don't actually run the parser.
  const Papa = (await import("papaparse")).default;
  const result = Papa.parse<Record<string, string>>(csv, {
    header: true,
    skipEmptyLines: "greedy",
    transformHeader: (h: string) => h.trim(),
  });
  if (result.errors && result.errors.length > 0) {
    // papaparse reports per-row errors; we only fail hard on header-level
    // problems, otherwise we let imperfect rows surface as "missing title".
    const fatal = result.errors.find((e) => e.type === "Delimiter");
    if (fatal) throw new Error(`CSV parse failed: ${fatal.message}`);
  }
  const headers = result.meta.fields ?? [];
  const detected =
    source === "auto"
      ? autoDetectSource(headers)
      : (() => {
          const d = detectMapping(headers, source);
          return { source, mapping: d.mapping, score: d.score };
        })();

  const raw = (result.data ?? []).filter(
    (r): r is Record<string, string> => !!r && typeof r === "object",
  );
  const rows = raw.map((r) => buildRow(r, detected.mapping));

  return {
    source: detected.source,
    headers,
    mapping: detected.mapping,
    matchScore: detected.score,
    rows,
    raw,
  };
}

/** Used by the preview when the user changes a column dropdown. */
export function rebuildRows(
  raw: Record<string, string>[],
  mapping: Record<CanonicalField, string | null>,
): ImportRow[] {
  return raw.map((r) => buildRow(r, mapping));
}

/** Hard ceiling so a 100k-row CSV doesn't lock the UI or the DB. */
export const MAX_ROWS = 500;
export const MAX_BYTES = 5 * 1024 * 1024; // 5MB
