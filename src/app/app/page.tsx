import { redirect } from "next/navigation";
import { resolvePlanningFeatureFlags } from "@/lib/planning/flags";

type SearchParams = Promise<{
  contextVersion?: string;
  planningPeriodId?: string;
  projectId?: string;
  workspaceId?: string;
}>;

export default async function AppIndex({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  if (
    params.contextVersion === "2" &&
    params.workspaceId
  ) {
    const query = new URLSearchParams({
      contextVersion: "2",
      workspaceId: params.workspaceId,
    });
    if (params.planningPeriodId) {
      query.set("planningPeriodId", params.planningPeriodId);
    }
    if (params.projectId) query.set("projectId", params.projectId);
    redirect(`/api/suite-context?${query.toString()}`);
  }
  redirect(
    resolvePlanningFeatureFlags().planningPeriods
      ? "/app/your-work"
      : "/app/tasks",
  );
}
