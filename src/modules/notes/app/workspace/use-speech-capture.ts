"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";

const subscribeNever = () => () => {};

/**
 * Spoken capture.
 *
 * Two things happen at once and they are deliberately separate:
 *
 *   1. The browser's own speech engine turns what is said into text. That
 *      engine belongs to the browser maker, not to Signal, and on Chrome and
 *      Safari it sends the audio to the maker's service. The product says so
 *      before the first word is spoken; this hook never hides it.
 *   2. A microphone stream is opened alongside it, purely to measure loudness
 *      so the bars on screen move with the actual voice. Those samples never
 *      leave the page, are never recorded, and the stream is stopped the
 *      moment recording ends.
 *
 * Signal itself keeps no audio. There is no recording to retain, which is
 * why the interface can say that plainly.
 */

const BAR_COUNT = 28;
const SILENT_BARS = Array.from({ length: BAR_COUNT }, () => 0.12);

type SpeechEngine = "resolving" | "ready" | "unavailable";

export type SpeechError =
  | { kind: "denied" }
  | { kind: "no-microphone" }
  | { kind: "no-speech" }
  | { kind: "interrupted" }
  | { kind: "failed"; message: string };

type RecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
};

function recognitionConstructor(): (new () => RecognitionLike) | null {
  if (typeof window === "undefined") return null;
  const candidate =
    (window as unknown as { SpeechRecognition?: new () => RecognitionLike })
      .SpeechRecognition ??
    (window as unknown as { webkitSpeechRecognition?: new () => RecognitionLike })
      .webkitSpeechRecognition;
  return candidate ?? null;
}

/**
 * The scripted capture the review build uses when the browser has no speech
 * engine of its own.
 *
 * Chromium without Google's speech service, which is what every headless
 * review browser is, has no SpeechRecognition at all. Without this, the
 * capture route that matters most could not be seen or reviewed on a preview
 * build. It runs only when `simulated` is true, which only demo and review
 * mode ever pass.
 */
const REHEARSAL_PHRASES = [
  "Ask the venue whether the ballroom can be accessed from eight in the morning.",
  "If not we lose the whole setup window and the florist has to come back twice.",
  "Also the student launch pricing needs one simple annual option.",
  "Two prices and a discount code is already too many decisions.",
];

export function useSpeechCapture({ simulated = false }: { simulated?: boolean } = {}) {
  // Whether this browser has a speech engine is a fact about the browser.
  // Reading it through the store keeps the server render honest ("resolving")
  // instead of correcting it with a set-state pass after mount.
  const engine = useSyncExternalStore<SpeechEngine>(
    subscribeNever,
    () => (recognitionConstructor() ? "ready" : "unavailable"),
    () => "resolving",
  );
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [interim, setInterim] = useState("");
  const [elapsed, setElapsed] = useState(0);
  const [levels, setLevels] = useState<number[]>(SILENT_BARS);
  const [error, setError] = useState<SpeechError | null>(null);

  const recognitionRef = useRef<RecognitionLike | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const contextRef = useRef<AudioContext | null>(null);
  const frameRef = useRef<number | null>(null);
  const tickRef = useRef<number | null>(null);
  const startedAtRef = useRef(0);
  const finalRef = useRef("");
  const endedRef = useRef<(() => void) | null>(null);

  const teardown = useCallback(() => {
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    frameRef.current = null;
    if (tickRef.current !== null) window.clearInterval(tickRef.current);
    tickRef.current = null;
    for (const track of streamRef.current?.getTracks() ?? []) track.stop();
    streamRef.current = null;
    void contextRef.current?.close().catch(() => {});
    contextRef.current = null;
    const recognition = recognitionRef.current;
    recognitionRef.current = null;
    if (recognition) {
      recognition.onresult = null;
      recognition.onerror = null;
      recognition.onend = null;
      try {
        recognition.abort();
      } catch {
        /* already stopped */
      }
    }
    setLevels(SILENT_BARS);
    setListening(false);
  }, []);

  useEffect(() => teardown, [teardown]);

  const start = useCallback(async (): Promise<boolean> => {
    if (simulated) {
      setError(null);
      setTranscript("");
      setInterim("");
      finalRef.current = "";
      setElapsed(0);
      startedAtRef.current = Date.now();
      let phrase = 0;
      tickRef.current = window.setInterval(() => {
        const elapsedMs = Date.now() - startedAtRef.current;
        setElapsed(elapsedMs);
        // Bars driven by the clock rather than a microphone, so the shape is
        // steady and a screenshot of it is reproducible.
        setLevels(
          Array.from({ length: BAR_COUNT }, (_, bar) =>
            Math.max(0.12, Math.abs(Math.sin(bar * 0.7 + elapsedMs / 260)) * 0.9),
          ),
        );
        const due = Math.floor(elapsedMs / 1400);
        while (phrase < Math.min(due, REHEARSAL_PHRASES.length)) {
          finalRef.current = `${finalRef.current} ${REHEARSAL_PHRASES[phrase]}`.trim();
          phrase += 1;
        }
        setTranscript(finalRef.current);
      }, 120);
      setListening(true);
      return true;
    }
    const Recognition = recognitionConstructor();
    if (!Recognition) {
      setError({ kind: "failed", message: "This browser cannot turn speech into text." });
      return false;
    }
    setError(null);
    setTranscript("");
    setInterim("");
    finalRef.current = "";
    setElapsed(0);

    // Ask for the microphone explicitly. Doing it here rather than letting
    // the speech engine ask means a refusal is a state this product can
    // explain, not a silent nothing.
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const AudioContextCtor =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (AudioContextCtor) {
        const context = new AudioContextCtor();
        contextRef.current = context;
        const analyser = context.createAnalyser();
        analyser.fftSize = 256;
        analyser.smoothingTimeConstant = 0.72;
        context.createMediaStreamSource(stream).connect(analyser);
        const samples = new Uint8Array(analyser.frequencyBinCount);
        const draw = () => {
          analyser.getByteFrequencyData(samples);
          const next: number[] = [];
          const span = Math.floor(samples.length / BAR_COUNT) || 1;
          for (let bar = 0; bar < BAR_COUNT; bar += 1) {
            let sum = 0;
            for (let offset = 0; offset < span; offset += 1) {
              sum += samples[bar * span + offset] ?? 0;
            }
            next.push(Math.max(0.12, Math.min(1, sum / span / 168)));
          }
          setLevels(next);
          frameRef.current = requestAnimationFrame(draw);
        };
        frameRef.current = requestAnimationFrame(draw);
      }
    } catch (cause) {
      const name = cause instanceof Error ? cause.name : "";
      teardown();
      setError(
        name === "NotFoundError" || name === "DevicesNotFoundError"
          ? { kind: "no-microphone" }
          : { kind: "denied" },
      );
      return false;
    }

    const recognition = new Recognition();
    recognition.lang = "en-IE";
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.onresult = (event) => {
      let live = "";
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const result = event.results[index];
        const text = result?.[0]?.transcript ?? "";
        if (result?.isFinal) {
          finalRef.current = `${finalRef.current} ${text}`.replace(/\s+/g, " ").trim();
        } else {
          live += text;
        }
      }
      setTranscript(finalRef.current);
      setInterim(live.trim());
    };
    recognition.onerror = (event) => {
      const code = (event as { error?: string }).error;
      if (code === "no-speech") setError({ kind: "no-speech" });
      else if (code === "not-allowed" || code === "service-not-allowed") {
        setError({ kind: "denied" });
      } else if (code === "aborted") setError({ kind: "interrupted" });
      else setError({ kind: "failed", message: "Speech stopped early." });
    };
    recognition.onend = () => {
      endedRef.current?.();
    };
    recognitionRef.current = recognition;
    try {
      recognition.start();
    } catch {
      teardown();
      setError({ kind: "failed", message: "Speech could not start. Try again." });
      return false;
    }

    startedAtRef.current = Date.now();
    tickRef.current = window.setInterval(
      () => setElapsed(Date.now() - startedAtRef.current),
      200,
    );
    setListening(true);
    return true;
  }, [simulated, teardown]);

  /** Stops cleanly and hands back everything heard, including the last partial phrase. */
  const stop = useCallback(async (): Promise<string> => {
    if (simulated) {
      // Stopping immediately still has to produce something, or the next
      // state would be an empty review with nothing to look at.
      const spoken = finalRef.current.trim() || REHEARSAL_PHRASES[0] || "";
      teardown();
      setTranscript(spoken);
      setInterim("");
      return spoken;
    }
    const recognition = recognitionRef.current;
    if (!recognition) return finalRef.current;
    const settled = new Promise<void>((resolve) => {
      let done = false;
      endedRef.current = () => {
        if (done) return;
        done = true;
        resolve();
      };
      // A speech engine that never fires onend must not hold the interface.
      window.setTimeout(() => {
        if (done) return;
        done = true;
        resolve();
      }, 1_200);
    });
    try {
      recognition.stop();
    } catch {
      /* already stopping */
    }
    await settled;
    endedRef.current = null;
    const spoken = `${finalRef.current} ${interim}`.replace(/\s+/g, " ").trim();
    teardown();
    setTranscript(spoken);
    setInterim("");
    return spoken;
  }, [interim, simulated, teardown]);

  const cancel = useCallback(() => {
    finalRef.current = "";
    setTranscript("");
    setInterim("");
    setError(null);
    teardown();
  }, [teardown]);

  return {
    /** True while the review build is rehearsing rather than listening. */
    simulated,
    engine: simulated ? ("ready" as SpeechEngine) : engine,
    listening,
    /** Everything heard so far, with the phrase currently being spoken on the end. */
    transcript: `${transcript}${interim ? ` ${interim}` : ""}`.trim(),
    elapsed,
    levels,
    error,
    start,
    stop,
    cancel,
  };
}
