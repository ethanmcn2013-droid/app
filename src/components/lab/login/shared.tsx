/**
 * Pieces every login direction shares: the wordmark, the provider marks, the
 * iPhone QR card, and the legal line.
 *
 * Review-only. Nothing here posts anywhere, and no Clerk component is mounted,
 * so the three directions can be compared without an auth session.
 */

import Link from "next/link";
import { SignalQr } from "@/components/brand/signal-qr";
import styles from "./shared.module.css";

/** Where the QR points. The iOS page states the build state honestly. */
export const IOS_URL = "https://signalstudio.ie/ios";

/* ── Wordmark ──────────────────────────────────────────────────────────── */

export function StudioWordmark({
  size = "md",
  tone = "ink",
}: {
  size?: "sm" | "md";
  tone?: "ink" | "inverse";
}) {
  return (
    <span
      className={styles.wordmark}
      data-size={size}
      data-tone={tone}
      aria-label="Signal Studio"
    >
      signal studio<span className={styles.wordmarkDot} aria-hidden>.</span>
    </span>
  );
}

/* ── Provider marks ────────────────────────────────────────────────────── */
/* Drawn rather than imported so the lab has no asset dependency. Apple's
   glyph is a simplified silhouette; the real button would use the vendor
   asset under their brand terms. */

export function GoogleMark() {
  return (
    <svg viewBox="0 0 18 18" width={17} height={17} aria-hidden focusable="false">
      <path
        fill="rgb(66, 133, 244)"
        d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62Z"
      />
      <path
        fill="rgb(52, 168, 83)"
        d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.93v2.33A9 9 0 0 0 9 18Z"
      />
      <path
        fill="rgb(251, 188, 5)"
        d="M3.97 10.72a5.4 5.4 0 0 1 0-3.44V4.95H.93a9 9 0 0 0 0 8.1l3.04-2.33Z"
      />
      <path
        fill="rgb(234, 67, 53)"
        d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.59C13.46.89 11.43 0 9 0A9 9 0 0 0 .93 4.95l3.04 2.33C4.68 5.16 6.66 3.58 9 3.58Z"
      />
    </svg>
  );
}

export function AppleMark() {
  return (
    <svg viewBox="0 0 18 18" width={17} height={17} aria-hidden focusable="false" fill="currentColor">
      <path d="M12.6 9.53c.02-1.72 1.4-2.55 1.47-2.59-.8-1.17-2.05-1.33-2.5-1.35-1.06-.11-2.07.62-2.61.62-.54 0-1.37-.6-2.25-.59-1.16.02-2.23.67-2.82 1.71-1.2 2.09-.31 5.18.86 6.87.58.83 1.26 1.76 2.15 1.72.86-.03 1.19-.55 2.23-.55s1.34.55 2.25.54c.93-.02 1.52-.84 2.09-1.67.66-.96.93-1.89.94-1.94-.02-.01-1.8-.7-1.81-2.77ZM10.9 4.5c.48-.58.8-1.38.71-2.19-.69.03-1.52.46-2.01 1.03-.44.51-.83 1.33-.72 2.11.77.06 1.55-.39 2.02-.95Z" />
    </svg>
  );
}

/* ── iPhone QR card ────────────────────────────────────────────────────── */

/**
 * The bottom-right mark. Clickable on desktop, scannable on a phone, honest
 * about the build state either way.
 */
export function IosQrCard({
  tone = "paper",
  qrSize = 112,
}: {
  tone?: "paper" | "charcoal" | "bare";
  qrSize?: number;
}) {
  return (
    <a
      href={IOS_URL}
      className={styles.qrCard}
      data-tone={tone}
      target="_blank"
      rel="noreferrer"
    >
      <span className={styles.qrLabel}>Signal Studio on iPhone</span>
      <span className={styles.qrFrame}>
        <SignalQr size={qrSize} />
      </span>
      <span className={styles.qrCaption}>
        <span className={styles.qrState} aria-hidden />
        In build. Scan to follow it.
      </span>
    </a>
  );
}

/* ── Legal + footer ────────────────────────────────────────────────────── */

export function LegalLine({ align = "left" }: { align?: "left" | "center" }) {
  return (
    <p className={styles.legal} data-align={align}>
      By continuing you agree to the{" "}
      <Link href="/terms" className={styles.legalLink}>
        Terms
      </Link>{" "}
      and the{" "}
      <Link href="/privacy" className={styles.legalLink}>
        Privacy Policy
      </Link>
      .
    </p>
  );
}

const FOOTER_LINKS = [
  { href: "/privacy", label: "Privacy" },
  { href: "/terms", label: "Terms" },
  { href: "/security", label: "Security" },
  { href: "/status", label: "Status" },
] as const;

export function LoginFooter({ tone = "ink" }: { tone?: "ink" | "inverse" }) {
  return (
    <nav className={styles.footer} data-tone={tone} aria-label="Company">
      {FOOTER_LINKS.map((link) => (
        <Link key={link.href} href={link.href} className={styles.footerLink}>
          {link.label}
        </Link>
      ))}
      <span className={styles.footerNote}>Signal Studio · Ireland</span>
    </nav>
  );
}
