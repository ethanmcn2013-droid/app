import { getArchivedTasks } from "@/server/db/queries";
import { requireRouteProjectId } from "@/server/projects/route-authz";
import { AppPageHeader } from "@/components/app/page-header";
import { ArchivedApp } from "@/components/app/archived/archived-app";
import { TasksRuntimePageMount } from "@/components/app/tasks-runtime-mount";

export const dynamic = "force-dynamic";

export default async function ArchivedPage() {
  // WP3: fail closed rather than fall through to LEGACY_WORKSPACE_ID (D-005).
  // The runtime mounts with no explicit `workspaceId` on purpose (D-022):
  // this page's own read below is ambient, so handing the chrome an explicit
  // Project would render one Project's chrome over another's archive — the
  // URL/content inequality ADR 0001 §2 forbids. Both halves stay ambient.
  const ws = await requireRouteProjectId();
  const tasks = await getArchivedTasks(ws);
  return (
    <TasksRuntimePageMount>
      <AppPageHeader />
      <ArchivedApp tasks={tasks} />
    </TasksRuntimePageMount>
  );
}
