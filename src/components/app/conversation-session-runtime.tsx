import type { ReactNode } from "react";
import { auth } from "@clerk/nextjs/server";
import { resolveConversationControls } from "@/lib/conversations/flags";
import { authenticateConversationActor } from "@/server/conversations/runtime";
import { AuthenticatedConversationSession } from "./messages/conversation-session-provider";

export async function ConversationSessionRuntime({ children }: { children: ReactNode }) {
  if (!resolveConversationControls(process.env).internalEnabled) return children;
  const actorId = await authenticateConversationActor();
  if (!actorId) return children;
  const { userId } = await auth();
  if (!userId) return children;
  return <AuthenticatedConversationSession actorId={actorId} clerkId={userId}>{children}</AuthenticatedConversationSession>;
}
