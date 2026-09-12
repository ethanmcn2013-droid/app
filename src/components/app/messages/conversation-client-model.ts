import type { ProjectId } from "@/lib/projects/project-ref";

export type DraftCache = Map<string, string>;
export type ScrollCache = Map<string, Readonly<{ top: number; bottomDistance: number }>>;

export function rememberDraft(cache: DraftCache, key: string, value: string, limit = 20): void {
  cache.delete(key);
  if (value) cache.set(key, value);
  while (cache.size > limit) cache.delete(cache.keys().next().value as string);
}

export function draftKey(actorId: string, projectId: ProjectId, conversationId: string, rootId: string | null): string {
  return JSON.stringify([actorId, projectId, conversationId, rootId]);
}

export function forgetProjectDrafts(cache: DraftCache, actorId: string, projectId: ProjectId): void {
  for (const key of cache.keys()) {
    try {
      const value: unknown = JSON.parse(key);
      if (Array.isArray(value) && value[0] === actorId && value[1] === projectId) cache.delete(key);
    } catch {
      // Ignore keys outside this module's tuple format.
    }
  }
}

export function audienceResponseMatches(capturedGeneration: number, currentGeneration: number, expectedEpoch: number, historyEpoch: number | null, responseEpoch: number): boolean {
  return capturedGeneration === currentGeneration && expectedEpoch === historyEpoch && responseEpoch === historyEpoch;
}

export function needsFreshAudienceSend(requestEpoch: number, historyEpoch: number | null): boolean {
  return historyEpoch === null || requestEpoch !== historyEpoch;
}

export function shouldSendComposerKey(input: Readonly<{ key: string; shiftKey: boolean; composing: boolean; mobileReturn: boolean }>): boolean {
  return input.key === "Enter" && !input.shiftKey && !input.composing && !input.mobileReturn;
}

export function anchoredScrollTop(scrollHeight: number, clientHeight: number, bottomDistance: number): number {
  return Math.max(0, scrollHeight - clientHeight - bottomDistance);
}
export type ScrollAnchor = Readonly<{ top: number; bottomDistance: number; mode: "live" | "prepend" }>;
export function resolveScrollAnchor(scrollHeight: number, clientHeight: number, anchor: ScrollAnchor): number {
  if (anchor.mode === "prepend") return anchoredScrollTop(scrollHeight, clientHeight, anchor.bottomDistance);
  if (anchor.bottomDistance < 80) return anchoredScrollTop(scrollHeight, clientHeight, 0);
  return Math.max(0, Math.min(anchor.top, scrollHeight - clientHeight));
}

/** The synthetic identity header exists only when the lab explicitly supplies it. */
export function conversationHeaders(fixtureActor: string | undefined, hasBody: boolean): Headers {
  const headers = new Headers();
  if (hasBody) headers.set("content-type", "application/json");
  if (fixtureActor) headers.set("x-fixture-actor", fixtureActor);
  return headers;
}
