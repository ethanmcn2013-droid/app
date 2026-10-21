import { requireAppAccessTasks } from "@/server/app-access";
import { resolveProjectForRoute } from "@/server/projects/route-authz";
import { loadProjectFiles } from "@/server/projects/project-files";
import { ActiveProjectRouteSync } from "@/components/app/active-project-route-sync";
import { FilesView, FilesUnavailable } from "@/components/app/files/files-view";
import { FilesShelfView } from "@/components/app/files-shelf/files-shelf-view";
import { parseShelfSource } from "@/components/app/files-shelf/shelf-model";
import { filesSourcesShelfEnabled } from "@/server/files-sources-shelf-gate";
import { isDemoMode } from "@/lib/access-mode";

export const dynamic = "force-dynamic";
export const metadata = { title: "Files · Signal Studio" };

/**
 * /app/files: every file and link attached to a task in the active Project.
 * The Project comes from the same route boundary as Tasks, so a stale cookie
 * or a Project the reader cannot open is one quiet "unavailable" answer.
 * `?archived=1` also lists files on archived tasks; they are left out
 * otherwise, as on every board view.
 *
 * Operators (`filesSourcesShelfEnabled`) see the internal Sources + shelf
 * redesign over the same read, with `?source=` opening one folder. Everyone
 * else sees `FilesView` exactly as before.
 */
export default async function FilesPage({ searchParams }: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAppAccessTasks();
  const params = await searchParams ?? {};
  const requested = typeof params.workspaceId === "string" ? params.workspaceId : null;
  const decision = await resolveProjectForRoute(requested);
  if (decision.kind === "unavailable" || decision.kind === "empty") {
    return <main id="app-main-content" tabIndex={-1} className="flex min-h-0 flex-1 flex-col">
      <ActiveProjectRouteSync project={null} requestedProjectId={requested} />
      <FilesUnavailable />
    </main>;
  }
  const [read, shelf] = await Promise.all([
    loadProjectFiles(decision.workspaceId, { includeArchived: params.archived === "1" }),
    filesSourcesShelfEnabled(),
  ]);
  return <main id="app-main-content" tabIndex={-1} className="flex min-h-0 flex-1 flex-col">
    <ActiveProjectRouteSync project={decision.project} requestedProjectId={requested} />
    {shelf ? (
      <FilesShelfView
        projectName={decision.name}
        read={read}
        sample={isDemoMode()}
        requestedProjectId={requested}
        initialSource={parseShelfSource(params.source)}
      />
    ) : (
      <FilesView
        projectName={decision.name}
        read={read}
        sample={isDemoMode()}
        requestedProjectId={requested}
      />
    )}
  </main>;
}
