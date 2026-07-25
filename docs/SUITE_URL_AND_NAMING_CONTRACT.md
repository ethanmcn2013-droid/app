# Signal Studio URL and naming contract

**Status:** locked  
**Effective:** 2026-07-25  
**Scope:** marketing, consolidated web app, product navigation, auth, and narrow public artifacts

## Product model

Signal Studio is one app. It contains four products:

| Product ID | Full marketing name | In-app label |
|---|---|---|
| `notes` | Signal Notes | Notes |
| `tasks` | Signal Tasks | Tasks |
| `timeline` | Signal Timeline | Timeline |
| `signal` | Signal | Signal |

Use the full name on marketing pages and at first reference in longer public copy. Use the short label in the product rail, commands, breadcrumbs, and product-local headings. Do not call them separate apps. Do not use old capability labels such as “Plans” or “Morning Briefing” as product names.

## Canonical URLs

| Intent | Notes | Tasks | Timeline | Signal |
|---|---|---|---|---|
| Marketing | `https://signalstudio.ie/notes` | `https://signalstudio.ie/tasks` | `https://signalstudio.ie/timeline` | `https://signalstudio.ie/signal` |
| In-app | `https://app.signalstudio.ie/app/notes` | `https://app.signalstudio.ie/app/board` | `https://app.signalstudio.ie/app/plan` | `https://app.signalstudio.ie/app/brief` |

`https://signalstudio.ie` is the single marketing origin.  
`https://app.signalstudio.ie` is the single signed-in app origin.

Product marketing pages are paths, not URL fragments and not separate marketing sites. Cross-product navigation inside the app stays on `app.signalstudio.ie`.

## Narrow public and service hosts

The product subdomains are compatibility and artifact boundaries, not separate app identities:

- `tasks.signalstudio.ie`: Tasks embeds, published workspaces, invitations, webhooks, and product-to-product service endpoints.
- `timeline.signalstudio.ie`: published or bearer-linked Timeline artifacts, including `/s/*` and `/the-wedding`.
- retired roots such as `notes.signalstudio.ie`, `signal.signalstudio.ie`, `roadmap.signalstudio.ie`, and `analytics.signalstudio.ie` permanently redirect to the matching marketing page.

Never redirect or move an established public artifact path merely to make the host topology look uniform. Public links are a separate contract from marketing and app navigation.

## Implementation authority

The executable contract lives in:

- `src/lib/suite-contracts.v1.json`
- `src/lib/product-urls.ts`
- `src/proxy.ts`
- `next.config.ts`

Use `PRODUCT_MARKETING_URLS` for “learn about the product” links. Use `PRODUCT_APP_URLS` or `PRODUCT_APP_PATHS` for signed-in module navigation. Use `TASKS_PUBLIC_ORIGIN` and `TIMELINE_PUBLIC_ORIGIN` only for their documented public/service surfaces.

Do not add a new product hostname, top-level app, URL fragment destination, or alternate product label without updating this contract and the matching Studio decision record in the same release.

## Authentication and deployment

Clerk’s production application domain is `app.signalstudio.ie`. Provider origins and callbacks must include that origin. Marketing pages may initiate sign-in, but authentication returns to the app origin.

The current Vercel topology may use separate deployment projects for the marketing site and consolidated app. That is an infrastructure boundary only; it does not change the one-app product model.

## Migration rule

For any future URL move:

1. map every old URL to exactly one new URL;
2. use a permanent redirect for retired marketing URLs;
3. preserve query context only after validating it;
4. preserve public artifact routes and tokens;
5. test signed-out, signed-in, mobile, direct reload, and back/forward behavior;
6. update this file, the Studio contract, and the executable URL constants together.
