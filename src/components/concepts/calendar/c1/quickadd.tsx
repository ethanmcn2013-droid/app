"use client";

import { useRef, type CSSProperties, type ReactNode, type RefObject } from "react";
import { PERSON, PROJECT, shortDay } from "./data";
import type { Parsed } from "./parse";
import { Avatar } from "./bits";
import { CalendarIcon, Plus, Return } from "./icons";
import styles from "./cal.module.css";

type Props = {
  value: string;
  parsed: Parsed;
  inputRef: RefObject<HTMLInputElement | null>;
  onChange: (v: string) => void;
  onSubmit: () => void;
  compact?: boolean;
};

export const EXAMPLES = ["florist call Fri with Aoife", "print proofs Mon to Wed #crumb", "rehearse slides 19 Oct @niamh !"];

export function Highlighted({ text, parsed }: { text: string; parsed: Parsed }) {
  const out: ReactNode[] = [];
  let cursor = 0;
  parsed.tokens.forEach((tk, i) => {
    if (tk.start > cursor) out.push(text.slice(cursor, tk.start));
    const person = tk.kind === "person" ? Object.values(PERSON).find((p) => p.name === tk.label) : undefined;
    const proj = tk.kind === "project" ? Object.values(PROJECT).find((p) => p.short === tk.label) : undefined;
    out.push(
      <mark
        key={i}
        className={styles.tok}
        data-kind={tk.kind}
        style={{ "--tk": person?.color ?? proj?.color ?? "var(--v3-accent)" } as CSSProperties}
      >
        {text.slice(tk.start, tk.end)}
      </mark>,
    );
    cursor = tk.end;
  });
  out.push(text.slice(cursor));
  return <>{out}</>;
}

export function QuickAdd({ value, parsed, inputRef, onChange, onSubmit, compact }: Props) {
  const mirror = useRef<HTMLDivElement>(null);
  const has = value.trim().length > 0;
  const proj = parsed.project ? PROJECT[parsed.project] : null;
  const summary = [
    parsed.date ? (parsed.end ? `${shortDay(parsed.date)} to ${shortDay(parsed.end)}` : shortDay(parsed.date)) : "No date yet",
    ...parsed.people.map((id) => PERSON[id].name),
    proj?.short,
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <form
      className={styles.quick}
      data-active={has ? "" : undefined}
      data-compact={compact ? "" : undefined}
      onSubmit={(e) => {
        e.preventDefault();
        if (has) onSubmit();
      }}
    >
      <span className={styles.quickIcon} aria-hidden>
        <Plus size={15} />
      </span>
      <div className={styles.quickField}>
        <div ref={mirror} className={styles.quickMirror} aria-hidden>
          <Highlighted text={value} parsed={parsed} />
          {"​"}
        </div>
        <input
          ref={inputRef}
          className={styles.quickInput}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onScroll={(e) => {
            if (mirror.current) mirror.current.scrollLeft = e.currentTarget.scrollLeft;
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              onChange("");
              e.currentTarget.blur();
            }
          }}
          placeholder={compact ? "Add a task… try: florist call Fri" : "Add a task… try: florist call Fri with Aoife"}
          aria-label="Add a task in a plain sentence"
          aria-describedby="c1-quick-summary"
          autoComplete="off"
          spellCheck={false}
        />
      </div>
      <div className={styles.quickPreview} id="c1-quick-summary" aria-live="polite">
        {has ? (
          <>
            <span className={styles.quickDate} data-none={parsed.date ? undefined : ""}>
              <CalendarIcon size={13} />
              {parsed.date ? (parsed.end ? `${shortDay(parsed.date)} – ${shortDay(parsed.end)}` : shortDay(parsed.date)) : "Needs a date"}
            </span>
            {!compact && parsed.people.length ? (
              <span className={styles.quickPeople}>
                {parsed.people.map((id) => (
                  <Avatar key={id} id={id} size={18} />
                ))}
              </span>
            ) : null}
            {!compact && proj ? (
              <span className={styles.quickProj} style={{ "--p": proj.color } as CSSProperties}>
                <span className={styles.projDot} aria-hidden />
                {proj.short}
              </span>
            ) : null}
            <span className={styles.srOnly}>{summary}</span>
            <button type="submit" className={styles.quickGo} aria-label="Add task">
              <Return size={14} />
            </button>
          </>
        ) : (
          <kbd className={styles.kbd} aria-hidden>
            N
          </kbd>
        )}
      </div>
    </form>
  );
}
