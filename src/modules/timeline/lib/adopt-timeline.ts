/**
 * Which Timeline, if any, should be bound to a Tasks workspace the caller has
 * already been proved a member of.
 *
 * Pure on purpose, in the same spirit as `provision-slug.ts`: the rule about
 * what we are willing to guess is the part worth testing, and it should be
 * readable without a database in the room. Authorization is decided before
 * this function is reached and is not re-litigated here.
 */

export type TimelineAdoptionCandidate = Readonly<{
  slug: string;
  suiteWorkspaceId: string | null;
}>;

export type TimelineAdoption =
  /** The owner has no Timeline at all — create one bound to their Tasks workspace. */
  | Readonly<{ kind: "provision" }>
  /** Exactly one unlinked Timeline: bind it, and record the link. */
  | Readonly<{ kind: "adopt"; slug: string }>
  /** Ambiguous or already fully linked: open this one and write nothing. */
  | Readonly<{ kind: "open"; slug: string }>;

/**
 * `owned` must be the caller's own Timelines, oldest first — the same order
 * `getWorkspacesForUser` returns, because "the owner's first workspace" is the
 * long-standing meaning of the no-context path and this must not disagree
 * with it.
 *
 * Adoption requires exactly one unlinked candidate. With none there is nothing
 * to repair; with several, any choice would be a guess, and a wrong join
 * between a Timeline and a Tasks workspace is silent, durable, and harder to
 * notice than the missing link it replaced. In both of those cases the owner's
 * first Timeline is opened and nothing is written.
 */
export function decideTimelineAdoption(
  owned: readonly TimelineAdoptionCandidate[],
): TimelineAdoption {
  const first = owned[0];
  if (!first) return { kind: "provision" };

  const unlinked = owned.filter((candidate) => !candidate.suiteWorkspaceId);
  const only = unlinked.length === 1 ? unlinked[0] : undefined;
  if (only) return { kind: "adopt", slug: only.slug };

  return { kind: "open", slug: first.slug };
}
