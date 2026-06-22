import Link from "next/link";
import { Wordmark } from "@/components/brand/wordmark";
import {
  SIGNAL_URL,
  NOTES_URL,
  TIMELINE_URL,
  STUDIO_URL,
} from "@/lib/product-urls";

const SOCIALS = [
  { label: "X", href: "https://x.com/signalstudio_ie", title: "Signal Tasks on X",
    svg: (<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" aria-hidden><path d="M18.244 2H21l-6.59 7.53L22 22h-6.828l-4.78-6.234L4.8 22H2l7.06-8.07L1.5 2h6.91l4.32 5.69L18.244 2Zm-2.39 18.4h1.594L7.21 3.512H5.5L15.853 20.4Z" /></svg>) },
  { label: "YouTube", href: "https://www.youtube.com/@signalstudio_ie", title: "Signal Tasks on YouTube",
    svg: (<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" aria-hidden><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" /></svg>) },
  { label: "TikTok", href: "https://www.tiktok.com/@signalstudio_ie", title: "Signal Tasks on TikTok",
    svg: (<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" aria-hidden><path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5.8 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1.84-.1z" /></svg>) },
  { label: "LinkedIn", href: "https://www.linkedin.com/company/signal-studio-ie", title: "Signal Tasks on LinkedIn",
    svg: (<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" aria-hidden><path d="M20.452 20.452h-3.554v-5.569c0-1.328-.024-3.037-1.852-3.037-1.853 0-2.136 1.447-2.136 2.94v5.666H9.356V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.602 0 4.268 2.37 4.268 5.455v6.286ZM5.337 7.433a2.062 2.062 0 1 1 0-4.124 2.062 2.062 0 0 1 0 4.124ZM7.117 20.452H3.555V9h3.562v11.452ZM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003Z" /></svg>) },
] as const;

export function SiteFooter() {
  return (
    <footer className="mt-32 border-t border-line-soft/70 pb-10 pt-16">
      <div className="mx-auto grid w-full max-w-[1240px] gap-10 px-6 md:grid-cols-[1.4fr_repeat(4,1fr)]">
        <div>
          <Wordmark size="lg" />
          <p className="mt-4 max-w-xs text-[13.5px] leading-relaxed text-ink-soft">
            Execution clarity for live work. Four views, real-time
            when it matters, plain-English dates.
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
            { href: "/#demo", label: "Demo" },
            { href: "/#anatomy", label: "Anatomy" },
            { href: "/app/board", label: "Board" },
            { href: "/app/list", label: "List" },
            { href: "/app/timeline", label: "Timeline" },
            { href: "/app/calendar", label: "Calendar" },
          ]}
        />
        <FooterCol
          heading="Company"
          links={[
            { href: "https://signalstudio.ie/pricing", label: "Pricing", external: true },
            { href: "/for/students", label: "For students" },
            { href: "https://signalstudio.ie/dispatch", label: "Dispatch", external: true },
            { href: "/about", label: "About" },
            { href: "/principles", label: "Principles" },
          ]}
        />
        <FooterCol
          heading="Resources"
          links={[
            { href: "/templates", label: "Templates" },
            { href: "https://signalstudio.ie/weddings", label: "For weddings", external: true },
            { href: "/for/freelancers", label: "For freelancers" },
            { href: "/for/small-business", label: "For small business" },
            { href: "/for/community", label: "For coordinators" },
            { href: "/for/students", label: "For students" },
            { href: "/for/trades", label: "For trades" },
            { href: "https://signalstudio.ie/contact", label: "Contact", external: true },
          ]}
        />
        <FooterCol
          heading="Suite"
          links={[
            { href: STUDIO_URL,    label: "Signal Studio",    external: true },
            { href: NOTES_URL,     label: "Notes",            external: true },
            { href: TIMELINE_URL,   label: "Timeline",          external: true },
            { href: SIGNAL_URL, label: "Signal", external: true },
          ]}
        />
      </div>
      <div className="mx-auto mt-12 flex w-full max-w-[1240px] flex-col items-start justify-between gap-2 border-t border-line-soft/70 px-6 pt-6 text-[12px] text-ink-quiet md:flex-row md:items-center">
        <span>© {new Date().getFullYear()} Signal Tasks. A Signal Studio product.</span>
        <span>Clarity, not configuration.</span>
      </div>
      <nav
        aria-label="Signal Tasks on social"
        className="mx-auto mt-4 flex w-full max-w-[1240px] items-center gap-x-1 px-6"
      >
        {SOCIALS.map(({ label, href, title, svg }) => (
          <a
            key={label}
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            title={title}
            aria-label={title}
            className="inline-flex min-h-[32px] items-center px-2 py-1 text-ink-quiet transition-colors hover:text-ink"
          >
            {svg}
          </a>
        ))}
      </nav>
      <div
        className="mx-auto mt-2 flex w-full max-w-[1240px] flex-wrap items-center gap-x-1 gap-y-1 px-6 font-mono text-[12px] uppercase tracking-[0.08em] text-ink-quiet"
        style={{ paddingBottom: "max(0.5rem, env(safe-area-inset-bottom))" }}
      >
        <a href="https://signalstudio.ie/privacy" target="_blank" rel="noopener noreferrer" className="inline-flex min-h-[32px] items-center px-2 py-1 transition-colors hover:text-ink">Privacy</a>
        <span aria-hidden className="opacity-50">·</span>
        <a href="https://signalstudio.ie/terms" target="_blank" rel="noopener noreferrer" className="inline-flex min-h-[32px] items-center px-2 py-1 transition-colors hover:text-ink">Terms</a>
        <span aria-hidden className="opacity-50">·</span>
        <a href="https://signalstudio.ie/security" target="_blank" rel="noopener noreferrer" className="inline-flex min-h-[32px] items-center px-2 py-1 transition-colors hover:text-ink">Security</a>
        <span aria-hidden className="opacity-50">·</span>
        <a href="https://signalstudio.ie/accessibility" target="_blank" rel="noopener noreferrer" className="inline-flex min-h-[32px] items-center px-2 py-1 transition-colors hover:text-ink">Accessibility</a>
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
