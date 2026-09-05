# Sponsored wedding date: scoped milestone

Product source: **2d1d77835e7bcedfab5c68e53608fe5d00dd8f9a**, parent implementation **bd67c02dab62f55a953a628c8e2a9505863af719**, base **0b9d132ac5b5f47579c8630becb94063b1db947d**. Branch: `feat/january-sponsored-wedding-date`. Owned App worktree: `C:/Users/ethan/signal-studio-workspace/worktrees/app/feat-january-sponsored-wedding-date`. This report seals the scoped UI milestone before the separately requested legacy caller retirement.

The shipped slice is a **linked redemption-arrival flow**, not an inline redemption form. Sponsored arrival links to the exact project's canonical date form; a persistent Tasks strip remains after welcome dismissal. Managers get add/update actions. Read-only members get “View wedding date” and a read-only form. Missing dates explicitly retain a 548-day minimum from redemption. The previous generic overview target is labelled separately, displayed without editing, and never backfilled into `workspaces.primary_date`.

The new writer reads the stored Project, freshly proves `manageProject` in its writer transaction, checks archive/account/project deletion fences and the expected Project revision, then commits the canonical date and eligible project-bound venue-comp term extensions together. It skips epoch-zero revocations, future grants and departed/deleting recipients. It does not write purchases, account-wide grants, other projects, shared mirrors, template tasks or comp capacity. The overview read and existing controls now receive its explicit authorized URL Project; a payload mismatch guard remains.

D-022 at Studio **c1dd6221634a7f6cb0559da8fcff49c6dd475023** requires `max(redemption + 548 days, wedding date + 90 days)`, preserving longer minted terms and existing later expiry, with no upper cap. Its unconditional recomputation rule has no “before expiry” cutoff: the new writer can extend a naturally elapsed positive term into the future; an insufficient new date leaves it elapsed. Epoch zero stays revoked. No new policy, price, migration or alternate date field was introduced. Independent Event/personal purchases remain unchanged.

## Validation

| Gate | Receipt | Result |
|---|---|---|
| Pinned local dependency install | dependency-install | Exit 0; pnpm 11.9.0 frozen/offline, 752 reused, zero downloads, no borrowed junction |
| Focused implementation/arithmetic/claim/action/form suite | focused-4 | Exit 0; 75 tests; includes actual effective-tier readback and 792 differential Studio arithmetic cases |
| Corrected Tasks strip and hydrated welcome plus form | role-copy-1 | Exit 0; 9 tests, including four role/date combinations executing actual entry source |
| Final typecheck | typecheck-final | Exit 0; includes final role prop and entry tests |
| Scoped runtime lint and role follow-up lint | lint-1, lint-role-final | Exit 0 |
| First-contact copy check | language-1 | Exit 0; 353 scanned, seven existing baseline occurrences unchanged |
| Final actual-component browser proof | rendered/receipt.json | Exit 0; 32 state/viewport checks, 1440×1080 and 390×844, zero captured console/page errors, bad responses, external attempts or document horizontal overflow |
| Keyboard proof | rendered/keyboard.json | Exit 0; date-to-save Tab, save by Enter, read-only entry by Enter |

Counts are not additive: the nine-test role/form run repeats five form tests from the 75-test run. Source hashes, exact commands and exit codes accompany this report.

Database cases cover legitimate claim then capture; earlier/later/missing/identical dates; leap-day and malformed input; elapsed versus revoked grants; wrong/missing Project; manager, ordinary editor, removed/demoted manager, archive and wrong domain; actor/owner/project erasure fences; stale concurrent writers; independent purchases/gifts/projects; departed/future/unlimited grants; actual current entitlement reads; transactional failure at date and entitlement writes, unchanged completed grant/tasks/metadata, and successful retry. Tests use real disposable SQLite schemas, with the existing fixture's FK-off default; no claim of remote-provider or every schema-version coverage.

## What the rendered proof establishes

The final fixture executes the actual `TasksPage`, `VenueWelcomeCard`, `ProjectOverview` and `WeddingDateForm`, and runs the actual date action body plus real scoped database transaction. Identity is explicitly fixed to the synthetic fixture user; navigation/arrival resolution and board body are fixtures. Overview's unrelated progress/member data is synthetic. Exact boundaries are recorded in `component-fixture-boundaries.final.json`; this is not a full Next/Clerk journey.

The browser exercises later/earlier/clear saves, durable reload, an injected entitlement-write failure retaining the old date/revision/access and the input draft, fault removal and successful retry. It renders expired and revoked copy, saves a revoked project's date without restoring its grant, verifies ordinary-project target compatibility, dismisses the actual welcome card and follows the persistent Tasks link. Both actual entry surfaces say “View wedding date” for a non-manager, then lead to the read-only form. Browser terms intentionally advance across the sequential synthetic desktop/mobile runs; a cleared date retains the longer already granted term.

CSS was compiled from bd67's actual App sources using local cached Geist/Geist Mono via `NEXT_FONT_GOOGLE_MOCKED_RESPONSES` and an owning loopback font server. The 2d1 follow-up changes text/role selection only; styles are unchanged. The final fixture applies the actual generated font classes and records loaded Geist. CSS/font files and hashes are retained under assets. This does **not** verify a normal Google font/network build. Initial component captures before font-variable adoption remain in scratch; final rendered/ is the renewed packet.

## Retained failures and limits

- `focused-1`: exit 1, two failures. A synthetic deletion key violated its real CHECK constraint; corrected. The concurrent loser then hit native libSQL's “SQL statements in progress” on retry; `concurrency-2` preserves the repeat.
- A bare `@libsql/client` control without App imports reproduces the poisoned local connection after busy BEGIN. The first rollback-journal control's recovery also failed (exit 1). The WAL control reproduces the defect and recovers after isolated reconnect (exit 0). The concurrency test explicitly reconnects that isolated loser before testing stale refusal. **Remote-client transaction contention and recovery are untested.** No runtime/dependency workaround is claimed.
- `typecheck-2`: exit 2, fixture incorrectly used public “pro” as a stored tier. Corrected to existing `workspace`; later typechecks pass.
- `seed-1`: Node24 printed completion and wrote fixture identity, then exited -1073741819. Retained. Fresh Node22 seed succeeds. A subsequent seed was corrected to use a redemption instant already in the past; future-start grants were truthfully excluded by the first readback. Final seed-4 exits 0.
- `render-1`: exit 1. Ordinary Next development activated Clerk keyless mode and emitted a claim link. Playwright's explicit localhost-only route handler aborted attempted external Clerk script loads; **this was not an automatic approval/policy rejection**. The own Next/font processes were stopped and no Clerk request/claim was retried. The dev attempt cannot be described as provider-free; server-side keyless provisioning/disposition was not independently verified. A generated ignored `.clerk` artifact remains in the owned worktree; it is not included in this packet. Packaged logs redact the claim token; raw failure evidence stays in task scratch. Full Next/Clerk validation remains failed/incomplete. Component rendering does not resolve it.
- No full Next production build, receiving-candidate matrix, deployed identity/provider transaction, council/human review or production flag verification is claimed. Principal owns registration and final receiving/council limits.

## Legacy system boundary, deliberately outside this milestone

The new scoped writer's revocation and membership guarantees do **not** cover `extendCoupleAccessForWeddingDate` in `src/server/db/couple-access-term.ts`. That inherited helper matches actor-wide wedding comp rows, including other/null Project bindings, lacks epoch-zero and departed-project guards, and can extend those rows. It is not used by the new existing-project date writer.

Actual remaining callers in `src/server/actions/planning.ts`:
- `bulkCreateWorkspacesAction` → `applyWeddingDateToCoupleAccess` after its creation transaction when the period is `wedding_season`. The gate is `planningPeriods`, independently of contextual onboarding. The call is not conditional on a nonempty created result, so an all-skipped submission can still reach it.
- `completeContextualOnboardingAction` → the same helper after committing new Project creation, gated by `contextualOnboarding`, for `wedding_season`.

Both gates default off only when NODE_ENV is production and on otherwise; explicit environment overrides exist. **Deployed values/exposure are unknown.** UI call sites remain in Your Work bulk creation and ContextualOnboarding; /app/your-work and /welcome/plan check their respective flags. /welcome can redirect bare contextual wedding arrivals into the latter. Helper failures are caught/reported after the creation commit, so that old flow has no shared date/extension transaction. These are source-backed reachable paths under enabled flags, not a claimed production trigger. Principal subsequently supplied an isolated helper reproduction and requested retirement as a separate follow-up; it is not represented as fixed by 2d1.

## Exact proposed Studio updates (principal-owned; not authored)

- `docs/execution/january-2027/PROGRAMME.md`, S2 row: replace the undifferentiated date-capture gap with “App 2d1 implements linked sponsored arrival and project-scoped date edits; 75 focused tests plus four entry combinations and 32 component state/viewport checks. Full Next/Clerk, legacy creation-caller disposition and receiving integration remain separate.” Keep Event post-term/provider/launch holds.
- `content/atlas/pricing-and-entitlements.md`, lines 50–52 and the limitations paragraph: “Sponsored arrival now links to the project's wedding date. Unknown dates retain the 548-day minimum; later edits extend eligible project-bound sponsored access without shortening existing access. The old generic project target is separate. Scoped local component/transaction verification is complete; full receiving and legacy creation-path closure remain separately tracked.”
- `docs/architecture/ADR-008-venue-edition-lifecycle.md` §9: point the canonical field to `workspaces.primary_date` and actual `src/server/actions/sponsored-wedding-date.ts` / `src/server/db/sponsored-wedding-date.ts`; remove the obsolete nonexistent helper/projection claim. Do not claim a shared-store date write, venue date visibility or task retiming.
- ACCEPTANCE/registry: adopt the scoped source/state receipt only. Do not substitute it for full Next/Clerk, provider, final matrices, council, Atlas or RC-3 evidence.

No pricing, policy, schema, package, CI, principal, Studio, customer or production edits. Existing Timeline/RC-3/Atlas and earlier programme receipts remain unchanged. External launch/outreach remains held for January 21.

