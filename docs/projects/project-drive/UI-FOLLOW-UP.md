# Owner handover and pending-upload boundary · 2026-09-04

Bounded follow-up to `5cb93f683af596310da3388b1fd7bf5556124a6e`, in the same
`feat/january-drive-ui` worktree. Internal review only. The lead owns integration,
full build, independent browser/security review and acceptance. Nothing is pushed
or merged. No new schema, cryptography, journal/membership backend, billing,
invite, provider configuration or deployment changes.

## Owner handover implemented

Connections now has a server-checked owner choice and a confirmation stating
future-file custody, Drive space use and unchanged historical ownership/location.
Choices are not built from the client member list. The new read action requires
explicit `manageProject` authority before and after reading. A local DB transaction
checks current actor/source ownership, archive state, the target's exact active
current `drive.file` connection, pending delegated receipts and in-flight handover
operations. The response contains only display state and scoped user ID/name pairs.
Saved connection status does not assert live Google permission or guarantee that
execution can succeed; the UI says so.

The new gated mutation adapter allow-lists the choice again and calls existing
`handoverProjectGoogleDriveStorage`. That existing backend revalidates owners,
connection, pending uploads and account/journal fences at execution. The adapter
returns only the status enum, catches errors generically and reauthorizes before
returning. It does not implement provider work itself. Both new actions stop in
review and with the UI flag off before importing auth, database or provider code.

An existing pending/running/retry-wait handover offers only its recorded target.
Continuing calls the same backend path and reuses the journal operation. A target
connection/generation mismatch, ambiguous operation list or manual-attention
operation exposes no executable alternative. No manual-attention requeue, change
cancellation, provider-success fabrication or background polling is added.
Check again refreshes saved handover state and the existing live access read.

## Exact reload recovery limit

The existing APIs were read before implementation:

| API | Existing safety and limitation |
| --- | --- |
| `createDriveUploadSessionAction` / `createProjectDriveUploadSession` | Authenticates task edit authority. `assertRequestMatches` binds resource ID, Project, task, original uploader, kind/provider/storage, normalized name, MIME and size. A delegated claim stays pinned to its storage generation. `resumeDelegated` probes the exact session and can adopt completion or mint a replacement only after provider expiry plus global marker absence proof. It is not a read-only probe API. |
| `finalizeDriveUploadAction` / `finalizeProjectDriveUpload` | Requires the original uploader and task authority; verifies the provider file's marker, exact parent, MIME, size and generation. Requires a known provider file ID. |
| `PendingDelegatedDriveUploadReceipt` | Preserves encrypted capability and exact resource/storage/actor lineage. It contains no digest or other content identity to verify a newly selected local file against partially sent bytes. |
| `recoverPendingDelegatedDriveUploadForErasure` | A non-minting recovery path, but intentionally requires an account-erasure fence and can delete an absent receipt. It is not ordinary task recovery authority and is not exposed or repurposed here. |

Two files can have the same name, MIME and size but different contents. The current
server binding therefore cannot safely prove that a reselected file is the original
partially uploaded file. No byte-resume/reselect control is added. Closing this gap
requires an approved durable content-binding contract for new uploads, a safe
policy for older claims without that evidence, and/or a task-authorized non-minting
probe/adoption API. No localStorage/session capability, fabricated digest or client
assertion is substituted for that proof.

The available independent slice is implemented: the existing authorized Resources
list rediscovers saved pending claims after reload/task remount. A pending Drive
claim without its mounted original File blocks **all new file intake for that
task while the flag is enabled**, including drag/drop, retaining one Attach control.
Loading and failed list reads also block intake until the saved state is known.
The existing row stays intact with no remove control. The explanation asks the
uploader to finish in the original open tab or seek help checking that upload.
Refresh saved status calls only the existing resource-list read; its label explicitly
says it neither sends a file nor checks Google directly. It can observe completion
performed by the original tab. A mounted attempt keeps its existing same-claim retry.
Flag-off behavior retains the existing native upload path.

This is **reload discovery, protection and explanation**, not killed-browser upload
recovery acceptance. Recovery itself remains incomplete. There is no new claim,
session mint, upload, native fallback, provider deletion or receipt deletion in this
reload path.

## Review pointers

The existing credential-free review server remains on `127.0.0.1:3127`, with no
restart required. Flags/start command remain in `UI-SLICE.md`.

- `http://127.0.0.1:3127/app/settings`: Connected → choose Maeve → Review owner
  change → confirmation. Extra Review state choices: No other connected owner,
  Owner change in progress, Owner change needs attention, Upload blocks owner change.
- `http://127.0.0.1:3127/app/tasks?task=demo-t-01`: Upload review state → Pending
  after reload → Refresh saved status. The fictional record intentionally stays
  pending; this does not pretend to recover a real upload.

All fixture controls use local state with no DB/Google calls. Existing screenshots
in `ui-evidence/` predate this follow-up. No new browser/human/design acceptance is
claimed. The lead can review this coherent source slice before further polish.

## Verification

Run `pnpm test:project-drive-ui`, `pnpm typecheck`, `pnpm lint`,
`pnpm experience:validate` and `pnpm first-contact:language`.
Focused regression command:

```powershell
node --import tsx --import ./src/test/register-server-only.mjs --test src/server/connections/project-drive-storage-handover.test.ts src/server/connections/drive-uploads.test.ts src/server/project-drive-hard-rules.test.ts
```

Dedicated tests cover foreign/stale
authority, missing/invalid target connections, pending receipts, forged targets,
same-operation continuation, no retry on manual attention, a role lost before
backend execution, reload intake blocking and review/flag-off import isolation.
Service tests use disposable local SQLite and injected provider/executor fixtures.

Recorded verification for this milestone:

- Dedicated UI suite: **38/38** passed, including a retired target connection
  that cannot redirect an existing operation to a replacement credential.
- Existing handover backend + hard-rule suite: **44/44** passed.
- Existing upload backend: **41/41** passed in its standalone rerun. A combined
  earlier run reported a file-process failure after every upload assertion passed;
  it did not recur standalone. The exact Windows runner failure cause is unverified.
- Typecheck passed. Full lint: **0 errors**, 71 inherited warnings; changed files
  introduced no lint warnings. Final changed-file lint also passed.
- Experience registry validation and first-contact language check passed
  (350 files, seven unchanged baseline occurrences).
- Both review URLs returned HTTP **200** after the changes without a restart.
- No full application build, full test suite, performance gate, live Google or
  independent browser/human/security acceptance was run for this follow-up.

An initial negative test used a literal forbidden broad scope, which the repository
source ratchet correctly rejected. Its fixture now supplies an extra unexpected
scope alongside `drive.file`; the exact-scope rejection remains tested and the
hard-rule scanner is unchanged.

The other documented gaps remain: full setup/repair visibility and polling,
historical resource owner display, real Google/OAuth/large-file/failure acceptance,
formal design and human usability review, shared performance remediation and HQ
integration. Pending billing visual acceptance remains in the Settings registry;
after integration consult the lead's `docs/execution/january-2027/BILLING-REHEARSAL.md`.
