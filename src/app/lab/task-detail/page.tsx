/**
 * /lab/task-detail — Phase 3 Hybrid C task-detail exploration.
 *
 * Review-only: no auth, no production mutation, no server actions.
 * robots noindex to keep search engines away.
 *
 * Three shells over ONE TaskDetail composition:
 *   a. BOARD + PANEL  — board visible, resizable side panel overlays
 *   b. FOCUS MODE     — full-page centred layout, board hidden
 *   c. MOBILE SIM     — narrow-width simulation via lab chrome chip
 *
 * Keyboard:
 *   j/k    — adjacent task navigation
 *   e      — toggle focus mode
 *   Esc    — close panel (panel/mobile shells)
 *
 * See src/components/lab/task-detail/README.md for full documentation.
 */

import type { Metadata } from "next";
import { LabPage } from "./lab-page";

export const metadata: Metadata = {
  title: "Task detail · lab",
  description: "Phase 3 design exploration — review only, not for production.",
  robots: { index: false, follow: false },
};

export default function TaskDetailLabRoute() {
  return <LabPage />;
}
