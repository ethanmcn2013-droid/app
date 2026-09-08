import assert from "node:assert/strict";
import { test } from "node:test";
import { and, eq, sql } from "drizzle-orm";
import { fixture, checkout, sync, decision, ACTIVE, AFTER, deletion } from "../db/event-designation-test-fixture";
import { attachments, entitlements, shareLinks, tasks, users, workspaceMembers, workspaces } from "../db/schema";
import { readTasksRecoveryWith, revokeRecoveryShareWith, revokeTaskShareByIdWith, unpublishProjectWith } from "./recovery";

async function links(f: Awaited<ReturnType<typeof fixture>>, count = 25) {
  for (let i = 0; i < count; i++) await f.local.db.insert(shareLinks).values({
    token: `LEGACY_SECRET_${String(i).padStart(3, "0")}`, workspaceId: "project-a", tokenScheme: "plaintext", view: "board", mode: "view",
    label: "PRIVATE_LINK_LABEL", createdAt: new Date(1700000000000 + i * 1000),
  });
  await f.local.db.insert(shareLinks).values({ token: "FOREIGN_SECRET", workspaceId: "project-b", view: "board" });
}

for (const kind of ["unknown", "pending", "editable", "read_only", "refunded", "local-negative", "verification_unavailable"] as const) {
  test(`recovery remains local and reachable for actual Event ${kind} state`, async () => {
    const f = await fixture();
    try {
      await links(f, 1);
      if (kind !== "unknown") {
        const input = await checkout(f);
        if (kind !== "pending") await sync(f, input);
        if (kind === "refunded") await sync(f, { ...input, revoked: true });
        if (kind === "local-negative") await f.local.db.update(entitlements).set({ expiresAt: new Date(0) }).where(eq(entitlements.notes, input.reference));
      }
      if (kind === "verification_unavailable") f.shared.select = () => { throw new Error("SYNTHETIC_SHARED_OUTAGE"); };
      const result = await decision(f, kind === "editable" ? ACTIVE : AFTER);
      assert.equal(result.kind, ["refunded", "local-negative"].includes(kind) ? "unavailable" : kind === "pending" ? "unknown" : kind);
      if (result.kind === "unavailable") assert.equal(result.reason, "refunded");
      const recovery = await readTasksRecoveryWith(f.local.db, "buyer", "project-a");
      assert.equal(recovery.kind, "ready");
      if (recovery.kind !== "ready") throw Error("Expected local recovery");
      assert.equal(recovery.canDelete, true);
      assert.equal(await revokeRecoveryShareWith(f.local.db, "buyer", "project-a", recovery.links.items[0]), true);
      assert.doesNotMatch(JSON.stringify(recovery), /SECRET|PRIVATE_LINK_LABEL|stripe:|cus_|eci_|SYNTHETIC_SHARED/);
    } finally { f.close(); }
  });
}

test("bounded pages reach the oldest legacy link, hide bearer values and refuse cross-project references", async () => {
  const f = await fixture();
  try {
    await links(f);
    const first = await readTasksRecoveryWith(f.local.db, "buyer", "project-a");
    assert.equal(first.kind, "ready");
    if (first.kind !== "ready") throw Error("Expected recovery");
    assert.equal(first.links.items.length, 20);
    assert.ok(first.links.next);
    const second = await readTasksRecoveryWith(f.local.db, "buyer", "project-a", { links: first.links.next! });
    if (second.kind !== "ready") throw Error("Expected next page");
    assert.equal(second.links.items.length, 5);
    assert.equal(second.links.next, null);
    const all = [...first.links.items, ...second.links.items];
    assert.equal(new Set(all.map(item => item.row)).size, 25);
    assert.doesNotMatch(JSON.stringify(all), /LEGACY_SECRET|FOREIGN_SECRET|PRIVATE_LINK_LABEL/);
    const oldest = second.links.items.at(-1)!;
    assert.equal(await revokeRecoveryShareWith(f.local.db, "buyer", "project-b", oldest), false);
    assert.equal(await revokeRecoveryShareWith(f.local.db, "buyer", "project-a", oldest), true);
    const [oldRow] = await f.local.db.select().from(shareLinks).where(eq(shareLinks.token, "LEGACY_SECRET_000"));
    assert.ok(oldRow.revokedAt);
    const [foreign] = await f.local.db.select().from(shareLinks).where(eq(shareLinks.token, "FOREIGN_SECRET"));
    assert.equal(foreign.revokedAt, null);
  } finally { f.close(); }
});

test("current members retain negative-only link authority on archives; only managers unpublish and primary owner recovers files", async () => {
  const f = await fixture();
  try {
    await links(f, 1);
    await f.local.db.update(workspaces).set({ archivedAt: new Date(), publishedAt: new Date() }).where(eq(workspaces.id, "project-a"));
    await f.local.db.insert(tasks).values({ id: "file-task", workspaceId: "project-a", title: "PRIVATE_BODY", lane: "todo", priority: "p2" });
    for (let i = 0; i < 21; i++) await f.local.db.insert(attachments).values({ id: `file-${i}`, workspaceId: "project-a", taskId: "file-task", uploaderUserId: "buyer", filename: `owned-${i}.txt`, sizeBytes: 5, storedPath: "PRIVATE_STORAGE_LOCATOR", mimeType: "text/plain" });
    for (const actor of ["buyer", "co-owner", "member"]) {
      const value = await readTasksRecoveryWith(f.local.db, actor, "project-a");
      if (value.kind !== "ready") throw Error("Expected membership");
      assert.equal(value.project.archived, true);
      assert.equal(value.canDelete, actor === "buyer");
      assert.equal(value.canUnpublish, actor !== "member");
      assert.equal(value.files.items.length, actor === "buyer" ? 20 : 0);
      assert.doesNotMatch(JSON.stringify(value), /PRIVATE_BODY|PRIVATE_STORAGE_LOCATOR/);
      if (actor === "buyer") {
        const second = await readTasksRecoveryWith(f.local.db, actor, "project-a", { files: value.files.next! });
        assert.equal(second.kind === "ready" && second.files.items.length, 1);
      }
    }
    assert.equal(await unpublishProjectWith(f.local.db, "member", "project-a"), null);
    assert.ok(await unpublishProjectWith(f.local.db, "co-owner", "project-a"));
    assert.equal(await revokeTaskShareByIdWith(f.local.db, "member", "LEGACY_SECRET_000"), true);
    const [project] = await f.local.db.select().from(workspaces).where(eq(workspaces.id, "project-a"));
    assert.equal(project.publishedAt, null);
  } finally { f.close(); }
});

test("fresh removal, changed primary owner, malformed and erased account refuse without reusing earlier read grants", async () => {
  const f = await fixture();
  try {
    await links(f, 1);
    const first = await readTasksRecoveryWith(f.local.db, "buyer", "project-a");
    if (first.kind !== "ready") throw Error("Expected initial owner");
    await f.local.db.delete(workspaceMembers).where(and(eq(workspaceMembers.workspaceId, "project-a"), eq(workspaceMembers.userId, "buyer")));
    assert.equal(await revokeRecoveryShareWith(f.local.db, "buyer", "project-a", first.links.items[0]), false);
    for (const [actor, project] of [["buyer", "project-a"], ["outsider", "project-a"], ["buyer", " bad "], ["buyer", "missing"]]) {
      assert.deepEqual(await readTasksRecoveryWith(f.local.db, actor, project), { kind: "unavailable" });
    }
    await f.local.db.insert(workspaceMembers).values({ workspaceId: "project-a", userId: "buyer", role: "owner" });
    await f.local.db.update(workspaces).set({ ownerUserId: "co-owner" }).where(eq(workspaces.id, "project-a"));
    const transferred = await readTasksRecoveryWith(f.local.db, "buyer", "project-a");
    assert.equal(transferred.kind === "ready" && transferred.canDelete, false);
    await deletion.beginAccountDeletionWith(f.local.db, "buyer");
    assert.deepEqual(await readTasksRecoveryWith(f.local.db, "buyer", "project-a"), { kind: "unavailable" });
    assert.equal(await revokeTaskShareByIdWith(f.local.db, "buyer", "LEGACY_SECRET_000"), false);
    assert.equal((await f.local.db.select().from(shareLinks).where(eq(shareLinks.token, "LEGACY_SECRET_000")))[0].revokedAt, null);
  } finally { f.close(); }
});

test("stale row locator cannot revoke a replacement link; repeated and concurrent revocation remains monotone", async () => {
  const f = await fixture();
  try {
    await links(f, 1);
    const initial = await readTasksRecoveryWith(f.local.db, "buyer", "project-a");
    if (initial.kind !== "ready") throw Error("Expected recovery");
    const reference = initial.links.items[0];
    await f.local.db.delete(shareLinks).where(eq(shareLinks.token, "LEGACY_SECRET_000"));
    await f.local.client.execute({ sql: "INSERT INTO share_links(rowid,token,workspace_id,view) VALUES(?,?,?,?)", args: [reference.row, "REPLACEMENT_SECRET", "project-a", "board"] });
    assert.equal(await revokeRecoveryShareWith(f.local.db, "buyer", "project-a", reference), false);
    const current = await readTasksRecoveryWith(f.local.db, "buyer", "project-a");
    if (current.kind !== "ready") throw Error("Expected recovery");
    assert.deepEqual(await Promise.all([1, 2].map(() => revokeRecoveryShareWith(f.local.db, "buyer", "project-a", current.links.items[0]))), [true, true]);
    const [row] = await f.local.db.select().from(shareLinks).where(eq(shareLinks.token, "REPLACEMENT_SECRET"));
    await revokeRecoveryShareWith(f.local.db, "buyer", "project-a", current.links.items[0]);
    assert.equal((await f.local.db.select().from(shareLinks).where(eq(shareLinks.token, "REPLACEMENT_SECRET")))[0].revokedAt?.getTime(), row.revokedAt?.getTime());
  } finally { f.close(); }
});

test("the recovery read does not touch normal task content, and database failure is not a successful empty page", async () => {
  const f = await fixture();
  try {
    await links(f, 1);
    await f.local.client.execute("PRAGMA foreign_keys=OFF");
    await f.local.client.execute("DROP TABLE tasks");
    assert.equal((await readTasksRecoveryWith(f.local.db, "buyer", "project-a")).kind, "ready");
    await f.local.client.execute("DROP TABLE share_links");
    await assert.rejects(readTasksRecoveryWith(f.local.db, "buyer", "project-a"));
  } finally { f.close(); }
});

test("account identity is stored Clerk mapping, not an assumed equivalence with internal user ID", async () => {
  const f = await fixture();
  try {
    await f.local.db.update(users).set({ clerkId: "clerk-buyer" }).where(eq(users.id, "buyer"));
    assert.equal((await readTasksRecoveryWith(f.local.db, "buyer", "project-a")).kind, "ready");
    assert.deepEqual(await readTasksRecoveryWith(f.local.db, "clerk-buyer", "project-a"), { kind: "unavailable" });
    assert.equal((await f.local.db.select({ count: sql<number>`count(*)` }).from(users).where(eq(users.id, "clerk-buyer")))[0].count, 0);
  } finally { f.close(); }
});
