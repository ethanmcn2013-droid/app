import type { LaneId, Task } from "@/lib/data";
import { LANES, LANE_ORDER, PRIORITY_LABEL } from "@/lib/data";
import { TASKS_DOMAIN } from "@/lib/product-urls";

/**
 * Pure formatters that turn a workspace's tasks into clipboard-ready
 * text in formats other tools accept. No side effects, no DOM.
 *
 * The Sprint-9 thesis: Tasks owns the data, Google is a destination
 * people happen to use. These bridges hand them their data formatted
 * for the destination, without Tasks ever needing OAuth.
 */

const CSV_COLS = [
  "Title",
  "Lane",
  "Priority",
  "Due",
  "Tags",
  "Cents",
  "Contact name",
  "Contact email",
] as const;

/** RFC 4180 escape, wrap in quotes when the cell contains comma,
 *  quote, CR, or LF. Doubled quotes inside cells. */
function csvCell(s: string): string {
  if (s === "") return "";
  // Spreadsheet applications interpret these prefixes as formulas even in
  // quoted CSV cells. Prefix with an apostrophe so exported customer text is
  // treated as text rather than executable spreadsheet syntax.
  const safe = /^[\t\r\n \uFEFF]*[=+\-@]/.test(s) ? `'${s}` : s;
  if (/[",\r\n]/.test(safe)) {
    return '"' + safe.replace(/"/g, '""') + '"';
  }
  return safe;
}

/** CSV with header row. Compatible with Google Sheets, Excel,
 *  Numbers, and anything that imports CSV. */
export function formatTasksAsCsv(tasks: Task[]): string {
  const rows: string[] = [CSV_COLS.join(",")];
  // Iterate in lane order so the CSV is grouped + scannable when
  // pasted into a spreadsheet without sorting.
  const byLane = groupByLane(tasks);
  for (const laneId of LANE_ORDER) {
    const list = byLane.get(laneId) ?? [];
    for (const t of list) {
      rows.push(
        [
          csvCell(t.title),
          csvCell(LANES[t.lane].name),
          csvCell(PRIORITY_LABEL[t.priority].label),
          csvCell(t.due ?? ""),
          csvCell((t.tags ?? []).join(", ")),
          csvCell(t.cents != null ? formatDollars(t.cents) : ""),
          csvCell(t.externalContactName ?? ""),
          csvCell(t.externalContactEmail ?? ""),
        ].join(","),
      );
    }
  }
  return rows.join("\r\n");
}

/** Markdown-formatted task list. Pasteable into Google Docs (which
 *  accepts markdown formatting via Format > Paste from Markdown,
 *  enabled by default since 2024), Notion, GitHub issues,
 *  Slack, Discord, anything that renders markdown. */
export function formatTasksAsMarkdown(
  tasks: Task[],
  workspaceName: string,
): string {
  const lines: string[] = [];
  lines.push(`# ${workspaceName}`);
  lines.push("");
  lines.push(`*${tasks.length} task${tasks.length === 1 ? "" : "s"} · exported from Tasks*`);
  lines.push("");

  const byLane = groupByLane(tasks);
  for (const laneId of LANE_ORDER) {
    const list = byLane.get(laneId) ?? [];
    if (list.length === 0) continue;
    lines.push(`## ${LANES[laneId].name}`);
    lines.push("");
    for (const t of list) {
      const checkbox = laneId === "done" ? "[x]" : "[ ]";
      const meta: string[] = [];
      if (t.due) meta.push(`due ${t.due}`);
      if (t.priority !== "p3")
        meta.push(PRIORITY_LABEL[t.priority].label.toLowerCase());
      if (t.tags && t.tags.length > 0)
        meta.push(t.tags.map((tag) => `#${tag}`).join(" "));
      const metaSuffix = meta.length > 0 ? `  *(${meta.join(" · ")})*` : "";
      lines.push(`- ${checkbox} ${escapeMd(t.title)}${metaSuffix}`);
    }
    lines.push("");
  }

  lines.push("---");
  lines.push(`Made with Signal Tasks · ${TASKS_DOMAIN}`);
  return lines.join("\n");
}

function escapeMd(s: string): string {
  // Escape characters that would be interpreted as markdown syntax.
  // Conservative: handles brackets, asterisks, underscores, backticks.
  return s.replace(/([\\`*_{}[\]()#+!|])/g, "\\$1");
}

function groupByLane(tasks: Task[]): Map<LaneId, Task[]> {
  const m = new Map<LaneId, Task[]>();
  for (const id of LANE_ORDER) m.set(id, []);
  for (const t of tasks) {
    const arr = m.get(t.lane);
    if (arr) arr.push(t);
  }
  return m;
}

function formatDollars(cents: number): string {
  // Internal helper, not exported because the cents-editor's
  // Intl.NumberFormat path is the canonical user-facing formatter.
  // CSV gets a plain "1234.56" so spreadsheets can compute on it.
  const dollars = cents / 100;
  return dollars.toFixed(2);
}
