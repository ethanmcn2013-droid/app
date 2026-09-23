import "server-only";

import { isDemoMode } from "@/lib/access-mode";
import {
  parseProjectId,
  type ProjectCapabilities,
  type ProjectId,
  type ProjectRole,
} from "@/lib/projects/project-ref";
import {
  authorizeStoredProject,
  type ProjectCapabilityKey,
} from "@/server/actions/project-authz";
import { getCurrentUser } from "@/server/auth";

const projectDriveAuthorizationBrand: unique symbol = Symbol(
  "project-drive-authorization",
);

/**
 * A fresh, server-only proof of one person's capabilities on one Project's
 * Drive surface. The private symbol prevents another module from
 * manufacturing this value from a client-supplied Project id.
 */
export type AuthorizedProjectDriveContext = Readonly<{
  actorUserId: string;
  projectId: ProjectId;
  role: ProjectRole;
  capabilities: ProjectCapabilities;
  archived: boolean;
  [projectDriveAuthorizationBrand]: true;
}>;

export class ProjectDriveAuthorizationError extends Error {
  constructor() {
    super("That project isn’t available.");
    this.name = "ProjectDriveAuthorizationError";
  }
}

/**
 * Refine an already fresh Project proof at a lower service boundary.
 *
 * A management context cannot be assumed merely because the caller has a
 * branded context: future upload/finalize paths deliberately mint a narrower
 * `createOrEditTasks` proof after deriving the owning Project from the stored
 * resource or task. Exact `true` is required so a malformed or incomplete
 * context is a refusal, never a truthy authorization.
 */
export function assertProjectDriveCapability(
  authorization: AuthorizedProjectDriveContext,
  capability: ProjectCapabilityKey,
): void {
  if (authorization?.capabilities?.[capability] !== true) {
    throw new ProjectDriveAuthorizationError();
  }
}

/**
 * The sole minter for Project Drive authority.
 *
 * Demo/review is refused before identity or database access. Production then
 * shape-checks the explicit Project id and freshly proves the required
 * capability on that Project, with the archived-project policy enforced.
 * Connection, storage, folder and grant management use the `manageProject`
 * default. An upload/finalize entry point may request `createOrEditTasks` only
 * after it has derived this candidate id from the stored resource or task.
 */
export async function authorizeProjectDrive(
  candidateProjectId: string | null | undefined,
  requiredCapability: ProjectCapabilityKey = "manageProject",
): Promise<AuthorizedProjectDriveContext> {
  if (isDemoMode()) return Promise.reject(new ProjectDriveAuthorizationError());

  const projectId = parseProjectId(candidateProjectId);
  if (projectId === null) throw new ProjectDriveAuthorizationError();

  const actorUserId = await getCurrentUser();
  const grant = await authorizeStoredProject({
    storedProjectId: projectId,
    capability: requiredCapability,
    actorUserId,
    archivePolicy: "enforce",
  });
  if (!grant.ok) throw new ProjectDriveAuthorizationError();

  return Object.freeze({
    actorUserId,
    projectId: grant.projectId,
    role: grant.role,
    capabilities: grant.capabilities,
    archived: grant.archived,
    [projectDriveAuthorizationBrand]: true as const,
  });
}
