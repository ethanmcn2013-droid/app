import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import { GoogleTag } from "@/components/analytics/google-tag";
import { Geist, Geist_Mono } from "next/font/google";
import { DevBanner } from "@/components/dev-banner";
import { MotionProvider } from "@/components/motion-provider";
import { isDemoMode } from "@/lib/access-mode";
import { TASKS_URL } from "@/lib/product-urls";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#ffffff",
};

export const metadata: Metadata = {
  title: "Tasks · execution clarity",
  description:
    "Execution clarity for live work: four views of the same list, plain-English dates, and enough motion to show what changed.",
  metadataBase: new URL(TASKS_URL),
  alternates: { canonical: "/" },
  manifest: "/manifest.webmanifest",
  openGraph: {
    title: "Tasks · execution clarity",
    description:
      "Four views of the same list, real-time when it matters, plain-English dates - free to start.",
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
            <link rel="preconnect" href="https://timeline.signalstudio.ie" />
            <link rel="dns-prefetch" href="https://timeline.signalstudio.ie" />
            <link rel="preconnect" href="https://notes.signalstudio.ie" />
            <link rel="dns-prefetch" href="https://notes.signalstudio.ie" />
            <link rel="preconnect" href="https://signal.signalstudio.ie" />
            <link rel="dns-prefetch" href="https://signal.signalstudio.ie" />
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
