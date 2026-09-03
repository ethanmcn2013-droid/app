import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { afterEach, describe, it } from "node:test";
import { and, eq, sql, type SQL } from "drizzle-orm";
import { MAX_UPLOAD_BYTES } from "@/lib/upload-limit";
import {
  driveUploadSessionAadContext,
  isSealed,
  open,
} from "@/server/crypto/secret-box";
import {
  driveFolderGrants,
  meta,
  resources,
  workspaceMembers,
  workspaceStorage,
} from "@/server/db/schema";
import {
  createDriveUploadService,
  DRIVE_RESOURCE_MARKER,
  DriveUploadError,
} from "./drive-uploads";
import { createProjectDriveAccessService } from "./project-drive-access";
import { ProjectDriveAuthorizationError } from "./project-drive-authz";
import {
  GOOGLE_DRIVE_ACCOUNT_ERASURE_FENCE_VALUE,
  googleDriveAccountErasureFenceKey,
} from "./project-drive-operation-lifecycle";
import {
  listPendingDelegatedDriveUploadReceiptsForAccount,
  listPendingDelegatedDriveUploadReceiptsForWorkspace,
} from "./project-drive-upload-receipts";
import {
  accessDependencies,
  CORE_TEST_RING,
  coreAuthorization,
  freshProjectDriveCoreDb,
  jsonResponse,
  seedProjectDriveCore,
  seedStorageGenerations,
  tokenRefreshResponse,
} from "./project-drive-core.test.helpers";
import type {
  GoogleDriveFile,
  GoogleDriveStorageQuota,
} from "./google-drive";

const RESOURCE_A = "a0000000-0000-4000-8000-000000000001";
const RESOURCE_B = "b0000000-0000-4000-8000-000000000002";

const DEFAULT_REQUEST = Object.freeze({
  resourceId: RESOURCE_A,
  taskId: "task-a",
  name: "brief.pdf",
  mimeType: "application/pdf",
  sizeBytes: 5 * 1024 * 1024,
});

const cleanups: Array<() => void> = [];
afterEach(() => {
  while (cleanups.length) cleanups.pop()?.();
});

function driveFile(
  id: string,
  resourceId: string,
  overrides: Partial<GoogleDriveFile> = {},
): GoogleDriveFile {
  return Object.freeze({
    id,
    name: DEFAULT_REQUEST.name,
    mimeType: DEFAULT_REQUEST.mimeType,
    parents: Object.freeze(["folder-current"]),
    appProperties: Object.freeze({ [DRIVE_RESOURCE_MARKER]: resourceId }),
    size: String(DEFAULT_REQUEST.sizeBytes),
    webViewLink: `https://drive.google.com/file/d/${id}/view`,
    trashed: false,
    ...overrides,
  });
}

function wireFile(file: GoogleDriveFile): Record<string, unknown> {
  return {
    id: file.id,
    name: file.name,
    mimeType: file.mimeType,
    parents: file.parents,
    appProperties: file.appProperties,
    size: file.size,
    webViewLink: file.webViewLink,
    trashed: file.trashed,
  };
}

class GoogleHarness {
  calls: Array<{ url: string; init?: RequestInit }> = [];
  listFiles: GoogleDriveFile[] = [];
  fileById = new Map<string, GoogleDriveFile>();
  probeResponses: Response[] = [];
  quota: GoogleDriveStorageQuota = {
    limit: "9007199254740993000",
    usage: "9007199254688564200",
    usageInDrive: "1",
    usageInDriveTrash: "0",
  };
  sessionCreateCalls = 0;
  beforeNextAbout: (() => Promise<void>) | null = null;
  beforeNextFileGet: (() => Promise<void>) | null = null;
  beforeNextList: (() => Promise<void>) | null = null;
  beforeNextSessionCreate: (() => Promise<void>) | null = null;

  fetch: typeof fetch = async (input, init) => {
    const url = String(input);
    this.calls.push({ url, init });
    if (url.includes("oauth2.googleapis.com/token")) {
      return tokenRefreshResponse(`request-access-${this.calls.length}`);
    }
    if (url.includes("/drive/v3/about")) {
      const beforeAbout = this.beforeNextAbout;
      this.beforeNextAbout = null;
      if (beforeAbout) await beforeAbout();
      return jsonResponse({
        user: { permissionId: "account-owner", emailAddress: "owner@example.com" },
        storageQuota: this.quota,
      });
    }
    if (url.includes("/upload/drive/v3/files") && init?.method === "POST") {
      const beforeSessionCreate = this.beforeNextSessionCreate;
      this.beforeNextSessionCreate = null;
      if (beforeSessionCreate) await beforeSessionCreate();
      this.sessionCreateCalls += 1;
      return new Response(null, {
        status: 200,
        headers: {
          location:
            `https://www.googleapis.com/upload/drive/v3/files?` +
            `uploadType=resumable&upload_id=session-${this.sessionCreateCalls}`,
        },
      });
    }
    if (url.includes("upload_id=") && init?.method === "PUT") {
      return this.probeResponses.shift() ?? new Response(null, { status: 503 });
    }
    const parsed = new URL(url);
    if (parsed.pathname === "/drive/v3/files" && init?.method === "GET") {
      const beforeList = this.beforeNextList;
      this.beforeNextList = null;
      if (beforeList) await beforeList();
      return jsonResponse({ files: this.listFiles.map(wireFile) });
    }
    const match = parsed.pathname.match(/^\/drive\/v3\/files\/(.+)$/);
    if (match && init?.method === "GET") {
      const beforeFileGet = this.beforeNextFileGet;
      this.beforeNextFileGet = null;
      if (beforeFileGet) await beforeFileGet();
      const file = this.fileById.get(decodeURIComponent(match[1]));
      return file
        ? jsonResponse(wireFile(file))
        : jsonResponse({ error: { status: "NOT_FOUND" } }, 404);
    }
    throw new Error(`unexpected fake Google call: ${init?.method} ${url}`);
  };
}

async function seededUploadFixture(
  harness = new GoogleHarness(),
  options: Readonly<{ databaseNowSeconds?: () => SQL<number> }> = {},
) {
  const fixture = await freshProjectDriveCoreDb();
  cleanups.push(fixture.cleanup);
  await seedProjectDriveCore(fixture.client);
  await seedStorageGenerations(fixture.client);
  await fixture.client.executeMultiple(`
    INSERT INTO tasks (
      id, workspace_id, title, lane, priority, assignees, created_at, updated_at
    ) VALUES
      ('task-a', 'ws-a', 'Task A', 'todo', 'medium', '[]', 10, 10),
      ('task-b', 'ws-b', 'Task B', 'todo', 'medium', '[]', 10, 10);
    INSERT INTO drive_folder_grants (
      storage_generation_id, workspace_id, user_id, permission_id,
      granted_email, role, granted_at, revoke_pending
    ) VALUES
      ('gen-current', 'ws-a', 'member-a', 'permission-a',
       'member.a@example.com', 'writer', 10, 0),
      ('gen-current', 'ws-a', 'member-b', 'permission-b',
       'member.b@example.com', 'writer', 10, 0);
  `);
  const access = createProjectDriveAccessService(
    accessDependencies(fixture.db, harness.fetch),
  );
  return {
    ...fixture,
    harness,
    access,
    service: createDriveUploadService({
      database: fixture.db,
      access,
      fetchImpl: harness.fetch,
      keyRing: CORE_TEST_RING,
      databaseNowSeconds: options.databaseNowSeconds,
    }),
  };
}

describe("Project Drive upload foundation", () => {
  it("requires task-edit capability before database or provider work", async () => {
    let providerCalls = 0;
    const fixture = await seededUploadFixture();
    fixture.harness.fetch = async () => {
      providerCalls += 1;
      throw new Error("provider must not be reached");
    };
    const authorization = coreAuthorization("member-a", "ws-a", false);
    Object.defineProperty(authorization.capabilities, "createOrEditTasks", {
      value: false,
    });
    await assert.rejects(
      () => fixture.service.start(authorization, DEFAULT_REQUEST),
      ProjectDriveAuthorizationError,
    );
    assert.equal(providerCalls, 0);
  });

  it("mints one exact session, returns plaintext only to the caller, and stores ciphertext bound to the claim", async () => {
    const fixture = await seededUploadFixture();
    const result = await fixture.service.start(
      coreAuthorization("member-a", "ws-a", false),
      DEFAULT_REQUEST,
    );
    assert.equal(result.kind, "drive-session");
    if (result.kind !== "drive-session") return;
    assert.match(result.sessionUrl, /upload_id=session-1/);
    assert.equal(result.startOffset, 0);
    assert.equal(fixture.harness.sessionCreateCalls, 1);

    const [row] = await fixture.db
      .select()
      .from(resources)
      .where(eq(resources.id, RESOURCE_A));
    assert.equal(row.workspaceId, "ws-a");
    assert.equal(row.taskId, "task-a");
    assert.equal(row.storageGenerationId, "gen-current");
    assert.equal(row.accessState, "pending");
    assert.equal(row.countsAgainstStorage, 0);
    assert.ok(row.storedPath && isSealed(row.storedPath));
    assert.equal(row.storedPath.includes(result.sessionUrl), false);
    assert.equal(
      open(
        row.storedPath,
        driveUploadSessionAadContext("ws-a", "gen-current", RESOURCE_A),
        CORE_TEST_RING,
      ),
      result.sessionUrl,
    );
    assert.throws(() =>
      open(
        row.storedPath!,
        driveUploadSessionAadContext("ws-b", "gen-current", RESOURCE_A),
        CORE_TEST_RING,
      ),
    );

    const listCall = fixture.harness.calls.find((call) => {
      const url = new URL(call.url);
      return url.pathname === "/drive/v3/files" && call.init?.method === "GET";
    });
    assert.ok(listCall);
    const query = new URL(listCall.url).searchParams.get("q") ?? "";
    assert.match(query, /signalResourceId/);
    assert.doesNotMatch(query, /in parents/);
    const mintCall = fixture.harness.calls.find((call) =>
      call.url.includes("/upload/drive/v3/files"),
    );
    assert.deepEqual(JSON.parse(String(mintCall?.init?.body)), {
      name: DEFAULT_REQUEST.name,
      parents: ["folder-current"],
      appProperties: { [DRIVE_RESOURCE_MARKER]: RESOURCE_A },
    });
  });

  it("uses database time for the lease CAS so application-clock skew cannot reclaim early", async () => {
    const fixture = await seededUploadFixture(new GoogleHarness(), {
      databaseNowSeconds: () => sql<number>`1001`,
    });
    await fixture.db.insert(resources).values({
      id: RESOURCE_A,
      workspaceId: "ws-a",
      taskId: "task-a",
      kind: "upload",
      provider: "drive",
      storage: "drive",
      storageGenerationId: "gen-current",
      storedPath: null,
      title: DEFAULT_REQUEST.name,
      mimeType: DEFAULT_REQUEST.mimeType,
      sizeBytes: DEFAULT_REQUEST.sizeBytes,
      addedByUserId: "member-a",
      addedAt: 900,
      refreshedAt: 1000,
      accessState: "pending",
      countsAgainstStorage: 0,
    });

    const early = await fixture.service.start(
      coreAuthorization("member-a", "ws-a", false),
      DEFAULT_REQUEST,
    );
    assert.deepEqual(early, {
      kind: "paused",
      resourceId: RESOURCE_A,
      reason: "claim-busy",
    });
    assert.equal(fixture.harness.sessionCreateCalls, 0);
    const [stillLeased] = await fixture.db
      .select({ refreshedAt: resources.refreshedAt })
      .from(resources)
      .where(eq(resources.id, RESOURCE_A));
    assert.equal(stillLeased.refreshedAt, 1000);

    const afterDatabaseLease = createDriveUploadService({
      database: fixture.db,
      access: fixture.access,
      fetchImpl: fixture.harness.fetch,
      keyRing: CORE_TEST_RING,
      databaseNowSeconds: () => sql<number>`1300`,
    });
    const reclaimed = await afterDatabaseLease.start(
      coreAuthorization("member-a", "ws-a", false),
      DEFAULT_REQUEST,
    );
    assert.equal(reclaimed.kind, "drive-session");
    assert.equal(fixture.harness.sessionCreateCalls, 1);
  });

  it("keeps each active delegated receipt queryable by both account lineages", async () => {
    const fixture = await seededUploadFixture();
    await fixture.service.start(
      coreAuthorization("member-a", "ws-a", false),
      DEFAULT_REQUEST,
    );
    const [
      byActor,
      byStorageOwner,
      byWorkspace,
      unrelatedAccount,
      unrelatedWorkspace,
    ] = await Promise.all([
      listPendingDelegatedDriveUploadReceiptsForAccount(
        fixture.db,
        "member-a",
      ),
      listPendingDelegatedDriveUploadReceiptsForAccount(fixture.db, "owner"),
      listPendingDelegatedDriveUploadReceiptsForWorkspace(fixture.db, "ws-a"),
      listPendingDelegatedDriveUploadReceiptsForAccount(
        fixture.db,
        "outsider",
      ),
      listPendingDelegatedDriveUploadReceiptsForWorkspace(fixture.db, "ws-b"),
    ]);
    assert.equal(byActor.length, 1);
    assert.deepEqual(byStorageOwner, byActor);
    assert.deepEqual(byWorkspace, byActor);
    assert.equal(unrelatedAccount.length, 0);
    assert.equal(unrelatedWorkspace.length, 0);
    assert.equal(byActor[0].resourceId, RESOURCE_A);
    assert.equal(byActor[0].taskId, "task-a");
    assert.equal(byActor[0].storageGenerationId, "gen-current");
    assert.equal(byActor[0].connectionId, "conn-old");
    assert.equal(byActor[0].folderId, "folder-current");
    assert.equal(byActor[0].actorUserId, "member-a");
    assert.equal(byActor[0].storageOwnerUserId, "owner");
    assert.equal(byActor[0].title, DEFAULT_REQUEST.name);
    assert.equal(byActor[0].mimeType, DEFAULT_REQUEST.mimeType);
    assert.equal(byActor[0].sizeBytes, DEFAULT_REQUEST.sizeBytes);
    assert.equal(byActor[0].externalId, null);
    assert.equal(byActor[0].url, null);
    assert.equal(byActor[0].countsAgainstStorage, 0);
    assert.equal(typeof byActor[0].refreshedAt, "number");
    assert.equal(isSealed(byActor[0].sessionCipher), true);

    await fixture.db
      .update(resources)
      .set({ accessState: "ok", storedPath: null })
      .where(eq(resources.id, RESOURCE_A));
    assert.deepEqual(
      await listPendingDelegatedDriveUploadReceiptsForAccount(
        fixture.db,
        "member-a",
      ),
      [],
    );
  });

  it("uses Signal-native storage when any live member lacks a current grant, without touching Google", async () => {
    const fixture = await seededUploadFixture();
    await fixture.db
      .delete(driveFolderGrants)
      .where(
        and(
          eq(driveFolderGrants.storageGenerationId, "gen-current"),
          eq(driveFolderGrants.userId, "member-b"),
        ),
      );
    const result = await fixture.service.start(
      coreAuthorization("member-a", "ws-a", false),
      DEFAULT_REQUEST,
    );
    assert.deepEqual(result, {
      kind: "signal-native",
      reason: "member-access-incomplete",
    });
    assert.equal(fixture.harness.calls.length, 0);
    assert.equal((await fixture.db.select().from(resources)).length, 0);
  });

  it("blocks a new claim when either the actor or storage-owner lineage is fenced", async () => {
    for (const fencedUserId of ["member-a", "owner"]) {
      const fixture = await seededUploadFixture();
      await fixture.db.insert(meta).values({
        key: googleDriveAccountErasureFenceKey(fencedUserId),
        value: GOOGLE_DRIVE_ACCOUNT_ERASURE_FENCE_VALUE,
      });
      await assert.rejects(
        () =>
          fixture.service.start(
            coreAuthorization("member-a", "ws-a", false),
            DEFAULT_REQUEST,
          ),
        (error: unknown) =>
          error instanceof DriveUploadError &&
          error.code === "request-conflict",
      );
      assert.equal(fixture.harness.sessionCreateCalls, 0);
      assert.equal(
        (await fixture.db.select().from(resources)).length,
        0,
      );
    }
  });

  it("rechecks both DB lineages in the session-mint transaction after the claim", async () => {
    const fixture = await seededUploadFixture();
    fixture.harness.beforeNextList = async () => {
      await fixture.db.insert(meta).values({
        key: googleDriveAccountErasureFenceKey("owner"),
        value: GOOGLE_DRIVE_ACCOUNT_ERASURE_FENCE_VALUE,
      });
    };
    await assert.rejects(
      () =>
        fixture.service.start(
          coreAuthorization("member-a", "ws-a", false),
          DEFAULT_REQUEST,
        ),
      (error: unknown) =>
        error instanceof DriveUploadError &&
        error.code === "request-conflict",
    );
    assert.equal(fixture.harness.sessionCreateCalls, 0);
    assert.equal((await fixture.db.select().from(resources)).length, 0);
  });

  it("does not hold a DB writer lock across mint and withholds an unpersisted URI", async () => {
    const fixture = await seededUploadFixture();
    fixture.harness.beforeNextSessionCreate = async () => {
      // This write would deadlock if the provider call still ran under the
      // resource claim's SQLite/libSQL writer transaction.
      await fixture.db.insert(meta).values({
        key: googleDriveAccountErasureFenceKey("owner"),
        value: GOOGLE_DRIVE_ACCOUNT_ERASURE_FENCE_VALUE,
      });
    };
    await assert.rejects(
      () =>
        fixture.service.start(
          coreAuthorization("member-a", "ws-a", false),
          DEFAULT_REQUEST,
        ),
      (error: unknown) =>
        error instanceof DriveUploadError &&
        error.code === "request-conflict",
    );
    assert.equal(fixture.harness.sessionCreateCalls, 1);
    assert.equal((await fixture.db.select().from(resources)).length, 0);
  });

  it("returns the same neutral conflict when either DB lineage is missing", async () => {
    for (const missingUserId of ["member-a", "owner"]) {
      const fixture = await seededUploadFixture();
      await fixture.client.execute({
        sql: "DELETE FROM users WHERE id = ?",
        args: [missingUserId],
      });
      await assert.rejects(
        () =>
          fixture.service.start(
            coreAuthorization("member-a", "ws-a", false),
            DEFAULT_REQUEST,
          ),
        (error: unknown) =>
          error instanceof DriveUploadError &&
          error.code === "request-conflict",
      );
      assert.equal(fixture.harness.sessionCreateCalls, 0);
      assert.equal(
        (await fixture.db.select().from(resources)).length,
        0,
      );
    }
  });

  it("cannot delegate after the actor leaves or the storage owner loses owner status", async () => {
    const removedActor = await seededUploadFixture();
    await removedActor.db
      .delete(workspaceMembers)
      .where(
        and(
          eq(workspaceMembers.workspaceId, "ws-a"),
          eq(workspaceMembers.userId, "member-a"),
        ),
      );
    await assert.rejects(
      () =>
        removedActor.service.start(
          coreAuthorization("member-a", "ws-a", false),
          DEFAULT_REQUEST,
        ),
      (error: unknown) =>
        error instanceof DriveUploadError && error.code === "request-conflict",
    );
    assert.equal(removedActor.harness.sessionCreateCalls, 0);
    assert.equal((await removedActor.db.select().from(resources)).length, 0);

    const demotedOwner = await seededUploadFixture();
    await demotedOwner.db
      .update(workspaceMembers)
      .set({ role: "member" })
      .where(
        and(
          eq(workspaceMembers.workspaceId, "ws-a"),
          eq(workspaceMembers.userId, "owner"),
        ),
      );
    const demotedResult = await demotedOwner.service.start(
      coreAuthorization("member-a", "ws-a", false),
      { ...DEFAULT_REQUEST, resourceId: RESOURCE_B },
    );
    assert.deepEqual(demotedResult, {
      kind: "signal-native",
      reason: "member-access-incomplete",
    });
    assert.equal(demotedOwner.harness.sessionCreateCalls, 0);
    assert.equal((await demotedOwner.db.select().from(resources)).length, 0);
  });

  it("uses Signal-native storage unless the selected generation is current and active", async () => {
    const fixture = await seededUploadFixture();
    await fixture.db
      .update(workspaceStorage)
      .set({ state: "needs_reauth" })
      .where(eq(workspaceStorage.id, "gen-current"));
    const result = await fixture.service.start(
      coreAuthorization("member-a", "ws-a", false),
      DEFAULT_REQUEST,
    );
    assert.deepEqual(result, {
      kind: "signal-native",
      reason: "storage-unavailable",
    });
    assert.equal(fixture.harness.calls.length, 0);
  });

  it("rechecks current generation in the claim CAS so handover cannot retarget a new upload", async () => {
    const fixture = await seededUploadFixture();
    fixture.harness.beforeNextAbout = async () => {
      await fixture.client.executeMultiple(`
        UPDATE workspace_storage SET is_current = 0
        WHERE id = 'gen-current';
        INSERT INTO workspace_storage (
          id, workspace_id, connection_id, folder_id, folder_web_view_link,
          state, is_current
        ) VALUES (
          'gen-race-winner', 'ws-a', 'conn-new', 'folder-race-winner',
          'https://drive.google.com/drive/folders/folder-race-winner',
          'active', 1
        );
      `);
    };
    await assert.rejects(
      () =>
        fixture.service.start(
          coreAuthorization("member-a", "ws-a", false),
          DEFAULT_REQUEST,
        ),
      (error: unknown) =>
        error instanceof DriveUploadError &&
        error.code === "request-conflict",
    );
    assert.equal(fixture.harness.sessionCreateCalls, 0);
    assert.equal((await fixture.db.select().from(resources)).length, 0);
  });

  it("enforces the founder-approved product maximum before any provider call", async () => {
    const fixture = await seededUploadFixture();
    await assert.rejects(
      () =>
        fixture.service.start(coreAuthorization("member-a", "ws-a", false), {
          ...DEFAULT_REQUEST,
          sizeBytes: MAX_UPLOAD_BYTES + 1,
        }),
      (error: unknown) =>
        error instanceof DriveUploadError && error.code === "invalid-input",
    );
    assert.equal(fixture.harness.calls.length, 0);

    const accepted = await fixture.service.start(
      coreAuthorization("member-a", "ws-a", false),
      { ...DEFAULT_REQUEST, resourceId: RESOURCE_B, sizeBytes: MAX_UPLOAD_BYTES },
    );
    assert.equal(accepted.kind, "drive-session");
  });

  it("checks provider quota with bigint precision and falls back when the exact total will not fit", async () => {
    const fixture = await seededUploadFixture();
    fixture.harness.quota = {
      limit: "9007199254740993000",
      usage: String(
        BigInt("9007199254740993000") -
          BigInt(DEFAULT_REQUEST.sizeBytes) +
          BigInt(1),
      ),
      usageInDrive: "1",
      usageInDriveTrash: "0",
    };
    const result = await fixture.service.start(
      coreAuthorization("member-a", "ws-a", false),
      DEFAULT_REQUEST,
    );
    assert.deepEqual(result, { kind: "signal-native", reason: "quota-full" });
    assert.equal(fixture.harness.sessionCreateCalls, 0);
    const [storage] = await fixture.db
      .select()
      .from(workspaceStorage)
      .where(eq(workspaceStorage.id, "gen-current"));
    assert.equal(storage.state, "quota_full");
  });

  it("treats a missing quota limit as unlimited rather than zero", async () => {
    const fixture = await seededUploadFixture();
    fixture.harness.quota = {
      limit: null,
      usage: null,
      usageInDrive: "1",
      usageInDriveTrash: "0",
    };
    const result = await fixture.service.start(
      coreAuthorization("member-a", "ws-a", false),
      DEFAULT_REQUEST,
    );
    assert.equal(result.kind, "drive-session");
  });

  it("rejects a foreign task before Google is called", async () => {
    const fixture = await seededUploadFixture();
    await assert.rejects(
      () =>
        fixture.service.start(coreAuthorization("member-a", "ws-a", false), {
          ...DEFAULT_REQUEST,
          taskId: "task-b",
        }),
      (error: unknown) =>
        error instanceof DriveUploadError && error.code === "not-found",
    );
    assert.equal(fixture.harness.calls.length, 0);
  });

  it("reuses the encrypted session and resumes from Google's confirmed offset", async () => {
    const fixture = await seededUploadFixture();
    const authorization = coreAuthorization("member-a", "ws-a", false);
    await fixture.service.start(authorization, DEFAULT_REQUEST);
    fixture.harness.probeResponses.push(
      new Response(null, {
        status: 308,
        headers: { Range: "bytes=0-1048575" },
      }),
    );
    const retry = await fixture.service.start(authorization, DEFAULT_REQUEST);
    assert.equal(retry.kind, "drive-session");
    if (retry.kind !== "drive-session") return;
    assert.equal(retry.startOffset, 1_048_576);
    assert.match(retry.sessionUrl, /upload_id=session-1/);
    assert.equal(fixture.harness.sessionCreateCalls, 1);
  });

  it("pins delegated retry and finalize to generation A after generation B becomes current", async () => {
    const fixture = await seededUploadFixture();
    const authorization = coreAuthorization("member-a", "ws-a", false);
    await fixture.service.start(authorization, DEFAULT_REQUEST);
    await fixture.service.start(authorization, {
      ...DEFAULT_REQUEST,
      resourceId: RESOURCE_B,
    });
    await fixture.client.executeMultiple(`
      UPDATE workspace_storage SET is_current = 0
      WHERE id = 'gen-current';
      INSERT INTO workspace_storage (
        id, workspace_id, connection_id, folder_id, folder_web_view_link,
        state, is_current
      ) VALUES (
        'gen-replacement', 'ws-a', 'conn-new', 'folder-replacement',
        'https://drive.google.com/drive/folders/folder-replacement',
        'active', 1
      );
      DELETE FROM drive_folder_grants WHERE workspace_id = 'ws-a';
    `);

    fixture.harness.probeResponses.push(
      new Response(null, {
        status: 308,
        headers: { Range: "bytes=0-511" },
      }),
    );
    const retry = await fixture.service.start(authorization, DEFAULT_REQUEST);
    assert.equal(retry.kind, "drive-session");
    if (retry.kind !== "drive-session") return;
    assert.equal(retry.startOffset, 512);
    assert.match(retry.sessionUrl, /upload_id=session-1/);
    assert.equal(fixture.harness.sessionCreateCalls, 2);

    fixture.harness.fileById.set(
      "file-wrong-generation",
      driveFile("file-wrong-generation", RESOURCE_B, {
        parents: Object.freeze(["folder-replacement"]),
      }),
    );
    await assert.rejects(
      () =>
        fixture.service.finalize(authorization, {
          resourceId: RESOURCE_B,
          driveFileId: "file-wrong-generation",
        }),
      (error: unknown) =>
        error instanceof DriveUploadError && error.code === "file-invalid",
    );

    fixture.harness.fileById.set(
      "file-old-generation",
      driveFile("file-old-generation", RESOURCE_A),
    );
    const finalized = await fixture.service.finalize(authorization, {
      resourceId: RESOURCE_A,
      driveFileId: "file-old-generation",
    });
    assert.equal(finalized.outcome, "finalized");
    const [stored] = await fixture.db
      .select()
      .from(resources)
      .where(eq(resources.id, RESOURCE_A));
    assert.equal(stored.storageGenerationId, "gen-current");
    assert.equal(stored.externalId, "file-old-generation");
  });

  it("remints only after an exact session 404 and a marker search miss", async () => {
    const fixture = await seededUploadFixture();
    const authorization = coreAuthorization("member-a", "ws-a", false);
    await fixture.service.start(authorization, DEFAULT_REQUEST);
    fixture.harness.probeResponses.push(new Response(null, { status: 404 }));
    const retry = await fixture.service.start(authorization, DEFAULT_REQUEST);
    assert.equal(retry.kind, "drive-session");
    if (retry.kind !== "drive-session") return;
    assert.match(retry.sessionUrl, /upload_id=session-2/);
    assert.equal(fixture.harness.sessionCreateCalls, 2);

    fixture.harness.probeResponses.push(new Response(null, { status: 503 }));
    const ambiguous = await fixture.service.start(authorization, DEFAULT_REQUEST);
    assert.deepEqual(ambiguous, {
      kind: "paused",
      resourceId: RESOURCE_A,
      reason: "provider-unavailable",
    });
    assert.equal(fixture.harness.sessionCreateCalls, 2);
  });

  it("does not remint an expired session after either account lineage is fenced", async () => {
    const fixture = await seededUploadFixture();
    const authorization = coreAuthorization("member-a", "ws-a", false);
    await fixture.service.start(authorization, DEFAULT_REQUEST);
    const [beforeFence] = await fixture.db
      .select({ storedPath: resources.storedPath })
      .from(resources)
      .where(eq(resources.id, RESOURCE_A));
    await fixture.db.insert(meta).values({
      key: googleDriveAccountErasureFenceKey("member-a"),
      value: GOOGLE_DRIVE_ACCOUNT_ERASURE_FENCE_VALUE,
    });
    fixture.harness.probeResponses.push(new Response(null, { status: 404 }));

    await assert.rejects(
      () => fixture.service.start(authorization, DEFAULT_REQUEST),
      (error: unknown) =>
        error instanceof DriveUploadError &&
        error.code === "request-conflict",
    );
    assert.equal(fixture.harness.sessionCreateCalls, 1);
    const [afterFence] = await fixture.db
      .select({ storedPath: resources.storedPath })
      .from(resources)
      .where(eq(resources.id, RESOURCE_A));
    assert.equal(afterFence.storedPath, beforeFence.storedPath);
  });

  it("adopts the one globally marked file after 404 and never mints a duplicate", async () => {
    const fixture = await seededUploadFixture();
    const authorization = coreAuthorization("member-a", "ws-a", false);
    await fixture.service.start(authorization, DEFAULT_REQUEST);
    fixture.harness.probeResponses.push(new Response(null, { status: 404 }));
    fixture.harness.listFiles = [driveFile("file-landed", RESOURCE_A)];
    const retry = await fixture.service.start(authorization, DEFAULT_REQUEST);
    assert.equal(retry.kind, "complete");
    if (retry.kind !== "complete") return;
    assert.equal(retry.fileId, "file-landed");
    assert.equal(retry.outcome, "adopted");
    assert.equal(fixture.harness.sessionCreateCalls, 1);
    const [row] = await fixture.db
      .select()
      .from(resources)
      .where(eq(resources.id, RESOURCE_A));
    assert.equal(row.externalId, "file-landed");
    assert.equal(row.storedPath, null);
    assert.equal(row.accessState, "ok");
  });

  it("refuses duplicate markers and a marker in the wrong parent without minting", async () => {
    for (const files of [
      [driveFile("duplicate-a", RESOURCE_A), driveFile("duplicate-b", RESOURCE_A)],
      [
        driveFile("wrong-parent", RESOURCE_A, {
          parents: Object.freeze(["folder-other"]),
        }),
      ],
    ]) {
      const fixture = await seededUploadFixture();
      fixture.harness.listFiles = files;
      await assert.rejects(
        () =>
          fixture.service.start(
            coreAuthorization("member-a", "ws-a", false),
            DEFAULT_REQUEST,
          ),
        (error: unknown) =>
          error instanceof DriveUploadError &&
          (error.code === "marker-ambiguous" || error.code === "marker-invalid"),
      );
      assert.equal(fixture.harness.sessionCreateCalls, 0);
    }
  });

  it("finalizes only the provider-read file with the exact marker and single parent", async () => {
    const fixture = await seededUploadFixture();
    const authorization = coreAuthorization("member-a", "ws-a", false);
    await fixture.service.start(authorization, DEFAULT_REQUEST);
    fixture.harness.fileById.set(
      "file-final",
      driveFile("file-final", RESOURCE_A, { name: "Provider brief.pdf" }),
    );
    const result = await fixture.service.finalize(authorization, {
      resourceId: RESOURCE_A,
      driveFileId: "file-final",
    });
    assert.deepEqual(result, {
      resourceId: RESOURCE_A,
      fileId: "file-final",
      webViewLink: "https://drive.google.com/file/d/file-final/view",
      outcome: "finalized",
    });
    const [row] = await fixture.db
      .select()
      .from(resources)
      .where(eq(resources.id, RESOURCE_A));
    assert.equal(row.title, "Provider brief.pdf");
    assert.equal(row.mimeType, DEFAULT_REQUEST.mimeType);
    assert.equal(row.sizeBytes, DEFAULT_REQUEST.sizeBytes);
    assert.equal(row.storedPath, null);
    assert.equal(row.accessState, "ok");
  });

  it("uses an exact fenced receipt CAS after provider verification", async () => {
    for (const fencedUserId of ["member-a", "owner"]) {
      const fixture = await seededUploadFixture();
      const authorization = coreAuthorization("member-a", "ws-a", false);
      await fixture.service.start(authorization, DEFAULT_REQUEST);
      fixture.harness.fileById.set(
        "file-final",
        driveFile("file-final", RESOURCE_A),
      );
      fixture.harness.beforeNextFileGet = async () => {
        await fixture.db.insert(meta).values({
          key: googleDriveAccountErasureFenceKey(fencedUserId),
          value: GOOGLE_DRIVE_ACCOUNT_ERASURE_FENCE_VALUE,
        });
      };

      await assert.rejects(
        () =>
          fixture.service.finalize(authorization, {
            resourceId: RESOURCE_A,
            driveFileId: "file-final",
          }),
        (error: unknown) =>
          error instanceof DriveUploadError &&
          error.code === "request-conflict",
      );
      const [row] = await fixture.db
        .select()
        .from(resources)
        .where(eq(resources.id, RESOURCE_A));
      assert.equal(row.accessState, "pending");
      assert.equal(row.externalId, null);
      assert.equal(row.url, null);
      assert.ok(row.storedPath && isSealed(row.storedPath));
    }
  });

  it("does not attach a stale provider result after request mutation or removal", async () => {
    const mutated = await seededUploadFixture();
    const authorization = coreAuthorization("member-a", "ws-a", false);
    await mutated.service.start(authorization, DEFAULT_REQUEST);
    mutated.harness.fileById.set(
      "file-final",
      driveFile("file-final", RESOURCE_A),
    );
    mutated.harness.beforeNextFileGet = async () => {
      await mutated.db
        .update(resources)
        .set({ title: "concurrent-change.pdf" })
        .where(eq(resources.id, RESOURCE_A));
    };
    await assert.rejects(
      () =>
        mutated.service.finalize(authorization, {
          resourceId: RESOURCE_A,
          driveFileId: "file-final",
        }),
      (error: unknown) =>
        error instanceof DriveUploadError && error.code === "request-conflict",
    );
    const [mutatedRow] = await mutated.db
      .select()
      .from(resources)
      .where(eq(resources.id, RESOURCE_A));
    assert.equal(mutatedRow.title, "concurrent-change.pdf");
    assert.equal(mutatedRow.accessState, "pending");
    assert.equal(mutatedRow.externalId, null);

    const removed = await seededUploadFixture();
    await removed.service.start(authorization, DEFAULT_REQUEST);
    removed.harness.fileById.set(
      "file-final",
      driveFile("file-final", RESOURCE_A),
    );
    removed.harness.beforeNextFileGet = async () => {
      assert.equal(
        await removed.service.remove(authorization, RESOURCE_A),
        true,
      );
    };
    await assert.rejects(
      () =>
        removed.service.finalize(authorization, {
          resourceId: RESOURCE_A,
          driveFileId: "file-final",
        }),
      (error: unknown) =>
        error instanceof DriveUploadError && error.code === "request-conflict",
    );
    assert.equal(
      (
        await removed.db
          .select()
          .from(resources)
          .where(eq(resources.id, RESOURCE_A))
      ).length,
      0,
    );
  });

  it("does not adopt a stale marker result after the pending request changes", async () => {
    const fixture = await seededUploadFixture();
    fixture.harness.listFiles = [driveFile("file-landed", RESOURCE_A)];
    fixture.harness.beforeNextList = async () => {
      await fixture.db
        .update(resources)
        .set({ title: "concurrent-change.pdf" })
        .where(eq(resources.id, RESOURCE_A));
    };
    await assert.rejects(
      () =>
        fixture.service.start(
          coreAuthorization("member-a", "ws-a", false),
          DEFAULT_REQUEST,
        ),
      (error: unknown) =>
        error instanceof DriveUploadError && error.code === "request-conflict",
    );
    const [row] = await fixture.db
      .select()
      .from(resources)
      .where(eq(resources.id, RESOURCE_A));
    assert.equal(row.title, "concurrent-change.pdf");
    assert.equal(row.accessState, "pending");
    assert.equal(row.externalId, null);
  });

  it("does not trust a client file id with the wrong marker or parent", async () => {
    for (const unsafe of [
      driveFile("foreign-marker", RESOURCE_B),
      driveFile("foreign-parent", RESOURCE_A, {
        parents: Object.freeze(["folder-other"]),
      }),
      driveFile("two-parents", RESOURCE_A, {
        parents: Object.freeze(["folder-current", "folder-other"]),
      }),
      driveFile("host-confusion", RESOURCE_A, {
        webViewLink:
          "https://drive.google.com.attacker.example/file/d/host-confusion/view",
      }),
    ]) {
      const fixture = await seededUploadFixture();
      const authorization = coreAuthorization("member-a", "ws-a", false);
      await fixture.service.start(authorization, DEFAULT_REQUEST);
      fixture.harness.fileById.set(unsafe.id, unsafe);
      await assert.rejects(
        () =>
          fixture.service.finalize(authorization, {
            resourceId: RESOURCE_A,
            driveFileId: unsafe.id,
          }),
        (error: unknown) =>
          error instanceof DriveUploadError && error.code === "file-invalid",
      );
      const [row] = await fixture.db
        .select()
        .from(resources)
        .where(eq(resources.id, RESOURCE_A));
      assert.equal(row.accessState, "pending");
      assert.ok(row.storedPath && isSealed(row.storedPath));
    }
  });

  it("binds idempotency to the exact request and claimant", async () => {
    const fixture = await seededUploadFixture();
    await fixture.service.start(
      coreAuthorization("member-a", "ws-a", false),
      DEFAULT_REQUEST,
    );
    const callsBefore = fixture.harness.calls.length;
    await assert.rejects(
      () =>
        fixture.service.start(coreAuthorization("member-a", "ws-a", false), {
          ...DEFAULT_REQUEST,
          name: "different.pdf",
        }),
      (error: unknown) =>
        error instanceof DriveUploadError && error.code === "request-conflict",
    );
    await assert.rejects(
      () =>
        fixture.service.start(coreAuthorization("member-b", "ws-a", false), {
          ...DEFAULT_REQUEST,
        }),
      (error: unknown) =>
        error instanceof DriveUploadError && error.code === "request-conflict",
    );
    assert.equal(fixture.harness.calls.length, callsBefore);
  });

  it("removes only Signal metadata and has no provider-delete path", async () => {
    const fixture = await seededUploadFixture();
    const authorization = coreAuthorization("member-a", "ws-a", false);
    await fixture.service.start(authorization, DEFAULT_REQUEST);
    const providerCalls = fixture.harness.calls.length;
    assert.equal(await fixture.service.remove(authorization, RESOURCE_A), true);
    assert.equal(fixture.harness.calls.length, providerCalls);
    assert.equal(
      (await fixture.db.select().from(resources).where(eq(resources.id, RESOURCE_A)))
        .length,
      0,
    );

    const genericAction = readFileSync(
      "src/server/actions/resources.ts",
      "utf8",
    );
    assert.match(genericAction, /resourceRow\.storage\s*!==\s*"drive"/);
    assert.doesNotMatch(
      readFileSync("src/server/connections/drive-uploads.ts", "utf8"),
      /files\.delete|emptyTrash/,
    );
  });

  it("public actions derive authorization from the task or stored resource and request createOrEditTasks explicitly", () => {
    const source = readFileSync(
      "src/server/actions/drive-resource-uploads.ts",
      "utf8",
    );
    const createAt = source.indexOf("export async function createDriveUploadSessionAction");
    const finalizeAt = source.indexOf("export async function finalizeDriveUploadAction");
    const create = source.slice(createAt, finalizeAt);
    const finalize = source.slice(finalizeAt);
    assert.match(create, /scopeForTask\([\s\S]*?"createOrEditTasks"/);
    assert.match(create, /authorizeProjectDrive\([\s\S]*?"createOrEditTasks"/);
    assert.doesNotMatch(create, /workspaceId\s*:/);
    assert.match(finalize, /from\(resources\)/);
    assert.match(finalize, /scopeForTask\([\s\S]*?claim\.taskId/);
    assert.match(finalize, /authorizeProjectDrive\([\s\S]*?"createOrEditTasks"/);
  });
});
