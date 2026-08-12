/**
 * AuthStage, the Signal Studio sign-in surface.
 *
 * Design direction E ("Spine v2"), chosen from the /lab/login review on
 * 2026-07-28 and promoted here. The lab keeps the full set of directions as
 * the design record; this is the shipped one.
 *
 * The composition, and why each piece is there:
 *
 *   The spine. One hairline crossing the viewport, carrying the four
 *   products as stations. The indigo dot travels it once on arrival and
 *   settles on signal, where the day starts. It is the page's only
 *   decoration and it is load-bearing: it names the suite spatially so the
 *   card never has to list it in words.
 *
 *   The card. Whatever the caller slots in. On /sign-in and /sign-up that
 *   is Clerk's own component, so every real state (error, loading, OAuth
 *   handoff, MFA, rate limit) is Clerk's rather than a reimplementation.
 *
 *   The QR. Bottom right, on the stage grid, directly beneath the signal
 *   station. It points at the umbrella site. It pointed at the iOS page
 *   until the 2026-08-12 estate consolidation retired that page; scan and
 *   click now land in the same place, and the matrix is regenerated to
 *   match rather than left encoding a redirect.
 *
 * Everything is a semantic token, so light and dark are the same markup.
 * Server component: no state, no effects, no client bundle.
 */

import Link from "next/link";
import { SignalQr } from "@/components/brand/signal-qr";
import { STUDIO_URL } from "@/lib/product-urls";
import { createAccountCta, isPreLaunch } from "@/lib/launch";
import styles from "./auth-stage.module.css";

const STATIONS: readonly {
  name: string;
  left: string;
  /** Where the dot ends its travel; the label holds its own weight. */
  resting?: boolean;
}[] = [
  { name: "notes", left: "var(--x-notes-x)" },
  { name: "tasks", left: "calc(50% - 356px)" },
  { name: "timeline", left: "calc(50% + 356px)" },
  { name: "signal", left: "var(--x-signal-x)", resting: true },
];

/**
 * Absolute umbrella URLs, written out rather than composed from an origin
 * constant. This host stopped serving the legal pages in the 2026-08-12
 * estate consolidation, and a consent link is the one link that must never
 * travel through a redirect or resolve against an environment variable: the
 * person clicking it is agreeing to what it shows them. They open in a new
 * tab so reading the terms does not discard a half-filled sign-in form.
 *
 * Status left with the same cut. It had no home to redirect to, and pointing
 * a status link at a marketing homepage tells somebody who is mid sign-in
 * failure the opposite of what they came to find out.
 */
const FOOTER_LINKS = [
  { href: "https://signalstudio.ie/privacy", label: "Privacy" },
  { href: "https://signalstudio.ie/terms", label: "Terms" },
  { href: "https://signalstudio.ie/security", label: "Security" },
] as const;

export function AuthStage({
  children,
  headline,
}: {
  children: React.ReactNode;
  headline: string;
}) {
  const secondary = createAccountCta();
  const preLaunch = isPreLaunch();

  return (
    <div className={styles.page}>
      <header className={styles.bar}>
        <Link href="/" className={styles.wordmarkLink} aria-label="Signal Studio">
          <span className={styles.wordmark}>
            signal studio<span className={styles.wordmarkDot} aria-hidden>.</span>
          </span>
        </Link>
        <p className={styles.switch}>
          {preLaunch ? "Not open yet? " : "New here? "}
          {secondary.external ? (
            <a href={secondary.href}>{secondary.label}</a>
          ) : (
            <Link href={secondary.href}>{secondary.label}</Link>
          )}
        </p>
      </header>

      <main className={styles.canvas}>
        <div className={styles.spine} aria-hidden>
          <span className={styles.spineRule} />
          <span className={styles.spineTrace} />
          {STATIONS.map((station) => (
            <span
              key={station.name}
              className={styles.station}
              data-resting={station.resting ? "true" : undefined}
              style={{ left: station.left }}
            >
              <span className={styles.stationTick} />
              <span className={styles.stationName}>{station.name}</span>
            </span>
          ))}
          <span className={styles.spineDot} />
        </div>

        <section className={styles.card}>
          <h1 className={styles.headline}>{headline}</h1>
          <div className={styles.slot}>{children}</div>
        </section>

        <a
          href={STUDIO_URL}
          className={styles.qrCard}
          target="_blank"
          rel="noreferrer"
        >
          <span className={styles.qrLabel}>Signal Studio on iPhone</span>
          <span className={styles.qrFrame}>
            <SignalQr size={148} />
          </span>
          <span className={styles.qrCaption}>
            <span className={styles.qrState} aria-hidden />
            In build. Scan to follow it.
          </span>
        </a>

        <nav className={styles.footer} aria-label="Company">
          {FOOTER_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              target="_blank"
              rel="noopener noreferrer"
              className={styles.footerLink}
            >
              {link.label}
            </a>
          ))}
          <span className={styles.footerNote}>Signal Studio · Ireland</span>
        </nav>
      </main>
    </div>
  );
}
