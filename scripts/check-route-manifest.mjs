#!/usr/bin/env node

/**
 * Route-manifest characterisation gate — guards every known route segment
 * directory under src/app against silent deletion.
 *
 * The manifest is the full set of route directories that existed when this
 * gate was written (migration/unified-app, 2026-07-20). If any listed
 * directory stops existing the gate fails, surfacing the accidental drop
 * before it reaches CI or a phase merge.
 *
 * Intentionally one-directional: new routes added by later phases are NOT
 * an error — only removals are caught. This keeps the gate useful across
 * the full migration lifecycle without requiring a manifest update for
 * every new route a phase introduces.
 *
 * Run: node scripts/check-route-manifest.mjs
 * Wired into: package.json "test" chain, after check-module-boundaries.mjs.
 */

import { existsSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const appDir = path.join(root, "src", "app");

/**
 * Every route segment directory that must exist. Paths are relative to
 * src/app. Dynamic segments use Next.js bracket notation verbatim (the
 * filesystem uses literal brackets).
 *
 * Grouped by category for readability; order within a group is
 * alphabetical. The gate does not care about order.
 */
const MANIFEST = [
  // ── Product /app routes ──────────────────────────────────────────────────
  "app",
  "app/archived",
  "app/board",
  "app/brief",
  "app/calendar",
  "app/import",
  "app/inbox",
  "app/list",
  "app/my-tasks",
  "app/notes",
  "app/plan",
  "app/plan/[projectSlug]",
  "app/plan/audience",
  "app/settings",
  "app/timeline",
  "app/your-work",

  // ── Sharing / collaboration surface routes ───────────────────────────────
  "embed",
  "embed/[slug]",
  "embed/guide",
  "invite",
  "invite/[token]",
  "p",
  "p/[slug]",
  "print",
  "print/board",
  "print/calendar",
  "print/list",
  "print/timeline",
  "redeem",
  "redeem/[code]",
  "share",
  "share/[token]",
  "share-card",
  "share-card/[workspaceId]",
  "share-target",

  // ── Auth routes ──────────────────────────────────────────────────────────
  "sign-in",
  "sign-in/[[...sign-in]]",
  "sign-up",
  "sign-up/[[...sign-up]]",

  // ── Settings ─────────────────────────────────────────────────────────────
  "settings",
  "settings/notifications",
  "settings/plan",
  "settings/profile",

  // ── Marketing pages ──────────────────────────────────────────────────────
  "about",
  "changelog",
  "for",
  "for/community",
  "for/freelancers",
  "for/small-business",
  "for/students",
  "for/trades",
  "for/weddings",
  "press",
  "pricing",
  "principles",
  "privacy",
  "roadmap",
  "security",
  "social",
  "social/bluesky-banner",
  "social/bluesky-pinned",
  "social/reddit-ads-wedding",
  "social/x-banner",
  "social/x-pinned",
  "status",
  "students",
  "templates",
  "templates/[slug]",
  "terms",
  "waitlist",
  "welcome",
  "welcome/plan",

  // ── API routes (directory level) ─────────────────────────────────────────
  "api",
  "api/account",
  "api/account/delete",
  "api/account/export",
  "api/analytics",
  "api/analytics/capture",
  "api/attachments",
  "api/attachments/[id]",
  "api/calendar",
  "api/calendar/[workspaceId]",
  "api/checkout",
  "api/cron",
  "api/cron/digest",
  "api/cron/outbox",
  "api/cron/weekly-digest",
  "api/csp-report",
  "api/events",
  "api/health",
  "api/health/digest",
  "api/internal",
  "api/internal/partner-stats",
  "api/internal/reconcile-entitlements",
  "api/internal/workspace-personalization",
  "api/internal/workspaces",
  "api/notes-extract",
  "api/notes-extract/v2",
  "api/roadmap.ics",
  "api/suite-context",
  "api/webhooks",
  "api/webhooks/clerk",
  "api/webhooks/stripe",
];

/* ── Verification ────────────────────────────────────────────────────── */

const missing = [];

for (const segment of MANIFEST) {
  const full = path.join(appDir, segment);
  if (!existsSync(full)) {
    missing.push(`src/app/${segment}`);
  }
}

if (missing.length > 0) {
  console.error("[route-manifest] FAIL — the following route directories no longer exist:");
  for (const m of missing) {
    console.error(`  - ${m}`);
  }
  console.error(
    "\nIf a route was intentionally removed, update MANIFEST in scripts/check-route-manifest.mjs.",
  );
  process.exit(1);
}

console.log(`[route-manifest] ok (${MANIFEST.length} route directories verified)`);
