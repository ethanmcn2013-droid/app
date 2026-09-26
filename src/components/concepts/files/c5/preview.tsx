"use client";

import { useEffect, useRef, type CSSProperties } from "react";
import { PEOPLE, type FileItem, type PersonId } from "./data";
import { isLatest, latestIn, pageOf, when } from "./engine";
import { TrustCheck } from "./cards";
import {
  Avatar,
  Glyph,
  Icon,
  KIND_NAME,
  Kbd,
  Marked,
  ProjectTag,
  personName,
  useMod,
} from "./parts";
import s from "./ask.module.css";

/**
 * Opening a result lands on the passage that matched, lit, rather than on
 * page one. Esc closes and returns you to the query.
 */
export function Preview({
  file,
  files,
  para,
  marks,
  soft = [],
  onClose,
  onCopy,
  onShare,
  onAsk,
  asked,
  shareTo,
  shared,
  onOpenOther,
}: {
  file: FileItem;
  files: FileItem[];
  para: number;
  marks: string[];
  soft?: string[];
  onClose: () => void;
  onCopy: () => void;
  onShare: () => void;
  onAsk: () => void;
  asked: boolean;
  shareTo: PersonId;
  shared: boolean;
  onOpenOther: (id: string) => void;
}) {
  const mod = useMod();
  const closeRef = useRef<HTMLButtonElement>(null);
  const litRef = useRef<HTMLParagraphElement | HTMLTableRowElement | null>(
    null,
  );

  useEffect(() => {
    closeRef.current?.focus({ preventScroll: true });
    const t = window.setTimeout(
      () =>
        litRef.current?.scrollIntoView({ block: "center", behavior: "smooth" }),
      240,
    );
    return () => window.clearTimeout(t);
  }, [file.id]);

  const latest = isLatest(files, file);
  const newer = latestIn(files, file);
  const approver = file.approvedBy
    ? PEOPLE.find((p) => p.id === file.approvedBy)
    : null;
  // Keep the file's own order: runs of "a | b" lines become one table.
  const blocks: {
    kind: "p" | "table";
    lines: { text: string; idx: number }[];
  }[] = [];
  file.body.forEach((text, idx) => {
    const kind = text.includes(" | ") ? "table" : "p";
    const last = blocks[blocks.length - 1];
    if (kind === "table" && last?.kind === "table")
      last.lines.push({ text, idx });
    else blocks.push({ kind, lines: [{ text, idx }] });
  });

  return (
    <div
      className={s.sheetWrap}
      role="dialog"
      aria-modal="true"
      aria-label={file.name}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.preventDefault();
          onClose();
        } else if (
          e.key === "Enter" &&
          (e.metaKey || e.ctrlKey) &&
          !file.lockedIn
        ) {
          e.preventDefault();
          onCopy();
        }
      }}
    >
      <button
        type="button"
        className={s.scrim}
        aria-label="Close preview"
        onClick={onClose}
        tabIndex={-1}
      />
      <div className={s.sheet}>
        <header className={s.sheetHead}>
          <Glyph file={file} size={36} />
          <div className={s.sheetTitleBox}>
            <h2 className={s.sheetTitle}>{file.name}</h2>
            <p className={s.sheetMeta}>
              <ProjectTag id={file.project} compact />
              <span>{KIND_NAME[file.kind]}</span>
              <span>{file.size}</span>
              <span>
                {personName(file.by)}, {when(file.date)}
              </span>
              {approver ? (
                <span className={s.sheetApproved}>
                  <Avatar id={approver.id} size={14} />
                  Approved by {approver.first}, {file.approvedOn}
                </span>
              ) : null}
            </p>
          </div>
          <button
            ref={closeRef}
            type="button"
            className={s.iconBtn}
            onClick={onClose}
            aria-label="Close"
          >
            <Icon name="x" size={16} />
          </button>
        </header>

        {file.lockedIn ? (
          <div className={s.sheetLocked}>
            <span className={s.lockBadge}>
              <Icon name="lock" size={22} />
            </span>
            <p className={s.sheetLockedTitle}>
              This file lives in {personName(file.lockedIn)}&rsquo;s Drive
              folder
            </p>
            <p className={s.sheetLockedBody}>
              We can see its name and which task it belongs to, but not
              what&rsquo;s inside. Once {personName(file.lockedIn)} shares it,
              it becomes searchable here like everything else.
            </p>
            <button
              type="button"
              className={asked ? `${s.btn} ${s.btnDone}` : s.btnPrimary}
              onClick={onAsk}
              aria-pressed={asked}
            >
              <Icon name={asked ? "check" : "lock"} size={15} />
              {asked
                ? `Asked ${personName(file.lockedIn)}`
                : `Ask ${personName(file.lockedIn)} for access`}
            </button>
          </div>
        ) : (
          <>
            <div className={s.sheetBar}>
              {latest ? (
                <TrustCheck files={files} file={file} />
              ) : (
                <button
                  type="button"
                  className={s.staleBtn}
                  onClick={() => onOpenOther(newer.id)}
                >
                  <Icon name="clock" size={13} />
                  Older version. Open v{newer.v} from {when(newer.date)}
                  <Icon name="arrow" size={13} />
                </button>
              )}
              <span className={s.sheetBarGap} />
              <span className={s.sheetBarActions}>
                <button type="button" className={s.btnSm} onClick={onCopy}>
                  <Icon name="link" size={14} />
                  Copy link
                </button>
                <button
                  type="button"
                  className={`${s.btnSm} ${shared ? s.btnDone : ""}`}
                  onClick={onShare}
                  aria-pressed={shared}
                >
                  {shared ? (
                    <Icon name="check" size={14} />
                  ) : (
                    <Icon name="share" size={14} />
                  )}
                  {shared
                    ? `Shared with ${personName(shareTo)}`
                    : `Share with ${personName(shareTo)}`}
                </button>
              </span>
            </div>

            <div className={s.sheetBody}>
              {file.kind === "image" ? (
                <figure className={s.photo}>
                  <span
                    className={s.photoArt}
                    style={
                      {
                        "--a": file.art?.[0] ?? "#ccc",
                        "--b": file.art?.[1] ?? "#888",
                      } as CSSProperties
                    }
                    role="img"
                    aria-label={file.body[0]}
                  >
                    <span className={s.artSun} />
                    <span className={s.artHill} />
                  </span>
                  <figcaption className={s.photoCaption}>
                    {file.body[0]}
                  </figcaption>
                  {file.ocr ? (
                    <div className={s.ocr}>
                      <span className={s.ocrLabel}>
                        <Icon name="eye" size={13} />
                        Text read from this image
                      </span>
                      <p className={s.ocrText}>
                        <Marked text={file.ocr} marks={marks} />
                      </p>
                    </div>
                  ) : null}
                </figure>
              ) : (
                <article className={s.paper}>
                  <span className={s.paperPage}>
                    Page {pageOf(file, para)} of {file.pages}
                  </span>
                  <h3 className={s.paperTitle}>
                    {file.name.replace(/\.[a-z]+$/, "")}
                  </h3>
                  {blocks.map((b, bi) =>
                    b.kind === "p" ? (
                      b.lines.map(({ text, idx }) => (
                        <p
                          key={idx}
                          ref={
                            idx === para
                              ? (el) => void (litRef.current = el)
                              : undefined
                          }
                          className={idx === para ? s.paperLit : s.paperLine}
                        >
                          <Marked text={text} marks={marks} soft={soft} />
                        </p>
                      ))
                    ) : (
                      <table key={`t${bi}`} className={s.paperTable}>
                        <tbody>
                          {b.lines.map(({ text, idx }) => (
                            <tr
                              key={idx}
                              ref={
                                idx === para
                                  ? (el) => void (litRef.current = el)
                                  : undefined
                              }
                              className={
                                idx === para ? s.paperRowLit : undefined
                              }
                            >
                              {text.split(" | ").map((cell, j) => (
                                <td key={j}>
                                  <Marked
                                    text={cell}
                                    marks={marks}
                                    soft={soft}
                                  />
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    ),
                  )}
                </article>
              )}
            </div>
            <footer className={s.sheetFoot}>
              <span className={s.hoverOnly}>
                <Kbd>Esc</Kbd> back to your search
              </span>
              <span className={s.hoverOnly}>
                <Kbd>{mod === "⌘" ? "⌘↵" : "Ctrl ↵"}</Kbd> copy link
              </span>
              {file.task ? (
                <span className={s.sheetTask}>
                  <Icon name="task" size={13} />
                  {file.task}
                </span>
              ) : null}
            </footer>
          </>
        )}
      </div>
    </div>
  );
}
