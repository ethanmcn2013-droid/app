# Where this engagement is · master-suite

**Read this first on any resumed session.** Everything below is on disk;
nothing here depends on a conversation being remembered.

Last worked: **2026-09-02**. The surface is **FROZEN** at this commit:
the 2 September ledger is closed, all four gates are green, and round 6
runs against this exact build. Nothing is half-applied.

## Position

| | |
|---|---|
| Rounds | **5 run.** 1–3 on 2026-08-26, 4–5 on 2026-08-27. Round 6 is the first on a frozen surface. |
| Round 5 | 29 raised · 25 stood · 4 refuted · all 25 closed · `panel/round-5.json` |
| The ledger | The 2 September critical review (Opus 5 master against the Grok exploration, `remote-redesign/work/2026-09-02-critical-review/`) raised 33 findings; **all 33 are closed** in `src/`, each recorded with its decision in `COMPOSITION.md` § "The 2 September ledger, closed". |
| Gates | **all four green** · `verify.mjs` **497** · `gate.mjs` 20 · `interaction-check.mjs` **129** (was 45) · `tools/prove-check.mjs` 4 |
| Ending | **NOT MET.** Two consecutive rounds with no standing blocking or misleading, on a frozen surface. Round 6 is the first of the two that can count. |
| Branch | `claude/signal-studio-suite-redesigns-8t80xl` from `design/master-suite-2026-08` @ `10860f91` |
| Artifact | https://claude.ai/code/artifact/832d5b84-e6a0-43e6-a151-1f80dc17bd76 |
| Workbench | https://claude.ai/code/artifact/2c152f3f-3369-4d22-8cb5-fcab6cc8860a — the same build, republished as it changed |
| Report | https://claude.ai/code/artifact/42a27dec-1879-4341-9f96-86921f978124 |
| Console | https://claude.ai/code/artifact/a1300890-6c2c-4d36-9ce3-4a9e6420b6d7 |

## What the 2 September pass changed, by surface

Every item below is one ledger finding closed by decision, verified in a
rendered frame, and held by an assertion written before the fix. The
long form, with the decisions that overturned a round-5 choice, is in
`COMPOSITION.md`.

**Tasks.** Below 1100 the board is a **list**; on a phone the board is a
single lane that pages sideways at 86% width. Filter, Sort and Display
became one word, **Show**, with the live count on its face while shut.
A ticked row **holds its slot** until the undo window closes; a ticked
card on a narrow board hands focus to its neighbour. The head carries a
**pace meter** (role=meter) instead of a count, an overdue chip, and the
undated door. The phone head carries the search as a pill and the tool
panel opens as a bottom sheet. The card note is capped at five lines at
1280 and above; the drawer says "Today is Thu 16 Jul" once. Project
settings answer on screen: "Not here yet."

**Notes.** The head **carries no count**; the way into review is a quiet
text control in the index head, in every index head that is not already
the hand. The stack is **1120**, back from 1440 — a scan line nobody can
scan is not a wider measure (recorded; this overturns a round-5 choice).
The phone seam opens the same sheet a tap opens, with the peel out, and
its four decisions wrap onto two lines. The voice disclosure says what is
kept: the words, not the audio. A caret the **layout took** on the 720
crossing is kept for one paint.

**Timeline.** The horizon's gap note is **silent while a moment is
ahead** and says "Nothing is planned yet." only when nothing is. The
owner bar's primary is **Add a moment**; Preview and Get the link stand
beside it at a desk and fold behind ··· on a phone. Across is never
offered on a phone; the across floor is 4px a day with labels clamped to
the track. The grab handle is the whole row with its word for the screen
reader only; the title's hairline underline is the visible affordance.
The publish strap reads "Anyone with the link can read it" once sent.

**Suite.** Every closed door **answers on screen** — a card beside the
rail tile or above the anchor: "Your account, in Signal Studio · Not here
yet." Settings is a **real door**: a card with You, Email and Plan.
Orla's world holds three projects — The Orchard, the Winter dinner
series, the Spring trade fair — and nothing from another life.

## What the freeze gates caught

Run on the closed ledger before anything was committed, the four gates
went red nine times, then three more in the two sections the crashes had
hidden. One was a **real regression** the ledger had made —
the column at a desk width threw `gapSentence is not defined` from the
horizon reader and stacked seven moments on one line, on a page no gate
loaded — now fixed, gated in the console section (both compositions at
desk widths) and asserted in `interaction-check.mjs`. One was a
**timing-sensitive truth check** that also fails on the untouched
baseline when driven now (the caret on the crossing); the product now
keeps it. Two were **coarse targets** the new controls exposed (44 now).
One was the handle's screen-reader word at **0px** (11px, clipped). Seven
were **repoints, none looser**, each recorded in `COMPOSITION.md`
§ "What the freeze gates caught" — among them the whole-flow drive still
looking for the academic fixture the second project used to be. The delight controls check now waits
for the panel's state instead of a 240ms clock that measured the machine.

## Round 6 — how to run it on this surface

```
node /home/.claude/skills/elevate/scripts/panel-round.mjs --lab=<lab> --round=6 --mode=prompts
```

Seven seats, each in a fresh context, from the frozen shots in `shots/`.
A fresh refuter per finding, defaulting to REFUTED. Fix only what stands;
every fix carries an assertion written first. Both gates green, append
`panel/round-6.json` and the entry in `panel.json`, rebuild the report
and console, republish, push. The surface **does not move** between the
seats sitting and the refuters ruling.

## Traps this lab has already paid for

- **`tools/split.mjs --force` regenerates `src/` from the frozen labs and
  once ate a whole round's work silently.** `src/` is the living source.
  Do not run it.
- State names are `<product>.<state>` with a **dot**; a colon cannot be a
  Windows filename.
- **Absence reads as a pass, nine times now.** A dead selector, a
  `display: contents` zero rect, a missing refuter verdict, a rejected fix
  counted as a rejected finding, `visibility: hidden` hiding a control
  from a target audit, a count read off the wrong element (NaN passes
  every comparison), a claim guarded behind `if (the menu offered it)`,
  `.listBoard` losing to `.board` on source order — and, on 2 September,
  a page no gate ever loaded (the column at a desk width). Write the
  existence check BEFORE the claim, every time.
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
