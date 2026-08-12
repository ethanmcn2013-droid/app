import { requireAppAccessTasks } from "@/server/app-access";
import TimelineProjectPreviewPage, {
  metadata,
} from "@/modules/timeline/app/audience/project-preview";

export const dynamic = "force-dynamic";
export { metadata };

export default async function TimelineProjectPreviewRoute(props: {
  params: Promise<{ projectSlug: string }>;
  searchParams: Promise<{ workspaceId?: string; planningPeriodId?: string }>;
}) {
  await requireAppAccessTasks();
  return <TimelineProjectPreviewPage {...props} />;
}
