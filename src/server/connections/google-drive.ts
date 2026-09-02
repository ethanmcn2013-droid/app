import "server-only";

import {
  GOOGLE_DRIVE_SCOPES,
  assertExactGoogleDriveScopeSet,
  parseGoogleDriveScopes,
} from "./google-drive-scopes";
import {
  isTrustedGoogleDriveUploadSessionUrl as isTrustedGoogleUploadSessionUrl,
  nextGoogleDriveUploadOffset,
} from "@/lib/drive-upload-session";
export {
  isTrustedGoogleDriveUploadSessionUrl as isTrustedGoogleUploadSessionUrl,
} from "@/lib/drive-upload-session";
export {
  providerTokenAadContext as providerConnectionTokenContext,
} from "../crypto/secret-box";

const GOOGLE_AUTHORIZATION_ENDPOINT =
  "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const GOOGLE_REVOCATION_ENDPOINT = "https://oauth2.googleapis.com/revoke";
const GOOGLE_DRIVE_API_ORIGIN = "https://www.googleapis.com";
const GOOGLE_DRIVE_FOLDER_MIME_TYPE =
  "application/vnd.google-apps.folder";

const DRIVE_FILE_FIELDS = [
  "id",
  "name",
  "mimeType",
  "parents",
  "appProperties",
  "size",
  "webViewLink",
  "trashed",
].join(",");

export type GoogleFetch = (
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<Response>;

export type GoogleDriveOperation =
  | "authorization-code-exchange"
  | "access-token-refresh"
  | "token-revocation"
  | "about-get"
  | "file-create"
  | "file-get"
  | "file-list"
  | "file-rename"
  | "resumable-session-create"
  | "resumable-session-status";

export type GoogleDriveProviderErrorCode =
  | "network-error"
  | "provider-error"
  | "malformed-response";

/**
 * An error safe to serialize or report.
 *
 * Google response prose and the underlying fetch error are deliberately not
 * retained: either can contain a credential-bearing URL or a token copied by
 * an SDK. Only bounded identifier-shaped reason codes survive.
 */
export class GoogleDriveProviderError extends Error {
  readonly code: GoogleDriveProviderErrorCode;
  readonly operation: GoogleDriveOperation;
  readonly status: number | null;
  readonly reason: string | null;
  readonly retryable: boolean;

  constructor(input: {
    code: GoogleDriveProviderErrorCode;
    operation: GoogleDriveOperation;
    status?: number | null;
    reason?: string | null;
    retryable?: boolean;
  }) {
    const status = input.status ?? null;
    const reason = safeIdentifier(input.reason) ?? null;
    const detail = [status === null ? null : `HTTP ${status}`, reason]
      .filter(Boolean)
      .join(" ");
    super(
      `google-drive: ${input.operation} failed${detail ? ` (${detail})` : ""}`,
    );
    this.name = "GoogleDriveProviderError";
    this.code = input.code;
    this.operation = input.operation;
    this.status = status;
    this.reason = reason;
    this.retryable = input.retryable ?? false;
  }
}

export function isGoogleDriveProviderError(
  value: unknown,
): value is GoogleDriveProviderError {
  return value instanceof GoogleDriveProviderError;
}

export type GoogleOAuthClient = Readonly<{
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}>;

export type GoogleAuthorizationGrant = Readonly<{
  accessToken: string;
  refreshToken: string | null;
  expiresInSeconds: number;
  tokenType: string;
  grantedScopes: readonly string[];
}>;

export type GoogleRefreshedAccess = Readonly<{
  accessToken: string;
  expiresInSeconds: number;
  tokenType: string;
  /** Google may omit `scope` on refresh; when present it is checked exactly. */
  grantedScopes: readonly string[] | null;
}>;

export type GoogleDriveStorageQuota = Readonly<{
  /** Missing means the account is unlimited. It never means zero. */
  limit: string | null;
  usage: string | null;
  usageInDrive: string | null;
  usageInDriveTrash: string | null;
}>;

export type GoogleDriveAbout = Readonly<{
  /** Stable opaque Drive permission identity, used instead of OpenID `sub`. */
  permissionId: string;
  /** Display only. Never an identity or join key. */
  emailAddress: string | null;
  storageQuota: GoogleDriveStorageQuota;
}>;

export type GoogleDriveFile = Readonly<{
  id: string;
  name: string | null;
  mimeType: string | null;
  parents: readonly string[];
  appProperties: Readonly<Record<string, string>>;
  /** Decimal bytes from Drive; kept as a string to avoid precision loss. */
  size: string | null;
  webViewLink: string | null;
  trashed: boolean | null;
}>;

export type GoogleDriveFilePage = Readonly<{
  files: readonly GoogleDriveFile[];
  nextPageToken: string | null;
}>;

export type GoogleDriveResumableStatus =
  | Readonly<{ kind: "incomplete"; nextOffset: number }>
  | Readonly<{ kind: "complete"; file: GoogleDriveFile }>
  | Readonly<{ kind: "expired" }>;

/**
 * Build the server-side authorization-code URL.
 *
 * `include_granted_scopes` is intentionally absent. The live spike proved it
 * merges unrelated sign-in scopes into this grant. `offline` plus an explicit
 * consent prompt makes the refresh-token requirement visible in source.
 */
export function buildGoogleDriveAuthorizationUrl(input: {
  clientId: string;
  redirectUri: string;
  state: string;
  loginHint?: string;
}): string {
  const url = new URL(GOOGLE_AUTHORIZATION_ENDPOINT);
  url.search = new URLSearchParams({
    client_id: requireText(input.clientId, "clientId"),
    redirect_uri: requireAbsoluteUrl(input.redirectUri, "redirectUri"),
    response_type: "code",
    scope: GOOGLE_DRIVE_SCOPES.join(" "),
    access_type: "offline",
    prompt: "consent select_account",
    state: requireText(input.state, "state"),
    ...(input.loginHint
      ? { login_hint: requireText(input.loginHint, "loginHint") }
      : {}),
  }).toString();
  return url.toString();
}

/** Exchange a one-use authorization code and reject any non-exact scope set. */
export async function exchangeGoogleAuthorizationCode(
  input: GoogleOAuthClient & Readonly<{ code: string }>,
  fetchImpl: GoogleFetch = fetch,
): Promise<GoogleAuthorizationGrant> {
  const response = await googleFetch(
    "authorization-code-exchange",
    GOOGLE_TOKEN_ENDPOINT,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code: requireText(input.code, "code"),
        client_id: requireText(input.clientId, "clientId"),
        client_secret: requireText(input.clientSecret, "clientSecret"),
        redirect_uri: requireAbsoluteUrl(input.redirectUri, "redirectUri"),
        grant_type: "authorization_code",
      }),
    },
    fetchImpl,
  );
  const body = await responseRecord(response, "authorization-code-exchange");
  const scope = optionalString(body.scope);
  assertExactGoogleDriveScopeSet(scope);

  return Object.freeze({
    accessToken: requiredString(
      body.access_token,
      "authorization-code-exchange",
    ),
    refreshToken: optionalString(body.refresh_token),
    expiresInSeconds: requiredPositiveNumber(
      body.expires_in,
      "authorization-code-exchange",
    ),
    tokenType: requiredString(
      body.token_type,
      "authorization-code-exchange",
    ),
    grantedScopes: parseGoogleDriveScopes(scope),
  });
}

/** Mint a request-local access token from an encrypted-at-rest refresh token. */
export async function refreshGoogleDriveAccessToken(
  input: Readonly<{
    clientId: string;
    clientSecret: string;
    refreshToken: string;
  }>,
  fetchImpl: GoogleFetch = fetch,
): Promise<GoogleRefreshedAccess> {
  const response = await googleFetch(
    "access-token-refresh",
    GOOGLE_TOKEN_ENDPOINT,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        refresh_token: requireText(input.refreshToken, "refreshToken"),
        client_id: requireText(input.clientId, "clientId"),
        client_secret: requireText(input.clientSecret, "clientSecret"),
        grant_type: "refresh_token",
      }),
    },
    fetchImpl,
  );
  const body = await responseRecord(response, "access-token-refresh");
  const scope = optionalString(body.scope);
  if (scope !== null) assertExactGoogleDriveScopeSet(scope);

  return Object.freeze({
    accessToken: requiredString(body.access_token, "access-token-refresh"),
    expiresInSeconds: requiredPositiveNumber(
      body.expires_in,
      "access-token-refresh",
    ),
    tokenType: requiredString(body.token_type, "access-token-refresh"),
    grantedScopes: scope === null ? null : parseGoogleDriveScopes(scope),
  });
}

/** Revoke a refresh or access token without placing it in a URL. */
export async function revokeGoogleToken(
  token: string,
  fetchImpl: GoogleFetch = fetch,
): Promise<void> {
  const response = await googleFetch(
    "token-revocation",
    GOOGLE_REVOCATION_ENDPOINT,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ token: requireText(token, "token") }),
    },
    fetchImpl,
  );
  if (!response.ok) {
    const body = await responseBody(response, "token-revocation");
    throw providerResponseError("token-revocation", response.status, body);
  }
}

/** Read the stable Drive identity and quota available under `drive.file`. */
export async function getGoogleDriveAbout(
  accessToken: string,
  fetchImpl: GoogleFetch = fetch,
): Promise<GoogleDriveAbout> {
  const url = driveUrl("/drive/v3/about");
  url.searchParams.set(
    "fields",
    "user(permissionId,emailAddress),storageQuota(limit,usage,usageInDrive,usageInDriveTrash)",
  );
  const body = await driveRecord(
    "about-get",
    accessToken,
    url,
    { method: "GET" },
    fetchImpl,
  );
  const user = recordOf(body.user);
  const quota = recordOf(body.storageQuota);
  if (!user) throw malformedResponse("about-get");

  return Object.freeze({
    permissionId: requiredString(user.permissionId, "about-get"),
    emailAddress: optionalString(user.emailAddress),
    storageQuota: Object.freeze({
      limit: optionalString(quota?.limit),
      usage: optionalString(quota?.usage),
      usageInDrive: optionalString(quota?.usageInDrive),
      usageInDriveTrash: optionalString(quota?.usageInDriveTrash),
    }),
  });
}

/** Create an app-owned folder, optionally beneath one app-owned parent. */
export async function createGoogleDriveFolder(
  accessToken: string,
  input: Readonly<{
    name: string;
    parentId?: string | null;
    appProperties?: Readonly<Record<string, string>>;
  }>,
  fetchImpl: GoogleFetch = fetch,
): Promise<GoogleDriveFile> {
  const url = driveUrl("/drive/v3/files");
  url.searchParams.set("fields", DRIVE_FILE_FIELDS);
  const parentId = input.parentId
    ? requireText(input.parentId, "parentId")
    : null;
  const body = await driveRecord(
    "file-create",
    accessToken,
    url,
    {
      method: "POST",
      body: JSON.stringify({
        name: requireText(input.name, "name"),
        mimeType: GOOGLE_DRIVE_FOLDER_MIME_TYPE,
        ...(parentId ? { parents: [parentId] } : {}),
        ...(input.appProperties
          ? { appProperties: normalizeAppProperties(input.appProperties) }
          : {}),
      }),
    },
    fetchImpl,
  );
  return parseDriveFile(body, "file-create");
}

/** Fetch metadata needed to verify a folder or finalize an upload. */
export async function getGoogleDriveFile(
  accessToken: string,
  fileId: string,
  fetchImpl: GoogleFetch = fetch,
): Promise<GoogleDriveFile> {
  const url = driveUrl(
    `/drive/v3/files/${encodeURIComponent(requireText(fileId, "fileId"))}`,
  );
  url.searchParams.set("fields", DRIVE_FILE_FIELDS);
  const body = await driveRecord(
    "file-get",
    accessToken,
    url,
    { method: "GET" },
    fetchImpl,
  );
  return parseDriveFile(body, "file-get");
}

/**
 * Find app-created files by the private idempotency/folder marker.
 * Query values are escaped for Drive's search grammar before interpolation.
 */
export async function findGoogleDriveFilesByAppProperty(
  accessToken: string,
  input: Readonly<{
    key: string;
    value: string;
    parentId?: string | null;
    mimeType?: string | null;
    /** Omit the usual `trashed = false` filter when repair must detect it. */
    includeTrashed?: boolean;
    pageToken?: string | null;
    pageSize?: number;
  }>,
  fetchImpl: GoogleFetch = fetch,
): Promise<GoogleDriveFilePage> {
  const key = escapeDriveQueryValue(requireText(input.key, "appProperty key"));
  const value = escapeDriveQueryValue(
    requireText(input.value, "appProperty value"),
  );
  const terms = [
    `appProperties has { key='${key}' and value='${value}' }`,
  ];
  if (!input.includeTrashed) terms.push("trashed = false");
  if (input.parentId) {
    terms.push(
      `'${escapeDriveQueryValue(requireText(input.parentId, "parentId"))}' in parents`,
    );
  }
  if (input.mimeType) {
    terms.push(
      `mimeType = '${escapeDriveQueryValue(requireText(input.mimeType, "mimeType"))}'`,
    );
  }

  const url = driveUrl("/drive/v3/files");
  url.searchParams.set("q", terms.join(" and "));
  url.searchParams.set("spaces", "drive");
  url.searchParams.set("pageSize", String(normalizePageSize(input.pageSize)));
  url.searchParams.set("fields", `nextPageToken,files(${DRIVE_FILE_FIELDS})`);
  if (input.pageToken) {
    url.searchParams.set("pageToken", requireText(input.pageToken, "pageToken"));
  }

  const body = await driveRecord(
    "file-list",
    accessToken,
    url,
    { method: "GET" },
    fetchImpl,
  );
  if (!Array.isArray(body.files)) throw malformedResponse("file-list");

  return Object.freeze({
    files: Object.freeze(
      body.files.map((file) =>
        parseDriveFile(recordOf(file), "file-list"),
      ),
    ),
    nextPageToken: optionalString(body.nextPageToken),
  });
}

/** Rename metadata only; parent changes and destructive operations stay absent. */
export async function renameGoogleDriveFile(
  accessToken: string,
  fileId: string,
  name: string,
  fetchImpl: GoogleFetch = fetch,
): Promise<GoogleDriveFile> {
  const url = driveUrl(
    `/drive/v3/files/${encodeURIComponent(requireText(fileId, "fileId"))}`,
  );
  url.searchParams.set("fields", DRIVE_FILE_FIELDS);
  const body = await driveRecord(
    "file-rename",
    accessToken,
    url,
    {
      method: "PATCH",
      body: JSON.stringify({ name: requireText(name, "name") }),
    },
    fetchImpl,
  );
  return parseDriveFile(body, "file-rename");
}

/**
 * Mint the server half of a resumable upload.
 *
 * The returned session URI is a short-lived bearer capability intended for
 * the browser. The access token remains in this request and is never embedded
 * in the URI or response object.
 */
export async function createGoogleDriveResumableUploadSession(
  accessToken: string,
  input: Readonly<{
    name: string;
    mimeType: string;
    sizeBytes: number;
    parentId: string;
    appProperties: Readonly<Record<string, string>>;
  }>,
  fetchImpl: GoogleFetch = fetch,
): Promise<Readonly<{ sessionUrl: string }>> {
  if (!Number.isSafeInteger(input.sizeBytes) || input.sizeBytes < 0) {
    throw new TypeError("google-drive: sizeBytes must be a non-negative integer");
  }
  const mimeType = requireText(input.mimeType, "mimeType");
  const url = new URL("/upload/drive/v3/files", GOOGLE_DRIVE_API_ORIGIN);
  url.searchParams.set("uploadType", "resumable");
  url.searchParams.set("fields", DRIVE_FILE_FIELDS);

  const response = await driveFetch(
    "resumable-session-create",
    accessToken,
    url,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=UTF-8",
        "X-Upload-Content-Type": mimeType,
        "X-Upload-Content-Length": String(input.sizeBytes),
      },
      body: JSON.stringify({
        name: requireText(input.name, "name"),
        parents: [requireText(input.parentId, "parentId")],
        appProperties: normalizeAppProperties(input.appProperties),
      }),
    },
    fetchImpl,
  );
  if (!response.ok) {
    const body = await responseBody(response, "resumable-session-create");
    throw providerResponseError(
      "resumable-session-create",
      response.status,
      body,
    );
  }

  const sessionUrl = response.headers.get("location");
  if (!sessionUrl || !isTrustedGoogleUploadSessionUrl(sessionUrl)) {
    throw malformedResponse("resumable-session-create");
  }
  return Object.freeze({ sessionUrl });
}

/**
 * Ask Google what a delegated resumable session has durably accepted.
 *
 * The session URI is already a bearer capability, so this request deliberately
 * carries no OAuth Authorization header. Only a provider 404 is evidence that
 * the capability expired; network errors, throttling and 5xx remain ambiguous
 * and must not cause a replacement upload to be minted.
 */
export async function queryGoogleDriveResumableUploadSession(
  sessionUrl: string,
  totalBytes: number,
  fetchImpl: GoogleFetch = fetch,
): Promise<GoogleDriveResumableStatus> {
  if (!isTrustedGoogleUploadSessionUrl(sessionUrl)) {
    throw new TypeError("google-drive: untrusted resumable session URL");
  }
  if (!Number.isSafeInteger(totalBytes) || totalBytes < 0) {
    throw new TypeError("google-drive: totalBytes must be a non-negative integer");
  }

  const response = await googleFetch(
    "resumable-session-status",
    sessionUrl,
    {
      method: "PUT",
      headers: {
        "Content-Length": "0",
        "Content-Range": `bytes */${totalBytes}`,
      },
    },
    fetchImpl,
  );

  if (response.status === 308) {
    const nextOffset = nextGoogleDriveUploadOffset(
      response.headers.get("range"),
      totalBytes,
    );
    if (nextOffset === null) {
      throw malformedResponse("resumable-session-status", response.status);
    }
    return Object.freeze({ kind: "incomplete", nextOffset });
  }

  if (response.status === 404) return Object.freeze({ kind: "expired" });

  if (response.status === 200 || response.status === 201) {
    const body = await responseRecord(response, "resumable-session-status");
    return Object.freeze({
      kind: "complete",
      file: parseDriveFile(body, "resumable-session-status"),
    });
  }

  const body = await responseBody(response, "resumable-session-status");
  throw providerResponseError(
    "resumable-session-status",
    response.status,
    body,
  );
}

function driveUrl(pathname: string): URL {
  return new URL(pathname, GOOGLE_DRIVE_API_ORIGIN);
}

async function driveRecord(
  operation: GoogleDriveOperation,
  accessToken: string,
  url: URL,
  init: RequestInit,
  fetchImpl: GoogleFetch,
): Promise<Record<string, unknown>> {
  const response = await driveFetch(
    operation,
    accessToken,
    url,
    init,
    fetchImpl,
  );
  return responseRecord(response, operation);
}

async function driveFetch(
  operation: GoogleDriveOperation,
  accessToken: string,
  url: URL,
  init: RequestInit,
  fetchImpl: GoogleFetch,
): Promise<Response> {
  const headers = new Headers(init.headers);
  headers.set("Accept", "application/json");
  headers.set("Authorization", `Bearer ${requireText(accessToken, "accessToken")}`);
  if (init.body !== undefined && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  return googleFetch(
    operation,
    url,
    { ...init, headers },
    fetchImpl,
  );
}

async function googleFetch(
  operation: GoogleDriveOperation,
  input: string | URL,
  init: RequestInit,
  fetchImpl: GoogleFetch,
): Promise<Response> {
  try {
    return await fetchImpl(input, {
      ...init,
      cache: "no-store",
      redirect: "error",
    });
  } catch {
    throw new GoogleDriveProviderError({
      code: "network-error",
      operation,
      retryable: true,
    });
  }
}

async function responseRecord(
  response: Response,
  operation: GoogleDriveOperation,
): Promise<Record<string, unknown>> {
  const body = await responseBody(response, operation);
  if (!response.ok) {
    throw providerResponseError(operation, response.status, body);
  }
  const record = recordOf(body);
  if (!record) throw malformedResponse(operation, response.status);
  return record;
}

async function responseBody(
  response: Response,
  operation: GoogleDriveOperation,
): Promise<unknown> {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    if (response.ok) throw malformedResponse(operation, response.status);
    return null;
  }
}

function providerResponseError(
  operation: GoogleDriveOperation,
  status: number,
  body: unknown,
): GoogleDriveProviderError {
  const top = recordOf(body);
  const nested = recordOf(top?.error);
  const nestedErrors = Array.isArray(nested?.errors) ? nested.errors : [];
  const firstError = recordOf(nestedErrors[0]);
  const reason =
    safeIdentifier(typeof top?.error === "string" ? top.error : null) ??
    safeIdentifier(firstError?.reason) ??
    safeIdentifier(nested?.status) ??
    null;
  const retryable =
    status === 408 ||
    status === 429 ||
    status >= 500 ||
    reason === "rateLimitExceeded" ||
    reason === "userRateLimitExceeded" ||
    reason === "backendError" ||
    reason === "temporarily_unavailable";
  return new GoogleDriveProviderError({
    code: "provider-error",
    operation,
    status,
    reason,
    retryable,
  });
}

function malformedResponse(
  operation: GoogleDriveOperation,
  status: number | null = null,
): GoogleDriveProviderError {
  return new GoogleDriveProviderError({
    code: "malformed-response",
    operation,
    status,
  });
}

function parseDriveFile(
  value: Record<string, unknown> | null,
  operation: GoogleDriveOperation,
): GoogleDriveFile {
  if (!value) throw malformedResponse(operation);
  return Object.freeze({
    id: requiredString(value.id, operation),
    name: optionalString(value.name),
    mimeType: optionalString(value.mimeType),
    parents: Object.freeze(stringList(value.parents)),
    appProperties: Object.freeze(stringRecord(value.appProperties)),
    size: optionalString(value.size),
    webViewLink: optionalString(value.webViewLink),
    trashed: typeof value.trashed === "boolean" ? value.trashed : null,
  });
}

function normalizeAppProperties(
  value: Readonly<Record<string, string>>,
): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, item] of Object.entries(value)) {
    result[requireText(key, "appProperty key")] = requireText(
      item,
      "appProperty value",
    );
  }
  if (Object.keys(result).length === 0) {
    throw new TypeError("google-drive: appProperties must not be empty");
  }
  return result;
}

function escapeDriveQueryValue(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

function normalizePageSize(value: number | undefined): number {
  if (value === undefined) return 100;
  if (!Number.isSafeInteger(value) || value < 1 || value > 1_000) {
    throw new TypeError("google-drive: pageSize must be between 1 and 1000");
  }
  return value;
}

function recordOf(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function optionalString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function requiredString(
  value: unknown,
  operation: GoogleDriveOperation,
): string {
  const result = optionalString(value);
  if (!result) throw malformedResponse(operation);
  return result;
}

function requiredPositiveNumber(
  value: unknown,
  operation: GoogleDriveOperation,
): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    throw malformedResponse(operation);
  }
  return value;
}

function stringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

function stringRecord(value: unknown): Record<string, string> {
  const record = recordOf(value);
  if (!record) return {};
  return Object.fromEntries(
    Object.entries(record).filter(
      (entry): entry is [string, string] => typeof entry[1] === "string",
    ),
  );
}

function requireText(value: string, label: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new TypeError(`google-drive: ${label} is required`);
  }
  return value;
}

function requireAbsoluteUrl(value: string, label: string): string {
  const text = requireText(value, label);
  try {
    const url = new URL(text);
    const isLocalHttp =
      url.protocol === "http:" && url.hostname === "localhost";
    if (url.protocol !== "https:" && !isLocalHttp) {
      throw new Error("unsupported protocol");
    }
    return url.toString();
  } catch {
    throw new TypeError(`google-drive: ${label} must be an absolute URL`);
  }
}

function safeIdentifier(value: unknown): string | null {
  return typeof value === "string" && /^[A-Za-z0-9_.-]{1,80}$/.test(value)
    ? value
    : null;
}
