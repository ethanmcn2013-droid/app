"use client";

import { useState, useTransition, type ReactNode } from "react";
import { motion } from "motion/react";
import { DOMAINS, DOMAIN_ORDER, type DomainId } from "@/lib/domains";
import { seedDomainAction } from "@/server/actions/seed";
import { useAddTask } from "@/components/app/add-task/add-task-context";

type Props = {
  /** The faded structural chrome of the view (board lanes, list rows,
   *  timeline grid, calendar cells) rendered behind the CTA. */
  ghost: ReactNode;
  headline: string;
  body: string;
  /** Optional override for the primary CTA verb. */
  primaryLabel?: string;
  /** Keep structural headers legible while the view body recedes behind the CTA. */
  ghostMode?: "subtle" | "structural";
  /** Personal filters must never offer the destructive project reset. */
  allowStarterPacks?: boolean;
};

export function EmptyStateOverlay({
  ghost,
  headline,
  body,
  primaryLabel = "Add your first task",
  ghostMode = "subtle",
  allowStarterPacks = true,
}: Props) {
  const { openDialog } = useAddTask();
  const [pending, startTransition] = useTransition();
  const [active, setActive] = useState<DomainId | null>(null);
  const [seedError, setSeedError] = useState(false);

  const handleSeed = (id: DomainId) => {
    setActive(id);
    setSeedError(false);
    startTransition(async () => {
      try {
        await seedDomainAction(id);
      } catch (e) {
        console.warn("seed-domain failed", e);
        setSeedError(true);
      }
      setActive(null);
    });
  };

  return (
    <div className="relative h-full">
      {/* Faded structural ghost, communicates the shape of the view */}
      <div
        aria-hidden="true"
        className={
          "pointer-events-none absolute inset-0 select-none " +
          (ghostMode === "structural" ? "opacity-100" : "opacity-[0.42]")
        }
      >
        {ghost}
      </div>

      {/* Soft fade-out so the lower part of the ghost dissolves and the CTA
          lifts above the chrome */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            ghostMode === "structural"
              ? "linear-gradient(to bottom, rgba(255,255,255,0) 0, rgba(255,255,255,0) 56px, rgba(255,255,255,0.86) 180px, rgba(255,255,255,0.95) 100%)"
              : "radial-gradient(ellipse at center, rgba(255,255,255,0.7) 0%, rgba(255,255,255,0.92) 45%, rgba(255,255,255,0.95) 100%)",
        }}
      />

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="relative z-10 flex h-full items-center justify-center px-6"
      >
        <div className="w-full max-w-[460px] rounded-2xl border border-line-soft bg-white/80 p-7 text-center shadow-[0_24px_60px_-24px_rgba(20,21,26,0.18)] backdrop-blur">
          <h2 className="text-balance text-[19px] font-semibold tracking-tight text-ink">
            {headline}
          </h2>
          <p className="mx-auto mt-2 max-w-[40ch] text-[13.5px] leading-[1.55] text-ink-soft">
            {body}
          </p>

          <button
            type="button"
            onClick={openDialog}
            className="mt-5 inline-flex items-center gap-2 rounded-full bg-ink px-4 py-2 text-[13px] font-medium text-white shadow-[0_8px_20px_-8px_rgba(20,21,26,0.4)] transition-transform hover:-translate-y-px"
          >
            {primaryLabel}
            <kbd className="rounded border border-white/20 bg-white/15 px-1.5 py-px text-[10px] font-medium tracking-wide">
              C
            </kbd>
          </button>

          {allowStarterPacks ? <div className="mt-5 border-t border-line-soft pt-4">
            <p className="text-[12.5px] leading-[1.6] text-ink-quiet">
              Or load a starter pack:{" "}
              {DOMAIN_ORDER.map((id, i) => {
                const pack = DOMAINS[id];
                const isPending = pending && active === id;
                return (
                  <span key={id}>
                    <button
                      type="button"
                      onClick={() => handleSeed(id)}
                      disabled={pending}
                      className={
                        "underline decoration-dotted decoration-line underline-offset-[3px] transition-colors hover:decoration-ink-soft disabled:opacity-60 " +
                        (isPending
                          ? "text-brand"
                          : "text-ink-soft hover:text-ink")
                      }
                    >
                      {pack.label}
                      {isPending ? "…" : ""}
                    </button>
                    {i < DOMAIN_ORDER.length - 1 ? " · " : ""}
                  </span>
                );
              })}
            </p>
            {seedError && active === null ? (
              <div role="alert" className="mt-3 flex flex-col items-center gap-2">
                <p className="text-[12px] text-ink-soft">
                  That didn&rsquo;t take, check your connection and try again.
                </p>
                <button
                  type="button"
                  onClick={() => setSeedError(false)}
                  className="text-[12px] font-medium text-ink underline-offset-2 hover:underline"
                >
                  Try again
                </button>
              </div>
            ) : null}
          </div> : null}
        </div>
      </motion.div>
    </div>
  );
}
