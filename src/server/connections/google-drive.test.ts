import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  GOOGLE_DRIVE_FILE_SCOPE,
  GoogleDriveScopeError,
} from "./google-drive-scopes";
import {
  GoogleDriveProviderError,
  buildGoogleDriveAuthorizationUrl,
  createGoogleDriveFolder,
  createGoogleDriveResumableUploadSession,
  exchangeGoogleAuthorizationCode,
  findGoogleDriveFilesByAppProperty,
  getGoogleDriveAbout,
  getGoogleDriveFile,
  isTrustedGoogleUploadSessionUrl,
  providerConnectionTokenContext,
  queryGoogleDriveResumableUploadSession,
  refreshGoogleDriveAccessToken,
  renameGoogleDriveFile,
  revokeGoogleToken,
  type GoogleFetch,
} from "./google-drive";

type CapturedCall = {
  url: string;
  init: RequestInit | undefined;
};

function queuedFetch(...queue: Array<Response | Error>): {
  calls: CapturedCall[];
  fetchImpl: GoogleFetch;
} {
  const calls: CapturedCall[] = [];
  const fetchImpl: GoogleFetch = async (input, init) => {
    const url =
      input instanceof Request
        ? input.url
        : input instanceof URL
          ? input.toString()
          : input;
    calls.push({ url, init });
    const next = queue.shift();
    if (!next) throw new Error("test fetch queue exhausted");
    if (next instanceof Error) throw next;
    return next;
  };
  return { calls, fetchImpl };
}

function jsonResponse(
  body: unknown,
  status = 200,
  headers?: HeadersInit,
): Response {
  const responseHeaders = new Headers(headers);
  responseHeaders.set("Content-Type", "application/json");
  return new Response(JSON.stringify(body), {
    status,
    headers: responseHeaders,
  });
}

function onlyCall(calls: CapturedCall[]): CapturedCall {
  assert.equal(calls.length, 1);
  const call = calls[0];
  assert.ok(call);
  assert.equal(call.init?.cache, "no-store");
  assert.equal(call.init?.redirect, "error");
  return call;
}

function formBody(call: CapturedCall): URLSearchParams {
  const body = call.init?.body;
  assert.ok(body instanceof URLSearchParams, "expected a URL-encoded body");
  return body;
}

function jsonBody(call: CapturedCall): Record<string, unknown> {
  const body = call.init?.body;
  if (typeof body !== "string") {
    assert.fail("expected a JSON body");
  }
  return JSON.parse(body) as Record<string, unknown>;
}

function requestHeaders(call: CapturedCall): Headers {
  return new Headers(call.init?.headers);
}

const CLIENT = {
  clientId: "google-client-id",
  clientSecret: "GOCSPX-test-client-secret",
  redirectUri: "http://localhost:3000/api/connections/google-drive/callback",
} as const;

const ACCESS_TOKEN = "ya29.test-request-local-access-token";
const REFRESH_TOKEN = "1//test-refresh-token";

const DRIVE_FILE_RESPONSE = {
  id: "file-123",
  name: "Run sheet.pdf",
  mimeType: "application/pdf",
  parents: ["folder-123"],
  appProperties: { signalResourceId: "resource-123" },
  size: "9007199254740993",
  webViewLink: "https://drive.google.com/file/d/file-123/view",
  trashed: false,
};

describe("Google Drive OAuth transport", () => {
  it("builds the authorization URL with the exact narrow scope", () => {
    const href = buildGoogleDriveAuthorizationUrl({
      clientId: CLIENT.clientId,
      redirectUri: CLIENT.redirectUri,
      state: "signed-state",
      loginHint: "owner@example.com",
    });
    const url = new URL(href);

    assert.equal(
      `${url.origin}${url.pathname}`,
      "https://accounts.google.com/o/oauth2/v2/auth",
    );
    assert.equal(url.searchParams.get("client_id"), CLIENT.clientId);
    assert.equal(url.searchParams.get("redirect_uri"), CLIENT.redirectUri);
    assert.equal(url.searchParams.get("response_type"), "code");
    assert.equal(url.searchParams.get("scope"), GOOGLE_DRIVE_FILE_SCOPE);
    assert.equal(url.searchParams.get("access_type"), "offline");
    assert.equal(url.searchParams.get("prompt"), "consent select_account");
    assert.equal(url.searchParams.get("state"), "signed-state");
    assert.equal(url.searchParams.get("login_hint"), "owner@example.com");
    assert.equal(url.searchParams.has("include_granted_scopes"), false);
  });

  it("allows HTTPS callbacks and local HTTP only", () => {
    assert.doesNotThrow(() =>
      buildGoogleDriveAuthorizationUrl({
        clientId: CLIENT.clientId,
        redirectUri: "https://app.signal.studio/callback",
        state: "state",
      }),
    );
    for (const redirectUri of [
      "http://app.signal.studio/callback",
      "ftp://localhost/callback",
      "/relative/callback",
    ]) {
      assert.throws(() =>
        buildGoogleDriveAuthorizationUrl({
          clientId: CLIENT.clientId,
          redirectUri,
          state: "state",
        }),
      );
    }
  });

  it("exchanges a code in the body and accepts only the exact grant", async () => {
    const fake = queuedFetch(
      jsonResponse({
        access_token: ACCESS_TOKEN,
        refresh_token: REFRESH_TOKEN,
        expires_in: 3_600,
        token_type: "Bearer",
        scope: GOOGLE_DRIVE_FILE_SCOPE,
      }),
    );

    const grant = await exchangeGoogleAuthorizationCode(
      { ...CLIENT, code: "one-use-code" },
      fake.fetchImpl,
    );

    assert.deepEqual(grant, {
      accessToken: ACCESS_TOKEN,
      refreshToken: REFRESH_TOKEN,
      expiresInSeconds: 3_600,
      tokenType: "Bearer",
      grantedScopes: [GOOGLE_DRIVE_FILE_SCOPE],
    });
    assert.equal(Object.isFrozen(grant), true);
    const call = onlyCall(fake.calls);
    assert.equal(call.url, "https://oauth2.googleapis.com/token");
    assert.equal(call.init?.method, "POST");
    assert.equal(call.url.includes("one-use-code"), false);
    assert.equal(call.url.includes(CLIENT.clientSecret), false);
    const form = formBody(call);
    assert.equal(form.get("code"), "one-use-code");
    assert.equal(form.get("client_id"), CLIENT.clientId);
    assert.equal(form.get("client_secret"), CLIENT.clientSecret);
    assert.equal(form.get("redirect_uri"), CLIENT.redirectUri);
    assert.equal(form.get("grant_type"), "authorization_code");
  });

  it("rejects a widened authorization-code grant", async () => {
    const widerScope = GOOGLE_DRIVE_FILE_SCOPE.replace(".file", "");
    const fake = queuedFetch(
      jsonResponse({
        access_token: ACCESS_TOKEN,
        refresh_token: REFRESH_TOKEN,
        expires_in: 3_600,
        token_type: "Bearer",
        scope: `${GOOGLE_DRIVE_FILE_SCOPE} ${widerScope}`,
      }),
    );

    await assert.rejects(
      exchangeGoogleAuthorizationCode(
        { ...CLIENT, code: "one-use-code" },
        fake.fetchImpl,
      ),
      GoogleDriveScopeError,
    );
  });

  it("refreshes without persisting or placing credentials in the URL", async () => {
    const fake = queuedFetch(
      jsonResponse({
        access_token: ACCESS_TOKEN,
        expires_in: 3_599,
        token_type: "Bearer",
      }),
    );

    const refreshed = await refreshGoogleDriveAccessToken(
      {
        clientId: CLIENT.clientId,
        clientSecret: CLIENT.clientSecret,
        refreshToken: REFRESH_TOKEN,
      },
      fake.fetchImpl,
    );

    assert.deepEqual(refreshed, {
      accessToken: ACCESS_TOKEN,
      expiresInSeconds: 3_599,
      tokenType: "Bearer",
      grantedScopes: null,
    });
    const call = onlyCall(fake.calls);
    assert.equal(call.url, "https://oauth2.googleapis.com/token");
    assert.equal(call.url.includes(REFRESH_TOKEN), false);
    assert.equal(call.url.includes(CLIENT.clientSecret), false);
    const form = formBody(call);
    assert.equal(form.get("refresh_token"), REFRESH_TOKEN);
    assert.equal(form.get("client_secret"), CLIENT.clientSecret);
    assert.equal(form.get("grant_type"), "refresh_token");
  });

  it("checks a refresh response's scope whenever Google supplies one", async () => {
    const exact = queuedFetch(
      jsonResponse({
        access_token: ACCESS_TOKEN,
        expires_in: 3_600,
        token_type: "Bearer",
        scope: GOOGLE_DRIVE_FILE_SCOPE,
      }),
    );
    const accepted = await refreshGoogleDriveAccessToken(
      {
        clientId: CLIENT.clientId,
        clientSecret: CLIENT.clientSecret,
        refreshToken: REFRESH_TOKEN,
      },
      exact.fetchImpl,
    );
    assert.deepEqual(accepted.grantedScopes, [GOOGLE_DRIVE_FILE_SCOPE]);

    const widerScope = GOOGLE_DRIVE_FILE_SCOPE.replace(".file", "");
    const widened = queuedFetch(
      jsonResponse({
        access_token: ACCESS_TOKEN,
        expires_in: 3_600,
        token_type: "Bearer",
        scope: widerScope,
      }),
    );
    await assert.rejects(
      refreshGoogleDriveAccessToken(
        {
          clientId: CLIENT.clientId,
          clientSecret: CLIENT.clientSecret,
          refreshToken: REFRESH_TOKEN,
        },
        widened.fetchImpl,
      ),
      GoogleDriveScopeError,
    );
  });

  it("revokes a token in a form body, never in a URL", async () => {
    const fake = queuedFetch(new Response(null, { status: 200 }));
    await revokeGoogleToken(REFRESH_TOKEN, fake.fetchImpl);

    const call = onlyCall(fake.calls);
    assert.equal(call.url, "https://oauth2.googleapis.com/revoke");
    assert.equal(call.url.includes(REFRESH_TOKEN), false);
    assert.equal(call.init?.method, "POST");
    assert.equal(formBody(call).get("token"), REFRESH_TOKEN);
  });

  it("treats Google's already-expired or already-revoked response as idempotent success", async () => {
    const fake = queuedFetch(jsonResponse({ error: "invalid_token" }, 400));

    await revokeGoogleToken(REFRESH_TOKEN, fake.fetchImpl);

    const call = onlyCall(fake.calls);
    assert.equal(formBody(call).get("token"), REFRESH_TOKEN);
  });

  it("rejects transient revocation failures", async () => {
    const fake = queuedFetch(
      jsonResponse({ error: "temporarily_unavailable" }, 503),
    );

    await assert.rejects(
      revokeGoogleToken(REFRESH_TOKEN, fake.fetchImpl),
      (error: unknown) =>
        error instanceof GoogleDriveProviderError &&
        error.operation === "token-revocation" &&
        error.retryable,
    );
  });
});

describe("Google Drive identity and file primitives", () => {
  it("reads permission identity, display email, and string-safe quota", async () => {
    const fake = queuedFetch(
      jsonResponse({
        user: {
          permissionId: "permission-123",
          emailAddress: "owner@example.com",
        },
        storageQuota: {
          usage: "9007199254740993",
          usageInDrive: "9007199254740000",
          usageInDriveTrash: "993",
        },
      }),
    );

    const about = await getGoogleDriveAbout(ACCESS_TOKEN, fake.fetchImpl);

    assert.deepEqual(about, {
      permissionId: "permission-123",
      emailAddress: "owner@example.com",
      storageQuota: {
        limit: null,
        usage: "9007199254740993",
        usageInDrive: "9007199254740000",
        usageInDriveTrash: "993",
      },
    });
    const call = onlyCall(fake.calls);
    const url = new URL(call.url);
    assert.equal(url.pathname, "/drive/v3/about");
    assert.equal(
      url.searchParams.get("fields"),
      "user(permissionId,emailAddress),storageQuota(limit,usage,usageInDrive,usageInDriveTrash)",
    );
    assert.equal(requestHeaders(call).get("Authorization"), `Bearer ${ACCESS_TOKEN}`);
    assert.equal(call.url.includes(ACCESS_TOKEN), false);
  });

  it("creates root and project folders with private app properties", async () => {
    const fake = queuedFetch(
      jsonResponse({
        id: "root-123",
        name: "Signal Studio",
        mimeType: "application/vnd.google-apps.folder",
        appProperties: { signalRoot: "v1" },
      }),
      jsonResponse({
        id: "folder-123",
        name: "Launch",
        mimeType: "application/vnd.google-apps.folder",
        parents: ["root-123"],
        appProperties: { signalWorkspaceId: "workspace-123" },
      }),
    );

    const root = await createGoogleDriveFolder(
      ACCESS_TOKEN,
      {
        name: "Signal Studio",
        appProperties: { signalRoot: "v1" },
      },
      fake.fetchImpl,
    );
    const folder = await createGoogleDriveFolder(
      ACCESS_TOKEN,
      {
        name: "Launch",
        parentId: "root-123",
        appProperties: { signalWorkspaceId: "workspace-123" },
      },
      fake.fetchImpl,
    );

    assert.equal(root.id, "root-123");
    assert.deepEqual(root.parents, []);
    assert.equal(folder.id, "folder-123");
    assert.deepEqual(folder.parents, ["root-123"]);
    assert.equal(fake.calls.length, 2);
    const rootBody = jsonBody(fake.calls[0]);
    assert.deepEqual(rootBody, {
      name: "Signal Studio",
      mimeType: "application/vnd.google-apps.folder",
      appProperties: { signalRoot: "v1" },
    });
    assert.equal("parents" in rootBody, false);
    assert.deepEqual(jsonBody(fake.calls[1]), {
      name: "Launch",
      mimeType: "application/vnd.google-apps.folder",
      parents: ["root-123"],
      appProperties: { signalWorkspaceId: "workspace-123" },
    });
    for (const call of fake.calls) {
      assert.equal(call.init?.method, "POST");
      assert.equal(requestHeaders(call).get("Authorization"), `Bearer ${ACCESS_TOKEN}`);
      assert.equal(new URL(call.url).pathname, "/drive/v3/files");
    }
  });

  it("gets a file with an encoded identifier and preserves large sizes", async () => {
    const fake = queuedFetch(jsonResponse(DRIVE_FILE_RESPONSE));
    const file = await getGoogleDriveFile(
      ACCESS_TOKEN,
      "file/with space",
      fake.fetchImpl,
    );

    assert.deepEqual(file, DRIVE_FILE_RESPONSE);
    const call = onlyCall(fake.calls);
    assert.equal(
      new URL(call.url).pathname,
      "/drive/v3/files/file%2Fwith%20space",
    );
    assert.equal(call.init?.method, "GET");
  });

  it("finds app-created files using an escaped private-property query", async () => {
    const fake = queuedFetch(
      jsonResponse({
        files: [DRIVE_FILE_RESPONSE],
        nextPageToken: "page-2",
      }),
    );
    const page = await findGoogleDriveFilesByAppProperty(
      ACCESS_TOKEN,
      {
        key: "key'\\",
        value: "value'\\",
        parentId: "folder-123",
        mimeType: "application/pdf",
        pageToken: "page-1",
        pageSize: 250,
      },
      fake.fetchImpl,
    );

    assert.deepEqual(page.files, [DRIVE_FILE_RESPONSE]);
    assert.equal(page.nextPageToken, "page-2");
    const call = onlyCall(fake.calls);
    const url = new URL(call.url);
    assert.equal(url.pathname, "/drive/v3/files");
    assert.equal(url.searchParams.get("spaces"), "drive");
    assert.equal(url.searchParams.get("pageSize"), "250");
    assert.equal(url.searchParams.get("pageToken"), "page-1");
    const query = url.searchParams.get("q") ?? "";
    assert.ok(query.includes("key='key\\'\\\\'"));
    assert.ok(query.includes("value='value\\'\\\\'"));
    assert.ok(query.includes("'folder-123' in parents"));
    assert.ok(query.includes("mimeType = 'application/pdf'"));
    assert.ok(query.includes("trashed = false"));
  });

  it("renames metadata without exposing destructive primitives", async () => {
    const fake = queuedFetch(
      jsonResponse({ ...DRIVE_FILE_RESPONSE, name: "Updated run sheet.pdf" }),
    );
    const file = await renameGoogleDriveFile(
      ACCESS_TOKEN,
      "file-123",
      "Updated run sheet.pdf",
      fake.fetchImpl,
    );

    assert.equal(file.name, "Updated run sheet.pdf");
    const call = onlyCall(fake.calls);
    assert.equal(call.init?.method, "PATCH");
    assert.deepEqual(jsonBody(call), { name: "Updated run sheet.pdf" });
    assert.equal(new URL(call.url).pathname, "/drive/v3/files/file-123");
  });
});

describe("Google Drive resumable upload foundation", () => {
  const SESSION_URL =
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&upload_id=session-123";

  it("creates a resumable session while keeping the access token server-local", async () => {
    const fake = queuedFetch(
      new Response(null, {
        status: 200,
        headers: { Location: SESSION_URL },
      }),
    );

    const result = await createGoogleDriveResumableUploadSession(
      ACCESS_TOKEN,
      {
        name: "Run sheet.pdf",
        mimeType: "application/pdf",
        sizeBytes: 12_345,
        parentId: "folder-123",
        appProperties: { signalResourceId: "resource-123" },
      },
      fake.fetchImpl,
    );

    assert.deepEqual(result, { sessionUrl: SESSION_URL });
    assert.deepEqual(Object.keys(result), ["sessionUrl"]);
    assert.equal(result.sessionUrl.includes(ACCESS_TOKEN), false);
    const call = onlyCall(fake.calls);
    const url = new URL(call.url);
    assert.equal(url.pathname, "/upload/drive/v3/files");
    assert.equal(url.searchParams.get("uploadType"), "resumable");
    assert.equal(call.url.includes(ACCESS_TOKEN), false);
    const headers = requestHeaders(call);
    assert.equal(headers.get("Authorization"), `Bearer ${ACCESS_TOKEN}`);
    assert.equal(headers.get("X-Upload-Content-Type"), "application/pdf");
    assert.equal(headers.get("X-Upload-Content-Length"), "12345");
    assert.deepEqual(jsonBody(call), {
      name: "Run sheet.pdf",
      parents: ["folder-123"],
      appProperties: { signalResourceId: "resource-123" },
    });
    assert.equal(String(call.init?.body).includes(ACCESS_TOKEN), false);
  });

  it("accepts only Google-owned resumable session capabilities", () => {
    assert.equal(isTrustedGoogleUploadSessionUrl(SESSION_URL), true);
    for (const value of [
      "http://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&upload_id=x",
      "https://www.googleapis.com:444/upload/drive/v3/files?uploadType=resumable&upload_id=x",
      "https://user:pass@www.googleapis.com/upload/drive/v3/files?uploadType=resumable&upload_id=x",
      "https://evil.example/upload/drive/v3/files?uploadType=resumable&upload_id=x",
      "https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable",
      "https://www.googleapis.com/upload/drive/v3/files?upload_id=x",
      "not a URL",
    ]) {
      assert.equal(isTrustedGoogleUploadSessionUrl(value), false, value);
    }
  });

  it("rejects an untrusted Location supplied by the provider", async () => {
    const fake = queuedFetch(
      new Response(null, {
        status: 200,
        headers: {
          Location:
            "https://evil.example/upload/drive/v3/files?uploadType=resumable&upload_id=x",
        },
      }),
    );

    await assert.rejects(
      createGoogleDriveResumableUploadSession(
        ACCESS_TOKEN,
        {
          name: "Run sheet.pdf",
          mimeType: "application/pdf",
          sizeBytes: 12_345,
          parentId: "folder-123",
          appProperties: { signalResourceId: "resource-123" },
        },
        fake.fetchImpl,
      ),
      (error: unknown) => {
        assert.ok(error instanceof GoogleDriveProviderError);
        assert.equal(error.code, "malformed-response");
        assert.equal(error.operation, "resumable-session-create");
        assert.equal(String(error).includes(ACCESS_TOKEN), false);
        return true;
      },
    );
  });

  it("queries an incomplete session without sending an OAuth token", async () => {
    const fake = queuedFetch(
      new Response(null, { status: 308, headers: { Range: "bytes=0-524287" } }),
    );

    assert.deepEqual(
      await queryGoogleDriveResumableUploadSession(
        SESSION_URL,
        1_048_576,
        fake.fetchImpl,
      ),
      { kind: "incomplete", nextOffset: 524_288 },
    );
    const call = onlyCall(fake.calls);
    const headers = requestHeaders(call);
    assert.equal(call.url, SESSION_URL);
    assert.equal(call.init?.method, "PUT");
    assert.equal(headers.get("Content-Range"), "bytes */1048576");
    assert.equal(headers.get("Content-Length"), "0");
    assert.equal(headers.has("Authorization"), false);
  });

  it("treats an absent 308 Range as zero accepted bytes", async () => {
    const fake = queuedFetch(new Response(null, { status: 308 }));
    assert.deepEqual(
      await queryGoogleDriveResumableUploadSession(
        SESSION_URL,
        1_048_576,
        fake.fetchImpl,
      ),
      { kind: "incomplete", nextOffset: 0 },
    );
  });

  it("returns completed metadata for a 200 or 201 status probe", async () => {
    for (const status of [200, 201]) {
      const fake = queuedFetch(jsonResponse(DRIVE_FILE_RESPONSE, status));
      const result = await queryGoogleDriveResumableUploadSession(
        SESSION_URL,
        1_048_576,
        fake.fetchImpl,
      );
      assert.equal(result.kind, "complete");
      if (result.kind === "complete") assert.equal(result.file.id, "file-123");
    }
  });

  it("distinguishes expiry from every ambiguous provider failure", async () => {
    const expired = queuedFetch(jsonResponse({ error: "notFound" }, 404));
    assert.deepEqual(
      await queryGoogleDriveResumableUploadSession(
        SESSION_URL,
        1_048_576,
        expired.fetchImpl,
      ),
      { kind: "expired" },
    );

    for (const status of [408, 429, 500, 503]) {
      const fake = queuedFetch(
        jsonResponse({ error: { errors: [{ reason: "backendError" }] } }, status),
      );
      await assert.rejects(
        queryGoogleDriveResumableUploadSession(
          SESSION_URL,
          1_048_576,
          fake.fetchImpl,
        ),
        (error: unknown) => {
          assert.ok(error instanceof GoogleDriveProviderError);
          assert.equal(error.operation, "resumable-session-status");
          assert.equal(error.retryable, true);
          return true;
        },
      );
    }
  });

  it("refuses malformed acknowledgement ranges and untrusted URLs", async () => {
    for (const range of ["bytes=10-20", "bytes=0-nope", "bytes=0-1048576"]) {
      const fake = queuedFetch(
        new Response(null, { status: 308, headers: { Range: range } }),
      );
      await assert.rejects(
        queryGoogleDriveResumableUploadSession(
          SESSION_URL,
          1_048_576,
          fake.fetchImpl,
        ),
        (error: unknown) => {
          assert.ok(error instanceof GoogleDriveProviderError);
          assert.equal(error.code, "malformed-response");
          return true;
        },
      );
    }

    await assert.rejects(
      queryGoogleDriveResumableUploadSession(
        "https://evil.example/upload/drive/v3/files?uploadType=resumable&upload_id=x",
        1,
      ),
      /untrusted resumable session URL/,
    );
  });
});

describe("Google Drive error and token-custody boundaries", () => {
  it("normalizes OAuth prose without retaining credentials", async () => {
    const leakedProse = `code ${REFRESH_TOKEN} was rejected for ${CLIENT.clientSecret}`;
    const fake = queuedFetch(
      jsonResponse(
        {
          error: "invalid_grant",
          error_description: leakedProse,
        },
        400,
      ),
    );

    await assert.rejects(
      exchangeGoogleAuthorizationCode(
        { ...CLIENT, code: "one-use-code" },
        fake.fetchImpl,
      ),
      (error: unknown) => {
        assert.ok(error instanceof GoogleDriveProviderError);
        assert.equal(error.code, "provider-error");
        assert.equal(error.operation, "authorization-code-exchange");
        assert.equal(error.status, 400);
        assert.equal(error.reason, "invalid_grant");
        assert.equal(error.retryable, false);
        const serialized = `${String(error)} ${JSON.stringify(error)}`;
        assert.equal(serialized.includes(leakedProse), false);
        assert.equal(serialized.includes(REFRESH_TOKEN), false);
        assert.equal(serialized.includes(CLIENT.clientSecret), false);
        return true;
      },
    );
  });

  it("keeps bounded Drive reason codes and retry classification", async () => {
    const providerMessage = `provider copied ${ACCESS_TOKEN} into prose`;
    const fake = queuedFetch(
      jsonResponse(
        {
          error: {
            code: 429,
            message: providerMessage,
            errors: [{ reason: "rateLimitExceeded", message: providerMessage }],
          },
        },
        429,
      ),
    );

    await assert.rejects(
      getGoogleDriveFile(ACCESS_TOKEN, "file-123", fake.fetchImpl),
      (error: unknown) => {
        assert.ok(error instanceof GoogleDriveProviderError);
        assert.equal(error.reason, "rateLimitExceeded");
        assert.equal(error.status, 429);
        assert.equal(error.retryable, true);
        assert.equal(String(error).includes(providerMessage), false);
        assert.equal(String(error).includes(ACCESS_TOKEN), false);
        return true;
      },
    );
  });

  it("discards credential-bearing network errors", async () => {
    const unsafeNetworkMessage =
      `request failed at https://example.test?access_token=${ACCESS_TOKEN}`;
    const fake = queuedFetch(new Error(unsafeNetworkMessage));

    await assert.rejects(
      getGoogleDriveAbout(ACCESS_TOKEN, fake.fetchImpl),
      (error: unknown) => {
        assert.ok(error instanceof GoogleDriveProviderError);
        assert.equal(error.code, "network-error");
        assert.equal(error.operation, "about-get");
        assert.equal(error.status, null);
        assert.equal(error.reason, null);
        assert.equal(error.retryable, true);
        assert.equal(String(error).includes(unsafeNetworkMessage), false);
        assert.equal(String(error).includes(ACCESS_TOKEN), false);
        assert.equal("cause" in error, false);
        return true;
      },
    );
  });

  it("rejects a malformed about response without inventing an identity", async () => {
    const fake = queuedFetch(
      jsonResponse({
        user: { emailAddress: "owner@example.com" },
        storageQuota: {},
      }),
    );

    await assert.rejects(
      getGoogleDriveAbout(ACCESS_TOKEN, fake.fetchImpl),
      (error: unknown) => {
        assert.ok(error instanceof GoogleDriveProviderError);
        assert.equal(error.code, "malformed-response");
        assert.equal(error.operation, "about-get");
        return true;
      },
    );
  });

  it("uses one canonical, row-bound refresh-token context", () => {
    assert.equal(
      providerConnectionTokenContext("connection-123"),
      "provider_connection:connection-123",
    );
    for (const invalid of ["", " connection-123", "connection-123 ", "a\nb", "x".repeat(513)]) {
      assert.throws(() => providerConnectionTokenContext(invalid));
    }
  });
});
