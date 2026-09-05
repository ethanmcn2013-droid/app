# Where this engagement is · master-suite

**Read this first on any resumed session.** Everything below is on disk;
nothing here depends on a conversation being remembered.

Last worked: **2026-09-05**. Round 7 is run, recorded and published, and it
was the LAST round of this engagement by the founder's instruction. The
surface is NO LONGER frozen — seven fixes landed after the seats sat.

## Position

| | |
|---|---|
| Rounds | **7 run.** 1–3 on 2026-08-26, 4–5 on 2026-08-27, 6 on 2026-09-03, 7 on 2026-09-05. The last two on frozen surfaces. |
| Round 7 | 35 raised · 3 duplicate pairs merged · **32 distinct** · 30 confirmed · 2 refuted · **7 closed** · **23 standing** · `panel/round-7.json` |
| Scores | floor **8.6** Interaction and states · ceiling **9.1** Brand and copy · mean **8.84** · spread **0.50** |
| Standing | **0 blocking · 0 misleading** · 17 defect · 6 refinement |
| Gates | **all four green** · `verify.mjs` 497 · `gate.mjs` 20 · `interaction-check.mjs` **298** (45 at the start of this engagement) · `tools/prove-check.mjs` 4 |
| Ending | **NOT MET.** Two consecutive rounds with no confirmed blocking or misleading finding. Round 7 confirmed 5 blocking and 2 misleading — all now closed, but the round confirmed them. |
| Branch | `claude/signal-studio-suite-redesigns-8t80xl`, PR ethanmcn2013-droid/app#170 |
| Artefact | https://claude.ai/code/artifact/832d5b84-e6a0-43e6-a151-1f80dc17bd76 — the master, round 7 final |
| Report | https://claude.ai/code/artifact/312c2060-0c94-44be-b3e5-58d732e43b3c — *Seven Rounds*, the close-out |

## What is different about this close

Round 6 ended with **4 blocking and 3 misleading standing**. Round 7 ends with
**none**. Every finding that could stop Orla completing a task, or tell her
something untrue at the moment she acts, is closed and carries an assertion.
The 23 that stand are 17 defects with workarounds and 6 refinements.

That is not the ending condition, and this file does not pretend otherwise:
the condition asks for a round that finds no blocking or misleading defect,
and round 7 found seven. What it does mean is that the surface no longer has
a known way to lie to a person or to strand them.

## The 23 standing, if the loop resumes

**Defect (17)** — `arrival-lands-without-an-event` (the beat exists and is on
the ladder; it does not READ — and the refuter's answer is better than a second
marker: stop suppressing the focus ring on the pointer path),
`card-content-said-three-times`, `dock-eats-the-lists-last-row`,
`done-card-unsays-that-it-is-movable`, `lane-phantom-sideways-scroll-1199-1420`
(the seat's `overflow-x: clip` does not work beside `overflow-y: auto` — it
computes to `hidden`), `moment-editor-has-no-measure` (the cap it needs already
exists in-house, trapped in a `max-width: 1023px` query),
`notes-curve-off-ramp`, `notes-drops-focus-at-720`,
`notes-head-scope-has-no-affordance`, `phone-list-measure-starved`,
`phone-spine-reassembles-under-the-thumb`,
`privacy-door-answers-no-one-on-screen`, `review-end-drops-focus`,
`seam-reassures-five-times-and-never-names-the-lane`,
`the-person-is-drawn-twice`, `two-controls-named-more-on-the-phone` (and the
separate defect underneath it: on the Notes phone the rail is `display:none`,
so a full Tab sweep contains no More, Home, Inbox, Help or Settings),
`two-popups-advertise-a-keyboard-they-do-not-have`.

**Refinement (6)** — `across-date-row-staircase` (fix it with a below-scoped
`min-height`, NOT `display:flex`, which moves every single-line across label
77.6px off its own tick), `across-measure-label-order-flips`,
`board-leaves-a-dead-column-at-1920` (110px of dead white in the hero frame;
the 422px constant is exact for one collapsed lane only),
`micro-label-six-voices` (five settings, not six; hoist at 0.10em, because
0.16em invalidates `.trayCount`'s -0.1em compensation),
`phone-list-column-misses-the-heads-edges`, `type-undeclared-past-the-gate`.

Every one carries its refuter's sharpened fix in `panel/round-7.json`.

## One gate threshold needs a deliberate number

`interaction-check.mjs` asserts `across @w · placing a moment is not done blind`
with a floor of **>= 1** grab handle on screen. With the round-7 editor fix in
place, 1280x900 leaves exactly 1. A floor a fix can sit precisely on is not a
floor. The refuter flagged it; the number is a design decision, not a repair.

## Traps this lab has already paid for

- **`tools/split.mjs --force` regenerates `src/` from the frozen labs and
  once ate a whole round's work silently.** `src/` is the living source.
  Do not run it.
- State names are `<product>.<state>` with a **dot**; a colon cannot be a
  Windows filename.
- **Absence reads as a pass — THIRTEEN times now.** A dead selector, a
  `display: contents` zero rect, a missing refuter verdict, a rejected fix
  counted as a rejected finding, `visibility: hidden` hiding a control from a
  target audit, a count read off the wrong element, a claim guarded behind `if
  (the menu offered it)`, `.listBoard` losing to `.board` on source order, a
  page no gate ever loaded, a handler that only runs on a TRANSITION between
  viewports when every loop opens a fresh page, a whole pointer type — and, in
  round 7, two of the round's own new assertions passing vacuously when first
  written, plus an assertion that asked whether the MOMENTS were visible and
  never whether the editor was. Write the existence check BEFORE the claim, ask
  what the loop never does, and ask what the assertion is not looking at.
- **`toggleAttribute` writes the EMPTY STRING.** `aria-disabled=""` is an
  invalid token that Chromium resolves to false, so the tree reports enabled
  and every `[aria-disabled="true"]` rule stops matching. Use `setAttribute`
  with an explicit "true"/"false" for any ARIA state.
- **A live path can lie where first paint tells the truth.** The seam's Send
  was correct on every repaint and wrong only while typing, which is why six
  rounds of static sweeps never saw it. Drive the typing.
- **CSS ties are broken on source order.** The round-7 disabled-primary rule
  is (0,4,0) and so is the indigo-subtle rule it must override; written
  earlier in the file it lost to the exact treatment it exists to cancel.
- **A fixed clock measures the machine.** Run the measured gates alone.
- **Chromium blurs a field before the resize event when the crossing hides
  its plane.** The product records a caret the layout took.
- **A helper that defers owns everything that depends on the deferral.**
  `startViewTransition` runs its callback a frame late — which is also why the
  More door announced the reverse of what it did, and why the same build was
  CORRECT under reduced motion, where the callback runs synchronously.
- **`_wt-*` worktrees.** The fidelity section compares against the three labs'
  own masters; on a fresh machine they have to exist as git worktrees beside
  the repo, and the elevate skill has to resolve at `/home/.claude/skills/elevate`.

## Driving it

```
_gate-suite.html?state=<product>.<state>&v=paper|ink&layout=across|down
```

`tasks.board` `tasks.dense` `tasks.compact` `notes.notebook` `notes.seam`
`notes.review` `notes.voice` `timeline.owner-flight` `timeline.desk`
`timeline.phone`
