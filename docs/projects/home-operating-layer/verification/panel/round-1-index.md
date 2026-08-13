# Panel round 1 — required corrections for Reading Index

Scored blind as candidate **C**. Ten independent directors, none of whom saw another ballot,
none of whom knew which team built which, and none of whom were told the pass threshold.

**This direction did not clear admission.** The gate is: every director at least 8.5 overall
AND at least 8.5 on their own lens, no vetoes. The gate does not move.

| | |
|---|---|
| lowest overall | **7.7** |
| mean overall | 8.37 |
| lowest owned lens | **7** |
| Pass / Revise / Veto | 5 / 5 / **0** |

## Every ballot, worst first

### overall 7.7 · owned 7 · **Revise**

**Required correction.** Number only the capped three and drop or restart numbering below Today's signal, so the cap reads as judgement rather than as chapter one of twelve. Then fix the coverage index so that when scope could not be read, Inbox and My work report a not-read state rather than 'Nothing in it'.

Weakest evidence: `index__today__new_user__1440x960.png — the contents table reads 'Could not be read' for Today and Analytics but 'Nothing in it' for Inbox and My work, when no project could be read at all. Unknown is rendering as empty, inside the very component invented to prevent it. A first-time user is told they have no responsibilities, which is not known.`

Concerns:
- Continuous numbering 01 through 12 runs down the whole of Today. The capped three are 01, 02, 03 and Needs review opens at 04, so the cap becomes a section boundary inside one long numbered document rather than a judgement about what deserves attention. At 390 it reads unambiguously as a twelve-item list.
- ON THIS PAGE announces four sections before the reader has read one, on a page whose job is at most three ranked decisions. It is a second navigation system competing with the first, and on Analytics it swells to eight full-sentence entries in the margin.
- Roughly 230px of masthead index plus a form-styled CHANGE WHAT HOME READS control sit between the reader and the headline on every mode, every visit. Administrative chrome is placed ahead of the read.
- Both partial coverage and provider failure report as 'Partly read' in the contents table, so the index itself does not carry the distinction its own body copy makes.
- Layout is inconsistent across modes: the right rail is present on Today and Analytics but absent on Inbox, leaving roughly 450px of dead window on the mode with the longest queue.

Strengths worth protecting:
- The leader-dot contents table doubling as a per-mode coverage report is the best structural idea in the lab. From inside any mode you learn the read-state of the other three — Read, Partly read, Could not be read, Nothing in it — in one fixed location, without switching modes or scrolling.
- A properly calibrated severity ladder in the body: provider failure raises a red-ruled WHAT LIMITED THIS READ block into the main column above the content, while partial coverage demotes to a quiet grey note in the margin. The page shouts only when shouting is warranted.
- Analytics is the one mode where this direction's density genuinely pays: monospaced provenance, numbered claims, per-claim record disclosure and a receipts rail give it a documentary, records-first texture that suits a claims-and-evidence product.

---

### overall 7.7 · owned 7.6 · **Revise**

**Required correction.** Mark the current-most position on the Full briefing route so the index states where the reader is at depth. Then make the read's limits part of the document flow near the top in every scenario and every viewport, with one mechanism for coverage and failure alike, so the phone reader is told what was missing without scrolling to the end.

Weakest evidence: `index__today__partial_coverage__390x844__fold.png`

Concerns:
- On the Full briefing route nothing claims the current-most position at all: the briefing document contains no page-level current marker anywhere, and the contents table shows no active rule in that capture, while A, B and D all mark Full briefing. The one screen that exists to express depth from Today is the one screen where this direction cannot say where you are. That is the thesis failing on its own route.
- The coverage note is the last thing in the document. At 1440 the layout floats it into the right margin and it looks exemplary; at 390 it drops to the bottom of a page thousands of pixels tall, so the first phone screen shows three confident decisions and no statement of what was missing. Desktop honesty here is a layout accident, not a design.
- The two states of the same rule get two different mechanisms: provider failure earns a bordered WHAT LIMITED THIS READ block above the content, partial coverage gets a margin note at the very end. A reader cannot learn one behaviour.
- Tallest documents in the lab (Analytics 4054px), so every open-and-return is a long scroll, and the scope control is styled as a form field with a select caret, making the loudest thing between headline and content a widget.

Strengths worth protecting:
- The leader-dot contents table is the best cross-mode orientation device in the lab. It reports each mode's coverage from inside another mode ('01 Today .... Partly read', '02 Inbox .... Nothing in it', '.... Could not be read'), so you know the state of a place before you travel to it, and 'Nothing in it' is properly separated from 'Could not be read'.
- The sticky ON THIS PAGE rail keeps position legible inside the tallest documents here, backed by real in-page anchors, and the foot carries an explicit BACK TO THE INDEX return.
- Scope change is a native in-place disclosure rather than a route change or a modal, so changing what Home reads never costs the reader their place.

---

### overall 8 · owned 7.6 · **Revise**

**Required correction.** Decide what the right column is and let it be only that in every mode, including Inbox. Then separate the two numbering series so a section number and a row number are never the same mark in the same margin, and get the scope control out from between the headline and the first sentence.

Weakest evidence: `index__my-work__owner_signature__1440x960__fold.png`

Concerns:
- The right-hand slot has no fixed identity. On Today and Analytics it is ON THIS PAGE; on My work it is ON THIS PAGE stacked above NOTES ON THIS READ; on new_user it is NOTES ON THIS READ alone; on Inbox it is gone entirely, leaving 450px of unexplained dead margin. One slot, four behaviours. That is the kind of instability my lens exists to catch.
- Two numbering series collide in one margin column at one type treatment. On index__my-work the sections number 01 Waiting, 02 Now while the rows number 01, 02 continuously across them, producing '02 Now' containing item '03'. The reader cannot tell what the number counts.
- CHANGE WHAT HOME READS is a form control wedged between the headline and the first real sentence on every single page. It is the most repeated hierarchy fault in the set: chrome interrupting the headline-to-content move, and on index__today__owner_quiet it separates the headline from the only sentence that matters that day.
- The tallest and slowest of the four. index__analytics runs 4054px and burns roughly 500px of the 960 fold on contents table, headline and scope control before the first claim, so exactly one claim is above the fold on the mode whose job is evidence.
- At 390 the scope control does not resolve: the label wraps to two lines top-left, the value sits as a two-line block to its right, and the caret floats at the far edge with nothing aligned to anything.
- Rhythm goes loose in the quiet and new-user worlds: roughly 90px of unmodulated gap between the quote block and the next element on index__today__owner_quiet, with a stubby indigo-underlined link doing the work of a closing move.

Strengths worth protecting:
- The leader-dot contents table is the single best idea in the lab and the only navigation in the set that is also an instrument. Comparing index__today__owner_quiet (Read, Nothing in it, Read, Read), index__today__provider_failure (Partly read on all four) and index__today__new_user (Could not be read, Nothing in it, Nothing in it, Could not be read), the coverage state of every mode is legible from any mode, in one fixed place, at the fold. It answers the governing rule better than anything else here.
- The most convincing texture. Mono numbering in the margin, mono provenance in the rows, leader dots to a right-aligned status. It reads as a set of records rather than as a screen, which is the right register for a product whose claim is that it never invents a number.
- The best claim treatment in Analytics: the claim is the heading, the numeral sits under it at modest size, and each supporting fact gets its own ruled row. That is a table without being a table, and the correct answer to the giant-KPI trap. index__today__provider_failure also raises the failure into a bordered WHAT LIMITED THIS READ block with a red rule, above the content rather than at the foot.

---

### overall 8 · owned 7.6 · **Revise**

**Required correction.** The index state column must account for unsupported and unread sources, not only for project-level answering. If two sources could not be read, the row cannot say "Read" — and the Inbox row cannot say "5 · Read" while one of those five is unverified. Then hoist the honest standfirst above the first row on the signature and quiet worlds, and move the coverage notes into the right rail on all modes as My work already does.

Weakest evidence: `index__inbox__owner_signature__1440x960.png — the index at the very top asserts "02 Inbox ……… 5 ……… Read" while the note at the foot of a 3103px page says "1 item could not be checked against the source, so it is counted but not named." The most prominent element on the page claims a completeness its own footnote retracts, roughly 2,900 pixels away.`

Concerns:
- The best device is also the liability. On owner_signature the index reads Read / Read / Read / Read at the top while the foot says "This is not an all clear... 2 other things are unresolved" and "No calendar is connected." Incomplete is rendering as complete in the loudest element on the page — the precise failure the governing rule names.
- Same contradiction on owner_quiet: index says "Read" while the pull quote says "This is still not an all clear, because a kind of work has no source connected and there is no history to read."
- Inconsistent placement of coverage. My work puts it in a persistent right rail ("NOTES ON THIS READ", "WHAT THIS LIST LEAVES OUT"); Today and Inbox bury it at the foot. The reader cannot learn one habit.
- index__today__owner_signature__1440x960__fold.png is the only arrival screen in the lab with no honest opening sentence at all — headline, then a scope field, then straight into the list. Every other direction says something true about the read before the first row.
- Exposes the shared unit-less reason numbers ("This has waited 7.").

Strengths worth protecting:
- The best single truth device invented in this lab: the contents index doubles as a per-mode coverage report, so the state of a mode you are not in is legible from the mode you are in. On index__today__new_user__1440x960.png it reads Today · Could not be read, Inbox · Nothing in it, My work · Nothing in it, Analytics · Could not be read. A real empty and an unknown, correctly separated, side by side, at the top of the page. No other direction distinguishes those two states in one glance.
- Best-placed degradation notice on both viewports: a bordered "WHAT LIMITED THIS READ / NOT ANSWERING" block with a red rule, above the content, carrying "1 project did not answer at all. Nothing here counts it as zero, and no total includes it." It survives the drop to 390 intact.
- Analytics breaks each claim into ruled fielded lines so the count, the as-of date and the caveat each get their own line and equal weight — "19 open items. This is a count of items, not a share of anything." / "As read on Thursday 16 July." / "Done means the column named Done in this Project. Another Project may define it differently."

---

### overall 8.5 · owned 8.4 · **Revise**

**Required correction.** Derive each index row's coverage token from that mode's actual read, not from a page-level scenario, so 'Read' can never appear above a page carrying coverage notes. Move the per-mode caveats out of the sidebar into the reading path immediately above the group they limit, and give 'Partly read' and 'Could not be read' a visual weight or rule that separates them from 'Read' without requiring the reader to parse the word.

Weakest evidence: `index__my-work__owner_signature__1440x960__fold.png — all four index rows read 'Read' while the same page's sidebar carries two COVERAGE notes ('1 item belongs to no project…', '1 project has no waiting column…'). The page's most prominent truth token asserts a complete read that the page itself contradicts.`

Concerns:
- That contradiction is the exact failure my lens exists to catch, and it occurs inside Index's own signature mechanism. A token that says 'Read' on a page with known coverage gaps trains the reader to distrust the one element the direction is built around.
- Consequential caveats are demoted to the right sidebar beneath 'ON THIS PAGE'. On partial_coverage the entire main column is identical to the healthy day and the coverage note is grey small text in the least-read column of the page. Compare the failure case, which earns a full-width red-ruled block — the hierarchy of disclosure is inconsistent between two states that are equally load-bearing.
- 'Partly read' is set at roughly 13px, grey, flush to the far right margin, with no colour, weight or rule change from 'Read'. It reads on inspection, not at a glance, and it is the only fold-level signal on the partial_coverage screen.
- It is the densest and tallest direction — Analytics runs to 4054px — which puts more distance between a claim and the note that qualifies it.

Strengths worth protecting:
- The coverage-bearing contents table is the best structural idea in the lab. '01 Today ……… Read / 02 Inbox ……… Partly read' makes the epistemic state of every mode legible from whichever mode you are standing in, and it survives intact to 390 where the other directions' global signals thin out.
- Its four-token vocabulary is the most precise in the set: Read, Partly read, Could not be read, and — crucially — 'Nothing in it'. On new_user it correctly reports Inbox and My work as 'Nothing in it' (a true zero) while Today and Analytics read 'Could not be read'. No other candidate distinguishes an honest emptiness from an unknown at that granularity.
- On provider failure a red-ruled 'WHAT LIMITED THIS READ / NOT ANSWERING' block sits full-width above the content and states the consequence in full, and it holds that position on mobile.

---

### overall 8.6 · owned 8.6 · **Pass**

**Required correction.** Keep coverage notes adjacent to the content they qualify at 390 rather than demoting them to the foot, and give the read-scope field a proper mobile form (label above, full-width control).

Weakest evidence: `index__my-work__owner_signature__390x844__fold.png`

Concerns:
- Coverage caveats are viewport-dependent. At 1440 my-work puts 'NOTES ON THIS READ' in the right rail at eye level; at 390 the same notes drop to the page foot, so the phone reader is told about the exclusion only after passing every item it excluded. The caveat should ride with the content it qualifies at both widths.
- Heaviest chrome above the first content line on mobile: roughly 330px of 844 (39%) before the TODAY eyebrow, first decision title at y≈584. Defensible because ~190px of that is the contents table, which is content, but it is still the deepest run-up in the set.
- The 'CHANGE WHAT HOME READS' control is cramped at 390 — the label wraps to two lines and the select caret is jammed against the right edge. It is the one place the desktop composition was squeezed rather than rethought.
- My work reports 'Read' in the contents table while a coverage note says an item was left out of every count. The at-a-glance status is softer than the caveat underneath it.
- Tallest pages in the set (Analytics 4,054px at 1440), and the numbered monospace gutter costs about 11% of the 390 measure, causing more title wrapping than any other candidate.

Strengths worth protecting:
- The only candidate with a real desktop grid: a two-column body at 1440 (160–832 content, 896–1280 rail) that uses the whole window, with the right rail carrying 'ON THIS PAGE' and, on my-work, the coverage caveats — so the second column earns its place instead of being decoration.
- Genuine mobile transformation, not a stack: at 390 the sticky right rail does not collapse under the content, it becomes a wrapped footer index plus 'BACK TO THE INDEX'. It is the only direction that anticipates a reader reaching the bottom of a 3,230px phone page and needing to get back to navigation.
- The leader-dot contents table is the same component at both viewports and carries per-mode coverage in the first 300px of a phone screen: quiet reads Read / Nothing in it, provider_failure flips all four to Partly read, new_user reads Could not be read. A quiet day and a broken provider are distinguishable at 390 without scrolling.

---

### overall 8.7 · owned 9 · **Pass**

**Required correction.** Inbox must obey the index it publishes: a read with an item that could not be checked cannot be labelled 'Read' at the top with the caveat 2,800px below. Lift coverage notes to the head of Inbox and use the empty right column to carry them.

Weakest evidence: `index__inbox__owner_signature__1440x960.png — the index at the top labels Inbox 'Read' while the coverage caveat, '1 item could not be checked against the source, so it is counted but not named', sits at y≈2,860 of a 3,103px page. The one screen where the coverage report contradicts itself is the one where it matters most, and the right column stays empty for the entire page.`

Concerns:
- A leader-dot contents table is not a learned convention for primary navigation. First contact may read '01 Today ……… Read' as a table of contents for the current document rather than four destinations, and the right-hand word as a status rather than the row being a link. It is legible after one exposure; the test is whether it is legible before one.
- Inbox drops both the 'ON THIS PAGE' rail and the coverage note from the fold, so the mode with the most furniture elsewhere becomes the one with the most empty space and the least honesty at the top.
- Tallest direction in the set (Analytics 4,054px). Density is the thesis, but the contents index costs roughly 300px of vertical space on every page including the phone.
- In Full briefing the Today row loses its thick indigo rule and keeps only an indigo numeral, so at the moment of going deeper the index stops saying clearly which mode you are inside.

Strengths worth protecting:
- The single best IA idea in the lab: the leader-dot contents table is simultaneously the mode navigation and a per-mode coverage report, so from inside Today you read '02 Inbox ……… Partly read' and know the state of a mode you are not standing in.
- Grades the unknown states distinctly and consistently — quiet reads 'Nothing in it', failure relabels every mode 'Partly read' and raises a red-ruled 'WHAT LIMITED THIS READ / NOT ANSWERING' block above the content, new_user reads 'Could not be read'. Quiet, partial, broken and empty are four different pictures.
- The model survives the phone intact: at 390 all four modes stay text-labelled with their state and the failure block is still above the fold. Nothing hides under More, an avatar or horizontal-scroll discovery.

---

### overall 8.7 · owned 9 · **Pass**

**Required correction.** Replace the #f59e0b 2px border on .ri-note-strong with the same treatment .ri-note[data-tone=failure] uses (#ef4444, 3.76:1) or drop the border and let the eyebrow carry it. Give the contents-table rows a max traverse: either cap the leader run or move the state word inboard so name and state stay within one 400px window at 200% zoom. Change 'Nothing in it' to an unknown phrasing on My work and Inbox in the new_user world.

Weakest evidence: `index__analytics__owner_signature__1440x960__fold.png`

Concerns:
- The 1120px leader-dot traverse from a mode's name to its state word is a genuine low-vision and screen-magnifier problem: at 200% zoom the label and its status are never in the same viewport. Leader dots mitigate this for a sighted reader with full field, not for the readers this lens is for.
- In analytics the 'See the records behind this' disclosure puts its + affordance roughly 670px from the label, and the sticky 'ON THIS PAGE' rail is an eight-item second navigation duplicating the section headings. Two competing target-association patterns on one page.
- .ri-note-strong uses --status-flight #f59e0b as a 2px left border: 2.15:1, below the 3:1 non-text floor of WCAG 1.4.11. The eyebrow words carry the meaning so it is not disqualifying, but the border is decorative in practice and should not be doing indicator duty.
- 'Nothing in it' for My work on a brand-new user asserts emptiness where the honest answer is unknown (index__today__new_user__1440x960.png). Today and Analytics get 'Could not be read'; My work and Inbox do not.
- It is the tallest direction in the set (analytics 4054px), so keyboard and screen-reader users traverse more than in any other direction.

Strengths worth protecting:
- No faint ink anywhere: quiet and provenance text is --ink-soft #3f3f46 at 10.4:1 on white, 2.3x the AA floor, and the mono provenance at 12px is set in it too. Zero rules in index.css pair an 11-12px step with a low-contrast ink, against 9 in editorial and 22 in rail.
- Semantic colour is confined to non-text marks and the words stay at full ink: .ri-fact-late is color:var(--ink) with a 6px #ef4444 dot before it, and .ri-note-tone escalates from --ink-soft to --ink (#111, 17.4:1) when the tone is failure or permission. State never rides on hue, and the failure label gets darker, not brighter.
- The leader-dot contents table exposes every mode's coverage state as literal text in the accessibility tree, so a broken provider reads 'Partly read' on all four rows from whichever mode you are in (index__today__provider_failure__1440x960__fold.png), and new_user separates 'Could not be read' from 'Nothing in it' per mode. Backed by real <ol> for the ranked decisions and 12 h3 entry headings.

---

### overall 8.8 · owned 9 · **Pass**

Weakest evidence: `index__inbox__owner_signature__1440x960__fold.png`

Concerns:
- Two navigation systems on one page. The mode index at the top and ON THIS PAGE on the right. On Today the right rail lists four sections that are all within one scroll, which is close to the empty furniture the brief rejects, and on index__inbox__owner_signature__1440x960__fold.png it is absent altogether, leaving roughly 450px of nothing beside a narrow queue. The widest direction has the emptiest Inbox.
- It spends the most vertical space before the work. At 1440 the headline sits at y=372 and the first ranked decision at y=596, so on a 960 viewport a founder sees two of the three decisions on arrival. The mode defined as 'at most three ranked decisions' should show three.
- CHANGE WHAT HOME READS is drawn as a bordered form control, repeated on every mode, sitting between the headline and the content. It is honest and labelled, but it is product-form furniture inserted into an editorial page at the exact point where the decisions should be.
- Provenance and people's names are set in monospace ('Tasks · Nora & Cian'). It buys a records-first texture at the cost of legibility on the most-scanned metadata in the product, and human names read as machine output.
- The tallest pages in the lab (Analytics 4054px), which compounds the vertical cost above.

Strengths worth protecting:
- The leader-dot mode index is the strongest product idea in this lab and the only system-scale answer to the governing rule. It is the navigation and a four-line health report on the whole Home layer at once. On provider_failure all four modes read 'Partly read'; on new_user they read 'Could not be read / Nothing in it / Nothing in it / Could not be read'; on the quiet day 'Read / Nothing in it (0) / Read / Read'. A founder learns how far to trust every mode without entering any of them.
- It draws the exact distinction the rule cares about, in words, in the same slot: 'Nothing in it' for a true zero and 'Could not be read' for an unknown. No other direction separates those two in the navigation, and separating them there is what makes a quiet day and a broken provider different before you have read a single word of content.
- The strongest editorial identity with no ornamental chrome, and the only direction that genuinely composes for a wide screen. On My work and Analytics the right margin carries real marginalia (coverage notes, the index of claims), which is editorial craft rather than dashboard furniture.

---

### overall 9 · owned 8.8 · **Pass**

**Required correction.** Build the six state-transition journeys before the 9.5 gate and re-measure the route chunk — Editorial's island is the only existing datum for what that costs. Widen the Project ledger and the Analytics claims into the right third below the sticky rail to recover several hundred px of scroll. Confirm the scope control meets 44x44.

Weakest evidence: `index__analytics__owner_signature__1440x960__fold.png — the tallest page in the lab at 4,054px desktop and 5,049px on a phone (six full 844px screens). The sticky ON THIS PAGE rail earns some of that back, but the Project ledger still never widens into the right third that the rail leaves free below its four links.`

Concerns:
- 48 @media blocks, the most of the four (rail 37, desk 33, editorial 38). Two-column-plus-sticky-rail at desktop collapsing to linear at 390 is the most responsive surface area to maintain and the most to regress. This is maintenance cost, not ship risk.
- Tallest direction in the set on both axes: analytics 4,054/5,049 px, inbox 3,103/3,389, briefing 3,246/3,927. Density is a stated part of my lens and Index spends the most scroll.
- Zero <button> and zero <form> across all of index/. Journeys 5–11 (mark read without resolving, snooze, approve, fail-and-recover, clear, writeback) are entirely unbuilt, so its apparent lightness is measured against an incomplete build. The interaction cost is unpaid, not avoided.
- The CHANGE WHAT HOME READS control is styled as a form field roughly 40px tall; the brief requires 44x44 CSS px for primary controls. Verify before promotion.

Strengths worth protecting:
- The leader-dot index is the best answer to the governing rule in the lab, and I verified it is free. modeStateLine() in lib/home-layer/candidates/index/labels.ts is a pure lookup into copy.states[today|inbox|myWork|analytics .state] — props assemble.ts already builds for every candidate on every render. Index displays the coverage data the other three compute and throw away: zero extra queries, zero extra JS, four modes' condition legible from any one mode.
- Survives the budget outright. Zero <script> tags; disclosure is native <details>/<summary>; 6,361 B gzip of CSS; zero font-size:Npx arbitrary utilities against 60 var(--) named steps, so it adds nothing to the 1,208-utility pile. Nothing here touches shared_runtime, so the 0.9 KB is untouched.
- Best scale behaviour measured. index__today__scale__1440x960__fold.png absorbs a 42-count badge and 22 held-back items with no layout change at all, and Today still shows exactly three. The index row is a fixed-height container whose cost does not grow with data.

---

