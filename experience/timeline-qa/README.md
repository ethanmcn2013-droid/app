# Timeline visual-QA harness

Reusable, re-runnable capture of the Timeline redesign across every required
state and viewport. Built under `experience/timeline-qa/` per the workspace
file-ownership rule for this task: nothing here touches `src/`, `scripts/`,
or `package.json`.

## What it does

`timeline-visual-qa.spec.ts` drives a real Chromium browser through every
combination of:

- **15 states** (`routes.ts`): 10 fixture-workspace projects (empty, one
  undated, one dated, two dated, five mixed, five untimed, partial timing,
  overdue, twenty-two milestones, long text), the review project (Mara and
  Finn) in its Timeline tab / Milestones tab / Preview route / Share dialog
  forms, and the public bearer artifact at `/s/[token]`.
- **10 viewports** (`viewports.ts`): the seven sizes named in the brief
  (1920x1080, 1600x900, 1440x900, 1280x800, 1024 wide, 768 tablet, 390x844
  mobile) plus the three 200%-zoom emulations (960x540, 800x450, 720x450).

Every one of the 150 combinations is a real route -- no synthetic harness
pages -- reached the same way a browser reaches it, including the Share
dialog, which is opened by clicking the real "Share" button rather than
asserted from source.

For each combination it writes:

- a full-page PNG screenshot
- a JSON measurement record (see "What is captured" below)

and it hard-asserts, as real Playwright pass/fail, the four invariants the
brief called absolute: the expected HTTP status, zero console/page/network
errors, zero horizontal overflow, and zero ancestor-clipped text.

## How to re-run

The harness targets an ALREADY-RUNNING server -- it does not start one. Confirm
the target server responds first:

    curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3520/app/timeline

Then, from the repository root:

    corepack pnpm exec playwright test --config experience/timeline-qa.playwright.config.ts

Narrow to one state or viewport with a grep pattern, for example only mobile:

    corepack pnpm exec playwright test --config experience/timeline-qa.playwright.config.ts -g "mobile-390"

or only the twenty-milestone fixture:

    corepack pnpm exec playwright test --config experience/timeline-qa.playwright.config.ts -g "fixture-twenty-plan"

Then roll the per-file JSON up into one summary:

    node experience/timeline-qa/aggregate.mjs

which writes `_summary.json`, `_summary.csv`, and prints a pass/fail table to
the console. To compare against an earlier run (the reusability the brief
asked for):

    node experience/timeline-qa/aggregate.mjs <newRunDir> --compare <oldRunDir>

### Environment variables

- `TIMELINE_QA_PORT` -- port of the target server. Default `3520`.
- `TIMELINE_QA_OUT_DIR` -- where screenshots and JSON are written. Default
  `<os tempdir>/timeline-qa-captures`, so captures land outside the repo by
  default, per the task brief ("put captures somewhere sensible under the
  scratchpad, not in the repo"). Set this explicitly to the scratchpad path
  you want, for example:

      TIMELINE_QA_OUT_DIR="/c/Users/<you>/AppData/Local/Temp/claude/<session>/scratchpad/timeline-qa-runs/2026-08-06T01-00-00" \
        corepack pnpm exec playwright test --config experience/timeline-qa.playwright.config.ts

## Output layout

    <OUT_DIR>/
      _run-meta.json          -- states, viewports, source-file mtimes at run start
      _summary.json           -- one row per state x viewport (after aggregate.mjs)
      _summary.csv            -- same, as a spreadsheet
      screenshots/
        <stateId>__<viewportName>.png
      measurements/
        <stateId>__<viewportName>.json

## What is captured, per state x viewport

Each `measurements/<id>.json` file holds one `TimelineQaMeasurement` (full
shape documented in `measure-in-page.ts`), plus run context: requested path,
resolved URL, HTTP status, a keyboard-focus sample, the raw runtime issue
list, and a provenance block recording the on-disk modified time of the nine
source files this harness reads structure from -- so two runs that disagree
can be checked against whether the underlying component actually changed.

Headline fields: document scroll/client height and width, horizontal and
vertical overflow, footer presence and whether it sits within the first
viewport, the artifact density/axis/title-length attributes, hero title text
and estimated line count, the progress metric and progressbar values, every
milestone marker state and colour with pairwise label/dot collision
detection, month-tick density, and the full clipped-text list.

## Confidence tiers

Not every field is equally trustworthy. Each tier below is a real distinction
in how the field is obtained, not a hedge:

**Tier 1 -- generic, always reliable.** Document scrollHeight/scrollWidth
versus viewport, console/page errors, failed requests, HTTP status. These
read only the DOM/window/network primitives every page has; they do not
depend on this component's internals at all and cannot be broken by a
refactor.

**Tier 2 -- structural, reliable while the current data-* contract holds.**
Milestone state/collision detection, artifact density/axis attributes, the
metric and progressbar values, the footer scope. These key off `data-*`
attributes and ARIA roles already present in `timeline-artifact.tsx` (for
example `data-timeline-artifact`, `li[data-state]`, `role="progressbar"`).
If a future edit renames or removes one of these attributes, the matching
field goes quietly to `null`/`false`/`0` instead of erroring -- it will look
like "this state has none of that thing" rather than "the selector broke".
A screenshot that disagrees with an all-null measurement is the tell; always
cross-check a suspiciously empty result against its screenshot before
concluding a state genuinely has nothing.

**Tier 3 -- heuristic, explicitly labelled in the JSON.** Month-tick counts
are found via a CSS module class-name substring match
(`[class*="monthTick"]`), because the tick elements carry no `data-*` marker.
This works only because the target server runs Turbopack in dev mode, which
keeps a readable fragment of the original class name; it would silently
return zero against a minified production build. Every field obtained this
way carries `selectorConfidence: "class-name-heuristic"` next to it. Treat it
as directional, not authoritative.

**Tier 4 -- derived, approximate.** Hero `estimatedLines` (rect height
divided by computed line-height) and progress `fillScaleX`/`fillScaleY`
(parsed back out of a CSS `matrix(...)` transform string) are arithmetic, not
values the component states directly. Good for noticing a title that grew
from one line to three between two runs; not to be quoted as an exact pixel
fact.

## What the clipped-text check can and cannot prove

The check compares each text-bearing element's own rendered rect against
every ancestor whose computed `overflow-x`/`overflow-y` is `hidden` or
`clip` (the case the brief specifically called out: `overflow: clip` creates
no scroll container, so `scrollHeight` never reveals it). What it can prove:
that specific text, at that specific viewport, in the settled resting state,
after motion finishes, is or is not geometrically cut off by a real clipping
ancestor. What it cannot prove: anything about the mid-transition state
(motion is forced to reduced for determinism, so the harness never sees a
real user's animated entrance), anything that only clips on hover or focus,
or whether a flagged clip is actually a defect versus a deliberate crop (a
decorative mask would be flagged exactly the same way as a real bug -- a
human has to look). It also has no concept of paint order: two rects can be
reported as overlapping while one is fully behind an opaque sibling and
never visually collides for a real viewer. Geometry, not vision.

## Harness trustworthiness -- said plainly

A measured DOM is not the same as a human looking at a pixel. Concretely,
this harness:

- CAN prove, with real numbers: whether a page needs scrolling it should not
  need, whether anything overflows horizontally, whether specific text is
  geometrically clipped or two milestone labels geometrically overlap,
  whether the console/network stayed clean, and what a specific computed
  colour or font-size actually is.
- CANNOT judge whether a colour is aesthetically distinguishable enough (it
  can quote the raw `rgb()` values on either side of a decision; whether
  they read as different to an eye is not computed here), whether spacing
  feels generous or cramped when nothing is technically overflowing or
  clipped, whether an animation is smooth (motion is deliberately disabled
  for determinism, so the harness never observes the transition most users
  will see), or whether copy reads naturally.
- Screenshots are the closest thing here to a human looking at a pixel, but
  the PNG files are only evidence -- a person (or another pass of this agent)
  still has to open them and look. The JSON alone does not generate a design
  verdict.

### The target dev server was observed to hang for over an hour during the
### session that built this harness

Factual record, not speculation: while building this harness against
`http://localhost:3520`, the public bearer route (`/s/[token]`) returned
HTTP 500 ("Jest worker encountered 2 child process exceptions, exceeding
retry limit"), and shortly after, EVERY route on that server -- including
ones that had been fast moments before -- stopped responding entirely for
over an hour of wall-clock time, confirmed by repeated short-timeout probes
and by `netstat` showing accepted-but-never-completed connections
(`CLOSE_WAIT`/`FIN_WAIT_2`) piling up against the same process ID. The
process itself stayed alive throughout (confirmed indirectly: attempting a
second `next dev` on a spare port was refused with "Another next dev server
is already running", naming that same PID) -- this was an application-level
hang, not a crashed process. It later recovered on its own with no action
taken by this harness.

Practical consequence: if a re-run of this suite comes back mostly red,
check server health first (`curl -m 10 -o /dev/null -w "%{http_code}\n"
http://localhost:3520/app/timeline`) before reading the failures as
redesign regressions. This harness cannot tell the difference between "the
component broke" and "the dev server stopped answering" from inside a single
run -- both surface as a failed navigation or a timeout. Cross-referencing
several states failing AT ONCE, with no shared code path, is the signal that
it was the server, not the page.

## Known, disclosed judgment calls

The brief left two viewport heights unspecified ("1024 wide", "768 tablet").
This harness uses 1024x768 and 768x1024 (portrait) -- see `viewports.ts` for
the reasoning. Change `viewports.ts` if a different pairing is wanted; this
was a documented choice, not an oversight.
