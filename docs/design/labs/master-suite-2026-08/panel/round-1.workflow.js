export const meta = {
  name: 'master-suite-panel-round-1',
  description: '7 fresh independent seats grade the master-suite master against a 9.5 bar',
  phases: [
    { title: 'Review' },
    { title: 'Verify' },
  ],
}

const BAR = "Score against this standard: the work of an award-winning design studio that\niterated on this product for months. 10 is that studio's best shipped work.\nBenchmarks to hold it against, by name: Linear, Stripe, Vercel, xAI/Grok,\nSpaceX. Score the ARTIFACT, not the effort. A polite 8 that should be a 6\nmakes the panel worthless.\n\nWHAT YOU ARE REVIEWING\nSignal Studio, as it would look in production: **Notes, Tasks and Timeline as one\nrunning application** — one ink floor, one white sheet, one floating capsule spine\nbetween them, and one world of data underneath all three. It is not a document about\nthree products; it is the three products, live, with the walls taken out. A person\ncaptures a note, peels the words that matter off it, sends them to Tasks, watches the\ncard land in the lane the seam chose, and looks at the Timeline to see how far off the\nday is. The single job the whole surface does is: **make a season of work legible to\none person who has to run it.**\n\nThe three products arrive here having each survived twelve to nineteen rounds of\nadversarial review as standalone surfaces. What has never been reviewed is them being\none thing.\nThe audience: Orla, the venue manager at The Orchard — she runs weddings and events for a living, has.\n\nCONSTRAINTS THAT ARE NOT NEGOTIABLE (do not propose breaking these):\n- Palette is exactly 4 colours: Ink #111111, Indigo #4f46e5, White #ffffff, Indigo deep #4338ca, plus tints of those at\n  stated alpha. NO other hue may be introduced. Status and hierarchy are\n  expressed by ink density, weight and fill, not by colour.\n- Type is Geist and Geist Mono at weights 400 and 600 only.\n- The locked architecture:\n  - **The Studio Floor architecture.** An ink floor the whole app sits on — not a frame\n    drawn around it. One white sheet lifted off it. The spine off the wall: a floating\n    capsule carrying the suite, pointing at the sheet it opened. The dock at the foot.\n    Identity on the sheet's own head. On a phone the capsule and the dock are the same\n    object.\n  - **Tasks · Direction C, Studio Floor**, at the founder's locked configuration:\n    elevated cards, soft radius, comfortable density, subtle indigo, calm type.\n  - **Notes · Direction C, The Stack**: two planes with depth between them, a desk above\n    carrying the newest paper, an index below, reading lifts a note onto the desk,\n    dictating takes the floor to ink, the seam peels a second smaller sheet off the note.\n  - **Timeline · Direction B, The Approach**: the organising object is a distance, not a\n    list; the day is a horizon that never moves; the past is behind you; position on the\n    measure is `daysFromToday × pixels-per-day` computed from real dates.\n  - **The suite is one application.** One rail, rendered once. Three products mounted at\n    once, none ever torn down, so nothing a person was doing is lost when they glance at\n    another.\n- Protected objects (polish, never redesign):\n  - **The seam.** Notes → peel → send → a card on the Tasks board in the lane the seam\n    chose → `open-task` reveals it → undo removes it from both. This is the whole\n    argument for a suite existing. Polish it; do not redesign the gesture.\n  - **Honest doors.** Home, Inbox, Help, More and the account tile are present,\n    reachable, in the tab order, and say plainly that they are not here yet. That is a\n    designed answer, not a gap. **A finding that says \"build a Home screen\" is out of\n    scope.** A finding that says the sentence on one of those doors is wrong is in.\n  - **One clock, one cast, one venue.** The fixture asserts it. Do not propose data.\nFindings that amount to \"add a colour\", \"add a weight\" or \"restructure the\nlocked architecture\" are out of scope and will be discarded.\nAlso out of scope for this engagement:\n- Building Home, Inbox, Help, More, or an account surface.\n- A fourth colour, a third weight, a fourth typeface.\n- Data-model changes: a moment has no time of day, a task has no created-at, and\n  neither is this engagement's problem.\n- The port into `src/`. This is a lab artefact; `references/handover.md` governs the\n  port and it is not this engagement's job.\n- Re-litigating the three direction picks. Direction C, C and B are the founder's.\n\nMEASURED BASELINE. Two automated gates guard this master and both pass:\n- C:\\Users\\ethan\\.claude\\skills\\elevate\\scripts\\audit.mjs --lab=C:\\Users\\ethan\\signal-studio-workspace\\_wt-master-suite\\docs\\design\\labs\\master-suite-2026-08\n  (palette lock, weights, families, WCAG AA contrast against the real\n  composited backdrop, hit targets, radii, motion, type ramp, leading)\n- C:\\Users\\ethan\\signal-studio-workspace\\_wt-master-suite\\docs\\design\\labs\\master-suite-2026-08\\interaction-check.mjs\nREAD the behaviour gate. Everything it asserts is already proven; a finding\nthat restates one of those assertions is worthless and will be refuted on\nsight. Spend your findings on what automation cannot see.\n\nBefore scoring, also read the paid-for defect library at\nC:\\Users\\ethan\\.claude\\skills\\elevate\\references\\lessons.md — those classes have\nbeen found and fixed once already; check whether they are creeping back,\nand spend the rest of your attention past them.\n\nFRAMES (read the images):\nC:\\Users\\ethan\\signal-studio-workspace\\_wt-master-suite\\docs\\design\\labs\\master-suite-2026-08\\shots\\paper-tasks.board--1920x1000.png    tasks.board\nC:\\Users\\ethan\\signal-studio-workspace\\_wt-master-suite\\docs\\design\\labs\\master-suite-2026-08\\shots\\paper-tasks.dense--1920x1000.png    tasks.dense\nC:\\Users\\ethan\\signal-studio-workspace\\_wt-master-suite\\docs\\design\\labs\\master-suite-2026-08\\shots\\paper-notes.notebook--1920x1000.png    notes.notebook\nC:\\Users\\ethan\\signal-studio-workspace\\_wt-master-suite\\docs\\design\\labs\\master-suite-2026-08\\shots\\paper-notes.seam--1920x1000.png    notes.seam\nC:\\Users\\ethan\\signal-studio-workspace\\_wt-master-suite\\docs\\design\\labs\\master-suite-2026-08\\shots\\paper-notes.voice--1920x1000.png    notes.voice\nC:\\Users\\ethan\\signal-studio-workspace\\_wt-master-suite\\docs\\design\\labs\\master-suite-2026-08\\shots\\paper-timeline.owner-flight--1920x1000.png    timeline.owner-flight\nC:\\Users\\ethan\\signal-studio-workspace\\_wt-master-suite\\docs\\design\\labs\\master-suite-2026-08\\shots\\paper-timeline.desk--1920x1000.png    timeline.desk\nC:\\Users\\ethan\\signal-studio-workspace\\_wt-master-suite\\docs\\design\\labs\\master-suite-2026-08\\shots\\paper-timeline.phone--1920x1000.png    timeline.phone\nC:\\Users\\ethan\\signal-studio-workspace\\_wt-master-suite\\docs\\design\\labs\\master-suite-2026-08\\shots\\paper-tasks.board--390x844.png    tasks.board at 390x844\nC:\\Users\\ethan\\signal-studio-workspace\\_wt-master-suite\\docs\\design\\labs\\master-suite-2026-08\\shots\\paper-tasks.board--768x1024.png    tasks.board at 768x1024\nC:\\Users\\ethan\\signal-studio-workspace\\_wt-master-suite\\docs\\design\\labs\\master-suite-2026-08\\shots\\paper-tasks.board--1280x900.png    tasks.board at 1280x900\nC:\\Users\\ethan\\signal-studio-workspace\\_wt-master-suite\\docs\\design\\labs\\master-suite-2026-08\\shots\\paper-tasks.board--1440x960.png    tasks.board at 1440x960\nSource: C:\\Users\\ethan\\signal-studio-workspace\\_wt-master-suite\\docs\\design\\labs\\master-suite-2026-08\\_gate-suite.html\n\nGRADE BY DRIVING, NOT ONLY BY READING FRAMES. Open the master in Playwright\n(chromium; import { chromium } from \"@playwright/test\") at\nfile://C:\\Users\\ethan\\signal-studio-workspace\\_wt-master-suite\\docs\\design\\labs\\master-suite-2026-08\\_gate-suite.html?v=paper&state=<state> and operate it:\ntab through everything, press what looks pressable, exercise the keyboard\nmodel end to end, resize across 390/768/1280/1440/1920, and watch what every\nrepaint does to scroll position and focus.\nEverything is driven against the wrapped copy, which is what `verify.mjs` and\n`tools/wrap.mjs` produce:\n\n```\ndocs/design/labs/master-suite-2026-08/_gate-suite.html?state=<product>.<state>\n                                                      &v=paper|ink\n                                                      &layout=across|down\n```\n\n- **The spine**: `.rail [data-rail=\"notes|tasks|timeline\"]` — click or Enter. Arrows\n  walk it (down/up at desk, left/right at ≤720). It never rebuilds a product.\n- **Tasks**: cards are draggable and keyboard-carryable (Space picks up, arrows walk,\n  Enter drops). The tick completes. `Ctrl/⌘Z` undoes. Press a card body to open its\n  note. The chips in the head filter.\n- **Notes**: type in `.topField`. Click an index row to lift it onto the desk. Select\n  words in `.readBody`, then `[data-act=\"peel\"]`, then `[data-act=\"send\"]`. `Ctrl/⌘K`\n  searches. The suite tiles live in the dock at ≤720.\n- **Timeline**: `[data-layout-to=\"across\"|\"down\"]` on the measure's head switches\n  orientation. `.b-grab` opens a moment's editor; the steppers move it on the measure.\n  `Ctrl/⌘Z` undoes.\n- **Grade by driving.** Frames hide exactly the defects that cost most — a live region\n  that never announces, a repaint that loses your place, a keyboard model advertised\n  and not implemented.\n\nROUND NOTES\n# Round 1 · what is new, and what you are being asked\n\nThis is the first panel this artefact has ever had. The three products inside it\nhave each been reviewed to death as standalone surfaces — twelve, fourteen and\nnineteen rounds. **Them being one thing has never been reviewed at all.**\n\n## New since anything was last looked at\n\n1. **Timeline has two orientations.** `across` draws the whole approach on one\n   horizontal measure — today at your feet, the wedding day at the far end, every\n   moment at its true share of the distance. `down` is the column the lab shipped.\n   A desk opens on `across`, a phone on `down`, and a control on the measure's own\n   head switches it. **`across` is entirely new surface and has never been seen by\n   anybody.** Treat it as the largest risk in this round. Drive it: press the\n   control, resize, check both directions.\n2. **The horizontal space is used differently on all three.** At 1920 the suite was\n   painting 45% of the Notes sheet, 40% of the Timeline sheet and 21% of the Tasks\n   sheet white for no reason. Notes' content column went 1060 → 1440, Timeline's\n   stage cap came off for `across`, and the Tasks tray ceiling went 312 → 372 with\n   the sheet cap derived from it. Whether that is *right* or merely *wider* is\n   yours to say — and a finding that says a measure has been lost is a good finding.\n\n## Deliberate decisions you might mistake for oversights\n\nArgue with any of these if you disagree — but report them as arguments, not as\nthings nobody noticed.\n\n- **The rail mark's dot is ink, not indigo**, and Notes' own master painted it\n  indigo. The Tasks lock states the rule at class level: the accent is spent only\n  on what the specimen sheet says it means. One spine, so one rule.\n- **The wordmark full stop is ink in Tasks and indigo in Notes.** That mark is on\n  each sheet's own head and each lock defends its own.\n- **Home, Inbox, Help, More and the account tile do nothing** and say so. That is a\n  designed answer. Building them is out of scope; the *words* on them are not.\n- **Notes' ledger reads \"Done\" three times** where it used to read three different\n  lanes. The board is the authority on a lane and the two fixtures disagreed.\n- **The Timeline lab caption is gone** — `OWNER · MARA & FINN IN FULL FLIGHT` was\n  lab furniture printing across a production application.\n\n## What the gates already prove — do not spend findings restating these\n\nAll green before this panel was convened. `node gate.mjs`, `node verify.mjs`.\n\n- **Each product against its own ratified ladders**: Tasks' audit, Notes' audit and\n  Timeline's elevate audit, all repointed at this file, all zero.\n- **Cross-product, five viewports × eight states**: palette 0, weights 0, families\n  0, targets 0, radii 0, motion 0, type ramp 0, leading 0, leading-role 0,\n  leading-ladder 0, tracking-ladder 0.\n- **Behaviour**: the seam end to end, the spine both directions by mouse and\n  keyboard, state surviving a product switch, both Timeline grounds, print forcing\n  paper, reduced motion honoured completely, zero console errors on every surface\n  at every width. Plus 44 assertions on the orientation work specifically.\n- **Fidelity**: every product's sheet is still pixel-identical to its own frozen\n  lab master at four widths, apart from the changes named above.\n\n## What the gates CANNOT see — these are yours, and they are named\n\nGate blindness is a finding, and these are declared rather than hidden.\n\n1. **Letterfit is not mechanically gated.** The shared check groups across the whole\n   document, and this document holds three products (two hidden at any moment but\n   still in the DOM). A per-product re-run was written and can see one product at a\n   time but cannot see *role* — Notes tracks by size and applies by role, so it\n   reports three declared tokens doing three different jobs at 15px as drift. It\n   prints 16 such groups and gates on nothing. **The three products carry three\n   separately ratified tracking curves: Tasks −0.010em at 13px, Notes −0.012em,\n   Timeline −0.015em.** Side by side in one application, is that a system or three?\n2. **A contrast residue is OPEN.** The shared model, a render-based proof and the\n   eye disagree about a handful of keycaps in the dictation state — specifically\n   how to measure a 1px inset ring on an ink ground. Four earlier iterations of\n   that proof found four real defects, including a blocking one. This residue is\n   unresolved and named.\n3. **Two frames are not byte-reproducible between runs**: the dictation state at\n   768 and 1440. It has a live waveform and a running clock. Nothing else moves.\n\n## Drive it\n\n```\n_gate-suite.html?state=<product>.<state>&v=paper|ink&layout=across|down\n```\n\nStates: `tasks.board` `tasks.dense` `notes.notebook` `notes.seam` `notes.voice`\n`timeline.owner-flight` `timeline.desk` `timeline.phone`\n\nThe spine is `.rail [data-rail=\"notes|tasks|timeline\"]`. The orientation control is\n`[data-layout-to=\"across\"|\"down\"]`. In Notes, select words in `.readBody` then\n`[data-act=\"peel\"]` then `[data-act=\"send\"]` — that is the seam, and it is the whole\nargument for the suite existing.\n\n**Frames alone will not find what matters here.** The two things most likely to be\nwrong are a new composition nobody has looked at and three ratified systems standing\nnext to each other for the first time, and neither shows up in a screenshot.\n\nSay plainly what this is: name the score, name what earned it, and name what\nstill stands between it and finished in terms a founder can act on — is what\nremains polish, a build, or a different decision, and roughly how big. Do not\ninflate to be kind and do not deflate to look rigorous.\n\nHOW THIS ENGAGEMENT ENDS, so you know what your answer is for. It ends when\ntwo consecutive rounds confirm no finding classed blocking or misleading,\nboth gates green, on a frozen surface. It does NOT end on a score, and your\nscore gates nothing — it is recorded and reported. That is deliberate:\nacross 45 recorded rounds, seven blind seats scoring one artifact disagree\nwith a standard deviation of 0.335, so a unanimous 9.5 would need true\nquality of 9.94 to pass half the time and 10.23 to pass reliably, which is\noff the scale. Score honestly and put your real weight into the severity\nclasses, because those are what actually decide when this stops."
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
    `You are the ${seat.name} seat on an independent design review panel. Round 1.\n\n` +
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
log(`round 1: ${alive.length} seats, ${confirmed.length} confirmed, ${refuted.length} refuted (${Math.round(refuteRate * 100)}%)`)
log(`  blocking ${count('blocking')} · misleading ${count('misleading')} · defect ${count('defect')} · refinement ${count('refinement')}`)
if (refuteRate > 0.40) log(`  WARNING refutation ${Math.round(refuteRate * 100)}% — seats are padding; check the brief says an empty list is expected`)
if (count('blocking') === 0 && count('misleading') === 0) log(`  the ledger is CLEAN this round — see references/stopping.md`)

return {
  round: 1,
  seatsSat: alive.map((r) => r.seat),
  scores: alive.map((r) => ({ seat: r.seat, score: r.score, signOff: r.signOff, biggestWin: r.biggestWin })),
  signOffs: alive.filter((r) => r.signOff).map((r) => r.seat),
  severity: { blocking: count('blocking'), misleading: count('misleading'), defect: count('defect'), refinement: count('refinement') },
  refuteRate: Number(refuteRate.toFixed(3)),
  confirmed,
  refuted: refuted.map((r) => ({ seat: r.seat, id: r.id, problem: r.problem, why: r.verdict })),
}
