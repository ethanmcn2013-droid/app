import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const route = fs.readFileSync(new URL("../app/api/cron/outbox/route.ts", import.meta.url), "utf8");

test("outbox worker is cron-authenticated, signed, bounded, and idempotent", () => {
  assert.match(route, /CRON_SECRET/);
  assert.match(route, /OUTBOX_DELIVERY_SECRET/);
  assert.match(route, /AbortSignal\.timeout\(2_000\)/);
  assert.match(route, /listPendingOutbox\(50\)/);
  assert.match(route, /markOutboxDelivered/);
  assert.match(route, /x-signal-event-signature/);
});
