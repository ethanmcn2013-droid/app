# Home operating layer — decision record

Decisions taken by this programme during execution. Each records what was decided, the
evidence and reasoning, and what it changes downstream. Ids are `D-Hxx` so they never
collide with the Project Truth wave's `D-001…D-017`
(`docs/wave/DECISIONS.md`), with `src/server/actions/project-overview.ts`'s in-source
D-011, or with the VEF programme's `D-0xx`.

**Base for every decision below:** `origin/main` @ `78021c5`, worktree `_wt-home-layer`,
branch `feat/home-operating-layer`. Every citation is repo-relative to that worktree and
was read at that base.

---

## D-H01 · Adopt ADR 0001 unamended. Project = Tasks `workspaces.id`

**Decision.** `docs/adr/0001-canonical-project-identity.md` is adopted in full, without
amendment, as the canonical Project identity for this programme. This programme authors no
competing ADR and re-derives nothing it settled.

**Evidence.** Two independent bodies of work reached the same conclusion from different
directions. ADR 0001 §1 decided it at base `3682bf7` as a contract freeze. Audit B reached
it at base `a849fc4` by tracing four incompatible identity spaces to their schemas and
finding exactly one durable id-keyed tenant — `src/server/db/schema.ts:272-277` —
recorded at `audit/B-domain-permissions.md:143-147` and `:676-678`. Neither read the
other: `audit/B-domain-permissions.md:14-26` records that `docs/adr/` and `docs/wave/` did
not exist in this worktree when the audit was written.

**Rationale.** Independent convergence is the strongest evidence available short of a
runtime proof. Every rejected alternative in ADR 0001 §10 is independently confirmed by
audit B: the slug is a public URL segment that renames (`schema.ts:274-276`); Planning
Period is a single-owner grouping (`schema.ts:217-261`); the tag-derived id merges on
slugify collision and dies on rename (`providers/tasks.ts:365-374`).

**Consequence.** `PROJECT_SCOPE.md` §1 is a restatement, not a new decision. Any lane that
finds a reason to reopen it raises an ADR amendment, not a local exception.

---

## D-H02 · Seam 1 is the sole membership authority; the other four are subordinate

**Decision.** The Tasks in-process Drizzle query over `workspace_members` is the **only**
authority that answers "may this actor use this Project". The Timeline raw-SQL seam, the
signal mirror seam and the Notes HMAC loopback are **subordinate adapters** that may narrow
but never widen. The Timeline ownership seam is **demoted out of the membership set
entirely**.

**Evidence.** Five seams over four transports — `audit/B-domain-permissions.md:189-202`.
Twenty-one functions return a viewer's workspace set; nine are cross-workspace and they
disagree on owner-only vs owner-or-member, on archived handling, and on id space
(`:204-261`). Seam 3 cannot be a membership seam because **Timeline has no membership
table**: `getWorkspacesForUser` filters `eq(workspaces.ownerUserId, userId)`
(`src/modules/timeline/server/db/timeline-queries.ts:158-170`) and the schema carries a
single `ownerUserId` with no member join
(`src/modules/timeline/server/db/timeline-schema.ts:325-333`).

**Rationale.** ADR 0001 names the Tasks membership query as the authorization layer
(§4) but does not enumerate the competing seams or say what becomes of them — it had not
audited them. Naming one canonical seam without dispositioning the other four leaves four
live paths that can each answer differently. Demoting seam 3 rather than "aligning" it is
the honest move: an owner-only table cannot be made to answer a membership question.

**Consequence.** Home imports no membership query directly; it reaches seam 1 only through
the `src/lib/projects/**` facade (`PROJECT_SCOPE.md` §11). An adapter that grants what
seam 1 denies is a defect, logged server-side, and the request is denied.

---

## D-H03 · `LEGACY_WORKSPACE_ID` elimination is a Home **precondition**, not a downstream target

**Decision.** No code path reachable from a Home surface may return `LEGACY_WORKSPACE_ID`.
Home does not ship on a resolver that can hand out a Project the caller has proved no
membership of.

**Evidence.** Still live at this base: `src/server/auth.ts:179` returns it as the third
fallback of `getActiveWorkspace()`, after cookie (`:151-165`) and first-membership
(`:167-174`). `docs/wave/DECISIONS.md` D-005 records it as "a WP2 resolver requirement and
a WP3 audit target". ADR 0001 §1 lists it as **Removed** — a target state, not current
state.

**Rationale.** A WP3 audit target is a schedule commitment; a Home precondition is a gate.
Home is the cross-Project surface, so it is the one place where a silently substituted
Project is guaranteed to be the *wrong* one rather than merely *a* one. The distinction
matters because the two programmes can otherwise both believe the other is holding it.

**Consequence.** Assertion A2 in `PROJECT_SCOPE.md` §12. Recorded as a §11 acceptance
condition on `src/lib/projects/**`.

---

## D-H04 · Active Project and Read Scope are two serialized parameters, never one

**Decision.** `workspaceId` (Active Project) and `briefingScope` (Home Read Scope) are
independent URL parameters. `all-projects` is never expressible as a `ProjectId` value and
is never written to the cookie.

**Evidence.** ADR 0001 §7 separates the concepts; §8 already lists
`/app/home?workspaceId=…&briefingScope=…`. `RECONCILIATION.md` row 2 committed this
programme to "two independent axes, never one 'scope' variable" before the ADR was
readable here.

**Rationale.** The single-variable design fails in exactly one place, and it is the place
Home lives: an aggregate view. With one variable, "show me everything" must be encoded as
a sentinel inside the Project field, and every downstream consumer — link builder, mutation
destination, cookie writer — then has to special-case it. One of them will forget.

**Consequence.** `PROJECT_SCOPE.md` §5. Assertion A11. A type-level guarantee is required
of `src/lib/projects/**`, not a runtime check.

---

## D-H05 · Unprojected work is three distinct named states, and none of them is an error

**Decision.** **Unfiled** (a Note with `workspace_id IS NULL`), **Unlabelled** (a task with
no tags) and **Unprojectable** (a Tasks row with `workspace_id IS NULL`) are three separate,
named states. None is folded into a Project; none is silently dropped; none renders as an
error.

**Evidence.** Unfiled is documented as "the normal, durable 'Unfiled' state"
(`src/modules/notes/server/db/notes-schema.ts:54-62`). Unlabelled is currently rendered as
the literal string `untagged` by `projectIdFromTag` (`providers/tasks.ts:374`).
Unprojectable is still schema-permitted: "Nullable during the cutover; tightened to NOT
NULL after the legacy backfill lands" (`src/server/db/schema.ts:38-41`), repeated on
`comments:481`, `activities:519`, `notifications:570`, `attachments:873-875`,
`shareLinks:766-767`.

**Rationale.** Charter rule 11 forbids rendering missing or partial data as zero or
complete. Collapsing these three into one bucket does exactly that in both directions:
attributing an unprojected row to the Active Project inflates it, and dropping it deflates
a total silently. Neither is detectable by a user.

**Consequence.** `PROJECT_SCOPE.md` §6. A count that excludes Unprojectable rows says so.
The string `untagged` never reaches a rendered surface.

---

## D-H06 · Active Project is a ceiling; product-local filters may only narrow

**Decision.** A product-local filter may narrow within the Active Project. It may never
widen beyond it and never change it. Only an explicit Project selection changes Active
Project; only Home Read Scope widens, and widened content is always visibly labelled.

**Evidence.** ADR 0001 §7 states the principle. The current failure mode is visible at
`src/app/app/tasks/page.tsx:18-21`, which reads only `welcome` and lets
`tasks-runtime-shell.tsx:68` resolve the Project ambiently — so a link that carries a
Project silently lands in whichever Project the cookie holds.

**Rationale.** Without a stated ceiling, "filter" and "scope" become the same control in
the user's mental model, and a Home aggregate then reads as a Tasks filter. The label on
the global Project trigger becomes a lie in that moment.

**Consequence.** `PROJECT_SCOPE.md` §4.3 precedence table. Selecting a specific Project
from an aggregate invokes the global switch; choosing an aggregate does not.

---

## D-H07 · Home persists nothing about Project context

**Decision.** Home never writes the active-Project cookie and never persists Read Scope
server-side. Read Scope lives in the URL and dies with it.

**Evidence.** Six code paths already touch the cookie
(`src/app/api/suite-context/route.ts:60`, `src/server/actions/cross-workspace.ts:193`,
`planning.ts:1252` and `:290`, `settings.ts:614` and `:823`,
`templates.ts:136`). Adding a seventh from a cross-Project surface would make the cookie
mutable from a view that, by design, targets nothing.

**Rationale.** Home's whole job is to read across Projects. A surface that reads across
Projects and also writes the global Project pointer will, at some point, change the user's
Project as a side effect of looking at something. That is the single most damaging
possible Home defect and the cheapest to prevent structurally.

**Consequence.** `PROJECT_SCOPE.md` §7.1. Home's Read Scope control uses `replace`, not
`push` (§10.2), so it also leaves no history residue.

---

## D-H08 · Archived is a distinct state and is excluded from all-projects by default

**Decision.** `archived` is its own `ProjectRouteState`, never collapsed into
`unavailable` or `empty`. Archived Projects are **excluded** from `all-projects` by
default and included only on an explicit, labelled toggle.

**Evidence.** `workspaces.archivedAt` exists (`src/server/db/schema.ts:311`) and
`getProjectsTreeData` already partitions on it (`src/server/actions/projects-tree.ts:121-122`,
`:150-151`). ADR 0001 §5 defines archived behaviour but does not state the aggregate
default — this decision fills that gap rather than leaving it to each surface.

**Rationale.** The inclusion default is a truth question, not a preference. An archived
Project's rows silently inflating a live cross-Project count is indistinguishable, to a
reader, from real work. Excluding by default with a visible toggle is the only option where
both readings are honest and the user knows which one they are looking at.

**Consequence.** `PROJECT_SCOPE.md` §8.3. If the founder wants archived included by
default, that is an ADR amendment.

---

## D-H09 · The persisted Project hint must be actor-bound or cleared on authentication change

**Decision.** The active-Project cookie must be scoped per user id, or cleared on every
authentication transition. Read Scope resets on any actor change.

**Evidence — new at this base, recorded by neither the ADR nor audit B.** No sign-out path
clears `tasks_active_ws`: the only deletions are Project-delete
(`src/server/actions/planning.ts:290`, `src/server/actions/settings.ts:823`) and full
account deletion (`src/components/settings/profile/danger-zone.tsx:95`). Four of the five
writers set `path: "/"` with a 30-day `maxAge`, so the cookie survives an actor change, and
nothing in its value records who selected it.

**Rationale.** This is **not** a data leak — seam 1 revalidates membership on every
resolution (`src/server/auth.ts:154-165`), so a non-member simply falls through. It is a
truth defect and a privacy-of-inference defect: the new actor's bare entry silently
depends on the previous actor's choice, and a shared device leaks the existence of a
Project id through browser storage. Both are cheap to close and expensive to explain later.

**Consequence.** `PROJECT_SCOPE.md` §10.1. Recorded as a §11 precondition. Home cannot fix
it — the cookie is written in foreign-adjacent action files — so it is stated as a gate.

---

## D-H10 · Read Scope changes replace history; Project selections push it

**Decision.** A Read Scope change uses `history.replaceState` semantics; an explicit
Project selection pushes. Canonicalising redirects replace. Every restored view
re-resolves Project state rather than rendering from history or `bfcache`.

**Evidence.** Both values are URL state (D-H04), so browser history is the mechanism and
no Home-specific memory is needed. Every `/app` route is `force-dynamic` today (22 files,
`src/app/app/layout.tsx:21`, `src/app/app/home/page.tsx:8`,
`src/app/app/home/briefing/page.tsx:4`), and no caching primitive is used anywhere in the
repository (`audit/B-domain-permissions.md:576-580`).

**Rationale.** Pushing on every scope change builds a stack of filter states that Back has
to walk before it leaves the page — a well-known and universally disliked behaviour. Pushing
on Project selection is the opposite case: returning to the Project you were in is exactly
what Back should mean. Re-resolving on restore is what makes a revoked Project fail closed
instead of rendering from a cached tree.

**Consequence.** `PROJECT_SCOPE.md` §10.2.

---

## D-H11 · Home renders no capability it cannot verify, and discloses per-Project "Done"

**Decision.** Every Home affordance that implies a permission calls a capability predicate.
Home never infers capability from a role label. Home never presents a completion figure as
a cross-Project comparable without disclosing that "Done" is defined per Project.

**Evidence.** Roles are exactly `"owner" | "member"`, default `member`
(`src/server/db/schema.ts:458-477`). **No task mutation carries a role check** — role
predicates exist only in `src/server/actions/{planning,security,settings}.ts` and
`src/server/planning/security-boundary.ts:30,47`
(`audit/B-domain-permissions.md:300-305`). Any member can redefine Done:
`setColumnDoneAction` has no role check (`src/server/actions/board.ts:282-301`), and
`isTaskDone` is *the* predicate for every surface (`src/lib/board-columns.ts:188-208`).

**Rationale.** A Home surface that shows a disabled control with a "owners only" tooltip,
where the underlying action has no role check, teaches the user a permission model the
system does not enforce. The reverse — hiding a control the user could actually use — is
equally wrong. Calling the predicate is the only version that stays true when the
enforcement changes.

**Consequence.** `PROJECT_SCOPE.md` §3.1. Cross-Project completion comparisons carry a
disclosure. `assertProjectCapability` with a typed refusal is required of §11.

---

## D-H12 · The five-writer cookie divergence is recorded as a NEW CONFLICT, not reconciled

**Decision.** Record that `tasks_active_ws` has **five writers with four different
attribute sets**, that one of them is the contextual-link handoff endpoint, and that the
explicit switch returns success on refusal. Do not fix it in this programme, do not
silently design around it, and do not let it be inherited as settled.

**Evidence — new; recorded by neither ADR 0001, `docs/wave/MUTATION_INVENTORY.md`, nor
audit B.**

| Writer | `httpOnly` | `secure` | `maxAge` | Line |
|---|---|---|---|---|
| `selectWorkspaceAction` | `false` | absent | 30 d | `src/server/actions/cross-workspace.ts:193-200` |
| `GET /api/suite-context` | `true` | prod-only | 30 d | `src/app/api/suite-context/route.ts:60-66` |
| `selectWorkspaceCookie` (planning) | `true` | prod-only | 30 d | `src/server/actions/planning.ts:1252-1258` |
| template apply | `true` | absent | absent (session) | `src/server/actions/templates.ts:136-140` |
| invite redemption | absent (defaults `false`) | absent | 30 d | `src/server/actions/settings.ts:614-618` |

`selectWorkspaceAction` returns `{ ok: true }` when membership is absent
(`cross-workspace.ts:191`) — a refusal byte-identical to a success.

**Why this is a conflict, not a gap.** ADR 0001 §4 treats "HttpOnly cookie" as a single
authority layer and states that "following a contextual link does not rewrite the cookie".
At this base the cookie's HttpOnly posture depends on which path last wrote it, and
`/api/suite-context` — the contextual-link handoff — **does** rewrite it
(`route.ts:60`). `MUTATION_INVENTORY.md:35-37` is correct that exactly one `cookies()`
*read* resolves a workspace and that every other touch writes or deletes; the writes were
simply never enumerated, so this **extends** their inventory rather than contradicting it.

**Rationale.** This programme does not own any of those files, four of the five sit in
`src/server/actions/**` that the Project Truth lanes are actively migrating, and a
concurrent edit is exactly the collision the register exists to prevent. Recording it with
evidence is the correct output of a contract wave.

**Consequence.** `contracts/PROJECT_SCOPE.md` §7.2, assertions A3 and A4. Listed as unowned
at `contracts/PROJECT_SCOPE.md` §13 item 3 — no current lane holds it.

---

## D-H13 · Specify the contract assertions; do not write the test files this wave

**Decision.** Write the twelve executable assertions into `PROJECT_SCOPE.md` §12 as a
specification. Do not create the test files in this wave.

**Evidence.** Every natural home for these assertions is a path a live lane owns or is
about to create: `src/lib/projects/**` is being authored right now by
`lane/wp2-project-platform` and is absent here; `src/server/suite-context-contract.test.mjs`
and `src/server/suite-navigation-contract.test.mjs` are foreign-owned
(`COLLISION_REGISTER.md:51-52`); `src/app/app/home/page.tsx` and the `/app` layout belong
to `task_1bf52417` (`COLLISION_REGISTER.md:29`). The wave scope rule permits failing tests;
it does not require them where they would collide.

**Rationale.** A failing test in a path another session is mid-edit is worse than a late
test: it turns their next commit into a merge conflict in a file named `*-contract.test.*`,
which reads as a boundary breach rather than a scheduling artefact. `docs/wave/DECISIONS.md`
D-007 makes exactly this point about contract guards — a rewritten guard reads as a
weakened one. The same logic applies to a *new* guard landed into a lane's working set.

**Consequence.** §12 is written so implementation is mechanical: each assertion names the
file:line that makes it fail today. The lead schedules the test commit once
`src/lib/projects/**` lands. Recorded as an open item, not silently dropped.

---

## Register of what this programme decided **not** to decide

| Question | Why it is not ours | Owner |
|---|---|---|
| Deterministic ordering for the bare-entry Project fallback | Needs a product answer, not an `ORDER BY`. Today `src/server/auth.ts:169-174` is an unordered `.limit(1)`. | Lead / founder |
| Whether `owner-reconciliation-required` gets a UI | `docs/wave/DECISIONS.md` D-017 carried it forward explicitly | `lane/wp1-timeline-safety` / WP4 |
| Retiring the V2 suite-context emitter | `scripts/check-suite-switcher-contract.mjs:126` still pins `sourceProduct`; ADR 0001 §8 mandates renegotiation, not deletion | `feat/project-truth-wave` |
| What happens to tasks assigned to non-members | Product answer required before My work ships | This programme, Wave 7 |
| Whether the analytics domain gains a Program (planning-period) axis | `docs/wave/DECISIONS.md` D-010 consequence, left open there | `feat/project-truth-wave` |


---

## D-H14 · The two programmes split Home by read and shell

**Ratified by Ethan's approval of the completion plan, 17 August 2026.** The Project
Truth programme records the same decision as `D-027`; this entry is the Home-side
mirror that `D-027` announced.

| Owns | Programme |
|---|---|
| The analytics **read** — providers, metric registry, truth classes, Plan Trace as a content component | Project Truth |
| The Home **shell** — routes, modes, navigation, chrome, the boundary contract | This programme |

Binding consequence here: this programme does not author an analytics view. W8 consumes
Plan Trace as a shell-agnostic content component that inherits the host's tokens, and a
bounded fitting pass is expected when the shell exists. The component being built as a
page anywhere is a violation of both records.

---

## D-H15 · The visual direction is Editorial Line — the founder's selection

**Selected by Ethan, 17 August 2026**, from the four-direction W3 lab after five panel
rounds, with the round-5 ballots as advice: Editorial Line 8.64 mean, eight of ten
directors passing, floor 8.1 — the closest any direction came to the 8.5-every-lens
admission gate in the programme's history. No direction was formally admitted; the
charter's authority order puts the founder's selection above the panel, and the panel's
own round-4 note said this judgment goes to Ethan rather than being iterated
indefinitely.

**What this settles.** The authenticated Home shell is built in Editorial Line's
grammar: a quiet broadsheet — not one container, card, fill or shadow; hierarchy
carried by type and rhythm; a three-tier measure; colour spent once per view; the
numbered mono margin; the standing colophon ("HOW THIS PAGE WAS READ") as the
direction's honesty furniture; struck-through refused actions with reasons on the
control. W4 (shell and boundary contracts) is unblocked and proceeds autonomously per
the charter's one-expected-pause clause.

**The winner inherits two open ballots.** Round 5's two revisable ballots are the first
work items of adoption, not forgotten by the win: (1) the Inbox deck line must be made
consistent with its own ledger (data-truth seat, 8.1/7.8); (2) the liturgy must be
deduplicated — each rule sentence once per section, and a one-line account pulled up
under the Today standfirst so the receipt is met before the fold (product-taste seat,
8.4/8.4). Both carry their full text in `verification/panel/round-5-editorial.md`.

### Killed with the selection: what the other three proved

**Signal Desk — KILLED.** The spine-that-breaks is the single most elegant translation
of the governing rule in the field, and its verdict-word standfirst is a genuinely
composed status language. It lost on trust: its round-5 remediation over-applied its own
best sentence onto healthy pages, and a direction whose grammar can lie about a healthy
day cannot be the front door. Kept from it: the four-state rule-as-instrument under the
headline is recorded as the strongest single device any direction produced, and a future
status surface should start there.

**Reading Index — KILLED.** The contents-as-condition-report — leader dots from each
mode to its current state — is a genuinely novel navigation idea. It lost on
composition: nine of ten directors independently found it composes only when the day is
full, and Home's most common day is quiet. Kept from it: the per-mode condition words in
the navigation; Editorial's nav already carries state words beside its marks, and the
leader-dot device is recorded for any future dense index surface.

**Meridian — KILLED.** The slot's third occupant, scored once: 8.19 mean on its first
panel, held down almost entirely by inert controls — the cost of its zero-client-JS
purity. Its two meridians (NOW / THE EDGE OF THIS READ) with surface-specific true
sentences are the best temporal grammar the lab produced. Kept from it: the
edge-of-read sentence pattern ("below this line is what this read cannot reach") is
recorded for the Full briefing's horizon treatment.
