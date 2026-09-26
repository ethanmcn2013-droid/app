/**
 * Builds the sidebar's Chat directory from the review/demo conversations.
 * Shared by the server shell (first paint) and the open Chat view (live).
 */
import type { ChatDirectory, ChatDirectoryEntry } from "./messages-unread";
import { conversationAttention, type DemoConversation } from "./demo-messages-model";

export const chatHref = (conversationId: string) => `/app/messages?c=${encodeURIComponent(conversationId)}`;
export const NEW_MESSAGE_HREF = "/app/messages?new=1";

export function demoChatDirectory(conversations: readonly DemoConversation[]): ChatDirectory {
  const entry = (item: DemoConversation): ChatDirectoryEntry => {
    const attention = conversationAttention(item);
    return {
      id: item.id,
      kind: item.kind === "dm" ? "dm" : item.kind === "task" ? "task" : "channel",
      title: item.title,
      href: chatHref(item.id),
      personId: item.otherId,
      count: attention.count,
      unread: attention.activity,
      request: attention.request || undefined,
    };
  };
  return {
    channels: [
      ...conversations.filter((item) => item.kind === "project"),
      ...conversations.filter((item) => item.kind === "task"),
    ].map(entry),
    direct: conversations.filter((item) => item.kind === "dm").map(entry),
    newMessageHref: NEW_MESSAGE_HREF,
  };
}
