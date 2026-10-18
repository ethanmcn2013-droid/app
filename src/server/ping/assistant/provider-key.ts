import "server-only";
/** Dedicated credential only. A generic Tasks/Notes key never admits the Ping planner. */
export function pingAssistantApiKey(env: Readonly<Record<string, string | undefined>>): string | undefined {
  return env.PING_ASSISTANT_ANTHROPIC_API_KEY;
}
