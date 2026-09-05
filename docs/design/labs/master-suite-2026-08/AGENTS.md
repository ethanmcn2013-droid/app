# The master-suite design lab

**Front-end design only. Everything you change lives in `src/`.**

This directory is a self-contained design lab: Notes, Tasks and Timeline
composed into one running application on one world of data, built as a single
static page. It has no server, no database, no framework and no build step
beyond one Node script. The repository root's `AGENTS.md` describes the Next.js
product app — **none of it applies here.** There is no Next.js in this
directory.

## Scope

| | |
|---|---|
| **Yours** | `src/*.css`, `src/*.js` — the entire front-end surface |
| **Yours** | `interaction-check.mjs`, `verify.mjs`, `gate.mjs` — add assertions freely |
| **Yours** | `panel/STATE.md` — keep the ledger honest as you close findings |
| Read-only | `COMPOSITION.md`, `BUILD-LIST.md`, `brief.md`, `panel/round-*.json` |
| Generated | `master.html`, `_wrapped.html`, `_gate-*.html`, `shots/`, `gate.json` |
| **Out of bounds** | everything outside this directory — `src/app/`, `drizzle/`, `scripts/`, `content/`, `docs/` elsewhere |

If a change seems to need something outside this directory, it is out of scope.
Say so rather than reaching for it.

## Never

- **Never run `node tools/split.mjs --force`.** It regenerates `src/` from the
  three frozen source labs and silently destroys everything since. It has cost
  this lab a full round of work once already.
- **Never hand-edit `master.html`.** It is generated. Edit `src/`, run
  `node build.mjs`.
- **Never skip, disable, or loosen an assertion to get a gate green.** If an
  assertion is wrong, fix the assertion and say in the diff why it was wrong.

## Build and gates

```
node build.mjs                 src/ → master.html
node verify.mjs                structure and contract        · 497 checks
node gate.mjs                  measured geometry and colour  ·  20 checks
node interaction-check.mjs     behaviour, driven in Chromium · 298 assertions
node tools/prove-check.mjs     proves the gates still fail   ·   4 checks
```

All four are green on the current head. `interaction-check.mjs` is the one that
matters: it drives a real browser and it is where every defect that mattered was
eventually caught. Run the measured gates alone — a fixed clock measures the
machine, so a parallel load makes `gate.mjs` flap.

Playwright resolves at `/opt/node22/lib/node_modules/playwright/index.mjs` with
Chromium at `/opt/pw-browsers/`. Run probes from this directory. Scratch files
matching `_zz-*` and `_zz_*` are gitignored — use those prefixes.

## Driving the page

```
_gate-suite.html?state=<product>.<state>&v=paper|ink&layout=across|down
```

States: `tasks.board` `tasks.dense` `tasks.compact` `notes.notebook`
`notes.seam` `notes.review` `notes.voice` `timeline.owner-flight`
`timeline.desk` `timeline.phone`.

`_gate-*.html` are written by `node tools/wrap.mjs` and are gitignored — they
exist only because the published page supplies a skeleton a local browser does
not.

## The work queue

`panel/STATE.md` is the ledger and the first thing to read. It holds **23
standing findings** — 17 defect, 6 refinement, zero blocking, zero misleading —
each with the measurement that raised it.

Each finding carries **the adversarial reviewer's sharpened fix, not the
original proposal.** Use the sharpened one. Three of the original proposals
would have caused damage: a `display: flex` that knocks every across-layout
label 77.6px off its own tick, a revert of a fix already paid for, and a new
signal identical to one a live card already wears.

The three worth pricing first are named at the top of that section.

## The discipline this lab runs on

**One assertion per fix, written first, and watched failing before any source
moves.** Not after. The assertion is the deliverable as much as the fix is.

This matters because of the failure mode this lab has now recorded thirteen
times: **absence reads as a pass.**

- A selector that matches nothing fails nothing.
- A rule that reads `NaN` passes every state without measuring one.
- A check guarded behind a condition that is never true is never reported.
- `document.activeElement` answers `BODY` for a document that does not hold
  window focus.
- A loop that opens a fresh page per viewport never makes the journey
  *between* viewports — which is where three independent reviewers hit a live
  `ReferenceError` that four green gates had certified hours earlier.
- Two assertions written in the last round passed vacuously the hour they were
  written, and were repaired before the fixes landed.

So: after writing an assertion, prove it can fail. Ask what its loop never
does, and what it is not looking at.

Two more that cost real time:

- `toggleAttribute` writes the **empty string**. `aria-disabled=""` is an
  invalid token a browser resolves to `false`. Use `setAttribute` with an
  explicit `"true"` / `"false"` for any ARIA state.
- **CSS ties break on source order.** Several rules here sit at (0,4,0) and
  collide. A correct rule written too early in the file loses to the exact
  treatment it exists to cancel.

## The palette is locked

Ink `#111111`, Indigo `#4f46e5`, White, and the declared `--ink-*` tiers.
`--ink-4` is marked *decorative only, never type* and means it.

**Contrast and letter-tracking are declared gate exclusions** — measured and
reported, but not enforced, and handed to human review deliberately. Do not
quietly start gating them, and do not treat their absence from the gate as
permission to regress them.

## Definition of done

A change is finished when all four gates are green, the new assertion has been
watched failing without the fix and passing with it, and `panel/STATE.md`
reflects what closed. Not before.
