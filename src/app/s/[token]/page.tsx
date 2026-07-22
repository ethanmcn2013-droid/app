import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SharedTimelineArtifact } from "@/modules/timeline/app/audience/shared-timeline-artifact";
import { resolveAudienceTimeline } from "@/modules/timeline/server/audience-timeline";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

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

  const description = `A shared ${result.dto.audienceKind} timeline.`;
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
