# Decisions — Signal → Home consolidation

## D1 · Home lives at `/app/home`; `/app` redirects to it
`/app/page.tsx` already carries suite-context redirect logic with query
params; overloading it with a rendered surface risks that contract. A
stable addressable path gives the rail a real href and keeps the default
redirect a one-line change. The `your-work`/`tasks` fork in `/app` is
replaced by Home unconditionally; `/app/your-work` stays reachable.

## D2 · Full Briefing is the existing SignalBriefPage at `/app/home/briefing`
The module (`src/modules/signal`) moves routes, not internals. The
barrel exports mount at the new paths; `/app/signal`,
`/app/signal/onboarding`, `/app/signal/settings/notifications` become
permanent redirects that preserve query state (scope, evidence,
planning-period params drive the analytics path). The module's one
hard-coded internal redirect and href-base constants are repointed —
low-risk string constants, verified by the module's own contract tests.

## D3 · Internal `signal` naming stays
`ProductId "signal"`, module paths, `dailySignalCadence`, analytics
service names, entitlement DB name (`signal-entitlements` is the
company prefix) all remain. Renaming is migration risk with zero user
value. The retirement is presentational: nav, routes, marketing, copy.

## D4 · Primary nav is home · notes · tasks · timeline · project
The suite-switcher pills (canonical shared component, byte-identical
copies in app + studio) gain Home first and drop Signal. `/app/project`
already exists (workspace project overview, D-011) — "Project" joins
primary nav pointing at it. We do not invent a new cross-product
Projects index for launch; the brief's "Projects" maps to this existing
surface, singular label matching what it actually shows. Mobile nav:
Home · Notes · Tasks · Timeline · Project (5 tabs); "More" remains the
account cluster in the top bar rather than a sixth tab — 6 tabs at
375px breaks the 44px touch-target contract this repo enforces.

## D5 · Today's Signal reuses `buildBriefing` — one ranking engine
Home consumes the same `BriefingSource` + `buildBriefing` pipeline the
brief page uses (real Tasks-DB source in production, fixture source in
review mode, honest empty source when unconfigured). Home renders the
top ≤3 focus items; Full Briefing renders the complete ledger. No
duplicate ranking logic. Coming up and Needs review reuse existing
queries (planning/your-work + nudges) — no new DB surface.

## D6 · Sign-in/onboarding land on Home
Sign-in flows through `/app` (Clerk default + middleware), which now
redirects to `/app/home`. The welcome flow's terminal CTA points at
Home. Deep links keep working because only the `/app` index redirect
changes.

## D7 · Entitlements untouched
The commercial model is tier-based (workspace tiers, venue plans,
redeem codes). No per-product entitlement, selectable Signal SKU, or
feature gate keyed on the Signal product exists. Absorbing the briefing
into Home grants nothing new. `venue_usage.signal_actions` is an
internal instrumentation counter and keeps its name (schema comment
notes it predates the consolidation).

## D8 · Studio `/signal` becomes `/features/daily-briefing` + 301
The old product page's story survives as a feature page (the copy is
sound and the SEO value is real: priority 0.9 in the sitemap). The old
route 301s to it, canonical set, sitemap swapped, product pills on
sibling pages drop Signal. Marketing "Products" = Notes, Tasks,
Timeline only; Home/Briefing appear as system capability, not product.

## D9 · Language
Headline: "Notes. Tasks. Timeline. One clear system." Support:
"Capture the thinking. Move the work. See the plan." Home is described
as where the system "shows what matters now" / "your daily signal,
built into Home". Banned: "four products", "fourth product", "three
products plus Signal", presenting Home as a product.

## D10 · Analytics
Existing convention is snake_case product-prefixed events via PostHog.
Added: `home_viewed`, `home_signal_item_opened`,
`home_briefing_opened`. Existing signal/briefing events keep firing on
the relocated surface (no event renames — launch dashboards stay
intact). Server-side redirects don't emit events; the redirect is
observable in server logs and needs no client event.

## D11 · Evidence pipeline follows the surface moves
Registry experiences for `/app/signal*` update their route+source to
the new home paths; new `tasks.page.app-home` registers; critical
fixtures repin (app-signal case path moves to /app/home/briefing; new
home case). Fixture-manifest edits invalidate all receipts by design —
full re-attest + rebind, per the established procedure.

## D12 · Old-tree and motion-lane boundaries
The old `app/` tree (uncommitted Wave-2 VEF work) and `signal-motion`
(Codex's lane) are not touched. External creative assets are
inventoried in LAUNCH-ASSET-CHANGES.md instead of edited.
