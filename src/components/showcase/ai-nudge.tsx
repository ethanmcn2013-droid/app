"use client";

import { motion, AnimatePresence } from "motion/react";

export function AiNudge({
  open,
  stage,
  taskTitle,
  user,
}: {
  open: boolean;
  stage: "idle" | "open" | "sending" | "sent";
  taskTitle: string;
  user: string;
}) {
  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 12, scale: 0.96 }}
          transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
          className="pointer-events-none absolute left-1/2 top-[18%] z-[50] w-[320px] -translate-x-1/2 rounded-2xl border border-line-soft bg-white/95 p-3.5 shadow-[0_30px_60px_-20px_rgba(20,21,26,0.32),0_8px_20px_rgba(20,21,26,0.08)] backdrop-blur"
        >
          <div className="flex items-start gap-3">
            <div
              className="mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg"
              style={{
                background:
                  "linear-gradient(135deg, var(--brand) 0%, #7c5cff 100%)",
                boxShadow: "0 6px 14px rgba(79, 70, 229, 0.35)",
              }}
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="white"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M12 3l1.9 5.8L20 10l-5.1 3.7L17 20l-5-3.6L7 20l1.9-6.3L4 10l6.1-1.2z" />
              </svg>
            </div>
            <div className="flex-1">
              <div className="text-[10.5px] font-semibold uppercase tracking-wider text-brand">
                Tasks AI
              </div>
              <div className="mt-1 text-[12.5px] leading-snug text-ink">
                <span className="font-semibold">{taskTitle}</span> has been idle
                for 4 days. Send a nudge to{" "}
                <span className="font-semibold">{user}</span>?
              </div>
              <div className="mt-2.5 flex items-center gap-1.5">
                <motion.button
                  className="inline-flex items-center gap-1 rounded-md bg-ink px-2.5 py-1 text-[11px] font-medium text-white"
                  animate={{
                    scale: stage === "sending" ? 0.95 : 1,
                  }}
                >
                  {stage === "sending" ? (
                    <>
                      <motion.span
                        className="block h-2.5 w-2.5 rounded-full border-2 border-white/40 border-t-white"
                        animate={{ rotate: 360 }}
                        transition={{
                          duration: 0.8,
                          ease: "linear",
                          repeat: Infinity,
                        }}
                      />
                      Sending
                    </>
                  ) : stage === "sent" ? (
                    <>
                      <svg
                        width="11"
                        height="11"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="3"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                      Sent
                    </>
                  ) : (
                    <>Send nudge</>
                  )}
                </motion.button>
                <button className="rounded-md px-2.5 py-1 text-[11px] font-medium text-ink-soft hover:bg-bg-sunken">
                  Dismiss
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
