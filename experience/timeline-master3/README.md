# Master 3 component capture harness

This development-only harness renders the **actual TimelineArtifact**, its model and its styles from the admitted App source. `fixtures.json` contains invented Master 3 design data:16 Final scenarios with144date rows, no real Project IDs, no real account, ambient DB, provider call or publication. The notice sits outside the artifact. No DC code, replacement UI or fabricated following/confirmation result is used.

Preparation commands (no browser):

```powershell
node experience/timeline-master3/matrix.mjs --plan
node --test experience/timeline-master3/harness.test.mjs
```

Only after root receives UI/model/DTO freezes and admits actual capture:

```powershell
node --import tsx --import ./src/test/register-server-only.mjs experience/timeline-master3/serve.mjs D:/Codex-scratch/project-ping/unique-master3-host <exact-current-head>
node experience/timeline-master3/matrix.mjs D:/Codex-scratch/project-ping/unique-master3-host/ready.json D:/Codex-scratch/project-ping/unique-master3-capture D:/Codex-scratch/project-ping/capture-admission.json
```

The admission JSON must contain `allowCapture:true`, `sourceHead`, `fixtureSha256`, `uiFreeze`, `modelFreeze` and `dtoFreeze`. Those values record real receiving; an example is not approval. A fresh owner record is required in both outputs. The server binds an ephemeral loopback port. Its actual product guest endpoints use a fresh local SQLite database and an injected test-mail transport restricted to example.invalid addresses; other APIs return 404. Owner authentication/public projection resolution are explicit fixture injections, not live Clerk or publication proof. Write `STOP` only in its own output directory to close it; expiry is8hours. No process outside this host is stopped.

The automatic matrix measures16scenarios × light/dark ×1440×810,390×844,1280×800:96base renders. It saves32screenshots at original wrapper themes for desktop/phone and4focused1280screenshots, plus8text-spacing/forced-color captures. Metrics cover real viewport geometry, document overflow, page/console errors, blocked remote dependencies, reduced-motion/forced-color media and actual keyboard focus. No automatic retry runs. Failed images and receipts remain; a later confirmation must use a new output directory.

Following/pending wrappers are established through the actual TimelineFollow component → product HTTP handler → guest service/store → isolated SQLite. Subscribe produces an actual pending record, a local test-mail receipt and the product HttpOnly management cookie. Following requires the real confirmation POST from that test-mail link and a reload that reads the confirmed cookie status. The browser also exercises Stop following and Undo inside the real ten-second window, checking SQL restoration. No browser following flag, fabricated count or sent-state property is used. This remains injected test delivery, not real email.

Owner controls receive an injected synthetic owner session backed by the fixture SQLite record; counts come from confirmed subscription rows. Edit/menu links operate real authorized fixture-record routes, not an App editor, so native owner settings/editing qualification remains separate. Calendar links use the product calendar handler and actual local ICS response; sharing uses a real fixture public URL. The long-name owner label comes from the exact extracted full source name. All Tasks source state remains later; no date passage is regraded as completion. The synthetic notice is normal flow below the artifact and cannot cover its footer.

Returning-visitor fixtures write only their invented date hint into the frozen public visitor-storage key before load; that hint is not identity or consent. Native 200%/400% browser zoom remains a separate root smoke check: CSS scale/deviceScaleFactor is never relabelled native zoom. The real Next/Clerk route and production services are independently received by root.

The old96-case plan is cheap measured coverage, not96images to accept blindly. Review actual representative screenshots at readable size, including every16Final scenario on desktop and phone; dark/light/1280and edge samples are additional. A green script proves only its stated synthetic component assertions. It does not certify visual acceptance, service delivery, publication, production, user-visible paint or CI.

Review-fix Share receiving: the fixture supplies only a relative `/s/<synthetic-token>` URL. The loopback recipient GET renders the same actual artifact/DTO in guest context, with no owner endpoint or owner cookie injection, including for source owner boards. The matrix reads actual clipboard output and opens that local recipient; it verifies no Edit or Guest updates controls. Production/private/signed URL guards remain product tests. No production URL is fabricated. TimelineFollow receives its actual timeline DTO for context copy.
