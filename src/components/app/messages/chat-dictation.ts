export type ChatDictationError = "permission-denied" | "no-speech" | "network" | "unsupported" | "unknown";

export type ChatDictationCallbacks = Readonly<{
  onText: (text: string) => void;
  onInterim: (text: string) => void;
  onListening: (listening: boolean) => void;
  onError: (error: ChatDictationError) => void;
}>;

type RecognitionAlternativeLike = Readonly<{ transcript?: string }>;
type RecognitionResultLike = Readonly<{
  isFinal: boolean;
  readonly [index: number]: RecognitionAlternativeLike | undefined;
}>;
type RecognitionEventLike = Readonly<{
  resultIndex: number;
  results: ArrayLike<RecognitionResultLike>;
}>;
type RecognitionErrorEventLike = Readonly<{ error?: string }>;

/** Minimal structural surface used from both SpeechRecognition browser variants. */
export type ChatSpeechRecognition = {
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: RecognitionEventLike) => void) | null;
  onerror: ((event: RecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
};

export type ChatDictationAdapter = Readonly<{
  supported: () => boolean;
  start: (callbacks: ChatDictationCallbacks) => boolean;
  stop: () => void;
  cancel: () => void;
}>;

type RecognitionFactory = () => ChatSpeechRecognition | null;

function browserRecognition(): ChatSpeechRecognition | null {
  if (typeof window === "undefined") return null;
  const speechWindow = window as unknown as {
    SpeechRecognition?: new () => ChatSpeechRecognition;
    webkitSpeechRecognition?: new () => ChatSpeechRecognition;
  };
  const Constructor = speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition;
  return Constructor ? new Constructor() : null;
}

function mapError(error: string | undefined): ChatDictationError {
  switch (error) {
    case "not-allowed":
    case "service-not-allowed": return "permission-denied";
    case "no-speech": return "no-speech";
    case "network": return "network";
    default: return "unknown";
  }
}

/** Browser speech adapter. It only returns transcript text; it has no send/action path. */
export function createChatDictationAdapter(createRecognition: RecognitionFactory = browserRecognition): ChatDictationAdapter {
  let generation = 0;
  let recognition: ChatSpeechRecognition | null = null;
  let callbacks: ChatDictationCallbacks | null = null;
  let acceptingResults = false;
  let stopped = false;
  let finalIndices = new Set<number>();

  const detach = (instance: ChatSpeechRecognition) => {
    instance.onresult = null;
    instance.onerror = null;
    instance.onend = null;
  };

  const clearCurrent = (instance: ChatSpeechRecognition, id: number, abort: boolean) => {
    if (generation !== id || recognition !== instance) return;
    acceptingResults = false;
    generation += 1;
    recognition = null;
    callbacks = null;
    finalIndices.clear();
    detach(instance);
    if (abort) {
      try { instance.abort(); } catch { /* Native abort can fail after the browser has closed capture. */ }
    }
  };

  return {
    supported: () => {
      try { return createRecognition() !== null; } catch { return false; }
    },
    start: (nextCallbacks) => {
      if (recognition) return false;
      let instance: ChatSpeechRecognition | null;
      try { instance = createRecognition(); } catch { instance = null; }
      if (!instance) {
        nextCallbacks.onError("unsupported");
        return false;
      }

      const id = ++generation;
      recognition = instance;
      callbacks = nextCallbacks;
      acceptingResults = true;
      stopped = false;
      finalIndices = new Set<number>();
      instance.continuous = true;
      instance.interimResults = true;
      instance.onresult = (event) => {
        if (generation !== id || recognition !== instance || !acceptingResults) return;
        let finalText = "";
        let interimText = "";
        for (let index = event.resultIndex; index < event.results.length; index += 1) {
          const result = event.results[index];
          const text = result?.[0]?.transcript ?? "";
          if (result?.isFinal) {
            if (!finalIndices.has(index)) {
              finalIndices.add(index);
              finalText += text;
            }
          } else {
            interimText += text;
          }
        }
        if (finalText) nextCallbacks.onText(finalText);
        nextCallbacks.onInterim(interimText);
      };
      instance.onerror = (event) => {
        if (generation !== id || recognition !== instance || !acceptingResults) return;
        nextCallbacks.onError(mapError(event.error));
        nextCallbacks.onListening(false);
        clearCurrent(instance, id, true);
      };
      instance.onend = () => {
        if (generation !== id || recognition !== instance) return;
        nextCallbacks.onListening(false);
        nextCallbacks.onInterim("");
        clearCurrent(instance, id, false);
      };

      try {
        instance.start();
        nextCallbacks.onListening(true);
        return true;
      } catch {
        nextCallbacks.onError("unknown");
        nextCallbacks.onListening(false);
        clearCurrent(instance, id, true);
        return false;
      }
    },
    stop: () => {
      const instance = recognition;
      const currentCallbacks = callbacks;
      if (!instance || stopped) return;
      stopped = true;
      acceptingResults = true;
      currentCallbacks?.onListening(false);
      try { instance.stop(); } catch {
        clearCurrent(instance, generation, true);
      }
    },
    cancel: () => {
      const instance = recognition;
      if (!instance) return;
      clearCurrent(instance, generation, true);
    },
  };
}
