# Panel round 5 — what still blocks Meridian

| | |
|---|---|
| lowest overall | **6.8** (gate 8.5) |
| mean overall | 8.19 |
| lowest owned lens | **5.8** (gate 8.5) |
| Pass / Revise / Veto | 4 / 6 / 0 |

**6 of 10 directors are below the bar.** Only they block you. Round 5 was Meridian's first panel.

## The ballots that block you, worst first

### overall 6.8 · owned 5.8 · Revise · lens: accessibility

**Required.** Rebuild inbox actions as real buttons with aria-disabled + aria-describedby reasons at full parity (all 14 refusals, matching A/C/D); move the mode rail, scope switcher and read ledger out of the skip target (landmarks before main, or a working second skip past the rail); give every thread and event a heading (h2 thread, h3 event) with unambiguous names and floor item links at 44px

Weakest: `rail__inbox__owner_signature.html — the triage page has exactly one heading, its actions ('Mark as read', 'Snooze', 'Clear from Inbox') are details/summary disclosures that open explanatory prose with no actionable control in the shipped bytes, and 9 of 14 refusal reasons simply do not exist in the DOM`

Concerns:
- Control semantics category miss: inbox actions are summary elements announced as collapsed disclosures, not buttons — an AT user cannot act, and cannot tell action from explanation
- Refusals silently omitted: only 5 of the 14 refusal reasons the other three directions surface are present; an absent action with no reason brushes the governing rule on what may not lie
- Skip link is structurally defeated: mode nav, scope switcher and read ledger are the first children INSIDE main (the skip target), so every keyboard pass re-walks ~13 stops with no secondary skip
- Item and thread titles are not headings (today: 6 headings, inbox: 1) and event links are ambiguous bare names ('Mentioned you', 'Replied to you') repeated across items
- Badge markup double-announces ('Inbox Inbox. 5 open…') and only 5 component selectors claim the 44px floor — item links are not floored

---

### overall 7.8 · owned 7.9 · Revise · lens: typography

**Required.** Consolidate stressed-state mode statuses into one line — never set the same caps status four times in the header; restore ordinals on the Full briefing; make the title link affordance consistent between Today and the briefing; hold the gutter-mark case constant across viewports

Weakest: `rail__today__provider_failure__1440x960.png — the header sets the identical letterspaced caps string 'PARTLY READ · ONE SOURCE DID NOT ANSWER' four times in a row; at the exact moment of stress the type system stops being designed and reads as a rendering fault`

Concerns:
- Stressed-state status repetition: the same caps status is set four times across the mode grid in provider_failure and new_user (Desk's single consolidated 'THE OTHER MODES' line proves the fix exists)
- The Full briefing drops the mono ordinals Today establishes — the one page whose thesis is rank order loses its rank column — and row titles gain underlines there while carrying none on Today, so the link affordance flips between sibling pages
- Gutter marks change case between viewports: lowercase mono at 1440 becomes letterspaced caps overlines at 390 — the direction's own annotation voice is not viewport-stable
- For a time-is-the-structure thesis, absolute dates are buried mid-line in the metadata ('Tasks · Mara & Finn · Tuesday 14 July · Quiet for 2 days') with no structural position, and analytics figures sit left-set and undistinguished
- Shared fixture defect: straight apostrophe in Today's signal

---

### overall 7.8 · owned 7.6 · Revise · lens: measured-evidence

**Required.** Make every entry under 'What you can do' a real control that performs its action — server-action forms or a route-local island both preserve the thesis — and reconcile the account's placement with the published claim (mr-ledger after the document at one-column widths, or rewrite the rail.css header to describe what ships); then re-render and re-measure.

Weakest: `rail__inbox__owner_signature.html — a list headed 'WHAT YOU CAN DO' whose four entries contain no button, no form, and no link: nothing can actually be done in the shipped bytes, confessed only by a margin note ('Nothing here is sent')`

Concerns:
- the details/summary dispositions describe actions they cannot perform, so the fixture's staged dispositions are unactionable — the zero-JS boast is bought with an inert action surface
- the CSS header claims .mr-record is written last so the account follows the document on phones; no rendered element carries mr-record, the account aside (mr-ledger) precedes the body in DOM, and the 390 fold shows THIS READ before 'This is not an all clear' — a self-published structural claim contradicted by the render
- third occupant of the slot, never scored before: no prior round exists to have caught either fault

---

### overall 8.1 · owned 8.1 · Revise · lens: engineering-quality

**Required.** In rail/analytics.tsx, render the ledger's openWorkLabel and overdueLabel through the null guard the published AnalyticsLedgerRowView type requires (null → copy.unreadableCount, exactly as the candidates README specifies), and replace the folder's as-casts with real type narrowing, so the direction's 'a value that could not be read never occupies the slot a number would have occupied' holds by its own construction rather than by the assembler's current behaviour.

Weakest: `rail__analytics__owner_signature.html — the ledger renders {row.openWorkLabel} and {row.overdueLabel} raw into table cells; the cells are filled in this world only because the assembler folds null to 'Could not be counted' upstream, while the published type is string | null and the README instructs the candidate to make that substitution — the direction's own rule 3 ('a value that could not be read never occupies the slot') is true today by someone else's code`

Concerns:
- Latent contract-type violation at the exact point the governing rule lives: a shell refactor exercising the typed null arm renders an empty cell where 'Could not be counted' belongs, and React accepts the null silently
- A pattern of as-casts where narrowing belongs: readings[link.mode] as Reading, group.rows[0] as InboxRow, row.snoozeLine as string, values[0] as number — noUncheckedIndexedAccess dodged rather than satisfied
- px media queries (639/1023/1199) under a header claiming full token discipline, while Index documents em queries as the difference between surviving text-only enlargement and breaking under it
- /app/settings invented as a hand-typed string for the Account link; no typed constant exports it
- Zero-JS means the six transition journeys exist as explanations, not controls, and the meridian status region can never announce an outcome — the perfect budget is partly bought by not building the hardest part

---

### overall 8.2 · owned 8.4 · Revise · lens: emotional-resonance

**Required.** Re-sequence the arrival so the day's verdict is the first thing felt on every viewport: on 390, move the THIS READ / WHAT WAS READ / WORK STARTS IN blocks below the NOW meridian and first signal items so the fold shows headline, meridian, verdict sentence, first item; on 1440, let the headline and meridian own the top before any accounting block; and collapse the four repeated mode-caption qualifiers into one summarising line so the drumbeat becomes a sentence.

Weakest: `rail__today__owner_signature__390x844__fold.png — on the founder's phone the first screen is masthead, mode grid, then three ledger blocks (THIS READ, WHAT WAS READ, WORK STARTS IN) before the NOW line; the verdict of the day is below the fold, so the morning-glance feeling fails on the most-lived device.`

Concerns:
- Receipts before greeting: on both viewports the accounting stack shares or precedes the arrival moment, so the daily first feeling is 'instrument' rather than 'briefing'.
- The per-mode caption drumbeat (PARTLY READ · ONE SOURCE DID NOT ANSWER repeated four times across the nav) reads mechanical, a system log rather than a voice.
- At 1440 the lower page's hard left-set content against full-width rules leaves the right half hollow, which reads unfinished rather than serene.

---

### overall 8.3 · owned 8.2 · Revise · lens: ui-composition

**Required.** Resolve the 1440 field: give the dead right half a persistent job (move the read-accounting/annotation rail there on every mode, as inbox already gestures at) or widen the content measure; and at 390 demote the THIS READ / WHAT WAS READ / WORK STARTS IN stack below the first content section so the state sentence and item 01 sit inside the arrival fold.

Weakest: `rail__today__owner_signature__390x844__fold.png — the mobile arrival spends its fold on the metadata stack: THIS READ, WHAT WAS READ and WORK STARTS IN interpose between headline and the state sentence, and item 01 sits ~1080px deep; accounting before content on the signature arrival.`

Concerns:
- At 1440 the right ~45% of the canvas is dead through every long body section — full-bleed rules and corner annotations claim the width, then the content forgets it; the page reads left-heavy for 1000px stretches on all five modes.
- In the failure state the per-mode annotation 'ONE SOURCE DID NOT ANSWER' repeats four times and wraps the mode band into a 2x2 grid, swelling chrome at the exact moment content matters most.
- Analytics runs two competing left edges: claims indent to the number gutter while Worth a look and the project table return to the page margin.
- Desktop inbox's right-margin annotations (WHEN A SNOOZE COMES BACK) float detached from the rows they describe.

---

## Passing ballots — read these to know what NOT to break

**overall 8.6 · owned 8.8 · lens: product-taste-and-founder-outcome** — protect:
- The two meridians — NOW and THE EDGE OF THIS READ — recur on all five surfaces with a surface-specific true sentence each time ('Nothing below this line is asking for you inside this read' / '…is waiting on you now' / '…is due inside the read above' / 'Below this line is what these records cannot reach yet'). This is the only direction whose thesis is an operating principle rather than a page style; the meridians and their sentences are untouchable in any remediation.
- The accounting sentence at arrival, top-right (THIS READ / WHAT WAS READ / WORK STARTS IN) — the founder's receipt is handed over before a single row is read. Keep it at arrival.
- Per-mode read-state captions permanently under the mode names (READ / PARTLY READ / NOTHING IN IT / NOT ENOUGH HISTORY), and the time-gutter with red bars for lateness — state is legible at a glance without opening anything.
- The quiet day retains the full two-meridian structure around one honest paragraph — the empty page still looks like the product, not like a template that lost its data.

**overall 8.7 · owned 8.8 · lens: data-truth-permissions-and-human-respect** — protect:
- Read-state is furniture, not commentary: every mode carries its condition in the persistent rail with the reason in words — 'Partly read · one source did not answer' (failure) vs bare 'Partly read' (coverage) vs 'Nothing in it' vs 'Not enough history' — at 1440 and, first thing on screen, at 390. Do not sand this off.
- The always-visible 'This read' panel swaps the accounting sentence for the total-refusal sentence ('No total is shown rather than a total that would be wrong') the moment a source fails — the refusal is at arrival, above the fold, plus the black banner '1 project did not answer at all. Nothing here counts it as zero, and no total includes it.' — the strongest single failure moment of the round.
- Epistemic boundaries as architecture: 'The edge of this read — Nothing below this line is asking for you inside this read' and analytics' 'Below this line is what these records cannot reach yet', with the trend refusal placed beyond the edge. The time thesis is used to express the limits of knowledge, not just schedule.
- 'Before the first read. Nothing failed, and nothing here counts as zero' is the most humane day-one framing of the four, and the snooze menu prints exact return instants with DST honesty ('a clock change between now and then is already counted').

**overall 8.6 · owned 8.7 · lens: ux-comprehension-first-contact** — protect:
- THE EDGE OF THIS READ with "Nothing below this line is waiting on you now." — the only direction that answers the Inbox question structurally (open above the line, settled below); do not flatten this into one list in any remediation.
- Per-mode condition captions under each mode name — READ / PARTLY READ / NOTHING SET UP YET — and their failure form "PARTLY READ · ONE SOURCE DID NOT ANSWER" on every mode at once: the most glanceable cross-mode honesty in the round.
- The black inverted banner on provider failure ("1 project did not answer at all. Nothing here counts it as zero, and no total includes it.") — the strongest quiet-vs-broken contrast any direction produced; a quiet day and this screen cannot be confused at any distance.
- "BEFORE THE FIRST READ" framing plus the single filled Open Tasks button — the best-named empty state of the four, and the account sentence on arrival at top right answers "is this everything?" immediately.

**overall 9 · owned 9 · lens: content-copy-brand-voice** — protect:
- The edge-sentence family — 'The edge of this read' with a true, per-mode re-derived sentence ('Nothing below this line is asking for you inside this read.' / '…is waiting on you now.' / 'Below this line is what these records cannot reach yet.' / 'Before the first read') — the best original copy system in the field; do not sand off
- The two action blast-radius sentences ('This changes what Home shows you. The work itself is untouched.' / 'This is sent to the product that owns the item. Nothing here is settled until that product answers.') state the whole action contract honestly and reusably
- Nav status carries its reason ('Partly read · one source did not answer') — the only direction whose mode row explains itself; keep
- 'These are exact instants, so a clock change between now and then is already counted.' and 'This is the whole read. Nothing was held back from it.' — the time thesis turned into user-facing guarantees
