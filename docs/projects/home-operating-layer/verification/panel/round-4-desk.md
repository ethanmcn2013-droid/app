# Panel round 4 — what still blocks Signal Desk

| | |
|---|---|
| lowest overall | **7.4** (gate 8.5) |
| mean overall | 8.71 |
| lowest owned lens | **6.8** (gate 8.5) |
| Pass / Revise / Veto | 9 / 1 / 0 |

**1 of 10 directors are below the bar.** Only they block you. Everything else already passes.

## The ballots that block you, worst first

### overall 7.4 · owned 6.8 · Revise

**Required.** Replace the <b> row actions with real controls and quantify what they cost. Ship the Inbox and My work dispositions as buttons or forms backed by a route-local client island, publish its gzip size against total_client_js, and write down the same import ban Editorial wrote: no useTaskPanel, useTasks, useDomain, useColumnConfig, usePersonalization or useCalendarFrame, directly or transitively. Until that number exists, Desk's budget claim is unevidenced.

Weakest: `desk__inbox__owner_signature__1440x960__fold.png — every row action on the page is an inert <b>`

Concerns:
- Every row action is drawn but not built. In the rendered HTML the Inbox and My work actions are <ul class="dk-rowacts"><li data-available="true"><b>Mark as read</b></li>… — plain bold text inside a list item, not a button, not a link, not focusable, with zero forms and zero client modules anywhere in the direction. Desk shows four action affordances on every Inbox row and none of them is a control. This is the exact 'no dead controls' prohibition, and it means journeys 5 through 9 are unbuilt.
- Because the mechanism is missing, Desk's apparent zero client cost is a false measurement, and it is the direction with the largest hidden bill. Four inline actions per row across 42 rows at the scale fixture is the densest interactive surface in the lab, and inline dispositions on Inbox rows are precisely where Home is tempted to reach for useTaskPanel/useTasks — hard constraint 2. Editorial wrote that boundary down; Desk has not acknowledged it exists.
- Largest CSS payload of the four: 62.4 KB raw / 16.4 KB gzip, against Rail's 34.4 / 6.3. That is 2.6x the leanest direction in render-blocking bytes shipped on every Home route, for a page that is otherwise the leanest thing here.
- Three <nav> landmarks on today and analytics against two for the other three directions, because the IN THIS READ index is a fourth navigation region. Workable, but it needs an explicit accessible name and a decision about whether an in-page contents list should be a nav at all.

---

## Passing ballots — read these to know what NOT to break

**overall 8.9 · owned 9.1** — protect:
- The three-tier chrome plus the standing "THE OTHER MODES" line is the single best product-strategy idea in the lab: from inside any mode you are told, in words, the read state of the other three ("Partly read: Inbox and My work · Not enough history: Analytics", and under failure "Did not answer: Inbox, My work and Analytics"). That one line is what makes four routes feel like one operating system rather than four pages.
- The rule under the headline is a working coverage instrument, not decoration: solid full-width when read, split into two segments when partly read, short and red when a source did not answer, dashed when nothing is set up yet. Four states, four different pages at a glance, before a single word is parsed.
- It is the only direction where a founder can dispose of work without leaving the read. Inbox and My work both carry live row actions (Mark as read, Snooze, Clear from Inbox, Mark as done, Change who owns it), and refused actions are struck through with the reason attached ("Approve at the source — This one is not an approval").

**overall 9 · owned 9.4** — protect:
- A four-state rule ladder under the headline where the state is always announced by a bold word first and colour second: solid black + "Read.", a gapped rule + "Partly read.", a red rule + "Did not answer.", a dashed rule + "Nothing set up yet." Colour never carries a state alone, and the four are distinguishable at arm's length in every capture including 390 (desk__today__provider_failure__390x844__fold.png).
- It defends the short list at the exact place a reader would misread it. Under each truncated section on the failure screen: "Some sources did not answer, so this list can be short. Short is not empty." And it refuses to print a total at all: "The read cannot be accounted for exactly... No total is shown rather than a total that would be wrong." This is the governing rule made operational rather than merely stated.
- Absence is reported structurally, not as emptiness. My work says "1 project has no waiting column, so nothing from it can appear as waiting" and "1 item belongs to no project, so it is left out of every project count here." Analytics says "Not enough history. 6 of 14 comparable daily readings. The earliest this can show a trend is 24 July 2026", with "THE RECORDS BEHIND THIS (21 COUNTED, 2 LEFT OUT)" attached to the claim.

**overall 9 · owned 9.2** — protect:
- Caveats sit next to the claim they qualify, not only in a footer. The line "Some sources did not answer, so this list can be short. Short is not empty." is repeated inside every affected list on the failure screen, which is the only device in the lab that catches a reader at the exact point they would misread a short list as a complete one. The disclosure is also announced at the top ("2 notes at the foot say what this read could not see") and paid off at the bottom under "What this read could not see".
- Refusal copy is the best in the lab. Every unavailable control carries its own reason in words on the row: "Only an open item can be snoozed", "This one is not an approval", "You have already read this". Nothing is greyed out without saying why.
- Analytics gives every number a provenance: the denominator ("3 open items past due of 19 open items"), the as-of date, a named limitation, and a completeness figure ("THE RECORDS BEHIND THIS (21 COUNTED, 2 LEFT OUT)"). The milestone claim states outright "this can only under-count. It is not a statement that the rest are safe."

**overall 9 · owned 9** — protect:
- The only direction that separates the two levels by ground rather than by a rule: warm paper carries the shell, a white slab carries the document, so 'where I am in the app' and 'what this page says' are materially different planes. The two-level model is legible before a single word is read.
- Level 2 is a real tab row with an indigo underline plus a mode eyebrow (TODAY / INBOX / MY WORK / ANALYTICS) plus a mode-specific h1 — three redundant signals for the current mode, and the most conventional of the four.
- The 'THE OTHER MODES' strip states, in plain English and in the chrome, the coverage state of the three modes you are not in ('Partly read: Inbox and My work · Not enough history: Analytics'). Read state becomes navigation, which is exactly what this architecture needs.

**overall 8.7 · owned 8.6** — protect:
- The headline rule is a coverage instrument, not decoration: solid black when the read is complete, split into two segments when it is partial, short and dark red when a source did not answer, dashed when nothing is set up. Four states, one typographic element, legible from across the room. It is the best-earned signature in the lab because it encodes the governing rule in type rather than in a badge.
- It is the only direction that makes a decision about the canvas. A warm ground with a white content plate reads as paper on a desk, and the left margin carries a live IN THIS READ contents with per-section counts rather than sitting blank. The width is answered, not left over.
- The spine markers carry state by shape as well as by fill: filled indigo square for unread, hollow square for read, hollow circle for snoozed, and an open dashed marker on the row whose project could not be read. Never colour alone, and the unknown row is visibly a different kind of thing.

**overall 8.9 · owned 9** — protect:
- Refusals render as refusals, in place. On an Inbox row the live actions sit as plain links and the impossible ones are struck through with their reason on the same line: 'Approve at the source — This one is not an approval', 'Snooze — Only an open item can be snoozed', 'Mark as read — You have already read this'. No dead control, no mystery-disabled button, and it survives intact at 390. This is the clearest interaction contract in the lab.
- The spine glyph is a state vocabulary rather than decoration: filled indigo square for open/unread, hollow square for read, open circle for snoozed, dashed crosshair for an item whose project could not be read. Shape carries the state and text repeats it, so it holds under forced colours. The headline rule works the same way — solid when fully read, gapped on partial coverage, short and red on failure.
- Evidence disclosure is in-place and pre-counted. 'THE RECORDS BEHIND THIS (21 COUNTED, 2 LEFT OUT)' and 'TRUE OF EVERY READ, NOT OF TODAY (2)' are collapsed summaries that state the size of what is behind them before you open them, so you reach a receipt from a claim without leaving the claim. The chrome is also stable across all four modes and the briefing, so a mode switch moves nothing but the content.

**overall 8.8 · owned 8.9** — protect:
- The cap is proven to be judgement, not a limit. Today shows 'Today's signal 3' in the contents rail and '7 more qualified for today's signal and are not shown here'; the briefing shows the identical structure with 'Today's signal 10'. The reader sees the edit and the uncut version in the same grammar. No other candidate closes that loop.
- One line of persistent chrome ('THE OTHER MODES · Partly read: Inbox and My work · Not enough history: Analytics') saves three speculative mode visits every morning, and it flips to 'Did not answer: Inbox, My work and Analytics' on failure. Highest value per pixel of any device in the lab.
- Three distinct rule states under the headline — solid black (read), red (did not answer), dashed (nothing set up yet) — each paired with a lead word. A quiet day and a broken provider are distinguishable in peripheral vision, at 1440 and at 390.

**overall 8.8 · owned 8.7** — protect:
- The only direction that publishes a written key for its own marks. The foot legend states in plain words that every mark repeats something the row already says, then lists all five shapes with their meanings (filled square / open square / open circle / filled dot / break). Nothing on the page needs colour to be understood, and the page says so.
- Quiet, failure and new-user are separated on four redundant channels at once: the rule under the headline changes treatment (solid black / red / dashed), the lead phrase changes ("Read." / "Did not answer." / "Nothing set up yet."), an extra section appears at the foot on failure ("What this read could not see"), and the spine breaks with its own glyph. A greyscale reader and a colour-blind reader both get it at a glance.
- Per-mode coverage is a sentence, not a badge: "THE OTHER MODES · Partly read: Inbox and My work | Not enough history: Analytics" sits under the mode row at full text contrast, on every screen, at both viewports.

**overall 8.6 · owned 8.6** — protect:
- Best content-per-phone-screen in the set. At 390 the header is a compact ~205px carrying all four text-labelled modes on one line, the scope control and the per-mode coverage line, and the first decision title lands at y≈550 of 844 with two decision titles visible on the signature world.
- Rows genuinely reflow: "Needs review" is title-left / provenance-right at 1440 and stacks to title-then-meta at 390. The "IN THIS READ" contents rail is dropped on the phone rather than stacked, and its counts survive inside the section headings, so nothing is lost and no wall is created.
- Unknown stays unknown through a non-colour device that survives the transform: solid black rule for a complete read, red rule for a failed one, dashed rule for nothing-set-up-yet. All three are legible at 390, and new_user's "Open Tasks" is fully above the fold at y≈578.

