import { redirect } from "next/navigation";
import { YourWorkView } from "@/components/app/your-work/your-work-view";
import { resolvePlanningFeatureFlags } from "@/lib/planning/flags";
import { listYourWorkForCurrentUser } from "@/server/planning/queries";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Your work · Tasks",
};

export default async function YourWorkPage() {
  if (!resolvePlanningFeatureFlags().planningPeriods) redirect("/app/tasks");
  const data = await listYourWorkForCurrentUser();
  return <YourWorkView data={data} />;
}
