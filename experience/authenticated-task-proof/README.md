# Local authenticated Task proof

This source is a default-off adapter and an unlaunched receiving harness for disposable local stores. It makes no production receipt retention or export promise. Whole-store cleanup belongs to the separately admitted runtime.

The route is `/api/internal/local-task-operations`. It independently verifies ordinary Clerk authentication even though internal API routes are outside the proxy's App-page protection matcher. All methods require an admitted development subject, exact issuer and loopback authorized party, and exact Host. Writes require exact Origin. Originless browser GET reads require both same-origin Fetch Metadata and an exact-origin Referer. The caller cannot supply actor identity.

| Method | Operation |
| --- | --- |
| GET | Read a freshly authorized Project Task list; optional `taskId` reads one Task. Only `projectId` and `taskId` query fields are accepted. |
| POST | Create, with exact JSON `{operationId,kind:"create",projectId,taskId,title}`. |
| PATCH | Title-only update, with the same shape and `kind:"title"`. |
| PUT | Read-before-retry reconciliation, carrying the exact operation JSON in its body. Returns immutable original response separately from current Task. |

Task, activity and versioned receipt commit in one immediate transaction. Creation uses canonical transaction-bound column/completion truth and `captureTaskCreated`; the local runtime disables sponsor collection/delivery. The injective global meta key contains actor and operation ID; kind, Project, Task and title are the immutable stored tuple. Fresh membership, archive and deletion checks precede lookup. Changed tuples conflict after the requested target is authorized; foreign or stale Project/Task combinations return a neutral unavailable response before receipt inspection. This namespace is intentionally absent from ordinary production erasure/export; never enable it for production stores.

Source verification:

```text
pnpm install --offline --frozen-lockfile --ignore-scripts
node --import tsx --import ./src/test/register-server-only.mjs --test --test-concurrency=1 src/server/tasks/local-operation-service.test.ts src/server/tasks/local-operation-policy.test.ts src/server/tasks/local-operation-route.test.ts src/server/tasks/create-task-core.test.ts
node --import tsx --test experience/authenticated-task-proof/fixture.test.ts
pnpm typecheck
pnpm build
```

The fixture unit tests use synthetic subjects and five independent disposable databases. Entitlements remains a fresh empty file under the admitted fail-soft read contract. The receiving oracle independently checks its sqlite_schema and table-data hashes before and after App reads. Source tests do not create provider accounts or sessions.

Before receiving execution, the coordinator must issue a private version 1 input binding reviewed source SHA/tree/build ID, exact free `http://127.0.0.1:PORT`, two existing subject/email/Project/Planning Period mappings, each actor's additional control Project/control Task/sibling Task fixture targets, exact development issuer and an observed necessary exact Clerk-origin allowlist, fresh disjoint store and evidence roots, permitted seed/sign-in/read/create/title/restart/cleanup operations, expiry, and qualified test-email code eligibility. Primary and control Projects have disjoint owners; preseeded control Tasks are explicit fixture prerequisites separate from product-created Tasks. Actual identities and credentials stay outside Git. The existing development pair is supplied through the private process environment; no keys are created or rotated. Vercel mode, remote stores, database tokens, demo/review identity and configured external effects fail closed.

Only after that separate grant:

```text
node --import tsx experience/authenticated-task-proof/launch.ts ABSOLUTE_PRIVATE_INPUT_PATH
```

The runner launches an owned headless browser with fresh contexts and normal Clerk email-code UI. It never attaches a browser profile, stored cookies, CDP session or session ticket. The standard development code is conditional on prior eligibility qualification. Both product Tasks exist before reciprocal known-target isolation. Create and title replay, and each changed payload/Task/Project/kind attempt, retain separate denominators and state hashes. Browser requests and server fetches use the exact private Clerk allowlist, with no wildcard subdomains. Expiry is enforced before network requests, Task/activity/receipt writes and response disclosure; an expiry between writes rolls the transaction back.

Server stdout/stderr is capped at 128 KiB and persisted as complete redacted lines while running, retaining diagnostics after a hard child failure. Full keys, session tokens, subjects, emails and privately admitted values are redacted across chunk boundaries before disk writes. Reports contain only private file paths, hashes, byte counts, truncation and native exit metadata; they never quote raw diagnostics.

Recovery intercepts the committed HTTP response before browser delivery, independently checks Task/activity/receipt, stops the owned server, drops the response, closes contexts, restarts the same stores, signs in again, reads before retry and compares the exact response and row counts. Parent custody records actual native PID/parent/creation-time ancestry at server and browser startup. Server stop has a 10-second limit; expiry/interruption requests child cleanup before a 20-second forced stop. Terminal cleanup rechecks creation times before stopping any remaining owned processes and preserves actual stop attempts and remaining native records. Whole-store removal follows verified native process absence and child exit, because Windows SQLite may retain handles beyond `client.close()`. A failed custody or cleanup check stays failed. Exact build-content hashes and checked parent-directory ancestry remain coordinator admission inputs. Source checks do not establish future receiving results.
