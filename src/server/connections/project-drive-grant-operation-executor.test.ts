import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { eq, sql } from "drizzle-orm";
import {
  driveFolderGrants,
  meta,
  projectDriveOperations,
  workspaceMembers,
} from "@/server/db/schema";
import {
  createFolderPermissionMutationQueue,
  recoverOrCreateExactDriveUserPermission,
} from "./drive-grants";
import { createProjectDriveAccessService } from "./project-drive-access";
import {
  accessDependencies,
  freshProjectDriveCoreDb,
  jsonResponse,
  seedProjectDriveCore,
  seedStorageGenerations,
  tokenRefreshResponse,
} from "./project-drive-core.test.helpers";
import {
  createProjectDriveGrantOperationExecutor,
} from "./project-drive-grant-operation-executor";
import { createProjectDriveOperationJournal } from "./project-drive-operation-journal";
import { googleDriveAccountErasureFenceKey } from "./project-drive-operation-lifecycle";
import { createAccountFencedProjectDriveOperationJournal } from "./project-drive-operation-orchestrator";

const START = Date.parse("2030-01-01T12:00:00.000Z");
const cleanups: Array<() => void> = [];

afterEach(() => {
  while (cleanups.length) cleanups.pop()?.();
});

function clock(initial = START) {
  let seconds = Math.floor(initial / 1_000);
  return {
    nowSql: () => sql<Date>`${seconds}`,
    advance(durationMs: number) {
      assert.equal(durationMs % 1_000, 0);
      seconds += durationMs / 1_000;
    },
  };
}

type FixtureOptions = Readonly<{
  operationIds?: string[];
  afterProviderSuccess?: () => Promise<void>;
  journalForTransaction?: typeof createProjectDriveOperationJournal;
}>;

async function seededExecutor(
  fetchImpl: typeof fetch,
  options: FixtureOptions = {},
) {
  const fixture = await freshProjectDriveCoreDb();
  cleanups.push(fixture.cleanup);
  await seedProjectDriveCore(fixture.client);
  await seedStorageGenerations(fixture.client);
  await fixture.client.execute("PRAGMA foreign_keys = ON");
  const time = clock();
  const ids = [...(options.operationIds ?? ["op-grant-a"])];
  const operations = createAccountFencedProjectDriveOperationJournal({
    database: fixture.db,
    randomOperationId: () => ids.shift() ?? "unexpected-operation-id",
    leaseDurationMs: 10_000,
    databaseNowSeconds: time.nowSql,
  });
  const journal = createProjectDriveOperationJournal({
    database: fixture.db,
    leaseDurationMs: 10_000,
    databaseNowSeconds: time.nowSql,
  });
  const access = createProjectDriveAccessService(
    accessDependencies(
      fixture.db,
      fetchImpl,
      () => new Date(START),
    ),
  );
  const mutationQueue = createFolderPermissionMutationQueue();
  const journalFactory = options.journalForTransaction;
  const executor = createProjectDriveGrantOperationExecutor({
    database: fixture.db,
    operations,
    journal,
    journalForTransaction: (database) =>
      journalFactory
        ? journalFactory({ database })
        : createProjectDriveOperationJournal({
            database,
            leaseDurationMs: 10_000,
            databaseNowSeconds: time.nowSql,
          }),
    access,
    recoverOrCreatePermission: (session, input) =>
      recoverOrCreateExactDriveUserPermission(
        session,
        input,
        fetchImpl,
        mutationQueue,
      ),
    databaseNowSeconds: time.nowSql,
    retryBaseMs: 1_000,
    maxAutomaticAttempts: 3,
    afterProviderSuccess: options.afterProviderSuccess,
  });
  return { ...fixture, time, operations, journal, access, executor };
}

async function prepareGrant(
  fixture: Awaited<ReturnType<typeof seededExecutor>>,
  input: Readonly<{
    userId?: string;
    email?: string;
    storageGenerationId?: string;
    role?: "writer" | "reader";
  }> = {},
) {
  const prepared = await fixture.executor.prepare({
    operationKind: "grant_create",
    workspaceId: "ws-a",
    storageGenerationId: input.storageGenerationId ?? "gen-current",
    subjectUserId: input.userId ?? "member-a",
    granteeEmail: input.email ?? "member.a@example.com",
    grantRole: input.role ?? "writer",
  });
  assert.notEqual(prepared.outcome, "conflict");
  if (prepared.outcome === "conflict") throw new Error("unreachable");
  return prepared.operation;
}

async function operationRow(
  fixture: Awaited<ReturnType<typeof seededExecutor>>,
  operationId: string,
) {
  const [row] = await fixture.db
    .select()
    .from(projectDriveOperations)
    .where(eq(projectDriveOperations.id, operationId));
  return row;
}

async function grantRows(
  fixture: Awaited<ReturnType<typeof seededExecutor>>,
) {
  return fixture.db.select().from(driveFolderGrants);
}

function permissionList(
  permissions: readonly Record<string, unknown>[],
): Response {
  return jsonResponse({ permissions });
}

describe("Project Drive grant operation executor · exact provider work", () => {
  it("creates one named-user permission and atomically stores both receipts", async () => {
    const providerCalls: Array<{ url: string; init?: RequestInit }> = [];
    const fetchImpl: typeof fetch = async (input, init) => {
      const url = String(input);
      if (url.includes("oauth2.googleapis.com/token")) {
        return tokenRefreshResponse();
      }
      providerCalls.push({ url, init });
      if (init?.method === "GET") return permissionList([]);
      assert.equal(init?.method, "POST");
      return jsonResponse({
        id: "permission-created",
        type: "user",
        role: "writer",
        emailAddress: "member.a@example.com",
      });
    };
    const fixture = await seededExecutor(fetchImpl);
    const operation = await prepareGrant(fixture);
    const result = await fixture.executor.execute({
      workspaceId: "ws-a",
      operationId: operation.operationId,
    });

    assert.equal(result.outcome, "completed");
    assert.deepEqual(
      providerCalls.map((call) => call.init?.method),
      ["GET", "POST"],
    );
    assert.match(providerCalls[0].url, /files\/folder-current\/permissions/);
    assert.match(providerCalls[1].url, /files\/folder-current\/permissions/);
    assert.equal(
      new URL(providerCalls[1].url).searchParams.get("sendNotificationEmail"),
      "false",
    );
    assert.deepEqual(JSON.parse(String(providerCalls[1].init?.body)), {
      type: "user",
      role: "writer",
      emailAddress: "member.a@example.com",
    });
    const [grant] = await grantRows(fixture);
    assert.equal(grant.permissionId, "permission-created");
    assert.equal(grant.storageGenerationId, "gen-current");
    assert.equal(grant.revokePending, false);
    const storedOperation = await operationRow(fixture, operation.operationId);
    assert.equal(storedOperation.status, "succeeded");
    assert.equal(storedOperation.providerPermissionId, "permission-created");
  });

  it("adopts a crash-before-receipt success and never repeats the POST", async () => {
    let permissionExists = false;
    let postCalls = 0;
    let crashOnce = true;
    const fetchImpl: typeof fetch = async (input, init) => {
      const url = String(input);
      if (url.includes("oauth2.googleapis.com/token")) {
        return tokenRefreshResponse();
      }
      if (init?.method === "GET") {
        return permissionList(
          permissionExists
            ? [
                {
                  id: "permission-after-crash",
                  type: "user",
                  role: "writer",
                  emailAddress: "member.a@example.com",
                },
              ]
            : [],
        );
      }
      postCalls += 1;
      permissionExists = true;
      return jsonResponse({
        id: "permission-after-crash",
        type: "user",
        role: "writer",
        emailAddress: "member.a@example.com",
      });
    };
    const fixture = await seededExecutor(fetchImpl, {
      afterProviderSuccess: async () => {
        if (crashOnce) {
          crashOnce = false;
          throw new Error("simulated worker death");
        }
      },
    });
    const operation = await prepareGrant(fixture);

    await assert.rejects(
      fixture.executor.execute({
        workspaceId: "ws-a",
        operationId: operation.operationId,
      }),
      /simulated worker death/,
    );
    assert.equal((await operationRow(fixture, operation.operationId)).status, "running");
    assert.equal((await grantRows(fixture)).length, 0);

    fixture.time.advance(11_000);
    const recovered = await fixture.executor.execute({
      workspaceId: "ws-a",
      operationId: operation.operationId,
    });
    assert.equal(recovered.outcome, "completed");
    assert.equal(postCalls, 1);
    assert.equal((await grantRows(fixture))[0].permissionId, "permission-after-crash");
  });

  it("refuses ambiguous or wrong-role live matches without a duplicate POST", async () => {
    for (const permissions of [
      [
        {
          id: "permission-one",
          type: "user",
          role: "writer",
          emailAddress: "member.a@example.com",
        },
        {
          id: "permission-two",
          type: "user",
          role: "writer",
          emailAddress: "member.a@example.com",
        },
      ],
      [
        {
          id: "permission-reader",
          type: "user",
          role: "reader",
          emailAddress: "member.a@example.com",
        },
      ],
      [
        {
          id: "permission-group",
          type: "group",
          role: "writer",
          emailAddress: "member.a@example.com",
        },
      ],
    ]) {
      let postCalls = 0;
      const fixture = await seededExecutor(async (input, init) => {
        if (String(input).includes("oauth2.googleapis.com/token")) {
          return tokenRefreshResponse();
        }
        if (init?.method === "POST") postCalls += 1;
        return permissionList(permissions);
      });
      const operation = await prepareGrant(fixture);
      const result = await fixture.executor.execute({
        workspaceId: "ws-a",
        operationId: operation.operationId,
      });
      assert.equal(result.outcome, "manual_attention");
      assert.equal(postCalls, 0);
      const stored = await operationRow(fixture, operation.operationId);
      assert.equal(stored.lastErrorCode, "ambiguous_provider_result");
      assert.equal((await grantRows(fixture)).length, 0);
    }
  });

  it("keeps a non-Google member and records a visible manual access gap", async () => {
    const fixture = await seededExecutor(async (input, init) => {
      if (String(input).includes("oauth2.googleapis.com/token")) {
        return tokenRefreshResponse();
      }
      if (init?.method === "GET") return permissionList([]);
      return jsonResponse(
        {
          error: {
            errors: [{ reason: "cannotInviteNonGoogleUser" }],
            message: "private provider prose",
          },
        },
        400,
      );
    });
    const operation = await prepareGrant(fixture);
    const result = await fixture.executor.execute({
      workspaceId: "ws-a",
      operationId: operation.operationId,
    });

    assert.equal(result.outcome, "manual_attention");
    const [membership] = await fixture.db
      .select()
      .from(workspaceMembers)
      .where(
        eq(workspaceMembers.userId, "member-a"),
      );
    assert.equal(membership.workspaceId, "ws-a");
    const stored = await operationRow(fixture, operation.operationId);
    assert.equal(stored.lastErrorCode, "cannot_invite_non_google_user");
    assert.equal(stored.providerPermissionId, null);
  });

  it("classifies an ambiguous create failure for list-first retry", async () => {
    const fixture = await seededExecutor(async (input, init) => {
      if (String(input).includes("oauth2.googleapis.com/token")) {
        return tokenRefreshResponse();
      }
      if (init?.method === "GET") return permissionList([]);
      return jsonResponse(
        { error: { errors: [{ reason: "backendError" }] } },
        503,
      );
    });
    const operation = await prepareGrant(fixture);
    const result = await fixture.executor.execute({
      workspaceId: "ws-a",
      operationId: operation.operationId,
    });
    assert.equal(result.outcome, "retry_scheduled");
    const stored = await operationRow(fixture, operation.operationId);
    assert.equal(stored.status, "retry_wait");
    assert.equal(stored.lastErrorCode, "ambiguous_provider_result");
  });

  it("never recreates a locally recorded permission that is missing at Google", async () => {
    let postCalls = 0;
    const fixture = await seededExecutor(async (input, init) => {
      if (String(input).includes("oauth2.googleapis.com/token")) {
        return tokenRefreshResponse();
      }
      if (init?.method === "POST") postCalls += 1;
      return permissionList([]);
    });
    await fixture.db.insert(driveFolderGrants).values({
      storageGenerationId: "gen-current",
      workspaceId: "ws-a",
      userId: "member-a",
      permissionId: "permission-recorded",
      grantedEmail: "member.a@example.com",
      role: "writer",
      grantedAt: new Date(START),
      revokePending: false,
    });
    const operation = await prepareGrant(fixture);
    const result = await fixture.executor.execute({
      workspaceId: "ws-a",
      operationId: operation.operationId,
    });
    assert.equal(result.outcome, "manual_attention");
    assert.equal(postCalls, 0);
    assert.equal(
      (await operationRow(fixture, operation.operationId)).lastErrorCode,
      "grant_not_found",
    );
    assert.equal((await grantRows(fixture))[0].permissionId, "permission-recorded");
  });

  it("does not hold a database writer transaction across provider GET or POST", async () => {
    const holder: {
      current: Awaited<ReturnType<typeof seededExecutor>> | null;
    } = { current: null };
    let providerCalls = 0;
    const proveIndependentWriter = async () => {
      const marker = `provider-boundary-${providerCalls}`;
      const write = holder.current!.client.execute({
        sql: `INSERT INTO meta (key, value, updated_at)
              VALUES (?, 'ok', unixepoch())
              ON CONFLICT(key) DO UPDATE SET value = 'ok', updated_at = unixepoch()`,
        args: [marker],
      });
      let timeout: ReturnType<typeof setTimeout> | null = null;
      try {
        await Promise.race([
          write,
          new Promise<never>((_, reject) => {
            timeout = setTimeout(
              () =>
                reject(
                  new Error(
                    "provider I/O was called under a writer transaction",
                  ),
                ),
              2_000,
            );
          }),
        ]);
      } finally {
        if (timeout) clearTimeout(timeout);
      }
    };
    const fixture = await seededExecutor(async (input, init) => {
      if (String(input).includes("oauth2.googleapis.com/token")) {
        return tokenRefreshResponse();
      }
      providerCalls += 1;
      await proveIndependentWriter();
      if (init?.method === "GET") return permissionList([]);
      return jsonResponse({
        id: "permission-transaction-boundary",
        type: "user",
        role: "writer",
        emailAddress: "member.a@example.com",
      });
    });
    holder.current = fixture;
    const operation = await prepareGrant(fixture);
    const result = await fixture.executor.execute({
      workspaceId: "ws-a",
      operationId: operation.operationId,
    });
    assert.equal(result.outcome, "completed");
    assert.equal(providerCalls, 2);
  });
});

describe("Project Drive grant operation executor · live intent fences", () => {
  it("rechecks membership and exact current email after discovery, before POST", async () => {
    for (const mutate of [
      async (fixture: Awaited<ReturnType<typeof seededExecutor>>) => {
        await fixture.db
          .delete(workspaceMembers)
          .where(
            eq(workspaceMembers.userId, "member-a"),
          );
      },
      async (fixture: Awaited<ReturnType<typeof seededExecutor>>) => {
        await fixture.client.execute(
          "UPDATE users SET email = 'changed@example.com' WHERE id = 'member-a'",
        );
      },
    ]) {
      const holder: {
        current: Awaited<ReturnType<typeof seededExecutor>> | null;
      } = { current: null };
      let mutated = false;
      let postCalls = 0;
      const fetchImpl: typeof fetch = async (input, init) => {
        if (String(input).includes("oauth2.googleapis.com/token")) {
          return tokenRefreshResponse();
        }
        if (init?.method === "GET") {
          if (!mutated) {
            mutated = true;
            await mutate(holder.current!);
          }
          return permissionList([]);
        }
        postCalls += 1;
        throw new Error("POST must not run");
      };
      const fixture = await seededExecutor(fetchImpl);
      holder.current = fixture;
      const operation = await prepareGrant(fixture);
      const result = await fixture.executor.execute({
        workspaceId: "ws-a",
        operationId: operation.operationId,
      });
      assert.equal(result.outcome, "manual_attention");
      assert.equal(postCalls, 0);
      assert.equal(
        (await operationRow(fixture, operation.operationId)).lastErrorCode,
        "workspace_changed",
      );
    }
  });

  it("refuses a stale generation and a mismatched receipt session", async () => {
    let providerCalls = 0;
    const noProvider: typeof fetch = async (input) => {
      if (String(input).includes("oauth2.googleapis.com/token")) {
        return tokenRefreshResponse();
      }
      providerCalls += 1;
      return permissionList([]);
    };
    const stale = await seededExecutor(noProvider);
    const staleOperation = await prepareGrant(stale);
    await stale.client.executeMultiple(`
      UPDATE workspace_storage SET is_current = 0 WHERE id = 'gen-current';
      UPDATE workspace_storage SET is_current = 1 WHERE id = 'gen-old';
    `);
    const staleResult = await stale.executor.execute({
      workspaceId: "ws-a",
      operationId: staleOperation.operationId,
    });
    assert.equal(staleResult.outcome, "manual_attention");
    assert.equal(providerCalls, 0);

    const wrongSession = await seededExecutor(noProvider);
    const wrongOperation = await prepareGrant(wrongSession);
    const wrongExecutor = createProjectDriveGrantOperationExecutor({
      database: wrongSession.db,
      operations: wrongSession.operations,
      journal: wrongSession.journal,
      journalForTransaction: (database) =>
        createProjectDriveOperationJournal({
          database,
          leaseDurationMs: 10_000,
          databaseNowSeconds: wrongSession.time.nowSql,
        }),
      access: {
        withReceiptStorageSession: async (_receipt, operation) =>
          operation({
            accessToken: "request-access",
            credential: {
              id: "conn-new",
              ownerUserId: "owner",
              providerAccountId: "account-owner",
              providerAccountEmail: "owner@example.com",
              rootFolderId: "root-new",
            },
            storageRootFolderId: "root-old",
            storage: {
              id: "gen-current",
              workspaceId: "ws-a",
              connectionId: "conn-old",
              folderId: "folder-wrong",
              folderWebViewLink: "https://drive.example/folder-wrong",
              state: "active",
              isCurrent: true,
            },
          }),
      },
      recoverOrCreatePermission: async () => {
        throw new Error("provider must not run");
      },
      databaseNowSeconds: wrongSession.time.nowSql,
    });
    const wrongResult = await wrongExecutor.execute({
      workspaceId: "ws-a",
      operationId: wrongOperation.operationId,
    });
    assert.equal(wrongResult.outcome, "manual_attention");
    assert.equal(
      (await operationRow(wrongSession, wrongOperation.operationId))
        .lastErrorCode,
      "workspace_changed",
    );
  });

  it("uses the account-fenced journal for both prepare and claim", async () => {
    let providerCalls = 0;
    const fixture = await seededExecutor(async () => {
      providerCalls += 1;
      throw new Error("provider must not run");
    }, { operationIds: ["op-fenced-prepare", "op-fenced-claim"] });
    await fixture.db.insert(meta).values({
      key: googleDriveAccountErasureFenceKey("member-a"),
      value: "active:v1",
    });
    const refused = await fixture.executor.prepare({
      operationKind: "grant_create",
      workspaceId: "ws-a",
      storageGenerationId: "gen-current",
      subjectUserId: "member-a",
      granteeEmail: "member.a@example.com",
      grantRole: "writer",
    });
    assert.equal(refused.outcome, "conflict");

    await fixture.db
      .delete(meta)
      .where(eq(meta.key, googleDriveAccountErasureFenceKey("member-a")));
    const operation = await prepareGrant(fixture);
    await fixture.db.insert(meta).values({
      key: googleDriveAccountErasureFenceKey("owner"),
      value: "active:v1",
    });
    const claimRefused = await fixture.executor.execute({
      workspaceId: "ws-a",
      operationId: operation.operationId,
    });
    assert.equal(claimRefused.outcome, "conflict");
    assert.equal(providerCalls, 0);
  });

  it("rechecks account fences after discovery, directly before POST", async () => {
    const holder: {
      current: Awaited<ReturnType<typeof seededExecutor>> | null;
    } = { current: null };
    let postCalls = 0;
    const fetchImpl: typeof fetch = async (input, init) => {
      if (String(input).includes("oauth2.googleapis.com/token")) {
        return tokenRefreshResponse();
      }
      if (init?.method === "GET") {
        await holder.current!.db.insert(meta).values({
          key: googleDriveAccountErasureFenceKey("member-a"),
          value: "active:v1",
        });
        return permissionList([]);
      }
      postCalls += 1;
      throw new Error("POST must not run after an account fence");
    };
    const fixture = await seededExecutor(fetchImpl);
    holder.current = fixture;
    const operation = await prepareGrant(fixture);
    const result = await fixture.executor.execute({
      workspaceId: "ws-a",
      operationId: operation.operationId,
    });
    assert.equal(result.outcome, "manual_attention");
    assert.equal(postCalls, 0);
    assert.equal(
      (await operationRow(fixture, operation.operationId)).lastErrorCode,
      "repair_incomplete",
    );
  });
});

describe("Project Drive grant operation executor · stale provider success", () => {
  for (const scenario of [
    {
      name: "member removal",
      mutate: async (fixture: Awaited<ReturnType<typeof seededExecutor>>) => {
        await fixture.db
          .delete(workspaceMembers)
          .where(eq(workspaceMembers.userId, "member-a"));
      },
    },
    {
      name: "member email change",
      mutate: async (fixture: Awaited<ReturnType<typeof seededExecutor>>) => {
        await fixture.client.execute(
          "UPDATE users SET email = 'changed@example.com' WHERE id = 'member-a'",
        );
      },
    },
    {
      name: "storage handover",
      mutate: async (fixture: Awaited<ReturnType<typeof seededExecutor>>) => {
        await fixture.client.executeMultiple(`
          UPDATE workspace_storage SET is_current = 0 WHERE id = 'gen-current';
          UPDATE workspace_storage SET is_current = 1 WHERE id = 'gen-old';
        `);
      },
    },
    {
      name: "account erasure fence",
      mutate: async (fixture: Awaited<ReturnType<typeof seededExecutor>>) => {
        fixture.time.advance(11_000);
        await fixture.db.insert(meta).values({
          key: googleDriveAccountErasureFenceKey("member-a"),
          value: "active:v1",
        });
        const [operation] = await fixture.db
          .select({ id: projectDriveOperations.id })
          .from(projectDriveOperations)
          .where(eq(projectDriveOperations.operationKind, "grant_create"));
        const quarantined = await fixture.operations.quarantineExpiredForErasure({
          workspaceId: "ws-a",
          operationId: operation.id,
        });
        assert.equal(quarantined.outcome, "quarantined");
      },
    },
  ]) {
    it(`quarantines exact permission truth after ${scenario.name}`, async () => {
      const holder: {
        current: Awaited<ReturnType<typeof seededExecutor>> | null;
      } = { current: null };
      const fetchImpl: typeof fetch = async (input, init) => {
        if (String(input).includes("oauth2.googleapis.com/token")) {
          return tokenRefreshResponse();
        }
        if (init?.method === "GET") return permissionList([]);
        return jsonResponse({
          id: `permission-${scenario.name.replaceAll(" ", "-")}`,
          type: "user",
          role: "writer",
          emailAddress: "member.a@example.com",
        });
      };
      const fixture = await seededExecutor(fetchImpl, {
        afterProviderSuccess: async () => scenario.mutate(holder.current!),
      });
      holder.current = fixture;
      const operation = await prepareGrant(fixture);
      const result = await fixture.executor.execute({
        workspaceId: "ws-a",
        operationId: operation.operationId,
      });

      assert.equal(result.outcome, "repair_pending");
      const [grant] = await grantRows(fixture);
      assert.equal(grant.revokePending, true);
      assert.equal(
        grant.permissionId,
        `permission-${scenario.name.replaceAll(" ", "-")}`,
      );
      const stored = await operationRow(fixture, operation.operationId);
      assert.equal(stored.status, "succeeded");
      assert.equal(stored.providerPermissionId, grant.permissionId);
      const activeCoverage = (await grantRows(fixture)).filter(
        (row) => !row.revokePending,
      );
      assert.equal(activeCoverage.length, 0);
    });
  }

  it("rolls back the domain receipt when journal completion loses its fence", async () => {
    const fixture = await seededExecutor(async (input, init) => {
      if (String(input).includes("oauth2.googleapis.com/token")) {
        return tokenRefreshResponse();
      }
      if (init?.method === "GET") return permissionList([]);
      return jsonResponse({
        id: "permission-no-partial-commit",
        type: "user",
        role: "writer",
        emailAddress: "member.a@example.com",
      });
    });
    const operation = await prepareGrant(fixture);
    const executor = createProjectDriveGrantOperationExecutor({
      database: fixture.db,
      operations: fixture.operations,
      journal: fixture.journal,
      journalForTransaction: () => ({
        complete: async () => ({ outcome: "conflict" as const }),
        recordErasureRecovery: async () => ({ outcome: "conflict" as const }),
      }),
      access: fixture.access,
      recoverOrCreatePermission: (session, input) =>
        recoverOrCreateExactDriveUserPermission(
          session,
          input,
          async (request, init) => {
            if (String(request).includes("oauth2.googleapis.com/token")) {
              return tokenRefreshResponse();
            }
            if (init?.method === "GET") return permissionList([]);
            return jsonResponse({
              id: "permission-no-partial-commit",
              type: "user",
              role: "writer",
              emailAddress: "member.a@example.com",
            });
          },
          createFolderPermissionMutationQueue(),
        ),
      databaseNowSeconds: fixture.time.nowSql,
    });
    const result = await executor.execute({
      workspaceId: "ws-a",
      operationId: operation.operationId,
    });
    assert.equal(result.outcome, "conflict");
    assert.equal((await grantRows(fixture)).length, 0);
    const stored = await operationRow(fixture, operation.operationId);
    assert.equal(stored.status, "running");
    assert.equal(stored.providerPermissionId, null);
  });
});
