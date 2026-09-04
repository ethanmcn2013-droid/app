import { db } from "@/server/db";
import { handleVenueIssuance } from "@/server/venue-issuance/handler";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Purpose-separated internal service. No user session or usage key can issue. */
export async function POST(request: Request) {
  const environment = process.env.VENUE_ISSUANCE_ENVIRONMENT;
  return handleVenueIssuance(request, {
    database: db,
    enabled: process.env.VENUE_ISSUANCE_ENABLED === "true" &&
      (environment === "internal_test" || environment === "production"),
    environment: environment === "production" ? "production" : "internal_test",
    auth: { secret: process.env.VENUE_ISSUANCE_SECRET ?? "", keyEpoch: process.env.VENUE_ISSUANCE_KEY_EPOCH ?? "",
      usageSecret: process.env.SPONSOR_USAGE_SERVICE_SECRET },
  });
}
