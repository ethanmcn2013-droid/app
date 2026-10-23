/** Transport descriptors never grant download permission. */
export type ConversationAttachment = Readonly<{ id: string; filename: string; mimeType: string; sizeBytes: number; href: string }>;
export const CONVERSATION_ATTACHMENT_LIMITS = Object.freeze({ fileBytes: 2 * 1024 * 1024, perMessage: 3, multipartBytes: 2 * 1024 * 1024 + 16_384, ownerBytes: 100 * 1024 * 1024, uploadsPerMinute: 10, draftMilliseconds: 24 * 60 * 60 * 1000, writerMilliseconds: 60_000 });
export function validConversationAttachmentIds(value: unknown): value is readonly string[] {
  return Array.isArray(value) && value.length <= CONVERSATION_ATTACHMENT_LIMITS.perMessage &&
    value.every(id => typeof id === "string" && /^ca_[a-f0-9]{32}$/.test(id)) && new Set(value).size === value.length;
}
