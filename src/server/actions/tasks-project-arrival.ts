"use server";

import { redirect, RedirectType } from "next/navigation";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { resolveProjectForRoute } from "@/server/projects/route-authz";
import { writeActiveProjectCookie } from "@/server/projects/active-project-cookie";
import { parseProjectId } from "@/lib/projects/project-ref";
import { tasksArrivalPath } from "@/lib/tasks/arrival-path";
import { getTaskDetail } from "@/server/db/queries";
import { isDemoMode } from "@/lib/access-mode";
import { ACTIVE_WORKSPACE_COOKIE_NAME } from "@/server/auth";

export type TasksArrivalActionState = { error: string } | null;

/** Explicit selection from a legacy route refusal. GETs never change context. */
export async function openTasksProjectAction(
  _previous: TasksArrivalActionState,
  form: FormData,
): Promise<TasksArrivalActionState> {
  if (isDemoMode()) return { error: "Project selection is unavailable in this demo." };
  let target: string;
  try {
    const rawId = form.get("workspaceId");
    const id = parseProjectId(typeof rawId === "string" ? rawId : null);
    const surface = form.get("surface");
    const task = form.get("task");
    if (!id || form.getAll("workspaceId").length !== 1 || form.getAll("surface").length !== 1 || form.getAll("task").length > 1 ||
      (surface !== "tasks" && surface !== "my-work" && surface !== "archive" && surface !== "task-focus") ||
      (task !== null && (typeof task !== "string" || task.length > 200))) {
      return { error: "This project link is not available." };
    }
    const project = await resolveProjectForRoute(id);
    if (project.kind !== "ready" || project.workspaceId !== id) return { error: "This project is not available to open. Return to Home to choose another project." };
    // A copied object recovery form may outlive a move/deletion. The object
    // must still belong to this exact proven Project before preferences move.
    if (surface === "task-focus" && (!task || !await getTaskDetail(task, id))) {
      return { error: "This task is not available to open." };
    }
    target = tasksArrivalPath(surface, id, task ?? undefined);
    await writeActiveProjectCookie(id);
    const store = await cookies();
    store.set(ACTIVE_WORKSPACE_COOKIE_NAME, id, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });
  } catch {
    return { error: "The project could not be opened. Please try again." };
  }
  revalidatePath("/app", "layout");
  redirect(target, RedirectType.push);
}
