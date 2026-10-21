# Scorecards

The fixed measuring stick from pass 6 on. Every pass, the same reviewers score the same checks, so a 9 always means the same thing. Sources: the settled product decisions and brand rules in HANDOFF.md, the app's quality council (`experience/QUALITY_COUNCIL_EVIDENCE.md`), its motion laws (`docs/COMPONENT_AND_MOTION_PLAYBOOK.md`), its conversation design (`docs/projects/project-conversation/design/DESIGN.md`) and production Ping's contract (`src/server/ping/assistant/`).

## How a score is worked out

- Each check is **pass** (1), **partial** (½) or **fail** (0). A check passes only if it holds everywhere it applies: both themes, every viewport in its test, both Orla's and the couple's view.
- Score = 10 × points ÷ number of checks, rounded down to the nearest half. **A 9 needs 90% of the points.**
- **Blockers**: if any blocker check fails, the lens is capped at 7, whatever the other checks say.
- Viewports: 390×844 and 360×640 phone (touch), 844×390 phone on its side (touch), 820×1180 tablet (touch), 1024×768 and 1366×1024 touch laptop, 1280×800, 1366×900, 1440×900, 1600×900, 1920×1080, 2560×1440 (mouse).
- Reviewers also explore freely. New findings go on a separate list, and the scorecard only changes if Ethan agrees to add a check.
- Done: every lens at 9 or above on two passes in a row.

## Identity (20 checks)

1. **Blocker.** People are never indigo: no avatar, name or presence mark uses indigo.
2. Indigo appears only on the Signal mark, Ping's reading edge and dot, selection, primary actions, unread and focus. Nothing decorative.
3. The Signal mark follows `suite-mark.tsx` geometry (ring 0.56 of the tile, stroke max(0.085 × ring, 1.25), dot 0.205 × ring, ink tile #17171a) at every size it appears.
4. Circles are people and rounded squares are things, everywhere: list, headers, rail, pills, peek, pages, the couple's view.
5. **Blocker.** Every person's initials are fully visible, at every avatar size from 20 to 48px, in both themes.
6. Two-person avatars show both people clearly at every size, in one consistent form.
7. Geist only, weights 400 and 600 only (checked on computed styles).
8. Type sizes come only from the scale 11.5 / 12.5 / 13.5 / 15 / 24, apart from avatar initials, which have their own written size table.
9. Spacing sits on the 4px grid; corner radii come from 6 / 8 / 12 / 16 or a full circle.
10. Amber means urgency only and red means late or failed only. No other colour carries meaning.
11. One icon set: 16px, 1.5 stroke, one meaning per icon across the panel.
12. **Blocker.** Body text reaches 4.5:1 contrast and controls 3:1, in both themes.
13. Every interactive element has a visible, unclipped focus ring of the same style.
14. Buttons come in three styles only (primary, secondary, link), with at most one primary per view.
15. Messages sit open on the canvas, not in bubbles. Ping's messages are marked by its tile and reading edge, not by a different layout.
16. Ping looks the same everywhere it speaks: mark, "Only you can see this", thinking state with the ring kept at full colour.
17. The couple's view has its own finished identity (venue mark, their page) and shows nothing of the venue's workspace.
18. Empty, loading, sending, failed and offline states are styled within the same system.
19. **Blocker.** No emoji, and no exclamation marks in interface copy.
20. A cropped screenshot of any view is recognisably Signal Studio (reviewer's judgement, with one sentence on why).

## Space (20 checks)

1. **Blocker.** With chat open, the page keeps at least 600px at every width from 1024 up, including after dragging the panel to its widest.
2. **Blocker.** No horizontal scroll and nothing cut off the screen, at every listed viewport.
3. Each width gets the right layout: phone sheet below 600 and on phones on their side, floating panel on tablets, single panel on laptops, rail from 1440, side-by-side panes from 1760.
4. **Blocker.** On touch, every control is at least 44 × 44px, at any width, laptops included.
5. Header titles keep at least 140px. Controls fold into More before a name is cut.
6. **Blocker.** With the keyboard up (phone portrait and on its side, tablet), the composer and the newest message stay visible, and a new plan's Apply is reachable without scrolling by hand.
7. Phone layouts respect the notch and the home bar, top and bottom.
8. Plan Cancel and Apply are always reachable and stay put at the bottom of a long plan, with nothing showing beneath them.
9. Every plan control fits at the narrowest panel (336px) without wrapping into a mess.
10. The panel's resize edge can be found, is at least 8px wide for a mouse and 44px for touch, works from the keyboard and remembers its width.
11. On wide screens, opening a thread never reflows the conversation, and a width you set is kept.
12. Long content never breaks the layout: long names, long messages, long task titles, 50-message chats, a 10-step plan.
13. Message lines are at most 68 characters wide on wide panes.
14. Menus, popovers, toasts and suggestions stay on screen and never cover what they refer to.
15. Tablets follow the visible screen when the keyboard opens.
16. Usable at 200% browser zoom on a 1366 laptop.
17. The couple's view fits at every viewport.
18. List rows line up, with consistent heights, sections and counts.
19. Scroll areas never clip focus rings or shadows.
20. The prototype's own controls (Prototype menu) can be reached on every viewport.

## Motion (18 checks)

1. Only the motion tokens are used: 80 / 140 / 220 / 480ms and 1.15s, with the glide, soft and snap curves.
2. Nothing that survives a change is redrawn: no flash, remount or re-fade of something that was already there.
3. **Blocker.** Content never moves under the pointer or the reader without the user causing it. Measured: no visible message, button or plan moves more than 2px, except the newest item growing at the bottom. This covers arrivals, typing, "Seen", the make-a-task suggestion, the composer opening and closing, the New divider and toasts.
4. The object leads and the container follows: panel open, plan fold, thread pane.
5. Frequent actions are short (140ms or less, no sliding). Only rare moments use 480ms.
6. Motion never makes you wait: every control works at once, and Ping's reading takes no longer than the work, about 2s or less for a simple question.
7. **Blocker.** User input always wins: scrolling, typing or clicking stops any automatic scroll or glide straight away.
8. Everything that enters has a matching exit: the suggestion, toasts, menus, plan rows, undo, the thread pane, the peek.
9. Animations can be interrupted and reversed smoothly mid-way.
10. "Ping reads, then acts" is legible and in order: steps, the dot travelling across cited messages, edges settling, the answer streaming, plan rows arriving.
11. Apply and Undo do one thing at a time: the tick lands, then "Saved", then the fold. Undo runs the same steps backwards, words included.
12. Opening and closing the panel keeps its size during the exit, and the page moves in step.
13. Scrolling: at the bottom, new messages keep you at the bottom. Scrolled away, a "new messages" pill appears instead. The glide to Ping's reply happens only if you haven't scrolled since asking.
14. **Blocker.** With reduced motion on, every movement becomes a fade of 140ms or less, ripples and travelling dots are off, and nothing is missing or invisible.
15. Smooth: no frame longer than 50ms during any animation on a 1366 laptop.
16. Switching theme or resizing the window doesn't animate anything that shouldn't move.
17. Hover and press feedback arrives within 80ms everywhere.
18. Every animation has a stated reason in the handoff's motion table.

## Ping (20 checks)

Ping here means the design of Ping in chat. Its true understanding is the production model's job and is tested there with the eval cases this project hands over. The prototype's stand-in only has to handle the fixed request set (`docs/ping-requests.md`, written in pass 6: about 60 requests covering every action production Ping can plan).

1. The fixed script in `docs/ping-eval.md` passes, all 25 lines.
2. The fixed request set passes at 90% or more, with no request handled wrongly in a way that changes data.
3. **Blocker.** Nothing changes until you press Apply on a plan. Sending a message, nudging and inviting are plan steps too.
4. Plans can be edited on screen: owner, date and removing a step, for every kind of step.
5. Follow-ups edit the waiting plan: a new date, owner or time ("make it 10am" keeps the day), "drop the invite one", "give the menu one to Niamh".
6. Questions about a waiting plan are answered from the plan ("who's it for?", "what time is that?", "why the 31st?").
7. Undo works after every kind of change, and the words above the plan step back with it.
8. Every answer that uses a chat or task cites it, with a link that opens the exact message. In-chat sources get the reading edge.
9. Missing or ambiguous names, dates or content get one short question with tap-to-answer options. Ping never invents a task, person or fact.
10. What Ping can't do is said plainly, with the nearest useful thing it can do: payments, bookings, weather, permanent delete, permissions, reading inside files.
11. Follow-ups keep their context: "her", "it", "and the floor walk?", "which ones are Aoife's?".
12. Questions inside a chat are about that chat: summarise this, what's the latest, what did X want, who needs this by when.
13. Checklist items are handled as items ("tick off kitchen service times" ticks that item, not the whole task).
14. **Blocker.** Privacy: Ping's replies in shared chats are private, guests never see Ping or anything it said, and Ping never shows the venue's internal work in a guest chat.
15. Quiet help: at most one suggestion per chat, at the right message, easy to dismiss, never shown again once dismissed, and never wrong about dates.
16. Progress is honest: plain step labels, a clear working state, and partial success said as such ("Two of three saved").
17. "What have you done today?" lists every change with a link, including undone and cancelled ones.
18. Answers lead with the answer in plain, short sentences. A yes or no question gets yes or no first.
19. Plans match production Ping's actions and limits: create, update, archive (delete means archive), comment, nudge, send, invite, read; up to 20 steps, 100 tasks and 20 recipients; nudges respect mute and the 24-hour cooldown.
20. **Blocker.** Ping never states a fact the chats and tasks don't support.

## Experience (20 checks)

1. **Blocker.** The example world agrees with itself everywhere: dates, roles, who said what, and Ping's answers.
2. Morning triage agrees: the Needs you list, Catch up and "what should I do first" name the same items with the same counts, and marking something handled updates all three.
3. **Blocker.** Every count is right: badges, unread, "N more", Home's summary.
4. Unread follows the app's rule: a direct message counts every unread message; group and task threads count only mentions of you.
5. **Blocker.** No dead ends. Each of these completes and can be undone or left cleanly: send, reply in a thread, mention, link a task with #, edit, delete, make a task from a message, apply and undo, search and jump, accept, decline and block a request, settings, a task page's thread, minimise, peek and reopen, start a new message with anyone.
6. Keyboard only: every flow works, and after every open, close, send or delete, focus lands somewhere sensible.
7. Esc steps back one layer at a time: menu, then search, then view, then panel.
8. Screen readers: labelled landmarks and views, every control named, new messages and Ping results announced. **Blocker** if axe reports any serious issue.
9. Copy is plain, consistent and names each thing the same way everywhere.
10. The couple's experience is complete, private and makes sense on its own.
11. Every state exists: empty, loading, sending, failed send with retry, offline, long.
12. Destructive actions offer Undo, and toasts never cover what they refer to.
13. Chat follows the page: on a task page, its thread is one tap away, labelled "On this page".
14. Phone flows work end to end at 390×844.
15. Everything responds within 100ms of a tap or key.
16. Message requests explain who is asking and what they will and won't see.
17. Notifications settings are short, plain and take effect.
18. Search finds people, messages and tasks, ignores accents, and jumps to the exact message.
19. Drafts are kept per chat when you move between chats.
20. Mentions and replies to you are easy to find again later.
