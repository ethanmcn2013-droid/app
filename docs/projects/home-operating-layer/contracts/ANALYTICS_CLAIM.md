# Contract · Analytics claim

**Status:** Sealed (Wave 1). Binding on every Analytics surface, contract test and lab direction.
**Base:** `origin/main` @ `78021c5` · branch `feat/home-operating-layer` · worktree `_wt-home-layer`
**Adopts:** `contracts/PROJECT_SCOPE.md` (sealed) · `docs/adr/0001-canonical-project-identity.md` (merged, unamended)
**Adopts as release blockers:** `docs/wave/ANALYTICS_TRUTH.md` R1–R10, all ten re-verified STILL TRUE at this base (`RECONCILIATION.md:142-155`)
**Builds on:** `src/modules/signal/{lib,server}/analytics/**` — a complete, tested, unmounted engine
**Decisions:** D-HA01 … D-HA12 (§13). Ids are namespaced `D-HA` so they collide with neither `D-H01…D-H13` nor `D-001…D-017` nor the VEF `D-0xx`.
**Failing tests:** `src/lib/home-layer/analytics/*.test.{ts,mjs}`

Changing anything sealed here requires a new founder-approved ADR or a lead-owned amendment.
An implementation agent may not reopen it.

---

## 0. What this contract is, and what it is not

It is the definition of a **claim**: the smallest thing Analytics is allowed to say to a
person, and everything that must be true and present before it may say it. A number on a
screen with no claim envelope behind it is a contract violation, not a rendering shortcut.

It is **not** a metric catalogue for its own sake, not a dashboard spec, and not an
implementation. `/app/home/analytics` does not exist at this base — no directory, no route
file, no rewrite, no redirect, and `next.config.ts` `redirects()` contains no analytics or
trends entry (`audit/A-repo-product-truth.md:101`, `:455-456`).

**It does not redefine Project identity.** A Project is a Tasks `workspaces.id`
(`PROJECT_SCOPE.md` §1). Analytics consumes that; it does not restate it, extend it, or
carry a parallel one. Everywhere below, "Project" means exactly that and nothing else.

### 0.1 The one piece of good news, stated precisely

A complete cross-product analytics engine already exists and is mounted nowhere. Tasks,
Notes and Timeline providers; a coverage model carrying status, capabilities, history
window, staleness and issues; a ledger boundary with URL allowlisting and opaque ids; a
five-stage authorization chain. All present. All tested. `runAnalyticsRoute` has **zero
importers** (`src/modules/signal/server/analytics/route.ts:9`;
`audit/A-repo-product-truth.md:469`) and `isSignalAnalyticsEnabled()` returns `false` in
every environment unless explicitly opted in
(`src/modules/signal/server/analytics/feature-flag.ts:11-16`).

So Wave 8 is a **presentation and truth-closure problem, not a research problem**
(`REPOSITORY_TRUTH.md:33-44`). This contract's job is to say exactly which of that engine is
kept, which is replaced, which is retired, and what must be added before a single number
reaches a person.

What the engine's existence does **not** mean: it has never been verified against real data.
Zero tests import any provider, the service, the policy or the snapshot layer; all 47
analytics test cases run over fixtures or source text (`docs/wave/ANALYTICS_TRUTH.md:20-23`).
"It works, it's just behind a flag" is false.

---

## 1. The claim

> **A claim is one statement about authorized work, at a named time, over a named
> population, from named sources, at a named truth class, with a named limitation, and a
> route to the record that would change it.**

Nothing renders without all seven. A claim that cannot fill a required field is not
downgraded to a smaller number — it does not render, and its absence is named.

```ts
type ClaimId = Brand<string, "AnalyticsClaimId">;

interface AnalyticsClaim<TValue> {
  id: ClaimId;
  metric: MetricKey;
  definition: ClaimDefinition;      // §2   what it counts, in one sentence, and its version
  truthClass: TruthClass;           // §3   reported | observed | inferred
  scope: ClaimScope;                // §4   the authorized Project Read Scope
  window: ClaimWindow;              // §5   time window, timezone, and where the timezone came from
  population: ClaimPopulation;      // §6   numerator, denominator, comparison population, in/out counts
  baseline: ClaimBaseline;          // §7   an accepted baseline id, or explicit absence
  coverage: ClaimCoverage;          // §8   per-source status, capability and issue codes
  times: ClaimTimes;                // §9   event · ingestion · snapshot · rendered-view
  history: ClaimHistory;            // §10  sufficient, or "Not enough history" with the exact gap
  permission: ClaimPermission;      // §11  complete, or limited with the exact counts
  provenance: ClaimProvenance;      // §12  source revision, metric/rule version, evidence route
  limitation: ClaimLimitation;      // §12  the known limitation, in plain English, always present
  correction: ClaimCorrection;      // §12  where a person goes to change the underlying record
  value: TValue | null;             //      null whenever status is not "available"
  status: "available" | "partial" | "insufficient_history" | "unsupported";
}
```

**Sealed rule.** `value: null` never renders as `0`, `—`, an empty chart, a grey dash that
reads as zero, or a cleared state. It renders the reason. This is charter rule 11 made
mechanical.

---

## 2. Definition and version

Every claim carries a one-sentence definition written for a person who has never used a
project-management tool (`AGENTS.md` north star 3, the first-contact test), and a version.

`SIGNAL_METRIC_VERSION` exists today as `"signal-analytics-metrics@1.0.0"`
(`src/modules/signal/lib/analytics/metrics.ts:34`) and is already stamped on every
`MetricResult` (`:195`) and every persisted snapshot row
(`src/modules/signal/server/analytics/snapshots.ts:448`). Keep it. Bind it:

| Change | Bump |
|---|---|
| numerator, denominator, inclusion rule, exclusion rule, done predicate, threshold, scope key | **major** |
| a new optional field on the claim envelope | minor |
| summary wording, label, rounding presentation | patch |

**A major bump starts a new series.** Snapshots at a different major version are never joined
to the current one (§10.3). This is not a convention — it is enforced in the history read
predicate, which does not filter on version today (N1, §14).

---

## 3. Truth classes — three, kept visibly different

| Class | Means | Rendering obligation |
|---|---|---|
| **Reported** | A value a person entered or set, read back unchanged. A due date, an assignee, the column a task sits in. | Named as recorded. Never described as measured. |
| **Observed** | A value derived from a timestamped event the system recorded as it happened. A terminal transition, a milestone date change. | Names the event kind and the time range of the events behind it. |
| **Inferred** | A value produced by a rule whose premise is a judgement. "Stalled." "At risk." "Blocked, inferred from an unresolved dependency." | Names the rule and its threshold **inline, in the claim**, not in a tooltip and not in a drawer. |

**Sealed rules.**

1. The three classes never share one visual treatment. A reader must be able to tell, without
   interaction, whether they are looking at something a person typed, something the system
   watched happen, or something a rule concluded.
2. **No claim aggregates across classes.** A single number may not sum reported and inferred
   contributions. `blocked_work` today does exactly this — it merges `blocking.explicit`
   (Reported) and `unresolvedDependencyIds.length > 0` (Inferred) into one `count`
   (`metrics.ts:444-456`). The underlying value object already keeps `explicitCount`,
   `inferredCount` and `bothCount` separate (`contracts.ts:371-375`); the **claim** must
   render them separately or not at all.
3. An Inferred claim states the rule's threshold as a number the reader can check. "No
   meaningful progress for 7 days" is admissible; "stale" is not. The default is
   `stalledAfterDays: 7` (`metrics.ts:41-44`).
4. Inferred is never upgraded by confidence. `SignalObservation.confidence`
   (`contracts.ts:468`) may order exceptions; it may not promote an inference to an
   observation.

---

## 4. Authorized Project Read Scope

Analytics reads through `HomeReadScope` (`PROJECT_SCOPE.md` §5), never through its own scope
concept.

```ts
type ClaimScope = {
  readScope: HomeReadScope;                 // current-project | planning-period | all-projects
  projects: ProjectId[];                    // the exact authorized set, resolved live
  labels: LabelId[] | null;                 // breakdown facet only, never identity (§4.2)
  actor: "self";                            // user-scoped claims only; see §4.3
};
```

### 4.1 What replaces the existing scope model

`contracts.ts:11-18` models `project` as a scope **nested inside** `workspace`. Under
`Project = workspaces.id` that nesting is impossible, not merely mislabelled
(`docs/wave/ANALYTICS_TRUTH.md:47-51`). **Replace it.** `AnalyticsScope` becomes:

```ts
interface AnalyticsScope {
  kind: "projects" | "user";
  projects: ProjectId[];   // one for current-project; N for planning-period / all-projects
  actorId?: TasksUserId;   // present only when kind === "user"
}
```

There is no `workspaceId` field, because the Project **is** the workspace id. There is no
`project` scope nested under a `workspace` scope, because there is nothing above a Project
(`PROJECT_SCOPE.md` §3.2 — no organisation or account tier exists).

### 4.2 Labels are a facet, never a scope

`projectIdFromTag()` slugifies a task tag and falls back to the literal `"untagged"`
(`src/modules/signal/server/analytics/providers/tasks.ts:365-374`), is applied at
`providers/tasks.ts:68,120,145,184` and `providers/notes.ts:64,151`, and **gates
project-scope authorization** at `policy.ts:220`.

Sealed at `PROJECT_SCOPE.md` §2.3: this identity is renamed **Label** and survives only as a
breakdown facet inside an already-authorized Project. Consequences specific to Analytics:

- `policy.ts:206-222` (`workspaceHasProject`) is **retired as an authorization step**. A tag
  existing in a workspace is not an access grant.
- `analytics_metric_snapshots.project_id` currently stores a Label slug
  (`snapshots.ts:334`, `:441`). It is renamed `label_id` and a new `project_id` carrying a
  canonical `ProjectId` is added, under expand → migrate → contract. **The column is never
  reused in place** — the old rows mean something different.
- Two tags that slugify identically merge silently; renaming a tag destroys its history. A
  Label breakdown therefore carries a standing limitation (§12) and **may never be the axis
  of a trend**.
- The string `untagged` never reaches a rendered surface. Untagged work is **Unlabelled**
  (`PROJECT_SCOPE.md` §6, D-H05).

### 4.3 The user scope

`AnalyticsScope.kind === "user"` is limited to the signed-in account and is already enforced
(`policy.ts:91-102`). Keep, with two additions:

- A user-scoped claim is labelled **yours**, never presented as a Project fact.
- The owner-identity collision (R9) makes user scope silently lossy today: `hasOwner`
  compares a Tasks user id against Timeline `assignee` (`scope.ts:19-21` vs
  `providers/timeline.ts:226`), so under a user scope every milestone and Timeline dependency
  is dropped. Dropping is prohibited. See §14 R9.

---

## 5. Time window and timezone

```ts
type ClaimWindow = {
  kind: "as_of" | "over";
  asOf?: ISOInstant;                      // point-in-time claims
  start?: ISOInstant; end?: ISOInstant;   // windowed claims; end exclusive
  preset: PeriodPreset;
  timezone: string;                       // IANA
  timezoneSource: "user_setting" | "utc_fallback";
};
```

**Sealed rules.**

1. Every claim declares which kind it is. A stock ("how many are open") is `as_of`. A flow
   ("how many were completed") is `over`. Rendering a stock as if it were a flow, or a flow
   without its window, is a truth defect.
2. The timezone is the analytics user setting, resolved server-side and validated
   (`policy.ts:83-85`, `snapshots.ts:398-424`). It is **never** the browser timezone, because
   the same claim must read identically on a phone in Limerick and a laptop in New York.
3. `timezoneSource` is part of the claim. When it is `utc_fallback` — the documented default
   when the user has no saved timezone (`snapshots.ts:411-413`) — the claim says so, because
   a date-only due date expires at the end of a **local** calendar day (`contracts.ts:72-74`,
   `dueExpiry`) and UTC is the wrong day for most of the world for part of every day.
4. `end` is exclusive (`contracts.ts:20`). Keep. Never present an inclusive end date in copy
   without subtracting a day.

---

## 6. Population — numerator, denominator, comparison, and the counts on both sides

```ts
type ClaimPopulation = {
  numerator:   { label: string; count: number };
  denominator: { label: string; count: number } | { kind: "none"; why: string };
  comparison:  { label: string; count: number } | { kind: "none"; why: string };
  included: number;
  excluded: Array<{ reason: ExclusionReason; count: number }>;
};

type ExclusionReason =
  | "archived_project"            // PROJECT_SCOPE §8.3, D-H08 — excluded by default, toggle labelled
  | "unprojectable_row"           // tasks.workspace_id IS NULL — PROJECT_SCOPE §6
  | "subtask"                     // parent_task_id is not null
  | "unauthorized_project"        // membership held, read refused
  | "unresolved_project"          // membership held, source could not answer
  | "outside_window"
  | "missing_required_timestamp"  // e.g. terminal task with no completion moment
  | "source_record_limit_reached" // the read was truncated — R10
  | "owner_unmatched";            // R9: identity spaces did not join
```

**Sealed rules.**

1. **A denominator that does not exist is stated, not invented.** Most V1 claims are counts
   with no denominator. `denominator: { kind: "none"; why: "This is a count of items, not a
   share of anything." }` renders as no percentage anywhere on the claim. Percentages are
   prohibited without a real denominator.
2. **Exclusions are counted and shown, never silent.** `excluded` is empty only when it is
   genuinely empty. A count that excludes Unprojectable rows says so
   (`PROJECT_SCOPE.md` §6, D-H05).
3. **A truncated read is an exclusion, not a footnote.** `providers/tasks.ts:58-62` reads
   `LIMIT 2001` with no `ORDER BY` (`MAX_TASKS = 2_000`, `:27`, `:62`). Truncation is flagged
   as a coverage issue string today (`tasks_record_limit_reached`, `:184`). That is not
   enough: the claim must carry `{ reason: "source_record_limit_reached", count: n }` and
   render "counted 2,000 of more than 2,000", never a bare number.
4. **The comparison population is named or absent.** `completion_pace_change` compares
   against "the median of three equal-length periods" (`metrics.ts:571`). That is a
   self-comparison, not a baseline (§7). It is stated as the comparison population, with the
   three counts, or the claim does not compare.
5. **Cross-Project completion comparison is prohibited** while "Done" is per-Project and
   member-editable (`setColumnDoneAction` has no role check,
   `src/server/actions/board.ts:282-301`; `PROJECT_SCOPE.md` §3.1 consequence 2, D-H11). An
   all-projects completion claim renders one total with the disclosure that Done is defined
   per Project; it never ranks Projects by completion.

---

## 7. Baseline

```ts
type ClaimBaseline =
  | { kind: "none" }
  | { kind: "accepted"; id: string; acceptedAt: ISOInstant; acceptedBy: "founder";
      window: ClaimWindow; value: number; note: string };
```

**There is no accepted baseline anywhere in this repository, for any metric.** No baseline
table, column, constant or approval path exists in the analytics domain (verified by reading
`contracts.ts`, `metrics.ts`, `snapshots.ts`, `signal-analytics-schema.ts` at this base). The
separate `approvedBaselineReference` on the 78 experience-registry entries is a **visual**
baseline, is `null` on all 78, and is founder-owned (`REPOSITORY_TRUTH.md:57-64`, R-H09). It
is not this.

**Sealed rules.**

1. Every V1 claim ships `{ kind: "none" }` and renders the literal words **"No accepted
   baseline"**. Not "—", not "n/a", not omission.
2. A baseline becomes `accepted` only by an explicit founder action recorded with its id, the
   window it was measured over, its value and a note. It is never derived, never
   auto-proposed, and never inferred from history.
3. A self-comparison is **not** a baseline and never borrows baseline language. "Faster than
   the median of the last three periods" is a comparison. "Above target" requires an accepted
   baseline and is otherwise prohibited copy.
4. Target, goal, quota, expected, should-be and on-track-to are baseline language. None of
   them appears on a claim with `{ kind: "none" }`.

---

## 8. Source coverage

The existing `ProviderCoverage` model is **kept, unchanged in shape** — provider, status,
capabilities, history window, `calculatedAt`, `staleAfter`, `sourceRecordCount`, issues
(`contracts.ts:234-245`; constructor `providers/coverage.ts:9-31`). `PROJECT_SCOPE.md` §5
rule 7 already commits Home to extending this vocabulary rather than inventing a second one.

`combineCoverage` (`providers/coverage.ts:33-45`) is kept: `tasks` unavailable ⇒ whole
coverage `unavailable`; any `stale` ⇒ `stale`; anything not `ready` ⇒ `partial`. Never
`complete` on a partial read. This is correct and it is one of the reasons the direction is
viable.

**What is added.**

| Addition | Why |
|---|---|
| `notes_viewer_scoped` issue code | R8. The Notes query binds `WHERE user_id = ?` (`providers/notes.ts:86`); two members of the same Project get different follow-up counts from the same query, and none of the three declared issue codes (`:178-189`) names this. |
| `owner_identity_unmatched` issue code | R9. Records dropped because two id spaces did not join must surface, not vanish. |
| `label_slug_collision_possible` issue code | §4.2. Two tags slugifying identically merge silently. |
| Coverage must be **per Project**, not global | `PROJECT_SCOPE.md` §5 rule 7. One unavailable Project does not make the aggregate unavailable, and does not make it complete either. |

**Sealed rule.** A capability a provider does not declare in production is never simulated by
a fixture. Fixtures declare `decision_read` and `milestone_date_history`
(`src/modules/signal/lib/analytics/fixtures.ts:58-59`); production declares neither
(`providers/notes.ts:173`; `providers/timeline.ts:241,251`). Every green analytics test
therefore runs over capabilities production does not have (R4). The fixture capability set
must be a **subset** of the production-declarable set, asserted by test.

---

## 9. The four times

```ts
type ClaimTimes = {
  eventTime: { earliest: ISOInstant; latest: ISOInstant } | null; // null for Reported claims
  ingestionAt: ISOInstant;        // when the provider read the source
  snapshotAt: ISOInstant | null;  // null for as-of-now claims; set for ledger-derived points
  renderedAt: ISOInstant;         // when this response was composed
};
```

All four are present on every claim. `null` is meaningful and distinct from absent.

**Finding (new, N3).** These are one field today. `MetricResult.calculatedAt` is set to
`snapshot.capturedAt` (`metrics.ts:193`), which the service sets from the request instant —
so ingestion time and rendered-view time are the same value and neither can be trusted to
mean what it says. Split them.

**Sealed rules.**

1. Freshness copy is computed from `ingestionAt`, never `renderedAt`. A page rendered now
   over a source read forty minutes ago is forty minutes old, and says so.
2. A ledger-derived point renders its `snapshotAt`, not the render time. A chart whose points
   claim to be from today when they were captured on eleven previous days is a lie about
   every point but one.
3. `staleAfter` (`contracts.ts:241`) is honoured. Past it, the claim's status is at best
   `partial` and the surface says "last read at {time}".

---

## 10. History, trends, and the minimum-history result

### 10.1 The hard rule

> **"Not enough history" AND NO CHART.** When comparable snapshots do not exist, the surface
> renders the words, the exact number of comparable snapshots it has, the number it needs,
> and the earliest date the requirement can be met. It renders **no chart** — not an empty
> chart, not a flat line, not a single point, not a greyed axis.

### 10.2 The trend source is the snapshot ledger. Only.

**Decision D-HA05.** `buildTrendPoints` (`src/modules/signal/lib/analytics/trend-series.ts:24-86`)
re-derives chart buckets from events **inside the current response**, so a rendered trend
needs no persisted history at all. It is careful — it refuses to zero-fill outside the
provider's queried window (`:44-46`, `:62`) — but two facts defeat that care:

1. The queried window is the interval *requested*, narrowed only when a read truncated
   (`providers/history-window.ts:11-23`). It is not evidence that events existed.
2. The underlying reads are capped (`MAX_TASKS = 2_000`, `providers/tasks.ts:27`; activity
   caps at `:184-186`). A cap that bites hardest on the oldest rows produces a chart that
   slopes downward because of the limit, not because of the work.

So event-derived buckets are **retired as a trend source**. A trend renders from
`analytics_metric_snapshots` or it does not render. `buildTrendPoints` survives only as a
within-window distribution for the evidence drawer, and is never labelled a trend.

### 10.3 Comparability

Two snapshot rows are comparable **iff all of**:

- same Project scope key (canonical `ProjectId`, or the workspace-level row);
- same `metric_key`;
- same **major** `metric_version`;
- both captured by a `completed` run whose recorded coverage status is `complete`;
- both at the same cadence (daily), with no gap longer than one missing day between them.

A trend renders over the **maximal comparable run** ending at the most recent snapshot. Any
incomparable neighbour ends the run: the chart stops there and says why. **It never bridges a
gap, never interpolates, and never joins two versions.**

The left edge of a chart is either the start of the comparable run or the retention boundary
(400 days, `snapshot-utils.ts:4`), and the chart says which.

### 10.4 The minimum

**Decision D-HA06.** The minimum is **14 comparable daily snapshots**, and the window must be
covered with no gap longer than one day.

Two points is today's bar (`snapshots.ts:197`; `trend-series.ts:96`). Two points is a line
between two dots and invites exactly the over-reading this contract exists to prevent.
Fourteen is the smallest run over which a daily level series survives a normal week's shape
without a weekend reading as a decline.

Below the minimum the claim is `insufficient_history` and renders:

> **Not enough history yet.** 6 of 14 comparable daily readings. The earliest this can show a
> trend is 14 August 2026.

### 10.5 Exactly one trend

**Decision D-HA07.** V1 renders **one** trend: **`open_work`**, a level series.

Rationale. `open_work` is a stock — the number of items open at an instant — so one daily
snapshot is one honest reading, and consecutive readings are exactly comparable. Every other
snapshot-captured metric is either a flow over a trailing 28-day window (`work_completed`,
because the writer fixes `preset: "four_weeks"`, `snapshots.ts:291-295`), which makes each
daily point a rolling sum sharing 27 of its 28 days with its neighbour, or is blocked by a
release blocker in §14.

A second trend ships only when a founder decision says the first one is not enough. The
existing single-`primaryTrend` shape (`service.ts:384-391`) already matches this and is kept.

---

## 11. Permission limitation

```ts
type ClaimPermission =
  | { kind: "complete"; projects: number }
  | { kind: "limited"; readProjects: number; membershipProjects: number;
      unauthorized: number; unresolved: number };
```

**Sealed rules.**

1. Partial authorization is disclosed, never silently trimmed (`PROJECT_SCOPE.md` §5 rule 4).
   "Read 4 of 6 projects. 2 could not be read." A claim over N of M Projects never renders as
   if it were over M.
2. `unauthorized` and `unresolved` are **different**. Membership held but read refused is not
   the same as membership held and the source could not answer. Both are non-zero-able: a
   Project that could not be read contributes nothing to the numerator and is not counted as
   a zero.
3. Reason codes distinguishing "does not exist" from "you may not see it" stay server-side
   (`PROJECT_SCOPE.md` §8.1). The claim carries counts, not identities of things the reader
   may not see.
4. Membership is revalidated per request; Analytics adds no membership cache
   (`PROJECT_SCOPE.md` §3 rule 4). The existing chain — flag → identity → beta allowlist →
   live membership revalidation → self-scope → defence-in-depth re-filter
   (`policy.ts:44-108`; `scope.ts:63-142`) — is kept in full. It is well built and it is not
   this contract's to weaken.

---

## 12. Provenance, limitation, and the correction path

```ts
type ClaimProvenance = {
  metricVersion: string;              // signal-analytics-metrics@major.minor.patch
  ruleVersion: string | null;         // signal-analytics-rules@… ; null unless Inferred
  sourceRevision: string;             // watermark over the contributing rows (§12.1)
  evidenceHref: string;               // the exact authorized receipt for this claim
};

type ClaimLimitation = { text: string };   // always present, never empty, plain English

type ClaimCorrection = {
  surface: "tasks" | "notes" | "timeline" | "settings";
  href: string;                        // carries workspaceId — PROJECT_SCOPE §10.2
  instruction: string;                 // imperative, no jargon
};
```

### 12.1 Source revision and reproducibility

> **Every claim is reproducible from exact authorized receipts.**

A **receipt** is the complete, authorized input to one claim:

```ts
type ClaimReceipt = {
  claimId: ClaimId;
  metric: MetricKey;
  metricVersion: string; ruleVersion: string | null;
  scope: ClaimScope; window: ClaimWindow;
  ingestionAt: ISOInstant;
  sourceRevision: string;   // stable digest of (contributing record id, updatedAt) pairs
  included: Array<{ type: SourceType; id: string }>;
  excluded: Array<{ type: SourceType; id: string; reason: ExclusionReason }>;
};
```

**Sealed rule.** Replaying the metric calculation over the records named by a receipt must
produce a byte-identical claim value. A claim whose receipt cannot be replayed does not
render. This is what makes "the number is right" checkable rather than asserted, and it is
the only defence against the failure mode that a number quietly drifts while the copy around
it stays confident.

`sourceRevision` is a digest, not a timestamp, because `updatedAt` alone cannot detect a
deletion.

### 12.2 The evidence route

The presentation boundary is genuinely certified: `ledger-contract.test.ts` +
`ledger-adapters.test.ts` (34 cases) prove DTO safety, URL allowlisting, opaque ids, and that
partial or unavailable coverage never becomes a healthy empty day
(`docs/wave/ANALYTICS_TRUTH.md:145-148`). That evidence carries over and the allowlist
(`ledger-contract.ts:137-148`) is kept.

**But the evidence drawer does not apply it.** `service.ts:549` returns
`actions: observation.actions` unfiltered, reaching `evidence-drawer.tsx` →
`action-link.tsx`, which has no allowlist (R6). Every evidence action passes the ledger
allowlist or it is not rendered. Same list, one implementation.

### 12.3 Known limitation

`ClaimLimitation.text` is required and non-empty on every claim, including healthy ones.
There is no such thing as a claim with no limitation; there are only claims whose limitation
has not been written down. Examples that must appear verbatim where they apply:

- "Done means the column named Done in this Project. Another Project may define it
  differently." (R3)
- "Only your own follow-ups are counted." (R8)
- "Counted 2,000 of more than 2,000 items." (R10)
- "Labels come from task tags. Two tags that look different can merge, and renaming a tag
  loses its history." (§4.2)

### 12.4 Correction path

Every claim routes to the record that would change it. `instruction` is written for someone
who has never used a project-management tool: "Open the task and set a due date", not
"Populate `due_at`". The href carries `workspaceId` (`PROJECT_SCOPE.md` §10.2) — and note
that the destination does not consume it today (`src/app/app/tasks/page.tsx:18-21`;
`/app/task/[id]` accepts no Project parameter at all), which is a Home link-contract
precondition, not something Analytics fixes.

### 12.5 Suggestions are labelled suggestions

**Sealed rule.** Analytics may say what it observed and may offer a deterministic next step.
It may never say what someone **should** do, what is **on track**, what is **healthy**, or
what will **happen**.

- Admissible: "3 items are overdue. Review overdue work."
- Prohibited: "You should focus on the Kitchen project." "This project is on track." "At this
  pace you will finish by 3 September."

Every suggestion is deterministic, derived from an already-authorized fact, and rendered with
a visible label distinguishing it from the fact. AI may phrase an already-authorized
deterministic fact; it may not invent priority, ownership, risk, health, performance, next
actions or completeness (charter rule 12). No suggestion carries a confidence score to a
reader — confidence orders exceptions internally (`contracts.ts:468`) and stops there.

---

## 13. Metric families

### 13.1 Allowed in V1

Seven claims, four families. Each is listed with its truth class and its blocking condition.

| # | Claim | Family | Class | Window | Definition (as rendered) |
|---|---|---|---|---|---|
| A1 | `open_work` | Delivery state | Reported | `as_of` | Items that are not in a Done column right now. |
| A2 | `open_overdue_work` | Delivery state | Reported | `as_of` | Open items whose due date has passed. |
| A3 | `unowned_work` | Delivery state | Reported | `as_of` | Open items with nobody assigned. |
| B1 | `work_completed` | Completion record | Observed | `over` | Items that moved into a Done column during this window. |
| C1 | `open_work_age` | Waiting | Observed | `as_of` | How long the typical open item has been waiting, measured from when it was created. |
| C2 | `stalled_work` | Waiting | **Inferred** | `as_of` | Open items with no meaningful activity for 7 days. |
| D1 | `cross_product_milestone_risk` | Milestone exposure | **Inferred** | `as_of` + 30d | Milestones due in the next 30 days that have overdue or blocked work connected to them. |

Per-claim fields not already fixed by §§4–12:

| Claim | Numerator | Denominator | Comparison | Baseline | Min-history result | Known limitation | Correction |
|---|---|---|---|---|---|---|---|
| A1 | open items | none — "a count of items, not a share" | none in V1 | none | n/a (`as_of`) | Done is per-Project (R3) | Move the item to Done in Tasks |
| A2 | open items past due | **A1** (may render "3 of 24 open items") | none in V1 | none | n/a | Date-only due dates expire at end of local day; `utc_fallback` shifts that | Open the task and change the due date |
| A3 | open items with `ownerIds.length === 0` | **A1** | none in V1 | none | n/a | Assignees are not validated against membership (`PROJECT_SCOPE.md` §3.1 consequence 3) | Open the task and assign someone |
| B1 | items with a completion moment inside the window | none | none in V1 | none | n/a (window is explicit, not history) | Completion is read from a terminal transition, or from `completedAt` when transition history is unavailable — and the claim says which (`metrics.ts:286-289`) | — |
| C1 | median and oldest, over open items | **A1** | none in V1 | none | n/a | Age is from creation, not from when work started | — |
| C2 | open items past the 7-day threshold | **A1** | none in V1 | none | n/a | "Meaningful" excludes superficial metadata edits (`contracts.ts:204`) — the exclusion list is a rule, and the rule is named | Comment or move the item |
| D1 | upcoming milestones with connected unresolved work | count of upcoming milestones in the 30-day window | none | none | n/a | **One-legged**: linked decisions are not readable (R5), so this can under-count. Never rendered as "no risk". | Resolve the connected work in Tasks |

**One trend only:** A1 `open_work`, per §10.5, and only above the 14-snapshot minimum.

**At most three ranked exceptions.** `DEFAULT_RULE_CONFIGURATION.maxObservations` is already
`3` (`src/modules/signal/lib/analytics/rules.ts:43`), applied at `:693` after the evidence,
action, suppression, dedup and ranking gates (`:652`). Kept exactly. Never configurable above
three by a client, and the fourth is not "see more" — it does not exist as a rendered thing.

**A complete authorized Project ledger.** Every Project in the authorized set appears, with
its state, including `unavailable`, `unresolved`, `archived` and `empty`. `projectRows`
truncates to `OVERVIEW_PROJECT_LIMIT = 100` and emits a coverage code
(`service.ts:50`, `:591`, `:402`). **A coverage code is not disclosure of a truncated
ledger.** The ledger is complete, or paginated with an exact total, and it always says which
Projects it could not read (§11 rule 1).

### 13.2 Withheld in V1 — each with the defect that withholds it

These are **not rendered**, and their absence is named on the surface. None of them renders
as `0`.

| Claim | Withheld because | Ships when |
|---|---|---|
| `blocked_work` | **R2.** `explicitBlocking = row.lane === "blocked" \|\| row.lane === "waiting"` (`providers/tasks.ts:128`). `"blocked"` was never a lane; migration `drizzle/0024_retire_waiting_lane.sql:57-60` rewrote every `lane='waiting'` to `lane='doing'` + `board_column_key='waiting'`; the mirror schema has no `board_column_key` column (`signal-tasks-db-schema.ts:14-42`). `explicitCount` is **always 0**. | the mirror carries `board_column_key` and the predicate reads it |
| `open_decisions` | **R4.** Requires `decision_read`; Notes declares only `["follow_up_read","cross_product_links"]` (`providers/notes.ts:173`). | Notes exposes structured decisions as approved extracts |
| `milestone_movement` | **R4.** Requires `milestone_date_history`, declared only when Timeline `activity` rows exist (`providers/timeline.ts:241`, `:251`) — and nothing in this repository ever writes that table. | Timeline writes date-change history |
| `completion_pace_change` | Needs four comparable windows of real history, and the snapshot table is empty (R7). It is also the only carrier of a faster/slower claim, which is exactly the claim that must not be guessed. | ≥4 comparable snapshot windows exist at one major version |
| `follow_up_completion` | **R8.** Viewer-scoped by construction (`providers/notes.ts:86`). | renders **only** in a user-scoped view labelled "yours", never as a Project fact |
| `workload_distribution` | **Decision D-HA08 — retired from V1 rendering.** | a founder ADR reopens it |

**D-HA08 rationale.** `workload_distribution` emits `activeCount` and `share` per owner
(`contracts.ts:396-408`; `metrics.ts:694-748`). The code already knows the danger and defends
in copy: "This is workload, not individual productivity" (`metrics.ts:745`). Copy is not a
boundary. In a team of two — which is Signal Studio's actual shape — a per-person active
count *is* an individual productivity reading, and §13.3 forbids exactly that. It is also
built on assignees that are never validated against membership
(`src/server/db/schema.ts:53-56`; `PROJECT_SCOPE.md` §3.1 consequence 3), so it can name
people who were never members. Its only safe component, `unownedCount`, is already claim A3.

The metric stays computable. It does **not** render, and it is removed from `SNAPSHOT_METRICS`
(`snapshots.ts:36-48`) so that per-person aggregates are not persisted for a surface that does
not exist.

### 13.3 Explicitly not allowed

No surface, lab direction, fixture, snapshot metric or copy string may express any of these
without a new founder-approved ADR. This list is a boundary, not a backlog.

| Not allowed | Why |
|---|---|
| **Capacity** — available hours, headroom, "room for N more" | No hours, availability, calendar-load or working-pattern data exists in any of the three databases. Any figure would be invented. |
| **Utilization** — % busy, load factor, allocation | Same absence, plus it converts a person into a denominator (§6 rule 1). |
| **Profitability** — cost, revenue, margin, cost-per-item | No financial data is in scope for these products. |
| **Employee productivity** — per-person throughput, velocity, leaderboards, rankings, any comparison of one person to another | Charter rule 13. D-HA08. This is the single most damaging thing a small-team tool can render. |
| **Speculative AI risk** — an AI-generated risk score, health grade or judgement | Charter rule 12: AI may phrase authorized deterministic facts; it may not invent risk or health. |
| **Predicted completion** — forecast dates, "at this pace you will finish by", burndown projections, ETA | Prediction from a source with no revision history and a 2,000-row cap is guessing with a date attached. Also §12.5. |
| **Health scores / composite indices** — a single number standing for a Project's condition | Charter rule 13. A composite hides its own truth class (§3 rule 2). |
| **Any metric whose denominator is a person** | §6 rule 1 plus the above. |

---

## 14. Release blockers — R1–R10 dispositions, and six new findings

All ten of `docs/wave/ANALYTICS_TRUTH.md` R1–R10 were re-verified individually at this base
and all ten are **STILL TRUE**; zero resolved (`RECONCILIATION.md:142-155`, `:224`). Each
carries a disposition below. **No Analytics surface enables in production while any blocker
marked BLOCKER is open.**

| # | Defect | Disposition | Gate |
|---|---|---|---|
| **R1** | Three colliding Project id spaces, unioned at `lib/analytics/scope.ts:107-112`, joined `milestone.projectId === project.id` at `service.ts:566-571`, `:632` | **BLOCKER · REPLACE.** Adopt canonical `ProjectId` (§4.1). Delete the milestone↔project slug join; milestone resolution goes through `resolveCanonicalTimeline` (`PROJECT_SCOPE.md` §2.2). Tag id renamed Label, facet only (§4.2). Retire `workspaceHasProject` as an authorization step (`policy.ts:206-222`). | no claim renders until `AnalyticsScope` carries `ProjectId` |
| **R2** | `blocked_work.explicitCount` is always 0 (`providers/tasks.ts:128`) | **BLOCKER · WITHHOLD.** Not rendered in V1 (§13.2). Status `unsupported`, never `0`. | mirror carries `board_column_key` |
| **R3** | Done read with `isTaskDone(row, null)` ⇒ `doneKeys = ["done"]` while the board, digest, export and print use the real per-Project config (`providers/tasks.ts:117,148`; `providers/notes.ts:105,154`; `src/lib/board-columns.ts:183-186`) | **BLOCKER · REPLACE + DISCLOSE.** Every done read uses the real config. Until the mirror can carry it, every completion claim carries the per-Project Done limitation verbatim (§12.3) and cross-Project completion ranking is prohibited (§6 rule 5). | real config reaches the providers |
| **R4** | `open_decisions` and `milestone_movement` can never be `available`; fixtures declare both (`fixtures.ts:58-59`) | **BLOCKER · WITHHOLD + FIX FIXTURES.** Both withheld (§13.2). Fixture capability set must be a subset of the production-declarable set, asserted by test (§8). | fixture-capability test passes |
| **R5** | Cross-product links hardcoded empty (`providers/tasks.ts:162-163`; `providers/notes.ts:161`; `providers/timeline.ts:225`); only real edge is `ms-{workspaceId}-{taskId}` | **BLOCKER · NARROW + DISCLOSE.** D1 renders only the legs it can see and names the missing leg in its limitation. **Never "no risk".** | D1 limitation text present |
| **R6** | Dead `/app/trends` links reach a real user surface; the ledger strips them, the evidence drawer does not (`rules.ts:154`; `service.ts:549`) | **BLOCKER · FIX.** `rules.ts` builds `/app/home/analytics`. The evidence drawer applies the ledger allowlist (§12.2). **Note: the drawer is live, not dead** — `signal-brief-page.tsx:2` imports it on the shipped `/app/home/briefing` path (§17.3), so this is a defect in production, not in dead code. `rules.ts:485` is a *primary* action and the only action on `completion_pace_change` — which is withheld anyway (§13.2). Requires the URL-contract update named at `RECONCILIATION.md` row 1. | no `/app/trends` string in `src/` |
| **R7** | No snapshot writer is called; `captureWorkspaceSnapshots` has **zero callers repo-wide** (`snapshots.ts:244`; `vercel.json` declares exactly one cron, the digest) | **BLOCKER · BUILD.** §15 is the writer specification. **History is a read path over an empty table until it lands.** | ≥14 comparable snapshots exist before any trend renders |
| **R8** | Notes aggregates viewer-scoped without disclosure (`providers/notes.ts:86`) | **BLOCKER · SCOPE + DISCLOSE.** Notes-derived claims render only in a user-scoped view labelled "yours". New issue code `notes_viewer_scoped` (§8). | issue code emitted |
| **R9** | Owner identity collision: `scope.ts:19-21` compares a Tasks user id against Timeline `assignee` (`providers/timeline.ts:226`) ⇒ under a user scope every milestone and dependency is silently dropped | **BLOCKER · FIX.** Comparison goes through an explicit identity mapping. Where no mapping exists the record is **retained and disclosed** as `owner_unmatched` (§6). Silent dropping is the exact failure charter rule 11 bans. | `owner_unmatched` exclusion emitted, count non-null |
| **R10** | Unordered 2,000-row read (`providers/tasks.ts:58-62`) — truncation flagged, but *which* rows is undefined, so repeated reads can return different totals | **BLOCKER · FIX.** Deterministic `ORDER BY`. Truncation becomes a claim-level exclusion count (§6 rule 3), rendered as "counted 2,000 of more than 2,000". | `orderBy` present; exclusion count rendered |

### 14.1 New findings, recorded here first

| # | Finding | Evidence | Disposition |
|---|---|---|---|
| **N1** | The history read does **not** filter on `metric_version`, so a version bump mid-window silently draws two different definitions as one line | `snapshots.ts:161-178` — the predicate is workspace, scope, `metric_key`, time range. No version. | **BLOCKER.** Add `metricVersion` to the predicate; §10.3 comparability. |
| **N2** | The metric-snapshot upsert does not update `snapshot_at`, so after a same-day re-run the row carries the **first** run's timestamp and the **last** run's value | `snapshots.ts:344-353` — `set:` covers `numericValue`, `aggregateValue`, `coverage`, `metricVersion`, `updatedAt`. Not `snapshotAt`. | **BLOCKER.** Canonicalise `snapshot_at` to the UTC day boundary (§15.3), which makes the timestamp version-stable and the re-run genuinely idempotent. |
| **N3** | Ingestion time and rendered-view time are one field | `metrics.ts:193` — `calculatedAt: snapshot.capturedAt` | **BLOCKER.** Split into the four times of §9. |
| **N4** | The writer excludes Notes entirely and caps per-Label scopes at 50 | `snapshots.ts:310-315`, `:321` (`notes: []`, `notes_not_read_by_background_snapshot`), `:332` (`projects.slice(0, 50)`) | **DISCLOSE.** No Notes-derived trend, ever, on this writer. Label-scoped history exists for at most 50 Labels and the 51st is `insufficient_history`, not zero. |
| **N5** | Snapshot eligibility is `analytics_users.linked_workspace_id IS NOT NULL` — **one workspace per user**, not all of them | `snapshots.ts:57-66`; independently found at `audit/B-domain-permissions.md:546-572` (`RECONCILIATION.md:181`) | **BLOCKER for all-projects trends.** A member of five Projects gets history for one. Under `all-projects`, the trend is `insufficient_history` unless every Project in the read set has a comparable run. |
| **N6** | A rendered "trend" needs no snapshot at all, and is silently truncated by the record caps | `trend-series.ts:24-86` + `providers/tasks.ts:27,62` | **BLOCKER.** D-HA05: the snapshot ledger is the only trend source (§10.2). |

---

## 15. The snapshot writer

`captureWorkspaceSnapshots` (`snapshots.ts:244-396`) is **kept as the unit of work**. It is
well built — a stable-id lease, a per-workspace daily receipt, bounded reads, retention
pruning, and a coverage record that persists no source content (`safeCoverage`, `:455-464`).
What follows is what must change and what must be added before it is called.

### 15.1 Trigger and schedule

- One job, gated by `SIGNAL_ANALYTICS_JOBS_ENABLED`, **default off, fail closed**
  (`RECONCILIATION.md` row 9). The gate is separate from the view gate and from
  `SIGNAL_ANALYTICS_V1_ENABLED`, which is a **briefing-engine** switch, not a view switch
  (`docs/wave/ANALYTICS_TRUTH.md:171-184`; `RECONCILIATION.md:163`).
- Daily, one fixed UTC hour, **not** the digest hour. `vercel.json` declares exactly one cron
  today (`/api/cron/digest?send=1`, `0 9 * * *`); the analytics job is a second entry and
  must not contend with the digest on the same libsql clients.
- The batch is bounded and fair: `selectSnapshotBatch` caps at 25 per invocation
  (`snapshot-utils.ts:72-93`) and `prioritizeSnapshotCandidates` puts oldest-or-never first
  so a UTC-day reset cannot starve the tail (`:14-24`). Keep both.

### 15.2 Eligibility

Today: `analytics_users.linked_workspace_id IS NOT NULL` (`snapshots.ts:57-66`) — one
workspace per user (N5). Kept as the V1 boundary because it is an explicit user act, but its
consequence is disclosed on every trend: history covers the Project you linked, not every
Project you are a member of. `currentLinkedWorkspaceIds` already drops a workspace once no
linked subject remains a member (`snapshot-utils.ts:27-49`) — that is a revocation path and
it is kept.

### 15.3 What is written, and when it is stamped

- `snapshot_at` becomes the **UTC day boundary** of the capture day, not the run instant.
  This makes the id, the timestamp and the value agree, fixes N2, and makes a same-day re-run
  genuinely idempotent.
- The row id stays `sha256("metric" ‖ workspaceId ‖ scopeKey ‖ metricKey ‖ day ‖ metricVersion)`
  (`snapshot-utils.ts:50-52`; `snapshots.ts:440`). Deterministic, version-partitioned, correct.
- `project_id` is renamed `label_id`; a new `project_id` carries a canonical `ProjectId`
  (§4.2). Expand → migrate → contract. The old column is never reinterpreted in place.
- `numeric_value` selection stays explicit per metric (`snapshotMetricNumber`,
  `snapshot-utils.ts:107-121`). `workload_distribution` is removed from `SNAPSHOT_METRICS`
  (D-HA08).
- No source content is persisted. `scalarSnapshotAggregate` keeps finite numbers only and
  drops arrays and identifiers (`snapshot-utils.ts:96-104`). Kept, and it is the reason the
  ledger cannot leak a note title.

### 15.4 Versioning and comparability

Per §2 and §10.3. A major bump starts a new series. The history read filters on major version
(N1). Two versions are never drawn as one line and never averaged.

### 15.5 Leases, retries, idempotency

- **Lease.** `insert … onConflictDoNothing` claims the day; a `failed` receipt, or a
  `running` receipt older than `SNAPSHOT_RUN_STALE_MS` (10 minutes), may be reclaimed
  (`snapshots.ts:252-284`; `snapshot-utils.ts:5`, `:57-65`). Keep. **Add:** the worker
  re-checks that it still holds the lease immediately before the metric upsert. Without that
  re-check, a run that overran its lease and a run that reclaimed it can both write.
- **Retries.** Bounded: at most **3** attempts per (workspace, UTC day). After the third the
  day is recorded `abandoned` and the series carries a **gap**, which ends the comparable run
  (§10.3). An abandoned day is **never** filled later from a fresh read — that is a backfill,
  and §15.7 governs it.
- **Idempotency.** `onConflictDoUpdate` on the deterministic id (`snapshots.ts:344-353`),
  plus the `snapshot_at` fix of §15.3. Re-running a day produces the same row.

### 15.6 Retention

400 days (`SNAPSHOT_RETENTION_DAYS`, `snapshot-utils.ts:4`), pruned both globally
(`pruneExpiredAnalyticsHistory`, `snapshots.ts:132-139`) and per workspace after a successful
capture (`:365-383`). Kept. Retention is a **visible chart boundary**: the left edge says
"history starts here" and never implies the metric was zero before it.

### 15.7 Backfill — the rule that matters most

> **A backfill may create a historical snapshot for instant T only when versioned source
> events or record revisions permit reconstructing the state that existed at T. Repeating
> today's records under earlier dates is fabrication and is prohibited.**

Applied to this schema, at this base, that resolves to a short and uncomfortable answer:

| Metric | Reconstructible as of a past T? | Why |
|---|---|---|
| `work_completed` | **Yes**, back to the earliest retained `activities` row | It is a flow derived from timestamped transition events, which are retained with `created_at` and a kind |
| `open_work`, `open_overdue_work`, `unowned_work`, `open_work_age`, `stalled_work` | **No. Never, on this schema.** | These are stocks. The mirror stores only the *current* `lane`, `assignees`, `due` and `tags`. There is no revision history, so there is no way to know what was open, unassigned or overdue on a past date. Reconstructing them means asserting today's state under yesterday's date. |
| `cross_product_milestone_risk` | **No** | Depends on current due dates and current dependency states, neither of which is versioned |

**Therefore: no backfill of any stock metric, including the one V1 trend.** The `open_work`
trend begins the day the writer starts and not one day earlier. Its left edge says so.

Every persisted row carries `origin: "capture" | "backfill"`. A backfilled row's evidence
route names the events it was reconstructed from. A chart never mixes origins without the
distinction visible, and never presents a backfilled point and a captured point as
interchangeable.

### 15.8 Kill switch

Two independent levels, both server-side, both fail-closed:

1. `SIGNAL_ANALYTICS_JOBS_ENABLED=false` — the writer stops. Existing rows stay readable. The
   surface says the capture is paused and gives the last capture date. It does **not** silently
   convert "not enough history" into "no data", and it does not delete history.
2. Per-provider kill switch — one source stops. Every claim depending on it becomes
   `unsupported` with its reason named. Never `0`, never "all clear".

Turning either off is reversible and takes effect on the next request. Neither requires a
deploy, and neither is readable by client code.

---

## 16. Privacy — the seam that must survive

Private raw Notes never enter the analytics domain. The Notes query names its columns and
never names `body` (`providers/notes.ts:84-85`), the intent is recorded in source at `:26-28`,
`NoteRecord.exposure` is the literal `"approved_extract"` (`contracts.ts:122`, `:138`), and
`PersonRef` deliberately excludes email (`contracts.ts:82-83`). Audit B reached the same
conclusion independently and calls it the best-defended seam in the estate
(`audit/B-domain-permissions.md:482-525`; `RECONCILIATION.md:164`).

**Sealed rules.**

1. This contract does not weaken it in any direction. No claim, evidence route, receipt,
   snapshot row or export carries a raw note body, a note title that is not an approved
   extract, or an email address.
2. A Note's Project is filing metadata only and never an access grant
   (`PROJECT_SCOPE.md` §2.4).
3. `deepLink: ""` on note records (`providers/notes.ts:163`) is deliberate. Analytics does not
   link into a private note.
4. A receipt (§12.1) names record **ids**, never record content.

### 16.1 The preview-deployment posture

Preview deployments serve synthetic analytics data with **no authentication**:
`policy.ts:49-63` returns a synthetic principal `signal-${mode}` and never calls `auth()`.
This is currently masked only because the flag 404s first (`policy.ts:44`) and Playwright pins
it off (`experience/playwright.config.ts:73`) — deny-by-default by accident, not by design
(`docs/wave/ANALYTICS_TRUTH.md:152-166`).

**The Analytics lab adds its own authentication and reviewer allowlisting. It does not inherit
this path.** The lab guard already exists in this worktree
(`src/lib/home-layer/lab/{policy,guard}.ts`) and is the mechanism.

Synthetic and live evidence stay visibly separate on every surface (charter definition of
done). `dataAccess: "live" | "fixtures"` is already on the principal (`policy.ts:26`) and is
rendered, not merely carried.

---

## 17. What is kept, replaced and retired

### 17.1 Keep

| Thing | Why |
|---|---|
| `ProviderCoverage` / `DataCoverage` / `combineCoverage` | §8. The vocabulary Home extends rather than duplicates (`PROJECT_SCOPE.md` §5 rule 7) |
| The five-stage authorization chain (`policy.ts:44-108`, `scope.ts:63-142`) | Well built; §11 |
| The ledger boundary and its 34 certified cases (`ledger-contract.ts`, `ledger-adapters.ts`) | §12.2 |
| `maxObservations: 3` and `rankAndSelectObservations` (`rules.ts:43`, `:652-696`) | §13.1, at most three ranked exceptions |
| Honest degradation on unset provider URLs (`providers/timeline.ts:30-42`, `providers/notes.ts:36-46`) | Unavailable is not zero |
| `captureWorkspaceSnapshots`, its lease, batching and retention | §15 |
| `runAnalyticsRoute` (`route.ts:9`) — unmounted | The tested envelope (auth → parse → calculate → `Server-Timing`) an Analytics route will need. Keeping it is not the same as having an API (`audit/A-repo-product-truth.md:539`) |
| The Notes privacy seam | §16 |

### 17.2 Replace

| Thing | With |
|---|---|
| `AnalyticsScope` workspace/project nesting (`contracts.ts:11-18`) | §4.1 — `{ kind: "projects" \| "user" }` over canonical `ProjectId` |
| Tag-derived project identity everywhere (`providers/tasks.ts:365-374` and its six call sites) | Label facet (§4.2) |
| `workspaceHasProject` as authorization (`policy.ts:206-222`) | Membership through `src/lib/projects/**` (`PROJECT_SCOPE.md` §11) |
| `isTaskDone(row, null)` (`providers/tasks.ts:117,148`; `providers/notes.ts:105,154`) | The real per-Project config (R3) |
| Event-derived trend buckets (`trend-series.ts:24-86`) | The snapshot ledger (D-HA05, §10.2) |
| `MetricResult.calculatedAt` (`metrics.ts:193`) | The four times of §9 (N3) |
| `/app/trends` link builder (`rules.ts:154`) | `/app/home/analytics` (R6) |
| Unfiltered evidence actions (`service.ts:549`) | The ledger allowlist (§12.2) |

### 17.3 Retire

The `SignalAppShell` subtree is dead. A repo-wide search for `signal-app-shell`,
`SignalAppShell`, `overview-view` and `trends-view` across `src/**/*.{ts,tsx}` returns exactly
**one** file — the shell's own definition. Delete before Wave 3, or a lab agent will build the
new Analytics on top of a dead shell (`REPOSITORY_TRUTH.md:165-173`;
`audit/A-repo-product-truth.md:538`).

**The dead set is 14 files, resolved by walking the import graph at this base, not by
directory.** All under `src/modules/signal/components/signal/`:

| File | Reached only from |
|---|---|
| `signal-app-shell.tsx` | nothing — zero importers |
| `overview-view.tsx` | nothing — zero importers |
| `trends-view.tsx` | nothing — zero importers |
| `action-queue.tsx` · `customize-mode.tsx` · `observation-card.tsx` · `project-status-table.tsx` · `summary-row.tsx` | `overview-view.tsx` |
| `data-coverage-notice.tsx` · `trend-chart.tsx` | `overview-view.tsx`, `trends-view.tsx` |
| `context-sidebar.tsx` · `freshness-indicator.tsx` · `signal-context-controls.tsx` · `signal-view-tabs.tsx` | `signal-app-shell.tsx` |

**Seven files in the same directory are LIVE and must not be deleted.** They are reached from
`/app/home/briefing`, which ships today:

| File | Live importer |
|---|---|
| `evidence-drawer.tsx` | `src/modules/signal/app/signal-brief-page.tsx:2` |
| `format.ts` | `signal-brief-page.tsx:3` |
| `links.ts` | `src/modules/signal/app/signal-page-data.ts:15` |
| `signal-types.ts` | `signal-page-data.ts:21` |
| `signal.css` | `src/app/app/home/briefing/layout.tsx`, `components/brief/quiet-briefing-ledger.tsx` |
| `action-link.tsx` · `source-record-list.tsx` | `evidence-drawer.tsx:13`, `:15` |

This distinction is load-bearing. `audit/A-repo-product-truth.md:538` records "eight
descendants" and `REPOSITORY_TRUTH.md:166` records "ten"; walking the graph at this base gives
**eleven**, and it also shows that `evidence-drawer` — which R6 names as the surface serving a
404 link — is **not** dead. It is on the live briefing path. Deleting it as part of a "dead
shell" sweep would remove a shipped surface; leaving R6 unfixed because "the drawer is dead"
would leave a live 404.

Retirement is a **Wave 9 deletion with a Wave 3 freeze**: nothing new imports the fourteen
from now on, and the deletion PR is separate from the Analytics build so the diff of what was
removed is readable on its own. Any behaviour worth keeping is re-derived from this contract,
not copied out of a dead component.

---

## 18. Executable assertions

Written as failing tests in `src/lib/home-layer/analytics/` (§0). Each fails today, and the
right reason is named.

| # | Assertion | Fails today because |
|---|---|---|
| C1 | A claim module exists exporting the §1 envelope with all seventeen fields | no such module exists |
| C2 | `baseline` is `{ kind: "none" }` and renders "No accepted baseline" | no baseline concept exists in the analytics domain |
| C3 | `value: null` never serializes to `0` for any status other than a genuine zero | no claim layer exists to assert on |
| C4 | Every claim carries four distinct times | `metrics.ts:193` carries one (N3) |
| C5 | A receipt replays to a byte-identical value | no receipt type exists |
| C6 | A trend requires ≥14 comparable snapshots and renders no chart below it | `snapshots.ts:197` and `trend-series.ts:96` require 2 |
| C7 | The history read filters on `metric_version` | `snapshots.ts:161-178` does not (N1) |
| C8 | The metric upsert updates `snapshot_at` | `snapshots.ts:344-353` does not (N2) |
| C9 | `captureWorkspaceSnapshots` has at least one caller | zero callers repo-wide (R7) |
| C10 | No `/app/trends` string exists in `src/` | `rules.ts:154` builds one (R6) |
| C11 | The tasks read has a deterministic `ORDER BY` | `providers/tasks.ts:58-62` has none (R10) |
| C12 | The blocked predicate does not test `lane === "blocked"` | `providers/tasks.ts:128` does (R2) |
| C13 | The `SignalAppShell` subtree is deleted | it exists (§17.3) |
| C14 | No banned metric-family term appears in the analytics domain | `workload_distribution` ships per-owner shares (§13.3, D-HA08) |
| C15 | Fixture capabilities are a subset of production-declarable capabilities | `fixtures.ts:58-59` declares two production never declares (R4) |
| C16 | `workload_distribution` is absent from `SNAPSHOT_METRICS` | `snapshots.ts:46` includes it |

### 18.1 The three files, and what they do today

```
node --import tsx --test src/lib/home-layer/analytics/claim-contract.test.ts
node --import tsx --test src/lib/home-layer/analytics/history-contract.test.ts
node            --test src/lib/home-layer/analytics/defect-gate.test.mjs
```

| File | Result at this base | What it proves |
|---|---|---|
| `claim-contract.test.ts` | **25 fail, 0 pass** | The claim envelope of §1 does not exist. Each failure names one required export and the clause requiring it. |
| `history-contract.test.ts` | **17 fail, 0 pass** | The history module of §10 and the writer contract of §15 do not exist. |
| `defect-gate.test.mjs` | **18 fail, 4 pass** | Eighteen gates read the real analytics source and fail on R1–R10, N1, N2, C6, C13 and C16. Four standing guards pass and must keep passing: the metric-family boundary (§13.3), the Notes privacy seam (§16), that nothing imports the dead shell, and that the seven live components survive the §17.3 retirement. |

**These are not implemented modules.** They are the Wave 8 checklist, in order, with each item
carrying the file:line that makes it fail. Two deliberate details in how they are written:

1. The module specifiers in the two `.ts` files are typed `string`, not string literals, so
   `tsc --noEmit` cannot try to resolve modules that do not exist yet. Verified: the
   repository's typecheck reports **zero** errors from `src/lib/home-layer/analytics/`.
2. `defect-gate.test.mjs` reads production source only. A sibling Wave 1 contract test
   mentions `captureWorkspaceSnapshots` in a comment, which briefly turned the R7 gate green
   on prose alone — the same class of defect this contract exists to prevent, caught in its
   own instrument. Test files are now excluded, and the R7 gate matches a call, not a mention.

---

## 19. Decisions taken by this contract

| Id | Decision | Rationale | Consequence |
|---|---|---|---|
| **D-HA01** | Adopt R1–R10 as release blockers with a per-defect disposition; none is deferred to "polish" | All ten re-verified STILL TRUE at this base, zero resolved (`RECONCILIATION.md:224`). A defect with no disposition is a defect someone will assume is handled. | §14 |
| **D-HA02** | The claim, not the metric, is the unit of rendering. Seventeen required fields; a claim that cannot fill one does not render | Charter rule 11 is unenforceable against a bare number. It is trivially enforceable against a typed envelope with required fields. | §1 |
| **D-HA03** | Three truth classes, kept visibly different, never aggregated into one number | `blocked_work` already merges Reported and Inferred into one count (`metrics.ts:444-456`) while its value object keeps them separate. The engine knows; the presentation was going to forget. | §3 |
| **D-HA04** | Every claim ships `baseline: { kind: "none" }` and the literal words "No accepted baseline" until a founder accepts one | No baseline exists anywhere in the analytics domain. An omitted baseline field reads as "fine"; the words read as what it is. | §7 |
| **D-HA05** | The snapshot ledger is the **only** admissible trend source. Event-derived buckets are retired as a trend | `buildTrendPoints` needs no persisted history and is silently truncated by `MAX_TASKS` — a cap that bites the oldest rows renders as a decline that never happened (N6). | §10.2 |
| **D-HA06** | Minimum 14 comparable daily snapshots, no gap longer than one day, or "Not enough history" and **no chart** | Two points (today's bar) is a line between two dots. Fourteen survives a normal week without a weekend reading as a decline. | §10.4 |
| **D-HA07** | Exactly one V1 trend: `open_work`, a level series | A daily snapshot of a stock is exactly comparable day to day. A daily snapshot of a 28-day flow shares 27 of 28 days with its neighbour — a rolling sum drawn as a trend. | §10.5 |
| **D-HA08** | `workload_distribution` is retired from V1 rendering and removed from `SNAPSHOT_METRICS` | Per-person active counts in a two-person team are individual productivity, which §13.3 forbids; the copy disclaimer at `metrics.ts:745` is not a boundary; and assignees are never validated against membership. Its only safe component is already claim A3. | §13.2 |
| **D-HA09** | No backfill of any **stock** metric, ever, on the current schema. Flow metrics may be reconstructed from retained events only, and carry `origin: "backfill"` | The mirror stores current state with no revision history. Backfilling a stock means writing today's answer under yesterday's date. That is fabrication, and it is undetectable afterwards. | §15.7 |
| **D-HA10** | The authorized Project ledger is complete or exactly paginated. A truncation coverage code is not disclosure | `service.ts:591` trims to 100 and emits a code (`:402`). A reader cannot tell a 100-Project ledger from a trimmed 140-Project one. | §13.1 |
| **D-HA11** | A record that cannot be joined across identity spaces is **retained and disclosed**, never dropped | R9 drops every milestone under a user scope, silently. Dropping is the exact failure charter rule 11 bans, and it is invisible to the reader by construction. | §6, §14 R9 |
| **D-HA12** | Two independent kill switches — job and per-provider — and neither deletes history nor converts "not enough history" into "no data" | A kill switch that silently changes what a surface *claims* is worse than no kill switch, because it is used in exactly the moment nobody is watching the copy. | §15.8 |

---

## 20. Open, and owned elsewhere

Recorded so no lane treats silence as settlement.

1. **`src/lib/projects/**` has not landed.** Every canonical-`ProjectId` disposition in §4 and
   §14 R1 is unverified until it does. Owner: `lane/wp2-project-platform`.
2. **The URL contract must gain `/app/home/analytics`** before R6's fix can be correct, and
   that requires the paired Studio decision record in the same release
   (`RECONCILIATION.md` row 1, R-H06). Owner: lead, Wave 4.
3. **Whether the analytics domain gains a Program (planning-period) axis** is explicitly left
   open by `docs/wave/DECISIONS.md` D-010 and by `DECISIONS.md`'s register of what this
   programme decided not to decide. `HomeReadScope` already carries `planning-period`
   (`PROJECT_SCOPE.md` §5), so the *scope* axis exists; whether a **claim** may be grouped by
   Program does not. Owner: `feat/project-truth-wave`.
4. **The mirror cannot read per-Project board config**, which is what blocks R3 properly. The
   fix is a schema change on a read-only mirror owned by no current lane. Owner: unowned —
   escalated.
5. **A second cron entry** in `vercel.json` interacts with the deployment plan's cron limits.
   Owner: lead / founder.
6. **The `SIGNAL_*` analytics database has no drift alarm and no receipt-backed runner**
   (R-H14; `DEPLOY.md:126-137`). §15's writer puts real product claims on a database with no
   production safety net. Either it comes under the receipt-backed runner before the writer
   is enabled, or the exposure is accepted explicitly. Owner: lead.
7. **The 9.5 quality council cannot certify anything** and narrowing it is a founder decision
   (R-H08). Not this contract's to resolve, and not something an implementation agent may
   narrow.
