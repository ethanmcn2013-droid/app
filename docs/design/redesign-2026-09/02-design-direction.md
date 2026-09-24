# 02 · Design direction

**One sentence:** Signal Studio should feel like one calm, fast, dense-but-breathable work OS, the Gr8r / Linear / "work OS" family in the references, with a single persistent shell, one component language across every product, and a light theme and a dark theme that are both first-class.

## What "good" looks like, taken from the references

1. **One shell, always.** A persistent left sidebar and a thin top bar on every signed-in screen: Home, Tasks, Notes, Timeline, Messages, Files, Settings. There is no per-product chrome, no separate product wordmarks and no bottom navigation on desktop. Products become **places in one sidebar**, not separate apps.
2. **Quiet surfaces, loud data.** Neutral canvas, hairline borders, almost no shadows. Colour is reserved for meaning:
   - status (a ring moving to half, then to a check);
   - priority (bars);
   - project identity (a coloured square icon and dot);
   - alerts (red numbers such as Overdue 2);
   - exactly one accent for the primary action and selection.
3. **Typographic hierarchy does the work.**
   - Page title: large, with a one-line muted subtitle.
   - Section headers: small, semibold.
   - Metadata: 12–13px muted.
   - Group labels: tiny caps.
   - IDs: monospace and muted.
   - Numbers: tabular.
4. **Density with rhythm.** Lists run at about 32px per row with generous page gutters. The information-rich screens (Home, Overview, Tasks) read at a glance because every row has the same anatomy.
5. **Consistent grammar.**
   - Every list page: title, subtitle, primary action, then a toolbar (Search · Filter · Sort · Group · View switch), then grouped content with counts and "+ add".
   - Every object: status icon, title, meta chips, assignee, due date.
   - Every empty or denied state: icon, one sentence, one action.
6. **Keyboard-first speed.** ⌘K palette, `/` for search, ⌘↵ to submit, "Create more", and hover actions on rows.
7. **Calm motion.** 150–220ms fades and 4–8px slides, a palette that scales in, and nothing bouncy. The only "moment" is the Home greeting.
8. **Designed states.** Empty, loading (skeletons that match the final layout), no-access, archived and error states all look intentional.

## Two themes, one system
- **Light (default for founder review):** warm off-white shell with a white work sheet, following clips A and C and the Gr8r light theme in `key-frames/11-12`. The active sidebar item is a white pill with a hairline border and a whisper of shadow.
- **Dark:** near-black shell (`#111113`), raised surfaces a step lighter, hairlines at about 8% white, lavender-indigo accent (`key-frames/10`, `18`, `20`).
- Users switch Light, Dark or System from the account menu and Settings › Appearance. Accent and density are preferences too.

## Signal Studio specifics (what we keep from our identity)
- **Accent:** keep Signal's indigo, but tune it for both themes. Light uses about `#4F46E5` (current `indigo-600`) for primary buttons. Dark uses a softer lavender, about `#8B87F8`, as in Gr8r. Near-black solid buttons (clip C's "New Project") are allowed for the single most important action on light pages.
- **Type:** keep **Geist Sans / Geist Mono**. They are already loaded, and they match the references' neutral grotesk.
- **Voice:** plain, active, sentence case, with no exclamation marks (studio/BRAND.md). This is the one existing rule worth keeping; it costs nothing and matches the references.
- **Warmth:** our neutrals shift from cool zinc to **slightly warm greys** for the light shell, which is what makes clips A and C feel premium rather than clinical.

## What we are deliberately leaving behind
- Per-product wordmark headers ("tasks•", "notes•", "timeline•", "projects•"), the mobile-style bottom tab bar on desktop, and the "Choose a project" strip as primary navigation. The Project switcher moves into the sidebar's Projects section and the ⌘K palette.
- Page-by-page bespoke styling. Everything is built from one primitives set.
- Any old contract, gate or doc that blocks this direction. See `06-current-state-and-constraints.md`: Ethan has explicitly authorised updating, replacing or deleting them.

## The one thing we keep as-is (then refine)
- **The Tasks Kanban board** is the part Ethan likes. Keep its structure and behaviour, including drag, lanes and card anatomy. Only restyle it into the new system, using the column header, card anatomy, "+ Add task" and label chips from `key-frames/20-project-kanban-board.jpg`.
