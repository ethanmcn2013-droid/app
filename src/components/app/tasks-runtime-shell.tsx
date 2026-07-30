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
import {
  getActiveWorkspace,
  getCurrentUser,
  listMyWorkspaces,
} from "@/server/auth";
import { getBoardName, getColumnConfig } from "@/server/actions/board";
import { getProjectsTreeData } from "@/server/actions/projects-tree";
import { getRoomBriefData } from "@/server/actions/room";
import { getTagDefs } from "@/server/actions/tags";
import { db } from "@/server/db";
import { getUserPreferences } from "@/server/db/preferences";
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
 */
export async function TasksRuntimeShell({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAppAccessTasks();

  const workspaceId = await getActiveWorkspace();
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
    userPreferences,
  ] = await Promise.all([
    getTasks(workspaceId),
    getActiveDomain(workspaceId),
    getCurrentUser(),
    isDemoMode()
      ? Promise.resolve({
          name: DEMO_WORKSPACE_NAME,
          slug: DEMO_WORKSPACE_SLUG,
          description: null,
          primaryUseCase: DEMO_PRIMARY_USE_CASE,
          planningPeriodId: "demo-planning-period",
        })
      : db
          .select({
            name: workspaces.name,
            slug: workspaces.slug,
            description: workspaces.description,
            primaryUseCase: workspaces.primaryUseCase,
            planningPeriodId: workspaces.planningPeriodId,
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
    isDemoMode()
      ? Promise.resolve(null)
      : getCurrentUser().then((userId) => getUserPreferences(userId)),
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
  const themeMode = userPreferences?.themeMode ?? "system";

  return (
    <div
      className="contents"
      data-theme={themeMode}
      style={{ colorScheme: "light" }}
    >
      <CurrentUserProvider user={currentUser}>
        <DomainProvider
          domain={domain}
          boardName={boardName}
          boardDescription={workspace?.description ?? null}
          columnConfig={columnConfig}
          personalization={personalization}
          tagDefs={tagDefs}
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
    </div>
  );
}
