import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

/**
 * E08.11 — the venue/couple data boundary at the one place it is crossed.
 *
 * `/api/internal/partner-stats` is the ONLY path by which venue-axis code
 * (studio's `src/lib/partners/stats.ts`, rendered at `/hq/marketing`) reads
 * couple-axis data (this repo's `comp_codes` and `entitlements`). Everything
 * else about the venue relationship lives in the shared entitlements database.
 *
 * Before this file it had no test of any kind. A widening of the projection —
 * one extra column in the select, one extra field in the JSON — would have
 * shipped green, and the thing it would widen into is a couple's private
 * workspace.
 *
 * These assertions read the route source rather than executing it because the
 * route imports a module-level database client. That is the same idiom as
 * `src/server/stripe-contract.test.mjs` and `src/server/tenant-scope.test.mjs`.
 * Each assertion is written so that removing the guard it protects makes it
 * fail — see evidence/E08.11-sponsored-journey-test-coverage.md for the
 * mutation runs.
 */

const route = readFileSync(new URL("./route.ts", import.meta.url), "utf8");

/** Executable source only: comments describe the boundary, they do not cross it. */
const code = route.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

/** The only two tables this route is permitted to reach. */
const PERMITTED_TABLES = ["compCodes", "entitlements"];

test("the response carries four aggregate numbers and nothing else", () => {
  // Every object literal handed to NextResponse.json that is not the error
  // shape must have exactly this key set.
  const successBodies = [
    ...route.matchAll(/NextResponse\.json\(\{([\s\S]*?)\}\)/g),
  ]
    .map((match) => match[1])
    .filter((body) => !body.includes("error"));

  assert.ok(
    successBodies.length >= 2,
    "expected the empty-sponsor body and the populated body",
  );

  const allowed = new Set([
    "codesRedeemed",
    "redeemed30d",
    "reachedBoard",
    "mostRecentRedemptionAt",
  ]);

  for (const body of successBodies) {
    const keys = [...body.matchAll(/^\s*([A-Za-z_$][\w$]*)\s*[,:]/gm)].map((m) => m[1]);
    assert.ok(keys.length > 0, "could not read the response keys");
    for (const key of keys) {
      assert.ok(
        allowed.has(key),
        `partner-stats would return "${key}". The venue axis may only receive ` +
          `aggregate counts. Adding a field here is a privacy decision, not a refactor.`,
      );
    }
  }
});

test("the entitlements read projects two timestamps and no identity column", () => {
  const select = route.slice(
    route.indexOf("const entitlementRows = await db"),
    route.indexOf(".from(entitlements)"),
  );
  assert.ok(select.length > 0, "could not locate the entitlements select");
  assert.match(select, /startedAt: entitlements\.startedAt/);
  assert.match(select, /reachedBoardAt: entitlements\.reachedBoardAt/);

  for (const forbidden of [
    "workspaceId",
    "userId",
    "entitlements.id",
    "notes:",
    "tier:",
  ]) {
    assert.ok(
      !select.includes(forbidden),
      `the entitlements projection would carry "${forbidden}". A workspace ` +
        `handle or a user id turns an aggregate into a route into the couple's workspace.`,
    );
  }
});

test("no couple-content table is reachable from this route", () => {
  // Whitelist rather than blacklist: assert the schema import set exactly,
  // so a table added tomorrow fails without anyone having to have predicted
  // its name.
  const schemaImport = route.match(
    /import\s*\{([^}]*)\}\s*from\s*["']@\/server\/db\/schema["']/,
  );
  assert.ok(schemaImport, "could not find the schema import");
  const imported = schemaImport[1]
    .split(",")
    .map((name) => name.trim())
    .filter(Boolean)
    .sort();
  assert.deepEqual(
    imported,
    [...PERMITTED_TABLES].sort(),
    "partner-stats may reach comp_codes and entitlements and nothing else. " +
      "Importing another table here opens the venue axis onto couple content.",
  );

  // And no raw-SQL escape hatch onto a couple-content table.
  for (const table of [
    "tasks",
    "attachments",
    "comments",
    "share_links",
    "workspaces",
    "workspace_members",
    "timeline_items",
    "milestones",
    "planning_periods",
  ]) {
    assert.ok(
      !new RegExp(`\\b${table}\\b`).test(code),
      `partner-stats names "${table}" in raw SQL. The venue axis must not be ` +
        `able to read couple content through this endpoint.`,
    );
  }
});

test("authorisation fails closed when the shared secret is unset", () => {
  const guard = route.slice(route.indexOf("const auth ="), route.indexOf("const url ="));
  assert.ok(guard.length > 0, "could not locate the authorisation guard");

  // An unset secret must be rejected, not treated as "no auth required".
  assert.match(guard, /!secret \|\|/);
  // The length check must precede timingSafeEqual, which throws on a length
  // mismatch. A throw here would surface as a 500 and leak the fact that the
  // supplied token was the wrong length.
  const lengthCheck = guard.indexOf("auth.length !== expected.length");
  const constantTime = guard.indexOf("timingSafeEqual");
  assert.ok(lengthCheck >= 0, "the length pre-check is missing");
  assert.ok(
    lengthCheck < constantTime,
    "timingSafeEqual must not be reached before the length check",
  );
  assert.match(guard, /status: 401/);
});

test("the sponsor scope is derived from this sponsor's own codes, never from the caller", () => {
  // notesValues is what bounds the entitlements read. It must be built from
  // compCodeRows (which were filtered by sponsor_slug), not from a request
  // parameter.
  const derivation = route.slice(
    route.indexOf("const notesValues"),
    route.indexOf("const cutoff"),
  );
  assert.match(derivation, /sponsorCodes\.map/);
  assert.ok(
    !derivation.includes("searchParams") && !derivation.includes("req."),
    "the entitlement scope must not be attacker-supplied",
  );
});

/**
 * R-027 lives here too, and it is not fixed.
 *
 * `reachedBoard` is a behavioural count: it says how many sponsored couples
 * opened their board. D-011 ratified a floor of 3 eligible sponsored
 * workspaces for behavioural counts, and WP-07 made that floor two-sided in
 * studio's `suppression.ts`. This endpoint applies no floor at all.
 *
 * It is not a live disclosure today: the only consumer, `/hq/marketing`, sums
 * across every sponsor and is founder-only behind the HQ password. It becomes
 * one the moment D-027 point 4's "aggregate adoption evidence" is turned on
 * per venue after 1 September.
 *
 * This test does not invent a threshold — choosing one for a founder-only
 * aggregate is a product decision, recorded as an open question on E08.11. It
 * pins the acknowledgement so the endpoint cannot quietly become venue-facing
 * with the gap forgotten.
 */
test("the missing small-cell floor is acknowledged in the route, not forgotten", () => {
  assert.match(
    route,
    /R-027/,
    "the route must carry the R-027 acknowledgement: reachedBoard is a " +
      "behavioural count returned with no suppression floor, and this endpoint " +
      "must not be made venue-facing until that is decided.",
  );
  assert.match(route, /not venue-facing/i);
});
