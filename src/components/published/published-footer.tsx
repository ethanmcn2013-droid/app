import type { DomainId } from "@/lib/domains";
import { PRODUCT_MARKETING_URLS, STUDIO_ORIGIN } from "@/lib/product-urls";

/**
 * The "Made with Tasks" footer, appended after every domain theme on
 * `/p/{slug}`.
 *
 * This is the most-seen public surface the company has: every guest,
 * supplier and family member a couple shares their plan with lands here.
 * It used to close an SEO loop by pointing at `/templates/[slug]`, but the
 * 2026-08-12 estate consolidation retired the public templates browse on
 * this host. Both links now leave for the umbrella and go straight to
 * their destination — a published keepsake should never spend a visitor's
 * click on a redirect.
 *
 * The waitlist carries the tracking vocabulary the studio capture records
 * (source, campaign, audience, artifact), so a signup arriving from a
 * wedding plan is attributable to the wedding plan.
 */

function waitlistHref(domain: DomainId | null): string {
  const params = new URLSearchParams({
    source: "published_workspace",
    campaign: "keepsake_footer",
    artifact: "published_footer",
  });
  if (domain) params.set("audience", domain);
  return `${STUDIO_ORIGIN}/waitlist?${params.toString()}`;
}

export function PublishedFooter({
  domain,
}: {
  domain: DomainId | null;
}) {
  return (
    <footer className="mt-20 border-t border-line-soft/70 bg-bg-elevated/40 px-6 py-10">
      <div className="mx-auto flex w-full max-w-[1080px] flex-col items-start justify-between gap-6 md:flex-row md:items-center">
        <div className="flex items-center gap-3">
          <div className="inline-flex items-center text-[15px] font-semibold tracking-[-0.025em] text-ink">
            tasks
            <span
              className="ml-1.5 inline-block h-2 w-2 rounded-full bg-brand"
              style={{ boxShadow: "0 0 8px rgba(79,70,229,0.6)" }}
              aria-hidden
            />
          </div>
          <span className="text-[12.5px] text-ink-quiet">
            Made with Tasks · this layout is free
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <a
            href={waitlistHref(domain)}
            className="inline-flex items-center gap-1.5 rounded-full border border-line-soft bg-white px-4 py-1.5 text-[12.5px] font-medium text-ink transition-colors hover:border-ink-soft/30"
          >
            Make one like this
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
          </a>
          <a
            href={PRODUCT_MARKETING_URLS.tasks}
            className="text-[12.5px] text-ink-soft transition-colors hover:text-ink"
          >
            What is Tasks?
          </a>
        </div>
      </div>
    </footer>
  );
}
