"use client";

import type { AudienceTimelineDto } from "@/modules/timeline/lib/audience-timeline";
import {
  TimelineArtifact,
  type TimelineShareOutcome,
} from "@/modules/timeline/components/artifact";
import { QualifiedViewTracker } from "./qualified-view-tracker";

/**
 * The shared-link shell owns the two browser-only behaviours that must never
 * leak into the reusable artifact: sharing the current bearer URL and
 * recording a qualified viewer session. Owner previews render TimelineArtifact
 * directly, so they cannot increment the public counter by accident.
 *
 * Sharing prefers the platform share sheet — the verb guests expect on the
 * phones this page lives on — and falls back to the clipboard. A dismissed
 * sheet is a decision, not a failure.
 */
async function shareCurrentUrl(label: string): Promise<TimelineShareOutcome> {
  const url = window.location.href;
  if (typeof navigator.share === "function") {
    try {
      await navigator.share({ title: label, url });
      return "shared";
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return "dismissed";
      }
      // Share sheet unavailable after all (permissions, embedded webview):
      // fall through to the clipboard.
    }
  }
  await navigator.clipboard.writeText(url);
  return "copied";
}

export function SharedTimelineArtifact({ timeline }: { timeline: AudienceTimelineDto }) {
  return (
    <>
      <TimelineArtifact
        timeline={timeline}
        shareLabel="Share this timeline"
        onShare={() => shareCurrentUrl(timeline.label)}
      />
      <QualifiedViewTracker publicationId={timeline.publicationId} mode="shared" />
    </>
  );
}
