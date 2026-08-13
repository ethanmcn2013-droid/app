import type { Metadata } from "next";
import { ActiveProjectLabW } from "@/components/lab/active-project/variant-w";

/**
 * /lab/active-project-w — WP5 wildcard, the deck.
 * Review only. Deterministic fixture data, no auth, no database, noindex.
 */
export const metadata: Metadata = {
  title: "Active Project · Lab W · The deck",
  description: "WP5 design lab, the wildcard. Review only, not for production.",
  robots: { index: false, follow: false },
};

export default function ActiveProjectLabWPage() {
  return <ActiveProjectLabW />;
}
