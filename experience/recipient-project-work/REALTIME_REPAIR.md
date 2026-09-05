# RC-3: keep peer refreshes in the displayed Tasks Project

This follow-up starts at `24417b35f68cb5ff0d83568776858e622a720eca` on `fix/january-recipient-project-work`. It preserves the archive, room and route-snapshot fixes. RC-3 is a same-membership content-context defect: a peer notification could hydrate authorized ambient A tasks into an already authorized B runtime. No access outside the actor's memberships was demonstrated.

`getTasksAction` now requires a candidate Project and freshly authorizes it through the existing readable-Project boundary. Both production callers pass the displayed Project: the realtime hook and the custom-column reconciliation read. The runtime supplies the verified actor/Project tuple and keys the provider by that tuple. The client actor prop controls lifecycle only; it supplies no server authorization.

The hook discards old responses and clears queued work on identity change, unmount or permanent stream closure. Custom-column reconciliation checks its provider lifetime before its read and before hydration. Existing in-flight/cooldown coalescing, optimistic updates, roles and neutral refusals remain. Demo execution opens no stream or server action. The event endpoint, payload and deployment flag are unchanged.

## Focused regression command (principal registration required)

```sh
node --test experience/recipient-project-work/realtime.test.cjs
```

12 passing cases use disposable SQLite and actual action, membership/query, custom-column writer, hook, reducer and runtime source. The React hook host controls effect cleanup and timers; request identity/cookies and EventSource are explicit test adapters. Cases cover:

- B displayed with A preferred; both project-context flag states; absent/malformed, foreign, removed and wrong-account candidates; existing archive/role policy; no cookie mutation.
- Actual peer callback through scoped action into the reducer; in-flight and cooldown coalescing retain the latest committed update.
- Delayed responses, queued events, project/account replacement, unmount and permanent stream closure; transient connection errors remain supported.
- Actual disabled/enabled event endpoint and emitter behavior without expanding the event protocol.
- Demo no-auth/no-stream/no-action behavior and in-memory custom-column optimism.
- Actual custom-column B write and B reread; delayed write/reread suppression after provider disposal.
- Actual runtime provider props and distinct actor/Project keys.

The immutable red control uses the old action/hook/provider blobs without changing a checkout. All three selected cases fail against the old implementation (expected exit 1):

```sh
RECIPIENT_REALTIME_BASELINE=24417b35 node --test --test-name-pattern 'RC-3:|scoped action|custom-column actual' experience/recipient-project-work/realtime.test.cjs
```

PowerShell equivalent: set `$env:RECIPIENT_REALTIME_BASELINE='24417b35'`, run the same `node` command, then remove that environment variable before the green run.

## Real React confirmation

```sh
node experience/recipient-project-work/realtime-react.mjs
```

Three passing checks mount the actual provider/hook/reducer in React DOM, with provider keys/props derived from the actual route fixture. They prove that delayed peer responses, pending old optimistic reconciliation and custom-column completion do not populate a replacement provider. Action delivery and EventSource are controlled; SQLite authorization/writer proof is supplied by the separate 12-case suite. This command uses the pinned Playwright dependency and its installed Chromium. Output and source hashes go to ignored `experience/output/recipient-project-work/realtime-react/receipt.json`. It takes no screenshots and does not adopt experience captures.

## Other checks run

```sh
node --test experience/recipient-project-work/archive.test.cjs experience/recipient-project-work/room.test.cjs experience/recipient-project-work/server.test.cjs
node --test src/server/tasks-security-regression.test.mjs src/server/actions/project-authz-contract.test.mjs src/server/projects/route-authz-contract.test.mjs src/server/tenant-scope.test.mjs src/server/tenant-scope-rules.test.mjs
node scripts/check-module-boundaries.mjs
node scripts/check-ambient-workspace-ratchet.mjs
corepack pnpm typecheck
corepack pnpm exec eslint src/server/actions/tasks.ts src/lib/tasks/tasks-context.tsx src/lib/tasks/use-realtime-sync.ts src/components/app/tasks-runtime-shell.tsx src/server/tasks-security-regression.test.mjs experience/recipient-project-work/realtime-fixture.cjs experience/recipient-project-work/realtime.test.cjs experience/recipient-project-work/realtime-react.mjs
git diff --check
```

The preserved recipient cases pass 15/15; declared authorization/tenant/security cases pass 74/74. Typecheck, focused lint, module boundaries and ambient-workspace ratchet pass. The existing demo-order source contract now asserts the actual explicit authorization helper instead of requiring the retired ambient lookup in this action.

## Limits and integration ownership

No full Next/Clerk session, deployed realtime service, final experience capture or human comprehension is claimed. The unverified pathname/epoch scenario is outside this change; snapshot-state implementation is untouched. This is not a rewrite of other mutation APIs or role policies. Principal owns package/default-gate registration, browser viewport/capture adoption and final composition. No package, workflow, registry, `route-browser.mjs` or `ROUTE_FIXTURE.md` changes are included. Fresh independent review is still required.
