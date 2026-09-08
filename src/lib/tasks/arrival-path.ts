import { MY_WORK_APP_PATH, PRODUCT_APP_PATHS, taskFocusPath } from "@/lib/product-urls";
import type { ProjectId } from "@/lib/projects/project-ref";
import { withActiveProject } from "@/lib/projects/project-url";

export type TasksArrivalSurface = "tasks" | "my-work" | "archive" | "task-focus";

/** Fixed local destinations; an object route derives authority from its task. */
export function tasksArrivalPath(surface: TasksArrivalSurface, projectId: ProjectId, taskId?: string): string {
  if (surface === "task-focus") {
    if (!taskId) throw new Error("A task destination requires its task ID");
    return taskFocusPath(taskId);
  }
  const path = surface === "archive" ? "/app/archived" : surface === "my-work" ? MY_WORK_APP_PATH : PRODUCT_APP_PATHS.tasks;
  const target = withActiveProject(path, projectId);
  return surface === "tasks" && taskId ? `${target}&task=${encodeURIComponent(taskId)}` : target;
}
