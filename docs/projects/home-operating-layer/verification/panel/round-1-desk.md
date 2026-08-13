# Panel round 1 — required corrections for Signal Desk

Scored blind as candidate **A**. Ten independent directors, none of whom saw another ballot,
none of whom knew which team built which, and none of whom were told the pass threshold.

**This direction did not clear admission.** The gate is: every director at least 8.5 overall
AND at least 8.5 on their own lens, no vetoes. The gate does not move.

| | |
|---|---|
| lowest overall | **6.8** |
| mean overall | 7.97 |
| lowest owned lens | **7.2** |
| Pass / Revise / Veto | 3 / 7 / **0** |

## Every ballot, worst first

### overall 6.8 · owned 7.2 · **Revise**

**Required correction.** Make broken look different from quiet without reading a word. The band must change state, not just gain a caption: give the three read states three distinct treatments (no band at all when the read is complete, then a marked band, then a red-ruled band), and move the state word out of the grey standfirst into a flagged position with weight or colour. Then fix the grid so the masthead does not change width between modes, and delete the duplicate timestamp.

Weakest evidence: `desk__today__provider_failure__1440x960__fold.png`

Concerns:
- Fails the glance test, and this is the heaviest fault I found in any candidate. The tinted disclosure band is present in every state including the healthy signature world, so the band's presence signals nothing. Comparing desk__today__owner_quiet__1440x960__fold.png against desk__today__provider_failure__1440x960__fold.png, the entire difference in the chrome is one word in a 13px grey standfirst (Read. vs Partly read.) and a 10px mono label. Same paper, same band, same rule, same weight, no colour move. A quiet day and a broken provider are near-identical at a glance.
- The grid is not stable across modes. On desk__today and desk__my-work the masthead rule and content column run roughly x376 to x1064; on desk__analytics the same chrome runs roughly x296 to x1144. Page furniture that changes width depending on which mode you are in reads as unresolved, not as responsive.
- Three tiers of header before the headline (products, then actor plus scope, then mode tabs), and the read timestamp is printed twice within 210px, once in tier two and again in the standfirst. That is duplicated information at two altitudes.
- The standfirst is a comma-spliced fragment, not a sentence: 'Read. The Orchard, 2026 season. Read at 08:40 on Thursday 16 July.' It is the second-most prominent line on the page and it is the only one of the four that does not use that slot to say what the read actually means.
- desk__analytics carries an empty labelled slot: a hairline, then the mono label THE RECORDS BEHIND THIS, then nothing. Two blocks down, the same content (What the records say) is treated as an inline metadata item instead. One idea rendered two ways, one of them empty, within 300px.
- Lateness is set in the same grey as everything else in the metadata line, so on Today the overdue items do not separate from the on-time ones. Every other direction reds it.

Strengths worth protecting:
- The spine is the best margin device in the set and the only one that carries meaning without colour: filled indigo square, hollow square, hollow circle and a hollow crosshair encode open, read, snoozed and could-not-be-read. In desk__inbox it does real work, nesting a thread under a black cross-bar with its asks indented beneath. That is a signature moment that earns itself.
- The only direction that takes a position on the canvas. Warming --paper by a color-mix is a genuine art-direction decision rather than a layout preference, and it separates Home from the products without any chrome.
- Best metadata typography in the set. Provenance, lateness and idle time are fielded and separated by vertical rules into a single scannable line, instead of being stacked as loose sentences.

---

### overall 7.4 · owned 7.6 · **Revise**

**Required correction.** Make the read-state visible before it is read. The unknown band must differ from the quiet band in weight, rule colour and position — not by an eyebrow — and partial must differ from failure. A reader glancing at Today for one second should be able to say 'nothing happened' or 'something is broken' without parsing 10px monospace.

Weakest evidence: `desk__today__owner_quiet__1440x960__fold.png — set beside desk__today__provider_failure__1440x960__fold.png the two screens are structurally identical: same tinted band, same position, same width, same tint. The only differences are a 10px mono eyebrow reading PARTLY READ and one word in the standfirst. A quiet day and a broken provider do not look different at a glance; they look different on close reading.`

Concerns:
- Governing rule, at-a-glance clause: the notes band is present in every state, so its presence carries no information. Quiet, partial and failure all render the same grey band, and partial_coverage and provider_failure at 1440 are pixel-siblings apart from the row list.
- The four-tier header (products / actor + scope / as-of / mode tabs) is the heaviest shell of the four, pushing content 190px down and making the chrome louder than the content it is meant to sit under.
- The spine glyph vocabulary — filled square, hollow square, circle, crosshair — is a taught convention: it needs the 'WHAT THE MARKS MEAN' legend parked at the page foot. Meaning that only resolves at the bottom of the page is not meaning available at the top.
- Shell measure changes between modes (Today's header spans 376–1064, Analytics 296–1144). One earned widening for Analytics is sanctioned, but moving the header with it makes the frame feel unstable between modes.

Strengths worth protecting:
- The clearest expression of Full briefing as depth rather than a fifth mode: the mode row keeps Today active and a second breadcrumb tier 'TODAY — FULL BRIEFING' appears beneath it, so the two-level model is stated structurally, not just in prose.
- The only Inbox with a legible thread-then-event hierarchy: the thread title carries '2 asks in this thread' and its events hang off a spine below it, so you can tell a conversation from an item.
- Fixed status word in a fixed slot ('Read.' / 'Partly read.' / 'Could not be read.') opening every standfirst, giving the accounting a consistent grammar across all five modes.

---

### overall 7.8 · owned 7.6 · **Revise**

**Required correction.** The top band must state the fact, not the count and the location. Replace 'N notes at the foot say what this read could not see' with the substantive sentence itself, and give partial coverage and provider failure visibly different labels at the fold. Separately, mark the capped three so they read as ranked (ordinal or type weight) rather than as the first section of a list.

Weakest evidence: `desk__today__partial_coverage__1440x960__fold.png — at the fold this is pixel-for-pixel the same reading as desk__today__provider_failure__1440x960__fold.png: same PARTLY READ eyebrow, same band, same '3 notes at the foot say what this read could not see.' Two materially different worlds arrive identically.`

Concerns:
- The disclosure band reports a quantity and a location, never a fact. 'N notes at the foot say what this read could not see' makes the most important state on the page a navigation task down a 2383px scroll. Every other direction states the substance inline.
- Consequence of the above: the severity ladder collapses in the middle. Quiet vs broken is honoured, but partial coverage and total provider failure are indistinguishable above the fold.
- The three ranked decisions carry no ordinal and no type-weight separation from the Needs review rows immediately beneath them. The cap reads as a section that happens to hold three items, not as an editorial judgement about what deserves attention.
- Full briefing's first screen is a near-clone of Today's first screen — same 'Today's signal' heading, same three rows, same marks — so progressive depth does not look like depth, only like the same page again.
- Three tiers of chrome (products, then actor plus scope, then mode tabs) put roughly 190px between the top of the window and the eyebrow, the most of the four at desktop.

Strengths worth protecting:
- Best fold discipline in the lab: at 1440 the first screen of Today holds the three ranked decisions and nothing else, with the next section pushed below the fold. Under scale the fold is identical, only the withheld count changes.
- The spine with its mark system (filled square, hollow square, dot, crosshair) is a genuine signature that encodes item state without relying on colour, and it is explained in a WHAT THE MARKS MEAN block rather than left to be guessed.
- The quiet day is the most eloquent refusal of an all clear in the set: 'Nothing you are carrying crossed a rule today, and every project answered. This is still not an all clear, because a kind of work has no source connected and there is no history to read.'

---

### overall 7.8 · owned 7.4 · **Pass**

**Required correction.** Decide a mobile field priority for list rows instead of stacking every metadata field, and settle on one container measure across all five modes at 1440.

Weakest evidence: `desk__inbox__owner_signature__390x844__fold.png`

Concerns:
- Mobile is a linearization, not a transformation. Every rule-separated metadata field becomes its own line: Inbox rows go from one metadata line at 1440 to four stacked lines at 390 ('Today at 07:02' / 'Tasks · Mara & Finn' / 'Not read yet' / 'Still open'), roughly tripling row height and destroying scanability on the exact device where scanning matters most. No field was judged less important on a phone; they were all just kept.
- The desktop container is not stable across modes: Today runs 376–1064 and Analytics runs 296–1144. Two different measures and two different margins inside one product, which undercuts a house style built on alignment.
- About 370px on the right of a 1440 window is unaddressed on Today, with no rule or element acknowledging it.
- The tinted state band is the quietest failure signal of the four; PARTLY READ is small-caps in a muted tone rather than anything that reads across a room.

Strengths worth protecting:
- Competent, honest mobile: chrome runs about 225px of 844 (27%) before the eyebrow, headline at 280, first decision title at 521, with a second decision partly in view. Nothing important is behind a wall of navigation.
- The state band is genuinely responsive-proof. It sits directly under the standfirst at both widths, and its label changes with severity — unlabelled on a quiet day, PARTLY READ on provider_failure, COULD NOT BE READ on new_user — so the quiet/broken distinction survives the trip to 390 intact.
- The spine (vertical rule plus indigo squares) holds its meaning at 390 for about 28px of width, and rule-separated metadata fields do genuinely re-form rather than overflow.

---

### overall 7.9 · owned 8.1 · **Revise**

**Required correction.** The state ladder must gain a second, non-textual channel at the fold — change the band's rule colour or tint per state so quiet, partial and failed differ before the label is read. Then retire the mark legend, or move the mark meanings inline onto the rows they govern, so no page depends on a key at its foot.

Weakest evidence: `desk__today__provider_failure__1440x960__fold.png — set against desk__today__owner_quiet__1440x960.png, the two arrival screens carry the same grey tinted band, in the same position, at the same tint and weight. The only differences are one small-caps label ('PARTLY READ' vs nothing) and one word in the standfirst ('Partly read.' vs 'Read.'). At a glance, a broken provider and a quiet day look the same. That is the hardest thing the brief asked for and Desk is the weakest of the four at it.`

Concerns:
- The band tint does not change across quiet, partial, failure and new_user, so the entire state ladder rests on reading a 10px small-caps label. Weakest expression of the governing rule in the set.
- The spine carries meaning in glyph shape — filled indigo square, open square, open circle, a crosshair for the unnamed item — and pays for it with a 'WHAT THE MARKS MEAN' legend at the foot of every page. State that needs a key at the bottom of a 2,383px document is a real a11y and maintenance liability, and it is close to state carried by shape alone.
- Largest stylesheet in the lab at 8,139 B gzip (38% more than Editorial) for the spine and mark system, which is the most decoration-per-byte of the four.
- Zero <button>, zero <form> across all of desk/. All six state-transition journeys unbuilt.
- Analytics never widens for the Project ledger: 3,420px desktop with the ledger squeezed into the same measure as the prose while ~300px sits free each side.

Strengths worth protecting:
- Cleanest token discipline in the lab, and the README's description of it is wrong in Desk's favour. It does not edit --paper; desk.css:36-37 derives --dk-paper and --dk-band via color-mix(in srgb, var(--paper) 87%, var(--dk-warm)). That is the ds:check-safe pattern, so the one direction that changes canvas temperature does it without touching a vendored token.
- Simplest responsive surface of the four at 33 @media blocks, and the flattest DOM — a single spine with no rail, no sticky column and no grid to reflow. Its mobile Today at 3,058px is a straight linear stack with no chrome block to scroll past.
- Zero arbitrary-px type (39 named steps), zero <script>, native <details>. Nothing in it threatens shared_runtime.

---

### overall 8 · owned 7.8 · **Revise**

**Required correction.** Make the disclosure band conditional, not perpetual: a fully-read day must carry no band at all, so the band's presence is itself the signal. When it does appear it must state the consequence inline ('1 project did not answer at all. Nothing here counts it as zero, and no total includes it.') rather than counting footnotes, must use a distinct semantic rule colour, and must use different wording for partial coverage than for a refusal. Add a local caveat to any section whose contents were shortened by the limit.

Weakest evidence: `desk__today__partial_coverage__1440x960__fold.png — the three ranked decisions, the headline, the standfirst structure and the tinted band are the same picture as desk__today__owner_signature__1440x960__fold.png, and also the same picture as desk__today__provider_failure__1440x960__fold.png. One 11px mono word separates a healthy day, a partial read and a total refusal.`

Concerns:
- The disclosure band fires on every scenario including the fully-read day, where it reads '2 notes at the foot say what this read could not see.' A warning present every morning stops being seen. By the day a provider actually breaks, the band is furniture, and the only thing that changed is a small-caps eyebrow inside it.
- The band is a pointer, not a statement. 'PARTLY READ / 3 notes at the foot say what this read could not see.' does not say what happened; the reader must travel roughly 1,700px to the foot to learn that a project did not answer at all. B, C and D all state the consequence inline at the top.
- No semantic colour anywhere in the limited states. The band tint is identical across quiet, partial and failed; only the left rule darkens slightly. This is the one place in the brief where meaning genuinely requires colour, and Desk spends none of it, while spending a warmed canvas on making every state feel calm.
- Partial coverage and provider failure are indistinguishable at the fold — both render 'PARTLY READ / 3 notes at the foot'. A source that answered incompletely and a source that refused entirely are not the same fact.
- Sections shorten silently. On the failure day 'Needs review' drops from two rows to one with no local note; the reader sees a shorter list, not a limited one. Only the page-level pointer covers it.

Strengths worth protecting:
- The best refusal in the lab. On new_user and provider_failure it prints 'The read cannot be accounted for exactly, because at least one source did not answer in full. No total is shown rather than a total that would be wrong.' It declines to emit a number rather than emit a wrong one, and it says so in the reader's own words.
- Every page ends in a fully-printed 'What this read could not see' ledger where each note is typed (PARTLY READ / COULD NOT BE READ / ABOUT THIS READ), followed by a 'WHAT THE MARKS MEAN' legend, so the spine glyphs never carry state by colour alone. Nothing is concealed behind a disclosure anywhere in the set.
- Inbox and Analytics are the strongest supporting modes on truth: every event carries disposition, openness, provenance and time; '3 open items past due of 19 open items' always carries its denominator; and 'The source has changed since this arrived. Open it before acting' is a genuine staleness guard on the row where it matters.

---

### overall 8.2 · owned 8.4 · **Revise**

**Required correction.** Give partial coverage and provider failure two visibly different states, and make the coverage band appear only when something is actually wrong so its presence carries meaning. Then surface per-mode read health on the mode tabs themselves, so a founder does not have to enter Inbox to learn Inbox could not be read. Until the quiet day and the broken day differ at a glance, this does not clear admission on the criterion the brief weights hardest.

Weakest evidence: `desk__today__partial_coverage__1440x960__fold.png`

Concerns:
- It cannot tell partial coverage from provider failure. desk__today__partial_coverage__1440x960__fold.png and desk__today__provider_failure__1440x960__fold.png carry the same tinted band, the same PARTLY READ eyebrow and the same line of body text. Those two worlds demand different founder responses (note it, versus go fix a connection) and the design renders them identically.
- The healthy signature day also carries a coverage band (desk__today__owner_signature__1440x960__fold.png, '2 notes at the foot'). Because every state has a band, the band stops signalling. What distinguishes quiet from broken is roughly eleven pixels of grey monospace, which is not a glance-level difference and the governing rule is a glance-level requirement.
- The whole disclosure is deferred to the foot of a 2383px page. The founder is told at the top that there is something Home could not see, then must scroll past everything to learn what. That inverts decisions-first.
- The spine glyphs (filled square, hollow square, hollow circle, filled circle) need a WHAT THE MARKS MEAN legend at the bottom of the page. A decoder ring is the wrong thing to hand someone at 7am.
- Read health is only ever visible for the mode you are standing in. Nothing on Today tells you that Inbox's read was limited.

Strengths worth protecting:
- The most convincing shell in the lab. The three-tier chrome (products, then actor plus Read Scope, then mode tabs) is the only structure here that reads as an operating system rather than a page, and it would extend to Notes, Tasks and Timeline without redrawing. The warm paper marks Home as the front door without inventing a second palette.
- Mode consistency is the best of the four. Dateline, headline, standfirst, coverage band, indigo spine and foot repeat identically across Today, Inbox, My work and Analytics, so a founder learns one page and gets four. The spine with its indigo marks is the one detail in this lab I would recognise across a room.
- The best honesty prose in the set, and it is the kind of writing a founder trusts. On new_user: 'The read cannot be accounted for exactly, because at least one source did not answer in full. No total is shown rather than a total that would be wrong.' The Inbox badge shows 0 on a truly quiet day and disappears entirely when the read failed, which is a genuinely sophisticated distinction.

---

### overall 8.5 · owned 8.3 · **Pass**

**Required correction.** Give the quiet day a positive marker rather than an absent one, so quiet and broken differ by what is present, not by what is missing. Broaden the focus treatment beyond the single scoped rule, particularly for the spine rows and the scope control. Wrap Today's three decisions in an <ol> so the rank survives into the accessibility tree.

Weakest evidence: `desk__today__owner_quiet__1440x960.png`

Concerns:
- On the quiet day the coverage band is byte-identical to the signature day's band, and the only thing separating quiet from broken is the absence of a 'PARTLY READ' eyebrow and a lighter left rule. Differentiating a broken provider by an absence rather than a presence is the weaker half of the encoding, and the same screen then prints 'showed 0, held back 0, skipped 0' three times.
- One :focus-visible rule and one outline declaration, the thinnest focus story of the four. Editorial has two rules and three declarations, index three and five including a focusable treatment for scrollable regions.
- The warm --paper (#fcfaf7) shaves every ratio: the 25 --ink-faint usages land at 4.64:1 rather than 4.83:1 on white. Still a pass, but the direction spends its one colour licence on a change that costs contrast everywhere.
- The spine marks are roughly 6px squares and circles. They are legible enough at 1440 and the legend redeems them, but at 390 the difference between a filled square and a hollow square is close to the limit of what a reader with reduced acuity will resolve.
- No <ol> and no ordinals: 'at most three ranked decisions' is conveyed by visual order only, so the ranking is not exposed to assistive technology. Six h2 and no h3 on Today, so heading navigation stops at the section.

Strengths worth protecting:
- The only direction with no status colour at all. State is carried by mark shape, weight and words, and it ships the only rendered legend in the set: a seven-entry 'What the marks mean' present unconditionally in every scenario, including 'The line breaks here. This could not be read.' Colour-blind, forced-colours and greyscale readers lose nothing.
- It defines its own quiet ink, --x-ink-quiet #52525b at 7.3:1, and zero rules in desk.css pair an 11-12px step with a low-contrast ink. Twelve declared 44px targets plus one 48px.
- Coverage is announced at the top and paid off at the foot, at both viewports and in both directions: a band under the headline with a text eyebrow, linked down to 'What this read could not see' (desk__today__provider_failure__1440x960__fold.png, desk__today__new_user__1440x960.png). At 390 the chrome ends around 150px, so the disclosure is on the first screen on a phone. The Inbox badge disappears entirely rather than showing 0 when the count is unknown.

---

### overall 8.6 · owned 8.7 · **Revise**

**Required correction.** Populate "WHAT THE MARKS MEAN" with the actual mark legend, or drop the glyph system. Then split the fold band so a failure and a partial read do not read identically — carry the class word ("did not answer" vs "answered for part of what was asked") into the band itself rather than only into the foot.

Weakest evidence: `desk__today__owner_signature__1440x960.png — the page ends on the heading "WHAT THE MARKS MEAN" with nothing beneath it. Desk is the only direction that encodes row state in glyphs (filled indigo square, open square, open circle, filled dot, a crosshair) and its legend is empty on every capture I opened. State carried by shape, with the promised explanation blank, is a trust failure on the most-repeated element on the page.`

Concerns:
- The mark legend renders as an empty heading on every Desk page (today, inbox, my-work, quiet, failure, new_user). Row meaning is currently unexplainable.
- The Inbox badge reads a bare "5" while desk__inbox__owner_signature__1440x960.png says at the foot: "The Inbox count is not complete, so it is shown with what it could not check rather than rounded down." The badge does not do what that sentence claims it does.
- provider_failure and partial_coverage are typographically identical above the fold — both read "PARTLY READ / 3 notes at the foot say what this read could not see." The class of degradation is only recoverable by scrolling to the foot. Compare candidate B, which names FAILURE vs COVERAGE in the eyebrow.
- The quiet-day notice band and the failure band use the same tint and the same weight; a small mono eyebrow and one digit are all that separate them at a glance.

Strengths worth protecting:
- Best disclosure architecture in the lab: the unknown is announced at the top ("2 notes at the foot say what this read could not see") and paid off at the bottom under a plain-English heading, "What this read could not see", with each note carrying a class eyebrow — COULD NOT BE READ / PARTLY READ / ABOUT THIS READ. The reader learns one habit and it holds on every mode.
- The single best sentence written in this lab, on desk__today__provider_failure__1440x960.png: "The read cannot be accounted for exactly, because at least one source did not answer in full. No total is shown rather than a total that would be wrong." Refusing to print a number, and saying out loud that it is refusing, is the governing rule turned into prose. Its Analytics companion is as good: "Decisions linked to a milestone cannot be read yet, so this can only under-count. It is not a statement that the rest are safe."
- Numbers reconcile against the page. My work says "11 items are shown here" and renders exactly 11 rows; "Read 3 of 3 projects. 0 did not answer, and nothing here counts them as empty" states its denominator and disarms the zero in the same breath; every Analytics claim carries its denominator ("3 open items past due of 19 open items", "40 median days open of 19 open items").

---

### overall 8.7 · owned 8.7 · **Pass**

**Required correction.** State the limit where the reader is standing, not only at the foot. Keep the anchor, but let the band carry the actual sentence for the state it is announcing, and give the three states (quiet, partial, failed) visibly different bands so a glance separates them. Add a return link at the foot of 'What this read could not see', and put per-mode state on the tab row.

Weakest evidence: `desk__today__partial_coverage__1440x960__fold.png`

Concerns:
- Evidence disclosure is a promise plus a journey. The coverage material sits at roughly three-quarters of the way down the document, reached by an in-page anchor from the top band, and there is no return affordance at the foot. Learning what was not read costs a ~2000px round trip on Today.
- One component carries three materially different states. The quiet day, partial coverage and provider failure all render the same tinted band saying 'N notes at the foot say what this read could not see'; partial_coverage and provider_failure are byte-for-byte the same band. The distinction is a small monospaced eyebrow and a numeral.
- The mode row carries no per-mode state. Standing in Today you cannot tell that Analytics is partly read, so every mode change is taken blind. Both C and D solve this.
- It is the only direction that changes the paper temperature, so every crossing between Home and Notes/Tasks/Timeline will show a canvas shift at the boundary. That is a continuity cost at the suite seam, not only a palette choice.

Strengths worth protecting:
- Depth is expressed in the chrome, not in the copy: the briefing capture adds a second-tier TODAY - FULL BRIEFING strip beneath the mode tabs, with Today still a live link and Full briefing claiming the current-most position. It reads as depth from Today, never as a fifth mode, and the return path is permanently on screen.
- Best detail-open target in the lab. Each Inbox row is one link whose whole accessible name is the composed sentence ('Mentioned you, Eabha. Confirm final numbers with the Orchard kitchen'), so what opens is unambiguous by pointer and by voice. No nested controls inside the wrapping link anywhere.
- The signature gesture is load-bearing rather than decorative: the vertical spine breaks exactly where the read broke (visible around '4 dated items fall in the same week' in the provider_failure full page), and the foot legend names every mark in words, ending 'The line breaks here. This could not be read.' It implies movement along one axis, which is the cheapest and calmest transition model of the four.

---

