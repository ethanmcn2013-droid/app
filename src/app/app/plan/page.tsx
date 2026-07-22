import "@/modules/timeline/timeline.css";
import { requireAppAccess } from "@/server/require-app-access";
import { TimelineHome } from "@/modules/timeline";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Timeline · Tasks",
};

/**
 * /app/plan — Timeline module dashboard.
 *
 * Defence-in-depth gate (AD-005): requireAppAccess() is called here even
 * though the /app layout's AppShell already enforces it. The function is
 * a read-then-redirect with no side effects; calling it twice is harmless.
 */
export default async function PlanPage({
  searchParams,
}: {
  searchParams: Promise<{ workspaceId?: string; planningPeriodId?: string }>;
}) {
  await requireAppAccess();
  return <TimelineHome searchParams={searchParams} />;
}
