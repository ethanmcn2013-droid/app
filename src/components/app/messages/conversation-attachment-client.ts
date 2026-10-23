import { CONVERSATION_ATTACHMENT_LIMITS, type ConversationAttachment } from "@/lib/conversations/attachment-contracts";
import { PERSONAL_FILE_ACCEPT, personalFileSize } from "./personal-attachment-client";
export { PERSONAL_FILE_ACCEPT as CONVERSATION_FILE_ACCEPT, personalFileSize as conversationFileSize };
export function conversationFileProblem(file: Pick<File, "name" | "size">): string | null {
  if (!file.size) return "Choose a file that is not empty.";
  if (file.size > CONVERSATION_ATTACHMENT_LIMITS.fileBytes) return "Choose a file of 2 MiB or smaller.";
  if (!/\.(jpe?g|png|webp|pdf|txt|md|markdown)$/i.test(file.name)) return "Use a JPEG, PNG, WebP, PDF, text or Markdown file.";
  return null;
}
export type ConversationFileScope = Readonly<{ kind: "project" | "dm"; projectId: string; conversationId: string; rootId: string | null; expectedAudienceEpoch: number }>;

const explanations: Record<string, string> = {
  audience_changed: "The audience changed. Review who can see this conversation, then upload this file again.",
  unsupported_file: "Choose a JPEG, PNG, WebP, PDF, text or Markdown file.",
  upload_too_large: "Choose a file of 2 MiB or smaller.",
  quota_exceeded: "File storage is full. Remove files you no longer need before uploading more.",
  rate_limited: "Several files were uploaded recently. Wait a minute, then retry.",
  request_conflict: "This upload no longer matches the original file. Remove it and choose it again.",
  upload_in_progress: "This upload could not be confirmed yet. Retry to check the same file safely.",
};
export async function conversationFilesAvailable(scope: ConversationFileScope, signal: AbortSignal, fixtureActor?: string): Promise<boolean> {
  const query = new URLSearchParams({ projectId: scope.projectId, conversationId: scope.conversationId, rootId: scope.rootId ?? "", expectedAudienceEpoch: String(scope.expectedAudienceEpoch) });
  const response = await fetch(`/api/conversations/attachments?${query}`, { signal, credentials: "same-origin", cache: "no-store", ...(fixtureActor ? { headers: { "x-fixture-actor": fixtureActor } } : {}) });
  const result = await response.json().catch(() => null) as { available?: boolean } | null;
  return response.ok && result?.available === true;
}
export async function uploadConversationFile(file: File, requestId: string, scope: ConversationFileScope, fixtureActor?: string): Promise<ConversationAttachment> {
  const form = new FormData(); form.append("file", file); form.append("clientRequestId", requestId);
  form.append("projectId", scope.projectId); form.append("conversationId", scope.conversationId);
  form.append("rootId", scope.rootId ?? ""); form.append("expectedAudienceEpoch", String(scope.expectedAudienceEpoch));
  const response = await fetch("/api/conversations/attachments", { method: "POST", credentials: "same-origin", cache: "no-store", body: form, ...(fixtureActor ? { headers: { "x-fixture-actor": fixtureActor } } : {}) });
  const result = await response.json().catch(() => null) as { attachment?: ConversationAttachment; error?: string } | null;
  if (!response.ok || !result?.attachment) throw new Error(explanations[result?.error ?? ""] ?? "The upload could not be confirmed. Your draft is kept. Retry the same file to check safely.");
  return result.attachment;
}
export async function discardConversationFile(id: string, fixtureActor?: string): Promise<void> {
  const response = await fetch(`/api/conversations/attachments?id=${encodeURIComponent(id)}`, { method: "DELETE", credentials: "same-origin", cache: "no-store", ...(fixtureActor ? { headers: { "x-fixture-actor": fixtureActor } } : {}) });
  if (!response.ok) throw new Error("The file left your draft, but cleanup could not be confirmed. Unsent files expire automatically.");
}
