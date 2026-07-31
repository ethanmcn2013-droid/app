/**
 * Pure column-configuration model + transforms (Phase 2, extracted Phase 7).
 *
 * This module holds the board's ColumnConfig shape and the pure functions
 * that parse, normalise, and serialise it — no DB, no server-only imports —
 * so the data-safety-critical logic (legacy status mapping, colour/description
 * persistence, order normalisation) is unit-testable. The server actions in
 * `src/server/actions/board.ts` compose these with DB reads/writes.
 */

import { LANE_ORDER, type LaneId } from "@/lib/data";
import { isColumnColorKey, type ColumnColorKey } from "@/lib/board-colors";

export type CustomColumn = { key: string; name: string };

/**
 * Full column configuration for a board.
 *
 * - `system`: name overrides for the four system lanes (todo/doing/review/done).
 * - `custom`: user-added columns in order of creation.
 * - `order`: stable render order for ALL columns (system + custom interleaved).
 * - `colors`: per-column colour; an explicit "neutral" IS kept so a system
 *   lane's semantic default can be overridden back to no tint.
 * - `descriptions`: per-column subtext; "" means an owner cleared it.
 * - `limits`: per-column soft work-in-progress limit (T·120). Advisory
 *   only — the board turns the count amber at and over the limit, it
 *   never blocks a drop. Absent or 0 means no limit.
 */
export type ColumnConfig = {
  system: Partial<Record<LaneId, string>>;
  custom: CustomColumn[];
  order: string[];
  colors: Partial<Record<string, ColumnColorKey>>;
  descriptions: Partial<Record<string, string>>;
  limits: Partial<Record<string, number>>;
};

export const MAX_NAME_LEN = 80;
/** Max custom columns per workspace. Guards against runaway configs. */
export const MAX_CUSTOM_COLUMNS = 20;
/** Max column description length; wraps/truncates gracefully in the UI. */
export const MAX_DESCRIPTION_LEN = 160;
/** Max per-column soft limit. High enough for any real lane; guards junk. */
export const MAX_COLUMN_LIMIT = 999;

/** A fresh, empty config. Used as the base whenever none is stored. */
export function emptyConfig(): ColumnConfig {
  return {
    system: {},
    custom: [],
    order: [...LANE_ORDER],
    colors: {},
    descriptions: {},
    limits: {},
  };
}

/** Build the default render order: LANE_ORDER first, then custom columns. */
export function buildDefaultOrder(custom: CustomColumn[]): string[] {
  return [...LANE_ORDER, ...custom.map((c) => c.key)];
}

/** Ensure every system lane key appears in `order`; append any missing. */
export function normaliseOrder(config: ColumnConfig): string[] {
  const existing = new Set(config.order);
  const extra = LANE_ORDER.filter((id) => !existing.has(id));
  return [...config.order, ...extra];
}

/** Parse the stored colours map, keeping recognised keys (incl. "neutral"). */
export function parseColors(raw: unknown): Partial<Record<string, ColumnColorKey>> {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return {};
  const out: Partial<Record<string, ColumnColorKey>> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (isColumnColorKey(value)) out[key] = value;
  }
  return out;
}

/** Parse the stored descriptions map, keeping string values (incl. ""). */
export function parseDescriptions(raw: unknown): Partial<Record<string, string>> {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return {};
  const out: Partial<Record<string, string>> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof value === "string") out[key] = value.slice(0, MAX_DESCRIPTION_LEN);
  }
  return out;
}

/** Parse the stored limits map, keeping positive integers within range.
 *  A stored 0 (or anything unusable) reads as "no limit" and is dropped. */
export function parseLimits(raw: unknown): Partial<Record<string, number>> {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return {};
  const out: Partial<Record<string, number>> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (
      typeof value === "number" &&
      Number.isInteger(value) &&
      value > 0 &&
      value <= MAX_COLUMN_LIMIT
    ) {
      out[key] = value;
    }
  }
  return out;
}

/**
 * Parse the stored JSON into a ColumnConfig, handling both the legacy
 * `Record<LaneId, string>` format (pure system overrides) and the new
 * ColumnConfig shape. Returns null on parse failure or an empty/foreign value.
 *
 * The legacy path is the data-safe status mapping: an older board that only
 * stored lane-name overrides is read as `{ ...emptyConfig(), system }`, so no
 * task or column is lost when the shape evolves.
 */
export function parseColumnConfig(raw: string): ColumnConfig | null {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      return null;
    }
    const obj = parsed as Record<string, unknown>;

    if (
      "system" in obj ||
      "custom" in obj ||
      "order" in obj ||
      "colors" in obj ||
      "descriptions" in obj ||
      "limits" in obj
    ) {
      const system = (obj.system as Partial<Record<LaneId, string>>) ?? {};
      const custom = Array.isArray(obj.custom)
        ? (obj.custom as CustomColumn[]).filter(
            (c) => c && typeof c.key === "string" && typeof c.name === "string",
          )
        : [];
      const order = Array.isArray(obj.order)
        ? (obj.order as string[]).filter((k) => typeof k === "string")
        : buildDefaultOrder(custom);
      return {
        system,
        custom,
        order,
        colors: parseColors(obj.colors),
        descriptions: parseDescriptions(obj.descriptions),
        limits: parseLimits(obj.limits),
      };
    }

    // Legacy: flat Record<string, string> with lane keys.
    const hasLane = LANE_ORDER.some((id) => typeof obj[id] === "string");
    if (!hasLane) return null;
    const system = {} as Partial<Record<LaneId, string>>;
    for (const id of LANE_ORDER) {
      if (typeof obj[id] === "string") system[id] = obj[id] as string;
    }
    return { ...emptyConfig(), system };
  } catch {
    return null;
  }
}

export function serializeColumnConfig(config: ColumnConfig): string {
  return JSON.stringify({
    system: config.system,
    custom: config.custom,
    order: normaliseOrder(config),
    colors: config.colors ?? {},
    descriptions: config.descriptions ?? {},
    limits: config.limits ?? {},
  });
}

// ─── Pure config transforms (mirrored by the server actions) ─────────────────

/** Remove a column key from the config entirely (config side of a delete). */
export function configRemoveColumn(config: ColumnConfig, key: string): ColumnConfig {
  const colors = { ...config.colors };
  delete colors[key];
  const descriptions = { ...config.descriptions };
  delete descriptions[key];
  const limits = { ...config.limits };
  delete limits[key];
  return {
    ...config,
    custom: config.custom.filter((c) => c.key !== key),
    order: config.order.filter((k) => k !== key),
    colors,
    descriptions,
    limits,
  };
}

/**
 * Validate + apply a reorder. Every system lane and every custom column must
 * be present exactly once; unknown keys are rejected. Throws on an invalid
 * order (matching the server action's guarantees).
 */
export function configReorder(config: ColumnConfig, newOrder: string[]): ColumnConfig {
  const allKeys = new Set<string>([...LANE_ORDER, ...config.custom.map((c) => c.key)]);
  const seen = new Set<string>();
  const deduped = newOrder.filter((k) => (seen.has(k) ? false : (seen.add(k), true)));
  for (const key of allKeys) {
    if (!deduped.includes(key)) throw new Error(`Reorder is missing column key: ${key}`);
  }
  for (const key of deduped) {
    if (!allKeys.has(key)) throw new Error(`Unknown column key in reorder: ${key}`);
  }
  return { ...config, order: deduped };
}
