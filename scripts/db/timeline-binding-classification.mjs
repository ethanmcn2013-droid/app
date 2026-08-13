/**
 * Plan §6.3's classification table, as a pure function.
 *
 * ── WHY PURE, AND WHY ITS OWN FILE ─────────────────────────────────────────
 * This is the rule that decides whether a couple's Timeline gets bound to a
 * Project — permanently, because `connectSuiteWorkspaceAction` refuses to
 * rebind. Getting it wrong is not a bug that shows up as an error; it is a
 * bug that shows up as somebody else's wedding under your name. A rule that
 * consequential should be readable and testable without a database in the
 * room, exactly like `adopt-timeline.ts` and `milestone-reconciliation.ts`.
 *
 * ── THE ONE THING IT WILL NOT DO ───────────────────────────────────────────
 * Guess. There is no "most likely", no "first", no name matching, no date
 * ordering, no tie-break. Every branch that is not exact and non-ambiguous
 * returns `needs_review` and writes nothing, and the owner is given an
 * explicit choice instead (Connect existing Timeline / Start a new Timeline).
 *
 * The classification table, verbatim from the plan:
 *
 * | Legacy shape                                             | Treatment |
 * |----------------------------------------------------------|-----------|
 * | Parent=A and exactly one child=A                          | Auto-bind `legacy_exact` |
 * | Parent=A and exactly one child total, which is unbound    | Auto-bind and mirror child to A only if no other workspace, child, or binding globally claims A |
 * | Parent unbound, exactly one child=A, Tasks proves local owner is Project owner | Auto-bind |
 * | Parent=A and child=B                                      | `needs_review`; no write |
 * | Multiple children with duplicate/mixed source IDs         | `needs_review`; preserve all |
 * | Multiple Timeline candidates for one Tasks ID             | `needs_review`; no write |
 * | Fully unlinked                                            | Never infer from names, order, dates, or "first" |
 * | Missing Tasks Project                                     | `orphaned`; preserve content/publications, disable sync |
 */

/**
 * @typedef {Object} TimelineWorkspaceEvidence
 * @property {string} slug
 * @property {string|null} suiteWorkspaceId     the parent mirror
 * @property {string} ownerUserId               local provenance, NOT authorization
 * @property {Array<{slug: string, sourceTasksWorkspaceId: string|null}>} children
 *
 * @typedef {Object} ClassificationContext
 * @property {boolean} tasksExportComplete
 * @property {Map<string, {exists: boolean, archivedAt: number|null, ownerClerkSubject: string|null}>} tasksProjects
 * @property {Map<string, Set<string>>} claimantsByTasksId  every workspace slug claiming an id, by parent OR child
 * @property {Map<string, {timelineWorkspaceSlug: string, state: string}>} existingBindings
 */

export const NEEDS_REVIEW_REASONS = Object.freeze({
  PARENT_CHILD_CONFLICT: "parent-child-conflict",
  MIXED_CHILD_SOURCES: "mixed-child-sources",
  DUPLICATE_CHILD_SOURCES: "duplicate-child-sources",
  MULTIPLE_TIMELINE_CANDIDATES: "multiple-timeline-candidates",
  CLAIMED_ELSEWHERE: "claimed-elsewhere",
  AMBIGUOUS_PRIMARY: "ambiguous-primary",
  NO_CHILD_TIMELINE: "no-child-timeline",
  OWNER_IDENTITY_UNPROVED: "owner-identity-unproved",
});

/** An incomplete Tasks read is not evidence of a missing Project. */
export class IncompleteTasksExportError extends Error {
  constructor(options = {}) {
    super(
      "timeline-backfill: the Tasks export is incomplete or unavailable, so classification aborts. " +
        "A Project that could not be read is not a Project that is gone (plan §6.3).",
      options,
    );
    this.name = "IncompleteTasksExportError";
  }
}

function distinct(values) {
  return [...new Set(values)];
}

/**
 * @param {TimelineWorkspaceEvidence} workspace
 * @param {ClassificationContext} context
 */
export function classifyTimelineWorkspace(workspace, context) {
  if (!context.tasksExportComplete) throw new IncompleteTasksExportError();

  const parent = workspace.suiteWorkspaceId ?? null;
  const boundChildren = workspace.children.filter((child) => child.sourceTasksWorkspaceId);
  const childIds = distinct(boundChildren.map((child) => child.sourceTasksWorkspaceId));

  const evidence = {
    timelineWorkspaceSlug: workspace.slug,
    parent,
    childCount: workspace.children.length,
    boundChildCount: boundChildren.length,
    distinctChildSourceCount: childIds.length,
  };
  const review = (reason) => ({ kind: "needs_review", reason, evidence });

  // ── Fully unlinked ───────────────────────────────────────────────────────
  // Nothing points anywhere. Names, creation order and dates are not evidence
  // and are never consulted.
  if (!parent && childIds.length === 0) {
    return { kind: "unlinked", evidence };
  }

  // ── Mixed or duplicated child sources ────────────────────────────────────
  if (childIds.length > 1) return review(NEEDS_REVIEW_REASONS.MIXED_CHILD_SOURCES);
  if (boundChildren.length > childIds.length) {
    // Two children naming the SAME Project: one Tasks Project, two synchronizing
    // Timelines, each deleting the other's rows on every reconcile (F8).
    return review(NEEDS_REVIEW_REASONS.DUPLICATE_CHILD_SOURCES);
  }

  // ── Parent=A and child=B ─────────────────────────────────────────────────
  if (parent && childIds.length === 1 && childIds[0] !== parent) {
    return review(NEEDS_REVIEW_REASONS.PARENT_CHILD_CONFLICT);
  }

  const candidate = parent ?? childIds[0];

  // ── Missing Tasks Project ────────────────────────────────────────────────
  const project = context.tasksProjects.get(candidate);
  if (!project?.exists) {
    // Preserved, not deleted: the binding records that sync is off and the
    // couple's content and publications stay exactly as they are.
    const primary = boundChildren[0] ?? workspace.children[0] ?? null;
    return primary
      ? {
          kind: "orphaned",
          tasksWorkspaceId: candidate,
          timelineWorkspaceSlug: workspace.slug,
          primaryTimelineSlug: primary.slug,
          evidence,
        }
      : review(NEEDS_REVIEW_REASONS.NO_CHILD_TIMELINE);
  }

  // ── Multiple Timeline candidates for one Tasks ID ────────────────────────
  const claimants = context.claimantsByTasksId.get(candidate) ?? new Set();
  if (claimants.size > 1) {
    return review(NEEDS_REVIEW_REASONS.MULTIPLE_TIMELINE_CANDIDATES);
  }

  const existing = context.existingBindings.get(candidate);
  if (existing) {
    return existing.timelineWorkspaceSlug === workspace.slug
      ? { kind: "already_bound", tasksWorkspaceId: candidate, timelineWorkspaceSlug: workspace.slug, evidence }
      : review(NEEDS_REVIEW_REASONS.CLAIMED_ELSEWHERE);
  }

  // ── Which child is the primary Timeline ──────────────────────────────────
  if (parent) {
    // Row 1: parent=A and exactly one child=A. The parent mirror was itself
    // written by one of the three ownership-gated binding statements, so the
    // ownership proof for this row already happened; normalizing it grants
    // nothing new (Tasks membership remains the only authorization boundary,
    // ADR 0001 §6.6).
    if (boundChildren.length === 1) {
      return {
        kind: "auto_bind",
        rule: "parent-and-one-matching-child",
        tasksWorkspaceId: candidate,
        timelineWorkspaceSlug: workspace.slug,
        primaryTimelineSlug: boundChildren[0].slug,
        provenance: "legacy_exact",
        mirrors: { parent: false, child: false },
        evidence,
      };
    }
    // Row 2: parent=A and exactly one child TOTAL, which is unbound. The
    // global uniqueness this row demands was proved by the claimant and
    // existing-binding checks above.
    if (workspace.children.length === 1 && boundChildren.length === 0) {
      return {
        kind: "auto_bind",
        rule: "parent-and-one-unbound-child",
        tasksWorkspaceId: candidate,
        timelineWorkspaceSlug: workspace.slug,
        primaryTimelineSlug: workspace.children[0].slug,
        provenance: "legacy_exact",
        mirrors: { parent: false, child: true },
        evidence,
      };
    }
    if (workspace.children.length === 0) return review(NEEDS_REVIEW_REASONS.NO_CHILD_TIMELINE);
    // Several unbound children and no way to tell which is the primary. "The
    // first one" is precisely the inference this wave exists to remove.
    return review(NEEDS_REVIEW_REASONS.AMBIGUOUS_PRIMARY);
  }

  // Row 3: parent unbound, exactly one child=A, and Tasks proves the local
  // owner IS the Project's owner. Without that proof this would let any
  // Timeline claim any Project it happens to name.
  if (!project.ownerClerkSubject) {
    // Missing owner identity is missing identity, not permission (plan §6.4
    // step 9, and DECISIONS D-019's null clerk_id case).
    return review(NEEDS_REVIEW_REASONS.OWNER_IDENTITY_UNPROVED);
  }
  if (project.ownerClerkSubject !== workspace.ownerUserId) {
    return review(NEEDS_REVIEW_REASONS.OWNER_IDENTITY_UNPROVED);
  }
  return {
    kind: "auto_bind",
    rule: "unbound-parent-one-owned-child",
    tasksWorkspaceId: candidate,
    timelineWorkspaceSlug: workspace.slug,
    primaryTimelineSlug: boundChildren[0].slug,
    provenance: "legacy_exact",
    mirrors: { parent: true, child: false },
    evidence,
  };
}

/**
 * Build the global claim index the classifier needs.
 *
 * A claim is any pointer at a Tasks Project id, from either mirror. Counting
 * them globally is what makes "no other workspace, child, or binding claims A"
 * a fact rather than a hope.
 */
export function buildClaimantIndex(workspaces) {
  const claimants = new Map();
  const claim = (tasksId, slug) => {
    if (!tasksId) return;
    if (!claimants.has(tasksId)) claimants.set(tasksId, new Set());
    claimants.get(tasksId).add(slug);
  };
  for (const workspace of workspaces) {
    claim(workspace.suiteWorkspaceId, workspace.slug);
    for (const child of workspace.children) claim(child.sourceTasksWorkspaceId, workspace.slug);
  }
  return claimants;
}

export function summarizeClassifications(results) {
  const summary = {
    total: results.length,
    autoBind: 0,
    alreadyBound: 0,
    orphaned: 0,
    unlinked: 0,
    needsReview: 0,
    needsReviewByReason: {},
    autoBindByRule: {},
  };
  for (const result of results) {
    if (result.kind === "auto_bind") {
      summary.autoBind += 1;
      summary.autoBindByRule[result.rule] = (summary.autoBindByRule[result.rule] ?? 0) + 1;
    } else if (result.kind === "already_bound") summary.alreadyBound += 1;
    else if (result.kind === "orphaned") summary.orphaned += 1;
    else if (result.kind === "unlinked") summary.unlinked += 1;
    else {
      summary.needsReview += 1;
      summary.needsReviewByReason[result.reason] = (summary.needsReviewByReason[result.reason] ?? 0) + 1;
    }
  }
  return summary;
}
