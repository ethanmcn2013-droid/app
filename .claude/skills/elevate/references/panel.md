# The panel

Seven seats, blind, in parallel. A refuter per finding. Only survivors get
fixed. This file is the protocol; `scripts/panel-round.mjs` generates the
runnable round from it.

## Why blind, why refuted

Seats run with no knowledge of one another and are never told the previous
round's scores, because anchoring is the death of honest review — a seat
that knows the panel "is at about 7.4" produces 7.4-shaped findings. The
refuter exists because roughly a third of all findings raised across the
proving engagements were wrong: mis-measured, already handled, taste dressed
as defect, or fixes that would make the work worse. 142 of 385 Tasks
findings and 27 of 105 Notes findings died in verification. Without the
refuter, every one of those would have been "fixed".

## The standard (the BAR)

Every seat and every refuter receives the same standard, verbatim:

> Score against this standard: the work of an award-winning design studio
> that iterated on this product for months. 10 is that studio's best
> shipped work. Benchmarks to hold it against, by name: Linear, Stripe,
> Vercel, xAI/Grok, SpaceX. Score the ARTIFACT, not the effort. A polite 8
> that should be a 6 makes the panel worthless.

After the standard, the BAR carries, in order:

1. **What you are reviewing** — one paragraph from the brief: the product,
   the audience, and the locked architecture, stated as locked.
2. **Constraints that are not negotiable** — the locked palette, type, and
   architecture from the brief/config, with the sentence: findings that
   amount to "add a colour", "add a weight" or "restructure the layout"
   are out of scope and will be discarded.
3. **Measured baseline** — what the gates already prove (audit categories
   at zero, behaviour assertion count), with the instruction: do not spend
   findings on those; find what automation cannot see. A finding that
   restates a gate-proven fact is refuted on sight.
4. **The frames** — file paths to the current round's screenshots, each
   with a one-line caption.
5. **Drive instructions** — how to open the master in Playwright and
   operate it: the keyboard model, the primary gestures, what is live.
   Grading is done by DRIVING the file from round 1, never frames alone;
   frames hide exactly the defects that cost the most (a live region that
   never announces, a repaint that loses your place, a keyboard model that
   is advertised and not implemented).
6. **Round-specific notes** — what is new since last round, and any
   deliberate decision seats might mistake for an oversight ("argue with
   it if you disagree, but do not report it as an oversight").
7. **The honest-distance ask** — say plainly what the score is, what
   earned it, and what stands between it and the gate in terms a founder
   can act on: polish, a build, or a different decision, and roughly how
   big. Do not inflate to be kind and do not deflate to look rigorous.

## The seven seats

Names and lenses are stable across engagements; only the audience sentence
inside UX changes (it comes from the brief). Proven lens texts:

- **UI composition** — Composition, alignment, optical balance, grid,
  rhythm, density, the relationship between the page's major objects.
  Where the eye goes first and whether that is right. Lazy spacing,
  unequal optical margins, things that align mathematically but not
  optically.
- **Typography** — The type system: scale, weight pairing, tracking curve,
  line-height, measure, mono micro-label discipline, numerals, orphans and
  widows, hierarchy carried by size versus weight versus tracking. Hold it
  to Vercel Geist and Linear standards.
- **Interaction and states** — Hover, focus, active, selected, drag,
  empty, loading, dense. Affordance at rest. Reflow on hover.
  Discoverability of reveal-on-hover controls. Keyboard model and focus
  order. What the loading frame promises versus what arrives.
- **UX and information design** — {AUDIENCE SENTENCE FROM THE BRIEF} has
  to run their work from this. Comprehension without training. Is the most
  important thing on screen the most prominent thing. Duplicated, missing,
  or twice-named information. Dense and empty states.
- **Brand and copy** — Register per the brief: judge every visible string.
  Voice, grammar consistency (one grammar per fact), names (the same place
  never has two names, the same event never has six). Judge whether the
  palette is being spent well or merely obeyed.
- **Product taste and emotional resonance** — Would a discerning stranger
  believe a top studio made this and pay for it. Does it move you: relief,
  calm, confidence, delight. Or does it merely function. Name the single
  memorable moment, and if there is none, that is the finding. Equal
  weight to any craft seat.
- **Measured evidence** — You distrust opinion. Read the SOURCE closely.
  CSS that cannot do what it claims, dead rules, specificity collisions,
  values off the declared ladders, states declared but unreachable,
  responsive rules that will break, accessibility beyond contrast
  (semantics, roles, names, focus order, aria), and any place the code and
  its comment disagree. Cite selectors and line context.

## Seat output contract

Each seat returns exactly:

```json
{
  "seat": "Typography",
  "score": 7.4,
  "findings": [
    { "id": "kebab-slug", "element": "selector + file:line context",
      "problem": "specific, measured where possible",
      "fix": "implementable exactly as written",
      "cost": 0.8 }
  ],
  "biggestWin": "the single change that would raise this seat's score most"
}
```

Zero to five findings, each costed in tenths. Scores to one decimal. There
is NO MINIMUM - see "The quota that cannot converge" below. No
hedging, no credit for effort, no guessing at other seats' opinions.

## The refuter

Every finding goes to a FRESH agent — never the seat that raised it, never
one refuter for a batch — whose only job is to kill it, and which **defaults
to REFUTED when uncertain**. The refuter opens the file and checks the
claim. Refute if any of:

- it is factually wrong about the frames or the code;
- it is already handled;
- it would violate a non-negotiable constraint;
- it is taste stated as a defect with no argument;
- the proposed fix would make the work worse;
- it restates something the gates already prove.

Confirm only if real, specific, and an improvement at the gate's bar. The
refuter may return a `sharpenedFix` when the finding is real but the fix is
imprecise. It echoes the finding id exactly so verdicts match findings.

## After the verdicts

Fix every confirmed finding before re-scoring anything (protocol in
references/method.md, including the verify-each-fix-rendered step). Record
confirmed AND refuted in `panel.json` — refuted findings with their reasons
are part of the record, and a rising refutation rate is how you recognise
convergence: the final Tasks round confirmed 4 of 35, and all four were
regressions the session itself had introduced that day.

## Execution modes

`scripts/panel-round.mjs` emits the round in one of two forms:

- **workflow** (preferred): a Workflow-tool script — Review phase fans out
  seven seat agents in parallel with the JSON schema enforced; Verify phase
  fans out one refuter per finding. Run it, collect the returned object,
  proceed to fixes.
- **prompts** (fallback, when no Workflow tool or no subagents): a
  directory of seat prompt files plus a runsheet. Run seats one at a time
  in fresh contexts if you can; if you must run them in one context, run
  them strictly in sequence, write each seat's JSON to disk before starting
  the next, and never mention one seat's output while playing another. It
  is degraded blindness — say so in the round record.

Never play the panel casually in your own voice without the protocol. The
value is the discipline, not the theater.

## The quota that cannot converge

Paid for over nine rounds of the Timeline engagement. The seat schema
used to set `minItems: 3`, so seven seats produced 33–35 findings every
round no matter how good the artifact was. The gate is the LOWEST seat,
and the lowest seat is set by the largest of that fixed supply — so the
floor could not rise however much the work improved.

The evidence, round by round:

| Round | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 |
|---|---|---|---|---|---|---|---|---|---|
| Floor | 6.2 | 6.6 | 7.2 | 7.5 | 7.8 | 8.2 | 7.6 | 8.2 | 7.2 |
| Ceiling | 7.6 | 7.4 | 8.1 | 8.3 | 8.4 | 8.5 | 8.7 | 8.8 | 9.0 |
| Findings | 35 | 35 | 35 | 35 | 35 | 34 | 35 | 35 | 33 |
| Refuted | 2 | 2 | 13 | 13 | 11 | 15 | 17 | 23 | 17 |

The ceiling — an honest read of the artifact — climbed monotonically
from 7.6 to 9.0. The floor did not, because it was measuring the quota,
not the work. Refutation rose from 6% to 66% as the quota was met with
progressively more marginal material. A unanimous 9.5 was unreachable by
construction, and would have been unreachable on a flawless artifact.

Two rules follow, and neither is optional:

1. **No minimum.** An empty findings array is a valid and expected
   answer. Say so in the BAR, not only in the schema.
2. **Stop on defects, not on the opinion-minimum.** The scores stay —
   they are how a founder reads movement — but the ENDING is mechanical:
   two consecutive rounds with no confirmed finding at or above 0.3, both
   automated gates green, on the shipping configuration only. A score
   that is the minimum of seven fresh adversarial samples is a
   measurement of how hard the panel looked, not of how good the work is.
