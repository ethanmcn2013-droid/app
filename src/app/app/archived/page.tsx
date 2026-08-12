import { getArchivedTasks } from "@/server/db/queries";
import { requireRouteProjectId } from "@/server/projects/route-authz";
import { AppPageHeader } from "@/components/app/page-header";
import { ArchivedApp } from "@/components/app/archived/archived-app";

export const dynamic = "force-dynamic";

export default async function ArchivedPage() {
  // WP3: fail closed rather than fall through to LEGACY_WORKSPACE_ID (D-005).
  // No explicit `workspaceId` parameter: this page renders inside
  // `TasksRuntimeShell`, whose Project it cannot influence.
  const ws = await requireRouteProjectId();
  const tasks = await getArchivedTasks(ws);
  return (
    <>
      <AppPageHeader />
      <ArchivedApp tasks={tasks} />
    </>
  );
}
