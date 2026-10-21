# Files · Sources + shelf · status

Branch `feat/files-sources-shelf`, based on `origin/main` 271c4014. Internal and flagged: operators only.

## The gate

- `src/server/files-sources-shelf-gate.ts` → `filesSourcesShelfEnabled()`. True only when the existing `callerIsAdmin(userId)` says yes (`ADMIN_USER_IDS`, the same check as Settings' sample-data section).
- False in demo and review builds, false when the caller cannot be resolved, false when the admin check throws or answers anything but `true`. It fails closed.
- `src/app/app/files/page.tsx` renders `FilesShelfView` when the gate is true and today's `FilesView`, with the same props, otherwise. Non-operators see no change.
- Tests: `src/server/files-sources-shelf-gate.test.ts` (member → false, operator → true, no caller → false, throwing check → false, demo → false, the page branches on the gate).

## What was ported from `prototype.html`

- Header: Files, one plain summary sentence ("42 files on 14 tasks in …, 13 added in the last 7 days."), search with `/`.
- Three source folders (In Signal = storage `signal`, Google Drive = `google_drive`, Links = `link`), drawn as the prototype's folder: one neutral finish (white in light, graphite in dark), the source mark, the count, papers that lift on hover. Each has a short blurb and one fact ("On 11 tasks · 18 MB"). Drive copy says "In Google Drive"; the shelf never says "linked, not copied".
- The dashed Add files folder, pointing to Tasks with the current page's guidance: files are added from a task.
- Latest additions: one row of newest cards (as many as fit, 2×2 on phones) or the full newest-first list in calendar groups (Today, Last 7 days, Earlier this month, Older), with a Cards/List switch.
- Folder view with `?source=signal|drive|links` (shareable; Back and Escape leave it), breadcrumb, folder header, type chips only when two or more types exist, a filter status line with Clear, cards or list rows.
- One greyscale placeholder per type: page of lines (documents), grid (sheets), photo glyph (images), web page (links). No type badges; the extension never truncates.
- Search across name, task, person, kind and source. Every word must match; matched words are lit; each file's accessible name says why it matched.
- Preview: the existing `FilePreview`, docked from 1280px, a sheet on narrower screens. Two opt-in props were added to it (a docked close button, a "Where it lives" override so the shelf says "In Google Drive"); the current page passes neither and renders as before.
- Keyboard: each group (folders, cards, rows) is one Tab stop with arrows, Home and End; Up and Down move by row in grids. Enter previews, Enter again opens. Escape clears the search, then closes the preview (focus returns to the file), then leaves the folder (focus returns to the folder). Visible focus ring throughout.
- Reduced motion turns off the arrival rise and hover lifts. A forced-colours block keeps the previewed file, pressed chips and placeholders visible.
- Empty project (folders stay, with "No files yet"), empty folder, no-match, truncated notice and the archived toggle (`?archived=1`, keeps `?source=`).
- Loading reuses `FilesSkeleton` through the unchanged `loading.tsx`.

## Left out on purpose

- Upload, Add files menu, paste a link, drag and drop, the upload tray: production has no upload on this page and no backend for unattached uploads.
- Attach to task, the task picker, Change tasks, delete and undo, selection and bulk actions: no backend actions on this page.
- Drive connect, reconnect, Drive-off and expired-sync states, no-access and missing-in-Drive flags: the read has no Drive connection state.
- Project folders and the cross-project shelf: `loadProjectFiles` reads one active Project; there is no cross-project read. The project's name is in the header sentence instead.
- Files on several tasks ("Used in 2 tasks"): each row is one file on one task in the current data model.
- The storage footer and quota: no quota read.
- Display popover, sort by name and group by task: the read is newest first; Cards/List covers the founder's long-list request.
- Real image previews in cards: replaced by the placeholder per type (founder decision, 21 Oct). The docked preview still shows an uploaded picture, as today.

## Evidence

- `experience/files-sources-shelf/run.mjs` (`pnpm test:files-sources-shelf:browser`): the real view over the fixed 42-file fixture at 1440, 1280, 768 and 390, light and dark, with axe, no sideways scroll, no console errors, keyboard, URL, preview, filters, search, archived, forced colours and reduced motion.
- Screenshots of the final state in `evidence/` (1440 and 390, light and dark): home, latest list, search, In Signal folder, preview, Drive folder as a list, empty.

## Open

- The `tasks.page.app-files` materiality review receipt needs a design-owner review; see the PR for exactly what is needed.
