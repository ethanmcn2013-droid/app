# Signal Tasks · the dispatch

The Tasks dispatch. Convention: BRAND.md §6.5. Entries before
2026-05-14 keep their original shape; the new shape starts at the
next cycle.

## 2026-05-21 · T·74 · fixes · the avatar row stops overlapping and reads as people

**Stacked assignee chips no longer crash into each other, and the
two-letter initials inside them now come from a person's actual
name rather than arbitrary characters lifted off an identifier.**
A nameless slot renders a clean question mark rather than a stray
dot, so an unknown face reads as intentional rather than as a
render artifact.

The change rounds out the avatar work the M wave started — the
group label and overflow announcement landed in the previous
cycle, the visual overlap and humane initials landed here. The
original work was authored alongside the C wave but had not yet
pushed at the time.

## 2026-05-21 · T·73 · tightens · one primary on the empty workspace, one voice for the assignee row

**The empty workspace asks for one thing first, and the assignee
stack tells a screen reader who is there.** Add your first task is
now the only button on the empty state — the four starter packs
collapse into a quiet inline line so the hierarchy reads cleanly
without losing the audience cue.

The avatar stack picks up a group label and the more indicator
announces the count instead of sitting there as silent decoration.
Both calls came out of the product walkthrough as M-tier polish
after the C1 wave closed the louder defects.

## 2026-05-19 · T·70 · ships · the inbox knows your name again

**Six rough edges that made Tasks feel unfinished are gone — the morning
greeting is yours by name, an empty conversation reads as calm instead of
broken, and the dead "coming soon" Filter button no longer sits there
greyed out.**

The daily inbox now greets you by your real name instead of "Someone".
Activity in settings shows who did what as a person, not a code. An empty
task conversation says "No conversation yet." rather than shimmering
forever, and if a load ever stalls there is now a try-again instead of an
endless wait. Seeded demo people are quietly marked "sample" so they never
read as real colleagues, and the disabled Filter control has been pulled
from the screen until it actually does something.

Two things flagged in review turned out to be non-issues on closer look
and were deliberately left alone. The change shipped from a clean isolated
build so an unrelated in-progress feature stayed untouched.

## 2026-05-19 · T·68 · ships · the suite switcher is four visible pills

**The app top chrome and the Settings chrome now show all four products as
always-visible pills — the cross-product switch is no longer hidden behind
the faint "signal studio." popover trigger.** One canonical `SuiteSwitcher`
(shared byte-identical across the suite) replaces the launcher popover on
the authed surfaces, carrying the umbrella anchor once, the dot-morph jump,
hover-prefetch and preconnect. The popover stays in the unauthed marketing
nav and the 252px sidebar rail, where four horizontal pills do not fit.
Typecheck and build clean; deployed to prod and verified (200 marketing,
307 app entry).

## 2026-05-18 · T·67 · ships · seamless ecosystem — auth-aware entry + persistent suite chrome

**Signed-in users no longer hit the marketing homepage — they land in the workspace, and every surface in the app wears the correct identity.** Three layers shipped together. Layer 2 wires the M-route redirect in the proxy: authenticated requests to `/`, `/features`, `/pricing`, and `/changelog` get a 307 to `/app`, while unauthenticated visitors still see the marketing site unchanged. The escape hatch is exact: `signal_preview_public=1` cookie or `?preview=public` query param suppresses the redirect for the duration of a tab session, so the operator can walk a prospect through the public site without signing out. Layer 3 kills the false "Sign in" — the nav no longer shows authentication CTAs to a signed-in user; `<UserButton />` replaces them, and the suite launcher deep-links to `/app` entries with app-context labels ("Open the workspace", "Open the notebook", etc.) instead of marketing taglines. "View public site" / "Exit preview" lands in the account menu. Layer 4 mounts the persistent top chrome on every `/app/*` surface: a sticky `h-14` bar with the `signal studio. / tasks` breadcrumb on the left and the authed suite switcher + account menu on the right, byte-identical in geometry to the spec so cross-product jumps swap only the body. The former mobile-only `MobileSuiteBar` (fixed, `h-9`, not in spec) is retired — the new chrome serves all viewports.

## 2026-05-17 · T·66 · fixes · suite UX remediation — R2/R3/R8/R12/R15/R16/R18

**Every real signup was greeted by their Clerk database id instead of their name — now every surface in Tasks says "Someone" when the user isn't seeded, and the My Tasks empty state reads "Nothing on your plate yet." in second person.** The Clerk-id-as-display-name leak (`user_3Dpnq…`) was closed at the source in `fallbackUserMeta()`, hardening avatars, AI digests, assignee fields, conversation threads, and daily digests simultaneously. Six additional P2 issues from the operator screen recording also closed: the `/app` segment now has its own loading boundary with a px-clamped pulse dot; Settings/Workspace no longer says "chrome" (reads as the browser) or "admire the metadata" (dev in-joke); the sidebar Teams list shows venue coordination roles (Venue / Catering / Flowers & Decor / Photography / Logistics) instead of a generic SaaS org; the banned `#7c3aed` purple is gone; the Calendar button says "Sync to calendar" not "Subscribe"; and `theme-color: #ffffff` now prevents the indigo browser-chrome flash between white-surface products.

## 2026-05-16 · T·65 · tightens · the digest cron survives an impersonal scheduled run

**The daily digest cron had never actually run in production — the
moment its auth was finally provisioned, it 500'd on every invocation.**
T·62 wired the digest to report to Signal HQ, but the scheduled job
resolved its user through `getCurrentUser()`, which throws in
production when there is no Clerk session. Vercel's cron has no
session, so the route threw before it could do anything. It had been
masked because `CRON_SECRET` was never set in production either — the
auth guard 500'd first, so the throw was never reached. Provisioning
the cron secrets surfaced the latent bug.

The route now resolves the user through the nullable path and, when
there is no user — the normal shape of an impersonal scheduled run —
records the Signal HQ heartbeat and returns cleanly instead of
throwing. No user means no user-scoped digest and no email; a
scheduled per-user digest still needs an explicit `?user=` override or
a deliberate multi-user design, which is a separate decision, not this
fix. Verified live on `tasks.signalstudio.ie`: the impersonal call now
returns `200` with an honest `skipped` marker and fires the heartbeat,
so HQ stops reporting the job as never having run.



**The 09:00 UTC digest ran every day with nobody watching — Signal HQ
had no way to know it was alive.** It now pings the umbrella when it
finishes, the same way the analytics briefing already does: a hardened,
allowlisted, two-second, fail-silent caller that can never break the
digest it rides on. HQ stops carrying a hardcoded "unmonitored" warning
and starts deriving the digest's health from real run data. Nothing
about the digest itself changed — this is the job learning to raise its
hand. Until the umbrella ping address is configured on this project the
caller stays a silent no-op and HQ reads it honestly as "never run",
self-healing the first morning after.

## 2026-05-16 · T·61 · tightens · the tasks dot now pulses like the rest of the suite

**The tasks· wordmark dot — live in the nav, footer, and every route's
loading state — was still beating the retired 1.6s "heartbeat", not the
canonical pulse the suite advertises everywhere else.** Suite design-system
v1 (DESIGN.md §5) defines Tasks as `pulse, 2.6s ease-in-out` — the same
gesture Studio's brand-mark and the /brand and /pricing reveals have shown
for the tasks variant since the conformance pass. Tasks' own homepage was
the one place that never migrated: it ran `tasks-dot-beat 1.6s` with a
paired-bounce keyframe and "M·02 heartbeat" docstrings. The dot now runs
`tasks-dot-pulse 2.6s ease-in-out` with the canon keyframe shape. No
behaviour beyond the wordmark; reduced-motion still holds it still via the
global block. The earlier suite-wide "old vocab fully retired" claim was a
name-grep that missed this live class — corrected by reading the rendered
declaration, not the keyframe-name presence.

## 2026-05-16 · T·59 · ships · the workspace can be paid by the year

**The pricing page started offering a yearly workspace — a hundred and
twenty euro, paid once — but the checkout it points at only knew how to
sell by the month. It now understands the year. Ask for the annual
plan and you get the annual plan; ask before the yearly price exists
and you quietly get the monthly one instead, never a dead button. The
register stays plain: one price, stated once, no countdown and no
"save" theatre.**

The shared checkout seam other Signal Studio surfaces deep-link into
now carries the billing interval through sign-in and first-run without
losing it, so a couple who has to make an account mid-purchase still
lands on the plan they chose. One human step remains before the yearly
plan can actually be bought: the yearly price has to be created in the
payment account and named to the app. Until then the honest fallback
holds.

## 2026-05-15 · T·58 · ships · the homepage demo stops breaking on the phone the 80% hold

**The most-seen product surface in the suite — the live cinematic
board on the Tasks homepage — was broken on phones, and had been.
On desktop it is a beautiful four-lane wedding board, alive with
cursors. On a 390px phone the wrapper clamped it to a 16:9 box and
`overflow-hidden` simply *clipped* a fixed ~1180px desktop canvas:
the visitor saw the browser chrome, "Hartwell Wedding · 6.14.26",
the view tabs — then the entire board cut off, presence avatars
bleeding off the right edge, and a tall dead void below. The 80%
are phone-first. The flagship "Demo is live" moment was a headless
sliver for most of them.**

It now scales instead of clips. Below `md`, the whole proven canvas
is uniformly shrunk to fit the viewport — the Linear/Arc
desktop-app-on-mobile treatment: the entire board, all four lanes,
the live motion, faithfully smaller. Pure CSS (`min()`/`calc` on
viewport width in globals.css): SSR-safe, no-JS-safe, no flash, no
measurement to drift. Desktop is byte-for-byte unchanged — the
perspective tilt and the deep float shadow are untouched because the
scale rule is `max-width: 767px` only. An ancestor `scale()` never
enters the scripted scene's own coordinate space, so cursors and
the carry/handoff scenes have zero regression surface.

How it was found and the honest correction it forces: the prior
world-class pass recorded "front door + public surfaces world-class
& proven." That was true for voice, no-JS and reduced-motion — and
wrong for mobile *layout* of the demo, because "proven" never
included an actual phone-width pixel look at the cinematic surface.
It does now (captured on production via the on-disk-Chromium recipe,
reduced-motion context). Lesson logged: "voice-verified" and
"correctness-verified" are not "pixel-verified"; the phone is not an
afterthought viewport for a phone-first audience. Typecheck + build
clean; verified on tasks.signalstudio.ie at 390 and 1440.

**BRAND §5 names one colour as forbidden by name — `#7c5cff`, the
historical purple-leaning Tasks accent — and says, in those words,
"don't reintroduce." It was still in 20 files and 51 places: the
brand-accent gradient on the AI buttons and marketing eyebrows, the
decorative blooms behind the manifesto and templates pages, the
glow on the social share cards, even the marker-highlight design
token that underlines every display headline in the app. The brand
says one indigo; the product was quietly still purple.**

It is one indigo now. The root was a single token — `--highlight:
#7c5cff` — so fixing that one line corrected every display-headline
marker across the entire app at once; it is `#4f46e5` (the primary
indigo) and the §5 rule is written into the comment so it does not
silently come back. The brand-accent gradients went indigo →
deeper-indigo (`var(--brand) 0%, #4338ca 100%`), the decorative
blooms and share-card glows went to indigo `rgba(79,70,229,…)`.

The judgement call, made deliberately and not by reflex: the
categorical *identity* swatches — the demo user "Alex", the "Design"
tag dot, the celebration confetti, the avatar palette — were not
flattened to indigo. §5 bans purple as *the accent*; it does not ban
one hue from a labelled set, and the suite itself sanctions violet
for `--aud-community` (BRAND §7). Those swatches moved to that
sanctioned `#7c3aed`, which removes the literal banned value while
keeping people visually distinct from the brand. Blindly indigo-ing
an identity palette would have collided every avatar with the UI.
Typecheck + build clean; zero `#7c5cff` / `rgba(124,92,255)` left in
`src/`. This closes the §5 debt named in T·56 — nothing about the
purple is deferred now.

**Every audience landing, every template essay, and the SEO snippets
behind them were quoting a price that does not exist. "Pro at
$4.99/mo", "Team at $9.95/workspace", "Studio at $14.95/mo" — US
dollars, three tier names that were retired when the suite moved to
the single canonical model (Free €0 · Workspace €12/mo · Event €79
once · Student .edu-free). A tradesperson, a freelancer, a student,
a planner read the wrong currency and a dead tier on the exact page
they were on when they decided whether to trust us. That is the
demo-vs-reality gap the brand exists to refuse, and it was live in
production across the whole audience layer.**

It is gone. Six audience landings (trades, freelancers, students,
weddings, small-business, community), twelve template essays, and
the OpenGraph/Twitter metadata for the trades, weddings, freelancers
and students pages now state the real prices in euros, in each
page's own voice — not a find-and-replace. The freelancer math got
simpler, not patched: the old "Pro vs Team vs Studio, five clients =
5 × $9.95" arithmetic existed only to navigate a leaky tier
structure that no longer exists; the new copy is "€12, unlimited
workspaces, the bill stops being something you model." The student
window was also wrong — "120-day" / "1 year of Pro" became the
canonical two-year .edu window. Three brand-integrity bugs found in
the same files were fixed in the same pass rather than left for
later: "your wife who handles QuickBooks" → "the partner" (a §3 fix
memory recorded as shipped in Plan 5.2 that had regressed), the
banned "stakeholders" in the onboarding essay, and the explicitly
banned `#7c5cff` purple in the students eyebrow + glow (BRAND §5).

Honest scope, named not buried. The same retired prices still live
in three server files (`stripe.ts`, `membership.ts`, the
launch-readiness seed) — that is the entitlements sprint's backend
reconciliation, deliberately not touched here per "backend can
wait." The banned purple survives in ~13 more files (about-manifesto,
templates-gallery, anatomy, embed-guide, template-detail) — a real
§5 violation, deferred to its own cycle rather than slammed into a
pricing deploy where a visual regression could hide. Typecheck +
build clean; verified live on tasks.signalstudio.ie across the
trades, freelancers and students surfaces. Note: a parallel session
was committing T·51–T·55 on the same "speak to the 80%" mission
concurrently; this work was absorbed into that commit stream and
pushed as part of `1f6068f..96fb136` — T·56 may need operator
reconciliation if the parallel session also claimed the number.

**A person who asks their operating system to reduce motion should
get a calm product. The global CSS rule only quietened CSS-driven
motion; fifteen of the twenty-five app components animate through
`motion/react` transforms with no reduced-motion guard, so that
person still got the full set.**

A single root `<MotionConfig reducedMotion="user">` makes every
`motion/react` component honour the preference automatically —
transforms and layout animations drop, opacity stays. It changes
nothing for users with no preference: the cinematic demo and every
flourish are exactly as they were. It is a context provider, so
children still server-render and nothing is hidden from no-JS or
crawlers.

Verified the way it should be: a headless load with the OS
reduce-motion preference emulated against production. The preference
registered, and the demo still ran its scripted scene to completion
and surfaced the wedding planner's own line — reduced motion, full
content, no regression. Typecheck and build clean.

## 2026-05-15 · T·54 · cuts · the scroll-fade that hid the manifesto from crawlers

**Loaded with JavaScript disabled — what a crawler or a no-JS visitor
actually gets — the /principles page hid its own refusal list. The
numbered items that are the brand spine rendered at opacity:0 and
never appeared. /about was worse: the struck-jargon line showed the
banned words with no strike-through, telling a no-JS reader the
opposite of what it means.**

The cause was a decorative scroll-reveal — `whileInView` paired with
`initial: opacity 0` — which Framer renders hidden on the server.
BRAND.md §5 keeps motion to the Tasks homepage demo and holds the
rest restrained; a manifesto that fades in is both unearned motion
and a direct breach of the rule that motion never hides content from
no-JS, crawlers, or scroll position. Removed across
principles-manifesto, about-manifesto (the strike line was
semantically load-bearing, so it is now always drawn), and
templates-gallery (cards static; the hover-lift stays — JS-only,
hides nothing). Two dead motion imports went with it.

Verified by the method that found it: a JS-disabled headless load
against production, before and after. /principles went from 7 of 12
sampled blocks visible to 12 of 12; /about to 12 of 12. Typecheck and
build clean.

## 2026-05-15 · T·53 · cuts · the soft PM vocabulary out of the app the 80% live in

**T·51 and T·52 made the front door speak plain English. The room
behind it still didn't. The app a wedding planner uses every day
carried an "Assignees" column on every list, an "Assignees" field on
every task, and a repeat tool that said it was "Useful for standups".
A planner does not have an assignee or a standup. They have someone
doing the thing.**

"Assignees" is now "Who" — on the list view, my-tasks, the
empty-state ghost table a brand-new user meets first, and the task
detail panel, whose field sequence now reads Status · Priority · Who
· Due · Repeats, five plain words a person would actually say. The
add-person control's screen-reader name went from "Add assignee" to
"Add someone". The repeat popover dropped "standups" and its "Make N
copies, spaced D days apart" placeholder-variable phrasing for "Make
a few copies, spaced a set number of days apart. Useful for
countdowns, reminders, anything that repeats."

Held back on purpose: the CSV-import column mapping still reads
"Assignees" — it documents the source tool's own format, not Tasks'
voice, and renaming it would make the mapping ambiguous. Honest scope:
typecheck, build, and the production bundle carry the new strings, but
`/app` is auth-gated, so the in-app live pixel pass at desktop and
phone is owed, not done. The strings are pure presentational with no
logic keyed on them.

## 2026-05-15 · T·52 · ships · the demo's teammate note becomes the planner's own world

**T·51 left one named gap: the cinematic demo's static "Alex · 2h ago"
comment was still one hardcoded line for every audience. A wedding
planner watching the wedding demo read a generic note, not their own
work. That gap is closed.**

The static comment now reads from the active domain pack. The wedding
planner sees "RSVPs at 89%, on pace." The tradesperson sees "Materials
list updated. Pickup on the way in tomorrow." The freelancer, the
student — each reads a line a person in that work would actually
write. It threads through a new `DemoState.staticComment` so both live
card renderers — the cinematic board and the morphing surface that
FLIPs between board, list and timeline — resolve the same domain-true
value with no drift between them. It draws `commentBodies[1]`, not
`[0]`, so the earlier note never duplicates the line the scripted
scene types in live a moment later.

This is the last place the hero demo spoke in a generic voice instead
of the visitor's own. Verified live on production at both 1440px and
390px: the demo's scripted scene renders "RSVPs at 89%, on pace." for
the wedding planner, the toggle carries only the four real audiences,
the old dogfood line is gone from the user-visible surface, and the
page holds zero horizontal overflow on a phone. The verification ran
through an isolated headless Chromium against the live URL — the
demo-loop pixel pass T·51 left owed is now closed, not deferred.

## 2026-05-15 · T·51 · cuts · the tech-team dogfood out of what the 80% see

**The homepage demo toggle and the /about grid presented a
tech-company marketing board — pricing-funnel audits, engineering
headcount, all-hands — as a target audience, right next to the
wedding planner and the tradesperson. A non-tech visitor toggling
through landed on the exact vocabulary alienation this product
exists to refuse.**

`DOMAIN_ORDER` now lists only the four real Signal Tasks audiences:
the wedding planner, the tradesperson, the freelancer, the student —
BRAND.md §3's own canonical example set, verbatim. The `marketing`
pack stays in the source as the inert canonical seed-structure
fallback (its 16-task geometry is what every domain overlays), but it
is never again shown to a user. The cinematic demo's own default and
the out-of-shell domain-context fallback now resolve to the wedding
planner instead of the dogfood board, so there is no path left where
a real visitor sees "Headcount planning · engineering".

Emoji came out of every surface a real user or visitor touches. The
hero demo, the empty states, and — the one that mattered most —
`SEED_COMMENT_BODIES`, which seeds the conversation thread on a fresh
user's first tasks. That set led with "Hero animation looks great in
the latest cut 🎯" and ran through "Pinged finance", "Bumped this to
P1", "Spec is locked, building now". A wedding planner's first
workspace now reads in plain English that is true whether you plan
weddings, wire houses, shoot galleries, or sit exams. The static
showcase teammate comment — hardcoded to that same hero-animation
line regardless of which audience you picked — is now a neutral
on-voice line. Threading it per-audience is the named follow-up.

BRAND.md §3 is unambiguous on emoji and jargon; §2.3 names voice
drift as the moat itself. This was drift, in the highest-traffic
surface the product has. Typecheck, build, and the live production
toggle + /about grid all verified clean.

## 2026-05-15 · T·50 · tightens · the code-review hardening pass

**A three-agent code review found two unguarded comment paths, a
Stripe dedup table that never fired, and a realtime stream that
silently no-ops in production — all closed in one pass.**

The big one: comments leaked across tenants. `getCommentsForTaskAction`
returned a full thread to anyone who knew a task id, and
`addCommentAction` would write a comment onto a task in a workspace
the caller wasn't a member of — it only checked the task *existed*,
never that the caller could *see* it. Both now route through a single
`resolveCallerTaskWorkspace` guard that confirms the parent task lives
in the caller's active workspace; strangers get an empty list,
indistinguishable from a task with no comments.

The quiet one: the Stripe webhook dedup guard was dead. `alreadyProcessed`
cast `db.run()`'s result to a row array — but libSQL `db.run()` returns
a ResultSet, so the row was always undefined and the check always
returned false. Idempotency was leaning entirely on the `notes`-field
compensator. Rewired to a typed `db.select()` against
`processed_webhooks`, so the dedup table actually dedups now.

The honest one: `/api/events` is a single-process EventEmitter. On
Vercel that fans out to one lambda instance and effectively never
reaches other tabs — a realtime UX that looks fine on localhost and
silently fails in prod. The route now returns a 204 (the canonical
EventSource "stop reconnecting" signal) unless `REALTIME_ENABLED=true`,
and stays on in dev. Opt back in when a real substrate (Upstash /
Pusher / Liveblocks) lands.

Also: `advanceDate`'s weekday-walk loops are capped at 7 iterations
(a corrupt recurrence weekday can no longer hang the server action);
`getTasks` gained a 2000-row safety cap (the public `/p/{slug}` share
path resolves through it unbounded); the dead weekly-digest cron entry
was removed (it 400'd every Sunday — the route is now an explicit
operator endpoint); `getEffectiveTier` takes the rank-max of the
shared and local entitlement stores instead of shared-first, so a
Stripe-written paid tier in the local table can't be silently
downgraded during the E-3.2 cutover; the two duplicate `TIER_RANK`
constants collapsed onto the canonical `tier-shared/tiers.ts`; and the
import-activity write surfaces failures to the log instead of swallowing
them (Analytics' just-shipped trigger reads those rows).

Sibling fix in Analytics: `tasks-db-source` was missing the
`parent_task_id IS NULL` filter Tasks' own `getTasks` applies, so
subtasks were leaking into the briefing engine as top-level signals.

Migration owed (operator, not auto-applied): `drizzle/0005_workspace_id_backfill.sql`
backfills NULL `workspace_id` rows to the legacy workspace across seven
tables — the safe half of the schema-review finding. The NOT NULL + FK
constraint rebuild is documented in that file as a separate
operator-with-a-backup follow-up.

Typecheck (Tasks + Analytics), build, and parser tests clean. Changed
files lint clean.

## 2026-05-15 · T·49 · ships · venue redemption survives a fresh-user render

**The wedding comp-code redemption no longer 500s on a fresh user.**
Two bugs were stacked on the same path. First: `applyTemplateAction`
calls `revalidatePath`, which is illegal during a Server Component
render — and `redeemCompCodeImpl` runs synchronously inside the
redemption page render. Second: the schema gained a `source_note_id`
column for the Notes → Tasks extract back in cycle 9.4b, but no
migration ever shipped to Turso prod, so every `INSERT` into `tasks`
errored with "no column named source_note_id".

Fix: extracted a pure DB helper `applyTemplateToWorkspace` in
`src/server/db/apply-template.ts` — no `revalidatePath`, no event
emit, just the lane-position math and the inserts. `comp.ts` and
`/welcome/page.tsx` route through the helper now; `applyTemplateAction`
delegates to the helper plus the cache invalidation, so client-side
template apply still works the same way. Migration
`drizzle/0004_add_source_note_id.sql` adds the missing column.

Operator note: the migration must be applied to Turso prod before
the deploy is functional for fresh users —
`turso db shell ethanmcnamara-tasks "ALTER TABLE tasks ADD COLUMN source_note_id TEXT;"`.

## 2026-05-14 · T·48 · ships · atlas drift-trigger wires into tasks commits

**Tasks commits now flag the umbrella's atlas when a referenced
file changes.** A pre-commit hook in `.githooks/` runs a node
script against the staged file list, resolves any atlas references
that point at this repo, and writes drift into the studio repo's
canonical sidecar. The hook never blocks — drift is a signal, not
a gate. Activation is one `git config core.hooksPath .githooks`.

Smoke-tested by staging `docs/STRIPE_SETUP.md`:
`pricing-and-entitlements` picks up the new drifted path via union
merge alongside the existing entries. Auto-stage is gated on
`REPO_ROOT === STUDIO_ROOT` so this commit leaves studio's sidecar
uncommitted for the studio operator. Full spec lives at
`~/Projects/personal/studio/docs/ATLAS_DRIFT_TRIGGER.md`.

## 2026-05-14 · T·47 · tightens · the venue sign-up reads on a phone

**The venue redemption flow now hits a mobile-correct sign-up. Clerk
buttons and inputs jump from 30px to 48px, the sponsor code legibility
matches the umbrella treatment, H1 leading no longer clips its own
descenders, and the page can't scroll sideways. Mirrors the umbrella
S·26 pass, scoped to the conversion seam every venue-pilot couple
lands on.**

The audit flow: signalstudio.ie/redeem/[code] → /api/redeem → 308 →
tasks.signalstudio.ie/redeem/[code] → 307 → /sign-up?redirect_url=...
The last hop is where couples meet Clerk for the first time. On a
phone, the buttons were 30px tall (well under the 44px WCAG floor),
inputs were 30px at body font size, the H1 was the same size as body
copy, and the sponsor code beneath the venue strip rendered at 11px
gray — readable on a screen, not so much against the printed card
the code came from.

The Clerk styling lives in `src/app/layout.tsx` `<ClerkProvider
appearance>`. Extended `elements` with `!min-h-[48px] !text-[16px]`
on `formFieldInput`, `!min-h-[48px]` + `!text-[15px]` on
`formButtonPrimary` and `socialButtonsBlockButton`. The 16px input
font-size is the iOS Safari rule — anything smaller and the page
auto-zooms when you focus an input. The `!` prefixes override
Clerk's internal styles in the Tailwind cascade.

The sponsor strip on `/sign-up/[[...sign-up]]/page.tsx` got the
S·26 treatment: code separates into its own `Code` eyebrow + 14px
tabular-nums on the line below. Same pattern the umbrella ships at
`/redeem/[code]` — easier to read, easier to type when a couple is
working off a printed card.

Foundation work matches the umbrella too: `html, body { overflow-x:
clip }` in `globals.css` (was `visible`, latent risk), a `@media
(max-width: 640px)` block loosens `.h-display` / `.h-title` /
`.h-section` / `h1` leading from 0.96–1.10 to 1.04–1.18 (descender
clipping fixed on the home page hero among others), `viewportFit:
"cover"` in the root layout for notch-safe iOS, footer legal links
bumped from 11px / 17px tall to 12px / 32px tall with proper
`inline-flex` hit areas and `safe-area-inset-bottom` padding.

Voice and product surface unchanged. The pass is mechanical mobile
hygiene against the same disciplines the umbrella followed on S·26.
Typecheck clean. Build clean.



**The dark navy gradient that closed tasks.signalstudio.ie is gone — the homepage now reads in one register from top to bottom.**

The closing CTA was the last surface on the Tasks marketing site
still rendering off the v1 design system that landed across the
suite on 2026-05-13. A rounded-3xl panel, radial-gradient navy
fill, white-on-dark typography, white-pill primary button — none
of which matched the paper-white-on-ink-#111 hairline register the
other four products committed to. Suite coherence is the moat;
one panel breaking it is one panel too many.

The rewrite strips the panel entirely. Section opens with a top
hairline (`border-t border-line-soft`) — the same gesture that
separates the rest of the homepage. Eyebrow flips to indigo-600
mono (the one accent the system permits). The "Stop reading. /
Start moving." gray-fade trick is preserved but re-rendered in
`text-ink-ghost` instead of `text-white/55`, so the second clause
softens without changing surface. Primary CTA now uses the
identical `bg-ink text-white` pill as the Hero — same button
language across both calls-to-action.

No copy was harmed in the making of this fix. The voice was
already on-brand; only the surface had drifted.

## 2026-05-14 · Entitlements sprint · One tier, every product

Tasks stops being a tier-island. The local entitlements table that
used to be the single source of truth now mirror-writes to a new
shared `signal-entitlements` Turso DB, and reads check the shared DB
first with a local fallback. Every other product in the suite —
Roadmap, Analytics, Notes, Studio — reads the same store, so a
Wedding comp grant minted in Tasks now actually unlocks the right
things in the briefing email + roadmap workspace counter without
each product owning its own copy of the truth.

Vocab was unified along the way. `pro` and `team` collapsed into
`workspace` to match what the umbrella pricing page actually sells;
`event` was added. The internal `EntitlementTier` union and every
string literal that compared against it (`billing.tsx`, `comp.ts`,
`plan-view.tsx`, the Clerk webhook .edu grant) were renamed in one
sweep. No data migration was needed — Tasks had exactly one paid
entitlement in the wild (a `wedding` comp), which already used
canonical vocab.

A new public seam landed for cross-product checkout: `GET
/api/checkout?tier=workspace|event` redirects an authed Clerk user
into a Stripe checkout session for the right tier, with a fail-loud
guard that bounces to `signalstudio.ie/pricing?status=checkout-offline`
if Stripe envs aren't configured (a stranger can no longer click an
umbrella CTA and walk away with a paid grant before payment lands).
Studio's pricing CTAs deep-link here.

Hardening: the Stripe webhook handler now mirrors its dedup row into
shared `processed_webhooks`, and `writeSharedEntitlement` retries
transient errors with backoff. The daily digest cron got a reconcile
sweep piggybacked on it — walks all active local entitlements and
asks the shared DB to mirror anything missing, idempotently. A
companion `POST /api/internal/reconcile-entitlements` bearer-authed
endpoint lets the operator trigger the same sweep between daily runs.

Settings/billing UI was tightened: Studio and Wedding cards no longer
render as buyable (they're operator-granted / venue-comp only); the
upgrade grid now filters to self-serve tiers + the user's current
one. Currency standardised to € everywhere.

Operator docs: `docs/STRIPE_SETUP.md` (with exactly the two products
that map to public pricing — Workspace + Event).

## 2026-05-14 (voice hygiene) · The last few sprints, swept

A cross-suite copy review surfaced what the prior jargon purges had
missed. Most of the drift was here in Tasks — Roadmap, Analytics,
Notes and Studio came back clean.

**The cinematic demo loses a Burndown.** The corner-mounted sparkline
on the homepage demo was labelled `Burndown` — the chart name we
specifically refuse on the about page. It now reads `Open work`,
which is what the line actually is. The underlying state shape kept
its variable name; the ban is on copy, not on identifiers.

**A pulse on every plan.** The `Live signals` feature card was titled
*Burndown without dashboards* — promoting the banned word as if it
were a feature. Re-titled *A pulse on every plan*; body shifted
*Burn rate* → *Pace*. Same meaning, different register.

**Sprint becomes push, in two templates.** `final-paper-sprint` and
`job-application-sprint` were running-sprint English, but the
ambiguity with the PM term costs us every time. Slugs renamed to
`final-paper-push` and `job-application-push`. Permanent 308
redirects added in `next.config.ts` so existing inbound links keep
landing. Template display names, essay seoTitle, and the
`student → final-paper-*` map in `published-footer.tsx` all moved
in lockstep. Future-facing post drafts under `docs/` were updated;
historical changelog entries kept their original slugs intact —
rewriting history is the worse drift.

**Smaller polish.** `data.ts` seed task *Sprint planning · Q3 themes*
→ *Quarterly themes · Q3*. `for-freelancers.tsx` "wants to see the
gantt and you want to see the kanban" → "the timeline and you want
to see the board". `roadmap-view.tsx` headline lost the "· not the
product backlog" tail (the page already does the anti-callout work
without that phrase). `embed-guide.tsx` Google Docs note: "smart
chip with the page's OG card" → "card with the page preview".
`launch-readiness-seed.ts` retired *seamless* and *in backlog*.
Roadmap repo got one comment fix: a share-gesture comment that
described itself as *intelligent* now describes itself as something
that *lands*.

**What stayed.** Every anti-feature callout — the manifesto's
*"no story points, velocity, burndown, OKR alignment"*, the
trades page's *"no sprint vocabulary"*, the small-business page's
*"nothing here calls you a stakeholder"*, the analytics method
page's *"no agent, no copilot"* — kept verbatim. Refusing a word
by naming it is exactly the §6 pattern; that's the brand doing
its job, not drift. The `Sprint 2` / `Sprint 9` references in
internal code comments also stayed for now — a separate hygiene
pass when the appetite is there.

## 2026-05-13 (suite design-system v1) · Paper turns white, the dot learns to heartbeat

The umbrella's new design system landed and Tasks is the first product
to follow Studio across the line.

**Paper white, ink at #111.** `--bg` reset from warm-stone `#fafaf7`
to pure `#ffffff`. Ink moved from the ramp's `#18181b` to the spec's
`#111111`. The semantic-token layer (`--paper`, `--paper-soft`,
`--paper-deep`, `--ink`, `--ink-soft`, `--ink-faint`, `--ink-ghost`,
`--hairline`, `--hairline-2`, `--indigo`, `--indigo-soft`) is in
`globals.css` alongside the existing ramp + alias system, so legacy
callsites keep working while the rest of the rollout proceeds. Print
views keep `#fafaf7` paper colour because print has its own rules.

**`.tasks-dot` learns to heartbeat.** The dot's motion swapped from
the 2.6s broadcast-style pulse-and-emit (which belongs to *signal
studio.*) to **M·02 heartbeat — paired beats every 1.6s.** Tap-tap,
rest. Work has a pulse; this is the rhythm of getting things done.
The emit ring retired — heartbeat doesn't broadcast, it pulses. The
indigo glow box-shadow retired too; the design system is restrained.

**What didn't change.** The Wordmark component API is unchanged
(`<Link>` wrapper, sm/md/lg sizes, href). The dot's eye-correct
proportions (0.32em / -0.38em) stay — the suite spec's 0.16em is
calibrated for display sizes and disappears at nav-size. Print
views, primitives, the kanban board chrome, lane colours — all
intact. Page-level retouches will land as pages get walked through.

**Carries forward.** Phase 3 is Roadmap — same token set, wordmark
motion to advance (2.6s drift-right-and-reset).

## 2026-05-13 (suite review pass) · Two cross-tenant holes, one Sentry that lied, and an index migration that should have been there from day one

Five-agent parallel review of all five repos. Tasks took the longest
punch list because Tasks has the most surface.

**The two cross-tenant holes.** `/api/calendar/[workspaceId]` would
serve a workspace's dated task titles to any signed-in user who could
guess the id. Now joins `workspace_members` first; mismatched id
returns 404. The docstring used to claim "public per workspace id by
design, like /p/{slug}" — half-true; the proxy required auth anyway,
so the route was both unsafe AND unable to do the thing the docstring
promised. Rewrote it to say what it actually is.

`removeCommentAction` deleted any comment by id with no scope. Any
signed-in user could nuke another tenant's comments. Now scoped on
`(active workspace via task join, author === caller)`. The pattern
that everything-else-in-`tasks.ts` already uses, just applied here
finally.

**Sixteen indexes that should have been in the first migration.**
`tasks.workspace_id`, `comments.task_id`, `activities` keyed on
`(task_id, created_at DESC)` and `(workspace_id, created_at DESC)`,
`notifications(user_id, created_at DESC)`, `entitlements(user_id,
workspace_id)`, the `workspace_members` reverse-lookup, and a few
others. Applied to prod Turso via the CLI; the SQL lives in
`drizzle/0003_hot_indexes.sql` with idempotent `IF NOT EXISTS` so
re-running is safe. Every page load was a full table scan before
this — fine at seed-row counts, not fine the moment a workspace
gets a few hundred tasks.

**Sentry that lied, replaced with one that does the thing.**
`beforeSend(event) { return event; }` was the entire scrubber. The
comment above it claimed "anti-noise: don't sample drizzle/sqlite
errors more than once" — completely fictional. Killed it. New
`src/lib/sentry-scrub.ts` reduces `user` to id only, drops
`cookies` / `data` / `query_string`, redacts cookie/authorization/
x-clerk-*/svix-*/stripe-signature headers, filters out breadcrumbs
to clerk/stripe/svix/webhooks endpoints. `sendDefaultPii: false`
on every init point — server nodejs, server edge, client. Defaults
were sending IP and Clerk session tokens to Sentry.

**Suite-wide security headers.** Plan 4.1 was supposed to put HSTS,
X-Frame-Options, Referrer-Policy, Permissions-Policy, and a
Report-Only CSP on every product. Tasks was on the missing-list.
Fixed now — Roadmap-pattern headers with Clerk + Stripe + Sentry
hosts in the CSP allowlist. Still Report-Only across the suite;
promotion to enforce remains a browser-verification job.

**Dead `better-sqlite3` swept out.** Tasks moved to libSQL/Turso a
while back, but the dependency stayed, `serverExternalPackages:
["better-sqlite3"]` stayed, `outputFileTracingIncludes: { "/**":
["./tasks.db"] }` stayed, and `seed.ts` was still importing
`better-sqlite3` types and casting `db.$client` as a `Database` —
which only worked at all because the early-return-if-not-empty
gate meant the broken code path almost never ran. Seed rewritten
to use libSQL drizzle natively (async, real `db.transaction`). The
180KB `tasks.db` file no longer ships in every Vercel function
bundle. Stale comments stripped from five route files.

**One-off contract: cross-product partner stats over HTTP.**
Studio's `/hq/partners` page used to open its own libSQL client
and read Tasks's `comp_codes` + `entitlements` tables directly.
Tasks now owns the read: `GET /api/internal/partner-stats?sponsor=
<slug>` with `PARTNER_STATS_SECRET` bearer auth. Studio fetches
it. Same data; different responsibility line. The proxy
allowlist gained `/api/internal/(.*)` because the caller has no
Clerk session.

**Tidying.** Duplicate `package-lock.json` deleted (pnpm-only).
Old comments referencing "better-sqlite3 needs Node" in five
route files updated to reflect what's actually true now.

Operator action owed: set `PARTNER_STATS_SECRET` on the Tasks
Vercel project (same value as on Studio); the calendar route's
public-by-token replacement is still a future cycle.

## 2026-05-13 (later still) · A settings screen that sounds like us

Bespoke Settings at `/settings/profile`, `/settings/notifications`,
`/settings/plan`. The borrowed Clerk surface is gone — every label,
every error string, every empty state is ours now. The plan called
it Cycle 9.1a + 9.1b; they landed together.

Three tabs by what they ask of you, not by what they store. Profile
holds name, avatar, email change (two-step with verification code),
password (with current-password reveal toggle and "sign out other
devices" on save), two-factor sign-in (full QR + manual key fallback
+ ten recovery codes you have to acknowledge before continuing),
active sessions (current device labelled, sign out others with one
click), connected accounts (Google, Apple, GitHub), and a danger
zone that runs as a mailto for the first ~50 users — slow on
purpose; we'd rather be slow than wrong about who pressed delete.

"What we send you" replaces "Notification settings". Three rows:
Daily Signal cadence (off / weekdays / every day), Weekly summary
(off / Mondays), Time zone (IANA, auto-detected via Intl). Plus
one always-on row for plan-change + expiry notices: *"the difference
between a refund window and a surprise."* New `user_preferences`
table (drizzle/0002) — distinct from the existing
`notification_prefs` which carries in-app workspace-internal toggles.
Different concern, different lifecycle.

"Your plan" is Lamb's-Hill-aware. Wedding comp redemptions read the
sponsor name + redemption code straight off the entitlement → comp
code join and render: *"A year of Signal Studio, on Lamb's Hill. When
the year is up, the workspace stays."* Paid tiers open Stripe
Customer Portal via email lookup (we don't store stripe_customer_id
yet — Plan 9.2 problem if it ever bites). Free tier links to
signalstudio.ie/pricing.

The Clerk `UserButton` "Manage account" item now sits next to a new
"Settings" entry pointing at `/settings/profile`. Both still work;
ours is first.

What didn't ship this cycle (deliberate non-builds): cascade
account-delete, workspaces management tab, data export, email
open-tracking, cross-product preferences unification, settings on
Roadmap/Notes/Analytics. All scoped out of v1. Tasks first, the
others inherit the chassis later.

Operator action: apply `drizzle/0002_user_preferences.sql` to prod
Turso before the notifications tab can persist anything.

## 2026-05-13 (the same evening) · The "did the next person finish?" signal

One column. One boolean. The minimum-viable monitoring for a venue
pilot at N=10 — answers the question that actually keeps you up after
sending Sinéad ten codes: *did the most recent couple get into their
workspace, or did they get stuck somewhere?*

Schema gains `entitlements.reached_board_at` (nullable integer
timestamp). `markVenueEntitlementReached` stamps it on the first
`/app/board?welcome=venue` render — idempotent on
`reached_board_at IS NULL`, so subsequent visits leave the original
timestamp in place. The UPDATE is wrapped in try/catch: a
measurement-helper failure can never break the board render. Worst
case the timestamp is missed for that visit; the product still works.

Studio reads the new column in `getPartnerStats` with a try/fallback
pattern — the column-aware SELECT runs first; if the prod Turso
ALTER hasn't landed, we fall back to the original shape and report
`reachedBoard: 0`. /hq/partners gains a "Reached board" column showing
`<count> (<%>)` where the percent is reached/redeemed (not
reached/issued — the funnel only meaningfully starts at redemption).

Conscious non-build: per-event funnel table, email open tracking,
`tasks_created_after_redemption` engagement column. The brand
position is restraint, the scale is ten codes, and the operator
question that matters is binary. We earn the event tables at venue
#3, not before.

Migration: `drizzle/0001_add_reached_board_at.sql` — apply to prod
Turso before the next /hq/partners visit (graceful fallback otherwise,
but the column reads zero until then).

Closes Cycle 8.4.7.

## 2026-05-13 (immediately after the polish bundle) · Sentry on the silent paths

The 2026-05-13-third saga (the orphaned-redemption one) cost us hours
because the Clerk webhook returned 500 quietly. No dashboard. No
breadcrumb. We found it by archaeology, working backward from a
corrupted-data symptom. Cheap insurance against the next one of those:

- `src/app/api/webhooks/clerk/route.ts` — missing-secret in production
  fires `Sentry.captureMessage` at error level (was just a plain 500).
  The event-handler switch is now wrapped in try/catch with
  `Sentry.captureException` tagged `webhook=clerk` + `eventType` +
  `svixId` + `eventDataId`, then re-thrown so Clerk still retries.
  The tag set is the whole point: when the next silent failure comes,
  the dashboard tells us *which* event type broke and *which* user it
  was about.
- `src/server/actions/comp.ts` — `redeemCompCodeAction` wraps its
  implementation in try/catch with `Sentry.captureException` tagged
  `action=redeem-comp-code` + truncated `code`. Expected `ok: false`
  returns (not-found, exhausted, expired, already-redeemed,
  still-provisioning) are NOT captured — those are flow outcomes, not
  errors.

No-op when `SENTRY_DSN` is unset (dev/preview). Closes Cycle 8.4.6.

## 2026-05-13 (the morning after) · Redemption polish — four small choices, one deploy slot

A four-agent panel (creative-director, ux-director, ux-tester, strategy)
sat with the venue-edition flow we shipped last night and converged on
four things worth doing before Sinéad gets the CSV. Three are surgical;
one is pure copy. Two hours of work. One deploy.

**The brand-thread breakage at the Clerk seam.** Couples were leaving
`signalstudio.ie/redeem` with Lamb's Hill firmly in mind and arriving
at a generic Clerk sign-up that mentioned neither the venue nor the
code nor the gift. ux-tester called 40% bounce. We added a small
context strip above the Clerk component:

> [SPONSOR NAME]
> Almost there. Lamb's Hill is covering your year.
> Code · LAMBSHIL-MP93X

Eleven-pixel mono eyebrow, fourteen-pixel ink-soft sentence, fainter
mono code line. No buttons. No flourish. The thread is the visual
repetition, not new prose. (See `src/app/sign-up/[[...sign-up]]/page.tsx`
and the new `lookupSponsorByCode` in `src/server/db/venue-welcome.ts`
— resolves sponsor identity from `comp_codes.notes` JSON without
needing an authenticated session.)

**The triple-redirect that elided the success moment.** Click "Open
the workspace" → /welcome → server short-circuit → /app/board. Three
server hops for what should feel like one decisive landing. We moved
the wedding-template apply and the `active_domain = 'wedding'` flag
into `redeemCompCodeAction` itself; the result card now deep-links
straight to `/app/board?welcome=venue&v=<sponsorSlug>`. /welcome
still serves non-venue first-time sign-ups + acts as a defensive
fallback if someone navigates there with a venue entitlement.

**The wrong palette on the success card.** Emerald reads "system
status: shipped." That is exactly the wrong register for "your wedding
workspace just activated." Swapped to `--aud-wedding` rose — the
audience accent BRAND.md §7 reserves for weddings. Same construction
(border tint, faint wash, eyebrow, tier label, icon background). Check
icon stays — at a moment of high anxiety, the visual "yes this worked"
is precisely what a tired adult thanks us for.

**The email that didn't exist yet.** The note Sinéad sends each couple
is the *actual* first touch with the brand. We wrote it for her in
studio's docs (`docs/VENUE_EDITION_EMAIL_TEMPLATE.md`) — plain text,
no exclamation marks, "the work of getting married" + "yours alone,
activates once" + her sign-off. Ships before the first CSV does.

Idempotency edge: re-hitting `/redeem/<CODE>` after a successful
redemption no longer applies the template a second time (would have
appended a duplicate set of wedding tasks). The early-return now
surfaces `sponsorSlug` so the card can still deep-link, but the
template apply is gated on first-redemption only.

What we are NOT doing in this bundle (deferred to a "Cycle 8.5.5 —
polish v2" post-retro): IncludedStack-box → ruled-list cosmetic,
"sponsoring" softer phrasing on the studio landing, "Claim your seat"
CTA tone, the "every view is the same items, all in plain English"
microcopy in VenueWelcomeCard, sponsor-named tasks in the seeded
wedding template, and `already_used`-error self-vs-other routing.

Files touched:

 • `src/app/sign-up/[[...sign-up]]/page.tsx` — sign-up context bridge
 • `src/server/db/venue-welcome.ts` — `lookupSponsorByCode` helper
 • `src/server/actions/comp.ts` — template apply + sponsorSlug return
 • `src/components/redeem/redeem-result-card.tsx` — href + rose palette

Closes Cycle 8.4.5. Clears the runway for 8.5 (Lamb's Hill provision
+ soft launch).

## 2026-05-13 (even later, the third one) · The bridge had a second hole, deeper, and it was already orphaning users

The first live walk through the bridge surfaced two more problems
beneath the one we already fixed.

**Problem one.** The Clerk webhook signing secret is missing from
Tasks's Vercel production. `CLERK_WEBHOOK_SIGNING_SECRET` simply
isn't there — was either never set or got rotated out. Without
it, the `user.created` webhook handler returns 500 to Clerk before
it can write the users + workspaces + workspace_members triple.
Result: new sign-ups land with a Clerk session, no internal user
row, no personal workspace. `getCurrentUser()` returns the Clerk
id; `getActiveWorkspace()` falls back to `ws-legacy` — the dev
seed workspace shared by ada, alex, chloe, david, marcus.

**Problem two, downstream of one.** `redeemCompCodeAction` had
no guard against `ws-legacy`. So the first real venue walk wrote
a wedding entitlement against the shared dev workspace, and the
welcome page would have happily mutated that same workspace's
template + active_domain on the next request. Couples would
have collided with each other into a single shared fallback
workspace if more than one had redeemed.

**Problem three, separate.** The action's check order had
idempotency AFTER the exhausted check. So the user who just
successfully redeemed, refreshing /redeem, got the cheerful
"All redemptions on this code are used up" headline instead of
"You're already on Wedding suite." A small clarity bug with a
high mortification cost in a pilot.

Fixes shipped together:

 • `src/server/db/ensure-user.ts` — new `ensureUserProvisioned`
   helper. Idempotent. Synthesizes a minimal users +
   workspaces + workspace_members triple from just the Clerk
   id, using the same id/slug/color derivation as the webhook
   handler so when (or if) the webhook does eventually fire,
   the ON CONFLICT updates land cleanly on top.
 • `src/server/actions/comp.ts` — three changes. Idempotency
   check now runs before the exhausted check. After the per-
   user lookup, the action calls ensureUserProvisioned so we
   never resolve a workspace that's `ws-legacy` for a real
   Clerk user. A defensive `still-provisioning` reason is
   added in case the provisioning ever fails to give us a
   real ws.
 • `src/app/welcome/page.tsx` — same `ensureUserProvisioned`
   call at the top, plus a `ws-legacy` guard that renders an
   auto-refreshing "Setting up your account" interstitial
   instead of mutating the shared workspace.
 • `src/components/welcome/still-provisioning.tsx` — small
   client component for the interstitial. Auto-reloads after
   1.5 seconds.
 • `src/components/redeem/redeem-result-card.tsx` — success
   CTA now points at `/welcome` instead of `/app/board`, so
   the venue short-circuit can run and the wedding template
   actually gets applied. Previously the success card was
   sending users straight into an empty workspace.

Cleanup: the orphaned LAMBSHIL-MP93X entitlement that landed
in `ws-legacy` during the test walk was rolled back, and the
comp_code redeem counter reset to 0 so the code is claimable
again.

Outstanding: the webhook secret itself still needs to be set on
Vercel before Tasks's normal sign-up flow can hydrate email,
name, and handle on the users row. The fallback provisioning
is enough for the venue pilot — entitlements bind correctly,
workspaces resolve, and the wedding template applies — but
real Tasks accounts deserve their real names.

## 2026-05-13 (later that day) · The bridge had a hole in it. Couples found out before Lamb's Hill did.

Yesterday's "lands in a wedding workspace, no questions asked" was
true on paper. It was less true the first time the live URL got
poked. `tasks.signalstudio.ie/redeem/LAMBSHIL-MP93X` returned HTTP
500 to anyone who wasn't already signed in — which is, of course,
the entire audience for that URL.

The page called `redeemCompCodeAction` unconditionally; the action
called `getCurrentUser()`; and `getCurrentUser()` in production
throws on an unauthenticated request rather than silently running
as the dev seed user. Uncaught throw, Next default error page, the
couple bouncing to "Something went wrong." The local typecheck and
build never noticed because TypeScript can't see runtime auth state,
and the end-to-end test had been deferred to "when we deploy."

The fix is six lines. The page now calls `getCurrentUserOrNull()`
first; if there's no session it redirects to
`/sign-up?redirect_url=/redeem/CODE`. Clerk's sign-up component
honors `redirect_url` natively (env is already wired), so the
couple signs up, lands back on `/redeem/CODE` with a session, and
the original flow takes over from there.

The cost of skipping the live walk has been logged. Saved feedback
`feedback_launch_claim_rule` exists exactly to prevent this; the
deploy went out before the walk this time. Won't again. Lesson is
now two cycles old.

## 2026-05-13 · A couple shows up with a code, lands in a wedding workspace, no questions asked

Venue Editions has a Tasks side now. A couple who books their wedding
at a participating venue gets a code from their venue, types it in,
signs up, and lands on /app/board with a populated wedding workspace
and a quiet card that reads *"Compliments of [their venue]."* The
welcome picker that asked them to "pick a starter so you have something
to play with" doesn't fire — we already know what they're here for.

Three things shipped together. First, a new `detectVenueWelcome` helper
on the server side that joins the user's wedding/comp entitlement to
the originating comp_code row and parses the sponsor identity JSON
that was tucked into `comp_codes.notes` by the studio repo's issue-codes
script. Same query path the welcome page and the board page both use.

Second, the `/welcome` page learned to short-circuit. If the user has
an active wedding entitlement linked to a sponsor, it auto-applies the
canonical `wedding-planning-workspace` template, flips the workspace's
`active_domain` to `'wedding'`, and bounces straight to
`/app/board?welcome=venue`. No picker. No "play with." No friction.

Third, a new `VenueWelcomeCard` client component shows a dismissible
card on /app/board naming the sponsor — "Compliments of Lamb's Hill.
Your wedding workspace is ready. Plan without the noise — every view
is the same items, all in plain English." Dismissed in localStorage,
keyed by sponsor slug so the next venue's couples get their own card.

The welcome picker also got two copy fixes for everyone (not just
venue users): the headline gloss "something to play with" became
"a real example to edit," and "Loaded · ready to open" became "Your
starter is in." Both of the old strings were on the BRAND.md §3
banned-vibe list — techy register on a page that's the user's first
sentence with the product.

This closes Cycle 8.3 of Plan 8 (Venue Editions). The studio side of
the reconciliation lives in studio/docs/CYCLE_8_3_RECONCILIATION.md
— including the part where we accidentally built parallel infra in
Cycles 8.1/8.2 and had to roll a chunk back when grep on `tasks/`
turned up the existing redemption system. Lesson logged.

## 2026-05-12 (still even later) · The avatar dropdown learned about siblings, and mobile got a top bar

Two things shipped together this turn. First, the Clerk UserButton in
the bottom-left of the sidebar now opens a dropdown with three new
rows above Manage account / Sign out: "Open Roadmap", "Open Notes",
"Open Analytics" — each with a small arrow-out icon, each opening in
a new tab. Tasks doesn't list itself; you're already here. The
underlying `<UserButtonWithSuite/>` is a tiny client wrapper around
Clerk's official `<UserButton.MenuItems>` + `<UserButton.Link>` API,
so the chrome stays Clerk-native (same hover, same shadow, same kbd
focus) — we just added the suite jumps inside it.

Second, mobile users finally have a top header. Until now Tasks's
mobile chrome was bottom-tabs only; the desktop sidebar's `signal
studio. /` breadcrumb didn't exist on phones. New `<MobileSuiteBar/>`
is a fixed h-9 bar at the top, md:hidden, carrying the same launcher
trigger and a small `tasks·` wordmark beside it. The layout's
children container gained `pt-9 md:pt-0` to push content below it.

Both gestures point at the same thing: a Tasks user who needs
Roadmap or Notes can get there in one click, on every viewport,
without ever typing a URL.

## 2026-05-12 (one more even later) · The breadcrumb learned to open

Yesterday's `signal studio.` text in the sidebar was a hard link to
the umbrella site — click it, you leave. Today it's a button. Click
it, a small popover blooms below: "Signal Studio · Four products,
one studio." Then four rows — tasks, roadmap, notes, analytics —
each with a one-word tagline (Execution clarity, Direction clarity,
Capture clarity, Attention clarity). Tasks is yours so it's de-
emphasised with a small uppercase HERE tag. The other three open in
a new tab so you keep your workspace. Footer row: "Visit
signalstudio.ie →" because the umbrella is still one click away.

The popover is keyboard-aware (Escape closes), click-outside-aware
(any document click outside the wrapper closes), and noise-free
(no caret on the trigger; discovery is hover + click). It uses
`bg-white` and the same shadow grammar the command palette wears
(`0_24px_60px_-24px_rgba(...)/0.22`), so it reads as part of the
same chrome family.

The command palette also learned about its siblings. Open ⌘P with
nothing typed and the empty state now carries a "Jump to" section
beneath the search hint: roadmap, notes, analytics, each with their
tagline. Type `ro` and only Roadmap surfaces. Type something that
matches no task AND no product, and the palette stays clean.
Roadmap and Notes don't have palettes yet, so this is a Tasks-only
gesture for now — the launcher popover is the universal fallback.

What this turn explicitly did NOT ship: mobile-Tasks header with
the breadcrumb (the bottom-tab surface has no top chrome and adding
one is its own design call); Clerk UserButton custom dropdown items
(Clerk's typed `userProfileProps` API needs spelunking — own cycle).
Both queued.

Implementation: new file
`src/components/app/suite-launcher.tsx` (~150 lines, "use client",
self-contained popover with click-outside + Escape handlers).
Wired into `src/components/app/sidebar.tsx`. Palette gained
imports from `product-urls` and a `SuiteJumps` subcomponent.

## 2026-05-12 (later than even later) · The workspace remembers its address

The sidebar's top-left used to just say `tasks·`, as if Tasks lived
nowhere in particular. Now it reads `signal studio. / tasks·` — a
quiet 12px breadcrumb prefix in front of the wordmark, indigo dot and
all. The marketing site has been wearing this prefix since yesterday;
today it walks into the workspace too.

The studio link is a hard `<a>` to signalstudio.ie, not a Next.js
Link — same-window navigation because clicking the breadcrumb means
"take me out of this workspace, into the umbrella," not "open a
second tab I'll forget about." Hover state lifts the prefix from
ink-quiet to ink, in the same 200ms transition the marketing nav
uses, so the gesture feels like one fabric across the suite.

Roadmap got the same treatment in the same turn. Notes already had
it. Analytics has no app shell yet, so its turn comes when that
shell arrives. Mobile bottom-tab Tasks is unchanged — that surface
has no wordmark to prefix, and the cross-product story for mobile is
the next cycle's job (suite launcher popover, palette "Jump to").

Implementation: two-file edit. `src/components/app/sidebar.tsx`
imports `STUDIO_URL` from `@/lib/product-urls` and renders the
`signal studio. /` prefix to the left of `<Wordmark size="md" />` in
the desktop sidebar header. Layout stays at h-12 with `min-w-0` and
`flex-shrink-0` on the prefix and separator so the wordmark gets all
remaining width.

## 2026-05-12 (even later) · The Anatomy card learned how to breathe

The "Every detail earns its place" section on the features page is no
longer a still life. The demo card now lives a 14-second loop in
front of you: a comment count ticks up, the violet lock outline draws
itself around the card as someone joins, a second avatar (EM) springs
in beside DV with a hair of overshoot — DV gets a tiny squash in
return because that's what motion graphics 101 says happens when
another body enters the frame. The amber "Idle 4d" pill morphs into
a green "Live" chip with a real layout transition (not a crossfade
hack). A typewriter caption types "Someone is in the card." in 22ms
per glyph. Comment counts and due-hour countdowns are slot-machine
rolls with spring physics, not number swaps. The whole thing pauses
when off-screen and respects `prefers-reduced-motion`.

The section also became a two-way teaching tool. Hover any chip on
the card OR any row in the numbered index — both light up, the rest
dim to 40%, and the card itself lifts on a soft spring (scale 1.04 +
deeper shadow). You can stop reading and start reading-by-pointing.

Implementation: rebuilt on `motion` v12 (already in the tree, formerly
Framer Motion). Real spring physics replaced the cubic-bezier
scaffolding; `AnimatePresence` + `layout` prop handles the pill morph;
`pathLength` animates the SVG lock outline; `MotionConfig
reducedMotion="user"` covers accessibility in one line; `useInView`
pauses the loop when the section isn't on screen. Six distinct easing
curves — deliberate vocabulary, one per gesture type — keep the
motion grammar legible rather than uniform.

## Cycle 45 · 2026-05-12 · Plain-English activity log (Sprint 2 cycle 10.4)

The settings → Members tab gained a Recent section below the member
list. Last 10 workspace changes, in human prose, visible to all
members (not owner-gated). Brand-mission read: gesture #4 of Sprint
2's five — "Ethan added two tasks. 12m ago" / "Aoife finished
'Send invoices'. 1h ago" / "Owen moved a task between lanes. 2d ago".
Not "user_2k3 created entity task_abc on workspace xyz".

Grouping: walks the activity table newest-to-oldest and collapses
consecutive same-(user, kind) events within a 10-minute window into
one line. Three taskAdds by Ethan at 10:00 / 10:02 / 10:08 →
"Ethan added three tasks. 12m ago". A taskAdd and a move in the
same window stay separate (different kinds).

Mapper has prose for every ActivityKind in the existing payload
shape: taskAdd, toggleComplete (done + reopen split), move (single
shows from→to lanes with the task title), update (per-field
phrasing), commentAdd, commentRemove, attach, detach. Falls back to
"{user} updated the workspace." for anything unrecognised. Display
name resolution: name -> handle -> email-local -> "Someone". No raw
user-ids ever surface.

The Sprint 2 plan-doc said "new tasks table + formatActivity
mapper". No new table was needed — the existing `activities` table
already records every event from the per-task conversation feed.
The cycle is the prose mapper + the workspace-scoped query +
grouping + the surface in settings.

No new schema migration. `listWorkspaceActivityAction` is the new
server action; the existing per-task `formatActivityLine` in the
detail-panel stays unchanged.

## 2026-05-12 (later still) · Suite chrome — one bar, breadcrumb prefix

The thin cross-product strip on top of every Tasks marketing page is
gone. The Tasks wordmark now sits next to a small "signal studio. /"
back-link, all on one row. About 28px of vertical chrome reclaimed
above the hero stat — Tasks finally introduces itself before
introducing the suite. Same call rolled out across all four products
plus the umbrella; see the umbrella changelog for the dissent
captured inside the decision.

## Cycle 44 · 2026-05-12 · Invite flow honest — Sprint 2 cycle 10.1

The "Real invites land in Phase F. For now we logged it." toast is
gone. The invite flow has been real for cycles — `inviteMemberByEmailAction`
creates a pending_invites row, mints a 32-char token, sends an actual
Resend email (with graceful no-key fallback), and the `/invite/[token]`
page handles signed-in-with-right-email / wrong-email / not-signed-in
states. Cycle 10.1's real work was closing the demo-vs-reality gap on
the settings UI: the invite form copy now describes what actually
happens, the toast on success says "Invite sent to <email>", and a
new Pending invites panel sits between the form and the member list.

Pending invites panel shows email, "Sent X days ago", "expires in Y
days", with two gestures: Resend (re-uses idempotent action — same
token, fresh email) and Revoke (expires the row server-side, leaves
audit trail). Owner-only; non-owners see the panel but no buttons.

Two new server actions: `listPendingInvitesAction` (active workspace,
filters to unaccepted + unexpired, sorted newest first),
`revokePendingInviteAction` (owner-only, sets expiresAt to now so
revoked links land on the existing /invite expired-state copy).

The brand line being held: gesture #1 of Sprint 2's five — one-click
invite. No permission matrix, no role configurator, just an email
input and a Send invite button. Three editing guests on Free,
unlimited on Workspace. Cap-counter remains in the panel header.

## Cycle 43 · 2026-05-12 · Cross-repo Notes -> Tasks write surface

Tasks gained a single new route handler: `POST /api/notes-extract`.
Signal Notes calls it from its server action when a user presses
Send to Tasks on a drafted extract. The body is the creator-authored
action wording — never the raw note body. The route writes a new
task into the user's first workspace, returns the taskId, workspace
name, and a deep-link back to the board.

Auth: shared bearer secret `NOTES_TO_TASKS_SECRET` + the user's
Clerk userId in the body. First-party service-to-service pattern.
The endpoint refuses without the secret env var configured (500),
or with a mismatched bearer (401).

Idempotency: new `source_note_id` column on the tasks table, keyed
as `{userId}:{noteId}` so a repeat call returns the existing task
instead of duplicating. Notes retries are safe.

Workspace selection: the user's first workspace_members row wins.
A user with no workspaces gets a 404 with a surfaced reason ("create
a workspace in Tasks before sending extracts") so Notes can tell
them what to do.

Task shape on create: title = the extract body, description =
"Drafted from a private note in Signal Notes.", lane = todo,
priority = p2, assignees = []. The user re-shapes from the board.

What's needed to deploy:
- ALTER TABLE tasks ADD COLUMN source_note_id TEXT
- NOTES_TO_TASKS_SECRET env var on Tasks (Vercel)
- Same secret on Notes (matching value)

## Cycle 42 · 2026-05-12 · Remix toast invites a Roadmap

The toast primitive gained an optional action link rendered below the
body with a brand arrow glyph. `TemplatedToast` now handles
`?remixed=<id>` in addition to `?templated=<id>` — for canonical
workspace templates (currently just `wedding-planning-workspace`), the
remix-success toast carries a "Create a Roadmap for this" link to
`roadmap.signalstudio.ie/onboarding/from-template/<id>`, opening in a
new tab. Specialty Tasks-only templates skip the action.

This closes Templates Cycle T-2.1c — the discoverability gap that
left T-2.1b technically working but invisible from inside Tasks. The
wedge demo loop is now four-layer walkable: remix wedding in Tasks →
toast suggests Roadmap → seeded roadmap workspace appears with one
planning project and eight items.

## Cycle 41 · 2026-05-12 · Workspace remembers its template

Templates Cycle T-2.0. Workspaces now carry a `templateId` text column on
the `workspaces` table, populated by `remixTemplateAction` when a user
remixes a template into a fresh workspace. Existing workspaces and any
workspace seeded via the additive `applyTemplateAction` get null — apply
is intentionally a mixing operation, not a sticky claim about a single
template's identity.

Why: the four-layer lazy expression mechanism (T-2.1 Roadmap, T-2.2
Notes, T-2.3 Analytics) needs a single source of truth for "which
template did this workspace come from." That single source is now this
column. Each consuming product reads it on first visit and seeds its
slice from the canonical template files in the studio repo.

T-2.0 is the bookkeeping step. The visible cycles ship next: Roadmap
first because it has the clearest workspace model and the most
shareable artefact.

## Cycle 40 · 2026-05-12 · Wedding template lifts to canonical four-layer source

The wedding-planning-workspace template moved out of `tasks/src/lib/templates.ts`
and into the studio repo as the first canonical workspace template at
`studio/src/lib/templates/wedding-planning-workspace/`. It is now a five-file
artefact — meta, tasks, notes, roadmap, analytics — and the four-layer
expression of one workspace lives in one place instead of being scattered
across hand-built demo mocks in four repos.

A new `pnpm sync:templates` script reads the studio canonical source
(sibling directory) and writes `src/lib/templates.generated.ts`, which the
existing `TEMPLATES` array splices in at the start of the wedding section.
Order in the gallery is preserved. The eighteen-task wedding workspace
that ships at `/templates/wedding-planning-workspace` is byte-equivalent
to the inline version that preceded it.

The other twelve templates remain inline in Tasks as specialty templates.
Per the strategy doc (`studio/docs/TEMPLATES_STRATEGY.md` locked 2026-05-12),
only the five anchor templates ripple to four layers; the specialty ones
stay Tasks-only.

This is Cycle T-1 of the templates strategy. T-2 wires the lazy-expression
mechanism in Notes/Roadmap/Analytics so the wedding template's notes,
roadmap, and analytics slices stop being hand-built demo pages.

## Cycle 39 · 2026-05-11 · Wedding workspace becomes a template

The wedding/events wedge now has a real Tasks starting point:
`wedding-planning-workspace`. It carries 18 tasks across venue
decisions, supplier timings, guest numbers, catering notes, final-week
walkthrough work, open decisions, and the one-page update that can feed
the Roadmap share path.

The template has its own long-form SEO/landing essay, and the
`/for/weddings` page now treats the full workspace as the primary CTA
instead of asking couples or planners to begin with only the 3-month
countdown or day-of checklist. Those checklists remain useful, but the
workspace is now the wedge asset.

This closes the first blank-workspace gap in the collaboration growth
loop: a venue, planner, or couple can start with a useful planning
workspace before heavier Notes, Roadmap, Analytics, invite, or source
tracking infrastructure is finished.

## Cycle 38 · 2026-05-07 · Roadmap pills join the design system

The pre-launch design review parked one item: the /roadmap pill
colors were ~14 raw hex strings inlined into roadmap-view.tsx.
Press in rose, paid in amber, launch in violet, kpi in emerald,
P0 priority in stronger red, the unresolved-blocker chip — every
one of them a literal hex string that would silently drift if the
brand palette ever shifted. This cycle pulled them into the
design system.

Eight new tokens in globals.css — `--roadmap-rose-*`,
`--roadmap-amber-*`, `--roadmap-violet-*`, `--roadmap-emerald-*`,
plus a stronger `--roadmap-red-*` family for P0-class signals
that need more weight than the launch-beat rose. Values mirror
Tailwind 50/700 (and 100/800 for the red-bg) so the eye-feel
stays identical to what the surface looked like before. The
roadmap-view.tsx KIND_META, BLOCKER_KIND_META, PRIORITY_META, the
unresolved-blocker card, the inline launch-blocked chip, and the
P0-stats counter all reference tokens now.

The reason this matters: the roadmap is the operator surface. If
a brand pass ever shifts the palette — and given Tasks ships in
cycles, brand-tightening is on the table — the change cost was
14 edits across a 2,300-line file. After this cycle it's a one-
edit pass on globals.css.

## Cycle 37 · 2026-05-07 · A favicon that earns its tab

Tasks shipped with the create-next-app default favicon for too
long. The launch-readiness action item AI-brand-favicon (P1) had
been parked since week one. This cycle closes it.

`src/app/icon.tsx` is the 32×32 browser-tab icon — compact `t` on
a brand-soft tile with the indigo-600 dot bottom-right. Reads at
16×16 because the mark is just a glyph and a dot, not the full
wordmark. `src/app/apple-icon.tsx` is the 180×180 Apple touch
icon for iOS home screens, macOS Safari pinned tabs, and so on —
the full `tasks·` wordmark at 96pt on the same brand-soft tile,
36px rounded corners, no transparency (Apple draws a tile under
transparent icons that would clash with the brand-soft).

Both rendered via Next's ImageResponse so the brand source-of-
truth — indigo-600, brand-soft, the wordmark spec from
docs/brand.md — stays in one place. The legacy favicon.ico stays
in /src/app/ as the fallback for browsers that GET /favicon.ico
directly; icon.tsx wins for everything else.

## Cycle 36 · 2026-05-07 · One body, one rhythm

The design audit ranked it a should-fix and we treated it that way:
marketing body type sizes were drifting 15.5 → 18.5px across pages
with no rhythm reason. Pages would feel almost-right next to each
other without anyone being able to name why. The fix is one of the
quietest refactors in the cycle — nine files, nine size changes, a
consistent typographic system across every public route.

The rhythm is now: **16.5px body anchor, 17px lead paragraphs and
hero subtitles, 18.5px reserved exclusively for the /about and
/principles manifesto opens.** That third tier stays load-bearing
because the manifesto pages are doing something different — they're
declaration documents, and the type carries the gravity.

What moved off 18.5: every vertical landing page open
(/for/weddings, /for/students, /for/trades, /for/freelancers) drops
to 17. They're audience-specific opens, not manifestos, and the
17 reads cleaner against the body. The hero on the home page had
a 17.5 anomaly that was always going to bite an Awwwards judge —
it now sits at 17, matching the verticals exactly.

What moved off 16: the cta block, the templates-gallery intro, the
template-detail body all bumped 16 → 16.5. The half-pixel sounds
fussy until you switch tabs between /pricing (16.5) and /templates
(was 16) — the eye picks it up and nothing reads quite right.

What stayed: the 18.5 manifesto opens on /about and /principles,
and the 18px font-medium kicker copy that lives inside the card-
style closing boxes. Both are different roles operating at
different scales; neither is body.

The hand-of-the-designer is supposed to read consistent across
every public route. After this cycle, it does.

## Cycle 35 · 2026-05-07 · Templates earn the rule

brand.md says "no emoji anywhere," and for cycles the templates
surface had been quietly defying it. Twelve emoji icons across the
template gallery, the detail pages, and the OG card generator —
every one of them rendered to the user, every one of them a small
brand violation we'd been politely ignoring because the alternative
was a refactor.

The alternative was a refactor. We did the refactor.

`src/components/marketing/template-glyph.tsx` lives now. Eleven
stroke-SVG glyphs, one shared map, two exports — a `TemplateGlyph`
component for DOM rendering and a `templateGlyphForOg` function that
hands raw JSX to the `next/og` `ImageResponse` generator (which is
picky about React component shapes). Every template icon is now a
slug — `ring`, `briefcase`, `document`, `book`, `receipt`, `clock`,
`plane`, `target`, `box`, `wrench` — and the gallery, detail, and OG
routes all consume the same registry. Adding a new glyph means
extending one map. Adding a new template means picking from the
existing slugs.

The thirteenth template arrived in the same cycle. /for/trades had
been sharing freelancer templates because nothing trades-native had
been written; the PM review caught it and named the shape — a
jobsite punchlist. So we wrote one. Ten tasks shaped around the
end-of-job walkthrough: callbacks from the homeowner, touch-up
paint, caulk gaps, outlet covers, door swings, final cleanup,
inspection scheduled with the AHJ, final invoice, warranty docs.
The voice in the long-form essay is GC's-notes, not SaaS-product —
plainspoken about the difference between a punchlist item and a
change order, about why the walkthrough has to happen with the
homeowner present, about why the work isn't finished when the tools
are in the truck.

/for/trades replaces the tax-season card with the new template.
The page now hits the two endpoints of a trades engagement — start
clean, close clean — and reads less like a copied page and more
like a built-for-trades page, which is what the audit asked for.

## Cycle 34 · 2026-05-07 · Sell the things we already shipped

The PM review caught three sleeper features the marketing surface
was systematically under-selling. None of them required new
product. All three became copy lifts.

The ICS calendar feed has shipped for cycles. The wedding planner
who magic-links her photographer can also have him subscribe in
Apple Calendar; the freelancer who opens a workspace per client can
have each client's deadlines flow into Google Calendar. None of
that was on the marketing surface. /pricing now names it on the Pro
tier. /for/weddings names it in the "lives on every phone" reason —
the photographer, the DJ, the day-of coordinator each get the
timeline in the calendar app they already check.

/changelog tells its own engineering story now. One paragraph below
the heading explains what this page actually IS — a request-time
render of CHANGELOG.md from the repo, no CMS, no build step, the
cycle lands in git and lands here on the next request. The HN
audience rewards transparency about how things are made; we never
asked them to.

/principles refusal #5 (no real-time push) addresses the Inbox tab
inside the app. Someone who screenshots the Inbox tab and asks "you
have an inbox tab — that's push" creates a credibility gap; one
sentence resolves it. The Inbox is a pull surface. You visit it. It
doesn't reach for you. Same refusal, sharper edges.

## Cycle 33 · 2026-05-07 · Same surface, fewer seams

A cross-discipline design review caught three places where the
surface was visibly drifting from itself. The roadmap header was a
freestanding hand-rolled wordmark, /pricing said "Open the
workspace" but the nav said "Open the demo," and the published
workspace pages were renting their description copy from a
metadata builder.

The roadmap header now uses the canonical `<Wordmark>` component,
routes back to / via Next Link, unifies its container max-width to
1240px to match the marketing surface, and gains an eyebrow line
above the headline — "8-week go-to-market plan, not the product
backlog" — so a first-time visitor never misreads /roadmap as 144
unfinished product features. The roadmap is a credibility
multiplier when its subject is legible at a glance.

The CTA copy unified on "Open the workspace" everywhere — nav,
hero, pricing free tier. "Demo" implied not-real; "live workspace"
was wordier than the rest of the surface. Pricing already used the
canonical phrase; we propagated.

Stripe webhook idempotency race fix landed. `grantEntitlement` is
now idempotent on the `notes` field — if a row with the same notes
value already exists, the call is a no-op. The webhook handler
reorders: pre-check via SELECT, do the grant, THEN record dedup at
the end. A crash mid-handler leaves no dedup record, so Stripe's
retry re-runs the grant — and the grant skips silently because the
entitlement already lives in the table. The customer-paid-but-not-
entitled path is closed.

/p/[slug] description rewrite. Was machine copy: "A published Tasks
workspace · 144 tasks · Wedding." Now reads as a human sentence —
the workspace name, what it is, the brand shape ("same items, four
lenses: board, list, timeline, calendar.") A press visitor landing
on a published workspace from a magic link gets human copy as their
first impression instead of a metadata builder's output.

## Cycle 32 · 2026-05-07 · Refusal list, but for our own copy

A cross-discipline review (design, code, value) produced a 23-item
punch list, and the most cutting finding wasn't anything visual or
architectural. It was that two lines on /pricing named features we
hadn't shipped. "Slack/Linear integration" on the Pro tier didn't
exist. "Printable PDF day-of binder" and "seating-chart/RSVP
imports" on the Wedding tier didn't exist. /for/freelancers said
Studio was "next-cycle roadmap" when Studio had already shipped.

The pitch is "we ship a refusal list." Lying about features on a
page that says "we ship a refusal list" is the worst possible
self-inflicted wound. Killed every false claim and replaced it with
the things we'd actually shipped — the ICS calendar feed (Apple,
Google, Outlook subscribe), AI nudges with the model name spelled
out, cross-workspace search and overdue triage, the magic-link
guest model, the wedding template pair, the public /p/[slug]
wedding theme. Per-tier features now match what's in production.

The brand-rule pass came in the same cycle. brand.md says "no
emoji anywhere." Killed every emoji on /for/students,
/for/freelancers, /for/weddings — eight occurrences across three
pages — and replaced them with consistent stroke-SVG glyphs in
brand-soft tiles, accent color matching each vertical (emerald,
teal, pink). /press lost its literal `ethan@<domain>` placeholder
and the `[NEEDS-REVIEW]` body text; the sole press contact is now
the gmail address until the domain lands.

The security cluster was the third half of the cycle. Seven
exploitable gaps closed by the same audit:

- `getActiveWorkspace` cookie validation. Two unrelated queries
  collapsed to a single AND-joined membership query — a hijacked
  cookie no longer honors a workspace the caller doesn't belong to.
- `updateTaskAction` and `removeTaskAction` constrain the WHERE to
  the active workspace. An auth'd user knowing any task id can no
  longer mutate cross-tenant rows.
- `mintCompCodeAction` split into a module-private helper (the .edu
  student flow uses it directly) and a public, admin-allowlisted
  action gated by `ADMIN_USER_IDS`. Self-grant of comp codes via
  the RSC channel is closed.
- `draftReplyAction` and `summarizeConversationAction` verify the
  task's workspace matches the active workspace before rendering
  the title and thread to the model. The AI channel is no longer a
  side door for cross-tenant reads.
- `weeklyDigestNarrationAction` and `getWeeklySnapshotAction` lose
  their caller-supplied `workspaceId` parameter. Trusted callers
  (cron route, inbox page) use `buildWeeklySnapshotFor` and
  `weeklyDigestNarrationFor` in the new server-only module
  `@/server/digest-narration`.
- `listShareLinksAction`, `revokeShareLinkAction`, and
  `listShareLinkAnalyticsAction` scope to active workspace. Cross-
  tenant share-token enumeration and revocation are closed.
- /api/cron/digest and /api/cron/weekly-digest fail closed when
  CRON_SECRET is unset on a production deploy. Dev runs still hit
  the routes without a secret.

The HN audience picks at things. Show HN is forty days out. The
fixes above mean an enthusiastic-and-technical HN reader can spend
an hour probing and find nothing exploitable. The refusal list
holds.

## Cycle 31 · 2026-05-07 · Sprint 10 — The other roadmap

The internal GTM tooling joined the product. Until this cycle the
8-week distribution plan lived in a single 1,400-line markdown file
that nobody but the founder could load without losing the thread —
which is fine when the work is theoretical, and a problem the moment
the work is 144 actual rows that need to be queued, drafted, dragged
toward `in_progress`, and eventually checked off without forgetting
which Tuesday the press email goes out.

The fix was to put the roadmap inside the app, behind auth, with the
same design bar as the published surfaces. The markdown stays
source-of-truth — the parser re-walks it on every page load, the sync
layer reconciles new rows in without trampling user-set status, and
the result is a 144-row interactive checklist with a sticky launch-day
countdown and a right-rail of "next 7 days." Alongside it: file
attachments on tasks (the obvious gap nobody had filled yet), and the
full Phase-1 GTM execution work — hero loop video on disk, published
wedding workspace seeded, press-draft openers verified, posts weeks
4–8 drafted, redirect bug closed.

### What the user sees

- **`/roadmap`** — the new top-level surface, gated to the workspace
  owner. Sticky header with progress ring, T-minus countdown to Show
  HN and Product Hunt, and the full eight-week stripe below. Each
  week is its own section with a thin progress hairline that fills as
  rows complete; each row has a three-state checkbox (pending →
  in_progress → completed → pending), a date pill, a channel pill,
  and a hover-revealed "add note" affordance for one-line annotations
  like "got 47 likes" or "slipped to Wednesday."
- **A right rail that earns its width** — Next 7 days as a
  click-to-cycle list, launch beats with their actual times (3:01am
  PT for Product Hunt, the kind of detail you don't want to look up
  twice), and a small footer card that says: "edit the markdown,
  refresh this page — new lines appear, status carries over." Which
  is true.
- **File attachments on tasks** — drag-and-drop anywhere over the
  attachments section in the detail panel, or hit the "Attach"
  button. 25 MB cap, multi-file picker, optimistic rows that show
  filename and size while uploading, image previews inline, popover
  confirm before delete. Bytes never round-trip the React tree —
  every download links to `/api/attachments/[id]` which streams from
  disk after re-checking the workspace.
- **The published wedding workspace at `/p/wedding-2026-public`** —
  the first real public-facing demo URL, seeded from the
  `wedding-3-month-countdown` template, OG card rendering, ready to
  be linked from the press emails when those go out next month. The
  seed script is idempotent so repeated dev-box runs don't duplicate
  rows.
- **Hero loop video on the landing** — the 30-second `HeroLoop30s.tsx`
  composition rendered to `public/hero-loop.30s.{mp4,webm}` and wired
  into the landing block. Autoplay, muted, loop. 768 KB at the size
  it actually plays, which is a lot less aesthetic damage than the
  full Lighthouse hit suggested it would be.
- **`/app/*` redirect fix** — Clerk now redirects unauthenticated
  visits to `/sign-in` instead of bouncing to a homepage that
  pretends nothing happened. One-line change to `auth.protect()` with
  an explicit `unauthenticatedUrl`, but it's the kind of boundary
  glitch that quietly tanks deploys until someone tries to share a
  link.
- **Press drafts cleared for sending** — six `[VERIFY OPENER]` flags
  in `docs/press-drafts.md` resolved by re-reading the journalists'
  recent pieces and keying each opener to a specific reference. The
  Sherwood masthead got verified the slow way. The file now has zero
  open flags, which means the only thing standing between "drafts" and
  "sent" is the user's morning of 06-08.
- **Posts weeks 4–8 drafted in full** — `docs/posts-week-4.md` through
  `docs/posts-week-8.md`, ~95 verbatim post bodies in the same voice
  pattern weeks 1–3 already locked in. No "[draft]" placeholders, no
  "TODO: rewrite this," nothing the user has to second-pass before
  pasting into X or Bluesky.
- **`docs/phase-plan.md`** — the framing document that classifies all
  144 roadmap rows into Auto / Stage / Blocked, with file-scope-disjoint
  parallel-dispatch buckets. The plan that turned an 8-week sprint
  into a few hours of code-and-content work plus a queue the founder
  can drain by hand without rebuilding context each time.

### What changed under the hood

- `roadmap_items` table added to `src/server/db/schema.ts` — one row
  per actionable line, deterministic primary key of shape
  `${kind}-w${week}-${date}-${slug}-${ord}`, with `status` /
  `completedAt` / `note` as the only user-mutable columns. `isLaunch`
  is derived from `**bold**` cells in the source markdown.
- `src/server/roadmap/parser.ts` — pipe-row walker that picks up §3
  asset checklist, §7 8-week content calendar, §9 14-day press Gantt,
  and the synthesized KPI Mondays. No remark dependency; the
  cell-splitter is 18 lines and handles header dividers, bold-strip,
  link-strip, and date normalization (`MM-DD` → `YYYY-MM-DD`) without
  pulling in unified.
- `src/server/roadmap/sync.ts` — idempotent reconcile against
  `roadmapItems`. Updates the shape fields on existing rows (channel,
  body, date), preserves `status` / `note` / `completedAt`, never
  deletes — the user might have notes on rows that disappeared from
  the markdown and we're not going to lose those silently.
- `attachments` table — `taskId` cascade on delete, `workspaceId`
  denormalized so the download route can authorize without joining
  through `tasks`, `storedPath` is server-relative under
  `<repo>/.data/uploads/...` (deliberately outside `public/` so the
  Next static handler never streams attachment bytes by accident).
- `/api/attachments/[id]` route streams bytes from disk after
  re-verifying the request's workspace membership. Filename is set
  via `Content-Disposition`; image rows pull through the same
  authenticated route for previews so there's exactly one path bytes
  can reach the client through.
- `src/components/app/detail-panel/attachments-section.tsx` — the
  drag-and-drop UI with optimistic pending rows, refresh-on-task-update
  via `task.updatedAt` cache key, popover-confirmed delete, mime
  category branching (image / pdf / doc / code / archive / other) for
  the file glyph.
- `src/proxy.ts` — `auth.protect({ unauthenticatedUrl: …/sign-in })`
  on the `/app/*` matcher. Three lines. The fix was always tiny;
  finding it required reading the Clerk middleware contract in the
  Next 16 docs, which the proxy boundary makes a different shape than
  pre-Next-16 middleware.
- `src/server/db/seed-published-wedding.ts` — bypasses the
  auth-gated `applyTemplateAction` / `publishWorkspaceAction` and
  writes through Drizzle directly so the script runs from any server
  context. Re-asserts `publishedAt` and `activeDomain` on every run,
  only seeds tasks when the workspace's task list is empty.

### Why it matters

Shipping the GTM tooling next to the product turns "external
execution work" into "another surface in the codebase." That means it
gets the same review bar — voice integrity, no emojis, sentence case,
em-dashes — and the same diff-able review pipeline as a marketing
page or an empty state. The 144-row reconcile path is the most
aggressive test of the architecture so far, because it has to absorb
upstream churn (the markdown will get edited many more times before
06-26) without leaking that churn into the user's status state.

The roadmap surface itself is recognizable as a product. Markdown as
source-of-truth, Things-3-grade hairlines on the week progress bars,
the three-state cycle that everyone who has used Linear or Things
already knows by muscle memory, deterministic IDs so the URL of any
row is stable. The user already flagged it for either standalone
spinoff or Verizon GPO reuse — a roadmap-as-checklist surface tied to
a markdown source has obvious applications in places where the plan
lives in one document but the work happens across a dozen people. We
built it for the launch, but it would not be wasted to build on it
later.

### One small thing

The published wedding workspace's first task is "Send save-the-dates."
That's not the seed script picking the first row of the template
alphabetically — the template's first task is "Send save-the-dates"
because three months out, that's actually the first thing. The
roadmap's first rendered week is empty — the sticky-header today-rail
just reads "Quiet stretch. Use the lull." which is also true at the
moment, and won't be by Monday.

## Cycle 30 · 2026-05-06 · Sprint 9 — Google bridges at the boundary

The Google-integration question came up early in the strategy review
and got a clear answer: not yet, and maybe not ever in the deep-OAuth
sense. The thesis is that Tasks is the workspace, not a satellite of
someone else's. What the bridges do is meet people where they already
work — paste, embed, subscribe — without negotiating a single permission
prompt.

### What the user sees

Three new capabilities, all clustered around a single new affordance
in the app header (next to Share):

- **Copy as Sheet (CSV)** — one click puts an RFC 4180–shaped CSV on
  the clipboard. Columns: Title · Lane · Priority · Due · Tags ·
  Cents · Contact name · Contact email. Paste into Sheets, Excel,
  Numbers, Airtable. The shape was chosen for round-trip
  comprehension, not feature parity — anyone reading the file gets it
  in five seconds.
- **Copy as Markdown** — same data, lane-grouped with `[ ]` / `[x]`
  checkboxes and italic meta in parens (priority · due · tags). Drop
  it into Notion, Linear, GitHub issues, Slack canvas, a Google Doc,
  a status email. The mental model: "the workspace as a memo."
- **Subscribe in Calendar** — surfaces the `webcal://` URL that the
  iCal feed has been quietly serving since cycle 14. One click writes
  the URL to the clipboard and points users at the
  Calendar.app / Google Calendar / Outlook subscribe flow.

The fourth bridge is a how-to page rather than a button:

- **`/embed/guide`** — written-out instructions for dropping a
  published workspace into Google Sites, Notion, Substack, Ghost,
  Webflow, Framer, Squarespace, and Google Docs. Two patterns: the
  raw-iframe (universal) and the script-tag auto-discovery (for
  repeating embeds across a site). Per-tool quirk notes — Google
  Sites strips the `loading` attribute, Notion's `/embed` block takes
  the URL directly, Google Docs renders as an OG smart-chip and the
  Markdown export is the better path. Included in the sitemap.

### Why this shape

OAuth integrations are expensive in three directions: build cost,
permission anxiety for users, and platform risk (the integration
breaks every time Google reshuffles a scope). The bridges
side-step all three. CSV and Markdown are eternal — they have no
auth, no API quota, no breaking-changes calendar. Calendar
subscription is solved by the iCal RFC. Embeds are solved by the
iframe element. We meet the user where they are, then they bring
the workspace with them.

The voice constraint stayed honest: no emoji, sentence case,
restraint. The eyebrow on `/embed/guide` reads "Drop a workspace
into anywhere that takes HTML." The closing card reads "Publish
your workspace. Paste the URL. The destination renders it. Done."
That's the whole thesis in four sentences.

### Implementation notes

- `useActiveWorkspace()` hook joins the existing `DomainProvider`
  context — same shape, just exposing `{ id, slug }` alongside
  the domain pack. The app layout fetches the slug once at the
  server boundary and hands it down; client components read it
  with a single hook call. Returns `null` outside the app shell,
  which lets ExportMenu render conditionally without a try/catch.
- Pure formatters live in `lib/exports.ts` — `formatTasksAsCsv`
  and `formatTasksAsMarkdown` take the same `Task[]` the app
  renders and return a string. No DOM, no clipboard, no
  workspace lookup; the menu component owns those concerns. Easy
  to test, easy to repurpose later if we want to surface them in
  the API.
- The clipboard write uses `navigator.clipboard.writeText` with
  an `execCommand("copy")` fallback for older Safari and the
  iOS WebView.

### What's next

Sprint 9 was the last sprint in the Phase-8-through-14 plan that
needed to ship before deploy. The next move is hosting — the
plan is to push to Vercel free tier today, wire the Clerk test
keys as env vars, and have a public URL by end of day so the
project stops being localhost-only.

## Cycle 29 · 2026-05-06 · Design system locked in — wordmark spec, trades audience, copy revamp

Pulled the design-system handoff bundle (zip) from the user — README,
`tasks-design-system.html` in full, `tokens.css`, six reference
screenshots. README rule: *"recreate them pixel-perfectly in whatever
technology makes sense. Match the visual output; don't copy the
prototype's internal structure unless it happens to fit."* Followed
that rule across three concrete deliverables this cycle.

### 1 · Wordmark animation aligned to spec

The DS spec calls out: 2.6s pulse cycle on `spring-glide` easing, with
a punchy beat at 70%–80% (scale 1.0 → 1.25 → 1.0) and a single emit
ring fading in at 68% then scaling out to 2.6×. The v0.2 wordmark
used a slower 3.4s pulse with a softer scale-down (1.0 → 0.84) and
two perpetually-staggered wave rings.

Rewrote `.tasks-dot` in `globals.css` to match the spec timing
exactly. Renamed the keyframes (`tasks-dot-pulse`, `tasks-dot-emit`)
so future cycles don't accidentally collide with the v0.2
`dot-pulse` / `dot-wave` (which other components might still
reference). Added `letter-spacing: -0.05em` on the wordmark itself
to match the −5% tracking spec.

### 2 · Trades — fifth audience pack

The original four ICPs (marketing / student / freelance / wedding)
had a clear gap: the *manifesto's* audience said "anyone with a
list," but the four packs all assumed knowledge-work. **Trades** —
electricians, carpenters, plumbers, contractors, anyone whose work
is dispatched as a list of calls and finished with a signature —
fits the manifesto tighter than freelance does in many cases.

What landed:

- **`DomainId` extended** to include `"trades"`. The discriminated-
  union approach surfaced every callsite that needed updating; tsc
  caught one (`DOMAIN_TO_TEMPLATE` in `published-footer.tsx`),
  pointed trades to `new-client-onboarding` (same shape — kickoff,
  contract, payment terms, first invoice).
- **Trades domain pack** in `lib/domains.ts` — 16 seed tasks
  spanning service calls (replace breaker · 142 Maple), quotes
  (Hartwell panel upgrade), materials (200A main breakers),
  permits, invoices, crew syncs, fleet (truck inspection +
  insurance certificate). Voice tuned for the audience: route
  language, address-by-number specificity, "ladder back in the
  truck."
- **Trades published theme** — `trades-theme.tsx`. Job-ticket
  binder aesthetic: faint cyan graph-paper background on warm
  vellum (#fbfaf3); steel-ink (#0f172a) type; bracketed lane
  callouts (`[QUEUED]`, `[ON SITE]`, `[FINAL WALK]`, `[CLOSED]`);
  6px safety-orange (#f97316) left-stripe on cards in the active
  lane; mono four-up spec-field grid; signature-line "— end of
  ticket" footer.
- **`/for/trades` vertical landing** — fifth ICP landing,
  safety-orange to complete the rose-pink / teal / amber / orange
  system. H1: *"Calls, jobs, invoices — one binder."* Anchors on
  `new-client-onboarding` + `tax-season` (both already trades-
  applicable). Sitemap and footer Resources column updated.
- **Existing `DOMAIN_ORDER` consumers all flow through** without
  modification — settings starter-pack picker, welcome picker,
  about-page DomainGrid, empty-state seed-pack pills, domain
  toggle on the home cinematic demo. They iterate over
  `DOMAIN_ORDER` rather than hardcoding four packs, so trades just
  appears as the fifth option.

### 3 · Copy revamp — sharpening the manifesto voice

Audited high-traffic surfaces against the design system's voice
rules: *"Lightly knowing, never cute. Restrained, confident,
tactile. Sentence case. Em-dashes welcome. No emoji."*

Two real edits:

- **Hero subhead.** Was: *"A live task workspace built for momentum.
  Real-time presence, four synchronized views, plain-English dates
  — all stitched together by motion that feels alive."* Now:
  *"Project management for the 80% who don't work in tech. Four
  views of the same list, real-time when it matters, plain-English
  dates — no sprints, no epics, no learning curve."* The new
  version cites the manifesto positioning directly + names what
  the product *isn't* (sprints, epics) — drier, sharper, more
  Tasks.
- **List view empty state.** Was: *"Capture it once, check it off
  later. The dopamine hit is real."* The "dopamine hit is real"
  was a hair too cute for the *"never cute"* rule. Now: *"Write it
  down once. Check it off when it's done. That's the whole
  product."* Calls back to the about page's *"Write down what you
  have to do. Look at it the way that helps. Cross it off. That's
  the whole product."* — the pattern repeats across surfaces.

The other empty states (board / calendar / timeline / my-tasks)
read manifesto-correct already; left untouched.

### Verified

- `npx tsc --noEmit` clean across the merged tree.
- 12 surfaces probed: `/`, `/about`, `/principles`, `/pricing`,
  `/templates`, `/for/{trades, weddings, freelancers, students}`,
  `/p/legacy`, `/app/board`, `/app/list` — all 200, 0 console
  errors.
- Trades published theme verified by SQL-swapping `active_domain`
  to `trades` and snapshotting `/p/legacy` — graph-paper background
  rendered, `[QUEUED]` lane label visible, safety-orange top rule
  + active-lane stripe, job-ticket card layout. Restored
  `active_domain = student` after.
- `/for/trades` rendered with safety-orange eyebrow + the
  *"Calls, jobs, invoices — one binder"* H1 + the highlight-band
  underline on *"one binder."* Both template anchor cards visible.
- Wordmark dot animation now matches spec: 2.6s cycle, sharp beat
  at 70%, single emit ring scaling out to 2.6×.



## Cycle 28 · 2026-05-06 · Design system v0.3 — tokens.css aligned

Pulled the canonical design system from the design tool and reconciled
it with the v0.2 tokens already in `src/app/globals.css`. The strategy
was strict additive: keep every existing token (so 215 source files
don't regress), add the full design-system surface alongside, and
alias the v0.2 names to the new ramp positions where they line up.

### What landed in `globals.css`

- **Indigo ramp** — full 9 stops (`--indigo-50` through `--indigo-900`)
  + `--highlight: #7c5cff` for the marker underline accent on display
  headlines.
- **Ink ramp (neutrals)** — 12 stops (`--ink-0` through `--ink-950`)
  for the new ramp-aware code; the v0.2 names (`--ink`, `--ink-soft`,
  `--ink-quiet`, `--ink-faint`) now alias to ramp stops so existing
  callsites keep working.
- **Audience accent tokens** — `--aud-marketing`, `--aud-freelance`,
  `--aud-student`, `--aud-wedding`. The four published-workspace
  themes from cycle 20 already shipped with bespoke palettes more
  nuanced than these single-hex placeholders; these tokens are
  available going forward when surfaces want a 1-color accent (e.g.,
  category chips, ICP eyebrow pills).
- **Status tokens** — `--status-todo`, `--status-progress`,
  `--status-review`, `--status-done`, `--status-blocked`. Distinct
  from the lane visual tokens (which keep their soft pastel chrome
  for board surfaces); status tokens are for the single-color signals
  (Done DopamineCheck, blocked badge, error states).
- **Springs** — `--spring-snap` (overshoot, for drops + lifts),
  `--spring-soft` (settle, for cards + panels), `--spring-glide`
  (ride, for sweeps + fades), `--ease-out` (default). The v0.2
  `--ease-out-expo` / `--ease-spring` / `--ease-cinema` names alias
  to these so existing motion code is unbroken.
- **Radii** — `--r-1: 4px` through `--r-5: 20px` + `--r-pill: 999px`.
- **Shadow tier** — `--shadow-1` (subtle), `--shadow-2` (mid),
  `--shadow-3` (deep), `--shadow-indigo` (brand-tinted glow). The
  v0.2 `--shadow-sm` / `--shadow-card` / `--shadow-lift` /
  `--shadow-float` alias to the new tier.
- **`.marker` utility** — recreates the design system's
  marker-underline accent on display headlines (a 78%-tall
  highlight-color band behind the highlighted span; not a literal
  text-decoration). Available as `<span className="marker">word</span>`
  inside any heading.
- **`.live-dot` utility** — the green pulsing dot used for "this is
  live right now" status indicators (matches the design system's
  `.hero-meta .pill::before` and `.mark-stage::after` pattern).
- **Tailwind theme bindings** — the new tokens are exposed as
  Tailwind utility classes via `@theme inline` so future code can
  reach for `bg-indigo-600`, `text-ink-900`, `text-status-done`,
  `shadow-3`, `rounded-r-pill`, etc.

### Integration trap caught

The design system's `tokens.css` ends with `a { color: inherit; }`,
which works fine on the standalone design-spec HTML page. But in the
Tasks app's Tailwind setup, that rule is **unlayered**, which puts it
*after* `@layer utilities` in the cascade. Adding it shadowed
`.text-white` on the dark CTA buttons — *"Open the demo,"* *"Open the
live workspace,"* and similar — turning them into solid black
rectangles with invisible text.

Caught at integration via Playwright snapshot: button background
rendered correctly (`bg-ink`) but `getComputedStyle().color` returned
`rgb(24, 24, 27)` despite the `text-white` class being present. The
generated `.text-white { color: var(--color-white); }` rule existed
and `--color-white` resolved to `#fff`, but the unlayered `a { color:
inherit; }` was winning the cascade.

Fix: removed the `a { color: inherit }` rule. Link colors are set
per-callsite via Tailwind utilities (the existing pattern). Added an
in-file comment explaining the trap so future cycles don't re-add it.

### Verified

- `npx tsc --noEmit` clean.
- 11 surfaces probed (all marketing + app views + published workspace
  + template detail) — all 200, 0 console errors.
- Home-page hero rendered with marker-underline visible on
  *"forward."*, both CTA buttons (*"Open the demo"*, *"Open the live
  workspace"*) showing their white text correctly, the wordmark dot
  pulsing as expected.

### What's next

Cycle 29 is Sprint 9 — Google bridges (export-side: Copy as Sheet
CSV, Copy as Markdown, surface iCal subscribe URL more prominently,
"Embed in Google Docs/Sites" how-to page).



## Cycle 26-27 · 2026-05-06 · Full review pass — website + code

Two review cycles, no agents. Architect-only walks across every
public surface and every source file. Five real bugs caught and
fixed mid-review. Two report files written.

### Cycle 26 · website review

41 surfaces probed. Bugs:

1. **Per-template OG URLs were malformed for all 12 templates.**
   `generateImageMetadata` returning 12 entries on a dynamic-segment
   route multiplied the path; every template's `og:image` ended in
   `/opengraph-image/job-application-sprint?…` (the *last* template
   id, the same on every page). Slack/Twitter unfurls have been
   silently broken since cycle 18. Removed `generateImageMetadata` —
   dynamic routes already get one OG per slug from
   `generateStaticParams`. Fix verified; OG URLs are now correctly
   `/templates/{slug}/opengraph-image?{hash}`.

2. **Three OG routes used sync `params: { … }`.** Next.js 16's
   strict-error fired at runtime
   (*"params is a Promise and must be unwrapped"*). Fixed
   `templates/[slug]/opengraph-image.tsx`,
   `p/[slug]/opengraph-image.tsx`, and
   `share-card/[workspaceId]/opengraph-image.tsx` to the
   `Promise<{ … }>` + `await params` shape. The cycle-22 check that
   verified the share-card returned 200 didn't catch the deprecated
   sync pattern; this review did.

3. **Five marketing pages had no `og:image` at all.** `/principles`,
   `/templates` (gallery), `/for/weddings`, `/for/freelancers`,
   `/for/students` defined `metadata.openGraph = { title, description,
   type }` but no `images` and no colocated `opengraph-image.tsx`.
   Next.js doesn't auto-fall-back to root OG when a page sets its own
   `openGraph`. Added `images: ["/opengraph-image"]` to each.

4. **`/about` leaked a `💅` emoji from the wedding domain pack.** The
   wedding domain's `description` in `src/lib/domains.ts` was *"venues
   · vendors · 💅 · run-of-show"*, and `/about` renders the four-pack
   `DomainGrid` verbatim. Replaced `💅` with `vows`. Now consistent
   with the other three packs (all middle-dot-separated word lists).

Environmental note: edge-runtime + Turbopack-dev + ImageResponse
intermittently fails with *"failed to pipe response"* in the dev
environment. Conversion of the templates and root OG to nodejs
runtime (matching cycle-22 + cycle-20 patterns) addresses the most
common failure mode but doesn't eliminate it. Recommend prod-build
validation before launch — the dev-server state isn't conclusive.

Full review report: `docs/website-review.md`.

### Cycle 27 · code review

215 source files, 35,408 LOC, 0 tsc errors. One bug:

5. **`💬` emoji on board card comment count.** In
   `board-app.tsx:702`, the comment count chip rendered as
   *`💬 {count}`*. A single character but a brand-voice violation
   on a surface every active user sees. Replaced with an inline
   11×11 SVG comment-bubble icon.

Audits clean across the board:

- **0** `any` / `as any` / `@ts-ignore` / `@ts-expect-error` /
  `TODO` / `FIXME` in source.
- **0** sync `params: { … }` patterns left.
- **0** `dangerouslySetInnerHTML` in `src/`.
- **0** raw SQL string concatenation — every query uses Drizzle's
  parametrized template tags.
- **12** owner-gated server actions, all verifying role server-side
  before any side-effect work.
- **17** server-only files import `"server-only"`; the one exception
  (`schema.ts`) is correct.
- **All 16** server-action files start with `"use server"`.
- **All 12** dynamic-route handlers use `params: Promise<…>`.
- **32** `console.log/warn/error` calls — all in catch blocks, all
  "log and continue" patterns. Acceptable.
- **14** `eslint-disable` directives — all justified, all paired
  with explanatory comments.

Compile-time schema-vs-client-type contracts hold across `tasks`,
`comments`, `notifications`, `activities`, `compCodes`,
`entitlements`. Schema drift would surface as a tsc error, not a
runtime surprise. Excellent discipline.

Full code review: `docs/code-review.md`.

### Verdict

Production-ready. The four post-sprint backlog items that remain
(Postgres dialect, Sentry source-maps, SSE multi-tab, Lighthouse
pass) all need real-world validation rather than dev-environment
proof. Everything in the dev tree compiles, type-checks, and
behaves the way it claims to. Run `next build && next start` once
before flipping the public DNS — that's the only validation gate
the dev environment can't conclusively pass on its own.



## Cycle 25 · 2026-05-06 · Hardening — webhook idempotency, real invites, subtasks, recurring chip, timeline drag

The hardening cycle. Five backlog items the previous sprint
deliberately punted on (because each was reliability-or-depth work,
not category-defining), now landed in one cycle. Three parallel
agents (subtasks, recurring chip, timeline drag) shipped on their
own file scopes; architect handled the two infrastructural items
(webhook dedup, real invite flow) plus a small `escapeHtml` clash
caught at integration.

### What landed

**Webhook idempotency (architect)**

New `processed_webhooks` table — `event_id` PRIMARY KEY +
`event_type` for the audit log + `processed_at` timestamp. Stripe
re-delivers failed events every 30s for up to 3 days; without
dedup, a re-delivered `checkout.session.completed` would grant a
second entitlement row. The route now `INSERT OR IGNORE`s the event
id at the top of every request — on duplicate, the handler returns
200 + `{ deduped: true }` immediately and Stripe stops retrying.

The check happens before any side-effect work. Stripe's exponential
backoff means a flaky-but-eventually-successful handler still gets
its retry window without re-running successful side effects.

**Real Clerk-backed invite flow (architect)**

`pendingInvites` table + the cycle-17 stub upgraded into the real
flow. `inviteMemberByEmailAction` now mints a 32-char URL-safe
token, INSERTs the pending invite, and sends an HTML email via the
existing Resend integration. Invite reuse: if a pending invite for
the same workspace+email already exists (and isn't expired or
accepted), we re-send the existing token's email rather than
minting a fresh one — the recipient never gets two competing
links.

New `acceptInviteAction(token)` — validates the token isn't
expired or already accepted, checks the user's email matches the
invite's email (case-insensitive), re-checks the member cap at
accept-time (could've changed if the workspace downgraded between
mint + accept), inserts the `workspace_members` row via `INSERT
OR IGNORE`, marks the invite accepted (audit trail), and flips the
`tasks_active_ws` cookie to the joined workspace.

New `/invite/[token]` page — server-renders the invite context
(workspace name, inviter name, recipient email, expiry), shows the
right state for missing / expired / already-accepted tokens, and
gates the accept button on Clerk auth + email match. If the user
isn't signed in, sends them through `/sign-in?redirect_url=...`
back to the invite page. If they're signed in with the wrong
email, says so plainly with a sign-out hint.

New invite email template in `email.ts` — terse, manifesto-voiced
(*"One workspace, every view, the daily digest. Three editing
guests on Free, unlimited members on Team. No card, no trial."*).

**Subtasks (parallel agent)**

`tasks.parent_task_id` (nullable) added to schema. Top-level views
(board / list / timeline / calendar) filter to `parent_task_id IS
NULL` so subtasks live exclusively under their parent in the
detail panel. New `<SubtasksSection>` mounted between the Cents
section and the Conversation feed: header `"SUBTASKS · N of M
done"`, lane-checkbox toggles between `todo` and `done`, click-
title opens the subtask in the same panel (browser back returns
to parent), inline ghost-row composer at the bottom for new
subtasks. Done subtasks render with strikethrough + 60% opacity.

Schema migration via `drizzle-kit push --force`. v1 is intentionally
one level of nesting — no sub-subtasks. Future cycle decides
whether to surface a subtask-count indicator on the parent's card.

**Recurring tasks card UI (parallel agent)**

Tiny `<RecurrenceChip>` reusable component. Renders `↻ daily` /
`↻ weekly` / `↻ monthly` for unit recurrences, `↻ Nd` / `↻ Nw` /
`↻ Nm` when interval > 1. Mounted in the board card meta row + the
list row. Tooltip on hover gives the long form (*"Repeats every 2
weeks"*). Pure presentational — recurrence already lived in the
data model + detail panel; this cycle just makes it visible at a
glance.

Not added to timeline / calendar / showcase in this cycle (out of
scope per the brief; future cycle if surface-need emerges).

**Timeline drag-and-drop reorder (parallel agent)**

The timeline view's bars were read-only before; now they support
two interactions:

1. **Whole-bar drag** (cursor: grab/grabbing) — drags horizontally
   to shift `startDay`. Pointer x → day-delta is rounded for
   whole-day snap; clamps `startDay >= 0` and
   `startDay + durationDays <= 30`.
2. **Right-edge resize** (cursor: ew-resize) — 8px invisible handle
   on the right. Drag to resize `durationDays`. Clamps
   `durationDays >= 1` and the same upper bound.

New `setTaskTimelineAction(taskId, { startDay?, durationDays? })`
in a NEW `src/server/actions/timeline-drag.ts` (kept separate from
`tasks.ts` to avoid collision with the subtasks agent who extended
that file). Server-side clamps to `[0, 30]` / `[1, 30]` with
integer rounding; only writes whichever fields were provided.

Optimistic-UI: dispatch local update via `useTasksDispatch()`,
then fire the server action in `startTransition`. Mobile (<768px)
disables the drag entirely (matches the cycle-14 board-on-mobile
policy). Translucent dashed overlay during the gesture marks the
destination cell. CSS transitions on `left`/`width` give the
release-snap a soft settle; transitions are disabled mid-drag for
instant feedback.

### Architect integration step

Mid-cycle, the subtasks agent flagged a duplicate-`escapeHtml`
warning in `email.ts`. The architect (when adding the invite-email
template) appended a fresh `escapeHtml` near the top, not realizing
one already lived at the bottom of the file. Removed the new
duplicate; left a one-line note where it was.

### Verified

- `npx tsc --noEmit` clean across the merged tree.
- `/invite/test-fake-token` returns 200 with the *"This invite
  link doesn't exist"* state (the page renders correctly even for
  invalid tokens — that's the whole point of server-rendering the
  preview).
- `/app/board`, `/app/timeline`, `/app/settings` all 200.
- Subtasks: schema migration applied, `parent_task_id` column
  present, top-level views correctly filter parented tasks out.
- Webhook idempotency: `processed_webhooks` schema applied; route
  short-circuits on duplicate `event.id`.

### Operational note

Three parallel agents (smaller batch than cycles 18-24) plus
substantial architect work in parallel. The pattern works smaller
just as well as larger — the constraint is file-scope discipline,
not agent count. The invite flow is the most architecturally novel
addition this cycle (new email template, new accept route, new
Clerk-gated client island).

**Sprint parallel-agent throughput so far:** **39 dispatched, 39
complete, 0 broken builds.**

### Subtractions

- The cycle-17 stub `inviteMemberByEmailAction` body. Replaced
  with the real flow (kept the cap-check at the top — that
  behavior carries forward).

### Backlog (still open after cycle 25)

- **Postgres dialect adapter** — needs a real prod DB to validate.
- **Sentry source-map upload on deploy** — deploy-time concern.
- **Multi-tab realtime SSE collisions** — needs prod traffic.
- **Production Lighthouse mobile pass** — needs `next build`.

These four are deliberately deferred until there's a production
deploy to validate against. The dev environment gives no signal
on any of them.

### Next: cycle 26 + 27

Per the user request: cycle 26 is a full website review (every
public surface), cycle 27 is a full code review. Both are
architect-only — no agents.



## Cycle 24 · 2026-05-06 · B-tier delight wave — eight features, sprint close

Phase 7, the last cycle of the category-defining sprint that began
with cycle 17. Eight atomic delight features in one cycle, dispatched
as 4-then-4 parallel-agent batches. All eight shipped voice-matched
on first attempt. One small ⌘K shortcut conflict caught at
integration was resolved by the architect (local palette rebound to
⌘P, the cross-app convention for "open file"; cross-workspace
search keeps ⌘K, the cross-app convention for global quick-switch).

### What landed

**Batch 1 (file-scope-disjoint, dispatched first):**

- **Cents column on tasks** — nullable `cents` integer column,
  type extensions through `Task` + `rowToTask` + `addTaskAction`,
  and a new `<CentsEditor>` in the detail panel between Contact
  and Conversation. Display formats `$1,234.56` via
  `Intl.NumberFormat`; input strips commas / `$` / whitespace
  before parsing. Server-side clamp to `[0, 99_999_999]`. Empty
  input is a no-op (mirrors the contact editor's *"a slip of the
  keyboard shouldn't blow away a $1,200 deposit"* discipline).
  Drizzle-pushed.
- **Cmd-K cross-workspace search** — server action +
  `<CrossWorkspaceSearch>` popover mounted at the app-shell level
  alongside the cycle-22 cross-workspace overdue popover. Single
  SQL query joining workspace memberships → workspaces → tasks
  with `inArray` + `LIKE` on title (LIKE wildcards escaped),
  exact-prefix-first sort, capped at 30 results. 180ms debounce,
  sequence-numbered race guard, ⌘K to toggle (works even from
  inside other inputs — Linear/VSCode behavior). Click a result →
  flips the active-workspace cookie and routes to
  `/app/board?task={id}`.
- **iCal subscribe URL** — `/api/calendar/[workspaceId]` returns a
  proper RFC 5545 ICS feed (`text/calendar; charset=utf-8`) with
  CRLF line endings, line folding, escape rules. Pure-TS helper
  in `src/lib/ical.ts`, no dependencies. All-day branch when
  `dueAt` is at midnight UTC; timed branch with 1-hour DTEND
  otherwise. Subscribe button + popover on the Calendar view
  shows the `webcal://...` URL with a Copy button. Cache headers
  set for the 15–60-minute calendar-client refresh cadence.
- **Focus Mode** — full-screen overlay client component, mounted
  globally. Press `f` while focused on a board task → opens with
  that task's title and a 25-min countdown. `space` pauses,
  `esc` closes. 0:00 doesn't ring a bell — manifesto rule (no
  push notifications, no auto-celebrate). Reads which task is
  focused via `data-task-id` / `data-task-focused="true"`
  attributes added to the Card; falls back to a custom
  `focus-mode:open` window event from the detail panel's Focus
  button. Honors `prefers-reduced-motion`. White background, 144px
  tabular-nums timer, no blinking colon.

**Architect integration step (between batches):**

- ⌘K conflict resolved. The cycle-2-era local command palette
  bound ⌘K; the new cross-workspace search needed it too. Local
  palette rebound to ⌘P (the file-open convention from VSCode,
  Sublime, et al). Sidebar + page-header keyboard hints updated
  from `⌘K` to `⌘P` to match. Cross-workspace search keeps `⌘K`,
  the cross-app convention from Slack, Notion, Linear, GitHub.

**Batch 2 (file-scope-disjoint, dispatched after batch 1
integrated):**

- **Repeat-N-times one-tap** — new `duplicateTaskAction(taskId,
  count, dayStep)` in a NEW `src/server/actions/duplicate-task.ts`
  (kept separate from `tasks.ts` to avoid collision with the cents
  agent who extended it). Detail-panel "Repeat" button opens a
  popover with two number inputs (Count, Days apart) and a live
  helper line *"Will create N copies, last one Mar 12"*. Server
  clamps to `[1, 30]` count and `[1, 90]` dayStep. Inserts in a
  single transaction, formats `due` text per-copy, copies all
  pass-through fields (tags, assignees, contact, cents).
- **Drag-momentum on board** — release-velocity inertial follow-
  through. The board uses native HTML5 drag (cross-lane moves rely
  on `dataTransfer`, not motion's pan), so the agent built a
  pointer-sample buffer that records `{x, y, t}` per `onDrag`,
  computes velocity from the last 80ms window on drop, scales by
  60, clamps to ±100px per axis. The Card animates from that
  initial offset back to `{x: 0, y: 0}` via spring
  `{ stiffness: 250, damping: 28, mass: 0.9 }` — settles in ~350ms
  with a barely-perceptible overshoot. State-wise the card lands
  in exactly one lane; the momentum is purely visual.
  `prefers-reduced-motion` short-circuits to 120ms linear settle.
- **Roll-forward incomplete** — end-of-day "Roll forward N" button
  on the inbox daily-digest header. New
  `src/server/actions/roll-forward.ts`. Server-side overdue
  detection mirrors cycle-22's heuristic (structured `dueAt` <
  end-of-today, falling back to ISO `YYYY-MM-DD` text). Updates
  in a single transaction; advances `dueAt` by 1 day; re-formats
  the human `due` label ("Tomorrow", weekday short within 7 days,
  else ISO). Two-step confirm (mirrors the cycle-16 magic-link
  revoke). Hidden when overdue count is 0.
- **Copy Slack-summary button** — sibling to cycle-22's
  share-this-week PNG button, but copies *text* — a markdown-
  formatted weekly summary (`*This week in {workspace}*`, count
  headline, up to 12 task-title bullets, `+ N more closed`
  overflow row, trailing `Made with Tasks → tasks.app/p/{slug}`).
  Same hidden-textarea + execCommand fallback as the share-card
  button. Hidden when nothing closed this week.

### Verified

- `npx tsc --noEmit` clean across the merged tree (twice — once
  after batch 1, once after batch 2).
- `/app/inbox` renders all three buttons in the daily-digest
  header (share-card, copy-slack, roll-forward) when applicable;
  sidebar Search hint correctly shows `⌘P`. 0 console errors.
- `/app/calendar` shows the new "Subscribe" button top-right; 0
  console errors.
- `/api/calendar/ws-legacy` returns 200 + `text/calendar; charset=
  utf-8` with valid VCALENDAR / VEVENT structure.
- All 5 batch-2 features compile against the cents column added in
  batch 1 (the Repeat-N-times agent correctly forwards the new
  field to copies; no agent collisions despite shared schema).

### Operational note

8 agents in 2 batches of 4 ran cleanly. The biggest concurrent
dispatch ever was 5 (cycle 22); 8 was the test of *whether the
proven pattern scales further with smart batching*. It did, with
two caveats:

1. **Two agents touching the same shared file** (the cents agent +
   the focus-mode agent both extended the detail panel) need
   explicit non-overlapping section briefs. Worked here because
   each agent's brief named the precise location of their addition.
2. **A shared keyboard-shortcut surface** (the local palette's
   ⌘K + the new cross-workspace search's ⌘K) needed an architect
   resolution at integration. Future cycles touching keyboard
   shortcuts should audit existing bindings first; the brief should
   include the project's current shortcut map as context.

### Sprint close — 8 cycles, 8 phases, the category-defining sprint

This cycle closes the sprint that began with the strategic
planning report (cycle 17 prep) and the phased rollout (cycles
17-24). Final phase status:

| Phase | Cycle | What landed |
|---|---|---|
| 1 · Manifesto made real | 17 | `/principles`, 3-editor Free cap, pricing copy honesty |
| 2 wave 1 · Templates SEO | 18 | `/templates/[slug]` × 12, four flagship essays, `/for/weddings` |
| 2 wave 2 · Templates SEO finish | 19 | Eight more essays, `/for/freelancers`, `/for/students` |
| 3 · Publishable workspaces | 20 | `/p/{slug}` + four domain themes |
| 4 · Studio tier | 21 | $14.95/mo operator-tier, layered user-level entitlement |
| 5 · A-tier wave | 22 | iOS share-sheet, ⌘. overdue, share-card PNG, template remix, contact field |
| 6 · Distribution activation | 23 | `.edu` Pro auto-grant, embed widget, Show HN draft, venue drafts |
| 7 · B-tier wave (this cycle) | 24 | Cents, ⌘K search, iCal, Focus, Repeat-N, drag-momentum, roll-forward, Slack-summary |

**Sprint parallel-agent throughput:** **36 dispatched, 36
complete, 0 broken builds.**

What worked across the sprint:

- **File-scope discipline.** Every brief named the files the agent
  could touch and the files they couldn't. Zero file collisions
  across 36 dispatches.
- **In-file trap notes.** When a hard-won lesson was caught at
  integration (Turbopack's nodejs route handlers don't pipe
  ImageResponse cleanly; better-sqlite3 won't load under edge
  runtime), the architect documented the trap *in the file
  itself* so the next agent dispatched into that domain inherits
  the lesson without rediscovering it.
- **Batches of 4 in sequence.** Five agents simultaneously was the
  proven ceiling (cycle 22). Eight in two staggered batches of
  four was the new ceiling and held.
- **Per-cycle voice-match.** Every CHANGELOG entry, every essay,
  every UI copy line was voice-matched on first ship. The wedding
  essay (cycle 18) became the gold-standard reference; every
  agent in cycles 18-24 had it quoted in their brief.

### Subtractions

- The cycle-2-era ⌘K binding on the local command palette
  (rebound to ⌘P; the keystroke now belongs to cross-workspace
  search).

### Backlog (post-sprint, no scheduled cycle)

This is the end of the sprint. The product is in the strongest
shape it's been in. Items the sprint deliberately punted:

- **Postgres dialect adapter** (Phase D's deferred half from
  pre-sprint cycles).
- **Subtasks** (nesting in the conversation feed).
- **Recurring tasks UI affordance on cards** (currently detail-
  panel only).
- **Timeline drag-and-drop reorder** (resize bars, drag startDay).
- **Production Lighthouse mobile pass** (≥90 target).
- **Real Clerk-backed `inviteMemberByEmailAction`** (the stub from
  cycle 17 still inherits the cents-cycle cap; needs the real
  invite-token + Resend + accept-flow plumbing).
- **Multi-tab realtime SSE collisions** (long-standing).
- **Webhook idempotency** (`processed_webhooks` table for Stripe
  re-deliveries).
- **Sentry source-map upload on deploy.**

These are real but not category-defining. The next phase of the
product is *outbound* — Show HN draft is in `docs/show-hn.md`,
syndication playbook in `docs/syndication.md`, three Gmail venue
drafts saved (Villa, Moss Denver, Pocketbook Hudson), two more
templated for the user to populate. The product can carry itself
from here.



## Cycle 23 · 2026-05-06 · Distribution activation — .edu Pro, embed widget, Show HN, venue outreach

Phase 6 of the category-defining sprint. Less code than the prior
cycles, more posting and partnerships — by design. Most of this
cycle is writing and outreach: a Show HN draft, a syndication
playbook, five wedding-venue partnership emails. The two pieces of
real engineering — `.edu` Pro auto-grant and the embed widget —
landed clean.

**`.edu` Pro auto-grant (architect)**

The Clerk webhook on `user.created` now checks the user's primary
email. If it ends in `.edu`, we grant Pro for 120 days
(*"long enough to cover a single semester (~16 weeks) plus a buffer
for the post-semester wrap-up; shorter than a year so the student
renews intentionally"*). The entitlement is user-level
(`workspaceId = NULL`) so the Phase 4 layered-resolution path picks
it up across every workspace the student creates without per-
workspace bookkeeping.

The grant runs *outside* the user-creation transaction. A failure
here shouldn't roll back user creation — worst case the
entitlement is missed and the student redeems manually via
`/redeem`. Logged + continued, not thrown.

`/students` page copy updated. Was: *"Verify a .edu address."* Now:
*"Sign up with your .edu address and Pro lands automatically."* A
small green chip below the headline reads *"Auto-applied at signup
· 120-day Pro"*. The legacy redemption form stays for the rare
cases the auto-grant missed.

**Embed widget (parallel agent + architect hydration fix)**

A blogger or Notion user can drop a `<script src="tasks.app/embed.js">`
tag on their page; a compact read-only Tasks workspace appears
inline. Two pieces:

1. **`/embed/{slug}`** — a server-rendered iframeable route. Bare
   layout (no SiteNav, no SiteFooter, no app shell). Compact
   lane-grouped task list with a small chip header
   (`{name} · published {date}`), lanes capped at 6 tasks with
   *"+ N more"* overflow, and a tiny "Made with Tasks" link that
   opens `/p/{slug}` in a new tab.
2. **`/embed.js`** — Route Handler returning a 1.1 KB IIFE.
   Finds `[data-tasks-workspace]` elements on the host page and
   injects sandboxed iframes pointing at the embed route.
   Idempotent (skips if iframe already exists). Reads
   `data-tasks-width` / `data-tasks-height` overrides. Cached one
   hour on the browser, one day at the edge.

Hydration fix at integration: agent's first draft scoped the
embed layout's body styles to a `body.tasks-embed` selector + a
client-side script that added the class. Resulted in a hydration
mismatch warning (server body className didn't match the post-
hydration one). Architect re-scoped the styles to the
server-rendered `.tasks-embed-root` div instead, dropped the
inline script. Console clean afterward.

**Show HN post draft (architect)**

`docs/show-hn.md` ships the post body, three title alternates,
posting checklist, and a first-90-minutes comment plan covering
the predictable questions ("Won't per-workspace pricing lose
money on big teams?", "Why no Gantt?", "How is this different
from Notion?", "Will you build SSO?", "Where's the catch on
free?"). Each with one specific anecdote ready, not canned copy.
Time the post for Tuesday morning, 9–10am ET.

**CHANGELOG syndication playbook (architect)**

`docs/syndication.md` ships two templates — an HN-style post
("how we shipped 5 features in one cycle with parallel sub-
agents") and an IH-style post ("why we charge per workspace, not
per seat — and the math behind it"). Cadence: one channel per
cycle, alternating, Friday 9–10am ET. The angle is *"how we
ship,"* not *"what we shipped."* HN responds to operating notes;
IH responds to commercial honesty.

**Wedding venue partnership outreach (architect + Gmail MCP)**

One real Gmail draft saved via the MCP — to **The Villa**
(Virginia Beach, `info@thevillava.com`). One paragraph, one
specific personalized opener, one CTA: reply with how many bulk
codes the venue wants. *"If it's not, no follow-up — I won't
email again."* No automated send.

Four more drafts templated in `docs/venue-outreach.md` for **Lamb's
Hill** (Hudson Valley), **The Abbey Inn & Spa** (Hudson River
Valley), **Moss Denver** (Denver), and **Pocketbook Hudson**
(Hudson Valley) — each with a venue-specific opener line tied to
the venue's actual character. The user looks up each contact email
(most venues hide them behind contact forms) and either copies the
draft into Gmail directly or saves a fresh Gmail draft with the
right `to:` address. A tracking table is included for reply rates,
code-redemption rates, and couple-side conversion.

The cadence rule: no more than 5 venues per week. Personalized
openers matter. *"The line that names something specific about
their venue is the difference between a 5% reply rate and a 25%
reply rate."*

**Verified**

- `npx tsc --noEmit` clean across the merged tree.
- `/embed.js` returns 200 + `application/javascript; charset=utf-8`
  + the IIFE body. Cache headers correct.
- `/embed/legacy` returns 200, renders the compact lane-grouped
  task list, *"Made with Tasks"* link present. 0 console errors
  after the hydration fix.
- `/students` renders the new auto-grant chip below the headline.
- One Gmail draft saved (Villa, `info@thevillava.com`) — visible
  in the Gmail drafts list.
- `docs/show-hn.md`, `docs/syndication.md`, `docs/venue-outreach.md`
  all written.

**Sprint parallel-agent throughput:** 28 dispatched, 28 complete,
0 broken builds.

**Subtractions**

- The agent's first-draft hydration script in
  `src/app/embed/[slug]/layout.tsx` (replaced with a
  scoped-to-div pattern).

**Backlog (next — sprint Phase 7: B-tier delight wave)**

- Repeat-this-task-N-times one-tap (daily standups, 7-day
  countdowns)
- Focus Mode (one task full-screen + timer)
- Cents column for invoice / vendor totals
- Drag-momentum on the board (release-flick physics, lane snap)
- Cmd-K cross-workspace search
- Roll-forward incomplete (end-of-day one-click sweep)
- iCal subscribe URL per calendar view
- "Closed this week" auto-card / Slack drop, opt-in per workspace
- Eight features, parallel-agent dispatch.



## Cycle 22 · 2026-05-06 · A-tier wave — five features in one cycle, parallel-agent dispatch

Phase 5 of the category-defining sprint. Five ship-in-a-day features,
non-overlapping file scopes, all dispatched as parallel agents. The
operating loop's biggest stress test so far — five agents at once vs.
the proven four — and it held. All five shipped voice-matched on
first attempt. One small Turbopack edge case caught at integration
required an architect fix, documented below.

**Five surfaces, one cycle**

1. **iOS share-sheet capture (PWA share target)** — agent 1.
   `public/manifest.webmanifest` declares Tasks as a `share_target`
   (GET, `?title=…&url=…&text=…`). `/share-target` route receives the
   shared selection, opens a quick-add modal pre-filled with the
   title plus em-dashed URL. Save fires `addTaskAction` and routes
   to `/app/board?from=share`. Headline: *"Save what you saw."*
   Subhead names what got captured. Cmd/Ctrl+Enter and bare Enter
   both submit. Manifest also bootstraps the rest of PWA basics —
   name, theme color, start URL, standalone display — so adding to
   the home screen on iOS gets the right chrome.

2. **Cross-workspace overdue command (`⌘.`)** — agent 2.
   Global keyboard listener mounted at the app-shell level (next to
   `<TaskDetailPanel />` in `src/app/app/layout.tsx`), skipping
   when focus is inside an input/textarea/contenteditable so the
   existing `c` quick-create still owns its keystrokes. Toggles a
   440px top-right popover.
   `getOverdueAcrossWorkspacesAction` joins `workspace_members`
   against `workspaces`, pulls non-`done` tasks across all
   memberships in one query, applies the overdue heuristic in JS
   (prefer structured `tasks.dueAt`; fall back to ISO-format
   `tasks.due` text). Items grouped by workspace, sorted most-
   overdue-first, click flips the active-workspace cookie via
   `selectWorkspaceAction` and routes to `/app/board`. Empty state:
   *"Nothing's late. The rare clean inbox."* Hint: *"⌘. to toggle ·
   esc to close"*.

3. **Share-card PNG from the daily digest** — agent 3 + architect
   integration fix.
   `/share-card/[workspaceId]/opengraph-image` is the URL. 1200×630
   PNG: brand glow, dot-emit wordmark, large count + "tasks closed
   this week" + workspace name + `tasks.app/p/{slug}` + "Made with
   Tasks". Count mirrors the rule from `buildWeeklySnapshot` so the
   number on the card matches the inbox recap. Inbox digest gains a
   "Share this week" button (rendered only when `closedThisWeek > 0`)
   that copies the URL to the clipboard and pops a *"Link copied —
   drop it in Slack"* toast.

   *Integration fix:* Agent originally shipped this as a Route
   Handler at `/api/share-card/[workspaceId]/route.tsx`. Under
   Turbopack + Next.js 16's nodejs runtime, Route Handlers fail to
   pipe `next/og`'s streaming Response (errors with *"failed to pipe
   response"*). The OG-image file convention handles the wrapping
   for free; architect moved the file to
   `share-card/[workspaceId]/opengraph-image.tsx` (default export),
   updated the share button URL, deleted the old route. Documented
   the trap in the new file's preamble so future cycles don't
   re-step. Visual was also conservatively re-flowed off the proven
   `/p/[slug]/opengraph-image.tsx` shape after a separate render-
   pipe failure on the heavier original layout — same lesson, same
   file.

4. **Template remix** — agent 4.
   `remixTemplateAction(templateId)` spins up a fresh workspace
   named `"{template name} · my remix"`, owned by the current user,
   slugged via `reserveUniqueSlug` (template-name slug + `-my-remix-`
   + 4-char random suffix, retried up to 8 times on collision).
   Inserts the workspace + a `workspaceMembers` row with role
   `owner`, applies the template's tasks at lane positions starting
   at 1.0 stepping by 1.0 (no MAX query needed — the workspace is
   empty), records taskAdd activities, sets the active-workspace
   cookie to the new id, redirects to
   `/app/board?remixed={templateId}`. The existing
   `applyTemplateAction` is untouched — the two paths live side by
   side. `/templates/[slug]` hero CTA row now shows both buttons
   (primary "Use this template" + secondary "Remix in a new
   workspace"); footer-card CTA row mirrors. New fork glyph for the
   secondary — two branches diverging from a trunk, reads as "make
   your own copy" without the literal Y shape.

5. **External contact field on tasks** — agent 5.
   Two new nullable columns on `tasks`: `external_contact_name`,
   `external_contact_email`. Drizzle-pushed to the dev DB. `Task`
   type extends with both as `string | null`; row-mapper
   passes-through; `addTaskAction` accepts the optional fields;
   `updateTaskAction` already accepted `Partial<Task>` so the new
   fields flow through without a signature change. New
   `<ContactEditor>` in the detail panel renders a quiet
   `+ Add contact` chip when empty, or `Name · email` when present;
   click opens a popover with name + email inputs (Save / Cancel /
   Remove). Optimistic-UI through the existing
   `useTasksDispatch().updateTask` path so the panel feels instant.
   Absorbs the wedding-vendor / freelance-invoice spreadsheet column
   in one move.

**Operational note**

Five parallel-agent dispatches at once. The cycle 16 rate-limit
issue didn't repeat. Schema-touching agent (5) ran the
`drizzle-kit push --force` itself; no race with the others (only one
agent edited `schema.ts`). Total dispatch time: ~10 minutes
wall-clock for all five to come back.

The Turbopack/ImageResponse trap caught at integration cost about 15
minutes of architect debugging — moved the share-card file from
Route Handler to OG image convention, conservatively re-flowed the
JSX off the proven `/p/` shape. Documented in-file so the next
agent dispatched into edge-runtime or OG territory inherits the
lesson.

**Sprint parallel-agent throughput:** 27 dispatched, 27 complete, 0
broken builds.

**Verified**

- `npx tsc --noEmit` clean across the merged tree.
- `/share-target?title=…&url=…` renders the quick-add modal with
  the textarea pre-filled correctly. 0 console errors.
- `/share-card/ws-legacy/opengraph-image` returns 200 + `image/png`
  + ~20 KB.
- `/templates/wedding-3-month-countdown` renders both apply + remix
  buttons in the hero and footer CTA rows.
- `/app/board` returns 200; the `<CrossWorkspaceOverdue>` popover
  is mounted globally at the app-layout level. Detail-panel
  `<ContactEditor>` renders between Description and Conversation.
- `getEffectiveTier` + studio entitlement layering still works
  (regression sample): no Phase 4 surfaces broke.

**Subtractions**

- `src/app/api/share-card/[workspaceId]/route.tsx` — superseded by
  `src/app/share-card/[workspaceId]/opengraph-image.tsx`.

**Backlog (next — sprint Phase 6: Distribution activation)**

- `.edu` Pro-for-semester gating wired into Clerk webhook.
- Embed widget — `<script>` tag that renders a read-only task list
  inline on indie blogs / Notion pages. Reuses `/p/{slug}` rendering.
- Show HN draft + post (manifesto angle, not feature-list).
- Wedding venue partnership outreach — drafted via the Gmail MCP
  loaded into the session, sent only after user review.
- CHANGELOG syndication — cross-post latest cycles to HN/IH on
  Friday cadence.



## Cycle 21 · 2026-05-06 · Studio tier — operator pricing for the multi-client leak

Phase 4 of the category-defining sprint. The cycle 17 manifesto-pass
flagged a real pricing leak: a freelance dev with five clients on
Team would pay 5 × $9.95 a month for what's structurally one
operator's work, and a wedding planner running ten weddings would
pay $79 ten times to use the same product they already know. Both
audiences would either bounce or downgrade to Pro and lose Team
features. **Studio** is the operator-tier fix: $14.95 a month,
unlimited workspaces you own as sole admin, full Team capabilities
on every one. This cycle lands it without breaking the
per-workspace promise the four-up shelf is built on.

**Architectural call · Studio is per-user, layered server-side**

The cleanest model — and the one that survives every future
workspace creation without bookkeeping — is to grant Studio as a
*single user-level entitlement row* (`workspaceId = NULL`), and
have `getEffectiveTier` and `getWorkspaceTier` layer that user-
level entitlement on top of their existing per-workspace queries.
No bulk INSERTs at purchase time. No cleanup INSERTs when a new
workspace is created. No DELETEs on cancellation — the existing
`expiresAt` mechanic handles that. One row, two query updates,
done.

`TIER_RANK[studio] === TIER_RANK[team] === 2`. They unlock the same
features; they just have different scope. `tierMeetsMinimum`
naturally treats them as equivalent without any branch in the
gating code.

**Type system + entitlement resolution (architect)**

- `EntitlementTier` in `lib/data.ts` extends to
  `"free" | "pro" | "team" | "studio" | "wedding"`. Documented
  inline so the rank-equality with `team` is discoverable.
- `PaidTier` in `server/stripe.ts` extends to include `studio`,
  reading `STRIPE_PRICE_STUDIO_MONTHLY` from env.
- `getEffectiveTier(user, workspace)` in
  `server/db/entitlements.ts` now matches per-workspace OR
  user-level (`workspaceId IS NULL`) entitlements in a single OR
  query, picking the highest rank.
- `getWorkspaceTier(workspaceId)` in `server/db/membership.ts` runs
  two queries in parallel — per-workspace entitlements + a
  workspace-owner-Studio join — and unions the rows. Member-cap
  resolution gets Studio's unlimited-members capacity for free
  through `isUnlimited = team || studio || wedding`.

**Stripe + webhook plumbing (architect)**

`createCheckoutSessionAction` checks `tier === "studio"` and scopes
the entitlement to `null` instead of the active workspace. Stripe
metadata can't carry null, so the `"*"` sentinel is encoded in the
metadata payload and decoded in the webhook. `grantEntitlement`'s
signature widens to `workspaceId: string | null` (the DB column was
already nullable) so the contract declares scope intent
explicitly. Webhook on both `checkout.session.completed` and
`customer.subscription.updated` decodes the sentinel, with a
guardrail that rejects `null` workspaceId for any tier that isn't
Studio.

`STRIPE_PRICE_STUDIO_MONTHLY` is a new required env var for prod;
dev path (no Stripe keys) writes the entitlement directly via the
existing `dev:no-stripe` short-circuit.

**Pricing page (architect)**

A separate `<StudioPanel>` band ships below the main four-up grid.
Visually distinct from the primary tier shelf — gradient
background, "FOR OPERATORS" pill, $14.95 price in 42px, Studio
title, the four-line "what you actually get" feature list, the
"Start Studio" CTA. The four-up shelf above stays exactly as it
was — Solo / Pro / Team / Wedding — so the primary visual
hierarchy doesn't fragment.

New FAQ entry — *"Why Studio?"* — explains the freelance multi-
client and wedding-planner use cases in plain English and frames
the choice: operator running multiple workspaces under one roof =
Studio; team in a single workspace = stay on Team.

**Settings billing tab (architect)**

`BillingSection`'s `TIER_META` array gains a Studio entry so the
header banner reads *"Studio · Team-equivalent across every
workspace you own."* instead of falling through to the Free
default. `TIER_RANK` and `TierBadge` styles also extended to
include Studio. The redeem-result card's `TIER_LABEL` map gains a
Studio entry too. Three small spreads of the new tier through the
existing surfaces; nothing structural.

**Verified**

- `npx tsc --noEmit` clean across the merged tree.
- `/pricing` renders all 5 tiers — four-up shelf intact, Studio
  side-panel below with correct copy, "Why Studio?" FAQ entry
  visible, footer + nav unchanged.
- End-to-end Studio resolution test (dev DB):
  1. Wiped per-workspace entitlements on `ws-legacy`.
  2. Inserted a single user-level entitlement
     `{ user_id: 'david', workspace_id: NULL, tier: 'studio' }`.
  3. `/app/settings` Billing tab loaded showing
     *"Studio · Team-equivalent across every workspace you own"*
     in the header banner, with the Studio card highlighted as
     "YOU" in the tier grid. Confirms the layered query in
     `getEffectiveTier` correctly resolves user-level Studio
     across the active workspace.
  4. Restored the wedding entitlement after.
- `/changelog` route + sitemap still 200; no regressions.

**Subtractions**

- *None this cycle.*

**Backlog (next — sprint Phase 5: A-tier wave)**

- iOS share-sheet capture (PWA share target → quick-add modal).
- Cross-workspace overdue command (`⌘.`).
- Daily-digest share-card PNG (auto-generated 1200×630 image).
- Template remix (duplicate any template into a personal copy;
  publish flips visibility).
- External contact field on tasks (vendor / invoice / etc.).
- Five features in one cycle, parallel-agent dispatch.



## Cycle 20 · 2026-05-06 · Publishable workspaces — /p/{slug} ships with four domain themes

Phase 3 of the category-defining sprint. Until this cycle, a shared
workspace looked like the app, behind a magic-link wall. As of now,
any owner can flip a switch and the workspace renders publicly at
`/p/{slug}` — branded by domain pack, beautiful enough to share with
vendors, clients, classmates, or readers. The SEO foundation Phase 2
laid down (twelve template URLs, three vertical landings) gets its
virality complement: every published workspace ends with a "Made
with Tasks · pick this template free" CTA pointing back to the
matching `/templates/[slug]`. The loop closes.

**Schema · `workspaces.publishedAt` (architect)**

One nullable timestamp column. Null = private (the existing default).
Non-null = the workspace is publicly readable at its slug since that
moment. The existing `slug` column doubles as the public URL
identifier — no separate `publicSlug` introduced, because slugs are
already URL-safe and unique. `drizzle-kit push --force` migrated the
column with the dev seed in place.

**Server actions + queries (architect)**

- `publishWorkspaceAction` — owner-gated, sets `publishedAt = now`,
  returns the slug. Revalidates `/p/{slug}` so the freshly-published
  page is reachable without a cold cache.
- `unpublishWorkspaceAction` — owner-gated, sets `publishedAt =
  null`. The route 404s afterward.
- `getPublishedWorkspaceBySlug(slug)` in `queries.ts` — returns
  workspace + tasks if `publishedAt != null`, otherwise null. The
  null return is the route's 404 signal.
- `getWorkspacePublishState(workspaceId)` — lightweight read for the
  Settings UI.

**`/p/[slug]` public route (architect)**

`src/app/p/[slug]/page.tsx`. Server-rendered. Resolves via the query
helper above; calls `notFound()` for unknown-or-unpublished slugs.
`generateMetadata` builds title + description from the workspace name
and domain label. The whole page body is owned by the picked domain
theme — no shared chrome above, no SiteNav, no app-feel. The shared
`<PublishedFooter>` always renders after the theme, regardless of
which.

**Theme contract (architect)**

`PublishedWorkspaceProps` defined in `src/components/published/types.ts`.
Each theme is a server component receiving `{ workspace, tasks }` and
owns the full `<main>`-level body. The dispatcher in
`published-workspace.tsx` picks based on `workspace.activeDomain` —
falling back to a clean default theme when the workspace's domain
isn't one of the four. The `<PublishedFooter>` (also architect) is
the only piece of structure all themes share: it renders the "Made
with Tasks" CTA, picking the matching `/templates/[slug]` from a
per-domain map (wedding → wedding-3-month-countdown,
marketing → product-launch, freelance → new-client-onboarding,
student → final-paper-sprint).

**Four domain themes · parallel agents**

Four sub-agents, four files, all dispatched simultaneously, all
voice-matched on first ship. Each radically reskins the same data
into a completely different visual register.

- **Wedding** (`wedding-theme.tsx`) — ivory page (#fbf8f3), serif
  display heading, blush-and-leaves floral rules in the hero, italic
  serif lane labels re-voiced as "Still to plan / Underway /
  Awaiting blessing / Settled". Tasks render as elegant rose-bordered
  white cards with italic priority labels and pill tags. Reads like
  a save-the-date page, not a kanban.
- **Freelance** (`freelance-theme.tsx`) — off-white paper (#f8f7f4),
  Geist Mono throughout. Hero opens with `// project · spec`, the
  workspace name styled as a code-comment header, a `v0.{N} ·
  published YYYY-MM-DD` version stamp, and a four-up mono field
  grid (slug / scope / lanes / status). Lane labels styled as
  `## 01 · TO DO`. Tasks render as monospace rows with `[ ]` /
  `[x]` ASCII checkboxes and `[tagname]` square-bracketed tags.
  Closes with an `— end of document —` EOF marker. Reads like a
  GitHub spec.
- **Student** (`student-theme.tsx`) — warm legal-pad cream
  (#fdf9eb) layered with a 28px pale-blue ruled-line gradient and
  a single pink margin rule down the left. Hero has a "STUDY GROUP"
  highlighter chip, large serif title rotated -0.4deg, italic meta
  line. Lane labels rendered as marker-style headings with
  highlighter underlines, re-voiced as "still ahead / this week /
  looking over / wrapped". Tasks render as sticky-note cards (per-
  lane pastel palette: yellow / blue / pink / green) with tape
  strips at the top and slight per-card tilts. Done tasks get a
  strikethrough + faded opacity. Reads like a photographed
  bulletin board.
- **Marketing** (`marketing-theme.tsx`) — pure white, narrow
  editorial column at 760px. Hero has a brand-purple "BRIEF" /
  "ROADMAP" / "PLAN" / "LAUNCH" eyebrow chip (deterministically
  picked from the workspace name), a clean sans-serif display
  heading, and a `Published YYYY-MM-DD · N tasks` masthead meta.
  Lane labels in small-caps with a brand-purple dot on the active
  lane (first non-empty), the rest in their canonical lane colors.
  Tasks render as thin-divider rows, no card backgrounds, P3
  priority hidden. Closes with an "End of brief" centered small-
  caps mark. Reads like Stripe Press / Linear changelog.

The four themes share zero direct visual code. The dispatcher hands
the same data to each; what comes out is unrecognizable across
themes.

**Settings publish toggle (architect)**

`src/components/app/settings/sections/workspace.tsx` gains a "Publish
to the web" block above the existing Identity section. Two states:

- *Private:* "This workspace is private. Only members can see it."
  + a "Publish workspace" button (owner-only, disabled otherwise).
- *Published:* a green "Published {date}" status pill, the
  `/p/{slug}` URL in a copy-able code block, plus three buttons —
  Copy link (with copied-confirmation), Open (in a new tab), and
  Unpublish (rose-tinted, immediate).

`SettingsWorkspace` type extended with `publishedAt`. Settings page
threads it through.

**OG card per published workspace (architect)**

`src/app/p/[slug]/opengraph-image.tsx`. Edge runtime. Single visual
treatment across all domains — themes are for the page, not the
unfurl. Wordmark + domain-pack chip (brand purple) + workspace name
(76px) + task count + URL in the masthead. Falls back to a clean
"Not found" card for unpublished or unknown slugs.

**Verified**

- `npx tsc --noEmit` clean across the merged tree.
- All four domain themes verified at `/p/legacy` by SQL-swapping
  `active_domain` between `student`, `wedding`, `freelance`, and
  `marketing`. Each rendered with 0 console errors and visibly
  different visual treatments. Restored `active_domain = student`
  after.
- Settings → Workspace tab renders the publish block with the
  correct state (Published 6 May 2026, `/p/legacy` URL, Copy link /
  Open / Unpublish buttons).
- Per-workspace OG card route compiles and is reachable at
  `/p/legacy/opengraph-image`.

**Operational note**

Four parallel theme agents shipped four radically different visual
treatments on first attempt. Voice-on-tone-on across all four —
each agent's output reads like the same brand wrote it, just for a
different audience. **Sprint parallel-agent throughput: 22
dispatched, 22 complete, 0 broken builds.**

**Subtractions**

- *None this cycle.*

**Backlog (sprint Phase 4 next)**

- Studio tier ($14.95/mo, unlimited self-owned workspaces). Plugs
  the freelance multi-client and wedding-planner pricing leaks
  flagged earlier.
- Phase 5 — atomic A-tier wave (iOS share-sheet capture, cross-
  workspace overdue command, share-card PNG, template remix,
  external contact field).
- Phase 6 — distribution activation (Show HN, .edu verification,
  embed widget, venue partnership outreach).
- Phase 7 — B-tier delight wave (drag momentum, focus mode, cents
  column, etc.).



## Cycle 19 · 2026-05-06 · Templates as distribution — wave 2 finishes the SEO surface

Phase 2 wave 2. Cycle 18 shipped the route + four flagship essays;
this cycle finishes the other eight, plus two more vertical landings.
All twelve `/templates/[slug]` URLs now render long-form, manifesto-
voiced copy. All three top-of-funnel ICP landings (`/for/weddings`,
`/for/freelancers`, `/for/students`) are live. Pure parallel-agent
throughput cycle: eight essays in two batches of four, both
batches voice-matched on first ship, no rewrites.

**Eight essays · two batches of four**

The dispatch pattern from cycle 18 held. Wave 1's wedding-3-month
essay continued to serve as the gold-standard reference; each new
agent received the same brief structure (target template, SERP query,
voice rules, the gold-standard quoted, instructions to read the SERP
graveyard before drafting).

*Batch 1:*

- **`wedding-day-of-run-of-show`** — *"Wedding Day Timeline Template
  — Minute-by-Minute Run of Show."* Heroline: *"A wedding runs on
  schedule or it runs on the maid of honor."* Hammers all 10 anchor
  times (8 AM hair, 11 AM first looks, 3 PM ceremony, 11 PM
  send-off). Frames the choice as *written-by-Thursday vs.
  improvised-by-MOH*.
- **`midterm-week`** — *"Midterm study plan — a week-of checklist
  that actually works."* Heroline: *"The difference between a B and
  a B+ on a midterm isn't an extra hour of studying."* Lands
  immediately on the high-yield sleep + breakfast tasks every
  competitor checklist quietly skips.
- **`new-client-onboarding`** — *"Freelance Client Onboarding
  Checklist — Free Template."* Heroline: *"The first week is when a
  freelance engagement is actually priced."* Frames kickoff doc and
  contract not as paranoia but as the alignment artifact for the
  week-six call where someone says *"I assumed that was included."*
- **`product-launch`** — *"SaaS Product Launch Checklist."*
  Heroline: *"Launches don't fail at the press list. They fail at
  the positioning doc."* Walks specifically the seam-failures —
  landing page vs. email dissonance, Sunday-night hero-video cut,
  unsegmented blast burning the warm list.

*Batch 2:*

- **`apartment-move`** — *"Apartment Move Checklist — 30 Days Out."*
  Heroline: *"Most people lose their deposit on move-out day. The
  damage was done weeks earlier."* Centers the move-in photos and
  date-shifted utility cancellation as the boring tasks that pay for
  themselves.
- **`trip-planning`** — *"Trip Planning Checklist."* Heroline:
  *"Trips don't get ruined at the destination. They get ruined at
  the gate."* Opens on the Schengen six-month passport rule as the
  concrete failure mode.
- **`job-application-sprint`** — *"Job Application Checklist."*
  Heroline: *"The resume isn't why you're not getting callbacks."*
  Argues the load-bearing task is outreach (5 actual emails, not
  LinkedIn connection requests), with behavioral-practice-out-loud
  as the second pillar most checklists treat as decorative.
- **`conference-booth-prep`** — *"Conference Booth Checklist —
  SaaS Trade Show Template."* Heroline: *"The booth doesn't convert
  at the booth."* Locates the actual revenue in the 48-hour
  post-show follow-up window most teams blow.

Voice held across all eight. Same pattern in every essay: declarative
heroline that names the failure mode, intro hook that opens on a
specific concrete moment, *"what's in this template"* section
grounded in the actual tasks, *"why a workspace, not [alternative]"*
pitch, observational closer. No agent needed a rewrite.

**Two more vertical landings**

- **`/for/freelancers`** — *"Five clients, one inbox."* Teal
  eyebrow + highlight. Anchors on `new-client-onboarding` +
  `tax-season` templates. Calls out the multi-client pricing
  honest-math (Pro $4.99/mo unlimited workspaces; Studio tier —
  the freelance multi-client absorber on Phase 4's roadmap —
  acknowledged as upcoming, not pretended-to-already-exist).
- **`/for/students`** — *"The semester in one place."* Amber
  eyebrow + highlight. Anchors on `final-paper-sprint` +
  `midterm-week`. Distinct from `/students` (action page for
  `.edu` Pro signup); this page is top-of-funnel SEO, links to
  `/students` for the offer at the bottom.

The three vertical landings (`/for/weddings`, `/for/freelancers`,
`/for/students`) now share a coherent visual system: same single-
column 820px layout, same eyebrow-pill chrome, each with a distinct
brand color (rose-pink, teal, amber) keyed to the ICP. New cycles
won't need to re-derive the pattern.

**Sitemap + footer**

`sitemap.ts` now includes the two new vertical landings at priority
0.8 each. Footer Resources column gains "For freelancers" and "For
students" entries — five of the six rows are now real links;
"Contact" remains a placeholder pending a contact route.

**Verified**

- `npx tsc --noEmit` clean across the merged tree.
- All 8 newly-essayed `/templates/[slug]` URLs render rich content
  with the same skeleton as wave 1. Sample-tested
  `wedding-day-of-run-of-show` (full essay, lane-grouped task
  preview, related strip, 0 console errors).
- `/for/freelancers` rendered with teal eyebrow + *"Five clients,
  one inbox."* H1 with the highlight on "one inbox," intro
  paragraph + template anchors visible. 0 console errors.
- `/for/students` rendered with amber eyebrow + *"The semester in
  one place."* H1, intro + template anchors visible. 0 console
  errors.
- `/sitemap.xml` returns 200; verified the two new vertical
  landings emit alongside the 12 template URLs.

**Operational note**

Two batches × four agents = eight parallel-agent dispatches in one
cycle, plus the two vertical landings authored by the architect
session in parallel. All eight agents shipped voice-matched copy on
first attempt, all under their respective time budgets, no rate-
limit failures (cycle 16's tap-out problem didn't repeat — staggering
into 4-then-4 batches kept under whatever ceiling that was). Total
parallel-agent throughput across the sprint so far: **18 dispatched,
18 complete, 0 broken builds.**

**Subtractions**

- Footer "Brand" placeholder (already removed cycle 18 — no further
  removals this cycle).

**Backlog (next cycle — sprint Phase 3)**

- `/p/{slug}` publishable read-only workspace renders, per-domain
  themes (florals on wedding, code-on-paper on freelance, marker on
  student, editorial on marketing). Reuses magic-link auth path; no
  new infra. The CTA footer on every published page links to the
  matching `/templates/[slug]` — closes the SEO ↔ virality loop
  this sprint set up.
- Phase 4 (Studio tier) and Phase 5 (atomic A-tier wave) sit
  downstream of Phase 3.



## Cycle 18 · 2026-05-06 · Templates as distribution — /templates/[slug] × 12, four essays, /for/weddings

Phase 2 wave 1 of the category-defining sprint. The premise: every
template is a search query someone is typing into Google right now.
*"Wedding 3-month checklist."* *"Freelancer tax season."* *"Final
paper outline."* *"Self-review template."* The current `/templates`
gallery served twelve cards on one URL; this cycle splits it into
twelve URLs, each a destination page, each targeting a long-tail SERP
query. The data layer was already declarative — the job was the route,
the essays, and the metadata.

**`/templates/[slug]` · twelve destinations (architect)**

A new dynamic route at `src/app/templates/[slug]/page.tsx`. Server-
rendered for indexing — the apply CTA is the only client island
(`<ApplyTemplateButton>`). `generateStaticParams` enumerates every
template id at build time, so all twelve URLs prerender. `dynamicParams =
false` — unknown slugs 404, the route is a closed set. `generateMetadata`
pulls per-template `seoTitle` + `seoDescription` from the essay if one
exists, falls back to template name + description otherwise.

The render component (`src/components/marketing/template-detail.tsx`)
has two modes baked in. *Rich:* template has an entry in
`TEMPLATE_ESSAYS`, renders the manifesto-voiced long-form copy with H1
heroline, intro hook, lane-grouped task preview, three-to-four h2
sections, closing card with custom closer, and a "Related templates"
strip. *Light:* no essay yet, falls back to a generic heroline
("{template name} — a drop-in task list.") and the template's own
description as intro. Same skeleton, lighter content. All twelve slugs
work day-one; waves 2 and 3 fill in the remaining eight essays without
touching anything else.

**Four SEO essays · parallel agent dispatch**

Four 250–470-word essays in CHANGELOG voice, one per ICP, each
targeting a long-tail SERP query. The architect wrote the wedding
gold-standard (*"Three months out is when wedding planning gets
real."*); three sub-agents wrote the rest in parallel, given the gold
standard as a tone reference plus instructions to read the SERP
graveyard before drafting.

- **`wedding-3-month-countdown`** — *"Wedding 3-Month Checklist — Free,
  No Signup."* The 90-day window where vendors get slow and the math
  gets real. RSVPs, marriage license, welcome bags. Three sections.
- **`final-paper-sprint`** — *"Final paper checklist — the sprint
  plan that beats the 4am panic."* "A paper is six different jobs in
  a trench coat" — the load-bearing line. Sections walk through why
  most checklists fail (order matters more than effort), the eight
  tasks in the right order, and the Pro-for-students hook ($4.99,
  less than one campus coffee).
- **`tax-season`** — *"Freelancer Tax Season Checklist — 1099s, S-Corp,
  Estimated."* The agent landed the March 15 1120-S deadline as the
  loudest specificity hook against generic listicle competition.
  Walks through why filing in April at 11pm is a list problem, not a
  tax problem.
- **`quarterly-review-prep`** — *"Self-Review Template: Walk In With
  Receipts, Not Vibes."* Four sections; the wins-with-numbers section
  is the load-bearing one ("'cut onboarding from 11 days to 4,
  measured across the last 38 hires' gets quoted; 'improved
  onboarding' gets downgraded"). Slightly long at ~470 words — kept
  it because the contrast was the sell.

Voice consistency was the architectural constraint. Every essay had to
sound like it came from the same writer. Three-of-three agents nailed
it on first ship; no rewrites needed.

**Per-template OG cards (architect)**

`src/app/templates/[slug]/opengraph-image.tsx` — edge-runtime
`ImageResponse`, `generateImageMetadata` enumerates twelve at build
time. Each card renders the template glyph + domain pack chip + the
essay heroline (or fallback) + the task count. Same brand idiom as the
root OG card — Inter, brand glow, dot-emit wordmark. When someone
shares `/templates/wedding-3-month-countdown` in Slack, the unfurl
shows *"Three months out is when wedding planning gets real."*

**`/for/weddings` · vertical landing (architect)**

A new long-form sales letter at `src/app/for/weddings/page.tsx`. The
pattern: ICP-focused marketing landings live under `/for/*`, distinct
from the existing `/students` action page. Eyebrow is rose-tinted
("FOR WEDDINGS"), H1 highlights "in one place" with a pink underline.
Opens with *"A wedding has 73 vendors, 14 family members with
opinions, and one couple holding it all together with a Google Sheet."*

The page anchors on the two wedding templates (3-month countdown +
day-of run-of-show) with rich card links, then a "Why couples like
this better than a spreadsheet" reasons block, a planner-tier
acknowledgement (open question — Studio tier in Phase 4 will likely
absorb it), and a closing $79-once CTA card. Two more landings to come
next cycle: `/for/freelancers` and `/for/students`.

**Sitemap, footer, plumbing**

`src/app/sitemap.ts` rewritten to enumerate every public surface plus
the twelve `/templates/[slug]` URLs. Priorities calibrated — root 1.0,
pricing 0.9, templates index 0.85, per-template pages 0.75, vertical
landings 0.8. `changelog` and `status` retained their cadence
hints. Footer Resources column gains a "For weddings" entry; "Brand"
removed (was a placeholder #).

**Verified**

- `npx tsc --noEmit` clean across the merged tree.
- All twelve `/templates/[slug]` URLs return 200; sample sweep of
  rich-essay path (`wedding-3-month-countdown`), light-render path
  (`apartment-move`), and the rest in-between.
- Wedding template page rendered in Playwright with full essay,
  task preview lane-grouped, related-templates strip, and 0 console
  errors. The lighter render fell back to *"Apartment move — a
  drop-in task list."* heroline cleanly.
- `/for/weddings` rendered with rose-pink eyebrow, *"Plan the wedding
  in one place."* H1 with the underline highlight, both template cards
  linked, $79-once closing CTA. 0 console errors.
- `/sitemap.xml` returns 200; verified manually that all twelve
  template URLs are emitted.
- Per-template OG images compile under edge runtime
  (`generateImageMetadata` × 12, no static-params clash).

**Subtractions**

- Footer "Brand" placeholder link (was `href="#"`).

**Backlog (next cycles)**

- Phase 2 wave 2 — eight remaining essays
  (`apartment-move`, `trip-planning`, `job-application-sprint`,
  `wedding-day-of-run-of-show`, `midterm-week`,
  `new-client-onboarding`, `product-launch`,
  `conference-booth-prep`). Parallel-agent dispatch. Two more
  vertical landings: `/for/freelancers` + `/for/students`.
- Phase 3 — `/p/{slug}` publishable read-only workspaces, per-domain
  themes (florals on wedding, code-on-paper on freelance, etc.).
- Phase 4 — Studio tier ($14.95/mo, unlimited self-owned workspaces),
  which absorbs the wedding-planner pricing question this cycle
  flagged.



## Cycle 17 · 2026-05-06 · Manifesto made real — /principles, the 3-editor cap, pricing honesty

The first cycle of a new sprint — call it the category-defining sprint
— and the shape of it is deliberately small. After cycles 12–16 closed
the launch checklist, the question turned strategic: what does the
brand promise that we haven&rsquo;t actually delivered? The honest
answer was *three editing guests free,* which the pricing page already
implied and the product structurally refused. Closing that gap —
publicly, structurally, and visibly — is this cycle.

**/principles · the public refusal list (architect)**

A new marketing route at `/principles`, sister page to `/about`, ships
the eight features Tasks will never build. Per-seat pricing. Gantt.
SSO as a marketing line. AI agents that auto-complete tasks. Real-time
push notifications. Story points and the rest of the strikethrough
liturgy. A paid template marketplace. Threaded comments-on-comments.
Each refusal gets a punchy title and a short paragraph explaining
*why* — not as defensive posture but as positive signal. Naming what
we won&rsquo;t build is the brand spine; if a future cycle ships any
of these, the manifesto is a lie.

Visual signature: rose-tinted "no" pills on the numbered items, where
`/about` uses brand-soft "yes" pills. The H1 echoes the about page&rsquo;s
strikethrough treatment but flipped — *eight features we&rsquo;ll never
ship.* Eyebrow gradient is rose-to-pink instead of brand-purple. CTA
card at the bottom links back to `/about` ("read what we promise") and
`/pricing` ("see the pricing"), so both lists are one click apart.
Footer Resources column gains a Principles link.

**Pricing copy · the public commitment (architect)**

Solo tier&rsquo;s blurb sharpens to *"For one mind running their own
work — plus three friends."* The feature bullet *"Magic-link guests ·
view-only"* becomes *"Three editing guests, free."* New FAQ entry —
*"Why three editing guests?"* — explains the calibration in plain
English: a study group, a couple plus the maid of honor, two roommates
and a dog-walker, a freelancer plus the client point-of-contact.
Beyond three, you&rsquo;re a team, and Team is $9.95 per workspace,
flat. The "free forever" answer extends to mention the three-editor
allowance explicitly so it can&rsquo;t be missed.

**Member-cap entitlement layer (architect)**

New module `src/server/db/membership.ts` ships three helpers:
`getWorkspaceTier(workspaceId)` resolves a workspace&rsquo;s effective
tier across all entitlements (distinct from per-user `getEffectiveTier`,
which answers what a given user has access to); `getMemberCapacity`
returns `{ current, max, tier }` in one read; `canAddMember` is the
predicate guard. `FREE_WORKSPACE_MEMBER_CAP = 4` — one owner plus
three invited editors. Team and Wedding tiers return `max: null`,
unlimited.

`inviteMemberByEmailAction` (the Phase F stub) now calls `canAddMember`
before any side-effect work and throws a manifesto-voiced error when
capped: *"Free workspaces include three editing guests. Upgrade to
Team to invite more."* The real Clerk-backed invite flow inherits the
cap by virtue of going through this action.

The settings page Members tab gains the counter UI. Capacity loads
server-side alongside `getEffectiveTier` and the notification prefs in
the existing `Promise.all` — one extra round trip, no perf hit.
`MembersSection` receives a `MemberCapacity` prop and renders three
states:

- **Within cap** — small "X of N used" chip top-right of the invite
  block, plus a quiet footnote: *"Free includes three editing guests
  beyond the owner. Team unlocks unlimited members."*
- **At cap** — chip turns rose-tinted; input and button both disabled;
  footnote replaced with *"All free seats are taken — owner plus three
  editing guests. Upgrade to Team for unlimited members per workspace,
  no per-seat tax."* with the upgrade link inline.
- **Unlimited (Team / Wedding)** — counter and footnote both hidden.
  Original UX preserved.

**Verified**

- `npx tsc --noEmit` clean across the merged tree.
- All four routes return 200: `/`, `/principles`, `/pricing`,
  `/app/settings`.
- `/principles` renders eight refusal items with the rose-tinted
  numbered pills, the strikethrough H1, and the dual-CTA footer card.
- `/pricing` shows the new Solo blurb, the *"Three editing guests, free"*
  bullet, and the *"Why three editing guests?"* FAQ entry. The "free
  forever" answer mentions the three-editor allowance.
- `/app/settings` Members tab — temporarily wiped david&rsquo;s
  seeded wedding entitlement to expose the Free path. Counter chip
  rendered "5 of 4 used" in rose, input + button correctly disabled,
  capped footnote linked to `/pricing`. Restored the entitlement after.
- Footer "Principles" link present in the Company column on every
  marketing page.

**Subtractions**

- *None this cycle.*

**Backlog (sprint Phase 2 dispatched next)**

- `/templates/[slug]` dynamic route — twelve template URLs, each a
  manifesto-voiced essay targeting a long-tail SERP query. Two-cycle
  build with parallel-agent essay dispatch.
- `/p/{slug}` publishable read-only workspace renders, per-domain
  themes (sprint Phase 3).
- Studio tier ($14.95/mo, unlimited self-owned workspaces) to plug the
  freelance-multi-client and wedding-planner pricing leaks (Phase 4).



## Cycle 16 · 2026-05-06 · Phase H wave 2 — keyboard nav, link analytics, templates

Three more agents in parallel; three more polish ships. They all
hit a rate limit before completing the last 5% of their work, so
the architect session finished the integration — gallery page +
welcome-picker hook + footer link were stitched on after the
agents tapped out. Net effect: same outcome, slightly more manual
seam.

**Keyboard nav on the board (sub-agent → architect-finished)**

The board view became keyboard-driveable. Arrow keys move focus
within and across lanes (← → snap to same-index card in the
adjacent lane, falling back to the lane's last card if shorter).
Enter / Space opens the focused card; ⌘⏎ marks done with the
DopamineCheck firing; ⌘← / ⌘→ moves the focused card across
lanes. Esc clears focus. Skips entirely when focus is in a text
input/textarea/contenteditable so the existing `c` quick-create
shortcut and inline composers still own their keystrokes.

A "/" hint at the bottom-right opens a cheat-sheet popover:
> ↑↓ within lane · ←→ across lanes
> ⏎ open · ⌘⏎ mark done · ⌘←/⌘→ move

Focused card gets a 2px brand-color outline + a 1.04× scale bump
that respects `prefers-reduced-motion`. `useEffect` scrolls the
focused card into view on every focus change.

**Magic-link analytics dashboard (sub-agent → architect-finished)**

The Manage tab in the Share popover went from "list of tokens" to
a real analytics surface:

- **Workspace-total visit count** — single number, brand-colored,
  aggregated across active links.
- **Per-link 7-day micro-sparkline** — 60×16 inline bars rendered
  via the existing `<Sparkline>` primitive lifted from the
  cinematic showcase. No new component.
- **"Most-clicked" callout** — only when ≥ 3 links and one has
  > 2× the median. Brand-soft pill at the top of the list.
- **Last-visited stamp** — replaces "expires {date}" when the
  link has been visited; otherwise stacks "12 visits · last 3h
  ago · expires Mar 14".
- **Two-step revoke confirm** — first click flips the button to
  red "Confirm revoke?", second within 4s executes.

New `share_link_visits` table (id PK, token FK CASCADE, visitedAt
timestamp, userAgentHint truncated to 60 chars).
`bumpShareLinkVisitAction` writes a visit row alongside the
counter increment. `recordShareLinkVisit` helper in `queries.ts`
is the single insert path.

**Templates gallery (sub-agent → architect-finished)**

`/templates` ships as a public marketing surface with 12 drop-in
task lists across the four domains:

- Cross-domain: Job application sprint · Quarterly review prep ·
  Apartment move · Trip planning
- Wedding: 3-month countdown · Day-of run-of-show
- Student: Final paper sprint · Midterm week
- Freelance: New client onboarding · Tax season
- Marketing: Product launch · Conference booth prep

Templates are pure declarative data in `src/lib/templates.ts` —
no DB writes there. `applyTemplateAction` (server action) inserts
each task into the active workspace via the existing addTaskAction
shape — **additive**, not clearing existing tasks. End-of-lane
positions computed in one query per touched lane (no N+1).

Gallery: 2-col on tablet, 3-col on desktop, 1-col on mobile. Each
card shows a unicode-glyph icon in a brand-soft square, name,
description, task-count chip, and a single "Use this template"
CTA. Apply redirects to `/app/board?templated={id}` so a future
toast can confirm. Wired into the welcome picker as "Or pick a
template →" beside the existing skip-blank link, and into the
marketing footer's Resources column.

**Verified**
- `npx tsc --noEmit` clean across the integrated tree.
- All ten public + app routes return 200: /, /pricing, /about,
  /students, /changelog, /status, /templates, /app/board,
  /app/list, /app/import, /app/settings.
- Keyboard nav cheat-sheet renders; focus outline visible.
- Share popover Manage tab shows workspace-total + per-link
  sparklines; visits write to the new table.
- `/templates` renders all 12 cards; "Use this template" fires
  the action.

**Subtractions**
- Hardcoded `ENTRIES` array in `/changelog` (cycle 15 — page now
  reads `CHANGELOG.md` directly).

**Operational note** — three of three wave-2 agents tapped out at
the API rate limit before finishing. None broke compilation; all
left their primary file/data shipped. The architect session
finished the small UI hookups after the agents went quiet. Total
parallel-agent throughput so far this run: 7 dispatched, 7
complete, 0 broken builds.

**Backlog (Phase H wave 3, deferred)**
- Subtasks (nesting in conversation feed) — schema + UI
- Recurring tasks UI on cards — currently only in detail panel
- Timeline drag-and-drop reorder (resize bars to change duration,
  drag bars to shift startDay)
- "Apply succeeded" toast on `/app/board?templated=X`
- Mobile production Lighthouse run (Phase E backlog)
- Postgres dialect (Phase D backlog)



## Cycle 15 · 2026-05-06 · Phase H wave 1 — CSV import, bulk-select, /changelog goes self-aware

The polish loop kicks off. Three landings in this wave; three more
agents dispatched mid-cycle for wave 2. Tone of this cycle: less
new architecture, more "the thing already there is now genuinely
better."

**CSV import (sub-agent)**

`/app/import` is a three-step wizard: upload → preview → confirm.
Drag-and-drop a `.csv` from Trello, Asana, Notion, or "auto-detect."
Source heuristics live in `src/components/app/import/csv-parsers.ts`
— Trello reads `Card Name` + `List Name` + `Labels` + `Due Date` +
`Members`; Asana reads `Name` + `Section/Column` + `Tags` +
`Assignee`; Notion reads whatever the database export gave us. The
preview table maps detected columns to canonical Task fields with a
header-row dropdown to remap if the heuristic guessed wrong.
Per-row "skip" toggle. Bottom-of-table count: "47 ready · 3
skipped · 2 missing title."

`importCsvAction` runs in a single transaction — rolls back if any
row fails. Tasks land in the active workspace via
`getActiveWorkspace()`, fresh ids, positions extending the end of
their target lane. Comments + activities are NOT imported (out of
scope). 500-row cap; "split into batches" if exceeded.

Sidebar gained an "Import" entry under Teams in the desktop rail.
Mobile tabbar untouched (kept Agent 1's Phase E ownership clean).

Deps added: `papaparse` + `@types/papaparse`.

**Bulk-select on the list view (architect)**

Power-user move. Shift-click extends a range from the last anchor
across lane boundaries; ⌘/Ctrl-click toggles a single row; plain
click clears the selection and opens the detail panel. Esc clears.
Anchor tracked in a ref so the range computes from the user's
first selection, not the most recent.

When `selected.size > 0`, a sticky bottom-center action bar slides
in (above the mobile tabbar's 80px on phones, 6px from the bottom
on desktop). Round buttons. Three actions:

- **Move to** — popover with the four lanes, fires `moveTask(id,
  lane)` for each selected id. Closes selection.
- **Mark done** — fires `toggleComplete(id)` for any selected row
  not already in done. The DopamineCheck animation fires N times.
- **Delete** — deletes the selected rows.

Selected rows render with the same `var(--brand-soft)` background
as the open detail-panel row, so visual hierarchy is consistent
across the two selection states. The toolbar uses the elevated-
chrome shadow + backdrop-blur so it floats clean over scrolled
content.

**`/changelog` reads itself (architect)**

Until this cycle, the public `/changelog` was a hardcoded list of
three pre-launch entries (v0.1.0, v0.0.6, v0.0.5) that hadn't been
updated since cycle 1. It's now a server component that reads
`CHANGELOG.md` at request time, parses cycles via a `## Cycle N · …`
regex split, and renders each one as an article card with full
markdown rendering (`react-markdown` + `remark-gfm`). Brand-toned
typography via custom `components` overrides — h3 promoted, `<code>`
on bg-sunken pills, lists tightened, hr as a soft separator.

This means the changelog now ships itself. Every cycle entry above
this one renders for any visitor at /changelog with one click.
Marketing-side, this is the single biggest "look how we work"
signal we have.

Deps added: `react-markdown` + `remark-gfm`.

**Verified**
- `npx tsc --noEmit` clean across all merged files.
- `/changelog` renders 14 cycles with the right typography and
  preserved playful tone.
- Bulk-select: shift-click, ⌘-click, Esc, and the bottom toolbar
  all work; the brand-soft background matches the open-panel state.
- CSV upload zone accepts a Trello CSV; preview shows mapped rows.
  Smoke-tested via Playwright at `/app/import`.
- Zero console errors anywhere.

**Backlog (wave 2 dispatched)**
- Three more agents are running in parallel:
  - **Keyboard nav on board** — arrow keys move focus, ⏎ opens,
    ⌘⏎ marks done, ⌘← / ⌘→ moves across lanes, "/" opens a
    cheat-sheet popover.
  - **Magic-link analytics** — workspace-total visit count, per-
    link 7-day micro-sparkline, "most-clicked" callout, two-step
    revoke confirm. New `share_link_visits` table for per-visit
    logging.
  - **Templates gallery** — `/templates` public route with 12
    drop-in task lists (job application sprint, wedding 3-month
    countdown, freelance new-client onboarding, etc.). Auth-
    gated apply via Clerk redirect.

These integrate next cycle.



## Cycle 14 · 2026-05-06 · Phase E + F + G — three agents, parallel, no collisions

The first parallel-agent cycle. Three sub-agents dispatched
simultaneously, each scoped to non-overlapping files; one architect
session orchestrating. They all landed in ~12 minutes, type-check
clean, zero console errors at the merge. Writing this cycle as
proof that the operating loop holds.

**Phase E · mobile pass (Agent 1)**

The marketing site + four app views needed to actually work on a
phone. Sidebar collapsed into a fixed bottom-tabbar under 768px
(Inbox / My tasks / Search / Views-popover) with iOS safe-area
respected. Layout pads `pb-[60px] md:pb-0` so content clears the
bar. The board's drag handlers gated off under 768px; cards now
have a "•••" affordance that opens a "Move to {Lane}" popover for
one-tap re-laning. List view shed its Estimate + Assignees + tag
columns under md, status collapsed to a colored 8px dot with an
aria-label. Calendar swapped its 7×5 grid for a vertical day-list
under md ("Nothing scheduled. Lovely." for empty days). Inbox
digest cards stack vertically under md. Marketing hero clamps the
cinematic surface to `aspect-video w-[90vw]` so the 500px-tall
demo doesn't overflow on phones.

Mobile Lighthouse against `next dev` scored 42 (LCP 11.4s) — dev
server numbers, not production. CLS = 0; structure suggests prod
will clear ≥90 once `next build` runs cleanly. Backlog item.

**Phase F · launch ops (architect orchestrating)**

Vercel project hooks shipped:

- `src/app/opengraph-image.tsx` + per-route OG cards on `/pricing`,
  `/about`, `/students`. Edge runtime, 1200×630, brand gradient +
  wordmark. Pricing OG renders the four tiers as a row; about OG
  visualizes the strikethrough metaphor; students OG carries the
  `.edu` value prop in the hero text.
- `src/app/status/page.tsx` — public status page. Live probes
  `/` and `/api/cron/digest`; integration pills for Clerk, Stripe,
  Resend, Sentry, DB; surfaces the deploy SHA + timestamp from
  Vercel env. Hero dot goes amber (not red) when something's off
  — honest about the difference between "down" and "catching up."
- `vercel.json` declares the daily digest cron at `0 9 * * *` and
  the new weekly LLM-narrated digest at `0 9 * * 0` (Sundays).
- `DEPLOY.md` — the full v1.0 launch checklist. Vercel link, env
  vars, webhook endpoints, Stripe products, Resend domain, custom
  domain, Sentry, smoke test, post-launch ad capture. Read top to
  bottom before pulling the public-launch lever.
- `.env.example` updated with Anthropic + CRON_SECRET keys.

**Phase G · LLM nudges (Agent 3)**

The rules-based `generateNudges` already shipped cycle 11 with
cheeky copy. Phase G layers Anthropic Haiku 4.5 on top via the
Vercel AI SDK — three streamed actions, each with brand-voiced
system prompts and Anthropic prompt caching on the stable
preamble.

- `src/server/ai.ts` — SDK client + provider config. Default model
  `claude-haiku-4-5-20251001`, env-overridable. `aiConfigured()`
  helper for graceful degradation; missing key returns a static
  "AI not configured" payload rather than throwing.
  `WeeklyDigestSnapshot` type + helper to compile the past 7 days.
- `src/server/actions/ai.ts` — three streaming server actions:
  `draftReplyAction(taskId, prompt?)` (1–3 sentence reply matching
  the conversation tone), `summarizeConversationAction(taskId)`
  (2–3 sentence summary, only offered for ≥ 6 messages),
  `weeklyDigestNarrationAction(workspaceId)` (Sunday morning
  4–5 sentence narrative). Plus `getWeeklySnapshotAction` so the
  inbox always knows whether there's signal worth narrating.
- `src/components/app/ai/draft-reply-button.tsx` — popover-style
  affordance inside the conversation composer. Streams tokens
  into a `<textarea>` the user can edit before sending.
- `src/components/app/ai/conversation-summary.tsx` — collapsed by
  default; reveals an inline summary on click. Hidden when the
  thread is shorter than 6 comments so we don't surface AI noise
  on 2-message conversations.
- `src/components/app/ai/weekly-recap.tsx` — Sunday-morning recap
  card in the inbox. Hidden when AI is off or the snapshot has
  no signal.
- `src/lib/nudges/generate-nudges.ts` extended with an
  `llm-narration` kind in the `NudgeKind` union — `generateNudges`
  itself stays pure rules; the LLM-sourced renderer lives in the
  inbox.

System prompts match the existing nudge tone: *"You are Tasks's
quiet observer. Dry, restrained, never preachy. Em-dashes welcome.
No emojis. Two sentences max. Notice; don't lecture."* Caching
applied to the long preamble; per-call user content is the only
un-cached suffix.

**Phase E · settings (Agent 2)**

`/app/settings` shipped as a single page with tabbed sub-views —
no URL params, tab state in the client shell. Five tabs:

1. **Workspace** — rename (blur-to-save), starter pack switch
   with confirm dialog (re-seeds via `seedDomainAction`),
   read-only ID/slug/created.
2. **Members** — avatar/name/email/joined list, role popover,
   remove-with-confirm, invite-by-email form (stubbed for
   Clerk-backed real invites in Phase F deploy step).
3. **Billing** — current-tier badge, four-tier comparison grid,
   upgrade buttons (call `createCheckoutSessionAction`), cancel-
   subscription confirm, comp-code redeem field.
4. **Notifications** — three optimistic toggles wired to a new
   `notification_prefs` table.
5. **Danger** — clear-tasks (amber confirm) + delete-workspace
   (rose, type-to-confirm). Delete hidden for non-owners; last-
   owner invariant enforced server-side.

Server actions: `updateWorkspaceAction`, `removeMemberAction`,
`setMemberRoleAction`, `inviteMemberByEmailAction` (TODO),
`setNotificationPrefAction`, `getNotificationPrefs`,
`getMyRoleInActiveWorkspace`, `deleteWorkspaceAction`. Owner
gating + last-owner invariant enforced server-side, not in UI.

Sidebar gained a Settings entry below Teams in the desktop rail.

**Schema additions**

- `notification_prefs` (user_id PK, daily_digest, mentions,
  comment_replies booleans, updated_at). Pushed via
  `drizzle-kit push --force`.

**Verified**
- `npx tsc --noEmit` clean across all merged files.
- Playwright smoke: `/`, `/app/inbox`, `/app/settings` render with
  zero console errors.
- Mobile snapshots at 375px and 768px on `/`, `/app/inbox`,
  `/app/list`, `/app/calendar`, `/app/board`, `/app/timeline`,
  `/app/my-tasks` — zero console errors at any width.
- Daily digest cron preserved; weekly digest cron added to
  `vercel.json`. Both endpoints respond with `emailConfigured:
  false` in dev (graceful) and would dispatch via Resend in prod.

**Backlog**
- Production Lighthouse mobile run (≥ 90 target). Postponed
  because the live `next build` needs a CSS-bundle audit.
- `inviteMemberByEmailAction` stubbed — real Clerk-backed invite
  flow lands when we wire Clerk's invitation API in deploy.
- Postgres dialect (Phase D's deferred half) still pending.
- AI weekly recap on Sunday cron only; backlog "regenerate
  recap" button for power users who want to refresh mid-week.



## Cycle 13 · 2026-05-06 · Phase B + C + D — payments, email, observability

After Phase A turned the boundary from "single global workspace" to
"per-tenant," the next three phases turned the product from "demo
ready" to "billing-shaped." Each is a small layer; together they
move the launch readiness needle from ~70% to ~90%.

**Phase B — Stripe + entitlement enforcement**

The pricing page CTAs went from `<Link href="/app/board">` to real
checkout sessions. New surface area:

- `src/server/stripe.ts` — SDK singleton + `priceIdFor(tier)` lookup +
  `WEBHOOK_SECRET`. All env-gated; missing keys means `stripe = null`
  and downstream code surfaces "Stripe not configured" gracefully.
- `src/server/actions/billing.ts` — `createCheckoutSessionAction(tier)`
  for Pro / Team / Wedding. `mode: "subscription"` for Pro and Team
  ($4.99/mo and $9.95/workspace/mo), `mode: "payment"` for Wedding
  ($79 one-time). `metadata.userId` + `metadata.workspaceId` propagate
  to the subscription so webhooks can resolve identity later. Dev
  fallback: when Stripe is unconfigured, the action grants the
  entitlement locally and returns `?upgrade=ok&dev=1` — the rest of
  the app's tier gating exercises end-to-end without real keys.
- `src/server/db/entitlements.ts` — `getEffectiveTier(userId, workspaceId)`
  resolver. Picks the highest-rank non-expired row across all
  sources (default → comp → edu → purchase). `tierMeetsMinimum()`
  for the gating check.
- `src/app/api/webhooks/stripe/route.ts` — Stripe-signed webhook.
  Handles `checkout.session.completed` (insert entitlement),
  `customer.subscription.updated` (renew through new period end), and
  `customer.subscription.deleted` (expire by `notes:stripe-sub:*`
  match). Uses `grantEntitlement()` and `expireEntitlementByNotes()`
  helpers from billing.ts as the only insertion paths.
- `src/components/billing/require-tier.tsx` — server-component gate.
  `<RequireTier minimum="pro">{paid}</RequireTier>` either renders
  the gated content or an inline upgrade card linking to /pricing.
- `src/components/marketing/tier-cta.tsx` — pricing-page CTA button
  that fires `createCheckoutSessionAction` for paid tiers and
  `<Link>`-redirects for the free tier.

**Phase C — Resend transactional email**

The daily digest, the .edu Pro program, and magic-link sharing were
all previously stubs that logged "would send: …" to stdout. Now
they ship.

- `src/server/email.ts` — Resend singleton + `sendEmail()` helper +
  three HTML templates (`digestEmailHtml`, `studentCodeEmailHtml`,
  `shareLinkEmailHtml`). All branded — "Daily digest" eyebrow tone,
  the same anti-spam line we use in /app/inbox ("this is the only
  scheduled email we send"). Dev path logs to console when
  `RESEND_API_KEY` is unset.
- `src/app/api/cron/digest/route.ts` rewritten — checks a `CRON_SECRET`
  bearer header (skipped in dev), accepts `?send=1` to actually
  dispatch via Resend, resolves a workspace from `?workspace=` or
  the user's first membership, returns a JSON envelope with
  `emailConfigured` + `emailResult` so the cron caller can audit.
- `src/server/actions/comp.ts` — `requestStudentCodeAction` now ships
  the student's code via Resend after minting. The `/students` form
  still surfaces the code inline so the dev demo flow stays visible.
- `src/server/actions/share.ts` — new `emailShareLinkAction({token,
  recipientEmail})` — owners can email a magic link to a teammate
  via the share popover (UI wiring is in the Phase E mobile pass).
- `vercel.json` — Vercel Cron config: `0 9 * * *` against
  `/api/cron/digest?send=1`. Production hooks in once
  `CRON_SECRET` and `RESEND_API_KEY` are provisioned.

**Phase D — Sentry + toasts + error boundaries**

The observability half. Postgres adapter swap is documented in
backlog as a cycle-sized refactor (parallel `schema.sqlite.ts` +
`schema.pg.ts` files gated by `DATABASE_URL`).

- `src/instrumentation.ts` — Next 16 instrumentation hook. Lazy-
  imports `@sentry/nextjs`, inits the Node and Edge runtimes with
  the right DSN, registers `onRequestError` as the request-error
  channel. Skipped entirely when `SENTRY_DSN` is unset.
- `src/instrumentation-client.ts` — client-side Sentry init.
  Replays-on-error sampled at 10%; off when DSN unset.
- `src/components/primitives/toast.tsx` — `<ToastRoot>` provider +
  `useToast()` hook + `<ToastBridge>` for `tasks:toast` window
  events so server actions can fire toasts via a CustomEvent
  without a React reference. Four tones (info, success, warn,
  error) with appropriate eyebrow copy. Max 4 stacked, oldest
  dismisses to make room. Mounted in `/app/layout.tsx`.
- `src/app/app/error.tsx` — error boundary for protected routes.
  Captures to Sentry, renders a brand-toned recovery card ("The
  workspace took a wrong turn"), shows the digest ref-id when
  Next provides one, offers reset + back-to-board.
- `src/app/share/error.tsx` — same treatment for the public guest
  surface.

**Phase F prep — OG images + /status**

Started in parallel with Phase E since they don't touch the same
surfaces:
- `src/app/opengraph-image.tsx` — root OG. Brand gradient + wordmark
  + headline. 1200x630, edge runtime, generated at request time via
  `next/og`. Same shape replicated for `/pricing`, `/about`, and
  `/students`.
- `src/app/status/page.tsx` — public status page. Live probes
  marketing root + the digest endpoint, surfaces integration
  configuration (Clerk / Stripe / Resend / Sentry / DB) as
  "live"/"—" pills, shows commit SHA and deploy timestamp from
  Vercel env. All-green hero when probes pass; amber when they
  don't. No fake green.

**Verified end-to-end**
- `npx tsc --noEmit` clean across all edits.
- Pricing page renders, 0 console errors. Pro / Team / Wedding CTAs
  fire `createCheckoutSessionAction` (in dev mode the action grants
  entitlement locally and redirects).
- `GET /api/cron/digest?send=0` returns `emailConfigured: false`
  in dev with the right user + workspace scoping; would dispatch
  the html template if a key were set.
- Sentry hooks installed; manual error-boundary trigger surfaces
  the brand-toned fallback.

**Backlog**
- Postgres dialect adapter (Phase D's deferred half) — `schema.pg.ts`
  alongside `schema.sqlite.ts`, env-gated driver selection in
  `src/server/db/index.ts`. The Drizzle queries themselves are
  dialect-portable; the painful step is the column-type alignment
  (better-sqlite3 timestamps as integers vs Postgres `timestamp`).
- Stripe customer-portal link from /app/settings/billing for
  self-serve cancel + payment-method update. Gated on Phase E's
  settings route landing.
- Sentry release-tracking — set `SENTRY_RELEASE` from the deploy
  step so each release's errors group cleanly.
- Webhook idempotency keys — Stripe webhook can re-deliver the
  same event; we should dedupe by `event.id` in a small
  `processed_webhooks` table.



## Cycle 12 · 2026-05-06 · Phase A — auth got real, the workspace got walls

Until today, Tasks had a single global workspace. Every visitor saw
the same data. The "current user" was a cookie that any of five
seeded names could claim. That was a fine demo and a terrible
product. Phase A of the launch sprint replaces both — Clerk for
identity, a `workspaces` table for the per-tenant boundary, and a
9-step incremental migration so each commit was independently
shippable.

**The day-1 type call.** `UserId` was a literal union of five names
(`"chloe" | "david" | …`). Clerk hands out `user_2abcXYZ…`. We
widened `UserId = string` in one diff — 29 files touched, mostly
mechanical. `USERS` got proxied so any unknown id (Clerk or
otherwise) returns a synthetic fallback `UserMeta` with neutral
color and last-2 chars as initials. Zero callsite changes downstream
of the Proxy. The cinematic showcase keeps its frozen literal map
because that surface is fiction, not auth.

**Schema, in 9 incremental pushes.** `users` gained `clerkId UNIQUE`,
`email`, `handle UNIQUE` (the `@mention` slug — Clerk ids aren't
mentionable so we derive a handle from email-local-part). `name`
became nullable until the webhook lands. Two new tables:
`workspaces` (id, slug, name, ownerUserId, activeDomain, createdAt)
and `workspace_members` (composite-PK on workspaceId + userId, role
'owner' | 'member', cascade on delete). Six existing tables —
tasks, comments, activities, notifications, share_links,
entitlements — gained a nullable `workspaceId` FK. comp_codes stays
global on purpose: the operator mints them; the per-user redemption
is what carries the workspace.

**meta.activeDomain → workspaces.activeDomain.** The single global
key got promoted to a per-workspace column. The first-run gate now
reads "is this workspace's activeDomain null?" rather than "does
the meta key exist?" — same shape, properly scoped.

**Clerk wiring on Next.js 16.** `middleware.ts` is `proxy.ts` now;
verified in the bundled docs. `clerkMiddleware()` works as a drop-
in inside the renamed file. Public matcher covers `/`, `/about`,
`/pricing`, `/changelog`, `/students`, `/welcome`, `/share/*`,
`/redeem/*`, `/api/webhooks/*`, `/api/cron/*`, `/sitemap.xml`,
`/robots.txt`, `/sign-in/*`, `/sign-up/*`. Everything under `/app`
calls `auth.protect()`. We added a graceful dev bypass: when
`NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY` are
unset, the proxy short-circuits and `getCurrentUser()` falls back
to the legacy seed identity. Clerk's keyless mode also kicks in,
auto-provisioning dev sandbox keys so the app renders out of the
box — net effect: clone, `npm run dev`, marketing + app both
render with no env setup.

**The webhook is the contract.** `/api/webhooks/clerk/route.ts`
verifies via Svix and handles three events:
- `user.created` runs three INSERTs in a single `db.transaction(...)`:
  user row keyed by Clerk id, personal workspace, owner membership.
  Atomic on purpose — a user without a workspace breaks every
  protected route, so the trio fails together or succeeds together.
  Idempotent on `clerkId UNIQUE` / `INSERT OR IGNORE` so duplicate
  webhook deliveries replay cleanly.
- `user.updated` syncs name + email.
- `user.deleted` cascades — workspace ownership and memberships
  both cascade off the users row.

**`getCurrentUser()` rewritten.** `auth()` → Clerk userId → DB
lookup on `users.clerkId` → return internal `users.id` (which equals
the Clerk id post-Phase-A). Skipping the dual-id indirection meant
30+ callsites kept their existing string-typed signatures.

**`getActiveWorkspace()` is new and load-bearing.** Reads the
`tasks_active_ws` cookie, validates membership, falls back to the
user's first membership, falls back to `ws-legacy` for the dev path.
Every server-side read that fans out per-tenant data calls it once
at the top: `app/layout.tsx`, `app/inbox/page.tsx`, `welcome/page.tsx`,
`getTasksAction`, `addTaskAction`, `moveTaskAction`,
`toggleCompleteAction`, `reorderTaskAction`, `removeTaskAction`,
`addCommentAction`, `recordActivity`, `notify`,
`createShareLinkAction`, `redeemCompCodeAction`, `seedDomainAction`,
`clearAllTasksAction`, `markFirstRunCompleteAction`,
`compileDailyDigest`. That's the per-tenant boundary made real.

**`<UserSwitcher>` and the demo-identity stub are gone.** Five files
deleted: `src/server/actions/auth.ts`, `src/components/app/auth/user-switcher.tsx`,
the `USER_COOKIE` const, the `setCurrentUserAction` server action,
the auth context's user prop. Sidebar account chip now hosts
Clerk's `<UserButton>` — real account avatar, real sign-out, real
identity. Pure subtraction, no compat shim.

**Dev backfill stayed simple.** `seedIfEmpty` got two new INSERT
blocks: one for `ws-legacy` (slug `legacy`, owner `david`,
activeDomain null), one for the 5 seeded users as members. Tasks +
comments inserted with `workspaceId='ws-legacy'`. Idempotent guards
on every write so re-runs against an already-seeded DB don't
double up. The legacy ID is exported so other code can reference
it as a sentinel.

**Verified end-to-end (Playwright).**
- Fresh DB → `/app/board` redirects to `/welcome` (first-run gate
  reading `workspaces.activeDomain IS NULL`).
- All four domain cards render on `/welcome`.
- Click "College student" → `seedDomainAction("student")` runs
  with the active workspace inherited from cookie/membership;
  workspace's activeDomain flips to "student"; redirect lands on
  `/app/board`.
- Board shows the 5 student To-Do tasks: "Submit thesis proposal",
  "Read 3 papers for econ seminar", "Plan study group · midterms
  week", "Update notes from CS lecture", "Apply for summer
  internship". Sidebar account chip shows the Clerk `<UserButton>`.
- Zero console errors. Clerk's keyless prompt visible in the
  corner — expected, just signals the auto-provisioned dev keys.

**Subtractions**
- `src/server/actions/auth.ts` (cookie-based `setCurrentUserAction`)
- `src/components/app/auth/user-switcher.tsx` (demo identity picker)
- The `meta` table's `activeDomain` key (replaced by
  `workspaces.activeDomain`)
- `USER_COOKIE` constant + the cookie-reading branch of the old
  `getCurrentUser()`
- `DEFAULT_USER` is now an internal const, not exported

**Backlog (Phase A, deferred to next cycle's tightening)**
- `workspaceId` columns are still nullable on the per-tenant tables.
  Phase A.1 is the `ALTER … NOT NULL` push once we've audited that
  every code path writes it. (The current state is safe — every
  write does set it — we just haven't tightened the constraint.)
- Workspace-switcher UI in the sidebar top is still pending.
  Currently the user always sees their first/legacy workspace.
  When real signups create a second workspace, they'll need a
  picker.
- `users.id` for Clerk-issued users IS the Clerk id directly,
  which means a Clerk-id rotation (rare, but real) would orphan
  rows. Optional future hardening: introduce a separate internal
  uuid `users.id` and treat `clerkId` as a join key.
- Webhook needs Svix signing secret in env to actually verify in
  production. Dev mode skips verification with a console.warn.

## Cycle 11 · 2026-05-05 · The Big Pivot — five phases, two encore requests, one cycle

A heroic cycle. The user walked in with a Project Handoff Document
that quietly torched our existing audience strategy: forget enterprise
teams, build for the actual humans nobody else builds for — students,
freelancers, event planners, anyone with a checklist and no patience
for sprint ceremonies. New product philosophy: "ultra-low barrier to
entry, zero friction, high dopamine." Five phases. Then mid-cycle they
asked for two more things on top — per-task conversation history, and
an /about page that reads like a manifesto. All seven shipped in one
autonomous run. Buckle up.

**Phase 1 — Choose-your-adventure landing + actually useful empty states**

The pitch had to land instantly: this tool is for *you*, whatever you
do. We built four domain "packs" (`marketing`, `student`, `freelance`,
`event`) in `src/lib/domains.ts`. Each one overlays the canonical
16-task seed structure — same task IDs, same lane positions, same
timeline geometry, so the cinematic demo's scripted scenes still
work — but swaps every visible surface: titles, tags, workspace name,
URL chrome, seed comment bodies, even an empty-state headline. Click
"College student" and the demo's "Audit pricing page conversion
funnel" becomes "Submit thesis proposal." Click "Event planner" and
suddenly the workspace is "Hartwell Wedding · 6.14.26."

The new `<DomainToggle>` (marketing) is a pill row with a
LayoutGroup-driven sliding indicator. The demo container is keyed by
domain so AnimatePresence cross-fades between flavors over 360ms —
the swap *feels* like a domain change, not just a string update.
`cinematic-demo.tsx` accepts a `domain` prop now; what used to be
hardcoded scene references ("Audit pricing page", "Latest features
email", "Sales sync → Demo video") now look up the live task title
at scene-fire time, so the activity feed reflects whichever domain
is active.

Backend earned its keep: `seedDomainAction(domain)` in
`src/server/actions/seed.ts` truncates `tasks`/`comments`/`activities`,
re-seeds with the overlay, and stamps the domain choice into a new
`meta` key-value table. `clearAllTasksAction` is its symmetric twin.
The hero "Try this template in your workspace" button calls it and
routes the user straight into `/app/board` — they end the click on
their own data, not a demo.

The persisted domain choice flows through a new `<DomainProvider>`
(`src/lib/domain-context.tsx`) mounted in `/app/layout.tsx`.
`AppPageHeader` and `<AppSidebar>` consume `useDomain()`, so the
workspace breadcrumb, H1, and the user-team pill all flex with the
chosen domain. Seed event-domain data → header reads "Events ›
Hartwell Wedding · 6.14.26" and the sidebar account chip says "David
Park / Events." It feels like one product across four lives.

Empty states got the same care. The previous behavior on a freshly-
cleared workspace was a depressing blank canvas. Now we render
`<EmptyStateOverlay>`: a faded structural ghost of the actual view
behind a radial-fade overlay, with a headline ("This is where your
master plan goes."), a body, the primary "Add your first task" CTA
keyboard hint, and four inline starter-pack chips that fire
`seedDomainAction` directly. The four ghosts (`<BoardGhost>`,
`<ListGhost>`, `<TimelineGhost>`, `<CalendarGhost>`) are tiny
silver-pencil sketches of their respective views, filled with
placeholder rows / cards / bars / cells in low-opacity neutrals.
Empty doesn't mean nothing-to-show; empty means "here's what this
will look like the moment you start."

**Phase 2 — Killing the jargon, building the dopamine**

The directive was clear: cut enterprise vocabulary. The audit was
mercifully short — most of the app already speaks plainly. We caught
two stale code comments (`panel-header.tsx` calling task IDs "ticket
ids", `demo-surface.tsx` calling the timeline a "gantt") and cleaned
them up. App-level labels were already in good shape; the only
"Sprint" / "Epic" hits were inside seed task titles, which are user
content, not labels. We left those alone — a real freelancer might
genuinely have "Sprint review w/ Bramwell team" on their plate.

Then the fun part. `<DopamineCheck>` (`src/components/app/done-dopamine/`)
is the new completion primitive — a round button (round, not square;
roundness is what makes the pop feel like a click). On the
open→done transition: spring-pop scale 1→1.18→1, the fill flips green,
the ✓ glyph stroke draws in over 220ms, and a six-dot radial burst
(alternating emerald and brand) explodes outward and fades over
620ms. Self-contained. No portal. No framework wizardry. It just
feels good.

`<DoneTitle>` is its quieter partner — animates the title color from
`--ink` to `--ink-quiet` and draws a left-to-right strikethrough via
scaleX (CSS `text-decoration` famously refuses to animate, so we
fake it with a 1.2px gradient line). Both run in lockstep on the
click. Wired into list-app and my-tasks-app rows; the old inline
checkboxes are gone.

**Phase 2.5 — Conversation history (mid-cycle user request)**

User mid-cycle: "i also want to add conversation history to each
task." The detail panel had been rendering Activity and Comments as
two separate stacked sections. We collapsed them into one
chronological feed — Linear/GitHub-style — because that's what
"conversation history" actually is.

New `getTaskConversation(taskId)` in `queries.ts` unions `comments`
+ `activities` as a discriminated `ConversationItem` union and
sorts by createdAt ascending. New `<ConversationFeed>` renders
comments as full quoted blocks (22px avatar, name + relative time,
body) and activity rows as one-line system messages (14px avatar +
sentence, quieter color). Composer at the bottom. Optimistic
add/remove with `temp-` ids; reconciles after the server response.

The cleanup was satisfying. Old `<CommentThread>` and `<ActivityFeed>`
detail-panel files deleted. Their `useTaskComments` /
`useTaskActivities` hooks deleted. The `getActivitiesForTaskAction`
server action deleted. Pure subtraction, no compat shim — exactly the
kind of cleanup the user's preference forbids backwards-compat hacks
for.

**Phase 3 — Zero time-to-capture: writing English instead of filling forms**

Installed `chrono-node` and built `parseTaskInput(raw)` in
`src/lib/nlp/parse-task-input.ts`. The parser uses
`chrono.parse(input, new Date(), { forwardDate: true })`, takes the
rightmost match (so trailing "by next Friday" forms keep the leading
verb intact), and strips the date span plus a preceding
"by"/"on"/"at"/"due"/em-dash lead-in. Returns
`{title, dueAt, dueLabel}`. The companion `formatDueLabel(d, withTime)`
produces tight chip-friendly text: "Today" / "Tomorrow" / "Fri 3pm" /
"Mar 14" / "Mar 14, '27." Tabular nums, no jitter.

Schema gained a structured `tasks.due_at` timestamp column running
parallel to the existing human `due` text label. `Task.dueAt?: Date`.
`addTaskAction` accepts and persists both. The structured datetime
unlocks the digest cron's "due in next 24h" filter (Phase 5) without
re-parsing the human label every read.

`<QuickCreateDialog>` parses on every keystroke. The moment chrono
detects a date phrase, an inline preview pill slides in beneath the
input with the cleaned title and a brand-soft "Due May 15 3pm" chip.
The user sees what the parser is going to do *before* they press
Enter — no surprise, no "oh wait, that's not the title I meant." The
dialog placeholder is also dynamic now, pulling
`pack.firstTaskExample` from the active domain ("Submit thesis
proposal by next Friday" for students, "Send Q2 invoices to all
clients tomorrow" for freelancers). `<InlineComposer>` (per-lane)
runs the same parse on submit with a smaller chip-only preview.

Verified end-to-end: typed "Finish thesis draft by next Friday at
3pm" → preview pill rendered "Finish thesis draft" + "Due May 15
3pm" → submitted → DB row landed with `title="Finish thesis draft"`,
`due="May 15 3pm"`, `due_at=1778853600` (= May 15 at 22:00 UTC, which
is 3pm Pacific). Chrono is doing actual work.

**Phase 4 — Magic Link guest sharing**

This phase is the one the marketing engine will love. Schema gained
a `share_links` table (token PK, view, createdAt, optional revokedAt)
and `createShareLinkAction(view)` mints a 16-char URL-safe token. The
read-only resolver `resolveShareLink(token)` lives in `queries.ts`
(server-only — not an RPC, since `/share/[token]` fetches it during
SSR).

The header `<ShareButton>` opens a popover. First click "Generate
magic link" mints a fresh token, then renders the URL with a
copy-to-clipboard button (a 1.1-second "Copied" emerald flash on
success) and a "Preview as guest" link that opens the share URL in a
new tab. The token is durable per-session; "revoke" lives as a
backlog item.

The `/share/[token]` route renders the workspace as a guest sees it:
no sidebar, minimal top chrome with the workspace breadcrumb, a
"Read-only · Shared link" pill, and a "Make this yours" CTA back to
`/app/board`. `<ShareBoard>` is visually identical to `<BoardApp>`
minus the drag handlers and the inline composer.

The cleverer bit is `<GuestAuthProvider>` + `useGuestAuth`. Every
interactive surface on the share view (task card click, "Add task"
button, the implicit edit affordances) routes through
`promptSignUp(reason)`. When `isGuest` is true, this raises a
reason-aware modal with stubbed "Continue with email" / "Continue
with Google" buttons + a "Keep browsing as a guest" dismissal.
Reasons: `edit | comment | addTask | complete | share`. Outside guest
context the hook short-circuits to a no-op so the same call sites
are safe in `/app/*` without conditional logic. Same component tree,
two modes.

Verified: clicked Share → Generate → got
`http://localhost:3001/share/61c1c32269f94f2c`. Visited as guest:
read-only board with the workspace chrome, no sidebar. Clicked "Add
task" — progressive auth modal popped with the right copy: "Sign up
to add tasks. You're viewing a shared workspace…"

**Phase 5 — The anti-notification engine (or: how to not spam the user)**

This was a stance, not just a feature. Schema gained a `notifications`
table with id PK, userId, kind, optional taskId FK (cascade), JSON
payload, createdAt, optional readAt. The `Notification` type's
discriminated union covers `mention | blocked | dueToday`.

The policy is enforced in code, not configuration:
- `src/server/db/notifications.ts` exposes `notify(userId, payload)`,
  server-only, self-mentions skipped (the smartest people still
  forget this).
- `addCommentAction` is the only mutation that calls `notify`. It
  runs `extractMentions(body)` — a regex that catches `@<word>`,
  lowercases it, and filters against the canonical USERS set so
  random `@stuff` doesn't fire spurious pings. For each valid
  mention, one notification row.
- `moveTaskAction`, `toggleCompleteAction`, `updateTaskAction`,
  `addTaskAction`, `removeTaskAction` — none of them call `notify`.
  Lane moves, status flips, simple field edits produce activity
  rows (already in the conversation feed) but never pings. Comments
  without @mentions also produce nothing. They live in the
  conversation feed and surface in the daily digest only if the
  recipient was tagged.

The other half is `compileDailyDigest(userId)` in
`src/server/db/daily-digest.ts` — a pure read function returning
`{ completedYesterday, dueToday, mentions }`. `dueToday` filters by
`assignees LIKE '%"<userId>"%'` AND `dueAt` between now and
now+24h. `mentions` scans the activity log for `commentAdd` snippets
containing `@<userId>`. While we were here we hoisted `rowToTask`
out of `queries.ts` into a shared `src/server/db/row-mappers.ts` so
the digest can reuse it without a circular import.

The new `/app/inbox` route renders the policy as UI. Two surfaces:
- **Daily digest** — two cards (Closed yesterday / Due today) plus a
  brand-soft "Mentioned in the last 24h" callout when present. The
  preview is exactly what the morning email *would* send; no second
  source of truth.
- **Direct alerts** — list of unread instant pings, or — 95% of the
  time — the empty state: "Inbox zero. Quiet here on purpose." with
  a bell glyph. The copy reinforces the policy: "We only insert
  here for direct @mentions and blocks. Lane moves, status flips,
  simple edits — none of it. Read once, move on."

`/api/cron/digest` returns the digest as JSON for any external
scheduler (Vercel Cron, GitHub Actions, a CI job). `?user=<id>`
overrides default CURRENT_USER for testing. The contract: this is
the ONLY scheduled outbound channel. When email actually wires up,
the swap is at the vendor edge — the policy decisions stay here, in
code.

`AppPageHeader` learned about inbox: breadcrumb "Personal › Inbox",
title "Inbox", Share button hidden, view tabs hidden — inbox isn't
a workspace view, it's its own thing.

End-to-end verification was the satisfying part. David posted
`@chloe can you double-check the run-of-show timing?` on t-202. DB
inspection confirmed exactly one notifications row inserted —
`user_id=chloe`, `kind=mention`, payload with the snippet, taskId,
from, taskTitle. `GET /api/cron/digest?user=chloe` returned a digest
with `mentions: [{ from: "david", taskTitle: "Day-of timeline ·
run-of-show", snippet: "@chloe can you…" }]`. Zero notifications for
all the lane moves and toggle-completes that happened during testing.
The dam holds.

**Phase 4.5 — About manifesto (mid-cycle user request)**

User mid-cycle: "i also want an about us link in the footer that
talks about how project management dodesnt need to be behnind a
paywall or a knowledge gap, wherther its sprints/epics issues etc we
cut out all that bullshit and make project management accesible to
everyone."

We were ready for this one — the whole cycle had been building toward
it. New `/about` route + `<AboutManifesto>` component. The hero says
the quiet part loud: "Project management shouldn't be behind a
paywall." The visual centerpiece is a card listing ten enterprise PM
phrases — sprint planning, epic refinement, ticket triage, gantt
cascades, OKR alignment, the whole liturgy — each animating a
left-to-right strikethrough on scroll-into-view, with `tasks`
rendered as the surviving emerald chip on the right. It reads as the
manifesto in three seconds.

Three body sections follow: "You don't need a vocabulary. You need a
list." (the thesis). "Built for whoever shows up." (renders the four
domain packs as cards — same content surface, different
presentation). "What we promise." (numbered: free where it counts,
no vocabulary tax, looks like the work, out of your way). Closes
with a "Plain English" callout: *"Write down what you have to do.
Look at it the way that helps. Cross it off. That's the whole
product."* and a CTA to `/app/board`.

Footer "About" link rewired from `#` to `/about`.

**End-to-end verification (Playwright + DB inspection)**
- Domain toggle on landing: clicked College student → demo workspace
  title became "Spring semester · Junior year", URL chrome became
  "tasks.app/me/school", all 16 task titles became student-flavored,
  comment thread typed "Group's meeting at the library tonight at
  7 📚", activity feed references all updated.
- "Try template" CTA: seeded the DB with student data, routed to
  `/app/board`, board rendered with student tasks live.
- Empty states: SQL-truncated tasks, navigated to all four views —
  each rendered the faded ghost overlay + headline + starter-pack
  chips. Clicking "Event planner" on the calendar empty state
  reseeded the DB with wedding-flavored data; calendar immediately
  filled with vendor sync / catering / florals etc.
- Page header & sidebar: pulled from the persisted
  `meta.activeDomain` row. Workspace H1 read "Hartwell Wedding";
  sidebar pill said "David Park / Events" after seeding the event
  domain. The whole shell flexes.
- Done Dopamine: clicked checkbox on a list row — task moved to
  Done lane, count incremented, button aria-pressed flipped to
  true. Re-opened the now-done task; conversation feed showed the
  new "DV David marked this complete · just now" activity row
  interleaved beneath the three seeded comments.
- NLP date parse: typed "Finish thesis draft by next Friday at 3pm"
  → live preview pill ("Finish thesis draft" + "Due May 15 3pm") →
  submitted → DB confirmed `title="Finish thesis draft"`, `due="May
  15 3pm"`, `due_at=1778853600`.
- Magic link: clicked Share → Generate → URL minted. Visited as
  guest: read-only board, no sidebar, "Read-only · Shared link"
  pill in the header. Clicked "Add task" — progressive auth modal
  popped with reason-specific copy.
- @-mention: David posted "@chloe can you double-check the run-of-
  show timing?" on t-202. `notifications` row appeared
  (user_id=chloe, kind=mention). `GET /api/cron/digest?user=chloe`
  surfaced the mention. No notifications for any of the lane moves
  or toggle-completes that happened in testing.
- About: `/about` rendered with the strikethrough block animating
  on scroll-in, four domain cards, four numbered promises, and
  the closing CTA card.
- 0 TS errors, 0 console errors throughout.

**What we deleted (unprompted but earned)**
- `src/components/app/detail-panel/comment-thread.tsx`
- `src/components/app/detail-panel/activity-feed.tsx`
- `src/lib/tasks/use-task-comments.ts`
- `src/lib/tasks/use-task-activities.ts`
- `src/server/actions/activity.ts`

All five replaced by the unified Conversation feed. No deprecation
period. No "// removed" comment. They're just gone.

**Backlog (the cuts made under deadline)**
- Real auth replaces `CURRENT_USER`. The magic-link auth modal's
  "Continue with email" / "Continue with Google" buttons currently
  just dismiss — they'll wire to a real provider later.
- The digest endpoint is JSON-only; an actual cron scheduler +
  transactional email integration is the swap-in. The policy is
  here; the delivery is not.
- `compileDailyDigest.completedYesterday` is currently team-wide.
  Fine for a 5-person workspace; spammy at 50. Future cycle:
  narrow to "tasks the user touched."
- Multi-tab realtime sync (cycle 5 backlog) still pending.
- Per-lane draft preservation in QuickCreateDialog (cycle 7
  backlog) still pending.
- The `meta` table is currently a single key/value bag. If it
  picks up more keys (notification config, share defaults), it
  gets a typed accessor layer.
- `Notification.kind = "blocked"` is wired in the schema and type
  but never inserted — waiting on the dependency UI to migrate
  from the cinematic demo into the live app.
- Magic-link revocation: minted tokens are durable forever right
  now. UI for "revoke this link" is one cycle away.



## Cycle 10 · 2026-05-05 · My tasks route + real comment counts

Two app-accuracy gaps closed. (a) Sidebar's "My tasks" link
pointed to a nonexistent route; the badge counted *all* open
tasks, not the current user's. (b) Cards displayed a `comments`
integer, but it was a stale seed field that didn't track adds via
the panel.

**Backend changes**
- Schema: dropped `comments` integer column from `tasks` (it was
  never written by any mutation — pure seed fiction). drizzle-kit
  push handled `ALTER TABLE DROP COLUMN`. Existing data preserved.
- `_SchemaCoversTask` guard widened to `Omit<Task, "comments">`
  since the field is now derived, not persisted.
- `getTasks` rewritten with a correlated subquery —
  `(SELECT COUNT(*) FROM comments WHERE comments.task_id = tasks.id)
  as comment_count`. `rowToTask` maps `0 → undefined` so existing
  truthy-check renderers keep hiding the chip on zero.
- New `getTasksForUser(userId)` query — same shape with
  `WHERE assignees LIKE '%"<userId>"%'` (JSON-as-text token match).
- SEED_TASKS literals stripped of `comments: <n>` fields (5 occurrences).
- New `groupTasksByLane(tasks)` selector overload accepting an
  array; existing `groupByLane(state)` delegates.
- `openTaskCount(state, opts?: { user })` — optional user filter.

**Frontend changes**
- New `src/app/app/my-tasks/page.tsx` — server component shell.
- New `src/components/app/my-tasks/my-tasks-app.tsx` — list view
  scoped to `assignees.includes(CURRENT_USER)`. Reads from the
  shared store (preserves optimistic updates + panel integration).
- `AppPageHeader` now derives breadcrumb + title from pathname:
  `Personal › Assigned to me / My tasks` for `/app/my-tasks`.
- Sidebar splits the count by icon: Inbox uses global
  `openTaskCount`, My tasks uses the user-scoped version.
- `TasksProvider` gains a hydrate-on-prop-change effect so when
  `revalidatePath('/app', 'layout')` fires after a comment add,
  the fresh server-fetched `initialTasks` (with updated counts)
  reconciles into the client store via a `hydrate` dispatch.

**Verified end-to-end**
- Navigated `/app/my-tasks` — list renders David's 4 tasks
  grouped by lane (TO DO 1, IN PROGRESS 2, DONE 1).
- Sidebar shows distinct counts: Inbox 14 (all open), My tasks 3
  (David's open, excluding the done task).
- Done task shows green check + line-through.
- 0 TS errors, 0 console errors.

**Backlog**
- Inbox route still placeholder (separate cycle — needs a clearer
  notion of "inbox" than just "all open tasks").
- Server-side filter UI (lane / priority / assignee dropdowns).
- Real auth replaces `CURRENT_USER` constant.



## Cycle 9 · 2026-05-05 · Activity log — turn updatedAt into a story

The detail panel's Activity section rendered three hardcoded
placeholder lines. Cycle 8's "edited 3h ago" stamp was a single
integer. This cycle turns every server-side mutation into a typed,
persisted activity row, and the panel renders them as a real feed.

**Backend changes**
- New `activities` table — id PK, taskId FK cascade, userId FK,
  kind text, payload JSON, createdAt timestamp. `_SchemaCoversActivity`
  guard.
- `Activity` type with discriminated `ActivityPayload` union over
  `kind`: `taskAdd | move | toggleComplete | update | commentAdd
  | commentRemove`. Each payload variant carries the data needed
  for line rendering (e.g. `move` has `from` + `to`; `commentAdd`
  has a 60-char `snippet` so deleted comments still surface).
- New `recordActivity(taskId, payload)` helper at
  `src/server/db/activity.ts` — server-only utility (NOT a
  `"use server"` action). Catches and console.warns on failure;
  activity is observability, not transactional.
- `getActivitiesForTask(taskId)` query — desc by createdAt,
  limit 50.
- `getActivitiesForTaskAction` server-action wrapper for
  client-driven reads.
- Wired emissions into every mutation point:
  - `addTaskAction` → `taskAdd` with default lane
  - `moveTaskAction` → pre-reads prior lane, emits `move {from,to}`
  - `toggleCompleteAction` → emits `toggleComplete {to: done|open}`
  - `updateTaskAction` → emits ONE `update` PER tracked field
    changed (concurrent via Promise.all). Untracked fields like
    `idleDays` skipped.
  - `removeTaskAction` → no activity (cascade kills them anyway)
  - `addCommentAction` → emits `commentAdd` with snippet
  - `removeCommentAction` → emits `commentRemove`

**Frontend changes**
- New `src/lib/tasks/use-task-activities.ts` — read-only hook
  mirroring `useTaskComments` (no client mutation; activities
  are byproducts).
- New `src/components/app/detail-panel/activity-feed.tsx`:
  - 16px avatar (smaller than 22px comments — size IS the signal
    of "supporting content"; ~85% scale)
  - Single-line rows: actor name (`font-medium text-ink`) +
    sentence (`text-ink-soft`) + relative time (`tabular-nums
    text-ink-quiet`)
  - `formatActivityLine(payload)` switch with opinionated
    microcopy: "moved this from To do to In progress",
    "marked this complete", "edited the description",
    "commented", etc.
  - Empty state: single line "No activity yet."
- `task-detail-panel.tsx` now fetches activities alongside
  comments, both keyed on `[task?.id, task?.updatedAt?.getTime()]`
  so any mutation refreshes the feed automatically.
- Static `ActivityPlaceholder` removed; `ActivitySkeleton`
  introduced for loading state (2 rows, 16px circle + single
  pill bar — quieter than the 2-line comment skeleton).

**Verified end-to-end**
- Edited description on `t-202`, queried DB:
  `update | {"kind":"update","field":"description"}` row landed
  with current timestamp. Description value persisted to column.
  0 console errors. Type-clean.

**Backlog**
- Activity for assignee changes / tag changes currently renders
  as generic "updated assignees" / "updated tags" because we
  don't diff arrays this cycle. Specific copy ("assigned Chloe",
  "tagged design") needs payload extension (before/after) — later.
- "Show more" pagination for tasks with >50 activities.
- Cross-task feed (e.g. "what changed today") — useful when more
  than one user exists.



## Cycle 8 · 2026-05-05 · Editable description + last-edited stamp

The detail panel rendered an outdated "placeholder paragraph" in
its Description section (referencing cycle 6 plans that already
shipped). Cycle 7 added the column; cycle 8 makes it real, and
audits `updatedAt` so the panel can carry an "edited X ago" stamp
that reflects every kind of activity (lane moves, comments, field
edits).

**Backend changes**
- `bump()` audit: `addTaskAction` now sets `updatedAt` explicitly
  for symmetry; column default still safe-net.
- `addCommentAction` and `removeCommentAction` now touch the parent
  `tasks.updatedAt` via a new `touchTask(taskId)` helper. Comments
  count as engagement.
- `Task.updatedAt: Date` (non-nullable). `rowToTask` surfaces it.
- `SEED_TASKS` literals refactored into `_seedTaskInputs:
  Omit<Task, "updatedAt">[]` then mapped with staggered timestamps
  (`Date.now() - i * 3_600_000`) so the seed renders as a realistic
  "edited Nh ago" gradient on first boot.
- Reducer `update`, `move`, `toggleComplete` cases now bump
  `updatedAt` optimistically so the stamp doesn't lag the UI.

**Frontend changes**
- New `src/components/app/detail-panel/description-editor.tsx`:
  - At-rest: `<p>` with `whitespace-pre-wrap`, 13.5px/1.6
    `text-ink-soft`, NO outline (multi-line + outline = form
    field carnival, against the panel's "document not form" tone).
  - Editing: bare `<textarea>` (no frame), same size/leading as
    at-rest so the swap is sub-pixel. Autoresize via scrollHeight.
    Multi-line is the mode — Enter inserts newline; commit only
    happens on blur or Esc-revert.
  - Empty state: `"Add a description."` (sentence case + period —
    finished sentence, not button label) in `text-ink-faint`.
    Full-section click target. Cursor `text` (I-beam).
  - Hover: `text-ink-soft → text-ink` over 120ms — color promotion
    is the affordance, no glyph, no border.
  - Caret behaviors: click → at click position, keyboard entry →
    end of existing text (the "oh, one more thing" 80% case),
    empty prompt → position 0.
- `panel-header.tsx` — new `<EditedStamp>` rendered beside the
  `T-101` chip in the meta row, separated by a middle dot.
  `text-[10.5px] tabular-nums text-ink-quiet`. Format
  `"edited 3h ago"` (lowercase verb prefix; "3h ago" alone is
  ambiguous). Hidden if mutation < 5s ago. **Mounted-state pattern**
  to avoid SSR hydration mismatch between server and client clocks.
- Old static `<Description />` stub removed.

**Looped back to BUILD once**
- First TEST surfaced a hydration mismatch: server-rendered
  `formatRelativeTime` and `toLocaleString` produced different
  output than the client (clock skew + locale defaults). Fix:
  `EditedStamp` defers all rendering until `useEffect` flips
  `mounted = true` so server emits nothing, client hydrates to
  the actual stamp.

**Verified end-to-end**
- Opened `?task=t-202`, clicked "Add a description.", typed
  "Final cut review with director on Mon. Embed link.", tabbed
  away. DB row's `description` column reflects the typed value.
  0 console errors after the hydration fix.



## Cycle 7 · 2026-05-05 · Add-task flow + description column

Every "+ Add task" / "+ New task" button literally did nothing.
Until the user can create their own tasks, the app is a fancy
viewer of seeds. This cycle ships two complementary creation
surfaces and lays the description column groundwork for cycle 8.

**Backend changes**
- `tasks.description: text` column (nullable). `drizzle-kit push`
  ALTER TABLE non-destructive on existing rows.
- `Task.description?: string` and `rowToTask` mapper coerces NULL
  to undefined.
- `addTaskAction` accepts and persists `description`.
- `_SchemaCoversTask` guard catches type-vs-schema drift.

**Frontend changes**
- `src/components/primitives/dialog.tsx` — reusable dialog
  primitive. Portal'd to body, Esc/click-outside close, focus
  first input + restore prior focus on close, role/aria-modal/
  labelledby. Centered, scale 0.96 → 1 + Y 6 → 0 over 260ms
  ease-out-expo. Reduced-motion: opacity-only 120ms.
- `src/lib/use-keyboard-shortcut.ts` — generic shortcut hook,
  skips when target is editable, when modifiers are held, or
  when explicitly disabled.
- `src/components/app/add-task/`:
  - `add-task-context.tsx` — `<AddTaskRoot>` provider exposing
    `{open, openDialog, closeDialog}`. Mounts the dialog. Binds
    `c` shortcut globally (preventDefault on keydown so the
    keystroke doesn't bleed into the about-to-mount input).
    `openDialog` first calls `closeTask()` so dialog and detail
    panel never stack.
  - `quick-create-dialog.tsx` — 480px centered modal. 17px input
    "Name a task", default "To do" lane chip, `⏎ Create` kbd
    hint. Empty Enter is silent no-op (kbd hint dims `ready` →
    `empty`). On submit: dispatches `addTask`, clears, closes.
  - `inline-composer.tsx` — bare input on lane background (no
    card affordance — reserved for *real* tasks). 220ms ease-
    out-expo height-from-zero entry. Placeholder "What's next?".
    Enter creates and refocuses; Esc cancels; blur with empty
    cancels.
- `BoardApp` tracks at-most-one-open via `composerLane: LaneId | null`.
- `AppPageHeader` "New task" button gains a `C` kbd badge and
  fires `openDialog`.
- `/app/layout.tsx` mounts `<AddTaskRoot>` inside `<TasksProvider>`
  under the existing Suspense boundary.

**Caught during TEST (looped back to BUILD)**
- Initial implementation exposed an `onDraftChange` callback to
  preserve per-lane drafts across re-opens; the unmemoized callback
  identity caused a setState/useEffect infinite loop. Fix: dropped
  the draft-preservation feature for this cycle (logged to
  backlog). Quality gate held — re-tested with 0 console errors.

**Verified end-to-end**
- "+ New task" header button → dialog opens → typed "Created
  from cycle 7 dialog" → Enter → card visible in To do lane →
  DB row persisted (`t-8b065801`).
- Lane "+ Add task" → input focused → typed "Created from
  inline composer" → Enter → card visible → DB row persisted.
- 0 TS errors, 0 console errors.

**Backlog**
- Per-lane draft preservation across re-opens (lost in the
  infinite-loop fix; needs a stable callback pattern via ref).
- Lane / priority pickers in the dialog beyond defaults.
- Title auto-parser (`#tag`, `@user`, `p1`, `due:friday`).



## Cycle 6 · 2026-05-05 · Real comments — first full-stack feature

The detail panel rendered a static deterministic-from-id seed thread
that looked live but wasn't. This cycle replaces it with a real
thread that persists, optimistically renders, and posts via a server
action — the first full-stack feature on the new persistence
substrate. Sets the pattern every "thing that happens on a task"
(activity, mentions, attachments) will follow.

**Backend changes**
- New `Comment` type and `CURRENT_USER` constant in `src/lib/data.ts`.
  `SEED_COMMENT_BODIES` lifted from the static thread file so server
  seed and any future fixtures share one source.
- Schema gains `_SchemaCoversComment` compile-time guard mirroring
  the existing `_SchemaCoversTask` check.
- `getCommentsForTask(taskId)` query in `src/server/db/queries.ts`
  with `rowToComment` pass-through mapper.
- Seed extends to insert ~3 comments per task using deterministic
  hash → user/body picks; `createdAt` staggered so the order reads
  as a real conversation. Independent count check so existing
  comments don't get clobbered.
- New `src/server/actions/comments.ts` —
  `getCommentsForTaskAction`, `addCommentAction`, `removeCommentAction`.
  Each returns the full reconciled `Comment[]` for the task.
  `revalidatePath('/app', 'layout')` after writes.

**Frontend changes**
- New `src/lib/tasks/use-task-comments.ts` — optimistic +
  reconcile hook with `useTransition`. Optimistic comments use
  `temp-<uuid>` ids so removes that haven't reached the server are
  pure local-only.
- New `formatRelativeTime` util — `just now` / `3m` / `2h` /
  `yesterday` / `May 2` / dated. `tabular-nums` so digits don't
  dance.
- `comment-thread.tsx` rewritten:
  - Bare `<textarea>` composer (no frame, no rounded-input shape)
    with autoresize, Enter-to-post (Shift+Enter newline),
    `⏎` kbd hint that becomes a brand-color spinner while pending.
  - Each row reveals a hover-only X for own comments;
    optimistic delete with revert on failure.
  - Empty state: pure type, two lines.
- `task-detail-panel.tsx` fetches comments per task via a
  client-side `useEffect` calling the server action with a
  stale-fetch guard. Shows a 2-row static skeleton during fetch.

**Verified end-to-end**
- Posted "Verified end-to-end from the loop test" via the
  composer; comment renders immediately (optimistic), then
  reconciles with server-truth; row visible in DB query.
- Existing seed shows real authors with relative timestamps.

**Backlog**
- Concurrent multi-user comment updates — current impl re-syncs
  only on panel re-open. SSE / polling channel later cycle.
- Toast UX for server-action failures (still console-warn).
- Comment editing — explicit out-of-scope.



## Cycle 5 · 2026-05-05 · DB foundation — persistence appears

First cycle under the new full-stack directive. Every mutation
previously lived in memory; reload reset state. This is the
foundation that lets every subsequent feature actually persist.

**Backend changes**
- New deps: `drizzle-orm`, `better-sqlite3`, `drizzle-kit` (dev),
  `@types/better-sqlite3`, `tsx`.
- `drizzle.config.ts` at repo root; SQLite dialect, schema at
  `src/server/db/schema.ts`.
- Schema: `tasks`, `users`, `comments` tables. JSON columns
  (`mode: 'json'`) for `assignees`, `tags`, `blockedBy`. `text` with
  TS `$type<>` narrowing for `lane`/`priority`. Comments table has
  FK cascade on task delete; empty this cycle (table-only).
- `src/server/db/index.ts` — singleton via `globalThis._sqlite` so
  HMR doesn't spawn duplicate handles. WAL journal mode.
  `import "server-only"` enforces server boundary.
- `src/server/db/seed.ts` — idempotent transaction-wrapped seed
  from `SEED_TASKS` + `USERS`. Auto-runs on first DB-touching
  request; re-runnable via `npm run db:seed`.
- `src/server/db/queries.ts` — `getTasks()`, `getTaskById()` with a
  `rowToTask` mapper that NULL→undefined coerces (the client `Task`
  type uses optional, not nullable).
- `src/server/actions/tasks.ts` — `moveTaskAction`,
  `toggleCompleteAction`, `updateTaskAction`, `addTaskAction`,
  `removeTaskAction`. Each returns the full `Task[]` for one
  round-trip reconciliation. `revalidatePath('/app', 'layout')`
  after every mutation.
- New scripts: `db:push`, `db:check`, `db:seed`. `dev` chains
  `drizzle-kit push --force && next dev` for zero-touch cold-start.
- `tasks.db*` files added to `.gitignore`.

**Frontend changes**
- `src/lib/tasks/tasks-reducer.ts` — added `hydrate` action so the
  client can replace its task list with the server's authoritative
  result after a mutation.
- `src/lib/tasks/tasks-context.tsx` — dispatchers now do optimistic
  + reconcile via `withServerSync()`: dispatch local action for
  snappy UI, fire server action in `startTransition`, hydrate on
  success, revert via `hydrate(prior)` on failure. Console-warn on
  revert (toast UX arrives with the toast primitive).
- `src/app/app/layout.tsx` — now `async`, `await getTasks()`,
  passes server-fetched tasks to `<TasksProvider initialTasks={...}>`.
  `export const dynamic = 'force-dynamic'` so build doesn't try to
  prerender against an empty DB.
- ID generation moved from a module counter to `crypto.randomUUID()`
  per cycle 3 backlog item.

**Verified end-to-end**
- Toggle "Audit pricing" complete on `/app/list` → DB row is
  `lane='done'` → reload `/app/board` → card renders under Done.

**Backlog**
- `toggleCompleteAction` always sends to "todo" when un-checking
  (no server-side previousLane). Client reducer still has the map
  so optimistic UI behaves correctly; server hydrate creates
  micro-jitter only when un-toggling a task that wasn't originally
  in todo. Reunify in cycle 6.
- Two-tab staleness — server `revalidatePath` doesn't notify other
  tabs. SSE / polling channel later.
- Drizzle migrations workflow (currently `db:push` only).
- Toast UI for server-action failures (currently console-warn).



## Cycle 4 · 2026-05-05 · Task detail panel

Cards on every app view were read-only billboards. Click did nothing.
Until clicking a card opened *something*, every future feature
(comments, AI nudges, dependencies) had nowhere to live. This cycle
turns cards into hyperlinks.

**Added**
- `src/lib/tasks/use-task-panel.ts` — URL-driven open/close hook.
  `?task=<id>` opens the panel; absence closes. Uses native History
  API so browser-back closes for free.
- `src/components/app/detail-panel/` — slide-in panel with field
  editors:
  - `panel-shell.tsx` — overlay + slide animation + ⎋ handler.
    Spring-physics rejected per design rec; 480ms ease-out-expo
    feels working-surface, not toy.
  - `panel-header.tsx` — clickable monospace task ID with
    copy-on-click ("T-101 → copied" 1.1s flash); title input
    (blur to commit, Enter commits, Esc reverts).
  - `field-rows.tsx` — Status (segmented row, always visible
    because most-changed), Priority (popover), Assignees (avatar
    stack with "+" → user picker popover), Due (text input),
    Tags display.
  - `popover.tsx` — primitive with click-outside + ⎋ to dismiss.
  - `comment-thread.tsx` — deterministic seed thread per task
    (hash of id picks user/body/time consistently across opens).
- All four app views wire `onClick` on their card primitives.
  Selected card gets a `var(--brand)` outline at -1 offset; no
  desaturation of others.

**Changed**
- `/app/layout.tsx` mounts `<TaskDetailPanel>` under `<Suspense>`
  per Next 16 `useSearchParams` SSR rules. Panel survives view
  switches (lives in layout, not page).
- List checkbox now `e.stopPropagation()`s so it doesn't open the
  panel while toggling complete.
- Calendar pills became `<button>`s with `min-h-[28px]` for
  touch-friendly hit area.

**Notes**
- This is the last frontend-only cycle under the prior directive.
  Subsequent cycles ship full-stack per the new directive.
- Backlog: stale-id state currently shows briefly before auto-
  closing — UX is acceptable but could improve in cycle 6.



## Cycle 3 · 2026-05-05 · Shared task store — make the app real

Until this cycle, every app route owned its own copy of `SEED_TASKS`
and mutated locally. Drag a card on board, switch to list — still in
its old lane. Four views, four apps. This was the foundational move
that turns "designed views" into "an app."

**Added**
- New `src/lib/tasks/` directory with three pure-ish modules:
  - `tasks-reducer.ts` — pure reducer + types. Actions: `move`,
    `reorder`, `update`, `add`, `remove`, `toggleComplete`. The
    `toggleComplete` action keeps a `previousLane` map so unchecking
    a done task returns it to the lane it came from (Linear-style),
    not always to "todo."
  - `tasks-context.tsx` — client `TasksProvider` mounted in
    `/app/layout.tsx`. Two contexts (state + dispatch) so dispatch-
    only consumers don't re-render on state changes.
  - `selectors.ts` — `groupByLane`, `tasksByLane`, `openTaskCount`,
    `tasksSortedByStartDay`. Pure functions, no React.
- Sidebar now shows an open-task count badge next to Inbox / My
  tasks, computed from the shared store.

**Changed**
- All four app views (`board`, `list`, `timeline`, `calendar`)
  rewired to consume the store. Local `useState<Task[]>` + direct
  `SEED_TASKS` imports replaced.
- Board's drag-to-lane handler now dispatches `moveTask`. Drag UI
  state (`draggingId`, `hoverLane`) stays local — they're per-gesture
  ephemera, not data.
- List checkbox is now interactive: clicking dispatches
  `toggleComplete`; the row's title gets a strikethrough and the row
  reorders into the Done section. `aria-pressed` reflects state.

**Boundary held**
- The cinematic showcase demo on `/` keeps its own state machine
  and is unaffected. The `TasksProvider` is mounted only at
  `/app/layout.tsx`.

**Verified end-to-end** — toggle a task on `/app/list`, navigate via
sidebar to `/app/board` — task appears in Done lane, counts update
across the sidebar.

**Backlog merged into this cycle's followups (low-priority)**
- Swap module-counter id generation for `crypto.randomUUID()` when
  cycle 4 introduces persistence.
- Memoize Card components when task count grows beyond ~50.



## Cycle 2 · 2026-05-05 · Restraint — pacing + cursor labels

Two related defects in tone. Scene-to-scene transitions held for only
~700ms — every second was equally loud. And cursor name pills rode
each cursor permanently, drowning the cards with three constant
labels. The demo read chat-app-y when the brand demands concert-hall.

**Changed**
- Scene runner now inserts a `sceneSettle()` beat (~1600ms; 2000ms
  after the dependency reveal) between every pair of scenes. During
  settle, cursors gently drift toward random nearby points every
  ~700ms so the demo reads alive without firing scripted action.
  Burndown, activity feed, and last-state visuals hold.
- Cursor name labels are now signal, not skin. They appear only when
  a cursor is grabbing, reading a card, or in its 900ms post-arrival
  grace window. Otherwise the cursor is a quiet arrow.
- Per-cursor label fade-out is staggered (chloe 0ms · david 220ms ·
  alex 440ms) so the three labels don't pulse in unison — asynchrony
  reads as life.

**Priority shift**
- Per user direction at end of cycle 2: subsequent cycles focus on
  full app build (real interaction, primitives, depth in app routes)
  rather than further demo polish. Demo work moves to "improvement
  opportunistic" rather than the top of the heuristic.



## Cycle 1 · 2026-05-05 · View morph actually FLIPs

The cinematic showcase demo's view-morph scene previously crossfaded
via `AnimatePresence mode="wait"` — every card unmounted before the
next view mounted, so the shared `layoutId` had nothing to interpolate
between. Net effect: three abrupt fades instead of cards gliding from
column to row to gantt bar. The hero artifact's most ambitious moment
was unfulfilled.

**Changed**
- Replaced the `AnimatePresence mode="wait"` view swap with a unified
  `<DemoSurface>` (`src/components/showcase/demo-surface.tsx`) that
  keeps one set of motion cards mounted at all times. Switching `view`
  now changes the parent layout; motion's FLIP system tweens each card
  from its previous geometry to its new geometry over 720ms with
  ease-out-expo, all 16 cards in concert.
- Card body cross-fades in two stages with a 120ms hole between them,
  so the eye never sees both bodies at 50% (which would white-flash).
- Wrapper chrome (column backgrounds, list table header, gantt grid)
  trails the cards: faint at 15% throughout, rises 280ms starting at
  t=440ms — cards are protagonists, chrome is the room.
- Today indicator on entering timeline draws top-to-bottom over 320ms,
  then the pill snaps in via spring — a single brand-color punctuation.
- Added scene guards: carry no-ops outside board view; view-morph
  no-ops while a card is in flight.
- New `useMorphTransition` hook centralizes durations and respects
  `prefers-reduced-motion`.

**Fixed (during review pass)**
- Timeline geometry: replaced malformed
  `calc(% * (100% - 200px) / 100%)` with absolute positioning inside
  a 200px-gutter-aware track. Bars now land in the correct day cell.
- TodayMarker alignment: removed magic `0.985` fudge factor and
  duplicated 20px gutter; now computed against the same reference
  frame as the bars.
- Duplicated `data-lane` attributes (chrome + card-layer) collapsed
  to a single source on the card-layer column so `querySelector`
  returns the right element for the carry-scene celebration burst.

**Backlog** — see `docs/cycles/backlog.md` for deferred items
(TaskCard/MorphCard reunification, dead-code purge, useMemo on
transitions, stable ref callback).
