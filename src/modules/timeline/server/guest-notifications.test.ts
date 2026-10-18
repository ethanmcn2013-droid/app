import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync, mkdirSync, mkdtempSync } from "node:fs";
import path from "node:path";
import { tmpdir } from "node:os";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { eq } from "drizzle-orm";
import * as schema from "./db/timeline-schema";
import { createGuestNotificationTransport, dispatchDueGuestNotifications, enqueuePublishedGuestUpdate, scheduleGuestReminders,
  type GuestNotificationTransport } from "./guest-notifications";

const now = new Date("2026-11-01T12:00:00Z");
const links = { deliveryLink: ({ subscriptionId, purpose }: { subscriptionId: string; purpose: string }) =>
  `https://example.invalid/s/follow/${purpose}?proof=synthetic-${subscriptionId}` };
async function fixture() {
  const root = process.platform === "win32" ? "D:/Codex-scratch/project-ping/timeline-master3-notifications-tests-oct18"
    : path.join(tmpdir(), "timeline-guest-notification-tests");
  mkdirSync(root, { recursive: true });
  const directory = mkdtempSync(path.join(root, "case-"));
  const client = createClient({ url: `file:${path.join(directory, "timeline.sqlite").replaceAll("\\", "/")}` });
  for (const file of ["0000_timeline_baseline.sql", "0001_suite_project_bindings.sql", "0002_master3_presentation.sql"])
    await client.executeMultiple(readFileSync(`drizzle-timeline/${file}`, "utf8"));
  const db = drizzle(client, { schema });
  await db.insert(schema.timelinePublications).values({ id: "publication", workspaceSlug: "synthetic", sourceWorkspaceId: "tasks-synthetic",
    sourceDigest: "a".repeat(64), label: "Invented event", audienceKind: "couple", timezone: "Europe/Dublin", state: "published", primaryDate: "2026-12-01" });
  await db.insert(schema.audienceShares).values({ id: "share", publicationId: "publication", tokenHash: "b".repeat(64) });
  await db.insert(schema.timelineGuestSubscriptions).values({ id: "subscriber", publicationId: "publication", shareTokenHash: "b".repeat(64),
    email: "invented@example.invalid", emailHash: "c".repeat(64), state: "confirmed", confirmedAt: new Date("2026-10-01Z"), deliveryState: "sent" });
  return { client, db,
    enqueue: (eventKey = "revision1", kind: "update" | "date_change" | "photos" = "update") => db.transaction(tx =>
      enqueuePublishedGuestUpdate(tx, { publicationId: "publication", eventKey, kind, now }), { behavior: "immediate" }),
    rows: () => db.select().from(schema.timelineGuestDeliveries),
    dispatch: (transport: GuestNotificationTransport, time = now, authorize = async () => true) =>
      dispatchDueGuestNotifications({ database: db, transport, links, authorize, now: time }) };
}
const transport = (send: GuestNotificationTransport["send"]): GuestNotificationTransport => ({ configured: true, send });

test("the existing email adapter requires actual configuration and never accepts its development shim", async () => {
  let calls = 0;
  const payload = { to: "invented@example.invalid", subject: "Synthetic", text: "Synthetic", html: "Synthetic" };
  const missing = await createGuestNotificationTransport({ emailConfigured: false, resend: null,
    sendEmail: async () => { calls++; return { ok: true, id: "dev-no-resend" }; } });
  assert.equal(missing.configured, false); assert.equal((await missing.send(payload)).state, "failed"); assert.equal(calls, 0);
  const shim = await createGuestNotificationTransport({ emailConfigured: true, resend: {},
    sendEmail: async () => { calls++; return { ok: true, id: "dev-no-resend" }; } });
  assert.equal((await shim.send(payload)).state, "unknown");
  const accepted = await createGuestNotificationTransport({ emailConfigured: true, resend: {},
    sendEmail: async () => { calls++; return { ok: true, id: "synthetic-provider-id" }; } });
  assert.deepEqual(await accepted.send(payload), { state: "sent", providerMessageId: "synthetic-provider-id" });
  assert.equal(calls, 2);
});

test("real SQLite future reminders and public ForYou snapshots are durable, exact and idempotent", async () => {
  const f = await fixture(); try {
    await f.db.insert(schema.timelinePublicationItems).values({ publicId: "public-item", publicationId: "publication", title: "Public For you item",
      calendarDate: "2026-11-08", state: "next", sourceRelation: "private-source-never-emailed", sourceDigest: "d".repeat(64) });
    await f.db.insert(schema.timelinePublicationPresentation).values({ publicationId: "publication", settingsJson: { items: { "public-item": { forYou: true } } } });
    assert.deepEqual(await scheduleGuestReminders(f.db, now), { inserted: 4, unavailablePublications: 0 });
    assert.equal((await scheduleGuestReminders(f.db, now)).inserted, 0);
    let calls = 0;
    const first = await f.dispatch(transport(async message => {
      calls++; assert.equal(message.to, "invented@example.invalid"); assert.match(message.text, /Unsubscribe: https:/);
      assert.doesNotMatch(message.text, /private-source|tasks-synthetic|bbbbbbbb/);
      return { state: "sent", providerMessageId: `provider-${calls}` };
    }));
    assert.equal(first.sent, 2); assert.equal(calls, 2);
    assert.equal((await f.dispatch(transport(async () => { throw Error("duplicate"); }))).sent, 0);
    assert.equal((await f.rows()).filter(row => row.status === "pending").length, 2);
  } finally { f.client.close(); }
});

test("published update fan-out excludes unconfirmed and revoked subscribers, without a 1000-row truncation", async () => {
  const f = await fixture(); try {
    await f.db.insert(schema.timelineGuestSubscriptions).values({ id: "pending", publicationId: "publication", shareTokenHash: "b".repeat(64), email: "pending@example.invalid", emailHash: "e".repeat(64) });
    await f.client.execute(`WITH RECURSIVE n(i) AS(SELECT 1 UNION ALL SELECT i+1 FROM n WHERE i<1001)
      INSERT INTO timeline_guest_subscriptions(id,publication_id,share_token_hash,email,email_hash,state,confirmed_at,delivery_state)
      SELECT 'extra-'||i,'publication','${"b".repeat(64)}','invented'||i||'@example.invalid','hash-'||i,'confirmed',1,'sent' FROM n`);
    assert.equal(await f.enqueue(), 1002); assert.equal(await f.enqueue(), 0);
    await f.db.update(schema.timelinePublications).set({ state: "draft" });
    assert.equal(await f.enqueue("preview-must-not-notify"), 0);
    assert.equal((await f.rows()).length, 1002);
  } finally { f.client.close(); }
});

test("unsubscribe, original share rotation/expiry, unpublication and source authorization suppress dispatch", async () => {
  const f = await fixture(); try {
    const checks = [
      async () => f.db.update(schema.timelineGuestSubscriptions).set({ state: "unsubscribed" }),
      async () => { await f.db.update(schema.timelineGuestSubscriptions).set({ state: "confirmed" }); await f.db.update(schema.audienceShares).set({ state: "rotated" }); },
      async () => f.db.update(schema.audienceShares).set({ state: "active", expiresAt: now }),
      async () => { await f.db.update(schema.audienceShares).set({ expiresAt: null }); await f.db.update(schema.timelinePublications).set({ state: "unpublished" }); },
    ];
    let calls = 0;
    for (let index = 0; index < checks.length; index++) {
      await f.db.update(schema.timelineGuestSubscriptions).set({ state: "confirmed" });
      await f.db.update(schema.audienceShares).set({ state: "active", expiresAt: null });
      await f.db.update(schema.timelinePublications).set({ state: "published" });
      await f.enqueue(`check-${index}`); await checks[index]();
      assert.equal((await f.dispatch(transport(async () => { calls++; return { state: "sent", providerMessageId: "must-not" }; }))).suppressed, 1);
    }
    await f.db.update(schema.timelinePublications).set({ state: "published" }); await f.enqueue("source-denied");
    assert.equal((await f.dispatch(transport(async () => { calls++; return { state: "sent", providerMessageId: "must-not" }; }), now, async () => false)).suppressed, 1);
    await f.enqueue("unsubscribe-after-source-check");
    const staleAuthority = async () => { await f.db.update(schema.timelineGuestSubscriptions).set({ state: "unsubscribed" }); return true; };
    assert.equal((await f.dispatch(transport(async () => { calls++; return { state: "sent", providerMessageId: "must-not" }; }), now, staleAuthority)).suppressed, 1);
    assert.equal(calls, 0);
  } finally { f.client.close(); }
});

test("unconfigured transport is inert; lost replies, dev shim and absent provider IDs stay unknown without replay", async () => {
  const f = await fixture(); try {
    await f.enqueue("one"); await f.enqueue("two", "date_change"); await f.enqueue("three", "photos");
    const unavailable = await f.dispatch({ configured: false, send: async () => { throw Error("not configured"); } });
    assert.equal(unavailable.configured, false); assert.ok((await f.rows()).every(row => row.status === "pending"));
    let calls = 0;
    const result = await f.dispatch(transport(async () => { calls++; if (calls === 1) throw Error("response lost");
      return { state: "sent", providerMessageId: calls === 2 ? undefined : "dev-no-resend" }; }));
    assert.equal(result.unknown, 3); assert.equal(calls, 3);
    await f.dispatch(transport(async () => { calls++; return { state: "sent", providerMessageId: "duplicate" }; }));
    assert.equal(calls, 3); assert.ok((await f.rows()).every(row => row.status === "unknown" && row.sentAt === null));
    await f.enqueue("definite-rejection"); assert.equal((await f.dispatch(transport(async () => ({ state: "failed" })))).failed, 1);
  } finally { f.client.close(); }
});

test("a receipt transaction failure after physical acceptance retains unknown claim and cannot resend", async () => {
  const f = await fixture(); try {
    await f.enqueue();
    await f.client.execute("CREATE TRIGGER receipt_failure BEFORE UPDATE ON timeline_guest_deliveries WHEN NEW.status='sent' BEGIN SELECT RAISE(ABORT,'synthetic receipt failure'); END");
    let calls = 0;
    assert.equal((await f.dispatch(transport(async () => { calls++; return { state: "sent", providerMessageId: "accepted-original" }; }))).unknown, 1);
    assert.equal((await f.rows())[0].status, "unknown");
    await f.client.execute("DROP TRIGGER receipt_failure");
    await f.dispatch(transport(async () => { calls++; return { state: "sent", providerMessageId: "duplicate" }; }));
    assert.equal(calls, 1);
  } finally { f.client.close(); }
});

test("date changes and removal of public ForYou flags suppress stale queued reminders", async () => {
  const f = await fixture(); try {
    await f.db.insert(schema.timelinePublicationItems).values({ publicId: "for-you", publicationId: "publication", title: "Public For you item",
      calendarDate: "2026-11-08", state: "next", sourceRelation: "source-for-you", sourceDigest: "d".repeat(64) });
    await f.db.insert(schema.timelinePublicationPresentation).values({ publicationId: "publication", settingsJson: { items: { "for-you": { forYou: true } } } });
    assert.equal((await scheduleGuestReminders(f.db, now)).inserted, 4);
    await f.db.update(schema.timelinePublications).set({ primaryDate: "2026-12-15" });
    await f.db.update(schema.timelinePublicationPresentation).set({ settingsJson: {} });
    let calls = 0;
    assert.equal((await f.dispatch(transport(async () => { calls++; return { state: "sent", providerMessageId: "wrong-date" }; }))).suppressed, 2);
    assert.equal(calls, 0); assert.equal((await scheduleGuestReminders(f.db, now)).inserted, 3);
    const later = new Date("2026-11-25T12:00:00Z");
    // Old 7-day window has passed. It is never misrepresented as still seven days away.
    await f.dispatch(transport(async () => { calls++; return { state: "sent", providerMessageId: "late" }; }), later);
    assert.equal(calls, 0);
  } finally { f.client.close(); }
});

test("explicit undated final does not borrow primary date; Dublin DST schedules local calendar midnight", async () => {
  const f = await fixture(); try {
    await f.db.insert(schema.timelinePublicationItems).values({ publicId: "final", publicationId: "publication", title: "Explicit undated final",
      state: "next", sourceRelation: "source-final", sourceDigest: "f".repeat(64) });
    await f.db.insert(schema.timelinePublicationPresentation).values({ publicationId: "publication", settingsJson: { items: { final: { final: true } } } });
    assert.equal((await scheduleGuestReminders(f.db, now)).inserted, 0);
    await f.db.delete(schema.timelinePublicationPresentation);
    await f.db.update(schema.timelinePublications).set({ primaryDate: "2026-11-24" });
    await scheduleGuestReminders(f.db, new Date("2026-10-24T12:00:00Z"));
    assert.equal((await f.rows()).find(row => row.kind === "final30")?.dueAt.toISOString(), "2026-10-24T23:00:00.000Z");
  } finally { f.client.close(); }
});

test("expired durable sending claims become unknown and are never replacements; caller bounds are enforced", async () => {
  const f = await fixture(); try {
    await f.enqueue();
    await f.db.update(schema.timelineGuestDeliveries).set({ status: "sending", claimedAt: new Date(now.getTime() - 11 * 60_000), attemptId: "original-attempt" });
    let calls = 0; await f.dispatch(transport(async () => { calls++; return { state: "sent", providerMessageId: "duplicate" }; }));
    assert.equal(calls, 0); assert.equal((await f.rows())[0].status, "unknown");
    await assert.rejects(dispatchDueGuestNotifications({ database: f.db, transport: transport(async () => ({ state: "unknown" })),
      links, authorize: async () => true, limit: 51 }), /Invalid dispatch bound/);
    assert.equal((await f.db.select().from(schema.timelineGuestSubscriptions).where(eq(schema.timelineGuestSubscriptions.id, "subscriber")))[0].state, "confirmed");
  } finally { f.client.close(); }
});

test("a share expiring during source authorization is rechecked at physical dispatch", async () => {
  const f = await fixture(); try {
    await f.enqueue();
    await f.db.update(schema.audienceShares).set({ expiresAt: new Date(now.getTime() + 1000) });
    let instant = now, calls = 0;
    const result = await dispatchDueGuestNotifications({ database: f.db, links, clock: () => instant,
      authorize: async () => { instant = new Date(now.getTime() + 2000); return true; },
      transport: transport(async () => { calls++; return { state: "sent", providerMessageId: "expired" }; }) });
    assert.equal(result.suppressed, 1); assert.equal(calls, 0);
  } finally { f.client.close(); }
});

for (const audienceSize of [21, 1002]) {
  test(`${audienceSize} reminder recipients make bounded progress across same-day wakes without replay or bystander changes`, async () => {
    const f = await fixture(); try {
      await f.client.execute({ sql: `WITH RECURSIVE n(i) AS(SELECT 1 UNION ALL SELECT i+1 FROM n WHERE i<?)
        INSERT INTO timeline_guest_subscriptions(id,publication_id,share_token_hash,email,email_hash,state,confirmed_at,delivery_state)
        SELECT 'scale-'||i,'publication',?,'scale'||i||'@example.invalid','scale-hash-'||i,'confirmed',1,'sent' FROM n`,
        args: [audienceSize - 1, 'b'.repeat(64)] });
      await f.db.insert(schema.timelineGuestSubscriptions).values({ id: 'bystander', publicationId: 'publication',
        shareTokenHash: 'b'.repeat(64), email: 'unconfirmed@example.invalid', emailHash: 'untouched', state: 'pending' });
      const beforeSubscriptions = await f.db.select().from(schema.timelineGuestSubscriptions);
      assert.equal((await scheduleGuestReminders(f.db, now)).inserted, audienceSize * 3);
      const calls = new Map<string, number>(); let wakes = 0, totalSent = 0, totalUnknown = 0;
      const sender = transport(async message => {
        assert.notEqual(message.to, 'unconfirmed@example.invalid');
        calls.set(message.to, (calls.get(message.to) ?? 0) + 1);
        if (message.to === 'invented@example.invalid') return { state: 'unknown' };
        return { state: 'sent', providerMessageId: `scale-provider-${calls.size}` };
      });
      for (; wakes < Math.ceil(audienceSize / 20); wakes++) {
        const wake = new Date(now.getTime() + wakes * 5 * 60_000);
        assert.equal((await scheduleGuestReminders(f.db, wake)).inserted, 0);
        const result = await f.dispatch(sender, wake);
        assert.equal(result.suppressed, 0); assert.equal(result.failed, 0);
        assert.equal(result.sent + result.unknown, Math.min(20, audienceSize - wakes * 20));
        totalSent += result.sent; totalUnknown += result.unknown;
        const rows = await f.rows();
        assert.equal(rows.filter(row => row.kind === 'final30' && row.status === 'pending').length,
          Math.max(0, audienceSize - (wakes + 1) * 20));
        assert.equal(rows.filter(row => row.kind !== 'final30' && row.status === 'pending').length, audienceSize * 2);
      }
      assert.equal(totalSent, audienceSize - 1); assert.equal(totalUnknown, 1);
      assert.equal(calls.size, audienceSize); assert.ok([...calls.values()].every(count => count === 1));
      const extra = await f.dispatch(sender, new Date(now.getTime() + wakes * 5 * 60_000));
      assert.equal(extra.sent + extra.unknown + extra.suppressed + extra.failed, 0);
      assert.equal(calls.size, audienceSize);
      assert.deepEqual(await f.db.select().from(schema.timelineGuestSubscriptions), beforeSubscriptions);
      const rows = await f.rows();
      assert.equal(rows.filter(row => row.status === 'unknown').length, 1);
      assert.equal(rows.filter(row => row.status === 'sent').length, audienceSize - 1);
      assert.ok(rows.filter(row => row.status === 'sent').every(row => row.attemptId && row.providerMessageId && row.sentAt));
    } finally { f.client.close(); }
  });
}

test('a bounded backlog is suppressed if the physical dispatch clock crosses the reminder calendar cutoff', async () => {
  const f = await fixture(); try {
    const beforeCutoff = new Date('2026-11-01T23:59:59Z');
    await scheduleGuestReminders(f.db, beforeCutoff);
    let instant = beforeCutoff, calls = 0;
    const result = await dispatchDueGuestNotifications({ database: f.db, links, clock: () => instant,
      authorize: async () => { instant = new Date('2026-11-02T00:00:00Z'); return true; },
      transport: transport(async () => { calls++; return { state: 'sent', providerMessageId: 'too-late' }; }) });
    assert.equal(result.suppressed, 1); assert.equal(calls, 0);
    const rows = await f.rows();
    assert.equal(rows.find(row => row.kind === 'final30')?.status, 'suppressed');
    assert.equal(rows.filter(row => row.status === 'pending').length, 2);
  } finally { f.client.close(); }
});
