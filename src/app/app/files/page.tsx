import { requireAppAccessTasks } from "@/server/app-access";
import { resolveProjectForRoute } from "@/server/projects/route-authz";
import { listProjectFiles } from "@/server/projects/project-files";
import { ActiveProjectRouteSync } from "@/components/app/active-project-route-sync";
import { FilesView, FilesUnavailable } from "@/components/app/files/files-view";
import { isDemoMode } from "@/lib/access-mode";

export const dynamic = "force-dynamic";
export const metadata = { title: "Files · Signal Studio" };

/**
 * /app/files: every file and link attached to a task in the active Project.
 * The Project comes from the same route boundary as Tasks, so a stale cookie
 * or a Project the reader cannot open is one quiet "unavailable" answer.
 */
export default async function FilesPage({ searchParams }: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
} = {}) {
  await requireAppAccessTasks();
  const params = await searchParams ?? {};
  const requested = typeof params.workspaceId === "string" ? params.workspaceId : null;
  const decision = await resolveProjectForRoute(requested);
  if (decision.kind === "unavailable" || decision.kind === "empty") {
    return <>
      <ActiveProjectRouteSync project={null} requestedProjectId={requested} />
      <FilesUnavailable />
    </>;
  }
  const files = await listProjectFiles(decision.workspaceId);
  return <>
    <ActiveProjectRouteSync project={decision.project} requestedProjectId={requested} />
    <FilesView projectName={decision.name} files={files} preview={isDemoMode()} />
  </>;
}
