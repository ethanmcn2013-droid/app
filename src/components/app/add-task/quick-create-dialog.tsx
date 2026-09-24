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
    <Dialog open={open} onClose={close} ariaLabel="Add a task" motionMode="instant" width={560}>
      <div className="flex items-center justify-between border-b border-[color:var(--v3-border)] px-5 py-3">
        <p className="text-[13px] font-semibold text-[color:var(--v3-text)]">New task</p>
        <span className="truncate pl-3 text-[12px] text-[color:var(--v3-text-3)]">{pack.boardName || pack.workspaceTitle}</span>
      </div>
      <div className="px-5 pb-4 pt-4">
        {/* A stable accessible name: the example lives in the hint below, so
            the NAME is never whatever the pack example or typed value is. */}
        <input
          id="quick-create-input"
          aria-label="Task name"
          aria-describedby="quick-create-hint"
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
          placeholder="What needs doing?"
          // The borderless field is the dialog's only input and its caret is
          // the focus indicator; the global ring would box the text itself.
          style={{ outline: "none" }}
          autoComplete="off"
          spellCheck={false}
          className="w-full bg-transparent text-[16px] font-medium leading-snug tracking-[-0.01em] text-[color:var(--v3-text)] placeholder:text-[color:var(--v3-text-3)] focus:outline-none"
        />
        <p id="quick-create-hint" className="mt-1.5 text-[12.5px] leading-relaxed text-[color:var(--v3-text-3)]">
          Try &ldquo;{pack.firstTaskExample}&rdquo;. Dates like Friday and #labels are picked up as you type.
        </p>

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

      </div>
      <div className="flex items-center justify-between gap-3 border-t border-[color:var(--v3-border)] bg-[color:var(--v3-sunken)] px-5 py-3">
        <span
          className="inline-flex items-center gap-1.5 rounded-full border border-[color:var(--v3-border)] bg-[color:var(--v3-surface)] px-2.5 py-1 text-[12px] font-medium text-[color:var(--v3-text-2)]"
          title="New tasks start here"
        >
          <span
            className="block h-2 w-2 rounded-full border-[1.5px] border-[color:var(--v3-text-3)]"
            aria-hidden="true"
          />
          {todoLane.name}
        </span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={close}
            className="inline-flex h-[32px] items-center rounded-[var(--v3-radius)] px-3 text-[13px] font-medium text-[color:var(--v3-text-2)] hover:bg-[color:var(--v3-hover)]"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={!parsed.title.trim()}
            className="inline-flex h-[32px] items-center gap-2 rounded-[var(--v3-radius)] bg-[color:var(--v3-accent)] px-3 text-[13px] font-medium text-[color:var(--v3-on-accent)] hover:bg-[color:var(--v3-accent-hover)] disabled:opacity-50"
          >
            Create task
            <kbd className="inline-flex h-[18px] items-center rounded border border-white/30 px-1 font-sans text-[10px]">
              ⏎
            </kbd>
          </button>
        </div>
      </div>
    </Dialog>
  );
}
