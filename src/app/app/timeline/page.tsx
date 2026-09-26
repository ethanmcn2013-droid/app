import "@/modules/timeline/timeline.css";
import { requireAppAccessTasks } from "@/server/app-access";
import { TimelineHome } from "@/modules/timeline";
import type { TimelineIndexSearchParams } from "@/modules/timeline/app/page";

export const dynamic = "force-dynamic";
export const metadata = { title: "Timeline · Signal Studio" };

export default async function TimelinePage({
  searchParams,
}: {
  /** See TimelineIndexSearchParams: plan-naming params redirect; view params (zoom, group, sort, status) shape All projects. */
  searchParams: Promise<TimelineIndexSearchParams>;
}) {
  await requireAppAccessTasks();
  return <TimelineHome searchParams={searchParams} />;
}
