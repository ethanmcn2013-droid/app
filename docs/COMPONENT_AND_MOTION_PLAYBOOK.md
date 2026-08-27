# Signal Studio — World-Class Component & Motion Playbook

**Research sprint · 2026-08-27 · no code changed**

Scope: an interaction, motion and component review of the **August 2026
composed suite** — the redesign that puts Notes, Tasks and Timeline on one
floor — plus research into the products worth learning from, five competing
motion directions, a recommended motion language, a token system, a component
system, four inventories, a scored priority matrix, and a Monday brief.

Measured against the composed suite artifact and the repository at `a709e22`.
Screenshots were captured from the artifact's own source, at `?p=tasks`,
`?p=notes` and `?p=timeline`, after the final code state of this audit.

> **Revision note.** The first draft of this playbook audited the *shipping*
> app in demo mode and reported that the three products carried three
> different chromes. That finding described the old surface and has been
> withdrawn — the composed suite unified the chrome, and did so well. This
> revision reviews the redesign on its own terms. Where the old finding
> survives at all, it survives as a **delivery** observation (§2.5), not a
> design one.

---

## 1. Executive summary

**The redesign already solved the hard problem. What is left is one missing
frame of continuity, and a token vocabulary that has three names for the same
speed.**

The composed suite is a genuinely strong piece of work, and the strongest
part of it is architectural rather than visual. `app.js` mounts all three
products at once and never tears one down:

> *"Nothing is torn down. The product leaving keeps its DOM, its scroll, its
> focus and every fact it was holding… Sort the board, read a note, come
> back — the board is still sorted."*

That is the substrate that "the interface transforms rather than replaces"
requires, and it is already built. Almost every product that wants this
effect has to rebuild its routing to get it. Signal Studio does not.

Five findings, all measured against the composed suite:

**1. The switch itself is a hard cut.** Everything is in place for
continuity except the continuity. `go()` calls `apply()`, which does:

```js
host.toggleAttribute("hidden", !on);
host.setAttribute("inert", "");
```

Both products are in the same document at the same moment. Nothing
interpolates between them. Because the DOMs coexist, the fix is a
same-document `startViewTransition()` wrapped around `apply()` plus a
`view-transition-name` on the sheet and the active rail tile — roughly five
lines, no navigation involved, no cross-document caveats. **This is the
single highest-return change available and it is far cheaper here than it
would be in almost any other codebase.**

**2. Three speeds carry four names between them.** In the composed suite:

| Value | Names it answers to | Transition uses |
|---|---|---|
| 140ms | `--dur`, `--t-base`, `--motion-fast` | 46 · 5 · 1 |
| 220ms | `--dur-settle`, `--t-slow`, `--motion-base` | 5 · 2 · 1 |
| `cubic-bezier(.23,1,.32,1)` | `--ease`, `--curve`, `--ease-out` | — · 3 · — |

Two reviewers cannot tell whether two components move identically without
resolving the aliases first. Worse, `--t-` is overloaded across dimensions:
`--t-base` is `0.14s` while `--t-11` … `--t-34` are type sizes in pixels.
The prefix means both "time" and "type".

**3. The ladder has no rare tier.** `--motion-slow: 400ms` is declared and
used in **zero** transitions; in practice nothing moves for longer than
220ms. That is correct for the frequent and occasional tiers and leaves the
suite with no vocabulary at all for a moment that has earned one (§10).

**4. Timeline's sheet head has no wordmark.** Tasks opens `tasks.` and Notes
opens `notes.`, both with the dot, in the same position in the sheet head.
Timeline opens straight into `The Orchard, events`. Three heads, two
conventions — the one remaining chrome inconsistency, and a small fix.

**5. The component layer is still bespoke.** The repository has no Button,
Input, Select, Popover, Tooltip, Tabs, Card, Badge, Calendar or Skeleton
primitive, and **477 raw `<button>` elements**. `due-calendar.tsx` has no
`role="grid"`, no roving tabindex and no `onKeyDown` — 42 sequential tab
stops to change a due date. The redesign did not touch this layer, and it is
the layer every §9 micro-interaction depends on.

### What this means for the sprint

The sprint name — *components, components, components* — is right, and the
redesign has already cleared the work that would otherwise have had to come
first. Ranked by return:

| | Work | Why |
|---|---|---|
| 1 | **Wrap the switch in `startViewTransition`** | ~5 lines against an architecture already built for it |
| 2 | **Collapse the four motion vocabularies to one** | Nothing else in the token system is ambiguous; this is |
| 3 | **Build the missing primitives** | The only way a hover state can be consistent across 477 buttons |
| 4 | **Calendar keyboard support** | A correctness gap, not a polish gap |
| 5 | **Add a rare tier and spend it once** | The suite currently cannot express a reward |

### On restraint

This team has already made the hard restraint calls, and the redesign
strengthens them. Confetti is banned suite-wide. A moved milestone animates
its `left` position with the note that this *"animates the distance rather
than decorating a state change"* — which is precisely the right instinct,
and is the thesis of §5 arrived at independently. Reduced motion is handled
at the token level (`--t-*` collapse to `0ms`) and globally in React via
`MotionConfig reducedMotion="user"`.

The accessibility work in the composed suite is above the industry norm:
hidden products are made `inert`, focus moves to the arriving sheet and the
arrival is announced, coarse pointers get real 44px controls rather than
expanders, and the spine's focus ring is white rather than indigo because
indigo measured 2.56:1 on composited ink — under the 3:1 floor. That last
one is a level of rigour most design systems never reach.

**Recommendations below are calibrated accordingly.** They are mostly about
finishing what the redesign started, and the delight inventory in §10 is
deliberately short.

---

## 2. Review of the composed suite

Screenshots captured from the artifact source at 1440×900, DPR 2.

### 2.1 What the redesign got right

**One floor, one spine, one sheet — across all three.** The ink floor, the
floating capsule and the single white sheet are now rendered once by the
shell for every product. The rail carries an icon plus a 10px word, the
active tile is indigo-tinted with an indigo glyph and label, and the brand
dot is ink rather than indigo so the accent is spent in exactly one place.
This was the largest open question in the suite and it is settled.

**The primary action is one language.** Tasks' `Add task`, Notes'
`Go through 8` and Timeline's `Get the link` are all the same black pill in
the same weight. An earlier draft of this playbook flagged three different
primary buttons; the redesign fixed it.

**The lane subtitles are the best writing in the product.** *"Held by a
reply, a delivery, or a decision."* under WAITING; *"Being checked before it
goes out."* under REVIEW. This explains a kanban board to someone who has
never used one, without a tooltip, a tour, or a single word of jargon — it
is the first-contact test passed inside the interface itself rather than
alongside it. It should be treated as canon and extended: Notes' *"Yours
until you send something on"* is the same move.

**State survives a glance.** Sort the board, read a note, come back — the
board is still sorted, the scroll position is intact, the caret is where it
was. This is rarer than it sounds and it is the foundation of everything in
§5.

**Motion is already tokenised and scoped.** Product CSS is scoped under
`[data-app="…"]`, transitions reference tokens rather than literals in the
new surface, and the across-axis milestone move is written as a position
interpolation *because position is the quantity* — not as a decoration.

### 2.2 The switch — the one missing frame

`go(product)` → `apply()` → `hidden` / `inert` toggle. Instant.

Everything that makes a shared-element transition possible is already true:
both products are in the same document, both retain their DOM, and the shell
already mirrors the arriving product's radius and accent onto the deck. The
only thing absent is the interpolation.

Because this is same-document, the mechanism is the simple one:

```js
function apply() {
  if (!document.startViewTransition || reducedMotion) return applyNow();
  document.startViewTransition(applyNow);
}
```

with `view-transition-name: sheet` on the sheet and a name on the active
rail tile. No `@view-transition` at-rule, no opt-in on two pages, no
same-origin question, no programmatic-navigation exclusion — all of which
would apply to a multi-page suite and none of which applies here.

**The old suite navigated with `window.location.href` after a deliberate
120 ms delay. The composed suite deleted that problem wholesale.** What
remains is not a defect so much as an unfinished sentence.

### 2.3 The motion vocabulary

The composed suite is far tighter than the shipping app (which spends 32
duration literals and 16 curves). Its declared ladder is three steps —
`--t-fast: 0.08s`, `--t-base: 0.14s`, `--t-slow: 0.22s` — with one default
curve. That is a good ladder.

The problem is not drift in values; it is **drift in names**. `--dur` at 46
transition uses is the de-facto standard, `--t-base` is the declared one,
and `--motion-fast` is the vendored one — all three are 140ms. A fourth
name, `--dur-out: 50ms`, is declared and never used in a transition at all.

This is cheap to fix and expensive to leave: every component added from here
picks one of four vocabularies, and the choice is arbitrary.

### 2.4 What the redesign did not reach

The component layer. The composed suite is a *design* artifact — it paints
its own surfaces with locked per-product code. The React application
underneath still has:

- **477 raw `<button>` elements**, no Button primitive, at least four
  independent primary-button designs and inconsistent disabled treatment
- **No** Input, Select, Popover, Tooltip, Tabs, Card, Badge, Tag, Progress,
  Skeleton, EmptyState or Calendar primitive. Present: Dialog, Toast, Hint,
  ContextActions, AnchoredLayer, plus Radix dropdown-menu and context-menu
- **`due-calendar.tsx`** — `transition-colors` only, month change swaps 42
  buttons instantly, no `role="grid"`, no roving tabindex, no `onKeyDown`.
  Only 15 components in the whole app handle `ArrowDown`
- **Native HTML5 drag-and-drop** across 11 files with no shared abstraction.
  `floor-board.tsx` does the honest work — edge scroll at 768, snap
  suspension for the gesture, an origin no-op guard, undo held across the
  drag — but native DnD caps the ceiling: the drag image is an unstyleable
  browser bitmap and the drop is a jump-cut with no settle
- **6 of 23 stylesheets** with no `prefers-reduced-motion` block

### 2.5 Delivery, not design

One observation worth separating from the design review. As rendered in
demo mode at `a709e22`:

- `/app/tasks` renders the floor (`HybridWorkspace` → `OptionHybrid` →
  `FloorWorkspace`) — the redesign is live here
- `/app/notes` and `/app/timeline` still render the previous chrome: full-
  bleed white under a black header band, no floating sheet

The composed suite is not yet in the repository; the lab at
`docs/design/labs/tasks-2026-08/` carries the Tasks-only `floor.html`. So
the sequencing question for the sprint is **not** "unify the chrome" — that
design work is done — but "land Notes and Timeline on the floor the design
already specifies." That is the prerequisite for §12 item 1 having anything
coherent to carry.

### 2.6 Honest characterisation

Against the brief's own vocabulary, the composed suite is:

- **generic** — nowhere. This is a distinctive product.
- **static** — at exactly one place that matters: the product switch. And at
  calendar month change, in the layer beneath.
- **abrupt** — the switch; the card drop.
- **mechanical** — no.
- **inconsistent** — in token *names*, not in values or geometry. Plus the
  Timeline wordmark.
- **unfinished** — the component layer, and calendar keyboard support.
- **over-animated** — no. Emphatically no.
- **under-animated** — at the switch, and at the few rare moments that have
  earned a response and currently get none.
- **visually noisy / lacking hierarchy** — no. Both are strengths.

The gap between this and world-class is narrow, and most of it is one
transition and one rename.

---

## 3. Reference research

Recorded as principles and mechanisms, not as things to copy. Each entry ends
with the only question that matters: *what does Signal Studio take from it?*

### 3.1 Apple

Apple's current motion guidance is unusually close to this product's existing
instincts. The load-bearing points:

- Motion is added **purposefully**, to keep people oriented, give clear
  feedback, and teach the interface — explicitly *not* for its own sake.
  "Gratuitous or excessive animation can distract people or make them feel
  disconnected."
- Motion should **communicate change and enhance spatial understanding**. The
  canonical example is the modal sheet sliding from the bottom: the motion
  itself states that the sheet is *above* the content and must be dismissed.
- Motion must be **optional** — Reduce Motion minimises or eliminates it.

The genuinely transferable technical idea is **how Apple parameterises
springs**. Since iOS 17, `Spring(duration:bounce:)` replaced stiffness/damping
as the primary API, and the reasoning is directly applicable: mass, stiffness
and damping "are not very intuitive… there isn't a real object with mass or a
spring with stiffness here", you cannot know in advance how long the animation
will last, and bounce has to be inferred indirectly, "which often requires
trial and error." Duration says how long; bounce says how much overshoot;
they are independent. Apple ships three presets on this model — `smooth`,
`snappy`, `bouncy`.

**Signal Studio takes:** the duration+bounce parameterisation as the token
model (§6), and the "motion states the spatial relationship" test as the
acceptance criterion for every transition in §12.

**Signal Studio does not take:** Liquid Glass (§4, Direction D — rejected).

### 3.2 Motion (the library already in `package.json`)

Motion v12 — already a dependency at `^12.38.0` — implements exactly Apple's
model: `transition: { type: "spring", visualDuration: 0.5, bounce: 0.25 }`.
`bounce` runs 0 (no bounce) to 1 (extremely bouncy). `visualDuration` is a
*perceived* duration: roughly how long the animation takes to read as
complete, disregarding the tail of the bounce. Duration-based springs can
also be generated as pure CSS.

**Signal Studio takes:** the whole spring token tier, expressed in the two
parameters the existing team already has the vocabulary for. **No new
dependency is required for anything in this playbook.**

### 3.3 The View Transitions API

The decisive technical finding, and the composed suite lands on the easy
side of it.

**Same-document** (what Signal Studio needs). Both states exist in one
document; you wrap the DOM mutation and the browser interpolates:

```js
document.startViewTransition(() => { /* mutate the DOM */ });
```

Shared elements are matched by giving the same `view-transition-name` to an
element before and after the change. Because the composed suite mounts all
three products simultaneously and merely toggles `hidden`, this is the whole
mechanism — one call, two names.

**Cross-document** (what a multi-page suite would need, and what the *old*
architecture would have required). Both pages opt in with
`@view-transition { navigation: auto; }`, and the transition fires only for
user-initiated same-origin navigations — a programmatic `location.href`
assignment is specifically excluded, which is exactly what the old
`suiteJump()` did. Supported in Chromium and Safari 18.2+, Firefox in
progress; the fallback is a normal hard navigation.

**Signal Studio takes:** the same-document form, as the spine of §5. The
cross-document notes are recorded only because they explain why the previous
architecture could not have got there without the redesign, and why the
redesign's decision to mount all three at once was the right one.

### 3.4 Linear

Linear is the closest peer and the most useful corrective. Its speed is
reported as a design decision rather than an engineering one: view
transitions under ~100ms, issue creation that feels instant, and — the line
worth pinning above the sprint board — **"there are no spinners because there
is nothing to wait for"**, because the UI re-renders synchronously off a
local in-memory store. The complementary point: a perfect sync engine still
loses to a slow input model, so the fastest path to any action is the
keyboard.

**Signal Studio takes:** two rules. *Motion may never be the reason to wait*
(the principle that removed the old `suiteJump` delay, and the reason the
switch transition must stay at or under `--t-slow`). And *the command palette is
a motion surface* — it is the fastest path, and its open/close is a
high-frequency interaction that must be at the `instant` end of the ladder.

**Signal Studio does not take:** the local-first sync-engine rewrite. That is
a multi-quarter architecture programme, not a components sprint, and the
optimistic-update pattern already present in the board gets most of the
perceived benefit.

### 3.5 The others, briefly

- **Stripe / Vercel** — restraint at scale: one accent, hairlines, motion
  confined to state changes. Signal Studio already matches this; nothing to
  take beyond confidence that the current direction is correct.
- **Raycast / command palettes generally** — the palette should feel like it
  was *already open* and is merely being revealed. Scale from 0.98, not 0.9;
  duration at `instant`/`fast`, never `base`.
- **Figma / Framer** — drag is a first-class interaction with a real drag
  proxy, not a browser bitmap. This is the argument for replacing native
  HTML5 DnD (§8, KanbanCard).
- **Radix / React Aria** — the primitives question. Signal Studio already
  depends on `@radix-ui/react-dropdown-menu` and `react-context-menu`.
  Extending the same family to Popover, Tooltip, Tabs and Select is the
  cheapest correct path to §7's missing layer: no new vendor, no new mental
  model, and the accessibility behaviour (focus trap, roving tabindex,
  dismiss semantics) arrives already solved.
- **Aceternity / Magic UI** — reviewed and **rejected as a source**. These
  are demo-grade effect collections: heavy DOM, inline animation values, and
  visual ideas that read as impressive once and as noise on the hundredth
  encounter. Importing from them would reintroduce exactly the token drift
  §2.3 measures. Useful only as a catalogue of what *not* to ship in a
  product someone uses every working day.

### 3.6 Techniques evaluated against the brief's own checklist

| Technique | Verdict for Signal Studio | Why |
|---|---|---|
| Cross-document View Transitions | **Adopt — first** | Native, free fallback, exactly the requested effect |
| Same-document View Transitions | Adopt — second | For in-product view switches (Board↔List↔Calendar) |
| Motion `layout` / `LayoutGroup` | Adopt — narrowly | Card→panel morph, lane reflow. Costly; see §11 |
| FLIP by hand | Reject | View Transitions and Motion both do it better |
| Spring physics | Adopt — bounded | Bounce budget by frequency (§6) |
| `backdrop-filter` / glass | **Reject** (§4-D) | Contrast risk against a measured gate; wrong material |
| SVG filter "gooey" | **Reject** (§4-A) | GPU cost, text rendering, ages badly |
| Canvas / WebGL | Reject | Nothing in this product needs it |
| `clip-path` / masking | Adopt — narrowly | Month-change wipe, progress reveals |
| Web Animations API | Adopt — sparingly | Where a one-shot needs JS timing and no React state |
| CSS transitions | **Default** | Most of this playbook is CSS |

---

## 4. Five motion directions

Explored as competing directions, scored honestly, with a verdict on each.
Two are rejected outright.

### Direction A — Fluid / gooey / morphing

**The idea.** Elements flow into one another. Controls morph. Surfaces
expand and collapse with shape interpolation rather than appearing.

**Strengths.** Directly expresses continuity and intelligence — the brief's
stated goal. When a control becomes the thing it opened, the interface reads
as *understanding* the action rather than responding to it.

**Weaknesses, and they are fatal to the literal reading.** The technique
usually meant by "gooey" is an SVG `feGaussianBlur` + `feColorMatrix` filter
stack applied to a container. In a product like this it is disqualified three
times over: it forces the filtered subtree onto its own composited layer and
re-rasterises every frame; it destroys subpixel text rendering on anything
inside it; and it is the most datable visual idiom in this list — it will
read as *2026* in the way skeuomorphic gradients read as 2010.

**Verdict: adopt the intent, reject the technique.** The intent — *identity
survives the change* — is the most valuable idea in the entire brief, and it
is delivered properly by Direction C. Blobs are not required and are not
wanted. Where genuine shape interpolation is right (composer expanding, note
becoming task), it is `border-radius` + size + position interpolation on a
real element, which is cheap, sharp, and does not date.

### Direction B — Spring / physical / tactile

**The idea.** Spring physics, momentum, subtle overshoot, weighted movement,
natural settling.

**Strengths.** Springs interrupt gracefully — a spring retargeted mid-flight
carries its velocity, where a duration-based tween restarts and reads as a
stutter. This matters most on drag, reorder and anything the user can
interrupt. Apple's duration+bounce parameterisation makes it tractable to
tokenise (§6).

**Weaknesses.** Bounce is the single fastest way to make a professional tool
feel like a toy. Signal Studio's users coordinate weddings; a due-date chip
that boings is not charming on the four-hundredth encounter. Bounce also
costs perceived speed: the overshoot tail reads as the interface still
working after the work is done.

**Verdict: adopt, with a hard bounce budget.** Springs for anything
interruptible or dragged. Bounce `0` for anything the user does more than a
few times an hour. This is the physics layer, not the personality layer.

### Direction C — Spatial / shared-element

**The idea.** Objects persist across states. A task card opening *becomes*
the panel. A product switch carries the sheet across. Navigation preserves
spatial context.

**Strengths.** It is the only direction that answers the brief's actual
question. It is now a platform feature rather than a library trick (§3.3),
degrades to today's behaviour where unsupported, and — uniquely among the
five — it *reduces* the amount of bespoke animation code, because the
browser interpolates rather than the app.

It also has a property none of the others have: **it makes the product
easier to use, not just nicer to look at.** When the object you clicked is
visibly the object that opened, you do not have to re-find your place.

**Weaknesses.** Requires the two ends to agree — which is exactly why §2.1
(chrome unification) must land first. Shared-element names must be unique per
document, so a list of ten cards needs the name applied only to the active
one. Long transitions on this mechanism feel worse than none, because the
whole page is frozen during them: keep to `base` (220ms) at most.

**Verdict: adopt as the spine of the motion language.**

### Direction D — Liquid Glass / material

**The idea.** Translucency, refraction, depth, layered floating surfaces.

**Assessed seriously, and rejected for Signal Studio.** Four reasons, in
order of weight:

1. **It is the wrong material for this product's identity.** Signal Studio's
   metaphor is already committed and already good: *paper on ink*. A sheet
   lifted off a floor. Glass is a material for floating chrome over
   content-rich, colourful, scrolling media — photos, maps, video. Signal
   Studio's sheets are opaque white paper carrying text. Translucency over
   white paper produces grey; it buys nothing and costs the metaphor.
2. **It fights a gate this repo actually enforces.** There is a
   `check-contrast.mjs` and a `ring.mjs` that measures focus rings *from
   real pixels*. Translucent surfaces make text contrast a function of
   whatever scrolls beneath — unpredictable by construction, and
   unverifiable by a static gate. The team would be choosing a material
   that makes its own quality system unable to certify it.
3. **`backdrop-filter` is the most expensive commonly-used effect on the
   web**, and this repo has a `perf:budgets` script implying those budgets
   are real. It is worst on exactly the low-powered hardware the brief says
   to respect.
4. **It will age.** Signal Studio's paper-and-hairline register is close to
   timeless. Glass is a 2025–26 signature and will read as dated on a
   product whose users keep it open all day for years.

**One narrow exception, already earned.** Two surfaces already sit on ink
rather than paper — the dictation overlay and the phone dock — and both
already carry white focus rings for measured contrast reasons. If any
translucency is ever justified, it is there, and only there. **Do not
introduce glass as a system material.**

### Direction E — Signal / technical / precision

**The idea.** Controlled motion, directional movement, telemetry-inspired
status, restrained glow, crisp active/inactive transitions, high information
density.

**Strengths.** It is the direction most *already true* of this product. The
mono/tabular-numeric treatment, the hairlines, the lane counts, the status
vocabulary, the "79 days" counter on Timeline — Signal Studio is already
speaking this language, and the name of the company points at it. Adopting it
formally costs almost nothing and makes the existing surfaces read as
deliberate rather than incidental.

**Weaknesses.** Taken too far it becomes cold, and this product's users are
planning weddings. Aerospace-instrument styling would be a register error.
Restraint here means: precision in *timing and geometry*, warmth in
*language*.

**Verdict: adopt as the tone**, not as a visual theme. No glow, no scanlines,
no monospace creep beyond numerics.

### Scorecard

| | A Fluid | B Spring | C Spatial | D Glass | E Precision |
|---|---|---|---|---|---|
| Answers the brief's actual question | 6 | 4 | **10** | 2 | 5 |
| Brand fit | 5 | 6 | **9** | 2 | **9** |
| Improves usability (not just looks) | 4 | 6 | **9** | 1 | 7 |
| Implementation cost (10 = cheap) | 3 | 6 | **8** | 4 | **9** |
| Performance safety | 2 | 7 | 8 | 2 | **10** |
| Accessibility safety | 5 | 7 | 7 | 3 | **9** |
| Ages well | 2 | 7 | **9** | 2 | **9** |
| **Verdict** | Intent only | **Adopt** | **Adopt — spine** | **Reject** | **Adopt — tone** |

---

## 5. The recommended Signal Studio motion language — **the carry**

The suite's existing vocabulary is physical and concrete: the **floor**, the
**spine**, the **sheet**. The motion language extends that vocabulary rather
than importing a new one.

> **The carry.** Things in Signal Studio are *carried* from one place to the
> next. They are never destroyed and rebuilt.

That single sentence is the whole language, and it produces a falsifiable
test for every proposed animation: *is something being carried, or is
something being performed?* If nothing is being carried, the animation is
decoration and should be cut.

### The four laws

**Law 1 — Nothing that survives a change may be redrawn.**
If an object exists before an interaction and after it, it must be the same
object on screen, moved. The task card that opens the panel *is* the panel's
header. The sheet in Notes *is* the sheet in Tasks. Implementation: shared
`view-transition-name`, or Motion `layout`. This law is the reason the
product will feel intelligent, and it is the one that repays effort most.

**Law 2 — The object leads; the container follows.**
Transitions are anchored to the thing the user touched, not to the viewport.
A panel opens *from the card*, a menu opens *from its trigger*, a toast rises
*from the action that caused it*. Nothing slides in from a screen edge unless
the user's gesture came from that edge. This is what makes motion read as a
consequence of the user's action rather than as a scene change.

**Law 3 — Frequency sets amplitude.**
The more often an interaction happens, the less it may move. This is a hard
budget with numbers, not a sensibility (§6.3). A hover may not exceed 80ms
and may not translate. A celebration may run 480ms and may do almost
anything. There is no negotiation in between.

**Law 4 — Motion may never be the reason to wait.**
No animation is permitted on the critical path of a user's action. Nothing
may delay a navigation, a save, or a state change in order to look better
first. Optimistic update, then animate the result. The composed suite already
honours this — it deleted the old architecture's deliberate 120 ms switch
delay outright. The law exists so that item 1's transition is added *without*
reintroducing one: `startViewTransition` must wrap the mutation, never
postpone it.

### What each direction contributes

| Direction | Contribution | Boundary |
|---|---|---|
| C Spatial | The **spine** — Laws 1 & 2 | ≤220ms; only where both ends agree |
| B Spring | The **physics** — how carried things settle | Bounce budget by frequency |
| E Precision | The **tone** — geometry, timing, status | No glow, no theming |
| A Fluid | The **intent** only — identity survives change | No SVG filters, no blobs |
| D Glass | Nothing | Except the two ink surfaces that already earned it |

### The five-minute test

The brief asks what would make someone think *"this feels different"* after
five minutes. The answer this language gives, concretely:

- They switch from Notes to Tasks and **the sheet does not blink** — it stays,
  and its contents change.
- They open a task and **the card they clicked becomes the panel**, so they
  never lose their place on the board.
- They drag a card and it **settles** rather than snapping.
- They change month in the date picker and **the month slides in the
  direction they pressed**, so they always know which way time went.
- They complete the last task in a lane and get **one quiet, well-drawn
  moment** — not confetti, and not nothing.
- Everything else feels *fast and unremarkable*, which is the point.

Five of those six are continuity. One is delight. That ratio is the language.

---

## 6. Motion token system

The existing contract is sound in shape and under-enforced in practice. This
is a **consolidation, not a rewrite** — the four-step ladder already declared
in `motion.ts` survives unchanged.

### 6.1 Durations — keep four, retire one

| Token | ms | Use |
|---|---|---|
| `--motion-instant` | **80** | Hover, press, focus ring, tooltip show |
| `--motion-fast` | **140** | Menu/popover open, tab change, checkbox, toast in |
| `--motion-base` | **220** | Panel open, view transition, card carry, sheet change |
| `--motion-slow` | **480** | Celebration, first-run, cinematic demo beats only |

`--motion-moderate: 320ms` is **retired** — it is already annotated as legacy
with a burn-down that never ran. Its 8 uses map to `base` (7) or `slow` (1).

### 6.2 Springs — duration + bounce, not stiffness/damping

Following Apple and Motion v12, springs are declared with a *visual duration*
and a *bounce*, which are independent and readable.

| Token | visualDuration | bounce | Use |
|---|---|---|---|
| `SPRING_CRISP` | 0.14 | **0** | Press, toggle, checkbox — anything frequent |
| `SPRING_CARRY` | 0.22 | **0.12** | Card→panel, lane reflow, drag settle |
| `SPRING_ARRIVE` | 0.32 | **0.24** | Something new appearing: created task, new note |
| `SPRING_REWARD` | 0.48 | **0.35** | Celebration only. Rare by definition |

Bounce above 0.35 is not available. Nothing in a wedding-coordination tool
needs it.

### 6.3 The frequency budget — Law 3, with numbers

This is the table that makes the language enforceable.

| Tier | Examples | Max duration | Max translate | Max scale | Bounce | Blur |
|---|---|---|---|---|---|---|
| **Frequent** (many/minute) | hover, press, focus, tab, checkbox | **80ms** | **0px** | 0.98–1.02 | **0** | none |
| **Occasional** (several/hour) | open task, open menu, switch view, move card, create | **220ms** | 8px | 0.96–1.04 | ≤0.15 | none |
| **Rare** (a few/day or less) | complete a lane, finish onboarding, publish a timeline | **480ms** | 16px | 0.9–1.1 | ≤0.35 | ≤4px |

The frequent tier permitting **zero translation** is deliberate and is the
most important row. Hover states that move are the most common way a
professional tool becomes tiring. Colour, and at most a 2% scale, is enough.

### 6.4 Easing — three curves, down from sixteen

| Token | Curve | Use |
|---|---|---|
| `--ease-standard` | `cubic-bezier(0.2, 0, 0, 1)` | **Default.** Anything that moves between two states |
| `--ease-out` | `cubic-bezier(0, 0, 0.2, 1)` | Entrances; anything arriving |
| `--ease-in` | `cubic-bezier(0.4, 0, 1, 1)` | Exits only; anything leaving |

The four cinematic curves (`--spring-*`, `--ease-cinema`) stay **licensed to
the homepage demo only**, as they already are, and must carry the existing
`/* ds-allow */` marker. Every other curve found in §2.3 is retired.

Migration for the nine undeclared curves:

| Found | Uses | → |
|---|---|---|
| `.22,.7,.2,1` | 5 | `--ease-standard` |
| `.34,1.56,.64,1` | 5 | `SPRING_ARRIVE` (it is an overshoot spring in disguise) |
| `.22,.61,.36,1` | 3 | `--ease-out` |
| `.4,0,.6,1` | 2 | `--ease-standard` |
| `.2,.7,.2,1` | 2 | `--ease-standard` |
| `.77,0,.175,1` · `.5,0,0,1` · `.32,0,.67,1` · `.3,.7,.15,1` · `.2,.8,.2,1` | 1 each | `--ease-standard` |

### 6.5 Distance and the carry transition

Two additions the current system lacks:

```css
--motion-lift:  8px;    /* occasional-tier travel */
--motion-rise: 16px;    /* rare-tier travel */

/* The carry: the suite's default transition, used by every shared element */
--carry: var(--motion-base) var(--ease-standard);
```

### 6.6 Enforcement — the missing gate

Everything above is decoration without this. The repo already gates contrast,
tap targets, journey coverage, first-contact language, route manifests and
module boundaries. **Motion is the one design dimension with no gate**, and
that is precisely why it drifted to 32 durations.

Add `scripts/check-motion-contract.mjs`, wired into `pnpm test` beside
`check-contrast.mjs`:

1. Fail on any `transition`/`animation` duration literal in `src/**/*.css`
   that is not a `var(--motion-*)` reference.
2. Fail on any `cubic-bezier(...)` outside `globals.css`.
3. Fail on any raw duration literal in `transition={{…}}` props that is not a
   `MOTION_*` or `SPRING_*` import from `@/lib/motion`.
4. Honour the existing `/* ds-allow — reason */` escape hatch, and require
   the reason.
5. Ship it in **report mode first** with the current 32/16 as the baseline
   ratchet, exactly as `check-ambient-workspace-ratchet.mjs` already does,
   so the sprint can burn the number down instead of blocking on day one.

**This gate is the highest-value item in the entire playbook that contains no
animation code**, and it is the only thing that stops the sprint's work from
drifting again within two quarters.

---

## 7. Component system

### 7.1 The problem, stated plainly

477 raw `<button>` elements cannot be made to feel consistent by editing 477
class strings. Every item in §8 and §9 that touches a button, an input or a
menu is blocked on this layer existing. **This is why the sprint is correctly
named.**

### 7.2 Build order

**Tier 1 — blocks everything else (build in week 1)**

| Component | Status | Notes |
|---|---|---|
| `Button` | **Missing** | 4 variants: primary / secondary / ghost / destructive. Absorbs all 477. Owns the press spring (`SPRING_CRISP`), the loading swap, the disabled treatment |
| `IconButton` | **Missing** | Square, 44px tap target (a gate already checks this), tooltip-aware |
| `Input` | **Missing** | Focus ring, invalid state, clear affordance, description/error slots |
| `Popover` | **Missing** | Radix. Replaces the ad-hoc `anchored-layer` call sites |
| `Tooltip` | **Missing** | Radix. 80ms show, no motion, delay group so a row of icons opens instantly after the first |

**Tier 2 — the surfaces the brief names (week 2)**

| Component | Status | Notes |
|---|---|---|
| `Calendar` / `DatePicker` | **Present but incorrect** | Rebuild on `role="grid"` + roving tabindex. See §8.4 |
| `Select` | **Missing** | Radix |
| `Tabs` | **Missing** | Owns the sliding active indicator (one shared element) |
| `Card` | Implicit | Formalise: the board card, the note row, the milestone are one component with three densities |
| `Badge` / `Tag` | Implicit | Status, priority, lane colour all currently bespoke |
| `Skeleton` | Partial | Exists ad hoc in ~6 places; needs one shimmer, on `--load-pulse-duration` |

**Tier 3 — completeness (week 3+)**

`Drawer` · `Sheet` · `Progress` · `Avatar` (exists in showcase, promote) ·
`EmptyState` (exists as overlay, generalise) · `ErrorState` ·
`Confirmation` · `KanbanCard` · `TimelineItem` · `CommandMenu` (exists,
promote out of `app/palette`)

**Already good — promote, do not rebuild:** `Dialog`, `Toast`,
`ContextActions`, `Hint`, `AnchoredLayer`, `ReorderList`, `MentionField`.

### 7.3 The contract every primitive must satisfy

Each Tier-1/2 component ships with all nine, and the PR is not complete
without them:

1. **Visual states** — rest, hover, active, focus-visible, disabled, loading,
   invalid (where applicable)
2. **Interaction states** — pointer, touch (44px minimum), keyboard
3. **Motion states** — declared tier from §6.3, no ad-hoc values
4. **Keyboard behaviour** — documented in the component file, not inferred
5. **Focus behaviour** — visible ring, correct restore on close
6. **Accessibility** — role, name, state; verified by the existing axe run
7. **Reduced motion** — inherited from `MotionProvider`, plus a CSS block
8. **Responsive** — behaviour at 390 / 768 / 1440, the viewports the 9.5 gate
   already reviews
9. **Variants** — enumerated, closed set, no `className` escape hatch for
   layout

### 7.4 One rule that prevents the next drift

> A component may not accept a `className` that changes its colour, radius,
> spacing or motion. Layout position only.

Without this, `Button` becomes a fifth button design rather than the
replacement for four.

---

## 8. Interaction inventory

Every location where interaction quality can materially improve, with the
current state and the mechanism. Ordered by surface.

### 8.1 Global

| Interaction | Current | Should be | Mechanism |
|---|---|---|---|
| **Product switch** | `preventDefault` → curtain → `location.href` after 120ms | The sheet stays; its contents change; the spine's active tile carries | Cross-document VT. **§12 item 1** |
| Global loading | Route-level `loading.tsx` in some products | One shared skeleton register | `Skeleton` primitive |
| Command palette | Good; motion values ad hoc | 80ms, scale 0.98→1, no translate | Frequent tier |
| Search | Palette-based | Keep | — |
| Notifications / toast | Good | Anchor to originating action (Law 2) | `Toast` + origin prop |
| Global feedback | Inconsistent | Every mutation resolves visibly ≤80ms | Optimistic update |

### 8.2 Navigation

| Interaction | Current | Should be |
|---|---|---|
| Notes → Tasks → Timeline | Full document load + curtain | Shared sheet + spine carry |
| Board ↔ List ↔ Schedule ↔ Calendar | Instant swap | Same-doc VT; the tab indicator carries |
| Sidebar open/close | CSS width transition | Keep; unify duration to `base` |
| Project switch | Route change | Sheet head carries; body cross-fades |
| Task deep-link (`/app/task/[id]`) | Full page | Should open the panel over the board it belongs to |

### 8.3 Tasks / Kanban — the drag question

The brief asks whether the column highlight can become something more
elegant. It can, but the ceiling is set by the transport, not the styling.

**Native HTML5 DnD caps three things**: the drag image is a browser bitmap
that cannot be styled, animated, tilted or scaled; there is no continuous
pointer position between `dragover` events on some platforms; and the drop is
a synchronous jump-cut — there is no moment in which to settle.

**Recommendation: replace the transport with pointer events on the board
only** (not the other 10 DnD sites), keeping every behaviour
`floor-board.tsx` already gets right — edge scroll, snap suspension, the
origin no-op guard, undo held across the gesture. Then:

| Beat | Current | Should be |
|---|---|---|
| Lift | Card becomes a browser bitmap | Card lifts 2px, gains `--shadow-modal`, scales 1.02, source leaves a lane-tinted ghost |
| Carry | Bitmap follows cursor | Real element follows with ~40ms lag and ≤3° tilt from pointer velocity |
| Destination | Column highlight | Lane header tints to its own `--x-col-*` at 8%; the gap **opens** to card height using `SPRING_CARRY` |
| Drop | Instant reorder | Card animates into the opened gap and settles. **Never a bounce** — this happens dozens of times a day |
| Cancel | Snap back | Springs home along the same path |

Everything else on the board: completion (see §10), reorder (`ReorderList`
already good), filtering/sorting (cross-fade rows, do not re-mount),
bulk actions (`bulk-toolbar` exists and is good), undo (exists; surface it in
the toast).

### 8.4 Dates — the surface the brief singles out

Current: `transition-colors` only; month change swaps 42 buttons instantly;
**no keyboard navigation whatsoever**.

| Interaction | Should be |
|---|---|
| Open | Popover from the trigger (Law 2), 140ms |
| **Keyboard** | `role="grid"`, roving tabindex, arrows move a day, PageUp/Down a month, Home/End the week. **Correctness before motion** |
| Change month | Grid slides **in the direction pressed** — left arrow, month enters from the left. `clip-path` on the grid only; the header does not move |
| Hover a day | Background only. Zero movement (frequent tier) |
| Select | The selection ring is **one element that moves** between days, not 42 elements changing colour |
| Today | Permanently marked, distinct from selected |
| Range | The band grows from the anchor toward the pointer |

The "selection ring moves" detail is Law 1 in miniature, costs one shared
element, and is the difference between a date picker that feels considered
and one that does not.

### 8.5 Notes

| Interaction | Current | Should be |
|---|---|---|
| Composer focus | Static | Expands to its full height with the composer's own radius interpolating |
| Voice capture | Overlay exists (white ring on ink — correct) | Waveform responds to input level, not a canned loop |
| **Note → Task** | Buttons: Keep / Turn into task / Delete | The note row **carries into the board** as the card. Highest-value delight moment in the product (§10) |
| AI parsing | Result appears | Extracted fields settle in one at a time, ~60ms apart — reads as *interpreting*, not *loading* |
| Save | Button | Optimistic; the row appears in the list already saved |
| Delete | Immediate | Row collapses to zero height; undo in the toast |

On the brief's question — *can an AI-parsed voice note feel like the
interface is interpreting intent?* — yes, and the mechanism is **staggered
arrival of the structured result**, not a thinking animation. A spinner says
*wait*; fields landing one after another say *I understood this, then this*.
Cost: one `staggerChildren`. This is the best delight-per-line-of-code in the
document.

### 8.6 Timeline

| Interaction | Current | Should be |
|---|---|---|
| Range switch | Instant | Axis rescales; milestones keep identity and move (Law 1) |
| Today marker | Static | The one element permitted a slow ambient pulse |
| Drag a date | Native | Same pointer transport as the board; the axis label tracks the drag |
| Milestone hover | Colour | Connector hairline to the axis brightens |
| Expand/collapse | Height | Height + content fade, `base` |
| Zoom | — | Anchor on the pointer, not the centre |

### 8.7 Home / Briefing, Settings, Empty & error states

- **Briefing** — content should arrive in reading order, ~60ms apart, once,
  on first view only. Never on return.
- **Settings** — `save-ribbon` exists and is good. Every toggle must resolve
  optimistically.
- **Empty states** — Tasks' "Nothing here yet." is the right register.
  Generalise it; distinguish *empty because new* from *empty because done*
  (§10).
- **Error states** — currently the least designed. Every error needs: what
  happened, in the product's own voice; what to do; a retry that shows it is
  retrying. No motion required beyond the retry spinner.

---

## 9. Micro-interaction inventory

Every meaningful state change should have an intentional response. All of
these are **frequent tier** unless marked: ≤80ms, colour or ≤2% scale, **no
translation**.

**Confirming an action** — copy (icon swaps to a check for 1.2s, no bounce) ·
duplicate (the copy appears already offset) · save (button label swaps, never
a spinner under 300ms) · rename (field becomes text in place) · archive (row
collapses) · favourite/pin (fill transition on the glyph only)

**Reversing** — delete (collapse to zero height, undo in the toast) · undo
(the restored row flashes its lane tint once) · cancel (return along the
inbound path)

**Status** — task status change (chip colour crossfades; the lane count
tick-rolls) · priority (glyph weight) · blocker (`blocker-badge` exists) ·
assignee (avatar crossfade)

**System feedback** — toast (rises 8px from the originating control, Law 2) ·
loading (nothing under 300ms; skeleton beyond) · retry (the button itself
shows progress) · error (field shake is **banned** — border and message only)

**Keyboard and focus** — shortcut hints on `⌘` hold · focus ring at 80ms, no
translate · focus restore on close (already correct in `Dialog`) · roving
tabindex in every list, menu and grid

**Hover** — reveal-on-hover row controls (opacity only, 80ms; the row must
not reflow) · hover previews (140ms open, 80ms close, delay group) ·
tooltips (never on touch)

Two bans worth stating explicitly, because both are common and both are
wrong here: **no error shake** (it punishes), and **no hover translation**
(it fatigues).

---

## 10. Delight inventory

Held to the brief's own seven questions. Most candidates fail them, and the
list is short on purpose.

### Adopt

**1. Note → Task carry.** The note row travels from the Notes list and
becomes the card on the board. *Useful:* yes — it shows where the thing went.
*Repeatable:* yes, it is navigation. *Brand:* it is the suite's core promise
(capture becomes execution) made visible. **The single best delight
opportunity in the product.**

**2. Lane cleared.** The last card leaves a lane and the empty state does not
just appear — the lane's hairline draws once in the lane's own colour, and
the copy says the work is done rather than that the lane is empty. Rare,
earned, quiet. *Distinguishes empty-because-done from empty-because-new*,
which the product currently cannot express.

**3. AI understood you.** Staggered arrival of parsed fields (§8.5). Reads as
comprehension. Frequent enough to matter, quiet enough to survive repetition.

**4. First completion.** `first-completion-moment.tsx` already exists. Keep;
ensure it fires exactly once, ever.

**5. Timeline published.** A real threshold — something becomes visible to
other people. The existing drawn-check vocabulary, at `SPRING_REWARD`.

### Reject

| Candidate | Why not |
|---|---|
| Confetti, anywhere | Already banned suite-wide. The ban is correct |
| Task completion celebration | Happens dozens of times a day — the checkbox settle is the whole reward. `dopamine-check` is already right |
| Streaks / counters | Wrong register for wedding coordination; creates obligation |
| Sound | Never, in a product used in shared offices and at venues |
| Haptics on web | Inconsistent across platforms; not worth the branch |
| Project-created celebration | Creation is not achievement. The reward is the populated board |

The ratio — five adopted, six rejected, and the most frequent event
(completing a task) deliberately given the *smallest* response — is the
restraint the brief asks for.

---

## 11. Prioritisation matrix

Scored 1–10. **Difficulty** and **Perf risk** and **A11y risk** are scored so
that **10 = cheap / safe** — every column points the same way, so priority is
simply the weighted mean.

Weights: UX value ×3 · Consistency ×3 · Brand fit ×2 · Difficulty ×2 ·
Visual ×1 · Delight ×1 · Perf ×1 · A11y ×1 · Wow ×1.

| # | Item | UX | Vis | Del | Brand | Diff | Perf | Freq | A11y | Consist | Wow | **Score** |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Land Notes + Timeline on the floor | 8 | 10 | 5 | 10 | 6 | 10 | 10 | 9 | **10** | 7 | **8.6** |
| 2 | `startViewTransition` on the switch | 10 | 9 | 8 | 9 | **10** | 9 | 10 | 9 | 9 | 9 | **9.3** |
| 3 | `Button` + `IconButton` primitives | 8 | 8 | 3 | 8 | 7 | 10 | 10 | 9 | **10** | 3 | **7.9** |
| 4 | Motion contract gate (report mode) | 6 | 7 | 2 | 8 | **9** | 10 | — | 10 | **10** | 2 | **7.5** |
| 5 | Calendar keyboard + grid semantics | 9 | 5 | 3 | 7 | 7 | 10 | 6 | **10** | 7 | 3 | **7.1** |
| 6 | Card → panel shared element | 9 | 9 | 8 | 9 | 5 | 7 | 8 | 8 | 8 | 9 | **8.0** |
| 7 | Note → Task carry | 8 | 9 | **10** | **10** | 4 | 7 | 6 | 8 | 8 | **10** | **7.9** |
| 8 | Board drag: pointer transport | 8 | 9 | 8 | 8 | **3** | 6 | 8 | 6 | 7 | 9 | **6.9** |
| 9 | Date picker motion (after #5) | 7 | 9 | 7 | 8 | 6 | 9 | 6 | 9 | 8 | 7 | **7.5** |
| 10 | `Popover` + `Tooltip` primitives | 7 | 7 | 3 | 8 | 7 | 9 | 9 | **10** | 9 | 3 | **7.4** |
| 11 | In-product view VT (Board↔List) | 7 | 8 | 6 | 8 | **8** | 9 | 8 | 9 | 8 | 7 | **7.7** |
| 12 | AI staggered arrival | 7 | 8 | 9 | 9 | **9** | 9 | 6 | 9 | 7 | 8 | **8.0** |
| 13 | Collapse 4 motion vocabularies to 1 | 6 | 6 | 2 | 8 | **9** | 10 | — | 10 | **10** | 1 | **7.2** |
| 14 | Toast anchored to origin | 6 | 7 | 6 | 8 | 7 | 9 | 8 | 9 | 8 | 5 | **7.1** |
| 15 | Lane-cleared moment | 5 | 8 | 9 | 9 | 7 | 9 | 3 | 9 | 7 | 8 | **7.2** |
| 16 | `Skeleton` unification | 5 | 6 | 2 | 7 | 8 | 9 | 7 | 9 | 9 | 2 | **6.5** |
| 17 | Reduced-motion in last 6 stylesheets | 4 | 3 | 1 | 6 | **10** | 10 | — | **10** | 9 | 1 | **6.0** |
| 18 | Liquid Glass / backdrop-filter | 2 | 6 | 6 | 2 | 3 | 2 | — | 3 | 3 | 8 | **3.4** |

**Item 18 is included to record the rejection with a score**, so the decision
is auditable rather than a matter of taste.

### Reading the matrix

The top of the list is dominated by **coherence and enforcement**, not
animation — items 2, 1, 6, 12, 3. The two most *visually* exciting items
(8, drag; 7, note-carry) score mid-table because they are expensive and, in
the case of drag, carry real performance and accessibility risk.

Item 2 scoring highest is the finding of the whole exercise: **the single
best thing available is five lines against an architecture that was already
built to receive them.** The redesign did the expensive part; nobody has yet
spent the cheap part.

---

## 12. Recommended implementation order

A three-week shape. Weeks 2 and 3 are conditional on week 1 landing.

**Week 1 — finish what the redesign started**
Day 1: the switch transition (#2 in the matrix, Monday item 1) — five lines,
and it is the item the whole brief is about. Days 1–3: land Notes and
Timeline on the floor (#1, Monday item 2), plus Timeline's wordmark. Day 3:
collapse the four motion vocabularies (#13) — before the component work, not
after, so primitives are authored against one name. Days 4–5: `Button`,
`IconButton` (#3), and the motion gate in report mode (#4).

*Exit criteria:* the sheet no longer blinks on a product switch; all three
products render on the floor in the shipping app; each duration and curve has
exactly one name; the button count is one; the motion gate reports a
baseline.

**Week 2 — continuity**
Card→panel shared element (#6). In-product view transitions (#11). Calendar
correctness then calendar motion (#5, #9). `Popover` + `Tooltip` (#10). AI
staggered arrival (#12) — cheap and high-return.

*Exit criteria:* opening a task never loses the user's place; the calendar is
fully keyboard-operable; the four Tasks views transition as one surface.

**Week 3 — the expensive and the delightful**
Board drag transport (#8) — the largest single piece of work in the sprint,
scheduled last on purpose because it is the one most likely to overrun.
Note→Task carry (#7). Toast anchoring (#14). Lane-cleared (#15). Skeleton
(#16). Then flip the motion gate from report to blocking.

*Exit criteria:* drag settles rather than snaps; the motion gate blocks; the
9.5 council can be re-run with new evidence.

**Explicitly out of scope:** local-first sync engine · any glass or
`backdrop-filter` material · any new animation dependency · the other 10
drag-and-drop sites · marketing-site motion.

---

## MONDAY — START HERE

The first fifteen things, in order. Items 1–4 are a two-day pair-programmable
block and contain almost no animation.

---

### 1 · Wrap the product switch in `startViewTransition`

**Component** `app.js` — `go()` / `apply()`; shell CSS
**Current** `apply()` toggles `hidden` and `inert` on the three product
hosts. Both products are in the document at the same instant; nothing
interpolates between them. The switch is a hard cut.
**Desired** The sheet persists visually across the switch; its contents
change; the spine's active tile travels to its new position.
**Reference** Same-document View Transitions (§3.3); Law 1 (§5).
**Approach** Wrap the existing mutation, keeping the current path as the
fallback:

```js
function apply() {
  if (!document.startViewTransition || prefersReducedMotion) return applyNow();
  document.startViewTransition(applyNow);
}
```

Then `view-transition-name: sheet` on `.sheet`, and a name on the active
rail tile. Give the default group `animation-duration: var(--t-slow)`.
**Complexity** **S.** Roughly five lines plus two names. No routing change,
no navigation, no opt-in at-rule — the composed suite's decision to mount
all three products at once already did the expensive part.
**Why first** Highest score in §11, lowest cost in the list, and it is the
one thing standing between the current suite and the brief's stated goal.
**Acceptance**
- The sheet does not blink: it is continuously present across the switch,
  and its corner radius and inset do not change during it.
- The active rail tile **travels** to its new position rather than one tile
  extinguishing and another lighting.
- The departing product's scroll, focus and state are still intact on
  return — the transition must not cost what the architecture already
  guarantees.
- ≤220ms (`--t-slow`).
- With `prefers-reduced-motion`, the switch is instant and still correct.
- In a browser without `startViewTransition`, behaviour is exactly today's —
  verified, not assumed.

---

### 2 · Land Notes and Timeline on the floor

**Component** Notes and Timeline app shells
**Current** The composed suite unifies all three products on one floor, one
spine, one sheet — the design work is **done**. In the repository at
`a709e22`, `/app/tasks` renders it (`HybridWorkspace` → `OptionHybrid` →
`FloorWorkspace`); `/app/notes` and `/app/timeline` still render the
previous chrome — full-bleed white under a black header band, no floating
sheet.
**Desired** The shipping app matches the composed suite.
**Reference** The composed suite artifact; §2.5.
**Approach** Port the shell composition — the floor, the spine and the sheet
geometry rendered once for all three, with each product as a
`display: contents` child carrying only its own scope. The artifact's own
notes resolve the known conflicts: `--paper` must not be declared at
`:root` by any product, and the spine's type tokens belong on `:root` so a
rail rule cannot silently inherit 16px.
**Complexity** **M.** Mostly composition; the risk is the two products'
conflicting `--paper` declarations, which the design lock already documents.
**Why priority** Item 1 has nothing coherent to carry between until all
three products are on the same floor in the shipping app.
**Acceptance**
- `/app/notes` and `/app/timeline` render the floating sheet on the ink
  floor, with the same rail width, inset, sheet radius and wordmark position
  as `/app/tasks`.
- No product declares `--paper` at `:root`.
- Switching between all three preserves scroll, focus and state in the
  product left behind.
- A three-product screenshot strip at 1440 is regenerated and attached to
  the PR, and the three chromes are indistinguishable.

---

### 2b · Give Timeline its wordmark

**Current** Tasks opens `tasks.` and Notes opens `notes.` in the sheet head,
both with the dot. Timeline opens straight into `The Orchard, events`.
**Desired** `timeline.` in the same position, same treatment.
**Complexity** **XS.**
**Acceptance** All three sheet heads open with the product wordmark in the
same position, at the same size and tracking. The full stop follows each
product's own lock (ink in Tasks, indigo in Notes) — the wordmark's
*position and presence* is what unifies, not its colour.

---

### 3 · `Button` and `IconButton`

**Current** 477 raw `<button>` elements; at least four primary designs;
inconsistent disabled treatment.
**Desired** One component, four variants, one press behaviour, one focus
ring, one loading state, one disabled treatment.
**Approach** Build against the §7.3 contract. Migrate the highest-traffic
surfaces first (board, notes list, timeline header) and leave the tail; the
gate in item 4 ratchets the rest.
**Complexity** **M** to build, **L** to migrate fully — do not attempt the
full 477 this week.
**Acceptance**
- Press is `SPRING_CRISP` (0.14 / bounce 0) and does not translate.
- Loading swaps the label in place and preserves button width — no reflow.
- Disabled is `cursor: default` and non-focusable, matching the rule the
  Tasks lab already states.
- Focus ring identical across all four variants and both themes.
- No variant accepts a `className` that changes colour, radius or spacing.

---

### 4 · `scripts/check-motion-contract.mjs`, in report mode

**Current** 32 duration literals, 16 curves, no gate. Motion is the only
design dimension the repo does not enforce.
**Desired** A ratcheting gate beside `check-contrast.mjs`.
**Approach** §6.6. Baseline at today's counts; `/* ds-allow — reason */`
honoured; wired into `pnpm test`; report-only until week 3.
**Complexity** **S.** Mirror `check-ambient-workspace-ratchet.mjs`.
**Acceptance**
- Reports exactly 32 durations and 16 curves on the current tree — if it
  reports different numbers, it is measuring the wrong thing.
- A new off-contract duration raises the count and fails the ratchet.
- A `/* ds-allow */` without a reason fails.

---

### 5 · Calendar: `role="grid"`, roving tabindex, arrow keys

**Current** `due-calendar.tsx` — no grid role, no `onKeyDown`, 42 sequential
tab stops.
**Desired** One tab stop into the grid; arrows move by day; PageUp/PageDown
by month; Home/End by week; Enter selects.
**Complexity** **S–M.** Correctness only — **no motion in this item.**
**Why before item 9** Animating a control a keyboard user cannot operate is
the wrong order.
**Acceptance**
- Tab enters the grid once and lands on the selected day, or today.
- Every day is reachable by arrows without the mouse.
- Changing month by keyboard moves focus to the equivalent day.
- axe reports zero violations on the open picker.

---

### 6 · Card → panel shared element

**Current** Opening a task renders a separate panel; the card stays behind.
**Desired** The card becomes the panel header. The user never loses their
place.
**Approach** Same-document view transition, or Motion `layout` with a shared
`layoutId` on the card. Only the *active* card carries the name.
**Complexity** **M.**
**Acceptance**
- The clicked card's title is continuously on screen throughout — it is never
  cross-faded or re-rendered in place.
- Closing returns to the same card in the same lane at the same scroll
  position.
- Opening a second task from within the panel carries again, without a
  flash to the board between.
- ≤220ms, `--ease-standard`.

---

### 7 · Collapse the four motion vocabularies into one

**Current** 140ms answers to `--dur` (46 uses), `--t-base` and
`--motion-fast`. 220ms answers to `--dur-settle`, `--t-slow` and
`--motion-base`. One curve answers to `--ease`, `--curve` and `--ease-out`.
`--t-` means both time (`--t-base: 0.14s`) and type size (`--t-11: 11px`).
**Desired** One name per value, and a prefix that means one thing.
**Approach** Keep the three-step ladder as declared; make `--motion-*` the
single public name (it is the vendored DS one), alias `--dur` to it during
the burn-down, and rename the timing `--t-*` tokens so the `--t-` prefix
belongs to type alone.
**Complexity** **S.** Mechanical, but touches many files — do it before the
component work in item 3, not after.
**Acceptance** Each duration and each curve has exactly one canonical name.
`--t-` resolves only to type sizes. `--dur-out` is either used or deleted.
Zero visual regressions in the existing Playwright evidence run.

---

### 8 · `Popover` + `Tooltip` on Radix

**Complexity** **S–M** (the vendor is already a dependency).
**Acceptance** Both open from their trigger (Law 2). Tooltip: 80ms, no
motion, delay-grouped. Popover: 140ms, focus trapped, focus restored, Escape
closes. Neither appears on touch-only hover.

---

### 9 · Date picker motion

**Depends on item 5.**
**Desired** Month grid slides in the direction pressed. The selection ring is
one element that travels between days.
**Acceptance**
- Pressing "previous" moves the grid rightward; "next" leftward. The
  direction is never ambiguous.
- The header does not move while the grid does.
- Day hover changes background only — **zero translation**.
- The selection indicator is a single DOM element across the whole grid.
- Under reduced motion the grid swaps instantly and the ring still moves.

---

### 10 · Board ↔ List ↔ Schedule ↔ Calendar as one surface

**Approach** Same-document view transitions; the tab indicator is a shared
element; tasks present in both views keep their `view-transition-name`.
**Complexity** **M.**
**Acceptance** The sheet, its head and the tab row never re-render. A task
visible in both Board and List travels between its two positions. ≤220ms.

---

### 11 · AI staggered arrival in Notes

**Desired** Parsed fields land one at a time, ~60ms apart, in reading order.
**Complexity** **S.** One `staggerChildren`.
**Acceptance** No spinner is shown for parses under 300ms. Fields arrive in
reading order. Stagger runs **once** per parse, never on re-render. Under
reduced motion all fields appear together.

---

### 12 · Toast anchored to its origin

**Acceptance** A toast rises 8px from the control that caused it, not from
the viewport edge. Undo is present in the toast for every destructive action.
Toasts stack without reflowing those already on screen.

---

### 13 · `prefers-reduced-motion` in the last six stylesheets

`CaptureEmailRow` · `timeline-phone-preview` · `artifact-studio` ·
`share-controls` · `hybrid-workspace` · `ds/theme-overrides`.
**Complexity** **S.**
**Acceptance** All 23 stylesheets carry the block; a reduced-motion Playwright
pass shows no animation on any surface.

---

### 14 · Board drag: pointer transport

**The largest item in the sprint — scheduled last deliberately.**
**Approach** §8.3. Replace HTML5 DnD on the board only. Preserve edge scroll,
snap suspension, the origin no-op guard, and undo-held-across-gesture.
**Complexity** **L.**
**Acceptance**
- The dragged card is a real, styled element — not a browser bitmap.
- The destination gap **opens to card height** before the drop, so the
  landing place is visible in advance.
- The card settles into the gap with `SPRING_CARRY` and **no bounce**.
- Keyboard move remains fully functional and is not a second code path.
- Sustained 60fps while dragging over a 5-lane board at 1440.
- Cancelling returns the card along its inbound path.

---

### 15 · Note → Task carry

**Desired** The note row travels from the Notes list and becomes the card in
its destination lane.
**Approach** Same-document view transition, sharing a name between the note
row and the created card. Items 1 and 2 are prerequisites. Note that the
composed suite **already implements the data half** of this — `app.js` calls
it "the seam": a note peeled in Notes becomes a card on the Tasks board, in
the lane the seam chose, and undo takes it back out of both. What is missing
is only the visible carry.
**Complexity** **M–L.**
**Acceptance**
- The note's text is continuously on screen from list to board — never
  cross-faded.
- The card lands in the correct lane at the correct index, and the lane
  count updates as it lands, not before.
- If the destination lane is off-screen, the board scrolls to it *first*, so
  the landing is always visible.
- Under reduced motion the card simply appears, and the board still scrolls
  to it.

---

## Closing note

Nine of these fifteen items contain little or no animation. Two are
deletions. The sprint that makes Signal Studio feel obsessed-over is mostly
a sprint about **finishing agreements the redesign already reached** — one
floor that two products have yet to stand on, one speed that answers to four
names, one component layer that four hundred and seventy-seven buttons have
never had, and one transition that an architecture was built to receive and
has not yet been given.

The brief's own closing principle is the right one, and this playbook's only
substantive amendment to it is a matter of sequence:

> The goal is not more animation. The goal is: every interaction feels
> considered.

Considered first requires *consistent*. That is week one.
