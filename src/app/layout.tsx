import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { MotionProvider } from "@/components/motion-provider";
import { DevBanner } from "@/components/dev-banner";
import { clerkPublishableKey, isDemoMode } from "@/lib/access-mode";
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
  title: "Signal Tasks - execution clarity",
  description:
    "Execution clarity for live work: four views of the same list, plain-English dates, and enough motion to show what changed.",
  metadataBase: new URL(TASKS_URL),
  alternates: { canonical: "/" },
  manifest: "/manifest.webmanifest",
  openGraph: {
    title: "Signal Tasks - execution clarity",
    description:
      "Four views of the same list, real-time when it matters, plain-English dates - free to start.",
    type: "website",
  },
};

function AppShell({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <>
      <MotionProvider>{children}</MotionProvider>
      <DevBanner />
    </>
  );
}

function AuthShell({ children }: Readonly<{ children: React.ReactNode }>) {
  if (isDemoMode()) {
    return <AppShell>{children}</AppShell>;
  }

  return (
    <ClerkProvider
      publishableKey={clerkPublishableKey()}
      appearance={{
        variables: {
          colorPrimary: "#4f46e5",
          colorBackground: "#ffffff",
          colorForeground: "#14151a",
          fontFamily: "var(--font-geist-sans)",
          borderRadius: "0.5rem",
        },
        elements: {
          formFieldInput: "!min-h-[48px] !text-[16px]",
          formButtonPrimary:
            "bg-ink hover:bg-ink-soft text-white rounded-full !min-h-[48px] !text-[15px]",
          socialButtonsBlockButton: "!min-h-[48px] !text-[15px]",
          socialButtonsBlockButtonText: "!text-[15px]",
          card: "shadow-[0_24px_60px_-24px_rgba(20,21,26,0.18)]",
        },
      }}
    >
      <AppShell>{children}</AppShell>
    </ClerkProvider>
  );
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      style={{ background: "#fff", colorScheme: "light" }}
    >
      <head>
        <style dangerouslySetInnerHTML={{ __html: "html{background:#fff}" }} />
        <link rel="preconnect" href="https://timeline.signalstudio.ie" />
        <link rel="dns-prefetch" href="https://timeline.signalstudio.ie" />
        <link rel="preconnect" href="https://notes.signalstudio.ie" />
        <link rel="dns-prefetch" href="https://notes.signalstudio.ie" />
        <link rel="preconnect" href="https://signal.signalstudio.ie" />
        <link rel="dns-prefetch" href="https://signal.signalstudio.ie" />
        <link rel="preconnect" href="https://signalstudio.ie" />
        <link rel="dns-prefetch" href="https://signalstudio.ie" />
      </head>
      <body className="min-h-full flex flex-col" style={{ background: "#fff" }}>
        <AuthShell>{children}</AuthShell>
      </body>
    </html>
  );
}
