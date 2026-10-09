export const meta = {
  name: 'analytics-concept-sprint',
  description: 'Six world-class concepts for the Analytics page: creative director slate, one build per concept, no critique or refine',
  phases: [
    { title: 'Slate', detail: 'the creative director sets six maximally distinct directions' },
    { title: 'Build', detail: 'one designer-engineer per concept builds it on sample data and saves the gallery shots' },
  ],
}

// Pass args: { worktree: "<absolute path of the repo checkout>", port: 3217 }
// The coordinator builds the gallery page from the final shots afterwards.
const WT = (args && args.worktree) || '.'
const PORT = (args && args.port) || 3217
const SHOTS = `${WT}/concept-output/analytics`
const SHOT = `node scripts/design/concept-shot.mjs`

const CONTEXT = `
Context: Signal Studio — a project-management suite (Tasks, Timeline, Messages, Files, Analytics, Notes) for small teams: event venues, wedding planners, agencies, small businesses, students and teachers. This is the ANALYTICS CONCEPT SPRINT. The founder wants the Analytics page taken to world class: "nuke it, ideate, iterate", "don't be held back by what exists in the back end — add, remove, invent", "six different options for me to choose from", "concepts, then critiques, refinements and fixes". These are CONCEPT views: front-end only, rich invented sample data, no backend wiring, no server actions. Quality of design and UX is everything. References at their best: Linear Insights, Stripe Dashboard, Vercel Analytics, Plausible, Amplitude, Mixpanel, Height, Asana reporting, Apple Health and Screen Time summaries, Oura, Strava, Things, Arc, Raycast, the Financial Times and Our World in Data for charts that explain themselves.
Worktree: ${WT} (run every command there). Branch design/analytics-concepts. Commit your concept folder and push the branch at the end of your step (git add only your own folder; other agents commit theirs). Never force-push, never rewrite history, never touch other branches.
Concept gallery: each concept lives ONLY in its own folder src/components/concepts/<view>/c<n>/ (<view> is analytics, <n> is 1 to 6; index.tsx default export = the page component, meta.ts = { view, n, title (2-4 words), thesis (one sentence) }, plus any files you add inside that folder: components, CSS modules, sample data). Routed at /app/concepts/<view>/<n> inside the real app shell (sidebar + top bar already present — do not rebuild global navigation; your page fills the content area, which scrolls: make your root flex:1; min-height:0; overflow:auto). NEVER edit files outside your own concept folder. If the page needs client interactivity, put "use client" at the top of index.tsx or child components. No new npm dependencies (check package.json; motion/react is available).
The current production-candidate Analytics page to beat (study, don't copy): /app/analytics — source in src/components/app/analytics/** and the pure calculation in src/lib/projects/project-analytics.ts (read what it can compute, then invent beyond it). Related surfaces for context: /app/tasks, /app/timeline, /app/concepts/overview/1..5 (the earlier Overview concepts). v3 look reference: src/components/app/home/*.
Design system: src/ds/v3.css — use var(--v3-*) tokens for all colour (canvas, surface, sunken, fill, hover, selected, row-selected, border, border-strong, control-border, text, text-2, text-3, accent, accent-hover, accent-soft, accent-text, on-accent, danger/-soft/-text, warning/-soft/-text/-stroke, success/-soft/-text, review/-soft, kind-* colours, project-1..8 identity + project-ink, shadow-1, shadow-pop, scrim, radius-*, ease). You may add local custom properties inside your folder, but light and dark must both look right, all text must pass WCAG AA (never put coloured text on its own tint without the -text token), non-text UI 3:1. Voice: plain, active, sentence case, no exclamation marks, no uppercase tracked labels. Never write "Workspace"/"workspace" in visible text (the noun is "Project"). No jargon.
Stack: Next.js (breaking changes vs your training; stay inside plain React components), React 19, CSS modules (pure selectors: every selector contains a local class), lint error on setState inside useEffect bodies. Must include an h1.
Dev server: http://localhost:${PORT} in review mode (sample data, no login, no secrets, no database), started by the coordinator with NEXT_PUBLIC_SIGNAL_ACCESS_MODE=review SIGNAL_ACTIVE_PROJECT_V3_ENABLED=true pnpm exec next dev --port ${PORT}. Never start a second server; if it is down, tell the coordinator in your report. Screenshots: ${SHOT} app/concepts/<view>/<n> <out.png> <width> <height> <light|dark>. For interaction states write a small Playwright script modelled on scripts/design/concept-shot.mjs. Save under ${SHOTS}/.
Checks for your folder: pnpm exec tsc --noEmit -p . (0 errors in your folder; ignore sibling folders being built in parallel), pnpm exec eslint src/components/concepts/<view>/c<n> (0 errors), and pnpm first-contact:language (0 new occurrences from your folder: CI fails on project-management jargon such as 'blocked by', 'velocity', 'burndown', 'throughput', 'sprint', 'backlog' in visible copy, so say it plainly instead). Charts: hand-draw them in SVG or CSS (no chart library), every mark to one scale, axis labels only at values the data reaches, chart text coloured from tokens so it reads in both themes, and tabular numerals wherever digits line up.
`

const VIEW = {
  key: 'analytics',
  name: 'Analytics page',
  job: 'help a small team (a venue team of 3, a wedding planner, a student group of 5, a four-person agency) understand how their work is going across a Project or all their Projects: is it on track for the big date, what changed this week, who is overloaded, what keeps slipping, where time goes, and what to do about it. Someone who has never read a chart for work must get the answer in five seconds; the numbers are there for whoever wants to dig in.',
  seeds: 'a plain-language weekly report that reads like a letter from a good project manager with small charts inline; a single health score and forecast to the big date with what would move it; a people-first view of load, balance and who needs help; a time machine that replays the project so you can see how it got here; a question-first page where you pick or type a question and get one clear chart and sentence; a portfolio wall comparing every Project at once; a dense operator dashboard for the owner who wants every number',
}

const SLATE = {
  type: 'object',
  properties: {
    concepts: {
      type: 'array', minItems: 6, maxItems: 6,
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

phase('Slate')
const slate = await agent(`${CONTEXT}
You are the creative director for the ${VIEW.name}. Its job: ${VIEW.job}
Starting ideas (push beyond them, replace any that are weak): ${VIEW.seeds}.
Study the current Analytics page and the v3 system (take a couple of screenshots, read the code, including what src/lib/projects/project-analytics.ts can compute), then define SIX maximally distinct concept directions: different mental models, layouts and interaction paradigms, not six skins of one dashboard. Each must be a credible world-class product direction on its own, and at least two must work without the reader knowing how to read a chart. For each: n (1-6), title (2-4 words), thesis (one sentence), a rich build brief (layout at desktop and phone, key components and charts, the invented sample data it needs: use The Orchard venue / Mara & Finn wedding world plus a student group and a small agency, with enough weeks of history for trends to mean something; 2-3 signature interactions or moments of delight; empty, early-days and edge states worth showing), signature (the one thing people will remember), avoid (what would make it generic). Do not edit files.`, { label: 'slate:analytics', phase: 'Slate', schema: SLATE })

if (!slate) return { error: 'slate failed' }
const items = slate.concepts.slice(0, 6)
const folder = (c) => `src/components/concepts/analytics/c${c.n}`
const route = (c) => `app/concepts/analytics/${c.n}`
const tag = (c) => `analytics-${c.n}`

phase('Build')
const builds = await parallel(items.map((c) => () => agent(`${CONTEXT}
You are the principal designer-engineer building concept ${c.n} for the ${VIEW.name}: "${c.title}".
Thesis: ${c.thesis}
Brief: ${c.brief}
Signature: ${c.signature}
Avoid: ${c.avoid}
IMPORTANT: a previous builder for this concept may have been cut off part-way through. If ${folder(c)} already contains substantial work, DO NOT start over: audit it (read every file, take screenshots), keep what is good, finish what is incomplete and fix what is broken. Only if the folder holds just the stub, build from scratch.
Build it completely in ${folder(c)}: replace the stub index.tsx, write meta.ts (title, thesis), add components, a CSS module and a sample-data module inside the folder. Make it feel real and alive: believable data with real history, charts that explain themselves, real-feeling interactions (range and Project switching, hover and focus readouts on charts, drill-down panels, filters, keyboard where natural), tasteful motion (respect prefers-reduced-motion), every state that matters, a great phone layout. Invent any feature that makes it world class, but it must look production-grade, not a wireframe. There is no critique round after you, so be your own harshest critic.
Verify: the checks above, and screenshots at 1440x900 light, 1440x900 dark, 1024x768 light, 390x844 light plus key interactions under ${SHOTS}/${tag(c)}-build-*.png. LOOK at each and iterate at least three times until it is genuinely world class. Finally save the gallery shots: ${SHOT} ${route(c)} ${SHOTS}/final/${tag(c)}-light.png 1440 900 light, the same with dark (${tag(c)}-dark.png), and ${SHOT} ${route(c)} ${SHOTS}/final/${tag(c)}-phone.png 390 844 light, and make sure meta.ts has the final title and thesis. Commit your folder (git add only your own folder) and push design/analytics-concepts (if the push is rejected because a sibling pushed first, git pull --rebase origin design/analytics-concepts and push again; never force-push). Report a summary, checks and screenshot paths.`, { label: `build:${tag(c)}`, phase: 'Build', schema: REPORT })))

return {
  concepts: items.map((c, i) => ({ concept: tag(c), n: c.n, title: c.title, thesis: c.thesis, signature: c.signature, built: Boolean(builds[i]), summary: builds[i]?.summary ?? null, checks: builds[i]?.checks ?? null })),
}
