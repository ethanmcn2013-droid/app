"use client";

import { useCallback, useState, useTransition } from "react";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import { summarizeConversationAction } from "@/server/actions/ai";

/**
 * "Summarize this thread", appears above the conversation feed
 * when the thread has ≥ 6 messages. Click to stream a 2-3 sentence
 * recap inline. The button stays in place after; user can re-run.
 *
 * Voice contract: terse, no preamble. Brand voice rules in
 * `src/server/ai.ts` shape the model output.
 */
type Props = {
  taskId: string;
  /** True when the parent feed has ≥ 6 messages. The component
   *  itself returns null otherwise, gate is here so the parent
   *  doesn't have to remember the threshold. */
  eligible: boolean;
};

export function ConversationSummary({ taskId, eligible }: Props) {
  const [summary, setSummary] = useState<string>("");
  const [hasRun, setHasRun] = useState(false);
  const [isStreaming, startTransition] = useTransition();
  const reduce = useReducedMotion();

  const run = useCallback(() => {
    if (isStreaming) return;
    setHasRun(true);
    setSummary("");
    startTransition(async () => {
      try {
        const stream = await summarizeConversationAction(taskId);
        const reader = stream.getReader();
        let acc = "";
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          if (typeof value === "string") {
            acc += value;
            setSummary(acc);
          }
        }
      } catch (err) {
        console.warn("summary: stream failed", err);
        setSummary("Couldn't summarize. Try again in a moment.");
      }
    });
  }, [taskId, isStreaming]);

  if (!eligible) return null;

  return (
    <div className="-mx-1 mb-3">
      <AnimatePresence initial={false} mode="wait">
        {!hasRun ? (
          <motion.div
            key="cta"
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: -4 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
          >
            <button
              type="button"
              onClick={run}
              className="group flex w-full items-center justify-between gap-2 rounded-lg border border-dashed border-line-soft bg-bg-sunken/30 px-3 py-2 text-left transition-all duration-200 hover:border-brand/40 hover:bg-brand-soft/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/30"
              style={{ transitionTimingFunction: "var(--ease-out-expo)" }}
            >
              <span className="flex items-center gap-2">
                <span
                  aria-hidden
                  className="block h-1.5 w-1.5 rounded-full transition-transform duration-300"
                  style={{
                    background:
                      "linear-gradient(135deg, var(--brand) 0%, #4338ca 100%)",
                  }}
                />
                <span className="text-[13px] font-medium text-ink-soft group-hover:text-ink">
                  Summarize this thread
                </span>
              </span>
              <span className="text-[11px] uppercase tracking-[0.12em] text-ink-faint group-hover:text-brand">
                2-3 sentences
              </span>
            </button>
          </motion.div>
        ) : (
          <motion.div
            key="result"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
            className="rounded-lg border border-line-soft bg-white px-3 py-2.5"
          >
            <div className="flex items-center justify-between gap-2 pb-1.5">
              <span className="flex items-center gap-1.5">
                <motion.span
                  aria-hidden
                  className="block h-1.5 w-1.5 rounded-full"
                  style={{
                    background:
                      "linear-gradient(135deg, var(--brand) 0%, #4338ca 100%)",
                  }}
                  animate={
                    isStreaming
                      ? { scale: [1, 1.4, 1], opacity: [0.6, 1, 0.6] }
                      : { scale: 1, opacity: 1 }
                  }
                  transition={{
                    duration: 1.2,
                    ease: "easeInOut",
                    repeat: isStreaming ? Infinity : 0,
                  }}
                />
                <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-quiet">
                  Thread summary
                </span>
              </span>
              <button
                type="button"
                onClick={() => {
                  setHasRun(false);
                  setSummary("");
                }}
                className="text-[11px] uppercase tracking-[0.08em] text-ink-faint transition-colors hover:text-ink-quiet"
                aria-label="Hide summary"
              >
                Hide
              </button>
            </div>
            <p className="text-[13px] leading-[1.55] text-ink-soft">
              {summary || (
                <span className="text-ink-faint">Reading the thread…</span>
              )}
              {isStreaming && summary ? (
                <motion.span
                  aria-hidden
                  className="ml-0.5 inline-block h-[10px] w-[2px] -translate-y-[1px] bg-brand align-middle"
                  animate={{ opacity: [1, 0.2, 1] }}
                  transition={{
                    duration: 0.9,
                    ease: "easeInOut",
                    repeat: Infinity,
                  }}
                />
              ) : null}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
