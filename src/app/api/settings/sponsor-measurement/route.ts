import { auth } from "@clerk/nextjs/server";
import { eq } from "drizzle-orm";
import { db } from "@/server/db";
import { userPreferences } from "@/server/db/schema";
import { getCurrentUser } from "@/server/auth";
import { optOutOfSponsoredMeasurementAction } from "@/server/actions/preferences";
import { readInvitationBody, sameOriginJsonPost } from "@/server/sponsor-report/proxy";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store, max-age=0" };
export async function GET() {
  if (!(await auth()).userId) return Response.json({ state: "forbidden" }, { status: 401, headers });
  const actor = await getCurrentUser();
  const [choice] = await db.select({ enabled: userPreferences.sponsorMeasurementEnabled })
    .from(userPreferences).where(eq(userPreferences.userId, actor));
  return Response.json({ enabled: choice?.enabled ?? true }, { headers });
}
export async function POST(request: Request) {
  if (!(await auth()).userId) return Response.json({ state: "forbidden" }, { status: 401, headers });
  if (!sameOriginJsonPost(request)) return Response.json({ state: "forbidden" }, { status: 403, headers });
  const body = await readInvitationBody(request);
  let value: unknown;
  try { value = body === null ? null : JSON.parse(body); } catch { value = null; }
  if (!value || typeof value !== "object" || Array.isArray(value) ||
      Object.keys(value).length !== 1 || (value as { enabled?: unknown }).enabled !== false)
    return Response.json({ state: "conflict" }, { status: 400, headers });
  try { await optOutOfSponsoredMeasurementAction(); }
  catch { return Response.json({ state: "unavailable" }, { status: 503, headers }); }
  return Response.json({ enabled: false }, { headers });
}
