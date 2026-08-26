You are the Measured evidence seat on an independent design review panel. Round 1.

YOUR LENS
You distrust opinion. Read the SOURCE closely. CSS that cannot do what it claims, dead rules, specificity collisions, values off the declared ladders, states declared but unreachable, responsive rules that will break, accessibility beyond contrast (semantics, roles, names, focus order, aria), and any place the code and its comment disagree. Cite selectors and line context.

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

Return ONLY a JSON object matching:
{
  "type": "object",
  "additionalProperties": false,
  "required": [
    "seat",
    "score",
    "signOff",
    "findings",
    "biggestWin"
  ],
  "properties": {
    "seat": {
      "type": "string"
    },
    "score": {
      "type": "number"
    },
    "signOff": {
      "type": "boolean",
      "description": "would you put your name to this as finished work"
    },
    "findings": {
      "type": "array",
      "minItems": 0,
      "items": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "id",
          "severity",
          "element",
          "problem",
          "consequence",
          "fix",
          "assertion"
        ],
        "properties": {
          "id": {
            "type": "string",
            "description": "a short kebab-case slug naming this defect"
          },
          "severity": {
            "type": "string",
            "enum": [
              "blocking",
              "misleading",
              "defect",
              "refinement"
            ]
          },
          "element": {
            "type": "string"
          },
          "problem": {
            "type": "string"
          },
          "consequence": {
            "type": "string",
            "description": "what this does to the person using the product - this is what justifies the severity"
          },
          "fix": {
            "type": "string",
            "description": "implementable exactly as written"
          },
          "assertion": {
            "type": "string",
            "description": "the check that will prove this fixed, written so it can be added to the behaviour gate"
          },
          "cost": {
            "type": "number",
            "description": "optional, reporting only, never summed"
          }
        }
      }
    },
    "biggestWin": {
      "type": "string"
    }
  }
}

Return your score to one decimal, an explicit signOff, every defect you
actually found, and the single change that would raise the work most.

THERE IS NO QUOTA AND NO MINIMUM. Report only the defects you actually
found. An empty findings array is a valid and expected answer for a surface
that is genuinely finished, and it is the answer this panel is trying to
reach. Padding the list with marginal material is the one thing that makes
this panel worthless: it is refuted, it costs a refuter, and it hides the
one signal that says the work is done. Do not aim for a number of findings.

Classify every finding by severity - blocking, misleading, defect or
refinement - and say in 'consequence' what it does to the person using the
product, because that is what justifies the class. Every finding carries the
assertion that would prove it fixed; if you cannot state one, you are filing
a refinement whatever you called it.

Give every finding a short kebab-case id. Do not hedge, do not give credit
for effort, and do not guess at any other seat's opinion.

Write the JSON to C:\Users\ethan\signal-studio-workspace\_wt-home-analytics\docs\design\labs\home-analytics-2026-08\panel\round-1\seat-evidence.json.

ENVIRONMENT NOTE (this machine)
`@playwright/test` resolves only from `C:\Users\ethan\signal-studio-workspace\collateral`.
Run every driving script with that as the working directory, e.g.

    cd "C:\Users\ethan\signal-studio-workspace\collateral" && node "C:\Users\ethan\AppData\Local\Temp\claude\C--Users-ethan\e00337f1-697d-4966-8b90-214de10e5345\scratchpad\drive-<yourseat>.mjs"

Write your throwaway driving scripts into that scratchpad directory, not into the lab.
Chromium is installed. Use `?motion=play` when you want to watch the entrance
choreography and the default (settled) when you want a stable measurement.
The master also serves `?state=` and `?v=dark`; grade the dark ground too.
