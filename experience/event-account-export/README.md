# Profile account JSON — component preview

Owned fixture for the Event export prerequisite, using the existing repository
React/esbuild, Tailwind/PostCSS, local-font and Chromium component-preview pattern.
Run from the App worktree, with installed pinned dependencies and no credentials:

```sh
node --import tsx --import ./src/test/register-server-only.mjs experience/event-account-export/browser.mjs
```

`PROFILE_EXPORT_OUTPUT` selects a **fresh** output directory; the default is
`experience/output/event-account-export/after`. `--baseline` renders only the
original cbf40 DataPrivacy source and records the missing direct link as a failed
control in a separate `before` directory. It is not an accepted baseline.

The runner chooses an unused `127.0.0.1` port, records it and its PID, performs an
HTTP preflight, then captures 390×844 and 1440×960 in light/dark. It checks native
download semantics, no eager export request, keyboard focus/Enter, target size,
overflow, browser errors and the downloaded JSON. It closes only its own browser,
server and disposable SQLite stores, including on failure.

DataPrivacy and SettingsSection are actual imported components with owning App
CSS and fonts. The complete Next/Clerk profile route and unrelated profile rows
are not mounted. A fixture request adapter executes the actual HTTP export handler
and unified Tasks exporter; the authenticated actor is synthetic and the other
module exporters explicitly return unavailable. A checkout intent is made through
the actual local writer; no provider call or positive grant occurs. The baseline's
Next Link is an anchor adapter. These limits are also in every receipt.

Principal owns package/default registration and final experience composition.
Material surface: existing `tasks.page.settings-profile`; changed dependency:
`src/components/settings/profile/data-privacy.tsx`. This component receipt is not
a replacement for full route/session/browser or human acceptance. Account JSON
contains metadata, not uploaded or Google Drive file contents.
