# Signal Tasks · the dispatch

The Tasks dispatch. Convention: BRAND.md §6.5. Entries before
2026-05-14 keep their original shape; the new shape starts at the
next cycle.

## 2026-09-05 · January candidate · Drive ownership before connection

Connections explains who will own and see the board's Drive files before an
account is connected. Cancelling disconnect or an owner change returns keyboard
focus to the control that opened it.

The scoped component matrix and independent UI review pass. Pending revocation
after reload and the complete provider lifecycle remain open. Evidence and limits:
`experience/reviews/january-drive-ui-acceptance-2026-09-05/REPORT.md`.

## 2026-09-05 · January candidate · Dates follow the project

Floor and My work now use the same project calendar for day labels, overdue
work and daily grouping. A refreshed project day updates the header and tasks
together. Creating another wedding project leaves existing access grants alone,
including revoked grants; redemption reads the new project's own date.

Sponsored-date editing keeps access copy current and preserves the confirmed
revision across a pending save. Both readback defects pass independent verification.
The final build,132 built cases,32 date states and3 keyboard paths pass. Five date
controls now use an explicit44px minimum. The exact evidence and limits are in
`experience/reviews/january-recipient-2026-09-05/README.md`. Customer identity,
provider, design and receiving acceptance remain separate.

## 2026-09-05 · January candidate · My work uses your known name

My work now greets the signed-in person using their existing workspace profile.
When no name is known, the greeting stays neutral. Demo accounts retain their
sample names. Completion controls use the existing task colors and a 44-pixel
target. Completed text stays subdued while its control remains at full contrast.
Six source-fixture tests and final scripted browser checks pass. Real account
and human-use verification remain open. Internal candidate only:
`docs/execution/january-2027/RECIPIENT-COMPOSITION.md`.

## 2026-09-05 · January candidate · Home opens the right briefing

An observation about several tasks now opens the full briefing for the same project or planning period. Individual tasks still open their own detail. The aggregate action says “Read”, and the source names the scope it describes.

Explicit Home and Full Briefing links also retain their reading scope. An unavailable link no longer substitutes another saved project. Internal candidate: thirteen focused checks and scoped desktop/mobile rendering pass; full suite and authenticated browser acceptance remain open. Evidence: `docs/guides/evidence/home-aggregate-links/README.md`.
## 2026-09-04 · January candidate · billing follows payment evidence

Event checkout uses a one-time payment and a twelve-month access term. Missing
billing configuration cannot grant paid access. Repeated provider events resume
unfinished fulfilment without duplicating access or extending its term. Billing
settings directs subscription changes to Manage billing and no longer reports a
cancellation that Stripe has not made.

Internal candidate only. Local database tests, typecheck, lint and build passed;
provider lifecycle and final suite acceptance remain open. See
`docs/execution/january-2027/BILLING-REHEARSAL.md` for evidence and limitations.

## 2026-08-27 · T·153 · fixes · settings stopped telling every customer that uploads do not work

**Settings has been saying "File uploads are not yet active on this workspace"
to every real customer, unconditionally, while uploads were live — and the four
file-size numbers behind it disagreed with each other and with the platform.
The copy is now true, the numbers come from one constant, and a file goes from
the browser to the store without crossing a server.**

Two separate untruths, one screen. The line in `storage.tsx` had no demo-mode
branch, so it was not stale review copy: it shipped to production, above a
usage bar that was quietly counting real files. `BLOB_READ_WRITE_TOKEN` has
been provisioned on the project for twenty-four days.

The size story was worse than the four numbers already recorded. `next.config`
capped server-action bodies at 8 MB, `SERVER_UPLOAD_LIMIT_BYTES` said 50 MB,
the free plan said 10 MB, the toast said 50 MB — and Vercel refuses any
function request body over **4.5 MB** before the framework sees it. Every one
of the four was unreachable. A 5 MB PDF could not be attached at all, and
failed with a platform error the app never saw.

So the bytes stopped going that way. The browser asks for a URL signed for one
pathname, one size and one type set, sends the file straight to the store, and
a finalize step re-proves the caller,
confirms the file landed where we said, confirms nobody without credentials can
read it, and re-reads its leading bytes through the same allowlist the old path
used. A returned URL is a claim, never evidence. Deliberately the same shape
Project Drive will use against Google Drive one provider later.

A presigned URL rather than the Blob client helper, for two reasons. The
helper costs 36.7 KB gzip in every browser and breached the bundle ratchet,
which is a founder decision rather than an edit. And it could not constrain the
access mode — the browser passed its own — so a modified client could have
written a private-by-policy attachment as a public object. Signing bakes that
in server-side, and leaves the browser a bare PUT with no library at all.

Verified against the production store, not asserted: 17 checks across both
paths, including a signed URL refused when repointed at another pathname.
`scripts/verify-blob-store.mjs` reruns it.

Also closed: content validation would otherwise have been lost the moment the
bytes stopped passing through our hands, and a claim row abandoned by a killed
browser would have held quota forever. `pnpm first-contact:language`,
`lint`, `typecheck`, `test` and `build` all green.

## 2026-08-22 · T·152 · tightens · design tokens now come from the package, not a copy

**The app's system tokens are imported from the `signal-ds` npm package
instead of the vendored `src/ds/` copies, closing the drift risk between
what the app ships and what the design system publishes.** `globals.css`
imports `signal-ds/tokens.css` and `signal-ds/tailwind.css`; the two
vendored files are deleted and the app-owned `theme-overrides.css` stays.
Zero visual change by construction — same 2.1.0 token values, one source.
Part of the founder-approved ds-foundation pivot (tokens-first contract,
2026-08-22); studio and signal-motion swaps land alongside.

## 2026-08-22 · T·151 · tightens · a four-lane board fills its sheet again, and legacy boards get their lane back

**The founder's live board came back from A·Air with dead margins down both
sides and a lane missing. Both causes are fixed: the floor honours the
fit-columns preference again, and legacy configs resolve onto the shipped
five-column board instead of four.**

Two compounding defects, one visible symptom. The floor port dropped the old
board's fit-columns preference, so any workspace whose column count multiplied
below the sheet's width floated narrow centred tracks in a void — at 1917px,
a four-lane board lost ~285px to empty paper on each side. And that workspace
had four lanes because its config was written before columns existed: a flat
rename record parsed onto `emptyConfig`, which carries no Waiting. Nothing had
ever deleted the fifth lane; the parse just never knew about it.

Legacy configs now resolve onto the shipped five columns with renames riding
on top (nothing chose to remove Waiting through that shape), blank system
renames and nameless custom columns are dropped at parse so no headerless void
can render, and fit-columns is once again the default with fixed-width mode
preserved behind it. Verified at the founder's own viewport: four lanes fill
edge to edge, sixteen pixels of air, nothing floating.

## 2026-08-22 · T·150 · ships · the board locks to A·Air, and the design fences come down

**Open Tasks today and the board is exactly the configuration the founder chose
in the design console — flat cards, soft radius, compact density, subtle indigo,
calm type — and the standing design gates retire with it. What governs the
surface now is `docs/design/FLOOR_CANON.md`, the north star, and taste.**

The five axes were already built: the floor ships option CSS for every console
combination behind five data-attributes. This pass makes the founder's choice
the only one — a single named constant (`FLOOR_PRESET`) instead of two hardcoded
defaults that differed from it. A computed-style probe against the design master
at the same configuration matches production value for value on every measured
axis: card padding, radius, shadow (none), row gaps, title/note/foot metrics,
tick and chip sizes, tray rhythm, head height, sheet and dock.

Retired by founder decision, with their enforcement chains: the ds-check hex and
easing ratchet with its grandfather manifest, the chrome and loading geometry
contracts, the motion contract, the delight catalog ground rules, the board
pass-3 styling contract, and the Wave-0 B0 external council baseline. Business
contracts stand untouched: URLs and naming, the database release gate, HQ sync.
The quality council stays fully active in receipt-pending mode and reports NOT
CERTIFIED honestly until the receipt set lands.

Two honest edges, both fixed or named: compact density crushed the stacked
mobile header at 390px — an inheritance from the design master itself, which
breaks identically — now fixed in the port and recorded upstream as a master
finding; and the loading tracing plus empty-state ghost were re-targeted to the
flat card so the waiting surface promises what arrives. Evidence: 132/132
critical experiences green on the production build, validate clean, materiality
review recorded for the changed surface.

## 2026-08-18 · T·149 · redesigns · the board is one sheet, three colours, and it answers the keyboard

**Open Tasks today and there is one spine instead of two, the project's name where
the app's name used to be, and a board that has stopped shouting. The amber lane
dot, the green tick and the red overdue line are gone — not tidied, gone. What is
late is the blackest thing on the screen; what is finished steps back; what is due
today is outlined and serious and nothing has gone wrong yet. The board says which
of those it is with ink, and never with a colour.**

Studio Floor is the design, chosen from a four-way exploration and then taken
through eleven rounds of a seven-seat quality panel — 350 findings raised, 243
confirmed by an adversarial verifier and fixed. It ships at a stated 8.1–8.7
against a 9.5 bar, with the remaining two to three days named in the decision
record rather than hidden. The bar was never lowered to pass.

What changed for a venue manager:

- **One spine.** The top bar and the projects sidebar stand down on Tasks. The
  capsule rail on the left is the only spine, and the header states the project by
  name, the day, what is done, what is overdue and what has no date yet.
- **Three colours.** Ink, Indigo and White. Every time fact is a point in time and
  the fill states the condition — filled means behind, outlined means today, indigo
  means the next milestone, a hairline ring means a record.
- **The whole board is one tab stop.** Arrows walk it, Space picks a card up,
  arrows place it, Escape puts it back exactly where it came from. It does not grow
  with the work on it: five stops at rest, five at peak season.
- **A dock at the foot** carrying search, add and your account, and a strip that
  says what you just did and offers the way back.

List, Schedule and Calendar keep their existing interior inside the new shell until
the redesign reaches them. The design master, the eleven-round record and the
session report are archived in Signal HQ at `/hq/labs/tasks-studio-floor/`; the
decision is recorded at `content/hq/decisions/tasks-studio-floor-2026-08.md`.

The stylesheet is generated from the design master by
`scripts/design/extract-floor-css.mjs`, so the shipped surface and the design
reference cannot drift apart.

## 2026-08-17 · T·148 · tightens · a link someone sends you stops deciding where you work

**Open a link to a project someone shared, glance at it, close the tab. Until today,
the next time you opened the app you were in their project, not yours — and nothing
had told you it moved. Following a link is not the same as choosing a place to be,
and the app now knows the difference.**

The project a link points at still opens, exactly as it did. What changed is what
happens afterwards: your own last-open project is left where you put it. The link
carries the project it means, so it lands where it should without quietly rewriting
your starting point.

This one waited for the control that makes it safe. If a link takes you somewhere
and you decide you want to stay, there now has to be a visible way to say so — and
as of this pass there is.

## 2026-08-17 · T·147 · ships · the project you are in moves into the frame

**Nothing looks different today. Behind a switch that is still off, the project you
are working in now has a permanent home in the top bar — the same place on every
screen, on Notes and Tasks and Timeline alike — with the list of your projects one
click away, and a switch that stops and asks before it can lose unsaved work.**

Until now the only way to change project lived inside one product's sidebar. Someone
working in Notes had no way to see which project they were in, let alone change it.
The new control sits in the bar that is always there, says which project you are in,
and opens a list of the rest. On a phone it moves to a strip under the bar and opens
a sheet you can reach with a thumb.

The switch itself is careful in ways the old one was not. It asks the surfaces you
are working in whether anything would be lost, and holds the switch if the answer is
yes — a note you have started writing is enough to stop it. Two projects with the
same name stay in the list and say why they cannot be chosen, rather than quietly
picking one. And a project you have archived opens read-only rather than pretending
it can still be worked in.

The switch is off. Everything above is built and tested and waiting behind it.

## 2026-08-17 · T·146 · ships · the app starts remembering how plans move

**Nothing looks different today. What changed is that two kinds of history the
product could never show — because nothing recorded them — start being
recorded: when a milestone's date moves, and what each project's numbers were
at the end of each day. The analytics view the founder selected this week
draws on both, and neither can be reconstructed later. A reading not taken is
gone.**

The first recorder sits where dates actually change. When the Tasks sync
rewrites a milestone's date, and when an owner moves a date by hand on the
Timeline plan, the old date and the new one are written down together, in the
same breath as the change itself. Only a real move is recorded: a date
appearing on an undated milestone is creation, and a date being removed
leaves nothing to compare, so neither writes a row.

The second recorder is a nightly reading. The snapshot machinery — tables,
receipts, fairness ordering, retention — shipped complete in last week's
analytics foundation and then sat unused, because nothing ever called it.
It now runs every night at 02:30 UTC, oldest-first so no workspace is
starved, once per day per workspace, with a durable receipt for every run
including the failed ones.

Both recorders are off until their switches are turned on, and the metric
registry says exactly that: the movement metric's entry now names the
switch, and states that movement before enablement is permanently
unrecorded. The fixtures keep modelling the flag-off world, so a green test
still certifies the world that exists.

Proven by six new history tests against a real database — including that the
recorded rows parse under the analytics provider's own predicates — and four
gate tests on the nightly route's secret and switch. The pinned sync-safety
and generation suites run unchanged: 40 of 40.

## 2026-08-12 · T·145 · corrects · the front door lets in the people it invited

**An invited collaborator or a sponsored couple can now reach Home, the Full
Briefing, Notes and Timeline. For the last three weeks they could open Tasks
and nothing else. Every other signed-in surface sent them to the waiting
list, after the invite that brought them there had already been spent.**

The app has one access boundary, on the /app layout. It was widened on 21 July
to admit two kinds of person the allowlist does not name: someone who accepted
a workspace invite, and someone who redeemed a sponsored code. Both are given
a membership row on the way in, and the layout reads it.

Thirteen pages underneath then re-ran an older, narrower check that reads the
allowlist and nothing else. The layout let the person in and the page turned
them around, and because the page runs last, the page won. This was not a
subtle interaction: it was two access policies disagreeing, with the stricter
one nested inside the wider one.

Those pages now run the same check the layout runs. The second check is what
it was always meant to be, a repeat of the first rather than a stricter
second opinion.

Two guards make this class of mistake fail loudly now. The module-boundary
gate used to require the narrow check on every module page, which is how the
divergence was both created and then held in place; it now requires the wide
one and rejects the narrow one by name. A new test walks the whole /app tree
and fails if any file there reaches for the allowlist-only check under any
name, including behind a rename.

Worth recording is why this lasted three weeks. The founder is on the
allowlist, so both checks admit the founder, and no amount of using the
product would have shown it. It is reproduced now by a test that signs in as
a non-allowlisted account holding a real membership row, runs both checks
against a real database, and asserts where each one lands.

Honest edges. Access is unchanged for everyone else, and that was asserted
rather than assumed: a stranger with no membership row still goes to the
waiting list, and signed out still means out. The proof is at the level of
the gates, not of a real second account signing in to production, which needs
a Clerk identity this repo cannot create for itself. A non-allowlisted member
now costs one extra indexed membership lookup per page render, which is the
price of keeping the page check rather than deleting it. And the wide check is
still named `requireAppAccessTasks`, from when this repo was only Tasks, which
reads wrongly now that it gates the whole suite; the guards above deliberately
do not depend on anyone reading that name correctly.

## 2026-08-12 · T·144 · tightens · the daily digest reads your workspace, and only yours

**Your morning digest showed you the mentions from your workspace. To find
them it was reading every workspace in the product.** The query that gathers
your mentions filtered on the kind of comment and on the last 24 hours, and
never on your workspace. A comment written somewhere else could reach your
inbox, and reach the digest email, if it happened to name you.

The same fault dropped mentions that were genuinely yours. The query took the
50 most recent comments across the whole product, then checked which of them
were addressed to you. On a quiet day you saw everything. On a day when other
people were busier, your own mentions fell off the end and the digest went out
without them. That half needed no attacker and no coincidence. It was wrong
every day, in proportion to how well the product sold.

Both are fixed in one place. The mention query now filters by workspace, and
looks for your name in the database rather than after the fact, so the row
limit applies to your mentions in your workspace instead of to everybody's.
The follow-up that turns a mention into a task title is scoped the same way,
so a title from another workspace cannot ride along with a snippet.

The check that should have caught this now catches it. The tenant gate reads
the code and demands a workspace filter on every read of workspace data. It
had been passing this one. The query joins the people table to get the
author's name, and the gate counted the user id inside that join as proof.
A left join proves nothing. Every row on the left survives it whatever the
join says, so the gate ignores left joins now. Inner joins still count,
because an inner join to the membership table genuinely does narrow the
result, and a test holds both halves of that line.

That test needed somewhere to run. The file that proves the tenant gate can
tell a scoped read from an unscoped one was listed in the test command
without the flag that runs it, so for as long as it has existed it was
handed to a different script as an argument and quietly ignored. It runs
now. It brought 27 tests with it, and they pass.

## 2026-08-12 · WP1 · corrects · Timeline answers for the project you asked for

**Ask Timeline for one project and you get that project — or a clear refusal.
Never a different project's plan, quietly.**

Timeline had two ways of being helpful that were the same mistake. If it
could not tell which timeline belonged to the project in the link, it opened
your first one. If your project had no timeline yet, it made one against
whichever project it decided was your main one. Both meant a link naming one
project could put another project's plan on screen, looking entirely normal.

Timelines are still created for people who have none — that was a real dead
end and closing it was right. What changed is that creation is now tied to
the exact project in the link, and where the evidence does not settle which
timeline belongs to which project, Timeline says so instead of picking. A
guess between two projects is silent, permanent, and much harder to notice
than a question.

The second half is about deleting. Timeline refreshes itself from your
milestones in Tasks, and anything no longer there is removed — correct when
you unmarked a milestone, ruinous when the refresh simply failed. Every kind
of failure looked identical to an empty project: a dropped connection, an
expired key, losing access to the project, or a project with more than two
hundred milestones, where everything past the two hundredth read as deleted.

A refresh now has to prove it saw the whole project before it may remove
anything, and it has to prove you can still read that project rather than
inferring it from an empty answer. If it cannot, your timeline is left
exactly as it was and you are told. Deliberately clearing every milestone
still works, immediately, because that is a successful read of an empty
project rather than a failed read of a full one.

Connecting a project to a timeline is now the project owner's act, and only
theirs. Anyone invited to a project could previously connect it to a timeline
they owned — which took the one connection the project has, locked its actual
owner out, and pulled that owner's milestones into a timeline the invitee could
publish.

Two things this does not claim. Refreshing is now refused outright for an
archived project, and that is a capability traded away deliberately, not a hole
closed: archived projects refreshed correctly before this, and the data loss was
in the deleted and revoked cases, not this one. Nothing else about an archived
project's timeline changes — you can still edit, reorder, hide, add and publish
it by hand. Only refreshing from Tasks stops, and the better answer is to let it
refresh without deleting; that machinery already exists and is turned on next.

And a refusal is not always a failure. Where refreshing cannot work — the
project is archived, or your access to it has gone — you get a quiet line saying
so once, and the Sync button says why it is unavailable rather than inviting a
press that repeats the same sentence. A refresh that fails because Tasks was
briefly unreachable is a different thing and still offers Retry, because that
one can work.

Notes gained the same refusal. A link naming a project you cannot open no
longer quietly files your notes into a different project from the same term.

## 2026-08-12 · T·143 · tightens · the Planning count says what it counts

**The number beside Planning now names what it is. It reads "5 undated"
instead of a bare 5, at every screen size.**

The header holds three words about time: Planning, Schedule and Calendar.
Two of them are views of work that already has a date. Planning is where
you go to give work a date, see the milestones you have marked, and check
how far through the season you are. A bare figure next to the first of
those three told you nothing about which was which.

Planning keeps its name, because that is what the drawer is. What changed
is that its count carries its noun, so the control announces itself as a
different kind of thing from the four view tabs, none of which ever show
a number.
## 2026-08-12 · T·142 · corrects · the closing review's findings, closed

**A five-seat closing review read the shipped product against its own claims,
and what it found wrong is fixed.** Entering a product no longer trips a
hydration mismatch: the arrival settle marked the surface in a way React
checks at hydration, and every product surface logged an error for it — five
errors, now zero, with the mechanism moved where the check cannot see it.

Notes fills the screen it is given. Its column stopped at a fixed measure
while the frame's rules ran to the true edge, leaving a third of a wide
screen as dead paper crossed by hairlines. The column is capped and centred
now, so a wide screen gets two even margins and every rule ends where the
content does.

The task conversation's draft control said "Draft with AI", which names the
machinery instead of the job; it says "Draft a reply" now, and the
disclosure beneath it still tells the whole truth about what is sent and to
whom. Two menus that moved MORE for people who asked for reduced motion —
the same guard missing in the same way — move for nobody now.

## 2026-08-12 · T·141 · moves · the app arrives, and Notes finally moves

**Every menu, picker and popover in the app now enters the same way, Notes
has motion on its own verbs for the first time, and entering a product ends
on a settle instead of a cut.** Motion here is spent, not sprinkled: one
contract, one set of curves, and a written verdict for every place a
movement was added or deliberately withheld.

Nine anchored layers used to appear instantly, out of nowhere. They now grow
from the control that opened them, briefly, and leave faster than they
arrive. Dismiss one with Escape and it is simply gone, because a keyboard
command is an instruction, not a performance.

Notes was the one product that never moved. A saved note appeared, a decided
row vanished, and a promoted note grew its "In Tasks" chip, all between one
frame and the next. A saved note now arrives in its place, a decided row
leaves with the list closing behind it, and a promotion resolves where it
happened. Keep and Delete move identically: what happened is in the words
and the state, never in the animation.

Entering a product used to end on a hard cut, the wordmark choreography
playing and the finished board simply replacing it. The surface now settles
as it arrives, after the swap has already landed, so the change stays
immediate and the surface is usable from its first frame. Changing theme was
the opposite problem: the canvas flipped instantly while a handful of
elements lagged behind it. The document now crosses together, once, and then
the transition is taken away again.

The Timeline artifact plays its entrance once a session. Coming back to a
page you have already seen is not a reason to watch it assemble again.

None of this happens for anyone who asks their device for reduced motion.
That is not a downgrade path bolted on afterwards; it is the same state
arriving without travel.

Under it, about twenty-five hardcoded curves and durations became the
system's own tokens, so the next person to touch this cannot drift from it
by accident. One instrument changed too: the contrast gate was reading
colours while the page was still moving, so it now waits for the document to
settle before it measures.

## 2026-08-12 · T·140 · tightens · the project header says what it means

**The two rows above your board — the project name and the view tabs — went
through a three-round quality panel and came back a different instrument. The
count that says how far you are now marks the moment you finish something, and
when the last overdue task clears, the header says so.**

The title sits on the type ramp instead of a hand-set size, so it presides over
the row it names. Both rows end on one line; they used to miss by ten pixels on
every desktop. The tool called View is called Display, because four view tabs
share that row and one word cannot mean two things. The sort mode called
Schedule is called Due date, for the same reason. The overdue count looks like
the control it always was, and when the work it points at is filtered out of
sight it shows you that work instead of doing nothing.

Editing the project name behaves. Typing over the placeholder no longer leaves
grey ghost text sitting in front of your words, and a rename that fails to save
keeps what you typed and says so, rather than quietly reverting to the old name
seconds later. The filter and sort panels close when you click away, when you
press Escape, and when you tab out of them.

On a phone the whole band works: every control is a real touch target, the
project name keeps its letters, and the Planning badge spells out what it is
counting. In dark mode the three actions on the right finally read as one set.

The panel did not reach its 9.5 bar. What stands between the header and that
grade is written down, and most of it is naming, not craft.

## 2026-08-12 · T·139 · cuts · the app stops being a second marketing site

**Every marketing page this host served is gone. Pricing, about, press,
principles, templates, the five audience pages, the student page and the legal
pages all live on signalstudio.ie now, and an old link lands there in one hop.**

Nineteen route directories left, along with the components and the sixteen
template essays that only they used. What stays here is the product: the
workspace, sign-in and sign-up, welcome, the closed-beta waiting list, shared
and published pages, invites, redemptions, embeds, print, and the wedding page.
The app is the product now, not a second marketing site with the product
attached.

Every cut path redirects to its umbrella equivalent. The rules are host-scoped
to both app. and tasks., so links sent from the old Tasks host resolve too, and
each one is a single hop rather than a chain. Two old template slug renames
were deleted because they would have chained into the new wildcard. The sitemap
is gone, and robots now disallows everything except the wedding page and the
embed and published surfaces, because a host that serves no marketing pages
should not be walking a crawler through them.

Four repairs ride along. Welcome was listed as a public route while its first
act is to read the current user, which throws on a request with no session, so
every signed-out visit was a guaranteed 500. It needs a session, so it is a
protected route now and a signed-out visitor is sent to sign-in. That matters
more than it used to: welcome is the only surface sign-up hands off to once
the marketing pages are gone. The root layout declared a canonical URL of
app.signalstudio.ie for every page that inherited it, which told search
engines the wrong home for pages that belong to the umbrella; that line is
gone. Privacy, terms and
security on the sign-in stage and in the Clerk configuration are absolute
umbrella URLs rather than paths that redirect, because a consent link is the
one link that must show the reader exactly what they are agreeing to. The
status link left with the page it named. The sign-in QR aimed at a retired iOS
page, so both the link and the encoded matrix now carry the umbrella root.

Two gates were lying about the tree. The route manifest asserted twenty
directories the cut removed, and comments in the proxy sent readers to a route
allowlist document that was never written in this repo or any other. Both now
describe what actually exists.

One deviation from the plan, recorded rather than smoothed over. The plan
called for the public invite page to drop the marketing navigation and footer
for a minimal functional one. It kept both and had their dead links repointed
at the umbrella instead. No reader meets a broken destination there today, but
a page whose only job is to accept an invitation is still carrying marketing
chrome. The swap is outstanding.

## 2026-08-12 · T·138 · ships · dark mode, and the words your board already uses

**The signed-in app now follows your device's colour scheme, and dark is a
choice in Settings.** Pick System, Light, or Dark. The app resolves the theme
before anything paints, so there is no white flash on the way in, and every
surface reads correctly in both themes, down to the skip link a keyboard user
reaches first.

The board's first lane is called To do now, because that is what it holds.
Queued was a word from somewhere else. And in Notes, the tab that said Sent
says In Tasks: those notes went nowhere, they became tasks, and the tab now
says so.

## 2026-08-12 · T·137 · tightens · the three products now share one visual grammar

**A seven-seat design review graded every surface against the 9.5 studio bar,
and this wave closes its convergent findings across Tasks, Notes, and
Timeline.** The board commits to one spatial grammar: equal lanes, neutral
headers, one content grid line, and one task-title type role across all four
views. Native form controls leave the list and calendar; the board becomes one
Tab stop with arrow keys inside. Notes gains a real column grid, review
decisions on the rows that need them, and the design-system type ramp. Timeline
composes its hero countdown as one block, gives the axis a collision rule,
states who can see the page, and loads under its own name instead of the Tasks
wordmark. The product wordmark carries its dot again on every screen, and the
quiet metadata register moves from the accessibility floor to a real margin.

Honest edges: dark mode, the approved plain-language renames, and the motion
pass ship in the next two waves; the Notes reading pane still runs wide at
1920; the view switch still remounts the workspace shell.

## 2026-08-09 · T·136 · tightens · state, trust, and motion now tell the same truth

**Tasks now derives every review count and scheduling obligation from the same
fixture and selector, so the rail, board, Schedule, Calendar, and Planning can
no longer disagree about the work.** Completed checks animate only when a task
is actually completed, never because an old Done card mounted again. The
Mara & Finn display name is also consistent across Notes, Tasks, Timeline, and
the briefing.

AI drafting and conversation summaries now explain the exact task fields sent
to Anthropic before any request leaves the product. Notes fits every focusable
header action inside the true 320-pixel reflow boundary. Timeline sharing uses
plain plan language, one link action, explicit set-aside counts, and a Windows
forced-colours focus outline; its milestone acknowledgement now lands in one
immediate 220-millisecond beat.

## 2026-08-09 · T·135 · tightens · core actions now explain where the work moved

**Tasks now makes its mobile workflow explicit, reports task completion at the
point of action, and removes unsupported ARIA from the board and list.** Phone
boards gain 44-pixel lane controls with counts and focusable destinations;
native table relationships remain native; task detail announces the resulting
status immediately. The same pass gives Notes a 320-pixel capture layout and a
plain pre-send Anthropic disclosure for photo reading.

Timeline sharing now says exactly who can open or forward a published link and
separates choose, review, and publish. Repetitive copied milestones collapse
behind one review step, while replace, turn-off, and removal actions name their
consequences. Private previews remain private and published pages remain frozen
until the owner reviews another update.

## 2026-08-09 · T·134 · tightens · the release gate now describes the product that ships

**A historical backfill check can no longer report healthy new task data as a
production migration failure, and the quality council no longer asks for a
fourth product that the app retired.** Migration receipts still prove every
postcondition atomically when SQL runs. Continuous drift checks now rerun only
the proofs that remain true as customer data changes: schema shape, integrity,
foreign keys, indexes, and guard definitions. A regression fixture adds a
post-migration completed task without a historical backfill activity and proves
both status and the second migration run stay current.

The release contract now covers Notes, Tasks, and Timeline, then follows the
same object into the Full Briefing inside Home. Legacy `/app/signal*` routes
remain deterministic redirect fixtures, not product entries. The repo contract,
deployment runbook, environment descriptions, council schemas, preparation
matrix, and shared Wave 9.5 receipt schema all use the same model. Protected
product UI is unchanged in this control-plane wave.

## 2026-08-05 · T·133 · tightens · visiting Tasks no longer breaks Timeline

**Opening Tasks and then clicking Timeline showed "That workspace is not
available." — while the owner's own timeline sat one bare URL away.** The
product rail stamps a `?workspaceId=` routing hint on every Timeline link,
taken from the suite context Tasks publishes. Timeline authorised that hint
against two lookups and refused if either came back empty. One of them asks
for a Timeline row whose `suite_workspace_id` matches the Tasks workspace,
and only the provisioning path ever sets that column — the in-app create
flow leaves it null, and nothing backfilled it. Every timeline made that
way was reachable as "the owner's first workspace" and by nothing else, so
the hint that was meant to be a convenience was the thing that broke it.

**A missing link and a missing membership are no longer the same answer.**
Current Tasks membership stays the only authorisation boundary: without it
Timeline refuses exactly as before, and never substitutes another workspace,
because a URL naming one workspace must not quietly render a different one.
With membership proved, an unlinked timeline is treated as the linkage gap
it is — the owner's timeline is adopted, bound to the Tasks workspace, and
the repair is written to the row, so the dead end closes on the first visit
rather than being re-derived on every request.

**It declines to guess.** Adoption needs exactly one unlinked timeline. When
there are several, the owner's first is opened and nothing is written: a
wrong join between a timeline and a Tasks workspace is silent, durable and
far harder to notice than the missing link it would replace. That rule is a
pure function with its own tests, and two contract tests now fail if the two
outcomes are ever collapsed back together or if adoption is allowed to run
before membership is proved.
## 2026-08-05 · N·25 · ships · Notes learns to listen, look and decide

**Notes was one screen doing four jobs, and it now has three views that each
do one.** Capture, the notebook, the note being read, and the Sent-to-Tasks
history all shared a single page permanently, with the history holding the
entire right half at every width — including when it was empty, where "Sent
to Tasks" was the largest type on the screen. Notebook, Review and Sent are
now separate, route-backed, and carry truthful counts. The grey canvas and
the large rounded card floating on it are gone: Notes fills the white
workspace edge to edge, and structure comes from hairlines and space.

**A thought can now arrive by voice or by photograph, and it arrives as
notes.** Speaking a note records it, shows the words as they are heard, and
then hands back one or more concise notes to edit before anything is saved
— never a raw transcript. Photographing a notebook page, a whiteboard or
something printed does the same. Signal keeps no recording, because there is
none to keep: the browser turns speech into text, and the photograph is read
and discarded. Where the reader is not switched on for an account, the
product says so and keeps the words rather than inventing any.

**Review is the new middle of the product.** One note at a time, with three
ways out — keep it, turn it into a task, or let it go — plus a way to decide
later. Every gesture has a button a thumb can hit, and every decision can be
undone. Turning a note into a task is now the primary action rather than a
selection-and-approval ritual, and it opens the task it created.

**The words changed everywhere.** `PRIVATE NOTEBOOK`, `CAPTURE`, `FIND IN
NOTES`, `HISTORY`, `0 / 10,000`, `Press / to find`, `7 active`, `3d ago` and
the standing email-capture upsell inside the composer are all gone. The
privacy promise is stated once, accurately: private to you until you turn a
note into a task, with the detail — what leaves the device, what is stored,
what a photograph does — in an information surface rather than a paragraph
sitting in the capture field.

**Honest edges.** Review state needed a column that did not exist, so
`notes.reviewed_at` was added; the notes database needs
`drizzle-notes/0001_notes_reviewed_at.sql` applied before this ships. The
legacy notebook renderer was retired rather than carried: its stated
one-release rollback window had passed, and a rollback to it would have
restored the exact screen this replaces. That retirement is also what paid
for the new capture routes — the whole redesign lands 9.5 KB gzip under the
bundle ceiling it would otherwise have breached, and the ceiling has been
ratcheted down to match.

## 2026-08-05 · T·132 · ships · the board answers its own review

**Nine independent reviewers graded the shipped board against the standard
of a studio that had iterated on it for months. None of them passed it.**
The scores ran 7.2 to 8.4 against a 9.5 gate, and five seats independently
found the same failure: the board did not fit the screen most people use.
At 1440 the track needed 1,705px, so the fifth status was amputated and
its cards were severed mid-word with nothing on screen saying so. Statuses
now measure 224px and five of them land inside a 1440 canvas with room to
spare; below that the overflow is authored — a paper fade at the right
edge and scroll-snap that lands whole statuses instead of half a card.

**Finishing a task is now witnessed and reversible.** Completing work used
to teleport the card up to 992px into a status that was often off-screen,
after which the lanes resized underneath it for 220ms — the only movement
a person saw was the board, not their work. The card is now measured
before the state change and animated to where it lands, with the lane
widths frozen for the flight. When it arrives, a receipt says **Moved to
Done** and offers **Undo**, and the spoken announcement carries the same
fact with the new count rather than the single word "Completed".

**The card has one left edge.** The title used to sit 25px right of its
own metadata, so every card was an L-shaped block and the eye zigzagged
down a column ten times a screen. The checkbox moved out of the text
column and the title, chips and meta row now share one rule. The type
scale that carried them — 23 font weights and 12 sizes on a single screen,
with the task title set *lighter* than the status label framing it — is
one ramp: four weights, no half-steps, and the title at 15px/600 above a
status label at 12px/500. A tag is outlined now and a person is filled, so
"Mara Finn" can no longer be mistaken for an owner.

**Smaller truths.** Five empty statuses said "No tasks yet" five times;
they now say what an empty status of that kind actually means. The status
description no longer clips the one sentence that teaches a novice what
"Waiting" is. The season line — how far through the year this project is —
left the Planning drawer for the header, and stays on phones along with
the progress sentence that used to be dropped there. The overdue count is
a control that goes to the work it counts. One destination stopped
carrying two names, the object stopped being called both "status" and
"column", and the tab that leaves for the marketing site says so.

Gates: typecheck · eslint 0 errors · full `pnpm test` · ds:check ·
first-contact:language · production build · perf:budgets. "Milestone"
stays on the board — the brand book bans the word, the founder overruled
it, and that is recorded rather than quietly reconciled.

## 2026-08-05 · T·132 · ships · the board becomes a white field, and the frame gets out of the way

**The work now starts a third of the way up the screen instead of a quarter
of the way down, and nothing on the board is louder than a task.** The
full-column pastel washes are gone — the field is paper, and a column's
colour lives in its pip and its name. The old three-panel header dashboard
(progress readout, milestones module, money line) collapses to one 54px
context band: name, description, a progress bar with the plain-English
count, red only when something is genuinely overdue, and the project-level
acts — Share, Planning, print — at project level. Milestones and the money
coverage line move into the Planning drawer, which replaces the rotated
Planning rail entirely: closed means gone, and the trigger on the band
carries the unscheduled count. The rotated Add-column rail becomes a plain
end-cap tile after the last lane. The permanent keyboard-legend strip —
which printed a ⌘ glyph at Windows users — becomes a reference dialog on
"?" and a quiet toolbar button.

The cards stop lying. A finished task can no longer read "2 days overdue":
done work states "Was due 14 Jul" in neutral ink, and open milestones speak
plainly — "Milestone due tomorrow", "Milestone overdue by 3 days" — instead
of the ambiguous "Milestone · 3 days ago". Queued loses the red it had
carried since the lane was labelled "Blocked"; red is reserved for genuinely
late or blocked work, and the List view's group bands now read from the same
column config as the board, so one colour means one thing in every view.
Completion is a circle that fills green and draws its check in a single
140ms beat, honouring reduced motion.

The same cycle's second pass finished the argument. "Project" left the
shell navigation entirely — rail and mobile tabs both, with the contract
test pinning the four destinations — and the wordmark became one object,
`tasks.`, with the brand's indigo full stop. Scope stopped being implied:
the band reads `Wedding season / The Orchard, events`, the Planning drawer
names the project it plans with the period dates beside it, and the
sidebar's bare `10 Oct` became `Ends 10 Oct`. Done got one canonical
green — `#1b873f`, bright enough to read as finished, dark enough to hold
AA — shared by the column header, the dot, the completion circle and its
drawn check, while the dead forest-green palette from cycle 2 was deleted
outright. Column headers took a 4.5% wash of their own colour so the five
states scan as bands over pure-white bodies. And Planning became a
workflow: one selector decides what "needs a date" (finished work never
does), each row schedules from a menu — today, tomorrow, this week, next
week, a picker — selection gets a bulk bar, every act leaves a
seven-second undo, and milestones sit in their own tab instead of under
the list. The drawer docks beside the board on a wide canvas and floats
under the band as a shadowed inspector on a narrower one.

The finishing pass made the remaining claims true on screen. The last
duplicate brand mark is gone — the wordmark's indigo full stop IS the dot
now — and the header reads `Wedding season / The Orchard, events` with
`+ Add description` as a real action and progress as one sentence:
`20% complete · 2 of 10 done · 1 overdue`. Status tints are perceptually
tuned per hue (amber calmed, green and the neutral slates lifted) so five
bands read as one system. Cards collapsed to their content: the title
shares its line with the completion circle, priority is a word in the
meta row that finished work drops, and when every card would wear the
identical avatar the board hides the badge because it differentiates
nothing. Planning at a wide canvas is a true split view — 420px docked,
the board resizing beside it — and the Costs line left the drawer
entirely (per-task costing stays in the task panel). Add status is a
ghost end-cap on white, the Schedule tab wears a schedule icon, and a
new source contract pins all of it: one Done token, header-only colour,
money-free Planning, the retired dot.

The shell pass finished the architecture. The black rail is a product
switcher now — Notes, Tasks, Timeline, More — with Home rehoused as the
first destination of the local Tasks panel, which finally says what it
is: "Tasks", then Home, Inbox, My work, and a sentence-case Projects
section. Collapsing that panel returns every pixel to the board — the
rotated PROJECTS strip is gone — and a compact trigger on the context
band reopens it, as a docked panel where it fits and an accessible
drawer where it does not. The resident search field left the top bar:
search is a quiet trigger beside Add task that opens the palette, still
Ctrl K here and ⌘K on a Mac. The parent crumb survives every width,
progress reads once — "2 of 10 complete" — an empty status compresses to
176px so Done never leaves the screen, and the two drawers observe a
truce on phones. The suite-navigation contract now pins all of it.

Edges, honestly: the collapsed lane rail keeps its vertical name (44px
against 276px is the right trade, and it is real, labelled text); the
sidebar's drawer-mode strip keeps its vertical label for the same reason;
print and share surfaces still render the four canonical lanes only, which
predates this cycle; and the demo seed's finished tasks carry no
completion dates, so the `Completed 16 Jul` receipts show only on real
completions. Every behaviour behind the paint — column management, saved
views, filters, the keyboard model, optimistic sync — is untouched and
verified: the full test gate, ds-check, the first-contact language gate,
the production build and axe passes with the drawer closed and open are
green.

**The board also leaves the client lighter than it found it.** The four
passes added 2.7 KB of client JS, which put the bundle over its ratchet;
rather than raise a ceiling, the cycle deleted what nobody reads. The
frozen 48-task design-lab dataset moved out of `fixtures.ts` — the module
the running board imports for its people and label registries — into
`fixtures-dataset.ts`, which only tests import; the lab's own chrome (its
ribbon, dataset and state selectors, fake suite rail, account chip, its
private task inspector and command palette) was deleted along with the
route it belonged to. Total client JS now measures **932.5 KB gzip**,
2.7 KB below the pre-redesign baseline and 3.5 KB under the ceiling.
Three text pairs that a review pass measured below the 4.5:1 AA floor —
completed-card metadata at 4.37:1, the Add task shortcut hint at 4.40:1
and the breadcrumb separator at 1.48:1 — were repaired at the same time;
axe had marked all three "incomplete" rather than failing them, so
automation alone would never have surfaced them. One test that had never
been wired into `pnpm test` (`fixtures.test.ts`) is now in the gate.

## 2026-08-05 · T·131 · ships · the three pillars get their instruments

**Each priority in the north star now has something that can actually be run
against it, and the one that could not be run says so out loud.** T·126 wrote
the ordering down. This cycle went looking for what enforces it and found the
machinery sitting in the inverse order of the priorities: experience frozen,
design unexercised, utility with nothing at all.

Experience is unblocked. The delight catalog's grouping step is done — the 66
catalogued sites resolve to nine families, one open question, and three
entries decided restrained. Six already-shipped treatments serve as the
internal register, and where a family has one (SG1 for folds, SG3 for list
arrivals, SG4 for hover) the operator can adopt it instead of sourcing
anything. The reference-supplying job is now nine decisions rather than sixty,
implementation order is fixed, and the task has moved out of this file into
the operator ledger where /hq can see it. F10 — whether the product gets one
perpetual mark or none — is a question no reference component answers.

Utility gets the first-contact test, in two halves. The automated half,
`pnpm first-contact:language`, reads rendered copy for vocabulary that assumes
the discipline or the stack, and now runs on every change. It reads JSX text,
string props, template literals and strings inside expressions — the last two
mattered, because the shipped blocker badge says "Blocked by" through a
ternary that a simpler scan walks straight past. It understands refusal:
"Nothing here says sprint or stakeholder" is the brand voice working and is
not reported. Fourteen occurrences are baselined, ten of them correct — a
strikethrough list naming what the product refuses — and four recorded as
debt awaiting a ruling on the plainer word. Debt may only shrink, and the
baseline fails in both directions so it cannot drift back up — which it
proved within the day: the lab task-detail copy left with its component when
T·130 retired that exploration, and the gate failed on the disappearance
until the list was updated to match. The human half
is an eight-step walk with someone who has never used a tool like this: no
help, fail closed, forty-five minutes. It stands beside the 9.5 gate rather
than inside it, because the receipt schema pins dimensions at exactly 13 and
a fourteenth would invalidate every receipt ever written.

Design gets an honest measurement instead of an instrument. The 9.5 gate ran
end to end for the first time. Every deterministic layer is green — self-tests
that correctly reject 49/52 and tampered evidence, 35/35 critical fixtures, 80
registered experiences, no design-system drift. The council gate returns nine
failures, all the same one: no receipt has ever been authored, and
`experience/council-evidence/` does not exist. The arithmetic explains why —
30 states across four products, times four viewports, times 13 dimensions is
1,560 evidenced taste judgements for a single pass, and automation is rightly
barred from awarding any of them. So the gate never fails; it never runs. That
is recorded, not fixed: narrowing a quality gate is a judgement about
standards, and it belongs to the operator.

## 2026-08-04 · T·129 · ships · Home is the front door, and the signal lives there now

**Signal leaves the product line, not the product.** Signal Studio now
opens on Home: a calm page that answers one question — what matters
now? Today's Signal sits at the top, at most three things the system
can defend: the task that went past its date, the work due today, the
thread that has sat still too long. Each one says why it surfaced,
where it came from, and opens the real thing in one press. Below it, a
restrained look at what's coming up and what's waiting for review.
When nothing needs you, Home says so plainly, with the honest count of
what it read — a quiet day is a result, not an empty screen.

The full read is one press deeper. "Open full briefing" leads to the
same briefing that used to live behind the Signal tab — the ledger, the
evidence, the dismissals — now at home inside Home. Nothing was lost in
the move: the same engine reads your workspace, the same arithmetic
keeps the count honest, and every old Signal link, bookmark and email
lands exactly where it should.

The rail now reads Home · Notes · Tasks · Timeline · Project. Three
products, each with one job — capture the thinking, move the work, make
the plan visible — and a front door that tells you where to start.
Signal was never really a place to work; it was the system's voice.
Now it speaks first thing, where you arrive.

**A full pass over the four products, holding every surface to the same
standard: nothing on screen may claim what a click can't confirm.** The
review copy now tells one story on one clock — every date, greeting,
count and "overdue" mark across Notes, Tasks, Timeline and Signal is
derived from the same pinned morning, so the same person reads the same
week everywhere, including on a phone in another timezone. Signal's
briefing arithmetic is honest end to end: the headline count, the cards
below it, and the closing line all reconcile against the same list, and
every claim survives its own click-through.

The board took the founder's round. The sidebar says who you are once,
not three times. The toolbar row keeps only the four controls that do
something today — Filter, Sort, Save view, Share — and Save view now
answers with a confirmation and a way back to what you saved. Each
column's plus does the job its position implies: it adds a column, and
columns can be renamed and recolored in place. The planning rail was
redrawn from information-dense gray to a paper-and-hairline instrument
with one indigo mark for where you stand. And the stray white seam
through the black wordmark corner is gone.

The shared board is now a finished artifact rather than a stripped app
screen. It renders the owner's own columns — names, order, tint — with
no dead controls; an owner following their own link gets a quiet way
back to the workspace, a guest gets the workspace's name and a single
honest invitation. Overdue dates are marked in the recipient's reading
of the board, not the sender's software's.

Under the hood, the keyboard finally gets the whole product: opening a
task moves focus into the panel, Tab stays inside it while it's open,
and closing it puts you back on the card you left. The shared board's
columns scroll from the keyboard. Where a value is absent, the row says
so to a screen reader instead of showing an unlabeled dash. Every one
of these was measured in the running product before it was called done.

## 2026-08-05 · T·131 · sets · leading becomes a decision, and the panel joins the ramp

**The task detail panel now speaks the same type as the rest of Tasks,
and leading is designed rather than inherited.** These were the second
panel's last two craft findings, and the reviewer called the leading one
the weakest link left in the module. Both were measured before they were
touched, and measured again after.

Leading first, because it was the larger fault. The display end of the
ramp has had designed leading since the artifact register — 0.88 for
display, 0.7 for metrics, with a mobile correction. The reading end never
did. Across the Tasks module **431 rules set a font size and 42 set a
line height**, and those 42 used nine different values. Inside the detail
panel, **30 of its 32 rendered text nodes sat at a flat inherited 1.5**,
so an uppercase label that can never wrap breathed like a paragraph.
Four tokens replace it, each with a job — `flush` for a line whose box
already sets its height, `tight` for headings and eyebrows, `ui` for
field values and row titles, `read` for prose. They are written into
`docs/brand.md` beside the sizes and tracking, which had been documented
without them.

Then the ramp. The panel rendered **23 of its 32 text nodes off** the
11/12/13/13.5/14/15/20/24/40 ramp, with 10.5px the single most common
size in the product's most detailed surface, and text as small as 9px.
It now renders **30 of 32 on the ramp**; the two that remain are avatar
initials, which are sized to their circle and are a graphic mark rather
than ramp text. Seventy-one declarations moved. The panel title drops
22px → 20px so it speaks at the same level as the workspace title beside
it rather than shouting over it. Uppercase eyebrows leave `0.14em` and
Tailwind's `tracking-wider` for the contract's `0.12em`.

Worth recording: the panel's type lives in **two** folders, not one —
`detail-panel/` holds the shell and the editors, `task-detail/` holds the
composition shared with the full-page `/app/task/[id]` route. Fixing only
the first left the field labels still rendering at 10.5px, which is how
the second was found. The sweep also reached the tip card and the AI
draft chip, both composed into the panel from elsewhere.

Nothing behavioural moved: dialog role, `aria-modal`, the focus trap,
focus return and the resize splitter are untouched, and the surface
re-attested 144/144.

Gates: typecheck, lint 0 errors, 465/465 tests, ds-check clean,
experience:validate clean at 90 experiences, fixtures 39/39,
experience 144/144 attested, perf:budgets ok, zero overflow at 390px.

## 2026-08-05 · T·130 · trims · a concluded exploration stops shipping

**The client bundle is back under its ceiling, and it got there by
deleting a design lab that had already done its job.** The
`total_client_js` budget failed at 952.8 KB gzip against a 950 KB
ceiling. The ceiling is a ratchet — raising one is a founder decision,
not an edit — so this dispatch found the kilobytes instead.

Where they were. `/lab/task-detail` was the Phase 3 Hybrid C
exploration: three shells over one task-detail composition, its own
board replica, its own resizable panel, its own five-task fixture set.
It concluded. Its outcome shipped as `src/components/app/detail-panel`
— the same panel, the same resizable splitter, the same conversation,
subtask and resource sections, against real data. The lab kept
shipping to production anyway, noindexed and unreachable from any
link, at **19.1 KB gzip** across three chunks. Removing it takes the
budget to 933.7 KB, green with 16 KB of headroom.

What was deliberately left alone. `/lab/welcome-a`, `-b` and `-w` are
the three venue-branded welcome directions, registered last cycle and
still under evaluation. They cost about 4 KB together and they are a
live decision, not a concluded one.

Recorded for the next reader, because two hours went into learning it:
this budget counts every `.js` file in the build's chunk directory, not
what one visitor downloads. Three things follow. Deleting unreferenced
source wins nothing — 27 unreferenced modules and 99.7 KB of source
proved to be absent from the bundle already, because nothing imports
them. Lazy-loading wins nothing either: the chunk still lands on disk.
And `optimizePackageImports` made no difference at all — dropping
`motion` from it moved the number by 0 KB. The only lever that moves
this measure is shipping less reachable code.

Also recorded: `motion` is the single largest line item in the bundle
at roughly 185 KB gzip spread across 15 chunks, with visible
duplication — two chunks of exactly 44.8 KB, three more of exactly
11.0 KB. That is Turbopack's route-group chunking, not a fault in the
source; all 65 call sites import `motion/react` and none reaches for
`framer-motion` directly. It is the obvious next place to look if the
ceiling is ever a problem again.

## 2026-08-02 · T·128 · finishes · the phone list becomes a list

**The list at phone width is a list again, the planning rail stops
charging every view 48px to stay shut, and a sticky group band no
longer lets the rows print through it.** T·127 stopped the phone list
overflowing but left it half-built: the row was a grid, and a grid item
is blockified, so six cells stacked into six ragged lines with stray
separators hanging off them. This dispatch finishes that row and the
three faults found underneath it.

The row, plainly. It is a block box with inline-block cells now — not a
grid and not a flex line, both of which blockify what they contain. The
title takes its own line, the description clamps at two, and status,
owner, dates, priority and estimate run as one meta line beneath. The
column widths moved off inline `style` and onto custom properties,
because an inline width is unbeatable by any stylesheet and the phone
needs those widths back. And the table, its body and its rows leave
table layout together: a `display: block` row left inside a
table-row-group gets wrapped in an anonymous cell that shrink-wraps, so
the row measured 237px inside a 390px body and the title wrapped early
against nothing. Every element carries an explicit ARIA role now,
because changing a table's display drops its semantics — verified
identical on both widths: 17 rows, 6 row groups, 15 row headers, 51
cells.

Underneath it, three more. The collapsed planning rail was an in-flow
48px column on a 390px phone, so the list, the board, the schedule and
the calendar were each laid out in 342px and clipped for a control that
was shut; expanded it already overlaid, and collapsed it now floats as
a pill in the one corner that holds nothing, measured to clear the tab
bar and the review banner rather than land on them. The sticky group
band mixed 6% of `transparent` into the canvas, which does not tint a
colour — it takes 6% of its alpha away, and every row scrolling under a
0.94-opaque header printed through the group's name. And that band
sticks to the top of the scroller at phone width instead of 34px down,
where the column header it was clearing is hidden.

Recorded for the next reader: the dev server in a sandboxed container
serves an app that never hydrates, because Next blocks its own
cross-origin dev resources and the HMR socket dies with them. Motion
components sit at their initial `opacity: 0` and nothing responds to a
click. Screenshots taken against it are of an un-hydrated page. The
sanctioned harness builds and starts production for exactly this
reason; visual review has to do the same.

Gates: typecheck, lint (0 errors), 402/402 tests, ds-check clean,
experience 128/128, axe 0 violations across four views × two widths,
zero document overflow on all eight.

## 2026-08-02 · T·127 · finishes · the artifact for the days that matter, and the template that points at one

**The shared Timeline artifact repairs the three places it broke its own
promise, and the rail's marks become a system.** On the wedding day the
countdown now renders "Today" whole — every metric face declares a
width class and is sized to fit its column by construction, so no value
can clip at any width. The completed ink is drawn to the furthest
completed dot instead of the abstract count percentage; the fill and
the beads are one statement, on screen, on phones and in print. And a
pasted link finally unfurls as the product: a data-free Geist card
(wordmark, rail motif, one solid indigo mark) with viewer vocabulary —
"A shared wedding timeline.", never "couple" as an adjective — mirrored
into the Twitter tags that previously dropped the couple's names.

A couple's artifact now opens on the countdown; progress-% stays one
press away. The milestone marks read as four states with one grammar —
quiet hairline rings ahead, solid beads settled, one full solid indigo
mark for the next milestone at full strength (operator call: no hollow
ring; a single once-only ring of light on load), and the same solid
mark in ink when it runs late; the diagonal overdue tick is gone. The phone's vertical rail caps long empty calendar stretches
through the same honesty mapping Today already rode, the Today chip
negotiates for space like every label does, and hidden horizontal
overflow earns edge fades and snap. Print grows a second page instead
of losing six milestone titles: a ruled index of every milestone, and a
static "22% complete · 79 days left" line where the click instruction
used to print. Sharing prefers the platform share sheet, failure is
visible (not screen-reader-only), and the footer attribution finally
walks — "Made with Signal Timeline", the growth loop's missing link.

The rail earns its cartography. First-of-month ticks ride the same
distortion mapping as the milestones — the calendar and the dots can
never disagree — and sit under the line as quiet mono capitals, sized
to whisper. Long spans thin themselves to quarters, January carries
the year, and every label knows when to yield: near the Today chip, at
the rail's edges, and wherever a neighbour sits too close to read.
The phone's vertical rail keeps the tick rhythm and drops the text.
Around it the composition tightens — the journey breathes against the
frame's edge, planning decisions settle full-width on their own soft
rule, and the milestone detail closes with room to land.

Owner surfaces catch up on honesty: Revoke and Unpublish take two
presses with a named consequence, "Link live" only shows while a link
actually works, link expiry ends at the publication's own midnight
(never bare UTC), completed milestones lose their strikethrough,
switching projects keeps edit mode, and the anchor countdown reaches
tablets. The artifact's own contract test — previously wired to no
gate and failing — is repaired, extended to the new invariants, and
runs in `test:timeline-owner`. Names with extended-Latin glyphs stop
falling back mid-headline (`latin-ext` ships), the artifact display
register is ratified once as `--x-artifact-*` tokens, and the module
sheds its orphaned dashboard-era files.

The template points at the day. The wedding workspace now declares the
one date a couple always knows, and its eight planning milestones carry
offsets counted back from it: the venue booking most of a year out,
headcount and suppliers in the last six weeks, the walkthrough and the
run of show in the final week. Hand the seeding path that date and every
milestone lands on a real day, so a first artifact opens with a
countdown and real calendar spacing instead of flat ordinal order.
Stated plainly: nothing in this app asks the question yet. The
workspace-creation route that seeds a timeline has no entry point in
this repo, so what ships now is the template, the resolver and its
tests; the form that asks travels with that flow. `pnpm sync:templates`
also generates the Timeline slice it always claimed to, so seeds can no
longer drift from the canonical templates in silence.

Both metric faces now state both facts: the countdown carries "2 of 9
settled", so a couple who never presses the toggle still sees how far
the plan has come. The milestone detail's status echo takes the rail's
three diameters, not only its colours. Four modules left unused since
the port from the standalone repo are resolved rather than left in
limbo: the Timeline empty state now reads its copy from the module that
owns it, and three dead files are gone, including a shared-update page
model the artifact itself replaced. The full review that drove this
cycle: `docs/TIMELINE_DESIGN_REVIEW.md`.

## 2026-08-02 · T·127 · corrects · the second panel reads the repairs back

**A second eight-lens panel reviewed the repaired product and returned
51 verified findings — twenty of them caused by the repair cycle
itself.** That is the number worth publishing. The first panel found a
year-old surface wanting; this one found the fixes wanting, which is
what a review instrument is for.

Its hardest verdict lands on the grace pass: **superficial**, in the
typographic lens's word. Moving 335 declarations onto the ramp resolved
to 83% of them landing on the ramp's 11px *label* step, so the board
rendered four sizes across 85 text nodes and a calendar date sat at the
same size as the tasks inside it. A monotone is not a ramp. Content
steps back off the label floor here — calendar chips, agenda and
day-list titles, tray chips, the milestone name, and the date numeral
that has to outrank its own cell — and the tracking pass, which had
reached only the four eyebrows visible in the screenshots, now covers
all 43 uppercase rules at one value.

**Five blockers, four of them ours.** The grab-offset drag measured the
grabbed *element*, whose pill is as wide as its label rather than its
day, so a due marker landed up to five days off; the drag now moves the
schedule by the pointer's own travel, which is one-to-one by
construction and has no geometry to get wrong. The completion circle's
border was a hairline token at about 1.5:1, under what WCAG asks of a
control's edge — there is now a control-boundary token at 4.8:1 — and
its hover dimmed the tick on already-done work, previewing nothing;
reopening gets its own honest signal. The phone planning rail, which
this cycle made an overlay, was a modal with no dialog role, no scrim,
no Escape and no focus handling; it has all four. The calendar's
Previous/Next/Today were still inert because a snap-back guard meant to
follow a far-away selection fired on every navigation — navigation
moves the selection with the window now.

Beyond ours: the list at phone width was a 1321px table behind a 660px
sticky column, five of six columns physically unreachable, and below
768px stops being a table at all; a column config read had no demo
guard, so one of its three callers returned a server error from a link
the view bar offers in one click, fixed at the boundary rather than the
call site; a column move re-read the server unconditionally and reverted
custom-column drops that had already landed; and the P-code retirement
had stopped at the app edge, so print and the public share board still
showed P1 to guests. The calendar's completion control was a 26px
rounded square where every other surface uses the 16px circle.

Deliberately still open, with their gating reasons: touch drag (the
motion contract wants a real-device pass), roving tabindex, the detail
panel's own type ramp, and leading, which the panel correctly names as
the weakest link now that the sizes have tiers again.

Later the same day, the grace pass. Every font size in the four view
modules moves onto the brand ramp — 335 call sites, an 11px floor,
nothing beneath it — and uppercase eyebrows take their full 0.12em.
The room's Filter/Sort/Save panels, which had been running at 9px
inside an 829-line file that was mostly a dead 7–9px copy of a board
nobody mounted, are rebuilt as 67 lines on the ramp with the motion
contract's anchored-layer entrance. The tools bar gains its one accent
act: Add task alone wears indigo. On phones the brief keeps its name
and progress and hands milestones and money to bigger screens, and
the add-column rail yields to the lane menu.

## 2026-07-31 · T·126 · repairs · the panel review's blockers close

**Creating a task works from every entry point again, the detail panel
speaks the same column model as the board, and the board's columns say
their own names.** An adversarially-verified design review ran against
the live product this morning — eight lenses, 88 findings raised, 82
held. This dispatch ships its five blockers and the highest-severity
fixes behind them.

The blockers, plainly. Six create affordances — the calendar's "+" and
"Create on this date", both planning-rail adds, the palette entry, the
list's empty state — wrote a status key no workspace has ("queued", the
lab's retired vocabulary), and the task was silently orphaned; the
store now resolves any stale key to the top of the board, and the call
sites speak real column keys. The detail panel declared aria-modal
without ever taking focus — it now takes it, keeps Tab inside, and
still returns it exactly; its status control iterated the retired
four-lane constant and now renders the workspace's real columns,
custom ones included; its assign menu offers real members instead of
the design-lab cast. A reference to the undefined --spring-press
invalidated the entire transition stack on cards, schedule bars and
calendar chips; the sanctioned instant token replaces it. And the lane
header wraps to two rows, so a column's name is never again crushed to
a sliver by its own description.

Around them, the seams. One wording for finishing (Mark done), one for
creating (Add task), one name for /app/my-tasks (My work), one label —
Schedule — everywhere "Timeline" leaked beside the Timeline product.
One milestone colour on every surface (violet; no status token spends
it). Completed work reads as done on the calendar. The schedule's due
ticks follow the shared amber/red due grammar instead of painting
everything alarm-red. The brief's milestone date reads "1 Aug", not
US-style "08/01"; its stat lines stop wrapping mid-number; the demo
venue prices in euro. List row descriptions drop the browser's
bold-and-centred <th> defaults. Completion is a circle and selection
is a square, everywhere — the two used to be pixel-identical twins.
Priority loses the "P1 ·" prefix and the forked Medium/Normal scale.
Settings shows the board's real name. On phones: the tablet strip
stops leaking through the cascade, Schedule's first paint pans to
today, the calendar's Previous/Next/Today actually drive the day
list, the planning rail overlays instead of crushing the workspace to
110px, and the keyboard legend no longer lectures a touchscreen about
Alt keys. The per-completion glow burst retires; the first-ever
completion keeps the one expressive signature the motion contract
budgets.

Deliberately not in this dispatch: touch drag (the motion contract
gates it behind a real-device pass), roving tabindex, and the schedule
bar's grab-offset drag. The review dossier holds the rest, ranked,
with file-level evidence.

## 2026-08-01 · T·126 · holds · experience, then design, then utility

**The product north star is written down where every session reads it.**
The operator set the direction on 2026-08-01: three priorities govern
everything front-facing — experience (considered end to end, delightful
in the right moments), design (the standard of the best studios working
today, nothing default), utility (understandable unaided by someone who
has never used a project-management tool) — and when they pull against
each other, that order decides. The register's own hierarchy (A1.1:
creativity and emotion outrank restraint) stands beneath it untouched.

Nothing new was invented to enforce it. The three priorities bind to
machinery that already exists: the delight catalog gates the moments,
the 9.5 quality council gate proves the finish, and the first-contact
test names what intuitive means here. AGENTS.md carries the ambient
copy; the durable record — with its ~six-month review date, next
2027-02 — is `studio/content/hq/decisions/product-north-star.md`, so
HQ surfaces the re-derivation when it falls due.

Also repaired in passing: CLAUDE.md pointed design voice at
`studio/docs/BRAND.md`, which studio marked v1 history on 07-31; it
now points at the successor `studio/BRAND.md`.

## 2026-07-31 · T·125 · restores · the working tools return to every view

**Filter, sort and saved views are back on all four views — wider than
before: filter by priority, by column, by owner by name, or by date —
and the Share, export, print and calendar-subscribe cluster rides the
view bar again.** The July interior consolidation shipped the approved
composition but silently dropped the working layer around it: the tools
band, per-row completion on the schedule and list, the list's inline
priority and description line, the calendar's phone layout, and the
guided first-run states. The 2026-07-31 capability audit wrote down
every loss; this dispatch returns them all to the composition that
shipped.

The Filter panel admits four honest dimensions: priority, column (your
real columns, by name), owner (the project's real members, by name,
plus has-an-owner and unassigned), and date (overdue, due today, the
next seven days, or explicitly unscheduled). Filters and sort apply to
every view. The brief and planning rail deliberately keep whole-project
numbers, so receipts never quietly shrink to a filtered subset — and
when filters admit nothing, the view says so and offers the way back.
Saved views close their loop inside the panel: save, reopen, delete —
and a saved view now restores density along with everything else.

The list regains per-row completion, inline priority, the description
line under each title, and owners by name beside their initials. The
schedule regains per-row completion in both the planned rows and the
unscheduled tray. The calendar regains its phone layout — a fourteen-day
list starting today — and a visible Subscribe button that copies the
live calendar feed. An empty project greets you with the guided
first-run state on every view instead of bare chrome.

With the tools remounted, the last pre-consolidation view components —
the dead list, calendar and schedule implementations, the retired
export menu and the old room view bar — are deleted: 2,856
lines of unreachable code gone, and the four views' behavior now has
exactly one source.

Verified live against the seeded project: every filter dimension
narrowing the board and list, the sort and saved-view round trips,
completion toggling from list and schedule rows and reverting cleanly,
the subscribe toast, and the phone day-list at 375 px — plus the full
gate chain and the materiality suite.

## 2026-07-31 · T·124 · ships · money, narrowly

**Your project now has one currency, one budget, and one honest sentence
about both: "EUR 1,684 of EUR 50,000. 2 tasks costed, 24 without a
price."** Task amounts have existed for a while — editable on the panel,
exported to CSV — but nothing summed them, and every amount rendered as
dollars regardless of what the operator meant. A euro wedding read as a
dollar wedding.

Settings gains a Money card: choose the project's currency (a label from
a short list — nothing is ever converted) and set the budget you are
working to, or leave it blank for no budget line. The brief restates the
sum of what you entered, always leading with coverage, so a number never
pretends to be a total when a third of the board is uncosted. Existing
projects keep the USD label their amounts were entered under — relabelling
stored numbers would change your claim, and the boundary this ships under
forbids that: Tasks restates and sums what you entered; it never
computes, forecasts, converts or publishes a financial claim, and money
never appears on share links, print sheets, embeds or the public page.

Migration 0026 adds the two columns; both are empty until you choose,
and everything renders exactly as before until then.

Verified by the formatter and coverage suites, the full gate run, and a
live walk of the real flow: currency chosen in Settings, the brief
re-reading in euros, and the coverage sentence rendering to the letter.

## 2026-07-31 · T·123 · cuts · the contract slims to what the repo actually is

**AGENTS.md drops from a drifted mix of rule-text, dead paths, and a
retired ritual to a 75-line pointer that says what this repo is, names
its two hard constraints, and sends everything else to its real source.**
The GitHub repo renamed tasks→app today because the product suite's
operating contract moved up to the workspace file — this repo's copy no
longer needs to restate Signal HQ's sync rules, a `log-cycle`
post-mortem, or a personal-portfolio origin story. It needs to say what
this repo is (the unified app at `app.signalstudio.ie`, four modules,
GitHub name `app`), keep the Next.js caveat and the URL and database
release-gate contracts intact, and point at `studio/AGENTS.md` and the
workspace `AGENTS.md` for the rest.

CLAUDE.md is now a three-line pointer at `@AGENTS.md` and the real design
sources (`ds-foundation`, `studio/docs/BRAND.md`) instead of a dead
`~/Projects/personal` path. CODEX.md is deleted — Claude Code is the only
agent on this repo now.

Twenty dated one-off GTM artifacts — the eight `posts-week-N` drafts,
both launch-day runbooks, the Product Hunt and Show HN drafts, the press
list, the phase plan, the KPI log, the launch checklist, the GTM plan,
and the venue-outreach doc — moved into `docs/archive/`, next to the
review notes already there. `docs/data-model.md`'s "GTM roadmap state"
row pointed at `roadmap_items`, a table migration `0023` dropped months
ago; it now says so and points at the archived plan instead of a table
that no longer exists. The contracts, the decisions log, the URL and
naming rules, the collaboration loop, and the living founder backlog
stayed where they are — nothing that's still true moved.

Two closed-out worktree checkouts (`elegant-mcnulty-cfcf0d`,
`modest-blackwell-100af5`) were retired from `.claude/worktrees/` — both
PRs were already merged into `main`. `modest-blackwell-100af5` is fully
deleted; `elegant-mcnulty-cfcf0d` is unregistered from git and emptied,
but its top-level folder is held open by a process outside this
session's reach and still needs a manual delete.

No application code changed. `pnpm typecheck`, `pnpm lint`, `pnpm test`
(402 tests), and `pnpm db:contract` (19 tests) all pass unchanged.

## 2026-07-31 · T·122 · ships · done means one thing

**Rename Done to "Handed over", add a "Paid" column that also counts as
finished — and the board, the brief, the digest, the exports and Signal all
agree, because every one of them now asks the same question.** Done used to
be a bare text comparison scattered through roughly thirty modules, with the
progress percentage computed in exactly one of them. Once columns became
yours to shape, that arithmetic was one rename away from lying. Now the
column menu carries "Counts as done", the config records which columns mean
finished (always at least one), and a single predicate answers for every
surface: cards, subtasks, blockers, My week, the project brief, printed
lists, the share card image, nudges, project duplication, and both Signal
providers.

Completion also has a timestamp now. Every way a task can cross the line —
the checkbox, a drag into a done column, a keyboard move, a repeat
completing, even creating a task straight into Done — stamps
`completedAt`, and reopening clears it. Signal read completion time by
reconstructing it from the activity log and flagged what it could not
prove; it now reads the stamp first, and migration 0025 backfilled the
column from the log wherever the log could prove a moment, leaving the
rest honestly empty rather than invented.

Two quiet repairs shipped inside this: marking a claimed task done (or
moving it between lanes) now clears its custom-column claim, so the card
lands where the action said it would; and the cross-project "Your work"
rollup still counts only the canonical Done lane — a custom done column
is not reflected there yet, recorded as the one known edge.

Verified by the predicate suite, a seeded-database migration test
covering stale-event and claimed-task shapes, the full gate run, and
production counts measured read-only before execution.

## 2026-07-31 · T·121 · ships · the columns are yours

**Your board's columns are now yours to shape — add one, rename it, describe
it, colour it, give it a soft limit, move it, or delete it with its tasks
moved where you choose — and every copy of your board says the same thing.**
Since the T·99 port the live board drew five fixed columns from a constant
while a complete column system sat unreachable in a component nothing
imported. That system is back, rebuilt into the board people actually use.

The header "+" now adds a column after the one you pressed it on, and a
pinned control past the last column appends one, so adding a column no
longer requires knowing it was impossible. The collapse caret and the
column menu are always visible rather than appearing on hover, which
touch screens do not have. Soft limits show amber at and over the line and
never block a drop. Column colour previews at the tint the lane actually
paints — a whisper, not a swatch of paint — and column hues no longer
share variables with teammate avatar colours, so a colour means one thing.

The same column set now reaches every copy of the board: the share link,
the print sheet, the public embed, and the CSV and Markdown exports group
and label by your columns, where they previously spoke a four-lane
vocabulary the app itself had stopped using — a guest could read "Blocked"
on a column the operator saw as "Queued". The Waiting column's raw-text
persistence is retired by data migration 0024: rows move to a proper
column claim with a canonical lane, affected projects are seeded a config
naming Waiting, and the board renders identically before and after.

Also in this release: deleting a task asks first, everywhere; the
design-lab "in session" menu labels are gone; the list's subtask expander
shows an honest completion ratio instead of blank rows; the Nudge dialog
rides the card menu with sending still disabled until its backend exists;
and the retired "Open the workspace" phrasing becomes "Open the project"
on the last pages that carried it.

Verified by the full gate run, the migration ledger suite applying 0023
to a fresh database with all six receipt proofs passing, and production
row counts measured read-only before execution. Honest edges: reordering
tasks by position inside a custom column appends rather than honouring
the drop position (system lanes honour it), and rows that already carried
a fixture assignee id keep it until a separate cleanup sized by the same
measurement.

## 2026-07-31 · T·120 · cuts · one name per database, and the scaffolding nobody used is gone

**Every database the app touches now has exactly one name, in code, in
Vercel, and in CI.** Four generations of environment-variable conventions
had accumulated — the same physical database answered to
`SIGNAL_ANALYTICS_DATABASE_URL` in this repo, `ANALYTICS_TURSO_URL` in
studio, and `TURSO_DATABASE_URL` in its legacy repo — and the
worst-named pair pointed at different databases than their names
suggested. The reset collapses all of it to `<MODULE>_DATABASE_URL` +
`<MODULE>_AUTH_TOKEN` for tasks, notes, timeline, signal, and
entitlements, retires the separate signal-prefs database by folding
`user_preferences` into the Signal database, and drops the retired
aliases (`STRIPE_PRICE_PRO_MONTHLY`, `NEXT_PUBLIC_TIMELINE_URL`, the
`TURSO_*` fallbacks in the migration runner).

The launch scaffolding that never launched is gone with it: the
`/roadmap` GTM page, its sync/seed/parser machinery, the log-cycle
leftovers, and the three tables behind them — verified empty in
production and in both local databases before migration 0023 dropped
them. The Notes, Timeline, and Signal modules also gain tracked
baseline migrations generated from their live schemas, which closes a
real gap: two production tables (`note_task_send_outbox`,
`audience_view_receipts`) existed in no migration file anywhere until
today.

Verified by the full db:contract gate (19 checks, including the
amended durable baseline proof), typecheck, lint, and the test suite.
Honest edge: this entry ships with the coordinated cutover — new
databases created from the fresh baselines, environment variables
replaced in Vercel and GitHub Actions, and a new execution receipt for
the new database identity — so it lands together with that deploy, not
before it.

## 2026-07-31 · T·119 · tightens · the assign menu offers your project's people, not the design lab's

**Assigning work now offers the people who are actually in your project, and
their avatars render on every view.** Since the T·99 port, the mounted views
resolved people from a design-lab registry that production never filled. The
fallback was the lab's fixture roster: the assign menu listed eight invented
teammates, choosing one stored a fixture id on the task, and a real member's
id never resolved — so real assignees rendered as nothing on cards, list rows,
schedule rows, and calendar chips.

Members now resolve server-side from the project's membership (owner first,
then A–Z, with each member's own colour and initials) and hydrate the views on
first paint. The fixture roster is confined to the design lab: once the live
mount sets the registry, it is authoritative, and an empty roster reads as
empty rather than borrowing fake people. Unknown live tags now render as
neutral chips under their own names for the same reason.

Verified by a registry regression test (fixtures never leak past a set
registry) and the full gate run. Honest edges: a task that already carries a
fixture id from the affected window keeps it until the Phase 2 data pass
measures and clears those rows, and a task assigned to someone who has since
left the project shows no avatar rather than a guess.

## 2026-07-30 · T·118 · tightens · the switcher check waits for the page to exist before reading it

**T·117 fixed a real staleness gap in the project switcher but did not end the
intermittent failure, and the trace it enabled showed why.** At the moment of
failure the navigation had already committed, the document title read the new
project, and the page body was still empty. The switcher was not showing the
wrong project. It was not mounted yet.

That is a cold render of a route the run has not visited before, and on a
slower machine it can outlast the default eight second budget. The check now
waits for the page itself to be present before asking what the switcher says,
with a budget suited to a first render. T·117 also tightened that assertion
from fifteen seconds to the default while restoring exact matching, which made
the failure more likely rather than less; that is corrected here.

The evidence came from the trace upload T·117 added. Three sessions had
debugged this from a single line of error text because the artifacts were
written and then discarded. The first failure after they were retained was
diagnosed in one read.

Verified locally at two runs per screen size, sixteen of sixteen green, and the
experience registry validates clean.

## 2026-07-30 · T·117 · tightens · the project switcher stops disagreeing with the page it is on

**The Timeline switcher took its label from the server while the address bar
changed instantly, so for a moment the URL said one project and the switcher
said another.** It now reads the project from the route, which makes it correct
the moment a switch commits.

This surfaced as a test that failed on a different screen size every run and
cost several full CI reruns. Two earlier attempts adjusted the assertion, which
was the wrong instinct: the assertion was fine and the product had a real gap.
`router.push` updates the URL before the new server payload arrives, and the
switcher rendered from a prop that arrived with that payload, so it kept
displaying the previous project until the round trip finished. Resolving the
label from the route param closes the window. The switcher is now the fastest
part of the switch rather than the slowest, and the check that used to need
fifteen seconds finishes in under two.

The test keeps its keyboard path and drops the assumption underneath it. It
pressed an arrow key and trusted that the wanted project sat exactly one place
below the focused one; it now asserts where the key landed before committing,
so a reordered menu fails naming the ordering rather than as a wrong
destination. An attempt to move focus directly was tried and reverted: the menu
owns focus through its own effect, so a direct focus call is overridden and the
selection silently goes to the wrong project. That failure is why this was run
locally rather than reasoned about.

One supporting change. The switcher suite's Playwright traces were being
written on every failure and never uploaded, so each CI failure produced one
line of output and nothing to read; they are now retained as evidence. That
gap is why this took three attempts to diagnose.

Retries on CI were tried and deliberately left out. The shared Playwright
config is hashed into every materiality receipt, so adding a single line to it
invalidated fifteen of them and would have required a full re-attestation run.
That is a fair price for a change that improves the product and a poor one for
a convenience setting, particularly now the race is fixed at its source.

Verified by running the suite locally four times per screen size, thirty-two of
thirty-two green, having first reproduced the failure deterministically on all
four. Typecheck clean, the full test suite green, lint with no errors, and the
production build passing.

## 2026-07-30 · T·116 · ships · a shared board stops hiding the work parked in Waiting

**Anything sitting in the Waiting column was invisible on every share link,
every printed board and every public embed, and nothing said so.** A client
opening a board you sent them saw four columns and no indication that a fifth
existed. All three surfaces now render every column the board actually holds.

The cause is a seam. The board runs a five-status model against a schema with
four canonical lanes, so the fifth status is written as raw text into the lane
column. The share, print and embed views each iterated the canonical four and
grouped on an exact match, so a task in the fifth simply matched nothing and
fell out. It did not error and it did not warn. On a guest-facing surface that
is data loss, and it was the kind you only find by counting.

Lane resolution for those three surfaces now lives in one place. Canonical
lanes keep their order and their colour. Any other lane the data contains is
appended in a stable order and rendered neutral, which is the same no-tint
treatment custom columns already get inside the app, so an unrecognised column
reads as a real column rather than borrowing a meaning it has not earned. Its
name is derived from the stored value, so Waiting reads "Waiting".

Eight tests pin the behaviour, including the one that matters: a task in a
non-canonical lane must appear. This is the guest-facing half of the column
work. The board's own column system is still the design-lab prototype and is
addressed separately.

Verified: typecheck clean, the full test suite green, lint with no errors, and
the production build passing. No schema change and no migration; this is a
render fix over data that was already stored.

## 2026-07-30 · T·115 · cuts · the sidebar stops saying the same thing twice

**The left column said "Signal Studio", then "Tasks", directly under a bar that
already said Tasks, and then offered two rows that answered the same question.**
It now opens on Inbox, My work and your projects. Nothing was added.

"Assigned to me" and "My work" pointed at two routes that return the same list
for anyone working alone or in a pair, which is most of this product's use. One
row goes; the route stays live as a URL. Saved views leaves the column too, on
the grounds that a saved view is made in the view bar and belongs per project,
so having the create control in one place and the read control in another was
the actual problem. Archived was sitting at the same level as live work while
already appearing at the foot of the projects tree, so the promoted copy goes.
The uppercase "PROJECTS" heading stays in the document outline for screen
readers and leaves the visual field, which was carrying three typographic
assertions in a 200px column before a single project name.

The view bar loses its dead control. Fields configures list columns, and on
every other view it rendered greyed out, so the board, which is the view you
land on, shipped a disabled button in prime space. It now renders only on the
list, where it does something.

One test repair rides along. The Timeline project switcher smoke has been
failing intermittently on main, on a different viewport each run, which is the
signature of a race rather than a regression. Its final assertion matched the
switcher by exact accessible name, so it asserted the punctuation of the whole
label alongside the project and reported any difference as "element not found".
It now matches by project name, the same way the rest of the file does, which
proves the same thing without the brittleness.

Verified: typecheck clean, the full test suite green, lint with no errors, and
the production build passing. No board, column, task, or data behaviour changed
in this release, and no migration was needed.

## 2026-07-30 · T·114 · ships · the project name you type is the one everyone reads

**The title and description above your board were being saved to your own
browser, so nobody else ever saw them, and the product called the same thing a
Workspace in one place and a Project in another.** Both are fixed. The
supporting line now lives on the project record, the title commits through the
rename the server already had, and the word "Workspace" is gone from every
surface a person reads.

The description was the worse of the two. It was written to localStorage under
a key built from the project's *display name*, which meant three things at
once: a collaborator opening the same board saw a sentence the owner had never
written, two projects that happened to display the same name shared one
description, and renaming a project orphaned the text with no way back.
Migration `0022_workspaces_description` adds a nullable column to hold it. The
old values cannot be recovered from the server because they only ever existed
in each browser, so the first load of this release promotes whatever that
browser still holds, once, and only into a field the server has no value for.
The server always wins. The old default sentence is never promoted, because a
line every project shipped with was never the owner's own.

The title had a quieter version of the same fault. `renameBoardAction` and the
per-project name record already existed and were already correct; the brief
simply shadowed them with the local copy. It now renders and commits the
stored value, so the name on the board, on a share link, in the print view and
in the daily digest are the same name.

On the naming: D-011 ratified "Projects = Tasks workspaces" on 2026-07-21 and
it had not landed. The crumb above the title read "Workspace ›", a hardcoded
literal that was neither a link nor a real hierarchy. It is gone, and nothing
replaces it. The leak came from one line in the vocabulary map, where the
generic context still answered "Workspace" while every other context was
already right. A contract test now fails the build if any component writes the
noun into JSX text, `aria-label`, `title`, `placeholder` or `alt`, with the
vocabulary map as the only allowed source. That test immediately found fifteen
more instances a manual search had missed, in Notes, Timeline, Signal, the
share email and the onboarding picker, all now corrected. The share email's
"Open the workspace" was BRAND.md §6.5's ratified call to action and now reads
"Open the project"; §6.5 needs the same amendment.

Editing is signalled by the caret and a hairline under the baseline rather
than the full inset box the heading used to grow on hover, which read as a
text input in costume. An empty description clears the record and shows its
placeholder instead of storing the placeholder as though someone had typed it.
The dead `room-brief.tsx`, which held the correct crumb-free header from T·94
and was never rendered, is deleted.

Verified: the migration contract at 19 of 19 with the new migration executed
and its three proofs checked against a fresh database, typecheck clean, the
full test suite green, lint clean, and the production build passing. No board,
column, task, or data behaviour changed in this release.

## 2026-07-30 · T·113 · tightens · the frame puts the command where the work begins

**The black Signal Studio frame now reads as one deliberate command surface
instead of a header and rail competing for attention.** Search moves to the
left edge of the working canvas, New task closes the bar as the single light
action, and the current product is held by one quiet indigo plate rather than
an icon nested inside another tile. The product order, charcoal chassis,
workspace geometry, and keyboard behavior stay fixed.

The lower rail now keeps Updates, Help and account at rest. Help retains the
existing workspace, team, account-settings and support paths, so reducing the
visible controls does not remove a destination. No board, list, schedule,
calendar, sidebar, data, or task behavior changed in this release.

## 2026-07-30 · T·112 · tightens · tap targets stop inheriting the 80px spacing step

**Every control that asked for the 44px touch minimum was rendering at 80px, and
on a phone the Studio Bar wordmark was an 80px box inside a 56px bar.** The suite
design tokens remap Tailwind's numeric spacing namespace: `src/ds/tokens.css`
sets `--space-11: 80px` and `src/ds/tailwind.css` maps `--spacing-11` onto it, so
`min-h-11` resolves to 80px rather than the 44px the idiom means in stock
Tailwind. Forty-six index-11 sizing utilities across twelve files now carry
explicit `[44px]` values, variant prefixes intact.

Measured on the review server with Playwright at 390x844 and 1280x800: of 124
control instances carrying an index-11 sizing utility, 72 sat at
`min-height: 80px`. Afterwards, none exceed 44px. The suite menu rows went from
194x80 to 194x44, the Studio Bar create button and account avatar from 80x80 to
44x44, and the Timeline owner mode nav from 80px segments to 44px ones beside the
44px primary button they already sat next to.

The trap was armed in the governance layer too, which is why it survived so long.
`scripts/check-chrome-contract.mjs` asserts the Studio Bar contains `h-10` with
the message "slim 40px bar" while that token computes to 64px, and the bar
measures 1280x64. Two accessibility contract tests asserted `min-h-11` and
`pointer-coarse:h-11` under messages promising 44px. Those assertions now name
the literal 44px, so a token whose value drifts can no longer pass a green gate.
`scripts/check-tap-target-scale.mjs` joins `pnpm test` and fails the build on any
new index-11 sizing utility, carrying a shrink-only ledger for the one Signal
file left out of this pass.

Two things are deliberately unfixed. The Studio Bar shell keeps `md:h-10`,
because dropping the shell to a literal 40px while its own contents are still
inflated by the same remap leaves those controls flush against the bar edges;
shell and contents have to move together. And the wider divergence stands:
indices 7 through 12 are remapped while 13 and up fall through to stock Tailwind,
so `p-10` and `p-16` both mean 64px and `min-h-11` is larger than `min-h-16`.
Un-remapping resizes roughly 501 uses across 108 files here, and Notes, Timeline
and Signal vendor the same tokens. `docs/SPACING_SCALE_COLLISION.md` carries the
compiled evidence and the proposed fix in the design system repo.

One site is deferred rather than fixed. `/invite/[token]` is a critical-tier
reviewed surface, and `experience/registry.json` pins a materiality hash for it,
so changing the source requires an evidence-backed refresh signed by the design
owner. That is not a review to self-attest, so its disabled demo-mode Accept
invite button stays at 80px and is recorded in the gate's outstanding ledger for
a pass that carries the review. The ledger only shrinks, and it fails the build
if a listed file gets worse or becomes clean without the entry being removed.

T·110 reached the same diagnosis independently, on the same day, and landed the
mobile chrome half of it first. This entry keeps its bar-avatar treatment, which
is better than the one written here: 32px of visible avatar with a transparent
ring carrying the pointer target out to 44px, rather than a 44px circle that sits
heavy in a 56px bar. What T·110 scoped to phone widths is now carried across the
coarse-pointer variants too, since 44px is the floor wherever the pointer is
coarse, not only below the medium breakpoint.
## 2026-07-30 · T·111 · ships · the briefing shows its working, and a task keeps its own words

**Signal now says how much it read, how much crossed a rule, and how much it
cleared, and the arithmetic closes in front of the reader.** The read used to
publish a numerator and ask to be trusted for the rest: three findings, no
denominator. Every row now carries the pile it came from, drawn beside the
headline in three weights, lit for what is on screen in that row's own tone,
mid for work that crossed a rule but lost its slot, ghost for what cleared.
Held-back work is never counted as clear, synthetic cluster rows are never
counted as source items, and the contract enforces those invariants itself
rather than trusting its callers. The close ends on a sentence and a green
mark for the rest.

Rows are grammatical again. A task title is the reader's own words, so it is
now a headline and never a clause: "Approve the final seating plan" over "Two
days past its date", where the page used to compose "Approve the final seating
plan is 2 days overdue" out of an imperative. The same rule reaches upstream
blockers, which are stripped of borrowed punctuation and counted rather than
named when a question or a shout cannot sit inside a sentence. Every "Why
this" names the rule that fired and then adds a fact the row had no room for,
instead of restating it. Sections are Now and Next, each row sits on the
hero's three columns with its action at the right edge, and the tone is
present at rest rather than only under a pointer.

Underneath, the read runs on the suite's pinned review clock instead of a
day of its own, the honest loading skeleton is finally mounted and traces the
settled page band for band, and every control is a real 44px rather than the
80px `min-h-11` silently resolves to on this scale. Honest edge: the ordinal
rail carries a number, not the hero's NOW/NEXT claim word, because the section
headings already say it once; and the unmounted analytics shell is untouched,
still awaiting its wire-or-retire decision.
## 2026-07-30 · T·110 · tightens · the app chrome holds its own bounds on a phone

**On a phone, the Studio Bar now keeps its controls inside the bar, and the in
development notice sits above the product rail instead of across it.** The
account avatar, the create button, and the product wordmark were each drawing at
80px inside a 56px bar. The avatar read as a large black circle clipped by the
right edge; the other two spilled invisible tap targets over the canvas below.
The notice pill covered the Notes, Tasks, Timeline, and Signal tabs.

One cause sat under all of it. The suite spacing scale is semantic, not derived
from pixels: step 11 is 80px, not 44px. Chrome written as "the 44px touch step"
therefore came out nearly twice its intended size. Sizes that have to land on
real pixels are now written in pixels, with the reason recorded beside them.

The notice measures the rail it has to clear rather than guessing at it, so it
holds its place across both mobile rails and inside the phone's safe area.
Desktop and tablet are untouched, byte for byte.

## 2026-07-29 · T·109 · tightens · every task movement explains what changed

**Tasks now keeps the work visibly continuous when it opens, moves, settles,
saves, completes, or fails.** Board, List, Schedule, Calendar, the planning
rail, project navigation, task detail, creation, menus, comments, resources,
and feedback now share one restrained interaction grammar. The source task
stays marked while its inspector is open, focus returns to that exact source
when the inspector closes, placement resolves in the final slot, and pending
feedback waits long enough to avoid flashing during fast saves.

The 106-moment interaction ledger is enforced as a decision system rather than
an invitation to animate every control. Keyboard movement, route changes,
writing, density changes, and repeated data entry remain immediate. Reduced
motion removes spatial travel while preserving state, errors restore the exact
optimistic slot they displaced, and the only expressive treatment is a local,
once-only first completion receipt.

Two product models remain deliberately separate from this motion release:
production tag editing and the Schedule first-open/range orientation contract.
Both are recorded as a founder follow-up that Codex or Claude can complete in a
later cycle. Direct manipulation is implemented, but production approval still
requires a physical touch-device drag and resize pass.

## 2026-07-29 · T·108 · ships · the note stays in sight while the work moves

**Notes now keeps a private thought visibly continuous as it becomes a saved
artifact, an approved extract, or confirmed work in Tasks.** The notebook opens
on a calm artifact history, moves into reading only when a note is chosen, and
uses one restrained interaction grammar across mobile detail, source approval,
Tasks handoff, recovery decisions, row presence, and global feedback. The note
itself remains private throughout; only exact wording selected and approved by
the owner can cross into Tasks.

The exhaustive interaction ledger is enforced as a product contract rather
than an instruction to animate everything. Twenty-one states deliberately hold
still, eleven high-frequency writing, search, selection, and focus paths remain
immediate, and the remaining continuity treatments stay between 140 and 240 ms.
Lost Tasks replies retry against the original immutable destination without
replaying a completed handoff, clipboard feedback uses the shared Notes toast,
hover motion is limited to fine pointers, and reduced motion removes transform
travel while preserving every state change.

The release is covered across populated, empty, first-capture, partial failure,
conflict, offline, read-only, long-content, desktop, mobile, and reduced-motion
fixtures. Honest edge: the separate motion review lab remains an internal local
artifact and is not part of the production route.

## 2026-07-29 · T·107 · ships · the timeline stops lying about today, and the owner gets their own view

**The Today dash now rides the same geometry as the milestones around it, and
every Timeline surface speaks the design system at a readable floor.** The
dash used to sit on a raw calendar axis while clustered milestones were
spread apart for legibility, which could place today to the right of points
weeks in the future; it now maps through the identical distortion, so
"between those two milestones" is always true. Review mode runs on one clock
for the whole suite, guarded by a test, and the public share page renders
complete before any JavaScript arrives: the load choreography moved from
script-driven hidden states to CSS, which also makes reduced motion absolute
from the first paint.

The owner's side comes up to the standard the shared page set. The curation
surface leaves two thousand lines of inline styles for the design system
proper: lane headers carry the board's tone grammar with a 2px rule and a
full-strength pip while Later stays deliberately plain, every control is a
32px target, nothing renders under 11px, and the state control opens into
wrappable pills on a phone instead of squeezing five labels into a matchbox.
Error copy is finally visible; it had been pointing at a colour token that
never existed and rendered as ordinary ink. The owner's view drops the
duplicate wordmark behind a quiet "Owner view" strip, the anchor countdown
takes its place in the plan header, and the sharing screen trades ten
stacked forms for one ruled list with human labels and real dates. Wide
rails now title every milestone that fits, with edge-aware collision math
deciding which labels earn their place at rest.

Structural motion ships in the ratified class only: the switcher menu and
share receipt enter, the add form rises, a reordered row settles instead of
teleporting, and hidden milestones fold. Honest edge: the discretionary
micro-interaction sites stay still, fourteen of them newly catalogued in
docs/DELIGHT_CATALOG.md for the reference review, the sharing screen still
posts one form per milestone row, and the fold animation is progressive
enhancement that older engines render as an instant toggle.

## 2026-07-29 · T·106 · ships · the board earns its colour, and a task gets a number a person can say

**The board reads by hue, the panel reads as one system, and a task is now
T-14 instead of a hex string.** Each lane carries its colour the way the
marketing hero always promised: a 2px rule across the header, a wash that
releases by 220px, and a full-strength pip, with the backlog staying
deliberately plain. The same grammar follows the lanes into the List view's
group bands, which also stop painting only a third of their row (a table cell
had been quietly voiding its own colSpan). Lanes sit on paper instead of grey,
scroll independently, collapse to a slim rail that keeps its colour and count,
and animate the fold. Adding a task is now typing a title where the card will
land, not renaming an "Untitled task" under a panel that stole the screen.

The type across the app comes up to a 10px floor: sidebar, product rail,
toolbar, and all four views were running 6 to 9px labels that read as a scale
model of the product. Cards tell the truth about time ("Due today" warm,
"Due 2 days ago" red) and agree with the panel, which previously read its
clock from a different place than the board. The card checkbox now completes
the task, because that is what a checkbox on a task card has always claimed
to do; selection moved to modifier-click and Space. The detail panel opens
with a real entrance, carries one chip grammar for every field, keeps status
with the other properties, and shows optional fields only once they hold
something. Milestones toggle from the card itself with a small diamond.

Underneath, every task gains a human number: a per-workspace counter
allocated atomically at insert (migration 0021, receipt-backed, with a
partial unique index as the concurrency backstop), displayed as T-14 in the
panel while the hex id stays the stable key in every link. Honest edge: the
micro-interaction pass is deliberately not here. Forty sites are catalogued
in docs/DELIGHT_CATALOG.md and stay unanimated until the reference review
decides which of them earn motion and which earn restraint.

## 2026-07-27 · T·105 · ships · the palette learns to narrow, and the record stops drifting

**Search now takes a scope before it takes a query, subtasks reorder by hand or
by keyboard, and a mention finds the person where the caret already is.** ⌘K
accepts `@assignee`, `#tag`, and `status:` chips built from the workspace you
are actually in, so a long board narrows before the typing starts. On mobile the
Studio Bar's search icon opens into a real field instead of a dead end.
Subtasks reorder with a pointer or with the keyboard alone, narrated for anyone
listening rather than looking, and the order persists through the position
contract the board already used. The conversation composer anchors its mention
list to the caret, and the name it inserts feeds the mention notifications that
already existed.

This work was cut on 24 July and stranded when the route consolidation landed
the next day. Bringing it forward kept the canonical `/app` routing and the
focus and modal-isolation behaviour that arrived in between, and the search
field now keeps its list in the accessibility tree even when the list is empty,
so the control it points at is never a dangling reference.

The evidence around it needed repair before any of this could be trusted. Two
critical fixtures had drifted from the surfaces they audit and were already
failing before this cycle, and fourteen of fifteen stored evidence records
described a suite that no longer runs. Both are corrected: 128 of 128 browser
checks pass across mobile, tablet, desktop, and wide, up from 120. The T·98
dispatch had also lost its heading and had been reading as loose prose since
July. Honest edge: the retry-failed-upload slice from the same 24 July run is
not here. It patched an attachments view that has since been replaced by the
Resources section on a storage seam with quota enforcement, where a quota
failure must not retry like a dropped connection.

## 2026-07-26 · T·104 · tightens · Timeline opens on the timeline

**Opening Timeline now opens the current project artifact, not a dashboard of
cards that asks the owner to choose the work twice.** The signed Mara and Finn
artifact remains the visual source of truth inside the consolidated app. A
project switcher moves directly among every authorised project; View shows the
real responsive and interactive timeline, Edit exposes the existing milestone
curation controls, and Preview and share opens the frozen publication flow.

The owner preview is built through the same strict public DTO boundary as the
bearer link. Hidden milestones, source ids, workspace ids, descriptions,
comments, and private task metadata cannot cross into the artifact. Wedding
workspaces retain couple framing and existing publication settings; other
projects receive neutral module framing until the owner configures a share.
The empty state sends the owner straight to milestone creation rather than
inventing a second project-management surface.

## 2026-07-26 · T·103 · ships · the owner room and the briefing use the front door

**Timeline now opens as a real owner workspace, and Signal opens as a briefing
instead of an empty room.** The four products use the canonical Notes, Tasks,
Timeline, and Signal routes throughout the app; Tasks keeps its board, list,
timeline, and calendar as views beneath `/app/tasks`; the old board, plan, and
brief paths only redirect.

Each project Timeline now gathers its milestone tasks into a private owner
draft with label, date, order, lane, and visibility controls, then publishes a
separate frozen and revocable public copy. Signal can provision the shared
suite identity even when it is the first product opened, and stale analytics
onboarding links no longer create a redirect loop. The authenticated production
journey, 262 tests, typecheck, production build, sixty rendered experience
checks, and the mobile and desktop project-switching journey passed.

## 2026-07-25 · T·102 · tightens · the old Tasks door enters the one app

**A saved `tasks.signalstudio.ie/app` link now crosses to the canonical Signal
Studio app instead of keeping sign-in on the retired product host.** The Tasks
home lands on the board; deeper app routes keep their path on
`app.signalstudio.ie`. Public boards, templates, invites, and service traffic
stay on the Tasks hostname where they belong.

## 2026-07-25 · T·101 · tightens · four products, one address book

**Signal Studio now has one explicit URL grammar: four marketing paths on `signalstudio.ie`, four signed-in module routes on `app.signalstudio.ie`, and product subdomains reserved for the public artifacts and service traffic that genuinely need them.** The consolidated app stops linking to its former sibling deployments as if Notes, Tasks, Timeline, and Signal were separate apps; typed marketing, app, and public origins make link intent reviewable, old marketing routes redirect to the new homes, and the public wedding Timeline is restored at its established address.

Timeline also gains local project switching where the project context belongs. The current project stays visible in the breadcrumb, an authorised workspace list moves directly among projects while preserving validated context, and All projects is always the first exit. The interaction is covered for tenant filtering, query preservation, three-project browser history, keyboard use, mobile targets, direct reload, and reduced motion.

## 2026-07-20 · T·100 · tightens · the working row sheds what the frame already carries

**The hybrid interior's control row drops the second search box, the All-tasks filter, the Manual-order sort, the Planning button and the live "N shown" count, keeping only Fields, density and Add task — the black Studio Bar already owns search, and the row had started saying things twice.** The one-to-one hybrid port brought the lab's full control row back with it, so the founder's earlier row cleanup had to land again on the new interior; this re-applies it. The controls that stay wear the Signal Studio rail-icon set — fields, density, more, search, sort, filter and settings — repointed through the one icon wrapper, so the whole app moves to the same glyphs at once.

The frame reads as the product now. The black bar's top-left is the real Tasks wordmark — lowercase, larger, tight-tracked — instead of a small label, and the indigo dot stays on the Signal Studio home mark to its left, never doubled. In the workspace brief, the big title and the line beneath it are editable in place: click, type, and the text persists per workspace, so "Q3 launch" and the sentence under it are yours to set. The "N tasks / N complete" receipt row under them is gone, since the progress column already carries that count.

And the board's columns scroll on their own again. A wheel over a column moves only that column, the page stays anchored and the headers fixed, with the horizontal board scroll intact — the independent-column behaviour the hybrid interior had lost. Typecheck, lint, the chrome and suite contract gates, and the production build all pass; live at tasks.signalstudio.ie.

## 2026-07-20 · T·99 · ships · the views become the lab, one to one

**The board, list, timeline and calendar now render the approved design-lab hybrid exactly as it was signed off — the workspace brief, the view bar, the four view grammars and the planning rail — with the only difference being the black rail and header we keep as the frame.** Production had drifted: it mirrored the Option B lab for the calendar and carried the separate T·98 board rework, so what shipped was never the hybrid the lab presented. This closes that gap by making the lab the source of truth for the interior, verified by side-by-side render rather than a spec list.

The whole design-lab component tree is ported in unchanged. It renders pixel-identical because the token layer it draws on maps onto the same base design-system tokens the lab uses, and those tokens are byte-identical between the two. A single adapter is the only seam: it maps a production task to the lab's task shape and back — the five-status model (Queued, In progress, Review, Waiting, Done), priority, schedule, tags and subtask counts — so no schema migration was needed. A production-backed store satisfies the exact lab store contract, deriving state from real workspace data and routing every edit through the existing task actions, so drag, reorder, reschedule, inline edit and bulk actions all persist and reconcile as before.

The frame stays production's own. The command palette, quick-create and the task detail panel remain the globally mounted production surfaces, so their behaviour and keyboard contracts are unchanged; the brief reads the real workspace name. The T·98 board rework, the Option B/C shells and the lab ribbon are dropped in line with the one-to-one decision. Typecheck, the production build, the design-system gate, the materiality gate with a refreshed four-view review, and forty-six of forty-six browser experience checks at both breakpoints all pass. Live at tasks.signalstudio.ie.


## 2026-07-19 · T·98 · ships · the board becomes a real working surface

**The board becomes a real working surface: four named standard columns you can recolour and describe, custom columns you can create, reorder and safely remove, colour-coded tags and an overdue flag on the cards, a full quick-action menu behind the card ellipsis, and columns that finally scroll on their own — all on the Claude Design icon set.** The header sheds its clutter first: the upper-left reads as a static "Tasks" wordmark instead of a workspace dropdown, the date-window and "workspace owner" line under the purpose are gone with the gap they left, search moves to the right of the black bar, and a licence slot on the left binds to real entitlement data — School Edition or Venue Edition when the account carries one, nothing when it doesn't.

The four standard columns now read Blocked, In Progress, Reviewing and Done in that order, with default semantic colours — red, blue, amber, green — applied only where an owner hasn't already chosen one, so no saved colour is ever overwritten. The internal status ids stay exactly as they were, so the relabel moves no task and needs no migration. The colour picker opens to eight named hues, every column carries an editable, persisted subtext, and custom columns get a proper create form (name, description, colour, position); deleting a column that still holds work asks where those tasks should go first, so nothing is ever silently lost.

Cards do more without getting taller: reusable colour-coded tags with a find-or-create editor and a "+2" overflow, a restrained overdue flag, a subtasks button that shows a live done-over-total count and opens the task, and a Nudge popover whose send is deliberately switched off until its backend exists. Every card footprint is trimmed about ten percent through spacing, not scale. The ellipsis opens the full action menu — open, edit title in place, a MOVE TO list built from the live columns with their colour dots, schedule or unschedule, complete or reopen, duplicate the task with its subtasks, and delete behind a confirmation — rendered through a portal so an independently scrolling column can't clip it. And that scrolling is the point: each column's list now scrolls on its own with the page anchored and the headers fixed, horizontal board scroll intact.

The board controls wear the attached Claude Design pack — filter, sort, fields, density, search, share, save view, subtasks, the overflow dots, calendar, settings and the export glyphs — ported at their intended proportions through one icon wrapper, with the source assets and an old-to-new mapping vendored under docs/. The pure column-config model was lifted into its own module and covered with tests; typecheck, lint, 66 of 66 unit and contract tests, the chrome and design-system gates, and the production build all pass. Four founder follow-ups — Programs hierarchy, the custom-icon workflow, the Nudge backend, and attachment thumbnails — are recorded in docs/founder-todos.md.

## 2026-07-17 · T·97 · ships · name it, add to it, and a cleaner working row

**The board bends further to your project: name the workspace to whatever the work is, add new projects from the sidebar, and work under a control row with nothing redundant on it.** The big title in the brief is editable in place now — click it, type, and the name persists per workspace, so "Hartwell Wedding" or "Q3 Launch" is yours to set. The Projects sidebar gains an Add project control that creates a workspace and drops you straight into it. The room's control row is tidied: the second search box is gone (the black bar already owns search), and with it the "N of N shown" count and the Live dot — all noise. What remains reads as one consistent set: Filter, Sort, Fields, density, Save view, Share, and the overflow now wear the same quiet bordered tool-button style, left to right. And the black bar sheds its scope pill; the workspace name lives in the switcher and the title, so it isn't said three times. Persistence rides the existing board meta record and the workspace tables; drag, sync, colours, and the lab composition are untouched; 46 of 46 production-build browser checks passed at both breakpoints, Axe clean.

## 2026-07-17 · T·96 · ships · a slimmer frame, and columns you can name and colour

**The Studio Bar reads as a light frame edge now, not a heavy banner: it slims to 40px and the top-left carries one Signal Studio mark instead of two stacked dots. And the board's columns become yours — rename them in place, and give each one a soft colour so a blockers lane can run rose and a done lane can run green.** The bar drops to a single clean line — the workspace name and its switcher — over the same charcoal that continues down the rail; the rail no longer repeats the home dot the bar already carries. On the kanban, every column header opens a quiet menu with Rename (also a hover pencil, also double-click) and a seven-swatch colour row: neutral, indigo, rose, amber, emerald, sky, violet. The colour lands as a whisper — a low tint on the lane and its header band plus a coloured status dot — never a block, so the eye scans the board by hue without the colour shouting, and the cards stay white so titles keep their contrast. Every hue rides an existing system token; the choice persists per column per workspace in the board's meta record, alongside the names and order it already kept. Drag, sync, custom columns, and the whole lab composition are untouched; 46 of 46 production-build browser checks passed at both breakpoints, Axe clean on the new chrome and controls.

## 2026-07-17 · T·95 · ships · the workspace becomes the lab, one to one

**T·94 hung the Studio Bar over a pre-lab shell, and it showed: the founder's design lab and the live product had stopped looking like the same thing. This closes the gap — production now renders the Option B lab exactly, with the Studio Bar as the single sanctioned difference.** The four-product rail comes across whole: the Signal Studio home mark, the four products with Tasks lit, More, the search-updates-team-settings utilities, the account monogram, and the hover tooltips, all in the charcoal that continues the bar's L-frame. The old sidebar is replaced by the lab's Projects sidebar — a real planning-period tree with each workspace's live task count, a selected leaf that switches the workspace, collapse-to-strip, and the narrow-width drawer. The workspace brief is the lab's full-bleed band again: the tall title, the editable purpose line, the hairline meta row, the mono progress column. Above every view sits the 52px room bar, and its tools are real: search-this-view answers "/", Filter narrows by priority and by owner, Sort reorders by workspace order or schedule or title, Fields configures the list columns, density is remembered, and Save view keeps a named snapshot per workspace — nothing on the bar is decorative.

Each view wears the lab grammar on the production machinery underneath. The board is bounded translucent lanes with sticky narrated headers and status dots; cards lead with a completion checkbox, carry the task's purpose, wear their label chips, and close with a hairline schedule row over a muted signal footer; the done lane recedes; the add-column affordance is the lab's quiet dashed tile; the whole board scrolls inside its own frame with no document-level bar leaking across the page. The list is the lab's fixed table — a sticky uppercase header, a frozen title column, mono meta columns, group receipts — with the field configurator behind Fields. The timeline keeps its commitments strip and the lab's bar-and-tray planning grammar. The calendar pairs the lab month table with the selected-day agenda pane. Drag, optimistic sync, custom columns, the detail panel, demo mode, print and share are all untouched; the charcoals ride the new `--x-studio` and `--x-task` tokens; the chrome contract now proves the shell against the ported stylesheet; and 46 of 46 production-build browser checks passed at both breakpoints — verified against the frozen lab reference captures — before this shipped.

## 2026-07-17 · T·94 · ships · the Studio Bar frames the working canvas

**The design lab's black header is production chrome now: a 48px charcoal bar and a 60px product rail draw one deliberate L-shaped Signal Studio frame around the white canvas, and every pixel of it does a job.** The bar's first cell carries the Signal Studio mark over the rail; its 248px cell carries the workspace switcher over the sidebar; the canvas run opens with the one off-white element on the bar — the scope capsule, planning period › workspace — followed by a universal command field that reads "Search, jump or create…" and answers Cmd/Ctrl+K on every view. The right edge holds the contextual create control and your account; space beside the field is reserved for a restrained Signal pulse, and there is deliberately no notification bell. The rail carries the four products in canonical tile geometry, Tasks lit indigo, each sibling one click into its own app.

The old two-row top — suite pills plus a workspace context bar — is gone, and the workspace brief tightens in step: the breadcrumb and milestones panel leave (scope now reads in the capsule), keeping title, purpose, owner and date, and the compact progress receipts, so the views start sooner. Cross-workspace search moves to Cmd/Ctrl+Shift+K; the palette gains a first-class create exit; the sidebar aligns to the bar's 248px grid and hands its account row up to the bar. The chrome contract gate now asserts the Studio Bar's geometry executable-y, the new charcoals ride --x-studio tokens, the bar held 4.5:1 contrast under the Axe audit, and 46/46 production-build browser evidence passed at both breakpoints before this shipped.

## 2026-07-17 · T·93 · ships · the workspace becomes an Editorial Project Room

**The founder selected Option B from the four-view design lab, and every view now opens under a workspace brief: what this workspace is for, its date window, its owner, live progress with overdue and no-date receipts, and the next three milestones — the room explains itself before it asks you to work.** The purpose line is yours to write, edits inline, and persists without a schema change. The board's system lanes narrate themselves in one line each and cards carry their task's purpose, so intent reads at a glance without opening the panel. The list's status groups gained the same notes plus a dated-work receipt per group, and each row shows its purpose under the title. The timeline summarises open milestones and how much of the workspace is actually placed on the window before the grid starts. The calendar pairs the month with a selected-day agenda: click any day and read everything on it, including what the grid truncates behind "more".

Nothing was traded for it: drag, custom columns, subtasks, bulk selection, optimistic sync, demo mode, print and share views, and every keyboard path are untouched, and the four redesigned pages re-passed the production-build browser evidence suite at both breakpoints before this shipped.

## 2026-07-07 · T·92 · ships · the board gets its colour back, this time as signal

**T·91 over-corrected: stripping the lane palette left the demo calm but lifeless. The colour returns as information, drawn entirely from the product's own tokens.** The lanes wear their soft washes again (the board's chrome since cycle 2) with the lane dot, the lane ink, and a live count that flips over as cards land. People are colours: the presence tokens return to every avatar, and the moving card wears its carrier's colour, because the ring answers "who has this". Priority is honest: P0 is a small urgent red chip, P1 a quiet orange mark, both from the priority scale the app itself uses; due dates that read Today or Tomorrow warm up; idle days show a small clock. Timeline bars wear their lane's wash and ink so status reads at a glance, and the list view's status chips match. Completion earns the system's one green: a tick that pops in and draws its stroke, two hairline rings, and a Done chip that floats off, still no confetti. Cards lift a pixel and deepen their shadow under the cursor; the lifted ghost picks up more tilt and a spring; toasts arrive on a spring. The window dots return as the muted mac trio from the badge palette. The anatomy exhibit matches its board: red P0 chip, David's teal, the amber idle pill. The caption now reads "Runs itself. Click anything to join in."

## 2026-07-07 · T·91 · tightens · the demo joins the canon, and the anatomy learns to point

**The self-running board demo drops its template-kanban skin for the suite's own: paper lanes separated by hairlines, mono uppercase lane kickers with one indigo dot on the moving lane, calm cards with quiet mono priorities, and neutral ink initials with indigo reserved for the one person actually working.** The pastel lane fills, the multicoloured chips and avatars, the per-user pink and teal rings, and the glowing confetti are gone; done now answers with two expanding indigo hairline rings and a mono "Done" chip. Every scene, timing, cursor path, and view morph is unchanged. The anatomy section tightens in step: the ambient glow and circled badges leave, the numerals set in one by one on scroll-in, and hovering either side of the exhibit highlights the other with a 140ms hairline ring. The closing button now reads "Request access" and opens mail, matching the suite's pre-launch door, and the stale "Free to start" caption under it is gone.

## 2026-07-02 · T·90 · tightens · the product switcher cannot regress

**Tasks keeps the new switcher split: signed-in app chrome shows the always-visible product pills, while the marketing dropdown keeps the richer gesture-led panel.** The launcher copy is aligned to the suite canon and a new suite-switcher contract check runs before the test suite, blocking any future return to the hidden authed dropdown.

## 2026-07-02 · T·89 · tightens · the chrome fix lands on main

**The accepted Tasks footer and product-header chrome now sit on current main instead of a side branch.** The public footer follows the suite frame, points to Studio's iOS status page, and names the five surfaces in one order. The product header keeps the shared sticky 56px shell so Tasks reads as one product inside Signal Studio, not a separate app with its own chrome rules.

## 2026-07-01 · T·88 · ships · My Week learns the difference between today and tonight

**When a task carries an evening time — "florist 6pm" — My Week now sets it apart under its own quiet heading, This evening, so the morning read stops mixing tonight's errand into right-now's list.** Zero configuration, honestly derived: the daypart exists only when a task is due today at 17:00 or later, a clock the user actually typed; un-timed quick-adds resolve to midday and stay in Today, and items carried from earlier days keep their place in Today whatever their original clock. When no task earns the evening, the section does not render and "Today is clear." keeps meaning what it says — the empty line now speaks only when the evening is clear too. Five unit tests lock the boundary. Also repairs `pnpm-workspace.yaml`, whose placeholder `allowBuilds` values ("set this to true or false", literally) failed every fresh install with ERR_PNPM_IGNORED_BUILDS. Branch-pending via PR.

## 2026-06-14 · T·87 · ships · a note that becomes a task arrives dated and tagged

**A Notes extract now lands as a real task, not a flat line — the cross-repo receiver runs the creator's wording through the same quick-add parser the board uses.** "Call florist friday #claire-wedding" sent from Notes arrives in Tasks with the due date and the `claire-wedding` tag already set, and a clean title. This keeps Notes free of date and tag pickers — its anti-configuration brand — while still setting both inline at promote time; the parse is deterministic, no model. Backward-compatible: a plain extract still lands as a plain task. Branch-pending via PR.

## 2026-06-14 · T·86 · ships · My Week learns what's stuck

**The calm front door gains the proactive surface it was missing — the nudges rail, folded in from the inbox.** Idle cards, past-due dates and cleared blockers now surface as a quiet 'What's stuck' rail under My Week's sections: client-computed from the same task list, capped at three, silent on a quiet week, dismissals shared with the inbox. The loud parts of the fold — weekly recap, notifications bell, mention chips — stay sequenced as a reviewed cycle because they need a server-data seam into My Week; the inbox route is untouched and working. Branch-pending via PR.

## 2026-06-14 · T·85 · ships · quick-add learns #tags, and finishing a task finally feels like finishing

**Capture now lands a task in the right project from one typed line, and completion reads as progress instead of a silent lane change.** Quick-add parses inline `#tags` — the only project primitive in Tasks (tags-as-projects) — alongside the existing date and recurrence parsing, with a live chip in both composer surfaces. Deterministic, no model in the path. A card landing in `done`, by keyboard `x`, drag, or the detail panel, plays a one-shot indigo check-draw and a soft ring, fully suppressed under reduced motion. Shipped in the same cycle: the 2026-06-09 segmented-onboarding work preserved and verified type-green, and an implementation-ready plan for the inbox → My Week fold. Branch-pending via PR #5; cycle number reconciles at merge.

## 2026-06-09 · T·84 · cuts · six friction points removed in one pass — landing's "done" promise lands in the keyboard, Notes provenance surfaces

**The mark-done that the landing wordmark advertises is now a single keystroke, and a task that arrived from Notes says so quietly in its own header.** Six fixes from the product-excellence pass closed in one cycle. `x` (no modifier) on the focused card toggles complete (`board-app.tsx`); the ShortcutHint reads `X` instead of `⌘⏎`. A `↩ From Notes` provenance chip renders in the detail-panel header whenever `task.sourceNoteId` is set (`panel-header.tsx`, `data.ts`, `row-mappers.ts`) — the static "Drafted from a private note" description was the lazy version of provenance and is gone. The Notes→Tasks extract 404s are rewritten in BRAND.md §3 voice: "Sign in to Signal Tasks once, then try again." / "Open Signal Tasks once to set up your space, then try again." — the PM-tool register ("create a workspace", "User not found in Tasks") that Notes was rendering to its users verbatim is out. The composer no longer silently no-ops on unsupported recurrence; it drops the recurrence, creates the task, and surfaces a quiet toast on both shapes (inline + dialog) — a keystroke that produces no result reads as a frozen app. The dead sidebar collapse chevron is gone (its own comment said it had no handler). `/app/hero-compare` — an internal A/B variant shipping to production with branch labels visible — is deleted, along with both A/B marketing components (`tasks-hero-loader.tsx`, `tasks-hero-rolodex.tsx`). Deferred to follow-up: the inbox-fold into `/app/my-tasks` (My Week) — needs rails-audit and 308-redirect; the orphan draft was discarded.

## 2026-06-06 · T·83 · ships · audience archetype completion — 5 of 5 §2.1 personas land as `/for/*` pages

**All five BRAND.md §2.1 audience archetypes now carry dedicated Tasks landing pages, and the two newly-surfaced ones — `/for/small-business` (operators: restaurants, shops, clinics, studios) and `/for/community` (public-facing coordinators: teachers, coaches, parish coordinators, community organisers) — are wired to the sitemap and the footer Resources column.** The two pages had shipped to the repo on 2026-06-03 (pre-wipe snapshot 6f83127) but were never dispatched and never linked from nav, so they existed without surfacing — a discovery and SEO gap. `/for/small-business` carries the operational-teal `#0e7490` accent and reads against the weekly/monthly cadence; `/for/community` carries the community-violet `#7c3aed` accent and reads against the "visibility into other people's commitments" job-to-be-done. Sitemap priority parity (0.8) with the existing three; footer order is alphabetical-by-audience within the Resources column. The studio-side stale references in `docs/SUITE.md §6`, `docs/VISION.md §5`, and `content/atlas/brand-enforcement.md` were closed in the same cycle.

## 2026-06-06 · T·82 · ships · My week — calm editorial briefing replaces the lane-grouped My tasks view

**The personal landing view at `/app/my-tasks` is now an editorial briefing — Today · Needs attention · Waiting on you · This week · Done this week — instead of a status-grouped table.** The same URL, the same keyboard muscle memory, a completely different reading experience: a quiet date header and time-of-day greeting at the top, sections in priority order with small-caps headers and thin dividers, task rows with title prominent and lane/due/tag dropped to muted meta. Each task lands in exactly one bucket (priority order: overdue/due-today → idle Moving → Waiting → due-this-week → done-this-week) so the same item never reads twice. Sections with no work are silent — except "Today", which always renders so an empty day reads as confidence ("Today is clear.") rather than absence. Tasks without a due date and without idle pressure don't surface at all — they live on the board; My week is the briefing, not the inbox. Sidebar entry renames from "My tasks" to "My week" on desktop + mobile tabbar, page header H1 follows. Second move in the Tier 1 calm-coordination wedge.

## 2026-06-06 · T·81 · tightens · default lane vocabulary reads human — "Moving" and "Waiting" replace "In progress" and "In review"

**The two middle lanes on every workspace board now read "Moving" and "Waiting" by default — the project-management words "In progress" and "In review" are out of the product.** A wedding planner opening Signal Tasks for the first time sees To do · Moving · Waiting · Done — five seconds of legibility instead of vocabulary they have to mentally translate. Per-workspace column renames (T·75) still override the defaults, so any team that wants "Doing" or "Review" keeps them. The LaneId enum (`todo / doing / review / done`) and every CSS token are untouched — this is a label shift, not a schema move. Nudge copy in the inbox follows: "Quietly enjoying its life in the Moving lane", "Waiting pile is getting top-heavy", and the day-4 review nudge now reads "Waiting for {n} days. Are we reviewing it or admiring it?" The cinematic landing demo's activity feed also drops the old vocabulary. First move in a suite-wide Tier 1 vocabulary alignment — Roadmap, Notes, and Analytics will follow once their distinct surfaces are designed in.

## 2026-05-28 · T·80 · tightens · M-tier product polish (toolbar, My Tasks, avatars, activity names)

**Export and Print are out of the primary toolbar — they live in the ··· overflow menu now.** The desktop header reads Search | Share | New task with a quiet secondary overflow for the tools few users reach in a session. The overflow is visible on all screen sizes; the mobile menu gets the same items. My Tasks hides the Share button entirely — a personal filtered view has no share destination, and 'New task' reads cleanly as the sole primary CTA. Activity comments and the share invite email now resolve display names via COALESCE(name, handle, email-prefix) at query time — the 'Someone' ghost that appeared for newly-provisioned Clerk users is gone. Avatars gain `role="img"` so the aria-label is honoured by screen readers across all browsers.

## 2026-05-28 · T·79 · ships · departure-board hero — split-flap animation + "tasks·" wordmark payoff

**The Tasks marketing hero is now a departure-board animation: four wedding tasks flip in character-by-character, each struck through with an indigo spring line, then the "tasks·" wordmark assembles via the same mechanic and holds before looping.** The flip mechanic uses a scaleY squish with three random-glyph scramble cycles per character — the same physics as an airport departure board, run at brand scale. The indigo strikethrough uses a micro-spring easing (`cubic-bezier(.34,1.56,.64,1)`) so the line feels placed rather than just drawn. Task text is mixed-case and human-warm (`Send invites`, `Venue visit`, `Cake tasting`, `Confirm band`) with category tag pills (`GUESTS`, `LOGISTICS`, `CATERING`, `MUSIC`) that add information rather than repeat the task label. The wordmark payoff (`tasks·`) is set ~30% larger than the board text — the font shift from monospace to sans and the size step are the brand crystallisation moment. A warm `#fafaf8` tint settles over the screen when the wordmark lands. First load has no blank cold-start: task 0 appears immediately at full size, sequence starts at the strike. Progress dots replace the passive counter. The 20-second desktop hold is kept alive by a deep dot pulse at the halfway mark and a caption breath at 65%. Safety contract §13 fully observed: `txr-` prefix, all timers tracked and cancelled on unmount, `prefers-reduced-motion` renders the final settled state immediately.

## 2026-05-26 · T·78 · tightens · toolbar icon-only; conversation names from DB

**Export and Print buttons in the app toolbar are now icon-only — the text labels are gone.** Both actions are secondary (power-user territory); the icons are legible and the aria-labels preserve accessibility. The toolbar reads lighter as a result. Author names in the conversation feed now resolve from the database instead of the static seed map — real users no longer see "Someone" as the comment author. The fix JOINs the users table at query time in `getCommentsForTask` and `getActivitiesForTask`; the `Comment` and `Activity` types gain an `authorName` field that the feed, AI summariser, and daily digest all prefer over the proxy fallback.

## 2026-05-22 · T·77 · ships · /templates gallery now filters by audience

**The Tasks templates gallery now carries a quiet pill row — All · Weddings · Trades · Freelance · Marketing — so a visitor can browse by who the work is for instead of scrolling fifteen cards.** Default is All (the gallery is a working surface; serendipity beats wedge-ordering once a user is in). The primitive is byte-portable: `src/components/marketing/template-pills.tsx` is character-for-character identical to `studio/src/components/marketing/template-pills.tsx` (`diff` returns empty), mirroring the `SuiteSwitcher` byte-portable contract — scoped CSS, no Tailwind, no JS libraries. Pills are real `<a href="?audience=…">` anchors that work without JS; the click handler intercepts to do a `router.replace` shallow update so the grid fades in place without a scroll jump. Active pill carries an indigo 9 % wash, a 5 px indigo dot, weight 600; inactive hovers to ink with a 5 % wash. The depth label below the row reads the real count ("3 wedding templates", "1 trades template" — singular when the count is one, no padding for parity). Students are deliberately not a pill — segment canon 2026-05-16 ratified that students never become a paid wedge — but the three student templates still appear under All, and a small "Studying? Signal is free with a .edu address — 3 student templates live under All" line at the foot of the gallery names them honestly. Mobile gets a `mask-image` fade on the right edge of the pill row so the scroll affordance is visible without a scrollbar. Reduced-motion users get instant swaps. Suite-wide: the studio side ships the same primitive on signalstudio.ie/templates as the wedding-led marketing surface (S·67).

## 2026-05-22 · T·76 · ships · close your account from the avatar dropdown, install Tasks to a home screen

**Settings · Account is now reachable from the avatar dropdown, with an irreversible delete that closes your Signal identity in one step; the web app installs to a phone or desktop home screen with the Tasks mark.** Brings Tasks into parity with the suite-wide account-deletion + PWA pattern that Studio (S·65), Roadmap (R·16), Notes (N·19), and Analytics (A·14) already ship. Typing your email confirms the delete; the server wipes every workspace you own — tasks, subtasks, comments, the lot — and then asks the identity layer to close the Signal account. There is no grace period; the action is final and visible before you commit to it. Installable add-to-home-screen now ships a route-based manifest (replacing the static `public/manifest.webmanifest`), an Apple touch icon carrying the full wordmark, and a maskable Android tile. The sidebar gets a small surface tightening: collapsed account state shows the user identity cleanly without overflowing. Required for Apple App Store submission later this summer.

## 2026-05-22 · T·75 · ships · custom board columns — drag tasks into lanes that aren't the default four

**The board on the owner's workspace now supports custom column keys, so a wedding planner who thinks in "venue / catering / day-of" can author those columns directly instead of bending the default lane vocabulary to fit.** New `board_column_key` column on the tasks table (migration `drizzle/0007_add_board_column_key.sql`) — NULL means "use `lane` as the canonical column" so legacy rows and the in-file seed fixtures stay unchanged. Non-null means the task belongs to a custom column whose key is stored in the workspace `meta` blob. Effective board column = `COALESCE(boardColumnKey, lane)`. The board UI (`board-app.tsx`) reads the meta blob, renders the custom columns, and routes drag-drop writes through a new `moveTaskAction` that updates `boardColumnKey` atomically with the existing lane bookkeeping. State machinery (`tasks-context`, `tasks-reducer`, `selectors`) carries the column key through optimistic UI; row-mappers parse it on read. The libSQL forward-compat trick: the runtime code handles the column being absent from prod SELECTs, so the UI ships safely before the migration runs, and the migration ships safely on top without a coordination window. Drives toward the "for the 80% not in tech" promise — a wedding planner's mental model is not project-management lanes.

## 2026-05-21 · T·74 · fixes · the avatar row stops overlapping and reads as people

**Stacked assignee chips no longer crash into each other, and the
two-letter initials inside them now come from a person's actual
name rather than arbitrary characters lifted off an identifier.**
A nameless slot renders a clean question mark rather than a stray
dot, so an unknown face reads as intentional rather than as a
render artifact.

The change rounds out the avatar work the M wave started — the
group label and overflow announcement landed in the previous
cycle, the visual overlap and humane initials landed here. The
original work was authored alongside the C wave but had not yet
pushed at the time.

## 2026-05-21 · T·73 · tightens · one primary on the empty workspace, one voice for the assignee row

**The empty workspace asks for one thing first, and the assignee
stack tells a screen reader who is there.** Add your first task is
now the only button on the empty state — the four starter packs
collapse into a quiet inline line so the hierarchy reads cleanly
without losing the audience cue.

The avatar stack picks up a group label and the more indicator
announces the count instead of sitting there as silent decoration.
Both calls came out of the product walkthrough as M-tier polish
after the C1 wave closed the louder defects.

## 2026-05-19 · T·70 · ships · the inbox knows your name again

**Six rough edges that made Tasks feel unfinished are gone — the morning
greeting is yours by name, an empty conversation reads as calm instead of
broken, and the dead "coming soon" Filter button no longer sits there
greyed out.**

The daily inbox now greets you by your real name instead of "Someone".
Activity in settings shows who did what as a person, not a code. An empty
task conversation says "No conversation yet." rather than shimmering
forever, and if a load ever stalls there is now a try-again instead of an
endless wait. Seeded demo people are quietly marked "sample" so they never
read as real colleagues, and the disabled Filter control has been pulled
from the screen until it actually does something.

Two things flagged in review turned out to be non-issues on closer look
and were deliberately left alone. The change shipped from a clean isolated
build so an unrelated in-progress feature stayed untouched.

## 2026-05-19 · T·68 · ships · the suite switcher is four visible pills

**The app top chrome and the Settings chrome now show all four products as
always-visible pills — the cross-product switch is no longer hidden behind
the faint "signal studio." popover trigger.** One canonical `SuiteSwitcher`
(shared byte-identical across the suite) replaces the launcher popover on
the authed surfaces, carrying the umbrella anchor once, the dot-morph jump,
hover-prefetch and preconnect. The popover stays in the unauthed marketing
nav and the 252px sidebar rail, where four horizontal pills do not fit.
Typecheck and build clean; deployed to prod and verified (200 marketing,
307 app entry).

## 2026-05-18 · T·67 · ships · seamless ecosystem — auth-aware entry + persistent suite chrome

**Signed-in users no longer hit the marketing homepage — they land in the workspace, and every surface in the app wears the correct identity.** Three layers shipped together. Layer 2 wires the M-route redirect in the proxy: authenticated requests to `/`, `/features`, `/pricing`, and `/changelog` get a 307 to `/app`, while unauthenticated visitors still see the marketing site unchanged. The escape hatch is exact: `signal_preview_public=1` cookie or `?preview=public` query param suppresses the redirect for the duration of a tab session, so the operator can walk a prospect through the public site without signing out. Layer 3 kills the false "Sign in" — the nav no longer shows authentication CTAs to a signed-in user; `<UserButton />` replaces them, and the suite launcher deep-links to `/app` entries with app-context labels ("Open the workspace", "Open the notebook", etc.) instead of marketing taglines. "View public site" / "Exit preview" lands in the account menu. Layer 4 mounts the persistent top chrome on every `/app/*` surface: a sticky `h-14` bar with the `signal studio. / tasks` breadcrumb on the left and the authed suite switcher + account menu on the right, byte-identical in geometry to the spec so cross-product jumps swap only the body. The former mobile-only `MobileSuiteBar` (fixed, `h-9`, not in spec) is retired — the new chrome serves all viewports.

## 2026-05-17 · T·66 · fixes · suite UX remediation — R2/R3/R8/R12/R15/R16/R18

**Every real signup was greeted by their Clerk database id instead of their name — now every surface in Tasks says "Someone" when the user isn't seeded, and the My Tasks empty state reads "Nothing on your plate yet." in second person.** The Clerk-id-as-display-name leak (`user_3Dpnq…`) was closed at the source in `fallbackUserMeta()`, hardening avatars, AI digests, assignee fields, conversation threads, and daily digests simultaneously. Six additional P2 issues from the operator screen recording also closed: the `/app` segment now has its own loading boundary with a px-clamped pulse dot; Settings/Workspace no longer says "chrome" (reads as the browser) or "admire the metadata" (dev in-joke); the sidebar Teams list shows venue coordination roles (Venue / Catering / Flowers & Decor / Photography / Logistics) instead of a generic SaaS org; the banned `#7c3aed` purple is gone; the Calendar button says "Sync to calendar" not "Subscribe"; and `theme-color: #ffffff` now prevents the indigo browser-chrome flash between white-surface products.

## 2026-05-16 · T·65 · tightens · the digest cron survives an impersonal scheduled run

**The daily digest cron had never actually run in production — the
moment its auth was finally provisioned, it 500'd on every invocation.**
T·62 wired the digest to report to Signal HQ, but the scheduled job
resolved its user through `getCurrentUser()`, which throws in
production when there is no Clerk session. Vercel's cron has no
session, so the route threw before it could do anything. It had been
masked because `CRON_SECRET` was never set in production either — the
auth guard 500'd first, so the throw was never reached. Provisioning
the cron secrets surfaced the latent bug.

The route now resolves the user through the nullable path and, when
there is no user — the normal shape of an impersonal scheduled run —
records the Signal HQ heartbeat and returns cleanly instead of
throwing. No user means no user-scoped digest and no email; a
scheduled per-user digest still needs an explicit `?user=` override or
a deliberate multi-user design, which is a separate decision, not this
fix. Verified live on `tasks.signalstudio.ie`: the impersonal call now
returns `200` with an honest `skipped` marker and fires the heartbeat,
so HQ stops reporting the job as never having run.



**The 09:00 UTC digest ran every day with nobody watching — Signal HQ
had no way to know it was alive.** It now pings the umbrella when it
finishes, the same way the analytics briefing already does: a hardened,
allowlisted, two-second, fail-silent caller that can never break the
digest it rides on. HQ stops carrying a hardcoded "unmonitored" warning
and starts deriving the digest's health from real run data. Nothing
about the digest itself changed — this is the job learning to raise its
hand. Until the umbrella ping address is configured on this project the
caller stays a silent no-op and HQ reads it honestly as "never run",
self-healing the first morning after.

## 2026-05-16 · T·61 · tightens · the tasks dot now pulses like the rest of the suite

**The tasks· wordmark dot — live in the nav, footer, and every route's
loading state — was still beating the retired 1.6s "heartbeat", not the
canonical pulse the suite advertises everywhere else.** Suite design-system
v1 (DESIGN.md §5) defines Tasks as `pulse, 2.6s ease-in-out` — the same
gesture Studio's brand-mark and the /brand and /pricing reveals have shown
for the tasks variant since the conformance pass. Tasks' own homepage was
the one place that never migrated: it ran `tasks-dot-beat 1.6s` with a
paired-bounce keyframe and "M·02 heartbeat" docstrings. The dot now runs
`tasks-dot-pulse 2.6s ease-in-out` with the canon keyframe shape. No
behaviour beyond the wordmark; reduced-motion still holds it still via the
global block. The earlier suite-wide "old vocab fully retired" claim was a
name-grep that missed this live class — corrected by reading the rendered
declaration, not the keyframe-name presence.

## 2026-05-16 · T·59 · ships · the workspace can be paid by the year

**The pricing page started offering a yearly workspace — a hundred and
twenty euro, paid once — but the checkout it points at only knew how to
sell by the month. It now understands the year. Ask for the annual
plan and you get the annual plan; ask before the yearly price exists
and you quietly get the monthly one instead, never a dead button. The
register stays plain: one price, stated once, no countdown and no
"save" theatre.**

The shared checkout seam other Signal Studio surfaces deep-link into
now carries the billing interval through sign-in and first-run without
losing it, so a couple who has to make an account mid-purchase still
lands on the plan they chose. One human step remains before the yearly
plan can actually be bought: the yearly price has to be created in the
payment account and named to the app. Until then the honest fallback
holds.

## 2026-05-15 · T·58 · ships · the homepage demo stops breaking on the phone the 80% hold

**The most-seen product surface in the suite — the live cinematic
board on the Tasks homepage — was broken on phones, and had been.
On desktop it is a beautiful four-lane wedding board, alive with
cursors. On a 390px phone the wrapper clamped it to a 16:9 box and
`overflow-hidden` simply *clipped* a fixed ~1180px desktop canvas:
the visitor saw the browser chrome, "Hartwell Wedding · 6.14.26",
the view tabs — then the entire board cut off, presence avatars
bleeding off the right edge, and a tall dead void below. The 80%
are phone-first. The flagship "Demo is live" moment was a headless
sliver for most of them.**

It now scales instead of clips. Below `md`, the whole proven canvas
is uniformly shrunk to fit the viewport — the Linear/Arc
desktop-app-on-mobile treatment: the entire board, all four lanes,
the live motion, faithfully smaller. Pure CSS (`min()`/`calc` on
viewport width in globals.css): SSR-safe, no-JS-safe, no flash, no
measurement to drift. Desktop is byte-for-byte unchanged — the
perspective tilt and the deep float shadow are untouched because the
scale rule is `max-width: 767px` only. An ancestor `scale()` never
enters the scripted scene's own coordinate space, so cursors and
the carry/handoff scenes have zero regression surface.

How it was found and the honest correction it forces: the prior
world-class pass recorded "front door + public surfaces world-class
& proven." That was true for voice, no-JS and reduced-motion — and
wrong for mobile *layout* of the demo, because "proven" never
included an actual phone-width pixel look at the cinematic surface.
It does now (captured on production via the on-disk-Chromium recipe,
reduced-motion context). Lesson logged: "voice-verified" and
"correctness-verified" are not "pixel-verified"; the phone is not an
afterthought viewport for a phone-first audience. Typecheck + build
clean; verified on tasks.signalstudio.ie at 390 and 1440.

**BRAND §5 names one colour as forbidden by name — `#7c5cff`, the
historical purple-leaning Tasks accent — and says, in those words,
"don't reintroduce." It was still in 20 files and 51 places: the
brand-accent gradient on the AI buttons and marketing eyebrows, the
decorative blooms behind the manifesto and templates pages, the
glow on the social share cards, even the marker-highlight design
token that underlines every display headline in the app. The brand
says one indigo; the product was quietly still purple.**

It is one indigo now. The root was a single token — `--highlight:
#7c5cff` — so fixing that one line corrected every display-headline
marker across the entire app at once; it is `#4f46e5` (the primary
indigo) and the §5 rule is written into the comment so it does not
silently come back. The brand-accent gradients went indigo →
deeper-indigo (`var(--brand) 0%, #4338ca 100%`), the decorative
blooms and share-card glows went to indigo `rgba(79,70,229,…)`.

The judgement call, made deliberately and not by reflex: the
categorical *identity* swatches — the demo user "Alex", the "Design"
tag dot, the celebration confetti, the avatar palette — were not
flattened to indigo. §5 bans purple as *the accent*; it does not ban
one hue from a labelled set, and the suite itself sanctions violet
for `--aud-community` (BRAND §7). Those swatches moved to that
sanctioned `#7c3aed`, which removes the literal banned value while
keeping people visually distinct from the brand. Blindly indigo-ing
an identity palette would have collided every avatar with the UI.
Typecheck + build clean; zero `#7c5cff` / `rgba(124,92,255)` left in
`src/`. This closes the §5 debt named in T·56 — nothing about the
purple is deferred now.

**Every audience landing, every template essay, and the SEO snippets
behind them were quoting a price that does not exist. "Pro at
$4.99/mo", "Team at $9.95/workspace", "Studio at $14.95/mo" — US
dollars, three tier names that were retired when the suite moved to
the single canonical model (Free €0 · Workspace €12/mo · Event €79
once · Student .edu-free). A tradesperson, a freelancer, a student,
a planner read the wrong currency and a dead tier on the exact page
they were on when they decided whether to trust us. That is the
demo-vs-reality gap the brand exists to refuse, and it was live in
production across the whole audience layer.**

It is gone. Six audience landings (trades, freelancers, students,
weddings, small-business, community), twelve template essays, and
the OpenGraph/Twitter metadata for the trades, weddings, freelancers
and students pages now state the real prices in euros, in each
page's own voice — not a find-and-replace. The freelancer math got
simpler, not patched: the old "Pro vs Team vs Studio, five clients =
5 × $9.95" arithmetic existed only to navigate a leaky tier
structure that no longer exists; the new copy is "€12, unlimited
workspaces, the bill stops being something you model." The student
window was also wrong — "120-day" / "1 year of Pro" became the
canonical two-year .edu window. Three brand-integrity bugs found in
the same files were fixed in the same pass rather than left for
later: "your wife who handles QuickBooks" → "the partner" (a §3 fix
memory recorded as shipped in Plan 5.2 that had regressed), the
banned "stakeholders" in the onboarding essay, and the explicitly
banned `#7c5cff` purple in the students eyebrow + glow (BRAND §5).

Honest scope, named not buried. The same retired prices still live
in three server files (`stripe.ts`, `membership.ts`, the
launch-readiness seed) — that is the entitlements sprint's backend
reconciliation, deliberately not touched here per "backend can
wait." The banned purple survives in ~13 more files (about-manifesto,
templates-gallery, anatomy, embed-guide, template-detail) — a real
§5 violation, deferred to its own cycle rather than slammed into a
pricing deploy where a visual regression could hide. Typecheck +
build clean; verified live on tasks.signalstudio.ie across the
trades, freelancers and students surfaces. Note: a parallel session
was committing T·51–T·55 on the same "speak to the 80%" mission
concurrently; this work was absorbed into that commit stream and
pushed as part of `1f6068f..96fb136` — T·56 may need operator
reconciliation if the parallel session also claimed the number.

**A person who asks their operating system to reduce motion should
get a calm product. The global CSS rule only quietened CSS-driven
motion; fifteen of the twenty-five app components animate through
`motion/react` transforms with no reduced-motion guard, so that
person still got the full set.**

A single root `<MotionConfig reducedMotion="user">` makes every
`motion/react` component honour the preference automatically —
transforms and layout animations drop, opacity stays. It changes
nothing for users with no preference: the cinematic demo and every
flourish are exactly as they were. It is a context provider, so
children still server-render and nothing is hidden from no-JS or
crawlers.

Verified the way it should be: a headless load with the OS
reduce-motion preference emulated against production. The preference
registered, and the demo still ran its scripted scene to completion
and surfaced the wedding planner's own line — reduced motion, full
content, no regression. Typecheck and build clean.

## 2026-05-15 · T·54 · cuts · the scroll-fade that hid the manifesto from crawlers

**Loaded with JavaScript disabled — what a crawler or a no-JS visitor
actually gets — the /principles page hid its own refusal list. The
numbered items that are the brand spine rendered at opacity:0 and
never appeared. /about was worse: the struck-jargon line showed the
banned words with no strike-through, telling a no-JS reader the
opposite of what it means.**

The cause was a decorative scroll-reveal — `whileInView` paired with
`initial: opacity 0` — which Framer renders hidden on the server.
BRAND.md §5 keeps motion to the Tasks homepage demo and holds the
rest restrained; a manifesto that fades in is both unearned motion
and a direct breach of the rule that motion never hides content from
no-JS, crawlers, or scroll position. Removed across
principles-manifesto, about-manifesto (the strike line was
semantically load-bearing, so it is now always drawn), and
templates-gallery (cards static; the hover-lift stays — JS-only,
hides nothing). Two dead motion imports went with it.

Verified by the method that found it: a JS-disabled headless load
against production, before and after. /principles went from 7 of 12
sampled blocks visible to 12 of 12; /about to 12 of 12. Typecheck and
build clean.

## 2026-05-15 · T·53 · cuts · the soft PM vocabulary out of the app the 80% live in

**T·51 and T·52 made the front door speak plain English. The room
behind it still didn't. The app a wedding planner uses every day
carried an "Assignees" column on every list, an "Assignees" field on
every task, and a repeat tool that said it was "Useful for standups".
A planner does not have an assignee or a standup. They have someone
doing the thing.**

"Assignees" is now "Who" — on the list view, my-tasks, the
empty-state ghost table a brand-new user meets first, and the task
detail panel, whose field sequence now reads Status · Priority · Who
· Due · Repeats, five plain words a person would actually say. The
add-person control's screen-reader name went from "Add assignee" to
"Add someone". The repeat popover dropped "standups" and its "Make N
copies, spaced D days apart" placeholder-variable phrasing for "Make
a few copies, spaced a set number of days apart. Useful for
countdowns, reminders, anything that repeats."

Held back on purpose: the CSV-import column mapping still reads
"Assignees" — it documents the source tool's own format, not Tasks'
voice, and renaming it would make the mapping ambiguous. Honest scope:
typecheck, build, and the production bundle carry the new strings, but
`/app` is auth-gated, so the in-app live pixel pass at desktop and
phone is owed, not done. The strings are pure presentational with no
logic keyed on them.

## 2026-05-15 · T·52 · ships · the demo's teammate note becomes the planner's own world

**T·51 left one named gap: the cinematic demo's static "Alex · 2h ago"
comment was still one hardcoded line for every audience. A wedding
planner watching the wedding demo read a generic note, not their own
work. That gap is closed.**

The static comment now reads from the active domain pack. The wedding
planner sees "RSVPs at 89%, on pace." The tradesperson sees "Materials
list updated. Pickup on the way in tomorrow." The freelancer, the
student — each reads a line a person in that work would actually
write. It threads through a new `DemoState.staticComment` so both live
card renderers — the cinematic board and the morphing surface that
FLIPs between board, list and timeline — resolve the same domain-true
value with no drift between them. It draws `commentBodies[1]`, not
`[0]`, so the earlier note never duplicates the line the scripted
scene types in live a moment later.

This is the last place the hero demo spoke in a generic voice instead
of the visitor's own. Verified live on production at both 1440px and
390px: the demo's scripted scene renders "RSVPs at 89%, on pace." for
the wedding planner, the toggle carries only the four real audiences,
the old dogfood line is gone from the user-visible surface, and the
page holds zero horizontal overflow on a phone. The verification ran
through an isolated headless Chromium against the live URL — the
demo-loop pixel pass T·51 left owed is now closed, not deferred.

## 2026-05-15 · T·51 · cuts · the tech-team dogfood out of what the 80% see

**The homepage demo toggle and the /about grid presented a
tech-company marketing board — pricing-funnel audits, engineering
headcount, all-hands — as a target audience, right next to the
wedding planner and the tradesperson. A non-tech visitor toggling
through landed on the exact vocabulary alienation this product
exists to refuse.**

`DOMAIN_ORDER` now lists only the four real Signal Tasks audiences:
the wedding planner, the tradesperson, the freelancer, the student —
BRAND.md §3's own canonical example set, verbatim. The `marketing`
pack stays in the source as the inert canonical seed-structure
fallback (its 16-task geometry is what every domain overlays), but it
is never again shown to a user. The cinematic demo's own default and
the out-of-shell domain-context fallback now resolve to the wedding
planner instead of the dogfood board, so there is no path left where
a real visitor sees "Headcount planning · engineering".

Emoji came out of every surface a real user or visitor touches. The
hero demo, the empty states, and — the one that mattered most —
`SEED_COMMENT_BODIES`, which seeds the conversation thread on a fresh
user's first tasks. That set led with "Hero animation looks great in
the latest cut 🎯" and ran through "Pinged finance", "Bumped this to
P1", "Spec is locked, building now". A wedding planner's first
workspace now reads in plain English that is true whether you plan
weddings, wire houses, shoot galleries, or sit exams. The static
showcase teammate comment — hardcoded to that same hero-animation
line regardless of which audience you picked — is now a neutral
on-voice line. Threading it per-audience is the named follow-up.

BRAND.md §3 is unambiguous on emoji and jargon; §2.3 names voice
drift as the moat itself. This was drift, in the highest-traffic
surface the product has. Typecheck, build, and the live production
toggle + /about grid all verified clean.

## 2026-05-15 · T·50 · tightens · the code-review hardening pass

**A three-agent code review found two unguarded comment paths, a
Stripe dedup table that never fired, and a realtime stream that
silently no-ops in production — all closed in one pass.**

The big one: comments leaked across tenants. `getCommentsForTaskAction`
returned a full thread to anyone who knew a task id, and
`addCommentAction` would write a comment onto a task in a workspace
the caller wasn't a member of — it only checked the task *existed*,
never that the caller could *see* it. Both now route through a single
`resolveCallerTaskWorkspace` guard that confirms the parent task lives
in the caller's active workspace; strangers get an empty list,
indistinguishable from a task with no comments.

The quiet one: the Stripe webhook dedup guard was dead. `alreadyProcessed`
cast `db.run()`'s result to a row array — but libSQL `db.run()` returns
a ResultSet, so the row was always undefined and the check always
returned false. Idempotency was leaning entirely on the `notes`-field
compensator. Rewired to a typed `db.select()` against
`processed_webhooks`, so the dedup table actually dedups now.

The honest one: `/api/events` is a single-process EventEmitter. On
Vercel that fans out to one lambda instance and effectively never
reaches other tabs — a realtime UX that looks fine on localhost and
silently fails in prod. The route now returns a 204 (the canonical
EventSource "stop reconnecting" signal) unless `REALTIME_ENABLED=true`,
and stays on in dev. Opt back in when a real substrate (Upstash /
Pusher / Liveblocks) lands.

Also: `advanceDate`'s weekday-walk loops are capped at 7 iterations
(a corrupt recurrence weekday can no longer hang the server action);
`getTasks` gained a 2000-row safety cap (the public `/p/{slug}` share
path resolves through it unbounded); the dead weekly-digest cron entry
was removed (it 400'd every Sunday — the route is now an explicit
operator endpoint); `getEffectiveTier` takes the rank-max of the
shared and local entitlement stores instead of shared-first, so a
Stripe-written paid tier in the local table can't be silently
downgraded during the E-3.2 cutover; the two duplicate `TIER_RANK`
constants collapsed onto the canonical `tier-shared/tiers.ts`; and the
import-activity write surfaces failures to the log instead of swallowing
them (Analytics' just-shipped trigger reads those rows).

Sibling fix in Analytics: `tasks-db-source` was missing the
`parent_task_id IS NULL` filter Tasks' own `getTasks` applies, so
subtasks were leaking into the briefing engine as top-level signals.

Migration owed (operator, not auto-applied): `drizzle/0005_workspace_id_backfill.sql`
backfills NULL `workspace_id` rows to the legacy workspace across seven
tables — the safe half of the schema-review finding. The NOT NULL + FK
constraint rebuild is documented in that file as a separate
operator-with-a-backup follow-up.

Typecheck (Tasks + Analytics), build, and parser tests clean. Changed
files lint clean.

## 2026-05-15 · T·49 · ships · venue redemption survives a fresh-user render

**The wedding comp-code redemption no longer 500s on a fresh user.**
Two bugs were stacked on the same path. First: `applyTemplateAction`
calls `revalidatePath`, which is illegal during a Server Component
render — and `redeemCompCodeImpl` runs synchronously inside the
redemption page render. Second: the schema gained a `source_note_id`
column for the Notes → Tasks extract back in cycle 9.4b, but no
migration ever shipped to Turso prod, so every `INSERT` into `tasks`
errored with "no column named source_note_id".

Fix: extracted a pure DB helper `applyTemplateToWorkspace` in
`src/server/db/apply-template.ts` — no `revalidatePath`, no event
emit, just the lane-position math and the inserts. `comp.ts` and
`/welcome/page.tsx` route through the helper now; `applyTemplateAction`
delegates to the helper plus the cache invalidation, so client-side
template apply still works the same way. Migration
`drizzle/0004_add_source_note_id.sql` adds the missing column.

Operator note: the migration must be applied to Turso prod before
the deploy is functional for fresh users —
`turso db shell ethanmcnamara-tasks "ALTER TABLE tasks ADD COLUMN source_note_id TEXT;"`.

## 2026-05-14 · T·48 · ships · atlas drift-trigger wires into tasks commits

**Tasks commits now flag the umbrella's atlas when a referenced
file changes.** A pre-commit hook in `.githooks/` runs a node
script against the staged file list, resolves any atlas references
that point at this repo, and writes drift into the studio repo's
canonical sidecar. The hook never blocks — drift is a signal, not
a gate. Activation is one `git config core.hooksPath .githooks`.

Smoke-tested by staging `docs/STRIPE_SETUP.md`:
`pricing-and-entitlements` picks up the new drifted path via union
merge alongside the existing entries. Auto-stage is gated on
`REPO_ROOT === STUDIO_ROOT` so this commit leaves studio's sidecar
uncommitted for the studio operator. Full spec lives at
`~/Projects/personal/studio/docs/ATLAS_DRIFT_TRIGGER.md`.

## 2026-05-14 · T·47 · tightens · the venue sign-up reads on a phone

**The venue redemption flow now hits a mobile-correct sign-up. Clerk
buttons and inputs jump from 30px to 48px, the sponsor code legibility
matches the umbrella treatment, H1 leading no longer clips its own
descenders, and the page can't scroll sideways. Mirrors the umbrella
S·26 pass, scoped to the conversion seam every venue-pilot couple
lands on.**

The audit flow: signalstudio.ie/redeem/[code] → /api/redeem → 308 →
tasks.signalstudio.ie/redeem/[code] → 307 → /sign-up?redirect_url=...
The last hop is where couples meet Clerk for the first time. On a
phone, the buttons were 30px tall (well under the 44px WCAG floor),
inputs were 30px at body font size, the H1 was the same size as body
copy, and the sponsor code beneath the venue strip rendered at 11px
gray — readable on a screen, not so much against the printed card
the code came from.

The Clerk styling lives in `src/app/layout.tsx` `<ClerkProvider
appearance>`. Extended `elements` with `!min-h-[48px] !text-[16px]`
on `formFieldInput`, `!min-h-[48px]` + `!text-[15px]` on
`formButtonPrimary` and `socialButtonsBlockButton`. The 16px input
font-size is the iOS Safari rule — anything smaller and the page
auto-zooms when you focus an input. The `!` prefixes override
Clerk's internal styles in the Tailwind cascade.

The sponsor strip on `/sign-up/[[...sign-up]]/page.tsx` got the
S·26 treatment: code separates into its own `Code` eyebrow + 14px
tabular-nums on the line below. Same pattern the umbrella ships at
`/redeem/[code]` — easier to read, easier to type when a couple is
working off a printed card.

Foundation work matches the umbrella too: `html, body { overflow-x:
clip }` in `globals.css` (was `visible`, latent risk), a `@media
(max-width: 640px)` block loosens `.h-display` / `.h-title` /
`.h-section` / `h1` leading from 0.96–1.10 to 1.04–1.18 (descender
clipping fixed on the home page hero among others), `viewportFit:
"cover"` in the root layout for notch-safe iOS, footer legal links
bumped from 11px / 17px tall to 12px / 32px tall with proper
`inline-flex` hit areas and `safe-area-inset-bottom` padding.

Voice and product surface unchanged. The pass is mechanical mobile
hygiene against the same disciplines the umbrella followed on S·26.
Typecheck clean. Build clean.



**The dark navy gradient that closed tasks.signalstudio.ie is gone — the homepage now reads in one register from top to bottom.**

The closing CTA was the last surface on the Tasks marketing site
still rendering off the v1 design system that landed across the
suite on 2026-05-13. A rounded-3xl panel, radial-gradient navy
fill, white-on-dark typography, white-pill primary button — none
of which matched the paper-white-on-ink-#111 hairline register the
other four products committed to. Suite coherence is the moat;
one panel breaking it is one panel too many.

The rewrite strips the panel entirely. Section opens with a top
hairline (`border-t border-line-soft`) — the same gesture that
separates the rest of the homepage. Eyebrow flips to indigo-600
mono (the one accent the system permits). The "Stop reading. /
Start moving." gray-fade trick is preserved but re-rendered in
`text-ink-ghost` instead of `text-white/55`, so the second clause
softens without changing surface. Primary CTA now uses the
identical `bg-ink text-white` pill as the Hero — same button
language across both calls-to-action.

No copy was harmed in the making of this fix. The voice was
already on-brand; only the surface had drifted.

## 2026-05-14 · Entitlements sprint · One tier, every product

Tasks stops being a tier-island. The local entitlements table that
used to be the single source of truth now mirror-writes to a new
shared `signal-entitlements` Turso DB, and reads check the shared DB
first with a local fallback. Every other product in the suite —
Roadmap, Analytics, Notes, Studio — reads the same store, so a
Wedding comp grant minted in Tasks now actually unlocks the right
things in the briefing email + roadmap workspace counter without
each product owning its own copy of the truth.

Vocab was unified along the way. `pro` and `team` collapsed into
`workspace` to match what the umbrella pricing page actually sells;
`event` was added. The internal `EntitlementTier` union and every
string literal that compared against it (`billing.tsx`, `comp.ts`,
`plan-view.tsx`, the Clerk webhook .edu grant) were renamed in one
sweep. No data migration was needed — Tasks had exactly one paid
entitlement in the wild (a `wedding` comp), which already used
canonical vocab.

A new public seam landed for cross-product checkout: `GET
/api/checkout?tier=workspace|event` redirects an authed Clerk user
into a Stripe checkout session for the right tier, with a fail-loud
guard that bounces to `signalstudio.ie/pricing?status=checkout-offline`
if Stripe envs aren't configured (a stranger can no longer click an
umbrella CTA and walk away with a paid grant before payment lands).
Studio's pricing CTAs deep-link here.

Hardening: the Stripe webhook handler now mirrors its dedup row into
shared `processed_webhooks`, and `writeSharedEntitlement` retries
transient errors with backoff. The daily digest cron got a reconcile
sweep piggybacked on it — walks all active local entitlements and
asks the shared DB to mirror anything missing, idempotently. A
companion `POST /api/internal/reconcile-entitlements` bearer-authed
endpoint lets the operator trigger the same sweep between daily runs.

Settings/billing UI was tightened: Studio and Wedding cards no longer
render as buyable (they're operator-granted / venue-comp only); the
upgrade grid now filters to self-serve tiers + the user's current
one. Currency standardised to € everywhere.

Operator docs: `docs/STRIPE_SETUP.md` (with exactly the two products
that map to public pricing — Workspace + Event).

## 2026-05-14 (voice hygiene) · The last few sprints, swept

A cross-suite copy review surfaced what the prior jargon purges had
missed. Most of the drift was here in Tasks — Roadmap, Analytics,
Notes and Studio came back clean.

**The cinematic demo loses a Burndown.** The corner-mounted sparkline
on the homepage demo was labelled `Burndown` — the chart name we
specifically refuse on the about page. It now reads `Open work`,
which is what the line actually is. The underlying state shape kept
its variable name; the ban is on copy, not on identifiers.

**A pulse on every plan.** The `Live signals` feature card was titled
*Burndown without dashboards* — promoting the banned word as if it
were a feature. Re-titled *A pulse on every plan*; body shifted
*Burn rate* → *Pace*. Same meaning, different register.

**Sprint becomes push, in two templates.** `final-paper-sprint` and
`job-application-sprint` were running-sprint English, but the
ambiguity with the PM term costs us every time. Slugs renamed to
`final-paper-push` and `job-application-push`. Permanent 308
redirects added in `next.config.ts` so existing inbound links keep
landing. Template display names, essay seoTitle, and the
`student → final-paper-*` map in `published-footer.tsx` all moved
in lockstep. Future-facing post drafts under `docs/` were updated;
historical changelog entries kept their original slugs intact —
rewriting history is the worse drift.

**Smaller polish.** `data.ts` seed task *Sprint planning · Q3 themes*
→ *Quarterly themes · Q3*. `for-freelancers.tsx` "wants to see the
gantt and you want to see the kanban" → "the timeline and you want
to see the board". `roadmap-view.tsx` headline lost the "· not the
product backlog" tail (the page already does the anti-callout work
without that phrase). `embed-guide.tsx` Google Docs note: "smart
chip with the page's OG card" → "card with the page preview".
`launch-readiness-seed.ts` retired *seamless* and *in backlog*.
Roadmap repo got one comment fix: a share-gesture comment that
described itself as *intelligent* now describes itself as something
that *lands*.

**What stayed.** Every anti-feature callout — the manifesto's
*"no story points, velocity, burndown, OKR alignment"*, the
trades page's *"no sprint vocabulary"*, the small-business page's
*"nothing here calls you a stakeholder"*, the analytics method
page's *"no agent, no copilot"* — kept verbatim. Refusing a word
by naming it is exactly the §6 pattern; that's the brand doing
its job, not drift. The `Sprint 2` / `Sprint 9` references in
internal code comments also stayed for now — a separate hygiene
pass when the appetite is there.

## 2026-05-13 (suite design-system v1) · Paper turns white, the dot learns to heartbeat

The umbrella's new design system landed and Tasks is the first product
to follow Studio across the line.

**Paper white, ink at #111.** `--bg` reset from warm-stone `#fafaf7`
to pure `#ffffff`. Ink moved from the ramp's `#18181b` to the spec's
`#111111`. The semantic-token layer (`--paper`, `--paper-soft`,
`--paper-deep`, `--ink`, `--ink-soft`, `--ink-faint`, `--ink-ghost`,
`--hairline`, `--hairline-2`, `--indigo`, `--indigo-soft`) is in
`globals.css` alongside the existing ramp + alias system, so legacy
callsites keep working while the rest of the rollout proceeds. Print
views keep `#fafaf7` paper colour because print has its own rules.

**`.tasks-dot` learns to heartbeat.** The dot's motion swapped from
the 2.6s broadcast-style pulse-and-emit (which belongs to *signal
studio.*) to **M·02 heartbeat — paired beats every 1.6s.** Tap-tap,
rest. Work has a pulse; this is the rhythm of getting things done.
The emit ring retired — heartbeat doesn't broadcast, it pulses. The
indigo glow box-shadow retired too; the design system is restrained.

**What didn't change.** The Wordmark component API is unchanged
(`<Link>` wrapper, sm/md/lg sizes, href). The dot's eye-correct
proportions (0.32em / -0.38em) stay — the suite spec's 0.16em is
calibrated for display sizes and disappears at nav-size. Print
views, primitives, the kanban board chrome, lane colours — all
intact. Page-level retouches will land as pages get walked through.

**Carries forward.** Phase 3 is Roadmap — same token set, wordmark
motion to advance (2.6s drift-right-and-reset).

## 2026-05-13 (suite review pass) · Two cross-tenant holes, one Sentry that lied, and an index migration that should have been there from day one

Five-agent parallel review of all five repos. Tasks took the longest
punch list because Tasks has the most surface.

**The two cross-tenant holes.** `/api/calendar/[workspaceId]` would
serve a workspace's dated task titles to any signed-in user who could
guess the id. Now joins `workspace_members` first; mismatched id
returns 404. The docstring used to claim "public per workspace id by
design, like /p/{slug}" — half-true; the proxy required auth anyway,
so the route was both unsafe AND unable to do the thing the docstring
promised. Rewrote it to say what it actually is.

`removeCommentAction` deleted any comment by id with no scope. Any
signed-in user could nuke another tenant's comments. Now scoped on
`(active workspace via task join, author === caller)`. The pattern
that everything-else-in-`tasks.ts` already uses, just applied here
finally.

**Sixteen indexes that should have been in the first migration.**
`tasks.workspace_id`, `comments.task_id`, `activities` keyed on
`(task_id, created_at DESC)` and `(workspace_id, created_at DESC)`,
`notifications(user_id, created_at DESC)`, `entitlements(user_id,
workspace_id)`, the `workspace_members` reverse-lookup, and a few
others. Applied to prod Turso via the CLI; the SQL lives in
`drizzle/0003_hot_indexes.sql` with idempotent `IF NOT EXISTS` so
re-running is safe. Every page load was a full table scan before
this — fine at seed-row counts, not fine the moment a workspace
gets a few hundred tasks.

**Sentry that lied, replaced with one that does the thing.**
`beforeSend(event) { return event; }` was the entire scrubber. The
comment above it claimed "anti-noise: don't sample drizzle/sqlite
errors more than once" — completely fictional. Killed it. New
`src/lib/sentry-scrub.ts` reduces `user` to id only, drops
`cookies` / `data` / `query_string`, redacts cookie/authorization/
x-clerk-*/svix-*/stripe-signature headers, filters out breadcrumbs
to clerk/stripe/svix/webhooks endpoints. `sendDefaultPii: false`
on every init point — server nodejs, server edge, client. Defaults
were sending IP and Clerk session tokens to Sentry.

**Suite-wide security headers.** Plan 4.1 was supposed to put HSTS,
X-Frame-Options, Referrer-Policy, Permissions-Policy, and a
Report-Only CSP on every product. Tasks was on the missing-list.
Fixed now — Roadmap-pattern headers with Clerk + Stripe + Sentry
hosts in the CSP allowlist. Still Report-Only across the suite;
promotion to enforce remains a browser-verification job.

**Dead `better-sqlite3` swept out.** Tasks moved to libSQL/Turso a
while back, but the dependency stayed, `serverExternalPackages:
["better-sqlite3"]` stayed, `outputFileTracingIncludes: { "/**":
["./tasks.db"] }` stayed, and `seed.ts` was still importing
`better-sqlite3` types and casting `db.$client` as a `Database` —
which only worked at all because the early-return-if-not-empty
gate meant the broken code path almost never ran. Seed rewritten
to use libSQL drizzle natively (async, real `db.transaction`). The
180KB `tasks.db` file no longer ships in every Vercel function
bundle. Stale comments stripped from five route files.

**One-off contract: cross-product partner stats over HTTP.**
Studio's `/hq/partners` page used to open its own libSQL client
and read Tasks's `comp_codes` + `entitlements` tables directly.
Tasks now owns the read: `GET /api/internal/partner-stats?sponsor=
<slug>` with `PARTNER_STATS_SECRET` bearer auth. Studio fetches
it. Same data; different responsibility line. The proxy
allowlist gained `/api/internal/(.*)` because the caller has no
Clerk session.

**Tidying.** Duplicate `package-lock.json` deleted (pnpm-only).
Old comments referencing "better-sqlite3 needs Node" in five
route files updated to reflect what's actually true now.

Operator action owed: set `PARTNER_STATS_SECRET` on the Tasks
Vercel project (same value as on Studio); the calendar route's
public-by-token replacement is still a future cycle.

## 2026-05-13 (later still) · A settings screen that sounds like us

Bespoke Settings at `/settings/profile`, `/settings/notifications`,
`/settings/plan`. The borrowed Clerk surface is gone — every label,
every error string, every empty state is ours now. The plan called
it Cycle 9.1a + 9.1b; they landed together.

Three tabs by what they ask of you, not by what they store. Profile
holds name, avatar, email change (two-step with verification code),
password (with current-password reveal toggle and "sign out other
devices" on save), two-factor sign-in (full QR + manual key fallback
+ ten recovery codes you have to acknowledge before continuing),
active sessions (current device labelled, sign out others with one
click), connected accounts (Google, Apple, GitHub), and a danger
zone that runs as a mailto for the first ~50 users — slow on
purpose; we'd rather be slow than wrong about who pressed delete.

"What we send you" replaces "Notification settings". Three rows:
Daily Signal cadence (off / weekdays / every day), Weekly summary
(off / Mondays), Time zone (IANA, auto-detected via Intl). Plus
one always-on row for plan-change + expiry notices: *"the difference
between a refund window and a surprise."* New `user_preferences`
table (drizzle/0002) — distinct from the existing
`notification_prefs` which carries in-app workspace-internal toggles.
Different concern, different lifecycle.

"Your plan" is Lamb's-Hill-aware. Wedding comp redemptions read the
sponsor name + redemption code straight off the entitlement → comp
code join and render: *"A year of Signal Studio, on Lamb's Hill. When
the year is up, the workspace stays."* Paid tiers open Stripe
Customer Portal via email lookup (we don't store stripe_customer_id
yet — Plan 9.2 problem if it ever bites). Free tier links to
signalstudio.ie/pricing.

The Clerk `UserButton` "Manage account" item now sits next to a new
"Settings" entry pointing at `/settings/profile`. Both still work;
ours is first.

What didn't ship this cycle (deliberate non-builds): cascade
account-delete, workspaces management tab, data export, email
open-tracking, cross-product preferences unification, settings on
Roadmap/Notes/Analytics. All scoped out of v1. Tasks first, the
others inherit the chassis later.

Operator action: apply `drizzle/0002_user_preferences.sql` to prod
Turso before the notifications tab can persist anything.

## 2026-05-13 (the same evening) · The "did the next person finish?" signal

One column. One boolean. The minimum-viable monitoring for a venue
pilot at N=10 — answers the question that actually keeps you up after
sending Sinéad ten codes: *did the most recent couple get into their
workspace, or did they get stuck somewhere?*

Schema gains `entitlements.reached_board_at` (nullable integer
timestamp). `markVenueEntitlementReached` stamps it on the first
`/app/board?welcome=venue` render — idempotent on
`reached_board_at IS NULL`, so subsequent visits leave the original
timestamp in place. The UPDATE is wrapped in try/catch: a
measurement-helper failure can never break the board render. Worst
case the timestamp is missed for that visit; the product still works.

Studio reads the new column in `getPartnerStats` with a try/fallback
pattern — the column-aware SELECT runs first; if the prod Turso
ALTER hasn't landed, we fall back to the original shape and report
`reachedBoard: 0`. /hq/partners gains a "Reached board" column showing
`<count> (<%>)` where the percent is reached/redeemed (not
reached/issued — the funnel only meaningfully starts at redemption).

Conscious non-build: per-event funnel table, email open tracking,
`tasks_created_after_redemption` engagement column. The brand
position is restraint, the scale is ten codes, and the operator
question that matters is binary. We earn the event tables at venue
#3, not before.

Migration: `drizzle/0001_add_reached_board_at.sql` — apply to prod
Turso before the next /hq/partners visit (graceful fallback otherwise,
but the column reads zero until then).

Closes Cycle 8.4.7.

## 2026-05-13 (immediately after the polish bundle) · Sentry on the silent paths

The 2026-05-13-third saga (the orphaned-redemption one) cost us hours
because the Clerk webhook returned 500 quietly. No dashboard. No
breadcrumb. We found it by archaeology, working backward from a
corrupted-data symptom. Cheap insurance against the next one of those:

- `src/app/api/webhooks/clerk/route.ts` — missing-secret in production
  fires `Sentry.captureMessage` at error level (was just a plain 500).
  The event-handler switch is now wrapped in try/catch with
  `Sentry.captureException` tagged `webhook=clerk` + `eventType` +
  `svixId` + `eventDataId`, then re-thrown so Clerk still retries.
  The tag set is the whole point: when the next silent failure comes,
  the dashboard tells us *which* event type broke and *which* user it
  was about.
- `src/server/actions/comp.ts` — `redeemCompCodeAction` wraps its
  implementation in try/catch with `Sentry.captureException` tagged
  `action=redeem-comp-code` + truncated `code`. Expected `ok: false`
  returns (not-found, exhausted, expired, already-redeemed,
  still-provisioning) are NOT captured — those are flow outcomes, not
  errors.

No-op when `SENTRY_DSN` is unset (dev/preview). Closes Cycle 8.4.6.

## 2026-05-13 (the morning after) · Redemption polish — four small choices, one deploy slot

A four-agent panel (creative-director, ux-director, ux-tester, strategy)
sat with the venue-edition flow we shipped last night and converged on
four things worth doing before Sinéad gets the CSV. Three are surgical;
one is pure copy. Two hours of work. One deploy.

**The brand-thread breakage at the Clerk seam.** Couples were leaving
`signalstudio.ie/redeem` with Lamb's Hill firmly in mind and arriving
at a generic Clerk sign-up that mentioned neither the venue nor the
code nor the gift. ux-tester called 40% bounce. We added a small
context strip above the Clerk component:

> [SPONSOR NAME]
> Almost there. Lamb's Hill is covering your year.
> Code · LAMBSHIL-MP93X

Eleven-pixel mono eyebrow, fourteen-pixel ink-soft sentence, fainter
mono code line. No buttons. No flourish. The thread is the visual
repetition, not new prose. (See `src/app/sign-up/[[...sign-up]]/page.tsx`
and the new `lookupSponsorByCode` in `src/server/db/venue-welcome.ts`
— resolves sponsor identity from `comp_codes.notes` JSON without
needing an authenticated session.)

**The triple-redirect that elided the success moment.** Click "Open
the workspace" → /welcome → server short-circuit → /app/board. Three
server hops for what should feel like one decisive landing. We moved
the wedding-template apply and the `active_domain = 'wedding'` flag
into `redeemCompCodeAction` itself; the result card now deep-links
straight to `/app/board?welcome=venue&v=<sponsorSlug>`. /welcome
still serves non-venue first-time sign-ups + acts as a defensive
fallback if someone navigates there with a venue entitlement.

**The wrong palette on the success card.** Emerald reads "system
status: shipped." That is exactly the wrong register for "your wedding
workspace just activated." Swapped to `--aud-wedding` rose — the
audience accent BRAND.md §7 reserves for weddings. Same construction
(border tint, faint wash, eyebrow, tier label, icon background). Check
icon stays — at a moment of high anxiety, the visual "yes this worked"
is precisely what a tired adult thanks us for.

**The email that didn't exist yet.** The note Sinéad sends each couple
is the *actual* first touch with the brand. We wrote it for her in
studio's docs (`docs/VENUE_EDITION_EMAIL_TEMPLATE.md`) — plain text,
no exclamation marks, "the work of getting married" + "yours alone,
activates once" + her sign-off. Ships before the first CSV does.

Idempotency edge: re-hitting `/redeem/<CODE>` after a successful
redemption no longer applies the template a second time (would have
appended a duplicate set of wedding tasks). The early-return now
surfaces `sponsorSlug` so the card can still deep-link, but the
template apply is gated on first-redemption only.

What we are NOT doing in this bundle (deferred to a "Cycle 8.5.5 —
polish v2" post-retro): IncludedStack-box → ruled-list cosmetic,
"sponsoring" softer phrasing on the studio landing, "Claim your seat"
CTA tone, the "every view is the same items, all in plain English"
microcopy in VenueWelcomeCard, sponsor-named tasks in the seeded
wedding template, and `already_used`-error self-vs-other routing.

Files touched:

 • `src/app/sign-up/[[...sign-up]]/page.tsx` — sign-up context bridge
 • `src/server/db/venue-welcome.ts` — `lookupSponsorByCode` helper
 • `src/server/actions/comp.ts` — template apply + sponsorSlug return
 • `src/components/redeem/redeem-result-card.tsx` — href + rose palette

Closes Cycle 8.4.5. Clears the runway for 8.5 (Lamb's Hill provision
+ soft launch).

## 2026-05-13 (even later, the third one) · The bridge had a second hole, deeper, and it was already orphaning users

The first live walk through the bridge surfaced two more problems
beneath the one we already fixed.

**Problem one.** The Clerk webhook signing secret is missing from
Tasks's Vercel production. `CLERK_WEBHOOK_SIGNING_SECRET` simply
isn't there — was either never set or got rotated out. Without
it, the `user.created` webhook handler returns 500 to Clerk before
it can write the users + workspaces + workspace_members triple.
Result: new sign-ups land with a Clerk session, no internal user
row, no personal workspace. `getCurrentUser()` returns the Clerk
id; `getActiveWorkspace()` falls back to `ws-legacy` — the dev
seed workspace shared by ada, alex, chloe, david, marcus.

**Problem two, downstream of one.** `redeemCompCodeAction` had
no guard against `ws-legacy`. So the first real venue walk wrote
a wedding entitlement against the shared dev workspace, and the
welcome page would have happily mutated that same workspace's
template + active_domain on the next request. Couples would
have collided with each other into a single shared fallback
workspace if more than one had redeemed.

**Problem three, separate.** The action's check order had
idempotency AFTER the exhausted check. So the user who just
successfully redeemed, refreshing /redeem, got the cheerful
"All redemptions on this code are used up" headline instead of
"You're already on Wedding suite." A small clarity bug with a
high mortification cost in a pilot.

Fixes shipped together:

 • `src/server/db/ensure-user.ts` — new `ensureUserProvisioned`
   helper. Idempotent. Synthesizes a minimal users +
   workspaces + workspace_members triple from just the Clerk
   id, using the same id/slug/color derivation as the webhook
   handler so when (or if) the webhook does eventually fire,
   the ON CONFLICT updates land cleanly on top.
 • `src/server/actions/comp.ts` — three changes. Idempotency
   check now runs before the exhausted check. After the per-
   user lookup, the action calls ensureUserProvisioned so we
   never resolve a workspace that's `ws-legacy` for a real
   Clerk user. A defensive `still-provisioning` reason is
   added in case the provisioning ever fails to give us a
   real ws.
 • `src/app/welcome/page.tsx` — same `ensureUserProvisioned`
   call at the top, plus a `ws-legacy` guard that renders an
   auto-refreshing "Setting up your account" interstitial
   instead of mutating the shared workspace.
 • `src/components/welcome/still-provisioning.tsx` — small
   client component for the interstitial. Auto-reloads after
   1.5 seconds.
 • `src/components/redeem/redeem-result-card.tsx` — success
   CTA now points at `/welcome` instead of `/app/board`, so
   the venue short-circuit can run and the wedding template
   actually gets applied. Previously the success card was
   sending users straight into an empty workspace.

Cleanup: the orphaned LAMBSHIL-MP93X entitlement that landed
in `ws-legacy` during the test walk was rolled back, and the
comp_code redeem counter reset to 0 so the code is claimable
again.

Outstanding: the webhook secret itself still needs to be set on
Vercel before Tasks's normal sign-up flow can hydrate email,
name, and handle on the users row. The fallback provisioning
is enough for the venue pilot — entitlements bind correctly,
workspaces resolve, and the wedding template applies — but
real Tasks accounts deserve their real names.

## 2026-05-13 (later that day) · The bridge had a hole in it. Couples found out before Lamb's Hill did.

Yesterday's "lands in a wedding workspace, no questions asked" was
true on paper. It was less true the first time the live URL got
poked. `tasks.signalstudio.ie/redeem/LAMBSHIL-MP93X` returned HTTP
500 to anyone who wasn't already signed in — which is, of course,
the entire audience for that URL.

The page called `redeemCompCodeAction` unconditionally; the action
called `getCurrentUser()`; and `getCurrentUser()` in production
throws on an unauthenticated request rather than silently running
as the dev seed user. Uncaught throw, Next default error page, the
couple bouncing to "Something went wrong." The local typecheck and
build never noticed because TypeScript can't see runtime auth state,
and the end-to-end test had been deferred to "when we deploy."

The fix is six lines. The page now calls `getCurrentUserOrNull()`
first; if there's no session it redirects to
`/sign-up?redirect_url=/redeem/CODE`. Clerk's sign-up component
honors `redirect_url` natively (env is already wired), so the
couple signs up, lands back on `/redeem/CODE` with a session, and
the original flow takes over from there.

The cost of skipping the live walk has been logged. Saved feedback
`feedback_launch_claim_rule` exists exactly to prevent this; the
deploy went out before the walk this time. Won't again. Lesson is
now two cycles old.

## 2026-05-13 · A couple shows up with a code, lands in a wedding workspace, no questions asked

Venue Editions has a Tasks side now. A couple who books their wedding
at a participating venue gets a code from their venue, types it in,
signs up, and lands on /app/board with a populated wedding workspace
and a quiet card that reads *"Compliments of [their venue]."* The
welcome picker that asked them to "pick a starter so you have something
to play with" doesn't fire — we already know what they're here for.

Three things shipped together. First, a new `detectVenueWelcome` helper
on the server side that joins the user's wedding/comp entitlement to
the originating comp_code row and parses the sponsor identity JSON
that was tucked into `comp_codes.notes` by the studio repo's issue-codes
script. Same query path the welcome page and the board page both use.

Second, the `/welcome` page learned to short-circuit. If the user has
an active wedding entitlement linked to a sponsor, it auto-applies the
canonical `wedding-planning-workspace` template, flips the workspace's
`active_domain` to `'wedding'`, and bounces straight to
`/app/board?welcome=venue`. No picker. No "play with." No friction.

Third, a new `VenueWelcomeCard` client component shows a dismissible
card on /app/board naming the sponsor — "Compliments of Lamb's Hill.
Your wedding workspace is ready. Plan without the noise — every view
is the same items, all in plain English." Dismissed in localStorage,
keyed by sponsor slug so the next venue's couples get their own card.

The welcome picker also got two copy fixes for everyone (not just
venue users): the headline gloss "something to play with" became
"a real example to edit," and "Loaded · ready to open" became "Your
starter is in." Both of the old strings were on the BRAND.md §3
banned-vibe list — techy register on a page that's the user's first
sentence with the product.

This closes Cycle 8.3 of Plan 8 (Venue Editions). The studio side of
the reconciliation lives in studio/docs/CYCLE_8_3_RECONCILIATION.md
— including the part where we accidentally built parallel infra in
Cycles 8.1/8.2 and had to roll a chunk back when grep on `tasks/`
turned up the existing redemption system. Lesson logged.

## 2026-05-12 (still even later) · The avatar dropdown learned about siblings, and mobile got a top bar

Two things shipped together this turn. First, the Clerk UserButton in
the bottom-left of the sidebar now opens a dropdown with three new
rows above Manage account / Sign out: "Open Roadmap", "Open Notes",
"Open Analytics" — each with a small arrow-out icon, each opening in
a new tab. Tasks doesn't list itself; you're already here. The
underlying `<UserButtonWithSuite/>` is a tiny client wrapper around
Clerk's official `<UserButton.MenuItems>` + `<UserButton.Link>` API,
so the chrome stays Clerk-native (same hover, same shadow, same kbd
focus) — we just added the suite jumps inside it.

Second, mobile users finally have a top header. Until now Tasks's
mobile chrome was bottom-tabs only; the desktop sidebar's `signal
studio. /` breadcrumb didn't exist on phones. New `<MobileSuiteBar/>`
is a fixed h-9 bar at the top, md:hidden, carrying the same launcher
trigger and a small `tasks·` wordmark beside it. The layout's
children container gained `pt-9 md:pt-0` to push content below it.

Both gestures point at the same thing: a Tasks user who needs
Roadmap or Notes can get there in one click, on every viewport,
without ever typing a URL.

## 2026-05-12 (one more even later) · The breadcrumb learned to open

Yesterday's `signal studio.` text in the sidebar was a hard link to
the umbrella site — click it, you leave. Today it's a button. Click
it, a small popover blooms below: "Signal Studio · Four products,
one studio." Then four rows — tasks, roadmap, notes, analytics —
each with a one-word tagline (Execution clarity, Direction clarity,
Capture clarity, Attention clarity). Tasks is yours so it's de-
emphasised with a small uppercase HERE tag. The other three open in
a new tab so you keep your workspace. Footer row: "Visit
signalstudio.ie →" because the umbrella is still one click away.

The popover is keyboard-aware (Escape closes), click-outside-aware
(any document click outside the wrapper closes), and noise-free
(no caret on the trigger; discovery is hover + click). It uses
`bg-white` and the same shadow grammar the command palette wears
(`0_24px_60px_-24px_rgba(...)/0.22`), so it reads as part of the
same chrome family.

The command palette also learned about its siblings. Open ⌘P with
nothing typed and the empty state now carries a "Jump to" section
beneath the search hint: roadmap, notes, analytics, each with their
tagline. Type `ro` and only Roadmap surfaces. Type something that
matches no task AND no product, and the palette stays clean.
Roadmap and Notes don't have palettes yet, so this is a Tasks-only
gesture for now — the launcher popover is the universal fallback.

What this turn explicitly did NOT ship: mobile-Tasks header with
the breadcrumb (the bottom-tab surface has no top chrome and adding
one is its own design call); Clerk UserButton custom dropdown items
(Clerk's typed `userProfileProps` API needs spelunking — own cycle).
Both queued.

Implementation: new file
`src/components/app/suite-launcher.tsx` (~150 lines, "use client",
self-contained popover with click-outside + Escape handlers).
Wired into `src/components/app/sidebar.tsx`. Palette gained
imports from `product-urls` and a `SuiteJumps` subcomponent.

## 2026-05-12 (later than even later) · The workspace remembers its address

The sidebar's top-left used to just say `tasks·`, as if Tasks lived
nowhere in particular. Now it reads `signal studio. / tasks·` — a
quiet 12px breadcrumb prefix in front of the wordmark, indigo dot and
all. The marketing site has been wearing this prefix since yesterday;
today it walks into the workspace too.

The studio link is a hard `<a>` to signalstudio.ie, not a Next.js
Link — same-window navigation because clicking the breadcrumb means
"take me out of this workspace, into the umbrella," not "open a
second tab I'll forget about." Hover state lifts the prefix from
ink-quiet to ink, in the same 200ms transition the marketing nav
uses, so the gesture feels like one fabric across the suite.

Roadmap got the same treatment in the same turn. Notes already had
it. Analytics has no app shell yet, so its turn comes when that
shell arrives. Mobile bottom-tab Tasks is unchanged — that surface
has no wordmark to prefix, and the cross-product story for mobile is
the next cycle's job (suite launcher popover, palette "Jump to").

Implementation: two-file edit. `src/components/app/sidebar.tsx`
imports `STUDIO_URL` from `@/lib/product-urls` and renders the
`signal studio. /` prefix to the left of `<Wordmark size="md" />` in
the desktop sidebar header. Layout stays at h-12 with `min-w-0` and
`flex-shrink-0` on the prefix and separator so the wordmark gets all
remaining width.

## 2026-05-12 (even later) · The Anatomy card learned how to breathe

The "Every detail earns its place" section on the features page is no
longer a still life. The demo card now lives a 14-second loop in
front of you: a comment count ticks up, the violet lock outline draws
itself around the card as someone joins, a second avatar (EM) springs
in beside DV with a hair of overshoot — DV gets a tiny squash in
return because that's what motion graphics 101 says happens when
another body enters the frame. The amber "Idle 4d" pill morphs into
a green "Live" chip with a real layout transition (not a crossfade
hack). A typewriter caption types "Someone is in the card." in 22ms
per glyph. Comment counts and due-hour countdowns are slot-machine
rolls with spring physics, not number swaps. The whole thing pauses
when off-screen and respects `prefers-reduced-motion`.

The section also became a two-way teaching tool. Hover any chip on
the card OR any row in the numbered index — both light up, the rest
dim to 40%, and the card itself lifts on a soft spring (scale 1.04 +
deeper shadow). You can stop reading and start reading-by-pointing.

Implementation: rebuilt on `motion` v12 (already in the tree, formerly
Framer Motion). Real spring physics replaced the cubic-bezier
scaffolding; `AnimatePresence` + `layout` prop handles the pill morph;
`pathLength` animates the SVG lock outline; `MotionConfig
reducedMotion="user"` covers accessibility in one line; `useInView`
pauses the loop when the section isn't on screen. Six distinct easing
curves — deliberate vocabulary, one per gesture type — keep the
motion grammar legible rather than uniform.

## Cycle 45 · 2026-05-12 · Plain-English activity log (Sprint 2 cycle 10.4)

The settings → Members tab gained a Recent section below the member
list. Last 10 workspace changes, in human prose, visible to all
members (not owner-gated). Brand-mission read: gesture #4 of Sprint
2's five — "Ethan added two tasks. 12m ago" / "Aoife finished
'Send invoices'. 1h ago" / "Owen moved a task between lanes. 2d ago".
Not "user_2k3 created entity task_abc on workspace xyz".

Grouping: walks the activity table newest-to-oldest and collapses
consecutive same-(user, kind) events within a 10-minute window into
one line. Three taskAdds by Ethan at 10:00 / 10:02 / 10:08 →
"Ethan added three tasks. 12m ago". A taskAdd and a move in the
same window stay separate (different kinds).

Mapper has prose for every ActivityKind in the existing payload
shape: taskAdd, toggleComplete (done + reopen split), move (single
shows from→to lanes with the task title), update (per-field
phrasing), commentAdd, commentRemove, attach, detach. Falls back to
"{user} updated the workspace." for anything unrecognised. Display
name resolution: name -> handle -> email-local -> "Someone". No raw
user-ids ever surface.

The Sprint 2 plan-doc said "new tasks table + formatActivity
mapper". No new table was needed — the existing `activities` table
already records every event from the per-task conversation feed.
The cycle is the prose mapper + the workspace-scoped query +
grouping + the surface in settings.

No new schema migration. `listWorkspaceActivityAction` is the new
server action; the existing per-task `formatActivityLine` in the
detail-panel stays unchanged.

## 2026-05-12 (later still) · Suite chrome — one bar, breadcrumb prefix

The thin cross-product strip on top of every Tasks marketing page is
gone. The Tasks wordmark now sits next to a small "signal studio. /"
back-link, all on one row. About 28px of vertical chrome reclaimed
above the hero stat — Tasks finally introduces itself before
introducing the suite. Same call rolled out across all four products
plus the umbrella; see the umbrella changelog for the dissent
captured inside the decision.

## Cycle 44 · 2026-05-12 · Invite flow honest — Sprint 2 cycle 10.1

The "Real invites land in Phase F. For now we logged it." toast is
gone. The invite flow has been real for cycles — `inviteMemberByEmailAction`
creates a pending_invites row, mints a 32-char token, sends an actual
Resend email (with graceful no-key fallback), and the `/invite/[token]`
page handles signed-in-with-right-email / wrong-email / not-signed-in
states. Cycle 10.1's real work was closing the demo-vs-reality gap on
the settings UI: the invite form copy now describes what actually
happens, the toast on success says "Invite sent to <email>", and a
new Pending invites panel sits between the form and the member list.

Pending invites panel shows email, "Sent X days ago", "expires in Y
days", with two gestures: Resend (re-uses idempotent action — same
token, fresh email) and Revoke (expires the row server-side, leaves
audit trail). Owner-only; non-owners see the panel but no buttons.

Two new server actions: `listPendingInvitesAction` (active workspace,
filters to unaccepted + unexpired, sorted newest first),
`revokePendingInviteAction` (owner-only, sets expiresAt to now so
revoked links land on the existing /invite expired-state copy).

The brand line being held: gesture #1 of Sprint 2's five — one-click
invite. No permission matrix, no role configurator, just an email
input and a Send invite button. Three editing guests on Free,
unlimited on Workspace. Cap-counter remains in the panel header.

## Cycle 43 · 2026-05-12 · Cross-repo Notes -> Tasks write surface

Tasks gained a single new route handler: `POST /api/notes-extract`.
Signal Notes calls it from its server action when a user presses
Send to Tasks on a drafted extract. The body is the creator-authored
action wording — never the raw note body. The route writes a new
task into the user's first workspace, returns the taskId, workspace
name, and a deep-link back to the board.

Auth: shared bearer secret `NOTES_TO_TASKS_SECRET` + the user's
Clerk userId in the body. First-party service-to-service pattern.
The endpoint refuses without the secret env var configured (500),
or with a mismatched bearer (401).

Idempotency: new `source_note_id` column on the tasks table, keyed
as `{userId}:{noteId}` so a repeat call returns the existing task
instead of duplicating. Notes retries are safe.

Workspace selection: the user's first workspace_members row wins.
A user with no workspaces gets a 404 with a surfaced reason ("create
a workspace in Tasks before sending extracts") so Notes can tell
them what to do.

Task shape on create: title = the extract body, description =
"Drafted from a private note in Signal Notes.", lane = todo,
priority = p2, assignees = []. The user re-shapes from the board.

What's needed to deploy:
- ALTER TABLE tasks ADD COLUMN source_note_id TEXT
- NOTES_TO_TASKS_SECRET env var on Tasks (Vercel)
- Same secret on Notes (matching value)

## Cycle 42 · 2026-05-12 · Remix toast invites a Roadmap

The toast primitive gained an optional action link rendered below the
body with a brand arrow glyph. `TemplatedToast` now handles
`?remixed=<id>` in addition to `?templated=<id>` — for canonical
workspace templates (currently just `wedding-planning-workspace`), the
remix-success toast carries a "Create a Roadmap for this" link to
`roadmap.signalstudio.ie/onboarding/from-template/<id>`, opening in a
new tab. Specialty Tasks-only templates skip the action.

This closes Templates Cycle T-2.1c — the discoverability gap that
left T-2.1b technically working but invisible from inside Tasks. The
wedge demo loop is now four-layer walkable: remix wedding in Tasks →
toast suggests Roadmap → seeded roadmap workspace appears with one
planning project and eight items.

## Cycle 41 · 2026-05-12 · Workspace remembers its template

Templates Cycle T-2.0. Workspaces now carry a `templateId` text column on
the `workspaces` table, populated by `remixTemplateAction` when a user
remixes a template into a fresh workspace. Existing workspaces and any
workspace seeded via the additive `applyTemplateAction` get null — apply
is intentionally a mixing operation, not a sticky claim about a single
template's identity.

Why: the four-layer lazy expression mechanism (T-2.1 Roadmap, T-2.2
Notes, T-2.3 Analytics) needs a single source of truth for "which
template did this workspace come from." That single source is now this
column. Each consuming product reads it on first visit and seeds its
slice from the canonical template files in the studio repo.

T-2.0 is the bookkeeping step. The visible cycles ship next: Roadmap
first because it has the clearest workspace model and the most
shareable artefact.

## Cycle 40 · 2026-05-12 · Wedding template lifts to canonical four-layer source

The wedding-planning-workspace template moved out of `tasks/src/lib/templates.ts`
and into the studio repo as the first canonical workspace template at
`studio/src/lib/templates/wedding-planning-workspace/`. It is now a five-file
artefact — meta, tasks, notes, roadmap, analytics — and the four-layer
expression of one workspace lives in one place instead of being scattered
across hand-built demo mocks in four repos.

A new `pnpm sync:templates` script reads the studio canonical source
(sibling directory) and writes `src/lib/templates.generated.ts`, which the
existing `TEMPLATES` array splices in at the start of the wedding section.
Order in the gallery is preserved. The eighteen-task wedding workspace
that ships at `/templates/wedding-planning-workspace` is byte-equivalent
to the inline version that preceded it.

The other twelve templates remain inline in Tasks as specialty templates.
Per the strategy doc (`studio/docs/TEMPLATES_STRATEGY.md` locked 2026-05-12),
only the five anchor templates ripple to four layers; the specialty ones
stay Tasks-only.

This is Cycle T-1 of the templates strategy. T-2 wires the lazy-expression
mechanism in Notes/Roadmap/Analytics so the wedding template's notes,
roadmap, and analytics slices stop being hand-built demo pages.

## Cycle 39 · 2026-05-11 · Wedding workspace becomes a template

The wedding/events wedge now has a real Tasks starting point:
`wedding-planning-workspace`. It carries 18 tasks across venue
decisions, supplier timings, guest numbers, catering notes, final-week
walkthrough work, open decisions, and the one-page update that can feed
the Roadmap share path.

The template has its own long-form SEO/landing essay, and the
`/for/weddings` page now treats the full workspace as the primary CTA
instead of asking couples or planners to begin with only the 3-month
countdown or day-of checklist. Those checklists remain useful, but the
workspace is now the wedge asset.

This closes the first blank-workspace gap in the collaboration growth
loop: a venue, planner, or couple can start with a useful planning
workspace before heavier Notes, Roadmap, Analytics, invite, or source
tracking infrastructure is finished.

## Cycle 38 · 2026-05-07 · Roadmap pills join the design system

The pre-launch design review parked one item: the /roadmap pill
colors were ~14 raw hex strings inlined into roadmap-view.tsx.
Press in rose, paid in amber, launch in violet, kpi in emerald,
P0 priority in stronger red, the unresolved-blocker chip — every
one of them a literal hex string that would silently drift if the
brand palette ever shifted. This cycle pulled them into the
design system.

Eight new tokens in globals.css — `--roadmap-rose-*`,
`--roadmap-amber-*`, `--roadmap-violet-*`, `--roadmap-emerald-*`,
plus a stronger `--roadmap-red-*` family for P0-class signals
that need more weight than the launch-beat rose. Values mirror
Tailwind 50/700 (and 100/800 for the red-bg) so the eye-feel
stays identical to what the surface looked like before. The
roadmap-view.tsx KIND_META, BLOCKER_KIND_META, PRIORITY_META, the
unresolved-blocker card, the inline launch-blocked chip, and the
P0-stats counter all reference tokens now.

The reason this matters: the roadmap is the operator surface. If
a brand pass ever shifts the palette — and given Tasks ships in
cycles, brand-tightening is on the table — the change cost was
14 edits across a 2,300-line file. After this cycle it's a one-
edit pass on globals.css.

## Cycle 37 · 2026-05-07 · A favicon that earns its tab

Tasks shipped with the create-next-app default favicon for too
long. The launch-readiness action item AI-brand-favicon (P1) had
been parked since week one. This cycle closes it.

`src/app/icon.tsx` is the 32×32 browser-tab icon — compact `t` on
a brand-soft tile with the indigo-600 dot bottom-right. Reads at
16×16 because the mark is just a glyph and a dot, not the full
wordmark. `src/app/apple-icon.tsx` is the 180×180 Apple touch
icon for iOS home screens, macOS Safari pinned tabs, and so on —
the full `tasks·` wordmark at 96pt on the same brand-soft tile,
36px rounded corners, no transparency (Apple draws a tile under
transparent icons that would clash with the brand-soft).

Both rendered via Next's ImageResponse so the brand source-of-
truth — indigo-600, brand-soft, the wordmark spec from
docs/brand.md — stays in one place. The legacy favicon.ico stays
in /src/app/ as the fallback for browsers that GET /favicon.ico
directly; icon.tsx wins for everything else.

## Cycle 36 · 2026-05-07 · One body, one rhythm

The design audit ranked it a should-fix and we treated it that way:
marketing body type sizes were drifting 15.5 → 18.5px across pages
with no rhythm reason. Pages would feel almost-right next to each
other without anyone being able to name why. The fix is one of the
quietest refactors in the cycle — nine files, nine size changes, a
consistent typographic system across every public route.

The rhythm is now: **16.5px body anchor, 17px lead paragraphs and
hero subtitles, 18.5px reserved exclusively for the /about and
/principles manifesto opens.** That third tier stays load-bearing
because the manifesto pages are doing something different — they're
declaration documents, and the type carries the gravity.

What moved off 18.5: every vertical landing page open
(/for/weddings, /for/students, /for/trades, /for/freelancers) drops
to 17. They're audience-specific opens, not manifestos, and the
17 reads cleaner against the body. The hero on the home page had
a 17.5 anomaly that was always going to bite an Awwwards judge —
it now sits at 17, matching the verticals exactly.

What moved off 16: the cta block, the templates-gallery intro, the
template-detail body all bumped 16 → 16.5. The half-pixel sounds
fussy until you switch tabs between /pricing (16.5) and /templates
(was 16) — the eye picks it up and nothing reads quite right.

What stayed: the 18.5 manifesto opens on /about and /principles,
and the 18px font-medium kicker copy that lives inside the card-
style closing boxes. Both are different roles operating at
different scales; neither is body.

The hand-of-the-designer is supposed to read consistent across
every public route. After this cycle, it does.

## Cycle 35 · 2026-05-07 · Templates earn the rule

brand.md says "no emoji anywhere," and for cycles the templates
surface had been quietly defying it. Twelve emoji icons across the
template gallery, the detail pages, and the OG card generator —
every one of them rendered to the user, every one of them a small
brand violation we'd been politely ignoring because the alternative
was a refactor.

The alternative was a refactor. We did the refactor.

`src/components/marketing/template-glyph.tsx` lives now. Eleven
stroke-SVG glyphs, one shared map, two exports — a `TemplateGlyph`
component for DOM rendering and a `templateGlyphForOg` function that
hands raw JSX to the `next/og` `ImageResponse` generator (which is
picky about React component shapes). Every template icon is now a
slug — `ring`, `briefcase`, `document`, `book`, `receipt`, `clock`,
`plane`, `target`, `box`, `wrench` — and the gallery, detail, and OG
routes all consume the same registry. Adding a new glyph means
extending one map. Adding a new template means picking from the
existing slugs.

The thirteenth template arrived in the same cycle. /for/trades had
been sharing freelancer templates because nothing trades-native had
been written; the PM review caught it and named the shape — a
jobsite punchlist. So we wrote one. Ten tasks shaped around the
end-of-job walkthrough: callbacks from the homeowner, touch-up
paint, caulk gaps, outlet covers, door swings, final cleanup,
inspection scheduled with the AHJ, final invoice, warranty docs.
The voice in the long-form essay is GC's-notes, not SaaS-product —
plainspoken about the difference between a punchlist item and a
change order, about why the walkthrough has to happen with the
homeowner present, about why the work isn't finished when the tools
are in the truck.

/for/trades replaces the tax-season card with the new template.
The page now hits the two endpoints of a trades engagement — start
clean, close clean — and reads less like a copied page and more
like a built-for-trades page, which is what the audit asked for.

## Cycle 34 · 2026-05-07 · Sell the things we already shipped

The PM review caught three sleeper features the marketing surface
was systematically under-selling. None of them required new
product. All three became copy lifts.

The ICS calendar feed has shipped for cycles. The wedding planner
who magic-links her photographer can also have him subscribe in
Apple Calendar; the freelancer who opens a workspace per client can
have each client's deadlines flow into Google Calendar. None of
that was on the marketing surface. /pricing now names it on the Pro
tier. /for/weddings names it in the "lives on every phone" reason —
the photographer, the DJ, the day-of coordinator each get the
timeline in the calendar app they already check.

/changelog tells its own engineering story now. One paragraph below
the heading explains what this page actually IS — a request-time
render of CHANGELOG.md from the repo, no CMS, no build step, the
cycle lands in git and lands here on the next request. The HN
audience rewards transparency about how things are made; we never
asked them to.

/principles refusal #5 (no real-time push) addresses the Inbox tab
inside the app. Someone who screenshots the Inbox tab and asks "you
have an inbox tab — that's push" creates a credibility gap; one
sentence resolves it. The Inbox is a pull surface. You visit it. It
doesn't reach for you. Same refusal, sharper edges.

## Cycle 33 · 2026-05-07 · Same surface, fewer seams

A cross-discipline design review caught three places where the
surface was visibly drifting from itself. The roadmap header was a
freestanding hand-rolled wordmark, /pricing said "Open the
workspace" but the nav said "Open the demo," and the published
workspace pages were renting their description copy from a
metadata builder.

The roadmap header now uses the canonical `<Wordmark>` component,
routes back to / via Next Link, unifies its container max-width to
1240px to match the marketing surface, and gains an eyebrow line
above the headline — "8-week go-to-market plan, not the product
backlog" — so a first-time visitor never misreads /roadmap as 144
unfinished product features. The roadmap is a credibility
multiplier when its subject is legible at a glance.

The CTA copy unified on "Open the workspace" everywhere — nav,
hero, pricing free tier. "Demo" implied not-real; "live workspace"
was wordier than the rest of the surface. Pricing already used the
canonical phrase; we propagated.

Stripe webhook idempotency race fix landed. `grantEntitlement` is
now idempotent on the `notes` field — if a row with the same notes
value already exists, the call is a no-op. The webhook handler
reorders: pre-check via SELECT, do the grant, THEN record dedup at
the end. A crash mid-handler leaves no dedup record, so Stripe's
retry re-runs the grant — and the grant skips silently because the
entitlement already lives in the table. The customer-paid-but-not-
entitled path is closed.

/p/[slug] description rewrite. Was machine copy: "A published Tasks
workspace · 144 tasks · Wedding." Now reads as a human sentence —
the workspace name, what it is, the brand shape ("same items, four
lenses: board, list, timeline, calendar.") A press visitor landing
on a published workspace from a magic link gets human copy as their
first impression instead of a metadata builder's output.

## Cycle 32 · 2026-05-07 · Refusal list, but for our own copy

A cross-discipline review (design, code, value) produced a 23-item
punch list, and the most cutting finding wasn't anything visual or
architectural. It was that two lines on /pricing named features we
hadn't shipped. "Slack/Linear integration" on the Pro tier didn't
exist. "Printable PDF day-of binder" and "seating-chart/RSVP
imports" on the Wedding tier didn't exist. /for/freelancers said
Studio was "next-cycle roadmap" when Studio had already shipped.

The pitch is "we ship a refusal list." Lying about features on a
page that says "we ship a refusal list" is the worst possible
self-inflicted wound. Killed every false claim and replaced it with
the things we'd actually shipped — the ICS calendar feed (Apple,
Google, Outlook subscribe), AI nudges with the model name spelled
out, cross-workspace search and overdue triage, the magic-link
guest model, the wedding template pair, the public /p/[slug]
wedding theme. Per-tier features now match what's in production.

The brand-rule pass came in the same cycle. brand.md says "no
emoji anywhere." Killed every emoji on /for/students,
/for/freelancers, /for/weddings — eight occurrences across three
pages — and replaced them with consistent stroke-SVG glyphs in
brand-soft tiles, accent color matching each vertical (emerald,
teal, pink). /press lost its literal `ethan@<domain>` placeholder
and the `[NEEDS-REVIEW]` body text; the sole press contact is now
the gmail address until the domain lands.

The security cluster was the third half of the cycle. Seven
exploitable gaps closed by the same audit:

- `getActiveWorkspace` cookie validation. Two unrelated queries
  collapsed to a single AND-joined membership query — a hijacked
  cookie no longer honors a workspace the caller doesn't belong to.
- `updateTaskAction` and `removeTaskAction` constrain the WHERE to
  the active workspace. An auth'd user knowing any task id can no
  longer mutate cross-tenant rows.
- `mintCompCodeAction` split into a module-private helper (the .edu
  student flow uses it directly) and a public, admin-allowlisted
  action gated by `ADMIN_USER_IDS`. Self-grant of comp codes via
  the RSC channel is closed.
- `draftReplyAction` and `summarizeConversationAction` verify the
  task's workspace matches the active workspace before rendering
  the title and thread to the model. The AI channel is no longer a
  side door for cross-tenant reads.
- `weeklyDigestNarrationAction` and `getWeeklySnapshotAction` lose
  their caller-supplied `workspaceId` parameter. Trusted callers
  (cron route, inbox page) use `buildWeeklySnapshotFor` and
  `weeklyDigestNarrationFor` in the new server-only module
  `@/server/digest-narration`.
- `listShareLinksAction`, `revokeShareLinkAction`, and
  `listShareLinkAnalyticsAction` scope to active workspace. Cross-
  tenant share-token enumeration and revocation are closed.
- /api/cron/digest and /api/cron/weekly-digest fail closed when
  CRON_SECRET is unset on a production deploy. Dev runs still hit
  the routes without a secret.

The HN audience picks at things. Show HN is forty days out. The
fixes above mean an enthusiastic-and-technical HN reader can spend
an hour probing and find nothing exploitable. The refusal list
holds.

## Cycle 31 · 2026-05-07 · Sprint 10 — The other roadmap

The internal GTM tooling joined the product. Until this cycle the
8-week distribution plan lived in a single 1,400-line markdown file
that nobody but the founder could load without losing the thread —
which is fine when the work is theoretical, and a problem the moment
the work is 144 actual rows that need to be queued, drafted, dragged
toward `in_progress`, and eventually checked off without forgetting
which Tuesday the press email goes out.

The fix was to put the roadmap inside the app, behind auth, with the
same design bar as the published surfaces. The markdown stays
source-of-truth — the parser re-walks it on every page load, the sync
layer reconciles new rows in without trampling user-set status, and
the result is a 144-row interactive checklist with a sticky launch-day
countdown and a right-rail of "next 7 days." Alongside it: file
attachments on tasks (the obvious gap nobody had filled yet), and the
full Phase-1 GTM execution work — hero loop video on disk, published
wedding workspace seeded, press-draft openers verified, posts weeks
4–8 drafted, redirect bug closed.

### What the user sees

- **`/roadmap`** — the new top-level surface, gated to the workspace
  owner. Sticky header with progress ring, T-minus countdown to Show
  HN and Product Hunt, and the full eight-week stripe below. Each
  week is its own section with a thin progress hairline that fills as
  rows complete; each row has a three-state checkbox (pending →
  in_progress → completed → pending), a date pill, a channel pill,
  and a hover-revealed "add note" affordance for one-line annotations
  like "got 47 likes" or "slipped to Wednesday."
- **A right rail that earns its width** — Next 7 days as a
  click-to-cycle list, launch beats with their actual times (3:01am
  PT for Product Hunt, the kind of detail you don't want to look up
  twice), and a small footer card that says: "edit the markdown,
  refresh this page — new lines appear, status carries over." Which
  is true.
- **File attachments on tasks** — drag-and-drop anywhere over the
  attachments section in the detail panel, or hit the "Attach"
  button. 25 MB cap, multi-file picker, optimistic rows that show
  filename and size while uploading, image previews inline, popover
  confirm before delete. Bytes never round-trip the React tree —
  every download links to `/api/attachments/[id]` which streams from
  disk after re-checking the workspace.
- **The published wedding workspace at `/p/wedding-2026-public`** —
  the first real public-facing demo URL, seeded from the
  `wedding-3-month-countdown` template, OG card rendering, ready to
  be linked from the press emails when those go out next month. The
  seed script is idempotent so repeated dev-box runs don't duplicate
  rows.
- **Hero loop video on the landing** — the 30-second `HeroLoop30s.tsx`
  composition rendered to `public/hero-loop.30s.{mp4,webm}` and wired
  into the landing block. Autoplay, muted, loop. 768 KB at the size
  it actually plays, which is a lot less aesthetic damage than the
  full Lighthouse hit suggested it would be.
- **`/app/*` redirect fix** — Clerk now redirects unauthenticated
  visits to `/sign-in` instead of bouncing to a homepage that
  pretends nothing happened. One-line change to `auth.protect()` with
  an explicit `unauthenticatedUrl`, but it's the kind of boundary
  glitch that quietly tanks deploys until someone tries to share a
  link.
- **Press drafts cleared for sending** — six `[VERIFY OPENER]` flags
  in `docs/press-drafts.md` resolved by re-reading the journalists'
  recent pieces and keying each opener to a specific reference. The
  Sherwood masthead got verified the slow way. The file now has zero
  open flags, which means the only thing standing between "drafts" and
  "sent" is the user's morning of 06-08.
- **Posts weeks 4–8 drafted in full** — `docs/posts-week-4.md` through
  `docs/posts-week-8.md`, ~95 verbatim post bodies in the same voice
  pattern weeks 1–3 already locked in. No "[draft]" placeholders, no
  "TODO: rewrite this," nothing the user has to second-pass before
  pasting into X or Bluesky.
- **`docs/phase-plan.md`** — the framing document that classifies all
  144 roadmap rows into Auto / Stage / Blocked, with file-scope-disjoint
  parallel-dispatch buckets. The plan that turned an 8-week sprint
  into a few hours of code-and-content work plus a queue the founder
  can drain by hand without rebuilding context each time.

### What changed under the hood

- `roadmap_items` table added to `src/server/db/schema.ts` — one row
  per actionable line, deterministic primary key of shape
  `${kind}-w${week}-${date}-${slug}-${ord}`, with `status` /
  `completedAt` / `note` as the only user-mutable columns. `isLaunch`
  is derived from `**bold**` cells in the source markdown.
- `src/server/roadmap/parser.ts` — pipe-row walker that picks up §3
  asset checklist, §7 8-week content calendar, §9 14-day press Gantt,
  and the synthesized KPI Mondays. No remark dependency; the
  cell-splitter is 18 lines and handles header dividers, bold-strip,
  link-strip, and date normalization (`MM-DD` → `YYYY-MM-DD`) without
  pulling in unified.
- `src/server/roadmap/sync.ts` — idempotent reconcile against
  `roadmapItems`. Updates the shape fields on existing rows (channel,
  body, date), preserves `status` / `note` / `completedAt`, never
  deletes — the user might have notes on rows that disappeared from
  the markdown and we're not going to lose those silently.
- `attachments` table — `taskId` cascade on delete, `workspaceId`
  denormalized so the download route can authorize without joining
  through `tasks`, `storedPath` is server-relative under
  `<repo>/.data/uploads/...` (deliberately outside `public/` so the
  Next static handler never streams attachment bytes by accident).
- `/api/attachments/[id]` route streams bytes from disk after
  re-verifying the request's workspace membership. Filename is set
  via `Content-Disposition`; image rows pull through the same
  authenticated route for previews so there's exactly one path bytes
  can reach the client through.
- `src/components/app/detail-panel/attachments-section.tsx` — the
  drag-and-drop UI with optimistic pending rows, refresh-on-task-update
  via `task.updatedAt` cache key, popover-confirmed delete, mime
  category branching (image / pdf / doc / code / archive / other) for
  the file glyph.
- `src/proxy.ts` — `auth.protect({ unauthenticatedUrl: …/sign-in })`
  on the `/app/*` matcher. Three lines. The fix was always tiny;
  finding it required reading the Clerk middleware contract in the
  Next 16 docs, which the proxy boundary makes a different shape than
  pre-Next-16 middleware.
- `src/server/db/seed-published-wedding.ts` — bypasses the
  auth-gated `applyTemplateAction` / `publishWorkspaceAction` and
  writes through Drizzle directly so the script runs from any server
  context. Re-asserts `publishedAt` and `activeDomain` on every run,
  only seeds tasks when the workspace's task list is empty.

### Why it matters

Shipping the GTM tooling next to the product turns "external
execution work" into "another surface in the codebase." That means it
gets the same review bar — voice integrity, no emojis, sentence case,
em-dashes — and the same diff-able review pipeline as a marketing
page or an empty state. The 144-row reconcile path is the most
aggressive test of the architecture so far, because it has to absorb
upstream churn (the markdown will get edited many more times before
06-26) without leaking that churn into the user's status state.

The roadmap surface itself is recognizable as a product. Markdown as
source-of-truth, Things-3-grade hairlines on the week progress bars,
the three-state cycle that everyone who has used Linear or Things
already knows by muscle memory, deterministic IDs so the URL of any
row is stable. The user already flagged it for either standalone
spinoff or Verizon GPO reuse — a roadmap-as-checklist surface tied to
a markdown source has obvious applications in places where the plan
lives in one document but the work happens across a dozen people. We
built it for the launch, but it would not be wasted to build on it
later.

### One small thing

The published wedding workspace's first task is "Send save-the-dates."
That's not the seed script picking the first row of the template
alphabetically — the template's first task is "Send save-the-dates"
because three months out, that's actually the first thing. The
roadmap's first rendered week is empty — the sticky-header today-rail
just reads "Quiet stretch. Use the lull." which is also true at the
moment, and won't be by Monday.

## Cycle 30 · 2026-05-06 · Sprint 9 — Google bridges at the boundary

The Google-integration question came up early in the strategy review
and got a clear answer: not yet, and maybe not ever in the deep-OAuth
sense. The thesis is that Tasks is the workspace, not a satellite of
someone else's. What the bridges do is meet people where they already
work — paste, embed, subscribe — without negotiating a single permission
prompt.

### What the user sees

Three new capabilities, all clustered around a single new affordance
in the app header (next to Share):

- **Copy as Sheet (CSV)** — one click puts an RFC 4180–shaped CSV on
  the clipboard. Columns: Title · Lane · Priority · Due · Tags ·
  Cents · Contact name · Contact email. Paste into Sheets, Excel,
  Numbers, Airtable. The shape was chosen for round-trip
  comprehension, not feature parity — anyone reading the file gets it
  in five seconds.
- **Copy as Markdown** — same data, lane-grouped with `[ ]` / `[x]`
  checkboxes and italic meta in parens (priority · due · tags). Drop
  it into Notion, Linear, GitHub issues, Slack canvas, a Google Doc,
  a status email. The mental model: "the workspace as a memo."
- **Subscribe in Calendar** — surfaces the `webcal://` URL that the
  iCal feed has been quietly serving since cycle 14. One click writes
  the URL to the clipboard and points users at the
  Calendar.app / Google Calendar / Outlook subscribe flow.

The fourth bridge is a how-to page rather than a button:

- **`/embed/guide`** — written-out instructions for dropping a
  published workspace into Google Sites, Notion, Substack, Ghost,
  Webflow, Framer, Squarespace, and Google Docs. Two patterns: the
  raw-iframe (universal) and the script-tag auto-discovery (for
  repeating embeds across a site). Per-tool quirk notes — Google
  Sites strips the `loading` attribute, Notion's `/embed` block takes
  the URL directly, Google Docs renders as an OG smart-chip and the
  Markdown export is the better path. Included in the sitemap.

### Why this shape

OAuth integrations are expensive in three directions: build cost,
permission anxiety for users, and platform risk (the integration
breaks every time Google reshuffles a scope). The bridges
side-step all three. CSV and Markdown are eternal — they have no
auth, no API quota, no breaking-changes calendar. Calendar
subscription is solved by the iCal RFC. Embeds are solved by the
iframe element. We meet the user where they are, then they bring
the workspace with them.

The voice constraint stayed honest: no emoji, sentence case,
restraint. The eyebrow on `/embed/guide` reads "Drop a workspace
into anywhere that takes HTML." The closing card reads "Publish
your workspace. Paste the URL. The destination renders it. Done."
That's the whole thesis in four sentences.

### Implementation notes

- `useActiveWorkspace()` hook joins the existing `DomainProvider`
  context — same shape, just exposing `{ id, slug }` alongside
  the domain pack. The app layout fetches the slug once at the
  server boundary and hands it down; client components read it
  with a single hook call. Returns `null` outside the app shell,
  which lets ExportMenu render conditionally without a try/catch.
- Pure formatters live in `lib/exports.ts` — `formatTasksAsCsv`
  and `formatTasksAsMarkdown` take the same `Task[]` the app
  renders and return a string. No DOM, no clipboard, no
  workspace lookup; the menu component owns those concerns. Easy
  to test, easy to repurpose later if we want to surface them in
  the API.
- The clipboard write uses `navigator.clipboard.writeText` with
  an `execCommand("copy")` fallback for older Safari and the
  iOS WebView.

### What's next

Sprint 9 was the last sprint in the Phase-8-through-14 plan that
needed to ship before deploy. The next move is hosting — the
plan is to push to Vercel free tier today, wire the Clerk test
keys as env vars, and have a public URL by end of day so the
project stops being localhost-only.

## Cycle 29 · 2026-05-06 · Design system locked in — wordmark spec, trades audience, copy revamp

Pulled the design-system handoff bundle (zip) from the user — README,
`tasks-design-system.html` in full, `tokens.css`, six reference
screenshots. README rule: *"recreate them pixel-perfectly in whatever
technology makes sense. Match the visual output; don't copy the
prototype's internal structure unless it happens to fit."* Followed
that rule across three concrete deliverables this cycle.

### 1 · Wordmark animation aligned to spec

The DS spec calls out: 2.6s pulse cycle on `spring-glide` easing, with
a punchy beat at 70%–80% (scale 1.0 → 1.25 → 1.0) and a single emit
ring fading in at 68% then scaling out to 2.6×. The v0.2 wordmark
used a slower 3.4s pulse with a softer scale-down (1.0 → 0.84) and
two perpetually-staggered wave rings.

Rewrote `.tasks-dot` in `globals.css` to match the spec timing
exactly. Renamed the keyframes (`tasks-dot-pulse`, `tasks-dot-emit`)
so future cycles don't accidentally collide with the v0.2
`dot-pulse` / `dot-wave` (which other components might still
reference). Added `letter-spacing: -0.05em` on the wordmark itself
to match the −5% tracking spec.

### 2 · Trades — fifth audience pack

The original four ICPs (marketing / student / freelance / wedding)
had a clear gap: the *manifesto's* audience said "anyone with a
list," but the four packs all assumed knowledge-work. **Trades** —
electricians, carpenters, plumbers, contractors, anyone whose work
is dispatched as a list of calls and finished with a signature —
fits the manifesto tighter than freelance does in many cases.

What landed:

- **`DomainId` extended** to include `"trades"`. The discriminated-
  union approach surfaced every callsite that needed updating; tsc
  caught one (`DOMAIN_TO_TEMPLATE` in `published-footer.tsx`),
  pointed trades to `new-client-onboarding` (same shape — kickoff,
  contract, payment terms, first invoice).
- **Trades domain pack** in `lib/domains.ts` — 16 seed tasks
  spanning service calls (replace breaker · 142 Maple), quotes
  (Hartwell panel upgrade), materials (200A main breakers),
  permits, invoices, crew syncs, fleet (truck inspection +
  insurance certificate). Voice tuned for the audience: route
  language, address-by-number specificity, "ladder back in the
  truck."
- **Trades published theme** — `trades-theme.tsx`. Job-ticket
  binder aesthetic: faint cyan graph-paper background on warm
  vellum (#fbfaf3); steel-ink (#0f172a) type; bracketed lane
  callouts (`[QUEUED]`, `[ON SITE]`, `[FINAL WALK]`, `[CLOSED]`);
  6px safety-orange (#f97316) left-stripe on cards in the active
  lane; mono four-up spec-field grid; signature-line "— end of
  ticket" footer.
- **`/for/trades` vertical landing** — fifth ICP landing,
  safety-orange to complete the rose-pink / teal / amber / orange
  system. H1: *"Calls, jobs, invoices — one binder."* Anchors on
  `new-client-onboarding` + `tax-season` (both already trades-
  applicable). Sitemap and footer Resources column updated.
- **Existing `DOMAIN_ORDER` consumers all flow through** without
  modification — settings starter-pack picker, welcome picker,
  about-page DomainGrid, empty-state seed-pack pills, domain
  toggle on the home cinematic demo. They iterate over
  `DOMAIN_ORDER` rather than hardcoding four packs, so trades just
  appears as the fifth option.

### 3 · Copy revamp — sharpening the manifesto voice

Audited high-traffic surfaces against the design system's voice
rules: *"Lightly knowing, never cute. Restrained, confident,
tactile. Sentence case. Em-dashes welcome. No emoji."*

Two real edits:

- **Hero subhead.** Was: *"A live task workspace built for momentum.
  Real-time presence, four synchronized views, plain-English dates
  — all stitched together by motion that feels alive."* Now:
  *"Project management for the 80% who don't work in tech. Four
  views of the same list, real-time when it matters, plain-English
  dates — no sprints, no epics, no learning curve."* The new
  version cites the manifesto positioning directly + names what
  the product *isn't* (sprints, epics) — drier, sharper, more
  Tasks.
- **List view empty state.** Was: *"Capture it once, check it off
  later. The dopamine hit is real."* The "dopamine hit is real"
  was a hair too cute for the *"never cute"* rule. Now: *"Write it
  down once. Check it off when it's done. That's the whole
  product."* Calls back to the about page's *"Write down what you
  have to do. Look at it the way that helps. Cross it off. That's
  the whole product."* — the pattern repeats across surfaces.

The other empty states (board / calendar / timeline / my-tasks)
read manifesto-correct already; left untouched.

### Verified

- `npx tsc --noEmit` clean across the merged tree.
- 12 surfaces probed: `/`, `/about`, `/principles`, `/pricing`,
  `/templates`, `/for/{trades, weddings, freelancers, students}`,
  `/p/legacy`, `/app/board`, `/app/list` — all 200, 0 console
  errors.
- Trades published theme verified by SQL-swapping `active_domain`
  to `trades` and snapshotting `/p/legacy` — graph-paper background
  rendered, `[QUEUED]` lane label visible, safety-orange top rule
  + active-lane stripe, job-ticket card layout. Restored
  `active_domain = student` after.
- `/for/trades` rendered with safety-orange eyebrow + the
  *"Calls, jobs, invoices — one binder"* H1 + the highlight-band
  underline on *"one binder."* Both template anchor cards visible.
- Wordmark dot animation now matches spec: 2.6s cycle, sharp beat
  at 70%, single emit ring scaling out to 2.6×.



## Cycle 28 · 2026-05-06 · Design system v0.3 — tokens.css aligned

Pulled the canonical design system from the design tool and reconciled
it with the v0.2 tokens already in `src/app/globals.css`. The strategy
was strict additive: keep every existing token (so 215 source files
don't regress), add the full design-system surface alongside, and
alias the v0.2 names to the new ramp positions where they line up.

### What landed in `globals.css`

- **Indigo ramp** — full 9 stops (`--indigo-50` through `--indigo-900`)
  + `--highlight: #7c5cff` for the marker underline accent on display
  headlines.
- **Ink ramp (neutrals)** — 12 stops (`--ink-0` through `--ink-950`)
  for the new ramp-aware code; the v0.2 names (`--ink`, `--ink-soft`,
  `--ink-quiet`, `--ink-faint`) now alias to ramp stops so existing
  callsites keep working.
- **Audience accent tokens** — `--aud-marketing`, `--aud-freelance`,
  `--aud-student`, `--aud-wedding`. The four published-workspace
  themes from cycle 20 already shipped with bespoke palettes more
  nuanced than these single-hex placeholders; these tokens are
  available going forward when surfaces want a 1-color accent (e.g.,
  category chips, ICP eyebrow pills).
- **Status tokens** — `--status-todo`, `--status-progress`,
  `--status-review`, `--status-done`, `--status-blocked`. Distinct
  from the lane visual tokens (which keep their soft pastel chrome
  for board surfaces); status tokens are for the single-color signals
  (Done DopamineCheck, blocked badge, error states).
- **Springs** — `--spring-snap` (overshoot, for drops + lifts),
  `--spring-soft` (settle, for cards + panels), `--spring-glide`
  (ride, for sweeps + fades), `--ease-out` (default). The v0.2
  `--ease-out-expo` / `--ease-spring` / `--ease-cinema` names alias
  to these so existing motion code is unbroken.
- **Radii** — `--r-1: 4px` through `--r-5: 20px` + `--r-pill: 999px`.
- **Shadow tier** — `--shadow-1` (subtle), `--shadow-2` (mid),
  `--shadow-3` (deep), `--shadow-indigo` (brand-tinted glow). The
  v0.2 `--shadow-sm` / `--shadow-card` / `--shadow-lift` /
  `--shadow-float` alias to the new tier.
- **`.marker` utility** — recreates the design system's
  marker-underline accent on display headlines (a 78%-tall
  highlight-color band behind the highlighted span; not a literal
  text-decoration). Available as `<span className="marker">word</span>`
  inside any heading.
- **`.live-dot` utility** — the green pulsing dot used for "this is
  live right now" status indicators (matches the design system's
  `.hero-meta .pill::before` and `.mark-stage::after` pattern).
- **Tailwind theme bindings** — the new tokens are exposed as
  Tailwind utility classes via `@theme inline` so future code can
  reach for `bg-indigo-600`, `text-ink-900`, `text-status-done`,
  `shadow-3`, `rounded-r-pill`, etc.

### Integration trap caught

The design system's `tokens.css` ends with `a { color: inherit; }`,
which works fine on the standalone design-spec HTML page. But in the
Tasks app's Tailwind setup, that rule is **unlayered**, which puts it
*after* `@layer utilities` in the cascade. Adding it shadowed
`.text-white` on the dark CTA buttons — *"Open the demo,"* *"Open the
live workspace,"* and similar — turning them into solid black
rectangles with invisible text.

Caught at integration via Playwright snapshot: button background
rendered correctly (`bg-ink`) but `getComputedStyle().color` returned
`rgb(24, 24, 27)` despite the `text-white` class being present. The
generated `.text-white { color: var(--color-white); }` rule existed
and `--color-white` resolved to `#fff`, but the unlayered `a { color:
inherit; }` was winning the cascade.

Fix: removed the `a { color: inherit }` rule. Link colors are set
per-callsite via Tailwind utilities (the existing pattern). Added an
in-file comment explaining the trap so future cycles don't re-add it.

### Verified

- `npx tsc --noEmit` clean.
- 11 surfaces probed (all marketing + app views + published workspace
  + template detail) — all 200, 0 console errors.
- Home-page hero rendered with marker-underline visible on
  *"forward."*, both CTA buttons (*"Open the demo"*, *"Open the live
  workspace"*) showing their white text correctly, the wordmark dot
  pulsing as expected.

### What's next

Cycle 29 is Sprint 9 — Google bridges (export-side: Copy as Sheet
CSV, Copy as Markdown, surface iCal subscribe URL more prominently,
"Embed in Google Docs/Sites" how-to page).



## Cycle 26-27 · 2026-05-06 · Full review pass — website + code

Two review cycles, no agents. Architect-only walks across every
public surface and every source file. Five real bugs caught and
fixed mid-review. Two report files written.

### Cycle 26 · website review

41 surfaces probed. Bugs:

1. **Per-template OG URLs were malformed for all 12 templates.**
   `generateImageMetadata` returning 12 entries on a dynamic-segment
   route multiplied the path; every template's `og:image` ended in
   `/opengraph-image/job-application-sprint?…` (the *last* template
   id, the same on every page). Slack/Twitter unfurls have been
   silently broken since cycle 18. Removed `generateImageMetadata` —
   dynamic routes already get one OG per slug from
   `generateStaticParams`. Fix verified; OG URLs are now correctly
   `/templates/{slug}/opengraph-image?{hash}`.

2. **Three OG routes used sync `params: { … }`.** Next.js 16's
   strict-error fired at runtime
   (*"params is a Promise and must be unwrapped"*). Fixed
   `templates/[slug]/opengraph-image.tsx`,
   `p/[slug]/opengraph-image.tsx`, and
   `share-card/[workspaceId]/opengraph-image.tsx` to the
   `Promise<{ … }>` + `await params` shape. The cycle-22 check that
   verified the share-card returned 200 didn't catch the deprecated
   sync pattern; this review did.

3. **Five marketing pages had no `og:image` at all.** `/principles`,
   `/templates` (gallery), `/for/weddings`, `/for/freelancers`,
   `/for/students` defined `metadata.openGraph = { title, description,
   type }` but no `images` and no colocated `opengraph-image.tsx`.
   Next.js doesn't auto-fall-back to root OG when a page sets its own
   `openGraph`. Added `images: ["/opengraph-image"]` to each.

4. **`/about` leaked a `💅` emoji from the wedding domain pack.** The
   wedding domain's `description` in `src/lib/domains.ts` was *"venues
   · vendors · 💅 · run-of-show"*, and `/about` renders the four-pack
   `DomainGrid` verbatim. Replaced `💅` with `vows`. Now consistent
   with the other three packs (all middle-dot-separated word lists).

Environmental note: edge-runtime + Turbopack-dev + ImageResponse
intermittently fails with *"failed to pipe response"* in the dev
environment. Conversion of the templates and root OG to nodejs
runtime (matching cycle-22 + cycle-20 patterns) addresses the most
common failure mode but doesn't eliminate it. Recommend prod-build
validation before launch — the dev-server state isn't conclusive.

Full review report: `docs/website-review.md`.

### Cycle 27 · code review

215 source files, 35,408 LOC, 0 tsc errors. One bug:

5. **`💬` emoji on board card comment count.** In
   `board-app.tsx:702`, the comment count chip rendered as
   *`💬 {count}`*. A single character but a brand-voice violation
   on a surface every active user sees. Replaced with an inline
   11×11 SVG comment-bubble icon.

Audits clean across the board:

- **0** `any` / `as any` / `@ts-ignore` / `@ts-expect-error` /
  `TODO` / `FIXME` in source.
- **0** sync `params: { … }` patterns left.
- **0** `dangerouslySetInnerHTML` in `src/`.
- **0** raw SQL string concatenation — every query uses Drizzle's
  parametrized template tags.
- **12** owner-gated server actions, all verifying role server-side
  before any side-effect work.
- **17** server-only files import `"server-only"`; the one exception
  (`schema.ts`) is correct.
- **All 16** server-action files start with `"use server"`.
- **All 12** dynamic-route handlers use `params: Promise<…>`.
- **32** `console.log/warn/error` calls — all in catch blocks, all
  "log and continue" patterns. Acceptable.
- **14** `eslint-disable` directives — all justified, all paired
  with explanatory comments.

Compile-time schema-vs-client-type contracts hold across `tasks`,
`comments`, `notifications`, `activities`, `compCodes`,
`entitlements`. Schema drift would surface as a tsc error, not a
runtime surprise. Excellent discipline.

Full code review: `docs/code-review.md`.

### Verdict

Production-ready. The four post-sprint backlog items that remain
(Postgres dialect, Sentry source-maps, SSE multi-tab, Lighthouse
pass) all need real-world validation rather than dev-environment
proof. Everything in the dev tree compiles, type-checks, and
behaves the way it claims to. Run `next build && next start` once
before flipping the public DNS — that's the only validation gate
the dev environment can't conclusively pass on its own.



## Cycle 25 · 2026-05-06 · Hardening — webhook idempotency, real invites, subtasks, recurring chip, timeline drag

The hardening cycle. Five backlog items the previous sprint
deliberately punted on (because each was reliability-or-depth work,
not category-defining), now landed in one cycle. Three parallel
agents (subtasks, recurring chip, timeline drag) shipped on their
own file scopes; architect handled the two infrastructural items
(webhook dedup, real invite flow) plus a small `escapeHtml` clash
caught at integration.

### What landed

**Webhook idempotency (architect)**

New `processed_webhooks` table — `event_id` PRIMARY KEY +
`event_type` for the audit log + `processed_at` timestamp. Stripe
re-delivers failed events every 30s for up to 3 days; without
dedup, a re-delivered `checkout.session.completed` would grant a
second entitlement row. The route now `INSERT OR IGNORE`s the event
id at the top of every request — on duplicate, the handler returns
200 + `{ deduped: true }` immediately and Stripe stops retrying.

The check happens before any side-effect work. Stripe's exponential
backoff means a flaky-but-eventually-successful handler still gets
its retry window without re-running successful side effects.

**Real Clerk-backed invite flow (architect)**

`pendingInvites` table + the cycle-17 stub upgraded into the real
flow. `inviteMemberByEmailAction` now mints a 32-char URL-safe
token, INSERTs the pending invite, and sends an HTML email via the
existing Resend integration. Invite reuse: if a pending invite for
the same workspace+email already exists (and isn't expired or
accepted), we re-send the existing token's email rather than
minting a fresh one — the recipient never gets two competing
links.

New `acceptInviteAction(token)` — validates the token isn't
expired or already accepted, checks the user's email matches the
invite's email (case-insensitive), re-checks the member cap at
accept-time (could've changed if the workspace downgraded between
mint + accept), inserts the `workspace_members` row via `INSERT
OR IGNORE`, marks the invite accepted (audit trail), and flips the
`tasks_active_ws` cookie to the joined workspace.

New `/invite/[token]` page — server-renders the invite context
(workspace name, inviter name, recipient email, expiry), shows the
right state for missing / expired / already-accepted tokens, and
gates the accept button on Clerk auth + email match. If the user
isn't signed in, sends them through `/sign-in?redirect_url=...`
back to the invite page. If they're signed in with the wrong
email, says so plainly with a sign-out hint.

New invite email template in `email.ts` — terse, manifesto-voiced
(*"One workspace, every view, the daily digest. Three editing
guests on Free, unlimited members on Team. No card, no trial."*).

**Subtasks (parallel agent)**

`tasks.parent_task_id` (nullable) added to schema. Top-level views
(board / list / timeline / calendar) filter to `parent_task_id IS
NULL` so subtasks live exclusively under their parent in the
detail panel. New `<SubtasksSection>` mounted between the Cents
section and the Conversation feed: header `"SUBTASKS · N of M
done"`, lane-checkbox toggles between `todo` and `done`, click-
title opens the subtask in the same panel (browser back returns
to parent), inline ghost-row composer at the bottom for new
subtasks. Done subtasks render with strikethrough + 60% opacity.

Schema migration via `drizzle-kit push --force`. v1 is intentionally
one level of nesting — no sub-subtasks. Future cycle decides
whether to surface a subtask-count indicator on the parent's card.

**Recurring tasks card UI (parallel agent)**

Tiny `<RecurrenceChip>` reusable component. Renders `↻ daily` /
`↻ weekly` / `↻ monthly` for unit recurrences, `↻ Nd` / `↻ Nw` /
`↻ Nm` when interval > 1. Mounted in the board card meta row + the
list row. Tooltip on hover gives the long form (*"Repeats every 2
weeks"*). Pure presentational — recurrence already lived in the
data model + detail panel; this cycle just makes it visible at a
glance.

Not added to timeline / calendar / showcase in this cycle (out of
scope per the brief; future cycle if surface-need emerges).

**Timeline drag-and-drop reorder (parallel agent)**

The timeline view's bars were read-only before; now they support
two interactions:

1. **Whole-bar drag** (cursor: grab/grabbing) — drags horizontally
   to shift `startDay`. Pointer x → day-delta is rounded for
   whole-day snap; clamps `startDay >= 0` and
   `startDay + durationDays <= 30`.
2. **Right-edge resize** (cursor: ew-resize) — 8px invisible handle
   on the right. Drag to resize `durationDays`. Clamps
   `durationDays >= 1` and the same upper bound.

New `setTaskTimelineAction(taskId, { startDay?, durationDays? })`
in a NEW `src/server/actions/timeline-drag.ts` (kept separate from
`tasks.ts` to avoid collision with the subtasks agent who extended
that file). Server-side clamps to `[0, 30]` / `[1, 30]` with
integer rounding; only writes whichever fields were provided.

Optimistic-UI: dispatch local update via `useTasksDispatch()`,
then fire the server action in `startTransition`. Mobile (<768px)
disables the drag entirely (matches the cycle-14 board-on-mobile
policy). Translucent dashed overlay during the gesture marks the
destination cell. CSS transitions on `left`/`width` give the
release-snap a soft settle; transitions are disabled mid-drag for
instant feedback.

### Architect integration step

Mid-cycle, the subtasks agent flagged a duplicate-`escapeHtml`
warning in `email.ts`. The architect (when adding the invite-email
template) appended a fresh `escapeHtml` near the top, not realizing
one already lived at the bottom of the file. Removed the new
duplicate; left a one-line note where it was.

### Verified

- `npx tsc --noEmit` clean across the merged tree.
- `/invite/test-fake-token` returns 200 with the *"This invite
  link doesn't exist"* state (the page renders correctly even for
  invalid tokens — that's the whole point of server-rendering the
  preview).
- `/app/board`, `/app/timeline`, `/app/settings` all 200.
- Subtasks: schema migration applied, `parent_task_id` column
  present, top-level views correctly filter parented tasks out.
- Webhook idempotency: `processed_webhooks` schema applied; route
  short-circuits on duplicate `event.id`.

### Operational note

Three parallel agents (smaller batch than cycles 18-24) plus
substantial architect work in parallel. The pattern works smaller
just as well as larger — the constraint is file-scope discipline,
not agent count. The invite flow is the most architecturally novel
addition this cycle (new email template, new accept route, new
Clerk-gated client island).

**Sprint parallel-agent throughput so far:** **39 dispatched, 39
complete, 0 broken builds.**

### Subtractions

- The cycle-17 stub `inviteMemberByEmailAction` body. Replaced
  with the real flow (kept the cap-check at the top — that
  behavior carries forward).

### Backlog (still open after cycle 25)

- **Postgres dialect adapter** — needs a real prod DB to validate.
- **Sentry source-map upload on deploy** — deploy-time concern.
- **Multi-tab realtime SSE collisions** — needs prod traffic.
- **Production Lighthouse mobile pass** — needs `next build`.

These four are deliberately deferred until there's a production
deploy to validate against. The dev environment gives no signal
on any of them.

### Next: cycle 26 + 27

Per the user request: cycle 26 is a full website review (every
public surface), cycle 27 is a full code review. Both are
architect-only — no agents.



## Cycle 24 · 2026-05-06 · B-tier delight wave — eight features, sprint close

Phase 7, the last cycle of the category-defining sprint that began
with cycle 17. Eight atomic delight features in one cycle, dispatched
as 4-then-4 parallel-agent batches. All eight shipped voice-matched
on first attempt. One small ⌘K shortcut conflict caught at
integration was resolved by the architect (local palette rebound to
⌘P, the cross-app convention for "open file"; cross-workspace
search keeps ⌘K, the cross-app convention for global quick-switch).

### What landed

**Batch 1 (file-scope-disjoint, dispatched first):**

- **Cents column on tasks** — nullable `cents` integer column,
  type extensions through `Task` + `rowToTask` + `addTaskAction`,
  and a new `<CentsEditor>` in the detail panel between Contact
  and Conversation. Display formats `$1,234.56` via
  `Intl.NumberFormat`; input strips commas / `$` / whitespace
  before parsing. Server-side clamp to `[0, 99_999_999]`. Empty
  input is a no-op (mirrors the contact editor's *"a slip of the
  keyboard shouldn't blow away a $1,200 deposit"* discipline).
  Drizzle-pushed.
- **Cmd-K cross-workspace search** — server action +
  `<CrossWorkspaceSearch>` popover mounted at the app-shell level
  alongside the cycle-22 cross-workspace overdue popover. Single
  SQL query joining workspace memberships → workspaces → tasks
  with `inArray` + `LIKE` on title (LIKE wildcards escaped),
  exact-prefix-first sort, capped at 30 results. 180ms debounce,
  sequence-numbered race guard, ⌘K to toggle (works even from
  inside other inputs — Linear/VSCode behavior). Click a result →
  flips the active-workspace cookie and routes to
  `/app/board?task={id}`.
- **iCal subscribe URL** — `/api/calendar/[workspaceId]` returns a
  proper RFC 5545 ICS feed (`text/calendar; charset=utf-8`) with
  CRLF line endings, line folding, escape rules. Pure-TS helper
  in `src/lib/ical.ts`, no dependencies. All-day branch when
  `dueAt` is at midnight UTC; timed branch with 1-hour DTEND
  otherwise. Subscribe button + popover on the Calendar view
  shows the `webcal://...` URL with a Copy button. Cache headers
  set for the 15–60-minute calendar-client refresh cadence.
- **Focus Mode** — full-screen overlay client component, mounted
  globally. Press `f` while focused on a board task → opens with
  that task's title and a 25-min countdown. `space` pauses,
  `esc` closes. 0:00 doesn't ring a bell — manifesto rule (no
  push notifications, no auto-celebrate). Reads which task is
  focused via `data-task-id` / `data-task-focused="true"`
  attributes added to the Card; falls back to a custom
  `focus-mode:open` window event from the detail panel's Focus
  button. Honors `prefers-reduced-motion`. White background, 144px
  tabular-nums timer, no blinking colon.

**Architect integration step (between batches):**

- ⌘K conflict resolved. The cycle-2-era local command palette
  bound ⌘K; the new cross-workspace search needed it too. Local
  palette rebound to ⌘P (the file-open convention from VSCode,
  Sublime, et al). Sidebar + page-header keyboard hints updated
  from `⌘K` to `⌘P` to match. Cross-workspace search keeps `⌘K`,
  the cross-app convention from Slack, Notion, Linear, GitHub.

**Batch 2 (file-scope-disjoint, dispatched after batch 1
integrated):**

- **Repeat-N-times one-tap** — new `duplicateTaskAction(taskId,
  count, dayStep)` in a NEW `src/server/actions/duplicate-task.ts`
  (kept separate from `tasks.ts` to avoid collision with the cents
  agent who extended it). Detail-panel "Repeat" button opens a
  popover with two number inputs (Count, Days apart) and a live
  helper line *"Will create N copies, last one Mar 12"*. Server
  clamps to `[1, 30]` count and `[1, 90]` dayStep. Inserts in a
  single transaction, formats `due` text per-copy, copies all
  pass-through fields (tags, assignees, contact, cents).
- **Drag-momentum on board** — release-velocity inertial follow-
  through. The board uses native HTML5 drag (cross-lane moves rely
  on `dataTransfer`, not motion's pan), so the agent built a
  pointer-sample buffer that records `{x, y, t}` per `onDrag`,
  computes velocity from the last 80ms window on drop, scales by
  60, clamps to ±100px per axis. The Card animates from that
  initial offset back to `{x: 0, y: 0}` via spring
  `{ stiffness: 250, damping: 28, mass: 0.9 }` — settles in ~350ms
  with a barely-perceptible overshoot. State-wise the card lands
  in exactly one lane; the momentum is purely visual.
  `prefers-reduced-motion` short-circuits to 120ms linear settle.
- **Roll-forward incomplete** — end-of-day "Roll forward N" button
  on the inbox daily-digest header. New
  `src/server/actions/roll-forward.ts`. Server-side overdue
  detection mirrors cycle-22's heuristic (structured `dueAt` <
  end-of-today, falling back to ISO `YYYY-MM-DD` text). Updates
  in a single transaction; advances `dueAt` by 1 day; re-formats
  the human `due` label ("Tomorrow", weekday short within 7 days,
  else ISO). Two-step confirm (mirrors the cycle-16 magic-link
  revoke). Hidden when overdue count is 0.
- **Copy Slack-summary button** — sibling to cycle-22's
  share-this-week PNG button, but copies *text* — a markdown-
  formatted weekly summary (`*This week in {workspace}*`, count
  headline, up to 12 task-title bullets, `+ N more closed`
  overflow row, trailing `Made with Tasks → tasks.app/p/{slug}`).
  Same hidden-textarea + execCommand fallback as the share-card
  button. Hidden when nothing closed this week.

### Verified

- `npx tsc --noEmit` clean across the merged tree (twice — once
  after batch 1, once after batch 2).
- `/app/inbox` renders all three buttons in the daily-digest
  header (share-card, copy-slack, roll-forward) when applicable;
  sidebar Search hint correctly shows `⌘P`. 0 console errors.
- `/app/calendar` shows the new "Subscribe" button top-right; 0
  console errors.
- `/api/calendar/ws-legacy` returns 200 + `text/calendar; charset=
  utf-8` with valid VCALENDAR / VEVENT structure.
- All 5 batch-2 features compile against the cents column added in
  batch 1 (the Repeat-N-times agent correctly forwards the new
  field to copies; no agent collisions despite shared schema).

### Operational note

8 agents in 2 batches of 4 ran cleanly. The biggest concurrent
dispatch ever was 5 (cycle 22); 8 was the test of *whether the
proven pattern scales further with smart batching*. It did, with
two caveats:

1. **Two agents touching the same shared file** (the cents agent +
   the focus-mode agent both extended the detail panel) need
   explicit non-overlapping section briefs. Worked here because
   each agent's brief named the precise location of their addition.
2. **A shared keyboard-shortcut surface** (the local palette's
   ⌘K + the new cross-workspace search's ⌘K) needed an architect
   resolution at integration. Future cycles touching keyboard
   shortcuts should audit existing bindings first; the brief should
   include the project's current shortcut map as context.

### Sprint close — 8 cycles, 8 phases, the category-defining sprint

This cycle closes the sprint that began with the strategic
planning report (cycle 17 prep) and the phased rollout (cycles
17-24). Final phase status:

| Phase | Cycle | What landed |
|---|---|---|
| 1 · Manifesto made real | 17 | `/principles`, 3-editor Free cap, pricing copy honesty |
| 2 wave 1 · Templates SEO | 18 | `/templates/[slug]` × 12, four flagship essays, `/for/weddings` |
| 2 wave 2 · Templates SEO finish | 19 | Eight more essays, `/for/freelancers`, `/for/students` |
| 3 · Publishable workspaces | 20 | `/p/{slug}` + four domain themes |
| 4 · Studio tier | 21 | $14.95/mo operator-tier, layered user-level entitlement |
| 5 · A-tier wave | 22 | iOS share-sheet, ⌘. overdue, share-card PNG, template remix, contact field |
| 6 · Distribution activation | 23 | `.edu` Pro auto-grant, embed widget, Show HN draft, venue drafts |
| 7 · B-tier wave (this cycle) | 24 | Cents, ⌘K search, iCal, Focus, Repeat-N, drag-momentum, roll-forward, Slack-summary |

**Sprint parallel-agent throughput:** **36 dispatched, 36
complete, 0 broken builds.**

What worked across the sprint:

- **File-scope discipline.** Every brief named the files the agent
  could touch and the files they couldn't. Zero file collisions
  across 36 dispatches.
- **In-file trap notes.** When a hard-won lesson was caught at
  integration (Turbopack's nodejs route handlers don't pipe
  ImageResponse cleanly; better-sqlite3 won't load under edge
  runtime), the architect documented the trap *in the file
  itself* so the next agent dispatched into that domain inherits
  the lesson without rediscovering it.
- **Batches of 4 in sequence.** Five agents simultaneously was the
  proven ceiling (cycle 22). Eight in two staggered batches of
  four was the new ceiling and held.
- **Per-cycle voice-match.** Every CHANGELOG entry, every essay,
  every UI copy line was voice-matched on first ship. The wedding
  essay (cycle 18) became the gold-standard reference; every
  agent in cycles 18-24 had it quoted in their brief.

### Subtractions

- The cycle-2-era ⌘K binding on the local command palette
  (rebound to ⌘P; the keystroke now belongs to cross-workspace
  search).

### Backlog (post-sprint, no scheduled cycle)

This is the end of the sprint. The product is in the strongest
shape it's been in. Items the sprint deliberately punted:

- **Postgres dialect adapter** (Phase D's deferred half from
  pre-sprint cycles).
- **Subtasks** (nesting in the conversation feed).
- **Recurring tasks UI affordance on cards** (currently detail-
  panel only).
- **Timeline drag-and-drop reorder** (resize bars, drag startDay).
- **Production Lighthouse mobile pass** (≥90 target).
- **Real Clerk-backed `inviteMemberByEmailAction`** (the stub from
  cycle 17 still inherits the cents-cycle cap; needs the real
  invite-token + Resend + accept-flow plumbing).
- **Multi-tab realtime SSE collisions** (long-standing).
- **Webhook idempotency** (`processed_webhooks` table for Stripe
  re-deliveries).
- **Sentry source-map upload on deploy.**

These are real but not category-defining. The next phase of the
product is *outbound* — Show HN draft is in `docs/show-hn.md`,
syndication playbook in `docs/syndication.md`, three Gmail venue
drafts saved (Villa, Moss Denver, Pocketbook Hudson), two more
templated for the user to populate. The product can carry itself
from here.



## Cycle 23 · 2026-05-06 · Distribution activation — .edu Pro, embed widget, Show HN, venue outreach

Phase 6 of the category-defining sprint. Less code than the prior
cycles, more posting and partnerships — by design. Most of this
cycle is writing and outreach: a Show HN draft, a syndication
playbook, five wedding-venue partnership emails. The two pieces of
real engineering — `.edu` Pro auto-grant and the embed widget —
landed clean.

**`.edu` Pro auto-grant (architect)**

The Clerk webhook on `user.created` now checks the user's primary
email. If it ends in `.edu`, we grant Pro for 120 days
(*"long enough to cover a single semester (~16 weeks) plus a buffer
for the post-semester wrap-up; shorter than a year so the student
renews intentionally"*). The entitlement is user-level
(`workspaceId = NULL`) so the Phase 4 layered-resolution path picks
it up across every workspace the student creates without per-
workspace bookkeeping.

The grant runs *outside* the user-creation transaction. A failure
here shouldn't roll back user creation — worst case the
entitlement is missed and the student redeems manually via
`/redeem`. Logged + continued, not thrown.

`/students` page copy updated. Was: *"Verify a .edu address."* Now:
*"Sign up with your .edu address and Pro lands automatically."* A
small green chip below the headline reads *"Auto-applied at signup
· 120-day Pro"*. The legacy redemption form stays for the rare
cases the auto-grant missed.

**Embed widget (parallel agent + architect hydration fix)**

A blogger or Notion user can drop a `<script src="tasks.app/embed.js">`
tag on their page; a compact read-only Tasks workspace appears
inline. Two pieces:

1. **`/embed/{slug}`** — a server-rendered iframeable route. Bare
   layout (no SiteNav, no SiteFooter, no app shell). Compact
   lane-grouped task list with a small chip header
   (`{name} · published {date}`), lanes capped at 6 tasks with
   *"+ N more"* overflow, and a tiny "Made with Tasks" link that
   opens `/p/{slug}` in a new tab.
2. **`/embed.js`** — Route Handler returning a 1.1 KB IIFE.
   Finds `[data-tasks-workspace]` elements on the host page and
   injects sandboxed iframes pointing at the embed route.
   Idempotent (skips if iframe already exists). Reads
   `data-tasks-width` / `data-tasks-height` overrides. Cached one
   hour on the browser, one day at the edge.

Hydration fix at integration: agent's first draft scoped the
embed layout's body styles to a `body.tasks-embed` selector + a
client-side script that added the class. Resulted in a hydration
mismatch warning (server body className didn't match the post-
hydration one). Architect re-scoped the styles to the
server-rendered `.tasks-embed-root` div instead, dropped the
inline script. Console clean afterward.

**Show HN post draft (architect)**

`docs/show-hn.md` ships the post body, three title alternates,
posting checklist, and a first-90-minutes comment plan covering
the predictable questions ("Won't per-workspace pricing lose
money on big teams?", "Why no Gantt?", "How is this different
from Notion?", "Will you build SSO?", "Where's the catch on
free?"). Each with one specific anecdote ready, not canned copy.
Time the post for Tuesday morning, 9–10am ET.

**CHANGELOG syndication playbook (architect)**

`docs/syndication.md` ships two templates — an HN-style post
("how we shipped 5 features in one cycle with parallel sub-
agents") and an IH-style post ("why we charge per workspace, not
per seat — and the math behind it"). Cadence: one channel per
cycle, alternating, Friday 9–10am ET. The angle is *"how we
ship,"* not *"what we shipped."* HN responds to operating notes;
IH responds to commercial honesty.

**Wedding venue partnership outreach (architect + Gmail MCP)**

One real Gmail draft saved via the MCP — to **The Villa**
(Virginia Beach, `info@thevillava.com`). One paragraph, one
specific personalized opener, one CTA: reply with how many bulk
codes the venue wants. *"If it's not, no follow-up — I won't
email again."* No automated send.

Four more drafts templated in `docs/venue-outreach.md` for **Lamb's
Hill** (Hudson Valley), **The Abbey Inn & Spa** (Hudson River
Valley), **Moss Denver** (Denver), and **Pocketbook Hudson**
(Hudson Valley) — each with a venue-specific opener line tied to
the venue's actual character. The user looks up each contact email
(most venues hide them behind contact forms) and either copies the
draft into Gmail directly or saves a fresh Gmail draft with the
right `to:` address. A tracking table is included for reply rates,
code-redemption rates, and couple-side conversion.

The cadence rule: no more than 5 venues per week. Personalized
openers matter. *"The line that names something specific about
their venue is the difference between a 5% reply rate and a 25%
reply rate."*

**Verified**

- `npx tsc --noEmit` clean across the merged tree.
- `/embed.js` returns 200 + `application/javascript; charset=utf-8`
  + the IIFE body. Cache headers correct.
- `/embed/legacy` returns 200, renders the compact lane-grouped
  task list, *"Made with Tasks"* link present. 0 console errors
  after the hydration fix.
- `/students` renders the new auto-grant chip below the headline.
- One Gmail draft saved (Villa, `info@thevillava.com`) — visible
  in the Gmail drafts list.
- `docs/show-hn.md`, `docs/syndication.md`, `docs/venue-outreach.md`
  all written.

**Sprint parallel-agent throughput:** 28 dispatched, 28 complete,
0 broken builds.

**Subtractions**

- The agent's first-draft hydration script in
  `src/app/embed/[slug]/layout.tsx` (replaced with a
  scoped-to-div pattern).

**Backlog (next — sprint Phase 7: B-tier delight wave)**

- Repeat-this-task-N-times one-tap (daily standups, 7-day
  countdowns)
- Focus Mode (one task full-screen + timer)
- Cents column for invoice / vendor totals
- Drag-momentum on the board (release-flick physics, lane snap)
- Cmd-K cross-workspace search
- Roll-forward incomplete (end-of-day one-click sweep)
- iCal subscribe URL per calendar view
- "Closed this week" auto-card / Slack drop, opt-in per workspace
- Eight features, parallel-agent dispatch.



## Cycle 22 · 2026-05-06 · A-tier wave — five features in one cycle, parallel-agent dispatch

Phase 5 of the category-defining sprint. Five ship-in-a-day features,
non-overlapping file scopes, all dispatched as parallel agents. The
operating loop's biggest stress test so far — five agents at once vs.
the proven four — and it held. All five shipped voice-matched on
first attempt. One small Turbopack edge case caught at integration
required an architect fix, documented below.

**Five surfaces, one cycle**

1. **iOS share-sheet capture (PWA share target)** — agent 1.
   `public/manifest.webmanifest` declares Tasks as a `share_target`
   (GET, `?title=…&url=…&text=…`). `/share-target` route receives the
   shared selection, opens a quick-add modal pre-filled with the
   title plus em-dashed URL. Save fires `addTaskAction` and routes
   to `/app/board?from=share`. Headline: *"Save what you saw."*
   Subhead names what got captured. Cmd/Ctrl+Enter and bare Enter
   both submit. Manifest also bootstraps the rest of PWA basics —
   name, theme color, start URL, standalone display — so adding to
   the home screen on iOS gets the right chrome.

2. **Cross-workspace overdue command (`⌘.`)** — agent 2.
   Global keyboard listener mounted at the app-shell level (next to
   `<TaskDetailPanel />` in `src/app/app/layout.tsx`), skipping
   when focus is inside an input/textarea/contenteditable so the
   existing `c` quick-create still owns its keystrokes. Toggles a
   440px top-right popover.
   `getOverdueAcrossWorkspacesAction` joins `workspace_members`
   against `workspaces`, pulls non-`done` tasks across all
   memberships in one query, applies the overdue heuristic in JS
   (prefer structured `tasks.dueAt`; fall back to ISO-format
   `tasks.due` text). Items grouped by workspace, sorted most-
   overdue-first, click flips the active-workspace cookie via
   `selectWorkspaceAction` and routes to `/app/board`. Empty state:
   *"Nothing's late. The rare clean inbox."* Hint: *"⌘. to toggle ·
   esc to close"*.

3. **Share-card PNG from the daily digest** — agent 3 + architect
   integration fix.
   `/share-card/[workspaceId]/opengraph-image` is the URL. 1200×630
   PNG: brand glow, dot-emit wordmark, large count + "tasks closed
   this week" + workspace name + `tasks.app/p/{slug}` + "Made with
   Tasks". Count mirrors the rule from `buildWeeklySnapshot` so the
   number on the card matches the inbox recap. Inbox digest gains a
   "Share this week" button (rendered only when `closedThisWeek > 0`)
   that copies the URL to the clipboard and pops a *"Link copied —
   drop it in Slack"* toast.

   *Integration fix:* Agent originally shipped this as a Route
   Handler at `/api/share-card/[workspaceId]/route.tsx`. Under
   Turbopack + Next.js 16's nodejs runtime, Route Handlers fail to
   pipe `next/og`'s streaming Response (errors with *"failed to pipe
   response"*). The OG-image file convention handles the wrapping
   for free; architect moved the file to
   `share-card/[workspaceId]/opengraph-image.tsx` (default export),
   updated the share button URL, deleted the old route. Documented
   the trap in the new file's preamble so future cycles don't
   re-step. Visual was also conservatively re-flowed off the proven
   `/p/[slug]/opengraph-image.tsx` shape after a separate render-
   pipe failure on the heavier original layout — same lesson, same
   file.

4. **Template remix** — agent 4.
   `remixTemplateAction(templateId)` spins up a fresh workspace
   named `"{template name} · my remix"`, owned by the current user,
   slugged via `reserveUniqueSlug` (template-name slug + `-my-remix-`
   + 4-char random suffix, retried up to 8 times on collision).
   Inserts the workspace + a `workspaceMembers` row with role
   `owner`, applies the template's tasks at lane positions starting
   at 1.0 stepping by 1.0 (no MAX query needed — the workspace is
   empty), records taskAdd activities, sets the active-workspace
   cookie to the new id, redirects to
   `/app/board?remixed={templateId}`. The existing
   `applyTemplateAction` is untouched — the two paths live side by
   side. `/templates/[slug]` hero CTA row now shows both buttons
   (primary "Use this template" + secondary "Remix in a new
   workspace"); footer-card CTA row mirrors. New fork glyph for the
   secondary — two branches diverging from a trunk, reads as "make
   your own copy" without the literal Y shape.

5. **External contact field on tasks** — agent 5.
   Two new nullable columns on `tasks`: `external_contact_name`,
   `external_contact_email`. Drizzle-pushed to the dev DB. `Task`
   type extends with both as `string | null`; row-mapper
   passes-through; `addTaskAction` accepts the optional fields;
   `updateTaskAction` already accepted `Partial<Task>` so the new
   fields flow through without a signature change. New
   `<ContactEditor>` in the detail panel renders a quiet
   `+ Add contact` chip when empty, or `Name · email` when present;
   click opens a popover with name + email inputs (Save / Cancel /
   Remove). Optimistic-UI through the existing
   `useTasksDispatch().updateTask` path so the panel feels instant.
   Absorbs the wedding-vendor / freelance-invoice spreadsheet column
   in one move.

**Operational note**

Five parallel-agent dispatches at once. The cycle 16 rate-limit
issue didn't repeat. Schema-touching agent (5) ran the
`drizzle-kit push --force` itself; no race with the others (only one
agent edited `schema.ts`). Total dispatch time: ~10 minutes
wall-clock for all five to come back.

The Turbopack/ImageResponse trap caught at integration cost about 15
minutes of architect debugging — moved the share-card file from
Route Handler to OG image convention, conservatively re-flowed the
JSX off the proven `/p/` shape. Documented in-file so the next
agent dispatched into edge-runtime or OG territory inherits the
lesson.

**Sprint parallel-agent throughput:** 27 dispatched, 27 complete, 0
broken builds.

**Verified**

- `npx tsc --noEmit` clean across the merged tree.
- `/share-target?title=…&url=…` renders the quick-add modal with
  the textarea pre-filled correctly. 0 console errors.
- `/share-card/ws-legacy/opengraph-image` returns 200 + `image/png`
  + ~20 KB.
- `/templates/wedding-3-month-countdown` renders both apply + remix
  buttons in the hero and footer CTA rows.
- `/app/board` returns 200; the `<CrossWorkspaceOverdue>` popover
  is mounted globally at the app-layout level. Detail-panel
  `<ContactEditor>` renders between Description and Conversation.
- `getEffectiveTier` + studio entitlement layering still works
  (regression sample): no Phase 4 surfaces broke.

**Subtractions**

- `src/app/api/share-card/[workspaceId]/route.tsx` — superseded by
  `src/app/share-card/[workspaceId]/opengraph-image.tsx`.

**Backlog (next — sprint Phase 6: Distribution activation)**

- `.edu` Pro-for-semester gating wired into Clerk webhook.
- Embed widget — `<script>` tag that renders a read-only task list
  inline on indie blogs / Notion pages. Reuses `/p/{slug}` rendering.
- Show HN draft + post (manifesto angle, not feature-list).
- Wedding venue partnership outreach — drafted via the Gmail MCP
  loaded into the session, sent only after user review.
- CHANGELOG syndication — cross-post latest cycles to HN/IH on
  Friday cadence.



## Cycle 21 · 2026-05-06 · Studio tier — operator pricing for the multi-client leak

Phase 4 of the category-defining sprint. The cycle 17 manifesto-pass
flagged a real pricing leak: a freelance dev with five clients on
Team would pay 5 × $9.95 a month for what's structurally one
operator's work, and a wedding planner running ten weddings would
pay $79 ten times to use the same product they already know. Both
audiences would either bounce or downgrade to Pro and lose Team
features. **Studio** is the operator-tier fix: $14.95 a month,
unlimited workspaces you own as sole admin, full Team capabilities
on every one. This cycle lands it without breaking the
per-workspace promise the four-up shelf is built on.

**Architectural call · Studio is per-user, layered server-side**

The cleanest model — and the one that survives every future
workspace creation without bookkeeping — is to grant Studio as a
*single user-level entitlement row* (`workspaceId = NULL`), and
have `getEffectiveTier` and `getWorkspaceTier` layer that user-
level entitlement on top of their existing per-workspace queries.
No bulk INSERTs at purchase time. No cleanup INSERTs when a new
workspace is created. No DELETEs on cancellation — the existing
`expiresAt` mechanic handles that. One row, two query updates,
done.

`TIER_RANK[studio] === TIER_RANK[team] === 2`. They unlock the same
features; they just have different scope. `tierMeetsMinimum`
naturally treats them as equivalent without any branch in the
gating code.

**Type system + entitlement resolution (architect)**

- `EntitlementTier` in `lib/data.ts` extends to
  `"free" | "pro" | "team" | "studio" | "wedding"`. Documented
  inline so the rank-equality with `team` is discoverable.
- `PaidTier` in `server/stripe.ts` extends to include `studio`,
  reading `STRIPE_PRICE_STUDIO_MONTHLY` from env.
- `getEffectiveTier(user, workspace)` in
  `server/db/entitlements.ts` now matches per-workspace OR
  user-level (`workspaceId IS NULL`) entitlements in a single OR
  query, picking the highest rank.
- `getWorkspaceTier(workspaceId)` in `server/db/membership.ts` runs
  two queries in parallel — per-workspace entitlements + a
  workspace-owner-Studio join — and unions the rows. Member-cap
  resolution gets Studio's unlimited-members capacity for free
  through `isUnlimited = team || studio || wedding`.

**Stripe + webhook plumbing (architect)**

`createCheckoutSessionAction` checks `tier === "studio"` and scopes
the entitlement to `null` instead of the active workspace. Stripe
metadata can't carry null, so the `"*"` sentinel is encoded in the
metadata payload and decoded in the webhook. `grantEntitlement`'s
signature widens to `workspaceId: string | null` (the DB column was
already nullable) so the contract declares scope intent
explicitly. Webhook on both `checkout.session.completed` and
`customer.subscription.updated` decodes the sentinel, with a
guardrail that rejects `null` workspaceId for any tier that isn't
Studio.

`STRIPE_PRICE_STUDIO_MONTHLY` is a new required env var for prod;
dev path (no Stripe keys) writes the entitlement directly via the
existing `dev:no-stripe` short-circuit.

**Pricing page (architect)**

A separate `<StudioPanel>` band ships below the main four-up grid.
Visually distinct from the primary tier shelf — gradient
background, "FOR OPERATORS" pill, $14.95 price in 42px, Studio
title, the four-line "what you actually get" feature list, the
"Start Studio" CTA. The four-up shelf above stays exactly as it
was — Solo / Pro / Team / Wedding — so the primary visual
hierarchy doesn't fragment.

New FAQ entry — *"Why Studio?"* — explains the freelance multi-
client and wedding-planner use cases in plain English and frames
the choice: operator running multiple workspaces under one roof =
Studio; team in a single workspace = stay on Team.

**Settings billing tab (architect)**

`BillingSection`'s `TIER_META` array gains a Studio entry so the
header banner reads *"Studio · Team-equivalent across every
workspace you own."* instead of falling through to the Free
default. `TIER_RANK` and `TierBadge` styles also extended to
include Studio. The redeem-result card's `TIER_LABEL` map gains a
Studio entry too. Three small spreads of the new tier through the
existing surfaces; nothing structural.

**Verified**

- `npx tsc --noEmit` clean across the merged tree.
- `/pricing` renders all 5 tiers — four-up shelf intact, Studio
  side-panel below with correct copy, "Why Studio?" FAQ entry
  visible, footer + nav unchanged.
- End-to-end Studio resolution test (dev DB):
  1. Wiped per-workspace entitlements on `ws-legacy`.
  2. Inserted a single user-level entitlement
     `{ user_id: 'david', workspace_id: NULL, tier: 'studio' }`.
  3. `/app/settings` Billing tab loaded showing
     *"Studio · Team-equivalent across every workspace you own"*
     in the header banner, with the Studio card highlighted as
     "YOU" in the tier grid. Confirms the layered query in
     `getEffectiveTier` correctly resolves user-level Studio
     across the active workspace.
  4. Restored the wedding entitlement after.
- `/changelog` route + sitemap still 200; no regressions.

**Subtractions**

- *None this cycle.*

**Backlog (next — sprint Phase 5: A-tier wave)**

- iOS share-sheet capture (PWA share target → quick-add modal).
- Cross-workspace overdue command (`⌘.`).
- Daily-digest share-card PNG (auto-generated 1200×630 image).
- Template remix (duplicate any template into a personal copy;
  publish flips visibility).
- External contact field on tasks (vendor / invoice / etc.).
- Five features in one cycle, parallel-agent dispatch.



## Cycle 20 · 2026-05-06 · Publishable workspaces — /p/{slug} ships with four domain themes

Phase 3 of the category-defining sprint. Until this cycle, a shared
workspace looked like the app, behind a magic-link wall. As of now,
any owner can flip a switch and the workspace renders publicly at
`/p/{slug}` — branded by domain pack, beautiful enough to share with
vendors, clients, classmates, or readers. The SEO foundation Phase 2
laid down (twelve template URLs, three vertical landings) gets its
virality complement: every published workspace ends with a "Made
with Tasks · pick this template free" CTA pointing back to the
matching `/templates/[slug]`. The loop closes.

**Schema · `workspaces.publishedAt` (architect)**

One nullable timestamp column. Null = private (the existing default).
Non-null = the workspace is publicly readable at its slug since that
moment. The existing `slug` column doubles as the public URL
identifier — no separate `publicSlug` introduced, because slugs are
already URL-safe and unique. `drizzle-kit push --force` migrated the
column with the dev seed in place.

**Server actions + queries (architect)**

- `publishWorkspaceAction` — owner-gated, sets `publishedAt = now`,
  returns the slug. Revalidates `/p/{slug}` so the freshly-published
  page is reachable without a cold cache.
- `unpublishWorkspaceAction` — owner-gated, sets `publishedAt =
  null`. The route 404s afterward.
- `getPublishedWorkspaceBySlug(slug)` in `queries.ts` — returns
  workspace + tasks if `publishedAt != null`, otherwise null. The
  null return is the route's 404 signal.
- `getWorkspacePublishState(workspaceId)` — lightweight read for the
  Settings UI.

**`/p/[slug]` public route (architect)**

`src/app/p/[slug]/page.tsx`. Server-rendered. Resolves via the query
helper above; calls `notFound()` for unknown-or-unpublished slugs.
`generateMetadata` builds title + description from the workspace name
and domain label. The whole page body is owned by the picked domain
theme — no shared chrome above, no SiteNav, no app-feel. The shared
`<PublishedFooter>` always renders after the theme, regardless of
which.

**Theme contract (architect)**

`PublishedWorkspaceProps` defined in `src/components/published/types.ts`.
Each theme is a server component receiving `{ workspace, tasks }` and
owns the full `<main>`-level body. The dispatcher in
`published-workspace.tsx` picks based on `workspace.activeDomain` —
falling back to a clean default theme when the workspace's domain
isn't one of the four. The `<PublishedFooter>` (also architect) is
the only piece of structure all themes share: it renders the "Made
with Tasks" CTA, picking the matching `/templates/[slug]` from a
per-domain map (wedding → wedding-3-month-countdown,
marketing → product-launch, freelance → new-client-onboarding,
student → final-paper-sprint).

**Four domain themes · parallel agents**

Four sub-agents, four files, all dispatched simultaneously, all
voice-matched on first ship. Each radically reskins the same data
into a completely different visual register.

- **Wedding** (`wedding-theme.tsx`) — ivory page (#fbf8f3), serif
  display heading, blush-and-leaves floral rules in the hero, italic
  serif lane labels re-voiced as "Still to plan / Underway /
  Awaiting blessing / Settled". Tasks render as elegant rose-bordered
  white cards with italic priority labels and pill tags. Reads like
  a save-the-date page, not a kanban.
- **Freelance** (`freelance-theme.tsx`) — off-white paper (#f8f7f4),
  Geist Mono throughout. Hero opens with `// project · spec`, the
  workspace name styled as a code-comment header, a `v0.{N} ·
  published YYYY-MM-DD` version stamp, and a four-up mono field
  grid (slug / scope / lanes / status). Lane labels styled as
  `## 01 · TO DO`. Tasks render as monospace rows with `[ ]` /
  `[x]` ASCII checkboxes and `[tagname]` square-bracketed tags.
  Closes with an `— end of document —` EOF marker. Reads like a
  GitHub spec.
- **Student** (`student-theme.tsx`) — warm legal-pad cream
  (#fdf9eb) layered with a 28px pale-blue ruled-line gradient and
  a single pink margin rule down the left. Hero has a "STUDY GROUP"
  highlighter chip, large serif title rotated -0.4deg, italic meta
  line. Lane labels rendered as marker-style headings with
  highlighter underlines, re-voiced as "still ahead / this week /
  looking over / wrapped". Tasks render as sticky-note cards (per-
  lane pastel palette: yellow / blue / pink / green) with tape
  strips at the top and slight per-card tilts. Done tasks get a
  strikethrough + faded opacity. Reads like a photographed
  bulletin board.
- **Marketing** (`marketing-theme.tsx`) — pure white, narrow
  editorial column at 760px. Hero has a brand-purple "BRIEF" /
  "ROADMAP" / "PLAN" / "LAUNCH" eyebrow chip (deterministically
  picked from the workspace name), a clean sans-serif display
  heading, and a `Published YYYY-MM-DD · N tasks` masthead meta.
  Lane labels in small-caps with a brand-purple dot on the active
  lane (first non-empty), the rest in their canonical lane colors.
  Tasks render as thin-divider rows, no card backgrounds, P3
  priority hidden. Closes with an "End of brief" centered small-
  caps mark. Reads like Stripe Press / Linear changelog.

The four themes share zero direct visual code. The dispatcher hands
the same data to each; what comes out is unrecognizable across
themes.

**Settings publish toggle (architect)**

`src/components/app/settings/sections/workspace.tsx` gains a "Publish
to the web" block above the existing Identity section. Two states:

- *Private:* "This workspace is private. Only members can see it."
  + a "Publish workspace" button (owner-only, disabled otherwise).
- *Published:* a green "Published {date}" status pill, the
  `/p/{slug}` URL in a copy-able code block, plus three buttons —
  Copy link (with copied-confirmation), Open (in a new tab), and
  Unpublish (rose-tinted, immediate).

`SettingsWorkspace` type extended with `publishedAt`. Settings page
threads it through.

**OG card per published workspace (architect)**

`src/app/p/[slug]/opengraph-image.tsx`. Edge runtime. Single visual
treatment across all domains — themes are for the page, not the
unfurl. Wordmark + domain-pack chip (brand purple) + workspace name
(76px) + task count + URL in the masthead. Falls back to a clean
"Not found" card for unpublished or unknown slugs.

**Verified**

- `npx tsc --noEmit` clean across the merged tree.
- All four domain themes verified at `/p/legacy` by SQL-swapping
  `active_domain` between `student`, `wedding`, `freelance`, and
  `marketing`. Each rendered with 0 console errors and visibly
  different visual treatments. Restored `active_domain = student`
  after.
- Settings → Workspace tab renders the publish block with the
  correct state (Published 6 May 2026, `/p/legacy` URL, Copy link /
  Open / Unpublish buttons).
- Per-workspace OG card route compiles and is reachable at
  `/p/legacy/opengraph-image`.

**Operational note**

Four parallel theme agents shipped four radically different visual
treatments on first attempt. Voice-on-tone-on across all four —
each agent's output reads like the same brand wrote it, just for a
different audience. **Sprint parallel-agent throughput: 22
dispatched, 22 complete, 0 broken builds.**

**Subtractions**

- *None this cycle.*

**Backlog (sprint Phase 4 next)**

- Studio tier ($14.95/mo, unlimited self-owned workspaces). Plugs
  the freelance multi-client and wedding-planner pricing leaks
  flagged earlier.
- Phase 5 — atomic A-tier wave (iOS share-sheet capture, cross-
  workspace overdue command, share-card PNG, template remix,
  external contact field).
- Phase 6 — distribution activation (Show HN, .edu verification,
  embed widget, venue partnership outreach).
- Phase 7 — B-tier delight wave (drag momentum, focus mode, cents
  column, etc.).



## Cycle 19 · 2026-05-06 · Templates as distribution — wave 2 finishes the SEO surface

Phase 2 wave 2. Cycle 18 shipped the route + four flagship essays;
this cycle finishes the other eight, plus two more vertical landings.
All twelve `/templates/[slug]` URLs now render long-form, manifesto-
voiced copy. All three top-of-funnel ICP landings (`/for/weddings`,
`/for/freelancers`, `/for/students`) are live. Pure parallel-agent
throughput cycle: eight essays in two batches of four, both
batches voice-matched on first ship, no rewrites.

**Eight essays · two batches of four**

The dispatch pattern from cycle 18 held. Wave 1's wedding-3-month
essay continued to serve as the gold-standard reference; each new
agent received the same brief structure (target template, SERP query,
voice rules, the gold-standard quoted, instructions to read the SERP
graveyard before drafting).

*Batch 1:*

- **`wedding-day-of-run-of-show`** — *"Wedding Day Timeline Template
  — Minute-by-Minute Run of Show."* Heroline: *"A wedding runs on
  schedule or it runs on the maid of honor."* Hammers all 10 anchor
  times (8 AM hair, 11 AM first looks, 3 PM ceremony, 11 PM
  send-off). Frames the choice as *written-by-Thursday vs.
  improvised-by-MOH*.
- **`midterm-week`** — *"Midterm study plan — a week-of checklist
  that actually works."* Heroline: *"The difference between a B and
  a B+ on a midterm isn't an extra hour of studying."* Lands
  immediately on the high-yield sleep + breakfast tasks every
  competitor checklist quietly skips.
- **`new-client-onboarding`** — *"Freelance Client Onboarding
  Checklist — Free Template."* Heroline: *"The first week is when a
  freelance engagement is actually priced."* Frames kickoff doc and
  contract not as paranoia but as the alignment artifact for the
  week-six call where someone says *"I assumed that was included."*
- **`product-launch`** — *"SaaS Product Launch Checklist."*
  Heroline: *"Launches don't fail at the press list. They fail at
  the positioning doc."* Walks specifically the seam-failures —
  landing page vs. email dissonance, Sunday-night hero-video cut,
  unsegmented blast burning the warm list.

*Batch 2:*

- **`apartment-move`** — *"Apartment Move Checklist — 30 Days Out."*
  Heroline: *"Most people lose their deposit on move-out day. The
  damage was done weeks earlier."* Centers the move-in photos and
  date-shifted utility cancellation as the boring tasks that pay for
  themselves.
- **`trip-planning`** — *"Trip Planning Checklist."* Heroline:
  *"Trips don't get ruined at the destination. They get ruined at
  the gate."* Opens on the Schengen six-month passport rule as the
  concrete failure mode.
- **`job-application-sprint`** — *"Job Application Checklist."*
  Heroline: *"The resume isn't why you're not getting callbacks."*
  Argues the load-bearing task is outreach (5 actual emails, not
  LinkedIn connection requests), with behavioral-practice-out-loud
  as the second pillar most checklists treat as decorative.
- **`conference-booth-prep`** — *"Conference Booth Checklist —
  SaaS Trade Show Template."* Heroline: *"The booth doesn't convert
  at the booth."* Locates the actual revenue in the 48-hour
  post-show follow-up window most teams blow.

Voice held across all eight. Same pattern in every essay: declarative
heroline that names the failure mode, intro hook that opens on a
specific concrete moment, *"what's in this template"* section
grounded in the actual tasks, *"why a workspace, not [alternative]"*
pitch, observational closer. No agent needed a rewrite.

**Two more vertical landings**

- **`/for/freelancers`** — *"Five clients, one inbox."* Teal
  eyebrow + highlight. Anchors on `new-client-onboarding` +
  `tax-season` templates. Calls out the multi-client pricing
  honest-math (Pro $4.99/mo unlimited workspaces; Studio tier —
  the freelance multi-client absorber on Phase 4's roadmap —
  acknowledged as upcoming, not pretended-to-already-exist).
- **`/for/students`** — *"The semester in one place."* Amber
  eyebrow + highlight. Anchors on `final-paper-sprint` +
  `midterm-week`. Distinct from `/students` (action page for
  `.edu` Pro signup); this page is top-of-funnel SEO, links to
  `/students` for the offer at the bottom.

The three vertical landings (`/for/weddings`, `/for/freelancers`,
`/for/students`) now share a coherent visual system: same single-
column 820px layout, same eyebrow-pill chrome, each with a distinct
brand color (rose-pink, teal, amber) keyed to the ICP. New cycles
won't need to re-derive the pattern.

**Sitemap + footer**

`sitemap.ts` now includes the two new vertical landings at priority
0.8 each. Footer Resources column gains "For freelancers" and "For
students" entries — five of the six rows are now real links;
"Contact" remains a placeholder pending a contact route.

**Verified**

- `npx tsc --noEmit` clean across the merged tree.
- All 8 newly-essayed `/templates/[slug]` URLs render rich content
  with the same skeleton as wave 1. Sample-tested
  `wedding-day-of-run-of-show` (full essay, lane-grouped task
  preview, related strip, 0 console errors).
- `/for/freelancers` rendered with teal eyebrow + *"Five clients,
  one inbox."* H1 with the highlight on "one inbox," intro
  paragraph + template anchors visible. 0 console errors.
- `/for/students` rendered with amber eyebrow + *"The semester in
  one place."* H1, intro + template anchors visible. 0 console
  errors.
- `/sitemap.xml` returns 200; verified the two new vertical
  landings emit alongside the 12 template URLs.

**Operational note**

Two batches × four agents = eight parallel-agent dispatches in one
cycle, plus the two vertical landings authored by the architect
session in parallel. All eight agents shipped voice-matched copy on
first attempt, all under their respective time budgets, no rate-
limit failures (cycle 16's tap-out problem didn't repeat — staggering
into 4-then-4 batches kept under whatever ceiling that was). Total
parallel-agent throughput across the sprint so far: **18 dispatched,
18 complete, 0 broken builds.**

**Subtractions**

- Footer "Brand" placeholder (already removed cycle 18 — no further
  removals this cycle).

**Backlog (next cycle — sprint Phase 3)**

- `/p/{slug}` publishable read-only workspace renders, per-domain
  themes (florals on wedding, code-on-paper on freelance, marker on
  student, editorial on marketing). Reuses magic-link auth path; no
  new infra. The CTA footer on every published page links to the
  matching `/templates/[slug]` — closes the SEO ↔ virality loop
  this sprint set up.
- Phase 4 (Studio tier) and Phase 5 (atomic A-tier wave) sit
  downstream of Phase 3.



## Cycle 18 · 2026-05-06 · Templates as distribution — /templates/[slug] × 12, four essays, /for/weddings

Phase 2 wave 1 of the category-defining sprint. The premise: every
template is a search query someone is typing into Google right now.
*"Wedding 3-month checklist."* *"Freelancer tax season."* *"Final
paper outline."* *"Self-review template."* The current `/templates`
gallery served twelve cards on one URL; this cycle splits it into
twelve URLs, each a destination page, each targeting a long-tail SERP
query. The data layer was already declarative — the job was the route,
the essays, and the metadata.

**`/templates/[slug]` · twelve destinations (architect)**

A new dynamic route at `src/app/templates/[slug]/page.tsx`. Server-
rendered for indexing — the apply CTA is the only client island
(`<ApplyTemplateButton>`). `generateStaticParams` enumerates every
template id at build time, so all twelve URLs prerender. `dynamicParams =
false` — unknown slugs 404, the route is a closed set. `generateMetadata`
pulls per-template `seoTitle` + `seoDescription` from the essay if one
exists, falls back to template name + description otherwise.

The render component (`src/components/marketing/template-detail.tsx`)
has two modes baked in. *Rich:* template has an entry in
`TEMPLATE_ESSAYS`, renders the manifesto-voiced long-form copy with H1
heroline, intro hook, lane-grouped task preview, three-to-four h2
sections, closing card with custom closer, and a "Related templates"
strip. *Light:* no essay yet, falls back to a generic heroline
("{template name} — a drop-in task list.") and the template's own
description as intro. Same skeleton, lighter content. All twelve slugs
work day-one; waves 2 and 3 fill in the remaining eight essays without
touching anything else.

**Four SEO essays · parallel agent dispatch**

Four 250–470-word essays in CHANGELOG voice, one per ICP, each
targeting a long-tail SERP query. The architect wrote the wedding
gold-standard (*"Three months out is when wedding planning gets
real."*); three sub-agents wrote the rest in parallel, given the gold
standard as a tone reference plus instructions to read the SERP
graveyard before drafting.

- **`wedding-3-month-countdown`** — *"Wedding 3-Month Checklist — Free,
  No Signup."* The 90-day window where vendors get slow and the math
  gets real. RSVPs, marriage license, welcome bags. Three sections.
- **`final-paper-sprint`** — *"Final paper checklist — the sprint
  plan that beats the 4am panic."* "A paper is six different jobs in
  a trench coat" — the load-bearing line. Sections walk through why
  most checklists fail (order matters more than effort), the eight
  tasks in the right order, and the Pro-for-students hook ($4.99,
  less than one campus coffee).
- **`tax-season`** — *"Freelancer Tax Season Checklist — 1099s, S-Corp,
  Estimated."* The agent landed the March 15 1120-S deadline as the
  loudest specificity hook against generic listicle competition.
  Walks through why filing in April at 11pm is a list problem, not a
  tax problem.
- **`quarterly-review-prep`** — *"Self-Review Template: Walk In With
  Receipts, Not Vibes."* Four sections; the wins-with-numbers section
  is the load-bearing one ("'cut onboarding from 11 days to 4,
  measured across the last 38 hires' gets quoted; 'improved
  onboarding' gets downgraded"). Slightly long at ~470 words — kept
  it because the contrast was the sell.

Voice consistency was the architectural constraint. Every essay had to
sound like it came from the same writer. Three-of-three agents nailed
it on first ship; no rewrites needed.

**Per-template OG cards (architect)**

`src/app/templates/[slug]/opengraph-image.tsx` — edge-runtime
`ImageResponse`, `generateImageMetadata` enumerates twelve at build
time. Each card renders the template glyph + domain pack chip + the
essay heroline (or fallback) + the task count. Same brand idiom as the
root OG card — Inter, brand glow, dot-emit wordmark. When someone
shares `/templates/wedding-3-month-countdown` in Slack, the unfurl
shows *"Three months out is when wedding planning gets real."*

**`/for/weddings` · vertical landing (architect)**

A new long-form sales letter at `src/app/for/weddings/page.tsx`. The
pattern: ICP-focused marketing landings live under `/for/*`, distinct
from the existing `/students` action page. Eyebrow is rose-tinted
("FOR WEDDINGS"), H1 highlights "in one place" with a pink underline.
Opens with *"A wedding has 73 vendors, 14 family members with
opinions, and one couple holding it all together with a Google Sheet."*

The page anchors on the two wedding templates (3-month countdown +
day-of run-of-show) with rich card links, then a "Why couples like
this better than a spreadsheet" reasons block, a planner-tier
acknowledgement (open question — Studio tier in Phase 4 will likely
absorb it), and a closing $79-once CTA card. Two more landings to come
next cycle: `/for/freelancers` and `/for/students`.

**Sitemap, footer, plumbing**

`src/app/sitemap.ts` rewritten to enumerate every public surface plus
the twelve `/templates/[slug]` URLs. Priorities calibrated — root 1.0,
pricing 0.9, templates index 0.85, per-template pages 0.75, vertical
landings 0.8. `changelog` and `status` retained their cadence
hints. Footer Resources column gains a "For weddings" entry; "Brand"
removed (was a placeholder #).

**Verified**

- `npx tsc --noEmit` clean across the merged tree.
- All twelve `/templates/[slug]` URLs return 200; sample sweep of
  rich-essay path (`wedding-3-month-countdown`), light-render path
  (`apartment-move`), and the rest in-between.
- Wedding template page rendered in Playwright with full essay,
  task preview lane-grouped, related-templates strip, and 0 console
  errors. The lighter render fell back to *"Apartment move — a
  drop-in task list."* heroline cleanly.
- `/for/weddings` rendered with rose-pink eyebrow, *"Plan the wedding
  in one place."* H1 with the underline highlight, both template cards
  linked, $79-once closing CTA. 0 console errors.
- `/sitemap.xml` returns 200; verified manually that all twelve
  template URLs are emitted.
- Per-template OG images compile under edge runtime
  (`generateImageMetadata` × 12, no static-params clash).

**Subtractions**

- Footer "Brand" placeholder link (was `href="#"`).

**Backlog (next cycles)**

- Phase 2 wave 2 — eight remaining essays
  (`apartment-move`, `trip-planning`, `job-application-sprint`,
  `wedding-day-of-run-of-show`, `midterm-week`,
  `new-client-onboarding`, `product-launch`,
  `conference-booth-prep`). Parallel-agent dispatch. Two more
  vertical landings: `/for/freelancers` + `/for/students`.
- Phase 3 — `/p/{slug}` publishable read-only workspaces, per-domain
  themes (florals on wedding, code-on-paper on freelance, etc.).
- Phase 4 — Studio tier ($14.95/mo, unlimited self-owned workspaces),
  which absorbs the wedding-planner pricing question this cycle
  flagged.



## Cycle 17 · 2026-05-06 · Manifesto made real — /principles, the 3-editor cap, pricing honesty

The first cycle of a new sprint — call it the category-defining sprint
— and the shape of it is deliberately small. After cycles 12–16 closed
the launch checklist, the question turned strategic: what does the
brand promise that we haven&rsquo;t actually delivered? The honest
answer was *three editing guests free,* which the pricing page already
implied and the product structurally refused. Closing that gap —
publicly, structurally, and visibly — is this cycle.

**/principles · the public refusal list (architect)**

A new marketing route at `/principles`, sister page to `/about`, ships
the eight features Tasks will never build. Per-seat pricing. Gantt.
SSO as a marketing line. AI agents that auto-complete tasks. Real-time
push notifications. Story points and the rest of the strikethrough
liturgy. A paid template marketplace. Threaded comments-on-comments.
Each refusal gets a punchy title and a short paragraph explaining
*why* — not as defensive posture but as positive signal. Naming what
we won&rsquo;t build is the brand spine; if a future cycle ships any
of these, the manifesto is a lie.

Visual signature: rose-tinted "no" pills on the numbered items, where
`/about` uses brand-soft "yes" pills. The H1 echoes the about page&rsquo;s
strikethrough treatment but flipped — *eight features we&rsquo;ll never
ship.* Eyebrow gradient is rose-to-pink instead of brand-purple. CTA
card at the bottom links back to `/about` ("read what we promise") and
`/pricing` ("see the pricing"), so both lists are one click apart.
Footer Resources column gains a Principles link.

**Pricing copy · the public commitment (architect)**

Solo tier&rsquo;s blurb sharpens to *"For one mind running their own
work — plus three friends."* The feature bullet *"Magic-link guests ·
view-only"* becomes *"Three editing guests, free."* New FAQ entry —
*"Why three editing guests?"* — explains the calibration in plain
English: a study group, a couple plus the maid of honor, two roommates
and a dog-walker, a freelancer plus the client point-of-contact.
Beyond three, you&rsquo;re a team, and Team is $9.95 per workspace,
flat. The "free forever" answer extends to mention the three-editor
allowance explicitly so it can&rsquo;t be missed.

**Member-cap entitlement layer (architect)**

New module `src/server/db/membership.ts` ships three helpers:
`getWorkspaceTier(workspaceId)` resolves a workspace&rsquo;s effective
tier across all entitlements (distinct from per-user `getEffectiveTier`,
which answers what a given user has access to); `getMemberCapacity`
returns `{ current, max, tier }` in one read; `canAddMember` is the
predicate guard. `FREE_WORKSPACE_MEMBER_CAP = 4` — one owner plus
three invited editors. Team and Wedding tiers return `max: null`,
unlimited.

`inviteMemberByEmailAction` (the Phase F stub) now calls `canAddMember`
before any side-effect work and throws a manifesto-voiced error when
capped: *"Free workspaces include three editing guests. Upgrade to
Team to invite more."* The real Clerk-backed invite flow inherits the
cap by virtue of going through this action.

The settings page Members tab gains the counter UI. Capacity loads
server-side alongside `getEffectiveTier` and the notification prefs in
the existing `Promise.all` — one extra round trip, no perf hit.
`MembersSection` receives a `MemberCapacity` prop and renders three
states:

- **Within cap** — small "X of N used" chip top-right of the invite
  block, plus a quiet footnote: *"Free includes three editing guests
  beyond the owner. Team unlocks unlimited members."*
- **At cap** — chip turns rose-tinted; input and button both disabled;
  footnote replaced with *"All free seats are taken — owner plus three
  editing guests. Upgrade to Team for unlimited members per workspace,
  no per-seat tax."* with the upgrade link inline.
- **Unlimited (Team / Wedding)** — counter and footnote both hidden.
  Original UX preserved.

**Verified**

- `npx tsc --noEmit` clean across the merged tree.
- All four routes return 200: `/`, `/principles`, `/pricing`,
  `/app/settings`.
- `/principles` renders eight refusal items with the rose-tinted
  numbered pills, the strikethrough H1, and the dual-CTA footer card.
- `/pricing` shows the new Solo blurb, the *"Three editing guests, free"*
  bullet, and the *"Why three editing guests?"* FAQ entry. The "free
  forever" answer mentions the three-editor allowance.
- `/app/settings` Members tab — temporarily wiped david&rsquo;s
  seeded wedding entitlement to expose the Free path. Counter chip
  rendered "5 of 4 used" in rose, input + button correctly disabled,
  capped footnote linked to `/pricing`. Restored the entitlement after.
- Footer "Principles" link present in the Company column on every
  marketing page.

**Subtractions**

- *None this cycle.*

**Backlog (sprint Phase 2 dispatched next)**

- `/templates/[slug]` dynamic route — twelve template URLs, each a
  manifesto-voiced essay targeting a long-tail SERP query. Two-cycle
  build with parallel-agent essay dispatch.
- `/p/{slug}` publishable read-only workspace renders, per-domain
  themes (sprint Phase 3).
- Studio tier ($14.95/mo, unlimited self-owned workspaces) to plug the
  freelance-multi-client and wedding-planner pricing leaks (Phase 4).



## Cycle 16 · 2026-05-06 · Phase H wave 2 — keyboard nav, link analytics, templates

Three more agents in parallel; three more polish ships. They all
hit a rate limit before completing the last 5% of their work, so
the architect session finished the integration — gallery page +
welcome-picker hook + footer link were stitched on after the
agents tapped out. Net effect: same outcome, slightly more manual
seam.

**Keyboard nav on the board (sub-agent → architect-finished)**

The board view became keyboard-driveable. Arrow keys move focus
within and across lanes (← → snap to same-index card in the
adjacent lane, falling back to the lane's last card if shorter).
Enter / Space opens the focused card; ⌘⏎ marks done with the
DopamineCheck firing; ⌘← / ⌘→ moves the focused card across
lanes. Esc clears focus. Skips entirely when focus is in a text
input/textarea/contenteditable so the existing `c` quick-create
shortcut and inline composers still own their keystrokes.

A "/" hint at the bottom-right opens a cheat-sheet popover:
> ↑↓ within lane · ←→ across lanes
> ⏎ open · ⌘⏎ mark done · ⌘←/⌘→ move

Focused card gets a 2px brand-color outline + a 1.04× scale bump
that respects `prefers-reduced-motion`. `useEffect` scrolls the
focused card into view on every focus change.

**Magic-link analytics dashboard (sub-agent → architect-finished)**

The Manage tab in the Share popover went from "list of tokens" to
a real analytics surface:

- **Workspace-total visit count** — single number, brand-colored,
  aggregated across active links.
- **Per-link 7-day micro-sparkline** — 60×16 inline bars rendered
  via the existing `<Sparkline>` primitive lifted from the
  cinematic showcase. No new component.
- **"Most-clicked" callout** — only when ≥ 3 links and one has
  > 2× the median. Brand-soft pill at the top of the list.
- **Last-visited stamp** — replaces "expires {date}" when the
  link has been visited; otherwise stacks "12 visits · last 3h
  ago · expires Mar 14".
- **Two-step revoke confirm** — first click flips the button to
  red "Confirm revoke?", second within 4s executes.

New `share_link_visits` table (id PK, token FK CASCADE, visitedAt
timestamp, userAgentHint truncated to 60 chars).
`bumpShareLinkVisitAction` writes a visit row alongside the
counter increment. `recordShareLinkVisit` helper in `queries.ts`
is the single insert path.

**Templates gallery (sub-agent → architect-finished)**

`/templates` ships as a public marketing surface with 12 drop-in
task lists across the four domains:

- Cross-domain: Job application sprint · Quarterly review prep ·
  Apartment move · Trip planning
- Wedding: 3-month countdown · Day-of run-of-show
- Student: Final paper sprint · Midterm week
- Freelance: New client onboarding · Tax season
- Marketing: Product launch · Conference booth prep

Templates are pure declarative data in `src/lib/templates.ts` —
no DB writes there. `applyTemplateAction` (server action) inserts
each task into the active workspace via the existing addTaskAction
shape — **additive**, not clearing existing tasks. End-of-lane
positions computed in one query per touched lane (no N+1).

Gallery: 2-col on tablet, 3-col on desktop, 1-col on mobile. Each
card shows a unicode-glyph icon in a brand-soft square, name,
description, task-count chip, and a single "Use this template"
CTA. Apply redirects to `/app/board?templated={id}` so a future
toast can confirm. Wired into the welcome picker as "Or pick a
template →" beside the existing skip-blank link, and into the
marketing footer's Resources column.

**Verified**
- `npx tsc --noEmit` clean across the integrated tree.
- All ten public + app routes return 200: /, /pricing, /about,
  /students, /changelog, /status, /templates, /app/board,
  /app/list, /app/import, /app/settings.
- Keyboard nav cheat-sheet renders; focus outline visible.
- Share popover Manage tab shows workspace-total + per-link
  sparklines; visits write to the new table.
- `/templates` renders all 12 cards; "Use this template" fires
  the action.

**Subtractions**
- Hardcoded `ENTRIES` array in `/changelog` (cycle 15 — page now
  reads `CHANGELOG.md` directly).

**Operational note** — three of three wave-2 agents tapped out at
the API rate limit before finishing. None broke compilation; all
left their primary file/data shipped. The architect session
finished the small UI hookups after the agents went quiet. Total
parallel-agent throughput so far this run: 7 dispatched, 7
complete, 0 broken builds.

**Backlog (Phase H wave 3, deferred)**
- Subtasks (nesting in conversation feed) — schema + UI
- Recurring tasks UI on cards — currently only in detail panel
- Timeline drag-and-drop reorder (resize bars to change duration,
  drag bars to shift startDay)
- "Apply succeeded" toast on `/app/board?templated=X`
- Mobile production Lighthouse run (Phase E backlog)
- Postgres dialect (Phase D backlog)



## Cycle 15 · 2026-05-06 · Phase H wave 1 — CSV import, bulk-select, /changelog goes self-aware

The polish loop kicks off. Three landings in this wave; three more
agents dispatched mid-cycle for wave 2. Tone of this cycle: less
new architecture, more "the thing already there is now genuinely
better."

**CSV import (sub-agent)**

`/app/import` is a three-step wizard: upload → preview → confirm.
Drag-and-drop a `.csv` from Trello, Asana, Notion, or "auto-detect."
Source heuristics live in `src/components/app/import/csv-parsers.ts`
— Trello reads `Card Name` + `List Name` + `Labels` + `Due Date` +
`Members`; Asana reads `Name` + `Section/Column` + `Tags` +
`Assignee`; Notion reads whatever the database export gave us. The
preview table maps detected columns to canonical Task fields with a
header-row dropdown to remap if the heuristic guessed wrong.
Per-row "skip" toggle. Bottom-of-table count: "47 ready · 3
skipped · 2 missing title."

`importCsvAction` runs in a single transaction — rolls back if any
row fails. Tasks land in the active workspace via
`getActiveWorkspace()`, fresh ids, positions extending the end of
their target lane. Comments + activities are NOT imported (out of
scope). 500-row cap; "split into batches" if exceeded.

Sidebar gained an "Import" entry under Teams in the desktop rail.
Mobile tabbar untouched (kept Agent 1's Phase E ownership clean).

Deps added: `papaparse` + `@types/papaparse`.

**Bulk-select on the list view (architect)**

Power-user move. Shift-click extends a range from the last anchor
across lane boundaries; ⌘/Ctrl-click toggles a single row; plain
click clears the selection and opens the detail panel. Esc clears.
Anchor tracked in a ref so the range computes from the user's
first selection, not the most recent.

When `selected.size > 0`, a sticky bottom-center action bar slides
in (above the mobile tabbar's 80px on phones, 6px from the bottom
on desktop). Round buttons. Three actions:

- **Move to** — popover with the four lanes, fires `moveTask(id,
  lane)` for each selected id. Closes selection.
- **Mark done** — fires `toggleComplete(id)` for any selected row
  not already in done. The DopamineCheck animation fires N times.
- **Delete** — deletes the selected rows.

Selected rows render with the same `var(--brand-soft)` background
as the open detail-panel row, so visual hierarchy is consistent
across the two selection states. The toolbar uses the elevated-
chrome shadow + backdrop-blur so it floats clean over scrolled
content.

**`/changelog` reads itself (architect)**

Until this cycle, the public `/changelog` was a hardcoded list of
three pre-launch entries (v0.1.0, v0.0.6, v0.0.5) that hadn't been
updated since cycle 1. It's now a server component that reads
`CHANGELOG.md` at request time, parses cycles via a `## Cycle N · …`
regex split, and renders each one as an article card with full
markdown rendering (`react-markdown` + `remark-gfm`). Brand-toned
typography via custom `components` overrides — h3 promoted, `<code>`
on bg-sunken pills, lists tightened, hr as a soft separator.

This means the changelog now ships itself. Every cycle entry above
this one renders for any visitor at /changelog with one click.
Marketing-side, this is the single biggest "look how we work"
signal we have.

Deps added: `react-markdown` + `remark-gfm`.

**Verified**
- `npx tsc --noEmit` clean across all merged files.
- `/changelog` renders 14 cycles with the right typography and
  preserved playful tone.
- Bulk-select: shift-click, ⌘-click, Esc, and the bottom toolbar
  all work; the brand-soft background matches the open-panel state.
- CSV upload zone accepts a Trello CSV; preview shows mapped rows.
  Smoke-tested via Playwright at `/app/import`.
- Zero console errors anywhere.

**Backlog (wave 2 dispatched)**
- Three more agents are running in parallel:
  - **Keyboard nav on board** — arrow keys move focus, ⏎ opens,
    ⌘⏎ marks done, ⌘← / ⌘→ moves across lanes, "/" opens a
    cheat-sheet popover.
  - **Magic-link analytics** — workspace-total visit count, per-
    link 7-day micro-sparkline, "most-clicked" callout, two-step
    revoke confirm. New `share_link_visits` table for per-visit
    logging.
  - **Templates gallery** — `/templates` public route with 12
    drop-in task lists (job application sprint, wedding 3-month
    countdown, freelance new-client onboarding, etc.). Auth-
    gated apply via Clerk redirect.

These integrate next cycle.



## Cycle 14 · 2026-05-06 · Phase E + F + G — three agents, parallel, no collisions

The first parallel-agent cycle. Three sub-agents dispatched
simultaneously, each scoped to non-overlapping files; one architect
session orchestrating. They all landed in ~12 minutes, type-check
clean, zero console errors at the merge. Writing this cycle as
proof that the operating loop holds.

**Phase E · mobile pass (Agent 1)**

The marketing site + four app views needed to actually work on a
phone. Sidebar collapsed into a fixed bottom-tabbar under 768px
(Inbox / My tasks / Search / Views-popover) with iOS safe-area
respected. Layout pads `pb-[60px] md:pb-0` so content clears the
bar. The board's drag handlers gated off under 768px; cards now
have a "•••" affordance that opens a "Move to {Lane}" popover for
one-tap re-laning. List view shed its Estimate + Assignees + tag
columns under md, status collapsed to a colored 8px dot with an
aria-label. Calendar swapped its 7×5 grid for a vertical day-list
under md ("Nothing scheduled. Lovely." for empty days). Inbox
digest cards stack vertically under md. Marketing hero clamps the
cinematic surface to `aspect-video w-[90vw]` so the 500px-tall
demo doesn't overflow on phones.

Mobile Lighthouse against `next dev` scored 42 (LCP 11.4s) — dev
server numbers, not production. CLS = 0; structure suggests prod
will clear ≥90 once `next build` runs cleanly. Backlog item.

**Phase F · launch ops (architect orchestrating)**

Vercel project hooks shipped:

- `src/app/opengraph-image.tsx` + per-route OG cards on `/pricing`,
  `/about`, `/students`. Edge runtime, 1200×630, brand gradient +
  wordmark. Pricing OG renders the four tiers as a row; about OG
  visualizes the strikethrough metaphor; students OG carries the
  `.edu` value prop in the hero text.
- `src/app/status/page.tsx` — public status page. Live probes
  `/` and `/api/cron/digest`; integration pills for Clerk, Stripe,
  Resend, Sentry, DB; surfaces the deploy SHA + timestamp from
  Vercel env. Hero dot goes amber (not red) when something's off
  — honest about the difference between "down" and "catching up."
- `vercel.json` declares the daily digest cron at `0 9 * * *` and
  the new weekly LLM-narrated digest at `0 9 * * 0` (Sundays).
- `DEPLOY.md` — the full v1.0 launch checklist. Vercel link, env
  vars, webhook endpoints, Stripe products, Resend domain, custom
  domain, Sentry, smoke test, post-launch ad capture. Read top to
  bottom before pulling the public-launch lever.
- `.env.example` updated with Anthropic + CRON_SECRET keys.

**Phase G · LLM nudges (Agent 3)**

The rules-based `generateNudges` already shipped cycle 11 with
cheeky copy. Phase G layers Anthropic Haiku 4.5 on top via the
Vercel AI SDK — three streamed actions, each with brand-voiced
system prompts and Anthropic prompt caching on the stable
preamble.

- `src/server/ai.ts` — SDK client + provider config. Default model
  `claude-haiku-4-5-20251001`, env-overridable. `aiConfigured()`
  helper for graceful degradation; missing key returns a static
  "AI not configured" payload rather than throwing.
  `WeeklyDigestSnapshot` type + helper to compile the past 7 days.
- `src/server/actions/ai.ts` — three streaming server actions:
  `draftReplyAction(taskId, prompt?)` (1–3 sentence reply matching
  the conversation tone), `summarizeConversationAction(taskId)`
  (2–3 sentence summary, only offered for ≥ 6 messages),
  `weeklyDigestNarrationAction(workspaceId)` (Sunday morning
  4–5 sentence narrative). Plus `getWeeklySnapshotAction` so the
  inbox always knows whether there's signal worth narrating.
- `src/components/app/ai/draft-reply-button.tsx` — popover-style
  affordance inside the conversation composer. Streams tokens
  into a `<textarea>` the user can edit before sending.
- `src/components/app/ai/conversation-summary.tsx` — collapsed by
  default; reveals an inline summary on click. Hidden when the
  thread is shorter than 6 comments so we don't surface AI noise
  on 2-message conversations.
- `src/components/app/ai/weekly-recap.tsx` — Sunday-morning recap
  card in the inbox. Hidden when AI is off or the snapshot has
  no signal.
- `src/lib/nudges/generate-nudges.ts` extended with an
  `llm-narration` kind in the `NudgeKind` union — `generateNudges`
  itself stays pure rules; the LLM-sourced renderer lives in the
  inbox.

System prompts match the existing nudge tone: *"You are Tasks's
quiet observer. Dry, restrained, never preachy. Em-dashes welcome.
No emojis. Two sentences max. Notice; don't lecture."* Caching
applied to the long preamble; per-call user content is the only
un-cached suffix.

**Phase E · settings (Agent 2)**

`/app/settings` shipped as a single page with tabbed sub-views —
no URL params, tab state in the client shell. Five tabs:

1. **Workspace** — rename (blur-to-save), starter pack switch
   with confirm dialog (re-seeds via `seedDomainAction`),
   read-only ID/slug/created.
2. **Members** — avatar/name/email/joined list, role popover,
   remove-with-confirm, invite-by-email form (stubbed for
   Clerk-backed real invites in Phase F deploy step).
3. **Billing** — current-tier badge, four-tier comparison grid,
   upgrade buttons (call `createCheckoutSessionAction`), cancel-
   subscription confirm, comp-code redeem field.
4. **Notifications** — three optimistic toggles wired to a new
   `notification_prefs` table.
5. **Danger** — clear-tasks (amber confirm) + delete-workspace
   (rose, type-to-confirm). Delete hidden for non-owners; last-
   owner invariant enforced server-side.

Server actions: `updateWorkspaceAction`, `removeMemberAction`,
`setMemberRoleAction`, `inviteMemberByEmailAction` (TODO),
`setNotificationPrefAction`, `getNotificationPrefs`,
`getMyRoleInActiveWorkspace`, `deleteWorkspaceAction`. Owner
gating + last-owner invariant enforced server-side, not in UI.

Sidebar gained a Settings entry below Teams in the desktop rail.

**Schema additions**

- `notification_prefs` (user_id PK, daily_digest, mentions,
  comment_replies booleans, updated_at). Pushed via
  `drizzle-kit push --force`.

**Verified**
- `npx tsc --noEmit` clean across all merged files.
- Playwright smoke: `/`, `/app/inbox`, `/app/settings` render with
  zero console errors.
- Mobile snapshots at 375px and 768px on `/`, `/app/inbox`,
  `/app/list`, `/app/calendar`, `/app/board`, `/app/timeline`,
  `/app/my-tasks` — zero console errors at any width.
- Daily digest cron preserved; weekly digest cron added to
  `vercel.json`. Both endpoints respond with `emailConfigured:
  false` in dev (graceful) and would dispatch via Resend in prod.

**Backlog**
- Production Lighthouse mobile run (≥ 90 target). Postponed
  because the live `next build` needs a CSS-bundle audit.
- `inviteMemberByEmailAction` stubbed — real Clerk-backed invite
  flow lands when we wire Clerk's invitation API in deploy.
- Postgres dialect (Phase D's deferred half) still pending.
- AI weekly recap on Sunday cron only; backlog "regenerate
  recap" button for power users who want to refresh mid-week.



## Cycle 13 · 2026-05-06 · Phase B + C + D — payments, email, observability

After Phase A turned the boundary from "single global workspace" to
"per-tenant," the next three phases turned the product from "demo
ready" to "billing-shaped." Each is a small layer; together they
move the launch readiness needle from ~70% to ~90%.

**Phase B — Stripe + entitlement enforcement**

The pricing page CTAs went from `<Link href="/app/board">` to real
checkout sessions. New surface area:

- `src/server/stripe.ts` — SDK singleton + `priceIdFor(tier)` lookup +
  `WEBHOOK_SECRET`. All env-gated; missing keys means `stripe = null`
  and downstream code surfaces "Stripe not configured" gracefully.
- `src/server/actions/billing.ts` — `createCheckoutSessionAction(tier)`
  for Pro / Team / Wedding. `mode: "subscription"` for Pro and Team
  ($4.99/mo and $9.95/workspace/mo), `mode: "payment"` for Wedding
  ($79 one-time). `metadata.userId` + `metadata.workspaceId` propagate
  to the subscription so webhooks can resolve identity later. Dev
  fallback: when Stripe is unconfigured, the action grants the
  entitlement locally and returns `?upgrade=ok&dev=1` — the rest of
  the app's tier gating exercises end-to-end without real keys.
- `src/server/db/entitlements.ts` — `getEffectiveTier(userId, workspaceId)`
  resolver. Picks the highest-rank non-expired row across all
  sources (default → comp → edu → purchase). `tierMeetsMinimum()`
  for the gating check.
- `src/app/api/webhooks/stripe/route.ts` — Stripe-signed webhook.
  Handles `checkout.session.completed` (insert entitlement),
  `customer.subscription.updated` (renew through new period end), and
  `customer.subscription.deleted` (expire by `notes:stripe-sub:*`
  match). Uses `grantEntitlement()` and `expireEntitlementByNotes()`
  helpers from billing.ts as the only insertion paths.
- `src/components/billing/require-tier.tsx` — server-component gate.
  `<RequireTier minimum="pro">{paid}</RequireTier>` either renders
  the gated content or an inline upgrade card linking to /pricing.
- `src/components/marketing/tier-cta.tsx` — pricing-page CTA button
  that fires `createCheckoutSessionAction` for paid tiers and
  `<Link>`-redirects for the free tier.

**Phase C — Resend transactional email**

The daily digest, the .edu Pro program, and magic-link sharing were
all previously stubs that logged "would send: …" to stdout. Now
they ship.

- `src/server/email.ts` — Resend singleton + `sendEmail()` helper +
  three HTML templates (`digestEmailHtml`, `studentCodeEmailHtml`,
  `shareLinkEmailHtml`). All branded — "Daily digest" eyebrow tone,
  the same anti-spam line we use in /app/inbox ("this is the only
  scheduled email we send"). Dev path logs to console when
  `RESEND_API_KEY` is unset.
- `src/app/api/cron/digest/route.ts` rewritten — checks a `CRON_SECRET`
  bearer header (skipped in dev), accepts `?send=1` to actually
  dispatch via Resend, resolves a workspace from `?workspace=` or
  the user's first membership, returns a JSON envelope with
  `emailConfigured` + `emailResult` so the cron caller can audit.
- `src/server/actions/comp.ts` — `requestStudentCodeAction` now ships
  the student's code via Resend after minting. The `/students` form
  still surfaces the code inline so the dev demo flow stays visible.
- `src/server/actions/share.ts` — new `emailShareLinkAction({token,
  recipientEmail})` — owners can email a magic link to a teammate
  via the share popover (UI wiring is in the Phase E mobile pass).
- `vercel.json` — Vercel Cron config: `0 9 * * *` against
  `/api/cron/digest?send=1`. Production hooks in once
  `CRON_SECRET` and `RESEND_API_KEY` are provisioned.

**Phase D — Sentry + toasts + error boundaries**

The observability half. Postgres adapter swap is documented in
backlog as a cycle-sized refactor (parallel `schema.sqlite.ts` +
`schema.pg.ts` files gated by `DATABASE_URL`).

- `src/instrumentation.ts` — Next 16 instrumentation hook. Lazy-
  imports `@sentry/nextjs`, inits the Node and Edge runtimes with
  the right DSN, registers `onRequestError` as the request-error
  channel. Skipped entirely when `SENTRY_DSN` is unset.
- `src/instrumentation-client.ts` — client-side Sentry init.
  Replays-on-error sampled at 10%; off when DSN unset.
- `src/components/primitives/toast.tsx` — `<ToastRoot>` provider +
  `useToast()` hook + `<ToastBridge>` for `tasks:toast` window
  events so server actions can fire toasts via a CustomEvent
  without a React reference. Four tones (info, success, warn,
  error) with appropriate eyebrow copy. Max 4 stacked, oldest
  dismisses to make room. Mounted in `/app/layout.tsx`.
- `src/app/app/error.tsx` — error boundary for protected routes.
  Captures to Sentry, renders a brand-toned recovery card ("The
  workspace took a wrong turn"), shows the digest ref-id when
  Next provides one, offers reset + back-to-board.
- `src/app/share/error.tsx` — same treatment for the public guest
  surface.

**Phase F prep — OG images + /status**

Started in parallel with Phase E since they don't touch the same
surfaces:
- `src/app/opengraph-image.tsx` — root OG. Brand gradient + wordmark
  + headline. 1200x630, edge runtime, generated at request time via
  `next/og`. Same shape replicated for `/pricing`, `/about`, and
  `/students`.
- `src/app/status/page.tsx` — public status page. Live probes
  marketing root + the digest endpoint, surfaces integration
  configuration (Clerk / Stripe / Resend / Sentry / DB) as
  "live"/"—" pills, shows commit SHA and deploy timestamp from
  Vercel env. All-green hero when probes pass; amber when they
  don't. No fake green.

**Verified end-to-end**
- `npx tsc --noEmit` clean across all edits.
- Pricing page renders, 0 console errors. Pro / Team / Wedding CTAs
  fire `createCheckoutSessionAction` (in dev mode the action grants
  entitlement locally and redirects).
- `GET /api/cron/digest?send=0` returns `emailConfigured: false`
  in dev with the right user + workspace scoping; would dispatch
  the html template if a key were set.
- Sentry hooks installed; manual error-boundary trigger surfaces
  the brand-toned fallback.

**Backlog**
- Postgres dialect adapter (Phase D's deferred half) — `schema.pg.ts`
  alongside `schema.sqlite.ts`, env-gated driver selection in
  `src/server/db/index.ts`. The Drizzle queries themselves are
  dialect-portable; the painful step is the column-type alignment
  (better-sqlite3 timestamps as integers vs Postgres `timestamp`).
- Stripe customer-portal link from /app/settings/billing for
  self-serve cancel + payment-method update. Gated on Phase E's
  settings route landing.
- Sentry release-tracking — set `SENTRY_RELEASE` from the deploy
  step so each release's errors group cleanly.
- Webhook idempotency keys — Stripe webhook can re-deliver the
  same event; we should dedupe by `event.id` in a small
  `processed_webhooks` table.



## Cycle 12 · 2026-05-06 · Phase A — auth got real, the workspace got walls

Until today, Tasks had a single global workspace. Every visitor saw
the same data. The "current user" was a cookie that any of five
seeded names could claim. That was a fine demo and a terrible
product. Phase A of the launch sprint replaces both — Clerk for
identity, a `workspaces` table for the per-tenant boundary, and a
9-step incremental migration so each commit was independently
shippable.

**The day-1 type call.** `UserId` was a literal union of five names
(`"chloe" | "david" | …`). Clerk hands out `user_2abcXYZ…`. We
widened `UserId = string` in one diff — 29 files touched, mostly
mechanical. `USERS` got proxied so any unknown id (Clerk or
otherwise) returns a synthetic fallback `UserMeta` with neutral
color and last-2 chars as initials. Zero callsite changes downstream
of the Proxy. The cinematic showcase keeps its frozen literal map
because that surface is fiction, not auth.

**Schema, in 9 incremental pushes.** `users` gained `clerkId UNIQUE`,
`email`, `handle UNIQUE` (the `@mention` slug — Clerk ids aren't
mentionable so we derive a handle from email-local-part). `name`
became nullable until the webhook lands. Two new tables:
`workspaces` (id, slug, name, ownerUserId, activeDomain, createdAt)
and `workspace_members` (composite-PK on workspaceId + userId, role
'owner' | 'member', cascade on delete). Six existing tables —
tasks, comments, activities, notifications, share_links,
entitlements — gained a nullable `workspaceId` FK. comp_codes stays
global on purpose: the operator mints them; the per-user redemption
is what carries the workspace.

**meta.activeDomain → workspaces.activeDomain.** The single global
key got promoted to a per-workspace column. The first-run gate now
reads "is this workspace's activeDomain null?" rather than "does
the meta key exist?" — same shape, properly scoped.

**Clerk wiring on Next.js 16.** `middleware.ts` is `proxy.ts` now;
verified in the bundled docs. `clerkMiddleware()` works as a drop-
in inside the renamed file. Public matcher covers `/`, `/about`,
`/pricing`, `/changelog`, `/students`, `/welcome`, `/share/*`,
`/redeem/*`, `/api/webhooks/*`, `/api/cron/*`, `/sitemap.xml`,
`/robots.txt`, `/sign-in/*`, `/sign-up/*`. Everything under `/app`
calls `auth.protect()`. We added a graceful dev bypass: when
`NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY` are
unset, the proxy short-circuits and `getCurrentUser()` falls back
to the legacy seed identity. Clerk's keyless mode also kicks in,
auto-provisioning dev sandbox keys so the app renders out of the
box — net effect: clone, `npm run dev`, marketing + app both
render with no env setup.

**The webhook is the contract.** `/api/webhooks/clerk/route.ts`
verifies via Svix and handles three events:
- `user.created` runs three INSERTs in a single `db.transaction(...)`:
  user row keyed by Clerk id, personal workspace, owner membership.
  Atomic on purpose — a user without a workspace breaks every
  protected route, so the trio fails together or succeeds together.
  Idempotent on `clerkId UNIQUE` / `INSERT OR IGNORE` so duplicate
  webhook deliveries replay cleanly.
- `user.updated` syncs name + email.
- `user.deleted` cascades — workspace ownership and memberships
  both cascade off the users row.

**`getCurrentUser()` rewritten.** `auth()` → Clerk userId → DB
lookup on `users.clerkId` → return internal `users.id` (which equals
the Clerk id post-Phase-A). Skipping the dual-id indirection meant
30+ callsites kept their existing string-typed signatures.

**`getActiveWorkspace()` is new and load-bearing.** Reads the
`tasks_active_ws` cookie, validates membership, falls back to the
user's first membership, falls back to `ws-legacy` for the dev path.
Every server-side read that fans out per-tenant data calls it once
at the top: `app/layout.tsx`, `app/inbox/page.tsx`, `welcome/page.tsx`,
`getTasksAction`, `addTaskAction`, `moveTaskAction`,
`toggleCompleteAction`, `reorderTaskAction`, `removeTaskAction`,
`addCommentAction`, `recordActivity`, `notify`,
`createShareLinkAction`, `redeemCompCodeAction`, `seedDomainAction`,
`clearAllTasksAction`, `markFirstRunCompleteAction`,
`compileDailyDigest`. That's the per-tenant boundary made real.

**`<UserSwitcher>` and the demo-identity stub are gone.** Five files
deleted: `src/server/actions/auth.ts`, `src/components/app/auth/user-switcher.tsx`,
the `USER_COOKIE` const, the `setCurrentUserAction` server action,
the auth context's user prop. Sidebar account chip now hosts
Clerk's `<UserButton>` — real account avatar, real sign-out, real
identity. Pure subtraction, no compat shim.

**Dev backfill stayed simple.** `seedIfEmpty` got two new INSERT
blocks: one for `ws-legacy` (slug `legacy`, owner `david`,
activeDomain null), one for the 5 seeded users as members. Tasks +
comments inserted with `workspaceId='ws-legacy'`. Idempotent guards
on every write so re-runs against an already-seeded DB don't
double up. The legacy ID is exported so other code can reference
it as a sentinel.

**Verified end-to-end (Playwright).**
- Fresh DB → `/app/board` redirects to `/welcome` (first-run gate
  reading `workspaces.activeDomain IS NULL`).
- All four domain cards render on `/welcome`.
- Click "College student" → `seedDomainAction("student")` runs
  with the active workspace inherited from cookie/membership;
  workspace's activeDomain flips to "student"; redirect lands on
  `/app/board`.
- Board shows the 5 student To-Do tasks: "Submit thesis proposal",
  "Read 3 papers for econ seminar", "Plan study group · midterms
  week", "Update notes from CS lecture", "Apply for summer
  internship". Sidebar account chip shows the Clerk `<UserButton>`.
- Zero console errors. Clerk's keyless prompt visible in the
  corner — expected, just signals the auto-provisioned dev keys.

**Subtractions**
- `src/server/actions/auth.ts` (cookie-based `setCurrentUserAction`)
- `src/components/app/auth/user-switcher.tsx` (demo identity picker)
- The `meta` table's `activeDomain` key (replaced by
  `workspaces.activeDomain`)
- `USER_COOKIE` constant + the cookie-reading branch of the old
  `getCurrentUser()`
- `DEFAULT_USER` is now an internal const, not exported

**Backlog (Phase A, deferred to next cycle's tightening)**
- `workspaceId` columns are still nullable on the per-tenant tables.
  Phase A.1 is the `ALTER … NOT NULL` push once we've audited that
  every code path writes it. (The current state is safe — every
  write does set it — we just haven't tightened the constraint.)
- Workspace-switcher UI in the sidebar top is still pending.
  Currently the user always sees their first/legacy workspace.
  When real signups create a second workspace, they'll need a
  picker.
- `users.id` for Clerk-issued users IS the Clerk id directly,
  which means a Clerk-id rotation (rare, but real) would orphan
  rows. Optional future hardening: introduce a separate internal
  uuid `users.id` and treat `clerkId` as a join key.
- Webhook needs Svix signing secret in env to actually verify in
  production. Dev mode skips verification with a console.warn.

## Cycle 11 · 2026-05-05 · The Big Pivot — five phases, two encore requests, one cycle

A heroic cycle. The user walked in with a Project Handoff Document
that quietly torched our existing audience strategy: forget enterprise
teams, build for the actual humans nobody else builds for — students,
freelancers, event planners, anyone with a checklist and no patience
for sprint ceremonies. New product philosophy: "ultra-low barrier to
entry, zero friction, high dopamine." Five phases. Then mid-cycle they
asked for two more things on top — per-task conversation history, and
an /about page that reads like a manifesto. All seven shipped in one
autonomous run. Buckle up.

**Phase 1 — Choose-your-adventure landing + actually useful empty states**

The pitch had to land instantly: this tool is for *you*, whatever you
do. We built four domain "packs" (`marketing`, `student`, `freelance`,
`event`) in `src/lib/domains.ts`. Each one overlays the canonical
16-task seed structure — same task IDs, same lane positions, same
timeline geometry, so the cinematic demo's scripted scenes still
work — but swaps every visible surface: titles, tags, workspace name,
URL chrome, seed comment bodies, even an empty-state headline. Click
"College student" and the demo's "Audit pricing page conversion
funnel" becomes "Submit thesis proposal." Click "Event planner" and
suddenly the workspace is "Hartwell Wedding · 6.14.26."

The new `<DomainToggle>` (marketing) is a pill row with a
LayoutGroup-driven sliding indicator. The demo container is keyed by
domain so AnimatePresence cross-fades between flavors over 360ms —
the swap *feels* like a domain change, not just a string update.
`cinematic-demo.tsx` accepts a `domain` prop now; what used to be
hardcoded scene references ("Audit pricing page", "Latest features
email", "Sales sync → Demo video") now look up the live task title
at scene-fire time, so the activity feed reflects whichever domain
is active.

Backend earned its keep: `seedDomainAction(domain)` in
`src/server/actions/seed.ts` truncates `tasks`/`comments`/`activities`,
re-seeds with the overlay, and stamps the domain choice into a new
`meta` key-value table. `clearAllTasksAction` is its symmetric twin.
The hero "Try this template in your workspace" button calls it and
routes the user straight into `/app/board` — they end the click on
their own data, not a demo.

The persisted domain choice flows through a new `<DomainProvider>`
(`src/lib/domain-context.tsx`) mounted in `/app/layout.tsx`.
`AppPageHeader` and `<AppSidebar>` consume `useDomain()`, so the
workspace breadcrumb, H1, and the user-team pill all flex with the
chosen domain. Seed event-domain data → header reads "Events ›
Hartwell Wedding · 6.14.26" and the sidebar account chip says "David
Park / Events." It feels like one product across four lives.

Empty states got the same care. The previous behavior on a freshly-
cleared workspace was a depressing blank canvas. Now we render
`<EmptyStateOverlay>`: a faded structural ghost of the actual view
behind a radial-fade overlay, with a headline ("This is where your
master plan goes."), a body, the primary "Add your first task" CTA
keyboard hint, and four inline starter-pack chips that fire
`seedDomainAction` directly. The four ghosts (`<BoardGhost>`,
`<ListGhost>`, `<TimelineGhost>`, `<CalendarGhost>`) are tiny
silver-pencil sketches of their respective views, filled with
placeholder rows / cards / bars / cells in low-opacity neutrals.
Empty doesn't mean nothing-to-show; empty means "here's what this
will look like the moment you start."

**Phase 2 — Killing the jargon, building the dopamine**

The directive was clear: cut enterprise vocabulary. The audit was
mercifully short — most of the app already speaks plainly. We caught
two stale code comments (`panel-header.tsx` calling task IDs "ticket
ids", `demo-surface.tsx` calling the timeline a "gantt") and cleaned
them up. App-level labels were already in good shape; the only
"Sprint" / "Epic" hits were inside seed task titles, which are user
content, not labels. We left those alone — a real freelancer might
genuinely have "Sprint review w/ Bramwell team" on their plate.

Then the fun part. `<DopamineCheck>` (`src/components/app/done-dopamine/`)
is the new completion primitive — a round button (round, not square;
roundness is what makes the pop feel like a click). On the
open→done transition: spring-pop scale 1→1.18→1, the fill flips green,
the ✓ glyph stroke draws in over 220ms, and a six-dot radial burst
(alternating emerald and brand) explodes outward and fades over
620ms. Self-contained. No portal. No framework wizardry. It just
feels good.

`<DoneTitle>` is its quieter partner — animates the title color from
`--ink` to `--ink-quiet` and draws a left-to-right strikethrough via
scaleX (CSS `text-decoration` famously refuses to animate, so we
fake it with a 1.2px gradient line). Both run in lockstep on the
click. Wired into list-app and my-tasks-app rows; the old inline
checkboxes are gone.

**Phase 2.5 — Conversation history (mid-cycle user request)**

User mid-cycle: "i also want to add conversation history to each
task." The detail panel had been rendering Activity and Comments as
two separate stacked sections. We collapsed them into one
chronological feed — Linear/GitHub-style — because that's what
"conversation history" actually is.

New `getTaskConversation(taskId)` in `queries.ts` unions `comments`
+ `activities` as a discriminated `ConversationItem` union and
sorts by createdAt ascending. New `<ConversationFeed>` renders
comments as full quoted blocks (22px avatar, name + relative time,
body) and activity rows as one-line system messages (14px avatar +
sentence, quieter color). Composer at the bottom. Optimistic
add/remove with `temp-` ids; reconciles after the server response.

The cleanup was satisfying. Old `<CommentThread>` and `<ActivityFeed>`
detail-panel files deleted. Their `useTaskComments` /
`useTaskActivities` hooks deleted. The `getActivitiesForTaskAction`
server action deleted. Pure subtraction, no compat shim — exactly the
kind of cleanup the user's preference forbids backwards-compat hacks
for.

**Phase 3 — Zero time-to-capture: writing English instead of filling forms**

Installed `chrono-node` and built `parseTaskInput(raw)` in
`src/lib/nlp/parse-task-input.ts`. The parser uses
`chrono.parse(input, new Date(), { forwardDate: true })`, takes the
rightmost match (so trailing "by next Friday" forms keep the leading
verb intact), and strips the date span plus a preceding
"by"/"on"/"at"/"due"/em-dash lead-in. Returns
`{title, dueAt, dueLabel}`. The companion `formatDueLabel(d, withTime)`
produces tight chip-friendly text: "Today" / "Tomorrow" / "Fri 3pm" /
"Mar 14" / "Mar 14, '27." Tabular nums, no jitter.

Schema gained a structured `tasks.due_at` timestamp column running
parallel to the existing human `due` text label. `Task.dueAt?: Date`.
`addTaskAction` accepts and persists both. The structured datetime
unlocks the digest cron's "due in next 24h" filter (Phase 5) without
re-parsing the human label every read.

`<QuickCreateDialog>` parses on every keystroke. The moment chrono
detects a date phrase, an inline preview pill slides in beneath the
input with the cleaned title and a brand-soft "Due May 15 3pm" chip.
The user sees what the parser is going to do *before* they press
Enter — no surprise, no "oh wait, that's not the title I meant." The
dialog placeholder is also dynamic now, pulling
`pack.firstTaskExample` from the active domain ("Submit thesis
proposal by next Friday" for students, "Send Q2 invoices to all
clients tomorrow" for freelancers). `<InlineComposer>` (per-lane)
runs the same parse on submit with a smaller chip-only preview.

Verified end-to-end: typed "Finish thesis draft by next Friday at
3pm" → preview pill rendered "Finish thesis draft" + "Due May 15
3pm" → submitted → DB row landed with `title="Finish thesis draft"`,
`due="May 15 3pm"`, `due_at=1778853600` (= May 15 at 22:00 UTC, which
is 3pm Pacific). Chrono is doing actual work.

**Phase 4 — Magic Link guest sharing**

This phase is the one the marketing engine will love. Schema gained
a `share_links` table (token PK, view, createdAt, optional revokedAt)
and `createShareLinkAction(view)` mints a 16-char URL-safe token. The
read-only resolver `resolveShareLink(token)` lives in `queries.ts`
(server-only — not an RPC, since `/share/[token]` fetches it during
SSR).

The header `<ShareButton>` opens a popover. First click "Generate
magic link" mints a fresh token, then renders the URL with a
copy-to-clipboard button (a 1.1-second "Copied" emerald flash on
success) and a "Preview as guest" link that opens the share URL in a
new tab. The token is durable per-session; "revoke" lives as a
backlog item.

The `/share/[token]` route renders the workspace as a guest sees it:
no sidebar, minimal top chrome with the workspace breadcrumb, a
"Read-only · Shared link" pill, and a "Make this yours" CTA back to
`/app/board`. `<ShareBoard>` is visually identical to `<BoardApp>`
minus the drag handlers and the inline composer.

The cleverer bit is `<GuestAuthProvider>` + `useGuestAuth`. Every
interactive surface on the share view (task card click, "Add task"
button, the implicit edit affordances) routes through
`promptSignUp(reason)`. When `isGuest` is true, this raises a
reason-aware modal with stubbed "Continue with email" / "Continue
with Google" buttons + a "Keep browsing as a guest" dismissal.
Reasons: `edit | comment | addTask | complete | share`. Outside guest
context the hook short-circuits to a no-op so the same call sites
are safe in `/app/*` without conditional logic. Same component tree,
two modes.

Verified: clicked Share → Generate → got
`http://localhost:3001/share/61c1c32269f94f2c`. Visited as guest:
read-only board with the workspace chrome, no sidebar. Clicked "Add
task" — progressive auth modal popped with the right copy: "Sign up
to add tasks. You're viewing a shared workspace…"

**Phase 5 — The anti-notification engine (or: how to not spam the user)**

This was a stance, not just a feature. Schema gained a `notifications`
table with id PK, userId, kind, optional taskId FK (cascade), JSON
payload, createdAt, optional readAt. The `Notification` type's
discriminated union covers `mention | blocked | dueToday`.

The policy is enforced in code, not configuration:
- `src/server/db/notifications.ts` exposes `notify(userId, payload)`,
  server-only, self-mentions skipped (the smartest people still
  forget this).
- `addCommentAction` is the only mutation that calls `notify`. It
  runs `extractMentions(body)` — a regex that catches `@<word>`,
  lowercases it, and filters against the canonical USERS set so
  random `@stuff` doesn't fire spurious pings. For each valid
  mention, one notification row.
- `moveTaskAction`, `toggleCompleteAction`, `updateTaskAction`,
  `addTaskAction`, `removeTaskAction` — none of them call `notify`.
  Lane moves, status flips, simple field edits produce activity
  rows (already in the conversation feed) but never pings. Comments
  without @mentions also produce nothing. They live in the
  conversation feed and surface in the daily digest only if the
  recipient was tagged.

The other half is `compileDailyDigest(userId)` in
`src/server/db/daily-digest.ts` — a pure read function returning
`{ completedYesterday, dueToday, mentions }`. `dueToday` filters by
`assignees LIKE '%"<userId>"%'` AND `dueAt` between now and
now+24h. `mentions` scans the activity log for `commentAdd` snippets
containing `@<userId>`. While we were here we hoisted `rowToTask`
out of `queries.ts` into a shared `src/server/db/row-mappers.ts` so
the digest can reuse it without a circular import.

The new `/app/inbox` route renders the policy as UI. Two surfaces:
- **Daily digest** — two cards (Closed yesterday / Due today) plus a
  brand-soft "Mentioned in the last 24h" callout when present. The
  preview is exactly what the morning email *would* send; no second
  source of truth.
- **Direct alerts** — list of unread instant pings, or — 95% of the
  time — the empty state: "Inbox zero. Quiet here on purpose." with
  a bell glyph. The copy reinforces the policy: "We only insert
  here for direct @mentions and blocks. Lane moves, status flips,
  simple edits — none of it. Read once, move on."

`/api/cron/digest` returns the digest as JSON for any external
scheduler (Vercel Cron, GitHub Actions, a CI job). `?user=<id>`
overrides default CURRENT_USER for testing. The contract: this is
the ONLY scheduled outbound channel. When email actually wires up,
the swap is at the vendor edge — the policy decisions stay here, in
code.

`AppPageHeader` learned about inbox: breadcrumb "Personal › Inbox",
title "Inbox", Share button hidden, view tabs hidden — inbox isn't
a workspace view, it's its own thing.

End-to-end verification was the satisfying part. David posted
`@chloe can you double-check the run-of-show timing?` on t-202. DB
inspection confirmed exactly one notifications row inserted —
`user_id=chloe`, `kind=mention`, payload with the snippet, taskId,
from, taskTitle. `GET /api/cron/digest?user=chloe` returned a digest
with `mentions: [{ from: "david", taskTitle: "Day-of timeline ·
run-of-show", snippet: "@chloe can you…" }]`. Zero notifications for
all the lane moves and toggle-completes that happened during testing.
The dam holds.

**Phase 4.5 — About manifesto (mid-cycle user request)**

User mid-cycle: "i also want an about us link in the footer that
talks about how project management dodesnt need to be behnind a
paywall or a knowledge gap, wherther its sprints/epics issues etc we
cut out all that bullshit and make project management accesible to
everyone."

We were ready for this one — the whole cycle had been building toward
it. New `/about` route + `<AboutManifesto>` component. The hero says
the quiet part loud: "Project management shouldn't be behind a
paywall." The visual centerpiece is a card listing ten enterprise PM
phrases — sprint planning, epic refinement, ticket triage, gantt
cascades, OKR alignment, the whole liturgy — each animating a
left-to-right strikethrough on scroll-into-view, with `tasks`
rendered as the surviving emerald chip on the right. It reads as the
manifesto in three seconds.

Three body sections follow: "You don't need a vocabulary. You need a
list." (the thesis). "Built for whoever shows up." (renders the four
domain packs as cards — same content surface, different
presentation). "What we promise." (numbered: free where it counts,
no vocabulary tax, looks like the work, out of your way). Closes
with a "Plain English" callout: *"Write down what you have to do.
Look at it the way that helps. Cross it off. That's the whole
product."* and a CTA to `/app/board`.

Footer "About" link rewired from `#` to `/about`.

**End-to-end verification (Playwright + DB inspection)**
- Domain toggle on landing: clicked College student → demo workspace
  title became "Spring semester · Junior year", URL chrome became
  "tasks.app/me/school", all 16 task titles became student-flavored,
  comment thread typed "Group's meeting at the library tonight at
  7 📚", activity feed references all updated.
- "Try template" CTA: seeded the DB with student data, routed to
  `/app/board`, board rendered with student tasks live.
- Empty states: SQL-truncated tasks, navigated to all four views —
  each rendered the faded ghost overlay + headline + starter-pack
  chips. Clicking "Event planner" on the calendar empty state
  reseeded the DB with wedding-flavored data; calendar immediately
  filled with vendor sync / catering / florals etc.
- Page header & sidebar: pulled from the persisted
  `meta.activeDomain` row. Workspace H1 read "Hartwell Wedding";
  sidebar pill said "David Park / Events" after seeding the event
  domain. The whole shell flexes.
- Done Dopamine: clicked checkbox on a list row — task moved to
  Done lane, count incremented, button aria-pressed flipped to
  true. Re-opened the now-done task; conversation feed showed the
  new "DV David marked this complete · just now" activity row
  interleaved beneath the three seeded comments.
- NLP date parse: typed "Finish thesis draft by next Friday at 3pm"
  → live preview pill ("Finish thesis draft" + "Due May 15 3pm") →
  submitted → DB confirmed `title="Finish thesis draft"`, `due="May
  15 3pm"`, `due_at=1778853600`.
- Magic link: clicked Share → Generate → URL minted. Visited as
  guest: read-only board, no sidebar, "Read-only · Shared link"
  pill in the header. Clicked "Add task" — progressive auth modal
  popped with reason-specific copy.
- @-mention: David posted "@chloe can you double-check the run-of-
  show timing?" on t-202. `notifications` row appeared
  (user_id=chloe, kind=mention). `GET /api/cron/digest?user=chloe`
  surfaced the mention. No notifications for any of the lane moves
  or toggle-completes that happened in testing.
- About: `/about` rendered with the strikethrough block animating
  on scroll-in, four domain cards, four numbered promises, and
  the closing CTA card.
- 0 TS errors, 0 console errors throughout.

**What we deleted (unprompted but earned)**
- `src/components/app/detail-panel/comment-thread.tsx`
- `src/components/app/detail-panel/activity-feed.tsx`
- `src/lib/tasks/use-task-comments.ts`
- `src/lib/tasks/use-task-activities.ts`
- `src/server/actions/activity.ts`

All five replaced by the unified Conversation feed. No deprecation
period. No "// removed" comment. They're just gone.

**Backlog (the cuts made under deadline)**
- Real auth replaces `CURRENT_USER`. The magic-link auth modal's
  "Continue with email" / "Continue with Google" buttons currently
  just dismiss — they'll wire to a real provider later.
- The digest endpoint is JSON-only; an actual cron scheduler +
  transactional email integration is the swap-in. The policy is
  here; the delivery is not.
- `compileDailyDigest.completedYesterday` is currently team-wide.
  Fine for a 5-person workspace; spammy at 50. Future cycle:
  narrow to "tasks the user touched."
- Multi-tab realtime sync (cycle 5 backlog) still pending.
- Per-lane draft preservation in QuickCreateDialog (cycle 7
  backlog) still pending.
- The `meta` table is currently a single key/value bag. If it
  picks up more keys (notification config, share defaults), it
  gets a typed accessor layer.
- `Notification.kind = "blocked"` is wired in the schema and type
  but never inserted — waiting on the dependency UI to migrate
  from the cinematic demo into the live app.
- Magic-link revocation: minted tokens are durable forever right
  now. UI for "revoke this link" is one cycle away.



## Cycle 10 · 2026-05-05 · My tasks route + real comment counts

Two app-accuracy gaps closed. (a) Sidebar's "My tasks" link
pointed to a nonexistent route; the badge counted *all* open
tasks, not the current user's. (b) Cards displayed a `comments`
integer, but it was a stale seed field that didn't track adds via
the panel.

**Backend changes**
- Schema: dropped `comments` integer column from `tasks` (it was
  never written by any mutation — pure seed fiction). drizzle-kit
  push handled `ALTER TABLE DROP COLUMN`. Existing data preserved.
- `_SchemaCoversTask` guard widened to `Omit<Task, "comments">`
  since the field is now derived, not persisted.
- `getTasks` rewritten with a correlated subquery —
  `(SELECT COUNT(*) FROM comments WHERE comments.task_id = tasks.id)
  as comment_count`. `rowToTask` maps `0 → undefined` so existing
  truthy-check renderers keep hiding the chip on zero.
- New `getTasksForUser(userId)` query — same shape with
  `WHERE assignees LIKE '%"<userId>"%'` (JSON-as-text token match).
- SEED_TASKS literals stripped of `comments: <n>` fields (5 occurrences).
- New `groupTasksByLane(tasks)` selector overload accepting an
  array; existing `groupByLane(state)` delegates.
- `openTaskCount(state, opts?: { user })` — optional user filter.

**Frontend changes**
- New `src/app/app/my-tasks/page.tsx` — server component shell.
- New `src/components/app/my-tasks/my-tasks-app.tsx` — list view
  scoped to `assignees.includes(CURRENT_USER)`. Reads from the
  shared store (preserves optimistic updates + panel integration).
- `AppPageHeader` now derives breadcrumb + title from pathname:
  `Personal › Assigned to me / My tasks` for `/app/my-tasks`.
- Sidebar splits the count by icon: Inbox uses global
  `openTaskCount`, My tasks uses the user-scoped version.
- `TasksProvider` gains a hydrate-on-prop-change effect so when
  `revalidatePath('/app', 'layout')` fires after a comment add,
  the fresh server-fetched `initialTasks` (with updated counts)
  reconciles into the client store via a `hydrate` dispatch.

**Verified end-to-end**
- Navigated `/app/my-tasks` — list renders David's 4 tasks
  grouped by lane (TO DO 1, IN PROGRESS 2, DONE 1).
- Sidebar shows distinct counts: Inbox 14 (all open), My tasks 3
  (David's open, excluding the done task).
- Done task shows green check + line-through.
- 0 TS errors, 0 console errors.

**Backlog**
- Inbox route still placeholder (separate cycle — needs a clearer
  notion of "inbox" than just "all open tasks").
- Server-side filter UI (lane / priority / assignee dropdowns).
- Real auth replaces `CURRENT_USER` constant.



## Cycle 9 · 2026-05-05 · Activity log — turn updatedAt into a story

The detail panel's Activity section rendered three hardcoded
placeholder lines. Cycle 8's "edited 3h ago" stamp was a single
integer. This cycle turns every server-side mutation into a typed,
persisted activity row, and the panel renders them as a real feed.

**Backend changes**
- New `activities` table — id PK, taskId FK cascade, userId FK,
  kind text, payload JSON, createdAt timestamp. `_SchemaCoversActivity`
  guard.
- `Activity` type with discriminated `ActivityPayload` union over
  `kind`: `taskAdd | move | toggleComplete | update | commentAdd
  | commentRemove`. Each payload variant carries the data needed
  for line rendering (e.g. `move` has `from` + `to`; `commentAdd`
  has a 60-char `snippet` so deleted comments still surface).
- New `recordActivity(taskId, payload)` helper at
  `src/server/db/activity.ts` — server-only utility (NOT a
  `"use server"` action). Catches and console.warns on failure;
  activity is observability, not transactional.
- `getActivitiesForTask(taskId)` query — desc by createdAt,
  limit 50.
- `getActivitiesForTaskAction` server-action wrapper for
  client-driven reads.
- Wired emissions into every mutation point:
  - `addTaskAction` → `taskAdd` with default lane
  - `moveTaskAction` → pre-reads prior lane, emits `move {from,to}`
  - `toggleCompleteAction` → emits `toggleComplete {to: done|open}`
  - `updateTaskAction` → emits ONE `update` PER tracked field
    changed (concurrent via Promise.all). Untracked fields like
    `idleDays` skipped.
  - `removeTaskAction` → no activity (cascade kills them anyway)
  - `addCommentAction` → emits `commentAdd` with snippet
  - `removeCommentAction` → emits `commentRemove`

**Frontend changes**
- New `src/lib/tasks/use-task-activities.ts` — read-only hook
  mirroring `useTaskComments` (no client mutation; activities
  are byproducts).
- New `src/components/app/detail-panel/activity-feed.tsx`:
  - 16px avatar (smaller than 22px comments — size IS the signal
    of "supporting content"; ~85% scale)
  - Single-line rows: actor name (`font-medium text-ink`) +
    sentence (`text-ink-soft`) + relative time (`tabular-nums
    text-ink-quiet`)
  - `formatActivityLine(payload)` switch with opinionated
    microcopy: "moved this from To do to In progress",
    "marked this complete", "edited the description",
    "commented", etc.
  - Empty state: single line "No activity yet."
- `task-detail-panel.tsx` now fetches activities alongside
  comments, both keyed on `[task?.id, task?.updatedAt?.getTime()]`
  so any mutation refreshes the feed automatically.
- Static `ActivityPlaceholder` removed; `ActivitySkeleton`
  introduced for loading state (2 rows, 16px circle + single
  pill bar — quieter than the 2-line comment skeleton).

**Verified end-to-end**
- Edited description on `t-202`, queried DB:
  `update | {"kind":"update","field":"description"}` row landed
  with current timestamp. Description value persisted to column.
  0 console errors. Type-clean.

**Backlog**
- Activity for assignee changes / tag changes currently renders
  as generic "updated assignees" / "updated tags" because we
  don't diff arrays this cycle. Specific copy ("assigned Chloe",
  "tagged design") needs payload extension (before/after) — later.
- "Show more" pagination for tasks with >50 activities.
- Cross-task feed (e.g. "what changed today") — useful when more
  than one user exists.



## Cycle 8 · 2026-05-05 · Editable description + last-edited stamp

The detail panel rendered an outdated "placeholder paragraph" in
its Description section (referencing cycle 6 plans that already
shipped). Cycle 7 added the column; cycle 8 makes it real, and
audits `updatedAt` so the panel can carry an "edited X ago" stamp
that reflects every kind of activity (lane moves, comments, field
edits).

**Backend changes**
- `bump()` audit: `addTaskAction` now sets `updatedAt` explicitly
  for symmetry; column default still safe-net.
- `addCommentAction` and `removeCommentAction` now touch the parent
  `tasks.updatedAt` via a new `touchTask(taskId)` helper. Comments
  count as engagement.
- `Task.updatedAt: Date` (non-nullable). `rowToTask` surfaces it.
- `SEED_TASKS` literals refactored into `_seedTaskInputs:
  Omit<Task, "updatedAt">[]` then mapped with staggered timestamps
  (`Date.now() - i * 3_600_000`) so the seed renders as a realistic
  "edited Nh ago" gradient on first boot.
- Reducer `update`, `move`, `toggleComplete` cases now bump
  `updatedAt` optimistically so the stamp doesn't lag the UI.

**Frontend changes**
- New `src/components/app/detail-panel/description-editor.tsx`:
  - At-rest: `<p>` with `whitespace-pre-wrap`, 13.5px/1.6
    `text-ink-soft`, NO outline (multi-line + outline = form
    field carnival, against the panel's "document not form" tone).
  - Editing: bare `<textarea>` (no frame), same size/leading as
    at-rest so the swap is sub-pixel. Autoresize via scrollHeight.
    Multi-line is the mode — Enter inserts newline; commit only
    happens on blur or Esc-revert.
  - Empty state: `"Add a description."` (sentence case + period —
    finished sentence, not button label) in `text-ink-faint`.
    Full-section click target. Cursor `text` (I-beam).
  - Hover: `text-ink-soft → text-ink` over 120ms — color promotion
    is the affordance, no glyph, no border.
  - Caret behaviors: click → at click position, keyboard entry →
    end of existing text (the "oh, one more thing" 80% case),
    empty prompt → position 0.
- `panel-header.tsx` — new `<EditedStamp>` rendered beside the
  `T-101` chip in the meta row, separated by a middle dot.
  `text-[10.5px] tabular-nums text-ink-quiet`. Format
  `"edited 3h ago"` (lowercase verb prefix; "3h ago" alone is
  ambiguous). Hidden if mutation < 5s ago. **Mounted-state pattern**
  to avoid SSR hydration mismatch between server and client clocks.
- Old static `<Description />` stub removed.

**Looped back to BUILD once**
- First TEST surfaced a hydration mismatch: server-rendered
  `formatRelativeTime` and `toLocaleString` produced different
  output than the client (clock skew + locale defaults). Fix:
  `EditedStamp` defers all rendering until `useEffect` flips
  `mounted = true` so server emits nothing, client hydrates to
  the actual stamp.

**Verified end-to-end**
- Opened `?task=t-202`, clicked "Add a description.", typed
  "Final cut review with director on Mon. Embed link.", tabbed
  away. DB row's `description` column reflects the typed value.
  0 console errors after the hydration fix.



## Cycle 7 · 2026-05-05 · Add-task flow + description column

Every "+ Add task" / "+ New task" button literally did nothing.
Until the user can create their own tasks, the app is a fancy
viewer of seeds. This cycle ships two complementary creation
surfaces and lays the description column groundwork for cycle 8.

**Backend changes**
- `tasks.description: text` column (nullable). `drizzle-kit push`
  ALTER TABLE non-destructive on existing rows.
- `Task.description?: string` and `rowToTask` mapper coerces NULL
  to undefined.
- `addTaskAction` accepts and persists `description`.
- `_SchemaCoversTask` guard catches type-vs-schema drift.

**Frontend changes**
- `src/components/primitives/dialog.tsx` — reusable dialog
  primitive. Portal'd to body, Esc/click-outside close, focus
  first input + restore prior focus on close, role/aria-modal/
  labelledby. Centered, scale 0.96 → 1 + Y 6 → 0 over 260ms
  ease-out-expo. Reduced-motion: opacity-only 120ms.
- `src/lib/use-keyboard-shortcut.ts` — generic shortcut hook,
  skips when target is editable, when modifiers are held, or
  when explicitly disabled.
- `src/components/app/add-task/`:
  - `add-task-context.tsx` — `<AddTaskRoot>` provider exposing
    `{open, openDialog, closeDialog}`. Mounts the dialog. Binds
    `c` shortcut globally (preventDefault on keydown so the
    keystroke doesn't bleed into the about-to-mount input).
    `openDialog` first calls `closeTask()` so dialog and detail
    panel never stack.
  - `quick-create-dialog.tsx` — 480px centered modal. 17px input
    "Name a task", default "To do" lane chip, `⏎ Create` kbd
    hint. Empty Enter is silent no-op (kbd hint dims `ready` →
    `empty`). On submit: dispatches `addTask`, clears, closes.
  - `inline-composer.tsx` — bare input on lane background (no
    card affordance — reserved for *real* tasks). 220ms ease-
    out-expo height-from-zero entry. Placeholder "What's next?".
    Enter creates and refocuses; Esc cancels; blur with empty
    cancels.
- `BoardApp` tracks at-most-one-open via `composerLane: LaneId | null`.
- `AppPageHeader` "New task" button gains a `C` kbd badge and
  fires `openDialog`.
- `/app/layout.tsx` mounts `<AddTaskRoot>` inside `<TasksProvider>`
  under the existing Suspense boundary.

**Caught during TEST (looped back to BUILD)**
- Initial implementation exposed an `onDraftChange` callback to
  preserve per-lane drafts across re-opens; the unmemoized callback
  identity caused a setState/useEffect infinite loop. Fix: dropped
  the draft-preservation feature for this cycle (logged to
  backlog). Quality gate held — re-tested with 0 console errors.

**Verified end-to-end**
- "+ New task" header button → dialog opens → typed "Created
  from cycle 7 dialog" → Enter → card visible in To do lane →
  DB row persisted (`t-8b065801`).
- Lane "+ Add task" → input focused → typed "Created from
  inline composer" → Enter → card visible → DB row persisted.
- 0 TS errors, 0 console errors.

**Backlog**
- Per-lane draft preservation across re-opens (lost in the
  infinite-loop fix; needs a stable callback pattern via ref).
- Lane / priority pickers in the dialog beyond defaults.
- Title auto-parser (`#tag`, `@user`, `p1`, `due:friday`).



## Cycle 6 · 2026-05-05 · Real comments — first full-stack feature

The detail panel rendered a static deterministic-from-id seed thread
that looked live but wasn't. This cycle replaces it with a real
thread that persists, optimistically renders, and posts via a server
action — the first full-stack feature on the new persistence
substrate. Sets the pattern every "thing that happens on a task"
(activity, mentions, attachments) will follow.

**Backend changes**
- New `Comment` type and `CURRENT_USER` constant in `src/lib/data.ts`.
  `SEED_COMMENT_BODIES` lifted from the static thread file so server
  seed and any future fixtures share one source.
- Schema gains `_SchemaCoversComment` compile-time guard mirroring
  the existing `_SchemaCoversTask` check.
- `getCommentsForTask(taskId)` query in `src/server/db/queries.ts`
  with `rowToComment` pass-through mapper.
- Seed extends to insert ~3 comments per task using deterministic
  hash → user/body picks; `createdAt` staggered so the order reads
  as a real conversation. Independent count check so existing
  comments don't get clobbered.
- New `src/server/actions/comments.ts` —
  `getCommentsForTaskAction`, `addCommentAction`, `removeCommentAction`.
  Each returns the full reconciled `Comment[]` for the task.
  `revalidatePath('/app', 'layout')` after writes.

**Frontend changes**
- New `src/lib/tasks/use-task-comments.ts` — optimistic +
  reconcile hook with `useTransition`. Optimistic comments use
  `temp-<uuid>` ids so removes that haven't reached the server are
  pure local-only.
- New `formatRelativeTime` util — `just now` / `3m` / `2h` /
  `yesterday` / `May 2` / dated. `tabular-nums` so digits don't
  dance.
- `comment-thread.tsx` rewritten:
  - Bare `<textarea>` composer (no frame, no rounded-input shape)
    with autoresize, Enter-to-post (Shift+Enter newline),
    `⏎` kbd hint that becomes a brand-color spinner while pending.
  - Each row reveals a hover-only X for own comments;
    optimistic delete with revert on failure.
  - Empty state: pure type, two lines.
- `task-detail-panel.tsx` fetches comments per task via a
  client-side `useEffect` calling the server action with a
  stale-fetch guard. Shows a 2-row static skeleton during fetch.

**Verified end-to-end**
- Posted "Verified end-to-end from the loop test" via the
  composer; comment renders immediately (optimistic), then
  reconciles with server-truth; row visible in DB query.
- Existing seed shows real authors with relative timestamps.

**Backlog**
- Concurrent multi-user comment updates — current impl re-syncs
  only on panel re-open. SSE / polling channel later cycle.
- Toast UX for server-action failures (still console-warn).
- Comment editing — explicit out-of-scope.



## Cycle 5 · 2026-05-05 · DB foundation — persistence appears

First cycle under the new full-stack directive. Every mutation
previously lived in memory; reload reset state. This is the
foundation that lets every subsequent feature actually persist.

**Backend changes**
- New deps: `drizzle-orm`, `better-sqlite3`, `drizzle-kit` (dev),
  `@types/better-sqlite3`, `tsx`.
- `drizzle.config.ts` at repo root; SQLite dialect, schema at
  `src/server/db/schema.ts`.
- Schema: `tasks`, `users`, `comments` tables. JSON columns
  (`mode: 'json'`) for `assignees`, `tags`, `blockedBy`. `text` with
  TS `$type<>` narrowing for `lane`/`priority`. Comments table has
  FK cascade on task delete; empty this cycle (table-only).
- `src/server/db/index.ts` — singleton via `globalThis._sqlite` so
  HMR doesn't spawn duplicate handles. WAL journal mode.
  `import "server-only"` enforces server boundary.
- `src/server/db/seed.ts` — idempotent transaction-wrapped seed
  from `SEED_TASKS` + `USERS`. Auto-runs on first DB-touching
  request; re-runnable via `npm run db:seed`.
- `src/server/db/queries.ts` — `getTasks()`, `getTaskById()` with a
  `rowToTask` mapper that NULL→undefined coerces (the client `Task`
  type uses optional, not nullable).
- `src/server/actions/tasks.ts` — `moveTaskAction`,
  `toggleCompleteAction`, `updateTaskAction`, `addTaskAction`,
  `removeTaskAction`. Each returns the full `Task[]` for one
  round-trip reconciliation. `revalidatePath('/app', 'layout')`
  after every mutation.
- New scripts: `db:push`, `db:check`, `db:seed`. `dev` chains
  `drizzle-kit push --force && next dev` for zero-touch cold-start.
- `tasks.db*` files added to `.gitignore`.

**Frontend changes**
- `src/lib/tasks/tasks-reducer.ts` — added `hydrate` action so the
  client can replace its task list with the server's authoritative
  result after a mutation.
- `src/lib/tasks/tasks-context.tsx` — dispatchers now do optimistic
  + reconcile via `withServerSync()`: dispatch local action for
  snappy UI, fire server action in `startTransition`, hydrate on
  success, revert via `hydrate(prior)` on failure. Console-warn on
  revert (toast UX arrives with the toast primitive).
- `src/app/app/layout.tsx` — now `async`, `await getTasks()`,
  passes server-fetched tasks to `<TasksProvider initialTasks={...}>`.
  `export const dynamic = 'force-dynamic'` so build doesn't try to
  prerender against an empty DB.
- ID generation moved from a module counter to `crypto.randomUUID()`
  per cycle 3 backlog item.

**Verified end-to-end**
- Toggle "Audit pricing" complete on `/app/list` → DB row is
  `lane='done'` → reload `/app/board` → card renders under Done.

**Backlog**
- `toggleCompleteAction` always sends to "todo" when un-checking
  (no server-side previousLane). Client reducer still has the map
  so optimistic UI behaves correctly; server hydrate creates
  micro-jitter only when un-toggling a task that wasn't originally
  in todo. Reunify in cycle 6.
- Two-tab staleness — server `revalidatePath` doesn't notify other
  tabs. SSE / polling channel later.
- Drizzle migrations workflow (currently `db:push` only).
- Toast UI for server-action failures (currently console-warn).



## Cycle 4 · 2026-05-05 · Task detail panel

Cards on every app view were read-only billboards. Click did nothing.
Until clicking a card opened *something*, every future feature
(comments, AI nudges, dependencies) had nowhere to live. This cycle
turns cards into hyperlinks.

**Added**
- `src/lib/tasks/use-task-panel.ts` — URL-driven open/close hook.
  `?task=<id>` opens the panel; absence closes. Uses native History
  API so browser-back closes for free.
- `src/components/app/detail-panel/` — slide-in panel with field
  editors:
  - `panel-shell.tsx` — overlay + slide animation + ⎋ handler.
    Spring-physics rejected per design rec; 480ms ease-out-expo
    feels working-surface, not toy.
  - `panel-header.tsx` — clickable monospace task ID with
    copy-on-click ("T-101 → copied" 1.1s flash); title input
    (blur to commit, Enter commits, Esc reverts).
  - `field-rows.tsx` — Status (segmented row, always visible
    because most-changed), Priority (popover), Assignees (avatar
    stack with "+" → user picker popover), Due (text input),
    Tags display.
  - `popover.tsx` — primitive with click-outside + ⎋ to dismiss.
  - `comment-thread.tsx` — deterministic seed thread per task
    (hash of id picks user/body/time consistently across opens).
- All four app views wire `onClick` on their card primitives.
  Selected card gets a `var(--brand)` outline at -1 offset; no
  desaturation of others.

**Changed**
- `/app/layout.tsx` mounts `<TaskDetailPanel>` under `<Suspense>`
  per Next 16 `useSearchParams` SSR rules. Panel survives view
  switches (lives in layout, not page).
- List checkbox now `e.stopPropagation()`s so it doesn't open the
  panel while toggling complete.
- Calendar pills became `<button>`s with `min-h-[28px]` for
  touch-friendly hit area.

**Notes**
- This is the last frontend-only cycle under the prior directive.
  Subsequent cycles ship full-stack per the new directive.
- Backlog: stale-id state currently shows briefly before auto-
  closing — UX is acceptable but could improve in cycle 6.



## Cycle 3 · 2026-05-05 · Shared task store — make the app real

Until this cycle, every app route owned its own copy of `SEED_TASKS`
and mutated locally. Drag a card on board, switch to list — still in
its old lane. Four views, four apps. This was the foundational move
that turns "designed views" into "an app."

**Added**
- New `src/lib/tasks/` directory with three pure-ish modules:
  - `tasks-reducer.ts` — pure reducer + types. Actions: `move`,
    `reorder`, `update`, `add`, `remove`, `toggleComplete`. The
    `toggleComplete` action keeps a `previousLane` map so unchecking
    a done task returns it to the lane it came from (Linear-style),
    not always to "todo."
  - `tasks-context.tsx` — client `TasksProvider` mounted in
    `/app/layout.tsx`. Two contexts (state + dispatch) so dispatch-
    only consumers don't re-render on state changes.
  - `selectors.ts` — `groupByLane`, `tasksByLane`, `openTaskCount`,
    `tasksSortedByStartDay`. Pure functions, no React.
- Sidebar now shows an open-task count badge next to Inbox / My
  tasks, computed from the shared store.

**Changed**
- All four app views (`board`, `list`, `timeline`, `calendar`)
  rewired to consume the store. Local `useState<Task[]>` + direct
  `SEED_TASKS` imports replaced.
- Board's drag-to-lane handler now dispatches `moveTask`. Drag UI
  state (`draggingId`, `hoverLane`) stays local — they're per-gesture
  ephemera, not data.
- List checkbox is now interactive: clicking dispatches
  `toggleComplete`; the row's title gets a strikethrough and the row
  reorders into the Done section. `aria-pressed` reflects state.

**Boundary held**
- The cinematic showcase demo on `/` keeps its own state machine
  and is unaffected. The `TasksProvider` is mounted only at
  `/app/layout.tsx`.

**Verified end-to-end** — toggle a task on `/app/list`, navigate via
sidebar to `/app/board` — task appears in Done lane, counts update
across the sidebar.

**Backlog merged into this cycle's followups (low-priority)**
- Swap module-counter id generation for `crypto.randomUUID()` when
  cycle 4 introduces persistence.
- Memoize Card components when task count grows beyond ~50.



## Cycle 2 · 2026-05-05 · Restraint — pacing + cursor labels

Two related defects in tone. Scene-to-scene transitions held for only
~700ms — every second was equally loud. And cursor name pills rode
each cursor permanently, drowning the cards with three constant
labels. The demo read chat-app-y when the brand demands concert-hall.

**Changed**
- Scene runner now inserts a `sceneSettle()` beat (~1600ms; 2000ms
  after the dependency reveal) between every pair of scenes. During
  settle, cursors gently drift toward random nearby points every
  ~700ms so the demo reads alive without firing scripted action.
  Burndown, activity feed, and last-state visuals hold.
- Cursor name labels are now signal, not skin. They appear only when
  a cursor is grabbing, reading a card, or in its 900ms post-arrival
  grace window. Otherwise the cursor is a quiet arrow.
- Per-cursor label fade-out is staggered (chloe 0ms · david 220ms ·
  alex 440ms) so the three labels don't pulse in unison — asynchrony
  reads as life.

**Priority shift**
- Per user direction at end of cycle 2: subsequent cycles focus on
  full app build (real interaction, primitives, depth in app routes)
  rather than further demo polish. Demo work moves to "improvement
  opportunistic" rather than the top of the heuristic.



## Cycle 1 · 2026-05-05 · View morph actually FLIPs

The cinematic showcase demo's view-morph scene previously crossfaded
via `AnimatePresence mode="wait"` — every card unmounted before the
next view mounted, so the shared `layoutId` had nothing to interpolate
between. Net effect: three abrupt fades instead of cards gliding from
column to row to gantt bar. The hero artifact's most ambitious moment
was unfulfilled.

**Changed**
- Replaced the `AnimatePresence mode="wait"` view swap with a unified
  `<DemoSurface>` (`src/components/showcase/demo-surface.tsx`) that
  keeps one set of motion cards mounted at all times. Switching `view`
  now changes the parent layout; motion's FLIP system tweens each card
  from its previous geometry to its new geometry over 720ms with
  ease-out-expo, all 16 cards in concert.
- Card body cross-fades in two stages with a 120ms hole between them,
  so the eye never sees both bodies at 50% (which would white-flash).
- Wrapper chrome (column backgrounds, list table header, gantt grid)
  trails the cards: faint at 15% throughout, rises 280ms starting at
  t=440ms — cards are protagonists, chrome is the room.
- Today indicator on entering timeline draws top-to-bottom over 320ms,
  then the pill snaps in via spring — a single brand-color punctuation.
- Added scene guards: carry no-ops outside board view; view-morph
  no-ops while a card is in flight.
- New `useMorphTransition` hook centralizes durations and respects
  `prefers-reduced-motion`.

**Fixed (during review pass)**
- Timeline geometry: replaced malformed
  `calc(% * (100% - 200px) / 100%)` with absolute positioning inside
  a 200px-gutter-aware track. Bars now land in the correct day cell.
- TodayMarker alignment: removed magic `0.985` fudge factor and
  duplicated 20px gutter; now computed against the same reference
  frame as the bars.
- Duplicated `data-lane` attributes (chrome + card-layer) collapsed
  to a single source on the card-layer column so `querySelector`
  returns the right element for the carry-scene celebration burst.

**Backlog** — see `docs/cycles/backlog.md` for deferred items
(TaskCard/MorphCard reunification, dead-code purge, useMemo on
transitions, stable ref callback).

