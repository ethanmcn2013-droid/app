"use client";

import { useMemo, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import { LANES } from "@/lib/data";
import { useTasksDispatch } from "@/lib/tasks/tasks-context";
import { Dialog } from "@/components/primitives/dialog";
import { useDomain } from "@/lib/domain-context";
import { useToast } from "@/components/primitives/toast";
import { parseTaskInput } from "@/lib/nlp/parse-task-input";
import {
  looksLikeUnsupportedRecurrence,
  formatRecurrenceLabel,
} from "@/lib/nlp/parse-recurrence";

export function QuickCreateDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { addTask } = useTasksDispatch();
  const { toast } = useToast();
  const [title, setTitle] = useState("");
  const reduceMotion = useReducedMotion();
  const todoLane = LANES.todo;
  const pack = useDomain();

  // Parse NLP date + recurrence references on every keystroke.
  // The result drives the live preview AND the submit payload.
  const parsed = useMemo(() => parseTaskInput(title), [title]);
  const dateDetected = !!parsed.dueAt && !!parsed.dueLabel;
  const recurrenceDetected = !!parsed.recurrence;
  const tagsDetected = !!parsed.tags && parsed.tags.length > 0;
  // True when input looks like a recurrence attempt but the parser couldn't handle it.
  const recurrenceRefusal = useMemo(
    () => !recurrenceDetected && looksLikeUnsupportedRecurrence(title),
    [title, recurrenceDetected],
  );

  function submit() {
    if (!parsed.title.trim()) return; // silent no-op
    // Soft-fail on unsupported recurrence: create the task without the
    // recurrence and surface a quiet toast so the keystroke produces a
    // visible result. The product's job is to capture the thought; the
    // recurrence becomes a follow-up nudge, not a silent block.
    const droppedRecurrence = recurrenceRefusal;
    addTask({
      title: parsed.title,
      due: parsed.dueLabel,
      dueAt: parsed.dueAt,
      recurrence: droppedRecurrence ? undefined : parsed.recurrence,
      tags: parsed.tags,
    });
    setTitle("");
    onClose();
    if (droppedRecurrence) {
      toast("Task created", {
        body: "That repeat phrasing isn't supported. Try \"every Tuesday\", or set Repeats from the task panel.",
        tone: "info",
        duration: 5200,
      });
    }
  }

  function close() {
    setTitle("");
    onClose();
  }

  // What the parser will do, spoken: the visual preview chips animate in
  // and out of the tree, so a screen reader needs this permanently-mounted
  // status line to hear the same facts.
  const parsePreviewStatus = [
    dateDetected ? `Due ${parsed.dueLabel}.` : null,
    recurrenceDetected && parsed.recurrence
      ? `Repeats ${formatRecurrenceLabel(parsed.recurrence)}.`
      : null,
    tagsDetected ? `Tags: ${(parsed.tags ?? []).join(", ")}.` : null,
    recurrenceRefusal ? "That repeat phrasing isn't supported." : null,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <Dialog open={open} onClose={close} ariaLabel="Add a task" motionMode="instant">
      <div className="px-5 pt-4.5 pb-4">
        {/* A stable accessible name — the visible placeholder stays the
            per-pack example, but the NAME must not be whatever the pack
            example (or the typed value) happens to be. */}
        <input
          id="quick-create-input"
          aria-label="Task name"
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
          placeholder={`Name a task, try: ${pack.firstTaskExample}`}
          autoComplete="off"
          spellCheck={false}
          className="w-full bg-transparent text-[17px] font-medium leading-snug tracking-[-0.01em] text-ink placeholder:text-ink-faint focus:outline-none"
        />

        <span aria-live="polite" className="sr-only" role="status">
          {parsePreviewStatus}
        </span>

        {/* NLP preview, slides in when chrono detects a date phrase or
            the recurrence parser fires. Shows the cleaned title, due chip,
            and recurrence chip so the user sees what the parser will do
            BEFORE pressing Enter, no surprise. */}
        <AnimatePresence initial={false}>
          {(dateDetected || recurrenceDetected || tagsDetected) ? (
            <motion.div
              key="nlp-preview"
              initial={reduceMotion ? { opacity: 0 } : { opacity: 0, transform: "translateY(-2px)" }}
              animate={{ opacity: 1, transform: "translateY(0)" }}
              exit={reduceMotion ? { opacity: 0 } : { opacity: 0, transform: "translateY(-1px)" }}
              transition={{ duration: reduceMotion ? 0.1 : 0.2, ease: [0.23, 1, 0.32, 1] }}
              className="mt-2.5 overflow-hidden"
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
                <span className="ml-auto flex flex-shrink-0 items-center gap-1.5">
                  {dateDetected ? (
                    <span className="inline-flex items-center gap-1.5 rounded bg-brand-soft px-1.5 py-0.5 text-[11px] font-medium text-brand">
                      <span
                        className="block h-1 w-1 rounded-full"
                        style={{ background: "var(--brand)" }}
                      />
                      Due {parsed.dueLabel}
                    </span>
                  ) : null}
                  {recurrenceDetected && parsed.recurrence ? (
                    <span className="inline-flex items-center gap-1 rounded bg-bg-sunken px-1.5 py-0.5 text-[11px] font-medium text-ink-soft">
                      <span aria-hidden="true">{"↻"}</span>
                      {formatRecurrenceLabel(parsed.recurrence)}
                    </span>
                  ) : null}
                  {tagsDetected
                    ? parsed.tags!.map((tag) => (
                        <span
                          key={tag}
                          className="inline-flex items-center gap-1 rounded bg-bg-sunken px-1.5 py-0.5 text-[11px] font-medium text-ink-soft"
                        >
                          <span aria-hidden="true">#</span>
                          {tag}
                        </span>
                      ))
                    : null}
                </span>
              </div>
            </motion.div>
          ) : null}

          {/* Refusal hint, fires when the input looks like a recurrence
              attempt that the parser can't handle. Non-blocking: the user
              can still submit but the guard at submit() returns early. */}
          {recurrenceRefusal ? (
            <motion.div
              key="recurrence-refusal"
              initial={reduceMotion ? { opacity: 0 } : { opacity: 0, transform: "translateY(-2px)" }}
              animate={{ opacity: 1, transform: "translateY(0)" }}
              exit={reduceMotion ? { opacity: 0 } : { opacity: 0, transform: "translateY(-1px)" }}
              transition={{ duration: reduceMotion ? 0.1 : 0.18, ease: [0.23, 1, 0.32, 1] }}
              className="mt-2 overflow-hidden"
            >
              <p className="rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-[11.5px] leading-[1.4] text-amber-700">
                That repeat phrasing isn&rsquo;t supported &mdash; try &ldquo;every Tuesday&rdquo;, or drop the timing words and set Repeats in the task panel.
              </p>
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
