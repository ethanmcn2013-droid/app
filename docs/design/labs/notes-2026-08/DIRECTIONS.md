# Notes · the brief · 2026-08

Design exploration only. Branch `design/notes-exploration`, cut from
`design/tasks-exploration` so the lab foundation, the vendored Geist and the
locked Studio Floor travel with it. No PR, no deploy, no app-code or schema
change. The chrome and navigation contract gates are knowingly unmet until
product lock-in.

Nothing under `docs/design/labs/tasks-2026-08/` is edited by this programme.
Where a Tasks harness could not be reused unchanged, a sibling was added
beside it and named here.

Phase A is this document. Phases B to D are recorded below it as they land.

---

## 0 · The evidence this brief is built on

**The pinned "before".** `docs/design/shots/reference-2026-08/notes-*` — eight
states at four viewports, captured 2026-08-18 from the review build.

**The full state sweep, captured for this programme.**
`docs/design/shots/notes-reference-2026-08/` — 29 states at 1440×960, driven
through the real interface against the review fixture at `localhost:3510`.
Zero console errors. Twenty-three came from the inherited
`scripts/design/notes-scenes.mjs`; six came from a sibling,
`scripts/design/notes-scenes-extra.mjs`, added because the inherited harness
can no longer reach them.

**The first finding is the harness itself.** Four scenes in
`notes-scenes.mjs` fail against the build as it stands: the product moved and
the harness did not. Voice now opens on a consent stage, so every scene that
waited for "Stop and read it back" timed out on a screen that was never
recording; and the photo primary action is "Read with AI", not "Read this
photo". A capture harness that fails silently on the product's most
distinctive flow is how a 90-word legal wall reaches production without anyone
seeing a picture of it.

**The measured numbers below** come from driving the live build in Chromium
and reading computed styles, not from reading frames.

---

## 1 · What current Notes gets right

Four things are genuinely good and must survive every direction.

**The copy.** `notes-copy.ts` is the strongest writing in the product. Two
registers, every key defined in both, a mechanical ban list that fires on
`extract`, `promote`, `payload`, `receipt`, `workspace id`. "Write the thought
before it disappears…". "Your note stays here. Tasks only ever receives the
exact words you pick and check below." "Your note is still here, still
private, still yours to edit." The Tasks panel confirmed the voice is right.
Notes copy is judged against `studio/BRAND.md` and `pnpm
first-contact:language` — it is not redesigned.

**The privacy promise is architecture, not a badge.** The one-way edge into
Tasks is sealed by contract: `notes-task-send-contract.ts` sends a
sha256-sealed immutable request carrying only the words the person picked, and
a lease makes a retry find the existing task instead of making a second one.
The note never crosses. That is a real product idea and no competitor's
"convert to task" does it.

**The honesty states behave correctly.** Offline capture writes to the device,
the note appears in the shelf immediately with "Waiting to save", the count
updates, and the composer says what happened. Conflict keeps both versions.
Save-failure keeps the words. The behaviour is right.

**Three ways in, one instrument.** Type, Voice and Photo share a field, a
footer and one primary action, because a person capturing a thought is doing
one thing. The Composer's stated rule — *nothing a person captured is cleared
until it is somewhere safe* — is the correct rule and it is implemented: the
draft survives navigation, the transcript survives a failed extraction, the
photograph survives everything up to the moment its notes are saved.

---

## 2 · What is not world class

### 2.1 It is not on the palette lock, and it is not close

The lock inherited from the Tasks direction is Ink `#111111`, Indigo
`#4f46e5`, White `#ffffff`, and tints of those three. Status is carried by ink
density and fill, never by hue. Measured against the live build, Notes runs a
**five-hue** system:

| What is on screen | Value | Where |
|---|---|---|
| cool zinc, as the type colour | `#3f3f46` / `rgb(82,82,91)` on 283 nodes | `--ink-soft`, `--ink-ghost`, every secondary string |
| green | `#1b873f` | `--x-status-done`, the "In Tasks" flag |
| red | `#ef4444`, tint `#fee2e2` | `--status-blocked`, Delete, the offline sentence |
| amber | via `--status-flight` | `--x-task-warning` |
| indigo | `#4f46e5` | the accent, correctly |

The greys are the worse half. `#3f3f46` is not a tint of `#111111`; it is a
cool zinc with a blue cast, and it is the colour of nearly all the type in the
product. On a white sheet beside a true-ink wordmark it reads as slightly
dirty, and it is the single largest reason current Notes looks like a
competent SaaS app rather than a studio's work.

The red is worse than off-palette, it is **wrong**. The offline state — which
is the product working exactly as designed, holding your words safely on the
device — states its reassurance in red: *"Saved on this device. Notes will
save it as soon as you reconnect."* The behaviour says "nothing was lost". The
colour says "something broke".

### 2.2 The dominant type weight is a weight the lock forbids

`notes-workspace.module.css` declares `font-weight: 500` **twelve times**,
`600` six times, and `400` once. The most-used weight in Notes is the one
weight the locked Geist pairing does not permit. Three weights on one surface
is not a hierarchy, it is an absence of one.

### 2.3 The header does not belong to its own content

Measured at 1440×960:

```
root      x=  60  w=1380  right=1440
header    x=  60  w=1380  right=1440
composer  x= 277  w= 945  right=1223
list      x= 277  w= 384
detail    x= 661  w= 561  right=1223
```

The header rule runs the full 1380px. Everything under it is inset 217px on
each side. So the view tabs, the privacy lock and the options menu sit 217px
to the left of the composer's own left edge, with a hairline underneath them
that runs out past the content in both directions. Nothing in the sheet
resolves to a shared leading edge. The Studio Floor master has exactly one
leading edge — 28px — that the view pill, the tray label and every card
resolve to. Notes has two, and neither is aligned to the other.

### 2.4 The product throws away the screen it was given

| viewport | notebook width | discarded |
|---|---|---|
| 1280 | 943 | 337 |
| 1440 | 945 | 495 |
| 1920 | 981 | 939 |

Between 1440 and 1920 the product gains 480px of screen and spends 36px of it.
The reading pane never grows past 561px at any width. On a 1920 display,
**939px — very nearly half the window — is empty white**, and the notebook is
a narrow strip floating in it. A measure that is deliberately held is a design
decision; a measure held while the surrounding field stays pure white and
featureless is a decision that has not been drawn. This is the single
strongest argument for putting Notes on the Studio Floor: the floor is what
turns discarded width into deliberate ground.

The note body itself measures 59 characters at 17px/26.35px. That is correct
and is not the problem.

### 2.5 The first-use state says the same thing twice and offers no move

`notes-first-use--1440x960.png`. Two empty states are on screen at once, in
two columns, vertically centred at two different heights so they do not even
share a baseline:

> **Your notebook starts with one private thought.**
> The capture field is ready above.

> **Nothing here yet**
> Write your first note in the field above.

Both point upward at a field neither of them is attached to. Neither is a
control. A person's first second in Notes is spent reading two sentences that
say the same thing and being told, twice, to look somewhere else. The standing
checklist names this exactly: *empty states that repeat themselves instead of
offering exactly one first move.*

### 2.6 The header and the body contradict each other

Capture a note while offline. The shelf says **15 notes**. The tab above it
says **Notebook 14**. Both are on screen at the same time, six pixels apart.
The count that includes the note you just wrote is the smaller one.

### 2.7 The review queue is one small card in an ocean

`notes-review--1440x960.png`. The most important cross-product moment in the
suite — the decision that turns something you noticed into something you will
do — is a 700px-wide card, vertically centred, in roughly 1.2 million pixels
of undifferentiated white. Above it, "8 notes to review" in 13px grey. There
is no sense of a queue, no sense of progress, no sense of what you just
decided or what is next. Eight decisions are presented as one anonymous card
that silently replaces itself.

Four buttons sit in two clusters — `Keep in Notes` `Turn into task` · `Decide
later` `Delete` — with no visual account of why they are grouped that way, and
`Delete` is the only red thing on the screen, which makes destruction the most
chromatically prominent option in a review flow.

### 2.8 The seam covers up the thing you are deciding about

`review-turn-into-task.png`. The best idea in the product — *only the words
you pick ever cross* — is presented as a centred modal dialog that scrims the
note it came from. You cannot see the sentence you are extracting from while
you edit the extraction. The project picker is a **raw, unstyled `<select>`**
carrying the operating system's own chevron, the only such control on the
surface, and in the review fixture it reads "Review workspace" — a fixture
name reaching a product surface. The dialog is headed "Turn this into a task"
and the wording field is labelled "What the task says", which is good copy
attached to a control that belongs to a different product.

The contract underneath supports *picking words out of the note*
(`sourceSelection`). The interface offers a pre-filled single-line input and no
visible relationship to the source at all.

### 2.9 The voice flow opens with a wall

`voice-consent.png`. Pressing **Voice** does not start listening. It opens a
panel headed **"Before you record / Nothing is listening yet."** carrying five
sentences of disclosure and two bullets — around 90 words — before a **Start
recording** button.

The disclosure is honest and it is legally right, and the standing rule in
`notes-copy.ts` says so: the browser's speech engine is a third party the
person did not choose, and they are entitled to know. That rule is not up for
negotiation and no direction may delete it.

But *capture latency is the product*. Notes' entire promise is the three
seconds between having a thought and it being safe. Voice — the mode that
exists precisely for the moments when you cannot type — is currently the
slowest way in: two presses, a page of reading, then a microphone. The
disclosure must survive. Where it lives, what weight it carries, and whether
it costs a press are all open, and that is one of the real design problems of
this programme.

### 2.10 The read-back is a form

`voice-review.png` is, conceptually, the most delightful thing this product
does. You said one continuous run of speech; it comes back as **"2 notes from
this"** — separated, each editable, each individually removable, with "Edit
anything that is not quite right." That moment should be the thing people tell
each other about.

It is drawn as two identical single-line text inputs in a bordered box, with
`Discard` and `Save 2 notes`. There is no sense that something was *heard*, no
relationship drawn between the run of speech and the pieces it became, no
motion, nothing memorable. The idea is world class. The execution is a form.

### 2.11 Row decisions crowd out the notes

In the notebook, any note awaiting review renders a three-button row —
`Keep` · `Turn into task` · `Delete` — inline underneath it. In the dense
fixture, three of the five visible rows carry one. Roughly a third of the
shelf's vertical space is buttons rather than words the person wrote, and the
same three decisions are also the entire content of the Review view. The
product asks the same question in two places and settles it in neither.

### 2.12 There is no reading surface on a phone

`notes-notebook--390x844.png`. The composer takes about 350px of an 844px
screen before a single note is visible, and there is no detail pane at all:
tapping a note has nowhere to go. On the device where capture matters most,
Notes is a list of things you cannot read.

---

## 3 · What is inherited and not re-explored

From `docs/design/tasks-direction-lock-2026-08.md`, locked by the founder on
2026-08-18. These are the working hypothesis for Notes and a direction may not
silently fork them:

- a **floor** the whole app sits on, not a frame drawn around it
- one **sheet** holding the product, lifted off the floor
- the spine off the wall: a floating **capsule** carrying the suite
- the verbs collected into one **dock** at the foot of the sheet
- **identity on the sheet's own head**, the way a file names itself
- on a phone the capsule and the dock are the **same object**
- the **three-colour lock**, Geist 400/600, status by ink density and fill

If Studio Floor genuinely fails Notes somewhere, this document says so in
writing with evidence before anything forks.

**One inheritance is already under question, and it is named here rather than
decided.** Tasks resolved statuses into *trays* — shallow columns cut into the
sheet, so a card is somewhere. Notes has no columns. Its shelf is one
chronological run, and its equivalent question is what a *note* is an object
on: a shelf, a stack, a spread, or nothing at all. That is the anatomy each
direction has to answer differently, and it is the Notes counterpart of the
tray argument, not a copy of it.

---

## 4 · What is open · the actual exploration

Everything on the Notes sheet.

1. **The composer.** Capture is the entire promise. The composer is to Notes
   what the card was to Tasks: the object that must be world class. Idle,
   focused, filled, saving and failed are all first-class states.
2. **The note object and the shelf that holds it.** Typography of
   user-written content is the craft test. `long-content` is the torture test.
3. **Voice as a designed sequence** — consent, listening, processing,
   read-back — and photo as its sibling. The prime delight candidates.
4. **The review queue** and **the seam** into Tasks. The most important
   cross-product moment in the suite.
5. **Search**, **sent**, **every empty**, **dense**, **long**, **loading**.
6. **The honesty states.** Designed, not apologised for. Capture is only
   trustworthy if losing work is visibly impossible — and the reassurance
   must stop being red.

---

## 5 · The canonical lab state list

Twenty-nine captured product states fold to **ten lab states**. Every fold is
argued; nothing is dropped without a reason.

| # | Lab state | Folds these product states | Why they are one state |
|---|---|---|---|
| 1 | **notebook** | `composer-empty` · `note-selected` · `note-editing` · `privacy-popover` · `options-menu` | The resting state, where the product spends nearly all of its life. The composer at rest and the note being read are the same frame and cannot be judged apart: the argument each direction makes is about how much of the sheet capture is allowed to own when nothing is being captured. The two overlays are chrome on this state, not states of their own. |
| 2 | **capture** | `composer-focused` · `composer-content` | Focus and filled are one continuous moment. Photographed separately they hide the transition, which is the entire promise. One artboard carries the field growing, the counter arriving, the save affordance waking, and the keyboard path. |
| 3 | **voice** | `voice-consent` · `voice-listening` · `voice-processing` | Voice is a *sequence*, and judging any beat alone is exactly how a 90-word consent wall shipped in front of the fastest way into the product. One artboard, three beats, steppable, photographed at listening — so a seat has to see what it costs to reach that beat. |
| 4 | **readback** | `voice-review` · `photo-preview` · `photo-review` | Both AI paths land in the same stage: here is what came back, edit anything that is not quite right, keep what you want. Folding them forces one answer to that moment instead of two, and puts the photo preview beside the words it produced. |
| 5 | **review** | `review-queue` · `review-complete` | The queue and the end of the queue. Kept together because the round trip — eight decisions down to none — is the state, and `review-complete` is meaningless photographed alone. |
| 6 | **seam** | `review-turn-into-task` · `task-created` · `sent-view` | The notes-to-tasks crossing, both sides of it: the moment of choosing the words, the confirmation, and the standing record of everything that has crossed. One artboard, because the promise ("your note stays here") and the evidence ("here is what left") are the same argument and the product currently makes them in three places. |
| 7 | **search** | `search-results` | A query, its hits, and how a match is marked inside a person's own words. Kept out of `notebook` because term highlighting inside user-written prose is its own typographic problem. Its empty case moves to state 9 by design. |
| 8 | **pressure** | `dense` · `long-content` | The shelf under count, and the note object under length. Two different loads on the same two objects; one artboard so a direction cannot solve one by sacrificing the other. `dense` is 36 notes, `long-content` is a 900-word debrief. Both real fixtures. |
| 9 | **nothing** | `notebook-empty` · `notes-first-use` · `search-no-results` · `sent-empty` · `review-complete` (echo) | **Every empty in the product on one sheet.** The most deliberate fold in the list. The standing defect is empty states that repeat themselves instead of offering exactly one first move, and current Notes ships two of them side by side saying the same sentence. Putting all four on one artboard makes that failure impossible to miss and forces four *different* first moves. |
| 10 | **not-yet** | `notes-loading` · `save-failure` · `conflict` · `offline` · `note-delete-confirm` | Every state where the product does not yet have your work where it promised: still arriving, still saving, saved twice, saved only here, about to be destroyed. One family, because they share one job — make losing work visibly impossible — and because putting loading next to save-failure is what stops a direction designing a beautiful skeleton and a red apology. |

**What is deliberately not a lab state.** `sent-empty` is folded into
`nothing` rather than kept beside `sent-view`, because an empty "what has
crossed" shelf is an empty state before it is a sent state.
`privacy-popover` and `options-menu` are chrome on `notebook`.
`note-delete-confirm` sits in `not-yet` rather than `notebook` because it is
the one destructive act in the product and belongs with the states that argue
about safety.

Ten states × four viewports (390×844, 768×1024, 1280×900, 1440×960) × three
directions = **120 frames**.

---

## 6 · Zones, for reactions

Six zones per direction. The numbers exist so a reply in chat can name one
without describing it.

| # | Zone | What is in it |
|---|---|---|
| 1 | **Chrome** | the floor, the capsule, the sheet's head, the dock, where identity / search / account / suite switching live, and the phone merge |
| 2 | **Composer** | the capture instrument: idle, focused, filled, saving, failed; the three ways in; where it sits and how much it owns |
| 3 | **Note & shelf** | the note object, its typography, its metadata, its states, and the surface that holds the run of them |
| 4 | **Voice & read-back** | the spoken sequence and what comes back from it; the photo sibling; where the disclosure lives |
| 5 | **Review & seam** | the queue, the decision, the crossing into Tasks, and the record of what crossed |
| 6 | **Type, colour & motion** | the type scale at 400/600, where the one indigo is spent, how state reads without hue, and what moves |

The comparison surface carries a like / dislike / note control per zone per
direction and produces a copyable digest.

---

## 7 · Pinned decisions this programme expects to break

Named here in advance so no direction breaks one quietly. Each is argued in
full when a direction that breaks it is written.

| Pinned decision | Expected status | The argument, in one line |
|---|---|---|
| Notes' five-hue status system (green In Tasks, red Delete, amber, cool zinc) | **Superseded** | The three-colour lock is inherited from the Tasks lock; ink density and fill carry state, and the reassurance in the offline flow must stop being red. |
| `font-weight: 500` throughout `notes-workspace.module.css` | **Superseded** | Geist 400/600 only. |
| The top black rail, retired for Tasks | **Superseded** | Same brief, same retirement. The five jobs it carried are rehoused by each direction. |
| "Hairlines, not shadows" | **Narrowed** | Only the sheet, the capsule and the dock genuinely float. Everything flat keeps hairlines. Inherited unchanged from the Tasks lock. |
| The permanent 384px list / 561px detail split | **Open** | Each direction argues its own answer; none may keep it by default. |
| The voice consent stage as a blocking screen | **Open. The disclosure is not.** | The words survive verbatim. Where they live, and whether they cost a press, is the design problem. |

---

## 8 · The measured gate, built before round 1

Two harnesses, both siblings of the Tasks originals, both written before the
first panel round rather than after it — because the Tasks programme learned
at round 5 that grading frames instead of driving the file costs three seats.

- **`scripts/design/notes-audit.mjs`** — palette lock including WCAG AA
  contrast against the real composited backdrop; type weights and families;
  hit targets including pseudo-element expanders; the radii ladder; motion
  tokens. Across all ten lab states.
- **`scripts/design/notes-interaction-check.mjs`** — the behaviour gate:
  focus visibility everywhere, complete keyboard paths, scroll and focus
  place-keeping across every repaint, word-safe trims that re-run on
  `fonts.ready` and on resize, live-region announcements, and undo.

Both must be green before a panel round is convened, and every seat is told
what they already prove so no finding is spent restating one.

---

## 9 · The standing defect checklist, seeded into every seat

Tasks already paid for these. Repaints that annihilate scroll position and
focus. Keyboard models advertised but not implemented. Space and Enter
hijacked from labelled controls. Nothing reversible. Filters that dead-end
into an empty surface. Controls painting over content. Invisible-but-focusable
controls. Clamps that cut mid-word or silently delete content. Facts stated in
two grammars or contradicted between header and body. State carried only by
ink density with no accessible-name equivalent. Empty states that repeat
themselves. The tallest-column scroll trap. Anchors without hrefs.

And the three this product adds:

- **Capture latency.** Every millisecond between intent and ink is product.
- **Keystroke loss under a flaky network.** Nothing captured may ever be
  cleared until it is somewhere safe.
- **A voice flow that cannot be trusted blind.** If you have to look at the
  screen to know it heard you, it did not work.
