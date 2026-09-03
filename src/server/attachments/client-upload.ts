import "server-only";

import { and, eq } from "drizzle-orm";
import { db } from "@/server/db";
import { attachments, tasks } from "@/server/db/schema";
import { getEffectiveTier } from "@/server/db/entitlements";
import { getWorkspaceStorageUsage } from "@/server/actions/attachments";
import { getQuota } from "@/lib/storage-config";
import { MAX_UPLOAD_BYTES } from "@/lib/upload-limit";
import { allowedMimeTypes } from "@/lib/upload-validation";
import { scopeForTask } from "@/server/actions/project-authz";
import {
  claimPathname,
  newAttachmentId,
  safeFilename,
} from "@/lib/attachment-claim";
import {
  NativeUploadClaimStartError,
  recordNativeUploadClaimInTransaction,
  releaseNativeUploadClaimInTransaction,
} from "./native-upload-custody";

/**
 * The server half of the client-direct upload, kept out of the route file
 * and out of the "use server" file so both can call it and so it can be
 * read on its own.
 *
 * The shape is claim-then-verify, the same one `uploadAttachmentAction`
 * already uses and the same one WP-6 will use against Google Drive:
 *
 *   1. `authorizeUploadClaim` proves the caller on the TASK's own Project
 *      (ADR 0001 §9, object operation), resolves the tier, checks the
 *      quota, and inserts the claim row. Only then does the caller mint a
 *      Blob token — and that token is scoped to the one pathname this
 *      function chose, not one the browser asked for.
 *   2. The browser PUTs bytes straight to Vercel Blob. They never enter a
 *      function, which is the whole point: Vercel refuses a function body
 *      over 4.5 MB.
 *   3. `verifyUploadedBlob` re-authorizes, then proves the returned blob
 *      is the one we authorized, is not world-readable, and contains the
 *      bytes it claims to. A URL handed back by a browser is a claim, not
 *      evidence.
 *
 * A refusal before signing releases the claim atomically. Once a presigned
 * writer exists, its marker survives until expiry and any trusted rejected
 * bytes move into durable cleanup custody.
 */

export type UploadClaim = {
  attachmentId: string;
  workspaceId: string;
  taskId: string;
  filename: string;
  pathname: string;
  /** What the Blob token is allowed to accept. */
  maximumSizeInBytes: number;
  allowedContentTypes: string[];
};

export type ClaimRefusal =
  | "not-authorized"
  | "too-large"
  | "empty"
  | "type-not-allowed"
  | "over-quota";

export type ClaimResult =
  | { ok: true; claim: UploadClaim }
  | { ok: false; reason: ClaimRefusal; detail: string };

/**
 * Prove the caller, reserve the row, and describe exactly what the Blob
 * token may be issued for.
 *
 * `declaredContentType` is a client string and is treated as one: it only
 * narrows what the token will accept. The verdict on what the file
 * actually is comes from its own bytes in `verifyUploadedBlob`.
 */
export async function authorizeUploadClaim(input: {
  taskId: string;
  actorUserId: string;
  filename: string;
  declaredSize: number;
  declaredContentType: string;
  authorityExpiresAt: number;
}): Promise<ClaimResult> {
  const { taskId, actorUserId } = input;

  // ADR 0001 §9, object operation. The upload names the task it attaches
  // to, so that task's Project decides — and it decides BEFORE the quota
  // read, because the workspace id is not a filter here: it is spliced
  // into the storage pathname the token is then locked to. A wrong id
  // would file real bytes under another Project's prefix.
  const scope = await scopeForTask(taskId, actorUserId);
  if (!scope.ok) {
    return { ok: false, reason: "not-authorized", detail: "task not found" };
  }
  const ws = scope.ws;

  // The task's own row must agree with the Project just proved, or the
  // two disagree and nothing is reserved.
  const [parent] = await db
    .select({ workspaceId: tasks.workspaceId })
    .from(tasks)
    .where(eq(tasks.id, taskId));
  if (!parent || parent.workspaceId !== ws) {
    return { ok: false, reason: "not-authorized", detail: "task not found" };
  }

  if (!Number.isFinite(input.declaredSize) || input.declaredSize <= 0) {
    return { ok: false, reason: "empty", detail: "no bytes declared" };
  }

  const tier = await getEffectiveTier(actorUserId, ws);
  const quota = getQuota(tier);
  const effectiveCap = Math.min(quota.maxFileBytes, MAX_UPLOAD_BYTES);
  if (input.declaredSize > effectiveCap) {
    return {
      ok: false,
      reason: "too-large",
      detail: `${input.declaredSize} exceeds ${effectiveCap}`,
    };
  }

  const allowed = allowedMimeTypes();
  const declared = input.declaredContentType || "application/octet-stream";
  if (!allowed.includes(declared)) {
    return { ok: false, reason: "type-not-allowed", detail: declared };
  }

  const attachmentId = newAttachmentId();
  const filename = safeFilename(input.filename);
  const pathname = claimPathname(ws, taskId, attachmentId, filename);

  // Insert the quota row and its exact write-authority marker together behind
  // the Project deletion tombstone. The presign route chose the expiry before
  // entering here and will use this same value in the provider token.
  try {
    await db.transaction(
      async (transaction) => {
        const [freshParent] = await transaction
          .select({ workspaceId: tasks.workspaceId })
          .from(tasks)
          .where(and(eq(tasks.id, taskId), eq(tasks.workspaceId, ws)))
          .limit(1);
        if (!freshParent) {
          throw new Error("native upload parent changed");
        }
        const inserted = await transaction
          .insert(attachments)
          .values({
            id: attachmentId,
            workspaceId: ws,
            taskId,
            uploaderUserId: actorUserId,
            filename,
            storedPath: pathname,
            mimeType: declared,
            sizeBytes: input.declaredSize,
            createdAt: new Date(),
          })
          .returning({ id: attachments.id });
        if (inserted.length !== 1) {
          throw new Error("native upload claim was not persisted");
        }
        await recordNativeUploadClaimInTransaction(transaction, {
          workspaceId: ws,
          attachmentId,
          pathname,
          authorityExpiresAt: input.authorityExpiresAt,
          cleanupTargetKind: "blob-pathname",
        });
      },
      { behavior: "immediate" },
    );
  } catch (error) {
    if (error instanceof NativeUploadClaimStartError) {
      return {
        ok: false,
        reason: "not-authorized",
        detail: "task not found",
      };
    }
    throw error;
  }

  const usageAfterClaim = await getWorkspaceStorageUsage(ws);
  if (usageAfterClaim > quota.totalBytes) {
    await releaseUploadClaim(attachmentId, ws);
    return {
      ok: false,
      reason: "over-quota",
      detail: `${usageAfterClaim} over ${quota.totalBytes}`,
    };
  }

  return {
    ok: true,
    claim: {
      attachmentId,
      workspaceId: ws,
      taskId,
      filename,
      pathname,
      // The token carries the cap too, so a browser that ignores its own
      // pre-flight check is refused by the store rather than by us.
      maximumSizeInBytes: effectiveCap,
      allowedContentTypes: allowed,
    },
  };
}

/** Remove a claim whose upload never completed. Safe to call twice. */
export async function releaseUploadClaim(
  attachmentId: string,
  workspaceId: string,
): Promise<void> {
  await db.transaction(
    (transaction) =>
      releaseNativeUploadClaimInTransaction(transaction, {
        attachmentId,
        workspaceId,
      }),
    { behavior: "immediate" },
  );
}
