# SQLite schema enumeration correction

Candidate d8a3af6b672e4345074bfefba1bd4163dce5156d, parent4c88733fab3e0a89fff189a021e919f8c5ec492d. Independent review pending; not yet integrated.

Observed on disposable local SQLite: `NOT LIKE 'sqlite_%'` treats `_` as a wildcard. It omits ordinary `sqlitex_*` tables, indexes, triggers and views. A logical backup and restore verifier can agree on the resulting incomplete manifest. Tasks/Timeline status can classify a database containing only such a table as fresh; their fingerprints can omit those schema objects. No real database was examined, so incidence in existing customer databases/backups is unknown.

The candidate uses literal-prefix GLOB matching. The production executor now reads the same tested schema helper rather than duplicating the query; it was syntax/static checked only and was never executed. The backup body shape is unchanged. No SQL migration, journal, historical review/adoption/execution receipt or database record was edited. Existing fingerprints remain unchanged for schemas without affected ordinary object names; affected schemas need fresh observed inventory and correctly bound receipts, never a rewrite of old evidence.

Verification: seven new tests fail on the parent and pass on the candidate. The full scoped run passes34 backup/regression/integrity cases and66 existing migration cases; migration contract, scoped lint and executor syntax all pass. Source-independent expectations assert the restored ordinary table's row, view, index and enforcing trigger. The DDL verifier also rejects a deliberately missing trigger. The new test is mandatory in `db:contract` (registration added after identical runtime checks).

`gates.json` records exact commands, environment-stripped child processes, times and exits. `baseline.log` preserves all seven original failures. `source.json` binds the seven changed files to exact Git blobs, normalising away checkout line-ending differences. `candidate.log` is the initial seven-case pass; broader checks are separate logs. The verification runner itself is included for repeatability.

These are local tool correctness results, not production restore, provider, maintained-service, full release or human acceptance. Earlier backup artifacts are not retroactively certified. The distinct Notes/Signal MIG-01 correction is separately authored and reviewed. Held Drive/RC3/Atlas acceptance is untouched.
