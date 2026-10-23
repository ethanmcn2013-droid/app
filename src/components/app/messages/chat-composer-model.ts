import { normalizeMessageBody, validMessageBody } from "@/lib/conversations/contracts";

export function appendDictatedText(draft: string, text: string): string | null {
  const addition = normalizeMessageBody(text).trim();
  if (!addition) return draft;
  const next = `${draft}${draft && !/\s$/.test(draft) ? " " : ""}${addition}`;
  return validMessageBody(next) ? next : null;
}

/** Ping validates text as UTF-16 length; keep its warning aligned with that limit. */
export function assistantDraftNearLimit(value: string, limit: number): boolean {
  return value.length >= limit - 1_000;
}
