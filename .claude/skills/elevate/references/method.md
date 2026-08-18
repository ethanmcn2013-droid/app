# The method

Six phases. Every engagement walks them in order; the doors in SKILL.md are
just entry points into this sequence. The founder appears exactly three
times — at the pick, at the lock, and at the close — and the loop runs
autonomously between those checkpoints.

## Why it is shaped this way

The method exists because two failure modes kill design work done by an
agent. The first is **taste without pressure**: one pass that looks good and
is full of defects nobody drove into. The second is **iteration without
honesty**: a loop that grades its own homework and drifts upward. Every
phase below is a counter to one of those. Directions force real alternatives
before commitment. The panel is blind so seats cannot anchor on each other.
The refuter kills flattering findings. The gates make regression impossible
to talk past. Scores are allowed to fall because a panel that only goes up
is not looking hard enough.

## Phase 0 · Brief

Everything starts from a one-page brief — `assets/templates/brief.md`,
filled in with the operator (interview them if invoking conversationally, or
accept a written brief). The brief is the ONLY carrier of context: target,
audience, fixture, states, palette, register, protected objects, and which
project contracts bind this engagement. The skill itself carries none.
If the operator's repo has design contracts (token files, naming rules,
review gates), they enter through the brief or they do not enter at all.

Launch checklist, before any work:

- The session runs with a permission mode that will not stall the loop on
  approval prompts (`--dangerously-skip-permissions`, or `acceptEdits` at
  minimum). A loop that stops to ask "may I write this file" 300 times is
  not a loop.
- A working branch exists for the engagement (`design/<name>-exploration`
  is the convention). Exploration only: no PR, no deploy, no app-code
  changes unless the brief says otherwise.
- Push the branch after every phase and after every round. Work that lives
  on one machine is one power cut from gone.

## Phase 1 · Reference

Capture the honest "before": the current surface (if one exists) at every
brief-listed state and viewport, with real fixture content and honestly
captured loading states. These frames are immutable for the engagement —
if the app changes underneath, the reference still records where the
exploration started. Skip this phase only when the target is greenfield.

## Phase 2 · Directions

Build 2–3 FULLY-RESOLVED directions as self-contained HTML artboards over
the real fixture and the real fonts. Fully resolved means every brief-listed
state exists in every direction — a direction that only has its hero state
is a mood board, not a direction. Each direction gets the written treatment
in `DIRECTIONS.md` (template in assets): thesis, what it deliberately
sacrifices, which standing decisions it breaks and the argument, additive
token proposals, candidate delight moments, and numbered zones so feedback
can name what it is reacting to.

Photograph every direction × state × viewport (`scripts/shots.mjs`), pack
the frames (`scripts/pack-shots.mjs`), build the comparison surface with
per-zone reaction controls and a copyable digest, publish it as an artifact.

**STOP. The pick is the founder's.** Do not proceed past this line without
a human choice between the directions.

## Phase 3 · Lock

Record the pick in a lock document (template in assets): what was chosen,
what was rejected, the founder's objections VERBATIM (the next round is
judged against them), which standing decisions the lock supersedes, and
what happens next. Then lock the palette — exact colours, exact weights,
exact ladders — into `elevate.config.json`, because from here the measured
gate enforces it mechanically.

## Phase 4 · Rooms and gates

Build the master: one file serving the locked direction as presets of named
design decisions (data attributes the file itself reads), so 2–3 finished
"rooms" are combinations, not copies. Then, BEFORE any panel round:

1. `scripts/audit.mjs` green — the measured gate (see references/gates.md).
2. The engagement's `interaction-check.mjs` green — the behaviour gate,
   grown from the skeleton the scaffold planted.
3. Build and publish both artifacts (see references/artifacts.md): the
   Design Console and the Elevation Log, empty of rounds but live.

The sequencing is not optional style. The first engagement built its
behaviour gate at round 6 and paid three seats' worth of score at round 5
for defects invisible in screenshots. The second built gates first and its
round 1 opened 0.7 lower — which was the truth arriving earlier, at a lower
price.

## Phase 5 · The elevation loop

Each round, in order:

1. **Re-shoot** the current master (all states, the grading viewport at
   minimum; all viewports if anything responsive changed).
2. **Panel** — seven blind seats in parallel, then a refuter per finding
   (protocol in references/panel.md). Generate the round runner with
   `scripts/panel-round.mjs`.
3. **Fix every confirmed finding.** All of them, before anything is
   re-scored. There is no cherry-picking; a survivor is work.
4. **Verify each fix rendered.** Re-open the file, look at the element the
   finding named, assert the change is visible. A fix that was written but
   never rendered has happened once already: it was aimed at the wrong
   file, failed silently, and five seats measured the same defect twice the
   next round. Grow the behaviour gate with an assertion per fixed defect
   class while the defect is fresh.
5. **Run both gates.** Exit non-zero means the round is not over.
6. **Record the round** in `panel.json` (shape in references/artifacts.md):
   scores, counts, headline, worst findings as problem → done.
7. **Rebuild and republish both artifacts** to their existing URLs, and
   **push the branch.** The artifact timestamps are the heartbeat that lets
   the founder read progress from anywhere; breaking the rhythm breaks
   their trust in the numbers.

The loop continues without asking permission. It ends only two ways:

- **Gate met** — every seat at or above the gate. Not an average. Ever.
- **Honest distance** — the panel converges (refutation rate climbs, seats
  agree within a few tenths) below the gate, and every seat can state
  plainly what stands between the work and the grade, sized in hours or
  days. That is a legitimate, valuable ending. What is never an ending is
  a quietly inflated score.

## Phase 6 · Close

Build the Session Record (anatomy in references/artifacts.md): the number,
the arc, what exists now, the honest distance itemised with sizes, and the
founder's 15-minute next-actions list. Publish it, push everything, and
put the decision back in the founder's hands: lock at this standard, spend
the distance now, or move to the next surface.
