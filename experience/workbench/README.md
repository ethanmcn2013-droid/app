# Populated task detail workbench scenario

This scenario prepares the real built App's existing populated wedding task detail panel for private visual review. It uses the registered critical case `tasks.surface.task-detail-panel / populated task` and all four viewports from `experience/browser-contract.json`.

Run it from the App repository with a new direct-child folder under `experience/output/workbench-runs`:

```powershell
pnpm experience:workbench -- --output experience/output/workbench-runs/run-001
```

The runner rejects a different branch, an obsolete scenario/fixture mapping, runtime-source edits that have not been committed, a reused output folder, symlinked output paths, extra CLI arguments, or an output path outside the evidence directory. It invokes the fixed Playwright test through Node without a shell. The Playwright configuration builds the app before starting the local production server.

Each run writes `receipt.json`, the full Playwright JSON report, captured stderr, source/build metadata, the exact runner and scenario definition, and the four actual screenshot PNG files. The receipt hashes each artifact and binds the scenario definition digest, source commit/tree, fixture/config/test hashes, local build manifests, process exit, test results, screenshot hashes and the declared browser environment. The manifest version and digest identify the reusable scenario; the unique run ID identifies one attempt.

The recorded fidelity is a built App with synthetic demo-mode data and preview-mode flags. This scenario does not prove authenticated identity, customer data, persistence, server-action readback, candidate comparison, human receiving, acceptance, or release. Those are declared limitations, not readiness blockers for this visual slice. A failed or incomplete run retains its receipt, raw process output and any screenshots the reporter produced.
