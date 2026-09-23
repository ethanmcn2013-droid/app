# WDATE-01: fresh sponsored-access readback

**P3 display fix implemented at 69d7880a61840d536beace65875662911336df12.** A grant-only server refresh now updates the mounted wedding-date form's recipient access text without discarding an unsaved date. No permission, entitlement, date arithmetic, visibility or customer wording changed.

## Source and boundaries

- Branch: feat/january-sponsored-wedding-date.
- Owned App: C:/Users/ethan/signal-studio-workspace/worktrees/app/feat-january-sponsored-wedding-date.
- Parent: 83ce38c13455e02ab1a2b94cad43940d50200bb0, the sealed evidence-only commit above legacy retirement 7742247d7beebeb3b712977f5c3014aa426e55ca.
- Original reviewed UI: 2d1d77835e7bcedfab5c68e53608fe5d00dd8f9a.
- Separate fix: 69d7880a61840d536beace65875662911336df12.
- Runtime file: src/components/app/project/wedding-date-form.tsx.
- Regression: src/components/app/project/wedding-date-readback.browser.test.mjs.
- Evidence: experience/reviews/january-wdate-01-2026-09-05; reports/index outside its verified LFS ZIP. No package, lint configuration, principal, Studio or registry edits.

The old form copied initial into saved once. The Overview key includes project/revision/canManage, so a grant-only change retained the mounted form and its old access text. The fix uses current incoming props as the durable readback. A successful local save reply temporarily supplies the readback until that prop snapshot changes. Date draft state stays separate. The existing Overview key still controls new revisions and role changes; no new remount was introduced.

Only that component and its new test changed under src. The canonical writer, server reader, action, DTO, Overview key, dates, terms and role controls remain byte-identical to the parent. The independent review established stale display, not unauthorized mutation; this fix does not raise its severity or claim a deployed authorization incident.

## Actual rendered regression

The same assertions ran against immutable original 2d1 and the fixed source, using the actual mounted ProjectOverview and WeddingDateForm in Chromium at 1440×1080 and 390×844.

| State | Original 2d1 | Fixed |
| --- | --- | --- |
| Same project/revision/role: active → revoked | stale active text; fails | current revocation text; draft 2032-06-01 retained |
| Same key: active → expired | stale active text; fails | current expired date; draft retained |
| Same key: active → changed term | old term; fails | new term; draft retained |
| Successful local save before incoming refreshed props | passes | returned term/date visible; next save uses returned revision |
| Incoming new revision/date | passes | existing remount uses the canonical incoming date |
| Role downgrade | passes | existing remount removes editing controls |

Each row ran at both viewports: original 6/12 fail, 6 controls pass; fixed 12/12 pass. Original failures are negative regression assertions, preserved as failures. The baseline draft remains present while its access text is wrong. The fixed draft remains present with fresh access text.

The original active/revoked/revision DTO values match the independent actual SQLite reader reproduction in outputs/sponsored-wedding-date-2d1d-review. Expired, changed-term and successful-save response vectors are explicitly synthetic. The browser uses listed action/router adapters, including a recorded successful reply and refresh counter; it does not perform DB writes. The browser test executes the component's actual submit/success branch and verifies the next request uses the returned revision.

I inspected the original and fixed mobile revocation renders and fixed desktop changed-term render. Fixed receipts record zero page/console errors, unexpected requests and horizontal overflow. Cached Geist loaded in both viewports. All 24 original/fixed state screenshots and DOM readbacks are retained.

Styling comes from ten byte-identical files in the sealed earlier local build's assets: compiled CSS plus cached Geist WOFF2. Browser routes fulfill these local bytes directly; no HTTP listener or external font request is needed. This is cached-font component evidence, **not** a normal provider/font-network build or a full Next/Clerk application render. The default regression command also passed with no historical CSS dependency.

## Exact checks

Node: C:/Users/ethan/AppData/Local/Programs/nodejs-v22/node-v22.23.2-win-x64/node.exe.
Working directory: the owned App above. Command arrays, exits, source hashes, optional fixture environment and timestamps are in the individual JSON receipts.

| Receipt | Exit / result |
| --- | --- |
| original-render-1 | 1; same 12 browser assertions at immutable 2d1: six intended stale-display failures, six controls pass |
| fixed-render-1 | 0; 12/12 styled browser cases pass |
| browser-default-1 | 0; 12/12 repeated with no optional historical styling environment |
| focused-1 | 0; nine existing actual form/Overview and Tasks/welcome entry tests pass |
| lint-1 | 0; unchanged rules on the authored component and browser test |
| typecheck-1 | 0; tsc --noEmit --incremental false |
| runtime-commit | source hashes equal tested files; explicit-file stage/diff check/commit succeed |

There are **21 unique passing checks** here: 12 browser cases and nine existing form/entry tests. The default unstyled run repeats those 12; it is not an extra set of unique cases. The typecheck was running when the reviewable source commit was made and subsequently passed on exactly the same file hashes.

The browser regression command for principal registration is:

    node --test src/components/app/project/wedding-date-readback.browser.test.mjs

It uses the existing pinned Playwright/Chromium and tsx/esbuild dependencies. WDATE_RENDER_OUTPUT can point to a fresh isolated artifact directory; optional WDATE_CSS_ROOT points to the extracted assets directory. WDATE_SOURCE_REF=2d1d77835e7bcedfab5c68e53608fe5d00dd8f9a executes the original immutable Overview/Form and is expected to fail six assertions. Use fresh output labels and directories; never overwrite retained receipts. Principal owns package/CI registration.

The source commit uses a per-command empty hooks directory to avoid out-of-lane Studio drift-sidecar writes; shared configuration remains untouched. Heavy checks ran sequentially. No install, build or unrelated broad suite was repeated.

## Preservation and remaining validation

Source identities and the artifact index pin the original/fixed files, exact browser inputs, cached styling assets and retained evidence hashes. The original 189-file sponsored-date output and the 45-file legacy-retirement output still match their sealed manifests. The independent review inputs are read only and hashed; their report and evidence were not edited. New evidence has its own directory and archive, with no CommonJS imports added as live repository evidence code and no lint exclusions.

Principal/Plato owns the incoming independent verification and integration decision. This packet does not assert that review passed. Principal's previously reported 43-date-test composition is not counted as an independently run gate here.

Unchanged limits:
- Actual React DOM/Chromium component updates are proven, not Next router.refresh/Flight ordering, HTTP session identity, Clerk or production behavior.
- The earlier Clerk fixture denial/keyless disposition and failed workbench finalization remain separate and unresolved by this fix. Neither was retried or rerouted.
- No fresh claim is made about remote-client transaction contention/recovery, provider state, deployed flags, historical grant repair, council or human comprehension.
- No broad authorization, lifecycle, pricing, policy, schema, Event closure or permission redesign was undertaken.

Proposed principal-owned CHANGELOG/programme wording: “The wedding-date form now refreshes sponsored access status when server readback changes, while retaining an unsaved date. WDATE-01 is a bounded display correction; final receiving and independent verification remain separate.”

Launch and outreach remain held for January 21. No customer, provider or production action occurred.
