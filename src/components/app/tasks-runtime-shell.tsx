import "server-only";

import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { CrossWorkspaceOverdue } from "@/components/app/cross-workspace-overdue";
import { CrossWorkspaceSearch } from "@/components/app/cross-workspace-search";
import { FirstCompletionMoment } from "@/components/app/done-dopamine/first-completion-moment";
import { FocusMode } from "@/components/app/focus-mode";
import { AddTaskRoot } from "@/components/app/add-task/add-task-context";
import { PaletteRoot } from "@/components/app/palette/command-palette";
import { ProductWorkspaceShell } from "@/components/app/product-workspace-shell";
import { RoomBriefProvider } from "@/components/app/room/room-brief-context";
import { SuiteContextPublisher } from "@/components/app/suite-context-publisher";
import { TaskDetailPanel } from "@/components/app/detail-panel/task-detail-panel";
import {
  StudioChromeBridge,
  StudioChromePublisher,
} from "@/components/studio-bar/studio-chrome-context";
import { ToastBridge, ToastRoot } from "@/components/primitives/toast";
import { CurrentUserProvider } from "@/lib/auth-context";
import { DomainProvider } from "@/lib/domain-context";
import {
  editionLabel,
  resolveEntitlement,
  type EntitlementSource,
} from "@/lib/entitlements-shared";
import { getWorkspacePersonalization } from "@/lib/onboarding/personalization";
import { TasksProvider } from "@/lib/tasks/tasks-context";
import { isDemoMode } from "@/lib/access-mode";
import { requireAppAccessTasks } from "@/server/app-access";
import { getCurrentUser, listMyWorkspaces } from "@/server/auth";
import { resolveProjectForRoute } from "@/server/projects/route-authz";
import { parseProjectId } from "@/lib/projects/project-ref";
import { getBoardName, getColumnConfig } from "@/server/actions/board";
import { getWorkspaceMemberMeta } from "@/server/db/members";
import { getProjectsTreeData } from "@/server/actions/projects-tree";
import { getRoomBriefData } from "@/server/actions/room";
import { getTagDefs } from "@/server/actions/tags";
import { db } from "@/server/db";
import {
  getActiveDomain,
  getTasks,
  isFirstRun,
} from "@/server/db/queries";
import { workspaces } from "@/server/db/schema";
import {
  DEMO_PRIMARY_USE_CASE,
  DEMO_WORKSPACE_NAME,
  DEMO_WORKSPACE_SLUG,
} from "@/server/demo/tasks-demo";

/**
 * The Tasks-only runtime boundary.
 *
 * The suite layout owns only shared authentication and chrome. All Tasks data,
 * providers, panels, palette actions, project navigation, and first-run logic
 * live here so Notes, Timeline, and Signal never wait on the board runtime.
 *
 * ── WP3 defect 5: the one allowlisted `route-fallback` ─────────────────────
 *
 * Everything downstream inherits the Project resolved here, so this is the
 * highest-leverage site in WP3. Two things changed, and one deliberately
 * did not.
 *
 * **It now fails closed.** It called `getActiveWorkspace`, whose third
 * fallback returns `LEGACY_WORKSPACE_ID` — a real workspace, holding real
 * tasks, for which the caller has produced no membership proof (DECISIONS
 * D-005). Every consumer below inherited that. Resolution now runs through
 * `resolveProjectForRoute`, which returns `empty` instead, and `empty` lands
 * on `/welcome` exactly as an uninitialized Project already did.
 *
 * **It now prefers an explicit Project** when one is handed to it, via
 * `requestedProjectId`. That is the condition of its place on the WP3
 * allowlist.
 *
 * **What did not change, and cannot here.** The allowlist entry asks this
 * shell to prefer an explicit Project *from the route's search parameters*.
 * It cannot: this component is mounted from nine `layout.tsx` files, and a
 * Next.js layout does not receive `searchParams`. That is not a local
 * omission — it is the framework's data model. Next's own type generator
 * (`node_modules/next/dist/build/webpack/plugins/next-types-plugin/
 * index.js:128-136`) declares `PageProps` with `searchParams` and
 * `LayoutProps` without it, and the reason is stated in
 * `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/
 * use-pathname.md:38`: "Reading the current URL from a Server Component is
 * not supported. This design is intentional to support layout state being
 * preserved across page navigations."
 *
 * The same property makes a workaround wrong rather than merely unavailable:
 * a layout is *not re-rendered* when only the query string changes, so even a
 * value smuggled in through a header would go stale the moment the user
 * navigated from `?workspaceId=A` to `?workspaceId=B`, and the chrome would
 * confidently label the board with the Project it no longer showed.
 * `src/lib/projects/route-snapshot.ts:5-10` documents WP2 reaching the same
 * conclusion for the chrome, and solves it by having each *page* publish what
 * the server verified.
 *
 * So the parameter exists and is honoured, and the consequence is recorded:
 * while the Tasks runtime is fetched in a layout, `/app/tasks?workspaceId=B`
 * cannot render B's board. Closing that needs the runtime moved into the
 * pages — a WP-level change, not a local repair.
 */
export async function TasksRuntimeShell({
  children,
  requestedProjectId,
}: {
  children: React.ReactNode;
  /**
   * An explicit, already-known Project. Preferred over the ambient fallback
   * whenever it is supplied; it is still authorized here, never trusted.
   */
  requestedProjectId?: string | null;
}) {
  await requireAppAccessTasks();

  const project = await resolveProjectForRoute(
    parseProjectId(requestedProjectId) ?? undefined,
  );

  // No accessible active Project — the onboarding state, and the same
  // destination an uninitialized Project has always had. Never
  // LEGACY_WORKSPACE_ID.
  if (project.kind !== "ready" && project.kind !== "archived") {
    redirect("/welcome");
  }

  const workspaceId = project.workspaceId;
  if (await isFirstRun(workspaceId)) {
    redirect("/welcome");
  }

  const [
    tasks,
    domain,
    currentUser,
    workspace,
    myWorkspaces,
    roomBrief,
    projectsTree,
    boardName,
    columnConfig,
    tagDefs,
    members,
  ] = await Promise.all([
    getTasks(workspaceId),
    getActiveDomain(workspaceId),
    getCurrentUser(),
    isDemoMode()
      ? Promise.resolve({
          name: DEMO_WORKSPACE_NAME,
          slug: DEMO_WORKSPACE_SLUG,
          description: null,
          // The demo venue is Irish; a USD receipt line on The Orchard's
          // board read as a locale bug (the review's voice-8).
          currency: "EUR",
          budgetCents: null,
          primaryUseCase: DEMO_PRIMARY_USE_CASE,
          planningPeriodId: "demo-planning-period",
          primaryDate: null,
          primaryDateLabel: null,
        })
      : db
          .select({
            name: workspaces.name,
            slug: workspaces.slug,
            description: workspaces.description,
            currency: workspaces.currency,
            budgetCents: workspaces.budgetCents,
            primaryUseCase: workspaces.primaryUseCase,
            planningPeriodId: workspaces.planningPeriodId,
            // The workspace's one anchor date. In a wedding workspace this is
            // the wedding day, and the task panel reads every due date
            // against it.
            primaryDate: workspaces.primaryDate,
            primaryDateLabel: workspaces.primaryDateLabel,
          })
          .from(workspaces)
          .where(eq(workspaces.id, workspaceId))
          .then((rows) => rows[0]),
    listMyWorkspaces(),
    getRoomBriefData(),
    getProjectsTreeData(),
    getBoardName(workspaceId),
    getColumnConfig(workspaceId),
    getTagDefs(workspaceId),
    getWorkspaceMemberMeta(workspaceId),
    // The theme preference used to be read here, for a data-theme attribute
    // this shell hung on a display:contents wrapper. The app layout owns the
    // resolved theme now (src/app/app/theme-runtime.tsx) — one read for all
    // three products instead of one read on the Tasks path only, and Notes
    // and Timeline stop being the products where the switch did not reach.
  ]);

  const workspaceSlug = workspace?.slug ?? workspaceId;
  const edition = isDemoMode()
    ? null
    : editionLabel(
        (await resolveEntitlement(currentUser)).source as EntitlementSource | null,
      );
  const personalization = getWorkspacePersonalization({
    primaryUseCase: workspace?.primaryUseCase,
    activeDomain: domain,
  });
  return (
    <>
      <CurrentUserProvider user={currentUser}>
        <DomainProvider
          domain={domain}
          boardName={boardName}
          boardDescription={workspace?.description ?? null}
          currency={workspace?.currency ?? null}
          budgetCents={workspace?.budgetCents ?? null}
          columnConfig={columnConfig}
          personalization={personalization}
          tagDefs={tagDefs}
          members={members}
          anchorDate={workspace?.primaryDate ?? null}
          anchorLabel={workspace?.primaryDateLabel ?? null}
          workspaceId={workspaceId}
          workspaceSlug={workspaceSlug}
        >
          <TasksProvider initialTasks={tasks}>
            <RoomBriefProvider value={roomBrief}>
              <ToastRoot>
                <SuiteContextPublisher
                  planningPeriodId={workspace?.planningPeriodId ?? null}
                  workspaceId={workspaceId}
                />
                <AddTaskRoot>
                  <PaletteRoot>
                    <StudioChromePublisher
                      activeWorkspaceId={workspaceId}
                      edition={edition}
                      periodName={roomBrief?.periodName ?? null}
                      workspaceTitle={workspace?.name ?? workspaceSlug}
                      workspaces={myWorkspaces}
                    />
                    <StudioChromeBridge />
                    <FirstCompletionMoment />
                    <ProductWorkspaceShell
                      activeWorkspaceId={workspaceId}
                      tree={projectsTree}
                    >
                      {children}
                    </ProductWorkspaceShell>
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
    </>
  );
}
