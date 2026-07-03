import { SiteNavServer } from "@/components/marketing/site-nav-server";
import { SiteFooter } from "@/components/marketing/site-footer";
import { CONTACT_EMAIL } from "@/lib/product-urls";

export const metadata = {
  title: "Security, Tasks",
  description:
    "How Tasks is built, who handles which sensitive bits, and how to report something we missed.",
};

const LAST_UPDATED = "2026-05-07";

/**
 * /security, security overview + responsible disclosure. Plain
 * statement of posture: what we do, what our providers do, and what
 * we deliberately don&rsquo;t do (no SSO upsell, no enterprise tier,
 * same posture for the free workspace as the paid one).
 */
export default function SecurityPage() {
  return (
    <>
      <SiteNavServer />
      <main className="flex-1">
        <article className="mx-auto w-full max-w-[720px] px-6 py-20">
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand">
            Security
          </div>
          <h1 className="mt-3 text-balance text-[clamp(2rem,1.4rem+2.4vw,3.4rem)] font-semibold leading-[1.04] tracking-[-0.035em] text-ink">
            How the thing is built.
          </h1>
          <p className="mt-3 text-[12.5px] tabular-nums text-ink-quiet">
            Last updated {LAST_UPDATED}
          </p>

          <div className="mt-10 space-y-8 text-[15.5px] leading-[1.65] text-ink-soft">
            <p>
              Tasks is a small product with a small surface. That works
              in your favor, fewer moving parts, fewer places for
              something to go wrong, fewer subprocessors to vet. Here
              is the honest map of what we run, what our providers
              run, and where we&rsquo;re still tightening.
            </p>

            <Section title="Transport">
              <p>
                Every request goes over HTTPS. We negotiate modern TLS
                (1.2+), HSTS is on, and we&rsquo;re in the process of
                submitting to the HSTS preload list, see the roadmap
                section below. There are no plaintext fallbacks
                anywhere in the app.
              </p>
            </Section>

            <Section title="Authentication">
              <p>
                Sign-in, session management, password resets, MFA, and
                OAuth (Google, GitHub) are all handled by{" "}
                <Link href="https://clerk.com/security">Clerk</Link>,
                which is SOC 2 Type II audited. We never see your
                password, Clerk does the hashing, the rotation, and
                the breach detection. Sessions are issued as signed
                tokens on first-party cookies; logout invalidates them
                server-side, not just in the browser.
              </p>
            </Section>

            <Section title="Payments">
              <p>
                Stripe handles cards.{" "}
                <Link href="https://stripe.com/docs/security/stripe">
                  PCI DSS Level 1
                </Link>
                . Cards never touch our servers; we hold a customer ID,
                a brand, a country, and the last four digits, enough
                to render a billing row. Webhook payloads from Stripe
                are signature-verified before we act on them.
              </p>
            </Section>

            <Section title="Hosting">
              <p>
                Tasks runs on{" "}
                <Link href="https://vercel.com/security">Vercel</Link>{" "}
               , edge network, function execution, build pipeline.
                Vercel publishes its own security posture; we
                inherit the perimeter, the DDoS protection, and the
                infrastructure-level audit work. Our application code
                is deployed via signed commits from a single GitHub
                repository.
              </p>
            </Section>

            <Section title="Data at rest, data in transit">
              <p>
                Everything in the database is encrypted at rest by the
                storage provider. Everything in transit is TLS as
                noted above. Attachments uploaded into Tasks live
                behind authenticated URLs, no public bucket, and
                expire from short-lived signed links a few minutes
                after issuance. Backups are encrypted with the same
                discipline as live data and rolled off on a 30-day
                window.
              </p>
            </Section>

            <Section title="Webhooks">
              <p>
                Inbound webhooks from Clerk are verified with{" "}
                <Link href="https://docs.svix.com/receiving/verifying-payloads/how">
                  Svix signatures
                </Link>
                ; inbound webhooks from Stripe are verified with the
                Stripe-Signature header. Unsigned payloads are
                rejected before they touch any handler logic.
              </p>
            </Section>

            <Section title="What we don&rsquo;t do">
              <p>
                There is no separate enterprise security tier. There is
                no SSO upsell, when SSO ships, every workspace gets
                it at the same price. We don&rsquo;t partition the
                free tier behind a weaker security posture than the
                paid tier; the same encryption, the same audit logs,
                the same disclosure process applies regardless of
                what&rsquo;s on the invoice.
              </p>
            </Section>

            <Section title="Reporting a vulnerability">
              <p>
                If you find something, email{" "}
                <Link href={`mailto:${CONTACT_EMAIL}`}>
                  {CONTACT_EMAIL}
                </Link>
                {" "}with Security in the subject. PGP key fingerprint: [NEEDS-REVIEW: publish PGP key
                fingerprint once generated]. We respond within
                seventy-two hours, usually faster. We don&rsquo;t run
                a paid bug bounty yet, but we credit researchers who
                report responsibly, by name, with a link, in the
                changelog and on this page if you want.
              </p>
              <p>
                Please don&rsquo;t exfiltrate other users&rsquo; data,
                spam the system, or post the issue publicly before we
                have a chance to fix it. Standard responsible-disclosure
                norms apply.
              </p>
            </Section>

            <Section title="Roadmap">
              <p>
                Posture is never finished. The near-term work, in
                priority order:
              </p>
              <ul className="mt-2 list-disc space-y-1.5 pl-5">
                <li>
                  <strong className="text-ink">P0</strong>, full
                  Content Security Policy headers across the app
                  (currently in audit).
                </li>
                <li>
                  <strong className="text-ink">P0</strong>, HSTS
                  preload submission once the apex domain stabilizes.
                </li>
                <li>
                  <strong className="text-ink">P1</strong>, automated
                  secrets scanning on every pull request and a
                  retroactive sweep of historical commits.
                </li>
              </ul>
            </Section>

            <p className="border-t border-line-soft pt-6 text-[14px] text-ink-quiet">
              Security is a process, not a label, the badge on the
              footer is whatever the last commit deserved.
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
