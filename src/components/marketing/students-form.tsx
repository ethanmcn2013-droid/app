"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "motion/react";
import {
  requestStudentCodeAction,
  type StudentVerifyResult,
} from "@/server/actions/comp";

const FAILURE_COPY: Record<
  Exclude<StudentVerifyResult, { ok: true }>["reason"],
  string
> = {
  "invalid-email": "That doesn't look like an email. Try again?",
  "not-edu":
    "We need a .edu address to verify you're a student. Drop it in and we'll send the code.",
};

export function StudentsForm() {
  const [email, setEmail] = useState("");
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<StudentVerifyResult | null>(null);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      const r = await requestStudentCodeAction(email);
      setResult(r);
    });
  };

  return (
    <section className="relative pb-32 pt-16 md:pt-24">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 left-1/2 -z-10 h-[640px] w-[1100px] -translate-x-1/2 rounded-full opacity-40 blur-3xl"
        style={{
          background:
            "radial-gradient(closest-side, rgba(124, 92, 255, 0.18), rgba(79, 70, 229, 0.06), transparent 70%)",
        }}
      />

      <div className="mx-auto w-full max-w-[680px] px-6 text-center">
        <Eyebrow />

        <h1 className="mt-6 text-balance text-[clamp(2.4rem,1.6rem+3.6vw,4.6rem)] font-semibold leading-[1.02] tracking-[-0.04em] text-ink">
          Free for{" "}
          <span className="relative inline-block whitespace-nowrap">
            <span
              aria-hidden
              className="absolute inset-x-1 -bottom-1 -z-10 h-[0.46em] rounded-md"
              style={{
                background:
                  "linear-gradient(110deg, rgba(124,92,255,0.28), rgba(79,70,229,0.16))",
              }}
            />
            students.
          </span>
        </h1>

        <p className="mx-auto mt-5 max-w-[52ch] text-[17px] leading-[1.55] text-ink-soft">
          Tasks Pro, on us, for the semester. Sign up with your .edu
          address and Pro lands automatically — no card, no trial, no
          catch. The form below is for the rare cases the auto-grant
          missed; otherwise just open the workspace and start.
        </p>

        <div className="mx-auto mt-6 inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50/40 px-4 py-1.5 text-[12.5px] font-medium text-emerald-800">
          <span
            className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500"
            aria-hidden
          />
          Auto-applied at signup · 120-day Pro
        </div>

        <AnimatePresence mode="wait">
          {result?.ok ? (
            <SuccessCard key="success" code={result.code} />
          ) : (
            <motion.form
              key="form"
              onSubmit={submit}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
              className="mx-auto mt-10 flex w-full max-w-[480px] flex-col gap-3"
            >
              <div className="flex items-center gap-2 rounded-full border border-line-soft bg-bg-elevated p-1.5 shadow-[0_8px_24px_-12px_rgba(20,21,26,0.16)] focus-within:border-ink-soft/30">
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setResult(null);
                  }}
                  placeholder="you@school.edu"
                  className="flex-1 bg-transparent px-3 py-2 text-[15px] text-ink placeholder:text-ink-faint focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={pending || !email.trim()}
                  className="inline-flex items-center gap-1.5 rounded-full bg-ink px-4 py-2 text-[13px] font-medium text-white transition-transform hover:-translate-y-px disabled:opacity-60"
                >
                  {pending ? "Verifying…" : "Get free Pro"}
                </button>
              </div>

              {result && !result.ok ? (
                <motion.div
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-[12.5px] text-amber-700"
                >
                  {FAILURE_COPY[result.reason]}
                </motion.div>
              ) : null}
            </motion.form>
          )}
        </AnimatePresence>

        <FineGrain />
      </div>
    </section>
  );
}

function SuccessCard({ code }: { code: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      transition={{ duration: 0.42, ease: [0.16, 1, 0.3, 1] }}
      className="mx-auto mt-10 max-w-[480px] rounded-2xl border border-emerald-200 bg-emerald-50/30 p-7 text-center shadow-[0_24px_60px_-30px_rgba(16,185,129,0.32)]"
    >
      <div className="mx-auto inline-flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500 text-white">
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="20 6 9 17 4 12" />
        </svg>
      </div>
      <div className="mt-3 text-[10.5px] font-semibold uppercase tracking-[0.18em] text-emerald-700">
        Code minted
      </div>
      <h2 className="mt-1.5 text-[20px] font-semibold tracking-[-0.005em] text-ink">
        Your free Pro code is ready.
      </h2>
      <p className="mx-auto mt-3 max-w-[40ch] text-[13.5px] leading-[1.55] text-ink-soft">
        In production we&rsquo;d email this to you. For the demo,
        here it is — click through to redeem.
      </p>
      <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-line-soft bg-white px-3 py-1.5 font-mono text-[12.5px] tabular-nums text-ink">
        {code}
      </div>
      <div className="mt-5">
        <Link
          href={`/redeem/${code}`}
          className="inline-flex items-center gap-2 rounded-full bg-ink px-5 py-2.5 text-[13.5px] font-medium text-white transition-transform hover:-translate-y-px"
        >
          Redeem now
          <svg
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M5 12h14M13 5l7 7-7 7" />
          </svg>
        </Link>
      </div>
    </motion.div>
  );
}

function FineGrain() {
  return (
    <ul className="mx-auto mt-10 grid max-w-[560px] grid-cols-1 gap-3 text-left sm:grid-cols-3">
      {[
        {
          h: "1 year of Pro",
          b: "Unlimited workspaces, recurring tasks, integrations, stuck-work nudges. Same Pro everyone else pays for.",
        },
        {
          h: ".edu only",
          b: "We just check your email domain. No transcript, no ID upload, no awkward verification calls.",
        },
        {
          h: "Re-verify yearly",
          b: "When the year's up, prove you're still a student and we'll re-up. Graduate? Pro stays at $4.99 if you want it.",
        },
      ].map((item) => (
        <li
          key={item.h}
          className="rounded-xl border border-line-soft bg-bg-elevated/60 px-4 py-3"
        >
          <div className="text-[13.5px] font-medium text-ink">{item.h}</div>
          <p className="mt-1 text-[12px] leading-[1.5] text-ink-soft">
            {item.b}
          </p>
        </li>
      ))}
    </ul>
  );
}

function Eyebrow() {
  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-line-soft bg-white/60 py-1 pl-1 pr-3 text-[11.5px] font-medium text-ink-soft backdrop-blur">
      <span
        className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-wider text-white"
        style={{
          background:
            "linear-gradient(135deg, var(--brand) 0%, #7c5cff 100%)",
          boxShadow: "0 4px 10px rgba(79, 70, 229, 0.32)",
        }}
      >
        Students
      </span>
      Pro, free, .edu only
    </div>
  );
}
