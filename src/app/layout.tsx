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

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#ffffff",
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
      style={{ background: "#fff", colorScheme: "light" }}
    >
      <head>
        {!bareArtifact ? (
          <GoogleTag enabled={process.env.VERCEL_ENV === "production"} />
        ) : null}
        <style dangerouslySetInnerHTML={{ __html: "html{background:#fff}" }} />
        {!bareArtifact ? (
          <>
            <link rel="preconnect" href="https://signalstudio.ie" />
            <link rel="dns-prefetch" href="https://signalstudio.ie" />
          </>
        ) : null}
      </head>
      <body className="min-h-full flex flex-col" style={{ background: "#fff" }}>
        <ProductRuntime demoMode={demoMode}>{children}</ProductRuntime>
      </body>
    </html>
  );
}
