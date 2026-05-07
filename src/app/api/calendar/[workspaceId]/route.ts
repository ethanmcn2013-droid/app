import { eq } from "drizzle-orm";
import { db } from "@/server/db";
import { workspaces } from "@/server/db/schema";
import { getTasks } from "@/server/db/queries";
import { LANES } from "@/lib/data";
import { buildIcsCalendar, type ICalEvent } from "@/lib/ical";

// better-sqlite3 needs Node — and the route is dynamic per workspace.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Read-only ICS feed for a workspace.
 *
 * Public per workspace id by design, mirroring the `/p/{slug}` model:
 * the owner shares the URL knowing it's public; calendar clients
 * (Apple Calendar, Google Calendar, Outlook) hit it without OAuth
 * and refresh on their own cadence (typically every 15-60 minutes).
 *
 * Future hardening: swap the `[workspaceId]` segment for a
 * per-subscriber token (`/api/calendar/[token]`) so revocation and
 * true privacy become possible without breaking subscribers' URLs.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ workspaceId: string }> },
) {
  const { workspaceId } = await params;

  const [ws] = await db
    .select({ id: workspaces.id, name: workspaces.name })
    .from(workspaces)
    .where(eq(workspaces.id, workspaceId));

  if (!ws) {
    return new Response("Workspace not found", { status: 404 });
  }

  const all = await getTasks(workspaceId);
  const events: ICalEvent[] = all
    .filter((t): t is typeof t & { dueAt: Date } => t.dueAt instanceof Date)
    .map((t) => {
      const lane = LANES[t.lane];
      const descParts: string[] = [];
      if (t.tags && t.tags.length > 0) {
        descParts.push(t.tags.map((tag) => `#${tag}`).join(" "));
      }
      descParts.push(`Lane: ${lane.name}`);
      return {
        uid: `${t.id}@tasks`,
        summary: t.title,
        description: descParts.join(" · "),
        start: t.dueAt,
        url: `/app/board?task=${encodeURIComponent(t.id)}`,
      };
    });

  const body = buildIcsCalendar({ workspaceName: ws.name, events });

  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": "inline; filename=workspace.ics",
      // Calendar clients refresh on their own cadence; a generous
      // cache window cuts redundant load without making changes
      // feel any slower than the spec's own poll interval.
      "Cache-Control": "public, max-age=900, s-maxage=1800",
    },
  });
}
