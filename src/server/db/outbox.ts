import { asc, eq, isNull } from "drizzle-orm";
import { db } from "@/server/db";
import { suiteOutbox } from "./schema";
import type { SuiteOutboxEvent } from "./outbox-contract";

export async function appendOutboxEvent(event: SuiteOutboxEvent): Promise<void> {
  await db.insert(suiteOutbox).values({
    id: event.eventId,
    eventId: event.eventId,
    version: 1,
    type: event.type,
    actorUserId: event.actorUserId ?? null,
    workspaceId: event.workspaceId ?? null,
    objectRef: event.objectRef ? JSON.stringify(event.objectRef) : null,
    payload: JSON.stringify(event.payload),
    traceId: event.traceId,
    occurredAt: event.occurredAt ?? Date.now(),
    deliveredAt: null,
    attempts: 0,
    lastError: null,
  }).onConflictDoNothing({ target: suiteOutbox.eventId });
}

export async function listPendingOutbox(limit = 50) {
  return db.select().from(suiteOutbox)
    .where(isNull(suiteOutbox.deliveredAt))
    .orderBy(asc(suiteOutbox.occurredAt))
    .limit(Math.max(1, Math.min(limit, 200)));
}

export async function markOutboxDelivered(eventId: string): Promise<void> {
  await db.update(suiteOutbox)
    .set({ deliveredAt: Date.now(), lastError: null })
    .where(eq(suiteOutbox.eventId, eventId));
}

export async function markOutboxFailed(eventId: string, error: string): Promise<void> {
  await db.update(suiteOutbox)
    .set({ lastError: error.slice(0, 500) })
    .where(eq(suiteOutbox.eventId, eventId));
}
