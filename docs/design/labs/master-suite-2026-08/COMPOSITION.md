# Composition — every place the three sources disagreed

**Published** https://claude.ai/code/artifact/832d5b84-e6a0-43e6-a151-1f80dc17bd76
**Branch** `design/master-suite-2026-08` · **Lab** `docs/design/labs/master-suite-2026-08/`
Built 2026-08-26 from the three labs frozen at that date, byte copies in `_source/`.

This is the argument document. Everything below is a decision I made where the
sources contradicted each other, with the reason. Overturn any of it.

---

## 0. The one thing to know before the rest

**The five diverging tokens are seven, and one of them is not a nuance.**

`--paper` is declared at `:root` by two of the three products and means two
different things:

| Source | `--paper` |
|---|---|
| `foundation.css` | `#ffffff` — the colour |
| Notes `master.css` | `0 1px 1px rgba(17,17,17,.04), 0 3px 6px …, 0 10px 22px …` — the paper stack's shadow |
| Timeline `shell.css` | `#ffffff` — the colour |

In one document with one `:root`, whichever loads last wins for everyone. Timeline
last and Notes' pile becomes a solid white blob under fourteen rounds of paper-on-
paper work. Notes last and Timeline's `--fore: var(--paper)` on the ink ground
resolves to a shadow string, which is not a colour, and the ink twin paints nothing.
Neither is a difference anybody would spot in a screenshot review.

**So no token is reconciled.** Each product's `:root` is scoped to its own app
element and each keeps every value it was locked with. The reconciliation the brief
asked for turned out to be the wrong shape of answer: two of these tokens are not
the same token with two values, they are two tokens with one name.

---

## 1. The seven token deltas, and what each resolves to

| Token | Tasks | Notes | In the suite |
|---|---|---|---|
| `--indigo-wash` | `rgba(79,70,229,0.09)` | `rgba(79,70,229,0.08)` | **both** — product-scoped |
| `--ink-4` | `rgba(17,17,17,0.28)` | `rgba(17,17,17,0.30)` | **both** — product-scoped |
| `--line` | `rgba(17,17,17,0.08)` | `rgba(17,17,17,0.09)` | **both** — product-scoped |
| `--line-soft` | `rgba(17,17,17,0.06)` | `rgba(17,17,17,0.055)` | **both** — product-scoped |
| `--wash` | `rgba(17,17,17,0.04)` | `rgba(17,17,17,0.035)` | **both** — product-scoped |
| `--tr-14` | `-0.014em` | `-0.012em` | **both** — product-scoped · *not in the brief* |
| `--tr-18` | `-0.022em` | `-0.021em` | **both** — product-scoped · *not in the brief* |

`tools/survey.mjs` measures this; it is where the two extra ones came from.

**Why not pick one of each.** Every one of these is a value a panel settled inside
a room. `--ink-4` at 0.30 exists because the Notes gate caught 0.28 carrying
uppercase labels below AA; `--line` at 0.09 is the Stack's index rule and 0.08 is
the Floor's tray rule. Picking a winner is re-deciding fourteen and nineteen rounds
of somebody else's argument in order to save five declarations. The scope costs
nothing and keeps both locks true.

**`--dur` and `--curve`** differ only in indirection — Tasks reaches them through
`foundation.css` as `--ease-out` / `--motion-fast`, Notes states `140ms` and the
cubic-bezier. `shell.css` states the indirected form once, at `:root`, for the
spine. Same resolved values, and `foundation.css` is where reduced motion zeroes
them, so the indirection is the one that keeps that working.

**What `shell.css` does own at `:root`:** the three colours, `--ink-1`, the five
`--on-ink-*` / `--chrome-*` chrome tokens, `--r-sheet`, `--inset`, `--rail`,
`--tap`, `--dur`, `--curve`. Every one is byte-identical in both source shells. The
spine is the object the two products already drew the same way, which is what let
it be hoisted without a decision.

**One correction to the source, forced by the scoping.** Both labs declared
`:root { --inset: 12px }` at ≤900 and `9px` at ≤720 *inside their own stylesheet*.
Scoped, the floor and the spine — which now stand outside both — could no longer
see it, and the sheet sat 6px out of place at 768. The step belongs to the floor, so
`shell.css` states it. Caught by the fidelity diff, not by eye.

---

## 2. The clock

`NOW` in Notes' `data.js` said **15 July**. Its own comment above it said 16 July,
its own `today` string says "Thursday 16 July" — and 16 July 2026 is a Thursday
while the 15th is a Wednesday — and its own subject says "Saturday 18 July, in 2
days", which is two days after the 16th and three after the 15th. Tasks and Timeline
both pin `2026-07-16`.

**Resolved to 16 July.** The comment was right and the number was wrong.

**The visible consequence, which is not nothing:** `dayOf()` names the weekday a
note was written on, so every note two or more days old moves one day. The index's
group headings read Tuesday / Monday / Sunday where they read Monday / Sunday /
Saturday. That is the correct set for a Thursday, and it is why the notebook and its
own headline agreed about the date but not about the week.

`src/fixture.js` now asserts one clock at load, along with the cast, the venue and
the milestones. A disagreement throws rather than shipping.

---

## 3. The ledger told the truth about the wrong board

Notes' ledger column carries a **Tasks lane**, and the two fixtures disagreed about
all three rows:

| Note | Task | Notes said | The board says |
|---|---|---|---|
| `s1` Clear Sunday 11am late checkout | `demo_task_checkout` | In progress | **Done** |
| `s2` Chase linen order | `demo_task_linen` | Waiting | **Done** |
| `s3` Send registrar paperwork | `demo_task_registrar` | To do | **Done** |

Side by side in one suite that is the product contradicting itself on two screens.
The lane is a Tasks fact — Notes' own comment at `sendPeel` says so — so **the board
is the authority and the ledger is derived from it at load**.

**The cost, stated plainly:** the ledger's lane column now reads Done, Done, Done
where it read three different lanes. It is a duller column and it is a true one. The
alternative was moving three of five cards out of the Tasks Done column, which
changes "5 of 13 done", the Done column and the completion beat on a board that has
survived nineteen rounds. If you would rather have the three lanes back, the honest
fix is in the *Tasks* fixture, not the Notes one.

**Left alone, and visible:** `s3` says it crossed two days ago; the board says the
task was completed on 2 July, two weeks before. Nothing in Tasks records when a task
was created, so there is nothing to reconcile it against without inventing a field.
On `BUILD-LIST.md`.

---

## 4. The join — which note became which task

Six notes in the notebook say they went to Tasks. Tasks carries exactly six tasks
marked `fromNote`. They are the same six, and `src/fixture.js` declares the join and
asserts the count:

```
n01 → demo-t-01    n02 → demo-t-02    n09 → demo-t-06
s1  → demo_task_checkout    s2 → demo_task_linen    s3 → demo_task_registrar
```

Nothing here is invented: three pairs share a title word for word, and the other
three are the note whose wording the task was edited from. Both fixtures derive from
`src/lib/review-suite-fixture.ts`, which is why the count comes out even.

This is what makes **"In Tasks as …" work on a note that crossed before the fixture
was written**, not only on one that crossed a minute ago. The wordings still differ
between the two sides — "Confirm marquee sides with hire company before Thursday"
against "Confirm marquee sides with the hire company" — and that is left alone: a
task's title legitimately drifts from the note it came from, and both strings are
real product data.

---

## 5. The spine — one object, and what it cost each product

The rail is now rendered once, by `app.js`, from **Tasks' implementation**: its
roving tabindex, its `notYet()` honesty, its `railCurrent` discipline through
repaints. Notes' was a second drawing of the same object with fewer of those.

The tiles are the union of what the two products drew:

```
mark(More) │ Home · Notes · Tasks · Timeline │ Inbox · Help │ Add │ OR
```

Three of those are doors and six say they are not here yet. Home, Inbox, Help, More
and the account tile are untouched, in the tab order, with the strings the two
products wrote.

Three differences fall out of the rail being one object:

**`.railMark i` — the dot on the mark is ink, not indigo.** Tasks removed the indigo
there deliberately and states the rule at class level: *"the accent is spent only on
what the specimen sheet says it means"*, naming the rail dot as one of the two places
that made the claim false. Notes' master still painted it indigo. One object, so it
takes the rule that was argued rather than the one that was inherited. **This is a
visible change to the Notes surface.**

**`.railAvatar` — the account disc is Notes' 11px, not Tasks' 10px.** Found by the
Notes audit, which fails a font size off its declared eight-step ramp and fails
`line-height: normal`. Tasks' `10px` / `0.04em` / no declared leading is on no
ladder in either lab; Notes' `11px` / `0.075em` with a compensating `text-indent`
and `1.28` leading is defended by a stated rule and an automated gate. **This is a
one-pixel change to the Tasks surface** — the 74–86 differing pixels the fidelity
diff reports on Tasks are this disc and nothing else.

**`.word::after` — each product keeps its own.** The full stop after "tasks" is ink
and the one after "notes" is indigo, exactly as each was locked. That mark is on the
sheet's own head, which is product surface, so it is scoped rather than shared. It
looks like an inconsistency between two screens and it is two locks, both intact.

---

## 6. The phone — the one place the two locks point opposite ways

Both locks say the same sentence: *on a phone the capsule and the dock are the same
object.* They merge them in opposite directions.

- **Tasks** folds the dock into the capsule: the rail becomes a bar at the foot and
  carries the add verb; `.dock { display: none }`.
- **Notes** folds the capsule into the dock: `.rail { display: none }` and
  `railTiles({tight:true})` puts Notes / Tasks / Timeline inside the dock.

With one rail these cannot both be true at once — but they do not have to be at the
same time. **The merge target follows the mounted product**, keyed on
`#deck[data-product]` in `shell.css`. Each surface at 390 is what it was at 390, and
the spine works in both: through the bar in Tasks, through the dock tiles in Notes.
Both are driven in `verify.mjs` §4.

Timeline has no dock and no add verb, so at 390 it takes the bar without the add
tile. That is the one new answer in this section and it is a hidden control, not a
new one.

---

## 7. Timeline — mounted, not re-skinned

`#deck` carries `data-product`; each product's app element carries its own
decisions. Tasks and Notes are `display: contents`, so their sheets and overlays lay
out as direct children of `.floor` exactly as when each drew its own — that is what
makes the sheets pixel-identical. **Timeline is the exception: its app element *is*
the sheet**, because its paper ground is the white sheet rather than something
standing on one.

- `body { … }` from Timeline's `shell.css` became `[data-app="timeline"] { … }`, so
  its paper ground and its type paint the sheet.
- Its three `100dvh` values are re-based on the sheet, the same correction the
  compiled Timeline console already makes.
- **The lab caption is not rendered.** `OWNER · MARA & FINN IN FULL FLIGHT · B ·
  THE APPROACH` was printing across the top of a production application. Timeline's
  own `shell.css` calls it *"lab furniture, not product"*. Same rule as the console
  chrome. Removed in `mount()` rather than hidden in CSS, because there is no
  production version of it to restyle into.
- The artifact loses **18px of width at 390** — the floor's 9px inset on each side.
  One moment title takes two lines for it. The measure was derived to hold a
  two-line item without collision; `verify.mjs` §1c measures that rather than taking
  the lock's word for it.

**Known and left:** on the ink twin the sheet stands on the ink floor and both are
`#111111`, so the sheet's edge disappears. Paper is the shipping room and ink is a
deep link, so this is not on the surface that ships. On `BUILD-LIST.md` rather than
fixed, because inventing an edge for it is new surface in round one.

---

## 8. The fonts

The variable `Geist.woff2` and `GeistMono.woff2` from the Tasks and Notes labs,
inlined as `data:` URIs — **not** Timeline's three static faces. 137 KB of font for
three products instead of 142 KB for one.

§8 of the brief asks this be proved before it stands. `verify.mjs` §1b measures
**every text box in the Timeline artifact** in the lab and in the suite, by weight:
**75 boxes, 70 at 400 and 2 at 600, identical at 1440**, and identical at 390 apart
from the boxes that lost the floor's inset. The swap is invisible.

---

## 9. What each surface actually costs

Measured, at 1440 · 1280 · 768 · 390, in `verify.mjs` §1 and `shots/PAIRS.html`:

| | the sheet | the spine |
|---|---|---|
| **Tasks** | pixel-identical at all four widths | 74–86 px — the account disc, §5 |
| **Notes** | pixel-identical at all four widths | ~14,500 px — the capsule column, §5 |
| **Timeline** | re-composed onto the sheet by design | measured element by element, §1b |

The number the brief asked for is the first column. It is zero.

---

## 10. The gates

**Repointed and green** — each copied out of its lab with one asserted edit, the
line that builds the URL, so every ladder, threshold and state list travels
unchanged (`tools/gates.mjs`):

- **Tasks** `scripts/design/audit.mjs` — 6 states · palette, weights, families,
  contrast, targets, radii, motion · **0 failing**
- **Notes** `scripts/design/notes-audit.mjs` — 10 states × 4 viewports + coarse
  pointer · the above plus type ramp, leading, measure · **0 failing**
- **Timeline** the elevate `audit.mjs` — 14 states × 6 viewports · the above plus
  the size, space, tracking and leading ladders · **0 failing**

Two edits were needed beyond the URL, both in Timeline's, both recorded in
`tools/gates.mjs`:

1. **Scoped to `#tl`.** The Timeline lock says the lab *"invents its own material
   system"* and supersedes the Studio Floor by name. Pointed at the whole page its
   ladders grade the Studio Floor spine and report 242 space failures on the
   capsule, which is not a finding about anything — it is two material systems in
   one frame.
2. **Given its own stylesheet list.** Its size and space ladders read the CSS text,
   not the render, and find it through the lab's `build.mjs`. Without that it read
   the whole composed page.

**Worth knowing:** the Timeline lab's own audit, run against the lab today, reports
**1 contrast failure at 768** that the composed file does not have. The composition
did not introduce it and does not carry it.

**Not repointed, and why** (also printed by `tools/gates.mjs`):

- **Tasks** `interaction-check.mjs`, `verify-tasks.mjs` and **Notes**
  `notes-interaction-check.mjs` drive the lab file through the *console's* harness
  (`window.__signal`, the customizer shell). The console does not exist here, so
  what they would grade is a different page. `verify.mjs` §3 and §4 drive the
  composed file directly instead, in the suite's own vocabulary.
- **Timeline** `interaction-check.mjs` — 845 assertions — is genuinely repointable
  and is **not done**. It is the largest single piece of outstanding verification in
  this build. On `BUILD-LIST.md`.

---

## 11. Smaller decisions, for the record

- **`?v=` is an alias for `?ground=`** on Timeline, because that is the lab's name
  for the same room and it is what let the Timeline gate reach this file with its
  config unchanged.
- **`data-product` in the markup is the default product**, overridden by `?p=`. That
  is what lets a copy of the page open on Notes with no query string, which is how
  the three audits — none of which knows about `?p=` — are pointed at it.
- **`history.replaceState` is wrapped in try/catch.** A sandboxed artifact frame and
  a `file://` URL both refuse it. Reading the URL is the contract; writing it back
  is a courtesy, and the suite is not allowed to fall over because the address bar
  would not take a hint.
- **One live region.** Both products appended their own `#say` to `document.body`;
  two elements with one id, and the second never read. `app.js` owns it.
- **Keyboard handlers are guarded.** All three products keep their DOM when they are
  off the floor, so all three global `keydown` handlers were live at once. Each now
  returns unless its product is the one on the floor.
- **Notes' `rail()` is renamed `railUnused()`**, not deleted — the phone dock still
  calls `railTiles()`, and leaving a second full-height capsule renderer in the file
  is a trap.
- **The generated stylesheets keep their comments.** The first pass stripped them;
  `tools/css.mjs` now scans a comment-blanked copy and slices the original, so ~2,000
  lines of reasoning survive into `src/`. It is also load-bearing: Timeline's gate
  reads trailing `/* off-ladder … */` markers out of the stylesheet, and a
  comment-free copy failed a gate it should pass.
- **`src/` is the source after the first derivation.** `tools/split.mjs` refuses to
  overwrite without `--force`. Every one of its 30 edits is an asserted patch that
  throws unless it matches exactly once.

---

## 12. Excluded from `apply.mjs`, deliberately

`_wt-design-notes/scripts/design/family/apply.mjs` idempotently patches the black
`famRail` into every source in its `set.json`. **The master suite is not registered
there and must not be.** A later run would inject the console's family rail into the
one page that must never carry a pixel of console chrome. `verify.mjs` §5 asserts no
`fam:start` and no `data-fam-ground` reached the file, so a mistake fails the gate
rather than shipping.

## The status colour system, and the palette lock it spent

Added 2026-08-27, on the founder's instruction, after a monochrome version
was built, reviewed and rejected: "the coloured dots aren't noticeable at
all". An `--ink-4` dot is 2:1 on white, which is a smudge.

Five lanes, five colours, and every one of them is INFORMATION rather than
decoration — on at rest, not only while something is dragged over them.

| Lane | Dot | Wash |
|---|---|---|
| To do | `--ink-3` | ink 5.5% |
| In progress | `#4f46e5` | indigo 9.5% |
| Review | `#eab308` | yellow 17% |
| Waiting | `#f97316` | orange 11.5% |
| Done | `#22c55e` | green 13.5% |

Three things about it are load-bearing and were each learned the hard way:

1. **A wash is its own colour, not a diluted dot.** The first version derived
   every wash by diluting the dot, and a dot must be dark to hold its edge —
   diluting a dark colour toward white destroys its chroma. Those washes
   measured chroma 7–13, which is grey with a cast. The founder called them
   "a bit dirty" and that is exactly what the number says.
2. **The washes are balanced by luminance, not by a shared alpha.** One alpha
   across five hues is five different weights: at 11% the indigo sat 16%
   below white and the grey 9%. Each alpha is solved so every lane lands
   11–14% below white.
3. **The dots are FLAT.** An earlier version gave each a deep rim of its own
   hue so a bright fill would have an edge. At 8px a 1.5px inset ring leaves
   a 5px core — not an outline, a gradient — and it read as a glow, or as a
   dot painted in two colours. The dot is one flat colour and it is the
   lighter of the pair.

The bright fills do not clear 3:1 on white unaided, and do not need to:
every lane's name is set in type beside its dot, so no information here is
carried by colour alone.

## The rail's accent

From the founder's own rail-redesign session (Turn 2, direction 1a): the
accent lands on the tile, the glyph and the label of the active product
together, and nothing else in the rail spends indigo. It replaced a solid
white pill, which was the loudest object in the chrome — a white slab on an
ink rail out-contrasts the sheet it is pointing at, so the rail competed
with the work.

`--indigo-on-ink` is `#a5b4fc`, not `--indigo`. Two reasons: `#4f46e5` is
the accent on PAPER and is barely brighter than the rail on ink; and the
design's own `#818cf8` measures 4.19:1 on the tinted tile, which is fine for
a glyph and under the floor for the LABEL, because a label is text. Lifting
one step keeps the design's rule whole rather than splitting the accent in
two. `#a5b4fc` is that session's own `invGlyph`.

## One brand dot

The three wordmarks carried three different full stops — Tasks' was ink,
Timeline's was `--fore` (a dot that changed colour with the room), and only
Notes' was indigo. Overruled by the founder: it is the brand, it is indigo,
and it is the same object in all three. Its radius is stated as `999px`
rather than `50%` so that no preset and no later rule can square it.

## Projects

`src/projects.js` holds three demo projects and the API the switcher drives:
`apply`, `rename`, `create`, and `ALL`. Two rules in it are worth keeping:

- **Arrays are refilled in place, never rebound.** `__TLFIXTURE.milestones`
  is a reference the fixture's own closure holds, and `live()`, `counts()`
  and `nextUp()` read the closure rather than the property. Rebinding it
  changed the Timeline's name and left its moments on the previous project.
- **All projects is assembled on demand, never cached.** It is a view of the
  three, so a rename or a new task has to reach it without anything being
  told to sync.
