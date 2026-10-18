"use client";

import { useRef } from "react";
import type { PersonalChatAttachment } from "@/lib/conversations/personal-chat-contracts";
import type { DraftPersonalFile } from "./use-personal-attachments";
import { PERSONAL_FILE_ACCEPT, personalFileSize } from "./personal-attachment-client";
import { ChatIcon } from "./chat-ui";
import styles from "./personal-attachments.module.css";

function FileIcon() {
  return <svg width="18" height="20" viewBox="0 0 18 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M10.5 1.5h-7A1.5 1.5 0 0 0 2 3v14a1.5 1.5 0 0 0 1.5 1.5h11A1.5 1.5 0 0 0 16 17V7Z" /><path d="M10 1.5V7h5.5M5.5 11h7M5.5 14.5h5" /></svg>;
}

export function PersonalFilePicker({ disabled, onFiles }: { disabled: boolean; onFiles: (files: FileList) => void }) {
  const input = useRef<HTMLInputElement>(null);
  return <><input accept={PERSONAL_FILE_ACCEPT} aria-label="Choose private chat files" className={styles.hidden} disabled={disabled} multiple onChange={event => { if (event.target.files) onFiles(event.target.files); event.target.value = ""; }} ref={input} tabIndex={-1} type="file" /><button aria-label="Attach a file" className={styles.attach} disabled={disabled} onClick={() => input.current?.click()} title="Attach up to 3 private files · 2 MiB each" type="button"><svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m6.3 9.7 5.5-5.5a2.1 2.1 0 0 1 3 3l-7.1 7.1a3.5 3.5 0 0 1-5-5L10 2" /></svg></button></>;
}

export function DraftPersonalFiles({ files, disabled, demo, onRemove, onRetry }: { files: readonly DraftPersonalFile[]; disabled: boolean; demo: boolean; onRemove: (id: string) => void; onRetry: (id: string) => void }) {
  if (!files.length) return null;
  return <ul aria-label="Files in your draft" className={styles.drafts}>{files.map(file => <li className={styles.file} key={file.localId}><FileIcon /><div className={styles.description}><span className={styles.name} title={file.file.name}>{file.file.name}</span><span className={`${styles.meta} ${file.status === "failed" ? styles.failed : ""}`} role="status">{file.status === "uploading" ? "Uploading and checking…" : file.status === "failed" ? file.error : `${personalFileSize(file.file.size)} · ${demo ? "Ready in this preview" : "Ready to send"}`}</span></div>{file.status === "failed" ? <button aria-label={`Retry uploading ${file.file.name}`} className={styles.action} disabled={disabled} onClick={() => onRetry(file.localId)} type="button"><ChatIcon.retry /></button> : null}<button aria-label={`Remove ${file.file.name}`} className={styles.action} disabled={disabled} onClick={() => onRemove(file.localId)} type="button"><ChatIcon.close /></button></li>)}</ul>;
}

export function PersonalMessageFiles({ files, demo }: { files?: readonly PersonalChatAttachment[]; demo: boolean }) {
  if (!files?.length) return null;
  return <ul aria-label="Message files" className={styles.downloads}>{files.map(file => <li key={file.id}><a className={styles.download} download={file.filename} href={demo ? file.href : `/api/personal-chat/attachments/${encodeURIComponent(file.id)}`}><FileIcon /><span className={styles.description}><span className={styles.name} title={file.filename}>{file.filename}</span><span className={styles.meta}>{personalFileSize(file.sizeBytes)} · Download{demo ? " preview file" : " private file"}</span></span></a></li>)}</ul>;
}
