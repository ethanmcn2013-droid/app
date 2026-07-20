import Script from "next/script";

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
 * No consent gate yet — if a cookie-consent banner is added, switch to
 * Consent Mode v2 (default `denied`) here.
 */
export function GoogleTag() {
  if (process.env.VERCEL_ENV !== "production") return null;
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
