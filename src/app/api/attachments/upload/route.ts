import { getCurrentUser } from "@/server/auth";
import { isDemoMode } from "@/lib/access-mode";
import {
  authorizeUploadClaim,
  type ClaimRefusal,
} from "@/server/attachments/client-upload";

// @vercel/blob and getCurrentUser both want Node.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** How long a browser has to start one upload with the signed authority. */
const UPLOAD_WINDOW_MS = 30 * 60 * 1000;

/**
 * Issues the presigned URL that lets a browser write one attachment
 * directly to the store.
 *
 * This route hands out a credential, so it is an authorization boundary
 * and not a convenience. Everything it will permit is decided in
 * `authorizeUploadClaim` before a URL is signed: membership of the TASK's
 * own Project (ADR 0001 §9), the plan's per-file cap, the board's
 * remaining quota, and the content-type allowlist.
 *
 * **The destination is ours.** The browser sends what it would like to
 * upload; the pathname it is signed for is composed by the server from
 * the workspace id it PROVED, the task id and a server-generated
 * attachment id. A client cannot choose where its bytes land — the same
 * rule WP-5 states for Drive folders, one provider later.
 *
 * **A presigned URL rather than a client token, deliberately.** The
 * `@vercel/blob/client` helper does the same job and costs 36.7 KB gzip in
 * every browser that loads the app, which breaches the bundle ratchet —
 * and that ratchet is a founder decision, not an edit. Presigning gives
 * the browser a bare `fetch(url, { method: "PUT" })` and no library at
 * all. It is also the stronger posture: `access: "private"` is signed into
 * the URL here, so the browser cannot ask for a public object, where the
 * client-token flow let it pass its own access mode.
 *
 * The trade is multipart. One `PUT` carries the whole file, so a dropped
 * connection restarts it rather than resuming a part. At a 50 MB ceiling
 * that is a worse minute, not a broken feature — and WP-6 moves large
 * files to Drive's own resumable sessions regardless.
 *
 * The upload is NOT finished when this route returns. `finalizeUpload` in
 * src/server/actions/attachment-uploads.ts re-authorizes and inspects what
 * actually landed before the row becomes real.
 */
export async function POST(request: Request): Promise<Response> {
  // Hard rule §2.10 — demo must never reach the real store or the real
  // database. It returns before the body is read, not after.
  if (isDemoMode()) {
    return refuse(403, "Attachments are read-only in demo and review mode");
  }

  let asked: AskedUpload | null;
  try {
    asked = parseAsk(await request.json());
  } catch {
    return refuse(400, "Malformed request");
  }
  if (!asked) return refuse(400, "Malformed request");

  const me = await getCurrentUser();
  // Choose the write authority's exact expiry before reserving the claim. The
  // same millisecond is persisted with the marker and signed into the provider
  // token, so deletion can distinguish live authority from abandoned work.
  const validUntil = Date.now() + UPLOAD_WINDOW_MS;

  const claim = await authorizeUploadClaim({
    taskId: asked.taskId,
    actorUserId: me,
    filename: asked.filename,
    declaredSize: asked.size,
    declaredContentType: asked.contentType,
    authorityExpiresAt: validUntil,
  });
  if (!claim.ok) return refuseClaim(claim.reason);

  let presignedUrl: string;
  try {
    const { issueSignedToken, presignUrl } = await import("@vercel/blob");
    // The delegation is scoped to this one pathname and to `put` alone. It
    // cannot read, cannot delete, and cannot address any other object.
    const signedToken = await issueSignedToken({
      pathname: claim.claim.pathname,
      operations: ["put"],
      validUntil,
    });
    const result = await presignUrl(signedToken, {
      operation: "put",
      pathname: claim.claim.pathname,
      access: "private",
      allowedContentTypes: claim.claim.allowedContentTypes,
      maximumSizeInBytes: claim.claim.maximumSizeInBytes,
      // The pathname must stay exactly what we signed: finalize proves the
      // blob is ours by comparing pathnames, and a random suffix would
      // make the result unpredictable.
      addRandomSuffix: false,
      // A second URL for the same pathname must not be able to replace
      // bytes already accepted for a finalized attachment.
      allowOverwrite: false,
      validUntil,
    });
    presignedUrl = result.presignedUrl;
  } catch {
    // The claim row was reserved above; nothing may be left holding quota
    // for an upload that was never authorized to begin.
    const { releaseUploadClaim } = await import(
      "@/server/attachments/client-upload"
    );
    await releaseUploadClaim(claim.claim.attachmentId, claim.claim.workspaceId);
    return refuse(503, "Storage is unavailable. Try again shortly.");
  }

  return Response.json(
    {
      attachmentId: claim.claim.attachmentId,
      pathname: claim.claim.pathname,
      uploadUrl: presignedUrl,
      contentType: asked.contentType,
      expiresAt: validUntil,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}

type AskedUpload = {
  taskId: string;
  filename: string;
  size: number;
  contentType: string;
};

/**
 * What the browser says it would like to upload. Every field is a claim
 * and is treated as one: the size and type only narrow what the signed URL
 * will permit, and the filename is sanitized before it reaches a pathname.
 */
function parseAsk(raw: unknown): AskedUpload | null {
  if (!raw || typeof raw !== "object") return null;
  const body = raw as Record<string, unknown>;
  const { taskId, filename, size, contentType } = body;
  if (typeof taskId !== "string" || taskId.length === 0) return null;
  if (typeof filename !== "string" || filename.length === 0) return null;
  if (typeof size !== "number" || !Number.isFinite(size)) return null;
  return {
    taskId,
    filename,
    size,
    contentType:
      typeof contentType === "string" && contentType.length > 0
        ? contentType
        : "application/octet-stream",
  };
}

/**
 * A refusal the browser can act on, without telling it anything it has not
 * already proved it may know. "not-authorized" is deliberately the same
 * answer for a task that does not exist and a task that is not yours — an
 * existence leak is a privacy defect (ADR 0001 §4).
 */
function refuseClaim(reason: ClaimRefusal): Response {
  switch (reason) {
    case "too-large":
      return refuse(413, "That file is larger than this plan allows.");
    case "over-quota":
      return refuse(
        507,
        "This project has run out of storage. Remove a file or upgrade.",
      );
    case "type-not-allowed":
      return refuse(415, "That kind of file cannot be attached.");
    case "empty":
      return refuse(400, "That file is empty.");
    default:
      return refuse(404, "Not found");
  }
}

function refuse(status: number, message: string): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}
