# Assistant receiving harness

Run from the repository root with Node 22 and the existing dependencies:

```powershell
node --import tsx --import ./src/test/register-server-only.mjs experience/ping-assistant/serve.ts D:/scratch/unique-receiving-run
node experience/ping-assistant/receive.mjs D:/scratch/unique-receiving-run
node experience/ping-assistant/matrix.mjs D:/scratch/unique-four-viewport-matrix
```

Use a fresh output directory for every server run. `matrix.mjs` starts and retires one independent server process and SQLite database per viewport, preserving each process outcome; it is the preferred complete receiving command. `receive.mjs` accepts an optional viewport such as `390x844` after its output path. `owner.json` is exclusively created; an existing run is never overwritten. The server binds an ephemeral loopback port and records its PID, source revision, URL and synthetic database path in `ready.json`. Create `STOP` in that exact output directory to close only this server and retain its final SQL snapshot. An eight-hour bound also closes it. The proof database is retained for inspection.

The harness renders the actual `FloatingChatRoot`, `PingPersonalAssistant`, and `CurrentProjectPreviewView`. Next navigation/link and unrelated conversation panes are fixture seams. Assistant HTTP requests enter the actual `createAssistantHttp`, service, durable store and domain actions against `createPingProofFixture` SQLite. All fixture transactions use the runtime's shared transaction admission helper. Actor `owner` admission, finite planner, outbound transport and Timeline provisioner are explicitly injected. Timeline items are read from actual saved milestone tasks; no Timeline publication helper or real publication is invoked. No keys, ambient Tasks connection or provider runtime are loaded.

Finite supported requests:

- `Create 100 tasks and open private preview`
- `Archive 90 of those tasks`
- `Draft two tasks`
- `Create two recovery tasks`
- `Create new Project and one task`
- `Make a partial result`
- `Open private preview`
- `Make an unknown result` (explicit executor uncertainty injection; cancellation must preserve the unknown receipt and unlock the next request)

Other text exercises the actual unsupported-plan service path. Browser checks run at 390×844, 768×1024, 1280×900 and 1440×960 with reduced motion. They assert actual SQL effects, draft non-effects/apply, cancellation, postcommit lost-response recovery, and absent-original re-entry retaining the client request ID. A fresh request after re-entry is deliberately required. Reload never submits or executes the original again. Keyboard focus is checked separately.

The injected Next router records navigation intent rather than changing the fixture page. The browser verifies that the direct successful create100/preview reply calls `router.push` with the actual private-preview href after Tasks save, while history, lost-reply recovery reads and cancellation do not. Actual preview rendering is separately inspected through the retained result link. This does not qualify a production Next transition or authentication boundary. Floating Ping is measured at 500px on desktop, with ordinary Chat restored to its original width; assertions wait for actual geometry after the reduced-motion frame.

Loading, disabled, restricted and transport-error screenshots use documented Playwright network response seams. They demonstrate the real client's rendering of those responses, not live authentication behavior. Preview coverage includes actual populated and empty read-only views. Preview route loading/error/restriction boundary components are not rendered by this harness and must not be inferred from its images.

`receiving.json` lists assertions, actual screenshot paths/SHA-256, page errors, console events and failed requests. Two failed requests per viewport are intentional loss injections. Failed attempts retain `receiving-failed.json`; a later pass does not regrade them. These checks establish local integrated behavior only, not model interpretation, live Clerk authentication, production delivery, paint latency, or production acceptance.
