"use client";

import { useEffect, useRef, useState } from "react";
import type { Task } from "@/lib/data";
import { useTasksDispatch } from "@/lib/tasks/tasks-context";
import sx from "./sheet-sections.module.css";

export function DescriptionEditor({ task }: { task: Task }) {
  const { updateTask } = useTasksDispatch();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(task.description ?? "");
  const [previousDescription, setPreviousDescription] = useState(
    task.description,
  );
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // External description updates (e.g. server hydrate after own edit,
  // or another path mutates description) sync into draft only when
  // not editing, never overwrite user's in-progress text.
  if (!editing && previousDescription !== task.description) {
    setPreviousDescription(task.description);
    setDraft(task.description ?? "");
  }

  // Autoresize the textarea while editing.
  useEffect(() => {
    if (!editing) return;
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [editing, draft]);

  function startEdit(opts?: { caretAtEnd?: boolean }) {
    setEditing(true);
    requestAnimationFrame(() => {
      const el = textareaRef.current;
      if (!el) return;
      el.focus({ preventScroll: true });
      if (opts?.caretAtEnd) {
        const end = el.value.length;
        el.setSelectionRange(end, end);
      }
    });
  }

  function commit() {
    const trimmed = draft.trim();
    const current = task.description ?? "";
    if (trimmed !== current.trim()) {
      // Empty becomes empty string; renderer treats that as "no
      // description" and shows the ghost prompt.
      updateTask(task.id, { description: trimmed });
    }
    setEditing(false);
  }

  function revert() {
    setDraft(task.description ?? "");
    setEditing(false);
  }

  if (editing) {
    return (
      <textarea
        ref={textareaRef}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.preventDefault();
            revert();
          }
          // Enter inserts newline (default behavior). Multi-line is the
          // mode, descriptions are prose.
        }}
        className={sx.descInput}
        placeholder="Add a description"
        aria-label="Task description"
      />
    );
  }

  const description = task.description?.trim();
  if (!description) {
    return (
      <button
        type="button"
        onClick={() => startEdit()}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            startEdit();
          }
        }}
        className={sx.desc}
        data-empty=""
      >
        Add a description
      </button>
    );
  }

  return (
    <p
      role="button"
      tabIndex={0}
      onClick={() => startEdit({ caretAtEnd: false })}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          startEdit({ caretAtEnd: true });
        }
      }}
      className={sx.desc}
      title="Click to edit"
    >
      {description}
    </p>
  );
}
