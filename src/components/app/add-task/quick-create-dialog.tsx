"use client";

import { useState } from "react";
import { LANES } from "@/lib/data";
import { useTasksDispatch } from "@/lib/tasks/tasks-context";
import { Dialog } from "@/components/primitives/dialog";

export function QuickCreateDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { addTask } = useTasksDispatch();
  const [title, setTitle] = useState("");
  const todoLane = LANES.todo;

  function submit() {
    const trimmed = title.trim();
    if (!trimmed) return; // silent no-op
    addTask({ title: trimmed });
    setTitle("");
    onClose();
  }

  function close() {
    setTitle("");
    onClose();
  }

  return (
    <Dialog open={open} onClose={close} labelledBy="quick-create-input">
      <div className="px-5 pt-4.5 pb-4">
        <input
          id="quick-create-input"
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => {
            if (
              e.key === "Enter" &&
              !e.shiftKey &&
              !e.nativeEvent.isComposing
            ) {
              e.preventDefault();
              submit();
            }
          }}
          placeholder="Name a task"
          autoComplete="off"
          spellCheck={false}
          className="w-full bg-transparent text-[17px] font-medium leading-snug tracking-[-0.01em] text-ink placeholder:text-ink-faint focus:outline-none"
        />
        <div className="mt-3 flex items-center justify-between">
          <span
            className="inline-flex items-center gap-1.5 rounded-md bg-bg-sunken/60 px-1.5 py-0.5 text-[11.5px] font-medium"
            style={{ color: todoLane.ink }}
            title="Default lane"
          >
            <span
              className="block h-1.5 w-1.5 rounded-full"
              style={{ background: todoLane.dot }}
            />
            {todoLane.name}
          </span>
          <span
            className={
              "inline-flex items-center gap-1.5 text-[11.5px] " +
              (title.trim()
                ? "text-ink-quiet"
                : "text-ink-faint")
            }
          >
            <kbd className="inline-flex h-[18px] items-center rounded border border-line-soft bg-white px-1 font-mono text-[10px]">
              ⏎
            </kbd>
            Create
          </span>
        </div>
      </div>
    </Dialog>
  );
}
