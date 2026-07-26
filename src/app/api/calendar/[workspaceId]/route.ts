import { and, eq } from "drizzle-orm";
import { db } from "@/server/db";
import { workspaceMembers, workspaces } from "@/server/db/schema";
import { getTasks } from "@/server/db/queries";
import { getCurrentUserOrNull } from "@/server/auth";
import { LANES } from "@/lib/data";
import { buildIcsCalendar, type ICalEvent } from "@/lib/ical";
import { isDemoMode } from "@/lib/access-mode";
import {
  DEMO_WORKSPACE_ID,
  DEMO_WORKSPACE_NAME,
} from "@/server/demo/tasks-demo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Read-only ICS feed for a workspace. Requires Clerk session AND
 * membership of the requested workspace, the proxy enforces auth on
 * `/api/:path*`, and the membership check below prevents a signed-in
 * user from reading another tenant's calendar by guessing a workspace id.
 *
 * Apple Calendar / Google Calendar / Outlook can't carry a Clerk
 * session, so external calendar-client subscription is not supported
 * by this URL shape. The future per-subscriber-token route
 * (`/api/calendar/[token]`) is the path to unauthed-but-private feeds.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ workspaceId: string }> },
) {
  const { workspaceId } = await params;

  let workspaceName: string;
  if (isDemoMode()) {
    if (workspaceId !== DEMO_WORKSPACE_ID) {
      return new Response("Workspace not found", { status: 404 });
    }
    workspaceName = DEMO_WORKSPACE_NAME;
  } else {
    const me = await getCurrentUserOrNull();
    if (!me) return new Response("Unauthorized", { status: 401 });

    const [membership] = await db
      .select({ workspaceId: workspaceMembers.workspaceId })
      .from(workspaceMembers)
      .where(
        and(
          eq(workspaceMembers.userId, me),
          eq(workspaceMembers.workspaceId, workspaceId),
        ),
      )
      .limit(1);

    if (!membership) {
      return new Response("Workspace not found", { status: 404 });
    }

    const [ws] = await db
      .select({ id: workspaces.id, name: workspaces.name })
      .from(workspaces)
      .where(eq(workspaces.id, workspaceId));

    if (!ws) {
      return new Response("Workspace not found", { status: 404 });
    }
    workspaceName = ws.name;
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
        url: `/app/tasks?task=${encodeURIComponent(t.id)}`,
      };
    });

  const body = buildIcsCalendar({ workspaceName, events });

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
