# Isolated hosted reliability run

Run from the App repository root. The private JSON file must be named `.env.reliability-hosted.json` (or `.env.reliability-hosted.<slug>.json`) so Git ignores it. Keep receipts under `.db-evidence/<unique-run-id>`, which is also ignored. Create `.db-evidence` before execution. Neither file belongs in a PR.

```powershell
node --import tsx --import ./src/test/register-server-only.mjs scripts/reliability/hosted-run.ts .env.reliability-hosted.json
```

That command makes one read-only request to the pinned Preview attestation endpoint and performs no fixture writes. It must report `accepted: true` before execution. To seed and run the fixed 75-minute workload, add `--execute` to the same command. The launcher calls the seed once and the workload once; the workload contains all three repetitions and the session cleanup. After a completed seed it deletes only the new fixture namespace in `finally`. A partially failed seed is retained for review rather than risk deleting a pre-existing namespace.

The private file has this shape. Replace every placeholder and compute the derived hashes exactly as described below; a placeholder causes preflight to fail.

```json
{
  "manifest": {
    "schemaVersion": 1,
    "runId": "hosted-unique-run-id",
    "fixtureNamespace": "reliability-hosted-unique-run-id",
    "environment": { "kind": "hosted-test", "identity": "<projectId>/<deploymentId>/<sourceSha>/<region>", "configHash": "sha256:<hash-of-JSON-expectedRuntime>", "production": false },
    "allowedOrigins": ["https://<immutable-preview-origin>"],
    "allowedNetworkOrigins": ["https://<immutable-preview-origin>", "https://<Clerk-test-issuer>", "https://api.clerk.com"],
    "authentication": { "issuer": "https://<Clerk-test-issuer>", "configHash": "sha256:<hash-of-pk_test-key>", "mode": "clerk-development" },
    "expectedTargetHashes": {
      "tasks": "sha256:<hash-of-TASKS_DATABASE_URL>", "notes": "sha256:<hash-of-NOTES_DATABASE_URL>",
      "timeline": "sha256:<hash-of-TIMELINE_DATABASE_URL>", "signal": "sha256:<hash-of-SIGNAL_DATABASE_URL>",
      "entitlements": "sha256:<hash-of-ENTITLEMENTS_DATABASE_URL>",
      "attachments": "sha256:<hash-of-literal-isolated-preview-native-attachments-disabled-v1>"
    },
    "allowedDeliverySinks": [{ "name": "conversation-delivery", "configHash": "sha256:<hash-of-literal-disabled>", "mode": "disabled" }],
    "testActors": [
      { "actorHash": "sha256:<hash-of-first-Clerk-user-ID>", "kind": "controlled-test", "ownershipConfirmed": true },
      { "actorHash": "sha256:<hash-of-second-Clerk-user-ID>", "kind": "controlled-test", "ownershipConfirmed": true }
    ],
    "excludedStores": ["attachments"],
    "executionMode": "hosted-authenticated-route"
  },
  "expectedRuntime": {
    "sourceSha": "<40-hex-commit>", "projectId": "prj_<id>", "deploymentId": "dpl_<id>",
    "region": "<region>", "origin": "https://<immutable-preview-origin>",
    "stores": {
      "TASKS_DATABASE_URL": "<raw-64-hex-SHA256>", "NOTES_DATABASE_URL": "<raw-64-hex-SHA256>",
      "TIMELINE_DATABASE_URL": "<raw-64-hex-SHA256>", "SIGNAL_DATABASE_URL": "<raw-64-hex-SHA256>",
      "ENTITLEMENTS_DATABASE_URL": "<raw-64-hex-SHA256>"
    }
  },
  "productionExclusions": {
    "origins": ["https://app.signalstudio.ie"],
    "projectIds": ["prj_<actual-production-project-id>"],
    "deploymentIds": ["dpl_<actual-production-deployment-id>"],
    "allowPreviewInProductionProject": true,
    "storeHashes": ["<raw-64-hex-production-store-hash-1>", "<hash-2>", "<hash-3>", "<hash-4>", "<hash-5>"]
  },
  "storeUrls": {
    "TASKS_DATABASE_URL": "libsql://<isolated-tasks>", "NOTES_DATABASE_URL": "libsql://<isolated-notes>",
    "TIMELINE_DATABASE_URL": "libsql://<isolated-timeline>", "SIGNAL_DATABASE_URL": "libsql://<isolated-signal>",
    "ENTITLEMENTS_DATABASE_URL": "libsql://<isolated-entitlements>"
  },
  "tasksToken": "<isolated-tasks-token>", "attestationToken": "<43-character-Preview-Bearer-token>",
  "vercelProtectionBypassToken": "<optional-controlled-Preview-bypass-token>",
  "clerkSecretKey": "sk_test_<controlled-instance>", "clerkPublishableKey": "pk_test_<same-instance>",
  "clerkIssuer": "https://<issuer-derived-from-the-test-publishable-key>",
  "actors": [
    { "actorId": "<first-existing-App-user-ID>", "clerkId": "user_<first-controlled-Clerk-ID>", "actorHash": "sha256:<hash-of-first-Clerk-user-ID>", "ownershipConfirmed": true },
    { "actorId": "<second-existing-App-user-ID>", "clerkId": "user_<second-controlled-Clerk-ID>", "actorHash": "sha256:<hash-of-second-Clerk-user-ID>", "ownershipConfirmed": true }
  ],
  "outputDirectory": ".db-evidence/<unique-run-id>",
  "seedDomainWriteCap": 11510, "appRequestCap": 30000, "identityRequestCap": 2000
}
```

Hash strings use UTF-8 SHA-256 of the exact input bytes. `expectedRuntime.stores` uses raw hex because that is what the read-only endpoint returns; `manifest.expectedTargetHashes` and actor hashes use `sha256:` plus the same hex. `manifest.environment.configHash` hashes `JSON.stringify(expectedRuntime)` with the property order shown above. The live endpoint must independently attest `/2` with both Vercel environment fields set to Preview, the exact immutable deployment, test Clerk instance and issuer, two App actor allowlist hashes, internal/send enabled, delivery/DM disabled, remote conversation target, five store hashes, and disabled native byte storage. A Preview may share the production Vercel project only when `allowPreviewInProductionProject` is true; the exact production deployment, origin and store hashes remain excluded. Omit `vercelProtectionBypassToken` when the deployment has no Vercel protection, or supply it only for this immutable Preview origin.

The schedule has 20,382 request slots over three repetitions plus one scope-denial request. Ten controlled Clerk sessions are created once and revoked in the workload `finally`. The identity cap of 2,000 covers 10 creates, 10 initial tokens, 10 revokes, nominal token renewals throughout 75 minutes and bounded retries. The fixture budget is 10 projects, 1,000 tasks, 10,000 messages, and 500 resource metadata rows: 11,510 domain writes outside the App request cap. No native byte upload is included. The output records attempted App calls, actual App transport requests, provider traffic, database verification queries, and separate cleanup receipts.
