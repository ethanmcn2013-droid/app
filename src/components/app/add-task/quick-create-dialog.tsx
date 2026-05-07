"use client";

import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { LANES } from "@/lib/data";
import { useTasksDispatch } from "@/lib/tasks/tasks-context";
import { Dialog } from "@/components/primitives/dialog";
import { useDomain } from "@/lib/domain-context";
import { parseTaskInput } from "@/lib/nlp/parse-task-input";

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
  const pack = useDomain();

  // Parse NLP date references on every keystroke. The result drives
  // the live preview AND the submit payload.
  const parsed = useMemo(() => parseTaskInput(title), [title]);
  const dateDetected = !!parsed.dueAt && !!parsed.dueLabel;

  function submit() {
    if (!parsed.title.trim()) return; // silent no-op
    addTask({
      title: parsed.title,
      due: parsed.dueLabel,
      dueAt: parsed.dueAt,
    });
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
          placeholder={`Name a task — try: ${pack.firstTaskExample}`}
          autoComplete="off"
          spellCheck={false}
          className="w-full bg-transparent text-[17px] font-medium leading-snug tracking-[-0.01em] text-ink placeholder:text-ink-faint focus:outline-none"
        />

        {/* NLP preview — slides in when chrono detects a date phrase.
            The cleaned title and the due chip are previewed here so the
            user sees what the parser is going to do BEFORE pressing
            Enter — no surprise. */}
        <AnimatePresence initial={false}>
          {dateDetected ? (
            <motion.div
              key="nlp-preview"
              initial={{ opacity: 0, height: 0, marginTop: 0 }}
              animate={{
                opacity: 1,
                height: "auto",
                marginTop: 10,
              }}
              exit={{ opacity: 0, height: 0, marginTop: 0 }}
              transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
              className="overflow-hidden"
            >
              <div className="flex items-center gap-2 rounded-lg border border-line-soft/80 bg-bg-sunken/40 px-2.5 py-1.5 text-[12px] text-ink-soft">
                <svg
                  width="13"
                  height="13"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.7"
                  className="text-brand"
                >
                  <rect
                    x="3"
                    y="4"
                    width="18"
                    height="17"
                    rx="2"
                  />
                  <line x1="3" y1="9" x2="21" y2="9" />
                  <line x1="8" y1="2" x2="8" y2="6" />
                  <line x1="16" y1="2" x2="16" y2="6" />
                </svg>
                <span className="truncate font-medium text-ink">
                  {parsed.title}
                </span>
                <span className="ml-auto inline-flex flex-shrink-0 items-center gap-1.5 rounded bg-brand-soft px-1.5 py-0.5 text-[11px] font-medium text-brand">
                  <span
                    className="block h-1 w-1 rounded-full"
                    style={{ background: "var(--brand)" }}
                  />
                  Due {parsed.dueLabel}
                </span>
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>

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
              (parsed.title.trim()
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
