"use client";

import { useRef } from "react";
import { LABELS, PEOPLE, PROJECT, type Task } from "./data";
import { Avatar, Icon, LabelDots, PriorityIcon, StatusGlyph } from "./glyphs";
import { dueText, dueTone } from "./parse";
import s from "./list.module.css";

type Props = {
  task: Task;
  focused: boolean;
  selected: boolean;
  selecting: boolean;
  flash?: { n: number; delay: number };
  onClick: (e: React.MouseEvent, id: number) => void;
  onToggleSelect: (id: number, shift: boolean) => void;
  onToggleDone: (id: number) => void;
  onLongPress: (id: number) => void;
  highlight?: string[];
};

function marked(title: string, words?: string[]) {
  if (!words?.length) return title;
  const esc = words.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const parts = title.split(new RegExp(`(${esc.join("|")})`, "gi"));
  return parts.map((part, i) => (i % 2 ? <mark key={i} className={s.mark}>{part}</mark> : part));
}

export function Row({ task, focused, selected, selecting, flash, onClick, onToggleSelect, onToggleDone, onLongPress, highlight }: Props) {
  const timer = useRef<number | null>(null);
  const pressed = useRef(false);
  const start = useRef<{ x: number; y: number } | null>(null);
  const done = task.status === "done";
  const tone = task.due && !done ? dueTone(task.due) : "later";
  const subDone = task.subtasks?.filter((x) => x.done).length ?? 0;

  const cancel = () => {
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = null;
  };

  const meta = [
    task.due ? dueText(task.due) : null,
    task.assignee ? PEOPLE[task.assignee].name : "No one",
    ...task.labels.map((l) => LABELS[l].name),
  ].filter(Boolean);

  return (
    <div
      role="option"
      aria-selected={selected}
      data-row={task.id}
      className={s.row}
      data-focused={focused || undefined}
      data-selected={selected || undefined}
      data-selecting={selecting || undefined}
      data-done={done || undefined}
      onClick={(e) => {
        if (pressed.current) {
          pressed.current = false;
          return;
        }
        onClick(e, task.id);
      }}
      onPointerDown={(e) => {
        if (e.pointerType === "mouse") return;
        start.current = { x: e.clientX, y: e.clientY };
        pressed.current = false;
        timer.current = window.setTimeout(() => {
          pressed.current = true;
          onLongPress(task.id);
        }, 420);
      }}
      onPointerMove={(e) => {
        if (start.current && Math.hypot(e.clientX - start.current.x, e.clientY - start.current.y) > 8) cancel();
      }}
      onPointerUp={cancel}
      onPointerCancel={cancel}
      onContextMenu={(e) => {
        if (timer.current || pressed.current) e.preventDefault();
      }}
    >
      {flash && <span key={flash.n} className={s.flash} style={{ animationDelay: `${flash.delay}ms` }} aria-hidden />}
      <button
        type="button"
        className={s.check}
        aria-label={selected ? `Deselect ${PROJECT.key}-${task.id}` : `Select ${PROJECT.key}-${task.id}`}
        aria-pressed={selected}
        onClick={(e) => {
          e.stopPropagation();
          onToggleSelect(task.id, e.shiftKey);
        }}
      >
        <span className={s.checkBox}>{selected && <Icon name="check" size={12} />}</span>
      </button>
      <button
        type="button"
        className={s.statusBtn}
        aria-label={done ? "Mark as not done" : "Mark as done"}
        title={done ? "Mark as not done" : "Mark as done"}
        onClick={(e) => {
          e.stopPropagation();
          onToggleDone(task.id);
        }}
      >
        <StatusGlyph status={task.status} />
      </button>
      <span className={s.num}>
        {PROJECT.key}-{task.id}
      </span>
      <span className={s.titleCell}>
        <span className={s.title}>{marked(task.title, highlight)}</span>
        {task.subtasks && (
          <span className={s.subCount} aria-label={`${subDone} of ${task.subtasks.length} subtasks done`}>
            <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden>
              <circle cx="6" cy="6" r="4.6" fill="none" stroke="var(--v3-border-strong)" strokeWidth="1.6" />
              <circle
                cx="6"
                cy="6"
                r="4.6"
                fill="none"
                stroke="var(--v3-success)"
                strokeWidth="1.6"
                strokeDasharray={`${(subDone / task.subtasks.length) * 28.9} 28.9`}
                transform="rotate(-90 6 6)"
              />
            </svg>
            {subDone}/{task.subtasks.length}
          </span>
        )}
        <span className={s.meta} data-tone={tone}>
          {meta.map((m, i) => (
            <span key={i} className={i === 0 && task.due && tone === "late" ? s.metaLate : undefined}>
              {i > 0 && <span className={s.metaSep}> · </span>}
              {m}
            </span>
          ))}
        </span>
      </span>
      <span className={s.facts}>
        <LabelDots labels={task.labels} />
        <span className={s.dueCell}>
          {task.due ? (
            <span className={s.due} data-tone={tone}>
              {dueText(task.due)}
            </span>
          ) : null}
        </span>
        <PriorityIcon p={task.priority} />
        <Avatar person={task.assignee} />
      </span>
    </div>
  );
}
