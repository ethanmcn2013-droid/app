export const meta = {
  name: 'apps-share-concept-sprint',
  description: 'Six concepts each for Apps and tools and the Shared timeline: creative director slates, one build per concept, no critique or refine',
  phases: [
    { title: 'Slate', detail: 'one creative director per view sets six maximally distinct directions' },
    { title: 'Build', detail: 'one designer-engineer per concept builds it on sample data and saves the gallery shots' },
  ],
}

// Pass args: { worktree: "<absolute path of the repo checkout>", port: 3217 }
// The coordinator builds the gallery page from the final shots afterwards.
const WT = (args && args.worktree) || '.'
const PORT = (args && args.port) || 3217
const SHOT = `node scripts/design/concept-shot.mjs`

const INSHELL = 'The sidebar and top bar are already present: do not rebuild global navigation; your page fills the content area, which scrolls: make your root flex:1; min-height:0; overflow:auto.'
const BARE = 'But a shared timeline is a PUBLIC page a stakeholder opens from a link with no Signal Studio account, so it must never show the app around it: make your root position:fixed; inset:0; z-index:200; overflow:auto; with its own full-bleed background, so it covers the app shell completely at every width (check the shell is fully hidden in your screenshots, including the phone). Add nothing that suggests signing in is needed. A small, quiet "Made with Signal Studio" mark is welcome.'

const VIEWS = [
  {
    key: 'apps',
    sprint: 'APPS AND TOOLS',
    name: 'Apps and tools section',
    frame: INSHELL,
    refs: 'Raycast Store and extensions, Linear integrations, Notion templates and connections, Slack app directory, Apple App Store Today tab, Arc Boosts, Figma Community, Zapier, Vercel Marketplace, Things and Craft for calm, iOS Home Screen and widgets, Nothing OS for character.',
    current: "The current production-candidate Apps and tools to beat (study, don't copy): /app/tools and /app/tools/<slug> (e.g. notes), plus the launcher popover (the grid icon in the top bar) — source in src/app/app/tools/**, src/components/app/suite-launcher.tsx, src/components/app/launcher-actions.ts; spec docs/design/v3/launcher.md. Invent beyond it: what tools a venue, wedding planner, student group or small agency would want next to their Tasks and Timeline (Notes, run-sheets, budgets, guest lists, seating, forms, file drive, calendar sync, email and WhatsApp connections, templates, timers), how they are discovered, turned on, arranged and opened.",
    job: 'the one place a small team finds, turns on, arranges and opens the tools and connections around their Projects (Notes, run-sheets, budgets, guest lists, calendar and email connections, templates and more). A first-time user must understand what each thing does and whether it is on in seconds, and it should feel like a well-kept toolbox, not an app store full of upsell.',
    seeds: 'a calm home-screen grid you arrange like a phone; a curated editorial catalogue with stories of how teams use each tool; a command surface where you type what you need and the right tool appears; a per-Project toolkit that suggests tools from what the Project is (wedding, launch, class); a workbench where tools open side by side next to your tasks; a connections map showing what talks to what',
  },
  {
    key: 'shared-timeline',
    sprint: 'SHARED TIMELINE',
    name: 'Shared timeline (the public, shareable timeline page for stakeholders)',
    frame: BARE,
    refs: 'Apple event and product launch pages, Stripe Sessions, Linear changelog and launch pages, Vercel Ship, Paperless Post and Zola for weddings, Kickstarter project pages, Luma event pages, Read.cv and Bento profiles, Pitch and Tome for storytelling, Our World in Data and the NYT for scrollytelling, F1 and Apple Watch countdowns.',
    current: "The current production-candidate shared timeline to beat (study, don't copy): the owner's Preview and Share in /app/timeline (open a Project's Timeline, then Preview), the public artifact at /s/<token> — source in src/modules/timeline/components/artifact/** (timeline-artifact.tsx, timeline-phone-preview.tsx, timeline-artifact-model.ts) and src/modules/timeline/app/audience/**; background and audit in docs/design/timeline-world-class-redesign.md. Do not be limited by it.",
    job: "a beautiful, shareable page that shows a Project's timeline to people who have no Project access and never sign in: a couple's families and guests for a wedding, a client or investors for a launch, parents for a class project, attendees for an event. It shows the countdown to the big day, key milestones, high-level progress and what happens next, never the internal task noise. It is public-facing and doubles as marketing material, so it must be aesthetic enough that people want to share it, and it must read perfectly on a phone opened from a WhatsApp link.",
    seeds: 'an editorial story page that scrolls through the journey to the day; a single dramatic countdown with milestones orbiting it; a printed-invitation aesthetic for weddings and events; a launch page that builds anticipation like an Apple event; a living poster you could screenshot and post; a quiet progress letter with a subscribe-for-updates moment; per-audience themes (wedding, launch, event, class) from one data model',
  },
]

const context = (v) => `
Context: Signal Studio — a project-management suite (Tasks, Timeline, Messages, Files, Analytics, Notes) for small teams: event venues, wedding planners, agencies, small businesses, students and teachers. This is the ${v.sprint} CONCEPT SPRINT. The founder wants the ${v.name} taken to world class: "nuke it, ideate, iterate", "don't be held back by what exists in the back end — add, remove, invent", "six different options for me to choose from", "don't be locked or restrained by any pre-existing work", "concepts, then critiques, refinements and fixes". These are CONCEPT views: front-end only, rich invented sample data, no backend wiring, no server actions. Quality of design and UX is everything. References at their best: ${v.refs}
Worktree: ${WT} (run every command there). Branch design/analytics-concepts. Commit your concept folder and push the branch at the end of your step (git add only your own folder; other agents commit theirs). Never force-push, never rewrite history, never touch other branches.
Concept gallery: each concept lives ONLY in its own folder src/components/concepts/<view>/c<n>/ (<view> is ${v.key}, <n> is 1 to 6; index.tsx default export = the page component, meta.ts = { view, n, title (2-4 words), thesis (one sentence) }, plus any files you add inside that folder: components, CSS modules, sample data). Routed at /app/concepts/<view>/<n> inside the real app shell. ${v.frame} NEVER edit files outside your own concept folder. If the page needs client interactivity, put "use client" at the top of index.tsx or child components. No new npm dependencies (check package.json; motion/react is available).
${v.current}
Design system: src/ds/v3.css — use var(--v3-*) tokens for all colour (canvas, surface, sunken, fill, hover, selected, row-selected, border, border-strong, control-border, text, text-2, text-3, accent, accent-hover, accent-soft, accent-text, on-accent, danger/-soft/-text, warning/-soft/-text/-stroke, success/-soft/-text, review/-soft, kind-* colours, project-1..8 identity + project-ink, shadow-1, shadow-pop, scrim, radius-*, ease). You may add local custom properties inside your folder, but light and dark must both look right, all text must pass WCAG AA (never put coloured text on its own tint without the -text token), non-text UI 3:1. Voice: plain, active, sentence case, no exclamation marks, no uppercase tracked labels. Never write "Workspace"/"workspace" in visible text (the noun is "Project"). No jargon.
Stack: Next.js (breaking changes vs your training; stay inside plain React components), React 19, CSS modules (pure selectors: every selector contains a local class), lint error on setState inside useEffect bodies. Must include an h1.
Dev server: http://localhost:${PORT} in review mode (sample data, no login, no secrets, no database), started by the coordinator with NEXT_PUBLIC_SIGNAL_ACCESS_MODE=review SIGNAL_ACTIVE_PROJECT_V3_ENABLED=true pnpm exec next dev --port ${PORT}. Never start a second server; if it is down, tell the coordinator in your report. Screenshots: ${SHOT} app/concepts/<view>/<n> <out.png> <width> <height> <light|dark>. For interaction states write a small Playwright script modelled on scripts/design/concept-shot.mjs. Save under ${WT}/concept-output/${v.key}/.
Checks for your folder: pnpm exec tsc --noEmit -p . (0 errors in your folder; ignore sibling folders being built in parallel), pnpm exec eslint src/components/concepts/<view>/c<n> (0 errors), and pnpm first-contact:language (0 new occurrences from your folder: CI fails on project-management jargon such as 'blocked by', 'velocity', 'burndown', 'throughput', 'sprint', 'backlog' in visible copy, so say it plainly instead). Charts and graphics: hand-draw them in SVG or CSS (no chart or animation library beyond motion/react), every mark to one scale, chart text coloured from tokens so it reads in both themes, and tabular numerals wherever digits line up.
`

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
const slates = await parallel(VIEWS.map((v) => () => agent(`${context(v)}
You are the creative director for the ${v.name}. Its job: ${v.job}
Starting ideas (push beyond them, replace any that are weak): ${v.seeds}.
Study the current version and the v3 system (take a couple of screenshots, read the code), then define SIX maximally distinct concept directions: different mental models, layouts and interaction paradigms, not six skins of one layout. Each must be a credible world-class product direction on its own. For each: n (1-6), title (2-4 words), thesis (one sentence), a rich build brief (layout at desktop and phone, key components, the invented sample data it needs: use The Orchard venue / Mara & Finn wedding world plus a student group and a small agency launch; 2-3 signature interactions or moments of delight; empty, early and edge states worth showing), signature (the one thing people will remember), avoid (what would make it generic). Do not edit files.`, { label: `slate:${v.key}`, phase: 'Slate', schema: SLATE })))

const items = []
VIEWS.forEach((v, i) => {
  if (!slates[i]) { log(`slate failed for ${v.key}; its concepts are skipped`); return }
  for (const c of slates[i].concepts.slice(0, 6)) items.push({ v, c })
})
// args.only (optional): build just these concepts, e.g. ["shared-timeline-2"].
// The founder paces this sprint in batches and hands each one to a local session.
const ONLY = args && Array.isArray(args.only) ? new Set(args.only) : null
if (ONLY) {
  const keep = items.filter((it) => ONLY.has(`${it.v.key}-${it.c.n}`))
  items.length = 0
  items.push(...keep)
}
const folder = (it) => `src/components/concepts/${it.v.key}/c${it.c.n}`
const route = (it) => `app/concepts/${it.v.key}/${it.c.n}`
const tag = (it) => `${it.v.key}-${it.c.n}`
const shots = (it) => `${WT}/concept-output/${it.v.key}`

phase('Build')
const builds = await parallel(items.map((it) => () => agent(`${context(it.v)}
You are the principal designer-engineer building concept ${it.c.n} for the ${it.v.name}: "${it.c.title}".
Thesis: ${it.c.thesis}
Brief: ${it.c.brief}
Signature: ${it.c.signature}
Avoid: ${it.c.avoid}
IMPORTANT: a previous builder for this concept may have been cut off part-way through. If ${folder(it)} already contains substantial work, DO NOT start over: audit it (read every file, take screenshots), keep what is good, finish what is incomplete and fix what is broken. Only if the folder holds just the stub, build from scratch.
Build it completely in ${folder(it)}: replace the stub index.tsx, write meta.ts (title, thesis), add components, a CSS module and a sample-data module inside the folder. Make it feel real and alive: believable data, real-feeling interactions, tasteful motion (respect prefers-reduced-motion), every state that matters, a great phone layout. Invent any feature that makes it world class, but it must look production-grade, not a wireframe. There is no critique round after you, so be your own harshest critic.
Verify: the checks above, and screenshots at 1440x900 light, 1440x900 dark, 1024x768 light, 390x844 light plus key interactions under ${shots(it)}/${tag(it)}-build-*.png. LOOK at each and iterate at least three times until it is genuinely world class. Finally save the gallery shots: ${SHOT} ${route(it)} ${shots(it)}/final/${tag(it)}-light.png 1440 900 light, the same with dark (${tag(it)}-dark.png), and ${SHOT} ${route(it)} ${shots(it)}/final/${tag(it)}-phone.png 390 844 light, and make sure meta.ts has the final title and thesis. Commit your folder (git add only your own folder) and push design/analytics-concepts (if the push is rejected because a sibling pushed first, git pull --rebase origin design/analytics-concepts and push again; never force-push). Report a summary, checks and screenshot paths.`, { label: `build:${tag(it)}`, phase: 'Build', schema: REPORT })))

return {
  concepts: items.map((it, i) => ({ concept: tag(it), view: it.v.key, n: it.c.n, title: it.c.title, thesis: it.c.thesis, signature: it.c.signature, built: Boolean(builds[i]), summary: builds[i]?.summary ?? null })),
}
