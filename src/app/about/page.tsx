import { SiteNavServer } from "@/components/marketing/site-nav-server";
import { SiteFooter } from "@/components/marketing/site-footer";
import { AboutManifesto } from "@/components/marketing/about-manifesto";
import { TIMELINE_URL, STUDIO_URL } from "@/lib/product-urls";

export const metadata = {
  title: "About — Signal Tasks",
  description:
    "Execution clarity for live work. Signal Tasks cuts the vocabulary tax and keeps the work readable.",
  openGraph: {
    title: "Execution clarity for live work.",
    description:
      "We strip out sprints, epics, tickets — the whole jargon liturgy — and leave a tool anyone can open.",
    type: "article",
  },
  twitter: {
    card: "summary_large_image",
    title: "Execution clarity for live work.",
    description:
      "We strip out sprints, epics, tickets — and leave a tool anyone can open.",
  },
};

export default function AboutPage() {
  return (
    <>
      <SiteNavServer />
      <main className="flex-1">
        <AboutManifesto />

        {/* Studio attribution — Tasks is one product in the Signal Studio suite. */}
        <section className="border-t border-line-soft/70 pb-24 pt-16">
          <div className="mx-auto w-full max-w-[820px] px-6">
            <div className="text-[10.5px] font-semibold uppercase tracking-[0.18em] text-ink-quiet">
              Part of something larger
            </div>
            <p className="mt-3 max-w-[60ch] text-[15.5px] leading-[1.6] text-ink-soft">
              Signal Tasks is one of four products from{" "}
              <a
                href={`${STUDIO_URL}/about`}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-ink transition-colors hover:text-brand"
              >
                Signal Studio.
              </a>{" "}
              We also make{" "}
              <a
                href={TIMELINE_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-ink transition-colors hover:text-brand"
              >
                Signal Timeline
              </a>{" "}
              &mdash; direction clarity for public plans, changes, and
              decisions people can read.
            </p>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
