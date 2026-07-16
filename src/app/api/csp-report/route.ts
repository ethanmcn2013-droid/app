import { NextResponse } from "next/server";
import {
  readBoundedRequestText,
  safeCspDirective,
  safeCspUri,
} from "@/server/security/csp-report";

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
const MAX_REPORT_BYTES = 16 * 1024;
const MAX_REPORTS_PER_REQUEST = 20;

type CspReportBody = {
  "document-uri"?: string;
  "violated-directive"?: string;
  "effective-directive"?: string;
  "blocked-uri"?: string;
};

function logViolation(r: CspReportBody | undefined): void {
  if (!r) return;
  const directive = safeCspDirective(
    r["effective-directive"] || r["violated-directive"],
  );
  console.warn(
    `[csp-report] blocked=${safeCspUri(r["blocked-uri"])} ` +
      `directive=${directive} doc=${safeCspUri(r["document-uri"])}`,
  );
}

export async function POST(req: Request): Promise<NextResponse> {
  try {
    const contentLength = Number(req.headers.get("content-length") ?? "0");
    if (Number.isFinite(contentLength) && contentLength > MAX_REPORT_BYTES) {
      return new NextResponse(null, { status: 204 });
    }
    const text = await readBoundedRequestText(req, MAX_REPORT_BYTES);
    if (text) {
      const json: unknown = JSON.parse(text);
      if (Array.isArray(json)) {
        // Reporting API (report-to): array of { type, body }.
        for (const rep of json.slice(0, MAX_REPORTS_PER_REQUEST)) {
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
