# January S4 utility navigation repair

Status: coherent implementation for lead integration and independent review.
Branch: `fix/january-utility-navigation`.
Base: `e64083504c527f6d42e571defeba7aeaa72dc575`, the integration HEAD when this worktree was created.
Worktree: `C:/Users/ethan/signal-studio-workspace/worktrees/app/fix-january-utility-navigation`.
Reviewed: 2026-09-04. Exact source hashes: [source-manifest.json](source-manifest.json).

## Delegated repair and source boundary

The user delegated a minimal repair of demonstrated navigation defects. The
existing negative predicate treated Settings as a task board and exposed
Board/List/Schedule/Calendar, Share and task export actions there. The shared
public header also compressed the Tasks identity underneath the demo account
link at 390px, as recorded in the earlier invitation review.

- `AppPageHeader` now grants task tabs/share/export actions only to the four
  canonical Tasks view paths. Utility pages, sibling products, unknown paths
  and a tab-highlight override cannot acquire those actions. Settings is named
  Settings and retains the loaded project name underneath. Any task links
  emitted by this component preserve the loaded project via `workspaceId`.
- The shared public header lets its existing identity and account/menu groups
  wrap at narrow widths. The desktop bar, link order and menu behavior remain.
  No new navigation destination or information architecture was introduced.
- The rail's public link is now **About Signal Studio**, with an external-link
  glyph, a short visible **About** label, and its existing new-tab/rel behavior.
  It sits outside the three-product navigation and uses `data-utility`, not a
  fourth product identity. The destination remains the canonical Studio URL.
- The actual hybrid Tasks canvas and exported `PageActionsOverflow` component
  are unchanged. No Drive, billing, invitation backend, schema, provider,
  membership, build/deployment configuration or dependency version was edited.

The existing visual language and responsive menu were reused. Motion verdict:
restrained, no new animation. Signal preview and brand guidance were applied;
the elevation skill's full direction programme is inapplicable to this bounded
repair. This is a delegated implementation decision, not a founder direction
pick, council result, design lock or human usability acceptance.

## Rendered evidence

All `after` images come from the final source on the local review server.
The Settings pre-repair capture is [settings-mobile-before.png](settings-mobile-before.png).
Public-header pre-repair evidence is retained in
`experience/reviews/january-invite-2026-09-04/valid-mobile.png` and its README
(original user pointer: `outputs/app-invite-review/README.md`).

| Surface | Evidence | Direct observation |
| --- | --- | --- |
| Settings desktop, 1280 × 900 | [image](settings-desktop-after.png) | Settings heading, project context, three product links and external About utility; zero task-header actions. |
| Settings mobile, 390 × 844 | [image](settings-mobile-after.png), [DOM](settings-mobile.txt) | Tab from Workspace reaches Members with a 2px focus outline; Enter opens the Members section. Review controls remain disabled. |
| Settings narrow, 320 × 844 | [image](settings-320-after.png) | Title and project context remain readable; no horizontal document overflow. Existing Settings section strip scrolls within its container. |
| Public invitation, 390 × 844 | [image](invite-mobile-after.png) | Identity and demo link occupy distinct rows without overlap. Disabled invitation fixture is unchanged. |
| Public mobile menu | [image](invite-mobile-menu.png), [DOM](invite-mobile-menu.txt) | Tab reaches menu trigger; Enter opens it; Tab reaches Pricing; Escape closes it and returns focus to the trigger. No external link was activated. |
| Public narrow and desktop | [320](invite-320-after.png), [1280](invite-1280-after.png) | No pairwise collision between visible header links/buttons; desktop keeps the one-row bar. |
| Reflow, 640 × 450 | [Settings](settings-reflow-640.png), [public](invite-640-after.png) | Narrow CSS viewport equivalent to 1280px at 200%; no document overflow. This is **not** an actual browser zoom result. |
| Other utility headers | [Inbox](inbox-mobile-after.png), measurements below | Inbox, My work and Archived retain their own titles and have zero header links/buttons at 390px. |
| Tasks preservation | [desktop](tasks-desktop-after.png), [mobile](tasks-mobile-after.png), [List](tasks-list-mobile-after.png) | Four canonical view links and Share remain in the existing canvas DOM; Enter on List reaches `/app/tasks/list`. The existing dark-canvas contrast issue below prevents a visual acceptance claim. |

[browser-measurements.json](browser-measurements.json) records exact routes,
viewport dimensions, document widths, public header rectangles/collisions,
keyboard results and the retained Tasks contrast finding. Public pages have a
15px vertical scrollbar, explaining document widths below `innerWidth`.
No horizontal document overflow was measured in these cases. Internal task
canvas scrolling and the Settings section strip are separate from document overflow.

## Checks and honest limits

Passed against final source:

- `pnpm install --frozen-lockfile`; existing pinned lockfile, no `.env` copied.
- `pnpm test:suite-url-and-switcher`, including five new focused tests in
  `src/components/app/page-header-context.test.ts`: negative route authority,
  four allowed views, page names, canonical project context, and the external
  utility versus the three-product switcher. The existing suite command is
  already part of `test:truth`/`pretest`, so these tests are not orphaned.
- Focused ESLint on the five changed TS/TSX files.
- `node scripts/check-module-boundaries.mjs`, `pnpm check:suite-switcher`,
  `pnpm check:tap-targets`, and `pnpm first-contact:language`.
- `node scripts/experience/validate.mjs`: registry structure/materiality clean.
  Its 83 experiences/458 states/332 breakpoints describe the manifest; they
  were **not** browser-tested by this repair.
- HTTP HEAD `/app/settings` returned 200 after the preview restart.

`pnpm typecheck` was run. Initial startup left malformed generated Next route
files; the owned preview was stopped, only the two generated files were
removed, and `pnpm exec next typegen` succeeded. The subsequent typecheck
reported only inherited `src/lib/sentry-scrub.test.ts:68` TS2352 (`ErrorEvent`
missing `type`). The lead's later `ffa60f4e` owns that fix. It is deliberately
not duplicated in this branch. Integration must rerun typecheck with it retained.

Remaining review boundaries:

- Actual 200% browser zoom is unverified. The available browser capability
  exposes viewport dimensions only; attempted browser zoom shortcuts did not
  change the measured viewport or device scale. 640px reflow was tested instead.
- [console.json](console.json) retains hydration warnings naming injected
  `stndz-general-13` / `stndz-custom-css` extension styles. A separate warning
  about a script tag during client rendering appeared on the Board-to-List
  transition; its cause is not established here. No clean-console claim is made.
  The development issue badge is intentionally present in the evidence.
- The unchanged hybrid Tasks canvas renders inactive view text at
  `rgba(17,17,17,0.72)` against its dark surface in this browser, making those
  labels low contrast. Links and keyboard arrival were verified; dark-canvas
  visual acceptance remains with the lead's broader review. This change does
  not edit hybrid canvas CSS or claim to resolve that defect.
- No exhaustive network trace, clean-browser hydration check, screen-reader
  audit, actual multi-project authenticated switching, provider activity,
  production data, full test suite, production build or performance gate ran.
- No critical Playwright attestation or old Settings hydration spec was run,
  imported or rebound. Existing registry acceptances and pending billing visual
  acceptance remain untouched. The lead's `50f16575` Settings isolation repair,
  `ffa60f4e` test changes, separate hydration configuration and pending Drive
  copy refinements must remain on integration. No Drive branch was changed.

## Preview handoff

The owned review server remains at <http://127.0.0.1:3131/app/settings> and
<http://127.0.0.1:3131/invite/review-valid>. It uses existing synthetic review
routes with no credentials or environment file. Drive UI is left at its
default-off value. Start command, from this worktree:

```powershell
$env:NEXT_PUBLIC_SIGNAL_ACCESS_MODE='review'
$env:SIGNAL_ACCESS_MODE='review'
$env:VERCEL_ENV='preview'
$env:NEXT_PUBLIC_SIGNAL_DEPLOYMENT_ENV='preview'
$env:NEXT_PUBLIC_TASKS_FIRST_COMPLETION='off'
$env:SIGNAL_ANALYTICS_V1_ENABLED='false'
$env:SIGNAL_HOME_ANALYTICS_ENABLED='false'
$env:NEXT_TELEMETRY_DISABLED='1'
pnpm dev --hostname 127.0.0.1 --port 3131
```

Current exec session: `57635`; Next launcher PID `22364`, server PID `14224`
at handoff. Stop with Ctrl+C in that owned session after coordination; verify
process identity before acting on a PID after a restart. The original S4
preview session `52930` was restarted for generated type repair. The earlier
Drive server on 3127 was stopped with user authorization. Lead preview 4350
was not touched. No heavy build ran alongside the lead's CI/review build.

Integrate the explicit commit from this branch, retain the later lead fixes,
rerun focused tests/typecheck, and review these routes in the lead's clean
built preview. This branch is committed locally only; no push or merge.
