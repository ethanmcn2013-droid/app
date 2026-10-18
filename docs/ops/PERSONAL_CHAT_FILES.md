# Personal-chat files

Internal candidate, 18 October 2026. This document does not establish release or activation. Home, Projects, shared conversation attachments and Ping's assistant are outside this increment.

## Use

Open the round Chat button over the current page, then choose personal chat. Choose a file, wait for its upload to finish and send it with a note or on its own. Up to three files can accompany one message. Reopen personal chat to find the saved message and download its files. Remove a staged file to cancel that attachment before sending.

Personal files belong to the signed-in account. They do not inherit access from a Task, Project, channel or guest link. Markdown export includes authenticated relative download links; it does not package file bytes or grant another reader access.

The preview uses sample data. Production use requires the separate receiving and activation steps below.

## Limits and availability

- JPEG, PNG, WebP, PDF, plain text and Markdown; at most 2 MiB per file.
- Three files per message, 50 MiB of retained bytes per account and ten uploads per minute. Unresolved storage writes can continue consuming this allowance.
- File-type and signature checks are bounded validation, not antivirus scanning.
- Staged files expire after 24 hours. Cleanup runs during attachment activity and account-erasure recovery, rather than on a new scheduled service. Expiry does not promise immediate byte deletion.

The server exposes attachment capability only when `SIGNAL_PERSONAL_CHAT_ATTACHMENTS_ENABLED` is exactly `true`, the complete attachment schema is available and storage is configured. Leave the flag off while preparing the release. Text-only personal notes retain their existing path.

Local development can use disk storage. On Vercel, the adapter requires `BLOB_READ_WRITE_TOKEN`; it does not fall back to the ephemeral filesystem. The credential must target an appropriately isolated store supporting private blobs. Never place a storage credential in a browser, receipt or exported note.

## Receiving before activation

1. Receive Ping's migration 0044 through its owner. Review this increment's exact 0045 SQL, receipt and ledger prefix separately. Use the approved encrypted-backup migration route in `DEPLOY.md`; do not run an ad hoc production migration.
2. Pass the required checks and independent revision-bound review for the exact release source. Keep failed and superseded attempts. A sample-data capture is not authenticated or production proof.
3. Qualify the actual private-storage adapter in an isolated approved environment: upload, send, reopen, exact-byte authenticated download, unauthenticated/foreign-account denial, cancellation and confirmed deletion. Record the actual storage target without exposing its credential or private locator. Injected provider tests and disk receiving alone do not qualify Blob.
4. Agree one production release owner with Ping. Refresh the deployment and alias baseline, verify the exact deployment and configuration, then run the authorized production receiving journey with disposable data.
5. Activate only after the source, schema, storage and receiving receipts agree. Record the exact configuration change and result in the existing Delivery record. Recheck text-only behavior and account isolation.

## Storage custody and recovery

Each upload pins its original disk root or credential fingerprint. Writes recheck the original admission deadline, ownership claim and account-erasure fence before storage. A rejected remote upload can still be uncertain; the system retains its custody instead of declaring the bytes absent because time elapsed.

Credential changes deliberately fail closed, including rotation within the same Blob store. Retain the original approved credential through pending-file reconciliation. Restore it only through the owning secret-management process, or prepare a separately reviewed reconciliation against the exact original store. Do not rewrite stored identities, clear unresolved rows, lower quota totals or claim erasure solely to unblock an upload.

Account deletion retains attachment custody until the exact deletions are confirmed. The current implementation offers neither universal rollback nor exactly-once external writes. Disabling the attachment flag stops new capability; it is not a byte-erasure or migration-rollback procedure. Preserve the compatible schema and pending custody when recovering an application release.

## Evidence boundary

At preparation time, corrected storage fault tests and actual two-account development receiving with disk storage have passed. Sample-data browser checks cover compact Chat, short-screen controls and attachment download behavior. Hosted final checks, live Blob qualification, migration application and production receiving remain separate gates. Ethan deferred physical-phone dictation and keyboard testing; desktop viewport emulation does not complete that test.
