# Contract · Home context and authorization

**Status:** Sealed (Wave 1). Binding on every Home surface, provider, contract test and lab direction.
**Base:** `origin/main` @ `78021c5` · branch `feat/home-operating-layer` · worktree `_wt-home-layer`
**Consistent with:** `contracts/PROJECT_SCOPE.md` (sealed first; this contract does not redefine Project identity)
**Adopts:** `docs/adr/0001-canonical-project-identity.md` via `DECISIONS.md` D-H01
**Pairs with:** `contracts/SECURITY_AND_PRIVACY.md` (privacy, revocation, telemetry, the sentinel invariant)
**Decisions taken here:** D-H14 … D-H21 (§13)
**Executable form:** `src/lib/home-layer/context/*.contract.test.*` (§12)

Changing anything sealed here requires a new founder-approved ADR or a lead-owned amendment
recorded in `DECISIONS.md`. An implementation agent may not reopen it.

---

## 0. What this contract is, and what it is not

`PROJECT_SCOPE.md` settled **what a Project is** and **who may see one**. This contract settles
**how a Home request gets from a browser to an authorized answer**, and what may not happen along
the way.

It is one seam, one receipt, seven axes and four rules. Everything else here is evidence for
those.

It is **not** an implementation. Nothing under `src/lib/home-layer/context/` exists at this base
except the failing contract tests this wave adds; `authorizeHomeContext` appears in those two
files and **nowhere else repo-wide** (verified). Sibling directories under `src/lib/home-layer/`
belong to other Wave 1 lanes of this programme — `lab/`, `inbox/`, `today/`, `my-work/`,
`analytics/`, `experience/` — and this contract writes to none of them. §11 is the acceptance
surface the lead checks the landed seam against.

**Why a seam at all.** Audit B established that authorization in this estate is resolved by
**five separate membership seams over four transports** — in-process Drizzle, raw
`@libsql/client` SQL against the Tasks URL, an owner-only Timeline table with no member concept,
a read-only Tasks mirror, and an HMAC HTTP loopback
(`audit/B-domain-permissions.md:189-202`). Twenty-one functions return a workspace set for a
viewer; nine are cross-workspace and they **disagree** on owner-only versus owner-or-member, on
archived handling, and on which id space they speak (`:204-261`). Home is the one surface that
reads across all of them at once. A sixth seam would not be a seam; it would be a sixth opinion.

`PROJECT_SCOPE.md` §3 named seam 1 canonical and subordinated the rest. This contract says where
that single authority is **called from**, exactly once per request, and what a provider is
allowed to hold instead of the raw facts.

---

## 1. `authorizeHomeContext` — the one server-only seam

> **Every Home read and every Home write enters through `authorizeHomeContext`. There is no
> second entrance, and no Home provider resolves identity, membership, capability, grouping or
> Active Project for itself.**

### 1.1 Module boundary

| Property | Requirement |
|---|---|
| Location | `src/lib/home-layer/context/authorize-home-context.ts` |
| Runtime | Server only. The module imports `server-only`, as `src/server/**` does. A client component importing it is a build error, not a review finding. |
| Callers | Home Server Components and Home route handlers, **once per request**, before any data load. |
| Returns | `HomeContextResult` — `{ ok: true; receipt }` or `{ ok: false; refusal }`. Never a partially-populated success. |
| Forbidden inside providers | `auth()`, `currentUser()`, `getCurrentUser()`, `getActiveWorkspace()`, `cookies()`, `headers()`, any direct `workspace_members` query, any of the twenty-one workspace-set functions in `audit/B-domain-permissions.md:204-261`. |

Home's page code does not call `getActiveWorkspace()`. That function's third fallback returns
`LEGACY_WORKSPACE_ID` — a Project the caller has proved **no membership of**
(`src/server/auth.ts:179`, still live at this base). `DECISIONS.md` D-H03 made its elimination a
Home precondition; §1.2 step 4 is where that precondition is enforced.

### 1.2 The ordered pipeline

Nine steps. The order is the contract, not an implementation detail: every step consumes only
what earlier steps produced, and each one can refuse.

```
1  access-posture        which posture is this request being served under
2  authenticate          is there a real session
3  resolve-internal-user Clerk id → users.id, with the provisional-identity flag
4  resolve-memberships   seam 1, live, this request, no cache
5  resolve-capabilities  enumerated capabilities per Project, never inferred from a role label
6  validate-grouping     parse and authorize the requested Home Read Scope
7  intersect             requested grouping ∩ authorized Projects → the only set providers see
8  resolve-active-project  independently, via resolveProjectRoute — never derived from 6 or 7
9  seal                  mint the receipt
```

**The barrier sentence, sealed.**

> **No provider may count, aggregate, rank, group, narrate, cache or paginate before step 9
> returns.** A provider handed anything other than a sealed receipt **refuses**. It does not fall
> back to an ambient lookup, does not resolve a default Project, and does not return an empty
> result.

An empty result is the specific failure this forbids. An unauthorized provider that returns `[]`
produces a Home surface that says "nothing needs your attention" when the truth is "we could not
tell". That is charter rule 11 violated by omission, and it is invisible to the reader.

### 1.3 Each step, with what it must refuse

**Step 1 · `access-posture`.** Resolve `getAccessMode()` — `production | development | demo |
review` (`src/lib/access-mode.ts:30`, `:50-68`). `demo` and `review` are the public, seed-data,
no-login-wall posture (`:80-84`) whose load-bearing safety invariant is that the real database is
never queried (`:23-27`); `getCurrentUser()` and `getActiveWorkspace()` both short-circuit to
demo constants (`src/server/auth.ts:56`, `:148`).

Sealed: a demo/review request yields a **synthetic receipt** that is marked as such and that no
production data path will accept. The posture travels **in** the receipt, so a provider can never
be uncertain which universe it is reading. Synthetic and live evidence stay visibly separate —
this is the same requirement the charter's definition of done states for release evidence
(`CHARTER.md:129`), applied at the data seam rather than only at the report.

**Step 2 · `authenticate`.** No session → `refusal: "unauthenticated"`. Home never invents an
actor.

Recorded hazard, not inherited: when Clerk env vars are missing, `getCurrentUser()` **throws in
production and returns the literal string `"david"` in development**
(`src/server/auth.ts:58-67`), and that same dev fallback is replicated verbatim in three more
modules (`src/modules/notes/server/notes-auth.ts:35`,
`src/modules/timeline/server/auth.ts:51`, `src/modules/signal/server/signal-auth.ts:33`). The
receipt records which identity branch produced it. A receipt minted on the dev-fallback branch is
posture `development` and is refused by any production data path, so the fallback cannot silently
become an actor in a deployed build.

**Step 3 · `resolve-internal-user`.** Clerk id → `users.id`.

The hazard is real and specific: when the provisioning webhook has not landed, `getCurrentUser()`
**returns the raw Clerk id as the internal user id** (`src/server/auth.ts:111-120`), so for a
window the same person is addressable as two different `UserId` values. The codebase already does
not fully trust the equality — signal's workspace lister hedges with
`or(eq(users.clerkId, clerkId), eq(users.id, clerkId))`
(`src/modules/signal/server/analytics/page-context.ts:161`) even though
`src/server/app-access.ts:54-56` records that they are equal post-Phase-A.

Sealed (**D-H14**): the receipt carries exactly one resolved actor id **and** a boolean
`identityProvisional`. While `identityProvisional` is true, Home **may read** and **may not
mutate**, and may not describe any count as complete. Two addressable identities and a write is
how a row ends up owned by a user id that will never resolve again.

**Step 4 · `resolve-memberships`.** Seam 1 only, through the `src/lib/projects/**` facade
(`PROJECT_SCOPE.md` §11), live, this request, **no cache** (`PROJECT_SCOPE.md` §3 rule 4).

Returns `ProjectSetResult` — `projects`, `unresolvedCount`, `coverage: "complete" | "partial" |
"unavailable"` — which **must not be inferred**. An empty `projects` array with
`coverage: "complete"` means "you are a member of no Projects". The same array with
`coverage: "unavailable"` means "we could not ask". Home renders those two differently or Home is
lying. `LEGACY_WORKSPACE_ID` never appears in the result (D-H03).

**Step 5 · `resolve-capabilities`.** Per authorized Project, an enumerated capability set from
`assertProjectCapability` (`PROJECT_SCOPE.md` §11.2), which returns a **typed refusal**, never a
boolean that collapses "denied" into "false".

Capabilities are never derived from the role string. `workspace_members.role` is exactly
`"owner" | "member"` (`src/server/db/schema.ts:458-477`) and **no task mutation carries a role
check** — role predicates exist only in `src/server/actions/{planning,security,settings}.ts` and
`src/server/planning/security-boundary.ts:30,47`
(`audit/B-domain-permissions.md:300-305`). A Home control disabled with an "owners only" tooltip,
over an action with no role check, teaches a permission model the system does not enforce
(`DECISIONS.md` D-H11).

**Step 6 · `validate-grouping`.** Parse `briefingScope` into a `HomeReadScope`
(`PROJECT_SCOPE.md` §5) and authorize it.

A `planning-period` grouping requires a Planning Period the actor **owns**: `planning_periods`
has a single `owner_user_id` FK with cascade delete (`src/server/db/schema.ts:217-261`). It is
never an authorization boundary — it is a grouping (`PROJECT_SCOPE.md` §2.5).

Sealed (**D-H15**), two different failures with two different answers:

| Failure | Answer | Why |
|---|---|---|
| **Unparseable** grouping (garbage in the URL) | canonicalise to `{ kind: "current-project" }` and **replace-redirect** so the URL now says what the page shows | The label and the content agree again. History is not polluted (`PROJECT_SCOPE.md` §10.2). |
| **Unauthorized** grouping (a Planning Period the actor does not own) | `unavailable`, no reason code, **no downgrade** | A silent downgrade to `current-project` would render narrower truth under a wider label; worse, downgrading rather than refusing confirms the period exists. |

This is the exact defect `PROJECT_SCOPE.md` §2.5 fails closed against:
`selectAuthorizedWorkspaceHint` falls through a `??` chain and, when an explicit `workspaceId` is
unauthorized, silently selects a **different** Project sharing the Planning Period
(`src/modules/notes/server/tasks-personalization.ts:192-209`). Home does not repeat it one level
up.

**Step 7 · `intersect`.** The validated grouping is intersected with the live authorized-Project
set from step 4. **The intersection is the only Project set that reaches a provider.**

Partial intersection sets `coverage: "partial"` and carries `unresolvedCount`. It is never
trimmed silently: if N of M Projects resolve, Home says which count it read and that the rest were
unavailable (`PROJECT_SCOPE.md` §5 rule 4). Sources degrade **per Project**, not globally — one
unavailable Project does not make the aggregate unavailable, and does not make it complete either
(§5 rule 7).

Archived Projects are excluded by default and included only on an explicit, labelled toggle
(`DECISIONS.md` D-H08). The receipt records which of the two sets it authorized, so a provider
cannot guess.

**Step 8 · `resolve-active-project`.** Independently, through `resolveProjectRoute`
(`PROJECT_SCOPE.md` §11.2), following the §4.2 precedence: explicit URL `workspaceId` → validate
shape → current membership and Project state → that exact Project or `unavailable`, **never a
substitute**.

Sealed: Active Project is **never** derived from the grouping, never from the first element of
the intersection, never from the cookie when a URL id is present, and never from a Timeline
ownership row. Three live substitutions exist today and none of them may reach Home:
first-membership fallback (`src/server/auth.ts:169-174`), the Planning-Period fall-through
(`src/modules/notes/server/tasks-personalization.ts:192-209`), and Timeline adoption (owned by
`lane/wp1-timeline-safety`) — all three catalogued at `RECONCILIATION.md` row 15.

Step 8 runs **after** step 7 and reads none of its output. The ordering is for the receipt, not
for the resolution: sealing an Active Project the actor cannot access, alongside an aggregate they
can, is how a Home page ends up with a truthful list and a lying header.

**Step 9 · `seal`.** Mint the receipt (§2). Only now may a provider run.

### 1.4 What the seam returns on refusal

```ts
type HomeContextRefusal = {
  /** The one neutral thing the client learns. */
  kind: "unavailable";
  /** Server-only. Never serialized to a client, never in an HTTP status, never in a header. */
  serverReason:
    | "unauthenticated" | "posture-mismatch" | "identity-unresolved"
    | "membership-unavailable" | "grouping-unauthorized" | "grouping-unparseable"
    | "project-missing" | "project-forbidden" | "project-deleted" | "revoked";
  /** Correlates the client's neutral state with the server log line. Carries no meaning. */
  receiptId: string;
};
```

`missing`, `forbidden` and `deleted` collapse into one neutral client state
(`PROJECT_SCOPE.md` §8.1) — distinguishing "does not exist" from "you may not see it" is an
existence leak. `SECURITY_AND_PRIVACY.md` §6 extends that to the HTTP status and the response
shape, which must also not distinguish them.

---

## 2. The authorization receipt

> **Providers accept a receipt. They do not accept a user id, a workspace id, a role string, or a
> list the browser sent.**

### 2.1 Why an opaque value and not the facts themselves

A provider that takes `(userId, workspaceIds[])` has to be trusted to have been called correctly,
by every caller, forever. There is no way to tell, at the provider, whether that array came from a
membership query or from a query string. A branded receipt moves that question from review time
to compile time.

The estate already contains the failure this prevents. `scopeSnapshot` throws `ScopeBoundaryError`
when a snapshot and a query disagree about the workspace
(`src/modules/signal/lib/analytics/scope.ts:12-17`, `:66-75`) and its own comment names the
posture: *"Authorization still belongs in the server policy; this prevents an adapter returning
extra records from widening a calculation."* Home adopts that idiom one level higher rather than
inventing a second one.

### 2.2 Shape

```ts
declare const HOME_RECEIPT_BRAND: unique symbol;

type HomeAuthorizationReceipt = {
  readonly [HOME_RECEIPT_BRAND]: true;

  /** Correlation only. Meaningless to a client; the join key for every server log line. */
  readonly receiptId: string;

  /** Request-local lifetime. A receipt is invalid outside the request that minted it (§4.4). */
  readonly issuedAt: number;
  readonly requestId: string;

  readonly posture: "production" | "development" | "demo" | "review";
  readonly actor: { readonly id: ActorId; readonly provisional: boolean };

  /** Step 7's intersection. Already narrowed. The only Projects a provider may read. */
  readonly authorizedProjects: readonly ProjectId[];
  readonly archivedIncluded: boolean;
  readonly coverage: "complete" | "partial" | "unavailable";
  readonly unresolvedCount: number;

  /** Enumerated, per Project. Never a role label. */
  readonly capabilities: ReadonlyMap<ProjectId, ReadonlySet<HomeCapability>>;

  /** Resolved independently at step 8. */
  readonly activeProject: ProjectRouteState;

  readonly readScope: HomeReadScope;
  readonly analyticsWindow: {
    readonly startAt: string; readonly endAt: string;
    readonly granularity: "day" | "week"; readonly timezone: string;
    /** Current-state reads keep their explicit as-of instant (RECONCILIATION row 3). */
    readonly asOf: string;
  };

  /** Changes on any membership, role, visibility, entitlement or Project change (§4.3). */
  readonly membershipRevision: string;
  /** Per provider: revision, staleness, history window. Extends providerCoverage, not a rival. */
  readonly sourceRevisions: ReadonlyMap<ProviderKey, ProviderRevision>;

  /** The done-definition digest, per Project. See §2.5. */
  readonly doneDefinitionDigest: ReadonlyMap<ProjectId, string>;
};
```

`coverage` and `sourceRevisions` extend the vocabulary the estate already has: `providerCoverage`
carries status, capabilities, history window, staleness and issues
(`src/modules/signal/server/analytics/providers/coverage.ts:8-31`), and
`PROJECT_SCOPE.md` §5 rule 7 requires Home to extend it rather than invent a second one.

### 2.3 The explicit reject list — what a provider must never accept instead

| Rejected input | Why |
|---|---|
| A raw Clerk id or `users.id` | It is an identity, not an authorization. Step 3's provisional case makes it ambiguous as well. |
| A raw workspace id from the client | The URL is current-tab truth for *content*; it is never trusted for authorization (`PROJECT_SCOPE.md` §4.1). |
| A client role string (`"owner"`) | Roles are not capabilities here — no task mutation checks one (`DECISIONS.md` D-H11). |
| A browser-supplied allowed list | "These are my projects" is a claim, not a grant. |
| The `tasks_active_ws` cookie value | Its HttpOnly posture depends on which of five writers touched it last; two do not set `httpOnly` (`DECISIONS.md` D-H12). No Home client code may read it, and no Home server code may authorize from it. |
| A raw `briefingScope` string | Unvalidated grouping. Step 6 exists precisely to convert it. |
| A previous request's receipt | §4.4. |
| A reconstructed object literal shaped like a receipt | The brand is a `unique symbol`; a structural copy is a compile error and, defensively, a runtime refusal. |

**Provider signature.** `(receipt: HomeAuthorizationReceipt, query: ProviderQuery) => …`. If
`query` names a Project not in `receipt.authorizedProjects`, the provider **throws**. It does not
filter the Project out.

That distinction is load-bearing. Filtering converts an authorization bug into a truth bug: the
number renders, it is quietly wrong, and nobody sees a refusal. Throwing produces one honest
`unavailable` and a server log line.

### 2.4 The receipt does not cross to the client

The receipt has no `toJSON`, is not serializable across the RSC boundary, and any attempt to pass
it into a client component is a type error. What the client receives is a narrow projection:

```ts
type HomeContextView = {
  readonly modeLabel: string;
  readonly scopeLabel: string;                    // "Across all projects", "2026 school year"
  readonly activeProject: { id: ProjectId; name: string; archived: boolean } | null;
  readonly linkableProjects: readonly { id: ProjectId; name: string }[];
  readonly coverage: "complete" | "partial" | "unavailable";
  readonly unresolvedCount: number;
  readonly capabilities: readonly HomeCapability[]; // for the active Project only
};
```

`linkableProjects` carries ids because every Home contextual link must carry `workspaceId`
(`PROJECT_SCOPE.md` §10.2) and the actor is a member of every id in it. It **never** carries the
ids of unresolved Projects — `unresolvedCount` is a count, and stays a count.

### 2.5 Why the receipt carries a done-definition digest

`isTaskDone(task, config)` is *the* done predicate for every surface
(`src/lib/board-columns.ts:188-208`), and its config is per Project, stored as a `meta` row and
editable by **any member** — `setColumnDoneAction` performs no role check
(`src/server/actions/board.ts:282-301`). So two Projects' completion numbers are not necessarily
comparable, and yesterday's number for one Project is not necessarily comparable with today's.

Carrying the digest in the receipt makes that mechanical rather than remembered: a cross-Project
completion figure whose digests differ **must** carry the disclosure that "Done" is defined per
Project (`DECISIONS.md` D-H11), and any cached or snapshotted figure whose digest has moved is
stale by definition, not by age.

---

## 3. The context axes

**Seven axes. None is interchangeable with any other. Collapsing any two is a release blocker.**

The programme brief calls these "the five independent context axes" and then lists seven. This
contract seals **seven** and records the discrepancy rather than choosing a number
(**D-H16**): every pair below has a distinct live defect attached to conflating it, so there is no
pair that can be safely merged to reach five.

**The invariant, quoted from the charter:**

> "Unknown stays unknown. Missing, incomplete, unsupported, stale, permission-limited, failed or
> insufficient-history data may never render as zero, healthy, complete, empty or all clear."
> — `CHARTER.md:71` (locked product decision 11)

and, for the axes specifically:

> "Project is scope and mutation context — not a product, not a Home mode."
> — `CHARTER.md:65` (locked product decision 5)

| # | Axis | Answers | Set by | Lives in | May | May never |
|---|---|---|---|---|---|---|
| 1 | **Auth / tenant boundary** | who is asking, and which Projects exist for them at all | the system, from seam 1 | server, per request | be the ceiling on every other axis | be widened by any other axis; be cached |
| 2 | **Active Project** | which single Project a route renders and a mutation targets | an explicit user selection | URL `workspaceId`, plus a cookie hint for bare entry | change on explicit selection only | be inferred from grouping, position, name, Timeline ownership, or the aggregate |
| 3 | **Home Read Scope** | what Home may read *together* | a Home-local control | URL `briefingScope` | narrow **and widen**, always labelled | change Active Project; be written to the cookie; be expressible as a `ProjectId` |
| 4 | **Planning Period** | which Projects are grouped | the Project's `planning_period_id` | Tasks data | be one *value* of axis 3 | be an authorization grant; be a mutation destination; substitute a Project |
| 5 | **Analytics Time Window** | *when* | an Analytics control | the Analytics query in the receipt | narrow the interval | narrow the set; imply completeness of history it does not have |
| 6 | **Product-local filters** | which subset of the current view is shown | a product control | product-local state | narrow within Active Project | widen beyond it; change it |
| 7 | **Viewer role / capabilities** | what this actor may do | `workspace_members.role` + an enumerated capability check | the receipt | gate affordances that call a capability predicate | be treated as scope; be inferred from a label |

### 3.1 Each pair, and the live defect that proves it

| Collapsed pair | What breaks | Evidence |
|---|---|---|
| 1 + 2 | A resolver hands out a Project the actor has proved no membership of | `getActiveWorkspace()`'s third fallback returns `LEGACY_WORKSPACE_ID` (`src/server/auth.ts:179`) |
| 2 + 3 | "Everything" has to be encoded as a sentinel inside the Project field, and every link builder, mutation and cookie writer must special-case it. One will forget. | `DECISIONS.md` D-H04 |
| 3 + 4 | An unauthorized explicit Project silently resolves to a *different* Project sharing the period | `src/modules/notes/server/tasks-personalization.ts:192-209` |
| 4 + 5 | "This school year" silently means "the last twelve weeks", or a trend is read as a grouping | `RECONCILIATION.md` row 3 |
| 5 + 6 | A filtered count is read as a trend; a narrowed interval is read as a narrowed set | §5 rule 5's four literal-`done` reads all mix the two |
| 6 + 2 | A contextual link that carries a Project lands in whichever Project the cookie holds | `src/app/app/tasks/page.tsx:18-21` reads only `welcome`; `tasks-runtime-shell.tsx:68` then resolves ambiently |
| 7 + anything | A control implies a permission the system does not enforce, or hides one the actor has | no task mutation carries a role check (`audit/B-domain-permissions.md:300-305`) |

### 3.2 Precedence, restated in one line

Axis 1 is the ceiling. Axis 2 is a pointer inside it. Axis 3 is the only widening control and it
is always labelled. Axes 4 and 5 are values, not authorities. Axis 6 may only narrow. Axis 7
gates affordances and never scope.

---

## 4. Re-authorization

One authorization per request is necessary. It is not sufficient.

### 4.1 Before any derivation

Every count, ranking, aggregation, grouping, narration and pagination asserts a **sealed receipt
minted in this request** before it runs (§1.2). This is the barrier sentence, enforced at the
provider entry point rather than remembered by each provider author.

### 4.2 Again before detail evidence or a source mutation

A second, **independent** authorization runs when the user crosses from a summary into either
(a) the evidence behind a number, or (b) a mutation.

It does **not** re-read `receipt.authorizedProjects`. It queries the **target object**, derives
the object's stored Project, and verifies the capability in the same operation — the
object-operation pattern of `PROJECT_SCOPE.md` §9. Optionally it compares an expected Project id
to detect stale UI.

Checking the receipt's list here would be circular: the list was correct when it was minted, and
the question at this moment is whether it still is, for *this object*.

### 4.3 After any of these changes

`membershipRevision` moves, every held receipt is stale, and the next request re-authorizes from
scratch:

- membership added or removed
- role changed
- Project visibility changed (archived, unarchived, deleted)
- entitlement changed
- **Active Project changed** (an explicit selection is a new authorization context, not a filter)
- **a source changed** — a provider's revision moved, its history window changed, or it became
  unavailable

The last one matters because a source that goes unavailable between the receipt and the render
must produce `coverage: "partial"` and a disclosure, not a smaller number.

### 4.4 The receipt never crosses a request

No module-scope cache, no `globalThis`, no cross-request memo. The counter-example is already in
the repository and documents itself: `tasksEvents` is an in-process `EventEmitter` on
`globalThis` and its own comment states that *"production with multi-replica deployment needs
Redis pubsub"* (`src/server/events.ts:1-30`). Process-global state in this estate is not shared
state; it is per-replica state that looks shared.

Request-local memoization is the **only** permitted reuse (§5).

---

## 5. Cache posture

### 5.1 V1, sealed

| Rule | Detail |
|---|---|
| **Private, no-store** | Every Home response carries `Cache-Control: private, no-store` explicitly. Not inherited, not assumed. |
| **`force-dynamic` retained** | Every `/app` route is `force-dynamic` today — 22 files including `src/app/app/layout.tsx:21`, `src/app/app/home/page.tsx:8`, `src/app/app/home/briefing/page.tsx:4`. Home does not opt out (`PROJECT_SCOPE.md` §10.1 rule 4). |
| **No caching primitive** | `unstable_cache`, `"use cache"`, `cacheLife`, `cacheTag`, `revalidateTag` return **zero hits repo-wide** (`audit/B-domain-permissions.md:576-580`). Home is not where that starts. |
| **Request-local memoization only** | React `cache()` or a per-request `Map`, both scoped to the request. Never module scope, never `globalThis` (§4.4). |
| **No shared personalized cache** | Not in V1, not behind a flag, not "just for the counts". |

Audit B's own note is adopted: `/app` privacy today rests on `force-dynamic`'s default response
headers, *"which is a convention, not an asserted contract"*, and the exact headers Next emits at
this version were **not verified** (`audit/B-domain-permissions.md:586-591`, marked INFERENCE).
Home therefore sets the header itself rather than relying on the convention. Unknown stays
unknown.

### 5.2 The two live patterns Home must not copy

1. `/api/calendar/[workspaceId]` checks a `workspace_members` row and then returns every dated
   task's title and tags with `"Cache-Control": "public, max-age=900, s-maxage=1800"` and **no
   `Vary`** (`src/app/api/calendar/[workspaceId]/route.ts:41-57`, `:69-86`, `:99`). `public` plus
   `s-maxage` invites a CDN to store a personalized, authorized response. Audit B calls it the
   clearest caching defect in the estate (`:601-612`). Home ships no route with this shape.
2. `fetchTasksPersonalization` opts **into** the Next Data Cache on an authenticated
   cross-product fetch — `next: { revalidate: 300 }`
   (`src/modules/notes/server/tasks-personalization.ts:248`) — while its sibling
   `fetchTasksWorkspaceCatalog` correctly uses `cache: "no-store"` (`:162`). Home's cross-product
   fetches use `no-store`, without exception.

### 5.3 The partition key that WOULD be required

Specified now so that a future proposal is measured against it rather than negotiated. If a
shared personalized cache is ever added to Home, its key must include **every** field below.
A missing field is a cross-actor or cross-truth leak, not a performance trade.

```
actorId
identityProvisional
accessPosture                      production | development | demo | review
authorizedProjectSetDigest         sorted ProjectIds, hashed
archivedIncluded
capabilityDigest                   per-Project capability sets, hashed
membershipRevision
entitlementRevision
readScopeKind + readScopeValue     current-project | planning-period:<id> | all-projects
activeProjectId + activeProjectStateKind
analyticsWindow                    startAt, endAt, granularity, timezone, asOf
productFilterDigest
doneDefinitionDigest               per Project — any member may redefine Done (§2.5)
providerSourceRevisions            per provider
metricVersion + schemaVersion
flagSetDigest                      every Home flag that changes what is computed
locale + timezone
```

**And the sentence that makes the key insufficient on its own:**

> **A partition key proves that the inputs are the same. It does not prove that the authorization
> is still current.** Any cached Home entry is served only after a live revocation check for the
> actor and the Projects it covers. A cache hit is never an authorization.

`SECURITY_AND_PRIVACY.md` §3 specifies the revocation cases that check must survive.

---

## 6. Aggregate read scope never authorizes a mutation

> **Sealed. No Home mutation may derive its destination from Home Read Scope, from the receipt's
> `authorizedProjects` array, from the cookie, or from the aggregate the user was looking at when
> they clicked.**

A Home mutation takes an explicit branded `ProjectId` argument, re-derives the target object's
stored Project, and verifies the capability in the same operation (`PROJECT_SCOPE.md` §9).

Two facts make this a hard gate rather than a style preference:

1. Every Tasks mutation binds to the cookie, not an argument — **101 `getActiveWorkspace(`
   occurrences across 43 non-test source files** at this base, of which
   `docs/wave/MUTATION_INVENTORY.md` classifies 36 as critical. A cross-Project Home surface
   cannot complete a task in Project B while the cookie says Project A: the pre-read finds no row
   and the action **silently no-ops with a success return**
   (`src/server/actions/tasks.ts:114`, `:118-122`).
2. A per-write cookie dance is prohibited (`PROJECT_SCOPE.md` §9): it is a global state change to
   serve a local write, it races with concurrent tabs, and it converts a Home action into an
   Active Project switch the user did not ask for.

`HOME_MUTATIONS_ENABLED` stays default-off until Home's write path is parameterized
(`RECONCILIATION.md` row 9; risk `R-H11`).

**Silent success is the specific thing this forbids.** A refusal Home cannot detect is worse than
a refusal Home shows. `selectWorkspaceAction` already returns `{ ok: true }` when membership is
absent (`src/server/actions/cross-workspace.ts:191`) — a refusal byte-identical to a success. No
Home affordance is built on an action whose refusal it cannot distinguish.

---

## 7. An explicit unavailable Project never substitutes another

Restated here because it is the rule most likely to be "helpfully" broken by an implementation
agent trying to avoid an empty screen.

- Explicit `workspaceId` present and unauthorized → `unavailable`. Never the first membership,
  never a Planning Period sibling, never the cookie's value, never `LEGACY_WORKSPACE_ID`.
- `unavailable` **names the state plainly and does not guess why**, offers a route onward, and
  never auto-switches (`PROJECT_SCOPE.md` §8.1).
- `unavailable` is **not** `empty`. An unavailable Project is not an empty Project, and neither is
  zero, healthy, complete or all clear.
- After an actor change, a `workspaceId` the new actor does not hold resolves to `unavailable` —
  never to a substitution, and never to a reason code that confirms the Project exists
  (`PROJECT_SCOPE.md` §10.1 rule 3).

---

## 8. The neutral client state

One state reaches the client for all of missing, forbidden, deleted and revoked:

```ts
{ kind: "unavailable" }
```

The reason lives in the server log, keyed by `receiptId`, and nowhere else — not in the payload,
not in an HTTP status, not in a header, not in a message string, not in a timing difference the
UI creates by branching. `SECURITY_AND_PRIVACY.md` §6 carries the full enumeration and the
negative tests.

`empty`, `archived` and `ready` remain distinct client states (`PROJECT_SCOPE.md` §8). Collapsing
those would be the opposite error: hiding truth the actor is entitled to.

---

## 9. Degradation vocabulary

Home extends the existing `providerCoverage` vocabulary
(`src/modules/signal/server/analytics/providers/coverage.ts:8-31`) rather than inventing a rival:

| Value | Means | Never rendered as |
|---|---|---|
| `complete` | every authorized source answered for the whole window | — |
| `partial` | N of M sources or Projects answered; `unresolvedCount` is exact | complete, or a smaller total |
| `stale` | answered from data older than its `staleAfter` | current |
| `unavailable` | could not ask | zero, empty, healthy, all clear |
| `unsupported` | this source cannot answer this question at all | zero |
| `insufficient-history` | the window is longer than the source's history | a flat trend, a zero trend, or "no change" |

`unsupported` and `insufficient-history` are Home additions and they exist because charter rule 11
names both and the current model has neither. Analytics history in particular is a **read path
over an empty table** — `captureWorkspaceSnapshots` has zero callers repo-wide
(`audit/B-domain-permissions.md:557-573`) — so every trend Home could draw today is
`insufficient-history`, and must say so rather than draw a flat line.

---

## 10. Home Read Scope is not persisted

Home writes nothing about Project context: not the cookie, not a server-side scope preference
(`PROJECT_SCOPE.md` §7.1, `DECISIONS.md` D-H07). Read Scope lives in the URL and dies with it.
Read Scope resets to `{ kind: "current-project" }` on any actor change
(`PROJECT_SCOPE.md` §10.1 rule 2).

The receipt is the *only* place the resolved context lives, and it lives there for one request.

---

## 11. Required interface

The acceptance surface for the landed seam. Consistent with `PROJECT_SCOPE.md` §11, which
specifies what Home requires of `src/lib/projects/**`; this section specifies what Home builds on
top of it, in paths this programme owns.

### 11.1 Modules

All six sit under `src/lib/home-layer/context/`. Five are **pure**; exactly one is server-only.

| Module | Exports | Status at this base |
|---|---|---|
| `policy.ts` (pure) | `HOME_AUTHORIZATION_STEPS`, `HOME_CONTEXT_AXES`, `validateRequestedGrouping`, `intersectAuthorizedProjects`, `neutralClientState`, `REJECTED_PROJECT_IDS` | **absent** |
| `receipt.ts` (pure) | the brand, `sealReceipt`, `assertReceipt`, `assertProjectAuthorized`, `assertMutationAllowed`, `assertProductionReceipt`, `toHomeContextView`, `RECEIPT_REJECTED_INPUTS`, `ProjectNotAuthorizedError` | **absent** |
| `authorize-home-context.ts` (**server-only**) | `authorizeHomeContext`, `HomeContextResult`, `HomeContextRefusal`, `HomeContextResolvers` | **absent** |
| `cache-partition.ts` (pure) | `HOME_CACHE_POSTURE`, `HOME_CACHE_PARTITION_KEY_FIELDS`, `homeCachePartitionKey` | **absent** |
| `telemetry.ts` (pure) | `HOME_TELEMETRY_ALLOWLIST`, `HOME_TELEMETRY_REJECTED_FIELDS`, `validateHomeTelemetryEvent` | **absent** |
| `sentinel.ts` (pure) | `NOTE_BODY_SENTINEL_PREFIX`, `NOTE_EXTRACT_SENTINEL_PREFIX`, `scanArtifactForSentinels` | **absent** |

`REJECTED_PROJECT_IDS` must contain `"ws-legacy"` — the literal value of `LEGACY_WORKSPACE_ID`
(`src/server/db/seed.ts:20`), still returned by `getActiveWorkspace()`'s third fallback
(`src/server/auth.ts:179`). Home refuses it at the seam rather than trusting it to have been
removed upstream (D-H03).

### 11.2 Pure core, thin ambient wrapper

**Required, not a preference.** Everything decidable — step order, grouping validation,
intersection, refusal selection, receipt shape and every assertion in §2.3 — lives in the pure
modules and imports nothing: no Clerk, no Next, no database, no `server-only`. Only the
unavoidably ambient part (resolving the session, the internal user, memberships, capabilities and
Active Project) lives in `authorize-home-context.ts`, and it takes its resolvers as an injectable
`HomeContextResolvers` so the pipeline's **ordering and refusals** can be exercised without a
database.

A rule you can only exercise inside a request is a rule you cannot test. This programme's
protected-lab policy is already built this way (`src/lib/home-layer/lab/policy.ts:1-13` and its
sibling `guard.ts`), and the context seam matches it deliberately.

### 11.3 What Home will not accept in the landed seam

- A `authorizeHomeContext` that returns a success with `coverage` inferred rather than reported.
- Any provider entry point whose first parameter is not a branded receipt.
- Any code path that reaches a membership query without going through step 4.
- A receipt that is JSON-serializable, or one that survives a request boundary.
- A refusal whose reason is visible to the client in any channel, including the HTTP status.
- A cache — of any kind, at any layer — keyed by fewer fields than §5.3.
- A Home mutation entry point that does not take an explicit `ProjectId`.

Divergence is recorded in `DECISIONS.md` as a new decision and escalated to the lead. It is never
absorbed silently.

---

## 12. Executable assertions

Written this wave as **failing** contract tests under `src/lib/home-layer/context/`. They fail
because the seam does not exist — that is the deliverable, not a bug.

| # | Assertion | File | Fails today because |
|---|---|---|---|
| H1 | `authorizeHomeContext` exists and is server-only | `authorize-home-context.contract.test.ts` | module absent |
| H2 | The nine steps are in the sealed order | same | module absent |
| H3 | No provider may run before step 9 | same | module absent |
| H4 | An unauthenticated request refuses; it never returns an empty result | same | module absent |
| H5 | A demo/review receipt is marked synthetic and refused by a production path | same | module absent |
| H6 | A provisional identity may read and may not mutate | same | module absent |
| H7 | `coverage` is reported, never inferred; empty ≠ unavailable | same | module absent |
| H8 | An unauthorized grouping refuses; it never downgrades | same | module absent |
| H9 | Active Project is resolved independently of the grouping and the intersection | same | module absent |
| H10 | `LEGACY_WORKSPACE_ID` never appears in a receipt | same | module absent |
| H11 | The receipt is branded; a structural copy is refused | `authorize-home-context.contract.test.ts` | module absent |
| H12 | A provider refuses a raw user id, workspace id, role string or browser list | same | module absent |
| H13 | A provider **throws** on an out-of-set Project; it does not filter | same | module absent |
| H14 | The receipt does not serialize and does not cross a request | same | module absent |
| H15 | An aggregate scope cannot reach a mutation | same | module absent |
| H16 | An explicit unavailable Project never substitutes | same | module absent |
| H17 | Missing / forbidden / deleted collapse to one client state with no reason | same | module absent |
| H18 | `HOME_CACHE_POSTURE` is `private, no-store` and no caching primitive is imported | `home-privacy-and-revocation.contract.test.ts` | module absent |
| H19 | The partition key contains every §5.3 field | same | module absent |
| H20 | Revocation denies across all six carriers | same | module absent |
| H21 | The telemetry allowlist admits only enumerated events and rejects (not strips) forbidden fields | same | module absent |
| H22 | The six contracted modules exist, and the one wrapper carries `server-only` | `home-context-boundary.contract.test.mjs` | files absent |
| H23 | No client component imports a context module | same | **refuses on an empty population** — there is nothing to import yet |
| H24 | No Home-layer module resolves tenancy for itself, introduces a caching primitive, or loses its contract docs | same | **passes today** — the control (see below) |
| H25 | Two sentinels, matched on their prefix so truncation cannot hide a leak | `home-privacy-and-revocation.contract.test.ts` | module absent |
| H26 | The sentinel scan fails on an empty population; it never reports clean | same | module absent |
| H27 | The extract sentinel is permitted only on a labelled approved-extract surface | same | module absent |

**H24 is deliberately green.** A test file in which every assertion is red cannot tell a real
failure from a bad path or a typo in a directory name. `home-context-boundary.contract.test.mjs`
therefore carries three standing guards over files that do exist — and they are the control. At
this base it reports **3 failed, 3 passed**; the other two files report 21 and 17 failed, 0
passed.

Run:

```
node --import tsx --test src/lib/home-layer/context/authorize-home-context.contract.test.ts
node --import tsx --test src/lib/home-layer/context/home-privacy-and-revocation.contract.test.ts
node --test src/lib/home-layer/context/home-context-boundary.contract.test.mjs
```

They are **not** wired into `pnpm test`. `package.json` is foreign-owned
(`COLLISION_REGISTER.md:69`, contended by PRs #126, #128 and #129 simultaneously at
`:44-46`). Wiring is a lead action on a merged base (**D-H21**).

---

## 13. Decisions taken in this contract

Ids continue `DECISIONS.md`, which ends at D-H13. If a parallel Wave 1 lane also claimed D-H14+,
the lead renumbers — the decision text is the durable part, the id is not.

| # | Decision | Rationale in one line |
|---|---|---|
| **D-H14** | A provisional identity (Clerk id standing in for `users.id`) may read and may not mutate, and may not claim completeness | Two addressable ids plus a write is how a row ends up owned by an id that never resolves again (`src/server/auth.ts:111-120`) |
| **D-H15** | An unparseable grouping canonicalises with a replace-redirect; an **unauthorized** grouping refuses and never downgrades | A downgrade renders narrower truth under a wider label, and confirms the period exists |
| **D-H16** | Seal **seven** context axes and record that the brief's list of "five" contains seven | Every pair has a distinct live defect attached to conflating it; there is no safe merge to reach five |
| **D-H17** | Providers **throw** on an out-of-set Project rather than filtering it out | Filtering converts an authorization bug into an invisible truth bug |
| **D-H18** | The receipt carries a per-Project done-definition digest | Any member can redefine Done (`src/server/actions/board.ts:282-301`), so comparability must be mechanical, not remembered |
| **D-H19** | A demo/review request yields a receipt marked synthetic that no production path accepts | Keeps synthetic and live evidence separable at the data seam, not only in the report |
| **D-H20** | The §5.3 partition key is specified now, before any cache is proposed | A key negotiated at proposal time is a key with fields missing |
| **D-H21** | Write the contract tests in this programme's own `src/lib/home-layer/context/`, and do **not** wire them into `package.json` | The path is uncontested (unlike D-H13's paths); `package.json` is contended by three open PRs |

---

## 14. Open, and owned elsewhere

1. **`src/lib/projects/**` has not landed.** Steps 4, 5 and 8 all call it. Owner:
   `lane/wp2-project-platform`.
2. **Deterministic bare-entry ordering is undefined** (`PROJECT_SCOPE.md` §13 item 2). Until it
   exists, step 8's fallback branch is non-deterministic and Home may not call the result "your
   project". Owner: lead / founder.
3. **`membershipRevision` has no source.** Nothing in the schema exposes a membership version and
   there is no invalidation worker (`captureWorkspaceSnapshots` has zero callers). V1 computes it
   per request from the resolved membership set; a durable revision is Wave 4+ work. Recorded so
   no one assumes a worker exists.
4. **Entitlement revision** is out of this contract's evidence. Entitlements exist
   (`src/lib/entitlements-shared/**`) but were not audited in Wave 0. Named in the partition key
   as required; its source is unresolved.
5. **The five-writer cookie consolidation** is unowned by any lane (`DECISIONS.md` D-H12). Home
   never reads or writes the cookie, so Home is not blocked — but the bare-entry hint it depends
   on is.
6. **Home's beta gate.** Home currently enforces a **stricter** gate than the product behind it,
   bouncing invited and redeemed members to `/waitlist`
   (`audit/B-domain-permissions.md:263-279`). Being fixed by session `task_1bf52417`
   (`COLLISION_REGISTER.md:29`). Step 2 must build on their corrected gate, not reintroduce the
   narrow one.
