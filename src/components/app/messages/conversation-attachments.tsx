"use client";
import { useRef } from "react";
import type { ConversationAttachment } from "@/lib/conversations/attachment-contracts";
import type { ConversationFileDraft } from "./conversation-attachment-drafts";
import { CONVERSATION_FILE_ACCEPT, conversationFileSize } from "./conversation-attachment-client";
import { ChatIcon } from "./chat-ui";
import styles from "./personal-attachments.module.css";

function FileIcon() { return <svg width="18" height="20" viewBox="0 0 18 20" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="M10.5 1.5h-7A1.5 1.5 0 0 0 2 3v14a1.5 1.5 0 0 0 1.5 1.5h11A1.5 1.5 0 0 0 16 17V7Z" /><path d="M10 1.5V7h5.5M5.5 11h7M5.5 14.5h5" /></svg>; }
export function ConversationFilePicker({ disabled, onFiles }: { disabled: boolean; onFiles: (files: FileList) => void }) {
  const input = useRef<HTMLInputElement>(null);
  return <><input accept={CONVERSATION_FILE_ACCEPT} aria-label="Choose conversation files" className={styles.hidden} disabled={disabled} multiple onChange={event => { if (event.target.files) onFiles(event.target.files); event.target.value = ""; }} ref={input} tabIndex={-1} type="file" /><button data-conversation-file-tool className={styles.attach} disabled={disabled} onClick={() => input.current?.click()} title="Attach up to 3 files · 2 MiB each" type="button"><ChatIcon.plus />Attach a file</button></>;
}
export function DraftConversationFiles({ files, disabled, audienceEpoch, onRemove, onRetry }: { files: readonly ConversationFileDraft[]; disabled: boolean; audienceEpoch: number | null; onRemove: (id: string) => void; onRetry: (id: string) => void }) {
  if (!files.length) return null;
  return <ul aria-label="Files in your message draft" className={styles.drafts}>{files.map(file => {
    const stale = file.audienceEpoch !== audienceEpoch;
    return <li className={styles.file} key={file.localId}><FileIcon /><div className={styles.description}><span className={styles.name} title={file.file.name}>{file.file.name}</span><span className={styles.meta} role="status">{stale ? "Prepared for the previous audience. Review the current audience, then upload again." : file.status === "uploading" ? "Uploading and checking…" : file.status === "failed" ? file.error : `${conversationFileSize(file.file.size)} · Ready to send`}</span></div>{stale || file.status === "failed" ? <button aria-label={`${stale ? "Upload again" : "Retry uploading"} ${file.file.name}`} data-conversation-file-tool className={styles.action} disabled={disabled || file.status === "uploading"} onClick={() => onRetry(file.localId)} type="button"><ChatIcon.retry /></button> : null}<button aria-label={`Remove ${file.file.name}`} data-conversation-file-tool className={styles.action} onClick={() => onRemove(file.localId)} type="button"><ChatIcon.close /></button></li>;
  })}</ul>;
}
export function ConversationMessageFiles({ files, pending = false }: { files?: readonly ConversationAttachment[]; pending?: boolean }) {
  if (!files?.length) return null;
  return <ul aria-label={pending ? "Files waiting for confirmation" : "Message files"} className={styles.downloads}>{files.map(file => <li key={file.id}>{pending ? <div className={styles.file}><FileIcon /><span className={styles.description}><span className={styles.name}>{file.filename}</span><span className={styles.meta}>{conversationFileSize(file.sizeBytes)} · Waiting for message confirmation</span></span></div> : <a className={styles.download} download={file.filename} href={`/api/conversations/attachments/${encodeURIComponent(file.id)}`}><FileIcon /><span className={styles.description}><span className={styles.name} title={file.filename}>{file.filename}</span><span className={styles.meta}>{conversationFileSize(file.sizeBytes)} · Download file</span></span></a>}</li>)}</ul>;
}
