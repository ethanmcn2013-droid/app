import { cache } from "react";
import { StudioRail } from "@/components/studio-bar/studio-rail";
import { MobileSuiteNav } from "./mobile-suite-nav";
import { conversationAvailability, resolveConversationControls } from "@/lib/conversations/flags";
import { authenticateConversationActor } from "@/server/conversations/runtime";

const canShowMessages = cache(async () => {
  const controls = resolveConversationControls(process.env);
  if (!controls.internalEnabled) return false;
  try {
    const actorId = await authenticateConversationActor();
    return !!actorId && conversationAvailability(controls, actorId).read;
  } catch { return false; }
});

export async function ConversationStudioRail() {
  return <StudioRail messagesEnabled={await canShowMessages()} />;
}
export async function ConversationMobileNav() {
  return <MobileSuiteNav messagesEnabled={await canShowMessages()} />;
}
