# Signal Studio · Sidebar icons ("Solid when selected")

The approved icon set for the app sidebar. Only the icons change. The sidebar's order, labels, sections and spacing stay as they are.

## How the set behaves

- **Not selected:** a grey outline icon.
- **Selected (the page you're on):** the same icon in white, filled in solid. Its inner details (the tick, the door, the folder lip and so on) are cut out, so it looks right on any background.
- Navigation never uses indigo. Selection is shown by the solid fill plus the existing row highlight, following the design system's navigation rule.

## Specs

| | |
|---|---|
| Grid | 16 × 16 px, drawn for 16 px display |
| Stroke | 1.5 px, round caps and round joins |
| Colour | `currentColor`, so set it with CSS `color` |
| Suggested colours on ink `#111111` | default `#a1a1aa` · hover `#e4e4e7` · selected `#ffffff` |
| Selected row background | `rgba(255,255,255,0.08)` (unchanged) |
| Icon-to-label gap | 12 px |

## What's in the folder

- `svg/default/*.svg`: the outline version of every icon.
- `svg/selected/*.svg`: the solid version of every icon.
- `SidebarIcon.tsx`: a React component that switches between the two automatically, plus the `ProjectMarker` used for projects.

## Which icon goes where

| Sidebar item | Icon name |
|---|---|
| Collapse sidebar button | `collapse` |
| Search box | `search` |
| Home | `home` |
| Projects | `projects` |
| Tasks | `tasks` |
| Timeline | `timeline` |
| Files | `files` |
| Analytics | `analytics` |
| Automations | `automations` |
| Whiteboard | `whiteboard` |
| All conversations | `chat` |
| Each chat channel (the # rows) | `channel` |
| Settings | `settings` |
| Help button | `help` |
| Theme button | `theme` |
| Each project in the Projects list | `ProjectMarker` with the project's colour |

## Using the component

```tsx
import { SidebarIcon, ProjectMarker } from "./SidebarIcon";

<SidebarIcon name="projects" selected={isCurrentPage} />

<ProjectMarker color="#a78bfa" />   // Personal
<ProjectMarker color="#2dd4bf" />   // Production canary 23 Sep 2026
```

`ProjectMarker` replaces the old letter squares, including the special ring on the currently viewed project. Every project now uses the same marker: a rounded square tinted with the project's colour, with a solid dot in the middle (the brand dot). Show which project is being viewed with the normal row highlight, not a different marker.

The component is type-checked with TypeScript 5.6 and React 18.

## In this repository (12 October 2026)

This set is the sidebar's icon set from now on. The component the app uses is
`src/components/shell/sidebar-icon.tsx` (`SidebarIcon`, `ProjectMarker`); its
paths are this folder's SVGs verbatim. Colours come from the design tokens in
`src/components/shell/shell.module.css`, not the hex values above, so the set
follows the theme. A contract test (`src/components/shell/sidebar-icons-contract.test.mjs`)
fails if a sidebar row goes back to another icon. Change an icon here and in the
component together.
