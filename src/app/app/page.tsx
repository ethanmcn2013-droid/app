import { redirect } from "next/navigation";
import { resolvePlanningFeatureFlags } from "@/lib/planning/flags";

type SearchParams = Promise<{
  contextVersion?: string;
  planningPeriodId?: string;
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
    params.planningPeriodId &&
    params.workspaceId
  ) {
    const query = new URLSearchParams({
      contextVersion: "2",
      planningPeriodId: params.planningPeriodId,
      workspaceId: params.workspaceId,
    });
    redirect(`/api/suite-context?${query.toString()}`);
  }
  redirect(
    resolvePlanningFeatureFlags().planningPeriods
      ? "/app/your-work"
      : "/app/board",
  );
}
