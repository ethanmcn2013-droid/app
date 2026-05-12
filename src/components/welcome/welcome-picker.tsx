"use client";

import { useState, useTransition } from "react";
import { motion } from "motion/react";
import { useRouter } from "next/navigation";
import { Wordmark } from "@/components/brand/wordmark";
import { DOMAINS, DOMAIN_ORDER, type DomainId } from "@/lib/domains";
import {
  markFirstRunCompleteAction,
  seedDomainAction,
} from "@/server/actions/seed";

type PendingTemplate = { id: string; name: string };

/**
 * The first-run welcome screen. A focused, full-page domain picker.
 * Renders once — until either a starter pack is chosen or the user
 * clicks "skip and start blank," after which the
 * `firstRunCompletedAt` meta row is set and /welcome redirects back
 * to /app/board for all future visits.
 *
 * T1.2 — if a template was applied to this workspace before first
 * run (via the Tasks templates flow), `pendingTemplate` is set and
 * the picker leads with "Open with X" instead of asking the user
 * to re-pick a domain on top of a template they already chose.
 */
export function WelcomePicker({
  pendingTemplate = null,
}: {
  pendingTemplate?: PendingTemplate | null;
}) {
  const router = useRouter();
  const [active, setActive] = useState<DomainId | null>(null);
  const [pending, startTransition] = useTransition();

  const choose = (id: DomainId) => {
    setActive(id);
    startTransition(async () => {
      try {
        await seedDomainAction(id);
      } catch (e) {
        console.warn("welcome: seed failed", e);
      }
      router.push("/app/board");
    });
  };

  const openWithTemplate = () => {
    startTransition(async () => {
      // Template tasks were already seeded by applyTemplateAction.
      // Just complete the first-run handshake and head into the board.
      try {
        await markFirstRunCompleteAction();
      } catch (e) {
        console.warn("welcome: mark-first-run failed", e);
      }
      router.push("/app/board");
    });
  };

  const skipBlank = () => {
    setActive(null);
    startTransition(async () => {
      try {
        await markFirstRunCompleteAction();
      } catch (e) {
        console.warn("welcome: mark-first-run failed", e);
      }
      router.push("/app/board");
    });
  };

  return (
    <div className="flex min-h-screen flex-col bg-bg">
      <div className="px-6 pt-6">
        <Wordmark size="md" />
      </div>

      <main className="flex flex-1 items-center justify-center px-6 pb-16 pt-8">
        <div className="w-full max-w-[760px]">
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.42, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand">
              Welcome
            </div>
            <h1 className="mt-2 text-balance text-[clamp(2.2rem,1.4rem+3vw,3.6rem)] font-semibold leading-[1.02] tracking-[-0.035em] text-ink">
              {pendingTemplate ? (
                <>
                  Your{" "}
                  <span className="text-ink-soft/65">
                    {pendingTemplate.name.toLowerCase()} is loaded.
                  </span>
                </>
              ) : (
                <>
                  Pick a starter so you have{" "}
                  <span className="text-ink-soft/65">
                    something to play with.
                  </span>
                </>
              )}
            </h1>
            <p className="mt-4 max-w-[58ch] text-[16px] leading-[1.55] text-ink-soft">
              {pendingTemplate
                ? "You picked a template before signing in. Open the workspace, or swap to a different starter below."
                : "You can change anything later — rename tasks, swap views, clear everything. This just makes the first 30 seconds feel like the tool already knows what you do."}
            </p>
          </motion.div>

          {pendingTemplate ? (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.42, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
              className="mt-8"
            >
              <button
                type="button"
                onClick={openWithTemplate}
                disabled={pending}
                className="group flex w-full items-center justify-between gap-4 rounded-xl border border-brand bg-brand-soft/30 p-5 text-left transition-all hover:bg-brand-soft/50 disabled:opacity-60"
              >
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-brand">
                    Loaded · ready to open
                  </div>
                  <div className="mt-1.5 text-[16px] font-semibold tracking-[-0.005em] text-ink">
                    Open the {pendingTemplate.name.toLowerCase()}
                  </div>
                </div>
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="flex-shrink-0 text-brand transition-transform group-hover:translate-x-0.5"
                >
                  <path d="M5 12h14M13 5l7 7-7 7" />
                </svg>
              </button>
            </motion.div>
          ) : null}

          {pendingTemplate ? (
            <p className="mt-10 text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-quiet">
              Or swap to a starter
            </p>
          ) : null}

          <motion.div
            initial="hidden"
            animate="show"
            variants={{
              hidden: {},
              show: {
                transition: { staggerChildren: 0.05, delayChildren: 0.15 },
              },
            }}
            className="mt-10 grid grid-cols-1 gap-3 sm:grid-cols-2"
          >
            {DOMAIN_ORDER.map((id) => {
              const pack = DOMAINS[id];
              const isPending = pending && active === id;
              const dimmed = pending && active !== id;
              return (
                <motion.button
                  key={id}
                  type="button"
                  onClick={() => choose(id)}
                  disabled={pending}
                  variants={{
                    hidden: { opacity: 0, y: 6 },
                    show: { opacity: 1, y: 0 },
                  }}
                  whileHover={{ y: -2 }}
                  className={
                    "group relative flex flex-col items-start gap-1 rounded-xl border p-5 text-left transition-all " +
                    (isPending
                      ? "border-brand bg-brand-soft/40"
                      : "border-line-soft bg-bg-elevated hover:border-ink-soft/30 hover:shadow-[0_18px_42px_-18px_rgba(20,21,26,0.18)]") +
                    (dimmed ? " opacity-40" : "")
                  }
                >
                  <div className="flex w-full items-center justify-between">
                    <span className="text-[15.5px] font-semibold tracking-[-0.005em] text-ink">
                      {pack.label}
                    </span>
                    {isPending ? (
                      <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-brand">
                        <span className="block h-1.5 w-1.5 animate-pulse rounded-full bg-brand" />
                        Loading
                      </span>
                    ) : (
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="text-ink-quiet transition-transform group-hover:translate-x-0.5"
                      >
                        <path d="M5 12h14M13 5l7 7-7 7" />
                      </svg>
                    )}
                  </div>
                  <div className="text-[13px] text-ink-soft">
                    {pack.description}
                  </div>
                  <div className="mt-2 text-[11.5px] text-ink-quiet">
                    Sample task: <span className="text-ink-soft">{pack.firstTaskExample}</span>
                  </div>
                </motion.button>
              );
            })}
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5, duration: 0.4 }}
            className="mt-7 flex flex-wrap items-center justify-center gap-x-4 gap-y-2"
          >
            <button
              type="button"
              onClick={skipBlank}
              disabled={pending}
              className="text-[13px] text-ink-quiet underline-offset-4 transition-colors hover:text-ink-soft hover:underline disabled:opacity-60"
            >
              Or skip and start blank
            </button>
            <span className="text-ink-faint" aria-hidden>
              ·
            </span>
            <a
              href="/templates"
              className="inline-flex items-center gap-1 text-[13px] text-ink-quiet underline-offset-4 transition-colors hover:text-ink-soft hover:underline"
            >
              Or pick a template
              <svg
                width="11"
                height="11"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M5 12h14M13 5l7 7-7 7" />
              </svg>
            </a>
          </motion.div>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.65, duration: 0.4 }}
            className="mt-12 text-center text-[11.5px] leading-[1.5] text-ink-faint"
          >
            No account required to try. We&rsquo;ll never email you
            unless you ask.
          </motion.p>
        </div>
      </main>
    </div>
  );
}
