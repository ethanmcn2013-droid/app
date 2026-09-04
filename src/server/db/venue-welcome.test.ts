import assert from "node:assert/strict";
import { before, test } from "node:test";
import { eq } from "drizzle-orm";
import { freshFileDb } from "./memory-test-db";
import { compCodes, entitlements } from "./schema";

let welcome: typeof import("./venue-welcome");
before(async () => {
  process.env.NEXT_PUBLIC_SIGNAL_ACCESS_MODE = "review";
  process.env.NEXT_PUBLIC_SIGNAL_DEPLOYMENT_ENV = "preview";
  welcome = await import("./venue-welcome");
});

async function fixture() {
  const f = await freshFileDb();
  const now = Date.now();
  for (const project of ["a", "b"]) {
    await f.db.insert(compCodes).values({ code: `SYNTHETIC-${project}`, tier: "wedding", durationDays: 548, quantity: 1,
      notes: JSON.stringify({ source_type: "venue_edition", sponsor_slug: project, sponsor_name: `Synthetic ${project}` }) });
    await f.db.insert(entitlements).values({ id: project, userId: "actor", workspaceId: project, tier: "wedding", source: "comp",
      notes: `comp:SYNTHETIC-${project}`, startedAt: new Date(now - (project === "a" ? 60_000 : 30_000)), expiresAt: new Date(now + 3600_000) });
  }
  return f;
}

test("existing-project welcome uses its exact project despite a newer grant elsewhere", async () => {
  const f = await fixture(); try {
    assert.equal((await welcome.detectVenueWelcome("actor", "a", f.db))?.sponsorSlug, "a");
    assert.equal((await welcome.detectVenueWelcome("actor", "b", f.db))?.sponsorSlug, "b");
    for (const project of ["missing", ""]) assert.equal(await welcome.detectVenueWelcome("actor", project, f.db), null);
    assert.equal(await welcome.detectVenueWelcome("stranger", "a", f.db), null);
    await f.db.update(entitlements).set({ workspaceId: null }).where(eq(entitlements.id, "a"));
    assert.equal(await welcome.detectVenueWelcome("actor", "a", f.db), null);
  } finally { f.cleanup(); }
});

test("expired, revoked and not-yet-started grants do not supply sponsor identity", async () => {
  const f = await fixture(); try {
    for (const expiresAt of [new Date(0), new Date(Date.now() - 60_000)]) {
      await f.db.update(entitlements).set({ expiresAt }).where(eq(entitlements.id, "a"));
      assert.equal(await welcome.detectVenueWelcome("actor", "a", f.db), null);
    }
    await f.db.update(entitlements).set({ expiresAt: null, startedAt: new Date(Date.now() + 60_000) }).where(eq(entitlements.id, "a"));
    assert.equal(await welcome.detectVenueWelcome("actor", "a", f.db), null);
  } finally { f.cleanup(); }
});

test("a first-view receipt touches only the active exact actor, project and code once", async () => {
  const f = await fixture(); try {
    await welcome.markVenueEntitlementReached("actor", "a", "SYNTHETIC-b", f.db);
    await welcome.markVenueEntitlementReached("stranger", "a", "SYNTHETIC-a", f.db);
    assert.ok((await f.db.select().from(entitlements)).every(row => row.reachedBoardAt === null));
    await welcome.markVenueEntitlementReached("actor", "a", "SYNTHETIC-a", f.db);
    const [first] = await f.db.select().from(entitlements).where(eq(entitlements.id, "a"));
    assert.ok(first.reachedBoardAt);
    await welcome.markVenueEntitlementReached("actor", "a", "SYNTHETIC-a", f.db);
    const rows = await f.db.select().from(entitlements);
    assert.equal(rows.find(row => row.id === "a")?.reachedBoardAt?.getTime(), first.reachedBoardAt.getTime());
    assert.equal(rows.find(row => row.id === "b")?.reachedBoardAt, null);
  } finally { f.cleanup(); }
});

test("revocation or a future start between lookup and first-view write prevents the receipt", async () => {
  const f = await fixture(); try {
    assert.ok(await welcome.detectVenueWelcome("actor", "a", f.db));
    await f.db.update(entitlements).set({ expiresAt: new Date(0) }).where(eq(entitlements.id, "a"));
    await welcome.markVenueEntitlementReached("actor", "a", "SYNTHETIC-a", f.db);
    await f.db.update(entitlements).set({ expiresAt: null, startedAt: new Date(Date.now() + 60_000) }).where(eq(entitlements.id, "b"));
    await welcome.markVenueEntitlementReached("actor", "b", "SYNTHETIC-b", f.db);
    assert.ok((await f.db.select().from(entitlements)).every(row => row.reachedBoardAt === null));
  } finally { f.cleanup(); }
});

test("measurement failures never log query parameters or a code", async () => {
  const messages: unknown[][] = [];
  const original = console.warn;
  console.warn = (...args) => { messages.push(args); };
  try {
    const database = { run: async () => { throw new Error("SQL contains SECRET-CODE and actor-id"); } } as unknown as Parameters<typeof welcome.markVenueEntitlementReached>[3];
    await welcome.markVenueEntitlementReached("actor-id", "a", "SECRET-CODE", database);
    assert.deepEqual(messages, [["[venue-welcome] first project view could not be recorded"]]);
  } finally { console.warn = original; }
});
