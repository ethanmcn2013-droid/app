import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { eq, sql } from "drizzle-orm";
import { seal, driveUploadSessionAadContext } from "@/server/crypto/secret-box";
import { meta, resources, tasks, workspaceMembers, workspaces } from "@/server/db/schema";
import { createDriveUploadService } from "./drive-uploads";
import { createProjectDriveAccessService } from "./project-drive-access";
import { googleDriveAccountErasureFenceKey } from "./project-drive-operation-lifecycle";
import { createProjectDriveOperationJournal } from "./project-drive-operation-journal";
import { accessDependencies, CORE_TEST_RING, coreAuthorization, freshProjectDriveCoreDb, jsonResponse,
  seedProjectDriveCore, seedStorageGenerations, tokenRefreshResponse } from "./project-drive-core.test.helpers";

const ID = "a0000000-0000-4000-8000-000000000001";
const input = { taskId: "task-a", resourceId: ID };
const auth = () => coreAuthorization("member-a", "ws-a", false);
const cleanups: Array<() => void> = [];
afterEach(() => { while (cleanups.length) cleanups.pop()?.(); });

async function fixture(generation = "gen-current") {
  const f = await freshProjectDriveCoreDb(); cleanups.push(f.cleanup);
  await seedProjectDriveCore(f.client); await seedStorageGenerations(f.client);
  await f.client.executeMultiple(`INSERT INTO tasks (id,workspace_id,title,lane,priority,assignees,created_at,updated_at)
    VALUES ('task-a','ws-a','A','todo','medium','[]',10,10),('task-b','ws-b','B','todo','medium','[]',10,10);`);
  const sessionUrl = "https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&upload_id=existing-only";
  const cipher = seal(sessionUrl, driveUploadSessionAadContext("ws-a", generation, ID), CORE_TEST_RING);
  await f.db.insert(resources).values({ id: ID, taskId: "task-a", workspaceId: "ws-a", kind: "upload", provider: "drive",
    storage: "drive", storageGenerationId: generation, title: "Brief.pdf", mimeType: "application/pdf", sizeBytes: 100,
    addedByUserId: "member-a", addedAt: 10, refreshedAt: 20, accessState: "pending", countsAgainstStorage: 0, storedPath: cipher });
  const file = { id: "completed-file", name: "Brief.pdf", mimeType: "application/pdf", size: "100", trashed: false,
    parents: [generation === "gen-old" ? "folder-old" : "folder-current"], appProperties: { signalResourceId: ID },
    webViewLink: "https://drive.google.com/file/d/completed-file/view" };
  const h = {
    status: 200, files: [file] as Array<Record<string, unknown>>, file: file as Record<string, unknown>,
    beforeProbe: null as (() => Promise<void>) | null,
    calls: [] as Array<{ url: string; method: string; body: unknown }>,
  };
  const fetchImpl: typeof fetch = async (url, init) => {
    const address = String(url); h.calls.push({ url: address, method: init?.method ?? "GET", body: init?.body });
    if (address.includes("oauth2.googleapis.com/token")) return tokenRefreshResponse();
    if (address === sessionUrl && init?.method === "PUT") {
      assert.equal(init.body, undefined, "status probes carry no bytes");
      assert.equal(new Headers(init.headers).get("Content-Range"), "bytes */100");
      const hook = h.beforeProbe; h.beforeProbe = null; await hook?.();
      return h.status === 200 ? jsonResponse(h.file) : new Response(null, { status: h.status, headers: { range: "bytes=0-49" } });
    }
    const path = new URL(address).pathname;
    if (path === "/drive/v3/files" && init?.method === "GET") return jsonResponse({ files: h.files });
    if (path === "/drive/v3/files/completed-file" && init?.method === "GET") return jsonResponse(h.file);
    throw new Error("Forbidden fake provider operation: " + init?.method + " " + path);
  };
  const service = createDriveUploadService({ database: f.db,
    access: createProjectDriveAccessService(accessDependencies(f.db, fetchImpl)), fetchImpl, keyRing: CORE_TEST_RING,
    databaseNowSeconds: () => sql<number>`100`,
  });
  return { ...f, h, service, cipher, row: async () => (await f.db.select().from(resources).where(eq(resources.id, ID)))[0] };
}

test("original member uploader adopts provider completion into exactly the same resource; repeated checks are read-only", async () => {
  const f = await fixture();
  assert.equal(await f.service.recover(auth(), input), "complete");
  const row = await f.row();
  assert.equal(row.id, ID); assert.equal(row.externalId, "completed-file"); assert.equal(row.accessState, "ok");
  assert.equal(row.storedPath, null); assert.equal(row.countsAgainstStorage, 0);
  assert.equal((await f.db.select().from(resources)).length, 1);
  const calls = f.h.calls.length;
  assert.equal(await f.service.recover(auth(), input), "complete");
  assert.equal(f.h.calls.length, calls);
});

test("expired capability adopts the exact marker in its original historical generation", async () => {
  const f = await fixture("gen-old"); f.h.status = 404;
  assert.equal(await f.service.recover(auth(), input), "complete");
  assert.equal((await f.row()).storageGenerationId, "gen-old");
  assert.equal(f.h.calls.filter(c => new URL(c.url).pathname === "/drive/v3/files").length, 1);
});

for (const state of ["incomplete", "expired-empty", "undelegated", "provider-failure"] as const) {
  test(`${state} keeps the claim and cannot mint, upload bytes, fall back or delete`, async () => {
    const f = await fixture();
    if (state === "incomplete") f.h.status = 308;
    if (state === "expired-empty") { f.h.status = 404; f.h.files = []; }
    if (state === "provider-failure") f.h.status = 503;
    if (state === "undelegated") await f.db.update(resources).set({ storedPath: null }).where(eq(resources.id, ID));
    const expected = state === "provider-failure" ? "unavailable" : "pending";
    assert.equal(await f.service.recover(auth(), input), expected);
    const row = await f.row(); assert.equal(row.accessState, "pending"); assert.equal(row.externalId, null);
    assert.equal(row.storedPath, state === "undelegated" ? null : f.cipher);
    assert.equal((await f.db.select().from(resources)).length, 1);
    assert.ok(f.h.calls.every(c => c.method === "GET" || c.method === "PUT" || c.url.includes("oauth2.googleapis.com/token")));
    if (state === "undelegated") assert.equal(f.h.calls.length, 0);
  });
}

for (const attack of ["other-member", "owner-not-uploader", "wrong-project", "wrong-task", "removed", "archived", "capability", "moved-task"] as const) {
  test(`${attack} is refused before any credential/provider call`, async () => {
    const f = await fixture(); let authorization = auth(); let request = input;
    if (attack === "other-member") authorization = coreAuthorization("member-b", "ws-a", false);
    if (attack === "owner-not-uploader") authorization = coreAuthorization("owner", "ws-a");
    if (attack === "wrong-project") authorization = coreAuthorization("member-a", "ws-b", false);
    if (attack === "wrong-task") request = { ...input, taskId: "task-b" };
    if (attack === "removed") await f.db.delete(workspaceMembers).where(eq(workspaceMembers.userId, "member-a"));
    if (attack === "archived") await f.db.update(workspaces).set({ archivedAt: new Date() }).where(eq(workspaces.id, "ws-a"));
    if (attack === "capability") Object.defineProperty(authorization.capabilities, "createOrEditTasks", { value: false });
    if (attack === "moved-task") await f.db.update(tasks).set({ workspaceId: "ws-b" }).where(eq(tasks.id, "task-a"));
    assert.equal(await f.service.recover(authorization, request), "unavailable");
    assert.equal(f.h.calls.length, 0); assert.equal((await f.row()).accessState, "pending");
  });
}

for (const who of ["member-a", "owner", "project"] as const) {
  for (const when of ["before", "during"] as const) {
    test(`${who} deletion/erasure fence ${when} provider work prevents adoption`, async () => {
      const f = await fixture();
      const fence = async () => {
        if (who === "project") {
          await createProjectDriveOperationJournal({ database: f.db, randomOperationId: () => "f0000000-0000-4000-8000-000000000001" })
            .prepare({ workspaceId: "ws-a", operationKind: "project_delete" });
        } else await f.db.insert(meta).values({ key: googleDriveAccountErasureFenceKey(who), value: "requested" });
      };
      if (when === "before") await fence(); else f.h.beforeProbe = fence;
      assert.equal(await f.service.recover(auth(), input), "unavailable");
      if (when === "before") assert.equal(f.h.calls.length, 0);
      assert.equal((await f.row()).accessState, "pending"); assert.equal((await f.row()).storedPath, f.cipher);
    });
  }
}

for (const mutation of ["remove-uploader", "archive", "move-task", "demote-storage-owner", "replace-session", "advance-lease", "replace-uploader"] as const) {
  test(`${mutation} between provider read and completion fails the final transaction`, async () => {
    const f = await fixture();
    f.h.beforeProbe = async () => {
      if (mutation === "remove-uploader") await f.db.delete(workspaceMembers).where(eq(workspaceMembers.userId, "member-a"));
      if (mutation === "archive") await f.db.update(workspaces).set({ archivedAt: new Date() }).where(eq(workspaces.id, "ws-a"));
      if (mutation === "move-task") await f.db.update(tasks).set({ workspaceId: "ws-b" }).where(eq(tasks.id, "task-a"));
      if (mutation === "demote-storage-owner") await f.db.update(workspaceMembers).set({ role: "member" }).where(eq(workspaceMembers.userId, "owner"));
      if (mutation === "replace-session") await f.db.update(resources).set({ storedPath: "changed-by-competing-mint", refreshedAt: 101 }).where(eq(resources.id, ID));
      if (mutation === "advance-lease") await f.db.update(resources).set({ refreshedAt: 101 }).where(eq(resources.id, ID));
      if (mutation === "replace-uploader") await f.db.update(resources).set({ addedByUserId: "member-b" }).where(eq(resources.id, ID));
    };
    assert.equal(await f.service.recover(auth(), input), "unavailable");
    assert.equal((await f.row()).accessState, "pending"); assert.equal((await f.row()).externalId, null);
  });
}

for (const bad of ["duplicate-marker", "wrong-parent", "wrong-marker", "wrong-size"] as const) {
  test(`${bad} is not completion evidence`, async () => {
    const f = await fixture();
    if (bad === "duplicate-marker") { f.h.status = 404; f.h.files.push({ ...f.h.file, id: "another-file" }); }
    if (bad === "wrong-parent") f.h.file.parents = ["folder-other"];
    if (bad === "wrong-marker") f.h.file.appProperties = { signalResourceId: "someone-else" };
    if (bad === "wrong-size") f.h.file.size = "99";
    assert.equal(await f.service.recover(auth(), input), "unavailable");
    assert.equal((await f.row()).accessState, "pending");
  });
}

test("overlapping recovery checks share the existing CAS and persist one canonical row", async () => {
  const f = await fixture();
  let release!: () => void; let reached!: () => void;
  const blocked = new Promise<void>(resolve => { release = resolve; });
  const atProbe = new Promise<void>(resolve => { reached = resolve; });
  f.h.beforeProbe = async () => { reached(); await blocked; };
  const first = f.service.recover(auth(), input); await atProbe;
  try { assert.equal(await f.service.recover(auth(), input), "complete"); } finally { release(); }
  assert.equal(await first, "unavailable");
  assert.equal((await f.db.select().from(resources)).length, 1); assert.equal((await f.row()).externalId, "completed-file");
});

test("an original-tab finalize can win during recovery without a second row or lost completion", async () => {
  const f = await fixture();
  f.h.beforeProbe = async () => { await f.service.finalize(auth(), { resourceId: ID, driveFileId: "completed-file" }); };
  assert.equal(await f.service.recover(auth(), input), "unavailable");
  assert.equal((await f.row()).accessState, "ok"); assert.equal((await f.db.select().from(resources)).length, 1);
});
