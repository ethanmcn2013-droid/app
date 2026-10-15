import type { ReactNode } from "react";
import { auth } from "@clerk/nextjs/server";
import { resolveConversationControls } from "@/lib/conversations/flags";
import { authenticateConversationActor, getConversationService } from "@/server/conversations/runtime";
import { AuthenticatedConversationSession, ConversationSessionProvider } from "./messages/conversation-session-provider";
import { FloatingChatRoot, AuthenticatedFloatingChatRoot } from "./messages/floating-chat-root";
import { isDemoMode } from "@/lib/access-mode";
import { demoMessagesSnapshot } from "@/server/demo/messages-demo";
import { parseProjectId } from "@/lib/projects/project-ref";

export async function ConversationSessionRuntime({ children }: { children: ReactNode }) {
  if (isDemoMode()) {
    const snapshot = demoMessagesSnapshot();
    return <ConversationSessionProvider actorId={snapshot.actorId}><FloatingChatRoot actorId={snapshot.actorId} actorName={snapshot.people.find((person) => person.id === snapshot.actorId)?.name ?? "You"} demoSnapshot={snapshot} projects={[]}>{children}</FloatingChatRoot></ConversationSessionProvider>;
  }
  const controls = resolveConversationControls(process.env);
  if (!controls.internalEnabled) return children;
  const bootstrap = await (async () => { try {
    const actorId = await authenticateConversationActor();
    if (!actorId) return null;
    const { userId } = await auth();
    if (!userId) return null;
    const catalog = await (await getConversationService()).listProjects({ actorId });
    const projects = catalog.ok ? catalog.value.filter((project) => !!parseProjectId(project.id)) : [];
    return { actorId, userId, projects, catalogUnavailable: !catalog.ok };
  } catch {
    // An optional chat bootstrap must never blank Home, Notes or Tasks.
    return null;
  } })();
  if (!bootstrap) return children;
  return <AuthenticatedConversationSession actorId={bootstrap.actorId} clerkId={bootstrap.userId}><AuthenticatedFloatingChatRoot actorId={bootstrap.actorId} actorName="You" projects={bootstrap.projects} catalogUnavailable={bootstrap.catalogUnavailable} directMessagesEnabled={controls.directMessagesEnabled}>{children}</AuthenticatedFloatingChatRoot></AuthenticatedConversationSession>;
}
