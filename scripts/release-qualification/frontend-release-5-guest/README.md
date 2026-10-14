# Disposable guest action qualification

This branch qualifies the unchanged runtime at b805c5501f8198218791491ae0a2f26efbae0657. It does not deploy, migrate an existing database, or change product behavior.

Expected source hashes were extracted from that immutable commit before qualification. The builder verifies those hashes, the Git tree, absence of runtime changes and every real bundled runtime input. It refuses a changed pin manifest. Only the actor boundary, local database singleton, server-only marker, Next cache invalidation and operational-log sink are fixtures. Project authorization, capabilities, deletion fence, guest SQL, transactions and account lifecycle functions remain real source.

The runner inherits no provider credentials and preloads a network blocker. It uses serial disposable SQLite files with foreign keys off to prove explicit data scoping and cleanup. Each file is closed in the child and deleted with hash/absence receipts after the child exits. Assertions alone do not pass receiving: the native process must exit zero, all assertions must pass, no network attempt may occur and every database file must be absent.

The synthetic actor fixture does not qualify Clerk tokens, browser authentication, provider effects, production data or complete HTTP account-deletion flows. CSV checks qualify bytes and escaping, not spreadsheet-app execution. A601-row import is intentionally capped at600 by the existing parser; adding a601st stored guest is refused.

The manual workflow also has a push bootstrap limited to this exact qualification branch. It has read-only repository permissions, no secret inputs and no existing mandatory workflow changes. The safe artifact contains assertions, source pins, process and database-cleanup receipts; no database files or before/after row snapshots are uploaded.
