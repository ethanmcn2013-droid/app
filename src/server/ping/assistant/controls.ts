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
  const actors = (env.PING_ASSISTANT_ACTOR_IDS ?? "").split(",").map(id => id.trim()).filter(Boolean);
  if (!actors.length || actors.length > 20 || actors.some(id => !/^[A-Za-z0-9_-]{1,128}$/.test(id)) || new Set(actors).size !== actors.length) return null;
  const cacheKey = createHash("sha256").update(JSON.stringify([mode, url, token ?? null, actors, env.CLERK_SECRET_KEY, env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY])).digest("hex");
  return { mode, url, authToken: mode === "remote" ? token! : undefined, actors, cacheKey };
}
export function assistantActorEnabled(env: AssistantEnvironment, actorId: string, demo = false) {
  return assistantTarget(env, demo)?.actors.includes(actorId) === true;
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
      return actor && target.actors.includes(actor) && deps.target()?.cacheKey === target.cacheKey ? actor : null;
    } catch { return null; }
  };
}
