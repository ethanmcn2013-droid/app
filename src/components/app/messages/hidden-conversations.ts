export const hiddenConversationKey = (actorId: string) => `signal:chat:hidden:${encodeURIComponent(actorId)}`;

/** Browser preference only. No message content is written to browser storage. */
export function readHiddenConversations(storage: Pick<Storage, "getItem">, actorId: string): string[] {
  try {
    const value: unknown = JSON.parse(storage.getItem(hiddenConversationKey(actorId)) ?? "[]");
    return Array.isArray(value) ? [...new Set(value.filter((id): id is string => typeof id === "string" && id.length <= 256))].slice(0, 500) : [];
  } catch { return []; }
}
