import { normalizeMessageBody, validMessageBody } from "@/lib/conversations/contracts";

export function appendDictatedText(draft: string, text: string): string | null {
  const addition = normalizeMessageBody(text).trim();
  if (!addition) return draft;
  const next = `${draft}${draft && !/\s$/.test(draft) ? " " : ""}${addition}`;
  return validMessageBody(next) ? next : null;
}
