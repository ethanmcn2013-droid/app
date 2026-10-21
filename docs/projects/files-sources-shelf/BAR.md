# The BAR (given verbatim to every seat and every refuter)

LAB = C:\Users\ethan\AppData\Roaming\Claude\scratch-workspaces\5f1c0bc5-7aac-4a31-8085-bc80b8d2252c\3dade491-294a-4d61-99e3-99050eb7fabc\scratch-2026-10-19-c5fe6a\files-2026-10
MASTER = LAB\..\files.html

## The standard
Score against this standard: the work of an award-winning design studio that iterated on this product for months. 10 is that studio's best shipped work. Benchmarks to hold it against, by name: Linear, Stripe, Vercel, xAI/Grok, SpaceX. Score the ARTIFACT, not the effort. A polite 8 that should be a 6 makes the panel worthless.

## 1 · What you are reviewing
The Files page of Signal Studio, a task and project workspace for founders and small teams. People open it to find, add and trust the files attached to their work, without training. The architecture is LOCKED: three folders by where files live (In Signal, Google Drive, Links) plus a dashed "Add files" folder; beneath them every project's own folder; then "Latest additions" and a storage footer. Opening a folder shows that source or project (projects group files by task). A preview panel opens beside the files. Uploads may stay unattached to a task; a file may belong to several tasks. Read `LAB\brief.md` and `LAB\lock.md` first.

## 2 · Constraints that are not negotiable
- Palette: one neutral ramp (N0–N14) plus colour only for identity — Signal indigo (#5b4ff5 light; #6a5ff0/#7d72ff/#a39bff dark) for actions and the Signal mark, the real Google Drive logo, one teal (#12a594) for links, green/amber for status. One folder finish: white in light mode, graphite in dark. The sidebar and frame stay dark in light mode.
- Type: Inter, weights 400/500/600, ramp 10 · 11 · 12.5 · 13.5 · 15 · 22 · 28.
- Thumbnails are one consistent greyscale placeholder per file type, with no type badges (founder, 21 Oct). No New task button on this page. The dashed Add files folder stays.
- Findings that amount to "add a colour", "add a weight", "restructure the layout" or "reopen the locked direction" are out of scope and will be discarded.

## 3 · Measured baseline (do not spend findings here)
- `audit.mjs` (computed styles in Chromium) reports ZERO violations across all 14 states × presets a/b/c × 1440 and 390 widths for: palette lock, weights, families, WCAG AA text contrast on composited backdrops, 28px hit targets, radii ladder, motion duration/easing ladders, type ramp, declared line-height.
- `interaction-check.mjs` passes 326 behaviour assertions: no sideways scroll in any state at 390/768/1280/1440; zero console errors; accessible names; no invisible tab stops; visible focus; no silent clipping on home; plus engagement checks (word-by-word search, focus/caret survive typing, query in URL, Esc/Back routing with focus returning to the folder, roving grid focus with arrows, Enter previews/Enter opens/Esc returns focus, locked files never "open", reconnect flow, request access, task picker modal with focus return, Add menu keyboard, upload success/failure/retry, uploads inherit project, list view above 40 files, Not-attached filter, selection bar, filter dead-ends, archived toggle, bad deep link, loading/error/offline/empty/drive-off copy, mobile drawer and sheet modality, reduced-motion spinner, menu focus ring, extension-preserving names, undo by button and Ctrl+Z with focus on the restored file, one date grammar, skip link focuses the files, keyboard row selection with announced count, tray band reserved, phone sheet inert and Tab-trapped, one unattached count everywhere, one card metadata template, single-row Latest additions, Open/Download order, real-layout skeletons, reconnect keeps focus, Drive removal copy, stable project order, mobile folder marks, fixed-size thumbnail text, Add files in the header, shared source/project tracks; round 2: no inner scroller pans sideways in any state or width, search names hidden matches, one no-results design, header counts files in projects with a 7-day window, Drive-off counts stated, paste-a-link field and page paste, queued announcements with assertive failures, phone tray band, focus keeps place after delete and bulk attach, picker Enter never unticks, D jumps to details, H2 above task groups, anchor card glides, header VT layer, reversible preview, drag-to-dismiss sheet, tray order held under pointer, two-slot toolbar, list name column, whole-word context trims, project baselines, 1024 sources in one row; round 3: files appear in every project their tasks belong to, unattached links counted, search shows why it matched, one project and task order, Link from Drive adds files, links named from their address, first upload reads right, header controls move as one unit, three-letter months, filter bar holds beside the preview, task-group cards never shrink, source captions on a subgrid, undo outlives its toast, previewed file is aria-current and a second click keeps it, phone sheet hint, preview image hidden from screen readers, real offline state, chosen file kept in view, one FLIP for delete/undo/attach, drag physics, toast re-entry, menu resize and exit; founder 21 Oct: one placeholder per type, no badges, Latest additions cards or list; round 4: calendar date groups, header counts describe one set, list rows show where files live and keep date on phones, no clipped status column, floating selection bar that never moves rows, X selects in lists, one accessible name for cards and rows, per-file picker toast with no toast for no change, undo says what came back, link saved elsewhere keeps focus and offers Show, Drive files counted as not attached, Attach all in the tray, disabled Add files looks disabled, offline Drive link disabled, details panel scrolls in short windows, morph clicks replayed only when aimed, off-screen header never travels, caption edges aligned, phone toggle on one row, placeholders fill every tile; round 5: Enter confirms the picker, links named from readable words, empty workspace shows projects and facts, short Not attached caption and no stop-word trims, tray copy and one-label Attach all, preview open/close glides without blanking, double-click on a folder opens only the folder, offline notice animates, toolbar stays one row, names trim at a word with the ellipsis on the extension, one-line phone selection bar, status rows top-aligned, a file keeps its project when its last task is removed, no Links type chip, one Where grammar, archived count in the header, phone Display sheet, announced retry, card selection by X/Ctrl+click, forced-colours outlines, picker fits phones with a fixed height, tray folds in short windows; round 6: new uploads ask once (tray, not notice), Drive disconnection said once by its banner, failed uploads say where they stopped, drive-off header two lines, filters state themselves with Clear and a named select, folder search shows why and lists each file once, tile and folder header share one summary, Group and Order are separate, Display rows share one grammar, tray fold animates and keeps focus, greyscale link placeholder, header holds its height while the preview opens, Display closes on scrim tap and drag and is a popover on tablets up, narrow columns keep a short toolbar, source marks at one optical size, filters announce what is shown, names re-trim under text spacing, card groups are multi-select listboxes, Home/End move focus, Back mid-morph reverses).
- A finding that restates a gate-proven fact is refuted on sight. Find what automation cannot see.

## 4 · The frames
`LAB\shots\a-<state>--<WxH>.png` at 2x, for every state × 390x844, 768x1024, 1280x900, 1440x960. States: home, source (In Signal), preview (file selected), project (Wedding hub, grouped by task), dense (64 files, list view), search ("sam contract"), picker (task picker open), drive-expired (Drive not syncing, a file selected), drive-off (Drive not connected), empty (new workspace), uploads (tray: done, uploading, failed), loading (skeleton), offline, error (load failed).

## 5 · Drive the real file (required — grade by driving, never frames alone)
Write throwaway scripts ONLY inside your own folder `LAB\panel\r<round>\<your-seat-slug>\` and run them with the Bash tool like this:

```bash
cd "<LAB>/panel/r<round>/<seat-slug>" && export ELEVATE_CHROMIUM="$(ls -d "$LOCALAPPDATA"/ms-playwright/chromium_headless_shell-1228/*/chrome-headless-shell.exe | head -1)" && node my-check.mjs
```

```js
// my-check.mjs
import { open } from "../../drive.mjs";
const { page, browser, errors } = await open({ state: "home", v: "a", width: 1440, height: 960 });
// v: a = light, b = dark, c = light with lists everywhere. reducedMotion: "reduce". isMobile: true with width 390.
await page.keyboard.press("Tab");
console.log(await page.evaluate(() => document.activeElement.outerHTML.slice(0, 200)));
await page.screenshot({ path: "probe.png" });   // then Read the png to look at it
await browser.close();
```

The keyboard model: Tab moves between regions; each group of files is ONE tab stop with arrow keys inside (Home/End too); Enter or click previews a file, Enter again (or double-click) opens it; Esc steps back (search → selection → preview → leave the folder). Menus: arrows, Home/End, Esc returns focus, Tab closes. Ctrl+Z undoes a delete or a task change. The "States" button and the theme toggle at bottom-right are prototype-only review controls: ignore them as design. Back-end actions (open, download, share, rename) are toasts by design in this prototype — judge the flow and copy, not the missing server.

Do not edit the master or any file outside your own seat folder.

## 6 · Round notes
- Deliberate decisions that are not oversights (argue if you disagree, but do not report as oversight): one placeholder per file type with no type badges (founder, 21 Oct); Latest additions switches between one row of cards and a full newest-first list; the Add files folder is dashed; the sidebar Projects links go to (unbuilt) project pages, not to file folders; uploads made on Files home are unattached by design and a quiet notice counts them; the folder-to-header morph uses View Transitions (Chromium), skipped under reduced motion.
- Seed knowledge: read `LAB\..\references\lessons.md` — the defect classes that cost previous engagements real score. Check this surface against every class.

## 7 · The honest-distance ask
Say plainly what the score is, what earned it, and what stands between it and 9.5, in terms a founder can act on: polish, a build, or a different decision, and roughly how big. Do not inflate to be kind and do not deflate to look rigorous.

## Output contract (return EXACTLY this JSON, nothing else around it)
```json
{
  "seat": "<your seat name>",
  "score": 7.4,
  "findings": [
    { "id": "kebab-slug", "element": "selector + context (state, width)",
      "problem": "specific, measured where possible, how you observed it",
      "fix": "implementable exactly as written",
      "cost": 0.4 }
  ],
  "biggestWin": "the single change that would raise this seat's score most",
  "distance": "honest distance to 9.5 in one or two sentences, sized"
}
```
Three to five findings, each costed in tenths of a point. Score to one decimal. No hedging, no credit for effort.
