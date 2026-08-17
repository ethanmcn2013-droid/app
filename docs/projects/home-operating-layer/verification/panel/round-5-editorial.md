# Panel round 5 — what still blocks Editorial Line

| | |
|---|---|
| lowest overall | **8.1** (gate 8.5) |
| mean overall | 8.64 |
| lowest owned lens | **7.8** (gate 8.5) |
| Pass / Revise / Veto | 8 / 2 / 0 |

**2 of 10 directors are below the bar.** Only they block you. Round 5 was Meridian's first panel.

## The ballots that block you, worst first

### overall 8.1 · owned 7.8 · Revise · lens: data-truth-permissions-and-human-respect

**Required.** Replace the editorial-authored 'In your Inbox' deck line with one consistent with the ledger — e.g. '5 open. 1 of them could not be checked against the source, so it is counted but not named.' — and surface the full qualifier sentence (not just the collapsed chip) in the 390 failure fold.

Weakest: `editorial__inbox__owner_signature.html — the direction-authored deck line 'In your Inbox: 5 open, and at least one more that could not be counted' contradicts its own qualifier one block above ('1 item could not be checked against the source, so it is counted but not named') and the badge aria ('5 open. 1 could not be verified'). The unverified item is counted; the 'one more that could not be counted' is a phantom.`

Concerns:
- The inbox deck line invents an uncounted extra item the ledger says does not exist — it errs toward over-caution and never claims all-clear, but under the governing rule it is still a count that lies, on the mode whose subject is counts.
- On the 390 failure fold the reasoned qualifier collapses to '1 thing qualifies this read ⌄' — the chip survives but the reason sentence is one tap away, where rail and index keep it in the mobile fold.
- Exposure, not a charge: the shared accounting sentence ('showed 5, held back 19') and the shared cap notes ('22 more qualified…') never visibly reconcile; identical in all four directions, so it belongs to the fixture/shell plane.

---

### overall 8.4 · owned 8.4 · Revise · lens: product-taste-and-founder-outcome

**Required.** Deduplicate the liturgy: state each rule sentence once per section (first occurrence, or as a section note) instead of verbatim under every row — including my-work's no-waiting-column note and analytics' repeated dossier labels — and pull a one-line THE ACCOUNT up under the Today standfirst so the receipt is met before the fold, keeping the full colophon at the foot.

Weakest: `editorial__analytics__owner_signature__1440x960.png — the COUNTED / CANNOT SAY / WINDOW / LEFT OUT / BASELINE dossier scaffold repeats identically seven times down 3808px; the editor's voice becomes a form being filled in, which is exactly what a months-iterated broadsheet would never ship.`

Concerns:
- Verbatim liturgy: 'Signal flags anything past its due date…' appears twice in adjacent rows at arrival; my-work repeats the no-waiting-column note four times; the daily reader will stop seeing the words, which is fatal for copy that carries honesty.
- The receipt lives only at the foot — a founder must scroll ~2500px to reach the account of the read, where Rail hands it over at arrival.
- Analytics is a 3808px grind of identical stacks; daily living cost is the highest of the four after Index.

---

## Passing ballots — read these to know what NOT to break

**overall 8.6 · owned 8.6 · lens: ui-composition** — protect:
- The marginalia grid — dateline, section notes, sender/time and field labels living in the margins — is the direction's compositional signature and must not be sanded off; it is what makes the centred column read as a considered broadsheet rather than a floating card.
- Colour discipline as structure: one indigo rule under Today's signal, red only for lateness/failure; the failure state is composed (red band plus right-margin qualifier block), not decorated.
- The quiet day compresses to a single honest screen with the colophon raised — quiet and broken are compositionally unmistakable at a glance, which is the governing rule delivered by layout alone.
- The three-column HOW THIS PAGE WAS READ colophon and the stanza-stacked project table at 390 (which keeps the LATE figure) are grid work at studio grade.

**overall 8.6 · owned 8.7 · lens: typography** — protect:
- Hierarchy carried entirely by type — kicker / tight display headline / standfirst / ruled section heads / mono ordinals — with no containers; the broadsheet grammar is executed with conviction and must not be boxed or carded in remediation
- The margin apparatus: right-aligned mono dateline (READ AT 08:40…), 'Looking fourteen days ahead.' margin note, and the three-column colophon with letterspaced caps field labels — furniture that carries the honesty accounting, not decoration
- Numeric discipline at the right edge: mono tabular dates (Sunday 12 July / Tuesday 14 July) column up flush right with 'No date' set in the same column so the column never lies by omission; analytics figures 19/3/40 flush right with caps units and dictionary-style right-aligned margin field labels (COUNTED / CANNOT SAY / WINDOW / LEFT OUT)
- Quiet and failure are typographically unmistakable inside one system: quiet compresses to a designed single screen (headline, one sentence, colophon); failure escalates with the red rule, caps FAILURE · PARTLY READ, and the bordered WHAT QUALIFIES THIS READ sidenote

**overall 8.9 · owned 9 · lens: ux-comprehension-first-contact** — protect:
- The inline rule sentence on every flagged row ("Signal flags anything past its due date. This is 4 days past.") — the direction teaches the system by showing its reasoning; this is the comprehension engine and must never be compressed into icons or tooltips.
- Inbox refusals as copy: struck-through actions with their reason beside them ("Only an open item can be snoozed.", "The source did not answer, so nothing can be sent to it.") — a newcomer learns the action model from the disabled states themselves.
- The one-screen quiet page and the new_user sentence "This is not a failed read, and it is not an all clear either" + Where to start + Open Tasks — the calmest, most correctly-framed empty and quiet states in the round.
- The "How this page was read" colophon: the account in reader's arithmetic ("read 22, showed 8, held back 2, skipped 1 you silenced") and the no-total-rather-than-a-wrong-total sentence under failure.

**overall 8.8 · owned 8.8 · lens: accessibility** — protect:
- Refusal grammar: aria-disabled buttons that stay focusable with aria-describedby resolved reason text (13/14 wired) — do not replace with display:none omission or bare disabled
- Heading topology is flawless in every state read: one h1, zero level skips, items as h3 and inbox events as h4 with actor and time — the typographic thesis IS the accessible structure
- State words ride in the controls themselves: nav aria-labels carry the full account ('Inbox. 5 open. 1 could not be verified…'), failure ledger is a labelled aside, quiet vs failure distinct in the tree not just the paint
- No SVG anywhere — every claim, qualifier and refusal is text by construction, so colour-alone state is impossible; keep the no-chart analytics refusal ('Not enough history yet. 6 of 14…') as text

**overall 8.7 · owned 8.8 · lens: engineering-quality** — protect:
- The single-file island (interaction.tsx) with its written import ban, module-Map store, useSyncExternalStore seeding, and the one-component-per-row consolidation (TaskRowState absorbing actions rather than doubling subscriptions) — keep this exact shape in any remediation
- read-state.ts as the one pure derivation both the nav marks and the page share, so register and state word can never disagree — the word always travels with whatever produced the register
- The only direction that honours the published contract type on the analytics ledger: openWorkLabel === null renders copy.unreadableCount by explicit guard, true by construction rather than by the assembler's current behaviour
- Self-account with zero false claims: the 4 KB island ceiling is explicitly declared 'a commitment, not a receipt... unverified until a build says otherwise' — the candour itself is the asset

**overall 8.7 · owned 8.6 · lens: content-copy-brand-voice** — protect:
- The 'How this page was read' ledger register (This read / The account / No source at all / Where new work goes) — the most literate honest-accounting prose in the field; do not sand off
- Margin-annotation grammar: facts in the margin ('2 asks in this thread.'), prose in the column — a real editorial voice, keep it
- Failure-account line placement: 'No total is shown rather than a total that would be wrong.' under 'The account' is the governing rule spoken like a person
- New-user lede 'This is not a failed read, and it is not an all clear either.' — the three-way empty/broken/quiet distinction in one sentence; must survive any remediation

**overall 8.6 · owned 8.7 · lens: emotional-resonance** — protect:
- The arrival ritual — address-you headline over the small-caps margin dateline (READ AT 08:40 ON THURSDAY 16 JULY.) — feels like a private paper prepared for one reader; do not sand off the dateline or the direct address.
- The quiet day compresses the entire page to a single serene screen (headline, one honest sentence, colophon receipt) — the page itself becomes quiet; this compression is the direction's emotional core and must survive any remediation.
- The colophon 'HOW THIS PAGE WAS READ' stages the accounting as a printed receipt of candour — trust delivered as typography, and the failure-day colophon line refusing a wrong total lands with real gravity there.
- Colour spent as truth only — one indigo rule, red reserved for lateness and failure — keeps the red top rule on provider_failure genuinely felt rather than decorative.

**overall 9 · owned 9.1 · lens: measured-evidence** — protect:
- Real controls everywhere an action is shown: 41/22 <button> elements in inbox/my-work, refused actions struck through WITH the reason inline ('This one is not an approval.') — the strike-plus-reason grammar must not be sanded off
- Arithmetic-closed accounting sentences: 'read 22 items, showed 8, held back 2, skipped 1, found 11 that crossed nothing' sums exactly, quiet world's 'read 4, showed 0, found 4' likewise — keep colophons numeric, never prose-only
- Perfect instrument hygiene on all 10 states: 1 main, 1 h1, 0 heading skips, named navs (Products/Home), zero role/tabindex misuse, zero pointer-cursor classes on non-controls
- The habit of labelling unmeasured numbers: its interaction island was published as an estimate pending perf:budgets and measures 2.23 KB gzip against the flagged ~4 KB — conservative and honest; keep flagging what was not run
