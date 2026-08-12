import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import { GoogleTag } from "@/components/analytics/google-tag";
import { Geist, Geist_Mono } from "next/font/google";
import { SuiteChromeGate } from "@/components/app/suite-chrome-gate";
import { DevBanner } from "@/components/dev-banner";
import { MotionProvider } from "@/components/motion-provider";
import { isDemoMode } from "@/lib/access-mode";
import { BARE_CHROME_HEADER } from "@/lib/bare-artifact-path";
import { APP_ORIGIN } from "@/lib/product-urls";
import "./globals.css";

// latin-ext included deliberately: on a shared wedding timeline the couple's
// names ARE the headline, and "Łukasz & Zofia" must not fall back to a
// system face mid-h1.
const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin", "latin-ext"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin", "latin-ext"],
});

/**
 * The document's own paper, as two literals.
 *
 * They exist because two consumers cannot read a CSS variable: the
 * pre-stylesheet paint guard below, which has to be correct in the window
 * before globals.css resolves var(--paper), and the theme-color meta, which
 * the browser reads to tint its own chrome. Declared once here so the guard
 * and the browser chrome cannot drift apart. The dark value mirrors --paper
 * in the [data-theme="dark"] block of tokens.css.
 */
export const PAPER_LIGHT = "#ffffff";
export const PAPER_DARK = "#0f0f10";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  // Light, and only light, at the root: marketing, the public /s/[token]
  // artifact and the auth stage never carry data-theme, so they are white
  // documents on every device. Pairing the theme-color to
  // prefers-color-scheme HERE would put a dark browser bar above a white
  // marketing page for every visitor whose phone is set to dark. The app
  // segment carries its own pair — src/app/app/layout.tsx.
  themeColor: PAPER_LIGHT,
};

export const metadata: Metadata = {
  title: "Signal Studio",
  description:
    "Notes, tasks, timelines, and the signal that matters in one calm workspace.",
  metadataBase: new URL(APP_ORIGIN),
  // No root-level `alternates.canonical`. Next inherits metadata down the
  // tree, so a canonical here resolved to the bare origin on every page
  // that did not set its own — all thirteen /templates pages declared
  // themselves to be https://app.signalstudio.ie, which is why none of
  // them could rank. Pages that need a canonical set it themselves.
  manifest: "/manifest.webmanifest",
  openGraph: {
    title: "Signal Studio",
    description:
      "Notes, tasks, timelines, and the signal that matters.",
    type: "website",
  },
};

function ProductRuntime({
  children,
  demoMode,
}: Readonly<{
  children: React.ReactNode;
  demoMode: boolean;
}>) {
  const runtime = (
    <>
      <MotionProvider>{children}</MotionProvider>
      {/* The review pill belongs to the application, so it comes off wherever
          the application's chrome comes off — the bearer-link artifact and the
          Timeline owner preview. The gate decides that from the pathname
          rather than from the request header the <head> above reads, because
          this layout renders once per document while the preview can be
          reached by a client navigation. Deciding it twice from one predicate
          keeps the two routes in, and the two ways in, agreeing. */}
      {demoMode ? (
        <SuiteChromeGate>
          <DevBanner />
        </SuiteChromeGate>
      ) : null}
    </>
  );

  return runtime;
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Proxy writes this request header for the chrome-free surfaces: /s/* before
  // any Clerk middleware runs, and the Timeline owner preview after its gate.
  // It governs the <head> only — the analytics tag and the suite preconnect
  // hints, which are decided once when the document is built and cannot be
  // taken back on a client navigation anyway.
  const bareArtifact = (await headers()).get(BARE_CHROME_HEADER) === "1";
  const demoMode = isDemoMode();

  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      /* The app's pre-paint script writes data-theme onto this element
         before hydration, so the server HTML and the client render
         legitimately differ by that one attribute. Nothing else on
         <html> is suppressed — lang and className are still diffed. */
      suppressHydrationWarning
    >
      <head>
        {!bareArtifact ? (
          <GoogleTag enabled={process.env.VERCEL_ENV === "production"} />
        ) : null}
        {/* Pre-stylesheet paint guard (RW-5). Two literals on purpose:
            this rule has to be correct in the window before globals.css
            has loaded, when var(--paper) does not yet resolve. The
            attribute only ever appears on an app document. */}
        <style
          dangerouslySetInnerHTML={{
            __html:
              `html{background:${PAPER_LIGHT}}` +
              `html[data-theme="dark"]{background:${PAPER_DARK}}`,
          }}
        />
        {!bareArtifact ? (
          <>
            <link rel="preconnect" href="https://signalstudio.ie" />
            <link rel="dns-prefetch" href="https://signalstudio.ie" />
          </>
        ) : null}
      </head>
      {/* No background style prop: globals.css paints html and body with
          var(--bg), which resolves to var(--paper) — white on every light
          document, the dark canvas under data-theme="dark". The literal
          that used to sit here made the second case unreachable. */}
      <body className="min-h-full flex flex-col">
        <ProductRuntime demoMode={demoMode}>{children}</ProductRuntime>
      </body>
    </html>
  );
}
