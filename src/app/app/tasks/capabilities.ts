import "server-only";

import { isDemoMode } from "@/lib/access-mode";
import { resolveProjectForRoute } from "@/server/projects/route-authz";

/**
 * What the person may do on a Tasks view, from the verified project. This
 * only decides which controls to show; every server action re-authorises
 * on its own. Review mode can preview the view-only state with
 * ?preview=view-only; nothing else can widen or narrow it.
 */
export async function tasksViewCapabilities(
  requested: string | string[] | undefined,
  preview: string | undefined,
): Promise<{ canEdit: boolean; canManage: boolean }> {
  const decision = await resolveProjectForRoute(requested);
  const capabilities =
    decision.kind === "ready" || decision.kind === "archived" ? decision.project.capabilities : null;
  const previewViewOnly = isDemoMode() && preview === "view-only";
  const canEdit = !previewViewOnly && capabilities?.createOrEditTasks !== false;
  return { canEdit, canManage: canEdit && capabilities?.manageProject !== false };
}
