import assert from "node:assert/strict";
import { test } from "node:test";
import { inviteAuthUrl, inviteReturnPath } from "./invite-intent";
import { appAuthReturnPath, signInRedirectProps, signInUrlForAppReturn } from "./app-return";

test("invite intent survives URL encoding and both auth entry points", () => {
  const path = "/invite/Abc_123-xyz";
  for (const mode of ["sign-in", "sign-up"] as const) {
    const url = new URL(inviteAuthUrl(mode, path), "https://example.test");
    assert.equal(url.pathname, `/${mode}`);
    assert.equal(inviteReturnPath(url.searchParams.get("redirect_url")), path);
  }
  assert.equal(inviteReturnPath(`${path}/`), path);
});

test("external, ambiguous and non-invite redirects cannot override auth", () => {
  for (const value of [
    undefined, null, ["/invite/a", "/invite/b"], "", "/app/tasks",
    "https://example.test/invite/a", "//example.test/invite/a", "/\\example.test/invite/a",
    "/invite/../admin", "/invite/%2e%2e", "/invite/a/b", "/invite/a?next=/app", "/invite/a#x",
    `/invite/${"a".repeat(129)}`, "/invite/a\n",
  ]) assert.equal(inviteReturnPath(value), null, String(value));
});

test("an expired-session Tasks deep link survives the same-origin sign-in wall", () => {
  const target = "/app/tasks?workspaceId=ws-owned&task=t-owned";
  const url = new URL(signInUrlForAppReturn(target), "https://app.signalstudio.ie");
  assert.equal(url.origin, "https://app.signalstudio.ie");
  assert.equal(url.pathname, "/sign-in");
  assert.equal(url.searchParams.get("redirect_url"), target);
  assert.equal(appAuthReturnPath(url.searchParams.get("redirect_url")), target);
  assert.deepEqual(signInRedirectProps(url.searchParams.get("redirect_url")),
    { forceRedirectUrl: target });
});

test("known App destinations preserve only route-specific, unambiguous state", () => {
  for (const target of [
    "/app/home?workspaceId=ws-owned",
    "/app/task/t-owned",
    "/app/messages?workspaceId=ws-owned",
    "/app/notes?workspaceId=ws-owned&view=review&note=n-one",
    "/app/timeline/our-day?workspaceId=ws-owned&mode=edit",
    "/app/home/briefing?contextVersion=2&workspaceId=ws-owned",
  ]) assert.equal(appAuthReturnPath(target), target);
  assert.equal(appAuthReturnPath("/app/tasks?task=t-owned&workspaceId=ws-owned"),
    "/app/tasks?task=t-owned&workspaceId=ws-owned");
});

test("external, encoded, duplicate and unknown App returns cannot override sign-in", () => {
  for (const value of [
    undefined, null, ["/app/tasks"], "", "https://evil.test/app/tasks",
    "//evil.test/app/tasks", "/\\evil.test/app/tasks", "/app/tasks#other",
    "/app/tasks%2f..%2fsign-in", "/app/%2e%2e/sign-in", "/app/tasks/../sign-in",
    "/app/tasks?workspaceId=ws-a&workspaceId=ws-b",
    "/app/tasks?workspaceId=ws-a%26redirect_url%3Dhttps%3A%2F%2Fevil.test",
    "/app/tasks?redirect_url=https%3A%2F%2Fevil.test",
    "/app/tasks?task=t-a&next=%2F%2Fevil.test",
    "/app/unknown", "/api/account/export", "/app/tasks\n",
    `/app/tasks?task=${"x".repeat(1025)}`,
  ]) {
    assert.equal(appAuthReturnPath(value), null, String(value));
    assert.equal(signInUrlForAppReturn(value), "/sign-in", String(value));
    if (value !== undefined) assert.deepEqual(signInRedirectProps(value),
      { forceRedirectUrl: "/app" }, String(value));
  }
});

test("sign-in gives Clerk a safe destination for invalid input and preserves invite priority", () => {
  assert.deepEqual(signInRedirectProps(undefined), {});
  assert.deepEqual(signInRedirectProps(["/app/tasks", "/app/notes"]),
    { forceRedirectUrl: "/app" });
  assert.deepEqual(signInRedirectProps("https://evil.test/app/tasks"),
    { forceRedirectUrl: "/app" });
  assert.deepEqual(signInRedirectProps("/invite/Abc_123-xyz"), {
    forceRedirectUrl: "/invite/Abc_123-xyz",
    signUpForceRedirectUrl: "/invite/Abc_123-xyz",
    signUpUrl: "/sign-up?redirect_url=%2Finvite%2FAbc_123-xyz",
  });
});
