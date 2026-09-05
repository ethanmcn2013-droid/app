# Sponsored wedding date: separate creation-path retirement

**Complete at App 7742247d7beebeb3b712977f5c3014aa426e55ca.** New Project creation stores its own canonical date and leaves every existing grant alone. Later redemption reads the target Project's date; existing Project edits retain the scoped transaction from the frozen UI milestone. The actor-wide extension and its two callers are removed. No other live consumer was found in src or scripts.

## Immutable identities and ownership

| Item | Identity |
| --- | --- |
| Worktree | C:/Users/ethan/signal-studio-workspace/worktrees/app/feat-january-sponsored-wedding-date |
| Branch | feat/january-sponsored-wedding-date |
| Original branch base | 0b9d132ac5b5f47579c8630becb94063b1db947d |
| Frozen UI product source | 2d1d77835e7bcedfab5c68e53608fe5d00dd8f9a |
| Prior UI evidence commits | a810ec317344348cf7b8a7352ce61f97f2c4933e; 3d71256d9822e9eb34e8bf1524b3099ce47bb6bd |
| Follow-up parent / independent original caller source | 3d71256d9822e9eb34e8bf1524b3099ce47bb6bd |
| Principal's supplied original helper proof | 2fdd06c404e6833dc3110fab2643084a3cd5785d |
| Separate runtime + regression commit | 7742247d7beebeb3b712977f5c3014aa426e55ca |

Only four source files changed in this follow-up:
- src/server/actions/planning.ts: removed both post-creation extension calls, their swallowed-error wrapper, and unused imports.
- src/server/db/couple-access-term.ts: removed the actor-wide writer/type; retained the canonical reader, redemption calculation, and sponsor predicate.
- src/server/db/couple-access-term.test.ts: removed obsolete unsafe-positive tests; retained the reader/redemption controls and added an absence guard.
- src/server/actions/planning-wedding-date.test.ts: actual caller and SQLite negative/regression tests.

The planning source used by the independent original probe is byte-identical in Git to principal 2fdd. The removed helper/type body is also identical; the enclosing term file differs only in introductory commentary. The readbacks and exact comparison are retained. source-identities.json records commit blobs, source SHA-256s, command provenance, and the exact tested working bytes. No author pass count is used as proof.

## Original-negative → fixed assertions

The same seven caller tests execute the complete actual planning action module, with the actual planning-period authorization queries and flag guard, against disposable file-backed SQLite. Strict module loading fails on unexpected imports. Actor identity, cookies/cache, analytics/Sentry, and legacy sponsor detection are explicit synthetic boundaries; this is not an HTTP/auth-provider test.

On original 3d712, five tests fail their older-grant preservation assertions:
1. Bulk creation.
2. Bulk creation with every proposed name already present (zero Projects created).
3. Contextual completion.
4. Contextual completion with a verified synthetic sponsor/consent input.
5. Creating a dated Project and subsequently redeeming a new code on it.

A 2029-06-01 date moves an unrelated old Project's active comp from 2028-03-05T12:00:00Z to 2029-08-30T00:00:00Z. It moves the epoch-zero revoked comp to that same future expiry and extends a null-Project comp. The actor has no membership in the old Project. These are actual original mutations, not acceptable expected behavior. The unknown-date and disabled-flag/validation controls pass on the original.

After removal, all seven pass. Existing entitlement rows remain identical, including Project/user bindings, active and revoked terms, null-Project comp, independent Event purchase, and personal Workspace purchase. Old Project dates remain identical. Both creation paths still persist the new Project's primary_date and label and create its actor membership. All-skipped creates zero Projects. No swallowed helper error substitutes for success.

Actual claimCompEntitlement then binds a new code to the newly created Project and writes:
- wedding date 2029-06-01 → 2029-08-30T00:00:00Z;
- missing date, redemption 2026-09-04T12:00:00Z → 2028-03-05T12:00:00Z (548 days).

Contextual wedding completion still requires its date, while bulk creation can retain an unknown date. No new capture policy was introduced. The original sponsor consent/metadata path remains; it does not transfer or rebind older entitlements.

## Commands and gates

All test commands use Node22:
C:/Users/ethan/AppData/Local/Programs/nodejs-v22/node-v22.23.2-win-x64/node.exe

Exact argument arrays, working directories, source hashes, environment boundaries, timestamps and exits are in the named receipts. run.cjs is retained for bounded reproduction using a new receipt label; existing labels refuse overwrite.

| Receipt | Result |
| --- | --- |
| original-callers-1 | exit 1; 7 tests, 5 intended invariant failures, 2 controls pass; immutable 3d712 action/helper source |
| patched-callers-1 | exit 0; same 7 tests pass |
| focused-1 | exit 0; 95 tests pass, 0 skipped; includes the seven caller tests |
| typecheck-1 | exit 0; tsc --noEmit --incremental false |
| lint-1 | exit 0; eslint on the four authored source/test files |
| runtime-commit.receipt.json | diff check, exact source/gate readback, explicit-file stage and commit; all exit 0 |
| source-audit.commands.json | source/consumer/identity readbacks; exit 1 from rg means the expected zero live obsolete references |

The 95-test run covers preserved redemption/reader tests, the new callers, existing scoped date DB/action tests, planning authorization contracts and flags, and pure term arithmetic. It includes 792 paired App/Studio arithmetic cases; these are cases within the test run, not 792 extra test counts. The earlier 7-test pass is repeated within the 95 and is not additive.

The Studio term module readback is recorded at 6e74ed9e0e7818fc81bac1cc361a87a97386e05a. It is unchanged from the task's Studio c1dd baseline. Its hash is pinned in source-identities.json. No Studio source was written.

Heavy checks ran sequentially. No install, build, broad programme suite, browser server or provider request was needed for this follow-up. Native fixture temporary directories are below this task's work directory; the gate runner inherits only OS/runtime environment keys, supplies a memory URL for incidental global DB imports, and denies non-loopback HTTP/fetch. The recorded follow-up test network-attempt counts are zero. Small read-only path mistakes are retained separately in inspection-failures.json; they were not runtime/test failures.

The commit used a per-command empty hooks directory to avoid out-of-lane Studio drift-sidecar writes; shared Git configuration was not changed. The four pre-existing untracked LFS hooks remain untouched.
The first evidence staging diff check exited 2 on whitespace emitted by the original failed TAP assertions and preserved unified diff context lines. Those raw receipts remain byte-identical; evidence-commit.failed-receipt.json preserves that failed check. Authored source checks passed, and the final evidence check covers the Markdown/JSON/text readbacks without rewriting raw logs or patches. No lint rule was weakened.
Repository evidence stores run.cjs, source-audit.cjs and the supplied principal-original-probe.cjs as byte-identical .cjs.txt readbacks so historical tooling is not linted as live application JavaScript. Executable copies remain in this separate chat output. For replay, copy the desired script to isolated scratch; do not run it inside sealed evidence. This is artifact packaging, with no lint exclusions or rule changes.

## Frozen UI and remaining limits

All 189 files in the original outputs/sponsored-wedding-date-2026-09-05 packet still match its sealed SHA256SUMS.txt. Its reports, before/source readbacks, failed receipts and actual Tasks entry/welcome/form captures remain unchanged. The only src changes since 2d1 are the four files above. No UI was changed or rerendered for this retirement; the incoming independent form-prop review has no finding asserted by this packet.

The frozen UI evidence proves ordinary actual React components with local authorized task fixtures, including manager/read-only entry and welcome actions. It is explicitly separate from full Next/Clerk. In the earlier ordinary Next attempt, “browser-blocked Clerk” meant the fixture's explicit localhost-only Playwright route denied external Clerk JavaScript, **not an automatic approval/policy rejection**. Next also emitted keyless configuration/claim material, so that older attempt cannot be represented as provider-free; server-side provisioning/disposition remains unverified. Its packaged logs redact the claim token; the ignored .clerk material was not copied. No blocked request was retried and the component evidence does not close that failure.

Other bounded limits:
- The new caller fixtures use the existing freshFileDb helper with foreign keys OFF. This follow-up does not claim a new FK-on creation proof, full Next action dispatch, Clerk identity proof, or deployed reachability.
- planningPeriods and contextualOnboarding default false when NODE_ENV=production; explicit independent overrides exist. Both enabled paths were exercised; disabled flags refused. Actual deployed flag values remain unknown. Original proof is helper/caller proof, not a claimed deployed exposure.
- Existing scoped transaction contention tests retain their explicit pinned Windows native-driver limitation and fixture reconnect. Actual remote-client transaction contention/recovery remains unknown. No runtime workaround was added here.
- Previously misbound or already altered grants are not reassigned or repaired. Historical remediation, if needed, requires object-specific evidence and principal disposition; creation no longer performs the ambiguous transfer.
- Full receiving integration, broad captures, merged gate registration, independent review disposition and council acceptance belong to principal. This report closes none of those on its own.

## Proposed principal-owned record updates

No Studio, principal, package, CI, pricing, policy or schema file was edited.
- Studio docs/execution/january-2027/PROGRAMME.md, current sponsored-date S2 item: add “App 7742247 retires actor-wide extension from bulk/contextual Project creation; new Projects retain canonical primary_date for their own redemption. Existing Project edits use the scoped writer. Original 3d712 caller invariants fail 5/7; fixed 95-test compatibility run, typecheck and scoped lint pass. Deployed flags and final receiving acceptance remain unverified.”
- App CHANGELOG.md: “Wedding Project creation now leaves older Projects' sponsored access and revocations unchanged. New code redemption reads the new Project's own date.”
- Keep the prior canonical-field/ADR corrections from the sealed UI handoff as principal proposals. Do not treat this retirement as proof of full inline redemption capture, Event post-term closure, provider state or historical grant repair.

No RC-3 or Atlas retry, code/evidence adoption, production action, new offer or policy decision occurred. External launch/outreach remains held for January 21. The owned worktree remains available for a concrete subsequent review finding.
