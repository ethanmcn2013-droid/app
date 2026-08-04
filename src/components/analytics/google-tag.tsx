"use client";

import Script from "next/script";
import { usePathname } from "next/navigation";
import { isBareArtifactPath } from "@/lib/bare-artifact-path";
import { isAnalyticsExcludedPath } from "@/lib/public-analytics-boundary";

/**
 * Google Analytics 4 measurement ID for the Signal Studio web properties.
 * Single place to change it; imported by the root layout via <GoogleTag />.
 */
export const GA_MEASUREMENT_ID = "G-YHBS152PJK";

/**
 * The Google tag (gtag.js), rendered once in the root layout so it lands on
 * every page. Production only: preview and local builds must not pollute the
 * analytics property. CSP hosts are allow-listed in next.config.
 *
 * No consent gate on the marketing surfaces yet. If a cookie-consent banner is
 * added, switch to Consent Mode v2 (default `denied`) here.
 *
 * The couple-facing public routes are excluded unconditionally and are not
 * waiting on a consent gate: R-032, decided as Option A in D-033. See
 * `@/lib/public-analytics-boundary`. Deleting that check is caught by
 * `src/server/public-surface-analytics-contract.test.mjs`.
 */
export function GoogleTag({ enabled }: { enabled: boolean }) {
  const pathname = usePathname() ?? "";
  if (isAnalyticsExcludedPath(pathname)) return null;
  if (!enabled || isBareArtifactPath(pathname)) return null;
  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
        strategy="afterInteractive"
      />
      <Script id="google-tag-init" strategy="afterInteractive">
        {`window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', '${GA_MEASUREMENT_ID}');`}
      </Script>
    </>
  );
}
