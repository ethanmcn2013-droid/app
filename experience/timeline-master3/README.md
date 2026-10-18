# Master 3 component capture harness

This development-only harness renders the **actual TimelineArtifact**, its model and its styles from the admitted App source. `fixtures.json` contains invented Master 3 design data:16 Final scenarios with144date rows, no real Project IDs, no account/auth/DB/provider runtime and no publication. The notice sits outside the artifact. No DC code, replacement UI or fabricated following/confirmation result is used.

Preparation commands (no browser):

```powershell
node experience/timeline-master3/matrix.mjs --plan
node --test experience/timeline-master3/harness.test.mjs
```

Only after root receives UI/model/DTO freezes and admits actual capture:

```powershell
node experience/timeline-master3/serve.mjs D:/Codex-scratch/project-ping/unique-master3-host <exact-current-head>
node experience/timeline-master3/matrix.mjs D:/Codex-scratch/project-ping/unique-master3-host/ready.json D:/Codex-scratch/project-ping/unique-master3-capture D:/Codex-scratch/project-ping/capture-admission.json
```

The admission JSON must contain `allowCapture:true`, `sourceHead`, `fixtureSha256`, `uiFreeze`, `modelFreeze` and `dtoFreeze`. Those values record real receiving; an example is not approval. A fresh owner record is required in both outputs. The server binds an ephemeral127.0.0.1port, exposes GET-only fixture/assets/health routes and returns404for APIs. Write `STOP` only in its own output directory to close it; expiry is8hours. No process outside this host is stopped.

The automatic matrix measures16scenarios × light/dark ×1440×810,390×844,1280×800:96base renders. It saves32screenshots at original wrapper themes for desktop/phone and4focused1280screenshots, plus8text-spacing/forced-color captures. Metrics cover real viewport geometry, document overflow, page/console errors, blocked remote dependencies, reduced-motion/forced-color media and actual keyboard focus. No automatic retry runs. Failed images and receipts remain; a later confirmation must use a new output directory.

Following/pending wrappers render the actual unavailable-service product boundary until an owning service is integrated. Their receipts set `designStateComplete:false`; they are not confirmed-following acceptance. Owner edit/menu/share functions are not faked. Returning-visitor and additional controls bind only after exact UI props are frozen. Native200%/400%browser zoom is a separate root smoke check: CSSscale/deviceScaleFactor is never relabelled nativezoom. The real Next/Clerk route is independently received by root.

The old96-case plan is cheap measured coverage, not96images to accept blindly. Review actual representative screenshots at readable size, including every16Final scenario on desktop and phone; dark/light/1280and edge samples are additional. A green script proves only its stated synthetic component assertions. It does not certify visual acceptance, service delivery, publication, production, user-visible paint or CI.
