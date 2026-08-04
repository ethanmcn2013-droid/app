import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import { GoogleTag } from "@/components/analytics/google-tag";
import { Geist, Geist_Mono } from "next/font/google";
import { DevBanner } from "@/components/dev-banner";
import { MotionProvider } from "@/components/motion-provider";
import { isDemoMode } from "@/lib/access-mode";
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
  alternates: { canonical: "/" },
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
  bareArtifact,
}: Readonly<{
  children: React.ReactNode;
  demoMode: boolean;
  bareArtifact: boolean;
}>) {
  const runtime = (
    <>
      <MotionProvider>{children}</MotionProvider>
      {demoMode && !bareArtifact ? <DevBanner /> : null}
    </>
  );

  return runtime;
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Proxy writes this request header only for /s/* before any Clerk middleware
  // runs. Selecting the runtime on the server keeps Clerk's client bundle and
  // suite preconnect hints completely out of bearer-link HTML.
  const bareArtifact = (await headers()).get("x-signal-bare-artifact") === "1";
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
        <ProductRuntime demoMode={demoMode} bareArtifact={bareArtifact}>
          {children}
        </ProductRuntime>
      </body>
    </html>
  );
}
