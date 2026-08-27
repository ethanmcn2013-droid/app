import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { getCurrentUser } from "@/server/auth";
import { isDemoMode } from "@/lib/access-mode";
import {
  authorizeUploadClaim,
  type ClaimRefusal,
} from "@/server/attachments/client-upload";

// @vercel/blob and getCurrentUser both want Node.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Mints the one-pathname Vercel Blob token that lets a browser write an
 * attachment directly to the store.
 *
 * This route issues a credential, so it is an authorization boundary and
 * not a convenience. Everything it will allow is decided in
 * `authorizeUploadClaim` before `handleUpload` is given anything:
 * membership of the TASK's own Project (ADR 0001 §9), the tier's per-file
 * cap, the board's remaining quota, and the content-type allowlist. The
 * token then carries those limits, so the store refuses a browser that
 * ignores them.
 *
 * The pathname is OURS. `handleUpload` hands us the one the client asked
 * for and we ignore it: the token is issued for the pathname
 * `authorizeUploadClaim` composed from the proved workspace id, the task
 * id and a server-generated attachment id. A client cannot choose where
 * its bytes land, which is the same rule WP-5 states for Drive folders
 * one provider later.
 *
 * The upload is NOT finished when this route returns. `finalizeUpload`
 * in src/server/actions/attachment-uploads.ts re-authorizes and checks
 * the bytes before the row becomes real.
 */
export async function POST(request: Request): Promise<Response> {
  // Hard rule §2.10 — demo must never reach the real store or the real
  // database. It returns before the body is read, not after.
  if (isDemoMode()) {
    return refuse(403, "Attachments are read-only in demo and review mode");
  }

  let body: HandleUploadBody;
  try {
    body = (await request.json()) as HandleUploadBody;
  } catch {
    return refuse(400, "Malformed request");
  }

  const me = await getCurrentUser();

  try {
    const result = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (_clientPathname, clientPayload) => {
        const asked = parseClientPayload(clientPayload);
        if (!asked) throw new ClaimError("not-authorized", "no claim");

        const claim = await authorizeUploadClaim({
          taskId: asked.taskId,
          actorUserId: me,
          filename: asked.filename,
          declaredSize: asked.size,
          declaredContentType: asked.contentType,
        });
        if (!claim.ok) throw new ClaimError(claim.reason, claim.detail);

        return {
          allowedContentTypes: claim.claim.allowedContentTypes,
          maximumSizeInBytes: claim.claim.maximumSizeInBytes,
          // The pathname is fixed and must stay fixed: a random suffix
          // would make the returned URL unpredictable, and the finalize
          // step proves the blob is ours by comparing pathnames exactly.
          addRandomSuffix: false,
          // A second token for the same pathname must not be able to
          // replace bytes already accepted for a finalized attachment.
          allowOverwrite: false,
          // Handed back to the browser so it can name the claim at
          // finalize. It is an id we generated and already authorized —
          // it grants nothing on its own, and finalize re-proves it.
          tokenPayload: JSON.stringify({
            attachmentId: claim.claim.attachmentId,
            pathname: claim.claim.pathname,
          }),
        };
      },
      // Deliberately absent: Vercel's server-to-server completion callback
      // cannot reach a developer's machine, so making it the only place
      // an upload becomes real would give local and production two
      // different truths. The browser calls `finalizeUpload` instead, and
      // that action re-authorizes rather than trusting the call.
    });

    return Response.json(result);
  } catch (err) {
    if (err instanceof ClaimError) {
      return refuse(err.status, err.publicMessage);
    }
    return refuse(400, "Upload could not be started");
  }
}

/**
 * What the browser tells us it wants to upload. Every field is a claim
 * and is treated as one: the size and type only narrow what the token
 * will permit, and the filename is sanitized before it reaches a
 * pathname.
 */
function parseClientPayload(
  raw: string | null,
): { taskId: string; filename: string; size: number; contentType: string } | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const taskId = parsed.taskId;
    const filename = parsed.filename;
    const size = parsed.size;
    const contentType = parsed.contentType;
    if (typeof taskId !== "string" || taskId.length === 0) return null;
    if (typeof filename !== "string" || filename.length === 0) return null;
    if (typeof size !== "number" || !Number.isFinite(size)) return null;
    return {
      taskId,
      filename,
      size,
      contentType: typeof contentType === "string" ? contentType : "",
    };
  } catch {
    return null;
  }
}

/**
 * A refusal the browser can act on, without telling it anything it has
 * not already proved it may know. "not-authorized" is deliberately the
 * same answer for a task that does not exist and a task that is not
 * yours — an existence leak is a privacy defect (ADR 0001 §4).
 */
class ClaimError extends Error {
  readonly status: number;
  readonly publicMessage: string;

  constructor(reason: ClaimRefusal, detail: string) {
    super(`${reason}: ${detail}`);
    this.name = "ClaimError";
    switch (reason) {
      case "too-large":
        this.status = 413;
        this.publicMessage = "That file is larger than this plan allows.";
        break;
      case "over-quota":
        this.status = 507;
        this.publicMessage =
          "This project has run out of storage. Remove a file or upgrade.";
        break;
      case "type-not-allowed":
        this.status = 415;
        this.publicMessage = "That kind of file cannot be attached.";
        break;
      case "empty":
        this.status = 400;
        this.publicMessage = "That file is empty.";
        break;
      default:
        this.status = 404;
        this.publicMessage = "Not found";
    }
  }
}

function refuse(status: number, message: string): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}
