import { redirect } from "next/navigation";
import { YourWorkView } from "@/components/app/your-work/your-work-view";
import { TasksRuntimePageMount } from "@/components/app/tasks-runtime-mount";
import { resolvePlanningFeatureFlags } from "@/lib/planning/flags";
import { listYourWorkForCurrentUser } from "@/server/planning/queries";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Your work · Tasks",
};

export default async function YourWorkPage({
  searchParams,
}: {
  searchParams: Promise<{ workspaceId?: string | string[] }>;
}) {
  if (!resolvePlanningFeatureFlags().planningPeriods) redirect("/app/tasks");
  const data = await listYourWorkForCurrentUser();
  // Your Work is user-scoped — the same catalog-wide view whichever Project
  // is active — and it is a PROJECT_DESTINATION_SURFACES entry, so the
  // chrome follows the URL's Project when the flag-on page mount consumes it
  // (D-022) while the content is unaffected by it.
  return (
    <TasksRuntimePageMount searchParams={searchParams}>
      <YourWorkView data={data} />
    </TasksRuntimePageMount>
  );
}
