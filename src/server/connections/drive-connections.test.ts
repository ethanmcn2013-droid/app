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
import { assertProjectId } from "@/lib/projects/project-ref";
import {
  open,
  providerTokenAadContext,
  seal,
  type KeyRing,
} from "@/server/crypto/secret-box";
import {
  providerConnections,
  workspaceStorage,
} from "@/server/db/schema";
import * as schema from "@/server/db/schema";
import {
  createGoogleDriveConnectionService,
  googleDriveOAuthClientFromEnv,
  googleDriveReturnOriginFromEnv,
  type GoogleDriveConnectionServiceDependencies,
} from "./drive-connections";
import { GOOGLE_DRIVE_FILE_SCOPE } from "./google-drive-scopes";
import { parseGoogleOAuthStateCookie } from "./google-oauth-state";
import type { AuthorizedProjectDriveContext } from "./project-drive-authz";

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
async function freshConnectionDb() {
  const directory = mkdtempSync(join(tmpdir(), "signal-drive-connection-"));
  const databaseUrl = pathToFileURL(join(directory, "connection.test.db")).href;
  const client = createClient({ url: databaseUrl });
  await client.execute("PRAGMA foreign_keys = OFF");
  const drizzleDir = join(process.cwd(), "drizzle");
  const migrations = readdirSync(drizzleDir)
    .filter((file) => /^\d{4}_.+\.sql$/.test(file) && file >= "0014_")
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

function authorization(
  actorUserId: string,
  projectId: string,
): AuthorizedProjectDriveContext {
  return {
    actorUserId,
    projectId: assertProjectId(projectId),
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
});
