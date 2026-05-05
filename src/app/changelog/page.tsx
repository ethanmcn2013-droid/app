import { SiteNav } from "@/components/marketing/site-nav";
import { SiteFooter } from "@/components/marketing/site-footer";
import { SectionHeading } from "@/components/marketing/features";

const ENTRIES = [
  {
    version: "0.1.0",
    date: "May 5, 2026",
    headline: "Tasks · first cut",
    body: "The initial release. Board, list, timeline, and calendar views — all stitched to one shared layout. Real-time cursors and presence. AI nudges on idle work. Burndown sparkline corner-mounted to every plan.",
    tags: ["launch"],
  },
  {
    version: "0.0.6",
    date: "Apr 28, 2026",
    headline: "Inline comments without modals",
    body: "Threads now expand inside the card on click. No popovers, no losing context. Typing indicators arrive with the comment, not after.",
    tags: ["collab", "ux"],
  },
  {
    version: "0.0.5",
    date: "Apr 21, 2026",
    headline: "View morphs use shared layout",
    body: "Switching between board and list no longer reloads the canvas. Cards FLIP between positions over 700ms with the same easing curve we use for cursors.",
    tags: ["motion"],
  },
];

export default function ChangelogPage() {
  return (
    <>
      <SiteNav />
      <main className="flex-1">
        <section className="pt-16 md:pt-24">
          <div className="mx-auto w-full max-w-[860px] px-6">
            <SectionHeading
              eyebrow="Changelog"
              title={
                <>
                  Built in public.{" "}
                  <span className="text-ink-soft/60">
                    Shipped on rhythm.
                  </span>
                </>
              }
            />

            <ol className="mt-12 space-y-12">
              {ENTRIES.map((e) => (
                <li key={e.version} className="relative pl-8">
                  <span className="absolute left-0 top-1.5 inline-flex h-4 w-4 items-center justify-center rounded-full border-2 border-brand bg-bg-elevated" />
                  <span className="absolute left-[7px] top-7 h-[calc(100%-1rem)] w-px bg-line-soft" />
                  <div className="flex flex-wrap items-baseline gap-3">
                    <span className="rounded-full border border-line-soft bg-bg-elevated px-2.5 py-0.5 text-[11px] font-semibold tracking-wider text-ink-soft">
                      v{e.version}
                    </span>
                    <span className="text-[12px] text-ink-quiet">{e.date}</span>
                  </div>
                  <h3 className="mt-3 text-[20px] font-semibold tracking-tight text-ink">
                    {e.headline}
                  </h3>
                  <p className="mt-2 max-w-[60ch] text-[15px] leading-[1.6] text-ink-soft">
                    {e.body}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {e.tags.map((t) => (
                      <span
                        key={t}
                        className="rounded-md border border-line-soft bg-white px-2 py-0.5 text-[10.5px] font-medium uppercase tracking-wider text-ink-soft"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
