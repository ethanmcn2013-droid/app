import type { Metadata } from "next";
import { SiteNavServer } from "@/components/marketing/site-nav-server";
import { SiteFooter } from "@/components/marketing/site-footer";
import { TIMELINE_URL } from "@/lib/product-urls";

export const metadata: Metadata = {
  title: "Roadmap, Tasks",
  description:
    "What's coming, what's blocked, what we said no to, done right, for everyone. Roadmap is now its own product.",
  openGraph: {
    title: "Roadmap, Tasks",
    description:
      "What's coming, what's blocked, what we said no to, done right, for everyone. Roadmap is now its own product.",
    type: "article",
  },
};

export default function RoadmapPage() {
  return (
    <>
      <SiteNavServer />
      <main className="flex-1">
        <section className="flex min-h-[30vh] items-center">
          <div className="mx-auto w-full max-w-[820px] px-6 py-20">
            <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-brand">
              Roadmap
            </div>
            <h1 className="mt-4 text-balance text-[clamp(2.4rem,1.6rem+3.6vw,4.4rem)] font-semibold leading-[1] tracking-[-0.04em] text-ink">
              It&rsquo;s live.
            </h1>
            <p className="mt-5 max-w-[52ch] text-[16.5px] leading-[1.55] text-ink-soft">
              Roadmap is now its own product. What&rsquo;s coming, what&rsquo;s
              blocked, what we said no to&nbsp;&mdash; done right, for
              everyone, not just us.
            </p>
            <a
              href={TIMELINE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-8 inline-flex items-center gap-2 rounded-full bg-ink px-5 py-2.5 text-[14px] font-medium text-white shadow-[0_8px_24px_-8px_rgba(20,21,26,0.4)] transition-transform hover:-translate-y-px"
            >
              Open Roadmap
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14M13 5l7 7-7 7" />
              </svg>
            </a>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
