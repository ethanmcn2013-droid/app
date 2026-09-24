import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";
import { withStudioHeartbeat } from "./ping-studio";

type Sent = { url: string; body: Record<string, unknown>; auth: string | null };
let sent: Sent[] = [];
const realFetch = globalThis.fetch;

beforeEach(() => {
  sent = [];
  process.env.STUDIO_CRON_PING_URL = "https://signalstudio.ie/api/internal/cron-ping";
  process.env.STUDIO_CRON_PING_SECRET = "test-secret";
  globalThis.fetch = (async (url: string, init?: RequestInit) => {
    sent.push({
      url: String(url),
      body: JSON.parse(String(init?.body)),
      auth: new Headers(init?.headers).get("authorization"),
    });
    return new Response(JSON.stringify({ ok: true }));
  }) as typeof fetch;
});

afterEach(() => {
  globalThis.fetch = realFetch;
  delete process.env.STUDIO_CRON_PING_URL;
  delete process.env.STUDIO_CRON_PING_SECRET;
});

const req = () => new Request("https://app.signalstudio.ie/api/cron/x");
const json = (body: unknown, status = 200) => async () =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

test("an unauthorised call never writes a heartbeat", async () => {
  const route = withStudioHeartbeat("app_analytics_snapshots", json({ ok: false, error: "unauthorized" }, 401));
  const res = await route(req());
  assert.equal(res.status, 401);
  assert.equal(sent.length, 0);
});

test("a flag-off skip is recorded as an ok run with its reason", async () => {
  const route = withStudioHeartbeat("app_drive_grant_repair", json({ ok: true, skipped: "flag-off" }));
  const res = await route(req());
  assert.deepEqual(await res.json(), { ok: true, skipped: "flag-off" });
  assert.equal(sent.length, 1);
  assert.equal(sent[0]!.auth, "Bearer test-secret");
  assert.equal(sent[0]!.body.source, "app_drive_grant_repair");
  assert.equal(sent[0]!.body.ok, true);
  assert.equal(sent[0]!.body.skipped, 1);
  assert.equal(sent[0]!.body.notes, "skipped: flag-off");
});

test("a run with failures is recorded as not ok with its count", async () => {
  const route = withStudioHeartbeat("app_analytics_snapshots", json({ ok: false, completed: 2, failed: 1 }));
  await route(req());
  assert.equal(sent[0]!.body.ok, false);
  assert.equal(sent[0]!.body.failed, 1);
  assert.equal(sent[0]!.body.notes, "http 200");
});

test("a thrown handler is recorded as failed and still throws", async () => {
  const route = withStudioHeartbeat("app_analytics_snapshots", async () => {
    throw new Error("boom");
  });
  await assert.rejects(route(req()), /boom/);
  assert.equal(sent.length, 1);
  assert.equal(sent[0]!.body.ok, false);
  assert.equal(sent[0]!.body.notes, "handler threw");
});

test("the secret is never sent off signalstudio.ie", async () => {
  process.env.STUDIO_CRON_PING_URL = "https://example.com/cron-ping";
  const route = withStudioHeartbeat("app_analytics_snapshots", json({ ok: true }));
  const res = await route(req());
  assert.equal(res.status, 200);
  assert.equal(sent.length, 0);
});
