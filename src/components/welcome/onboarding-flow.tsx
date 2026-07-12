"use client";

import { useState, useTransition, useEffect, type ReactNode } from "react";
import { motion, AnimatePresence } from "motion/react";
import { useRouter } from "next/navigation";
import { Wordmark } from "@/components/brand/wordmark";
import {
  SEGMENTS,
  SEGMENT_ORDER,
  ONBOARDING_HEADLINE,
  ONBOARDING_SUBHEAD,
  type PrimaryUseCase,
} from "@/lib/onboarding/segments";
import {
  completeOnboardingAction,
  skipOnboardingAction,
} from "@/server/actions/onboarding";
import { markFirstRunCompleteAction } from "@/server/actions/seed";
import { trackOnboardingEvent } from "@/lib/onboarding/analytics";

type PendingTemplate = { id: string; name: string };

type Step = "welcome" | "segment" | "context" | "starter";

const STEP_INDEX: Record<Step, number> = {
  welcome: 0,
  segment: 1,
  context: 2,
  starter: 3,
};

function SegmentIcon({ id }: { id: PrimaryUseCase }) {
  const paths: Record<PrimaryUseCase, ReactNode> = {
    venue: (
      <path
        d="M4 20V8l8-5 8 5v12M9 20v-6h6v6"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    ),
    wedding: (
      <path
        d="M12 21s-7-4.5-7-11a4 4 0 0 1 7-2 4 4 0 0 1 7 2c0 6.5-7 11-7 11z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    ),
    student: (
      <>
        <path
          d="M4 10l8-4 8 4-8 4-8-4z"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinejoin="round"
          fill="none"
        />
        <path
          d="M20 10v5M12 14v6"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      </>
    ),
    "small-business": (
      <path
        d="M3 9h18v11H3zM7 9V6h10v3M9 13h2M13 13h2"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    ),
    "event-management": (
      <path
        d="M8 3v3M16 3v3M4 9h16M6 13h4M14 13h4M6 17h4M14 17h4"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        fill="none"
      />
    ),
    "creative-studio": (
      <path
        d="M12 3l2.5 7.5H22l-6 4.5 2.5 7.5L12 18l-6.5 4.5L8 15 2 10.5h7.5z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
        fill="none"
      />
    ),
    "internal-team": (
      <>
        <circle cx="9" cy="8" r="2.5" stroke="currentColor" strokeWidth="1.5" fill="none" />
        <circle cx="15" cy="8" r="2.5" stroke="currentColor" strokeWidth="1.5" fill="none" />
        <path
          d="M5 19c0-2.5 2-4 4-4s4 1.5 4 1.5 2-1.5 4-1.5 4 1.5 4 4"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          fill="none"
        />
      </>
    ),
    other: (
      <path
        d="M12 8v8M8 12h8"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    ),
  };

  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      className="text-ink-soft"
      aria-hidden
    >
      {paths[id]}
    </svg>
  );
}

function ProgressDots({ step }: { step: Step }) {
  const active = STEP_INDEX[step];
  const total = 4;
  return (
    <div
      className="flex items-center gap-1.5"
      role="progressbar"
      aria-valuenow={active + 1}
      aria-valuemin={1}
      aria-valuemax={total}
      aria-label={`Step ${active + 1} of ${total}`}
    >
      {Array.from({ length: total }).map((_, i) => (
        <span
          key={i}
          className={
            "h-1 rounded-full transition-all duration-300 " +
            (i === active
              ? "w-5 bg-brand"
              : i < active
                ? "w-1.5 bg-brand/40"
                : "w-1.5 bg-line-soft")
          }
        />
      ))}
    </div>
  );
}

export function OnboardingFlow({
  pendingTemplate = null,
  preselectedSegment = null,
}: {
  pendingTemplate?: PendingTemplate | null;
  preselectedSegment?: PrimaryUseCase | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [step, setStep] = useState<Step>(() => {
    if (preselectedSegment) {
      const cfg = SEGMENTS[preselectedSegment];
      return cfg.contextQuestion && cfg.contextOptions.length > 0
        ? "context"
        : "starter";
    }
    return pendingTemplate ? "starter" : "welcome";
  });
  const [segment, setSegment] = useState<PrimaryUseCase | null>(
    preselectedSegment ?? (pendingTemplate ? "wedding" : null),
  );
  const [context, setContext] = useState<string | null>(null);

  useEffect(() => {
    trackOnboardingEvent("onboarding_started", {
      source: preselectedSegment ?? undefined,
    });
  }, [preselectedSegment]);

  useEffect(() => {
    trackOnboardingEvent("onboarding_step_viewed", { step });
  }, [step]);

  const segmentConfig = segment ? SEGMENTS[segment] : null;
  const hasContextStep =
    segmentConfig?.contextQuestion &&
    segmentConfig.contextOptions.length > 0;

  const finish = (seedMode: "starter" | "blank") => {
    if (!segment) return;
    startTransition(async () => {
      try {
        await completeOnboardingAction({
          primaryUseCase: segment,
          secondaryContext: context,
          seedMode,
        });
      } catch (e) {
        console.warn("onboarding: complete failed", e);
      }
      router.push("/app/board");
    });
  };

  const openWithTemplate = () => {
    startTransition(async () => {
      try {
        await markFirstRunCompleteAction();
      } catch (e) {
        console.warn("onboarding: mark-first-run failed", e);
      }
      router.push("/app/board");
    });
  };

  const skipAll = () => {
    startTransition(async () => {
      try {
        await skipOnboardingAction();
      } catch (e) {
        console.warn("onboarding: skip failed", e);
      }
      router.push("/app/board");
    });
  };

  const selectSegment = (id: PrimaryUseCase) => {
    setSegment(id);
    setContext(null);
    trackOnboardingEvent("onboarding_segment_selected", {
      primary_use_case: id,
    });
    const cfg = SEGMENTS[id];
    if (cfg.contextQuestion && cfg.contextOptions.length > 0) {
      setStep("context");
    } else {
      setStep("starter");
    }
  };

  const selectContext = (id: string) => {
    setContext(id);
    trackOnboardingEvent("onboarding_context_selected", {
      primary_use_case: segment ?? undefined,
      secondary_context: id,
    });
    setStep("starter");
  };

  return (
    <div className="flex min-h-screen flex-col bg-bg">
      <header className="flex items-center justify-between px-6 pt-6">
        <Wordmark size="md" />
        <ProgressDots step={step} />
      </header>

      <main className="flex flex-1 items-center justify-center px-6 pb-16 pt-8">
        <div className="w-full max-w-[720px]">
          <AnimatePresence mode="wait">
            {step === "welcome" && (
              <motion.div
                key="welcome"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.38, ease: [0.16, 1, 0.3, 1] }}
                className="text-center"
              >
                <h1 className="text-balance text-[clamp(2rem,1.2rem+3vw,3.2rem)] font-semibold leading-[1.04] tracking-[-0.035em] text-ink">
                  {ONBOARDING_HEADLINE}
                </h1>
                <p className="mx-auto mt-4 max-w-[48ch] text-[16px] leading-[1.55] text-ink-soft">
                  {ONBOARDING_SUBHEAD}
                </p>
                <button
                  type="button"
                  onClick={() => setStep("segment")}
                  className="mt-10 inline-flex items-center gap-2 rounded-full bg-ink px-6 py-2.5 text-[14px] font-medium text-white shadow-[0_10px_28px_-10px_rgba(20,21,26,0.45)] transition-transform hover:-translate-y-px"
                >
                  Continue
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M5 12h14M13 5l7 7-7 7" />
                  </svg>
                </button>
                <a
                  href="/welcome/plan"
                  className="mx-auto mt-4 block w-fit rounded-lg px-3 py-2 text-[13px] text-ink-soft outline-none transition-colors hover:bg-bg-sunken hover:text-ink focus-visible:ring-2 focus-visible:ring-brand/30"
                >
                  Set up classes, modules, or a wedding
                </a>
              </motion.div>
            )}

            {step === "segment" && (
              <motion.div
                key="segment"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.38, ease: [0.16, 1, 0.3, 1] }}
              >
                <h2 className="text-balance text-[clamp(1.6rem,1.1rem+2vw,2.4rem)] font-semibold leading-[1.08] tracking-[-0.03em] text-ink">
                  What are you hoping to coordinate?
                </h2>
                <p className="mt-3 max-w-[52ch] text-[15px] leading-[1.5] text-ink-soft">
                  Pick the closest fit. You can change this later.
                </p>

                <div className="mt-8 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                  {SEGMENT_ORDER.map((id) => {
                    const cfg = SEGMENTS[id];
                    return (
                      <button
                        key={id}
                        type="button"
                        onClick={() => selectSegment(id)}
                        disabled={pending}
                        className="group flex items-start gap-3.5 rounded-xl border border-line-soft bg-bg-elevated p-4 text-left transition-all hover:border-ink-soft/25 hover:shadow-[0_16px_40px_-18px_rgba(20,21,26,0.16)] disabled:opacity-60"
                      >
                        <span
                          className="mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg"
                          style={{ background: `color-mix(in srgb, ${cfg.accent} 12%, transparent)` }}
                        >
                          <SegmentIcon id={id} />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-[15px] font-semibold tracking-[-0.005em] text-ink">
                            {cfg.label}
                          </span>
                          <span className="mt-0.5 block text-[13px] leading-[1.45] text-ink-soft">
                            {cfg.description}
                          </span>
                        </span>
                        <svg
                          width="14"
                          height="14"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          className="mt-1 flex-shrink-0 text-ink-quiet opacity-0 transition-all group-hover:translate-x-0.5 group-hover:opacity-100"
                        >
                          <path d="M5 12h14M13 5l7 7-7 7" />
                        </svg>
                      </button>
                    );
                  })}
                </div>

                <div className="mt-6 flex justify-center">
                  <button
                    type="button"
                    onClick={skipAll}
                    disabled={pending}
                    className="text-[13px] text-ink-quiet underline-offset-4 transition-colors hover:text-ink-soft hover:underline disabled:opacity-60"
                  >
                    Skip for now
                  </button>
                </div>
              </motion.div>
            )}

            {step === "context" && segmentConfig && (
              <motion.div
                key="context"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.38, ease: [0.16, 1, 0.3, 1] }}
              >
                <button
                  type="button"
                  onClick={() => setStep("segment")}
                  className="group mb-6 inline-flex items-center gap-1.5 text-[13px] text-ink-quiet transition-colors hover:text-ink-soft"
                >
                  <svg
                    className="transition-transform group-hover:-translate-x-0.5 motion-reduce:transition-none"
                    width="13"
                    height="13"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden
                  >
                    <path d="M19 12H5M11 19l-7-7 7-7" />
                  </svg>
                  Back
                </button>
                <h2 className="text-balance text-[clamp(1.5rem,1rem+2vw,2.2rem)] font-semibold leading-[1.08] tracking-[-0.03em] text-ink">
                  {segmentConfig.contextQuestion}
                </h2>
                <p className="mt-3 text-[15px] text-ink-soft">
                  Optional, helps us line up the right examples.
                </p>

                <div className="mt-7 flex flex-wrap gap-2">
                  {segmentConfig.contextOptions.map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => selectContext(opt.id)}
                      disabled={pending}
                      className="rounded-full border border-line-soft bg-bg-elevated px-4 py-2 text-[14px] font-medium text-ink transition-all hover:border-brand/30 hover:bg-brand-soft/20 disabled:opacity-60"
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>

                <div className="mt-8">
                  <button
                    type="button"
                    onClick={() => setStep("starter")}
                    disabled={pending}
                    className="text-[13px] text-ink-quiet underline-offset-4 transition-colors hover:text-ink-soft hover:underline disabled:opacity-60"
                  >
                    Skip this step
                  </button>
                </div>
              </motion.div>
            )}

            {step === "starter" && segmentConfig && (
              <motion.div
                key="starter"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.38, ease: [0.16, 1, 0.3, 1] }}
              >
                {pendingTemplate ? (
                  <>
                    <h2 className="text-balance text-[clamp(1.5rem,1rem+2vw,2.2rem)] font-semibold leading-[1.08] tracking-[-0.03em] text-ink">
                      Your{" "}
                      <span className="text-ink-soft/70">
                        {pendingTemplate.name.toLowerCase()}
                      </span>{" "}
                      is ready.
                    </h2>
                    <p className="mt-3 max-w-[50ch] text-[15px] leading-[1.5] text-ink-soft">
                      You chose a template before signing in. Open your workspace,
                      or pick a different coordination type below.
                    </p>
                    <button
                      type="button"
                      onClick={openWithTemplate}
                      disabled={pending}
                      className="mt-8 flex w-full items-center justify-between gap-4 rounded-xl border border-brand bg-brand-soft/25 p-5 text-left transition-all hover:bg-brand-soft/40 disabled:opacity-60"
                    >
                      <span>
                        <span className="block text-[11px] font-semibold uppercase tracking-[0.14em] text-brand">
                          Template loaded
                        </span>
                        <span className="mt-1 block text-[16px] font-semibold text-ink">
                          Open {pendingTemplate.name.toLowerCase()}
                        </span>
                      </span>
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="text-brand"
                      >
                        <path d="M5 12h14M13 5l7 7-7 7" />
                      </svg>
                    </button>
                    <p className="mt-10 text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-quiet">
                      Or coordinate as
                    </p>
                  </>
                ) : (
                  <>
                    {!hasContextStep && (
                      <button
                        type="button"
                        onClick={() => setStep("segment")}
                        className="group mb-6 inline-flex items-center gap-1.5 text-[13px] text-ink-quiet transition-colors hover:text-ink-soft"
                      >
                        <svg
                          className="transition-transform group-hover:-translate-x-0.5 motion-reduce:transition-none"
                          width="13"
                          height="13"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.8"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          aria-hidden
                        >
                          <path d="M19 12H5M11 19l-7-7 7-7" />
                        </svg>
                        Back
                      </button>
                    )}
                    <h2 className="text-balance text-[clamp(1.5rem,1rem+2vw,2.2rem)] font-semibold leading-[1.08] tracking-[-0.03em] text-ink">
                      Here&apos;s a calm starting point.
                    </h2>
                    <p className="mt-3 max-w-[50ch] text-[15px] leading-[1.5] text-ink-soft">
                      A few examples for{" "}
                      <span className="font-medium text-ink">
                        {segmentConfig.label.toLowerCase()}
                      </span>
                      . Rename or clear anything later.
                    </p>
                  </>
                )}

                <ul className="mt-7 space-y-2">
                  {segmentConfig.starterItems.map((item) => (
                    <li
                      key={item}
                      className="flex items-center gap-3 rounded-lg border border-line-soft/80 bg-bg-elevated/60 px-4 py-3 text-[14px] text-ink"
                    >
                      <span
                        className="h-1.5 w-1.5 flex-shrink-0 rounded-full"
                        style={{ background: segmentConfig.accent }}
                      />
                      {item}
                    </li>
                  ))}
                </ul>

                <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
                  <button
                    type="button"
                    onClick={() => finish("starter")}
                    disabled={pending || !segment}
                    className="inline-flex flex-1 items-center justify-center gap-2 rounded-full bg-ink px-6 py-2.5 text-[14px] font-medium text-white shadow-[0_10px_28px_-10px_rgba(20,21,26,0.45)] transition-transform hover:-translate-y-px disabled:opacity-60"
                  >
                    {pending ? "Setting up…" : "Open my workspace"}
                  </button>
                  <button
                    type="button"
                    onClick={() => finish("blank")}
                    disabled={pending || !segment}
                    className="text-[13px] text-ink-quiet underline-offset-4 transition-colors hover:text-ink-soft hover:underline disabled:opacity-60"
                  >
                    Start blank instead
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}
