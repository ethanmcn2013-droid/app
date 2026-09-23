# Notes 8963 follow-up — N1, N2, N3 and concurrent-create binding

Branch: `fix/january-notes-recovery-context`, continuing `8963e9197df1d3511758101b7f4f9e85ee43452a` without rebase. Five runtime files changed. No package, lockfile, workflow, experience registry, schema, account deletion, Home, S2 or S5 changes. No provider, live account, production database, publication, push or merge.

## Repairs and evidence

- **N1:** `use-notebook.ts` sends retry/fallback persistence through the same actor-wide queue merge as initial capture. At 1440 and 390, the actual composer fails B, retains a different next draft, fails and retries A, then reloads B. B's exact original ID, text and destination remain. Retrying restored B uses that same ID and leaves A queued. There is still no destination substitution.
- **N2:** `tasks-personalization.ts` consumes loose projects alongside grouped periods. Valid owner/member rows remain; archive and role filtering stay in place. Single-period compatibility avoids duplicate rows and retains period metadata. The real signed catalog client, actual internal GET, route resolver and Notes action execute against both real SQLite schemas. With A grouped, loose owner B and a member's project whose period belongs to someone else both capture into their exact project. The private period is not exposed. Removed membership, archived projects, foreign projects, changed actor and unavailable catalog still refuse new capture.
- **N3:** `SuiteContextPublisher` retains its current publication in this browser document, including explicit null. A later `useSuiteContext` subscriber prefers it over persisted hints. Publisher cleanup invalidates its own publication without clearing a newer publisher. With V3 off and on at both widths, actual StudioRail and MobileSuiteNav carry authorized B despite readable cached A and throwing `setItem`/`removeItem`. A later mobile mount after another actor's refusal stays unbound. Unmount also clears the old live context.
- **Defensive concurrent-create check:** the losing INSERT reconciliation now compares body and exact project for actor-bound recovery, matching the initial replay check. A barrier after both initial absent-row reads reproduces the original `[A,B] -> [A,A]` result. Now exactly one succeeds in its requested project and the other rejects; same-project concurrent retries still return one identical owned note. Legacy callers retain their existing Unfiled replay behavior.

## Executed validation

- **153 focused unit/contract tests passed**, zero failed/skipped, including three catalog parser regressions in the already registered `tasks-personalization.test.ts`.
- **18 actual-source server checks passed:** [receipt](final-server/receipt.json), [log](final-server.log).
- **13 new browser scenarios passed:** [receipt](final-browser/receipt.json), [log](final-browser.log). Desktop 1440×900 and mobile 390×900. Zero recorded browser console/page errors.
- **All 14 original Notes browser scenarios passed:** [receipt](original-browser/receipt.json). Back/forward/reload, actor/project isolation, response loss, late replies, changed text, storage failure, legacy copy and prehydration binding remain covered.
- Typecheck (`tsc --noEmit --incremental false`), focused ESLint (zero warnings/errors), module boundaries and `git diff --check` passed. [Typecheck](typecheck.log), [lint](lint.log), [unit/contract tests](focused-tests.log).

Baseline evidence is retained without relabeling failures: [browser](baseline-browser/receipt.json) has five expected invariant failures (N1 twice, V3-off N3 twice, unmount once); [server](baseline-server/receipt.json) has four expected failures (different-project race and three mixed-catalog cases). Baseline runtime source hashes match 8963. Initial passing `browser/` and `server/` receipts are retained as intermediate runs; the final directories above are authoritative. The final browser runner improves only fixture shell placement so the recovered row is visible; the baseline assertions are unchanged.

The final receipts identify the precommit HEAD plus dirty state and CRLF-normalized SHA-256 of executed runtime source. They bind actual source, not refreshed dates. The server receipt includes the exact internal route, parser, authorization, schema and action sources. No receipt claims complete integrated App or human acceptance.

## Reproduction and lead registration

Run from this worktree with pinned dependencies and Node 24. Browser installation must already provide Playwright Chromium. Each runner uses an ephemeral loopback port, blocks external browser requests and closes its own browser/server. The server runner uses in-memory SQLite, a synthetic service assertion key and a fetch adapter accepting only the local internal catalog endpoint. It never opens a configured provider or production database. No `.env` is copied or loaded by these runners.

```powershell
$node = 'C:/Users/ethan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node.exe'
& $node experience/notes-recovery-context/followup-server.mjs
& $node experience/notes-recovery-context/followup-browser.mjs
$env:NOTES_TEST_OUTPUT = 'outputs/notes-recovery-followup/original-browser'
& $node experience/notes-recovery-context/check.mjs
Remove-Item Env:NOTES_TEST_OUTPUT
& $node --import tsx --test src/modules/notes/lib/notes-recovery.test.ts src/modules/notes/lib/notes-view-model.test.ts src/modules/notes/lib/notes-hybrid.test.ts src/modules/notes/server/tasks-personalization.test.ts src/lib/projects/project-url.test.ts src/lib/projects/route-snapshot.test.ts src/lib/projects/unsaved-work.test.ts src/lib/projects/active-project-machine.test.ts src/lib/product-urls.test.ts src/server/suite-context-contract.test.mjs src/server/suite-navigation-contract.test.mjs src/server/planning-catalog-contract.test.mjs
```

The two new `followup-*.mjs` commands need lead registration if they are to run in CI; package/workflow wiring was deliberately left untouched. The existing catalog test file is already registered. Material surfaces remain Notes capture/recovery plus shared product navigation (including cold mobile consumers). No registry gate or council score is changed.

## Boundaries

The browser bundle renders actual Notes components, StudioRail, MobileSuiteNav, publisher/provider, Notes CSS modules and real DS tokens. Next routing, frame/actor props, server replies and the rail's account utility child are explicit adapters. Fixture shell placement and fonts are scaffolding; this is not a full App shell, Next SSR/hydration, BFCache, deployed navigation, real Clerk account-switch or human usability claim. Desktop/mobile screenshots show actual component state and the receipts assert real emitted hrefs; neither certifies the full visual design gate.

Session storage recovery still cannot survive cleared/blocked storage or a closed tab. Existing edit/response-loss safeguards remain bounded by private actor/project/note identity. Remotely deleted notes and externally changed filing bindings remain outside this recovery UI. Membership can change between the last catalog read and the separate Notes INSERT; no new cross-database transaction fence is claimed. Current capture does not silently fall back to another project. No full integrated build/Linux CI rerun was performed here; the lead owns integration and independent review.
