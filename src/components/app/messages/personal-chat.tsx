"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { normalizeMessageBody, validMessageBody } from "@/lib/conversations/contracts";
import { Composer, MessageBody, useBottomAnchor, JumpToLatest } from "./chat-ui";
import { appendDictatedText } from "./chat-composer-model";
import { ChatDictationTools, ChatDraftCounter } from "./chat-composer-tools";
import type { PersonalChatAttachment } from "@/lib/conversations/personal-chat-contracts";
import { usePersonalAttachments } from "./use-personal-attachments";
import { DraftPersonalFiles, PersonalFilePicker, PersonalMessageFiles } from "./personal-attachments";
import fileStyles from "./personal-attachments.module.css";
import styles from "./floating-chat.module.css";

type PersonalMessage = { id: string; body: string; createdAt: number; editedAt: number | null; attachments?: readonly PersonalChatAttachment[] };
type Attempt = { clientRequestId: string; body: string; attachments: readonly PersonalChatAttachment[]; state: "sending" | "uncertain" };
const dateLabel = (timestamp: number) => new Date(timestamp).toLocaleString([], { dateStyle: "medium", timeStyle: "short" });

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { credentials: "same-origin", cache: "no-store", ...init, headers: { "content-type": "application/json", ...init?.headers } });
  if (!response.ok) throw new Error(response.status === 401 ? "Your session ended. Reload to sign in again." : response.status === 409 ? "This send no longer matches its original request. Your draft is kept." : response.status === 429 ? "You’ve sent several messages quickly. Wait a minute, then check and retry. Your draft is kept." : response.status === 413 ? "This conversation exceeds the current Markdown export limit. No partial file was downloaded. Your messages are kept." : "Personal chat is unavailable. Your draft is kept. Try again shortly.");
  return await response.json() as T;
}

function download(markdown: string) {
  const url = URL.createObjectURL(new Blob([markdown], { type: "text/markdown;charset=utf-8" }));
  const anchor = document.createElement("a"); anchor.href = url; anchor.download = `personal-chat-${new Date().toISOString().slice(0, 10)}.md`; anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** One private owner, independent of Project membership and two-person DMs. */
export function PersonalChat({ actorId, actorName, demo, visible }: { actorId: string; actorName: string; demo: boolean; visible: boolean }) {
  const [messages, setMessages] = useState<PersonalMessage[]>([]);
  const [draft, setDraft] = useState("");
  const draftRef = useRef("");
  useEffect(() => { draftRef.current = draft; }, [draft]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [ready, setReady] = useState(demo);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState<Attempt | null>(null);
  const [exporting, setExporting] = useState(false);
  const [attachmentsEnabled, setAttachmentsEnabled] = useState(demo);
  const files = usePersonalAttachments(demo);
  const validDraft = !draft.trim() ? files.ready.length > 0 : validMessageBody(draft);
  const pending = useRef<Attempt | null>(null);
  const alive = useRef(true);
  const { ref: scrollRef, pin, away } = useBottomAnchor();
  const fileProgress = files.files.map(file => `${file.localId}:${file.status}`).join("|");
  const attemptState = attempt?.state;
  useEffect(() => {
    if (fileProgress || files.notice || attemptState || error) pin();
  }, [fileProgress, files.notice, attemptState, error, pin]);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);

  const load = useCallback(async (before?: string, signal?: AbortSignal) => {
    setLoading(true); setError(null);
    try {
      const result = await request<{ messages: PersonalMessage[]; nextCursor: string | null; attachmentsEnabled?: boolean }>(`/api/personal-chat?limit=50${before ? `&before=${encodeURIComponent(before)}` : ""}`, { signal });
      if (!alive.current || signal?.aborted) return;
      setMessages((current) => [...new Map([...result.messages, ...current].map((message) => [message.id, message])).values()].sort((a, b) => a.createdAt - b.createdAt || a.id.localeCompare(b.id)));
      setNextCursor(result.nextCursor); setAttachmentsEnabled(result.attachmentsEnabled === true); setReady(true);
    } catch (failure) { if (alive.current && !signal?.aborted) setError(failure instanceof Error ? failure.message : "Chat could not load. Try again."); }
    finally { if (alive.current && !signal?.aborted) setLoading(false); }
  }, []);
  useEffect(() => {
    if (!visible || demo || ready) return;
    const controller = new AbortController(); queueMicrotask(() => { if (!controller.signal.aborted) void load(undefined, controller.signal); }); return () => controller.abort();
  }, [visible, demo, ready, load]);

  function rememberAttempt(next: Attempt | null) { pending.current = next; setAttempt(next); }
  function settle(message: PersonalMessage, sent: Attempt) {
    if (!alive.current) return;
    setMessages((current) => [...current.filter((item) => item.id !== message.id), message].sort((a, b) => a.createdAt - b.createdAt || a.id.localeCompare(b.id)));
    files.consumed(sent.attachments.map(file => file.id));
    setDraft((current) => current === sent.body ? "" : current); rememberAttempt(null); pin();
  }
  async function submit(checkReceipt = false) {
    if (pending.current?.state === "sending") return;
    const normalized = normalizeMessageBody(draft);
    const body = normalized.trim() ? normalized : "";
    if (!pending.current && (!validDraft || files.waiting)) return;
    const sent: Attempt = { ...(pending.current ?? { body, attachments: files.ready, clientRequestId: `self_${crypto.randomUUID().replaceAll("-", "")}` }), state: "sending" };
    rememberAttempt(sent); setError(null);
    if (demo) { settle({ id: sent.clientRequestId, body: sent.body, createdAt: Date.now(), editedAt: null, attachments: sent.attachments }, sent); return; }
    try {
      if (checkReceipt) {
        const receipt = await request<{ message: PersonalMessage | null }>(`/api/personal-chat?requestId=${encodeURIComponent(sent.clientRequestId)}`);
        if (receipt.message) { settle(receipt.message, sent); return; }
      }
      const result = await request<{ message: PersonalMessage }>("/api/personal-chat", { method: "POST", body: JSON.stringify({ clientRequestId: sent.clientRequestId, body: sent.body, ...(sent.attachments.length ? { attachmentIds: sent.attachments.map(file => file.id) } : {}) }) });
      settle(result.message, sent);
    } catch (failure) {
      if (!alive.current) return;
      rememberAttempt({ ...sent, state: "uncertain" });
      setError(failure instanceof Error ? failure.message : "The send could not be confirmed. Check its receipt before retrying.");
    }
  }
  async function exportChat() {
    setExporting(true); setError(null);
    try {
      const markdown = demo ? `# Personal chat\n\nPreview only — these messages and files live in this browser tab. Files are not embedded in this export.\n\n${messages.map((message) => `## ${new Date(message.createdAt).toISOString()} · You\n\n${message.body}${message.attachments?.length ? `\n\n${message.attachments.map(file => `File: ${file.filename} (${file.sizeBytes} bytes; preview only)`).join("\n")}` : ""}`).join("\n\n")}`
        : (await request<{ markdown: string }>("/api/personal-chat?format=markdown")).markdown;
      if (alive.current) download(markdown);
    } catch (failure) { if (alive.current) setError(failure instanceof Error ? failure.message : "Export failed. Try again."); }
    finally { if (alive.current) setExporting(false); }
  }

  return <section aria-label="Your private conversation" className={styles.personal}>
    <header className={styles.personalHead}><div><h2>{actorName} <span>(you)</span></h2><p>{demo ? "Preview · messages stay in this tab" : "Private to you · saved to your account"}</p></div><button disabled={exporting || (!demo && !ready)} onClick={() => void exportChat()} type="button">{exporting ? "Exporting…" : "Export Markdown"}</button></header>
    <div aria-label="Personal chat history" className={styles.personalScroll} ref={scrollRef} tabIndex={0}>
      {nextCursor ? <button disabled={loading} onClick={() => void load(nextCursor)} type="button">{loading ? "Loading…" : "Load earlier messages"}</button> : null}
      {!ready && loading ? <p role="status">Loading your messages…</p> : null}
      {ready && !messages.length ? <div className={styles.personalIntro}><h3>A place to think out loud.</h3><p>Keep a thought, a link or a reminder here. Only you can read this conversation.</p><p>Export it as Markdown whenever you want to take your notes with you.</p></div> : null}
      <ol className={styles.personalMessages}>{messages.map((message) => <li key={message.id}><div><strong>You</strong><time dateTime={new Date(message.createdAt).toISOString()}>{dateLabel(message.createdAt)}</time>{message.editedAt ? <span>Edited</span> : null}</div>{message.body ? <p><MessageBody body={message.body} people={[]} selfId={actorId} /></p> : null}<PersonalMessageFiles files={message.attachments} demo={demo} /></li>)}</ol>
      {error ? <div className={styles.error} role="alert">{error}{!ready ? <button disabled={loading} onClick={() => void load()} type="button">Try again</button> : null}</div> : null}
      {attempt ? <div className={styles.sendStatus} role="status">{attempt.state === "sending" ? "Saving your message…" : <>This send is unconfirmed. Your message stays in the draft.<button onClick={() => void submit(true)} type="button">Check receipt, then retry</button></>}</div> : null}
      <DraftPersonalFiles files={files.files} disabled={!!attempt} demo={demo} onRemove={files.remove} onRetry={files.retry} />
      {files.notice ? <p className={fileStyles.note} role="status">{files.notice}</p> : null}
    </div>
    {away ? <JumpToLatest onClick={() => pin(true)} /> : null}
    <Composer value={draft} onChange={(value) => { draftRef.current = value; setDraft(value); }} onSend={() => void submit()} label="Message yourself" placeholder={attachmentsEnabled ? "Write a thought or add a file" : "Write a thought or paste a link"} people={[]} selfId={actorId} mentionIds={[]} sendDisabled={!ready || !!attempt || !validDraft || files.waiting} allowEmpty={files.ready.length > 0} disabled={!!attempt} showHint={false} count={<ChatDraftCounter value={draft} />} additionalTools={<>{attachmentsEnabled ? <PersonalFilePicker disabled={!ready || !!attempt || files.files.length >= 3} onFiles={files.add} /> : null}<ChatDictationTools active={visible && !attempt} contextKey={`${actorId}:self`} append={(text) => { const next = appendDictatedText(draftRef.current, text); if (next === null) return false; draftRef.current = next; setDraft(next); return true; }} /></>} />
  </section>;
}
