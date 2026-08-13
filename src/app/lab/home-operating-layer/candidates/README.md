# Building a direction

One folder each. Nothing outside it.

```
candidates/editorial/     variant 1 · picker label "Editorial"
candidates/rail/          variant 2 · picker label "Rail"
candidates/index/         variant 3 · picker label "Index"
candidates/desk/          variant 4 · picker label "Desk"
```

Your folder must contain `candidate.tsx`, which default-exports a component:

```tsx
import type { HomeCandidate, HomeCandidateProps } from "@/lib/home-layer/lab-shell";

const Editorial: HomeCandidate = (props: HomeCandidateProps) => {
  // …
};

export default Editorial;

// Optional, and only if your direction occupies the bottom centre of the
// screen. It moves the picker to the one permitted alternative position.
export const pickerPosition = "top";
```

Everything else in the folder is yours: components, CSS modules, helpers.

---

## What you are handed

`HomeCandidateProps`, built once on the server from the fixture universe. All
four directions receive the same object. It carries:

| | |
|---|---|
| `meta` | your variant number, slug and neutral label, and whether a capture is running |
| `state` | the parsed URL: mode, world, scope, window, selection, theme |
| `world` | which of the thirteen worlds is on screen and what it exists to prove |
| `chrome` | document title, mode eyebrow, the four mode links with their `aria-current`, the scope control and its options, the actor, the Active Project, the read time |
| `today` `inbox` `myWork` `analytics` `briefing` | the five view models, rows already composed |
| `copy` | every shared label |
| `motion` | the estate's durations, and how replay works |
| `hrefFor(patch)` | the only way to write a lab URL |

You get all five view models on every render, not only the current mode. That
is so a count you show on Today is the same count Inbox shows, by construction.

---

## The rules that are not negotiable

**Do not import the fixtures.** Not `@/lib/home-layer/fixtures`, not
`@/lib/home-layer/inbox`, not `assemble`. One import, from
`@/lib/home-layer/lab-shell`. The lab's import graph is walked by a contract
test, so this is checked, not trusted.

**Do not write a string the shell already publishes.** Row titles, reasons,
provenance, dates, counts, state sentences, disclosures, action labels and
empty lines are all composed for you. Reach for `props.copy` before you type
a word. You may of course write structural copy the shell does not carry — a
section lead-in, a caption on your own composition — under `studio/BRAND.md`:
plain English, active verbs, no exclamation marks, no em dashes, no marketing
vocabulary.

**Do not build a URL by hand.** `props.hrefFor({ mode: "inbox" })`. String
concatenation of a lab path is how the four directions stop agreeing about
where a link goes.

**Never render an unknown as a zero.** Every view model separates "nothing"
from "could not be read". `openWorkLabel` is `null` when the count could not
be read, and `copy.unreadableCount` is what goes there. A quiet day and a
broken provider must look different on your screen.

**Every disclosure has to reach the reader.** You choose whether a disclosure
is on the surface or one interaction away. You do not choose whether it
exists. A screen with `disclosures.length > 0` and nothing on it disclosing
anything has failed.

---

## What you own, and it is most of the design

Composition of all five modes. Reading measure. Type scale, within the
vendored tokens at `src/ds/tokens.css` — never edited, never overridden.
Rhythm and grouping of rows. The navigation model. What is disclosed on
arrival versus on demand. Detail behaviour, including whether a selection is a
route (`hrefFor({ item })`, `hrefFor({ event })`) or an in-place disclosure.
The responsive transformation. Motion. One earned signature moment.

You also own the document's structure, because it is a composition decision:

- exactly one `<main id="app-main-content" tabIndex={-1}>`
- exactly one `<h1>`, with `chrome.modeEyebrow` inside its accessible text
- a visible skip link, first in tab order, whose target resolves
- named navigation landmarks, with `chrome.navLabel` on the Home mode nav
- exactly one `aria-current="page"` in the document, on the mode link that
  carries it in `chrome.modes`
- no nested interactive control inside a wrapping link
- no horizontal overflow at 320 CSS px

---

## Motion and replay

The picker's `R` key re-mounts your whole subtree. Anything that animates on
mount replays for free. Entrance state held in a client store does not replay,
so keep it in the markup.

Transform and opacity only. Under 300 ms for routine transitions. Reduced
motion is already suppressed four ways in the estate; do not add a fifth
mechanism, and make sure your motion still leaves the screen comprehensible
when it is removed rather than briefly invisible.

---

## Running it

```
/lab/home-operating-layer?v=1&mode=today&scenario=owner_signature
```

`v` 1–4 · `mode` today|inbox|my-work|analytics|briefing · `scenario` one of the
thirteen · `homeScope` all|project|planning-period · `workspaceId` ·
`planningPeriodId` · `period` · `theme` light|dark · `capture` 0|1, plus
`event` and `item` for selection.

Number keys and arrows switch direction. `R` replays. The review drawer, at
the bottom right, changes mode, world, scope and theme. `capture=1` removes
all of it.

The route is behind the reviewer guard: `HOME_REVIEW_LAB_ENABLED=true`, a
non-review access mode, real Clerk keys, and a signed-in reviewer on the
allowlist. Every refusal is a 404.
