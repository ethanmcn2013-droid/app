import type { PublicTask } from "@/lib/data";
import type { PublicColumn } from "@/lib/public-board-lanes";
import type { DomainId } from "@/lib/domains";

/**
 * The contract every domain theme renders against. Themes own the
 * full page body (everything inside <main>), including their own
 * hero treatment, task rendering, and any chrome above/around.
 *
 * The shared `<PublishedFooter>` is always rendered AFTER the theme
 * by the page-level wrapper, so themes don't need to include it
 * themselves. That's the only piece of structure that's shared
 * across the four domain treatments.
 */
export type PublishedWorkspaceProps = {
  workspace: {
    id: string;
    slug: string;
    name: string;
    activeDomain: DomainId | null;
    publishedAt: Date;
  };
  tasks: PublicTask[];
  /** Resolved workspace columns (T·121). Optional so the /p themes that
   *  do not group by column keep their existing contract. */
  columns?: PublicColumn[];
};
