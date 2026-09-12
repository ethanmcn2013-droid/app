import type { ProjectId } from "@/lib/projects/project-ref";

export type DraftCache = Map<string, string>;

export function rememberDraft(cache: DraftCache, key: string, value: string, limit = 20): void {
  cache.delete(key);
  if (value) cache.set(key, value);
  while (cache.size > limit) cache.delete(cache.keys().next().value as string);
}

export function draftKey(actorId: string, projectId: ProjectId, conversationId: string, rootId: string | null): string {
  return JSON.stringify([actorId, projectId, conversationId, rootId]);
}

/** The synthetic identity header exists only when the lab explicitly supplies it. */
export function conversationHeaders(fixtureActor: string | undefined, hasBody: boolean): Headers {
  const headers = new Headers();
  if (hasBody) headers.set("content-type", "application/json");
  if (fixtureActor) headers.set("x-fixture-actor", fixtureActor);
  return headers;
}
