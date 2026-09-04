import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { ModuleKind, ScriptTarget, transpileModule } from "typescript";
import type { ErrorEvent, EventHint } from "@sentry/nextjs";
import { isAnalyticsExcludedPath } from "./public-analytics-boundary";
import {
  redactSensitiveText,
  redactSensitiveUrl,
  scrubEvent,
} from "./sentry-scrub";

type BeforeSend = (event: ErrorEvent, hint: EventHint) => Promise<ErrorEvent | null>;

// Execute the real entry with an isolated environment and a fake SDK. The
// CommonJS transform turns import() into a deferred require, so no telemetry
// dependency is imported and no provider call can escape these tests.
const clientEntry = transpileModule(
  readFileSync(new URL("../instrumentation-client.ts", import.meta.url), "utf8"),
  { compilerOptions: { module: ModuleKind.CommonJS, target: ScriptTarget.ES2020 } },
).outputText;

function runClientEntry({ dsn, pathname = "/app/settings", failImport = false }: {
  dsn?: string;
  pathname?: string;
  failImport?: boolean;
}) {
  const loaded: string[] = [];
  const initialized: Array<Record<string, unknown>> = [];
  const location = { pathname };
  const context = {
    window: { location },
    process: { env: { NEXT_PUBLIC_SENTRY_DSN: dsn, NEXT_PUBLIC_SENTRY_ENVIRONMENT: "test" } },
    require: (name: string) => {
      if (name === "@/lib/public-analytics-boundary") return { isAnalyticsExcludedPath };
      if (name === "@sentry/nextjs") return { init: (options: Record<string, unknown>) => initialized.push(options) };
      loaded.push(name);
      if (failImport) throw new Error("Synthetic unavailable chunk");
      if (name === "@/lib/sentry-scrub") return { scrubEvent };
      throw new Error(`Unexpected client entry import: ${name}`);
    },
  };
  runInNewContext(clientEntry, { ...context, exports: {} });
  return { loaded, initialized, location };
}

test("client reporting stays disabled with no DSN or on any protected public surface", () => {
  const disabled = runClientEntry({});
  const excluded = ["/p", "/p/example", "/s/token", "/share/token", "/embed/example"]
    .map((pathname) => runClientEntry({ dsn: "synthetic", pathname }));
  for (const result of [disabled, ...excluded]) {
    assert.deepEqual(result.loaded, []);
    assert.deepEqual(result.initialized, []);
  }
});

test("client error capture starts immediately but loads the scrubber only before sending", async () => {
  const result = runClientEntry({ dsn: "synthetic" });
  assert.deepEqual(result.loaded, [], "the scrubber must not be a synchronous root import");
  assert.equal(result.initialized.length, 1);
  const options = result.initialized[0];
  assert.equal(options.dsn, "synthetic");
  assert.equal(options.environment, "test");
  assert.equal(options.tracesSampleRate, 0.1);
  assert.equal(options.sendDefaultPii, false);
  const beforeSend = options.beforeSend as BeforeSend;
  const event = { message: "token=synthetic-secret", extra: { safe: "keep" } } as ErrorEvent;
  const pending = beforeSend(event, {} as EventHint);
  assert.deepEqual(result.loaded, [], "sending must await the deferred scrubber");
  assert.deepEqual(await pending, scrubEvent(event, {} as EventHint));
  assert.deepEqual(result.loaded, ["@/lib/sentry-scrub"]);
  assert.equal(JSON.stringify(await pending).includes("synthetic-secret"), false);
});

test("an unavailable scrubber drops the event without an unhandled rejection or unsafe send", async () => {
  const result = runClientEntry({ dsn: "synthetic", failImport: true });
  const beforeSend = result.initialized[0].beforeSend as BeforeSend;
  assert.equal(await beforeSend({ message: "token=must-not-send" } as ErrorEvent, {} as EventHint), null);
});

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
  assert.equal(
    redactSensitiveUrl(
      "https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&upload_id=opaque-session",
    ),
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&upload_id=[redacted]",
  );
});

test("Drive resumable capabilities are removed from fields, text, and breadcrumbs", () => {
  const uploadId = "opaque-upload-capability-123";
  const sessionUrl =
    `https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&upload_id=${uploadId}`;
  const event = {
    message: `retry failed at ${sessionUrl}`,
    extra: {
      sessionUrl,
      nested: [{ uploadUrl: sessionUrl }, { safeStatus: 308 }],
    },
    breadcrumbs: [{ data: { url: sessionUrl } }],
  } as unknown as ErrorEvent;

  const scrubbed = scrubEvent(event, {} as EventHint)!;
  const serialized = JSON.stringify(scrubbed);
  assert.equal(serialized.includes(uploadId), false);
  assert.equal(serialized.includes(sessionUrl), false);
  assert.equal(scrubbed.breadcrumbs?.length, 0);
  assert.equal(
    (scrubbed.extra?.nested as Array<Record<string, unknown>>)[1].safeStatus,
    308,
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
    extra: {
      providerError,
      cyclic,
      opaqueProviderContainer: new Map([["payload", refresh]]),
    },
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
  assert.match(serialized, /\[unsupported\]/);
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
