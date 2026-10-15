"use client";

import { useEffect, useState } from "react";
import { CONVERSATION_LIMITS } from "@/lib/conversations/contracts";
import { useChatDictation } from "./use-chat-dictation";
import styles from "./floating-chat.module.css";

export function ChatDraftCounter({ value }: { value: string }) {
  const characters = Array.from(value).length;
  const bytes = new TextEncoder().encode(value).byteLength;
  if (characters < 7_000 && bytes < 28_000) return null;
  const invalid = characters > CONVERSATION_LIMITS.bodyCharacters || bytes > CONVERSATION_LIMITS.bodyBytes;
  return <span className={styles.counter} data-invalid={invalid || undefined} role="status">{invalid ? "Message is too long · " : ""}{characters.toLocaleString()} / 8,000</span>;
}

export function ChatDictationTools({ contextKey, active = true, append }: { contextKey: string; active?: boolean; append: (text: string) => boolean }) {
  const [permissionNote, setPermissionNote] = useState(false);
  const [explained, setExplained] = useState(false);
  const [overflow, setOverflow] = useState<string | null>(null);
  const dictation = useChatDictation(contextKey, (text) => { if (!append(text)) setOverflow(text); });
  const { cancel } = dictation;
  useEffect(() => { if (!active) cancel(); }, [active, cancel]);
  return <div className={styles.dictation}>
    <button aria-label={dictation.listening ? "Stop dictation" : "Dictate a message"} aria-pressed={dictation.listening} disabled={!active || !dictation.supported} onClick={() => {
      if (dictation.listening) dictation.stop();
      else if (!explained) setPermissionNote(true);
      else dictation.start();
    }} title={!dictation.supported ? "Dictation is unavailable in this browser. You can keep typing." : "Dictate a message"} type="button">
      <svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><rect x="5.5" y="1.5" width="5" height="8" rx="2.5" /><path d="M3.5 7.5a4.5 4.5 0 0 0 9 0M8 12v2.5M5.5 14.5h5" /></svg>
      {dictation.listening ? "Stop dictation" : "Dictate"}
    </button>
    {permissionNote ? <div className={styles.speechNote} role="note"><p>Your browser may send audio to its speech provider. Dictation adds text to your draft; review it before sending.</p><button onClick={() => { setExplained(true); setPermissionNote(false); dictation.start(); }} type="button">Start dictation</button><button onClick={() => setPermissionNote(false)} type="button">Cancel</button></div> : null}
    {dictation.listening ? <span role="status">Listening… {dictation.interim}</span> : null}
    {dictation.error ? <span role="status">{{ "permission-denied": "Microphone permission was denied. You can keep typing.", "no-speech": "No speech was heard. Try dictation again.", network: "Dictation could not connect. Try again or keep typing.", unsupported: "Dictation is unavailable in this browser. You can keep typing.", unknown: "Dictation stopped. Try again or keep typing." }[dictation.error]}</span> : null}
    {overflow ? <div className={styles.speechNote} role="alert"><p>This dictation would exceed the message limit. Your draft is kept. Copy any text you want to use:</p><textarea aria-label="Dictation that exceeds the message limit" readOnly value={overflow} /><button onClick={() => setOverflow(null)} type="button">Dismiss</button></div> : null}
  </div>;
}
