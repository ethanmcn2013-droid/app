# Own-target materiality evidence

The canonical run retains all 33 existing critical cases and adds one own-target
case for each of the 16 current materiality links, at each of the four existing
viewports: 196 actual tests. Tiers, required states, quality scores, approved
baselines and the original critical mappings remain unchanged.

Six cases open the actual demo App routes; the resource case opens the actual
Task detail panel and its Files and links section. Nine cases import the actual
loading/error components, their module CSS, and the completed App build's utility
CSS and Geist font assets. This isolated component fixture establishes local
rendering and the declared retry callback only. Its anchor adapter does not
establish Next segment recovery, authorized data reads or provider continuity.
No fixture is imported into the deployed App.

The second server binds only 127.0.0.1. It requires an explicit synthetic Preview
launch, refuses Vercel hosting and nonloopback origins, and exposes only the fixed
nine component IDs and build assets. esbuild resolves within the project's
declared, locked tsx dependency. The build receipt records the exact Git commit,
tree, all actual bundle inputs, output digests and completed CSS/font asset
digests. The canonical fixture manifest binds the normalized source/public and
fixture input inventory. It does not rewrite any experience entry.

Each error component emits exactly one declared synthetic Error. The watcher
removes that exact record in place; later runtime events remain connected and
still fail the case. A successful retry assertion means the local callback was
called exactly once. It does not mean a server request recovered.

Capture order is: freeze and independently review the source; complete the
owning demo Preview build; run Playwright directly; preserve its raw report,
screenshots, traces and fixture build receipt; issue the strict schema2
attestation; obtain root technical receiving review of one representative
capture per target plus all four viewport checks; issue 16 fresh receipts using
the maintained writer; validate all linked receipts and the current full run.
Old v1 bytes remain at their original paths and are copied unchanged under
`experience/reviews/history-runtime-20261009/`; they are historical and cannot
qualify current schema2 acceptance.

The native CI artifact `tasks-critical-experience-evidence` includes the raw
report, attestation, Playwright reports/results and fixture build receipt, with
its existing 14-day retention. Local copies and SHA indexes are retained in the
owning release receipt directory for private receiving. No new paid storage,
unreviewed LFS archive or provider publication is required. Local checks and
technical receiving do not replace final Linux CI or the release operator's
production gates.
