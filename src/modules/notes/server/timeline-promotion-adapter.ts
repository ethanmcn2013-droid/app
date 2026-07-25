import "server-only";

import { createHmac, randomUUID } from "node:crypto";
import type { TimelinePromotionCommand } from "@/modules/notes/lib/timeline-promotion";
import { APP_ORIGIN } from "@/lib/product-urls";

export type TimelinePromotionReceipt =
  | { status: "sent"; publicationId: string; url: string }
  | { status: "unavailable"; message: string };

export async function sendTimelinePromotionCommand(
  command: TimelinePromotionCommand,
  subject: string,
): Promise<TimelinePromotionReceipt> {
  const endpoint =
    process.env.TIMELINE_PROMOTION_API_URL?.trim() ??
    (process.env.VERCEL_ENV === "production"
      ? `${APP_ORIGIN}/api/internal/notes-timeline`
      : null);
  const secret = process.env.NOTES_TO_TIMELINE_SECRET;
  if (!endpoint || !secret) {
    return {
      status: "unavailable",
      message: "Timeline sharing is not available yet. Your note stays private.",
    };
  }

  const now = Math.floor(Date.now() / 1000);
  const claims = {
    v: 1,
    iss: "signal-notes",
    aud: "signal-timeline.note-projection",
    sub: subject,
    workspaceId: command.workspaceId,
    noteId: command.source.noteId,
    iat: now,
    exp: now + 120,
    jti: randomUUID(),
  };
  const encoded = Buffer.from(JSON.stringify(claims), "utf8").toString("base64url");
  const signature = createHmac("sha256", secret).update(encoded).digest("base64url");

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        authorization: `Bearer ${encoded}.${signature}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(command),
      cache: "no-store",
      signal: AbortSignal.timeout(5_000),
    });
    if (!response.ok) {
      return {
        status: "unavailable",
        message: "Timeline could not accept this preview. Your note stays private.",
      };
    }
    const value = (await response.json()) as Record<string, unknown>;
    if (typeof value.publicationId !== "string" || typeof value.url !== "string") {
      return {
        status: "unavailable",
        message: "Timeline returned an invalid receipt. Your note stays private.",
      };
    }
    return { status: "sent", publicationId: value.publicationId, url: value.url };
  } catch {
    return {
      status: "unavailable",
      message: "Timeline is unavailable right now. Your note stays private.",
    };
  }
}
