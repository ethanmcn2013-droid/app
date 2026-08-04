import { auth } from "@clerk/nextjs/server";
import { createHash } from "node:crypto";
import { redirect } from "next/navigation";
import { isDemoMode } from "@/lib/access-mode";
import {
  listArchivedNotes,
  listNotes,
  listPendingApprovedTaskSendsForHybrid,
} from "@/modules/notes/server/actions/notes";
import { getCaptureEmail } from "@/modules/notes/server/actions/capture-email";
import {
  DEMO_REFERENCE_TIME,
  demoArchivedNotes,
  demoNotes,
} from "@/modules/notes/server/demo/notes-demo";
import { resolveDemoFixture } from "@/modules/notes/server/demo/notes-fixtures";
import {
  fetchNotesWorkspaceDomain,
  fetchTasksWorkspaceCatalog,
  selectAuthorizedWorkspaceHint,
} from "@/modules/notes/server/tasks-personalization";
import { Notebook } from "@/modules/notes/app/Notebook";
import { CaptureEmailRow } from "@/modules/notes/app/CaptureEmailRow";
import { EarlyCaptureBootstrap } from "@/modules/notes/app/hybrid/EarlyCaptureBootstrap";
import { HybridNotebook } from "@/modules/notes/app/hybrid/HybridNotebook";
import AppLoading from "@/modules/notes/app/loading";

export const dynamic = "force-dynamic";

// Server component, fetches the user's notes once, hands the initial
// stream to the client Notebook. Subsequent edits flow through server
// actions; the client applies optimistic updates and reconciles.
type NotebookPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function NotebookPage({ searchParams }: NotebookPageProps) {
  // Fail open to sign-in, never to a 500. The proxy middleware gates
  // /app when Clerk keys are configured, but it bypasses entirely in
  // keyless/dev mode (see proxy.ts), and listNotes()/requireUser()
  // throws UnauthorizedError when there's no session. Without this
  // guard an unauthenticated hit renders an unhandled 500 instead of
  // the sign-in screen. Belt-and-braces: correct even when the
  // middleware is doing its job.
  // Demo/Review mode skips the sign-in gate entirely, the notebook renders
  // from the in-memory seed (listNotes/listArchivedNotes short-circuit).
  const demoMode = isDemoMode();
  // Hybrid is the founder-approved canonical notebook. The legacy renderer
  // remains an explicit, server-only rollback path for one release window;
  // an absent environment variable must never silently restore the old UI.
  const hybridNotebookEnabled =
    process.env.NOTES_LEGACY_NOTEBOOK_ENABLED !== "1";
  const params = await searchParams;
  const fixture = demoMode ? resolveDemoFixture(params.fixture) : "populated";

  if (demoMode && fixture === "loading") {
    return <AppLoading />;
  }
  if (demoMode && fixture === "error") {
    throw new Error("Deliberate Signal Notes review fixture: notebook load failed");
  }

  let userId: string | null = null;
  if (!demoMode) {
    ({ userId } = await auth());
    if (!userId) {
      redirect("/sign-in");
    }
  }

  const planningPeriodsEnabled =
    process.env.SIGNAL_PLANNING_PERIODS_ENABLED === "1" ||
    process.env.SIGNAL_PLANNING_PERIODS_ENABLED === "true";
  const workspaceHint = typeof params.workspaceId === "string" ? params.workspaceId : null;
  const periodHint =
    typeof params.planningPeriodId === "string" ? params.planningPeriodId : null;

  let initialNotes: Awaited<ReturnType<typeof listNotes>>;
  let initialArchivedNotes: Awaited<ReturnType<typeof listArchivedNotes>>;
  let captureEmail: Awaited<ReturnType<typeof getCaptureEmail>>;
  let tasksCatalog: Awaited<ReturnType<typeof fetchTasksWorkspaceCatalog>>;
  let pendingApprovedTaskSends: Awaited<ReturnType<typeof listPendingApprovedTaskSendsForHybrid>>;
  // Which register the notebook speaks in. Presentation only: it selects
  // wording and unlocks nothing. Any failure resolves to null and Notes
  // reads its generic register, so a slow or absent Tasks never blocks
  // capture.
  let activeDomain: string | null = null;

  if (demoMode) {
    initialNotes = demoNotes(fixture);
    initialArchivedNotes = demoArchivedNotes(fixture);
    captureEmail =
      fixture === "capture-email"
        ? {
            ok: true,
            address: "review-notebook@capture.signalstudio.test",
            slug: "review-notebook",
          }
        : fixture === "partial-failure"
          ? { ok: false, reason: "inbound-not-configured" }
          : { ok: false, reason: "free-tier-not-enabled" };
    tasksCatalog = { status: "unavailable", planningPeriods: [], workspaces: [] };
    pendingApprovedTaskSends = [];
  } else {
    [
      initialNotes,
      initialArchivedNotes,
      captureEmail,
      tasksCatalog,
      pendingApprovedTaskSends,
      activeDomain,
    ] = await Promise.all([
      listNotes(),
      listArchivedNotes(),
      getCaptureEmail(),
      fetchTasksWorkspaceCatalog(userId as string),
      hybridNotebookEnabled
        ? listPendingApprovedTaskSendsForHybrid()
        : Promise.resolve([]),
      fetchNotesWorkspaceDomain(userId as string),
    ]);
  }

  // URL context is navigation state, never authorization. Only select a hint
  // when the current subject's freshly-read Tasks catalog contains it.
  const hintedWorkspace = planningPeriodsEnabled
    ? selectAuthorizedWorkspaceHint(tasksCatalog, workspaceHint, periodHint)
    : null;
  // Three rendering branches:
  //   - tier=entitled: workspace+ user, inbound is wired → show address.
  //   - tier=free: free-tier user → show upgrade nudge.
  //   - null: workspace+ user, inbound NOT wired yet → hide entirely
  //     (don't show a fake-looking address that drops mail).
  let captureState: React.ComponentProps<typeof CaptureEmailRow>["state"] | null;
  if (captureEmail.ok) {
    captureState = { tier: "entitled", address: captureEmail.address };
  } else if (captureEmail.reason === "free-tier-not-enabled") {
    captureState = { tier: "free" };
  } else {
    captureState = null;
  }
  const notebookProps = {
    initialNotes,
    initialArchivedNotes,
    tasksWorkspaces: tasksCatalog.workspaces,
    tasksCatalogAvailable: tasksCatalog.status === "ready",
    planningPeriodsEnabled,
    initialWorkspaceId: hintedWorkspace?.id ?? null,
    reviewFirstCapture: demoMode && fixture === "first-capture",
    // Capture once on the server so SSR and hydration share the same relative
    // time boundary even when a note is exactly one minute/hour/day old.
    referenceTime: demoMode ? DEMO_REFERENCE_TIME : Date.now(),
    // Browser recovery contains private writing. Namespace it with a stable,
    // opaque account scope so signing out and into another account in the
    // same tab can never adopt the previous creator's draft or queue.
    recoveryScope: demoMode
      ? `review-${fixture}`
      : createHash("sha256").update(`signal-notes:${userId}`).digest("hex").slice(0, 24),
  };
  return (
    <>
      {hybridNotebookEnabled ? (
        <>
          <EarlyCaptureBootstrap />
          <HybridNotebook
            {...notebookProps}
            captureEmailState={captureState}
            initialPendingApprovedTaskSends={pendingApprovedTaskSends}
            activeDomain={activeDomain}
            demoMode={demoMode}
          />
        </>
      ) : (
        <Notebook {...notebookProps} />
      )}
      {demoMode && fixture === "partial-failure" ? (
        <aside className="capture-email" role="status" data-review-fixture="partial-failure">
          Connected details are temporarily unavailable. Your notebook is
          ready, and you can keep writing.
        </aside>
      ) : null}
      {!hybridNotebookEnabled && captureState ? (
        <CaptureEmailRow state={captureState} />
      ) : null}
    </>
  );
}
