/**
 * E05.08 — the unpublished-Timeline boundary.
 *
 * The authenticated planning Timeline and the published artifact are two
 * different objects. A couple curates in private; publishing is a separate,
 * explicit act that mints a token. Nothing that has not been published may
 * ever resolve for a bearer, and a sponsoring venue holds no route to a
 * couple's Timeline at all.
 *
 * These are behavioural tests, not source-text assertions: the real
 * `resolveAudienceTimeline` runs against a real libSQL database created from
 * the committed Timeline baseline migration. Env is set before the dynamic
 * import because the Timeline client builds its connection at module load.
 *
 * Run:
 *   node --import tsx --test \
 *     src/modules/timeline/server/unpublished-timeline-boundary.test.ts
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { before, test } from "node:test";

process.env.SIGNAL_ACCESS_MODE = "development";
process.env.TIMELINE_DATABASE_URL = ":memory:";
delete process.env.TIMELINE_AUTH_TOKEN;
delete process.env.NEXT_PUBLIC_DEMO_MODE;
delete process.env.DEMO_MODE;
// The optional distributed limiter is deliberately unconfigured: with either
// Upstash var present the resolver fails closed and every case below would
// pass for the wrong reason.
delete process.env.UPSTASH_REDIS_REST_URL;
delete process.env.UPSTASH_REDIS_REST_TOKEN;

type TimelineModule = typeof import("./audience-timeline");
type SchemaModule = typeof import("./db/timeline-client");

let audience: TimelineModule;
let dbModule: SchemaModule;
let generateAudienceToken: () => string;
let hashAudienceToken: (raw: string) => string;

const PUBLICATION_ID = "pub-wedding-0001";
const WORKSPACE_SLUG = "mara-and-finn";

async function run(sql: string): Promise<void> {
  const { sql: raw } = await import("drizzle-orm");
  await dbModule.db.run(raw.raw(sql));
}

/** Reset the publication to a known state without touching the share row. */
async function setPublicationState(
  state: "draft" | "published" | "unpublished",
): Promise<void> {
  await run(
    `UPDATE timeline_publications SET state = '${state}' WHERE id = '${PUBLICATION_ID}'`,
  );
}

before(async () => {
  dbModule = await import("./db/timeline-client");
  audience = await import("./audience-timeline");
  const lib = await import("../lib/audience-timeline");
  generateAudienceToken = lib.generateAudienceToken;
  hashAudienceToken = lib.hashAudienceToken;

  const baseline = readFileSync(
    new URL("../../../../drizzle-timeline/0000_timeline_baseline.sql", import.meta.url),
    "utf8",
  );
  // The baseline file is one DDL batch. Drizzle's statement breakpoint is the
  // documented split marker for this repo's runner; semicolons are not.
  for (const statement of baseline.split("--> statement-breakpoint")) {
    const trimmed = statement.trim();
    if (!trimmed) continue;
    await run(trimmed);
  }
});

test("the Timeline baseline gives us the three tables the boundary depends on", async () => {
  const tables = await dbModule.db.all<{ name: string }>(
    (await import("drizzle-orm")).sql`
      SELECT name FROM sqlite_master WHERE type = 'table'
    `,
  );
  const names = new Set(tables.map((row) => row.name));
  for (const required of [
    "timeline_publications",
    "timeline_publication_items",
    "audience_shares",
  ]) {
    assert.ok(names.has(required), `missing table: ${required}`);
  }
});

test("an unpublished planning Timeline never resolves, even to a valid token holder", async () => {
  const rawToken = generateAudienceToken();
  const tokenHash = hashAudienceToken(rawToken);

  await run(`
    INSERT INTO timeline_publications
      (id, workspace_slug, source_workspace_id, source_object_id, source_revision,
       source_digest, label, primary_date_label, primary_date, audience_kind,
       timezone, owner_display_label, state, last_updated_at, created_at, updated_at)
    VALUES
      ('${PUBLICATION_ID}', '${WORKSPACE_SLUG}', 'ws-tasks-1', 'selection:1', 1,
       'digest-1', 'Our wedding', 'The day', '2027-06-19', 'couple',
       'Europe/Dublin', 'Mara and Finn', 'draft',
       unixepoch(), unixepoch(), unixepoch())
  `);
  await run(`
    INSERT INTO timeline_publication_items
      (public_id, publication_id, title, calendar_date, state, sort_order,
       source_relation, source_digest, copied_at, updated_at)
    VALUES
      ('item-1', '${PUBLICATION_ID}', 'Book the celebrant', '2026-11-02', 'next', 0,
       'ms-ws-tasks-1-t1', 'digest-item-1', unixepoch(), unixepoch())
  `);
  // A share row that is active and unexpired in every respect. The only thing
  // standing between the bearer and the couple's private plan is the
  // publication state, which is exactly what this test exists to pin.
  await run(`
    INSERT INTO audience_shares
      (id, publication_id, token_hash, state, version, created_at, visit_count)
    VALUES
      ('share-1', '${PUBLICATION_ID}', '${tokenHash}', 'active', 1, unixepoch(), 0)
  `);

  const result = await audience.resolveAudienceTimeline(rawToken);
  assert.equal(result.kind, "unpublished");
  assert.ok(!("dto" in result), "an unpublished publication must carry no DTO");
});

test("publishing is the only thing that opens the boundary", async () => {
  const rawToken = generateAudienceToken();
  await run(
    `UPDATE audience_shares SET token_hash = '${hashAudienceToken(rawToken)}' WHERE id = 'share-1'`,
  );
  await setPublicationState("published");

  const result = await audience.resolveAudienceTimeline(rawToken);
  assert.equal(result.kind, "ok");
  assert.ok("dto" in result);
});

test("unpublishing closes it again for the same token", async () => {
  const rawToken = generateAudienceToken();
  await run(
    `UPDATE audience_shares SET token_hash = '${hashAudienceToken(rawToken)}' WHERE id = 'share-1'`,
  );
  await setPublicationState("published");
  assert.equal((await audience.resolveAudienceTimeline(rawToken)).kind, "ok");

  await setPublicationState("unpublished");
  const closed = await audience.resolveAudienceTimeline(rawToken);
  assert.equal(closed.kind, "unpublished");
  assert.ok(!("dto" in closed));
});

test("the published projection carries presentation fields only", async () => {
  const rawToken = generateAudienceToken();
  await run(
    `UPDATE audience_shares SET token_hash = '${hashAudienceToken(rawToken)}' WHERE id = 'share-1'`,
  );
  await setPublicationState("published");

  const result = await audience.resolveAudienceTimeline(rawToken);
  assert.equal(result.kind, "ok");
  if (result.kind !== "ok") return;

  const serialised = JSON.stringify(result.dto);
  // Nothing that identifies the couple's private plan, its source workspace,
  // its provenance, or the sponsoring venue may cross this boundary.
  for (const forbidden of [
    "sourceWorkspaceId",
    "source_workspace_id",
    "sourceRelation",
    "source_relation",
    "sourceDigest",
    "workspaceSlug",
    "workspace_slug",
    "ownerUserId",
    "ownerEmail",
    "sponsor",
    "ws-tasks-1",
    WORKSPACE_SLUG,
    "ms-ws-tasks-1-t1",
    "digest-item-1",
  ]) {
    assert.ok(
      !serialised.includes(forbidden),
      `the audience DTO leaked "${forbidden}"`,
    );
  }

  const item = result.dto.sections[0]?.items[0];
  assert.ok(item, "expected at least one published item");
  assert.deepEqual(
    Object.keys(item).sort(),
    ["date", "publicId", "state", "title"],
    "an audience item may carry exactly these four keys",
  );
});

test("a revoked share cannot re-open a published Timeline", async () => {
  const rawToken = generateAudienceToken();
  await run(
    `UPDATE audience_shares SET token_hash = '${hashAudienceToken(rawToken)}', state = 'revoked' WHERE id = 'share-1'`,
  );
  await setPublicationState("published");

  const result = await audience.resolveAudienceTimeline(rawToken);
  assert.notEqual(result.kind, "ok");
  assert.ok(!("dto" in result));

  await run(`UPDATE audience_shares SET state = 'active' WHERE id = 'share-1'`);
});

test("no venue-facing egress in this app reads any Timeline table", () => {
  // The one production route a sponsoring venue's data reaches the app
  // through. If a Timeline read ever appears here, the boundary is gone.
  const partnerStats = readFileSync(
    new URL("../../../app/api/internal/partner-stats/route.ts", import.meta.url),
    "utf8",
  );
  for (const forbidden of [
    "timeline",
    "Timeline",
    "publication",
    "audienceShares",
    "workspaceSlug",
    "tasks",
  ]) {
    assert.ok(
      !partnerStats.includes(forbidden),
      `partner-stats referenced "${forbidden}"`,
    );
  }
  // Positive statement of what it does return, so a future widening is loud.
  for (const allowed of [
    "codesRedeemed",
    "redeemed30d",
    "reachedBoard",
    "mostRecentRedemptionAt",
  ]) {
    assert.ok(partnerStats.includes(allowed));
  }
});
