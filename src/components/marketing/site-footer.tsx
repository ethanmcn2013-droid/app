import Link from "next/link";
import { Wordmark } from "@/components/brand/wordmark";

export function SiteFooter() {
  return (
    <footer className="mt-32 border-t border-line-soft/70 pb-10 pt-16">
      <div className="mx-auto grid w-full max-w-[1240px] gap-10 px-6 md:grid-cols-[1.4fr_repeat(3,1fr)]">
        <div>
          <Wordmark size="lg" />
          <p className="mt-4 max-w-xs text-[13.5px] leading-relaxed text-ink-soft">
            A live task workspace built for momentum. Real-time, multi-view, AI
            aware.
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
            { href: "/changelog", label: "Changelog" },
            { href: "#", label: "About" },
            { href: "#", label: "Press" },
          ]}
        />
        <FooterCol
          heading="Resources"
          links={[
            { href: "#", label: "Docs" },
            { href: "#", label: "Brand" },
            { href: "#", label: "Status" },
            { href: "#", label: "Contact" },
          ]}
        />
      </div>
      <div className="mx-auto mt-12 flex w-full max-w-[1240px] flex-col items-start justify-between gap-2 border-t border-line-soft/70 px-6 pt-6 text-[12px] text-ink-quiet md:flex-row md:items-center">
        <span>© {new Date().getFullYear()} Tasks. Designed in motion.</span>
        <span>
          v0.1 · Built with Next.js 16 · React 19 · Motion
        </span>
      </div>
    </footer>
  );
}

function FooterCol({
  heading,
  links,
}: {
  heading: string;
  links: { href: string; label: string }[];
}) {
  return (
    <div>
      <div className="mb-3 text-[12px] font-medium uppercase tracking-[0.14em] text-ink-quiet">
        {heading}
      </div>
      <ul className="space-y-2 text-[13.5px] text-ink-soft">
        {links.map((l) => (
          <li key={l.label}>
            <Link
              href={l.href}
              className="transition-colors hover:text-ink"
            >
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
