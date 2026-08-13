# Panel round 2 — required corrections for Reading Index

Scored blind as candidate **C** by ten fresh directors after your round-1 remediation.

| | |
|---|---|
| lowest overall | **6.9** |
| mean overall | 8.12 |
| lowest owned lens | **6.8** |
| Pass / Revise / Veto | 3 / 7 / **0** |

Read `SYSTEMIC_FINDINGS.md` first: four of these concerns were raised against ALL FOUR
directions, so they are the shell or the brief, not you. Do not spend your round on them.

## Every ballot, worst first

### overall 6.9 · owned 6.8 · **Revise**

**Required.** Rebuild the desktop grid so the rail is anchored to the top of the content and the top-right is not dead space, and reconcile the two right edges. Give the index table a right margin and a real mobile transformation that keeps the leader-dot device legible at 390 and 320. Make the failure state change the page's colour, not only its words.

Weakest: `index__today__owner_quiet__1440x960__fold.png — the content ends at roughly y=580, the 'THIS READ' rail floats at y=575 with nothing beside it, and two-thirds of the window is unresolved white. This is not intentional sparseness; the grid has simply not been composed.`

Concerns:
- Every 1440 capture has a permanently empty top-right quadrant of roughly 600×520px, because the content column stops at 832 while the rail starts at 896 but does not begin until hundreds of pixels down the page. The rail's vertical origin moves between captures (y≈520, 575, 620, 693), so it is flow-positioned rather than anchored. The arrival screen looks unfinished.
- Two competing right edges in the header: the dateline and scope control align to 832, the rail aligns to 1248. Nothing reconciles them.
- At 390 the index table has no right margin — 'Not answering' runs into the viewport edge — and the leader dots collapse to two or three glyphs, destroying the device the direction is named for. Mobile is a compressed desktop, not a transformation, and this is close to the 320px overflow floor.
- Failure is signalled by swapping hollow squares for filled black squares and adding a 2px red left rule. Compare index__today__owner_signature__1440x960__fold.png with index__today__provider_failure__1440x960__fold.png: at a glance they are the same screen. The governing rule is satisfied only by reading words.
- Heavy monospace in row metadata ('Tasks · Nora & Cian') on top of mono nav and mono labels pushes the texture toward a terminal rather than a records page.

Protect these:
- The leader-dot contents table is the best single idea in the lab: it is simultaneously the mode navigation and a per-mode coverage report, so the health of a mode you are not in is legible from the mode you are in. Nothing else here does that.
- 'WHAT LIMITED THIS READ' as a bordered block with a red left rule, placed above the content rather than at the foot, is a clear and honest disclosure device.
- The two-column claim body on Analytics (the count, then what it counted beside what it cannot say) is well set and reads as a records page rather than a dashboard.

---

### overall 7.2 · owned 7 · **Revise**

**Required.** Resolve the right column — either commit to the sticky on-this-page rail across the whole scroll or drop it and use the width for the ledger; the floating block over a hole is not shippable at the promotion gate. Put real controls on Inbox rows, and collapse the lower Today sections on small screens.

Weakest: `index__inbox__owner_signature__1440x960__fold.png — the Inbox arrives with no visible way to act on anything. Threads, dispositions and a stale-source warning are all rendered as flat prose with no Open, no mark-read, no snooze. It reads as a report about the Inbox rather than an Inbox.`

Concerns:
- The 1440 composition is broken. In index__today__owner_quiet__1440x960.png and index__analytics__owner_signature__1440x960__fold.png the content column stops around 830px while the "THIS READ" block floats in the right third with roughly 500px of nothing above it. It is the only candidate whose page has a visible hole in it.
- The Home mode row and the Suite product row are set in near-identical small monospace caps stacked two lines apart, so "which of these is the suite and which is Home" is not visually resolved. Weakest suite legibility of the four.
- Mobile is an uncollapsed dump. index__today__owner_signature__390x844.png runs 3,217px with Needs review, Coming up and Moving well all fully expanded — 13 rows below the three decisions on a phone. The direction that costs the most vertical space also edits the least.
- New user gets "Could not be read" on all four contents rows and one link to the full briefing. No action, no explanation of what a project is.

Protect these:
- The leader-dot contents table is the most original structural idea here and the best coverage report in the lab: from any mode you can read the state of every other mode in plain words — Partly read, Not enough history, Nothing in it, Could not be read. That is exactly what the governing rule asks for, expressed in words rather than colour.
- Provider failure is unmistakable — index__today__provider_failure__1440x960__fold.png flips all four contents rows to "Not answering" and raises a red-ruled "WHAT LIMITED THIS READ" block above the content, and the quiet day carries neither.
- The monospaced provenance and numbered margins give the page a records-first texture that suits Analytics better than any other direction's.

---

### overall 7.5 · owned 7.6 · **Revise**

**Required.** Resolve the two-column grid — either land the aside against something real and top-aligned, or drop the second column and let the index own the full measure. Then give rows a visible open affordance and Inbox rows real dispositions, and prove the leader-dot table at 320px and 400% zoom before this direction is judged again.

Weakest: `index__today__owner_quiet__1440x960__fold.png — the left column stops at roughly 590px, the right aside starts at roughly 575px and runs to 870px, and the entire top-right quadrant of a 1440 screen is empty. A quiet day is exactly where composition has nowhere to hide, and this is the clearest picture of a grid that was never resolved.`

Concerns:
- The two-column grid is unresolved in every single capture I opened. The 'THIS READ' aside begins somewhere between 450px and 700px down with nothing above it and ends with hundreds of pixels of nothing below it; on the full-page Today at 1440 the right 40% of a 2,408px document carries about 250px of content. This is not generous margin, it is an alignment that relates to nothing, and it recurs on Today, Inbox, My work, Analytics, briefing, quiet, failure and new_user alike.
- The 'ON THIS PAGE' rail that would justify a second column — the sticky list of the four Today sections — is not present in the rendered evidence. The column that costs a quarter of the screen carries four sentences. The in-page navigation aid the direction was built around does not appear.
- No visible action and no visible open affordance on any row in any mode. index__inbox__owner_signature__1440x960__fold.png shows 'Mentioned you' and 'Replied to you' as plain headings with metadata beneath and nothing to press — no Open, no Mark as read, no Snooze, and no underline to indicate the row is even a link. On my lens this is the weakest detail-open story of the four by a clear margin.
- At 390 the direction's own signature component is at the edge of failure: 'Partly read · Not answering' and 'Not enough history' run to within about 16px of the viewport edge and the leader dots crush to two or three. The 320px floor and 400% reflow are live risks for the one component the direction is named after.
- new_user dead-ends with no forward control, and carries the same wrong inherited standfirst ('one source did not answer in full') for a person with no projects.

Protect these:
- The leader-dot contents table is the best orientation idea in the lab. It is simultaneously the mode navigation and a per-mode coverage report, so standing in Today you can read that Analytics has 'Not enough history' and Inbox is 'Partly read' without going there; on a failure day every row reads 'Partly read · Not answering'. Nothing else here tells you the state of a place you are not standing in this completely.
- It is the only direction whose navigation caught the Analytics limitation on the signature day that the other three's navigation missed, and it is genuinely data-driven rather than a fixed string — at scale the same row correctly reads 'Read'. On the governing rule that is a real point in its favour.
- Depth and return are marked most literally of the four: Full briefing nests as an indented child row under Today inside the index, the active rule moves to sit under it, and an explicit 'Back to Today' link sits directly beneath the headline. 'WHAT LIMITED THIS READ' is a consistently named, consistently positioned, red-ruled block above the content in every limited scenario, and 'BACK TO THE INDEX' closes the page.

---

### overall 8.2 · owned 8.4 · **Revise**

**Required.** Stop labelling a fully-answered day "Partly read" — reserve that label for reads that were actually partial, so the word means something when it appears. Re-draw the Inbox numeral so an incomplete count cannot present as a total, and give new_user a non-failure state with a first step.

Weakest: `index__today__new_user__1440x960.png`

Concerns:
- The new_user screen is four rows of "Could not be read" and a SCOPE note, with no first step offered anywhere. It is the harshest arrival in the set — a person who has done nothing wrong is shown a page that says, four times, that reading them failed.
- The discriminator is over-spent. On a genuinely quiet, fully-answered day Today still reads "Partly read · Not connected" in the index. When "Partly read" is the resting state, its appearance on a real partial read carries no information and the reader is forced to parse the second clause in small grey type.
- The Inbox badge is a closed, confident indigo pill reading "5" on the same screen whose ledger says the Inbox read was partial and one item "is counted but not named." A count that is admittedly incomplete is being drawn as a total.
- Per-claim exclusions in Analytics are hidden behind "See the records behind this" rather than stated inline, so the count and what was left out of it are not visible together.

Protect these:
- The leader-dot index is the best cross-mode truth instrument in the lab. Standing in Today you can read that Inbox is "Partly read", that Analytics has "Not enough history", that on a quiet day Inbox is "Nothing in it" and not "Could not be read". No other direction lets you see the health of a mode you are not standing in.
- "WHAT LIMITED THIS READ" is a properly ranked disclosure: it sits above the content, is labelled by kind (NOT ANSWERING / COVERAGE / SCOPE), carries a red left rule only when a source actually failed, and states the consequence — "Nothing here counts it as zero, and no total includes it."
- It holds up on mobile. At 390 the index and the limitation block both survive above the fold on provider_failure, with the first decision still reachable on the same screen.

---

### overall 8.3 · owned 7 · **Revise**

**Required.** Fix the contents row before anything else: give the status column a real right gutter, set a minimum leader-dot run, and define what the row does when the dots run out — wrap the status under the label, truncate with the full string still available, or drop to a two-line row. Then prove it at 320px and at 200% text enlargement with the longest status string ('Not enough history') and the two-digit badge both present. Separately, align the right rail's top with the content it annotates at 1440.

Weakest: `index__today__scale__390x844__fold.png — the direction's signature device breaking. Row 01's status column ('· Not connected') runs flush to x≈390 with no gutter at all, while every other element on the page respects a 16px margin, and the leader dots between label and status have collapsed to a four-or-five dot stub. Row 04's shorter 'Read' still clears at x≈374, which proves the row is being squeezed by string length rather than styled that way. Reproduced independently in index__today__owner_signature__390x844.png and index__today__provider_failure__390x844__fold.png.`

Concerns:
- The thing that makes C distinctive is the thing that fails first at width. A leader-dot contents table needs slack between label and status; at 390 there is none left and the longest status string is already eating the page margin. At 320px, or at 200% text enlargement, this row cannot hold, and the brief's floor is no horizontal page scroll at 320px. This is not a polish note — it is the direction's identity and its navigation in one element.
- The right rail is vertically misplaced at 1440 in a way that reads as a rendering accident rather than a composition: it begins at y≈520 on Today and y≈550 on Analytics, leaving a large empty rectangle in the top-right above it (index__today__owner_signature__1440x960__fold.png, index__analytics__owner_signature__1440x960__fold.png). On Inbox the rail holds only two lines in a 355px column (index__inbox__owner_signature__1440x960__fold.png).
- For 'the widest of the four', it uses a 672px content column and a 355px rail inside 1440, leaving roughly 190px of unused right margin — the width claim is not borne out by the pixels.
- It is the second-tallest at 390 (3217px on Today) and the tallest of all at 1440 on Analytics, so a phone reader pays for the density twice.

Protect these:
- The strongest answer in the lab to the governing rule, and it is legible from any mode. The contents table doubles as a per-mode coverage report, so in provider_failure every row flips to 'Partly read · Not answering' with filled squares and a red-ruled 'WHAT LIMITED THIS READ' block appears, while a quiet day reads 'Nothing in it' and 'Not enough history' with hollow squares (index__today__provider_failure__1440x960__fold.png vs index__today__owner_quiet__1440x960__fold.png). Filled against hollow is shape, not colour alone, and it survives to 390 (index__today__provider_failure__390x844__fold.png).
- The mobile relocation of the 'THIS READ' rail to the page foot, closed by a 'BACK TO THE INDEX' link, is a considered small-screen affordance rather than a leftover (index__today__owner_signature__390x844.png).
- The two-column note grid inside each Analytics claim — an earned widening at 1440 — collapses cleanly to a stacked list at 390 with no loss of labelling (index__analytics__owner_signature__1440x960__fold.png vs index__analytics__owner_signature__390x844__fold.png).

---

### overall 8.4 · owned 8.5 · **Revise**

**Required.** Restore labelled limit fields to Analytics so the caveat is named as a caveat, and bring back the per-metric 'No accepted baseline' line. Rewrite new_user so it stops reading as four system failures and carries a stated next step in the main column, not the rail. Move the account sentence up beside the claims it accounts for.

Weakest: `index__analytics__owner_signature__1440x960.png`

Concerns:
- Analytics drops the labels its sibling directions keep. What B sets as 'COUNTED / CANNOT SAY / WINDOW' becomes two unlabelled grey columns, so 'Done means the column named Done in this Project. Another Project may define it differently.' sits beside the number 19 with no word telling the reader it is the claim's limit rather than more description. Same facts, weaker trust.
- 'No accepted baseline' disappears from every metric. That is not decoration, it is a real statement that the number has no reference point, and C is silent on it across all seven claims.
- new_user is the worst first screen of the four. Four index rows all reading 'Could not be read', a 'SCOPE' block, and the only constructive sentence, 'There is no project for new work to go to yet.', demoted to the bottom of the right rail with no control attached. It tells a brand new person four times that the system failed.
- The accounting sentence is spatially divorced from what it accounts for. 'Signal read 22 items, showed 8, held back 2...' lives in the right rail whose top edge starts roughly 520px down, well below the headline and standfirst it qualifies.
- Project ledger heading is 'Every project you can read' with no clarifier that unreadable projects are included, the same ambiguity as A.
- Row-level redundancy in Coming up: 'Due in 5 days.' as a body sentence and 'Due in 5 days' again in the metadata line directly beneath it.

Protect these:
- The single best structural truth idea in the lab. The leader-dot contents table reports coverage for the modes you are not in, from the mode you are in: '01 Today ……… Partly read · Not connected', '02 Inbox 5 Partly read', '04 Analytics ……… Not enough history'. Nobody else tells you at the fold that Analytics has insufficient history before you go there.
- Its zeros are earned and its failures propagate. On a quiet day Inbox reads '0 · Nothing in it', which is a zero that was actually read. On provider failure all four rows change to 'Partly read · Not answering', so the damage is reported system-wide rather than only on the mode in front of you.
- Limits are typed and placed above the content they qualify. 'WHAT LIMITED THIS READ' is a red-ruled block carrying a named kind, 'NOT ANSWERING', 'COVERAGE' or 'SCOPE', with the sentence beneath it. Placement before the claims is the right order.

---

### overall 8.4 · owned 8.6 · **Revise**

**Required.** Close the top-right hole: either top-align the rail so the index and the rail start together, or narrow the page so there is no orphan column. Then give new_user a real next step in the body rather than a briefing link that cannot resolve — the scenario that has no data is the one that most needs an action, not another coverage report.

Weakest: `index__inbox__owner_signature__1440x960__fold.png — one thread is visible above the fold at 1440 while a roughly 420×580 block of white sits beside it, because the right rail begins level with the body rather than at the top. The same hole appears in all seven 1440 captures I opened for this candidate, and on quiet and new_user it is more than half the viewport. An empty rectangle that persistent is an invitation for someone to fill it with the dashboard widget furniture this brief rejects.`

Concerns:
- new_user is a functional dead end: four modes reading Could not be read, a SCOPE block, and the only link out is Open the full briefing, which would fail for the same reason. Editorial ships an Open Tasks button in the same scenario. This is a first-ever screen phrased entirely as a failed read with no route forward.
- Tallest mode in the lab at mobile — Analytics reaches 4619px at 390 — and the second tallest overall.
- Inbox at arrival ships zero buttons and no action affordance on the row; dispositions (Not read yet, Still open) are plain text. Journeys 5 to 9 are unevidenced.
- Two position:fixed rules plus one sticky is the second-largest layout-thrash surface, and untested at 200%/400% zoom where sticky rails habitually eat the viewport.

Protect these:
- The best structural answer to the governing rule in the lab. The leader-dot index doubles as navigation and as a per-mode coverage report, so the state of a mode you are not in is legible from the mode you are in. Filled square plus Not answering for failure, hollow square plus Partly read for partial, 0 · Nothing in it for a genuinely empty Inbox, Could not be read for a dead scope. Comparing index__today__partial_coverage and index__today__provider_failure side by side, the two are unambiguous, and the distinction survives without colour.
- Cheapest and calmest to run: 8.1 KB gzip stylesheet, longest motion duration 44ms, two prefers-reduced-motion blocks, forced-colors handled, zero client JavaScript, zero hardcoded hex across 478 var(--) references, zero font-size:Npx. 22 @media queries is the most responsive work of the four and reads as care rather than bloat.
- Every limitation is escalated into its own labelled, red-ruled WHAT LIMITED THIS READ block above the content, with the specific cause named (SCOPE, COVERAGE, NOT ANSWERING) rather than folded into prose.

---

### overall 8.5 · owned 8.7 · **Pass**

**Required.** Give the new user one action, as B does, and stop "BACK TO THE INDEX" appearing on the index. Pull the right rail up to the top of the content column so the arrival screen has no empty quadrant, and take the vertical out of the body — Analytics at 4054px is not a prose-led opening, it is a document.

Weakest: `index__today__new_user__1440x960.png — four "Could not be read" rows, a SCOPE block, and the only link out is "Open the full briefing" into a briefing that will also be empty, closed by "BACK TO THE INDEX" on a page that is itself the index. A first-time user is handed a circular dead end.`

Concerns:
- It is the tallest direction in the lab (Today 2685, Analytics 4054). The honesty is cheap because it lives in the navigation, but the body is not — it asks the most scrolling of any candidate once you are past the fold.
- At 1440 the right-hand "THIS READ" rail does not start until roughly y=525, leaving a large empty top-right quadrant on arrival. On index__today__provider_failure__1440x960.png the rail ends around y=850 against a 2318px page, so most of the right column is void. The eye has to work out where the second column begins.
- No next action for a new user, and "BACK TO THE INDEX" appears at the foot of the index itself.
- Monospaced provenance, leader dots and numbered margins give a documentary texture that is handsome but raises per-row reading effort; on a 60-row day this is the direction that will tire a reader fastest.
- The failure signal is carried largely by small text at the right edge of the index rows. The red rule on the limited-read block is the only strong visual cue, and it is modest in the overall composition.

Protect these:
- The only direction that never claims health it does not have. The leader-dot index reports per-mode coverage from every mode — "01 Today ……… Partly read · Not connected", "04 Analytics ……… Not enough history" — and on index__today__provider_failure__1440x960.png every row flips to "Not answering". Analytics withheld its trend in all four candidates; C is the only one that tells you so from Today. That is the governing rule honoured across modes, not just within a page.
- Best arrival screen in the lab. index__today__owner_signature__1440x960__fold.png fits the index, the headline, the standfirst and all three ranked decisions plus the withheld-count line above 960. Nothing you need on arrival is below the fold. Coverage failures also get their own red-ruled "WHAT LIMITED THIS READ" block placed above the content it limits, so the warning arrives before the trust does.
- The cap reads as ranked judgement because the numbering is exclusive to it: 01/02/03 on the three, and no numbers at all on the Needs review, Coming up and Moving well rows below. The ranking is visibly a decision about three things, not a section that happened to stop.

---

### overall 8.6 · owned 9 · **Pass**

Weakest: `index__today__new_user__1440x960__fold.png — the index reports 'Could not be read' four times down a near-empty page, with no start affordance on the fold and only 'Open the full briefing' offered. The instrument that is this direction's greatest asset turns a first run into four repetitions of failure.`

Concerns:
- Numbering collision. 01–04 number the modes and 01/02/03 number the signal entries, in the same view, in the same mono margin style. Two live numbered sequences on one screen is a genuine convention hazard and undermines an otherwise excellent index.
- The shell is the loudest of the four. Roughly 210px of masthead in near-h2-scale sentence case sits above the h1 on every page, on every mode. The brief asks the shell to be quieter than the content; this one competes with it.
- Composition at 1440 is unresolved: the right-hand THIS READ rail floats with a large empty region above it and no top anchor, and on owner_quiet and new_user the page is mostly white with that block hanging in space. A quiet day risks reading as an unfinished page rather than a composed one.
- There is a real risk the index reads as a table of contents for the current document rather than as four destinations, especially where a sticky on-this-page rail also exists.

Protect these:
- The clearest two-level model in the lab, and the clearest by some distance. Products are set in mono capitals; then a section label reading HOME; then the four modes as a numbered leader-dot index in large sentence case. The index literally says 'these four belong to Home', so the hierarchy is stated rather than implied.
- The only candidate whose orientation surface reports every mode's coverage in words, from every mode, and the only one that names Analytics as 'Not enough history' at owner_signature. Rail calls that same mode 'Read' and desk and editorial leave it unmarked. Under 'unknown stays unknown', naming insufficient history in the navigation is the single most correct behaviour anyone showed me.
- Full briefing nests as an indented child bullet under 01 Today inside the index, with the active rule spanning the Today group. Depth is drawn as depth. Failure states get their own consistent slot too — a bordered WHAT LIMITED THIS READ block with a red rule, in the same position on every mode.

---

### overall 9.2 · owned 9.4 · **Pass**

**Required.** Give the index row a wrapping or truncation-with-full-name behaviour before 320px and 200% text, so the state phrase can never be the thing that is lost, and add a prefers-reduced-motion block.

Weakest: `index__today__scale__390x844__fold.png — the four index rows carry a number, a label, leader dots, a badge, a mark and a two-part status phrase inside 44px, with the status text landing 16px from the right edge. It holds, but there is no headroom left for a longer state phrase or for text-only enlargement.`

Concerns:
- The index row is the densest 44px in the lab. It survives 390 today, but a longer status phrase, a wider count or 200% text-only zoom all pressure the same line, and it is the navigation, so it is the worst place to lose room.
- Analytics at 1440 sets two roughly 330px prose measures side by side inside a single claim. It is the only place in the direction where reading order and reflow are asked to do work the rest of the page does not.
- Analytics runs to 4054px, the tallest page in the lab, which is a real traverse cost for anyone reading by magnifier or scroll.
- The stylesheet declares forced-colors but no prefers-reduced-motion block.

Protect these:
- The best structural answer in the lab to unknown stays unknown. Every mode's state is a word in the navigation itself: Partly read, Not connected, Not answering, Not enough history, Could not be read, Nothing in it. The mark is redundant to the word, and the state of a mode you are not in is legible from the mode you are in. Compare index__today__owner_quiet__1440x960.png against index__today__provider_failure__1440x960.png: the nav alone tells them apart.
- Measured facts back the composition. Minimum contrast on Analytics at 1440 is 6.29:1; zero contrast failures across 125 text runs at 390; the index rows are exactly 44px tall with 16px gutters on both sides and no horizontal overflow at 390 in either the failure or the scale world. It also ships the most precise aria-current in the lab, page on the exact mode and true on subtree matches, plus two skip targets and one status region.
- Counts are never bare. The Inbox badge's accessible name is a full sentence, Inbox. 42 open. 1 could not be verified. 0 projects could not be read, and the quiet world renders 0 beside the words Nothing in it rather than a lone zero.

---

