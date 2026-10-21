import { notFound } from "next/navigation";
import { FloatingChatPage } from "@/components/app/messages/floating-chat-root";
import { isDemoMode } from "@/lib/access-mode";
import { conversationAvailability, resolveConversationControls } from "@/lib/conversations/flags";
import { parseProjectId } from "@/lib/projects/project-ref";
import { authenticateConversationActor, getConversationService } from "@/server/conversations/runtime";

export const dynamic = "force-dynamic";
export const metadata = { title: "Chat · Signal Studio" };

export default async function MessagesPage({ searchParams }: { searchParams: Promise<{ projectId?: string | string[]; conversationId?: string | string[]; rootId?: string | string[]; messageId?: string | string[]; messageSeq?: string | string[]; c?: string | string[] }> }) {
  // Demo/review: seeded conversations in the browser's memory. This returns
  // before any conversation actor, flag or service is read (access-mode.ts).
  if (isDemoMode()) { const params = await searchParams; return <FloatingChatPage demoId={typeof params.c === "string" ? params.c : undefined} />; }
  const actorId = await authenticateConversationActor();
  const controls = resolveConversationControls(process.env);
  if (!actorId || !conversationAvailability(controls, actorId).read) notFound();
  const params = await searchParams;
  const requested = params.projectId;
  const initialProjectId = typeof requested === "string" ? parseProjectId(requested) : null;
  if (requested !== undefined && !initialProjectId) notFound();
  const validId = (value: unknown): value is string => typeof value === "string" && /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/.test(value);
  const conversationId=params.conversationId;
  const initialConversationId=typeof conversationId==="string"&&validId(conversationId)?conversationId:undefined;
  if(conversationId!==undefined&&(!initialConversationId||!initialProjectId||!controls.directMessagesEnabled))notFound();
  if ((params.rootId !== undefined && !validId(params.rootId)) ||
      (params.messageId !== undefined && !validId(params.messageId)) ||
      (params.messageSeq !== undefined && (typeof params.messageSeq !== "string" || !/^[1-9]\d{0,14}$/.test(params.messageSeq) || !params.messageId)) ||
      ((params.rootId || params.messageId) && !initialProjectId)) notFound();
  const service = await getConversationService();
  if(initialConversationId){
    const direct=await service.getDirectMessage({actorId,projectId:initialProjectId!,conversationId:initialConversationId});
    if(!direct.ok||!direct.value.canRead||direct.value.lifecycle!=="active"||direct.value.projectId!==initialProjectId)notFound();
  }
  const catalog = await service.listProjects({ actorId });
  if (!catalog.ok) return <FloatingChatPage catalogUnavailable />;
  const projects = [...catalog.value];
  if (initialProjectId && !projects.some((project) => project.id === initialProjectId)) {
    const scope = await service.getProjectConversation({ actorId, projectId: initialProjectId });
    if (!scope.ok || !scope.value) notFound();
    projects.push({ id: initialProjectId, name: scope.value.projectName });
  }
  return <FloatingChatPage projectId={initialProjectId ?? undefined} projectName={projects.find((project) => project.id === initialProjectId)?.name} conversationId={initialConversationId} rootId={params.rootId as string | undefined} messageId={params.messageId as string | undefined} messageSeq={params.messageSeq ? Number(params.messageSeq) : undefined} />;
}
