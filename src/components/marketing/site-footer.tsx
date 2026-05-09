import Link from "next/link";
import { Wordmark } from "@/components/brand/wordmark";

const STUDIO_URL =
  process.env.NEXT_PUBLIC_STUDIO_URL ?? "https://studio-sigma-pied-75.vercel.app";

const ROADMAP_URL =
  process.env.NEXT_PUBLIC_ROADMAP_URL ?? "https://roadmap-ebon-eight.vercel.app";

const ANALYTICS_URL =
  process.env.NEXT_PUBLIC_ANALYTICS_URL ?? "https://analytics-phi-ten.vercel.app";

export function SiteFooter() {
  return (
    <footer className="mt-32 border-t border-line-soft/70 pb-10 pt-16">
      <div className="mx-auto grid w-full max-w-[1240px] gap-10 px-6 md:grid-cols-[1.4fr_repeat(4,1fr)]">
        <div>
          <Wordmark size="lg" />
          <p className="mt-4 max-w-xs text-[13.5px] leading-relaxed text-ink-soft">
            A live task workspace. Four views, real-time when it matters,
            plain-English dates.
          </p>
          <p className="mt-4 text-[12px] text-ink-quiet">
            A{" "}
            <a
              href={STUDIO_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-ink-soft transition-colors hover:text-ink"
            >
              Signal Studio
            </a>{" "}
            product.
          </p>
        </div>
        <FooterCol
          heading="Product"
          links={[
            { href: "/#features", label: "Features" },
            { href: "/app/board", label: "Board" },
            { href: "/app/list", label: "List" },
            { href: "/app/timeline", label: "Timeline" },
            { href: "/app/calendar", label: "Calendar" },
          ]}
        />
        <FooterCol
          heading="Company"
          links={[
            { href: "/pricing", label: "Pricing" },
            { href: "/for/students", label: "Free for students" },
            { href: "/changelog", label: "Changelog" },
            { href: "/about", label: "About" },
            { href: "/principles", label: "Principles" },
          ]}
        />
        <FooterCol
          heading="Resources"
          links={[
            { href: "/templates", label: "Templates" },
            { href: "/for/weddings", label: "For weddings" },
            { href: "/for/freelancers", label: "For freelancers" },
            { href: "/for/students", label: "For students" },
            { href: "/for/trades", label: "For trades" },
            { href: "/status", label: "Status" },
            { href: "mailto:ethanmcn2013@gmail.com", label: "Contact" },
          ]}
        />
        <FooterCol
          heading="Suite"
          links={[
            { href: STUDIO_URL,    label: "Signal Studio",    external: true },
            { href: ROADMAP_URL,   label: "Signal Roadmap",   external: true },
            { href: ANALYTICS_URL, label: "Signal Analytics", external: true },
          ]}
        />
      </div>
      <div className="mx-auto mt-12 flex w-full max-w-[1240px] flex-col items-start justify-between gap-2 border-t border-line-soft/70 px-6 pt-6 text-[12px] text-ink-quiet md:flex-row md:items-center">
        <span>© {new Date().getFullYear()} Signal Tasks. Designed in motion.</span>
      </div>
    </footer>
  );
}

function FooterCol({
  heading,
  links,
}: {
  heading: string;
  links: { href: string; label: string; external?: boolean }[];
}) {
  return (
    <div>
      <div className="mb-3 text-[12px] font-medium uppercase tracking-[0.14em] text-ink-quiet">
        {heading}
      </div>
      <ul className="space-y-2 text-[13.5px] text-ink-soft">
        {links.map((l) => (
          <li key={l.label}>
            {l.external ? (
              <a
                href={l.href}
                target="_blank"
                rel="noopener noreferrer"
                className="transition-colors hover:text-ink"
              >
                {l.label}
              </a>
            ) : (
              <Link
                href={l.href}
                className="transition-colors hover:text-ink"
              >
                {l.label}
              </Link>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
