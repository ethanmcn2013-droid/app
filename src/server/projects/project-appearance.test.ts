import assert from "node:assert/strict";
import test from "node:test";
import { eq } from "drizzle-orm";
import { freshFileDb } from "@/server/db/memory-test-db";
import { meta, projectDriveOperations, users, workspaces, workspaceMembers } from "@/server/db/schema";
import { setProjectColorWith } from "./project-appearance";
import { parseProjectColorIndex, projectColorMetaKey } from "@/lib/projects/project-appearance";
import { projectOwnedMetaKeys } from "@/lib/projects/project-hub";

test("project colour is an allowlisted shared token and retained in erasure keys", () => {
  for (const invalid of [0, 9, "01", "#fff", "var(--anything)", null, {}, NaN]) assert.equal(parseProjectColorIndex(invalid), null);
  assert.equal(parseProjectColorIndex("8"), 8);
  assert.ok(projectOwnedMetaKeys("a").includes(projectColorMetaKey("a")));
});

test("only project managers can save colour, with explicit project and deletion fence", async () => {
  const local = await freshFileDb();
  try {
    for (const id of ["owner", "member", "foreign"]) await local.db.insert(users).values({ id, clerkId: id, initials: "FX", color: "fixture" });
    for (const id of ["a", "b"]) await local.db.insert(workspaces).values({ id, slug: id, name: id, ownerUserId: "owner" });
    await local.db.insert(workspaceMembers).values([{ workspaceId: "a", userId: "owner", role: "owner" }, { workspaceId: "a", userId: "member", role: "member" }, { workspaceId: "b", userId: "owner", role: "owner" }]);
    await assert.rejects(setProjectColorWith(local.db, "member", "a", 1));
    await assert.rejects(setProjectColorWith(local.db, "foreign", "a", 1));
    await setProjectColorWith(local.db, "owner", "a", 3);
    assert.deepEqual(await local.db.select({ key: meta.key, value: meta.value }).from(meta), [{ key: projectColorMetaKey("a"), value: "3" }]);
    await local.db.update(workspaces).set({ archivedAt: new Date() }).where(eq(workspaces.id, "a"));
    await assert.rejects(setProjectColorWith(local.db, "owner", "a", 4));
    await local.db.update(workspaces).set({ archivedAt: null }).where(eq(workspaces.id, "a"));
    await local.db.insert(projectDriveOperations).values({ id: "deleting", workspaceId: "a", operationKind: "project_delete", status: "pending", dedupeKey: "a".repeat(64) });
    await assert.rejects(setProjectColorWith(local.db, "owner", "a", 4), /being deleted/);
    const [stored] = await local.db.select({ value: meta.value }).from(meta).where(eq(meta.key, projectColorMetaKey("a")));
    assert.equal(stored.value, "3");
  } finally { local.cleanup(); }
});
