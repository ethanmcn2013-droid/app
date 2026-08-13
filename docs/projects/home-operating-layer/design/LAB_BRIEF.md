# Lab brief — four directions for the Home operating layer

**Status:** authored Wave 0/1, executed Wave 3
**Author:** programme lead (design judgment is not delegated)

The architecture is **fixed and not up for debate**. This lab selects its *expression*. Read
`CHARTER.md` §"Locked product decisions" before you draw anything: if a direction changes the
route hierarchy, the four fixed modes, the product taxonomy, source truth, permissions or
accessibility, it is not a direction, it is a rejected proposal.

## What is being designed

> The authenticated Home operating layer — its global context, its four local modes, and the
> movement between them.

Four modes, one system: **Today · Inbox · My work · Analytics**, with Full briefing as depth
from Today. Every direction must express all four and the movement between them. A direction
that nails Today and hand-waves Analytics has not entered the lab.

---

## Design ambition — read this before the constraints

Signal Studio's design register is explicit and it outranks caution:

> Confident, premium, expressive — edited, not timid. Reach further than feels safe in
> exploration; restraint is the edit at the end, never the brief at the start.
> **Creativity and emotion outrank restraint. No rule may be used to flatten a genuinely
> better idea.**

So: the constraints later in this document are **engineering facts about what can ship**, not
permission to design something safe. A quiet interface is not the same as a timid one. The
target is an editorial operating system that a founder is glad to open at 7am — exact,
composed, and with one moment in it that they remember. Four competent variations on a list
view is a failed lab.

The one standing exception, which never bends: **voice**. Plain English, active verbs, no
exclamation marks, no em dashes, no AI-marketing vocabulary. `studio/BRAND.md` governs.

---

## The four directions

Distinctness must come from **composition, rhythm, hierarchy, navigation, detail behaviour,
disclosure and motion**. A different palette, radius or typeface is not a direction — presenting
one as a direction is an automatic veto.

| | Direction | Structural thesis | Why it could win | Its honest cost |
|---|---|---|---|---|
| 1 | **Editorial Line** | Quiet horizontal Home navigation, narrow reading measure, typographic hierarchy, restrained ledgers | The most faithful continuation of briefing-first Signal Studio | Least assertive identity — risks reading as "just a page" |
| 2 | **Context Rail** | A labelled secondary Home rail on wide screens, collapsing to complete text navigation | Strongest persistent orientation for frequent mode-switching | Width pressure; the three-column Inbox is a real trap |
| 3 | **Reading Index** | A typographic Home masthead/index that becomes the document's own structure | Strong editorial identity with no ornamental chrome | Costs vertical space; demands genuinely good type craft |
| 4 | **Signal Desk** *(wildcard)* | A warmer, more expressive operating surface with restrained spatial continuity and one signature Signal gesture | Most memorable and emotionally distinctive | Highest responsive, motion and implementation risk |

**The wildcard's licence and its limit.** Per the workspace lab ritual, Desk's rules go out the
window — register, palette, motion limits, chrome. It may challenge anything about *expression*.
It may **not** touch route hierarchy, the four fixed jobs, source truth, permissions,
accessibility or voice. If Desk wins on a rule the register currently forbids, that is a
calibration signal and triggers a register amendment, never a silent per-lab exception.

---

## Amendment 1 — what the width is for (added 2026-08-13, after two panel rounds)

Two blind panels raised "never earns its width" **44 times across all four directions**. That is
not four teams making the same mistake. It is this brief's fault, and it is corrected here.

The original text asked for "a narrow authored read" and a "prose-led" Analytics, and then said
nothing about what the remaining 600px of a 1440 screen is for. Four teams followed it and ten
directors marked all four down for following it.

**A narrow measure is a decision about text. It is not a decision about the page.** Reading
measure governs the *prose*; it does not oblige the rest of the canvas to stay empty. A direction
must make a deliberate decision about the full width and be able to name it. Any of these is a
good answer; leaving it blank is not:

- a second column that carries something genuinely different — provenance, receipts, an index,
  read-state, a contents table;
- asymmetry that positions the measure rather than centring it by default;
- letting one thing per mode legitimately break the measure (a Project ledger, an open event);
- a deliberate, defended margin — but then say *why* the emptiness is doing work, because a
  reviewer will otherwise read it as an unmade decision.

The three-item cap on Today still stands. It is a cap on **decisions**, never a cap on the page.

## Amendment 2 — a new reader is not a failed read (added 2026-08-13)

Every direction rendered a person's first ever screen as an error, because the shell resolved
that world to `unavailable`. That was a shell defect and it has been fixed, but the principle
belongs here permanently:

> **Nothing configured yet is not the same as a read that failed.** Somebody with no Projects has
> not suffered an outage; they have not started. Rendering *not yet* as *broken* is this
> programme's own governing rule pointed the wrong way.

A new reader's screen must carry one plain sentence explaining what is missing and **one thing
they can actually do**. A first screen with no action on it is a failure of the direction,
whatever the shell hands it.

## Mode rhythm — the composition each mode needs

- **Today** — a narrow authored read. At most three ranked decisions. Not a task wall.
- **Inbox** — a controlled queue plus correspondence/detail. Only split at widths that earn it.
- **My work** — a calm responsibility ledger with strong row rhythm. Not a board, not a grid.
- **Analytics** — prose-led opening, one earned widening for the Project ledger. Not a chart wall.
- **Shell** — quieter than the content, never dominant.

## Surface language

Lists before cards. Rules, alignment, type, rhythm and whitespace before containers. Indigo
`#4f46e5` as the anchor — its tints, gradients and supporting tones are welcome when the moment
earns them; semantic colour only where meaning requires it. Product provenance quiet but always
visible on cross-product rows. Direct actions on the row, secondary material on demand. Quiet
states intentionally sparse. One earned signature moment per direction.

**Rejected on sight:** generic card grids · four equal summary cards · giant KPI numerals ·
dashboard widget furniture · rainbow chips · gradient or glow "AI" chrome · excessive pills ·
icon-only operational navigation · stock shadcn/Vercel layouts · decorative charts · empty
furniture used to make a quiet day look busy · glass everywhere · spectacle without user value.

---

## Hard constraints — engineering facts, discovered in Wave 0

These are not style preferences. A direction that violates one cannot ship, so know them before
you compose.

### 1. There is 0.9 KB of shared-runtime headroom. For the whole programme.

`perf:budgets` at base: `shared_runtime` 246.1 KB gzip against a 247 KB ceiling (target 170 KB,
already over). `largest_chunk` 62.5 KB against 63 KB. `total_client_js` 898.8 KB against 940 KB.
A previous multi-shell lab cost 19.1 KB and **deleting it is what recovered the budget**.

**What this actually means for design:** it forbids a heavy always-loaded client shell. It does
*not* forbid ambition. Server Components render for free; route-local client islands are cheap;
CSS is cheap; type, rhythm, layout and colour are free. Motion via transform and opacity is
free. What is expensive is a large JS shell that every route pays for. Design richly, hydrate
narrowly.

### 2. Home may not inherit the Tasks runtime.

`/app/inbox`, `/app/my-tasks`, `/app/project` and `/app/tasks` are the only four routes that
**never reach network idle** — they hold an open connection — and they carry 5–7 navigation
landmarks each. Home currently carries 2 and settles. Inbox and My work components call
`useTaskPanel`, `useTasks`, `useDomain`, `useColumnConfig`, `usePersonalization` and
`useCalendarFrame`; without that runtime they break, and with it Home inherits a first-run
redirect to `/welcome`. Evidence: `design/current-product-evidence/README.md`.

### 3. Type and spacing traps.

The codebase carries 1,208 arbitrary-px type utilities against 126 uses of the nine named
steps — do not add to the arbitrary pile. In the Tailwind spacing namespace, indices 7–12 do
**not** mean what they read (`h-7` is 32px, not 28px). Tokens are vendored at `src/ds/tokens.css`
and must never be edited locally; `ds:check` forbids overrides.

### 4. The baseline is decent. Do not regress it.

Every current surface that renders has exactly one `main`, one `h1`, zero nested interactive
controls inside a wrapping link, and **no horizontal overflow at 320px**. That is the floor.

### 5. Every lab route needs a registry entry and a materiality receipt.

`experience/validate.mjs` auto-discovers every `page`/`loading`/`error` under `src/app` and fails
on unregistered surfaces. `/app/home` is `reviewTier: critical`.

---

## Required working journeys — all sixteen, in every direction

No dead controls, no "imagine this" labels, no lorem ipsum, no placeholder panels, and no
success toast without a real state transition.

1. Change Home mode while preserving Home Read Scope.
2. Change Read Scope and update all four modes.
3. Open Full briefing and return to the exact Today position.
4. Open an Inbox event.
5. Mark it read **without** resolving it.
6. Snooze it and show the exact resurfacing time.
7. Complete a simulated source approval; resolve only after success.
8. Fail a source action; keep the event open and show recovery.
9. Clear an event without mutating source work.
10. Open a My work row and preserve its source return path.
11. Perform one safe fixture writeback and reproject.
12. Open an Analytics Project row.
13. Reach an exact evidence receipt from a claim.
14. Use Back and restore mode, scope, selection, focus and scroll.
15. Open Search, Project scope and Account by keyboard and pointer.
16. Revoke permission between list and detail, and remove stale metadata.

## Required non-ideal states

A direction is judged as much on these as on the signature screen. Quiet Today · zero Inbox ·
partial coverage · stale data · permission-limited · provider failure · insufficient history ·
no accepted baseline · action failure · new user with no Projects · scale (18+ Projects, 50
grouped events, 60 responsibilities, long names).

**The governing rule:** unknown stays unknown. Missing, incomplete, unsupported, stale,
permission-limited, failed or insufficient-history data may never render as zero, healthy,
complete, empty or all clear. A quiet day and a broken provider must be visibly different.

## Responsive and accessible, as composition not compliance

Inspect at 1440×1024, 1280×900, 1024×768, 768×1024, 390×844, 375×812, 812×375, 320×568,
568×320, plus real 200% and 400% browser zoom, 200% text enlargement, keyboard, coarse pointer,
reduced motion, forced colours, and both themes.

At 320px and 400% effective reflow: no horizontal page scroll; Home, Notes, Tasks and Timeline
stay visible primary destinations; all four Home modes stay text-labelled and reachable; **no
mode hidden under More, the avatar, an unlabelled icon, or horizontal-scroll discovery**; Inbox
detail becomes a full-screen route or sheet and restores focus; Project scope becomes a labelled
sheet. Mobile is a transformation, not a compressed desktop.

Home-local navigation is **real route links with `aria-current`**, never ARIA tabs. Only the
most specific Home-local link claims `aria-current="page"`. Named Suite/Products/Home landmarks,
one `main`, one `h1`, a visible skip link, visible unobscured focus, semantic lists rather than
rich-row listboxes, no nested buttons inside wrapping links, 44×44 CSS px for primary controls,
one stable polite status region, and no state carried by colour alone.

Motion under 300ms for routine transitions, transform and opacity preferred, context preserved
on detail/return/scope/evidence. No count-up metrics, no parallax, no perpetual animation, no
motion that delays operability. Reduced motion removes movement while preserving comprehension.

---

## How a direction is judged

Ten sealed independent directors, neutral candidate labels, no ballot shared, no architect
preference disclosed. **Admission** needs every director ≥ 8.5 overall and on their owned lens,
no criterion below 8.0, zero vetoes, and all sixteen journeys working. The lab is only ready
when **four** directions independently pass — a strong average cannot carry a weak one, and if
one cannot pass on its own terms it is replaced by a new structural direction, not quietly
dropped or waved through.

After Ethan selects, the chosen direction must clear a **9.5** promotion gate before any
production code is written.
