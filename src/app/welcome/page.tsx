import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/server/db";
import { workspaces } from "@/server/db/schema";
import { isFirstRun } from "@/server/db/queries";
import { detectVenueWelcome } from "@/server/db/venue-welcome";
import { getActiveWorkspaceOrNull, getCurrentUser } from "@/server/auth";
import { ensureUserProvisioned } from "@/server/db/ensure-user";
import { LEGACY_WORKSPACE_ID } from "@/server/db/seed";
import { getTemplate, TEMPLATES } from "@/lib/templates";
import { persistOnboardingSubmission, venueFirstRunRequestId } from "@/server/onboarding-completion";
import { authorizeProjectCandidate } from "@/server/actions/project-authz";
import { withActiveProject } from "@/lib/projects/project-url";
import { OnboardingFlow } from "@/components/welcome/onboarding-flow";
import { segmentFromParam } from "@/lib/onboarding/segments";
import { StillProvisioning } from "@/components/welcome/still-provisioning";
import { resolvePlanningFeatureFlags } from "@/lib/planning/flags";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Welcome, Tasks",
};

const VENUE_TEMPLATE_ID = "wedding-planning-workspace";

type SearchParams = Promise<{ use?: string; workspaceId?: string | string[] }>;

export default async function WelcomePage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const preselectedSegment = segmentFromParam(params.use);
  const me = await getCurrentUser();
  // Guarantee the user has a real workspace before any state-mutating
  // code runs. Webhook race / missing-webhook protection, see
  // ensure-user.ts for context.
  await ensureUserProvisioned(me);
  // An explicit URL is a candidate, never ownership or a reason to fall back.
  const candidate = params.workspaceId === undefined
    ? await getActiveWorkspaceOrNull()
    : typeof params.workspaceId === "string" ? params.workspaceId : null;
  const grant = await authorizeProjectCandidate({ candidateProjectId: candidate, actorUserId: me, capability: "open", archivePolicy: "enforce" });
  if (!grant.ok) return (
    <main className="mx-auto max-w-lg px-6 py-16">
      <h1 className="text-2xl font-semibold text-ink">That project isn’t available.</h1>
      <p className="mt-3 text-ink-soft">Open Home to choose a project you can use.</p>
      <a href="/app/home" className="mt-6 inline-block underline underline-offset-4">Open Home</a>
    </main>
  );
  const ws = grant.projectId;
  if (ws === LEGACY_WORKSPACE_ID && process.env.NODE_ENV === "production") {
    // We just provisioned the user; getting ws-legacy back means
    // something deeper is wrong. Don't mutate the shared fallback
    // workspace, show a still-setting-up state instead.
    return <StillProvisioning />;
  }
  // Returning users skip the welcome (they came here from the URL bar
  // or an old bookmark). Push them straight back into the workspace.
  if (!(await isFirstRun(ws))) {
    // Home is the authenticated front door (consolidation D6).
    redirect(withActiveProject("/app/home", ws));
  }

  if (!grant.capabilities.manageProject || grant.archived) return (
    <main className="mx-auto max-w-lg px-6 py-16">
      <h1 className="text-2xl font-semibold text-ink">A project owner needs to finish setup.</h1>
      <p className="mt-3 text-ink-soft">You can open the project without changing its setup.</p>
      <a href={withActiveProject("/app/home", ws)} className="mt-6 inline-block underline underline-offset-4">Open project</a>
    </main>
  );

  // Venue Editions bridge: if the signed-in user holds an active
  // wedding comp entitlement linked to a sponsor (i.e. they arrived
  // via signalstudio.ie/redeem/[code]), skip the picker entirely.
  // Auto-apply the wedding workspace template and bounce them onto
  // the board with a query param so the welcome card can name the
  // sponsor.
  const venueWelcome = await detectVenueWelcome(me, ws);
  const planningFlags = resolvePlanningFeatureFlags();
  // The contextual flow creates a new project. An explicit setup link must
  // finish the authorized existing project, even while that experiment is on.
  if (planningFlags.contextualOnboarding && params.workspaceId === undefined) {
    if (venueWelcome) redirect(withActiveProject("/welcome/plan?context=wedding_season", ws));
    if (preselectedSegment === "student") {
      redirect(withActiveProject("/welcome/plan?context=semester", ws));
    }
    if (preselectedSegment === "wedding") {
      redirect(withActiveProject("/welcome/plan?context=wedding_season", ws));
    }
  }
  if (venueWelcome && TEMPLATES.some((t) => t.id === VENUE_TEMPLATE_ID)) {
    // Pure DB helper instead of `applyTemplateAction`, same reason as
    // `redeemCompCodeAction`: the action calls `revalidatePath` which
    // is illegal during route render.
    try {
      await persistOnboardingSubmission({
        workspaceId: ws,
        requestId: venueFirstRunRequestId(ws, me),
        primaryUseCase: "wedding",
        seedMode: "starter",
      }, me);
    } catch {
      return (
        <main className="mx-auto max-w-lg px-6 py-16">
          <h1 className="text-2xl font-semibold text-ink">Your project setup needs another try.</h1>
          <p className="mt-3 text-ink-soft">We couldn’t confirm that setup finished. Try again to check the same setup without adding another starter.</p>
          <a className="mt-6 inline-block rounded-full bg-ink px-5 py-3 text-white" href={withActiveProject("/welcome", ws)}>Try again</a>
        </main>
      );
    }
    const target = `/app/tasks?welcome=venue&v=${encodeURIComponent(
      venueWelcome.sponsorSlug,
    )}`;
    redirect(withActiveProject(target, ws));
  }

  // T1.2, if the workspace was created via the templates flow
  // (Tasks remix toast inviting a Roadmap, or any future template-led
  // signup), `templateId` is set on the workspaces row. The picker
  // should know, otherwise we ask the user to re-pick a domain when
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
      key={`${me}:${ws}`}
      workspaceId={ws}
      actorUserId={me}
      pendingTemplate={pendingTemplate}
      preselectedSegment={preselectedSegment}
    />
  );
}
