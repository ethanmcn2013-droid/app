import { Suspense } from "react";
import { redirect } from "next/navigation";
import AppLoading from "./loading";
import { AppSidebar } from "@/components/app/sidebar";
import { SuiteChrome } from "@/components/app/suite-chrome";
import { FirstCompletionMoment } from "@/components/app/done-dopamine/first-completion-moment";
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
import { requireAppAccess } from "@/server/require-app-access";
import { getWorkspacePersonalization } from "@/lib/onboarding/personalization";
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
 * SuiteChrome (no auth deps, client component) stays at layout level
 * and renders instantly, "chrome lives in layout (instant, never re-blanks)".
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
  const [tasks, domain, currentUser, wsRow] = await Promise.all([
    getTasks(ws),
    getActiveDomain(ws),
    getCurrentUser(),
    // Demo/Review: synthesize the workspace row instead of hitting the DB.
    isDemoMode()
      ? Promise.resolve({
          slug: DEMO_WORKSPACE_SLUG,
          primaryUseCase: DEMO_PRIMARY_USE_CASE,
        })
      : db
          .select({
            slug: workspaces.slug,
            primaryUseCase: workspaces.primaryUseCase,
          })
          .from(workspaces)
          .where(eq(workspaces.id, ws))
          .then((rows) => rows[0]),
  ]);
  const slug = wsRow?.slug ?? ws;
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
        personalization={personalization}
      >
        <TasksProvider initialTasks={tasks}>
          <ToastRoot>
            <AddTaskRoot>
              <PaletteRoot>
                <AppSidebar />
                <main className="flex min-w-0 flex-1 flex-col pb-[60px] md:pb-0">
                  {children}
                </main>
                <TaskDetailPanel />
                <CrossWorkspaceOverdue />
                <CrossWorkspaceSearch />
                <FocusMode />
                <ToastBridge />
              </PaletteRoot>
            </AddTaskRoot>
          </ToastRoot>
        </TasksProvider>
      </DomainProvider>
    </CurrentUserProvider>
  );
}

/**
 * AppLayout, the /app segment layout.
 *
 * SuiteChrome renders synchronously at this level (client component,
 * no auth deps) so it is always painted and never re-blanks, the
 * monotonic reveal contract from LOADING_SYSTEM.md §4.
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
     * L4, persistent top chrome (DESIGN.md §14).
     * SuiteChrome is sticky h-14; gives all /app routes the cross-product
     * breadcrumb. Layout restructured: flex-col wraps chrome + flex-row
     * (sidebar + content). overflow-hidden on the inner row so the chrome
     * scrolls with the page (sticky) while the content area clips correctly.
     *
     * P1-2/P1-4 fix (DECISIONS.md D5): SuiteChrome rendered at this
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
    <div className="flex h-screen w-full flex-col bg-bg">
      <SuiteChrome />
      <FirstCompletionMoment />
      <div className="flex min-w-0 flex-1 overflow-hidden">
        <Suspense fallback={<AppLoading />}>
          <AppShell>{children}</AppShell>
        </Suspense>
      </div>
    </div>
  );
}
