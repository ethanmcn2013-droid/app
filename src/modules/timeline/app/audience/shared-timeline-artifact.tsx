"use client";

import type { AudienceTimelineDto } from "@/modules/timeline/lib/audience-timeline";
import { useEffect, useState } from "react";
import type { GuestTimelineServices } from "../../lib/master3-calendar";
import { TimelineFollow, TimelineFollowAction } from "../../components/artifact/timeline-follow";
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
  const current = new URL(window.location.href);
  current.search = "";
  current.hash = "";
  const url = current.href;
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

export function SharedTimelineArtifact({ timeline, shareToken, services, subscriber }: {
  timeline: AudienceTimelineDto;
  shareToken?: string;
  services?: GuestTimelineServices | null;
  subscriber?: { emailHint: string; unsubscribeProof: string };
}) {
  const [shareUrl, setShareUrl] = useState<string>();
  useEffect(() => {
    if (!shareToken) return;
    // Only a normal public share is shareable. A signed subscriber URL is a
    // personal management capability and must never enter the share sheet.
    setShareUrl(new URL(`/s/${encodeURIComponent(shareToken)}`, window.location.origin).href);
  }, [shareToken]);
  return (
    <>
      <TimelineArtifact
        timeline={timeline}
        shareLabel="Share this timeline"
        onShare={shareToken ? () => shareCurrentUrl(timeline.label) : undefined}
        guestServices={{
          ...(shareUrl ? { shareUrl } : {}),
          ...(services?.calendar ? { calendar: services.calendar } : {}),
          ...(shareToken ? { follow: <TimelineFollow shareToken={shareToken} /> } : subscriber ? {
            follow: <TimelineFollowAction inline
              endpoint="/api/timeline/share/subscriber/unsubscribe"
              undoEndpoint="/api/timeline/share/subscriber/undo"
              proof={subscriber.unsubscribeProof}
              label={`Following with ${subscriber.emailHint}`} actionLabel="Unfollow" />,
          } : {}),
        }}
      />
      {shareToken ? <QualifiedViewTracker publicationId={timeline.publicationId} mode="shared" /> : null}
    </>
  );
}
