import { createHash } from "node:crypto";

export type AssistantEnvironment = Readonly<Record<string, string | undefined>>;
/** Explicit target and actor admission; a broad app login is not global assistant rollout. */
export function assistantTarget(env: AssistantEnvironment, demo = false) {
  if (demo || env.PING_ASSISTANT_ENABLED !== "1" || !env.CLERK_SECRET_KEY || !env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) return null;
  const url = env.TASKS_DATABASE_URL, token = env.TASKS_AUTH_TOKEN;
  if (!url || !/^[a-f0-9]{64}$/.test(env.PING_ASSISTANT_TASKS_URL_SHA256 ?? "") ||
    createHash("sha256").update(url).digest("hex") !== env.PING_ASSISTANT_TASKS_URL_SHA256) return null;
  let mode: "local" | "remote";
  if (env.PING_ASSISTANT_TARGET === "local" && env.NODE_ENV !== "production" && env.VERCEL !== "1" && /^file:(?!:memory:)/.test(url)) mode = "local";
  else if (env.PING_ASSISTANT_TARGET === "remote" && /^libsql:\/\/[^/?#\s]+$/.test(url) && token) mode = "remote";
  else return null;
  // A separate, explicit switch admits every persisted, non-erased actor (general release,
  // founder decision 21 Oct 2026). The actor list itself never widens: "*" there is still refused.
  const allowAll = env.PING_ASSISTANT_OPEN_TO_ALL === "1";
  const actors = allowAll ? [] : (env.PING_ASSISTANT_ACTOR_IDS ?? "").split(",").map(id => id.trim()).filter(Boolean);
  if (!allowAll && (!actors.length || actors.length > 20 || actors.some(id => !/^[A-Za-z0-9_-]{1,128}$/.test(id)) || new Set(actors).size !== actors.length)) return null;
  const cacheKey = createHash("sha256").update(JSON.stringify([mode, url, token ?? null, allowAll ? "*" : actors, env.CLERK_SECRET_KEY, env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY])).digest("hex");
  return { mode, url, authToken: mode === "remote" ? token! : undefined, actors, allowAll, cacheKey };
}
/** Whether a target admits this actor: everyone when opened to all, otherwise the explicit list. */
export function assistantTargetAdmits(target: { actors: readonly string[]; allowAll?: boolean } | null | undefined, actorId: string) {
  return !!target && !!actorId && (target.allowAll === true || target.actors.includes(actorId));
}
export function assistantActorEnabled(env: AssistantEnvironment, actorId: string, demo = false) {
  return assistantTargetAdmits(assistantTarget(env, demo), actorId);
}

/** Testable session boundary. The resolver must prove a persisted, non-erased actor. */
export function createAssistantAuthentication(deps: {
  target: () => ReturnType<typeof assistantTarget>;
  session: () => Promise<{ userId: string | null; sessionId: string | null }>;
  resolveActor: (clerkId: string, target: NonNullable<ReturnType<typeof assistantTarget>>) => Promise<string | null>;
}) {
  return async () => {
    try {
      const target = deps.target(); if (!target) return null;
      const session = await deps.session(); if (!session.userId || !session.sessionId) return null;
      const actor = await deps.resolveActor(session.userId, target);
      return actor && assistantTargetAdmits(target, actor) && deps.target()?.cacheKey === target.cacheKey ? actor : null;
    } catch { return null; }
  };
}
