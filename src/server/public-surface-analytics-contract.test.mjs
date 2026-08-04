/**
 * Contract gate for E06.07 — no third-party analytics on the couple-facing
 * public surfaces, and no raw viewer count on any owner surface.
 *
 * This asserts against SOURCE TEXT on purpose, and the reason matters.
 *
 * The Playwright suite runs with VERCEL_ENV=preview, and <GoogleTag /> renders
 * only when VERCEL_ENV === "production". A browser assertion that "GA is not
 * present on /p" therefore passes today and would keep passing if the exclusion
 * were deleted. It would prove nothing. Only the wiring can catch this class of
 * regression, so only the wiring is asserted.
 *
 * Decisions this pins: R-032 (Option A, D-033) and the artifact-studio.tsx
 * de-anonymisation defect named in D-033.
 *
 * Run: node --test src/server/public-surface-analytics-contract.test.mjs
 * Wired into: package.json "test" chain.
 */

import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();
const read = (relative) => readFileSync(path.join(root, relative), "utf8");

const EXCLUDED = ["/p", "/s", "/share", "/embed"];

test("the analytics boundary names exactly the four couple-facing routes", () => {
  const source = read("src/lib/public-analytics-boundary.ts");
  for (const route of EXCLUDED) {
    assert.match(
      source,
      new RegExp(`"${route}"`),
      `public-analytics-boundary.ts must list ${route}`,
    );
  }
  assert.match(source, /export function isAnalyticsExcludedPath/);
});

test("the predicate matches a route root and its children, and nothing else", () => {
  // Re-implemented from the source rather than imported: this file runs under
  // plain `node --test` with no TypeScript loader, and the behavioural
  // assertion belongs somewhere that always runs.
  const source = read("src/lib/public-analytics-boundary.ts");
  assert.match(
    source,
    /pathname === root \|\| pathname\.startsWith\(`\$\{root\}\/`\)/,
    "the predicate must match the root exactly or as a path prefix",
  );
  // A bare `startsWith(root)` would swallow /pricing and /sitemap.xml.
  assert.doesNotMatch(source, /startsWith\(root\)/);
});

test("GoogleTag refuses the excluded routes before anything else", () => {
  const source = read("src/components/analytics/google-tag.tsx");
  assert.match(
    source,
    /isAnalyticsExcludedPath\(pathname\)\)\s*return null;/,
    "google-tag.tsx must return null on the excluded routes",
  );

  // The exclusion must not be gated on `enabled`. If it were, turning GA on in
  // a new environment would turn it on for the couple's page too.
  const exclusionIndex = source.indexOf("isAnalyticsExcludedPath(pathname)");
  const enabledIndex = source.indexOf("if (!enabled");
  assert.ok(exclusionIndex > 0, "exclusion check missing");
  assert.ok(
    enabledIndex === -1 || exclusionIndex < enabledIndex,
    "the route exclusion must be evaluated before the enabled flag",
  );

  // And it must come before any <Script>.
  const scriptIndex = source.indexOf("<Script");
  assert.ok(scriptIndex > exclusionIndex, "exclusion must precede the tag");
});

test("no excluded route tree renders the tag itself", () => {
  for (const dir of [
    "src/app/p",
    "src/app/s",
    "src/app/share",
    "src/app/embed",
  ]) {
    const listing = listFiles(path.join(root, dir));
    for (const file of listing) {
      const source = readFileSync(file, "utf8");
      assert.doesNotMatch(
        source,
        /GoogleTag|googletagmanager|gtag\(/,
        `${path.relative(root, file)} must not carry a third-party tag`,
      );
    }
  }
});

test("the per-route CSP for /p, /share and /embed carries no analytics host", () => {
  const source = read("next.config.ts");
  assert.match(
    source,
    /function noThirdPartyAnalyticsCsp/,
    "next.config.ts must build an analytics-free policy for the public artifact routes",
  );
  assert.match(
    source,
    /const embedCsp = buildCsp\(\{\s*analytics: false/,
    "/embed's baseline policy must drop the analytics hosts",
  );
  // Enforced, not Report-Only. A reported violation is a log line, not a refusal.
  assert.match(
    source,
    /const publicSurfaceAnalyticsHeaders = \[\s*\{\s*key: "Content-Security-Policy",/,
    "the couple-facing analytics policy must be enforced, not Report-Only",
  );
  assert.match(source, /source: "\/p\/:path\*"/);
  assert.match(source, /source: "\/share\/:path\*"/);
  assert.match(source, /embedSurfaceAnalyticsHeaders/);

  // The policy builder refuses to emit a Google host at all.
  assert.match(
    source,
    /R-032 forbids it/,
    "noThirdPartyAnalyticsCsp must throw if a Google host survives an edit",
  );

  // /s has carried its own enforced, analytics-free policy since E05. Assert it
  // rather than rebuild it.
  const audience = source.slice(
    source.indexOf("const audienceArtifactCsp"),
    source.indexOf("const audienceArtifactHeaders"),
  );
  assert.ok(audience.length > 0, "audienceArtifactCsp not found");
  assert.doesNotMatch(audience, /googletagmanager|google-analytics/);
  assert.match(audience, /connect-src 'self'/);
});

test("no owner surface renders a raw qualified view count", () => {
  for (const relative of [
    "src/modules/timeline/app/audience/artifact-studio.tsx",
    "src/modules/timeline/app/audience/audience-manager.tsx",
  ]) {
    const source = read(relative);
    assert.doesNotMatch(
      source,
      /qualifiedViewCount\s*\.\s*toLocaleString/,
      `${relative} must route the count through presentViewerCount`,
    );
    assert.doesNotMatch(
      source,
      /\{\s*publication\.qualifiedViewCount\s*\}/,
      `${relative} must not render the integer directly`,
    );
    assert.match(
      source,
      /from "@\/modules\/timeline\/lib\/viewer-count"/,
      `${relative} must import the suppressed presenter`,
    );
  }
});

test("the last-viewed timestamp is never rendered at day precision", () => {
  const source = read("src/modules/timeline/app/audience/artifact-studio.tsx");
  // The exact defect D-033 names: a count beside a day-precision date.
  assert.doesNotMatch(source, /lastQualifiedViewAt\s*\)?\s*\}/);
  assert.doesNotMatch(source, /day:\s*"numeric"/);
  assert.doesNotMatch(source, /Last viewed/);
});

test("the suppression floor lives with the value, not with a caller", () => {
  const source = read("src/modules/timeline/lib/viewer-count.ts");
  assert.match(source, /export const VIEWER_COUNT_FLOOR/);
  // Surfaces must not pass their own floor in.
  for (const relative of [
    "src/modules/timeline/app/audience/artifact-studio.tsx",
    "src/modules/timeline/app/audience/audience-manager.tsx",
  ]) {
    assert.doesNotMatch(read(relative), /floor:/);
  }
});

function listFiles(dir) {
  if (!existsSync(dir)) return [];
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...listFiles(full));
    else if (/\.(tsx?|mjs|jsx?)$/.test(entry)) out.push(full);
  }
  return out;
}

/**
 * R-032 is about THIRD-PARTY analytics, not about Google specifically. Sentry is
 * a third party. Before this, instrumentation-client.ts excluded only `/s`, so
 * `/p`, `/share` and `/embed` still initialised it and D-033 Option A was not
 * satisfied by removing GA4 alone. A Wave 4 verifier found it.
 */
test("Sentry uses the shared analytics boundary, not its own route list", () => {
  const client = readFileSync(
    new URL("../instrumentation-client.ts", import.meta.url),
    "utf8",
  );
  assert.match(
    client,
    /isAnalyticsExcludedPath/,
    "src/instrumentation-client.ts must gate Sentry on isAnalyticsExcludedPath. Sentry is a third party and D-033 Option A excludes third-party analytics from every couple-facing public surface, not just /s.",
  );
  assert.doesNotMatch(
    client,
    /pathname\s*===\s*"\/s"/,
    "the hand-rolled /s-only check must be gone. Two lists drift; the shared boundary cannot.",
  );
});

test("no couple-facing route is excluded from GA4 but not from Sentry", () => {
  const client = readFileSync(
    new URL("../instrumentation-client.ts", import.meta.url),
    "utf8",
  );
  // The point of sharing the predicate is that this can never go out of sync,
  // so the assertion is that the predicate is the gate — not a re-listing of
  // the four routes, which would be the very duplication being removed.
  const gate = client.match(/const\s+\w+\s*=\s*[\s\S]{0,200}?isAnalyticsExcludedPath\([^)]*\)/);
  assert.ok(
    gate,
    "the Sentry init guard must derive from isAnalyticsExcludedPath(window.location.pathname)",
  );
});
