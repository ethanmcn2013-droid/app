# Reproduce the workspace templates

App's canonical workspace templates come from Studio's `src/lib/templates/`.
Studio removed that directory in `a2d70fa59f954c75ee2fd257a90f2ed3a343c394`
when it removed the template marketing routes. The consumer and sync command
survived. The generator now reads the existing canonical source from its last
revision, `ed02bc831894eb93b36f69f5b820a4727a9e2bb3`, in Studio's local Git
history. It does not restore files, fetch, switch branches or write to Studio.

The source pin is `CANONICAL_SOURCE_REF` in `scripts/sync-templates.ts`. It is
provenance, not another authored template source. Updating template content
requires a reviewed canonical Studio revision and a corresponding pin change.
Never use the generated outputs as a replacement authoring source.

## Commands

Run from the App clone or an App task worktree:

```sh
pnpm sync:templates --check
pnpm sync:templates
pnpm sync:templates --check
```

The first command reads and compares both outputs, exiting nonzero if either
is missing or stale. It never repairs them. The second writes only changed
artifacts. The final check should report two templates and zero changed
artifacts. Repeating sync preserves unchanged bytes and modification times;
CRLF checkouts compare equal to the generated LF text.

The generator finds Studio beside the owning App clone using Git's common
directory, so nested task worktrees resolve the same source. For another local
Studio checkout, use:

```sh
pnpm sync:templates --check --studio-root /absolute/path/to/studio
```

The checkout must have the Signal Studio origin and the pinned commit locally.
A missing clone or history is an error, not permission to infer source from an
artifact. Obtain the required history through the separately authorised repo
workflow before rerunning. App builds consume committed outputs and do not
require a Studio clone.

## Outputs and count truth

| Record | Source / consumer | Count |
|---|---|---|
| Canonical workspace templates | Pinned Studio registry | 2: wedding planning and monthly business rhythm |
| Wedding task seeds | Studio wedding `tasks.ts` → `src/lib/templates.generated.ts` | 18, including 2 already in the done lane |
| Wedding Tasks milestones | Existing `src/lib/wedding-template-timeline.ts` bridge → `getTemplate` → `applyTemplateToWorkspace` | 6 of those 18 tasks; no additional tasks |
| Wedding Timeline seed | Studio wedding `roadmap.ts` → `src/modules/timeline/lib/templates.generated.ts` | 1 project and 8 separate legacy seed items |

The six task milestones and the eight Timeline seed items are different
records and different consumer paths. Do not describe the wedding task
template as eight tasks or infer six canonical roadmap items. The existing
bridge assigns offsets of -270, -42, -21, -14, -7 and +14 days to six task
titles; the other twelve stay undated. The legacy seed's offsets remain -300,
-150, -45, -30, -25, -6, -4 and -2. This repair changes no counts, task copy,
statuses, dates, schema, or application behavior.

The regenerated diff adds only the canonical revision banner to each output.
All existing template data remains byte-equivalent after newline normalization.
No Notes or Signal seed generation was added.

## Checks and limits

```sh
node --import tsx --test src/lib/wedding-template-contract.test.ts src/lib/template-anchor.test.ts src/modules/timeline/lib/template-anchor.test.ts
pnpm typecheck
```

These tests are already included in `pnpm test`; no package script change is
needed. They cover generation repeatability, read-only stale checks on each
artifact, connected project references, unique template identities, immutable
source loading after source removal, clone/worktree discovery, and the existing
six-point bridge. Synthetic Git fixtures require no provider or database.

Generation idempotency does not change template application semantics:
`applyTemplateToWorkspace` deliberately appends tasks when invoked again.
This repair does not claim retry-safe provisioning, user comprehension, or a
verified live customer journey. Studio owns corrections to its older count
claims and the canonical source's future authoring location.
