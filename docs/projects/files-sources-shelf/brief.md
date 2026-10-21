# Elevation brief · files · 2026-10

**Target.** The Files page of Signal Studio (`../files.html`), the locked "Sources + shelf" direction after Rounds 1–4.

**Audience.** People who run their projects in Signal Studio — founders and small teams — who need to find, add and trust the files attached to their tasks without training.

**Fixture.** Four real-feeling projects (Wedding hub, Production canary, Monthly business rhythm, Ping Private Release) with 20 files across In Signal, Google Drive and Links, including multi-task files, archived tasks, a former member's file, a no-access Drive file and a file missing from Drive. A dense fixture adds 26 projects and 64 uploads.

**States (the ?state= contract).** home, source, preview, project, dense, search, picker, drive-expired, drive-off, empty, uploads, loading, offline, error. Presets: a light, b dark, c light with lists everywhere.

**Palette and type (locked, enforced by audit.mjs).** One neutral ramp N0–N14. Colour only for identity: Signal indigo (actions, the Signal mark), the real Google Drive logo, one teal for links, green/amber for status. Inter, weights 400/500/600, ramp 10 · 11 · 12.5 · 13.5 · 15 · 22 · 28.

**Protected decisions (from Ethan, verbatim where possible).**
- "All the folders should be the same color." One folder finish: white in light, graphite in dark.
- "Get rid of the fluff… the different colors." No decorative colour, no rainbow thumbnails.
- Sources + shelf is locked; projects each get their own folder beneath the sources.
- "The sidebar for the light mode should remain dark."
- Keep the dashed Add files folder. No New task button on this page.
- Uploads do not have to be attached to a task. Files may belong to several tasks.
- Real previews, shown in greyscale.

**Panel.** Five seats, matching the five areas Ethan asked to see at 9.5: UX and information architecture · First-use usability and product taste · Visual design, typography and brand · Motion and interaction · Accessibility, resilience and measured evidence. Each finding meets a fresh refuter that defaults to REFUTED. Gate 9.5, unanimous.

**Project contracts.** None beyond this brief. Prototype only; no production code. No git remote exists for this lab, so the branch `design/files-elevation` commits locally each round.
