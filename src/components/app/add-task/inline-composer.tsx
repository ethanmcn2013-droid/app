"use client";

import { motion, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import type { LaneId } from "@/lib/data";
import { useTasksDispatch } from "@/lib/tasks/tasks-context";

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

  useEffect(() => {
    inputRef.current?.focus({ preventScroll: true });
  }, []);

  function submit() {
    const trimmed = title.trim();
    if (!trimmed) {
      onClose();
      return;
    }
    addTask({ title: trimmed, lane });
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
        placeholder="What's next?"
        autoComplete="off"
        spellCheck={false}
        className="block w-full bg-transparent px-2 py-2 text-[13px] leading-snug text-ink placeholder:text-ink-faint focus:outline-none"
      />
    </motion.div>
  );
}
