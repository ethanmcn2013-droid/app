import assert from "node:assert/strict";
import { before, test } from "node:test";
import { inArray } from "drizzle-orm";
import { freshFileDb } from "@/server/db/memory-test-db";
import { meta, users, workspaces, workspaceMembers } from "@/server/db/schema";
import { eraseAccountData } from "@/server/account-erasure";
import { deleteProjectRowsInTransaction } from "@/server/projects/project-deletion-rows";
import {
  projectColumnsMetaKey,
  projectOwnedMetaKeys,
  projectPurposeMetaKey,
  projectStatusMetaKey,
  projectTargetDateMetaKey,
} from "@/lib/projects/project-hub";

before(() => {
  process.env.NEXT_PUBLIC_SIGNAL_ACCESS_MODE = "review";
  process.env.NEXT_PUBLIC_SIGNAL_DEPLOYMENT_ENV = "preview";
});

const projectKeys = (projectId: string) => [
  projectStatusMetaKey(projectId),
  projectTargetDateMetaKey(projectId),
  projectPurposeMetaKey(projectId),
  projectColumnsMetaKey(projectId),
];

async function fixture() {
  const f = await freshFileDb();
  await f.client.execute("PRAGMA journal_mode=WAL");
  for (const id of ["a", "b"]) {
    await f.db.insert(users).values({ id, clerkId: `clerk-${id}`, initials: id, color: "fixture" });
    await f.db.insert(workspaces).values({ id: `project-${id}`, slug: id, name: id, ownerUserId: id, contextType: "wedding" });
    await f.db.insert(workspaceMembers).values({ workspaceId: `project-${id}`, userId: id, role: "owner" });
    await f.db.insert(meta).values([
      { key: projectStatusMetaKey(`project-${id}`), value: "at_risk" },
      { key: projectTargetDateMetaKey(`project-${id}`), value: "2028-12-12" },
      { key: projectPurposeMetaKey(`project-${id}`), value: "A synthetic purpose" },
      { key: projectColumnsMetaKey(`project-${id}`), value: "[]" },
    ]);
  }
  const keysLeft = async (projectId: string) =>
    (await f.db.select({ key: meta.key }).from(meta).where(inArray(meta.key, projectKeys(projectId))))
      .map((row) => row.key)
      .sort();
  return { ...f, keysLeft };
}

test("the owned keys are the status, target date and purpose of that one Project", () => {
  assert.deepEqual(projectOwnedMetaKeys("p1"), [
    "project-status:p1",
    "project-target-date:p1",
    "room:p1:purpose",
  ]);
});

test("deleting a Project removes its status, target date and purpose rows and nobody else's", async () => {
  const f = await fixture();
  try {
    await f.db.transaction((tx) => deleteProjectRowsInTransaction(tx, "project-a"));
    assert.deepEqual(await f.keysLeft("project-a"), []);
    assert.deepEqual(await f.keysLeft("project-b"), projectKeys("project-b").sort());
  } finally {
    f.cleanup();
  }
});

test("erasing an account removes the same rows for the Projects it owned and nobody else's", async () => {
  const f = await fixture();
  try {
    await eraseAccountData(f.db, "clerk-a");
    assert.deepEqual(await f.keysLeft("project-a"), []);
    assert.deepEqual(await f.keysLeft("project-b"), projectKeys("project-b").sort());
  } finally {
    f.cleanup();
  }
});
