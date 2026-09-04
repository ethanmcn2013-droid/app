import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { eq } from "drizzle-orm";
import { workspaceStorage } from "@/server/db/schema";
import {
  createDriveGrantRevocationService,
  type ExactDriveGrantReceipt,
} from "./project-drive-erasure-grants";
import {
  createDriveGrantService,
  createFolderPermissionMutationQueue,
  DriveGrantError,
} from "./drive-grants";
import {
  createProjectDriveAccessService,
  ProjectDriveAccessError,
} from "./project-drive-access";
import {
  accessDependencies,
  coreAuthorization,
  freshProjectDriveCoreDb,
  jsonResponse,
  seedProjectDriveCore,
  seedStorageGenerations,
  tokenRefreshResponse,
} from "./project-drive-core.test.helpers";
import { createProjectDrivePermissionMutationLease } from "./project-drive-permission-mutation-lease";

const cleanups: Array<() => void> = [];
afterEach(() => {
  while (cleanups.length) cleanups.pop()?.();
});

const exactReceipt: ExactDriveGrantReceipt = Object.freeze({
  workspaceId: "ws-a",
  storageGenerationId: "gen-current",
  connectionId: "conn-old",
  folderId: "folder-current",
  userId: "member-a",
  permissionId: "permission-a",
});

async function seededRevoker(fetchImpl: typeof fetch) {
  const fixture = await freshProjectDriveCoreDb();
  cleanups.push(fixture.cleanup);
  await seedProjectDriveCore(fixture.client);
  await seedStorageGenerations(fixture.client);
  const access = createProjectDriveAccessService(
    accessDependencies(fixture.db, fetchImpl),
  );
  return {
    ...fixture,
    service: createDriveGrantRevocationService({
      database: fixture.db,
      access,
      fetchImpl,
    }),
  };
}

describe("exact Drive grant revocation", () => {
  for (const outcome of [
    { status: 204, alreadyAbsent: false },
    { status: 404, alreadyAbsent: true },
  ] as const) {
    it(`treats provider ${outcome.status} as an idempotent success`, async () => {
      let refreshCalls = 0;
      let deleteCalls = 0;
      const fetchImpl: typeof fetch = async (input, init) => {
        const url = String(input);
        if (url.includes("oauth2.googleapis.com/token")) {
          refreshCalls += 1;
          return tokenRefreshResponse();
        }
        deleteCalls += 1;
        assert.equal(
          url,
          "https://www.googleapis.com/drive/v3/files/folder-current/permissions/permission-a",
        );
        assert.equal(init?.method, "DELETE");
        assert.equal(
          new Headers(init?.headers).get("Authorization"),
          "Bearer request-access",
        );
        assert.equal(init?.redirect, "error");
        return new Response(null, { status: outcome.status });
      };
      const fixture = await seededRevoker(fetchImpl);

      const result = await fixture.service.revoke(exactReceipt);

      assert.deepEqual(result, { alreadyAbsent: outcome.alreadyAbsent });
      assert.equal(refreshCalls, 1);
      assert.equal(deleteCalls, 1);
    });
  }

  it("refuses every stale or cross-project storage receipt before provider I/O", async () => {
    let calls = 0;
    const fixture = await seededRevoker(async () => {
      calls += 1;
      return tokenRefreshResponse();
    });
    const staleReceipts: ExactDriveGrantReceipt[] = [
      { ...exactReceipt, workspaceId: "ws-b" },
      { ...exactReceipt, storageGenerationId: "gen-old" },
      { ...exactReceipt, connectionId: "conn-other" },
      { ...exactReceipt, folderId: "folder-old" },
    ];

    for (const receipt of staleReceipts) {
      await assert.rejects(
        () => fixture.service.revoke(receipt),
        ProjectDriveAccessError,
      );
    }
    assert.equal(calls, 0);
  });

  it("refuses a private Drive root even if corrupt storage metadata names it", async () => {
    let refreshCalls = 0;
    let deleteCalls = 0;
    const fetchImpl: typeof fetch = async (input) => {
      if (String(input).includes("oauth2.googleapis.com/token")) {
        refreshCalls += 1;
        return tokenRefreshResponse();
      }
      deleteCalls += 1;
      return new Response(null, { status: 204 });
    };
    const fixture = await seededRevoker(fetchImpl);
    await fixture.db
      .update(workspaceStorage)
      .set({ folderId: "root-old" })
      .where(eq(workspaceStorage.id, "gen-old"));

    await assert.rejects(
      () =>
        fixture.service.revoke({
          ...exactReceipt,
          storageGenerationId: "gen-old",
          folderId: "root-old",
        }),
      (error: unknown) =>
        error instanceof DriveGrantError &&
        error.code === "root-folder-target",
    );
    assert.equal(refreshCalls, 1);
    assert.equal(deleteCalls, 0);
  });

  it("maps provider and transport failures without exposing provider bodies", async () => {
    for (const scenario of [
      { response: new Response("secret-provider-body", { status: 503 }), retryable: true },
      { response: new Response("secret-provider-body", { status: 403 }), retryable: false },
      { response: null, retryable: true },
    ] as const) {
      const fixture = await seededRevoker(async (input) => {
        if (String(input).includes("oauth2.googleapis.com/token")) {
          return tokenRefreshResponse();
        }
        if (!scenario.response) throw new Error("secret transport detail");
        return scenario.response;
      });

      await assert.rejects(
        () => fixture.service.revoke(exactReceipt),
        (error: unknown) => {
          assert.ok(error instanceof DriveGrantError);
          assert.equal(error.code, "provider-error");
          assert.equal(error.retryable, scenario.retryable);
          assert.doesNotMatch(error.message, /secret/i);
          return true;
        },
      );
      fixture.cleanup();
      cleanups.pop();
    }
  });

  it("serializes create against exact repair delete across two service instances", async () => {
    let postCalls = 0;
    let deleteCalls = 0;
    let createStarted!: () => void;
    let releaseCreate!: () => void;
    const started = new Promise<void>((resolve) => {
      createStarted = resolve;
    });
    const providerGate = new Promise<void>((resolve) => {
      releaseCreate = resolve;
    });
    const fetchImpl: typeof fetch = async (input, init) => {
      if (String(input).includes("oauth2.googleapis.com/token")) {
        return tokenRefreshResponse();
      }
      if (init?.method === "POST") {
        postCalls += 1;
        createStarted();
        await providerGate;
        return jsonResponse({
          id: "permission-created",
          type: "user",
          role: "writer",
          emailAddress: "member.a@example.com",
        });
      }
      assert.equal(init?.method, "DELETE");
      deleteCalls += 1;
      return new Response(null, { status: 204 });
    };
    const fixture = await seededRevoker(fetchImpl);
    const independentAccess = createProjectDriveAccessService(
      accessDependencies(fixture.db, fetchImpl),
    );
    const creator = createDriveGrantService({
      database: fixture.db,
      access: independentAccess,
      fetchImpl,
      now: () => new Date("2026-09-02T22:15:00.000Z"),
      mutationQueue: createFolderPermissionMutationQueue(),
      mutationLease: createProjectDrivePermissionMutationLease({
        database: fixture.db,
      }),
    });
    const revoker = createDriveGrantRevocationService({
      database: fixture.db,
      access: independentAccess,
      fetchImpl,
      mutationQueue: createFolderPermissionMutationQueue(),
      mutationLease: createProjectDrivePermissionMutationLease({
        database: fixture.db,
      }),
    });

    const creating = creator.create(coreAuthorization("owner", "ws-a"), {
      memberUserId: "member-a",
      role: "writer",
      sendNotificationEmail: false,
    });
    await started;

    await assert.rejects(
      () => revoker.revoke(exactReceipt),
      (error: unknown) => {
        assert.ok(error instanceof DriveGrantError);
        assert.equal(error.code, "provider-error");
        assert.equal(error.operation, "permission-delete");
        assert.equal(error.retryable, true);
        return true;
      },
    );
    assert.equal(postCalls, 1);
    assert.equal(deleteCalls, 0);

    releaseCreate();
    await creating;
    assert.deepEqual(await revoker.revoke(exactReceipt), {
      alreadyAbsent: false,
    });
    assert.equal(postCalls, 1);
    assert.equal(deleteCalls, 1);
  });

  it("does not serialize provider mutations for different immutable generations", async () => {
    let createStarted!: () => void;
    let releaseCreate!: () => void;
    const started = new Promise<void>((resolve) => {
      createStarted = resolve;
    });
    const providerGate = new Promise<void>((resolve) => {
      releaseCreate = resolve;
    });
    let currentPostPending = false;
    let oldGenerationDeleteWhilePending = false;
    const fetchImpl: typeof fetch = async (input, init) => {
      const url = String(input);
      if (url.includes("oauth2.googleapis.com/token")) {
        return tokenRefreshResponse();
      }
      if (init?.method === "POST") {
        currentPostPending = true;
        createStarted();
        await providerGate;
        currentPostPending = false;
        return jsonResponse({
          id: "permission-current",
          type: "user",
          role: "writer",
          emailAddress: "member.a@example.com",
        });
      }
      assert.equal(init?.method, "DELETE");
      assert.match(url, /files\/folder-old\/permissions\/permission-old$/);
      oldGenerationDeleteWhilePending = currentPostPending;
      return new Response(null, { status: 204 });
    };
    const fixture = await seededRevoker(fetchImpl);
    const access = createProjectDriveAccessService(
      accessDependencies(fixture.db, fetchImpl),
    );
    const creator = createDriveGrantService({
      database: fixture.db,
      access,
      fetchImpl,
      now: () => new Date("2026-09-02T22:15:00.000Z"),
      mutationQueue: createFolderPermissionMutationQueue(),
      mutationLease: createProjectDrivePermissionMutationLease({
        database: fixture.db,
      }),
    });
    const revoker = createDriveGrantRevocationService({
      database: fixture.db,
      access,
      fetchImpl,
      mutationQueue: createFolderPermissionMutationQueue(),
      mutationLease: createProjectDrivePermissionMutationLease({
        database: fixture.db,
      }),
    });

    const creating = creator.create(coreAuthorization("owner", "ws-a"), {
      memberUserId: "member-a",
      role: "writer",
      sendNotificationEmail: false,
    });
    await started;
    assert.deepEqual(
      await revoker.revoke({
        ...exactReceipt,
        storageGenerationId: "gen-old",
        folderId: "folder-old",
        permissionId: "permission-old",
      }),
      { alreadyAbsent: false },
    );
    assert.equal(oldGenerationDeleteWhilePending, true);

    releaseCreate();
    await creating;
  });
});
