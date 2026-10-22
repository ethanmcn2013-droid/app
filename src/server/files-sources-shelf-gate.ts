import "server-only";

import { getCurrentUser } from "@/server/auth";
import { callerIsAdmin } from "@/server/admin";
import { isDemoMode } from "@/lib/access-mode";

/**
 * Internal gate for the Files "Sources + shelf" redesign.
 *
 * The production UI rollout can be enabled separately from operator powers.
 * The page still resolves authenticated Project access before loading files.
 * Otherwise true only for operators, decided on the server by the existing
 * `callerIsAdmin` (ADMIN_USER_IDS), the same check that gates Settings'
 * sample-data section. Everyone else, demo and review builds included, keeps
 * today's Files page unchanged. Any failure to resolve the caller or decide
 * the question answers false: the gate fails closed.
 */

export type FilesShelfGateDeps = Readonly<{
  currentUser: () => Promise<string>;
  isAdmin: (userId: string) => boolean;
  demo: () => boolean;
  rolloutEnabled?: () => boolean;
}>;

const DEFAULT_DEPS: FilesShelfGateDeps = {
  currentUser: getCurrentUser,
  isAdmin: callerIsAdmin,
  demo: isDemoMode,
  rolloutEnabled: () => process.env.FILES_SOURCES_SHELF_ENABLED === "true",
};

export async function filesSourcesShelfEnabled(deps: FilesShelfGateDeps = DEFAULT_DEPS): Promise<boolean> {
  try {
    if (deps.demo()) return false;
    const userId = await deps.currentUser();
    if (typeof userId !== "string" || userId.length === 0) return false;
    if (deps.rolloutEnabled?.() === true) return true;
    return deps.isAdmin(userId) === true;
  } catch {
    return false;
  }
}
