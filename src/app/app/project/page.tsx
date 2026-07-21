import { getProjectOverviewData } from "@/server/actions/project-overview";
import { ProjectOverview } from "@/components/app/project/project-overview";

// Inherited from the /app layout: force-dynamic
export const dynamic = "force-dynamic";

/**
 * /app/project — overview for the active workspace (Project, D-011).
 *
 * No slug param. The active workspace is already scoped by the layout
 * (getActiveWorkspace in AppShell) and workspace switching changes the
 * active workspace in the cookie, so this page always renders the
 * workspace the user has in view. This keeps the route additive and
 * safe for the unified-app merge.
 *
 * Server component: fetches all overview data then passes it to the
 * ProjectOverview client component (which owns the interactive controls
 * for declared status and target date).
 */
export default async function ProjectPage() {
  const data = await getProjectOverviewData();
  return <ProjectOverview data={data} />;
}
