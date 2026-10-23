# Shared conversation files: operator readiness

Project conversations, direct messages and their replies use the existing private native-upload storage adapter. This runtime reuses the existing `BLOB_READ_WRITE_TOKEN` configuration; it does not provision a new store, account, provider, API key or billing plan. No credential value is needed in source, logs or evidence.

The runtime gate is `SIGNAL_CONVERSATION_ATTACHMENTS_ENABLED=true`. It stays absent or false until the release owner separately approves activation. Ordinary text chat remains available with the gate off or the additive schema missing. Existing Chat/member and DM controls still apply (`SIGNAL_CONVERSATION_INTERNAL_ENABLED`, the current Chat audience control, and `SIGNAL_CONVERSATION_DM_ENABLED`). Guests receive no new access.

Before activation, the release owner verifies the separately reviewed 0047 migration is applied through the approved encrypted-backup/receipt migration path. The required table is `conversation_chat_attachments`; application schema detection refuses file operations if it is missing. PR #323 owns that immutable data change; the runtime PR does not modify its SQL, journal, ledger or receipt.

On Vercel (`VERCEL=1`), the private adapter needs the existing Blob credential. With no token it reports unavailable; it does not fall back to ephemeral local disk. A credential-free local fixture uses a task-owned disk root. Local development normally uses `.data/uploads`; the browser harness pins an isolated temporary root instead.

Blob writes use private access. The database stores exact backend, object key and credential/store identity; a changed credential cannot silently redirect old rows to another store. Rotation or store migration requires the existing custody/reconciliation process. Unsettled writes retain custody until a terminal outcome is known. Download URLs are authenticated application routes; storage URLs are never public links.

Limits are 2 MiB per file, three files per message, a bounded type/signature allowlist, ten upload admissions per minute per actor and a 100 MiB per-actor retained footprint. These limits are code admission controls; no new billing allowance is authorized here.

Names-only readiness evidence should identify the target revision, migration receipt, gate state, existing private Blob configuration readiness and current Chat/DM controls without printing values. This document is source-derived preparation, not proof of production configuration or storage delivery. Production inspection, migration apply, activation, deployment and live receiving remain with the release owner.

Canonical synthetic receiving is `pnpm test:conversation-attachments:browser`. It starts only its own loopback dev client and SQLite/private-disk proxy, strips provider/database credentials from child environments, records exact revision/ports/PIDs, and stops its process trees. Its tests cover Project and DM upload/paste, file-only reply, reload/download, pending receipt recovery and explicit reupload after audience change. The required Design quality workflow runs it and retains its receipts/logs/screenshots. This does not establish physical-device behavior, production identity or Blob-provider delivery.
