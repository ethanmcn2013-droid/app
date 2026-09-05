# Recipient checkpoint before visual follow-ups

Runtime: `e2e4a0c8864408938529ccb8caf2d8e831481669`.
Build: `FdBgQx-Q8pU8cshvGwDFA`, Next 16.2.11, Node 22.23.2.
This is internal demo/fixture evidence, not final design or release acceptance.

`checkpoint-e2e4a0c8.json` indexes the original files and the LFS archive
`checkpoint-e2e4a0c8.zip` (SHA-256
`a59537967591412ac0f9520625e231d5d4bd0decab81b6659b45b3d37a16fcc4`).
The archive preserves 289 files, including the raw 132-case browser result,
68 actual-route screenshots/DOM/DTOs, 27 Notes browser scenarios, command logs,
and an observed dark-mode failure image. All 286 loaded production-source inputs
in the route receipt match the immutable runtime commit after CRLF normalization.

## Observed checks

- The declared 132-case browser matrix passed in 7.8 minutes on the loopback-only
  built server at port 4452. Raw artifact SHA-256:
  `071be45d4db06bd9edacf53ce3269db9d5e5bd0df03f874e45e89e502f5ed933`.
- The actual-route fixture passed 68 states at 390×844, 768×1024, 1280×900 and
  1440×960, with cached Geist assets and zero fixture build warnings.
- The Notes fixtures passed 27 browser scenarios with their documented adapters.
- The final recipient gate passed 26 cases and the ten-checkpoint persisted story.
  The full dedicated Drive suite and 65 database-contract checks then passed.
- The preceding `773dc0bc` main test sequence and 57 module regressions passed.
  Its separate Drive follow-up failed when the account-erasure child exited with
  Windows native code 3221225477. That failure remains retained; the later exact
  declared Drive rerun passed and does not establish the crash's root cause.
- A dependency Junction initially prevented Turbopack from resolving Next. Only
  the verified local Junction was removed; its shared target stayed intact. A
  worktree-owned frozen installation completed without changing dependency
  manifests, followed by a successful normal Turbopack build.
- Bundle ceilings passed: shared runtime 246.2 KB gzip against 247 KB, total
  client 931.3 KB against 940 KB, largest chunk 62.5 KB against 63 KB. The 170 KB
  shared-runtime target remains unmet. User performance was not measured.

## Findings retained alongside passing tests

Manual dark-mode inspection found a pale Floor frame with pale rail icons and
dark secondary text against the dark canvas. The mobile light-mode route capture
also shows a pale active-project label on a pale strip. The Floor/style owner is
repairing these at their authoritative sources. The My work capture says
“Someone” for a named recipient; the showcase-only user lookup is under source
review. Passing structural tests do not close these visual/content findings.

The RC-3 targeted independent review was stopped by an automatic cybersecurity
safety check and returned no verdict. It remains incomplete. This checkpoint
does not retry that review, adopt new materiality verdicts, certify all registered
states, or establish actual Clerk/Google/Stripe/production/human behavior.
Final rendering must be repeated after the pending source repairs.
