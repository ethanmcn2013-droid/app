import { createHash } from "node:crypto";

export type ConversationRuntimeTarget =
  | Readonly<{ mode: "local"; url: string; cacheKey: string }>
  | Readonly<{ mode: "remote"; url: string; authToken: string; target: string; cacheKey: string }>
  | Readonly<{ mode: "unavailable"; reason: string }>;

/** No ambient database fallback is permitted for authenticated conversations. */
export function resolveConversationRuntimeTarget(
  env: Readonly<Record<string, string | undefined>>,
  demoMode: boolean,
): ConversationRuntimeTarget {
  if (demoMode || env.SIGNAL_CONVERSATION_INTERNAL_ENABLED !== "true") {
    return { mode: "unavailable", reason: "disabled" };
  }

  const url = env.TASKS_DATABASE_URL;
  if (env.SIGNAL_CONVERSATION_DATABASE_MODE === "local") {
    if (env.NODE_ENV === "production" || env.VERCEL === "1" ||
        !url?.startsWith("file:") || url.includes(":memory:")) {
      return { mode: "unavailable", reason: "unverified_environment" };
    }
    return { mode: "local", url, cacheKey: `local:${url}` };
  }

  if (env.SIGNAL_CONVERSATION_DATABASE_MODE !== "remote" ||
      env.SIGNAL_CONVERSATION_REMOTE_ENABLED !== "true" || !url ||
      !env.TASKS_AUTH_TOKEN?.trim()) {
    return { mode: "unavailable", reason: "unverified_environment" };
  }

  // Only the canonical Tasks store is used. The operator pins its exact URL
  // separately so a copied enable flag cannot redirect messages to a wrong DB.
  let parsed: URL;
  try { parsed = new URL(url); }
  catch { return { mode: "unavailable", reason: "invalid_remote_target" }; }
  if (parsed.protocol !== "libsql:" || !parsed.hostname || parsed.username ||
      parsed.password || parsed.port || parsed.search || parsed.hash ||
      (parsed.pathname !== "" && parsed.pathname !== "/")) {
    return { mode: "unavailable", reason: "invalid_remote_target" };
  }
  const expectedHash = env.SIGNAL_CONVERSATION_REMOTE_URL_SHA256;
  const actualHash = createHash("sha256").update(url).digest("hex");
  const target = env.SIGNAL_CONVERSATION_REMOTE_TARGET;
  if (!expectedHash || !/^[a-f0-9]{64}$/.test(expectedHash) ||
      expectedHash !== actualHash || !target || !/^[a-z0-9][a-z0-9-]{2,63}$/.test(target)) {
    return { mode: "unavailable", reason: "unverified_remote_target" };
  }
  const authToken = env.TASKS_AUTH_TOKEN;
  const tokenHash = createHash("sha256").update(authToken).digest("hex");
  return { mode: "remote", url, authToken, target,
    cacheKey: `remote:${target}:${actualHash}:${tokenHash}` };
}
