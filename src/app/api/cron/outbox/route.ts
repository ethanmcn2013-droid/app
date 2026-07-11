import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { listPendingOutbox, markOutboxDelivered, markOutboxFailed } from "@/server/db/outbox";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

type Consumer = { name: string; url: string };

function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  const header = req.headers.get("authorization") ?? "";
  if (!secret) return false;
  const expected = Buffer.from(`Bearer ${secret}`);
  const received = Buffer.from(header);
  return received.length === expected.length && timingSafeEqual(received, expected);
}

function consumers(): Consumer[] {
  try {
    const parsed = JSON.parse(process.env.SUITE_OUTBOX_CONSUMERS_JSON ?? "[]") as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((value) => {
      if (!value || typeof value !== "object") return [];
      const row = value as Record<string, unknown>;
      return typeof row.name === "string" && typeof row.url === "string"
        ? [{ name: row.name, url: row.url }] : [];
    });
  } catch {
    return [];
  }
}

export async function POST(req: Request) {
  if (!authorized(req)) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  const secret = process.env.OUTBOX_DELIVERY_SECRET;
  const targets = consumers();
  if (!secret || targets.length === 0) {
    return NextResponse.json({ ok: false, error: "outbox_not_configured" }, { status: 503 });
  }

  const pending = await listPendingOutbox(50);
  let delivered = 0;
  let failed = 0;
  for (const row of pending) {
    let envelope: Record<string, unknown>;
    try {
      envelope = {
        version: row.version,
        eventId: row.eventId,
        type: row.type,
        occurredAt: new Date(row.occurredAt).toISOString(),
        actorUserId: row.actorUserId ?? undefined,
        workspaceId: row.workspaceId ?? undefined,
        objectRef: row.objectRef ? JSON.parse(row.objectRef) : undefined,
        traceId: row.traceId,
        payload: JSON.parse(row.payload),
      };
    } catch (error) {
      await markOutboxFailed(row.eventId, `invalid outbox payload: ${String(error)}`);
      failed += 1;
      continue;
    }
    const body = JSON.stringify(envelope);
    const signature = createHmac("sha256", secret).update(body).digest("base64url");
    try {
      for (const target of targets) {
        const response = await fetch(target.url, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-signal-event-id": row.eventId,
            "x-signal-event-signature": signature,
          },
          body,
          signal: AbortSignal.timeout(2_000),
        });
        if (!response.ok) throw new Error(`${target.name}:${response.status}`);
      }
      await markOutboxDelivered(row.eventId);
      delivered += 1;
    } catch (error) {
      await markOutboxFailed(row.eventId, String(error));
      failed += 1;
    }
  }
  return NextResponse.json({ ok: failed === 0, pending: pending.length, delivered, failed });
}

export async function GET(req: Request) {
  return POST(req);
}
