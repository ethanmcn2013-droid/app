"use server";

import { canShowMessagesForTools } from "./messages-gate";

/**
 * Whether the Apps launcher may list Messages for this viewer.
 *
 * The same fail-closed rule the tools pages use: demo and review answer true
 * without reading the conversation service; otherwise the viewer is
 * authenticated and the internal switch and read availability both pass.
 * Returns a boolean only, never who the viewer is.
 */
export async function launcherMessagesEnabled(): Promise<boolean> {
  try {
    return await canShowMessagesForTools();
  } catch {
    return false;
  }
}
