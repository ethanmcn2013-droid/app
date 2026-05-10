import fs from "node:fs/promises";
import path from "node:path";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { SiteNav } from "@/components/marketing/site-nav";
import { SiteFooter } from "@/components/marketing/site-footer";
import { ROADMAP_URL } from "@/lib/product-urls";
import { SectionHeading } from "@/components/marketing/features";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Changelog — Tasks",
  description:
    "Built in public. Every cycle, every shipped phase, written in plain English.",
};

type Cycle = {
  num: string;
  date: string;
  title: string;
  body: string;
};

/** Parse the CHANGELOG into discrete cycles. The format is stable
 *  enough that a regex split on `## Cycle …` headers does the job —
 *  no need to drag in a real markdown parser at the splitting layer. */
function parseChangelog(raw: string): Cycle[] {
  const lines = raw.split("\n");
  const cycles: Cycle[] = [];
  let current: Cycle | null = null;

  for (const line of lines) {
    const m = line.match(/^## Cycle (\d+) · ([^·]+) · (.+)$/);
    if (m) {
      if (current) cycles.push(current);
      current = {
        num: m[1].trim(),
        date: m[2].trim(),
        title: m[3].trim(),
        body: "",
      };
      continue;
    }
    if (current) current.body += line + "\n";
  }
  if (current) cycles.push(current);
  return cycles;
}

export default async function ChangelogPage() {
  const file = await fs.readFile(
    path.join(process.cwd(), "CHANGELOG.md"),
    "utf-8",
  );
  const cycles = parseChangelog(file);

  return (
    <>
      <SiteNav />
      <main className="flex-1">
        <section className="pt-16 md:pt-24">
          <div className="mx-auto w-full max-w-[820px] px-6">
            <SectionHeading
              eyebrow="Changelog"
              title={
                <>
                  Built in public.{" "}
                  <span className="text-ink-soft/60">
                    Every cycle, every shipped phase.
                  </span>
                </>
              }
            />
            <p className="mt-5 max-w-[58ch] text-[15px] leading-[1.55] text-ink-soft">
              We ship in cycles, not sprints. Each one gets a written
              entry — what we built, what we cut, what surprised us.
              The voice is on purpose.
            </p>
            <p className="mt-3 max-w-[58ch] text-[13px] leading-[1.55] text-ink-quiet">
              This page is the source. It reads{" "}
              <code className="rounded bg-bg-sunken px-1 py-0.5 font-mono text-[12px] text-ink">
                CHANGELOG.md
              </code>{" "}
              from the repo at request time, parses it on the server,
              and renders. There&rsquo;s no CMS, no build step, no
              copy queue — when a cycle lands in git, it&rsquo;s
              live here on the next request.
            </p>
          </div>
        </section>

        <section className="mt-12 mb-24">
          <div className="mx-auto w-full max-w-[820px] space-y-12 px-6">
            {cycles.map((c) => (
              <article
                key={c.num}
                className="rounded-2xl border border-line-soft bg-bg-elevated/50 px-5 py-6 md:px-8 md:py-8"
              >
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <span className="rounded-full bg-brand-soft px-2 py-0.5 font-mono text-[10.5px] font-semibold tabular-nums text-brand">
                    cycle {c.num}
                  </span>
                  <span className="text-[11.5px] tabular-nums text-ink-quiet">
                    {c.date}
                  </span>
                </div>
                <h2 className="mt-2 text-balance text-[22px] font-semibold leading-snug tracking-[-0.02em] text-ink">
                  {c.title}
                </h2>
                <div className="mt-4 text-[14.5px] leading-[1.65] text-ink-soft">
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={{
                      // Suppress h2 since we render the cycle title
                      // ourselves above; nested h2 inside body would
                      // cause a hierarchy break anyway.
                      h2: () => null,
                      h3: ({ children }) => (
                        <h3 className="mt-5 text-[15px] font-semibold tracking-[-0.005em] text-ink">
                          {children}
                        </h3>
                      ),
                      strong: ({ children }) => (
                        <strong className="font-semibold text-ink">
                          {children}
                        </strong>
                      ),
                      em: ({ children }) => (
                        <em className="italic text-ink-soft">{children}</em>
                      ),
                      a: ({ href, children }) => (
                        <a
                          href={href}
                          className="text-brand transition-opacity hover:opacity-80"
                        >
                          {children}
                        </a>
                      ),
                      code: ({ children }) => (
                        <code className="rounded bg-bg-sunken px-1 py-0.5 font-mono text-[12.5px] text-ink">
                          {children}
                        </code>
                      ),
                      ul: ({ children }) => (
                        <ul className="mt-2 list-disc space-y-1 pl-5 text-[14px]">
                          {children}
                        </ul>
                      ),
                      ol: ({ children }) => (
                        <ol className="mt-2 list-decimal space-y-1 pl-5 text-[14px]">
                          {children}
                        </ol>
                      ),
                      p: ({ children }) => (
                        <p className="mt-3 first:mt-0">{children}</p>
                      ),
                      hr: () => (
                        <hr className="my-6 border-0 border-t border-line-soft" />
                      ),
                    }}
                  >
                    {c.body}
                  </ReactMarkdown>
                </div>
              </article>
            ))}
          </div>

          <div className="mt-16 border-t border-line-soft/70 pt-6 text-[12.5px] text-ink-quiet">
            The full cross-project roadmap lives at{" "}
            <a
              href={ROADMAP_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="text-ink underline decoration-ink-quiet/40 underline-offset-[3px] transition-colors hover:decoration-ink"
            >
              Signal Roadmap
            </a>
            .
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
