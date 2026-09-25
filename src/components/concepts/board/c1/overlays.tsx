"use client";

import { useEffect, useRef, type CSSProperties } from "react";
import { STAGES, type Person, type StageKey, type Task } from "./data";
import { Avatar } from "./card";
import { Icon, PriorityBars, StageGlyph } from "./icons";
import { dueFact, PRIORITY_WORDS, shortDate } from "./model";
import styles from "./board.module.css";

/* ── CardPeek: a quick look without leaving the board ─────────────── */

export type PeekState = { id: string; rect: { top: number; left: number; right: number; bottom: number }; pinned: boolean };

export function CardPeek({
  task,
  people,
  peek,
  sheet,
  onClose,
  onToggleStep,
  onEnter,
  onLeave,
  onMove,
}: {
  task: Task;
  people: Person[];
  peek: PeekState;
  sheet: boolean;
  onClose: () => void;
  onToggleStep: (stepId: string) => void;
  onEnter: () => void;
  onLeave: () => void;
  onMove: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const stage = STAGES.find((s) => s.key === task.stage)!;
  const due = task.due ? dueFact(task.due) : null;
  const steps = task.subtasks ?? [];
  const stepsDone = steps.filter((s) => s.done).length;

  useEffect(() => {
    if (peek.pinned) ref.current?.focus({ preventScroll: true });
  }, [peek.pinned, peek.id]);

  let style: CSSProperties | undefined;
  if (!sheet && typeof window !== "undefined") {
    const width = 340;
    const roomRight = window.innerWidth - peek.rect.right;
    const left = roomRight > width + 24 ? peek.rect.right + 12 : Math.max(12, peek.rect.left - width - 12);
    const top = Math.max(64, Math.min(peek.rect.top - 4, window.innerHeight - 440));
    style = { left, top, width };
  }

  const body = (
    <div
      ref={ref}
      role="dialog"
      aria-modal={sheet ? true : undefined}
      aria-label={`Quick look: ${task.title}`}
      tabIndex={-1}
      className={sheet ? styles.sheet : styles.peek}
      style={style}
      data-pinned={peek.pinned ? "" : undefined}
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.stopPropagation();
          onClose();
        }
      }}
    >
      {sheet ? <span className={styles.sheetGrip} aria-hidden="true" /> : null}
      <div className={styles.peekHead}>
        <span className={styles.peekStage}>
          <StageGlyph stage={task.stage} size={14} />
          {stage.name}
        </span>
        {peek.pinned || sheet ? (
          <button type="button" className={styles.iconButton} onClick={onClose} aria-label="Close quick look">
            <Icon.close size={14} />
          </button>
        ) : null}
      </div>
      <h2 className={styles.peekTitle}>{task.title}</h2>
      {task.heldBy ? (
        <p className={styles.peekHeld}>
          <Icon.clock size={14} />
          <span>
            Waiting on <strong>{task.heldBy}</strong>
          </span>
        </p>
      ) : null}
      {task.description ? <p className={styles.peekText}>{task.description}</p> : null}
      {steps.length ? (
        <div className={styles.peekSteps}>
          <div className={styles.peekLabel}>
            Steps <span className={styles.peekCount}>{stepsDone} of {steps.length}</span>
          </div>
          <ul className={styles.checklist}>
            {steps.map((step) => (
              <li key={step.id}>
                <label className={styles.checkRow} data-done={step.done ? "" : undefined}>
                  <input type="checkbox" checked={step.done} onChange={() => onToggleStep(step.id)} />
                  <span className={styles.checkBox} aria-hidden="true">
                    <Icon.check size={12} />
                  </span>
                  <span className={styles.checkText}>{step.text}</span>
                </label>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <dl className={styles.facts}>
        <div>
          <dt>Due</dt>
          <dd>
            {due ? (
              <span className={styles.due} data-tone={task.stage === "done" ? "later" : due.tone}>
                <Icon.calendar size={12} />
                {shortDate(task.due!)}
              </span>
            ) : (
              <span className={styles.factNone}>No date</span>
            )}
          </dd>
        </div>
        <div>
          <dt>Priority</dt>
          <dd className={styles.factInline}>
            {task.priority ? <PriorityBars priority={task.priority} /> : null}
            {PRIORITY_WORDS[task.priority].replace(" priority", "")}
          </dd>
        </div>
        <div>
          <dt>People</dt>
          <dd className={styles.factPeople}>
            {people.length ? (
              people.map((p) => (
                <span key={p.id} className={styles.factPerson}>
                  <Avatar person={p} size={18} />
                  {p.first}
                  {p.guest ? <span className={styles.guestTag}>guest</span> : null}
                </span>
              ))
            ) : (
              <span className={styles.factNone}>No one yet</span>
            )}
          </dd>
        </div>
        {task.label ? (
          <div>
            <dt>Label</dt>
            <dd>
              <span className={styles.label} style={{ "--dot": task.label.tone } as CSSProperties}>
                {task.label.name}
              </span>
            </dd>
          </div>
        ) : null}
      </dl>
      <div className={styles.peekFoot}>
        {sheet ? (
          <button type="button" className={styles.secondaryButton} onClick={onMove}>
            <Icon.arrows size={14} />
            Move to…
          </button>
        ) : (
          <span className={styles.peekHint}>
            <kbd className={styles.kbd}>Space</kbd> to pick up and move
          </span>
        )}
        {task.comments ? (
          <span className={styles.peekComments}>
            <Icon.comment size={13} />
            {task.comments} {task.comments === 1 ? "comment" : "comments"}
          </span>
        ) : null}
      </div>
    </div>
  );

  if (!sheet) return body;
  return (
    <div className={styles.scrim} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()}>{body}</div>
    </div>
  );
}

/* ── MoveSheet: phone, after a long press ─────────────────────────── */

export function MoveSheet({
  task,
  counts,
  onPick,
  onClose,
}: {
  task: Task;
  counts: Record<StageKey, number>;
  onPick: (stage: StageKey) => void;
  onClose: () => void;
}) {
  const firstRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    firstRef.current?.focus({ preventScroll: true });
  }, []);
  return (
    <div className={styles.scrim} onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="move-title"
        className={styles.sheet}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === "Escape") onClose();
        }}
      >
        <span className={styles.sheetGrip} aria-hidden="true" />
        <h2 id="move-title" className={styles.sheetTitle}>
          Move to
        </h2>
        <p className={styles.sheetSub}>{task.title}</p>
        <ul className={styles.moveList}>
          {STAGES.map((stage, i) => {
            const here = stage.key === task.stage;
            return (
              <li key={stage.key}>
                <button
                  ref={i === 0 ? firstRef : undefined}
                  type="button"
                  className={styles.moveRow}
                  data-here={here ? "" : undefined}
                  aria-current={here ? "true" : undefined}
                  onClick={() => (here ? onClose() : onPick(stage.key))}
                >
                  <StageGlyph stage={stage.key} size={20} />
                  <span className={styles.moveName}>{stage.name}</span>
                  <span className={styles.moveCount}>{here ? "Here now" : `${counts[stage.key]} ${counts[stage.key] === 1 ? "task" : "tasks"}`}</span>
                </button>
              </li>
            );
          })}
        </ul>
        <button type="button" className={styles.sheetCancel} onClick={onClose}>
          Cancel
        </button>
      </div>
    </div>
  );
}

/* ── StagePager: phone ────────────────────────────────────────────── */

export function StagePager({
  active,
  counts,
  onPick,
}: {
  active: number;
  counts: Record<StageKey, number>;
  onPick: (index: number) => void;
}) {
  return (
    <nav className={styles.pager} aria-label="Stages">
      <ol className={styles.pagerList}>
        {STAGES.map((stage, i) => (
          <li key={stage.key}>
            <button
              type="button"
              className={styles.pagerItem}
              data-active={i === active ? "" : undefined}
              aria-current={i === active ? "step" : undefined}
              aria-label={`${stage.name}, ${counts[stage.key]} ${counts[stage.key] === 1 ? "task" : "tasks"}`}
              onClick={() => onPick(i)}
            >
              <StageGlyph stage={stage.key} size={i === active ? 14 : 12} />
              <span className={styles.pagerName}>{stage.name}</span>
              {i === active ? <span className={styles.pagerCount}>{counts[stage.key]}</span> : null}
            </button>
          </li>
        ))}
      </ol>
    </nav>
  );
}

/* ── UndoToast ────────────────────────────────────────────────────── */

export function UndoToast({ message, onUndo, onClose }: { message: string; onUndo?: () => void; onClose: () => void }) {
  return (
    <div className={styles.toast} role="status">
      <span className={styles.toastText}>{message}</span>
      {onUndo ? (
        <button type="button" className={styles.toastUndo} onClick={onUndo}>
          Undo
          <kbd className={styles.toastKbd} aria-hidden="true">
            ⌘Z
          </kbd>
        </button>
      ) : null}
      <button type="button" className={styles.toastClose} onClick={onClose} aria-label="Dismiss">
        <Icon.close size={12} />
      </button>
    </div>
  );
}
