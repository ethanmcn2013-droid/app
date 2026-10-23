import assert from "node:assert/strict";
import { test } from "node:test";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { projectDriveSubfolders, workspaceMembers, workspaceStorage, meta } from "@/server/db/schema";
import { coreAuthorization, freshProjectDriveCoreDb, seedProjectDriveCore, seedStorageGenerations, jsonResponse } from "./project-drive-core.test.helpers";
import { createProjectDriveSubfolderService, PROJECT_DRIVE_SUBFOLDER_MARKER, type ProjectDriveSubfolderDependencies } from "./project-drive-subfolders";
import { assertProjectDriveSubfoldersSettled, reconcileProjectDriveSubfolderForErasure, retireProjectDriveSubfolders } from "./project-drive-subfolders-lifecycle";
import { googleDriveAccountErasureFenceKey } from "./project-drive-operation-lifecycle";
import { deleteProjectRowsInTransaction } from "@/server/projects/project-deletion-rows";
import { eraseAccountData } from "@/server/account-erasure";
import { boundedSubfolderProviderCall, canonicalSubfolderUrl } from "./project-drive-subfolders-provider";

async function fixture() {
  const core = await freshProjectDriveCoreDb();
  await seedProjectDriveCore(core.client); await seedStorageGenerations(core.client);
  await core.client.execute("DELETE FROM workspace_members WHERE workspace_id='ws-a' AND user_id != 'owner'");
  await core.client.execute("PRAGMA foreign_keys = ON");
  let clock = 1_000_000;
  let creates = 0;
  let duplicate = false;
  let missingSearch = false;
  let throwAfterCreate = false;
  let afterProvider: (() => Promise<void>) | undefined;
  const providerFolders: Record<string, unknown>[] = [];
  const calls: string[] = [];
  const deps: ProjectDriveSubfolderDependencies = {
    database: core.db,
    authorize: async (project) => coreAuthorization("owner", project!),
    now: () => new Date(clock),
    withSession: async (_authorization, _selector, operation) => operation({ accessToken: "fake-secret", credential: { id: "conn-new", ownerUserId: "owner", providerAccountId: "account-owner", providerAccountEmail: null, rootFolderId: "root-new" }, storageRootFolderId: "root-old", storage: { id: "gen-current", workspaceId: "ws-a", connectionId: "conn-old", folderId: "folder-current", folderWebViewLink: "https://drive.google.com/drive/folders/folder-current", state: "active", isCurrent: true } }),
    fetchImpl: async (url, init) => {
      const parsed = new URL(String(url));
      calls.push(`${init?.method ?? "GET"} ${parsed.pathname}`);
      if (parsed.pathname.includes("permissions")) throw new Error("Permission APIs forbidden");
      if (parsed.pathname.endsWith("/folder-current")) return jsonResponse({ id: "folder-current", name: "Project", mimeType: "application/vnd.google-apps.folder", trashed: false, parents: ["root-old"], appProperties: { signalWorkspaceId: "ws-a", signalStorageGenerationId: "gen-current" }, webViewLink: "https://drive.google.com/drive/folders/folder-current" });
      if (init?.method === "POST") {
        creates++;
        const body = JSON.parse(String(init.body));
        assert.deepEqual(body.parents, ["folder-current"]);
        assert.deepEqual(Object.keys(body.appProperties), [PROJECT_DRIVE_SUBFOLDER_MARKER]);
        const child = { ...body, id: `child-${creates}`, trashed: false, webViewLink: `https://drive.google.com/drive/folders/child-${creates}` };
        providerFolders.push(child);
        await afterProvider?.();
        if (throwAfterCreate) throw new Error("synthetic ambiguous network completion");
        return jsonResponse(child);
      }
      assert.ok(parsed.searchParams.get("q")?.includes("'folder-current' in parents"));
      return jsonResponse({ files: missingSearch ? [] : duplicate ? [...providerFolders, ...providerFolders] : providerFolders });
    },
  };
  const service = createProjectDriveSubfolderService(deps);
  const actor = { projectId: "ws-a", actorUserId: "owner" };
  async function prepared() {
    const bound = await service.bind({ ...actor, folderName: "Contracts" });
    const operationId = randomUUID();
    await service.prepare(bound, operationId);
    return { ...actor, operationId };
  }
  return { ...core, service, deps, actor, prepared, calls, providerFolders, get creates() { return creates; }, advance: () => { clock += 61_000; }, setDuplicate: () => { duplicate = true; }, setMissing: () => { missingSearch = true; }, setThrow: () => { throwAfterCreate = true; }, afterProvider: (callback: () => Promise<void>) => { afterProvider = callback; } };
}

test("creates exactly one immediate child and durable receipt; retries are idempotent and measured", async () => {
  const f = await fixture(); try {
    const locator = await f.prepared();
    assert.equal((await f.service.execute(locator)).status, "complete");
    assert.equal((await f.service.execute(locator)).status, "complete");
    assert.equal(f.creates, 1);
    const [saved] = await f.db.select().from(projectDriveSubfolders);
    assert.equal(saved.folderId, "child-1");
    assert.equal(saved.createStarted, true);
    assert.deepEqual(saved.providerDiagnostics.map(d => [d.stage, d.outcome]), [["parent_read", "success"], ["marker_search", "success"], ["name_search", "success"], ["folder_create", "success"]]);
    assert.equal(saved.providerCallCount, 4);
    assert.ok(saved.providerDiagnostics.every(d => d.durationMs >= 0));
    assert.ok(!JSON.stringify(saved.providerDiagnostics).includes("Contracts"));
    await assert.rejects(f.service.prepare(await f.service.bind({ ...f.actor, folderName: "Contracts" }), randomUUID()));
    await f.db.transaction(tx => retireProjectDriveSubfolders(tx, eq(projectDriveSubfolders.workspaceId, "ws-a")), { behavior: "immediate" });
    assert.equal((await f.db.select().from(projectDriveSubfolders)).length, 0);
    assert.equal(f.creates, 1);
  } finally { f.cleanup(); }
});

test("ambiguous create adopts original marker; absent search never blindly repeats create", async () => {
  const f = await fixture(); try {
    const locator = await f.prepared(); f.setThrow();
    assert.equal((await f.service.execute(locator)).status, "unknown");
    assert.equal(f.creates, 1);
    await assert.rejects(assertProjectDriveSubfoldersSettled(f.db, eq(projectDriveSubfolders.workspaceId, "ws-a")), /unresolved/);
    assert.equal((await f.service.execute(locator)).status, "complete");
    assert.equal(f.creates, 1);
  } finally { f.cleanup(); }
  const g = await fixture(); try {
    const locator = await g.prepared(); g.setThrow();
    await g.service.execute(locator); g.setMissing();
    assert.equal((await g.service.execute(locator)).status, "unknown");
    assert.equal(g.creates, 1);
  } finally { g.cleanup(); }
});

test("crash after accepted create retains original receipt and recovers without duplicate", async () => {
  const f = await fixture(); try {
    const service = createProjectDriveSubfolderService({ ...f.deps, afterCreate: async () => { throw new Error("crash"); } });
    const locator = await f.prepared();
    assert.equal((await service.execute(locator)).status, "unknown");
    const [row] = await f.db.select().from(projectDriveSubfolders);
    assert.equal(row.folderId, "child-1");
    assert.equal((await f.service.execute(locator)).status, "complete");
    assert.equal(f.creates, 1);
  } finally { f.cleanup(); }
});

test("duplicate operation markers require attention and preserve custody", async () => {
  const f = await fixture(); try {
    const locator = await f.prepared(); f.setThrow();
    await f.service.execute(locator); f.setDuplicate();
    assert.equal((await f.service.execute(locator)).status, "attention");
    assert.equal(f.creates, 1);
  } finally { f.cleanup(); }
});

test("changed generation, actor, role, archived Project and erasure fence refuse before provider I/O", async () => {
  for (const change of ["generation", "role", "archive", "erasure", "actor"] as const) {
    const f = await fixture(); try {
      const locator = await f.prepared();
      if (change === "generation") await f.db.update(workspaceStorage).set({ isCurrent: false }).where(eq(workspaceStorage.id, "gen-current"));
      if (change === "role") await f.db.update(workspaceMembers).set({ role: "member" }).where(eq(workspaceMembers.userId, "owner"));
      if (change === "archive") await f.client.execute("UPDATE workspaces SET archived_at=1 WHERE id='ws-a'");
      if (change === "erasure") await f.db.insert(meta).values({ key: googleDriveAccountErasureFenceKey("owner"), value: "active:v1" });
      await assert.rejects(f.service.execute(change === "actor" ? { ...locator, actorUserId: "outsider" } : locator));
      assert.equal(f.calls.length, 0, change);
    } finally { f.cleanup(); }
  }
});

test("post-provider role revocation retains provider acceptance and never reports completion", async () => {
  const f = await fixture(); try {
    const locator = await f.prepared();
    f.afterProvider(async () => { await f.db.update(workspaceMembers).set({ role: "member" }).where(eq(workspaceMembers.userId, "owner")); });
    assert.equal((await f.service.execute(locator)).status, "attention");
    const [row] = await f.db.select().from(projectDriveSubfolders);
    assert.equal(row.folderId, "child-1");
    assert.equal(f.creates, 1);
  } finally { f.cleanup(); }
});

test("Project deletion retires untouched and settled custody but refuses unresolved creation", async () => {
  const f = await fixture(); try {
    await f.prepared();
    await f.db.transaction(tx => deleteProjectRowsInTransaction(tx, "ws-a"), { behavior: "immediate" });
    assert.equal((await f.db.select().from(projectDriveSubfolders)).length, 0);
    assert.equal(f.calls.length, 0);
  } finally { f.cleanup(); }
  const g = await fixture(); try {
    const locator = await g.prepared(); g.setThrow(); await g.service.execute(locator);
    await assert.rejects(g.db.transaction(tx => deleteProjectRowsInTransaction(tx, "ws-a"), { behavior: "immediate" }), /unresolved/);
    assert.equal((await g.db.select().from(projectDriveSubfolders)).length, 1);
  } finally { g.cleanup(); }
});

test("rejects paths and foreign bindings", async () => {
  const f = await fixture(); try {
    for (const folderName of ["../x", "a/b", "a\\b", "", ".", "..", "x\n"]) {
      if (folderName === "x\n") continue; // surrounding whitespace is intentionally trimmed
      await assert.rejects(f.service.bind({ ...f.actor, folderName }));
    }
    const bound = await f.service.bind({ ...f.actor, folderName: "Contracts" });
    await assert.rejects(f.service.prepare({ ...bound, parentId: "foreign-parent" }, randomUUID()));
    assert.equal(f.calls.length, 0);
  } finally { f.cleanup(); }
});

test("real account erasure retires settled child receipts and leaves provider folders intact", async () => {
  const f = await fixture(); try {
    const locator = await f.prepared(); await f.service.execute(locator);
    await eraseAccountData(f.db, "clerk-owner", { openProviderToken: () => "synthetic-token", revokeProjectDriveRefreshToken: async () => {} });
    assert.equal((await f.db.select().from(projectDriveSubfolders)).length, 0);
    assert.equal(f.providerFolders.length, 1);
    assert.equal(f.creates, 1);
  } finally { f.cleanup(); }
});

test("real account erasure retains ambiguity, then read-only exact-marker recovery resumes under its fence", async () => {
  const f = await fixture(); try {
    const locator = await f.prepared(); f.setThrow(); await f.service.execute(locator);
    const options = { openProviderToken: () => "synthetic-token", revokeProjectDriveRefreshToken: async () => {} };
    await assert.rejects(eraseAccountData(f.db, "clerk-owner", options), /unresolved/);
    assert.equal((await f.db.select().from(projectDriveSubfolders)).length, 1);
    await eraseAccountData(f.db, "clerk-owner", { ...options, reconcilePendingDriveSubfolder: (actor, operationId) => reconcileProjectDriveSubfolderForErasure(f.db, actor, operationId, {
      withSession: async (_receipt, operation) => f.deps.withSession(coreAuthorization("owner", "ws-a"), { kind: "generation", storageGenerationId: "gen-current" }, operation),
      fetchImpl: f.deps.fetchImpl,
    }) });
    assert.equal((await f.db.select().from(projectDriveSubfolders)).length, 0);
    assert.equal(f.creates, 1);
  } finally { f.cleanup(); }
});

test("provider deadline aborts its request without pretending the physical promise settled", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  let signal: AbortSignal | undefined;
  let settle: (value: string) => void = () => {};
  const physical = new Promise<string>(resolve => { settle = resolve; });
  const pending = boundedSubfolderProviderCall(current => { signal = current; return physical; });
  t.mock.timers.tick(15_000);
  await assert.rejects(pending, /deadline/);
  assert.equal(signal?.aborted, true);
  settle("accepted later");
  assert.equal(await physical, "accepted later");
  assert.equal(canonicalSubfolderUrl("safe_123"), "https://drive.google.com/drive/folders/safe_123");
  assert.throws(() => canonicalSubfolderUrl("https://attacker.test"));
});
