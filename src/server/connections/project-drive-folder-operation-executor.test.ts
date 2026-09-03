import assert from "node:assert/strict";
import { after, describe, it } from "node:test";
import { eq, sql } from "drizzle-orm";
import {
  driveFolderGrants,
  meta,
  projectDriveOperations,
  providerConnections,
  users,
  workspaceMembers,
  workspaces,
  workspaceStorage,
} from "@/server/db/schema";
import {
  createDriveFolderService,
  DRIVE_FOLDER_GENERATION_MARKER,
  DRIVE_FOLDER_WORKSPACE_MARKER,
} from "./drive-folders";
import { createProjectDriveAccessService } from "./project-drive-access";
import {
  createProjectDriveFolderOperationExecutor,
  type ProjectDriveFolderOperationExecutorDependencies,
} from "./project-drive-folder-operation-executor";
import { createProjectDriveOperationJournal } from "./project-drive-operation-journal";
import { createAccountFencedProjectDriveOperationJournal } from "./project-drive-operation-orchestrator";
import {
  GOOGLE_DRIVE_ACCOUNT_ERASURE_FENCE_VALUE,
  googleDriveAccountErasureFenceKey,
} from "./project-drive-operation-lifecycle";
import {
  accessDependencies,
  freshProjectDriveCoreDb,
  jsonResponse,
  seedProjectDriveCore,
  seedStorageGenerations,
  tokenCipher,
  tokenRefreshResponse,
} from "./project-drive-core.test.helpers";

const FOLDER_MIME = "application/vnd.google-apps.folder";
let sharedCore: Awaited<ReturnType<typeof freshProjectDriveCoreDb>> | null = null;

after(() => {
  sharedCore?.cleanup();
  sharedCore = null;
});

type ExecutorFixture = Awaited<ReturnType<typeof executorFixture>>;

function folder(input: {
  id?: string;
  workspaceId?: string;
  generationId?: string;
  parentId?: string;
  name?: string;
  trashed?: boolean;
  mimeType?: string;
}) {
  const id = input.id ?? "folder-created";
  return {
    id,
    name: input.name ?? "Project A",
    mimeType: input.mimeType ?? FOLDER_MIME,
    parents: [input.parentId ?? "root-new"],
    appProperties: {
      [DRIVE_FOLDER_WORKSPACE_MARKER]: input.workspaceId ?? "ws-a",
      [DRIVE_FOLDER_GENERATION_MARKER]: input.generationId ?? "gen-target",
    },
    webViewLink: `https://drive.example/${id}`,
    trashed: input.trashed ?? false,
  };
}

async function executorFixture(input: {
  fetchImpl: typeof fetch;
  operationIds?: string[];
  afterProviderSuccess?: ProjectDriveFolderOperationExecutorDependencies["afterProviderSuccess"];
  executeGrant?: ProjectDriveFolderOperationExecutorDependencies["executeGrant"];
}) {
  const fixture = sharedCore ?? (await freshProjectDriveCoreDb());
  sharedCore = fixture;
  await fixture.client.executeMultiple(`
    DELETE FROM project_drive_operations;
    DELETE FROM drive_folder_grants;
    DELETE FROM workspace_storage;
    DELETE FROM provider_connections;
    DELETE FROM workspace_members;
    DELETE FROM workspaces;
    DELETE FROM meta;
    DELETE FROM users;
  `);
  await seedProjectDriveCore(fixture.client);
  let databaseNow = Math.floor(Date.now() / 1_000) + 100;
  const databaseNowSeconds = () => sql<Date>`${databaseNow}`;
  const operationIds = [...(input.operationIds ?? ["operation-one"])];
  const operations = createAccountFencedProjectDriveOperationJournal({
    database: fixture.db,
    randomOperationId: () =>
      operationIds.shift() ?? "unexpected-operation-id",
    leaseDurationMs: 1_000,
    databaseNowSeconds,
  });
  const journal = createProjectDriveOperationJournal({
    database: fixture.db,
    leaseDurationMs: 1_000,
    databaseNowSeconds,
  });
  const access = createProjectDriveAccessService(
    accessDependencies(fixture.db, input.fetchImpl),
  );
  const folders = createDriveFolderService({
    database: fixture.db,
    access,
    fetchImpl: input.fetchImpl,
  });
  const executor = createProjectDriveFolderOperationExecutor({
    database: fixture.db,
    operations,
    journal,
    journalForTransaction: (database) =>
      createProjectDriveOperationJournal({
        database,
        leaseDurationMs: 1_000,
        databaseNowSeconds,
      }),
    folders,
    executeGrant: input.executeGrant ?? (async () => ({ outcome: "conflict" })),
    retryBaseMs: 1_000,
    maxAutomaticAttempts: 3,
    ...(input.afterProviderSuccess
      ? { afterProviderSuccess: input.afterProviderSuccess }
      : {}),
  });
  return {
    ...fixture,
    executor,
    operations,
    journal,
    advance(seconds: number) {
      databaseNow += seconds;
    },
    now() {
      return databaseNow;
    },
  };
}

async function prepareProvision(
  fixture: Awaited<ReturnType<typeof executorFixture>>,
  operationId = "operation-one",
) {
  const prepared = await fixture.executor.prepare({
    workspaceId: "ws-a",
    operationKind: "folder_provision",
    connectionId: "conn-new",
    targetStorageGenerationId: "gen-target",
  });
  if (prepared.outcome === "conflict") {
    assert.fail("folder provision preparation unexpectedly conflicted");
  }
  assert.equal(prepared.operation.operationId, operationId);
  return prepared.operation.operationId;
}

async function prepareRename(
  fixture: Awaited<ReturnType<typeof executorFixture>>,
  operationId = "operation-one",
) {
  const prepared = await fixture.executor.prepare({
    workspaceId: "ws-a",
    operationKind: "folder_rename",
    storageGenerationId: "gen-current",
    workspaceRevision: 1,
  });
  if (prepared.outcome === "conflict") {
    assert.fail("folder rename preparation unexpectedly conflicted");
  }
  assert.equal(prepared.operation.operationId, operationId);
  return prepared.operation.operationId;
}

async function seedHandoverTarget(fixture: ExecutorFixture) {
  await seedStorageGenerations(fixture.client);
  await fixture.db
    .update(workspaceMembers)
    .set({ role: "owner" })
    .where(eq(workspaceMembers.userId, "member-a"));
  await fixture.db.insert(providerConnections).values({
    id: "conn-member-a",
    userId: "member-a",
    provider: "google_drive",
    providerAccountId: "account-member-a",
    providerAccountEmail: "member.a@example.com",
    rootFolderId: "root-member-a",
    refreshTokenCipher: tokenCipher(
      "conn-member-a",
      "refresh-member-a",
    ),
    keyVersion: 1,
    scopes: ["https://www.googleapis.com/auth/drive.file"],
    status: "active",
    isCurrent: true,
    connectedAt: new Date("2026-09-03T10:00:00.000Z"),
  });
}

async function prepareHandover(
  fixture: ExecutorFixture,
  operationId = "operation-one",
  targetStorageGenerationId = "gen-handover",
) {
  const prepared = await fixture.executor.prepare({
    workspaceId: "ws-a",
    operationKind: "storage_handover",
    connectionId: "conn-member-a",
    storageGenerationId: "gen-current",
    targetStorageGenerationId,
  });
  if (prepared.outcome === "conflict") {
    assert.fail("storage handover preparation unexpectedly conflicted");
  }
  assert.equal(prepared.operation.operationId, operationId);
  return prepared.operation.operationId;
}

describe("durable Project Drive folder operation executor", () => {
  it("provisions through the exact pinned connection and atomically records storage plus receipt", async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    const fetchImpl: typeof fetch = async (input, init) => {
      const url = String(input);
      calls.push({ url, init });
      if (url.includes("oauth2.googleapis.com/token")) {
        assert.match(String(init?.body), /refresh_token=refresh-new/);
        return tokenRefreshResponse();
      }
      if (init?.method === "GET") return jsonResponse({ files: [] });
      if (init?.method === "POST") return jsonResponse(folder({}));
      throw new Error("unexpected request");
    };
    const fixture = await executorFixture({ fetchImpl });
    const operationId = await prepareProvision(fixture);

    const result = await fixture.executor.execute({
      workspaceId: "ws-a",
      operationId,
      operationKind: "folder_provision",
    });
    assert.equal(result.outcome, "completed");

    const listCalls = calls.filter(
      (call) => call.init?.method === "GET" && call.url.includes("/drive/v3/files?"),
    );
    assert.equal(listCalls.length, 2);
    const exactQuery = new URL(listCalls[0].url).searchParams.get("q") ?? "";
    assert.match(exactQuery, /'root-new' in parents/);
    assert.match(exactQuery, /mimeType = 'application\/vnd\.google-apps\.folder'/);
    const globalQuery = new URL(listCalls[1].url).searchParams.get("q") ?? "";
    assert.doesNotMatch(globalQuery, /in parents/);
    assert.ok(
      calls.findIndex(
        (call) =>
          call.init?.method === "POST" && call.url.includes("/drive/v3/files"),
      ) >
        calls.findIndex((call) => call.url === listCalls[1].url),
    );

    const [storage] = await fixture.db
      .select()
      .from(workspaceStorage)
      .where(eq(workspaceStorage.id, "gen-target"));
    const [operation] = await fixture.db
      .select()
      .from(projectDriveOperations)
      .where(eq(projectDriveOperations.id, operationId));
    assert.equal(storage.connectionId, "conn-new");
    assert.equal(storage.folderId, "folder-created");
    assert.equal(operation.status, "succeeded");
    assert.equal(operation.providerFolderId, "folder-created");
    const grantIntents = await fixture.db
      .select({
        subjectUserId: projectDriveOperations.subjectUserId,
        granteeEmail: projectDriveOperations.granteeEmail,
        grantRole: projectDriveOperations.grantRole,
        status: projectDriveOperations.status,
      })
      .from(projectDriveOperations)
      .where(eq(projectDriveOperations.operationKind, "grant_create"));
    assert.deepEqual(
      grantIntents
        .map((intent) => ({
          ...intent,
          subjectUserId: intent.subjectUserId,
        }))
        .sort((left, right) =>
          String(left.subjectUserId).localeCompare(String(right.subjectUserId)),
        ),
      [
        {
          subjectUserId: "member-a",
          granteeEmail: "member.a@example.com",
          grantRole: "writer",
          status: "pending",
        },
        {
          subjectUserId: "member-b",
          granteeEmail: "member.b@example.com",
          grantRole: "writer",
          status: "pending",
        },
      ],
      "folder materialization and the existing-member intents share one commit",
    );
  });

  it("dispatches every exact member grant only after the folder transaction commits", async () => {
    const holder: { current: ExecutorFixture | null } = { current: null };
    const dispatched: Array<{ workspaceId: string; operationId: string }> = [];
    let dispatchInFlight = false;
    const fixture = await executorFixture({
      fetchImpl: async (input, init) => {
        if (String(input).includes("oauth2.googleapis.com/token")) {
          return tokenRefreshResponse();
        }
        if (init?.method === "GET") return jsonResponse({ files: [] });
        if (init?.method === "POST") return jsonResponse(folder({}));
        throw new Error("unexpected request");
      },
      executeGrant: async (locator) => {
        assert.equal(
          dispatchInFlight,
          false,
          "same-folder grant dispatch must remain sequential",
        );
        dispatchInFlight = true;
        try {
          const current = holder.current;
          assert.ok(current);
          const [storage] = await current.db
            .select({ id: workspaceStorage.id })
            .from(workspaceStorage)
            .where(eq(workspaceStorage.id, "gen-target"));
          assert.equal(
            storage.id,
            "gen-target",
            "provider dispatch must see the committed storage generation",
          );
          dispatched.push(locator);
          if (dispatched.length === 1) {
            throw new Error("simulated post-commit dispatcher failure");
          }

          // Claiming needs its own immediate writer transaction. It would not
          // complete if dispatch were still inside persistProvision's writer.
          const claimed = await current.operations.claim(locator);
          assert.equal(claimed.outcome, "claimed");
          if (claimed.outcome !== "claimed") assert.fail("grant claim failed");
          const manual = await current.journal.markManualAttention({
            workspaceId: locator.workspaceId,
            operationId: locator.operationId,
            attemptFence: claimed.claim.attemptFence,
            errorCode: "cannot_invite_non_google_user",
          });
          assert.equal(manual.outcome, "manual_attention");
          await Promise.resolve();
          return manual;
        } finally {
          dispatchInFlight = false;
        }
      },
    });
    holder.current = fixture;
    const operationId = await prepareProvision(fixture);

    const result = await fixture.executor.execute({
      workspaceId: "ws-a",
      operationId,
      operationKind: "folder_provision",
    });

    assert.equal(result.outcome, "completed");
    const exactOperations = await fixture.db
      .select({
        workspaceId: projectDriveOperations.workspaceId,
        operationId: projectDriveOperations.id,
        status: projectDriveOperations.status,
      })
      .from(projectDriveOperations)
      .where(eq(projectDriveOperations.operationKind, "grant_create"));
    assert.deepEqual(
      dispatched.map((operation) => operation.operationId).sort(),
      exactOperations.map((operation) => operation.operationId).sort(),
    );
    assert.ok(exactOperations.every((operation) => operation.workspaceId === "ws-a"));
    assert.deepEqual(
      exactOperations.map((operation) => operation.status).sort(),
      ["manual_attention", "pending"],
      "a dispatcher crash keeps its exact intent durable and does not strand later people",
    );
    assert.equal((await fixture.db.select().from(driveFolderGrants)).length, 0);
    assert.equal(
      (
        await fixture.db
          .select()
          .from(workspaceMembers)
          .where(eq(workspaceMembers.workspaceId, "ws-a"))
      ).length,
      3,
      "a provider refusal must not roll back any valid member",
    );
  });

  it("keeps members with missing emails as explicit grant gaps", async () => {
    const fetchImpl: typeof fetch = async (input, init) => {
      if (String(input).includes("oauth2.googleapis.com/token")) {
        return tokenRefreshResponse();
      }
      if (init?.method === "GET") return jsonResponse({ files: [] });
      if (init?.method === "POST") return jsonResponse(folder({}));
      throw new Error("unexpected request");
    };
    const fixture = await executorFixture({ fetchImpl });
    await fixture.db
      .update(users)
      .set({ email: null })
      .where(eq(users.id, "member-a"));
    await fixture.db
      .update(users)
      .set({ email: "invalid@" })
      .where(eq(users.id, "member-b"));
    const operationId = await prepareProvision(fixture);

    const result = await fixture.executor.execute({
      workspaceId: "ws-a",
      operationId,
      operationKind: "folder_provision",
    });
    assert.equal(result.outcome, "completed");
    assert.equal(
      (
        await fixture.db
          .select()
          .from(projectDriveOperations)
          .where(eq(projectDriveOperations.operationKind, "grant_create"))
      ).length,
      0,
    );
    assert.equal(
      (
        await fixture.db
          .select()
          .from(workspaceMembers)
          .where(eq(workspaceMembers.workspaceId, "ws-a"))
      ).length,
      3,
      "storage setup must never roll back otherwise-valid membership",
    );
  });

  it("rolls back storage and every grant intent when a member fence wins during provider work", async () => {
    const fixtureRef: { current: ExecutorFixture | null } = { current: null };
    const fetchImpl: typeof fetch = async (input, init) => {
      if (String(input).includes("oauth2.googleapis.com/token")) {
        return tokenRefreshResponse();
      }
      if (init?.method === "GET") return jsonResponse({ files: [] });
      if (init?.method === "POST") return jsonResponse(folder({}));
      throw new Error("unexpected request");
    };
    const fixture = await executorFixture({
      fetchImpl,
      afterProviderSuccess: async () => {
        const current = fixtureRef.current;
        assert.ok(current);
        await current.db.insert(meta).values({
          key: googleDriveAccountErasureFenceKey("member-a"),
          value: GOOGLE_DRIVE_ACCOUNT_ERASURE_FENCE_VALUE,
        });
      },
    });
    fixtureRef.current = fixture;
    const operationId = await prepareProvision(fixture);

    const result = await fixture.executor.execute({
      workspaceId: "ws-a",
      operationId,
      operationKind: "folder_provision",
    });
    assert.deepEqual(result, { outcome: "conflict" });
    assert.equal(
      (
        await fixture.db
          .select()
          .from(workspaceStorage)
          .where(eq(workspaceStorage.id, "gen-target"))
      ).length,
      0,
    );
    assert.equal(
      (
        await fixture.db
          .select()
          .from(projectDriveOperations)
          .where(eq(projectDriveOperations.operationKind, "grant_create"))
      ).length,
      0,
    );
  });

  it("does not materialize storage when the Project is archived during provider work", async () => {
    const fixtureRef: { current: ExecutorFixture | null } = { current: null };
    const fetchImpl: typeof fetch = async (input, init) => {
      if (String(input).includes("oauth2.googleapis.com/token")) {
        return tokenRefreshResponse();
      }
      if (init?.method === "GET") return jsonResponse({ files: [] });
      if (init?.method === "POST") return jsonResponse(folder({}));
      throw new Error("unexpected request");
    };
    const fixture = await executorFixture({
      fetchImpl,
      afterProviderSuccess: async () => {
        const current = fixtureRef.current;
        assert.ok(current);
        await current.db
          .update(workspaces)
          .set({ archivedAt: new Date(current.now() * 1_000) })
          .where(eq(workspaces.id, "ws-a"));
      },
    });
    fixtureRef.current = fixture;
    const operationId = await prepareProvision(fixture);

    const result = await fixture.executor.execute({
      workspaceId: "ws-a",
      operationId,
      operationKind: "folder_provision",
    });
    assert.equal(result.outcome, "manual_attention");
    assert.equal(result.operation.lastErrorCode, "workspace_changed");
    assert.equal(
      (
        await fixture.db
          .select()
          .from(workspaceStorage)
          .where(eq(workspaceStorage.id, "gen-target"))
      ).length,
      0,
    );
  });

  it("refuses preparation and claim when the related account erasure fence wins", async () => {
    let providerCalls = 0;
    const fixture = await executorFixture({
      operationIds: ["operation-one", "operation-two"],
      fetchImpl: async () => {
        providerCalls += 1;
        throw new Error("provider must not be reached");
      },
    });
    await fixture.db.insert(meta).values({
      key: googleDriveAccountErasureFenceKey("owner"),
      value: GOOGLE_DRIVE_ACCOUNT_ERASURE_FENCE_VALUE,
    });
    const fencedPrepare = await fixture.executor.prepare({
      workspaceId: "ws-a",
      operationKind: "folder_provision",
      connectionId: "conn-new",
      targetStorageGenerationId: "gen-fenced",
    });
    assert.deepEqual(fencedPrepare, { outcome: "conflict" });

    await fixture.db
      .delete(meta)
      .where(eq(meta.key, googleDriveAccountErasureFenceKey("owner")));
    const operationId = await prepareProvision(fixture, "operation-one");
    await fixture.db.insert(meta).values({
      key: googleDriveAccountErasureFenceKey("owner"),
      value: GOOGLE_DRIVE_ACCOUNT_ERASURE_FENCE_VALUE,
    });
    const fencedClaim = await fixture.executor.execute({
      workspaceId: "ws-a",
      operationId,
      operationKind: "folder_provision",
    });
    assert.deepEqual(fencedClaim, { outcome: "conflict" });
    const [operation] = await fixture.db
      .select({ status: projectDriveOperations.status })
      .from(projectDriveOperations)
      .where(eq(projectDriveOperations.id, operationId));
    assert.equal(operation.status, "pending");
    assert.equal(providerCalls, 0);
  });

  it("never substitutes a replacement credential for the pinned provisioning connection", async () => {
    let providerCalls = 0;
    const fixture = await executorFixture({
      fetchImpl: async () => {
        providerCalls += 1;
        throw new Error("provider must not be reached");
      },
    });
    const operationId = await prepareProvision(fixture);
    await fixture.db
      .update(providerConnections)
      .set({ isCurrent: false })
      .where(eq(providerConnections.id, "conn-new"));
    await fixture.db
      .update(providerConnections)
      .set({ isCurrent: true })
      .where(eq(providerConnections.id, "conn-old"));

    const result = await fixture.executor.execute({
      workspaceId: "ws-a",
      operationId,
      operationKind: "folder_provision",
    });
    assert.equal(result.outcome, "manual_attention");
    assert.equal(result.operation.lastErrorCode, "connection_not_current");
    assert.equal(providerCalls, 0);
  });

  it("adopts one exact provider success after a process crash without creating twice", async () => {
    let remote: ReturnType<typeof folder> | null = null;
    let creates = 0;
    let crash = true;
    const fetchImpl: typeof fetch = async (input, init) => {
      const url = String(input);
      if (url.includes("oauth2.googleapis.com/token")) {
        return tokenRefreshResponse();
      }
      if (init?.method === "GET") {
        return jsonResponse({ files: remote ? [remote] : [] });
      }
      if (init?.method === "POST") {
        creates += 1;
        remote = folder({ id: "folder-recovered" });
        return jsonResponse(remote);
      }
      throw new Error("unexpected request");
    };
    const fixture = await executorFixture({
      fetchImpl,
      afterProviderSuccess: async () => {
        if (crash) {
          crash = false;
          throw new Error("simulated process death");
        }
      },
    });
    const operationId = await prepareProvision(fixture);
    await assert.rejects(
      () =>
        fixture.executor.execute({
          workspaceId: "ws-a",
          operationId,
          operationKind: "folder_provision",
        }),
      /simulated process death/,
    );
    assert.equal(
      (
        await fixture.db
          .select()
          .from(workspaceStorage)
          .where(eq(workspaceStorage.id, "gen-target"))
      ).length,
      0,
    );

    fixture.advance(2);
    const recovered = await fixture.executor.execute({
      workspaceId: "ws-a",
      operationId,
      operationKind: "folder_provision",
    });
    assert.equal(recovered.outcome, "completed");
    assert.equal(creates, 1);
    const [operation] = await fixture.db
      .select()
      .from(projectDriveOperations)
      .where(eq(projectDriveOperations.id, operationId));
    assert.equal(operation.attemptCount, 2);
    assert.equal(operation.providerFolderId, "folder-recovered");
  });

  it("rejects a generation marker in another root or more than one exact match", async (t) => {
    const scenarios = [
      {
        name: "same generation in another root",
        files: [folder({ parentId: "root-other" })],
        errorCode: "provider_conflict",
      },
      {
        name: "multiple exact generation matches",
        files: [folder({ id: "folder-one" }), folder({ id: "folder-two" })],
        errorCode: "ambiguous_provider_result",
      },
    ] as const;
    for (const scenario of scenarios) {
      await t.test(scenario.name, async () => {
        let creates = 0;
        const fetchImpl: typeof fetch = async (input, init) => {
          const url = String(input);
          if (url.includes("oauth2.googleapis.com/token")) {
            return tokenRefreshResponse();
          }
          if (init?.method === "GET") {
            const query = new URL(url).searchParams.get("q") ?? "";
            const exact = query.includes("'root-new' in parents");
            return jsonResponse({
              files: exact
                ? scenario.files.filter(
                    (candidate) => candidate.parents[0] === "root-new",
                  )
                : scenario.files,
            });
          }
          if (init?.method === "POST") {
            creates += 1;
            return jsonResponse(folder({}));
          }
          throw new Error("unexpected request");
        };
        const fixture = await executorFixture({
          fetchImpl,
          operationIds: [`operation-${scenario.name.replaceAll(" ", "-")}`],
        });
        const operationId = await prepareProvision(
          fixture,
          `operation-${scenario.name.replaceAll(" ", "-")}`,
        );
        const result = await fixture.executor.execute({
          workspaceId: "ws-a",
          operationId,
          operationKind: "folder_provision",
        });
        assert.equal(result.outcome, "manual_attention");
        assert.equal(result.operation.lastErrorCode, scenario.errorCode);
        assert.equal(creates, 0);
      });
    }
  });

  it("rolls back the storage row when the attempt fence changes after provider success", async () => {
    const fixtureRef: { current: ExecutorFixture | null } = { current: null };
    const fetchImpl: typeof fetch = async (input, init) => {
      if (String(input).includes("oauth2.googleapis.com/token")) {
        return tokenRefreshResponse();
      }
      if (init?.method === "GET") return jsonResponse({ files: [] });
      if (init?.method === "POST") return jsonResponse(folder({}));
      throw new Error("unexpected request");
    };
    const fixture = await executorFixture({
      fetchImpl,
      afterProviderSuccess: async ({ claim }) => {
        const current = fixtureRef.current;
        assert.ok(current);
        await current.db
          .update(projectDriveOperations)
          .set({
            status: "manual_attention",
            leaseExpiresAt: null,
            lastErrorCode: "repair_incomplete",
            updatedAt: new Date(current.now() * 1_000),
          })
          .where(eq(projectDriveOperations.id, claim.operationId));
      },
    });
    fixtureRef.current = fixture;
    const operationId = await prepareProvision(fixture);
    const result = await fixture.executor.execute({
      workspaceId: "ws-a",
      operationId,
      operationKind: "folder_provision",
    });
    assert.deepEqual(result, { outcome: "conflict" });
    assert.equal(
      (
        await fixture.db
          .select()
          .from(workspaceStorage)
          .where(eq(workspaceStorage.id, "gen-target"))
      ).length,
      0,
      "domain write must roll back with the rejected journal completion",
    );
  });

  it("hands storage to an exact owner connection without moving or deleting historical files", async () => {
    const calls: Array<{ url: string; method: string }> = [];
    const fetchImpl: typeof fetch = async (input, init) => {
      const url = String(input);
      const method = init?.method ?? "GET";
      calls.push({ url, method });
      if (url.includes("oauth2.googleapis.com/token")) {
        assert.match(String(init?.body), /refresh_token=refresh-member-a/);
        return tokenRefreshResponse();
      }
      if (method === "GET") return jsonResponse({ files: [] });
      if (method === "POST") {
        return jsonResponse(
          folder({
            id: "folder-handover",
            generationId: "gen-handover",
            parentId: "root-member-a",
          }),
        );
      }
      throw new Error(`unexpected provider method ${method}`);
    };
    const fixture = await executorFixture({ fetchImpl });
    await seedHandoverTarget(fixture);
    const operationId = await prepareHandover(fixture);

    const result = await fixture.executor.execute({
      workspaceId: "ws-a",
      operationId,
      operationKind: "storage_handover",
    });
    assert.equal(result.outcome, "completed");

    const generations = await fixture.db
      .select()
      .from(workspaceStorage)
      .where(eq(workspaceStorage.workspaceId, "ws-a"));
    assert.equal(
      generations.find((generation) => generation.id === "gen-current")
        ?.isCurrent,
      false,
    );
    const current = generations.filter((generation) => generation.isCurrent);
    assert.equal(current.length, 1);
    assert.equal(current[0].id, "gen-handover");
    assert.equal(current[0].connectionId, "conn-member-a");
    assert.equal(current[0].folderId, "folder-handover");

    const operations = await fixture.db
      .select()
      .from(projectDriveOperations)
      .where(eq(projectDriveOperations.workspaceId, "ws-a"));
    const handover = operations.find(
      (operation) => operation.id === operationId,
    );
    assert.equal(handover?.status, "succeeded");
    assert.equal(handover?.providerFolderId, "folder-handover");
    assert.deepEqual(
      operations
        .filter(
          (operation) =>
            operation.operationKind === "grant_create" &&
            operation.storageGenerationId === "gen-handover",
        )
        .map((operation) => operation.subjectUserId)
        .sort(),
      ["member-b", "owner"],
      "every current member except the new storage owner receives a durable writer intent",
    );
    assert.equal(
      calls.some(({ method }) => method === "DELETE" || method === "PATCH"),
      false,
      "handover must preserve the old folder and its files",
    );
  });

  it("keeps the source generation current when target ownership changes during provider work", async () => {
    const fixtureRef: { current: ExecutorFixture | null } = { current: null };
    const fetchImpl: typeof fetch = async (input, init) => {
      if (String(input).includes("oauth2.googleapis.com/token")) {
        return tokenRefreshResponse();
      }
      if ((init?.method ?? "GET") === "GET") {
        return jsonResponse({ files: [] });
      }
      if (init?.method === "POST") {
        return jsonResponse(
          folder({
            id: "folder-raced-handover",
            generationId: "gen-handover",
            parentId: "root-member-a",
          }),
        );
      }
      throw new Error("unexpected request");
    };
    const fixture = await executorFixture({
      fetchImpl,
      afterProviderSuccess: async () => {
        const current = fixtureRef.current;
        assert.ok(current);
        await current.db
          .update(workspaceMembers)
          .set({ role: "member" })
          .where(eq(workspaceMembers.userId, "member-a"));
      },
    });
    fixtureRef.current = fixture;
    await seedHandoverTarget(fixture);
    const operationId = await prepareHandover(fixture);

    const result = await fixture.executor.execute({
      workspaceId: "ws-a",
      operationId,
      operationKind: "storage_handover",
    });
    assert.equal(result.outcome, "manual_attention");
    assert.equal(result.operation.lastErrorCode, "workspace_changed");

    const generations = await fixture.db
      .select()
      .from(workspaceStorage)
      .where(eq(workspaceStorage.workspaceId, "ws-a"));
    assert.equal(
      generations.find((generation) => generation.id === "gen-current")
        ?.isCurrent,
      true,
    );
    assert.equal(
      generations.some((generation) => generation.id === "gen-handover"),
      false,
    );
    assert.equal(
      (
        await fixture.db
          .select()
          .from(projectDriveOperations)
          .where(eq(projectDriveOperations.operationKind, "grant_create"))
      ).length,
      0,
    );
  });

  it("schedules safe retry for transient reads and ambiguous creates", async (t) => {
    const scenarios = [
      {
        name: "provider list outage",
        errorCode: "provider_unavailable",
        fetch: async (input: string | URL | Request, init?: RequestInit) => {
          if (String(input).includes("oauth2.googleapis.com/token")) {
            return tokenRefreshResponse();
          }
          assert.equal(init?.method, "GET");
          return jsonResponse(
            { error: { errors: [{ reason: "backendError" }] } },
            503,
          );
        },
      },
      {
        name: "create transport ambiguity",
        errorCode: "ambiguous_provider_result",
        fetch: async (input: string | URL | Request, init?: RequestInit) => {
          if (String(input).includes("oauth2.googleapis.com/token")) {
            return tokenRefreshResponse();
          }
          if (init?.method === "GET") return jsonResponse({ files: [] });
          throw new TypeError("connection reset after write");
        },
      },
    ] as const;
    for (const scenario of scenarios) {
      await t.test(scenario.name, async () => {
        const operationId = `operation-${scenario.name.replaceAll(" ", "-")}`;
        const fixture = await executorFixture({
          fetchImpl: scenario.fetch,
          operationIds: [operationId],
        });
        await prepareProvision(fixture, operationId);
        const result = await fixture.executor.execute({
          workspaceId: "ws-a",
          operationId,
          operationKind: "folder_provision",
        });
        assert.equal(result.outcome, "retry_scheduled");
        assert.equal(result.operation.lastErrorCode, scenario.errorCode);
      });
    }
  });

  it("renames only the pinned current generation and completes the receiptless journal row", async () => {
    let remote = folder({
      id: "folder-current",
      generationId: "gen-current",
      parentId: "root-old",
      name: "Old project name",
    });
    const driveMethods: string[] = [];
    const fetchImpl: typeof fetch = async (input, init) => {
      const url = String(input);
      if (url.includes("oauth2.googleapis.com/token")) {
        return tokenRefreshResponse();
      }
      driveMethods.push(init?.method ?? "GET");
      if (init?.method === "PATCH") {
        remote = {
          ...remote,
          name: (JSON.parse(String(init.body)) as { name: string }).name,
        };
      }
      return jsonResponse(remote);
    };
    const fixture = await executorFixture({ fetchImpl });
    await seedStorageGenerations(fixture.client);
    const operationId = await prepareRename(fixture);

    const result = await fixture.executor.execute({
      workspaceId: "ws-a",
      operationId,
      operationKind: "folder_rename",
    });
    assert.equal(result.outcome, "completed");
    assert.deepEqual(driveMethods, ["GET", "PATCH"]);
    assert.equal(remote.name, "Project A");
    const [operation] = await fixture.db
      .select()
      .from(projectDriveOperations)
      .where(eq(projectDriveOperations.id, operationId));
    assert.equal(operation.status, "succeeded");
    assert.equal(operation.providerFolderId, null);
  });

  it("refuses a stale workspace revision before any provider work", async () => {
    let providerCalls = 0;
    const fixture = await executorFixture({
      fetchImpl: async () => {
        providerCalls += 1;
        throw new Error("provider must not be reached");
      },
    });
    await seedStorageGenerations(fixture.client);
    const operationId = await prepareRename(fixture);
    await fixture.db
      .update(workspaces)
      .set({ name: "Changed", revision: 2 })
      .where(eq(workspaces.id, "ws-a"));

    const result = await fixture.executor.execute({
      workspaceId: "ws-a",
      operationId,
      operationKind: "folder_rename",
    });
    assert.equal(result.outcome, "manual_attention");
    assert.equal(result.operation.lastErrorCode, "workspace_changed");
    assert.equal(providerCalls, 0);
  });

  it("rechecks revision immediately before PATCH and suppresses a raced rename", async () => {
    let patches = 0;
    const fixtureRef: { current: ExecutorFixture | null } = { current: null };
    const remote = folder({
      id: "folder-current",
      generationId: "gen-current",
      parentId: "root-old",
      name: "Old project name",
    });
    const fetchImpl: typeof fetch = async (input, init) => {
      if (String(input).includes("oauth2.googleapis.com/token")) {
        return tokenRefreshResponse();
      }
      if (init?.method === "GET") {
        const current = fixtureRef.current;
        assert.ok(current);
        await current.db
          .update(workspaces)
          .set({ name: "Raced project name", revision: 2 })
          .where(eq(workspaces.id, "ws-a"));
        return jsonResponse(remote);
      }
      patches += 1;
      return jsonResponse(remote);
    };
    const fixture = await executorFixture({ fetchImpl });
    fixtureRef.current = fixture;
    await seedStorageGenerations(fixture.client);
    const operationId = await prepareRename(fixture);

    const result = await fixture.executor.execute({
      workspaceId: "ws-a",
      operationId,
      operationKind: "folder_rename",
    });
    assert.equal(result.outcome, "manual_attention");
    assert.equal(result.operation.lastErrorCode, "workspace_changed");
    assert.equal(patches, 0);
  });

  it("detects a revision race after PATCH and does not falsely complete", async () => {
    const fixtureRef: { current: ExecutorFixture | null } = { current: null };
    let patches = 0;
    let remote = folder({
      id: "folder-current",
      generationId: "gen-current",
      parentId: "root-old",
      name: "Old project name",
    });
    const fetchImpl: typeof fetch = async (input, init) => {
      if (String(input).includes("oauth2.googleapis.com/token")) {
        return tokenRefreshResponse();
      }
      if (init?.method === "PATCH") {
        patches += 1;
        remote = { ...remote, name: "Project A" };
      }
      return jsonResponse(remote);
    };
    const fixture = await executorFixture({
      fetchImpl,
      afterProviderSuccess: async () => {
        const current = fixtureRef.current;
        assert.ok(current);
        await current.db
          .update(workspaces)
          .set({ name: "Newer name", revision: 2 })
          .where(eq(workspaces.id, "ws-a"));
      },
    });
    fixtureRef.current = fixture;
    await seedStorageGenerations(fixture.client);
    const operationId = await prepareRename(fixture);

    const result = await fixture.executor.execute({
      workspaceId: "ws-a",
      operationId,
      operationKind: "folder_rename",
    });
    assert.equal(patches, 1);
    assert.equal(result.outcome, "manual_attention");
    assert.equal(result.operation.lastErrorCode, "workspace_changed");
  });

  it("recovers a rename crash by observing the already-correct provider name", async () => {
    let crash = true;
    let patches = 0;
    let remote = folder({
      id: "folder-current",
      generationId: "gen-current",
      parentId: "root-old",
      name: "Old project name",
    });
    const fetchImpl: typeof fetch = async (input, init) => {
      if (String(input).includes("oauth2.googleapis.com/token")) {
        return tokenRefreshResponse();
      }
      if (init?.method === "PATCH") {
        patches += 1;
        remote = { ...remote, name: "Project A" };
      }
      return jsonResponse(remote);
    };
    const fixture = await executorFixture({
      fetchImpl,
      afterProviderSuccess: async () => {
        if (crash) {
          crash = false;
          throw new Error("simulated rename process death");
        }
      },
    });
    await seedStorageGenerations(fixture.client);
    const operationId = await prepareRename(fixture);
    await assert.rejects(
      () =>
        fixture.executor.execute({
          workspaceId: "ws-a",
          operationId,
          operationKind: "folder_rename",
        }),
      /simulated rename process death/,
    );

    fixture.advance(2);
    const recovered = await fixture.executor.execute({
      workspaceId: "ws-a",
      operationId,
      operationKind: "folder_rename",
    });
    assert.equal(recovered.outcome, "completed");
    assert.equal(patches, 1, "the recovered attempt must not repeat PATCH");
  });
});
