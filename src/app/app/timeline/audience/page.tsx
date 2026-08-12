import { requireAppAccessTasks } from "@/server/app-access";
import AudiencePage from "@/modules/timeline/app/audience/page";

export const dynamic = "force-dynamic";
export { metadata } from "@/modules/timeline/app/audience/page";

export default async function AudienceRoute(props: {
  searchParams: Promise<{
    workspaceId?: string;
    planningPeriodId?: string;
    project?: string;
  }>;
}) {
  await requireAppAccessTasks();
  return <AudiencePage {...props} />;
}
