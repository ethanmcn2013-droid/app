import "server-only";
import { EventEmitter } from "node:events";

/**
 * In-process pubsub for realtime sync. Each mutation server action
 * emits `"tasks-changed"`; the `/api/events` SSE route subscribes
 * and fans out to every connected tab.
 *
 * Single-process only, production with multi-replica deployment
 * needs Redis pubsub (or Liveblocks / Yjs / Supabase Realtime).
 * This is the dev-time substrate; the API surface stays the same
 * when we swap the substrate.
 *
 * Stored on globalThis so HMR doesn't leak listeners across reloads.
 */
type Emitter = EventEmitter & {
  // Marker for type narrowing.
  _tasksEmitter?: true;
};

const g = globalThis as unknown as { _tasksEmitter?: Emitter };

export const tasksEvents: Emitter = (() => {
  if (g._tasksEmitter) return g._tasksEmitter;
  const e = new EventEmitter() as Emitter;
  e._tasksEmitter = true;
  e.setMaxListeners(50);
  g._tasksEmitter = e;
  return e;
})();

export type TasksChangedPayload = {
  /** Originating client's id, so they can ignore their own echo. */
  clientId?: string;
  /** Optional: the kind of mutation, for debugging. */
  kind?: string;
  ts: number;
};

export function emitTasksChanged(opts: Omit<TasksChangedPayload, "ts"> = {}) {
  tasksEvents.emit("tasks-changed", { ...opts, ts: Date.now() });
}
