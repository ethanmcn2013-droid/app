"use strict";

// Only request identity, the owned test DB binding and cache invalidation are
// replaced. board.ts and project-authz.ts execute their real persisted logic.
module.exports = {
  getCurrentUser: async () => globalThis.__boardFidelity.actor,
  getActiveWorkspaceOrNull: async () => globalThis.__boardFidelity.workspace,
  db: globalThis.__boardFidelity.db,
  revalidatePath: () => {},
};
