import { redirect } from "next/navigation";
import { eq, sql } from "drizzle-orm";
import { db } from "@/server/db";
import { workspaces } from "@/server/db/schema";
import { isFirstRun } from "@/server/db/queries";
import { detectVenueWelcome } from "@/server/db/venue-welcome";
import { getActiveWorkspace, getCurrentUser } from "@/server/auth";
import { ensureUserProvisioned } from "@/server/db/ensure-user";
import { LEGACY_WORKSPACE_ID } from "@/server/db/seed";
import { getTemplate, TEMPLATES } from "@/lib/templates";
import { applyTemplateToWorkspace } from "@/server/db/apply-template";
import { OnboardingFlow } from "@/components/welcome/onboarding-flow";
import { segmentFromParam } from "@/lib/onboarding/segments";
import { StillProvisioning } from "@/components/welcome/still-provisioning";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Welcome — Tasks",
};

const VENUE_TEMPLATE_ID = "wedding-planning-workspace";

type SearchParams = Promise<{ use?: string }>;

export default async function WelcomePage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const preselectedSegment = segmentFromParam(params.use);
  const me = await getCurrentUser();
  // Guarantee the user has a real workspace before any state-mutating
  // code runs. Webhook race / missing-webhook protection — see
  // ensure-user.ts for context.
  await ensureUserProvisioned(me);
  const ws = await getActiveWorkspace();
  if (ws === LEGACY_WORKSPACE_ID && process.env.NODE_ENV === "production") {
    // We just provisioned the user; getting ws-legacy back means
    // something deeper is wrong. Don't mutate the shared fallback
    // workspace — show a still-setting-up state instead.
    return <StillProvisioning />;
  }
  // Returning users skip the welcome (they came here from the URL bar
  // or an old bookmark). Push them straight back into the workspace.
  if (!(await isFirstRun(ws))) {
    redirect("/app/board");
  }

  // Venue Editions bridge: if the signed-in user holds an active
  // wedding comp entitlement linked to a sponsor (i.e. they arrived
  // via signalstudio.ie/redeem/[code]), skip the picker entirely.
  // Auto-apply the wedding workspace template and bounce them onto
  // the board with a query param so the welcome card can name the
  // sponsor.
  const venueWelcome = await detectVenueWelcome(me);
  if (venueWelcome && TEMPLATES.some((t) => t.id === VENUE_TEMPLATE_ID)) {
    // Pure DB helper instead of `applyTemplateAction` — same reason as
    // `redeemCompCodeAction`: the action calls `revalidatePath` which
    // is illegal during route render.
    await applyTemplateToWorkspace(VENUE_TEMPLATE_ID, ws);
    await db.run(sql`
      UPDATE workspaces
      SET template_id = ${VENUE_TEMPLATE_ID},
          active_domain = 'wedding',
          primary_use_case = 'venue',
          onboarding_completed_at = unixepoch()
      WHERE id = ${ws}
    `);
    const target = `/app/board?welcome=venue&v=${encodeURIComponent(
      venueWelcome.sponsorSlug,
    )}`;
    redirect(target);
  }

  // T1.2 — if the workspace was created via the templates flow
  // (Tasks remix toast inviting a Roadmap, or any future template-led
  // signup), `templateId` is set on the workspaces row. The picker
  // should know — otherwise we ask the user to re-pick a domain when
  // they've already chosen a template.
  let pendingTemplate: { id: string; name: string } | null = null;
  const [row] = await db
    .select({ templateId: workspaces.templateId })
    .from(workspaces)
    .where(eq(workspaces.id, ws));
  if (row?.templateId && TEMPLATES.some((t) => t.id === row.templateId)) {
    const t = getTemplate(row.templateId);
    pendingTemplate = { id: t.id, name: t.name };
  }

  return (
    <OnboardingFlow
      pendingTemplate={pendingTemplate}
      preselectedSegment={preselectedSegment}
    />
  );
}
