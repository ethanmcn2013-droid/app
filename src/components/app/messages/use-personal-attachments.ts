"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { PersonalChatAttachment } from "@/lib/conversations/personal-chat-contracts";
import { discardPersonalFile, personalFileProblem, PERSONAL_FILES_PER_MESSAGE, uploadPersonalFile } from "./personal-attachment-client";

export type DraftPersonalFile = { localId: string; requestId: string; file: File; status: "uploading" | "ready" | "failed"; attachment?: PersonalChatAttachment; error?: string };

/** The mounted chat retains draft claims when its overlay closes. */
export function usePersonalAttachments(demo: boolean) {
  const [files, setFiles] = useState<DraftPersonalFile[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const current = useRef<DraftPersonalFile[]>([]);
  const discarded = useRef(new Set<string>());
  const urls = useRef(new Set<string>());
  const alive = useRef(true);
  useEffect(() => { alive.current = true; const ownedUrls = urls.current; return () => { alive.current = false; for (const url of ownedUrls) URL.revokeObjectURL(url); ownedUrls.clear(); }; }, []);

  const update = useCallback((next: DraftPersonalFile[]) => { current.current = next; if (alive.current) setFiles(next); }, []);
  const cleanup = useCallback(async (attachment: PersonalChatAttachment) => {
    if (demo) { URL.revokeObjectURL(attachment.href); urls.current.delete(attachment.href); return; }
    try { await discardPersonalFile(attachment.id); }
    catch (failure) { if (alive.current) setNotice(failure instanceof Error ? failure.message : "Unsent file cleanup will be retried automatically."); }
  }, [demo]);

  async function upload(item: DraftPersonalFile) {
    update(current.current.map(file => file.localId === item.localId ? { ...file, status: "uploading", error: undefined } : file));
    try {
      let attachment: PersonalChatAttachment;
      if (demo) {
        const href = URL.createObjectURL(item.file); urls.current.add(href);
        attachment = { id: item.localId, filename: item.file.name, mimeType: item.file.type || "application/octet-stream", sizeBytes: item.file.size, href };
      } else attachment = await uploadPersonalFile(item.file, item.requestId);
      if (!alive.current || discarded.current.has(item.localId)) { await cleanup(attachment); return; }
      update(current.current.map(file => file.localId === item.localId ? { ...file, status: "ready", attachment } : file));
    } catch (failure) {
      if (!alive.current || discarded.current.has(item.localId)) return;
      update(current.current.map(file => file.localId === item.localId ? { ...file, status: "failed", error: failure instanceof Error ? failure.message : "Upload could not be confirmed. Retry safely." } : file));
    }
  }

  function add(selected: FileList | readonly File[]) {
    setNotice(null);
    for (const file of Array.from(selected)) {
      if (current.current.length >= PERSONAL_FILES_PER_MESSAGE) { setNotice("Attach up to three files to one message."); break; }
      const problem = personalFileProblem(file);
      if (problem) { setNotice(`${file.name}: ${problem}`); continue; }
      const item: DraftPersonalFile = { localId: crypto.randomUUID(), requestId: `file_${crypto.randomUUID().replaceAll("-", "")}`, file, status: "uploading" };
      update([...current.current, item]);
      void upload(item);
    }
  }

  function remove(localId: string) {
    const item = current.current.find(file => file.localId === localId);
    discarded.current.add(localId);
    update(current.current.filter(file => file.localId !== localId));
    // An in-flight request keeps running long enough to receive an ID and clean
    // it. Response loss is covered by the server's durable unbound-claim expiry.
    if (item?.attachment) void cleanup(item.attachment);
  }

  function consumed(ids: readonly string[]) {
    update(current.current.filter(file => !file.attachment || !ids.includes(file.attachment.id)));
  }

  return { files, notice, add, remove, consumed, retry: (localId: string) => { const item = current.current.find(file => file.localId === localId); if (item?.status === "failed") void upload(item); }, ready: files.flatMap(file => file.status === "ready" && file.attachment ? [file.attachment] : []), waiting: files.some(file => file.status !== "ready") };
}
