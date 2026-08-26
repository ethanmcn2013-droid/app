# Where this engagement stands

Written so a fresh session can pick it up without the previous one's
context. Everything below is on disk and pushed; nothing here lives only in
a transcript.

**Branch `design/home-analytics-2026-08` @ 45691be7, pushed. Working tree
clean. Both gates green. Rounds 1 and 2 recorded in `panel.json`.
Round 3 — the close — has not started. The freeze is declared.**

## The engagement

`elevate`, full door, on **Lately** — the analytics view inside Signal
Studio's Home. Budget **3 rounds**, declared before round 1. Read `brief.md`
and `lock.md` first: they carry the three folds and the decisions that may
not be re-opened.

## The four published artifacts — republish to these URLs, never new ones

| Slot | URL | Built from |
|---|---|---|
| Surface | https://claude.ai/code/artifact/9973453b-6d1b-4f10-88fb-c626e1e286e6 | `surface.html` ← `node build-surface.mjs` |
| Plan | https://claude.ai/code/artifact/a3ebb330-0445-4265-ab66-503458fb80f6 | `plan.html`, unchanged since handover |
| Design Console | https://claude.ai/code/artifact/d894ef6e-3018-4f05-a64e-66dc966396c8 | `console.html` ← `build-console.mjs` |
| Elevation Log | https://claude.ai/code/artifact/885389f0-bebd-4420-a950-56e9cb307273 | `report.html` ← `build-report.mjs` |

## Running anything

`@playwright/test` resolves **only** from
`C:\Users\ethan\signal-studio-workspace\collateral`. Run the skill's scripts
with that as the working directory and pass an absolute `--lab=`. The
behaviour gate runs from the lab directory itself and resolves Playwright by
walking up. **It takes about four minutes — always run it in the background
to a log file**, then poll the log.

```
LAB="C:\Users\ethan\signal-studio-workspace\_wt-home-analytics\docs\design\labs\home-analytics-2026-08"
SK="C:\Users\ethan\.claude\skills\elevate\scripts"
COL="C:\Users\ethan\signal-studio-workspace\collateral"

cd "$LAB" && node derive-fixture.mjs --check
cd "$LAB" && node interaction-check.mjs > panel/gate.log 2>&1     # background it
cd "$COL" && node "$SK/audit.mjs"          --lab="$LAB" --v=light
cd "$COL" && node "$SK/audit.mjs"          --lab="$LAB" --v=dark
cd "$COL" && node "$SK/shots.mjs"          --lab="$LAB" --v=light,dark --twice
cd "$COL" && node "$SK/pack-shots.mjs"     --lab="$LAB"
cd "$COL" && node "$SK/ledger.mjs"         --lab="$LAB" --check
cd "$COL" && node "$SK/round-metrics.mjs"  --lab="$LAB"
```

## The method as run here — follow this, it is load-bearing

- Seats come from `panel-round.mjs --mode=prompts`, then run as **parallel
  subagents, one per seat prompt**, each told to read its prompt file in
  full and write the JSON to the path the file names. Append an environment
  note to each prompt first: where Playwright resolves, use the scratchpad
  not the lab for throwaway scripts, and `?motion=play` to watch the
  entrance. The concurrency cap is 20 agents.
- Findings are **clustered before refutation** into
  `panel/clusters-round-N.json` — the same defect seen by several seats
  becomes one claim, every alias kept, so convergence is recorded as
  evidence rather than as duplicate work. Then
  `node panel/make-refuters.mjs round-N` writes one prompt per cluster.
- **One fresh refuter per cluster**, defaulting to REFUTED. Never tell a
  refuter how many seats converged — it anchors them toward confirming.
- A refuter that returns `real: false` **but affirms the problem and gives a
  sharpenedFix** is recorded as confirmed carrying the refuter's fix. Pass
  those ids to `record-round.mjs --replaced=`. The alternative — a real,
  correctly-classed defect dying because the seat's wording did not fit a
  pill — would let the engagement close over defects nobody disputes.
- Assertions are authored in `panel/round-N-batchM-assertions.js` **with an
  editor tool** and spliced by `panel/append-assertions.mjs`. Never through
  a heredoc: it ate escapes twice in this engagement alone.
- Fixes are applied by `panel/fix-*.py`, exact string replacement, no regex.
  **Note the trap:** those scripts' `edit()`/`sub()` helpers write only after
  every replacement matches, so one MISS silently discards the whole batch.
  Check the output lines, not just the exit.

## Round 1 — closed, recorded, published, pushed

7 seats · 69 raised · 37 distinct · 29 confirmed · 8 refuted (22%)
· 0 blocking · 6 misleading · 22 defect · 1 refinement
· self-inflicted 0% · not frozen · gate 122 → 366.
Floor 7.0, ceiling 8.3, spread 1.30.

## Round 2 — closed, recorded, published, pushed

3 rotating seats (evidence, interaction, UX) · 26 raised · 19 distinct
· 14 confirmed · 5 refuted (26%)
· **0 blocking · 0 misleading** · 13 defect · 1 refinement
· **self-inflicted 36%** · not frozen · gate 366 → 461.
Floor 7.6, ceiling 8.3, spread 0.70. No seat signed off in either round.

Scores moved: interaction 8.3 → 8.2, UX 7.0 → 8.3, evidence 7.2 → 7.6.

## Round 3 — the close. NOT STARTED. Do this next.

1. **The freeze is declared.** Any finding whose answer is "build X" is
   recorded on the port packet and never remediated in-round. Record
   `--frozen=true` for round 3.
2. Full **seven** seats — the method requires seven at round 1, at an audit
   and at the close. Generate with
   `panel-round.mjs --lab="$LAB" --round=3 --final --mode=prompts --notes=<file>`.
   Write the notes file first: what changed in round 2, and the decisions
   seats should argue with rather than file as misses (see
   `panel/round-2-notes.md` for the shape).
3. Cluster, refute, fix in batches of eight, gates between batches.
4. `node panel/record-round.mjs 3 --assertions=<n> --selfInflicted=<measured> --frozen=true --replaced=<ids> --headline="..."`.
   **Measure the self-inflicted share, do not estimate it** — count confirmed
   clusters flagged `selfInflicted` in `clusters-round-3.json` over confirmed
   total, the way round 2's 36% was computed.
5. `ledger.mjs --check`, `round-metrics.mjs`, republish all four artifacts,
   commit, push.
6. Then the three closing documents and the port packet — `references/
   artifacts.md` and `references/handover.md` in the skill.

## The ledger, and the honest position — say this plainly

The ending is two consecutive rounds with no confirmed `blocking` or
`misleading` finding, both gates green, on a **frozen** configuration, with
self-inflicted **under 25%** in both.

Round 2 is clean on severity but fails two clauses: it was not frozen, and
self-inflicted was 36%. So the earliest the ledger could close is round 4,
which is outside the declared budget of 3.

**The engagement stops on its budget with a stated remainder.**
`stopping.md` calls that finished work provided the distance is published.
Do not imply a close that has not happened, and do not quietly extend the
budget — that is the operator's call, not the session's.

## Two things the panel found in the gate itself

Worth more than the defects that exposed them. All four are now measured
from rendered state:

1. R1's `the unfinished week is hatched, open-topped` measured
   `borderBottomWidth` — the edge sitting on the baseline, invisible — and
   so certified the opposite of the protected contract it guarded.
2. R1's `every control acknowledges a press` grepped `document.styleSheets`
   for the selector text and never rendered it. It passed on a rule that an
   animation's `fill-mode: both` had pinned dead.
3. R1's three skeleton-geometry assertions built the loading DOM and the
   arrived DOM from the same fixture in the same frame and compared them to
   each other. They could not fail. Driven against a client holding no
   reading — the condition the loading state exists for — the master threw.
4. Two of my own assertions were wrong before they were trusted: one read
   `document.body.textContent` and matched a template's own source rather
   than the page; one used `elementFromPoint` on a strip below the fold and
   reported every mark stolen at every width.

**When adding an assertion, the test is: would this fail if the thing it
guards were broken?** If you cannot make it fail on purpose, it is not a
rule yet.

## Known open — for the port packet

- **The chart's context columns sit at 1.48:1 (light) and 1.70:1 (dark)**
  against the card, under the 3:1 non-text floor. The obvious fix inverts
  the chart: the current week is a hatch that composites to 1.71:1, *fainter*
  than the columns it would be contrasted against, so darkening the columns
  alone makes the live mark the weakest thing in the frame. The strip half
  was fixed — a ring for quiet marks, solid past the fortnight — which
  clears the floor without leaning on hue. The chart half needs a design
  decision, not a token swap. Measurements in
  `panel/round-2/refuters/chart-and-strip-marks-fall-under-the-non-text-floor.json`.
- **No destination for a filtered list of open work.** The hero stopped
  claiming a finished job is openable (r1); the KPI row stopped offering
  link roles that append a bare `#` (r2). The affordance ships when the
  destination does.
- **A designed retry.** `#retry` is unwired, like every control on this
  master. Needs live wiring the lab does not have.
- **Per-column values on the twelve-week chart.** All twelve are named in
  the chart's spoken line; twelve 22px buttons would fail the hit-target
  floor at 390 and triple the keyboard path of a reading surface.
- **A bound record-start instant**, if the refusals are ever to name a date.
  The fixture holds none, and inventing one would be the defect the
  derivation exists to prevent.
- **Nobody owns the port.** Three prior engagements, forty-five rounds,
  1,358 findings, 919 fixes, **zero shipped pixels**. This engagement ends
  with a port packet a separate build session lands. Say so to the operator
  before round twelve, not after.
