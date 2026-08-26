# Elevation brief · Lately

The analytics view inside Signal Studio's authenticated Home, at
`/app/home/analytics`. Home has a present tense (Today's Signal) and a today
tense (the Full Briefing). This is the past one.

Written from `Signal-Analytics-ELEVATE-PROMPT.md` (2026-08-26) and corrected
against what the repository actually contains. Every correction is recorded
below as a fold rather than made silently.

---

## Target

One owner, one Project, looking back over twelve weeks to answer one
question: **am I actually getting on top of this, or just busy?** Behind it:
what has quietly slipped while I wasn't looking, and is this stretch better
or worse than my normal.

## Audience

A venue owner, wedding planner or small-studio operator — the 80% not in
tech, who has never used a project-management tool and must read this
unaided (`docs/FIRST_CONTACT_TEST.md`).

## Register

**Marks and numerals carry the reading. Copy is labels, one short line per
tile, and the tooltip that names a mark.** The first version of this surface
was written as an editorial briefing and the operator rejected it outright:

> "there is too much text/copy to read… i want a beautiful, delightful
> analytics page that is visually impressive and useful. steer away from the
> written report style… the text here is the noise for me but the beautiful
> graphs and animations and the kpi cards/cards are the signal."

Binding, and to be pushed further than the current prototype does. If a
seat's finding is "add an explanatory sentence", the finding is usually
wrong and the composition should carry it instead.

Voice rules never bend: plain English, active verbs, no exclamation marks,
the banned-words list in `studio/BRAND.md` §3. The company name is never
shortened to "Signal" (`docs/SUITE_URL_AND_NAMING_CONTRACT.md`).

The workspace design register governs: *reach further than feels safe in
exploration; restraint is the edit at the end, never the brief at the start.
Priority order, permanent: creativity and emotion outrank restraint.*

## Fixture — and the first fold

The brief as handed over named the fixture "The Orchard, events · the Mara &
Finn wedding" **and** required the numbers to be re-derived from
`src/lib/project-truth-fixture.ts` so the lab and the product cannot drift.
Those two instructions conflict: no Orchard and no Mara or Finn appear
anywhere in that fixture, or anywhere in the repository.

**Fold, taken 2026-08-26:** the fixture wins. The surface now reads
**Harbour House weddings**, the reference Project (`PROJECT_TRUTH_IDS.
harbourHouse`, role primary-owner), owned by **Orla**
(`PROJECT_TRUTH_ACTOR.name`), at **09:14, Thursday 16 July 2026**
(`PROJECT_TRUTH_TODAY`). An invented venue makes every reading the lab
produces unfalsifiable, which is the exact defect the re-derivation was
asked for.

`derive-fixture.mjs` binds four facts and fails the build on drift:

| Bound | Source |
|---|---|
| reading date | `PROJECT_TRUTH_TODAY` |
| owner | `PROJECT_TRUTH_ACTOR.name` |
| workspace name | the harbourHouse summary's `name` |
| open-work denominator (9) | that summary's `activeRootTaskCount` |

and the first three open jobs are its `rootTaskTitles`, verbatim.

**What is honestly not bound.** The fixture is a Project catalogue. It
records no completion instants and no per-task ages, so twelve weekly
completion counts, nine job ages and the four status counts **cannot** be
derived from it and are lab-authored. They are marked `labAuthored` in
`fixture.js` and the derivation refuses to emit a status count larger than
the denominator. Inventing a derivation would have been the same defect in
better handwriting.

## States

Seven, all designed, all graded: `full · partial · quiet · first-run ·
empty · loading · error`. On a young account the degraded states are most of
the real screen time, so they are designed states, not error states.

## Materials

The Signal DS verbatim. Paper `#ffffff` / `#fafafa` / `#f4f4f5` · Ink
`#111111` / `#3f3f46` / `#71717a` / `#d4d4d8` · Indigo `#4f46e5` ·
hairlines `rgba(17,17,17,0.10)` and `0.055`. Geist and Geist Mono.

**Second fold:** the brief asked for weights 400/500/600. Only
`Geist-Regular`, `Geist-SemiBold` and `GeistMono-Regular` exist as woff2 in
this estate, so a declared 500 renders as a synthesised 400 — a weight
nobody chose. Folded to **400/600**, and `elevate.config.json` enforces it.

**Third fold:** the dark twin needs grounds the light lock does not carry.
`#0f0f10`, `#18181b` and `#27272a` are added as declared members of the
lock, together with indigo 400 `#818cf8` and zinc 400 `#a1a1aa`, each with
its job written beside it in `lock.md`. Nothing is added for taste.

## The chart colour rule — inherit, do not re-derive

Measured, in `plan.html` §05, and enforced by `scripts/validate_palette.js`:

- **Identity is never carried by hue.** The ink ramp fails the validator's
  chroma floor on all four steps (0.005–0.014 against a 0.10 floor), so a
  categorical palette inside a three-colour lock is not available. Identity
  is position and direct label.
- **Magnitude is one hue** — indigo sequential, usable from indigo 500 up.
- **Emphasis is one indigo mark against zinc context** — ΔE 20.1 protan.
- **Status is a reserved four in fixed order** amber `#d97706` → indigo →
  red `#ef4444` → emerald `#059669`, always with its word and its own
  shape. Red adjacent to amber fails CVD separation at 4.4, which is why
  the order is load-bearing.
- All four status colours fail AA as small text on paper (3.24, 3.76, 3.55).
  **They are mark colours only; their words are ink.** That is not a
  compromise of the rule, it is the rule.

## Decided — inherit, do not re-explore

- The route, the name and the place: `/app/home/analytics`, tab **Lately**,
  a tab strip beside Today's Signal and the Full Briefing. No rail icon, no
  wordmark, no marketing page.
- The question, and the three movements.
- The metric set. Seven real-now metrics used, two named as refusals, four
  cut. The table is `plan.html` §03. **A seat may not propose a metric that
  is not in that table.**

## Protected — elevate with a scalpel

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

## Open — the actual exploration

Everything visual. Composition and rhythm of the three movements; whether
five KPI cards is the right count and shape; **the chart forms themselves**
(the twelve-week columns and the ages strip are the current answer, not the
only one — argue better ones with the `dataviz` form heuristic); the motion,
where delight is the explicit ask and every candidate gets an
animate-or-restrained verdict; the dark twin, never yet looked at; and the
phone at 390 as a first-class composition rather than a reduction.

## What binds

`ds-foundation/tokens/tokens.css` is vendored — additive `--x-` tokens only.
The URL and naming contract. Voice rules. The first-contact test. **Note
bodies and email never enter this domain.**

## Out of scope

The port into `src/` — the engagement hands over a port packet and does not
land pixels. The plan document. The metric set and the data layer. Notes,
Tasks and Timeline.

---

## The ending, and the budget

**Budget: 3 rounds**, declared 2026-08-26 before round one, at the
operator's instruction.

**The ending is the ledger, not a score** (`references/stopping.md`): two
consecutive rounds with no confirmed `blocking` or `misleading` finding,
both gates green, on a frozen shipping configuration, with the
self-inflicted rate under 25% in both. Scores are recorded every round and
gate nothing — seven blind seats on one artifact disagree with SD 0.335, so
a unanimous 9.5 needs true quality of 9.94 to pass half the time.

With a three-round budget the ledger can close at round 3 at the earliest,
and only if rounds 2 and 3 are both clean. If the budget runs out first,
the engagement stops anyway and publishes the honest distance.

**Benchmarks, named verbatim to every seat, not moved mid-engagement:**
**xAI / Grok** and **SpaceX** for dense, technical, confident instrument
readings, plus **Linear, Stripe and Vercel** as the standing suite bar.

**Seats have no quota.** An empty findings array is the expected answer for
a finished surface.

## Who owns the port

Nobody yet. Three engagements, forty-five rounds, 1,358 findings, 919 fixes
— and **zero shipped pixels**. A lab master at the bar is not a shipped
product. This engagement ends with a port packet that a separate build
session lands, and the operator has been told so before round one rather
than at round twelve.

## Delivery

Branch `design/home-analytics-2026-08`, lab
`docs/design/labs/home-analytics-2026-08/`. The two published URLs in the
handover prompt are republished every round, never replaced, plus the
Design Console and the Elevation Log. The branch pushes every round.
