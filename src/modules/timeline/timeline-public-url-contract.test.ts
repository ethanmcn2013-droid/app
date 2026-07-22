import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

/**
 * Static source contracts from the Phase 5 Opus review.
 *
 * MAJOR-1: every public-facing URL the Timeline module builds must anchor on
 * the TIMELINE public origin (NEXT_PUBLIC_TIMELINE_SITE_URL ?? TIMELINE_URL),
 * never the unified app's own NEXT_PUBLIC_SITE_URL — in the unified app that
 * is the Tasks origin, and /s/[token] + /:workspaceSlug only exist on
 * timeline.signalstudio.ie (AD-009).
 *
 * MINOR-2: the publish/unpublish actions may only revalidate authed /app/plan
 * paths — public-page revalidation is architecturally impossible cross-app
 * and must never silently reappear.
 */
const moduleRoot = path.join(process.cwd(), "src", "modules", "timeline");

function read(rel: string): string {
  // Strip line/block comments so prose ABOUT forbidden patterns cannot trip
  // the contract (mirrors scripts/check-module-boundaries.mjs).
  return readFileSync(path.join(moduleRoot, rel), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/[^\n]*/g, "$1");
}

describe("timeline public-url contract", () => {
  it("audience share links anchor on the timeline public origin", () => {
    const source = read("server/actions/audience-timeline.ts");
    assert.ok(
      source.includes("NEXT_PUBLIC_TIMELINE_SITE_URL ?? TIMELINE_URL"),
      "audience-timeline.ts must build share links from NEXT_PUBLIC_TIMELINE_SITE_URL ?? TIMELINE_URL",
    );
    assert.ok(
      !source.includes("process.env.NEXT_PUBLIC_SITE_URL"),
      "audience-timeline.ts must not reference the unified app's NEXT_PUBLIC_SITE_URL",
    );
  });

  it("no module file builds public URLs from the host origin", () => {
    for (const rel of ["app/page.tsx", "app/plan/[projectSlug]/page.tsx"]) {
      const source = read(rel);
      assert.ok(
        !source.includes("process.env.NEXT_PUBLIC_SITE_URL"),
        `${rel} must not reference the unified app's NEXT_PUBLIC_SITE_URL`,
      );
    }
  });

  it("publish/unpublish revalidate only authed /app/plan paths", () => {
    const source = read("server/actions/workspaces.ts");
    const calls = [...source.matchAll(/revalidatePath\(\s*(["'`])([^"'`]*)\1/g)];
    assert.ok(calls.length > 0, "expected revalidatePath calls in workspaces.ts");
    for (const call of calls) {
      assert.ok(
        call[2].startsWith("/app/plan"),
        `revalidatePath("${call[2]}") targets a non-authed path — public pages live on the old deployment and cannot be revalidated from this app`,
      );
    }
  });
});
