import "server-only";
import { createClient } from "@libsql/client";
import { createHash } from "node:crypto";
import { auth } from "@clerk/nextjs/server";
import { isDemoMode } from "@/lib/access-mode";
import { resolveConversationRuntimeTarget } from "@/server/conversations/runtime-target";
import { createRemoteConversationDatabaseAdapter, type ConversationTransactionalClient } from "@/server/conversations/database";
import { createPingTypedSession } from "./typed-session";
import { createPingCommandService } from "./command-service";
import { pingNewWorkAllowed } from "./runtime";

type Env = Readonly<Record<string, string | undefined>>;
/** Separate admission from the disposable fixture; no ambient target or local fallback. */
export function maintainedPingTarget(env: Env, demo: boolean) {
  if (env.PING_MAINTAINED_TYPED_ENABLED !== "1" || demo ||
      !env.CLERK_SECRET_KEY || !env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) return null;
  const target = resolveConversationRuntimeTarget({ TASKS_DATABASE_URL: env.TASKS_DATABASE_URL,
    TASKS_AUTH_TOKEN: env.TASKS_AUTH_TOKEN, SIGNAL_CONVERSATION_INTERNAL_ENABLED: "true",
    SIGNAL_CONVERSATION_DATABASE_MODE: "remote", SIGNAL_CONVERSATION_REMOTE_ENABLED: "true",
    SIGNAL_CONVERSATION_REMOTE_TARGET: env.PING_MAINTAINED_TYPED_TARGET,
    SIGNAL_CONVERSATION_REMOTE_URL_SHA256: env.PING_MAINTAINED_TYPED_URL_SHA256 }, false);
  return target.mode === "remote" ? { ...target, cacheKey: `${target.cacheKey}:auth:${createHash("sha256")
    .update(JSON.stringify([env.CLERK_SECRET_KEY, env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY])).digest("hex")}` } : null;
}

/** Injected boundaries are local test seams, never authentication evidence. */
export function createMaintainedPingRuntime(deps: {
  env: () => Env; demo: () => boolean;
  authenticate: () => Promise<{ userId: string | null; sessionId: string | null }>;
  client: (target: { url: string; authToken: string }) => ConversationTransactionalClient;
}) {
  let cached: { key: string; session: ReturnType<typeof createPingTypedSession>;
    service: ReturnType<typeof createPingCommandService>; resolveActor: (id: string) => Promise<string | null> } | null = null;
  const current = () => maintainedPingTarget(deps.env(), deps.demo());
  function instance() {
    const target = current();
    if (!target || (cached && cached.key !== target.cacheKey)) return null;
    if (!cached) {
      const adapter = createRemoteConversationDatabaseAdapter({ client: deps.client(target) });
      if (!adapter.available) return null;
      const key = target.cacheKey;
      cached = { key, session: createPingTypedSession(adapter, { allowRemoteTyped: true, isNewWorkAllowed: () =>
        current()?.cacheKey === key && pingNewWorkAllowed(deps.env()) }), service: createPingCommandService(adapter),
      resolveActor: id => adapter.transaction("read", async tx => {
        const rows = (await tx.execute({ sql: "SELECT id FROM users WHERE clerk_id=? LIMIT 2", args: [id] })).rows;
        return rows.length === 1 && typeof rows[0].id === "string" ? rows[0].id : null;
      }) };
    }
    return cached;
  }
  return {
    async authenticate() {
      try {
        if (!current()) return null;
        const actor = await deps.authenticate();
        if (!actor.userId || !actor.sessionId) return null;
        const runtime = instance();
        const actorId = await runtime?.resolveActor(actor.userId);
        return actorId && current()?.cacheKey === runtime?.key ? { actorId, sessionId: actor.sessionId } : null;
      } catch { return null; }
    },
    async session() { try { return instance()?.session ?? null; } catch { return null; } },
    async receipt(actorId: string, commandId: string, projectId: string) {
      try {
        const runtime = instance();
        if (!runtime) return null;
        const found = await runtime.service.getReceipt({ actorId, commandId });
        if (current()?.cacheKey !== runtime.key || !found.ok || found.state !== "committed" ||
            found.receipt.projectId !== projectId || found.receipt.commandId !== commandId) return null;
        return found.receipt;
      } catch { return null; }
    },
  };
}

const maintained = createMaintainedPingRuntime({ env: () => process.env, demo: isDemoMode,
  authenticate: async () => { const session = await auth(); return { userId: session.userId, sessionId: session.sessionId }; },
  client: target => {
    const client = createClient(target);
    return { transaction: async mode => {
      const tx = await client.transaction(mode);
      return { execute: statement => tx.execute(typeof statement === "string" ? statement :
        { sql: statement.sql, args: [...(statement.args ?? [])] }), commit: () => tx.commit(), rollback: () => tx.rollback() };
    } };
  } });
export const authenticateMaintainedPingActor = maintained.authenticate;
export const getMaintainedPingSession = maintained.session;
export const getMaintainedPingReceipt = maintained.receipt;
