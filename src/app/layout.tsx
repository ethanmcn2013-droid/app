import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { MotionProvider } from "@/components/motion-provider";
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
  // Notch / home-indicator hardware: opt into the full screen so
  // env(safe-area-inset-*) becomes meaningful on iOS.
  viewportFit: "cover",
};

export const metadata: Metadata = {
  title: "Signal Tasks — execution clarity",
  description:
    "Execution clarity for live work: four views of the same list, plain-English dates, and enough motion to show what changed.",
  metadataBase: new URL(TASKS_URL),
  // metadataBase alone does not emit <link rel="canonical">. Without an
  // explicit canonical, Google can index Vercel preview/deployment URLs
  // alongside the canonical domain. Resolves against metadataBase.
  alternates: { canonical: "/" },
  manifest: "/manifest.webmanifest",
  openGraph: {
    title: "Signal Tasks — execution clarity",
    description:
      "A live task workspace for the work people actually do.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider
      appearance={{
        variables: {
          colorPrimary: "#4f46e5",
          colorBackground: "#ffffff",
          colorText: "#14151a",
          fontFamily: "var(--font-geist-sans)",
          borderRadius: "0.5rem",
        },
        elements: {
          // Mobile correctness: 48px min-height on inputs + buttons hits
          // the WCAG 2.5.5 tap-target floor, and 16px input font-size
          // prevents iOS Safari's auto-zoom on focus. Both are mobile-only
          // wins that don't change the desktop register.
          formFieldInput:
            "!min-h-[48px] !text-[16px]",
          formButtonPrimary:
            "bg-ink hover:bg-ink-soft text-white rounded-full !min-h-[48px] !text-[15px]",
          socialButtonsBlockButton:
            "!min-h-[48px] !text-[15px]",
          socialButtonsBlockButtonText:
            "!text-[15px]",
          card: "shadow-[0_24px_60px_-24px_rgba(20,21,26,0.18)]",
        },
      }}
    >
      <html
        lang="en"
        className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      >
        <body className="min-h-full flex flex-col">
          <MotionProvider>{children}</MotionProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
