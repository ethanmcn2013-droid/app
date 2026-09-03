# Elevation brief · Connections and Resources · 2026-09

## Target

Elevate two joined Signal Tasks surfaces: the new **Connections** section in
Settings and the existing **Resources** section in a task detail panel. Their
single job is to make attaching a file feel unchanged while making the human
truth behind it unmistakable: whose Google Drive holds the board's files, who
can open them now, and what will happen before anyone disconnects or hands
storage to another owner.

## Audience

A wedding-venue operator coordinating a live event with a small mix of
colleagues, couples and outside suppliers, who needs a plain answer quickly
and should never have to understand cloud-storage architecture.

## Fixture

The lab uses the repository's canonical wedding story, adapted to the
Connections job: **Glenmara House**, the Mara & Finn wedding on 19 September,
and its operating team. Orla Byrne is the current storage owner; Maeve Kelly
is a co-owner; Mara Doyle, Finn Walsh and Northlight Photography are board
members. The live access list is intentionally not identical to membership in
the attention state, so the safety claim can be judged rather than merely
stated. Files are `Mara & Finn — final seating plan.pdf`, `Saturday run
sheet.xlsx`, and `Supplier arrival notes.docx`. The clock is pinned to
3 September 2026, 10:24 Europe/Dublin. Names and story come from the shared
review fixtures and Glenmara labs; addresses are non-deliverable `.example`
fixture data.

## States

- `connected` — Orla's Drive is connected; the permanent storage-owner line,
  current folder and complete live access list are visible.
- `not-connected` — no Google Drive connection; the board continues using
  Signal Studio and one calm primary action is available.
- `setting-up` — the folder exists and named access is still being granted;
  the UI is truthful without exposing a queue or operation language.
- `access-attention` — Northlight's removal has not yet been confirmed and one
  current member is still waiting; unresolved access is impossible to miss.
- `handover` — ownership is being assigned from Orla to Maeve, with permanent
  consequences stated before confirmation and current uploads blocked.
- `resources` — a task shows Signal-native, Drive-backed and link rows through
  the existing one-control intake pattern.
- `uploading` — one 18.4 MB PDF is going straight to the board's Drive folder;
  progress and cancel remain usable without a modal.
- `unavailable` — the board's Drive is full or needs attention, so this upload
  will use Signal Studio; existing files remain represented honestly.

The connected and resources states carry normal density. `access-attention`
is the dense/safety fold; `not-connected` is the empty fold; `setting-up` and
`uploading` cover loading. Every direction resolves all eight states.

## Register and materials

Signal Studio's default register binds: Ink `#111111`, white `#ffffff`, indigo
`#4f46e5`, Geist 400/600 and Geist Mono 400. Neutral structure is derived from
ink at the established 0.72 / 0.62 / 0.28 / 0.16 / 0.08 / 0.06 / 0.04 alpha
ladder. Indigo is spent only on the one next action, current progress or focus.
Destructive confirmation may use the existing blocked-state red, but never as
decoration. Hairlines carry structure; shadows are reserved for true overlays.
The real Tasks chrome and white working field remain around the explored
surface.

## The gate

9.5, unanimous across the seven standard Elevate seats after lock-in. Scores
may fall; the floor, not the average, decides completion.

## Decided — inherit, do not re-explore

- Product nouns are **Connections**, **Connect Google Drive**, **Resources**
  and **Who can open this board's files**. “Project Drive”, “connected
  storage”, operations, grants and provider internals never reach the UI.
- One current storage owner per board; their name is permanently visible.
- Current members receive writer access by default. The access list is read
  from Google, not inferred from membership records.
- The task panel keeps one Attach control and one drop zone. Upload routing is
  automatic; “Add from Drive” remains deferred.
- Consequences appear before a disconnect or handover confirmation.
- Existing files and historical folders are never described as deleted or
  moved during disconnect, handover, account removal or project deletion.

## Protected — elevate with a scalpel, never re-imagine

- The Studio bar, suite rail, Settings shell, task detail panel width and
  project navigation. This engagement designs surfaces inside the established
  Tasks product, not a fourth shell.
- Existing Settings section grammar: numbered navigation, one readable main
  column, immediate-save expectation, responsive horizontal tab strip.
- Existing Resources grammar: quiet uppercase section label, compact rows,
  one intake field, drag overlay and non-blocking progress.
- Exact `drive.file` consent scope, writer default, 50 MB file limit, legal
  wording and pricing. These are product/founder decisions, not visual levers.

## Open — the actual exploration

- Whether Connections should read as a calm account card, an access ledger or
  a guided story with a persistent ownership rail.
- How to distinguish membership from live Google access without tables that
  feel administrative.
- How much storage provenance belongs on every resource row versus on demand.
- How setup, fallback and unresolved removal earn attention while keeping the
  normal state almost invisible.
- The one memorable transition that connects Attach → progress → a settled
  Drive-backed row, with complete reduced-motion parity.

## What binds

- `docs/projects/project-drive/PROJECT.md` §2, WP-7 and WP-8.
- `docs/projects/project-drive/DECISIONS.md` D4, D5, D7 and D9.
- `src/app/globals.css` and the `signal-ds` package: existing tokens only in
  production; directions may propose additive `--x-*` tokens in writing.
- `src/components/app/settings/settings-app.tsx` and
  `src/components/app/detail-panel/resources-section.tsx` as the honest
  reference implementation.
- `scripts/experience/validate.mjs`, all four registry breakpoints, and
  `pnpm first-contact:language` at implementation.
- Signal brand voice: plain, warm, confident, one idea per sentence; no cloud
  jargon, apology copy, or architecture presented as a benefit.

## What is out of scope

Google Picker / Add from Drive, a board-level document library, changing legal
or privacy wording, changing the OAuth scope or member role, redesigning
Settings or task-detail chrome, altering prices, applying production
migrations, and shipping app code before the founder chooses a direction.

## Delivery

Branch `design/project-drive-connections-exploration`; lab
`docs/design/labs/project-drive-connections-2026-09`; artifact titles
**Connections design console** and **Connections elevation log**. Phase 2
ships three complete direction artboards, screenshots and a local comparison
surface, then stops for the founder's pick. Lock-in records the chosen thesis
and objections verbatim before any production implementation, registry work,
panel round, PR or deployment.
