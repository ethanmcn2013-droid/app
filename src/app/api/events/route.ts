import { tasksEvents, type TasksChangedPayload } from "@/server/events";

export const dynamic = "force-dynamic";
// Node runtime, EventEmitter isn't edge-friendly, and we already
// lean on Node modules elsewhere in /api.
export const runtime = "nodejs";

/**
 * Realtime feature flag. The in-process EventEmitter only fans out to
 * subscribers in the SAME Node process, on Vercel that means one
 * lambda instance, so a mutation in lambda A is invisible to a
 * subscriber in lambda B. Until a real substrate lands (Upstash
 * pub/sub, Pusher, Liveblocks), the SSE stream stays off in
 * production so we don't ship a realtime UX that silently no-ops.
 *
 * Set `REALTIME_ENABLED=true` in env to opt back in once the
 * substrate is wired. Dev defaults to enabled so localhost testing
 * keeps working.
 */
function realtimeEnabled(): boolean {
  if (process.env.REALTIME_ENABLED === "true") return true;
  if (process.env.REALTIME_ENABLED === "false") return false;
  return process.env.NODE_ENV !== "production";
}

/**
 * Server-Sent Events stream. Clients open one connection per tab
 * via `new EventSource("/api/events")` and receive:
 *
 *   - `event: hello`        on connect, useful for handshake
 *   - `event: tasks-changed` whenever any mutation server action emits
 *   - `event: heartbeat`     every 25s so proxies don't kill the conn
 *
 * Each tab passes a `?cid=<id>` query string. We echo it through the
 * payload so a tab can ignore the change-event it caused itself —
 * preventing pointless re-fetches and self-echo loops.
 */
export async function GET(req: Request) {
  if (!realtimeEnabled()) {
    // Disabled: respond with a 204 so the client EventSource sees an
    // immediate, intentional close instead of retrying against a
    // misleading 200 stream that never fires events.
    return new Response(null, {
      status: 204,
      headers: { "X-Realtime-Disabled": "single-process-substrate" },
    });
  }
  const url = new URL(req.url);
  const cid = url.searchParams.get("cid") ?? "";
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      let closed = false;

      const send = (event: string, data: unknown) => {
        if (closed) return;
        try {
          controller.enqueue(
            encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`),
          );
        } catch {
          // Stream already closed; downstream cleanup will handle it.
        }
      };

      send("hello", { ts: Date.now(), cid });

      const onChange = (payload: TasksChangedPayload) => {
        // Skip the originating client's own echo.
        if (cid && payload.clientId && cid === payload.clientId) return;
        send("tasks-changed", payload);
      };

      tasksEvents.on("tasks-changed", onChange);

      const heartbeat = setInterval(() => {
        send("heartbeat", { ts: Date.now() });
      }, 25_000);

      const cleanup = () => {
        if (closed) return;
        closed = true;
        clearInterval(heartbeat);
        tasksEvents.off("tasks-changed", onChange);
        try {
          controller.close();
        } catch {
          // already closed
        }
      };

      req.signal.addEventListener("abort", cleanup);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      // Prevent Vercel/CDN buffering of the long-lived stream.
      "X-Accel-Buffering": "no",
    },
  });
}
