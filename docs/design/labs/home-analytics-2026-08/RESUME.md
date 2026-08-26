# Where this engagement stands

**CLOSED at round 3, on budget, with the distance published. The ledger did
NOT close. Both gates green: measured 0 violations on both grounds,
behaviour 506 assertions 0 failing. All seven artifacts published and the
family contract holds. Nothing is in flight.**

Written so a fresh session can pick this up without the previous one's
context. Everything below is on disk and pushed.

## The engagement

`elevate`, full door, on **Lately** — the analytics view inside Signal
Studio's Home. Budget **3 rounds**, declared before round 1 and spent.
`brief.md` and `lock.md` carry the three folds and the decisions that may
not be re-opened. `PORT-PACKET.md` is the deliverable.

## The seven published artifacts — republish to these URLs, never new ones

| # | Slot | URL | Built from |
|---|---|---|---|
| 01 | CEO Report | https://claude.ai/code/artifact/bbc3c970-d680-4065-ad45-10cbedadd30f | `ceo.html` ← `_ceo.body.html` + `_family.css` |
| 02 | Design Console | https://claude.ai/code/artifact/d894ef6e-3018-4f05-a64e-66dc966396c8 | `console.html` ← `build-console.mjs`, then `family.mjs --apply` |
| 03 | Elevation Log | https://claude.ai/code/artifact/885389f0-bebd-4420-a950-56e9cb307273 | `log.html` ← copy of `report.html` ← `build-report.mjs`, then `family.mjs --apply` |
| 04 | The Honest Distance | https://claude.ai/code/artifact/63088e5d-51d5-4a70-ac35-e804bdd2f3eb | `question.html` ← `_question.body.html` + `_family.css` |
| 05 | 3 Rounds | https://claude.ai/code/artifact/c7863a3d-bdf7-4677-bab5-58279265b1cf | `method.html` ← `_method.body.html` + `_family.css` |
| — | Surface | https://claude.ai/code/artifact/9973453b-6d1b-4f10-88fb-c626e1e286e6 | `surface.html` ← `node build-surface.mjs` |
| — | Plan | https://claude.ai/code/artifact/a3ebb330-0445-4265-ab66-503458fb80f6 | `plan.html`, unchanged since handover |

**The fixed set names `log.html`, not `report.html`.** `build-report.mjs`
writes `report.html`; copy it to `log.html`, then run `family.mjs --apply`,
or `family.mjs --check` fails on a missing file and a stripped rail.
`build-console.mjs` likewise overwrites the rail — always re-apply after a
rebuild.

## Running anything

`@playwright/test` resolves **only** from
`C:\Users\ethan\signal-studio-workspace\collateral`. Run the skill's scripts
with that as the working directory and pass an **absolute** `--lab=` — and
for `verify-artifact.mjs` an **absolute `--file=`**, because it resolves the
file against the cwd and not against `--lab`. The behaviour gate runs from
the lab directory itself.

```
LAB="C:\Users\ethan\signal-studio-workspace\_wt-home-analytics\docs\design\labs\home-analytics-2026-08"
SK="C:\Users\ethan\.claude\skills\elevate\scripts"
COL="C:\Users\ethan\signal-studio-workspace\collateral"

cd "$LAB" && node derive-fixture.mjs --check
cd "$LAB" && node interaction-check.mjs > panel/gate.log 2>&1   # ~5 min
cd "$COL" && node "$SK/audit.mjs"          --lab="$LAB" --v=light
cd "$COL" && node "$SK/audit.mjs"          --lab="$LAB" --v=dark
cd "$COL" && node "$SK/shots.mjs"          --lab="$LAB" --v=light,dark --twice
cd "$COL" && node "$SK/pack-shots.mjs"     --lab="$LAB"
cd "$COL" && node "$SK/ledger.mjs"         --lab="$LAB" --check
cd "$COL" && node "$SK/round-metrics.mjs"  --lab="$LAB"
cd "$COL" && node "$SK/family.mjs"         --lab="$LAB" --check
cd "$COL" && node "$SK/verify-artifact.mjs" --file="$LAB\ceo.html"
```

**Backgrounding the gate is unreliable here** — the process is killed when
the tool call's notification fires, truncating the log. Run it in the
foreground with a long timeout; it takes about five minutes.

## The three rounds

| r | seats | floor | ceil | spread | raised | distinct | conf | refut | blk | mis | def | ref | self | frozen | gate |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 7 | 7.0 | 8.3 | 1.30 | 69 | 37 | 29 | 22% | 0 | 6 | 22 | 1 | 0% | no | 366 |
| 2 | 3 | 7.6 | 8.3 | 0.70 | 26 | 19 | 14 | 26% | 0 | 0 | 13 | 1 | 36% | no | 461 |
| 3 | 7 | 8.6 | 9.1 | 0.50 | 36 | 28 | 21 | 25% | 0 | 0 | 14 | 7 | 67% | yes | 506 |

Totals: 17 seat sittings, 131 raised, 84 distinct, 64 confirmed and fixed,
20 refuted. Gate 122 → 506. Round 3 sign-offs: Measured evidence, Product
taste, UX. Four seats did not sign off.

## Why it stopped — say this plainly, do not soften it

The ending is two consecutive rounds with no confirmed `blocking` or
`misleading`, both gates green, on a **frozen** configuration, with
self-inflicted **under 25%** in both.

Severity is clean and has been for two rounds. Two clauses fail: round 2 was
not frozen, and self-inflicted ran 36% then 67%. `round-metrics.mjs` reaches
the conclusion itself:

> two consecutive rounds above 25% self-inflicted. The loop is measuring the
> fixer, not the work — stop and publish the honest distance.

`stopping.md` calls stopping on budget finished work **provided the distance
is published**. It is, in `question.html` and in `PORT-PACKET.md` §5.
**Do not restart the loop to chase the ledger.** A fourth round would find
the third round's repairs, which is what the 67% is telling you.

## The method as run here

- Seats from `panel-round.mjs --mode=prompts`, run as **parallel subagents,
  one per prompt**, each told to read its prompt in full and write JSON to
  the path the file names. Append the environment note first. **The
  concurrency cap is 20** — round 3 needed 28 refuters, so they went in
  waves with the queue tracked in `panel/round-3/refuters/PENDING.txt`.
- Findings are **clustered before refutation** into
  `panel/clusters-round-N.json`, every alias kept.
- **One fresh refuter per cluster**, defaulting to REFUTED, never told how
  many seats converged.
- **The adjudication rule, stated before the count so it cannot be fitted to
  it** (`panel/round-3/ADJUDICATION.md`): a refuter returning `real: false`
  is recorded as confirmed-carrying-the-refuter's-fix only when it affirms a
  problem that survives its own criticism **and** prescribes a fix
  unconditionally. A conditional "if the panel wants X" is the refuter
  declining to require a change, and the finding stands refuted. That rule
  produced a 25% refutation rate, in line with r1's 22% and r2's 26%.
- **Measure self-inflicted, never estimate it.** Grep `panel/fix-*.py` for
  each exact string, and demote every case where a script used the string as
  an **anchor** rather than introducing it — that check moved five claims
  from self-inflicted to not in round 3 alone.
- Assertions authored in `panel/round-N-batchM-assertions.js` **with an
  editor tool** and spliced by `panel/append-assertions.mjs`. Never a
  heredoc, and never `node -e` through the shell — both halve backslashes in
  this environment. Prove a regex from a **file**.
- Fixes applied by `panel/fix-*.py`, exact string replacement, no regex.
  **The trap:** `edit()` writes only after every pair in a call matches, so
  one MISS silently discards the whole call and everything after it. It
  fired twice in round 3. Read the output lines, not the exit code.

## What round 3 found, and it is mostly about the instrument

**Eleven assertions in this gate could not fail** — four found in rounds
1–2, seven more at the close, every one guarding a finding already recorded
closed. The full table is in `PORT-PACKET.md` §2. The worst: `"\\\\b"` —
four source backslashes — compiles to a literal backslash followed by `b`,
so two guards matched nothing across four states each.

**Four of the five red lines in round 3's own verification were new probes
of mine measuring the wrong thing**: a heading selected by tag in a state
that heads with a paragraph; a selection measured with `containsNode`, which
is DOM geometry and blind to `user-select`; a concord check keyed on a row
that state does not have; a click driven through `locator.click()`, which
scrolls its own target into view and then reads the scroll back as the
defect. All four were caught by running them.

**When adding an assertion, the test is: would this fail if the thing it
guards were broken?** If you cannot make it fail on purpose, it is not a
rule yet. Round 3 added a liveness probe beside each repaired regex for
exactly this reason.

## Two bugs fixed outside the lab

Both were found by running the artifact verifier, which had not been run
since round 2:

1. **`assets/report.shell.html` in the skill** threw on any engagement that
   follows the method's own rotating-seat rule: the round chart iterated
   every declared seat across every round and called `.toFixed()` on the
   result, so a seat that skipped a round killed the page on load. Fixed at
   source and in the lab's copy — an absent score is a gap, never a zero,
   and the delta spans the rounds the seat actually sat.
2. **`plan.html` carried no viewport meta.** Harmless in publication — the
   artifact wrapper injects one — but it made the file's own phone checks
   vacuous, which is precisely `lessons.md` L-14.

## Known open — for the port packet

`PORT-PACKET.md` is the deliverable and carries all of this in full: the
frozen configuration, both gates, the decision list, the deferred builds,
the open ledger, nine port risks and the frames.

- **One item confirmed and unfixed on the surface:** the chart's context
  columns at 1.48:1 (light) and 1.70:1 (dark) against the 3:1 non-text
  floor. The obvious fix inverts the chart — the live week is a hatch at
  1.71:1, fainter than the columns it would be contrasted against. Needs a
  design decision. `audit.mjs` does **not** grade non-text contrast; a green
  measured gate is not a 1.4.11 pass.
- **Five deferred builds**, none of them work done badly: a destination for
  a filtered list of open work, a wired retry, the chart-wide contrast
  answer, per-column values that would not cost twelve tab stops, and a
  bound record-start instant.
- **Nobody owns the port.** Four engagements, forty-eight rounds, 1,442
  findings, 983 fixes, **zero shipped pixels**. This one ends at a port
  packet a separate build session lands. If that session is not named, this
  makes four.
