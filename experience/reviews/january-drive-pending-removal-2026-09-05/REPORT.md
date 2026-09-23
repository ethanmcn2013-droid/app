# Named-permission removal: durable status and rendered UI

Implemented at **1ac3d2335b68a02594f4e8c68793a962090f9579**, branch **fix/january-drive-pending-removal**, exact base **3be4ea9623acda261e47fe330e40e223d9a1671d**. Worktree: C:/Users/ethan/signal-studio-workspace/worktrees/app/fix-january-drive-pending-removal. This closes the scoped named-permission DTO/UI omission in local evidence. **Token-disconnect persistence remains separate and open.** No migration, provider/worker writer or permission policy changed.

## Behavior

The actual status reader now projects canonical revoke_pending rows using an exact workspace + storage-generation join. A single grouped query returns counts for the current folder and previous folders; it does not return permission IDs, emails or identities. Non-pending, foreign-project, mismatched-generation and orphan rows cannot create this notice. Historical and removed-member receipts remain visible generically, without being attributed to a current person.

The receipt read happens after the live-access attempt, including its failure path. A pending removal therefore remains visible when the provider read is unavailable, and intent saved during that failed read is included. Existing Can edit/Can view/Access not confirmed labels and timestamp logic are unchanged. Durable intent is not presented as proof of actual Google access or completed removal. A confirmed canonical receipt removal clears this notice on the next read.

The current-folder copy says “Removal of some access to this board’s current Drive folder is still unconfirmed.” Previous-folder copy says “Removal of some access to this board’s previous Drive folders is still unconfirmed.” Both add “People may still be able to open those files.” No retry timing, automated repair or identity claim is invented. Check again remains the existing read action.

## Authored files and integration boundary

Runtime/test commit1ac3d233 changes:

- src/lib/project-drive-ui.ts: required pendingRemovals shape, separate from live access and personal OAuth connection.
- src/server/connections/project-drive-ui-status.ts: exact-project/generation grouped receipt projection.
- src/components/app/settings/sections/connections-view.tsx: named status notice with current/previous wording.
- src/components/app/settings/sections/connections-review.tsx: explicit zero fixture default.
- src/server/connections/project-drive-ui-status.test.ts:16SQL scenarios and a capability/error control.
- src/lib/project-drive-follow-up.test.tsx: existing test fixture adopts the DTO field.
- experience/project-drive-pending-removal/scenarios.ts: shared synthetic SQLite fixture consumed by tests and rendered data generation.

Evidence follow-up adds experience/project-drive-pending-removal/{client.jsx,fixture.mjs,capture.mjs}, this owning review directory, and a zero-default compatibility update in experience/project-drive-ui-acceptance/client.jsx. That last file keeps the retained runnable harness compatible in this new branch; original27af source and frozen captures are unchanged. No principal checkout, STATUS, registry, programme, CHANGELOG, package, CI, schema or migration edits. Principal owns those integrations.

## Verification

| Gate | Exact result and scope |
|---|---|
| Immutable3be counterexample | Node22 gates.mjs unit-baseline: same new tests with actual3be reader/view,10pass/16expected failures, exit1. The16failures assert the added DTO contract; original12-case behavioral counterexamples also remain intact. |
| Fixed SQLite/SSR + retained components | Node22 gates.mjs unit-fixed:26/26, exit0.20status tests including16new scenarios;6retained follow-up tests. |
| Typecheck | Node22 gates.mjs typecheck: strict7authored roots plus actual transitive imports,0diagnostics, exit0. Not a full App gate. |
| Lint | Node22 gates.mjs lint:7authored roots,0errors/0warnings, exit0. Node22 fixture-lint.mjs:5fixture files,0errors/0warnings, exit0. React autodetection runtime notice retained. |
| Source detector | Impeccable detect.mjs --json on changed view:[], exit0. No panel score or certification. |
| Actual SQLite DTO generation | fixture.mjs data <own> <scratch> data-final:16scenarios using the same actual reader and fixtures, exit0. states.json source and SHA bind directly to the browser server. |
| Rendered/remounted component | capture.mjs <scratch> capture-final4499:46/46,52screenshots, exit0.42static cases each check initial mount plus actual page reload;4interaction cases include keyboard refresh transitions and member/flag-off management suppression. Browser errors0, external requests0. |

Scenario coverage: no pending receipt; current; previous; both (two current, one historical); unavailable current/both; stale email; removed member; other project; non-pending; deliberately corrupt wrong-generation/orphan negatives under FKoff; historical-only with no current folder; new intent during failed live read; removal cleared during live read; folder retired during read. Other fixtures enable FK after existing migration seed and check integrity/FKs. Actual SQLite→DTO→fresh SSR tests never inject the expected pending count. Browser consumes those generated DTOs, not invented status summaries.

Rendering covers all16states at390/1440 light; current/previous/unavailable-both at390/1440 dark; both+historical-only at768; both+unavailable-both at1920. Keyboard Check again steps current→unavailable both→cleared→current at390/1440. Member/flag-off cases dispatch zero management reads. No measured horizontal overflow. Manual inspection includes current390light, unavailable-both390dark and historical-only768light. This is a bounded state matrix, not every state at every viewport or a human accessibility approval.

## Source, styles and explicit adapters

Runtime stayed frozen at1ac3d233 throughout final rendering. DTO generation runs actual core SQLite fixtures, actual status/setup readers and service capability assertions. Connection summary and live-permission returns are deterministic synthetic ports; default store and identity entry points throw. This does not execute the real Clerk/action minter or a Google provider call. The unchanged production action still reauthorizes before and after the status read.

Browser runs actual ConnectionsSection/LiveConnections/ConnectionsView and its existing handover child. The status action receives saved exact SQLite DTOs, handover reports unavailable, and connect/enable/disconnect actions throw if invoked. Demo is false; the UI flag is explicit; a labelled synthetic frame replaces the full Settings shell. No Next/Clerk/server-keyless path or rejected workflow was retried.

Styles are the23byte-verified CSS/WOFF2 files from completed **NORMAL** build **wnk1OREKC5EKuma6I3VoO**, Node22/Next16.2.11, original source8172364e. This patch uses existing classes. This was asset reuse, not a new normal build at1ac; no font mock, provider font request, dependency install or borrowed node_modules junction. Existing dependencies were read only. The sole local fixture used verified free port4499, PID32048, and was stopped after capture.

The first fixture server attempt failed before listening while the manifest writer treated esbuild’s virtual process.env definition as a filesystem file. The correction excludes virtual inputs from file hashing while retaining the definitions in fixture source and recording action adapters. Original failing script, bundle and receipt remain. This was a harness error, not an automatic approval/policy rejection. No runtime edit followed the passing capture.

## Retained finding and remaining work

prior-readback/ contains an unchanged copy of the complete original12-case report, results, receipts, source-index and verified70-entry reproducer/SQLite/source ZIP. Both findings stay distinct. The original UI624-entry archive and prior27af worktree were not rewritten; checksums of both prior output packets pass. The new archive carries baseline/fixed sources, test logs, generated DTOs, render bundles/screenshots, adapters and failed receipts.

The token-disconnect gap still requires durable intent/completion evidence before truthful reload projection. No token schema is authored.0031 remains reserved for Event; any0032 allocation/dependency comes from principal after that acceptance. Real Google revoke/reauth/handover/upload lifecycle, remote-client contention, full Next/Clerk/receiving gates, human accessibility/comprehension/council and release remain outside this evidence. Upstream3be Linux passes do not automatically certify1ac. Jan21 launch/outreach remains held; no production/outbound action occurred.
