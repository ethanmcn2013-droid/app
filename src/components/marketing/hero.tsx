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
      {/* Soft gradient backdrop */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 left-1/2 -z-10 h-[640px] w-[1100px] -translate-x-1/2 rounded-full opacity-50 blur-3xl"
        style={{
          background:
            "radial-gradient(closest-side, rgba(124, 92, 255, 0.18), rgba(79, 70, 229, 0.08), transparent 70%)",
        }}
      />

      <div className="mx-auto w-full max-w-[1240px] px-5 md:px-6">
        <Eyebrow />
        <h1 className="mt-5 max-w-[18ch] text-balance text-[clamp(2.6rem,1.8rem+4.6vw,5.5rem)] font-semibold leading-[0.96] tracking-[-0.045em] text-ink">
          Work that moves itself{" "}
          <span className="relative inline-block whitespace-nowrap">
            <span
              aria-hidden
              className="absolute inset-x-1 -bottom-1 -z-10 h-[0.46em] rounded-md"
              style={{
                background:
                  "linear-gradient(110deg, rgba(124,92,255,0.32), rgba(79,70,229,0.18))",
              }}
            />
            forward
          </span>
          .
        </h1>
        <p className="mt-6 max-w-[54ch] text-[17px] leading-[1.55] text-ink-soft">
          Project management for the 80% who don&rsquo;t work in tech.
          Four views of the same list, real-time when it matters,
          plain-English dates — no sprints, no epics, no learning curve.
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
            See what's inside
          </a>
        </div>
        <p className="mt-3 inline-flex items-center gap-2 text-[12.5px] text-ink-faint">
          <span className="block h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
          Demo above is fully autonomous · interact at any time
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
    <a
      href="/changelog"
      className="group inline-flex items-center gap-2 rounded-full border border-line-soft bg-white/60 py-1 pl-1 pr-3 text-[11.5px] font-medium text-ink-soft backdrop-blur transition-colors hover:border-ink-soft/30 hover:text-ink"
    >
      <span
        className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-wider text-white"
        style={{
          background:
            "linear-gradient(135deg, var(--brand) 0%, #7c5cff 100%)",
          boxShadow: "0 4px 10px rgba(79, 70, 229, 0.32)",
        }}
      >
        New
      </span>{" "}
      Realtime sync &amp; magic links
      <svg
        width="11"
        height="11"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="ml-0.5 transition-transform group-hover:translate-x-0.5"
      >
        <path d="M5 12h14M13 5l7 7-7 7" />
      </svg>
    </a>
  );
}
