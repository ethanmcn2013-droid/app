import "server-only";

import { isDemoMode } from "@/lib/access-mode";
import { parseProjectId, type ProjectId } from "@/lib/projects/project-ref";
import { authorizeStoredProject } from "@/server/actions/project-authz";
import { getCurrentUser } from "@/server/auth";

const projectDriveAuthorizationBrand: unique symbol = Symbol(
  "project-drive-authorization",
);

/**
 * A fresh, server-only proof that one person may manage one Project's Drive
 * connection. The private symbol prevents another module from manufacturing
 * this value from a client-supplied Project id.
 */
export type AuthorizedProjectDriveContext = Readonly<{
  actorUserId: string;
  projectId: ProjectId;
  [projectDriveAuthorizationBrand]: true;
}>;

export class ProjectDriveAuthorizationError extends Error {
  constructor() {
    super("That project isn’t available.");
    this.name = "ProjectDriveAuthorizationError";
  }
}

/**
 * The sole minter for Project Drive authority.
 *
 * Demo/review is refused before identity or database access. Production then
 * shape-checks the explicit Project id and freshly proves `manageProject` on
 * that Project, with the archived-project policy enforced.
 */
export async function authorizeProjectDrive(
  candidateProjectId: string | null | undefined,
): Promise<AuthorizedProjectDriveContext> {
  if (isDemoMode()) return Promise.reject(new ProjectDriveAuthorizationError());

  const projectId = parseProjectId(candidateProjectId);
  if (projectId === null) throw new ProjectDriveAuthorizationError();

  const actorUserId = await getCurrentUser();
  const grant = await authorizeStoredProject({
    storedProjectId: projectId,
    capability: "manageProject",
    actorUserId,
    archivePolicy: "enforce",
  });
  if (!grant.ok) throw new ProjectDriveAuthorizationError();

  return Object.freeze({
    actorUserId,
    projectId: grant.projectId,
    [projectDriveAuthorizationBrand]: true as const,
  });
}
