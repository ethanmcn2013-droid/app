/**
 * Per-column board colours (T·96, expanded Phase 2 2026-07-18,
 * hue contract wave 5).
 *
 * A small, deliberately soft palette. Each key resolves to a CSS custom
 * property that already exists in the design system (no raw colour is
 * introduced here). On the board the colour is now spent on exactly ONE
 * object per column — the status pip. The lane header is ink and a count;
 * the tinted band, the coloured top rule and the accent-mixed column name
 * were retired in wave 5, because three lane hues shouting the column
 * names was the loudest thing on a board whose job is to let the cards
 * read.
 *
 * ── One hue, one meaning ────────────────────────────────────────────────
 * The board previously said three different things in amber at once — the
 * Review lane, High priority, and a task due today — so amber told you
 * nothing until you worked out which amber it was. The contract now:
 *
 *   green  (--x-status-done)   finished. Done lane, completion circle.
 *   amber  (--status-flight)   in flight — act on this now. The Doing
 *                              lane; a task due today; a lane at or near
 *                              its soft limit.
 *   red    (--status-blocked)  alarm. Overdue, blocked, Urgent priority.
 *   indigo (--accent)          the brand's one moment: selection, focus,
 *                              the current view.
 *   ink                        everything else, which is most things.
 *
 * High priority left amber for strong ink (shared.module.css) so amber
 * means one thing; the word "High" was always what carried it.
 *
 * "neutral" is the no-hue choice. Custom columns default to neutral; the
 * standard system lanes carry a default semantic colour
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
 *
 * `tint` / `border` / `ink` are perceptual corrections, in percent: one
 * raw alpha across hues made amber shout and green whisper. Each hue gets
 * its own header-wash and rule strength, and its own share of accent in
 * the title ink so every name clears WCAG AA on the tinted band (amber
 * needs far more text-ink than green does). Neutral columns take the
 * CSS fallbacks (cool ink at 5.5% / 16%).
 */
export const COLUMN_COLORS: Record<
  ColumnColorKey,
  { label: string; var: string | null; tint: number; border: number; ink: number }
> = {
  neutral: { label: "Neutral", var: null, tint: 5.5, border: 16, ink: 0 },
  rose: { label: "Red", var: "var(--x-col-rose)", tint: 4.5, border: 13, ink: 58 },
  // "Blue" rides the suite indigo, not --x-col-sky. That token resolves to
  // --status-review, a cyan the design system never ratified — the one
  // off-system hue the board was still painting. The picker keeps its
  // blue; the blue is now the system's own.
  sky: { label: "Blue", var: "var(--x-col-indigo)", tint: 5, border: 15, ink: 62 },
  amber: { label: "Amber", var: "var(--x-col-amber)", tint: 3.5, border: 11, ink: 55 },
  emerald: { label: "Green", var: "var(--x-col-emerald)", tint: 5.5, border: 16, ink: 55 },
  violet: { label: "Purple", var: "var(--x-col-violet)", tint: 4.5, border: 13, ink: 62 },
  teal: { label: "Teal", var: "var(--x-col-teal)", tint: 4.5, border: 13, ink: 60 },
  pink: { label: "Pink", var: "var(--x-col-pink)", tint: 4.5, border: 13, ink: 58 },
  indigo: { label: "Indigo", var: "var(--x-col-indigo)", tint: 4.5, border: 13, ink: 62 },
};

/** Inline CSS custom properties a tinted lane/band sets from its colour. */
export function laneAccentStyle(color: ColumnColorKey): Record<string, string> | undefined {
  const entry = COLUMN_COLORS[color];
  if (!entry.var) return undefined;
  return {
    "--lane-accent": entry.var,
    "--lane-tint": `${entry.tint}%`,
    "--lane-border-tint": `${entry.border}%`,
    "--lane-ink-mix": `${entry.ink}%`,
  };
}

/**
 * Default semantic colour for each standard system lane. Applied only
 * when a column has no explicit saved colour (see boardColumnColor).
 *
 * Every default here is a DS status token, and each one is used for the
 * single thing that token means (see the hue contract at the top):
 *
 *   Queued  neutral  a backlog is not a state, it is an absence of one.
 *   Doing   amber    --status-flight IS "in progress". It used to be
 *                    `sky`, which resolved to the off-system cyan.
 *   Review  neutral  waiting on a check is not blocked and not in flight;
 *                    the system has no token for it, so it takes none.
 *                    It used to be amber, which is how amber ended up
 *                    meaning three things at once.
 *   Done    emerald  --x-status-done, the one canonical finished green.
 *
 * An owner who wants a coloured backlog is one column-menu click away, and
 * any explicitly saved colour still wins.
 */
export const DEFAULT_SYSTEM_COLORS: Record<LaneId, ColumnColorKey> = {
  todo: "neutral",
  doing: "amber",
  review: "neutral",
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
