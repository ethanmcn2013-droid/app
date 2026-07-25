import { requireAppAccess } from "@/server/require-app-access";
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
  await requireAppAccess();
  return <AudiencePage {...props} />;
}
