# 03 · Design system (proposed v3)

These are starting values derived from the reference frames. Treat them as a **proposal to validate in code**, not as law. The redesign session should render them, compare them side by side with `key-frames/`, and tune. Names are semantic so light and dark swap cleanly.

## Colour tokens

| Token | Light | Dark | Use |
|---|---|---|---|
| `--shell` | `#F4F3F1` | `#111113` | App frame and sidebar background |
| `--canvas` | `#FFFFFF` | `#161618` | Main work sheet |
| `--surface` | `#FFFFFF` | `#1B1B1E` | Cards, tables, panels |
| `--surface-raised` | `#FFFFFF` + shadow-1 | `#212125` | Popovers, menus, modals |
| `--surface-sunken` | `#F7F6F4` | `#131315` | Inputs, KPI strip background, table header |
| `--hover` | `rgba(17,17,17,.04)` | `rgba(255,255,255,.04)` | Row and item hover |
| `--selected` | `#FFFFFF` + border | `rgba(255,255,255,.07)` | Active sidebar item, selected row |
| `--border` | `#E8E6E3` | `rgba(255,255,255,.08)` | Hairlines |
| `--border-strong` | `#D9D6D1` | `rgba(255,255,255,.14)` | Inputs, focus-adjacent |
| `--text` | `#141414` | `#EDEDEF` | Primary text |
| `--text-2` | `#5F5E5B` | `#A1A1A8` | Secondary text |
| `--text-3` | `#8E8C88` | `#6C6C74` | Meta, placeholders, group labels |
| `--accent` | `#4F46E5` | `#8B87F8` | Primary button, focus ring, selection, badges |
| `--accent-soft` | `rgba(79,70,229,.10)` | `rgba(139,135,248,.16)` | Accent backgrounds, @mention highlight |
| `--on-accent` | `#FFFFFF` | `#0E0E12` (or white; test contrast) | Text on accent |
| `--solid` | `#141414` | `#EDEDEF` | "Hero" solid button (clip C's New Project) |

**Status (the same hue in both themes, with tuned lightness):**
Backlog `#8E8C88` (dashed ring) · To do `#A1A1A8` (ring) · In progress `#E5A93B` (half ring) · Review `#8B87F8` (ring with a dot) · Done `#3FB37F` (check) · Blocked or at risk `#E5484D` · On hold `#E09B3D` · Planning `#8E8C88`.

**Priority:** four ascending bars. Urgent is a red square with "!", High `#E5484D`, Medium `#E5A93B`, Low `#A1A1A8`. Clip C's chips use text colours of High red, Medium amber and Low pink `#E86FA6` on 10% tints.

**Project identity:** 8 hues for project squares and dots: indigo, blue, teal, green, amber, orange, red, pink. Store them per project and never use them for status.

## Typography (Geist Sans / Geist Mono)

| Role | Size / line | Weight | Notes |
|---|---|---|---|
| Display (Home greeting, big page title) | 28/34 (light pages may go to 36–40 regular, as in clip C) | 600 (or 400 at 40) | Letter-spacing −0.02em |
| Page title | 22/28 | 600 | Plus a subtitle of 13/18 `--text-2` |
| Section title | 14/20 | 600 | "My tasks", "Portfolio" |
| Body / row | 13.5/20 | 450–500 | Task titles |
| Meta | 12/16 | 450 | `--text-3`, dates, counts |
| Group label | 11/14 | 600, uppercase, +0.06em | Sidebar "WORKSPACE", "PROJECTS" |
| KPI number | 24/28 | 600, tabular-nums | |
| ID / code | 11.5/16 | Geist Mono 500 | `WEB-130`, muted |

## Space, size, radius, elevation
- **Spacing:** 4px base. Use 2, 4, 6, 8, 12, 16, 20, 24, 32, 40, 48.
- **Sidebar:** 240px expanded (Compact density: 224px), 56px collapsed (icons only).
- **Top bar:** 44–48px.
- **Page gutter:** 32px at 1280px and above, 24px below.
- **Content max width:** 1180px for dashboards; lists and boards run full width.
- **Rows:** Comfortable 36px, Compact 30px. Sidebar items 30px.
- **Controls:** buttons 32px (small 28px, large 36px), inputs 32px, chips 22–24px.
- **Radius:**
  - 6px: chips, small buttons
  - 8px: buttons, inputs, menu items, sidebar pill
  - 10–12px: cards, tables, KPI strip
  - 14px: modals
  - 16px: the work sheet in the light shell
- **Elevation:** borders first. `shadow-1 = 0 1px 2px rgba(0,0,0,.05)` for the active sidebar pill and cards on hover. `shadow-pop = 0 8px 24px rgba(0,0,0,.12), 0 0 0 1px var(--border)` for menus, the palette and modals. The modal scrim is 40% (light) or 60% (dark) with a 2px blur.
- **Focus:** a 2px `--accent` ring with 2px offset on every interactive element. The input focus ring matches the New task modal title field.

## Iconography
One line icon set at 16px with a 1.5px stroke (Lucide is already close; standardise on one). Status icons are custom SVGs: dashed ring, ring, half, ring+dot, check-circle, x-circle. Project icons are 20px rounded squares with glyph + colour. Avatars are 20–24px circles with initials on a tinted background; stacks overlap by 6px with "+N".

## Motion
- Durations: 120ms (hover, press), 180ms (menus, tabs), 220ms (modals, drawers, page).
- Easing: `cubic-bezier(.2,.8,.2,1)`.
- Page enter: opacity 0→1 plus y 6px→0.
- Palette and modal: scale .98→1 plus fade.
- Sidebar collapse: width with a content cross-fade.
- Respect `prefers-reduced-motion` and the in-app "Motion: Follow system / Reduced" setting.

## Core components to build first (primitives)
Button (primary, solid, secondary, ghost, danger, icon), Input and Search field (with kbd hint), Kbd, Chip and Label (dot + text), Status icon, Priority bars, Avatar and Stack, Badge (count), Segmented control, Tabs (underline), Menu and Dropdown, Popover picker (property chips), Tooltip, Modal and Sheet, Toast, Table (header, grouped section, row with hover actions), Card (project card, KPI tile, KPI strip), Progress bar (thin 4px), Mini bar chart and segmented bar, Empty state, Skeletons, Toggle and Switch, Checkbox (round task checkbox and square form checkbox), Date picker, Command palette.

## Layout recipes
- **Dashboard:** title and actions, a KPI strip (4–6 tiles in one bordered container, or separate cards as in clip C), then a 2:1 grid (primary list left, deadlines or insight right), then a full-width table, then activity.
- **List page:** title and subtitle with a primary action, then a toolbar, then grouped rows.
- **Object page (Project):** header (icon, name, star, status, people, Share, settings, ⋯), then a tab row, then view content.
- **Settings:** second-level nav column (≈200px), then a form column of about 640px; rows are label + description on the left and control on the right, divided by hairlines.
