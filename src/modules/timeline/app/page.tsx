import Link from "next/link";
import { redirect } from "next/navigation";
import { CreateProjectForm } from "@/modules/timeline/app/_components/create-project-form";
import { getProjectEmptyCopy } from "@/modules/timeline/lib/onboarding/personalization";
import { buildTimelineProjectHref } from "@/modules/timeline/lib/project-switcher-model";
import {
  getCurrentWorkspace,
  requireUser,
  resolveTimelineContext,
} from "@/modules/timeline/server/auth";
import { getProjectsForWorkspace } from "@/modules/timeline/server/db/timeline-queries";

export const metadata = { title: "Timeline · Signal Studio" };
export const dynamic = "force-dynamic";

type SearchParams = {
  workspaceId?: string;
  planningPeriodId?: string;
  project?: string;
  projectSlug?: string;
  mode?: string;
};

/**
 * Timeline is project-first. Returning owners land in a real timeline, not a
 * second dashboard they must interpret before reaching the work.
 */
export default async function TimelineOwnerHome({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const userId = await requireUser();
  const requested = await searchParams;
  const requestedWorkspaceId = requested.workspaceId?.trim();
  const resolvedContext = requestedWorkspaceId
    ? await resolveTimelineContext(
        userId,
        requestedWorkspaceId,
        requested.planningPeriodId?.trim(),
      )
    : null;

  if (requestedWorkspaceId && !resolvedContext) {
    return <UnavailableWorkspaceContext />;
  }

  const workspace =
    resolvedContext?.workspace ?? (await getCurrentWorkspace(userId));
  if (!workspace) {
    return (
      <div
        data-timeline-module
        className="mx-auto flex w-full max-w-3xl flex-1 items-center px-5 py-16 sm:px-8"
      >
        <div className="w-full rounded-2xl border border-line-soft bg-white p-7 sm:p-10">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-accent-hover">
            Timeline
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-ink">
            Your projects will appear here.
          </h1>
          <p className="mt-3 max-w-xl text-sm leading-6 text-ink-soft">
            Create a workspace in Tasks first. Milestone tasks become the
            private timeline you shape here before anything is shared.
          </p>
          <Link
            href="/app/tasks"
            className="mt-6 inline-flex min-h-[44px] items-center rounded-lg bg-ink px-4 text-sm font-medium text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
          >
            Open Tasks
          </Link>
        </div>
      </div>
    );
  }

  const projects = await getProjectsForWorkspace(workspace.slug);
  const requestedProjectSlug =
    requested.projectSlug?.trim() ?? requested.project?.trim();
  const project =
    projects.find((candidate) => candidate.slug === requestedProjectSlug) ??
    projects[0];
  if (project) {
    // Redirect, not a direct call.
    //
    // This used to invoke the project page as a plain async function and
    // return its element, which renders the right pixels at the wrong
    // address: the URL stays /app/timeline, so the [projectSlug] segment's
    // own loading boundary never mounts (its Suspense fallback belongs to a
    // route this request never entered) and its generateMetadata never runs,
    // leaving the tab titled by the generic module metadata instead of the
    // project. Every project link the app emits already points at the
    // canonical path, so the entry that lands here — a bare /app/timeline, or
    // an ?project= deep link — is the one case that was being served an
    // uncanonical URL.
    //
    // The path comes from the module's own URL helper rather than being
    // spelled here, so it stays inside the suite naming contract
    // (docs/SUITE_URL_AND_NAMING_CONTRACT.md: signed-in Timeline lives at
    // /app/timeline/*, and /app/plan/* is a retired input no new UI emits).
    // `mode` rides along so a Milestones deep link still lands in Milestones.
    redirect(
      buildTimelineProjectHref(project.slug, {
        workspaceId: resolvedContext?.workspaceId,
        planningPeriodId: resolvedContext?.planningPeriodId,
        mode: requested.mode === "edit" ? "edit" : null,
      }),
    );
  }

  // Everything below still renders in place at /app/timeline, because none of
  // it has a project to redirect to: no workspace, an unavailable workspace
  // context, and a workspace whose project list is empty. The route keeps its
  // no-project semantics; only the has-a-project case moves.

  // The empty state speaks the workspace's own language. The copy lives in
  // one place rather than being paraphrased here, so a venue that started
  // from the wedding template is met in wedding words.
  const emptyCopy = getProjectEmptyCopy({ templateId: workspace.templateId });

  return (
    <div
      data-timeline-module
      className="mx-auto flex w-full max-w-3xl flex-1 items-center px-5 py-16 sm:px-8"
    >
      <section className="w-full rounded-2xl border border-line-soft bg-white p-7 sm:p-10">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-accent-hover">
          Timeline
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-ink">
          {emptyCopy.headline}
        </h1>
        <p className="mt-3 max-w-xl text-sm leading-6 text-ink-soft">
          {emptyCopy.body}
        </p>
        <div className="mt-7 max-w-md">
          <CreateProjectForm workspaceSlug={workspace.slug} />
        </div>
      </section>
    </div>
  );
}

function UnavailableWorkspaceContext() {
  return (
    <div
      data-timeline-module
      className="mx-auto flex w-full max-w-3xl flex-1 items-center px-5 py-16 sm:px-8"
    >
      <div className="w-full rounded-2xl border border-line-soft bg-white p-7 sm:p-10">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-accent-hover">
          Timeline
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-ink">
          That workspace is not available.
        </h1>
        <p className="mt-3 max-w-xl text-sm leading-6 text-ink-soft">
          It may have been removed, or your access may have changed. Return to
          Tasks and choose a workspace you can open.
        </p>
        <Link
          href="/app/tasks"
          className="mt-6 inline-flex min-h-[44px] items-center rounded-lg bg-ink px-4 text-sm font-medium text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
        >
          Open Tasks
        </Link>
      </div>
    </div>
  );
}
