import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  getCurrentWorkspace,
  requireUser,
  resolveTimelineContext,
} from "@/modules/timeline/server/auth";
import { getOwnerAudiencePublications } from "@/modules/timeline/server/audience-timeline";
import { ownerPublicationToTimelineDto } from "@/modules/timeline/lib/owner-artifact";
import { TimelineArtifactStudio } from "../artifact-studio";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Artifact studio · Timeline",
  robots: { index: false, follow: false },
};

export default async function TimelineArtifactStudioPage({
  params,
  searchParams,
}: {
  params: Promise<{ publicationId: string }>;
  searchParams: Promise<{ workspaceId?: string; planningPeriodId?: string }>;
}) {
  const userId = await requireUser();
  const [{ publicationId }, requested] = await Promise.all([params, searchParams]);
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

  const publications = await getOwnerAudiencePublications(workspace.slug);
  const publication = publications.find((candidate) => candidate.id === publicationId);
  if (!publication) notFound();

  const contextQuery = context
    ? `?workspaceId=${encodeURIComponent(context.workspaceId)}${
        context.planningPeriodId
          ? `&planningPeriodId=${encodeURIComponent(context.planningPeriodId)}`
          : ""
      }`
    : "";

  return (
    <TimelineArtifactStudio
      publication={publication}
      timeline={ownerPublicationToTimelineDto(publication)}
      managerHref={`/app/timeline/audience${contextQuery}`}
    />
  );
}
