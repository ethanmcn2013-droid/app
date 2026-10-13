import assert from "node:assert/strict";
import test from "node:test";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";
import { localOperationRequestAllowed, validateLocalOperationRuntime, localFetchAllowed } from "./local-operation-policy";
function config(): Record<string, string | undefined> {
  const root = resolve("work/local-test");
  return { SIGNAL_LOCAL_TASK_OPERATIONS: "true", SIGNAL_LOCAL_TASK_EXPIRES_AT: new Date(Date.now() + 60000).toISOString(), SIGNAL_ACCESS_MODE: "production", NEXT_PUBLIC_SIGNAL_ACCESS_MODE: "production", SIGNAL_LOCAL_TASK_ORIGIN: "http://127.0.0.1:3188", SIGNAL_LOCAL_TASK_STORE_ROOT: root, SIGNAL_LOCAL_TASK_ISSUER: "https://fixture.clerk.accounts.dev", SIGNAL_LOCAL_TASK_SUBJECTS: "user_fixtureA,user_fixtureB", NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: "pk_test_fixture", CLERK_SECRET_KEY: "sk_test_fixture",
    SIGNAL_LOCAL_TASK_CLERK_ORIGINS: JSON.stringify(["https://fixture.clerk.accounts.dev", "https://api.clerk.com"]), ...Object.fromEntries(["TASKS", "NOTES", "TIMELINE", "SIGNAL", "ENTITLEMENTS"].map(module => [`${module}_DATABASE_URL`, pathToFileURL(resolve(root, `${module}.db`)).href])) };
}
test("default-off policy requires exact loopback and all five owned unique file stores", () => {
  assert.throws(() => validateLocalOperationRuntime({}));
  assert.doesNotThrow(() => validateLocalOperationRuntime(config()));
  for (const patch of [{ VERCEL: "1" }, { SIGNAL_LOCAL_TASK_ORIGIN: "http://localhost:3188" }, { TASKS_DATABASE_URL: "libsql://remote" }, { NOTES_DATABASE_URL: config().TASKS_DATABASE_URL }, { ENTITLEMENTS_DATABASE_URL: pathToFileURL(resolve("outside.db")).href }, { RESEND_API_KEY: "present" }, { NEXT_PUBLIC_SIGNAL_ACCESS_MODE: "demo" }]) assert.throws(() => validateLocalOperationRuntime({ ...config(), ...patch }));
});
test("exact request Origin and Host required; forwarding cannot reinterpret authority", () => {
  const request = (headers: Record<string, string> = {}) => new Request("http://127.0.0.1:3188/api/internal/local-task-operations", { headers: { host: "127.0.0.1:3188", origin: "http://127.0.0.1:3188", ...headers } });
  assert.equal(localOperationRequestAllowed(request(), config()), true);
  for (const headers of [{ origin: "https://foreign.example" }, { host: "localhost:3188" }, { "x-forwarded-host": "foreign.example" }] as Record<string, string>[]) assert.equal(localOperationRequestAllowed(request(headers), config()), false);
});
test("ordinary originless browser GET requires exact Referer and same-origin Fetch Metadata", () => {
  const browserRead = (patch: Record<string, string> = {}, method = "GET") => new Request("http://127.0.0.1:3188/api/internal/local-task-operations?projectId=project_a", { method, headers: { host: "127.0.0.1:3188", referer: "http://127.0.0.1:3188/app/tasks", "sec-fetch-site": "same-origin", "sec-fetch-mode": "cors", ...patch } });
  assert.equal(localOperationRequestAllowed(browserRead(), config()), true);
  for (const patch of [{ referer: "https://foreign.example" }, { "sec-fetch-site": "cross-site" }, { "sec-fetch-mode": "navigate" }, { origin: "https://foreign.example" }] as Record<string, string>[]) assert.equal(localOperationRequestAllowed(browserRead(patch), config()), false);
  assert.equal(localOperationRequestAllowed(browserRead({}, "POST"), config()), false);
});
test("outbound fetch uses the exact admitted Clerk list and expires before any request", () => {
  assert.equal(localFetchAllowed("https://fixture.clerk.accounts.dev/v1/client", config()), true);
  assert.equal(localFetchAllowed("https://other.clerk.accounts.dev/v1/client", config()), false);
  assert.equal(localFetchAllowed("https://api.stripe.com/v1/customers", config()), false);
  assert.equal(localFetchAllowed("https://api.clerk.com/v1/users/user_fixtureA", config(), "DELETE"), false);
  assert.throws(() => localFetchAllowed("https://api.clerk.com/v1/users", { ...config(), SIGNAL_LOCAL_TASK_EXPIRES_AT: "2000-01-01T00:00:00.000Z" }), /expired/);
  assert.throws(() => validateLocalOperationRuntime({ ...config(), SPONSOR_USAGE_EVENTS: "1" }));
});
test("Next's direct-loopback injected forwarded tuple only corroborates exact transport authority", () => {
  const nextHeaders = { host: "127.0.0.1:3188", referer: "http://127.0.0.1:3188/app/tasks", "sec-fetch-site": "same-origin", "sec-fetch-mode": "cors", "x-forwarded-host": "127.0.0.1:3188", "x-forwarded-proto": "http", "x-forwarded-port": "3188", "x-forwarded-for": "127.0.0.1" };
  const request = (patch: Record<string, string> = {}) => new Request("http://127.0.0.1:3188/api/internal/local-task-operations?projectId=project_a", { headers: { ...nextHeaders, ...patch } });
  assert.equal(localOperationRequestAllowed(request(), config()), true);
  for (const patch of [{ "x-forwarded-host": "foreign.example" }, { "x-forwarded-proto": "https" }, { "x-forwarded-port": "3189" }, { "x-forwarded-for": "::ffff:127.0.0.1" }, { "x-forwarded-host": "127.0.0.1:3188, foreign.example" }, { "x-forwarded-for": "127.0.0.1, 127.0.0.1" }, { forwarded: "for=127.0.0.1;host=127.0.0.1:3188" }] as Record<string, string>[]) assert.equal(localOperationRequestAllowed(request(patch), config()), false);
});
