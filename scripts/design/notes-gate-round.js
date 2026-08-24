/* THE GATE ROUND.
 *
 * This replaces notes-panel-round.js from round 10 on. The old runner
 * raised 195 confirmed findings across nine rounds and the floor still
 * sat at 7.1, so the loop was not converging. Four things were wrong
 * with it, and each one is answered here.
 *
 * 1. THE PANEL COULD NOT PASS. The old schema forced every seat to
 *    return `minItems: 3` findings whatever it thought of the work.
 *    Seven seats times three is twenty-one, and the observed minimum
 *    across eight recorded rounds was exactly twenty-one. A seat that
 *    believed the work was finished was still obliged to invent three
 *    defects, so a unanimous 9.5 was arithmetically unreachable no
 *    matter how good the artifact got. Findings are optional now, and a
 *    seat states a sign-off rather than filling a quota.
 *
 * 2. THE WORK MISSED THE BINDING CONSTRAINT. The gate is the LOWEST
 *    seat, but every round fixed everything from all seven. Across
 *    eight rounds the floor seat rotated through five different seats,
 *    so most of the fixing each round could not raise the score by
 *    definition. Only the seats at the floor produce blockers now.
 *
 * 3. THE LOOP MANUFACTURED ITS OWN DEFECTS. Round 9 confirmed twenty
 *    findings and four of them were caused by round 8's fixes — a
 *    disabled regex, a gesture made unreachable, a budget that forgot
 *    the peel, a gate rule that failed the correct technique. That is a
 *    20% self-inflicted rate, and it came from landing twenty-odd fixes
 *    in one batch and running the gate once at the end. The fix order
 *    is one blocker at a time with both gates between.
 *
 * 4. IT GRADED FOUR ROOMS THAT WERE NOT THE PRODUCT. The founder has
 *    locked one configuration. Everything else is noise in the frames,
 *    in the audit and in the seats' attention.
 *
 * Run it with the Workflow tool:
 *   Workflow({ scriptPath: "scripts/design/notes-gate-round.js",
 *              args: { round: 10, ledger: [...], prior: "..." } })
 */

export const meta = {
  name: 'notes-gate-round',
  description: 'Seven seats grade the locked Notes configuration and state whether they would sign it at 9.5; only the seats at the floor raise blockers, and every blocker faces a refuter',
  phases: [
    { title: 'Grade' },
    { title: 'Refute' },
  ],
}

const LAB = 'C:/Users/ethan/signal-studio-workspace/_wt-design-notes/docs/design/labs/notes-2026-08'
const SHOTS = `${LAB}/shots`
const ROUND = (args && args.round) || 10
const PRIOR = (args && args.prior) || ''
/* Every finding id this programme has already confirmed and fixed. A
 * seat re-raising one of these is re-litigating closed work, and the
 * refuter kills it on sight. Passed in rather than read, because a
 * workflow script has no filesystem. */
const LEDGER = (args && args.ledger) || []

/* THE ONE CONFIGURATION.
 * Rounds 1 to 9 graded four rooms and ten states, and the seats spent
 * findings on rooms the founder was never going to ship. This is the
 * chosen preset and the only thing that is graded now. */
const CONFIG = '?v=locked&paper=stacked&index=airy&radius=soft&type=calm'

const BAR = `
Score against this standard: the work of an award-winning design studio
that iterated on this product for months. 10 is that studio's best
shipped work. Benchmarks to hold it against, by name: Linear, Stripe,
Vercel, xAI/Grok, SpaceX. Score the ARTIFACT, not the effort.

WHAT YOU ARE REVIEWING
Signal Notes — the capture product in Signal Studio, used by wedding-venue
operators and by couples planning a wedding, not by software teams. The
whole promise is the three seconds between having a thought and it being
safe. Its second promise is a sealed one-way edge into Tasks: only the
exact words a person picks ever cross, and the note itself never leaves.

THE CONFIGURATION IS LOCKED. You are grading exactly one:
  ${CONFIG}
  the notebook, locked room, stacked pile, airy index, soft corners,
  calm type.
This is the founder's chosen preset. Do NOT compare it to the other
rooms, do not propose switching any of those tokens, and do not spend a
finding on a state that only exists in another configuration. If a
defect only reproduces outside this preset, it is out of scope.

THE ARCHITECTURE IS LOCKED BY THE FOUNDER AND MUST NOT BE REDESIGNED:
- an ink floor, one white sheet lifted off it, a floating capsule spine
  on the left carrying the suite, a floating dock at the foot
- the Notes sheet is TWO PLANES WITH DEPTH: a "desk" carrying the newest
  piece of paper (which is where you write), and an "index" below it
  carrying everything older, one line each. Reading lifts a note out of
  the index onto the desk.
- dictating takes the whole floor to ink
- the review queue is a hand of cards
- turning a note into a task peels a second, smaller piece of paper off
  the note; the note is never covered
- on a phone the capsule and the dock merge, the desk stands down, and
  capture moves into the dock

CONSTRAINTS THAT ARE NOT NEGOTIABLE:
- Exactly three colours: Ink #111111, Indigo #4f46e5, White #ffffff,
  plus tints of those three. State is ink DENSITY and FILL, never hue.
- Geist at 400 and 600 only.
- Copy comes from the product's own notes-copy.ts and is judged, not
  rewritten by you: no em dashes, no exclamation marks, plain English,
  sentence case. The voice disclosure is legally required and survives
  verbatim.
Findings that amount to "add a colour", "add a weight", "change the
locked preset" or "restructure the architecture" are out of scope.

WHAT IS ALREADY MEASURED — DO NOT SPEND A BLOCKER ON IT.
scripts/design/notes-audit.mjs passes 0 across the palette lock, type
weights, families, WCAG AA contrast against the real composited
backdrop, hit targets including pseudo-element expanders, the radii
ladder, motion tokens, the eight-step type ramp, a declared leading on
every text-bearing element, a 32em measure ceiling on every wrapping
paragraph, and a 44px pass driven with a real touch pointer at three
phone widths.
scripts/design/notes-interaction-check.mjs passes 488 assertions with 0
failing. READ THAT FILE. A blocker that restates one of its assertions
is worthless.

YOU MUST DRIVE THE FILE, NOT ONLY READ FRAMES.
Open it in Playwright (chromium is installed) from
C:/Users/ethan/signal-studio-workspace/_wt-design-notes
at file:///${LAB}/notebook.html${CONFIG}&state=notebook and operate it.
States: notebook | capture | voice | readback | review | seam | search
        | pressure | nothing | not-yet
Type into the sheet. Press Ctrl+Enter, Ctrl+Z. Tab into the index and
walk it. Press Enter on a row, then Escape. Press "/" and type. Go to
review and press T, K, L. Resize to 390 and capture from the dock.

DRIVE REAL GESTURES, NOT SYNTHETIC ONES. Round 9 found that the primary
pick gesture was completely broken while the behaviour gate passed,
because the gate proved it with a scripted Selection object instead of a
real drag. If you are testing a pointer gesture, use real mouse or touch
events: page.mouse.down/move/up, or tap. A synthetic proof of a pointer
gesture is not a proof.

FRAMES (read at least four; all are the locked configuration):
${SHOTS}/locked-notebook--1440x960.png   the resting state
${SHOTS}/locked-capture--1440x960.png    mid-thought
${SHOTS}/locked-voice--1440x960.png      the floor gone to ink
${SHOTS}/locked-readback--1440x960.png   what came back from speech
${SHOTS}/locked-review--1440x960.png     the hand
${SHOTS}/locked-seam--1440x960.png       turning a note into a task
${SHOTS}/locked-pressure--1440x960.png   36 notes and a 900-word note
${SHOTS}/locked-nothing--1440x960.png    every empty in the product
${SHOTS}/locked-not-yet--1440x960.png    loading, saving, offline, delete
${SHOTS}/locked-notebook--390x844.png    the phone
${SHOTS}/locked-notebook--768x1024.png   the tablet
Source: ${LAB}/master.css and ${LAB}/notebook.js

THE STANDING DEFECT CHECKLIST — a previous programme paid for every one:
repaints that annihilate scroll position or focus; keyboard models
advertised but not implemented; Space or Enter hijacked from a labelled
control; nothing reversible; filters that dead-end; controls painting
over content; invisible-but-focusable controls; clamps that cut mid-word
or silently delete content; facts stated in two grammars or contradicted
between header and body; state carried only by ink density with no
accessible-name equivalent; empty states that repeat themselves; anchors
without hrefs. And the three this product adds: capture latency,
keystroke loss under a flaky network, and a voice flow that cannot be
trusted without looking at the screen.

ALREADY CLOSED — RE-RAISING ANY OF THESE IS RE-LITIGATING FIXED WORK.
${LEDGER.length ? LEDGER.join(', ') : '(none recorded)'}
If you believe one of them has REGRESSED, say so explicitly and give the
measurement that shows it — that is a legitimate blocker. Simply naming
one again is not.
${PRIOR}
`

/* A seat that thinks the work is finished must be able to say so. The
 * old schema forbade that, which is the single reason nine rounds of
 * honest work never reached the gate. */
const GRADE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['seat', 'score', 'signOff', 'verdict'],
  properties: {
    seat: { type: 'string' },
    score: { type: 'number', description: 'to one decimal, 0 to 10' },
    signOff: {
      type: 'boolean',
      description:
        'TRUE only if you would put your name to this artifact as 9.5 or better against the named benchmarks. If false, blockers must say what stands in the way.',
    },
    verdict: { type: 'string', description: 'one sentence, the honest state of the work through your lens' },
    blockers: {
      type: 'array',
      minItems: 0,
      maxItems: 3,
      description:
        'ONLY what actually stands between this artifact and 9.5 through your lens. Empty if you signed off. Never padding: an item here is something you would refuse to sign the work without.',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['id', 'element', 'problem', 'fix', 'cost'],
        properties: {
          id: { type: 'string', description: 'short kebab-case slug' },
          element: { type: 'string', description: 'the selector, state or frame it is in' },
          problem: { type: 'string', description: 'what you measured, with the numbers' },
          fix: { type: 'string', description: 'implementable exactly as written' },
          cost: { type: 'number', description: 'tenths of a point this costs the score' },
        },
      },
    },
  },
}

const SEATS = [
  { key: 'ui', name: 'UI composition', lens: 'Composition, alignment, optical balance, grid, rhythm, density, the relationship between the floor, the capsule, the sheet, the desk, the index and the dock. Where the eye goes first and whether that is right. Things that align mathematically but not optically. Whether the two planes read as two planes.' },
  { key: 'type', name: 'Typography', lens: 'Scale, the 400/600 pairing, the tracking curve, line-height, measure, uppercase micro-label discipline, numerals, orphans and widows, hierarchy carried by size versus weight versus tracking. This product sets a person\'s OWN WRITING as its primary content, which is the hardest thing in the discipline; judge that above all. Hold it to iA Writer, Bear and Vercel Geist standards.' },
  { key: 'interaction', name: 'Interaction and states', lens: 'Hover, focus, active, selected, empty, loading, dense, failure. Affordance at rest. The keyboard model end to end and whether the file answers every key it advertises. What is reversible and whether the way back is on screen. Capture latency above everything: count the actions between intent and ink.' },
  { key: 'ux', name: 'UX and information design', lens: 'A wedding-venue operator or a couple planning a wedding, neither of whom has used a project-management tool, has to pick this up unaided. Comprehension without training. Duplicated, missing or twice-named information. The notes-to-tasks seam is the most important cross-product moment in the suite: judge whether a stranger would understand what crosses and what stays.' },
  { key: 'brand', name: 'Brand and copy', lens: 'Register: confident, premium, editorial, restrained, never cheap. Voice: plain English, declarative, no jargon, no em dashes, no exclamation marks, sentence case. Judge every visible string, including the ones this master invented. Judge whether three colours are being spent well or merely obeyed.' },
  { key: 'taste', name: 'Product taste and emotional resonance', lens: 'Would a discerning stranger believe a top studio made this, and pay for it. Does it move you: relief, calm, confidence, delight. Or does it merely function. Name the single memorable moment, and if there is none that is the blocker. You have equal weight to any craft seat. Say plainly if this is an extremely well-made notes app that happens to contain wedding words.' },
  { key: 'evidence', name: 'Measured evidence', lens: 'You distrust opinion. Read master.css and notebook.js closely. CSS that cannot do what it claims, dead rules, specificity collisions, values off the declared ladders, states declared but unreachable, responsive rules that will break, accessibility beyond contrast, race conditions in the render path, and any place the code and its comment disagree. Cite selectors. Write and run your own Playwright probes, driving REAL events, for anything the existing gate does not cover.' },
]

phase('Grade')
const grades = await parallel(SEATS.map((seat) => () =>
  agent(
    `You are the ${seat.name} seat on an independent design review panel. Round ${ROUND}.\n\n` +
      `YOUR LENS\n${seat.lens}\n\n${BAR}\n\n` +
      `Return your score to one decimal, and state plainly whether you would SIGN THIS OFF at 9.5 or better.\n\n` +
      `This panel has been told for nine rounds that it must produce three to five defects whatever it thought, ` +
      `and that quota is gone. If the work is genuinely at the bar through your lens, sign it off and return NO blockers. ` +
      `If it is not, return only what actually stands in the way — at most three, each one something you would refuse to sign the work without. ` +
      `Do not pad. Do not hedge. Do not give credit for effort. An invented blocker costs the programme a real round of work and, twice in the last two rounds, introduced a new defect into shipped surface.`,
    { label: `grade:${seat.key}`, phase: 'Grade', schema: GRADE_SCHEMA },
  ),
))

const alive = grades.filter(Boolean)
const scores = {}
const signOffs = {}
const verdicts = {}
for (const g of alive) {
  scores[g.seat] = g.score
  signOffs[g.seat] = g.signOff
  verdicts[g.seat] = g.verdict
}
const values = Object.values(scores)
const floor = values.length ? Math.min(...values) : 0
const unanimous = alive.length === SEATS.length && alive.every((g) => g.signOff && g.score >= 9.5)

log(
  `round ${ROUND}: ${alive.length}/${SEATS.length} seats · floor ${floor} · ceiling ${Math.max(...values)} · ` +
    `${alive.filter((g) => g.signOff).length} signed off`,
)

if (unanimous) {
  log('THE GATE IS MET: every seat signed off at 9.5 or better.')
  return { round: ROUND, scores, signOffs, verdicts, gateMet: true, confirmed: [], refuted: [] }
}

/* THE BINDING CONSTRAINT.
 * The gate is the lowest seat, so only the lowest seats can raise it.
 * Across eight rounds the floor seat rotated through five different
 * seats while every round fixed all seven seats' findings, which is why
 * most of the work could not move the score. A 0.3 band, so a seat
 * effectively tied with the floor is not dropped on a rounding artifact. */
const BAND = 0.3
const binding = alive.filter((g) => g.score <= floor + BAND)
const parked = alive.filter((g) => g.score > floor + BAND)
const blockers = binding.flatMap((g) => (g.blockers || []).map((b) => ({ seat: g.seat, ...b })))
log(
  `binding at the floor: ${binding.map((g) => `${g.seat} ${g.score}`).join(', ')} · ` +
    `${blockers.length} blockers to verify · ` +
    `parked above the floor: ${parked.map((g) => `${g.seat} ${g.score}`).join(', ') || 'none'}`,
)

phase('Refute')
const verdictsOut = await parallel(
  blockers.map((b) => () =>
    agent(
      `Adversarially verify one design-review blocker. Your job is to KILL it. Default to REFUTED when uncertain.\n\n` +
        `BLOCKER id=${b.id}\nSeat: ${b.seat}\nElement: ${b.element}\nProblem: ${b.problem}\nProposed fix: ${b.fix}\n\n` +
        `${BAR}\n\n` +
        `Open the file at the LOCKED CONFIGURATION above and check the specific claim yourself, driving real events, before you answer.\n\n` +
        `REFUTE if: it is factually wrong about the frames, the source or the behaviour; it is already handled; it restates something the measured baseline already proves; it re-raises a finding on the closed list above without evidence of a regression; it only reproduces outside the locked configuration; it would violate a non-negotiable constraint; it is taste stated as a defect with no argument; or the fix would make the work worse.\n\n` +
        `CONFIRM only if it is real, specific, reproducible in the locked configuration, and genuinely stands between this artifact and a 9.5.\n\n` +
        `One more thing, because it has cost this programme real damage twice: judge the FIX as well as the problem. Round 8's clamp fix forgot the peel and deleted the second plane; round 9's click handler made the word-safe drag it shipped alongside unreachable. If the proposed fix would plausibly break something adjacent, say so in sharpenedFix and state what must be re-measured after it lands.\n\n` +
        `Echo the blocker id back exactly.`,
      {
        label: `refute:${b.id}`,
        phase: 'Refute',
        schema: {
          type: 'object',
          additionalProperties: false,
          required: ['id', 'real', 'reason'],
          properties: {
            id: { type: 'string' },
            real: { type: 'boolean' },
            reason: { type: 'string' },
            sharpenedFix: { type: 'string' },
            watchFor: { type: 'string', description: 'what must be re-measured after this fix lands' },
          },
        },
      },
    ),
  ),
)

const byId = new Map(blockers.map((b) => [b.id, b]))
const confirmed = []
const refuted = []
for (const v of verdictsOut.filter(Boolean)) {
  const b = byId.get(v.id)
  if (!b) continue
  const row = { ...b, verdict: v.reason, sharpenedFix: v.sharpenedFix || null, watchFor: v.watchFor || null }
  if (v.real) confirmed.push(row)
  else refuted.push(row)
}
confirmed.sort((a, b) => (b.cost || 0) - (a.cost || 0))

log(
  `round ${ROUND}: ${confirmed.length} confirmed, ${refuted.length} refuted · ` +
    `fix them one at a time, both gates between each`,
)

return {
  round: ROUND,
  scores,
  signOffs,
  verdicts,
  gateMet: false,
  floor,
  binding: binding.map((g) => g.seat),
  wins: alive.map((g) => ({ seat: g.seat, score: g.score, signOff: g.signOff, biggestWin: g.verdict })),
  confirmed,
  refuted: refuted.map((r) => ({ seat: r.seat, id: r.id, problem: r.problem, why: r.verdict })),
}
