# Where this engagement is · master-suite · budget 3 rounds

**Read this first on any resumed session.** Everything below is on disk; nothing
here depends on a conversation being remembered.

## Position

| | |
|---|---|
| Round budget | **3**, set by the founder before round 1 |
| Round 1 | **complete and closed.** `panel/round-1.json` |
| Round 2 | **complete and closed.** `panel/round-2.json` · 3 seats · 7 confirmed, all fixed |
| Round 3 | **running** — full seven seats, `--final`. Run `wf_acb8cc61-531`, task `wp6t3jkrq` |
| Gates | both green at round 2 close · **249** behaviour assertions · `node gate.mjs` and `node verify.mjs` |
| Artifact | https://claude.ai/code/artifact/832d5b84-e6a0-43e6-a151-1f80dc17bd76 — **not yet republished since round 0**; republish at the close |
| Branch | `design/master-suite-2026-08`, pushed through `Round 2` |

## Round 3 — collecting it

Workflow run `wf_acb8cc61-531` (task `wp6t3jkrq`), **seven** seats, final round.
The notification truncates; the journal does not. Build the record from the journal:

```
node tools/round.mjs "C:/Users/ethan/.claude/projects/C--Users-ethan/7c0de329-febd-4a7e-ab6a-74379c009573/subagents/workflows/wf_acb8cc61-531/journal.jsonl" 3
```

Round 2's journal, if it is ever needed again, is `wf_0abbeaf9-34e`.

That writes `panel/round-3.json` and prints every confirmed finding in severity
order. Then merge it into `panel.json`'s `rounds` array — `tools/merge2.mjs` is the
working example, copy it for round 3 — and run:

```
node ../../../../../.claude/skills/elevate/scripts/ledger.mjs --lab=. --check
node ../../../../../.claude/skills/elevate/scripts/round-metrics.mjs --lab=. 
```

`round-metrics.mjs` is **the only thing allowed to say the engagement may stop.**

## The loop, in order

1. `node tools/round.mjs <journal> <n>` — the record, from the journal.
2. Fix confirmed findings in batches of **≤ 8**, severity order.
   **Write the assertion first and watch it fail** before the fix. The assertion
   modules are `tools/spine.mjs`, `tools/truth.mjs`, `tools/craft.mjs`,
   `tools/orientation.mjs` — add to the right one or start another and wire it
   into `verify.mjs` beside the others.
3. `node build.mjs && node tools/wrap.mjs` then `node verify.mjs` between batches.
4. `node ../../../../../.claude/skills/elevate/scripts/shots.mjs --lab=.`
5. Write `panel/round-<n+1>-notes.md`, then
   `panel-round.mjs --lab=. --round=<n+1>` (add `--final` and drop `--seats` for
   round 3 — the closing round is full-panel), then run it with the Workflow tool.
6. Commit and push every round.

## What round 2 cost, in one line

The Planning drawer covered a fifth of the board at every desk width. The lab
had **already fixed that** and its comment is still in the file; scoping each
product under its app compound turned the lab's root `.floor` into a demanded
DESCENDANT, and in the suite the floor is `#deck`, the app's PARENT. Five rules
matched nothing from the day the document was composed. **A selector that
matches nothing fails nothing** — which is why `tools/reach.mjs` gates the class
and not the instance. Assume there are more of these.

## Open from round 1 — ten defects, known and classed

Named in `panel/round-1.json` under `open`. Read any of them in full with
`node tools/show.mjs 1 <id>`.

`spoken-copy-below-the-visible-standard` · `waiting-lane-is-keyboard-inert` ·
`undo-drops-focus-on-body` · `undo-drops-focus-to-body` ·
`three-eyebrows-for-one-role` · `done-is-the-name-of-a-lane` ·
`undo-lies-outside-the-tick` · `phone-undo-strip-eats-the-row-and-its-own-sentence` ·
`closed-doors-are-indistinguishable` · `ledger-time-reads-as-completion`

`three-eyebrows-for-one-role` is the letterfit question and is the one the
founder's own brief invites: three products, three ratified tracking curves,
one application — a system or three?

## What the gates cannot see, and is therefore the panel's

1. **Letterfit is not mechanically gated.** Stated and proved unfixable in
   `tools/exclusions.mjs`; the shared check groups across three products, two of
   them hidden but in the DOM, and a per-product rerun cannot see *role*.
2. **A contrast residue is OPEN** — keycaps in the dictation state where the
   shared model, a render proof and the eye disagree. `gate.mjs` prints it every
   run as OPEN rather than passing or failing it.
3. **Two frames are not byte-reproducible** — `notes.voice` at 768 and 1440 has a
   live waveform and a running clock.

## Traps this engagement has already paid for

- **`node tools/split.mjs --force` regenerates `src/` from the frozen labs.** It
  ate a whole round's work once, silently, and the behaviour gate then PASSED the
  seam's privacy assertion because the field the fix read had gone with the fix.
  It now copies what it replaces into `_source/.replaced/` first. **`src/` is the
  living source. Do not run split again.**
- **Never write regexes or apostrophe-heavy text through a bash heredoc.** It ate
  escapes three times in this engagement. Use the editor tool.
- **State names are `<product>.<state>` with a DOT.** A colon cannot be a filename
  on Windows, and the shot harness names every frame after its state — it
  collapsed forty frames into three without erroring.
- **`--only=<section>`** on `verify.mjs`: `fidelity console seam spine contract
  grounds motion orientation truth craft reach spinekeys labgates`.
- **Write the assertion first and watch it fail — then check the failure is the
  product's and not the assertion's.** Round 2 wrote four assertions that failed
  for the wrong reason: a node held across a Tasks repaint is detached and
  measures 0x0; an ASCII space does not match the non-breaking space the horizon
  binds a date with; a local-midnight date read back in UTC lands a day early;
  and a CSS scan that does not strip comments matches its own note. Each was
  caught by a result *contradicting* a seat rather than confirming it. A green
  assertion you never watched fail correctly is not evidence.

## The founder's standing asks, from round 1

1. Timeline in two orientations with a toggle — built; `across` at ≥1024, `down`
   below, `?layout=across|down`.
2. Use the horizontal space — done and measured; whether it is now *right* rather
   than merely *wider* is still the panel's to say.
3. *"Not held back by old contracts and restraints."* The pixel-fidelity contract
   from the first brief no longer binds; `verify.mjs`'s `CHANGED` and `REPAIRED`
   declarations record what this engagement has deliberately moved past.
