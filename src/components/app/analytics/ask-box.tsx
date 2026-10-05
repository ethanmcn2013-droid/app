"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { matchQuestions, type Question } from "@/lib/projects/project-analytics-questions";
import styles from "./analytics.module.css";

/**
 * The ask box. It finds a question in the page's own library by the words
 * typed (`matchQuestions`: keywords, light stemming, a few synonyms) and
 * opens it. It is not a language model and answers nothing itself: when no
 * question in the library matches, it says so and the list of questions
 * stays on screen below.
 *
 * Keys: `/` moves here from anywhere on the page; Up and Down walk the
 * matches; Enter opens the chosen one (the best match by default); Escape
 * clears the box.
 */
export function AskBox({
  questions,
  hrefs,
  placeholder,
  helper,
  autoFocus = false,
}: {
  questions: readonly Question[];
  /** Where each question opens, by id. */
  hrefs: Readonly<Record<string, string>>;
  placeholder: string;
  helper?: string;
  autoFocus?: boolean;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState("");
  const [picked, setPicked] = useState(0);
  const listId = useId();
  const statusId = useId();

  const matches = useMemo(() => {
    const found = matchQuestions(value, questions);
    return found.map((match) => questions.find((question) => question.id === match.id)!).slice(0, 4);
  }, [value, questions]);
  const typed = value.trim().length > 0;
  const miss = typed && matches.length === 0;
  const active = Math.min(picked, Math.max(matches.length - 1, 0));

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key !== "/" || event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) return;
      event.preventDefault();
      inputRef.current?.focus();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function open(question: Question | undefined) {
    if (!question) return;
    setValue("");
    router.push(hrefs[question.id] ?? "/app/analytics", { scroll: false });
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown" && matches.length > 0) {
      event.preventDefault();
      setPicked((active + 1) % matches.length);
    } else if (event.key === "ArrowUp" && matches.length > 0) {
      event.preventDefault();
      setPicked((active - 1 + matches.length) % matches.length);
    } else if (event.key === "Enter") {
      event.preventDefault();
      open(matches[active]);
    } else if (event.key === "Escape" && value) {
      event.preventDefault();
      setValue("");
    }
  }

  return (
    <div className={styles.askBox}>
      <label className={styles.askField}>
        <svg className={styles.askIcon} width="20" height="20" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" aria-hidden="true">
          <circle cx="7" cy="7" r="4.5" />
          <path d="m10.5 10.5 3 3" />
        </svg>
        <input
          ref={inputRef}
          type="text"
          role="combobox"
          className={styles.askInput}
          value={value}
          onChange={(event) => {
            setValue(event.target.value);
            setPicked(0);
          }}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          aria-label={placeholder}
          aria-expanded={matches.length > 0}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={matches.length > 0 ? `${listId}-${matches[active]!.id}` : undefined}
          aria-describedby={statusId}
          autoComplete="off"
          spellCheck={false}
          enterKeyHint="go"
          autoFocus={autoFocus}
        />
        {typed ? null : <kbd className={styles.askKey} aria-hidden="true">/</kbd>}
      </label>

      <ul id={listId} role="listbox" aria-label="Questions that match" className={styles.askMatches} hidden={matches.length === 0}>
        {matches.map((question, index) => (
          <li
            key={question.id}
            id={`${listId}-${question.id}`}
            role="option"
            aria-selected={index === active}
            className={styles.askMatch}
            onMouseEnter={() => setPicked(index)}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => open(question)}
          >
            <span className={styles.askMatchText}>{question.label}</span>
            <span className={styles.askMatchHint}>{question.hint}</span>
            {index === active ? <kbd className={styles.askKey} aria-hidden="true">↵</kbd> : null}
          </li>
        ))}
      </ul>

      <p id={statusId} className={miss ? styles.askMiss : styles.askHelp} role="status">
        {miss ? "No ready answer for that yet. These are the questions I can answer." : helper ?? ""}
      </p>
    </div>
  );
}
