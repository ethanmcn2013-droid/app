/**
 * What guests see, for the plan's side column (spec 3.2): the page a guest
 * opens, from the latest publication (the frozen copy, never the live
 * plan), drawn compact. The column puts it in a phone frame, read-only and
 * inert. Server-rendered here so the plan surface only ever receives it as
 * finished markup.
 */

import { TimelineArtifact } from "@/modules/timeline/components/artifact";
import type { AudienceOwnerPublication } from "@/modules/timeline/server/audience-timeline";
import { ownerPublicationToTimelineDto } from "@/modules/timeline/lib/owner-artifact";

export function GuestPreview({ publication, now }: { publication: AudienceOwnerPublication; now: Date }) {
  return <TimelineArtifact timeline={ownerPublicationToTimelineDto(publication, now)} compact />;
}
