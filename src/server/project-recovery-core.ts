import { parseProjectId } from "@/lib/projects/project-ref";
import type { ProjectRecovery, RecoveryActionResult, RecoveryCursor, TasksRecovery, TimelineRecovery } from "@/lib/projects/recovery";

export type RecoveryDependencies = {
  readTasks: (clerkId: string, projectId: string, cursor: RecoveryCursor) => Promise<TasksRecovery>;
  readTimeline: (clerkId: string, projectId: string, before?: number) => Promise<TimelineRecovery>;
  revokeLink: (clerkId: string, projectId: string, reference: { row: number; fingerprint: string }) => Promise<boolean>;
  unpublishBoard: (clerkId: string, projectId: string) => Promise<boolean>;
  deleteProject: (clerkId: string, projectId: string) => Promise<void>;
  withdrawTimeline: (clerkId: string, projectId: string, publicationId: string, operation: "revoke" | "unpublish") => Promise<boolean>;
};
const unavailable = { kind: "unavailable" } as const;
const refused = { ok: false, message: "That change could not be completed. Refresh and try again." } as const;

/** Failure of one local product store must not hide another product's existing
 * recovery authority. No commercial/shared check or content load is involved. */
export async function readProjectRecoveryWith(dependencies: RecoveryDependencies, clerkId: string, candidate: unknown, cursor: RecoveryCursor = {}): Promise<ProjectRecovery> {
  const projectId = parseProjectId(typeof candidate === "string" ? candidate : null);
  if (!clerkId || !projectId) return { projectId: null, tasks: unavailable, timeline: unavailable };
  const [tasks, timeline] = await Promise.allSettled([
    dependencies.readTasks(clerkId, projectId, cursor),
    dependencies.readTimeline(clerkId, projectId, cursor.publications),
  ]);
  return { projectId, tasks: tasks.status === "fulfilled" ? tasks.value : unavailable,
    timeline: timeline.status === "fulfilled" ? timeline.value : unavailable };
}

export async function runProjectRecoveryWith(dependencies: RecoveryDependencies, clerkId: string, form: FormData): Promise<RecoveryActionResult> {
  if (!(form instanceof FormData)) return refused;
  const candidate = form.get("projectId");
  const projectId = parseProjectId(typeof candidate === "string" ? candidate : null);
  if (!clerkId || !projectId) return refused;
  try {
    switch (form.get("operation")) {
      case "revoke-task-link": {
        const row = form.get("row"), digest = form.get("fingerprint");
        if (typeof row !== "string" || !/^[1-9]\d{0,15}$/.test(row) || !Number.isSafeInteger(Number(row)) || typeof digest !== "string" || !/^[a-f0-9]{64}$/.test(digest)) return refused;
        return await dependencies.revokeLink(clerkId, projectId, { row: Number(row), fingerprint: digest }) ? { ok: true } : refused;
      }
      case "unpublish-board":
        return await dependencies.unpublishBoard(clerkId, projectId) ? { ok: true } : refused;
      case "delete-project": {
        const current = await dependencies.readTasks(clerkId, projectId, {});
        if (current.kind !== "ready" || !current.canDelete || form.get("confirmation") !== current.project.name) return refused;
        // The existing deletion service independently re-proves primary ownership
        // in its durable intent transaction; this UI/read proof is not a grant.
        await dependencies.deleteProject(clerkId, projectId);
        return { ok: true, deleted: true };
      }
      case "revoke-timeline":
      case "unpublish-timeline": {
        const id = form.get("publicationId");
        if (typeof id !== "string" || !/^[A-Za-z0-9_-]{1,80}$/.test(id)) return refused;
        return await dependencies.withdrawTimeline(clerkId, projectId, id, form.get("operation") === "revoke-timeline" ? "revoke" : "unpublish") ? { ok: true } : refused;
      }
      default: return refused;
    }
  } catch {
    // SQL/SDK diagnostics and identifiers never become user-facing errors.
    return refused;
  }
}
