import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getCurrentWorkspace,
  requireUser,
  resolveTimelineContext,
} from "@/modules/timeline/server/auth";
import { getEffectiveNodesForWorkspace } from "@/modules/timeline/server/db/timeline-queries";
import { getProjectsForWorkspace } from "@/modules/timeline/server/db/timeline-queries";
import {
  audienceTimelineEnabled,
  getOwnerAudiencePublications,
} from "@/modules/timeline/server/audience-timeline";
import { ProjectTile, TimelineTabs } from "@/components/app/portfolio/timeline-tabs";
import { monogramOf } from "@/lib/projects/project-chooser";
import { AudienceManager } from "./audience-manager";
import styles from "./audience-page.module.css";

export const dynamic = "force-dynamic";
export const metadata = { title: "Shared pages · Timeline", robots: { index: false, follow: false } };

export default async function AudienceTimelineManagerPage({
  searchParams,
}: {
  searchParams: Promise<{
    workspaceId?: string;
    planningPeriodId?: string;
    project?: string;
  }>;
}) {
  const userId = await requireUser();
  const requested = await searchParams;
  const requestedWorkspaceId = requested.workspaceId?.trim();
  const context = requestedWorkspaceId
    ? await resolveTimelineContext(
        userId,
        requestedWorkspaceId,
        requested.planningPeriodId?.trim(),
      )
    : null;
  if (requestedWorkspaceId && !context) notFound();
  const workspace = context?.workspace ?? (await getCurrentWorkspace(userId));
  if (!workspace || workspace.ownerUserId !== userId) notFound();
  const contextQuery = context
    ? `?workspaceId=${encodeURIComponent(context.workspaceId)}${
        context.planningPeriodId
          ? `&planningPeriodId=${encodeURIComponent(context.planningPeriodId)}`
          : ""
      }`
    : "";

  const [nodes, projects, publications] = await Promise.all([
    getEffectiveNodesForWorkspace(workspace.slug),
    getProjectsForWorkspace(workspace.slug),
    getOwnerAudiencePublications(workspace.slug),
  ]);
  const requestedProject = requested.project?.trim();
  const project = requestedProject
    ? projects.find((candidate) => candidate.slug === requestedProject)
    : null;
  if (requestedProject && !project) notFound();
  const eligibleNodes = nodes.filter(
    (node) => !node.hidden && (!project || node.projectSlug === project.slug),
  );
  const eligibleNodeIds = new Set(eligibleNodes.map((node) => node.id));
  const projectPublications = project
    ? publications.filter(
        (publication) =>
          publication.projectSlug === project.slug ||
          (publication.projectSlug === null &&
            publication.items.some((item) =>
              eligibleNodeIds.has(item.sourceRelation),
            )),
      )
    : publications;

  // Where the owner is in the one lifecycle: nothing chosen yet, a page being
  // reviewed, or a page that is live.
  const step = projectPublications.some((publication) => publication.state === "published")
    ? "publish"
    : projectPublications.length > 0
      ? "review"
      : "choose";
  const contextParams = new URLSearchParams(contextQuery.replace(/^\?/, ""));
  const planHref = (slug: string) => {
    const value = contextParams.toString();
    return `/app/timeline/${encodeURIComponent(slug)}${value ? `?${value}` : ""}`;
  };
  const suiteProjectId = context?.workspaceId ?? workspace.suiteWorkspaceId ?? workspace.slug;
  const overviewHref =
    context?.workspaceId ?? workspace.suiteWorkspaceId
      ? `/app/project?${new URLSearchParams({ workspaceId: suiteProjectId })}`
      : null;
  const projectLine = (
    <>
      <ProjectTile id={suiteProjectId} monogram={monogramOf(workspace.name)} className={styles.projectTile} />
      <span>{workspace.name}</span>
      {project ? (
        <>
          <span className={styles.crumbSep} aria-hidden="true">
            ›
          </span>
          <span>{project.name}</span>
        </>
      ) : null}
    </>
  );

  return (
    <div data-timeline-module className={styles.page}>
      <div className={styles.column}>
      <div className={styles.tabsRow}>
        <TimelineTabs
          current="project"
          allHref={`/app/timeline${contextQuery}`}
          project={{
            id: suiteProjectId,
            name: workspace.name,
            monogram: monogramOf(workspace.name),
            href: planHref(project?.slug ?? projects[0]?.slug ?? ""),
          }}
          sections={[
            {
              title: `Timelines in ${workspace.name}`,
              options: projects.map((plan) => ({ key: `plan:${plan.slug}`, name: plan.name, href: planHref(plan.slug) })),
            },
          ]}
        />
      </div>
      <header className={styles.header}>
        {project ? (
          <Link href={planHref(project.slug)} className={styles.projectLine}>
            {projectLine}
          </Link>
        ) : overviewHref ? (
          <Link href={overviewHref} className={styles.projectLine}>
            {projectLine}
          </Link>
        ) : (
          <span className={styles.projectLine}>{projectLine}</span>
        )}
        <h1 className={styles.title}>Shared pages</h1>
        <p className={styles.lede}>
          {project ? `Share ${project.name}, and nothing else. ` : "Share the journey, and nothing else. "}
          Anyone with a published link can open and forward the frozen copy.
          It is absent from directories and search, never gives access to the
          Project, and source changes wait for your review before they appear.
        </p>
        <ol className={styles.steps} aria-label="How sharing works">
          <li className={styles.step} aria-current={step === "choose" ? "step" : undefined}>
            <strong>Choose</strong>
            <span>Only the milestones you select are copied.</span>
          </li>
          <li className={styles.step} aria-current={step === "review" ? "step" : undefined}>
            <strong>Review</strong>
            <span>The shared copy stays separate from your plan.</span>
          </li>
          <li className={styles.step} aria-current={step === "publish" ? "step" : undefined}>
            <strong>Publish</strong>
            <span>Anyone with the link can view or forward it.</span>
          </li>
        </ol>
      </header>
      <AudienceManager
        workspaceSlug={workspace.slug}
        suiteWorkspaceId={workspace.suiteWorkspaceId}
        workspaceName={workspace.name}
        enabled={audienceTimelineEnabled()}
        sourceNodes={eligibleNodes.map((node) => ({
            id: node.id,
            title: node.title,
            targetDate: node.targetDate,
            lane: node.lane,
            audienceState: node.audienceState,
          }))}
        publications={projectPublications}
        defaultLabel={project?.name}
        defaultAudienceKind={
          workspace.templateId?.includes("wedding") ? "couple" : "class"
        }
        projectName={project?.name}
        projectSlug={project?.slug}
        contextQuery={contextQuery}
      />
      </div>
    </div>
  );
}
