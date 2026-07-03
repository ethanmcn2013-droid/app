"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { CinematicDemo } from "@/components/showcase/cinematic-demo";
import { DomainToggle } from "@/components/marketing/domain-toggle";
import { DOMAINS, type DomainId } from "@/lib/domains";

export function Hero() {
  // Default audience: wedding. Matches the GTM wedge (Founding Venue Programme)
  // and is the highest-empathy opener for first-time visitors. Was "marketing"
  // pre-2026-05-13, flagged by the post-rollout UX review.
  const [domain, setDomain] = useState<DomainId>("wedding");
  const pack = DOMAINS[domain];

  return (
    <section className="relative isolate overflow-hidden pt-2 md:pt-6">
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

        <p className="mt-7 inline-flex items-center gap-2 text-[12.5px] text-ink-faint">
          <span className="block h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
          Demo is live
        </p>

        {/* Domain toggle, proves the tool fits whatever you do.
            id="demo" anchors deep-links from the suite landing page. */}
        <div id="demo" className="mt-8 scroll-mt-20 md:mt-10">
          <DomainToggle domain={domain} onChange={setDomain} />
        </div>

        {/* Demo, keyed by domain so swap = clean state reset.
         *  Desktop renders at natural fluid width (perspective +
         *  shadow intact). Below md, `.demo-fit` scales the whole
         *  proven canvas down to fit the phone instead of clipping it
         *  to a headless sliver, the 80% are phone-first and this is
         *  the most-seen product surface. Scale rules: globals.css. */}
        <div className="mt-6 md:mt-8">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={domain}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.36, ease: [0.16, 1, 0.3, 1] }}
              className="demo-fit mx-auto"
            >
              <div className="demo-fit-inner">
                <CinematicDemo domain={pack.id} />
              </div>
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
      Tasks &middot; Execution clarity
    </p>
  );
}
