import { NextResponse } from "next/server";

/**
 * Lightweight health probe for the daily-digest pipeline.
 * Reports configuration presence (env var booleans) — does NOT
 * trigger the pipeline. This is what the /status page probes so it
 * doesn't need the CRON_SECRET header and never produces a false
 * negative when the secret is correctly set.
 *
 * Returns 200 always so the status-page probe reads "OK".
 * The `configured` fields tell operators whether the integrations
 * are wired up, without exposing secret values.
 */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({
    ok: true,
    pipeline: "daily-digest",
    configured: {
      cronSecret: Boolean(process.env.CRON_SECRET),
      resend: Boolean(process.env.RESEND_API_KEY),
      database: Boolean(process.env.TASKS_DATABASE_URL),
    },
  });
}
