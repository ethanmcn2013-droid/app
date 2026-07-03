import "server-only";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Roadmap parser, walks `docs/gtm-plan.md` and converts the §3 asset
 * checklist, §7 8-week content calendar, and §9 14-day press Gantt
 * into a flat list of structured items. Deterministic IDs let the
 * sync layer upsert without losing user-set status.
 *
 * Sections are picked up by heading match, then their tables are read
 * row-by-row. The 8-week calendar tables sit under `### Week N, …`
 * headings. Bold cells (e.g. `**06-16**` or `**Tue**`) flag launch
 * milestones; the parser strips the markup and sets `isLaunch` true
 * when any cell in the row was bolded.
 *
 * No remark dependency, the markdown structure is regular enough
 * that line-walking with light cell-splitting beats pulling in the
 * full unified pipeline (which Tasks doesn't already ship). The
 * shape mirrors the `roadmap_items` table column set 1:1.
 */

export type RoadmapKind =
  | "post"
  | "asset"
  | "press"
  | "paid"
  | "launch"
  | "kpi"
  | "milestone";

export interface ParsedItem {
  id: string;
  week: number;
  weekTheme: string | null;
  weekRange: string | null;
  date: string | null;
  day: string | null;
  kind: RoadmapKind;
  channel: string | null;
  format: string | null;
  source: string | null;
  cta: string | null;
  postingTime: string | null;
  body: string | null;
  isLaunch: boolean;
  ord: number;
}

const PLAN_PATH = join(process.cwd(), "docs", "gtm-plan.md");

const PROJECT_YEAR = 2026;

function readPlan(): string {
  try {
    return readFileSync(PLAN_PATH, "utf-8");
  } catch {
    return "";
  }
}

function stripMd(s: string): string {
  // Strip `**bold**`, `*ital*`, `[text](url)` → text, leading/trailing
  // pipe whitespace. Doesn't try to parse nested markdown.
  return s
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/__(.+?)__/g, "$1")
    .replace(/\*(.+?)\*/g, "$1")
    .replace(/_(.+?)_/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .trim();
}

function rowHasBold(cells: string[]): boolean {
  return cells.some((c) => /\*\*[^*]+\*\*/.test(c));
}

function splitRow(line: string): string[] | null {
  // Strict pipe-row test, must start and end with `|`.
  if (!line.trim().startsWith("|") || !line.trim().endsWith("|")) return null;
  const inner = line.trim().slice(1, -1);
  if (/^[\s|:-]+$/.test(inner)) return null; // header divider
  return inner.split("|").map((c) => c.trim());
}

function slugify(s: string, max = 40): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, max);
}

function normalizeDate(raw: string | null): string | null {
  if (!raw) return null;
  // Accept "MM-DD" → "YYYY-MM-DD"; pass through full ISO; tolerate
  // bolded "**MM-DD**" by stripping in caller.
  const m = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) return raw;
  const m2 = raw.match(/^(\d{2})-(\d{2})$/);
  if (m2) return `${PROJECT_YEAR}-${m2[1]}-${m2[2]}`;
  return null;
}

interface WeekHeading {
  week: number;
  theme: string;
  range: string;
}

function parseWeekHeading(line: string): WeekHeading | null {
  // ### Week 1, Foundation (May 11–17)
  // dash and em-dash both possible
  const m = line.match(
    /^###\s+Week\s+(\d+)\s+[—\-–]\s+([^(]+?)\s*\(([^)]+)\)\s*$/i,
  );
  if (!m) return null;
  return {
    week: Number(m[1]),
    theme: m[2].trim(),
    range: m[3].trim(),
  };
}

function parsePostingCalendar(md: string): ParsedItem[] {
  const items: ParsedItem[] = [];
  const lines = md.split("\n");
  let cur: WeekHeading | null = null;
  let inTable = false;
  let tableHeader: string[] | null = null;
  let ord = 0;

  for (const line of lines) {
    const wh = parseWeekHeading(line);
    if (wh) {
      cur = wh;
      inTable = false;
      tableHeader = null;
      ord = 0;
      continue;
    }
    // Reset on any new heading (### or ## or #) once we leave the
    // week-N stripe.
    if (/^#{1,3}\s/.test(line) && !wh) {
      // Only break out of week parsing if it's not a sub-week heading.
      if (!parseWeekHeading(line)) {
        cur = null;
        inTable = false;
        tableHeader = null;
      }
      continue;
    }
    if (!cur) continue;

    const cells = splitRow(line);
    if (!cells) {
      // a blank line or non-table line ends the table
      if (inTable && line.trim() === "") {
        inTable = false;
        tableHeader = null;
      }
      continue;
    }

    if (!tableHeader) {
      // First row is the header
      tableHeader = cells.map((c) => c.toLowerCase());
      // Validate it's a posting-calendar header: includes "date" and
      // "day" and "channel" and "format".
      const required = ["date", "day", "channel", "format"];
      if (!required.every((r) => tableHeader!.includes(r))) {
        tableHeader = null;
        continue;
      }
      inTable = true;
      continue;
    }
    if (!inTable) continue;

    // Data row.
    const isLaunch = rowHasBold(cells);
    const get = (col: string): string | null => {
      const idx = tableHeader!.indexOf(col);
      if (idx < 0) return null;
      const v = stripMd(cells[idx] ?? "");
      return v.length ? v : null;
    };

    const dateRaw = get("date");
    const day = get("day");
    const channel = get("channel");
    const format = get("format");
    const source = get("source");
    const cta = get("cta");
    const postingTime = get("et") ?? get("posting time") ?? get("time");

    if (!dateRaw || !channel) continue;

    const date = normalizeDate(dateRaw);
    if (!date) continue;

    const isRest = /rest/i.test(format ?? "");
    if (isRest) continue; // skip explicit REST rows, they aren't actionable

    let kind: RoadmapKind = "post";
    if (/reddit ads|ig boost|instagram boost/i.test(format ?? channel ?? "")) {
      kind = "paid";
    } else if (
      /show hn|product hunt|indie hackers/i.test(channel) &&
      /launch/i.test(format ?? "")
    ) {
      kind = "launch";
    } else if (/press/i.test(channel) || /press/i.test(format ?? "")) {
      kind = "press";
    }

    const slug = slugify(`${channel}-${format ?? ""}`, 50);
    const id = `${kind}-w${cur.week}-${date}-${slug}-${ord}`;

    items.push({
      id,
      week: cur.week,
      weekTheme: cur.theme,
      weekRange: cur.range,
      date,
      day,
      kind,
      channel,
      format,
      source,
      cta,
      postingTime,
      body: format,
      isLaunch,
      ord,
    });
    ord += 1;
  }

  return items;
}

function parseAssetChecklist(md: string): ParsedItem[] {
  const items: ParsedItem[] = [];
  const lines = md.split("\n");
  let inSection = false;
  let inTable = false;
  let tableHeader: string[] | null = null;
  let ord = 0;

  for (const line of lines) {
    if (/^##\s+3\.\s+Asset checklist/i.test(line)) {
      inSection = true;
      continue;
    }
    if (inSection && /^##\s+\d/.test(line)) {
      // entered next ## section, bail
      break;
    }
    if (!inSection) continue;

    const cells = splitRow(line);
    if (!cells) continue;
    if (!tableHeader) {
      tableHeader = cells.map((c) => c.toLowerCase());
      const required = ["asset", "status", "target", "tool"];
      if (!required.every((r) => tableHeader!.includes(r))) {
        tableHeader = null;
        continue;
      }
      inTable = true;
      continue;
    }
    if (!inTable) continue;

    const get = (col: string): string | null => {
      const idx = tableHeader!.indexOf(col);
      if (idx < 0) return null;
      const v = stripMd(cells[idx] ?? "");
      return v.length ? v : null;
    };

    const asset = get("asset");
    const status = get("status");
    const target = get("target");
    const tool = get("tool");

    if (!asset) continue;

    const isShipped = /already shipped|shipped|live/i.test(status ?? "");
    // Skip explicitly already-shipped rows from the checklist, they
    // don't need tracking.
    if (isShipped) continue;

    const targetDate = normalizeDate(target ?? "") ?? null;

    items.push({
      id: `asset-w0-${slugify(asset, 50)}-${ord}`,
      week: 0,
      weekTheme: "Assets",
      weekRange: "Pre-launch checklist",
      date: targetDate,
      day: null,
      kind: "asset",
      channel: tool,
      format: status,
      source: null,
      cta: null,
      postingTime: null,
      body: asset,
      isLaunch: false,
      ord,
    });
    ord += 1;
  }
  return items;
}

function parsePressGantt(md: string): ParsedItem[] {
  const items: ParsedItem[] = [];
  const lines = md.split("\n");
  let inGantt = false;
  let tableHeader: string[] | null = null;
  let ord = 0;

  for (const line of lines) {
    if (/^###\s+14-day launch Gantt/i.test(line)) {
      inGantt = true;
      continue;
    }
    if (inGantt && /^###\s+/.test(line) && !/14-day/i.test(line)) {
      break;
    }
    if (!inGantt) continue;

    const cells = splitRow(line);
    if (!cells) continue;
    if (!tableHeader) {
      tableHeader = cells.map((c) => c.toLowerCase());
      const required = ["date", "day", "action", "channel"];
      if (!required.every((r) => tableHeader!.includes(r))) {
        tableHeader = null;
        continue;
      }
      continue;
    }

    const get = (col: string): string | null => {
      const idx = tableHeader!.indexOf(col);
      if (idx < 0) return null;
      const v = stripMd(cells[idx] ?? "");
      return v.length ? v : null;
    };

    const dateRaw = get("date");
    const day = get("day");
    const action = get("action");
    const channel = get("channel");

    if (!dateRaw || !action) continue;
    const date = normalizeDate(dateRaw);
    if (!date) continue;

    const isLaunch = rowHasBold(cells);
    const id = `press-w0-${date}-${slugify(action, 50)}-${ord}`;
    items.push({
      id,
      week: 0,
      weekTheme: "Press · 14-day Gantt",
      weekRange: "2026-06-08 → 2026-06-26",
      date,
      day,
      kind: /show hn|product hunt|indie hackers/i.test(action)
        ? "launch"
        : "press",
      channel,
      format: action,
      source: null,
      cta: null,
      postingTime: null,
      body: action,
      isLaunch,
      ord,
    });
    ord += 1;
  }
  return items;
}

function parseKpiCadence(): ParsedItem[] {
  // The plan asks for a Monday standup-with-yourself writing the five
  // KPIs into docs/kpi-log.md. Synthesize one item per Monday across
  // the 8-week window so the user can tick them off.
  const items: ParsedItem[] = [];
  const mondays = [
    "2026-05-11",
    "2026-05-18",
    "2026-05-25",
    "2026-06-01",
    "2026-06-08",
    "2026-06-15",
    "2026-06-22",
    "2026-06-29",
  ];
  mondays.forEach((date, i) => {
    items.push({
      id: `kpi-w${i + 1}-${date}-monday-standup`,
      week: i + 1,
      weekTheme: "KPI cadence",
      weekRange: "2026-05-11 → 2026-07-05",
      date,
      day: "Mon",
      kind: "kpi",
      channel: "Self",
      format: "Write the 5 KPIs into docs/kpi-log.md",
      source: "gtm-plan.md §10",
      cta: null,
      postingTime: "9am",
      body: "5 KPIs: free signups · paid · HN front-page mins · PH rank EOD · /p/ count",
      isLaunch: false,
      ord: 0,
    });
  });
  return items;
}

export interface ParseResult {
  items: ParsedItem[];
  itemCountByKind: Record<RoadmapKind, number>;
  source: string;
  parsedAt: number;
}

export function parsePlan(): ParseResult {
  const md = readPlan();
  const calendar = parsePostingCalendar(md);
  const assets = parseAssetChecklist(md);
  const press = parsePressGantt(md);
  const kpi = parseKpiCadence();

  const items = [...calendar, ...assets, ...press, ...kpi];
  const itemCountByKind: Record<RoadmapKind, number> = {
    post: 0,
    asset: 0,
    press: 0,
    paid: 0,
    launch: 0,
    kpi: 0,
    milestone: 0,
  };
  items.forEach((it) => {
    itemCountByKind[it.kind] += 1;
  });
  return {
    items,
    itemCountByKind,
    source: PLAN_PATH,
    parsedAt: Date.now(),
  };
}
