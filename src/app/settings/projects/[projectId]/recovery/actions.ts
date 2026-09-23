"use server";

import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { isDemoMode } from "@/lib/access-mode";
import { parseProjectId } from "@/lib/projects/project-ref";
import { projectRecoveryPath, type RecoveryActionResult } from "@/lib/projects/recovery";
import { runProjectRecovery } from "@/server/project-recovery";

export async function projectRecoveryAction(form: FormData): Promise<RecoveryActionResult> {
  if (isDemoMode()) return { ok: false, message: "Recovery controls are read-only in this preview." };
  try {
    const { userId } = await auth();
    if (!userId || !(form instanceof FormData)) return { ok: false, message: "Sign in again to use recovery controls." };
    const result = await runProjectRecovery(userId, form);
    const candidate = form.get("projectId");
    const projectId = parseProjectId(typeof candidate === "string" ? candidate : null);
    if (result.ok && projectId) {
      revalidatePath(projectRecoveryPath(projectId));
      revalidatePath("/app", "layout");
    }
    return result;
  } catch {
    return { ok: false, message: "That change could not be completed. Refresh and try again." };
  }
}
