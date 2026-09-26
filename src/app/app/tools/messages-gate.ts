import { cache } from "react";
import { isDemoMode } from "@/lib/access-mode";
import { conversationAvailability, resolveConversationControls } from "@/lib/conversations/flags";
import { authenticateConversationActor } from "@/server/conversations/runtime";

/**
 * Whether this viewer can use Messages, decided on the server.
 *
 * The same rule the sidebar's ConversationShellSidebar applies
 * (src/components/app/conversation-navigation-runtime.tsx): demo and review
 * serve seeded Messages and never read the conversation service; otherwise
 * the internal switch and the viewer's read availability both have to pass.
 * Fails closed, so a hidden Messages is never a dead end.
 */
export const canShowMessagesForTools = cache(async (): Promise<boolean> => {
  if (isDemoMode()) return true;
  const controls = resolveConversationControls(process.env);
  if (!controls.internalEnabled) return false;
  try {
    const actorId = await authenticateConversationActor();
    return !!actorId && conversationAvailability(controls, actorId).read;
  } catch {
    return false;
  }
});
