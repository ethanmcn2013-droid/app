export const meta = {
  name: 'tasks-concept-sprint',
  description: 'Five world-class concepts each for the Tasks board, list and calendar: slate, build, two critique and refine rounds, HTML gallery',
  phases: [
    { title: 'Slate', detail: 'one creative director per view sets five maximally distinct directions' },
    { title: 'Build', detail: 'one designer-engineer per concept builds it on sample data' },
    { title: 'Critique', detail: 'independent critic reviews renders, round 1' },
    { title: 'Refine', detail: 'apply valid critique, round 1' },
    { title: 'Critique 2', detail: 'fresh critic, round 2' },
    { title: 'Refine 2', detail: 'final polish and gallery thumbnail' },
    { title: 'Gallery', detail: 'build the static HTML gallery for the founder' },
  ],
}

// Pass args: { worktree: "<absolute path of the repo checkout>", port: 3217 }
const WT = (args && args.worktree) || '.'
const PORT = (args && args.port) || 3217
const SHOTS = `${WT}/concept-output/tasks`
const SHOT = `node scripts/design/concept-shot.mjs`

const CONTEXT = `
Context: Signal Studio — a project-management suite (Tasks, Timeline, Messages, Files, Analytics, Notes) for small teams: event venues, wedding planners, agencies, small businesses, students and teachers. This is the TASKS CONCEPT SPRINT. The founder wants the Tasks views taken to world class: "nuke it, ideate, iterate", "don't be held back by what exists in the back end — add, remove, invent", "five different options for me to choose from for each view", "concepts, then critiques, refinements and fixes". These are CONCEPT views: front-end only, rich invented sample data, no backend wiring, no server actions. Quality of design and UX is everything. References at their best: Linear, Height, Notion, Asana, Monday, ClickUp, Things, Todoist, Trello, Sunsama, Akiflow, Cron/Notion Calendar, Fantastical, Apple Reminders, Arc, Raycast, Vercel, Stripe, Figma.
Worktree: ${WT} (run every command there). Branch design/tasks-concepts. Commit your concept folder and push the branch at the end of your step (git add only your own folder; other agents commit theirs). Never force-push, never rewrite history, never touch other branches.
Concept gallery: each concept lives ONLY in its own folder src/components/concepts/<view>/c<n>/ (<view> is board, list or calendar; index.tsx default export = the page component, meta.ts = { view, n, title (2-4 words), thesis (one sentence) }, plus any files you add inside that folder: components, CSS modules, sample data). Routed at /app/concepts/<view>/<n> inside the real app shell (sidebar + top bar already present — do not rebuild global navigation; your page fills the content area, which scrolls: make your root flex:1; min-height:0; overflow:auto). NEVER edit files outside your own concept folder. If the page needs client interactivity, put "use client" at the top of index.tsx or child components. No new npm dependencies (check package.json; motion/react is available).
The current production-candidate Tasks UI to beat (study, don't copy): /app/tasks (board), /app/tasks/list, /app/tasks/calendar, the task sheet (open a card) — source in src/components/tasks/** and src/components/app/detail-panel/**; spec docs/design/v3/tasks.md. v3 look reference: src/components/app/home/*.
Design system: src/ds/v3.css — use var(--v3-*) tokens for all colour (canvas, surface, sunken, fill, hover, selected, row-selected, border, border-strong, control-border, text, text-2, text-3, accent, accent-hover, accent-soft, accent-text, on-accent, danger/-soft/-text, warning/-soft/-text/-stroke, success/-soft/-text, review/-soft, kind-* colours, project-1..8 identity + project-ink, shadow-1, shadow-pop, scrim, radius-*, ease). You may add local custom properties inside your folder, but light and dark must both look right, all text must pass WCAG AA (never put coloured text on its own tint without the -text token), non-text UI 3:1. Voice: plain, active, sentence case, no exclamation marks, no uppercase tracked labels. Never write "Workspace"/"workspace" in visible text (the noun is "Project"). No jargon.
Stack: Next.js (breaking changes vs your training; stay inside plain React components), React 19, CSS modules (pure selectors: every selector contains a local class), lint error on setState inside useEffect bodies. Must include an h1.
Dev server: http://localhost:${PORT} in review mode (sample data, no login, no secrets, no database), started by the coordinator with NEXT_PUBLIC_SIGNAL_ACCESS_MODE=review SIGNAL_ACTIVE_PROJECT_V3_ENABLED=true pnpm exec next dev --port ${PORT}. Never start a second server; if it is down, tell the coordinator in your report. Screenshots: ${SHOT} app/concepts/<view>/<n> <out.png> <width> <height> <light|dark>. For interaction states write a small Playwright script modelled on scripts/design/concept-shot.mjs. Save under ${SHOTS}/.
Checks for your folder: pnpm exec tsc --noEmit -p . (0 errors in your folder; ignore sibling folders being built in parallel) and pnpm exec eslint src/components/concepts/<view>/c<n> (0 errors).
`

const VIEWS = [
  { key: 'board', name: 'Tasks board (Kanban)', job: 'see work move through stages, pick up the next thing, drag work along, spot what is stuck or overloaded, add tasks fast; must work for a venue team of 3 and a student group of 5.', seeds: 'classic columns perfected (Linear/Trello quality); swimlanes by person or project; a focus board that shows only what matters today; a flow board that shows ageing and bottlenecks; a spatial/sticky-note board that feels like a wall' },
  { key: 'list', name: 'Tasks list', job: 'scan, sort, group and edit many tasks quickly; the power view for planners who live in their list.', seeds: 'keyboard-first dense list (Linear); grouped outline with nesting and progress; a spreadsheet-style table with inline editing; a today/next/later triage list (Things/Sunsama); a conversational list that reads like a checklist of commitments' },
  { key: 'calendar', name: 'Tasks calendar', job: 'see when work is due and plan time around it: month, week, and agenda; drag tasks onto days; see load per day and per person.', seeds: 'month grid perfected (Fantastical quality); week planner with time blocks and an unscheduled tray (Sunsama/Akiflow); workload heat calendar per person; a countdown calendar to the big date; an agenda river that merges tasks and milestones' },
]

const SLATE = {
  type: 'object',
  properties: {
    concepts: {
      type: 'array', minItems: 5, maxItems: 5,
      items: {
        type: 'object',
        properties: {
          n: { type: 'number' }, title: { type: 'string' }, thesis: { type: 'string' },
          brief: { type: 'string' }, signature: { type: 'string' }, avoid: { type: 'string' },
        },
        required: ['n', 'title', 'thesis', 'brief', 'signature', 'avoid'],
      },
    },
  },
  required: ['concepts'],
}
const REPORT = {
  type: 'object',
  properties: { summary: { type: 'string' }, checks: { type: 'string' }, screenshots: { type: 'array', items: { type: 'string' } } },
  required: ['summary', 'checks', 'screenshots'],
}
const FINDINGS = {
  type: 'object',
  properties: {
    score: { type: 'number' },
    findings: {
      type: 'array',
      items: {
        type: 'object',
        properties: { id: { type: 'string' }, severity: { type: 'string', enum: ['high', 'medium', 'low'] }, problem: { type: 'string' }, evidence: { type: 'string' }, proposal: { type: 'string' } },
        required: ['id', 'severity', 'problem', 'evidence', 'proposal'],
      },
    },
  },
  required: ['score', 'findings'],
}
const GALLERY = {
  type: 'object',
  properties: { htmlPath: { type: 'string' }, artifactUrl: { type: 'string' }, summary: { type: 'string' } },
  required: ['htmlPath', 'artifactUrl', 'summary'],
}

phase('Slate')
const slates = await parallel(VIEWS.map((v) => () => agent(`${CONTEXT}
You are the creative director for the ${v.name} view. Its job: ${v.job}
Starting ideas (push beyond them, replace any that are weak): ${v.seeds}.
Study the current Tasks ${v.key} view and the v3 system (take a couple of screenshots, read the code), then define FIVE maximally distinct concept directions — different mental models, layouts and interaction paradigms, not five skins of one layout. Each must be a credible world-class product direction on its own. For each: n (1-5), title (2-4 words), thesis (one sentence), a rich build brief (layout at desktop and phone, key components, the invented sample data it needs — use The Orchard venue / Mara & Finn wedding world plus a student group and a small agency —, 2-3 signature interactions or moments of delight, empty/edge states worth showing), signature (the one thing people will remember), avoid (what would make it generic). Do not edit files.`, { label: `slate:${v.key}`, phase: 'Slate', schema: SLATE })))

const items = []
VIEWS.forEach((v, i) => {
  const slate = slates[i]
  if (!slate) { log(`slate failed for ${v.key}; its five concepts are skipped`); return }
  for (const c of slate.concepts.slice(0, 5)) items.push({ view: v, c })
})

const folder = (it) => `src/components/concepts/${it.view.key}/c${it.c.n}`
const route = (it) => `app/concepts/${it.view.key}/${it.c.n}`
const tag = (it) => `${it.view.key}-${it.c.n}`

const critique = (it, round, prev) => agent(`${CONTEXT}
You are a demanding, fresh design critic (design lead at Linear/Vercel/Figma), round ${round}, reviewing concept "${it.c.title}" for the ${it.view.name} view (folder ${folder(it)}, route /${route(it)}).
Thesis: ${it.c.thesis}. Signature: ${it.c.signature}. Avoid: ${it.c.avoid}.
${prev ? `Previous round's report: ${prev}` : ''}
Take your own screenshots: 1440x900 light, 1440x900 dark, 1440x1600 light (tall), 1024x768 light, 390x844 light, plus 2-3 interaction states (drag, hover, open panels, menus) under ${SHOTS}/${tag(it)}-critique${round}-*.png, and LOOK at each. Read the code. Score it 1-10 against world class (be honest; 9+ means it could ship on linear.app), then list at most 10 findings that most raise it: hierarchy, typography, spacing, alignment, density, colour, iconography, motion, states, responsiveness, accessibility (contrast, focus, keyboard), microcopy, and whether the thesis/signature lands. Real bugs (overflow, clipping, broken dark mode, console errors) are high. Each: problem, evidence (screenshot + where), precise proposal. Do not edit files.`, { label: `critique${round}:${tag(it)}`, phase: round === 1 ? 'Critique' : 'Critique 2', schema: FINDINGS })

const refine = (it, round, f) => agent(`${CONTEXT}
You are the designer-engineer who built concept "${it.c.title}" (${it.view.name} view, folder ${folder(it)}). Round ${round} critique (score ${f?.score}):
${JSON.stringify(f?.findings ?? [], null, 1)}
Be a skeptical owner: apply every finding that is real and makes it better; skip (and say why) any that is wrong, taste-neutral or dilutes the thesis. Then go beyond: fix anything else you see. Re-verify: tsc (your folder clean), eslint on your folder, screenshots 1440x900 light and dark, 390x844 light, and the interaction states you touched, under ${SHOTS}/${tag(it)}-refine${round}-*.png — LOOK and iterate.${round === 2 ? ` Finally save the gallery shots: ${SHOT} ${route(it)} ${SHOTS}/final/${tag(it)}-light.png 1440 900 light, the same with dark (${tag(it)}-dark.png), and ${SHOT} ${route(it)} ${SHOTS}/final/${tag(it)}-phone.png 390 844 light, and make sure meta.ts has the final title and thesis.` : ''} Commit your folder and push. Report what you applied/skipped, checks and screenshot paths.`, { label: `refine${round}:${tag(it)}`, phase: round === 1 ? 'Refine' : 'Refine 2', schema: REPORT })

const results = await pipeline(
  items,
  (it) => agent(`${CONTEXT}
You are the principal designer-engineer building concept ${it.c.n} for the ${it.view.name} view: "${it.c.title}".
Thesis: ${it.c.thesis}
Brief: ${it.c.brief}
Signature: ${it.c.signature}
Avoid: ${it.c.avoid}
IMPORTANT: a previous builder for this concept may have been cut off part-way through. If ${folder(it)} already contains substantial work, DO NOT start over: audit it (read every file, take screenshots), keep what is good, finish what is incomplete and fix what is broken. Only if the folder holds just the stub, build from scratch.
Build it completely in ${folder(it)}: replace the stub index.tsx, write meta.ts (title, thesis), add components, a CSS module and a sample-data module inside the folder. Make it feel real and alive: believable data, real-feeling interactions (drag and drop, inline edit, filters, selection, hover cards, panels, keyboard shortcuts where natural), tasteful motion (respect prefers-reduced-motion), every state that matters, great phone layout. Invent any feature that makes it world class, but it must look production-grade, not a wireframe.
Verify: tsc (your folder clean), eslint on your folder, and screenshots at 1440x900 light, 1440x900 dark, 390x844 light plus key interactions under ${SHOTS}/${tag(it)}-build-*.png. LOOK at each and iterate at least three times until it is genuinely world class. Commit your folder and push. Report a summary, checks and screenshot paths.`, { label: `build:${tag(it)}`, phase: 'Build', schema: REPORT }),
  (b, it) => critique(it, 1, b?.summary).then((f) => ({ b, f1: f })),
  (x, it) => refine(it, 1, x.f1).then((r1) => ({ ...x, r1 })),
  (x, it) => critique(it, 2, x.r1?.summary).then((f2) => ({ ...x, f2 })),
  (x, it) => refine(it, 2, x.f2).then((r2) => ({
    concept: tag(it), view: it.view.key, n: it.c.n, title: it.c.title, thesis: it.c.thesis, signature: it.c.signature,
    score1: x.f1?.score ?? null, score2: x.f2?.score ?? null,
    final: r2?.summary ?? null, checks: r2?.checks ?? null,
  })),
)

phase('Gallery')
const done = results.filter(Boolean)
const gallery = await agent(`${CONTEXT}
You are assembling the founder's review gallery for the Tasks concept sprint. Results:
${JSON.stringify(done, null, 1)}
1. Make sure every concept has its three final shots in ${SHOTS}/final/ (<view>-<n>-light.png, -dark.png, -phone.png); take any that are missing with ${SHOT}.
2. Build ONE self-contained HTML page at ${WT}/docs/design/concept-sprint/tasks-gallery.html: every image embedded as a data URI (so it works anywhere), grouped Board / List / Calendar, five concepts each; per concept: number, title, thesis, signature, the round 1 and round 2 critic scores, the light shot large, the dark and phone shots beside it, click-to-zoom lightbox, and a "how to open it live" note (/app/concepts/<view>/<n> on the review dev server). Use the Signal Studio v3 look (ink sidebar feel, indigo #4f46e5 accent, clean sans type), light and dark via prefers-color-scheme, sentence case, no exclamation marks. Keep it under 15 MB (compress screenshots to JPEG quality 82 if needed).
3. Publish it with the Artifact tool (load the artifact-design skill first if available; one private page, title "Tasks concepts"). If the Artifact tool is unavailable, say so and give the file path instead.
4. Commit the HTML and push.
Return the HTML path, the artifact URL (or "unavailable") and a short summary ranking your top pick per view with one line why.`, { label: 'gallery', phase: 'Gallery', schema: GALLERY })

return { concepts: done, gallery }
