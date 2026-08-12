import type { Metadata } from "next";
import type { ReactNode } from "react";
import { requireLabReviewer } from "@/lib/home-layer/lab/guard";

/**
 * The protected boundary for the Home operating-layer design lab.
 *
 * Every page under /lab/home-operating-layer sits inside this layout, so the
 * guard runs before any child renders. Nothing below this file may re-decide
 * access, and nothing below it may be reachable without passing through here.
 *
 * `force-dynamic` is load-bearing, not habit. Without it Next may prerender
 * these pages at build time, and a prerendered page is a decision baked at
 * build time served from a cache — the guard would never run per request, and
 * flipping the flag afterwards would change nothing. The guard has to be asked
 * every time.
 *
 * `robots` is defence in depth and nothing more. noindex is not access
 * control; the guard is. Both are here because the guard is what stops a
 * person and noindex is what stops a crawler that got a URL some other way.
 */

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Home operating layer, protected lab",
  description:
    "Internal design review surface. Fixture data only, not customer data, not for production.",
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: { index: false, follow: false },
  },
};

export default async function HomeOperatingLayerLabLayout({
  children,
}: {
  children: ReactNode;
}) {
  await requireLabReviewer();
  return <>{children}</>;
}
