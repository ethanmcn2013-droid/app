# Timeline · world-class redesign

Branch `timeline/world-class`, worktree `_wt-timeline-wc`, cut from `origin/main`
at `15b08a3` (T·133, the suite-link fix) so the dead-end repair is carried in.

Status: Phase 1 audit. Architecture mapped; data-model, publication and
design-system audits in flight. Nothing implemented yet.

---

## 1. What the audit changed about the brief

Two findings move the redesign away from what the assignment assumed.

**There is one artifact implementation, not two.**
`src/modules/timeline/components/artifact/timeline-artifact.tsx` (922 lines,
every sub-piece inline) plus `timeline-artifact.module.css` (1,556 lines) is
instantiated in four places, differentiated only by props:

| Surface | Call site | Props |
|---|---|---|
| Owner "View timeline" | `app/plan/[projectSlug]/page.tsx:298` | `embedded showProductHeader={false}` |
| Artifact studio | `app/audience/artifact-studio.tsx:91` | `embedded` |
| Phone preview | `components/artifact/timeline-phone-preview.tsx:34` | `compact` |
| Public `/s/[token]` | `app/audience/shared-timeline-artifact.tsx:41` | neither — plus `onShare` |

Owner and public already share the component and the DTO
(`ownerProjectToTimelineDto`, `lib/owner-artifact.ts:85`). So section 9's
"separate the surfaces" is **not** a rebuild — it is a props-and-chrome problem.
The risk runs the other way: any change to this file changes all four surfaces
at once, so every edit needs testing against all four.

**The publish model is real, and the assignment's fallback copy would lie.**
Owner edits write to `nodeOverlays`/`tasks` and revalidate only
`/app/timeline*` — never a public path. The public artifact reads *frozen*
`audience_publications` rows. Editing a milestone therefore does **not** change
any live link until a separate publish/update action runs.

So the truthful Share vocabulary is `Draft` / `Published` / `Changes not
published`. "Live · changes appear immediately" would be false here, and
section 12's permission to use it must not be taken.

## 2. Why one milestone overflows the viewport

Not one fixed height — a stack of independent minimums that never contract,
none of which is derived from how much content a milestone actually has:

| Selector | Value | Source |
|---|---|---|
| `.artifact` | `min-height: 100dvh` | `timeline-artifact.module.css:7` |
| `.timeLens` | `min-height: 12.5rem` | `:230` |
| `.metricViewport` | `height: clamp(8.25rem, 11vw, 10rem)` | `:251` |
| `.stage` (single density) | `min-height: clamp(15rem, 20vw, 18rem)` | `:1398` |
| `.detail` | `min-height: 10rem` | `:807` |

`.timeLens` + `.stage` + `.detail` alone floor the artifact at roughly 40.5rem
(~648px) of *minimums* before the hero, the owner header, or the footer are
counted — and `.artifact` separately demands a full `100dvh`. That is the
mechanism behind the reported one-milestone overflow.

Two mitigations already exist and should be built on rather than replaced:

- `artifactDensity()` (`timeline-artifact-model.ts:170`) already classifies
  `empty` / `single` / `sparse` / `standard` and is emitted as `data-density`.
  The hooks are there; the values are simply still too large.
- `[data-embedded]` and `[data-compact]` already neutralise
  `min-height: 100dvh` (`:1023`, `:1030`). Note the consequence: the **public
  route is the only surface where the 100dvh floor still applies**, so the
  sparse-state bug is worst exactly where the audience sees it.

## 3. Preview and Share are not what their label claims

`Preview and share` (`plan/[projectSlug]/page.tsx:168`) navigates to
`/app/timeline/audience` — `AudienceManager`, a management list. It previews
nothing. Reaching a rendered artifact takes two further clicks via "View
artifact studio". The button is a router, not a preview.

The studio and phone previews do render the production component rather than a
mockup, but they diverge from the public page in three observable ways: they
neutralise the `100dvh` floor, they omit the Share button (gated on `onShare`),
and they omit `QualifiedViewTracker` so a preview never counts as a view. The
third is correct and must be preserved. The first two are drift, and section 21
requires preview to match the real public surface.

## 4. Copy defects located

| Rendered string | Source |
|---|---|
| `Milestones complete` | `timeline-artifact.tsx:107` |
| giant value / detached `%` | `:108` / `:109` |
| `N of N settled` | `:110` (`progressFact`), reused at `:125` |
| `Start` / `Finish` caps | `:797-802`, label logic `:629-635` |
| `Project timeline` (uppercased) | `plan/[projectSlug]/page.tsx:123` |
| `Owner view · the page your audience receives` | `:294`, view mode only |
| `View timeline` / `Edit milestones` | `:145,153` / `:157,165` |
| `Preview and share` | `:170,173` |
| `Updated …` / `Made with Signal Timeline` | `timeline-artifact.tsx:906-918` |

The giant digit is `--x-artifact-metric: clamp(4.4rem, 8vw, 8rem)`
(`globals.css:184`).

## 5. Measured baseline (current code, review mode, port 3520)

**Corrected.** I originally recorded the nine-milestone fixture as measuring
1.00 at both 1440×900 and 390×844, and concluded the dated multi-milestone
case was healthy. That was wrong, and wrong in a way that would have
under-scoped the work.

I measured `/app/timeline` — the **owner** route, which passes `embedded`, so
`min-height: 100dvh` is neutralised and the content sits inside the app
shell's own scroll container. The public `/s/[token]` route is the only
surface where the floor still applies, and there the same fixture measures
**1.256** at 1440×900.

Real numbers, taken from the live public route and reproduced by a calibrated
harness (nine-milestone fixture, before the Phase 4 work):

| Viewport | Content height |
|---|---|
| 1920 × 1080 | 1131 |
| 1600 × 900 | 1131 |
| 1440 × 900 | 1130 |
| 1280 × 800 | 1082 |
| 390 × 844 | 1937 |

Lesson, same shape as §6: measure the surface the defect is reported on, not
the one that is convenient to open.

Also confirmed in the rendered DOM: the milestone list renders **twice**, and
the current milestone a **third** time in the detail panel (section 16's
duplication defect), and `settled` reaches the screen.

## 6. Fixture drift — retracted, this was my error

I originally recorded that the Timeline demo data and the suite fixture
disagreed about the venue name. That was wrong, and the correction matters
because acting on it would have broken passing tests.

On this branch both `lib/review-suite-fixture.ts` and the Timeline demo data
say **"The Orchard, events"**, and the file is pristine at `15b08a3`. The
"Glenmara House" reading came from the `app/` checkout, which is 41 commits
behind main — a branch difference, not drift between two fixtures.
`docs/WORLD_CLASS_PRODUCT_PASS.md` (2026-08-03) settles it: *"Canonical story
on this base: The Orchard, events… (the phase-1 tree's 'Glenmara House' was
the stale name)."*

`owner-artifact.test.ts:170` and the Playwright switcher spec both pin "The
Orchard, events" and a count of exactly three authorised weddings. **Leave the
venue name alone**; there is nothing to reconcile.

Lesson for the rest of this work: verify a claim against *this* worktree before
recording it. Three checkouts of the same repo sit side by side here at
different commits.

## 7. Data model — what it will and will not support

**There are no project start or finish date columns.** `projects` carries
`workspaceSlug, slug, name, oneLiner, accent, sortOrder, publishedAt,
sourceTasksWorkspaceId` and nothing else. The nearest things are
`timeline_publications.primaryDate` — a single headline date such as "Wedding
day", living on the publication rather than the project — and a separate,
explicitly non-persisted "anchor" derived for the countdown chip
(`lib/roadmap/anchor.ts`). Those two use different selection rules and can
disagree.

This directly contradicts section 7.1, which defines dated mode as requiring
"a real project start date" and "a real project finish date". Those fields do
not exist. **Decision: derive the axis domain from the milestone dates
themselves** — earliest dated milestone to latest dated milestone (or to
`primaryDate` when it is later) — rather than adding columns and a
date-entry UI that the assignment never asked for. Dated mode therefore
becomes available when at least two milestones carry real dates and every
plotted milestone has timing; the caps then show real dates, which is what
section 7.1 actually cares about. Adding `startDate`/`finishDate` columns
stays open as a follow-up if owners later want to set a frame explicitly.

**Milestones carry a single date or no date. Never a range.** Every timing
column is one nullable `YYYY-MM-DD` text field. `node_overlays.date_override`
is three-valued through a sentinel: `null` = inherit, `UNDATED` = explicitly
undated, otherwise the date. Section 7's "date ranges" are not buildable and
are dropped.

**Order is genuinely independent of timing.** `tasks.sortOrder` snapshotted at
sync, overridden by `node_overlays.sortOverride`, resolved independently of any
date logic. Ordered mode has a real column to stand on.

**`settled` is not a concept.** No column, no enum member. The word appears in
three unrelated senses: complete-only in the artifact receipt, shipped-or-
refused in two doc comments, and a drag-landing animation flag in the curation
surface. Removing it from the UI costs nothing.

**Progress** excludes cancelled milestones from both numerator and denominator,
and hidden milestones are filtered upstream before the model sees them. The
calculation is sound; only its presentation needs work.

## 8. The halfway-placement bug, exactly

`calendarPositions()` has two distinct paths that both fabricate a position:

1. **No milestone anywhere has a date** → `ordinalPositions()`, which returns
   literally `[50]` for a single item. Dead centre of the rail, no calendar
   meaning at all.
2. **Some other milestone has a date** → `interpolateUndatedPositions()` places
   an undated item at the arithmetic midpoint between its nearest dated
   neighbours; at the ends it defaults to rail edge `0` or `100`.

In both paths the dot is drawn with a precise `--timeline-position: NN%` —
full positional confidence — while the caption beneath reads "Timing not set".
The model invents the position and leaves the caption to disclose that the
position is meaningless. That is the defect in section 7, and it has two
triggers, not one. Both must be fixed.

## 9. Overdue is derived twice, and the public rail under-reports it

- Owner curation (`needs-attention.ts`): **any** unfinished milestone past its
  date is overdue.
- Public rail (`timeline-artifact-model.ts`): `isOverdue = isNext && …` —
  **only the single "next" milestone can ever be overdue.** Every other
  unfinished, even badly overdue, milestone renders as plain "upcoming".

Section 14.1 requires truthful overdue states, so the public rail's derivation
is wrong and will be corrected to match the owner's. Note this changes what
audiences see on existing published timelines.

## 10a. Resolved: the second publishing mechanism is dead

`publishWorkspaceAction` / `unpublishWorkspaceAction` have **zero callers**
anywhere in `src`, `e2e`, `scripts` or `experience`, and no route in this app
matches a bare `/{workspaceSlug}` page. System B is vestigial. The section
below stands as the record of why it was suspected; the conclusion is that
**Mechanism B is the only real publish model**, and the Share vocabulary in
section 1 is correct.

Worth raising separately with the founder: whether that dead code should be
deleted rather than left to confuse the next audit.

### The share model, stated exactly

Publishing **mints the link in the same transaction**. You cannot publish
without producing a link, and you cannot get a link without publishing.

Published does **not** mean reachable. Revoking kills every active share
without changing `state`, leaving a row that still reads `published` with no
working link. The owner UI already computes the honest version:

```ts
const linkLive = publication.state === "published" && publication.activeShareCount > 0;
```

All Share copy must key off `linkLive`, never the raw `state` column.

**Vocabulary already exists** in `lib/format.ts` — reuse it, do not invent:
`Link live` / `Private draft` / `Unpublished` / `Links revoked`.

**What sharing genuinely supports:** bearer link with no login, optional
calendar-date expiry in the publication's own timezone, rotation (invalidates
all prior links), revocation, unpublish. **What it does not support, and what
no copy may imply:** passwords, invite-only or named recipients, view limits,
per-link visit counts (those columns exist, are never written, and a test
enforces that they stay empty), bulk "publish changes", or any real-time push
to an already-open guest tab.

Divergence is per item: when a source milestone changes after publication the
frozen copy stays put and only gets a `divergedAt` flag. There is no bulk
"publish changes" action, so "Changes not published" must be expressed per
milestone, not as a global banner.

## 10b. The owner-view caption is not just long — it is untrue

`mode=view` captions itself "Owner view · the page your audience receives",
but it renders `ownerProjectToTimelineDto(projectNodes)` — **live current
nodes**, not the frozen publication items. Only header metadata is seeded from
the latest publication. If the owner published a subset, or has edited or added
milestones since, this screen shows content the audience cannot see.

So section 10.4's instruction to remove that caption is right for a stronger
reason than length: it makes a promise the code does not keep. Preview must
render the frozen publication, which is what the artifact studio already does.

## 10c. Superseded suspicion

Two publish mechanisms exist. Mechanism B — `timeline_publications.state`
(`draft → published → unpublished`) with hashed bearer tokens and frozen item
snapshots — is confirmed wired end to end in this repo, and is the basis for
section 1's conclusion about truthful Share copy.

Mechanism A — `projects.publishedAt`, set workspace-wide by
`publishWorkspaceAction` — is still write-wired here but its consuming surface
is documented as a **separate deployment at `timeline.signalstudio.ie` that
cannot be inspected from this repo**. No route in `src/app` reads
`projects.publishedAt`. If that deployment is live and reads live rows, it
would be a genuine "changes appear immediately" surface, contradicting
Mechanism B.

This must be resolved before Share UI is written, because the two mechanisms
imply opposite copy. Do not assume either way.

## 8. Acceptance checklist

Carried verbatim from the assignment's section 37, to be ticked only against
evidence:

- [ ] One-milestone desktop state needs no unnecessary scrolling at 1920×1080,
      1600×900, 1440×900; footer visible
- [ ] Sparse timelines use content-aware spacing; long content never clipped
- [ ] Undated milestones never receive invented temporal positions
- [ ] Dated and ordered modes distinct; ordered used whenever timing is
      insufficient; removing timing falls back truthfully
- [ ] `Start`/`Finish` show real dates in dated mode, absent in ordered mode
- [ ] Owner and public separated; preview renders the exact public surface
- [ ] Preview and Share are separate actions
- [ ] Publication state truthful (`Draft` / `Published` / `Changes not
      published` — **not** "changes appear immediately")
- [ ] Timeline and Milestones local views
- [ ] Detached percentage gone; progress reads `x of y complete`
- [ ] `settled` removed
- [ ] One selected-milestone detail; no repeated milestone
- [ ] Complete / next / upcoming / overdue distinguishable without colour
- [ ] Zero / one / two-to-five / six-plus / twenty-plus layouts intentional
- [ ] Mobile vertical timeline; no horizontal page scroll
- [ ] Markers keyboard accessible; 200% zoom reflows
- [ ] Permissions, analytics, deep links and the publish boundary intact
- [ ] All gates green; production build passes; console clean
- [ ] Screenshots demonstrate the improvement at all eight viewports

## 10d. Two decisions, settled

**The finished end of a dated rail shows its real date, not the word
"Complete".** The cap is an axis endpoint. Labelling one end with a date and
the other with a status makes the axis asymmetric, and completion is already
stated twice — by the progress reading and by the progressbar's own
`aria-valuetext`. Section 7.1 asks for real dates on the caps in dated mode;
this is that. A third statement of completion would be redundancy, not
emphasis.

**The one-milestone rail marker does not repeat the milestone title.** The
marker carries state and date; the detail panel directly beneath carries the
milestone at full size. This is section 16's own requirement — *"Do not repeat
the same full milestone title in both the axis label and detail area"* — and it
is what makes the single-milestone case immune to long-title clipping. The
button's accessible name still contains the title, so nothing is lost to a
screen reader.

Both were flagged as visible changes worth a second look rather than as open
questions. Recorded here so they are not silently reopened.

## 11. Build constraints (CI-enforced, non-negotiable)

- **Zero raw hex in new files.** `ds-check.mjs` grandfathers existing files on a
  shrink-only ratchet; anything new starts at zero. Semantic tokens from
  `src/ds/tokens.css` only.
- **Only two easing curves** outside a `// ds-allow` comment:
  `cubic-bezier(0.23,1,0.32,1)` and `cubic-bezier(0.77,0,0.175,1)`.
- **Never redeclare a system token name** outside `src/ds/`.
- **`-11` sizing utilities are banned** (`h-11`, `min-w-11`). This repo remaps
  Tailwind's scale, so `-11` resolves to 80px, not the 44px people expect.
  Write `min-h-[44px]` literally.
- **Module boundary**: `src/modules/timeline/**` may only be imported from
  `src/app/app/timeline/**`, from itself, and — the one sanctioned exception —
  `src/app/s/**`, which exists precisely so the bearer-link artifact renders
  without authenticated chrome. The chrome-free public surface therefore stays
  where it is.
- Every module `page.tsx` must call `requireAppAccess()`.
- `check-first-contact-language.mjs` bans jargon in rendered copy on a
  shrink-only baseline. New copy must be plain.
- `ds:check` and `check:contrast` are real gates but do **not** run under
  `pnpm test` — run them explicitly before claiming done.

## 12. Reuse, decided

- **Chrome-free rendering already exists.** `TimelineArtifact` takes
  `showProductHeader`, `/s/[token]` sits outside `/app` so it inherits no
  shell, and `proxy.ts` strips analytics and the dev banner on bearer links.
  Preview should render this real surface rather than a fourth variant.
- **Container queries are already on `.artifact`** (`container-type: inline-size`,
  breakpoints at 980/620/390). This is the strongest precedent in the codebase
  and the right mechanism for count-aware and mobile layouts — not new media
  queries.
- **Exhibition type tokens already exist** (`--x-artifact-display`,
  `--x-artifact-metric`) and their own comment warns against copy-pasted
  clamps. Extend these; do not invent parallel ones.
- **Motion**: reuse Timeline's `.tl-rise-in` / `.tl-menu-in` / `.tl-settle`.
- **Tabs**: follow `ViewTabs` — a `<nav>` of links with `aria-current="page"` —
  because Timeline/Milestones will be real routes. The `.segmented`
  `aria-pressed` CSS is dead code, useful only as a visual reference.
- **Share**: no shared ShareDialog exists. Build on the `Dialog` primitive or
  mirror `share-button.tsx`'s structure.
- **No shared Button, Progress or Tooltip components exist.** Progress is
  hand-rolled `role="progressbar"` per surface, as Timeline already does.

Two conflicts to settle before styling:

1. `--motion-slow` is 400ms in `tokens.css` but `MOTION_SLOW` is 480ms in
   `src/lib/motion.ts`, whose header claims identical semantics.
2. Done green is `--status-done: #10b981` in the design system but
   `--x-status-done: #1b873f` locally in Tasks, which T·132 calls canonical.
   Timeline must pick one deliberately; the Tasks value is AA at 4.58:1.

## 13. Verification note

Screenshot capture through the in-app browser pane is unavailable in this
environment (the pane does not composite frames). Visual QA will be captured
through the repo's existing Playwright setup
(`experience/playwright.config.ts`) so the evidence is reproducible in CI
rather than one-off. Measurement-based checks (scroll ratios, overflow, clipped
containers, computed styles) are being used alongside, not instead.

---

## 14. Panel round 1 — 2026-08-06

Nine independent seats, none seeing another's opinion, every finding then
put to a fresh agent whose job was to refute it. Gate 9.5. Baseline 6.0.

| Seat | Score |
|---|---|
| accessibility | 7.2 |
| product design | 7.1 |
| interaction | 6.8 |
| brand | 6.8 |
| emotional resonance | 6.8 |
| typography | 6.4 |
| engineering | 6.4 |
| measured evidence | 6.4 |
| UX / IA | 6.2 |

Mean 6.7. **Not unanimous, not close.** No seat reached 7.3.

### The findings that matter, in the order they should be fixed

1. **The dated rail is not proportional to time.** `collisionSafePositions`
   resolves label collisions by moving the *points*, so the calendar mapping
   distorts — measured off by 4.7x. Three seats found this independently.
   Phase 2 stopped undated milestones from claiming a position; this is the
   same class of untruth one layer down, and it is the artifact's central
   claim. Fix by moving labels, not points, and dropping to the ordered
   presentation once density makes proportional spacing unreadable.

2. **The Share panel cannot give you the link.** The only non-destructive
   action routes to a builder console. The UX seat's words: a share panel
   that cannot hand over the link makes every other improvement here
   unshippable. If the hashed-token model genuinely cannot re-display an
   existing link, that is a data-model problem to solve, not copy to explain.

3. **Month ticks measure 1.48:1 on the page guests actually receive.** A
   one-token change on the highest-severity accessibility defect, on the only
   surface that gets shared. The rail also needs an accessible description
   naming the span it covers.

4. **Preview clips its own content** at 8 of 10 viewports — nested in the app
   shell's scroll container while the real `/s/` route scrolls the document.

5. **The dialog has no focus trap.** `aria-hidden` tells screen readers the
   background is inert while keyboard focus walks straight out of it. A trap
   already exists at `detail-panel/panel-shell.tsx:117-122`; porting it into
   `primitives/dialog.tsx` fixes every dialog in the app.

6. **The metadata layer is still monospace.** Every date, status, kicker, cap
   and footnote. A display face bolted onto a technical readout.

7. **The hero counts down louder than it names the couple**, and prints the
   progress sentence twice.

8. **One state machine speaks three vocabularies** — three local label arrays
   plus the artifact's own nouns. Em dashes and straight apostrophes at 96px
   survive on pages ordinary people read.

9. **Selection is silent on mobile and ambiguous on desktop** — the selected
   dot is byte-identical to hover.

10. **The Milestones editor has no list semantics**, on the one surface whose
    entire purpose is order.

11. **Ordered rails draw their end milestones as half-circles.**

### What the panel confirmed is working

The ordered-mode fallback, the sequence card, the one-milestone fit, the
keyboard model on the guest artifact, and the owner/public separation as an
idea. The register is genuinely distinctive. The problems are execution, not
direction.
