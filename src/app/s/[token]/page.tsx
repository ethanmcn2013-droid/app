import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SharedTimelineArtifact } from "@/modules/timeline/app/audience/shared-timeline-artifact";
import type { AudienceKind } from "@/modules/timeline/lib/audience-timeline";
import { resolveAudienceTimeline } from "@/modules/timeline/server/audience-timeline";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

/**
 * Viewer vocabulary, never the storage enum: "A shared couple timeline." was
 * grammar from a database column. The unfurl introduces the page in the same
 * register the artifact's own kicker uses.
 */
const KIND_DESCRIPTIONS: Readonly<Record<AudienceKind, string>> = {
  couple: "A shared wedding timeline.",
  class: "A shared class timeline.",
  module: "A shared project timeline.",
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ token: string }>;
}): Promise<Metadata> {
  const { token } = await params;
  const result = await resolveAudienceTimeline(token);

  // Resolve unavailable links before React begins streaming the page. Calling
  // notFound only from the page body can produce a soft 404 with a 200 status
  // once the response stream has started.
  if (result.kind !== "ok") notFound();

  const description = KIND_DESCRIPTIONS[result.dto.audienceKind];
  // Twitter-style consumers read their own tags or fall back to the layout's
  // generic containment card — which drops the timeline's name. Mirror the
  // OpenGraph facts explicitly so every unfurl carries the label. The card
  // image comes from the segment's file convention (`../opengraph-image`),
  // which is deliberately data-free.
  return {
    title: `${result.dto.label} · timeline`,
    description,
    alternates: { canonical: null },
    manifest: null,
    robots: { index: false, follow: false, noarchive: true, nosnippet: true },
    openGraph: {
      title: result.dto.label,
      description,
      type: "website",
      siteName: "timeline",
    },
    twitter: {
      card: "summary_large_image",
      title: result.dto.label,
      description,
    },
  };
}

export default async function SharedTimelinePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const result = await resolveAudienceTimeline(token);
  if (result.kind !== "ok") notFound();

  return (
    <main className="contents">
      <SharedTimelineArtifact timeline={result.dto} />
    </main>
  );
}
