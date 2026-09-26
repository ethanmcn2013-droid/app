import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireAppAccessTasks } from "@/server/app-access";
import { LAUNCHER_NAME, toolBySlug } from "@/components/shell/launcher/launcher-catalog";
import { ToolPlaceholder } from "@/components/shell/launcher/tool-placeholder";
import { canShowMessagesForTools } from "../messages-gate";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const tool = toolBySlug(slug);
  return { title: `${tool ? tool.name : LAUNCHER_NAME} · Signal Studio` };
}

/**
 * /app/tools/[slug]: one honest template for every tool on the way. A name,
 * a promise, three plain bullets and real links to what works today. Unknown
 * slugs are a 404, never an empty template.
 */
export default async function ToolPage({ params }: Props) {
  await requireAppAccessTasks();
  const { slug } = await params;
  const tool = toolBySlug(slug);
  if (!tool) notFound();
  const messagesEnabled = await canShowMessagesForTools();
  return <ToolPlaceholder tool={tool} messagesEnabled={messagesEnabled} />;
}
