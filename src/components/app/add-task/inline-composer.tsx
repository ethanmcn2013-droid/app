"use client";

import { motion, useReducedMotion, AnimatePresence } from "motion/react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { LaneId } from "@/lib/data";
import { useTasksDispatch } from "@/lib/tasks/tasks-context";
import { parseTaskInput } from "@/lib/nlp/parse-task-input";

export function InlineComposer({
  lane,
  onClose,
}: {
  lane: LaneId;
  onClose: () => void;
}) {
  const reduce = useReducedMotion();
  const { addTask } = useTasksDispatch();
  const [title, setTitle] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const parsed = useMemo(() => parseTaskInput(title), [title]);
  const dateDetected = !!parsed.dueAt && !!parsed.dueLabel;

  useEffect(() => {
    inputRef.current?.focus({ preventScroll: true });
  }, []);

  function submit() {
    if (!parsed.title.trim()) {
      onClose();
      return;
    }
    addTask({
      title: parsed.title,
      lane,
      due: parsed.dueLabel,
      dueAt: parsed.dueAt,
    });
    setTitle("");
    // Composer stays open for rapid follow-ups.
    requestAnimationFrame(() => inputRef.current?.focus());
  }

  return (
    <motion.div
      initial={reduce ? { opacity: 0 } : { opacity: 0, height: 0, y: 4 }}
      animate={
        reduce
          ? { opacity: 1 }
          : { opacity: 1, height: "auto", y: 0 }
      }
      exit={reduce ? { opacity: 0 } : { opacity: 0, height: 0 }}
      transition={
        reduce
          ? { duration: 0.12 }
          : { duration: 0.22, ease: [0.16, 1, 0.3, 1] }
      }
      className="overflow-hidden border-t border-line-soft/60"
    >
      <input
        ref={inputRef}
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
          } else if (e.key === "Escape") {
            e.preventDefault();
            onClose();
          }
        }}
        onBlur={() => {
          if (!title.trim()) onClose();
        }}
        placeholder={`What's next? Try "by Friday at 3pm"`}
        autoComplete="off"
        spellCheck={false}
        className="block w-full bg-transparent px-2 py-2 text-[13px] leading-snug text-ink placeholder:text-ink-faint focus:outline-none"
      />
      <AnimatePresence initial={false}>
        {dateDetected ? (
          <motion.div
            key="composer-nlp"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden px-2 pb-1.5"
          >
            <span className="inline-flex items-center gap-1 rounded bg-brand-soft px-1.5 py-0.5 text-[10.5px] font-medium text-brand">
              <span
                className="block h-1 w-1 rounded-full"
                style={{ background: "var(--brand)" }}
              />
              Due {parsed.dueLabel}
            </span>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </motion.div>
  );
}
