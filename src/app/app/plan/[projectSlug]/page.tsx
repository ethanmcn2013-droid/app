import { requireAppAccess } from "@/server/require-app-access";
import PlanProjectPage from "@/modules/timeline/app/plan/[projectSlug]/page";

export { generateMetadata } from "@/modules/timeline/app/plan/[projectSlug]/page";
export const dynamic = "force-dynamic";

/**
 * /app/plan/[projectSlug] — Timeline module curation surface.
 *
 * Defence-in-depth gate (AD-005): requireAppAccess() is called here even
 * though the /app layout's AppShell already enforces it. Calling it twice
 * is harmless and ensures the gate is never silently dropped.
 */
export default async function PlanProjectRoute(props: {
  params: Promise<{ projectSlug: string }>;
  searchParams: Promise<{ workspaceId?: string; planningPeriodId?: string }>;
}) {
  await requireAppAccess();
  return <PlanProjectPage {...props} />;
}
