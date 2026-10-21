# Plan to an average of 9

Written 19 October 2026, after pass 5 and a read of the app repo (github.com/ethanmcn2013-droid/app at 2afe37a). Prototype only. Nothing here touches the app repo or production.

## What the app repo showed

- **Production Ping** is a planner on Claude Sonnet 5.5 (`src/server/ping/assistant/claude-planner.ts`). Each request is one call returning a JSON plan from a closed set of actions: create_tasks, update_tasks, archive_tasks, add_comment, nudge_tasks, invite_members, send_message, open_project, open_chat, read_chat, list_tasks, read_timeline, preview_timeline. It can also return a clarification or "unsupported". It sees only names: the actor, projects, members, counts, today's date and time zone. It does not see chat messages, task titles, earlier turns or the current page. It runs plans straight away unless "Draft only" is ticked, shows no sources and has no Undo button. It lives in a Ping tab of the floating chat panel, and @Ping does not exist yet.
- **The prototype's Ping is the next design of that**: it reads chats, cites sources, shows a plan you approve, keeps the thread of the conversation and works through @Ping. Its "intelligence" in the prototype is a keyword stand-in, so its free-request score measures the stand-in, not the product.
- **Example world**: the app's seed pins the clock at Thursday 16 July 2026, 09:00 Dublin. Mara and Finn's wedding is 3 October 2026 and their menu tasting is 1 August. The prototype wrongly put their wedding on Saturday 18 July, which made the dietary list, floor walk and tasting fall after the wedding.
- **Indigo**: the app's conversation design reserves indigo for "selection, action, unread, and focus", and the brand rule is that people are never indigo. The pass 5 reviewer brief said indigo only for the mark and Ping. That was stricter than the real rule and cost Identity points.
- **A real quality bar exists**: `experience/QUALITY_COUNCIL_EVIDENCE.md` scores 13 dimensions from 0 to 4 per state and viewport, counts the lowest score not the average, and sets hard blockers (no serious accessibility issues, no overflow, keyboard and reduced motion pass, 44px targets). Motion has four written laws in `docs/COMPONENT_AND_MOTION_PLAYBOOK.md`.

## Why the scores stalled

1. A new reviewer each pass, each with their own idea of a 9, so half-point moves are noise.
2. Fixing each reviewer's list instead of meeting a fixed standard, with no tests to stop regressions.
3. Grading a keyword stand-in as if it were Ping's real understanding.
4. Example data that contradicts itself.
5. A brand brief that was stricter than the real brand rule.

## The plan

### Step 1. Fix the measuring stick (no building)
- One scorecard per lens: 20 to 30 specific checks a 9 requires, built from the Quality Council dimensions, the motion laws, the brand rules and the settled product decisions. Each check says how to test it and what a pass looks like.
- The five lenses stay: Identity, Space, Motion, Ping, Experience. Ping is judged on what the prototype decides (reading, sources, plans, approval, edits, undo, follow-ups, honesty, privacy, quiet help) plus a fixed set of requests the stand-in must handle. Real understanding is measured against Sonnet in production, not here.
- Score per lens = checks passed, mapped to 10, with hard blockers that cap the score.
- The same five reviewers across passes, resumed with memory, so they compare like with like. Free exploration still happens, but new findings go on a separate list.
- Ethan approves the scorecards before any building.

### Step 2. Fix the foundations
- Align the example world with the app's seed: Mara and Finn's wedding on 3 October, tasting 1 August, dietary list before it. This Saturday's run-sheet and marquee belong to another couple's wedding.
- Every past reviewer finding becomes an automated check, so it can't come back.

### Step 3. Build to the scorecard, in small passes
- Fix failing checks lens by lens. Each change is checked on screen before the next. No more 30-change passes.
- Rebuild the stand-in's understanding to produce the same kinds of plan as production (create, update, archive, comment, nudge, send, read), so the prototype shows exactly what the real Ping will do.
- Reviewers re-score with the same scorecards. Done when every lens is at 9 or above on two passes in a row, with no hard blocker.

### Step 4. Hand Ping's lessons to production
- Turn the 300+ reviewer requests into cases in the app's own eval format (`experience/ping-assistant/model-cases.json`, v1), kept in this prototype folder for Ethan to use.
- A short gap list of what the real Ping needs to match the design: chat messages as context, earlier turns, the waiting plan, who "her" means, sources to cite, a review-then-apply step and Undo.
