import "server-only";

import { getCurrentUser } from "@/server/auth";
import { callerIsAdmin } from "@/server/admin";
import { isDemoMode } from "@/lib/access-mode";

/**
 * Internal gate for the Files "Sources + shelf" redesign.
 *
 * True only for operators, decided on the server by the existing
 * `callerIsAdmin` (ADMIN_USER_IDS), the same check that gates Settings'
 * sample-data section. Everyone else, demo and review builds included, keeps
 * today's Files page unchanged. Any failure to resolve the caller or decide
 * the question answers false: the gate fails closed.
 */

export type FilesShelfGateDeps = Readonly<{
  currentUser: () => Promise<string>;
  isAdmin: (userId: string) => boolean;
  demo: () => boolean;
}>;

const DEFAULT_DEPS: FilesShelfGateDeps = {
  currentUser: getCurrentUser,
  isAdmin: callerIsAdmin,
  demo: isDemoMode,
};

export async function filesSourcesShelfEnabled(deps: FilesShelfGateDeps = DEFAULT_DEPS): Promise<boolean> {
  try {
    if (deps.demo()) return false;
    const userId = await deps.currentUser();
    if (typeof userId !== "string" || userId.length === 0) return false;
    return deps.isAdmin(userId) === true;
  } catch {
    return false;
  }
}
