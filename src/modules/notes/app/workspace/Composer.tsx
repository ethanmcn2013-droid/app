"use client";

import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ClipboardEvent,
  type DragEvent,
  type KeyboardEvent,
} from "react";

import { MAX_NOTE_BODY_CHARS } from "@/modules/notes/lib/notes-hybrid";
import type { NotesCopy } from "@/modules/notes/lib/notes-copy";
import type { NoteCaptureSource } from "@/modules/notes/server/actions/notes";
import {
  extractNotesFromPhoto,
  extractNotesFromSpeech,
} from "@/modules/notes/server/actions/extraction";
import type { ExtractedNote } from "@/modules/notes/server/extraction/extraction-contract";
import { useSpeechCapture } from "@/modules/notes/app/workspace/use-speech-capture";
import {
  CheckIcon,
  CloseIcon,
  PhotoIcon,
  PlusIcon,
  RotateIcon,
  StopIcon,
  TypedIcon,
  VoiceIcon,
} from "@/modules/notes/app/workspace/icons";

import styles from "./notes-workspace.module.css";

/**
 * The capture composer.
 *
 * One instrument with three ways in. Type, Voice and Photo share a field, a
 * footer and a single primary action, because a person capturing a thought
 * is doing one thing, not choosing between three features.
 *
 * The rule that shapes the whole component: nothing a person captured is
 * cleared until it is somewhere safe. The draft survives navigation, the
 * transcript survives a failed extraction, and the photograph survives
 * everything up to the moment its notes are saved.
 */

export type ComposerMode = "type" | "voice" | "photo";

type Stage =
  | { kind: "idle" }
  | { kind: "recording" }
  | { kind: "processing"; source: "voice" | "photo" }
  | {
      kind: "review";
      source: "voice" | "photo";
      notes: ExtractedNote[];
      separated: boolean;
    };

type PhotoState = {
  dataUrl: string;
  base64: string;
  mediaType: string;
  name: string;
  rotation: 0 | 90 | 180 | 270;
};

const CHARACTER_REVEAL_AT = Math.floor(MAX_NOTE_BODY_CHARS * 0.8);

function formatElapsed(ms: number): string {
  const total = Math.floor(ms / 1000);
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export function Composer({
  copy,
  draft,
  setDraft,
  onSaveDraft,
  onSaveNotes,
  captureStatus,
  captureError,
  clearCaptureError,
  readOnly,
  saveChord,
  photoAvailable,
  speechSeparates,
  demoMode,
  fieldRef,
  onFocusChange,
}: {
  copy: NotesCopy;
  draft: string;
  setDraft: (value: string) => void;
  onSaveDraft: () => Promise<string | null>;
  onSaveNotes: (bodies: string[], source: NoteCaptureSource) => Promise<boolean>;
  captureStatus: "idle" | "pending" | "failed" | "offline" | "saved";
  captureError: string | null;
  clearCaptureError: () => void;
  readOnly: boolean;
  saveChord: string;
  photoAvailable: boolean;
  speechSeparates: boolean;
  demoMode: boolean;
  fieldRef: React.RefObject<HTMLTextAreaElement | null>;
  onFocusChange?: (focused: boolean) => void;
}) {
  const [mode, setMode] = useState<ComposerMode>("type");
  const [stage, setStage] = useState<Stage>({ kind: "idle" });
  const [focused, setFocused] = useState(false);
  const [photo, setPhoto] = useState<PhotoState | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [stageError, setStageError] = useState<string | null>(null);
  const [savingExtracted, setSavingExtracted] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const firstExtractRef = useRef<HTMLTextAreaElement>(null);
  const stageHeadingId = useId();
  const statusId = useId();

  // Review builds run headless Chromium, which has no speech engine at all.
  // Rehearsing there is the only way the spoken-capture route can be seen on
  // a preview; production never passes this.
  const speech = useSpeechCapture({ simulated: demoMode });

  const busy =
    stage.kind === "processing" || captureStatus === "pending" || savingExtracted;

  // The field grows with the writing rather than scrolling inside a fixed
  // box, up to the point where growing further would push the notebook off
  // screen.
  useLayoutEffect(() => {
    const field = fieldRef.current;
    if (!field || mode !== "type") return;
    field.style.height = "auto";
    field.style.height = `${Math.min(field.scrollHeight, 320)}px`;
  }, [draft, fieldRef, mode]);

  useEffect(() => {
    onFocusChange?.(focused);
  }, [focused, onFocusChange]);

  const resetStage = useCallback(() => {
    setStage({ kind: "idle" });
    setStageError(null);
    setPhoto(null);
    setMode("type");
  }, []);

  // ── Voice ───────────────────────────────────────────────────────────

  const startVoice = useCallback(async () => {
    setStageError(null);
    setMode("voice");
    const started = await speech.start();
    if (!started) {
      setMode("type");
      return;
    }
    setStage({ kind: "recording" });
  }, [speech]);

  const processTranscript = useCallback(
    async (transcript: string) => {
      setStage({ kind: "processing", source: "voice" });
      const result = await extractNotesFromSpeech({ transcript });
      if (result.status === "ok") {
        setStage({
          kind: "review",
          source: "voice",
          notes: result.notes,
          separated: result.separated,
        });
        return;
      }
      // The words are still here. Offer them rather than losing them to a
      // model that could not answer.
      setStageError(
        result.status === "unavailable" ? result.message : result.message,
      );
      setStage({
        kind: "review",
        source: "voice",
        notes: [{ body: transcript }],
        separated: false,
      });
    },
    [],
  );

  const stopVoice = useCallback(async () => {
    const transcript = await speech.stop();
    if (!transcript.trim()) {
      setStage({ kind: "idle" });
      setMode("type");
      setStageError(copy.voice.noSpeech);
      return;
    }
    await processTranscript(transcript);
  }, [copy.voice.noSpeech, processTranscript, speech]);

  const cancelVoice = useCallback(() => {
    speech.cancel();
    resetStage();
  }, [resetStage, speech]);

  // ── Photo ───────────────────────────────────────────────────────────

  const acceptFile = useCallback(async (file: File) => {
    setStageError(null);
    if (!file.type.startsWith("image/")) {
      setStageError("That file is not a photo. Signal reads PNG, JPEG and WebP.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setStageError("That photo is larger than 5 MB. A smaller one reads just as well.");
      return;
    }
    const buffer = await file.arrayBuffer();
    let binary = "";
    const bytes = new Uint8Array(buffer);
    for (let index = 0; index < bytes.length; index += 1) {
      binary += String.fromCharCode(bytes[index] as number);
    }
    const base64 = btoa(binary);
    setPhoto({
      dataUrl: `data:${file.type};base64,${base64}`,
      base64,
      mediaType: file.type,
      name: file.name,
      rotation: 0,
    });
    setMode("photo");
  }, []);

  const processPhoto = useCallback(async () => {
    if (!photo) return;
    setStage({ kind: "processing", source: "photo" });
    setStageError(null);
    const result = await extractNotesFromPhoto({
      base64: photo.base64,
      mediaType: photo.mediaType,
    });
    if (result.status === "ok") {
      setStage({
        kind: "review",
        source: "photo",
        notes: result.notes,
        separated: result.separated,
      });
      return;
    }
    // The picture is untouched, so this is a retry, not a loss.
    setStageError(result.message);
    setStage({ kind: "idle" });
  }, [photo]);

  const onPaste = useCallback(
    (event: ClipboardEvent<HTMLDivElement>) => {
      const file = Array.from(event.clipboardData?.files ?? [])[0];
      if (file && file.type.startsWith("image/")) {
        event.preventDefault();
        void acceptFile(file);
      }
    },
    [acceptFile],
  );

  const onDrop = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      setDragOver(false);
      const file = Array.from(event.dataTransfer?.files ?? [])[0];
      if (file) void acceptFile(file);
    },
    [acceptFile],
  );

  // ── Extracted-note review ───────────────────────────────────────────

  useEffect(() => {
    if (stage.kind === "review") {
      window.setTimeout(() => firstExtractRef.current?.focus({ preventScroll: true }), 0);
    }
  }, [stage.kind]);

  const editExtracted = useCallback((index: number, body: string) => {
    setStage((current) =>
      current.kind === "review"
        ? {
            ...current,
            notes: current.notes.map((note, position) =>
              position === index ? { body } : note,
            ),
          }
        : current,
    );
  }, []);

  const removeExtracted = useCallback((index: number) => {
    setStage((current) =>
      current.kind === "review"
        ? { ...current, notes: current.notes.filter((_, position) => position !== index) }
        : current,
    );
  }, []);

  const addExtracted = useCallback(() => {
    setStage((current) =>
      current.kind === "review"
        ? { ...current, notes: [...current.notes, { body: "" }] }
        : current,
    );
  }, []);

  const saveExtracted = useCallback(async () => {
    if (stage.kind !== "review") return;
    const bodies = stage.notes.map((note) => note.body.trim()).filter(Boolean);
    if (!bodies.length) return;
    setSavingExtracted(true);
    const saved = await onSaveNotes(bodies, stage.source);
    setSavingExtracted(false);
    // Only let go of the source once every note is somewhere durable.
    if (saved) resetStage();
  }, [onSaveNotes, resetStage, stage]);

  const onFieldKeyDown = useCallback(
    (event: KeyboardEvent<HTMLTextAreaElement>) => {
      if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
        event.preventDefault();
        void onSaveDraft();
      }
    },
    [onSaveDraft],
  );

  const overLimit = draft.length > MAX_NOTE_BODY_CHARS;
  const showCounter = draft.length >= CHARACTER_REVEAL_AT;
  const canSave = Boolean(draft.trim()) && !overLimit && !readOnly && captureStatus !== "pending";

  const statusLine = (() => {
    if (captureError) return { tone: "error" as const, text: captureError };
    if (stageError) return { tone: "error" as const, text: stageError };
    if (captureStatus === "saved") return { tone: "saved" as const, text: "Saved." };
    if (captureStatus === "offline") {
      return { tone: "error" as const, text: "Offline. Held on this device until you reconnect." };
    }
    if (overLimit) {
      return {
        tone: "error" as const,
        text: `That is ${(draft.length - MAX_NOTE_BODY_CHARS).toLocaleString("en-IE")} characters over. Trim it or split it in two.`,
      };
    }
    return null;
  })();

  return (
    <div className={styles.composerBand}>
      <div
        className={styles.composer}
        data-focused={focused || undefined}
        data-mode={mode}
        data-notes-composer=""
        onPaste={onPaste}
        onDragOver={(event) => {
          if (stage.kind !== "idle" || !photoAvailable) return;
          event.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
      >
        {stage.kind === "idle" && !photo ? (
          <>
            <label className={styles.srOnly} htmlFor="notes-capture">
              Write a note
            </label>
            <textarea
              id="notes-capture"
              // Claimed by EarlyCaptureBootstrap before hydration.
              data-notes-hybrid-capture=""
              ref={fieldRef}
              className={styles.composerField}
              value={draft}
              readOnly={readOnly}
              placeholder={
                readOnly ? "This review notebook is read-only." : copy.capture.placeholder
              }
              rows={2}
              maxLength={MAX_NOTE_BODY_CHARS + 500}
              aria-describedby={statusLine ? statusId : undefined}
              aria-invalid={overLimit || undefined}
              onChange={(event) => {
                setDraft(event.target.value);
                if (captureError) clearCaptureError();
              }}
              onKeyDown={onFieldKeyDown}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
            />
            {dragOver ? (
              <p className={styles.dropTarget} data-over="true">
                Drop the photo to read it
              </p>
            ) : null}
          </>
        ) : null}

        {stage.kind === "recording" ? (
          <div className={styles.captureStage}>
            <h2 className={styles.srOnly} id={stageHeadingId}>
              Recording a note
            </h2>
            <div className={styles.recordRow}>
              <span className={styles.recordDot} aria-hidden="true" />
              <span className={styles.recordElapsed}>{formatElapsed(speech.elapsed)}</span>
              <span className={styles.recordLabel}>
                {speech.simulated ? "Rehearsing in review mode" : "Listening"}
              </span>
              <span className={styles.levels} aria-hidden="true">
                {speech.levels.map((level, index) => (
                  <span
                    key={index}
                    className={styles.level}
                    data-live={level > 0.12 || undefined}
                    style={{ transform: `scaleY(${Math.max(0.12, level).toFixed(2)})` }}
                  />
                ))}
              </span>
            </div>
            <p className={speech.transcript ? styles.transcript : styles.transcriptEmpty}>
              {speech.transcript || "Listening. Speak whenever you are ready."}
            </p>
            <div className={styles.stageActions}>
              <button type="button" className={styles.quietButton} onClick={cancelVoice}>
                Cancel
              </button>
              <div className={styles.stageActionsRight}>
                <button type="button" className={styles.primaryButton} onClick={() => void stopVoice()}>
                  <StopIcon />
                  Stop and read it back
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {stage.kind === "idle" && photo ? (
          <div className={styles.captureStage}>
            {/* eslint-disable-next-line @next/next/no-img-element -- a local
                data URL that never touches the network; next/image would
                need a loader and a round trip to render bytes we already hold. */}
            <img
              className={styles.photoPreview}
              src={photo.dataUrl}
              alt={`Photo to read: ${photo.name}`}
              data-rotation={photo.rotation}
            />
            <div className={styles.stageActions}>
              <button
                type="button"
                className={styles.quietButton}
                onClick={() => {
                  setPhoto(null);
                  setMode("type");
                }}
              >
                Remove
              </button>
              <div className={styles.stageActionsRight}>
                <button
                  type="button"
                  className={styles.quietButton}
                  onClick={() =>
                    setPhoto((current) =>
                      current
                        ? { ...current, rotation: (((current.rotation + 90) % 360) as 0 | 90 | 180 | 270) }
                        : current,
                    )
                  }
                >
                  <RotateIcon />
                  Rotate
                </button>
                <button
                  type="button"
                  className={styles.quietButton}
                  onClick={() => fileInputRef.current?.click()}
                >
                  Replace
                </button>
                <button type="button" className={styles.primaryButton} onClick={() => void processPhoto()}>
                  Read this photo
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {stage.kind === "processing" ? (
          <div className={styles.captureStage}>
            <p className={styles.processing} role="status">
              <span className={styles.spinner} aria-hidden="true" />
              {stage.source === "voice"
                ? "Turning this into clear notes…"
                : "Reading the writing in this photo…"}
            </p>
            <div className={styles.stageActions}>
              <button
                type="button"
                className={styles.quietButton}
                onClick={() => {
                  // The transcript and the photo are both still held, so
                  // stopping here costs nothing but the wait.
                  setStage({ kind: "idle" });
                }}
              >
                Stop waiting
              </button>
            </div>
          </div>
        ) : null}

        {stage.kind === "review" ? (
          <div className={styles.captureStage}>
            <div className={styles.extractHeader}>
              <h2 className={styles.extractTitle} id={stageHeadingId}>
                {stage.notes.length === 1 ? "One note from this" : `${stage.notes.length} notes from this`}
              </h2>
              <span className={styles.extractHint}>
                {stage.separated
                  ? "Edit anything that is not quite right."
                  : stage.source === "voice"
                    ? "Kept as you said it, unseparated."
                    : "Kept as it was read."}
              </span>
            </div>
            <ul className={styles.extractList}>
              {stage.notes.map((note, index) => (
                <li className={styles.extractItem} key={index}>
                  <label className={styles.srOnly} htmlFor={`${stageHeadingId}-note-${index}`}>
                    Note {index + 1} of {stage.notes.length}
                  </label>
                  <textarea
                    id={`${stageHeadingId}-note-${index}`}
                    ref={index === 0 ? firstExtractRef : undefined}
                    className={styles.extractField}
                    value={note.body}
                    rows={1}
                    onChange={(event) => {
                      editExtracted(index, event.target.value);
                      const field = event.target;
                      field.style.height = "auto";
                      field.style.height = `${field.scrollHeight}px`;
                    }}
                  />
                  <button
                    type="button"
                    className={styles.removeButton}
                    onClick={() => removeExtracted(index)}
                    aria-label={`Remove note ${index + 1}`}
                  >
                    <CloseIcon />
                  </button>
                </li>
              ))}
            </ul>
            <div className={styles.stageActions}>
              <button type="button" className={styles.quietButton} onClick={addExtracted}>
                <PlusIcon />
                Add another
              </button>
              <div className={styles.stageActionsRight}>
                <button type="button" className={styles.quietButton} onClick={resetStage}>
                  Discard
                </button>
                <button
                  type="button"
                  className={styles.primaryButton}
                  onClick={() => void saveExtracted()}
                  disabled={savingExtracted || !stage.notes.some((note) => note.body.trim())}
                >
                  <CheckIcon />
                  {savingExtracted
                    ? "Saving…"
                    : stage.notes.length === 1
                      ? "Save note"
                      : `Save ${stage.notes.filter((note) => note.body.trim()).length} notes`}
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {stage.kind === "idle" && !photo ? (
          <div className={styles.composerFooter}>
            <div className={styles.modeGroup}>
              <button
                type="button"
                className={styles.modeButton}
                data-active={mode === "type" || undefined}
                onClick={() => {
                  setMode("type");
                  fieldRef.current?.focus();
                }}
                aria-pressed={mode === "type"}
              >
                <TypedIcon />
                <span>Type</span>
              </button>
              <button
                type="button"
                className={styles.modeButton}
                onClick={() => void startVoice()}
                disabled={readOnly || speech.engine === "unavailable" || busy}
                title={speech.engine === "unavailable" ? copy.voice.unavailable : undefined}
              >
                <VoiceIcon />
                <span>Voice</span>
              </button>
              <button
                type="button"
                className={styles.modeButton}
                onClick={() => fileInputRef.current?.click()}
                disabled={readOnly || busy}
              >
                <PhotoIcon />
                <span>Photo</span>
              </button>
            </div>
            <div className={styles.composerRight}>
              {showCounter ? (
                <span
                  className={styles.counter}
                  data-near={!overLimit || undefined}
                  data-over={overLimit || undefined}
                  aria-live="polite"
                >
                  {draft.length.toLocaleString("en-IE")} / {MAX_NOTE_BODY_CHARS.toLocaleString("en-IE")}
                </span>
              ) : null}
              <button
                type="button"
                className={styles.primaryButton}
                onClick={() => void onSaveDraft()}
                disabled={!canSave}
                title={`Save this note (${saveChord} + Enter)`}
              >
                {captureStatus === "pending" ? "Saving…" : "Save note"}
                <span className={styles.keycap} aria-hidden="true">
                  {saveChord}⏎
                </span>
              </button>
            </div>
          </div>
        ) : null}

        {statusLine ? (
          <p className={styles.composerStatus} data-tone={statusLine.tone} id={statusId} role="status">
            {statusLine.text}
          </p>
        ) : null}
      </div>

      <input
        ref={fileInputRef}
        className={styles.fileInput}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/heic,image/heif"
        aria-label="Choose a photo to read"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file) void acceptFile(file);
        }}
      />
      <input
        ref={cameraInputRef}
        className={styles.fileInput}
        type="file"
        accept="image/*"
        capture="environment"
        aria-label="Take a photo to read"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file) void acceptFile(file);
        }}
      />
      {!photoAvailable ? (
        <p className={styles.srOnly}>
          Reading photos is not switched on for this account yet.
        </p>
      ) : null}
      {!speechSeparates ? (
        <p className={styles.srOnly}>
          Spoken notes are kept as one note on this account.
        </p>
      ) : null}
    </div>
  );
}
