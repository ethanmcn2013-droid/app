"use server";

/** Projects sidebar tree. This public Server Action always resolves its own actor. */
import { isDemoMode } from "@/lib/access-mode";
import { listMyWorkspaces } from "@/server/auth";
import {
  getDemoProjectsTreeData,
  getProjectsTreeForWorkspaces,
  type ProjectsTreeData,
} from "@/server/projects/projects-tree-read";

export type { ProjectsTreeLeaf, ProjectsTreeGroup, ProjectsTreeData } from "@/server/projects/projects-tree-read";

export async function getProjectsTreeData(): Promise<ProjectsTreeData> {
  if (isDemoMode()) return getDemoProjectsTreeData();
  return getProjectsTreeForWorkspaces(await listMyWorkspaces());
}
