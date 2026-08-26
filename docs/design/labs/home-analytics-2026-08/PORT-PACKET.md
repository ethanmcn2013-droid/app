# Port packet — Lately

**This is the deliverable.** The `elevate` skill owns the lab master, the two
gates, the ledger, the record and the artifacts. It does **not** own the port
into `src/`. A separate build session — with the product's own tests, its own
review and its own release gate — lands this.

Nobody currently owns that session. Say so out loud rather than letting it
stay open by default: three prior engagements, forty-five rounds, 1,358
findings and 919 fixes ended with **zero shipped pixels**, and not one of the
three retrospectives raised it.

---

## 1 · The master, and the configuration it was graded in

`docs/design/labs/home-analytics-2026-08/lately.html` — one file, no build
step, no external hosts. Fonts, fixture and renderer all inline or local.

The **frozen configuration** is the whole grading surface and nothing else:

| Key | Values | On an unknown value |
|---|---|---|
| `?state=` | `full` `partial` `quiet` `first-run` `empty` `loading` `error` | renders a fatal card, **exit 2** |
| `?v=` | `light` `dark` | same |
| `?motion=` | `play` `settled` | same |

`?motion=` defaults to `play` for a person and `settled` under
`navigator.webdriver`. That default is why frames are reproducible: a shot
taken 350ms into a 1.7s entrance photographs a moment, and 26 of 56 frames
differed between two identical runs before the key existed.

Fourteen state × ground combinations, four viewports — 390, 768, 1280, 1440.
Nothing else was graded and nothing else should be assumed to work.

## 2 · Both gates, and what they are worth

**These travel with the work.** The behaviour gate is the most durable thing
this engagement produced; leaving it in the lab throws away most of what was
bought.

| Gate | File | Runs | Asserts |
|---|---|---|---|
| Measured | `<skill>/scripts/audit.mjs --lab=<lab> --v=light\|dark` | ~40s | palette lock (18 colours), weights (400/600 only), families, WCAG AA against the **real composited** backdrop, hit targets, radii, motion, type ramp, leading and tracking by **role**, source size and space ladders |
| Behaviour | `<lab>/interaction-check.mjs` | ~4 min | **506 assertions** — real pointer travel, real touch, keyboard, resize, focus, live regions, every state, both grounds, four widths |

Both are green at hand-over. `@playwright/test` resolves from
`C:\Users\ethan\signal-studio-workspace\collateral`; run the skill scripts
with that as the working directory and pass an absolute `--lab=`.

**The rule the gate is built on, which the port must keep:** an assertion
that cannot fail is worse than no assertion, because it certifies. **Eleven
were found and rewritten during this engagement**, four in rounds 1–2 and
seven more in the closing round, and every one of them was guarding a finding
already recorded closed:

| What it did instead of what it claimed | Found |
|---|---|
| Measured `borderBottomWidth` — the edge on the baseline, invisible — to certify an open **top** | r1 |
| Grepped `document.styleSheets` for selector text and never rendered it, passing on a rule an animation's `fill: both` had pinned dead | r1 |
| Built the loading DOM and the arrived DOM from the same fixture in the same frame and compared them to each other (×3) | r1 |
| Read `document.body.textContent`, matching a template's own source inside `<script>` rather than the page | mine |
| Used `elementFromPoint` on a strip below the fold, reporting every mark stolen at every width | mine |
| Compiled `"\\b"` — four source backslashes — into a literal backslash followed by `b`, so two guards matched nothing across four states each (8 assertions) | r3 |
| Checked a KPI card's accessible name for `length > 12` and nothing else, after round 2 moved the row's sentence onto it | r3 |
| Passed on a disjunct that is true of any entrance whatsoever, for a claim about ordering | r3 |
| Sampled "settled" at 1800ms, 520ms after both motion modes converge | r3 |
| Called `scrollBy` on `.scroll`, which round 2 had stopped making a scroll container | r3 |
| Asserted `--h === 100` against a template that types `--h:100` | r3 |
| Computed an `instances` count and never asserted it | r3 |

Before adding an assertion, break the thing on purpose and watch it fail. If
you cannot make it fail, it is not a rule yet. Four of the five red lines in
this round's own verification pass were new probes measuring something other
than their subject — the discipline catches them, but only if you run them.

## 3 · The decision list

Everything below is a decision a porting session might reasonably undo
because it looks arbitrary. It is not. The argument sits beside the decision
in the master's own comments; this is the index.

### Type and colour

- **Two weights, 400 and 600.** The brief asked for 400/500/600. Only
  Regular and SemiBold ship as woff2 in this estate, so a declared 500 would
  render as a synthesised 400 — a weight nobody chose. Folded and recorded.
- **Identity is never hue.** The ink ramp fails a 0.10 chroma floor on all
  four steps. Magnitude is one hue, emphasis is one indigo mark against
  zinc, and the four status marks ship in a fixed order because red beside
  amber fails CVD separation at 4.4. This rule is **measured, inherited, and
  not to be re-derived.**
- **The dark twin is not an inversion.** Grounds flip; marks keep their
  jobs. Indigo steps up to 400 because 600 on near-black reads as a bruise.
  Secondary ink steps to zinc 400 because zinc 500 falls under 4.5:1 against
  `#18181b`. The lead card's plate becomes Ink 2, not white — pure white
  there is 34% more emitted light than Ink 5, in the middle of a row whose
  real marks are 3px meters.
- **Leading and tracking belong to a role, not a size.** A 15px control and
  a 15px paragraph are different objects. `data-type` on the element tells
  the gate which role it is, so the check and the design cannot drift.

### Space

- **The ladder is the only thing that sets vertical space.** Left to the
  browser, 27 elements carried 748px of margin in seven values, none of them
  a rung, each scaled by its own font size — and the gate reads the
  **source** for raw px, so it could never have seen them. `h1,h2,h3,h4,p {
  margin: 0 }` is load-bearing. Add rungs; never inline a pixel.
- **The document is the scroller.** With every pixel inside a `100vh` div and
  `html`/`body` pinned to 100%, space and page-down moved nothing on a fresh
  load, at any width, in any state. The rail is `position: sticky` at
  `height: 100vh`, not stretched.
- **`.scroll { overflow-x: clip }`, not `hidden`.** `overflow:hidden` on one
  axis forces the other to `auto` and would reinstate the scroll trap the
  clip exists to remove.
- **The reading rule is `flex: 1 1 0; min-width: 0`.** At a 40px basis the
  connector itself decided the wrap, so hiding it un-wrapped the row and
  showing it wrapped again — the measurement oscillated between two true
  answers.

### The chart

- **The hero figure and the twelve columns share one card** because they are
  the same claim. A numeral alone gives the delta and hides the shape;
  twelve columns alone make you do arithmetic. Neither is a caption.
- **The current week is hatched and open at the *top*.** It was open at the
  bottom, which sits on the baseline and is invisible. The top is the edge a
  reader reads completeness from. **Protected object — polish, never
  redesign.**
- **A 34px right-hand label rail.** The axis maximum, the previous-best tag
  and the live week's value all anchor to that edge; the gutter is what lets
  three labels coexist without dodging. They overprinted at every width
  before it.
- **Three gridlines, not a grid.** A column chart read against nothing gives
  the shape and withholds the magnitude; past three, the marks compete with
  their own scaffolding.
- **The previous-best rule draws last** (delay 1.1s), so the reader has read
  the shape before being told where the old ceiling was. Its **tag lives
  outside the clipped box with `z-index: 1`** — a `clip-path` keyframe with
  `fill: both` outranks any plain author declaration, so anything that must
  paint cannot sit inside it.
- **No scale on the first-run chart, and no fortnight rule.** One week of
  data: a gridline derived from a single datum labels the datum with itself,
  eleven faint slots are indistinguishable from eleven weeks of zero — which
  the honest-degradation contract forbids — and a threshold no mark can
  reach reads as a threshold every mark has beaten.
- **Week ticks are thinned in two measured bands** (1140–901 and 792 down),
  by `visibility: hidden`, not `opacity: 0` — an opacity-0 label is
  invisible to the eye and fully present in the accessibility tree.
  900–793 is the widest the plot ever gets, because the hero stacks there.

### The KPI row

- **Five cards over one denominator, and the denominator is a card in the
  row**, not a footnote under it. The meters are comparable only because of
  the shared nine. **Protected object.**
- **The row is read, not operated.** No hover, no press, no link role. The
  cards were anchors appending a bare `#`; the affordance ships when the
  destination does.
- **Each card's fact is spoken once, from the group's own name**, not from
  duplicated text leaves.

### The ages strip

- **A one-dimensional dot strip, because the finding is the tail** and a
  median is the specific summary that destroys it.
- **A reserved band (`min-height: 112px`), not a grown one.** The de-swarm
  stacks colliding marks, so the strip's height depends on data a loading
  frame has not read and therefore cannot promise. Dense data grows past the
  reserve; it never surprises the reader with it.
- **Marks inside the fortnight are a 2px ring, not a fill.** The stroke is
  the graphical object and clears 3:1 in both grounds; hollow-versus-solid
  is a fill difference, which the lock sanctions. Darkening the quiet fill
  instead would have cut separation from 4.25:1 to 1.30:1 and left the
  strip's only real reading carried by colour alone.
- **The disc is a pseudo-element, not the button.** An entrance that scales
  the control shrinks its own hit area for the length of the animation —
  these dots measured 27px against a 28px floor for 760ms of every load.
- **The expander is a 34×28 stadium, not a circle at -11px on every side.**
  At the old inset a stacked mark's box reached its neighbour's centre, and
  euclidean distance — which the gate was measuring — cannot see occlusion.
- **`.dot:active` sets the `--disc` custom property, not the pseudo's
  transform.** The pop keyframes run with `fill: both` and would outrank a
  plain declaration forever.
- **Every scale tick stands where its value stands.** Distributed by
  flexbox, the marks landed on 0/33/67/100% of the strip whatever they said,
  and agreed with the dots only because the shipped oldest job happens to
  round the axis to exactly 45.
- **The fortnight label flips by measurement**, reset before every
  measurement so it can flip back — not by a typed breakpoint. An anchor
  with one bound leaves the card the moment the rule sits near the end of a
  derived axis.

### The limits movement

- **"What this can't tell you" is a movement, not a footnote.** The reader
  meets the limit exactly where they would otherwise assume the opposite.
  **Protected object — may be made more beautiful, may not be shrunk.**
- **The trend the product cannot produce is drawn as the chart it would
  be** — its own columns, its own baseline, at 0.5 opacity — so the absence
  has the shape of a chart rather than a texture. **Protected object.**
- **A missing source resolves to *unavailable*, never to a fabricated
  zero.** A reader can never mistake "we don't know" for "it's zero".
  **Protected object, and the one most likely to be lost in a port**, because
  real data arrives as `null` far more often than a fixture does.

### States and motion

- **Seven states, all designed.** `quiet`, `empty`, `loading` and `error`
  are compositions, not fallbacks.
- **`.rise` uses `backwards`, not `both`.** A forwards fill sits in the
  animation origin and outranks every author declaration permanently: every
  `:hover` and `:active` transform on this surface was pinned dead by its own
  entrance, and the assertion meant to catch it grepped the stylesheet for
  the selector rather than rendering it. The end state *is* the resting
  state, so releasing the fill changes nothing that paints.
- **Nothing on the loading state moves**, and no shimmer anywhere — a moving
  surface reads as content arriving, and nothing is.
- **The skeleton is the real composition with its ink removed** — literally
  the same DOM, so the surface cannot jump when data lands. Hand-written
  heights drifted 48px on the hero and 28px on a card the first time this
  was written, and only at one width. It holds the geometry and **none of
  the facts**: every magnitude is neutralised in place.
- **A button sets `font-family: inherit`.** Left alone it shipped as Arial
  on two of the seven states.

### The instrument itself

- **One accessor per fact.** Every figure on screen reads from `D`, so a
  header and the marks beneath it cannot disagree. A surface that
  contradicts itself spends the credibility of the whole product.
- **The URL contract is read *above* the accessor**, so a state can own its
  facts before anything renders.
- **`derive-fixture.mjs` binds the master to
  `src/lib/project-truth-fixture.ts` and fails the build on drift** —
  reading date, owner, workspace, open count and the three root task titles
  verbatim. It also fails if a state's spoken sentence and its own marks
  disagree, which is the defect the derivation exists to make impossible.
- **The company name is never shortened.** Note bodies and email never enter
  this domain; that is enforced at contract level and survived every round
  untouched.

## 4 · The deferred builds

Every finding whose answer was "build X", recorded and never remediated
in-round. None of these is a design question left open; each is a thing that
does not exist yet, and the affordance ships when the thing does.

| # | What is missing | Raised | Severity | Why it was not built here |
|---|---|---|---|---|
| 1 | **A destination for a filtered list of open work.** | r1, r2 | defect | The hero stopped claiming a finished job is openable (r1) and the KPI row stopped offering link roles that append a bare `#` (r2). A role the screen cannot honour is worse than no role. The affordance ships when the route does. |
| 2 | **A designed retry.** `#retry` is unwired, like every control on this master. | r2 | defect | Needs live data wiring the lab does not have. The lab has never exercised a loading→error→success transition, so the retry's own states are ungraded. |
| 3 | **Per-column values on the twelve-week chart.** | r1 | refinement | All twelve are named in the chart's spoken line. Twelve 22px buttons would fail the hit-target floor at 390 and triple the keyboard path of a reading surface. If the product wants them, they need a different interaction, not twelve more tab stops. |
| 4 | **A bound record-start instant**, if the refusals are ever to name a date. | r1, r2 | refinement | The fixture holds none, and inventing one is precisely the defect `derive-fixture.mjs` exists to prevent. |
| 5 | **A chart-wide answer to the 3:1 non-text floor.** | r2 | defect | See §5 — this one is open, measured, and needs a design decision rather than a token swap. |

**Round 3 deferred nothing.** The freeze was declared before the seats sat and
every one of its twenty-one confirmed findings was answerable on the surface
or in the gate. That is itself a signal: at the close, nothing the panel found
required a new object.

## 5 · The open ledger

**The ledger did not close. The engagement stopped on its declared budget of
three rounds with the distance stated, which `stopping.md` calls finished work
provided the distance is published. This is that statement.**

The ending is two consecutive rounds with no confirmed `blocking` or
`misleading` finding, both gates green, on a frozen configuration, with
self-inflicted cost under 25% in both.

| Clause | r2 | r3 | Met? |
|---|---|---|---|
| No confirmed `blocking` | 0 | 0 | ✅ both |
| No confirmed `misleading` | 0 | 0 | ✅ both |
| Both gates green | yes | yes | ✅ both |
| Frozen configuration | **no** | yes | ❌ r2 |
| Self-inflicted under 25% | **36%** | **67%** | ❌ both |

Two of five clauses fail, and the one that fails hardest is getting worse, not
better. `round-metrics.mjs` returns its own verdict without being asked:

> two consecutive rounds above 25% self-inflicted. The loop is measuring the
> fixer, not the work — stop and publish the honest distance.

### What is still confirmed and unfixed on the surface

**Exactly one thing.**

- **The chart's context columns sit at 1.48:1 (light) and 1.70:1 (dark)**
  against the card, under the WCAG 1.4.11 non-text floor of 3:1. Severity
  `defect`. Confirmed in round 2 and not re-raised in round 3.

  It is unfixed because the obvious fix inverts the chart. The current week is
  a hatch that composites to **1.71:1** — *fainter than the columns it would be
  contrasted against* — so darkening the eleven context columns alone makes the
  live mark the weakest thing in the frame, and `.bar.live` paints in zero
  states. The strip half of the same finding **was** fixed: quiet marks became
  a 2px ring, solid past the fortnight, which clears the floor without leaning
  on hue. The chart half needs a design decision. Measurements:
  `panel/round-2/refuters/chart-and-strip-marks-fall-under-the-non-text-floor.json`.

  Note the measured gate does **not** cover this: `audit.mjs` grades text
  contrast against the real composited backdrop and does not grade non-text
  contrast at all. Whoever ports this should not read a green measured gate as
  a 1.4.11 pass.

### What the numbers actually say

| r | seats | floor | ceil | spread | raised | confirmed | refuted | blk | mis | def | ref | self | frozen |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 7 | 7.0 | 8.3 | 1.30 | 37 | 29 | 22% | 0 | 6 | 22 | 1 | 0% | no |
| 2 | 3 | 7.6 | 8.3 | 0.70 | 19 | 14 | 26% | 0 | 0 | 13 | 1 | 36% | no |
| 3 | 7 | 8.6 | 9.1 | **0.50** | 28 | 21 | 25% | 0 | 0 | 14 | 7 | **67%** | yes |

Read the last two columns together. Severity is clean and has been for two
rounds; the spread between the harshest and the kindest seat has narrowed every
round, from 1.30 to 0.50, which is what agreement looks like. And two thirds of
what the closing round found was damage the previous two rounds' repairs had
done — seven of the twenty-one were assertions written to close earlier
findings that could not fail for the thing they named.

**That is the honest reading: the surface is close to finished and the repair
process is now the largest single source of defects in it.** More rounds would
not converge; they would keep finding the last round's repairs. The instrument
says stop, and stopping is the finding.

## 6 · Port risks — where the lab and the product diverge

The master is a lab artifact. It inlines what the product imports, fakes what
the product fetches, and hard-codes what the product routes. **A porting
session that copies it wholesale will ship a fixture.**

1. **The data is a fixture, not a query.** Every number derives from
   `src/lib/project-truth-fixture.ts` through `derive-fixture.mjs`. The
   product must produce the same seven metric shapes from real sources, and
   must produce them *per state* — the lab manufactures `quiet`, `empty` and
   `first-run` by slicing a scope, where the product will meet them by
   accident.
2. **`null` is the shape the fixture under-exercises.** The
   honest-degradation contract is the protected object most at risk in the
   port: the lab has two named refusals and a hand-built *unavailable* card,
   and real sources will return absent, partial, stale and errored in
   combinations the fixture never produced. Every new absence must resolve to
   *unavailable*, never to zero.
3. **Nothing on this surface is wired.** The retry is `#retry` with no
   handler. There is no destination for a filtered list of open work. Every
   control is inert by design, so the lab has never exercised a loading→error
   or error→success transition, focus after a real refetch, or a second
   render with different data.
4. **The rail is inert furniture, `aria-hidden`.** The product's real rail
   has four working controls, its own focus order and its own responsive
   behaviour. Everything the panel concluded about keyboard order and focus
   management on this surface was concluded with that rail out of the tree.
5. **The tab strip is drawn, not routed.** Lately sits beside Today's Signal
   and the Full Briefing; the lab draws all three and routes none.
6. **Fonts are local woff2 in the lab.** If the product serves Geist any
   other way, re-run the measured gate — the weight fold in §3 is an estate
   fact, not a preference.
7. **`?state=`/`?v=`/`?motion=` do not exist in the product.** They are the
   grading harness. Whatever replaces them must keep the property that made
   them worth having: **an unknown key stops rather than silently rendering
   the default.**
8. **Scroll ownership is a whole-app decision.** "The document is the
   scroller" was a defect fix here; in the product it is a claim about the
   app shell, and the rail's stickiness depends on it.
9. **Motion under `prefers-reduced-motion` was graded; motion under real data
   latency was not.** The entrance choreography assumes everything arrives at
   once.

## 7 · The frames

`docs/design/labs/home-analytics-2026-08/shots/` — 56 PNGs, re-shot at the close, every declared
state at every declared viewport in both grounds, all reproducible under
`?motion=settled`. `frames.json` is the manifest. These are the before/after
record and the only evidence a change was real.
