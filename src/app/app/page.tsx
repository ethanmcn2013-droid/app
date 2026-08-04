import { redirect } from "next/navigation";
import { HOME_APP_PATH } from "@/lib/product-urls";

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
  // Home is the authenticated front door: the default landing for
  // sign-in, onboarding hand-off, and bare /app visits. Deep links into
  // products are untouched; only this index redirect changed.
  redirect(HOME_APP_PATH);
}
