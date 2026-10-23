"use client";
import { CONVERSATION_ATTACHMENT_LIMITS } from "@/lib/conversations/attachment-contracts";
import { useEffect, useState, useSyncExternalStore } from "react";
import { ConversationAttachmentCache, EMPTY_CONVERSATION_FILES, type ConversationFileDraft } from "./conversation-attachment-drafts";
import { conversationFilesAvailable, conversationFileProblem, discardConversationFile, uploadConversationFile, type ConversationFileScope } from "./conversation-attachment-client";

export function useConversationAttachments(cache: ConversationAttachmentCache, key: string | null, scope: ConversationFileScope | null, enabled: boolean, fixtureActor?: string) {
  const files = useSyncExternalStore(cache.subscribe, () => key ? cache.get(key) ?? EMPTY_CONVERSATION_FILES : EMPTY_CONVERSATION_FILES, () => EMPTY_CONVERSATION_FILES);
  const [availability, setAvailability] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const signature = scope ? JSON.stringify([scope.projectId, scope.conversationId, scope.rootId, scope.expectedAudienceEpoch]) : null;
  useEffect(() => {
    if (!enabled || !scope || !signature) return;
    const controller = new AbortController();
    void conversationFilesAvailable(scope, controller.signal, fixtureActor).then(available => { if (!controller.signal.aborted) setAvailability(available ? signature : null); }).catch(() => { if (!controller.signal.aborted) setAvailability(null); });
    return () => controller.abort();
  // Scope is represented by its primitive signature; never reuse admission across audiences.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature, enabled, fixtureActor]);
  const available = enabled && signature !== null && availability === signature;

  async function upload(item: ConversationFileDraft, capturedKey: string, capturedScope: ConversationFileScope) {
    try {
      const attachment = await uploadConversationFile(item.file, item.requestId, capturedScope, fixtureActor);
      if (!cache.update(capturedKey, item.localId, current => current.requestId === item.requestId ? { ...current, status: "ready", attachment } : current)) {
        await discardConversationFile(attachment.id, fixtureActor).catch(() => undefined);
      }
    } catch (failure) {
      cache.update(capturedKey, item.localId, current => current.requestId === item.requestId ? { ...current, status: "failed", error: failure instanceof Error ? failure.message : "Upload could not be confirmed. Retry safely." } : current);
    }
  }
  function add(selected: FileList | readonly File[]) {
    if (!available || !key || !scope) return;
    if ((cache.get(key) ?? []).some(item => item.reservedFor)) { setNotice("Check the earlier message’s files before attaching more."); return; }
    setNotice(null);
    for (const file of Array.from(selected)) {
      if ((cache.get(key) ?? []).filter(item => !item.reservedFor).length >= CONVERSATION_ATTACHMENT_LIMITS.perMessage) { setNotice("Attach up to three files to one message."); break; }
      const problem = conversationFileProblem(file); if (problem) { setNotice(`${file.name}: ${problem}`); continue; }
      const item: ConversationFileDraft = { scopeKind: scope.kind, localId: crypto.randomUUID(), requestId: `file_${crypto.randomUUID().replaceAll("-", "")}`, file, status: "uploading", audienceEpoch: scope.expectedAudienceEpoch };
      cache.set(key, [...cache.get(key) ?? [], item]); void upload(item, key, scope);
    }
  }
  function remove(localId: string) {
    if (!key) return;
    const item = cache.get(key)?.find(file => file.localId === localId); if (!item || item.reservedFor) return;
    cache.set(key, (cache.get(key) ?? []).filter(file => file !== item));
    if (item.attachment) void discardConversationFile(item.attachment.id, fixtureActor).catch(failure => setNotice(failure instanceof Error ? failure.message : "File cleanup could not be confirmed."));
  }
  function retry(localId: string) {
    if (!available || !key || !scope) return;
    const item = cache.get(key)?.find(file => file.localId === localId); if (!item || item.reservedFor || item.status === "uploading") return;
    const newAudience = item.audienceEpoch !== scope.expectedAudienceEpoch;
    if (newAudience && item.attachment) void discardConversationFile(item.attachment.id, fixtureActor).catch(() => undefined);
    const next: ConversationFileDraft = { ...item, status: "uploading", error: undefined, ...(newAudience ? { requestId: `file_${crypto.randomUUID().replaceAll("-", "")}`, audienceEpoch: scope.expectedAudienceEpoch, attachment: undefined } : {}) };
    cache.update(key, localId, () => next); void upload(next, key, scope);
  }
  const draftFiles = files.filter(file => !file.reservedFor);
  return { files: draftFiles, all: files, available, notice, add, remove, retry,
    ready: draftFiles.flatMap(file => file.status === "ready" && file.audienceEpoch === scope?.expectedAudienceEpoch && file.attachment ? [file.attachment] : []),
    waiting: draftFiles.some(file => file.status !== "ready" || file.audienceEpoch !== scope?.expectedAudienceEpoch),
    reserve: (ids: readonly string[], requestId: string) => !!key && cache.reserve(key, ids, requestId),
    release: (requestId: string) => { if (key) cache.release(key, requestId); },
    consume: (requestId: string) => { if (key) cache.consume(key, requestId); },
    discardReservation: (requestId: string) => { if (!key) return; for (const item of files.filter(file => file.reservedFor === requestId)) { if (item.attachment) void discardConversationFile(item.attachment.id, fixtureActor).catch(() => undefined); } cache.consume(key, requestId); },
  };
}
