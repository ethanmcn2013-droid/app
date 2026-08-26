Adversarially verify one design-review finding against the artifact. Default to REFUTED when uncertain.

FINDING id=tooltip-text-stays-in-the-accessibility-tree
Seat: Measured evidence
Element: lately.html:645 — <div class="tip t-small" id="tip" role="presentation"></div>, hidden by opacity: 0 at lately.html:410
Problem: The tip is hidden with opacity, not visibility, and its innerHTML is never cleared. Driven at 1440x960: focus the fourth mark, then blur it. #tip.innerHTML remains <b>6 days open</b><s>Approve the final seating plan</s>, computed opacity 0, visibility visible, aria-hidden null. A CDP Accessibility.getFullAXTree taken in that state carries two un-ignored StaticText nodes — "6 days open" and "Approve the final seating plan" — with empty ignoredReasons. role="presentation" removes the div's own role and leaves its text exposed. The element is a sibling of #root, so that text sits after the provenance footer, outside header, main and footer alike. The surface states the rule it is breaking, at lately.html:298: "visibility, not opacity: an opacity-0 label is invisible to the eye and fully present in the accessibility tree" — applied to .xaxis span.mute and not to the tip. Nothing guards it: the gate's "no invisible label carries live text" is scoped to .chart at interaction-check.mjs:1089 and the tip lives outside the whole app tree. It is also the surface's only <s> element, which maps to a deletion role, used to carry a job title.
Consequence claimed: A screen-reader reader who has tabbed the strip and then reads on reaches the end of the document and hears an unlabelled fragment — a day count and a job title — belonging to whichever mark they last visited, sitting outside every landmark with nothing to explain it. It is stale by construction: it survives blur, scroll and dismissal, so it names a mark the reader is no longer on. On an instrument whose whole argument is that you can always tell what it read and when, an orphaned reading is the wrong last thing to say.
Severity claimed: defect
Proposed fix: Add aria-hidden="true" to the tip element at lately.html:645, so it reads <div class="tip t-small" id="tip" role="presentation" aria-hidden="true"></div>. Every fact the tip carries is already on the dot's own aria-label ("<title>, open N days"), which is the accessible channel, and the tip is already pointer-events: none, so nothing else is lost.

Score against this standard: the work of an award-winning design studio that
iterated on this product for months. 10 is that studio's best shipped work.
Benchmarks to hold it against, by name: Linear, Stripe, Vercel, xAI/Grok,
SpaceX. Score the ARTIFACT, not the effort. A polite 8 that should be a 6
makes the panel worthless.

WHAT YOU ARE REVIEWING
One owner, one Project, looking back over twelve weeks to answer one
question: **am I actually getting on top of this, or just busy?** Behind it:
what has quietly slipped while I wasn't looking, and is this stretch better
or worse than my normal.
The audience: A venue owner, wedding planner or small-studio operator — the 80% not in.

CONSTRAINTS THAT ARE NOT NEGOTIABLE (do not propose breaking these):
- Palette is exactly 18 colours: Ink #111111, Ink 2 (zinc 700) #3f3f46, Ink 3 (zinc 500) #71717a, Ink 4 (zinc 400) #a1a1aa, Ink 5 (zinc 300) #d4d4d8, Line (zinc 200) #e4e4e7, Paper 3 (zinc 100) #f4f4f5, Paper 2 #fafafa, Paper #ffffff, Indigo 600 #4f46e5, Indigo 500 #6366f1, Indigo 400 #818cf8, Amber 600 #d97706, Red 500 #ef4444, Emerald 600 #059669, Ground (dark) #0f0f10, Ground 2 (dark) #18181b, Ground 3 (dark) #27272a, plus tints of those at
  stated alpha. NO other hue may be introduced. Status and hierarchy are
  expressed by ink density, weight and fill, not by colour.
- Type is Geist and Geist Mono at weights 400 and 600 only.
- The locked architecture:
  - The route, the name and the place: `/app/home/analytics`, tab **Lately**,
    a tab strip beside Today's Signal and the Full Briefing. No rail icon, no
    wordmark, no marketing page.
  - The question, and the three movements.
  - The metric set. Seven real-now metrics used, two named as refusals, four
    cut. The table is `plan.html` §03. **A seat may not propose a metric that
    is not in that table.**
- Protected objects (polish, never redesign):
  - **The honest-degradation contract.** A missing source resolves to
    *unavailable*, never to a fabricated zero. A reader can never mistake "we
    don't know" for "it's zero".
  - **The "What this can't tell you" movement.** May be made more beautiful;
    may not be shrunk to a footnote or removed.
  - **The drawn-but-empty plot.** The trend the product cannot produce is
    drawn as the chart it would be.
  - **The partial-bucket treatment.** The current week is hatched and
    open-topped because the week is not over.
  - **The shared denominator.** All five KPI cards read the same 9.
Findings that amount to "add a colour", "add a weight" or "restructure the
locked architecture" are out of scope and will be discarded.

MEASURED BASELINE. Two automated gates guard this master and both pass:
- C:\Users\ethan\.claude\skills\elevate\scripts\audit.mjs --lab=C:\Users\ethan\signal-studio-workspace\_wt-home-analytics\docs\design\labs\home-analytics-2026-08
  (palette lock, weights, families, WCAG AA contrast against the real
  composited backdrop, hit targets, radii, motion, type ramp, leading)
- C:\Users\ethan\signal-studio-workspace\_wt-home-analytics\docs\design\labs\home-analytics-2026-08\interaction-check.mjs
READ the behaviour gate. Everything it asserts is already proven; a finding
that restates one of those assertions is worthless and will be refuted on
sight. Spend your findings on what automation cannot see.

Before scoring, also read the paid-for defect library at
C:\Users\ethan\.claude\skills\elevate\references\lessons.md — those classes have
been found and fixed once already; check whether they are creeping back,
and spend the rest of your attention past them.

FRAMES (read the images):
C:\Users\ethan\signal-studio-workspace\_wt-home-analytics\docs\design\labs\home-analytics-2026-08\shots\light-full--1440x960.png    full
C:\Users\ethan\signal-studio-workspace\_wt-home-analytics\docs\design\labs\home-analytics-2026-08\shots\light-partial--1440x960.png    partial
C:\Users\ethan\signal-studio-workspace\_wt-home-analytics\docs\design\labs\home-analytics-2026-08\shots\light-quiet--1440x960.png    quiet
C:\Users\ethan\signal-studio-workspace\_wt-home-analytics\docs\design\labs\home-analytics-2026-08\shots\light-first-run--1440x960.png    first-run
C:\Users\ethan\signal-studio-workspace\_wt-home-analytics\docs\design\labs\home-analytics-2026-08\shots\light-empty--1440x960.png    empty
C:\Users\ethan\signal-studio-workspace\_wt-home-analytics\docs\design\labs\home-analytics-2026-08\shots\light-loading--1440x960.png    loading
C:\Users\ethan\signal-studio-workspace\_wt-home-analytics\docs\design\labs\home-analytics-2026-08\shots\light-error--1440x960.png    error
C:\Users\ethan\signal-studio-workspace\_wt-home-analytics\docs\design\labs\home-analytics-2026-08\shots\light-full--390x844.png    full at 390x844
C:\Users\ethan\signal-studio-workspace\_wt-home-analytics\docs\design\labs\home-analytics-2026-08\shots\light-full--768x1024.png    full at 768x1024
C:\Users\ethan\signal-studio-workspace\_wt-home-analytics\docs\design\labs\home-analytics-2026-08\shots\light-full--1280x900.png    full at 1280x900
Source: C:\Users\ethan\signal-studio-workspace\_wt-home-analytics\docs\design\labs\home-analytics-2026-08\lately.html

GRADE BY DRIVING, NOT ONLY BY READING FRAMES. Open the master in Playwright
(chromium; import { chromium } from "@playwright/test") at
file://C:\Users\ethan\signal-studio-workspace\_wt-home-analytics\docs\design\labs\home-analytics-2026-08\lately.html?v=light&state=<state> and operate it:
tab through everything, press what looks pressable, exercise the keyboard
model end to end, resize across 390/768/1280/1440, and watch what every
repaint does to scroll position and focus.

ALREADY FIXED — 43 finding(s) closed in earlier rounds. Re-raising one
without evidence of an actual regression is refuted on sight; if you believe one
has regressed, say so explicitly and cite what you measured.
record-tag-never-paints (r1), bar-val-overprints-axis-max (r1), ua-margins-set-the-vertical-rhythm (r1), kpi-row-shares-no-line (r1), quiet-state-contradicts-its-own-evidence (r1), hero-total-folds-the-unfinished-week (r1), count-of-one-takes-a-plural-verb (r1), first-run-shows-a-41-day-old-job (r1), first-run-plot-has-no-scale (r1), openable-is-a-promise-nothing-keeps (r1), error-state-invents-a-last-good-reading (r1), stale-tip-strands-on-scroll (r1), age-axis-labels-are-laid-out-by-flexbox-not-by-value (r1), ghost-plot-orphaned-from-its-refusal (r1), refusals-written-in-the-studio-vocabulary (r1), august-inside-a-july-reading (r1), reading-rule-dangles-at-390 (r1), mark-hit-theft-at-390 (r1), no-pressed-state-anywhere (r1), dark-denominator-card-is-a-glare-panel (r1), partial-column-is-closed-at-the-top (r1), chart-is-announced-twice (r1), terminal-states-lose-their-heading-and-announce-nothing (r1), coverage-strip-sits-outside-every-landmark (r1), axis-ticks-go-ragged-between-560-and-900 (r1), kpi-row-and-ages-card-share-an-edge (r1), partial-drops-the-best-week-unannounced (r1), rail-glyphs-outside-the-locked-faces (r1), two-capitalisation-rules-in-one-tab-strip (r1), rise-fill-outranks-every-interaction-rule (r2), fortnight-label-escapes-its-card (r2), first-run-week-label-stands-300px-from-its-mark (r2), skeleton-draws-the-data-it-says-it-is-still-reading (r2), kpi-cards-announce-their-fact-twice (r2), focused-mark-lands-flush-on-the-window-edge (r2), keyboard-cannot-scroll-the-reading-surface (r2), kpi-cards-are-links-that-open-nothing (r2), loading-frame-is-a-movement-short (r2), resize-strands-focus-below-the-fold (r2), week-ticks-spread-by-flexbox-when-they-are-thinned (r2), status-indigo-is-the-only-mark-the-dark-twin-forgets (r2), chart-and-strip-marks-fall-under-the-non-text-floor (r2), the-all-clear-sentence-drops-one-of-its-four-categories (r2)

ALREADY REFUTED — raised once and killed, with the reason. Do not re-file these.
twelve-weeks-claimed-where-no-twelve-weeks-exist (r1) — The mechanism is real - shell() at lately.html:724-728 prints 'Read at ${D.readingLong}' and a hard-
ghost-caption-sits-on-the-ghost-columns (r1) — The arithmetic checks out and the perceptual claim it rests on does not. Driven at 1440 the small li
focusable-while-invisible-during-entrance (r1) — The central measurement is wrong, and it is wrong in a way that inverts the consequence. Driven at ?
dead-rules-and-stale-comments (r1) — Driven in chromium across all seven states at 1440 and read against the source. Five of the six sub-
label-voice-set-on-a-paragraph (r1) — The typographic observation is half right and everything built on top of it is wrong. Measured in th
twelve-columns-withhold-their-own-numbers (r1) — Two of the finding's load-bearing factual claims are wrong when driven, and the consequence it deriv
fortnight-marker-lands-beside-a-fifteen-day-tick (r1) — The observation is half-right and the consequence is wrong. Right: lately.html:622 builds marks = [0
hero-count-starts-from-a-number-that-means-nothing (r1) — The code reading is right and the class is right, but the fix does not deliver the effect it is sold
try-again-has-no-designed-press (r2) — The headline is false and the fix is wrong about the source. (1) The title's claim is already closed
first-run-fortnight-card-reads-as-an-achievement (r2) — Driven in chromium at 1440/1280/768/390 at ?state=first-run and read against lately.html and fixture
bound-nine-prints-where-no-nine-was-read (r2) — The mechanism is real and the speech act is misread, which collapses the consequence. Driven in chro
every-age-mark-names-itself-twice-in-the-tree (r2) — The mechanism is right and the consequence, which is the only part that would earn a change at this 
the-reading-instant-is-printed-twice (r2) — Every factual claim checks out and the fix is still wrong. Driven in chromium across all seven state

ROUND NOTES
This is the closing round. **The structure is frozen.** A finding whose
answer is "build X" — a destination, a wired retry, a new object — is
recorded on the port packet and is not remediated on this surface. File it
if it is real; it will be honoured, but it will not move a pixel this round.
Findings that change what is already on the screen are the ones that can be
acted on.

Two rounds have run. Round 1 raised 69 findings from seven blind seats,
clustered to 37 distinct claims, confirmed 29. Round 2 raised 26 from three
rotating seats, clustered to 19, confirmed 14, and confirmed **nothing
blocking and nothing misleading**. The behaviour gate has grown from 122
assertions to 461. Both gates are green.

## What changed in round 2, so you argue with it rather than report it

- **Interaction paints at all.** `.rise` used `animation-fill-mode: both`,
  which puts the keyframe end state in the animation origin — a layer that
  outranks every plain author declaration permanently. Every `:hover` and
  `:active` transform on this surface had been dead since it was written.
  The fill is now `backwards`, so rest, hover and press are three different
  frames and the gate measures all three from what actually paints.
- **The document is the scroller.** The rail is sticky at full height; the
  reading column scrolls with the page, so the keyboard can reach the bottom
  of the surface and a resize no longer strands focus below the fold.
- **The loading state neutralises every magnitude in place.** It used to
  draw the data it claimed to still be reading, at full value, then swap it
  for the same numbers. It now holds the geometry and none of the facts, and
  the strip reserves the band the de-swarm may need instead of growing into
  it — a loading frame cannot promise a height that depends on data it has
  not read.
- **The KPI row is read, not operated.** The cards were link roles whose
  href appended a bare `#`. The role is gone; the row's sentence moved from
  duplicated text leaves onto the group's own name, so each card is
  announced once.
- **Quiet marks carry a ring.** Marks under the fortnight were a fill that
  composited under the 3:1 non-text floor; they are now ringed, solid past
  the fortnight, which clears the floor without leaning on hue.
- **The fortnight label no longer escapes its card**, and the first-run week
  label stands next to its own mark rather than 300px away.
- **Status indigo is in the dark lock.** It was the one mark the dark twin
  had no token for.
- **Focus rings are inset from the window edge**, so a focused mark at the
  scroll boundary is not clipped by it.

## Decisions you may take for oversights — argue, do not file as misses

Everything in `round-2-notes.md` still stands. In addition:

- **The chart's context columns sit at 1.48:1 (light) and 1.70:1 (dark)**
  against the card, under the 3:1 non-text floor. This is known, measured
  and on the port packet. The obvious fix inverts the chart: the current
  week is a hatch compositing to 1.71:1, *fainter* than the columns it would
  be contrasted against, so darkening the columns alone makes the live mark
  the weakest thing in the frame. If you have a fix that does not invert the
  reading, that is worth a finding. Restating the shortfall is not.
- **Nothing on this surface opens anything.** There is no destination for a
  filtered list of open work and no wiring for the retry. Both are on the
  port packet. An affordance that leads nowhere is the defect round 2
  removed; do not ask for it back.
- **`?state=` and `?v=` exit 2 on an unknown value.** That is the contract,
  not a crash.
- **The fixture is Harbour House, weddings, Orla, nine open.** Every number
  on the screen is derived from `src/lib/project-truth-fixture.ts` and the
  build fails if a state's sentence and its own marks disagree. A number you
  think is wrong is a fixture question, not a copy question.
- **The company name is never shortened.** Note bodies and email never enter
  this domain.

## What is worth your findings

This round is graded on whether the surface is finished, not on whether it
could be different. The highest-value findings are the ones that survive a
refuter defaulting to REFUTED: something that is measurably wrong in a state
you drove, at a width you set, on a ground you flipped — or an assertion in
`interaction-check.mjs` that **cannot fail**, which is worth more than the
defect that exposes it. Four vacuous assertions have been found so far; two
of them were written by seats in earlier rounds and two were mine.

**An empty findings array is the expected answer for a finished surface.**
There is no quota. Do not raise a refinement to have raised something.

THIS IS THE FINAL ROUND. There will be no further remediation, so your
score is the number that goes on the record. Grade it as the finished
artifact.

Say plainly what this is: name the score, name what earned it, and name what
still stands between it and finished in terms a founder can act on — is what
remains polish, a build, or a different decision, and roughly how big. Do not
inflate to be kind and do not deflate to look rigorous.

HOW THIS ENGAGEMENT ENDS, so you know what your answer is for. It ends when
two consecutive rounds confirm no finding classed blocking or misleading,
both gates green, on a frozen surface. It does NOT end on a score, and your
score gates nothing — it is recorded and reported. That is deliberate:
across 45 recorded rounds, seven blind seats scoring one artifact disagree
with a standard deviation of 0.335, so a unanimous 9.5 would need true
quality of 9.94 to pass half the time and 10.23 to pass reliably, which is
off the scale. Score honestly and put your real weight into the severity
classes, because those are what actually decide when this stops.

Refute if: it is factually wrong about the frames or the code; it is already handled; it would violate a non-negotiable constraint; it is taste stated as a defect with no argument; the fix would make the work worse; or it restates something the gates already prove. Also judge the PROPOSED FIX, not only the problem: say what it would plausibly break, what must be re-measured after it lands, and whether its numbers are right against the real source. A correct problem with a wrong fix is REFUTED, with the corrected fix in sharpenedFix. Also judge the SEVERITY. An overstated class is a reason to refute the whole finding; an understated one is corrected in your reason. blocking = the product will not do what it says; misleading = the product asserts something untrue; defect = visibly wrong but passable; refinement = nothing is wrong. Confirm only if real, specific, and an improvement at the declared bar. Echo the finding id back exactly so the verdict can be matched to its finding.

Return ONLY a JSON object matching:
{
  "type": "object",
  "additionalProperties": false,
  "required": [
    "id",
    "real",
    "reason"
  ],
  "properties": {
    "id": {
      "type": "string"
    },
    "real": {
      "type": "boolean"
    },
    "reason": {
      "type": "string"
    },
    "sharpenedFix": {
      "type": "string"
    },
    "severity": {
      "type": "string",
      "enum": [
        "blocking",
        "misleading",
        "defect",
        "refinement"
      ],
      "description": "your verdict on the class, which may correct the seat's"
    },
    "breaks": {
      "type": "string",
      "description": "what this fix would plausibly break, and what to re-measure after it lands"
    }
  }
}


Write the JSON to C:\Users\ethan\signal-studio-workspace\_wt-home-analytics\docs\design\labs\home-analytics-2026-08\panel\round-3\refuters\tooltip-text-stays-in-the-accessibility-tree.json.

ENVIRONMENT NOTE: @playwright/test resolves only from C:\Users\ethan\signal-studio-workspace\collateral — run driving scripts with that as the working directory, and keep throwaway scripts out of the lab.
