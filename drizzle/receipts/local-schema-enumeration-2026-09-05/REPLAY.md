# Historical adoption retry compatibility

Independent review R1 found that correcting the fingerprint broke a no-op replay
of an already-recorded adoption whose ordinary sqlite-like objects were omitted
by the historical LIKE predicate. Replacing that receipt would break its stored
immutable hash. Both original failures and the independent parent/candidate
reproduction are preserved separately from the original enumeration result.

The successor permits the old fingerprint only after validating an existing
adopted-legacy row, its exact receipt ID/hash, normal source metadata, target,
environment, proofs and relevant Drizzle history. It returns a read-only no-op;
no receipt or database metadata is rewritten. New adoptions always need the
complete fingerprint and `schemaFingerprintVersion: "sqlite-schema/2"` in the
new receipt. That field participates in the stored immutable receipt hash.
Versioned receipts never use historical fallback, even when their original
schema had no ordinary sqlite-like names. A later such object must be detected.
Unversioned receipts are accepted only as replay of an existing exact adoption;
they cannot create a new registration. Changed ordinary schema and replacement receipts still
fail. New backup and inventory queries always enumerate ordinary sqlite-like
objects using the literal internal prefix.

A historical no-op explicitly returns `receiptFingerprintMode: legacy-like-replay`,
the historical receipt fingerprint, a notice about its omitted coverage, and
the separate complete current `schemaFingerprintSha256`. It does not certify
the omitted objects, their past state or an old backup. An operator needing
current complete evidence must take a new observed inventory/backup and verify
its restore, preserving the old adoption record as history. New current evidence
is not a replacement for that immutable record.

The permanent regression fixture reconstructs the parent-shaped ledger binding
in a disposable database and tests both modules. Independent verification must
also recheck actual-parent-created records, preserved by the R1 reviewer. No
production database, provider or production executor is used by these tests.

This is separate from the provisional Notes/Signal schema-tool successor, whose
new proof receipts intentionally refuse unaccepted original registrations.
