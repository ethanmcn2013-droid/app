export const meta = {
  name: 'master-suite-panel-round-3-final',
  description: '7 fresh independent seats grade the master-suite master against a 9.5 bar',
  phases: [
    { title: 'Review' },
    { title: 'Verify' },
  ],
}

const BAR = "Score against this standard: the work of an award-winning design studio that\niterated on this product for months. 10 is that studio's best shipped work.\nBenchmarks to hold it against, by name: Linear, Stripe, Vercel, xAI/Grok,\nSpaceX. Score the ARTIFACT, not the effort. A polite 8 that should be a 6\nmakes the panel worthless.\n\nWHAT YOU ARE REVIEWING\nSignal Studio, as it would look in production: **Notes, Tasks and Timeline as one\r\nrunning application** — one ink floor, one white sheet, one floating capsule spine\r\nbetween them, and one world of data underneath all three. It is not a document about\r\nthree products; it is the three products, live, with the walls taken out. A person\r\ncaptures a note, peels the words that matter off it, sends them to Tasks, watches the\r\ncard land in the lane the seam chose, and looks at the Timeline to see how far off the\r\nday is. The single job the whole surface does is: **make a season of work legible to\r\none person who has to run it.**\r\n\r\nThe three products arrive here having each survived twelve to nineteen rounds of\r\nadversarial review as standalone surfaces. What has never been reviewed is them being\r\none thing.\nThe audience: Orla, the venue manager at The Orchard — she runs weddings and events for a living, has.\n\nCONSTRAINTS THAT ARE NOT NEGOTIABLE (do not propose breaking these):\n- Palette is exactly 4 colours: Ink #111111, Indigo #4f46e5, White #ffffff, Indigo deep #4338ca, plus tints of those at\n  stated alpha. NO other hue may be introduced. Status and hierarchy are\n  expressed by ink density, weight and fill, not by colour.\n- Type is Geist and Geist Mono at weights 400 and 600 only.\n- The locked architecture:\n  - **The Studio Floor architecture.** An ink floor the whole app sits on — not a frame\r  \n    drawn around it. One white sheet lifted off it. The spine off the wall: a floating\r  \n    capsule carrying the suite, pointing at the sheet it opened. The dock at the foot.\r  \n    Identity on the sheet's own head. On a phone the capsule and the dock are the same\r  \n    object.\r  \n  - **Tasks · Direction C, Studio Floor**, at the founder's locked configuration:\r  \n    elevated cards, soft radius, comfortable density, subtle indigo, calm type.\r  \n  - **Notes · Direction C, The Stack**: two planes with depth between them, a desk above\r  \n    carrying the newest paper, an index below, reading lifts a note onto the desk,\r  \n    dictating takes the floor to ink, the seam peels a second smaller sheet off the note.\r  \n  - **Timeline · Direction B, The Approach**: the organising object is a distance, not a\r  \n    list; the day is a horizon that never moves; the past is behind you; position on the\r  \n    measure is `daysFromToday × pixels-per-day` computed from real dates.\r  \n  - **The suite is one application.** One rail, rendered once. Three products mounted at\r  \n    once, none ever torn down, so nothing a person was doing is lost when they glance at\r  \n    another.\n- Protected objects (polish, never redesign):\n  - **The seam.** Notes → peel → send → a card on the Tasks board in the lane the seam\r  \n    chose → `open-task` reveals it → undo removes it from both. This is the whole\r  \n    argument for a suite existing. Polish it; do not redesign the gesture.\r  \n  - **Honest doors.** Home, Inbox, Help, More and the account tile are present,\r  \n    reachable, in the tab order, and say plainly that they are not here yet. That is a\r  \n    designed answer, not a gap. **A finding that says \"build a Home screen\" is out of\r  \n    scope.** A finding that says the sentence on one of those doors is wrong is in.\r  \n  - **One clock, one cast, one venue.** The fixture asserts it. Do not propose data.\nFindings that amount to \"add a colour\", \"add a weight\" or \"restructure the\nlocked architecture\" are out of scope and will be discarded.\nAlso out of scope for this engagement:\n- Building Home, Inbox, Help, More, or an account surface.\r\n- A fourth colour, a third weight, a fourth typeface.\r\n- Data-model changes: a moment has no time of day, a task has no created-at, and\r\n  neither is this engagement's problem.\r\n- The port into `src/`. This is a lab artefact; `references/handover.md` governs the\r\n  port and it is not this engagement's job.\r\n- Re-litigating the three direction picks. Direction C, C and B are the founder's.\n\nMEASURED BASELINE. Two automated gates guard this master and both pass:\n- C:\\Users\\ethan\\.claude\\skills\\elevate\\scripts\\audit.mjs --lab=C:\\Users\\ethan\\signal-studio-workspace\\_wt-master-suite\\docs\\design\\labs\\master-suite-2026-08\n  (palette lock, weights, families, WCAG AA contrast against the real\n  composited backdrop, hit targets, radii, motion, type ramp, leading)\n- C:\\Users\\ethan\\signal-studio-workspace\\_wt-master-suite\\docs\\design\\labs\\master-suite-2026-08\\interaction-check.mjs\nREAD the behaviour gate. Everything it asserts is already proven; a finding\nthat restates one of those assertions is worthless and will be refuted on\nsight. Spend your findings on what automation cannot see.\n\nBefore scoring, also read the paid-for defect library at\nC:\\Users\\ethan\\.claude\\skills\\elevate\\references\\lessons.md — those classes have\nbeen found and fixed once already; check whether they are creeping back,\nand spend the rest of your attention past them.\n\nFRAMES (read the images):\nC:\\Users\\ethan\\signal-studio-workspace\\_wt-master-suite\\docs\\design\\labs\\master-suite-2026-08\\shots\\paper-tasks.board--1920x1000.png    tasks.board\nC:\\Users\\ethan\\signal-studio-workspace\\_wt-master-suite\\docs\\design\\labs\\master-suite-2026-08\\shots\\paper-tasks.dense--1920x1000.png    tasks.dense\nC:\\Users\\ethan\\signal-studio-workspace\\_wt-master-suite\\docs\\design\\labs\\master-suite-2026-08\\shots\\paper-notes.notebook--1920x1000.png    notes.notebook\nC:\\Users\\ethan\\signal-studio-workspace\\_wt-master-suite\\docs\\design\\labs\\master-suite-2026-08\\shots\\paper-notes.seam--1920x1000.png    notes.seam\nC:\\Users\\ethan\\signal-studio-workspace\\_wt-master-suite\\docs\\design\\labs\\master-suite-2026-08\\shots\\paper-notes.voice--1920x1000.png    notes.voice\nC:\\Users\\ethan\\signal-studio-workspace\\_wt-master-suite\\docs\\design\\labs\\master-suite-2026-08\\shots\\paper-timeline.owner-flight--1920x1000.png    timeline.owner-flight\nC:\\Users\\ethan\\signal-studio-workspace\\_wt-master-suite\\docs\\design\\labs\\master-suite-2026-08\\shots\\paper-timeline.desk--1920x1000.png    timeline.desk\nC:\\Users\\ethan\\signal-studio-workspace\\_wt-master-suite\\docs\\design\\labs\\master-suite-2026-08\\shots\\paper-timeline.phone--1920x1000.png    timeline.phone\nC:\\Users\\ethan\\signal-studio-workspace\\_wt-master-suite\\docs\\design\\labs\\master-suite-2026-08\\shots\\paper-tasks.board--390x844.png    tasks.board at 390x844\nC:\\Users\\ethan\\signal-studio-workspace\\_wt-master-suite\\docs\\design\\labs\\master-suite-2026-08\\shots\\paper-tasks.board--768x1024.png    tasks.board at 768x1024\nC:\\Users\\ethan\\signal-studio-workspace\\_wt-master-suite\\docs\\design\\labs\\master-suite-2026-08\\shots\\paper-tasks.board--1280x900.png    tasks.board at 1280x900\nC:\\Users\\ethan\\signal-studio-workspace\\_wt-master-suite\\docs\\design\\labs\\master-suite-2026-08\\shots\\paper-tasks.board--1440x960.png    tasks.board at 1440x960\nSource: C:\\Users\\ethan\\signal-studio-workspace\\_wt-master-suite\\docs\\design\\labs\\master-suite-2026-08\\_gate-suite.html\n\nGRADE BY DRIVING, NOT ONLY BY READING FRAMES. Open the master in Playwright\n(chromium; import { chromium } from \"@playwright/test\") at\nfile://C:\\Users\\ethan\\signal-studio-workspace\\_wt-master-suite\\docs\\design\\labs\\master-suite-2026-08\\_gate-suite.html?v=paper&state=<state> and operate it:\ntab through everything, press what looks pressable, exercise the keyboard\nmodel end to end, resize across 390/768/1280/1440/1920, and watch what every\nrepaint does to scroll position and focus.\nEverything is driven against the wrapped copy, which is what `verify.mjs` and\r\n`tools/wrap.mjs` produce:\r\n\r\n```\r\ndocs/design/labs/master-suite-2026-08/_gate-suite.html?state=<product>.<state>\r\n                                                      &v=paper|ink\r\n                                                      &layout=across|down\r\n```\r\n\r\n- **The spine**: `.rail [data-rail=\"notes|tasks|timeline\"]` — click or Enter. Arrows\r\n  walk it (down/up at desk, left/right at ≤720). It never rebuilds a product.\r\n- **Tasks**: cards are draggable and keyboard-carryable (Space picks up, arrows walk,\r\n  Enter drops). The tick completes. `Ctrl/⌘Z` undoes. Press a card body to open its\r\n  note. The chips in the head filter.\r\n- **Notes**: type in `.topField`. Click an index row to lift it onto the desk. Select\r\n  words in `.readBody`, then `[data-act=\"peel\"]`, then `[data-act=\"send\"]`. `Ctrl/⌘K`\r\n  searches. The suite tiles live in the dock at ≤720.\r\n- **Timeline**: `[data-layout-to=\"across\"|\"down\"]` on the measure's head switches\r\n  orientation. `.b-grab` opens a moment's editor; the steppers move it on the measure.\r\n  `Ctrl/⌘Z` undoes.\r\n- **Grade by driving.** Frames hide exactly the defects that cost most — a live region\r\n  that never announces, a repaint that loses your place, a keyboard model advertised\r\n  and not implemented.\n\nALREADY FIXED — 34 finding(s) closed in earlier rounds. Re-raising one\nwithout evidence of an actual regression is refuted on sight; if you believe one\nhas regressed, say so explicitly and cite what you measured.\nseam-sends-the-whole-note (r1), two-wedding-days (r1), ledger-count-is-half (r1), keycaps-four-notations (r1), orientation-switch-says-nothing-on-desk (r1), spoken-copy-below-the-visible-standard (r1), spine-arrows-broken (r1), waiting-lane-is-keyboard-inert (r1), phone-capsule-clamps-before-add (r1), undo-drops-focus-on-body (r1), timeline-wears-its-name-in-the-wrong-place (r1), three-eyebrows-for-one-role (r1), done-is-the-name-of-a-lane (r1), two-account-tiles-one-honest (r1), orphan-rule-under-the-orientation-control (r1), across-orphan-terminus-rule (r1), mara-finn-two-weddings (r1), rail-rover-double-steps (r1), undo-lies-outside-the-tick (r1), phone-undo-strip-eats-the-row-and-its-own-sentence (r1), spine-arrows-double-step (r1), spine-arrows-hijacked-on-notes (r1), spine-tabstop-lost-to-railadd (r1), closed-doors-are-indistinguishable (r1), ledger-time-reads-as-completion (r1), who-hit-target-clipped (r1), undo-drops-focus-to-body (r1), planning-drawer-buries-the-done-lane (r2), gap-sentence-frozen-in-across (r2), tick-leaves-focus-off-screen (r2), suite-url-never-written (r2), world-header-still-names-18-july (r2), planning-drawer-erases-the-done-lane (r2), board-does-not-scroll-focus-into-view (r2)\n\nALREADY REFUTED — raised once and killed, with the reason. Do not re-file these.\nnotes-index-measure-lost (r1) — The measurements are right and the conclusion is wrong. Driven at file://.../_gate-suite.html?v=pape\nreversed-type-compensation-only-in-tasks (r1) — The seat's Tasks facts are exactly right and I confirmed every one by driving the file at 1440. `--t\nmicro-label-two-faces (r1) — The PROBLEM is real and the numbers are right. Measured at runtime across all eight states: Notes re\ndate-face-splits-across-spine (r1) — REFUTED. The observation is partly true but loosely stated, and the fix is wrong on numbers, wrong o\nacross-third-tier-stagger (r1) — The primary observation reproduces exactly, but the finding misreads half its own evidence and the f\nkeycap-three-treatments (r1) — Factually wrong about the code on its load-bearing claim, and already handled on three of its four s\nperson-name-breaks-across-lines (r1) — The observation is largely real but the finding is wrong about the code in both halves of its fix, a\nthree-tracking-curves-are-one (r1) — REFUTED — the central measurement is wrong, and the truth runs the other way. I drove all eight stat\nspine-keyboard-dead-end (r1) — REFUTED ON THE FIX ONLY. The problem is real, reproduced verbatim, and blocking — do not discard it;\nthree-unavailability-grammars (r1) — The problem is partly real but the finding is refuted on its diagnosis and on its fix.\n\nWHAT I VERIF\neyebrow-tracked-three-ways (r1) — The kernel is real but the finding is wrong about the frames, wrong about its own premise, and its f\ntimeline-has-no-name-on-its-head (r1) — REFUTED — the problem is real, the fix is wrong on both halves, and the framing is factually wrong a\ntoday-named-three-ways (r1) — REFUTED — factually wrong about the frames, and the fix would damage Tasks.\n\n1. **Notes' head does n\nacross-editor-hides-the-measure (r1) — Compound finding. Half is measured correctly; the half that carries the severity is factually false \nenter-during-carry-does-not-drop (r1) — Every observable claim reproduces exactly — I drove it at 1440x960 and got, in order: \"Picked up Con\norientation-switch-closes-the-editor-silently (r1) — Every fact in the observation checks out when driven (chromium, 1440x960, ?state=timeline.owner-flig\nacross-guillotines-the-wedding-day (r1) — REFUTED — the underlying clipping is real, but the finding is factually wrong about the code on the \none-edit-reshuffles-the-whole-approach (r1) — The OBSERVATION is real and I reproduced it exactly; the PROPOSED FIX is wrong in both halves, so th\nthe-not-yet-sentence-is-only-a-tooltip (r1) — The headline claim is factually wrong, and the fix does not fix what is actually broken.\n\nDRIVEN, at\nnotes-index-lost-its-measure (r1) — REFUTED on the central claim and on the fix.\n\n1. \"Merely wider\" is contradicted by measurement. `src\nacross-rank-computed-on-a-slot-not-on-ink (r1) — REFUTED — the mechanism is real, the extent is overstated, and the fix does not do what it claims. V\npaper-width-follows-orientation (r1) — REFUTED. The load-bearing claim is factually false, several numbers are wrong, and the composition i\norientation-loses-the-reader (r1) — The PROBLEM is real and I reproduced it; the PROPOSED FIX does not fix it and would regress `across`\nnotes-two-body-rails (r1) — Three of the five numbers check out, the load-bearing one does not, and the fix is arithmetically ho\nnotes-index-lost-its-row (r1) — Measurements verified and essentially exact — I drove notes.notebook at 1280/1440/1920 and read the \neyebrow-drawn-three-ways (r1) — The PROBLEM is real and every number checks out against the source and a driven measurement at 1440:\nphone-bar-off-centre (r1) — The Tasks/Timeline half of the problem is real and I reproduced it exactly; the Notes half is factua\ncarry-drop-announces-the-wrong-thing (r1) — REFUTED — the finding is factually wrong about the code and about what it measured. Driven at 1440x9\nhead-numbers-three-affordances (r1) — REFUTED on the central measurement and on the fix.\n\n(1) The load-bearing claim is false. \"State is n\nfiltered-lanes-have-no-empty-state (r1) — Driven at 1920 with the \"1 overdue\" chip pressed. The premise is a DOM artefact read as a visual one\nacross-clips-the-lower-half-below-1440 (r1) — The PROBLEM reproduces almost exactly; the FIX is wrong on all three of its named levers, and two of\nseam-state-at-390-loses-the-note (r1) — The OBSERVATION is confirmed; the FIX is wrong, and two of the measurements are wrong, so it is refu\ntray-clips-cards-mid-line (r1) — REFUTED — the finding measured the wrong element and both halves of its fix already ship.\n\n\"no ::bef\nhonest-doors-say-it-only-to-the-eye (r1) — Factually wrong about the code, verified by driving it. The claim is that the sentence \"exists for t\nproduct-switch-loses-place (r1) — The load-bearing measurement is wrong. I drove `_gate-suite.html?v=paper&state=tasks.board` in Chrom\nacross-below-900-overflows (r1) — REFUTED — the load-bearing claim is measured against the wrong container and is false.\n\nDriven at fi\nhead-facts-ignore-the-filter (r1) — The measurement is right and I reproduced it exactly at 1440 (Playwright, tasks.board): pressing `.w\nvenue-name-three-heads (r1) — The raw numbers are mostly right but the argument built on them fails, and the fix would re-open a d\nnotes-desk-half-empty (r1) — Measured in Chromium at 1920x1000 against `_gate-suite.html?v=paper&state=notes.notebook|notes.seam`\nacross-fans-out-below-1280 (r1) — REFUTED on the fix, not on the problem. The problem is real and I reproduced almost every number by \nphone-loses-three-doors (r1) — REFUTED on the fix, not on the observation — and with two measurement errors that matter for a seat \nindex-row-ragged-gap (r1) — The gap numbers reproduce exactly (I measured 123, 227, 103, 304, 259, 20, 24, 303 at 1920 for the f\ndead-foundation-tokens (r1) — The greps are accurate — I re-ran them. `var(--x-status-done)`, `var(--x-status-done-tint)`, `var(--\nledger-still-counts-half (r2) — REFUTED ON THE FIX ONLY — the problem is real, reproduced exactly, and must NOT be discarded. Do not\ntasks-still-run-on-the-old-wedding (r2) — REFUTED ON THE FIX, NOT ON THE OBSERVATION — and one item inside it is worth splitting out and fixin\none-of-three-has-no-noun-and-no-door (r2) — REFUTED. The DOM description is verbatim correct and the conclusion drawn from it is wrong on three \nnotes-phone-spine-is-a-second-object (r2) — REFUTED ON THE FIX ONLY. The problem is real, I reproduced every measurement, and it is blocking-cla\nundo-denied-on-the-far-side-of-the-seam (r2) — REFUTED ON THE FIX ONLY — the problem is real, reproduces verbatim, and must not be discarded. Every\ncarry-survives-the-spine-unresolved (r2) — REFUTED ON THE FIX, NOT THE PROBLEM. The observation reproduces verbatim — do not discard it — but t\nnotebook-arrow-aliases-leak-through-the-note-body (r2) — REFUTED ON THE FIX, NOT ON THE PROBLEM — the fix as written kills a keycap that is drawn on screen.\n\n\nTHIS IS THE FINAL ROUND. There will be no further remediation, so your\nscore is the number that goes on the record. Grade it as the finished\nartifact.\n\nSay plainly what this is: name the score, name what earned it, and name what\nstill stands between it and finished in terms a founder can act on — is what\nremains polish, a build, or a different decision, and roughly how big. Do not\ninflate to be kind and do not deflate to look rigorous.\n\nHOW THIS ENGAGEMENT ENDS, so you know what your answer is for. It ends when\ntwo consecutive rounds confirm no finding classed blocking or misleading,\nboth gates green, on a frozen surface. It does NOT end on a score, and your\nscore gates nothing — it is recorded and reported. That is deliberate:\nacross 45 recorded rounds, seven blind seats scoring one artifact disagree\nwith a standard deviation of 0.335, so a unanimous 9.5 would need true\nquality of 9.94 to pass half the time and 10.23 to pass reliably, which is\noff the scale. Score honestly and put your real weight into the severity\nclasses, because those are what actually decide when this stops."
const NO_QUOTA = "Return your score to one decimal, an explicit signOff, every defect you\nactually found, and the single change that would raise the work most.\n\nTHERE IS NO QUOTA AND NO MINIMUM. Report only the defects you actually\nfound. An empty findings array is a valid and expected answer for a surface\nthat is genuinely finished, and it is the answer this panel is trying to\nreach. Padding the list with marginal material is the one thing that makes\nthis panel worthless: it is refuted, it costs a refuter, and it hides the\none signal that says the work is done. Do not aim for a number of findings.\n\nClassify every finding by severity - blocking, misleading, defect or\nrefinement - and say in 'consequence' what it does to the person using the\nproduct, because that is what justifies the class. Every finding carries the\nassertion that would prove it fixed; if you cannot state one, you are filing\na refinement whatever you called it.\n\nGive every finding a short kebab-case id. Do not hedge, do not give credit\nfor effort, and do not guess at any other seat's opinion."
const REFUTE_OPEN = "Adversarially verify one design-review finding against the artifact. Default to REFUTED when uncertain."
const REFUTE_RULES = "Refute if: it is factually wrong about the frames or the code; it is already handled; it would violate a non-negotiable constraint; it is taste stated as a defect with no argument; the fix would make the work worse; or it restates something the gates already prove. Also judge the PROPOSED FIX, not only the problem: say what it would plausibly break, what must be re-measured after it lands, and whether its numbers are right against the real source. A correct problem with a wrong fix is REFUTED, with the corrected fix in sharpenedFix. Also judge the SEVERITY. An overstated class is a reason to refute the whole finding; an understated one is corrected in your reason. blocking = the product will not do what it says; misleading = the product asserts something untrue; defect = visibly wrong but passable; refinement = nothing is wrong. Confirm only if real, specific, and an improvement at the declared bar. Echo the finding id back exactly so the verdict can be matched to its finding."

const SCHEMA = {
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

const SEATS = [
  {
    "key": "ui",
    "name": "UI composition",
    "lens": "Composition, alignment, optical balance, grid, rhythm, density, the relationship between the page's major objects. Where the eye goes first and whether that is right. Lazy spacing, unequal optical margins, things that align mathematically but not optically."
  },
  {
    "key": "type",
    "name": "Typography",
    "lens": "The type system: scale, weight pairing at 400/600 only, tracking curve, line-height, measure, mono micro-label discipline, numerals, orphans and widows, hierarchy carried by size versus weight versus tracking. Hold it to Vercel Geist and Linear standards."
  },
  {
    "key": "interaction",
    "name": "Interaction and states",
    "lens": "Hover, focus, active, selected, drag, empty, loading, dense. Affordance at rest. Reflow on hover. Discoverability of reveal-on-hover controls. Keyboard model and focus order. What the loading frame promises versus what arrives."
  },
  {
    "key": "ux",
    "name": "UX and information design",
    "lens": "Orla, the venue manager at The Orchard — she runs weddings and events for a living, has has to run their work from this. Comprehension without training. Is the most important thing on screen the most prominent thing. Duplicated, missing, or twice-named information. Dense and empty states."
  },
  {
    "key": "brand",
    "name": "Brand and copy",
    "lens": "Register: confident, premium, restrained, never cheap. Voice: plain English, declarative, no jargon, no exclamation marks, sentence case. Judge every visible string. One grammar per fact; one name per thing. Judge whether the palette is being spent well or merely obeyed."
  },
  {
    "key": "taste",
    "name": "Product taste and emotional resonance",
    "lens": "Would a discerning stranger believe a top studio made this and pay for it. Does it move you: relief, calm, confidence, delight. Or does it merely function. Name the single memorable moment, and if there is none that is the finding. Equal weight to any craft seat."
  },
  {
    "key": "evidence",
    "name": "Measured evidence",
    "lens": "You distrust opinion. Read the SOURCE closely. CSS that cannot do what it claims, dead rules, specificity collisions, values off the declared ladders, states declared but unreachable, responsive rules that will break, accessibility beyond contrast (semantics, roles, names, focus order, aria), and any place the code and its comment disagree. Cite selectors and line context."
  }
]

phase('Review')
const reviews = await parallel(SEATS.map((seat) => () =>
  agent(
    `You are the ${seat.name} seat on an independent design review panel. Round 3.\n\n` +
    `YOUR LENS\n${seat.lens}\n\n${BAR}\n\n` +
    NO_QUOTA,
    { label: `seat:${seat.key}`, phase: 'Review', schema: SCHEMA }
  )
))

const alive = reviews.filter(Boolean)

phase('Verify')
const verdicts = await parallel(
  alive.flatMap((review) =>
    review.findings.map((finding) => () =>
      agent(
        REFUTE_OPEN + '\n\n' +
        `FINDING id=${finding.id}\nSeat: ${review.seat}\nElement: ${finding.element}\nProblem: ${finding.problem}\nProposed fix: ${finding.fix}` +
        '\n\n' + BAR + '\n\n' + REFUTE_RULES,
        { label: `verify:${finding.id}`, phase: 'Verify', schema: {"type":"object","additionalProperties":false,"required":["id","real","reason"],"properties":{"id":{"type":"string"},"real":{"type":"boolean"},"reason":{"type":"string"},"sharpenedFix":{"type":"string"},"severity":{"type":"string","enum":["blocking","misleading","defect","refinement"],"description":"your verdict on the class, which may correct the seat's"},"breaks":{"type":"string","description":"what this fix would plausibly break, and what to re-measure after it lands"}}} }
      )
    )
  )
)

const byId = new Map()
for (const review of alive) {
  for (const finding of review.findings) byId.set(finding.id, { seat: review.seat, ...finding })
}

const checked = verdicts.filter(Boolean)
const confirmed = []
const refuted = []
for (const verdict of checked) {
  const finding = byId.get(verdict.id)
  if (!finding) continue
  /* The refuter's class wins where it gave one: the ending is stated in
     severity, so the adversarial read is the one that counts. */
  const row = {
    ...finding,
    severity: verdict.severity || finding.severity,
    verdict: verdict.reason,
    sharpenedFix: verdict.sharpenedFix || null,
    breaks: verdict.breaks || null,
  }
  if (verdict.real) confirmed.push(row)
  else refuted.push(row)
}

const count = (s) => confirmed.filter((f) => f.severity === s).length
const refuteRate = checked.length ? refuted.length / checked.length : 0

/* Refutation rate is the padding alarm. It ran 6% to 66% as seats filled a
   quota with marginal material, and fell to zero the round the quota went.
   Above 0.40 the panel is filing to fill slots, not reporting defects. */
log(`round 3: ${alive.length} seats, ${confirmed.length} confirmed, ${refuted.length} refuted (${Math.round(refuteRate * 100)}%)`)
log(`  blocking ${count('blocking')} · misleading ${count('misleading')} · defect ${count('defect')} · refinement ${count('refinement')}`)
if (refuteRate > 0.40) log(`  WARNING refutation ${Math.round(refuteRate * 100)}% — seats are padding; check the brief says an empty list is expected`)
if (count('blocking') === 0 && count('misleading') === 0) log(`  the ledger is CLEAN this round — see references/stopping.md`)

return {
  round: 3,
  seatsSat: alive.map((r) => r.seat),
  scores: alive.map((r) => ({ seat: r.seat, score: r.score, signOff: r.signOff, biggestWin: r.biggestWin })),
  signOffs: alive.filter((r) => r.signOff).map((r) => r.seat),
  severity: { blocking: count('blocking'), misleading: count('misleading'), defect: count('defect'), refinement: count('refinement') },
  refuteRate: Number(refuteRate.toFixed(3)),
  confirmed,
  refuted: refuted.map((r) => ({ seat: r.seat, id: r.id, problem: r.problem, why: r.verdict })),
}
