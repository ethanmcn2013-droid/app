# Tasks concept sprint: cloud session prompt

Paste everything below the line into a new Claude Code cloud session on the `ethanmcn2013-droid/app` repository.

---

This is the **Tasks redesign sprint** for Signal Studio. I am the founder and you have my full authority on design for this sprint: don't be held back by existing contracts, constraints or what exists in the back end. The goal is world-class design and user experience, not "good enough".

**What I want:** five genuinely different concept directions for each of the three Tasks views (**board**, **list** and **calendar**), which makes 15 concepts. Each one goes through the same loop: a creative director sets five distinct directions per view, a designer-engineer builds each one, then two rounds of an independent critic followed by a skeptical refinement. At the end, give me a single HTML gallery I can open and choose my favourites from. These are concepts only: front end, rich sample data, no back end.

**Setup (do this first):**

1. Check out the branch `design/tasks-concepts`, and work and commit only on that branch. Never force-push, and never touch `main` or other branches.
2. Install dependencies and browsers:
   ```bash
   pnpm install
   pnpm exec playwright install chromium
   ```
3. Start the review-mode dev server in the background. It needs no secrets and never touches a database.
   ```bash
   NEXT_PUBLIC_SIGNAL_ACCESS_MODE=review SIGNAL_ACTIVE_PROJECT_V3_ENABLED=true pnpm exec next dev --port 3217
   ```
   Wait until `http://localhost:3217/app/tasks` returns 200. Turbopack can crash on an internal bug when a mid-edit file fails to compile. If it does, restart it; running it inside a `while true; do …; sleep 2; done` loop is the easiest fix.
4. Check the screenshot helper works:
   ```bash
   node scripts/design/concept-shot.mjs app/concepts/board/1 /tmp/check.png 1440 900 light
   ```

**Run the sprint:** use the Workflow tool with the committed script:

- `scriptPath`: `docs/design/concept-sprint/tasks-concept-sprint.workflow.js` (use the absolute path of your checkout)
- `args`: `{ "worktree": "<absolute path of your checkout>", "port": 3217 }`

I'm explicitly asking you to run this multi-agent workflow.

The gallery slots already exist in `src/components/concepts/{board,list,calendar}/c1..c5`, and the gallery index is `/app/concepts`. Each builder owns only its own folder.

**If the run stops** (usage limit, network, anything): don't start over. Resume with the same `scriptPath` and `resumeFromRunId`. Finished steps replay from cache, and every builder is told to continue from what is already in its folder. Before resuming, read the run's `journal.jsonl` to see what finished.

**Standards the workflow already carries, which you should also hold yourself to:**

- Use only the v3 design tokens (`src/ds/v3.css`). Light and dark must both look right.
- WCAG AA text, and 3:1 contrast for UI elements.
- Sentence case, plain words, no exclamation marks, never the word "workspace".
- A great phone layout.
- Every concept must look production-grade, not a wireframe.

**When it finishes:**

1. Make sure `docs/design/concept-sprint/tasks-gallery.html` exists (self-contained, with images embedded). Publish it as a private Artifact page and give me the link.
2. Push the branch and open a draft PR from `design/tasks-concepts` into `design/suite-redesign-v3` titled "Tasks concept sprint: 15 concepts". List the concepts with a screenshot each, and your top pick per view with one line on why.
3. Report back with the gallery link, the draft PR link, and anything that failed or was skipped.
