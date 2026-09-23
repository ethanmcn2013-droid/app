"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { getTasks } from "@/server/db/queries";
import {
  applyTemplateToWorkspace, remixTemplateIntoWorkspace, requireTemplateRequestId,
} from "@/server/db/apply-template";
import { emitTasksChanged } from "@/server/events";
import { ACTIVE_WORKSPACE_COOKIE_NAME, getCurrentUser } from "@/server/auth";
import { authorizeProjectCandidate } from "@/server/actions/project-authz";
import { type Task } from "@/lib/data";
import { isDemoMode } from "@/lib/access-mode";
import { DEMO_WORKSPACE_ID, DEMO_WORKSPACE_SLUG, demoTasks } from "@/server/demo/tasks-demo";

/**
 * Additive application to the explicit Project. Reuse the same request id
 * after a lost response; a new id deliberately appends another template.
 * No current UI imports this action: callers must supply their intent identity
 * rather than having the server guess it from a cookie or template id.
 */
export async function applyTemplateAction(
  templateId: string,
  request: { workspaceId: string; requestId: string },
): Promise<Task[]> {
  if (isDemoMode()) return demoTasks();
  const requestId = requireTemplateRequestId(request?.requestId);
  const actorUserId = await getCurrentUser();
  const grant = await authorizeProjectCandidate({
    candidateProjectId: request?.workspaceId,
    actorUserId,
    capability: "createOrEditTasks",
    archivePolicy: "enforce",
  });
  if (!grant.ok) throw new Error("That project isn’t available.");
  const ws = grant.projectId;
  await applyTemplateToWorkspace(templateId, ws, { requestId }, { actorUserId });
  revalidatePath("/app", "layout");
  emitTasksChanged({ kind: "tasks" });
  return getTasks(ws);
}

/** One new owned Project per explicit remix request, including all seed rows.
 * Retry returns that same Project; a new request intentionally creates another.
 */
export async function remixTemplateAction(
  templateId: string,
  requestId: string,
): Promise<{ ok: true; workspaceId: string; slug: string }> {
  if (isDemoMode()) {
    return { ok: true, workspaceId: DEMO_WORKSPACE_ID, slug: DEMO_WORKSPACE_SLUG };
  }
  const actorUserId = await getCurrentUser();
  const { workspaceId, slug } = await remixTemplateIntoWorkspace(templateId, requestId, { actorUserId });
  // Post-commit side effects may be retried without creating another Project.
  const c = await cookies();
  c.set(ACTIVE_WORKSPACE_COOKIE_NAME, workspaceId, {
    path: "/",
    sameSite: "lax",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 30,
  });
  revalidatePath("/app", "layout");
  emitTasksChanged({ kind: "tasks" });
  return { ok: true, workspaceId, slug };
}
