---
name: elevate
description: Run a design-elevation engagement that takes a UI to a world-class bar — a blind seven-seat review panel with adversarial refuters, looping fix-rounds against a unanimous 9.5/10 gate, with automated measured/behaviour gates and two living artifacts (a Design Console and an Elevation Log) republished every round. Use whenever the user wants UI, UX, or product design elevated, panel-reviewed, scored, or taken to "world class" / "9.5" / "award level"; wants design directions explored and compared for a founder pick; says "elevate", "elevation loop", "design panel", "the seats", "run a round", "elevation log", or "design console"; or wants to resume, check, or close-out an existing elevation engagement (one more round, a status report, a session record). Also use when asked to set up the lab, gates, brief, or scaffolding for such an engagement. Not for one-off small CSS fixes, logo/illustration creation, or writing marketing copy on its own.
---

# Elevate

Take a surface to a world-class bar by a method that has already proven
itself: real alternatives before commitment, a blind panel under an
adversarial refuter, automated gates that make regression impossible to
talk past, and honest scores that are allowed to fall. Everything below is
the operating manual; the deep protocol lives in `references/` and the
tooling in `scripts/` — load each reference at the phase that needs it,
not all at once.

## The four doors

Decide which door the request is, then follow its workflow. When unsure
between full and explore, ask which the operator wants; never guess past
a founder checkpoint.

| Door | The request sounds like | You run |
|---|---|---|
| **full** | "elevate X", "take X to world class" | Phases 0–6, stopping at the pick and the lock |
| **explore** | "explore directions for X", "give me options" | Phases 0–2, ending at the founder pick |
| **round** | "run a round", "keep going", resuming a lab that exists | One loop iteration (Phase 5), then continue looping |
| **report** | "where does it stand", "close it out" | Status or Session Record from `panel.json` |

An existing engagement is recognised by its lab directory containing
`elevate.config.json`. `round` and `report` NEVER re-open decisions the
lock document records — a resumed session reads `brief.md`, the lock, and
`panel.json` before touching anything.

## Non-negotiables (the engine)

These are what make the method work; a run that drops one has left the
skill. Everything contextual — palette, states, gate height, protected
objects — is the brief's to set (`references/brief-template.md`).

1. Seats are blind: parallel, no shared context, never told prior scores.
2. Every finding meets a fresh refuter that defaults to REFUTED.
3. Every confirmed finding is fixed before anything is re-scored, and
   every fix is verified RENDERED, not just written.
4. Both gates are green before round 1 and after every round.
5. Grading drives the real file from round 1; frames alone never grade.
6. The gate is unanimous — the score is the lowest seat, never an average.
7. Scores may fall. A panel that only rises is not looking hard enough.
8. Both artifacts republish to stable URLs every round; the branch pushes
   every round.
9. The two honest endings are "gate met" and "distance itemised". There
   is no third.
10. Seats have NO finding quota. An empty findings array is the expected
    answer for a finished surface; a minimum guarantees the floor can
    never rise (`references/panel.md`, "The quota that cannot converge").
11. The ending is mechanical, not an opinion-minimum: two consecutive
    rounds with no confirmed finding at or above 0.3, both gates green,
    on the SHIPPING configuration. Scores are reported, never the
    trigger — the minimum of seven fresh adversarial samples measures how
    hard the panel looked, not how good the work is.
12. Grade the configuration that will ship and its ground-flipped twin,
    and nothing else. Rooms nobody will see cost a third of every round
    and produce findings about work that will never exist.
13. Triage before spending a refuter: auto-reject anything already on the
    settled ledger, batch anything under 0.2, refute the rest one to one.
14. Structure freezes. Once the loop is in polish an architectural change
    goes on a named build list for the founder to schedule — each one
    seeds the next round's findings and restarts the clock.
15. Every fix ships with its gate assertion written FIRST and failing.

## Door: full (and explore)

Work through `references/method.md` phase by phase. In brief:

0. **Brief** — write it with the operator (`references/brief-template.md`),
   check the launch checklist (permission mode that won't stall the loop;
   working branch), then scaffold:
   `node <skill>/scripts/scaffold.mjs --name=<slug> --dir=<labs-parent>`
1. **Reference** — capture the honest "before" of any existing surface.
2. **Directions** — 2–3 fully-resolved artboards over the real fixture,
   argued in `DIRECTIONS.md`; shoot (`scripts/shots.mjs`), pack
   (`scripts/pack-shots.mjs`), build the comparison surface, publish it.
   **STOP — the pick is the founder's.** (`explore` ends here.)
3. **Lock** — record the pick and the founder's verbatim objections in the
   lock doc; copy the final palette/ladders into `elevate.config.json`.
4. **Rooms and gates** — one master serving the rooms as presets of named
   decisions; then gates green BEFORE any panel: `scripts/audit.mjs`, the
   lab's `interaction-check.mjs` (grown from the planted skeleton), and
   both artifacts built and published (`references/artifacts.md`).
5. **Loop** — see Door: round. Loop autonomously until an ending.
6. **Close** — Session Record, push, hand the decision back.

## Door: round

Load `references/panel.md` and `references/gates.md`. One round =

1. Re-shoot current states: `node <skill>/scripts/shots.mjs --lab=<lab>`
2. Generate the round: `node <skill>/scripts/panel-round.mjs --lab=<lab>
   --round=<n> [--notes=<file>]` — emits a Workflow script (preferred; run
   it with the Workflow tool) or, with `--mode=prompts`, seat-prompt files
   for subagent/sequential execution. Seed every seat with
   `references/lessons.md`.
3. Fix every confirmed finding; verify each rendered; add a behaviour-gate
   assertion per fixed defect class.
4. Run both gates; they must exit 0.
5. Append the round to `panel.json` (exact shape in
   `references/artifacts.md`), headline written while it is fresh.
6. Rebuild both artifacts (`scripts/build-report.mjs`,
   `scripts/build-console.mjs` + `scripts/verify-console.mjs` +
   `scripts/verify-artifact.mjs`), republish to the SAME URLs, push.
7. Read the panel's convergence honestly: rising refutation rate and a
   tight spread mean the loop is ending — move to the honest-distance
   round; otherwise continue.

## Door: report

- **Status** (mid-loop): read `panel.json` and the artifact timestamps;
  report per-seat standing, movement of floor and ceiling, findings/
  confirmed/refuted totals, and whether the heartbeat is fresh — never
  invent numbers not in `panel.json`.
- **Session Record** (at close): build the one-page record per
  `references/artifacts.md`, in the engagement's own register, and
  publish it.

## Degradation ladder

Full protocol needs parallel agents and a browser. Degrade explicitly,
never silently:

- No Workflow tool → run seats as parallel subagents with the generated
  prompt files; refuters likewise.
- No subagents at all → sequential seats in one context, each seat's JSON
  written to disk before the next begins; record "degraded blindness" in
  the round entry.
- No Playwright/browser → the measured and behaviour gates CANNOT run;
  say so, mark every affected claim "unverified", and do not present
  scores as gate-backed. Do not fake a gate.

## Style of the work itself

The lab's pages, artifacts, and copy are held to the engagement's register
(`references/register.md` is the default). Comments in masters explain the
argument for a decision beside the decision. Copy is plain, confident,
sentence case; every fact has one grammar; effort is never the subject.
The artifacts are the presentation — show, never just tell.
