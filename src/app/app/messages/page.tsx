import { notFound } from "next/navigation";
import { ConversationWorkspace } from "@/components/app/messages/conversation-workspace";
import { conversationAvailability, resolveConversationControls } from "@/lib/conversations/flags";
import { parseProjectId } from "@/lib/projects/project-ref";
import { authenticateConversationActor, getConversationService } from "@/server/conversations/runtime";

export const dynamic = "force-dynamic";
export const metadata = { title: "Messages · Signal Studio" };

export default async function MessagesPage({ searchParams }: { searchParams: Promise<{ projectId?: string | string[]; rootId?: string | string[]; messageId?: string | string[]; messageSeq?: string | string[] }> }) {
  const actorId = await authenticateConversationActor();
  const controls = resolveConversationControls(process.env);
  if (!actorId || !conversationAvailability(controls, actorId).read) notFound();
  const params = await searchParams;
  const requested = params.projectId;
  const initialProjectId = typeof requested === "string" ? parseProjectId(requested) : null;
  if (requested !== undefined && !initialProjectId) notFound();
  const validId = (value: unknown): value is string => typeof value === "string" && /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/.test(value);
  if ((params.rootId !== undefined && !validId(params.rootId)) ||
      (params.messageId !== undefined && !validId(params.messageId)) ||
      (params.messageSeq !== undefined && (typeof params.messageSeq !== "string" || !/^[1-9]\d{0,14}$/.test(params.messageSeq) || !params.messageId)) ||
      ((params.rootId || params.messageId) && !initialProjectId)) notFound();
  const service = await getConversationService();
  const catalog = await service.listProjects({ actorId });
  if (!catalog.ok) return <main id="app-main-content" className="min-w-0 flex-1 bg-white p-8 text-stone-950"><h1>Messages</h1><p>Conversations are temporarily unavailable. Try again shortly.</p></main>;
  const projects = [...catalog.value];
  if (initialProjectId && !projects.some((project) => project.id === initialProjectId)) {
    const scope = await service.getProjectConversation({ actorId, projectId: initialProjectId });
    if (!scope.ok || !scope.value) notFound();
    projects.push({ id: initialProjectId, name: scope.value.projectName });
  }
  return <div id="app-main-content" className="min-h-0 min-w-0 flex-1"><ConversationWorkspace actorId={actorId} projects={projects} initialProjectId={initialProjectId ?? undefined} initialRootId={params.rootId as string | undefined} initialMessageId={params.messageId as string | undefined} initialMessageSeq={params.messageSeq ? Number(params.messageSeq) : undefined} directMessagesEnabled={controls.directMessagesEnabled} /></div>;
}
