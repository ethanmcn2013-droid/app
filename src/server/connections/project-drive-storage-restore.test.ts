import assert from "node:assert/strict";
import { test } from "node:test";
import { and, eq } from "drizzle-orm";
import { driveFolderGrants, meta, projectDriveOperations, providerConnections, workspaceMembers, workspaceStorage } from "@/server/db/schema";
import { coreAuthorization, freshProjectDriveCoreDb, seedProjectDriveCore, seedStorageGenerations } from "./project-drive-core.test.helpers";
import { createLiveRestoreProbe, createProjectDriveStorageRestoreService, exactRestorePermissionCoverage } from "./project-drive-storage-restore";
import type { LiveDrivePermission } from "./drive-grants";
import type { ProjectDriveStorageSession } from "./project-drive-access";
import { GOOGLE_DRIVE_ACCOUNT_ERASURE_FENCE_VALUE, googleDriveAccountErasureFenceKey } from "./project-drive-operation-lifecycle";

function permission(userId: string, email: string, role: "owner" | "writer"): LiveDrivePermission {
  return {
    permissionId: userId === "owner" ? "account-owner" : `permission-${userId}`,
    type: "user", role, emailAddress: email, displayName: null, deleted: false,
    source: userId === "owner" ? "storage-owner" : "signal-grant",
    signalUserId: userId === "owner" ? null : userId,
  };
}

async function fixture() {
  const core = await freshProjectDriveCoreDb();
  await seedProjectDriveCore(core.client);
  await seedStorageGenerations(core.client);
  await core.db.update(providerConnections).set({ status: "revoked" })
    .where(eq(providerConnections.id, "conn-old"));
  await core.db.update(workspaceStorage).set({ state: "needs_reauth" })
    .where(eq(workspaceStorage.id, "gen-current"));
  await core.db.insert(driveFolderGrants).values([
    { storageGenerationId: "gen-current", workspaceId: "ws-a", userId: "member-a", permissionId: "permission-member-a", grantedEmail: "member.a@example.com", role: "writer", grantedAt: new Date(), revokePending: false },
    { storageGenerationId: "gen-current", workspaceId: "ws-a", userId: "member-b", permissionId: "permission-member-b", grantedEmail: "member.b@example.com", role: "writer", grantedAt: new Date(), revokePending: false },
  ]);
  return core;
}

test("explicit restore preserves generation and resources, requires provider proof, and is a no-op on replay", async () => {
  const f = await fixture();
  try {
    const original = await f.db.select().from(workspaceStorage);
    let probes = 0;
    const service = createProjectDriveStorageRestoreService({
      database: f.db,
      probe: async (auth, snapshot) => {
        probes++;
        assert.equal(auth.actorUserId, "owner");
        assert.equal(snapshot.storageId, "gen-current");
        assert.equal(snapshot.connectionId, "conn-old", "historical credential binding stays immutable");
        assert.equal(snapshot.credentialId, "conn-new", "provider proof uses the fresh credential");
        assert.equal(snapshot.boundRootId, "root-old");
        return true;
      },
    });
    const first = await service.restore(coreAuthorization("owner", "ws-a"));
    assert.equal(first?.status, "active");
    assert.equal(probes, 1);
    const after = await f.db.select().from(workspaceStorage);
    assert.deepEqual(after.map((row) => ({ ...row, state: original.find((old) => old.id === row.id)?.state })), original);
    assert.equal(after.find((row) => row.id === "gen-current")?.state, "active");
    assert.equal((await service.restore(coreAuthorization("owner", "ws-a")))?.status, "active");
    assert.equal(probes, 1, "replay never repeats provider I/O or mutates history");
  } finally { f.cleanup(); }
});

test("wrong account, revoked replacement, pending disconnect, and queued permission removal do not restore", async () => {
  for (const scenario of ["wrong-account", "revoked-current", "pending-disconnect", "pending-removal"] as const) {
    const f = await fixture();
    try {
      if (scenario === "wrong-account") await f.db.update(providerConnections).set({ providerAccountId: "other-google-account" }).where(eq(providerConnections.id, "conn-new"));
      if (scenario === "revoked-current") await f.db.update(providerConnections).set({ status: "revoked" }).where(eq(providerConnections.id, "conn-new"));
      if (scenario === "pending-disconnect") await f.db.update(providerConnections).set({ revokeRequestedAt: new Date() }).where(eq(providerConnections.id, "conn-old"));
      if (scenario === "pending-removal") await f.db.update(driveFolderGrants).set({ revokePending: true }).where(and(eq(driveFolderGrants.storageGenerationId, "gen-current"), eq(driveFolderGrants.userId, "member-a")));
      let probes = 0;
      const service = createProjectDriveStorageRestoreService({ database: f.db, probe: async () => { probes++; return true; } });
      assert.equal((await service.restore(coreAuthorization("owner", "ws-a")))?.status, "needs_attention", scenario);
      assert.equal(probes, 0, `${scenario} refuses before provider I/O`);
      assert.equal((await f.db.select({ state: workspaceStorage.state }).from(workspaceStorage).where(eq(workspaceStorage.id, "gen-current")))[0]?.state, "needs_reauth");
    } finally { f.cleanup(); }
  }
});

test("lost or stale provider acknowledgement cannot restore after membership or credential changes", async () => {
  for (const change of ["member", "credential"] as const) {
    const f = await fixture();
    try {
      const service = createProjectDriveStorageRestoreService({ database: f.db, probe: async () => {
        if (change === "member") await f.db.update(workspaceMembers).set({ role: "owner" }).where(and(eq(workspaceMembers.workspaceId, "ws-a"), eq(workspaceMembers.userId, "member-a")));
        else await f.db.update(providerConnections).set({ status: "revoked" }).where(eq(providerConnections.id, "conn-new"));
        return true;
      } });
      assert.equal((await service.restore(coreAuthorization("owner", "ws-a")))?.status, "needs_attention");
      assert.equal((await f.db.select({ state: workspaceStorage.state }).from(workspaceStorage).where(eq(workspaceStorage.id, "gen-current")))[0]?.state, "needs_reauth");
    } finally { f.cleanup(); }
  }
});

test("uncertain Google proof and missing durable writer receipt keep native fallback", async () => {
  const f = await fixture();
  try {
    const denied = createProjectDriveStorageRestoreService({ database: f.db, probe: async () => false });
    assert.equal((await denied.restore(coreAuthorization("owner", "ws-a")))?.status, "needs_attention");
    await f.db.delete(driveFolderGrants).where(and(
      eq(driveFolderGrants.storageGenerationId, "gen-current"),
      eq(driveFolderGrants.userId, "member-a"),
    ));
    const falselyPositiveProbe = createProjectDriveStorageRestoreService({ database: f.db, probe: async () => true });
    assert.equal((await falselyPositiveProbe.restore(coreAuthorization("owner", "ws-a")))?.status, "needs_attention");
    assert.equal((await f.db.select({ state: workspaceStorage.state }).from(workspaceStorage).where(eq(workspaceStorage.id, "gen-current")))[0]?.state, "needs_reauth");
    let called = false;
    const foreign = createProjectDriveStorageRestoreService({ database: f.db, probe: async () => { called = true; return true; } });
    assert.equal((await foreign.restore(coreAuthorization("outsider", "ws-a")))?.status, "unavailable");
    assert.equal(called, false);
  } finally { f.cleanup(); }
});

test("account erasure and Project deletion fences refuse restore before provider access", async () => {
  for (const fence of ["account", "project"] as const) {
    const f = await fixture();
    try {
      if (fence === "account") await f.db.insert(meta).values({
        key: googleDriveAccountErasureFenceKey("owner"),
        value: GOOGLE_DRIVE_ACCOUNT_ERASURE_FENCE_VALUE,
      });
      else await f.db.insert(projectDriveOperations).values({
        id: "delete-ws-a", workspaceId: "ws-a", operationKind: "project_delete",
        status: "pending", dedupeKey: "d".repeat(64),
      });
      let providerCalls = 0;
      const service = createProjectDriveStorageRestoreService({ database: f.db, probe: async () => { providerCalls++; return true; } });
      if (fence === "project") await assert.rejects(service.restore(coreAuthorization("owner", "ws-a")), /being deleted/);
      else assert.equal((await service.restore(coreAuthorization("owner", "ws-a")))?.status, "needs_attention");
      assert.equal(providerCalls, 0);
      assert.equal((await f.db.select({ state: workspaceStorage.state }).from(workspaceStorage).where(eq(workspaceStorage.id, "gen-current")))[0]?.state, "needs_reauth");
    } finally { f.cleanup(); }
  }
});

test("live permission coverage demands exact owner and named current members", () => {
  const snapshot = {
    ownerUserId: "owner", ownerEmail: "owner@example.com", providerAccountId: "account-owner",
    members: [
      { userId: "owner", email: "owner@example.com", role: "owner" },
      { userId: "member-a", email: "member.a@example.com", role: "member" },
    ],
  };
  const live = [permission("owner", "owner@example.com", "owner"), permission("member-a", "member.a@example.com", "writer")];
  assert.equal(exactRestorePermissionCoverage(snapshot, live), true);
  assert.equal(exactRestorePermissionCoverage(snapshot, live.slice(1)), false);
  assert.equal(exactRestorePermissionCoverage(snapshot, [live[0], { ...live[1], role: "reader" }]), false);
  assert.equal(exactRestorePermissionCoverage(snapshot, [live[0], { ...live[1], source: "external", signalUserId: null }]), false);
  assert.equal(exactRestorePermissionCoverage(snapshot, [live[0], { ...live[1], emailAddress: "old@example.com" }]), false);
  assert.equal(exactRestorePermissionCoverage({ ...snapshot, ownerEmail: "clerk-mismatch@example.com" }, live), false);
});

test("provider probe binds fresh credential identity, stored folder, and live member permissions", async () => {
  const snapshot = {
    storageId: "gen-current", connectionId: "conn-old", folderId: "folder-current",
    boundRootId: "root-old", credentialId: "conn-new", providerAccountId: "account-owner",
    ownerUserId: "owner", ownerEmail: "owner@example.com",
    members: [{ userId: "owner", email: "owner@example.com", role: "owner" },
      { userId: "member-a", email: "member.a@example.com", role: "member" }],
  };
  const session: ProjectDriveStorageSession = {
    accessToken: "private-request-token",
    credential: { id: "conn-new", ownerUserId: "owner", providerAccountId: "account-owner", providerAccountEmail: "owner@example.com", rootFolderId: "root-new" },
    storageRootFolderId: "root-old",
    storage: { id: "gen-current", workspaceId: "ws-a", connectionId: "conn-old", folderId: "folder-current", folderWebViewLink: "https://drive.google.com/drive/folders/folder-current", state: "needs_reauth", isCurrent: true },
  };
  const calls: string[] = [];
  const makeProbe = (input: { session?: ProjectDriveStorageSession; account?: string; folder?: string; permissions?: LiveDrivePermission[] } = {}) => createLiveRestoreProbe({
    access: { withStorageSession: async (_auth, selector, callback) => {
      calls.push(selector.kind);
      return callback(input.session ?? session);
    } },
    about: async (accessToken) => {
      assert.equal(accessToken, "private-request-token");
      calls.push("about");
      return { permissionId: input.account ?? "account-owner", emailAddress: "owner@example.com" };
    },
    verify: async () => { calls.push("folder"); return { storageGenerationId: "gen-current", connectionId: "conn-old", folderId: input.folder ?? "folder-current" }; },
    permissions: async () => { calls.push("permissions"); return input.permissions ?? [permission("owner", "owner@example.com", "owner"), permission("member-a", "member.a@example.com", "writer")]; },
  });
  const auth = coreAuthorization("owner", "ws-a");
  assert.equal(await makeProbe()(auth, snapshot), true);
  assert.deepEqual(calls, ["current", "about", "folder", "permissions"]);
  calls.length = 0;
  assert.equal(await makeProbe({ account: "different-account" })(auth, snapshot), false);
  assert.deepEqual(calls, ["current", "about"], "wrong provider identity never checks or activates a folder");
  calls.length = 0;
  assert.equal(await makeProbe({ session: { ...session, credential: { ...session.credential, id: "retired" } } })(auth, snapshot), false);
  assert.deepEqual(calls, ["current"], "retired generation is refused before Google calls");
  calls.length = 0;
  assert.equal(await makeProbe({ folder: "different-folder" })(auth, snapshot), false);
  assert.deepEqual(calls, ["current", "about", "folder"]);
  calls.length = 0;
  assert.equal(await makeProbe({ permissions: [permission("owner", "owner@example.com", "owner")] })(auth, snapshot), false);
});
