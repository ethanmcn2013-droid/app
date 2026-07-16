"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { useLabStore } from "../../store";
import type { LabTask } from "../../types";
import { TaskOpenButton } from "../../shared/task-ui";
import styles from "./option-c.module.css";

export function InlineTaskTitle({ task, className = "" }: { task: LabTask; className?: string }) {
  const store = useLabStore();
  const editing = store.editing?.taskId === task.id && store.editing.field === "title";
  const [draftState, setDraftState] = useState<{ taskId: string; value: string } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const draft = draftState?.taskId === task.id ? draftState.value : task.title;

  useEffect(() => {
    if (!editing) return;
    inputRef.current?.focus();
    inputRef.current?.select();
  }, [editing]);

  const cancel = () => {
    setDraftState(null);
    store.clearEditing();
  };
  const commit = () => {
    const next = draft.trim();
    if (next && next !== task.title) store.updateTitle(task.id, next);
    setDraftState(null);
    store.clearEditing();
  };
  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      cancel();
    }
    if (event.key === "Enter") {
      event.preventDefault();
      event.stopPropagation();
      commit();
    }
  };

  if (editing && !store.readOnly) {
    return (
      <input
        aria-label={`Edit ${task.title}`}
        className={`${styles.inlineTitleInput} ${className}`}
        onBlur={commit}
        onChange={(event) => setDraftState({ taskId: task.id, value: event.target.value })}
        onClick={(event) => event.stopPropagation()}
        onKeyDown={onKeyDown}
        ref={inputRef}
        value={draft}
      />
    );
  }

  return <TaskOpenButton className={`${styles.inlineTitleButton} ${className}`} task={task}>{task.title}</TaskOpenButton>;
}

export function focusSpatialTask(id: string) {
  window.setTimeout(() => {
    document.querySelector<HTMLElement>(`[data-c-task="${id}"]`)?.focus();
  }, 0);
}

export function isInteractiveTarget(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && Boolean(target.closest("button, input, select, textarea, a, [contenteditable=true]"));
}
