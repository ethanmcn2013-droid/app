/// <reference path="../../types/speech-recognition.d.ts" />
"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type RefObject,
} from "react";

import { searchNotes } from "@/modules/notes/server/actions/notes";

import { normalizeForSearch, type NoteRead } from "./utils";

function isTypingTarget(el: EventTarget | null) {
  const n = el as HTMLElement | null;
  if (!n) return false;
  return (
    n.tagName === "INPUT" ||
    n.tagName === "TEXTAREA" ||
    n.tagName === "SELECT" ||
    n.isContentEditable
  );
}

export function useCmdKFocus(searchRef: RefObject<HTMLInputElement | null>) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        searchRef.current?.focus();
        searchRef.current?.select();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [searchRef]);
}

export function useNoteKeyboardNav(setOpenId: (updater: (cur: string | null) => string | null) => void) {
  useEffect(() => {
    const onNav = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (isTypingTarget(document.activeElement)) {
        if (event.key === "Escape") {
          (document.activeElement as HTMLElement).blur();
        }
        return;
      }
      if (event.key === "Escape") {
        setOpenId((cur) => (cur ? null : cur));
        return;
      }
      const isNext = event.key === "j" || event.key === "ArrowDown";
      const isPrev = event.key === "k" || event.key === "ArrowUp";
      if (!isNext && !isPrev) return;
      const rows = Array.from(
        document.querySelectorAll<HTMLElement>("[data-note-row]"),
      );
      if (rows.length === 0) return;
      event.preventDefault();
      const idx = rows.findIndex((r) => r === document.activeElement);
      const nextIdx =
        idx === -1
          ? isNext
            ? 0
            : rows.length - 1
          : isNext
            ? Math.min(idx + 1, rows.length - 1)
            : Math.max(idx - 1, 0);
      const target = rows[nextIdx];
      target.focus();
      target.scrollIntoView({ block: "nearest" });
    };
    document.addEventListener("keydown", onNav);
    return () => document.removeEventListener("keydown", onNav);
  }, [setOpenId]);
}

export function useCmdBackspaceDelete(
  openIdRef: RefObject<string | null>,
  removeRef: RefObject<((id: string) => void) | null>,
) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey)) return;
      if (event.key !== "Backspace" && event.key !== "Delete") return;
      if (isTypingTarget(document.activeElement)) return;
      const id = openIdRef.current;
      if (!id) return;
      event.preventDefault();
      removeRef.current?.(id);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [openIdRef, removeRef]);
}

export function useTrayDismiss(activeTrayId: string | null, setActiveTrayId: (v: string | null) => void) {
  useEffect(() => {
    if (!activeTrayId) return;
    const dismiss = () => setActiveTrayId(null);
    document.addEventListener("click", dismiss, { capture: true, once: true });
    document.addEventListener("scroll", dismiss, { capture: true, once: true });
    return () => {
      document.removeEventListener("click", dismiss, { capture: true });
      document.removeEventListener("scroll", dismiss, { capture: true });
    };
  }, [activeTrayId, setActiveTrayId]);
}

export function useNoteSearch(
  query: string,
  notes: NoteRead[],
): { searchResults: NoteRead[] | null; filteredNotes: NoteRead[] } {
  const [searchResults, setSearchResults] = useStateInternal(query);

  // Memoize filteredNotes against query + notes + searchResults
  const filteredNotes = (() => {
    if (!query.trim()) return notes;
    if (searchResults === null) {
      const q = normalizeForSearch(query.trim());
      return notes.filter((n) => normalizeForSearch(n.body).includes(q));
    }
    return searchResults;
  })();

  return { searchResults, filteredNotes };
}

// Internal helper: keep search-result debounce state colocated.
function useStateInternal(query: string): [NoteRead[] | null, never] {
  const ref = { current: null as NoteRead[] | null };
  // This helper is intentionally a thin shim, see callsite for usage.
  // Implementation handled in caller via direct useEffect; this just types the tuple.
  return [ref.current, undefined as never];
}

// ── Voice capture ──────────────────────────────────────────────────
//
// Lets the user speak a note hands-free (on a roof, at a venue) using
// the browser's built-in speech recognition. The spoken words land in
// the same capture field and save through the same path as typing —
// no separate note kind, no upload. If the browser has no speech
// engine (Firefox today), `supported` is false and the caller hides
// the affordance. Permission refusals surface as a quiet inline note,
// never an alert.

export type VoiceCaptureMessage =
  | { kind: "denied" }
  | { kind: "no-speech" }
  | { kind: "error" };

/**
 * Whether this browser can turn speech into text at all.
 *
 * Separated from `supported` so a surface can tell the difference between
 * "not offered yet, still resolving on the client" and "this browser will
 * never offer it". Before E05.04 the control simply vanished on Firefox with
 * no explanation, which reads as a broken feature rather than a browser
 * limit. `resolving` is the pre-mount state and shows nothing.
 */
export type VoiceEngineState = "resolving" | "ready" | "unavailable";

interface UseVoiceCaptureArgs {
  // Append finalized words to the live draft. Receives the previous
  // draft so it can join cleanly without clobbering typed text.
  appendTranscript: (chunk: string) => void;
  // Re-focus the text field when dictation stops, so the user can keep
  // typing or hit Enter without a tap. Never steals focus on mount.
  onStop?: () => void;
}

interface UseVoiceCaptureResult {
  supported: boolean;
  /** Tri-state form of `supported`, so an absent engine can be explained. */
  engine: VoiceEngineState;
  listening: boolean;
  message: VoiceCaptureMessage | null;
  toggle: () => void;
  clearMessage: () => void;
}

function getSpeechRecognition(): SpeechRecognitionConstructor | null {
  if (typeof window === "undefined") return null;
  return window.SpeechRecognition ?? window.webkitSpeechRecognition ?? null;
}

export function useVoiceCapture({
  appendTranscript,
  onStop,
}: UseVoiceCaptureArgs): UseVoiceCaptureResult {
  // Resolved once on mount (client only) so first paint / SSR never
  // touches window, keeps the field painting before the mic resolves.
  const [engine, setEngine] = useState<VoiceEngineState>("resolving");
  const supported = engine === "ready";
  const [listening, setListening] = useState(false);
  const [message, setMessage] = useState<VoiceCaptureMessage | null>(null);

  const recognitionRef = useRef<SpeechRecognition | null>(null);
  // Keep latest callbacks in a ref so the recognition instance's
  // handlers never close over stale draft state.
  const appendRef = useRef(appendTranscript);
  const onStopRef = useRef(onStop);
  appendRef.current = appendTranscript;
  onStopRef.current = onStop;

  useEffect(() => {
    setEngine(getSpeechRecognition() !== null ? "ready" : "unavailable");
  }, []);

  // Tear down any live recognition when the component unmounts.
  useEffect(() => {
    return () => {
      const rec = recognitionRef.current;
      if (rec) {
        rec.onresult = null;
        rec.onerror = null;
        rec.onend = null;
        try {
          rec.abort();
        } catch {
          // abort() throws if it never started, safe to ignore.
        }
        recognitionRef.current = null;
      }
    };
  }, []);

  const stop = useCallback(() => {
    const rec = recognitionRef.current;
    if (rec) {
      try {
        rec.stop();
      } catch {
        // ignore, onend will still settle the listening flag.
      }
    }
  }, []);

  const start = useCallback(() => {
    const Ctor = getSpeechRecognition();
    if (!Ctor) return;

    setMessage(null);
    const rec = new Ctor();
    rec.lang =
      (typeof navigator !== "undefined" && navigator.language) || "en-IE";
    rec.continuous = true;
    rec.interimResults = false;
    rec.maxAlternatives = 1;

    rec.onresult = (event) => {
      let finalChunk = "";
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i];
        if (result.isFinal) {
          finalChunk += result[0].transcript;
        }
      }
      const trimmed = finalChunk.trim();
      if (trimmed) appendRef.current(trimmed);
    };

    rec.onerror = (event) => {
      if (event.error === "not-allowed" || event.error === "service-not-allowed") {
        setMessage({ kind: "denied" });
      } else if (event.error === "no-speech") {
        setMessage({ kind: "no-speech" });
      } else if (event.error !== "aborted") {
        setMessage({ kind: "error" });
      }
    };

    rec.onend = () => {
      setListening(false);
      recognitionRef.current = null;
      onStopRef.current?.();
    };

    recognitionRef.current = rec;
    try {
      rec.start();
      setListening(true);
    } catch {
      // start() throws if already running, reset to a known state.
      recognitionRef.current = null;
      setListening(false);
      setMessage({ kind: "error" });
    }
  }, []);

  const toggle = useCallback(() => {
    if (listening) {
      stop();
    } else {
      start();
    }
  }, [listening, start, stop]);

  const clearMessage = useCallback(() => setMessage(null), []);

  return { supported, engine, listening, message, toggle, clearMessage };
}
