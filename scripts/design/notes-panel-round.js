export const meta = {
  name: 'notes-panel-round',
  description: 'Seven fresh independent seats grade the Notes master against a 9.5 bar, then a refuter tries to kill every finding',
  phases: [
    { title: 'Review' },
    { title: 'Verify' },
  ],
}

const LAB = 'C:/Users/ethan/signal-studio-workspace/_wt-design-notes/docs/design/labs/notes-2026-08'
const SHOTS = `${LAB}/shots`
const ROUND = (args && args.round) || 1
const PRIOR = (args && args.prior) || ''

const BAR = `
Score against this standard: the work of an award-winning design studio that
iterated on this product for months. 10 is that studio's best shipped work.
Benchmarks to hold it against, by name: Linear, Stripe, Vercel, Things,
Bear, iA Writer. Score the ARTIFACT, not the effort. A polite 8 that should
be a 6 makes the panel worthless.

WHAT YOU ARE REVIEWING
Signal Notes — the capture product in Signal Studio, used by wedding-venue
operators and by couples planning a wedding, not by software teams. The whole
promise of the product is the three seconds between having a thought and it
being safe. Its second promise is a sealed one-way edge into Tasks: only the
exact words a person picks ever cross, and the note itself never leaves.

THE ARCHITECTURE IS LOCKED BY THE FOUNDER AND MUST NOT BE REDESIGNED:
- an ink floor, one white sheet lifted off it, a floating capsule spine on the
  left carrying the suite, a floating dock at the foot of the sheet
- the Notes sheet is TWO PLANES WITH DEPTH: a "desk" carrying the newest piece
  of paper (which is where you write), and an "index" below it carrying
  everything older, one line each. Reading lifts a note out of the index onto
  the desk.
- dictating takes the whole floor to ink
- the review queue is a hand of cards
- turning a note into a task peels a second, smaller piece of paper off the
  note; the note is never covered
- on a phone the capsule and the dock merge, the desk stands down, and capture
  moves into the dock

CONSTRAINTS THAT ARE NOT NEGOTIABLE (do not propose breaking these):
- The palette is exactly three colours: Ink #111111, Indigo #4f46e5, White
  #ffffff, plus tints of those three at stated alpha. NO other hue may be
  introduced. State is ink DENSITY and FILL, never colour.
- Type is Geist at weights 400 and 600 only.
- Copy comes from the product's own notes-copy.ts and is judged, not
  rewritten by you: no em dashes, no exclamation marks, plain English,
  sentence case, no jargon. The voice disclosure in the dictation flow is
  legally required and must survive verbatim; you may argue about where it
  lives, never about whether it exists.
- The architecture above.
Findings that amount to "add a colour", "add a weight" or "restructure the
architecture" are out of scope and will be discarded. Everything else is in
scope, including the claim that this is not world class.

MEASURED BASELINE — ALREADY VERIFIED, DO NOT SPEND FINDINGS ON IT.
scripts/design/notes-audit.mjs passes 0/0/0/0/0/0/0 across all ten states and
all four rooms: palette lock, type weights, type families, WCAG AA contrast
against the real composited backdrop, hit targets including pseudo-element
expanders, the radii ladder, motion tokens.
scripts/design/notes-interaction-check.mjs passes 102 assertions covering:
capture and undo, ctrl+z, the field never clearing before the note is safe,
head/index count agreement, scroll and focus place-keeping across every
repaint, the index's single tab stop and arrow walk, the hand's keyboard
model and reversibility, search filtering, marking and its no-result state,
the voice takeover and its disclosure, word-safe trims that re-run on resize
and never delete content from the accessible name, the honesty states
carrying no warning hue, the seam's labelling, nothing invisible being
focusable, everything focusable carrying a name, no sideways scroll at six
widths, and reduced-motion. READ THAT FILE. A finding that restates one of
those assertions is worthless.

YOU MUST DRIVE THE FILE, NOT ONLY READ FRAMES.
Open it in Playwright (chromium is installed; import { chromium } from
"@playwright/test") from
C:/Users/ethan/signal-studio-workspace/_wt-design-notes
at file:///${LAB}/notebook.html and operate it:
  ?state=notebook | capture | voice | readback | review | seam | search
        | pressure | nothing | not-yet
  ?v=locked | quiet | studio | press          (the three finished rooms)
Type into the top sheet. Press Ctrl+Enter. Press Ctrl+Z. Tab into the index
and walk it with the arrows. Press Enter on a row, then Escape. Press "/" and
type. Go to ?state=review and press T and K. Resize to 390 and capture a note
from the dock. Judge the FEEL of those moments — timing, what is announced,
what is reversible, what a venue owner who has never used a task tool would
discover — as harshly as you judge the pixels. "It is implemented" earns
nothing. "It is implemented at the standard of Linear" is the bar.

FRAMES (read at least four):
${SHOTS}/locked-notebook--1440x960.png   the resting state
${SHOTS}/locked-capture--1440x960.png    mid-thought
${SHOTS}/locked-voice--1440x960.png      the floor gone to ink
${SHOTS}/locked-readback--1440x960.png   what came back from speech
${SHOTS}/locked-review--1440x960.png     the hand
${SHOTS}/locked-seam--1440x960.png       turning a note into a task
${SHOTS}/locked-pressure--1440x960.png   36 notes and a 900-word note
${SHOTS}/locked-nothing--1440x960.png    every empty in the product
${SHOTS}/locked-not-yet--1440x960.png    loading, saving, offline, conflict, delete
${SHOTS}/locked-notebook--390x844.png    the phone
${SHOTS}/locked-notebook--768x1024.png   the tablet
Source: ${LAB}/master.css and ${LAB}/notebook.js

THE STANDING DEFECT CHECKLIST — a previous programme on the sibling product
already paid for every one of these. Check them, and say so if you find one:
repaints that annihilate scroll position or focus; keyboard models advertised
but not implemented; Space or Enter hijacked from a labelled control; nothing
reversible; filters that dead-end; controls painting over content;
invisible-but-focusable controls; clamps that cut mid-word or silently delete
content; facts stated in two grammars or contradicted between header and
body; state carried only by ink density with no accessible-name equivalent;
empty states that repeat themselves instead of offering one first move; the
tallest-column scroll trap; anchors without hrefs. And the three this product
adds: capture latency (every millisecond between intent and ink is product),
keystroke loss under a flaky network, and a voice flow that cannot be trusted
without looking at the screen.

THE FAILURE MODE THIS DIRECTION WAS CHOSEN TO AVOID. At round 4 of the sibling
programme the taste seat said of it: "an extremely well-made kanban that
happens to contain wedding words." The Notes equivalent — an extremely
well-made notes app that happens to contain wedding words — is the thing to
say plainly if it is true of this.
${PRIOR}
Read at least four frames, drive the live file, and read the source before
scoring.
`

const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['seat', 'score', 'findings', 'biggestWin'],
  properties: {
    seat: { type: 'string' },
    score: { type: 'number', description: 'to one decimal, 0 to 10' },
    findings: {
      type: 'array', minItems: 3, maxItems: 5,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['id', 'element', 'problem', 'fix', 'cost'],
        properties: {
          id: { type: 'string', description: 'a short kebab-case slug naming this defect' },
          element: { type: 'string', description: 'the selector, state or frame it is in' },
          problem: { type: 'string' },
          fix: { type: 'string', description: 'implementable exactly as written' },
          cost: { type: 'number', description: 'how many tenths of a point this defect costs the score' },
        },
      },
    },
    biggestWin: { type: 'string', description: 'the single change that would raise the score most' },
  },
}

const SEATS = [
  { key: 'ui', name: 'UI composition', lens: 'Composition, alignment, optical balance, grid, rhythm, density, the relationship between the floor, the capsule, the sheet, the desk, the index and the dock. Where the eye goes first and whether that is right. Lazy spacing, unequal optical margins, things that align mathematically but not optically. Whether the two planes actually read as two planes or as one list with a box on top of it.' },
  { key: 'type', name: 'Typography', lens: 'The type system: scale, the 400/600 pairing, the tracking curve, line-height, measure, uppercase micro-label discipline, numerals, orphans and widows, hierarchy carried by size versus weight versus tracking. This product sets a person\'s OWN WRITING as its primary content, which is the hardest thing in the discipline; judge that above all. Hold it to iA Writer, Bear and Vercel Geist standards.' },
  { key: 'interaction', name: 'Interaction and states', lens: 'Hover, focus, active, selected, empty, loading, dense, failure. Affordance at rest. Reflow on hover. Discoverability of anything revealed only on hover. The keyboard model end to end and whether the file answers every key it advertises. What the loading frame promises versus what arrives. What is reversible and whether the way back is on screen or has to be remembered. Capture latency above everything: count the actions between intent and ink.' },
  { key: 'ux', name: 'UX and information design', lens: 'A wedding-venue operator or a couple planning a wedding, neither of whom has used a project-management tool, has to pick this up unaided. Comprehension without training. Is the most important thing on screen the most prominent thing. Duplicated, missing or twice-named information. Dense and empty states. The notes-to-tasks seam is the most important cross-product moment in the suite: judge whether a stranger would understand what crosses and what stays.' },
  { key: 'brand', name: 'Brand and copy', lens: 'Register: confident, premium, editorial, restrained, never cheap. Voice: plain English, declarative, no jargon, no em dashes, no exclamation marks, sentence case. Judge every visible string in the file, including the ones the product owns and the ones this master invented. Judge whether three colours are being spent well or merely obeyed. Judge whether "The pile" and "the hand" are the right words for a venue manager or whether they are a designer enjoying themselves.' },
  { key: 'taste', name: 'Product taste and emotional resonance', lens: 'Would a discerning stranger believe a top studio made this, and pay for it. Does it move you: relief, calm, confidence, delight. Or does it merely function. Name the single memorable moment, and if there is none that is the finding. You have equal weight to any craft seat. Say plainly if this is an extremely well-made notes app that happens to contain wedding words.' },
  { key: 'evidence', name: 'Measured evidence', lens: 'You distrust opinion. Read the SOURCE closely: master.css and notebook.js. CSS that cannot do what it claims, dead rules, specificity collisions, values off the declared ladders, states declared but unreachable, responsive rules that will break, accessibility beyond contrast (semantics, roles, names, focus order, aria, live regions), race conditions in the render path, and any place the code and its comment disagree. Cite selectors and line context. Write and run your own Playwright probes for anything the existing gate does not cover.' },
]

phase('Review')
const reviews = await parallel(SEATS.map((seat) => () =>
  agent(
    `You are the ${seat.name} seat on an independent design review panel. Round ${ROUND}.\n\n` +
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
        `Adversarially verify one design-review finding against the artifact. Your job is to KILL it. Default to REFUTED when uncertain.\n\n` +
        `FINDING id=${finding.id}\nSeat: ${review.seat}\nElement: ${finding.element}\nProblem: ${finding.problem}\nProposed fix: ${finding.fix}\n\n` +
        `${BAR}\n\n` +
        `Open the file and check the specific claim yourself before you answer. ` +
        `Refute if: it is factually wrong about the frames, the source or the behaviour; it is already handled; it restates something the measured baseline already proves; it would violate a non-negotiable constraint; it is taste stated as a defect with no argument; or the fix would make the work worse. ` +
        `Confirm only if it is real, specific, and an improvement at a 9.5 bar. ` +
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

const scores = {}
for (const r of alive) scores[r.seat] = r.score
const values = Object.values(scores)

log(`round ${ROUND}: ${alive.length} seats, ${checked.length} verdicts, ${confirmed.length} confirmed, ${refuted.length} refuted · min ${Math.min(...values)} max ${Math.max(...values)}`)

return {
  round: ROUND,
  scores,
  wins: alive.map((r) => ({ seat: r.seat, score: r.score, biggestWin: r.biggestWin })),
  confirmed,
  refuted: refuted.map((r) => ({ seat: r.seat, id: r.id, problem: r.problem, why: r.verdict })),
}
