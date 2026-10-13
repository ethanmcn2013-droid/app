# Local authenticated Task proof

This source is a default-off adapter and a receiving harness for disposable local stores. It makes no production receipt retention or export promise. Whole-store cleanup belongs to the separately admitted runtime.

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
# Readiness correction after the preserved attempt01 failure

Private qualified builds must explicitly set `SIGNAL_LOCAL_TASK_PROOF_BUILD=true`,
`NODE_ENV=production`, both `SIGNAL_ACCESS_MODE=production` and
`NEXT_PUBLIC_SIGNAL_ACCESS_MODE=production`, and the exact admitted
`SIGNAL_LOCAL_TASK_ORIGIN=http://127.0.0.1:<port>`. No VERCEL/VERCEL_ENV or demo
posture is allowed. Runtime uses the existing `SIGNAL_LOCAL_TASK_OPERATIONS=true`
and exact same origin/access posture. The build marker supplies no runtime
operation authority or identity configuration.

Installed Next16.3.6 `build/define-env.js` inlines
`__NEXT_NO_MIDDLEWARE_URL_NORMALIZE` from `skipProxyUrlNormalize`; setting the
runtime config alone cannot repair an already-built Proxy. `next-server.js`
also reads the setting when choosing the original initURL at runtime. Root must
therefore review, rebuild and privately qualify a fresh artifact before another
finite grant. Default production config keeps the flag absent. Ordinary Clerk
middleware/auth and exact Host/Origin/issuer/actor checks remain required.

Readiness now has one 30s overall deadline, 2s maximum per request bounded by the
remaining grant/deadline, manual redirects, body cancellation and early child
exit checks. Only `/sign-in` HTTP200 without Location is ready. Private facts
contain finite attempt times/statuses, redirect origin class, allowlisted error
names/codes, child identity/exit and bounded diagnostic file hash/bytes; no raw
headers, bodies, errors or redirect locations. Failure uses the existing owned
server stop and parent cleanup, and consumes that invocation.
# Sign-in diagnostic boundary

Each admitted ordinary sign-in now writes its own private
`sign-in-N.diagnostics.json`. It wraps the existing context/page creation,
navigation, identifier/Continue, optional email-code choice, code visibility/fill,
redirect, own Project navigation/GET, identity and UI assertions. Recovery uses
the same sign-in wrapper; only assertions already present in that path run.
Code eligibility, exact network allowlist and request payloads remain enforced.
The normal factor-selection flow below defines supported UI actions/selectors.
No screenshots or DOM text are collected by this diagnostic.

The fixed schema retains step begin/pass/fail times, known error name/code,
origin class, status, request-failure code, resource class, safe page class and
known-selector count/visibility only. URLs, paths/query values, headers,
cookies, tokens, raw errors/console text, response bodies and account values
never enter that schema. It keeps at most 48 step records, 96 network records
and 24 browser records within 64KiB serialized output, with dropped counters.
State sampling is capped at 500ms per step and cannot replace the action's
original thrown error. This is source instrumentation, not a replay or a claim
about the preserved attempt03 sign-in failure.

## Normal first-factor email-code selection

The previous immediate optional-button check is replaced by one 30s selection
budget, capped by remaining grant time. It waits for known normal UI state,
accepts a direct email OTP only on the first-factor route, or opens the offered
methods link once and selects an offered email-code button once. Observations
are bounded at 500ms, clicks at 2s and remaining budget. Password presence is
observed only: no password, reset, resend, MFA, trust or protect action is taken.
Unsupported/ambiguous routes, code purpose or unavailable email options fail
with a fixed stage/code. The first-factor/email-purpose guard is repeated before
entering the already-qualified development code. Network policy is unchanged.

Supported English labels and route/flow contracts were inspected in official
Clerk source pinned at `8bf9d1d8db668764c16209004d5d484af88ddeb6`:
[normal factor alternatives](https://github.com/clerk/javascript/blob/8bf9d1d8db668764c16209004d5d484af88ddeb6/packages/ui/src/components/SignIn/AlternativeMethods.tsx),
[routes](https://github.com/clerk/javascript/blob/8bf9d1d8db668764c16209004d5d484af88ddeb6/packages/ui/src/components/SignIn/index.tsx),
[password card](https://github.com/clerk/javascript/blob/8bf9d1d8db668764c16209004d5d484af88ddeb6/packages/ui/src/components/SignIn/SignInFactorOnePasswordCard.tsx),
[OTP control](https://github.com/clerk/javascript/blob/8bf9d1d8db668764c16209004d5d484af88ddeb6/packages/ui/src/elements/CodeControl.tsx),
and [localization](https://github.com/clerk/javascript/blob/8bf9d1d8db668764c16209004d5d484af88ddeb6/packages/localizations/src/en-US.ts).
Installed @clerk/shared localization types have the matching alternative-method
and password keys. The pinned primary source supports the methods link and
email-code option; no unsupported "Other options" label is guessed. This
research does not identify the actual branch reached in failed attempt04 or
prove its served UI bundle equals that upstream revision.

Safe diagnostics add only known control booleans/counts and a finite route
class. State changes are recorded within the existing caps; a reserved terminal
failure snapshot survives exhausted record caps. A fresh private fixture puts
the primary Project at position0 and control at1, so ordinary catalog order
selects the intended initial Project without cookie injection, feature flags or
App-gate changes. The synthetic fixture test uses the maintained catalog query
and reproduces the old same-position Control-before-Proof ordering. Ordinary
production App access still requires Clerk plus the existing membership gate;
empty Entitlements retains its existing fail-soft/free read contract.

The auth-page appearance preserves ordinary alternate-method actions: only its
`footerAction: display:none` override was removed. The branded header/footer
rules remain unchanged. Clerk renders these method actions outside Card.Footer,
so hiding all footerAction elements could suppress a functional sign-in choice.
The exact known "Check your email" heading may be counted even when the branded
header is hidden, solely as semantic form identification. It is never clicked
or filled. A visible OTP on the first-factor route is still required before any
code entry, with the same guard repeated immediately before fill. This source
repair does not turn attempt04 into a successful sign-in or prove its branch.
