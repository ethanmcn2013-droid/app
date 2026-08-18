# Eval results — 2026-08-18, iteration 1

Four cases from `evals.json`, each run twice by the same model with the same
fixtures: once with this skill loaded, once with a baseline prompt that
describes the outcome but not the method. Graded programmatically where a
gate or file check could carry the judgment (grader re-ran the gates itself),
by reading the outputs where it could not. One run per configuration —
deltas are directional, not statistical.

## Headline

| | with skill | baseline |
|---|---|---|
| assertions passed | **20/20** | 17/20 |
| pass rate | 100% | 85.8% |

## Where the baseline actually lost

All three baseline misses are the same species: **invisible defaults** —
properties nobody asks for out loud, which the loop depends on later.

1. **No machine-readable design lock** (eval-0). The baseline's palette and
   rules lived in prose and inline HTML. Nothing automated could enforce
   them, so every later gate would have been an opinion.
2. **No state contract on the master** (eval-1 fixture had one pre-built;
   eval-0's baseline master answered no `?state=` or equivalent). Without
   it, panels and gates cannot drive the file — they can only look at it.
3. **No execution-mode declaration** (eval-1). The baseline presented seven
   "perspectives" without saying how they ran. One context role-playing
   seven seats is not blind review; the skill requires the mode to be
   declared (blind protocol or degraded blindness), and the honesty is the
   point.

Everything else, a strong model reconstructed ad hoc: it fixed the planted
defects, produced believable per-seat scores, wrote an honest session
record, and respected a foreign brand's palette. The skill's measured value
is not capability — it is the floor of invariants that hold when nobody is
asking.

## Eval-design caveats (read before trusting the numbers)

- **eval-1 pre-embeds skill scaffolding** (config, panel.json,
  interaction-check) in the fixture, so it measures protocol-following
  given the rig, not the delta of building the rig.
- **n=1 per configuration.** The 100% vs 85.8% split is evidence of the
  three specific misses above, not a stable rate.
- Both runs saw well-written prompts. A vaguer operator prompt would widen
  the gap in the skill's favour (the baseline only reconstructed the method
  because the eval prompt described the outcome precisely).

## What changed as a result

- No SKILL.md content changes: with-skill runs passed every assertion, and
  their RESULT.md files followed the doors, ladders, and honesty rules as
  written.
- The trigger description went through skill-creator's trigger-eval loop
  (20 queries, 10 positive / 10 negative) after these runs; see the PR
  description for the outcome.

## Reproducing

Definitions in `evals.json`. The grader re-ran `audit.mjs` and the lab's
`interaction-check.mjs` against final masters and `verify-artifact.mjs`
against report pages; string checks confirmed planted defects gone and
foreign palettes locked. Run directories follow skill-creator's benchmark
layout (`eval-N/{with_skill,without_skill}/run-1/grading.json`).
