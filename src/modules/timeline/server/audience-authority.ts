import "server-only";

import type { Workspace } from "@/modules/timeline/server/db/timeline-schema";
import {
  assertSourceProvenance,
  type SourceProvenance,
} from "@/modules/timeline/lib/audience-timeline";
import { getCurrentTasksWorkspaceContext } from "@/modules/timeline/server/sync/tasks-workspace-context";

export type AudienceMutationWorkspace = Pick<
  Workspace,
  "slug" | "ownerUserId" | "suiteWorkspaceId"
>;

export type AudienceSourceAuthority = Readonly<
  | { kind: "manual-local"; sourceWorkspaceId: string }
  | { kind: "tasks"; sourceWorkspaceId: string }
>;

const CURRENT_MEMBERSHIP_ERROR =
  "Timeline could not confirm your current membership in the connected Signal Tasks workspace.";

export const ARCHIVED_PUBLISH_ERROR =
  "This project is archived, so no new shared link can be made. Existing links can still be switched off. Restore the project in Tasks to publish again.";

/**
 * A suite workspace id is a routing hint, not durable authority. Connected
 * workspaces must prove current Tasks membership immediately before a
 * publication mutation. Workspaces that have never been connected retain the
 * manual-local path and are kept separate with a Timeline-owned source id.
 */
export async function requireFreshAudienceMutationAuthority(
  userId: string,
  workspace: AudienceMutationWorkspace,
): Promise<AudienceSourceAuthority> {
  if (workspace.ownerUserId !== userId) throw new TypeError("Workspace not found");

  if (!workspace.suiteWorkspaceId) {
    return {
      kind: "manual-local",
      sourceWorkspaceId: `timeline:${workspace.slug}`,
    };
  }

  // Fail closed on every non-member answer, including "could not ask". A
  // publication mutation must not proceed on an unproved membership, so the
  // three outcomes collapse here deliberately — and, unlike the read paths,
  // collapsing them costs nothing: this is a write the actor initiated and can
  // repeat, not a state they are shown on arrival.
  const membership = await getCurrentTasksWorkspaceContext(
    userId,
    workspace.suiteWorkspaceId,
  );
  const current = membership.kind === "member" ? membership.context : null;
  if (!current || current.workspaceId !== workspace.suiteWorkspaceId) {
    throw new TypeError(CURRENT_MEMBERSHIP_ERROR);
  }
  // F6 / ADR 0001 §5. This function gates exactly the three acts that MINT a
  // bearer link — create, publish, rotate — and an archived Project accepts no
  // new association. Revoke and unpublish do not come through here and must
  // not: switching a link off is the security move, and it stays reachable
  // whatever state the Project is in.
  if (current.archivedAt !== null) throw new TypeError(ARCHIVED_PUBLISH_ERROR);
  return { kind: "tasks", sourceWorkspaceId: current.workspaceId };
}

/** The mutation callback cannot run until the fresh authority check succeeds. */
export async function withFreshAudienceMutationAuthority<T>(
  userId: string,
  workspace: AudienceMutationWorkspace,
  mutate: (authority: AudienceSourceAuthority) => Promise<T>,
): Promise<T> {
  const authority = await requireFreshAudienceMutationAuthority(userId, workspace);
  return mutate(authority);
}

/** Manual-local publication may never launder a synced Tasks source row. */
export function assertAudienceSourceAuthority(
  authority: AudienceSourceAuthority,
  provenance: SourceProvenance,
): void {
  if (authority.kind === "manual-local") {
    if (
      provenance.kind !== "manual" ||
      provenance.sourceTasksWorkspaceId !== null
    ) {
      throw new TypeError(
        "Connect and reauthorize this workspace before publishing Tasks-derived milestones",
      );
    }
    return;
  }
  assertSourceProvenance(provenance, authority.sourceWorkspaceId);
}
