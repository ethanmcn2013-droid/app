# January follow-up integration

Current internal receiving baseline: `77d22a6bdbe6764da53daf1159049eef58fc523d`, merged from verified PR169 at01:21 UTC on5 September2026. Candidatee9f10184 passed independent evidence/config review and all three Linux workflows. Receiving CI33935902852, Verify33935903012 and Design33935902871 all pass. No production or provider acceptance is implied.

The original composition proof below used App `f3240a74bff3b5a839f272f898cd44aceb00159a` with Studio `b87d139ee1290f6aee75c8d023fe717357a9ab72`. These remain the exact historical source bounds for that proof.

The App composition retains Home7479 and calendar/export768951 and merges the reviewed S2/S5 pair Appda62317b / Studio43bf371. The account-deletion fence still awaits usage-erasure custody before product deletion. No conflicting source change or migration renumbering was needed. App0030 and Studio additive0001/0002 remain production-held.

## Verification on 5 September

- Independent S5 fix verification:154 positive checks, with the two unchanged bug-expecting repros failing for the corrected results. Small-cohort observed metadata is omitted; invalid acknowledgements retain both event and erasure custody.
- Independent actual three-store composition:3 scenarios,24 original checkpoints and14 fresh failure probes pass. The payment, issuance, late-template, fulfilment and account-deletion writers retain their real transaction/retry boundaries. No fixture seeds a successful claim or ready fulfilment.
- Principal combined runtime: the same actual three-store rehearsal passes3/3 and24 checkpoints; the separate signed delivery/reporting/erasure rehearsal passes9/9. No real provider, settlement or identity deletion runs.
- Newly registered suites: App sponsored-use27, Home16 and invitation25 pass. Studio fulfilment16 and sponsored-use25 pass. Both full typechecks pass.
- App migration contract65 passes. The owning migration runner applies through0030 to a disposable local target, proves the no-op rerun and reports integrity OK/zero foreign-key violations. This does not certify any deployed database.
- The first Windows issuance suite reports22 assertions passed but its store-test process fails, so the command fails. An isolated unchanged store rerun with TAP diagnostics passes8/8. The first failure remains a failed receipt; its cause was not established from that reporter output. Full Linux gates must pass before receiving integration.

The local commands were run with Node24.19.0 and pinned installed dependencies. Evidence is retained in the principal task's `work/integrated-*.txt` logs and independent reports under its `outputs/` directory. The committed owner composition guides retain commands, migration identities and source inventories.

## Gate wiring

Default App tests now include the issuance, sponsored-use, Home scope and invitation suites; existing account/export, billing and Drive registrations remain. Default Studio tests include the real fulfilment and signed usage/migration suites. Its fulfilment tests require an explicit `VENUE_APP_FIXTURE_ROOT` with installed matching App dependencies.

Both Linux code workflows install the immutable counterpart using that repository's pinned package manager, record its exact revision and remove the checkout before host lint/build scanning. App additionally runs the actual three-store and signed paired rehearsals. Cross-repository code is tested at the named revision, never assumed from a moving branch. Re-pin the counterpart when its runtime changes, and again at final receiving integration; source-changing pins must receive fresh paired evidence. Every trigger uses a compatible reviewed peer: the old main fallback lacked mandatory fixture code and was removed without skipping any suite.

Current pending work: the five reproduced journey/module defects below, complete persisted creator/recipient stories, final programme experience acceptance, Studio integration and live isolated provider/release steps. Notesf04 and current Home evidence are integrated and independently verified. Both original three-store and separate module restore proofs now exist; their limitations remain explicit. No routine design choice is represented as a specific founder selection.

Linux CI33933581755 subsequently rejected unannotated entitlement reads in the new issuance canonical/erasure modules. The queries were followed to their callers: code-uniqueness checks intentionally include all recipients to detect corrupt duplicate consumption, the canonical lookup resolves the stored grant owner before signed usage authorization, and the eraser receives the exact account/project SQL predicate used for deletion. Per-statement rationale now uses the existing isolation contract; no query, predicate, scanner, floor or policy was weakened. The scanner and its sensitivity tests pass24 checks. This annotation is subject to review and does not certify future reads automatically.

Fresh review confirmed those five annotations against the actual callers and found no missing authorization or concrete disclosure. Notesf04a766e then passed independent198 checks/scenarios and88 immutable source-input comparisons, with no scoped residual finding. It is merged at0438ae74. The integrated candidate passes its six recovery unit checks and all five actual-source server/browser fixture runners, including27 browser scenarios. Historical receipts are preserved: the new wrapper writes a distinct run beneath ignored `experience/output/notes-recovery`, fixes the source root, clears single-case filters and passes only an explicit fixture environment. Default CI runs server regressions; the installed-browser design job runs both browser regressions and retains artifacts. Final full Next/Clerk and material design acceptance remain open.

The182935f7 full132-case browser run and exact registry/receipt renewal now pass. Its Linux Verify33934085512 passed. CI33934085471 then identified generated CommonJS test bundles under `work/` as source lint errors. All five fixture builders now use the existing ignored `experience/output/notes-recovery/build` directory. The seven already generated local files were individually preserved with matching SHA-256 under its history folder; neither invitation fixture was touched. All five fixture runners and the normal full lint then pass, with71 inherited warnings/zero errors. No source rule or grandfather list changed. See `COMBINED-BROWSER.md` for exact run and preserved history.

Additional independent quiescent recovery at the exact f324/b87 pair passes12 checkpoints plus seven normal backup tests:31 tables in the primary App/Tasks database, seven Studio-local and20 shared tables restored with exact data/DDL hashes and170 Git-bound inputs. Lost event/erasure acknowledgements, actor fences, immutable receipts/triggers and wrong-key custody recovery are exercised. This is three-store synthetic proof, not all App module databases or production recovery; Notes, Timeline and Signal database proof is separately assigned.

## Remaining findings after receiving integration

The separate182935f7 module proof restored all30 Notes/Timeline/Signal tables with exact hashes/DDL, integrity and foreign-key checks;16 checkpoints plus seven existing backup tests passed and228 Git inputs were verified. Three checkpoints reproduce the defects below and must not be described as repaired behavior. Notes/Signal fresh bootstrap is not a receipted production adoption/no-op proof. The two recovery packages are quiescent internal snapshots at distinct revisions, not one distributed-atomic backup.

| Finding | Observed consequence | Repair owner / scope |
|---|---|---|
| JOURNEY-01 | My work omits undated/later assignments and offers a starter action ordinary members cannot use. | Collaboration lane, fix/january-recipient-project-work: selector, truthful first view and actual-role regressions. |
| JOURNEY-02 | An authorized task link toB is refused while saved projectA remains active, even with Active Project V3 enabled. | Same collaboration lane: canonical Tasks destination handoff, preserved membership checks and flag-off recovery. |
| MODULE-REC-01 | A signed Notes extract refuses a legitimate legacy account whose stored local ID differs from its Clerk subject. | Recovery lane, fix/january-module-lifecycle: immutable-subject mapping at current-membership lookup; receipt identity unchanged. |
| MODULE-REC-02 | Briefing drops authorized projects with no planning period from a successful catalog query. | Same recovery lane: true loose-project inclusion, retained archive/membership/exact-scope rules. |
| MODULE-REC-03 | Timeline erasure removes older children before failing on normalized binding/sync foreign-key restrictions. | Same recovery lane: complete actor-scoped transaction and dependency order, legacy compatibility, rollback and bystander proof. |

The principal integration worktree is feat-january-final-journeys, starting from77d. It owns shared package/CI/experience registration and final composition. The two repair lanes have distinct runtime ownership and preserve prior negative receipts. Fresh scoped review precedes integration. A full source-bound creator/private Note → Tasks and invited recipient → committed action → creator-published narrow Timeline → Home story remains required; component tests, demo screenshots and scripted timings do not establish human comprehension.
