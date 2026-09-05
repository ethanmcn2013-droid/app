# Archived object context repair

The independent recipient review reproduced an archived B task displayed in an
ambient A runtime, followed by an archive destination that read A. This is a
project-context defect; the evidence does not establish unauthorized access.
The original red review remains in the task's
`outputs/recipient-candidate-independent-review`. The additional pre-patch run
is retained under ignored `experience/output/recipient-project-work/archive-before-fix.log`.

`TaskRouteDecision` now retains the proven project for archived results in both
the real and demo branches. The archived page mounts its runtime with that
object-owned project and builds fixed contextual Tasks/archive links. The archive
destination authorizes its explicit project before reading the list and passes
the same project to the runtime. Missing/forbidden objects stay neutral.

Flag-off layouts remain ambient. A B/A mismatch therefore offers a selection
POST before B content is rendered or an archive list is read. The existing
action supports fixed `archive` and `task-focus` destinations and reauthorizes
the project. Object recovery also re-reads the exact task under that project
before writing either preference, so a moved/deleted task or stale form cannot
select a project on its behalf. Archived projects cannot become the active
selection. GET does not write either cookie.

Focused commands (parent owns package/default-CI registration):

```sh
node --test experience/recipient-project-work/archive.test.cjs experience/recipient-project-work/server.test.cjs
node --import tsx --import ./src/test/register-server-only.mjs --test src/app/app/task/task-deep-link-contract.test.ts
node --test src/server/projects/route-authz-contract.test.mjs src/server/projects/active-project-contract.test.mjs src/server/tenant-scope-rules.test.mjs src/server/tenant-scope.test.mjs
corepack pnpm typecheck
```

The first command has five new archive scenarios and four retained recipient
scenarios. These use real SQLite and actual pages/actions; the demo archived
detail is a labelled input-seam test. Runtime-page mounts are executed, but the
old server fixture treats the shell body as a leaf. The separate four-surface
route-browser fixture will exercise the actual runtime components and data.
Final exact-source capture remains pending source freeze and independent review.

Material surfaces are Tasks, My work, task focus and archive:
`tasks.page.app-tasks`, `tasks.page.app-my-tasks`,
`tasks.page.app-task-by-id`, `tasks.page.app-archived`.
Package, registry, CI, Timeline and entitlement-scope readers are not changed.
