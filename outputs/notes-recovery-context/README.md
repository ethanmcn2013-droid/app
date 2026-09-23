# Notes recovery and authorized navigation — bounded P1 repair

Worktree: `C:/Users/ethan/signal-studio-workspace/worktrees/app/fix-january-notes-recovery-context`.
Branch: `fix/january-notes-recovery-context`. Base: `9105c81a3f8472961f08008e525e69670f6ebd9f`.
Sole writer; delegated bounded repair. No push, merge, package/lock/workflow/registry changes, live database, Google, email or production write. Home, Drive, billing, invite and PR166/motion work are outside this change.

## Behavior

- Detail edits write the existing session-recovery record on every input, before blur or browser history can replace the editor. The record binds the account namespace, note ID, filing Project and saved version. Back/Forward and reload recover exact words. A late save reply preserves newer typing and rebases its version; a lost reply reconciles through the existing compare-and-swap action.
- Composer drafts are additionally Project-scoped. Pending captures retain their original ID and Project across reload or an account/Project frame change. The server compares the expected account scope with the authenticated actor before create/update. New actor-bound captures require the original Project authorization and cannot silently fall back to Unfiled. Legacy callers retain their existing action behavior. The account hash is a namespace/fence, not an authorization credential; owner and membership checks remain server-owned.
- Old unbound composer drafts remain copyable by the original account under “Earlier device copy,” without automatic filing. Private note editing remains owner-authorized even after Project membership removal, per ADR 0001. New filing/handoff is withheld on refused or archived Projects.
- The Notes page resolves the exact raw Project hint through the existing server resolver, including with the routing flag off. Bare V3 entry redirects to its canonical Project while preserving note/view. Server-authorized B is published to the shared navigation state. Local view anchors and history retain B. V3 navigation uses the canonical URL helper, preserving local parameters (including Your Work's local filter) and stripping V2 global vocabulary.
- A route/epoch-matched refusal withdraws stale verified chrome; stale refusals cannot erase a newer route. No Project name or capability is manufactured from URL, catalog cache or membership guesses.

## Reproduction and observed checks

`baseline-back/receipt.json` records the immutable `ca95830e` source restoring **Original B** over **Exact private words — café / Second line** after browser Back/Forward. `baseline-navigation/receipt.json` records its product links emitting **project-a** under authorized displayed **project-b**. Both commands exit 1 as expected. That archive has the same relevant runtime as base 9105; the only `src/` difference between those revisions is an unrelated Drive test.

`receipt.json` records the modified components passing **14** browser cases. The main recovery and navigation stories run at **1440×900 and 390×900**. Other cases cover account/Project isolation, late save reply with newer typing (including reverting to the original text while a save is pending), lost edit reply then reload, blocked storage with live Back/Forward recovery, flag-off navigation, pending capture across account change with the same ID, legacy copy at both widths, and rejection of a prehydration claim from another account/Project. Keyboard Enter exercises the actual Notes view anchors. Screenshots include restored writing, refused new filing and the legacy copy. The copy-open layout checks list/search separation and horizontal overflow. Browser console/page errors: zero.

`baseline-save-race/receipt.json` is an observed failure of the intermediate repair, before its final pending-save guard: reverting to Original B while Earlier pending edit was saving reloaded the latter. The final run covers and passes that exact regression; this intermediate failure is not attributed to the immutable core archive.

`server-receipt.json`: **8** cases execute the actual Notes create/update actions and schema using a new **in-memory libSQL database**, with explicit auth, Tasks-authorization and instrumentation adapters. Cases cover exact bytes/filing, lost create response after membership removal, denied/unavailable new filing, changed destination replay, private owner editing after membership removal, lost edit response, and stale actor rejection. Exactly one original-actor/project row remains.

`page-receipt.json`: **8** cases execute the actual server page with isolated auth/read/resolver boundaries and stubbed client children. Authorized B beats catalog A with either flag value; refusal retains private notes and clears authority; repeated/malformed hints remain raw for refusal; archived filing is disabled; bare redirect retains note/view; no Projects allows personal Unfiled capture. This checks page wiring, not the resolver's database implementation.

Also passed: **101** recovery, Notes model/hybrid, Project URL/snapshot/unsaved-work/machine tests; **84** nearby Notes extract, suite context/navigation and Project authorization contracts; module-boundary and suite-switcher checks; full TypeScript check. Focused lint: zero errors, one inherited `Date.now()` purity warning in the server Notes page. No suppression added.

## Re-run / lead test registration

Use Node 24 and the repository's frozen dependencies. On this machine Node is `C:/Users/ethan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node.exe`.
From the worktree root:

```sh
node --import tsx --test src/modules/notes/lib/notes-recovery.test.ts
node experience/notes-recovery-context/server-check.mjs
node experience/notes-recovery-context/page-check.mjs
node experience/notes-recovery-context/check.mjs
```

The new recovery unit file and three standalone runners need registration by the lead. The additional `src/lib/projects/route-snapshot.test.ts` case is already included in the existing default test list. Dependencies resolve through the existing pinned tsx/esbuild and Playwright packages; no package additions are needed. The runners write generated bundles only under `work/notes-recovery-context` and receipts here. Their server binds a fresh `127.0.0.1` port, serves `/app/notes?workspaceId=project-b`, then closes with its isolated Chromium contexts. Receipt URLs retain the exact ephemeral port. No persistent preview is left running; lead's 4350/4396 listeners were not used or stopped.

The browser runner accepts `NOTES_TEST_SOURCE_ROOT` for a source archive, `NOTES_TEST_OUTPUT` for a separate receipt directory and `ONLY_NOTES_CASE` (`back-forward-reload` or `authorized-navigation`) for baseline reproduction. Resolve dependencies from the new worktree; do not use an environment copied from a live checkout. Run source variants sequentially because they share the local generated bundle path.

The browser receipt includes SHA-256 values of the actual imported source, with CRLF normalized to LF, plus the real token CSS hash. Its revision is the base plus the recorded dirty runtime files at capture time; the accompanying source-provenance manifest binds the final repair and runner files. Evidence is not a source input. Baseline receipts are retained as observed failures, not refreshed into success.

## Material surfaces and limits

Lead registry coordination: `tasks.page.app-notes` (`/app/notes`) changes materially, including local navigation, private edit recovery, pending capture and refused new filing. Shared `useSuiteContext` consumers also change behavior: suite pills, mobile navigation, sidebar, both command palettes, account utility links and task metadata's Timeline link. The two actual navigation components in this fixture are the suite pills and mobile navigation; the remaining consumers require integrated browser review. No registry completeness flags were changed, and no untouched states were marked observed.

These are actual React components and their CSS module with the installed design tokens and App token extensions. The surrounding header/frame, Next navigation transport, authentication and action responses are explicit synthetic adapters. Fonts use Arial; full App shell/Tailwind, Next SSR/hydration, live Clerk switching, real membership I/O, full production build/performance and the complete registry breakpoint/state matrix are **not attested**. The server tests separately execute actual actions; browser action adapters are not a claim of live backend traversal. No human usability, council or design-gate approval is claimed.

Recovery uses existing **sessionStorage**: blocked storage can preserve live Back/Forward memory and warn, but cannot guarantee reload or closed-tab recovery. Account namespaces prevent UI/replay adoption across accounts; device storage itself remains the existing local, unencrypted mechanism. Recovery of a remotely deleted note, an externally changed filing binding, or browser session data erased by the user is not implemented as an orphan-draft browser in this slice. A refused Project produces neutral chrome and bare product links; another destination's bare-entry resolver still owns its selection. A pending capture whose Project is unavailable stays held locally rather than being retried into another Project. Integrated review should verify these boundaries and register the focused checks before release.
