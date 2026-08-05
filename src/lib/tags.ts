/**
 * Reusable task tags (Phase 3A).
 *
 * A tag *definition* is a workspace-level record of a tag's canonical
 * display name and its colour. Definitions are persisted in the `meta` KV
 * under `board:{ws}:tags`; a task's *assignments* stay in `tasks.tags`
 * (an array of tag names) so no schema migration is needed.
 *
 * Equivalence is case-insensitive: "Design" and "design" are the same tag.
 * The canonical display name is whatever casing created the tag first.
 */

import type { ColumnColorKey } from "@/lib/board-colors";

export type TagDef = {
  /** Canonical display name (original casing). */
  name: string;
  /** Colour from the shared column/tag palette; "neutral" = quiet grey. */
  color: ColumnColorKey;
};

/** Normalised identity key for a tag name (case- and whitespace-insensitive). */
/**
 * The label a person reads for a tag.
 *
 * Tags are stored the way they were typed, which in practice is often a
 * slug ("mara-finn", "venue_prep"). A slug is an internal spelling, not
 * a display name — chips render this humanised form (separators become
 * spaces, words take initial capitals) while every lookup, filter and
 * write keeps using the stored name. Pure presentation; never persisted.
 */
export function tagDisplayName(name: string): string {
  const spaced = name.replace(/[-_]+/g, " ").replace(/\s+/g, " ").trim();
  if (!spaced) return name;
  return spaced
    .split(" ")
    .map((word) => (word ? word.charAt(0).toLocaleUpperCase("en-GB") + word.slice(1) : word))
    .join(" ");
}

export function tagKey(name: string): string {
  return name.trim().toLowerCase();
}

/** Max tags a workspace can define. Guards against runaway configs. */
export const MAX_TAGS = 100;

/** Max characters in a tag name. */
export const MAX_TAG_LEN = 32;

/**
 * Resolve the colour for a tag name against the definition list. Falls
 * back to neutral when the tag has no definition (e.g. a legacy freeform
 * tag string with no registered colour).
 */
export function tagColor(name: string, defs: TagDef[]): ColumnColorKey {
  const key = tagKey(name);
  return defs.find((d) => tagKey(d.name) === key)?.color ?? "neutral";
}
