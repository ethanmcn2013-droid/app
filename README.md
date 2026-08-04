# Signal Studio consolidated app

This Next.js repository serves the one Signal Studio web app. Its three products are Notes, Tasks, and Timeline; Home is the authenticated front door, carrying the daily briefing (Today's Signal) and the Full Briefing.

## URL contract

- Marketing: `https://signalstudio.ie/{notes|tasks|timeline|signal}`
- App products: `https://app.signalstudio.ie/app/{notes|tasks|timeline|signal}`
- Tasks views: `/app/tasks`, `/app/tasks/list`, `/app/tasks/timeline`, `/app/tasks/calendar`
- Narrow public/service hosts: `tasks.signalstudio.ie` and `timeline.signalstudio.ie`

Read `docs/SUITE_URL_AND_NAMING_CONTRACT.md` before changing navigation, domains, auth callbacks, marketing redirects, or public links. Use `src/lib/product-urls.ts` rather than hard-coded cross-product URLs.

## Local development

Install and run:

```bash
pnpm install
pnpm dev
```

The app defaults to port 3000. Review/demo mode uses deterministic fixtures and never queries production tenant data.

## Verification

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm build
pnpm experience:quality
```

The repository contract in `AGENTS.md` and the local Next.js documentation in `node_modules/next/dist/docs/` are authoritative for implementation work.
