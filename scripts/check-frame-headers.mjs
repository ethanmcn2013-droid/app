#!/usr/bin/env node

/**
 * Frame-headers contract gate (AD-012).
 *
 * Asserts two invariants in next.config.ts via static string inspection:
 *
 *   1. The global headers rule still carries X-Frame-Options: DENY — the
 *      default posture that protects every non-embed route.
 *
 *   2. An /embed exception exists that overrides XFO away from DENY and
 *      replaces CSP frame-ancestors 'none' with frame-ancestors * so that
 *      /embed/[slug] is actually framable (the documented embed contract).
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

/* ── Assertion 2: /embed exception exists ────────────────────────────── */

// A headers entry with source "/embed/:path*" (or equivalent) must be present.
if (!source.includes('"/embed/:path*"') && !source.includes("'/embed/:path*'")) {
  failures.push(
    'next.config.ts: no /embed/:path* headers entry found. ' +
    'AD-012 requires a second headers entry that overrides X-Frame-Options and ' +
    'CSP frame-ancestors for framable embed routes.',
  );
} else {
  // The embed exception must override frame-ancestors to something other than 'none'.
  // We look for frame-ancestors * as the declared override value.
  if (!source.includes("frame-ancestors *")) {
    failures.push(
      "next.config.ts: /embed/:path* entry exists but \"frame-ancestors *\" not found. " +
      "The embed exception must set CSP frame-ancestors to * so embed pages are framable.",
    );
  }

  // The embed exception must not re-assert DENY for X-Frame-Options.
  // We check that SAMEORIGIN appears (the agreed override value).
  if (!source.includes('"SAMEORIGIN"') && !source.includes("'SAMEORIGIN'")) {
    failures.push(
      'next.config.ts: /embed/:path* entry exists but X-Frame-Options override ' +
      '(SAMEORIGIN) not found. The embed exception must override X-Frame-Options ' +
      'away from DENY so legacy XFO-only browsers do not block the embed.',
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
