import type { LaneId, Task } from "@/lib/data";
import { PRIORITY_LABEL } from "@/lib/data";
import {
  publicBoardColumns,
  publicColumnTasks,
  type PublicColumn,
} from "@/lib/public-board-lanes";
import { TASKS_PUBLIC_DOMAIN } from "@/lib/product-urls";

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
  if (/[",\r\n]/.test(s)) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

/** CSV with header row. Compatible with Google Sheets, Excel,
 *  Numbers, and anything that imports CSV. */
export function formatTasksAsCsv(tasks: Task[], columns?: PublicColumn[]): string {
  const rows: string[] = [CSV_COLS.join(",")];
  // Iterate in column order so the CSV is grouped + scannable when
  // pasted into a spreadsheet without sorting, and the status cell says
  // what the operator's board says (T·121).
  const boardColumns = columns ?? publicBoardColumns(null, tasks);
  for (const column of boardColumns) {
    const list = publicColumnTasks(tasks, column.id);
    for (const t of list) {
      rows.push(
        [
          csvCell(t.title),
          csvCell(column.name),
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
  columns?: PublicColumn[],
): string {
  const lines: string[] = [];
  lines.push(`# ${workspaceName}`);
  lines.push("");
  lines.push(`*${tasks.length} task${tasks.length === 1 ? "" : "s"} · exported from Tasks*`);
  lines.push("");

  const boardColumns = columns ?? publicBoardColumns(null, tasks);
  for (const column of boardColumns) {
    const list = publicColumnTasks(tasks, column.id);
    if (list.length === 0) continue;
    lines.push(`## ${column.name}`);
    lines.push("");
    // Column membership decides the checkbox, not a per-task lane read —
    // every task in `list` already belongs to this column (T·122).
    const checkbox = column.isDone ? "[x]" : "[ ]";
    for (const t of list) {
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
  lines.push(`Made with Signal Tasks · ${TASKS_PUBLIC_DOMAIN}`);
  return lines.join("\n");
}

function escapeMd(s: string): string {
  // Escape characters that would be interpreted as markdown syntax.
  // Conservative: handles brackets, asterisks, underscores, backticks.
  return s.replace(/([\\`*_{}[\]()#+!|])/g, "\\$1");
}

function formatDollars(cents: number): string {
  // Internal helper, not exported because the cents-editor's
  // Intl.NumberFormat path is the canonical user-facing formatter.
  // CSV gets a plain "1234.56" so spreadsheets can compute on it.
  const dollars = cents / 100;
  return dollars.toFixed(2);
}
