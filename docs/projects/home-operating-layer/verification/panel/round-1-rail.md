# Panel round 1 — required corrections for Context Rail

Scored blind as candidate **D**. Ten independent directors, none of whom saw another ballot,
none of whom knew which team built which, and none of whom were told the pass threshold.

**This direction did not clear admission.** The gate is: every director at least 8.5 overall
AND at least 8.5 on their own lens, no vetoes. The gate does not move.

| | |
|---|---|
| lowest overall | **5** |
| mean overall | 6.81 |
| lowest owned lens | **4.2** |
| Pass / Revise / Veto | 0 / 9 / **1** |

## Every ballot, worst first

### overall 5 · owned 4.2 · **Revise**

**Required correction.** The rail must not stack whole on mobile — collapse it to a single mode row with the scope control, and keep the wordmark, product links, actor and Account out of the first phone screen. Swap the band colours so the total failure is not the calmer one, and drop the boxed Inbox panel. If the rail can only exist as a full stacked block at 390, this becomes a Veto: the direction's signature would then exist only above 1024px.

Weakest evidence: `rail__my-work__owner_signature__390x844__fold.png`

Concerns:
- The mobile failure is structural, not cosmetic. At 390 the entire sidebar dumps as a 512px tinted block — 61% of the first phone screen is wordmark, four modes, three product links, a scope control, 'Work you start from here goes to Mara & Finn' and an Account link — before a single word of the answer. The headline lands at y≈573; the first decision title at y≈769 with its supporting sentence cut by the fold.
- On my-work at 390 the entire first screen is navigation, a headline and two caveats. Zero work items. The mode that answers 'what am I responsible for?' shows nothing you are responsible for on arrival.
- The four modes reflow into a 2×2 tile grid on mobile — the shape closest in the set to the explicitly rejected four equal summary cards.
- The desktop grid is mode-dependent and arbitrary: Today leaves 448px (31% of the window) unaddressed on the right, then Inbox fills that same space with a rounded bordered 'THIS READ' panel — the only rounded container in any candidate, and precisely the dashboard widget furniture the house rules reject.
- Severity is inverted. provider_failure gets a red-ruled band; new_user, where Home could read no project at all, gets an indigo-ruled band. The worse state is coded calmer.
- 'Open the full briefing' is a bordered button here and a text link everywhere else, adding product furniture to the quietest screens.

Strengths worth protecting:
- Per-mode coverage labels in the rail ('Partly read' under each of the four modes, 'Nothing in it', 'Could not be read') are a good idea and they do survive the reflow to 390 as a second line in each cell.
- The provider_failure band with a red left rule is the loudest failure signal of the four at 1440.
- Shortest page in the set at 1440 (Today 1,565px), so a desktop reader scrolls least.

---

### overall 5.2 · owned 4.8 · **Veto**

**Required correction.** I would not carry this forward as a visual direction. If it is carried anyway, the bordered summary card in Inbox must be deleted outright rather than restyled, the outlined button reverted to a link, the empty Today's signal heading removed from the quiet world, and the mobile chrome cut so the headline is the first thing on the screen. Even with all four fixed, the direction still has no signature moment of its own.

Weakest evidence: `rail__inbox__owner_signature__1440x960__fold.png`

Concerns:
- rail__inbox contains the one piece of explicitly rejected furniture anyone shipped: a rounded, bordered, tinted panel in the top right holding THIS READ, OPEN NOW 5, WHAT HOME IS READING, STATE OF THIS READ and WHEN A SNOOZE COMES BACK. That is a dashboard widget. The house rule is rules, alignment, type and whitespace before containers, and this is a container doing work a ruled definition list would do better. It also leaves 400px of void beneath it while the content column is squeezed to 350px.
- No earned signature moment. A tinted 240px sidebar with a filled active row is a convention, not a position. Strip the content out and this is any competent SaaS shell; that is precisely the competent-default outcome the brief asks me to reject.
- At 390 the first screen is 61 percent chrome. rail__today__owner_signature__390x844 gives roughly 515px of the 844 to wordmark, HOME group, modes, PRODUCTS group, scope, actor and account before the headline appears, and the single most important sentence in the product sits at about y615. The modes also reflow into a 2x2 grid, which is a card-grid habit applied to what the brief defines as four fixed text-labelled modes in order.
- Empty furniture on the quiet day. rail__today__owner_quiet renders a Today's signal section heading with an indigo rule over the sentence 'Nothing crossed a rule today.' A heading for a section with no items is exactly the furniture the brief prohibits, and B shows it was avoidable.
- Container-first everywhere else too. Coverage notes are grey bands with indigo left rules, repeated identically and stacked two-deep on rail__my-work above a third ABOUT THIS LIST block, so roughly 190px of notice furniture precedes any content. 'Open the full briefing' is rendered as an outlined button, the only button chrome in the entire lab, where a link would do.
- Proportion is unresolved at 1440. A heavy full-height tinted slab at 240px, a content column of about 670px, and then roughly 450px of dead white on every mode, with the quiet and new-user worlds leaving a further 500px empty below. The page never decides whether it is a column or a spread.
- rail__analytics repeats the page headline verbatim as a section heading 180px below itself ('What the records support.' then 'What the records support'), and inverts the hierarchy by leading each block with the numeral and demoting the claim to a body-weight line.

Strengths worth protecting:
- Content rows are clean and the right-aligned lateness with the date beneath it is the correct pattern, matching B.
- The shortest page in the set (Today at 1565px against 2383 to 2685), so a reader is asked to scroll least.
- Per-mode state lines under each nav label do satisfy the governing rule: rail__today__provider_failure shows Partly read on all four, rail__today__new_user distinguishes Could not be read from Nothing in it.

---

### overall 6.6 · owned 6.9 · **Revise**

**Required correction.** Cannot be admitted as it stands. Either drop the Inbox split entirely and run one queue at full measure, or make the panel sticky, widen the queue past 560px and fill it with real correspondence rather than a static read summary. Separately, the mobile transformation must put the headline above the navigation block — collapse the rail to a labelled row or a sheet so the first phone screen is content, not chrome.

Weakest evidence: `rail__inbox__owner_signature__1440x960.png — the three-column trap the brief named in advance, walked straight into. A 225px rail, then a queue column of roughly 335px in which titles wrap to two lines at a 1440 viewport, then a bordered summary card that stops after ~500px and leaves the remaining ~1,600px of page height as dead white beside the queue. The panel is a static THIS READ summary, not correspondence or detail, so the split is not earned; and the reading column at desktop is narrower than the effective measure the same content gets on a 390px phone.`

Concerns:
- Chrome-first mobile arrival. In rail__inbox__owner_signature__390x844__fold.png and rail__today__owner_signature__390x844.png the wordmark, four modes, three products, scope control, actor line and Account occupy roughly the first 490px of an 844px viewport, so more than half the first screen a founder sees on a phone is navigation. That is a compressed desktop, not a transformation.
- Its density win is partly bought, not designed: two whole Today sections ('Coming up 4', 'Moving well 2') are collapsed behind <details> on mobile — 4 <details> against 1 for editorial and index — so the shortest page is also the one that hides the most.
- Largest stylesheet in the lab at 6,849 B gzip / 1,858 lines, 16% more gzip and 31% more lines than Editorial, for visibly the plainest content. Most CSS per unit of expression.
- At 1440 the content measure ends near x=992, leaving ~450px of empty canvas — the widest waste in the lab on Today, while simultaneously being the most cramped on Inbox.
- Zero <button>, zero <form> across all of rail/. All six state-transition journeys unbuilt.
- Bordered summary card on Inbox is container-first, against the house rule that puts rules, alignment and rhythm before containers.

Strengths worth protecting:
- Best measured density in the lab and it is not close: Today 1,565px desktop against 2,383–2,685 for the others, and 2,026–2,475px on a phone across scale, provider_failure and partial_coverage where the others run 2,736–3,598. Analytics is the shortest at 3,626px mobile against Index's 5,049.
- The persistent rail is genuinely free. It is static server markup in the layout with no client shell behind it, and the per-mode 'Partly read' sublines come from the same props lookup Index uses. Strongest persistent orientation in the set at zero runtime cost.
- The only direction that earns a widening for the Project ledger — in rail__analytics__owner_signature__1440x960.png the 'Every project you can read' table breaks out past the claims measure — and it refuses the trend chart honestly ('Not enough history yet. 6 of 14 comparable daily readings').

---

### overall 6.6 · owned 6 · **Revise**

**Required correction.** Move every caveat class (.rl-claim-limit, .rl-scope-coverage, .rl-group-note, .rl-action-why) off --ink-faint onto --ink-soft. Stop using #ef4444 as text; keep the words at --ink and let a mark carry the hue, as C does. Give entry titles h3 so the outline has a second level. Reorder the 390 layout so the h1 precedes the products, scope, as-of and actor block. Render the quiet-day coverage notes expanded by default.

Weakest evidence: `rail__my-work__owner_signature__1440x960__fold.png`

Concerns:
- Twenty-two rules in rail.css pair an 11-12px step with --ink-faint #71717a, the worst in the set by a factor of two, and the text that lands there is disproportionately the honesty content: .rl-claim-limit, .rl-scope-coverage, .rl-group-note, .rl-action-why. The caveats are the faintest words on the page, which inverts the governing rule as a legibility matter. 4.83:1 on white and 4.72:1 on --paper-soft is a bare pass, not a standard.
- My work right-aligns '4 days late' roughly 700px from the title it belongs to, in #ef4444 as running text: 3.76:1, a clear AA failure for normal-size text. The pairing also detaches at magnification, where the title and its date are never in the same viewport.
- Two h2 and zero h3 on Today, the flattest document outline of the four. A screen-reader user navigating by heading cannot reach an individual entry, only a section, on a page whose whole purpose is three ranked entries.
- At 390 the entire nav block (wordmark, four modes, three products, scope control, as-of, actor, account) precedes the h1: roughly 445px of chrome, about half the first screen, before the reader reaches 'What is asking for you now.' (rail__today__owner_signature__390x844.png). Every other direction clears its chrome in 140-215px.
- On the quiet day the coverage notes are collapsed behind 'How this read was taken' (rail__today__owner_quiet__1440x960.png). The one thing the governing rule insists must be visible is a click away, and only one sentence in the standfirst survives on screen.
- Nine declared 44px targets, the fewest, and one :focus-visible rule.

Strengths worth protecting:
- The persistent rail carries a per-mode coverage sub-label, so on a broken read all four modes show 'Partly read' at once and on new_user they split into 'Could not be read' and 'Nothing in it' (rail__today__provider_failure__1440x960__fold.png). This is the best always-on answer to the governing rule in the set and it never leaves the screen.
- The only Inbox with explicit per-item 'Open' links rather than a whole-row hit area, and the only direction with a real bordered button. Disclosures carry their counts ('Coming up 4', 'Moving well 2'), so a collapsed section states its size before you open it.
- Motion is confined to a prefers-reduced-motion: no-preference block across nine animation declarations, so a reader with motion off gets the finished screen.

---

### overall 6.8 · owned 6.4 · **Revise**

**Required correction.** Rebuild mobile as a transformation rather than an unstacked rail — the headline and the first decision must be on the first screen, with mode navigation compact and complete. Then make the capped three visibly ranked against the sections below them, and correct 'Nothing in it' to a not-read state when scope could not be read.

Weakest evidence: `rail__today__owner_signature__390x844.png — wordmark, a HOME group of four modes in a 2x2 grid, a PRODUCTS group of three, the scope control, the routing note, the as-of line, the actor and Account consume roughly the first 440px of an 844px screen. On the device where attention is scarcest, more than half the first screen is navigation and the headline is below it.`

Concerns:
- Mobile is a compressed desktop, not a transformation. The rail simply unstacks to the top, so a phone reader scrolls past the entire navigation block before reaching a single decision.
- The filled tinted active row is the loudest single element on the desktop page. The shell is not quieter than the content; it is the content's competitor.
- Today's three are unnumbered and typographically identical to the Needs review rows directly beneath them — same title size, same metadata line, same rule. The cap is invisible as a judgement; it is simply the first three rows of a list.
- At 1440 a fixed 240px rail plus a capped measure leaves roughly 450px of empty window. The direction spends width on navigation and then does not use the width it has left.
- Inbox introduces a bordered THIS READ key-value panel that restates open count, scope, read-state and three snooze times. It is the closest thing to dashboard furniture in the set and a second reading target beside the queue.
- New user shows 'Nothing in it' for Inbox and My work alongside 'Could not be read' for Today and Analytics — unknown rendering as empty, in the persistent rail the reader sees on every screen.
- The quiet day hides the accounting behind a 'How this read was taken' disclosure and offers a bordered button, where the house asks for rules and type before containers.

Strengths worth protecting:
- Per-mode read-state is persistently visible under every mode label in the rail — 'Partly read' or 'Could not be read' sits beneath Today, Inbox, My work and Analytics at all times, with no scroll and no mode switch. Orientation is the strongest of the four.
- The shortest Today in the lab at 1565px, and both the honest sentence and the coverage band sit above Today's signal with their substance stated inline rather than deferred.
- My work has the best row rhythm of the four: right-aligned lateness over date, quiet provenance, and the two coverage notes placed at the top where they qualify everything below them.

---

### overall 7 · owned 7 · **Revise**

**Required correction.** Rebuild mobile as a real transformation: the four modes must reach the top of the phone screen as a compact text bar and the navigation block must not sit between the founder and the first decision. Then either earn the desktop width in every mode or give the width back, and replace the filled-pill sidebar with chrome that is quieter than the content and recognisably this product. Delete the THIS READ panel and move its facts into the rail that already holds them. As rendered this does not clear admission, but the per-mode read state in the rail is a real asset and should survive the rewrite.

Weakest evidence: `rail__today__owner_signature__390x844.png`

Concerns:
- Mobile is disqualifying on my lens. The rail simply unstacks to the top, so on rail__today__owner_signature__390x844.png the founder scrolls past the wordmark, a 2x2 mode grid, three products, the scope control, a routing sentence, the as-of line, the actor and Account before reaching the headline. The first ranked decision is off screen on arrival. The brief requires mobile to be a transformation; this is not even a compression, it is the desktop rail rotated.
- It pays the width cost and does not collect the benefit. 240px of chrome, then roughly 450px of empty canvas to the right on Today, My work and Analytics. Only Inbox uses the space.
- The shell is louder than the content and it is generic. A pale tinted 240px column with a filled indigo active row is the default SaaS sidebar. Nothing in it says Signal Studio, and the brief rejects stock layouts on sight. Strip the rail away and the content is the plainest of the four, with no dateline, no numbering, no marks and no signature moment.
- rail__today__owner_quiet__1440x960.png is the least composed quiet state in the lab: a full-height tinted column standing beside a page that ends at y=520.
- Two pieces of rejected furniture. rail__analytics__owner_signature__1440x960__fold.png leads each claim with the numeral before the sentence, which is the closest thing here to a KPI list, and the THIS READ panel on Inbox is a rounded, bordered, filled label-and-value widget that also duplicates data already in the rail.

Strengths worth protecting:
- The rail carries per-mode read state permanently. On rail__today__provider_failure__1440x960__fold.png every mode is sub-labelled 'Partly read' and on new_user they split into 'Could not be read' and 'Nothing in it'. Same strategic insight as C, and always on screen rather than only at the top of a page.
- The only Inbox in the lab that earns its width and the only arrival state anywhere showing an on-row action. rail__inbox__owner_signature__1440x960__fold.png pairs the queue with a read summary and puts a visible Open on each event. Inbox is the throughput mode and this is the only direction that looks like a place you do work.
- HOME holding four modes above PRODUCTS holding three is the clearest statement of the taxonomy in the lab. It says plainly that Home is a section with four jobs and not a fourth product, and it is the shortest Today page in the set at 1565px.

---

### overall 7.4 · owned 7.6 · **Revise**

**Required correction.** Print the unsupported-source notes on the quiet day rather than collapsing them — a known unknown may not require a click. Give every mode an explicit coverage token including on healthy days, so silence never has to be interpreted. Rebuild the mobile arrival so the headline and first decision are above the fold with navigation reduced to a compact mode row, and replace the bordered 'THIS READ' box with ruled fielded metadata.

Weakest evidence: `rail__today__owner_quiet__1440x960__fold.png — the unsupported-source notes are collapsed behind 'How this read was taken ⌄'. What remains on screen is one sentence, a button, and roughly 600px of white. It is the only screen in the lab where a known unknown is hidden behind a click.`

Concerns:
- Collapsing the 'no calendar connected / Notes does not publish structured decisions' notes on the quiet day is the closest any candidate comes to breaking the governing rule. The standfirst still says 'This is still not an all clear', which saves it — but the specifics of what could not be read are one interaction away, and every other direction prints them.
- Absence of a label encodes 'read'. On the quiet day My work and Analytics carry no sub-label at all. Silence is a weaker guarantee than a printed token, and it means the reader can never tell 'this was read' from 'this was not evaluated'.
- The bordered 'THIS READ' key-value box on Inbox is dashboard widget furniture, explicitly rejected by the brief — and it is where 'STATE OF THIS READ: Read' lives, so the epistemic token is housed inside the one container the house forbids.
- Mobile is a compressed desktop, not a transformation. About 520px of navigation precedes the headline; on the failure case 'Partly read' appears five times before the reader reaches a single decision, and no decision is on screen at all. Today's job is to answer what deserves attention now, and on a phone it answers nothing above the fold.
- The 240px filled tinted sidebar with a filled active row is the most dominant shell of the four, against 'shell quieter than the content'. At 1440 it leaves roughly 450px empty to the right of the measure and 300px empty below the rail's own content.

Strengths worth protecting:
- Persistent per-mode coverage sub-labels in the rail mean the state of all four modes is visible at all times without scrolling, and the rail footer repeats the overall state beside the as-of line. On provider failure the page is unmistakably a failed read from any scroll position.
- It uses semantic colour correctly and sparingly: a red left rule on the failure band, an indigo rule on the coverage band. It is the only direction where the two limited states are separated by colour as well as by wording.
- Analytics carries the sharpest permission caveat in the lab — 'Assignees are not checked against who is still in the Project, so a name here may have left' — attached to the claim it undermines rather than parked at the foot.

---

### overall 7.4 · owned 7.2 · **Revise**

**Required correction.** Open the disclosure by default, or better, promote its contents out of it: the unknown notes must be visible without a click on the quiet and signature worlds, and the control cannot be labelled "How this read was taken" while it holds what the read could not see. Give Analytics a coverage footer so the mode makes good on its own opening sentence. Then decompose "OPEN NOW 5" the way the band beneath it already admits it must be.

Weakest evidence: `rail__today__owner_quiet__1440x960.png — on a quiet day the entire unknowns payload is collapsed behind a closed toggle labelled "How this read was taken". The page shows a headline, "Nothing crossed a rule today.", and a shut disclosure. The standfirst does say the day is not an all clear, but the two specific unreadable sources are invisible to anyone who does not open a control whose label does not say it holds them. A quiet day and a partly-unread day are being asked to look the same by default.`

Concerns:
- The governing rule's payload is collapsed by default on the signature and quiet worlds, at both viewports, behind process language ("How this read was taken") rather than unknown language. On my lens this is the weakest handling of the rule in the lab.
- rail__analytics__owner_signature__1440x960.png has no page-level coverage statement at all. The page ends on "Read at 08:40 on Thursday 16 July." and nothing else — while its own standfirst promises "Every number here names the records it counted, the window it read, and what it could not see." The mode densest in numbers is the one that does not say what it could not see.
- "STATE OF THIS READ — Read" sits in the Inbox panel directly below a band saying "1 item could not be checked against the source". Same contradiction as candidate C, and "OPEN NOW 5" is asserted flat with none of B's decomposition.
- Exposes the shared unit-less reason numbers ("This has waited 7.").

Strengths worth protecting:
- The rail carries per-mode state as a persistent sub-line, so coverage travels with the reader between modes rather than being re-read on each page. On provider failure all four rows gain "Partly read" and the rail foot gains it too; on new_user the rows correctly split into "Could not be read" (Today, Analytics) and "Nothing in it" (Inbox, My work). On mobile this is the first thing on screen.
- rail__inbox__owner_signature__1440x960.png has the best fielded disclosure in the lab: a THIS READ panel with OPEN NOW, WHAT HOME IS READING, STATE OF THIS READ, and WHEN A SNOOZE COMES BACK giving three exact resurfacing datetimes — including "01:30 on Sunday 25 October" and "02:00 on Sunday 28 March", both sitting on daylight-saving boundaries. Nobody else attempted temporal honesty at that resolution.
- The Analytics ledger header "HOW IT READ" is the clearest column label of the four; it names the axis rather than leaving "Read" to float as an unlabelled state.

---

### overall 8 · owned 8.6 · **Revise**

**Required correction.** Rebuild the phone as a transformation rather than a stacked rail: the mode row must be compact and the Today headline must be on the first screen. Convert the Inbox summary card into ruled metadata, and at 1440 either let the measure earn the right-hand space or intend the margin, but do not leave a quiet day as a blank field.

Weakest evidence: `rail__today__owner_signature__390x844__fold.png — the entire first phone screen is navigation. Wordmark, HOME group as a 2×2 grid, PRODUCTS row, scope control, as-of, actor and Account fill roughly 520 of 844px before the headline appears. On arrival at the mode whose job is 'what deserves attention now', a phone user sees chrome and must scroll to reach the answer.`

Concerns:
- Mobile is a compressed desktop, not a transformation. The rail unstacks to the top and becomes a wall; the brief asks for the opposite.
- At 1440 the rail plus a capped measure leaves roughly 450px of window empty on every mode, and rail__today__owner_quiet__1440x960__fold.png is close to 85 percent empty white — a quiet day that reads as an unfinished page rather than a composed one.
- The Inbox right panel is a bordered card of label/value pairs listing snooze return times for items that are not selected. It reads as dashboard widget furniture, and its 'WHEN A SNOOZE COMES BACK / Later today / Pick a time / Pick a time' block is a control legend without a control.
- Flattening four Home modes and three products into one sidebar risks reading as seven peer destinations. The group headings carry it, but only just, and Home is explicitly not a fourth product.

Strengths worth protecting:
- The least teachable-required desktop model in the set: a headed HOME group of four labelled rows above a headed PRODUCTS group of three, active mode marked by a filled row. Nobody has to learn this.
- Best structural statement of Full briefing as depth: the rail nests 'Full briefing' as an indented child under Today and highlights it while Today stays the parent. That is the two-level model drawn, not described.
- Per-mode state as a sublabel under every mode name — 'Partly read', 'Nothing in it', 'Could not be read' — with the content banner rule turning red on failure and grey on partial, so quiet, partial and broken are three different pictures at both viewports.

---

### overall 8.1 · owned 8.5 · **Revise**

**Required correction.** Design the small-screen state rather than unstacking the rail: a compact top bar carrying the four text-labelled modes and their state, with products, scope, as-of and actor demoted, so the headline is on the first screen and a mode change costs one tap and no scrolling. Then replace the THIS READ panel with material set in the page's own rules and type, and give every event one consistently named open target.

Weakest evidence: `rail__today__owner_signature__390x844__fold.png`

Concerns:
- At 390 the rail unstacks above the content on every page: wordmark, a 2x2 mode grid, three products, the scope control, the as-of line, the actor and Account occupy roughly 520px before the headline, on Today, on Inbox and on Analytics alike. The direction's single advantage, persistent orientation, inverts into the highest mode-change cost in the lab, paid on every change and every page. That is a desktop layout unstacked, not a transformation.
- At 1440 the right ~450px of Today is empty, and Inbox spends it on a bordered grey THIS READ panel that is the closest thing here to dashboard furniture, with its snooze table repeating 'Pick a time / Pick a time' as row labels.
- 'Open' is a weak link name and it is applied inconsistently: two rows expose it, the rest rely on the title link. The detail-open affordance is therefore both the best and the least consistent in the lab.
- The filled active row is the loudest chrome of the four, against the rule that the shell stays quieter than the work.

Strengths worth protecting:
- Clearest depth statement in the lab: the rail nests Full briefing as an indented child under Today with both marked, and the content opens with an explicit 'Back to Today'. Position and return are visible in the same glance, which is exactly what progressive depth from Today needs.
- Per-mode state lives in persistent navigation ('Today / Partly read', 'Inbox / Nothing in it', 'Analytics / Could not be read'), so degraded coverage is announced from wherever you stand, and the coverage sentence itself sits at the very top of the content in flow, which means it survives to 390 unchanged.
- The only direction whose Inbox shows its interaction: a visible per-event 'Open', a persistent THIS READ panel naming open count, scope, state of the read and the exact resurfacing times for snoozed events, plus in-place disclosures on Today ('Coming up', 'Moving well', 'How this read was taken') that hold Today to three ranked decisions without pushing the rest behind a route. Row links also carry a detail fragment, so opening a row moves the reader to the detail region rather than leaving them to find it.

---

