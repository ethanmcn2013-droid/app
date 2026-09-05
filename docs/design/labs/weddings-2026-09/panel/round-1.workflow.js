export const meta = {
  name: 'weddings-panel-round-1',
  description: 'Seven fresh independent seats grade the weddings master against a 9.5 bar',
  phases: [
    { title: 'Review' },
    { title: 'Verify' },
  ],
}

const BAR = "Score against this standard: the work of an award-winning design studio that\niterated on this product for months. 10 is that studio's best shipped work.\nBenchmarks to hold it against, by name: Linear, Stripe, Vercel, xAI/Grok,\nSpaceX. Score the ARTIFACT, not the effort. A polite 8 that should be a 6\nmakes the panel worthless.\n\nWHAT YOU ARE REVIEWING\nThe weddings section of Signal Studio. Signal Studio is project management for\nnormal people; its core rail is Notes, Tasks and Timeline, and Weddings is the\nfirst add-on section a person adds with the `+`. This engagement elevates what\nthat section contains: four destinations in the rail — Guests, Money, Seating,\nThe Day — and the nineteen modes beneath them, rendered on the Studio Floor (ink\nfloor, floating rail, one white sheet). The single job: two people run the\nplanning of their own wedding from these four places without being taught how.\nThe audience: Two people planning their own wedding, tired, on a laptop, who have never used.\n\nCONSTRAINTS THAT ARE NOT NEGOTIABLE (do not propose breaking these):\n- Palette is exactly 3 colours: Ink #111111, Indigo #4f46e5, White #ffffff, plus tints of those at\n  stated alpha. NO other hue may be introduced. Status and hierarchy are\n  expressed by ink density, weight and fill, not by colour.\n- Type is Geist and Geist Mono at weights 400 and 600 only.\n- The locked architecture:\n  - The Studio Floor shell: ink floor, floating labelled rail, one white sheet at\n    16px on the floating shadow.\n  - The add-on is a labelled **section in the rail** — WORKSPACE, then WEDDING ·\n    12 September — not a tab strip in the sheet.\n  - Four destinations: Guests, Money, Seating, The Day. Nineteen modes, shown as a\n    segment row in the sheet head's right cell.\n  - Adding Weddings **seeds before it adds anything**: the plan, the jobs, the\n    categories, the sends, the moments land first; the section appears second.\n  - **Seating opens on the list** (Still to seat), with the room as the second\n    mode.\n  - The three panel corrections stand: shares are never drawn on the severity\n    ramp; a check that could not run is never drawn as passed; the household view\n    keeps the salutation, the unnamed plus-one and the part-replied state.\n- Protected objects (polish, never redesign):\n  - The palette lock and the two weights. Any change must survive `audit.mjs`.\n  - The rail, the `+`, the picker and the seed sequence: they are the frame.\n    Polish is welcome; a finding that redesigns them is out of scope.\n  - The IA above: four destinations, nineteen modes, their names.\n  - The 400ms tier stays reserved for named moments; nothing decorative moves at\n    it.\nFindings that amount to \"add a colour\", \"add a weight\" or \"restructure the\nlocked architecture\" are out of scope and will be discarded.\nAlso out of scope for this engagement:\nHome, Notes, Tasks and Timeline. The rail, the `+`, the picker and the seed as\nobjects (frame, not findings). Phone layouts — desktop and laptop only this\nround; phone is recorded in the honest distance. The RSVP form, the wedding\nwebsite, the supplier pipeline. Persistence, backend, real data. A finding that\namounts to \"add a colour\", \"add a weight\" or \"restructure the locked\narchitecture\" is discarded on sight.\n\nMEASURED BASELINE. Two automated gates guard this master and both pass:\n- C:\\Users\\ethan\\signal-studio-workspace\\skills\\elevate\\scripts\\audit.mjs --lab=C:\\Users\\ethan\\signal-studio-workspace\\worktrees\\app\\design-weddings-exploration\\docs\\design\\labs\\weddings-2026-09\n  (palette lock, weights, families, WCAG AA contrast against the real\n  composited backdrop, hit targets, radii, motion, type ramp, leading)\n- C:\\Users\\ethan\\signal-studio-workspace\\worktrees\\app\\design-weddings-exploration\\docs\\design\\labs\\weddings-2026-09\\interaction-check.mjs\nREAD the behaviour gate. Everything it asserts is already proven; a finding\nthat restates one of those assertions is worthless and will be refuted on\nsight. Spend your findings on what automation cannot see.\n\nBefore scoring, also read the paid-for defect library at\nC:\\Users\\ethan\\signal-studio-workspace\\skills\\elevate\\references\\lessons.md — those classes have\nbeen found and fixed once already; check whether they are creeping back,\nand spend the rest of your attention past them.\n\nFRAMES (read the images):\nC:\\Users\\ethan\\signal-studio-workspace\\worktrees\\app\\design-weddings-exploration\\docs\\design\\labs\\weddings-2026-09\\shots\\a-guests-list--1440x960.png    guests-list\nC:\\Users\\ethan\\signal-studio-workspace\\worktrees\\app\\design-weddings-exploration\\docs\\design\\labs\\weddings-2026-09\\shots\\a-guests-household--1440x960.png    guests-household\nC:\\Users\\ethan\\signal-studio-workspace\\worktrees\\app\\design-weddings-exploration\\docs\\design\\labs\\weddings-2026-09\\shots\\a-guests-replies--1440x960.png    guests-replies\nC:\\Users\\ethan\\signal-studio-workspace\\worktrees\\app\\design-weddings-exploration\\docs\\design\\labs\\weddings-2026-09\\shots\\a-guests-sends--1440x960.png    guests-sends\nC:\\Users\\ethan\\signal-studio-workspace\\worktrees\\app\\design-weddings-exploration\\docs\\design\\labs\\weddings-2026-09\\shots\\a-guests-food--1440x960.png    guests-food\nC:\\Users\\ethan\\signal-studio-workspace\\worktrees\\app\\design-weddings-exploration\\docs\\design\\labs\\weddings-2026-09\\shots\\a-guests-travel--1440x960.png    guests-travel\nC:\\Users\\ethan\\signal-studio-workspace\\worktrees\\app\\design-weddings-exploration\\docs\\design\\labs\\weddings-2026-09\\shots\\a-money-number--1440x960.png    money-number\nC:\\Users\\ethan\\signal-studio-workspace\\worktrees\\app\\design-weddings-exploration\\docs\\design\\labs\\weddings-2026-09\\shots\\a-money-category--1440x960.png    money-category\nC:\\Users\\ethan\\signal-studio-workspace\\worktrees\\app\\design-weddings-exploration\\docs\\design\\labs\\weddings-2026-09\\shots\\a-money-paying--1440x960.png    money-paying\nC:\\Users\\ethan\\signal-studio-workspace\\worktrees\\app\\design-weddings-exploration\\docs\\design\\labs\\weddings-2026-09\\shots\\a-money-due--1440x960.png    money-due\nC:\\Users\\ethan\\signal-studio-workspace\\worktrees\\app\\design-weddings-exploration\\docs\\design\\labs\\weddings-2026-09\\shots\\a-money-supplier--1440x960.png    money-supplier\nC:\\Users\\ethan\\signal-studio-workspace\\worktrees\\app\\design-weddings-exploration\\docs\\design\\labs\\weddings-2026-09\\shots\\a-seating-queue--1440x960.png    seating-queue\nC:\\Users\\ethan\\signal-studio-workspace\\worktrees\\app\\design-weddings-exploration\\docs\\design\\labs\\weddings-2026-09\\shots\\a-seating-room--1440x960.png    seating-room\nC:\\Users\\ethan\\signal-studio-workspace\\worktrees\\app\\design-weddings-exploration\\docs\\design\\labs\\weddings-2026-09\\shots\\a-seating-table--1440x960.png    seating-table\nC:\\Users\\ethan\\signal-studio-workspace\\worktrees\\app\\design-weddings-exploration\\docs\\design\\labs\\weddings-2026-09\\shots\\a-seating-plans--1440x960.png    seating-plans\nC:\\Users\\ethan\\signal-studio-workspace\\worktrees\\app\\design-weddings-exploration\\docs\\design\\labs\\weddings-2026-09\\shots\\a-seating-check--1440x960.png    seating-check\nC:\\Users\\ethan\\signal-studio-workspace\\worktrees\\app\\design-weddings-exploration\\docs\\design\\labs\\weddings-2026-09\\shots\\a-day-order--1440x960.png    day-order\nC:\\Users\\ethan\\signal-studio-workspace\\worktrees\\app\\design-weddings-exploration\\docs\\design\\labs\\weddings-2026-09\\shots\\a-day-who--1440x960.png    day-who\nC:\\Users\\ethan\\signal-studio-workspace\\worktrees\\app\\design-weddings-exploration\\docs\\design\\labs\\weddings-2026-09\\shots\\a-day-contacts--1440x960.png    day-contacts\nC:\\Users\\ethan\\signal-studio-workspace\\worktrees\\app\\design-weddings-exploration\\docs\\design\\labs\\weddings-2026-09\\shots\\a-guests-list--1280x900.png    guests-list at 1280x900\nSource: C:\\Users\\ethan\\signal-studio-workspace\\worktrees\\app\\design-weddings-exploration\\docs\\design\\labs\\weddings-2026-09\\master.html\n\nGRADE BY DRIVING, NOT ONLY BY READING FRAMES. Open the master in Playwright\n(chromium; import { chromium } from \"@playwright/test\") at\nfile://C:\\Users\\ethan\\signal-studio-workspace\\worktrees\\app\\design-weddings-exploration\\docs\\design\\labs\\weddings-2026-09\\master.html?v=a&state=<state> and operate it:\ntab through everything, press what looks pressable, exercise the keyboard\nmodel end to end, resize across 1280/1440, and watch what every\nrepaint does to scroll position and focus.\nOpen `master.html?v=a&state=<state>`. The rail: `1`–`8` jump between the eight\ndestinations (Home, Notes, Tasks, Timeline, Guests, Money, Seating, The Day).\nWithin a wedding destination the mode row in the sheet head switches modes;\neach button carries `aria-current`. Escape leaves the picker or the date\nquestion. `Print place cards` is disabled while anyone is unseated or a check\nis unrun. The `+` opens the picker; \"Replay setup\" in the rail foot re-runs the\nseed — both are frame, not findings. Everything else on screen is static\ncontent in this round; a control that does nothing is a legitimate finding.\n\nSay plainly what this is: name the score, name what earned it, and name what\nstill stands between it and 9.5 in terms a founder can act on — is what\nremains polish, a build, or a different decision, and roughly how big. Do not\ninflate to be kind and do not deflate to look rigorous."
const REFUTE_OPEN = "Adversarially verify one design-review finding against the artifact. Default to REFUTED when uncertain."
const REFUTE_RULES = "Refute if: it is factually wrong about the frames or the code; it is already handled; it would violate a non-negotiable constraint; it is taste stated as a defect with no argument; the fix would make the work worse; or it restates something the gates already prove. Confirm only if real, specific, and an improvement at a 9.5 bar. Echo the finding id back exactly so the verdict can be matched to its finding."

const SCHEMA = {
  "type": "object",
  "additionalProperties": false,
  "required": [
    "seat",
    "score",
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
    "findings": {
      "type": "array",
      "minItems": 3,
      "maxItems": 5,
      "items": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "id",
          "element",
          "problem",
          "fix",
          "cost"
        ],
        "properties": {
          "id": {
            "type": "string",
            "description": "a short kebab-case slug naming this defect"
          },
          "element": {
            "type": "string"
          },
          "problem": {
            "type": "string"
          },
          "fix": {
            "type": "string",
            "description": "implementable exactly as written"
          },
          "cost": {
            "type": "number"
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
    "lens": "Two people planning their own wedding, tired, on a laptop, who have never used has to run their work from this. Comprehension without training. Is the most important thing on screen the most prominent thing. Duplicated, missing, or twice-named information. Dense and empty states."
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
    `You are the ${seat.name} seat on an independent design review panel. Round 1.\n\n` +
    `YOUR LENS\n${seat.lens}\n\n${BAR}\n\n` +
    `Return your score to one decimal, your 3 to 5 most costly defects, and the single change that would raise the score most. ` +
    `Give every finding a short kebab-case id. Do not hedge, do not give credit for effort, and do not guess at any other seat's opinion.`,
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
        { label: `verify:${finding.id}`, phase: 'Verify', schema: {"type":"object","additionalProperties":false,"required":["id","real","reason"],"properties":{"id":{"type":"string"},"real":{"type":"boolean"},"reason":{"type":"string"},"sharpenedFix":{"type":"string"}}} }
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
  const row = { ...finding, verdict: verdict.reason, sharpenedFix: verdict.sharpenedFix || null }
  if (verdict.real) confirmed.push(row)
  else refuted.push(row)
}

log(`round 1: ${alive.length} seats, ${checked.length} verdicts, ${confirmed.length} confirmed, ${refuted.length} refuted`)

return {
  round: 1,
  scores: alive.map((r) => ({ seat: r.seat, score: r.score, biggestWin: r.biggestWin })),
  confirmed,
  refuted: refuted.map((r) => ({ seat: r.seat, id: r.id, problem: r.problem, why: r.verdict })),
}
