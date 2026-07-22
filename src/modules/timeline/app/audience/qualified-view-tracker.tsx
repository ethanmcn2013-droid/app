"use client";

import { useEffect } from "react";

const MIN_VISIBLE_MS = 2_000;
const SESSION_KEY_PREFIX = "signal-timeline-qualified-view:v1:";

export type QualifiedViewTrackerMode = "shared" | "owner-preview";

function viewEndpoint(pathname: string): string | null {
  const segments = pathname.split("/").filter(Boolean);
  if (segments.length < 2 || segments[0] !== "s" || !segments[1]) return null;
  return `/s/${segments[1]}/view`;
}

function browserSessionId(publicationId: string): string | null {
  try {
    const key = `${SESSION_KEY_PREFIX}${publicationId}`;
    const existing = window.sessionStorage.getItem(key);
    if (existing) return existing;
    const created = window.crypto.randomUUID();
    window.sessionStorage.setItem(key, created);
    return created;
  } catch {
    // A blocked storage boundary must never turn each reload into a new view.
    return null;
  }
}

/**
 * Counts one browser session only after two seconds of actual page visibility.
 * Owner phone previews must pass mode="owner-preview" and never send a receipt.
 */
export function QualifiedViewTracker({
  publicationId,
  mode,
}: {
  publicationId: string;
  mode: QualifiedViewTrackerMode;
}) {
  useEffect(() => {
    if (mode !== "shared") return;
    const endpoint = viewEndpoint(window.location.pathname);
    const sessionId = browserSessionId(publicationId);
    if (!endpoint || !sessionId) return;

    let remainingMs = MIN_VISIBLE_MS;
    let visibleSince: number | null = null;
    let timer: number | null = null;
    let sent = false;

    const stopTimer = (reset = false) => {
      if (timer !== null) {
        window.clearTimeout(timer);
        timer = null;
      }
      if (visibleSince !== null) {
        if (!reset) {
          remainingMs = Math.max(0, remainingMs - (performance.now() - visibleSince));
        }
        visibleSince = null;
      }
      if (reset) remainingMs = MIN_VISIBLE_MS;
    };

    const send = () => {
      if (sent || document.visibilityState !== "visible") return;
      stopTimer();
      if (remainingMs > 0) {
        startTimer();
        return;
      }
      sent = true;
      void fetch(endpoint, {
        method: "POST",
        cache: "no-store",
        credentials: "same-origin",
        keepalive: true,
        referrerPolicy: "no-referrer",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          sessionId,
          visibleForMs: MIN_VISIBLE_MS,
        }),
      }).catch(() => {
        // Analytics is best-effort and must never disturb the shared artefact.
      });
    };

    function startTimer() {
      if (sent || timer !== null || document.visibilityState !== "visible") return;
      visibleSince = performance.now();
      timer = window.setTimeout(send, remainingMs);
    }

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") startTimer();
      else stopTimer(true);
    };

    document.addEventListener("visibilitychange", onVisibilityChange);
    startTimer();
    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      stopTimer();
    };
  }, [mode, publicationId]);

  return null;
}
