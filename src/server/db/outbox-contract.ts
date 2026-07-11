import { randomUUID } from "node:crypto";

export type SuiteOutboxEvent = Readonly<{
  eventId: string;
  type: string;
  actorUserId?: string;
  workspaceId?: string;
  objectRef?: Record<string, unknown>;
  payload: Record<string, unknown>;
  traceId: string;
  occurredAt?: number;
}>;

export function createOutboxEvent(input: Omit<SuiteOutboxEvent, "eventId" | "traceId" | "occurredAt"> & { eventId?: string; traceId?: string; occurredAt?: number }): SuiteOutboxEvent {
  if (!input.type.trim()) throw new TypeError("outbox event type is required");
  if (!input.workspaceId?.trim()) throw new TypeError("outbox workspaceId is required");
  return {
    ...input,
    eventId: input.eventId ?? randomUUID(),
    traceId: input.traceId ?? randomUUID(),
    occurredAt: input.occurredAt ?? Date.now(),
  };
}
