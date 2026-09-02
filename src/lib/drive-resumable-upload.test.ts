import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  DriveResumableUploadError,
  GOOGLE_DRIVE_UPLOAD_CHUNK_BYTES,
  uploadToGoogleDriveResumableSession,
} from "./drive-resumable-upload";

const SESSION_URL =
  "https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&upload_id=session-123";

type FetchCall = Readonly<{ input: string | URL | Request; init?: RequestInit }>;

function response(status: number, range?: string): Response {
  return new Response(null, {
    status,
    ...(range ? { headers: { Range: range } } : {}),
  });
}

function completed(id = "file-123", status = 200): Response {
  return new Response(JSON.stringify({ id }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function queuedFetch(
  ...outcomes: Array<Response | Error | ((call: FetchCall) => Response)>
) {
  const calls: FetchCall[] = [];
  const fetchImpl = async (
    input: string | URL | Request,
    init?: RequestInit,
  ): Promise<Response> => {
    const call = { input, init };
    calls.push(call);
    const next = outcomes.shift();
    if (!next) throw new Error("unexpected fetch");
    if (next instanceof Error) throw next;
    return typeof next === "function" ? next(call) : next;
  };
  return { calls, fetchImpl };
}

function headers(call: FetchCall): Headers {
  return new Headers(call.init?.headers);
}

describe("Drive browser resumable upload", () => {
  it("sends a 9 MiB Blob as one 8 MiB chunk and one remainder", async () => {
    const total = 9 * 1024 * 1024;
    const fake = queuedFetch(
      response(308, `bytes=0-${GOOGLE_DRIVE_UPLOAD_CHUNK_BYTES - 1}`),
      completed(),
    );
    const progress: number[] = [];

    const result = await uploadToGoogleDriveResumableSession({
      sessionUrl: SESSION_URL,
      file: new Blob([new Uint8Array(total)]),
      fetchImpl: fake.fetchImpl,
      onProgress: (confirmed) => progress.push(confirmed),
    });

    assert.deepEqual(result, { kind: "complete", fileId: "file-123" });
    assert.equal(fake.calls.length, 2);
    assert.equal(
      headers(fake.calls[0]).get("Content-Range"),
      `bytes 0-${GOOGLE_DRIVE_UPLOAD_CHUNK_BYTES - 1}/${total}`,
    );
    assert.equal(
      headers(fake.calls[1]).get("Content-Range"),
      `bytes ${GOOGLE_DRIVE_UPLOAD_CHUNK_BYTES}-${total - 1}/${total}`,
    );
    assert.equal((fake.calls[0].init?.body as Blob).size, GOOGLE_DRIVE_UPLOAD_CHUNK_BYTES);
    assert.equal((fake.calls[1].init?.body as Blob).size, 1024 * 1024);
    assert.deepEqual(progress, [0, GOOGLE_DRIVE_UPLOAD_CHUNK_BYTES, total]);

    for (const call of fake.calls) {
      assert.equal(call.input, SESSION_URL);
      assert.equal(call.init?.credentials, "omit");
      assert.equal(call.init?.redirect, "error");
      assert.equal(call.init?.cache, "no-store");
      assert.equal(call.init?.referrerPolicy, "no-referrer");
      assert.equal(headers(call).has("Authorization"), false);
      assert.equal(headers(call).has("Content-Length"), false);
    }
  });

  it("resumes from the exact provider-confirmed partial acknowledgement", async () => {
    const total = 10 * 1024 * 1024;
    const partial = 4 * 1024 * 1024;
    const fake = queuedFetch(
      response(308, `bytes=0-${partial - 1}`),
      completed("file-partial"),
    );

    const result = await uploadToGoogleDriveResumableSession({
      sessionUrl: SESSION_URL,
      file: new Blob([new Uint8Array(total)]),
      fetchImpl: fake.fetchImpl,
    });

    assert.deepEqual(result, { kind: "complete", fileId: "file-partial" });
    assert.equal(
      headers(fake.calls[1]).get("Content-Range"),
      `bytes ${partial}-${total - 1}/${total}`,
    );
  });

  it("probes the same capability after an uncertain network result", async () => {
    const total = 9 * 1024 * 1024;
    const fake = queuedFetch(
      new Error("socket details that must not escape"),
      response(308, `bytes=0-${GOOGLE_DRIVE_UPLOAD_CHUNK_BYTES - 1}`),
      completed("file-after-probe"),
    );

    const result = await uploadToGoogleDriveResumableSession({
      sessionUrl: SESSION_URL,
      file: new Blob([new Uint8Array(total)]),
      fetchImpl: fake.fetchImpl,
    });

    assert.deepEqual(result, { kind: "complete", fileId: "file-after-probe" });
    assert.equal(fake.calls.length, 3);
    assert.equal(fake.calls[1].input, SESSION_URL);
    assert.equal(headers(fake.calls[1]).get("Content-Range"), `bytes */${total}`);
    assert.equal(fake.calls[1].init?.body, undefined);
  });

  it("pauses without an offset when both upload and status are ambiguous", async () => {
    const fake = queuedFetch(response(503), response(429));
    assert.deepEqual(
      await uploadToGoogleDriveResumableSession({
        sessionUrl: SESSION_URL,
        file: new Blob([new Uint8Array(1024)]),
        fetchImpl: fake.fetchImpl,
      }),
      { kind: "paused", reason: "ambiguous", nextOffset: null },
    );
  });

  it("reports only a confirmed provider 404 as expired", async () => {
    const direct = queuedFetch(response(404));
    assert.deepEqual(
      await uploadToGoogleDriveResumableSession({
        sessionUrl: SESSION_URL,
        file: new Blob([new Uint8Array(1024)]),
        fetchImpl: direct.fetchImpl,
      }),
      { kind: "expired" },
    );

    const afterUncertain = queuedFetch(new Error("network"), response(404));
    assert.deepEqual(
      await uploadToGoogleDriveResumableSession({
        sessionUrl: SESSION_URL,
        file: new Blob([new Uint8Array(1024)]),
        fetchImpl: afterUncertain.fetchImpl,
      }),
      { kind: "expired" },
    );
  });

  it("rejects untrusted capabilities and malformed provider acknowledgements", async () => {
    await assert.rejects(
      uploadToGoogleDriveResumableSession({
        sessionUrl:
          "https://evil.example/upload/drive/v3/files?uploadType=resumable&upload_id=x",
        file: new Blob(["x"]),
      }),
      /untrusted session URL/,
    );

    const malformed = queuedFetch(response(308, "bytes=10-20"));
    await assert.rejects(
      uploadToGoogleDriveResumableSession({
        sessionUrl: SESSION_URL,
        file: new Blob([new Uint8Array(1024)]),
        fetchImpl: malformed.fetchImpl,
      }),
      (error: unknown) =>
        error instanceof DriveResumableUploadError &&
        error.code === "malformed-response" &&
        !error.message.includes(SESSION_URL),
    );
  });

  it("aborts without treating cancellation as expiry or minting a new URI", async () => {
    const controller = new AbortController();
    controller.abort();
    const fake = queuedFetch(completed());

    assert.deepEqual(
      await uploadToGoogleDriveResumableSession({
        sessionUrl: SESSION_URL,
        file: new Blob([new Uint8Array(1024)]),
        signal: controller.signal,
        fetchImpl: fake.fetchImpl,
      }),
      { kind: "paused", reason: "aborted", nextOffset: 0 },
    );
    assert.equal(fake.calls.length, 0);
  });

  it("does not advance when Google acknowledges no new bytes", async () => {
    const fake = queuedFetch(response(308));
    assert.deepEqual(
      await uploadToGoogleDriveResumableSession({
        sessionUrl: SESSION_URL,
        file: new Blob([new Uint8Array(1024)]),
        fetchImpl: fake.fetchImpl,
      }),
      { kind: "paused", reason: "no-progress", nextOffset: 0 },
    );
  });
});
