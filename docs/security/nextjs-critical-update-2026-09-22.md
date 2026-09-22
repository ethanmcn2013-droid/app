# Next.js critical security update — 2026-09-22

Status: dependency and lockfile checkpoint; verification pending.

## Change

Pin `next` and `eslint-config-next` to 16.3.6, preserving React and React DOM
19.2.4 and ESLint 9. Regenerate the frozen pnpm lockfile with pnpm 11.9.0.
The install policy now has exact `minimumReleaseAgeExclude` entries for the
16.3.6 Next.js release family (including its optional SWC packages); this is
an explicit short-term exception for the official out-of-band security
release, not a general freshness-policy change. Remove those exact entries
once the configured minimum-release age has elapsed.

## Reason and exposure

Vercel's 2026-09-22 [security update](https://nextjs.org/blog/nextjs-security-update-september-22-2026)
reports critical remote code execution in the Node.js `ImageResponse`
implementation (`next/og`), for Next.js `>=16.2.0 <16.3.6`, under specific
conditions involving improper SVG escaping and vulnerable upstream
dependencies. The advisory excludes Edge `ImageResponse`. It recommends
16.3.6 for Active LTS. The app's base revision, `639be07e`, pins 16.2.11 and
contains five Node `ImageResponse` metadata routes under
`src/app/social/{x-pinned,x-banner,bluesky-banner,reddit-ads-wedding,bluesky-pinned}/opengraph-image.tsx`.
Those routes render local static JSX, text, styles, and SVG components; source
inspection found no request-derived, fetched, environment, or other
attacker-controlled content inputs. This establishes vulnerable-version and
Node-path exposure, not exploitability or evidence of an exploit.

The August 25 Next.js release fixed two separate critical advisories
(`GHSA-2xp9-vwfh-vxw4`, AVIF image optimization RCE, and
`GHSA-p293-qw3h-jr36`, Windows-hosted server RCE) starting at 16.3.3. The new
September advisory has the higher 16.3.6 minimum; this update covers all three
Next.js criticals.

## Evidence and remaining work

- Exact source base: `639be07e855e3e625038a7ba8f660110da836f19`.
- Official npm registry metadata at review time reports `next` and
  `eslint-config-next` latest stable 16.3.6. Next 16.3.6 accepts React
  `^19.0.0`; keeping the existing React 19.2.4 avoids an unrelated React
  upgrade. `eslint-config-next` 16.3.6 requires ESLint >=9.
- `pnpm install --lockfile-only --ignore-scripts` completed with pnpm 11.9.0
  and refreshed the lockfile without installing packages or running scripts.
- `pnpm audit --prod` against the refreshed lockfile reports 6 remaining
  production vulnerabilities (2 low, 4 moderate): three `undici`, one
  `@opentelemetry/core`, one `@babel/core`, and one
  `@ai-sdk/provider-utils`. No critical production advisories were reported;
  no zero-advisory claim is made. Dev audit and build/type/test verification
  remain pending.
- No application source, production environment, or database was changed.
