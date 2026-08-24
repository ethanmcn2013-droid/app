# Notes · the gate method · replacing the panel loop at round 10

**Changed by the founder's instruction, 2026-08-24.** Branch
`design/notes-exploration`. The elevation loop that ran rounds 1 to 9 is
retired. This records what it did, why it could not finish, and what
replaces it.

## What the old loop actually did

Nine rounds. 189 distinct findings confirmed by an adversarial refuter
and fixed. The floor moved 5.6 → 8.2 over seven rounds, reset to 6.4
when the benchmark bar changed at round 8, and stood at **7.1** after
round 9.

| round | floor | ceiling | confirmed | refuted |
|---|---|---|---|---|
| 1 | 5.6 | 6.3 | 30 | 5 |
| 2 | 5.7 | 7.1 | 22 | 13 |
| 3 | 6.1 | 7.4 | 26 | 9 |
| 4 | 7.2 | 7.6 | 25 | 10 |
| 5 | 7.1 | 8.2 | 24 | 11 |
| 6 | 8.0 | 8.6 | 23 | 12 |
| 7 | 8.2 | 8.4 | 24 | 11 |
| 8 | 6.4 | 8.6 | 21 | 13 |
| 9 | 7.1 | 8.2 | 20 | 15 |

## Why it could not finish

**1. The panel was contractually unable to pass.** The seat schema
carried `findings: { minItems: 3, maxItems: 5 }`. Seven seats × three is
twenty-one, and the observed minimum confirmed count across eight
recorded rounds is **exactly twenty-one**. A seat that believed the work
had reached the bar was still obliged to produce three defects. A
unanimous 9.5 was arithmetically unreachable no matter how good the
artifact became. This is the single reason nine rounds of honest work
never converged.

**2. The work missed the binding constraint.** The gate is the lowest
seat. Across eight rounds the floor seat rotated through five different
seats — Interaction, Evidence, Typography, Typography, Taste,
Interaction, UI, Taste — while every round fixed the findings of all
seven. Most of the fixing each round could not raise the score, by
definition.

**3. The loop manufactured its own defects.** Round 9 confirmed twenty
findings and four were caused by round 8's fixes: a lede regex whose
`\s` was lost to shell escaping, silently disabling the whole rule and
being reported as a design outcome; a sentence-click handler that made
the word-safe drag shipped in the same batch unreachable; a desk budget
that forgot the peel and drove the index to nothing at 1440×960; and a
gate rule that failed `visibility:hidden` — the correct technique —
while never checking `opacity:0`, the real defect. A 20% self-inflicted
rate, all of it from landing twenty-odd fixes in one batch and running
the gates once at the end.

**4. It graded and shot work that was not the product.** The shot
harness rendered rooms `r1`, `r2`, `r3` from `v=a|b|c`. None of those is
a key in `PRESETS`, so all three fell back to the locked preset, and no
CSS keys off `data-variant`. Verified by checksum: **36 of each room's
40 frames were byte-identical to the locked frames.** The four that
differed were the dictation frames, which differed between any two runs
because the waveform used `Math.random()`. Every round shot and
committed **120 duplicate PNGs, 26MB**, for three rooms that do not
exist.

## What replaces it

**The configuration is locked to one.** `?v=locked` — stacked pile, airy
index, soft corners, subtle indigo, calm type. The founder's chosen
preset, and already the default. The three phantom rooms are deleted
from the shot harness and their frames removed. The dictation waveform
is driven by a frame counter instead of `Math.random()`, so a changed
frame now means changed work.

**`scripts/design/notes-gate-round.js`** replaces
`notes-panel-round.js`:

- **No quota.** `blockers` is `minItems: 0`. Every seat states a
  `signOff` boolean — would you put your name to this at 9.5 — and a
  one-sentence verdict. A seat that thinks the work is finished says so
  and returns nothing. This is what makes the gate reachable.
- **Only the floor raises blockers.** After grading, the seats within
  0.3 of the floor are the binding constraint; only their blockers go to
  refutation. Seats above the floor are recorded and parked, because
  fixing them cannot move the gate.
- **The closed ledger goes to every seat and every refuter.**
  `scripts/design/notes-ledger.mjs` emits all 189 fixed ids. Re-raising
  one without evidence of an actual regression is refuted on sight. Six
  ids had already been fixed twice.
- **The refuter judges the fix, not just the problem.** It must say what
  the proposed fix would plausibly break and what to re-measure after it
  lands — the check that would have caught rounds 8 and 9 breaking their
  own adjacent work.
- **Real gestures.** The bar now requires pointer claims to be driven
  with real mouse and touch events. Round 9 found the primary pick
  gesture completely broken while the behaviour gate passed, because the
  gate proved it with a scripted `Selection` instead of a drag.

**The fix protocol changes.** One blocker at a time, with
`node scripts/design/notes-gates.mjs` between each — all three gates,
one command, one line. Not twenty fixes and one gate run at the end.

## What is unchanged

The direction lock, the architecture, the three-colour lock, Geist
400/600, the copy rules, the voice disclosure, the 9.5 bar, the five
benchmarks, the adversarial refuter defaulting to REFUTED, the two
gates exiting zero, and the score being the lowest seat.
