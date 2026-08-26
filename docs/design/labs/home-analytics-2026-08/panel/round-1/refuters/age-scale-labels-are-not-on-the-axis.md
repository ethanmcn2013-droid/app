Adversarially verify one design-review finding against the artifact. Default to REFUTED when uncertain.

FINDING id=age-scale-labels-are-not-on-the-axis
Seat: Measured evidence
Element: .strip-scale in strip(), against the exactly positioned .dot and .fortnight
Problem: The dots and the fortnight line are positioned exactly (`left: calc(var(--x) * 1%)` from `age / D.axisMax`). The scale beneath them is not: `.strip-scale { display: flex; justify-content: space-between }` distributes four label boxes by their widths, so no label lands on the value it names. Measured centres against true positions: 'today' at 1.9% / 3.4% / 6.2% of the strip instead of 0% (1440 / 768 / 390 — a constant 19–20px error), '15d' at 34.7% / 35.8% / 37.9% instead of 33.3% (14px), '45d' at 98.9% / 98.0% / 96.3% instead of 100% (−11px). At 390 the '15d' label sits 21px right of the dashed fortnight line when the true gap between day 14 and day 15 is 7px. Worse, the marks are hard-coded `[0, 15, 30, 45]` while the axis maximum is derived — `D.axisMax = Math.max(45, Math.ceil((D.oldest + 4) / 5) * 5)`, with the comment 'A sixty-day job must not fall off the end of its own chart'. The fixture's oldest job is 41, which lands axisMax on exactly 45 and hides the error; at 42 days axisMax becomes 50 and every label is wrong by a further 10%, and at 56 days the label reading '45d' sits at the axis end, which is 60.
Consequence claimed: The reader misreads how old her oldest work is — by two to three days at phone width today, and by up to fifteen days as soon as a job passes 41 days, which is exactly the reader this strip exists for. The fortnight threshold appears to sit at about twelve days, so the count above it stops being explained by the picture and starts contradicting it.
Severity claimed: defect
Proposed fix: Position the scale the same way the marks are positioned. Replace the flex row with `.strip-scale { position: absolute; left: 0; right: 0; bottom: 0; height: 1.35em; } .strip-scale span { position: absolute; left: calc(var(--x) * 1%); transform: translateX(-50%); } .strip-scale span:first-child { transform: none; } .strip-scale span:last-child { transform: translateX(-100%); }` and render `const marks = [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(f * D.axisMax));` as `<span class="t-unit" data-type="unit" style="--x:${(n / D.axisMax) * 100}">${n === 0 ? "today" : n + "d"}</span>`.

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


Write the JSON to C:\Users\ethan\signal-studio-workspace\_wt-home-analytics\docs\design\labs\home-analytics-2026-08\panel\round-1\refuters\age-scale-labels-are-not-on-the-axis.json.

ENVIRONMENT NOTE: @playwright/test resolves only from C:\Users\ethan\signal-studio-workspace\collateral — run driving scripts with that as the working directory, and keep throwaway scripts out of the lab.
