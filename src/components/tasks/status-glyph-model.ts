/**
 * The one status vocabulary, as data.
 *
 * My tasks and Home draw the lane at rest as a circle: empty for to do,
 * half for in progress, three quarters for review, a clock for waiting and a
 * filled tick for done. Tasks uses the same shapes so a task reads the same
 * on every surface. Custom columns get a dashed ring in the column's own
 * colour, mapped to a v3 identity token (never raw hex text); any column
 * that counts as done draws the tick.
 */

import type { ColumnColorKey } from "@/lib/board-colors";

export type GlyphShape = "empty" | "half" | "three-quarter" | "waiting" | "done" | "custom";

export type GlyphColumn = Readonly<{
  key: string;
  isDone: boolean;
  isSystem: boolean;
  color: ColumnColorKey;
}>;

export type StatusGlyphSpec = Readonly<{
  shape: GlyphShape;
  /** A CSS colour expression built only from v3 tokens. */
  tone: string;
}>;

/** Column colour keys to v3 identity tokens (3:1 as a stroke in both themes). */
export const COLUMN_TONE: Record<ColumnColorKey, string> = {
  neutral: "var(--v3-control-border)",
  rose: "var(--v3-project-7)",
  sky: "var(--v3-project-2)",
  amber: "var(--v3-project-5)",
  emerald: "var(--v3-project-4)",
  violet: "var(--v3-kind-design)",
  teal: "var(--v3-project-3)",
  pink: "var(--v3-project-8)",
  indigo: "var(--v3-project-1)",
};

export function columnTone(color: ColumnColorKey): string {
  return COLUMN_TONE[color] ?? COLUMN_TONE.neutral;
}

export function glyphFor(column: GlyphColumn | undefined): StatusGlyphSpec {
  if (!column) return { shape: "empty", tone: "var(--v3-control-border)" };
  if (column.isDone) return { shape: "done", tone: "var(--v3-success)" };
  switch (column.key) {
    case "todo":
      return { shape: "empty", tone: "var(--v3-control-border)" };
    case "doing":
      return { shape: "half", tone: "var(--v3-warning-stroke)" };
    case "review":
      return { shape: "three-quarter", tone: "var(--v3-review)" };
    case "waiting":
      return { shape: "waiting", tone: "var(--v3-text-2)" };
    default:
      return { shape: "custom", tone: columnTone(column.color) };
  }
}

/** Plain words for the shape, for accessible names and tooltips. */
export function glyphWords(shape: GlyphShape): string {
  switch (shape) {
    case "empty":
      return "Not started";
    case "half":
      return "In progress";
    case "three-quarter":
      return "In review";
    case "waiting":
      return "Waiting";
    case "done":
      return "Done";
    case "custom":
      return "Open";
  }
}
