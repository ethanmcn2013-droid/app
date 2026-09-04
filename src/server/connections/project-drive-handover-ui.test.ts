import test from "node:test";
import assert from "node:assert/strict";
import { eq } from "drizzle-orm";
import { providerConnections, resources, workspaceMembers } from "@/server/db/schema";
import { coreAuthorization, freshProjectDriveCoreDb, seedProjectDriveCore, seedStorageGenerations, tokenCipher } from "./project-drive-core.test.helpers";
import { readProjectDriveHandoverUi, requestProjectDriveUiHandover } from "./project-drive-handover-ui";
import { createProjectDriveStorageHandoverService } from "./project-drive-storage-handover";

async function fixture() {
  const core = await freshProjectDriveCoreDb();
  await seedProjectDriveCore(core.client);
  await seedStorageGenerations(core.client);
  await core.db.update(workspaceMembers).set({ role: "owner" }).where(eq(workspaceMembers.userId, "member-a"));
  await core.db.insert(providerConnections).values({
    id: "conn-target", userId: "member-a", provider: "google_drive", providerAccountId: "private-account", providerAccountEmail: "private-google-email@example.test", rootFolderId: "private-root", refreshTokenCipher: tokenCipher("conn-target", "private-refresh"), keyVersion: 1,
    scopes: ["https://www.googleapis.com/auth/drive.file"], status: "active", isCurrent: true, connectedAt: new Date(),
  });
  return core;
}
const auth = coreAuthorization("owner", "ws-a");

test("handover choices require server owner + exact current active scope, and expose only scoped identities", async () => {
  const f = await fixture();
  try {
    const ready = await readProjectDriveHandoverUi(auth, f.db);
    assert.deepEqual(ready, { state: "ready", choices: [{ userId: "member-a", name: "Member.A@Example.com" }], continuation: null });
    assert.doesNotMatch(JSON.stringify(ready), /outsider|private-|conn-|scope|permission|cipher/);
    await f.db.update(workspaceMembers).set({ role: "member" }).where(eq(workspaceMembers.userId, "member-a"));
    assert.deepEqual((await readProjectDriveHandoverUi(auth, f.db)).choices, [], "a connected member is not a target owner");
    await f.db.update(workspaceMembers).set({ role: "owner" }).where(eq(workspaceMembers.userId, "member-a"));
    for (const change of [
      { status: "needs_reauth" as const }, { status: "revoked" as const },
      { status: "active" as const, isCurrent: false },
      { isCurrent: true, scopes: ["https://www.googleapis.com/auth/drive.file", "unexpected-extra-scope"] },
      { scopes: [] },
      { scopes: ["https://www.googleapis.com/auth/drive.file", "https://www.googleapis.com/auth/drive.file"] },
    ]) {
      await f.db.update(providerConnections).set(change).where(eq(providerConnections.id, "conn-target"));
      assert.deepEqual((await readProjectDriveHandoverUi(auth, f.db)).choices, []);
    }
  } finally { f.cleanup(); }
});

test("stale actor/source ownership, wrong capability, foreign project and archive fail closed", async () => {
  const f = await fixture();
  try {
    await assert.rejects(readProjectDriveHandoverUi(coreAuthorization("member-b", "ws-a", false), f.db));
    assert.equal((await readProjectDriveHandoverUi(coreAuthorization("owner", "ws-b"), f.db)).state, "unavailable");
    await f.client.execute("UPDATE workspace_members SET role='member' WHERE workspace_id='ws-a' AND user_id='owner'");
    assert.equal((await readProjectDriveHandoverUi(auth, f.db)).state, "unavailable", "stale actor proof is insufficient");
    assert.equal((await readProjectDriveHandoverUi(coreAuthorization("member-a", "ws-a"), f.db)).state, "unavailable", "source must still own the board");
    await f.client.execute("UPDATE workspace_members SET role='owner' WHERE workspace_id='ws-a' AND user_id='owner'");
    await f.client.execute("UPDATE workspaces SET archived_at=123 WHERE id='ws-a'");
    assert.equal((await readProjectDriveHandoverUi(auth, f.db)).state, "archived");
  } finally { f.cleanup(); }
});

test("pending receipts block handover without leaking a bearer capability; foreign receipts do not", async () => {
  const f = await fixture();
  try {
    await f.db.insert(resources).values({ id: "pending-other", workspaceId: "ws-b", taskId: "task-b", kind: "upload", provider: "drive", storage: "drive", storageGenerationId: "gen-other", storedPath: "private-session", title: "Other.pdf", mimeType: "application/pdf", sizeBytes: 12, addedByUserId: "outsider", addedAt: 10, accessState: "pending", countsAgainstStorage: 0 });
    assert.equal((await readProjectDriveHandoverUi(auth, f.db)).state, "ready");
    await f.db.insert(resources).values({ id: "pending-here", workspaceId: "ws-a", taskId: "task-a", kind: "upload", provider: "drive", storage: "drive", storageGenerationId: "gen-current", storedPath: "private-session", title: "Contract.pdf", mimeType: "application/pdf", sizeBytes: 12, addedByUserId: "member-a", addedAt: 10, accessState: "pending", countsAgainstStorage: 0 });
    assert.deepEqual(await readProjectDriveHandoverUi(auth, f.db), { state: "uploads_pending", choices: [], continuation: null });
    let calls = 0;
    const result = await requestProjectDriveUiHandover(auth, "member-a", { database: f.db, handover: async () => { calls++; throw Error("must not run"); } });
    assert.equal(result, "unavailable"); assert.equal(calls, 0);
  } finally { f.cleanup(); }
});

test("handover continuation retains the existing journal target and operation; manual attention has no retry", async () => {
  const f = await fixture();
  try {
    const ids: string[] = [];
    const backend = createProjectDriveStorageHandoverService({ database: f.db, randomStorageGenerationId: () => "11111111-1111-4111-8111-111111111111", journalRuntimeDependencies: { randomOperationId: () => "saved-handover" }, execute: async locator => { ids.push(locator.operationId); return { outcome: "conflict" }; } });
    const deps = { database: f.db, handover: backend.handover };
    assert.equal(await requestProjectDriveUiHandover(auth, "outsider", deps), "unavailable");
    assert.equal(ids.length, 0);
    assert.equal(await requestProjectDriveUiHandover(auth, "member-a", deps), "setting_up");
    const saved = await readProjectDriveHandoverUi(auth, f.db);
    assert.deepEqual(saved, { state: "in_progress", choices: [], continuation: { userId: "member-a", name: "Member.A@Example.com" } });
    assert.equal(await requestProjectDriveUiHandover(auth, "member-b", deps), "unavailable");
    assert.equal(await requestProjectDriveUiHandover(auth, "member-a", deps), "setting_up");
    assert.deepEqual(ids, ["saved-handover", "saved-handover"]);
    await f.client.execute("UPDATE project_drive_operations SET status='manual_attention', attempt_count=1, last_attempt_at=created_at, updated_at=created_at, last_error_code='network_error' WHERE id='saved-handover'");
    assert.deepEqual(await readProjectDriveHandoverUi(auth, f.db), { state: "needs_attention", choices: [], continuation: null });
    assert.equal(await requestProjectDriveUiHandover(auth, "member-a", deps), "unavailable");
    assert.equal(ids.length, 2);
  } finally { f.cleanup(); }
});

test("the backend revalidates a role lost between UI allow-list and execution", async () => {
  const f = await fixture();
  try {
    let dispatched = 0;
    const backend = createProjectDriveStorageHandoverService({ database: f.db, execute: async () => { dispatched++; return { outcome: "conflict" }; } });
    const result = await requestProjectDriveUiHandover(auth, "member-a", { database: f.db, handover: async (authorization, input) => {
      await f.db.update(workspaceMembers).set({ role: "member" }).where(eq(workspaceMembers.userId, "member-a"));
      return backend.handover(authorization, input);
    } });
    assert.equal(result, "unavailable"); assert.equal(dispatched, 0);
  } finally { f.cleanup(); }
});

test("a retired target connection cannot redirect a saved operation to its replacement", async () => {
  const f = await fixture();
  try {
    let dispatched = 0;
    const backend = createProjectDriveStorageHandoverService({ database: f.db, randomStorageGenerationId: () => "11111111-1111-4111-8111-111111111111", journalRuntimeDependencies: { randomOperationId: () => "saved-target" }, execute: async () => { dispatched++; return { outcome: "conflict" }; } });
    await requestProjectDriveUiHandover(auth, "member-a", { database: f.db, handover: backend.handover });
    await f.db.update(providerConnections).set({ isCurrent: false }).where(eq(providerConnections.id, "conn-target"));
    await f.db.insert(providerConnections).values({ id: "conn-replacement", userId: "member-a", provider: "google_drive", providerAccountId: "replacement-account", rootFolderId: "replacement-root", refreshTokenCipher: tokenCipher("conn-replacement", "replacement-refresh"), keyVersion: 1, scopes: ["https://www.googleapis.com/auth/drive.file"], status: "active", isCurrent: true, connectedAt: new Date() });
    assert.deepEqual(await readProjectDriveHandoverUi(auth, f.db), { state: "needs_attention", choices: [], continuation: null });
    assert.equal(await requestProjectDriveUiHandover(auth, "member-a", { database: f.db, handover: backend.handover }), "unavailable");
    assert.equal(dispatched, 1);
  } finally { f.cleanup(); }
});
