import assert from "node:assert/strict";
import {
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { describe, it } from "node:test";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { eq } from "drizzle-orm";
import {
  assertProjectId,
  type ProjectCapabilities,
  type ProjectRole,
} from "@/lib/projects/project-ref";
import {
  open,
  providerTokenAadContext,
  seal,
  type KeyRing,
} from "@/server/crypto/secret-box";
import {
  meta,
  providerConnections,
  workspaceStorage,
} from "@/server/db/schema";
import * as schema from "@/server/db/schema";
import {
  createGoogleDriveConnectionService,
  GoogleDriveConnectionError,
  googleDriveOAuthClientFromEnv,
  googleDriveReturnOriginFromEnv,
  type GoogleDriveConnectionServiceDependencies,
} from "./drive-connections";
import { googleDriveAccountErasureFenceKey } from "./project-drive-operation-lifecycle";
import { GOOGLE_DRIVE_FILE_SCOPE } from "./google-drive-scopes";
import { parseGoogleOAuthStateCookie } from "./google-oauth-state";
import {
  assertProjectDriveCapability,
  ProjectDriveAuthorizationError,
  type AuthorizedProjectDriveContext,
} from "./project-drive-authz";

const STATE_SECRET = "state-secret-material-with-at-least-32-bytes";
const OAUTH_CLIENT = Object.freeze({
  clientId: "drive-client-id",
  clientSecret: "drive-client-secret",
  redirectUri: "https://app.signalstudio.ie/api/connections/google/callback",
});
const RING: KeyRing = {
  currentVersion: 1,
  keys: new Map([[1, Buffer.alloc(32, 7)]]),
};

/** libSQL interactive transactions close an isolated `:memory:` connection. */
async function freshConnectionDb(through = "9999") {
  const directory = mkdtempSync(join(tmpdir(), "signal-drive-connection-"));
  const databaseUrl = pathToFileURL(join(directory, "connection.test.db")).href;
  const client = createClient({ url: databaseUrl });
  await client.execute("PRAGMA foreign_keys = OFF");
  const drizzleDir = join(process.cwd(), "drizzle");
  const migrations = readdirSync(drizzleDir)
    .filter((file) => /^\d{4}_.+\.sql$/.test(file) && file >= "0014_" && file.slice(0, 4) <= through)
    .sort();
  for (const migration of migrations) {
    await client.executeMultiple(readFileSync(join(drizzleDir, migration), "utf8"));
  }
  return {
    client,
    db: drizzle(client, { schema }),
    cleanup: () => {
      client.close();
      // libSQL's native Windows handle can briefly outlive close(). Temp space
      // is process-scoped, so a lingering handle must not fail a green test.
      try {
        rmSync(directory, { recursive: true, force: true });
      } catch {
        // The operating system owns process temp cleanup.
      }
    },
  };
}

const MANAGER_CAPABILITIES: ProjectCapabilities = Object.freeze({
  open: true,
  viewPrivateTimeline: true,
  createOrEditTasks: true,
  manageProject: true,
  moveIntoPlanningPeriod: true,
  curatePrimaryTimeline: true,
  publishTimeline: true,
  revokeTimeline: true,
  deleteOrTransferOwnership: true,
});

const TASK_EDITOR_CAPABILITIES: ProjectCapabilities = Object.freeze({
  open: true,
  viewPrivateTimeline: true,
  createOrEditTasks: true,
  manageProject: false,
  moveIntoPlanningPeriod: false,
  curatePrimaryTimeline: false,
  publishTimeline: false,
  revokeTimeline: false,
  deleteOrTransferOwnership: false,
});

function authorization(
  actorUserId: string,
  projectId: string,
  options: Readonly<{
    role?: ProjectRole;
    capabilities?: ProjectCapabilities;
    archived?: boolean;
  }> = {},
): AuthorizedProjectDriveContext {
  return {
    actorUserId,
    projectId: assertProjectId(projectId),
    role: options.role ?? "primary-owner",
    capabilities: options.capabilities ?? MANAGER_CAPABILITIES,
    archived: options.archived ?? false,
  } as unknown as AuthorizedProjectDriveContext;
}

function json(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

class FetchQueue {
  readonly calls: Array<{ url: string; init?: RequestInit }> = [];
  readonly responses: Response[] = [];

  push(...responses: Response[]): void {
    this.responses.push(...responses);
  }

  readonly fetch = async (
    input: string | URL | Request,
    init?: RequestInit,
  ): Promise<Response> => {
    this.calls.push({ url: String(input), init });
    const response = this.responses.shift();
    if (!response) throw new Error("unexpected fetch");
    return response;
  };
}

async function seedIdentity(
  client: import("@libsql/client").Client,
  suffix: string,
): Promise<void> {
  await client.executeMultiple(`
    INSERT INTO users (id, clerk_id, color, initials)
      VALUES ('u-${suffix}', 'clerk-${suffix}', '#111', 'AA');
    INSERT INTO workspaces (id, slug, name, owner_user_id)
      VALUES ('ws-${suffix}', 'ws-${suffix}', 'Project ${suffix}', 'u-${suffix}');
    INSERT INTO workspace_members (workspace_id, user_id, role)
      VALUES ('ws-${suffix}', 'u-${suffix}', 'owner');
  `);
}

function tokenResponse(refreshToken: string): Response {
  return json({
    access_token: `access-${refreshToken}`,
    refresh_token: refreshToken,
    expires_in: 3_600,
    token_type: "Bearer",
    scope: GOOGLE_DRIVE_FILE_SCOPE,
  });
}

function aboutResponse(permissionId: string, email: string): Response {
  return json({
    user: { permissionId, emailAddress: email },
    storageQuota: { limit: "1000", usage: "5" },
  });
}

function listResponse(ids: string[]): Response {
  return json({
    files: ids.map((id) => ({
      id,
      name: "Signal Studio",
      mimeType: "application/vnd.google-apps.folder",
      appProperties: { signalRoot: "v1" },
      trashed: false,
    })),
  });
}

function createRootResponse(id: string): Response {
  return json({
    id,
    name: "Signal Studio",
    mimeType: "application/vnd.google-apps.folder",
    appProperties: { signalRoot: "v1" },
    trashed: false,
  });
}

function dependencies(
  database: GoogleDriveConnectionServiceDependencies["database"],
  queue: FetchQueue,
  ids: string[],
): GoogleDriveConnectionServiceDependencies {
  let minute = 0;
  return {
    database,
    fetchImpl: queue.fetch,
    now: () => new Date(Date.UTC(2026, 8, 2, 12, minute++, 0)),
    randomConnectionId: () => ids.shift() ?? "unexpected-id",
    oauthClient: OAUTH_CLIENT,
    stateSecret: STATE_SECRET,
    keyRing: RING,
  };
}

async function seedConnectedAccount(
  client: import("@libsql/client").Client,
  db: GoogleDriveConnectionServiceDependencies["database"],
  suffix: string,
) {
  await seedIdentity(client, suffix);
  const id = `connection-${suffix}`;
  await db.insert(providerConnections).values({
    id,
    userId: `u-${suffix}`,
    provider: "google_drive",
    providerAccountId: `permission-${suffix}`,
    providerAccountEmail: `${suffix}@example.test`,
    rootFolderId: `root-${suffix}`,
    refreshTokenCipher: seal(`refresh-${suffix}`, providerTokenAadContext(id), RING),
    keyVersion: 1,
    scopes: [GOOGLE_DRIVE_FILE_SCOPE],
    status: "active",
    isCurrent: true,
    connectedAt: new Date("2026-09-01T12:00:00Z"),
  });
  await db.insert(workspaceStorage).values({
    id: `storage-${suffix}`,
    workspaceId: `ws-${suffix}`,
    connectionId: id,
    folderId: `folder-${suffix}`,
    folderWebViewLink: `https://drive.google.com/drive/folders/folder-${suffix}`,
    state: "active",
    isCurrent: true,
  });
}

describe("Project Drive connection · capability boundary", () => {
  it("keeps task editing available without admitting it to management", async () => {
    const taskEditor = authorization("u-member", "ws-a", {
      role: "member",
      capabilities: TASK_EDITOR_CAPABILITIES,
    });

    assert.doesNotThrow(() =>
      assertProjectDriveCapability(taskEditor, "createOrEditTasks"),
    );
    assert.throws(
      () => assertProjectDriveCapability(taskEditor, "manageProject"),
      ProjectDriveAuthorizationError,
    );

    let dependencyTouched = false;
    const trappedDatabase = new Proxy(
      {},
      {
        get() {
          dependencyTouched = true;
          throw new Error("authorization must run before a dependency");
        },
      },
    ) as GoogleDriveConnectionServiceDependencies["database"];
    const service = createGoogleDriveConnectionService({
      database: trappedDatabase,
      fetchImpl: async () => {
        dependencyTouched = true;
        throw new Error("authorization must run before a dependency");
      },
      now: () => {
        dependencyTouched = true;
        throw new Error("authorization must run before a dependency");
      },
      randomConnectionId: () => {
        dependencyTouched = true;
        throw new Error("authorization must run before a dependency");
      },
      oauthClient: OAUTH_CLIENT,
      stateSecret: STATE_SECRET,
      keyRing: RING,
    });

    await assert.rejects(
      service.begin(taskEditor, {
        clerkUserId: "clerk-member",
        sessionId: "session-member",
      }),
      ProjectDriveAuthorizationError,
    );
    assert.equal(dependencyTouched, false);
  });

  it("refuses incomplete and merely truthy capability claims", () => {
    const missingCapabilities = {
      actorUserId: "u-member",
      projectId: assertProjectId("ws-a"),
      role: "member",
      capabilities: undefined,
      archived: false,
    } as unknown as AuthorizedProjectDriveContext;
    assert.throws(
      () =>
        assertProjectDriveCapability(
          missingCapabilities,
          "createOrEditTasks",
        ),
      ProjectDriveAuthorizationError,
    );

    const truthyManage = authorization("u-member", "ws-a", {
      role: "member",
      capabilities: {
        ...TASK_EDITOR_CAPABILITIES,
        manageProject: 1 as unknown as boolean,
      },
    });
    assert.throws(
      () => assertProjectDriveCapability(truthyManage, "manageProject"),
      ProjectDriveAuthorizationError,
    );
  });
});

describe("Project Drive connection · OAuth start", () => {
  it("binds the exact Project/session and derives connect versus reconnect", async () => {
    const { client, db, cleanup } = await freshConnectionDb();
    try {
      await seedIdentity(client, "a");
      const queue = new FetchQueue();
      const service = createGoogleDriveConnectionService(
        dependencies(db, queue, ["one"]),
      );
      const context = authorization("u-a", "ws-a");

      const first = await service.begin(context, {
        clerkUserId: "user_clerk-a",
        sessionId: "sess_clerk-a",
      });
      const firstUrl = new URL(first.authorizationUrl);
      assert.equal(first.intent, "connect-google-drive");
      assert.equal(firstUrl.searchParams.get("scope"), GOOGLE_DRIVE_FILE_SCOPE);
      assert.equal(firstUrl.searchParams.has("include_granted_scopes"), false);
      assert.equal(firstUrl.searchParams.get("prompt"), "consent select_account");
      assert.equal(firstUrl.searchParams.get("redirect_uri"), OAUTH_CLIENT.redirectUri);
      assert.deepEqual(parseGoogleOAuthStateCookie(first.stateCookie), {
        nonce: parseGoogleOAuthStateCookie(first.stateCookie)?.nonce,
        projectId: "ws-a",
        intent: "connect-google-drive",
      });

      await db.insert(providerConnections).values({
        id: "connection-existing",
        userId: "u-a",
        provider: "google_drive",
        providerAccountId: "permission-a",
        providerAccountEmail: "a@example.test",
        rootFolderId: "root-a",
        refreshTokenCipher: seal(
          "refresh-existing",
          providerTokenAadContext("connection-existing"),
          RING,
        ),
        keyVersion: 1,
        scopes: [GOOGLE_DRIVE_FILE_SCOPE],
        status: "active",
        isCurrent: true,
        connectedAt: new Date("2026-09-01T12:00:00Z"),
      });
      const again = await service.begin(context, {
        clerkUserId: "user_clerk-a",
        sessionId: "sess_clerk-a",
      });
      assert.equal(again.intent, "reconnect-google-drive");
      assert.equal(
        new URL(again.authorizationUrl).searchParams.get("login_hint"),
        "a@example.test",
      );
    } finally {
      cleanup();
    }
  });

  it("requires the exact registered callback URI for this deployment", () => {
    const config = googleDriveOAuthClientFromEnv(
      {
        GOOGLE_OAUTH_CLIENT_ID: "id",
        GOOGLE_OAUTH_CLIENT_SECRET: "secret",
        GOOGLE_OAUTH_REDIRECT_URI:
          "https://preview.example.test/api/connections/google/callback",
      },
    );
    assert.equal(
      config.redirectUri,
      "https://preview.example.test/api/connections/google/callback",
    );
    assert.throws(
      () => googleDriveOAuthClientFromEnv({}),
      /GOOGLE_OAUTH_CLIENT_ID/,
    );
    assert.throws(
      () =>
        googleDriveOAuthClientFromEnv({
          GOOGLE_OAUTH_CLIENT_ID: "id",
          GOOGLE_OAUTH_CLIENT_SECRET: "secret",
          GOOGLE_OAUTH_REDIRECT_URI: "https://preview.example.test/wrong",
        }),
      /GOOGLE_OAUTH_REDIRECT_URI/,
    );
    assert.throws(
      () =>
        googleDriveOAuthClientFromEnv({
          GOOGLE_OAUTH_CLIENT_ID: "id",
          GOOGLE_OAUTH_CLIENT_SECRET: "secret",
          GOOGLE_OAUTH_REDIRECT_URI:
            "http://preview.example.test/api/connections/google/callback",
        }),
      /GOOGLE_OAUTH_REDIRECT_URI/,
    );
    const previewEnv = {
      GOOGLE_OAUTH_REDIRECT_URI:
        "https://preview.example.test/api/connections/google/callback",
    };
    assert.equal(
      googleDriveReturnOriginFromEnv(
        "https://preview.example.test",
        previewEnv,
      ),
      "https://preview.example.test",
    );
    assert.equal(
      googleDriveReturnOriginFromEnv(
        "https://attacker.example.test",
        previewEnv,
      ),
      "https://preview.example.test",
      "an alternate Host-derived origin must not become a redirect target",
    );
  });
});

describe("Project Drive connection · immutable rotation", () => {
  it("retires a same-account generation without revoking the shared Google grant", async () => {
    const { client, db, cleanup } = await freshConnectionDb();
    try {
      await seedIdentity(client, "a");
      const queue = new FetchQueue();
      const service = createGoogleDriveConnectionService(
        dependencies(db, queue, ["a1", "a2"]),
      );
      const context = authorization("u-a", "ws-a");

      queue.push(
        tokenResponse("refresh-a1"),
        aboutResponse("permission-a", "a@example.test"),
        listResponse([]),
        createRootResponse("root-a"),
      );
      await service.complete(context, {
        code: "code-a1",
        intent: "connect-google-drive",
      });

      queue.push(
        tokenResponse("refresh-a2"),
        aboutResponse("permission-a", "a@example.test"),
        listResponse(["root-a"]),
      );
      const rotated = await service.complete(context, {
        code: "code-a2",
        intent: "reconnect-google-drive",
      });

      assert.equal(rotated.accountChanged, false);
      assert.equal(rotated.retiredCredentialRevoked, false);
      assert.equal(
        queue.calls.filter((call) =>
          call.url.includes("oauth2.googleapis.com/revoke"),
        ).length,
        0,
      );
      const rows = await db.select().from(providerConnections);
      assert.equal(rows.length, 2);
      assert.equal(
        rows.find((row) => row.id === "connection-a1")?.isCurrent,
        false,
      );
      assert.equal(
        rows.find((row) => row.id === "connection-a2")?.status,
        "active",
      );
    } finally {
      cleanup();
    }
  });

  it("preserves A → B → A generations, reuses only the matching account root", async () => {
    const { client, db, cleanup } = await freshConnectionDb();
    try {
      await seedIdentity(client, "a");
      const queue = new FetchQueue();
      const service = createGoogleDriveConnectionService(
        dependencies(db, queue, ["a1", "b1", "a2"]),
      );
      const context = authorization("u-a", "ws-a");

      queue.push(
        tokenResponse("refresh-a1"),
        aboutResponse("permission-a", "a@example.test"),
        listResponse([]),
        createRootResponse("root-a"),
      );
      const first = await service.complete(context, {
        code: "code-a1",
        intent: "connect-google-drive",
      });
      assert.equal(first.connectionId, "connection-a1");
      assert.equal(first.reusedRootFolder, false);

      await db.insert(workspaceStorage).values({
        id: "storage-a",
        workspaceId: "ws-a",
        connectionId: first.connectionId,
        folderId: "board-folder-a",
        folderWebViewLink: "https://drive.google.com/drive/folders/board-folder-a",
        state: "active",
        isCurrent: true,
      });

      queue.push(
        tokenResponse("refresh-b1"),
        aboutResponse("permission-b", "b@example.test"),
        listResponse([]),
        createRootResponse("root-b"),
        new Response(null, { status: 200 }),
      );
      const second = await service.complete(context, {
        code: "code-b1",
        intent: "reconnect-google-drive",
      });
      assert.equal(second.accountChanged, true);
      assert.equal(second.reusedRootFolder, false);

      const [storageAfterB] = await db.select().from(workspaceStorage);
      assert.equal(storageAfterB?.state, "needs_reauth");
      assert.equal(
        storageAfterB?.connectionId,
        "connection-a1",
        "historical storage provenance must not be rewritten",
      );

      queue.push(
        tokenResponse("refresh-a2"),
        aboutResponse("permission-a", "a@example.test"),
        listResponse(["root-a"]),
        new Response(null, { status: 200 }),
      );
      const third = await service.complete(context, {
        code: "code-a2",
        intent: "reconnect-google-drive",
      });
      assert.equal(third.accountChanged, true);
      assert.equal(third.reusedRootFolder, true);

      const rows = await db
        .select()
        .from(providerConnections)
        .orderBy(providerConnections.connectedAt);
      assert.deepEqual(
        rows.map((row) => ({
          id: row.id,
          account: row.providerAccountId,
          root: row.rootFolderId,
          current: row.isCurrent,
          status: row.status,
        })),
        [
          {
            id: "connection-a1",
            account: "permission-a",
            root: "root-a",
            current: false,
            status: "revoked",
          },
          {
            id: "connection-b1",
            account: "permission-b",
            root: "root-b",
            current: false,
            status: "revoked",
          },
          {
            id: "connection-a2",
            account: "permission-a",
            root: "root-a",
            current: true,
            status: "active",
          },
        ],
      );
      assert.equal(
        open(
          rows[2]!.refreshTokenCipher,
          providerTokenAadContext(rows[2]!.id),
          RING,
        ),
        "refresh-a2",
      );
      assert.equal(rows[2]!.refreshTokenCipher.includes("refresh-a2"), false);

      const revocations = queue.calls.filter((call) =>
        call.url.includes("oauth2.googleapis.com/revoke"),
      );
      assert.equal(revocations.length, 2);
      for (const call of revocations) {
        assert.equal(new URL(call.url).searchParams.has("token"), false);
        assert.match(String(call.init?.body), /token=refresh-/);
      }

      const summary = await service.summary(context);
      assert.equal(summary.accountEmail, "a@example.test");
      assert.equal(summary.projectUsesThisAccount, true);
      assert.equal(summary.affectedProjectCount, 1);
    } finally {
      cleanup();
    }
  });
});

describe("Project Drive connection · ownership and disconnect", () => {
  it("never reads or retires another person's connection", async () => {
    const { client, db, cleanup } = await freshConnectionDb();
    try {
      await seedIdentity(client, "a");
      await seedIdentity(client, "b");
      for (const suffix of ["a", "b"] as const) {
        const id = `connection-${suffix}`;
        await db.insert(providerConnections).values({
          id,
          userId: `u-${suffix}`,
          provider: "google_drive",
          providerAccountId: `permission-${suffix}`,
          providerAccountEmail: `${suffix}@example.test`,
          rootFolderId: `root-${suffix}`,
          refreshTokenCipher: seal(
            `refresh-${suffix}`,
            providerTokenAadContext(id),
            RING,
          ),
          keyVersion: 1,
          scopes: [GOOGLE_DRIVE_FILE_SCOPE],
          status: "active",
          isCurrent: true,
          connectedAt: new Date(`2026-09-0${suffix === "a" ? 1 : 2}T12:00:00Z`),
        });
        await db.insert(workspaceStorage).values({
          id: `storage-${suffix}`,
          workspaceId: `ws-${suffix}`,
          connectionId: id,
          folderId: `folder-${suffix}`,
          folderWebViewLink: `https://drive.google.com/drive/folders/folder-${suffix}`,
          state: "active",
          isCurrent: true,
        });
      }

      const queue = new FetchQueue();
      queue.push(new Response(null, { status: 200 }));
      const service = createGoogleDriveConnectionService(
        dependencies(db, queue, []),
      );
      const contextA = authorization("u-a", "ws-a");
      const before = await service.summary(contextA);
      assert.equal(before.accountEmail, "a@example.test");
      assert.equal(JSON.stringify(before).includes("b@example.test"), false);

      const result = await service.disconnect(contextA);
      assert.deepEqual(result, {
        disconnected: true,
        affectedProjectCount: 1,
        revocationConfirmed: true,
      });
      const connections = await db.select().from(providerConnections);
      assert.equal(
        connections.find((row) => row.id === "connection-a")?.isCurrent,
        false,
      );
      assert.equal(
        connections.find((row) => row.id === "connection-b")?.isCurrent,
        true,
      );
      const storage = await db.select().from(workspaceStorage);
      assert.equal(storage.find((row) => row.id === "storage-a")?.state, "needs_reauth");
      assert.equal(storage.find((row) => row.id === "storage-b")?.state, "active");

      const revoke = queue.calls[0]!;
      assert.equal(new URL(revoke.url).searchParams.has("token"), false);
      assert.equal(String(revoke.init?.body), "token=refresh-a");
    } finally {
      cleanup();
    }
  });

  it("persists an uncertain revoke across reload, fences reconnection, and retries the same generation", async () => {
    const { client, db, cleanup } = await freshConnectionDb();
    try {
      await seedConnectedAccount(client, db, "a");
      await seedConnectedAccount(client, db, "b");
      const queue = new FetchQueue();
      let clock = Date.parse("2026-09-23T12:00:00Z");
      const deps = {
        ...dependencies(db, queue, []),
        now: () => new Date(clock),
      };
      const service = createGoogleDriveConnectionService(deps);
      const actor = authorization("u-a", "ws-a");
      queue.push(json({ error: "temporarily_unavailable" }, 503));
      assert.deepEqual(await service.disconnect(actor), {
        disconnected: true,
        affectedProjectCount: 1,
        revocationConfirmed: false,
      });
      const [requested] = await db.select().from(providerConnections)
        .where(eq(providerConnections.id, "connection-a"));
      assert.equal(requested?.isCurrent, false);
      assert.equal(requested?.revokeRequestedAt?.getTime(), clock);
      assert.equal(requested?.revokeConfirmedAt, null);
      assert.equal(requested?.revokeAttemptId, null);
      assert.equal((await db.select().from(workspaceStorage)
        .where(eq(workspaceStorage.id, "storage-a")))[0]?.state, "needs_reauth");

      const restarted = createGoogleDriveConnectionService(deps);
      assert.equal((await restarted.summary(actor)).revocationPending, true);
      await assert.rejects(
        restarted.begin(actor, { clerkUserId: "clerk-a", sessionId: "session-a" }),
        (error: unknown) => error instanceof GoogleDriveConnectionError && error.code === "revocation-pending",
      );
      await assert.rejects(
        restarted.complete(actor, { code: "fresh-code", intent: "connect-google-drive" }),
        (error: unknown) => error instanceof GoogleDriveConnectionError && error.code === "revocation-pending",
      );
      assert.deepEqual(await restarted.disconnect(actor), {
        disconnected: true,
        affectedProjectCount: 0,
        revocationConfirmed: false,
      });
      assert.equal(queue.calls.length, 1, "an immediate retry cannot race the first provider attempt");

      clock += 61_000;
      queue.push(json({ error: "invalid_token" }, 400));
      assert.deepEqual(await restarted.disconnect(actor), {
        disconnected: true,
        affectedProjectCount: 0,
        revocationConfirmed: true,
      });
      const [confirmed] = await db.select().from(providerConnections)
        .where(eq(providerConnections.id, "connection-a"));
      assert.equal(confirmed?.revokeConfirmedAt?.getTime(), clock);
      assert.equal(confirmed?.revokeRequestedAt?.getTime(), requested?.revokeRequestedAt?.getTime());
      assert.equal((await restarted.summary(actor)).revocationPending, false);
      assert.deepEqual(await restarted.disconnect(actor), {
        disconnected: false,
        affectedProjectCount: 0,
        revocationConfirmed: false,
      }, "no-current alone must not claim Google confirmation");
      assert.equal(queue.calls.length, 2);
      assert.equal(String(queue.calls[1]?.init?.body), "token=refresh-a");
      assert.equal((await restarted.summary(authorization("u-b", "ws-b"))).accountEmail, "b@example.test");
    } finally {
      cleanup();
    }
  });

  it("refuses an actor's erasure fence before disconnect or OAuth work", async () => {
    const { client, db, cleanup } = await freshConnectionDb();
    try {
      await seedConnectedAccount(client, db, "a");
      const queue = new FetchQueue();
      const service = createGoogleDriveConnectionService(dependencies(db, queue, []));
      const actor = authorization("u-a", "ws-a");
      await db.insert(meta).values({
        key: googleDriveAccountErasureFenceKey("u-a"),
        value: "active:v1",
      });
      for (const operation of [
        () => service.disconnect(actor),
        () => service.begin(actor, { clerkUserId: "clerk-a", sessionId: "session-a" }),
        () => service.complete(actor, { code: "code-a", intent: "reconnect-google-drive" }),
      ]) {
        await assert.rejects(operation(), (error: unknown) =>
          error instanceof GoogleDriveConnectionError && error.code === "stale-authorization");
      }
      assert.equal(queue.calls.length, 0);
      assert.equal((await db.select().from(providerConnections)
        .where(eq(providerConnections.id, "connection-a")))[0]?.isCurrent, true);
    } finally {
      cleanup();
    }
  });

  it("recovers a persisted in-flight attempt after a process interruption", async () => {
    const { client, db, cleanup } = await freshConnectionDb();
    try {
      await seedConnectedAccount(client, db, "a");
      const requestedAt = new Date("2026-09-23T11:00:00Z");
      await db.update(providerConnections).set({
        status: "revoked", isCurrent: false,
        revokeRequestedAt: requestedAt,
        revokeAttemptId: "lost-process-attempt",
        revokeAttemptedAt: requestedAt,
      }).where(eq(providerConnections.id, "connection-a"));
      const queue = new FetchQueue();
      queue.push(new Response(null, { status: 200 }));
      const service = createGoogleDriveConnectionService({
        ...dependencies(db, queue, []),
        now: () => new Date("2026-09-23T11:02:00Z"),
      });
      const result = await service.disconnect(authorization("u-a", "ws-a"));
      assert.equal(result.revocationConfirmed, true);
      assert.equal(queue.calls.length, 1);
      assert.equal(String(queue.calls[0]?.init?.body), "token=refresh-a");
      const [row] = await db.select().from(providerConnections)
        .where(eq(providerConnections.id, "connection-a"));
      assert.equal(row?.revokeRequestedAt?.getTime(), requestedAt.getTime());
      assert.equal(row?.revokeConfirmedAt?.toISOString(), "2026-09-23T11:02:00.000Z");
      assert.equal(row?.revokeAttemptId, null);
    } finally {
      cleanup();
    }
  });

  it("missing token key retains a retryable request without touching Google", async () => {
    const { client, db, cleanup } = await freshConnectionDb();
    try {
      await seedConnectedAccount(client, db, "a");
      const queue = new FetchQueue();
      const noKey = createGoogleDriveConnectionService({
        ...dependencies(db, queue, []), keyRing: undefined,
      });
      const actor = authorization("u-a", "ws-a");
      assert.equal((await noKey.disconnect(actor)).revocationConfirmed, false);
      assert.equal(queue.calls.length, 0);
      assert.equal((await noKey.summary(actor)).revocationPending, true);
      const withKey = createGoogleDriveConnectionService(dependencies(db, queue, []));
      queue.push(new Response(null, { status: 200 }));
      assert.equal((await withKey.disconnect(actor)).revocationConfirmed, true);
      assert.equal(queue.calls.length, 1);
    } finally {
      cleanup();
    }
  });

  it("0038 preserves legacy retired ciphertext but does not forge revocation confirmation", async () => {
    const { client, cleanup } = await freshConnectionDb("0036");
    try {
      await seedIdentity(client, "a");
      await client.execute({
        sql: "INSERT INTO provider_connections (id, user_id, provider, provider_account_id, provider_account_email, root_folder_id, refresh_token_cipher, key_version, scopes, status, is_current, connected_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        args: ["connection-a", "u-a", "google_drive", "permission-a", "a@example.test", "root-a", seal("refresh-a", providerTokenAadContext("connection-a"), RING), 1, JSON.stringify([GOOGLE_DRIVE_FILE_SCOPE]), "active", 1, 1788264000],
      });
      await client.execute("INSERT INTO workspace_storage (id, workspace_id, connection_id, folder_id, folder_web_view_link, state, is_current) VALUES ('storage-a', 'ws-a', 'connection-a', 'folder-a', 'https://drive.google.com/drive/folders/folder-a', 'needs_reauth', 1)");
      await client.execute("UPDATE provider_connections SET status='revoked', is_current=0 WHERE id='connection-a'");
      const before = await client.execute("SELECT refresh_token_cipher, status, is_current, last_error_at FROM provider_connections WHERE id='connection-a'");
      const storageBefore = await client.execute("SELECT * FROM workspace_storage WHERE id='storage-a'");
      await client.executeMultiple(readFileSync(join(process.cwd(), "drizzle/0038_project_drive_token_revocation.sql"), "utf8"));
      const after = await client.execute("SELECT refresh_token_cipher, status, is_current, last_error_at, revoke_requested_at, revoke_confirmed_at, revoke_attempt_id, revoke_attempted_at FROM provider_connections WHERE id='connection-a'");
      const storageAfter = await client.execute("SELECT * FROM workspace_storage WHERE id='storage-a'");
      assert.deepEqual(storageAfter.rows, storageBefore.rows);
      assert.equal(after.rows.length, 1);
      for (const field of ["refresh_token_cipher", "status", "is_current", "last_error_at"] as const) {
        assert.equal(after.rows[0]?.[field], before.rows[0]?.[field]);
      }
      for (const field of ["revoke_requested_at", "revoke_confirmed_at", "revoke_attempt_id", "revoke_attempted_at"] as const) {
        assert.equal(after.rows[0]?.[field], null, `${field} is not historical provider proof`);
      }
      assert.equal((await client.execute("PRAGMA foreign_key_check")).rows.length, 0);
      const receipt = JSON.parse(readFileSync(join(process.cwd(), "drizzle/receipts/project-drive-token-revocation-2026-09-23.json"), "utf8")) as {
        migrations: Array<{ proofs: Array<{ id: string; sql: string; expected: number | string }> }>;
      };
      for (const proof of receipt.migrations[0]!.proofs) {
        const result = await client.execute(proof.sql);
        assert.equal(result.rows[0]?.value, proof.expected, proof.id);
      }
    } finally {
      cleanup();
    }
  });

  it("never revokes an older same-account token while a newer generation is current", async () => {
    const { client, db, cleanup } = await freshConnectionDb();
    try {
      await seedConnectedAccount(client, db, "a");
      await db.update(providerConnections).set({
        isCurrent: false, status: "revoked",
        revokeRequestedAt: new Date("2026-09-23T11:00:00Z"),
      }).where(eq(providerConnections.id, "connection-a"));
      await db.insert(providerConnections).values({
        id: "connection-a-new", userId: "u-a", provider: "google_drive",
        providerAccountId: "permission-a", providerAccountEmail: "a@example.test",
        rootFolderId: "root-a", refreshTokenCipher: seal("refresh-a-new", providerTokenAadContext("connection-a-new"), RING),
        keyVersion: 1, scopes: [GOOGLE_DRIVE_FILE_SCOPE], status: "active",
        isCurrent: true, connectedAt: new Date("2026-09-23T11:01:00Z"),
      });
      const queue = new FetchQueue();
      const service = createGoogleDriveConnectionService(dependencies(db, queue, []));
      const actor = authorization("u-a", "ws-a");
      await assert.rejects(service.disconnect(actor), (error: unknown) =>
        error instanceof GoogleDriveConnectionError && error.code === "revocation-pending");
      await assert.rejects(service.begin(actor, { clerkUserId: "clerk-a", sessionId: "session-a" }), (error: unknown) =>
        error instanceof GoogleDriveConnectionError && error.code === "revocation-pending");
      assert.equal(queue.calls.length, 0);
      assert.equal((await db.select().from(providerConnections)
        .where(eq(providerConnections.id, "connection-a-new")))[0]?.isCurrent, true);
    } finally {
      cleanup();
    }
  });

  it("an OAuth callback already exchanging a grant cannot commit after disconnect requests revocation", async () => {
    const { client, db, cleanup } = await freshConnectionDb();
    try {
      await seedConnectedAccount(client, db, "a");
      let releaseGrant!: () => void;
      let notifyExchange!: () => void;
      const grantHeld = new Promise<void>((resolve) => { releaseGrant = resolve; });
      const exchanging = new Promise<void>((resolve) => { notifyExchange = resolve; });
      const calls: string[] = [];
      const fetchImpl = async (input: string | URL | Request): Promise<Response> => {
        const url = String(input);
        calls.push(url);
        if (url.includes("/token")) {
          notifyExchange();
          await grantHeld;
          return tokenResponse("refresh-a-new");
        }
        if (url.includes("/revoke")) return json({ error: "temporarily_unavailable" }, 503);
        if (url.includes("/about")) return aboutResponse("permission-a", "a@example.test");
        if (url.includes("/files")) return listResponse(["root-a"]);
        throw new Error("unexpected test provider endpoint");
      };
      const service = createGoogleDriveConnectionService({
        ...dependencies(db, new FetchQueue(), ["a-new"]), fetchImpl,
      });
      const actor = authorization("u-a", "ws-a");
      const completing = service.complete(actor, { code: "code-a-new", intent: "reconnect-google-drive" });
      await exchanging;
      assert.equal((await service.disconnect(actor)).revocationConfirmed, false);
      releaseGrant();
      await assert.rejects(completing, (error: unknown) =>
        error instanceof GoogleDriveConnectionError && error.code === "revocation-pending");
      const rows = await db.select().from(providerConnections);
      assert.equal(rows.length, 1, "the late callback did not create a fresh generation");
      assert.equal(rows[0]?.isCurrent, false);
      assert.equal(rows[0]?.revokeConfirmedAt, null);
      assert.equal(calls.filter((url) => url.includes("/revoke")).length, 1,
        "the unreachable same-account grant is not revoked a second time");
    } finally {
      cleanup();
    }
  });
});
