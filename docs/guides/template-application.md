# Template application persistence

The application remains additive. `applyTemplateAction` appends a template to an
existing Project; `remixTemplateAction` creates a new owned Project. A new request
may intentionally apply the same template again. Template identity, matching task
titles, task counts, and `workspaces.templateId` are not request identities.

At base `c00835e6`, a disposable-database reproduction failed the third task
insert: two tasks remained. Retrying produced 20 tasks; repeating produced 38.
Activities were separate best-effort writes. Remix could also leave a Project
and membership committed before its seed finished.

## Persistence contract

`src/server/db/apply-template.ts` uses one immediate transaction for authorization,
deletion fences, lane-position allocation, task/sequence inserts, initial
activities and the completion receipt. Remix includes Project creation and owner
membership in that transaction. Task, activity or receipt failure rolls back the
entire operation. Lock contention alone gets a bounded retry.

Receipts use the existing `meta` table under
`board:{workspaceId}:template-application:{sha256}`. The key binds Project, actor
and request ID; the stored fingerprint binds template and explicit-anchor intent.
Task IDs derive from that application and seed index. No schema or generated
template content changed.

A completed receipt makes replay a no-op after fresh capability and deletion
checks. It never reconstructs a deleted seed or overwrites an edited/archived
task. Reusing the ID with different template/anchor inputs fails. A fresh ID
appends a new copy. Omitting an anchor reads the Project date in the transaction;
explicit null keeps tasks undated. Replay retains the completed seed even if the
Project date subsequently changes.

The receipt is separate from task rows, so clearing/deleting those rows does not
make an old request apply again. Existing Project/account deletion removes the
Project's board metadata. Receipts therefore last for the Project's lifetime;
this is not a permanent request journal across Project erasure. In particular,
an old remix request after complete Project deletion can create its deterministic
Project again while the account still exists. Pending Project deletion and the
durable account-erasure fence are enforced; this change does not add a permanent
remix-deletion tombstone.

## Caller recovery (January candidate)

The direct apply/remix actions retain explicit request identity:

```ts
await applyTemplateAction(templateId, { workspaceId, requestId });
await remixTemplateAction(templateId, requestId);
```

`completeOnboardingAction`, `skipOnboardingAction` and `updateSegmentAction` now
also require an explicit Project and request ID. A retry preserves the complete
submission; a successful Settings change releases it so an intentional new
reseed receives a fresh ID. Template starters append; legacy domain packs retain
their existing replacement behavior. Settings copy distinguishes these outcomes.

`src/server/onboarding-completion.ts` calls the shared
`applyTemplateInTransaction` export. Template tasks, activities, seed receipt,
Project completion metadata and caller receipt share one immediate transaction.
A task, metadata or receipt failure rolls all of them back. A lost cache/event/
response acknowledgement retries the completed receipt without another seed or
metadata overwrite. Changed inputs under the same request are refused.

Completion changes shared Project settings: `primaryUseCase`, `secondaryContext`,
`activeDomain`, `templateId` and `onboardingCompletedAt`. It therefore requires
canonical `manageProject`, consistently with `updateWorkspaceAction`. The
canonical owner/co-owner capability is re-proved inside the transaction and
again immediately before metadata, with archive, account-erasure and Project
deletion fences. Ordinary task-editing members cannot complete or alter
Project setup. The shared template helper retains `createOrEditTasks`; applying
a template without changing these shared settings remains available to members.
Opening a previously seeded template also uses this managed completion path:
it preserves the existing choices and task graph, sets only the completion
timestamp and any missing domain sentinel, and never calls the older
task-edit-authorized sentinel action from the welcome caller.

Welcome treats an explicit `workspaceId` URL as an untrusted candidate, proves
canonical access, and never substitutes the active cookie when that candidate
is missing, malformed or unavailable. Without a URL candidate it uses the
existing fail-closed accessor. Returning members may open a completed Project;
first-run changes require `manageProject`. Both the form and every success or
contextual-onboarding destination preserve the authorized Project. Render never
writes the active-Project cookie. `/welcome?workspaceId=A` with cookie B is tested
both for the first-run form in A and the completed non-venue redirect into A.

Manual welcome submissions survive response failures and same-tab reload through
an actor/Project-scoped session-storage intent. Navigation follows confirmed
success only. Venue auto-seeding uses a server-derived first-run identity bound
to actor and canonical Project, so render retries cannot add another seed. This
is not a template-wide once-only key. Comp fulfilment is separately owned by the
lead and uses the shared transaction helper in the candidate base.

Settings retains its pending intent while the component is mounted. A whole-tab
reload does not restore a Settings intent; the durable server receipt remains
available for investigation. This slice does not claim general recovery across
browser/device changes or Project erasure. No failure automatically navigates,
changes a browser-history entry or mints a replacement request.

### Legacy domain-reset recovery packet

Non-template packs still call the existing destructive `seedDomainAction`.
Before that call, the caller records `domain-started`. An ambiguous failure
refuses another invocation with the same request and shows **Check project** or
**Setup details for recovery**, never a generic reset-retry button. That fence is
intentional: this task does not add atomic request receipts to the legacy reset
or infer success from `activeDomain`, task counts or matching titles.

Preserve the exact packet before closing the form: version, Project ID, request
ID, selected use case, context and seed/reseed mode. Welcome also includes actor
ID. The server record includes the authenticated actor for both callers:

```text
key = board:{workspaceId}:onboarding-submission:{sha256(JSON.stringify([actorUserId, requestId]))}
value = { requestId, actorUserId, submission: { workspaceId, primaryUseCase,
          secondaryContext, seedMode }, fingerprint, state: "domain-started" }
```

An authorized operator can inspect the **exact key** with a read-only query:

```sql
SELECT key, value, updated_at FROM meta WHERE key = :receipt_key;
```

Record that row verbatim with the code revision, failure time, current Project
metadata, exact task/resource graph and existing native-byte-cleanup receipts.
Confirm the actor/Project/input fingerprint and fresh `manageProject` authority;
then investigate whether the domain replacement committed, rolled back, or
committed while acknowledgement/cleanup failed. `domain-started` alone proves
none of those outcomes. Do not delete the fence, mint a new request or run a
second reset as a repair shortcut. A follow-up must either prove and atomically
complete this exact operation's metadata/receipt under current authority, or
reconcile the graph/cleanup failure first. No general repair action is exposed
by this commit; domain recovery remains an explicit operator follow-up.

## Verification

```sh
node --import tsx --import ./src/test/register-server-only.mjs --test src/server/db/apply-template.test.ts src/lib/template-anchor.test.ts src/lib/wedding-template-contract.test.ts
node --test src/server/tasks-security-regression.test.mjs src/server/actions/project-authz-contract.test.mjs src/server/projects/active-project-contract.test.mjs
pnpm typecheck
pnpm exec eslint src/server/db/apply-template.ts src/server/actions/templates.ts src/server/db/apply-template.test.ts src/server/tasks-security-regression.test.mjs
```

The new behavioral tests are also included in `pnpm test`'s existing server-only
test group, using portable Node/libSQL fixtures. They exercise real independent
connections, partial failures at three stages, response loss, action-side-effect
failure, replay after user edits/deletion, distinct concurrent intents, current
membership, archive/deletion fences, exact anchors and seeded counts. The action
harness substitutes request/framework boundaries; its writer and authorization
queries use the real disposable database.

Caller verification adds these focused tests (register in the combined gate):

```sh
node --import tsx --import ./src/test/register-server-only.mjs --test src/server/onboarding-completion.test.ts src/server/onboarding-callers.test.tsx src/lib/onboarding/retained-submission.test.ts
```

The actual caller components were also rendered in a local synthetic fixture
with server actions, routing, toast/dialog and analytics boundaries substituted.
Welcome failure/retry was checked at mobile, tablet, desktop and wide sizes;
Settings recovery was checked separately. See `evidence/template-caller-recovery/`
for ordinary Git screenshots and the [source/evidence manifest](evidence/template-caller-recovery/manifest.json).
The final compiled existing-template confirmation is recorded before submission,
after a synthetic lost response, and after retry in the linked
[capture receipt](evidence/template-caller-recovery/README.md). This is component-browser
evidence, not an authenticated Next/Clerk flow, live provider acceptance,
independent security acceptance or a completed quality-council gate.

The lead owns the separate follow-up for user-wide venue-welcome detection and
contextual redirect scope. Those paths are not accepted by this component fixture;
their helpers and planning code are unchanged in this caller commit.

No provider or production verification is claimed.
