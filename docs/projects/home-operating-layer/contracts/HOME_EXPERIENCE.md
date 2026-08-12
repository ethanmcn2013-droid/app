# Contract · Home experience

**Status:** Sealed (Wave 1). Binding on every Home surface, contract test and lab direction.
**Base:** `origin/main` @ `78021c5` · branch `feat/home-operating-layer` · worktree `_wt-home-layer`
**Consumes:** `contracts/PROJECT_SCOPE.md`, `contracts/HOME_ROUTE_AND_RETURN_CONTEXT.md`
**Live evidence:** `design/current-product-evidence/` — 30 captures, 10 routes × 3 viewports
**Decisions:** `D-HX01 … D-HX10` (§19)
**Tests:** `src/lib/home-layer/experience/` (§18)

This contract is sealed **before** any polished UI exists, deliberately. It says what every
Home surface must be true of, in a form a lab direction can be measured against and a
contract test can assert. It does not choose a visual direction — that is Ethan's, after
Wave 3.

---

## 0. What this contract is, and what it is not

It is the **experience floor**: titles, heading structure, landmarks, current-page semantics,
focus, restoration, announcements, non-ideal states, reflow, targets, contrast, motion, the
browser and assistive-technology matrix, the performance envelope, and the evidence that has
to exist before any of it may be called done.

It is not a design system, not a component inventory, and not a style guide. Tokens, motion
tokens, type scale, measures and primitives are already audited at
`audit/C-design-interaction.md`; this contract cites that work rather than restating it.

**Three of the five routes it governs do not exist.** `/app/home/inbox`,
`/app/home/my-work` and `/app/home/analytics` are absent at this base. `/app/home` and
`/app/home/briefing` exist and were captured live. Every rule below therefore says either
*what the capture proves* or *what the implementation must satisfy*, and never blurs the two.

---

## 1. The evidence base — what the current product actually does

### 1.1 How it was taken, and what it cannot say

`design/current-product-evidence/`, captured 2026-08-12 against a local review-mode server
(`NEXT_PUBLIC_SIGNAL_ACCESS_MODE=review`, port 3212) which binds a synthetic demo user to
in-memory seed data and never queries a real database. Ten routes × three viewports
(1440×960, 390×844, 320×568); each capture has a full-page PNG, a Playwright ARIA snapshot
(`.aria.txt`) and a row in `structural-audit.json`.

**Honest limits, carried forward from `design/current-product-evidence/README.md`.** Review
mode, seed data, **Chromium only, light theme only**. Full-page captures, not per-state:
no hover, focus, open-detail or error states. **No axe run, no contrast measurement, no real
zoom, no screen reader.** This is orientation evidence. It certifies nothing.

Two measurement details that change how the numbers should be read:

- `headings` is filtered to **visible** elements (`capture-current-product.mjs:52`), so a
  heading-order finding below is a finding about what a sighted reader and a heading-navigating
  screen-reader user both encounter.
- `navigations`, `regions` and `ariaCurrent` are raw `querySelectorAll` over the **DOM**
  (`:55`, `:59`, `:63`), not the exposed accessibility tree. Where a count here exceeds what
  the ARIA snapshot shows, the extra node is in the DOM and hidden at capture time. That
  distinction is load-bearing and §5 rule 6 turns on it.

### 1.2 What is already sound, and must not regress

| Property | Evidence |
|---|---|
| Exactly one `main` and one `h1` on every route that renders | `structural-audit.json`, `mainCount: 1`, `h1Count: 1` — all routes except `/app/your-work` |
| **Zero** nested interactive controls inside a wrapping link, everywhere | `nestedInteractiveInsideLink: 0`, all 30 captures |
| **No horizontal overflow at 320 px**, anywhere | `horizontalOverflow: false`, `scrollWidth === clientWidth === 320`, all 10 routes |
| A single app-wide skip link targeting a real `tabIndex={-1}` element | `src/app/app/layout.tsx:65-69`, `:101-103`; `home.aria.txt:1-2` |
| Home names both its sections as regions | `home.aria.txt:31`, `:45`; `structural-audit.json home@*.unnamedRegions: 0` |
| Home settles: network idle, 2 navigations | `structural-audit.json home@desktop-1440.reachedNetworkIdle: true` |

This is a decent baseline and Home inherits it. Losing any row of it is a regression, not a
trade.

### 1.3 What is broken — nine findings from the capture

Every one of these is a thing the contract exists to fix.

**F1 · The Full Briefing claims to be a page it is not.** On `/app/home/briefing`, at all
three viewports, exactly one element carries `aria-current="page"` and it is the link
`Home → /app/home` — a *different* URL. `structural-audit.json`,
`home-briefing@desktop-1440.ariaCurrent`, `@mobile-390`, `@narrow-320`. The mechanism is
`src/components/studio-bar/projects-sidebar.tsx:445`, which matches `/app/home` **and**
`/app/home/*` and applies `page` to both. A screen-reader user on the Briefing is told the
current page is Home. This is the nested-current defect, live, on a Home route.

**F2 · Current-page semantics change with viewport.** On `/app/inbox` at 1440 the DOM carries
three `aria-current="page"` elements — `Tasks` twice and `Inbox8` once. At 390 and 320 it
carries **two, both `Tasks`, and nothing marks Inbox**. So a reader on Inbox at desktop is
told Inbox is current; the same reader at mobile is told **Tasks** is current, which is false.
`structural-audit.json inbox@desktop-1440.ariaCurrent` vs `inbox@mobile-390.ariaCurrent` and
`inbox@narrow-320.ariaCurrent`. `/app/my-tasks` and `/app/project` show the same shape.

**F3 · Multiple `aria-current="page"` per document.** Counts in the DOM: `/app/tasks` 4,
`/app/notes` 4, `/app/timeline` 4, `/app/inbox` 3, `/app/my-tasks` 3, `/app/project` 2,
`/app/your-work` 1 (and it is `Tasks`, on a page that is not Tasks). The duplicated pairs are
the desktop sidebar nav and the mobile bar; exactly one of each pair is exposed at each
viewport, and **which one is decided entirely by CSS** — the ARIA snapshots show only one.
An accessibility invariant maintained by a breakpoint is an invariant no test in this
repository currently checks.

**F4 · `aria-current` on non-interactive nodes.** `/settings/profile` carries
`{"value":"page","text":"tasks·","href":null}` at all three viewports; `/app/tasks` carries
`{"value":"page","text":"The Orchard, events13 tasks","href":null}`. `aria-current` on a
`span` states a relationship no user can act on.

**F5 · The badge is concatenated into the accessible name.** The Shortcuts nav renders
`link "Inbox 8 open"` whose DOM text is `Inbox8` (`inbox.aria.txt:34-36`;
`structural-audit.json inbox@desktop-1440.ariaCurrent[2].text === "Inbox8"`). Two Inbox
affordances exist on the same page with **two different names and only one count**: the rail
carries `link "Inbox"` with the text `Inbox · daily digest` and no number
(`home.aria.txt:21-23`), while Shortcuts carries the count. Notes shows the same pattern
(`Notebook14`). A third Home Inbox affordance would make three names for one number.

**F6 · A heading precedes the `h1`.** At 1440, `/app/inbox`, `/app/my-tasks`, `/app/project`
and `/app/tasks` all emit a **visible `h2` "Project folders" before the `h1`** — it is the
label of the sidebar's `navigation "Project folders"` (`inbox.aria.txt:39-40`). At 390 and 320
that `h2` is gone, so the heading tree changes shape by viewport. A heading-navigating user
at desktop meets a level-2 sidebar label before they meet the page.

**F7 · Three routes have no route-specific title.** `/app/inbox`, `/app/my-tasks` and
`/app/project` all report `title: "Signal Studio"` at all three viewports. `/settings/profile`
reports `"Settings · Tasks"` on a suite settings page; `/app/timeline` reports
`"mara-finn · Timeline · Signal Studio"` — a **slug**, not a name.

**F8 · Unnamed sections carrying headings.** `/app/inbox` has **3** `<section>` elements with
no accessible name at every viewport; `/app/my-tasks` has **4**; `/app/tasks` and
`/settings/profile` one each. Home has **0**. An unnamed `<section>` is not an unnamed landmark
— it is a generic container, which is exactly the point: the Inbox's four headed blocks
(`1 thing wants a nudge.`, `Good morning, Orla.`, `Inbox zero. Quiet here on purpose.`) have
headings with no region to attach them to, so nothing announces the block boundary. Home,
which uses `aria-labelledby`, produces two real regions (`home.aria.txt:31`, `:45`).

**F9 · A row's accessible name changes with viewport.** The same Home row is
`link "Approve the final seating plan Tasks · The Orchard, events · Mara & Finn in review"` at
1440 (`desktop-1440/home.aria.txt:49`) and
`link "Approve the final seating plan in review"` at 320
(`narrow-320/home.aria.txt:31`). The provenance is dropped by an `sm:block` utility
(`audit/C-design-interaction.md` §9.1). Provenance is the one thing charter locked decision 12
says may never be invented; a narrow viewport currently removes it.

**Three more, recorded because Home must not inherit them.**

- `/app/your-work` returns **HTTP 200** with `mainCount: 0`, `h1Count: 0`, one `h2`
  ("The workspace took a wrong turn.") and a failed-query console error, at all three
  viewports. Its skip link still points at `#app-main-content`, **which does not exist on that
  page** — a broken skip link on a 200 response. And it is the hardcoded redirect target of
  `/api/suite-context` in both branches (`src/app/api/suite-context/route.ts:23`, `:54`).
- `/settings/profile` has **no skip link at all** — its ARIA snapshot begins at `banner`
  (`settings-profile.aria.txt:1`) where every `/app` route begins with
  `link "Skip to main content"`.
- **Up to five live regions per page, most of them empty.** Every capture carries an empty
  `alert` plus a `status` reading "In development. You're seeing it early."
  (`home.aria.txt:51-53`). `/app/inbox` adds a second empty `status`
  (`inbox.aria.txt:106-107`). `/app/home/briefing` adds **three** more, one per row
  (`home-briefing.aria.txt:43`, `:50`, `:60`).

---

## 2. Route titles

Sealed. Static per route — the Project name is on the page, never in the tab.

| Route | `<title>` |
|---|---|
| `/app/home` | `Home · Signal Studio` |
| `/app/home/inbox` | `Inbox · Home · Signal Studio` |
| `/app/home/my-work` | `My work · Home · Signal Studio` |
| `/app/home/analytics` | `Analytics · Home · Signal Studio` |
| `/app/home/briefing` | `Full briefing · Home · Signal Studio` |

Rules:

1. **Mode first, then Home, then Signal Studio**, matching the shipped convention
   `Board · Tasks · Signal Studio` (`structural-audit.json tasks@desktop-1440.title`). Today
   is the layer's root and takes `Home · Signal Studio`, unchanged from what ships now.
2. **No Home title says "Tasks"**, and none says "workspace" — the second is `PROJECT_SCOPE.md`
   assertion A10.
3. **No Home title carries a Project name, a count, a slug or a greeting.** Three reasons, and
   the third is the decisive one: a tab strip on a shared or screenshotted screen leaks a
   Project name; a title that varies with scope would announce on a `replace` that is not a
   navigation (route contract §11.1); and a static title is deterministic for §18.
4. **The title is set before focus moves** on a client-side mode change (§7).
5. `Full briefing` is sentence case, matching the shipped link text `Open full briefing`
   (`home.aria.txt:43`). `docs/SUITE_URL_AND_NAMING_CONTRACT.md` writes "Full Briefing" in
   prose; that is prose, not a rendered string (D-HX01).

---

## 3. One `h1`, and the heading tree

### 3.1 The invariants

1. **Exactly one `h1` per Home route**, at every viewport, in every state — including
   loading, empty, error and unavailable. `/app/your-work` proves the failure mode: an error
   path that renders an `h2` and no `h1` at all.
2. **No heading precedes the `h1` in DOM order.** This closes F6. Consequence, sealed: **no
   chrome landmark carries a heading element.** A navigation landmark is named with
   `aria-label`; if it needs a visible label, that label is not an `<h*>`.
3. **No level is skipped.** `h1 → h2 → h3` only.
4. **The heading tree does not change shape with viewport.** Level and order are identical at
   320, 390, 768 and 1440. Content may reflow; structure may not.
5. **The `h1`'s accessible text identifies the mode.** Expressive phrasing is permitted
   *around* the mode name, never *instead* of it. Today `/app/home`'s `h1` is `"Good morning."`
   and `/app/home/briefing`'s is `"Two things calling, and one quieter signal below."` — neither
   identifies anything, so a reader arriving by heading navigation is not told where they are.
6. **The mode name is visible, not hidden.** Two compliant patterns, and only two:
   - **(a)** the mode name is the `h1` and the expressive line is a paragraph beneath it;
   - **(b)** the mode name is a **visible eyebrow rendered inside the `h1`**, followed by the
     expressive line, so the accessible text begins with the mode name and nothing is hidden
     from anybody.
   Pattern (b) exists so the editorial register survives. Home already renders a date eyebrow
   above the `h1` (`home.aria.txt:28-29`); moving a mode eyebrow inside it is a small
   structural change with real orientation value.
7. **Sections that render only when they have something true to say** stay that way
   (`src/components/app/home/home-view.tsx:11-22` — "a stack of empty placeholders is dashboard
   furniture, not calm"). A varying heading *count* is correct. A varying heading *order* is not.

### 3.2 The tree, per route

```
/app/home                 h1  Today            (+ greeting / date, §3.1 rule 6)
                          h2  Today's Signal
                          h2  Coming up            when non-empty
                          h2  Needs review         when non-empty

/app/home/briefing        h1  Full briefing    (+ the read's own sentence)
                          h2  Now
                          h3  <item>
                          h2  Next
                          h3  <item>

/app/home/inbox           h1  Inbox
                          h2  <named group>
                          h3  <event>

/app/home/my-work         h1  My work
                          h2  <named section>
                          h3  <item>

/app/home/analytics       h1  Analytics
                          h2  <named question>
                          h3  <breakdown>
```

The Briefing's existing tree already satisfies this apart from its `h1`
(`home-briefing.aria.txt:31`, `:35`, `:38`, `:52`, `:55`). My work's does not: its greeting is
an `h2` and its sections are `h3`, with the `h1` supplied by `AppPageHeader`
(`audit/C-design-interaction.md` §9.4) — a structure that only works while the Tasks header is
mounted above it.

---

## 4. Landmarks, regions and the skip link

1. **Exactly one `<main id="app-main-content" tabIndex={-1}>` per Home mode.** This is the
   skip-link target (`src/app/app/layout.tsx:101`) and the selector `ArrivalSettle` animates is
   `main#app-main-content,[data-product-canvas]`
   (`src/components/system/arrival-settle.tsx:59`) — **both must resolve to exactly one
   element per mode** (`audit/C-design-interaction.md` §3.7). Note `SuiteLoading` also claims
   the id (`src/components/app/suite-loading.tsx:10`), so a loading state and a settled page
   must never be mounted together.
2. **Exactly one skip link, first in tab order, and its target must exist.** Assert the target,
   not the link: `/app/your-work` has the link and no target.
3. **Every navigation landmark has a non-empty, unique accessible name**, and the set of
   navigation names on a Home route is closed and asserted. Today `/app/inbox` and
   `/app/my-tasks` each carry a navigation landmark with **no name** and four links, at every
   viewport (`structural-audit.json inbox@*.navigations`), and `/settings/profile` carries one
   with three.
4. **Two navigation landmarks may not describe the same set.** `Products` (3 links) and
   `Signal Studio products` (4 links) are both in the DOM on every route today, with exactly
   one exposed per viewport. Home renders **one** product navigation landmark, and the
   responsive difference is layout, not a second landmark.
5. **Every `<section>` that carries a heading is named by that heading via
   `aria-labelledby`.** This is what Home already does (`home-view.tsx`, two named regions,
   zero unnamed) and what Inbox and My work do not (F8). A headed block with no region gives a
   screen-reader user no boundary to navigate to.
6. **The Home mode navigation is a single navigation landmark named `Home`.** It contains the
   four modes and nothing else. The Full briefing is depth from Today (charter locked decision
   4) and is **not** a fifth item in it.
7. The chrome landmarks Home inherits stay as they are: `role="banner"`
   (`src/components/studio-bar/studio-bar.tsx:197`), `<aside aria-label="Signal Studio
   navigation">` (`src/components/studio-bar/studio-rail.tsx:157`). Home adds no second
   `banner` and no second `complementary`.

---

## 5. Nested-current semantics — exact

This is the section that closes F1–F4. Every rule is asserted in §18.

**R1 · Exactly one element in the document carries `aria-current="page"`, and its `href`
resolves to the current URL's pathname.** Not an ancestor of it. Not a sibling. Not a
different route that happens to be nearby.

**R2 · Only the most specific Home-local link claims `page`.** On `/app/home/inbox`, the Home
mode navigation's *Inbox* item is `aria-current="page"`; its *Today* item carries nothing;
nothing else in the document claims `page`.

**R3 · The suite Home affordance exposes section state without claiming a second current
page.** On any `/app/home/*` route the suite rail's and the mobile bar's *Home* entry carries
`aria-current="true"` — "the current item within this set" — never `aria-current="page"`.
The distinction is exactly the one F1 gets wrong: `projects-sidebar.tsx:445` matches the
`/app/home` **subtree** and applies `page`, so the Briefing tells the reader Home is the
current page. Subtree match → `true`. Exact match → `page`. The repository already uses
non-`page` values elsewhere — `aria-current="true"` on a selected note
(`notes.aria.txt`, `structural-audit.json notes@desktop-1440.ariaCurrent[2]`) and
`aria-current="step"` in Timeline — so this is convention, not invention.

**R4 · The global Inbox shortcut creates no third claim.** The suite-level Inbox affordance
(today `link "Inbox"` in the rail, outside any navigation landmark — `home.aria.txt:21-23`)
carries **no `aria-current` at all**. "Current item within a set" is meaningless outside a
set, and `page` is already spoken for by R2.

**R5 · `aria-current` appears only on a link or a control** — never on a `span`, a `div` or a
text node. Closes F4.

**R6 · The one-`page` rule is asserted against the DOM, not against the exposed tree.** Two
elements carrying `aria-current="page"` where CSS hides one is a violation. Today four routes
do exactly that, and which one survives depends on a breakpoint (F3). Wave 4 may satisfy this
by rendering one navigation and re-laying it out, or by making the inert bar `aria-hidden`, or
by conditional rendering — the contract fixes the invariant, not the mechanism.

**R7 · One announcement, not three.** A screen-reader user traversing the Home chrome hears
the current mode named **once**. The mode nav says it; the suite Home entry's `true` does not
repeat the word "current"; the Inbox shortcut says nothing.

---

## 6. The Inbox badge — one source, one announcement

Charter locked decision 6: one canonical Inbox — one route, one event store, one badge
definition, one state machine. Applied to the surface:

1. **One count, resolved once per request on the server**, passed to every affordance. There
   will be at least three candidate sites — the suite Inbox shortcut, the Home mode nav's
   Inbox item, and Today's Inbox summary — and each is a chance for a second number. There are
   already two Inbox affordances with two different names and only one count (F5).
2. **The number is never adjacent-concatenated into the accessible name.** Today the DOM text
   is `Inbox8`. Sealed: the numeral lives in its own element, and the accessible name is
   composed deliberately — the noun, the number, and the state, in that order.
3. **Exactly one affordance announces the count to assistive technology.** The others either
   omit it or mark the numeral `aria-hidden`. §18 `X7` asserts the count string appears once in
   the accessibility tree.
4. **A count that could not be computed renders no badge and a named state — never `0`.**
   Charter locked decision 11. Zero and unknown are different facts and must look different.
5. **Until an unread model exists, the badge may not say "unread".** `notifications.read_at`
   has **no writer anywhere**; `notify()` early-returns when the payload has no `taskId`
   (`src/server/db/notifications.ts:40-47`); Inbox read state is client-only `localStorage`
   (`src/components/app/inbox/inbox-app.tsx:207-217`). This is `R-H12`. The badge names what it
   can prove and nothing more.
6. **The badge never carries the only copy of a fact.** It is a summary of a state that is also
   stated in words inside Inbox.

---

## 7. Route focus behaviour

1. **On first load, focus is not moved.** The skip link stays first in tab order.
2. **On a client-side Home mode change, focus moves to the route's `h1`** (given
   `tabIndex={-1}`), after the document title is updated (§2 rule 4). Next.js App Router does
   not move focus on client navigation; a mode change with no focus move leaves a
   screen-reader user reading the previous page.
3. **Focus moves with `preventScroll: true`, and scroll is then set deliberately.** The
   repository already uses this exact call (`src/components/hybrid/options/c/planning-rail.tsx:124`).
4. **A `replace`-only change never moves focus.** Read Scope, Lens, `period` and selection all
   replace (route contract §11.1) and are not navigations. Moving focus on a filter change
   throws the reader out of the control they are using.
5. **Focus is never dropped.** A control that becomes unavailable uses `aria-disabled`, not
   `disabled`, so keyboard focus survives — the pattern already shipped at
   `src/modules/signal/components/brief/quiet-briefing-ledger.tsx:488-509`.
6. **The focus ring is the global one** — `2px solid var(--x-accent-focus)`, offset 2, radius 6
   (`src/app/globals.css:932-937`). Note that block also sets `scroll-margin-top: 128px` so
   sticky chrome never obscures a focused element (WCAG 2.4.11); **a Home mode nav that adds
   height must revisit that number**, and §18 `X11` pins it so the change is deliberate.
7. **Every dialog and sheet uses the existing `Dialog` primitive**
   (`src/components/primitives/dialog.tsx`), which already provides focus-on-open, Escape,
   focus return (`:101`) and a real Tab trap (`:78-95`, added because `aria-modal` does nothing
   to the Tab order). Home writes no second modal.

---

## 8. Back, scroll, selection and focus restoration

The URL half is the route contract §11. This is the rendered half.

1. **Back into a Home mode restores all six**: Read Scope, Active Project, mode, selection,
   focus and scroll. Five come from the URL; focus does not.
2. **Restoration happens after Project state resolves, never before.** A restored scroll offset
   on a view that is about to become `unavailable` puts the reader at row 40 of an error
   (route contract §10 rule 4, §11.3).
3. **The scroll owner is named, not inferred.** Two nested scroll containers exist today — the
   module `<main>` carries `overflow-y-auto`
   (`src/components/app/product-workspace-shell.tsx:53`) and `HomeView` opens another
   (`src/components/app/home/home-view.tsx:25`). Wave 4 resolves ownership to exactly one
   element per mode before restoration can be tested at all.
4. **Focus restores by stable key, not DOM index.** If the element is gone, focus goes to the
   `h1` — never to `<body>`, which silently returns a screen-reader user to the top of the
   document with no announcement.
5. **Closing a selection returns focus to the row that opened it.** Precedent:
   `src/lib/tasks/use-task-panel.ts:17-30`.
6. **Restoration is instant under every motion preference.** A smooth scroll to a restored
   offset is animation that owns durable state, forbidden outright by the delight motion
   contract (`audit/C-design-interaction.md` §5.3).

---

## 9. The project-scope sheet

The one control that changes Home Read Scope and opens a Project Lens.

1. **It is text-labelled and route-backed in its effect.** Never an unlabelled icon, never
   behind the avatar, never inside Profile (charter locked decisions 2 and 3).
2. **Its label always states the current scope literally** — `Across all projects`,
   `The Orchard, events`, `2026 school year` (`PROJECT_SCOPE.md` §5 rule 1). The label is the
   disclosure; there is no second place a reader has to look to find out what they are seeing.
3. **Opening it changes nothing.** Choosing changes exactly one thing and closes it.
4. **Read Scope and Project selection are two separate groups inside it, and they are labelled
   as different actions.** Choosing an aggregate replaces history; selecting a specific Project
   invokes the global switch and pushes (`PROJECT_SCOPE.md` §4.3, route contract §11.1). One
   list where one tap sometimes does one and sometimes the other is the conflation
   `PROJECT_SCOPE.md` §5 calls a release blocker.
5. **Opening a Project Lens is a third action, and it says so.** It changes neither axis
   (route contract §3.2).
6. **Partial authorization is disclosed inside the sheet**: how many Projects were read and
   that the rest were unavailable (`PROJECT_SCOPE.md` §5 rule 4). Never a silently short list.
7. **Archived Projects are excluded by default, behind an explicit labelled toggle** (D-H08).
8. **The word "workspace" never appears** (`PROJECT_SCOPE.md` assertion A10), and no copy in it
   uses a banned term — `scripts/check-first-contact-language.mjs` bans *triage*, *backlog*,
   *sprint*, *wip*, *blocker*, *blocked by*, *iteration*, *throughput*, *cycle time*, *config*,
   *schema*, *payload*, *endpoint*, *null* among others, and its baseline may only shrink
   (`audit/C-design-interaction.md` §2.6).
9. **It is fully operable by keyboard**, uses `Dialog` (§7 rule 7), and every option meets §13's
   target size. On mobile it is a sheet; on desktop it may be a popover — the semantics are
   identical either way.
10. **It is never the only route to a scope.** Every scope is expressible in the URL and
    therefore linkable, shareable and testable without driving the control.

---

## 10. Status announcement vocabulary

### 10.1 The closed set

Home has exactly these states. Each has one name, used in copy, in announcements, in
telemetry and in test fixtures. No surface invents a synonym.

| State | Means | Never rendered as |
|---|---|---|
| `loading` | first read in flight | content |
| `refreshing` | a settled view is being re-read | a skeleton replacing settled content |
| `updated` | a re-read completed and changed something | silent |
| `partial` | some sources resolved, some did not | zero, complete, all clear |
| `stale` | last successful read is older than its freshness window | current |
| `insufficient-history` | the window exceeds available history | zero, flat, healthy |
| `permission-limited` | the actor may not see part of the answer | absent, zero |
| `unavailable` | could not be resolved; reason withheld | empty, zero, all clear |
| `archived` | resolved, read-only, labelled | ready |
| `empty` | resolved, authorized, genuinely nothing in it | unavailable |
| `failed` | the read errored | empty |
| `offline` | the network read could not be attempted | current |
| `all-clear` | resolved, complete, and nothing needs the reader | any of the above |

`all-clear` is the only one that may say "nothing needs you", and it may be said **only** when
every source resolved. Home already gets this right today: `allClear` is set only when
`signalRows.length === 0` and the quiet state *names* what shipped rather than claiming nothing
happened, with the honest arithmetic in `readLine`
(`src/app/app/home/home-data.ts:177-192`). That guard is inherited, not re-derived.

The vocabulary **extends** the existing coverage model rather than competing with it:
`providerCoverage` already carries `status`, `capabilities`, `historyStartAt`, `historyEndAt`,
`calculatedAt`, `staleAfter`, `sourceRecordCount` and `issues`
(`src/modules/signal/server/analytics/providers/coverage.ts:9-30`), and `combineCoverage`
already resolves `complete | partial | stale | unavailable` (`:32-44`).
`PROJECT_SCOPE.md` §5 rule 7 requires exactly this.

### 10.2 Live-region discipline

1. **One polite live region per Home route**, owned by the route. Today a Home route ships two
   and the Briefing ships five, four of them empty (§1.3). Home does not add a sixth.
2. **`role="alert"` is reserved for two things**: a write that failed, and a permission change
   that invalidates what is on screen. Never loading, never counts, never scope changes.
3. **Every announcement is a sentence with a noun.** "8" is not an announcement.
4. **A state that could not be computed announces the state, never a number.**
5. **A scope change announces the new scope, the count read, and the coverage** — because a
   `replace` is not a navigation and nothing else will tell a screen-reader user the page's
   meaning just changed.
6. **Identical message text within one second announces once.** Three affordances reacting to
   one event must not speak three times (§5 R7, §6 rule 3).
7. **`aria-busy` goes on the region being re-read, not on `<main>`.** Marking the whole
   document busy hides everything that is still true.
8. **No status is carried only by colour or only by motion** (`audit/C-design-interaction.md`
   §5.3 forbidden patterns).

---

## 11. Loading, refreshing, optimistic, retry, offline and error

**Loading.** The canon is already written and Home follows it: where chrome exists, loading
stays in the content region as *a tracing of the settled page* — no full-screen takeover, no
shimmer, no fake items (`src/app/app/home/loading.tsx:1-15`). Home's boundary is a **server
component with zero JS and no animation**, so it satisfies reduced motion without a media
query, reserving header + section label + one row height, with `role="status"` and an
`aria-label` naming the mode (`:36` — today `"Opening Home"`; per mode, `Opening Inbox`,
`Opening My work`, `Opening Analytics`, `Opening the full briefing`). `ArrivalSettle` rides
beside it. Each mode gets its own `loading.tsx`; each must be registered in
`experience/registry.json` (`audit/C-design-interaction.md` §10 trap 5).

**Refreshing.** Settled content stays on screen. A named `refreshing` state appears,
`aria-busy` on the region being re-read (§10.2 rule 7). A skeleton that replaces settled
content is prohibited — it destroys information the reader already had in order to show that
work is happening.

**Optimistic — prohibited, and this is not a style preference.** Every Tasks mutation binds
to the `tasks_active_ws` cookie rather than to an argument. A cross-Project write finds no row
and **silently no-ops with a success return** (`src/server/actions/tasks.ts:114`, `:118-122`;
catalogued at `docs/wave/MUTATION_INVENTORY.md:54-64`; `R-H11`). An optimistic UI over an
action that returns success without doing anything shows a reader a task they completed that
was never completed.

> **Sealed: no Home surface renders a success state before the source confirms it.**

This stands until Home writes take an explicit `ProjectId` (`PROJECT_SCOPE.md` §9) and
`HOME_MUTATIONS_ENABLED` is on. Pending-state UI is allowed; *claimed-outcome* UI is not.

**Retry.** One explicit, labelled control. No silent automatic retry that changes content
without saying so. The established pattern is `src/app/app/home/error.tsx:22-86`: a
plain-English headline ("Home didn't load."), reassurance that the reader's work is untouched,
an escape route to the products, an optional `ref · {digest}` in mono, and one "Try again".
It is a pure inline-style client component with colours read defensively as
`var(--color-ink, var(--ink))` — deliberately, so it renders when the stylesheet did not.

**Offline.** A named state, not silence. Home shows when the data was read, keeps the last
successfully read content, labels it with its read time, and names the failure. It never
serves a stale read as current. There is no offline store and Home does not introduce one
(§ persistence, route contract §7).

**Error.** One `error.tsx` per Home mode, in the pattern above, each registered in
`experience/registry.json`. An error state still renders exactly one `h1` (§3 rule 1) and a
`main` whose id the skip link resolves to (§4 rule 2) — the two things `/app/your-work` proves
are easy to lose.

---

## 12. 320 px and high-zoom reflow

1. **No horizontal scrolling at 320 CSS px** on any Home route in any state. Currently true on
   all ten captured routes (§1.2) and it must stay true. WCAG 1.4.10.
2. **400% zoom at 1280×1024 is the same requirement** and is tested separately, because CSS
   pixel width and zoom exercise different code paths (media queries vs layout viewport).
3. **200% text-only resize** with no loss of content or function. WCAG 1.4.4.
4. **Content parity: a narrow viewport may change layout; it may not change what a row says.**
   This closes F9. Provenance, state and timing are part of the row's meaning
   (charter locked decision 12), and an `sm:block` that drops the source from the accessible
   name at 320 makes a claim unsourced for exactly the readers most likely to be on a phone.
   If a fact does not fit, it is rendered in a form that does — not deleted.
5. **The heading tree is identical at every viewport** (§3.1 rule 4), which also closes F6's
   viewport-dependent shape.
6. **`aria-current` semantics are identical at every viewport** (§5 R6), which closes F2.
7. **One measure for the Home layer, or a written reason per mode.** Four modes of one
   operating layer currently use four different measures — 760 / 960 / 820 / 768
   (`audit/C-design-interaction.md` §6.1). That is an accident, not a decision, and Wave 4
   makes it one.
8. **Sticky chrome is budgeted.** Every sticky element's height counts against the reflow
   requirement at 320 and against `scroll-margin-top: 128px` (§7 rule 6). `overflow-x: clip`
   (not `hidden`) on html/body is deliberate so `position: sticky` keeps working
   (`src/app/globals.css:592-596`) — do not "fix" it.

---

## 13. Touch targets and contrast

### 13.1 Targets

- **44 × 44 CSS px minimum** for every Home control, at every viewport, including inside the
  scope sheet and the mode nav.
- Written as **bracketed literals** — `min-h-[44px]`, `h-[44px]`, `w-[44px]`, `min-w-[44px]`.
  On this repository's scale `min-h-11` is **80 px**, not 44, and
  `scripts/check-tap-target-scale.mjs` fails the build on any sizing utility at index 11
  (`:66-70`, required form `:130-133`).
- **No new `OUTSTANDING` or `CHROME_SCALE` entry.** The ledger is shrink-only in both
  directions — it fails if a listed file gets worse *and* if a listed file becomes clean
  (`:116-127`).
- Adjacent targets have at least 8 px of separation or 44 px of combined hit area.
- **A hover-only affordance does not exist on touch.** `docs/DELIGHT_CATALOG.md` F9 is already
  decided restrained on exactly this ground, and `Hint`'s own comment warns it must never be the
  sole carrier of a fact on touch (`src/components/primitives/hint.tsx:19-22`).

### 13.2 Contrast

The repository states its own floor at `src/app/globals.css:128-132`:
`--x-ink-quiet` ≥ **7:1** for 12–13 px metadata and captions, `--x-ink-quiet-soft` ≥ **5.9:1**
for 14 px and up.

The utility everything actually spends is `text-ink-quiet`, wired at `globals.css:520` to
`--ink-quiet`, which is the deprecated alias `var(--ink-faint)` = `#71717a` = **4.83:1**
(`src/ds/tokens.css:185`). Home spends it at **11 px, 11.5 px, 12 px and 12.5 px**
(`src/components/app/home/home-view.tsx:29`, `:118`, `:98`, `:252`). There are **421**
`text-ink-quiet` call sites in `src/**/*.tsx` against **5** TSX references to `--x-ink-quiet`,
and `--x-ink-quiet` **has no Tailwind utility at all**
(`audit/C-design-interaction.md` §1.6). So Home passes WCAG AA and fails the system's own
stated floor, at the exact size the floor was written for.

**Sealed.**

1. **Home text at or below 13 px meets 7:1**, not merely 4.5:1. Wave 4 achieves it by giving
   `--x-ink-quiet` a utility or by not spending `text-ink-quiet` below 14 px. The floor is not
   negotiable: the system's own comment already declares 4.83:1 insufficient at that size, and
   "we met AA" is not an answer to a self-declared 7:1 contract.
2. **Non-text contrast ≥ 3:1** for every control boundary, focus indicator and meaning-bearing
   graphic (WCAG 1.4.11). Note `--x-task-control-border: var(--ink-faint)` is ~1.5:1 by the
   system's own comment (`globals.css:177-180`).
3. **Home invents no new colour mix ratio.** The suite's ratios are 72 % red, 52 % amber, 60 %
   green, and the ledger's marks already carry a toned border plus a 3 px 14 % halo specifically
   to clear 3:1 where raw amber is 2.15:1 and green 2.54:1
   (`audit/C-design-interaction.md` §9.2). "A new surface must not invent a fifth ratio."
4. **Both themes, always.** Dark shipped 2026-08-11; `src/ds/tokens.css:193` still says no
   product sets `data-theme="dark"` before launch and is stale. The elevation ramp **inverts**
   in dark (`globals.css:450-470`), so a light-only contrast pass proves nothing.
5. **All five Home routes × light and dark join `scripts/check-contrast.mjs`'s sweep.**
   `/app/home` is **not in it today** (`:44-56`), the gate is **not in `pnpm test`**, and it
   needs a live server — it errored on all six existing combinations at baseline (`R-H04`).
   Wave 3 and Wave 10 evidence packages must budget an orchestrated server for it.
6. **A clean axe run is not contrast proof.** Axe returns "incomplete" rather than "failed" on
   this design's translucent panels, which is why the bespoke gate exists
   (`scripts/check-contrast.mjs:8-14`). Axe is supporting evidence only.

---

## 14. Reduced motion

Four suppression layers already exist and Home inherits all four rather than adding a fifth:

1. Tokens zeroed at the token level (`src/ds/tokens.css:223-230`) — every consumer inherits
   the suppression with no media query of its own.
2. A global clamp of every animation and transition to 0.01 ms, `.reveal` resolved to its final
   painted state, and the `.tasks-dot` freeze (`src/app/globals.css:1008-1031`), the last of
   which is gated by `scripts/check-loading-contract.mjs:127-153`.
3. `MotionConfig reducedMotion="user"` for all `motion/react` components
   (`src/components/motion-provider.tsx:25`, mounted at `src/app/layout.tsx:80`).
4. Per-component guards that return **before** animating
   (`src/components/system/arrival-settle.tsx:95`).

**The lesson that must be reused.** Reduced motion means *present*, not *briefly invisible*.
The ledger sets its fold duration to exactly `0`, not `0.08`, because an 80 ms opacity ramp
still commits the panel to full height at opacity 0 on frame one
(`src/modules/signal/components/brief/quiet-briefing-ledger.tsx:522-527`).

**Forbidden on Home regardless of preference** (`docs/design/TASKS_DELIGHT_MOTION_CONTRACT.md`,
via `audit/C-design-interaction.md` §5.3): `transition: all`; animated keyboard commands; card
hover lift, tilt or parallax; **page-load card staggers**; full-view slides between views;
pulsing today markers or urgency states; bounce or inertial overshoot; full-screen completion
celebrations; animation that owns durable state; animation-only status or error meaning. Route
and representation changes are **immediate**.

**Delight is frozen.** `docs/DELIGHT_CATALOG.md:3-6` — do not implement micro-interactions
without a founder verdict. **F10 is a live founder question and it lands squarely on Today's
Signal**: whether the daily read's lead attention mark gets a perpetual ping, "one perpetual
mark, or none" (`:66-75`). Home ships none until that verdict exists. F8 (content swap) has two
shipped references that disagree in register — a 220 ms crossfade and a 140 ms directional
slide — and picking which governs is an open decision, not a lab choice.

**One motion-token hazard.** `--ease-out` currently means two different curves depending on
whether it is reached from CSS (`cubic-bezier(.23,1,.32,1)`, `src/ds/tokens.css:157`) or from
JS (`[0,0,0.2,1]`, `src/lib/motion.ts:23`); `MOTION_SLOW` is 480 ms in JS against 400 ms in the
token. Home reads motion values from the CSS tokens. Any JS-driven value is derived from the
token, never re-typed.

---

## 15. Browser and assistive-technology matrix

**Nothing in this matrix is currently evidenced.** The capture was Chromium only, light theme,
no axe, no contrast measurement, no real zoom, no screen reader
(`design/current-product-evidence/README.md`, "Honest limits"). Every row below starts at
**unproven** and stays there until a run exists.

| # | Pairing | Proves |
|---|---|---|
| B1 | Chromium (Chrome + Edge), current and current−1 | baseline rendering, reflow, zoom |
| B2 | Gecko (Firefox), current stable and current ESR | reflow, focus order, forced colours |
| B3 | WebKit (Safari macOS), current and current−1 | reflow, focus order, sticky behaviour |
| B4 | WebKit (Safari iOS), current and current−1 | touch targets, sheet behaviour, safe-area |
| A1 | **NVDA + Firefox** (Windows) | landmark, heading, `aria-current`, live-region behaviour |
| A2 | NVDA + Chrome (Windows) | as A1, second engine |
| A3 | JAWS + Chrome (Windows) | as A1 — **records as unproven if unlicensed**, never as passing |
| A4 | **VoiceOver + Safari** (macOS) | rotor navigation by landmark and heading |
| A5 | VoiceOver + Safari (iOS) | swipe order, the scope sheet, the mode nav |
| A6 | TalkBack + Chrome (Android) | as A5, second platform |
| K1 | Keyboard only, every engine | full operability, no trap, visible focus throughout |
| Z1 | 400 % zoom at 1280 and 320 CSS px, every engine | §12 |
| F1 | `forced-colors: active`, Windows High Contrast | precedent exists at `src/lib/ui-wave3-contract.test.ts:35-36`; **not general today** |
| M1 | `prefers-reduced-motion: reduce`, every engine | §14 |

**Rules.**

1. An unrun pairing is recorded **unproven**. It is never inferred from a sibling — NVDA +
   Firefox does not evidence VoiceOver + Safari, and vice versa.
2. **A1 and A4 are required for release.** They are the two most-used desktop pairings and they
   disagree with each other most often on exactly what §5 governs.
3. A release with unproven required pairings **ships disabled**, or ships with the founder's
   explicit, recorded risk acceptance. Charter definition of done: the gates are "genuinely
   evidenced or the release stays disabled".
4. Automated checks are supporting evidence, never a substitute. Axe in particular is not
   contrast proof (§13.2 rule 6).

---

## 16. Performance budgets

Measured at base by `pnpm perf:budgets` after a clean production build (`R-H01`):

```
budget            measured        ceiling        target         state
shared_runtime    246.1 KB gzip   247 KB gzip    170 KB gzip    over-budget (ratcheted)
total_client_js   898.8 KB gzip   940 KB gzip    936 KB gzip    ok
largest_chunk      62.5 KB gzip    63 KB gzip     63 KB gzip    ok
```

**0.9 KB of shared-runtime headroom. 0.5 KB of largest-chunk headroom.** `shared_runtime` is
the floor every route pays; it is already over its target and held only by a ratchet 0.9 KB
above the measurement. This programme proposes to add a Home shell, a Home-local navigation, a
scope control, a mobile sheet and four modes.

**Binding.**

1. **Home routes are Server Components by default.** Client islands are route-local, small, and
   named in the Wave 4 contract.
2. **The Home mode navigation is a Server Component.** It is on every Home route, so a client
   implementation lands in `shared_runtime`, where there is 0.9 KB. `aria-current` (§5) is
   computed from the pathname on the server, which is also the only way R6's DOM-level
   invariant can be asserted without a browser.
3. **The scope sheet is the only permitted client island in the Home chrome**, and it loads
   lazily.
4. **Analytics code never enters the shared or eager dependency graph.**
5. **Any new shared primitive is paid for by removing something.**
6. **A ratchet raise to get green is an automatic veto** (programme brief §24). If Home cannot
   fit, Home gets smaller.
7. `total_client_js` **counts lazy chunks**, so a four-direction lab cannot be code-split out of
   the measurement — the last multi-shell lab cost 19.1 KB and was deleted for it
   (`audit/C-design-interaction.md` §10 trap 6).
8. There is a precedent to copy inside Home already: `home-data.ts` imports Signal's **narrow**
   entry point rather than its barrel, because the barrel re-exported three briefing route
   components and put that client tree in Home's chunk group
   (`src/app/app/home/home-data.ts:3-8`).

**Field performance is structurally unmeasurable at this base** (`R-H05`): no
`@vercel/speed-insights`, no `@vercel/analytics`, no `web-vitals`, no `useReportWebVitals`, no
Lighthouse CI — and Next 16 with Turbopack no longer emits per-route First Load JS, so per-route
client weight cannot be derived from build output. Either a RUM provider is wired during this
programme, or field performance is recorded as **unproven** and promotion needs founder risk
acceptance. Home does not report a per-route number it cannot measure.

---

## 17. Evidence required, per state and viewport

### 17.1 The grid

**13 states** × **4 viewports** × **2 themes**, per Home route.

States: `default` · `empty` · `all-clear` · `loading` · `refreshing` · `partial` · `stale` ·
`insufficient-history` · `permission-limited` · `unavailable` · `archived` · `failed` ·
`offline`. Plus `new-user` on `/app/home` only (`HomeNewUser`,
`src/components/app/home/home-view.tsx:212-262`).

Viewports: **320 · 390 · 768 · 1440**. Themes: **light · dark**.

### 17.2 Per capture

1. Full-page PNG.
2. Playwright ARIA snapshot (`.aria.txt`).
3. A structural-audit row: title, `mainCount`, `h1Count`, heading list, navigation landmarks
   with names and link counts, region names, **every** `aria-current` with value, text and
   href, nested-interactive count, and horizontal-overflow measurement. The existing capture
   script already emits all of this (`scripts/home-layer/capture-current-product.mjs:66-84`)
   and is extended, not replaced.
4. For interaction states: a keyboard focus-order trace.

### 17.3 Per route, once

5. `scripts/check-contrast.mjs` against a **live** server, light and dark (§13.2 rule 5).
6. An axe run, recorded as supporting evidence only (§13.2 rule 6).
7. `scripts/check-tap-target-scale.mjs` clean, with no new ledger entries.
8. `scripts/check-first-contact-language.mjs` clean, baseline unchanged or smaller.
9. `pnpm perf:budgets` after a clean production build (§16).
10. A named run per required assistive-technology pairing, or an explicit `unproven` (§15).

### 17.4 What the evidence must say about itself

Every package carries its own honest-limits statement, in the form
`design/current-product-evidence/README.md` already uses. Synthetic and live evidence are
**visibly separate** (charter definition of done). A package that does not say what it could
not measure is not evidence.

### 17.5 Three harness facts that constrain the schedule

- **`experience:fixtures` already fails at base.** `node scripts/experience/critical-fixtures.mjs`
  exits 1 with `registry coverage or materiality hashes are stale`, reproduced on a pristine
  detached checkout with none of this programme's files present (`R-H03`). Every Home
  `page.tsx` / `loading.tsx` / `error.tsx` added to `experience/registry.json` re-triggers the
  cascade, and it may **not** be resolved by a blanket `--write` without inspecting every
  material diff.
- **No visual-regression baseline exists anywhere.** `toHaveScreenshot` is configured but never
  called; there is no `experience/baselines/`; `approvedBaselineReference` is `null` on all 78
  registry entries; approval is founder-owned (`R-H09`). Until baselines exist and are
  approved, **"this did not regress an untouched surface" is not provable** and must not be
  claimed.
- **The 9.5 council cannot currently certify anything.** It requires 1,352 evidenced human
  taste scores plus 4 journey receipts, automation is barred from awarding them
  (`quality-council-gate.json:234`), and in CI it runs `continue-on-error`. Narrowing its scope
  is an open founder decision at `studio/content/hq/operator-todos/rule-on-95-gate-scope.md`
  (`R-H08`). Until it is taken, **"certified" is unavailable as an outcome** and this programme
  says so rather than claiming it.

---

## 18. Executable assertions

Written this wave, in `src/lib/home-layer/experience/` — a path this programme owns and no
live lane holds (`COLLISION_REGISTER.md` §2). **Every assertion fails at this base, and that
is the deliverable.**

```
node --test src/lib/home-layer/experience/home-experience-contract.test.mjs
    20 tests · 5 pass · 15 fail
```

Measured 2026-08-12 at `78021c5`, against the capture in
`design/current-product-evidence/`. The file asserts the contract **against the
rendered product**, so it passes when the product is fixed and the capture is
re-taken with `node scripts/home-layer/capture-current-product.mjs`. The five
passes are the §1.2 baseline held as regression guards: no title says "Tasks"
or "workspace"; no heading level is skipped; no horizontal overflow at 320 px;
zero nested interactive controls inside a link; `scroll-margin-top` is still
128 px.

| # | Assertion | Fails today because |
|---|---|---|
| X1 | Every Home route has a route-specific `<title>` in the sealed form (§2) | three routes do not exist; `/app/home/briefing` is `Briefing · Signal Studio`, not `Full briefing · Home · Signal Studio` |
| X2 | Exactly one `h1` per Home route, in every captured state and viewport | true for the two that exist; **untestable for three that do not**, and `/app/your-work` proves the failure mode is real |
| X3 | No heading precedes the `h1` in DOM order | four routes emit a visible `h2 "Project folders"` first at 1440 (F6) |
| X4 | The heading level sequence is identical at 320, 390 and 1440 | it is not, on the same four routes (F6) |
| X5 | Exactly one element in the DOM carries `aria-current="page"`, and its href equals the current pathname | `/app/home/briefing` marks `/app/home`; `/app/inbox` carries three at 1440 and two wrong ones at 390 (F1, F2, F3) |
| X6 | `aria-current` appears only on elements with an `href` or a control role | two captures carry it on `href: null` nodes (F4) |
| X7 | The Inbox count appears exactly once in the accessibility tree, and never adjacent-concatenated into a name | the DOM text is `Inbox8`, and two differently-named Inbox affordances exist (F5) |
| X8 | Every navigation landmark on a Home route has a unique non-empty name | `/app/inbox` and `/app/my-tasks` each carry an unnamed one with four links (§1.3) |
| X9 | Every `<section>` carrying a heading is named | Inbox has 3 unnamed, My work 4 (F8) |
| X10 | A row's accessible name is identical at 320 and 1440 | Home's review row drops its provenance at 320 (F9) |
| X11 | `scroll-margin-top` in the global focus block is still 128 px, or the change is recorded | not asserted anywhere; a Home mode nav changes the sticky height |
| X12 | The skip-link target resolves to exactly one element on every Home route, in every state | `/app/your-work` has the link and no target |
| X13 | No Home surface renders a success state before the source confirms it | no Home mutation exists; every Tasks mutation silently no-ops cross-Project (`src/server/actions/tasks.ts:114`) |
| X14 | All five Home routes × 2 themes are in `scripts/check-contrast.mjs`'s sweep | `/app/home` is not in the sweep at all (`:44-56`) |

---

## 19. Decisions taken here

`D-HX` prefix, so these cannot collide with `PROJECT_SCOPE.md`'s `D-H01…D-H13`, with
`HOME_ROUTE_AND_RETURN_CONTEXT.md`'s `D-HR01…D-HR11`, with the Project Truth wave's
`D-001…D-017`, or with a sibling Wave 1 lane appending concurrently. **The lead should fold
these into `DECISIONS.md` on a merged base**; this contract does not edit that shared ledger.

**D-HX01 · Route titles are static, mode-first, and carry no Project name.**
§2. The decisive reason is the third: a title that varies with Read Scope would change on a
`replace`, which is not a navigation, so assistive technology would announce a page change
that did not happen. Static also keeps titles deterministic for X1 and keeps a Project name
out of a screenshotted tab strip.

**D-HX02 · The `h1` must identify the mode, and two patterns satisfy it.**
§3.1 rules 5–6. Requiring the mode name as the bare `h1` would delete the editorial register
that is the point of the surface; permitting a purely expressive `h1` leaves a
heading-navigating reader with no orientation. The visible eyebrow inside the `h1` satisfies
both, hides nothing from anybody, and is a small change from what ships today.

**D-HX03 · No chrome landmark carries a heading element.**
§3.1 rule 2. The alternative — allowing headings in chrome at a level below the page `h1` —
requires every landmark to know the page's heading depth, which is exactly the coupling that
produced `h2 "Project folders"` before the `h1` on four routes.

**D-HX04 · Subtree match is `aria-current="true"`; exact match is `page`.**
§5 R3. This is the single smallest change that fixes F1, and it uses an ARIA value the
repository already ships in two other places rather than introducing a convention.

**D-HX05 · The one-`page` rule is asserted against the DOM, not the exposed tree.**
§5 R6. Four routes currently satisfy the exposed-tree version of the rule *by CSS*. A
breakpoint change would break an accessibility invariant with no test failing, which is the
worst available failure mode: silent, viewport-specific, and invisible to everyone who can see.

**D-HX06 · Optimistic UI is prohibited on Home until writes are Project-parameterised.**
§11. Not a preference. `src/server/actions/tasks.ts:114`, `:118-122` returns success for a
cross-Project write that did nothing. Optimistic rendering over that is a UI that lies about a
task being done, and the reader has no way to discover it.

**D-HX07 · Home text at or below 13 px meets 7:1, not 4.5:1.**
§13.2. The repository declared this floor itself (`src/app/globals.css:128-132`) and then wired
the utility to a 4.83:1 value. Home is the surface where the metadata *is* the content —
provenance, timing, source — so the smallest type carries the most load-bearing facts. Adopting
AA here would be adopting a standard the design system has already rejected in writing.

**D-HX08 · Content parity across viewports is a hard rule, not a responsive convenience.**
§12 rule 4. A row that drops its provenance at 320 makes an unsourced claim to mobile readers,
and charter locked decision 12 forbids Home from asserting anything it cannot attribute.

**D-HX09 · Every unrun assistive-technology pairing is recorded `unproven`, and NVDA + Firefox
and VoiceOver + Safari are required.**
§15. Inferring one pairing from another is how accessibility claims become false; those two
disagree most often on exactly the landmark and `aria-current` behaviour §5 governs.

**D-HX10 · The Home mode navigation is a Server Component.**
§16 rule 2. With 0.9 KB of shared-runtime headroom, chrome that renders on every Home route
cannot be a client island. It also makes X5's DOM-level assertion checkable without a browser.

---

## 20. Open, and owned elsewhere

1. **Three of the five routes do not exist**, so X1–X4 and X7–X10 are only partially
   measurable. Wave 4 makes them measurable; the assertions are written now so they cannot be
   forgotten.
2. **The scroll owner is ambiguous** — two nested scroll containers (§8 rule 3). Blocks the
   restoration contract from being tested at all. Owner: Wave 4.
3. **One measure, or four?** 760 / 960 / 820 / 768 (§12 rule 7). Needs a design decision, not a
   contract rule. Owner: Wave 3 lab → founder selection.
4. **`--x-ink-quiet` has no Tailwind utility** (§13.2). Fixing it touches
   `src/app/globals.css`, which is shared with every product. Owner: lead, before Wave 4.
5. **`scroll-margin-top: 128px`** was set for the current sticky chrome height (§7 rule 6). A
   Home mode nav changes it. Owner: Wave 4, with X11 as the tripwire.
6. **Delight F8 and F10 are open founder questions**, and F10 lands on Today's Signal (§14).
   Owner: Ethan.
7. **No visual-regression baseline, and the 9.5 council cannot certify** (§17.5, `R-H09`,
   `R-H08`). Both are founder-owned and both are needed before Wave 10, not at it.
8. **Field performance cannot be measured** (§16, `R-H05`). A RUM provider is wired during this
   programme, or promotion needs recorded founder risk acceptance. Decision needed before the
   first external cohort.
9. **`/app/your-work` returns 200 with no `main` and no `h1`**, and is the redirect target of
   `/api/suite-context` in both branches. Not this programme's file; recorded so it is not
   inherited.
