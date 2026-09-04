import { before, test } from "node:test";
import assert from "node:assert/strict";
import { entitlementFixture } from "@/server/db/entitlements-test-db";
import { entitlements } from "@/server/db/schema";
import { writeSharedEntitlement } from "@/lib/entitlements-shared/writes";

let notes: typeof import("./notes-entitlements");
before(async () => {
  process.env.NEXT_PUBLIC_SIGNAL_ACCESS_MODE = "review";
  process.env.NEXT_PUBLIC_SIGNAL_DEPLOYMENT_ENV = "preview";
  notes = await import("./notes-entitlements");
});

test("personal Notes retains a scoped Pro benefit but immediately honours its local revocation", async () => {
  const f = await entitlementFixture();
  try {
    await f.local.db.insert(entitlements).values({
      id: "pro", userId: "buyer", workspaceId: "project-a", tier: "workspace", source: "purchase", notes: "stripe-sub:notes",
    });
    await writeSharedEntitlement({
      userClerkId: "buyer", tier: "workspace", source: "workspace_subscription", sourceRef: "stripe-sub:notes", metadata: { workspaceId: "project-a" },
    }, f.shared);
    assert.equal(await notes.notesProEnabled("buyer", f.dependencies), true);
    assert.equal(await notes.notesProEnabled("stranger", f.dependencies), false);
    await f.local.db.update(entitlements).set({ expiresAt: new Date(0) });
    assert.equal(await notes.getNotesTier("buyer", f.dependencies), "free");
    assert.equal(await notes.notesProEnabled("buyer", f.dependencies), false);
    await writeSharedEntitlement({ userClerkId: "buyer", tier: "studio", source: "compliments", sourceRef: "independent-operator" }, f.shared);
    assert.equal(await notes.notesProEnabled("buyer", f.dependencies), true);
  } finally { f.close(); }
});
