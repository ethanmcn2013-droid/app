import { NextResponse } from "next/server";
import { opLog } from "@/server/operational-log";

/**
 * CSP violation collector.
 *
 * Browsers POST here when a Content-Security-Policy is violated, wired via
 * the `report-uri` / `report-to` directives + `Reporting-Endpoints` header in
 * next.config.ts. Until now the suite's Report-Only policies reported to
 * NOWHERE, so there was no evidence a policy was clean. This logs one concise
 * line per violation to the function logs so we can verify a policy before
 * promoting Report-Only → enforce. Always 204; never throws.
 *
 * Handles both formats: legacy `application/csp-report`
 * (`{ "csp-report": {...} }`) and the Reporting API `application/reports+json`
 * (an array of `{ type, body }`).
 */
export const runtime = "nodejs";

type CspReportBody = {
  "document-uri"?: string;
  "violated-directive"?: string;
  "effective-directive"?: string;
  "blocked-uri"?: string;
};

/**
 * One line per violation, through the operational-log redactor (E08.08).
 *
 * `document-uri` is browser-supplied and is the full URL of the page that
 * violated the policy. On a shared workspace that is `/share/<token>` or
 * `/s/<token>` — a bearer credential. Logging it verbatim wrote a live share
 * token into the function logs, which are retained by the platform and read by
 * whoever is debugging. Sentry already redacted exactly this shape; the
 * console path did not, so the same string was safe when thrown and unsafe
 * when logged. `opLog` closes that gap by applying the same rule.
 */
function logViolation(r: CspReportBody | undefined): void {
  if (!r) return;
  opLog("warn", "csp-report", "policy violation reported", {
    blocked: r["blocked-uri"] ?? "?",
    directive: r["effective-directive"] || r["violated-directive"] || "?",
    doc: r["document-uri"] ?? "?",
  });
}

export async function POST(req: Request): Promise<NextResponse> {
  try {
    const text = await req.text();
    if (text) {
      const json: unknown = JSON.parse(text);
      if (Array.isArray(json)) {
        // Reporting API (report-to): array of { type, body }.
        for (const rep of json) {
          const r = rep as { type?: string; body?: CspReportBody };
          if (r && r.type === "csp-violation") logViolation(r.body);
        }
      } else if (json && typeof json === "object" && "csp-report" in json) {
        // Legacy report-uri.
        logViolation((json as { "csp-report"?: CspReportBody })["csp-report"]);
      }
    }
  } catch {
    // Malformed report, ignore, never error a browser beacon.
  }
  return new NextResponse(null, { status: 204 });
}
