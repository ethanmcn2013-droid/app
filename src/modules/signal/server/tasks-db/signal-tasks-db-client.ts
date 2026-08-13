import { drizzle, type LibSQLDatabase } from "drizzle-orm/libsql";
import { createClient, type Client } from "@libsql/client";
import * as schema from "./signal-tasks-db-schema";

/**
 * libSQL client for the Signal Tasks Turso DB, READ-ONLY.
 *
 * The Turso auth token used here is scoped read-only on the Tasks DB
 * (created via `turso db tokens create ethanmcnamara-tasks --read-only`).
 * If a query tries to write, the token rejects it. Defense in depth on
 * top of the fact that Analytics has no write paths against this DB.
 *
 * Lazy-initialized on first import so the marketing build still passes
 * when the env vars aren't set in dev.
 */

export const tasksDbConfigured = Boolean(process.env.TASKS_DATABASE_URL);

export type TasksDb = LibSQLDatabase<typeof schema>;

let database: TasksDb | null | undefined;
let rawClient: Client | null | undefined;

export function getTasksClient(): Client | null {
  if (rawClient !== undefined) return rawClient;
  const url = process.env.TASKS_DATABASE_URL;
  rawClient = url
    ? createClient({ url, authToken: process.env.TASKS_AUTH_TOKEN })
    : null;
  return rawClient;
}

/**
 * Resolve the read-only Tasks client at request time.
 *
 * Keeping client construction out of module evaluation lets `next build` and
 * marketing-only processes load this module without production credentials.
 * It also prevents a changed test environment from retaining a client created
 * with a previous URL.
 */
export function getTasksDb(): TasksDb | null {
  if (database !== undefined) return database;

  const client = getTasksClient();
  if (!client) {
    database = null;
    return database;
  }
  database = drizzle(client, { schema });
  return database;
}
