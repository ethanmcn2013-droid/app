# Event: delegated policy, new sales held

2026-09-04. January candidate base `3d8a36e14b1fb58142cb898b6115ad7bf404a36e`.
Implementation owner: commercial agent. Programme integration and Studio source
sync: principal integrator. S2 Commercial remains **partial**.

## Decision and authority

The principal's delegated product decision adopts an **owner-controlled project
plan for new Event purchases**. The accepted January programme delegates material
product decisions; this is not a new founder selection or an approval checkpoint.
It resolves the designation ambiguity recorded in investigation commit
`027612d8677e9c60442a4e3fde1ea9e82d1b5098` and its
`EVENT-POST-WINDOW-DECISION.md`. That investigation's findings remain valid.

The retained canonical Studio `contracts/commercial-terms.v2.json` and its App
copy agree on €89 once, twelve calendar months, `postWindow: read_only`, and
`refundAccess: revoked`. Those are the target terms, not proof of enforcement.
No venue pricing, Student eligibility, Pro scope or standalone Notes policy is
changed here.

The settled policy is:

- A new purchase requires the **current primary owner** at checkout and verified
  settlement. Its designation must immutably bind the verified purchase reference,
  purchaser and project. A later owner lookup cannot establish historical purchase
  authority. A co-owner or ordinary member's personal purchase cannot designate or
  lock everybody else's project.
- Existing membership and role checks remain required. An entitlement never
  creates membership. A current primary owner's applicable valid account grant,
  or an explicit valid project-covering grant, can keep the shared project
  editable. Another member's personal account benefits cannot upgrade everybody.
  Preserve legitimate Studio, venue and legacy grants with explicit scope.
- A completed designated Event with a positive natural expiry and no refund can
  preserve a read-only archive. An independent qualifying completed purchase
  survives the refund of a different purchase. Epoch zero is permanent revocation,
  never natural expiry and never archive evidence.
- Refund of the sole governing grant denies project content and public artifacts.
  Preserve OWNER export/deletion and narrow security-revocation controls, subject
  to their existing role authority. A separate valid covering grant still applies.
- Unknown or historical designation must not silently introduce retrospective
  locks. Record an operator reconciliation item and do not advertise an archive
  until the purchase designation and access behavior have been verified.
- Standalone Notes remains personal. Do not attach project expiry/refund locks to
  personal captures or replace the separate personal-feature allowance policy.

## Implemented boundary: hold new sessions

The explicitly authorized fallback is used. Event's existing Settings `selfServe`
switch is now the shared `EVENT_SELF_SERVE_AVAILABLE = false` in
`src/lib/billing-availability.ts`; both checkout entry points consume it. There was
no server-enforced Event availability flag in the requested base. No environment
toggle or separate provider state has been introduced.

The direct Server Action refuses Event before auth, billing writes, or session
creation. `GET /api/checkout?tier=event` returns 503 `plan_unavailable`, with no
sign-in/onboarding loop, including review mode and annual query variants. Settings
omits Event from available offers; a current Event holder still sees their plan
and billing controls, without the unverified “reads forever” archive promise.

This only prevents new sessions created by this candidate. Existing provider
sessions, payment links, deployed revisions and provider settings have not been
inventoried or changed. Previously created sessions still settle/refund through
the existing verified lifecycle and remain **undesignated history** for project
archive policy. The hold does not reject an already-paid customer's fulfilment,
erase a grant, or reinterpret a refund as an archive.

There is no new designation writer, project lock, migration or provider action in
this change. Billing recovery `07a9de41` and scope reader `254cccc6` are preserved.
The account-deletion checkout test uses available Workspace checkout so it still
reaches and tests the real billing fence; it is not satisfied by the Event hold.

## Exact technical closure boundary

A mutation-only `project-authz.ts` patch cannot meet the settled policy. The
following paths must share the governing-project decision before Event reopens:

| Surface / authority | Evidence in this base | Required closure |
| --- | --- | --- |
| Purchase designation | `actions/billing.ts` proves `createOrEditTasks`; `stripe-access.ts` proves membership, and writes a shared customer binding before the first local grant under the account-deletion transaction. Neither records owner-at-checkout/settlement designation. | Prove primary ownership at both stages; commit an immutable ref/purchaser/project designation with the local settlement under the project/account mutation fence. Preserve shared binding, permanent revocation, replay and deletion recovery. Existing `meta` is possible only with that integrity, not a parallel mutable flag. |
| Tasks mutations and capabilities | `actions/project-authz.ts` uses roles and `archivedAt`; `projects/resolve.ts` independently supplies route/UI capabilities. The prior ten SQLite characterizations exercised real task/comment/resource writes after expiry/refund. | One access result distinct from manual archive and never-paid Free; authorize actual object project IDs, then project the same result to UI. Do not use `archivedAt` as a paid-term lock that Restore can undo. |
| Private project reads and bytes | `db/queries.ts` has direct project reads; `api/attachments/[id]/route.ts` separately proves attachment-project membership before streaming. Other product data adapters read their bound project. | Inventory and gate content at the actual read/stream seams; keep owner export on an explicit separate authorized path. Avoid treating an empty query result as authority. |
| Tasks public board and images | `getPublishedWorkspaceBySlug` checks `publishedAt`, then reads tasks. `/p/[slug]` uses 60-second ISR; public OG and share-card surfaces have separate rendering paths. | Deny refunded content, metadata and images; settle cache invalidation/staleness under refund and changing covering grants, not only on explicit unpublish. |
| Tasks bearer links | `db/share-link-resolver.ts` checks the secret and manual archive; `getShareLink` checks token expiry/revocation before reading tasks. | Add governing-project read authority without granting membership or reviving revoked tokens. |
| Timeline curation / public output | `archived-project-policy.ts` reads manual archive state; `audience-timeline.ts` resolves independently stored publications/tokens, reached by `/s/[token]`. | Follow the verified Tasks binding for curation, private reads, frozen/public artifacts and metadata. Classify unknown historical bindings; retain narrow revoke/unpublish controls. |
| Honest UI and recovery | Settings, Tasks/Hybrid actions and Timeline have separate capability consumers; the prior real route snapshot continued to advertise editing after expiry/refund. | Show editable/read-only/unavailable consistently, permit reading an archive, and preserve owner export/deletion and security controls after refund. Test actual routes and actions, not only a tier badge. |

This crosses independent public/read and cache boundaries beyond the bounded
helper/authz slice. Shipping a designation or a central mutation lock alone would
leave the refund read-denial promise false and could lock a project without its
required export/deletion recovery. New sales stay held until this coherent slice
has observed tests and rendered UI evidence. Reopening is an implementation gate,
not another routine product-approval gate.

## Operator reconciliation and receiving work

OPEN: inventory existing Event references and already-created provider sessions
using verified payment records. Record purchaser/project/owner-at-purchase evidence,
positive natural expiry versus epoch revocation, independent covering grants, and
bound/public artifacts. Do not infer designation from today's owner or apply a bulk
historical lock. No external inventory has been run in this task.

Before reopening, exercise two projects and primary/co-owner/member/outsider roles;
checkout-to-settlement owner transfer; duplicate/concurrent/refund-first deliveries;
local/shared failures; two independent Event terms with one refund; current-owner
account coverage versus member-only coverage; missing/unknown designation;
authenticated reads, mutation denial, public/OG/cache denial; owner export/deletion
and token revocation; and unchanged standalone Notes. Use real disposable stores
and actual entry points. Provider test-mode rehearsal remains separate and open.

Lead-owned Studio sync: record this delegated decision, the new-sales hold and
historical reconciliation item in the January programme/contradiction ledger and
commercial source. Change Event's implementation status from an unqualified
`verified` to policy accepted / implementation incomplete, retaining the terms.
Update Studio's Event offer availability and archive copy, then generate/copy the
cross-repo machine contract normally. This task does not edit generated terms or
Studio ownership lanes. January 21 user release/first outreach and production
holds remain unchanged.

Focused validation and local render receipts accompany the implementation handoff.
No production database, provider, email, deployment, push or merge is performed.
