import { Suspense } from "react";
import Link from "next/link";
import { PROJECT_APP_PATH } from "@/lib/product-urls";
import { withActiveProject } from "@/lib/projects/project-url";
import { readSponsoredWeddingDate } from "@/server/db/sponsored-wedding-date";
import { db } from "@/server/db";
import { HybridWorkspace } from "@/components/hybrid/hybrid-workspace";
import { TasksRuntimePageMount } from "@/components/app/tasks-runtime-mount";
import { TemplatedToast } from "@/components/app/templated-toast";
import { VenueWelcomeCard } from "@/components/welcome/venue-welcome-card";
import {
  detectVenueWelcome,
  markVenueEntitlementReached,
} from "@/server/db/venue-welcome";
import { getCurrentUser } from "@/server/auth";
import { isDemoMode } from "@/lib/access-mode";
import { resolveTasksArrival, TasksArrivalRefusal } from "@/components/app/tasks-project-arrival";
import {
  DEMO_SPONSOR_NAME,
  DEMO_WORKSPACE_SLUG,
} from "@/server/demo/tasks-demo";

export const metadata = { title: "Board · Tasks · Signal Studio" };

type Capabilities = { createOrEditTasks?: boolean; manageProject?: boolean } | undefined;

export default async function TasksPage({
  searchParams,
}: {
  searchParams: Promise<{ welcome?: string; workspaceId?: string | string[]; task?: string; preview?: string }>;
}) {
  const sp = await searchParams;

  const arrival = await resolveTasksArrival(sp.workspaceId);
  if (arrival.kind !== "ready") {
    return <TasksArrivalRefusal arrival={arrival} requested={sp.workspaceId} surface="tasks" taskId={sp.task} />;
  }

  // What this person may do here comes from the verified project. The
  // server re-authorises every write regardless; this only hides controls
  // that would fail. Review mode can preview the view-only state.
  const capabilities = (arrival.project as { project?: { capabilities?: Capabilities } }).project?.capabilities;
  const previewViewOnly = isDemoMode() && sp.preview === "view-only";
  const canEdit = !previewViewOnly && capabilities?.createOrEditTasks !== false;
  const canManage = canEdit && capabilities?.manageProject !== false;

  let venue: { sponsorName: string; sponsorSlug: string } | null = null;
  const weddingDate = isDemoMode() ? null : await readSponsoredWeddingDate(db, {
    actorUserId: await getCurrentUser(), projectId: arrival.project.workspaceId,
  });
  if (sp.welcome === "venue") {
    if (isDemoMode()) {
      venue = {
        sponsorName: DEMO_SPONSOR_NAME,
        sponsorSlug: DEMO_WORKSPACE_SLUG,
      };
    } else {
      const me = await getCurrentUser();
      const project = arrival.project;
      if (project.kind === "ready") {
        const welcome = await detectVenueWelcome(me, project.workspaceId);
        venue = welcome;
        if (welcome) {
          await markVenueEntitlementReached(me, project.workspaceId, welcome.code);
        }
      }
    }
  }

  return (
    <TasksRuntimePageMount searchParams={searchParams}>
      <div className="flex h-full min-h-0 flex-col">
        {weddingDate ? (
          <div className="flex flex-shrink-0 flex-wrap items-center justify-between gap-2 border-b border-[color:var(--v3-border)] bg-[color:var(--v3-sunken)] px-4 py-1 text-[13px] text-[color:var(--v3-text-2)] md:px-8">
            <span className="inline-flex items-center gap-2">
              <span aria-hidden="true" className="inline-block h-1.5 w-1.5 rounded-full bg-[color:var(--v3-accent)]" />
              Wedding date{weddingDate.weddingDate ? "" : " not set yet"}
            </span>
            <Link href={withActiveProject(`${PROJECT_APP_PATH}#wedding-date`, arrival.project.workspaceId)} className="inline-flex min-h-[44px] items-center font-medium text-[color:var(--v3-accent-text)] underline decoration-[color:var(--v3-border-strong)] underline-offset-4 hover:decoration-current">
              {weddingDate.canManage ? (weddingDate.weddingDate ? "View or update wedding date" : "Add your wedding date") : "View wedding date"}
            </Link>
          </div>
        ) : null}
        <div className="min-h-0 flex-1"><HybridWorkspace view="board" canEdit={canEdit} canManage={canManage} /></div>
      </div>
      <Suspense fallback={null}>
        <TemplatedToast />
      </Suspense>
      {venue ? (
        <VenueWelcomeCard
          sponsorName={venue.sponsorName}
          sponsorSlug={venue.sponsorSlug}
          projectId={arrival.project.workspaceId}
          canManageWeddingDate={weddingDate?.canManage ?? false}
        />
      ) : null}
    </TasksRuntimePageMount>
  );
}
