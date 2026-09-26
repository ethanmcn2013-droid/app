import { cache } from "react";
import { StudioRail } from "@/components/studio-bar/studio-rail";
import { MobileSuiteNav } from "./mobile-suite-nav";
import { AppSidebar } from "@/components/shell/app-sidebar";
import { isDemoMode } from "@/lib/access-mode";
import { conversationAvailability, resolveConversationControls } from "@/lib/conversations/flags";
import { unreadTotal } from "@/components/app/messages/demo-messages-model";
import { demoChatDirectory } from "@/components/app/messages/chat-directory";
import type { ChatDirectory } from "@/components/app/messages/messages-unread";
import { loadInboxAttention } from "@/server/conversations/attention-loader";
import { authenticateConversationActor, getConversationService, getMessageAttentionService } from "@/server/conversations/runtime";
import { demoMessagesSnapshot } from "@/server/demo/messages-demo";

const canShowMessages = cache(async () => {
  // Demo/review serve seeded, in-memory Messages and never read the
  // conversation service. isDemoMode() is false on every production
  // deployment, so the gate below is unchanged there.
  if (isDemoMode()) return true;
  const controls = resolveConversationControls(process.env);
  if (!controls.internalEnabled) return false;
  try {
    const actorId = await authenticateConversationActor();
    return !!actorId && conversationAvailability(controls, actorId).read;
  } catch { return false; }
});

/**
 * The sidebar's Messages badge: what is waiting for this reader. Demo/review
 * counts the seeded conversations in memory. Otherwise it is read only after
 * canShowMessages() passes, from the same authorized directed-attention read
 * the Inbox uses, and fails quiet to no badge.
 */
const messagesUnread = cache(async (): Promise<number> => {
  if (isDemoMode()) return unreadTotal(demoMessagesSnapshot().conversations);
  if (!(await canShowMessages())) return 0;
  const { attention } = await loadInboxAttention({ authenticate: authenticateConversationActor, service: getMessageAttentionService });
  return attention?.filter((item) => item.kind === "conversation" && item.seenAt === null).length ?? 0;
});

export async function ConversationStudioRail() {
  return <StudioRail messagesEnabled={await canShowMessages()} />;
}
export async function ConversationMobileNav() {
  return <MobileSuiteNav messagesEnabled={await canShowMessages()} />;
}

/**
 * The sidebar's Chat directory. Demo/review lists the seeded conversations.
 * Otherwise, once canShowMessages() passes, the reader's Project channels
 * from the same authorized catalog Chat itself reads; it fails quiet to none.
 */
const chatDirectory = cache(async (): Promise<ChatDirectory | null> => {
  if (isDemoMode()) return demoChatDirectory(demoMessagesSnapshot().conversations);
  if (!(await canShowMessages())) return null;
  try {
    const actorId = await authenticateConversationActor();
    if (!actorId) return null;
    const catalog = await (await getConversationService()).listProjects({ actorId });
    if (!catalog.ok) return null;
    const controls = resolveConversationControls(process.env);
    return {
      channels: catalog.value.map((project) => ({ id: project.id, kind: "channel", title: project.name, href: `/app/messages?projectId=${encodeURIComponent(project.id)}`, count: 0, unread: false })),
      direct: [],
      newMessageHref: controls.directMessagesEnabled ? "/app/messages" : null,
    };
  } catch { return null; }
});

/** v3 shell sidebar: Chat appears only for viewers who can read it. */
export async function ConversationShellSidebar() {
  const [messagesEnabled, unread, directory] = await Promise.all([canShowMessages(), messagesUnread(), chatDirectory()]);
  return <AppSidebar messagesEnabled={messagesEnabled} messagesUnread={messagesEnabled ? unread : 0} chatDirectory={messagesEnabled ? directory : null} />;
}
