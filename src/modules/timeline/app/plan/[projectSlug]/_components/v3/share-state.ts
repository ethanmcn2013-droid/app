/**
 * What a plan may say about its shared page, in one shape (v3).
 *
 * Plain data, so the server page can hand it straight to the client. Every
 * state is derived from data the page already loads, and none is rendered
 * that cannot be:
 *
 *  - "live" is published AND at least one link still open. Switching every
 *    link off leaves the state reading "published" while nothing opens, so
 *    keying off the state column alone would tell an owner their plan is
 *    reachable when it is not.
 *  - "since" comes from `publishedAt`, the column publish and new-link
 *    write, never from a last-touched time.
 *  - There is no audience name to state. Links are bearer links: anyone
 *    holding one can read the page, so nothing ever names a reader.
 *  - "not on it yet" counts milestones that changed after they were copied;
 *    the shared page keeps its copy until the owner publishes again.
 */

import { formatShortDay } from "@/lib/projects/project-portfolio-scale";

export type SharePublicationSummary = Readonly<{
  id: string;
  label: string;
  state: "draft" | "published" | "unpublished";
  /** Links a guest could actually open right now. */
  activeShareCount: number;
  /** The publication's own calendar zone. */
  timezone: string;
  /** Milestones whose source changed after they were copied, by title. */
  divergedTitles: readonly string[];
  /** Calendar day it was last published, in its own zone. */
  publishedOn: string | null;
  /** Calendar day it was taken down, when it was. */
  unpublishedOn?: string | null;
}>;

export type ShareStateKind = "private" | "draft" | "live" | "off" | "unpublished";

export function shareStateOf(publication: SharePublicationSummary | null): ShareStateKind {
  if (!publication) return "private";
  if (publication.state === "published") return publication.activeShareCount > 0 ? "live" : "off";
  if (publication.state === "unpublished") return "unpublished";
  return "draft";
}

function links(count: number): string {
  return count === 1 ? "1 link" : `${count} links`;
}

/** The first clause of the status line: who can see this plan right now. */
export function shareClause(publication: SharePublicationSummary | null, todayIso: string): string {
  const kind = shareStateOf(publication);
  if (!publication || kind === "private") return "Private to this project";
  if (kind === "live") return "Shared page live";
  if (kind === "off") return "Links are off";
  if (kind === "unpublished") return "Shared page taken down";
  return `Ready to share, not live yet${publication.publishedOn ? ` · last live ${formatShortDay(publication.publishedOn, todayIso)}` : ""}`;
}

/** "1 link", "Live since 15 Jul · 1 link": the context column's words. */
export function liveSince(publication: SharePublicationSummary, todayIso: string): string {
  const since = publication.publishedOn ? `Live since ${formatShortDay(publication.publishedOn, todayIso)}` : "Live";
  return `${since} · ${links(publication.activeShareCount)}`;
}

export function linkCount(count: number): string {
  return links(count);
}

export function changesClause(count: number): string | null {
  if (count <= 0) return null;
  return count === 1 ? "1 change not on it yet" : `${count} changes not on it yet`;
}
