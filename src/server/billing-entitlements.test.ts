import { before, test } from "node:test";
import assert from "node:assert/strict";
import { freshMemoryDb } from "./db/memory-test-db";
import { entitlements } from "./db/schema";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as sharedSchema from "../lib/entitlements-shared/schema";
import { writeSharedEntitlement } from "../lib/entitlements-shared/writes";

let grant: typeof import("./billing-entitlements").grantEntitlement;
before(async () => {
  // The production module's unused default DB is confined to memory too.
  process.env.NEXT_PUBLIC_SIGNAL_ACCESS_MODE = "review";
  process.env.NEXT_PUBLIC_SIGNAL_DEPLOYMENT_ENV = "preview";
  grant = (await import("./billing-entitlements")).grantEntitlement;
});

const purchase = {
  userId: "buyer-fixture", workspaceId: "project-fixture", tier: "event" as const,
  source: "purchase" as const, durationDays: null, notes: "stripe:cs_fixture",
  expiresAt: new Date("2028-01-21T12:00:00Z"),
};

test("a failed shared write stays retryable without extending or duplicating local access", async () => {
  const { db, client } = await freshMemoryDb();
  try {
    await assert.rejects(grant(purchase, { database: db, mirror: async () => { throw new Error("offline"); } }), /pending/);
    assert.equal((await db.select().from(entitlements)).length, 1);
    let mirroredExpiry: number | null | undefined;
    await grant({ ...purchase, expiresAt: new Date("2030-01-01Z") }, {
      database: db, mirror: async input => { mirroredExpiry = input.expiresAtMs; return { id: "shared", created: true }; },
    });
    assert.equal(mirroredExpiry, purchase.expiresAt.getTime());
    assert.equal((await db.select().from(entitlements)).length, 1);
  } finally { client.close(); }
});

test("concurrent deliveries insert one local row and cannot reassign its project", async () => {
  const { db, client } = await freshMemoryDb();
  try {
    const dependencies = { database: db, mirror: async () => ({ id: "shared", created: false }) };
    await Promise.all(Array.from({ length: 8 }, () => grant(purchase, dependencies)));
    assert.equal((await db.select().from(entitlements)).length, 1);
    await assert.rejects(grant({ ...purchase, workspaceId: "wrong-project" }, dependencies), /scope/);
    assert.equal((await db.select().from(entitlements))[0].workspaceId, purchase.workspaceId);
  } finally { client.close(); }
});

test("the actual shared writer serialises concurrent deliveries on its existing primary key", async () => {
  const client = createClient({ url: ":memory:" });
  try {
    await client.executeMultiple(`CREATE TABLE entitlements (
      id TEXT PRIMARY KEY, user_clerk_id TEXT NOT NULL, tier TEXT NOT NULL, source TEXT NOT NULL,
      source_ref TEXT, granted_at INTEGER DEFAULT 0, expires_at INTEGER, status TEXT NOT NULL,
      stripe_customer_id TEXT, stripe_subscription_id TEXT, metadata TEXT,
      created_at INTEGER DEFAULT 0, updated_at INTEGER DEFAULT 0
    )`);
    const database = drizzle(client, { schema: sharedSchema });
    const input = { userClerkId: "fixture", tier: "event" as const, source: "event_pass" as const, sourceRef: "cs_fixture" };
    const outcomes = await Promise.all(Array.from({ length: 8 }, () => writeSharedEntitlement(input, database)));
    assert.equal(outcomes.filter(result => result.created).length, 1);
    assert.equal(new Set(outcomes.map(result => result.id)).size, 1);
    assert.equal((await database.select().from(sharedSchema.entitlements)).length, 1);
  } finally { client.close(); }
});
