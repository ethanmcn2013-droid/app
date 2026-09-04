import assert from "node:assert/strict";
import { test } from "node:test";
import { inviteAuthUrl, inviteReturnPath } from "./invite-intent";

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
