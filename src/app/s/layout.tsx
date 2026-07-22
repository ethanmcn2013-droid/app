import type { Metadata } from "next";

const privateTimelineDescription = "A private timeline shared directly by its owner.";

/**
 * Keep every bearer-link response inside the Timeline presentation boundary,
 * including unavailable links that exit through `notFound()` before the page's
 * dynamic metadata can resolve. This prevents the operating product's
 * manifest, canonical URL and social card from leaking into the artifact.
 */
export const metadata: Metadata = {
  title: "timeline",
  description: privateTimelineDescription,
  alternates: { canonical: null },
  manifest: null,
  robots: {
    index: false,
    follow: false,
    noarchive: true,
    nosnippet: true,
  },
  openGraph: {
    title: "timeline",
    description: privateTimelineDescription,
    type: "website",
    siteName: "timeline",
    images: [],
  },
  twitter: {
    card: "summary",
    title: "timeline",
    description: privateTimelineDescription,
    images: [],
  },
};

export default function SharedTimelineLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
