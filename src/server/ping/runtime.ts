import "server-only";
import { createClient } from "@libsql/client";
import { auth } from "@clerk/nextjs/server";
import { realpath } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, relative, isAbsolute } from "node:path";
import { fileURLToPath } from "node:url";
import { isDemoMode } from "@/lib/access-mode";
import { createLocalConversationDatabaseAdapter } from "@/server/conversations/database";
import { createPingTypedSession, type PingTypedActor } from "./typed-session";

export const PING_TYPED_FIXTURE_KEY = "ping:synthetic-typed-runtime";
export const PING_TYPED_FIXTURE_VALUE = "ping.typed.fixture.v1";
type Runtime = { target: string; session: ReturnType<typeof createPingTypedSession>;
  resolveActor: (clerkId: string) => Promise<string | null> };
const globalRuntime = globalThis as typeof globalThis & { pingTypedRuntime?: Promise<Runtime | null>; pingTypedTarget?: string };

/** Local fixture opt-in only. No ambient/default/remote/hosted/demo target. */
export function pingTypedTarget(env: Record<string, string | undefined>, demo: boolean): string | null {
  if (demo || env.VERCEL === "1" || env.PING_TYPED_ENABLED !== "1" || !env.PING_TYPED_DATABASE_URL ||
    env.PING_TYPED_DATABASE_URL !== env.TASKS_DATABASE_URL || !env.PING_TYPED_DATABASE_URL.startsWith("file:///")) return null;
  try { fileURLToPath(env.PING_TYPED_DATABASE_URL); return env.PING_TYPED_DATABASE_URL; } catch { return null; }
}
async function construct(target: string): Promise<Runtime | null> {
  let client: ReturnType<typeof createClient> | undefined;
  try {
    const root = await realpath(tmpdir()), file = await realpath(fileURLToPath(target));
    const rel = relative(root, file);
    if (isAbsolute(rel) || rel === ".." || rel.startsWith("..\\") || rel.startsWith("../") ||
      basename(file) !== "synthetic.db" || !/^signal-ping-proof-[^\\/]+$/.test(basename(dirname(file)))) return null;
    client = createClient({ url: target });
    const marker = (await client.execute({ sql: "SELECT value FROM meta WHERE key=?", args: [PING_TYPED_FIXTURE_KEY] })).rows[0];
    if (marker?.value !== PING_TYPED_FIXTURE_VALUE) { client.close(); return null; }
    await client.execute("PRAGMA foreign_keys=ON");
    if (Number((await client.execute("PRAGMA foreign_keys")).rows[0]?.foreign_keys) !== 1) { client.close(); return null; }
    const adapter = createLocalConversationDatabaseAdapter({ client });
    return { target, session: createPingTypedSession(adapter), resolveActor: (clerkId) => adapter.transaction("read", async (tx) => {
      const rows = (await tx.execute({ sql: "SELECT id FROM users WHERE clerk_id=? LIMIT 2", args: [clerkId] })).rows;
      return rows.length === 1 && typeof rows[0].id === "string" ? rows[0].id : null;
    }) };
  } catch { client?.close(); return null; }
}
async function runtime(): Promise<Runtime | null> {
  const target = pingTypedTarget(process.env, isDemoMode());
  if (!target) return null;
  if (globalRuntime.pingTypedTarget && globalRuntime.pingTypedTarget !== target) return null;
  if (!globalRuntime.pingTypedRuntime) {
    globalRuntime.pingTypedTarget = target; globalRuntime.pingTypedRuntime = construct(target);
  }
  return globalRuntime.pingTypedRuntime;
}
/** No development fallback, provisioning, caller-supplied actor or different database mapping. */
export async function authenticatePingTypedActor(): Promise<PingTypedActor | null> {
  if (!pingTypedTarget(process.env, isDemoMode()) || !process.env.CLERK_SECRET_KEY ||
    !process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) return null;
  try {
    const session = await auth();
    if (!session.userId || !session.sessionId) return null;
    const instance = await runtime();
    const actorId = await instance?.resolveActor(session.userId);
    return actorId ? { actorId, sessionId: session.sessionId } : null;
  } catch { return null; }
}
export async function getPingTypedSession() { return (await runtime())?.session ?? null; }
