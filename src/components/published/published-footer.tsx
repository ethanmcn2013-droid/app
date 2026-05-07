import Link from "next/link";
import type { DomainId } from "@/lib/domains";

/**
 * The "Made with Tasks" footer, appended after every domain theme on
 * `/p/{slug}`. Closes the SEO ↔ virality loop the sprint set up:
 * every viewer of a published workspace lands on a CTA that points
 * back to the matching `/templates/[slug]`.
 *
 * The matching template is picked from a per-domain map. If the
 * workspace doesn't have a domain set, falls back to the gallery.
 */

const DOMAIN_TO_TEMPLATE: Record<DomainId, string> = {
  wedding: "wedding-3-month-countdown",
  marketing: "product-launch",
  freelance: "new-client-onboarding",
  student: "final-paper-sprint",
  // Trades couples cleanly to the new-client-onboarding template —
  // the pattern is identical (kickoff doc, contract, payment terms,
  // first invoice) just with different tooling between trades and
  // freelance dev. A purpose-built "trades-week" template can land
  // in a future cycle.
  trades: "new-client-onboarding",
};

export function PublishedFooter({
  domain,
}: {
  domain: DomainId | null;
}) {
  const templateSlug = domain ? DOMAIN_TO_TEMPLATE[domain] : null;
  const ctaHref = templateSlug
    ? `/templates/${templateSlug}`
    : "/templates";

  return (
    <footer className="mt-20 border-t border-line-soft/70 bg-bg-elevated/40 px-6 py-10">
      <div className="mx-auto flex w-full max-w-[1080px] flex-col items-start justify-between gap-6 md:flex-row md:items-center">
        <div className="flex items-center gap-3">
          <div className="inline-flex items-center text-[15px] font-semibold tracking-[-0.025em] text-ink">
            tasks
            <span
              className="ml-1.5 inline-block h-2 w-2 rounded-full bg-brand"
              style={{ boxShadow: "0 0 8px rgba(124,92,255,0.6)" }}
              aria-hidden
            />
          </div>
          <span className="text-[12.5px] text-ink-quiet">
            Made with Tasks · this layout is free
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Link
            href={ctaHref}
            className="inline-flex items-center gap-1.5 rounded-full border border-line-soft bg-white px-4 py-1.5 text-[12.5px] font-medium text-ink transition-colors hover:border-ink-soft/30"
          >
            Pick this template
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
          </Link>
          <Link
            href="/"
            className="text-[12.5px] text-ink-soft transition-colors hover:text-ink"
          >
            What is Tasks?
          </Link>
        </div>
      </div>
    </footer>
  );
}
