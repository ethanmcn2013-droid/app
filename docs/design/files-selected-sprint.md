# Selected Files visual sprint

## Direction

Keep the Files v3 identity and turn its project-level browse state into a calm set of dimensional folder cards. Each card represents an existing task inside the already selected project; the folder face previews the kinds of files already attached to that task. This uses task associations that arrive with the current authorized file read, so it adds no data scope or server query.

The cards use the supplied light-grey folder reference as material guidance. Paper layers and the folder front add depth with the existing theme surfaces and neutral tokens. Project accent color stays reserved for focus and navigation.

## Behavior

- Search and existing filter chips narrow the folder cards by files that match the current scope.
- Selecting a folder scopes the current file list to that task. The breadcrumb and the `All files` control return to the project folder overview.
- File rows, list/grid choice, keyboard movement, file permissions, task links, search behavior, archived-task rules, and the preview sheet/docked panel retain their existing implementations.
- The same preview artwork remains in the right-hand panel and updates to the selected folder's first visible file.
- Empty projects continue using the existing empty state. A folder with no matches offers the same direct return to all files.

## Visual mechanics

- Folder cards keep an open canvas rather than nesting bordered panels.
- The back folder, two file sheets, and front lip use layered CSS geometry and theme surfaces. Existing file glyphs identify the two visible sheets without inventing file content.
- The grid collapses naturally to one or two columns and keeps the existing light/dark theme tokens, focus rings, and reduced-motion behavior.

## Scope and checks

Only `src/components/app/files/files-explorer.tsx` and `src/components/app/files/files.module.css` implement the view. No database, server read, project scope, permission, or preview-art change is included.

Run the app typecheck and lint checks, then view Files in a real browser at desktop and narrow widths in both available themes. Confirm folder search/filtering, opening and backing out, file selection, and dock/sheet preview behavior against the existing authorized rows.
