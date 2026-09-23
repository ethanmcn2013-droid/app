import { timingSafeEqual } from "node:crypto";
import { db } from "@/server/db";
import { deliverUsage } from "@/server/sponsored-use/delivery";
import { usageResponse } from "@/lib/sponsored-use/service-auth";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  const expected = Buffer.from("Bearer " + (process.env.CRON_SECRET ?? ""));
  const actual = Buffer.from(request.headers.get("authorization") ?? "");
  if (!process.env.CRON_SECRET || expected.length !== actual.length || !timingSafeEqual(expected, actual)) return usageResponse(401, { ok: false });
  try {
    const result = await deliverUsage(db, {
      enabled: process.env.SPONSOR_USAGE_EVENTS === "1",
      studioOrigin: process.env.SPONSOR_USAGE_STUDIO_ORIGIN ?? "",
      secret: process.env.SPONSOR_USAGE_SERVICE_SECRET ?? "",
      issuanceSecret: process.env.VENUE_ISSUANCE_SECRET,
    });
    return usageResponse(result.failed ? 503 : 200, result);
  } catch { return usageResponse(503, { ok: false }); }
}
