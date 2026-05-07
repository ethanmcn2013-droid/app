import { Suspense } from "react";
import { redirect } from "next/navigation";
import { AppSidebar } from "@/components/app/sidebar";
import { TasksProvider } from "@/lib/tasks/tasks-context";
import { TaskDetailPanel } from "@/components/app/detail-panel/task-detail-panel";
import { AddTaskRoot } from "@/components/app/add-task/add-task-context";
import { PaletteRoot } from "@/components/app/palette/command-palette";
import { CrossWorkspaceOverdue } from "@/components/app/cross-workspace-overdue";
import { CrossWorkspaceSearch } from "@/components/app/cross-workspace-search";
import { FocusMode } from "@/components/app/focus-mode";
import { ToastBridge, ToastRoot } from "@/components/primitives/toast";
import { DomainProvider } from "@/lib/domain-context";
import { CurrentUserProvider } from "@/lib/auth-context";
import { eq } from "drizzle-orm";
import { db } from "@/server/db";
import { workspaces } from "@/server/db/schema";
import {
  getTasks,
  getActiveDomain,
  isFirstRun,
} from "@/server/db/queries";
import { getActiveWorkspace, getCurrentUser } from "@/server/auth";

// Layout reads from a runtime DB; mark dynamic so Next doesn't try
// to prerender app routes against a build-time empty DB.
export const dynamic = "force-dynamic";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const ws = await getActiveWorkspace();
  // First-run gate: punt straight to /welcome until the user picks a
  // starter or explicitly skips. /welcome itself reverse-redirects
  // returning users so a stale bookmark there can't trap anyone.
  if (await isFirstRun(ws)) {
    redirect("/welcome");
  }
  const [tasks, domain, currentUser, wsRow] = await Promise.all([
    getTasks(ws),
    getActiveDomain(ws),
    getCurrentUser(),
    db
      .select({ slug: workspaces.slug })
      .from(workspaces)
      .where(eq(workspaces.id, ws))
      .then((rows) => rows[0]),
  ]);
  const slug = wsRow?.slug ?? ws;
  return (
    <CurrentUserProvider user={currentUser}>
      <DomainProvider domain={domain} workspaceId={ws} workspaceSlug={slug}>
        <TasksProvider initialTasks={tasks}>
          <Suspense fallback={null}>
            <ToastRoot>
              <AddTaskRoot>
                <PaletteRoot>
                  <div className="flex h-screen w-full overflow-hidden bg-bg">
                    <AppSidebar />
                    <div className="flex min-w-0 flex-1 flex-col pb-[60px] md:pb-0">{children}</div>
                  </div>
                  <TaskDetailPanel />
                  <CrossWorkspaceOverdue />
                  <CrossWorkspaceSearch />
                  <FocusMode />
                  <ToastBridge />
                </PaletteRoot>
              </AddTaskRoot>
            </ToastRoot>
          </Suspense>
        </TasksProvider>
      </DomainProvider>
    </CurrentUserProvider>
  );
}
