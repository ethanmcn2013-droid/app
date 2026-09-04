# January billing boundary repair

Current follow-up: [Event delegated policy and sales hold](EVENT-ACCESS-CLOSURE.md).
New Event sessions are held pending coherent project/public access enforcement.
Earlier receipts below are retained history; the visible Event offer and archive
promise described there are superseded. Existing settlement/refund recovery stays
active. S2 Commercial remains partial.

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

No live Stripe or Google account, payment, production database, customer record or email was touched. The provider test-mode end-to-end rehearsal remains open. Event's post-term read-only behaviour needs a journey receipt; the term calculation alone does not establish it.

## Recurring lifecycle and identity follow-up

The January follow-up replaces the arbitrary 30-day subscription bootstrap and
obsolete top-level period field with paid invoice lines tied to the same customer,
subscription and item. Current subscription state is retrieved on every delivery.
An unpaid period cannot extend access. Cancellation also retires the historical
checkout grant for that exact subscription. Refund events re-read one-time payment
truth; refunded Event access is revoked. Any refunded amount currently revokes the
one-time access, following the retained contract's `refundAccess: revoked` rule.
Mixed-plan subscriptions, paginated invoices and ambiguous historical customer
bindings fail visibly for reconciliation; they are not guessed.

The existing local expiry column stores Unix epoch zero as a permanent provider
revocation marker. Shared rows use their existing `revoked` status. Atomic writes
preserve the longest verified subscription term while preventing any later retry
from undoing revocation. Local truth commits before the shared mirror. A second
transaction rechecks the account-erasure fence and holds it through that mirror;
an erased account cannot be recreated between the two phases. The existing Drive
fence and file-backed test helper are reused byte-for-byte from `7d4040cb`.
There is no new database schema or claim of a distributed transaction.

New checkout and portal flows use the customer ID bound by a verified payment in
the shared ledger. Email matches no longer confer billing authority. A missing
historical binding needs reconciliation against the receipt. Student `.edu`
auto-grants and email-only Student code minting are removed; existing grants and
issued codes retain their original terms. Student Edition remains unavailable
until the paid eligibility system required by the commercial contract is live.

Fifteen billing tests passed, including real SQLite writes to both ledgers,
concurrent/stale renewal, failed mirror, cancellation before initial fulfilment,
refund, wrong ownership, ambiguous customer identity, erased account and removed
project membership. Transaction tests use disposable file-backed SQLite in WAL
mode because the installed libSQL client reconnects after an interactive
transaction against `:memory:`. Lock contention has bounded, idempotent retries;
other failures return a sanitized retryable response without provider payloads.
Provider request/response fixtures establish handler behavior, not live Stripe
acceptance. Final receiving-branch gates and independent security review remain
required for this follow-up.

The separate shell repair `4ce64077` reproduced the earlier hydration error as a
server/browser date-locale mismatch and passed two locale/timezone browser checks.
The final combined candidate still needs its own visual and performance receipt.

Official provider references retrieved 2026-09-04:
- [Checkout session parameters](https://docs.stripe.com/api/checkout/sessions/create)
- [Checkout fulfilment](https://docs.stripe.com/checkout/fulfillment)
- [Subscription webhooks](https://docs.stripe.com/billing/subscriptions/webhooks)
- [Refund lifecycle](https://docs.stripe.com/refunds)

The installed Stripe SDK/API pair was preserved with the approved dependency-security baseline. A provider upgrade is a separate verified maintenance change, not a prerequisite for correcting these existing checkout boundaries.
