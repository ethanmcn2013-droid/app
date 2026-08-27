# Where this engagement is · master-suite

**Read this first on any resumed session.** Everything below is on disk;
nothing here depends on a conversation being remembered.

Last worked: **2026-08-27**, session ended by the founder mid-task —
"stop everything and save everything, resume Monday". Everything is
committed, pushed and published. Nothing is half-applied.

## Position

| | |
|---|---|
| Rounds | **5 run.** 1–3 on 2026-08-26, 4–5 on 2026-08-27. |
| Round 5 | 29 raised · 25 stood · 4 refuted · **all 25 closed** · `panel/round-5.json` |
| Scores | floor 7.2 → **8.6**, ceiling 9.0, spread 1.40 → **0.40**, and the engagement's **first sign-off** |
| Gates | **all four green** · `verify.mjs` **485** · `gate.mjs` · `interaction-check.mjs` 45 · `tools/prove-check.mjs` 4 |
| Ending | **NOT MET.** Two consecutive rounds with no standing blocking or misleading, on a **frozen** surface. Round 5 stood 4 blocking and 6 misleading, and the surface has not been frozen since — three build passes have landed on top of it. |
| Branch | `design/master-suite-2026-08` @ `3d8fae3b`, pushed |
| Artifact | https://claude.ai/code/artifact/832d5b84-e6a0-43e6-a151-1f80dc17bd76 |
| Report | https://claude.ai/code/artifact/42a27dec-1879-4341-9f96-86921f978124 |
| Console | https://claude.ai/code/artifact/a1300890-6c2c-4d36-9ce3-4a9e6420b6d7 |

## What landed after round 5, in order

Three passes, all committed, all gated green, none of them panel work.

**1 · The motion pass** (`3f6ec1ab`) — from a parallel session's audit.

- The product switch is a **same-document view transition**. `apply()`
  wraps, `applyNow()` mutates. Measured cost of the wrap: **25ms** against
  a 220ms animation.
- **The motion vocabulary is five names**, one per value, written down in
  `src/foundation.css` where the primitives are:
  `--dur-quick` 80 · `--dur` 140 · `--dur-settle` 220 · `--dur-rare` 400 ·
  `--curve`. 43 uses rewritten. `--dur-out` deleted. `--t-` is reserved
  for TYPE.
- **The rare tier is three places**: a lane cleared because the work is
  finished (built), a timeline published (not built), a note becoming a
  task (not built). The completion burst was at 400ms on every completion
  and now settles at 220; 400 is kept for the completion that clears its
  lane.

**2 · The interaction pass** (`6c82c552`) — four techniques from
transitions.dev and liquid-gooey, adapted to the vocabulary above rather
than pasted.

- **morph** — a control becoming the surface it opens, six places, on
  `__SUITE.morph`. The pair name is LENT for one transition; a static name
  collides and Chromium skips the transition in silence.
- **accordion** — the dialog's `<details>` became a button and a
  `0fr → 1fr` grid panel.
- **stack** — the undo strip is three deep; the two beneath are `inert`
  and `aria-hidden`, and the "N more" count stays in words.
- **travel** — `__SUITE.travel`, an accent moving between adjacent slots
  as liquid, on the rail (down) and Notes' group switch (across).

**3 · List, and the switcher's travel** (`3d8fae3b`) — the wiring held
back in pass 2, plus the live view it needed.

## Three things about the goo that cost an afternoon each

Written down because none of them is in any reference and all three
present as "the effect simply does nothing".

1. **`filterUnits="userSpaceOnUse"`.** A percentage region is a percentage
   of the object bounding box. The first host tried was a 0×0 anchor,
   where that region is empty and the element is not painted at all.
2. **The shapes must be opaque.** The ramp is `18a − 7`, so anything under
   ~39% alpha is driven to zero. The rail's accent is 16%: draw the blobs
   opaque and fade the LAYER — CSS applies `filter` before `opacity`.
3. **The tail needs a different CURVE, not a longer duration.** Sharing
   `--curve` (a hard ease-out) puts both blobs at the destination at once.
   The tail eases IN, hangs back, and snaps home. That is what draws the
   band.

**Where the goo does not go, measured:** the completion burst. Applied
there it erased it — 365 green pixels of particles became 61, and the 61
were the Done lane's own dot. Twelve 5px particles travelling 40px apart
never touch, and shapes have to overlap to merge.

## Open, and the order to take them in

1. **The List view and the switcher's travel have NO ASSERTIONS.** This is
   the first job. Everything else in `tools/material.mjs` was written
   against its fix; these two shipped green on a gate that does not look
   at them. Add to `tools/material.mjs`: the list renders the same rows as
   the board under the same filters, the lane is stated in type, `walk()`
   is one-axis, the drag paths stay on `.card`, and the switcher travels.
2. **The list at 390 is unverified.** The fold rule is written and was
   never driven.
3. **Round 6, on a FROZEN surface.** Rounds 4 and 5 ran 86% and 79%
   self-inflicted because building continued between them; three more
   build passes have landed since. No round is worth buying until the
   surface stops moving.
4. Timeline's wordmark sits 20px lower and 10px right of the other two.
   Flagged in round 5, not changed.

## Traps this lab has already paid for

- **`tools/split.mjs --force` regenerates `src/` from the frozen labs and
  once ate a whole round's work silently.** `src/` is the living source.
  Do not run it.
- State names are `<product>.<state>` with a **dot**; a colon cannot be a
  Windows filename.
- **Absence reads as a pass, eight times now.** A dead selector, a
  `display: contents` zero rect, a missing refuter verdict, a rejected fix
  counted as a rejected finding, `visibility: hidden` hiding a control
  from a target audit, a count read off the wrong element (NaN passes
  every comparison), a claim guarded behind `if (the menu offered it)`,
  and `.listBoard` losing to `.board` on source order. Write the existence
  check BEFORE the claim, every time.
- **A helper that defers owns everything that depends on the deferral.**
  `startViewTransition` runs its callback a frame late, and three separate
  callers focused nodes that did not exist yet. `go()` takes a `then`,
  `openCard()` takes a `land`, and `apply()` takes an `after` for exactly
  this reason.

## Driving it

```
_gate-suite.html?state=<product>.<state>&v=paper|ink&layout=across|down
```

`tasks.board` `tasks.dense` `tasks.planning` `tasks.filtered`
`notes.notebook` `notes.seam` `notes.voice` `notes.capture`
`timeline.owner-flight` `timeline.desk` `timeline.phone`

No gated state, must be driven by hand: the List view (press List), the
project switcher, the expanded task, Filter / Sort / Display / Share, the
search at the foot, the completion moment, the drop tints, the rail's `+`,
and every travelling accent.
