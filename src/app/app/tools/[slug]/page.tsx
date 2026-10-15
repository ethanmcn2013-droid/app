import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireAppAccessTasks } from "@/server/app-access";
import { LAUNCHER_NAME, toolBySlug } from "@/components/shell/launcher/launcher-catalog";
import { ToolPlaceholder } from "@/components/shell/launcher/tool-placeholder";
import { WeddingHub } from "@/components/app/wedding/wedding-hub";
import { isDemoMode } from "@/lib/access-mode";
import { withActiveProject } from "@/lib/projects/project-url";
import { assertProjectId } from "@/lib/projects/project-ref";
import { listMyWorkspaces } from "@/server/auth";
import { readWeddingIdsWith } from "@/server/wedding/guests";
import { db } from "@/server/db";
import { canShowMessagesForTools } from "../messages-gate";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const tool = toolBySlug(slug);
  return { title: `${slug === "wedding-planner" ? "Wedding hub" : tool ? tool.name : LAUNCHER_NAME} · Signal Studio` };
}

/**
 * /app/tools/[slug]: an honest tool landing. Wedding is an active directory
 * for its existing Guest list; other tools on the way use the shared
 * placeholder. Unknown slugs are a 404, never an empty template.
 */
export default async function ToolPage({ params }: Props) {
  await requireAppAccessTasks();
  const { slug } = await params;
  const tool = toolBySlug(slug);
  if (!tool) notFound();
  if (slug === "wedding-planner") {
    const memberProjects = await listMyWorkspaces();
    // Demo membership is a synthetic wedding project backed by the existing
    // Guest list fixture. The demo path must remain database-free.
    if (isDemoMode()) {
      return <WeddingHub projects={memberProjects.map(({ id, name }) => ({ id, name, href: withActiveProject("/app/wedding/guests", assertProjectId(id)) }))} />;
    }

    // Keep the classification read bounded like the sidebar, and only ask
    // about projects the current user is already known to be a member of.
    const candidates = memberProjects.slice(0, 200);
    let weddingIds: string[];
    try {
      weddingIds = await readWeddingIdsWith(db, candidates.map((project) => project.id));
    } catch {
      return <WeddingHub projects={[]} available={false} />;
    }
    const weddingIdSet = new Set(weddingIds);
    return (
      <WeddingHub
        projects={candidates
          .filter((project) => weddingIdSet.has(project.id))
          .map(({ id, name }) => ({ id, name, href: withActiveProject("/app/wedding/guests", assertProjectId(id)) }))}
      />
    );
  }
  const messagesEnabled = await canShowMessagesForTools();
  return <ToolPlaceholder tool={tool} messagesEnabled={messagesEnabled} />;
}
