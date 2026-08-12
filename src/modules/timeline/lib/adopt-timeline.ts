/**
 * Which Timeline, if any, is the canonical Timeline of ONE EXACT Tasks Project.
 *
 * Pure on purpose, in the same spirit as `provision-slug.ts`: the rule about
 * what we are willing to guess is the part worth testing, and it should be
 * readable without a database in the room. Authorization is decided before
 * this function is reached and is not re-litigated here.
 *
 * ── WHAT CHANGED, AND WHY (WP1, docs/wave/DECISIONS.md D-002) ──────────────
 * This decider used to answer the question "which of the owner's Timelines
 * should we open?" and its last resort was `{ kind: "open", slug: first.slug }`.
 * That made *the owner's first Timeline* the answer to a request naming a
 * specific Tasks Project, so asking for Project B could return Timeline A —
 * silently, durably, and with the wrong Project's plan on screen. ADR 0001 §6
 * settles it: the valid outcomes are exact, provisioned,
 * owner-reconciliation-required, archived, denied and failed, and
 * **"open another Timeline" is not one of them.**
 *
 * The question this now answers is therefore narrower and answerable:
 * *does the evidence prove, exactly, which Timeline belongs to this Project?*
 * When it does not, the owner is asked — an explicit choice, never a guess.
 */

export type TimelineAdoptionCandidate = Readonly<{
  slug: string;
  /** The Tasks Project this Timeline workspace is bound to, if any. */
  suiteWorkspaceId: string | null;
  /**
   * Tasks Project ids named by this Timeline's own child Timelines
   * (`projects.source_tasks_workspace_id`). Empty when nothing inside it names
   * a Project. This is the legacy evidence that survives from before
   * `suiteWorkspaceId` was written at creation.
   */
  boundTasksWorkspaceIds?: readonly string[];
}>;

export type TimelineAdoptionEvidence = Readonly<{
  /** The exact Tasks Project asked for. Membership is proved by the caller. */
  requestedTasksWorkspaceId: string;
  /** The caller's own Timeline workspaces, oldest first. */
  owned: readonly TimelineAdoptionCandidate[];
  /**
   * The caller's only *owned* Tasks Project when they own exactly one, and null
   * otherwise. This is a uniqueness proof, not a preference: with one Tasks
   * Project and one unclaimed Timeline there is exactly one possible pairing,
   * so binding them is arithmetic. With two of either it would be a guess.
   */
  soleOwnedTasksWorkspaceId: string | null;
}>;

export type OwnerReconciliationReason =
  /** Several Timelines carry evidence for this one Project, or one carries
   *  mixed evidence. Any pick would be a coin toss. */
  | "ambiguous-evidence"
  /** The owner has a Timeline that proves nothing about any Project.
   *  Provisioning a second one would strand it; adopting it would be a guess.
   *  They are asked: connect that Timeline, or start a new one. */
  | "unproven-timeline-present";

export type TimelineAdoption =
  /** A Timeline is already bound to exactly this Project. */
  | Readonly<{ kind: "exact"; slug: string }>
  /** Exact legacy evidence binds this Timeline to this Project: record it. */
  | Readonly<{ kind: "adopt"; slug: string }>
  /** No Timeline claims this Project and none would be stranded: create one. */
  | Readonly<{ kind: "provision" }>
  /** The owner must choose. We refuse to. */
  | Readonly<{
      kind: "owner-reconciliation-required";
      reason: OwnerReconciliationReason;
      candidates: readonly string[];
    }>;

function boundIds(candidate: TimelineAdoptionCandidate): readonly string[] {
  return candidate.boundTasksWorkspaceIds ?? [];
}

/**
 * Decide which Timeline is the canonical Timeline of `requestedTasksWorkspaceId`.
 *
 * The order below is the order of proof strength, and every branch that cannot
 * prove its answer refuses rather than approximating one. Name, slug, date,
 * position, age and "the only one left" are not evidence — the single
 * exception is stated at `soleOwnedTasksWorkspaceId`, where the owner has one
 * Tasks Project and one unclaimed Timeline and the pairing is forced.
 *
 * That exception is what keeps the production incident these paths were built
 * for closed: a couple creates a Timeline in-app, it carries no
 * `suiteWorkspaceId`, the rail appends `?workspaceId=…`, and before adoption
 * existed the owner met "That workspace is not available." looking at their own
 * plan. They still do not. What they no longer get is *someone else's Project's
 * Timeline* when the evidence is thin.
 */
export function decideTimelineAdoption(
  evidence: TimelineAdoptionEvidence,
): TimelineAdoption {
  const requested = evidence.requestedTasksWorkspaceId.trim();
  const owned = evidence.owned;

  // An empty request is not a request. Nothing may be opened, adopted or
  // created against it.
  if (!requested) {
    return {
      kind: "owner-reconciliation-required",
      reason: "ambiguous-evidence",
      candidates: [],
    };
  }

  // 1. Already bound to this exact Project. The only zero-write answer.
  const exact = owned.filter(
    (candidate) => candidate.suiteWorkspaceId === requested,
  );
  if (exact.length === 1) return { kind: "exact", slug: exact[0]!.slug };
  if (exact.length > 1) {
    // A unique index makes this unreachable in the Timeline database today.
    // It is still answered, because "unreachable" is a property of a schema
    // that WP4 changes, and the safe answer costs nothing.
    return {
      kind: "owner-reconciliation-required",
      reason: "ambiguous-evidence",
      candidates: exact.map((candidate) => candidate.slug),
    };
  }

  // 2. Legacy exact evidence: an unbound Timeline whose own child names this
  //    Project. Adoptable only when it is the ONLY Timeline that names it and
  //    it names nothing else — mixed parentage is a review case, not a merge.
  const mentioning = owned.filter(
    (candidate) =>
      candidate.suiteWorkspaceId === null &&
      boundIds(candidate).includes(requested),
  );
  if (mentioning.length === 1) {
    const only = mentioning[0]!;
    if (boundIds(only).every((id) => id === requested)) {
      return { kind: "adopt", slug: only.slug };
    }
  }
  if (mentioning.length > 0) {
    return {
      kind: "owner-reconciliation-required",
      reason: "ambiguous-evidence",
      candidates: mentioning.map((candidate) => candidate.slug),
    };
  }

  // 3. Nothing names this Project. Timelines that name *another* Project are
  //    that Project's and are never opened for this one, so they are not
  //    candidates and they are not stranded by provisioning either.
  const unproven = owned.filter(
    (candidate) =>
      candidate.suiteWorkspaceId === null && boundIds(candidate).length === 0,
  );

  if (unproven.length === 0) return { kind: "provision" };

  if (
    unproven.length === 1 &&
    evidence.soleOwnedTasksWorkspaceId !== null &&
    evidence.soleOwnedTasksWorkspaceId === requested
  ) {
    // One Tasks Project, one unclaimed Timeline, and the Project asked for is
    // that Project. There is no second pairing this could be.
    return { kind: "adopt", slug: unproven[0]!.slug };
  }

  return {
    kind: "owner-reconciliation-required",
    reason: "unproven-timeline-present",
    candidates: unproven.map((candidate) => candidate.slug),
  };
}
