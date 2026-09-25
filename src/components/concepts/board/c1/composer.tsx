"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import type { Person } from "./data";
import { Avatar } from "./card";
import { Icon, PriorityBars } from "./icons";
import { parseComposer, PRIORITY_WORDS, type Parsed } from "./model";
import styles from "./board.module.css";

/**
 * Inline composer. Type a task in plain words; a day, an @person and a
 * !priority become chips as you type, and the rest becomes the title.
 */
export function InlineComposer({
  people,
  stageName,
  onSubmit,
  onClose,
  variant = "inline",
}: {
  people: Person[];
  stageName: string;
  onSubmit: (parsed: Parsed) => void;
  onClose: () => void;
  variant?: "inline" | "sheet";
}) {
  const [text, setText] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    rootRef.current?.scrollIntoView({ block: "nearest" });
  }, []);
  const parsed = parseComposer(text, people);
  const inputId = `composer-${stageName.replace(/\s+/g, "-").toLowerCase()}`;

  // Mirror behind the textarea: tokens get a tint while the text stays live.
  const mirror: ReactNode[] = [];
  let cursor = 0;
  parsed.tokens.forEach((t, i) => {
    if (t.start > cursor) mirror.push(text.slice(cursor, t.start));
    mirror.push(
      <mark key={i} className={styles.tokenMark} data-kind={t.kind}>
        {text.slice(t.start, t.end)}
      </mark>,
    );
    cursor = t.end;
  });
  mirror.push(text.slice(cursor) + "​");

  function submit() {
    if (!parsed.title) return;
    onSubmit(parsed);
    setText("");
    requestAnimationFrame(() => rootRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" }));
  }

  return (
    <div ref={rootRef} className={styles.composer} data-variant={variant}>
      <label htmlFor={inputId} className={styles.srOnly}>
        New task in {stageName}
      </label>
      <div className={styles.composerField}>
        <div className={styles.composerMirror} aria-hidden="true">
          {mirror}
        </div>
        <textarea
          id={inputId}
          className={styles.composerInput}
          rows={1}
          value={text}
          placeholder="What needs doing?"
          autoFocus
          onChange={(e) => {
            setText(e.target.value.replace(/\n/g, ""));
            requestAnimationFrame(() => rootRef.current?.scrollIntoView({ block: "nearest" }));
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              submit();
            }
            if (e.key === "Escape") {
              e.preventDefault();
              e.stopPropagation();
              onClose();
            }
          }}
          aria-describedby={`${inputId}-hint`}
        />
      </div>
      <div className={styles.composerChips} aria-live="polite">
        {parsed.due ? (
          <span className={styles.chip} data-kind="date">
            <Icon.calendar size={12} />
            {parsed.dueLabel}
          </span>
        ) : null}
        {parsed.person ? (
          <span className={styles.chip} data-kind="person">
            <Avatar person={parsed.person} size={16} />
            {parsed.person.name}
          </span>
        ) : null}
        {parsed.priority ? (
          <span className={styles.chip} data-kind="priority">
            <PriorityBars priority={parsed.priority} />
            {PRIORITY_WORDS[parsed.priority].replace(" priority", "")}
          </span>
        ) : null}
        {!parsed.tokens.length ? (
          <span id={`${inputId}-hint`} className={styles.composerHint}>
            Add a day, <span className={styles.kbdText}>@name</span> or <span className={styles.kbdText}>!high</span>
          </span>
        ) : null}
      </div>
      <div className={styles.composerFoot}>
        <button type="button" className={styles.ghostButton} onClick={onClose}>
          Cancel
        </button>
        <button type="button" className={styles.primarySmall} onClick={submit} disabled={!parsed.title}>
          Add task
          <kbd className={styles.kbdOnAccent} aria-hidden="true">
            ↵
          </kbd>
        </button>
      </div>
    </div>
  );
}
