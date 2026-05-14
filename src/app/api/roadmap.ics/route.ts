import { getCurrentUserOrNull } from "@/server/auth";
import { exportRoadmapIcs } from "@/server/roadmap/ics-export";

// libSQL client + ics-export are node-only, and the feed updates whenever roadmap_items does.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * One-tap ICS feed of the GTM roadmap — every dated post-time, press
 * send, paid-spend launch, and live launch beat as a calendar event.
 *
 * Sensitive: the feed reveals launch dates and the full week-by-week
 * GTM cadence. Auth-gated through the proxy (this path is *not* in
 * the public allowlist) AND defended-in-depth here: an unauthed
 * request returns 404 (not 401) so the route's existence stays quiet
 * if the proxy ever misroutes.
 */
export async function GET(): Promise<Response> {
  const me = await getCurrentUserOrNull();
  if (!me) {
    return new Response("Not found", { status: 404 });
  }

  const body = await exportRoadmapIcs();

  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'attachment; filename="tasks-gtm.ics"',
      // Calendar clients refresh on their own cadence; keep the route
      // dynamic but discourage intermediary caches from holding stale
      // copies across roadmap edits.
      "Cache-Control": "private, no-store",
    },
  });
}
