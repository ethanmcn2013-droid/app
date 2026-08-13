import type { Metadata } from "next";
import { ActiveProjectLabB } from "@/components/lab/active-project/variant-b";

/**
 * /lab/active-project-b — WP5 variant B, the product canvas band.
 * Review only. Deterministic fixture data, no auth, no database, noindex.
 */
export const metadata: Metadata = {
  title: "Active Project · Lab B · Product canvas band",
  description: "WP5 design lab, variant B. Review only, not for production.",
  robots: { index: false, follow: false },
};

export default function ActiveProjectLabBPage() {
  return <ActiveProjectLabB />;
}
