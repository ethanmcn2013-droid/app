import { requireAppAccessTasks } from "@/server/app-access";
import TimelineProjectPage from "@/modules/timeline/app/plan/[projectSlug]/page";

export { generateMetadata } from "@/modules/timeline/app/plan/[projectSlug]/page";
export const dynamic = "force-dynamic";

export default async function TimelineProjectRoute(props: {
  params: Promise<{ projectSlug: string }>;
  searchParams: Promise<{ workspaceId?: string; planningPeriodId?: string }>;
}) {
  await requireAppAccessTasks();
  return <TimelineProjectPage {...props} />;
}
