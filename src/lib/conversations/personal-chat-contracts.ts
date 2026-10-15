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
}>;

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
