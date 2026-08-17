# Panel round 5 — what still blocks Reading Index

| | |
|---|---|
| lowest overall | **7.8** (gate 8.5) |
| mean overall | 8.24 |
| lowest owned lens | **7.7** (gate 8.5) |
| Pass / Revise / Veto | 1 / 9 / 0 |

**9 of 10 directors are below the bar.** Only they block you. Round 5 was Meridian's first panel.

## The ballots that block you, worst first

### overall 7.8 · owned 7.7 · Revise · lens: emotional-resonance

**Required.** Let the calm worlds breathe and the wound speak once: on owner_quiet and new_user, collapse the right-rail apparatus to a single receipt line with the rest behind a disclosure and re-frame new_user under a welcome heading ('Where to start') rather than 'WHAT LIMITED THIS READ'; demote the 'Not connected' qualifier from the Today nav badge into the account where it explains itself; and on provider_failure state the wound once in the banner and once in the contents instead of nine times.

Weakest: `index__today__new_user__1440x960.png — a person's first-ever screen is framed under 'WHAT LIMITED THIS READ' with roughly a dozen statements of nothing/zero/not-set-up across nav, banner and rail; the feeling is being processed by an intake clerk, not welcomed to a product.`

Concerns:
- The quiet day never exhales: the full accounting apparatus keeps equal visual weight beside a hollow content column, so calm reads as a column that failed to load rather than rest.
- The failure wound is restated roughly nine times on one screen (nav ×4, banner, rail paragraph, contents ×4) — honesty repeated until it becomes anxiety.
- 'Not connected' is promoted into the nav beside Today on the signature day, so the qualifier shouts louder than the 'Read' verdict it qualifies.
- Mono-and-badge density everywhere makes every surface feel like working papers; the direction functions admirably and moves least.

---

### overall 8 · owned 7.8 · Revise · lens: accessibility

**Required.** Give the loud limit block real semantics (aside or section with aria-labelledby + h2 'What limited this read', matching its visual rank); cut the entry link boundary to the title (why-sentence and meta outside the anchor, or aria-label the link to its title) so control names stop being paragraphs; wire refusals as aria-disabled buttons with aria-describedby reasons, and give the status announcements their referent ('No calendar is connected', 'One project is not answering')

Weakest: `index__today__provider_failure.html — the loud 'What limited this read' block that is the direction's whole answer to the governing rule is a bare div with no landmark, no heading and no role: rotor and landmark navigation skip the one element the thesis says must rule the sheet`

Concerns:
- Loud failure block invisible to structure navigation (div + p + ul, saved only by DOM-first position for linear readers) — weakest semantic binding of the critical trust element in the field
- Item anchors swallow h3 + why-sentence + meta: paragraph-length accessible names on every entry on today and inbox (heading-inside-link), taxing speech, link-list and voice-control users at every stop
- Refused actions are non-focusable text spans — all 14 reasons present but zero control semantics and no describedby, below the programme's wired convention
- SSR status announcements are telegraphic to ambiguity: 'Today. Read. Not connected.' does not name what is not connected, and 'Not connected' vs 'Not answering' is a subtle distinction in speech
- Contents nav carries tabindex=-1 with no visible jump link to it found

---

### overall 8.1 · owned 8 · Revise · lens: product-taste-and-founder-outcome

**Required.** Collapse the doubled condition report — let the mode strip carry marks only and the CONTENTS table carry the words, so no condition is stated twice on one screen — and stop binding source conditions to mode names: 'Not connected' moves off 'Today' and onto its source note in THIS READ.

Weakest: `index__today__owner_quiet__1440x960.png — on a quiet day the main column is a headline, one paragraph, and a long void while the right rail keeps talking; the composition only balances when the day is full, which is the tell of a direction that needs volume to look composed.`

Concerns:
- The condition report is stated twice on one arrival screen (inline mode strip plus CONTENTS rail); in provider_failure 'Partly read · Not answering' appears eight times — documentary texture turned drone.
- 'Today · Read · Not connected' hangs a source's condition directly on a mode name at the most prominent position on the page; a founder reads 'Today — not connected' every single day.
- Tallest pages of the four (analytics 4054px); the most furniture per fact, the highest daily reading tax.

---

### overall 8.2 · owned 8.3 · Revise · lens: typography

**Required.** Give the contents status column a fixed two-line grid — status and condition each on its own line at a shared x, no '· Not answering' runover; calm row metadata to two voices by dropping the added letterspacing on small mono names and folding quiet-duration into the provenance voice; thin the simultaneous hairline systems at 1440

Weakest: `index__today__provider_failure__1440x960__fold.png — under stress the contents' status column breaks its set ('Partly read / · Not answering' runover wraps ragged) and the mode strip repeats the same status words four times; the thesis apparatus falters at the exact moment it must perform`

Concerns:
- The row metadata line runs three voices in ~500px — letterspaced small mono names, red bold late mark, regular sans quiet-duration — and the added tracking on 12px mono names is precious and slightly hard to read
- Rule accumulation at 1440: content-column section rules plus the right rail's hairline stack put five-plus rule weights in one viewport; space should carry more of what lines currently do
- Contents statuses have no fixed two-line grid, so lengthened conditions wrap unpredictably and the leader table's right column loses alignment
- On 390 the CONTENTS sinks to the page foot — the direction's central typographic object is absent from mobile arrival
- Shared fixture defect: straight apostrophe in Today's signal

---

### overall 8.3 · owned 8.3 · Revise · lens: ui-composition

**Required.** Rebuild the inbox event-row anatomy on a fixed grid — one aligned action row per event, refusals grouped, no mid-line wraps — and restore the LATE figure to the 390 project table by stanza-stacking all four fields per project as the 1440 view's data requires.

Weakest: `index__inbox__owner_signature__390x844.png — 5097px, the tallest render in the matrix: event rows collapse into ragged stacks of fielded pairs, wrapped struck links and orphaned actions ('Snooze' and 'Clear from Inbox' floating mid-line), the least composed page of the whole round.`

Concerns:
- At 390 the Every project you can read table silently drops the LATE column that 1440 shows — a composition decision that omits a count on mobile, which this programme's governing rule cannot tolerate; editorial and desk both keep it by stanza-stacking.
- Inbox event-row anatomy breaks the grid at 1440 too: action rows wrap raggedly with struck text and reasons at inconsistent x positions.
- Row grammar swaps field order between Today's signal and Needs review (provenance appended inline to the reason sentence in one, its own line in the other).
- When one cause hits every mode, the failure chrome repeats '· Not answering' eight times (band plus contents) instead of composing the shared cause once.
- The right rail orders two blocks of accounting prose above CONTENTS, burying the navigation the thesis is named for at the bottom of the aside.

---

### overall 8.3 · owned 8.3 · Revise · lens: content-copy-brand-voice

**Required.** Give the Today limitation its referent everywhere the leaders point at it — 'Calendar not connected' or 'No calendar · no decisions source' instead of the bare 'Not connected' (including the skip-region announcement) — and replace the 'Read scope' label with the house 'Home is reading' grammar

Weakest: `index__today__owner_signature.html — the thesis surface itself reads 'Today · Read · Not connected' in the mode row, the contents and the screen-reader announcement; 'Not connected' misattributes the missing calendar/decisions sources to Today, and the referent is only recoverable two panels away`

Concerns:
- 'Not connected' without a referent is the most-repeated pair of words in the direction and the one ambiguous label on an otherwise honest contents
- 'Read scope' switcher label is tool-speak where every other direction keeps the house 'Home is reading' grammar
- 'No date on it.' chip sits beside the literal 'before the rehearsal' — self-contradiction on first read
- Inbox row label runs ('Open / Read: Not read yet / State: Still open') read as word-salad in sequence; the dt vocabulary needs one more pass
- Thinnest body of owned prose in the field — the thesis rests almost entirely on labels, so each label word carries outsized risk

---

### overall 8.4 · owned 8.4 · Revise · lens: ux-comprehension-first-contact

**Required.** Bind every status fragment to its referent with a connective — the healthy-day pairing becomes e.g. "Read · no calendar connected" (or a desk-style sentence, "Read. 2 kinds of work have no source connected.") in the title strip, the tab row and the Contents table, so a healthy read never leads with an unexplained negative; and fix the Inbox action grammar to a fixed order (enabled controls first, each struck control with its own reason on its own line) so reasons cannot wrap away from the control they explain.

Weakest: `index__today__owner_signature__1440x960.png — on the healthy signature day the active tab reads "Today □ Read · Not connected": an unexplained negative fragment in the highest-attention slot, whose referent (an unconnected calendar) is only discoverable in the right rail; it is the one place in the round where a quiet, healthy read wears a broken-looking badge.`

Concerns:
- Status conditions render as bare fragments without connectives ("Today. Read. Not connected.") in the title strip, tab row and Contents — clear in failure states, misleading on healthy ones.
- Double navigation (tab row plus Contents table) repeats the same fragments two to three times per page.
- Inbox action rows interleave enabled links, struck controls and dot-separated reasons on wrapping lines — the hardest action grammar of the four to parse — and the "READ ■ Not read yet / STATE Still open" field labels are database-y where editorial's plain pair is not.
- The Inbox mixes open, snoozed, handled and cleared in one flat list under a "5 open" count, with open items scattered through it.

---

### overall 8.4 · owned 8.3 · Revise · lens: engineering-quality

**Required.** Move src/lib/home-layer/candidates/index/labels.ts into src/app/lab/home-operating-layer/candidates/index/ beside the files that import it (restoring 'one folder each, nothing outside it'), update the three imports, and correct the two stale 'ships no client JavaScript' claims in parts.tsx to match the measured island account in candidate.tsx and dispositions.tsx.

Weakest: `index__inbox__owner_signature.html — shut moves render as plain spans (18 of them) rather than the focusable aria-disabled controls its two island peers use, so a keyboard user cannot reach a closed move to have its reason announced; defensible as 'a statement, not a control', but it is the weakest arrival-state engineering among the three directions that built real dispositions`

Concerns:
- Folder-discipline violation: candidate-private logic lives at src/lib/home-layer/candidates/index/labels.ts, outside the one folder the contract grants ('One folder each. Nothing outside it'), imported by three of its files, and neither header declares nor justifies the location — the isolation walker scans it, but the boundary rule is broken silently
- Two stale zero-JS claims in parts.tsx ('The direction ships no client JavaScript at all', and ScopeControl's 'this direction spends none') contradicting candidate.tsx's own round-5 island account — a reviewer reading parts.tsx alone is misinformed about the direction's runtime cost
- Ledger cells render {row.openWorkLabel} raw with a string-equality check against copy.unreadableCount for styling only — same latent typed-null hole as Rail, plus brittleness against any copy change
- Fragment-suffixed hrefs (`${row.href}#ri-open-event`) are declared and reasonable, but they are the closest any direction comes to composing a lab URL by hand

---

### overall 8.4 · owned 8.3 · Revise · lens: measured-evidence

**Required.** Gate .dk-caveat on the per-list coverage fact the shell already hands over — it must render only under a group whose source did not answer (zero occurrences on my-work owner_signature, keep the four on provider_failure) — and correct the 18.1:1 row to the measured 18.88:1; both fixes are verifiable by re-running this round's instrument, after which the direction re-measures at pass.

Weakest: `desk__my-work__owner_signature.html — 'Some sources did not answer, so this list can be short' printed four times on the world where every source answered (rail and editorial account the same fixture as 'Read 3 of 3 projects. 0 did not answer') — the only rendered falsehood found across all 40 instrumented pages`

Concerns:
- the caveat contradicts desk's own vocabulary, which elsewhere separates 'did not answer' from 'no source connected'
- gating is mode-inverted: inbox, which HAS a coverage limit, prints no caveat, while my-work, which has none, prints four — an unconditional stamp, not a data-driven disclosure
- published contrast row '--ink on the sheet 18.1:1' does not reproduce — measures 18.88:1 (error in the safe direction, but a wrong instrument reading in a header that stakes its authority on measurement)

---

## Passing ballots — read these to know what NOT to break

**overall 8.5 · owned 8.6 · lens: data-truth-permissions-and-human-respect** — protect:
- The contents table doubles as a coverage ledger — 'Every mode, and the condition its own read is in', with worded reasons ('Partly read · Not answering', 'Coverage', 'Not enough history', 'Nothing set up yet') and leader dots to each; the navigation itself is a truth instrument, legible from every mode and intact in the 390 fold. Do not sand this off.
- 'What limited this read' scales its alarm honestly: red-ruled with the named limitation on failure, de-escalated to neutral on day one — the limitation grammar never cries wolf.
- Denominators are explicit and safe: analytics says '2 of 23 records were left out of this' per metric, the scale Inbox badge draws a dashed border around 42 while one item is unverified, and unreadable projects are disclosed as counts ('0 projects could not be read') without naming anything hidden.
- The skip-region aria announces the condition before anything else ('Today. Partly read. Not answering.') — assistive readers get the truth first, not last.
