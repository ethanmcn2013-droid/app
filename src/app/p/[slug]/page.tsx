import { notFound } from "next/navigation";
import { getPublishedWorkspaceBySlug } from "@/server/db/queries";
import { PublishedWorkspace } from "@/components/published/published-workspace";
import { DOMAINS } from "@/lib/domains";

/**
 * `/p/[slug]` — the public read-only render of any published
 * workspace. Server-rendered for indexing. Resolves through
 * `getPublishedWorkspaceBySlug`, which returns null for both
 * "unknown slug" and "exists but not published" — both 404 here.
 *
 * The owner toggles publication via Settings → Workspace.
 */

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const ws = await getPublishedWorkspaceBySlug(slug);
  if (!ws) return { title: "Not found — Tasks" };

  const domainLabel = ws.activeDomain
    ? DOMAINS[ws.activeDomain]?.label ?? ""
    : "";
  const title = domainLabel
    ? `${ws.name} — ${domainLabel} workspace`
    : ws.name;
  // Human description for press, social previews, and search snippets.
  // Leads with the workspace name and what it is, ends with the brand
  // shape — same tasks, four lenses. Falls under 160 chars in the
  // common case.
  const lensClause = "board, list, timeline, calendar.";
  const description = domainLabel
    ? `${ws.name} — a real ${domainLabel.toLowerCase()} workspace made public on Tasks. Same items, four lenses: ${lensClause}`
    : `${ws.name} — a real workspace made public on Tasks. Same items, four lenses: ${lensClause}`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "article",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  };
}

export default async function PublishedWorkspacePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const ws = await getPublishedWorkspaceBySlug(slug);
  if (!ws) notFound();

  return (
    <PublishedWorkspace
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
