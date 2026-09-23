# Event availability render receipt

Observed 2026-09-04, approximately 21:28–21:31 UTC. Local internal review only.

Source: `fix/january-event-availability`, base
`3d8a36e14b1fb58142cb898b6115ad7bf404a36e`, with the Event availability change
uncommitted at capture. Relevant UI source:
`src/components/app/settings/sections/billing.tsx` and
`src/lib/billing-availability.ts`. No subsequent UI edit before handoff.

Worktree:
`C:/Users/ethan/signal-studio-workspace/worktrees/app/fix-january-event-availability`.
Started with `pnpm dev --hostname 127.0.0.1 --port 4352`, explicit
`SIGNAL_ACCESS_MODE=review`, `NEXT_PUBLIC_SIGNAL_ACCESS_MODE=review`,
`NEXT_PUBLIC_SIGNAL_DEPLOYMENT_ENV=preview`, `NEXT_TELEMETRY_DISABLED=1`.
No environment file or credentials copied. Dependency installation used
`pnpm install --frozen-lockfile`; package and lockfile unchanged.
Launch session: `51601`. Preview stopped at handoff; restart with the same command
and review variables for further inspection. No full build was run.

## Direct observations

- `/app/settings` returned 200. Opened Billing in the actual Next page, with the
  existing synthetic Free review account. Review keeps purchase/redemption
  controls disabled.
- At 1440×1000 the comparison has two filled columns: Free and Workspace. There
  is no Event offer, empty third column, or archive promise. See
  `billing-desktop.png`.
- At 390×844 the cards stack and retain their contents. The document scroll width
  and viewport width both measured 390px. See `billing-mobile.png` and the lower
  offer view in `billing-mobile-offers.png`. Settings uses an internal vertical
  scroller and horizontal section navigation.
- Keyboard Tab from Storage reached Billing (`07Billing` as active element),
  with a computed solid 2px focus outline. Enter displayed the billing heading.
  The temporary viewport override was reset after capture.
- Actual local `GET /api/checkout?tier=event&interval=annual` returned 503,
  `Cache-Control: no-store`, and
  `{"error":"New Event purchases are currently unavailable.","code":"plan_unavailable","tier":"event"}`.
- The actual BillingSection additionally rendered under React server rendering
  for Free and current Event in the executable billing suite. Event holders retain
  their plan and Manage billing, and no perpetual archive claim. That is component
  evidence, not a browser receipt for a live paid account.

## Runtime findings and limits

Chrome reported one React hydration attribute warning. Its diff identifies a
browser-injected `<style id="stndz-general-13">` where RootLayout expected the
theme style. The raw warning is retained in `browser-console.json`; the captured
screens show the development issue badge. This is evidence of an extension-style
collision, not evidence that a shared-layout patch is needed in this task. No
browser extension or shared layout was modified. There were no additional
warn/error entries in the captured console. No clean-browser hydration claim is
made, and this is not council acceptance or human comprehension verification.

The current paid Event UI was not rendered in a browser against a real account.
Live Clerk, Stripe checkout/portal, provider lifecycle, public artifact denial,
archive behavior, and production state remain unverified. Network verification
here is limited to the local HTTP responses and captured console; no broader
provider/network trace is claimed. No registry baselines were refreshed.

## Executable gates

- `pnpm test:billing`: **40/40**, including five new runtime/render tests. Tests
  use disposable SQLite and synthetic provider responses only. They cover closed
  Event entry points, unaffected annual Workspace checkout with the real account
  fence, settlement/refund and failed-mirror retry for pre-existing Event sessions,
  and current-holder UI. Prior entitlement/Notes/recovery coverage remains green.
- `node --test src/server/stripe-contract.test.mjs`: **4/4** structural boundary
  checks, reported separately from behavioral evidence.
- Full `pnpm typecheck` and focused ESLint: passed on the final code/test state.

Policy and reopening scope are in
`docs/execution/january-2027/EVENT-ACCESS-CLOSURE.md`. This receipt accepts the
bounded sales hold and records its visual limitations; it does not accept the
still-unimplemented Event project access lifecycle.
