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
  | { kind: "voice-consent" }
  | { kind: "recording" }
  | {
      kind: "processing";
      source: "voice" | "photo";
      /** Held here so no exit from this stage can drop what was said. */
      transcript: string;
    }
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

const MAX_READ_EDGE = 2000;

/**
 * Decode, downscale and re-encode a chosen photo.
 *
 * Returns null when the file is not a decodable image, which is the only
 * honest answer for something the reader could never have read.
 */
async function prepareForReading(file: File): Promise<PhotoState | null> {
  const url = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = reject;
      element.src = url;
    });
    const longest = Math.max(image.naturalWidth, image.naturalHeight);
    const scale = longest > MAX_READ_EDGE ? MAX_READ_EDGE / longest : 1;
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(image.naturalWidth * scale);
    canvas.height = Math.round(image.naturalHeight * scale);
    const context = canvas.getContext("2d");
    if (!context) return null;
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.86);
    return {
      dataUrl,
      base64: dataUrl.slice(dataUrl.indexOf(",") + 1),
      mediaType: "image/jpeg",
      name: file.name,
      rotation: 0,
    };
  } catch {
    return null;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * Re-encode a rotated photo so the bytes match the preview.
 *
 * Falls back to the original on any failure, because a picture read the
 * wrong way up is still better than no picture at all.
 */
async function bakeRotation(photo: PhotoState): Promise<PhotoState> {
  if (photo.rotation === 0) return photo;
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = reject;
      element.src = photo.dataUrl;
    });
    const turned = photo.rotation === 90 || photo.rotation === 270;
    const canvas = document.createElement("canvas");
    canvas.width = turned ? image.naturalHeight : image.naturalWidth;
    canvas.height = turned ? image.naturalWidth : image.naturalHeight;
    const context = canvas.getContext("2d");
    if (!context) return photo;
    context.translate(canvas.width / 2, canvas.height / 2);
    context.rotate((photo.rotation * Math.PI) / 180);
    context.drawImage(image, -image.naturalWidth / 2, -image.naturalHeight / 2);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.9);
    return {
      ...photo,
      dataUrl,
      base64: dataUrl.slice(dataUrl.indexOf(",") + 1),
      mediaType: "image/jpeg",
      rotation: 0,
    };
  } catch {
    return photo;
  }
}

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
  earlierDeviceCopy,
}: {
  copy: NotesCopy;
  draft: string;
  setDraft: (value: string) => void;
  onSaveDraft: () => Promise<string | null>;
  onSaveNotes: (
    bodies: string[],
    source: NoteCaptureSource,
  ) => Promise<{ ok: boolean; remaining: string[] }>;
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
  earlierDeviceCopy?: string;
}) {
  const [mode, setMode] = useState<ComposerMode>("type");
  const [stage, setStage] = useState<Stage>({ kind: "idle" });
  const [focused, setFocused] = useState(false);
  const [photo, setPhoto] = useState<PhotoState | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [stageError, setStageError] = useState<string | null>(null);
  const [savingExtracted, setSavingExtracted] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const firstExtractRef = useRef<HTMLTextAreaElement>(null);
  const stageHeadingId = useId();
  const statusId = useId();
  const voiceNoteId = useId();
  const photoNoteId = useId();

  // Review builds run headless Chromium, which has no speech engine at all.
  // Rehearsing there is the only way the spoken-capture route can be seen on
  // a preview; production never passes this.
  const speech = useSpeechCapture({ simulated: demoMode });

  const busy =
    stage.kind === "processing" || captureStatus === "pending" || savingExtracted;

  // A route that is closed says so on the page, not in a tooltip. A disabled
  // button carrying a title attribute explains itself to a mouse pointer and
  // to nothing else: touch never hovers, and a disabled control is not in the
  // tab order, so a keyboard never reaches the tooltip either. The line below
  // the composer is visible to everyone, and the button points at it.
  const voiceUnavailable = speech.engine === "unavailable";

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

  const openVoiceConsent = useCallback(() => {
    setStageError(null);
    setMode("voice");
    setStage({ kind: "voice-consent" });
  }, []);

  const startVoice = useCallback(async () => {
    const started = await speech.start();
    if (!started) {
      setMode("type");
      // A refused microphone used to do nothing at all: the button was
      // pressed, the state was set, and nobody was told why it did not open.
      setStageError(
        speech.error?.kind === "denied"
          ? copy.voice.denied
          : speech.error?.kind === "no-microphone"
            ? "No microphone was found. Typing works everywhere."
            : copy.voice.failed,
      );
      return;
    }
    setStage({ kind: "recording" });
  }, [copy.voice.denied, copy.voice.failed, speech]);

  const processTranscript = useCallback(
    async (transcript: string) => {
      setStage({ kind: "processing", source: "voice", transcript });
      const result = await extractNotesFromSpeech({ transcript });
      const stillWaiting = (current: Stage) =>
        current.kind === "processing" &&
        current.source === "voice" &&
        current.transcript === transcript;
      if (result.status === "ok") {
        setStage((current) =>
          stillWaiting(current)
            ? {
                kind: "review",
                source: "voice",
                notes: result.notes,
                separated: result.separated,
              }
            : current,
        );
        return;
      }
      // The words are still here. Offer them rather than losing them to a
      // model that could not answer.
      setStage((current) => {
        if (!stillWaiting(current)) return current;
        return {
          kind: "review",
          source: "voice",
          notes: [{ body: transcript }],
          separated: false,
        };
      });
      setStageError(result.message);
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
      setStageError("That file is not a photo. PNG, JPEG and WebP all work.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setStageError("That photo is larger than 5 MB. A smaller one reads just as well.");
      return;
    }
    // Downscale before encoding. A phone photo is 3-5 MB of pixels that a
    // reader does not need: text stays legible well under 2000px on the long
    // edge, and the smaller payload is the difference between this working
    // on a phone connection and timing out on one.
    const prepared = await prepareForReading(file);
    if (!prepared) {
      setStageError("That photo could not be opened. Try another one.");
      return;
    }
    setPhoto(prepared);
    setMode("photo");
  }, []);

  const processPhoto = useCallback(async () => {
    if (!photo) return;
    setStage({ kind: "processing", source: "photo", transcript: "" });
    setStageError(null);
    // Send what the person is looking at. Rotating only the preview meant a
    // sideways page was corrected on screen and read sideways by the model.
    const oriented = await bakeRotation(photo);
    const result = await extractNotesFromPhoto({
      base64: oriented.base64,
      mediaType: oriented.mediaType,
    });
    const stillReading = (current: Stage) =>
      current.kind === "processing" && current.source === "photo";
    if (result.status === "ok") {
      setStage((current) =>
        stillReading(current)
          ? {
              kind: "review",
              source: "photo",
              notes: result.notes,
              separated: result.separated,
            }
          : current,
      );
      return;
    }
    // The picture is untouched, so this is a retry, not a loss.
    setStage((current) => (stillReading(current) ? { kind: "idle" } : current));
    setStageError(result.message);
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
    const result = await onSaveNotes(bodies, stage.source);
    setSavingExtracted(false);
    // Only let go of the source once every note is somewhere durable. What
    // did not land stays on screen, and only that, so a retry cannot save a
    // second copy of the ones that did.
    if (result.ok) {
      resetStage();
      return;
    }
    setStage((current) =>
      current.kind === "review"
        ? { ...current, notes: result.remaining.map((body) => ({ body })) }
        : current,
    );
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
      return {
        tone: "saved" as const,
        text: "Offline. Held on this device, and saved as soon as you reconnect.",
      };
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
      {earlierDeviceCopy ? (
        <details className={styles.panel}>
          <summary>Earlier device copy</summary>
          <p className={styles.panelBody}>This private copy has no project. Copy any words you want to keep before choosing where to save them.</p>
          <textarea aria-label="Earlier private device copy" className={styles.detailField} readOnly value={earlierDeviceCopy} />
        </details>
      ) : null}
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

        {stage.kind === "voice-consent" ? (
          <div
            className={styles.captureStage}
            role="group"
            aria-labelledby={stageHeadingId}
            aria-describedby={`${stageHeadingId}-detail`}
          >
            <div className={styles.consentHeading}>
              <span className={styles.consentIcon} aria-hidden="true">
                <VoiceIcon />
              </span>
              <div>
                <h2 className={styles.consentTitle} id={stageHeadingId}>
                  Before you record
                </h2>
                <p className={styles.consentSummary}>Nothing is listening yet.</p>
              </div>
            </div>
            <p className={styles.captureDisclosure} id={`${stageHeadingId}-detail`}>
              {copy.voice.disclosure}
              {speechSeparates
                ? " After you stop, the transcript is sent to Anthropic to separate it into notes."
                : " After you stop, the transcript is kept as one note."}
            </p>
            <div className={styles.consentFacts}>
              <span>Your browser asks for microphone access only after you start.</span>
              <span>Cancel now and no audio or words leave this device.</span>
            </div>
            <div className={styles.stageActions}>
              <button type="button" className={styles.quietButton} onClick={resetStage}>
                Cancel
              </button>
              <button type="button" className={styles.primaryButton} onClick={() => void startVoice()}>
                <VoiceIcon />
                Start recording
              </button>
            </div>
          </div>
        ) : null}

        {stage.kind === "recording" ? (
          <div className={styles.captureStage}>
            <h2 className={styles.srOnly} id={stageHeadingId}>
              Recording a note
            </h2>
            <div className={styles.recordRow}>
              <span className={styles.recordDot} aria-hidden="true" />
              <span className={styles.recordElapsed}>{formatElapsed(speech.elapsed)}</span>
              <span className={styles.recordLabel} role="status">
                {speech.simulated ? "Practice run, nothing is saved" : "Listening"}
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
            <p className={styles.captureDisclosure}>
              Signal Studio keeps no audio. Stop ends microphone capture; Cancel discards this transcript.
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
            <div className={styles.photoDisclosure} role="note">
              <strong>Still on this device.</strong>
              <span>
                Read this photo sends a resized copy to Anthropic to turn the
                visible writing into text. Signal Studio does not keep the
                photo; only notes you choose to save are stored.
              </span>
            </div>
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
                  Read with AI
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
                  // Give the words back before letting go of the stage. The
                  // photo is state and survives; the transcript is not, and
                  // dropping straight to idle used to throw a three-minute
                  // dictation away with one click.
                                if (stage.source === "voice") {
                    const spoken = stage.transcript.trim();
                    if (spoken) {
                      setStage({
                        kind: "review",
                        source: "voice",
                        notes: [{ body: spoken }],
                        separated: false,
                      });
                      setStageError(
                        "That took too long, so your words are here as they were spoken.",
                      );
                      return;
                    }
                  }
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
                onClick={openVoiceConsent}
                disabled={readOnly || voiceUnavailable || busy}
                aria-describedby={voiceUnavailable ? voiceNoteId : undefined}
              >
                <VoiceIcon />
                <span>Voice</span>
              </button>
              <button
                type="button"
                className={styles.modeButton}
                onClick={() => fileInputRef.current?.click()}
                disabled={readOnly || busy || !photoAvailable}
                aria-describedby={photoAvailable ? undefined : photoNoteId}
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
      {voiceUnavailable || !photoAvailable ? (
        <div className={styles.composerNotes}>
          {voiceUnavailable ? (
            <p className={styles.composerNote} id={voiceNoteId}>
              {copy.voice.unavailable}
            </p>
          ) : null}
          {!photoAvailable ? (
            <p className={styles.composerNote} id={photoNoteId}>
              Reading photos is not switched on for this account yet.
              {voiceUnavailable ? " Typing works everywhere." : " Typing and voice both work."}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
