# Signal Studio redesign sprint: brief package

> **In this repository** (`docs/design/redesign-2026-09/`): docs, `key-frames/`, `contact-sheets/` and `CLOUD-HANDOFF-PROMPT.md`. The three source videos and all 188 frames live only in the Desktop copy on Ethan's PC (`Signal Studio Redesign Sprint`). Paths below that mention `frames/`, `reference-videos/` or `index.html` refer to that copy.

Prepared 24 Sep 2026 at Ethan's request. It hands the UI/UX redesign to a new session now that the App is functionally complete in production.

**To start the sprint:** open `HANDOFF-PROMPT.md` and paste its contents into a new Claude Code session in `C:\Users\ethan\signal-studio-workspace`.

| File / folder | What it is |
|---|---|
| `HANDOFF-PROMPT.md` | The prompt for the redesign session. |
| `index.html` | A visual gallery of every key frame; open it in a browser. |
| `01-reference-analysis.md` | What the three reference clips and three stills show, screen by screen with frame numbers, plus the interaction patterns to adopt. |
| `02-design-direction.md` | The direction in plain words: one shell, quiet surfaces, loud data, two themes, what we keep and what we leave. |
| `03-design-system.md` | Proposed v3 tokens (light and dark colour, type, space, radius, elevation, motion), components and layout recipes. |
| `04-information-architecture.md` | The persistent sidebar and top bar, and how every current route maps into it. |
| `05-priority-screens.md` | Briefs for the wave-1 screens: shell, Home, Tasks (with the Kanban kept), Projects, Overview, Messages, Files, Settings and Inbox. |
| `06-current-state-and-constraints.md` | The codebase today, known issues, **the old contracts to lift or keep** (with the founder authority statement), and how to ship. |
| `07-sprint-plan.md` | Phases: orientation and audit, foundations, primary screens, release and review, then wave 2. |
| `key-frames/` | 26 selected reference frames named by screen. |
| `frames/` | All frames at 2 fps (A: 14, B: 162, C: 12) plus contact sheets. |
| `reference-videos/` | The three source clips (A calendar, B full Gr8r walkthrough, C home dashboard). |
| `reference-images/` | Where the three pasted stills go (⌘K palette, New task modal, Settings › Team members), described in its README. |

State of production at hand-off:
- App `0a0365d2` on `dpl_3tK2BwwKdwZxkEmPG74LkW1c1S6B`, with functions in `dub1`.
- Production sprint 12/12 accepted.
- The functional sweep (#34) found every signed-in route returning 200.
- Pages render in 0.7–2.8 s server-side after the region fix.
