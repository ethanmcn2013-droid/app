# The settled ledger

Every finding the panel raised and a refuter killed, with the reason it
died. This is a TRIAGE FILTER, not a reading list: a finding matching one
of these is rejected before a refuter is spent on it, unless it brings new
evidence that meets the stated objection.

Raised and refuted in three consecutive rounds each, now closed: the
editor's reserved band, the desk editor's foot below the fold, and an
arrival animation for the audience.

**59 settled items, rounds 7–10.**

## accent-spent-twice-never-on-the-event
`brand` · refuted in round 7

Half the census is right and everything built on it fails. Driven at 1440 and 390 across all twelve states, indigo paints exactly two objects on owner-flight, owner-editing, phone and desk (.b-todayRule and the lead .b-tick), one on day (.b-dayNow border-top), one on print (the lead tick), and none on publish, unfurl, ended, owner-empty or either loading state. That much holds. The argument does not. (1) It reopens the lock. lock.md's mechanical section reads 'it is the today rule and the filled tick on the next thing, and nothing else', and the supersedes table ratifies it as Stands; the finding deletes one of the two named uses and adds a third the lock excludes by name. That is a founder- […]

## add-invents-a-date-and-never-says-so
`ux` · refuted in round 8

The arithmetic is right and the headline is wrong. Driving owner-flight at 1440 and pressing 'Add a moment' five times reproduces the claim exactly: 9, 2, 1, 1, 1 days away, three untitled rows on Fri 17 Jul, and the left column changing to 'Nothing is planned until 17 July.' So the pile-up is verified. What is not verified is 'never says so'. The add branch calls openEditor on the new row in the same frame, and the resulting screen states the computed date FOUR times at once: the WHEN field reads '17 July 2026' as an editable value (render-b.js line 827, seeded from iso, thereafter written only by setAway); the stepper readout under it reads 'Friday 17 July 2026 - in 1 day' in a role=status […]

## away-figure-off-title-baseline
`type` · refuted in round 8

Measured, not read. Two independent methods (canvas font metrics; a zero-height inline-block anchored on the first line's baseline) agree on the true first-baseline deltas of .b-away against its own .b-title, identical on every row: phone/day 390 = +2.0px (finding claims +1), desk 768/1024/1152/1279/1280/1440 = -3.0px (finding claims -5), print sheet = +3.0px (only number it gets right). Two of three figures are wrong, and the one it stakes its argument on is overstated by 67%. Worse, desk is the surface where the setting is demonstrably CORRECT. At 1440 the figure is 17px Geist Mono (digit cap 12px) and the title 24px Geist 600 (cap 17px). At the shipped -3px the figure's ink band runs from […]

## cancelled-past-row-breaks-the-column
`taste` · refuted in round 8

The geometry is real but the reading of it is wrong, the proposed fix breaks a passing gate, and it is measurably worse on the phone. MEASURED (disclosure forced open, owner-flight/phone/desk, the only three states with behind rows): at 390 the two dated titles sit at x=132 and the cancelled title at x=20; at 1440 they sit at x=698/699 and x=586/587. That much of the finding checks out. Everything built on top of it does not. (1) It restates a gate assertion, inverted. interaction-check.mjs line ~1666 carries a named, passing check written for exactly this rule -- ok('an empty lane reserves nothing', lane === 'none') at 390/record/desk, sitting under the comment 'A cancelled row has no date, […]

## cancelled-said-three-ways
`brand` · refuted in round 9

Measured the specific new claim on state=print and it is arithmetically true but evidentially empty, and both halves of the proposed fix are disqualifying. (1) THE 90px CLAIM IS TRUE AND IS NOT NEW. approach/print at 1440: struck .b-behindTitle "City hotel shortlist" top 706, .b-behindState "Not going ahead" 728-744, .b-behindNote "One of them did not happen." 764-786 - an 80px span in the 220px past column. Identical on record/print. But the same three co-occur TIGHTER on record/desk (1335-1400, 65px), which is a surface round 7 drove and refuted, and round 7 already granted the adjacency in terms ("the row chip it sits under is a status token that cannot follow it without changing MILESTON […]

## ceremonial-date-fits-one-string
`ui` · refuted in round 8

The load-bearing half of this finding is a measurement artifact of the reviewer's own test, and the fix regresses the thing the plan is actually made of. 1. The bad break the finding is built on cannot occur. fixture.js already welds the joint the fix proposes to weld: `var NB = " "` and `longYear = weekday + " " + day + NB + month + NB + year`, with a comment stating the intent verbatim - "the ceremonial date can break after the weekday but never between the 3 and the October... only this one joint is welded". Driving the master and rendering through the real formatter at 1024/1152/1440, every date that wraps wraps in exactly one place: "Saturday" (116px) / "12 September 2026" (257px); "Wed […]

## count-and-tick-light-up-and-refuse
`interaction` · refuted in round 9

The observations check out; the conclusion and the fix do not. Driven at 1440 on owner-flight: .b-grab::after is inset:0 against .b-copy (.b-grab is position:static, .b-copy is position:relative), elementFromPoint at the centre of .b-away returns the span, its computed cursor is 'auto', and a click leaves every .b-grab at aria-expanded=false with activeElement BODY. Hovering it does paint .b-copy at rgba(255,255,255,0.04) and lift .b-grab to rgb(255,255,255) on a 6% plate. All true. But that is not a false promise: the cursor over the count and the tick is the plain arrow, while the cursor over the words is 'pointer' (verified: elementFromPoint over .b-title returns .b-grab, cursor 'pointer' […]

## desk-editor-opens-with-its-foot-off-screen
`interaction` · refuted in round 8

The measurements check out exactly - I reproduced every number by driving master.html. On open at owner-flight the rail panel sits at top 597 / bottom 1156 (559px) inside a 925px .b-stick, [data-act=done] at 1036-1075 and [data-act=delete] at 1100-1139 at EVERY desk width, giving 31% visible at 1024x768, 36% at 1152x800 and 1280x800, 54% at 1440x900, 65% at 1440x960; at 1024x768 the title input (708-749) is the last thing fully on screen and the WHEN field (783-823) and steppers (829-869) are below the fold. keepInBand does return early on the rail. So the observation is accurate. The finding dies on its fix, which is the exact assumption round 7 refuted. .b-editHost lives inside .b-stick, w […]

## desk-frame-still-scrolls
`evidence` · refuted in round 9

The number is right and the diagnosis is wrong, and the diagnosis is the whole finding. I reproduced the measurement exactly: documentElement.scrollHeight - clientHeight is 107 at 1024x800, 1152x800, 1279x800, 1280x900, 1440x800, 1440x960 and 1920x1080, in owner-flight, owner-editing, owner-undone and owner-draft alike. 107 is not a mystery and it is not the product: it is 40px of --stage-pad above + 15px of .tl-caption + 12px gap = a 67px offset, plus 40px of --stage-pad below. shell.css names both of those in its own comments - --stage-pad exists so 'one page can show a phone artifact, a desk artifact and an A4 sheet honestly', and of .tl-caption it says in as many words 'It is lab furnitu […]

## docked-sheet-flush-left
`ui` · refuted in round 8

The measurements are right and the remedy is wrong, and the remedy is what was submitted. Driven at 768x1024, 900x800 and 1023x900 with a moment open: the plate runs 12..756 / 12..888 / 12..1011, every grid child is exactly 480px wide at x=29, and 231 / 379 / 486px of plate sits empty. The page column (.b-two) runs 96..672 and 96..927 and the row titles start at 220. So far the finding is accurate. It then fails on its own premise. The fix says 'the stage is viewport-centred at these widths, so centring the plate lands it on the content column' - it does not. Applied verbatim (left:50%; transform:translateX(-50%); width:min(514px, 100vw-24px)), the plate lands at 255..769 at 1023 and 127..64 […]

## done-is-doing-two-jobs-on-one-screen
`ux` · refuted in round 9

Harvested both strings by driving the master. The button is button.b-act[data-act=done], text "Done", 12px under the "What guests see" segment and 64px above "Delete this moment" (render-b.js:899). The sentence is p.b-behindNote, "2 done, the last of them 18 April. One thing is not going ahead." (render-b.js:332), owner branch only. The finding fails on four counts. (1) The 'undiluted for a screen reader' claim is factually wrong: the editor is h("div.b-edit#b-edit", { role: "group", tabindex: "-1", "aria-label": "Editing " + nameOf(record) }) (render-b.js:831-834), so the button is already inside a group whose accessible name states the job the finding wants stated. (2) The proposed aria-la […]

## draft-branch-restored-before-it-is-used
`evidence` · refuted in round 9

The code reading is right and the one-press observation reproduces (state=owner-draft shows "Only you can see this", "Publish", "Updated 16 July 2026"; pressing Publish lands on "Mara & Finn have had this since 15 July." with the strap "The link is below."). Everything the finding builds on that is wrong or harmful. (1) The stated consequence is false. I drove the brand-new-plan path the round-8 note actually claims: state=owner-empty, type "3 October 2026", Set the day, Add a moment, Escape, Publish. It renders the draft press screen in full - headline "Send it to Aisling & Tom.", announced strap "Ready to send. The link is below.", draft card. So the draft half of the publish screen is NOT […]

## edit-field-is-not-the-type-it-edits
`type` · refuted in round 7

Refuted on measurement and on mechanism. (1) The central claim - that the owner's words 'shrink at the exact moment they are being written, then grow back on commit', and that 'the owner cannot see where their title will actually break' - is factually false. render-b.js:732 binds an `input` handler that calls setTitle() on every keystroke; setTitle (render-b.js:632-648) rewrites .b-title and calls C.settle(), which re-runs the word-safe trim. Driven at 1440: with the editor open in the 344px rail (x=186), the row sits beside it at x=710 w=544 and repaints the full string live at 24px/600/28.8px/-0.72px while typing. Screenshotted. At 390 the same typing produced a live-trimmed row ('...befor […]

## editor-opens-below-the-fold-at-desk
`evidence` · refuted in round 8

The measurements check out exactly - I reproduced panel 597..1156, Done 1036, Delete 1100, scrollY 0, .b-edit position:relative and keepInBand's early return at 1440x960, 1280x900, 1152x800, 1024x768 and 1279x800 - and the gate genuinely never looks (interaction-check.mjs:978 runs its band loop only at 390 and 768, and every desk-width click on [data-act=done]/[data-act=delete] goes through Playwright's own auto-scroll, so off-screen is invisible to it). The finding is refuted on its fix, which I drove both halves of and which makes the surface worse, not better. Half (1) alone - the static branch in keepInBand - is a runaway scroll pump. keepInBand is called after EVERY setAway via the rAF  […]

## editor-opens-on-a-hole
`taste` · refuted in round 7

The observation is measurably true and the fix is measurably wrong. Driven at 390/768/1280/1440 (state=owner-editing), .b-undo is display:flex + visibility:hidden with data-empty=true at all four, and the first label ('WHAT IT IS') sits exactly 89px below .b-edit's top edge every time (.b-edit padding-top: 88px, master.html:1200). So the band is real. It is refuted on the fix, on four independent grounds. 1. The fix breaks a passing gate assertion and reinstates the exact Round-1 defect that assertion was written to catch. interaction-check.mjs:441 reads: ok("it says nothing before anything has happened", atRest.empty === "true" && atRest.text === "", atRest.text) - measured on the OPEN edit […]

## editor-opens-on-an-empty-88px-band
`ui` · refuted in round 7

The measurements are right and the diagnosis and the fix are both wrong. Driven at 1440x960 (open owner-flight, click the first .b-grab): computed padding is 88px 16px 16px, panel top y=597, hidden .b-undo band 614-664, first ink 'WHAT IT IS' y=686, .b-editActs y=1034, .b-editDanger y=1085 - exactly as claimed. But the 88px is not what puts the foot below the fold. Moving the reserve does not change the panel's height (104px of padding either way) or its top (y=597, set by the rail stack under the 79-day horizon), so it cannot lift the panel's bottom edge at all; it only slides the content inside. I applied the proposed fix verbatim at runtime - padding 16/16/16/88, .b-undo reordered to last […]

## editor-reserve-is-a-void
`ui` · refuted in round 8

This is the already-refuted fix (b) with a two-word prefix, and driving the proposed CSS verbatim in the master shows it failing on its own terms three ways. (1) The premise is wrong. The panel does not name its moment 'only in the accessibility tree': .b-item[data-editing="true"] .b-copy paints the edited row with a fore-06 wash and a 12px halo, and that row's title is on screen in every case measured (desk top 570 with the panel top at 597; 1023 top 67; 390 top 64) - and the panel's own first field is labelled 'What it is' holding the title. A sighted owner already sees the name twice, once held and once editable. (2) The proposal is refutation (b) again. Injected and measured at 1440: row […]

## freshness-stamp-is-decoration
`ux` · refuted in round 7

Measured, the owner-surface half of this is wrong. "Live since 15 July" sits at y=191; the footer's "Updated 15 July 2026" sits at y=1998 in a 2130px document on a 960px viewport (390: 164 vs 1954; 768: 232 vs 2409). That is ~1800px apart, not "eight lines" — the stamp is below the fold on every viewport and is not even present in the owner-flight frame this seat cites (the shot is a 1440x960 viewport clip at 2x). The two strings are never co-visible, sit in different registers (13px vs 11px), and answer different questions, so the claimed "same date twice, so neither reads as load-bearing" rests on a proximity that does not exist. The stamp:false half of the proposed fix is already the arti […]

## head-leading-is-set-under-the-font-box
`type` · refuted in round 9

The arithmetic premise is right and every consequence drawn from it is measurably wrong. Geist's font box is 22px at 17px (fontBoundingBox ascent 17 + descent 5 = 1.294em) against a 20.4px line box, so half-leading is -0.8px and the two line rects do overlap by 1.61px in the box model. But boxes are not ink. Measured at 4x on the real master (Chromium, master.html?v=approach), the finding's own string set two lines in .b-title at 17px/20.4px: line-1 ink 3.50-18.75px, line-2 ink 25.00-37.25px - 6.25px of completely clear pixels between them, 37% of the em. Nothing overlaps, nothing clips, and nothing clips under the -webkit-line-clamp:2 overflow:hidden either (ink spans 3.50-37.25 inside a 40 […]

## head-register-leaks-to-state-and-wordmark
`type` · refuted in round 7

Refuted: the load-bearing claim in part (b) is factually wrong about the artifact, and part (a) is a misreading of the declared register whose fix would make the screen worse. (b) is wrong. Measured at 1440x960 in both colour schemes, the publish screen emits NO h1.b-who. render-b.js states.publish (:1336) renders bar(F.project.name, ...), which puts the couple's name in .b-switch at 15px Geist / weight 600 / sentence case / -0.015em / 100% ink, and again as .b-pressTitle at 48px sans. The only 12px/0.20em/uppercase rendering of the couple's name on that screen is .b-ogWho INSIDE the unfurl card. So the asserted collision - 'the couple's name is emitted as an <h1> at the same 12px/0.20em/upp […]

## keepsake-loses-the-baseline-and-the-measure-floor
`type` · refuted in round 7

The load-bearing claim is a measurement error. Driving master.html?state=print in chromium at 1440 and probing true baselines with a zero-height inline-block strut: .b-num first baseline = 264.19 and .b-unit FIRST baseline = 264.19 - identical to the pixel. The finding's 294.97 is .b-unit's LAST baseline; the 30.78px 'drift' it reports is exactly 2 x the 15.4px line box (11px/1.4) of a three-line wrap, not a lost alignment. Screen and print are structurally the same: .b-count is align-items:baseline in both, and the num line-box-to-unit line-box delta is 108.00px in owner-flight and 108.00px in print. Nothing left any baseline. The '21px below the numeral' is likewise just the 2nd and 3rd wr […]

## loading-frame-speaks-a-foreign-language
`taste` · refuted in round 8

The premise is factually false and the fix, driven, is worse. (1) The slabs are not "the only filled rectangles in a system otherwise built entirely from hairlines": b.css draws the row plate filled at --fore-04 with border-radius 4px on hover (l.366), at --fore-06 with 4px while editing (l.373-374), at --back with 4px when crowded (l.371), and every press state in the product - .b-item:active .b-copy, .b-grab:active, .b-act:active, .b-step:active, .b-behindSummary:active, .b-undoAct:active (l.688-693) - is background: var(--fore-10). The skeleton is background: var(--fore-10); border-radius: 4px (l.1184): the exact tint and the exact radius the product already uses for a pressed surface, an […]

## moment-title-measure-collapses-at-1024
`type` · refuted in round 10

Every geometry number reproduces exactly and the finding still dies - on two factual errors, on an overstated harm, and on a fix that misses half the surface it names and regresses the half it reaches. VERIFIED: driving master.html at 768/900/1000/1023/1024/1080/1152/1179/1180/1279/1280/1440/1920 on paper and ink, .b-plan .b-title is 452/544/544/544px through 1023 and 298px at 1024 on owner-flight, 306px on desk, climbing to a 534px (owner) / 542px (desk) cap. 22.67em -> 12.42em at one pixel is real, and the cap never regains the 544. FACTUAL ERROR 1: 'same trim' on desk is false. b.css:264 sets [data-state="desk"] .b-title { -webkit-line-clamp: none; overflow: visible } - the desk title CAN […]

## new-project-instructed-three-times
`brand` · refuted in round 7

Driven at 1440x960 and 390x844: type 3 October 2026, press Set the day, harvest the answered frame. The geometry is as described (count 148px/96px, .b-emptyBody 17px at y512, the button at y591, #b-empty-hint at y642 - 130px top-to-top), but the characterisation and the fix both fail. (1) Factually wrong on the core claim. The three items are not the same instruction. "Nothing sits between today and the day yet" describes state; "Everything you add is measured from it" states the page's law; "The day is set." confirms the transaction that just completed. Only "Moments come next" plus the button label point forward, and there is exactly ONE control on the frame, offered once. The defect-libra […]

## no-arrival-for-the-audience
`taste` · refuted in round 8

Third airing of an absence refuted in round 3 (nothing-a-guest-sees-ever-moves) and round 7 (the-guest-never-sees-anything-move). It brings no new evidence, is LESS accurate than the version it repeats, and its named fix is wrong about the code in three places and actively harmful in a fourth. 1) THE PROBLEM STATEMENT IS FACTUALLY WRONG AND UNDERCOUNTS. 'The whole product contains one moment of motion... and it lives inside the owner's editor, which the audience never opens' is false. b.css declares EIGHT transitions (lines 184, 357, 369, 401, 646, 768, 802), and driving state=phone and state=desk at 390x844 and 1440x960 the received DOM carries eight transition-bearing elements: seven copie […]

## one-cancelled-moment-said-four-ways
`brand` · refuted in round 7

Harvested all four wordings by driving master.html (approach: owner-flight, phone, desk, day, print; record: desk, print) and reading render-b.js:298-408 plus b.css:493-497. The strings are real, but the finding's frame and its fix are both wrong. (1) 'Four ways' is inflated. Nothing shows four. The row chip is F.stateLabel.cancelled ('Not going ahead') - the product's global MILESTONE_STATE_LABELS token (fixture.js:70-76), a status label, not a sentence; holding a status chip and a prose sentence to one register is not a copy defect. The two folded variants ('One thing is not going ahead.' / 'The city hotel shortlist is not going ahead.') are the deliberate owner/guest audience split docume […]

## one-move-two-announcements
`interaction` · refuted in round 9

Measured with a MutationObserver over every live region ([role=status],[role=alert],[role=log],[aria-live]) across one +7 press at 1440x960, owner-editing. There are exactly three live regions; two mutate on the press: .b-undo at t=55.7ms -> 'Send the invitations moved 7 days later.UndoCtrl Z', and .b-stepRead at t=55.8ms -> 'Saturday 15 August 2026 · in 30 days'. So the mechanism is real. But it is the case the brief excludes: two DIFFERENT facts announced once each, not one change heard twice. The undo bar states the delta and that the move is reversible; the readout states the resulting absolute date. Verified directly: /2026|August|Saturday/ does not match the undo bar's text at any poin […]

## one-of-three-has-no-noun
`brand` · refuted in round 8

Verified by driving all thirteen states. The rendering half of the finding is accurate and the rest is not. WHAT IS TRUE. .b-switch renders on exactly five states - owner-flight, owner-editing, owner-undone, owner-empty and publish - and on none of the seven guest or artifact states (phone, desk, day, print, unfurl, ended, loading, loading-slow all return no .b-switch). owner-empty does print 'Aisling & Tom ONE OF THREE'. The fixture holds PROJECT + 2 SIBLINGS = 3, so the count is correct and the seat's arithmetic (F.siblings.length + 1) matches. The gate does not assert anything about this string (interaction-check.mjs:2270 only tests name identity, 2544 only tests border 0 / radius 0), so  […]

## past-rail-orphans-its-own-marks
`ux` · refuted in round 8

Measured at 390 in state=day with the disclosure forced open. The geometry the finding reports is broadly right and round 7's half is confirmed working: data-px=2, measure 640px, ticks at 34/62/76/90/118/132 (six inside 98px), pushes 21/56/91/112/147, and every numeral sits beside its own words (14, 28, 35, 42, 56, 63 each pair correctly with their title and mono date). But the finding is wrong about what it means and its fix is the wrong trade. Three things kill it. (1) The headline is false. The 'Behind you' disclosure is CLOSED by default; the screen the audience opens on the wedding morning says MARA & FINN / Today / Saturday 3 October 2026 / Wedding day, and states the past in one sente […]

## pinned-label-stops-naming-what-is-under-it
`taste` · refuted in round 8

Driven at 1440x960 and 1024x800 on owner-flight and desk, the behaviour is exactly as described but the reading of it is wrong. At rest the pair is 'TODAY IS 16 JULY' / 'Nothing is planned until 1 August.'; scrolled it becomes '8 August · 23 days away', then '5 September · 51 days away', and it returns to the rest sentence at scrollY 0 (round 7's live-derivation fix holds; no stale snapshot). (1) The claimed contradiction does not exist arithmetically. Every scrolled readout states its distance FROM the label's date: 16 July + 23 = 8 August, + 51 = 5 September, + 65 = 19 September (1024 width). The label is not announcing a rival date, it is the origin the second half of the line is measured […]

## preview-erases-the-way-back
`ux` · refuted in round 10

Every measurement in the finding reproduces exactly, on both grounds, and it is still refuted on scope and on the fix. WHAT IS TRUE. Driven at 1440x960, v=paper and v=ink, owner-flight: open Menu tasting at The Orchard, press Hidden, press Done -> .b-undo data-empty="false", .b-undoText = "Menu tasting at The Orchard is now hidden from guests.", .b-undoAct enabled, .b-field[data-undo="true"], record.hidden written to the fixture. Press Preview -> data-state=desk, the guest sees 6 items not 7 (the hide carried). Press Back to the plan -> data-state=owner-flight, the moment is still data-visibility="hidden", and .b-undo is data-empty="true", .b-undoAct.disabled=true, data-undo gone, Ctrl+Z ine […]

## printed-url-severs-the-host
`type` · refuted in round 8

The observation verifies and the gate does not cover it - but the fix is arithmetically false and regresses two currently-passing assertions, so it fails on 'the fix would make it worse'. VERIFIED TRUE: at 390/768/1024/1152/1279/1280/1440 .b-printLinkUrl sets identically as 'https://timeline.signalstu' / 'dio.ie/s/j7Qm2vK4xR9bT1nL6' / 'yH3cW8pZ5sD0aG7fJ4uE2rN9tM', the b.css:1227 comment says what the finding says it says, and interaction-check's 'the link is not cut mid-token' (L1834) asserts only scrollWidth <= clientWidth on the PUBLISH field - no clipping - and says nothing about the print sheet or about where a break falls. So this is not a restated gate. It dies on the fix. FALSE MEASUR […]

## publish-contradicts-its-own-headline
`brand` · refuted in round 8

Driven at 1440x960, state=publish, every visible text node harvested with its box. The positions do not support the reading, and the panel has already ruled on these exact three words twice. (1) ALREADY ADJUDICATED. The round-7 CONFIRMED verdict taste--publish-is-not-a-ceremony is the finding that produced this headline, and its sharpened fix says verbatim: "Headline the fact ('Mara & Finn have had this since 15 July.'), make Copy the link the primary act, and drop 'Ready to send. The link is below.' - it contradicts the card beside it, which already says 'when this was sent'. Keep 'Sending comes next'." The build did exactly that: render-b.js:1183 conditionalises the announcement, 1471 cond […]

## received-desk-readout-goes-stale
`ui` · refuted in round 9

Wrong about the code, wrong about the sentence, and the fix would import a defect this panel has already paid to remove. (1) Wrong about the binding. render-b.js:1243 reads window.addEventListener("scroll", onScroll, {passive:true}) FIRST, and the pane listener is the conditional second add; the edge accessor already branches - edge = pane && overflowY==="auto" ? pane.top : 0 - i.e. it is written to run with the window as the scroller. The mechanism is not 'wired only to the owner's pane scroller'. What is true is narrower: the whole block sits inside wireOwner(), and states.desk never calls it. (2) Wrong that the sentence goes stale. Driven at 1440, 1280 and 1152 with state=desk: .b-stick i […]

## retry-does-not-say-it-is-working
`interaction` · refuted in round 9

Driven at 390x844 (chromium, master.html?v=approach&state=loading-slow). Measured sequence on press: at +0ms aria-busy on .b-field flips false->true, the sub line swaps 'This is taking longer than it should.' -> 'Bringing in what is ahead.', the reassurance note goes display:none, and .b-live announces 'Trying again.'; at +1400ms busy returns to false, the sub line returns to the stalled sentence and .b-live announces 'Still not arriving. The plan has not been deleted, and the link still works.' The window is 1400ms, not 'roughly two seconds'. FACTUALLY WRONG that the control is untouched and is 'the one element on the screen that does not change': the button's top moves 403.2 -> 375.7 (27.5 […]

## row-plate-crosses-the-right-margin
`ui` · refuted in round 8

The geometry is measured correctly and everything else about the finding is wrong. (1) The premise is false. The plate is NOT the only ink that crosses the right margin. .b-behindSummary carries `padding: var(--gap-tight); margin: 0 calc(-1 * var(--gap-tight))` and `:hover { background: var(--fore-06) }`, so on hover it paints the identical 6% tint from 8px LEFT to 8px RIGHT of the content column at every width: measured 12->378 against a 20->370 column at 390, 88->680 against 96->672 at 768, 578->1262 against 586->1254 at 1440. Its own comment says why: 'the negative margin lets the pressable band run the full width of the measure without moving the text.' The page has a declared idiom -- a […]

## sheet-type-keyed-to-the-window
`type` · refuted in round 8

The headline claim is disproven by the only output that is the artifact. I rendered state=print to A4 PDF (page.pdf, format A4, zero margins) from a 640px-wide window and from a 1440px-wide window: both files are 36,766 bytes and differ in exactly two bytes - the seconds digit of /CreationDate and /ModDate. Every content byte is identical. Chromium lays the sheet out at the paper width (794 CSS px) when it prints, so '@media (min-width: 701px)' and '@container (min-width: 600px)' both match on paper, always. The printed keepsake sets the count at 148, the ceremonial date at 30, the gutter figure at 17 and two columns at 220px + rest, from any window. Geometry and type do not disagree about h […]

## stepread-never-fits-its-measure
`type` · refuted in round 8

The finding's central claim is factually false, and the behaviour it reports as a defect is a reserve that an earlier round built on purpose and that measures as working. 1) "Never once sets on one line at any width" is wrong. I drove master.html at state=owner-editing and measured .b-stepRead with a Range across 390/701/768/800/900/1000/1023/1024/1152/1279/1280/1440, at rest, after +7 x2 and after -1 x3. Across the whole 701-1023 band the sentence sets on ONE line in every content state: 336px at rest, 345.6px after +7 x2, 355.2px after -1 x3, all inside a 480px measure - 125px of slack at the longest string tested. 768 is one of the brief's own listed frames; the finding did not drive it.  […]

## stranded-function-words-in-generated-prose
`type` · refuted in round 8

Measured all three instances in Chromium with per-line client rects at 320/390/768/1024/1152/1279/1280/1440, then re-measured with pretty forced back and with the proposed nbsp binder applied verbatim. One sub-instance is real; the finding around it is wrong on mechanism, wrong on geometry, wrong on its numbers, and its fix is a measured net regression that also collides on paper. (1) MECHANISM IS FALSE FOR INSTANCE 2. .b-unit has no text-wrap declaration at all - computed text-wrap is 'wrap', not 'balance' (b.css:76-83; the only later rule touching it, b.css:1384, sets text-transform/letter-spacing/colour). The print dateline's three-line stack is flex shrink inside a 220px print column, no […]

## tablet-band-is-the-blown-up-phone-stack
`evidence` · refuted in round 8

The measurements are largely right and the boundary mismatch is real (geometry at 701, composition at 1024), but the finding misattributes the harm and its own fix does not deliver the benefit it claims. Measured owner-flight across 390/700/701/768/834/900/1023/1024: first moment y=967 at 701/768/834, y=937 at 900/1023, y=570 at 1024; doc height 2527 / 2497 / 2130; ownerScale 18px/day from 701. So far so accurate. But: (1) THE FIX DOES NOT WORK AT ITS OWN HEADLINE WIDTH. I simulated the exact proposal - the [data-medium="full"] half of the 701 raise neutralised below 1024, plus ownerScale at 14px/day. The first moment lands at y=839 (768), y=809 (900 and 1023). Not 'roughly y=790', and still […]

## the-arrival-is-a-row
`taste` · refuted in round 9

Not the refuted arrival-animation request in new clothes - it genuinely asks for no motion - but it fails on composition, on three measured grounds. (1) The premise is factually incomplete. Measured at 390x844 and 1440x960, the terminus is not 'separated from an errand only by weight': it carries the ONLY full-measure hairline in the composition (.b-item[data-anchor]::before, left:-23px to right:0, top:-16px), the rail visibly terminates beneath it, its title steps 400->600, and its count column reads 79 - the identical figure the reader carried down 1,692px from the 96px horizon count. The arrival rhymes with the horizon by restating its number at the foot. That is a designed terminus, not  […]

## the-day-has-no-name-the-owner-can-write
`ux` · refuted in round 9

The premise is factually wrong and the inventory is wrong three times in four. PREMISE: the day's label IS written by a person in this product, and this field specifically. src/components/welcome/contextual-onboarding.tsx:384 renders a 'Date label' input, placeholder 'Wedding'/'Examinations', beside the date; src/components/app/your-work/your-work-view.tsx:671-675 renders 'Primary date, optional' and 'Date label, optional' as a pair on the workspace-creation form. Both persist to workspaces.primary_date_label (src/modules/timeline/server/db/timeline-schema.ts:499), and src/modules/timeline/lib/audience-timeline.ts:195 validates it as a required string, max 40. It is a WORKSPACE value, author […]

## the-editor-opens-on-an-empty-band
`interaction` · refuted in round 7

The band is real (measured, panel padding-top 88px; at 390 the sheet spans y275-832 and the first visible text, WHAT IT IS, sits at 364 - an 89px blank), but the argument this fix rests on is false and the fix itself is a net worsening. (1) The panel is not anonymous to a sighted owner. The row being edited carries a tinted halo plate (.b-item[data-editing] .b-copy, fore-06 with a 12px spread) and is GUARANTEED on screen: keepInBand() scrolls it above the sheet and interaction-check.mjs already asserts 'the row being edited is on screen when it opens @ 390' and '@ 768'. Driven at 390 the tinted row 'Send the invitations' sits at y94-165, 110px clear above the sheet; at 1440 the panel is in t […]

## the-guest-is-left-holding-nothing
`taste` · refuted in round 9

Driven cold at 390 and 1440 on state=phone, desk, day, ended and unfurl. The one measured claim holds - the received surface has exactly one tab stop, the b-behindSummary fold, and eight Tab presses cycle between it and the body - but everything the finding builds on that is either false or an argument against the direction's own proposition. FACTUALLY OVERSTATED. The guest is not left holding nothing: the day is the third thing on the surface, in full ('Saturday 3 October 2026' / 'Wedding day', directly under the 79-day count), repeated as 'Sat 3 Oct' on the measure row, and - contrary to the finding's closing line - the ended state does NOT stop at 'This link has ended': it renders 'The da […]

## the-guest-never-sees-anything-move
`taste` · refuted in round 7

The absence is real and correctly counted (7 transitions, 0 keyframes; driven at state=phone and state=desk the guest DOM carries only 8 transition-bearing elements - 7 copies of the never-firing `top` on .b-item and the .b-behindSummary hover tint), but the finding is wrong about what that absence means, wrong about the premise it rests on, and its fix is unbuildable, off-ladder and would spend the best thing in the artifact. 1) FACTUALLY WRONG ON THE PREMISE. 'The received screen offers no evidence whatsoever that it is alive rather than a screenshot' is false. The guest foot reads 'Updated 15 July 2026', and every number on the surface - the 79, the 'days', '16 days away', 'TODAY IS 16 JU […]

## the-keepsake-has-no-door
`ux` · refuted in round 7

Correct on the grep, wrong about what the artifact is, and the fix would damage the direction's best idea. (1) Category error. master.html is a state renderer, not an app shell: data-state is set from the URL, each state declares a medium and carries a caption naming it as a medium ('Print / A4, the keepsake'), and the Design Console is the browsing surface. Five of the twelve brief-mandated states have no in-artifact control aimed at them -- unfurl (a chat card, which by construction cannot have one), ended, loading, loading-slow and owner-empty. The finding's principle, 'a designed object with no entrance is the same as a missing state', condemns all five. The brief lists conditions to dra […]

## the-morning-closes-on-an-errand
`taste` · refuted in round 7

The observation checks out; the fix does not, and the fix is the finding. Driven at state=day, 1440 and 390: the Behind you details is closed (details.open === false), the section's innerText is exactly "BEHIND YOU / 9 moments / Venue walk-through, 19 September.", and nothing but the footer chrome (Kept by Orla / Signal Timeline) sits below it. So yes, the morning's last content line is a note about a fortnight-old site visit. But the proposed replacement is copy the record cannot produce. The earliest past item's title in fixture.js is "We said yes" — the couple's own first-person words. "It began on 2 January, when you said yes." requires a person shift (We→you), a case fold, and a hand-wr […]

## the-morning-never-states-the-distance
`taste` · refuted in round 8

Already litigated and explicitly ruled out, and the fix is worse than the line it replaces. (1) SETTLED. This exact move - turn the morning's note into a count - was proposed in round 2 and refused by name in the verdict for wedding-morning-is-written-as-admin: 'DO NOT switch the day-of note to a count... received surfaces name things and never tally, and "8 things got you here" would reinstate the tracker voice on the most received screen in the set.' The current string is not filler, it is round 1's own remediation for the-day-reads-as-a-closed-ticket, whose refuter specified the register in writing: 'one present-tense sentence that neither counts nor congratulates.' Round 4's verdict for  […]

## the-move-is-off-screen-at-desk
`interaction` · refuted in round 7

The finding's own crux measurement is wrong, and the code comment it tries to overturn is correct. Driven at 1440x960 and 1280x900 in owner-editing: .b-stick does compute position: sticky (top: 40px), but the rail is NOT stuck at the default scroll. Measured .b-stick rect top by scrollY: 0->231, 100->131, 191->40 (sticks), 900->40, 1170->-136 (unsticks against .b-two's bottom). So the first .b-step travels 829 -> 638 -> 522 as the page scrolls 0 -> 600 -> 1200. The finding states 'I watched the first .b-step hold while the page scrolled from 0 to 1200'; it moved 307px. The steppers move 1:1 with the page for the first 191px of scroll and again past ~1035. 191px is 4.8x the 40px height of the […]

## the-pinned-line-and-the-lead-tick-name-nothing
`ux` · refuted in round 9

Both halves fail on measurement. (1) The pinned line. Driven at 1024, 1280 and 1440 with the plan pane scrolled to 0/200/300/400/600/900/1200/max, the row the line names is ALWAYS the topmost row visible in the plan pane, at every offset and every desk width (titleOnScreen true, 15/15 samples). speak() picks the first row whose top is at or below the PANE's own edge - that is exactly what the round-7/8 fix was for, and its code comment says so. So 'the row it refers to may be anywhere in a pane that scrolls independently' is factually wrong: at pane.scrollTop 600 the line reads '22 August · 37 days away' at y547 x186 while 'Final dress fitting / Sat 22 Aug' is on the same screen at y348 x710 […]

## the-received-plan-opens-on-an-absence
`brand` · refuted in round 9

REFUTED on measurement, on precedent, and on the fix. (1) The register claim is false as measured. Driving master.html and dumping every visible text node in DOM order, .b-gapNote is the SEVENTH statement on the guest phone, not the second: "Mara & Finn" (y=28), "79" (y=65, 96px), "days" , "Saturday 3 October 2026" (y=163, 20px), "Wedding day" (y=193), "Kept by Orla" (y=228), "Today is 16 July" (y=280), then the note at y=311. It renders at 15px in fore-0.62 - the declared type FLOOR, the lowest ink density any letter on the page is permitted - under a 96px numeral and a 20px date. What the document says first about the most important day of their life is "Mara & Finn / 79 days / Saturday 3  […]

## the-undo-bar-has-four-grammars
`brand` · refuted in round 9

Drove every reversible action at 1440x960 and 390x844 (owner-flight, editor on Send the invitations) and harvested the bar verbatim. Transcription is accurate: +7 -> "Send the invitations moved 7 days later." (html: ...moved <span class=num>7</span> days later.), -1 -> "...moved 1 day earlier.", typed date -> "...moved 33 days later.", rename -> "Renamed to Evening reception.", rename-to-blank -> "Renamed to Untitled moment.", hide -> "...is now hidden from guests.", show -> "...is now shown to guests.", delete -> "Send the invitations was removed.", add -> "A moment was added." Everything else in the finding fails. (1) It is round 8's undo-node-speaks-six-grammars re-cut, and it does not me […]

## the-unit-is-not-graded-with-its-figure
`type` · refuted in round 9

Measured across all fourteen states at 390/700/701/768/1152/1440. The numbers the finding reports are right; every inference it draws from them is wrong. 1. The artifact's responsive type policy is explicit, and .b-unit is on the correct side of it. Diffing every element of the horizon between 390 and 1440 on owner-flight: FOUR things step at 701 - .b-num 96->148, .b-when 20->30, .b-title 17->24, .b-away 15->17. EIGHT things are flat by design - .b-who 12, .b-unit 11, .b-sub 15, .b-todayLabel 11, .b-measureHead 11, .b-date 11, .b-where 11, .b-gapNote 15. The display/reading tier grades with the stage; the micro/data tier is a fixed anchor at every width. That is not an omission, it is the ru […]

## today-rule-is-a-hardcoded-344px-stub
`ui` · refuted in round 7

Driven at 390/768/1152/1279/1280/1440 in chromium, with and without max-width force-removed. The raw numbers check out (rule 20-364 at 390; 96-440 at 768 and 1152; 105.5-449.5 at 1279; exactly 106-450 filling the 344px left column at 1280 and 186-530 at 1440), and deleting max-width really does leave 1280/1440 untouched and does not overflow any column. But the finding is wrong on its central premise and its fix is a regression. (1) The alignment premise is false. It claims .b-who, .b-when, .b-sub, .b-todayLabel and .b-gapNote 'all hold exactly' a right margin the rule misses. Those are text elements: their boxes span the track, their ink does not. At 390 their ink stops at 125.6 / 246.7 / 1 […]

## today-stated-twice-in-two-grammars
`brand` · refuted in round 7

REFUTED. The fix rests on a claim that driving the master falsifies: 'the rail marker becomes the single statement of today, and it already sits where the reading starts.' The rail marker is the one that does NOT survive reading. At 1280 and 1440 the horizon sits in .b-stick (b.css:1279, position:sticky, comment: 'The horizon does not scroll away'), so .b-todayLabel pins at y=324 and stays in view at EVERY scroll position; .b-origin is position:absolute top:0 inside .b-measure and leaves the viewport after ~400px of scroll. Measured on owner-flight 1440x960: scroll 410 -> origin y=-128 (out of view), label y=324 (in view), 6 dates on screen; scroll 1170 -> origin y=-888, label y=324, 6 dates […]

## type-frozen-across-the-391-766-band
`type` · refuted in round 7

Factually wrong on its central measurement, and its fix would break the gate it claims to keep clean. (1) THE BREAKPOINT IS 701, NOT 767. Driven in chromium at 390/420/480/560/640/690/700/701/720/767/768/900 on owner-flight, .b-num/.b-when/.b-title/.b-away step 96->148, 20->30, 17->24, 15->17 at exactly 701px (b.css:1209 '@media (min-width: 701px)', announced in the file header: 'Every value here is the phone value and the desk values live inside @media (min-width: 701px)'). At 701-766 all four are ALREADY at desk values, so 'identical from 390 to 766' and 'every one of them jumps at 767' are both false. The finding sampled 700 and 767 and inferred a threshold it never located. The real froz […]

## undo-node-speaks-six-grammars
`brand` · refuted in round 8

Harvested by driving every reversible action at 1440x960 (owner-flight, editor open on demo-audience-item-invitations). The six strings are exactly as quoted: stepper +7 -> "Send the invitations moved 7 days later." (rendered as: Send the invitations moved <span class=num>7</span> days later.), -1 day -> "Send the invitations moved 1 day earlier.", typed date -> "Send the invitations moved 33 days later.", rename -> "Renamed to Rehearsal dinner.", hide -> "Send the invitations is now hidden from guests.", show -> "Send the invitations is now shown to guests.", delete -> "Send the invitations was removed.", add -> "A moment was added." So the transcription is accurate. The finding still fails […]

## unfurl-plate-padding
`ui` · refuted in round 9

The numbers are right and the reading of them is wrong. Measured in chromium: on state=unfurl .b-chat is 560x341 at 700/701/720/768/1152/1279/1280/1440 (390 and 430 give a full-bleed 430), padding 28px 16px, with .b-bubble and .b-unfurl both 300px at x=chat+16 - so yes, 16px left and 244px right. But that 244px is not padding inside the card, it is the rest of the stage around it, and the 560 is not a property of the component at all: shell.css names exactly four media and sets [data-medium="card"] .tl-stage { max-width: 560px }, and body carries data-medium="card" on unfurl - the same mechanism that gives the phone states 390 and print 794 (A4 at 96dpi). .b-chat fills its stage exactly, edg […]

## untitled-moment-and-the-double-prompt
`brand` · refuted in round 8

Driven at 1440x960 and 390x844 from both entry points (owner-flight Add, and owner-empty -> set the day -> Add). Harvest: row title "Untitled moment"; grab aria-label "Edit Untitled moment. Saturday 25 July, in 9 days. Shown to guests."; panel aria-label "Editing Untitled moment"; field value "" (length 0) with placeholder "What is happening"; label "What it is"; document.activeElement === b-edit-title. So the field is EMPTY with a placeholder, not pre-filled - the finding's own premise reduces to one transient row title. (1) The count of three is wrong. "Untitled moment" is a name, "What it is" is a field-name chip (b.css:720 - mono, size-label, uppercase, fore-62), "What is happening" is a […]
