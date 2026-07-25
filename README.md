# Signal Studio consolidated app

This Next.js repository serves the one Signal Studio web app. Its four products are Notes, Tasks, Timeline, and Signal.

## URL contract

- Marketing: `https://signalstudio.ie/{notes|tasks|timeline|signal}`
- App: `https://app.signalstudio.ie/app/{notes|board|plan|brief}`
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
