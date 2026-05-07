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
};

export function EmptyStateOverlay({
  ghost,
  headline,
  body,
  primaryLabel = "Add your first task",
}: Props) {
  const { openDialog } = useAddTask();
  const [pending, startTransition] = useTransition();
  const [active, setActive] = useState<DomainId | null>(null);

  const handleSeed = (id: DomainId) => {
    setActive(id);
    startTransition(async () => {
      try {
        await seedDomainAction(id);
      } catch (e) {
        console.warn("seed-domain failed", e);
      }
      setActive(null);
    });
  };

  return (
    <div className="relative h-full">
      {/* Faded structural ghost — communicates the shape of the view */}
      <div className="pointer-events-none absolute inset-0 select-none opacity-[0.42]">
        {ghost}
      </div>

      {/* Soft fade-out so the lower part of the ghost dissolves and the CTA
          lifts above the chrome */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at center, rgba(255,255,255,0.7) 0%, rgba(255,255,255,0.92) 45%, rgba(255,255,255,0.95) 100%)",
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

          <div className="mt-6 border-t border-line-soft pt-5">
            <div className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-ink-quiet">
              Or try a starter pack
            </div>
            <div className="mt-2.5 flex flex-wrap items-center justify-center gap-1.5">
              {DOMAIN_ORDER.map((id) => {
                const pack = DOMAINS[id];
                const isPending = pending && active === id;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => handleSeed(id)}
                    disabled={pending}
                    className={
                      "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[12px] font-medium transition-colors " +
                      (isPending
                        ? "border-brand bg-brand-soft text-brand"
                        : "border-line bg-white text-ink-soft hover:border-ink-soft/30 hover:text-ink") +
                      " disabled:opacity-60"
                    }
                  >
                    {isPending ? (
                      <span
                        className="block h-1.5 w-1.5 animate-pulse rounded-full"
                        style={{ background: "var(--brand)" }}
                      />
                    ) : null}
                    {pack.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
