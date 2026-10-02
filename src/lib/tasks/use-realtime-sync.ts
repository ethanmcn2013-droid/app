"use client";

import { useEffect, useRef } from "react";
import { isDemoMode } from "@/lib/access-mode";

type Options = {
  /** Server-proved runtime identity. The action reauthorizes the Project. */
  projectId: string;
  actorId: string;
  /** Provider schedules a scope/epoch-fenced read; this hook never hydrates. */
  onDirty: () => void;
  /** Stable per-tab id so the SSE stream can suppress this tab's own
   *  echo. If omitted, every event triggers a refetch, strictly
   *  correct, but the originator pays an extra round-trip. */
  clientId?: string;
};

/**
 * Subscribe to /api/events. Receives `tasks-changed` SSE messages
 * from peer tabs and refreshes the local tasks store.
 *
 * Reconnect strategy: EventSource auto-reconnects on transport errors
 * (browser-native). On `error` we just log; the next heartbeat cycle
 * (or visibility change) re-establishes the stream.
 */
export function useRealtimeSync({ projectId, actorId, onDirty, clientId }: Options) {
  const onDirtyRef = useRef(onDirty);
  useEffect(() => {
    onDirtyRef.current = onDirty;
  }, [onDirty]);

  useEffect(() => {
    if (isDemoMode()) return;
    if (typeof window === "undefined") return;
    if (typeof EventSource === "undefined") return;

    const url = `/api/events${clientId ? `?cid=${encodeURIComponent(clientId)}` : ""}`;
    const es = new EventSource(url);

    let disposed = false;
    const onTasksChanged = () => {
      if (disposed) return;
      // The Provider coalesces while a read is in flight and remembers an
      // intervening event for a follow-up scoped read.
      onDirtyRef.current();
    };
    es.addEventListener("tasks-changed", onTasksChanged);

    // Hello + heartbeat are silent; presence-only signals.
    const onError = () => {
      // Transient transport errors (dev-server restart, brief network drop)
      // leave readyState at CONNECTING, let EventSource auto-retry, which
      // is the documented reconnect strategy. But when realtime is disabled
      // in production the endpoint answers 204, the browser fails the
      // connection (readyState CLOSED), and some browsers then reconnect on
      // a fixed interval forever, every /app tab hammering /api/events for
      // a stream that will never exist. A CLOSED stream is permanent: close
      // it explicitly so no further reconnect is attempted.
      if (es.readyState === EventSource.CLOSED) {
        dispose();
      }
    };
    es.addEventListener("error", onError);

    function dispose() {
      disposed = true;
      es.removeEventListener("tasks-changed", onTasksChanged);
      es.removeEventListener("error", onError);
      es.close();
    }
    return dispose;
  }, [projectId, actorId, clientId]);
}
