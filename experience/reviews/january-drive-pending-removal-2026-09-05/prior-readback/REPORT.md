# Pending revocation after reload: validated local read-model gap

Two distinct cases are confirmed against **27af50c09ea20892e00170b2fa4e7acebbcc9061** (runtime8ae94, backend unchanged from6eb/8172). This is a separate read-only investigation after the UI packet was sealed. No repair or migration has been authored. Worktree: C:/Users/ethan/signal-studio-workspace/worktrees/app/fix-january-drive-ui-acceptance; branch fix/january-drive-ui-acceptance. STATUS and registry remain principal-owned and untouched.

## Finding and limits

| Case | Actual durable service result | Fresh DTO / current view | Conclusion |
|---|---|---|---|
| Own token disconnect, provider500/network failure/no key | Current credential becomes revoked + is_current=0; affected storage needs_reauth; provider failure/no key leaves last_error_at; action says revocationConfirmed=false | connected=false, needsReconnect=false, email=null, setup=needs_attention, access=unavailable; new view has no pending message | Missing persistent UI state; local connection retirement is honest, but provider revocation remains unconfirmed and is no longer visible |
| Own token disconnect, provider200 or bounded400 invalid_token | Same local retirement; action says revocationConfirmed=true; no explicit completion receipt written | Exactly same status DTO as failure | UI cannot distinguish success from pending using this DTO |
| Disconnect committed, provider response still pending | Same revocation-relevant connection/storage/journal snapshot as completed200; last_error_at=null; journal empty | Same disconnected/unavailable DTO | Null error is not proof of success. Crash/lost-response phase needs durable intent before provider I/O |
| Second disconnect after failed first attempt | No current credential; returns disconnected=false, revocationConfirmed=true; zero additional adapter calls | A reachable stale/action retry could display success from this result | This result is a local no-op, not proof that the earlier Google revocation succeeded. UI normally hides Disconnect after reload; no claim that an ordinary fresh click can perform it |
| Named-user permission DELETE500 | Actual grant row keeps revoke_pending=1; live provider adapter still returns writer | Connected=true, timestamped Can edit is truthful; no pending-removal notice | Missing operation-state projection alongside honest live access, not a false Can edit result |
| Same exact permission retry204/404 | Actual service deletes exact retained receipt; idempotent404 succeeds | New live list has no permission, member becomes Access not confirmed | Existing repair/retry semantics work; no need to rebuild permission integration |

This is not merely missing test coverage: recorded SQL rows and fresh service instances reproduce the omission. It is not a deployed exploit or proof of real Google state. No provider was contacted. The first four columns are local service results with deterministic provider-response adapters. No unauthorized read/write was demonstrated.

## Reproducer and evidence

Run with Node22 v22.23.2: node work/drive-pending-revocation-2026-09-05/run.mjs <fresh-label>. The wrapper compiles actual source from27af, then executes the exact generated command recorded in sqlite/receipt.json. It refuses source drift and overwriting. **12/12 controls, exit0**. Initial harness compilation failed because top-level await was emitted as CJS; that receipt/source is retained under original. An async wrapper corrected the harness; no product change.

Existing freshProjectDriveCoreDb, seedProjectDriveCore, seedStorageGenerations and coreAuthorization fixtures are used. Each case gets a real file-backed SQLite database; seed uses the existing FK-off migration helper, then FK is enabled and checked before the probe. Foreign-key checks pass for all11database cases; token scenarios also check integrity. Databases are retained, clients closed. The12th control compares independent scenario snapshots/DTOs.

Actual code executed: createGoogleDriveConnectionService.disconnect/summary; revokeGoogleToken; createProjectDriveAccessService and actual credential lineage resolution; createDriveGrantService.revoke/listLive with default real SQLite mutation lease; readProjectDriveUiStatus and its actual setup reader; React SSR of the actual8ae ConnectionsView with message=null, modelling a fresh render. Token scenarios use eight outcomes; permission scenarios cover500→204 and500→404; task-editor denial checks disconnect/status/permission revoke with zero adapter calls. Other actor connection/storage stay unchanged; other-project DTO does not expose the target member.

Explicit adapters: synthetic fetch responses for revoke/token-refresh/permission-list/delete only; unexpected global fetch throws; default global DB throws, every service receives its disposable DB; server-only marker is empty; Clerk identity/minter entry points throw and are never invoked; existing core fixture supplies authority while actual lower capability assertion executes; demo=false. This does **not** execute full Next, Clerk, action-wrapper authorization, remote libSQL, browser reload/navigation, worker scheduling or live lifecycle. Current fresh DTO → SSR proof is sufficient for the missing field/message; it does not replace the separately sealed76+14 browser checks.

## Owning source chain

All files have immutable Git blobs and SHA256 readbacks in the archive and receipt.json.

| Responsibility | Source at27af (runtime8ae) |
|---|---|
| Authorize action and return raw service outcome | src/server/actions/connections.ts:110–130; source traced, wrapper not executed |
| Local retirement and affected project state in immediate transaction | src/server/connections/drive-connections.ts:621–719 |
| No-current no-op; missing key; provider call/outcome; failure timestamp | same file:721–750 |
| Caller’s current credential only, no retired receipt projection | same file:258–273 and575–618 |
| Status action reauthorizes before/after read | src/server/actions/project-drive-status.ts:7–26; source traced |
| Live snapshot and projected DTO | src/server/connections/project-drive-ui-status.ts:41–84; ownConnection at81 |
| Transient message state and action-success wording | src/components/app/settings/sections/connections.tsx:24,73–74,78 |
| Fresh view derives no connected account/Connect; only supplied message renders | src/components/app/settings/sections/connections-view.tsx:68–73,82 |
| Token adapter treats only successful response or400 invalid_token as completion | src/server/connections/google-drive.ts:276–309 |
| Exact permission DELETE and durable failure receipt | src/server/connections/drive-grants.ts:797–892 |
| Live permission response is independent of pending receipt | same file:897–996 |
| Existing pending-permission repair queue | src/server/connections/project-drive-grant-repair.ts:265–336 (source traced, worker not executed) |
| Existing journal operation kinds | src/server/connections/project-drive-operation-journal.ts:110–136; schema.ts:1129–1231; drizzle/0029_project_drive_operations.sql:55–59 |
| Credential retirement on ordinary same-account consent rotation too | drive-connections.ts:479–489,546–565; DECISIONS D15 |

The journal declares folder provision, grant create, folder rename, project delete and storage handover. There is **no token-revocation operation kind**. It is project-scoped, while own credential disconnect affects all the actor’s projects using that Google-account lineage. A succeeded grant-create receipt is not a pending-delete intent. No journal operation was created in any token-disconnect probe. This rules out a truthful token-revocation fix that merely reads the existing journal.

## Smallest repair recommendation, before widening

1. **Named-user pending removal needs no migration.** Add a narrow, sanitized pending-removal indicator/count to the existing Project Drive status DTO from canonical drive_folder_grants.revoke_pending receipts joined by exact workspace/generation. Keep current live Can edit/Can view labels and timestamp unchanged. A small notice should say that a requested removal is still unconfirmed and access may remain. Count historical-folder removals separately or use wording that explicitly includes previously shared files; do not attribute an old-generation pending row to a current member or current folder. Keep the current unavailable result honest when provider read fails; a failed provider read must not erase durable pending intent. This is receipt-derived; no invented journal-only token state.

2. **Own token disconnect requires a durable intent/completion receipt before the DTO can be correct.** Recommend the narrowest persistence change on the existing immutable provider_connections generation, for example nullable revocation_requested_at and revocation_confirmed_at with ordering constraints, rather than a new worker/backend framework. Write intent in the same retirement transaction; write confirmation only after actual successful revoke or the existing invalid_token idempotent result. Missing key, transport/provider failure and lost response stay unconfirmed. The caller’s own summary must read unresolved historical requests as well as the current credential. A repeated no-current action must consult that receipt and cannot claim the previous revocation confirmed merely because nothing is current.

The proposed fields are a minimal durable revocation receipt, **not an existing operation-journal reuse**. If canonical architecture requires every such receipt in project_drive_operations, extending its operation kind/account scope, dedupe and lifecycle would be a larger change and should be reviewed separately. Do not insert a fake folder/handover operation or overload last_error_at/status. Generic last_error_at is also used for token refresh, and normal same-account rotation marks old credentials revoked without requesting Google revocation. Old rows cannot be safely backfilled as confirmed or requested; retain explicit historical unknown where necessary.

ProjectConnections can show the personal unconfirmed revocation notice alongside its current connection and separate live project-access section. Check again is a read, not a retry guarantee. Do not add automatic retry of retired same-account tokens: D15 records grant-level revocation can invalidate a newer consent. A retry/reconnect race needs exact credential-generation/account-lineage fencing if later implemented. This investigation recommends persistence + truthful readback; no new retry automation, permission or lifecycle redesign.

**Migration dependency:** the token receipt proposal requires a new allocation.0031 is reserved for Event. Principal must allocate the next free migration before implementation; this task has not selected a number or authored schema/SQL. The permission DTO/UI projection is independently possible without a migration, but does not close token-disconnect pending visibility.

## Required dependency and negative tests for the repair

| Layer | Minimum meaningful controls |
|---|---|
| Persistent token receipt | Intent/retirement commit together; rollback writes neither.200 and400 invalid_token confirm exact request;500/network/decrypt failure/crash before reply remain pending; confirmation-write failure stays pending; duplicate no-current action never invents success |
| Identity and supersession | Task editor/removed manager/wrong project refused at actual action minter; actor cannot read another actor’s pending credential; no drift across credential generations or different Google accounts; same-account reconsent is never automatically revoked by an old retry; old success reply updates only its own receipt |
| Historical/data contract | Nullable additions preserve old rows as unknown, not fabricated success; FK/ordering/schema contract; no credential/cipher/raw error in DTO/export/log; account erasure/custody integration reviewed for added metadata |
| Permission receipt projection | Pending+live writer both visible; pending survives unavailable provider; clear only after exact receipt completion; current vs historical generation and other-project negatives; changed email/removed member gets generic warning without false identity attribution; journal-create success alone does not mean pending deletion |
| DTO/action/render | Actual service → DTO → remounted component pending; mounted Check again retains it; success clears only matching completed receipt; role downgrade and flag-off still hide management; current connected state can coexist with unresolved prior-account operation; no stale action message overrides fresh completed/pending state |

Existing32/35/81/332 or independent8ae counts are not asserted as proving this repair. No new full backend test cycle is requested by the investigation. These are proposed proportional gates to execute only with a concrete repair.

## Delivery boundary

The sealed UI runtime8ae94 and evidence27af50 remain unchanged and have already been composed by principal. This new report, reproducible harness, immutable sources, SQL snapshots and SSR outputs are separate. No commit beyond27af, no STATUS/registry edit, no migration, production/personal Drive, provider call, Clerk/keyless flow, Atlas/RC3 retry, credentials, outbound or release action occurred. FullDrive closure is not claimed. Jan21 launch/outreach remains held.
