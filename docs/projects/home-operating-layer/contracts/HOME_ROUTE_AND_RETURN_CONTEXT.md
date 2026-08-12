# Contract · Home route and return context

**Status:** Sealed (Wave 1). Binding on every Home route, link, redirect, contract test and
lab direction.
**Base:** `origin/main` @ `78021c5` · branch `feat/home-operating-layer` · worktree `_wt-home-layer`
**Adopts:** `docs/adr/0001-canonical-project-identity.md` §7, §8, §9 (merged in PR #125)
**Consumes:** `contracts/PROJECT_SCOPE.md` §4, §5, §7, §8, §9, §10, §11 — unamended
**Interfaces with (FOREIGN-OWNED, specified here, not written):** `src/lib/product-urls.ts`,
`src/lib/suite-contracts.v1.json`, `src/proxy.ts`, `next.config.ts`
**Decisions:** `D-HR01 … D-HR11` (§19)
**Tests:** `src/lib/home-layer/experience/` (§18)

This contract does not redefine Project identity. A Project is a Tasks `workspaces.id`
(`PROJECT_SCOPE.md` §1, ADR 0001 §1) and nothing below alters that. Where this contract
and `PROJECT_SCOPE.md` appear to disagree, `PROJECT_SCOPE.md` wins and the disagreement is
a defect in this file.

---

## 0. What this contract is, and what it is not

It is the **typed URL model** for the Home operating layer: what a Home URL may say, how it
is parsed, how it is written, what happens when it lies, and what the browser's Back button,
a refresh, a paste into another person's browser, and a return from a product surface each
mean.

It is **not** an implementation. At this base:

- `/app/home/inbox`, `/app/home/my-work` and `/app/home/analytics` **do not exist**
  (verified: no such directories under `src/app/app/home/`).
- `src/app/app/home/page.tsx` accepts **no search parameters at all** — it declares no
  `searchParams` prop (`src/app/app/home/page.tsx:16`).
- `briefingScope` has **zero occurrences anywhere in `src/`** (verified by grep across the
  worktree; it appears only in `docs/adr/0001-canonical-project-identity.md:162-163` and in
  this programme's own documents).
- `homeScope`, `lensProjectId`, `returnTo` and `item` have zero occurrences in `src/`.

So every rule below is a specification the implementation must satisfy, and §18 names the
file and line that makes each one fail today.

---

## 1. The locked authority, and what a new Home route costs

`docs/SUITE_URL_AND_NAMING_CONTRACT.md` is **locked** (its own status line, effective
2026-07-25, amended 2026-08-04). It names its executable half explicitly under
§"Implementation authority": `src/lib/suite-contracts.v1.json`, `src/lib/product-urls.ts`,
`src/proxy.ts`, `next.config.ts`. Its migration rule is unambiguous:

> Do not add a new product hostname, top-level app, URL fragment destination, or alternate
> product label without updating this contract and the matching Studio decision record in
> the same release.

**Consequence, sealed.** Adding `/app/home/inbox`, `/app/home/my-work` and
`/app/home/analytics` requires, **in one release**:

1. an edit to `docs/SUITE_URL_AND_NAMING_CONTRACT.md` adding the three destinations to the
   Home block of §"Canonical URLs";
2. typed constants in `src/lib/product-urls.ts` (§17 — interface only, foreign-owned);
3. a paired **Studio decision record** in the `studio` repo under
   `content/hq/decisions/`, opened as its own PR in the same cycle, per the app repo's
   `AGENTS.md` §"Signal HQ sync" row *decision on pricing, brand, GTM, product*;
4. `scripts/check-route-manifest.mjs` left intact — it is removal-only (`:14-17`), so new
   routes are not an error there, but `app/inbox` and `app/my-tasks` are pinned at `:44-45`
   and **must keep existing** as redirect stubs (§15.4).

This is `R-H06`. It is a Wave 4 deliverable, not a Wave 9 record-keeping chore, and it must
be authored from a clean Studio worktree.

**What this contract does not do.** It does not add `home` to
`src/lib/suite-contracts.v1.json`'s `products` map. Home is not a product (charter locked
decision 1; the URL contract's own product table marks Home "— (not marketed as a product)").
`suite-contracts.v1.json` still carries a `signal` product entry with
`appUrl: https://app.signalstudio.ie/app/signal` — a path that 308s at the edge
(`src/proxy.ts:262-267`). Correcting that entry is the Project Truth wave's, per
`DECISIONS.md`'s register of what this programme decided not to decide ("Retiring the V2
suite-context emitter"). Recorded here so Wave 4 does not quietly fix it and inherit the file.

---

## 2. The Home route family

| Route | Mode | Exists at this base |
|---|---|---|
| `/app/home` | Today | **yes** — `src/app/app/home/page.tsx` |
| `/app/home/briefing` | Full briefing (depth from Today, not a fifth mode) | **yes** — `src/app/app/home/briefing/page.tsx` |
| `/app/home/inbox` | Inbox | **no** |
| `/app/home/my-work` | My work | **no** |
| `/app/home/analytics` | Analytics | **no** |

`/app` redirects to `/app/home` (`src/app/app/page.tsx:34`, using `HOME_APP_PATH` from
`src/lib/product-urls.ts:94`). That behaviour is preserved; §15.1 states what happens to the
`contextVersion=2` branch above it (`page.tsx:17-30`).

**No Home mode is a query parameter on another Home mode.** Four stable, text-labelled,
route-backed modes is charter locked decision 4. `?mode=inbox` is prohibited: it makes Back
walk mode changes, breaks per-route titles, and makes the mode invisible to
`experience/registry.json`, which discovers `page.tsx` / `loading.tsx` / `error.tsx` and not
layouts (audit C §10 trap 5).

---

## 3. The typed URL state — eight parameters, and where each is valid

```ts
type HomeUrlState = {
  route: HomeRoute;                 // derived from the pathname, never a parameter
  readScope: HomeReadScope;         // homeScope (+ planningPeriodId)
  activeProject: ProjectId | null;  // workspaceId
  period: AnalyticsPeriodName | null;
  selection: HomeSelection | null;  // event | item
  lens: ProjectId | null;           // lensProjectId
  returnTo: SameOriginPath | null;
};
```

| Parameter | Domain | Valid on | Axis it belongs to |
|---|---|---|---|
| `homeScope` | `all` \| `project` \| `planning-period` | all five Home routes | **Read Scope** |
| `planningPeriodId` | `CONTEXT_ID` | Home routes, **only** with `homeScope=planning-period` | **Read Scope** (operand) |
| `workspaceId` | `CONTEXT_ID` | all app routes | **Active Project** |
| `period` | `four_weeks` \| `twelve_weeks` \| `six_months` \| `twelve_months` | `/app/home/analytics` only | read window |
| `event` | `CONTEXT_ID` | `/app/home/inbox` only | selection |
| `item` | `CONTEXT_ID` | `/app/home`, `/app/home/briefing`, `/app/home/my-work` | selection |
| `lensProjectId` | `CONTEXT_ID` | all five Home routes | **overlay — neither axis** |
| `returnTo` | same-origin relative path, ≤ 512 chars | all five Home routes | navigation hint |

**Two axes, never one.** `homeScope` is what Home may *read together*; `workspaceId` is what
a product route renders and a mutation targets. This is `PROJECT_SCOPE.md` §5 and D-H04,
restated, not re-decided. A third value — the Lens — is deliberately neither.

### 3.1 The three-way relationship, stated exactly

This is the heart of the contract. Each row is binding.

| `homeScope` | `workspaceId` present? | What Home **reads** | What is the **Active Project** |
|---|---|---|---|
| `project` | **required** | exactly that one Project | **that same Project** |
| `project` | absent | — invalid, §9.2 | — |
| `all` | present | **every authorized Project** — the id does **not** filter | that Project, if still valid |
| `all` | absent | every authorized Project | resolved by `PROJECT_SCOPE.md` §4.2 step 3 |
| `planning-period` | present | every authorized Project in that Planning Period | that Project, if still valid |
| `planning-period` | absent | every authorized Project in that Planning Period | resolved by §4.2 step 3 |

Read the two middle rows twice. **Under `all` and `planning-period`, a present
`workspaceId` carries only the still-valid Active Project and never narrows the Home read.**
It is the answer to "where does the button go", not "what am I looking at". A reader on
`?homeScope=all&workspaceId=W` sees every Project; pressing a product link from that page
lands in `W`.

**Under `homeScope=project`, the two collapse into one value and must be freshly
authorized on that request** — not read from a cookie, not carried from a provider, not
trusted because a previous render authorized it. `PROJECT_SCOPE.md` §3 rule 4: membership is
revalidated per request; revocation takes effect on the next request.

### 3.2 The Project Lens changes nothing

`lensProjectId` opens a **Project Lens** — a scoped view of one Project layered over the
current Home mode, without leaving it.

**Sealed.** Opening, changing or closing a Lens changes **neither** Home Read Scope **nor**
Active Project. Concretely:

- `?homeScope=all&workspaceId=W&lensProjectId=L` reads across all Projects, shows the Lens
  on `L`, and any product link still targets `W`.
- Closing the Lens removes exactly one parameter and restores exactly the view underneath.
- The Lens is authorized in its own right (`PROJECT_SCOPE.md` §3 rule 1). An unauthorized
  `lensProjectId` is `unavailable` (§9.4) — the Lens does not open and **the page underneath
  is unchanged**. It never falls back to `W`, and it never widens.
- A Lens is **not** a Project selection. To make `L` active the reader must take the
  explicit switch (`PROJECT_SCOPE.md` §4.3), which pushes history and resets Read Scope.

**Why a separate parameter rather than reusing `workspaceId`.** Reusing it would make
"look at this Project for a second" indistinguishable from "work in this Project", which is
precisely the conflation `PROJECT_SCOPE.md` §5 calls a release blocker. The failure is not
hypothetical: `/api/suite-context` already writes the active-Project cookie on what is meant
to be a *contextual link handoff* (`src/app/api/suite-context/route.ts:60-66`), recorded as
the D-H12 conflict. A distinct, never-persisted parameter makes the same mistake
unrepresentable.

---

## 4. Parsing — exact

One parser. It is total: every input produces a `HomeUrlState` plus a list of
`HomeUrlNotice` values. It never throws on user input and it never guesses.

### 4.1 Identifier grammar

```
CONTEXT_ID = /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/
```

This is not invented. It is the grammar already enforced at the suite-context boundary —
`src/lib/suite-context.ts:8`, applied by `isSuiteContextId` at
`src/app/api/suite-context/route.ts:29-30` and `:55`,
`src/components/app/suite-context-publisher.tsx:19`, and
`src/components/app/use-suite-context.ts:18-22`. Home adopts it unchanged so a value that
survives a contextual link also survives a Home URL.

**Recorded divergence.** The analytics query parser uses a *wider* grammar,
`/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/` (`src/modules/signal/server/analytics/query.ts:59`),
which additionally admits `.` and `:`; and `boundedIdentifier` in
`src/lib/suite-context.ts:38-45` admits up to 200 characters of anything without control
characters. Three grammars for one id space already exist. Home fails closed on the
narrowest: a value accepted by the analytics parser but rejected by `CONTEXT_ID` is treated
as invalid at the Home boundary (§9.4). This is a deliberate narrowing, recorded as
**D-HR03**, and it is the reason §18 assertion `U6` exists.

### 4.2 Parse order

1. **Derive the route from the pathname.** The route is never a parameter. An unknown
   `/app/home/*` path is a 404 — never a silent fall back to Today.
2. **Reject before reading.** A query string longer than **2,048 characters**, or carrying
   more than **24** parameters, is discarded whole: the route renders at its defaults with
   the notice `query-discarded`. Neither limit is a security control; both stop a pathological
   URL from becoming a rendering decision.
3. **Read each key at most once.** A repeated key (`?item=a&item=b`) takes **no** value and
   emits `duplicate-parameter`. First-wins and last-wins are both silent guesses about intent.
4. **Trim, then validate.** Leading and trailing ASCII whitespace is trimmed. An empty value
   after trimming is treated as **absent**, not invalid, and emits no notice —
   `?workspaceId=` is how a form serialises "nothing", and it is not a lie.
5. **Values are case-sensitive.** `homeScope=All` is invalid, not `all`. Ids are opaque and
   case-sensitive because `workspaces.id` is a text primary key
   (`src/server/db/schema.ts:272-273`); a case-insensitive read would make two distinct
   Projects collide at the URL boundary.
6. **Any control character (U+0000–U+001F, U+007F) in any value invalidates that value.**
   This mirrors `boundedIdentifier` (`src/lib/suite-context.ts:41`).
7. **Unknown keys are dropped**, recorded as `unknown-parameter`, and removed by the
   canonicalising redirect (§6.4). They are never forwarded to a product link.
8. **Known keys on the wrong route are dropped** with `parameter-not-valid-here` — for
   example `event` on `/app/home/my-work`. Same treatment; different notice, because the two
   describe different authoring mistakes.

### 4.3 Per-parameter rules

**`homeScope`** — exactly one of `all`, `project`, `planning-period`. Absent means the
default, which is **`project`** (`HomeReadScope.kind === "current-project"`,
`PROJECT_SCOPE.md` §5). Any other value emits `homeScope-invalid` and falls to the default,
**and the default is disclosed** — the reader sees a named, current-Project view, and the
label says so (`PROJECT_SCOPE.md` §5 rule 1). A silently-defaulted aggregate would render a
narrow read under a widened promise.

**`planningPeriodId`** — required when `homeScope=planning-period`, prohibited otherwise.
Present without it → `parameter-not-valid-here`, dropped. `homeScope=planning-period` without
it → `planning-period-missing`, and the scope falls to the default `project` **with the
notice surfaced**, never to `all`. Falling *outward* from a named group to everything is the
one substitution that silently widens a read, and §9 forbids substitution in both directions.

**`workspaceId`** — a `CONTEXT_ID`. Shape validity is not authorization. It is authorized on
every request through the single facade (`PROJECT_SCOPE.md` §11.2 `resolveProjectRoute`), and
the outcomes are exactly `ready` · `archived` · `unavailable` · `empty`
(`PROJECT_SCOPE.md` §8).

**`period`** — one of `four_weeks`, `twelve_weeks`, `six_months`, `twelve_months`. This is
`ANALYTICS_PERIODS` (`src/modules/signal/server/analytics/query.ts:4-10`) **minus `custom`**,
adopted rather than invented so Home's URL and the analytics query speak one vocabulary.
Default `four_weeks`, matching `query.ts:81`.

`period=custom` is **recognised and refused**, not treated as unknown: it emits
`period-unsupported`, Home renders `four_weeks`, and the window actually rendered is stated
on the surface. `custom` needs `start` and `end`, a 366-day ceiling
(`query.ts:58`, `:144-146`) and a shareable-URL disclosure question this contract has not
answered, so Wave 8 may add it — by amending this section, not by widening the parser.

`start` and `end` are **not** Home URL parameters. `query.ts:134-136` already refuses them
without `period=custom`; Home does not introduce a second place where a raw date range rides
a URL.

**A `period` is a request, never a claim.** `captureWorkspaceSnapshots` has **zero callers
repo-wide** (`REPOSITORY_TRUTH.md` finding 7, `R-H12`), so analytics history is a read over
an empty table. A `period` that the available history does not cover renders as
**insufficient history** — the state `insufficient_history` already exists in the analytics
fixture vocabulary (`query.ts:55`, `:116`) — never as zero, never as flat, never as healthy.
This is charter locked decision 11 applied to a URL parameter.

**`event`, `item`** — `CONTEXT_ID`. A selection is a *view* parameter: it opens or focuses a
row. Selecting never mutates and never changes either axis. An `event` or `item` that does
not resolve, or that the actor may not see, produces §9.5 — the mode renders, the selection
does not open, and the notice says the item is unavailable **without saying whether it
exists** (`PROJECT_SCOPE.md` §8.1: distinguishing "gone" from "forbidden" is an existence
leak).

**`lensProjectId`** — `CONTEXT_ID`, §3.2.

**`returnTo`** — §14.

---

## 5. Precedence

When two inputs disagree, this order decides. It is `PROJECT_SCOPE.md` §4.1 with the Home
parameters slotted in, and it adds nothing to that authority model.

1. **The pathname.** The route is not negotiable.
2. **An object named in the URL** (`item`, `event`, or a source deep link, §13). Its stored
   Project is derived server-side and it **wins over a supplied `workspaceId`** that
   disagrees — see §13.2.
3. **`workspaceId` in the URL**, freshly authorized.
4. **The active-Project cookie**, but *only* on a bare entry with no `workspaceId`
   (`PROJECT_SCOPE.md` §4.2 step 3). Home never writes it (§7) and no Home client code reads
   it — at this base it is not reliably `HttpOnly`: two of its five writers set it readable
   (`src/server/actions/cross-workspace.ts:196`, `src/server/actions/settings.ts:614-618`),
   recorded as D-H12.
5. **The first accessible active Project by deterministic ordering** — which is **not
   defined today**. `getActiveWorkspace()`'s second fallback is an unordered `.limit(1)`
   (`src/server/auth.ts:169-174`). Until §11.2 of `PROJECT_SCOPE.md` supplies a documented
   total order, bare entry is non-deterministic and Home must **name the Project it landed
   in** before the reader acts in it (`PROJECT_SCOPE.md` §7.3).
6. **Never `LEGACY_WORKSPACE_ID`** (`src/server/auth.ts:179`). D-H03 makes this a Home
   precondition, not a downstream target.

No Home client provider silently overrides the URL, and no Home surface authorizes from a
provider (`PROJECT_SCOPE.md` §4.1, rows 4 and 5).

---

## 6. Serialization — one builder, one shape

### 6.1 One builder, no exceptions

Every Home URL — every link, every redirect, every history entry, every share affordance, every
test fixture — is produced by `buildHomeUrl` (§16). String concatenation of a Home path is a
contract violation, and §18 assertion `U1` is the guard.

The reason is `home-data.ts`. Home's own evidence rows are built by hand today —
`` `/app/task/${id}` `` at `src/app/app/home/home-data.ts:82-84` — and that is exactly why
every Home evidence link ships **without a Project**, while the Full Briefing's links carry
one and the destination discards it (`src/app/app/tasks/page.tsx:18-21` reads only `welcome`).
One builder is not tidiness. It is the only thing that makes "every contextual link carries
`workspaceId`" (`PROJECT_SCOPE.md` §10.2) checkable.

### 6.2 Canonical form

- Parameters are emitted in this fixed order: `homeScope`, `planningPeriodId`, `workspaceId`,
  `period`, `event`, `item`, `lensProjectId`, `returnTo`. A fixed order makes two URLs for
  the same state byte-identical, which is what lets a test, a cache key and a human diff agree.
- **A parameter at its default is omitted.** `homeScope=project` with no other Home state
  serialises to a bare `/app/home`. `period=four_weeks` is omitted on
  `/app/home/analytics`. Defaults in the URL are noise that later reads as intent.
- **`workspaceId` is not a default and is never omitted when known.** Home emits it on every
  contextual link it builds (`PROJECT_SCOPE.md` §4.1, row 1), including links to the same
  Home route.
- No empty values are ever emitted. If a value is absent the key is absent.
- Values are encoded with `URLSearchParams`. `returnTo` is percent-encoded as a single value
  and never spliced.
- **`all-projects` is never encoded inside `workspaceId`.** No sentinel, no `*`, no empty
  string standing for "everything" (`PROJECT_SCOPE.md` §5 rule 2, D-H04, assertion A11).

### 6.3 What Home links never emit

Per ADR 0001 §8: new links must not emit `sourceProduct`, `contextVersion`, or a global
`projectId`. Home adds `scope_id`, `scope_type` and `workspace_id` to that list — the
signal-native keys that `normalizeSuiteContextForSignal` writes
(`src/lib/suite-context.ts:69-78`). Home consumes normalization; it never produces its output
shape.

ADR 0001 §8 also bars new links from emitting `planningPeriodId`. §19 D-HR02 records exactly
why Home is the one exception and how narrow the exception is.

### 6.4 The canonicalising redirect

When a parsed URL is not already in canonical form — because it carried an unknown key, a
duplicate key, an invalid value, a legacy alias (§15), a default that could be omitted, or a
parameter out of order — Home issues **one** redirect to the canonical URL, and it
**replaces** history (`PROJECT_SCOPE.md` §10.2, D-H10). Never a push: a canonicalisation is
not a place the reader chose to be, and Back must not have to walk it.

Exactly one canonicalising redirect per navigation. If canonical form is not reached in one
hop the parser is wrong, and `U7` asserts it.

Notices survive the redirect. A `homeScope-invalid` that produced a fallback is still shown
after the hop, because the notice describes what the reader asked for, and the canonical URL
no longer records it.

---

## 7. Persistence

**Home persists nothing about Project context.** `PROJECT_SCOPE.md` §7.1 and D-H07, adopted
without addition:

- Home never writes the active-Project cookie. Not on a Read Scope change, not on a Lens,
  not on a selection, not on a source return.
- Home never persists Read Scope, `period`, selection or Lens to the server, to
  `localStorage`, to `sessionStorage`, or to a user-preferences row. All of it lives in the
  URL and dies with the URL.
- Following a Home contextual link does not change the Active Project unless the link is an
  explicit Project selection.

**One deliberate exception, and its bound.** Scroll position and focus restoration (§11.3)
use the browser's own history-state slot keyed to the history entry. That is not a
preference, it is not readable across entries, it does not survive the tab, and it carries no
Project id — only an offset and an element key. Anything richer is persistence and is
prohibited.

**The precedent Home is refusing.** The legacy Inbox stores its read state in client
`localStorage` (`src/components/app/inbox/inbox-app.tsx:207-217`) and the whole nudges
section returns `null` until hydrated (`:226-245`), so it pops in after mount. `R-H12` records
that there is no server-side unread model at all. A Home Inbox that persists selection or
read state client-side would rebuild that defect one wave after documenting it.

---

## 8. Reset

| Reset | Effect | History |
|---|---|---|
| **Reset Read Scope** | `homeScope` → `project`, `planningPeriodId` dropped. Always one action from any aggregate view (`PROJECT_SCOPE.md` §7.3). | replace |
| **Close the Lens** | `lensProjectId` dropped. Nothing else changes. | replace |
| **Clear selection** | `event` / `item` dropped. Focus returns to the row that opened it (§11.4). | replace |
| **Reset the window** | `period` dropped, i.e. back to `four_weeks`. | replace |
| **Reset Active Project** | **not a Home affordance.** Only an explicit Project selection changes it (`PROJECT_SCOPE.md` §7.3). | — |

"Back to Home" from any Home mode means `/app/home` carrying the current `workspaceId` and
nothing else — not the last Read Scope, not the last selection. It is a reset, and it is the
route the `unavailable` state offers onward (`PROJECT_SCOPE.md` §8.1).

---

## 9. Invalid state — the complete matrix

The governing rule, from the charter (locked decision 11) and `PROJECT_SCOPE.md` §8.1:
**a state that could not be resolved is never rendered as zero, empty, healthy, complete or
all clear, and is never replaced by a state that could.**

| # | Input | Outcome | Notice | Substitution |
|---|---|---|---|---|
| 9.1 | Unknown `/app/home/*` path | **404** | — | never |
| 9.2 | `homeScope=project`, no `workspaceId` | resolve per `PROJECT_SCOPE.md` §4.2 step 3 (cookie → deterministic first → empty), then **replace-redirect** to the canonical URL now carrying the resolved `workspaceId`; the resolved Project is **named on the page** | `project-resolved-by-fallback` | not a substitution — nothing explicit was overridden |
| 9.3 | `workspaceId` malformed (fails `CONTEXT_ID`) | treated as absent → 9.2 | `workspaceId-invalid` | never |
| 9.4 | `workspaceId` well-formed but **unauthorized, missing or deleted** | `{ kind: "unavailable" }`. Home names the state plainly, does **not** say why, and offers a route onward: choose another Project, or Home at `homeScope=all` | `project-unavailable` | **never.** No other Project is chosen. Never rendered as empty or all clear |
| 9.5 | `workspaceId` resolves **archived** | renders, read-only for Project-scoped operations, visibly labelled Archived (`PROJECT_SCOPE.md` §8.3) | `project-archived` | never |
| 9.6 | `planningPeriodId` unauthorized or unknown | the aggregate does **not** open; Read Scope falls to `project` **with the notice shown** | `planning-period-unavailable` | never — and specifically never to `all` |
| 9.7 | `lensProjectId` unauthorized, malformed or unknown | the Lens does not open; **the page underneath is unchanged** | `lens-unavailable` | never |
| 9.8 | `event` / `item` unresolvable or forbidden | the mode renders; the selection does not open; the reason is not disclosed | `selection-unavailable` | never |
| 9.9 | `period` outside the vocabulary | `four_weeks`, and the window rendered is stated on the surface | `period-invalid` | disclosed default, not a silent one |
| 9.10 | `period=custom` | as 9.9 | `period-unsupported` | as 9.9 |
| 9.11 | `period` valid but history does not cover it | **insufficient history** — a named state, not a chart of zero | `insufficient-history` | never |
| 9.12 | `returnTo` fails §14 | dropped entirely | `returnTo-rejected` | falls to the static Home route, never to a guessed destination |
| 9.13 | Partial authorization under `all` — N of M Projects resolve | renders the N, **states the count it read and that the rest were unavailable** (`PROJECT_SCOPE.md` §5 rule 4) | `projects-partial` | the M−N are never rendered as zero, complete or all clear |
| 9.14 | Every source unavailable under `all` | **unavailable**, not empty | `projects-unavailable` | never |
| 9.15 | Query > 2,048 chars or > 24 parameters | route renders at its defaults | `query-discarded` | disclosed |

**9.4 and 9.13 are the two that matter most.** 9.4 is where a stale link from a Slack
message, a bookmark or a shared URL arrives after a revocation; substituting a Project there
means the reader believes they are looking at the thing they clicked. 9.13 is where
`selectAuthorizedWorkspaceHint`'s existing defect lives — it falls through a `??` chain and,
when an explicit `workspaceId` is unauthorized, silently selects a *different* Project sharing
the Planning Period (`src/modules/notes/server/tasks-personalization.ts:192-209`). Home does
not resolve a Project by Planning Period membership, ever (`PROJECT_SCOPE.md` §2.5).

---

## 10. Cross-account switching

"Cross-account" means the signed-in **person** changed. There are no organisations
(`PROJECT_SCOPE.md` §3.2: zero `orgId` / `organization` references in `src/server/auth.ts`
and `src/proxy.ts`).

**The finding this contract is built against.** No sign-out path clears `tasks_active_ws`.
The only deletions are Project-delete (`src/server/actions/planning.ts:290`,
`src/server/actions/settings.ts:823`) and full account deletion
(`src/components/settings/profile/danger-zone.tsx:95`). Four of the five writers set
`path: "/"` with a 30-day `maxAge`, and nothing in the value records who chose it. So the
cookie **survives an actor change** (D-H09).

**Sealed rules.**

1. On any authentication transition, **Read Scope resets** to `project`, and `period`,
   `event`, `item`, `lensProjectId` and `returnTo` are all dropped. An aggregate view never
   persists across an actor change, and neither does a selection.
2. A `workspaceId` in the URL that the new actor is not a member of resolves to
   `unavailable` (9.4) — never a substitution, and never a reason code that confirms the
   Project exists.
3. Home renders no cached content from a previous actor. Every `/app` route is
   `force-dynamic` today (`src/app/app/layout.tsx:21`, `src/app/app/home/page.tsx:8`,
   `src/app/app/home/briefing/page.tsx:4`) and Home does not opt out. Home introduces no
   `unstable_cache`, `"use cache"`, `cacheLife`, `cacheTag` or `revalidateTag` — none exists
   anywhere in this repository today (`audit/B-domain-permissions.md:576-580`) and Home is
   not where that starts.
4. A restore from `bfcache` **re-resolves Project state before painting**
   (`PROJECT_SCOPE.md` §10.2). A page restored with a since-revoked Project is a stale
   authorization render, and it is the one place where "restore scroll and focus" must lose
   to "re-authorize".
5. Home requires the persisted hint to be **actor-bound or cleared on every authentication
   transition** (`PROJECT_SCOPE.md` §11.2). Home cannot fix it — the cookie is written in
   five foreign-adjacent action files — so it is a gate, not a task.

---

## 11. Back, refresh and restoration

### 11.1 History semantics

`PROJECT_SCOPE.md` §10.2, extended to the Home parameters. Read Scope, Lens, selection and
window are all **replace**; only a real navigation pushes.

| Action | History | Active Project | Read Scope |
|---|---|---|---|
| Explicit Project selection | **push** | changes | resets to `project` |
| Read Scope change | **replace** | unchanged | changes |
| `period` change | **replace** | unchanged | unchanged |
| Open / change / close the Lens | **replace** | unchanged | unchanged |
| Open or clear a selection | **replace** | unchanged | unchanged |
| Home mode change (Today → Inbox → …) | **push** | unchanged, carried | carried |
| Home → product contextual link | push | unchanged, carried in the link | n/a |
| Back from a product to Home | pop | restored from the URL | restored from the URL |
| Canonicalising redirect (§6.4) | **replace** | resolved | unchanged |

A mode change pushes because the four modes are routes with distinct titles and distinct
jobs; going back from My work to Today is what Back should mean. A filter change replaces
because a stack of filter states that Back has to walk before it leaves the page is the
behaviour D-H10 rejected by name.

### 11.2 Refresh

A refresh must reproduce the same view, because every piece of view state is in the URL. The
one thing it must **not** reproduce is authorization: every parameter is re-authorized on the
new request, so a refresh after a revocation lands on 9.4 rather than re-rendering.

### 11.3 Scroll restoration

- Home sets `history.scrollRestoration = "manual"` and restores scroll itself, keyed to the
  history entry, **after** the restored view's Project state has resolved (§10 rule 4).
  Restoring a scroll offset onto a page that is about to become `unavailable` puts the reader
  at row 40 of an error.
- The scroll owner must be **named**, not inferred. At this base the module `<main>` already
  carries `overflow-y-auto` (`src/components/app/product-workspace-shell.tsx:53`) and
  `HomeView` opens **another** `overflow-auto` (`src/components/app/home/home-view.tsx:25`).
  Two nested scroll containers means "the scroll position" is ambiguous. Wave 4 resolves
  ownership to exactly one element per Home mode and the restoration contract binds to that
  element (audit C §10 trap 11).
- Under `prefers-reduced-motion`, restoration is instant. It is instant anyway — a smooth
  scroll to a restored offset is animation that owns durable state, forbidden by the delight
  motion contract (audit C §5.3).

### 11.4 Selection and focus restoration

- Back into a Home mode restores: **Read Scope, Active Project, mode, selection, focus and
  scroll** — all six. Five of the six come free from the URL; focus does not.
- Focus restores to the element that owned it, identified by a stable key, not by DOM index.
  If that element is gone, focus goes to the mode's `<h1>` container (the route focus target,
  `HOME_EXPERIENCE.md` §7) — never to `<body>`, which silently sends a screen-reader user back
  to the top of the document.
- Closing a selection returns focus to the row that opened it. The repository already has the
  pattern to copy: `useTaskPanel`'s module-scope focus-origin restore
  (`src/lib/tasks/use-task-panel.ts:17-30`) and `Dialog`'s focus return
  (`src/components/primitives/dialog.tsx:101`).

---

## 12. Share

A Home URL is shareable. It must not be a leak, and it must not lie to the person who opens it.

1. **A Home URL carries no content and no name.** Ids only. No task title, no Project name,
   no counts, no `returnTo` that embeds a title. The parameter set in §3 is closed.
2. **The recipient's authorization is resolved fresh, against the recipient.** Every id in the
   URL is re-authorized. Any id they may not see is `unavailable` (9.4, 9.6, 9.7, 9.8) — a
   neutral state that does not reveal whether the object exists.
3. **A shared URL never changes the recipient's Active Project as a side effect of being
   opened.** Under `homeScope=project` the URL *is* the context for that render, and the
   product links on the page target it; the persisted hint is still only written by an
   explicit selection (§7).
4. **`returnTo` is dropped on a shared entry.** A return hint that made sense in the sender's
   session is meaningless in the recipient's, and §14.6 drops it on any entry that is not a
   same-session hand-off.
5. Home surfaces no "copy link" affordance that widens what the URL says beyond what the
   reader is currently looking at. The existing precedent to be careful with is the Inbox's
   "Copy share-card link for this week" and "Copy this week as Slack-ready text"
   (`design/current-product-evidence/desktop-1440/inbox.aria.txt:69-70`), which copy *content*,
   not a URL. That is a different affordance with a different privacy question, and it is out
   of scope here.

---

## 13. Source deep links and source return

### 13.1 The shape of the problem, at this base

Three defects that a Home link contract has to fix rather than inherit:

- **Home's own evidence links carry no Project.** `src/app/app/home/home-data.ts:82-84`
  emits `` `/app/task/${id}` ``. Confirmed live: every row on the captured Home page links to
  `/app/task/demo-t-06`, `/app/task/demo-t-05`, `/app/task/demo-task-menu-tasting` with no
  parameters (`design/current-product-evidence/desktop-1440/home.aria.txt:36`, `:39`, `:42`).
- **The destination discards what it is given.** `/app/tasks` reads only `welcome`
  (`src/app/app/tasks/page.tsx:18-21`) and `tasks-runtime-shell.tsx:68` then resolves
  ambiently. `/app/task/[id]` accepts **no** search params at all
  (`src/app/app/task/[id]/page.tsx:15-17`), its own comment reading "Not found or wrong
  workspace".
- **The one endpoint that does consume context sends everyone to a broken page.**
  `GET /api/suite-context` redirects to `/app/your-work` in **both** branches
  (`src/app/api/suite-context/route.ts:23`, `:54`) — and `/app/your-work` throws in review
  mode with `mainCount: 0`, `h1Count: 0` and a failed-query console error at all three
  viewports (`design/current-product-evidence/structural-audit.json`,
  `your-work@desktop-1440`). It also writes the active-Project cookie on that handoff
  (`:60-66`), the D-H12 conflict.

### 13.2 The rule

> **A source deep link derives its Project from the object, reauthorizes it, and routes to
> that context. It never routes to an unrelated Active Project.**

Precisely, for any link that names a source object — a task, a note extract, an event, a
milestone — whether it points into Home or out of Home:

1. The object row is loaded and **its stored Project is derived server-side**. The client's
   claim about which Project the object is in is a hint, never the answer. This is
   `PROJECT_SCOPE.md` §9's "object operation" pattern applied to reads.
2. **Capability is verified in the same operation.** Not in the UI, not on a previous request.
3. The destination URL is then built with the **derived** Project as `workspaceId`.
4. **If the supplied `workspaceId` disagrees with the derived one, the derived one wins and
   the correction is disclosed.** A disagreement is a stale-UI signal, and rendering the
   supplied Project instead would show the reader a different Project than the object they
   clicked. It is never resolved silently in either direction.
5. If the object does not resolve, or the actor may not see it, the outcome is 9.8 — the
   destination mode renders, the object does not open, and no reason is given.
6. **The Active Project is not changed by following the link.** The destination *renders* the
   derived Project because the URL says so; the persisted hint is untouched (§7). Only an
   explicit selection changes it (`PROJECT_SCOPE.md` §4.3).

### 13.3 Return

- A link out of Home carries `returnTo` set to the **canonical current Home URL** (§6.2) —
  built by `buildHomeUrl`, so the reader returns to the same mode, scope, window, selection
  and Lens.
- The destination's back affordance is a real, labelled control. `returnTo` is a **hint**
  (§14): the control exists whether or not the hint survived, and when it did not, it points
  at `/app/home` carrying the current `workspaceId`.
- Browser Back is not replaced, disabled or intercepted. `returnTo` is an *additional*
  affordance for readers who arrived by a route Back cannot express — a new tab, a pasted
  link, a redirect chain.
- **A return is a navigation, not a restoration of trust.** The Home route re-resolves every
  parameter on arrival (§11.2).

### 13.4 Timeline sources

A Timeline-derived link resolves Project → Timeline, **never the reverse**
(`PROJECT_SCOPE.md` §2.2). Home never accepts a Timeline slug, a `(workspace_slug, slug)`
pair, or an `ms-…` milestone node id as an inbound Project identity. The valid resolver
outcomes are exactly `exact · provisioned · owner-reconciliation-required · archived ·
denied · failed` (ADR 0001 §6), and `owner-reconciliation-required` — which **has no UI
today** (`docs/wave/DECISIONS.md` D-017, carried forward) — renders as a named, honest refusal
with a route onward. Never "no Timeline", never an empty Timeline, never another Timeline.

---

## 14. `returnTo`

1. **Same-origin, relative, and path-only.** It must begin with a single `/` and must not
   begin with `//` or `/\`. Any value containing `:` before the first `/`, any absolute URL,
   any scheme, any authority component, any backslash, and any control character is rejected.
   `//evil.example` is a protocol-relative URL, not a path, and it is the specific attack this
   rule exists for.
2. **Length-bounded** at 512 characters after decoding. Longer is rejected, not truncated —
   a truncated path is a different path.
3. **Typed and allow-listed by prefix.** It must resolve to a known app route family:
   `/app/home`, `/app/notes`, `/app/tasks`, `/app/timeline`, `/app/task/`, `/app/project`, or
   `/settings/`. An unrecognised path is rejected. An allow-list is required because the
   destination set is small and closed; a deny-list would have to anticipate every future route.
4. **It carries no fragment and no credentials.** A `#` and everything after it is stripped.
5. **It is a hint, never authority.** It never grants access, never selects a Project, never
   sets Read Scope, and never suppresses the re-resolution in §11.2. Following it is an
   ordinary navigation that authorizes normally on arrival.
6. **It is dropped** on: any authentication transition (§10 rule 1); an entry that is not a
   same-session hand-off (§12.4); and any redirect chain longer than one hop.
7. **It is never chained.** A `returnTo` value may not itself contain a `returnTo` parameter.
   Nested return hints are how a redirect loop is built.
8. Rejection is silent to the reader in the sense that no error is raised — the back
   affordance simply points at `/app/home` — but it emits `returnTo-rejected` (9.12) so it is
   visible in telemetry and in tests.

---

## 15. Legacy normalization

### 15.1 What exists at this base

| Input | Handled by | Result |
|---|---|---|
| `/app/signal`, `/app/signal/*` | `src/proxy.ts:262-267` | **308** to `/app/home/briefing…`, query preserved |
| `/app/brief`, `/app/brief/*` | `next.config.ts:394-402` | **307** to `/app/signal…`, which then 308s — **a two-hop chain** |
| `/app/board`, `/app/tasks/board` | `next.config.ts:364-373` | 307 → `/app/tasks` |
| `/app/list`, `/app/calendar` | `next.config.ts:374-383` | 307 → `/app/tasks/list`, `/app/tasks/calendar` |
| `/app/plan`, `/app/plan/*` | `next.config.ts:384-393` | 307 → `/app/timeline…` |
| `/app?contextVersion=2&workspaceId=…` | `src/app/app/page.tsx:17-30` | 307 → `/api/suite-context?…` → 303 → **`/app/your-work`** |
| `/app` (bare) | `src/app/app/page.tsx:34` | → `/app/home` |

**`/app/brief/*` is a two-hop redirect chain.** `docs/SUITE_URL_AND_NAMING_CONTRACT.md`'s
migration rule step 1 requires every old URL to map to *exactly one* new URL. This is recorded
here, not fixed here: `next.config.ts` is foreign-owned for this programme, and the same file
is contended by three open PRs (`COLLISION_REGISTER.md` §1c).

### 15.2 Parameter aliases Home accepts on input

Accepted, normalized, and **replace**-redirected to canonical form (§6.4). Never emitted (§6.3).

| Legacy input | Normalizes to | Authority |
|---|---|---|
| `briefingScope=current-project` | `homeScope=project` | ADR 0001 §8; D-HR01 |
| `briefingScope=all-projects` | `homeScope=all` | ADR 0001 §8; D-HR01 |
| `briefingScope=planning-period` | `homeScope=planning-period` | ADR 0001 §8; D-HR01 |
| `scope_id` + `scope_type=project` | dropped | `src/lib/suite-context.ts:74-78` — this is the **tag-derived Label** id space, never a Project (`PROJECT_SCOPE.md` §2.3) |
| `workspace_id` | `workspaceId` | `src/lib/suite-context.ts:69-72` |
| `projectId` | **dropped**, with `unknown-parameter` | ambiguous at this base: `SuiteContextV2.projectId` (`src/lib/suite-context.ts:4`) and the tag-derived id space share the name (`PROJECT_SCOPE.md` §1). Never silently read as a Project |
| `sourceProduct`, `contextVersion` | dropped | ADR 0001 §8 bars new links from emitting them; Home strips them on the way in |

`briefingScope` costs nothing to accept and nothing to drop later: it has **zero occurrences
in `src/`** at this base, so no shipped code emits it (D-HR01).

### 15.3 V2 inputs

ADR 0001 §8: V2 inputs are accepted, validated, and replace-redirected to canonical form for
**at least two stable releases**. Home does not shorten that window. `sourceProduct` is still
required in `src/lib/suite-context.ts` by
`scripts/check-suite-switcher-contract.mjs:119-125`, so the V2 emitter is retained and the
guard is renegotiated explicitly when it retires — never deleted to make a build green
(ADR 0001 §8; `docs/wave/DECISIONS.md` D-007).

### 15.4 The two directories that must survive

`scripts/check-route-manifest.mjs` fails if a listed `src/app` route directory stops existing
(`:14-17`) and pins `app/inbox` and `app/my-tasks` (`:44-45`).

**Sealed.** When Inbox and My work land under `/app/home/**`, `src/app/app/inbox/` and
`src/app/app/my-tasks/` **remain** as redirect stubs:

- `/app/inbox` → `/app/home/inbox`, preserving `workspaceId` when present
- `/app/my-tasks` → `/app/home/my-work`, same

Editing the manifest instead requires cited founder or ADR authority (audit C §2.8). And the
redirect stubs are not a formality: both current routes are wrapped in `TasksRuntimeShell`,
which redirects a first-run user to `/welcome` (`src/components/app/tasks-runtime-shell.tsx:69-71`),
so the stubs must **not** keep that layout, or Home inherits the first-run redirect
(`REPOSITORY_TRUTH.md` finding 6).

---

## 16. The typed builder and parser Home owns

One module, owned by this programme, in a path no live lane holds:
`src/lib/home-layer/experience/home-url.ts`.

```ts
export const HOME_ROUTES = [
  "today", "briefing", "inbox", "my-work", "analytics",
] as const;
export type HomeRoute = (typeof HOME_ROUTES)[number];

export const HOME_SCOPES = ["all", "project", "planning-period"] as const;
export type HomeScope = (typeof HOME_SCOPES)[number];

/** ANALYTICS_PERIODS minus "custom" — see §4.3. */
export const HOME_PERIODS = [
  "four_weeks", "twelve_weeks", "six_months", "twelve_months",
] as const;
export type HomePeriod = (typeof HOME_PERIODS)[number];

export type HomeUrlNotice =
  | "query-discarded" | "duplicate-parameter" | "unknown-parameter"
  | "parameter-not-valid-here" | "homeScope-invalid" | "planning-period-missing"
  | "workspaceId-invalid" | "period-invalid" | "period-unsupported"
  | "returnTo-rejected" | "selection-invalid" | "lens-invalid";

export type HomeUrlState = {
  route: HomeRoute;
  scope: HomeScope;
  planningPeriodId: string | null;
  /** A hint. Authorization is `resolveProjectRoute`'s job, never the parser's. */
  workspaceId: string | null;
  period: HomePeriod | null;
  event: string | null;
  item: string | null;
  lensProjectId: string | null;
  returnTo: string | null;
};

export type ParsedHomeUrl = {
  state: HomeUrlState;
  notices: HomeUrlNotice[];
  /** True when the input was not already canonical — triggers §6.4. */
  needsCanonicalRedirect: boolean;
};

/** Total. Never throws on user input. Never authorizes. */
export function parseHomeUrl(
  pathname: string,
  search: string | URLSearchParams,
): ParsedHomeUrl;

/** The only way a Home URL is written (§6.1). */
export function buildHomeUrl(state: Partial<HomeUrlState> & { route: HomeRoute }): string;

/** §14, in isolation, so it is testable without a URL. */
export function isSafeReturnTo(value: string): boolean;

/** §6.4 — used by the route to decide whether to replace-redirect. */
export function canonicalHomeUrl(parsed: ParsedHomeUrl): string;
```

**The parser never authorizes and never reads a cookie.** It is pure, synchronous, and
dependency-free apart from `HOME_ROUTES`. That is what lets §18's assertions run without a
database, a Clerk session or a server.

---

## 17. Required change to `src/lib/product-urls.ts` — interface only

`src/lib/product-urls.ts` is **FOREIGN-OWNED** by `lane/wp2-project-platform`, which has it
modified and uncommitted (`COLLISION_REGISTER.md` §2). This programme does not write it. What
follows is the acceptance surface, so the lead can check the landed file against it.

It already carries `HOME_APP_PATH = "/app/home"` (`:94`), `HOME_APP_URL` (`:95`) and
`BRIEFING_APP_PATH` (`:96`), and a `SuiteSurfaceId = "home" | ProductId` (`:99`).

**Required additions.**

```ts
export const HOME_INBOX_PATH     = `${HOME_APP_PATH}/inbox`;
export const HOME_MY_WORK_PATH   = `${HOME_APP_PATH}/my-work`;
export const HOME_ANALYTICS_PATH = `${HOME_APP_PATH}/analytics`;

/** Every canonical Home destination, in mode order. */
export const HOME_MODE_PATHS: Readonly<Record<HomeRoute, string>>;
```

**Required change to `productIdFromAppPath`.** Today it is a **negative** test: everything
that is not `/app/notes`, `/app/timeline` or `/app/signal` returns `"tasks"`
(`src/lib/product-urls.ts:111-116`), and `isTasksSurface` in
`src/components/app/product-workspace-shell.tsx:9-19` makes the same negative judgement while
also excluding `/app/home`. Because `/app/inbox` and `/app/my-tasks` resolve to `"tasks"`,
**Inbox and My work today wear the Tasks mobile bar, the Tasks sidebar, the Tasks canvas and
the `tasks.` wordmark** (audit C §3.6). When they move under `/app/home/**` the two functions
must agree that the whole `/app/home` subtree is Home — and they must agree in **one** place,
not two.

**Required guarantee.** No Home path is expressible as a bare string in a component. Assertion
`U1` fails the build on a Home path literal outside the builder and these constants.

**What this contract will not accept.** A `home` entry in
`suite-contracts.v1.json`'s `products` map (§1); a `ProductId` widened to include `"home"`
(charter locked decision 1); or Home path constants defined in a second file.

---

## 18. Executable assertions

Written this wave, in `src/lib/home-layer/experience/`. That directory is owned by this
programme and collides with no live lane — unlike `src/lib/projects/**`,
`src/server/suite-*-contract.test.mjs` and `src/app/app/home/page.tsx`, which is why
`PROJECT_SCOPE.md` §12 deliberately specified its assertions without writing them (D-H13).
These are different: they have a home of their own.

**Every assertion below fails at this base, and that is the deliverable.**

```
node --import tsx --test src/lib/home-layer/experience/home-url.test.ts
    33 tests · 0 pass · 33 fail   — home-url.ts does not exist (U2)

node --test src/lib/home-layer/experience/home-route-contract.test.mjs
    14 tests · 3 pass · 11 fail   — the 3 passes are regression guards on
                                    things that are already right
```

Measured 2026-08-12 at `78021c5`. The three passing guards are: Home is still
absent from `suite-contracts.v1.json`'s products map; no Home file touches the
active-Project cookie; the `/app/signal → /app/home/briefing` 308 survives.

| # | Assertion | Fails today because |
|---|---|---|
| U1 | Every Home path is produced by `buildHomeUrl` or a `HOME_*_PATH` constant | `src/app/app/home/home-data.ts:82-84` concatenates `` `/app/task/${id}` `` |
| U2 | `parseHomeUrl` exists and is total over the §9 matrix | `src/lib/home-layer/experience/home-url.ts` does not exist |
| U3 | The three new routes exist | no `src/app/app/home/{inbox,my-work,analytics}/` |
| U4 | `docs/SUITE_URL_AND_NAMING_CONTRACT.md` names all five Home destinations | it names two: `/app/home` and `/app/home/briefing` |
| U5 | `/app/home` and `/app/home/briefing` accept and honour search parameters | `src/app/app/home/page.tsx:16` declares no `searchParams` |
| U6 | Every Home id is validated by `CONTEXT_ID` before use | no Home parameter is parsed at all |
| U7 | Canonical form is reached in **one** redirect | `/app/brief/*` takes two hops (`next.config.ts:394-402` → `src/proxy.ts:262-267`) |
| U8 | `homeScope=all` never narrows the read by `workspaceId` | no scope parameter exists |
| U9 | `lensProjectId` changes neither Read Scope nor Active Project | `lensProjectId` has zero occurrences in `src/` |
| U10 | `isSafeReturnTo` rejects `//evil.example`, absolute URLs, `..`, backslashes, control characters, and values over 512 chars | `returnTo` has zero occurrences in `src/` |
| U11 | No Home code path writes `ACTIVE_WORKSPACE_COOKIE_NAME` | five writers exist, one of them the contextual-link handoff (`src/app/api/suite-context/route.ts:60`) |
| U12 | `/app/inbox` and `/app/my-tasks` still exist as directories after the move | pinned by `scripts/check-route-manifest.mjs:44-45`; the move has not happened |
| U13 | No Home link emits `sourceProduct`, `contextVersion`, `projectId`, `scope_id`, `scope_type` or `workspace_id` | Home builds no links through a builder |
| U14 | `/api/suite-context` does not send an authorized reader to `/app/your-work` | it does, in both branches (`route.ts:23`, `:54`), and that page renders `main=0, h1=0` |

---

## 19. Decisions taken here

Ids use the `D-HR` prefix so they cannot collide with `PROJECT_SCOPE.md`'s `D-H01…D-H13`,
with the Project Truth wave's `D-001…D-017`, or with a sibling Wave 1 lane appending to
`DECISIONS.md` concurrently. **The lead should fold these into `DECISIONS.md` on a merged
base**; this contract does not edit that file, because a concurrent append to a shared ledger
is exactly the collision `COLLISION_REGISTER.md` exists to prevent.

**D-HR01 · The wire name is `homeScope`, and `briefingScope` is accepted input.**
ADR 0001 §8 names the parameter `briefingScope`; this programme's lane brief and route family
name it `homeScope`, with values `all | project | planning-period` rather than
`current-project | all-projects | planning-period`. Both cannot be canonical. `homeScope` is
sealed as the emitted name for three reasons: it is the name of the layer, not of one of its
five modes, and the same parameter now governs Inbox, My work and Analytics as well as the
Briefing; `briefingScope` has **zero occurrences in `src/`** at this base, so the rename costs
no compatibility work today and would cost real work after Wave 4; and `project` reads
correctly next to `all` in a control label, where `current-project` does not.
**This diverges from a merged, founder-approved ADR and is recorded as an open conflict**
(§20 item 1), not silently reconciled. `briefingScope` is accepted on input and normalized
(§15.2), so nothing breaks either way.

**D-HR02 · `planningPeriodId` is a Home URL parameter, narrowly.**
ADR 0001 §8 says new V3 links must not emit `planningPeriodId`. That prohibition targets it as
an **ambient suite-context carrier** riding alongside `sourceProduct` and `contextVersion` —
a second scope travelling with every link. Home's use is different in kind: it is the
**operand of `homeScope=planning-period`**, meaningless without it, valid on Home routes
only, never emitted on a link into a product, and never an authorization input
(`PROJECT_SCOPE.md` §2.5). The alternative — a compound value like
`homeScope=planning-period:<id>` — puts a second grammar inside a parameter value, which is
how parsers acquire bugs. Recorded as a scoped exception, flagged in §20 item 1 with D-HR01.

**D-HR03 · Home fails closed on the narrowest existing id grammar.**
Three id grammars already ship (§4.1). Home adopts `CONTEXT_ID`
(`src/lib/suite-context.ts:8`) because it is the one already enforced on the values Home
receives. A value legal in the analytics parser but not here is rejected rather than passed
through. Narrowing later is a breaking change; widening later is not.

**D-HR04 · A duplicate parameter takes no value.**
`?item=a&item=b` yields no `item`. First-wins and last-wins are equally arbitrary and both
render a guess as a fact.

**D-HR05 · `period=custom` is refused by name, not treated as unknown.**
It exists in `ANALYTICS_PERIODS` (`query.ts:9`), so treating it as an unknown value would
report the wrong thing to the reader and to telemetry. Refusing it by name keeps the door
open for Wave 8 to add it deliberately, with the `start`/`end` and 366-day questions answered.

**D-HR06 · The Lens is a third value, on neither axis.**
Justified in §3.2. The alternative — reusing `workspaceId` — makes "look at this" and "work
in this" the same value, which is the conflation `PROJECT_SCOPE.md` §5 calls a release blocker.

**D-HR07 · Mode changes push; every filter changes replaces.**
§11.1. Extends D-H10 from Read Scope to `period`, Lens and selection.

**D-HR08 · `returnTo` is prefix-allow-listed, not deny-listed.**
The destination set is small and closed (§14.3). A deny-list must anticipate every future
route; an allow-list fails closed on one it has not heard of.

**D-HR09 · Redirect stubs, not a manifest edit.**
§15.4. `scripts/check-route-manifest.mjs:44-45` is a removal-only ratchet and editing it to
make a move green is the kind of gate-loosening the programme brief lists as an automatic
veto. Stubs cost two files and keep the ratchet honest — and they must not carry
`TasksRuntimeShell`.

**D-HR10 · The derived Project wins over the supplied one, and the correction is disclosed.**
§13.2 rule 4. Silently preferring either value is a lie; the derived one is the only one that
can be verified against the object the reader clicked.

**D-HR11 · Home accepts `workspace_id` but drops `projectId`.**
`workspace_id` has exactly one meaning (`src/lib/suite-context.ts:69-72`). `projectId` has at
least two — `SuiteContextV2.projectId` (`:4`) and the tag-derived Label space
(`PROJECT_SCOPE.md` §2.3) — and normalization maps it to `scope_id` (`:74-76`). An ambiguous
name is not normalized into a canonical one; it is dropped.

---

## 20. Open, and owned elsewhere

Recorded so no lane treats silence as settlement.

1. **`homeScope` vs `briefingScope`, and `planningPeriodId` on a V3 link** (D-HR01, D-HR02) —
   both diverge from merged ADR 0001 §8. **And it is now a live cross-lane conflict inside
   this programme, not only a divergence from the ADR:** the sibling Wave 1 contract
   `contracts/HOME_CONTEXT.md` parses `briefingScope` at its step 6 (`:158`, `:313`, `:385`),
   while this contract emits `homeScope`. Both were sealed in the same wave against the same
   base. They are reconcilable in one edit today — this contract already accepts
   `briefingScope` on input and normalizes it (§15.2), so the two are interoperable and
   neither is broken — but **one wire name must be chosen before Wave 4 emits a single
   link**, and the choice belongs to the lead, not to either lane. Cheap now; expensive
   after Wave 4. Owner: lead → founder.
2. **`src/lib/product-urls.ts` has not landed** with the Home constants. §17 is an unverified
   acceptance surface. Owner: `lane/wp2-project-platform`.
3. **`/app/brief/*` is a two-hop redirect chain**, contrary to the URL contract's own
   migration rule step 1. Owner: whoever next owns `next.config.ts` — contended by three open
   PRs (`COLLISION_REGISTER.md` §1c).
4. **`/api/suite-context` sends authorized readers to `/app/your-work`**, which renders with
   no `main` and no `h1` and a failed-query console error at all three viewports, and it
   writes the active-Project cookie on a contextual-link handoff (D-H12). Unowned by any
   current lane.
5. **Deterministic bare-entry ordering is undefined** (`PROJECT_SCOPE.md` §13 item 2). Until
   it exists, §5 rule 5 stands and Home must name the Project it landed in.
6. **The scroll owner is ambiguous** — two nested scroll containers (§11.3). Wave 4 must
   resolve it to one element per mode before the restoration contract can be tested.
7. **`suite-contracts.v1.json` still carries a `signal` product entry** whose `appUrl` 308s.
   Not ours (§1). Owner: `feat/project-truth-wave`.
