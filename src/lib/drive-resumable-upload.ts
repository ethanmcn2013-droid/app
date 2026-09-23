import {
  isTrustedGoogleDriveUploadSessionUrl,
  nextGoogleDriveUploadOffset,
} from "./drive-upload-session";

/** Google recommends chunks that are multiples of 256 KiB. */
export const GOOGLE_DRIVE_UPLOAD_CHUNK_BYTES = 8 * 1024 * 1024;

export type DriveResumableUploadPauseReason =
  | "aborted"
  | "ambiguous"
  | "no-progress"
  | "rejected";

export type DriveResumableUploadResult =
  | Readonly<{ kind: "complete"; fileId: string }>
  | Readonly<{ kind: "expired" }>
  | Readonly<{
      kind: "paused";
      reason: DriveResumableUploadPauseReason;
      /** Null means the provider could not confirm a durable byte offset. */
      nextOffset: number | null;
      /** A status code is safe to expose; provider response bodies are not. */
      status?: number;
    }>;

export class DriveResumableUploadError extends Error {
  readonly code: "malformed-response";

  constructor() {
    super("drive-upload: malformed provider response");
    this.name = "DriveResumableUploadError";
    this.code = "malformed-response";
  }
}

type UploadFetch = (
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<Response>;

export type DriveResumableUploadOptions = Readonly<{
  sessionUrl: string;
  file: Blob;
  startOffset?: number;
  signal?: AbortSignal;
  onProgress?: (confirmedBytes: number, totalBytes: number) => void;
  fetchImpl?: UploadFetch;
}>;

type ProbeResult =
  | Readonly<{ kind: "complete"; fileId: string }>
  | Readonly<{ kind: "expired" }>
  | Readonly<{ kind: "incomplete"; nextOffset: number }>
  | Readonly<{ kind: "ambiguous" }>
  | Readonly<{ kind: "rejected"; status: number }>;

function requestInit(
  totalBytes: number,
  signal: AbortSignal | undefined,
  body?: Blob,
  range?: string,
): RequestInit {
  return {
    method: "PUT",
    headers: {
      "Content-Range": range ?? `bytes */${totalBytes}`,
    },
    ...(body ? { body } : {}),
    ...(signal ? { signal } : {}),
    cache: "no-store",
    credentials: "omit",
    redirect: "error",
    referrerPolicy: "no-referrer",
  };
}

function isAbort(error: unknown, signal: AbortSignal | undefined): boolean {
  return Boolean(
    signal?.aborted ||
      (error instanceof DOMException && error.name === "AbortError") ||
      (error instanceof Error && error.name === "AbortError"),
  );
}

function isAmbiguousStatus(status: number): boolean {
  return status === 408 || status === 429 || status >= 500;
}

async function completedFileId(response: Response): Promise<string> {
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new DriveResumableUploadError();
  }
  if (
    typeof body !== "object" ||
    body === null ||
    !("id" in body) ||
    typeof body.id !== "string" ||
    body.id.length === 0
  ) {
    throw new DriveResumableUploadError();
  }
  return body.id;
}

async function probeSession(
  sessionUrl: string,
  totalBytes: number,
  signal: AbortSignal | undefined,
  fetchImpl: UploadFetch,
): Promise<ProbeResult> {
  let response: Response;
  try {
    response = await fetchImpl(
      sessionUrl,
      requestInit(totalBytes, signal),
    );
  } catch (error) {
    if (isAbort(error, signal)) throw error;
    return { kind: "ambiguous" };
  }

  if (response.status === 200 || response.status === 201) {
    return { kind: "complete", fileId: await completedFileId(response) };
  }
  if (response.status === 404) return { kind: "expired" };
  if (response.status === 308) {
    const nextOffset = nextGoogleDriveUploadOffset(
      response.headers.get("range"),
      totalBytes,
    );
    if (nextOffset === null) throw new DriveResumableUploadError();
    return { kind: "incomplete", nextOffset };
  }
  if (isAmbiguousStatus(response.status)) return { kind: "ambiguous" };
  return { kind: "rejected", status: response.status };
}

/**
 * Stream a Blob directly from the browser to a server-minted Drive session.
 *
 * The URI itself is the credential: this helper never adds OAuth headers,
 * never follows redirects and never exposes provider response bodies. Only a
 * confirmed 404 reports expiry; every uncertain outcome preserves the same
 * session for a later status probe.
 */
export async function uploadToGoogleDriveResumableSession({
  sessionUrl,
  file,
  startOffset = 0,
  signal,
  onProgress,
  fetchImpl = fetch,
}: DriveResumableUploadOptions): Promise<DriveResumableUploadResult> {
  if (!isTrustedGoogleDriveUploadSessionUrl(sessionUrl)) {
    throw new TypeError("drive-upload: untrusted session URL");
  }
  if (!Number.isSafeInteger(file.size)) {
    throw new TypeError("drive-upload: file size must be a safe integer");
  }
  if (
    !Number.isSafeInteger(startOffset) ||
    startOffset < 0 ||
    startOffset > file.size
  ) {
    throw new TypeError("drive-upload: invalid start offset");
  }
  if (signal?.aborted) {
    return { kind: "paused", reason: "aborted", nextOffset: startOffset };
  }

  let offset = startOffset;
  onProgress?.(offset, file.size);

  // A zero-byte upload has no data PUT. A status probe is still required to
  // distinguish provider completion from an expired or uncertain capability.
  if (file.size === 0 || offset === file.size) {
    try {
      const status = await probeSession(sessionUrl, file.size, signal, fetchImpl);
      if (status.kind === "complete" || status.kind === "expired") return status;
      if (status.kind === "incomplete") {
        return { kind: "paused", reason: "no-progress", nextOffset: status.nextOffset };
      }
      if (status.kind === "rejected") {
        return {
          kind: "paused",
          reason: "rejected",
          nextOffset: offset,
          status: status.status,
        };
      }
      return { kind: "paused", reason: "ambiguous", nextOffset: null };
    } catch (error) {
      if (isAbort(error, signal)) {
        return { kind: "paused", reason: "aborted", nextOffset: offset };
      }
      throw error;
    }
  }

  while (offset < file.size) {
    if (signal?.aborted) {
      return { kind: "paused", reason: "aborted", nextOffset: offset };
    }

    const endExclusive = Math.min(
      offset + GOOGLE_DRIVE_UPLOAD_CHUNK_BYTES,
      file.size,
    );
    const chunk = file.slice(offset, endExclusive, file.type);
    let response: Response | null = null;

    try {
      response = await fetchImpl(
        sessionUrl,
        requestInit(
          file.size,
          signal,
          chunk,
          `bytes ${offset}-${endExclusive - 1}/${file.size}`,
        ),
      );
    } catch (error) {
      if (isAbort(error, signal)) {
        return { kind: "paused", reason: "aborted", nextOffset: offset };
      }
    }

    if (response?.status === 200 || response?.status === 201) {
      onProgress?.(file.size, file.size);
      return { kind: "complete", fileId: await completedFileId(response) };
    }
    if (response?.status === 404) return { kind: "expired" };

    if (response?.status === 308) {
      const nextOffset = nextGoogleDriveUploadOffset(
        response.headers.get("range"),
        file.size,
      );
      if (nextOffset === null) throw new DriveResumableUploadError();
      if (nextOffset <= offset) {
        return { kind: "paused", reason: "no-progress", nextOffset };
      }
      offset = nextOffset;
      onProgress?.(offset, file.size);
      continue;
    }

    if (response && !isAmbiguousStatus(response.status)) {
      return {
        kind: "paused",
        reason: "rejected",
        nextOffset: offset,
        status: response.status,
      };
    }

    let status: ProbeResult;
    try {
      status = await probeSession(sessionUrl, file.size, signal, fetchImpl);
    } catch (error) {
      if (isAbort(error, signal)) {
        return { kind: "paused", reason: "aborted", nextOffset: offset };
      }
      throw error;
    }

    if (status.kind === "complete" || status.kind === "expired") return status;
    if (status.kind === "ambiguous") {
      return { kind: "paused", reason: "ambiguous", nextOffset: null };
    }
    if (status.kind === "rejected") {
      return {
        kind: "paused",
        reason: "rejected",
        nextOffset: offset,
        status: status.status,
      };
    }
    if (status.nextOffset <= offset) {
      return {
        kind: "paused",
        reason: "no-progress",
        nextOffset: status.nextOffset,
      };
    }
    offset = status.nextOffset;
    onProgress?.(offset, file.size);
  }

  // Google normally answers the final data PUT with 200/201. If it instead
  // acknowledges every byte with 308, ask the same session for its terminal
  // result rather than inventing a file id or minting a replacement.
  try {
    const status = await probeSession(sessionUrl, file.size, signal, fetchImpl);
    if (status.kind === "complete" || status.kind === "expired") return status;
    if (status.kind === "ambiguous") {
      return { kind: "paused", reason: "ambiguous", nextOffset: null };
    }
    if (status.kind === "rejected") {
      return {
        kind: "paused",
        reason: "rejected",
        nextOffset: offset,
        status: status.status,
      };
    }
    return {
      kind: "paused",
      reason: "no-progress",
      nextOffset: status.nextOffset,
    };
  } catch (error) {
    if (isAbort(error, signal)) {
      return { kind: "paused", reason: "aborted", nextOffset: offset };
    }
    throw error;
  }
}
