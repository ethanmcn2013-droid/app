export const meta = {
  name: 'tasks-panel-round-10',
  description: 'Seven fresh independent seats re-grade the Tasks master against a 9.5 bar',
  phases: [
    { title: 'Review' },
    { title: 'Verify' },
  ],
}

const SHOTS = 'C:/Users/ethan/signal-studio-workspace/_wt-design-tasks/docs/design/labs/tasks-2026-08/shots'
const SRC = 'C:/Users/ethan/signal-studio-workspace/_wt-design-tasks/docs/design/labs/tasks-2026-08/floor.html'

const BAR = `
Score against this standard: the work of an award-winning design studio that
iterated on this product for months. 10 is that studio's best shipped work.
Benchmarks to hold it against, by name: Linear, Stripe, Vercel, xAI/Grok,
SpaceX. Score the ARTIFACT, not the effort. A polite 8 that should be a 6
makes the panel worthless.

WHAT YOU ARE REVIEWING
A task board for wedding-venue operators (not software teams). Direction and
architecture are LOCKED and must not be redesigned: an ink floor, one white
sheet lifted off it, a floating capsule spine on the left, statuses as ruled
tray columns, a floating dock at the foot of the sheet carrying search, add
and account.

CONSTRAINTS THAT ARE NOT NEGOTIABLE (do not propose breaking these):
- Palette is exactly three colours: Ink #111111, Indigo #4f46e5, White
  #ffffff, plus tints of those three at stated alpha. NO other hue may be
  introduced. Status is expressed by ink density and fill, not by colour.
  Overdue = filled ink chip. Due today = outlined chip. Milestone = the one
  indigo. Done = filled ink tick.
- Type is Geist at weights 400 and 600 only.
- The architecture above.
Findings that amount to "add a colour", "add a weight" or "restructure the
layout" are out of scope and will be discarded. Everything else is in scope.

MEASURED BASELINE (verified by an automated audit, all passing): palette lock
0 violations, weights 0, families 0, WCAG AA contrast 0 failures across 5
states, hit targets 0, radii ladder 0, motion tokens 0. Do not spend findings
on those. Find what automation cannot see.

FRAMES (read the images):
${SHOTS}/locked-board--1440x960.png    the board, populated
${SHOTS}/locked-cards--1440x960.png    card specimen sheet, every card state
${SHOTS}/locked-dense--1440x960.png    32 tasks, peak season
${SHOTS}/locked-empty--1440x960.png    empty board
${SHOTS}/locked-loading--1440x960.png  loading
${SHOTS}/locked-planning--1440x960.png planning drawer open
${SHOTS}/locked-board--768x1024.png    tablet
${SHOTS}/locked-board--390x844.png     phone
Source: ${SRC}

THE BOARD IS NOW LIVE, NOT A PICTURE. As of this round the artifact
implements a real interaction layer, and you are expected to DRIVE it, not
only look at frames. Open the file in Playwright (chromium, already installed
in this repo; import { chromium } from "@playwright/test")
and operate it:
- Tab into the board. There is ONE tab stop for the whole board; the arrows
  walk it and it carries the card's own tick and menu.
- Space picks a card up, arrows place it, Space drops it, Escape returns it
  to exactly where it came from. A pill at the foot of the sheet appears only
  while a card is in the hand. #say is a polite live region.
- Drag a card with the pointer: page.dragAndDrop works.
- Click the completion circle; click the "1 overdue" chip, which filters.
- Resize and watch the two edge fades, which are measured after layout.
There is now a behaviour gate at
C:/Users/ethan/signal-studio-workspace/_wt-design-tasks/scripts/design/interaction-check.mjs
with 154 assertions, all passing. READ IT. Everything it asserts is already
proven, so a finding that restates one of those assertions is worthless.
Spend your findings on what it does not cover.

Also live, and worth driving before you score:
- Ticking a card makes it FLY to its new column as a fixed-position copy
  carrying the product's one heavy shadow, then play a check-draw beat.
- The foot strip reverses a completion, a menu move and a pointer drop, and
  states the filter. Cmd/Ctrl+Z. It waits while you are reading it.
- Clicking a card, or Enter, opens its full note in place.
- The card's "..." opens a Move menu. Holding a dragged card at the board's
  edge walks it across. Arrows keep the focused card inside its column.
- The chip carries the VALUE and the fill carries the CONDITION: filled
  means behind, outlined means today, indigo means the next milestone. The
  sentence lives in the accessible name, the tooltip and the specimen sheet.
  This is a deliberate reversal of round 5 on measured rag evidence; argue
  with it if you disagree, but do not report it as an oversight.

NEW SINCE THE LAST ROUND, all live and all worth driving:
- Planning is a real room: it takes focus, declares itself a dialog, closes
  on Escape / the X / a click away, its tabs switch the list, its checkboxes
  pick, Select all flips to Clear all, and its list comes from the live set.
- The couple's name on a card is a FILTER. Click "Nora & Cian" on any card.
- Done reads newest first and every finished card says when. Waiting says how
  long each thing has been held.
- The vertical column fades are hairlines, not gradients, and the column
  snaps so it rests on a card.
- Clearing the board says "Everything is done."

THE LAST THREE ROUNDS WENT 7.4 -> 8.3 -> 8.6 at the minimum, and the spread
is now 0.3. Every seat in each of those rounds volunteered that the remaining
distance was hours of building rather than a redesign.

GRADE HONESTLY AND WITHOUT MERCY. If a seat is at or above 9.5, say exactly
what earned it. If it is below, name the exact remaining distance: what, how
big, and whether it is polish, a build, or a different decision. Do not
inflate to be kind and do not deflate to look rigorous. An accurate number
with its reason is the only useful output.
`

const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['seat', 'score', 'findings', 'biggestWin'],
  properties: {
    seat: { type: 'string' },
    score: { type: 'number' },
    findings: {
      type: 'array', minItems: 3, maxItems: 5,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['id', 'element', 'problem', 'fix', 'cost'],
        properties: {
          id: { type: 'string', description: 'a short kebab-case slug naming this defect' },
          element: { type: 'string' },
          problem: { type: 'string' },
          fix: { type: 'string', description: 'implementable exactly as written' },
          cost: { type: 'number' },
        },
      },
    },
    biggestWin: { type: 'string' },
  },
}

const SEATS = [
  { key: 'ui', name: 'UI composition', lens: 'Composition, alignment, optical balance, grid, rhythm, density, the relationship between the spine, the sheet, the trays and the dock. Where the eye goes first and whether that is right. Lazy spacing, unequal optical margins, things that align mathematically but not optically.' },
  { key: 'type', name: 'Typography', lens: 'The type system: scale, weight pairing at 400/600 only, tracking curve, line-height, measure, mono micro-label discipline, numerals, orphans and widows, hierarchy carried by size versus weight versus tracking. Hold it to Vercel Geist and Linear standards.' },
  { key: 'interaction', name: 'Interaction and states', lens: 'Hover, focus, active, selected, drag, empty, loading, dense. Affordance at rest. Reflow on hover. Discoverability of reveal-on-hover controls. Keyboard model and focus order. What the loading frame promises versus what arrives.' },
  { key: 'ux', name: 'UX and information design', lens: 'A wedding-venue operator, not a software team, has to run their Saturday from this. Comprehension without training. Is the most important thing on screen the most prominent thing. Duplicated, missing, or twice-named information. Dense and empty states.' },
  { key: 'brand', name: 'Brand and copy', lens: 'Register: confident, premium, editorial, restrained, never cheap. Voice: plain English, declarative, no jargon, no em dashes, no exclamation marks, sentence case. Judge every visible string. Judge whether three colours are being spent well or merely obeyed.' },
  { key: 'taste', name: 'Product taste and emotional resonance', lens: 'Would a discerning stranger believe a top studio made this and pay for it. Does it move you: relief, calm, confidence, delight. Or does it merely function. Name the single memorable moment, and if there is none that is the finding. Equal weight to any craft seat.' },
  { key: 'evidence', name: 'Measured evidence', lens: 'You distrust opinion. Read the SOURCE closely. CSS that cannot do what it claims, dead rules, specificity collisions, values off the declared ladders, states declared but unreachable, responsive rules that will break, accessibility beyond contrast (semantics, roles, names, focus order, aria), and any place the code and its comment disagree. Cite selectors and line context.' },
]

phase('Review')
const reviews = await parallel(SEATS.map((seat) => () =>
  agent(
    `You are the ${seat.name} seat on an independent design review panel. Round 2.\n\n` +
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
        `Adversarially verify one design-review finding against the artifact. Default to REFUTED when uncertain.\n\n` +
        `FINDING id=${finding.id}\nSeat: ${review.seat}\nElement: ${finding.element}\nProblem: ${finding.problem}\nProposed fix: ${finding.fix}\n\n` +
        `${BAR}\n\n` +
        `Refute if: it is factually wrong about the frames or the code; it is already handled; it would violate a non-negotiable constraint; it is taste stated as a defect with no argument; or the fix would make the work worse. ` +
        `Confirm only if real, specific, and an improvement at a 9.5 bar. ` +
        `Echo the finding id back exactly so the verdict can be matched to its finding.`,
        { label: `verify:${finding.id}`, phase: 'Verify', schema: {
          type: 'object', additionalProperties: false,
          required: ['id', 'real', 'reason'],
          properties: {
            id: { type: 'string' },
            real: { type: 'boolean' },
            reason: { type: 'string' },
            sharpenedFix: { type: 'string' },
          },
        } }
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

log(`round 2: ${alive.length} seats, ${checked.length} verdicts, ${confirmed.length} confirmed, ${refuted.length} refuted`)

return {
  round: 2,
  scores: alive.map((r) => ({ seat: r.seat, score: r.score, biggestWin: r.biggestWin })),
  confirmed,
  refuted: refuted.map((r) => ({ seat: r.seat, id: r.id, problem: r.problem, why: r.verdict })),
}
