import { parseProjectId, type ProjectId } from "@/lib/projects/project-ref";
import type { PendingSend, RecoveredDraft } from "@/lib/conversations/reducer";

export type DraftCache = Map<string, string>;
export type ScrollCache = Map<string, Readonly<{ top: number; bottomDistance: number }>>;
export type OutgoingCache = Map<string, Readonly<{ pending: readonly PendingSend[]; recoveredDrafts: readonly RecoveredDraft[]; reviewedAudienceEpoch: number | null; draftMentionUserIds?: readonly string[]; scopeKind?: "project" | "dm" }>>;
export type SavedConversationScope = Readonly<{ projectId: ProjectId; conversationId: string; rootId: string | null; kind: "project" | "dm" }>;

export function listSavedDrafts(actorId: string, drafts: DraftCache, outgoing: OutgoingCache) {
  return [...new Set([...drafts.keys(), ...outgoing.keys()])].flatMap((key) => {
    try {
      const tuple: unknown = JSON.parse(key);
      if (!Array.isArray(tuple) || tuple.length !== 4 || tuple[0] !== actorId || typeof tuple[1] !== "string" || typeof tuple[2] !== "string" || (tuple[3] !== null && typeof tuple[3] !== "string")) return [];
      const projectId = parseProjectId(tuple[1]);
      if (!projectId) return [];
      const saved = outgoing.get(key);
      return [{ key, scope: { projectId, conversationId: tuple[2], rootId: tuple[3], kind: saved?.scopeKind ?? "project" } as SavedConversationScope,
        bodies: [drafts.get(key), ...saved?.pending.map((item) => item.input.body) ?? [], ...saved?.recoveredDrafts.map((item) => item.body) ?? []].filter((body): body is string => !!body),
        selectedPeople: saved?.draftMentionUserIds?.length ?? 0,
        unresolved: !!(saved?.pending.length || saved?.recoveredDrafts.length) }];
    } catch { return []; }
  });
}

export function rememberDraft(cache: DraftCache, key: string, value: string, limit = 20): boolean {
  if (value && !cache.has(key) && cache.size >= limit) return false;
  if (value) cache.set(key, value);
  else cache.delete(key);
  return true;
}

export function hasDraftCapacity(drafts: DraftCache, outgoing: OutgoingCache, key: string, limit = 20): boolean {
  const occupied = new Set([...drafts.keys(), ...outgoing.keys()]);
  return occupied.has(key) || occupied.size < limit;
}

export function draftKey(actorId: string, projectId: ProjectId, conversationId: string, rootId: string | null): string {
  return JSON.stringify([actorId, projectId, conversationId, rootId]);
}

export function forgetProjectDrafts(cache: Map<string, unknown>, actorId: string, projectId: ProjectId): void {
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

export function forgetConversationDrafts(cache: Map<string, unknown>, actorId: string, projectId: ProjectId, conversationId: string): void {
  for (const key of cache.keys()) {
    try {
      const value: unknown = JSON.parse(key);
      if (Array.isArray(value) && value[0] === actorId && value[1] === projectId && value[2] === conversationId) cache.delete(key);
    } catch { /* Keys outside the scoped tuple are not owned here. */ }
  }
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
