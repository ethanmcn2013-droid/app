import "server-only";

import { createHash } from "node:crypto";
import { SEED_TASKS, type Task } from "@/lib/data";
import { applyDomainOverlay, type DomainId } from "@/lib/domains";

export type MaterializedDomainSeedTask = Readonly<{
  canonicalTaskId: string;
  task: Task;
}>;

function workspaceTaskId(workspaceId: string, canonicalTaskId: string): string {
  const digest = createHash("sha256")
    .update(JSON.stringify(["workspace-domain-seed", workspaceId, canonicalTaskId]))
    .digest("hex")
    .slice(0, 24);
  return `t-${digest}`;
}

/**
 * Give a canonical starter pack globally unique, stable task ids for one
 * Project and remap every dependency to that same Project-local id set.
 */
export function materializeWorkspaceDomainSeed(
  workspaceId: string,
  domain: DomainId,
): readonly MaterializedDomainSeedTask[] {
  if (!workspaceId || workspaceId !== workspaceId.trim()) {
    throw new TypeError("workspaceId must be a non-empty canonical id");
  }
  const overlaid = applyDomainOverlay(SEED_TASKS, domain);
  const idByCanonicalId = new Map(
    overlaid.map(
      (task) => [task.id, workspaceTaskId(workspaceId, task.id)] as const,
    ),
  );
  return Object.freeze(
    overlaid.map((canonicalTask) => ({
      canonicalTaskId: canonicalTask.id,
      task: {
        ...canonicalTask,
        id: idByCanonicalId.get(canonicalTask.id)!,
        blockedBy: canonicalTask.blockedBy?.map((blockedById) => {
          const replacementId = idByCanonicalId.get(blockedById);
          if (!replacementId) {
            throw new Error("Seed dependency does not name a canonical task.");
          }
          return replacementId;
        }),
      },
    })),
  );
}
