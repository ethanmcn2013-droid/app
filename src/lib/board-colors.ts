/**
 * Per-column board colours (T·96).
 *
 * A small, deliberately soft palette. Each key resolves to a CSS custom
 * property that already exists in the design system (no raw colour is
 * introduced here) — the accent ramp and the status tokens. On the
 * board the colour is applied as a *whisper* — a low-percentage tint on
 * the lane surface plus a coloured status dot — never a block of colour,
 * so a scan reads the board by hue without the colour shouting.
 *
 * "neutral" is the default: no tint, the lane keeps its status-derived
 * dot exactly as before. Existing boards are unchanged until an owner
 * picks a colour.
 */

export const COLUMN_COLOR_KEYS = [
  "neutral",
  "indigo",
  "rose",
  "amber",
  "emerald",
  "sky",
  "violet",
] as const;

export type ColumnColorKey = (typeof COLUMN_COLOR_KEYS)[number];

export function isColumnColorKey(value: unknown): value is ColumnColorKey {
  return (
    typeof value === "string" &&
    (COLUMN_COLOR_KEYS as readonly string[]).includes(value)
  );
}

/**
 * Each colour maps to a CSS var reference (defined in globals.css as
 * --x-col-*). `label` is the picker's accessible name; `swatch` is the
 * solid dot shown in the picker (the tint on the board is derived from
 * the same var via color-mix in CSS).
 */
export const COLUMN_COLORS: Record<
  ColumnColorKey,
  { label: string; var: string | null }
> = {
  neutral: { label: "Neutral", var: null },
  indigo: { label: "Indigo", var: "var(--x-col-indigo)" },
  rose: { label: "Rose", var: "var(--x-col-rose)" },
  amber: { label: "Amber", var: "var(--x-col-amber)" },
  emerald: { label: "Emerald", var: "var(--x-col-emerald)" },
  sky: { label: "Sky", var: "var(--x-col-sky)" },
  violet: { label: "Violet", var: "var(--x-col-violet)" },
};
