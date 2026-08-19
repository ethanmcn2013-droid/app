# Elevation brief · timeline-redesign · 2026-08

## Target
Signal Timeline is how one person hands another the plan for a day that
matters. An owner builds the plan; an audience — a couple, their families, a
venue — receives it as something finished. The flagship case is a wedding: the
owner is a planner or the couple themselves, and the people receiving it will
open it once, on a phone, probably while doing something else, and will judge
the whole company by that one screen. Everything from the owner's first empty
project to the printed keepsake on the morning itself is in scope. Timeline
goes first in a suite-wide redesign because it is the surface with the most
feeling in it; whatever wins here becomes the language Home, Notes and Tasks
adopt next.

## Audience
Someone organising the most important day of their life, who has never used a
project-management tool and never will, plus the guests they share it with.

## Fixture
The real Mara & Finn review timeline, through the real code path. Source of
truth in the repo: `src/lib/review-suite-fixture.ts` (the ten milestones, the
pinned review clock `2026-07-16`, the wedding day `2026-10-03`, last updated
`2026-07-15T18:30Z`), projected publicly through the production DTO validator
in `src/modules/timeline/lib/review-audience-fixture.ts`. Owner-side context —
workspace "The Orchard, events", owner Orla, sibling projects Nora & Cian and
Aisling & Tom — comes from the same file. State labels come from
`src/modules/timeline/lib/vocabulary.ts` (Complete · Happening now · Coming up
· Later · Not going ahead). Real share links anchor on
`https://timeline.signalstudio.ie/s/<43-char token>`
(`src/lib/product-urls.ts`, `src/lib/suite-contracts.v1.json`). Never
placeholder text, never a hand-rolled imitation of the data.

Note on the brief's dev instruction: the repo's demo switch is
`SIGNAL_ACCESS_MODE=demo` / `NEXT_PUBLIC_SIGNAL_ACCESS_MODE=demo`
(`DEMO_MODE.md`), not `NEXT_PUBLIC_DEMO_MODE=true`. The reference capture uses
the real switch.

## States
Eleven, from the founder's canonical ten. The only fold-out: item 10 named two
different screens — an ended link and honest loading — and they grade
differently, so they are separate states. Nothing else is folded; the product's
wider state space (settings, billing, workspace admin) is out of scope below.

- `owner-flight` · owner · a project in full flight
- `owner-empty` · owner · a brand-new project with nothing in it yet
- `owner-editing` · owner · building and editing (labels, dates, order, what is
  visible to whom)
- `publish` · the publish ceremony — a private plan becoming someone else's copy
- `phone` · the received artifact at 390px (the one that decides everything)
- `desk` · the received artifact at desk width
- `day` · the day itself — the wedding morning
- `print` · the print keepsake
- `unfurl` · the link's first impression, unopened, in a chat app
- `ended` · the link that has been revoked or has expired
- `loading` · honest loading

## Register and materials
Open. The founder's stated taste, to serve or to argue past with evidence: the
register xAI/Grok, X and SpaceX share — ink and white, enormous confidence,
nothing decorative, one accent used rarely and meaning something when it
appears. Ours is indigo. A direction may propose a different material system
for the suite; the panel judges it.

Starting palette lock (rewritten at the lock from the winning direction):
Ink `#111111` · Indigo `#4f46e5` · White `#ffffff`. Families Geist and Geist
Mono, weights 400/600. Ladders in `elevate.config.json`.

Whatever wins must be extractable as a small named language — materials, type,
motion, composition — that Home, Notes and Tasks can wear next.

## The gate
9.5, unanimous, across the seven standard seats. The score is the lowest seat.
Scores are allowed to fall and should when the panel looks harder.

## Decided — inherit, do not re-explore
Nothing. This is greenfield.

## Protected — elevate with a scalpel, never re-imagine
Nothing. Nothing is protected.

## Open — the actual exploration
All of it. The artifact object itself is open: a direction may re-imagine what
a shared timeline even is. Specifically worth naming:
- what the owner's home for a project is when it is not a dashboard;
- where editing lives so it never feels like data entry;
- what the publish ceremony is when the true metaphor is handing someone a
  finished print;
- what the received artifact should be when it is allowed to stop being a list;
- how the whole chain — unfurl, load, phone, print, the day — reads as one
  composed object rather than five surfaces that happen to share a colour.

## What binds
Three things, none of them a design decision:

1. `src/ds/tokens.css` is generated — never hand-edited. The lab invents its
   own material system in its own files.
2. Exploration only until the founder picks a direction: no app code, no
   schema, no deploy. The work is additive under `docs/design/labs/`.
3. Real routes and product names come from `src/lib/product-urls.ts` and
   `src/lib/suite-contracts.v1.json`, never invented hostnames.

Explicitly NOT binding, dissolved by name in the founder's brief: the Studio
Floor architecture (floor / one sheet / capsule / dock), the protected shared
artifact, the `--x-artifact-*` display register, the two-register rule, "owner
chrome frames but never restyles the artifact", the retired-route etiquette,
the density contract. `docs/TIMELINE_OWNER_ARTIFACT_CONTRACT.md`,
`docs/design/tasks-direction-lock-2026-08.md`, any Notes lock,
`docs/DELIGHT_CATALOG.md` and `experience/QUALITY_COUNCIL_EVIDENCE.md` are
history and reading, not gates. Design rules inside `AGENTS.md` and
`CLAUDE.md` do not apply to this engagement; their facts about where code
lives do.

## What is out of scope
Auth, billing, the data model, performance work, marketing pages, and anything
in Tasks or Notes beyond noting what the suite will inherit.

## Delivery
- Branch `design/timeline-redesign-2026-08`, pushed to origin, draft PR open
  and current from round 1, `main` merged in after every round.
- Lab `docs/design/labs/timeline-redesign-2026-08/`.
- Artifacts **Timeline Design Console** and **Timeline Elevation Log**,
  republished to the same two URLs every round.
- At lock-in: the lock document records the pick and the founder's objections
  verbatim; nothing ships to app code without the founder's word.
