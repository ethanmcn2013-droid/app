# Claude Design icon pack — Tasks board mapping (Phase 5)

The "Signal Studio icons" pack (source SVGs in this folder) replaces the
generic board-control glyphs. Each icon is ported at its intended viewBox
(`0 0 24 24`) and proportions; elements inherit stroke + `fill="none"` from
the shared `<Icon>` wrapper (`src/components/app/room/room-icons.tsx`) so size,
alignment, and colour normalise in one place. Solid fills carry an explicit
`fill="currentColor" stroke="none"`.

## Inventory → old-to-new mapping

| Board control            | Pack asset              | Where it renders (new)                                   | Old glyph replaced |
|--------------------------|-------------------------|----------------------------------------------------------|--------------------|
| Filter                   | `icon-filter.svg`       | `room-icons` `filter` → RoomViewBar Filter               | funnel path        |
| Sort                     | `icon-sort.svg`         | `room-icons` `sort` → RoomViewBar Sort                   | lines + arrow      |
| Fields                   | `icon-fields.svg`       | `room-icons` `fields` → RoomViewBar Fields               | ruled lines        |
| Compact / density        | `icon-compact.svg`      | `room-icons` `density` → RoomViewBar density select      | three bars         |
| Search                   | `icon-search.svg`       | `room-icons` `search`                                    | magnifier          |
| Share                    | `icon-share.svg`        | `room-icons` `share` + ShareButton trigger               | node-graph share   |
| Save view                | `icon-save-view.svg`    | `room-icons` `save` → RoomViewBar Save view (was text-only) | — (added)        |
| Subtasks                 | `icon-tasks.svg`        | `room-icons` `subtasks` → task-card Subtasks action      | — (added)          |
| Column actions / quick actions (⋯) | `icon-overflow.svg` | `room-icons` `more` → card ellipsis + column overflow | three fat dots     |
| Settings                 | `icon-settings.svg`     | `room-icons` `settings`                                  | gear               |
| Calendar / Schedule      | `icon-calendar.svg`     | `room-icons` `calendar` → card menu Schedule, calendar tab | calendar grid    |
| Copy as CSV              | `icon-copy-csv.svg`     | page-header export overflow                              | table grid         |
| Copy as Markdown         | `icon-copy-markdown.svg`| page-header export overflow                              | three lines        |
| Print                    | `icon-print.svg`        | page-header export overflow                              | printer            |

## Not remapped (deliberate)

- View-tab glyphs (Board / List / Timeline) are the room's own view semantics,
  not the pack's product-rail icons (`icon-notes`, `icon-timeline`, …), so they
  are left as-is to avoid conflating "view" with "product".
- `close`, `check`, `add`, `comment`, `dependency`, and other structural glyphs
  have no pack equivalent and keep the original room set.
- Rail/product icons (`icon-signal`, `icon-notes`, etc.) live in the suite
  chrome, outside Tasks-board scope.

Unused-but-available pack assets kept for future use: `icon-assigned-to-me`,
`icon-my-work`, `icon-saved-items`, `icon-saved-views`, `icon-team`,
`icon-updates`, `icon-notes`, `icon-collapse-sidebar`, `icon-more`,
`icon-signal`, `icon-timeline`.
