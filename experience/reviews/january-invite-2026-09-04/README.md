# January invitation and auth materiality review

Reviewed 2026-09-04 under the user's accepted delegated design authority.
Base: `ae6d14b94ce748808adb882ed1a524fb7ebc2ecd`.
Source under review: `8f5d676b` on `fix/january-invite-review`.
Worktree: `C:/Users/ethan/signal-studio-workspace/worktrees/app/fix-january-invite-review`.

The source change pins both invitation controls to `min-h-[44px]` and removes
the obsolete tap-scale outstanding entry. It changes no invitation semantics,
auth integration, backend, billing, Drive, shared layout or dependency versions.
The retained 25 invitation behavioral tests passed against this source.

## Review decision

Accept the two target-size corrections and refresh only the three requested
materiality hashes. This is a delegated source review with partial evidence,
not an approved visual baseline, council pass, human-comprehension result or
certification of real Clerk authentication. All existing partial coverage,
null baseline and unscored/unaccepted audit fields remain unchanged.

The review found the corrected controls legible at desktop and mobile, with
44 CSS-pixel height in both cases. The wrong-account message preserves the
invited address's privacy and provides a visible focus ring for account
switching. The valid review control remains disabled and is skipped by Tab.
Expired and accepted states provide distinct explanations and recovery links;
the accepted link retained its invitation return URL when activated by Enter.
These are observed rendering/keyboard results, not claims about unaided use.

## Actual rendered evidence

| Surface | Desktop 1280 × 900 | Mobile 390 × 844 | Evidence and limits |
|---|---|---|---|
| Valid invitation | [capture](valid-desktop.png) | [capture](valid-mobile.png) | Actual `/invite/review-valid`; disabled Accept is 44px and skipped by Tab. Existing fixed July fixture date is illustrative, not current expiry evidence. |
| Expired invitation | [capture](expired-desktop.png) | [capture](expired-mobile.png) | Actual `/invite/review-expired`; Back home has visible keyboard focus. |
| Accepted invitation | [capture](accepted-desktop.png) | [capture](accepted-mobile.png) | Actual `/invite/review-accepted`; Enter follows `/sign-in?redirect_url=%2Finvite%2Freview-accepted`. |
| Wrong account | [capture](wrong-account-desktop.png) | [capture](wrong-account-mobile.png) | Actual invitation main rendered with synthetic identity/read results; SignOutButton provider boundary replaced by its actual child button. Account sign-out is unverified. |
| Sign in | [capture](sign-in-desktop.png) | [capture](sign-in-mobile.png) | Actual credential-free auth route reached from accepted invitation. No credential fields in demo mode; real Clerk states remain unverified. |
| Sign up | [capture](sign-up-desktop.png) | [capture](sign-up-mobile.png) | Actual `/sign-up?use=wedding` in demo mode. No account created; real Clerk states remain unverified. |

Additional focus captures: [expired desktop](expired-desktop-focus.png),
[wrong-account desktop](wrong-account-desktop-focus.png),
[wrong-account mobile](wrong-account-mobile-focus.png),
[sign-up mobile](sign-up-mobile-focus.png).
The adjacent `.txt` files retain DOM snapshots. [browser-measurements.json](browser-measurements.json)
retains exact URLs, viewport and target measurements, keyboard/focus observations,
and captured console output. An early valid-mobile Tab observation reached the
mobile navigation button; the later explicit observations prove traversal to
the footer, skipping the disabled Accept button.

No horizontal document overflow was measured at either reviewed size. Tablet,
wide, screen reader, reduced-motion and complete accessibility coverage were
not run in this bounded pass. The official tool's “33 cases × 4 breakpoints”
output describes the existing manifest; it is not a claim that this review ran
that browser matrix. No screenshot baseline was generated or updated.

## Findings retained for the lead

- The connected Chrome environment injected `stndz-general-13` /
  `stndz-custom-css` ad-block CSS ahead of the root style. React reported an
  attribute hydration mismatch with those exact IDs and ad-selector content.
  The small development issue badge is retained in the actual screenshots.
  This is explained environment interference, not a zero-console-error pass;
  a clean-browser hydration check remains unverified. Browser settings and
  shared layout were not changed. Captured console output contained no
  separate failed asset request; exhaustive network tracing was not performed.
- The existing mobile marketing header overlaps the Tasks label with its
  demo link. This belongs to shared chrome and was not edited here.
- Existing Back home / accepted Sign in text links measure 19.5px high;
  the two corrected buttons measure 44px. No full-surface 44px claim is made.
- The auth stage still displays the existing iPhone QR wording and development
  notice. This review does not approve those claims or alter shared auth copy.
- Real Clerk sign-in/up, sign-out, wrong-account switching, email verification,
  live invitation acceptance, authenticated header behavior and human
  comprehension remain unverified. No credentials, provider, production data,
  migration, sending, outreach or deployment was used.

## Official registry refresh

`review-materiality.mjs` explicitly refuses mapped critical fixtures and directs
them to `critical-fixtures.mjs --write`. All three requested IDs are mapped.
The latter tool has no ID filter, so [refresh-registry.mjs](refresh-registry.mjs)
runs the unchanged official tool against a disposable source mirror outside
App's TypeScript discovery, then applies only its three authorized outputs.
It asserts every other registry entry and top-level value remains unchanged.
The real fixture manifest is not modified.

The official tool pins `lastReviewedAt` to the existing manifest's
`generatedAt` (`2026-07-26`). That machine field is retained so the canonical
fixture gate stays consistent. The actual **2026-09-04** review date, delegation,
source hashes, tool hash, limits and exact IDs are recorded in
[registry-refresh.json](registry-refresh.json) and this receipt.
Updating the programme-wide fixture date belongs to the lead's wider registry
work. No new `materialityReview` field or fabricated Playwright attestation was
added to bypass the official schema.

| Registry ID | Reviewed materiality hash |
|---|---|
| `tasks.page.invite-by-token` | `be59ad3c4caf2218` |
| `tasks.page.sign-in-by-sign-in` | `09fd1082f9dc2621` |
| `tasks.page.sign-up-by-sign-up` | `3d52f37b549d99ea` |

## Reproduction and gates

Pinned install: `pnpm install --frozen-lockfile`, passed; lockfile unchanged.
For the actual routes, from this worktree with provider/database credentials
absent from the process environment:

```powershell
$env:SIGNAL_ACCESS_MODE = 'demo'
$env:NEXT_PUBLIC_SIGNAL_ACCESS_MODE = 'demo'
$env:VERCEL_ENV = 'preview'
$env:NEXT_PUBLIC_TASKS_FIRST_COMPLETION = 'off'
$env:SIGNAL_ANALYTICS_V1_ENABLED = 'false'
$env:SIGNAL_HOME_ANALYTICS_ENABLED = 'false'
$env:NEXT_TELEMETRY_DISABLED = '1'
pnpm dev --hostname 127.0.0.1 --port 4357
```

The existing demo implementation does not expose wrong-account inputs.
`register.mjs` replaces only the renderer's request/provider import boundaries;
`boundaries.cjs` supplies four fixed read results and a verified synthetic
other account. `render-wrong-account.ts` imports the unchanged actual page,
renders its real `<main>`, asserts the target email and Accept control are
absent, and combines that markup with the actual local demo document's chrome
and styles. Scripts are removed to prevent demo hydration replacing that
server-rendered state. The header is therefore the demo shell; provider and
client hydration behavior are not represented by this static fixture.

```powershell
node --import tsx --import ./experience/reviews/january-invite-2026-09-04/register.mjs experience/reviews/january-invite-2026-09-04/render-wrong-account.ts
```

Wrong-account URL: `http://127.0.0.1:4358/invite/review-wrong-account`.
The saved `wrong-account.html` depends on generated local Next assets; the
tracked screenshots and renderer are its durable evidence. Both local
servers were stopped after capture (sessions 24996 and 55691).

The registry scope adapter requires `SIGNAL_INVITE_REVIEW_WORK` to name an
absolute disposable directory outside this checkout. The first rehearsal put
its source mirror under ignored `experience/output`; TypeScript still found
those copied sources, so the mirrors were moved out and the adapter now
requires the external scratch directory. No TypeScript configuration changed.

Checks on final product source:

- `pnpm test:invite-arrival`: **25/25 passed**, including real synthetic SQLite
  invitation/recovery behavior. No invitation semantics were changed.
- `node scripts/check-tap-target-scale.mjs`: **passed**, zero outstanding
  entries; the existing single allowed chrome container is unchanged.
- `node scripts/experience/critical-fixtures.mjs`: **passed** after the scoped
  official refresh.
- `node scripts/experience/validate.mjs`: **passed**, all 81 registry entries
  valid; exactly the three authorized materiality hashes changed.
- Review-materiality and critical-fixture tool self-tests: **passed**.
- Focused ESLint on the invite page and tap-scale gate: **passed**.
- `pnpm typecheck`: final result recorded in `checks.txt`.

Initial typechecking exposed a malformed generated `.next/dev/types/routes.d.ts`
with a duplicated trailing fragment. `next typegen` generated a clean current
`.next/types/routes.d.ts`; only that generated output was copied over the
malformed dev file after the server stopped. No tracked source workaround was
introduced. Recursive generated-directory cleanup was rejected automatically;
the narrower single-file repair preserved the directory.

No heavy build, complete browser suite, baseline update or council certification
was run while Confucius owned the performance-build lane. Receiving integration,
the broader registry and Drive entries remain with their assigned owners.
