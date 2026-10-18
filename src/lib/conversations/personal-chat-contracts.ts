export const PERSONAL_CHAT_LIMITS = Object.freeze({
  bodyCharacters: 8_000,
  bodyBytes: 32_768,
  requestBytes: 48_000,
  pageDefault: 50,
  pageMaximum: 100,
  sendsPerMinute: 60,
  sendWindowMilliseconds: 60_000,
  exportMessagesMaximum: 10_000,
  exportBytesMaximum: 8 * 1024 * 1024,
});

export type PersonalChatMessage = Readonly<{
  id: string;
  body: string;
  createdAt: number;
  editedAt: number | null;
  attachments?: readonly PersonalChatAttachment[];
}>;

export type PersonalChatAttachment = Readonly<{
  id: string; filename: string; mimeType: string; sizeBytes: number; href: string;
}>;

export const PERSONAL_CHAT_ATTACHMENT_LIMITS = Object.freeze({
  fileBytes: 2 * 1024 * 1024,
  multipartBytes: 2 * 1024 * 1024 + 32 * 1024,
  filesPerMessage: 3,
  ownerBytes: 50 * 1024 * 1024,
  uploadsPerMinute: 10,
  draftMilliseconds: 24 * 60 * 60_000,
  writerMilliseconds: 60_000,
});

export function validPersonalChatAttachmentIds(value: unknown): value is readonly string[] {
  return Array.isArray(value) && value.length <= PERSONAL_CHAT_ATTACHMENT_LIMITS.filesPerMessage &&
    value.every(id => typeof id === "string" && /^pca_[a-f0-9]{32}$/.test(id)) && new Set(value).size === value.length;
}

export function validPersonalChatSend(body: unknown, attachmentIds: unknown = []): body is string {
  return validPersonalChatAttachmentIds(attachmentIds) && typeof body === "string" &&
    (body.trim().length > 0 ? validPersonalChatBody(body) : attachmentIds.length > 0 && body.length <= PERSONAL_CHAT_LIMITS.bodyCharacters);
}

export type PersonalChatPage = Readonly<{
  messages: readonly PersonalChatMessage[];
  nextCursor: string | null;
}>;

export function normalizePersonalChatBody(body: string): string {
  return body.replace(/\r\n?/g, "\n");
}

export function validPersonalChatBody(body: unknown): body is string {
  return typeof body === "string" && body.trim().length > 0 &&
    Array.from(body).length <= PERSONAL_CHAT_LIMITS.bodyCharacters &&
    new TextEncoder().encode(body).byteLength <= PERSONAL_CHAT_LIMITS.bodyBytes &&
    !body.includes("\u0000");
}

export function validPersonalChatRequestId(value: unknown): value is string {
  return typeof value === "string" && /^[A-Za-z0-9][A-Za-z0-9_-]{7,127}$/.test(value);
}
