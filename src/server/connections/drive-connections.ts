import "server-only";

import { randomUUID } from "node:crypto";
import { and, desc, eq, inArray } from "drizzle-orm";
import type { LibSQLDatabase } from "drizzle-orm/libsql";
import { APP_ORIGIN } from "@/lib/product-urls";
import {
  keyRingFromEnv,
  open,
  providerTokenAadContext,
  seal,
  secretEquals,
  versionOf,
  type KeyRing,
} from "@/server/crypto/secret-box";
import { db } from "@/server/db";
import {
  providerConnections,
  workspaceStorage,
} from "@/server/db/schema";
import * as schema from "@/server/db/schema";
import { assertProjectNotDeleting } from "@/server/projects/project-deletion-fence";
import {
  buildGoogleDriveAuthorizationUrl,
  createGoogleDriveFolder,
  exchangeGoogleAuthorizationCode,
  findGoogleDriveFilesByAppProperty,
  getGoogleDriveAbout,
  revokeGoogleToken,
  type GoogleFetch,
  type GoogleOAuthClient,
} from "./google-drive";
import { GOOGLE_DRIVE_SCOPES } from "./google-drive-scopes";
import {
  createGoogleOAuthState,
  encodeGoogleOAuthStateCookie,
  googleOAuthStateSecretFromEnv,
  type GoogleOAuthStateIntent,
} from "./google-oauth-state";
import {
  assertProjectDriveCapability,
  type AuthorizedProjectDriveContext,
} from "./project-drive-authz";

const GOOGLE_DRIVE_PROVIDER = "google_drive" as const;
const GOOGLE_DRIVE_FOLDER_MIME_TYPE = "application/vnd.google-apps.folder";
const ROOT_FOLDER_NAME = "Signal Studio";
const ROOT_MARKER_KEY = "signalRoot";
const ROOT_MARKER_VALUE = "v1";
const GOOGLE_CALLBACK_PATH = "/api/connections/google/callback";

export const GOOGLE_OAUTH_STATE_COOKIE = "signal_google_drive_oauth_state";
export const GOOGLE_OAUTH_STATE_COOKIE_PATH = GOOGLE_CALLBACK_PATH;

export type GoogleDriveConnectionStatus =
  | "active"
  | "needs_reauth"
  | "revoked";

export type GoogleDriveConnectionSummary = Readonly<{
  connected: boolean;
  accountEmail: string | null;
  status: GoogleDriveConnectionStatus | null;
  connectedAt: string | null;
  rootFolderUrl: string | null;
  projectUsesThisAccount: boolean;
  affectedProjectCount: number;
}>;

export type BegunGoogleDriveConnection = Readonly<{
  authorizationUrl: string;
  stateCookie: string;
  cookieMaxAgeSeconds: number;
  intent: GoogleOAuthStateIntent;
}>;

export type CompletedGoogleDriveConnection = Readonly<{
  connectionId: string;
  accountEmail: string | null;
  accountChanged: boolean;
  reusedRootFolder: boolean;
  retiredCredentialRevoked: boolean;
}>;

export type DisconnectedGoogleDriveConnection = Readonly<{
  disconnected: boolean;
  affectedProjectCount: number;
  revocationConfirmed: boolean;
}>;

export type GoogleDriveConnectionErrorCode =
  | "missing-config"
  | "missing-refresh-token"
  | "stale-authorization";

export class GoogleDriveConnectionError extends Error {
  readonly code: GoogleDriveConnectionErrorCode;

  constructor(code: GoogleDriveConnectionErrorCode, detail?: string) {
    const messages: Record<GoogleDriveConnectionErrorCode, string> = {
      "missing-config": `Google Drive is not configured${detail ? ` (${detail})` : ""}.`,
      "missing-refresh-token":
        "Google did not return an offline credential. Please connect again.",
      "stale-authorization":
        "This connection request is no longer current. Please connect again.",
    };
    super(messages[code]);
    this.name = "GoogleDriveConnectionError";
    this.code = code;
  }
}

type ConnectionDb = LibSQLDatabase<typeof schema>;

export type GoogleDriveConnectionServiceDependencies = Readonly<{
  database: ConnectionDb;
  fetchImpl: GoogleFetch;
  now: () => Date;
  randomConnectionId: () => string;
  oauthClient?: GoogleOAuthClient;
  stateSecret?: string;
  keyRing?: KeyRing;
}>;

function requiredConfigValue(
  env: Readonly<Record<string, string | undefined>>,
  name:
    | "GOOGLE_OAUTH_CLIENT_ID"
    | "GOOGLE_OAUTH_CLIENT_SECRET"
    | "GOOGLE_OAUTH_REDIRECT_URI",
): string {
  const value = env[name]?.trim();
  if (!value) throw new GoogleDriveConnectionError("missing-config", name);
  return value;
}

/** Validate the one exact callback URL registered for this deployment. */
function googleDriveOAuthRedirectUriFromEnv(
  env: Readonly<Record<string, string | undefined>> = process.env,
): string {
  const configuredRedirectUri = requiredConfigValue(
    env,
    "GOOGLE_OAUTH_REDIRECT_URI",
  );
  let redirectUrl: URL;
  try {
    redirectUrl = new URL(configuredRedirectUri);
  } catch {
    throw new GoogleDriveConnectionError(
      "missing-config",
      "GOOGLE_OAUTH_REDIRECT_URI",
    );
  }
  const isLocalHttp =
    redirectUrl.protocol === "http:" && redirectUrl.hostname === "localhost";
  if (
    (redirectUrl.protocol !== "https:" && !isLocalHttp) ||
    redirectUrl.username !== "" ||
    redirectUrl.password !== "" ||
    redirectUrl.pathname !== GOOGLE_CALLBACK_PATH ||
    redirectUrl.search !== "" ||
    redirectUrl.hash !== ""
  ) {
    throw new GoogleDriveConnectionError(
      "missing-config",
      "GOOGLE_OAUTH_REDIRECT_URI",
    );
  }
  return redirectUrl.toString();
}

/**
 * Choose a redirect origin without trusting the incoming Host header.
 *
 * Preview deployments remain on preview because their exact callback URI is
 * deployment-specific. An alternate request origin is ignored. If Drive is
 * not configured, only Signal's compiled canonical origin is used.
 */
export function googleDriveReturnOriginFromEnv(
  requestOrigin: string,
  env: Readonly<Record<string, string | undefined>> = process.env,
): string {
  try {
    const configuredOrigin = new URL(
      googleDriveOAuthRedirectUriFromEnv(env),
    ).origin;
    try {
      const candidate = new URL(requestOrigin);
      if (candidate.origin === configuredOrigin) return configuredOrigin;
    } catch {
      // Ignore an unparseable Host-derived candidate.
    }
    return configuredOrigin;
  } catch {
    return APP_ORIGIN;
  }
}

/** Read the dedicated Drive OAuth client without exposing either value. */
export function googleDriveOAuthClientFromEnv(
  env: Readonly<Record<string, string | undefined>> = process.env,
): GoogleOAuthClient {
  const clientId = requiredConfigValue(env, "GOOGLE_OAUTH_CLIENT_ID");
  const clientSecret = requiredConfigValue(
    env,
    "GOOGLE_OAUTH_CLIENT_SECRET",
  );
  return Object.freeze({
    clientId,
    clientSecret,
    redirectUri: googleDriveOAuthRedirectUriFromEnv(env),
  });
}

function requireOAuthClient(
  deps: GoogleDriveConnectionServiceDependencies,
): GoogleOAuthClient {
  if (!deps.oauthClient) {
    throw new GoogleDriveConnectionError("missing-config", "OAuth client");
  }
  return deps.oauthClient;
}

function requireStateSecret(
  deps: GoogleDriveConnectionServiceDependencies,
): string {
  if (!deps.stateSecret) {
    throw new GoogleDriveConnectionError("missing-config", "OAUTH_STATE_SECRET");
  }
  return deps.stateSecret;
}

function requireKeyRing(
  deps: GoogleDriveConnectionServiceDependencies,
): KeyRing {
  if (!deps.keyRing) {
    throw new GoogleDriveConnectionError("missing-config", "PROVIDER_TOKEN_KEY");
  }
  return deps.keyRing;
}

function driveRootUrl(rootFolderId: string): string {
  return `https://drive.google.com/drive/folders/${encodeURIComponent(rootFolderId)}`;
}

function uniqueStrings(values: readonly string[]): string[] {
  return [...new Set(values)];
}

/**
 * Injectable core used by route/action wrappers and integration tests. Public
 * callers still need an `AuthorizedProjectDriveContext`; the dependency seam
 * only replaces network, time, randomness, keys, and the database.
 */
export function createGoogleDriveConnectionService(
  deps: GoogleDriveConnectionServiceDependencies,
) {
  async function currentConnection(actorUserId: string) {
    const [connection] = await deps.database
      .select()
      .from(providerConnections)
      .where(
        and(
          eq(providerConnections.userId, actorUserId),
          eq(providerConnections.provider, GOOGLE_DRIVE_PROVIDER),
          eq(providerConnections.isCurrent, true),
        ),
      )
      .orderBy(desc(providerConnections.connectedAt))
      .limit(1);
    return connection ?? null;
  }

  async function connectionLineageIds(input: {
    actorUserId: string;
    providerAccountId: string;
  }): Promise<string[]> {
    const rows = await deps.database
      .select({ id: providerConnections.id })
      .from(providerConnections)
      .where(
        and(
          eq(providerConnections.userId, input.actorUserId),
          eq(providerConnections.provider, GOOGLE_DRIVE_PROVIDER),
          eq(providerConnections.providerAccountId, input.providerAccountId),
        ),
      );
    return rows.map((row) => row.id);
  }

  async function findOrCreateRootFolder(accessToken: string) {
    const matches = [] as Array<{ id: string }>;
    let pageToken: string | null = null;
    for (let page = 0; page < 10; page += 1) {
      const result = await findGoogleDriveFilesByAppProperty(
        accessToken,
        {
          key: ROOT_MARKER_KEY,
          value: ROOT_MARKER_VALUE,
          mimeType: GOOGLE_DRIVE_FOLDER_MIME_TYPE,
          pageToken,
          pageSize: 100,
        },
        deps.fetchImpl,
      );
      matches.push(...result.files.map((file) => ({ id: file.id })));
      pageToken = result.nextPageToken;
      if (!pageToken) break;
    }
    const existing = matches.sort((left, right) =>
      left.id.localeCompare(right.id),
    )[0];
    if (existing) return { id: existing.id, reused: true } as const;

    const created = await createGoogleDriveFolder(
      accessToken,
      {
        name: ROOT_FOLDER_NAME,
        appProperties: { [ROOT_MARKER_KEY]: ROOT_MARKER_VALUE },
      },
      deps.fetchImpl,
    );
    return { id: created.id, reused: false } as const;
  }

  async function begin(
    authorization: AuthorizedProjectDriveContext,
    input: Readonly<{ clerkUserId: string; sessionId: string }>,
  ): Promise<BegunGoogleDriveConnection> {
    assertProjectDriveCapability(authorization, "manageProject");
    const existing = await currentConnection(authorization.actorUserId);
    const intent: GoogleOAuthStateIntent = existing
      ? "reconnect-google-drive"
      : "connect-google-drive";
    const state = createGoogleOAuthState(
      {
        userId: input.clerkUserId,
        sessionId: input.sessionId,
        projectId: authorization.projectId,
        intent,
      },
      requireStateSecret(deps),
      { now: Math.floor(deps.now().getTime() / 1_000) },
    );
    const authorizationUrl = buildGoogleDriveAuthorizationUrl({
      clientId: requireOAuthClient(deps).clientId,
      redirectUri: requireOAuthClient(deps).redirectUri,
      state: state.state,
      ...(existing?.providerAccountEmail
        ? { loginHint: existing.providerAccountEmail }
        : {}),
    });
    return Object.freeze({
      authorizationUrl,
      stateCookie: encodeGoogleOAuthStateCookie({
        nonce: state.nonce,
        projectId: authorization.projectId,
        intent,
      }),
      cookieMaxAgeSeconds: Math.max(
        1,
        state.expiresAt - Math.floor(deps.now().getTime() / 1_000),
      ),
      intent,
    });
  }

  async function complete(
    authorization: AuthorizedProjectDriveContext,
    input: Readonly<{ code: string; intent: GoogleOAuthStateIntent }>,
  ): Promise<CompletedGoogleDriveConnection> {
    assertProjectDriveCapability(authorization, "manageProject");
    const oauthClient = requireOAuthClient(deps);
    const ring = requireKeyRing(deps);
    const before = await currentConnection(authorization.actorUserId);
    if (input.intent === "connect-google-drive" && before) {
      throw new GoogleDriveConnectionError("stale-authorization");
    }

    // A missing retired key must not strand the user on a stale connection.
    // We can still rotate locally and establish the new grant; only the
    // best-effort revocation receipt for a different old account is lost.
    let oldRefreshToken: string | null = null;
    let oldRefreshTokenUnavailable = false;
    if (before) {
      try {
        oldRefreshToken = open(
          before.refreshTokenCipher,
          providerTokenAadContext(before.id),
          ring,
        );
      } catch {
        oldRefreshTokenUnavailable = true;
      }
    }
    const grant = await exchangeGoogleAuthorizationCode(
      { ...oauthClient, code: input.code },
      deps.fetchImpl,
    );
    if (!grant.refreshToken) {
      throw new GoogleDriveConnectionError("missing-refresh-token");
    }

    const about = await getGoogleDriveAbout(grant.accessToken, deps.fetchImpl);
    const root = await findOrCreateRootFolder(grant.accessToken);
    const connectionId = `connection-${deps.randomConnectionId()}`;
    const refreshTokenCipher = seal(
      grant.refreshToken,
      providerTokenAadContext(connectionId),
      ring,
    );
    const keyVersion = versionOf(refreshTokenCipher);
    if (keyVersion === null) {
      throw new GoogleDriveConnectionError("missing-config", "token envelope");
    }
    const connectedAt = deps.now();
    const accountChanged = Boolean(
      before && before.providerAccountId !== about.permissionId,
    );

    try {
      await deps.database.transaction(async (tx) => {
        const [stillCurrent] = await tx
          .select({ id: providerConnections.id })
          .from(providerConnections)
          .where(
            and(
              eq(providerConnections.userId, authorization.actorUserId),
              eq(providerConnections.provider, GOOGLE_DRIVE_PROVIDER),
              eq(providerConnections.isCurrent, true),
            ),
          )
          .limit(1);
        if ((stillCurrent?.id ?? null) !== (before?.id ?? null)) {
          throw new GoogleDriveConnectionError("stale-authorization");
        }

        if (before && accountChanged) {
          const fencedLineage = await tx
            .select({ id: providerConnections.id })
            .from(providerConnections)
            .where(
              and(
                eq(providerConnections.userId, authorization.actorUserId),
                eq(providerConnections.provider, GOOGLE_DRIVE_PROVIDER),
                eq(
                  providerConnections.providerAccountId,
                  before.providerAccountId,
                ),
              ),
            );
          const fencedLineageIds = fencedLineage.map((row) => row.id);
          const affected = fencedLineageIds.length
            ? await tx
                // isolation-ok: the ids are the authorized actor's exact old
                // Google-account lineage; account rotation must fence every
                // current Project whose storage uses that personal account.
                .select({ workspaceId: workspaceStorage.workspaceId })
                .from(workspaceStorage)
                .where(
                  and(
                    inArray(workspaceStorage.connectionId, fencedLineageIds),
                    eq(workspaceStorage.isCurrent, true),
                  ),
                )
            : [];
          for (const workspaceId of uniqueStrings(
            affected.map((row) => row.workspaceId),
          )) {
            await assertProjectNotDeleting(tx, workspaceId);
          }
        }

        if (before) {
          await tx
            .update(providerConnections)
            .set({
              isCurrent: false,
              status: "revoked",
              ...(oldRefreshTokenUnavailable
                ? { lastErrorAt: connectedAt }
                : {}),
            })
            .where(
              and(
                eq(providerConnections.id, before.id),
                eq(providerConnections.userId, authorization.actorUserId),
                eq(providerConnections.isCurrent, true),
              ),
            );
        }

        await tx.insert(providerConnections).values({
          id: connectionId,
          userId: authorization.actorUserId,
          provider: GOOGLE_DRIVE_PROVIDER,
          providerAccountId: about.permissionId,
          providerAccountEmail: about.emailAddress,
          rootFolderId: root.id,
          refreshTokenCipher,
          keyVersion,
          scopes: [...GOOGLE_DRIVE_SCOPES],
          status: "active",
          isCurrent: true,
          connectedAt,
        });

        if (before && accountChanged) {
          const lineage = await tx
            .select({ id: providerConnections.id })
            .from(providerConnections)
            .where(
              and(
                eq(providerConnections.userId, authorization.actorUserId),
                eq(providerConnections.provider, GOOGLE_DRIVE_PROVIDER),
                eq(
                  providerConnections.providerAccountId,
                  before.providerAccountId,
                ),
              ),
            );
          const lineageIds = lineage.map((row) => row.id);
          if (lineageIds.length > 0) {
            await tx
              .update(workspaceStorage)
              .set({ state: "needs_reauth" })
              .where(
                and(
                  inArray(workspaceStorage.connectionId, lineageIds),
                  eq(workspaceStorage.isCurrent, true),
                ),
              );
          }
        }
      }, { behavior: "immediate" });
    } catch (error) {
      // Revocation is grant-level. On a same-account reconnect it could also
      // invalidate the still-current credential whose DB transaction rolled
      // back, so let the unreachable new token die in memory instead.
      if (!before || accountChanged) {
        await revokeGoogleToken(grant.refreshToken, deps.fetchImpl).catch(
          () => {},
        );
      }
      throw error;
    }

    let retiredCredentialRevoked = false;
    if (
      before &&
      accountChanged &&
      oldRefreshToken &&
      !secretEquals(oldRefreshToken, grant.refreshToken)
    ) {
      try {
        await revokeGoogleToken(oldRefreshToken, deps.fetchImpl);
        retiredCredentialRevoked = true;
      } catch {
        await deps.database
          .update(providerConnections)
          .set({ lastErrorAt: deps.now() })
          .where(eq(providerConnections.id, before.id));
      }
    }

    return Object.freeze({
      connectionId,
      accountEmail: about.emailAddress,
      accountChanged,
      reusedRootFolder: root.reused,
      retiredCredentialRevoked,
    });
  }

  async function summary(
    authorization: AuthorizedProjectDriveContext,
  ): Promise<GoogleDriveConnectionSummary> {
    assertProjectDriveCapability(authorization, "manageProject");
    const current = await currentConnection(authorization.actorUserId);
    if (!current) {
      return Object.freeze({
        connected: false,
        accountEmail: null,
        status: null,
        connectedAt: null,
        rootFolderUrl: null,
        projectUsesThisAccount: false,
        affectedProjectCount: 0,
      });
    }
    const lineageIds = await connectionLineageIds({
      actorUserId: authorization.actorUserId,
      providerAccountId: current.providerAccountId,
    });
    const storageRows = lineageIds.length
      ? await deps.database
          // isolation-ok: connectionLineageIds is already restricted to this
          // actor's Google account; this read deliberately counts every
          // current Project using that personal connection.
          .select({ workspaceId: workspaceStorage.workspaceId })
          .from(workspaceStorage)
          .where(
            and(
              inArray(workspaceStorage.connectionId, lineageIds),
              eq(workspaceStorage.isCurrent, true),
            ),
          )
      : [];
    const projectIds = uniqueStrings(storageRows.map((row) => row.workspaceId));
    return Object.freeze({
      connected: true,
      accountEmail: current.providerAccountEmail,
      status: current.status,
      connectedAt: current.connectedAt.toISOString(),
      rootFolderUrl: driveRootUrl(current.rootFolderId),
      projectUsesThisAccount: projectIds.includes(authorization.projectId),
      affectedProjectCount: projectIds.length,
    });
  }

  async function disconnect(
    authorization: AuthorizedProjectDriveContext,
  ): Promise<DisconnectedGoogleDriveConnection> {
    assertProjectDriveCapability(authorization, "manageProject");
    const now = deps.now();
    const retired = await deps.database.transaction(async (tx) => {
      const [current] = await tx
        .select()
        .from(providerConnections)
        .where(
          and(
            eq(providerConnections.userId, authorization.actorUserId),
            eq(providerConnections.provider, GOOGLE_DRIVE_PROVIDER),
            eq(providerConnections.isCurrent, true),
          ),
        )
        .limit(1);
      if (!current) return null;

      let refreshToken: string | null = null;
      if (deps.keyRing) {
        try {
          refreshToken = open(
            current.refreshTokenCipher,
            providerTokenAadContext(current.id),
            deps.keyRing,
          );
        } catch {
          refreshToken = null;
        }
      }

      const lineage = await tx
        .select({ id: providerConnections.id })
        .from(providerConnections)
        .where(
          and(
            eq(providerConnections.userId, authorization.actorUserId),
            eq(providerConnections.provider, GOOGLE_DRIVE_PROVIDER),
            eq(
              providerConnections.providerAccountId,
              current.providerAccountId,
            ),
          ),
        );
      const lineageIds = lineage.map((row) => row.id);
      const affected = lineageIds.length
        ? await tx
            // isolation-ok: lineage is restricted to the authorized actor's
            // Google account above; disconnect must mark every current
            // Project using that personal connection as needing attention.
            .select({ workspaceId: workspaceStorage.workspaceId })
            .from(workspaceStorage)
            .where(
              and(
                inArray(workspaceStorage.connectionId, lineageIds),
                eq(workspaceStorage.isCurrent, true),
              ),
            )
        : [];
      for (const workspaceId of uniqueStrings(
        affected.map((row) => row.workspaceId),
      )) {
        await assertProjectNotDeleting(tx, workspaceId);
      }
      if (lineageIds.length > 0) {
        await tx
          .update(workspaceStorage)
          .set({ state: "needs_reauth" })
          .where(
            and(
              inArray(workspaceStorage.connectionId, lineageIds),
              eq(workspaceStorage.isCurrent, true),
            ),
          );
      }
      await tx
        .update(providerConnections)
        .set({
          status: "revoked",
          isCurrent: false,
          lastErrorAt: refreshToken ? null : now,
        })
        .where(
          and(
            eq(providerConnections.id, current.id),
            eq(providerConnections.userId, authorization.actorUserId),
            eq(providerConnections.isCurrent, true),
          ),
        );
      return {
        id: current.id,
        refreshToken,
        affectedProjectCount: uniqueStrings(
          affected.map((row) => row.workspaceId),
        ).length,
      };
    }, { behavior: "immediate" });

    if (!retired) {
      return Object.freeze({
        disconnected: false,
        affectedProjectCount: 0,
        revocationConfirmed: true,
      });
    }
    if (!retired.refreshToken) {
      return Object.freeze({
        disconnected: true,
        affectedProjectCount: retired.affectedProjectCount,
        revocationConfirmed: false,
      });
    }

    try {
      await revokeGoogleToken(retired.refreshToken, deps.fetchImpl);
      return Object.freeze({
        disconnected: true,
        affectedProjectCount: retired.affectedProjectCount,
        revocationConfirmed: true,
      });
    } catch {
      await deps.database
        .update(providerConnections)
        .set({ lastErrorAt: deps.now() })
        .where(eq(providerConnections.id, retired.id));
      return Object.freeze({
        disconnected: true,
        affectedProjectCount: retired.affectedProjectCount,
        revocationConfirmed: false,
      });
    }
  }

  return Object.freeze({ begin, complete, summary, disconnect });
}

function baseDependencies(): GoogleDriveConnectionServiceDependencies {
  return {
    database: db,
    fetchImpl: fetch,
    now: () => new Date(),
    randomConnectionId: randomUUID,
  };
}

function keyRingIfConfigured(): KeyRing | undefined {
  try {
    return keyRingFromEnv();
  } catch {
    return undefined;
  }
}

export async function beginGoogleDriveConnection(
  authorization: AuthorizedProjectDriveContext,
  input: Readonly<{ clerkUserId: string; sessionId: string }>,
): Promise<BegunGoogleDriveConnection> {
  return createGoogleDriveConnectionService({
    ...baseDependencies(),
    oauthClient: googleDriveOAuthClientFromEnv(),
    stateSecret: googleOAuthStateSecretFromEnv(),
  }).begin(authorization, input);
}

export async function completeGoogleDriveConnection(
  authorization: AuthorizedProjectDriveContext,
  input: Readonly<{ code: string; intent: GoogleOAuthStateIntent }>,
): Promise<CompletedGoogleDriveConnection> {
  return createGoogleDriveConnectionService({
    ...baseDependencies(),
    oauthClient: googleDriveOAuthClientFromEnv(),
    keyRing: keyRingFromEnv(),
  }).complete(authorization, input);
}

export async function getGoogleDriveConnectionSummary(
  authorization: AuthorizedProjectDriveContext,
): Promise<GoogleDriveConnectionSummary> {
  return createGoogleDriveConnectionService(baseDependencies()).summary(
    authorization,
  );
}

export async function disconnectGoogleDriveConnection(
  authorization: AuthorizedProjectDriveContext,
): Promise<DisconnectedGoogleDriveConnection> {
  return createGoogleDriveConnectionService({
    ...baseDependencies(),
    keyRing: keyRingIfConfigured(),
  }).disconnect(authorization);
}
