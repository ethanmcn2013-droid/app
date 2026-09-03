# Where this engagement is · master-suite

**Read this first on any resumed session.** Everything below is on disk;
nothing here depends on a conversation being remembered.

Last worked: **2026-09-03**. Round 6 is run, recorded and published. The
surface is NO LONGER frozen — seven fixes landed after the seats sat, so
round 7 needs a fresh freeze before it starts.

## Position

| | |
|---|---|
| Rounds | **6 run.** 1–3 on 2026-08-26, 4–5 on 2026-08-27, 6 on 2026-09-03 — the first on a frozen surface. |
| Round 6 | 34 raised · **24 confirmed · 10 refuted** · 7 closed · **17 standing** · `panel/round-6.json` |
| Scores | floor **8.4** (UI composition), ceiling **8.8** (Brand and copy), spread 0.40 |
| Refutation | 14% → **29%**. Three seats sighted the Timeline wordmark; all three were killed. |
| Gates | **all four green** · `verify.mjs` 497 · `gate.mjs` 20 · `interaction-check.mjs` **187** (45 at the start of this session) · `tools/prove-check.mjs` 4 |
| Ending | **NOT MET.** Two consecutive rounds with no confirmed blocking or misleading finding. Round 6 confirmed 4 blocking and 3 misleading, all of them still standing. |
| Branch | `claude/signal-studio-suite-redesigns-8t80xl`, PR ethanmcn2013-droid/app#166 (draft, CI green) |
| Master | https://claude.ai/code/artifact/832d5b84-e6a0-43e6-a151-1f80dc17bd76 |
| Workbench | https://claude.ai/code/artifact/2c152f3f-3369-4d22-8cb5-fcab6cc8860a — the same build, for reading on a phone |
| Log | https://claude.ai/code/artifact/42a27dec-1879-4341-9f96-86921f978124 |
| Console | https://claude.ai/code/artifact/a1300890-6c2c-4d36-9ce3-4a9e6420b6d7 |
| Session record | https://claude.ai/code/artifact/07b1379c-aed3-49a7-94af-afcbe5d9ab2f — the 15-minute founder read: what stands, what it costs |

## The first job on any resumed session

**Seventeen confirmed findings stand unfixed.** They are adjudicated —
each survived its own fresh refuter — and each carries the refuter's
sharpened fix, which is usually more precise than the seat's own. They
are in `panel/round-6.json` under `standing`, and they are round 7's
work, in this order:

**Blocking (4)**

- `card-note-unreadable-1100-to-1279` — 1280 trims zero notes, 1279 trims
  all eight. The gate proves "five lanes fit at 1180" and "the note reads
  at 1280" and never crosses the two.
- `dense-lane-fold-reads-as-end-of-list` — 10 of 32 tasks hidden in dense
  at 1920, the cut landing exactly on a card boundary.
- `seam-landing-reported-four-ways` — after one Send the task title prints
  three times and two controls carry `data-act="open-task"` 233px apart.
- `three-keycaps-for-one-keyboard-model` — 10px mono / 11px sans-600 /
  11px mono, four letterfits, three radii, and no box at all in Timeline.

**Misleading (3)** — `lead-tick-off-its-own-date` and
`lead-tick-off-its-own-date-in-across` are ONE defect seen by two seats
(the across measure's lead tick sits 28px left of its own date, 4.7 days
early at 768); `notes-h1-says-all-your-notes-while-filtered`.

**Defect (5)** — `card-open-note-state-is-unreachable`,
`seam-undo-denied-in-the-room-it-sent-you-to`, `keyboard-drop-has-no-undo`,
`arrival-invisible-to-the-hand`, `the-approach-vanishes-while-you-place-a-moment`.

**Refinement (5)** — `seam-card-repeats-its-own-title`,
`one-filing-field-four-names`, `compact-density-is-a-reachable-unaudited-state`,
`seam-payoff-card-stutters`, `completion-sentence-counts-the-same-notes-twice`.

Then RE-FREEZE and run round 7. Rounds 4 and 5 ran 86% and 79%
self-inflicted because building continued between them; round 6 ran 12%
because it did not.

## What round 6 was actually about

Not the surface — the gates. Its worst finding was a defect four green
gates had frozen hours earlier, and both blind spots it exposed have one
cause: **a gate that opens a FRESH page per viewport never makes the
journey between viewports, and never gives a narrow one a mouse.**

1. **The crossing.** Three seats independently hit
   `ReferenceError: C is not defined` on every crossing of 720, in all
   three products. The media-query listeners the 2 September ledger added
   had never executed once, so the timeline kept the desk composition on a
   phone and Tasks kept a five-lane board in a 372px viewport. Fixed;
   `interaction-check.mjs` now narrows one page and widens it again.
2. **The reflow.** `open()` derives `isTouch` from `vp.isMobile`, and every
   configured viewport under 480 sets it — so every no-sideways-scroll
   assertion had only ever run on a coarse pointer. The dictation floor
   overflowed the document by 145px at 320 on a fine one: WCAG 1.4.10,
   failed on exactly the narrowed desktop window the guideline describes.
   Fixed; the gate now sweeps 320/390/430 on a mouse.

Also closed: Notes' heading outline (five orphan h3s at a desk, and at 390
an h1 pruned from the tree entirely), the list row's first line, eleven
door strings that invented "another screen", and the console artifact
itself, which was pushing its own page 591px sideways on a phone since
round 5 — the tool breaking the rule it exists to check.

## Traps this lab has already paid for

- **`tools/split.mjs --force` regenerates `src/` from the frozen labs and
  once ate a whole round's work silently.** `src/` is the living source.
  Do not run it.
- State names are `<product>.<state>` with a **dot**; a colon cannot be a
  Windows filename.
- **Absence reads as a pass, ELEVEN times now.** A dead selector, a
  `display: contents` zero rect, a missing refuter verdict, a rejected fix
  counted as a rejected finding, `visibility: hidden` hiding a control
  from a target audit, a count read off the wrong element (NaN passes
  every comparison), a claim guarded behind `if (the menu offered it)`,
  `.listBoard` losing to `.board` on source order — and, on 2 September,
  a page no gate ever loaded (the column at a desk width), a handler that
  only runs on a TRANSITION between viewports when every loop opens a
  fresh page at each one, and a whole pointer type — every viewport under
  480 was given a finger, so no assertion ever ran on a narrowed desktop
  window. Write the existence check BEFORE the claim, every time, and ask
  what the loop never does as well as what it does.
- **A fixed clock measures the machine.** The switch's mid-frame is pinned
  on the transition's own clock; the wrap cost is judged against a
  measured empty transition; the tool panel is waited for by state. Run
  the measured gates alone — a concurrent browser job stretches every
  timing.
- **Chromium blurs a field before the resize event when the crossing
  hides its plane.** The truth gate's caret check passed on 27 August on
  the other ordering. The product now records a caret the layout took.
- **A helper that defers owns everything that depends on the deferral.**
  `startViewTransition` runs its callback a frame late, and three separate
  callers focused nodes that did not exist yet. `go()` takes a `then`,
  `openCard()` takes a `land`, and `apply()` takes an `after` for exactly
  this reason.
- **`_wt-*` worktrees.** The fidelity section compares against the three
  labs' own masters; on a fresh machine they have to exist as git
  worktrees beside the repo (`_wt-design-tasks`, `_wt-design-notes`,
  `_wt-timeline-redesign`) with `node_modules` linked, and the elevate
  skill has to resolve at `/home/.claude/skills/elevate`.

## Driving it

```
_gate-suite.html?state=<product>.<state>&v=paper|ink&layout=across|down
```

`tasks.board` `tasks.dense` `tasks.planning` `tasks.filtered`
`notes.notebook` `notes.seam` `notes.voice` `notes.capture` `notes.review`
`timeline.owner-flight` `timeline.desk` `timeline.phone`

No gated state, must be driven by hand: the List view below 1100, the
project switcher, the expanded task, Show and Share, the phone bottom
sheet, the settings card, the account door's answer, the completion
moment, the drop tints, the rail's `+`, and every travelling accent.
