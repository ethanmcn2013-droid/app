"use client";

import { useServerInsertedHTML } from "next/navigation";
import { useRef } from "react";

/**
 * Keeps first input safe before the HybridNotebook client bundle hydrates.
 * The draft remains in one page-local closure: never storage, URL, logs, or
 * network. HybridNotebook claims it once, then this listener removes itself.
 */
const EARLY_CAPTURE_BOOTSTRAP = String.raw`(() => {
  if (window.__signalNotesEarlyCaptureInstalled) return;
  window.__signalNotesEarlyCaptureInstalled = true;
  let value = "";
  let pendingSave = false;
  const isCapture = (target) =>
    target instanceof HTMLTextAreaElement && target.hasAttribute("data-notes-hybrid-capture");
  const remember = (event) => {
    if (isCapture(event.target)) value = event.target.value;
  };
  const queueSave = (event) => {
    if (!isCapture(event.target)) return;
    if (event.key !== "Enter" || event.shiftKey || event.isComposing || event.keyCode === 229) return;
    if (!event.target.value.trim()) return;
    event.preventDefault();
    value = event.target.value;
    pendingSave = true;
    event.target.setAttribute("data-early-save", "queued");
  };
  document.addEventListener("input", remember, true);
  document.addEventListener("keydown", queueSave, true);
  window.__signalNotesClaimEarlyCapture = () => {
    document.removeEventListener("input", remember, true);
    document.removeEventListener("keydown", queueSave, true);
    delete window.__signalNotesClaimEarlyCapture;
    return { value, pendingSave };
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
