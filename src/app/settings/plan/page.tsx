import { getActiveWorkspace, getCurrentUser } from "@/server/auth";
import { getPlanSummary } from "@/server/db/plan-summary";
import { SettingsSection } from "@/components/settings/section";
import { PlanView } from "@/components/settings/plan/plan-view";
import { isDemoMode } from "@/lib/access-mode";
import {
  DEMO_SPONSOR_NAME,
  DEMO_WORKSPACE_SLUG,
} from "@/server/demo/tasks-demo";

export const dynamic = "force-dynamic";

export default async function PlanSettingsPage() {
  if (isDemoMode()) {
    return (
      <SettingsSection
        title="Your plan"
        description="What you’re on, when it renews, and where the receipt lives."
      >
        <PlanView
          summary={{
            kind: "comp_wedding",
            tier: "wedding",
            sponsorName: DEMO_SPONSOR_NAME,
            sponsorSlug: DEMO_WORKSPACE_SLUG,
            code: "ORCHARD-REVIEW",
            startedAt: new Date("2026-01-01T00:00:00.000Z"),
            expiresAt: new Date("2027-07-01T00:00:00.000Z"),
          }}
        />
      </SettingsSection>
    );
  }

  const [me, ws] = await Promise.all([
    getCurrentUser(),
    getActiveWorkspace(),
  ]);
  const summary = await getPlanSummary(me, ws);

  return (
    <SettingsSection
      title="Your plan"
      description="What you’re on, when it renews, and where the receipt lives."
    >
      <PlanView summary={summary} />
    </SettingsSection>
  );
}
