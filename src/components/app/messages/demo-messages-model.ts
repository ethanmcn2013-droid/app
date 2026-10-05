/**
 * The review/demo Messages state. Memory only: nothing here reaches a server,
 * a database or storage. A reload restores the seeded conversations.
 */
import type { ChatMessage, ChatPerson, ChatTaskStatus } from "./chat-view-model";

export type { ChatTaskStatus };
export type ChatConversationKind = "project" | "dm" | "task";

export type DemoConversation = Readonly<{
  id: string;
  kind: ChatConversationKind;
  title: string;
  memberIds: readonly string[];
  /** Direct messages: the other person. */
  otherId?: string;
  /** A private conversation someone asked to start; messages begin after acceptance. */
  request?: Readonly<{ requesterId: string }> | null;
  task?: Readonly<{ id: string; title: string; status: ChatTaskStatus; statusLabel: string; dueLabel: string | null; href: string }>;
  unread: number;
  mentions: number;
  about: string;
}>;

export type DemoMessage = ChatMessage & Readonly<{ conversationId: string }>;

export type DemoMessagesSnapshot = Readonly<{
  actorId: string;
  project: Readonly<{ id: string; name: string }>;
  clock: Readonly<{ nowMs: number; timeZone: string; locale: string }>;
  people: readonly ChatPerson[];
  conversations: readonly DemoConversation[];
  messages: readonly DemoMessage[];
}>;

export type DemoState = Readonly<{
  actorId: string;
  conversations: readonly DemoConversation[];
  messages: readonly DemoMessage[];
  /** The first message that was new when a conversation was opened. */
  newSince: Readonly<Record<string, string | null>>;
}>;

export type DemoAction =
  | Readonly<{ type: "open"; conversationId: string }>
  | Readonly<{ type: "send"; conversationId: string; rootId: string | null; id: string; body: string; createdAt: number }>
  | Readonly<{ type: "settle"; id: string }>
  | Readonly<{ type: "edit"; id: string; body: string; editedAt: number }>
  | Readonly<{ type: "remove"; id: string }>
  | Readonly<{ type: "accept"; conversationId: string }>
  | Readonly<{ type: "decline"; conversationId: string }>;

/** Reply counts are derived from the replies themselves, never hand-kept. */
function withThreadSummaries(messages: readonly DemoMessage[]): DemoMessage[] {
  const replies = new Map<string, DemoMessage[]>();
  for (const message of messages) {
    if (!message.rootId) continue;
    replies.set(message.rootId, [...(replies.get(message.rootId) ?? []), message]);
  }
  return messages.map((message) => {
    if (message.rootId) return message;
    const thread = replies.get(message.id) ?? [];
    if (!thread.length) return message.replyCount ? { ...message, replyCount: 0, replyAuthorIds: [], lastReplyAt: null } : message;
    return { ...message, replyCount: thread.length, replyAuthorIds: [...new Set(thread.map((reply) => reply.authorId).filter((id): id is string => !!id))], lastReplyAt: thread[thread.length - 1].createdAt };
  });
}

export function initDemoState(snapshot: DemoMessagesSnapshot): DemoState {
  return {
    actorId: snapshot.actorId,
    conversations: snapshot.conversations,
    messages: withThreadSummaries([...snapshot.messages].sort((a, b) => a.createdAt - b.createdAt)),
    newSince: {},
  };
}

/**
 * Slack-style attention. A direct message counts every unread message; a
 * Project conversation or task thread counts only mentions of you and
 * otherwise shows quiet activity. A private request asks for a decision.
 */
export type ConversationAttention = Readonly<{ count: number; activity: boolean; request: boolean }>;

export function conversationAttention(conversation: DemoConversation): ConversationAttention {
  if (conversation.request) return { count: 0, activity: true, request: true };
  if (conversation.kind === "dm") return { count: conversation.unread, activity: conversation.unread > 0, request: false };
  return { count: conversation.mentions, activity: conversation.unread > 0 || conversation.mentions > 0, request: false };
}

/** The sidebar badge: what is waiting for you, not all channel activity. */
export function unreadTotal(conversations: readonly DemoConversation[]): number {
  return conversations.reduce((sum, conversation) => {
    const attention = conversationAttention(conversation);
    return sum + attention.count + (attention.request ? 1 : 0);
  }, 0);
}

export function rootMessages(state: DemoState, conversationId: string): DemoMessage[] {
  return state.messages.filter((message) => message.conversationId === conversationId && !message.rootId);
}

export function threadReplies(state: DemoState, rootId: string): DemoMessage[] {
  return state.messages.filter((message) => message.rootId === rootId);
}

export function demoReducer(state: DemoState, action: DemoAction): DemoState {
  switch (action.type) {
    case "open": {
      const conversation = state.conversations.find((item) => item.id === action.conversationId);
      if (!conversation) return state;
      const roots = rootMessages(state, conversation.id);
      const firstNew = conversation.unread > 0 ? roots[Math.max(0, roots.length - conversation.unread)]?.id ?? null : state.newSince[conversation.id] ?? null;
      if (!conversation.unread && !conversation.mentions && state.newSince[conversation.id] === firstNew) return state;
      return {
        ...state,
        newSince: { ...state.newSince, [conversation.id]: firstNew },
        conversations: state.conversations.map((item) => item.id === conversation.id ? { ...item, unread: 0, mentions: 0 } : item),
      };
    }
    case "send": {
      const conversation = state.conversations.find((item) => item.id === action.conversationId);
      const body = action.body.replace(/\r\n?/g, "\n");
      if (!conversation || conversation.request || !body.trim()) return state;
      if (action.rootId && !state.messages.some((message) => message.id === action.rootId && message.body !== null)) return state;
      const message: DemoMessage = { id: action.id, conversationId: conversation.id, authorId: state.actorId, body, createdAt: action.createdAt, rootId: action.rootId, delivery: "sending" };
      return { ...state, messages: withThreadSummaries([...state.messages, message]) };
    }
    case "settle":
      return { ...state, messages: state.messages.map((message) => message.id === action.id ? { ...message, delivery: "sent" } : message) };
    case "edit": {
      const body = action.body.replace(/\r\n?/g, "\n");
      if (!body.trim()) return state;
      return { ...state, messages: state.messages.map((message) => message.id === action.id && message.authorId === state.actorId && message.body !== null ? { ...message, body, editedAt: action.editedAt } : message) };
    }
    case "remove":
      return { ...state, messages: state.messages.map((message) => message.id === action.id && message.authorId === state.actorId ? { ...message, body: null, linkedTask: null } : message) };
    case "accept":
      return { ...state, conversations: state.conversations.map((item) => item.id === action.conversationId ? { ...item, request: null, unread: 0, mentions: 0 } : item) };
    case "decline":
      return { ...state, conversations: state.conversations.filter((item) => item.id !== action.conversationId || !item.request) };
  }
}
