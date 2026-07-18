import { Suspense } from "react";
import { redirect } from "next/navigation";
import AppLoading from "./loading";
import { AppSidebar } from "@/components/app/sidebar";
import { StudioBar } from "@/components/studio-bar/studio-bar";
import { StudioRail } from "@/components/studio-bar/studio-rail";
import {
  StudioChromeBridge,
  StudioChromeProvider,
  StudioChromePublisher,
} from "@/components/studio-bar/studio-chrome-context";
import { FirstCompletionMoment } from "@/components/app/done-dopamine/first-completion-moment";
import { TasksProvider } from "@/lib/tasks/tasks-context";
import { TaskDetailPanel } from "@/components/app/detail-panel/task-detail-panel";
import { AddTaskRoot } from "@/components/app/add-task/add-task-context";
import { PaletteRoot } from "@/components/app/palette/command-palette";
import { CrossWorkspaceOverdue } from "@/components/app/cross-workspace-overdue";
import { CrossWorkspaceSearch } from "@/components/app/cross-workspace-search";
import { FocusMode } from "@/components/app/focus-mode";
import { SuiteContextPublisher } from "@/components/app/suite-context-publisher";
import { ToastBridge, ToastRoot } from "@/components/primitives/toast";
import { DomainProvider } from "@/lib/domain-context";
import { CurrentUserProvider } from "@/lib/auth-context";
import { RoomBriefProvider } from "@/components/app/room/room-brief-context";
import { RoomToolsProvider } from "@/components/app/room/room-tools-context";
import { getRoomBriefData } from "@/server/actions/room";
import { getProjectsTreeData } from "@/server/actions/projects-tree";
import { getBoardName } from "@/server/actions/board";
import { eq } from "drizzle-orm";
import { db } from "@/server/db";
import { workspaces } from "@/server/db/schema";
import {
  getTasks,
  getActiveDomain,
  isFirstRun,
} from "@/server/db/queries";
import {
  getActiveWorkspace,
  getCurrentUser,
  listMyWorkspaces,
} from "@/server/auth";
import { requireAppAccess } from "@/server/require-app-access";
import { getWorkspacePersonalization } from "@/lib/onboarding/personalization";
import {
  editionLabel,
  resolveEntitlement,
  type EntitlementSource,
} from "@/lib/entitlements-shared";
import { isDemoMode } from "@/lib/access-mode";
import {
  DEMO_PRIMARY_USE_CASE,
  DEMO_WORKSPACE_SLUG,
} from "@/server/demo/tasks-demo";

// Layout reads from a runtime DB; mark dynamic so Next doesn't try
// to prerender app routes against a build-time empty DB.
export const dynamic = "force-dynamic";

/**
 * AppShell, async server component that holds all auth-dependent data
 * fetching. Lives inside a Suspense boundary so the loading.tsx dot paints
 * while auth() + DB reads resolve.
 *
 * DECISIONS.md D5: auth() must not block the layout, it prevents
 * loading.tsx from painting (Next 16.2 fact: a layout awaiting runtime
 * data blocks the segment loading boundary entirely).
 *
 * StudioBar + StudioRail (no auth deps, client components) stay at layout
 * level and render instantly, "chrome lives in layout (instant, never
 * re-blanks)". Their auth-dependent cells hydrate via StudioChromePublisher.
 */
async function AppShell({ children }: { children: React.ReactNode }) {
  // Closed-beta gate: only allowlisted accounts reach /app (production only;
  // demo/dev unaffected). Runs inside this Suspense boundary so the wordmark
  // loader paints during the check and no protected content shows before a
  // non-allowlisted account is redirected to /waitlist.
  await requireAppAccess();

  const ws = await getActiveWorkspace();
  // First-run gate: redirect to /welcome until user has a starter workspace.
  // /welcome reverse-redirects returning users so a stale bookmark can't trap.
  if (await isFirstRun(ws)) {
    redirect("/welcome");
  }
  const [tasks, domain, currentUser, wsRow, myWorkspaces, roomBrief, projectsTree, boardName] = await Promise.all([
    getTasks(ws),
    getActiveDomain(ws),
    getCurrentUser(),
    // Demo/Review: synthesize the workspace row instead of hitting the DB.
    isDemoMode()
      ? Promise.resolve({
          slug: DEMO_WORKSPACE_SLUG,
          primaryUseCase: DEMO_PRIMARY_USE_CASE,
          planningPeriodId: "demo-planning-period",
        })
      : db
          .select({
            slug: workspaces.slug,
            primaryUseCase: workspaces.primaryUseCase,
            planningPeriodId: workspaces.planningPeriodId,
          })
          .from(workspaces)
          .where(eq(workspaces.id, ws))
          .then((rows) => rows[0]),
    listMyWorkspaces(),
    // Editorial Project Room facts (Option B): purpose, date window,
    // period name, owner. Fetched here per DECISIONS.md D4 so the view
    // pages stay synchronous and never re-suspend against loading.tsx.
    getRoomBriefData(),
    // Projects sidebar tree (T·95 lab parity): periods → workspaces → counts.
    getProjectsTreeData(),
    // Editable workspace title (T·97): per-workspace name override from meta
    // KV. Null when unset; the brief falls back to shortenTitle(workspaceTitle).
    getBoardName(ws),
  ]);
  const slug = wsRow?.slug ?? ws;
  // Header licence slot (Phase 1): resolve the account's edition from the
  // shared entitlements DB and derive a label. Failure-safe (resolveEntitlement
  // returns `free` with a null source on any error) and skipped in demo mode,
  // so a licence read never takes the board down. Only named editions
  // (student_edu → School Edition, venue_edition → Venue Edition) produce a
  // label; everyone else gets null and the slot renders nothing.
  const edition = isDemoMode()
    ? null
    : editionLabel(
        (await resolveEntitlement(currentUser)).source as EntitlementSource | null,
      );
  const personalization = getWorkspacePersonalization({
    primaryUseCase: wsRow?.primaryUseCase,
    activeDomain: domain,
  });
  return (
    <CurrentUserProvider user={currentUser}>
      <DomainProvider
        domain={domain}
        workspaceId={ws}
        workspaceSlug={slug}
        boardName={boardName}
        personalization={personalization}
      >
        <TasksProvider initialTasks={tasks}>
          <RoomBriefProvider value={roomBrief}>
          <ToastRoot>
            <SuiteContextPublisher
              planningPeriodId={wsRow?.planningPeriodId ?? null}
              workspaceId={ws}
            />
            <AddTaskRoot>
              <PaletteRoot>
                {/* T·94: workspace switching + scope moved up into the
                    Studio Bar (layout level). Publisher fills the bar's
                    cells; Bridge routes its command-field / create events
                    into PaletteRoot + AddTaskRoot. */}
                <StudioChromePublisher
                  workspaces={myWorkspaces}
                  activeWorkspaceId={ws}
                  periodName={roomBrief?.periodName ?? null}
                  edition={edition}
                />
                <StudioChromeBridge />
                <RoomToolsProvider>
                  <AppSidebar activeWorkspaceId={ws} tree={projectsTree} />
                  {/* The lab's projectRoom wash: canvas 72% / surface mix. */}
                  <main className="flex min-w-0 flex-1 flex-col bg-[color-mix(in_srgb,var(--x-task-canvas)_72%,var(--x-task-surface))] pb-[60px] md:pb-0">
                    {children}
                  </main>
                </RoomToolsProvider>
                <TaskDetailPanel />
                <CrossWorkspaceOverdue />
                <CrossWorkspaceSearch />
                <FocusMode />
                <ToastBridge />
              </PaletteRoot>
            </AddTaskRoot>
          </ToastRoot>
          </RoomBriefProvider>
        </TasksProvider>
      </DomainProvider>
    </CurrentUserProvider>
  );
}

/**
 * AppLayout, the /app segment layout.
 *
 * The Studio Bar and product rail render synchronously at this level
 * (client components, no auth deps) so the black L-frame is always
 * painted and never re-blanks, the monotonic reveal contract from
 * LOADING_SYSTEM.md §4.
 *
 * AppShell (auth + DB reads) wraps in Suspense so loading.tsx paints
 * while data resolves. Board mounts exactly once: Suspense resolves into
 * AppShell; AppShell never unmounts (layout is stable).
 */
export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    /*
     * L4, persistent top chrome (DESIGN.md §14, amended by the Studio Bar
     * contract 2026-07-17). The 48px Studio Bar spans the top; the 60px
     * product rail runs down the left; together they draw the Signal
     * Studio L-frame around the white canvas. flex-col wraps bar +
     * flex-row (rail + sidebar + content); overflow-hidden on the inner
     * row so the content area clips correctly under the fixed-height bar.
     *
     * P1-2/P1-4 fix (DECISIONS.md D5): chrome rendered at this
     * synchronous layout level; auth/data moved into <AppShell> under
     * <Suspense> so loading.tsx boundary can paint. Board mounts once.
     *
     * Fallback = <AppLoading /> (the wordmark identity loader from
     * ./loading.tsx). The prior `fallback={null}` left the body blank
     * beneath SuiteChrome during AppShell's auth+DB fetch, which read
     * as a white flash between "chrome paints" and "board arrives".
     * Sharing the loader with the segment-level boundary means the
     * same wordmark holds the moment either way, no re-blank.
     */
    <StudioChromeProvider>
      <div className="flex h-screen w-full flex-col bg-bg">
        {/* T·94: the 48px Studio Bar replaces SuiteChrome + the
            WorkspaceContextBar row. Bar (top) + rail (left) render at
            this synchronous level so the black L-frame paints instantly
            and never re-blanks; the bar's live cells hydrate from
            <StudioChromePublisher> once AppShell resolves. */}
        <StudioBar />
        <FirstCompletionMoment />
        <div className="flex min-w-0 flex-1 overflow-hidden">
          <StudioRail />
          <Suspense fallback={<AppLoading />}>
            <AppShell>{children}</AppShell>
          </Suspense>
        </div>
      </div>
    </StudioChromeProvider>
  );
}
