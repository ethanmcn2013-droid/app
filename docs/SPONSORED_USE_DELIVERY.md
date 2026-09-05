# Tasks-first sponsored-use delivery

This bounded internal slice captures only deliberate `addTaskAction` calls. Task, activity and specialized delivery intent commit in one SQLite transaction. Current actor task capability, Project archive/deletion and actor/owner account-deletion fences are checked in that transaction. Venue setup still requires the separate core `manageProject` boundary (`2df8cfd6`); integrate this slice on top of that boundary. No template, Notes, Timeline, task completion or automatic action is newly measured.

Capture requires `SPONSOR_USAGE_EVENTS=1`, an App-only `SPONSOR_USAGE_HASH_SALT` of at least16 characters, and exactly one active actor/Project canonical Venue claim. Ambiguous, historical noncanonical or unrelated comp grants are not collected. The salt must be random deployment material; fixtures use synthetic values. No credentials are needed for local acceptance.

The event has exactly seven existing fields: `eventId`, `instrumentationVersion`, `product`, `kind`, `occurredAt`, `subjectIdHash`, `workspaceIdHash`. Its UUID is independent of task identity; time is rounded down to the minute. Hash input is actual Clerk identity and exact Project ID. Raw identities, task content and bearer codes are absent from the transport. The private queue keeps an entitlement reference and an account-erasure hash. Canonical proof separately carries code fingerprint and issuance/interval/epoch identifiers, never bearer code or venue display data.

`POST /api/cron/sponsored-use` requires `CRON_SECRET` and drains at most50 intents using `SPONSOR_USAGE_STUDIO_ORIGIN`. No provider runs inside a database transaction. Unknown/failed delivery remains pending; exact replay dedupes at Studio. Hard raw retention is35 days, including undelivered events; older lost coverage stays missing. Pending erasure controls are retained until acknowledged. Account-to-epoch erasure links expire after24 months. Existing actual account-deletion entry points establish their fence before creating pseudonymous erasure controls; a local failure leaves the fence and prevents later deletion work from starting.

`POST /api/internal/sponsored-use/provenance` authorizes only usage-purpose HMAC requests. Input is `{eventId}` or `{issuanceId,cursor:"0"}`. The latter returns an entire immutable issuance's at-most25 one-use claims in one transaction; larger or ambiguous populations fail, never masquerade as complete pages. It verifies the canonical local receipt/code, exact actor/Project/grant interval, current membership and deletion fences. Optional `SPONSOR_USAGE_PREVIOUS_SALTS_JSON` retains explicit old App-only salts for35-day repair; the receipt keeps its original salt epoch.

Both services need distinct random `SPONSOR_USAGE_SERVICE_SECRET` and `VENUE_ISSUANCE_SECRET`; equal values are refused. Usage HMAC includes purpose `usage.v1`, POST, exact pathname, timestamp, salt epoch and exact body digest. Request size is16KiB and skew is5 minutes. Usage credentials cannot enter issuance. Origins are trusted operator configuration; redirects are refused. No broad App database credential is given to Studio.

Migration `0030_sponsored_use_intents` adds only this queue and erasure link, registered in the existing App ledger with a local-only receipt. Apply it before this runtime, including when capture is off: deletion hooks use its tables. The migration tests cover fresh application, no-op, semantic ledger checks and rollback of both new tables/receipt after a failing postcondition. Production migration/deployment remains unauthorized in this task.

## Local verification and registration

Delivery retires event or erasure custody only after an unredirected HTTP200 `application/json` response containing exactly `{ "ok": true }` (JSON whitespace allowed). The response is streamed with a256-byte bound and a5-second body deadline; extra/duplicate keys, non-JSON, incomplete streams and other2xx responses remain pending. No remote body is logged or persisted. This is defensive transport hardening; no attacker path through the real Studio handler was demonstrated. The two current Studio handlers already return this acknowledgement after their transaction succeeds.

Run on the pinned installed dependencies with Node24. These commands use disposable local SQLite and synthetic Request transport:

```sh
node --test src/server/sponsored-use/action.test.cjs src/server/sponsored-use/provenance.test.cjs scripts/db/migration-ledger.test.mjs
node node_modules/tsx/dist/cli.mjs --import ./src/test/register-server-only.mjs --test src/lib/sponsored-use/service-auth.test.ts src/server/venue-issuance/canonical.test.ts src/server/account-deletion-lifecycle.test.ts
node scripts/sponsored-use/acceptance.cjs --studio-root /path/to/matching/studio-checkout
node node_modules/typescript/bin/tsc --noEmit --incremental false
```

Lead-owned package/workflow registration must append the two new CJS suites and auth suite to the default Linux gate, retain the existing migration/canonical/account lifecycle suites, and run paired acceptance with both matching checkouts. Schedule the authenticated App POST delivery worker; no Vercel or workflow changes were made here. Collection flags remain off by default. Authenticated maintenance still expires retained data and delivers pending erasures while collection is off; it does not deliver new positive events. Keep maintenance scheduled through any rollback until pending erasures are acknowledged. Paired acceptance is server behavior, not browser, human-comprehension or real-provider verification. Studio usage projection and final combined security acceptance are separate required evidence.
