import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { eq, sql } from "drizzle-orm";
import {
  driveUploadSessionAadContext,
  seal,
} from "@/server/crypto/secret-box";
import { meta, resources } from "@/server/db/schema";
import type { ProjectDriveStorageSession } from "./project-drive-access";
import {
  createProjectDriveUploadErasureRecoveryService,
  type ProjectDriveUploadErasureRecoveryDependencies,
} from "./project-drive-upload-erasure-recovery";
import {
  GOOGLE_DRIVE_ACCOUNT_ERASURE_FENCE_VALUE,
  googleDriveAccountErasureFenceKey,
} from "./project-drive-operation-lifecycle";
import { listPendingDelegatedDriveUploadReceiptsForAccount } from "./project-drive-upload-receipts";
import {
  CORE_TEST_RING,
  freshProjectDriveCoreDb,
  jsonResponse,
  seedProjectDriveCore,
  seedStorageGenerations,
} from "./project-drive-core.test.helpers";
import type { GoogleDriveFile } from "./google-drive";

const RESOURCE_ID = "a0000000-0000-4000-8000-000000000001";
const SESSION_URL =
  "https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&upload_id=erasure-secret-session";
const SIZE_BYTES = 5 * 1024 * 1024;

const cleanups: Array<() => void> = [];
afterEach(() => {
  while (cleanups.length) cleanups.pop()?.();
});

function driveFile(
  id = "drive-file-1",
  overrides: Partial<GoogleDriveFile> = {},
): GoogleDriveFile {
  return Object.freeze({
    id,
    name: "brief.pdf",
    mimeType: "application/pdf",
    parents: Object.freeze(["folder-current"]),
    appProperties: Object.freeze({ signalResourceId: RESOURCE_ID }),
    size: String(SIZE_BYTES),
    webViewLink: `https://drive.google.com/file/d/${id}/view`,
    trashed: false,
    ...overrides,
  });
}

function wireFile(file: GoogleDriveFile) {
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

class RecoveryGoogleHarness {
  calls: Array<{ url: string; init?: RequestInit }> = [];
  sessionResponse: Response = new Response(null, { status: 404 });
  listFiles: GoogleDriveFile[] = [];
  listStatus = 200;
  beforeSessionResponse: (() => Promise<void>) | null = null;

  fetch: typeof fetch = async (input, init) => {
    const url = String(input);
    this.calls.push({ url, init });
    if (init?.method === "POST" || init?.method === "DELETE") {
      throw new Error("recovery attempted a forbidden provider mutation");
    }
    if (url.includes("upload_id=") && init?.method === "PUT") {
      const hook = this.beforeSessionResponse;
      this.beforeSessionResponse = null;
      if (hook) await hook();
      return this.sessionResponse;
    }
    const parsed = new URL(url);
    if (parsed.pathname === "/drive/v3/files" && init?.method === "GET") {
      if (this.listStatus !== 200) {
        return jsonResponse(
          { error: { message: "provider-secret-must-not-leak" } },
          this.listStatus,
        );
      }
      return jsonResponse({ files: this.listFiles.map(wireFile) });
    }
    throw new Error("unexpected provider request");
  };
}

async function fixtureFor(
  accountUserId: "member-a" | "owner" = "member-a",
  harness = new RecoveryGoogleHarness(),
) {
  const fixture = await freshProjectDriveCoreDb();
  cleanups.push(fixture.cleanup);
  await seedProjectDriveCore(fixture.client);
  await seedStorageGenerations(fixture.client);
  const cipher = seal(
    SESSION_URL,
    driveUploadSessionAadContext("ws-a", "gen-current", RESOURCE_ID),
    CORE_TEST_RING,
  );
  await fixture.client.executeMultiple(`
    INSERT INTO tasks (
      id, workspace_id, title, lane, priority, assignees, created_at, updated_at
    ) VALUES
      ('task-a', 'ws-a', 'Task A', 'todo', 'medium', '[]', 10, 10);
  `);
  await fixture.db.insert(resources).values({
    id: RESOURCE_ID,
    workspaceId: "ws-a",
    taskId: "task-a",
    kind: "upload",
    provider: "drive",
    storage: "drive",
    storageGenerationId: "gen-current",
    storedPath: cipher,
    title: "brief.pdf",
    mimeType: "application/pdf",
    sizeBytes: SIZE_BYTES,
    addedByUserId: "member-a",
    addedAt: 100,
    refreshedAt: 110,
    accessState: "pending",
    countsAgainstStorage: 0,
  });
  await fixture.db.insert(meta).values({
    key: googleDriveAccountErasureFenceKey(accountUserId),
    value: GOOGLE_DRIVE_ACCOUNT_ERASURE_FENCE_VALUE,
  });
  const receipts = await listPendingDelegatedDriveUploadReceiptsForAccount(
    fixture.db,
    accountUserId,
  );
  assert.equal(receipts.length, 1);
  const storageSession: ProjectDriveStorageSession = Object.freeze({
    accessToken: "recovery-access",
    credential: Object.freeze({
      id: "conn-new",
      ownerUserId: "owner",
      providerAccountId: "account-owner",
      providerAccountEmail: "owner@example.com",
      rootFolderId: "root-new",
    }),
    storageRootFolderId: "root-old",
    storage: Object.freeze({
      id: "gen-current",
      workspaceId: "ws-a",
      connectionId: "conn-old",
      folderId: "folder-current",
      folderWebViewLink: "https://drive.example/folder-current",
      state: "active",
      isCurrent: true,
    }),
  });
  let receivedStorageReceipt: unknown = null;
  const access: ProjectDriveUploadErasureRecoveryDependencies["access"] = {
    async withReceiptStorageSession(receipt, operation) {
      receivedStorageReceipt = receipt;
      return operation(storageSession);
    },
  };
  const service = createProjectDriveUploadErasureRecoveryService({
    database: fixture.db,
    access,
    fetchImpl: harness.fetch,
    keyRing: CORE_TEST_RING,
    databaseNowSeconds: () => sql<number>`777`,
  });
  return {
    ...fixture,
    accountUserId,
    cipher,
    harness,
    receipt: receipts[0],
    service,
    receivedStorageReceipt: () => receivedStorageReceipt,
  };
}

async function resourceRow(fixture: Awaited<ReturnType<typeof fixtureFor>>) {
  const [row] = await fixture.db
    .select()
    .from(resources)
    .where(eq(resources.id, RESOURCE_ID));
  return row ?? null;
}

describe("Project Drive delegated-upload account-erasure recovery", () => {
  it("blocks an active exact session for either erased lineage and preserves evidence", async () => {
    for (const accountUserId of ["member-a", "owner"] as const) {
      const harness = new RecoveryGoogleHarness();
      harness.sessionResponse = new Response(null, {
        status: 308,
        headers: { range: "bytes=0-1023" },
      });
      const fixture = await fixtureFor(accountUserId, harness);
      const result = await fixture.service.recover(
        accountUserId,
        fixture.receipt,
      );
      assert.deepEqual(result, { outcome: "blocked", reason: "active" });
      assert.equal((await resourceRow(fixture))?.storedPath, fixture.cipher);
      assert.deepEqual(fixture.receivedStorageReceipt(), {
        workspaceId: "ws-a",
        storageGenerationId: "gen-current",
        connectionId: "conn-old",
        folderId: "folder-current",
      });
      assert.equal(JSON.stringify(result).includes(SESSION_URL), false);
      assert.equal(harness.calls.some((call) => call.init?.method === "POST"), false);
      assert.equal(harness.calls.some((call) => call.init?.method === "DELETE"), false);
    }
  });

  it("materializes a completed exact session using database time", async () => {
    const harness = new RecoveryGoogleHarness();
    harness.sessionResponse = jsonResponse(wireFile(driveFile()), 200);
    const fixture = await fixtureFor("member-a", harness);
    assert.deepEqual(
      await fixture.service.recover("member-a", fixture.receipt),
      { outcome: "resolved", resolution: "completed" },
    );
    const row = await resourceRow(fixture);
    assert.equal(row?.externalId, "drive-file-1");
    assert.equal(row?.storedPath, null);
    assert.equal(row?.accessState, "ok");
    assert.equal(row?.refreshedAt, 777);
  });

  it("adopts one globally marked exact file after authoritative session 404", async () => {
    const harness = new RecoveryGoogleHarness();
    harness.listFiles = [driveFile("adopted-file")];
    const fixture = await fixtureFor("owner", harness);
    assert.deepEqual(
      await fixture.service.recover("owner", fixture.receipt),
      { outcome: "resolved", resolution: "adopted" },
    );
    assert.equal((await resourceRow(fixture))?.externalId, "adopted-file");
    const search = harness.calls.find(
      (call) => new URL(call.url).pathname === "/drive/v3/files",
    );
    assert.ok(search);
    const query = new URL(search.url).searchParams.get("q") ?? "";
    assert.match(query, /signalResourceId/);
    assert.doesNotMatch(query, /in parents|trashed = false/);
  });

  it("clears only the exact pending row after 404 plus exhaustive global miss", async () => {
    const fixture = await fixtureFor();
    assert.deepEqual(
      await fixture.service.recover("member-a", fixture.receipt),
      { outcome: "resolved", resolution: "absent" },
    );
    assert.equal(await resourceRow(fixture), null);
  });

  it("retains evidence for multiple, invalid, and transport-ambiguous provider truth", async () => {
    const cases = [
      (harness: RecoveryGoogleHarness) => {
        harness.listFiles = [driveFile("one"), driveFile("two")];
      },
      (harness: RecoveryGoogleHarness) => {
        harness.listFiles = [
          driveFile("wrong-parent", { parents: ["some-other-folder"] }),
        ];
      },
      (harness: RecoveryGoogleHarness) => {
        harness.sessionResponse = jsonResponse(
          { error: { message: "provider-secret-must-not-leak" } },
          503,
        );
      },
    ];
    for (const arrange of cases) {
      const harness = new RecoveryGoogleHarness();
      arrange(harness);
      const fixture = await fixtureFor("member-a", harness);
      const result = await fixture.service.recover(
        "member-a",
        fixture.receipt,
      );
      assert.deepEqual(result, { outcome: "blocked", reason: "ambiguous" });
      assert.equal((await resourceRow(fixture))?.storedPath, fixture.cipher);
      assert.doesNotMatch(JSON.stringify(result), /provider-secret|upload_id/);
    }
  });

  it("loses safely to row mutation or fence removal after provider proof", async () => {
    for (const mutation of ["row", "fence"] as const) {
      const harness = new RecoveryGoogleHarness();
      harness.sessionResponse = jsonResponse(wireFile(driveFile()), 200);
      const fixture = await fixtureFor("member-a", harness);
      harness.beforeSessionResponse = async () => {
        if (mutation === "row") {
          await fixture.db
            .update(resources)
            .set({ refreshedAt: 111 })
            .where(eq(resources.id, RESOURCE_ID));
        } else {
          await fixture.db
            .delete(meta)
            .where(
              eq(meta.key, googleDriveAccountErasureFenceKey("member-a")),
            );
        }
      };
      const result = await fixture.service.recover(
        "member-a",
        fixture.receipt,
      );
      assert.deepEqual(result, {
        outcome: "blocked",
        reason: "receipt-changed",
      });
      const row = await resourceRow(fixture);
      assert.equal(row?.accessState, "pending");
      assert.equal(row?.externalId, null);
    }
  });

  it("refuses an unrelated account before decryption or provider access", async () => {
    const fixture = await fixtureFor();
    await fixture.db.insert(meta).values({
      key: googleDriveAccountErasureFenceKey("outsider"),
      value: GOOGLE_DRIVE_ACCOUNT_ERASURE_FENCE_VALUE,
    });
    assert.deepEqual(
      await fixture.service.recover("outsider", fixture.receipt),
      { outcome: "blocked", reason: "receipt-changed" },
    );
    assert.equal(fixture.harness.calls.length, 0);
    assert.equal((await resourceRow(fixture))?.storedPath, fixture.cipher);
  });
});
