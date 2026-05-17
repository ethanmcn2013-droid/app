"use client";

import { useState, useTransition, useCallback } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "motion/react";

function CodeWithCopy({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);

  const copy = useCallback(() => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(code).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      });
    } else {
      // Graceful fallback for browsers without clipboard API
      try {
        const el = document.createElement("textarea");
        el.value = code;
        el.style.position = "fixed";
        el.style.opacity = "0";
        document.body.appendChild(el);
        el.select();
        document.execCommand("copy");
        document.body.removeChild(el);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch {
        // silent — copy simply doesn't confirm
      }
    }
  }, [code]);

  return (
    <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-line-soft bg-white pl-3 pr-2 py-1.5">
      <span className="font-mono text-[12.5px] tabular-nums text-ink">{code}</span>
      <button
        type="button"
        onClick={copy}
        aria-label={copied ? "Copied" : "Copy code"}
        className="inline-flex items-center gap-1 rounded-full bg-bg-sunken px-2.5 py-1 text-[11px] font-medium text-ink-soft transition-colors hover:bg-line-soft hover:text-ink"
      >
        {copied ? (
          <>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            Copied
          </>
        ) : (
          <>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
            </svg>
            Copy
          </>
        )}
      </button>
    </div>
  );
}
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
            "radial-gradient(closest-side, rgba(79, 70, 229, 0.16), rgba(79, 70, 229, 0.05), transparent 70%)",
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
                  "linear-gradient(110deg, rgba(79,70,229,0.28), rgba(79,70,229,0.16))",
              }}
            />
            students.
          </span>
        </h1>

        <p className="mx-auto mt-5 max-w-[52ch] text-[17px] leading-[1.55] text-ink-soft">
          The full Workspace tier, on us, while you study. Sign up
          with your .edu address and it lands automatically — no card,
          no trial, no catch. The form below is for the rare cases the
          auto-grant missed; otherwise just open the workspace and
          start.
        </p>

        <div className="mx-auto mt-6 inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50/40 px-4 py-1.5 text-[12.5px] font-medium text-emerald-800">
          <span
            className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500"
            aria-hidden
          />
          Auto-applied at signup · two-year window
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
                  {pending ? "Verifying…" : "Get free access"}
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
        Your free student code is ready.
      </h2>
      <p className="mx-auto mt-3 max-w-[40ch] text-[13.5px] leading-[1.55] text-ink-soft">
        Here&rsquo;s your code. Redeem it below — it&rsquo;s good for two years.
      </p>
      <CodeWithCopy code={code} />
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
          h: "Two years, free",
          b: "The full Workspace tier — unlimited workspaces, unlimited guests, recurring tasks, stuck-work nudges. The same tier everyone else pays for.",
        },
        {
          h: ".edu only",
          b: "We just check your email domain. No transcript, no ID upload, no awkward verification calls.",
        },
        {
          h: "Re-verify after two years",
          b: "When the window's up, prove you're still a student and we'll re-up. Graduated? The Workspace tier is €12 a month if you want to keep it.",
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
            "linear-gradient(135deg, var(--brand) 0%, #4338ca 100%)",
          boxShadow: "0 4px 10px rgba(79, 70, 229, 0.32)",
        }}
      >
        Students
      </span>
      Workspace tier, free, .edu only
    </div>
  );
}
