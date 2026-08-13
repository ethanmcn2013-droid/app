# Panel round 2 — required corrections for Signal Desk

Scored blind as candidate **A** by ten fresh directors after your round-1 remediation.

| | |
|---|---|
| lowest overall | **7.4** |
| mean overall | 8.46 |
| lowest owned lens | **6.9** |
| Pass / Revise / Veto | 4 / 6 / **0** |

Read `SYSTEMIC_FINDINGS.md` first: four of these concerns were raised against ALL FOUR
directions, so they are the shell or the brief, not you. Do not spend your round on them.

## Every ballot, worst first

### overall 7.4 · owned 6.9 · **Revise**

**Required.** Add a prefers-reduced-motion: reduce block that neutralises dk-draw, and bring the 340ms duration inside 300ms. Then either build and capture the dark theme or replace the seven hardcoded hex with token-derived values. Separately, suppress the How to read the line legend when the read used fewer than N mark types, so a quiet day stops carrying a full key it does not need.

Weakest: `desk__today__owner_quiet__1440x960.png — the quiet day runs 1391px against Editorial's and Rail's 960, and roughly 700px of that is the colophon plus an eight-row How to read the line legend explaining marks that a quiet day barely uses. That is furniture on the emptiest screen in the product, which is the specific thing the brief rejects on sight.`

Concerns:
- Measurable accessibility defect in shipped bytes: desk.css contains one @keyframes (dk-draw) and zero prefers-reduced-motion blocks. Every other candidate guards it (Editorial 1, Index 2, Rail 2). The brief requires reduced motion to remove movement while preserving comprehension; Desk does not implement it.
- Its one animation is --dk-draw: 340ms, over the brief's own 300ms ceiling for routine transitions.
- Heaviest stylesheet at 11.0 KB gzip, 36% above Index's 8.1 KB, and tallest page on 19 of the 20 measured mode/scenario/viewport rows.
- Seven hardcoded hex values (#faf7f2, #fcfaf7, #e8dac2, #171513, #963030, #52525b, #4a3a26) carry the warm-paper identity that IS this direction. No candidate ships a prefers-color-scheme block, but Desk is the only one whose entire distinctiveness is hardcoded light-mode colour, so it has by far the largest dark-theme build still ahead of it.
- Inbox at arrival ships zero buttons and zero action affordances on the row — only 10 title links to ?event=. Journeys 5 to 9 are unevidenced here.

Protect these:
- Correct token discipline where it counts: warms the canvas by deriving --dk-paper via color-mix from --paper/--ink/--accent into its own --dk-* namespace, never redefining a vendored DS token, so ds:check stays green. Zero font-size:Npx, so it adds nothing to the 1,208 arbitrary-px pile.
- Zero client JavaScript. Detail routing is plain hrefs to ?event=…#dk-detail, so the whole interaction model costs 0 KB against the 0.9 KB shared-runtime headroom.
- The unknown vocabulary is genuinely legible: the rule under the headline shortens and turns red, the standfirst moves Read. → Did not answer. → Could not be read., the spine physically breaks at an unread source, and the legend states outright that every mark repeats something the row already says in words.

---

### overall 7.9 · owned 7.6 · **Revise**

**Required.** Defend the cap with composition, not just a count: fold "Coming up" and "Moving well" to named rows carrying their counts, the way D does, so the page's shape states the ranking. Delete the symbol spine and its legend, or give the marks information the row text does not already carry — as written they are a taught system that says nothing. Give the new-user screen one action, as B does. Mark Analytics as limited in the mode row when its trend is withheld.

Weakest: `desk__today__owner_signature__390x844.png — 3390px, thirteen fully expanded rows across four sections of equal typographic weight. The cap is announced and then immediately contradicted by the shape of the page.`

Concerns:
- The three-item cap reads as an arbitrary section limit, not editorial judgement. "Today's signal" holds three, and then "Needs review", "Coming up" and "Moving well" follow at identical heading weight with ten more rows fully expanded. Nothing in the composition says the three matter more than the ten; only the count does. This is the longest page in the lab on mobile (3390px against Rail's 2546px) and it is a task wall by the brief's own definition.
- The spine of indigo squares needs a nine-row legend, "How to read the line", which by its own admission carries no information: "Every mark on it repeats something the row beside it already says in words." A symbol system that must be taught and adds nothing is a pure attention tax paid on every page.
- That legend renders in full on desk__today__owner_quiet__1440x960.png, where not a single marked row exists. Nine rows of explanation for symbols that are not on the page is empty furniture on a quiet day, which the brief rejects on sight.
- desk__today__new_user__1440x960.png is the harshest first-ever screen in the lab: red rule, "Could not be read", the full symbol legend, and no next action anywhere. The one user with no ability to interpret the failure is given the loudest one.
- desk__inbox__owner_signature__1440x960__fold.png shows the rule under the headline broken into two segments with a gap. It reads as a rendering artifact rather than a device.
- Desk's mode tabs mark Inbox and My work as degraded but leave Analytics unmarked, while Analytics has in fact withheld its trend for insufficient history. Silence in a row that names the other degraded modes implies a clean one.

Protect these:
- The fastest verdict device in the set: the first two words after the headline are the state of the read — "Read." / "Partly read." / "Did not answer." / "Could not be read." — set bold with a rule above it that turns from black to red. A quiet day and a broken provider are distinguishable in well under a second, which is the governing rule answered at a glance rather than in prose.
- The accounting sentence is the best-worded in the lab and it changes shape honestly: "Signal read 22 items, showed 8, held back 2, skipped 1 you silenced, and found 11 that crossed nothing" on a good read, and on a failed one it refuses to total at all — "No total is shown rather than a total that would be wrong."
- The warm paper is a real pro-attention move, not decoration. At 7am a warm off-white is less punishing than the white of the other three, and it costs the reader nothing.

---

### overall 8.1 · owned 8.2 · **Revise**

**Required.** Give the new-user world a first action and a human sentence — the founder outcome on that screen is currently zero. Then either label the mode-row coverage marks in words or delete them and retire the legend; a morning page must not need a key. Re-test the warm canvas against a live navigation into Tasks before the paper change is accepted.

Weakest: `desk__today__new_user__1440x960.png — a person's first ever screen reads "Could not be read. Home could not read any project at this scope." in red, then a section headed "What this read could not see", then a seven-symbol key. There is no action anywhere on the page. The product's first impression is a failed read plus homework.`

Concerns:
- Coverage state in the mode row is carried by tiny unlabelled tick glyphs beside Today / Inbox / My work / Analytics (visible in desk__today__provider_failure__1440x960__fold.png and desk__today__partial_coverage__1440x960__fold.png). At 100% they are barely perceptible and mean nothing without the legend at the foot. The direction's own answer to this is a key, which concedes the marks are not self-evident.
- "How to read the line" appears on every page including the quiet day, where it is the largest block on the screen. That is close to empty furniture used to fill a quiet day, and it is the one thing the brief lists as rejected on sight.
- It is the only direction that changes --paper. Home on warm off-white and Notes / Tasks / Timeline on white means the founder crosses a visible seam every time they leave Home. For a suite trying to read as one operating system that is a strategic cost, not a flourish.
- Today at 1440 runs 2,778px with Needs review, Coming up and Moving well all fully expanded below the three decisions. The authored read becomes a task wall by the second screen.

Protect these:
- The strongest at-a-glance state signal in the lab. The rule under the headline changes colour and the lead word changes with it: black rule + "Read." on a quiet day, red rule + "Did not answer." on provider failure, red rule + "Could not be read." for a new user. A founder does not have to read a word to know which day this is.
- The arrival screen puts all three ranked decisions above the fold at 1440 and two of three at 390, with the accounting compressed into one sentence rather than a block of caveats. Best time-to-first-decision at desktop of the four.
- The spine with graded marks gives the whole page one continuous ledger rhythm, and it carries through Today, Inbox, My work and the briefing unchanged, so the four modes read as one document rather than four screens.

---

### overall 8.1 · owned 7.4 · **Revise**

**Required.** Give the 1440 composition something to do with its margins, or narrow the frame so the emptiness is intentional rather than residual — at present A's desktop is its phone layout enlarged. Separately, prove the 390 mode row at 320px and at 200% text with the two-digit badge and the per-mode tick marks both present, and give it a defined wrap behaviour rather than leaving it to chance.

Weakest: `desk__inbox__owner_signature__1440x960__fold.png — a 736px measure centred in a 1440 window with roughly 350px of dead margin on each side and no device occupying either. B earns its margins with a label gutter and a right-aligned lateness column; C puts a rail in one; D puts navigation in one. A puts nothing in either. This is the 390 layout in a bigger box, which is my lens's failure mode running backwards.`

Concerns:
- Mobile here is a reflow, not a transformation. Between 1440 and 390 the document keeps the same order, the same sections and the same disclosure depth; only the header restacks from two tiers to four and the metadata rows drop their pipe separators. Nothing relocates, nothing collapses, nothing is deferred.
- It asks for the most scrolling of the four on a phone: 3390px for Today at 390 (desk__today__owner_signature__390x844.png) against D's 2546px for the identical content.
- The 390 mode row is at its limit. In desk__today__provider_failure__390x844__fold.png the per-mode tick marks push 'Analytics ·' to x≈344 of 390, and desk__today__scale__390x844__fold.png adds a two-digit '42' badge. At 320px, or at 200% text enlargement, this row wraps or overflows. Untested here, but visibly close.
- Chrome at 390 is the tallest in the set at roughly 160px across four stacked bands before the kicker (desk__today__owner_signature__390x844__fold.png).
- The three-tier header reads as deliberate chrome at 1440 and as accumulated bands at 390 — the identity does not survive the restack.

Protect these:
- Second-best fold economy at 390: the first ranked decision title lands at y≈486 of 844, so one whole decision plus its provenance is on screen on arrival, and the four modes stay text-labelled on a single row (desk__today__owner_signature__390x844__fold.png).
- The failure signal is carried by structure, not colour, and survives the width change intact — a red rule plus 'Did not answer.' against a black rule plus 'Read.', legible in the first 300px at both widths (desk__today__provider_failure__1440x960__fold.png vs desk__today__owner_quiet__1440x960__fold.png vs desk__today__provider_failure__390x844__fold.png). The interrupted rule under 'Partly read' is a genuinely good device and it reflows without losing its gap.
- The spine's shape vocabulary and its 'How to read the line' key both survive to 390 intact, so no state is carried by colour alone at the width where colour is hardest to read (desk__today__owner_signature__390x844.png).

---

### overall 8.6 · owned 8.5 · **Pass**

**Required.** Let Analytics widen for the Project ledger instead of holding the Today measure, and vary the headline scale by mode so the four jobs do not open identically. Replace the mode-row coverage ticks with a single legible mark used consistently across all states.

Weakest: `desk__analytics__owner_signature__1440x960__fold.png — the same ~735px column as every other mode, so the Project ledger never earns the widening the brief calls for and roughly 700px of the window is empty margin; the '19 open work' line (bold numeral, grey label) is the flattest piece of typography in the direction.`

Concerns:
- Every mode is the identical centred single column at 1440 with ~350px margins each side. That is a measure decision, not a composition — the direction never uses the width for anything, so the page reads the same at 1024 and 1440 and Analytics gets no earned widening.
- The coverage ticks that appear after Inbox / My work / Analytics in the mode row are cryptic floating glyphs that change shape between states (vertical ellipsis in one capture, apostrophe in another). They are the least resolved detail in an otherwise exact system.
- The headline is set at the same size and weight on all four modes, so Today, Inbox, My work and Analytics all open with identical visual weight. Less editorial variation than the brief's 'mode rhythm' section asks for.
- Full briefing adds a third stacked header band (products / modes / breadcrumb), so three horizontal rules precede the content — the shell starts to compete with what it frames.

Protect these:
- The rule under the headline IS the coverage report: full black when the read is complete, short and red when a source did not answer, black-with-a-gap when partly read. A signature moment that is also the safety mechanism, which is the highest form of what the brief asked for.
- The lede states the page's own reliability before it states any content — 'Read.' / 'Partly read.' / 'Did not answer.' / 'Could not be read.' — set bold and colour-shifted at the head of the measure. Quiet day and broken provider are unmistakably different at arrival, at 1440 and at 390.
- The left spine with filled indigo squares, hollow squares and open crosses gives the list a docket rhythm, and the fielded metadata line (provenance | lateness | idle) separated by hairline dividers is exact without becoming chips.

---

### overall 8.7 · owned 8.6 · **Pass**

**Required.** Put real row actions into the Inbox and My work arrival states, with disabled controls carrying their reason inline, and give new_user a forward control. The spine legend should be reachable from the top of the read, not only discoverable after 2,400px of scroll.

Weakest: `desk__today__new_user__1440x960__fold.png — a person's first ever screen is composed entirely of refusals ('Could not be read', 'The whole day' with an accounting refusal, 'What this read could not see', 'True of every read', 'About this read') and contains no control that leads anywhere. Candidate B proves from identical props that a 'Where to start' block with a real Open Tasks control was available.`

Concerns:
- No per-row action is visible in any arrival state, anywhere. The Inbox carries dispositions and a resurfacing time ('Not read yet', 'Snoozed', 'Comes back at 18:00 on Thursday 16 July') but no Mark as read, Snooze or Clear control on the row. Mark-read-without-resolving, snooze, clear-without-mutating and recover-from-failure are all invisible in this evidence, deferred entirely to a detail state nobody can see. On a lens that is specifically about detail open and return, this is the hole.
- The legend that decodes the spine sits roughly 2,400px down the page. Six unexplained glyphs precede their own key on every read.
- The per-mode state ticks in the tab row are a ~3px mark with no label; their meaning is only recoverable from the foot legend, which makes the one piece of always-on chrome the least legible part of the state system.
- desk__today__owner_quiet__1440x960__fold.png restates the same fact twice in two consecutive registers ('Read. Every project at this scope answered. 2 kinds of work have no source connected.' then 'Nothing you are carrying crossed a rule today, and every project answered. This is still not an all clear, because a kind of work has no source connected…'). The quiet day is where economy matters most.
- The warmed paper is the only canvas in the lab that departs from the design system's default, which means every product route beside Home will read as colder. That is a register question for the architect, not a defect, but it is a standing cost.

Protect these:
- The left spine is a real state machine, not decoration: six distinct marks, a visible break in the rule where a source did not answer, and an in-product legend at the foot ('How to read the line') that names every mark in words and states the redundancy contract outright — 'Every mark on it repeats something the row beside it already says in words, so nothing here is carried by a shape.' The spine persists unchanged across Today, Inbox, My work and Full briefing, so a mode change never resets the reader's grammar. This is the strongest implied-continuity device in the lab.
- The headline rule is a coverage meter that changes with the read: solid full-width on a complete read, split with a gap on partial coverage, short and red on a provider failure — and it is always paired with a worded lede ('Read.' / 'Partly read.' / 'Did not answer.' / 'Could not be read.'), so the graphic never carries the state alone. A quiet day and a broken provider are distinguishable from three metres away.
- Depth is handled in the chrome: Full briefing gets a second-level strip below the mode tabs while Today's tab keeps its indigo underline, so the reader is visibly still inside Today, and 'Back to the top of this read' closes the loop at the foot. Evidence disclosure is the best-labelled of the four — 'THE RECORDS BEHIND THIS (21 COUNTED, 2 LEFT OUT)' tells you the size of what you are about to open before you open it.

---

### overall 8.8 · owned 8.9 · **Revise**

**Required.** Separate new_user from provider_failure in language and chrome. Drop the red rule and the 'COULD NOT BE READ' band for a scope that has nothing in it, suppress the 'one source did not answer in full, and 2 other things are unresolved' sentence when there are no sources, and give the screen a stated next step. Then vary or consolidate the repeated 'Short is not empty' line, and legend the headline rule.

Weakest: `desk__today__new_user__1440x960.png`

Concerns:
- new_user wears the identical red failure chrome as provider_failure: same dark red rule, same 'Could not be read.' lead, same 'COULD NOT BE READ' band. A person with nothing set up and a person whose provider is down see the same screen. That is the governing rule inverted, and A commits it harder than the other three because it dresses the shared shell string in alarm colour.
- On that same new_user screen, 'About this read: This is not an all clear: one source did not answer in full, and 2 other things are unresolved.' There are no projects and therefore no source that answered in part. The sentence asserts a specific failure that the page's own state contradicts. It is the one place in A where a claim is made without anything behind it.
- new_user offers no route out. Editorial's equivalent screen carries 'Where to start / Work lives in a project. Make one in Tasks, and Home reads it from the next read.' with a real control. A leaves a first-time reader with a red band, a legend, and nothing to do.
- 'Some sources did not answer, so this list can be short. Short is not empty.' is a good sentence, repeated verbatim five times on one provider_failure page. Repetition at that density stops reading as care and starts reading as boilerplate, which costs the sentence its weight.
- The headline rule is a coverage meter (one segment when read, two split segments when partly read, short dark red when failed) and it is never explained. 'How to read the line' legends the spine marks meticulously and says nothing about the rule directly above the standfirst.
- Analytics ledger is headed 'Every project you can read', which implies the unreadable ones are absent. B's equivalent adds 'including the ones it could not' and resolves the ambiguity.

Protect these:
- Wins the governing-rule test more decisively than any other candidate. A quiet day opens with a black rule and the word 'Read. Every project at this scope answered.'; a broken provider opens with a dark red rule and a bold red 'Did not answer. 1 project did not answer at all. Nothing here counts it as zero, and no total includes it.' Partial coverage gets its own third lead, 'Partly read.' Three states, three unmistakable openings, all in plain sentences rather than badges.
- The only direction that tells the truth about its own navigation numeral. On Inbox: 'The Inbox count is not complete, so the numeral in the mode row is drawn open on its right rather than closed. It is what could be checked, not a total.' Every other candidate prints a bare count next to a page that says the count cannot be completed.
- Analytics is the only one that surfaces the exclusion before you interact. Each claim's receipt is labelled 'THE RECORDS BEHIND THIS (21 COUNTED, 2 LEFT OUT)' while still closed, so the reader learns what was left out without opening anything. It also refuses a total honestly: 'The read cannot be accounted for exactly, because at least one source did not answer in full. No total is shown rather than a total that would be wrong.'

---

### overall 8.9 · owned 8.8 · **Pass**

Weakest: `desk__today__new_user__1440x960__fold.png — a person's first ever screen is a red rule and a red 'Could not be read.', and the only forward link on the fold is 'Open the full briefing' of the read that just failed. desk__today__new_user__390x844__fold.png repeats it. Honest, but it puts a new user in an error state with no route out.`

Concerns:
- Cross-mode state is the weakest of the four for sighted users. The marks beside Inbox, My work and Analytics in the mode row are tiny unlabelled ticks; I checked the source and the words are only in the aria-label (aria-label="Today. Did not answer.") with the visible span aria-hidden. So a screen-reader user is told the state of every mode and a sighted user must learn a glyph. The words do exist, but at the foot of the page under 'What this read could not see', not next to the mark.
- desk.css warms --paper away from the design system's default, so Home sits on a different canvas temperature from Notes, Tasks and Timeline. Home is explicitly not a fourth product; giving it its own paper is the one cue that argues it is.
- In provider_failure the same tick appears on all four modes, so the row says 'something is wrong everywhere' but not what — the distinction between a refusal and partial coverage lives only in the body lede.

Protect these:
- The two levels are separated by typographic class, not by position alone: products sit in small mono capitals (HOME NOTES TASKS TIMELINE), Home's four modes sit below in larger sentence case with an indigo underline. Nobody has to be told which row is which. A mono eyebrow (TODAY / INBOX / MY WORK / ANALYTICS) then repeats the mode name directly above the h1, so the answer to 'where am I' is given twice on every screen.
- Full briefing is the clearest in the set: a third tier appears under the mode row reading TODAY — FULL BRIEFING, with the underline moved down to FULL BRIEFING while Today stays marked above it. It is structurally impossible to read this as a fifth mode.
- The state grammar for the mode you are in is the strongest of the four and it is carried in words, not colour: a bold lede reading Read. / Partly read. / Did not answer. / Could not be read., reinforced by a rule under the headline that is solid black when read, split with a gap when partly read, and red when a source refused. desk__today__owner_quiet and desk__today__provider_failure are unmistakable at a glance and at two metres.

---

### overall 9 · owned 9.2 · **Revise**

**Required.** Give new_user its own vocabulary, separate from failure. A first-run empty account is not a broken read: drop the red rule and the "Could not be read." stamp for a neutral state, and add a real first step (a labelled route into Tasks) on the page, as Editorial already does. Keep the failure red exclusively for reads that actually failed.

Weakest: `desk__today__new_user__1440x960.png`

Concerns:
- A person's first ever screen is dressed as the loudest alarm in the whole set: a red rule, "Could not be read." in red at headline weight, and a "COULD NOT BE READ" stamp in the foot. The same red vocabulary that means "your provider is broken" is spent on "you have not made anything yet." That devalues the alarm and reads as an accusation on day one.
- Unlike Editorial, the new_user screen offers no way forward at all — no "Where to start", no route to Tasks. The reader is told the read failed and given a link to the full briefing of nothing.
- The failure/partial marks in the mode row (a small superscript tick beside Today / Inbox / My work / Analytics) are the one place the direction leans on a glyph too small to carry its meaning; the words are elsewhere on the page, not in the row.
- Warm off-white paper is a register deviation from the design system's default. Outside my lens, but it is the one thing that will make a truth-critical red read slightly less absolute against a tinted ground.

Protect these:
- Four distinct read states are stamped at headline weight and colour, each with its own rule: a solid black rule with "Read.", a rule with a literal gap in it with "Partly read.", a red rule with "Did not answer.", a red rule with "Could not be read." A quiet day and a broken provider are separable in under a second at 1440 and at 390 — the only candidate where that is unambiguously true.
- It refuses to compute what it cannot know. "The whole day" on provider_failure reads "The read cannot be accounted for exactly... No total is shown rather than a total that would be wrong," and every list group repeats "Some sources did not answer, so this list can be short. Short is not empty." The refusal is per-section, not one banner at the top that the eye learns to skip.
- It solves the incomplete-count problem no one else even attempts: on a partly-read Inbox the mode-row numeral is drawn open on its right rather than closed, and "About this read" says so in words — "It is what could be checked, not a total." Analytics carries the denominator and the exclusion inline on every claim ("21 COUNTED, 2 LEFT OUT"), plus "Not enough history yet. 6 of 14 comparable daily readings."

---

### overall 9.1 · owned 9.2 · **Pass**

**Required.** Put the state word beside each mode name in the tab row rather than a bare mark, and add a prefers-reduced-motion block before the promotion gate.

Weakest: `desk__today__provider_failure__1440x960.png — this is the one place Desk lets a shape carry state without a word beside it: each mode name in the tab row gains a small unlabelled mark. Index and Rail both print the state word next to the mode; Desk relies on the aria-label, which does nothing for a sighted low-vision reader.`

Concerns:
- The tab-row state marks are roughly 6px and wordless. The meaning is in the accessible name only, so magnifier and low-vision users get a mark with no adjacent text.
- It is the only direction that moves the canvas off the token paper (a warm color-mix on --paper). It still measures 6.32:1 here, but no capture carries theme=dark, so the direction with the most contrast surface area to lose is also the one whose ground has changed.
- Its stylesheet declares a forced-colors block but no prefers-reduced-motion block. Reduced motion is untested and unstated for the direction with the most motion-sensitive spine.
- Detail behaviour, focus return and the live-region announcements are absent from every capture, so the parts of the sixteen journeys that matter most to a keyboard user cannot be judged from this set.

Protect these:
- Measures cleanest of the four. On desk__analytics__owner_signature the lowest contrast ratio anywhere on the page is 6.32:1 and not one control is under 44px; on Today at 390 in the scale world there are zero contrast failures across 112 text runs and the only sub-44px control is an inline text link. Nav links are 44-48px tall with a 59px right gutter at 390.
- It is the only direction that explains its own encoding to the reader. The foot of every page carries How to read the line, which states in plain words that every mark on the spine repeats something the row beside it already says, then keys all six marks. That is the anti-colour-alone rule made visible rather than buried in an attribute.
- Quiet, limited and broken are three different sentences and three different rules, not three colours. Read. / Partly read. / Did not answer. / Could not be read. leads the standfirst in every scenario and the rule under the headline changes with it; the spine physically breaks where a source did not answer. Mode links also carry full-sentence accessible names such as Inbox. 42 open. 1 could not be verified.

---

