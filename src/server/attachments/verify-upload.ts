import "server-only";

import { SNIFF_BYTES, validateUpload } from "@/lib/upload-validation";
import { MAX_UPLOAD_BYTES } from "@/lib/upload-limit";

/**
 * What the server checks about a blob the browser says it just wrote.
 *
 * The client-direct upload buys us the 4.5 MB platform cap, and it costs
 * us the thing the old server action got for free: the bytes passing
 * through our hands. Three properties `uploadAttachmentAction` could
 * simply observe now have to be re-established after the fact, and each
 * is a check the caller must not be able to skip.
 *
 * WP-6 will do exactly this against Drive (`files.get`, then compare
 * `appProperties.signalResourceId` and `parents`). This is the same rule
 * one provider earlier: a file id handed back by a browser is a claim.
 */

export type BlobVerdict =
  | { ok: true; mimeType: string; sizeBytes: number }
  | { ok: false; reason: BlobRefusal; detail: string };

export type BlobRefusal =
  /** The blob is not at the pathname the token was issued for. */
  | "pathname-mismatch"
  /** An anonymous request could read it. */
  | "world-readable"
  /** Larger than the claim, or larger than the ceiling. */
  | "size-mismatch"
  /** The bytes are not what the type says they are. */
  | "content-rejected"
  /** The blob is not there at all. */
  | "missing";

/**
 * Does the URL the browser returned actually point at the pathname we
 * issued a token for?
 *
 * A Vercel Blob URL is `https://<store>.public.blob.vercel-storage.com/<pathname>`
 * or its private equivalent. The token is minted for one pathname and the
 * store enforces that, so a mismatch means the browser is describing a
 * *different* object — one it may have written under some other token, or
 * one belonging to another board. Either way it is not this claim's blob
 * and must not be recorded as it.
 */
export function pathnameMatchesClaim(
  blobUrl: string,
  expectedPathname: string,
): boolean {
  let parsed: URL;
  try {
    parsed = new URL(blobUrl);
  } catch {
    return false;
  }
  if (parsed.protocol !== "https:") return false;
  // decodeURIComponent so an escaped separator cannot smuggle a prefix.
  let actual: string;
  try {
    actual = decodeURIComponent(parsed.pathname.replace(/^\//, ""));
  } catch {
    return false;
  }
  return actual === expectedPathname;
}

/**
 * Can somebody with no credentials read this?
 *
 * The Blob client token constrains the pathname, the size and the content
 * types — but NOT the access mode, which the browser passes on its own
 * (`access: 'private' | 'public'`). So a modified client could write our
 * board's attachment as a public object at a pathname we already know,
 * and nothing in the token would stop it.
 *
 * There is no field on the blob metadata that reports the access mode, so
 * this does not ask: it tries. An unauthenticated HEAD that succeeds is
 * the property we actually care about, observed directly rather than
 * inferred from a flag.
 */
export async function isWorldReadable(blobUrl: string): Promise<boolean> {
  try {
    const res = await fetch(blobUrl, {
      method: "HEAD",
      redirect: "follow",
      cache: "no-store",
    });
    return res.ok;
  } catch {
    // A network failure is not evidence that it is private. It is also not
    // evidence that it is public, and refusing an upload because our own
    // egress hiccuped would be worse than the risk. Treated as not-public,
    // deliberately, and recorded here so the choice is visible.
    return false;
  }
}

/**
 * Read the leading bytes back out of the store and put them through the
 * same allowlist the server action uses.
 *
 * `openLeadingBytes` is injected so the contract test can drive this
 * without a store. In production it is `get()` from `@vercel/blob`.
 */
export async function verifyBlobContents(input: {
  declaredMimeType: string;
  declaredSize: number;
  claimedSize: number;
  openLeadingBytes: () => Promise<Uint8Array | null>;
}): Promise<BlobVerdict> {
  if (input.claimedSize > MAX_UPLOAD_BYTES) {
    return {
      ok: false,
      reason: "size-mismatch",
      detail: `${input.claimedSize} over ceiling ${MAX_UPLOAD_BYTES}`,
    };
  }
  // The store's own byte count is the authority. A browser that declared
  // one size and wrote another has told us something untrue, and the row
  // must not keep the number it liked better — the quota is summed from
  // that column.
  if (input.claimedSize !== input.declaredSize) {
    return {
      ok: false,
      reason: "size-mismatch",
      detail: `declared ${input.declaredSize}, stored ${input.claimedSize}`,
    };
  }

  const head = await input.openLeadingBytes();
  if (!head || head.length === 0) {
    return { ok: false, reason: "missing", detail: "no bytes readable" };
  }

  const verdict = validateUpload(
    input.declaredMimeType || "application/octet-stream",
    Buffer.from(head.subarray(0, SNIFF_BYTES)),
    input.claimedSize,
  );
  if (!verdict.ok) {
    return {
      ok: false,
      reason: "content-rejected",
      detail: `${verdict.reason}: ${verdict.detail}`,
    };
  }

  return { ok: true, mimeType: verdict.mimeType, sizeBytes: input.claimedSize };
}
