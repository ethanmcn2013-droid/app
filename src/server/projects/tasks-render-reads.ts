import "server-only";

import type { UserId } from "@/lib/data";
import { DEMO_USER_ID } from "@/server/demo/tasks-demo";
import { demoMemberWorkspaces, type MemberWorkspace } from "@/server/projects/member-workspaces";
import { getDemoProjectsTreeData, type ProjectsTreeData } from "@/server/projects/projects-tree-read";

type Dependencies = {
  getCurrentUser: () => Promise<UserId>;
  listMyWorkspacesForUser: (actor: UserId) => Promise<MemberWorkspace[]>;
  getProjectsTreeForWorkspaces: (mine: readonly MemberWorkspace[]) => Promise<ProjectsTreeData>;
  getEdition: (actor: UserId) => Promise<string | null>;
};

/** New promises on every render. Attach all four to the shell's next Promise.all. */
export function startTasksRenderReads(dependencies: Dependencies, demo: boolean, resolvedActor?: UserId) {
  if (demo) {
    return {
      currentUser: Promise.resolve(DEMO_USER_ID),
      myWorkspaces: Promise.resolve(demoMemberWorkspaces()),
      projectsTree: Promise.resolve(getDemoProjectsTreeData()),
      edition: Promise.resolve(null),
    };
  }

  // Starting from a settled promise also captures synchronous adapter throws.
  // Only trusted server callers may supply the actor from their own fresh route proof.
  // This is a value handoff, never a cross-render or action authentication cache.
  const currentUser = Promise.resolve().then(() => resolvedActor ?? dependencies.getCurrentUser());
  const myWorkspaces = currentUser.then((actor) => dependencies.listMyWorkspacesForUser(actor));
  const projectsTree = myWorkspaces.then((mine) => dependencies.getProjectsTreeForWorkspaces(mine));
  const edition = currentUser.then((actor) => dependencies.getEdition(actor));
  return { currentUser, myWorkspaces, projectsTree, edition };
}
