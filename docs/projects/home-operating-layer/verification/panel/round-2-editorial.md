# Panel round 2 — required corrections for Editorial Line

Scored blind as candidate **B** by ten fresh directors after your round-1 remediation.

| | |
|---|---|
| lowest overall | **7.6** |
| mean overall | 8.41 |
| lowest owned lens | **6.8** |
| Pass / Revise / Veto | 5 / 5 / **0** |

Read `SYSTEMIC_FINDINGS.md` first: four of these concerns were raised against ALL FOUR
directions, so they are the shell or the brief, not you. Do not spend your round on them.

## Every ballot, worst first

### overall 7.6 · owned 6.8 · **Revise**

**Required.** Move the caveat ledger below the ranked decisions at 390, or collapse it to a single summary line with the detail behind disclosure, so that at least one decision is on the arrival screen of Today and at least one responsibility is on the arrival screen of My work. The row-level craft is the best in the lab and does not need touching; the page order does. Also raise the Inbox row actions to a 44×44 target.

Weakest: `editorial__today__owner_signature__390x844__fold.png — the entire arrival screen of Home on a phone, on which not one of the at-most-three ranked decisions appears. Wordmark, products, modes, scope, dateline, kicker, headline, standfirst, then five caveat rows (ELSEWHERE IN HOME, NOT CONNECTED, NOT CONNECTED, THE ACCOUNT), and 'Today's signal' arrives at y≈785 of 844 with the first entry below it.`

Concerns:
- The composition answers 'what could I not see' before it answers 'what deserves attention now', and on a phone that ordering costs the page its job. This is the wall-of-navigation failure my lens exists to catch, with caveats standing in for the navigation; the effect on the reader is identical.
- It is not confined to Today. editorial__my-work__owner_signature__390x844__fold.png puts four caveat rows above 'Waiting', so the first screen of 'What you are carrying' at 390 shows nothing the reader is carrying.
- The cost is structural, not incidental: even at 1440, where the fold is 960 tall, B's first decision lands at y≈716 — the lowest of the four directions on the widest viewport (editorial__today__owner_signature__1440x960__fold.png).
- Row actions fail the touch floor. 'Mark as read' and 'Snooze' at 390 are roughly 20px-high text links sitting side by side with about 24px between them (editorial__inbox__owner_signature__390x844__fold.png). The brief sets 44×44 CSS px for primary controls, and these are the primary controls of the Inbox.
- The excellent transformation happens inside rows and never to the page's order or its disclosure depth, so at the section level mobile is still a reflow.

Protect these:
- The best row-level responsive craft in the lab. At 1440 an entry is a marginal '01', a title and reason in the measure, and a right-aligned lateness column; at 390 the number and the lateness collapse onto one line above the title and the title takes the full width. The layout changes shape rather than width (editorial__today__owner_signature__1440x960__fold.png vs editorial__today__owner_signature__390x844.png).
- The same idea is applied again in Analytics: the hanging label gutter (COUNTED, CANNOT SAY, WINDOW) becomes an inline lead-in on the line it labels at 390, so the semantics survive the loss of the second track (editorial__analytics__owner_signature__1440x960__fold.png vs editorial__analytics__owner_signature__390x844__fold.png). The three-column colophon stacks correctly too.
- Failure is unmistakable at both widths and propagates into the navigation: red target dots appear beside every mode in the mode row and a 'FAILURE · PARTLY READ' stamp joins the dateline, against a plain black-and-white ledger on a quiet day (editorial__today__provider_failure__390x844__fold.png vs editorial__today__owner_quiet__1440x960__fold.png).

---

### overall 7.8 · owned 7.4 · **Revise**

**Required.** Move the coverage ledger below the ranked decisions, or reduce it above the fold to the one-line standfirst it already writes and park the detail at the foot. Today must open on what to do. Keep the new-user screen exactly as it is — it is the best thing in the lab and the other three should be made to match it.

Weakest: `editorial__today__owner_signature__390x844__fold.png — the entire first phone screen is dateline, headline, standfirst and four rows of caveats. Not one decision is visible. The mode the product is named for shows the founder nothing to act on until they scroll.`

Concerns:
- The caveat ledger is placed between the standfirst and the content on every mode. On editorial__today__partial_coverage__1440x960__fold.png the first decision does not appear until 811px down a 960px viewport, behind five grey rows of what could not be read. Honesty has been given the position that belongs to the decisions.
- Consequence of the above: the answer to "what deserves attention now" arrives after the answer to "what is missing". That inverts the mode's job and it is the most consequential ordering error in the lab.
- The suite identity reads as a well-set page rather than an operating layer. At 1440 it commits to a single centred measure with the gutters used only for labels, so the composition never signals that this is the front door to three products.
- "5 OPEN" set large at the right of the Inbox heading is the closest thing in the lab to a KPI numeral, and it is doing no work that the badge in the mode row does not already do.

Protect these:
- The only direction that answers the new user. editorial__today__new_user__1440x960.png carries a "Where to start" section, one plain sentence explaining that work lives in a project, and an Open Tasks control. Every other candidate leaves that person on a dead end. On founder outcome that is the single best decision anyone made in this lab.
- The only Inbox with direct actions visible on arrival — Mark as read and Snooze sit on each event in editorial__inbox__owner_signature__1440x960__fold.png, with the refusal reason ("Mark as read: You have already read this.") shown in place rather than hidden behind an opened row.
- Coverage state is marked in the mode row itself with distinguishable tokens — amber square for partly read, red ring for failure, hollow square for not connected — so the honesty travels with the navigation and is legible from any mode.

---

### overall 7.9 · owned 7.6 · **Revise**

**Required.** Two things, both non-negotiable. First, the Inbox headline numeral must not present as a total when the read was partial — either qualify it in the same type or remove it. Second, raise the failure/quiet difference above glyph scale: the quiet day and the broken provider must differ in something a reader registers before reading, not in the fill of a 10px mark.

Weakest: `editorial__inbox__owner_signature__1440x960__fold.png`

Concerns:
- "In your Inbox — 5 OPEN" is the largest numeral on the page, set as a definite total, on the same screen whose ledger admits "1 item could not be checked against the source, so it is counted but not named." An incomplete count rendered as the page's headline figure is the exact failure the governing rule exists to prevent, and it is committed in the biggest type available.
- A quiet day and a broken provider are the least separable of the four at a glance. The headline, the standfirst position, the rule weight and the ledger layout are identical; the entire difference is a ~10px amber square becoming a ~10px red bullseye and a small-caps label changing from ELSEWHERE IN HOME to FAILURE · PARTLY READ. That is not an at-a-glance difference, it is a reading task.
- The two NOT CONNECTED rows render identically on every screen in every scenario, healthy included. A caveat block that is always present is a block the eye is trained to skip — which is precisely how a real failure ends up unread.
- On mobile the entire first screen is caveat furniture. At 390, on a fully healthy day, the reader reaches the bottom of the viewport without seeing a single decision; the mode this direction is answering is "what deserves attention now?".

Protect these:
- The best single truth sentence in the lab, on My work: "Read 3 of 3 projects. 0 did not answer, and nothing here counts them as empty," followed by named exclusions — "1 item belongs to no project, so it is left out of every project count here" and "1 finished item is filtered out. They are still there."
- The only direction that treats a new user decently. "Where to start — There is no project for new work to go to yet. Work lives in a project. Make one in Tasks, and Home reads it from the next read," with an actual Open Tasks control. The failure framing is demoted to a small-caps SCOPE note rather than an alarm.
- The Analytics margin key — COUNTED / CANNOT SAY / WINDOW / WHAT THE RECORDS SAY, with "No accepted baseline" stated plainly — makes the epistemic status of every number explicit rather than implied.

---

### overall 8.2 · owned 8 · **Revise**

**Required.** Move the caveat ledger below the three ranked decisions, or compress it to one line at the top with the detail at the foot — the decisions must own the arrival screen. Put the row title above its lateness at 390. Add Analytics to the coverage ledger whenever a claim inside it is withheld. Then carry the new-user "Where to start" pattern into the other three directions; it is the best behaviour in the lab.

Weakest: `editorial__today__owner_signature__1440x960__fold.png — the arrival screen is five rows of the system talking about itself (Elsewhere in home, Not connected, Not connected, The account) before a single decision, and only 01 and 02 clear the fold. Decision 03 is below it on a page whose whole promise is three.`

Concerns:
- Honesty is placed where the work should be. On every mode, a five-row caveat ledger sits between the standfirst and the first decision. The machine describes its own coverage before it tells you what to do, and the cost is that the third of three ranked decisions falls off the arrival screen at 1440.
- The colophon at the foot, "HOW THIS PAGE WAS READ", largely restates what the top ledger already said. The same accounting is paid for twice on a page that already asks 2582px of scroll.
- On editorial__today__owner_signature__390x844.png the row order inverts: "4 days late, Sunday 12 July" prints above "Wait for the Ballyhoura venue confirmation". The reader meets the lateness before the thing that is late, which is the wrong order for a scanning eye.
- The "ELSEWHERE IN HOME" ledger names Inbox and My work as partly read and omits Analytics, while Analytics has withheld its trend for insufficient history. An omission from a list of degraded modes reads as a clean bill of health.
- At 1440 the measure uses roughly the middle 840px and the amber square glyphs are small; the coverage state is legible only on close reading, not at a glance.

Protect these:
- The only direction that gives a new user something to do. editorial__today__new_user__1440x960.png ends in "Where to start", one plain sentence about where work lives, and an Open Tasks button. Every other candidate reports the failure and stops. On a lens about protecting attention, this is the single most valuable behaviour in the lab.
- Row actions live on the row. editorial__inbox__owner_signature__1440x960__fold.png shows Mark as read and Snooze inline, with the disabled state explained in words — "Mark as read: You have already read this" — rather than left as a dead control. Deciding without opening anything is the whole point of an Inbox mode.
- The cap gets exclusive typographic rank: numbered 01/02/03 in a monospaced margin and an indigo rule under "Today's signal" alone. The three are visibly a ranked list; the sections below are visibly not.

---

### overall 8.4 · owned 8 · **Revise**

**Required.** Raise every row title and event link to a 44px minimum target, and bind each disabled action's reason to the control with aria-describedby rather than adjacent prose. Both are mechanical; nothing structural needs to change.

Weakest: `editorial__inbox__owner_signature__1440x960__fold.png — the event links you tap to open an item measure 17px tall and the row titles 19px, ten sub-44px controls on one page, and in the server-rendered document all nine row actions carry aria-disabled="true" with no aria-describedby tying the visible reason to the control.`

Concerns:
- Primary target size fails systematically, not incidentally. 6 row-title links at 19px on Today at 390; 10 controls at 17-19px on Inbox at 390. These are the operational targets. The brief asks for 44x44 on primary controls and the other three directions deliver it on the same rows.
- The disabled actions state their reason as adjacent prose rather than an associated description, so a screen-reader user hears a disabled button with no explanation. Before hydration the whole Inbox is inert.
- The 11px all-caps mono label column carries the accounting (COUNTED, CANNOT SAY, WINDOW, WHAT THE RECORDS SAY). It is the smallest type in the lab and the first thing that will break at 200% text-only enlargement.
- The amber square and red ring beside Inbox and My work in the mode row carry state with no adjacent word. It is repaid lower down by ELSEWHERE IN HOME, but the navigation itself is a shape.

Protect these:
- Contrast is deliberate and it holds. Zero failures on every page measured: 120 text runs on Today at 390, 222 on Analytics at 1440, 129 on Inbox at 390 with a floor of 4.83:1. It is also the only direction whose stylesheet declares both prefers-reduced-motion and forced-colors.
- It is the only direction that shows row actions and the only one that explains a disabled control in words. editorial__inbox__owner_signature__1440x960__fold.png shows a greyed Mark as read followed by the sentence Mark as read: You have already read this. Disabled-with-a-reason is craft the other three never attempt.
- State is never a colour on its own. Every mark sits inside an ink stroke and always beside a small-caps word: FAILURE · PARTLY READ, NOT CONNECTED, ELSEWHERE IN HOME, THE ACCOUNT. The provider-failure dateline names the failure before the reader reaches any glyph.

---

### overall 8.6 · owned 8.7 · **Pass**

**Required.** Before promotion, capture Inbox at the scale fixture and measure the island's hydration cost and route chunk in isolation, with a written ceiling for it. Then lift the first decision above the fold at 1440 — collapse the coverage ledger to a single summary row that expands, so the signature day leads with the three decisions and the caveats stay one interaction away rather than 350px of scroll.

Weakest: `editorial__today__owner_signature__1440x960__fold.png — the coverage ledger consumes roughly 350px between the standfirst and Today's signal, pushing the first ranked decision to y≈716. Only two of the three decisions fit a 1440×960 screen, and Today's entire job is at most three ranked decisions. It is the only candidate that cannot show its own thesis on one screen.`

Concerns:
- The only direction that spends client JavaScript. Route-local islands are explicitly permitted and this one buys real behaviour, so the spend is legitimate, but it is a spend against a programme with 0.9 KB of headroom, and it is entirely unquantified in this evidence set — the captures ran no client JS, and there is no inbox-at-scale capture anywhere in the matrix. At the scale fixture (50 grouped events) that island hydrates roughly 100 buttons.
- Inline row actions on Inbox are precisely where Home would be tempted to reach for useTaskPanel/useTasks. Hard constraint 2 says Home may not inherit the Tasks runtime; this is the direction most exposed to that drift and it needs an explicit boundary before any production code.
- Composition puts caveats before content on the signature (good) day. Four ledger rows of what could not be read sit above the three decisions the mode exists to deliver, which inverts the priority on the most common screen.
- Uses generic --x-cols, --x-gap, --x-measure, --x-page variable names rather than an --ed-* namespace, risking collision with any other --x- consumer.

Protect these:
- The only direction that proves the Inbox journeys in shipped markup: 21 <button> elements with 9 disabled states, labels Mark as read, Snooze and Try again, and an explanatory line for a refused action. The other three ship zero buttons on Inbox. The capture README blames the missing detail behaviour on no ?event= being set; Editorial renders its actions in that same arrival state, which shows the omission elsewhere is a design choice, not a capture limit.
- Cleanest engineering hygiene in the lab: zero hardcoded hex across 516 var(--) references, zero font-size:Npx, no DS token overridden, max motion duration 260ms inside the 300ms ceiling, prefers-reduced-motion and forced-colors both handled. Being fully token-driven means dark theme most likely arrives for free.
- Best quiet day of the four: 960px at 1440, exactly one viewport, no scroll, nothing invented to fill it — headline, one honest sentence, four ledger rows, colophon. Against that, provider_failure escalates to red ring markers in the dateline and on three mode links plus a FAILURE · PARTLY READ ledger row. A quiet day and a broken provider are unmistakable at a glance, and the difference is carried in words as well as marks.

---

### overall 8.8 · owned 8.7 · **Pass**

Weakest: `editorial__today__owner_signature__1440x960__fold.png — the two navigation rows are set at near-identical size, case and weight, so 'Home Notes Tasks Timeline' and 'Today Inbox My work Analytics' read as eight peer links separated by a hairline. This is the weakest expression of the two-level model in the set, and it is the exact thing my lens exists to catch.`

Concerns:
- Level separation depends almost entirely on the wordmark, one hairline and an active underline. A first-time user could reasonably read the second row as four more products, which is precisely the confusion the architecture is meant to prevent.
- Full briefing is signalled by switching Today's underline from solid to dotted plus a TODAY / FULL BRIEFING breadcrumb in the dateline. Correct, and elegant, but it is the subtlest depth cue of the four and a dotted-versus-solid underline is a fine distinction to hang a route level on.
- Three glyph shapes plus two colours is the largest symbol vocabulary here. It is coherent, but it is a vocabulary, and at 390 the marks sit in a cramped mode row where the amber square is very small.

Protect these:
- The best-taught convention in the lab. Three marks (filled amber square = partly read, hollow square = not connected or unreadable, red ringed dot = a source refused) are used identically in the mode row, in the dateline and in the left margin — and a keyed legend sits on the same screen, immediately under the standfirst, spelling the marks out in words: ELSEWHERE IN HOME · Inbox · Partly read. The key teaches itself on first contact; no other candidate does that.
- State of the modes you are not in is reported from wherever you are, in words, and it updates correctly: editorial__today__provider_failure puts red ringed dots on all four modes and a FAILURE · PARTLY READ row in the margin, while editorial__today__owner_quiet carries one amber square on My work and a calm colophon. A quiet day and a broken provider are not confusable.
- The only candidate that gives a new user somewhere to go: editorial__today__new_user carries a 'Where to start' section and an Open Tasks control on the fold, instead of leaving them inside a failed read.

---

### overall 8.9 · owned 9.1 · **Pass**

**Required.** Make a broken provider change the page, not only its markers: carry the red into the rule system or the headline area so the failure has page-level weight, matching what A achieves. Then collapse the double eyebrow to one.

Weakest: `editorial__today__provider_failure__1440x960__fold.png — the failure state is carried by 8px red rings and a mono 'FAILURE · PARTLY READ' chip. The type weight, the rule weight and the page colour are unchanged from the healthy screen, so at a glance across a desk this reads as a normal day with a small dot on it.`

Concerns:
- At-a-glance failure signalling is the weakest part of an otherwise excellent system. Candidate A changes the headline rule and the lede colour; B changes markers only. Against a rule the brief says to weigh heavily, that is a real gap.
- The coverage ledger can stack four consecutive rows before any content (see editorial__my-work__owner_signature__1440x960__fold.png), pushing the actual responsibility list well down the page. Honest, but it delays the job.
- Two stacked eyebrows above the headline — the mono dateline, then 'TODAY' — is a small hierarchy muddle at the most-looked-at point on the page.
- Amber introduces a third hue beyond indigo and red. It is meaning-bearing so it is permissible, but it is the least resolved colour decision on the page and it sits in the global nav where it is smallest.

Protect these:
- The only genuine editorial grid in the lab: right-aligned mono labels in a left margin, a content measure, and right-aligned quantities against a rule system that spans the full width. The page has a spine, a shoulder and a foot, and the rules do all the containing — no card anywhere.
- The marginalia are load-bearing, not decorative. 'Held up, or parked in a waiting column.' sits in the margin beside Waiting; COUNTED / CANNOT SAY / WINDOW sit against the exact lines they qualify on Analytics; '2 asks in this thread.' sits beside the thread it counts. Very few product teams attempt this and fewer land it.
- Two earned signatures: the three-column colophon 'HOW THIS PAGE WAS READ', and the dotted underline that replaces Today's solid rule when you are inside Full briefing. That second one is the most sophisticated single detail in the whole lab — depth expressed as a change in the mark, not another band of chrome.

---

### overall 8.9 · owned 8.8 · **Pass**

**Required.** Fix the mobile ordering so at least the first ranked decision is on the arrival screen at 390 with the coverage ledger following or collapsed behind a named disclosure. Correct the new_user standfirst so it describes the new_user state rather than inheriting the failure sentence.

Weakest: `editorial__today__owner_signature__390x844__fold.png — the arrival screen of the entire product on the device the founder opens at 7am, containing zero ranked decisions. Five ledger rows and a section heading fill the first screen; 'Today's signal' appears at the very bottom edge and the first decision is below it. On a failure day that ordering is defensible. On the ordinary signature day it inverts Today's whole job.`

Concerns:
- The new_user standfirst is factually wrong for its own state: 'This is not an all clear: one source did not answer in full, and 2 other things are unresolved' is shown to a person with no projects at all. The most prominent sentence on the most fragile screen is inherited from a different scenario. Every direction carries some version of this, but B is the one that puts it in the standfirst.
- The return from Full briefing is a small monospaced dateline link ('TODAY / FULL BRIEFING') plus a dotted underline on the Today tab. The dotted underline is a lovely, exact detail, but as the only return affordance it is the least discoverable of the four — C and D both give a named 'Back to Today' control above the fold.
- The numbered margin (01, 02, 03) that carries the ranking on Today disappears entirely on the Full briefing, at exactly the moment the page announces itself as 'Every row the ranking kept, in the order it ranked them'. The ranking loses its own notation where the ranking is the point.
- At 1440 the header and the colophon run the full width but the article sits left with roughly a third of the window empty beside it. The device is deliberate and it does resolve at the foot, but the middle third of the signature screen reads as unclaimed.
- The amber and hollow squares beside Inbox and My work in the mode row carry meaning with no adjacent label; they are only decoded by the ledger further down the page. The ledger makes them recoverable, but not at the point of use.

Protect these:
- The only direction that shows working per-row controls in the arrival state, and the only one anywhere in the lab that shows a disabled control with its reason attached: 'Mark as read' greyed with 'Mark as read: You have already read this.' printed beneath it. That single row says more about interaction craft than any other pixel in this set, and it survives intact to 390 (editorial__inbox__owner_signature__390x844__fold.png).
- The coverage ledger is one component whose shape never changes. The same left-labelled rows carry ELSEWHERE IN HOME, NOT CONNECTED, FAILURE, SCOPE, COVERAGE, LEFT OUT OF THIS LIST and THE ACCOUNT across every mode and every scenario, so a scope or mode change swaps content inside a fixed frame instead of relayouting the page. That is the cleanest transition any of these stills implies. THE ACCOUNT then refuses to total when it cannot: 'No total is shown rather than a total that would be wrong.'
- State propagates into the navigation and matches the ledger glyph exactly — amber square for partly read, hollow square for not connected, red target for failure — so what you will find in a mode you are not standing in is legible before you go there. And it is the only direction with a forward path for a new user ('Where to start', 'There is no project for new work to go to yet', 'Open Tasks').

---

### overall 9 · owned 9.2 · **Pass**

Weakest: `editorial__today__provider_failure__1440x960.png`

Concerns:
- The failure marking is under-weighted for the loudest fact on the page. A dead provider is announced by a small monospace tag in the dateline, 'FAILURE · PARTLY READ', plus a gutter glyph. Read the sentences and it is impeccable. Glance at it from a metre away against editorial__today__owner_quiet__1440x960.png and the two pages have the same shape and the same weight. That is the one governing-rule test B answers more softly than A.
- My work states 'Read 3 of 3 projects. 0 did not answer' and then, two lines below, two rows both labelled 'COVERAGE · PARTLY READ'. Both are true and reconcilable, but placed adjacently they read as the page contradicting itself on first pass. The standfirst should say which sense of 'partly' is meant.
- The coloured glyphs beside Inbox, My work and Analytics in the mode row (amber square when partly read, red bullseye on failure) are never legended. Their meaning is recoverable only from the ledger further down the page. A carries an explicit legend for exactly this class of mark.
- Shares the shell defect: new_user still asserts 'one source did not answer in full, and 2 other things are unresolved' on a screen with no projects. B mitigates it with 'Where to start' but does not correct the sentence.

Protect these:
- The most complete truth machinery in the lab, and the only one that types every qualifier. Each limit is a labelled ledger row: 'COVERAGE · PARTLY READ', 'ELSEWHERE IN HOME', 'NOT CONNECTED', 'THE ACCOUNT'. The account reconciles arithmetically: 'Signal read 22 items, showed 8, held back 2, skipped 1 you silenced, and found 11 that crossed nothing' is 8 + 2 + 1 + 11 = 22.
- Analytics makes the boundary of a claim a named field. Every number carries 'COUNTED', 'CANNOT SAY', 'WINDOW'. 'CANNOT SAY' is the best single piece of content design in the lab: it stops a caveat being grey text beside a number and makes it part of the claim's own structure. B is also the only direction that prints 'No accepted baseline' under each metric, which is a real absence the other three silently drop.
- Coverage claims carry a denominator, not just an adjective. My work opens 'Read 3 of 3 projects. 0 did not answer, and nothing here counts them as empty', then declares its own exclusion in a labelled row: 'LEFT OUT OF THIS LIST · 1 finished item is filtered out. They are still there.' Its project ledger is the only one qualified honestly: 'Every project in what Home is reading, including the ones it could not.' Inbox explains why a control is unavailable in words rather than by greying it: 'Snooze: Only an open item can be snoozed.' A refused action states what did and did not happen: 'The source refused this. Nothing changed there, and this is still open.' And new_user is the only first-ever screen with a truthful route out.

---

