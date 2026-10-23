"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/server/auth";
import { db } from "@/server/db";
import { renameProject } from "@/server/projects/service";
import { setProjectColorWith } from "@/server/projects/project-appearance";
import { isDemoMode } from "@/lib/access-mode";
import { parseProjectColorIndex } from "@/lib/projects/project-appearance";

export async function renameProjectFromMenuAction(projectId: string, name: string) {
  if (!name.trim() || name.trim().length > 80) throw new Error("Use a project name between 1 and 80 characters.");
  if (!isDemoMode()) await renameProject({ actorUserId: await getCurrentUser(), projectId, name });
  revalidatePath("/app", "layout");
  return { ok: true as const };
}
export async function setProjectColorAction(projectId: string, color: unknown) {
  if (isDemoMode()) {
    const index = parseProjectColorIndex(color);
    if (index === null) throw new Error("Choose a project colour from the palette.");
    return { ok: true as const, colorIndex: index };
  }
  const result = await setProjectColorWith(db, await getCurrentUser(), projectId, color);
  revalidatePath("/app", "layout");
  return result;
}
