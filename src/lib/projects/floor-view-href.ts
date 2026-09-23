import { TASKS_VIEW_PATHS, type TasksViewId } from "@/lib/product-urls";
import type { ProjectId } from "@/lib/projects/project-ref";
import { withActiveProject } from "@/lib/projects/project-url";

/** A Floor view switch keeps the authorized Project and any open task. */
export function floorViewHref(
  view: TasksViewId,
  projectId: ProjectId | null,
  taskId: string | null,
): string {
  const params = new URLSearchParams();
  if (taskId) params.set("task", taskId);
  const localPath = `${TASKS_VIEW_PATHS[view]}${params.size ? `?${params}` : ""}`;
  return projectId ? withActiveProject(localPath, projectId) : localPath;
}
