import { isValidSlug, slugify } from "./reserved-slugs";

/**
 * Choose the slug for a Timeline workspace provisioned for someone who already
 * has a Tasks workspace.
 *
 * A Timeline workspace slug is the primary key of the Timeline `workspaces`
 * table AND a public path segment (`/{slug}`), so it has to be unique, valid
 * and not one of the reserved route words. It is derived from the Tasks
 * workspace so the two read as the same thing to the person who owns them,
 * which is what a slug someone typed themselves would have looked like.
 *
 * Pure. The caller supplies `isTaken`, so this is testable without a database
 * and the uniqueness rule lives next to the naming rule instead of inside a
 * query.
 */

const MAX_SLUG = 32;

/** Trim to the maximum length without leaving a trailing hyphen behind. */
function clamp(slug: string): string {
  return slug.slice(0, MAX_SLUG).replace(/-+$/, "");
}

/** Suffix a slug, trimming the stem rather than the suffix if it overflows. */
function suffixed(stem: string, suffix: string): string {
  const room = MAX_SLUG - suffix.length - 1;
  if (room < 1) return "";
  return `${stem.slice(0, room).replace(/-+$/, "")}-${suffix}`;
}

export type TimelineSlugInput = Readonly<{
  /** The Tasks workspace slug, or its name if the slug is unusable. */
  preferred: string;
  /** The Tasks workspace id. Always present, always unique, used only when
   *  every readable candidate is taken or invalid. */
  fallbackSeed: string;
  isTaken: (slug: string) => boolean;
}>;

/**
 * Returns the first candidate that is a valid, unreserved, untaken slug.
 *
 * Throws rather than returning null. A caller that cannot name the workspace
 * must not silently skip provisioning: the whole point of this path is that a
 * couple ends up with a Timeline, and a quiet null is how blocker 2 stayed
 * invisible for as long as it did.
 */
export function deriveTimelineWorkspaceSlug(input: TimelineSlugInput): string {
  const stem = clamp(slugify(input.preferred));
  const seed = input.fallbackSeed
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .slice(0, 16);

  const candidates: string[] = [];
  if (stem) {
    candidates.push(stem);
    candidates.push(suffixed(stem, "plan"));
    for (let n = 2; n <= 9; n += 1) candidates.push(suffixed(stem, String(n)));
  }
  if (seed) {
    candidates.push(clamp(`plan-${seed}`));
    for (let n = 2; n <= 9; n += 1) {
      candidates.push(clamp(`plan-${n}-${seed}`));
    }
  }

  for (const candidate of candidates) {
    if (!candidate) continue;
    if (!isValidSlug(candidate)) continue;
    if (input.isTaken(candidate)) continue;
    return candidate;
  }

  throw new Error(
    "Could not derive a Timeline workspace slug. Every candidate was invalid, reserved or taken.",
  );
}
