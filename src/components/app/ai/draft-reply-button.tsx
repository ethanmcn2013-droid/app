"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useTransition,
} from "react";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import { draftReplyAction } from "@/server/actions/ai";

/**
 * Draft a reply, the small AI affordance next to the composer's
 * Send hint. Click opens a popover with a tiny intent input. On
 * submit we call the streaming server action and append tokens to
 * the host composer's textarea via `onDraft`.
 *
 * Design notes:
 * - Anti-spam stance: we don't auto-suggest. Nothing happens until
 *   the user clicks. Once a draft lands, the user owns it, they
 *   can edit, replace, or delete before posting.
 * - Streaming: tokens arrive into the parent textarea live. No
 *   modal, no "review and accept", the brand is opinionated about
 *   not adding ceremony.
 * - When AI isn't configured we still render the button (it's
 *   harmless) and the action returns a static "AI not configured"
 *   message so the user understands the wiring.
 */
type Props = {
  /** Task we're drafting against. */
  taskId: string;
  /** Receives the streaming text. Called once with empty string at
   *  the start of a stream (so the host can clear), then on each
   *  token delta with the cumulative text. */
  onDraft: (cumulative: string) => void;
  /** Disable when the composer is mid-submit. */
  disabled?: boolean;
};

export function DraftReplyButton({ taskId, onDraft, disabled }: Props) {
  const [open, setOpen] = useState(false);
  const [intent, setIntent] = useState("");
  const [isStreaming, startTransition] = useTransition();
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const reduce = useReducedMotion();

  // Close on outside click / Escape so the popover behaves like a
  // proper dismissible thing.
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    function onClickAway(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onClickAway);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onClickAway);
    };
  }, [open]);

  // Autofocus the intent input when the popover opens.
  useEffect(() => {
    if (open) {
      requestAnimationFrame(() => {
        inputRef.current?.focus();
      });
    }
  }, [open]);

  const submit = useCallback(() => {
    if (isStreaming || disabled) return;
    onDraft("");
    startTransition(async () => {
      try {
        const stream = await draftReplyAction(
          taskId,
          intent.trim() || undefined,
        );
        const reader = stream.getReader();
        let acc = "";
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          if (typeof value === "string") {
            acc += value;
            onDraft(acc);
          }
        }
      } catch (err) {
        console.warn("draft-reply: stream failed", err);
      } finally {
        setOpen(false);
        setIntent("");
      }
    });
  }, [taskId, intent, isStreaming, disabled, onDraft]);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={disabled || isStreaming}
        aria-label="Draft a reply"
        title="Draft a reply"
        className="group inline-flex min-h-[44px] items-center gap-1 rounded-full border border-line-soft bg-white px-3 text-[11px] font-medium uppercase tracking-[0.08em] text-ink-quiet transition-all duration-200 hover:border-brand/40 hover:text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/30 disabled:opacity-40 sm:min-h-7 sm:px-2.5"
        style={{
          transitionTimingFunction: "var(--ease-out-expo)",
        }}
      >
        <SparkleIcon spinning={isStreaming} />
        <span>{isStreaming ? "Drafting" : "Draft a reply"}</span>
      </button>

      <AnimatePresence>
        {open ? (
          <motion.div
            initial={
              reduce
                ? { opacity: 0 }
                : { opacity: 0, y: 6, scale: 0.98 }
            }
            animate={reduce ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
            exit={
              reduce
                ? { opacity: 0 }
                : { opacity: 0, y: 4, scale: 0.98 }
            }
            transition={{
              duration: 0.18,
              ease: [0.16, 1, 0.3, 1],
            }}
            className="absolute bottom-[34px] right-0 z-30 w-[min(320px,calc(100vw-32px))] rounded-xl border border-line-soft bg-white p-4 shadow-[0_18px_40px_-18px_rgba(15,15,30,0.25)]"
          >
            <div className="flex items-center gap-1.5 pb-2">
              <span
                aria-hidden
                className="block h-1.5 w-1.5 rounded-full"
                style={{
                  background:
                    "linear-gradient(135deg, var(--brand) 0%, #4338ca 100%)",
                }}
              />
              <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-quiet">
                Draft a reply
              </span>
            </div>
            <p className="mb-3 text-[12px] leading-[1.5] text-ink-soft">
              Sends this task&apos;s title, description, conversation, your
              name and instruction to Anthropic. Nothing is posted until you
              review and send the draft.
            </p>
            <label className="block text-[11px] font-medium text-ink-quiet">
              What should the reply do? <span className="font-normal">(optional)</span>
            <input
              ref={inputRef}
              type="text"
              value={intent}
              onChange={(e) => setIntent(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  submit();
                }
              }}
              placeholder="Acknowledge and ship by Friday"
              className="mt-1.5 block min-h-[44px] w-full rounded-md border border-line-soft bg-bg-sunken/40 px-2.5 py-2 text-[13px] text-ink placeholder:text-ink-faint focus:border-brand/50 focus:bg-white focus:outline-none"
            />
            </label>
            <div className="mt-3 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="inline-flex min-h-[44px] items-center rounded-lg px-3 text-[12px] font-medium text-ink-soft hover:bg-bg-sunken focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/30"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={submit}
                disabled={isStreaming}
                className="inline-flex min-h-[44px] items-center gap-1 rounded-lg bg-ink px-3 text-[12px] font-medium text-white transition-opacity duration-200 hover:opacity-90 disabled:opacity-40"
              >
                {isStreaming ? "Drafting…" : "Send to AI and draft"}
              </button>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

function SparkleIcon({ spinning }: { spinning: boolean }) {
  return (
    <motion.svg
      width="11"
      height="11"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      animate={spinning ? { rotate: 360 } : { rotate: 0 }}
      transition={
        spinning
          ? { duration: 1.6, ease: "linear", repeat: Infinity }
          : { duration: 0.2 }
      }
      aria-hidden
    >
      <path d="M12 3 L13.5 9 L20 10.5 L13.5 12 L12 18 L10.5 12 L4 10.5 L10.5 9 Z" />
    </motion.svg>
  );
}
