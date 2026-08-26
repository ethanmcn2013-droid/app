Adversarially verify one design-review finding against the artifact. Default to REFUTED when uncertain.

FINDING id=bound-nine-prints-where-no-nine-was-read
Seat: Measured evidence
Element: the coverage strip's last stamp, shell() at lately.html:904 - <span><b>Bound</b> workspace, owner, reading date and the ${D.open}</span>
Problem: D.open is F.bound.openCount, read unconditionally in the accessor and printed in every state. Driven at 1440 and read back: in `empty` the same strip says "TASKS ANSWERED, NOTHING RECORDED" and then "BOUND WORKSPACE, OWNER, READING DATE AND THE 9". In `error` it says "TASKS DID NOT ANSWER" and then the same 9. In `loading` it says all three sources are "READING" and still prints the 9. The open count is a Tasks-derived figure, so in two of those three the surface prints a number from a source it has just named as silent, one line away, in the same footer. This is not the closed error-state-invents-a-last-good-reading finding: the reading instant is a defensible stamp of when the attempt was made and I am not raising it. The open count is not - it is a reading, not an attempt.
Consequence claimed: The honest-degradation contract is that a reader can never mistake "we don't know" for a number, and this breaks it in the two states built to say we don't know. On `empty` the owner is told no work is recorded and shown a 9 in the same frame. On `error` the surface says "Nothing below is shown, because a part of this screen would be guessing" and then guesses, in the footer, three lines down. And because the denominator card is not on screen in any of those three states, "the 9" is a definite reference to a figure that appears nowhere else - the reader cannot even find out what it counts.
Severity claimed: misleading
Proposed fix: Make the stamp state-aware in shell(). Add `const DENOM_STATES = ["full", "partial", "quiet", "first-run"];` beside SOURCES, and replace line 904 with `<span><b>Bound</b> workspace, owner${DENOM_STATES.includes(state) ? `, reading date and the ${D.open}` : " and reading date"}</span>`. Nothing else in the footer changes.

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

ALREADY FIXED — 29 finding(s) closed in earlier rounds. Re-raising one
without evidence of an actual regression is refuted on sight; if you believe one
has regressed, say so explicitly and cite what you measured.
record-tag-never-paints (r1), bar-val-overprints-axis-max (r1), ua-margins-set-the-vertical-rhythm (r1), kpi-row-shares-no-line (r1), quiet-state-contradicts-its-own-evidence (r1), hero-total-folds-the-unfinished-week (r1), count-of-one-takes-a-plural-verb (r1), first-run-shows-a-41-day-old-job (r1), first-run-plot-has-no-scale (r1), openable-is-a-promise-nothing-keeps (r1), error-state-invents-a-last-good-reading (r1), stale-tip-strands-on-scroll (r1), age-axis-labels-are-laid-out-by-flexbox-not-by-value (r1), ghost-plot-orphaned-from-its-refusal (r1), refusals-written-in-the-studio-vocabulary (r1), august-inside-a-july-reading (r1), reading-rule-dangles-at-390 (r1), mark-hit-theft-at-390 (r1), no-pressed-state-anywhere (r1), dark-denominator-card-is-a-glare-panel (r1), partial-column-is-closed-at-the-top (r1), chart-is-announced-twice (r1), terminal-states-lose-their-heading-and-announce-nothing (r1), coverage-strip-sits-outside-every-landmark (r1), axis-ticks-go-ragged-between-560-and-900 (r1), kpi-row-and-ages-card-share-an-edge (r1), partial-drops-the-best-week-unannounced (r1), rail-glyphs-outside-the-locked-faces (r1), two-capitalisation-rules-in-one-tab-strip (r1)

ALREADY REFUTED — raised once and killed, with the reason. Do not re-file these.
twelve-weeks-claimed-where-no-twelve-weeks-exist (r1) — The mechanism is real - shell() at lately.html:724-728 prints 'Read at ${D.readingLong}' and a hard-
ghost-caption-sits-on-the-ghost-columns (r1) — The arithmetic checks out and the perceptual claim it rests on does not. Driven at 1440 the small li
focusable-while-invisible-during-entrance (r1) — The central measurement is wrong, and it is wrong in a way that inverts the consequence. Driven at ?
dead-rules-and-stale-comments (r1) — Driven in chromium across all seven states at 1440 and read against the source. Five of the six sub-
label-voice-set-on-a-paragraph (r1) — The typographic observation is half right and everything built on top of it is wrong. Measured in th
twelve-columns-withhold-their-own-numbers (r1) — Two of the finding's load-bearing factual claims are wrong when driven, and the consequence it deriv
fortnight-marker-lands-beside-a-fifteen-day-tick (r1) — The observation is half-right and the consequence is wrong. Right: lately.html:622 builds marks = [0
hero-count-starts-from-a-number-that-means-nothing (r1) — The code reading is right and the class is right, but the fix does not deliver the effect it is sold

ROUND NOTES
Round 1 raised 69 findings from seven blind seats, clustered to 37 distinct
claims, and confirmed 29 after a fresh refuter per claim. All 29 are fixed
and the behaviour gate grew from 122 assertions to 366.

What changed since you would last have seen this surface, so you argue with
it rather than reporting it as an oversight:

- The browser's own margins no longer set the vertical rhythm. Every gap on
  the surface is now a rung on the declared ladder, and the page is about a
  fifth shorter than it was.
- The chart has a right-hand label rail. The axis maximum, the previous-best
  tag and the live week's value each own their space; before this they
  printed on top of each other at every width.
- "Best week · 8" now paints. It never had, in any state, ground or motion
  mode, because an animation's fill outranked the settled override.
- The current week's column is open at the top, which is the edge a reader
  reads completeness from. It was open at the bottom, which sits on the
  baseline and is invisible.
- Every state now owns its own slice of the fixture. The quiet state's marks
  agree with its sentence, and first-run holds no job older than the account.
  derive-fixture.mjs fails the build if a scope's claim and its marks part.
- The age axis is derived from its own data with no floor, and its ticks
  stand on their values rather than being spread by flexbox.
- The hero names the running week it counts, and the window ends on the
  reading instant rather than on a week's first day.
- The error state no longer stamps a successful reading at the moment of
  the failure.
- The refusals are written for the owner, not for the team that built it.
- The rail marks are drawn; Geist carries none of the characters they used.

Deliberate decisions you may take for oversights — argue with them if you
disagree, but do not file them as misses:

- There is no scale on the first-run chart. With one week of data any
  gridline labels the datum with itself, and drawing the eleven weeks that
  have not happened is indistinguishable from eleven weeks of zero.
- The fortnight rule is not drawn on first-run. A threshold no mark can
  reach reads as a threshold every mark has beaten.
- The twelve columns carry no per-column values or tab stops. All twelve
  are named in the chart's spoken line; twelve 22px buttons would fail the
  hit-target floor at 390 and triple the keyboard path of a reading surface.
- The hero no longer says a finished job is openable, because nothing on
  this surface opens one. That is on the port packet, not on the screen.

Spend your findings on what these have not reached.

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


Write the JSON to C:\Users\ethan\signal-studio-workspace\_wt-home-analytics\docs\design\labs\home-analytics-2026-08\panel\round-2\refuters\bound-nine-prints-where-no-nine-was-read.json.

ENVIRONMENT NOTE: @playwright/test resolves only from C:\Users\ethan\signal-studio-workspace\collateral — run driving scripts with that as the working directory, and keep throwaway scripts out of the lab.
