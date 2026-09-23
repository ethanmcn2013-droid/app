/* eslint-disable @typescript-eslint/no-require-imports -- Actual paired TS service/action fixtures with explicit I/O boundaries. */
const assert = require("node:assert/strict");
const { test } = require("node:test");
const path = require("node:path");
const { eq } = require("drizzle-orm");
const { usageFixture, SALT } = require("../sponsored-use/fixture.cjs");
const { eraseAccountData } = require("../account-erasure.ts");
const studioRoot = process.env.STUDIO_REPO_PATH;
if (!studioRoot || !path.isAbsolute(studioRoot)) throw new Error("Explicit local STUDIO_REPO_PATH required");
const { studioUsageFixture } = require(path.join(studioRoot, "src/lib/account/instrumentation/usage-fixture.cjs"));
const actor = { id: "rehearsal", name: "Synthetic operator" };
const title = "PRIVATE REHEARSAL TASK CONTENT";
const issuanceSecret = "synthetic-issuance-only-".repeat(3);
const usageSecret = "synthetic-usage-only-".repeat(3);

for (const plan of ["paid", "founding", "pilot"]) test(`real S2/S5 composition: ${plan}`, async t => {
  const app = await usageFixture({ seedClaim: false });
  const studio = await studioUsageFixture(studioRoot, { withVenue: true, seedSponsor: false });
  const originalClock = Date.now;
  const originalFetch = global.fetch;
  let now = Math.floor(originalClock() / 60_000) * 60_000 + 20_000;
  Date.now = () => now;
  global.fetch = async () => { throw new Error("External network forbidden in this rehearsal"); };
  let phase = "setup";
  const checks = [];
  async function check(name, fn) { phase = name; await fn(); checks.push(name); }
  const auth = app.load("src/lib/sponsored-use/service-auth.ts");
  const epoch = auth.hashEpoch(SALT);
  Object.assign(process.env, {
    NEXT_PUBLIC_SIGNAL_ACCESS_MODE: "review", NEXT_PUBLIC_SIGNAL_DEPLOYMENT_ENV: "preview",
    SIGNAL_HQ_OPERATORS: "rehearsal:Synthetic operator", SIGNAL_HQ_PASSWORD: "synthetic-rehearsal-hq-password",
    CRON_SECRET: "synthetic-rehearsal-cron-secret", SPONSOR_USAGE_EVENTS: "1", SPONSOR_USAGE_HASH_SALT: SALT,
    SPONSOR_USAGE_SERVICE_SECRET: usageSecret, SPONSOR_USAGE_ACCEPTED_EPOCHS: epoch,
    SPONSOR_USAGE_ENVIRONMENT: "internal_test", SPONSOR_USAGE_APP_ORIGIN: "http://app.test",
    SPONSOR_USAGE_STUDIO_ORIGIN: "http://studio.test", VENUE_ISSUANCE_ENABLED: "true",
    VENUE_ISSUANCE_ENVIRONMENT: "internal_test", VENUE_ISSUANCE_SECRET: issuanceSecret, VENUE_ISSUANCE_KEY_EPOCH: "rehearsal-1",
  });
  try {
    const store = studio.load("src/lib/venue-fulfilment/store.ts");
    const claim = app.load("src/server/db/comp-redemption.ts").claimCompEntitlement;
    const canonical = app.load("src/server/venue-issuance/canonical.ts");
    const appIssue = app.load("src/app/api/internal/venue-issuance/route.ts").POST;
    const appProof = app.load("src/app/api/internal/sponsored-use/provenance/route.ts").POST;
    const protocol = app.load("src/lib/venue-issuance/protocol.ts");
    const signing = app.load("src/lib/venue-issuance/service-auth.ts");
    const issuanceAuth = { secret: issuanceSecret, usageSecret, keyEpoch: "rehearsal-1" };
    const runtime = studio.load("src/lib/venue-fulfilment/transport.ts").createVenueRuntime({
      origin: "http://localhost", allowLocalTest: true, auth: issuanceAuth,
      fetcher: (url, init) => appIssue(new Request(String(url), init)),
    });
    let proofCalls = 0;
    studio.state.send = request => {
      assert.equal(new URL(request.url).origin, "http://app.test");
      proofCalls++;
      return appProof(request);
    };
    const ingest = studio.load("src/app/api/internal/sponsored-use/ingest/route.ts").POST;
    const erase = studio.load("src/app/api/internal/sponsored-use/erase/route.ts").POST;
    const delivery = app.load("src/server/sponsored-use/delivery.ts").deliverUsage;
    const sendUsage = request => new URL(request.url).pathname === auth.USAGE_PATHS.erase ? erase(request) : ingest(request);
    const deliver = (send = sendUsage) => delivery(app.db, {
      enabled: process.env.SPONSOR_USAGE_EVENTS === "1", studioOrigin: "http://studio.test", secret: usageSecret,
      issuanceSecret, now, send,
    });
    const issuanceId = "vi-" + ({ paid: "1", founding: "2", pilot: "3" }[plan]).repeat(32);
    const row = async () => (await studio.database.select().from(studio.schema.venueFulfilmentRequests))[0];
    let manifest, codes, claimed, baseline, event;
    await check("owning migration receipts and zero initial grants", async () => {
      const migrations = await studio.client.execute("SELECT id FROM signal_additive_migrations ORDER BY id");
      assert.deepEqual(migrations.rows.map(r => r.id), ["0001_venue_fulfilment", "0002_usage_delivery"]);
      assert.equal((await app.db.select().from(app.schema.entitlements)).length, 0);
      assert.equal((await app.counts()).sponsored_use_intents, 0);
    });
    await check("verified commercial eligibility and paired historical sponsor", async () => {
      await studio.database.insert(studio.schema.sponsors).values({ id: "shared-venue", slug: "synthetic", name: "Synthetic venue",
        contactEmail: "rehearsal@example.invalid", kind: "venue", venuePlan: plan, allotmentMode: plan === "pilot" ? "limited" : "unlimited",
        codeAllotment: plan === "pilot" ? 2 : null });
      await studio.studio.insert(studio.localSchema.sponsors).values({ id: "historical-local", slug: "synthetic", name: "Synthetic venue", contactEmail: "rehearsal@example.invalid" });
      assert.equal((await store.pairVenueSponsor(studio, "synthetic", actor)).studioSponsorId, "historical-local");
      await assert.rejects(store.allocateVenueIssuance(studio, { issuanceId, slug: "synthetic", count: 2, actor }, "internal_test"));
      if (plan === "pilot") {
        await studio.database.update(studio.schema.sponsors).set({ termStartsAt: now - 60_000, termEndsAt: now + 86400000 });
        await assert.rejects(store.allocateVenueIssuance(studio, { issuanceId, slug: "synthetic", count: 2, actor }, "internal_test"));
      } else {
        await studio.load("src/lib/entitlements-db/venue-payment.ts").recordVenuePayment({ slug: "synthetic", plan,
          reference: "synthetic-cleared-payment", paidAt: now - 60_000, amountCents: plan === "paid" ? 150000 : 100000,
          actorId: actor.id, actorName: actor.name }, studio);
      }
      manifest = await store.allocateVenueIssuance(studio, { issuanceId, slug: "synthetic", count: 2, actor,
        ...(plan === "pilot" ? { pilotReference: "synthetic-explicit-pilot" } : {}) }, "internal_test");
      assert.equal(manifest.eligibility.kind, plan === "paid" ? "standard" : plan);
      codes = await studio.database.select().from(studio.schema.licenseCodes);
      assert.equal(codes.length, 2);
    });
    await check("usage key cannot issue and lost issue acknowledgement stays pending", async () => {
      const command = { operation: "issue", manifest, codes: codes.map(c => ({ licenseCodeId: c.id, code: c.code })) };
      const body = JSON.stringify(command);
      const bad = await appIssue(new Request("http://localhost" + protocol.VENUE_ISSUANCE_PATH, { method: "POST", body,
        headers: signing.signIssuanceRequest(body, { ...issuanceAuth, secret: usageSecret, usageSecret: undefined }, now) }));
      assert.equal(bad.status, 401);
      assert.equal((await app.db.select().from(app.schema.compCodes)).length, 0);
      const lost = async (command, m) => { await runtime(command, m); throw new Error("Synthetic lost acknowledgement"); };
      assert.equal((await store.prepareVenuePacket(studio, issuanceId, lost, actor, "https://app.example.invalid")).ready, false);
      assert.equal((await row()).fulfilledAt, null);
      assert.equal((await app.db.select().from(app.schema.compCodes)).length, 2);
      const local = await studio.studio.select().from(studio.localSchema.licenseCodes);
      assert.equal(local.length, 2);
      assert.ok(local.every(c => c.sponsorId === "historical-local" && codes.some(other => c.id === other.id && c.code === other.code)));
    });
    await check("current manager guard, real atomic claim and same-code replay", async () => {
      const denied = await claim(app.db, { code: codes[0].code, actorUserId: "member", candidateProjectId: "a", now: new Date(now) });
      assert.equal(denied.ok, false);
      assert.equal((await app.db.select().from(app.schema.entitlements)).length, 0);
      assert.equal((await claim(app.db, { code: manifest.codes[0].codeFingerprint, actorUserId: "owner", candidateProjectId: "a", now: new Date(now) })).ok, false);
      now += 1000;
      claimed = await claim(app.db, { code: codes[0].code, actorUserId: "owner", candidateProjectId: "a", now: new Date(now) });
      assert.equal(claimed.ok, true);
      if (!claimed.ok) throw new Error("Owner claim refused");
      const afterClaim = await app.counts();
      const replay = await claim(app.db, { code: codes[0].code, actorUserId: "owner", candidateProjectId: "b", now: new Date(now + 500) });
      assert.ok(replay.ok && replay.entitlement.id === claimed.entitlement.id && replay.entitlement.workspaceId === "a" &&
        replay.entitlement.expiresAt.getTime() === claimed.entitlement.expiresAt.getTime());
      baseline = await app.counts();
      assert.deepEqual(baseline, afterClaim, "same-code replay cannot append starter work or usage");
      assert.equal(baseline.tasks, 18, "actual claim applied the retained wedding template once");
      assert.equal(baseline.sponsored_use_intents, 0, "template setup is not useful activation");
      assert.equal((await studio.database.select().from(studio.schema.entitlements)).length, 0, "no second positive grant writer");
    });
    await check("actual action rollback, persisted first-minute task and duplicate refusal", async () => {
      app.state.ambient = "b";
      await app.client.execute("CREATE TRIGGER fail_usage BEFORE INSERT ON sponsored_use_intents BEGIN SELECT RAISE(ABORT,'synthetic usage failure'); END");
      await assert.rejects(app.action({ id: "deliberate-task", title, projectId: "a" }));
      assert.deepEqual(await app.counts(), baseline);
      await app.client.execute("DROP TRIGGER fail_usage");
      now += 1000;
      await app.action({ id: "deliberate-task", title, projectId: "a" });
      const counts = await app.counts();
      assert.equal(counts.tasks, baseline.tasks + 1); assert.equal(counts.activities, baseline.activities + 1);
      assert.equal(counts.sponsored_use_intents, 1); assert.equal(counts.sponsored_use_subjects, 1);
      const [task] = await app.db.select().from(app.schema.tasks).where(eq(app.schema.tasks.id, "deliberate-task"));
      assert.ok(task.workspaceId === "a" && task.title === title);
      await assert.rejects(app.action({ id: "deliberate-task", title, projectId: "a" }));
      assert.deepEqual(await app.counts(), counts);
      const [intent] = await app.db.select().from(app.usageSchema.sponsoredUseIntents);
      event = JSON.parse(intent.payload);
      assert.deepEqual(Object.keys(event).sort(), ["eventId", "instrumentationVersion", "kind", "occurredAt", "product", "subjectIdHash", "workspaceIdHash"]);
      assert.ok(!intent.payload.includes(title) && !intent.payload.includes(codes[0].code) && !intent.payload.includes(manifest.codes[0].codeFingerprint));
      const proof = await canonical.readCanonicalVenueClaim(app.db, { entitlementId: claimed.entitlement.id });
      assert.ok(event.occurredAt < proof.grantStartsAt && intent.createdAt >= proof.grantStartsAt, "exercise real first-minute rounding boundary");
      assert.equal((await deliver()).failed, 1);
      assert.equal((await studio.database.select().from(studio.schema.sponsorUsageEvents)).length, 0);
      assert.equal((await app.db.select().from(app.usageSchema.sponsoredUseIntents))[0].deliveredAt, null);
    });
    await check("exact fulfilled readback precedes packet and authenticated useful-use delivery", async () => {
      const packet = await store.prepareVenuePacket(studio, issuanceId, runtime, actor, "https://app.example.invalid");
      assert.equal(packet.ready, true); assert.ok((await row()).fulfilledAt);
      assert.equal((await row()).deliveryState, "fulfilled");
      assert.ok(packet.packet && packet.packet.codes.length === 1 && packet.packet.codes[0].code === codes[1].code);
      assert.equal(packet.packet.codes[0].redeemUrl, "https://app.example.invalid/redeem/" + encodeURIComponent(codes[1].code));
      assert.equal(packet.packet.fulfilledReadbackAt, JSON.parse((await row()).readbackJson).checkedAt);
      assert.ok(!JSON.stringify(packet.packet).includes("codeFingerprint"));
      const support = await store.venueFulfilmentStatus(studio, issuanceId, actor);
      assert.equal(support.state, "fulfilled");
      assert.deepEqual(support.codes.map(code => code.lastObservedState), ["claimed", "available"]);
      assert.ok(codes.every(code => !JSON.stringify(support).includes(code.code)));
      assert.ok(!JSON.stringify(support).includes("codeFingerprint"));
      const lostUsageAck = async request => { const response = await sendUsage(request); assert.equal(response.status, 200); throw new Error("Synthetic lost usage acknowledgement"); };
      assert.equal((await deliver(lostUsageAck)).failed, 1);
      assert.equal((await app.db.select().from(app.usageSchema.sponsoredUseIntents))[0].deliveredAt, null);
      assert.equal((await studio.database.select().from(studio.schema.sponsorUsageEvents)).length, 1);
      for (const response of [new Response("<html>unrelated success</html>", {status:200}),
        new Response(null, {status:202}), Response.json({ok:false}), Response.json({ok:true,extra:"unexpected"})]) {
        const incomplete = await deliver(async () => response);
        assert.equal(incomplete.delivered, 0, "only the exact success acknowledgement may retire event custody");
        assert.equal(incomplete.failed, 1);
        assert.equal((await app.db.select().from(app.usageSchema.sponsoredUseIntents))[0].deliveredAt, null);
      }
      assert.equal((await deliver()).delivered, 1); assert.equal((await deliver()).delivered, 0);
      const [stored] = await studio.database.select().from(studio.schema.sponsorUsageEvents);
      assert.equal(stored.sponsorId, "shared-venue"); assert.equal(stored.attributionState, "attributed");
      assert.equal((await ingest(auth.signedUsageRequest("http://studio.test" + auth.USAGE_PATHS.ingest, event, usageSecret, epoch, now))).status, 200);
      assert.equal((await ingest(auth.signedUsageRequest("http://studio.test" + auth.USAGE_PATHS.ingest, { ...event, workspaceIdHash: "0".repeat(32) }, usageSecret, epoch, now))).status, 409);
      assert.equal((await studio.database.select().from(studio.schema.sponsorUsageEvents)).length, 1);
      assert.ok(proofCalls >= 3);
    });
    await check("closed-day rollup and entire authenticated HQ response suppress small-cohort behavior", async () => {
      now += 86400000 + 8 * 3600000;
      const cron = studio.load("src/app/api/cron/sponsored-use/route.ts").GET;
      assert.equal((await cron(new Request("http://studio.test/api/cron/sponsored-use", { headers: { authorization: "Bearer " + process.env.CRON_SECRET } }))).status, 200);
      const [daily] = await studio.database.select().from(studio.schema.sponsorUsageDaily);
      assert.equal(daily.meaningfulActions, 1); assert.equal(daily.eligibleWorkspaces, 1);
      assert.equal(daily.coverageMask, 2); assert.equal(daily.expectedMask, 15);
      const hq = studio.load("src/app/hq/account-review/actions.ts").loadLiveVenueSnapshotAction;
      await assert.rejects(hq("synthetic"), e => e.url?.startsWith("/hq/access"));
      studio.state.hqToken = await studio.load("src/lib/hq/auth.ts").createHqAccessToken();
      const result = await hq("synthetic"); assert.equal(result.ok, true);
      const publicSnapshot = JSON.stringify(result);
      assert.ok([title, "clerk-owner", codes[0].code, manifest.codes[0].codeFingerprint].every(value => !publicSnapshot.includes(value)));
      assert.equal(result.snapshot.adoption.activeRecently.state, "withheld");
      assert.ok(result.snapshot.coverage.daysCovered == null, "suppressed coverage must not disclose the observed day count");
      assert.ok(result.snapshot.coverage.modulesCovered == null, "suppressed coverage must not disclose observed module counts");
      assert.equal(result.snapshot.productReach.find(p => p.product === "Notes").workspacesReached.state, "unavailable");
      const download = studio.load("src/app/hq/account-review/download/route.ts").GET;
      const response = await download(new Request("http://studio.test/hq/account-review/download?source=live&venue=synthetic&format=csv"));
      assert.equal(response.status, 200); assert.equal(response.headers.get("cache-control"), "no-store");
      const body = await response.text();
      assert.ok([title, "clerk-owner", codes[0].code, manifest.codes[0].codeFingerprint].every(value => !body.includes(value)));
    });
    await check("claim-preserving withdrawal then real account erasure and sibling withdrawal", async () => {
      const preserved = await store.withdrawVenueCode(studio, issuanceId, codes[0].id, runtime, actor);
      assert.equal(preserved.withdrawal, "already_claimed");
      assert.equal((await app.db.select().from(app.schema.entitlements))[0].expiresAt.getTime(), claimed.entitlement.expiresAt.getTime());
      process.env.SPONSOR_USAGE_EVENTS = "0";
      await app.load("src/server/account-deletion-lifecycle.ts").beginAccountDeletionWith(app.db, "clerk-owner");
      await eraseAccountData(app.db, "clerk-owner", { deleteStoredBytes: async () => { throw new Error("Unexpected provider object"); } });
      assert.equal(await canonical.readCanonicalVenueClaim(app.db, { entitlementId: claimed.entitlement.id }), null);
      for (const response of [new Response("<html>unrelated success</html>", {status:200}),
        new Response(null, {status:202}), Response.json({ok:false}), Response.json({ok:true,extra:"unexpected"})]) {
        const incomplete = await deliver(async () => response);
        assert.equal(incomplete.delivered, 0, "only the exact success acknowledgement may retire erasure custody");
        assert.equal(incomplete.failed, 1);
      }
      assert.equal((await deliver()).delivered, 1);
      assert.equal((await studio.database.select().from(studio.schema.sponsorUsageEvents)).length, 0);
      assert.equal((await studio.database.select().from(studio.schema.sponsorWorkspaceLifecycle)).length, 0);
      assert.equal((await studio.database.select().from(studio.schema.sponsorUsageDaily)).length, 1);
      const withdrawn = await store.withdrawVenueCode(studio, issuanceId, codes[1].id, runtime, actor);
      assert.equal(withdrawn.withdrawal, "withdrawn");
      assert.equal((await app.db.select().from(app.schema.users).where(eq(app.schema.users.id, "outsider"))).length, 1);
      assert.equal((await claim(app.db, { code: codes[1].code, actorUserId: "outsider", candidateProjectId: "b", now: new Date(now) })).ok, false);
      assert.equal((await claim(app.db, { code: codes[0].code, actorUserId: "outsider", candidateProjectId: "b", now: new Date(now) })).ok, false);
      assert.equal((await app.db.select().from(app.schema.entitlements)).length, 0);
    });
    t.diagnostic(JSON.stringify({ plan, passed: checks.length, checks, stores: 3, templateTasks: baseline.tasks,
      persistedDeliberateTasks: 1, attributedEvents: 1, sharedPositiveGrants: 0, coverageMask: 2,
      expectedMask: 15, providers: false, network: "in-process authenticated Request/Response" }));
  } catch (error) {
    const message = String(error.message).replace(/VENUE-[A-Z0-9-]+/g, "[bearer redacted]").replace(/[a-f0-9]{64}/g, "[digest redacted]").replaceAll(title, "[private text redacted]");
    throw new Error(`Rehearsal failed at ${phase}: ${message}`);
  } finally { Date.now = originalClock; global.fetch = originalFetch; app.close(); studio.close(); }
});
