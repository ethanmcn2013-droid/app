# January dependency maintenance — 4 September 2026

Observed candidate production-install audit before and after targeted remediation. These counts do not describe main or production, and a clear package audit is not a complete security certification.

- @opentelemetry/core 2.6.1 / 2.7.1 → 2.8.0 through Sentry server instrumentation. The same-major core patch preserves its API peer range; Sentry itself is unchanged.
- undici 6.27.0 → 6.28.0 through @vercel/blob.
- @babel/core 7.29.0 → 7.29.6 through Sentry build tooling and Next's styled-jsx peer. Babel is in the production install graph, primarily exercised during compilation.

Bounded overrides cover only affected major/ranges. Remove each when a verified owner update resolves patched packages without it. This avoids unrelated Sentry/Blob/framework upgrades. Lockfile changes are limited to these edges, their necessary compatible transitive dependencies and peer snapshots. No registry or lifecycle policy changes were made. Mermaid's caret initially selected a later minor during local resolution; the final direct version is pinned to 11.16.1.

## Audit receipt

Before: {"info":0,"low":1,"moderate":4,"high":0,"critical":0}.
After: {"info":0,"low":0,"moderate":0,"high":0,"critical":0}.

Commands: owning pnpm install --lockfile-only; pnpm install --frozen-lockfile; pnpm audit --prod --json. Final install and audit exited 0. See the exact JSON receipts beside this document. Deprecation notices remain; they are not suppressed. Studio retains its existing ignored esbuild lifecycle scripts.

| Advisory | Package | Audit severity |
| --- | --- | --- |
| [GHSA-4x5r-pxfx-6jf8](https://github.com/advisories/GHSA-4x5r-pxfx-6jf8) | @babel/core | low |
| [GHSA-8xcm-r25x-g524](https://github.com/advisories/GHSA-8xcm-r25x-g524) | undici | moderate |
| [GHSA-m8rv-5g2x-5cg5](https://github.com/advisories/GHSA-m8rv-5g2x-5cg5) | undici | moderate |
| [GHSA-v3r7-h72x-cjcm](https://github.com/advisories/GHSA-v3r7-h72x-cjcm) | undici | moderate |
| [GHSA-8988-4f7v-96qf](https://github.com/advisories/GHSA-8988-4f7v-96qf) | @opentelemetry/core | moderate |

The initial Babel advisory responses disagreed about the minimum patched version; 7.29.6 satisfies both. The DOMPurify advisory API initially returned an inconsistent patched range for GHSA-x4vx-rjvf-j5p4; the final 3.4.13 audit is observed clear, without interpreting that earlier field as a waiver.

## Acceptance and rollback

Behavioral gates, build, browser rendering and receiving-branch evidence are owned by the combined candidate. Consult the final integration receipt for their exact candidate and outcomes; this audit alone does not claim them. Roll back through a reviewed revert of the dependency milestone and a frozen install, never by manually editing installed packages. Such a rollback restores the recorded advisory exposure and cannot silently qualify a release.
