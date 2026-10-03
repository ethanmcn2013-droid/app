"use client";

import { motion } from "motion/react";
import { useState, type CSSProperties } from "react";
import type { Countdown, Task, Template } from "./data";
import { brokenCheckpoint, cap, fmtShort, plural, relLabel } from "./model";
import { Avatar, Diamond, Icon } from "./parts";
import styles from "./countdown.module.css";

const EASE = [0.2, 0.8, 0.2, 1] as const;

/* ── Task sheet ────────────────────────────────────────────────────── */

export function TaskSheet({
  task,
  countdown,
  today,
  readOnly,
  onClose,
  onChange,
}: {
  task: Task;
  countdown: Countdown;
  today: number;
  readOnly: boolean;
  onClose: () => void;
  onChange: (patch: Partial<Task>) => void;
}) {
  const person = countdown.people.find((p) => p.id === task.owner);
  const phase = countdown.phases.find((p) => p.id === task.phase);
  const check = task.before
    ? countdown.checkpoints.find((k) => k.id === task.before)
    : undefined;
  const broken = check ? brokenCheckpoint(countdown, task, task.due) : null;
  const late = !task.done && task.due < today;
  const before = countdown.day - task.due;
  const [newStep, setNewStep] = useState("");

  return (
    <motion.aside
      className={styles.sheet}
      role="dialog"
      aria-label={task.title}
      initial={{ x: 24, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: 24, opacity: 0 }}
      transition={{ duration: 0.24, ease: EASE }}
      style={{ "--cd": countdown.color } as CSSProperties}
    >
      <div className={styles.sheetHead}>
        <span className={styles.sheetCrumb}>
          <span className={styles.heroSwatch} aria-hidden="true" />
          {countdown.name}
          {phase ? (
            <span className={styles.sheetPhase}>{phase.name}</span>
          ) : null}
        </span>
        <button
          type="button"
          className={styles.iconButton}
          onClick={onClose}
          aria-label="Close"
        >
          <Icon name="x" size={14} />
        </button>
      </div>

      <div className={styles.sheetTitleRow}>
        <button
          type="button"
          className={styles.check}
          data-on={task.done || undefined}
          data-size="lg"
          disabled={readOnly}
          aria-label={task.done ? "Mark as not done" : "Mark as done"}
          onClick={() => onChange({ done: !task.done })}
        >
          <Icon name="check" size={13} />
        </button>
        <textarea
          className={styles.sheetTitle}
          defaultValue={task.title}
          key={task.id}
          rows={2}
          readOnly={readOnly}
          aria-label="Task name"
          onBlur={(e) => {
            const v = e.currentTarget.value.trim();
            if (v && v !== task.title) onChange({ title: v });
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              e.currentTarget.blur();
            }
          }}
        />
      </div>

      {late ? (
        <p className={styles.sheetAlert} data-tone="danger">
          <Icon name="alert" size={14} />
          {plural(today - task.due, "day")} late. Pick a new day below, or drag
          it onto the runway.
        </p>
      ) : null}
      {broken ? (
        <p className={styles.sheetAlert} data-tone="warn">
          <Icon name="alert" size={14} />
          This is needed before {broken.short} on {fmtShort(broken.day)}, but
          lands after it.
        </p>
      ) : null}

      <dl className={styles.fields}>
        <dt>When</dt>
        <dd>
          <div className={styles.when}>
            <button
              type="button"
              className={styles.nudge}
              aria-label="A day earlier"
              disabled={readOnly || task.due - 1 < today}
              onClick={() => onChange({ due: task.due - 1 })}
            >
              <Icon name="chevron-left" size={14} />
            </button>
            <span className={styles.whenText}>
              <span className={styles.whenDate}>{fmtShort(task.due)}</span>
              <span className={styles.whenRel}>
                {cap(relLabel(before))} {countdown.noun}
              </span>
            </span>
            <button
              type="button"
              className={styles.nudge}
              aria-label="A day later"
              disabled={readOnly || task.due + 1 > countdown.day}
              onClick={() => onChange({ due: Math.max(today, task.due + 1) })}
            >
              <Icon name="chevron-right" size={14} />
            </button>
          </div>
          {late && !readOnly ? (
            <div className={styles.reschedule}>
              {[today, today + 1, today + 3].map((d) => (
                <button
                  key={d}
                  type="button"
                  className={styles.quick}
                  onClick={() => onChange({ due: d })}
                >
                  {d === today
                    ? "Today"
                    : d === today + 1
                      ? "Tomorrow"
                      : fmtShort(d)}
                </button>
              ))}
            </div>
          ) : null}
        </dd>

        {check ? (
          <>
            <dt>Needed before</dt>
            <dd className={styles.fieldInline}>
              <Diamond size={10} className={styles.checkpointMark} />
              {check.name}, {fmtShort(check.day)}
            </dd>
          </>
        ) : null}

        <dt>Owner</dt>
        <dd className={styles.fieldInline}>
          <Avatar person={person} size={20} />
          {person?.name ?? "You"}
        </dd>

        {phase ? (
          <>
            <dt>Phase</dt>
            <dd>{phase.name}</dd>
          </>
        ) : null}
      </dl>

      <div className={styles.sheetSection}>
        <h3 className={styles.sheetH}>Notes</h3>
        <textarea
          key={`${task.id}-note`}
          className={styles.noteBox}
          defaultValue={task.note ?? ""}
          readOnly={readOnly}
          placeholder="Add a note for whoever picks this up"
          onBlur={(e) => onChange({ note: e.currentTarget.value })}
          rows={3}
        />
      </div>

      <div className={styles.sheetSection}>
        <h3 className={styles.sheetH}>
          Steps
          {task.steps?.length ? (
            <span className={styles.metaDim}>
              {task.steps.filter((s) => s.done).length} of {task.steps.length}
            </span>
          ) : null}
        </h3>
        <ul className={styles.steps}>
          {task.steps?.map((s, i) => (
            <li key={s.label}>
              <label className={styles.step}>
                <input
                  type="checkbox"
                  checked={s.done}
                  disabled={readOnly}
                  onChange={() =>
                    onChange({
                      steps: task.steps?.map((x, j) =>
                        j === i ? { ...x, done: !x.done } : x,
                      ),
                    })
                  }
                />
                <span>{s.label}</span>
              </label>
            </li>
          ))}
        </ul>
        {!readOnly ? (
          <input
            className={styles.addInput}
            value={newStep}
            placeholder="Add a step"
            aria-label="Add a step"
            onChange={(e) => setNewStep(e.currentTarget.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && newStep.trim()) {
                onChange({
                  steps: [
                    ...(task.steps ?? []),
                    { label: newStep.trim(), done: false },
                  ],
                });
                setNewStep("");
              }
            }}
          />
        ) : null}
      </div>

      <p className={styles.sheetFoot}>
        <kbd className={styles.kbdInline}>Alt</kbd>
        <kbd className={styles.kbdInline}>←</kbd>
        <kbd className={styles.kbdInline}>→</kbd> moves a selected card a day.{" "}
        <kbd className={styles.kbdInline}>X</kbd> ticks it off.
      </p>
    </motion.aside>
  );
}

/* ── Drag ghost ────────────────────────────────────────────────────── */

export function DragGhost({
  task,
  countdown,
  x,
  y,
  width,
  targetDay,
  overLate,
}: {
  task: Task;
  countdown: Countdown;
  x: number;
  y: number;
  width: number;
  targetDay: number | null;
  overLate: boolean;
}) {
  const broken =
    targetDay !== null ? brokenCheckpoint(countdown, task, targetDay) : null;
  const before = targetDay !== null ? countdown.day - targetDay : null;
  const label =
    targetDay === null
      ? overLate
        ? "Running late only holds what has slipped"
        : "Drop on a day to move it"
      : before === 0
        ? `Move to the day · ${fmtShort(targetDay)}`
        : before !== null && before < 0
          ? `Move to ${relLabel(before)} · ${fmtShort(targetDay)}`
          : `Move to ${relLabel(before ?? 0)} · ${fmtShort(targetDay)}`;
  return (
    <div
      className={styles.ghostLayer}
      aria-hidden="true"
      style={{ "--cd": countdown.color } as CSSProperties}
    >
      <div
        className={styles.ghost}
        style={{ transform: `translate(${x}px, ${y}px)`, width }}
      >
        <div
          className={styles.ghostLabel}
          data-none={targetDay === null || undefined}
        >
          {targetDay !== null ? <Icon name="calendar" size={13} /> : null}
          {label}
        </div>
        <div className={styles.ghostCard}>
          <span className={styles.check} />
          <span className={styles.cardTitle}>{task.title}</span>
        </div>
        {broken ? (
          <div className={styles.ghostWarn}>
            <Icon name="alert" size={14} />
            <span>
              {task.title} is needed before {broken.short} on{" "}
              {fmtShort(broken.day)}.
            </span>
          </div>
        ) : null}
      </div>
    </div>
  );
}

/* ── Empty countdown ───────────────────────────────────────────────── */

export function EmptyRunway({
  countdown,
  templates,
  onTemplate,
  onBlank,
}: {
  countdown: Countdown;
  templates: Template[];
  onTemplate: (t: Template) => void;
  onBlank: () => void;
}) {
  return (
    <div className={styles.emptyWrap}>
      <motion.div
        className={styles.empty}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: EASE }}
      >
        <div className={styles.emptyArt} aria-hidden="true">
          {[0, 1, 2, 3].map((i) => (
            <span
              key={i}
              className={styles.emptyWeek}
              style={{ "--i": i } as CSSProperties}
            />
          ))}
          <span className={styles.emptyFlag}>
            <Diamond size={12} />
          </span>
        </div>
        <h2 className={styles.emptyTitle}>Nothing on this runway yet</h2>
        <p className={styles.emptyText}>
          {plural(countdown.day, "day")} until {fmtShort(countdown.day)}. Start
          from a plan and every task lands at the right distance from the day.
          You can change anything after.
        </p>
        <div className={styles.templates}>
          {templates.map((t) => (
            <button
              key={t.id}
              type="button"
              className={styles.template}
              onClick={() => onTemplate(t)}
            >
              {t.label}
              <span className={styles.templateCount}>
                {plural(t.tasks.length, "task")}
              </span>
            </button>
          ))}
        </div>
        <button type="button" className={styles.linkButton} onClick={onBlank}>
          Or start with a blank runway
        </button>
      </motion.div>
    </div>
  );
}

/* ── Keyboard help ─────────────────────────────────────────────────── */

const KEYS: [string, string][] = [
  ["1 2 3", "Switch countdown"],
  ["M", "Move the big date"],
  ["T", "Back to today"],
  ["D", "Jump to the day"],
  ["[ ]", "Scroll a week"],
  ["Alt ← →", "Move the selected card a day"],
  ["X", "Tick off the selected card"],
  ["Esc", "Close"],
];

export function Shortcuts({ onClose }: { onClose: () => void }) {
  return (
    <motion.div
      className={styles.keys}
      role="dialog"
      aria-label="Keyboard shortcuts"
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 6 }}
      transition={{ duration: 0.18 }}
    >
      <div className={styles.moveHead}>
        <h2 className={styles.moveTitle}>Keyboard shortcuts</h2>
        <button
          type="button"
          className={styles.iconButton}
          onClick={onClose}
          aria-label="Close"
        >
          <Icon name="x" size={14} />
        </button>
      </div>
      <dl className={styles.keyList}>
        {KEYS.map(([k, v]) => (
          <div key={k} className={styles.keyRow}>
            <dt>
              {k.split(" ").map((part) => (
                <kbd key={part} className={styles.kbdInline}>
                  {part}
                </kbd>
              ))}
            </dt>
            <dd>{v}</dd>
          </div>
        ))}
      </dl>
    </motion.div>
  );
}

/* ── Toast ─────────────────────────────────────────────────────────── */

export function Toast({
  text,
  tone,
  onUndo,
}: {
  text: string;
  tone?: "warn";
  onUndo?: () => void;
}) {
  return (
    <motion.div
      className={styles.toast}
      role="status"
      data-tone={tone}
      initial={{ opacity: 0, y: 12, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 8 }}
      transition={{ duration: 0.2, ease: EASE }}
    >
      {tone === "warn" ? (
        <Icon name="alert" size={14} />
      ) : (
        <Icon name="check" size={14} />
      )}
      <span>{text}</span>
      {onUndo ? (
        <button type="button" className={styles.toastUndo} onClick={onUndo}>
          <Icon name="undo" size={13} />
          Undo
        </button>
      ) : null}
    </motion.div>
  );
}
