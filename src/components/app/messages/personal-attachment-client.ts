import type { PersonalChatAttachment } from "@/lib/conversations/personal-chat-contracts";

export const PERSONAL_FILE_MAXIMUM = 2 * 1024 * 1024;
export const PERSONAL_FILES_PER_MESSAGE = 3;
export const PERSONAL_FILE_ACCEPT = ".jpg,.jpeg,.png,.webp,.pdf,.txt,.md,.markdown";

export function personalFileProblem(file: Pick<File, "name" | "size">): string | null {
  if (!file.size) return "Choose a file that is not empty.";
  if (file.size > PERSONAL_FILE_MAXIMUM) return "Choose a file of 2 MiB or smaller.";
  if (!/\.(jpe?g|png|webp|pdf|txt|md|markdown)$/i.test(file.name)) return "Use a JPEG, PNG, WebP, PDF, text or Markdown file.";
  return null;
}

export function personalFileSize(bytes: number): string {
  return bytes < 1024 ? `${bytes} B` : bytes < 1024 * 1024 ? `${Math.ceil(bytes / 1024)} KiB` : `${(bytes / (1024 * 1024)).toFixed(1)} MiB`;
}

const explanations: Record<string, string> = {
  unauthenticated: "Your session ended. Sign in again to upload this file.",
  unsupported_file: "This file type could not be verified. Choose a supported image, PDF or text file.",
  upload_too_large: "Choose a file of 2 MiB or smaller.",
  quota_exceeded: "Your private file storage is full. Remove files you no longer need before uploading more.",
  rate_limited: "Several files were uploaded recently. Wait a minute, then retry.",
  request_conflict: "This upload no longer matches its original file. Remove it and choose it again.",
  upload_in_progress: "This file is still being checked. Wait a moment, then retry.",
  unavailable: "File uploads are unavailable right now. Your message draft is kept.",
  storage_unavailable: "File storage is unavailable right now. Your message draft is kept.",
};

export async function uploadPersonalFile(file: File, requestId: string): Promise<PersonalChatAttachment> {
  const form = new FormData();
  form.append("file", file);
  form.append("clientRequestId", requestId);
  const response = await fetch("/api/personal-chat/attachments", { method: "POST", credentials: "same-origin", cache: "no-store", body: form });
  const result = await response.json().catch(() => null) as { attachment?: PersonalChatAttachment; error?: string } | null;
  if (!response.ok || !result?.attachment) throw new Error(explanations[result?.error ?? ""] ?? "The upload could not be confirmed. Retry the same file to check it safely.");
  return result.attachment;
}

export async function discardPersonalFile(id: string): Promise<void> {
  const response = await fetch(`/api/personal-chat/attachments?id=${encodeURIComponent(id)}`, { method: "DELETE", credentials: "same-origin", cache: "no-store" });
  if (!response.ok) throw new Error("The file was removed from your draft, but cleanup could not be confirmed. Unsent files expire automatically.");
}
