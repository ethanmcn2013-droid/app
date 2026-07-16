"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { useLabStore } from "../../store";
import type { LabTask } from "../../types";
import { TaskOpenButton } from "../../shared/task-ui";
import styles from "./option-b.module.css";

function EditingTitle({ task, className }: { task: LabTask; className: string }) {
  const store = useLabStore();
  const [draft, setDraft] = useState(task.title);
  const inputRef = useRef<HTMLInputElement>(null);
  const cancelledRef = useRef(false);

  useEffect(() => {
    window.setTimeout(() => inputRef.current?.select(), 0);
  }, []);

  const finish = (commit: boolean) => {
    const next = draft.trim();
    if (commit && next && next !== task.title) store.updateTitle(task.id, next);
    else setDraft(task.title);
    store.clearEditing();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    event.stopPropagation();
    if (event.key === "Enter") {
      event.preventDefault();
      cancelledRef.current = false;
      finish(true);
    } else if (event.key === "Escape") {
      event.preventDefault();
      cancelledRef.current = true;
      finish(false);
    }
  };

  return (
    <input
      aria-label={`Edit title for ${task.title}`}
      className={`${styles.inlineTitleInput} ${className}`}
      data-editing="true"
      data-task-id={task.id}
      onBlur={() => {
        const cancelled = cancelledRef.current;
        cancelledRef.current = false;
        if (store.editing?.taskId === task.id) finish(!cancelled);
      }}
      onChange={(event) => setDraft(event.target.value)}
      onKeyDown={onKeyDown}
      ref={inputRef}
      value={draft}
    />
  );
}

export function InlineTaskTitle({ task, className = "" }: { task: LabTask; className?: string }) {
  const store = useLabStore();
  const editing = store.editing?.taskId === task.id && store.editing.field === "title";
  if (!editing || store.readOnly) {
    return <TaskOpenButton className={`${styles.taskTitleButton} ${className}`} data-task-title="true" task={task} />;
  }
  return <EditingTitle className={className} key={`${task.id}:${task.title}`} task={task} />;
}
