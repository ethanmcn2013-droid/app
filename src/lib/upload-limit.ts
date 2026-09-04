/**
 * The upload size limits, in one place, with no imports.
 *
 * ── Why this file exists ─────────────────────────────────────────────
 *
 * Before WP-0 the product carried five different answers to "how big a
 * file can I attach?", and none of them was true:
 *
 *   next.config.ts  serverActions.bodySizeLimit   8 MB
 *   storage-config  SERVER_UPLOAD_LIMIT_BYTES    50 MB
 *   storage-config  free tier maxFileBytes       10 MB
 *   resources-section.tsx  MAX_BYTES + its toast 50 MB
 *   Vercel          function request body cap     4.5 MB   ← binding
 *
 * The fifth is the one nobody had written down. Vercel refuses a request
 * body over 4.5 MB with `413 FUNCTION_PAYLOAD_TOO_LARGE` before the
 * framework or our code sees it, so `bodySizeLimit: "8mb"` was
 * unreachable and every number above it was a promise the platform would
 * not keep. A 5 MB PDF could not be attached at all.
 *
 * WP-0's answer is not to pick the smallest number. It is to stop sending
 * bytes through a function: `uploadAttachmentClientDirect` in
 * resources-section.tsx asks the server for a scoped, single-pathname
 * Vercel Blob token and PUTs the bytes straight to the store. Nothing but
 * metadata crosses a server action, so the 4.5 MB cap stops applying and
 * 50 MB becomes a number we can actually honour.
 *
 * This file has NO imports on purpose. `next.config.ts` imports it at
 * build time, a "use client" component imports it in the browser, and
 * server code imports it under `server-only` siblings. Anything imported
 * here would have to be safe in all three, so nothing is.
 *
 * SINGLE SOURCE: no byte count for an upload limit may appear anywhere
 * else. `src/server/upload-limit-contract.test.ts` fails the build if one
 * does.
 */

const MB = 1024 * 1024;

/**
 * The largest file the product accepts, on any tier, through the
 * client-direct path. Enforced in three places, all reading this
 * constant: the Blob client token's `maximumSizeInBytes`, the claim the
 * server accepts before minting that token, and the browser's own
 * pre-flight check.
 *
 * WP-6 lifts this for boards backed by Google Drive. Until then this is
 * the ceiling.
 */
export const MAX_UPLOAD_BYTES = 50 * MB;

/**
 * Vercel's hard cap on a function's request *or* response body. Not ours
 * and not configurable — a body above it is refused by the platform with
 * `413 FUNCTION_PAYLOAD_TOO_LARGE`.
 *
 * https://vercel.com/docs/functions/limitations#request-body-size
 * Observed 2026-08-27 against the live document (last_updated 2026-08-24).
 *
 * Recorded here so the contract test can assert that no limit we choose
 * for a body that crosses a function ever exceeds it again.
 */
export const PLATFORM_FUNCTION_BODY_CAP_BYTES = Math.floor(4.5 * MB);

/**
 * `experimental.serverActions.bodySizeLimit`.
 *
 * Attachment bytes no longer travel this way, so this budget now serves
 * only the remaining small bodies — chiefly Notes photo capture, which
 * base64-encodes an image into a server action and inflates it by about
 * 1.37x.
 *
 * It is set BELOW the platform cap deliberately. A body over this gets a
 * framework error naming the limit; a body over 4.5 MB gets an opaque
 * platform 413 with nothing to read. Failing on our own line, first, is
 * the difference between a diagnosable error and a mystery. The previous
 * value of 8 MB sat above the cap and therefore never fired at all.
 */
export const SERVER_ACTION_BODY_LIMIT_BYTES = 4 * MB;

/** The same value in the string form `next.config.ts` wants. */
export const SERVER_ACTION_BODY_LIMIT = "4mb";

/**
 * What a server action can still accept as a file, once multipart framing
 * and the other form fields are allowed for. Used by the legacy
 * `uploadAttachmentAction`, which remains the path for local-disk
 * deployments and for any caller that has not moved to the client-direct
 * flow.
 */
export const SERVER_ACTION_FILE_LIMIT_BYTES = 3 * MB;

/**
 * Render a limit the way a person says it: "50 MB", "3 MB". Whole
 * megabytes only, because every limit here is one.
 */
export function formatUploadLimit(bytes: number): string {
  return `${Math.round(bytes / MB)} MB`;
}
