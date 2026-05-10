import { SiteNav } from "@/components/marketing/site-nav";
import { SiteFooter } from "@/components/marketing/site-footer";
import { CONTACT_EMAIL } from "@/lib/product-urls";

export const metadata = {
  title: "Terms — Tasks",
  description:
    "The deal. What you can do with Tasks, what we owe you, and what either side can walk away from.",
};

const LAST_UPDATED = "2026-05-07";

/**
 * /terms — terms of service for Tasks. Plain-prose, hand-written.
 * Includes the AUP inline rather than as a separate document; one
 * page is easier to actually read. The legal hooks (limitation,
 * disclaimer, governing law) sit toward the end so they don&rsquo;t
 * crowd out the practical sections.
 */
export default function TermsPage() {
  return (
    <>
      <SiteNav />
      <main className="flex-1">
        <article className="mx-auto w-full max-w-[720px] px-6 py-20">
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand">
            Terms
          </div>
          <h1 className="mt-3 text-balance text-[clamp(2rem,1.4rem+2.4vw,3.4rem)] font-semibold leading-[1.04] tracking-[-0.035em] text-ink">
            The deal, in plain words.
          </h1>
          <p className="mt-3 text-[12.5px] tabular-nums text-ink-quiet">
            Last updated {LAST_UPDATED}
          </p>

          <div className="mt-10 space-y-8 text-[15.5px] leading-[1.65] text-ink-soft">
            <p>
              These are the terms you agree to by using Tasks. They
              cover who can sign up, what you owe us, what we owe you,
              and what happens when one of us walks. Read once; the
              rest is just being a decent user.
            </p>

            <Section title="Who can use it">
              <p>
                You need to be thirteen or older. If you&rsquo;re
                signing up on behalf of an organization, you confirm
                you have the authority to bind it. Using Tasks counts
                as agreeing to these terms and to the acceptable-use
                rules below — they&rsquo;re part of the same document.
              </p>
            </Section>

            <Section title="Your account">
              <p>
                One human per account. Don&rsquo;t share credentials,
                don&rsquo;t impersonate someone else, don&rsquo;t use
                a fake name to evade a ban. You&rsquo;re responsible
                for keeping your password (or OAuth provider) secure;
                if something happens because someone else got into your
                account, that&rsquo;s on you. Tell us at{" "}
                <Link href={`mailto:${CONTACT_EMAIL}`}>
                  {CONTACT_EMAIL}
                </Link>{" "}
                if you suspect a breach and we&rsquo;ll help shut it
                down.
              </p>
            </Section>

            <Section title="Subscriptions and billing">
              <p>
                Tasks is per-workspace, not per-seat. The free tier
                stays usable; the paid tier unlocks depth. Stripe
                processes the card; the subscription renews on the
                cadence you picked (monthly or yearly) until you
                cancel.
              </p>
              <p>
                Refunds within fourteen days of a charge are at our
                discretion and we&rsquo;re generous about it — email
                and ask. After fourteen days we don&rsquo;t prorate
                cancellations; you keep the paid tier through the end
                of the period you already paid for. Price changes get
                emailed at least thirty days before they apply.
              </p>
            </Section>

            <Section title="Acceptable use">
              <p>
                Don&rsquo;t use Tasks to do any of the following:
              </p>
              <ul className="mt-2 list-disc space-y-1.5 pl-5">
                <li>send spam, run a phishing campaign, or harass anyone;</li>
                <li>
                  store or distribute illegal content, including content
                  that infringes someone else&rsquo;s rights;
                </li>
                <li>
                  scrape the app, hammer the API, or otherwise behave
                  in a way that degrades the service for other people;
                </li>
                <li>
                  reverse-engineer the product or copy it for resale;
                </li>
                <li>
                  bypass or attempt to bypass authentication, billing,
                  or rate limits;
                </li>
                <li>
                  resell access without a written agreement with us.
                </li>
              </ul>
              <p>
                If you violate these we&rsquo;ll usually email first
                and ask you to stop. If the violation is severe or
                continues, we&rsquo;ll suspend the account.
              </p>
            </Section>

            <Section title="Your content">
              <p>
                The tasks, comments, attachments, and other material
                you put into Tasks are yours. You keep ownership. You
                grant us the limited rights we need to host the
                content, display it back to you and the people you
                share it with, and back it up. We don&rsquo;t republish
                your content elsewhere, train models on it, or use it
                in marketing without explicit permission.
              </p>
            </Section>

            <Section title="Our content">
              <p>
                The Tasks name and wordmark, the marketing site copy,
                the cinematic demo source, the templates we ship, and
                the underlying source code are ours. You can&rsquo;t
                copy them for a competing product. You can absolutely
                quote us, screenshot us, link us, write a review,
                file a bug, or build something on top of the public
                API once it exists.
              </p>
            </Section>

            <Section title="Termination">
              <p>
                You can cancel anytime from settings; the workspace
                stays accessible to the end of your paid period and
                then downgrades. We can suspend or terminate an account
                that violates these terms or that we believe puts other
                users or the service at risk; we&rsquo;ll explain why
                where we can.
              </p>
              <p>
                After termination — your choice or ours — you can
                export your data for sixty days. After that the
                workspace is deleted and the retention rules in the{" "}
                <Link href="/privacy">privacy notice</Link> apply.
              </p>
            </Section>

            <Section title="Disclaimer and liability">
              <p>
                Tasks is provided as-is. We work hard to keep it up,
                fast, and accurate, but we don&rsquo;t warrant that
                the service will be uninterrupted, error-free, or
                suitable for a particular purpose. To the maximum
                extent permitted by law, our total liability for any
                claim arising out of or related to Tasks is capped at
                the amount you paid us in the twelve months before the
                claim arose.
              </p>
            </Section>

            <Section title="Governing law">
              <p>
                These terms are governed by the laws of [NEEDS-REVIEW:
                pick state once entity formed], without regard to
                conflict-of-laws rules. Disputes go to the courts
                located there.
              </p>
            </Section>

            <Section title="Changes">
              <p>
                If we materially change these terms — new restriction,
                new pricing structure, new liability cap — we&rsquo;ll
                email signed-up users at least thirty days before they
                take effect. Continuing to use Tasks after that counts
                as agreeing to the update. The date at the top of this
                page changes when the document does.
              </p>
            </Section>

            <Section title="Contact">
              <p>
                Questions about these terms or anything in them:{" "}
                <Link href={`mailto:${CONTACT_EMAIL}`}>
                  {CONTACT_EMAIL}
                </Link>
                .
              </p>
            </Section>

            <p className="border-t border-line-soft pt-6 text-[14px] text-ink-quiet">
              The terms are short because the product is. If a future
              acquisition fattens this page, that&rsquo;s a sign to
              read it again.
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
