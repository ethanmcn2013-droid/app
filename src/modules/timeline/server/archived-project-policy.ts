import "server-only";

import { getCurrentTasksWorkspaceContext } from "@/modules/timeline/server/sync/tasks-workspace-context";

/**
 * Is the Tasks Project behind this Timeline archived?
 *
 * ── THE DEFECT (F6) ────────────────────────────────────────────────────────
 * `resolveCanonicalTimeline` returns `archived` for an archived Project, and
 * `resolveTimelineContext` then threw the distinction away: it kept the
 * workspace and dropped the word. The plan page rendered the same full edit
 * surface it renders for a live Project — rename, reorder, hide, add, publish
 * — while ADR 0001 §5 says an archived Project is read-only for every
 * Project-scoped operation. The resolver was right and nothing downstream
 * listened.
 *
 * ── THE THREE ANSWERS, AND WHY THEY ARE THREE ──────────────────────────────
 * `archived` is proved. `active` is proved. `unknown` is neither, and it must
 * not be collapsed into either of them — that is the same "an empty result is
 * not a proof" rule that produced this programme's data-loss defects
 * (DECISIONS D-018). Each caller then decides what an unproved answer costs:
 *
 *   - CURATION (rename, reorder, hide, add a manual milestone) refuses only on
 *     a PROVED archive. On `unknown` it behaves exactly as it did before,
 *     because failing closed there would take every owner's Timeline read-only
 *     for the length of any Tasks outage, and the harm being prevented is a
 *     private edit to a Timeline the owner still owns.
 *
 *   - PUBLISHING (create, publish, rotate a bearer link) refuses on anything
 *     that is not a proved-active member. That path already required a proved
 *     member (`requireFreshAudienceMutationAuthority`), so failing closed
 *     costs no availability that was not already spent — and the harm being
 *     prevented is a new public link to an archived Project, which is
 *     exposure rather than inconvenience.
 *
 * Revoke and unpublish are deliberately NOT gated by any of this. Being able
 * to switch a link off must never depend on a second database answering, and
 * "you cannot publish but you can still revoke" is the shape ADR 0001 §5 asks
 * for in as many words: *existing bearer links remain manageable and
 * revocable; new publishing is disabled.*
 */
export type BoundProjectArchiveState =
  | Readonly<{ kind: "active" }>
  | Readonly<{ kind: "archived" }>
  | Readonly<{ kind: "unknown"; reason: "unbound" | "not-a-member" | "unavailable" }>;

export async function readBoundProjectArchiveState(
  actorUserId: string,
  workspace: Readonly<{ suiteWorkspaceId: string | null }>,
): Promise<BoundProjectArchiveState> {
  // A Timeline bound to no Project has no Project to be archived. This is the
  // manual-local case, and it is not a failure.
  if (!workspace.suiteWorkspaceId) return { kind: "unknown", reason: "unbound" };

  const membership = await getCurrentTasksWorkspaceContext(
    actorUserId,
    workspace.suiteWorkspaceId,
  );
  if (membership.kind === "unavailable") return { kind: "unknown", reason: "unavailable" };
  if (membership.kind === "not-a-member") return { kind: "unknown", reason: "not-a-member" };
  return membership.context.archivedAt !== null ? { kind: "archived" } : { kind: "active" };
}

/** The one sentence every archived refusal says, so it is said the same way. */
export const ARCHIVED_PROJECT_REFUSAL =
  "This project is archived, so its timeline is read-only. Restore the project in Tasks to make changes.";
