/** Exact origin and path Google returns for a resumable Drive upload. */
export const GOOGLE_DRIVE_UPLOAD_ORIGIN = "https://www.googleapis.com";
const GOOGLE_DRIVE_UPLOAD_PATH = ["", "upload", "drive", "v3", "files"].join(
  "/",
);

/**
 * A resumable URI is a bearer capability. Refuse redirects, credentials,
 * alternate ports and lookalike paths before either server or browser uses it.
 */
export function isTrustedGoogleDriveUploadSessionUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return (
      url.origin === GOOGLE_DRIVE_UPLOAD_ORIGIN &&
      url.username === "" &&
      url.password === "" &&
      url.pathname === GOOGLE_DRIVE_UPLOAD_PATH &&
      url.searchParams.get("uploadType") === "resumable" &&
      Boolean(url.searchParams.get("upload_id"))
    );
  } catch {
    return false;
  }
}

/**
 * Convert Google's inclusive `Range: bytes=0-N` acknowledgement into the next
 * byte offset. A missing header means Google has durably accepted no bytes.
 */
export function nextGoogleDriveUploadOffset(
  range: string | null,
  totalBytes: number,
): number | null {
  if (!Number.isSafeInteger(totalBytes) || totalBytes < 0) return null;
  if (range === null) return 0;
  const match = /^bytes=0-(\d+)$/.exec(range.trim());
  const lastByte = match ? Number(match[1]) : Number.NaN;
  if (
    !Number.isSafeInteger(lastByte) ||
    lastByte < 0 ||
    lastByte >= totalBytes
  ) {
    return null;
  }
  return lastByte + 1;
}
