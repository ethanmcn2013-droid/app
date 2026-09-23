/** Server-checked choices, never a client roster or a Google permission claim. */
export type DriveHandoverChoice = Readonly<{ userId: string; name: string }>;
export type DriveHandoverRead = Readonly<{
  state: "ready" | "in_progress" | "needs_attention" | "uploads_pending" | "not_connected" | "archived" | "unavailable";
  choices: readonly DriveHandoverChoice[];
  continuation: DriveHandoverChoice | null;
}>;
export type DriveHandoverReadResult =
  | { kind: "ready"; handover: DriveHandoverRead }
  | { kind: "unavailable" | "review" | "disabled" };
export type DriveHandoverOutcome = "active" | "already_owner" | "setting_up" | "needs_attention" | "target_not_connected" | "upload_in_progress" | "archived" | "unavailable" | "demo" | "disabled";

export const driveHandoverOutcomeCopy: Record<DriveHandoverOutcome, string> = {
  active: "Storage owner changed. Check Google access below before attaching files.",
  already_owner: "That person is already the storage owner. Check the current connection below.",
  setting_up: "The change is still being set up. Check its saved status before trying again.",
  needs_attention: "The change needs attention. Check the saved status; starting another change will not resolve it.",
  target_not_connected: "That owner’s Drive connection is not ready. Ask them to reconnect, then check again.",
  upload_in_progress: "An earlier Drive upload is still unconfirmed. Resolve that upload before changing the storage owner.",
  archived: "This board is archived. Storage changes are unavailable.",
  unavailable: "The change could not be confirmed. Check the saved status before trying again.",
  demo: "Review only. No storage owner was changed.",
  disabled: "Drive changes are not enabled here.",
};
