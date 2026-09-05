# Event designation foundation — internal milestone, sales held

2026-09-05. Base `8172364e3f7ba8332b4ce7a73ae4563a34b7867c`.
Implementation lane: `feat/january-event-designation`. Principal reserved
`0031_event_purchase_designations.sql` after checking every live App worktree
and origin/main. Allocation is not schema acceptance or production authorization.

## Authority and boundary

The owning policy is `EVENT-ACCESS-CLOSURE.md` in this directory and Studio's
`content/hq/decisions/event-project-funding-2026-09-04.md`. The principal's
2026-09-05 surviving-project erasure instruction requires governing evidence
to survive a former purchaser's account deletion without retaining their identity.
`src/server/account-erasure.ts` explicitly requires erasure to work with SQLite
foreign keys OFF. ADR 0001's project membership and manual-archive rules remain.

This milestone implements designation facts and an internal commercial evaluator.
**It does not implement Event post-term closure.** No route, content, mutation,
Timeline, public/cache or recovery adapter consumes the new evaluator. Existing
personal entitlement readers and role policies are unchanged. Event's real
`EVENT_SELF_SERVE_AVAILABLE` remains false; there is no new environment toggle.

## Durable writer

`src/server/db/event-designation.ts` prepares an immutable, random checkout intent
inside an immediate transaction. The current primary owner, exact project,
membership, existing account-deletion fence and Project deletion journal are
proved before preparation and again before the provider callback. A co-owner's
role alone is insufficient. The provider request receives only its exact intent
in addition to existing billing metadata and uses that intent as idempotency key.
Separate deliberate purchases retain separate intents.

`actions/billing.ts` requires an explicit Event project candidate, with no Event
cookie fallback. The unchanged sales hold refuses before auth or any writer.
The existing URL/UI entry points are not yet a reopening flow: they do not supply
the new explicit Event argument. The test-only compiled action import overrides
availability solely to exercise this otherwise held branch; runtime has no bypass.

`stripe-lifecycle.ts` carries provider-verified checkout intent and paid-charge
time into `stripe-access.ts`. Settlement re-proves primary ownership and lifecycle
fences. Its first outcome, original positive calendar-month expiry and local
purchase commit in the same SQLite transaction. An ownership/membership/archive/
deletion conflict records `paid_undesignated` without a positive local or shared
grant; the actual webhook responds with generic retryable 503. Restoring ownership
later cannot rewrite that historical outcome. A verified refund can resolve the
payment negatively without retroactively designating it.

The existing shared-first positive customer-binding policy is preserved. A shared
binding failure rolls back local positive facts; a local failure after shared
success leaves the original intent pending and is repairable by exact redelivery.
An orphaned mirror is not project authority. Every validated local negative in a
batch commits before a mirror failure can suppress it. Refunds remain monotone
epoch-zero local tombstones plus shared revocation; the separate original positive
term is never overwritten with zero. Customerless history only revokes an exact
existing local reference and never creates a customer binding.

Old sessions with no new intent remain undesignated legacy fulfilment. No historical
row is adopted, inferred, mapped or backfilled. A new intent cannot adopt an already
fulfilled local reference or a payment predating its checkout proof.

## Storage and erasure

0031 is additive: one eleven-column table, two indexes and three triggers. The
unique provider reference prevents rebinding. The write-once trigger protects the
checkout identity, purchaser/project/reference, first settlement outcome, original
positive term and settlement authorization; revocation only increases. The sole
identity-removal transition cannot be reversed or used to change the project/term.

Migration-owned delete triggers operate with foreign keys ON or OFF, so the actual
account/project erasers need no parallel hook or edits. Project deletion removes
its facts. Purchaser deletion removes pending/paid-undesignated rows; a surviving
designated project keeps only its project effect: original term, designated state
and sticky revocation. Purchaser, provider reference, checkout/authorization times
and the checkout intent ID are removed; a new unrelated random row ID replaces
that ID. No old identity hash, customer, provider locator or deletion timestamp is
retained. These are project commercial facts, not an account/audit receipt.

An erased positive fact supplies neither current cover nor a newly asserted archive:
its payment can no longer be verified by this evaluator. It yields
`verification_unavailable` absent independent current cover. A retained negative
cannot become positive or undesignated. A stale shared mirror cannot restore it.
Project deletion removes the remaining effect. This deliberately leaves recovery
for erased-purchaser projects to the later coherent recovery milestone, rather than
fabricating payment authority or retaining identifying payment data.

## Internal evaluation precedence

`src/server/projects/event-project-access.ts::readEventProjectAccessWith` accepts
explicit actor/project and injected local/shared stores; it proves current user,
membership, account and Project deletion state before reading project facts.
It returns a small result with no provider, purchaser or project content payload.

1. Missing/foreign/removed/deleting actor or project: neutral `not_authorized`.
2. No designated evidence: `unknown` with distinct no-designation, checkout-pending
   or paid-undesignated reason. This is not permission to infer historical locks.
3. Applicable valid current-primary-owner account cover, or valid explicit project
   cover, permits editing commercially. Other members' personal account grants and
   other-project grants do not. Existing role/manual-archive checks remain required.
4. With no current cover, unavailable shared verification, orphan purchase mirrors,
   missing/conflicting recorded evidence or erased positive provenance yield
   `verification_unavailable`, never unmanaged/Free authority. Independent valid
   current cover still applies despite unrelated incomplete purchase evidence.
5. Otherwise an independently completed, unrefunded designated positive term
   supplies `read_only`; refund of a different purchase does not erase that term.
6. Otherwise all governing purchases revoked yield `unavailable: refunded`.
   Epoch zero never supplies archive rights. Exact natural expiry is inclusive.

These results are commercial input only. Future adapters must preserve the
difference between unknown history and unavailable verification of known history,
and must implement owner recovery before enforcing any denial.

## Validation and integration

Principal owns package/default registration. Add both files to a mandatory serial
command (or append to the billing gate), without changing its existing tests:

```sh
node --import tsx --import ./src/test/register-server-only.mjs --test --test-concurrency=1 src/server/db/event-designation.test.ts src/server/db/event-designation-webhook.test.ts
pnpm test:billing
pnpm db:contract
node --test src/server/tenant-scope.test.mjs src/server/tenant-scope-rules.test.mjs src/server/stripe-contract.test.mjs
node scripts/check-ambient-workspace-ratchet.mjs
pnpm typecheck
```

The Event suite has 36 real SQLite/action/webhook tests. It includes FK-on/off
actual account erasure after transfer, sticky refund and immutable-term SQL probes,
concurrent exact settlement, ownership change between checkout transactions and
at settlement, deletion fences, independent covers, original term, shared/local
failure, customer conflict, customerless refund and paid-undesignated 503/retry.
HTTP signature checking uses the real Stripe SDK with synthetic local keys; provider
retrieval is a stub and network fetch is forbidden. The two test files share fixtures
but use separate Node test processes. This retains all assertions after two Windows
monolithic runs passed their assertions then exited with native status 3221225477.
Those failed gate outputs are retained; the split does not assert their root cause.

The migration adds twelve receipt proofs and extends the existing mandatory
`db:contract` suite with populated-history, forced-proof rollback, exact-ledger and
Drizzle-high-water rollback, retry and no-op checks. The tenant table is registered
in the existing governed list; scanner logic is unchanged. Real runtime readers
keep exact scope predicates; only synthetic whole-fixture assertions have comments
explaining their deliberate all-row reads.

**Migration before writer code:** even legacy Event webhook reconciliation reads
the new table. Sales being held is not a substitute for applying the migration.
The checked-in migration receipt authorizes local/CI tests only. Follow
`drizzle/MIGRATIONS.md` and `DEPLOY.md` for any later authorized target execution.
An empty-table local rollback is tested; once facts exist, preserve them and use a
reviewed forward repair. Never discard payment or reconciliation facts to roll back.

Exact commit, source hashes, command exits and retained outputs accompany the
projectless `outputs/event-designation-milestone-2026-09-05` handoff.

## Remaining closure

No historical operator designation, production migration, real provider observation,
receiving CI, browser/human comprehension, independent security approval or council
certification is claimed. Account export of these new private checkout facts,
owner recovery for refunded/erased-purchaser projects, private/mutation/attachment
read adapters, Timeline/public/metadata/cache denial, consistent rendered states,
and the explicit-project checkout UI remain subsequent work. Event sales stay held
through that coherent closure and receiving acceptance.
