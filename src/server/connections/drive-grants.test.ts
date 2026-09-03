import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { and, eq } from "drizzle-orm";
import { driveFolderGrants } from "@/server/db/schema";
import {
  assertGrantTarget,
  createDriveGrantService,
  createFolderPermissionMutationQueue,
  DriveGrantError,
  recoverOrCreateExactDriveUserPermission,
} from "./drive-grants";
import {
  createProjectDriveAccessService,
  type ProjectDriveStorageSession,
} from "./project-drive-access";
import { ProjectDriveAuthorizationError } from "./project-drive-authz";
import {
  accessDependencies,
  coreAuthorization,
  freshProjectDriveCoreDb,
  jsonResponse,
  seedProjectDriveCore,
  seedStorageGenerations,
  tokenRefreshResponse,
} from "./project-drive-core.test.helpers";

const cleanups: Array<() => void> = [];
afterEach(() => {
  while (cleanups.length) cleanups.pop()?.();
});

async function seededGrantFixture(fetchImpl: typeof fetch) {
  const fixture = await freshProjectDriveCoreDb();
  cleanups.push(fixture.cleanup);
  await seedProjectDriveCore(fixture.client);
  await seedStorageGenerations(fixture.client);
  const access = createProjectDriveAccessService(
    accessDependencies(fixture.db, fetchImpl),
  );
  return {
    ...fixture,
    service: createDriveGrantService({
      database: fixture.db,
      access,
      fetchImpl,
      now: () => new Date("2026-09-02T22:15:00.000Z"),
      mutationQueue: createFolderPermissionMutationQueue(),
    }),
  };
}

async function seedGrant(
  client: import("@libsql/client").Client,
  input: { userId?: string; permissionId?: string; generationId?: string } = {},
) {
  await client.execute({
    sql: `INSERT INTO drive_folder_grants (
      storage_generation_id, workspace_id, user_id, permission_id,
      granted_email, role, granted_at, revoke_pending
    ) VALUES (?, 'ws-a', ?, ?, ?, 'writer', 10, 0)`,
    args: [
      input.generationId ?? "gen-current",
      input.userId ?? "member-a",
      input.permissionId ?? "permission-a",
      input.userId === "member-b"
        ? "member.b@example.com"
        : "member.a@example.com",
    ],
  });
}

describe("Project Drive folder grants", () => {
  it("refuses a task-only proof before database or provider work", async () => {
    let providerCalls = 0;
    const fixture = await seededGrantFixture(async () => {
      providerCalls += 1;
      throw new Error("provider must not be reached");
    });
    await assert.rejects(
      () =>
        fixture.service.create(coreAuthorization("member-a", "ws-a", false), {
          memberUserId: "member-b",
          role: "reader",
          sendNotificationEmail: false,
        }),
      ProjectDriveAuthorizationError,
    );
    assert.equal(providerCalls, 0);
  });

  it("refuses root, foreign-folder, public/domain/group, and unsupported-role targets", () => {
    const base = {
      fileId: "folder-current",
      workspaceFolderId: "folder-current",
      rootFolderId: "root-old",
      type: "user",
      role: "writer",
    };
    assert.doesNotThrow(() => assertGrantTarget(base));
    for (const unsafe of [
      { ...base, fileId: "root-old", workspaceFolderId: "root-old" },
      { ...base, fileId: "folder-other" },
      { ...base, type: "anyone" },
      { ...base, type: "domain" },
      { ...base, type: "group" },
      { ...base, role: "owner" },
    ]) {
      assert.throws(() => assertGrantTarget(unsafe), DriveGrantError);
    }
  });

  it("creates only on the current generation, with a named-user body and explicit notification flag", async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    const fetchImpl: typeof fetch = async (input, init) => {
      const url = String(input);
      if (url.includes("oauth2.googleapis.com/token")) {
        return tokenRefreshResponse();
      }
      calls.push({ url, init });
      return jsonResponse({
        id: "permission-created",
        type: "user",
        role: "writer",
        emailAddress: "member.a@example.com",
      });
    };
    const fixture = await seededGrantFixture(fetchImpl);
    const result = await fixture.service.create(
      coreAuthorization("owner", "ws-a"),
      {
        memberUserId: "member-a",
        role: "writer",
        sendNotificationEmail: false,
      },
    );

    assert.equal(result.permissionId, "permission-created");
    assert.equal(result.grantedEmail, "member.a@example.com");
    assert.equal(calls.length, 1);
    assert.match(calls[0].url, /files\/folder-current\/permissions/);
    assert.doesNotMatch(calls[0].url, /folder-old|folder-other|root-old/);
    assert.equal(
      new URL(calls[0].url).searchParams.get("sendNotificationEmail"),
      "false",
    );
    assert.deepEqual(JSON.parse(String(calls[0].init?.body)), {
      type: "user",
      role: "writer",
      emailAddress: "member.a@example.com",
    });
    const [stored] = await fixture.db
      .select()
      .from(driveFolderGrants)
      .where(eq(driveFolderGrants.permissionId, "permission-created"));
    assert.equal(stored.storageGenerationId, "gen-current");
    assert.equal(stored.userId, "member-a");
    assert.equal(stored.revokePending, false);
  });

  it("requires a current workspace member and never turns a bearer guest into a Drive grant", async () => {
    let providerCalls = 0;
    const fixture = await seededGrantFixture(async () => {
      providerCalls += 1;
      return tokenRefreshResponse();
    });
    await assert.rejects(
      () =>
        fixture.service.create(coreAuthorization("owner", "ws-a"), {
          memberUserId: "outsider",
          role: "writer",
          sendNotificationEmail: false,
        }),
      (error: unknown) =>
        error instanceof DriveGrantError && error.code === "member-not-found",
    );
    assert.equal(providerCalls, 0);
  });

  it("serializes permission mutations for the same folder", async () => {
    let postCalls = 0;
    let activePosts = 0;
    let maximumActivePosts = 0;
    let releaseFirst!: () => void;
    let firstStarted!: () => void;
    const firstStartedPromise = new Promise<void>((resolve) => {
      firstStarted = resolve;
    });
    const firstGate = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });
    const fetchImpl: typeof fetch = async (input, init) => {
      const url = String(input);
      if (url.includes("oauth2.googleapis.com/token")) {
        return tokenRefreshResponse(`access-${Math.random()}`);
      }
      assert.equal(init?.method, "POST");
      postCalls += 1;
      activePosts += 1;
      maximumActivePosts = Math.max(maximumActivePosts, activePosts);
      if (postCalls === 1) {
        firstStarted();
        await firstGate;
      }
      const body = JSON.parse(String(init?.body)) as { emailAddress: string };
      activePosts -= 1;
      return jsonResponse({
        id: body.emailAddress.includes("member.a")
          ? "permission-a"
          : "permission-b",
        type: "user",
        role: "writer",
        emailAddress: body.emailAddress,
      });
    };
    const fixture = await seededGrantFixture(fetchImpl);
    const first = fixture.service.create(
      coreAuthorization("owner", "ws-a"),
      {
        memberUserId: "member-a",
        role: "writer",
        sendNotificationEmail: false,
      },
    );
    await firstStartedPromise;
    const second = fixture.service.create(
      coreAuthorization("owner", "ws-a"),
      {
        memberUserId: "member-b",
        role: "writer",
        sendNotificationEmail: true,
      },
    );
    await new Promise((resolve) => setTimeout(resolve, 20));
    assert.equal(postCalls, 1);
    releaseFirst();
    await Promise.all([first, second]);
    assert.equal(postCalls, 2);
    assert.equal(maximumActivePosts, 1);
  });

  it("shares the default same-folder queue across independent dispatcher calls", async () => {
    const session = {
      accessToken: "request-access",
      credential: {
        id: "conn-new",
        ownerUserId: "owner",
        providerAccountId: "account-owner",
        providerAccountEmail: "owner@example.com",
        rootFolderId: "root-new",
      },
      storageRootFolderId: "root-new",
      storage: {
        id: "gen-current",
        workspaceId: "ws-a",
        connectionId: "conn-new",
        folderId: "folder-current",
        folderWebViewLink: "https://drive.example/folder-current",
        state: "active",
        isCurrent: true,
      },
    } satisfies ProjectDriveStorageSession;
    const permissions: Array<Record<string, unknown>> = [];
    let listCalls = 0;
    let postCalls = 0;
    let releaseFirst!: () => void;
    let firstPostStarted!: () => void;
    const firstPostStartedPromise = new Promise<void>((resolve) => {
      firstPostStarted = resolve;
    });
    const firstGate = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });
    const fetchImpl: typeof fetch = async (_input, init) => {
      if (init?.method === "GET") {
        listCalls += 1;
        return jsonResponse({ permissions });
      }
      assert.equal(init?.method, "POST");
      postCalls += 1;
      if (postCalls === 1) {
        firstPostStarted();
        await firstGate;
      }
      const body = JSON.parse(String(init?.body)) as {
        emailAddress: string;
        role: string;
        type: string;
      };
      const permission = {
        id: `permission-${postCalls}`,
        type: body.type,
        role: body.role,
        emailAddress: body.emailAddress,
      };
      permissions.push(permission);
      return jsonResponse(permission);
    };
    const dispatch = (granteeEmail: string) =>
      recoverOrCreateExactDriveUserPermission(
        session,
        {
          granteeEmail,
          role: "writer",
          sendNotificationEmail: false,
          beforeCreate: async () => {},
        },
        fetchImpl,
      );

    const first = dispatch("member.a@example.com");
    await firstPostStartedPromise;
    const second = dispatch("member.b@example.com");
    await new Promise((resolve) => setTimeout(resolve, 20));
    assert.equal(listCalls, 1, "the second dispatcher must wait before discovery");
    assert.equal(postCalls, 1);
    releaseFirst();
    await Promise.all([first, second]);
    assert.equal(listCalls, 2);
    assert.equal(postCalls, 2);
  });

  it("deduplicates concurrent creates for the same member inside the folder queue", async () => {
    let postCalls = 0;
    let releaseFirst!: () => void;
    let firstStarted!: () => void;
    const firstStartedPromise = new Promise<void>((resolve) => {
      firstStarted = resolve;
    });
    const firstGate = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });
    const fetchImpl: typeof fetch = async (input, init) => {
      if (String(input).includes("oauth2.googleapis.com/token")) {
        return tokenRefreshResponse(`access-${Math.random()}`);
      }
      assert.equal(init?.method, "POST");
      postCalls += 1;
      firstStarted();
      await firstGate;
      return jsonResponse({
        id: "permission-once",
        type: "user",
        role: "writer",
        emailAddress: "member.a@example.com",
      });
    };
    const fixture = await seededGrantFixture(fetchImpl);
    const input = {
      memberUserId: "member-a",
      role: "writer" as const,
      sendNotificationEmail: false,
    };
    const first = fixture.service.create(
      coreAuthorization("owner", "ws-a"),
      input,
    );
    await firstStartedPromise;
    const second = fixture.service.create(
      coreAuthorization("owner", "ws-a"),
      input,
    );
    await new Promise((resolve) => setTimeout(resolve, 20));
    assert.equal(postCalls, 1);
    releaseFirst();
    const results = await Promise.all([first, second]);
    assert.equal(postCalls, 1);
    assert.deepEqual(
      results.map((result) => result.outcome).sort(),
      ["created", "existing"],
    );
  });

  it("treats provider 404 as idempotent revoke success and deletes the exact stored receipt", async () => {
    const seen: string[] = [];
    const fetchImpl: typeof fetch = async (input, init) => {
      const url = String(input);
      if (url.includes("oauth2.googleapis.com/token")) {
        return tokenRefreshResponse();
      }
      seen.push(url);
      assert.equal(init?.method, "DELETE");
      return jsonResponse({ error: { status: "NOT_FOUND" } }, 404);
    };
    const fixture = await seededGrantFixture(fetchImpl);
    await seedGrant(fixture.client);
    const result = await fixture.service.revoke(
      coreAuthorization("owner", "ws-a"),
      { storageGenerationId: "gen-current", memberUserId: "member-a" },
    );
    assert.deepEqual(result, { revoked: true, alreadyAbsent: true });
    assert.match(seen[0], /folder-current\/permissions\/permission-a/);
    assert.equal(
      Number(
        (
          await fixture.client.execute(
            "SELECT COUNT(*) AS value FROM drive_folder_grants",
          )
        ).rows[0].value,
      ),
      0,
    );
  });

  it("retains the exact receipt with revoke_pending on transient failure and leaks no provider prose", async () => {
    const fetchImpl: typeof fetch = async (input) => {
      if (String(input).includes("oauth2.googleapis.com/token")) {
        return tokenRefreshResponse();
      }
      return jsonResponse(
        {
          error: {
            message: "bearer request-access must never escape",
            errors: [{ reason: "backendError" }],
          },
        },
        503,
      );
    };
    const fixture = await seededGrantFixture(fetchImpl);
    await seedGrant(fixture.client);
    await assert.rejects(
      () =>
        fixture.service.revoke(coreAuthorization("owner", "ws-a"), {
          storageGenerationId: "gen-current",
          memberUserId: "member-a",
        }),
      (error: unknown) => {
        assert.ok(error instanceof DriveGrantError);
        assert.equal(error.retryable, true);
        assert.equal(error.reason, "backendError");
        assert.doesNotMatch(error.message, /bearer|request-access|backendError/);
        return true;
      },
    );
    const [grant] = await fixture.db
      .select()
      .from(driveFolderGrants)
      .where(
        and(
          eq(driveFolderGrants.storageGenerationId, "gen-current"),
          eq(driveFolderGrants.userId, "member-a"),
        ),
      );
    assert.equal(grant.permissionId, "permission-a");
    assert.equal(grant.revokePending, true);
  });

  it("marks the exact revoke receipt pending when token refresh fails", async () => {
    const fixture = await seededGrantFixture(async () =>
      jsonResponse(
        { error: "invalid_grant", error_description: "credential-secret" },
        400,
      ),
    );
    await seedGrant(fixture.client);
    await assert.rejects(() =>
      fixture.service.revoke(coreAuthorization("owner", "ws-a"), {
        storageGenerationId: "gen-current",
        memberUserId: "member-a",
      }),
    );
    const [grant] = await fixture.db
      .select()
      .from(driveFolderGrants)
      .where(
        and(
          eq(driveFolderGrants.storageGenerationId, "gen-current"),
          eq(driveFolderGrants.userId, "member-a"),
        ),
      );
    assert.equal(grant.permissionId, "permission-a");
    assert.equal(grant.revokePending, true);
  });

  it("lists every live permission and distinguishes Signal, owner, and external entries", async () => {
    const fetchImpl: typeof fetch = async (input, init) => {
      if (String(input).includes("oauth2.googleapis.com/token")) {
        return tokenRefreshResponse();
      }
      assert.equal(init?.method, "GET");
      return jsonResponse({
        permissions: [
          {
            id: "account-owner",
            type: "user",
            role: "owner",
            emailAddress: "owner@example.com",
          },
          {
            id: "permission-a",
            type: "user",
            role: "writer",
            emailAddress: "member.a@example.com",
          },
          {
            id: "external-domain",
            type: "domain",
            role: "reader",
            displayName: "External policy",
          },
        ],
      });
    };
    const fixture = await seededGrantFixture(fetchImpl);
    await seedGrant(fixture.client);
    const permissions = await fixture.service.listLive(
      coreAuthorization("owner", "ws-a"),
    );
    assert.deepEqual(
      permissions.map((permission) => [
        permission.permissionId,
        permission.source,
        permission.signalUserId,
      ]),
      [
        ["account-owner", "storage-owner", null],
        ["permission-a", "signal-grant", "member-a"],
        ["external-domain", "external", null],
      ],
    );
  });
});
