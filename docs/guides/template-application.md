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

## Caller boundary and remaining decision

The direct actions now require explicit request identity:

```ts
await applyTemplateAction(templateId, { workspaceId, requestId });
await remixTemplateAction(templateId, requestId);
```

Use a canonical Project from the initiating surface and retain one request ID
through retries of that submission. Mint a new ID for an intentional new apply
or remix. IDs are 16–128 ASCII letters/digits plus `._:-`, starting with a
letter/digit; a UUID is suitable. Authentication comes from the server. Neither
an actor supplied by a client nor an ambient Project cookie selects authority.
Post-commit cache, event, cookie or response failures can reuse the same ID.

There are **no current UI imports of either direct action** at this base.
Existing reachable helper callers still lack an explicit submission identity:

| Caller | Remaining boundary |
| --- | --- |
| `src/server/actions/onboarding.ts:completeOnboardingAction` | Called by welcome and intentionally by settings reseed. Needs a retained UI request ID and explicit Project; cannot be deduplicated globally by template. |
| `src/app/welcome/page.tsx` | Venue first-run render seeds then updates onboarding metadata separately. Needs an agreed first-run identity/atomic completion boundary. |
| `src/server/actions/comp.ts` | Redemption seeds then updates template metadata separately. Needs the owning redemption operation's identity and recovery contract. |

Those legacy helper invocations get atomic seed writes but **remain additive on
separate calls**, including an unidentifiable retry. No default “template used
once” rule was introduced. Their later metadata writes remain outside the seed
transaction. The UI currently routes away after a caught onboarding failure;
retaining submission identity and exposing retry needs a bounded caller/UI
follow-up, not an invented server heuristic. This implementation does not claim
end-to-end duplicate prevention for those callers.

The trusted helper accepts an optional `requestId` and transaction-test
dependencies. Requestless calls receive a fresh ID. Remix retains its existing
post-commit cookie behavior; route/chrome redesign is outside this slice.

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

No provider, production, browser or human-comprehension verification is claimed.
