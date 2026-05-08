import Link from "next/link";
import { SiteNav } from "@/components/marketing/site-nav";
import { SiteFooter } from "@/components/marketing/site-footer";
import { AboutManifesto } from "@/components/marketing/about-manifesto";

const STUDIO_URL =
  process.env.NEXT_PUBLIC_STUDIO_URL ??
  "https://studio-sigma-pied-75.vercel.app";
const ROADMAP_URL = "https://roadmap-ebon-eight.vercel.app";

export const metadata = {
  title: "About — Tasks",
  description:
    "Project management shouldn't be behind a paywall or a knowledge gap. We cut the jargon and make planning accessible to everyone.",
  openGraph: {
    title: "Project management shouldn't be behind a paywall.",
    description:
      "We strip out sprints, epics, tickets — the whole jargon liturgy — and leave a tool anyone can open.",
    type: "article",
  },
  twitter: {
    card: "summary_large_image",
    title: "Project management shouldn't be behind a paywall.",
    description:
      "We strip out sprints, epics, tickets — and leave a tool anyone can open.",
  },
};

export default function AboutPage() {
  return (
    <>
      <SiteNav />
      <main className="flex-1">
        <AboutManifesto />

        {/* Studio attribution — Tasks is one of two products from Studio */}
        <section className="border-t border-line-soft/70 pb-24 pt-16">
          <div className="mx-auto w-full max-w-[820px] px-6">
            <div className="text-[10.5px] font-semibold uppercase tracking-[0.18em] text-ink-quiet">
              Part of something larger
            </div>
            <p className="mt-3 max-w-[60ch] text-[15.5px] leading-[1.6] text-ink-soft">
              Tasks is one of two products from{" "}
              <a
                href={`${STUDIO_URL}/about`}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-ink transition-colors hover:text-brand"
              >
                studio.
              </a>{" "}
              We also make{" "}
              <a
                href={ROADMAP_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-ink transition-colors hover:text-brand"
              >
                Roadmap
              </a>{" "}
              &mdash; a public-facing changelog for the people your engineers
              aren&rsquo;t talking to.
            </p>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
