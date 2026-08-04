# Signal Studio URL and naming contract

**Status:** locked  
**Effective:** 2026-07-25  
**Scope:** marketing, consolidated web app, product navigation, auth, and narrow public artifacts

## Product model

**Amended 2026-08-04 (Signal → Home consolidation).** Signal Studio is
one app. It contains three products, with Home as the authenticated
front door:

| ID | Full marketing name | In-app label | Role |
|---|---|---|---|
| `notes` | Signal Notes | Notes | Product — captures the thinking |
| `tasks` | Signal Tasks | Tasks | Product — moves the work |
| `timeline` | Signal Timeline | Timeline | Product — makes the plan visible |
| `home` | — (not marketed as a product) | Home | Front door — Today's Signal + Full Briefing |

Signal is the company, the brand, and the outcome the system produces —
never "our fourth product". The briefing capability formerly presented
as the Signal product lives inside Home ("Today's Signal"; "Full
Briefing" at `/app/home/briefing`). The internal `signal` product ID
survives in code as a legacy identifier; it must not appear in new
navigation, marketing, or copy.

Use the full name on marketing pages and at first reference in longer public copy. Use the short label in the rail, commands, breadcrumbs, and product-local headings. Do not call them separate apps. Do not use old capability labels such as “Plans” or “Morning Briefing” as product names.

## Canonical URLs

| Intent | Notes | Tasks | Timeline |
|---|---|---|---|
| Marketing | `https://signalstudio.ie/notes` | `https://signalstudio.ie/tasks` | `https://signalstudio.ie/timeline` |
| In-app | `https://app.signalstudio.ie/app/notes` | `https://app.signalstudio.ie/app/tasks` | `https://app.signalstudio.ie/app/timeline` |

Home: `https://app.signalstudio.ie/app/home` (the default authenticated
destination; `/app` redirects here). Full Briefing:
`https://app.signalstudio.ie/app/home/briefing`. The daily-briefing
marketing story: `https://signalstudio.ie/features/daily-briefing`.
Legacy `/app/signal*` and the old `signalstudio.ie/signal` product page
permanently redirect to their successors.

`https://signalstudio.ie` is the single marketing origin.  
`https://app.signalstudio.ie` is the single signed-in app origin.

Product marketing pages are paths, not URL fragments and not separate marketing sites. Cross-product navigation inside the app stays on `app.signalstudio.ie`.

Tasks views live below the Tasks product entry:

- Board: `/app/tasks`
- List: `/app/tasks/list`
- Timeline view: `/app/tasks/timeline`
- Calendar: `/app/tasks/calendar`

“Timeline” without the Tasks namespace always means the Signal Timeline
product. “Signal” is the company and the outcome the system produces —
never a product label. The briefing surfaces are named “Today's Signal”
(inside Home) and “Full Briefing” (`/app/home/briefing`); “brief” alone
is not a route or product label.

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

The 2026-07-25 canonical migration is:

| Retired path | Canonical path |
|---|---|
| `/app/board` | `/app/tasks` |
| `/app/tasks/board` | `/app/tasks` |
| `/app/list` | `/app/tasks/list` |
| `/app/calendar` | `/app/tasks/calendar` |
| `/app/plan/*` | `/app/timeline/*` |
| `/app/brief/*` | `/app/home/briefing/*` |

The 2026-08-04 consolidation adds:

| Retired path | Canonical path |
|---|---|
| `/app/signal` | `/app/home/briefing` |
| `/app/signal/onboarding` | `/app/home/briefing/onboarding` |
| `/app/signal/settings/notifications` | `/app/home/briefing/settings/notifications` |
| `signalstudio.ie/signal` | `signalstudio.ie/features/daily-briefing` |

The former Tasks view at `/app/timeline` moved to `/app/tasks/timeline`; that
one collision cannot redirect because the product route now owns the canonical
path. Application code must emit only the canonical destinations above;
retired paths are compatibility inputs, never navigation outputs.
