# Measure — the language this engagement extracts

Timeline was the first product to wear this. Home, Notes and Tasks are
next, and they should not have to read Timeline's stylesheet to do it.
This page is the contract: six ladders, four rules, four behaviours.
Everything here is implemented and gated today, and each entry names the
class that implements it and the assertion that proves it, so a second
product can inherit the decision rather than the code.

The name is **Measure**. It is the one idea the rest hangs off: *a
quantity is drawn as a distance, and the distance is the truth.*

---

## The six ladders

All six live in `shell.css` and carry no product noun. They are the
portable half, and they are enforced by `audit.mjs` — a value off a
ladder fails the build, and a ladder bypassed by a literal fails it too.

| Ladder | Tokens | What it decides |
|---|---|---|
| **Ink** | `--ink-04 … --ink-90`, `--paper-04 … --paper-90`, and the `--fore-* / --back` inversion | Every colour. Two grounds, one set of names: `--fore` is whatever is written on `--back`, at nine declared alphas either way, so flipping the ground is nine lines and not a parallel stylesheet. Over paper, ink at 0.62 is the floor for type; over ink, paper at 0.46 is. Below those, both ladders draw rules and never letters. |
| **Size** | `--size-label … --size-countWide` (13 steps) | Every font size. Named by **role**, not by pixel, and paired to the leading and tracking ladders so a component picks one word and gets all three. |
| **Leading** | `--lead-display, -title, -head, -date, -body, -label` | Every line-height. Bound to role, and an element may declare its role with `data-type` where size cannot tell a title from prose. |
| **Tracking** | `--track-label, -labelWide, -data, -body, -head, -title, -display` | Every letterfit. One family at one size renders at one value across the whole state matrix. |
| **Space** | `--gap-hair … --gap-page` (9 steps) | Every vertical margin and padding. Anything genuinely geometric — a rail gutter, a reserved band — says so with an `off-ladder` annotation and a reason. |
| **Motion** | `--t-fast .08 / --t-base .14 / --t-slow .22`, one easing | Every transition. Nothing floats idly; motion answers something the reader did. |

**One accent.** `--accent` is indigo. It is a *mark*, never a ground,
and it is spent once per screen on the thing that is happening. Two
accents on one screen means neither is one.

---

## The four rules

1. **Nothing is written against `--ink` or `--paper` directly.** Write
   against the `--fore` ladder, or the surface breaks the moment the
   ground flips. The one exception is an artifact that leaves the
   product — a rasterised card that lands in someone else's client —
   which pins its own ground deliberately and says why.
2. **Position is the quantity.** Where a design draws an amount, it
   draws it as a distance: `top = amount × pixelsPerUnit`. The scale is
   a page-size decision and may differ per medium; the *proportion*
   between one gap and the next may not. Nothing is hand-placed.
3. **Every state exists in words.** A fact carried only as colour,
   weight or a line through text is a fact half the readers do not get.
   If a row is hidden, cancelled or overdue, the row says so.
4. **Anything not built has no button.** Inert text is a deliberate
   choice; a control that does nothing is a lie the gate fails on.

---

## The four behaviours

These are the inventions, and they are what a second product actually
wants. Each is stated as a contract, not as a class.

### 1 · The row is the control
The whole row is the hit area; the visible mark names the **action**,
never the state.
- *States*: rest, hover, focus-visible and `:active` are four distinct
  ink densities, never a reflow — the box may not move under the finger.
- *Keyboard*: Enter and Space open it; Escape closes and returns focus
  to the row that opened it.
- *Accessible name*: carries the title, the date, the distance and the
  visibility, in one sentence.
- Today: `.b-grab` / `.b-item` · proven by *"the row control names its
  own action"*, *"a press is answered"*, *"the row is the control"*.

### 2 · The travelling reversibility node
**One** node reports what changed. It moves to wherever the change was
made — into the editor while it is open, back to the rail when it
closes, to the bottom edge on a phone — and it is silent and inert until
it has something true to say.
- Every change carries its own undo closure **and the view it happened
  at**; undoing restores both.
- Undo peeks before it pops, so a press that cannot restore anything
  does not clear the bar as though it had.
- The advertised key is bound to the document, not to a subtree, and
  stays out of the way of native undo inside a text field.
- Today: `.b-undo` / `remember()` / `undo()` · proven by *"the way back
  returns the view"*, *"deleting does not move the page"*.

### 3 · The stepper states its ceiling
A control at the end of its range stays enabled and says why, in a true
sentence. It never greys out and never absorbs the press.
- One writer per fact: a single function derives the new value and
  rewrites *every* derived string in the same frame — the count, the
  date, the accessible name, the readout, the surrounding prose.
- The control's own box is identical before and after the press.
- Today: `setAway()` / `.b-step` · proven by *"the ceiling states
  itself"*, *"the steppers do not move"*.

### 4 · Focus never moves the page
The browser scrolls to whatever takes focus. Hand focus over through one
function that passes `preventScroll` and nudges only when the target is
genuinely off screen — and, where a docked panel is fixed, follow focus
out from behind it rather than fencing it in.
- A docked panel is **not** a modal: no scrim, no body lock, no trap.
- Today: `land()` / the `focusin` handler · proven by *"nothing parks
  under the sheet"*, *"the page keeps its place"*.

---

## What a second product inherits, and what it does not

**Inherits, unchanged**: `shell.css` in full — all six ladders, the
`--fore`/`--back` inversion, the visually-hidden helper, the one focus
treatment, the reduced-motion neutralisation, and the four rules above.

**Inherits as a contract, re-implemented**: the four behaviours. Notes
has no measure, but it has rows, an editor and changes to reverse, so it
wants 1, 2 and 4 verbatim and 3 wherever a value has a limit.

**Does not inherit**: every `.b-*` class. They are named for this
product's nouns and this direction's letter, and they are the
implementation, not the language. A second product writes its own and is
held to the same ladders and the same four contracts by the same two
gates.

**Still open**: the `.b-*` prefix has not been split into a neutral
component layer, and the thirteen size steps have not been collapsed to
a smaller set. Both change pixels, and both were deferred deliberately
rather than swept late in an engagement — recorded here so the next
product knows it is inheriting a naming job, not a broken one.
