import type { Metadata } from "next";
import { ActiveProjectLabA } from "@/components/lab/active-project/variant-a";

/**
 * /lab/active-project-a — WP5 variant A, the Studio Bar anchor.
 *
 * Review only. Deterministic fixture data, no auth, no database, no server
 * action, noindex. See `docs/adr/0001-canonical-project-identity.md` and the
 * plan's §7 for what this is selecting between.
 */
export const metadata: Metadata = {
  title: "Active Project · Lab A · Studio Bar anchor",
  description:
    "WP5 design lab, variant A. Review only, not for production.",
  robots: { index: false, follow: false },
};

export default function ActiveProjectLabAPage() {
  return <ActiveProjectLabA />;
}
