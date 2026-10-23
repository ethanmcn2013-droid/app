import type { AssistantActionResult } from "./contract";

/** Only exact canonical Drive folder receipts may expose this external link. */
export function isAssistantDriveFolderHref(value: unknown): value is string {
  return typeof value === "string" && /^https:\/\/drive\.google\.com\/drive\/folders\/[a-zA-Z0-9_-]{1,256}$/.test(value);
}
export const isAssistantDriveFolderPending = (result: AssistantActionResult | null | undefined) =>
  result?.kind === "create_drive_subfolder" && result.code === "drive_folder_pending";
