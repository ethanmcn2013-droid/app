export const meta = {
  name: 'timeline-redesign-panel-round-4',
  description: 'Seven fresh independent seats grade the timeline-redesign master against a 9.5 bar',
  phases: [
    { title: 'Review' },
    { title: 'Verify' },
  ],
}

const BAR = "Score against this standard: the work of an award-winning design studio that\niterated on this product for months. 10 is that studio's best shipped work.\nBenchmarks to hold it against, by name: Linear, Stripe, Vercel, xAI/Grok,\nSpaceX. Score the ARTIFACT, not the effort. A polite 8 that should be a 6\nmakes the panel worthless.\n\nWHAT YOU ARE REVIEWING\nSignal Timeline is how one person hands another the plan for a day that\nmatters. An owner builds the plan; an audience — a couple, their families, a\nvenue — receives it as something finished. The flagship case is a wedding: the\nowner is a planner or the couple themselves, and the people receiving it will\nopen it once, on a phone, probably while doing something else, and will judge\nthe whole company by that one screen. Everything from the owner's first empty\nproject to the printed keepsake on the morning itself is in scope. Timeline\ngoes first in a suite-wide redesign because it is the surface with the most\nfeeling in it; whatever wins here becomes the language Home, Notes and Tasks\nadopt next.\nThe audience: Someone organising the most important day of their life, who has never used a.\n\nCONSTRAINTS THAT ARE NOT NEGOTIABLE (do not propose breaking these):\n- Palette is exactly 3 colours: Ink #111111, Indigo #4f46e5, White #ffffff, plus tints of those at\n  stated alpha. NO other hue may be introduced. Status and hierarchy are\n  expressed by ink density, weight and fill, not by colour.\n- Type is Geist and Geist Mono at weights 400 and 600 only.\n- The locked architecture:\n  Nothing. This is greenfield.\n- Protected objects (polish, never redesign):\n  Nothing. Nothing is protected.\nFindings that amount to \"add a colour\", \"add a weight\" or \"restructure the\nlocked architecture\" are out of scope and will be discarded.\nAlso out of scope for this engagement:\nAuth, billing, the data model, performance work, marketing pages, and anything\nin Tasks or Notes beyond noting what the suite will inherit.\n\nMEASURED BASELINE. Two automated gates guard this master and both pass:\n- C:\\Users\\ethan\\signal-studio-workspace\\_wt-timeline-redesign\\.claude\\skills\\elevate\\scripts\\audit.mjs --lab=C:\\Users\\ethan\\signal-studio-workspace\\_wt-timeline-redesign\\docs\\design\\labs\\timeline-redesign-2026-08\n  (palette lock, weights, families, WCAG AA contrast against the real\n  composited backdrop, hit targets, radii, motion, type ramp, leading)\n- C:\\Users\\ethan\\signal-studio-workspace\\_wt-timeline-redesign\\docs\\design\\labs\\timeline-redesign-2026-08\\interaction-check.mjs\nREAD the behaviour gate. Everything it asserts is already proven; a finding\nthat restates one of those assertions is worthless and will be refuted on\nsight. Spend your findings on what automation cannot see.\n\nBefore scoring, also read the paid-for defect library at\nC:\\Users\\ethan\\signal-studio-workspace\\_wt-timeline-redesign\\.claude\\skills\\elevate\\references\\lessons.md — those classes have\nbeen found and fixed once already; check whether they are creeping back,\nand spend the rest of your attention past them.\n\nFRAMES (read the images):\nC:\\Users\\ethan\\signal-studio-workspace\\_wt-timeline-redesign\\docs\\design\\labs\\timeline-redesign-2026-08\\shots\\approach-owner-flight--1440x960.png    owner-flight\nC:\\Users\\ethan\\signal-studio-workspace\\_wt-timeline-redesign\\docs\\design\\labs\\timeline-redesign-2026-08\\shots\\approach-owner-empty--1440x960.png    owner-empty\nC:\\Users\\ethan\\signal-studio-workspace\\_wt-timeline-redesign\\docs\\design\\labs\\timeline-redesign-2026-08\\shots\\approach-owner-editing--1440x960.png    owner-editing\nC:\\Users\\ethan\\signal-studio-workspace\\_wt-timeline-redesign\\docs\\design\\labs\\timeline-redesign-2026-08\\shots\\approach-publish--1440x960.png    publish\nC:\\Users\\ethan\\signal-studio-workspace\\_wt-timeline-redesign\\docs\\design\\labs\\timeline-redesign-2026-08\\shots\\approach-phone--1440x960.png    phone\nC:\\Users\\ethan\\signal-studio-workspace\\_wt-timeline-redesign\\docs\\design\\labs\\timeline-redesign-2026-08\\shots\\approach-desk--1440x960.png    desk\nC:\\Users\\ethan\\signal-studio-workspace\\_wt-timeline-redesign\\docs\\design\\labs\\timeline-redesign-2026-08\\shots\\approach-day--1440x960.png    day\nC:\\Users\\ethan\\signal-studio-workspace\\_wt-timeline-redesign\\docs\\design\\labs\\timeline-redesign-2026-08\\shots\\approach-print--1440x960.png    print\nC:\\Users\\ethan\\signal-studio-workspace\\_wt-timeline-redesign\\docs\\design\\labs\\timeline-redesign-2026-08\\shots\\approach-unfurl--1440x960.png    unfurl\nC:\\Users\\ethan\\signal-studio-workspace\\_wt-timeline-redesign\\docs\\design\\labs\\timeline-redesign-2026-08\\shots\\approach-ended--1440x960.png    ended\nC:\\Users\\ethan\\signal-studio-workspace\\_wt-timeline-redesign\\docs\\design\\labs\\timeline-redesign-2026-08\\shots\\approach-loading--1440x960.png    loading\nC:\\Users\\ethan\\signal-studio-workspace\\_wt-timeline-redesign\\docs\\design\\labs\\timeline-redesign-2026-08\\shots\\approach-owner-flight--390x844.png    owner-flight at 390x844\nC:\\Users\\ethan\\signal-studio-workspace\\_wt-timeline-redesign\\docs\\design\\labs\\timeline-redesign-2026-08\\shots\\approach-owner-flight--768x1024.png    owner-flight at 768x1024\nC:\\Users\\ethan\\signal-studio-workspace\\_wt-timeline-redesign\\docs\\design\\labs\\timeline-redesign-2026-08\\shots\\approach-owner-flight--1280x900.png    owner-flight at 1280x900\nSource: C:\\Users\\ethan\\signal-studio-workspace\\_wt-timeline-redesign\\docs\\design\\labs\\timeline-redesign-2026-08\\master.html\n\nGRADE BY DRIVING, NOT ONLY BY READING FRAMES. Open the master in Playwright\n(chromium; import { chromium } from \"@playwright/test\") at\nfile://C:\\Users\\ethan\\signal-studio-workspace\\_wt-timeline-redesign\\docs\\design\\labs\\timeline-redesign-2026-08\\master.html?v=approach&state=<state> and operate it:\ntab through everything, press what looks pressable, exercise the keyboard\nmodel end to end, resize across 390/768/1280/1440, and watch what every\nrepaint does to scroll position and focus.\n\nSay plainly what this is: name the score, name what earned it, and name what\nstill stands between it and 9.5 in terms a founder can act on — is what\nremains polish, a build, or a different decision, and roughly how big. Do not\ninflate to be kind and do not deflate to look rigorous."
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
    "lens": "Someone organising the most important day of their life, who has never used a has to run their work from this. Comprehension without training. Is the most important thing on screen the most prominent thing. Duplicated, missing, or twice-named information. Dense and empty states."
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
    `You are the ${seat.name} seat on an independent design review panel. Round 4.\n\n` +
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

log(`round 4: ${alive.length} seats, ${checked.length} verdicts, ${confirmed.length} confirmed, ${refuted.length} refuted`)

return {
  round: 4,
  scores: alive.map((r) => ({ seat: r.seat, score: r.score, biggestWin: r.biggestWin })),
  confirmed,
  refuted: refuted.map((r) => ({ seat: r.seat, id: r.id, problem: r.problem, why: r.verdict })),
}
