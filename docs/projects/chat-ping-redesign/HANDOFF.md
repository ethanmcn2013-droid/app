# Signal Studio chat panel prototype: handoff

Last updated 19 October 2026. Read this whole file before changing anything.

## What this is

A clickable prototype of the redesigned floating chat panel for Signal Studio (app.signalstudio.ie). It is a design and feel prototype only. It does not touch the real app, its database or production, and must not until the founder says so.

- `src/head.html`: all styles (v3 tokens, dark-first, light theme supported) plus the `#root` element.
- `src/app.js`: the whole app. React 18 UMD + `htm` tagged templates (no build step, no JSX). One mutable store `S` with `commit()` and `useStore()`.
- `build.sh`: concatenates both into `signal-chat.html`, a single self-contained page that loads React and htm from cdnjs/jsDelivr.
- `tests/run.mjs`: Playwright click-through of every flow at 1366, 1600, 1440, 1920, 1280 (light), 820, 390 and 360 widths. It serves React/htm from `node_modules` so it works offline, writes screenshots to `tests/shots/`, and prints `no errors` or a list of page errors and failed steps.
- `reference/version-1.html`: the earlier version 1, for comparison only.

Run: `npm install`, `npx playwright install chromium`, then `npm test`. Open `signal-chat.html` in a browser to view it (needs internet for the CDN scripts and Geist font).

## Product decisions already made by the founder (do not reopen)

The plan from pass 6 on is in docs/PLAN-TO-9.md, and the scorecards are in docs/scorecards.md.


- Chat belongs to the person's account, not to projects. No channels.
- Chat lives only in the floating panel opened from the button bottom-right on every page. There is no full-screen chat page.
- Ping can send messages, nudges and invites, as production Ping can, but only as steps in a plan you approve (decided 19 Oct 2026). Delete means archive.
- Ping is a helper inside chat: reachable with @Ping or the "Ask Ping" button in any conversation, replies there privately ("Only you can see this"), and always shows a plan the user approves before anything changes.
- Big screens: the panel can grow to panes and push the page aside, but the page always keeps at least 600px.
- Chat follows the page: on a task page, the panel shows that task's thread ("On this page").
- Real staff photos where available, soft initials as fallback.
- The signature moment "Ping reads, then acts" stays.
- The private space is called "Saved notes".
- Live delivery between people will later use a hosted service such as Ably. The Anthropic API powers Ping only.

## Brand rules (from the app repo; follow exactly)

- Ink, indigo, white. Geist 400 and 600 only. Type scale 11.5 / 12.5 / 13.5 / 15 (24 for page titles).
- The Signal mark is an indigo ring with a centre dot, #6860ff, geometry from `src/lib/brand/suite-mark.tsx` in the app repo: on a tile the ring outer = 0.56 of the tile, stroke = max(0.085 × outer, 1.25), dot radius = 0.205 × outer, tile ink #17171a.
- Identity rule: circles are people, rounded squares are things, the ring-and-dot is Signal. People are never indigo. Amber means urgency only.
- Indigo (decided 19 Oct 2026, following the app's conversation design): indigo is for the Signal mark, Ping's reading edge and dot, selection, primary actions, unread and focus. Never on people, never decoration.
- Motion: "nothing moves without a reason". Timings: Arrival 480ms, Acknowledgement 140ms, Settle 1.15s. Curves: glide (.16,1,.3,1), soft (.32,.72,0,1), snap (.2,.9,.2,1.2). Respect reduced motion with short opacity fades.
- No emoji anywhere. Copy is plain, dry, short sentences, written for non-technical venue staff.
- Sample world: The Orchard wedding venue; Orla Byrne (you, events manager), Niamh Kelly, Aoife Walsh, Dara Quinn, guests Mara Doyle and Finn Brady, vendor Ciarán Byrne. Today is Thursday 16 July, 09:12. Aligned with the app's demo seed on 19 Oct 2026: this Saturday (18 July) is Nora and Cian's wedding, which the run-sheet, marquee and drinks are for; Mara and Finn marry on Saturday 3 October, with their menu tasting on 1 August. Niamh's marquee thread is now between Niamh and Orla only.

## How the work has been judged

Three specialist reviewers plus an experience lens, each scoring out of 10. Run them as independent subagents that read the source and drive the page with Playwright, never as self-review:

1. Identity: avatars, Ping mark, icons, colour roles, accessibility of names.
2. Space: layout at every screen size, density, tap targets, keyboard on phones.
3. Motion and "Ping feels intelligent": choreography, interruptions, timings, and whether Ping reads, reasons and acts like a colleague.
4. Experience: flows and copy for a busy venue manager.

| Lens | Version 1 | Version 2 (latest scored) |
| --- | --- | --- |
| Identity | 4 | 9 |
| Space | 5.5 | 8.5 |
| Motion | 5 | 8 |
| Ping feels intelligent | 3 | 7.5 |
| Experience | 6.5 | 8.5 |

After that scoring, these were fixed but not yet re-scored: Ping message height now animates from the painted height (FLIP), threads start at the top, "active now" is announced to screen readers, the couple avatar faces were separated, and the Guests tag became an icon in narrow headers.

## Pass 1 (19 October 2026)

Baseline before pass 1, from five independent reviewers using the fixed script in `docs/ping-eval.md`: Identity 8, Space 7.5, Motion 7, Ping feels intelligent 5 (7 pass, 5 weak, 13 fail), Experience 7. Ping is now scored as its own lens.

What changed:
- Ping has a small in-page understanding layer (`understand()` in `src/app.js`): intents for questions, tasks, moves, reassigning, marking done, catch-ups, honest limits and memory, with entities for people, dates and times, tasks and "this/that". Answers quote the messages they used and link back to them. Vague requests get one question with tap-to-answer choices. Duplicates are caught. Apply really changes `tasks`, shows the task card and offers one next step (always a draft, never a send). Session memory lives in `S.ping`.
- Quiet help (`suggestFor()`): at most one suggestion per chat, only for a pending decision, a commitment with a time, or a date that matches or clashes with a task.
- Privacy: requests to Ping inside shared chats are private, private messages never render for anyone else, and guests can't browse tasks.
- Motion: no random delays, the ring draws on every run, the reading dot starts in place and fades before the answer, the cited edge always finishes its settle, the ack row opens instead of jumping, reduced motion keeps reading timings without movement.
- Space: the 600px page rule is enforced on drag, saved widths and window size; phone controls are 44px; the composer gives way to the keyboard; rail names show outside the scroller; the wide list is 280px.
- Identity: people tones moved off indigo and amber (clay, slate, stone); @people in text colour, @Ping in indigo; Ping and Saved notes on rounded squares; one meaning per icon.
- Experience: Decline has Undo, Block asks first, search ignores fadas and covers threads and tasks, focus returns to sensible places, Catch up is on phones.
- `npm test` now also checks Ping answers, choices, memory, the couple's privacy, the 600px rule after a maximum drag, and phone tap sizes. `tests/probe.mjs` and `tests/probe-inline.mjs` print Ping's replies for quick checks.

On this machine Playwright's own Chromium version differs from the one the package expects, so run tests with `CHROME_PATH` pointing at the installed Chromium.

## Pass 2 (19 October 2026)

Pass 1 scores from five fresh reviewers: Identity 8.5, Space 7.5, Motion 7.5, Ping 7 (script 21 pass, 4 weak, 0 fail; about 30% of unscripted requests passed), Experience 7. Full notes in `docs/review-notes.txt`.

What changed:
- Ping holds a conversation (`followUp()`): yes, no, undo, "actually make it Saturday", "make it Aoife's", "who has it". It answers in its first sentence and uses the quote as proof, copes with shorthand and typos (`tidy()`), knows who owns what, who is around, who is waiting on you and what to do first, warns about dates after the wedding and unfinished checklists, and says "there's no task here" when there isn't one. While it reads other chats it shows the sources it is reading.
- Needs you now means unanswered (`openAsk()`), with "Mark as handled". @Ping in a shared chat splits: text before it is sent, the rest stays private, and the composer says so before you send. Guests see linked tasks as name and date only. Ping Task on a thread reply no longer crashes.
- Motion: the scroll follows Ping's growth every frame, steps open in 140ms, sources get a minimum dwell, cited edges settle from the end of reading, the wide thread pane opens and closes without reflowing the conversation, closing late in the open animation exits cleanly, the working ring breathes instead of spinning.
- Space: the app sidebar folds to icons below 1280 while chat is open, so the page is pushed aside, not covered; touch screens of any width get 44px targets; long answers anchor at their first line; phone composer is one line with tools in the + menu.
- Identity: mentions are neutral (amber is for urgency only), new light-theme tokens fix two contrast misses, Finn has his own tone, pair avatars are rebuilt, projects use their own colours on squares, Geist Mono is gone.

## Pass 3 (19 October 2026)

Pass 2 scores: Identity 8.5, Space 7.5, Motion 7.5, Ping 7 (script 23 pass, 1 weak, 1 fail; 49% of 45 unscripted), Experience 7.

What changed:
- Privacy: guests can no longer reach Ping at all (`pingRun` returns for any viewer but Orla, and @Ping isn't parsed for guests). `npm test` checks this.
- Broken flows fixed: choices Ping offers inside a thread keep their follow-up in the thread; "Ask Ping about this" on a task with no comments gives a brief on that task (`taskBrief()`); read counts settle when you minimise, close or leave a chat; Esc closes the + menu and the Block confirmation one layer at a time.
- Ping: questions asked inside a chat are answered from that chat (`chatState()`: is it sorted, what did we agree, what's still owed); "what did I decide" leads with your answer (`decided()`); task checklists and notes are searched as facts; "need Niamh to…", "order 6 cases…" and other action sentences become tasks; "who's waiting on me", "what's left on the run-sheet", "push it back a week", "who's the couple", "email the couple" and money questions are handled; a question Ping just asked carries into "give it to Niamh"; re-dating a plan keeps its time.
- Experience, Identity, Space and Motion: the couple see "The Orchard" as a venue tile; indigo is kept for Ping and Signal (counts, NEW and reply links are neutral); one pair avatar form; Finn has an olive tone; the wide thread pane fits; short chats sit by the composer; the 600px push holds down to 1024; the plan footer stays visible; touch targets use invisible hit areas; applied plans let the last tick land before folding; Ping's message only grows; reduced motion fades exits.

## Pass 4 (19 October 2026)

Pass 3 scores: Identity 8, Space 8.5, Motion 8, Ping 6.5 (script 24 pass, 1 weak; 50% of 72 unscripted), Experience 7.5.

What changed:
- Ping now works out who and what is meant before routing: `resolveRefs()` turns he/she/they/them into the person in the chat you're in (or the person last talked about), and `structured()` answers from the task data first: what someone has on, whose a task is, yes/no on a task ("is the tonic sorted?"), counts only with a figure, the wedding, where a file is, what Ping can do. Questions are never treated as commands (`Q_START`). Create requests that also name an owner ("add a task: …, give to Niamh", "can Niamh do…", "put … on Aoife's list") create; "delete" and "draft/reply" are handled honestly.
- Fixed: Ping's chip no longer shows in the couple's view (and the test checks for it); "give it to Niamh" edits the plan on screen or asks which; Catch up agrees with Needs you; Task on a question makes "Decide on …"; "what's still open here" in a task thread gives the brief.
- Identity: pair avatar initials no longer clip, light-theme avatars have a hairline edge, search-jump highlight is neutral, the venue mark is a single O, the top-bar avatar is a button.
- Space: touch tablets and phones get 44px hit areas on plan controls and chips; Catch up moves to the More menu on touch tablets; landscape phones get the phone layout; the tablet panel is full height; wide mode keeps conversation and thread side by side from about 1680px by folding the list to the rail; the sidebar fold animates; the plan footer no longer shows content beneath it.
- Motion: the view glides to Ping's reply if you'd scrolled away; growth is retargeted, not restarted; the single-cite dot fades instead of snapping; the plan says "Saved" when the last tick lands and keeps its height while applying; reduced motion hides the ripples.

## Pass 5 (19 October 2026)

Pass 4 scores: Identity 8.5, Space 8, Motion 8, Ping 7.5 (script 24 pass, 1 fail; 66% of 86 unscripted), Experience 7.5.

What changed:
- Broken flows fixed: asking about a pending plan ("who's it for?") no longer replaces it, and only a new plan supersedes an old one; "make that a task" in a chat uses the message again; "remind me to check the forecast" makes a task instead of a weather refusal; pressing Show on a replaced plan puts the newer one aside, and applying the same task twice links to the first; catch-up, "what first" and the Needs you list now share one model of what needs you (`needMsg()`); the couple's view no longer shows Ping's reading edge or Orla's workspace page (they get their own page); landscape phones use the phone composer (`html.phone`) and hide the header while typing on short screens; the glide to Ping's reply is a real eased scroll.
- Ping routing and scoping: person-scoped late ("anything late for her", "what's late on his list"); your own answer for "what did I tell Aoife about the drinks" and "spritz or prosecco?"; "did Niamh confirm Byrne Events?" says what that person said, or that they haven't; "take the olives off Dara", "give her the marquee task" and a trailing ", Aoife" set the owner; "and the floor walk?" repeats the last question about something new; "anyone waiting on me", "who needs an answer from me", invites, cancelling, contact details and the rain plan are handled; a name alone no longer counts as a search match; one-word questions in a chat search before summarising; shorthand (whens, abt, b4) and times (after lunch, end of day, first thing) are understood; "yes" asks which when there is more than one real option.
- Identity: the pair avatar has larger initials, a hairline edge and one form at every size; indigo is off the composer focus, the new-messages pill, drafts and the editing label.
- Space and Motion: touch chip and resize targets fixed; the New divider fades in place; the make-a-task chip opens its own room; the composer tools close a beat after blur so taps land first; Esc empties search before closing; New message can find Ciarán; focus returns to the composer after a delete.

## Pass 6 (20 October 2026): building to the scorecards

Pass 5 scores: Identity 7.5, Space 8, Motion 7.5, Ping 7 (script 25/25; 57% of 114 fresh), Experience 7.5. After pass 5 the method changed (docs/PLAN-TO-9.md): fixed scorecards (docs/scorecards.md), the same reviewers, a fixed Ping request set (docs/ping-requests.md) and automated checks.

New tools:
- `npm run score` (tests/score.mjs): 29 automated scorecard checks. 17 passed at the start of pass 6; all 29 pass now.
- `node tests/ping-set.mjs [groups]` prints what Ping does for each line of the fixed request set.

What changed:
- Example world aligned with the app's seed: this Saturday is Nora and Cian's wedding; Mara and Finn marry on 3 October, tasting 1 August. Niamh's thread no longer has Aoife in it.
- Motion: content never moves under you. The suggestion keeps its room and fades; with a mouse the composer tools stay open; the typing line and "Seen" keep their room; your own scrolling stops any follow or glide, and if you scrolled away after asking, Ping's reply waits behind the new-messages pill. The dot travels on the 220ms token; Ping's ring keeps its colour while working; the writing caret is neutral.
- Identity: both initials show on two-person avatars at every size; the couple's venue mark is a stone monogram; list focus rings are no longer clipped.
- Space: on touch screens Catch up and Minimise live in More at any width; Catch up becomes its mark below 460px of panel; long task titles take two lines; message actions on touch use the long-press sheet; on phones the header clears the notch, the composer clears the home bar, the header hides only when the keyboard is really up, and a new plan scrolls so Apply is visible; the Prototype menu sits in the list header on phones.
- Ping: sending a message, nudging, commenting, inviting, archiving (delete means archive) and ticking one checklist item are all plan steps you approve, matching production Ping's actions; message and comment text can be edited in the plan; Undo removes what was sent and the words step back, with "Apply again". Plans can be edited by follow-up ("drop the invite one", "give the menu one to Niamh", "make it 11" keeps the day) and questioned ("what time is that for?", "why the 31st?"). Also: several tasks from one list, moving everything of one person's, counts and "which tasks are mine", "what's left on it", before-or-after the wedding, deadlines in a thread, summaries of quiet chats, "what did Ciarán want", honest limits on permissions, file contents and calendars.
- Experience: "what first" counts what it lists; opening a request puts focus on it; offline and failed-send states (Prototype menu > Go offline) with Retry; guests no longer see @Ping styled as live.

## Known open issues, most important first

1. Ping's understanding is rule-based (`ACTION_RULES`, `inferTask`, keyword routing in `pingRun`). It handles the scripted flows well but breaks on anything else. This is the main reason "feels intelligent" is 7.5.
2. When Ping is unsure it guesses instead of asking one short question (for example "Owner: Niamh or Aoife?").
3. Ping is reactive only. Quiet, well-timed proactive help is limited to the "Make this a task?" chip.
4. After Ping applies a plan, the result is a footer line. It should show the created task as a card, link to it, and offer one sensible next step (for example "Tell Niamh it's hers?").
5. Ping has no memory within the session (it does not notice a task it already created, or a plan already declined).
6. The height animation and the reading dot need a fresh motion review on the latest build.
7. Pair avatar initials at 32px are still slightly crowded.

## Rules for the next passes

- Prototype only. Do not open, edit or deploy the Signal Studio app repo or anything in production. Reading the app repo (github.com/ethanmcn2013-droid/app) for reference is fine.
- Keep it one self-contained page built from `src/`. Keep Ping simulated in the browser (no API keys, no server). Real AI can come later in production.
- After every change run `npm test`, look at the screenshots yourself, and fix anything off before reporting.
- Watch for CSS class-name collisions: two real bugs came from this (`.rail` and `.top` were app-shell classes reused inside the panel).
- Never report a score you didn't get from an independent reviewer on the current build.
