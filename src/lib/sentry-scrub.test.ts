import { test } from "node:test";
import assert from "node:assert/strict";
import type { ErrorEvent, EventHint } from "@sentry/nextjs";
import { redactSensitiveUrl, scrubEvent } from "./sentry-scrub";

test("bearer routes and OAuth query values are redacted", () => {
  assert.equal(
    redactSensitiveUrl(
      "https://tasks.test/share/raw-secret?code=oauth-code&state=state-secret",
    ),
    "https://tasks.test/share/[redacted]?code=[redacted]&state=[redacted]",
  );
  assert.equal(
    redactSensitiveUrl("https://tasks.test/redeem/GIFT-SECRET"),
    "https://tasks.test/redeem/[redacted]",
  );
});

test("Sentry scrub removes token/code keys and bearer values across payload surfaces", () => {
  const event = {
    request: { url: "https://tasks.test/invite/invite-secret?token=query-secret" },
    tags: { action: "redeem", code: "GIFT-SECRET", shareToken: "share-secret" },
    extra: { safe: "keep", nested: { token: "drop", url: "/share/path-secret" } },
    contexts: { activation: { code: "drop", status: "active" } },
    message: "token=message-secret",
    breadcrumbs: [
      { data: { url: "https://tasks.test/share/crumb-secret", token: "drop" } },
    ],
  } as unknown as ErrorEvent;
  const scrubbed = scrubEvent(event, {} as EventHint)!;
  const serialized = JSON.stringify(scrubbed);
  for (const secret of [
    "invite-secret",
    "query-secret",
    "GIFT-SECRET",
    "share-secret",
    "path-secret",
    "message-secret",
    "crumb-secret",
  ]) {
    assert.equal(serialized.includes(secret), false);
  }
  assert.equal(scrubbed.tags?.action, "redeem");
  assert.equal(scrubbed.extra?.safe, "keep");
});
