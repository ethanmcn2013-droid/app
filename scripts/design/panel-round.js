/* The elevation loop, rebuilt after fifteen rounds.
 *
 *   Workflow({ scriptPath: "scripts/design/panel-round.js",
 *              args: { round: 16, mode: "converge" } })
 *
 * WHAT THE FIRST FIFTEEN ROUNDS TAUGHT, and what each change here answers:
 *
 * 1. The loop was grading a moving target. Across rounds 12 to 15, 53%, 39%,
 *    54% and 68% of each round's confirmed defect cost came from surface built
 *    since the previous panel — rising, not falling. The floor was never set by
 *    fifteen rounds of work; it was set by the newest room every time.
 *    ANSWER: the surface is FROZEN. A finding that asks for new capability is
 *    recorded as `build`, deferred, and never remediated during elevation.
 *
 * 2. Fixes were applied to instances, not to rules. Round 11 fixed a
 *    box-shadow/custom-property collision on three preset rules; round 13 found
 *    it again on a fourth. Round 13 fixed press-is-a-click on the tick; round
 *    14 found it on the card body.
 *    ANSWER: every seat must state the CLASS-LEVEL RULE behind its finding, and
 *    every confirmed finding must leave a gate assertion that tests the rule.
 *
 * 3. Seats re-discovered what the gate already proves. 189 findings were
 *    refuted over fifteen rounds, many of them re-raising settled ground.
 *    ANSWER: every seat is handed the gate's proven claims by name.
 *
 * 4. Verification cost more than review. One adversarial refuter per finding is
 *    ~35 agents a round, and most were spent on findings too small to move any
 *    seat's score.
 *    ANSWER: findings at or above 1.0 get their own refuter; everything below
 *    is batched into one refuter per seat. Same rigour where it decides the
 *    score, a third of the agents.
 *
 * 5. There was no way to tell convergence from churn until the next round.
 *    ANSWER: every seat reports `headroom` — the score it would give if its own
 *    findings were fixed exactly as written. That is a prediction the next
 *    round checks, so the loop can be stopped when it stops paying.
 *
 * MODES
 *   converge  five seats — the four that have set the floor most often, plus
 *             one rotating so nothing goes unwatched. The working round.
 *   gate      all seven. Run only when a converge round leaves no seat under
 *             9.3, because the bar is unanimous and cannot be certified by a
 *             subset.
 */

export const meta = {
  name: 'tasks-panel-round',
  description: 'Blind seats grade the frozen Tasks master against a 9.5 bar',
  phases: [
    { title: 'Review' },
    { title: 'Verify' },
  ],
}

const ROUND = (typeof args !== 'undefined' && args && args.round) || 16
const MODE = (typeof args !== 'undefined' && args && args.mode) || 'converge'

const LAB = 'C:/Users/ethan/signal-studio-workspace/_wt-design-tasks/docs/design/labs/tasks-2026-08'
const SHOTS = LAB + '/shots'
const SRC = LAB + '/floor.html'
const GATE = 'C:/Users/ethan/signal-studio-workspace/_wt-design-tasks/scripts/design/interaction-check.mjs'

/* The gate's own claims, by name. Handed to every seat so the round is not
   spent re-finding what is already proven and guarded. */
const PROVEN = `
ALREADY PROVEN AND GUARDED — 342 assertions in the behaviour gate, every one
checked on every run and passing. A finding that restates one of these is worth
nothing, and a finding that contradicts one is almost certainly wrong about the
artifact. Read this before you spend a finding:

a tick completes the task; the completion is announced; focus survives a pointer
completion; an undo strip appears; undo puts the task back; ctrl+z undoes a
completion; space picks a card up; arrows walk it two columns; escape puts it
back exactly; space on the tick ticks; tab reaches the menu button; escape
closes the menu; the menu lists every column; a tick elsewhere keeps a column's
place; the phone board keeps its column; the drop line does not lie; no control
leaves the sheet at any width from 1440 to 780 in either drawer state; the venue
name is never truncated; no fact is spent to make the room; an unanswering
column collapses to its head; every column rule is drawn at one weight; a
stepped-back column head still clears AA; the rail is one tab stop at rest,
after the arrows, and after a repaint; both fold rules sit on the scroller's own
edges; the flight grows into the card it becomes and hands off with no snap; the
count settles on the frame the card lands; a card never in To do is not said to
be back in it; the day the work was finished survives a round trip; every kind
of time chip has its own silhouette; a waiting chip says what its number means;
the blank board draws no interior rules; pressing the one instruction retires
it; the tick answers a press that travelled 0, 4, 6 and 10px; the card body
answers a press up to 8px and treats 12px as a drag; no preset writes box-shadow
on a card; the keyboard focus ring survives the pointer resting on it; the
milestone card carries indigo in every preset; a finished card does not lift
under the pointer like a live one; no column scroller is a tab stop; all four
completion doors say the same sentence; a filtered board is never left matching
nothing; the two time chips are one question; the menu item that says "here"
dismisses; no part of the view row leaves the sheet; the finished card is fully
on screen at 1440 and 1280; Done speaks calendar dates; the loading frame does
not hide what it prints; no keycap on a control that cannot answer; every row
can be given a day; giving a day is reversible and does not close the room;
a picked row is visibly picked in filled ink; the board stays live behind the
drawer; a half-written task is committed, not stranded; no sentence says a lane
name twice; giving a task today puts it in the today count and on the card;
this weekend lands on the Saturday, not after it; every row's day menu is fully
on screen; an emptied room says one thing, not two that disagree; the hand ends
when attention moves and the completion gets the strip; the edge fade starts at
the board's own top at 1280, 768 and with the drawer open; a press on a card
with no note is answered, not silent; the active view tab announces selected.
`

const BAR = `
Score against this standard: the work of an award-winning design studio that
iterated on this product for months. 10 is that studio's best shipped work.
Benchmarks to hold it against, by name: Linear, Stripe, Vercel, xAI/Grok,
SpaceX. Score the ARTIFACT, not the effort. A polite 8 that should be a 6
makes the panel worthless.

WHAT YOU ARE REVIEWING
A task board for wedding-venue operators (not software teams). Direction,
architecture AND the visual configuration are LOCKED by the founder and must
not be redesigned: an ink floor, one white sheet lifted off it, a floating
capsule spine on the left, statuses as ruled tray columns, a floating dock at
the foot of the sheet carrying search, add and account.

THE LOCKED CONFIGURATION, chosen by the founder and final:
  card style     Elevated      an open card rests on a shadow; a Done card is flat
  corner radius  Soft
  density        Comfortable
  indigo         Subtle accents
  type scale     Calm
An open card floats and a finished one has settled, so completing a task is a
set-down. That is a deliberate reading of the shadow law, not an oversight.
Arguing that a resting shadow is decoration is in scope. A finding that merely
states "cards carry a shadow" is not, and neither is any finding proposing a
different card style, radius, density, indigo level or type scale. The founder
has seen this configuration and chosen it. It is not under review.

CONSTRAINTS THAT ARE NOT NEGOTIABLE (do not propose breaking these):
- Palette is exactly three colours: Ink #111111, Indigo #4f46e5, White #ffffff,
  plus tints of those three at stated alpha. NO other hue. Status is expressed
  by ink density and fill, not by colour. Overdue = filled ink chip. Due today =
  outlined chip. Milestone = the one indigo. Done = filled ink tick.
- Type is Geist at weights 400 and 600 only.
- The architecture and the configuration above.

ONE BUILD WAS MADE, CORRECTED, AND THE SURFACE IS FROZEN AGAIN.
The founder lifted the freeze for exactly one thing: the completion beat,
because for fifteen rounds this panel asked for a memorable moment and got
defect fixes. The previous panel graded a first attempt and five of its seven
seats found the same faults, which are now fixed. You are grading the corrected
version, and no seat has seen it.

What it is: work in motion is carried and slightly askew — the same -1.4deg a
pointer-dragged card already used — and finished work squares up and comes to
rest. The card is cloned BEFORE it is finished, so it flies as the open card it
was, opaque, carrying its own ground; it is held askew through the travel it
actually makes rather than on the clock; every tally on the board holds its
pre-tick value until the card lands, so the board answers with the card and not
400ms before it; and the column it left holds the hole open until then. The
real card then settles from the lift it arrived with onto its own flat hairline
while the check draws and the Done count arrives on the same frame.

DRIVE IT. Tick a card and watch, at 1440 and at 390. Judge it as a designed
moment rather than as a diff. If it does not move you, say so plainly and say
what would — that is the finding this round most needs. If it does, say that
too, and say what is still between it and the bar.

THE SURFACE IS FROZEN.
This is the decisive change from earlier rounds. No new capability is being
built during elevation. If your finding's answer is "build X" — a new control,
a new room, a new view, a feature that does not exist — mark it kind="build".
It will be recorded for after the gate and will NOT be remediated now, so do
not spend one of your findings on it unless it is genuinely the most costly
thing you found. Findings marked kind="defect" are things that are WRONG about
what already exists, and those are what this round is for.

MEASURED BASELINE (verified by an automated audit re-run against this exact
file, all passing): palette lock 0 violations, weights 0, families 0, WCAG AA
contrast 0 failures across 6 states, hit targets 0, radii ladder 0, motion
tokens 0. Do not spend findings on those. Find what automation cannot see.

${PROVEN}

FRAMES (read the images):
${SHOTS}/locked-board--1440x960.png    the board, populated
${SHOTS}/locked-cards--1440x960.png    card specimen sheet, every card state
${SHOTS}/locked-dense--1440x960.png    32 tasks, peak season
${SHOTS}/locked-empty--1440x960.png    empty board
${SHOTS}/locked-filtered--1440x960.png the board with the overdue filter on
${SHOTS}/locked-loading--1440x960.png  loading
${SHOTS}/locked-planning--1440x960.png planning drawer open
${SHOTS}/locked-board--768x1024.png    tablet
${SHOTS}/locked-board--390x844.png     phone
Source: ${SRC}
Behaviour gate (read it, do not restate it): ${GATE}

DRIVE IT, DO NOT ONLY LOOK AT IT. Open the file in Playwright (chromium, already
installed; import { chromium } from "@playwright/test"). Use real pointer travel
— page.mouse.move/down/move/up — never locator.click(), which teleports with
zero travel and hid a live defect from this panel for thirteen rounds. States
are reachable directly:
?state=board|cards|dense|empty|filtered|loading|planning

Write any scratch script into the system temp directory, never into the repo.

STATE THE RULE, NOT THE INSTANCE.
The most expensive failure of the first fifteen rounds was fixing instances. A
collision between a preset and a custom property was fixed on three rules and
came back on a fourth. A press-is-a-click guard was fixed on the tick and came
back on the card body. For every finding you must state the class-level RULE
that, if enforced, would prevent that defect AND every sibling of it, phrased so
it could be checked mechanically. "Set this to 16px" is not a rule. "No preset
selector may write box-shadow on a card, because it outranks the custom property
the whole state system rides on" is.

ALSO REPORT YOUR HEADROOM: the score you would give this artifact if every
finding you just listed were fixed exactly as you specified, and nothing else
changed. Be honest — if fixing your whole list would still leave it at 8.6, say
8.6. That number is a prediction the next round checks, and it is how the
founder decides whether this loop is still paying for itself.

Say plainly what this is: name the score, name what earned it, and name what
still stands between it and 9.5 in terms a founder can act on.
`

const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['seat', 'score', 'headroom', 'findings', 'biggestWin'],
  properties: {
    seat: { type: 'string' },
    score: { type: 'number' },
    headroom: {
      type: 'number',
      description: 'the score you would give if every finding below were fixed exactly as written',
    },
    findings: {
      type: 'array', minItems: 2, maxItems: 5,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['id', 'kind', 'element', 'problem', 'rule', 'fix', 'cost'],
        properties: {
          id: { type: 'string', description: 'a short kebab-case slug naming this defect' },
          kind: {
            type: 'string', enum: ['defect', 'build'],
            description: 'defect = something wrong with what exists. build = new capability, which is frozen.',
          },
          element: { type: 'string' },
          problem: { type: 'string' },
          rule: {
            type: 'string',
            description: 'the class-level rule that would prevent this and every sibling, phrased so it could be checked mechanically',
          },
          fix: { type: 'string', description: 'implementable exactly as written' },
          cost: { type: 'number' },
        },
      },
    },
    biggestWin: { type: 'string' },
  },
}

const ALL_SEATS = [
  { key: 'interaction', name: 'Interaction and states', core: true, lens: 'Hover, focus, active, selected, drag, empty, loading, dense. Affordance at rest. Reflow on hover. Discoverability of reveal-on-hover controls. Keyboard model and focus order. What the loading frame promises versus what arrives. Drive every gesture with real pointer travel.' },
  { key: 'ux', name: 'UX and information design', core: true, lens: 'A wedding-venue operator, not a software team, has to run their Saturday from this. Comprehension without training. Is the most important thing on screen the most prominent thing. Duplicated, missing, or twice-named information. Dense and empty states. Whether any number the board prints can disagree with any other.' },
  { key: 'taste', name: 'Product taste and emotional resonance', core: true, lens: 'Would a discerning stranger believe a top studio made this and pay for it. Does it move you: relief, calm, confidence, delight. Or does it merely function. Name the single memorable moment, and if there is none that is the finding. Equal weight to any craft seat.' },
  { key: 'evidence', name: 'Measured evidence', core: true, lens: 'You distrust opinion. Read the SOURCE closely. CSS that cannot do what it claims, dead rules, specificity collisions, values off the declared ladders, states declared but unreachable, responsive rules that will break, accessibility beyond contrast (semantics, roles, names, focus order, aria), and any place the code and its comment disagree. Cite selectors and line context.' },
  { key: 'ui', name: 'UI composition', core: false, lens: 'Composition, alignment, optical balance, grid, rhythm, density, the relationship between the spine, the sheet, the trays and the dock. Where the eye goes first and whether that is right. Lazy spacing, unequal optical margins, things that align mathematically but not optically.' },
  { key: 'type', name: 'Typography', core: false, lens: 'The type system: scale, weight pairing at 400/600 only, tracking curve, line-height, measure, mono micro-label discipline, numerals, orphans and widows, hierarchy carried by size versus weight versus tracking. Hold it to Vercel Geist and Linear standards.' },
  { key: 'brand', name: 'Brand and copy', core: false, lens: 'Register: confident, premium, editorial, restrained, never cheap. Voice: plain English, declarative, no jargon, no em dashes, no exclamation marks, sentence case. Judge every visible string, spoken and printed. Judge whether three colours are being spent well or merely obeyed.' },
]

const ROTATION = ALL_SEATS.filter((s) => !s.core)
const SEATS = MODE === 'gate'
  ? ALL_SEATS
  : ALL_SEATS.filter((s) => s.core).concat([ROTATION[ROUND % ROTATION.length]])

log(`round ${ROUND} · ${MODE} · ${SEATS.length} seats: ${SEATS.map((s) => s.key).join(', ')}`)

phase('Review')
const reviews = (await parallel(SEATS.map((seat) => () =>
  agent(
    `You are the ${seat.name} seat on an independent design review panel. Round ${ROUND}.\n\n` +
    `YOUR LENS\n${seat.lens}\n\n${BAR}\n\n` +
    `Return your score to one decimal, your headroom, your 2 to 5 most costly defects, and the single ` +
    `change that would raise the score most. Give every finding a short kebab-case id, a kind, and a ` +
    `class-level rule. Do not hedge, do not give credit for effort, and do not guess at any other seat's opinion.`,
    { label: `seat:${seat.key}`, phase: 'Review', schema: SCHEMA }
  )
))).filter(Boolean)

/* Verification is spent where it decides the score. A finding at or above 1.0
   can move a seat; one below it cannot, and fifteen rounds of paying a full
   adversarial agent for a 0.15 typography note is the clearest waste in the old
   loop. Heavy findings keep their own refuter; the rest are batched per seat,
   which keeps the adversarial stance and drops about two thirds of the agents
   in this phase. */
const HEAVY = 1.0
const REFUTE = `Refute if: it is factually wrong about the frames or the code; it is already handled; ` +
  `it is already proven by the behaviour gate; it would violate a locked constraint (the palette, the ` +
  `weights, the architecture, or the founder's locked card/radius/density/indigo/type configuration); ` +
  `it is taste stated as a defect with no argument; or the fix would make the work worse. ` +
  `Confirm only if real, specific, and an improvement at a 9.5 bar. ` +
  `Judge the RULE as well as the fix: if the stated rule is wrong or unenforceable, say so in your reason ` +
  `even when you confirm the finding, and give the rule you would enforce instead.`

const VERDICT = {
  type: 'object', additionalProperties: false,
  required: ['id', 'real', 'reason'],
  properties: {
    id: { type: 'string' },
    real: { type: 'boolean' },
    reason: { type: 'string' },
    sharpenedFix: { type: 'string' },
    sharpenedRule: { type: 'string', description: 'the enforceable rule, corrected if the seat got it wrong' },
  },
}

phase('Verify')
const heavy = []
const light = []
for (const review of reviews) {
  for (const finding of review.findings) {
    if (finding.kind === 'build') continue
    if (finding.cost >= HEAVY) heavy.push({ seat: review.seat, ...finding })
    else light.push({ seat: review.seat, ...finding })
  }
}
const lightBySeat = new Map()
for (const f of light) {
  if (!lightBySeat.has(f.seat)) lightBySeat.set(f.seat, [])
  lightBySeat.get(f.seat).push(f)
}

log(`verifying ${heavy.length} individually, ${light.length} batched across ${lightBySeat.size} seats`)

const heavyVerdicts = await parallel(heavy.map((f) => () =>
  agent(
    `Adversarially verify one design-review finding against the artifact. Default to REFUTED when uncertain.\n\n` +
    `FINDING id=${f.id}\nSeat: ${f.seat}\nElement: ${f.element}\nProblem: ${f.problem}\n` +
    `Stated rule: ${f.rule}\nProposed fix: ${f.fix}\n\n${BAR}\n\n${REFUTE}\n\n` +
    `Echo the finding id back exactly so the verdict can be matched to its finding.`,
    { label: `verify:${f.id}`, phase: 'Verify', schema: VERDICT }
  )
))

const lightVerdicts = await parallel([...lightBySeat.entries()].map(([seat, group]) => () =>
  agent(
    `Adversarially verify ${group.length} small design-review findings against the artifact. Default to ` +
    `REFUTED when uncertain. Judge each one INDEPENDENTLY — confirming one is not a reason to confirm its ` +
    `neighbour. They are grouped only because each is individually cheap.\n\n` +
    group.map((f) =>
      `FINDING id=${f.id}\nElement: ${f.element}\nProblem: ${f.problem}\nStated rule: ${f.rule}\nProposed fix: ${f.fix}\n`
    ).join('\n') +
    `\n${BAR}\n\n${REFUTE}\n\nReturn one verdict per finding, echoing each id exactly.`,
    { label: `verify:${seat.split(' ')[0].toLowerCase()}-batch`, phase: 'Verify', schema: {
      type: 'object', additionalProperties: false, required: ['verdicts'],
      properties: { verdicts: { type: 'array', items: VERDICT } },
    } }
  )
))

const byId = new Map()
for (const review of reviews) {
  for (const finding of review.findings) byId.set(finding.id, { seat: review.seat, ...finding })
}

const checked = heavyVerdicts.filter(Boolean)
  .concat(lightVerdicts.filter(Boolean).flatMap((r) => r.verdicts || []))

const confirmed = []
const refuted = []
for (const verdict of checked) {
  const finding = byId.get(verdict.id)
  if (!finding) continue
  const row = {
    ...finding,
    verdict: verdict.reason,
    sharpenedFix: verdict.sharpenedFix || null,
    sharpenedRule: verdict.sharpenedRule || finding.rule,
  }
  if (verdict.real) confirmed.push(row)
  else refuted.push(row)
}

const deferred = []
for (const review of reviews) {
  for (const f of review.findings) if (f.kind === 'build') deferred.push({ seat: review.seat, ...f })
}

const scores = reviews.map((r) => ({ seat: r.seat, score: r.score, headroom: r.headroom, biggestWin: r.biggestWin }))
const floor = Math.min(...scores.map((s) => s.score))
const predicted = Math.min(...scores.map((s) => s.headroom))

log(`round ${ROUND}: floor ${floor}, predicted after remediation ${predicted}, ` +
  `${confirmed.length} confirmed, ${refuted.length} refuted, ${deferred.length} deferred as builds`)

return {
  round: ROUND,
  mode: MODE,
  frozen: true,
  scores,
  floor,
  predicted,
  confirmed,
  refuted: refuted.map((r) => ({ seat: r.seat, id: r.id, problem: r.problem, why: r.verdict })),
  deferred: deferred.map((r) => ({ seat: r.seat, id: r.id, problem: r.problem, fix: r.fix, cost: r.cost })),
}
