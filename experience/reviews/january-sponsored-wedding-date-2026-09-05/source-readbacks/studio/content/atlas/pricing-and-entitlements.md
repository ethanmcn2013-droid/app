---
title: Pricing, payment evidence and access
slug: pricing-and-entitlements
lens: Products
owner: Ethan
lastVerified: 2026-09-05
links: [signal-studio-umbrella, five-products-as-a-system, pricing-and-entitlements]
tags: [January 2027, Notes, Tasks, Timeline, Home]
references: [content/hq/decisions/three-products-home.md, docs/execution/january-2027/PROGRAMME.md, contracts/commercial-terms.v2.json]
summary: Canonical offers, payment, fulfilment, redemption and useful activity are distinct states.
status: partial
pinned: false
execWhat: Canonical offers, payment, fulfilment, redemption and useful activity are distinct states.
execMatters: Current source and internal candidate evidence guide the January programme.
execRisk: Candidate code, synthetic evidence and intended policy must not be mistaken for production or customer proof.
---

## Offer and measurement truth

Canonical policy: contracts/commercial-terms.v2.json and the January launch decision. Venue Edition is €1,500 annually; Founding 25 is €1,000 annually under its continuous-renewal terms. Both prices are VAT-inclusive. A founding number follows cleared-payment evidence. Policy is not proof that a provider charged or settled a payment.

The remaining consumer ladder must be read from the contract, not copied from historical Atlas prices. Student eligibility must be enforced before new Student sales. Event remains outside the umbrella ladder; its approved €89 and twelve-calendar-month terms are intended policy with implementation required, not verified archive behavior. New Event sales are unavailable until project access closure.

Studio 27016169 excludes plan labels, legacy paidAt rows and mismatched records from paid proof. A positive operator-attested venue_payment receipt must match the current financial row. Synthetic two-receipt rehearsal produced €2,500; that is fixture evidence, not actual revenue or independently observed provider settlement. See docs/execution/january-2027/HQ_TRUTH_REPAIR.md.

Payment, fulfilment, redemption, useful couple activity and repeated use have separate owners and evidence. Small-cohort privacy suppression remains applicable; one venue payment does not authorize identifying a couple’s behavior.

## How access is obtained

This table explains current source behavior and internal rehearsal paths. It
does not claim that paid access is deployed or commercially open. The date
21 January 2027 is a target with separate manual user-launch and outreach gates.

| Offer / surface | Current route | Boundary before a customer promise |
|---|---|---|
| Free | Studio pricing → Free waitlist | €0; one workspace and three editing guests. A waitlist entry is not activation. |
| Pro | Studio pricing → Pro waitlist. Configured App checkout uses internal tier `workspace`; Settings starts monthly checkout. | €12/month or €120/year when paid access opens. Unlimited workspaces; editing guest limit remains unpublished. The annual checkout route requires its actual annual Price and never substitutes monthly billing. Checkout uses the authorised current project; do not assume it funds another project's resources. |
| Student | Studio waitlist; App's Student request remains unavailable | €9.99/year is retained policy, three workspaces/three editing guests. New access needs verified eligibility and annual re-verification; email suffix alone is not enough. |
| Enterprise / Schools | Founder conversation / manually quoted school pilot | No new public numeric price, seats or support commitment is implied. |
| Venue / Founding 25 | Retained cleared-payment evidence → exact payment recording → same-request allocation/delivery/readback → private packet → original-account claim | €1,500/€1,000 annually, prepaid and VAT-inclusive. Number assignment follows payment. A payment record, allocated code or successful HTTP response alone does not make a packet ready. |
| Explicit venue pilot | Current limited pilot term, positive allotment and retained opaque exception reference → the same fulfilment/readback path | A recorded exception, not a general free trial or a shortcut around a paid agreement. Do not promise an unrecorded pilot duration or quantity. |
| Event | New checkout is held in both App entry points and Settings; existing settlement/refund recovery remains | €89 once and twelve-month/read-only/refund-revoked terms remain intended policy. Full access closure and historical reconciliation are separate acceptance work. |

Owning sources: Studio `contracts/commercial-terms.v2.json`, `src/app/pricing/page.tsx`,
[payment guide](../../docs/guides/venue-payment.md) and
[fulfilment guide](../../docs/guides/venue-fulfilment.md); App
`src/components/app/settings/sections/billing.tsx`, `src/server/actions/billing.ts`,
`src/app/api/checkout/route.ts` and `src/server/actions/comp.ts`.
Keep Pro as the public name without changing the internal `workspace` identifier.
The sponsored term retains the 548-day floor and wedding-date-plus-90-day rule;
the capture/update journey is still open in ACCEPTANCE. Arithmetic is not proof
that a customer can update a date successfully.

## Evidence and measurement source map

| Observation | Required source / distinction |
|---|---|
| Planned outreach | Existing CRM/campaign plan. A created date or planned touch is not permission or a send. |
| Authorised launch / outreach | Two separate completed decision records in `content/hq/operator-todos/january-2027-go-no-go.md`, with exact release/draft/evidence references. |
| Actual send / reply / conversation | Retained actual touch or response evidence in the existing private outreach record. A send is not receipt, reading, a reply or a booked conversation. |
| Venue paid | Current financial row matches the positive operator-attested `venue_payment` receipt. Signature, invoice and legacy `paidAt` alone are excluded. This is not independent provider settlement verification. |
| Access ready / distributed | Exact fulfilled readback and private packet preparation; actual handoff is a further fact. Allocation is not handoff, and neither is redemption. |
| Redeemed | Original claim and intended project/term. Access and seeded starter tasks do not prove useful activity. |
| First useful action | A deliberate committed Tasks creation with verified attribution and delivery. The local rehearsal seeds 18 tasks with zero usage, then one deliberate task produces an event. Those are fixture observations, not users. |
| Repeat use | Further observed qualifying actions in the defined reporting window. Tasks-only coverage cannot stand for Notes/Timeline use or complete day-30 retention. |

The implementation and reporting definitions live in
`docs/account/TASKS_USAGE_DELIVERY.md` and `docs/account/PRODUCT_CONTRACT.md`.
Capture defaults off. Every operational report needs its definition, period,
data-through time and coverage state. Missing days are not zeros; incomplete
coverage is a lower bound; suppressed/unavailable results carry no hidden count.
Small-cohort suppression also removes observed days/modules. Synthetic revenue,
page views, seeded tasks and redemption cannot establish demand.

The older `E09.04-outreach-measurement.md` is retained historical design evidence.
Its `isPaidVenue({ venuePlan, paidAt })` definition and blanket “not instrumented”
statement are superseded by this source map and the current receipt/reporting
readers. Do not rewrite the historical receipt or make a new activation dashboard.

## Proposed first-send receipt contract

**Proposal only, delegated 2026-09-05.** No clock reader, schema, automation or
send is added by this package. `src/lib/hq/commercial-clock.ts` stays unchanged
and inert. The smallest future connection is a read-only, nullable projection
from a retained entry in the existing private outreach record, not a new event
table or a CRM creation timestamp.

The retained entry needs: stable receipt ID, existing campaign ID, actual send
time in UTC, named operator, opaque recipient/batch reference, exact selected
draft revision/digest, Studio/App release revisions, references to both manual
decisions, and opaque evidence of the actual accepted send. Keep addresses,
message bodies and provider payloads out of the HQ projection. Store drafts and
permissions separately from observations; an authorised-but-unsent record is
not a first-send receipt.

A future reader must verify the referenced decisions cover that exact target,
draft and batch, the send was on/after 21 January 2027 and after authorisation,
and the evidence records an actual send. Select the earliest verified send for
that campaign; deduplicate its receipt ID. Missing, conflicting, withdrawn or
unreadable evidence returns no start and requires reconciliation. A correction
must retain the original history and reason. No silent fallback to a date,
payment, local test or CRM row. “Accepted send” does not mean delivered/read.

The principal owns that future reader; the founder owns the manual decisions
and retained actual-send evidence. Derive later experiment windows only from
the applicable recorded experiment rules. The proposal does not choose a new
duration or success threshold. Before adding persistent storage or automation,
report the concrete proposal and scope for review. No such addition is needed
to prepare the launch packet now.

## Runtime and failure boundaries

App owns Stripe checkout and signed webhook reconciliation. Candidate fc40f4ef reads current subscription and exact paid-invoice truth, tracks one-time Event terms, binds portal customers to the actor, and retains failed shared updates for retry. Independent security review identified recovery edges being repaired; this is not provider acceptance.

App 254cccc6 scopes grants before ranking, prevents an Event purchase in A from supplying paid storage in B, and honors local purchase revocation against its stale shared mirror. Independent valid grants and known historical account grants remain usable. Shared inventory and local raw export are not authorization results. Personal Pro benefits are distinct from another project’s resource tier.

App a10432dd implements the accepted Event new-session hold in both checkout entry points and Settings. Existing settlement/refund recovery remains active. This candidate record does not verify deployed checkout, provider payment links or previously created sessions. The delegated owner-controlled policy and exact private/public/Timeline/cache closure boundary are indexed in `content/hq/decisions/event-project-funding-2026-09-04.md`; historical reference reconciliation is open in `content/hq/operator-todos/event-historical-purchase-reconciliation.md`. No retrospective project locks or paid archive claims follow from unknown designation.

Studio owns operator fulfilment and the shared sponsor/receipt boundary. Both repositories now verify matching contract consumers and canonical access-term vectors; the App candidate adds 0731ab91, Studio adds 004f9c9. The receiving App release must contain these contracts before Studio’s paired CI can pass.

## Open acceptance

Stripe connector reauthentication and designated test-mode account identity are missing. No real renewal, refund, cancellation or customer portal rehearsal is claimed. Event post-term read-only behavior and the sponsored wedding-date capture/update path need product verification. Selecting a paid plan, redeeming a code or loading a board cannot close these gaps.

January's experiment clock stays inert until actual authorized first-outreach evidence. Commercial opening remains held until 21 January 2027 and the separate release/outreach decisions.

## Provenance

The previous entry is preserved in docs/execution/january-2027/history/pricing-and-entitlements-before-20260904.md and Git 004f9c9. Its older topology, prices and readiness claims are superseded here. Status is partial because final integrated and provider acceptance remains open.
