import { notFound } from "next/navigation";
import { getPublishedWorkspaceBySlug } from "@/server/db/queries";
import { PublishedWorkspace } from "@/components/published/published-workspace";
import { DOMAINS } from "@/lib/domains";

/**
 * `/p/[slug]`, the public read-only render of any published
 * workspace. Server-rendered for indexing. Resolves through
 * `getPublishedWorkspaceBySlug`, which returns null for both
 * "unknown slug" and "exists but not published", both 404 here.
 *
 * The owner toggles publication via Settings → Workspace.
 */

// ISR, not force-dynamic: this is a public, indexable, rarely-changing
// page hit by crawlers and social unfurls. publish/unpublish both call
// revalidatePath(`/p/${slug}`) so owner toggles reflect immediately;
// the 60s window only delays task-content edits. Mirrors /share/[token].
export const revalidate = 60;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const ws = await getPublishedWorkspaceBySlug(slug);
  if (!ws) return { title: "Not found, Tasks" };

  const domainLabel = ws.activeDomain
    ? DOMAINS[ws.activeDomain]?.label ?? ""
    : "";
  const title = domainLabel
    ? `${ws.name}, ${domainLabel} workspace`
    : ws.name;
  // Human description for press, social previews, and search snippets.
  // Leads with the workspace name and what it is, ends with the brand
  // shape, same tasks, four lenses. Falls under 160 chars in the
  // common case.
  const lensClause = "board, list, timeline, calendar.";
  const description = domainLabel
    ? `${ws.name}, a real ${domainLabel.toLowerCase()} workspace made public on Tasks. Same items, four lenses: ${lensClause}`
    : `${ws.name}, a real workspace made public on Tasks. Same items, four lenses: ${lensClause}`;

  // R-031 / D-033 Option B. /p exists to be crawled and that stays true for an
  // ordinary published workspace: a findable, unfurlable link is the point.
  //
  // A WEDDING workspace is different. Its task titles and tags carry guests' and
  // suppliers' names, and the couple did not ask to be indexed when they pressed
  // publish. So a wedding workspace is noindex BY DEFAULT here, and search
  // visibility becomes an explicit couple opt-in rather than a consequence of
  // publishing. Until that opt-in exists, the default is the whole behaviour.
  //
  // robots.ts also disallows /p, but robots.txt is a request a crawler may ignore
  // and it does nothing about a link shared into a system that fetches previews.
  // This header is the control; robots.txt is the courtesy.
  const isWedding = ws.activeDomain === "wedding";

  return {
    title,
    description,
    ...(isWedding
      ? {
          robots: {
            index: false,
            follow: false,
            noarchive: true,
            nosnippet: true,
          },
        }
      : {}),
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
