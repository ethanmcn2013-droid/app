/**
 * Per-column board colours (T·96, expanded Phase 2 2026-07-18).
 *
 * A small, deliberately soft palette. Each key resolves to a CSS custom
 * property that already exists in the design system (no raw colour is
 * introduced here) — the accent ramp and the status tokens. On the
 * board the colour is applied as a *whisper* — a low-percentage tint on
 * the lane surface plus a coloured status dot — never a block of colour,
 * so a scan reads the board by hue without the colour shouting.
 *
 * "neutral" is the no-tint choice. Custom columns default to neutral;
 * the four standard system lanes carry a default semantic colour
 * (DEFAULT_SYSTEM_COLORS) applied only when no colour has been saved, so
 * an owner's explicit choice is never overwritten.
 */

import type { LaneId } from "@/lib/data";

/**
 * Every colour key that is *valid* to persist. Kept as a superset for
 * backward compatibility: `indigo` predates the Phase 2 palette but any
 * board that saved it must keep resolving, so it stays a legal value even
 * though the picker below leads with the friendlier eight.
 */
export const COLUMN_COLOR_KEYS = [
  "neutral",
  "rose",
  "sky",
  "amber",
  "emerald",
  "violet",
  "teal",
  "pink",
  "indigo",
] as const;

export type ColumnColorKey = (typeof COLUMN_COLOR_KEYS)[number];

/**
 * The ordered palette shown in the colour picker — the eight the product
 * offers by name (Red, Blue, Amber, Green, Purple, Teal, Pink, Neutral).
 * `indigo` stays valid for old configs but is not offered here.
 */
export const COLUMN_PICKER_ORDER: readonly ColumnColorKey[] = [
  "neutral",
  "rose",
  "sky",
  "amber",
  "emerald",
  "violet",
  "teal",
  "pink",
] as const;

export function isColumnColorKey(value: unknown): value is ColumnColorKey {
  return (
    typeof value === "string" &&
    (COLUMN_COLOR_KEYS as readonly string[]).includes(value)
  );
}

/**
 * Each colour maps to a CSS var reference (defined in globals.css as
 * --x-col-*). `label` is the picker's accessible name; the swatch and the
 * board tint are both derived from the same var via color-mix in CSS.
 */
export const COLUMN_COLORS: Record<
  ColumnColorKey,
  { label: string; var: string | null }
> = {
  neutral: { label: "Neutral", var: null },
  rose: { label: "Red", var: "var(--x-col-rose)" },
  sky: { label: "Blue", var: "var(--x-col-sky)" },
  amber: { label: "Amber", var: "var(--x-col-amber)" },
  emerald: { label: "Green", var: "var(--x-col-emerald)" },
  violet: { label: "Purple", var: "var(--x-col-violet)" },
  teal: { label: "Teal", var: "var(--x-col-teal)" },
  pink: { label: "Pink", var: "var(--x-col-pink)" },
  indigo: { label: "Indigo", var: "var(--x-col-indigo)" },
};

/**
 * Default semantic colour for each standard system lane. Applied only
 * when a column has no explicit saved colour (see boardColumnColor). The
 * board's canonical order is [todo, doing, review, done], which reads as
 * Blocked · In Progress · Reviewing · Done — so the defaults are
 * red · blue · amber · green.
 */
export const DEFAULT_SYSTEM_COLORS: Record<LaneId, ColumnColorKey> = {
  todo: "rose",
  doing: "sky",
  review: "amber",
  done: "emerald",
};

/**
 * Resolve the effective colour for a column.
 *
 * Precedence:
 *   1. An explicit saved colour (including an explicit "neutral") always
 *      wins — the owner's choice is never overwritten.
 *   2. A standard system lane with no saved colour gets its semantic
 *      default (DEFAULT_SYSTEM_COLORS).
 *   3. Everything else (custom columns) defaults to neutral.
 */
export function boardColumnColor(
  columnKey: string,
  saved: ColumnColorKey | undefined,
  isSystem: boolean,
): ColumnColorKey {
  if (saved) return saved;
  if (isSystem && columnKey in DEFAULT_SYSTEM_COLORS) {
    return DEFAULT_SYSTEM_COLORS[columnKey as LaneId];
  }
  return "neutral";
}
