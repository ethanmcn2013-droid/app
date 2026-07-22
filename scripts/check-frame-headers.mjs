#!/usr/bin/env node

/**
 * Frame-headers contract gate (AD-012).
 *
 * Asserts two invariants in next.config.ts via static string inspection:
 *
 *   1. The global headers rule still carries X-Frame-Options: DENY — the
 *      default posture that protects every non-embed route.
 *
 *   2. The global rule EXCLUDES /embed/* (negative lookahead source) and an
 *      /embed exception entry exists that carries NO X-Frame-Options at all,
 *      with CSP frame-ancestors * — under a Report-Only CSP, only the total
 *      absence of a blocking XFO makes embeds actually framable cross-origin
 *      (browsers only let an ENFORCED frame-ancestors override XFO).
 *
 * A full runtime header check requires a running server and is deferred to
 * Phase 9 live verification. This static check is sufficient to catch the
 * class of regression where someone removes the embed exception or hardens
 * the global rule without restoring the embed carve-out.
 *
 * Run: node scripts/check-frame-headers.mjs
 * Wired into: package.json "test" chain, after check-route-manifest.mjs.
 */

import { readFileSync, existsSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const configPath = path.join(root, "next.config.ts");
const failures = [];

if (!existsSync(configPath)) {
  console.error("[frame-headers] FAIL — next.config.ts not found");
  process.exit(1);
}

const source = readFileSync(configPath, "utf8");

/* ── Assertion 1: global rule still denies framing ──────────────────── */

// The global securityHeaders array must carry X-Frame-Options: DENY.
if (!source.includes('"X-Frame-Options"') && !source.includes("'X-Frame-Options'")) {
  failures.push(
    'next.config.ts: X-Frame-Options header is missing entirely from securityHeaders. ' +
    'The global rule must include { key: "X-Frame-Options", value: "DENY" }.',
  );
} else if (!source.includes('"DENY"') && !source.includes("'DENY'")) {
  failures.push(
    'next.config.ts: X-Frame-Options is present but value "DENY" not found. ' +
    'The global rule must set X-Frame-Options to DENY for all non-embed routes.',
  );
}

// The global CSP must have frame-ancestors 'none' to block framing site-wide.
if (!source.includes("frame-ancestors 'none'")) {
  failures.push(
    "next.config.ts: CSP does not contain \"frame-ancestors 'none'\". " +
    "The global rule must block framing on all non-embed routes.",
  );
}

/* ── Assertion 2: global rule excludes /embed; exception carries no XFO ── */

// The global rule must exclude embed paths via negative lookahead so /embed
// never receives X-Frame-Options (setting any XFO value would still block
// cross-origin framing while the CSP is Report-Only).
if (!source.includes('"/((?!embed/).*)"') && !source.includes("'/((?!embed/).*)'")) {
  failures.push(
    'next.config.ts: global headers source must be "/((?!embed/).*)" so /embed/* ' +
    "receives no X-Frame-Options at all (AD-012).",
  );
}

// A headers entry with source "/embed/:path*" must be present.
if (!source.includes('"/embed/:path*"') && !source.includes("'/embed/:path*'")) {
  failures.push(
    'next.config.ts: no /embed/:path* headers entry found. ' +
    'AD-012 requires an exception entry carrying the security headers minus ' +
    'X-Frame-Options for framable embed routes.',
  );
} else {
  if (!source.includes("frame-ancestors *")) {
    failures.push(
      "next.config.ts: /embed/:path* entry exists but \"frame-ancestors *\" not found. " +
      "The embed exception must set CSP frame-ancestors to * so embed pages are framable.",
    );
  }

  // The embed header list must EXCLUDE X-Frame-Options entirely.
  if (!/embedFrameHeaders[\s\S]*?filter[\s\S]*?X-Frame-Options/.test(source)) {
    failures.push(
      "next.config.ts: embedFrameHeaders must filter X-Frame-Options out of the " +
      "security header set — embed routes must carry no XFO header at all (AD-012).",
    );
  }
}

/* ── Verdict ─────────────────────────────────────────────────────────── */

if (failures.length > 0) {
  console.error("[frame-headers] FAIL");
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}

console.log("[frame-headers] ok (global DENY confirmed; /embed exception confirmed)");
