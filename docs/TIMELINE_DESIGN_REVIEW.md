# Signal Timeline · design review

Status: review · implementation shipped 2026-07-31 to 2026-08-02 (T·127) — see
"Implementation status" at the end for the fix-by-fix record
Date: 2026-07-31
Scope: the shared Timeline artifact (`/s/[token]`), its owner surfaces
(`/app/timeline`, edit, audience studio), the publish flow, and every
surface a shared link touches on the way to a stranger's phone —
unfurl, load, print, keyboard, screen reader.

Method: full read of `src/modules/timeline/**` and the `/s` route tree;
four parallel research passes (tokens, owner flow, publish flow, public
metadata); the app ran in demo/review mode and the Mara & Finn fixture
was rendered and measured at 360/390/620/768/900/1024/1440/1728,
printed to A4, driven by keyboard, and inspected as served HTML. Every
number below was measured in a real render, not estimated from source.

The bar, per the operator's brief: a couple shares this page with their
guests. It is an artifact — closer to a printed invitation than to a
SaaS view. It gets one first impression per viewer, usually on a phone,
usually inside a chat app, and it is the product's own advertisement
(`docs/COLLABORATION_LOOP.md`: shareable output created → new creator
discovered). "Works" is not the bar. Composed is the bar.

---

## Verdict

The bones are genuinely excellent — near award-grade in places. The
geometry model refuses to lie (`mapThroughPointDistortion` exists so
the Today dash cannot disagree with distorted point positions), the
accessibility grammar is complete in a way almost no visual timeline
ships, the bearer-link privacy stack is best-in-class, and the voice at
its best ("This link has reached its end.") is the brand's moat doing
its job.

What stands between this and world class is not taste — it is that the
artifact has not yet been finished for the days that matter most: the
wedding day clips its own headline number, the rail's ink disagrees
with its own dots, the link unfurls in the group chat with no image and
someone else's fallback copy, and the printed keepsake loses six of
nine milestone titles. Each one is beneath the standard the rest of the
work sets. The finish list below is ordered so the artifact's promise
is repaired before its polish.

---

## What already clears the bar

Name it so nobody "fixes" it away.

- **Geometric honesty.** Clustered milestones are spread by
  `collisionSafePositions`, and the Today dash is mapped through the
  identical distortion so "between those two milestones" stays true
  (`timeline-artifact-model.ts:146-175`, comment: "or the artifact lies
  about order"). Labels are granted by occupied-interval collision math,
  not truncation (`extraLabelIndices`). This is the kind of thinking
  design awards are actually for.
- **Density as a designed axis.** `empty / single / sparse / standard`
  each get their own stage geometry, and a contract test pins the CSS
  source order so density refinements always win over the generic
  mobile block (`timeline-artifact-contract.test.mjs:89-99`).
- **Load choreography without JavaScript.** The entrance runs in pure
  CSS so a no-JS or slow-JS viewer still gets content, staggered point
  pops cap at 240ms, and reduced-motion is absolute — including a
  hydration-safe wrapper around Motion's media-query hook with a test
  asserting only that wrapper may read the preference
  (`timeline-artifact.module.css:132-170`, `timeline-artifact.tsx:49-60`).
- **Interaction completeness.** Roving tabindex; Arrow/Home/End/Escape;
  `aria-current="step"`; a real `progressbar` with `aria-valuetext`;
  polite live regions for selection, metric flips, and copy results; a
  skip link inside the artifact; 48px hit targets on 8px dots; 44px
  controls everywhere else. Driven by keyboard, the whole rail works.
- **The privacy stack around the link.** Dedicated enforced CSP with no
  identity/analytics/error hosts, `Referrer-Policy: no-referrer`,
  no-store at three cache layers, noindex at header and metadata level,
  metadata containment in `/s/layout.tsx` so the operating product's
  manifest and social card cannot leak. View counting needs 2s of real
  visibility, stores only a publication-scoped hash, returns 204 for
  everything so the endpoint is never a token oracle, and the owner
  preview cannot count itself. "Previewing it never adds a view" is
  trust design done properly.
- **The owner frame honors the artifact contract.** View mode embeds
  the production component under "Owner view · the page your audience
  receives" — no miniature, no second implementation
  (`docs/TIMELINE_OWNER_ARTIFACT_CONTRACT.md` held in practice).
- **Voice, at its best.** "This link has reached its end." / "Your plan
  fills itself in." / "See the story they will see." / "Published
  deliberately. Private notes and tasks stay private." The 404 page is
  the single best-designed failure state in the suite.
- **Print exists.** One clean A4 page, controls hidden. Half-finished
  (see P1-4), but most products never start.

---

## P0 — the artifact breaks its own promise

### P0-1 · On the wedding day, the headline clips to "Toda"

When the countdown reaches the primary date, `countdownFact` renders
the value `Today` in the metric face (`timeline-artifact.tsx:107-114`).
At the standard desktop layout the value renders at
`clamp(4.4rem, 8vw, 8rem)` with `-0.08em` tracking inside a metric
column that measures **243px** at 1440px viewport — and "Today"
measures **311px**. The oversized value widens the whole metric column,
so the label clips too: the render reads "Until we" over "Toda", cut at
the artifact edge. Measured and screenshotted; not theoretical. The
same overflow grazes 3-digit day counts ("365 days") at very wide
viewports — and most weddings are booked more than 99 days out.

The one day this page will be opened the most — screenshotted, passed
around the venue — is the day it truncates.

Fix direction: the metric face must fit its box by construction, not by
hoping the value is short. Either give the word faces ("Today") their
own smaller size step, or size the numeral via container units with a
measured fallback, and make the column width a floor, not a fiction.
Acceptance: every reachable face — `0%`, `100%`, `1 day`, `365 days`,
`Today` — composed at 320→1920px and in print.

### P0-2 · The rail disagrees with itself

The ink (completed) segment is scaled by percent-of-count:
`scaleX(${model.percent / 100})` (`timeline-artifact.tsx:513`). The
dots sit at calendar-proportional, collision-adjusted positions. Two
coordinate systems share one line: in the review fixture the ink ends
at 22% while the second completed milestone — a filled ink dot — sits
near 33%, visibly stranded on the grey "not yet" rail. Reproduced on
desktop, mobile (vertical variant), and in print.

A viewer reads the black line as "the story so far." The artifact's
whole ethic is that geometry tells the truth; this is the one place it
doesn't.

Fix direction: fill to the completed frontier — the adjusted position
of the last complete point (expose it from the model next to
`todayPosition`) — so ink and dots are a single statement. Keep the
percent where it belongs, in the metric. The progressbar semantics
(`aria-valuenow`) stay as they are; this is purely the painted length.

### P0-3 · The first impression is an unfurl, and the unfurl is bare

What a guest actually sees first is the link preview in WhatsApp or
iMessage. Served HTML for the demo share, verbatim:

- `og:title` "Mara & Finn" — correct
- `og:description` "A shared couple timeline." — grammar from an enum
- `twitter:title` "timeline" / `twitter:description` "A private
  timeline shared directly by its owner." — the page sets only
  `openGraph`, so X-style consumers fall back to the layout's generic
  card and the couple's names vanish
- no `og:image`, no `twitter:image`, anywhere

The image absence is a deliberate privacy posture (`/s/layout.tsx`
zeroes the operating product's card, and rightly so) — but the answer
to "don't leak the Tasks card" is a designed Timeline card, not
nothing. A static, content-free 1200×630 — wordmark, rail motif, ink
on paper, zero user data — leaks nothing a bearer URL doesn't already
say, and turns every pasted link into the product's typography instead
of a grey text stub.

Fix direction: (1) audience-kind-aware description — "A shared wedding
timeline.", never "couple" as an adjective; (2) mirror the title and
description into `twitter` at page level; (3) ship one branded,
data-free `opengraph-image` for the `/s` tree; (4) extend
`timeline-shared-metadata-contract.test.ts` to pin the page-level
metadata too — today it pins only the layout, which is exactly why the
page drifted.

---

## P1 — below the award bar

### P1-1 · The emotional number is hidden behind an invisible toggle

For a couple's artifact the number that matters is **79 days** — but
the default face is "Milestones complete · 22%", planning-ops trivia,
and the countdown sits behind "Show 79 days left", 11px mono in
`--ink-faint`, which nothing identifies as pressable (the entire lens
is the button; nothing looks like one). Grandparents will never find
it. Default the face by audience kind — `couple` with a future primary
date opens on the countdown; the flip stays for the curious. One line
of state initialization (`timeline-artifact.tsx:149`), and the
artifact leads with its heart instead of its spreadsheet.

### P1-2 · The phone layout spends a full screen on emptiness

The vertical rail keeps calendar-proportional gaps with no maximum: in
the fixture, 2 Jan → 18 Apr is 39% of the axis, which renders as
**~380px of blank rail** between the first two milestones on a 390px
phone — a full screen of nothing before the story reaches the present,
with the next milestone (the reason the link was sent) below the fold.
The top also collides: the "Start" cap and the first label's status
line stack 12px apart and read as one garbled phrase ("Start
Complete").

Time-true spacing is the right instinct horizontally, where whitespace
reads as time. Vertically it reads as a broken page. Cap the
inter-point gap on the vertical axis (≈2× pitch) and reuse the existing
distortion mapping so Today stays honest — the machinery is already
built. Give the vertical Start/Finish caps their own clearance.

### P1-3 · Overflow with no affordance

The rail scrolls horizontally with scrollbars hidden. In compact mode
there's a right-edge fade; in the standard artifact there is nothing.
Measured at a 768px viewport: scrollWidth 756 vs clientWidth 704 —
52px of hidden content, `scrollLeft` resting at 0, the finish label
("Wedding day / 3 Oct 2026") cut mid-word with no hint that more
exists. Any timeline dense enough (≥ ~16 points at 1440px) reproduces
this on desktop. Port the compact fade and proximity snap to the
standard artifact, shown only when scrollable.

### P1-4 · Print is a keepsake that forgets its own content

The A4 render is one clean page — and it prints "Show 79 days left"
(an instruction to click, on paper) while **six of nine milestones
print as anonymous dots**, because extra labels are gated to ≥980px
containers and print is ~740px, and paper has no hover. For the
artifact-as-object story, print is not an edge case; it is the fridge
door. In `@media print`: hide the metric's alternate line, surface
both faces statically (percent and countdown), and label every point —
if the horizontal rail can't fit the labels, print the vertical
layout. The decisions fold staying hidden in print is correct; keep
that.

### P1-5 · "Share this timeline" doesn't share, and failure is silent

The header action copies the URL (`shared-timeline-artifact.tsx:19`).
On the phones this artifact lives on, the expected verb is the share
sheet — `navigator.share` with clipboard fallback. The error state
exists only as a screen-reader announcement; the visible label never
changes on failure (`timeline-artifact.tsx:283-299`), so a sighted
viewer whose clipboard write was blocked sees nothing at all. And
"Link copied" never returns to rest. Small state machine, large trust
surface: share sheet where available, visible "Couldn't copy — hold
the address bar" fallback, revert after ~2s.

### P1-6 · The growth loop dead-ends at a non-link

`docs/COLLABORATION_LOOP.md` ratifies the loop: shareable output
created → **new creator discovered**. The artifact's only attribution,
"A Signal Studio product", is inert text (`timeline-artifact.tsx:680`).
The hand-built marketing facsimile at `/the-wedding` links "Made with
Signal Timeline"; the real artifact — the one actually in guests'
hands — links nowhere. Make the footer attribution a quiet link to the
Timeline marketing page with a source parameter. The `/s` tree already
sends `Referrer-Policy: no-referrer`, so the bearer URL cannot leak
through it.

### P1-7 · Enum grammar leaks into the artifact's mouth

- Kicker for the default kind: **"A shared module timeline"** — campus
  vocabulary. Every non-wedding owner preview defaults to `module`
  (`owner-artifact.ts:76-78`), so a bakery's timeline introduces
  itself with a word from a university syllabus.
- Meta description: "A shared couple timeline." — kind used as an
  adjective.
- The publish form defaults `audienceKind` to **Class** — in a product
  whose ratified wedge is weddings (`audience-manager.tsx:260-264`).

One vocabulary decision fixes all three: a neutral default register
("A shared timeline" / "A shared project timeline"), per-kind wording
where a kind is chosen, and the publish default derived from the
workspace template (wedding template → Couple).

### P1-8 · The flagship template produces a countdown-less artifact

`wedding-planning-workspace` ships 8 milestones with **no dates**
(`templates.generated.ts`), so a new venue's first artifact has no
anchor, no Today dash, no countdown, ordinal spacing — none of the
product's signature moves. The founder-approved fixture everyone
reviews is dated and gorgeous; the first-run reality is flat. Ask for
the wedding date at template instantiation (it is the one date every
couple knows) and offset the template milestones from it, the way the
anchor concept (`lib/roadmap/anchor.ts`) already frames the plan as
pointed at one day.

---

## P2 — polish

1. **Detail panel says "next milestone" three times.** Eyebrow status,
   canned note ("This is the next point on the shared journey."), and
   "Place in the plan: Our next milestone" are one fact thrice. Make
   the facts earn the panel: "Milestone 3 of 9", relative timing
   ("in 16 days"), and cut the filler sentence
   (`timeline-artifact.tsx:320-377`).
2. **"1 planning decision" doesn't look expandable.**
   `display: inline-flex` on the summary removes the disclosure
   marker, and the artifact's `<details>` has no fold motion (the
   ratified `tl-fold` is module-scoped, and the artifact correctly
   doesn't import module CSS — so give it its own). Underline register
   plus a chevron, and the respectful cancelled-items idea starts
   getting found (`timeline-artifact.module.css:756-791`).
3. **Today's chip has no collision plan.** Point labels negotiate
   space; the Today chip doesn't (z-index 3 under labels' 4, paper
   background punching out whatever it lands on). Near-miss in the
   fixture; guaranteed hit for a today adjacent to an above-side
   label. Give Today the same interval treatment labels get.
4. **The exhibition type register is real — ratify it.** The artifact's
   display voice (`h1` 7.7rem / −0.065em / 0.88; metric 8rem / −0.08em
   / 0.7; detail h3; milestone strong) sits outside the system's nine
   steps, and the same clamps are re-typed in
   `artifact-studio.module.css` and `/s/[token]/not-found.tsx`.
   Tokens.css says "Nine named steps. No tenth" — and no module uses
   the ratified display steps at all, which means the mandate has
   drifted from practice suite-wide. Name the artifact tier
   (`--x-artifact-display`, `--x-artifact-metric`, paired
   leading/tracking) in one place; three files stop copy-pasting a
   register.
5. **Names are the headline; load the glyphs.** Fonts ship
   `subsets: ["latin"]` only (`layout.tsx:11-18`). "Zoë & Séan" holds;
   "Łukasz & Zofia" falls back to system glyphs mid-h1. Add
   `latin-ext`.
6. **Owner state honesty, three small cuts.** Revoke links / Unpublish
   are one-click with no confirmation (`audience-manager.tsx:421-455`);
   the manager card still says "Link live" after every link is revoked
   (state stays `published`; the studio computes liveness correctly,
   the list doesn't); link expiry is computed end-of-day **UTC**, not
   the publication's timezone (`actions/audience-timeline.ts:78-81`) —
   a Dublin link "expiring 3 Oct" dies at 00:59 on 4 Oct.
7. **Completed milestones are struck through in the editor.** "We said
   yes" with a line through it reads as retracted, not achieved — the
   lane header already says Complete. Weight or tint, not
   strikethrough (`curation-surface`).
8. **Small owner-flow burrs.** Switching projects drops edit mode
   (`project-switcher-model.ts:11-31` doesn't carry `mode`); the
   anchor countdown chip is hidden below `lg` so phone owners never
   see T-79; the `/s` loading skeleton uses `aria-label` where the
   owner loading contract standardized `role="status"` +
   `aria-live="polite"`, and opens with a full-ink rule the real
   header doesn't have.

---

## P3 — craft debt

The brief was "feels slaved over." Dead code and stale governance read
as the opposite under any close inspection.

- **The artifact's design contract is off the gate and currently
  red.** `timeline-artifact-contract.test.mjs` — the file that pins
  the locked identity, the no-fetch rule, the keyboard grammar, the
  density ordering — is wired into neither `pnpm test` nor any
  workflow, and fails 2/9 today: the identity test trips on a code
  comment that names StudioBar (`timeline-artifact.tsx:66-72`), and
  the embed assertion predates `showProductHeader={false}`
  (`plan/[projectSlug]/page.tsx:295`). Update both assertions, wire
  the file into `test:timeline-owner`, and the strongest governance
  idea in the module starts governing again.
- **Orphaned surfaces.** `modules/timeline/home.tsx`, `app/error.tsx`,
  `app/loading.tsx` are unreachable (the mounts import elsewhere);
  `AnchorSentence`, `lib/onboarding/personalization.ts` (whose empty
  -state copy is silently duplicated by hardcoded strings),
  `lib/roadmap/shared-update.ts`, and `currentState` have no
  importers; `format.ts` carries a dead `revoked` publication-state
  branch. Delete or wire in — either is fine; limbo isn't.
- **Stale design records.** `CLAUDE.md` says tokens live in a
  `ds-foundation` npm package — the truth is vendored
  `src/ds/tokens.css` (signal-design-system@2.0.1). `docs/brand.md`
  still documents the pre-SDS warm-stone palette and is Tasks-scoped;
  the artifact's own register (this suite's most public typography)
  is documented nowhere.
- **`timeline.css` details.** References legacy aliases
  `--bg-deep`/`--bg-elev` (only Timeline file still doing so);
  hardcodes `400ms` where `--motion-slow` is that exact value; the
  1.4s shimmer sits off the four-duration scale.

---

## Definition of done for the artifact

The artifact ships world class when every cell of this matrix is
*composed* — deliberately laid out, not merely not-broken:

| Axis | Cells |
|---|---|
| Metric face | 0% · 22% · 100% · 365 days · 12 days · 1 day · **Today** · past-date (no countdown) |
| Density | empty · single · sparse · standard · 20+ milestones |
| Width | 320 · 390 · 620 boundary · 768 · 1024 · 1440 · 1728 |
| Mode | standalone · compact (phone preview) · embedded (owner view) |
| Medium | screen · **print A4** · **link unfurl** (OG + Twitter) · reduced motion · keyboard only · screen reader |
| Titles | fixture-length · 120-char wrap · extended-Latin names |

Suggested order: P0-1/2/3 before the next real link is shared; P1-1
through P1-4 next (they are what a guest actually touches); P1-5
through P1-8 with the following cycle's owner work; P2/P3
opportunistically alongside.

---

## Implementation status · 2026-07-31 (dispatched as T·127)

Shipped in the same cycle as the review:

- **P0-1 fixed.** Metric faces declare width classes
  (`metricValueScale`); "Today" measures 218px in the 243px column at
  1440 (was 311px, clipped to "Toda"). Verified at 320–1728 and print.
- **P0-2 fixed.** `completedFrontier` / `completedStackFrontier` in the
  model; the ink is drawn to the furthest completed dot on both axes.
  Contract-pinned.
- **P0-3 fixed.** Data-free Geist OG card at `/s/[token]/opengraph-image`
  (it must live in the page's own segment — a parent-segment card is
  dropped by the page's `openGraph` object); per-kind descriptions;
  twitter parity. Contract extended to pin all three.
- **P1-1..P1-7 fixed.** Countdown default for couples; vertical gap cap
  via `capStackGaps` riding the existing distortion mapping; edge fades
  + proximity snap driven by real scroll state; print index page +
  static both-facts line; share sheet with visible failure and resting
  receipts; footer attribution links via `PRODUCT_MARKETING_URLS`;
  viewer vocabulary everywhere ("A shared project timeline", owner
  picker says "Project", publish default derives from the workspace
  template).
- **P1-8 shipped in the closing pass** (see below). It did need the
  studio-side source; that is where it was fixed.
- **P2 shipped:** detail facts ("Milestone 3 of 9", relative timing);
  decisions disclosure affordance + fold; Today chip collision handling
  (below-side flip, stacked nudge); `--x-artifact-*` display register
  ratified in `globals.css` and consumed by artifact, studio, 404;
  `latin-ext`; owner two-press confirms; honest "Links revoked" label;
  publication-midnight expiry (`endOfCalendarDayInZone`, DST-tested);
  strikethrough removed from settled titles; mode carried by the
  switcher; anchor chip visible from `sm`; `/s` loading `role="status"`.
- **P2 deferred at the time:** dot-echo cores in the detail panel
  eyebrow (the ring echo stands); metric register wording beyond the
  print line. Both shipped in the closing pass below.
- **P3 shipped:** artifact contract test repaired (the identity
  negative-match now passes because the artifact stopped naming
  suite chrome), extended (frontier, metric scale, print, fades,
  attribution), and wired into `test:timeline-owner` with the model
  test; orphaned `home.tsx` and dashboard-era `app/loading.tsx`
  deleted; the module error boundary is mounted at
  `src/app/app/timeline/error.tsx`; `timeline.css` sheds legacy
  aliases and off-scale durations; `CLAUDE.md` names the vendored
  token truth; the format helper's `revoked` branch is no longer dead
  — the manager uses it.
- **P3 deferred at the time:** unused `AnchorSentence`,
  `personalization.ts`, `shared-update.ts`, `currentState`;
  delete-or-wire was left open. Closed in the pass below. (The note that
  "each has tests or documented future intent" was itself too
  generous: only `currentState` had a test, and only `shared-update.ts`
  had intent recorded outside its own docstring.) `brand.md` staleness
  remains open — it is a Tasks-owned doc.

## Elevation pass · same cycle (good → great)

The operator's brief after the first ship: "good, not great." The gap
was information density done quietly — the rail asserted positions but
gave the viewer no calendar to read them against — and three places
where the composition still had slack.

- **Month cartography.** `monthBoundaries()` in the model emits
  first-of-month ticks strictly inside the axis span, mapped through
  `mapThroughPointDistortion` — the same piecewise mapping the points
  and the Today chip ride, so the calendar and the dots cannot
  disagree. Spans of >14 months thin to quarters, then to Januarys;
  January is labelled `Jan ’YY`. The view renders each tick as a
  1px×0.5rem ink-ghost hairline under the rail with a 0.625rem mono
  uppercase label; labels yield (`data-quiet`) within 3 points of the
  Today chip and 4 of the rail's edges, and a greedy pass marks labels
  <4 points from the last-labelled tick `data-tight` — hidden below
  980px container width, which is what saves the print sheet from
  MAY/JUN garble. The stacked phone rail keeps the tick rhythm,
  drops all text. Model-tested (ordering on both axes, between-ness
  against distorted points, en-GB "Sept", multi-year thinning, undated
  → none) and contract-pinned (ticks come from the model — `new
  Date()` is banned in the view).
- **Composition.** The journey now meets the frame at
  `clamp(--space-6, 3.5vw, --space-8)`; planning decisions sit
  full-width under a soft top rule with a rotating `+` marker; the
  milestone detail closes at `--space-8` so the last line lands
  instead of stopping.

Deferred from this pass, named honestly: template dates (P1-8,
studio-side), the four unused-library deletions, and the advisory
council's two open journey items. The first two are closed below. The
journey items stay open, because they require real journey evidence and
that is not fabricated.

## Closing pass · 2026-08-02

Nothing here is new scope. It is this review's own open list, emptied.

- **P1-8 · the flagship template points at a day.** The canonical studio
  template declares an anchor (`label`, `prompt`, `hint`) and each of its
  eight milestones carries `anchorOffsetDays`, counted back from the
  wedding day: −300 at booking, −150 for room layout, −45 / −30 / −25
  through headcount, suppliers and catering, then −6 / −4 / −2 for the
  week itself. `createWorkspaceAction` asks for the day when the chosen
  template declares one, validates it as a real calendar day, and
  `seedWorkspaceFromTemplate` materializes every offset into a
  `targetDate`. A venue's first artifact now opens with a countdown, a
  Today dash, and real calendar spacing instead of flat ordinal order.
  The date stays optional: left blank, the workspace seeds exactly as it
  did before. One limit, stated rather than implied: nothing in this repo
  asks the question yet. `createWorkspaceAction` is the only path that
  seeds a timeline from a template and it has no in-repo caller, so the
  template, the resolver and its tests are what ship here; the field that
  asks belongs with whatever surface finally mounts that flow. Offsets are UTC calendar days, so no local timezone can
  move a milestone across midnight on the way in. Pure and tested in
  `lib/template-anchor.ts` — seven cases, including leap-day and
  month-boundary shifts, and a guard that the flagship template dates all
  eight milestones in ascending order with none landing on the day
  itself.

- **The generator now generates what it claimed to.**
  `src/modules/timeline/lib/templates.generated.ts` carried the
  "Refresh: pnpm sync:templates" banner while no script wrote it, so the
  milestone seeds could drift from studio in silence.
  `scripts/sync-templates.ts` emits both slices now. The Tasks slice
  regenerated byte-identical, which is the proof that the generator
  matches what had been maintained by hand.

- **P2 · both faces state both facts.** The countdown face carries a
  receipt ("2 of 9 settled"), so a couple's artifact, which opens on the
  countdown, no longer hides the progress fact behind a press. Paper
  already printed both; the screen owed the same completeness.

- **P2 · the detail echo is size-true.** The status echo reproduces the
  rail's three diameters (0.55 / 0.64 / 0.88rem), not only its colours.
  Size is what separates a settled bead from the mark that is next. An
  echo that flattened every state to one diameter named the state in
  words and contradicted it in form.

- **P3 · delete-or-wire, closed.** `AnchorSentence` deleted: the shared
  artifact answers "how far out is this" with its own metric face, and a
  second plain-English countdown states the fact twice in two voices.
  `countdownPhrase`, orphaned by that deletion, went with it rather than
  becoming the next orphan. `shared-update.ts` deleted: it modelled a
  `/[workspace]/update` page that was never built, and the `/s/<token>`
  artifact is the travelling object it wanted; `COLLABORATION_LOOP.md`
  records the retirement. `currentState` deleted with its test: it was
  written as the public page's verdict line, but the audience DTO
  deliberately collapses `waiting` into `now`, so that verdict cannot be
  derived on the public surface without reopening the publication
  boundary, and the artifact already answers the question it asked.
  `needs-attention.ts` stays — it is live in the curation surface, which
  the earlier note missed. `personalization.ts` wired: the Timeline empty
  state reads its copy from the module instead of paraphrasing it, so a
  venue that started from the wedding template is met in wedding words.

## Appendix · reproducing the evidence

- Demo render: `NEXT_PUBLIC_DEMO_MODE=true pnpm dev`, then
  `/s/DemoAudienceTimelineToken2026Fixed000000000` (fixture: Mara &
  Finn, today pinned to 2026-07-16, wedding 2026-10-03).
- "Toda" clip: switch the lens to countdown, set the metric value to
  `Today` (or pin `reviewToday` to `2026-10-03`); at 1440×900 the
  value box measures 311px inside a 243px column.
- Rail overflow: 768×1000 viewport → `scrollWidth 756`,
  `clientWidth 704`, `scrollLeft 0`.
- Ink-vs-dot disagreement: visible in the default fixture at every
  width; ink ends at 22% of the rail, second completed dot ≈33%.
- Unfurl: `curl -s <share-url> | grep -o '<meta[^>]*\(og\|twitter\)[^>]*>'`.
- Print: Chromium print-to-PDF, A4 portrait, default margins.
- Contract baseline: `node --test
  src/modules/timeline/components/artifact/timeline-artifact-contract.test.mjs`
  → 7/9 pass on this tree; the file appears in no test script.
