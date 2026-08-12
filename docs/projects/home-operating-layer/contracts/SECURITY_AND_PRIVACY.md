# Contract · Security and privacy

**Status:** Sealed (Wave 1). Binding on every Home surface, provider, job, telemetry call and lab direction.
**Base:** `origin/main` @ `78021c5` · branch `feat/home-operating-layer` · worktree `_wt-home-layer`
**Pairs with:** `contracts/HOME_CONTEXT.md` (the seam, the receipt, the axes, the cache posture)
**Consistent with:** `contracts/PROJECT_SCOPE.md` §2.4, §8.1, §9, §10.1
**Decisions taken here:** D-H22 … D-H28 (§10)
**Executable form:** `src/lib/home-layer/context/*.contract.test.*`

Changing anything sealed here requires a new founder-approved ADR or a lead-owned amendment
recorded in `DECISIONS.md`. An implementation agent may not reopen it.

---

## 0. What Home changes about the attack surface

Nothing in this estate currently reads across tenants on purpose. Home does — that is its job.
Three properties of the current code make that a materially different posture rather than more of
the same:

1. **The tenant boundary is a `WHERE` clause and nothing else.** `src/server/db/tenant.ts:5-27`
   states it in the source: *"Tasks has NO row-level security… The ONLY thing stopping workspace A
   from reading workspace B is a `WHERE workspace_id = ?` predicate."* Enforcement is a static
   gate over `src/server/tenant-scope-rules.mjs`, and that gate has a known blind spot: `userId`
   appearing anywhere after `.from(`, **including inside a `leftJoin` ON clause**, counts as a
   STRONG scoping token (`src/server/tenant-scope-rules.mjs:56-86`). That is exactly how the
   daily-digest cross-tenant read passed it (`audit/B-domain-permissions.md:658-670`).
2. **Every existing cross-Project read is already wrong in a truth-relevant way.** All four use a
   `lane = "done"` literal rather than `isTaskDone`, and two filter neither `archived_at` nor
   `parent_task_id` (`PROJECT_SCOPE.md` §5 rule 5). Home cannot reuse them as-is.
3. **Home aggregates and then narrates.** An aggregate that is 5% wrong is a number nobody can
   check; a sentence built on it is a claim nobody can check. Charter rule 12 already bounds what
   AI may say (`CHARTER.md:72`); §7 binds what it may *see*.

Everything below is one of three things: an invariant with a byte-level test, a refusal with a
named failure mode, or an allowlist.

---

## 1. Notes privacy

### 1.1 What makes a Note private

`notes.user_id`, and nothing else. The schema states the guardrail in source:

> "Privacy guardrail: body is private to the owner. Collaborative views should store/read approved
> extracts, never raw note rows. Only the extract_body (creator-authored, deliberate) ever leaves
> Notes." — `src/modules/notes/server/db/notes-schema.ts:19-22`

Every read filters on it (`src/modules/notes/server/actions/notes.ts:247-251`, `:280-300`) and the
static tenant gate governs Notes on `user_id`, not `workspace_id`
(`src/server/tenant-scope-rules.mjs:177-181`). A Note's Project is **filing metadata only**; it
never grants, implies or restricts access (`PROJECT_SCOPE.md` §2.4).

Audit B's verdict is adopted without qualification: this is the best-defended seam in the estate
(`audit/B-domain-permissions.md:523-525`). **Home does not weaken it, and Home does not add to
it.**

### 1.2 The sentinel-string invariant

A field-level assertion ("we did not select `body`") proves the wrong thing. It survives the
moment someone interpolates a body into a summary string, a ranking explanation, a prompt, an
error message or a log line. The invariant is therefore a **byte-level absence check over the
finished artifact**.

**The sentinels.** Every fixture Note in the Home fixture universe carries two distinct,
high-entropy markers:

```
body        must contain   SS-NOTE-BODY-<32 hex>       at its start AND at its end
extract     must contain   SS-NOTE-EXTRACT-<32 hex>
```

Three properties make this work as a test rather than as a gesture:

- **Two sentinels, not one.** The extract is *allowed* out; the body is not. One sentinel cannot
  distinguish a correct promotion from a leak.
- **Scan on the prefix, not the full value.** The check matches `SS-NOTE-BODY-` (13 characters),
  so a summariser that truncates the body to 40 characters still trips it. Matching the full
  32-hex value would let truncation hide a leak.
- **Start and end.** A body sentinel at both ends means a head-clip or a tail-clip is caught.

**Refusal on an empty population.** If the scanned population contains zero body sentinels, the
check **fails**. It does not report "clean". This adopts the repository's existing and stronger
than assumed posture: `perf:budgets` exits 3 with *"Refusing to report a measurement of zero"*
until a production build exists, and `check:contrast` reports `0 contrast failure(s) … 6
unmeasurable surface(s)` rather than a pass (`RISK_REGISTER.md` R-H04). A privacy check that
passes because it looked at nothing is worse than no check, because it is recorded as evidence.

### 1.3 Surfaces the body sentinel must be absent from

Every one of these is a separate scan. A surface not on this list is not thereby exempt; it is
unaudited, which is `unknown`, which per charter rule 11 is not `clear`.

| # | Surface | Why it is listed separately |
|---|---|---|
| 1 | The Home RSC / HTML payload, all five modes, every scenario | The primary artifact |
| 2 | Any Home JSON route response | Different serializer, different code path |
| 3 | The client JavaScript bundle | A fixture or a default inlined at build time |
| 4 | The client → server telemetry body, **and** the server → PostHog payload | Two hops, one allowlist (§5) |
| 5 | Server logs and `console.*` output | The most common accidental sink |
| 6 | The Sentry event, **before** `scrubEvent` runs | §5.4 — the scrub does not catch this class |
| 7 | The AI narration **prompt** | §7 |
| 8 | The AI narration **output** | A model repeating its input is still a leak |
| 9 | Ranking inputs and any rendered ranking explanation | Today's ranking reads only Tasks; that changes in Wave 5 |
| 10 | Any cache entry, at any layer | None exists in V1 (`HOME_CONTEXT.md` §5); the rule pre-dates the cache |
| 11 | OG / share images and their alt text | Rendered server-side, cached publicly by definition |
| 12 | The digest email subject and body | The cron path reaches real user data (`src/app/api/cron/digest/route.ts`) |
| 13 | URL, query string, fragment, and any redirect `Location` header | Logged by every intermediary |
| 14 | `analytics_metric_snapshots` rows, including `aggregate_value` | A JSON blob column is a text sink (`src/modules/signal/server/db/signal-analytics-schema.ts:133-174`) |
| 15 | Any Home-held derivative store | §1.5 |

**One carve-out, named so the test does not produce a false positive.** The actor's own data
export is the actor's own content by definition, and `src/server/account-export.ts:43` already
exports `sourceNoteExtractBody` deliberately. The absence rule governs *shared and outbound*
surfaces; it does not govern a single-actor export of that actor's own rows.

### 1.4 The single auditable promotion edge

**Exactly one edge moves creator-authored text out of Notes, and Home adds no second one.**

| Property | Fact |
|---|---|
| The edge | `POST /api/notes-extract/v2` writes `sourceNoteExtractBody: body` (`src/app/api/notes-extract/v2/route.ts:215`) into the Tasks row (`src/server/db/schema.ts:103-113`) |
| Rendered as | `Approved wording: "…"` in the task detail panel — `src/components/app/task-detail/metadata-rail.tsx:203-205` |
| Already pinned | `src/server/notes-extract-contract.test.mjs:63` asserts the literal `/sourceNoteExtractBody: body/` — the write is a contract, not a convention |
| Integrity marker | `sourceNoteExtractSha256` is written alongside it (`route.ts:216`) |
| Replay semantics | `src/server/notes-extract-idempotency.ts:49`, `:56` define the conflict; Home must not create a path that bypasses it |
| Erasure | `src/server/account-erasure.ts:197` nulls `sourceNoteExtractBody` |

**Home's obligations.**

1. Home may **invoke** the edge (offer the existing promotion). Home may not **write** extract
   text, may not synthesise an extract from a body, and may not copy an extract into a second
   store.
2. Home surfaces exactly one Note-derived text: the creator-authored approved extract, labelled as
   such (`PROJECT_SCOPE.md` §2.4). Raw note bodies never reach Home.
3. **Auditable means one record per traversal** (**D-H22**), written server-side:
   `receiptId`, actor id, source note id, destination `ProjectId`, `sourceNoteExtractSha256`,
   the decision, and the timestamp. **Never the body, never the extract text.** The sha256 already
   exists, so the record proves *which* text crossed without storing it.
4. **Anything Home stores that derives from a Note must be reachable by the existing erasure
   path, or Home must not store it** (**D-H23**). A derivative that erasure cannot find is a
   privacy defect with a legal edge, and it is created by accident, once, in a cache.

The other two sanctioned exits are **reads, not edges**, and stay that way: analytics selects
`extract_body` with `body` **deliberately omitted**
(`src/modules/signal/server/analytics/providers/notes.ts:84-92`, rationale at `:22-28`), doubly
bounded by the requester's own Clerk id and an already-authorized workspace (`:86`, `:88`, `:91`),
and records carry `exposure: "approved_extract"` (`:164`); Notes → Timeline promotion carries a
projection with *"no body, extractBody, user id, token, or free-form metadata slot"*
(`src/modules/notes/lib/timeline-promotion.ts:31-56`).

### 1.5 The extract sentinel

`SS-NOTE-EXTRACT-` may appear **only** on a surface contractually permitted to render an approved
extract, and only alongside its label. Its presence anywhere else — telemetry, logs, prompts, OG
images, snapshots — is the same class of failure as a body leak, one degree quieter.

---

## 2. Aggregate reads never authorize writes

Restated here because it is a security property, not only a correctness one:

> **A read scope is a permission to look. It is never a permission to change.**

The full rule, the two live facts that make it a gate, and the silent-success failure mode are in
`HOME_CONTEXT.md` §6. The security-relevant consequence: a Home mutation that inherited its
destination from an aggregate would target a Project chosen by a *view control*, and the estate's
mutations no-op silently rather than erroring (`src/server/actions/tasks.ts:114`, `:118-122`), so
the wrong target would produce no signal at all.

---

## 3. Revocation

> **Sealed: the next request denies. Not the next deploy, not the next cache expiry, not the next
> worker run.**

`PROJECT_SCOPE.md` §3 rule 4 states it; this section enumerates the carriers a revocation must
survive, because each one is a different mechanism and only one of them is about caching.

| # | Carrier | Required behaviour | Mechanism that delivers it |
|---|---|---|---|
| 1 | **A warm cache** | Denied | Authorization is never cached (`HOME_CONTEXT.md` §4.4). Any future cache entry is served only after a live revocation check — a cache hit is never an authorization (`§5.3`) |
| 2 | **A stopped invalidation worker** | Denied | Correctness may not depend on a worker running. None exists: `captureWorkspaceSnapshots` has **zero callers repo-wide** (`audit/B-domain-permissions.md:557-573`) and `vercel.json` declares exactly one cron. Home assumes no worker |
| 3 | **An open page** | The next server interaction denies; no new data and no action succeeds | Client islands hold no authorization (`HOME_CONTEXT.md` §2.4). An open page can only re-render what it already had; everything new re-enters the seam |
| 4 | **Browser Back** | Re-resolved, never rendered from history or `bfcache` | Every `/app` route is `force-dynamic`; Project selection pushes and re-authorizes on arrival (`DECISIONS.md` D-H10, `PROJECT_SCOPE.md` §10.2) |
| 5 | **An RSC prefetch** | A prefetched payload is not an authorization; the route re-authorizes on activation and the payload is never shared-cacheable | `private, no-store` (`HOME_CONTEXT.md` §5.1). Home prefetches only destinations already in `receipt.authorizedProjects` |
| 6 | **A replayed action id** | Refused | Single-use action ids. The estate already has the idiom: `notes-extract-idempotency` replay conflicts and `suite_outbox.event_id` UNIQUE (`src/server/db/schema.ts:191-210`) |

**Two rules that hold across all six.**

- **Revocation is checked on the read path, not only on the write path.** A revoked member who
  still sees yesterday's aggregate is a live disclosure, even though they can change nothing.
- **A revoked Project resolves to the same neutral `unavailable` as a missing one** (§6). The
  client must not be able to tell revocation from non-existence — otherwise "I used to have
  access" becomes a probe.

### 3.1 The actor-change case

After a sign-out and a sign-in as someone else, `tasks_active_ws` still holds the **previous**
person's Project id: no sign-out path clears it, four of its five writers set `path: "/"` with a
30-day `maxAge`, and nothing in its value records who selected it (`DECISIONS.md` D-H09).

Seam 1 revalidates membership on every resolution (`src/server/auth.ts:154-165`), so this is
**not a data leak** — and the contract still refuses it, because it is a truth defect and a
privacy-of-inference defect: a shared device leaks the *existence* of a Project id through
browser storage. Home never reads the cookie; Read Scope resets on any actor change; a
`workspaceId` the new actor does not hold resolves to `unavailable` with no reason code
(`PROJECT_SCOPE.md` §10.1).

---

## 4. Transport and cache posture

The full posture and the §5.3 partition key are in `HOME_CONTEXT.md` §5. The security-facing
requirements:

| Requirement | Detail |
|---|---|
| Explicit header | Every Home response sets `Cache-Control: private, no-store` itself. Audit B marked the current `/app` reliance on `force-dynamic` defaults as an **INFERENCE** it did not verify (`audit/B-domain-permissions.md:586-591`). Home asserts rather than inherits |
| No `public` or `s-maxage` on any authorized payload | The live counter-example is `/api/calendar/[workspaceId]`: membership-gated, returns every dated task's title and tags, and sets `public, max-age=900, s-maxage=1800` with no `Vary` (`src/app/api/calendar/[workspaceId]/route.ts:41-57`, `:69-86`, `:99`) |
| No framework data cache on a personalized fetch | The live counter-example is `fetchTasksPersonalization`'s `next: { revalidate: 300 }` (`src/modules/notes/server/tasks-personalization.ts:248`), whose sibling correctly uses `cache: "no-store"` (`:162`) |
| No new caching primitive | `unstable_cache`, `"use cache"`, `cacheLife`, `cacheTag`, `revalidateTag`: zero hits repo-wide (`audit/B-domain-permissions.md:576-580`) |
| No personal data in a URL | Not in a path segment, not in a query string, not in a fragment, not in a redirect `Location`. `workspaceId` and `briefingScope` are the only Home-authored parameters and both are opaque, non-identifying values the actor already holds |

---

## 5. Telemetry

### 5.1 Why an allowlist and not a scrubber

The forwarder cannot be the place privacy is enforced. `POST /api/analytics/capture` accepts **any
event name** (`src/app/api/analytics/capture/route.ts:25-28`) and **any properties**: string,
number, boolean and null pass through verbatim, and everything else is coerced with `String(v)`
(`:41-57`). `String(["a private sentence"])` is `"a private sentence"`. There is no allowlist, no
reject list and no shape validation anywhere on that path.

The estate already contains the right pattern, one product over: `venue-meaningful-action.v1`
enumerates allowed kinds per product (`src/lib/account/instrumentation/event-schema.ts:17-33`),
carries only hashed ids (`:93`, `:158-161`), and **rejects rather than strips** forbidden fields —
with the reason stated in source: *"a silent strip would let a future field leak the first time
someone forgets this list exists"* (`:58-62`, list at `:63-91`, depth-walk at `:104-120`).

**Sealed (D-H24): Home telemetry validates against its own allowlist before it reaches the
forwarder, and a validation failure drops the event and logs a counter — never the event.**

### 5.2 The allowlist

Only these events. Only these properties. Every property value is drawn from a closed set, a
bucket, or a 32-hex hash matching the existing `HASH_PATTERN`
(`src/lib/account/instrumentation/event-schema.ts:93`).

| Event | Allowed properties |
|---|---|
| `home_mode_viewed` | `mode` (today · inbox · my-work · analytics · briefing), `scopeKind`, `coverage`, `posture` |
| `home_scope_changed` | `fromScopeKind`, `toScopeKind`, `archivedIncluded` |
| `home_project_switched` | `fromStateKind`, `toStateKind` |
| `home_evidence_opened` | `mode`, `evidenceKind`, `reauthorized` (always `true`; a `false` is a defect that must be visible) |
| `home_refusal_shown` | `mode`, `refusalClass` (§5.3), `coverage` |
| `home_coverage_disclosed` | `mode`, `coverage`, `unresolvedBucket`, `providerKey`, `providerStatus` |
| `home_ranking_served` | `mode`, `itemCountBucket`, `rankingVersion`, `deterministic` |
| `home_action_attempted` | `actionKind`, `capabilityChecked` (always `true`) |
| `home_action_refused` | `actionKind`, `refusalClass` |
| `home_narration_served` | `mode`, `factCountBucket`, `modelVersion`, `groundedOnly` (always `true`) |

**Bucketed, not exact (D-H25).** Counts are emitted as buckets (`0`, `1`, `2-5`, `6-20`, `21-100`,
`100+`), never as exact values. An exact count of one, in a rare configuration, is a fingerprint;
a bucket answers every product question the counts were for.

**No telemetry before the receipt is sealed.** An event on a refusal path carries the refusal
*class* and nothing about what was requested — no Project id, no Planning Period id, no scope
value.

`distinctId` is the raw Clerk `session.userId` on the existing forwarder path
(`src/app/api/analytics/capture/route.ts:33-39`). Home changes nothing about that and **adds no
new identifier**: any id Home contributes is hashed.

### 5.3 The explicit reject list

The floor is `FORBIDDEN_FIELDS` verbatim
(`src/lib/account/instrumentation/event-schema.ts:63-91`): `title`, `name`, `body`, `content`,
`text`, `description`, `note`, `comment`, `email`, `emailaddress`, `phone`, `url`, `href`, `path`,
`slug`, `filename`, `attachment`, `clerkid`, `userid`, `workspaceid`, `subjectid`, `code`,
`accesscode`, `token`, `secret`, `ip`, `useragent`.

Home extends it:

```
extract, extractbody, sourcenoteextractbody, notebody
query, q, search, searchterm
tag, tags, label, workstream
projectname, projectslug, planningperiodname, periodname
assignee, assigneeid, ownerid, memberid, mentionhandle
briefingscope, workspaceids, projectids, allowedprojects
receipt, receiptid, serverreason, reasoncode
prompt, completion, narration, summary, explanation
sentinel, ssnotebody, ssnoteextract
```

Rules that make the list hold:

- **Checked at every depth**, arrays included, as `findForbiddenKey` already does
  (`event-schema.ts:104-120`).
- **Rejected, not stripped.** The event is dropped whole.
- **Values are checked too, not only keys.** Any property value matching `SS-NOTE-` fails the
  event and raises a defect counter — a body that reaches telemetry under an innocent key is the
  case the key list cannot catch.
- **A `refusalClass` is a closed set** — `unavailable`, `capability`, `coverage`,
  `posture` — and is **never** the server reason code from `HOME_CONTEXT.md` §1.4.

### 5.4 Sentry is not a safety net

`scrubEvent` runs on the way out and is genuinely careful: it reduces `user` to `{ id }`
(`src/lib/sentry-scrub.ts:82-84`), drops `request.cookies`, `data` and `query_string` (`:88-91`),
redacts sensitive headers (`:14-21`, `:92-102`), and redacts bearer path segments and token-ish
query parameters (`:25-34`).

It will **not** catch this class. Its key filter is
`/(token|code|secret|authorization|cookie|password|credential)/i`
(`src/lib/sentry-scrub.ts:23`), and its text redactor only rewrites URLs and `token=`-shaped
assignments (`:36-41`). A note body placed at `event.extra.noteBody` matches neither and is
forwarded intact.

**Sealed: Home error payloads carry no content.** Errors carry `receiptId`, an error class, and a
provider key. Never a title, a body, an extract, a query, a Project name, or a rendered string.
The Sentry scrub stays as defence in depth and is never cited as the control.

---

## 6. One neutral state, and reasons that never leave the server

Missing, forbidden, deleted and revoked collapse to a single client state
(`PROJECT_SCOPE.md` §8.1, `HOME_CONTEXT.md` §8):

```ts
{ kind: "unavailable" }
```

**Sealed (D-H26): the collapse is not only the payload.** Distinguishing the four in any observable
channel is the same existence leak in a different coat:

| Channel | Requirement |
|---|---|
| Response body | Identical shape and identical copy for all four |
| HTTP status | Identical. A `404` for missing and a `403` for forbidden distinguishes them perfectly |
| Headers | No `WWW-Authenticate`, no custom reason header, no distinguishing `Location` |
| Redirects | Same destination or no redirect, for all four |
| Copy | Names the state plainly and does **not** guess why (`PROJECT_SCOPE.md` §8.1) |
| Timing | No branch that does materially more work in one case than another. Precise timing equality is not claimed and is not tested; gratuitous asymmetry is prohibited |

`receiptId` may be shown as a support reference because it encodes nothing: it is a per-request
correlation value. The server log line keyed by it carries the full `serverReason`.

`empty`, `archived` and `ready` remain distinct (`PROJECT_SCOPE.md` §8). Collapsing those is the
opposite error — hiding truth the actor is entitled to.

---

## 7. AI narration

Charter rule 12 bounds what AI may *say*:

> "AI may phrase already-authorized deterministic facts. It may not invent priority, ownership,
> risk, health, performance, next actions or completeness." — `CHARTER.md:72`

This contract bounds what it may *see* (**D-H27**):

1. The prompt is built **only** from the sealed receipt's authorized aggregate: already-computed
   deterministic facts, their coverage, and their labels. Never raw rows, never note bodies, never
   comment text, never anything from a Project outside `receipt.authorizedProjects`.
2. The prompt and the completion are both scanned for `SS-NOTE-` (§1.3 rows 7 and 8). A hit is a
   release blocker, not a warning.
3. Narration inherits the coverage of its weakest input. A sentence composed over `partial`,
   `stale`, `unsupported` or `insufficient-history` data carries that qualification in the
   sentence, not only in a badge beside it.
4. No narration is generated on a refusal path. There is nothing authorized to phrase.

---

## 8. Cross-tenant patterns Home must not inherit

1. **The unscoped mention scan.** `compileDailyDigest` scopes its completed-tasks and due-today
   reads, then scans `activities` with **no workspace predicate at all**, admitting any row whose
   comment snippet contains `@{userId}` (`src/server/db/daily-digest.ts:90-104`, `:111-116`). It
   is reachable from the live Inbox page and from the digest email cron. A second, certain
   consequence regardless of exploitability: the global `.limit(50)` is applied **before** user
   filtering, so a user's genuine mentions are silently dropped whenever other tenants are busier
   (`REPOSITORY_TRUTH.md:145-150`). Being fixed by PR #128 (`COLLISION_REGISTER.md:41`) — Home
   builds on the fixed version and never re-creates the shape.
2. **Trusting the static detector.** It passed the read above because `userId` in a `leftJoin` ON
   clause counts as a STRONG scope token (`src/server/tenant-scope-rules.mjs:56-86`). Home's
   cross-Project reads carry an explicit `IN (:authorizedProjects)` predicate derived from the
   receipt, and Home's contract tests assert that predicate directly rather than relying on the
   detector.
3. **`LIKE`-matching an identity.** The only assignee-scoped read matches
   `like(tasks.assignees, '%"${escapedId}"%')` (`src/server/db/queries.ts:335`, duplicated at
   `src/server/db/daily-digest.ts:69-79`) — a full scan that is exact only by the surrounding
   double-quote convention. Nothing validates that an assignee is a member
   (`src/server/actions/tasks.ts:370`, `:561`). Home's "assigned to me" must state which choice it
   made about non-member assignees and disclose it (`PROJECT_SCOPE.md` §3.1 consequence 3), and
   must not silently do either.

---

## 9. Demo and review posture

`demo` and `review` are the public, seed-data, no-login-wall posture, and their safety invariant is
load-bearing and stated in source: the real database is **never** queried, because the auth layer
swaps in `DEMO_USER_ID` and the data layer short-circuits to seed data
(`src/lib/access-mode.ts:23-27`, `:80-84`; `src/server/auth.ts:56`, `:148`).

Home's obligations:

- A demo/review request yields a receipt **marked synthetic**, which no production data path
  accepts (`HOME_CONTEXT.md` §1.3 step 1, D-H19).
- No Home surface may render synthetic and live data in the same view without a visible boundary.
- The design lab is a separate control and is already sealed elsewhere: `/lab` has **no
  authentication guard at all** at this base — it sits outside the Clerk proxy matcher entirely,
  so `auth()` is not even populated inside those routes, and `GET /lab/timeline-a` returns HTTP
  200 (`RISK_REGISTER.md` R-H10). The Home lab renders permission-limited, partial and
  guest-limited fixture states, so it must not deploy onto that route family unguarded. `noindex`
  is not access control.

---

## 10. Decisions taken in this contract

Ids continue `HOME_CONTEXT.md` §13, which ends at D-H21. If a parallel Wave 1 lane also claimed
these ids, the lead renumbers — the decision text is the durable part.

| # | Decision | Rationale in one line |
|---|---|---|
| **D-H22** | Every traversal of the Notes promotion edge writes one server-side record carrying the sha256, never the text | `sourceNoteExtractSha256` already exists, so the audit trail can prove *which* text crossed without storing it |
| **D-H23** | Anything Home stores that derives from a Note must be reachable by the existing erasure path, or Home does not store it | A derivative erasure cannot find is created by accident, once, in a cache |
| **D-H24** | Home telemetry validates against its own allowlist **before** the forwarder; failures drop the event, never the field | `/api/analytics/capture` has no allowlist, no reject list and no shape validation (`route.ts:25-28`, `:41-57`) |
| **D-H25** | Telemetry counts are bucketed, never exact | An exact count of one in a rare configuration is a fingerprint; a bucket answers the same product question |
| **D-H26** | The missing / forbidden / deleted / revoked collapse binds the HTTP status, headers, redirects and copy, not only the payload | A `404` versus a `403` distinguishes them perfectly, whatever the body says |
| **D-H27** | The AI narration prompt is built only from the receipt's authorized aggregate, and both prompt and completion are sentinel-scanned | Charter rule 12 bounds what AI may say; nothing bounded what it may see |
| **D-H28** | The sentinel scan **fails** on an empty population rather than reporting clean | A privacy check that passed because it looked at nothing is recorded as evidence, which is worse than no check |

---

## 11. Open, and owned elsewhere

1. **The Home fixture universe does not exist yet.** The sentinel invariant (§1.2) is
   unexecutable until Wave 2 builds it, and Wave 2 must build it **on top of** PR #129's
   `src/lib/project-truth-fixture.ts` rather than beside it (`COLLISION_REGISTER.md:40`). Until
   then §1.2's tests refuse on an empty population, which is the correct red.
2. **The digest cross-tenant fix has not merged.** PR #128 is MERGEABLE, not merged
   (`COLLISION_REGISTER.md:41`). Home's Inbox work is sequenced behind it.
3. **The Home `/waitlist` gate fix has not merged.** Session `task_1bf52417` owns
   `src/app/app/home/page.tsx`, the `/app` layout and both access-gate modules
   (`COLLISION_REGISTER.md:29`).
4. **Entitlements were not audited in Wave 0.** They appear in the partition key
   (`HOME_CONTEXT.md` §5.3) and in the re-authorization triggers (§4.3) as required fields with an
   unresolved source. Recorded, not assumed.
5. **No RUM provider is wired**, so no field evidence of any kind exists — including for the
   claim that a `no-store` posture is affordable (`RISK_REGISTER.md` R-H05). If the cache posture
   is ever revisited on performance grounds, the evidence for that argument does not exist today.
6. **`membershipRevision` has no durable source** (`HOME_CONTEXT.md` §14 item 3). Revocation
   correctness in V1 therefore rests on *not caching*, not on invalidating. That is the safe
   ordering, and it is the reason §3 carrier 2 assumes no worker.
