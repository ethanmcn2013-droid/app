# Panel round 4 — what still blocks Reading Index

| | |
|---|---|
| lowest overall | **6.9** (gate 8.5) |
| mean overall | 7.87 |
| lowest owned lens | **5.8** (gate 8.5) |
| Pass / Revise / Veto | 3 / 7 / 0 |

**7 of 10 directors are below the bar.** Only they block you. Everything else already passes.

## The ballots that block you, worst first

### overall 6.9 · owned 5.8 · Revise

**Required.** At narrow widths the contents index must stop being a wall: collapse it to the current mode plus a labelled disclosure (all four modes must remain text-labelled and reachable, never behind More or an icon), place it after the h1, and move the "WHAT HOME READ" block below the first decision. Give the status column a real right gutter and stop the active underline at the same edge as the hairlines, then re-test at 390 and 320. Until the first decision and the new_user action clear the fold, this direction cannot be admitted.

Weakest: `index__today__new_user__390x844__fold.png — a new person's entire first phone screen is a four-row contents index saying "Nothing set up yet" four times plus a metadata block. The h1 is at the bottom edge, the "Where to start" action is entirely below the fold, and there is no content of any kind on screen.`

Concerns:
- This is the squeezed desktop my lens is built to catch. Nothing collapses, nothing re-composes, and Today at 390 is 3122px of stacked 1440 layout. The contents index survives verbatim as a ~250px wall of navigation ahead of the headline in every scenario.
- The leader dots are retained at 390 but the status has wrapped to the following line, so the dots now lead to nothing. The device that carries the whole direction is broken by the reflow rather than adapted to it.
- At 390 the status labels ("Not connected", "Not enough history", "Read") sit flush against the right edge with no gutter while body text has ~16px, and the active-mode indigo underline runs full-bleed while the hairlines above it stop short. At 390 the right margin is already zero, which puts the stated 320px no-horizontal-overflow floor at real risk.
- On the signature world the first decision title lands at y≈790 of 844 with its body clipped; at provider_failure no decision is on the phone's first screen at all. The most important thing on the page is behind the navigation in every scenario I opened.
- At 1440 the right rail repeats largely the same "WHAT HOME READ" block on every mode and then stops, leaving roughly 500px of empty column below it on Inbox and Analytics — a second column that is present rather than earned.

---

### overall 7.3 · owned 7 · Revise

**Required.** Demote the index: headline and the three decisions come first, the contents table follows as a coverage report rather than as the masthead, and rows gain direct dispositions. If the index cannot move below the headline without losing the thesis, this should be replaced by a new structural direction rather than tuned.

Weakest: `index__today__provider_failure__390x844__fold.png — on the screen where speed matters most, a phone reader passes ~590px of contents table and page metadata before being told a source did not answer, and the headline does not appear until y≈766 of an 844px viewport.`

Concerns:
- The direction inverts the job it exists to do. Today asks "what deserves attention now", and this page answers with a table of contents about itself first: ~330px of index before the headline at 1440, and most of a phone screen at 390. The founder reads metadata about the read before reading the read.
- No dispositions anywhere. Inbox rows offer only "OPEN →", so every mark-as-read, snooze or clear costs a full navigation. As an operating layer that is the weakest of the four by a distance.
- It is the widest direction and the least resolved at width: the right column repeats near-identical "WHAT HOME READ" content on every mode and sits empty from roughly y=200–330 and below y=560. It claims 1440 and then does not spend it.
- On mobile the leader-dot rows break into a ragged two-line pattern with the status right-aligned hard against the 390 edge. Mobile here is a compressed desktop, not a transformation.

---

### overall 7.3 · owned 6.9 · Revise

**Required.** The index must survive the scroll — condense it to a persistent bar, make it sticky, or otherwise keep the four modes reachable from any scroll position. Then put the dispositions back on the Inbox and My work rows so the arrival state can be acted on, and promote scope from a 10px link to a real labelled control in persistent chrome.

Weakest: `index__today__owner_signature__1440x960.png — the full page shows the thesis failing. The contents table that IS the navigation sits at the top of a 2205px page, scrolls away, and the only recovery is a 'BACK TO THE TOP' link in the footer. Meanwhile the 550px right column holds about ten lines of text and is empty for roughly three-quarters of the page height, and it does not follow the scroll. The direction whose argument is that the index is the structure ships an index you cannot reach from inside the structure.`

Concerns:
- The mode navigation does not persist and has no substitute. Changing mode from the bottom of Today is scroll-to-top then click, on every mode, at every viewport.
- The Inbox has no row actions at all — every event offers 'OPEN →' and nothing else, and My work is the same. Mark read, snooze, clear, approve and recover are all deferred to a detail surface that is not shown, so the arrival state is read-only. That is the direct opposite of direct actions on the row.
- Scope change is a two-step. 'CHANGE WHAT HOME READS' is a 10px monospace underlined link in the right column; I could find no scope form control anywhere on the full page. The most frequently used global control in the product is the smallest, quietest thing on the screen.
- Mobile is a compressed desktop, not a transformation. On index__today__provider_failure__390x844__fold.png the reader passes roughly 750px of contents table and accounting before reaching the headline — the entire first screen is chrome.
- The right-hand column is the least-answered width in the lab: wide, mostly empty, static, and it carries the same two blocks in every mode.

---

### overall 7.6 · owned 7 · Revise

**Required.** Place the six state transitions in the composition and cost them. Decide where Mark as read, Snooze, Clear and Approve live in a records-first Inbox — on the row, in the OPEN detail, or in a disclosure — build them as real controls, add the polite status region their outcomes need, and publish the client chunk gzip against total_client_js. Trim Analytics: 4054px and 795 nodes is a chart wall made of type.

Weakest: `index__inbox__owner_signature__1440x960__fold.png — the Inbox has no dispositions whatsoever, only OPEN →`

Concerns:
- Inbox ships no actions of any kind. Not inert text, not disclosures — nothing. Rows carry READ · Not read yet, STATE · Still open and an OPEN → link, and the words 'Mark as read', 'Snooze', 'Clear from Inbox' and 'Approve at the source' do not appear anywhere in the document. Journeys 5 through 9 are not merely unbuilt, they are unplaced, so the eventual client cost has no home in the composition and cannot be estimated from what is here.
- It is the only direction with no aria-live region on any mode — zero on today, inbox and analytics, against one each for the other three. The brief requires one stable polite status region. That is consistent with having no state transitions to announce, which is the same defect seen from the other side.
- The densest and tallest direction. Analytics runs to 4054px with 795 DOM nodes, today at 390 is 3122px, and the two-column grid means the reader passes roughly 330px of index and provenance before reaching the headline on a phone. Density is the one budget it spends without discipline.
- The right column is the least earned width in the lab on the worlds that matter. On owner_quiet and on Analytics it repeats provenance that is already stated in the body, and below THIS READ it is simply empty for most of the page height. Amendment 1 asked for a second column that carries something genuinely different; this one mostly carries the same thing again.

---

### overall 7.6 · owned 7.4 · Revise

**Required.** Set the index on a single tab stop with statuses in one aligned column, and either fill the second column for the length of the page with material that genuinely differs (receipts, read-state, a running contents) or abandon the two-column canvas. Replace the tinted failure block with a ruled treatment and re-cut the mobile index so the headline reaches the first screen.

Weakest: `index__today__owner_signature__1440x960.png`

Concerns:
- The leader dots have no common tab stop. The four dot runs terminate at four different x positions and the statuses that follow do not align to a single column, so the one thing a leader-dot table must get right is the thing it gets wrong. As drawn the dots are decoration that fails to lead.
- The second column is a stub. On the full-page Today it carries content for roughly 500px of a 2205px page and is blank for the rest; on Analytics it is blank for close to 90% of a 4054px scroll. The direction that commits hardest to the full 1440 is the one that earns it least, which is precisely the failure Amendment 1 was written to remove.
- The failure state is a large pink tinted rectangle spanning both columns with its text confined to the left third, leaving a wide empty band of tint. That is a container and a lopsided one, in a house that puts rules, alignment and type before containers.
- The body carries competing left edges at roughly 116, 128, 165 and 187, and section rules, row rules and index rules start at different ones, so the page has no single spine.
- The mobile transformation kills the device. The dots run for 100px and stop with the status wrapped to the next line, and on provider_failure the headline is pushed to around y=738 on an 844px screen, so the answer to what is asking for you now is entirely below the fold behind the index, the scope block and the alert band.

---

### overall 7.6 · owned 7.3 · Revise

**Required.** The contents table must earn its toll or shrink. Either collapse it to a single line after first arrival (keeping the four status words, dropping the numbered leader-dot rows), or move it below the headline so the decision leads and the index follows. On mobile it must not be possible for the first screen to contain zero decisions — least of all on provider failure.

Weakest: `index__today__provider_failure__390x844__fold.png — the contents table, then the WHAT HOME READ panel, then the red limitation block, and only at y≈738 the headline, with the standfirst cut off at the fold. On a phone, on the worst morning of the month, the first screen contains no decision at all — only three stacked layers of the page describing itself.`

Concerns:
- The contents table costs about 290px above the headline on every arrival, in every mode, forever. On day one it is orientation; on day two hundred the reader knows the four modes and the only live information is four status words on the right — which Desk and Rail deliver in a single line at a tenth of the cost. It front-loads navigation ahead of the decision the page exists to deliver.
- The right column (WHAT HOME READ / THIS READ) is structurally identical on every mode and every scenario. Roughly 450px of the 1440 is a fixed metadata panel that never varies, which is how a reader learns to stop looking at a region of the screen.
- The quiet day still renders the full contents table and both right panels above a single-sentence answer. Nothing was invented to look busy, but nothing stepped back either — this is the worst chrome-to-content ratio in the lab on the day that most needs restraint.
- Inbox rows offer only 'OPEN →'. No mark-as-read, no snooze, no clear on the row. Every disposition costs a navigation, which is the slowest daily triage of the four.
- At 390 the right-aligned status text runs flush to the viewport edge — 'Not answering' terminates at x≈373 of 390. Longer strings will clip or overflow, and the baseline floor is no horizontal scroll at 320px.

---

### overall 8 · owned 7.6 · Revise

**Required.** Set the "Open Tasks" button label to white on indigo (4.5:1 or better) before anything else; this blocks the first-run screen. Raise the monospace provenance to at least 4.5:1, and give Inbox rows a real disposition target of 44px rather than a single small "OPEN" link.

Weakest: `index__today__new_user__1440x960.png`

Concerns:
- The primary action on a new person's first ever screen fails contrast. "Open Tasks" is near-black text on indigo #4f46e5, roughly 3:1, short of the 4.5:1 required for a button label. This is the one control Amendment 2 says must exist, and candidate D ships the identical button with white text and passes, so this is a defect rather than a taste difference.
- Provenance is set in a light warm monospace ("Tasks · Nora & Cian") measuring around 3:1 at ~12px. Provenance is required to be quiet but always visible; at this contrast it is quiet but not reliably visible.
- Inbox events expose one small "OPEN →" link, roughly 46x14px, as the only per-row target. Every disposition is deferred to a detail view that is not in evidence, so on a phone the whole mode is a stack of sub-44px text links.
- At 390 the contents-table status wraps onto its own right-aligned second line, splitting each mode's name from its state and putting the two on different lines and different alignments.
- The pink failure band spans the full page width and runs under the right column, displacing the "THIS READ" panel. The failure notice and the read panel collide in the same horizontal band.

---

## Passing ballots — read these to know what NOT to break

**overall 8.7 · owned 9.1** — protect:
- The contents table is a per-mode coverage report, which no other direction achieves. From inside Today you can read that Inbox is "Partly read" and Analytics has "Not enough history"; on the failure screen all four rows read "Partly read · Not answering". The health of a mode you are not looking at is legible in words from the mode you are in, at the top of every page and at both viewports.
- Escalation is structural rather than tonal. "WHAT LIMITED THIS READ" appears as a plain bordered note for coverage and as a red-ruled tinted block for a source that did not answer, and the right column swaps its accounting sentence for "The read cannot be accounted for exactly, because at least one source did not answer in full. No total is shown rather than a total that would be wrong."
- The strongest first screen and the most complete claim receipts. new_user sets all four index rows to "Nothing set up yet", says "This is not a failed read, and it is not an all clear either", and gives the only filled primary action in the set. Analytics fields every claim as COUNTED / LEFT OUT / CANNOT SAY / BASELINE, including "2 of 23 records were left out of this" and "No accepted baseline".

**overall 8.8 · owned 9** — protect:
- The leader-dot contents table is the best per-mode truth device in the lab. "01 Today ……… Read · Not connected", "02 Inbox ……… Partly read", "04 Analytics ……… Not enough history" makes the state of a mode you are not in legible from the mode you are in, in words, on every screen and at both viewports. On a quiet day the Inbox row reads "Nothing in it" rather than showing a bare zero.
- Analytics states more provenance on the face than any other candidate: COUNTED, LEFT OUT, CANNOT SAY and BASELINE are all visible without a click, and "2 of 23 records were left out of this" is printed on all seven claims. Desk, Editorial and Rail all hide the left-out figure behind a disclosure.
- The new-user screen holds the third state open properly. All four contents rows read "Nothing set up yet", the Inbox badge disappears rather than showing 0, and the block reads "There is no project yet. Nothing failed, and nothing here counts as zero."

**overall 8.9 · owned 9.2** — protect:
- The strongest information architecture in the lab. The leader-dot contents table turns the four modes into the document's own structure and prints each mode's coverage state on its own line: '01 Today ……… Read · Not connected', '02 Inbox ……… Partly read', '04 Analytics ……… Not enough history'. You can tell the four modes apart, and know the state of every one of them, from any one of them.
- The clearest tier separation of the four: level 1 is small mono uppercase, level 2 is a numbered sentence-case index under a 'Home' label. The two are never confusable, and the active row is marked by an indigo number plus an indigo rule that travels down the list as you change mode.
- It is the only direction whose navigation distinguishes a true zero from an unknown: a cleared Inbox reads 'Nothing in it' while an unread one reads 'Partly read'. The governing rule is expressed in the nav, not only in the prose. Analytics extends this: every number is qualified by COUNTED / LEFT OUT / CANNOT SAY / BASELINE, and 'No accepted baseline' is stated rather than silently omitted.

