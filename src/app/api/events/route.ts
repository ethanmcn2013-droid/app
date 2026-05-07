import { tasksEvents, type TasksChangedPayload } from "@/server/events";

export const dynamic = "force-dynamic";
// Node runtime — better-sqlite3 + EventEmitter aren't edge-friendly,
// and we already lean on Node modules elsewhere in /api.
export const runtime = "nodejs";

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
