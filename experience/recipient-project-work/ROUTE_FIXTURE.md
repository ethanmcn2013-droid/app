# Recipient route fixture handoff

Runtime candidates, in order: `2c8f5e3af0ff608172380ac322fba1ed3b22ee72`
(archive project retention/arrival), `dac54d9e78454646e3bed03a979443373e4ca25c`
(explicit room read/purpose action), and
`c463aa28737e2245d530e78ba8b5c55c3cb19af3` (object data project versus URL
snapshot key). The fixture is a separate change. Final integration, package/CI
registration, registry adoption and frozen-source capture belong to the principal.

## Commands

Run from the receiving App worktree with its pinned dependencies installed:

```sh
# Actual SQLite regressions; now run before the persisted story in
# the default test:recipient-golden gate.
node --test experience/recipient-project-work/archive.test.cjs experience/recipient-project-work/room.test.cjs

# Prepare real server trees, actual client bundle and styles. No browser run.
node experience/recipient-project-work/route-browser.mjs --prepare

# One-width renderability check, 17 checks at 1280 x 900.
node experience/recipient-project-work/route-browser.mjs

# ONLY after principal freezes the composition: 17 states at each owning
# browser-contract viewport: 390x844, 768x1024, 1280x900 and 1440x960.
# This command has NOT run in this handoff.
node experience/recipient-project-work/route-browser.mjs --capture

# Optional local inspection; bind only 127.0.0.1, choose an unused port.
node experience/recipient-project-work/route-browser.mjs --serve
```

`RECIPIENT_ROUTE_OUTPUT` selects an output directory; default is ignored
`experience/output/recipient-project-work/routes`. Choose a new output directory
for each candidate so earlier evidence survives. Fixture databases are newly
created under ignored `experience/output/recipient-project-work/stores`; they are
never an existing configured App database. No .env files are read or copied.

Formal capture requires locally cached Next Geist font assets in `.next/static`.
The fixture records binary hashes and the current root font configuration; it
does not build Next or fetch fonts. A preparation/smoke run can use a labelled
fallback, but `--capture` refuses absent assets. The recorded desktop smoke used
the local cached fonts. The author's five `floor.module.css` keyframe warnings
remain in the original smoke receipt. Principal preparation then confirmed that
the `.root` prefixes inside five keyframe definitions were invalid selectors.
Removing those prefixes preserved their keyframe values, timings and reduced-
motion rules; the actual route bundle and CSS now prepare with zero warnings.
This preparation does not establish final rendered or motion acceptance.

## Material surfaces and states

| Existing material ID | Actual entry |
| --- | --- |
| `tasks.page.app-tasks` | `/app/tasks?workspaceId=project-b` |
| `tasks.page.app-my-tasks` | `/app/my-tasks?workspaceId=project-b` |
| `tasks.page.app-task-by-id` | `/app/task/archive-b`; active `/app/task/undated-b` |
| `tasks.page.app-archived` | `/app/archived?workspaceId=project-b` |

Each surface checks explicit B with A preferred, V3-off honest selection before
B rendering, the actual selection POST and a direct reload. It asserts the
actual DomainProvider, TasksProvider (four live B rows), RoomBriefProvider and
ProductWorkspaceShell props, plus visible project context. Tasks uses its actual
Floor chrome and stored board name; the other three use the actual Studio Bar
project control. The cross-project sidebar catalog remains cross-project.

Five further checks cover archived object B with a conflicting A query through
Open archive/Back/reload; active object canonical redirect and actual task-detail
read actions; an unassigned personal view with exact B destination; membership
removal; and a neutral foreign-object refusal. My work includes undated, later
and soon assignments and excludes the unassigned task. The existing SQLite and
component tests retain malformed inputs, demo, archived-project policy, truly
empty member/owner behavior and other negatives; the 17-state browser matrix
does not claim every possible role, data or interaction state.

## What executes and what is adapted

`route-fixture.cjs` evaluates actual page functions, App layout, flag-selected
runtime mount, TasksRuntimeShell, production auth/provisioning and project/task/
room/catalog queries. Only input records are seeded in disposable SQLite:
accounts, memberships, projects, their room/board metadata and task rows.
No successful route decision, room brief, capability or UI output is seeded.

The fixture transports server elements as an explicitly labelled RSC-shaped JSON
tree, then mounts actual imported client components, providers, project control,
sidebar, Floor, My work, archived list, task detail and recovery form. The
separate `route-client.jsx` adapter supplies Next URL/history hooks and action
transport. The same actual server action executes selection; detail and
personality reads also execute their actual actions. Other imported actions
refuse invocation. No production auth bypass or fixture route is added.

The boundaries are synthetic Clerk request identity/account widget, Next
headers/cookies/cache/navigation/dynamic behavior, local RSC/action serialization,
access-mode/flag inputs and disabled realtime (204). Immediate local SQLite
transactions are scheduled serially to execute real provisioning without blocking
the JS thread on sibling native transactions. This is not a concurrency test.
Provider/network access is blocked; server code receives a fixed fixture-only
environment, with no shared entitlement/provider configuration. Runtime event
emission uses the existing fixture's no-op; no SSE reconciliation claim is made.

The browser adapter reevaluates the layout on navigation. It does not reproduce
Next Flight streaming, persistent-layout scheduling, proxy/middleware, actual
Clerk sessions, multi-account in-flight requests, full provider behavior or human
comprehension. Designated-account full Next verification remains UNVERIFIED.
The previous 132 built-browser and six component cases do not establish those
missing full-route properties either.

Receipts record overall status, every executed check, production source hashes,
fixture hashes, Tailwind dependency hashes, cached font hashes and limitations.
The principal's receiving fixture derives named viewports from
`experience/browser-contract.json`, records its source hash, and records both
width and height per case. The earlier author smoke remains at 1280x900.
Each checked state saves its actual DOM, route DTO and screenshot. Source hashes
are normalized for CRLF. Smoke artifacts are preparation evidence, not final
experience-registry adoption. The principal added the eleven archive/room SQLite
cases to the existing mandatory recipient gate. Workflow and registry adoption
remain separate work.
