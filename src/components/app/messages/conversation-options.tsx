"use client";
import { useRef } from "react";
import styles from "./floating-chat.module.css";

export function ConversationOptions({ title, onHide }: { title: string; onHide: () => void }) {
  const ref = useRef<HTMLDetailsElement>(null);
  return <details className={styles.options} ref={ref} onKeyDown={(event) => { if (event.key === "Escape") { event.preventDefault(); ref.current!.open = false; ref.current?.querySelector("summary")?.focus(); } }}>
    <summary aria-label={`Options for ${title}`} title={`Options for ${title}`}><svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><circle cx="3.5" cy="8" r="1" /><circle cx="8" cy="8" r="1" /><circle cx="12.5" cy="8" r="1" /></svg></summary>
    <div className={styles.optionsMenu}><button onClick={() => { ref.current!.open = false; onHide(); }} type="button">Hide for me</button><p>Hides this conversation in this browser. History and other people’s access stay the same.</p></div>
  </details>;
}
