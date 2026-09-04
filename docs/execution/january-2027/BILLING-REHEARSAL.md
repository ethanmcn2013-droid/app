# January billing boundary repair

Observed locally on 2026-09-04. Owner: January principal integrator.
Branch: `fix/january-checkout`, base `31c6646c`.

## Implemented

- Event selects a one-time Checkout session. Its settled payment grants twelve calendar months, including leap-day clamping.
- An unpaid completed session cannot grant access; delayed successful payments share the settled path.
- Missing Stripe configuration cannot grant a paid tier through either the page action or the checkout route.
- Entitlement insertion and expiry are internal server helpers, outside the client-callable action module.
- Local and shared entitlement inserts use stable primary keys for concurrent provider retries. Historical local rows retain their original expiry. Failed shared fulfilment is visibly pending in operational state and returns a retryable failure.
- Settings no longer claims cancellation after expiring a development marker. Manage billing opens the existing provider portal; provider cancellation and renewal require their separate lifecycle rehearsal.
- Review mode refuses billing portal and webhook provider activity.

## Evidence and limits

`pnpm test:billing`: five tests passed against disposable in-memory SQLite, including concurrent inserts and retry after a shared write fails. `stripe-contract.test.mjs`: four boundary checks passed. Tenant/demo and operational-log contracts passed. Typecheck and focused ESLint passed. The full Next production build passed in explicit review mode without copied credentials.

The built settings page was inspected at 1440×1000 and 390×844. No horizontal page overflow at 390px. Review controls remained inert and the Event offer was visible. This is the existing free-account review fixture, not a paid-account or live Stripe session. The initial page load produced React hydration error 418; it remains a suite defect to reproduce and repair before visual acceptance. Existing build tracing also warns about the account-erasure import of Next configuration. These findings are not waived by a successful build.

No live Stripe or Google account, payment, production database, customer record or email was touched. The provider test-mode end-to-end rehearsal remains open. Recurring subscription period renewal, cancellation, refund/revocation and provider-customer identity require their own verified lifecycle coverage before commercial readiness. Event's post-term read-only behaviour needs a journey receipt; the term calculation alone does not establish it.

Official provider references retrieved 2026-09-04:
- [Checkout session parameters](https://docs.stripe.com/api/checkout/sessions/create)
- [Checkout fulfilment](https://docs.stripe.com/checkout/fulfillment)

The installed Stripe SDK/API pair was preserved with the approved dependency-security baseline. A provider upgrade is a separate verified maintenance change, not a prerequisite for correcting these existing checkout boundaries.
