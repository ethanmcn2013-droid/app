"use client";

import { useEffect, useRef } from "react";
import { getTasksAction } from "@/server/actions/tasks";
import type { Task } from "@/lib/data";

type Options = {
  /** Called with the freshly-fetched task list whenever a peer mutation
   *  arrives via SSE. The provider passes its `hydrate` dispatcher here. */
  onChange: (tasks: Task[]) => void;
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
export function useRealtimeSync({ onChange, clientId }: Options) {
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (typeof EventSource === "undefined") return;

    const url = `/api/events${clientId ? `?cid=${encodeURIComponent(clientId)}` : ""}`;
    const es = new EventSource(url);

    let inflight = false;
    let pendingWhileInflight = false;
    const fetchAndHydrate = async () => {
      // Coalesce bursts: a stream of 5 mutations in 30ms only refetches once.
      // But remember that an event arrived during the in-flight window so we
      // don't settle on pre-event state until some unrelated future event
      // happens to trigger another refetch (lost-update).
      if (inflight) {
        pendingWhileInflight = true;
        return;
      }
      inflight = true;
      try {
        const fresh = await getTasksAction();
        onChangeRef.current(fresh);
      } catch (e) {
        // eslint-disable-next-line no-console
        console.warn("realtime: refetch failed", e);
      } finally {
        // Tiny gap so a follow-up mutation 50ms later doesn't get
        // dropped, gives React a render tick to flush. If events were
        // coalesced away while we were in flight, run exactly once more.
        setTimeout(() => {
          inflight = false;
          if (pendingWhileInflight) {
            pendingWhileInflight = false;
            void fetchAndHydrate();
          }
        }, 100);
      }
    };

    const onTasksChanged = () => {
      void fetchAndHydrate();
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
        es.close();
      }
    };
    es.addEventListener("error", onError);

    return () => {
      es.removeEventListener("tasks-changed", onTasksChanged);
      es.removeEventListener("error", onError);
      es.close();
    };
  }, [clientId]);
}
