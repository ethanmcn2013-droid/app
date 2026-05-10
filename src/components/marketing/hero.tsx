"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import { CinematicDemo } from "@/components/showcase/cinematic-demo";
import { DomainToggle } from "@/components/marketing/domain-toggle";
import { DOMAINS, type DomainId } from "@/lib/domains";
import { seedDomainAction } from "@/server/actions/seed";

export function Hero() {
  const [domain, setDomain] = useState<DomainId>("marketing");
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const pack = DOMAINS[domain];

  const handleTry = () => {
    startTransition(async () => {
      try {
        await seedDomainAction(domain);
      } catch (e) {
        console.warn("seed-domain failed", e);
      }
      router.push("/app/board");
    });
  };

  return (
    <section className="relative isolate overflow-hidden pt-12 md:pt-20">
      <div className="mx-auto w-full max-w-[1240px] px-5 md:px-6">
        <Eyebrow />
        <h1 className="mt-5 max-w-[14ch] text-balance text-[clamp(2.6rem,1.8rem+4.6vw,5.5rem)] font-semibold leading-[0.96] tracking-[-0.045em] text-ink">
          Execution clarity for live work.
        </h1>
        <p className="mt-6 max-w-[54ch] text-[17px] leading-[1.55] text-ink-soft">
          Four views of the same list, real-time when it matters,
          plain-English dates, and no vocabulary tax. The work stays
          readable while it moves.
        </p>

        <div className="mt-8 flex flex-wrap items-center gap-3">
          <a
            href="/app/board"
            className="group inline-flex items-center gap-2 rounded-full bg-ink px-5 py-2.5 text-[14px] font-medium text-white shadow-[0_8px_24px_-8px_rgba(20,21,26,0.4)] transition-transform hover:-translate-y-px"
          >
            Open the workspace
            <svg
              width="14"
              height="14"
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
          </a>
          <a
            href="#features"
            className="inline-flex items-center gap-1.5 rounded-full border border-line bg-white px-5 py-2.5 text-[14px] font-medium text-ink-soft transition-colors hover:border-ink-soft/30 hover:text-ink"
          >
            See what&rsquo;s inside
          </a>
        </div>
        <p className="mt-3 inline-flex items-center gap-2 text-[12.5px] text-ink-faint">
          <span className="block h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
          Demo is live · interact at any time
        </p>

        {/* Domain toggle — proves the tool fits whatever you do */}
        <div className="mt-12 md:mt-14">
          <DomainToggle
            domain={domain}
            onChange={setDomain}
            onTryInWorkspace={handleTry}
            pending={pending}
          />
        </div>

        {/* Demo — keyed by domain so swap = clean state reset.
         *  Under md: clamp width to 90vw + lock aspect-video so the
         *  500px-tall surface inside doesn't overflow on phones. */}
        <div className="mt-6 md:mt-8">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={domain}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.36, ease: [0.16, 1, 0.3, 1] }}
              className="mx-auto aspect-video w-[90vw] overflow-hidden md:aspect-auto md:w-auto"
            >
              <CinematicDemo domain={pack.id} />
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </section>
  );
}

function Eyebrow() {
  return (
    <p
      className="font-mono text-[11px] font-semibold uppercase text-ink-quiet"
      style={{ letterSpacing: "0.14em" }}
    >
      Signal Tasks &middot; Execution clarity
    </p>
  );
}
