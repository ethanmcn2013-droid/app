# Event account export prerequisite — 5 September 2026

Review candidate on `feat/january-event-export`, based on exact
`cbf40af93907a07dde82f2e8036ce84a72a92d88`. This milestone implements item 1 of
the accepted Event recovery sequencing. Independent review and principal
registration/composition remain next. It does not close Event access policy.

## Changes and privacy boundary

- `src/server/account-export.ts`: purchaser-owned `eventPurchases`, resolved from
  the authenticated Clerk subject to its stored local user, survive transfer and
  membership removal. The query never joins project names or content. Pending,
  paid-undesignated, designated and revoked facts retain their recorded meaning.
- `ownedWorkspaces.eventProjectEffects`: current primary-owner effects only,
  selecting workspace, settlement, original term, designation and revocation.
  No payer, intent id, payment reference or replacement erasure id is projected.
  The query rechecks current primary ownership; membership alone is insufficient.
- The existing owned-project Event entitlement row also contained the former
  payer and payment reference in `userId`/`notes`. Its owner projection now keeps
  only project/tier/source/start/expiry. Purchasers retain their own full account
  entitlement rows. Legacy Event terms remain portable without designation
  inference; other entitlement projections are unchanged.
- `src/components/settings/profile/data-privacy.tsx`: native download from the
  existing `/api/account/export`, directly in the independent `/settings/profile`
  surface. The copy describes account JSON and excludes uploaded/Drive bytes.
  It uses existing semantic light/dark styling, a 44px target and visible focus.
- Tests: `src/server/account-event-export.test.ts`, the existing unified export
  tests and actual HTTP route tests. Preview: `experience/event-account-export/`.
  No schema, ledger, package, CI, registry, HQ, provider or production changes.

The new export depends on the already accepted 0031 table. A missing table/read
failure produces the existing generic private/no-store HTTP 500; it cannot
silently issue an apparently complete download. No shared-store read is needed.
Erased purchaser facts remain anonymous; original positive terms are not replaced
with the local revocation epoch. The export reports recorded facts, not a computed
project-access verdict or a globally atomic snapshot of every module.

## Exact focused commands and results

Run from this App worktree with Node 22.23.2 and the frozen dependency installation:

```sh
node --import tsx --import ./src/test/register-server-only.mjs --test --test-concurrency=1 src/server/account-export.test.ts src/server/account-event-export.test.ts src/server/account-unified-export.test.ts src/app/api/account/export/route.test.ts
node --import tsx --import ./src/test/register-server-only.mjs --test --test-name-pattern="actual export route returns owner metadata" src/modules/notes/server/notes-calendar-erasure.test.ts
node --test src/server/tenant-scope.test.mjs src/server/tenant-scope-rules.test.mjs
node node_modules/typescript/bin/tsc --noEmit --incremental false
pnpm exec eslint src/server/account-export.ts src/server/account-event-export.test.ts src/server/account-unified-export.test.ts src/app/api/account/export/route.test.ts src/components/settings/profile/data-privacy.tsx experience/event-account-export/browser.mjs
node scripts/check-module-boundaries.mjs
node scripts/check-first-contact-language.mjs
node --import tsx --import ./src/test/register-server-only.mjs experience/event-account-export/browser.mjs
```

Results: 27/27 export tests (12 new direct SQLite, 7 unified, 6 HTTP, 2 existing
account); 1/1 existing actual Notes-export case; 24/24 tenant checks; typecheck,
module and first-contact gates pass. Focused lint: zero errors, 12 existing unused
`_id` warnings in unchanged unified-test callbacks. Browser: 4/4 actual component
cases, 390x844 and 1440x960, light/dark, keyboard focus/Enter/native download,
44px target, no horizontal overflow, no eager request, no console/network errors.
Each download runs the actual HTTP handler and unified Tasks SQLite exporter.

`PROFILE_EXPORT_OUTPUT` must select a fresh output directory. Baseline invocation
adds `--baseline`; it swaps only DataPrivacy with immutable cbf40 source and is
expected to fail the four direct-link checks. Full workflow/limits are in README.

## Retained negative and lifecycle evidence

The archive retains the initial 12/12 missing-projection failures, the immutable
cbf40 component's four failed direct-link cases, and an independent scratch
1/1 real-SQLite comparison that confirms cbf40 exposes former-payer/reference
fields while this projection preserves the same project term without them.
Its exact command/source are in the archive; it imports this writer's actual
fixture and loads the old exporter with `git show`.

The first typecheck rejected a synthetic `med` priority; the fixture now uses
`p2`. The initial passing browser receipt used a design-system 80px minimum;
manual inspection led to explicit 44px. Both earlier results remain unchanged.
`browser-after-final` is the final source render. The early missing-projection
log predates that fixture priority correction; it is not an exact-final-test
baseline. The immutable old/new SQLite comparison supplies the stronger boundary
control with final code.

Final behavioral controls include real prepare/bind/settlement, transfer/removal,
paid-undesignated recovery facts, refund-first and failed shared-mirror/local
negative persistence, original term, authenticated-subject remapping, co-owner,
member and outsider refusal. Actual purchaser erasure is exercised with foreign
keys ON/OFF and revoked/unrevoked terms; a surviving project retains anonymous
effects and deleting that project removes them. Actual damaged disposable SQLite
proves the generic HTTP failure, and module exceptions/unavailability do not leak
diagnostics or drop available sections. New combined tests stub other module
callbacks explicitly; the separate retained Notes-export case runs actual stores.

## Principal integration and remaining proof

Register `src/server/account-event-export.test.ts` in a mandatory serial gate;
the modified unified/HTTP files already belong to the default gate. The first
command above is the complete 27-test focused invocation. Register the browser
command with installed Chromium in the owning experience lane. Surface id is
`tasks.page.settings-profile`; DataPrivacy is the changed render dependency.
Principal owns all package/CI/registry/full-route integration and canonical status.

Durable archive uses the existing recipient review LFS rule:
`experience/reviews/january-recipient-2026-09-05/event-export-cbf40-prerequisite.zip`.
Its adjacent manifest identifies byte hashes, source inventory and receipts.
Projectless output mirror: `outputs/event-export-prerequisite-2026-09-05/` in the
shared Documents task. Browser source hashes normalize CRLF to LF; runner receipts
hash raw bytes. The inventory records both explicitly.

No new migration or flag. New Event sales remain unavailable. Recovery controls,
private/Timeline/public/cache enforcement and receiving/render acceptance are
later milestones. Existing account refusal, personal Notes boundaries and
private/no-store successful/error responses are retained. The component fixture
adapts Clerk/NextResponse and is not a full Next/Clerk session or physical-device
test; no provider bytes, customer data, provider observations, human comprehension,
security certification, council seal or stopped-task acceptance is claimed.
All preview listeners and disposable databases are closed. User hooks and other
worktrees are preserved. Source must remain frozen for the independent review.
