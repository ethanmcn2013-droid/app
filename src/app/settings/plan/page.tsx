import { getActiveWorkspace, getCurrentUser } from "@/server/auth";
import { getPlanSummary } from "@/server/db/plan-summary";
import { SettingsSection } from "@/components/settings/section";
import { PlanView } from "@/components/settings/plan/plan-view";

export const dynamic = "force-dynamic";

export default async function PlanSettingsPage() {
  const [me, ws] = await Promise.all([
    getCurrentUser(),
    getActiveWorkspace(),
  ]);
  const summary = await getPlanSummary(me, ws);

  return (
    <SettingsSection
      title="Your plan"
      description="What you're on, when it renews, and where the receipt lives."
    >
      <PlanView summary={summary} />
    </SettingsSection>
  );
}
