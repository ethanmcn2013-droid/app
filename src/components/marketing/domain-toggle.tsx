"use client";

import { motion, LayoutGroup } from "motion/react";
import { DOMAINS, DOMAIN_ORDER, type DomainId } from "@/lib/domains";

type Props = {
  domain: DomainId;
  onChange: (next: DomainId) => void;
  /** Optional CTA — when present, renders a "Try this in your workspace →"
   *  affordance that the parent can wire to the seed-domain action. */
  onTryInWorkspace?: () => void;
  pending?: boolean;
};

export function DomainToggle({
  domain,
  onChange,
  onTryInWorkspace,
  pending,
}: Props) {
  const active = DOMAINS[domain];
  return (
    <div className="flex flex-col items-start gap-3">
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-quiet">
          Built for
        </span>
        <span className="text-[12.5px] text-ink-soft">
          {active.description}
        </span>
      </div>

      <LayoutGroup id="domain-toggle">
        <div
          role="tablist"
          aria-label="Choose a domain"
          className="relative inline-flex flex-wrap items-center gap-0.5 rounded-full border border-line bg-white/80 p-1 shadow-[0_1px_2px_rgba(20,21,26,0.04)] backdrop-blur"
        >
          {DOMAIN_ORDER.map((id) => {
            const pack = DOMAINS[id];
            const isActive = id === domain;
            return (
              <button
                key={id}
                role="tab"
                aria-selected={isActive}
                onClick={() => onChange(id)}
                className={
                  "relative inline-flex items-center rounded-full px-3.5 py-1.5 text-[12.5px] font-medium transition-colors " +
                  (isActive
                    ? "text-white"
                    : "text-ink-soft hover:text-ink")
                }
              >
                {isActive ? (
                  <motion.span
                    layoutId="domain-toggle-pill"
                    className="absolute inset-0 rounded-full"
                    style={{
                      // One indigo, no second brand color. Gradient stays
                      // inside the indigo ramp (BRAND.md §5).
                      background:
                        "linear-gradient(135deg, var(--brand) 0%, var(--brand-deep) 100%)",
                      boxShadow:
                        "0 6px 16px -6px rgba(79,70,229,0.45), inset 0 1px 0 rgba(255,255,255,0.18)",
                    }}
                    transition={{
                      type: "spring",
                      stiffness: 360,
                      damping: 30,
                    }}
                  />
                ) : null}
                <span className="relative z-10">{pack.label}</span>
              </button>
            );
          })}
        </div>
      </LayoutGroup>

      {onTryInWorkspace ? (
        <div className="flex flex-col items-start gap-0.5">
          <button
            type="button"
            disabled={pending}
            onClick={onTryInWorkspace}
            className="group inline-flex items-center gap-1.5 text-[12.5px] font-medium text-ink-soft transition-colors hover:text-ink disabled:opacity-60"
          >
            {pending ? "Loading…" : "Try this template in your workspace"}
            <svg
              width="11"
              height="11"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="transition-transform group-hover:translate-x-0.5"
            >
              <path d="M5 12h14M13 5l7 7-7 7" />
            </svg>
          </button>
          <span className="text-[11px] text-ink-faint">Free to start. No card.</span>
        </div>
      ) : null}
    </div>
  );
}
