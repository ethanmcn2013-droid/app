"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createChatDictationAdapter, type ChatDictationError } from "./chat-dictation";

export type UseChatDictationResult = Readonly<{
  supported: boolean;
  listening: boolean;
  interim: string;
  error: ChatDictationError | null;
  start: () => void;
  stop: () => void;
  cancel: () => void;
}>;

/**
 * Browser dictation for an editable draft. `start` must be called from an explicit
 * user gesture. Final text is handed to `onText`; this hook never sends a message.
 */
export function useChatDictation(contextKey: string, onText: (text: string) => void): UseChatDictationResult {
  const [adapter] = useState(() => createChatDictationAdapter());
  const onTextRef = useRef(onText);
  useLayoutEffect(() => { onTextRef.current = onText; }, [onText]);
  const scopeRef = useRef(0);
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");
  const [error, setError] = useState<ChatDictationError | null>(null);

  useEffect(() => {
    const scope = ++scopeRef.current;
    queueMicrotask(() => { if (scopeRef.current !== scope) return; setSupported(adapter.supported()); setListening(false); setInterim(""); setError(null); });
    return () => {
      if (scopeRef.current === scope) scopeRef.current += 1;
      adapter.cancel();
    };
  }, [adapter, contextKey]);

  const start = useCallback(() => {
    const scope = scopeRef.current;
    if (!adapter.supported()) {
      setSupported(false);
      setError("unsupported");
      return;
    }
    setSupported(true);
    setError(null);
    setInterim("");
    adapter.start({
      onText: (text) => { if (scopeRef.current === scope) onTextRef.current(text); },
      onInterim: (text) => { if (scopeRef.current === scope) setInterim(text); },
      onListening: (next) => { if (scopeRef.current === scope) setListening(next); },
      onError: (next) => { if (scopeRef.current === scope) setError(next); },
    });
  }, [adapter]);

  const stop = useCallback(() => adapter.stop(), [adapter]);
  const cancel = useCallback(() => {
    scopeRef.current += 1;
    adapter.cancel();
    setListening(false);
    setInterim("");
    setError(null);
  }, [adapter]);

  return { supported, listening, interim, error, start, stop, cancel };
}
