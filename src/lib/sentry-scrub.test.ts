import { test } from "node:test";
import assert from "node:assert/strict";
import type { ErrorEvent, EventHint } from "@sentry/nextjs";
import {
  redactSensitiveText,
  redactSensitiveUrl,
  scrubEvent,
} from "./sentry-scrub";

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

test("sensitive text catches provider JSON and authorization header strings", () => {
  const value = redactSensitiveText(
    `request failed: {"refresh_token":"opaque-refresh",` +
      `"client_secret":"opaque-client"}; authorization: Bearer opaque-bearer`,
  );
  for (const secret of ["opaque-refresh", "opaque-client", "opaque-bearer"]) {
    assert.equal(value.includes(secret), false, secret);
  }
  assert.match(value, /\[redacted\]/);
  assert.equal(
    redactSensitiveText("provider statusCode: 401; decode: failed"),
    "provider statusCode: 401; decode: failed",
  );
});

test("Sentry scrub recursively handles arrays, deep provider errors, and cycles", () => {
  const refresh = "1//0gABCDEFGHIJKLMNOPqrstuvwxyz0123456789";
  const access = "ya29.a0AfB_byABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  const clientSecret = "GOCSPX-abcdefghijklmnopqrstuvwxyz";
  const opaqueJsonToken = "opaque-json-refresh";
  const bearer = "opaque-bearer-value";
  const breadcrumbSecret = "opaque-breadcrumb-token";
  const depthSecret = "1//0gDEEPSECRET0123456789abcdefghijklmnopqrstuvwxyz";

  const providerError = Object.assign(
    new Error(`Google request failed for ${refresh}`),
    {
      config: {
        url: `https://oauth2.googleapis.com/token?access_token=${access}`,
        headers: { Authorization: `Bearer ${bearer}` },
        rawHeaders: [["authorization", `Bearer ${bearer}`]],
      },
      response: {
        statusCode: 401,
        data: [
          { refresh_token: opaqueJsonToken },
          `{"client_secret":"${clientSecret}"}`,
        ],
      },
    },
  );
  providerError.cause = new Error(`authorization: Bearer ${bearer}`);

  const cyclic: Record<string, unknown> = { safe: "still useful" };
  cyclic.self = cyclic;

  let deep: Record<string, unknown> = { message: depthSecret };
  for (let index = 0; index < 20; index += 1) {
    deep = { children: [deep] };
  }

  const event = {
    request: {
      url: `https://tasks.test/callback?code=${refresh}`,
      headers: { "x-provider-debug": access },
    },
    tags: { provider: "google", diagnostic: clientSecret },
    fingerprint: ["project-drive", refresh],
    extra: { providerError, cyclic },
    contexts: { provider: { attempts: [{ payload: deep }] } },
    breadcrumbs: [
      {
        message: "retrying provider request",
        data: {
          url: "https://tasks.test/api/drive/retry",
          attempts: [
            {
              message: `authorization: Bearer ${breadcrumbSecret}`,
              refreshToken: opaqueJsonToken,
            },
          ],
        },
      },
      {
        message: "drop this whole breadcrumb",
        data: { url: "https://api.stripe.com/v1/customers" },
      },
    ],
  } as unknown as ErrorEvent;

  const scrubbed = scrubEvent(event, {} as EventHint)!;
  const serialized = JSON.stringify(scrubbed);
  for (const secret of [
    refresh,
    access,
    clientSecret,
    opaqueJsonToken,
    bearer,
    breadcrumbSecret,
    depthSecret,
  ]) {
    assert.equal(serialized.includes(secret), false, `${secret.slice(0, 12)}… survived`);
  }

  assert.equal(scrubbed.breadcrumbs?.length, 1);
  assert.match(serialized, /\[circular\]/);
  assert.match(serialized, /\[truncated\]/);
  assert.equal(
    (
      scrubbed.extra?.providerError as {
        response?: { statusCode?: number };
      }
    ).response?.statusCode,
    401,
    "provider statusCode remains useful diagnostics rather than being mistaken for OAuth code",
  );
});
