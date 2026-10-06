"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  FILE_KIND_LABEL,
  addedByLabel,
  formatAddedDate,
  formatBytes,
  sourceLabel,
  type ProjectFile,
} from "@/lib/projects/project-files";
import { FileGlyph, FilesIcon } from "./files-parts";
import styles from "./files.module.css";

/**
 * One file, looked at closely: what it is, where it lives, who added it and
 * the task it sits on, with the ways to open it. On a wide page it is docked
 * beside the list; on a narrow one it slides in as a sheet (a dialog: focus
 * moves in, Tab stays inside, Escape closes and focus goes back to the row).
 *
 * The parent keys this component by file, so its small state (copied, a
 * picture that failed) starts fresh for each one.
 *
 * Nothing new is fetched to draw it. An uploaded image is shown through the
 * same authorized attachment route the Open button uses; every other kind
 * shows its facts and opens where it lives. Link hrefs arrive already
 * checked by the server read and are used as given.
 */

/** Raster images the attachment route serves inline. SVG is never drawn. */
const INLINE_IMAGE = /^image\/(png|jpe?g|gif|webp)$/;

function canShowImage(file: ProjectFile): boolean {
  return file.storage === "signal" && file.href !== null && file.href.startsWith("/api/attachments/") && INLINE_IMAGE.test(file.mimeType ?? "");
}

function whereItLives(file: ProjectFile): string {
  if (file.storage === "google_drive") return "Google Drive, linked not copied";
  if (file.storage === "link") return `A link to ${sourceLabel(file)}`;
  return "Uploaded to Signal Studio";
}

export function FilePreview({
  file,
  mode,
  sample,
  onClose,
}: {
  file: ProjectFile;
  mode: "docked" | "sheet";
  /** Review and demo: sample files with nothing to open. */
  sample: boolean;
  onClose?: () => void;
}) {
  const sheet = mode === "sheet";
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const [copied, setCopied] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);

  useEffect(() => {
    if (sheet) closeRef.current?.focus({ preventScroll: true });
  }, [sheet, file.id]);

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 2000);
    return () => window.clearTimeout(timer);
  }, [copied]);

  async function copyLink() {
    if (!file.href) return;
    try {
      await navigator.clipboard.writeText(new URL(file.href, window.location.origin).href);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  function onKeyDown(event: React.KeyboardEvent) {
    if (!sheet) return;
    if (event.key === "Escape") {
      event.preventDefault();
      onClose?.();
      return;
    }
    if (event.key !== "Tab") return;
    const stops = panelRef.current?.querySelectorAll<HTMLElement>("a[href], button:not([disabled])");
    if (!stops || stops.length === 0) return;
    const first = stops[0]!;
    const last = stops[stops.length - 1]!;
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  const who = addedByLabel(file);
  const titleId = `files-preview-title-${mode}`;
  const openLabel = file.storage === "signal" ? "Open file" : file.storage === "google_drive" ? "Open in Google Drive" : "Open link";
  const showImage = canShowImage(file) && !imageFailed;

  const panel = (
    <div ref={panelRef} className={styles.panel} data-mode={mode}>
      <header className={styles.panelHead}>
        <FileGlyph kind={file.kind} size={36} />
        <div className={styles.panelTitleBox}>
          <h2 id={titleId} className={styles.panelTitle} title={file.title}>{file.title}</h2>
          <p className={styles.panelMeta}>
            <span>{FILE_KIND_LABEL[file.kind]}</span>
            <span>{sourceLabel(file)}</span>
            <span>Added {formatAddedDate(file.addedAt)}</span>
          </p>
        </div>
        {sheet ? (
          <button ref={closeRef} type="button" className={styles.iconBtn} onClick={onClose} aria-label="Close">
            <FilesIcon name="x" size={16} />
          </button>
        ) : null}
      </header>

      <div className={styles.panelBar}>
        {file.href ? (
          <>
            <a
              href={file.href}
              className={styles.btnPrimary}
              {...(file.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
            >
              <FilesIcon name={file.storage === "signal" ? "download" : "open"} size={15} />
              {openLabel}
            </a>
            <button type="button" className={styles.btn} onClick={copyLink}>
              <FilesIcon name={copied ? "check" : "link"} size={15} />
              {copied ? "Link copied" : "Copy link"}
            </button>
          </>
        ) : (
          <p className={styles.panelNote}>
            {sample
              ? "A sample file. In your own projects it opens from here."
              : "Not ready to open yet. It opens from here once the upload finishes."}
          </p>
        )}
        <span className="sr-only" role="status">{copied ? "Link copied" : ""}</span>
      </div>

      <div className={`${styles.panelBody} thin-scroll`}>
        {showImage ? (
          <figure className={styles.photo}>
            {/* The same authorized route the Open button uses; a plain img so no optimizer copies the bytes. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={file.href!} alt={file.title} loading="lazy" decoding="async" onError={() => setImageFailed(true)} />
          </figure>
        ) : (
          <div className={styles.cover} data-kind={file.kind}>
            <FileGlyph kind={file.kind} size={64} />
            <p>
              {file.kind === "image"
                ? "The picture shows here once it can be opened."
                : file.storage === "signal"
                  ? "Open the file to read it."
                  : `It lives in ${file.storage === "google_drive" ? "Google Drive" : sourceLabel(file)} and opens there.`}
            </p>
          </div>
        )}

        <dl className={styles.facts}>
          <div>
            <dt>Kind</dt>
            <dd>{FILE_KIND_LABEL[file.kind]}</dd>
          </div>
          <div>
            <dt>Where it lives</dt>
            <dd>{whereItLives(file)}</dd>
          </div>
          {file.storage === "signal" && file.sizeBytes ? (
            <div>
              <dt>Size</dt>
              <dd>{formatBytes(file.sizeBytes)}</dd>
            </div>
          ) : null}
          <div>
            <dt>Added</dt>
            <dd>
              {formatAddedDate(file.addedAt)}
              {who ? ` by ${who === "A former member" ? "a former member" : who}` : ""}
            </dd>
          </div>
          <div>
            <dt>Task</dt>
            <dd>
              <Link href={`/app/task/${encodeURIComponent(file.taskId)}`} className={styles.taskLink}>
                <FilesIcon name="task" size={13} />
                <span>{file.taskTitle}</span>
              </Link>
              {file.taskArchived ? <span className={styles.tag}>Archived task</span> : null}
            </dd>
          </div>
        </dl>
      </div>
    </div>
  );

  if (!sheet) {
    return (
      <aside className={styles.dock} aria-labelledby={titleId}>
        {panel}
      </aside>
    );
  }
  return (
    <div className={styles.sheetWrap} role="dialog" aria-modal="true" aria-labelledby={titleId} onKeyDown={onKeyDown}>
      <button type="button" className={styles.scrim} aria-label="Close preview" onClick={onClose} tabIndex={-1} />
      <div className={styles.sheet}>{panel}</div>
    </div>
  );
}
