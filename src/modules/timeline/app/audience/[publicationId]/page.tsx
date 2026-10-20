import { isDemoMode } from '@/lib/access-mode';
import { db } from '../../../server/db/timeline-client';
import { createOwnerGuestSummaryStore, saveOwnerReferralPreference } from '../../../server/owner-guest-summary';
import { saveMaster3ReferralAction } from '../../../server/actions/audience-timeline';
import { master3Settings } from '../../../server/master3-settings';
import { Master3SettingsForm } from '../master3-settings-form';
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  getCurrentWorkspace,
  requireUser,
  resolveTimelineContext,
} from "@/modules/timeline/server/auth";
import { getOwnerAudiencePublications } from "@/modules/timeline/server/audience-timeline";
import { ownerPublicationToTimelineDto } from "@/modules/timeline/lib/owner-artifact";
import { presentViewerCount } from "@/modules/timeline/lib/viewer-count";
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

  // The manager can be filtered to one Project (`?project=`); return there
  // when the publication belongs to one, alongside the resolved context.
  const managerQuery = new URLSearchParams();
  if (context) {
    managerQuery.set("workspaceId", context.workspaceId);
    if (context.planningPeriodId) managerQuery.set("planningPeriodId", context.planningPeriodId);
  }
  const contextSearch = managerQuery.toString();
  const timelinesHref = `/app/timeline/audience${contextSearch ? `?${contextSearch}` : ""}`;
  const guestPreviewHref = `/app/timeline/audience/${encodeURIComponent(publication.id)}${contextSearch ? `?${contextSearch}` : ""}#guest-phone-preview`;
  if (publication.projectSlug) managerQuery.set("project", publication.projectSlug);
  const managerSearch = managerQuery.toString();

  const guestSummaryStore = createOwnerGuestSummaryStore(db);
  const demo = isDemoMode();
  const guestSummary = demo ? {} : await guestSummaryStore.read(userId, workspace.slug, publication.id);
  const settingsAvailable = await master3Settings.available();
  const settings = settingsAvailable ? await master3Settings.publication(publication.id) : undefined;
  const ownerWorkspaceSlug = workspace.slug, ownerPublicationId = publication.id;
  async function saveReferralAction(enabled: boolean) {
    'use server';
    const actorId = await requireUser();
    const store = createOwnerGuestSummaryStore(db);
    await saveOwnerReferralPreference({
      authorize: () => store.authorized(actorId, ownerWorkspaceSlug, ownerPublicationId),
      save: form => saveMaster3ReferralAction({}, form),
    }, { workspaceSlug: ownerWorkspaceSlug, publicationId: ownerPublicationId }, enabled);
  }

  return (
    <>
    <TimelineArtifactStudio
      publication={{ state: publication.state, activeShareCount: publication.activeShareCount,
        milestoneCount: publication.items.filter(item => item.state !== 'cancelled').length,
        views: presentViewerCount({ count: publication.qualifiedViewCount, lastViewedAt: publication.lastQualifiedViewAt }) }}
      followerCount={guestSummary.followerCount}
      settingsAvailable={settingsAvailable}
      timelinesHref={timelinesHref}
      guestPreviewHref={guestPreviewHref}
      saveReferralAction={!demo && settingsAvailable ? saveReferralAction : undefined}
      timeline={ownerPublicationToTimelineDto(publication)}
      managerHref={`/app/timeline/audience${managerSearch ? `?${managerSearch}` : ""}`}
    />
    {settingsAvailable?<Master3SettingsForm workspaceSlug={workspace.slug} publicationId={publication.id} settings={settings} items={publication.items.map(item=>({id:item.publicId,title:item.title}))}/>:null}
    </>
  );
}
