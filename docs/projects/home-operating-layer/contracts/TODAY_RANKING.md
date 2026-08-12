# Contract · Today ranking

**Status:** Sealed (Wave 1). Binding on Today, the Full briefing, every lab direction and
every contract test.
**Base:** `origin/main` @ `78021c5` · branch `feat/home-operating-layer` · worktree `_wt-home-layer`
**Adopts:** `contracts/PROJECT_SCOPE.md` (sealed) · `CONTENT_OWNERSHIP.md` (sealed) ·
`docs/adr/0001-canonical-project-identity.md`
**Incumbent:** `src/modules/signal/lib/briefing/**`
**Ranking version:** `home-today-ranking@1.0.0`
**Tests:** `src/lib/home-layer/today/today-ranking-contract.test.ts` (failing by design)

Charter rule 9: *Today and Full briefing share one deterministic ranking engine.*
`RECONCILIATION.md` row 4: *Two ranking implementations is an automatic veto. Existing
briefing build logic is the incumbent — Wave 5 either extends it or replaces it wholesale,
never forks it.*

This contract takes that decision.

---

## 1. Extend, do not replace. The engine is not what is broken.

**Decision `TR-1`. The incumbent engine at `src/modules/signal/lib/briefing/build.ts` is
extended in place. It is not replaced, not reimplemented behind a new name, and not forked.
Its *source adapter* is replaced wholesale.**

The distinction is the whole of Wave 5's shape, so it is worth being exact about which half
of the current code is sound.

**What is sound and stays.**

| Property | Evidence |
|---|---|
| Pure function over a source; same inputs → same brief on the same day | `build.ts:47-52` — `buildBriefing(source, ctx, now, readState)`, no I/O of its own |
| A genuine **total order** on candidates: weight → severity → trigger name → id | `build.ts:299-307` |
| Deterministic per-day phrase rotation, stable across a reload on the same day | `build.ts:312-319` |
| One candidate per object, best trigger wins — an overdue *and* stuck task is one row | `build.ts:80-93` |
| Honest denominators: `readCount` counts everything examined, `triggeredCount` counts before the cap, synthetics excluded | `build.ts:182-198` |
| Carry-over de-emphasis that keeps the slot and states the age instead of hiding it | `build.ts:140-153` |
| Reader dismissals respected per-trigger, with a `*:${taskId}` wildcard | `build.ts:56-60` |
| Real test coverage — `build.test.ts`, `triggers.test.ts`, `prose.test.ts`, `voice.test.ts`, `wedding-briefing-selectivity.test.ts` | `src/modules/signal/lib/briefing/` |
| One build already serves Home and the Full briefing: `captureSignals` guarantees one read, one authorization path, one engine | `signal-build-for-user.ts:70-86`; audit A `:207-209` |

**What is broken, and is the *source*, not the engine.**

| Defect | Evidence |
|---|---|
| The production read is Tasks-only — one `SELECT` from one table | `src/modules/signal/lib/data/source.ts:292-295` |
| `events` is hardcoded `[]` | `source.ts:271-273` |
| "Projects" are synthesised by slugifying task **tags** | `source.ts:233-264`; the projection is sealed as a **Label**, never a Project (PROJECT_SCOPE §2.3) |
| Provenance is a string template, not a resolved source | `signal-build-for-user.ts:331` |
| The lane vocabulary comes from a fixed table, so Tasks `review` becomes `in-flight` and the engine's `review` lane is unreachable | `source.ts:112-117`; `signal-build-for-user.ts:313-318`; `CONTENT_OWNERSHIP.md` `DUP-2` |
| `priority` is hardcoded `2` for every row, so the P0 severity bonus never fires in production | `signal-build-for-user.ts:320` — `priority: 2 as const`; the bonus it feeds is at `triggers.ts:76`, `:113` |
| Dismissed items are filtered **before** counting, so a dismissed-but-still-triggering item is counted as *cleared* | `build.ts:62-67` then `:196-198`; `ledger-contract.ts:292-301` |

Replacing the engine would discard the tested half and keep the broken half. Rewriting the
source is unavoidable either way — Home Read Scope is a *build*, not a rewire
(`REPOSITORY_TRUTH.md:21-31`). So: **new source, same engine, engine widened where the new
source needs it.**

### 1.1 What "widened" means precisely

Four changes to the engine, and no others. Each is additive; none changes an existing
trigger's behaviour for a Tasks row.

1. `TaskSignal` becomes `WorkSignal` and carries a `SourceRef` (`CONTENT_OWNERSHIP.md` §1.1)
   instead of a bare `id`. `TaskSignal` remains as an alias so existing tests keep compiling.
2. Two triggers are added from the retired nudge generator (§4.2).
3. `buildBriefing` takes a `coverage: DataCoverage` input and returns it unchanged in the
   result, so no consumer can render rows without the coverage that qualifies them (§7).
4. `buildBriefing` takes a required `asOf: number` instead of defaulting to `Date.now()`
   (`build.ts:50`), so the whole read is pinned to one instant (§8).

**Prohibited without a new ADR:** a second `buildX` entry point, a Home-local re-sort of the
engine's output, a "quick" filter over `signals` that assigns its own order, or any second
module that authors attention prose. `CONTENT_OWNERSHIP.md` `I2` is the executable form of
this sentence.

---

## 2. Eligible source types

`SourceKind` is defined once in `CONTENT_OWNERSHIP.md` §1.1. This table says which kinds the
ranking engine may consider, in which wave, and — the part that matters — **what an
ineligible or unavailable kind renders as**.

| Kind | v1 eligibility | Producer at this base | If the producer is absent or fails, Today renders |
|---|---|---|---|
| `task` | **eligible** | Tasks provider (`providers/tasks.ts:17-23`) and the briefing's own Tasks read | `unavailable` for that Project, per-Project, never globally (PROJECT_SCOPE §5 rule 7) |
| `milestone` | **eligible on wiring** | Timeline provider exists (`providers/timeline.ts:14-19`), reaches no Home surface | `unsupported` — a named state, never "no milestones" |
| `note-extract` | **eligible on wiring**, extracts only | Notes provider (`providers/notes.ts:11-18`) | `unsupported` |
| `decision` | **eligible on wiring** | capability `decision_read` (`contracts.ts:213-224`) | `unsupported` |
| `follow-up` | **eligible on wiring** | capability `follow_up_read` | `unsupported` |
| `calendar-event` | **ineligible in v1 — no producer exists** | `WorkRead.events` is hardcoded `[]` (`source.ts:271-273`) | `unsupported`. **Never an empty calendar, never "nothing scheduled", never a blank section.** |
| `notification` | **ineligible, permanently** | Tasks `notifications` | not rendered here at all — `home.inbox` owns every role for events (`CONTENT_OWNERSHIP.md` §2) |
| `activity` | **ineligible, permanently** | Tasks `activities` | as above |

Three rules bind this table:

1. **Notes never leak.** Only the creator-authored **approved extract** is eligible. Raw note
   bodies never reach Home. The Notes boundary is the best-defended seam in the estate and
   this contract does not weaken it (PROJECT_SCOPE §2.4).
2. **Eligibility is not availability.** A kind marked eligible whose provider returns
   `unavailable`, `stale`, `partial` or `unsupported` contributes zero rows *and* a coverage
   statement. Zero rows without the statement is prohibited (§7).
3. **Ineligible events are not "filtered out".** They are a different mode's content. Today
   does not render a count of them, does not summarise them, and does not claim they are
   clear. It links to the Inbox badge, which is the Inbox's number.

### 2.1 Scope

The candidate set is every eligible object inside the current **Home Read Scope**
(PROJECT_SCOPE §5), resolved live through seam 1 at request time. Read Scope is a URL axis
(`briefingScope`) independent of Active Project (`workspaceId`) — two parameters, two axes,
never one (D-H04).

Archived Projects are **excluded** unless the explicit labelled toggle is on (D-H08,
PROJECT_SCOPE §8.3). `Unprojectable` rows (`workspace_id IS NULL`) are excluded from every
Project-scoped count **and the exclusion is disclosed** (PROJECT_SCOPE §6). `Unfiled` notes
and `Unlabelled` tasks are named states, not errors, and are never folded into a Project to
tidy a number.

---

## 3. The source adapter

Replaced wholesale. Its contract:

```ts
type WorkSignal = {
  ref: SourceRef;              // CONTENT_OWNERSHIP.md §1.1 — the only identity
  title: string;
  lane: Lane;                  // derived, never mapped from a literal — see below
  priority: 0 | 1 | 2 | 3;     // resolved from the record, never a constant
  dueAt: number | null;
  idleDays: number;
  blockedBy: SourceRef[];
  movedToDoneAt: number | null;
  sourceLabel: SourceLabel;    // resolved, never templated — see below
  projectId: ProjectId | null;
};
```

Four sealed requirements on it:

1. **`lane` is derived from `isTaskDone(task, config)` with the real per-Project column
   config.** The fixed `LANE_TO_STATUS` table (`source.ts:112-117`) is deleted. PROJECT_SCOPE
   §5 rule 5 already bans the `lane === "done"` literal on cross-Project reads; this is the
   same rule applied to the read Home actually uses. Consequence: the engine's `review` lane
   becomes reachable, and `CONTENT_OWNERSHIP.md` `DUP-2` stops being a dead section.
2. **`sourceLabel` is resolved from the record.** The template
   `` `Tasks · ${workspaceNames.get(...) ?? "Workspace"}` `` (`signal-build-for-user.ts:331`)
   is deleted. It must carry the real product and the resolved Project name, and the fallback
   string `"Workspace"` never renders — a Project whose name could not be resolved is
   `unavailable`, not a placeholder. The word "workspace" appears in no user-facing Home
   string (PROJECT_SCOPE §12 A10).
3. **`priority` is read from the record.** Today it is `priority: 2 as const`
   (`signal-build-for-user.ts:320`), which silently disables the P0 severity bonus in every
   trigger that uses it (`triggers.ts:76`, `:113`, `:144`). A ranking that ignores the only
   priority signal the user set is not a ranking they will trust.
4. **Every read is authorized through `authorizeSignalScope` + `listPlanningCatalogForUser`**
   (`signal-build-for-user.ts:266-282`), extended for Read Scope, never bypassed. Audit A
   fixed input 3: scope authorization is centralised, and Home Read Scope extends it.

---

## 4. Ranking rules

### 4.1 Version

```
HOME_TODAY_RANKING_VERSION = "home-today-ranking@1.0.0"
```

Following `SIGNAL_RULE_VERSION = "signal-analytics-rules@1.0.0"`
(`src/modules/signal/lib/analytics/rules.ts:18`).

**Rules.** The version is emitted on every ranked response and on every evidence record.
Any change to a trigger threshold, a weight, a cap, a tie-break or the eligible-kind set is a
**minor** bump; any change to the ordering algorithm or the meaning of a count is a **major**
bump. A rendered view carries the version that produced it, so a screenshot, a receipt and a
bug report can be tied to one rule set. Two rows produced under different versions never
appear in the same list.

### 4.2 Triggers

The six incumbent triggers are unchanged. Two are promoted from the retired nudge generator
(`CONTENT_OWNERSHIP.md` `DUP-4`, decision `CO-2`).

| Trigger | Fires when | Severity | Weight | Status |
|---|---|---|---|---|
| `due-soon` | open, due ≤ 2 calendar days out in the reader's timezone, **or** overdue | overdue `80 + min(20, overdueDays·2)`; else `60 + max(0, (2 − daysOut)·8)` | 1000 | unchanged (`triggers.ts:81-121`) |
| `crowded-week` | ≥ 3 open dated objects inside the same 7-day window; **one synthetic row for the cluster, not one per object** | `55 + min(30, count·4)` | 800 | unchanged (`triggers.ts:156-200`) |
| `stuck-work` | open, idle ≥ 3 days, not blocked | `min(100, idleDays·4 + (3 − priority)·6)` | 700 | unchanged (`triggers.ts:55-78`) |
| `blocked-too-long` | open, blocked, idle ≥ 5 days | `min(90, 30 + idleDays·3 + blockers·4)` | 600 | unchanged (`triggers.ts:207-227`) |
| `overload` | > 5 objects in `in-flight` + `review`; one synthetic row | `50 + (count − 5)·4` | 500 | unchanged (`triggers.ts:232-266`) |
| **`blocker-cleared`** | open, `blockedBy.length > 0`, **every** blocker now done | `45 + min(20, blockers·5)` | **450** | **new** — from `generate-nudges.ts:207-227` |
| **`doing-empty`** | ≥ 5 objects assigned to the reader in `next` and **0** in `in-flight`; one synthetic row | `35` | **300** | **new** — from `generate-nudges.ts:243-255` |
| `just-shipped` | moved to done within 24 h | `40 + (3 − priority)·5` | 100 | unchanged (`triggers.ts:124-146`) |

`blocker-cleared` sits below `blocked-too-long` and above `overload`: it is genuinely
actionable and genuinely good news, but it is never more urgent than something with a date.
`doing-empty` sits above `just-shipped` only — it is a nudge about posture, not about an
object, and it must never displace work that is asking.

The four overlapping nudge rules (`idle-doing`, `idle-review`, `past-due`, `review-pile`) are
**deleted**; `stuck-work`, `due-soon` and `overload` already cover them at thresholds chosen
once. The nudge copy banks (`generate-nudges.ts:54-99`) move into `prose.ts`, which already
owns rotation. Nothing of the voice is lost; the second engine is.

### 4.3 Ordering

```
focusWeight(t) = weight[t.trigger] + t.severity
```

Sort ascending by the first non-zero comparison:

1. `focusWeight` descending
2. `severity` descending
3. `trigger` ascending, lexicographic
4. **`sourceKey(ref)` ascending, lexicographic** — `${product}:${kind}:${id}`

Step 4 replaces the incumbent's `a.task.id.localeCompare(b.task.id)` (`build.ts:306`), which
is a total order only while one product feeds the engine. `sourceKey` is unique across the
estate by construction, so the comparator is a **total order** and the ranking is fully
deterministic for a given `(candidate set, asOf, readState, version)`.

**Sealed:** a comparator that can return 0 for two distinct objects is prohibited. Relying on
`Array.prototype.sort` stability to break a tie is prohibited — it makes the rendered order a
function of database row order, which is what `generateNudges` does today
(`generate-nudges.ts:260`, severity only) and why the same two rows can swap places between
two reads with no data change.

### 4.4 One row per object

Exactly one candidate survives per `sourceKey`; the highest-ranked trigger wins
(`build.ts:80-93`, unchanged). A task that is overdue *and* stuck is one problem, not two.

Synthetic rows (`crowded-week`, `overload`, `doing-empty`) are **readings of** objects already
in the candidate set. They carry the `SourceRef[]` they were read from, they are never
de-duplicated against a real row, and they are never counted as objects in their own right —
which `build.ts:196-198` already gets right and which §6 keeps right.

---

## 5. Sections, caps and eligibility

Today renders four ranked sections plus the read accounting. All four are produced by **one
engine pass over one candidate set**. There is no second query, no second sort and no filter
over raw signals — `home-data.ts:137-171` is deleted (`CONTENT_OWNERSHIP.md` `CO-5`).

| Section | Eligible triggers | Cap | Order | Owns |
|---|---|---|---|---|
| **Today's signal** | `due-soon`, `overload`, `crowded-week`, `stuck-work`, `blocked-too-long`, `doing-empty` | **3, across the whole section** | §4.3, then carry-overs demoted to the bottom (`build.ts:140-153`) | `rank`, `reason` |
| **Coming up** | `due-soon` candidates with `daysOut > 2`, plus any dated eligible object inside the horizon that crossed no rule | **4** | `dueAt` ascending, then §4.3 as tie-break | a capped, ranked *view*; **never `inventory`** |
| **Needs review** | objects in engine lane `review`, plus `blocked-too-long` | **3** | `idleDays` descending, then §4.3 as tie-break | a capped, ranked *view*; **never `inventory`** |
| **Moving well** | `just-shipped`, `blocker-cleared` | **3** | recency descending, then §4.3 | `reason` |

**Horizon.** Coming up looks **14 calendar days** ahead in the reader's timezone — the
incumbent window (`home-data.ts:78`). My work's "This week" bucket is 7 days
(`selectors.ts:173-180`). The two windows may differ because they answer different questions,
**but each surface states its own window in words.** An unstated window is how "Coming up"
and "This week" came to look like the same broken section.

**Disjointness.** The four sections are mutually exclusive by `sourceKey`. An object in
Today's signal never also appears in Coming up or Needs review — the incumbent already does
this with `surfacedIds` (`home-data.ts:135`), and it moves inside the engine so it cannot be
skipped by a new caller.

**Completeness.** Coming up and Needs review are **capped views, not lists.** Each renders
the count it did not show and one route onward to `home.my-work`
(`CONTENT_OWNERSHIP.md` §7, S2/S3). Neither may render in a way that implies "that is all
of it", and `impliesCompleteness` is a declared property of the section, not a matter of
copy tone.

**Full briefing.** The same engine, the same pass, the same `asOf`, the same version —
rendering every candidate rather than the top three, with the caps lifted and the sections
unchanged. It is not a second view model. It is the same result object with a different
`limit`. That is what makes Charter rule 9 checkable rather than aspirational.

---

## 6. The read accounting

The product's whole claim is that it filters, so a numerator without a denominator is an
assertion rather than a receipt (`ledger-contract.ts:48-55`). The incumbent vocabulary is
adopted and **corrected in two places**.

```
read      objects examined in scope
flagged   distinct objects that crossed a rule, BEFORE any cap; synthetics excluded
shown     objects represented by the rows actually on screen
cappedOut flagged − shown            ← displaced by the cap
dismissed objects that crossed a rule and were suppressed by the reader
cleared   read − flagged − dismissed ← crossed nothing
```

**Correction 1 — `dismissed` is currently counted as `cleared`, which is false.**
`build.ts:62-67` applies `.filter(notDismissed)` to every detector *before* candidates reach
`bestByTask`, so a dismissed item never enters `triggeredCount` (`:196-198`). The ledger then
computes `cleared = read − flagged` (`ledger-contract.ts:292-301`). A reader who dismissed an
overdue task is told that item "crossed nothing". Under this contract `dismissed` is counted
separately, subtracted separately, and never folded into `cleared`.

**Correction 2 — `cappedOut` is named.** Work that crossed a rule and lost its slot to the
three-cap is **held back, not clear**. The incumbent already protects this by counting
`triggeredCount` before the cap; this contract requires the difference to be *rendered*, not
merely computed. "2 more crossed a rule and are not shown" is the minimum.

**The identity that must hold exactly:**

```
read = shown + cappedOut + dismissed + cleared
```

A reader who subtracts on the page always lands on a true number. If any term cannot be
computed — because a provider is `unavailable`, `partial` or `unsupported` — **the whole
accounting is withheld and the reason is named.** It is never partially rendered, and never
guessed. `readCountSentence` already refuses to emit anything when the count is absent
(`voice.ts:96-101`: no count in, no sentence out); this extends that refusal to the identity
as a whole.

---

## 7. Freshness and coverage thresholds

Adopted from the existing analytics vocabulary rather than reinvented — it is the only
honest one in the estate (`REPOSITORY_TRUTH.md:33-44`, audit A fixed input 5).

| Provider status | Meaning | Today's obligation |
|---|---|---|
| `ready` | read succeeded, inside its freshness window | render normally |
| `partial` | read succeeded for some of the scope | render, and state which part is missing |
| `stale` | read succeeded but is past `staleAfter` | render, and state the age in words |
| `unavailable` | read failed or was denied | **render no rows from it, and say so.** Never zero, never all clear |
| `unsupported` | no producer exists for this capability | say the capability is not connected. Never an empty section |

Source: `ProviderCoverageStatus` (`contracts.ts:227-232`), `ProviderCoverage`
(`:234-245`), `DataCoverage` (`:247-251`), `providerCoverage()`
(`providers/coverage.ts:9-31`), `combineCoverage()` (`:33-45`), `coverageFreshness()`
(`metrics.ts:944-966`).

**Sealed thresholds.**

| # | Rule |
|---|---|
| F1 | Freshness is derived, never asserted: `coverageFreshness(coverage)` is the single function. A surface may not compute its own. |
| F2 | The **Tasks** provider being `unavailable` makes the whole read `unavailable` (`coverage.ts:41`). Tasks is the spine; without it Today has no candidate set, and a Today built from Notes alone would silently redefine what "everything" means. |
| F3 | Any provider `stale` ⇒ the read is `stale`. Any provider not `ready` ⇒ at best `partial` (`coverage.ts:42-43`). Degradation is never averaged away. |
| F4 | `staleAfter` is per provider and set by the provider, not by Today. Today renders the age; it does not decide the threshold. |
| F5 | **Per-Project degradation is per-Project.** One unavailable Project does not make the aggregate unavailable, and does not make it complete either (PROJECT_SCOPE §5 rule 7). If N of M Projects resolved, Today says which N it read. |
| F6 | Coverage travels with the rows to the client. A DTO carrying rows and no coverage is invalid — not a rendering choice, a schema violation. |
| F7 | **Analytics history is `insufficient-history`, not zero.** `captureWorkspaceSnapshots` has zero callers repo-wide (`REPOSITORY_TRUTH.md:90-92`), so any trend, sparkline or comparison over history is unsupported until a writer exists. A flat line drawn through an empty table is the single most likely way Charter rule 11 gets broken by accident. |

---

## 8. Ordering stability

A ranked list that reorders itself under a reader is hostile in general and unusable for
anyone navigating by keyboard, screen reader or magnifier, where "the third row" is a
position they are holding in their head or under their cursor.

**Sealed rules.**

| # | Rule |
|---|---|
| ST1 | **The rendered order is frozen for the lifetime of the view.** Once a Today view renders, its row set and its order do not change until the reader explicitly refreshes. Not on poll, not on focus, not on tab visibility, not on a server push, not on `router.refresh()` fired by a background event. |
| ST2 | **One pinned `asOf`.** The entire read — every trigger, every relative date, every idle-day count, the greeting hour and the date line — is computed from a single instant carried in the result and re-used by every consumer. `buildBriefing`'s `now = Date.now()` default (`build.ts:50`) is removed and the parameter becomes required, so no code path can accidentally take a second clock reading mid-build. `home-data.ts` already reads `briefing.generatedAt` rather than calling `Date.now()` again (`:114`); this makes that discipline structural. |
| ST3 | **New data announces; it does not reorder.** When a newer result is available, Today shows a persistent, focusable **"Updates available"** control. Ranked content changes only when the reader activates it. |
| ST4 | **Never condition stability on focus or hover.** A web application cannot detect a screen-reader virtual cursor: a reader can be reading row 2 with the browser's focus still on the page body and no hover anywhere. "Pause reordering while focused" is therefore not a mitigation, it is a bet that the reader is using a mouse. The rule is unconditional freezing, which needs no detection and cannot be wrong. |
| ST5 | **Refresh replaces the whole view atomically**, and announces the change once — "Updated. Three items, two changed." — rather than announcing per row. Rows are keyed by `sourceKey`, so a row that survived a refresh keeps its identity for focus restoration. |
| ST6 | **Focus survives refresh.** If the reader's focus was inside a row that still exists, focus returns to that row. If it no longer exists, focus goes to the section heading and the change is stated in words. Focus never silently lands on a *different* row that happens to occupy the same index — the identity is `sourceKey`, never a position. |
| ST7 | **`prefers-reduced-motion` removes the transition, never the announcement.** Reduced motion is a request about movement, not a request for less information. |
| ST8 | **The same result is the same order everywhere.** Today, the Full briefing, an evidence drawer and a fixture capture render one result object in one order. No surface applies a display-time sort. |

**Consequence for the runtime.** Every `/app` route is `force-dynamic` today (22 files,
including `src/app/app/home/page.tsx:8`) and no caching primitive exists anywhere in the
repository (PROJECT_SCOPE §10.1 rule 4). Today does not introduce one. Stability is achieved
by pinning `asOf` and by *not re-fetching*, not by caching a result that authorization must
re-check. A restored view re-resolves Project state before rendering (D-H10); a re-resolve
that returns a different answer surfaces as ST3's "Updates available", never as a silent
swap.

---

## 9. Why each row appears — and when quiet language is prohibited

### 9.1 The reason

Every ranked row carries, without a click:

1. **The title**, sentence-cased and otherwise verbatim (`build.ts:260-263`). Nothing is
   appended — titles are imperatives, questions and shouts, and an observation glued onto one
   reads as broken English.
2. **One observation** about it, written to stay grammatical under any title
   (`phraseFor`, `build.ts:220-224`).
3. **Resolved provenance** — product and Project, from the record (§3 rule 2).
4. **Its age**, if it is a carry-over at day ≥ 2 (`build.ts:152-153`, `voice.ts:120`).
5. **Its freshness**, if the read is anything other than `ready` (§7).

And on request, the **`reasons`** panel (`triggers.ts:20-25`): one line naming the rule that
actually fired, and one line of evidence the headline had no room for. The incumbent's rule
for that panel is adopted verbatim and is a good rule: *every line must carry a fact the row
above did not already carry* (`triggers.ts:12-18`).

**Sealed additions.**

- The reason names the **rule**, never a score. "Signal flags anything quiet for three days
  or more" is a reason. "Priority 87" is not; it is the engine asking the reader to trust
  arithmetic they cannot see.
- The reason is **deterministic**. The same object under the same rule on the same day
  produces the same sentence. Rotation moves the phrasing per day, never per render
  (`build.ts:75`, `:312-319`).
- **AI may phrase; AI may not decide.** Charter rule 12. An AI-phrased line renders only over
  facts the engine already authorized, and is visibly attributed. It may not select which row
  appears, order rows, or judge priority, ownership, risk, health or completeness. The
  `llm-narration` kind survives as a *rendering* kind only (`CONTENT_OWNERSHIP.md` `DUP-4`
  clause 4).
- A row whose reason cannot be produced **does not render**. A ranked row with no explanation
  is the dashboard behaviour Charter rule 13 refuses.

### 9.2 When quiet, all-clear or reassuring language is PROHIBITED

This is the sharp edge of Charter rule 11, so it is stated as a prohibition list rather than
a principle. **Today may not say "nothing needs you", "all clear", "you're on top of it",
"nothing crossed a rule", or any equivalent, if ANY of the following is true:**

| # | Condition | Why |
|---|---|---|
| Q1 | Any provider in scope is `unavailable`, `stale`, `partial` or `unsupported` (§7) | The read is not complete, so "nothing" is a statement about the read, not about the work |
| Q2 | `read` could not be computed, or the §6 identity does not balance | No denominator, no claim. `voice.ts:96-101` already refuses; this generalises it |
| Q3 | `flagged > 0` — anything crossed a rule, including anything that only landed in Moving well | The incumbent already gets this right and the comment explains exactly why (`voice.ts:85-95`): a lone `just-shipped` item crosses a rule and lands in a bucket that renders nowhere, and the page used to claim nothing had crossed. The sentence must instead say what is true — something crossed, and it is not asking anything of you |
| Q4 | `cappedOut > 0` | Held back is not clear |
| Q5 | `dismissed > 0` | The reader silenced it; the system did not clear it. Silence chosen is not absence |
| Q6 | Any Project in Read Scope failed to resolve (`ProjectSetResult.coverage !== "complete"`, PROJECT_SCOPE §11.1) | "All clear across all projects" while one project is unreadable is the most expensive lie the surface can tell |
| Q7 | Any eligible `SourceKind` has no producer — which in v1 is always true of `calendar-event` (§2) | "Nothing today" cannot be said by a system that cannot see calendars |
| Q8 | Analytics history is empty because nothing writes snapshots (F7) | No history is not a good trend |
| Q9 | The reader's scope resolved to zero Projects, or resolved by the non-deterministic bare-entry fallback (PROJECT_SCOPE §4.2) | Home may not describe a non-deterministically chosen Project as "your project", so it certainly may not describe it as clear |

**What Today says instead.** The honest empty state has exactly three parts and is assembled
by the engine, not by the surface (`CONTENT_OWNERSHIP.md` §3.1 row B):

1. **What was read** — `read` and its scope, in words.
2. **What was not read** — every condition above that fired, named plainly.
3. **What is true** — either "nothing crossed a rule" (only when Q1–Q9 are all false), or the
   specific true statement, e.g. "Two things crossed a rule without asking anything of you."

When any of Q1–Q9 fires, the state is `coverage`, not `healthy` — a distinction the ledger
already carries (`ledger-contract.ts:43-46`) and which this contract makes mandatory rather
than available.

**And the inverse prohibition:** Today may not manufacture urgency either. If the engine
produced no rows and Q1–Q9 are all false, Today says so plainly. It does not fill the space
with a suggestion, a streak, a score, a chart or a prompt. Charter rule 13.

---

## 10. Executable assertions

Written as failing tests this wave at
`src/lib/home-layer/today/today-ranking-contract.test.ts`. 21 tests, all failing at this
base, each for the reason named in its own message. Each assertion below names the file:line
that makes it fail today.

**Verified.** With `CONTENT_OWNERSHIP.md` §9's eleven: `32 tests · 0 pass · 32 fail`, and
`tsc --noEmit` reporting zero errors in `src/lib/home-layer/today/` (see `TR-6`).

```
node --import tsx --test src/lib/home-layer/today/today-ranking-contract.test.ts
```

### 10.0 The interface the assertions bind to

The tests are the executable form of this interface, so it is stated here rather than left
to be inferred from them. `src/lib/home-layer/today/engine.ts` exports:

```ts
export const HOME_TODAY_RANKING_VERSION = "home-today-ranking@1.0.0";

export const TRIGGER_KINDS: readonly TriggerKind[];      // the eight of §4.2
export const TRIGGER_WEIGHTS: Record<TriggerKind, number>;

export const SECTION_LIMITS: Record<
  "todaysSignal" | "comingUp" | "needsReview" | "movingWell",
  { cap: number; impliesCompleteness: boolean; sourceRoute: string }
>;

export const STABILITY_POLICY: {
  freezeForViewLifetime: true;
  reorderTrigger: "explicit-user-refresh";
  pollIntervalMs: null;
  conditionsOnFocusOrHover: false;          // ST4 — structurally false, not configured false
  staleResultAnnouncement: "updates-available";
  rowIdentity: "sourceKey";
  reducedMotionDropsAnnouncement: false;
};

export function compareCandidates(a: Candidate, b: Candidate): number;  // total order, §4.3

export function rankToday(input: {
  candidates: WorkSignal[];
  asOf: number;                 // required — §8 ST2
  readState: ReadState;
  coverage: DataCoverage;       // required — §7 F6
  scope: HomeReadScopeResolved;
  limit?: "today" | "all";      // "all" is the Full briefing; same pass, cap lifted
}): TodayResult;

type TodayResult = {
  version: typeof HOME_TODAY_RANKING_VERSION;
  asOf: number;
  sections: Record<keyof typeof SECTION_LIMITS, RankedRow[]>;
  /** Null when any term is unknown. Never partially rendered, never guessed (§6). */
  accounting: {
    read: number; shown: number; cappedOut: number; dismissed: number; cleared: number;
  } | null;
  coverage: DataCoverage;
  /** §9.2. `blockedBy` names the Q-conditions that fired, so the surface can say
   *  WHY it is not claiming all clear instead of falling silent. */
  quiet: { allowed: boolean; blockedBy: Array<"Q1" | "Q2" | "Q3" | "Q4" | "Q5" | "Q6" | "Q7" | "Q8" | "Q9"> };
};
```

A deterministic fixture set (`engine.fixtures`) ships beside it — `mixedDay`, `sixFlagged`,
`allDismissed`, `quietDay`, and one fixture per Q-condition. Wave 2 owns the wider fixture
universe; these nine exist so the contract's own assertions are runnable without it.

| # | Assertion | Must fail today because |
|---|---|---|
| T1 | A single exported ranking entry point exists, versioned `home-today-ranking@1.0.0` | `src/lib/home-layer/today/engine.ts` does not exist |
| T2 | The comparator is a **total order** — no two distinct `SourceRef`s compare equal | the incumbent tie-breaks on bare `task.id` (`build.ts:306`), which is not unique across products |
| T3 | Ranking is a pure function of `(candidates, asOf, readState, version)` — two calls with identical inputs produce identical order | `buildBriefing` defaults `now = Date.now()` (`build.ts:50`) |
| T4 | `asOf` is required, and no code path inside the build reads a clock | `build.ts:50` |
| T5 | Today's signal is capped at 3 and reports `cappedOut` | the cap exists (`build.ts:19`) but nothing renders the difference |
| T6 | `read = shown + cappedOut + dismissed + cleared` holds exactly | `cleared = read − flagged` counts dismissed items as clear (`build.ts:62-67`, `ledger-contract.ts:292-301`) |
| T7 | Coming up and Needs review are produced by the engine, not by a filter over raw signals | `home-data.ts:137-171` filters and sorts independently |
| T8 | Coming up caps at 4, Needs review at 3, and both declare `impliesCompleteness: false` | no such declaration exists |
| T9 | Quiet language is refused when any of Q1–Q9 holds | `home-data.ts:176-192` emits an all-clear whenever `signalRows.length === 0`, with no coverage input at all |
| T10 | Rows carry a `ProviderCoverage`-shaped coverage statement | `buildBriefing` takes no coverage input (`build.ts:47-52`) |
| T11 | An eligible kind with no producer renders `unsupported`, never an empty section | `events` is hardcoded `[]` (`source.ts:271-273`) and nothing distinguishes that from "none" |
| T12 | `sourceLabel` is resolved from the record, and the literal `"Workspace"` never renders | `signal-build-for-user.ts:331` templates it |
| T13 | `priority` is read from the record | `signal-build-for-user.ts:320` hardcodes `2` |
| T14 | `blocker-cleared` and `doing-empty` exist as engine triggers | they exist only in `generate-nudges.ts:207-227` and `:243-255` |
| T15 | Exactly one module in `src/` assigns an attention rank | two do (`CONTENT_OWNERSHIP.md` `DUP-4`) |
| T16 | Today and the Full briefing render one result object in one order | two render paths exist behind a flag (`signal-brief-page.tsx:38-40`) |
| T17 | Every engine `Lane` value a Home section tests for is reachable from the source adapter | `review` is tested (`home-data.ts:161`) and unreachable (`source.ts:112-117`, `signal-build-for-user.ts:313-318`) |
| T18 | Refresh is explicit: no polling, no visibility-based, focus-based or hover-based reorder | nothing implements ST1–ST8 |

---

## 11. Decisions taken here

Local ids, so they cannot collide with a concurrent lane's `D-Hxx` allocation. The lead may
promote them into `DECISIONS.md`.

**TR-1 · Extend the incumbent engine; replace its source adapter wholesale.**
*Rationale:* the engine is pure, tested, already shared by both surfaces through
`captureSignals`, and already carries the honest-accounting vocabulary. Everything actually
broken — Tasks-only read, `events: []`, tag-synthesised projects, templated provenance,
fixed lane table, constant priority — lives in the adapter. Replacing the engine would
discard the sound half and keep the broken half. *Consequence:* §1.1's four additive
widenings and nothing else; a second `buildX` entry point is a veto.

**TR-2 · The final tie-break is `sourceKey`, not a bare id.**
*Rationale:* `a.task.id.localeCompare(b.task.id)` is a total order only while one product
feeds the engine. The day Notes or Timeline joins, two rows can compare equal and the
rendered order silently becomes database order. *Consequence:* `SourceRef` is required end to
end (`CONTENT_OWNERSHIP.md` §5), and T2 is the assertion that catches a regression.

**TR-3 · `dismissed` and `cappedOut` are counted separately and never folded into `cleared`.**
*Rationale:* the current arithmetic tells a reader who dismissed an overdue task that it
"crossed nothing", and tells a reader whose fourth item lost its slot that it was clear. Both
are false in the exact way Charter rule 11 exists to prevent, and both are invisible because
the page's own subtraction still balances. *Consequence:* the §6 four-term identity; a
withheld accounting when any term is unknown.

**TR-4 · Stability is unconditional freezing, not focus-aware pausing.**
*Rationale:* a web application cannot detect a screen-reader virtual cursor, so any rule
conditioned on focus or hover silently excludes the readers most harmed by reordering.
Unconditional freezing needs no detection and cannot be wrong. *Consequence:* ST1–ST8; an
"Updates available" control is a required Wave 4 primitive, not a Wave 9 polish item.

**TR-5 · Coming up and Needs review are capped ranked views, never inventories.**
*Rationale:* `CONTENT_OWNERSHIP.md` `CO-5`. They survive as sections because the near horizon
is genuinely part of "what deserves attention now"; they stop being independent filters
because two rankers is the veto. *Consequence:* both declare `impliesCompleteness: false`,
both render their suppressed count, both carry one route onward to `home.my-work`.

**TR-6 · The contract tests import their missing modules through a variable specifier.**
*Rationale:* a literal `import("./engine")` would turn `pnpm typecheck` red for every lane
sharing this branch, because `tsc` resolves literal specifiers statically. The wave rule asks
for tests that fail; it does not ask for a red typecheck, and a red typecheck is the more
disruptive of the two — it converts every other lane's next commit into an argument about
whose file broke the build. A variable specifier keeps `tsc --noEmit` clean while the tests
still fail at runtime with `ERR_MODULE_NOT_FOUND`, which is the failure the wave wants.
*Verified:* `tsc --noEmit` reports zero errors in `src/lib/home-layer/today/`; the 32 tests
across both contract files report 32 failures and 0 passes. *Consequence:* when the engine
lands, the specifier becomes a literal in the same commit.

**TR-7 · `calendar-event` is an eligible kind with no producer, and renders `unsupported`.**
*Rationale:* the alternative — omitting the kind entirely — makes "no events" and "we cannot
see events" indistinguishable, which is precisely the substitution Charter rule 11 forbids.
Naming the kind and marking it unsupported keeps the gap visible to users and to tests.
*Consequence:* Q7 fires in v1 for every reader, so the unqualified "nothing today" sentence
is unavailable until a calendar producer exists. That is the correct outcome, not a bug.

---

## 12. Open, and owned elsewhere

1. **`src/lib/projects/**` has not landed.** `ProjectId`, `resolveProjectRoute`,
   `listAuthorizedProjects` and the `isTaskDone`-with-real-config cross-Project read are all
   required by §2.1 and §3. Owner: `lane/wp2-project-platform` (PROJECT_SCOPE §13 item 1).
2. **The Notes extract eligibility surface.** Which structured objects qualify as
   `decision` and `follow-up`, and what the approved-extract boundary emits, is the Notes
   extraction contract's call, not this one. Owner: Wave 5 / Notes.
3. **Timeline milestone eligibility** depends on `resolveCanonicalTimeline`'s outcome set,
   including `owner-reconciliation-required`, which has no UI (`docs/wave/DECISIONS.md`
   D-017). Owner: `lane/wp1-timeline-safety`.
4. **Weights for the two promoted triggers (450, 300) are this contract's judgement, not
   measurement.** No user has stressed them. They are placed conservatively — below every
   dated signal — so that being wrong costs a missed nudge, never a displaced deadline.
   First real usage data should revisit them under a minor version bump.
5. **Where the weekly LLM recap lives** (`CONTENT_OWNERSHIP.md` §11 item 3). Whatever the
   answer, Charter rule 12 and §9.1's phrase-not-decide rule bind it.
6. **Runtime confirmation that `review` is unreachable in production** (`DUP-2`, T17). Read-
   verified at this base; a live check belongs to Wave 2's fixture and evidence harness.
