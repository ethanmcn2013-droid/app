"use client";

import { useServerInsertedHTML } from "next/navigation";
import { useRef } from "react";

/**
 * Keeps the first thing typed safe before the notebook has hydrated.
 *
 * Someone who lands on Notes and starts writing immediately is doing exactly
 * what the product asks of them, and until React is running there is nothing
 * to catch it. This inline script holds those keystrokes in one page-local
 * closure: never storage, never the URL, never a log, never the network. The
 * workspace claims them once on mount, and the listeners remove themselves.
 */
const EARLY_CAPTURE_BOOTSTRAP = String.raw`(() => {
  if (window.__signalNotesEarlyCaptureInstalled) return;
  window.__signalNotesEarlyCaptureInstalled = true;
  let value = "";
  let pendingSave = false;
  let actorScope = null;
  let workspaceId = null;
  const isCapture = (target) =>
    target instanceof HTMLTextAreaElement && target.hasAttribute("data-notes-hybrid-capture");
  const remember = (event) => {
    if (isCapture(event.target)) {
      value = event.target.value;
      const notebook = event.target.closest("[data-notes-workspace]");
      actorScope = notebook?.getAttribute("data-recovery-scope") ?? null;
      workspaceId = notebook?.getAttribute("data-recovery-project") || null;
    }
  };
  const queueSave = (event) => {
    if (!isCapture(event.target)) return;
    if (event.key !== "Enter" || !(event.metaKey || event.ctrlKey)) return;
    if (event.shiftKey || event.isComposing || event.keyCode === 229) return;
    if (!event.target.value.trim()) return;
    event.preventDefault();
    remember(event);
    pendingSave = true;
    event.target.setAttribute("data-early-save", "queued");
  };
  document.addEventListener("input", remember, true);
  document.addEventListener("keydown", queueSave, true);
  window.__signalNotesClaimEarlyCapture = () => {
    document.removeEventListener("input", remember, true);
    document.removeEventListener("keydown", queueSave, true);
    delete window.__signalNotesClaimEarlyCapture;
    return { value, pendingSave, actorScope, workspaceId };
  };
})();`;

export function EarlyCaptureBootstrap() {
  const inserted = useRef(false);

  useServerInsertedHTML(() => {
    if (inserted.current) return null;
    inserted.current = true;
    return (
      <script
        id="signal-notes-early-capture"
        data-reviewed-inline-script="true"
        dangerouslySetInnerHTML={{ __html: EARLY_CAPTURE_BOOTSTRAP }}
      />
    );
  });

  return null;
}
