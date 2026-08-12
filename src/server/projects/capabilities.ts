import "server-only";

/**
 * Project capability model — plan §5.
 *
 * Two things this file is NOT:
 *
 *  - it is not authorization. Every server action reauthorizes against a fresh
 *    membership query regardless of what the catalog said (ADR 0001 §9). These
 *    values exist so a menu cannot offer an action the caller will then be
 *    refused;
 *  - it is not a role store. `role` is derived per request from
 *    `workspace_members.role` and `workspaces.owner_user_id`, never from the
 *    local Timeline owner field, a slug, a Planning Period, or UI state.
 *
 * The membership value `role = "owner"` is codified as **co-owner** (plan §5,
 * final paragraph): reversible Project management and bound-primary Timeline
 * curation/publish/revoke after a fresh server capability check; permanent
 * delete and ownership transfer stay primary-owner only.
 */

import type { ProjectCapabilities, ProjectRole } from "@/lib/projects/project-ref";

export function resolveProjectRole(input: {
  membershipRole: "owner" | "member";
  workspaceOwnerUserId: string | null;
  actorUserId: string;
}): ProjectRole {
  if (
    input.membershipRole === "owner" &&
    input.workspaceOwnerUserId !== null &&
    input.workspaceOwnerUserId === input.actorUserId
  ) {
    return "primary-owner";
  }
  return input.membershipRole === "owner" ? "owner" : "member";
}

const NONE: ProjectCapabilities = Object.freeze({
  open: false,
  viewPrivateTimeline: false,
  createOrEditTasks: false,
  manageProject: false,
  moveIntoPlanningPeriod: false,
  curatePrimaryTimeline: false,
  publishOrRevokeTimeline: false,
  deleteOrTransferOwnership: false,
});

/**
 * Capability defaults.
 *
 * `archived` narrows rather than widens: an archived Project stays openable
 * and readable, and everything that would write new association or publish new
 * outward artifacts is withdrawn (ADR 0001 §5). Notes' private editability is
 * not modelled here — a raw Note authorizes on `note.userId`, not on Project
 * membership, so it is not a Project capability at all.
 *
 * `ownsPlanningPeriod` is passed separately because "move into owner's
 * Planning Period" is allowed for a co-owner only when they own or manage that
 * period, which the catalog knows and the role alone does not.
 */
export function projectCapabilities(input: {
  role: ProjectRole;
  archived: boolean;
  ownsPlanningPeriod: boolean;
}): ProjectCapabilities {
  const { role, archived, ownsPlanningPeriod } = input;

  const isPrimaryOwner = role === "primary-owner";
  const isCoOwner = role === "owner";
  const manages = isPrimaryOwner || isCoOwner;

  if (archived) {
    return Object.freeze({
      ...NONE,
      open: true,
      viewPrivateTimeline: true,
      // Restore is the one management action an archived Project still needs;
      // it is the inverse of archive, and plan §5 lists them as one capability.
      manageProject: manages,
      deleteOrTransferOwnership: isPrimaryOwner,
    });
  }

  return Object.freeze({
    open: true,
    viewPrivateTimeline: true,
    createOrEditTasks: true,
    manageProject: manages,
    moveIntoPlanningPeriod: isPrimaryOwner || (isCoOwner && ownsPlanningPeriod),
    curatePrimaryTimeline: manages,
    publishOrRevokeTimeline: manages,
    deleteOrTransferOwnership: isPrimaryOwner,
  });
}
