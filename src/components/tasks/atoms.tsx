"use client";

/**
 * Shared task atoms: the status glyph, the completion toggle, priority,
 * due date, labels, subtasks and blocked marks. Every view (Board, List,
 * Calendar, the sheet and the composer) draws a task from these, so a task
 * looks the same wherever it appears.
 */

import type { CSSProperties } from "react";
import type { LabLabel, TaskPriority } from "@/components/hybrid/types";
import { PRIORITY_LABELS } from "@/components/hybrid/types";
import { glyphFor, glyphWords, type GlyphColumn, type StatusGlyphSpec } from "./status-glyph-model";
import type { TimeFact } from "./time";
import { TIcon } from "./icons";
import { identityHue } from "./identity-hue";
import styles from "./atoms.module.css";

/* ── StatusGlyph ──────────────────────────────────────────────────── */

export function StatusGlyph({
  column,
  spec,
  size = 16,
  className,
}: {
  column?: GlyphColumn;
  spec?: StatusGlyphSpec;
  size?: number;
  className?: string;
}) {
  const glyph = spec ?? glyphFor(column);
  const style = { "--glyph": glyph.tone, width: size, height: size } as CSSProperties;
  return (
    <svg
      className={[styles.glyph, className].filter(Boolean).join(" ")}
      data-shape={glyph.shape}
      viewBox="0 0 16 16"
      style={style}
      aria-hidden="true"
      focusable="false"
    >
      {glyph.shape === "done" ? (
        <>
          <circle className={styles.glyphDisc} cx="8" cy="8" r="7" />
          <path className={styles.glyphTick} d="M5 8.3 7.1 10.4 11 6" pathLength={1} />
        </>
      ) : (
        <>
          <circle
            className={styles.glyphRing}
            cx="8"
            cy="8"
            r="6.25"
            data-dashed={glyph.shape === "custom" ? "" : undefined}
          />
          {glyph.shape === "half" ? <path className={styles.glyphFill} d="M8 3.25a4.75 4.75 0 0 1 0 9.5Z" /> : null}
          {glyph.shape === "three-quarter" ? (
            <path className={styles.glyphFill} d="M8 3.25a4.75 4.75 0 1 1-4.75 4.75H8Z" />
          ) : null}
          {glyph.shape === "waiting" ? <path className={styles.glyphHands} d="M8 5v3.2l2 1.3" /> : null}
          <path className={styles.glyphHover} d="M5.2 8.3 7.1 10.2 10.8 6.3" pathLength={1} />
        </>
      )}
    </svg>
  );
}

/* ── CompleteToggle ───────────────────────────────────────────────── */

export function CompleteToggle({
  title,
  done,
  column,
  readOnly,
  onToggle,
  tabIndex,
  size = "md",
}: {
  title: string;
  done: boolean;
  column?: GlyphColumn;
  readOnly?: boolean;
  onToggle: () => void;
  tabIndex?: number;
  size?: "sm" | "md";
}) {
  const spec = glyphFor(done ? { key: "done", isDone: true, isSystem: true, color: "emerald" } : column);
  if (readOnly) {
    return (
      <span className={styles.toggle} data-size={size} data-readonly="" title={glyphWords(spec.shape)}>
        <StatusGlyph spec={spec} size={size === "sm" ? 14 : 16} />
      </span>
    );
  }
  return (
    <button
      type="button"
      className={styles.toggle}
      data-size={size}
      data-act="tick"
      aria-pressed={done}
      aria-label={done ? `Mark "${title}" not done` : `Mark "${title}" done`}
      tabIndex={tabIndex}
      onClick={(event) => {
        event.stopPropagation();
        onToggle();
      }}
      onPointerDown={(event) => event.stopPropagation()}
    >
      <StatusGlyph spec={spec} size={size === "sm" ? 14 : 16} />
    </button>
  );
}

/* ── PriorityIcon ─────────────────────────────────────────────────── */

const BARS: Record<TaskPriority, number> = { low: 1, normal: 2, high: 3, urgent: 3 };

export function PriorityIcon({ priority, size = 14 }: { priority: TaskPriority; size?: number }) {
  if (priority === "urgent") {
    return (
      <svg className={styles.priority} data-priority="urgent" viewBox="0 0 14 14" width={size} height={size} aria-hidden="true" focusable="false">
        <rect className={styles.urgentBox} x="1" y="1" width="12" height="12" rx="3" />
        <path className={styles.urgentMark} d="M7 3.9v3.9M7 9.9v.2" />
      </svg>
    );
  }
  const filled = BARS[priority];
  return (
    <svg className={styles.priority} data-priority={priority} viewBox="0 0 14 14" width={size} height={size} aria-hidden="true" focusable="false">
      {[0, 1, 2].map((index) => (
        <rect
          key={index}
          className={index < filled ? styles.barOn : styles.barOff}
          x={1.5 + index * 4}
          y={9 - index * 3}
          width="3"
          height={4 + index * 3}
          rx="1"
        />
      ))}
    </svg>
  );
}

export function PriorityMark({ priority, withWord = false }: { priority: TaskPriority; withWord?: boolean }) {
  const word = PRIORITY_LABELS[priority];
  return (
    <span className={styles.priorityMark} data-priority={priority} title={`${word} priority`}>
      <PriorityIcon priority={priority} />
      {withWord ? <span>{word}</span> : <span className={styles.srOnly}>{word} priority</span>}
    </span>
  );
}

/* ── DueChip ──────────────────────────────────────────────────────── */

export function DueChip({ time, compact = false }: { time: TimeFact; compact?: boolean }) {
  if (time.kind === "none") return null;
  const icon = time.kind === "milestone" ? <TIcon.diamond size={11} /> : time.kind === "done" ? null : <TIcon.calendar size={11} />;
  return (
    <span className={styles.due} data-kind={time.kind} data-compact={compact ? "" : undefined} title={time.said} suppressHydrationWarning>
      {icon}
      <span className={styles.srOnly}>{time.said}. </span>
      <span aria-hidden="true">{time.label}</span>
    </span>
  );
}

/* ── LabelChip ────────────────────────────────────────────────────── */

/* A label with no colour of its own takes a steady identity hue from its
   name, the way projects do. */
export function LabelChip({ label, highlight, tinted }: { label: LabLabel; highlight?: boolean; tinted?: boolean }) {
  const style = label.tone === "neutral" ? ({ "--dot": identityHue(label.id) } as CSSProperties) : undefined;
  return (
    <span className={styles.label} data-tone={label.tone} data-highlight={highlight ? "" : undefined} data-tinted={tinted ? "" : undefined} style={style}>
      <span className={styles.labelDot} aria-hidden="true" />
      <span className={styles.labelName}>{label.name}</span>
    </span>
  );
}

/** `tinted`: a filled pill in the label's own colour, for the dense list. */
export function LabelChips({ labels, max = 2, tinted }: { labels: LabLabel[]; max?: number; tinted?: boolean }) {
  if (!labels.length) return null;
  const shown = labels.slice(0, max);
  const rest = labels.length - shown.length;
  return (
    <>
      {shown.map((label) => <LabelChip key={label.id} label={label} tinted={tinted} />)}
      {rest > 0 ? (
        <span className={styles.more} title={labels.slice(max).map((label) => label.name).join(", ")}>+{rest}</span>
      ) : null}
    </>
  );
}

/* ── SubtaskReceipt, counts, blocked ──────────────────────────────── */

export function SubtaskReceipt({ done, total }: { done: number; total: number }) {
  if (total <= 0) return null;
  // Up to eight steps, one mark each; longer lists share the eight marks.
  const marks = Math.min(total, 8);
  const filled = done >= total ? marks : Math.min(marks - 1, Math.round((done / total) * marks));
  return (
    <span className={styles.meta} data-complete={done === total ? "" : undefined} title={`${done} of ${total} subtasks done`}>
      <span className={styles.steps} aria-hidden="true">
        {Array.from({ length: marks }, (_, index) => (
          <i key={index} data-on={index < filled ? "" : undefined} />
        ))}
      </span>
      <span className={styles.srOnly}>Subtasks </span>
      {done}/{total}
    </span>
  );
}

export function CountMeta({ kind, count }: { kind: "comments" | "files"; count: number }) {
  if (count <= 0) return null;
  const noun = kind === "comments" ? (count === 1 ? "comment" : "comments") : count === 1 ? "file" : "files";
  return (
    <span className={styles.meta} title={`${count} ${noun}`}>
      {kind === "comments" ? <TIcon.comment size={12} /> : <TIcon.paperclip size={12} />}
      {count}
      <span className={styles.srOnly}> {noun}</span>
    </span>
  );
}

export function BlockedMark({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span className={styles.blocked} title={`Held up by ${count} other ${count === 1 ? "task" : "tasks"}`}>
      <TIcon.blocked size={12} />
      Held up
    </span>
  );
}

/* ── Keyboard hint ────────────────────────────────────────────────── */

export function Kbd({ children }: { children: React.ReactNode }) {
  return <kbd className={styles.kbd}>{children}</kbd>;
}

export const srOnly = styles.srOnly;
