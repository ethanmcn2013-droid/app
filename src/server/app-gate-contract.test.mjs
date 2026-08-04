import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import test from "node:test";

/**
 * The /app gate must admit invited and redeemed users, not only the allowlist.
 *
 * This is a wiring contract, and it is asserted against source text on purpose.
 * What went wrong here was not a logic bug — `requireAppAccessTasks` was written
 * correctly and its behaviour was never in question. The defect was that it was
 * called in the wrong place: inside the nested Tasks shell, where the outer
 * layout gate had already redirected. Only the wiring can catch that, so only
 * the wiring is asserted. This test does not claim to prove access behaviour.
 *
 * The failure it exists to prevent: an invited or redeemed user signs in,
 * their token is burned, and they land on /waitlist permanently.
 */

const layout = readFileSync(
  new URL("../app/app/layout.tsx", import.meta.url),
  "utf8",
);

test("the shared /app gate uses the membership-aware access check", () => {
  assert.match(
    layout,
    /await\s+requireAppAccessTasks\(\)/,
    "src/app/app/layout.tsx must await requireAppAccessTasks(). The allowlist-only requireAppAccess() bounces every invited and redeemed user to /waitlist after their token is spent.",
  );
});

test("the shared /app gate does not call the allowlist-only check", () => {
  assert.doesNotMatch(
    layout,
    /await\s+requireAppAccess\(\)/,
    "src/app/app/layout.tsx must not await requireAppAccess(). It is allowlist-only, and as the outer gate it fires before any membership-aware check nested inside it.",
  );
});

test("the membership fallback that the gate depends on is still present", () => {
  const access = readFileSync(
    new URL("./app-access.ts", import.meta.url),
    "utf8",
  );
  assert.match(
    access,
    /workspaceMembers/,
    "requireAppAccessTasks must still consult workspace_members. Without that fallback it is equivalent to the allowlist-only gate and the /app layout check above becomes cosmetic.",
  );
});
