# Reconciliation — one programme, four instruction sources

Required by the master brief §3 before any product edit. This table resolves who owns
what, so the Home report, the Analytics prompt, the live Project Truth programme and the
current code never produce two answers.

**Status:** authority model settled (lead decision). Factual rows marked *pending audit*
are completed from the Wave 0 auditor reports, not from assumption.

## The four sources

| Source | Governs | Does not govern |
|---|---|---|
| **Home report** (`signal-studio-home-operating-layer-research-and-panel-report-2026-08-12.md`) | Suite information architecture, route hierarchy, mode ownership, product taxonomy, shell behaviour | Analytics truth classes, Project identity, visual certification |
| **Analytics prompt** (`opus-5-signal-analytics-master-execution-prompt.md`) | Analytics truth classes, metric safety, evidence, snapshots, history, permissions, Project Lens, synthetic-vs-live proof | Suite IA, shell, route hierarchy |
| **Project Truth programme** (`feat/project-truth-wave`, PR #125 + lanes) | Canonical Project identity, Timeline exact-Project resolution, the Analytics R1–R10 defects, `src/lib/projects/**` | Home IA, the Home design lab, the Home release programme |
| **This programme** | The only shell, the only Home design lab, the only shared ranking seam, the only release programme | Re-deciding any of the above |

**Hard rule:** never create two Home shells, two design labs, two ranking engines, two
Inbox stores, or two Analytics implementations.

## Reconciliation table

| # | Topic | Resolution | Basis |
|---|---|---|---|
| 1 | **Route ownership** | This programme owns the `/app/home/**` family. The locked URL contract (`docs/SUITE_URL_AND_NAMING_CONTRACT.md`) is executable authority via `src/lib/suite-contracts.v1.json`, `src/lib/product-urls.ts`, `src/proxy.ts`, `next.config.ts`. Adding `/app/home/{inbox,my-work,analytics}` **requires updating that contract and the matching Studio decision record in the same release** — this is a Wave 4 deliverable, not a Wave 9 cleanup. | URL contract §"Implementation authority", §"Migration rule" |
| 2 | **Active Project vs Home Read Scope** | Two independent axes, never one "scope" variable. Active Project = the one exact Project a product route or write may target. Home Read Scope = what authorized work may be *read together* (`all` \| `project` \| `planning-period`). Choosing All projects or a Planning Period never mutates Active Project. | Brief §10.2 |
| 3 | **Planning Period vs Analytics Time Window** | Planning Period groups Projects. Time Window selects *when*. Neither is the other; neither is an authorization grant or a mutation target. The lab pins a Last-12-weeks comparison window for determinism; current-state exceptions keep their explicit as-of instant. | Brief §10.2 |
| 4 | **Today / Full briefing ranking** | One deterministic engine, shared. Two ranking implementations is an automatic veto. Existing briefing build logic (`src/modules/signal/lib/briefing/**`) is the incumbent — Wave 5 either extends it or replaces it wholesale, never forks it. | Brief §14; incumbent located at base |
| 5 | **Inbox content and state** | One canonical store, one badge definition, one state machine. The global Inbox affordance and the Home-local link resolve to the same route and count. V1 kinds: mention, reply, review-requested, approval-requested, handoff, explicit-block. Invitation excluded pending a separate sealed `InviteEventContract`. | Brief §15.1–15.2 |
| 6 | **My work source coverage** | V1 is complete and truthful for assigned/owned **Tasks** across authorized Projects. Notes and Timeline join only on a structured accountable object with stable owner identity, authorization adapter, source revision and mutation receipt. If the label stays "My work" while V1 is Tasks-only, a coverage receipt sits at the view introduction. | Brief §16.1 |
| 7 | **Analytics Project identity** | **Adopted from Project Truth, not re-derived:** Project = canonical Tasks `workspaces.id`. Tags become Labels/Workstreams. Timeline slugs are subordinate artifact identities. Analytics accepts one authorized Project or an opaque authorized Project set from HomeReadScope — the existing workspace→project scope nesting is replaced. | ADR 0001 (foreign-owned, adopt after PR #125 merges) |
| 8 | **Visual-lab ownership** | This programme owns the only Home design lab, at the repository's canonical `/lab` route family under a review flag plus a reviewer allowlist or protected-preview policy. Authentication + noindex alone is not protection. *pending audit: exact current `/lab` guard* | Brief §12.2 |
| 9 | **Feature flags and job gates** | Five independent responsibilities, all server-side, default-off, fail-closed: `HOME_OPERATING_LAYER_ENABLED` (umbrella), a dedicated Home Analytics view gate, `SIGNAL_ANALYTICS_JOBS_ENABLED`, `HOME_MUTATIONS_ENABLED`, per-provider kill switches, plus the review-lab flag. **Do not reuse `SIGNAL_ANALYTICS_V1_ENABLED` as a view flag if it still switches the Briefing engine.** *pending audit: what that flag currently switches* | Brief §13.5, §17.5 |
| 10 | **Legacy routes and redirects** | `/app/signal*` already permanently redirects to `/app/home/briefing` — that is settled and must not be reopened. `/app/inbox` and `/app/my-tasks` redirect only after semantic and state parity is proven. `/app/your-work` is planning administration and must **never** redirect to personal My work. `/app/project` needs an explicit keep / Manage Projects / Project Lens decision. `/app/trends` emitted actions are dead and get removed; incoming `/app/trends` gets an explicit compatibility disposition. | URL contract 2026-08-04 table; brief §19.3 |
| 11 | **Migration ordering** | Project Truth lands first (it is already in PR). This programme's Wave 1 ports the **merged** contract from `origin/main`, never by cherry-picking a lane SHA and never by merging `feat/project-truth-wave` wholesale. Their `docs/wave/PROGRAMME.md` is marked absorbed/superseded only after reconciliation, by a lead-owned edit on a merged base. | Brief §10.1; COLLISION_REGISTER §3 |
| 12 | **Quality and release gates** | The repository's own measured gate (`experience:quality`, quality-council) plus ten independent directors at 9.5. No prior research-panel score carries into visual or production certification — the Home report's 8.9 minimum certifies the *architecture*, explicitly not a rendered UI. | Home report §"Panel result"; brief §21.7 |

## Absorbed vs superseded

| Their artifact | Disposition |
|---|---|
| `docs/adr/0001-canonical-project-identity.md` | **Adopt** after revalidation against the merged base. Do not author a competing ADR. |
| `docs/wave/ANALYTICS_TRUTH.md` (R1–R10) | **Adopt as release blockers** for our Wave 8. Re-run each audit against the merged base and classify STILL TRUE / DRIFTED / RESOLVED / NEW CONFLICT. |
| `docs/wave/MUTATION_INVENTORY.md` | **Adopt as input** to our My work writeback and Inbox source-action contracts. |
| `docs/wave/PROGRAMME.md` | **Superseded** by this programme's wave plan for Home surfaces — recorded after reconciliation, not before. Their historical merge/deploy cadence, separate founder gates and flag plan are **not** executed in parallel with ours. |
| `src/lib/projects/**` (in flight) | **Consume.** This programme does not create a second ProjectScope foundation. |

## Standing conflicts recorded, not silently reconciled

1. The master brief cites `feat/project-truth-wave` at `9880694`; the branch is at `d4d9295`
   and the WP0 commit was rebased to `c598bd0`. The brief's SHA is stale.
2. The Home report cites `origin/main` at `3682bf7` and reads current-product evidence out of
   `_wt-design-audit`. Both are superseded by base `a849fc4`. Its *architecture* conclusions
   stand; its *file-line citations* must be re-derived against our base before use.
3. `src/lib/product-urls.ts` is simultaneously (a) locked executable URL authority, (b) being
   modified uncommitted by `lane/wp2-project-platform`, and (c) required by our Wave 4 route
   family. Sequencing, not concurrent editing, is the only safe resolution.

---

# Wave 1 revalidation

**Appended 2026-08-12. Append-only — nothing above this line was altered.**

**Revalidation base:** `origin/main` @ `78021c5` ("Wave 0: freeze the Project contract…", PR #125).
**Their ADR was written at:** `3682bf7` · **our audits were written at:** `a849fc4`.
**Lineage, verified:** `3682bf7` → `a849fc4` → `78021c5`, strictly ancestral.

**The single most important fact about this base: PR #125 changed no production source.**
`git diff --name-only a849fc4 78021c5` returns nine paths — seven documents, one workflow
(`.github/workflows/design-quality.yml`) and one script (`scripts/wave-baseline.mjs`).
`git diff --stat 3682bf7 78021c5` adds only `CHANGELOG.md` and two files under
`experience/labs/hybrid/`.

So the ADR and the wave records describe **exactly the code our audits read**. Every
disagreement below is a disagreement of record, never of base drift. `src/lib/projects/**`
does not exist at `78021c5`; `ActiveProjectContextV3`, `ProjectRouteState`,
`switchActiveProjectAction`, `resolveCanonicalTimeline`, `NotesReadScope` and
`BriefingReadScope` return **zero occurrences** repo-wide. ADR 0001 is a sealed contract
awaiting implementation, and this programme's Wave 1 contract
(`contracts/PROJECT_SCOPE.md`) is written to consume it.

## Verdict

**They agree. There is no drift and no fork.** Two independent bodies of work, written
without sight of each other (`audit/B-domain-permissions.md:14-26` records that `docs/adr/`
and `docs/wave/` were absent when audit B was written), reached the same canonical
identity. Our audits **extend** their records in five places and **conflict** with them in
three, all three narrow, all three newly discovered, none of them structural.

`docs/adr/0001-canonical-project-identity.md` is **adopted unamended** (`DECISIONS.md`
D-H01). `docs/wave/ANALYTICS_TRUTH.md` R1–R10 are **adopted as release blockers**; all ten
are STILL TRUE at this base.

---

## 1. ADR 0001 — every material claim classified

`Impl.` = implemented in production source at `78021c5`. A contract can be STILL TRUE and
unimplemented; those are different columns, and conflating them is how one wave comes to
believe another wave is holding something.

| # | ADR claim | Verdict | Impl. | Evidence at `78021c5` |
|---|---|---|---|---|
| 1 | §1 A Project is a Tasks `workspaces.id` | **STILL TRUE** | n/a | `src/server/db/schema.ts:272-273`; in-source D-011 at `src/server/actions/project-overview.ts:6` |
| 2 | §1 Planning Period is a grouping, never an authorization boundary | **STILL TRUE** | partial | `src/server/db/schema.ts:217-261`, `:299-302`; `src/lib/suite-context.ts:3` |
| 3 | §1 Timeline `workspace` is hidden storage, 1:1 with a Project | **STILL TRUE** | yes | `src/modules/timeline/server/db/timeline-schema.ts:325-337` (slug PK, `suiteWorkspaceId`) |
| 4 | §1 Timeline `project` is a subordinate artifact, never a suite key | **STILL TRUE** | yes | composite PK `(workspace_slug, slug)` at `timeline-schema.ts:78-88` |
| 5 | §1 Tag-derived scope becomes a Label; cited `providers/tasks.ts:364` | **STILL TRUE** *(citation off by one)* | no | `projectIdFromTag` is declared at `src/modules/signal/server/analytics/providers/tasks.ts:365`; `:364` is its doc comment. Still applied unrenamed at `:68,120,145,184`, `providers/notes.ts:64,151`, `policy.ts:220` |
| 6 | §1 Note `workspaceId` is private filing, never shared ownership | **STILL TRUE** | yes | `src/modules/notes/server/db/notes-schema.ts:54-62`; `src/server/tenant-scope-rules.mjs:177-181` |
| 7 | §1 `LEGACY_WORKSPACE_ID` is **Removed** from resolution | **STILL TRUE** *(as decision)* | **no** | still returned at `src/server/auth.ts:179`. The table's present tense reads as current state; it is a target. Raised to a Home precondition in `DECISIONS.md` D-H03 |
| 8 | §2 The equality invariant (label = URL = authorized workspace = page data = mutation destination = Timeline binding) | **STILL TRUE** | **no** | no branded id, no resolver, no parameterised mutation exists |
| 9 | §2 Exception: a raw Note authorizes `note.userId === actor` | **STILL TRUE** | **yes** | `src/modules/notes/server/actions/notes.ts:247-251`, `:280-300`; guardrail stated at `notes-schema.ts:19-22` |
| 10 | §2 Exception: Home / Full Briefing may use a labelled aggregate Read Scope | **STILL TRUE** | no | matches this file's reconciliation row 2 above; sealed in `contracts/PROJECT_SCOPE.md` §5 |
| 11 | §3 Types `ProjectId`, `ActiveProjectContextV3`, `ProjectRouteState`, `NotesReadScope`, `BriefingReadScope`, `TimelineRef` | **STILL TRUE** | **no** | zero occurrences of any of the six, repo-wide |
| 12 | §3 `workspaceId` stays the serialized field name | **STILL TRUE** | partial | already consumed at `src/modules/notes/app/page.tsx:79` and `src/app/app/page.tsx:17-29` |
| 13 | §4 Authority layer "HttpOnly cookie" | **NEW CONFLICT** | — | the same cookie has **five writers with four attribute sets**; two are not HttpOnly — `src/server/actions/cross-workspace.ts:196` sets `httpOnly:false`, `src/server/actions/settings.ts:614-618` omits the attribute. Full table: `DECISIONS.md` D-H12 |
| 14 | §4 "Following a contextual link does not rewrite the cookie" | **NEW CONFLICT** | — | `GET /api/suite-context` — the contextual-link handoff — writes it at `src/app/api/suite-context/route.ts:60-66` |
| 15 | §4 Precedence step 2: explicit id → exact Project or `unavailable`, **never a substitute** | **STILL TRUE** | **no** | three live substitutions: first-membership at `src/server/auth.ts:169-174`; Planning-Period fall-through at `src/modules/notes/server/tasks-personalization.ts:192-209`; Timeline adoption (owned by `lane/wp1-timeline-safety`) |
| 16 | §4 Precedence step 3: "first accessible active Project by **deterministic ordering**" | **DRIFTED** | no | no ordering exists and the ADR does not define one. `src/server/auth.ts:169-174` is an unordered `.limit(1)` over `workspace_members`. A property is asserted that neither document supplies |
| 17 | §4 Precedence step 4: never `LEGACY_WORKSPACE_ID` | **STILL TRUE** | **no** | see row 7 |
| 18 | §4 Collapse missing / forbidden / deleted into one neutral `unavailable` | **STILL TRUE** | no | adopted verbatim at `contracts/PROJECT_SCOPE.md` §8.1 |
| 19 | §5 `switchActiveProjectAction` rejects archived targets and never cookies them | **NEW CONFLICT** | **no** | the action does not exist. Its incumbent `selectWorkspaceAction` (`src/server/actions/cross-workspace.ts:177-202`) has **no archived predicate** — and returns `{ ok: true }` on a membership refusal at `:191`, making refusal byte-identical to success. `workspaces.archivedAt` exists at `src/server/db/schema.ts:311` |
| 20 | §5 Archived Notes stay privately editable | **STILL TRUE** | n/a | consistent with row 9 |
| 21 | §6 One Project → one hidden Timeline workspace → one primary Timeline | **STILL TRUE** | partial | `timeline-schema.ts:334-337` unique `suite_workspace_id`; `:79-84` `source_tasks_workspace_id` |
| 22 | §6 `resolveCanonicalTimeline` outcomes are exactly six; "open another Timeline" is not one | **STILL TRUE** | **no** | zero occurrences of `resolveCanonicalTimeline`; owned by `lane/wp1-timeline-safety`, unmerged |
| 23 | §7 Active Project (global, URL, explicit) vs Read Scope (local, widening, labelled) | **STILL TRUE** | no | independently committed to at this file's reconciliation row 2, before the ADR was readable here |
| 24 | §8 URL contract: one canonical `workspaceId` appended to existing routes | **DRIFTED** | **no** | the routes exist; the destinations do not consume the parameter. `/app/project?workspaceId=…` is listed, yet `src/app/app/project/page.tsx:20-22` accepts **no search params at all** and its own comment records that as deliberate ("No slug param"). `/app/tasks?workspaceId=…` is listed, yet `src/app/app/tasks/page.tsx:21` types `searchParams` as `{ welcome?: string }`. `docs/wave/DECISIONS.md` D-014 records the `/app/tasks` half; **`/app/project` is not in D-014** |
| 25 | §8 V3 links must not emit `sourceProduct`, `contextVersion`, `planningPeriodId`, global `projectId` | **STILL TRUE** | no | all four still emitted at `src/lib/suite-context.ts:24-31` |
| 26 | §8 `scripts/check-suite-switcher-contract.mjs:119-125` requires `sourceProduct` | **DRIFTED** *(citation)* | — | substantively true; the pin is at **`:126`**, inside a `mustContain` block spanning `:122-128`. A lane following the cited range lands three lines short of it |
| 27 | §9 Two safe mutation patterns; never client id plus object-id-only mutation | **STILL TRUE** | **no** | 101 `getActiveWorkspace(` occurrences across **43** non-test source files, verified by count at this base |
| 28 | §9 A CI source guard forbids new mutation-time ambient lookup | **STILL TRUE** | **no** | no such guard exists. `docs/wave/MUTATION_INVENTORY.md:121-131` specifies Guard D as a build, and correctly warns that a regex version is a lower bound, not a proof |
| 29 | §10 "101 `getActiveWorkspace()` call sites across 43 files" | **STILL TRUE** | — | **verified exactly**: 101 occurrences, 43 non-test files |
| 30 | §10 `experience/registry.json` materiality-hash cascade | **STILL TRUE** | — | **78 entries** confirmed by count, matching `docs/wave/DECISIONS.md` D-008 |

**Nothing in ADR 0001 is RESOLVED.** No production source moved between `3682bf7` and
`78021c5`, so no defect it names could have been fixed in the interval.

---

## 2. `docs/wave/ANALYTICS_TRUTH.md` R1–R10 — all ten classified

| # | Defect | Verdict | Evidence at `78021c5` |
|---|---|---|---|
| **R1** | Three colliding Project id spaces, unioned and joined as if identical | **STILL TRUE** | `TaskRecord.projectIds` = slugified tags (`providers/tasks.ts:145`) · `NoteRecord.projectIds` = the linked task's tags (`providers/notes.ts:151`) · `MilestoneRecord.projectId` = Timeline `project_slug` (`providers/timeline.ts:206`, `:217`) · `ProjectRecord.id` = slugified tag (`providers/tasks.ts:266`). Unioned at `src/modules/signal/lib/analytics/scope.ts:107-112`; joined `milestone.projectId === project.id` at `src/modules/signal/server/analytics/service.ts:568` |
| **R2** | Blocked work is dead against live data | **STILL TRUE** | `explicitBlocking` tests `row.lane` against `"blocked"` and `"waiting"` at `providers/tasks.ts:128`, surfaced at `:158`. `LaneId` is four values (`src/lib/data.ts:1`); migration `drizzle/0024_retire_waiting_lane.sql:57-60` rewrote every `lane='waiting'` to `lane='doing'` plus `board_column_key='waiting'`; the mirror schema has **no `board_column_key`** (`signal-tasks-db-schema.ts:14-42`). `explicitCount` is always 0 |
| **R3** | Done read with a different predicate from the rest of the app | **STILL TRUE** | `isTaskDone(row, null)` at `providers/tasks.ts:117`, `:148` and `providers/notes.ts:105`, `:154`; a `null` config resolves `doneKeys = ["done"]` at `src/lib/board-columns.ts:183-186` |
| **R4** | Two of thirteen metrics can never be `available`; fixtures declare capabilities production lacks | **STILL TRUE** *(citation path)* | Notes declares only `["follow_up_read","cross_product_links"]` (`providers/notes.ts:173`, also `:75`). Timeline declares `milestone_date_history` only when `dateChanges.size` (`providers/timeline.ts:251`), pushing `milestone_date_history_unavailable` otherwise (`:241`). Fixtures declare both — at **`src/modules/signal/lib/analytics/fixtures.ts:58-59`**; the record cites a bare `fixtures.ts:58-59`, and a sibling `src/modules/signal/server/analytics/fixture-access.ts` exists to be confused with it |
| **R5** | Cross-product link arrays hardcoded empty | **STILL TRUE** | `linkedDecisionIds: []` and `linkedMilestoneIds: []` at `providers/tasks.ts:162-163`; `linkedMilestoneIds: []` at `providers/notes.ts:161`; `linkedDecisionIds: []` at `providers/timeline.ts:225` |
| **R6** | Dead `/app/trends` links reach a real user surface | **STILL TRUE** | built at `src/modules/signal/lib/analytics/rules.ts:154`; **no `src/app/app/trends` directory exists** — the `/app` route listing is `archived, home, import, inbox, my-tasks, notes, project, settings, signal, task, tasks, timeline, your-work` |
| **R7** | No snapshot writer exists | **STILL TRUE** | `captureWorkspaceSnapshots` defined at `src/modules/signal/server/analytics/snapshots.ts:244`; a grep over `src/` and `scripts/` returns **that definition and nothing else**. `vercel.json:3-8` declares exactly one cron, `/api/cron/digest?send=1` |
| **R8** | Notes aggregates viewer-scoped without disclosure | **STILL TRUE** | the SELECT binds `WHERE user_id = ?` to `this.clerkId` at `providers/notes.ts:86`, `:91`. Two members of one Project get different follow-up counts from the same query; none of the declared issue codes at `:178-189` names this cause |
| **R9** | Owner identity collision drops every milestone under a `user` scope | **STILL TRUE** | `hasOwner` compares `scope.id` against `ownerIds` at `src/modules/signal/lib/analytics/scope.ts:19-21`; `MilestoneRecord.ownerIds` comes from Timeline's `assignee` column at `providers/timeline.ts:226` — a different namespace |
| **R10** | Unordered 2,000-row read | **STILL TRUE** | `providers/tasks.ts:58-62` selects with `.limit(MAX_TASKS + 1)` and **no `ORDER BY`**; `MAX_TASKS = 2_000` at `:27` |

### ANALYTICS_TRUTH headline and flag claims

| Claim | Verdict | Evidence |
|---|---|---|
| No analytics surface reaches any user, in any environment | **STILL TRUE** | `/app/home` renders via `loadHomeData` → `buildBriefingForUser` (`src/app/app/home/home-data.ts:101-107`); `/app/home/briefing` returns the legacy briefing while the flag is off (`src/modules/signal/app/signal-brief-page.tsx:38`) |
| No trend or historical comparison is producible | **STILL TRUE** | R7 |
| `SIGNAL_ANALYTICS_V1_ENABLED` is a **briefing-engine** switch, not a view switch — a dedicated `SIGNAL_HOME_ANALYTICS_ENABLED` is required | **STILL TRUE** | `signal-brief-page.tsx:38` chooses which engine renders; `policy.ts:44` gates the whole analytics domain. Consistent with this file's reconciliation row 9 and `docs/wave/DECISIONS.md` D-011 |
| Private Note bodies never enter the analytics domain — "must survive the rebase" | **STILL TRUE, independently confirmed** | the SELECT names its columns and omits `body` (`providers/notes.ts:84-85`); `exposure: "approved_extract"` at `:164`; `deepLink: ""` at `:163`. Audit B reached the same conclusion separately at `audit/B-domain-permissions.md:482-525` and calls it the best-defended seam in the estate |
| Missing sources degrade honestly rather than fabricating zero | **STILL TRUE** | `providers/timeline.ts:30-42`, `providers/notes.ts:36-46`. This is the vocabulary Charter rule 11 needs; `contracts/PROJECT_SCOPE.md` §5 rule 7 extends it rather than inventing a second one |
| Preview deployments would serve synthetic data with no authentication if the flag were on | **STILL TRUE** | `policy.ts:49-63` returns a synthetic principal and never calls `auth()`; masked only by the flag 404ing first at `policy.ts:44`. Compounds `R-H10` — `/lab` has no authentication guard either |

---

## 3. Where our audits went beyond their records

Five findings our Wave 0 audits produced that the ADR and `docs/wave/**` do not carry. For
each: does it **contradict** or **extend**?

| # | Our finding | Relationship | Detail |
|---|---|---|---|
| 1 | **Four project identities**, not three id spaces | **EXTENDS** | R1 counts three *id spaces inside the analytics domain*. Audit B counts four *identities across the estate* (`audit/B-domain-permissions.md:37-147`) and adds three collisions R1 does not reach: the `ms-${tasksWorkspaceId}-${tasksTaskId}` node id as a fifth space (`tasks-milestone-source.ts:161`); **two tables literally named `workspaces` in two databases with different primary keys** (`src/server/db/schema.ts:272` id, vs `timeline-schema.ts:325-328` slug); and **three unrelated status vocabularies** (`src/lib/data.ts:1` · `timeline-schema.ts:102-107` · `src/modules/signal/lib/data/types.ts:16`). Same direction, wider frame. No contradiction. |
| 2 | **Five membership seams over four transports** | **EXTENDS** | ADR 0001 §4 names the Tasks membership query as *the* authorization layer but never enumerates the competitors or dispositions them. Audit B enumerates five seams (`:189-202`) and twenty-one workspace-set functions (`:204-261`), nine of them cross-workspace, disagreeing on owner-only vs owner-or-member and on archived handling. Naming one canonical seam without dispositioning four live alternatives leaves four paths that can each answer differently. Closed by `DECISIONS.md` D-H02. |
| 3 | **The cookie-bound mutation problem** | **AGREES — and their count supersedes ours** | Audit B found 80 `getActiveWorkspace()` call sites across 24 files (`:283-288`), counting only `src/server/actions/`. `docs/wave/MUTATION_INVENTORY.md:5-10` derives **95 ambient sites across 39 files** from 101 raw occurrences across 43 non-test files, with an explicit subtraction of the definition, one error string and three test-guard literals. We verified 101 / 43 at this base. **Their inventory is the better instrument and is adopted; ours is superseded.** Their critical/high split — 36 sites where the cookie *is* the write destination, versus 40 where a wrong Project produces a silent refusal that returns success — is the exact distinction Home's write path depends on. |
| 4 | **No approval primitive exists** | **EXTENDS** | No approvals table, column or action anywhere in `src/server` or `src/modules` (`audit/B-domain-permissions.md:322-330`). The word survives only in Notes' *extract approval* sense. Neither the ADR nor `docs/wave/**` mentions it, because it is outside their scope — but the Charter's Inbox kinds include `approval-requested`, so this is a from-zero schema build for our Wave 6 (`R-H12`), not a wiring job. |
| 5 | **Snapshot writer with zero callers** | **AGREES — independent confirmation** | R7 and `audit/B-domain-permissions.md:546-572` reached this separately. Audit B adds two facts R7 does not carry: `listEligibleSnapshotWorkspaces` is also uncalled, and its eligibility boundary is `analytics_users.linked_workspace_id IS NOT NULL` — **one workspace per user, not all of them** (`snapshots.ts:57-66`); and `/api/analytics/capture` is a PostHog forwarder, "a route named for a job it does not do" (`src/app/api/analytics/capture/route.ts:12-15`). |

---

## 4. New at this base — recorded by neither body of work

Found during this revalidation. Each is evidenced, none is fixed here, and none is owned by
a current lane.

1. **`tasks_active_ws` has five writers with four different attribute sets**, so the
   cookie's HttpOnly posture depends on which path last wrote it:
   `cross-workspace.ts:193-200` (`httpOnly:false`) · `api/suite-context/route.ts:60-66`
   (`true`) · `planning.ts:1252-1258` (`true`) · `templates.ts:136-140` (`true`, and **no
   `maxAge` — a session cookie**) · `settings.ts:614-618` (**attribute omitted, defaults
   `false`**). `MUTATION_INVENTORY.md:35-37` is correct that exactly one `cookies()`
   **read** resolves a workspace; the **writes** were never enumerated. `DECISIONS.md`
   D-H12.
2. **The contextual-link handoff writes the cookie**, contradicting ADR §4 directly —
   `src/app/api/suite-context/route.ts:60`. Same decision record.
3. **The explicit Project switch returns success on refusal.** `selectWorkspaceAction`
   returns `{ ok: true }` when no membership row is found
   (`src/server/actions/cross-workspace.ts:191`). No caller can distinguish a completed
   switch from a refused one.
4. **No sign-out path clears the Project cookie.** The only deletions are Project-delete
   (`planning.ts:290`, `settings.ts:823`) and account deletion
   (`src/components/settings/profile/danger-zone.tsx:95`). With `path:"/"` and a 30-day
   `maxAge`, the previous actor's Project id survives an actor change. Not a data leak —
   seam 1 revalidates membership at `src/server/auth.ts:154-165` — but a truth and
   privacy-of-inference defect. `DECISIONS.md` D-H09.
5. **`/app/project` is documented in-source as deliberately ambient**
   (`src/app/app/project/page.tsx:7-19`, "No slug param"), while ADR §8 lists
   `/app/project?workspaceId=…` in the canonical URL contract. `docs/wave/DECISIONS.md`
   D-014 records the `/app/tasks` version of this defect but not this one.

---

## 5. Dispositions updated

Amends the "Absorbed vs superseded" table above. That table is not rewritten.

| Their artifact | Wave 1 disposition |
|---|---|
| `docs/adr/0001-canonical-project-identity.md` | **ADOPTED, unamended** (`DECISIONS.md` D-H01). Revalidated claim by claim in §1. Three NEW CONFLICTs and three DRIFTs recorded against it; none is structural and none requires an amendment to the decision itself. |
| `docs/wave/ANALYTICS_TRUTH.md` R1–R10 | **ADOPTED as Wave 8 release blockers.** All ten STILL TRUE, verified individually in §2. Zero resolved. |
| `docs/wave/MUTATION_INVENTORY.md` | **ADOPTED, and it supersedes audit B §3's own count.** Its critical/high split is the input to `contracts/PROJECT_SCOPE.md` §9. Its Guard A baseline of 93 lines is the ratchet Home's write path is measured against. |
| `docs/wave/DECISIONS.md` D-001…D-017 | **READ AND HONOURED.** D-005 raised from a WP3 target to a Home precondition (D-H03). D-010(a) ratified (`contracts/PROJECT_SCOPE.md` §2.3). D-014 extended to `/app/project` (§4 item 5 above). D-017's carried-forward `owner-reconciliation-required` gap is consumed as a named refusal state (`contracts/PROJECT_SCOPE.md` §2.2). |
| `docs/wave/PROGRAMME.md` | **Still not superseded.** That is a lead-owned edit on a merged base and this revalidation does not perform it. |
| `src/lib/projects/**` | **CONSUME.** Absent at `78021c5`. `contracts/PROJECT_SCOPE.md` §11 states the required interface so the lead can check `lane/wp2-project-platform`'s landed work against it. |

---

## 6. What this revalidation did not settle

1. `src/lib/projects/**` has not landed; `contracts/PROJECT_SCOPE.md` §11 is an unverified
   acceptance surface until it does.
2. Deterministic bare-entry ordering is undefined by both documents and by the code
   (§1 row 16).
3. The five-writer cookie consolidation is **unowned** by any current lane.
4. No claim here is runtime-verified. This is a static read at one SHA, consistent with the
   audits it revalidates.
