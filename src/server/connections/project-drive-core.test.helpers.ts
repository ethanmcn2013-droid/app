import {
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import type { LibSQLDatabase } from "drizzle-orm/libsql";
import { assertProjectId } from "@/lib/projects/project-ref";
import {
  providerTokenAadContext,
  seal,
  type KeyRing,
} from "@/server/crypto/secret-box";
import * as schema from "@/server/db/schema";
import type { AuthorizedProjectDriveContext } from "./project-drive-authz";

export const CORE_TEST_RING: KeyRing = {
  currentVersion: 1,
  keys: new Map([[1, Buffer.alloc(32, 19)]]),
};

export const CORE_TEST_OAUTH = Object.freeze({
  clientId: "core-client-id",
  clientSecret: "core-client-secret",
});

export function coreAuthorization(
  actorUserId: string,
  projectId: string,
): AuthorizedProjectDriveContext {
  return {
    actorUserId,
    projectId: assertProjectId(projectId),
  } as unknown as AuthorizedProjectDriveContext;
}

export function tokenCipher(connectionId: string, refreshToken: string): string {
  return seal(
    refreshToken,
    providerTokenAadContext(connectionId),
    CORE_TEST_RING,
  );
}

export function jsonResponse(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export function tokenRefreshResponse(accessToken = "request-access"): Response {
  return jsonResponse({
    access_token: accessToken,
    expires_in: 3_600,
    token_type: "Bearer",
  });
}

export async function freshProjectDriveCoreDb() {
  const directory = mkdtempSync(join(tmpdir(), "signal-drive-core-"));
  const databaseUrl = pathToFileURL(join(directory, "core.test.db")).href;
  const client = createClient({ url: databaseUrl });
  await client.execute("PRAGMA foreign_keys = OFF");
  const drizzleDir = join(process.cwd(), "drizzle");
  for (const migration of readdirSync(drizzleDir)
    .filter((file) => /^\d{4}_.+\.sql$/.test(file) && file >= "0014_")
    .sort()) {
    await client.executeMultiple(
      readFileSync(join(drizzleDir, migration), "utf8"),
    );
  }
  return {
    client,
    db: drizzle(client, { schema }),
    cleanup: () => {
      client.close();
      try {
        rmSync(directory, { recursive: true, force: true });
      } catch {
        // Windows may briefly retain the native libSQL handle.
      }
    },
  };
}

export async function seedProjectDriveCore(
  client: import("@libsql/client").Client,
): Promise<void> {
  const oldCipher = tokenCipher("conn-old", "refresh-old");
  const newCipher = tokenCipher("conn-new", "refresh-new");
  const otherCipher = tokenCipher("conn-other", "refresh-other");
  await client.executeMultiple(`
    INSERT INTO users (id, clerk_id, email, color, initials) VALUES
      ('owner', 'clerk-owner', 'owner@example.com', '#111', 'OW'),
      ('member-a', 'clerk-member-a', 'Member.A@Example.com', '#222', 'MA'),
      ('member-b', 'clerk-member-b', 'member.b@example.com', '#333', 'MB'),
      ('outsider', 'clerk-outsider', 'outside@example.com', '#444', 'OU');
    INSERT INTO workspaces (id, slug, name, owner_user_id) VALUES
      ('ws-a', 'ws-a', 'Project A', 'owner'),
      ('ws-b', 'ws-b', 'Project B', 'outsider');
    INSERT INTO workspace_members (workspace_id, user_id, role) VALUES
      ('ws-a', 'owner', 'owner'),
      ('ws-a', 'member-a', 'member'),
      ('ws-a', 'member-b', 'member'),
      ('ws-b', 'outsider', 'owner');
    INSERT INTO provider_connections (
      id, user_id, provider, provider_account_id, provider_account_email,
      root_folder_id, refresh_token_cipher, key_version, scopes, status,
      is_current, connected_at
    ) VALUES
      ('conn-old', 'owner', 'google_drive', 'account-owner',
       'owner@example.com', 'root-old', '${oldCipher}', 1,
       '["https://www.googleapis.com/auth/drive.file"]', 'active', 0, 10),
      ('conn-new', 'owner', 'google_drive', 'account-owner',
       'owner@example.com', 'root-new', '${newCipher}', 1,
       '["https://www.googleapis.com/auth/drive.file"]', 'active', 1, 20),
      ('conn-other', 'outsider', 'google_drive', 'account-other',
       'outside@example.com', 'root-other', '${otherCipher}', 1,
       '["https://www.googleapis.com/auth/drive.file"]', 'active', 1, 20);
  `);
}

export async function seedStorageGenerations(
  client: import("@libsql/client").Client,
): Promise<void> {
  await client.executeMultiple(`
    INSERT INTO workspace_storage (
      id, workspace_id, connection_id, folder_id, folder_web_view_link,
      state, is_current
    ) VALUES
      ('gen-old', 'ws-a', 'conn-old', 'folder-old',
       'https://drive.example/folder-old', 'active', 0),
      ('gen-current', 'ws-a', 'conn-old', 'folder-current',
       'https://drive.example/folder-current', 'active', 1),
      ('gen-other', 'ws-b', 'conn-other', 'folder-other',
       'https://drive.example/folder-other', 'active', 1);
  `);
}

export function accessDependencies(
  database: LibSQLDatabase<typeof schema>,
  fetchImpl: typeof fetch,
  now = () => new Date("2026-09-02T22:00:00.000Z"),
) {
  return {
    database,
    fetchImpl,
    keyRing: CORE_TEST_RING,
    oauthClient: CORE_TEST_OAUTH,
    now,
  } as const;
}
