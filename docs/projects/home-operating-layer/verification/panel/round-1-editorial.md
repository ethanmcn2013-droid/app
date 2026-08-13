# Panel round 1 — required corrections for Editorial Line

Scored blind as candidate **B**. Ten independent directors, none of whom saw another ballot,
none of whom knew which team built which, and none of whom were told the pass threshold.

**This direction did not clear admission.** The gate is: every director at least 8.5 overall
AND at least 8.5 on their own lens, no vetoes. The gate does not move.

| | |
|---|---|
| lowest overall | **6.4** |
| mean overall | 8.17 |
| lowest owned lens | **5.2** |
| Pass / Revise / Veto | 5 / 5 / **0** |

## Every ballot, worst first

### overall 6.4 · owned 5.2 · **Revise**

**Required correction.** Blocking: .ed-state[data-tone=warn] must not use --status-flight as a foreground. Set the state label to --ink or --ink-soft and let a mark carry the tone, or replace the amber with a token that clears 4.5:1 at 11px. Same for data-tone=stop, .ed-late, .ed-row-when[data-overdue] and .ed-work-when[data-overdue] b: keep the words at full ink. Raise the nine 11px/--ink-faint pairings to --ink-soft and stop setting explanatory text in right-aligned letterspaced caps. Surface the coverage limits above the content at 390, not only in the foot colophon. Wrap the three decisions in an <ol>. If the amber ships as measured, I would move this to Veto: it is the one place in the set where the governing rule's own indicator is illegible.

Weakest evidence: `editorial__today__provider_failure__1440x960__fold.png`

Concerns:
- Disqualifying on my lens as rendered: .ed-state[data-tone=warn] sets --status-flight #f59e0b at --text-label 11px, uppercase, letterspaced, medium weight, on white. That is 2.15:1, less than half the 4.5:1 AA floor and below even the 3:1 non-text floor. It is the 'PARTLY READ' flag, and in the provider_failure fold it is the single most prominent at-a-glance marker separating a broken provider from a healthy read. The prose block beneath it is grey hairlines and visually recedes. A low-vision reader loses the governing rule's primary indicator.
- data-tone=stop uses #ef4444 at the same 11px for 'COULD NOT BE READ' on new_user: 3.76:1, also failing. And .ed-late, .ed-row-when[data-overdue] and .ed-work-when[data-overdue] b put #ef4444 into running metadata text at 3.76:1, so overdue status is announced at a failing ratio in three separate places.
- The ::before mark is a 14x2px bar in currentColor, so in normal rendering it is the same failing colour as the text and adds no redundancy. It only becomes an independent channel under forced colours.
- Nine rules pair 11px with --ink-faint. The worst instance is My work's section notes: 'HELD UP, OR PARKED IN A WAITING COLUMN.' set 11px, uppercase, letterspaced, #71717a, right-aligned roughly 740px from the heading it explains. Four legibility penalties compounded into one label.
- At 390 the coverage limits live only in the foot colophon, around 3,400px below the fold (editorial__today__owner_signature__390x844.png). A phone reader is told 'no calendar is connected' after scrolling past the entire day. A and C both announce this above the content.
- The 01/02/03 ordinals are aria-hidden with no <ol> behind them, so the ranking of the three decisions is not exposed to assistive technology at all.

Strengths worth protecting:
- The cleanest reading order at 390 in the set: chrome clears in about 140px and the DOM is a single linear column, so the phone experience is the closest to a document.
- The best heading outline: seven h2 and twelve h3 on Today, so heading navigation reaches an individual entry, and links are underlined rather than colour-only.
- A forced-colors block repaints .ed-state::before as CanvasText so the state mark survives Windows High Contrast, and :focus-visible carries a 3px offset. The team understood the failure mode; they just did not apply the same standard to the default rendering.

---

### overall 6.6 · owned 6.4 · **Revise**

**Required correction.** Fix the mobile metadata collision in my-work, then give 1440 an actual second axis and resolve the page to one rule grid; the colophon must not outweigh the answer on a quiet day.

Weakest evidence: `editorial__my-work__owner_signature__390x844__fold.png`

Concerns:
- A hard 390 defect: my-work's right-aligned lateness block ('4 days late' over 'Sunday 12 July') collapses at mobile into an unseparated collision — '4 days lateSunday 12 July' renders as one run with no space or separator. That is a broken layout, not a taste call.
- 1440 is the 390 layout at larger type. There is no second axis, no use of the right ~400px, and the composition reads as a blown-up phone column — the mirror image of a squeezed desktop and just as much a failure of responsive composition.
- Three different rule widths on one page (body rules to 836, section rules to 1040, chrome rules to 1180), all sharing a left edge at 304. For a direction whose whole argument is rules and alignment, its own alignment does not resolve at 1440.
- On owner_quiet at 1440 the three-column 'HOW THIS PAGE WAS READ' colophon is the widest and heaviest object on the page, so the metadata outweighs the answer on the day the answer is shortest. At 390 that colophon unrolls into a very long single column of provenance below a two-line answer.

Strengths worth protecting:
- Lightest run-up on a phone: about 200px of chrome, headline at 285, and the caveats stay at eye level on mobile — my-work's two coverage notes sit directly under the standfirst at 390, which is where C drops them to the foot.
- The state flag is the topmost element on the page (amber PARTLY READ, red COULD NOT BE READ, absent on a quiet day), so it cannot be pushed below anything by a narrower viewport.
- The hanging numeral genuinely re-forms: 01/02/03 sit in a left margin at 1440 and become a stacked eyebrow above the title at 390.

---

### overall 8.1 · owned 8.2 · **Revise**

**Required correction.** Give the mode row per-mode read state, so Today can tell you Inbox was only partly read, and separate partial from failure visually rather than by eyebrow text. Fix the Inbox thread grouping so one thread is one heading with its events indented beneath, not two equal rows carrying the same title.

Weakest evidence: `editorial__inbox__owner_signature__1440x960__fold.png — the thread hierarchy collapses. 'Confirm final numbers with the Orchard kitchen' appears twice as two sibling entries under a floating '2 ASKS IN THIS THREAD' caption that sits above both. A queue that repeats one title as two equal rows reads as two items, not one conversation.`

Concerns:
- No mode carries the state of any other mode. Standing in Today you cannot tell whether Inbox was fully read; the Inbox pill shows a count and nothing else. This is the axis where two rivals here demonstrably do more.
- Partial coverage and provider failure are visually identical: same amber flag, same bordered block, same position, same weight. Only the block eyebrow changes (COVERAGE vs FAILURE). Three states, two appearances.
- The briefing hierarchy inverts: the 'TODAY / FULL BRIEFING' breadcrumb sits below the h1 and the Today tab's active underline drops to faint grey, so at the moment you go deeper the shell signals less about where you are.
- In Inbox the 5 OPEN count and the 'partly read' coverage caveat directly beneath it are set at near-equal weight; a count and the caveat that qualifies it should not read as peers.

Strengths worth protecting:
- The most conventional and immediately readable two-level nav: wordmark plus Home/Notes/Tasks/Timeline on tier one, the four modes plus Read Scope on tier two. No one needs to be told which row is which.
- The strongest at-a-glance quiet-versus-broken signal in the set: an amber '— PARTLY READ' flag next to the dateline that is simply absent on a quiet day, so presence itself carries meaning.
- My work has the best ledger rhythm of the four — right-aligned lateness and date against left-aligned title — which lets you scan the responsibility list vertically without reading it.

---

### overall 8.4 · owned 8.6 · **Pass**

**Required correction.** Give Inbox the same structural care Today and My work already have: group the asks under one thread title instead of repeating the title per ask, and normalise the rule lengths to the column so the hairline system reads as a system. Then field the Analytics metadata the way A does, and delete the duplicated quiet-day sentence.

Weakest evidence: `editorial__inbox__owner_signature__1440x960__fold.png`

Concerns:
- Inbox loses the threading. '2 ASKS IN THIS THREAD.' floats as a mono label with no visual grouping beneath it, and the same title, Confirm final numbers with the Orchard kitchen, is then printed twice as two independent rows. It reads as duplication rather than as a conversation. A is materially better here.
- Rule lengths are ragged and the raggedness has no logic. In editorial__inbox three horizontal rules of three different extents stack inside 130px. In editorial__analytics the black section rule spans x303 to x1038 while the indigo rule directly under it stops at x830. On Today the same pair are equal length. This looks like a bug in a page whose whole authority rests on rules.
- The top chrome is not aligned to the column it sits above. The masthead hairline runs roughly x259 to x1181, the mode row is full-bleed, and the content column is x303 to x1038, with the Home is reading control ending at about x1140. Three different extents in the first 130px of the most disciplined design here.
- editorial__analytics degrades into a slab. Under the numeral, four to five sentences of near-identical grey sit in an undifferentiated stack with no fielding, no rules and no weight change. This is the one place where A's fielded metadata is clearly better.
- On the quiet day the honest paragraph ends 'Nothing you are carrying crossed a rule today' and then a standalone line 90px below says 'Nothing crossed a rule today.' The same sentence twice, at two weights.

Strengths worth protecting:
- The most typographically confident work in the set and the only one that reads as a position rather than a layout. Small-caps mono dateline, a large tight Geist headline, a real standfirst, then numbered entries in a grey monospaced margin with underlined titles. It commits to a 740px measure at 1440 and leaves the rest as margin, which is restraint, not emptiness.
- Two earned signature moments. The colophon (HOW THIS PAGE WAS READ, three columns, hairline above) is a genuine broadsheet device that also solves a product problem: it is where the accounting, the actor, the scope and the unsupported-source notes are parked, out of the reader's way but on the page. And the dateline carries a three-step colour ladder, nothing for a complete read, amber PARTLY READ in editorial__today__provider_failure, red COULD NOT BE READ in editorial__today__new_user, all in one fixed slot at the top.
- The quiet day is the most honest screen in the whole lab, and editorial__my-work is the best-composed page anyone produced. owner_quiet compresses to headline, one paragraph, one line and the colophon, with no heading for an empty section and no placeholder rows. My work sets the section head left with its definition small-caps right-aligned to the rule, and rows with the title left and lateness right-aligned in red above a grey date, which is a real listings-page move that makes late items scannable without a single chip.

---

### overall 8.5 · owned 8.4 · **Revise**

**Required correction.** Give the Inbox a visible, consistent way in and disambiguate it: one link per event whose name carries disposition, actor and subject, never two identical names in one thread and never a bare 'Open'. Then bring the colophon's coverage and accounting material within reach of the top of the read, either anchored or disclosed in place, so honesty does not depend on scrolling to the end.

Weakest evidence: `editorial__inbox__owner_signature__1440x960__fold.png`

Concerns:
- The Inbox arrival state shows no visible way into anything. Rows are links but carry no underline, no chevron, no open control, so the queue reads as a static digest. The lab notes its row actions live inside an opened event, which the captures do not show, but the way in is exactly what is missing.
- Two links in the same thread carry identical accessible names ('Confirm final numbers with the Orchard kitchen' twice) and point at different events, and one stray anchor is named only 'Open'. That is the classic ambiguous-target failure for detail-open, by pointer and by screen reader alike.
- Outside Analytics there is no disclosure anywhere. The accounting sentence, the actor, the Active Project and the unsupported-source notes are all parked in the foot colophon of a 2582px page, roughly 2000px below the fold, with no anchor from the top and no return.
- Depth is the weakest of the four in the chrome: Today to Full briefing is an inline breadcrumb line under the H1 rather than a held position. Nothing in the composition implies movement, so every mode change reads as a whole-page replacement.

Strengths worth protecting:
- Strongest evidence-at-the-fold in the lab. The limit statement sits near the top of the document in every scenario and names its own kind: 'COVERAGE - PARTLY READ', 'FAILURE - PARTLY READ', 'SCOPE - COULD NOT BE READ', each with a plain sentence ('1 project did not answer at all. Nothing here counts it as zero, and no total includes it'). Three different limits read as three different things without the reader moving.
- The amber dateline marker survives the transformation to 390 intact, so the phone reader gets the same warning as the desktop reader in the same place. Its chrome is also the shortest at 390, so a mode change costs the least travel of the four.
- Analytics opens its receipts in place: 'See the records behind this' is a real disclosure control sitting directly under the claim it supports, so reaching a receipt never costs position.

---

### overall 8.6 · owned 8.6 · **Pass**

Weakest evidence: `editorial__inbox__owner_signature__1440x960__fold.png`

Concerns:
- Inbox looks inert. On arrival there is no action affordance anywhere on the queue, so the mode whose entire job is 'what needs my response' reads as something to be read rather than worked. I accept that the row actions live inside an opened event and are not captured here, but the arrival state is what the founder meets first and it does not look operable.
- It never earns its width, in any mode. At 1440 it is a 740px column with roughly 400px of dead space to its right on Today, Inbox, My work and Analytics alike. Analytics in particular is where a founder wants to compare a Project ledger, and it stays in reading measure. A direction that behaves identically at 740px and 1440px has not made a composition decision about the machine it runs on.
- Mobile is a compressed desktop, not a transformation. editorial__today__owner_signature__390x844.png is the same column, narrower, at 3440px tall.
- Read health is scoped to the current mode only, so the founder learns nothing about the other three without visiting them.
- The README's own verdict is fair: this is the least assertive identity of the four. It is excellent and it is nearly anonymous. That is a real strategic cost for a front door.

Strengths worth protecting:
- The best single sentence in the lab, in the best possible position. The standfirst under the headline is the verdict: 'This is not an all clear: something crossed a rule, and 2 other things are unresolved.' One line under the masthead tells a founder both the state of the work and how far to trust the read. Nothing else here answers the 7am question that economically.
- A disciplined three-step honesty ladder pinned to one fixed spot beside the dateline: nothing on a clean read, amber PARTLY READ on partial coverage and provider failure, red COULD NOT BE READ on new_user, each paid off by a labelled block that names the kind (COVERAGE, FAILURE, SCOPE). A quiet day and a broken provider are unmistakably different, which is the hardest thing in this brief and this is the cleanest solution to it.
- The most composed quiet state. editorial__today__owner_quiet__1440x960.png is one screen: headline, one honest sentence, colophon, nothing else. No furniture invented to make an empty day look busy. And editorial__my-work__owner_signature__1440x960__fold.png is the best single mode composition in the lab, with lateness ledgered right and the coverage caveats stated before the list rather than after it.

---

### overall 8.7 · owned 9 · **Pass**

**Required correction.** Earn one widening on Analytics for the Project ledger rather than holding the reading measure everywhere, and separate the lateness red from the could-not-be-read red so the reserved signal stays reserved.

Weakest evidence: `editorial__analytics__owner_signature__1440x960__fold.png — Analytics runs as a single ~740px column inside a 1440 window with roughly 450px left empty. The brief asks Analytics for prose-led opening plus one earned widening for the Project ledger, and this direction never widens; the mode that most needs a ledger gets the same measure as everything else.`

Concerns:
- Least assertive identity of the four, as the brief predicted. At 1440 it occupies the middle 840px and leaves the rest as margin on every mode, which reads as unused canvas rather than deliberate reserve.
- Amber is shared by partial coverage and provider failure; only the block label (COVERAGE vs FAILURE) separates them. That is one rung short of a fully separated ladder, though the sentence inside each block is unambiguous.
- Red is doing two jobs on Today: three red lateness strings sit inside the capped three while red is also the reserved colour for COULD NOT BE READ. The reserved signal is diluted by the routine one.
- Inbox row metadata stacks onto a second unaligned line ('Not read yet   Still open'), so the queue's rhythm is looser than My work's, which is properly ruled and right-aligned.

Strengths worth protecting:
- The numbering is the cap. 01, 02, 03 sit in a monospaced margin against the three ranked decisions and nowhere else — Needs review, Coming up and Moving well are unnumbered, and the full briefing drops numbering entirely. The device appears exactly where editorial judgement was exercised and vanishes when the cap is lifted. Nothing else in the lab makes the cap feel earned rather than imposed.
- The read's honesty arrives before the first row: 'This is not an all clear: something crossed a rule, and 2 other things are unresolved' sits directly under the headline in reading type, then a labelled coverage block carries the specific sentence. The reader knows the state of the read before spending attention on any item.
- A three-state flag in one fixed position beside the dateline — nothing on a clean read, amber PARTLY READ, red COULD NOT BE READ — with the quiet day carrying no flag at all. A quiet day and a broken provider are different at a glance at the very top of the page, which is the hardest thing in this brief and this is the cleanest answer to it.

---

### overall 8.7 · owned 8.8 · **Revise**

**Required correction.** Fix the unit-less reason sentences ("This has waited 7 days", "This has been quiet for 6 days") and delete the duplicated Coming up reason line — keep the eyebrow or the sentence, not both. Then give the colophon's unknown column visible precedence over the identity column so a source that could not be read does not sit at the same weight as the reader's own name.

Weakest evidence: `editorial__today__owner_signature__1440x960.png — the Needs review block prints three numbers with no unit attached: "This has waited 7.", "This has been quiet for 6.", "This has been quiet for 4." Seven what. On a surface whose thesis is that every number names what it counted, three unlabelled integers sit above the fold on mobile. The same block also duplicates itself in Coming up: the right-hand eyebrow says "Due in 4 days" and the reason line one line below says "Due in 4 days." — on four consecutive rows.`

Concerns:
- Three unit-less numbers in Needs review, repeated at 390 where they land above the fold. This is the exact defect my lens exists to catch, and this direction exposes it most.
- Verbatim self-duplication on four Coming up rows: eyebrow "Due in 5 days" over reason "Due in 5 days." It reads as unedited output, not authored copy.
- On the quiet day the unknowns sit in a three-column colophon at the identical size and colour as "READING IT / Orla / You own these projects". The NO SOURCE CONNECTED label rescues it, but an unknown and a person's name should not be set the same.
- editorial__inbox__owner_signature__1440x960.png loses the thread: "2 ASKS IN THIS THREAD." floats above two rows that each repeat the title "Confirm final numbers with the Orchard kitchen" in full. The reader cannot tell it is one thread; it reads as a duplicate.

Strengths worth protecting:
- The only direction that leads with the truth. The honest sentence is the standfirst, directly under the headline, on every scenario: "This is not an all clear: something crossed a rule, and 2 other things are unresolved." It also declines correctly — "3 other things" on partial coverage, "1 other thing is unresolved" at scale. Nobody else puts the caveat first, and putting it first is the whole argument.
- Finest degradation vocabulary in the lab, and the only one that separates the classes above the fold: FAILURE · PARTLY READ on provider failure, COVERAGE · PARTLY READ on partial coverage, SCOPE · COULD NOT BE READ on new user — each in a ruled block with the amber or red dateline flag beside "READ AT 08:40 ON THURSDAY 16 JULY."
- The most rigorous number statement anywhere in the evidence, on editorial__inbox__owner_signature__1440x960.png: "Inbox. 5 open, 1 could not be verified. 0 projects could not be read." The count is decomposed rather than asserted. Its Analytics is likewise the only one to surface "No accepted baseline" on every single claim, and to label the ledger "Every project in what Home is reading, including the ones it could not."

---

### overall 8.7 · owned 8.9 · **Pass**

**Required correction.** Earn one widening on Analytics and My work so the Project ledger and the claim receipts use the canvas the reading measure leaves idle, cutting several hundred px of scroll from the two tallest modes. Cover interaction.tsx with tests for the failure and recovery paths and confirm its reduced-motion behaviour before the 9.5 gate.

Weakest evidence: `editorial__analytics__owner_signature__1440x960__fold.png — a ~740px measure that never widens, so Analytics runs 3,808px desktop and 4,693px mobile while roughly 45% of a 1440 canvas sits empty beside every claim. The brief asked for one earned widening for the Project ledger and Editorial declines it, spending scroll it did not have to spend.`

Concerns:
- Worst ratio of page height to canvas used. Second-tallest at both viewports (today 3,440px at 390, the tallest Today in the lab) while using the least horizontal room. Every claim, every ledger row and every colophon column is constrained to the reading measure whether or not it is prose.
- The colophon parks the accounting, the actor and the unsupported-source notes at the foot of a 2,582px page. On provider_failure the top flag points to it, but the reader must travel the whole document to reach the substance.
- interaction.tsx uses useSyncExternalStore with a module-level row store and a setTimeout ref. That is a hand-rolled store on a route the validator marks reviewTier: critical. It is small and it works server-first, but it is bespoke state management that will need its own tests and a reduced-motion path.
- Least assertive identity of the four, exactly as the brief predicted. At 1440 the arrival screen is a headline and three numbered rows in the middle 740px; nothing marks it as an operating layer rather than a page.

Strengths worth protecting:
- The only candidate in the lab that actually built any of the sixteen required journeys — 5 <button> elements against 0, 0, 0 for the other three — and the measured cost is one route-local client island: editorial/interaction.tsx, 462 lines, 15,301 B raw / 4,089 B gzip of source. It is the sole 'use client' file in the entire lab. Route-local means it lands in the route chunk, not shared_runtime, so the 0.9 KB headroom is untouched. This is the only real evidence in the lab of what hydrating Home costs.
- The state ladder is three-way legible at a fixed reading position and costs one CSS rule: nothing on a quiet day, amber '— PARTLY READ' beside the dateline on provider_failure, red '— COULD NOT BE READ' on new_user. A quiet day and a broken provider are unmistakably different at a glance without a legend, an extra query, or a byte of JS.
- Cheapest stylesheet in the lab at 5,898 B gzip, and zero arbitrary-px type against 56 named steps. Fewest moving parts of any direction: one centred column, no rail, no sticky, no grid to reflow.

---

### overall 9 · owned 9.2 · **Pass**

**Required correction.** Separate 'no data yet' from 'data could not be read' as distinct states with distinct colour. The new_user screen must not carry the red failure flag or the phrase 'one source did not answer in full', and must end in a real first action rather than a colophon note. Reserve red exclusively for a source that failed.

Weakest evidence: `editorial__today__new_user__1440x960__fold.png — a person's first ever screen carries a red 'COULD NOT BE READ' flag and the sentence 'one source did not answer in full', then a colophon ending 'There is no project for new work to go to yet.' with no way forward.`

Concerns:
- Red on new_user is both inaccurate and unkind. A person who has just signed up has not suffered a provider failure; nothing is broken. Editorial escalates the shared shell text harder than any other candidate by giving it the alarm colour reserved for real breakage. Red must mean something is wrong, or it means nothing.
- The new_user screen offers no next step at all. Naming the state honestly is necessary but not sufficient — a dead end that is accurately labelled is still a dead end, and this is the one screen where human respect outranks epistemic precision.
- 'This is not an all clear' opens the standfirst on the fully-read day too. Saying it every morning wears the phrase out and blunts the moment it is genuinely load-bearing.
- At 1440 the page uses roughly 740px of measure inside a 1180px container, leaving about 400px of dead margin that only the colophon reaches into. The restraint is right for the read; the window handling is not resolved.

Strengths worth protecting:
- The only direction with a three-state severity token that fires only when it should: nothing on a fully-read day, an amber '— PARTLY READ' beside the dateline when coverage is limited, a red '— COULD NOT BE READ' when the read failed. A quiet day and a broken provider are unmistakably different inside the first 40px of the page, at both viewports.
- It names the kind of limit, not just its existence: 'COVERAGE · PARTLY READ' (1 project answered for part of what was asked) versus 'FAILURE · PARTLY READ' (1 project did not answer at all) versus 'SCOPE · COULD NOT BE READ'. It is the only candidate that separates a partial answer from a refusal at the fold.
- Caveats sit in the reading path, immediately above the thing they qualify. On My work: 'Read 3 of 3 projects. 0 did not answer, and nothing here counts them as empty', then '1 project has no waiting column, so nothing from it can appear as waiting' placed directly before the Waiting group. That is the single best data-truth detail in the lab — it stops an empty group being read as an absence of work.

---

