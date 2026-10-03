"use client";

/**
 * The capture bar pinned over the Notes list on wide screens.
 *
 * Not a second composer: a door to the one canvas. Writing, the microphone
 * and the camera all clear the open note and land in the canvas composer
 * (voice through its consent step first), so capture is one step away even
 * while a note is open. `N` does the same from anywhere on the page. On a
 * phone the canvas itself is the bar at the foot of the screen, so this one
 * is not drawn there.
 */

import { PencilIcon, PhotoIcon, VoiceIcon } from "@/modules/notes/app/workspace/icons";

import styles from "./notes-workspace.module.css";

export function CaptureBar({
  placeholder,
  draft,
  disabled,
  disabledReason,
  voiceAvailable,
  photoAvailable,
  onWrite,
  onVoice,
  onPhoto,
}: {
  placeholder: string;
  /** A draft in the canvas shows here, so nobody starts a second one. */
  draft: string;
  disabled: boolean;
  disabledReason: string | null;
  voiceAvailable: boolean;
  photoAvailable: boolean;
  onWrite: () => void;
  onVoice: () => void;
  onPhoto: () => void;
}) {
  const preview = draft.trim().replace(/\s+/g, " ");
  return (
    <div className={styles.captureBar} data-disabled={disabled ? "" : undefined}>
      <button
        type="button"
        className={styles.captureWrite}
        onClick={onWrite}
        aria-keyshortcuts="N"
        aria-label={preview ? `Keep writing: ${preview.slice(0, 60)}` : "Write a note"}
        title={disabledReason ?? undefined}
      >
        <PencilIcon />
        <span className={styles.captureText} data-draft={preview ? "" : undefined}>
          {preview || placeholder}
        </span>
        <kbd className={styles.kbd} aria-hidden="true">
          N
        </kbd>
      </button>
      <button
        type="button"
        className={styles.captureIcon}
        onClick={onVoice}
        disabled={disabled || !voiceAvailable}
        aria-label="Say a note"
      >
        <VoiceIcon />
      </button>
      {photoAvailable ? (
        <button
          type="button"
          className={styles.captureIcon}
          onClick={onPhoto}
          disabled={disabled}
          aria-label="Photograph a page"
        >
          <PhotoIcon />
        </button>
      ) : null}
    </div>
  );
}
