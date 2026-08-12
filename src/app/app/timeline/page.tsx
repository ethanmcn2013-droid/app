import "@/modules/timeline/timeline.css";
import { requireAppAccessTasks } from "@/server/app-access";
import { TimelineHome } from "@/modules/timeline";

export const dynamic = "force-dynamic";
export const metadata = { title: "Timeline · Signal Studio" };

export default async function TimelinePage({
  searchParams,
}: {
  searchParams: Promise<{ workspaceId?: string; planningPeriodId?: string }>;
}) {
  await requireAppAccessTasks();
  return <TimelineHome searchParams={searchParams} />;
}
