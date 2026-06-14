"use client";

import { motion, useReducedMotion, AnimatePresence } from "motion/react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { LaneId } from "@/lib/data";
import { useTasksDispatch } from "@/lib/tasks/tasks-context";
import { useToast } from "@/components/primitives/toast";
import { parseTaskInput } from "@/lib/nlp/parse-task-input";
import {
  looksLikeUnsupportedRecurrence,
  formatRecurrenceLabel,
} from "@/lib/nlp/parse-recurrence";

export function InlineComposer({
  lane,
  onClose,
}: {
  lane: LaneId;
  onClose: () => void;
}) {
  const reduce = useReducedMotion();
  const { addTask } = useTasksDispatch();
  const { toast } = useToast();
  const [title, setTitle] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const parsed = useMemo(() => parseTaskInput(title), [title]);
  const dateDetected = !!parsed.dueAt && !!parsed.dueLabel;
  const recurrenceDetected = !!parsed.recurrence;
  const tagsDetected = !!parsed.tags && parsed.tags.length > 0;
  const recurrenceRefusal = useMemo(
    () => !recurrenceDetected && looksLikeUnsupportedRecurrence(title),
    [title, recurrenceDetected],
  );

  useEffect(() => {
    inputRef.current?.focus({ preventScroll: true });
  }, []);

  function submit() {
    if (!parsed.title.trim()) {
      onClose();
      return;
    }
    // Soft-fail on unsupported recurrence: drop the recurrence, create
    // the task, and surface a quiet toast. Enter must produce a visible
    // result — silent no-ops read as "the app froze."
    const droppedRecurrence = recurrenceRefusal;
    addTask({
      title: parsed.title,
      lane,
      due: parsed.dueLabel,
      dueAt: parsed.dueAt,
      recurrence: droppedRecurrence ? undefined : parsed.recurrence,
      tags: parsed.tags,
    });
    setTitle("");
    // Composer stays open for rapid follow-ups.
    requestAnimationFrame(() => inputRef.current?.focus());
    if (droppedRecurrence) {
      toast("Task created", {
        body: "Recurrence not supported yet — try \"every Tuesday\" or set it from the task panel.",
        tone: "info",
        duration: 5200,
      });
    }
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
        placeholder={`What's next? Try "by Friday at 3pm #claire-wedding"`}
        autoComplete="off"
        spellCheck={false}
        className="block w-full bg-transparent px-2 py-2 text-[13px] leading-snug text-ink placeholder:text-ink-faint focus:outline-none"
      />
      <AnimatePresence initial={false}>
        {(dateDetected || recurrenceDetected || tagsDetected) ? (
          <motion.div
            key="composer-nlp"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden px-2 pb-1.5"
          >
            <span className="flex items-center gap-1.5 flex-wrap">
              {dateDetected ? (
                <span className="inline-flex items-center gap-1 rounded bg-brand-soft px-1.5 py-0.5 text-[10.5px] font-medium text-brand">
                  <span
                    className="block h-1 w-1 rounded-full"
                    style={{ background: "var(--brand)" }}
                  />
                  Due {parsed.dueLabel}
                </span>
              ) : null}
              {recurrenceDetected && parsed.recurrence ? (
                <span className="inline-flex items-center gap-1 rounded bg-bg-sunken px-1.5 py-0.5 text-[10.5px] font-medium text-ink-quiet">
                  <span aria-hidden="true">{"↻"}</span>
                  {formatRecurrenceLabel(parsed.recurrence)}
                </span>
              ) : null}
              {tagsDetected
                ? parsed.tags!.map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex items-center gap-1 rounded bg-bg-sunken px-1.5 py-0.5 text-[10.5px] font-medium text-ink-quiet"
                    >
                      <span aria-hidden="true">#</span>
                      {tag}
                    </span>
                  ))
                : null}
            </span>
          </motion.div>
        ) : null}
        {recurrenceRefusal ? (
          <motion.div
            key="recurrence-refusal"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden px-2 pb-1.5"
          >
            <p className="rounded border border-amber-200 bg-amber-50 px-2 py-1 text-[10.5px] leading-[1.4] text-amber-700">
              Recurrence not supported — try &ldquo;every Tuesday&rdquo; or remove the timing language.
            </p>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </motion.div>
  );
}
