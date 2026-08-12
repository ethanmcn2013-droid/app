# Contract · Content ownership across the Home surfaces

**Status:** Sealed (Wave 1). Binding on every Home surface, contract test and lab direction.
**Base:** `origin/main` @ `78021c5` · branch `feat/home-operating-layer` · worktree `_wt-home-layer`
**Adopts:** `contracts/PROJECT_SCOPE.md` (sealed) · `docs/adr/0001-canonical-project-identity.md`
**Pairs with:** `contracts/TODAY_RANKING.md` (the engine this contract points every ranked
section at)
**Evidence:** `audit/A-repo-product-truth.md` §2–§9 established the section inventory. Where a
line number below differs from audit A's, it was re-read at this base — audit A was cut at
`a849fc4` and a handful of files have moved since.
**Tests:** `src/lib/home-layer/today/content-ownership-contract.test.ts` (failing by design)

Changing anything sealed here requires a founder-approved ADR or a lead-owned amendment
recorded in `DECISIONS.md`. An implementation agent may not reopen it.

---

## 0. What this contract is, and what it is not

Charter rule 10 says the five Home modes have **mutually exclusive primary jobs** and that
existing duplicate summaries get decomposed. That sentence is a product intention. This
document is the machine-checkable version of it.

It is **not** a layout, a section list for a designer, or a rename plan. It answers exactly
three questions for every piece of content the authenticated app renders today:

1. Which surface is allowed to make which **claim** about a source object.
2. What happens to the sections that currently make the same claim twice.
3. How a test detects a regression without reading prose.

It does **not** decide the Inbox event vocabulary, the My work coverage boundary, or the
Analytics view set. Those are separate sealed contracts (§11). It decides only who owns what,
and it is deliberately silent where another contract is the owner.

**One thing it does not do, on purpose.** It does not say a task may appear on only one
screen. That rule would be wrong — a task that is overdue *and* assigned to me legitimately
belongs in both "what deserves attention now" and "what I am responsible for". The defect
being fixed is narrower and more damaging: two surfaces **independently computing** the same
answer, and disagreeing.

---

## 1. Vocabulary

Three definitions carry the whole contract. Everything after §1 is a table indexed by them.

### 1.1 `SourceRef` — the shared source identity

Every renderable thing on a Home surface resolves to exactly one `SourceRef`. There is no
second identity, no per-surface id, and no display id that a surface invents for itself.

```ts
type SourceRef = {
  /** The product whose database owns the row. Never the surface showing it. */
  product: "tasks" | "notes" | "timeline";
  kind: SourceKind;
  /** The id in that product's own store. Never re-keyed, never hashed for identity. */
  id: string;
  /** Canonical Project (PROJECT_SCOPE §1), or null for Unfiled / Unprojectable
   *  (PROJECT_SCOPE §6). `null` is a state, never a missing value. */
  projectId: ProjectId | null;
};

type SourceKind =
  | "task"            // Tasks `tasks` row
  | "note-extract"    // the creator-authored APPROVED extract only — never a raw note body
  | "milestone"       // Timeline milestone
  | "decision"        // structured Notes-derived decision  (capability `decision_read`)
  | "follow-up"       // structured Notes-derived follow-up (capability `follow_up_read`)
  | "calendar-event"  // no producer exists at this base — see §3.1 row E
  | "notification"    // Tasks `notifications` row
  | "activity";       // Tasks `activities` row

/** The ONLY key any Home surface may de-duplicate, dismiss, or badge on. */
const sourceKey = (r: SourceRef) => `${r.product}:${r.kind}:${r.id}`;
```

Why this shape and not a bare id: ids are unique inside a product, not across the estate. A
Notes id and a Tasks id can be byte-identical, and the moment a second product feeds Home,
a bare-id de-duplication merges two unrelated rows and neither user nor test can see it.
The engine's current final tie-break is `a.task.id.localeCompare(b.task.id)`
(`src/modules/signal/lib/briefing/build.ts:306`) — correct while one product feeds it, and
silently wrong the day a second one does.

`sourceKey` is **not** a presentation id. The ledger deliberately emits an opaque hashed id
to the client (`src/modules/signal/lib/analytics/ledger-contract.ts:31-32`,
`:92-94`) and that stays true. `sourceKey` is a server-side de-duplication key.

### 1.2 Presentation roles — what a surface is *claiming*

A surface does not "show a task". It makes one or more of five claims about it. Duplication
is two surfaces making the **same claim** about the **same** `sourceKey` from **different
code**.

| Role | The claim being made | Example of it today |
|---|---|---|
| `rank` | "these are in priority order" | Today's three rows, ordered by `focusWeight` (`build.ts:287-297`) |
| `reason` | "here is why this matters", in prose | `phraseFor(...)` (`build.ts:220-224`); `generateNudges` copy banks (`src/lib/nudges/generate-nudges.ts:54-99`) |
| `count` | a total, a badge, or a denominator | `readCounts` (`ledger-contract.ts:57-68`); the Inbox open count (`src/components/app/sidebar.tsx:296-345`) |
| `state` | read / unread / responded / dismissed | `tasks_dismissed_nudges` in `localStorage` (`src/components/app/inbox/inbox-app.tsx:207-217`) |
| `inventory` | "this is the complete list of X" | My Week's buckets (`src/lib/tasks/selectors.ts:121-181`) |

### 1.3 Surface ids

| Surface id | Route after Wave 4 | Route today | Primary job (Charter §"What we are building") |
|---|---|---|---|
| `home.today` | `/app/home` | `/app/home` | what deserves attention now? |
| `home.briefing` | `/app/home/briefing` | `/app/home/briefing` | the complete daily ledger — depth from Today, not a fifth mode |
| `home.inbox` | `/app/home/inbox` | `/app/inbox` | what changed and needs my response? |
| `home.my-work` | `/app/home/my-work` | `/app/my-tasks` | what am I responsible for? |
| `home.analytics` | `/app/home/analytics` | **does not exist** | what does the evidence say? |
| `project.overview` | `/app/project` | `/app/project` (orphaned) | Project scope and mutation context — **not a Home mode** (Charter rule 5) |

---

## 2. The role ownership matrix

**One owner per (`SourceKind` × role).** This table is the contract; §3 shows how each
current section is reconciled to it.

| SourceKind | `rank` | `reason` | `count` | `state` | `inventory` |
|---|---|---|---|---|---|
| `task` | `home.today` | `home.today` | `home.analytics` | product (Tasks) | `home.my-work` |
| `note-extract` | `home.today` | `home.today` | `home.analytics` | product (Notes) | `home.my-work` |
| `milestone` | `home.today` | `home.today` | `home.analytics` | product (Timeline) | `home.my-work` |
| `decision` | `home.today` | `home.today` | `home.analytics` | product (Notes) | `home.my-work` |
| `follow-up` | `home.today` | `home.today` | `home.analytics` | product (Notes) | `home.my-work` |
| `calendar-event` | — **unsupported, no producer** (§3.1 row E) | — | — | — | — |
| `notification` | `home.inbox` | `home.inbox` | `home.inbox` | `home.inbox` | `home.inbox` |
| `activity` | `home.inbox` | `home.inbox` | `home.inbox` | `home.inbox` | `home.inbox` |

Read the two interesting columns out loud, because they are the whole decision:

- **`home.today` owns `rank` and `reason` for every work object.** One engine asserts
  priority and writes the sentence explaining it. Charter rule 9. `home.briefing` is the
  same engine at full depth — it is not a second owner, it is the same owner rendering
  everything instead of three.
- **`home.my-work` owns `inventory`.** It is the only surface allowed to imply "that is all
  of it". Today never implies completeness; it is a capped, ranked read and it says so.
- **`home.inbox` owns every role for events.** Charter rule 6: one route, one store, one
  badge definition, one state machine. Today does not rank events and does not render an
  event count of its own; it links to the Inbox badge, which is the Inbox's number.
- **`home.analytics` owns `count`** for work objects — totals, denominators, progress. Not
  because Analytics is where numbers look best, but because a number is a claim about
  completeness of evidence, and Analytics is the only surface with a coverage model to
  qualify it (`src/modules/signal/lib/analytics/contracts.ts:227-249`). A count rendered
  without coverage is Charter rule 11's exact failure.

`state` for work objects stays with the product, not with Home: Home is a reader
(PROJECT_SCOPE §7.1) and every Tasks mutation is currently cookie-bound (PROJECT_SCOPE §9,
`R-H11`).

---

## 3. Ownership register — every current section

Migration action vocabulary is audit A's: **retain · decompose · migrate · redirect ·
retire · build**. "Decompose" here has a precise meaning: *the section stops computing its
own answer and starts rendering the owner's*.

### 3.1 `/app/home` — Today

`src/app/app/home/page.tsx:23` → `loadHomeData()` (`src/app/app/home/home-data.ts:101-213`).
One briefing build, sliced three ways.

| # | Section | Current source | Current user job | Future canonical owner | Migration action | Shared source identity | Secondary appearance allowed? |
|---|---|---|---|---|---|---|---|
| A | **Today's Signal** | `briefing.needsAttention` ++ `briefing.quietRisks`, engine order preserved, cap 3 across both (`home-data.ts:130-133`; cap at `build.ts:19`, `:94-96`) | "what is asking for me right now" | `home.today` — `rank`, `reason` | **retain**, re-founded on `TODAY_RANKING.md` (multi-source, versioned, pinned `asOf`) | `SourceRef`; today the id is a bare task id (`home-data.ts:119`) | **Yes**, on `home.briefing` — same engine, full depth, one source route. Nowhere else. |
| B | **All-clear state** | rendered when `signalRows.length === 0`; body names `briefing.movingWell.length`; `readLine` names `briefing.readCount` (`home-data.ts:176-192`) | "am I actually clear, or is the page just empty" | `home.today` — `reason`, `count` | **decompose** — the quiet-language prohibition moves into the engine (`TODAY_RANKING.md` §9); Home stops assembling the sentence from three fields | n/a (an assertion about the read, not an object) | **Yes**, on `home.briefing` (`emptyState`, `ledger-contract.ts:43-46`), which must resolve to the identical verdict from the identical inputs. |
| C | **Coming up** | raw `signals` filtered `dueAt != null && lane !== "shipped" && !surfacedIds.has(id)`, `0 ≤ daysOut ≤ 14`, sorted by `dueAt`, cap 4 (`home-data.ts:78-79`, `:137-157`) | "what lands soon that is not yet shouting" | **`home.my-work` owns `inventory`; `home.today` owns the capped ranked view** | **decompose** — see `DUP-1` | `SourceRef` | **Yes** on `home.today`, capped and ranked, with a single route onward to `home.my-work` for the full horizon. Never as a list implying completeness. |
| D | **Needs review** | raw `signals` filtered `lane === "review" && !surfacedIds.has(id)`, sorted `idleDays` desc, cap 3 (`home-data.ts:80`, `:159-171`). **Unreachable in production** — the mapper cannot emit engine lane `review`; see `DUP-2` | "what is parked waiting on a human" | **`home.my-work` owns `inventory`; `home.today` owns the capped ranked view** | **decompose** — see `DUP-2` | `SourceRef` | **Yes** on `home.today`, same terms as row C. |
| E | **Calendar events** | **nothing renders.** `WorkRead.events` is hardcoded `[]` (`src/modules/signal/lib/data/source.ts:271-273`) and `WorkRead` has no Notes or Timeline shape at all (`src/modules/signal/lib/data/types.ts:85-93`) | — | `home.today` when a producer exists | **build**, and until then render `unsupported` | `SourceRef.kind = "calendar-event"` | Not applicable. **The prohibition is the deliverable:** an empty `events` array may never render as "nothing in your calendar". No producer means `unsupported`, and `unsupported` is a named state (`contracts.ts:227-232`), not an empty list. |
| F | **Provenance line** (`sourceLabel`) | the string template `` `Tasks · ${workspaceNames.get(...) ?? "Workspace"}` `` (`src/modules/signal/server/briefing/signal-build-for-user.ts:331`) | "where did this come from" | `home.today` | **decompose** — resolve from the record, never format. Audit A calls this "a lie by template, not by design" (`audit/A-repo-product-truth.md:556-558`) | `SourceRef.product` + resolved Project name | Rendered wherever the row is. It is a property of the row, not a section. |
| G | **Scope label** | `authorizedScope.label` (`home-data.ts:112`, `:207`) | "what am I looking across" | `home.today`, from Home Read Scope | **decompose** — Read Scope is a URL axis (PROJECT_SCOPE §5) and its label is mandatory and literal (§5 rule 1) | n/a | Every Home surface renders it. It is chrome, not content. |
| H | **Greeting / date line** | `greetingFor(briefing.greetingHour)` (`home-data.ts:86-91`, `:206`) | orientation | `home.today` | **retain** | n/a | The Inbox renders a second greeting today (§3.3 row 1) — see `DUP-6`. |

**The `/app/task/${id}` link defect rides with every row above.** `taskHref`
(`home-data.ts:82-84`) emits no `workspaceId`, and `/app/task/[id]` accepts no search params
(PROJECT_SCOPE §10.2, assertions A6/A8). Fixing it is a `PROJECT_SCOPE` §11 precondition,
not a content-ownership change; it is named here so the link contract is not assumed
satisfied by this document.

### 3.2 `/app/home/briefing` — Full briefing

Two engines behind one route, chosen by flag (`src/modules/signal/app/signal-brief-page.tsx:38-40`).

| # | Section | Current source | Current user job | Future canonical owner | Migration action | Shared source identity | Secondary appearance allowed? |
|---|---|---|---|---|---|---|---|
| A | **Legacy ledger** (flag off, or any planning period requested) | `buildBriefingForUser` → `buildLegacyLedgerDTO` (`src/modules/signal/app/signal-legacy-briefing.tsx:48-70`) — the Tasks-only path | the complete daily read | `home.briefing`, sharing `home.today`'s engine | **retain** as the render target; its *source* is replaced (`TODAY_RANKING.md` §3) | `SourceRef` | This **is** the sanctioned secondary appearance of Today's rows. One source route: the shared engine. |
| B | **Progressive ledger** (flag on, no planning period) | `calculateSignalView(..., "briefing", ...)` over the three-provider stack (`signal-brief-page.tsx:44-49`) | same job, coverage-aware | `home.briefing` | **retain**; it is the only live consumer of the provider stack and the only place `DataCoverage` reaches a user today | `SourceRef` | Same as row A. |
| C | **Read accounting** — `read` / `flagged` / `shown` / `cleared` | `SignalLedgerReadCounts` (`ledger-contract.ts:57-68`, computed `:292-301`) | "did it actually filter, or is it asserting" | `home.briefing` owns the full accounting; `home.today` renders the short form | **retain**, with two corrections in `TODAY_RANKING.md` §6 (`cappedOut` and `dismissed` are currently folded into `cleared`) | n/a | **Yes** — `home.today` shows `read` and the held-back count. It must be the same arithmetic, from the same build, not a second sum. |
| D | **Freshness / coverage note** | `freshness` + `coverageNote` (`ledger-contract.ts:82-83`), derived by `coverageFreshness` (`src/modules/signal/lib/analytics/metrics.ts:944-966`) | "how much of this can I trust" | `home.briefing`, and `home.today` in short form | **retain** — this vocabulary is the estate's only honest one; `TODAY_RANKING.md` §7 adopts it rather than inventing a second | n/a | Every surface that renders a ranked row renders its freshness. Silence is prohibited. |
| E | **Scope switcher** | `SignalScopeSwitcher` (`signal-legacy-briefing.tsx:74-80`), gated on `planningPeriodsEnabled()` | change what is read together | Home Read Scope control (PROJECT_SCOPE §5) | **decompose** — one Read Scope control, shared by every Home surface, `replace`-not-`push` (PROJECT_SCOPE §10.2) | n/a | One control, rendered on every Home surface. Not a per-surface widget. |
| F | **Onboarding gate** | `isOnboarded(userId)` → redirect (`signal-legacy-briefing.tsx:33-34`) | first-run | `home.briefing` | **out of scope** here — a route gate, not content | n/a | n/a |

### 3.3 `/app/inbox` — six content classes

`src/app/app/inbox/page.tsx` (8 parallel reads, `:92-121`) → `InboxApp`. The component's own
header comment claims two surfaces; the render body stacks six.

| # | Class | Current source | Current user job | Future canonical owner | Migration action | Shared source identity | Secondary appearance allowed? |
|---|---|---|---|---|---|---|---|
| 1 | **Greeting banner** | `personalityPrefs.greeting`, `digest.dueToday.length`, `overdueCount` from `getOverdueTodayCount()` (`inbox-app.tsx:104-110`; reads `page.tsx:109`, `:119`) | orientation | `home.today` (greeting) · `home.analytics` (`count`) | **decompose** — the Inbox stops rendering a greeting and stops rendering an overdue count. See `DUP-6`, `DUP-7` | n/a | **No.** Two greetings on two Home modes is the visible form of "no exclusive primary job". |
| 2 | **Tip card** | `personalityPrefs.tips`, `context="inbox"` (`inbox-app.tsx:112`) | education | out of scope for this contract | **retain** — a preference-gated education slot, not content about a source object | n/a | Not a claim about a `SourceRef`; the invariant does not reach it. |
| 3 | **Nudges** | `generateNudges(tasks, me, columnConfig)` (`page.tsx:121`), rendered `inbox-app.tsx:114`, section `:248-268` | "what's stuck" | **`home.today`** — `rank` and `reason` | **retire the generator, migrate its two distinctive rules into the one engine.** See `DUP-3` and `DUP-4` | `SourceRef` (today: `Nudge.taskId`, optional — `generate-nudges.ts:25-27`) | **No.** After migration the Inbox renders no rules-derived attention prose at all. |
| 4 | **Weekly recap** (LLM-narrated) | `buildWeeklySnapshotFor(ws)` (`page.tsx:97`) + `weeklyDigestNarrationAction`, gated `aiConfigured()` (`page.tsx:130`) | "what happened this week" | **undecided — `home.inbox` provisionally**, subject to the AI contract | **flag, do not move blind** (audit A `:513`). Charter rule 12 binds it either way: AI may phrase authorized deterministic facts, never invent priority, ownership, risk or completeness | `SourceRef[]` of the snapshot's closed/circling titles | Recorded as open (§11 item 3). |
| 5 | **Daily digest** — "Closed yesterday" / "Due today" | `compileDailyDigest(me, ws)` (`page.tsx:95`; `src/server/db/daily-digest.ts:49-80`) | "the day's summary" | `home.my-work` — `inventory` | **decompose.** "Due today" is My work's Today bucket; "Closed yesterday" is its "Done this week". See `DUP-5` | `SourceRef` | **No.** Inbox is response-to-change, not a second task summary (Charter rules 6 and 10). |
| 5b | **Mentions** | `digest.mentions` — 24-hour body snippets (`daily-digest.ts:20-27`), rendered `inbox-app.tsx:169` | "someone addressed me" | `home.inbox` — all five roles | **retain**, and it is the strongest thing in the Inbox: a real event with a real actor | `SourceRef{product:"tasks", kind:"activity"}` | **No secondary appearance.** Charter rule 6. **Carries a live defect:** the mentions query filters only `kind`/`createdAt` with no workspace predicate and applies `.limit(50)` before user filtering (`REPOSITORY_TRUTH.md:136-150`, `R-H15`). Not this contract's to fix; recorded so no lane inherits it as settled. |
| 6 | **Direct alerts** | `getNotificationsForUser(me, ws)` (`page.tsx:94`; `src/server/db/queries.ts:579-598`, workspace-scoped, `limit 50`) | "what needs my response" | `home.inbox` — all five roles | **migrate** to `/app/home/inbox` | `SourceRef{product:"tasks", kind:"notification"}` | **No.** One route, one store, one badge. |
| 7 | **Digest action affordances** — `ShareThisWeekButton`, `CopySlackSummary`, `RollForwardButton` (`inbox-app.tsx:126-146`) | Tasks-scoped writes | act on the summary | follow their content: they move with row 5 to `home.my-work`, or retire with it | **decompose**, gated on `HOME_MUTATIONS_ENABLED` and an explicit `ProjectId` (PROJECT_SCOPE §9) | n/a | Wave 7 decides; they cannot ship before the write path is parameterised. |

**Two different things are both called "nudge", and this contract only retires one of them.**

- **The rules-derived nudge feed** (row 3 above) is `generateNudges` — a pure function over
  the task list, no actor, no record. It is a second attention engine and `DUP-4` retires it.
- **The `notification` kind `nudge`** is a person nudging a person: a real writer at
  `src/server/actions/nudge.ts:185-192`, a real preference toggle, a named sender in the
  payload. It is a genuine event, it is **not** touched here, and its disposition belongs to
  `contracts/INBOX_EVENT.md` (recorded there as `D-INBOX-04`).

Conflating them would delete a real person-to-person message while retiring a rules engine.

**The Inbox has no unread model.** Read state is client-only `localStorage` under
`tasks_dismissed_nudges` (`inbox-app.tsx:207`, `:210-217`); `notifications.read_at` has no
writer anywhere; `notify()` returns early when the payload has no `taskId`
(`REPOSITORY_TRUTH.md:87-89`, `R-H12`). The `state` column of §2 assigns that role to
`home.inbox`; **it does not exist yet and this contract does not pretend otherwise.** It is
new schema work under expand → migrate → contract, owned by Wave 6.

### 3.4 `/app/my-tasks` — My Week

Zero server reads (`src/app/app/my-tasks/page.tsx:6-13`); `MyWeekApp` consumes the
`TasksProvider` the runtime shell filled. Buckets from `bucketMyWeek`
(`src/lib/tasks/selectors.ts:121-181`), all scoped `assignees.includes(currentUser)`
(`:133`) inside the one cookie-selected workspace.

| # | Section | Current source | Current user job | Future canonical owner | Migration action | Shared source identity | Secondary appearance allowed? |
|---|---|---|---|---|---|---|---|
| 1 | **Today** | assigned to me, lane `todo`/`doing`, due before tomorrow, includes overdue (`selectors.ts:151-159`) | "due now" | `home.my-work` — `inventory` | **retain** as inventory; **decompose** its ordering — it must not sort by its own rule while Today sorts by the engine's | `SourceRef` | Its ranked subset appears on `home.today`. Reason prose comes from the engine, never recomputed here. |
| 2 | **This evening** | split out of Today only when an explicit evening time is typed (`src/components/app/my-week/my-week-app.tsx:53-57`) | daypart | `home.my-work` | **retain** | `SourceRef` | No. |
| 3 | **Needs attention** | lane `doing`, idle ≥ 4 days (`selectors.ts:109`, `:161-165`) | "started and stalled" | `home.today` owns `rank`+`reason`; `home.my-work` renders the membership | **decompose** — the threshold collides with the engine's `stuck-work` at ≥ 3 days (`src/modules/signal/lib/briefing/triggers.ts:55-62`). Two idle definitions, one word. See `DUP-4` | `SourceRef` | Yes, as a rendering of the engine's verdict. |
| 4 | **Waiting on you** | lane `review`, any date (`selectors.ts:167-171`) | "parked on a human" | `home.my-work` — `inventory` | **decompose** — see `DUP-2` | `SourceRef` | Yes: the capped, ranked subset on `home.today` ("Needs review"). |
| 5 | **This week** | lane `todo`/`doing`, due in (tomorrow, +7d] (`selectors.ts:173-180`) | "the week's horizon" | `home.my-work` — `inventory` | **decompose** — see `DUP-1`. Note the windows differ: My work uses 7 days, Today's "Coming up" uses 14 (`home-data.ts:78`) | `SourceRef` | Yes: the capped, ranked subset on `home.today` ("Coming up"). |
| 6 | **Done this week** | lane `done`, updated within 7 days (`selectors.ts:140-146`) | "what I closed" | `home.my-work` — `inventory` | **decompose** — the raw `lane === "done"` test is banned for cross-Project reads (PROJECT_SCOPE §5 rule 5); this is single-Project today and becomes cross-Project, so it must move to `isTaskDone(task, config)` first | `SourceRef` | Overlaps the Inbox's "Closed yesterday" (`DUP-5`) and the engine's `just-shipped` (`triggers.ts:124-146`). Three definitions of "recently finished". |
| 7 | **Nudges rail** | `generateNudges(...)` recomputed **client-side** over the same list (`my-week-app.tsx:58-62`, rendered `:158`) | "what's stuck" | `home.today` | **retire.** This is the verbatim duplicate audit A names. See `DUP-3` | `SourceRef` | **No.** |

**Coverage honesty is a precondition, not a polish item.** My work today is "tasks assigned
to me on the board I currently have selected" — not Notes I own, not Timeline milestones I
own, not my other Projects. `RECONCILIATION.md` row 6 already requires a coverage receipt at
the view introduction if the label stays "My work" while v1 is Tasks-only. This contract
adds one clause: **a surface that owns `inventory` must state its own coverage.** An
inventory that is silently narrower than its label is Charter rule 11's failure in its most
expensive form, because the user's response to it is to stop checking anywhere else.

### 3.5 `/app/your-work` — planning-period portfolio index

| # | Section | Current source | Current user job | Future canonical owner | Migration action | Shared source identity | Secondary appearance allowed? |
|---|---|---|---|---|---|---|---|
| 1 | **Period sections + workspace cards** | `listYourWorkForCurrentUser()` → `src/server/planning/queries.ts:67-123`; owned planning periods plus every workspace the user is a member of, with aggregate counts and `nextTaskTitle` | "administer my periods and projects" | **not a Home mode.** Planning administration | **redirect** the route (audit A `:524`); the surface's job is Project/Program administration, which is `project.overview`'s neighbourhood, not `home.my-work` | Project id + Planning Period id | **Never redirect to personal My work** (`RECONCILIATION.md` row 10). "Your work" is a portfolio index; "My work" is a personal responsibility list. Same words, opposite meanings. |
| 2 | **`nextTaskTitle`** | computed in `queries.ts:100-107`, which hardcodes `lane = 'done'` in four SQL expressions and skips `archived_at` | "what's next here" | `home.today` if it survives at all — it is a one-item ranking | **retire.** A per-Project "next thing" computed by SQL beside an engine that exists is a fourth ranker | `SourceRef` | **No.** |
| 3 | **`/api/suite-context` redirect target** | hardcodes `/app/your-work` on both branches (`src/app/api/suite-context/route.ts:23`, `:54`) | cross-product handoff | Home entry | **migrate** — but it is a shared contract owned by `lane/wp2-project-platform`, and it also writes the active-Project cookie (PROJECT_SCOPE §7.2 / D-H12) | n/a | Sequencing, not concurrent editing. |

### 3.6 `/app/project` — Project overview (orphaned)

Fully unreachable from navigation; computes exactly the workspace-level truth Active Project
scope needs (`src/server/actions/project-overview.ts:183-240`, D-011 vocabulary at `:6`).

| # | Block | Current source | Current user job | Future canonical owner | Migration action | Shared source identity | Secondary appearance allowed? |
|---|---|---|---|---|---|---|---|
| 1 | Purpose · owner · members · declared status · target date · parent program | `getProjectOverviewData()` | "what is this Project" | `project.overview` — Project scope header | **retain as scope, not as a mode** (Charter rule 5); consume `src/lib/projects/**`, do not duplicate | `ProjectId` | The Project **name** appears on every Home surface as scope chrome. Its **facts** appear only here. |
| 2 | `taskStats` — total / complete / overdue / undated / `progressPct` (`:292-298`) | `isTaskDone(t, columnConfig)` with the real per-Project config, plus an **instant-based** overdue test | "how is this Project doing" | `home.analytics` — `count` | **decompose.** This is the only one of the four overdue definitions in the estate that uses the real per-Project done config; it is also the only instant-based one. See `DUP-7` | `ProjectId` | Any cross-Project completion figure carries the per-Project-"Done" disclosure (D-H11, PROJECT_SCOPE §3.1 consequence 2). |
| 3 | Milestones (`is_milestone`, not done, cap 5, ordered by `dueAt`) | `project-overview.ts:300+` | "the Project's dated spine" | Timeline product; `home.today` may rank them once `kind:"milestone"` is eligible | **decompose** — a second milestone list beside Timeline's is a duplicate `inventory` | `SourceRef{kind:"milestone"}` | Yes on `home.today`, ranked and capped. |
| 4 | Recent workspace events | `workspace_events` | "what happened here" | `home.inbox` — `activity` | **decompose** — one event store (Charter rule 6) | `SourceRef{kind:"activity"}` | No. |

### 3.7 Analytics

**Nothing renders.** `/app/home/analytics` and `/app/trends` do not exist — no directory, no
route file, no rewrite, no redirect (audit A §8).

| # | Thing | State at this base | Migration action |
|---|---|---|---|
| 1 | Three-provider stack (Tasks / Notes / Timeline) + coverage model + ledger + scope authorization | complete and tested; reachable only from `/app/home/briefing` with `SIGNAL_ANALYTICS_V1_ENABLED` set (`src/modules/signal/server/analytics/feature-flag.ts:11-16`) | **retain and build on.** `REPOSITORY_TRUTH.md:33-44`: a presentation problem, not a research problem |
| 2 | `runAnalyticsRoute` | zero importers (`src/modules/signal/server/analytics/route.ts:9`) | **retain unmounted** — it is the tested auth → parse → calculate → `Server-Timing` envelope. Its existence is not an implemented API |
| 3 | `SignalAppShell` + `overview-view` + `trends-view` + ten descendants | zero importers | **retire before Wave 3** — otherwise a lab agent builds on a dead shell (`REPOSITORY_TRUTH.md:167-176`) |
| 4 | `captureWorkspaceSnapshots` | zero callers repo-wide, so Analytics history is a read over an empty table (`REPOSITORY_TRUTH.md:90-92`) | **build**, and until then **history is `insufficient-history`, never zero and never "flat"**. This is the single most likely place Charter rule 11 gets broken by accident |

---

## 4. The named duplications

Seven. The first three are the ones audit A found and the brief named; `DUP-4` and `DUP-7`
are new at this base and are the more serious pair.

### DUP-1 · "Coming up" (Today) ↔ "This week" (My work)

**Both compute an inventory of dated open tasks, from different code, over different windows.**

| | Today "Coming up" | My work "This week" |
|---|---|---|
| Source | raw `signals` from the briefing capture | `TasksProvider` client state |
| Filter | `dueAt != null`, `lane !== "shipped"`, `0 ≤ daysOut ≤ 14` | lane `todo`/`doing`, due in (tomorrow, +7d] |
| Scope | Home Read Scope (authorized workspace set) | `assignees.includes(me)`, one cookie-selected workspace |
| Order | `dueAt` ascending | insertion order of the bucket |
| Cap | 4 | none |
| Cite | `home-data.ts:78-79`, `:137-157` | `selectors.ts:173-180` |

Audit A: "It is a date filter, not a ranked read … and it overlaps My work's 'This week'
bucket over the same rows" (`audit/A-repo-product-truth.md:507`).

**Resolution.** `home.my-work` owns `inventory` for dated work and states its window and its
coverage. `home.today` keeps a section named for the same horizon, but it is produced by the
**one engine** from the **same candidate set as the top three**, capped, disjoint from them,
and carrying a reason per row. It never implies completeness and always offers one route
onward to `home.my-work`. Eligibility, ordering and cap: `TODAY_RANKING.md` §5.

**What is deleted:** the independent `.filter().sort().slice()` at `home-data.ts:137-157`.
**What is not deleted:** the section. Users need a near horizon; they do not need two of them.

### DUP-2 · "Needs review" (Today) ↔ "Waiting on you" (My work)

Identical rows under two names, with the mismatch hidden one layer down.

| | Today "Needs review" | My work "Waiting on you" |
|---|---|---|
| Predicate | `signal.lane === "review"` | `t.lane === "review"` |
| But `lane` means | the **engine's** lane, mapped from a `Status` (`signal-build-for-user.ts:313-318`) | the **Tasks** lane, directly |
| Order | `idleDays` descending | insertion order |
| Cap | 3 | none |
| Cite | `home-data.ts:80`, `:159-171` | `selectors.ts:167-171` |

**And re-read at this base, it is worse than a duplicate. Today's "Needs review" cannot
populate in production at all.** Trace the two hops:

1. Tasks lane `review` maps to `Status "in-flight"` —
   `LANE_TO_STATUS = { todo: "next", doing: "in-flight", review: "in-flight", done: "shipped" }`
   (`src/modules/signal/lib/data/source.ts:112-117`). `Status` has no `"review"` member at
   all (`src/modules/signal/lib/data/types.ts:15`).
2. The production mapper turns `Status` back into the engine's `Lane` and can emit only
   `shipped`, `in-flight` or `next` — every other status falls through to `next`
   (`signal-build-for-user.ts:313-318`).

The engine's `Lane` union does contain `"review"` (`src/modules/signal/lib/briefing/types.ts:10`),
so `home-data.ts:161` type-checks and reads as correct. It is simply unreachable: the
production path never produces the value it tests for.

**Why no review would have caught it.** The demo/review path builds from `mock-source`
(`signal-build-for-user.ts:30-33`), and that fixture *does* emit `lane: "review"`
(`src/modules/signal/lib/briefing/mock-source.ts:75`). So the section populates in every
demo capture, every screenshot, and every design lab — and is empty for every real user. This
is read-verified, not runtime-verified; confirming it live is Wave 2's job. The resolution
below does not depend on the confirmation.

It also means the "all clear" arithmetic is affected: a real user with work sitting in review
sees neither a "Needs review" row nor any acknowledgement that those rows exist, which is
Charter rule 11 in the specific form of *rendering unreachable data as nothing to see*.

**Resolution.** Same shape as `DUP-1`: `home.my-work` owns the inventory; `home.today` shows
the engine's capped ranked subset. And one lane vocabulary — the engine's `Lane`
(`src/modules/signal/lib/briefing/types.ts:10`) — is derived once, from `isTaskDone(task,
config)` with the real per-Project column config, never from a fixed table. PROJECT_SCOPE §5
rule 5 already names `src/modules/signal/lib/data/source.ts:112-117` as one of the four
cross-Project reads Home may not reuse as-is; this duplication is the user-visible face of
that rule. Fixing the mapping is a precondition of `TODAY_RANKING.md` §3, not a follow-up.

### DUP-3 · The nudge feed renders identically on `/app/inbox` and `/app/my-tasks`

The same pure function, the same seven kinds, rendered twice on two routes:
`generateNudges` server-side at `src/app/app/inbox/page.tsx:121` → `inbox-app.tsx:114`, and
client-side at `my-week-app.tsx:58-62` → `:158`. The component's own comment says so: "the
proactive 'what's stuck' surface folded in from the inbox" (`my-week-app.tsx:58-59`).

They are not even the same call. The Inbox passes the real column config
(`readWorkspaceColumnConfig(ws)`, `page.tsx:121`); My work passes `useColumnConfig()` state.
The Inbox computes at request time; My work recomputes on every `state.tasks` change against
`useCalendarFrame()`'s `nowIso` (`my-week-app.tsx:50-51`). Same function, two clocks.

**Resolution.** Neither surface owns it — see `DUP-4`.

### DUP-4 · The nudge generator is a **second attention engine** (new at this base)

This is the finding that changes the shape of Wave 5, and neither the master brief nor audit
A states it in these terms.

`generateNudges` (`src/lib/nudges/generate-nudges.ts:124-269`) is not a renderer. It is a
complete, independent attention engine with its own rules, its own severity scale, its own
copy banks, its own deterministic phrase rotation and its own cap — running over the same
Tasks rows as the briefing engine, and disagreeing with it.

| | Briefing engine | Nudge generator |
|---|---|---|
| Rules | 6 triggers (`triggers.ts:55-266`) | 6 rules (`generate-nudges.ts:141-255`) |
| Idle threshold | ≥ 3 days (`stuck-work`, `triggers.ts:60`) | ≥ 4 days, second tier ≥ 7 (`generate-nudges.ts:151`, `:141`) |
| Overdue | `due-soon` fires at ≤ 2 days out **and** overdue, severity `80 + min(20, overdueDays·2)` (`triggers.ts:87-118`) | `past-due` splits near (≤3 d, severity 75) and far (>3 d, severity 90) (`:180-204`) |
| Pile-up | `overload` at > 5 in-flight+review (`triggers.ts:232-236`) | `review-pile` at ≥ 4 in review (`:230-241`) |
| Blockers | `blocked-too-long` at blocked ≥ 5 days idle (`triggers.ts:207-213`) | `blocker-cleared` — the **inverse** signal, which the briefing engine has no trigger for (`:207-227`) |
| Severity scale | 40–100, weighted by `focusWeight` 100–1000 (`build.ts:287-297`) | 30–90 flat |
| Ordering | total order: weight → severity → trigger → id (`build.ts:299-307`) | `severity` only (`:260`) — **not a total order**, so equal-severity rows fall back to input order, which is database order |
| Cap | 3 (`build.ts:19`) | 6 (`:268`) |
| Rotation | per-day, per-user hash (`build.ts:312-319`) | per-task-id hash (`:38-46`) |
| Scope | authorized workspace set | one workspace; **rules 2 and 5 read every user's review tasks, not just mine** (`:165`, `:231`) |

The user-visible consequence is concrete: the same two tasks can be ordered one way on Home
and the other way on Inbox, with two different sentences explaining why, on the same day,
from the same rows. Charter rule 9 forbids two ranking implementations for Today and the
Full briefing; it did not anticipate a third.

**Resolution — sealed.**

1. `generateNudges` is **retired as an engine**. It stops being called from any surface.
2. Its two genuinely distinctive rules — `blocker-cleared` and `doing-empty` — are **new
   triggers in the one engine**, with weights assigned in `TODAY_RANKING.md` §4. They are
   real signals and dropping them would lose product, not duplication.
3. Its four overlapping rules (`idle-doing`, `idle-review`, `past-due`, `review-pile`) are
   **deleted**; the engine's `stuck-work`, `due-soon` and `overload` already cover them at
   thresholds chosen once.
4. `llm-narration` stays a *kind* the renderer can format, and stays bound by Charter rule
   12: AI may phrase a fact the engine already authorized. It may not select the fact, order
   it, or judge it.
5. The copy banks are not thrown away — they are the strongest voice work in the surface.
   They move into the engine's `prose.ts` phrasing layer, which already owns rotation.

### DUP-5 · Daily digest ↔ My Week Today / Done this week

"Due today" (`compileDailyDigest`, `src/server/db/daily-digest.ts:49-80`) is My work's Today
bucket (`selectors.ts:151-159`). "Closed yesterday" is its "Done this week"
(`selectors.ts:140-146`), and also the engine's `just-shipped` (`triggers.ts:124-146`, 24-hour
window). Three definitions of "recently finished", three windows (24 h / 24 h / 7 d).

**Resolution.** `home.my-work` owns the `inventory`; `home.today` owns the ranked
`just-shipped` reading; `home.inbox` renders neither. Charter rules 6 and 10: the Inbox is
response-to-change, not a second task summary.

### DUP-6 · Two greetings

`home.today` greets by local hour (`home-data.ts:86-91`); `home.inbox` greets by
`personalityPrefs.greeting` with a `pinnedHour` and a "Good morning, {name}." section title
(`inbox-app.tsx:104-110`, `:123-127`). Two Home modes, two greetings, two clocks.

**Resolution.** `home.today` is the front door and greets. No other Home surface greets.

### DUP-7 · "Overdue" has four definitions (new at this base)

The word appears on four surfaces and means four things:

| # | Definition | Done test | Time basis | Scope | Cite |
|---|---|---|---|---|---|
| 1 | `getOverdueTodayCount()` — feeds the Inbox greeting | `ne(tasks.lane, "done")` | calendar day, server-local `setHours(0,0,0,0)` | one cookie-selected workspace | `src/server/actions/roll-forward.ts:131-147` |
| 2 | `getOverdueAcrossWorkspacesAction` | `ne(tasks.lane, "done")` | calendar day | cross-workspace; **no `archived_at`, no `parent_task_id` filter** | `src/server/actions/cross-workspace.ts:105` |
| 3 | `project-overview.taskStats.overdue` | `isTaskDone(t, columnConfig)` — the real per-Project config | **instant** (`dueAt.getTime() < nowMs`) | one workspace | `src/server/actions/project-overview.ts:293-295` |
| 4 | engine `due-soon` with `daysOut < 0` | engine `Lane !== "shipped"` | calendar day **in the reader's timezone** | authorized scope | `src/modules/signal/lib/briefing/triggers.ts:87-118` |

Definitions 1 and 2 use the `lane === "done"` literal that PROJECT_SCOPE §5 rule 5 bans for
cross-Project reads. Definition 3 is the only one that respects a member-editable "Done"
(PROJECT_SCOPE §3.1 consequence 2) and the only one that will call a task overdue at 00:01
in a timezone where it is not yet tomorrow.

**Resolution.** `count` for work objects is owned by `home.analytics` (§2). Exactly one
overdue predicate exists, it takes `isTaskDone(task, config)` with the real per-Project
config, it is calendar-day based in the reader's timezone, and it filters `archived_at` and
`parent_task_id`. Every surface that says "overdue" calls it. Assertion `O5`.

### Flagged, not resolved: three notification-settings surfaces

`/app/settings` tab 03 (workspace prefs), `/settings/notifications` (account cadence),
`/app/home/briefing/settings/notifications` (static copy, no store). Three routes, three
stores, one user question (audit A `:529`). Out of scope for content ownership — it is an
account-administration question (Charter rule 3) — and recorded so no lane treats the silence
as settlement.

---

## 5. Shared source identity — the rule

1. Every rendered thing on a Home surface carries a `SourceRef` end to end, from the
   provider that read it to the DTO that renders it. A surface that cannot name the
   `SourceRef` of a row may not render the row.
2. `sourceKey(ref)` is the **only** de-duplication, dismissal and badge key. Bare ids,
   composite display strings and per-surface keys are prohibited.
3. `sourceKey` never reaches the client. The presentation id stays the ledger's opaque
   hashed id (`ledger-contract.ts:31-32`). This is not decoration: the ledger's allowlist
   deliberately excludes source ids, workspace ids and Clerk ids (`:70-74`).
4. Synthetic rows — `synthetic:overload`, `synthetic:crowded-week`
   (`triggers.ts:176`, `:241`) — are **readings of** objects already counted, not objects.
   They carry the `SourceRef[]` they were read from, they never enter a `count` as items in
   their own right (`build.ts:196-198` already gets this right), and they are never
   de-duplicated against a real row.
5. `projectId: null` is **Unfiled** (Notes), **Unprojectable** (a Tasks row with a null
   `workspace_id`) or **Unlabelled** (no tags) — three distinct named states, never one
   (PROJECT_SCOPE §6, D-H05). A surface that cannot tell them apart may not render a count
   that includes them.

---

## 6. The executable invariant

Five clauses. Each maps to an assertion in
`src/lib/home-layer/today/content-ownership-contract.test.ts`.

> **I1 — Single primary owner.**
> For every (`SourceKind` × `PresentationRole`) pair, exactly one surface section is declared
> `primary`. Zero owners is a gap; two owners is a defect. Both fail the test.

> **I2 — No independently generated prose or ranking.**
> Exactly one module in the repository may assign an attention rank, and exactly one may
> author attention prose, and they are the same module. Any other module that sorts work
> objects by an urgency score, or that renders a sentence explaining why a work object
> matters, is a violation. `generateNudges` violates this today (`DUP-4`) and its retirement
> is what makes the assertion pass.

> **I3 — Every secondary appearance is declared.**
> A section that renders a `SourceKind` it does not own for that role must appear in the
> §7 register with (a) a stated reason, (b) exactly one `sourceRoute` — the route that owns
> the full view — and (c) `impliesCompleteness: false`. An undeclared secondary appearance
> is a violation even if it looks right.

> **I4 — One definition per shared word.**
> `overdue`, `done`, `idle`, `this week` and `recently` each resolve to exactly one predicate,
> exported from one module, taking the real per-Project column config. Four overdue
> definitions (`DUP-7`) and two idle thresholds (`DUP-4`) are the current violations.

> **I5 — An inventory declares its own coverage.**
> Any section owning `inventory` emits a `ProviderCoverage`-shaped coverage statement
> alongside its rows (`contracts.ts:234-245`). A list with no coverage statement is
> prohibited, because a silently narrow list is indistinguishable from a complete one and
> the user's rational response to it is to stop looking elsewhere.

**Why executable and not editorial.** Every clause above is checkable against a declared
registry plus a repo-wide grep, without reading a single rendered pixel. That matters because
the surfaces themselves will not exist until Wave 5–8, and a contract that can only be
checked by looking at the finished thing is a contract that gets checked once.

---

## 7. Secondary-appearance register

The exhaustive allowlist. Anything not in this table is a violation of `I3`.

| # | Section | Surface | Renders (kind × role) owned by | Reason it is allowed | `sourceRoute` | Implies completeness |
|---|---|---|---|---|---|---|
| S1 | Full briefing entries | `home.briefing` | `home.today` (`rank`, `reason`) | Depth from Today, not a fifth mode (Charter rule 4). Same engine, same build, same day — an uncapped rendering of a capped view | `/app/home` | no |
| S2 | Today "Coming up" | `home.today` | `home.my-work` (`inventory`) | The near horizon is part of "what deserves attention now"; the *complete* horizon is not | `/app/home/my-work` | **no** — capped, ranked, and it says how many it did not show |
| S3 | Today "Needs review" | `home.today` | `home.my-work` (`inventory`) | Same as S2 | `/app/home/my-work` | **no** |
| S4 | My work row reason lines | `home.my-work` | `home.today` (`reason`) | A responsibility list is more useful when it says why something is flagged — but it renders the engine's sentence verbatim and never writes its own | `/app/home` | n/a |
| S5 | Today read accounting short form | `home.today` | `home.briefing` (`count`) | The filter claim needs its denominator on the surface that makes the claim (`voice.ts:85-96`) | `/app/home/briefing` | yes, and it is exact: `read = flagged + cleared` |
| S6 | Inbox badge on Home chrome | every Home surface | `home.inbox` (`count`, `state`) | One badge definition (Charter rule 6). It is chrome, computed once by the Inbox, rendered anywhere | `/app/home/inbox` | yes — it is the Inbox's own number |
| S7 | Project name as scope chrome | every Home surface | `project.overview` | Read Scope labelling is mandatory and literal (PROJECT_SCOPE §5 rule 1) | `/app/project` | n/a |
| S8 | Analytics evidence rows | `home.analytics` | source products | Evidence must be inspectable or the number is an assertion | the product route | no — an evidence sample is explicitly a sample |

Two entries a reader might expect and will not find, deliberately:

- **No Inbox summary on Today.** Today does not render "3 mentions, 1 review request". That
  is `count` over events, owned wholly by `home.inbox` (§2). Today links to the badge.
- **No Today rows on the Inbox.** After `DUP-3`/`DUP-4`, the Inbox renders no attention
  prose at all. It renders events.

---

## 8. Migration sequence

Ordering matters because three of these depend on foundations that are not in this worktree.

| Step | Action | Gate |
|---|---|---|
| 1 | Declare the registry (`SourceRef`, roles, ownership matrix, §7 allowlist) as data, and land the failing tests | none — this wave |
| 2 | Retire `SignalAppShell` + `overview-view` + `trends-view` + descendants | before Wave 3, so no lab direction builds on a dead shell |
| 3 | Widen the engine's source adapter to `SourceRef` and resolve `sourceLabel` from the record | `TODAY_RANKING.md` §3; needs `src/lib/projects/**` for `projectId` |
| 4 | Fold `blocker-cleared` and `doing-empty` into the engine; delete `generateNudges`; remove both nudge renders | after step 3 |
| 5 | Re-found "Coming up" and "Needs review" on the engine; delete the filters at `home-data.ts:137-171` | after step 3 |
| 6 | Move the daily digest's task summary to `home.my-work`; remove the Inbox greeting and overdue count | Wave 6 + Wave 7 together — splitting them leaves a gap where neither surface shows it |
| 7 | One `overdue` predicate; one `isTaskDone`-based done test on every cross-Project read | PROJECT_SCOPE §11 (`isTaskDone` with real config is a required interface of `src/lib/projects/**`) |
| 8 | Inbox store, unread model, badge definition | Wave 6; new schema under expand → migrate → contract (`R-H12`) |

Step 6 is the one that can go wrong quietly. Removing the Inbox's task summary before My
work owns it cross-Project produces a user who has lost a surface and gained nothing, and
the loss is invisible in tests because both surfaces "pass".

---

## 9. Executable assertions

Written as failing tests this wave at
`src/lib/home-layer/today/content-ownership-contract.test.ts`. Unlike `PROJECT_SCOPE.md` §12
— which deliberately deferred its tests because every natural home for them sat in a foreign
lane's working set (D-H13) — these have a home this programme owns outright:
`src/lib/home-layer/**` is untracked and created by this programme.

**Verified at this base.** 11 assertions here plus 21 in `TODAY_RANKING.md` §10 — `32 tests
· 0 pass · 32 fail`, each failing with its own named reason, and `tsc --noEmit` reporting
zero errors in `src/lib/home-layer/today/`. The tests import their missing modules through a
variable specifier rather than a literal so the typecheck stays green for the other lanes on
this branch; recorded as `TODAY_RANKING.md` `TR-6`.

```
node --import tsx --test src/lib/home-layer/today/content-ownership-contract.test.ts
```

| # | Assertion | Must fail today because |
|---|---|---|
| O1 | A declared ownership registry exists and covers every `SourceKind` × role | `src/lib/home-layer/today/surface-ownership.ts` does not exist |
| O2 | Exactly one section is `primary` for each (kind × role) — I1 | no registry |
| O3 | Exactly one module assigns attention rank and authors attention prose — I2 | two do: `build.ts` and `generate-nudges.ts` |
| O4 | Every §7 entry declares reason + exactly one `sourceRoute` + `impliesCompleteness: false` where required — I3 | no registry |
| O5 | Exactly one exported `overdue` predicate — I4 | four exist (`DUP-7`) |
| O6 | One idle-days threshold across the estate — I4 | two: ≥ 3 (`triggers.ts:60`) and ≥ 4 / ≥ 7 (`generate-nudges.ts:151`, `:141`) |
| O7 | `generateNudges` has zero importers | two: `src/app/app/inbox/page.tsx:9` and `src/components/app/my-week/my-week-app.tsx:8` |
| O8 | Every `inventory` owner emits coverage — I5 | `bucketMyWeek` returns bare arrays (`selectors.ts:121-181`) |
| O9 | `sourceKey` is the only de-duplication key reaching a Home surface | `home-data.ts:135` de-duplicates on bare task id |
| O10 | No Home surface renders a count of events other than `home.inbox` | the Inbox greeting renders `overdueCount` and `digest.dueToday.length` (`inbox-app.tsx:104-110`) |
| O11 | Every state value a Home section filters on is reachable from the production source mapper | `home-data.ts:161` tests `lane === "review"`, which `signal-build-for-user.ts:313-318` can never emit (`DUP-2`) |

---

## 10. Decisions taken here

Recorded with local ids so they cannot collide with a concurrent lane's `D-Hxx` allocation.
The lead may promote them into `DECISIONS.md` under whatever ids are free.

**CO-1 · Duplication is defined as a duplicate *claim*, not a duplicate *appearance*.**
The invariant is (kind × role), not (kind × surface). *Rationale:* the rule "a task appears
on one screen" is both unenforceable and wrong — an overdue task assigned to me belongs in
both "what needs me now" and "what I am responsible for", and a contract that forbids it
will be quietly broken in week one and then ignored. The damaging thing is two surfaces
computing the same answer from different code and disagreeing, which is exactly what
(kind × role) catches. *Consequence:* §2 is the contract; §7 is its allowlist; `DUP-4` becomes
visible as the worst case rather than the least.

**CO-2 · `generateNudges` is retired as an engine; two of its rules are promoted.**
*Rationale:* it is a second, complete attention engine with different thresholds, a different
severity scale and a non-total ordering, running over the same rows as the briefing engine
on two routes. Charter rule 9 permits one. Deleting it wholesale would lose `blocker-cleared`
and `doing-empty`, which the briefing engine genuinely lacks. *Consequence:* two new triggers
in `TODAY_RANKING.md` §4; the copy banks move to `prose.ts`; step 4 of §8.

**CO-3 · `home.analytics` owns `count` for work objects.**
*Rationale:* a total is a claim about how complete the evidence is, and Analytics is the only
surface in the estate with a coverage model able to qualify it. Assigning counts to whichever
surface displays them is how four overdue definitions happened. *Consequence:* Today shows the
engine's read accounting (a receipt about its own run, not a portfolio total); the Inbox shows
no task counts; `DUP-7` resolves to one predicate.

**CO-4 · An `inventory` owner must state its own coverage (I5).**
*Rationale:* My work today is "tasks assigned to me on the board I currently have selected"
under a label that promises everything. A silently narrow list is worse than an empty one,
because a user's rational response is to stop checking elsewhere. *Consequence:* `bucketMyWeek`
returning bare arrays is a violation; Wave 7 cannot ship without a coverage receipt.

**CO-5 · "Coming up" and "Needs review" survive as sections and stop being filters.**
*Rationale:* audit A classified both `decompose` and the brief requires their eligibility and
caps to be specified — those are consistent only if the *sections* stay and the *independent
computation* goes. Deleting the sections would remove a near horizon users need; keeping the
filters would leave two rankers. *Consequence:* `TODAY_RANKING.md` §5 defines both from the
engine's own candidate set; `home-data.ts:137-171` is deleted.

---

## 11. Open, and owned elsewhere

Recorded so no lane treats silence as settlement. Items 1, 2 and the counting rules landed
in sibling Wave 1 contracts while this one was being written; they are listed here as
**dependencies to be cross-checked by the lead**, not as gaps.

1. **The Inbox event vocabulary and state machine** — `contracts/INBOX_EVENT.md`. This
   contract asserts only that `home.inbox` owns every role for `notification` and `activity`;
   which kinds ship, and their state machine, are that contract's call. It seals a V1 that
   carries **mentions only**, which is compatible with §3.3 and sharpens it: the classes this
   document moves off the Inbox are moving off a surface that was already keeping one of six.
   No store, no unread model and no approval primitive exist (`R-H12`). Owner: Wave 6.
2. **My work's source coverage boundary** — `contracts/MY_WORK_PROJECTION.md`. Notes and
   Timeline join only on a structured accountable object with stable owner identity, an
   authorization adapter, a source revision and a mutation receipt (`RECONCILIATION.md`
   row 6). `I5` binds whatever boundary it lands on. Owner: Wave 7.
3. **Claim populations, denominators and comparisons** — `contracts/ANALYTICS_CLAIM.md`.
   `CO-3` assigns the `count` role to `home.analytics`; that contract defines what a count is
   allowed to claim once it gets there. The two must be read together: this one says who may
   count, that one says what counting means.
4. **Where the weekly LLM recap lives.** Flagged, not moved (§3.3 row 4). Owner: Wave 6 /
   Wave 9, bound by Charter rule 12 wherever it lands.
5. **Tasks assigned to non-members.** `assignees` is an unvalidated JSON array
   (PROJECT_SCOPE §3.1 consequence 3), so an "assigned to me" list can contain rows assigned
   to ids that were never members. Which way My work errs, and how it discloses it, is a
   product answer. Owner: Wave 7.
6. **Three notification-settings surfaces.** Flagged in §4. Owner: account administration,
   outside this programme.
7. **`/app/project`'s disposition** — keep, Manage Projects, or Project Lens
   (`RECONCILIATION.md` row 10). This contract treats it as scope, not a mode (Charter rule
   5), which is compatible with all three. Owner: lead.
8. **The mentions cross-tenant read** (`R-H15`, `REPOSITORY_TRUTH.md:136-150`). Raised as
   separate work; §3.3 row 5b records it so the Inbox migration does not inherit it silently.
