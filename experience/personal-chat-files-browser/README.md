# Personal Chat and files browser regression

`pnpm test:personal-chat-files:browser` uses the existing production build and
starts its own loopback Next server on port 4836. Set
`PERSONAL_CHAT_FILES_BROWSER_PORT` to another unused port if necessary. An occupied
port fails; no existing server is reused or terminated. Playwright owns teardown.

CI runs this immediately after the canonical rendered capture, which supplies a
demo/preview build. For a credential-free local build:

```
node experience/personal-chat-files-browser/server.mjs build
corepack pnpm test:personal-chat-files:browser
```

The launcher reads the canonical browser contract, pins demo/preview and Active
Project V3, forwards only basic OS environment variables, and refuses production
dotenv files. It never forwards database/provider credentials. Do not run a build
over another session's active checkout; use an isolated checkout when necessary.
No dependency installation, database setup, migrations or provider calls occur.

Five viewport/theme cases protect compact overlay geometry, draft continuity
through real soft navigation, short-screen staged files and validation feedback,
attachment-only send and exact native download, toast stacking/dismissal, focus
return and scoped accessibility. Clipboard is a separate desktop-only native
Chromium check, with an explicitly simulated rejection and restored native write.

Files, messages and `tasks:toast` events are synthetic UI evidence. Demo files
remain in the browser tab; reload is not durable account persistence. This suite
does not establish signed-in authorization, provider delivery, storage custody,
service-failure retry, physical phone safe areas or keyboard behavior, or Ping
integration. Toast action links are not covered by the event bridge fixture.

Failures retain traces, screenshots and diagnostics under
`experience/output/playwright-results/personal-chat-files`, already included in
Design quality's existing artifact upload. `receipt.json` records the build ID,
revision, scoped source hashes, results and artifact index. No screenshot baseline
is updated and no existing experience assertion is weakened.
