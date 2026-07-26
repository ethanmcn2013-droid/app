import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const pageContext = readFileSync(
  new URL("./page-context.ts", import.meta.url),
  "utf8",
);
const onboarding = readFileSync(
  new URL("../../app/onboarding/signal-onboarding-page.tsx", import.meta.url),
  "utf8",
);

test("Signal provisions a shared identity before resolving live workspaces", () => {
  assert.match(
    pageContext,
    /await ensureUserProvisioned\(userId\);[\s\S]*await listWorkspaceOptions\(userId\);/,
  );
  assert.match(
    pageContext,
    /or\(eq\(users\.clerkId, clerkId\), eq\(users\.id, clerkId\)\)/,
  );
});

test("Signal onboarding only redirects when its linked workspace still exists", () => {
  assert.match(onboarding, /getAnalyticsUser\(userId\)/);
  assert.match(
    onboarding,
    /candidates\.some\([\s\S]*candidate\.workspaceId === analyticsUser\?\.linkedWorkspaceId/,
  );
  assert.doesNotMatch(onboarding, /if \(await isOnboarded\(userId\)\)/);
});
