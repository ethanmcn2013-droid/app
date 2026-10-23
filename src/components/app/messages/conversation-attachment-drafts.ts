import type { ConversationAttachment } from "@/lib/conversations/attachment-contracts";

export type ConversationFileDraft = Readonly<{
  scopeKind: "project" | "dm"; localId: string; requestId: string; file: File; audienceEpoch: number;
  status: "uploading" | "ready" | "failed"; attachment?: ConversationAttachment;
  error?: string; reservedFor?: string;
}>;
export const EMPTY_CONVERSATION_FILES: readonly ConversationFileDraft[] = [];

/** Actor-owned memory only. No file bytes or descriptors enter browser storage. */
export class ConversationAttachmentCache extends Map<string, readonly ConversationFileDraft[]> {
  private listeners = new Set<() => void>();
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private emit() { for (const listener of this.listeners) listener(); }
  override set(key: string, files: readonly ConversationFileDraft[]) {
    if (files.length) super.set(key, files); else super.delete(key);
    this.emit(); return this;
  }
  override delete(key: string) { const deleted = super.delete(key); if (deleted) this.emit(); return deleted; }
  override clear() { super.clear(); this.emit(); }
  update(key: string, localId: string, update: (file: ConversationFileDraft) => ConversationFileDraft) {
    const files = this.get(key);
    if (!files?.some(file => file.localId === localId)) return false;
    this.set(key, files.map(file => file.localId === localId ? update(file) : file)); return true;
  }
  reserve(key: string, ids: readonly string[], requestId: string) {
    const files = this.get(key) ?? [];
    const selected = ids.map(id => files.find(file => file.attachment?.id === id && file.status === "ready" && !file.reservedFor));
    if (selected.some(file => !file) || new Set(ids).size !== ids.length) return false;
    this.set(key, files.map(file => ids.includes(file.attachment?.id ?? "") ? { ...file, reservedFor: requestId } : file)); return true;
  }
  release(key: string, requestId: string) { this.set(key, (this.get(key) ?? []).map(file => file.reservedFor === requestId ? { ...file, reservedFor: undefined } : file)); }
  consume(key: string, requestId: string) { this.set(key, (this.get(key) ?? []).filter(file => file.reservedFor !== requestId)); }
}
