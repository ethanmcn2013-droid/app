"use client";

import type { AudienceTimelineDto } from "@/modules/timeline/lib/audience-timeline";
import { TimelineArtifact } from "@/modules/timeline/components/artifact";
import { QualifiedViewTracker } from "./qualified-view-tracker";

/**
 * The shared-link shell owns the two browser-only behaviours that must never
 * leak into the reusable artifact: copying the current bearer URL and
 * recording a qualified viewer session. Owner previews render TimelineArtifact
 * directly, so they cannot increment the public counter by accident.
 */
export function SharedTimelineArtifact({ timeline }: { timeline: AudienceTimelineDto }) {
  return (
    <>
      <TimelineArtifact
        timeline={timeline}
        copyLinkLabel="Share this timeline"
        onCopyLink={() => navigator.clipboard.writeText(window.location.href)}
      />
      <QualifiedViewTracker publicationId={timeline.publicationId} mode="shared" />
    </>
  );
}
