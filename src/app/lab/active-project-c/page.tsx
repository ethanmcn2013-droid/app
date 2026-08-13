import type { Metadata } from "next";
import { ActiveProjectLabC } from "@/components/lab/active-project/variant-c";

/**
 * /lab/active-project-c — WP5 variant C, the command-led hybrid.
 * Review only. Deterministic fixture data, no auth, no database, noindex.
 */
export const metadata: Metadata = {
  title: "Active Project · Lab C · Command-led hybrid",
  description: "WP5 design lab, variant C. Review only, not for production.",
  robots: { index: false, follow: false },
};

export default function ActiveProjectLabCPage() {
  return <ActiveProjectLabC />;
}
