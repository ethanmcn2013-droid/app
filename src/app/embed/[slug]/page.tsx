import { notFound } from "next/navigation";
import { getPublishedWorkspaceBySlug } from "@/server/db/queries";
import { EmbedView } from "@/components/published/embed-view";

/**
 * `/embed/{slug}`, iframe-only render of a published workspace.
 * A blogger drops `<iframe src="…/embed/{slug}">` (or the one-step
 * `/embed.js`) into their post and gets a compact, read-only view.
 *
 * Resolves through the same `getPublishedWorkspaceBySlug` path the
 * public `/p/{slug}` page uses; null return is the 404 signal, both
 * for unknown slugs and for workspaces that haven't been published.
 *
 * Deliberately unindexed: this route exists to be framed, not
 * surfaced in search.
 */

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Tasks embed",
  robots: { index: false, follow: false },
};

export default async function EmbedPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const ws = await getPublishedWorkspaceBySlug(slug);
  if (!ws) notFound();

  return (
    <EmbedView
      workspace={{
        id: ws.id,
        slug: ws.slug,
        name: ws.name,
        activeDomain: ws.activeDomain,
        publishedAt: ws.publishedAt,
      }}
      tasks={ws.tasks}
    />
  );
}
