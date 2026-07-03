import { SiteNavServer } from "@/components/marketing/site-nav-server";
import { SiteFooter } from "@/components/marketing/site-footer";
import { CONTACT_EMAIL } from "@/lib/product-urls";

export const metadata = {
  title: "Privacy, Tasks",
  description:
    "What we collect, why, who else sees it, and how to get it back. Hand-written, not Termly mush.",
};

const LAST_UPDATED = "2026-05-07";

/**
 * /privacy, hand-written privacy notice. Long-form prose intentionally,
 * not a bullet-graveyard. Sister pages: /terms, /security. The voice
 * matches /about, dry, em-dashes welcome, no "your privacy is
 * paramount" boilerplate. The page is server-rendered; no client JS.
 */
export default function PrivacyPage() {
  return (
    <>
      <SiteNavServer />
      <main className="flex-1">
        <article className="mx-auto w-full max-w-[720px] px-6 py-20">
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand">
            Privacy
          </div>
          <h1 className="mt-3 text-balance text-[clamp(2rem,1.4rem+2.4vw,3.4rem)] font-semibold leading-[1.04] tracking-[-0.035em] text-ink">
            What we collect, and why.
          </h1>
          <p className="mt-3 text-[12.5px] tabular-nums text-ink-quiet">
            Last updated {LAST_UPDATED}
          </p>

          <div className="mt-10 space-y-8 text-[15.5px] leading-[1.65] text-ink-soft">
            <p>
              The short version: an email address so we can let you back
              in, payment info Stripe handles on our behalf, and the
              tasks you write so the app has something to render. We
              don&rsquo;t sell any of it. We don&rsquo;t use it to train
              a model. We don&rsquo;t profile you to sell ads against
              your due dates. The long version follows.
            </p>

            <Section title="What we collect">
              <p>
                <strong className="text-ink">Account.</strong> When you
                sign up, Clerk handles the form and hands us back your
                email and (if you provided one) name. That&rsquo;s the
                identity we attach your workspace to. If you signed in
                with Google or another OAuth provider, we get the same
                fields plus a stable provider ID, no contact list,
                no friend graph, no inbox access.
              </p>
              <p>
                <strong className="text-ink">Payment.</strong> If you
                upgrade, Stripe collects your card. We never see the
                number. We get back a customer ID, the last four digits,
                the brand, and the country, enough to show you the
                right billing row in settings and run a refund.
              </p>
              <p>
                <strong className="text-ink">Usage.</strong> PostHog
                records anonymous product analytics, which view you
                opened, whether the keyboard shortcut fired, how long
                a session lasted. We pair it with Sentry, which catches
                errors and stack traces so we know when something
                broke before you have to email us about it.
              </p>
              <p>
                <strong className="text-ink">The work itself.</strong>{" "}
                Tasks, comments, attachments, board layouts, calendar
                placements, the lot. We store it because the product
                doesn&rsquo;t function otherwise.
              </p>
            </Section>

            <Section title="Who else sees it">
              <p>
                We use a small list of subprocessors. Each one has its
                own privacy notice, linked below.
              </p>
              <ul className="mt-2 list-disc space-y-1.5 pl-5">
                <li>
                  <Link href="https://clerk.com/privacy">Clerk</Link>{" "}
                 , authentication, session management.
                </li>
                <li>
                  <Link href="https://stripe.com/privacy">Stripe</Link>{" "}
                 , payments, invoices, refunds.
                </li>
                <li>
                  <Link href="https://posthog.com/privacy">PostHog</Link>{" "}
                 , product analytics, feature flags.
                </li>
                <li>
                  <Link href="https://sentry.io/privacy/">Sentry</Link>{" "}
                 , error monitoring.
                </li>
                <li>
                  <Link href="https://resend.com/legal/privacy-policy">
                    Resend
                  </Link>{" "}
                 , transactional email (digests, password resets,
                  receipts).
                </li>
                <li>
                  <Link href="https://vercel.com/legal/privacy-policy">
                    Vercel
                  </Link>{" "}
                 , hosting, edge network, function execution.
                </li>
              </ul>
              <p>
                That&rsquo;s the entire list. If we add one we&rsquo;ll
                add it here, with the date.
              </p>
            </Section>

            <Section title="How long we keep it">
              <p>
                Live data, your tasks, your account, your billing —
                stays until you delete the workspace. Encrypted backups
                roll off on a 30-day window after that, after which
                there&rsquo;s nothing left to restore even if we wanted
                to. Server logs are kept for 30 days for debugging and
                security review.
              </p>
            </Section>

            <Section title="Your rights">
              <p>
                You can export every task you&rsquo;ve created (JSON or
                CSV) from settings. You can correct the email or name
                attached to your account from settings. You can delete
                the whole workspace from settings, and we mean delete —
                see the retention paragraph above. If any of that
                doesn&rsquo;t work or you want a human to do it for
                you, email <Link href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</Link>{" "}
                and we&rsquo;ll handle it within five business days.
              </p>
              <p>
                If you&rsquo;re in the EU, the UK, California, or any
                other jurisdiction whose data law gives you specific
                rights (access, portability, restriction, objection),
                those rights apply here. Same email gets you to the
                same person.
              </p>
            </Section>

            <Section title="Cookies">
              <p>
                We set a session cookie via Clerk so signed-in users
                stay signed in, a small CSRF token, and a theme
                preference. PostHog runs in cookieless mode where the
                browser supports it and falls back to a single
                first-party cookie elsewhere, never a third-party
                tracker. No advertising cookies. No social-share
                pixels.
              </p>
            </Section>

            <Section title="Children">
              <p>
                Tasks is for people thirteen and older. If you&rsquo;re
                under thirteen, please don&rsquo;t sign up. If you find
                an account that belongs to someone under thirteen,
                email us and we&rsquo;ll close it.
              </p>
            </Section>

            <Section title="Changes">
              <p>
                If we materially change this notice, new
                subprocessor, new data category, new retention rule —
                we&rsquo;ll email signed-up users before it takes
                effect and update the date at the top. Cosmetic edits
                (typos, link rot, rewording for clarity) we just make.
              </p>
            </Section>

            <Section title="Contact">
              <p>
                Privacy questions, deletion requests, data exports,
                anything in this notice you want explained:{" "}
                <Link href={`mailto:${CONTACT_EMAIL}`}>
                  {CONTACT_EMAIL}
                </Link>
                . Mailing address: [NEEDS-REVIEW: add postal address
                once entity is formed].
              </p>
            </Section>

            <p className="border-t border-line-soft pt-6 text-[14px] text-ink-quiet">
              A privacy policy you can read in one sitting beats a
              generated one nobody opens. This one is short on purpose.
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
