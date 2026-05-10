import { SiteNav } from "@/components/marketing/site-nav";
import { SiteFooter } from "@/components/marketing/site-footer";
import { taskUrl } from "@/lib/product-urls";

export const metadata = {
  title: "Press — Tasks",
  description:
    "Boilerplates, founder bio, brand assets, and a press contact who answers within a day.",
};

const LAST_UPDATED = "2026-05-07";

/**
 * /press — media kit. Boilerplates at three lengths so a writer
 * can paste whichever fits the column. OG and screenshot links
 * point at the existing Next.js image routes — no separate asset
 * pipeline. Founder bio is short on purpose; the long version
 * lives at /about.
 */
export default function PressPage() {
  return (
    <>
      <SiteNav />
      <main className="flex-1">
        <article className="mx-auto w-full max-w-[720px] px-6 py-20">
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand">
            Press
          </div>
          <h1 className="mt-3 text-balance text-[clamp(2rem,1.4rem+2.4vw,3.4rem)] font-semibold leading-[1.04] tracking-[-0.035em] text-ink">
            For writers and producers.
          </h1>
          <p className="mt-3 text-[12.5px] tabular-nums text-ink-quiet">
            Last updated {LAST_UPDATED}
          </p>

          <div className="mt-10 space-y-10 text-[15.5px] leading-[1.65] text-ink-soft">
            <p>
              Tasks is a project management tool for people who never
              wanted one. Below are the boilerplates, brand assets, and
              founder bio you might need. If something&rsquo;s missing,
              email and we&rsquo;ll send it back the same day.
            </p>

            <Section title="One-line description">
              <Quote>
                Tasks is a live workspace for to-dos — board, list,
                timeline, calendar — built for everyone the rest of the
                category ignored.
              </Quote>
            </Section>

            <Section title="Boilerplate — 50 words">
              <Quote>
                Tasks is a live, multi-view workspace for to-dos —
                board, list, timeline, and calendar over the same
                items. It&rsquo;s built for the people the rest of
                project management ignored: students, freelancers,
                wedding planners, trades. No sprints, no story points,
                no per-seat bill. Free where it counts.
              </Quote>
            </Section>

            <Section title="Boilerplate — 150 words">
              <Quote>
                Tasks is a live workspace that treats project
                management like a to-do list, not a discipline. The
                same items appear as a kanban board, a list, a
                timeline, and a calendar — switch lenses without
                re-entering anything. Real-time presence and shareable
                read-only links work on the free tier; paid pricing is
                per-workspace, never per-seat. Built by a designer
                tired of vocabulary taxes — sprints, epics, OKRs — and
                of category leaders charging $20 a head to invite a
                collaborator. Tasks was extracted from a larger
                product, polished, and shipped on its own. The name
                says everything the brand intends to be: a list of
                things you have to do, written somewhere durable, in
                front of the people who need to see it. The roadmap is
                public, the principles page lists features that will
                never ship.
              </Quote>
            </Section>

            <Section title="Boilerplate — 400 words">
              <Quote>
                Tasks is a live, multi-view workspace for to-dos. It
                renders the same set of items as a kanban board, a
                list, a timeline, or a calendar — depending on how you
                think about your work that day — and it does so in
                real time, with presence cursors and shareable
                read-only views built into the free tier. The
                product&rsquo;s argument is that the project-management
                category has spent twenty years making its tools
                inaccessible to anyone outside engineering. Sprints,
                epics, story points, burndown charts, OKR alignment —
                an entire vocabulary that costs hours to learn before
                you can write your first task. Tasks strips it out.
                The starter packs target weddings, freelance
                operations, college coursework, and trade scheduling,
                because those are the audiences a kanban board was
                always going to help and the category never bothered
                to court.
                {"\n\n"}
                Pricing is per-workspace, never per-seat — the
                opposite of the model that turned every collaborator
                invite into a budget conversation. The free tier
                includes the multi-view workspace, real-time
                collaboration, share links, and unlimited templates.
                The paid tier unlocks depth — automations, advanced
                permissioning, integrations, longer history — for a
                flat workspace fee.
                {"\n\n"}
                Tasks was extracted from a larger productivity
                platform in early 2026, rebuilt as a standalone
                product, and shipped publicly on Vercel running
                Next.js 16. The roadmap, the changelog, and a
                principles page that lists features the team has
                committed never to build are all publicly available.
                The single founder is Ethan McNamara, a designer who
                spent years inside enterprise software watching the
                wrong people get charged for the wrong things. Tasks
                is the corrective.
              </Quote>
            </Section>

            <Section title="Founder bio — 50 words">
              <Quote>
                Ethan McNamara is the designer and solo founder behind
                Tasks. He built it after watching Notion become a wiki,
                Asana become enterprise software, and the rest of the
                category turn into a vocabulary tax. Previously
                designed inside large product orgs; now ships in
                cycles, in public, against his own roadmap.
              </Quote>
            </Section>

            <Section title="Brand assets">
              <p>
                Logos, OG cards, and screenshots — direct links, no
                asset request form.
              </p>
              <ul className="mt-2 list-disc space-y-1.5 pl-5">
                <li>
                  <Link href={taskUrl("/opengraph-image")}>
                    Primary OG card (1200×630, PNG)
                  </Link>
                </li>
                <li>
                  <Link href={taskUrl("/social/x-pinned/opengraph-image")}>
                    X/Twitter pinned card
                  </Link>
                </li>
                <li>
                  <Link href={taskUrl("/social/bluesky-pinned/opengraph-image")}>
                    Bluesky pinned card
                  </Link>
                </li>
                <li>
                  <Link href={taskUrl("/app/board")}>
                    Live demo (open in your browser, screenshot freely)
                  </Link>
                </li>
              </ul>
              <p>
                Wordmark SVG and full brand kit (PNG + SVG, light and
                dark) on request — email below.
              </p>
            </Section>

            <Section title="Press contact">
              <p>
                <Link href="mailto:ethanmcn2013@gmail.com">
                  ethanmcn2013@gmail.com
                </Link>
                . Replies within twenty-four hours, including weekends
                if the deadline is real. No publicist between us.
              </p>
            </Section>

            <Section title="Recent coverage">
              <p className="text-ink-soft">
                None yet — Show HN goes up June 16, Product Hunt June
                23. We&rsquo;ll list links here as they land.
              </p>
            </Section>

            <p className="border-t border-line-soft pt-6 text-[14px] text-ink-quiet">
              No publicist, no PR firm, no embargo dance — the email
              above goes straight to the person who built the thing.
            </p>
          </div>
        </article>
      </main>
      <SiteFooter />
    </>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <h2 className="text-[20px] font-semibold tracking-[-0.015em] text-ink">
        {title}
      </h2>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function Quote({ children }: { children: React.ReactNode }) {
  return (
    <blockquote className="rounded-xl border border-line-soft bg-bg-elevated px-5 py-4 text-[15px] leading-[1.6] text-ink">
      {children}
    </blockquote>
  );
}

function Link({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  const isExternal = href.startsWith("http");
  return (
    <a
      href={href}
      className="text-ink underline decoration-1 underline-offset-2 transition-opacity hover:opacity-70"
      {...(isExternal
        ? { target: "_blank", rel: "noreferrer noopener" }
        : {})}
    >
      {children}
    </a>
  );
}
