import { notFound } from "next/navigation";
import { ConversationWorkspace } from "@/components/app/messages/conversation-workspace";
import { conversationAvailability, resolveConversationControls } from "@/lib/conversations/flags";
import { parseProjectId } from "@/lib/projects/project-ref";
import { authenticateConversationActor, getConversationService } from "@/server/conversations/runtime";

export const dynamic = "force-dynamic";
export const metadata = { title: "Messages · Signal Studio" };

export default async function MessagesPage({ searchParams }: { searchParams: Promise<{ projectId?: string | string[] }> }) {
  const actorId = await authenticateConversationActor();
  const controls = resolveConversationControls(process.env);
  if (!actorId || !conversationAvailability(controls, actorId).read) notFound();
  const requested = (await searchParams).projectId;
  const initialProjectId = typeof requested === "string" ? parseProjectId(requested) : null;
  if (requested !== undefined && !initialProjectId) notFound();
  const service = await getConversationService();
  const catalog = await service.listProjects({ actorId });
  if (!catalog.ok) return <main id="app-main-content" className="min-w-0 flex-1 bg-white p-8 text-stone-950"><h1>Messages</h1><p>Conversations are temporarily unavailable. Try again shortly.</p></main>;
  const projects = [...catalog.value];
  if (initialProjectId && !projects.some((project) => project.id === initialProjectId)) {
    const scope = await service.getProjectConversation({ actorId, projectId: initialProjectId });
    if (!scope.ok || !scope.value) notFound();
    projects.push({ id: initialProjectId, name: scope.value.projectName });
  }
  return <div id="app-main-content" className="min-h-0 min-w-0 flex-1"><ConversationWorkspace actorId={actorId} projects={projects} initialProjectId={initialProjectId ?? undefined} directMessagesEnabled={controls.directMessagesEnabled} /></div>;
}
